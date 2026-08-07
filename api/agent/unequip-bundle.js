// api/agent/unequip-bundle.js
//
// Release 2 (settingsRev foundation, founder ruling D3 2026-07-10) —
// POST /api/agent/unequip-bundle. Server-side migration of the client
// forgeService.unequipBundle writer (see equip-bundle.js for the rationale).
// Semantics preserved 1:1 from the client implementation @ 4a0f43e:
//
// - DELIBERATELY NO battle-lock: the client unequip never had one (only the
//   equip side did), and reforgeBundle unequips as a sub-step — adding a lock
//   here would change live reforge behavior. The asymmetry is preserved and
//   flagged in the Phase-1 report for founder review.
// - Bundle must be status 'equipped' (else 400, the client's
//   'Bundle is not equipped' throw).
// - activeRules rebuilt from the REMAINING equipped bundles' snapshots.
//
// Additions over the client version: one transaction (atomicity) and the
// agent.settingsRev monotonic increment (Release 2 spec changelog #7).

import { FieldValue } from 'firebase-admin/firestore';
import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { txUpdateAgentSettings } from '../_utils/agentSettingsTx.js';
import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { logSignalDrops } from '../_utils/shadowLogger.js';
import { isValidForgeId, FORGE_ID_REGEX, FORGE_ID_MAX_LEN } from '../_utils/idValidation.js';
import { snapshotsToActiveRules, gatherBundleSnapshots } from '../_utils/bundleRuleProjection.js';
import { waitUntil } from '@vercel/functions';
// Archetype Phase 2 (P2.4a): DARK equip-time compiler — both calls return
// null before any read/write while COMPILER_ENABLED=false (byte-identical).
import { COMPILER_ENABLED } from '../../src/config/featureFlags.js';
import { prepareCompileInputs, writeCompiledBuildsInTx } from '../_utils/compileOnSettingsChange.js';
import { validateWriteEpochInTx } from '../_utils/compositionWriteEpoch.js';

export const config = { maxDuration: 10 };

const SENTINEL_PREFIX = '__unequip_bundle:';
const SENTINEL_TO_HTTP = Object.freeze({
  epoch_closed:     [409, 'epoch_closed',     'Configuration writes are briefly paused for a system identity update. Try again in a few minutes.'],
  agent_not_found:  [404, 'agent_not_found',  'Agent not found.'],
  forbidden:        [403, 'forbidden',        'Not authorized for this resource.'],
  bundle_not_found: [404, 'bundle_not_found', 'Bundle not found.'],
  not_equipped:     [400, 'not_equipped',     'Bundle is not equipped.'],
});

