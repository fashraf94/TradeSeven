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
import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { logSignalDrops } from '../_utils/shadowLogger.js';
import { isValidForgeId, FORGE_ID_REGEX, FORGE_ID_MAX_LEN } from '../_utils/idValidation.js';
import { waitUntil } from '@vercel/functions';

export const config = { maxDuration: 10 };

const SENTINEL_PREFIX = '__unequip_bundle:';
const SENTINEL_TO_HTTP = Object.freeze({
  agent_not_found:  [404, 'agent_not_found',  'Agent not found.'],
  forbidden:        [403, 'forbidden',        'Not authorized for this resource.'],
  bundle_not_found: [404, 'bundle_not_found', 'Bundle not found.'],
  not_equipped:     [400, 'not_equipped',     'Bundle is not equipped.'],
});

export default async function handler(req, res) {
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 10, windowMs: 60_000 } })) {
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
      const agentSnap = await tx.get(agentRef);
      if (!agentSnap.exists) throw new Error(SENTINEL_PREFIX + 'agent_not_found');
      const agent = agentSnap.data();
      if (agent.ownerId !== user.uid) throw new Error(SENTINEL_PREFIX + 'forbidden');
      // No battle-lock — see header.

      const bundleRef = bundlesCol.doc(bundleId);
      const bundleSnap = await tx.get(bundleRef);
      if (!bundleSnap.exists) throw new Error(SENTINEL_PREFIX + 'bundle_not_found');
      const bundle = bundleSnap.data();
      if (bundle.status !== 'equipped') throw new Error(SENTINEL_PREFIX + 'not_equipped');

      const remainingIds = (agent.equippedBundleIds || []).filter((id) => id !== bundleId);

      // Rebuild activeRules from remaining equipped bundles (transactional reads).
      const allSnapshots = [];
      if (remainingIds.length > 0) {
        const remainingSnaps = await tx.getAll(...remainingIds.map((eid) => bundlesCol.doc(eid)));
        for (const eSnap of remainingSnaps) {
          if (eSnap.exists) {
            const eData = eSnap.data();
            allSnapshots.push(...(eData.ruleSnapshots || []).map((r) => ({ ...r, bundleName: eData.name })));
          }
        }
      }
      const activeRules = allSnapshots.map((snap) => ({
        ruleId: snap.id,
        text: snap.text,
        textTemplate: snap.textTemplate || null,
        params: snap.params || null,
        paramValues: snap.paramValues || null,
        category: snap.category || null,
        bundleName: snap.bundleName,
        // Carried for the conflict reconciler (see forgeBundle snapshot note).
        sourceRef: snap.sourceRef || null,
        provenance: snap.provenance || null,
      }));

      tx.update(bundleRef, {
        status: 'forged',
        equippedAt: null,
        updatedAt: nowIso,
      });
      tx.update(agentRef, {
        equippedBundleIds: remainingIds,
        activeRules,
        // Release 2 (spec changelog #7): monotonic settings revision.
        settingsRev: FieldValue.increment(1),
        updatedAt: nowIso,
      });
      return { equippedBundleIds: remainingIds };
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

  waitUntil(
    logSignalDrops({
      stage: 'bundle_unequip',
      userId: user.uid,
      agentId,
      bundleId,
      loggedAt: nowIso,
    }).catch(() => {}),
  );

  console.log(`[unequip-bundle] agent ${agentId} ✕ bundle ${bundleId} (remaining=${txResult.equippedBundleIds.length})`);

  return res.status(200).json({
    agentId,
    bundleId,
    equippedBundleIds: txResult.equippedBundleIds,
  });
}
