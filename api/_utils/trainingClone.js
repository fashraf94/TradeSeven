// api/_utils/trainingClone.js
//
// League Training Slice 3 — the training-agent CLONE identity (founder ruling:
// separate training-agent identity, fresh clone per pod). A player's training
// agent is a behavioral clone of their ranked agent — same archetype, loadout
// and Trading Brain — with its OWN agentId. This yields off-ladder coexistence
// with ZERO fenced edits: the one-active-battle check in decide.js is
// agentId-scoped, so a distinct clone agentId passes it unchanged; activeBattleId
// is per-agent-doc; every battle→agent write keys on battle.agentId (verified
// exhaustively at build time), so the clone's training evolution NEVER touches
// the ranked agent; and composite banking keys on groupId+ownerId, so a clone
// owned by the player is counted with no banking change.
//
// Mirrors tournamentCpu.js's server-side get-or-create precedent:
//   - agents/training-agent-{groupId}-{odUserId}: deterministic doc id → the
//     get-or-create is race-free and the seat→agent resolver (resolveGroupAgents,
//     training branch) computes the same id with no ambiguous owner query.
//   - ownerId stays the PLAYER's odUserId (banking needs it); isTrainingClone
//     true + rankedAgentId/groupId are the markers every ranked owner-lookup
//     excludes on.
//   - loadout is inherited from the ranked agent at provision time (decision #3:
//     "defaults to the player's current ranked loadout"); a per-user loadoutSpec
//     override (the Slice-5 chooser) may replace the archetype/watchlist. When it
//     picks an archetype that DIFFERS from the ranked agent's, the clone is
//     seeded with THAT archetype's born-with traits (archetypeSeeding.js) instead
//     of the inherited ranked traits — the same archetype↔traits invariant the
//     Command Center change enforces, so a practice clone is never archetype≠traits.
//
// Imports the zero-import schema module from src/ under the revised June 2026
// import rule (BUILD_RULES §4); the co-located test's real import of THIS module
// is the dependency-surface guard.

import {
  trainingCloneDocId,
  isCpuUserId,
} from '../../src/constants/leagueTournament.js';
// Born-with seeding — the SAME planner + source of truth the Command Center
// atomic change uses (via change-archetype.js). Converges the clone path onto it:
// a loadout override that picks a DIFFERENT archetype seeds THAT archetype's
// born-with traits, so a clone never carries archetype≠traits (the invariant).
import { seedArchetypeTraitsDeterministic, hasBornWithSet, softDeleteReplacedTraitRuleDocs } from './archetypeSeeding.js';
import {
  acquireProvisionerLease, assertLeaseCurrent, releaseProvisionerLease,
} from './compositionProvisionerLease.js';
import { pinActivationDescriptor } from './compositionGenerationFence.js';
import { selectIdentityVersion, birthProvenanceStamp } from './compositionActivationService.js';

const LOG_PREFIX = '[TrainingClone]';

const AGENTS_COLLECTION = 'agents';

// Loadout fields a clone inherits from the ranked agent (the "Trading Brain"
// that shapes decisions: archetype + config + equip + the consolidated insight).
// History/identity/pointer fields are NOT in this list — they are reset fresh
// (a per-pod clone carries no ranked history and its own pointers).
// EXPORTED so the casual-clone builder (casualClone.js) reuses the SAME inherited
// field list — one source of truth for "the behavioral clone shape", no drift
// between the training and casual clone paths (BUILD_RULES §4).
export const INHERITED_LOADOUT_FIELDS = Object.freeze([
  'archetype',
  'archetypeDrift',
  'config',
  'personality',
  'avatarColors',
  'primaryColor',
  'equippedTraits',
  'activeRules',
  'equippedBundleIds',
  'equippedWatchlistId',
  'equippedWatchlistName',
  'equippedAt',
  'deployedStrategy',
  'consolidatedInsight',
  'disciplines',
  'evolutionCycle',
  'starterKitCompleted',
  'name',
  // Sol confirmation pass BL2 — BIRTH PROVENANCE MEANS BIRTH: the birth
  // fields are NOT inherited (a new clone object stamps its OWN creation
  // descriptor). The SOURCE's birth stamp travels as LINEAGE instead —
  // loadoutSourceIdentityVersion / loadoutSourceActivationGeneration,
  // assigned by the builders below (absent on the source ⇒ absent on the
  // clone; byte-identical for the pre-stamp fleet).
]);

