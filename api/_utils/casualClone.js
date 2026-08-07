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
import {
  acquireProvisionerLease, assertLeaseCurrent, releaseProvisionerLease,
} from './compositionProvisionerLease.js';

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
 * Ruling 3: the fields to RE-SYNC onto an existing casual clone from its parent at
 * deploy, so the clone is a CURRENT mirror of the parent brain (not a frozen
 * day-zero one). The inherited-loadout fields (archetype/config/equip/insight/
 * disciplines/evolutionCycle/…) + the parent's `memory` — and NOTHING else: never
 * the clone markers (isCasualClone/rankedAgentId/ownerId), pointers (activeBattleId/
 * deployingAt/lastDeployedAt), or history (stats). Re-sync is FROM the parent —
 * which is where the clone's own past learning was already redirected forward — so
 * it is additive-in-effect and clobbers no un-redirected clone state (the clone
 * accumulates none). Pure.
 */
export function buildCasualCloneResync(rankedAgent) {
  const out = {};
  for (const field of INHERITED_LOADOUT_FIELDS) {
    if (rankedAgent[field] !== undefined) out[field] = rankedAgent[field];
  }
  out.memory = Array.isArray(rankedAgent.memory) ? rankedAgent.memory : [];
  return out;
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
  // Composition write-epoch fence — B2 (PR 4): the clone BIRTHS + RE-SYNCS
  // identity state (loadout fields + rules/bundles subcollections via
  // copyAgentSubcollections) through a NONTRANSACTIONAL multi-write flow, so
  // the PR-2 entry guard is upgraded to a REGISTERED LEASE: acquisition
  // transactionally validates the epoch is open, every write phase re-checks
  // lease currency, and the §8 close drains leases before its watermark —
  // a provisioner that read "open" can no longer land writes after the close.
  // Zero I/O while the fence flag is dark (A23/A46 census row).
  const lease = await acquireProvisionerLease(db, { holder: `casualClone:${odUserId}`, now });
  try {
    const nowIso = now.toISOString();
    const cloneId = casualCloneDocId(odUserId);
    const cloneRef = db.collection(AGENTS_COLLECTION).doc(cloneId);

    // Existing doc: return a LEGIT clone AS-IS (never-overwrite, R1), but HEAL an
    // inauthentic one. The agents create rule (firestore.rules) lets any authed user
    // create a doc at an ARBITRARY id with their OWN ownerId, so a client can SQUAT
    // the reserved casual-agent-{uid} namespace (security review CONFIRMED-2 DoS,
    // and CONFIRMED-1 poisoned rankedAgentId). A legit clone is
    // `ownerId===caller && isCasualClone`; anything else is a squat with no
    // legitimate accumulated learning → overwrite it. (The firestore.rules namespace
    // reservation is the primary defense; this heals any squat planted before the
    // rules are deployed — rules deploy is manual in this repo.)
    const existingSnap = await cloneRef.get();
    const existing = existingSnap.exists ? existingSnap.data() : null;
    if (existing && existing.ownerId === odUserId && existing.isCasualClone === true) {
      // Ruling 3: RE-SYNC the clone to the CURRENT parent brain at deploy so
      // BaggerBomb runs today's agent (and the learning it redirects back to the
      // parent is generated by a current brain, not a day-zero one). GUARD 1: only
      // when the clone is NOT mid-battle (activeBattleId null) — a live clone's brain
      // is never re-pointed under it. GUARD 2: copy FROM the parent (where the clone's
      // own past learning already lives) → additive-in-effect, clobbers no
      // un-redirected state. Refreshes ONLY the brain fields + rules/bundles
      // subcollections; markers/pointers/stats untouched (never-overwrite for identity
      // still holds). Same-owner re-checked (defense-in-depth vs a poisoned
      // rankedAgentId on an otherwise-authentic clone).
      if (!existing.activeBattleId && typeof existing.rankedAgentId === 'string' && existing.rankedAgentId.length > 0) {
        const parentSnap = await db.collection(AGENTS_COLLECTION).doc(existing.rankedAgentId).get();
        if (parentSnap.exists && parentSnap.data().ownerId === odUserId) {
          const parent = { id: parentSnap.id, ...parentSnap.data() };
          assertLeaseCurrent(lease); // B2 (F6): the RE-SYNC copy is a write phase — currency-check BEFORE it, parity with the create path
          await copyAgentSubcollections(db, parent.id, cloneId); // refresh the Trading Brain
          assertLeaseCurrent(lease); // B2 (F6): the copy may have straddled the TTL — re-check before the doc write
          await cloneRef.update({ ...buildCasualCloneResync(parent), updatedAt: nowIso });
          console.log(`${LOG_PREFIX} re-synced casual clone ${cloneId} to parent ${parent.id} at deploy`);
        } else {
          console.warn(`${LOG_PREFIX} skipped re-sync of ${cloneId} — parent ${existing.rankedAgentId} missing or not same-owner`);
        }
      }
      return { cloneId, rankedAgentId: existing.rankedAgentId ?? null, created: false };
    }
    if (existing) {
      console.warn(`${LOG_PREFIX} healing inauthentic doc at ${cloneId} (ownerId=${existing.ownerId ?? 'none'}, isCasualClone=${existing.isCasualClone === true}) — overwriting with a fresh clone`);
    }

    const ranked = await resolveRankedAgent(db, odUserId);
    if (!ranked) throw new Error('no_ranked_agent');

    // Subcollections FIRST (idempotent set-by-id), clone doc LAST — the trainingClone
    // provisioning order, so an interrupted create re-provisions.
    assertLeaseCurrent(lease); // B2: no write phase after the TTL deadline
    await copyAgentSubcollections(db, ranked.id, cloneId);
    const cloneDoc = buildCasualCloneDoc(ranked, { odUserId, nowIso });
    assertLeaseCurrent(lease); // B2: the sentinel-doc phase re-checks too

    if (existing) {
      // Heal a squat: overwrite (create() would fail on the existing doc). Admin SDK
      // bypasses the rules; the squat carries no legit state to preserve.
      await cloneRef.set(cloneDoc);
      console.log(`${LOG_PREFIX} healed casual clone ${cloneId} from ranked agent ${ranked.id}`);
      return { cloneId, rankedAgentId: ranked.id, created: true };
    }

    try {
      // create() (not set()) so a concurrent double-tap cannot overwrite a legit
      // clone: the loser gets ALREADY_EXISTS and returns the winner AS-IS.
      await cloneRef.create(cloneDoc);
    } catch (err) {
      if (err?.code === 6 || /ALREADY_EXISTS/i.test(String(err?.message || ''))) {
        const raced = await cloneRef.get();
        const rd = raced.exists ? raced.data() : null;
        const rdAuthentic = !!rd && rd.ownerId === odUserId && rd.isCasualClone === true;
        return { cloneId, rankedAgentId: rdAuthentic ? (rd.rankedAgentId ?? ranked.id) : ranked.id, created: false };
      }
      throw err;
    }
    console.log(`${LOG_PREFIX} provisioned casual clone ${cloneId} from ranked agent ${ranked.id} (${ranked.archetype})`);
    return { cloneId, rankedAgentId: ranked.id, created: true };
  } finally {
    await releaseProvisionerLease(db, lease);
  }
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
 * battle doc carries no such field), and the target is VERIFIED to be owned by the
 * clone's owner (see the security guard below). Fail-SAFE: on a missing clone doc /
 * rankedAgentId / owner mismatch / read error it returns the clone's own agentId
 * (attribution stays on the clone, a detectable degradation) rather than throwing
 * inside a cron. A null db also degrades safely.
 */
