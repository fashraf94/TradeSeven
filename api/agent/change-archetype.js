// api/agent/change-archetype.js
//
// POST /api/agent/change-archetype. Changes an agent's archetype (its trading
// personality / identity) AND atomically loads that archetype's born-with trait
// set — the invariant: an agent's archetype always carries that archetype's
// starter traits, with no persisted state where they disagree. On a real change
// it writes agent.archetype + agent.equippedTraits (the born-with set) in one
// tx.update and replaces the trait rule docs (create new / soft-delete old) in
// the SAME transaction, so a partial failure can never strand the agent in the
// archetype=new / traits=old bad state, and a caller Cancel (never invoking this
// endpoint) commits nothing. The archetype drives decide.js scoring + prompt
// context downstream; it never touches the fenced archetype config files.
//
// Battle-locked (mirrors equip-watchlist E3 / the equipBundle activeBattleId
// guard): a change is blocked while the agent has an active battle, so a live
// battle's frozen archetype can't shift under it (the battle-lock is checked
// first, mirroring equip-watchlist, so a re-select during a battle still 409s).
// Idempotent otherwise: re-selecting the current archetype outside a battle is a
// 200 no-op with no write and no shadow log. Atomic: the agent read + write
// happen in one transaction.
//
// Pattern reference: api/agent/equip-watchlist.js (transaction body, sentinel
// error map, shadow-log fire-and-forget). Delta: single-doc read+write (agents).

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { txUpdateAgentSettings } from '../_utils/agentSettingsTx.js';
// Mastery P2 (V2.1 STOP-B: customization bundles are per-archetype —
// "switching archetypes switches/invalidates them"): an equipped
// 'aggressive' dial re-validates against the NEW archetype's mastery level
// at switch time; below L2 it invalidates to 'standard' in the same commit
// (the standing-lean invalidation rider precedent in this same file).
// Without this, the per-archetype L2 gate degrades to earn-once-on-any-
// archetype (P2 review finding). Dark (enforcement off): untouched.
import {
  MASTERY_ENFORCEMENT_ENABLED,
  MASTERY_CUTOVER_GUARD_ENABLED,
  MASTERY_CONFIG_COLLECTION,
  MASTERY_CUTOVER_MARKER_DOC,
} from '../_utils/masteryConfig.js';
import { masteryProfileRef, archetypeLevelFromProfile, revalidateTempoDial } from '../_utils/masteryEnforcement.js';
import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { logSignalDrops } from '../_utils/shadowLogger.js';
import { isValidForgeId, FORGE_ID_REGEX, FORGE_ID_MAX_LEN } from '../_utils/idValidation.js';
// VALID_ARCHETYPES is the canonical server-side list (Object.keys of the archetype
// configs); create-profile.js validates against this same source. Imported, not
// re-declared, so the picker, seeder, endpoint, and config can't drift apart.
import { VALID_ARCHETYPES } from '../_utils/agentArchetypeConfig.js';
import { waitUntil } from '@vercel/functions';
// WS1 rescan rider — an archetype change flips the classification input for
// every already-equipped rule, so under RULE_COMPAT_MODE observe/enforce this
// endpoint emits one compat_archetype_change_rescan event summarizing the
// conflicts under the NEW archetype (no UI; observe data only). The featureFlags
// import is api → src and Node-clean (BUILD_RULES §4); its never-mocked
// dependency-surface guard is the real import in change-archetype.test.js.
// Classification runs through the SAME kernel the cleanup script uses
// (collectProjectedConflicts → projectActiveRules + the compat map) so rescan
// telemetry and the cleanup census can never disagree.
import { RULE_COMPAT_MODE, COMPILER_ENABLED } from '../../src/config/featureFlags.js';
import { collectProjectedConflicts } from '../_utils/ruleCompatCleanup.js';
// Archetype Phase 2 (P2.4a): DARK equip-time compiler — both calls return
// null before any read/write while COMPILER_ENABLED=false (byte-identical).
import { prepareCompileInputs, writeCompiledBuildsInTx } from '../_utils/compileOnSettingsChange.js';
// Release 2 lean-invalidation rider — same kernel the battle-creation
// revalidation uses (leanRevalidation.js), so the rider and the snapshot
// omission can never disagree.
import { revalidateStandingLeans } from '../_utils/leanRevalidation.js';
// Born-with seeding — the ONE seeding call archetype change converges on. Runs
// INSIDE the change transaction so archetype + equippedTraits + trait rule docs
// commit atomically (the invariant: archetype X always carries X's born-with
// traits; the bad state is unreachable, and Cancel commits nothing). Shares the
// pure planner with the client clean-replace, so the two can't drift.
import { seedArchetypeTraitsInTx, hasBornWithSet, softDeleteReplacedTraitRuleDocs } from '../_utils/archetypeSeeding.js';
import { validateWriteEpochInTx } from '../_utils/compositionWriteEpoch.js';
import { COMPOSITION_ENFORCEMENT_MODE } from '../_utils/compositionConfig.js';
import { checkCandidateEquipLegality, isBlockingViolation } from '../_utils/compositionEnforcement.js';