export default async function handler(req, res) {
  // 30/min — see equip-bundle.js (composite flows: reforge, archive,
  // deployExperimentToAgent all unequip mid-flow).
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 30, windowMs: 60_000 } })) {
    return;
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  const { agentId, bundleId } = req.body || {};
  if (!isValidForgeId(agentId)) {
    return res.status(400).json({
      error: 'invalid_agent_id',
      message: `agentId must match ${FORGE_ID_REGEX} and be ≤${FORGE_ID_MAX_LEN} chars`,
    });
  }
  if (!isValidForgeId(bundleId)) {
    return res.status(400).json({
      error: 'invalid_bundle_id',
      message: `bundleId must match ${FORGE_ID_REGEX} and be ≤${FORGE_ID_MAX_LEN} chars`,
    });
  }

  const db = getFirebaseAdmin();
  const agentRef = db.collection('agents').doc(agentId);
  const bundlesCol = agentRef.collection('bundles');
  const nowIso = new Date().toISOString();

  let txResult;
  try {
    txResult = await db.runTransaction(async (tx) => {
      // Batched independent point reads (both refs derive from request params).
      const bundleRef = bundlesCol.doc(bundleId);
      const [agentSnap, bundleSnap] = await tx.getAll(agentRef, bundleRef);
      // Composition write-epoch fence (design note §3): read-phase validation —
      // zero I/O while dark; a closed epoch 409s with nothing written (A41).
      await validateWriteEpochInTx(tx, db, { sentinel: SENTINEL_PREFIX });
      if (!agentSnap.exists) throw new Error(SENTINEL_PREFIX + 'agent_not_found');
      const agent = agentSnap.data();
      if (agent.ownerId !== user.uid) throw new Error(SENTINEL_PREFIX + 'forbidden');
      // No battle-lock — see header.

      if (!bundleSnap.exists) throw new Error(SENTINEL_PREFIX + 'bundle_not_found');
      const bundle = bundleSnap.data();
      if (bundle.status !== 'equipped') throw new Error(SENTINEL_PREFIX + 'not_equipped');

      const currentIds = agent.equippedBundleIds || [];
      const remainingIds = currentIds.filter((id) => id !== bundleId);

      // Drifted state (bundle says 'equipped' but the agent never lists it):
      // heal the bundle doc's status, but do NOT rewrite the agent or bump
      // settingsRev — a no-op agent write would mint a phantom settings
      // revision the Phase-2 staleness check would read as a real change.
      if (remainingIds.length === currentIds.length) {
        tx.update(bundleRef, {
          status: 'forged',
          equippedAt: null,
          updatedAt: FieldValue.serverTimestamp(),
        });
        return { idempotent: true, equippedBundleIds: currentIds };
      }

      // Rebuild activeRules from the remaining equipped bundles via the
      // SHARED projection (equip-bundle.js uses the same one — the agent
      // doc's shape can never depend on which endpoint last wrote it).
      const activeRules = snapshotsToActiveRules(
        await gatherBundleSnapshots(tx, bundlesCol, remainingIds),
      );

      // P2.4a compile reads (dark no-op): must precede the first tx write.
      const compileInputs = await prepareCompileInputs(tx, {
        agentRef,
        nextEquippedBundleIds: remainingIds,
        enabled: COMPILER_ENABLED,
      });

      tx.update(bundleRef, {
        status: 'forged',
        equippedAt: null,
        // serverTimestamp — see equip-bundle.js (bundle docs stay Timestamp-typed).
        updatedAt: FieldValue.serverTimestamp(),
      });
      // settingsRev rides structurally (Release 2 changelog #7).
      txUpdateAgentSettings(tx, agentRef, {
        equippedBundleIds: remainingIds,
        activeRules,
        updatedAt: nowIso,
      });
      // P2.4a (dark no-op): compile rides the settingsRev increment above.
      const compilePreviews = writeCompiledBuildsInTx(tx, {
        agentRef,
        agentId,
        agent,
        nextState: { equippedBundleIds: remainingIds },
        bundles: compileInputs?.bundles,
        // PR 3.5: candidate-mode projection inputs (absent while dark)
        ruleDocs: compileInputs?.ruleDocs ?? null,
        allBundles: compileInputs?.allBundles ?? null,
        enabled: COMPILER_ENABLED,
        nowIso,
      });
      return { idempotent: false, equippedBundleIds: remainingIds, compilePreviews };
    });
  } catch (txErr) {
    if (typeof txErr?.message === 'string' && txErr.message.startsWith(SENTINEL_PREFIX)) {
      const code = txErr.message.slice(SENTINEL_PREFIX.length);
      const mapped = SENTINEL_TO_HTTP[code];
      if (mapped) {
        const [statusCode, errorKey, humanCopy] = mapped;
        return res.status(statusCode).json({ error: errorKey, message: humanCopy });
      }
    }
    console.error('[unequip-bundle] error:', txErr);
    return res.status(500).json({ error: 'server_error', message: 'Could not unequip bundle.' });
  }

  // Shadow log only on a real state change (house pattern — no log when the
  // drifted-state heal path took the idempotent branch).
  if (!txResult.idempotent) {
    waitUntil(
      logSignalDrops({
        stage: 'bundle_unequip',
        userId: user.uid,
        agentId,
        bundleId,
        loggedAt: nowIso,
      }).catch(() => {}),
    );
  }

  console.log(`[unequip-bundle] agent ${agentId} ✕ bundle ${bundleId} (idempotent=${txResult.idempotent}, remaining=${txResult.equippedBundleIds.length})`);

  // compilePreviews is ADDITIVE and appears only under COMPILER_ENABLED (P2.4a).
  return res.status(200).json({
    agentId,
    bundleId,
    equippedBundleIds: txResult.equippedBundleIds,
    idempotent: txResult.idempotent,
    ...(txResult.compilePreviews ? { compilePreviews: txResult.compilePreviews } : {}),
  });
}
