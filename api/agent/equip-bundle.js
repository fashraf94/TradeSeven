// api/agent/equip-bundle.js
//
// Release 2 (settingsRev foundation, founder ruling D3 2026-07-10) —
// POST /api/agent/equip-bundle. The server-side migration of the client
// forgeService.equipBundle writer: the SECURITY NOTE in that function called
// for exactly this move before public launch (battle-lock enforced with the
// Admin SDK, not the client). Semantics are preserved 1:1 from the client
// implementation @ 4a0f43e — same reads, same validation order, same
// activeRules build, same gated conflict detection, same WS1 conflict-equip
// events, same response contract ({ conflictCheckResult, compatConflicts,
// archetype }) — with two additions:
//
//   1. ATOMICITY: the read-check-write runs in ONE transaction (the client
//      used a plain writeBatch after unguarded reads — a lost-update race on
//      equippedBundleIds/activeRules).
//   2. agent.settingsRev — transactional monotonic increment on every real
//      config write (Release 2 spec changelog #7). Nothing reads it yet
//      (additive-dark); Phase 2 stamps it into the battle snapshot.
//
// Import note (BUILD_RULES §4): agentProgression, ruleConflictReconciler,
// featureFlags, and ruleCompatClassify are api → src and Node-clean; this
// endpoint's test file's REAL imports are the dependency-surface guard.
//
// Pattern reference: api/agent/equip-watchlist.js (transaction body, sentinel
// error map) + api/agent/change-archetype.js (awaited post-commit WS1 event
// emission that is loud but never fails the committed write).

import { FieldValue } from 'firebase-admin/firestore';
import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { txUpdateAgentSettings } from '../_utils/agentSettingsTx.js';
import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { logSignalDrops } from '../_utils/shadowLogger.js';
import { isValidForgeId, FORGE_ID_REGEX, FORGE_ID_MAX_LEN } from '../_utils/idValidation.js';
import { getAgentLevel, FORGE_LIMITS } from '../../src/constants/agentProgression.js';
// Mastery P2 (spec §6.1): Forge limits gain the LAZY legacy floor —
// effective = field-wise max(mastery band by HIGHEST archetype level, live
// legacy entitlement) — plus the server-side rule-capacity check the §6.1
// rider mandates at the consequential paths. A8 BYTE-IDENTITY EXEMPTION
// FOOTNOTE: with enforcement off, the rule-capacity check still enforces
// TODAY'S legacy FORGE_LIMITS server-side — the flags-off hardening of
// limits the client already enforces (spec §6.1: "standalone security
// hardening exempt from flags-off byte-identity"; patch flag-#4 precedent).
// Byte-identity acceptance is thereby narrowed to valid-client behavior.
import { MASTERY_ENFORCEMENT_ENABLED } from '../_utils/masteryConfig.js';
import { masteryProfileRef, effectiveForgeLimits } from '../_utils/masteryEnforcement.js';
import { reconcile, RECONCILER_VERSION } from '../../src/utils/ruleConflictReconciler.js';
import { CONFLICT_RECONCILER_DETECT_ENABLED, RULE_COMPAT_MODE, COMPILER_ENABLED } from '../../src/config/featureFlags.js';
// Archetype Phase 2 (P2.4a): the DARK equip-time compiler. Both helper calls
// return null before any read/write while COMPILER_ENABLED=false — this
// endpoint stays byte-identical until the founder flag-flip PR.
import { prepareCompileInputs, writeCompiledBuildsInTx } from '../_utils/compileOnSettingsChange.js';
import { classifyBundleSnapshots } from '../../src/services/ruleCompatClassify.js';
import { snapshotsToActiveRules, gatherBundleSnapshots } from '../_utils/bundleRuleProjection.js';
import { waitUntil } from '@vercel/functions';
import { validateWriteEpochInTx } from '../_utils/compositionWriteEpoch.js';
import { COMPOSITION_ENFORCEMENT_MODE } from '../_utils/compositionConfig.js';
import { checkCandidateEquipLegality, isBlockingViolation } from '../_utils/compositionEnforcement.js';

export const config = { maxDuration: 10 };

