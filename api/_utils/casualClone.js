// api/_utils/casualClone.js
//
// Per-Battle Loadout + Per-Type Concurrency — Phase 1: the CASUAL clone identity.
// Design lock: docs/../20260805_PER_BATTLE_LOADOUT_CONCURRENCY_DESIGN_LOCK_V1.
//
// A Command-Center BaggerBomb deploy runs on a PERSISTENT per-user casual clone
// (agents/casual-agent-{odUserId}) — a behavioral clone of the player's ranked
// agent with its OWN agentId, reused across ALL casual deploys (ONE doc per user,
// ruling R1). Because the one-active-battle lock in decide.js is agentId-scoped,
// the clone delivers "one BaggerBomb at a time" for free AND coexists with a live
// ranked battle, with ZERO fenced edits (the training-clone precedent,
// trainingClone.js:6-12).
//
// UNLIKE training (which ISOLATES), a casual battle is the player's REAL game, so
// its record + learning are REDIRECTED forward to the parent ranked agent at the
// settlement/learning layer. This module owns: (a) the pure clone-doc builder,
// (b) the idempotent NEVER-OVERWRITE get-or-create, and (c) resolveAttributionAgentId
// — the ONE resolver every redirect site calls to map a battle to its attribution
// target (parent for a casual clone, the battle's own agentId otherwise).
//
// LOAD-BEARING FENCE RULE (design lock §"The load-bearing fence rule"): the
// clone's BATTLE always carries the clone's own agentId — NEVER the parent's.
// Attribution is redirected at the write layer here, never at battle identity,
// so decide.js + createAgentBattle (both fenced) are untouched.
//
// Reuses resolveRankedAgent + the inherited-loadout field list + the subcollection
// copy from trainingClone.js (ONE source of truth for the clone shape — no drift,
// BUILD_RULES §4). The co-located test's real import of THIS module is the
// dependency-surface guard; never mock it.

import { casualCloneDocId, isCasualCloneId } from '../../src/constants/leagueTournament.js';
import {
  resolveRankedAgent,
  INHERITED_LOADOUT_FIELDS,
  FRESH_STATS,
  copyAgentSubcollections,
} from './trainingClone.js';

const LOG_PREFIX = '[CasualClone]';
const AGENTS_COLLECTION = 'agents';

/**
 * The casual-clone doc shape: the ranked agent's inherited loadout (PURE inherit —
 * no loadout override in Phase 1; the per-battle loadout SELECTION surface is
 * Phase 2), the player's ownerId, the casual-clone markers, and fresh
 * history/pointers. Pure. Mirrors buildTrainingCloneDoc, with two deltas:
 * isCasualClone (not isTrainingClone) and NO groupId (the casual clone is
 * persistent per user, not pod-scoped).
 */
