// api/agent/reforge-bundle.js
//
// WS1 enforce Phase 2 — POST /api/agent/reforge-bundle. Server-side migration
// of the client forgeService.reforgeBundle writer (the equip/unequip D3
// pattern): the reforge carry re-WRITES authored ruleHardness overrides into
// a new draft doc, so it moves server-side with setRuleHardness — after the
// bundles field allowlist publishes, ruleHardness is server-mintable only and
// the WS1 B3 carry gate cannot be bypassed by a dishonest client (WS1 Enforce
// Build Spec §3; the folded-in bundles-hardening blocker).
//
// NOT flag-gated: reforge is an existing feature (its only UI caller today is
// the orphaned MyBundlesTab subtree, so the swap is behaviorally dark), and
// the B3 gate honors RULE_COMPAT_MODE exactly as the client did — off is
// byte-identical, observe logs-not-strips, enforce strips.
//
// Semantics preserved 1:1 from the client implementation @ bea6e385:
//   - draft bundles → 400 ('Cannot reforge a draft bundle — edit it directly')
//   - WS1 B3 gate over the carried 'hard' overrides (template rules only;
//     missing rule docs / manual rules skip — carry unchanged): under enforce
//     a blocked carry is STRIPPED, never a whole-reforge block (approved
//     treatment): hard-CATEGORY rules demote to an explicit 'soft' (deletion
//     would resurrect must-obey via the category fallback); soft-category
//     overrides are deleted (revert to the soft default). Each strip is
//     logged (blocked:true) + returned for the inline notice; under observe
//     the carry is unchanged and each would-strip logs blocked:false.
//   - equipped bundles are unequipped as a sub-step (deliberately NO
//     battle-lock — the unequip-bundle.js asymmetry, preserved): activeRules
//     rebuilt from the REMAINING equipped bundles via the SHARED projection,
//     settingsRev rides the agent write structurally (agentSettingsTx). The
//     drifted state (bundle says equipped, agent never lists it) heals via
//     the archive write with NO agent write — no phantom settingsRev.
//   - old bundle archived (archivedAt ISO string — the client's at-rest
//     type); new draft created with the same rules, version+1, and the
//     carried (possibly stripped) ruleHardness map.
//
// Import note (BUILD_RULES §4): featureFlags, ruleCompatEvaluate (+ its data
// imports), and ruleHardness are api → src / server-shared and Node-clean;
// the base test file's REAL imports are the dependency-surface guard.

import { FieldValue } from 'firebase-admin/firestore';
import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { txUpdateAgentSettings } from '../_utils/agentSettingsTx.js';
import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { logSignalDrops } from '../_utils/shadowLogger.js';
import { isValidForgeId, FORGE_ID_REGEX, FORGE_ID_MAX_LEN } from '../_utils/idValidation.js';
// Mastery P2 review DECISION (all three review angles concurred — flagged
// to the founder in the P2 report as a deviation from the reforge-anchor
// ruling): reforge carries NO rule-capacity check. The check would gate the
// wrong dimension (reforge resets ruleSnapshots and carries ruleIds into a
// DRAFT) and, decisively, reforge→edit-draft is the ONLY valid-client trim
// path for an over-capacity forged bundle — blocking it deadlocks exactly
// the remediation flow that equip-bundle's rule_limit copy directs users
// to, with no security gain (a draft is unequippable until it passes the
// equip-time check, which is the consequential gate).
import { snapshotsToActiveRules, gatherBundleSnapshots } from '../_utils/bundleRuleProjection.js';
import { classifyByCategory } from '../_utils/ruleHardness.js';
import { RULE_COMPAT_MODE, COMPILER_ENABLED } from '../../src/config/featureFlags.js';
// Archetype Phase 2 (P2.4a): DARK equip-time compiler — both calls return
// null before any read/write while COMPILER_ENABLED=false (byte-identical).
// Reforge compiles ONLY on the equipped-unequip sub-step (the one path that
// bumps settingsRev here); a non-equipped reforge mints no revision and
// therefore no build.
import { prepareCompileInputs, writeCompiledBuildsInTx } from '../_utils/compileOnSettingsChange.js';
import {
  isRuleCompatActive,
  evaluateRuleCompatWrite,
  toStreamEventShape,
} from '../../src/services/ruleCompatEvaluate.js';
import { waitUntil } from '@vercel/functions';
import { validateWriteEpochInTx } from '../_utils/compositionWriteEpoch.js';

export const config = { maxDuration: 10 };