const SENTINEL_PREFIX = '__equip_bundle:';
const SENTINEL_TO_HTTP = Object.freeze({
  composition_blocked: [409, 'composition_blocked', 'This bundle carries a rule that is off-identity for your agent\'s archetype under the new compatibility ruling.'],
  epoch_closed:     [409, 'epoch_closed',     'Configuration writes are briefly paused for a system identity update. Try again in a few minutes.'],
  agent_not_found:  [404, 'agent_not_found',  'Agent not found.'],
  forbidden:        [403, 'forbidden',        'Not authorized for this resource.'],
  battle_active:    [409, 'battle_active',    'Cannot equip bundle while agent has an active battle. Wait for the battle to complete.'],
  bundle_not_found: [404, 'bundle_not_found', 'Bundle not found.'],
  not_forged:       [400, 'not_forged',       'Bundle must be forged before equipping.'],
  bundle_limit:     [409, 'bundle_limit',     'Bundle limit reached for your agent\'s level. Unequip a bundle first or level up by playing more games.'],
  rule_limit:       [409, 'rule_limit',       'This bundle exceeds your rule capacity. Reforge it smaller or grow your capacity.'],
});

export default async function handler(req, res) {
  // 30/min (vs the sibling equips' 10): unequip+equip pairs ride composite
  // flows (deployExperimentToAgent, loadout rearranging) that the replaced
  // client-SDK path never throttled — headroom keeps those flows off 429s.
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
      // All reads before the write (Firestore transaction rule). Agent +
      // bundle refs derive purely from request params → one batched round
      // trip; validation order is unchanged.
      const bundleRef = bundlesCol.doc(bundleId);
      // Mastery P2: the profile joins the SAME batched read when enforcement
      // is on (reads before writes; zero added I/O while dark).
      const refs = MASTERY_ENFORCEMENT_ENABLED
        ? [agentRef, bundleRef, masteryProfileRef(db, user.uid)]
        : [agentRef, bundleRef];
      const [agentSnap, bundleSnap, profileSnap] = await tx.getAll(...refs);
      // Composition write-epoch fence (design note §3): read-phase validation —
      // zero I/O while dark; a closed epoch 409s with nothing written (A41).
      await validateWriteEpochInTx(tx, db, { sentinel: SENTINEL_PREFIX });
      if (!agentSnap.exists) throw new Error(SENTINEL_PREFIX + 'agent_not_found');
      const agent = agentSnap.data();
      if (agent.ownerId !== user.uid) throw new Error(SENTINEL_PREFIX + 'forbidden');
      if (agent.activeBattleId) throw new Error(SENTINEL_PREFIX + 'battle_active');

      if (!bundleSnap.exists) throw new Error(SENTINEL_PREFIX + 'bundle_not_found');
      const bundle = bundleSnap.data();
      if (bundle.status !== 'forged') throw new Error(SENTINEL_PREFIX + 'not_forged');

      // Composition candidate legality (offer/equip boundary, spec §2 rows 1-4):
      // 'off' = zero compute (A23); 'observe' = compute + attach, never blocks;
      // 'enforce' = core_conflict/deferred pairings and out-of-domain persisted
      // params REJECT with the stored config byte-unchanged (A4/A5/A6 — the
      // throw aborts the transaction before any write is buffered).
      let compositionViolations = [];
      if (COMPOSITION_ENFORCEMENT_MODE !== 'off') {
        compositionViolations = checkCandidateEquipLegality({
          ruleSnapshots: bundle.ruleSnapshots || [],
          archetype: agent.archetype,
        }).filter(isBlockingViolation);
        if (COMPOSITION_ENFORCEMENT_MODE === 'enforce' && compositionViolations.length > 0) {
          const err = new Error(SENTINEL_PREFIX + 'composition_blocked');
          err.details = { compositionViolations };
          throw err;
        }
      }

      const currentEquipped = agent.equippedBundleIds || [];

      // Amendment 4: equipped-bundle limit against progression level —
      // effective limits under enforcement carry the §6.1 lazy legacy floor
      // (maxBundles has no mastery dimension and passes through unchanged).
      const level = getAgentLevel(agent.stats?.gamesPlayed || 0);
      const legacyLimits = FORGE_LIMITS[level];
      const limits = MASTERY_ENFORCEMENT_ENABLED
        ? effectiveForgeLimits({ legacyLimits, profileData: profileSnap?.exists ? profileSnap.data() : null })
        : legacyLimits;
      if (currentEquipped.length >= limits.maxBundles) {
        const err = new Error(SENTINEL_PREFIX + 'bundle_limit');
        // Dynamic copy detail (level + max) for the client message — the
        // static sentinel map carries the generic fallback.
        err.details = { level, maxBundles: limits.maxBundles };
        throw err;
      }

      // §6.1 rider (server rule-capacity check; A8 exemption — see the
      // import note): an over-capacity bundle cannot be EQUIPPED past the
      // server, and once equipped its rule content is client-immutable
      // (firestore.rules bundles update guard, same review pass) — so the
      // capacity checked here is the capacity every later reprojection
      // carries. Reforge deliberately carries NO capacity check (it is the
      // trim path; see reforge-bundle.js header).
      const bundleRuleCount = Array.isArray(bundle.ruleSnapshots) ? bundle.ruleSnapshots.length : 0;
      if (bundleRuleCount > limits.maxRulesPerBundle) {
        const err = new Error(SENTINEL_PREFIX + 'rule_limit');
        err.details = { level, maxRulesPerBundle: limits.maxRulesPerBundle, bundleRuleCount };
        throw err;
      }

      // Gather rule snapshots from all equipped bundles + this one (shared
      // transactional projection — the client version read these unguarded).
      const allSnapshots = await gatherBundleSnapshots(tx, bundlesCol, currentEquipped);
      allSnapshots.push(...(bundle.ruleSnapshots || []).map((r) => ({ ...r, bundleName: bundle.name })));

      const activeRules = snapshotsToActiveRules(allSnapshots);

      // Equip-time conflict DETECTION (shadow-safe; gated) — advisory only,
      // never alters activeRules. Identical to the client implementation.
      let conflictCheckResult = null;
      if (CONFLICT_RECONCILER_DETECT_ENABLED) {
        const { conflictReport, coverage, reconcilerError } = reconcile(
          activeRules, [], agent.equippedTraits || [], { legacyDefaultTier: 2 },
        );
        conflictCheckResult = {
          conflicts: conflictReport,
          coverage,
          reconcilerVersion: RECONCILER_VERSION,
          reconcilerError: reconcilerError || null,
          checkedAt: nowIso,
        };
      }

      // P2.4a compile reads (dark no-op): must precede the first tx write.
      const compileInputs = await prepareCompileInputs(tx, {
        agentRef,
        nextEquippedBundleIds: [...currentEquipped, bundleId],
        enabled: COMPILER_ENABLED,
      });

      tx.update(bundleRef, {
        status: 'equipped',
        equippedAt: nowIso,
        // Only written when DETECT is on, so a flag-off equip stays byte-identical.
        ...(CONFLICT_RECONCILER_DETECT_ENABLED && { conflictCheckResult }),
        // serverTimestamp keeps bundle.updatedAt Timestamp-typed like every
        // other bundle writer (forgeService) — no type flip-flop per source.
        updatedAt: FieldValue.serverTimestamp(),
      });
      // settingsRev rides structurally (Release 2 changelog #7);
      // additive-dark (no reader until Phase 2 stamps the snapshot).
      txUpdateAgentSettings(tx, agentRef, {
        equippedBundleIds: [...currentEquipped, bundleId],
        activeRules,
        updatedAt: nowIso,
      });

      // P2.4a (dark no-op): compile rides the settingsRev increment above.
      const compilePreviews = writeCompiledBuildsInTx(tx, {
        agentRef,
        agentId,
        agent,
        nextState: { equippedBundleIds: [...currentEquipped, bundleId] },
        bundles: compileInputs?.bundles,
        enabled: COMPILER_ENABLED,
        nowIso,
      });

      return {
        conflictCheckResult,
        compositionViolations,
        archetype: agent.archetype || null,
        equippedBundleIds: [...currentEquipped, bundleId],
        // The bundle doc crosses the tx boundary ONCE for the post-commit
        // WS1 classification (pure fn; its location is unobservable).
        bundle,
        compilePreviews,
      };
    });
  } catch (txErr) {
    if (typeof txErr?.message === 'string' && txErr.message.startsWith(SENTINEL_PREFIX)) {
      const code = txErr.message.slice(SENTINEL_PREFIX.length);
      const mapped = SENTINEL_TO_HTTP[code];
      if (mapped) {
        const [statusCode, errorKey, humanCopy] = mapped;
        const message = code === 'bundle_limit' && txErr.details
          ? `Bundle limit reached for your agent's level (${txErr.details.maxBundles} bundles at ${txErr.details.level}). Unequip a bundle first or level up by playing more games.`
          : humanCopy;
        return res.status(statusCode).json({ error: errorKey, message, ...(txErr.details || {}) });
      }
    }
    console.error('[equip-bundle] error:', txErr);
    return res.status(500).json({ error: 'server_error', message: 'Could not equip bundle.' });
  }

  // WS1 B6 — conflict-equip surface, identical semantics to the client path:
  // classify THIS bundle's snapshots against the agent's archetype, log each
  // conflict (observe + enforce), hand the list back for the warning toast.
  // Never blocks, and (change-archetype precedent) never fails the committed
  // equip — loud on failure. Server-side the events go straight to the shadow
  // logger (the client posted to log-rule-compat-event, which lands in the
  // same store with the same envelope).
  let compatConflicts = [];
  const compatActive = RULE_COMPAT_MODE === 'observe' || RULE_COMPAT_MODE === 'enforce';
  if (compatActive) {
    try {
      compatConflicts = classifyBundleSnapshots({
        archetype: txResult.archetype,
        ruleSnapshots: txResult.bundle.ruleSnapshots || [],
        ruleHardness: txResult.bundle.ruleHardness || {},
      });
      if (compatConflicts.length > 0) {
        // Event shape matches what the OLD pipeline PERSISTED: the client
        // posted through log-rule-compat-event.js, whose sanitizeEvent strips
        // per-event agentId/archetype/mode (the envelope carries them) and
        // caps at 20 events — mirrored here so at-rest rule_compat records
        // keep one shape across producers.
        const persisted = await logSignalDrops({
          stage: 'rule_compat',
          userId: user.uid,
          agentId,
          archetype: txResult.archetype,
          mode: RULE_COMPAT_MODE,
          events: compatConflicts.slice(0, 20).map((c) => ({
            type: 'compat_conflict_equip',
            ruleId: c.templateId,
            ruleDocId: c.ruleDocId,
            state: 'core_conflict',
            zone1Ref: c.zone1Ref,
            hardnessRequested: c.resolvedHardness,
            path: 'equip_bundle',
            blocked: false,
            ts: nowIso,
          })),
          eventCount: compatConflicts.length,
          loggedAt: nowIso,
        });
        // Finish the emitter set (WS1 enforce Phase 1 discipline): a swallowed
        // GCS write resolves false (never throws — shadowLogger.js), so it
        // would slip past the catch below and leave the conflict-equip stream
        // silently short. Surface it loudly; the equip is committed, so (like
        // change-archetype's rescan) a telemetry miss never fails the request.
        if (persisted !== true) {
          console.error('[equip-bundle] compat conflict-equip events did not persist (swallowed GCS write or GCS disabled); equip committed.');
        }
      }
    } catch (compatErr) {
      console.error('[equip-bundle] compat classification failed (equip committed):', compatErr?.message || compatErr);
    }
  }

  // Shadow log the equip itself (equip-watchlist precedent), fire-and-forget.
  waitUntil(
    logSignalDrops({
      stage: 'bundle_equip',
      userId: user.uid,
      agentId,
      bundleId,
      loggedAt: nowIso,
    }).catch(() => {}),
  );

  console.log(`[equip-bundle] agent ${agentId} → bundle ${bundleId} (rules=${txResult.equippedBundleIds.length} bundles)`);

  // Response contract preserved from the client function's return value.
  // compilePreviews is ADDITIVE and appears only under COMPILER_ENABLED
  // (P2.4a) — flag off, the JSON is byte-identical to today.
  return res.status(200).json({
    agentId,
    bundleId,
    conflictCheckResult: txResult.conflictCheckResult,
    // Composition observe-mode instrumentation: [] while 'off' stays absent-
    // equivalent for existing clients; populated under 'observe' (never blocks).
    ...(txResult.compositionViolations?.length ? { compositionViolations: txResult.compositionViolations } : {}),
    compatConflicts,
    archetype: txResult.archetype,
    equippedBundleIds: txResult.equippedBundleIds,
    ...(txResult.compilePreviews ? { compilePreviews: txResult.compilePreviews } : {}),
  });
}