export const config = { maxDuration: 10 };

const SENTINEL_PREFIX = '__change_archetype:';
const SENTINEL_TO_HTTP = Object.freeze({
  composition_blocked: [409, 'composition_blocked', 'An equipped bundle carries a rule that is off-identity for the target archetype under the new compatibility ruling. Unequip it first.'],
  epoch_closed:     [409, 'epoch_closed',     'Configuration writes are briefly paused for a system identity update. Try again in a few minutes.'],
  agent_not_found: [404, 'agent_not_found', 'Agent not found.'],
  forbidden:       [403, 'forbidden',       'Not authorized for this resource.'],
  battle_active:   [409, 'battle_active',   'Cannot change archetype while the agent has an active battle.'],
  seed_failed:     [500, 'seed_failed',     'Could not load the default traits for this archetype.'],
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

  const { agentId, archetype } = req.body || {};
  if (!isValidForgeId(agentId)) {
    return res.status(400).json({
      error: 'invalid_agent_id',
      message: `agentId must match ${FORGE_ID_REGEX} and be ≤${FORGE_ID_MAX_LEN} chars`,
    });
  }
  if (typeof archetype !== 'string' || !VALID_ARCHETYPES.includes(archetype)) {
    return res.status(400).json({
      error: 'invalid_archetype',
      message: 'Unknown archetype code.',
    });
  }

  const db = getFirebaseAdmin();
  const agentRef = db.collection('agents').doc(agentId);
  const nowIso = new Date().toISOString();

  let txResult;
  try {
    txResult = await db.runTransaction(async (tx) => {
      const agentSnap = await tx.get(agentRef);
      // Composition write-epoch fence (design note §3): read-phase validation —
      // zero I/O while dark; a closed epoch 409s with nothing written (A41).
      await validateWriteEpochInTx(tx, db, { sentinel: SENTINEL_PREFIX });

      // Agent must exist, belong to the caller, and be battle-free.
      if (!agentSnap.exists) throw new Error(SENTINEL_PREFIX + 'agent_not_found');
      const agent = agentSnap.data();
      if (agent.ownerId !== user.uid) throw new Error(SENTINEL_PREFIX + 'forbidden');
      // ⚠️ LOAD-BEARING FOR ARCHETYPE INTEGRITY: this battle-lock is what
      // guarantees an agent's archetype cannot change mid-battle, which is why
      // the integrity gate does NOT clear/revalidate `battle.directive` on
      // archetype change. If you EVER allow mid-battle archetype change, you MUST
      // clear or revalidate the live `battle.directive` (it may have been minted
      // under the prior archetype) — see
      // docs/audits/20260625_ARCHETYPE_INTEGRITY_BUILD_PLAN_V2.md (CF-1).
      if (agent.activeBattleId) throw new Error(SENTINEL_PREFIX + 'battle_active');

      // Idempotent: archetype already set → 200 no-op, no write, NO re-seed.
      if (agent.archetype === archetype) {
        return { idempotent: true, archetype, previousArchetype: archetype };
      }

      // Composition offer/equip boundary (spec §2): switching INTO an
      // archetype for which an equipped bundle carries a core_conflict/
      // deferred rule is a banned pairing — enforce rejects with the stored
      // config byte-unchanged; the read joins the read phase (reads precede
      // the seed block's writes). 'off' = zero compute AND zero added I/O.
      if (COMPOSITION_ENFORCEMENT_MODE === 'enforce') {
        const equippedIds = agent.equippedBundleIds || [];
        if (equippedIds.length > 0) {
          const bundleSnaps = await tx.getAll(...equippedIds.map((id) => agentRef.collection('bundles').doc(id)));
          const compositionViolations = [];
          for (const bs of bundleSnaps) {
            if (!bs.exists) continue;
            compositionViolations.push(...checkCandidateEquipLegality({
              ruleSnapshots: bs.data().ruleSnapshots || [],
              archetype, // the TARGET archetype
            }).filter(isBlockingViolation));
          }
          if (compositionViolations.length > 0) {
            const err = new Error(SENTINEL_PREFIX + 'composition_blocked');
            err.details = { compositionViolations };
            throw err;
          }
        }
      }

      const previousArchetype = agent.archetype ?? null;

      // Mastery P2 dial re-validation (see the import note), through the
      // SHARED revalidateTempoDial rule (ruling Q7) — the same kernel the §8
      // corrections clamp pass uses, so switch-invalidation and corrections
      // can never disagree on when aggressive resets. The profile read sits
      // HERE because the seed block below performs tx.set writes and
      // Firestore requires every read to precede the first write.
      //
      // CUTOVER WINDOW (B3 delta-review closure): the dial gate is
      // PER-ARCHETYPE, so carrying an equipped aggressive onto a new
      // archetype IS an acquisition in the per-archetype sense — left open,
      // a dark switch during the flip ceremony would rebind aggressive to
      // an archetype whose gate it never passed and go stale under the
      // final census. While the guard constant is on and the marker exists,
      // this rider therefore runs the SAME revalidation enforcement will
      // run — a ≥L2 switch keeps aggressive (legit), below L2 resets, and
      // the census's per-archetype verdicts stay live. Ordinary dark (guard
      // off): zero mastery I/O, byte-identical.
      let dialInvalidated = false;
      if (agent.dials?.tempo === 'aggressive') {
        let revalidate = MASTERY_ENFORCEMENT_ENABLED;
        if (!revalidate && MASTERY_CUTOVER_GUARD_ENABLED) {
          const markerSnap = await tx.get(
            db.collection(MASTERY_CONFIG_COLLECTION).doc(MASTERY_CUTOVER_MARKER_DOC),
          );
          revalidate = markerSnap.exists;
        }
        if (revalidate) {
          const profileSnap = await tx.get(masteryProfileRef(db, user.uid));
          const newLevel = archetypeLevelFromProfile(profileSnap.exists ? profileSnap.data() : null, archetype);
          dialInvalidated = revalidateTempoDial({ tempo: 'aggressive', level: newLevel }).invalidated;
        }
      }

      // P2.4a compile reads (dark no-op): placed HERE because the seed block
      // below performs tx.set writes and Firestore requires every read to
      // precede the first write. Compat cells key on the NEW archetype.
      const compileInputs = await prepareCompileInputs(tx, {
        agentRef,
        nextEquippedBundleIds: agent.equippedBundleIds || [],
        enabled: COMPILER_ENABLED,
      });

      // ⚠️ THE INVARIANT: archetype change ALWAYS loads that archetype's
      // born-with trait set — atomically, in THIS transaction. Create the new
      // trait rule docs and write archetype + equippedTraits together (tx.set +
      // one tx.update). A partial failure commits nothing — never archetype=new
      // with the old traits (the bad state) — and a Cancel writes nothing because
      // the endpoint is simply never called. The seed reads/deletes NOTHING in
      // the tx: the outgoing trait docs stop projecting the instant equippedTraits
      // changes (projectActiveRules gates on traitId ∈ equippedTraits + dedups
      // newest-wins), so they are inert immediately; their soft-delete is the
      // best-effort post-commit hygiene below. Defensive: an archetype with no
      // born-with set (never happens — pinned non-empty by
      // traitLibrary.bornWith.test) skips the seed rather than wiping the layer.
      let seeded = null;
      if (hasBornWithSet(archetype)) {
        seeded = seedArchetypeTraitsInTx(tx, agentRef, archetype);
        // Fail-safe: a born-with archetype that resolved to ZERO traits/rules
        // (a data bug the bornWith.test pins as unreachable) must NOT commit —
        // aborting the whole tx here keeps the invariant (never archetype=new
        // with an empty/mismatched trait layer) rather than wiping the layer.
        if (!seeded.equippedTraits || seeded.equippedTraits.length === 0 || seeded.rulesAdded === 0) {
          throw new Error(SENTINEL_PREFIX + 'seed_failed');
        }
      }

      // settingsRev rides structurally (Release 2 changelog #7). archetype +
      // the seeded born-with equippedTraits layer commit together (one write).
      txUpdateAgentSettings(tx, agentRef, {
        archetype,
        updatedAt: nowIso,
        ...(seeded && seeded.equippedTraits ? { equippedTraits: seeded.equippedTraits } : {}),
        // Dial invalidation rides the same atomic commit (V2.1 STOP-B).
        ...(dialInvalidated ? { 'dials.tempo': 'standard' } : {}),
      });

      // P2.4a (dark no-op): compile rides the settingsRev increment above,
      // against the NEW archetype identity.
      const compilePreviews = writeCompiledBuildsInTx(tx, {
        agentRef,
        agentId,
        agent,
        nextState: { archetype },
        bundles: compileInputs?.bundles,
        enabled: COMPILER_ENABLED,
        nowIso,
      });

      // equippedTraits rides along for the WS1 rescan (projection input) — now
      // the NEWLY seeded set, so the rescan classifies the post-change reality.
      // standingLeans rides for the Release-2 lean-invalidation rider.
      return {
        idempotent: false,
        archetype,
        previousArchetype,
        compilePreviews,
        equippedTraits: (seeded && seeded.equippedTraits) || agent.equippedTraits || [],
        standingLeans: Array.isArray(agent.standingLeans) ? agent.standingLeans : [],
        seeded: seeded ? { traitCount: seeded.equippedTraits.length, rulesAdded: seeded.rulesAdded } : null,
        dialInvalidated,
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
    console.error('[change-archetype] error:', txErr);
    return res.status(500).json({ error: 'server_error', message: 'Could not change archetype.' });
  }

  // Best-effort post-commit hygiene: soft-delete the trait rule docs the new
  // born-with set replaced (any doc whose traitId left equippedTraits). NON-FATAL
  // — the atomic change already committed and those docs are already inert (they
  // no longer project), so a failure here only leaves dead docs for a later
  // census, never the bad state. Skipped on the idempotent no-op.
  let traitRuleDocsRemoved = null;
  if (!txResult.idempotent && txResult.seeded) {
    try {
      traitRuleDocsRemoved = await softDeleteReplacedTraitRuleDocs(agentRef, txResult.equippedTraits);
    } catch (cleanupErr) {
      console.error('[change-archetype] replaced trait-rule cleanup failed (change committed; orphans are inert):', cleanupErr?.message || cleanupErr);
    }
  }

  // Shadow log only on a real change (no log on idempotent no-op), fire-and-forget.
  if (!txResult.idempotent) {
    waitUntil(
      logSignalDrops({
        stage: 'archetype_change',
        userId: user.uid,
        agentId,
        fromArchetype: txResult.previousArchetype,
        toArchetype: txResult.archetype,
        loggedAt: nowIso,
      }).catch(() => {}),
    );
  }

  // WS1 rescan rider (RULE_COMPAT_MODE observe/enforce only — 'off' is
  // byte-identical, including the response shape). Projects the agent's
  // equipped surface exactly as deploy does, classifies each projected rule
  // under the NEW archetype, and emits ONE summary event. Awaited (never a
  // silent fire-and-forget); a rescan failure is loud but never fails the
  // committed archetype change — the response reports rescanLogged instead.
  let rescanLogged = null;
  const compatActive = RULE_COMPAT_MODE === 'observe' || RULE_COMPAT_MODE === 'enforce';

  // Release 2 lean-invalidation rider (spec Phase 1 item 7 / changelog #17):
  // an archetype change flips the menu every equipped standing lean is
  // validated against, so the change records which leans are now invalid
  // under the NEW archetype. Computed INDEPENDENTLY of RULE_COMPAT_MODE —
  // the two flags walk separately, so a compat rollback must never silence
  // lean telemetry. When the compat rescan fires, the rider ATTACHES to that
  // event (one record per change); when compat is off, it logs standalone.
  // Presence-gated either way: agents without leans add nothing. Lean DATA
  // is never mutated — leans are durable desired state (battle-creation
  // revalidation omits them from snapshots; switching back revalidates them
  // right back in).
  const leanInvalidation = (!txResult.idempotent && (txResult.standingLeans || []).length > 0)
    ? (() => {
        const { invalidated } = revalidateStandingLeans({
          standingLeans: txResult.standingLeans,
          archetypeCodeId: txResult.archetype,
        });
        return {
          equippedCount: txResult.standingLeans.length,
          invalidatedCount: invalidated.length,
          invalidated,
        };
      })()
    : null;

  if (compatActive && !txResult.idempotent) {
    try {
      const [rulesSnap, bundlesSnap] = await Promise.all([
        agentRef.collection('rules').get(),
        agentRef.collection('bundles').get(),
      ]);
      const { conflicts: kernelConflicts } = collectProjectedConflicts({
        archetype: txResult.archetype,
        equippedTraits: txResult.equippedTraits,
        ruleDocs: rulesSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        bundleDocs: bundlesSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      });
      const conflicts = kernelConflicts.map(({ item, templateId, zone1Ref }) => ({
        ruleId: templateId,
        ruleDocId: item.ruleId,
        zone1Ref,
        hardness: item.hardness || null,
      }));
      const rescanPersisted = await logSignalDrops({
        stage: 'rule_compat',
        userId: user.uid,
        agentId,
        archetype: txResult.archetype,
        mode: RULE_COMPAT_MODE,
        events: [{
          type: 'compat_archetype_change_rescan',
          ruleId: null,
          path: 'archetype_change_rescan',
          previousArchetype: txResult.previousArchetype,
          conflictCount: conflicts.length,
          hardConflictCount: conflicts.filter((c) => c.hardness === 'hard').length,
          conflicts: conflicts.slice(0, 30),
          blocked: false,
          ts: nowIso,
          ...(leanInvalidation ? { leanInvalidation } : {}),
        }],
        eventCount: 1,
        loggedAt: nowIso,
      });
      // Honest status: a swallowed GCS write resolves false (never throws), so
      // rescanLogged must reflect the boolean, not hard-code true. The committed
      // archetype change is never failed by a telemetry miss — the response
      // carries rescanLogged so a broken logger is distinguishable from a quiet
      // stream (WS1 pre-enforce MUST-FIX).
      rescanLogged = rescanPersisted === true;
      if (!rescanLogged) {
        console.error('[change-archetype] compat rescan did not persist (swallowed GCS write or GCS disabled); archetype change committed.');
      }
    } catch (rescanErr) {
      console.error('[change-archetype] compat rescan failed (archetype change committed):', rescanErr?.message || rescanErr);
      rescanLogged = false;
    }
  } else if (leanInvalidation) {
    // Compat rescan not running — the lean rider still records (standalone
    // stage; loud on failure, never fails the committed change).
    try {
      await logSignalDrops({
        stage: 'standing_lean_invalidation',
        userId: user.uid,
        agentId,
        archetype: txResult.archetype,
        previousArchetype: txResult.previousArchetype,
        ...leanInvalidation,
        loggedAt: nowIso,
      });
    } catch (leanErr) {
      console.error('[change-archetype] lean-invalidation log failed (archetype change committed):', leanErr?.message || leanErr);
    }
  }

  console.log(
    `[change-archetype] agent ${agentId} → ${txResult.archetype} (idempotent=${txResult.idempotent})`,
  );

  return res.status(200).json({
    agentId,
    archetype: txResult.archetype,
    idempotent: txResult.idempotent,
    // Additive seed summary on a real change (absent on the idempotent no-op).
    // rulesRemoved reflects the best-effort post-commit cleanup (null if it was
    // skipped or the read failed — the committed change is unaffected either way).
    ...(txResult.seeded
      ? { seeded: { ...txResult.seeded, ...(traitRuleDocsRemoved != null ? { rulesRemoved: traitRuleDocsRemoved } : {}) } }
      : {}),
    // Additive, mode-gated field — absent while RULE_COMPAT_MODE='off' so the
    // off response stays byte-identical.
    ...(compatActive ? { rescanLogged } : {}),
    // P3 notice rider (ratified, V2.2 §3.2; extended to cutover-window
    // resets): present ONLY when the dial invalidation actually fired —
    // which requires enforcement or the ceremony marker, so the ordinary
    // dark response stays byte-identical. The client surfaces this as the
    // user notice (never a silent reset).
    ...(txResult.dialInvalidated ? { dialInvalidated: true } : {}),
    // compilePreviews is ADDITIVE and appears only under COMPILER_ENABLED (P2.4a).
    ...(txResult.compilePreviews ? { compilePreviews: txResult.compilePreviews } : {}),
  });
}