// BL2: lineage from the source's birth stamp — separate fields, never the
// clone's own birth provenance. Shared by the training + casual builders.
export function assignLoadoutLineage(target, sourceAgent) {
  if (sourceAgent.identityVersionAtBirth !== undefined) target.loadoutSourceIdentityVersion = sourceAgent.identityVersionAtBirth;
  if (sourceAgent.activationGenerationAtBirth !== undefined) target.loadoutSourceActivationGeneration = sourceAgent.activationGenerationAtBirth;
  return target;
}

export const FRESH_STATS = Object.freeze({
  wins: 0, losses: 0, gamesPlayed: 0, totalScore: 0, avgScore: 0, currentStreak: 0, bestStreak: 0,
});

/**
 * Resolve the player's RANKED agent (exclude any training clones). Reads all
 * the user's agent docs and returns the first non-clone — migration-free
 * disambiguation (existing ranked docs lack isTrainingClone → falsy → selected).
 * Returns { id, ...data } or null.
 */
export async function resolveRankedAgent(db, odUserId) {
  const snap = await db.collection(AGENTS_COLLECTION).where('ownerId', '==', odUserId).get();
  const doc = snap.docs.find(d => d.data().isTrainingClone !== true && d.data().isCasualClone !== true);
  return doc ? { id: doc.id, ...doc.data() } : null;
}

/**
 * The clone doc shape: the ranked agent's inherited loadout (optionally
 * overridden by a per-user loadoutSpec — Slice 5), the player's ownerId, the
 * clone markers, and fresh history/pointers. Pure.
 */