export async function resolveAttributionAgentId(db, battle) {
  const agentId = battle?.agentId ?? null;
  if (!isCasualCloneId(agentId)) return agentId;
  if (!db) return agentId;
  try {
    const cloneSnap = await db.collection(AGENTS_COLLECTION).doc(agentId).get();
    if (!cloneSnap.exists) return agentId;
    const clone = cloneSnap.data();
    const parentId = clone.rankedAgentId;
    if (typeof parentId !== 'string' || parentId.length === 0) {
      console.warn(`${LOG_PREFIX} casual clone ${agentId} missing rankedAgentId — attribution degraded to the clone`);
      return agentId;
    }
    // SECURITY GUARD (review CONFIRMED-1): the attribution target MUST be owned by
    // the clone's owner. Same-owner is an invariant of a legit clone
    // (buildCasualCloneDoc sets rankedAgentId from resolveRankedAgent(odUserId)),
    // so this only ever rejects a squat carrying a poisoned cross-user
    // rankedAgentId — which would otherwise redirect a battle's record/learning
    // onto a VICTIM. On mismatch, attribute to the clone (never cross-user).
    const parentSnap = await db.collection(AGENTS_COLLECTION).doc(parentId).get();
    if (!parentSnap.exists || parentSnap.data().ownerId !== clone.ownerId) {
      console.warn(`${LOG_PREFIX} attribution target ${parentId} not owned by clone ${agentId}'s owner — refusing cross-user redirect`);
      return agentId;
    }
    return parentId;
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