const SENTINEL_PREFIX = '__reforge_bundle:';
const SENTINEL_TO_HTTP = Object.freeze({
  epoch_closed:     [409, 'epoch_closed',     'Configuration writes are briefly paused for a system identity update. Try again in a few minutes.'],
  agent_not_found:  [404, 'agent_not_found',  'Agent not found.'],
  forbidden:        [403, 'forbidden',        'Not authorized for this resource.'],
  bundle_not_found: [404, 'bundle_not_found', 'Bundle not found.'],
  is_draft:         [400, 'is_draft',         'Cannot reforge a draft bundle — edit it directly'],
});

export default async function handler(req, res) {
  // 10/min — reforge is a heavy, rare action (archive + create + reproject).
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
  const rulesCol = agentRef.collection('rules');
  const nowIso = new Date().toISOString();

  let txResult;
  try {
    txResult = await db.runTransaction(async (tx) => {
      const bundleRef = bundlesCol.doc(bundleId);
      const [agentSnap, bundleSnap] = await tx.getAll(agentRef, bundleRef);
      // Composition write-epoch fence (design note §3): read-phase validation —
      // zero I/O while dark; a closed epoch 409s with nothing written (A41).
      await validateWriteEpochInTx(tx, db, { sentinel: SENTINEL_PREFIX, actor: user.uid }); // #4: probe-window admission
      if (!agentSnap.exists) throw new Error(SENTINEL_PREFIX + 'agent_not_found');
      const agent = agentSnap.data();
      if (agent.ownerId !== user.uid) throw new Error(SENTINEL_PREFIX + 'forbidden');
      // Deliberately no battle-lock — see header.

      if (!bundleSnap.exists) throw new Error(SENTINEL_PREFIX + 'bundle_not_found');
      const bundle = bundleSnap.data();
      if (bundle.status === 'draft') throw new Error(SENTINEL_PREFIX + 'is_draft');
      // Deliberately no rule-capacity check — see the header note: reforge
      // IS the trim path; equip-bundle is the enforcement gate.

      // ── WS1 B3 — evaluate the hard overrides being carried forward ──
      // (reads the override rule docs; pure decisions; strips under enforce)
      const carriedHardness = { ...(bundle.ruleHardness || {}) };
      const strippedConflicts = [];
      const events = [];
      const hardOverrideIds = Object.keys(carriedHardness).filter((rid) => carriedHardness[rid] === 'hard');
      if (isRuleCompatActive() && hardOverrideIds.length > 0) {
        const ruleSnaps = await tx.getAll(...hardOverrideIds.map((rid) => rulesCol.doc(rid)));
        hardOverrideIds.forEach((rid, i) => {
          const ruleData = ruleSnaps[i].exists ? ruleSnaps[i].data() : null;
          const sourceRef = ruleData?.sourceRef || null;
          if (!sourceRef) return; // manual / missing → outside the map, carry unchanged
          const result = evaluateRuleCompatWrite({
            archetype: agent.archetype || null, // the agent's REAL archetype — never a caller-supplied copy
            templateId: sourceRef,
            resolvedHardness: 'hard',
            path: 'reforge_carry',
            agentId,
            ruleDocId: rid,
          });
          events.push(...result.events);
          if (result.decision === 'block') {
            // Strip instead of blocking the whole reforge (approved treatment).
            // A hard-CATEGORY rule must carry an explicit 'soft' — deleting the
            // entry would resurrect must-obey via the category fallback.
            if (classifyByCategory(ruleData?.category || null) === 'hard') {
              carriedHardness[rid] = 'soft';
            } else {
              delete carriedHardness[rid];
            }
            strippedConflicts.push({ templateId: sourceRef, ruleDocId: rid });
          }
        });
      }

      // ── unequip sub-step (equipped bundles only; client-parity semantics) ──
      let unequipped = false;
      let agentUpdate = null;
      if (bundle.status === 'equipped') {
        const currentIds = agent.equippedBundleIds || [];
        const remainingIds = currentIds.filter((id) => id !== bundleId);
        if (remainingIds.length !== currentIds.length) {
          // Rebuild activeRules from the remaining equipped bundles via the
          // SHARED projection (equip/unequip-bundle use the same one).
          const activeRules = snapshotsToActiveRules(
            await gatherBundleSnapshots(tx, bundlesCol, remainingIds),
          );
          agentUpdate = { equippedBundleIds: remainingIds, activeRules, updatedAt: nowIso };
          unequipped = true;
        }
        // Drifted state (equipped status, never listed): the archive write
        // below heals the bundle doc; no agent write, no phantom settingsRev.
      }

      // P2.4a compile reads (dark no-op; gated on the settingsRev-bumping
      // path): must precede the first tx write.
      const compileInputs = await prepareCompileInputs(tx, {
        agentRef,
        db, // Sol review #11: record-scoped candidate selection
        nextEquippedBundleIds: agentUpdate ? agentUpdate.equippedBundleIds : [],
        enabled: COMPILER_ENABLED && !!agentUpdate,
      });

      // ── ALL READS DONE — writes ──
      const newRef = bundlesCol.doc();

      tx.update(bundleRef, {
        status: 'archived',
        archivedAt: nowIso, // ISO string — the client writer's at-rest type
        ...(bundle.status === 'equipped' ? { equippedAt: null } : {}),
        updatedAt: FieldValue.serverTimestamp(),
      });

      if (agentUpdate) {
        // settingsRev rides structurally (Release 2 changelog #7).
        txUpdateAgentSettings(tx, agentRef, agentUpdate);
      }
      // P2.4a (dark no-op): compile rides the settingsRev increment above.
      const compilePreviews = agentUpdate
        ? writeCompiledBuildsInTx(tx, {
            agentRef,
            agentId,
            agent,
            nextState: { equippedBundleIds: agentUpdate.equippedBundleIds },
            bundles: compileInputs?.bundles,
        // PR 3.5: candidate-mode projection inputs (absent while dark)
        ruleDocs: compileInputs?.ruleDocs ?? null,
        allBundles: compileInputs?.allBundles ?? null,
        candidateMode: compileInputs?.candidateMode, // #11: the record's selection, never bare flag
            enabled: COMPILER_ENABLED,
            nowIso,
          })
        : null;

      tx.set(newRef, {
        name: bundle.name,
        version: (bundle.version || 1) + 1,
        previousVersionId: bundleId,
        status: 'draft',
        ruleIds: bundle.ruleIds || [],
        // Carry authored hard/soft overrides forward to the reforged draft
        // (minus any enforce-mode conflict strips above).
        ruleHardness: carriedHardness,
        ruleSnapshots: [], // Draft bundles don't have snapshots (Amendment 3)
        conflictCheckResult: null,
        createdAt: FieldValue.serverTimestamp(),
        forgedAt: null,
        equippedAt: null,
        archivedAt: null,
        performanceData: {
          battlesEquipped: 0,
          totalCitations: 0,
          successfulCitations: 0,
        },
      });

      return {
        compilePreviews,
        newBundleId: newRef.id,
        strippedConflicts,
        events,
        unequipped,
        archetype: agent.archetype || null,
      };
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
    console.error('[reforge-bundle] error:', txErr);
    return res.status(500).json({ error: 'server_error', message: 'Could not reforge bundle.' });
  }

  // rule_compat is a CATALOG stream (Signal Capture Rider §5): awaited, and
  // the persistence boolean is checked (Phase 1) — a swallowed GCS write is
  // loud and reported via compatLogged, but never fails the committed reforge.
  let compatLogged = null;
  if (txResult.events.length > 0) {
    try {
      const persisted = await logSignalDrops({
        stage: 'rule_compat',
        userId: user.uid,
        agentId,
        archetype: txResult.archetype,
        mode: RULE_COMPAT_MODE,
        events: txResult.events.slice(0, 20).map(toStreamEventShape),
        eventCount: txResult.events.length,
        loggedAt: nowIso,
      });
      compatLogged = persisted === true;
    } catch (logErr) {
      console.error('[reforge-bundle] compat emit threw:', logErr?.message || logErr);
      compatLogged = false;
    }
    if (!compatLogged) {
      console.error('[reforge-bundle] compat event did not persist (swallowed GCS write or GCS disabled).');
    }
  }

  // Telemetry parity with the client flow (which called the unequip endpoint
  // mid-reforge): a real unequip sub-step logs the same bundle_unequip stage,
  // fire-and-forget (non-catalog, the unequip-bundle.js pattern).
  if (txResult.unequipped) {
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

  console.log(
    `[reforge-bundle] agent ${agentId} bundle ${bundleId} → draft ${txResult.newBundleId} ` +
    `(unequipped=${txResult.unequipped}, stripped=${txResult.strippedConflicts.length})`,
  );

  // compilePreviews is ADDITIVE and appears only under COMPILER_ENABLED (P2.4a).
  return res.status(200).json({
    agentId,
    bundleId: txResult.newBundleId,
    strippedConflicts: txResult.strippedConflicts,
    compatLogged,
    ...(txResult.compilePreviews ? { compilePreviews: txResult.compilePreviews } : {}),
  });
}
