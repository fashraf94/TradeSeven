// api/_utils/tournamentGroupService.js
//
// League Tournament — server-side (Admin SDK) service for the
// `tournamentGroups` collection. P1a scope: creation, reads, and status
// transitions over the ratified GROUP_STATUS enum. The deployed Firestore
// rules make this collection client-read-only (firestore.rules
// tournamentGroups block: write false), so every mutation in the tournament
// build flows through this module or a sibling using it.
//
// Imports the zero-import schema module from src/ under the revised June 2026
// import rule (BUILD_RULES §4): transitive surface is Node-clean by
// construction. The co-located test's real import of THIS module is the
// consumer-side dependency-surface guard.

import {
  TOURNAMENT_GROUPS_COLLECTION,
  GROUP_STATUS,
  GROUP_SIZE,
  createTournamentGroupDoc,
} from '../../src/constants/leagueTournament.js';

// Forward-only lifecycle (GROUP_STATUS ratified unchanged at P1, founder
// June 11, 2026). forming→battle is the P1 single-shot resolution path;
// forming→drafting→battle is reserved for the P3 orchestrator's multi-step
// Monday sequence. No transition ever moves backward.
export const LEGAL_TRANSITIONS = Object.freeze({
  [GROUP_STATUS.FORMING]: Object.freeze([GROUP_STATUS.DRAFTING, GROUP_STATUS.BATTLE]),
  [GROUP_STATUS.DRAFTING]: Object.freeze([GROUP_STATUS.BATTLE]),
  [GROUP_STATUS.BATTLE]: Object.freeze([GROUP_STATUS.COMPLETE]),
  [GROUP_STATUS.COMPLETE]: Object.freeze([]),
});

export function assertTransition(from, to) {
  const allowed = LEGAL_TRANSITIONS[from];
  if (!allowed) {
    throw new Error(`tournamentGroupService: unknown status "${from}"`);
  }
  if (!allowed.includes(to)) {
    throw new Error(`tournamentGroupService: illegal transition "${from}" -> "${to}"`);
  }
}

/**
 * Create a tournamentGroups document via the canonical P0 factory.
 * `args` is passed through to createTournamentGroupDoc (which validates
 * shape and throws on violations). Returns { id, doc }.
 */
export async function createGroup(db, args) {
  const groupDoc = createTournamentGroupDoc(args);
  const ref = db.collection(TOURNAMENT_GROUPS_COLLECTION).doc();
  await ref.set(groupDoc);
  return { id: ref.id, doc: groupDoc };
}

/** Read one group. Returns { id, ...data } or null. */
export async function getGroup(db, groupId) {
  const snap = await db.collection(TOURNAMENT_GROUPS_COLLECTION).doc(groupId).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() };
}

/**
 * Transition a group's status under the legality table, transactionally
 * (read-check-write, so two racing callers can't both move the same group).
 * `now` is caller-supplied, consistent with the factory's opaque-timestamp
 * rule. Returns the new status.
 */
export async function transitionStatus(db, groupId, to, now) {
  if (now == null) {
    throw new Error('tournamentGroupService.transitionStatus: now is required');
  }
  const ref = db.collection(TOURNAMENT_GROUPS_COLLECTION).doc(groupId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      throw new Error(`tournamentGroupService: group ${groupId} not found`);
    }
    assertTransition(snap.data().status, to);
    tx.update(ref, { status: to, updatedAt: now });
  });
  return to;
}

/** Membership helper: the player entry for odUserId, or null. */
export function getPlayer(group, odUserId) {
  return (group?.players ?? []).find(p => p.odUserId === odUserId) ?? null;
}

/**
 * Battle-shaped eligibility query — the house mirror (claims cron :564 /
 * banking :224) given one home for the P3b duty surfaces: status equality +
 * full seat count. Returns [{id, ...data}].
 *
 * P4 companion (a) — dev-group exclusion (founder ruling D9): every caller
 * of this function is an orchestrator dispatcher duty, so the default
 * EXCLUDES `isDev: true` groups — merging the P4 gate flip can never put the
 * production orchestrator to work on the founder's smoke-test groups. The
 * dev duty surface (run-duty) opts in with `includeDev: true`. The nightly
 * banking/claims mirrors keep their own queries and remain dev-inclusive by
 * design (the smoke's composite day needs them; cleanup retires the data).
 */
export async function fetchEligibleGroupsByStatus(db, status, { includeDev = false } = {}) {
  const snap = await db.collection(TOURNAMENT_GROUPS_COLLECTION)
    .where('status', '==', status)
    .get();
  const groups = [];
  snap.forEach(doc => {
    const data = doc.data();
    if (data.players?.length !== GROUP_SIZE) return;
    if (!includeDev && data.isDev === true) return;
    groups.push({ id: doc.id, ...data });
  });
  return groups;
}

/**
 * Ranked universe → fresh user pool (Spec §0.11: full catalog, the same
 * universe agents see), ranked order preserved, deduped/uppercased. The one
 * home for pool sourcing (P3b) — the P1a dev seeder, the bracket seeder, and
 * round composition all draw from here rather than carrying copies.
 */
export async function fetchRankedUserPool(db) {
  const snap = await db.collection('indexIntelligence').doc('stockRankings').get();
  const stocks = snap.exists ? snap.data().stocks : null;
  const pool = [];
  const seen = new Set();
  for (const stock of Array.isArray(stocks) ? stocks : []) {
    const symbol = typeof stock?.symbol === 'string' ? stock.symbol.trim().toUpperCase() : '';
    if (symbol && !seen.has(symbol)) {
      seen.add(symbol);
      pool.push(symbol);
    }
  }
  return pool;
}