export function buildCasualCloneDoc(rankedAgent, { odUserId, nowIso }) {
  const loadout = {};
  for (const field of INHERITED_LOADOUT_FIELDS) {
    if (rankedAgent[field] !== undefined) loadout[field] = rankedAgent[field];
  }
  return {
    ...loadout,
    ownerId: odUserId,            // the PLAYER — mastery (owner-keyed) reaches them
    isCasualClone: true,          // ranked owner-lookups exclude on this (+ id prefix)
    rankedAgentId: rankedAgent.id, // the attribution target for every redirect
    // Fresh history + clean pointers — the clone starts clean and its
    // activeBattleId is its OWN (the per-clone one-active-battle lock).
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
 * Idempotent, NEVER-OVERWRITE get-or-create of the player's persistent casual
 * clone (ruling R1). A repeat call on an existing casual-agent-{odUserId} returns
 * it AS-IS — it MUST NOT clobber accumulated memory/lessons/insight between
 * deploys (that would silently wipe learning). Race-safe on the first creation:
 * the subcollections are copied FIRST (idempotent set-by-id), then the clone doc
 * is written with create() as the completion sentinel; a concurrent double-tap
 * loser catches ALREADY_EXISTS and returns the winner's clone untouched.
 *
 * Server-only (Admin SDK): the agents create rule (firestore.rules:171-220)
 * forbids a client from minting a LOADED agent, which is exactly why this runs
 * behind the authed ensure-casual-clone endpoint, not in the client deploy path.
 *
 * @returns {Promise<{ cloneId: string, rankedAgentId: string|null, created: boolean }>}
 * @throws {Error} 'no_ranked_agent' when the caller has no ranked agent to clone.
 */
export async function ensureCasualClone(db, { odUserId, now = new Date() }) {
  if (typeof odUserId !== 'string' || odUserId.length === 0) {
    throw new Error('ensureCasualClone: odUserId required');
  }
  const nowIso = now.toISOString();
  const cloneId = casualCloneDocId(odUserId);
  const cloneRef = db.collection(AGENTS_COLLECTION).doc(cloneId);

  // NEVER OVERWRITE: an existing clone is returned untouched so its accumulated
  // memory/lessons/insight survive across deploys.
  const existingSnap = await cloneRef.get();
  if (existingSnap.exists) {
    return { cloneId, rankedAgentId: existingSnap.data().rankedAgentId ?? null, created: false };
  }

  const ranked = await resolveRankedAgent(db, odUserId);
  if (!ranked) throw new Error('no_ranked_agent');

  // Subcollections FIRST (idempotent set-by-id), clone doc LAST as the sentinel —
  // the trainingClone provisioning order, so an interrupted create re-provisions.
  await copyAgentSubcollections(db, ranked.id, cloneId);
  const cloneDoc = buildCasualCloneDoc(ranked, { odUserId, nowIso });
  try {
    // create() (not set()) so a concurrent double-tap cannot overwrite: the loser
    // gets ALREADY_EXISTS and returns the winner's clone as-is.
    await cloneRef.create(cloneDoc);
  } catch (err) {
    if (err?.code === 6 || /ALREADY_EXISTS/i.test(String(err?.message || ''))) {
      const raced = await cloneRef.get();
      return {
        cloneId,
        rankedAgentId: raced.exists ? (raced.data().rankedAgentId ?? ranked.id) : ranked.id,
        created: false,
      };
    }
    throw err;
  }
  console.log(`${LOG_PREFIX} provisioned casual clone ${cloneId} from ranked agent ${ranked.id} (${ranked.archetype})`);
  return { cloneId, rankedAgentId: ranked.id, created: true };
}

/**
 * Resolve the ATTRIBUTION target agentId for a battle's record/learning writes —
 * the ONE resolver every redirect site calls.
 *
 *   - CASUAL clone battle  → the clone's parent (rankedAgentId), so BaggerBomb
 *                            keeps feeding the player's real ranked agent.
 *   - anything else        → the battle's own agentId, UNCHANGED (ranked,
 *                            training, real-agent casual) — so flag-off and every
 *                            non-casual path is byte-identical.
 *
 * The parent id is read from the clone AGENT doc's rankedAgentId (the fenced
 * battle doc carries no such field). `preresolvedRankedAgentId` lets a caller that
 * already holds it (e.g. the settlement transaction, which reads the clone doc
 * anyway) skip the extra read. Fail-SAFE: on a missing clone doc / rankedAgentId /
 * read error it returns the clone's own agentId (attribution stays on the clone,
 * a detectable degradation) rather than throwing inside a cron. Prefer callers to
 * pass a real `db`; a null db with no preresolved id also degrades safely.
 */
export async function resolveAttributionAgentId(db, battle, { preresolvedRankedAgentId } = {}) {
  const agentId = battle?.agentId ?? null;
  if (!isCasualCloneId(agentId)) return agentId;
  if (typeof preresolvedRankedAgentId === 'string' && preresolvedRankedAgentId.length > 0) {
    return preresolvedRankedAgentId;
  }
  if (!db) return agentId;
  try {
    const snap = await db.collection(AGENTS_COLLECTION).doc(agentId).get();
    const parent = snap.exists ? snap.data().rankedAgentId : null;
    if (typeof parent === 'string' && parent.length > 0) return parent;
    console.warn(`${LOG_PREFIX} casual clone ${agentId} missing rankedAgentId — attribution degraded to the clone`);
    return agentId;
  } catch (err) {
    console.warn(`${LOG_PREFIX} attribution resolve failed for ${agentId} (degraded to the clone):`, err?.message || err);
    return agentId;
  }
}

/**
 * PURE attribution-target resolver for callers that ALREADY hold the clone agent
 * doc (the settlement transaction reads it in-tx; the reflection cron reads it up
 * front) — so no async read is needed. Given the battle's agentId and the clone
 * doc's data, returns the agentId whose record/learning the battle belongs to:
 * the parent (rankedAgentId) for a casual clone, else the agentId UNCHANGED.
 *
 * The two async (resolveAttributionAgentId) and pure (resolveRecordTargetId)
 * resolvers share ONE rule — casual-clone → parent, everything else → self — so
 * all five redirect sites attribute identically and flag-off / non-casual stays
 * byte-identical.
 */
export function resolveRecordTargetId(agentId, cloneDocData) {
  if (isCasualCloneId(agentId)) {
    const parent = cloneDocData?.rankedAgentId;
    if (typeof parent === 'string' && parent.length > 0) return parent;
  }
  return agentId;
}