export function buildTrainingCloneDoc(rankedAgent, { groupId, odUserId, loadoutSpec = null, nowIso }) {
  const loadout = {};
  for (const field of INHERITED_LOADOUT_FIELDS) {
    if (rankedAgent[field] !== undefined) loadout[field] = rankedAgent[field];
  }
  assignLoadoutLineage(loadout, rankedAgent); // BL2: source birth stamp -> lineage fields
  // Slice-5 override hook: a partial loadout spec replaces inherited fields.
  if (loadoutSpec && typeof loadoutSpec === 'object') {
    for (const [k, v] of Object.entries(loadoutSpec)) loadout[k] = v;
  }
  return {
    ...loadout,
    ownerId: odUserId,            // the PLAYER — banking keys on this
    isTrainingClone: true,        // every ranked owner-lookup excludes on this
    rankedAgentId: rankedAgent.id,
    groupId,                      // the training pod this clone belongs to
    // Fresh history + clean pointers — a per-pod clone starts clean and never
    // carries ranked battle pointers.
    memory: [],
    stats: { ...FRESH_STATS },
    pendingConsolidation: false,
    activeBattleId: null,
    deployingAt: null,
    lastDeployedAt: null,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

/**
 * Copy the ranked agent's rules + bundles subcollections onto the clone — the
 * Trading Brain decide.js re-projects activeRules from at every deploy
 * (agentRef.collection('rules')/('bundles')), so a clone that must behave
 * identically needs them. Preserves doc ids. Idempotent set per doc.
 */
export async function copyAgentSubcollections(db, rankedAgentId, cloneId) {
  const cloneRef = db.collection(AGENTS_COLLECTION).doc(cloneId);
  for (const sub of ['rules', 'bundles']) {
    const srcSnap = await db.collection(AGENTS_COLLECTION).doc(rankedAgentId).collection(sub).get();
    for (const doc of srcSnap.docs) {
      await cloneRef.collection(sub).doc(doc.id).set(doc.data());
    }
  }
}

/**
 * Lazy get-or-create the per-pod training clones for a pod's HUMAN seats. CPU
 * seats are skipped (their system agents already exist from formation). A seat
 * whose owner has no ranked agent is reported in `skipped` (loud) — board
 * production then falls back to a synthetic identity for it, never a silent
 * mis-clone. Idempotent by deterministic doc id: an existing clone is left
 * alone. `loadoutSpecByUser` (Slice 5) maps odUserId → a partial loadout
 * override; null/absent = pure inherit-forward (Slice 3). Returns
 * { created, existing, skipped }.
 */
export async function ensureTrainingClones(db, group, { loadoutSpecByUser = null, now = new Date() } = {}) {
  const nowIso = now.toISOString();
  const created = [];
  const existing = [];
  const skipped = [];

  // Composition write-epoch fence — B2 (PR 4): clone provisioning BIRTHS
  // identity state through a NONTRANSACTIONAL multi-write flow, so the PR-2
  // per-iteration entry guard is upgraded to a REGISTERED LEASE: acquisition
  // transactionally validates the epoch is open, every seat's write phase
  // re-checks lease currency (the bounded-conformance boundary, now with a
  // hard TTL deadline), and the §8 close drains leases before its watermark.
  // Zero I/O while the fence flag is dark (A23/A46 census row).
  const lease = await acquireProvisionerLease(db, { holder: `trainingClone:${group.id}`, now });
  // Composition PR 4 (A24): clone seeding derives from the version the
  // activation record selects (dark: zero reads → live, byte-identical).
  const seedPin = await pinActivationDescriptor(db);
  const seedVersion = seedPin.dark ? null : (seedPin.descriptor ? selectIdentityVersion(seedPin.descriptor) : null);
  try {

    for (const player of group.players || []) {
      const odUserId = player.odUserId;
      if (player.isCpu === true || isCpuUserId(odUserId)) continue; // CPU seats: system agents already exist

      // B2: per-seat lease currency check — a loop stalled past the TTL stops
      // at the next seat boundary instead of writing past a possible watermark.
      assertLeaseCurrent(lease);

      const cloneId = trainingCloneDocId(group.id, odUserId);
      const cloneRef = db.collection(AGENTS_COLLECTION).doc(cloneId);
      const cloneSnap = await cloneRef.get();
      if (cloneSnap.exists) { existing.push(odUserId); continue; }

      const ranked = await resolveRankedAgent(db, odUserId);
      if (!ranked) {
        console.error(`${LOG_PREFIX} group ${group.id}: human seat ${odUserId} has no ranked agent — training clone NOT provisioned (board production will use a synthetic identity)`);
        skipped.push(odUserId);
        continue;
      }

      const loadoutSpec = loadoutSpecByUser ? loadoutSpecByUser[odUserId] : null;
      // Copy the rules/bundles subcollections FIRST, then write the clone doc LAST
      // as the completion sentinel. If provisioning is interrupted (timeout/crash)
      // between the two, the clone doc won't exist, so the next run re-provisions
      // (idempotent set-by-id) — a partial clone (doc present, subcollections
      // empty) can never be marked 'existing' and stranded with a blank Trading
      // Brain that decide.js would deploy as an inert agent.
      await copyAgentSubcollections(db, ranked.id, cloneId);

      const cloneDoc = buildTrainingCloneDoc(ranked, { groupId: group.id, odUserId, loadoutSpec, nowIso });
      // BL2: a NEW clone object stamps its OWN creation descriptor (dark pin:
      // zero keys, A23) — lineage was already assigned by the builder.
      Object.assign(cloneDoc, birthProvenanceStamp(seedPin));
      // Invariant convergence (same rule as the Command Center change): if the
      // loadout override picked an archetype that DIFFERS from the ranked agent's,
      // the clone carries the OVERRIDE archetype's born-with traits, not the
      // inherited ranked traits — no clone with archetype≠traits. Seed BEFORE the
      // sentinel doc write with deterministic rule-doc ids, so an interrupted
      // re-provision overwrites (stays idempotent); the copied ranked trait docs go
      // inert (their traitId is no longer in equippedTraits, projectActiveRules gate).
      if (cloneDoc.archetype && cloneDoc.archetype !== ranked.archetype && hasBornWithSet(cloneDoc.archetype, { identityVersion: seedVersion })) {
        const { equippedTraits } = await seedArchetypeTraitsDeterministic(cloneRef, cloneDoc.archetype, { identityVersion: seedVersion });
        if (equippedTraits) {
          cloneDoc.equippedTraits = equippedTraits;
          // Soft-delete the copied ranked trait docs the override replaced (traitId
          // ∉ the new born-with set). They are already inert via the equippedTraits
          // projection gate, but soft-delete closes the resurrection path: if that
          // traitId ever re-enters equippedTraits, projectActiveRules still filters
          // isDeleted, so a stale copied doc can never project. Before the sentinel
          // write so an interrupted re-provision re-copies then re-marks (idempotent).
          await softDeleteReplacedTraitRuleDocs(cloneRef, equippedTraits);
        }
      }
      await cloneRef.set(cloneDoc);
      created.push(odUserId);
      console.log(`${LOG_PREFIX} group ${group.id}: provisioned training clone ${cloneId} from ranked agent ${ranked.id} (${ranked.archetype})`);
    }

    return { created, existing, skipped };

  } finally {
    await releaseProvisionerLease(db, lease);
  }
}
