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
  selectMyTrainingPod,
} from '../../src/constants/leagueTournament.js';

// Forward-only lifecycle (GROUP_STATUS ratified unchanged at P1, founder
// June 11, 2026). forming→battle is the P1 single-shot resolution path;
// forming→drafting→battle is reserved for the P3 orchestrator's multi-step
// Monday sequence. No transition ever moves backward.
//
// League Next-Arc Slice 1 (additive — existing edges unchanged): forming→
// awaiting_open→battle is the training on-demand path (draft resolves at tap,
// the pod waits in awaiting_open until the next market open, then the
// orchestrator morning sweep flips it to battle). awaiting_open is a
// training-only state, so the new edges never affect ranked groups.
//
// League Training Slice 2 (additive — existing edges unchanged): drafting→
// awaiting_open is the interactive-draft handoff. The pod sits in DRAFTING for
// the live pick-by-pick draft (FORMING→DRAFTING is already legal above), then
// the transition-only completion stamps the start anchor and lands awaiting_open
// (or flips straight to battle inline when the anchor date is already today —
// awaiting_open→battle below). DRAFTING is reached ONLY by the training path, so
// the new edge never affects ranked groups.
// Training-Pod P0 (R2, July 2026): EXPIRED is a SECOND terminal, reachable ONLY
// from the three pre-BATTLE states (FORMING / DRAFTING / AWAITING_OPEN). It is
// the disposition for a stale/abandoned training pod that never reached BATTLE
// (D1 ruling: expire, never retro-advance). BATTLE has NO edge to EXPIRED — a
// live pod completes normally — so a pod that advanced to BATTLE between a
// sweep's read and its expire write is protected BY CONSTRUCTION (assertTransition
// throws 'illegal transition', which expireGroup treats as an idempotent skip).
// The new edges never affect ranked groups: ranked never enters DRAFTING/
// AWAITING_OPEN, and a ranked FORMING pod is resolved single-shot to BATTLE, not
// expired (only the training cleanup/backstop call expireGroup).
export const LEGAL_TRANSITIONS = Object.freeze({
  [GROUP_STATUS.FORMING]: Object.freeze([GROUP_STATUS.DRAFTING, GROUP_STATUS.BATTLE, GROUP_STATUS.AWAITING_OPEN, GROUP_STATUS.EXPIRED]),
  [GROUP_STATUS.DRAFTING]: Object.freeze([GROUP_STATUS.BATTLE, GROUP_STATUS.AWAITING_OPEN, GROUP_STATUS.EXPIRED]),
  [GROUP_STATUS.AWAITING_OPEN]: Object.freeze([GROUP_STATUS.BATTLE, GROUP_STATUS.EXPIRED]),
  // L-A: BATTLE may also VOID (poisoned-cohort disposition) — the only legal
  // BATTLE exit besides COMPLETE. VOIDED is terminal, forward-only.
  [GROUP_STATUS.BATTLE]: Object.freeze([GROUP_STATUS.COMPLETE, GROUP_STATUS.VOIDED]),
  [GROUP_STATUS.COMPLETE]: Object.freeze([]),
  [GROUP_STATUS.EXPIRED]: Object.freeze([]),
  [GROUP_STATUS.VOIDED]: Object.freeze([]),
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
 * The caller's ACTIVE training pod, or null (League Next-Arc Slice 5b-i — the
 * server `already_active` formation guard). Member-scoped single
 * `array-contains` query (no composite index — the same query as the client
 * subscribeMyTrainingPod), selected by the SHARED pure `selectMyTrainingPod`
 * predicate so the guard and the client re-entry surface can never drift on
 * what counts as "an active pod" (isTraining + DRAFTING/AWAITING_OPEN/BATTLE).
 * Returns { id, ...pod } or null.
 */
export async function findActiveTrainingPodForUser(db, odUserId) {
  const snap = await db.collection(TOURNAMENT_GROUPS_COLLECTION)
    .where('groupMembers', 'array-contains', odUserId)
    .get();
  const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return selectMyTrainingPod(docs);
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

/**
 * Expire a stale/abandoned PRE-BATTLE training pod to the terminal EXPIRED
 * status (Training-Pod P0 R2 — the unified terminal-disposition mechanism).
 * Transactional read-check-write with a state (and optional version)
 * precondition, so the expire-vs-advance race is closed BY CONSTRUCTION, not by
 * timing:
 *   - `assertTransition(status, EXPIRED)` is legal ONLY from FORMING / DRAFTING /
 *     AWAITING_OPEN — a pod that advanced to BATTLE (or is already terminal)
 *     throws `illegal transition`, reported here as an idempotent skip. Re-
 *     expiring an already-EXPIRED pod is therefore a no-op, so the one-time
 *     cleanup and the rolling backstop are safe under crash-retry.
 *   - `expectedStatus` / `expectedUpdatedAt`, when the caller supplies them, pin
 *     the exact doc the caller classified as stale: if the in-transaction read no
 *     longer matches (the pod progressed since the caller read it), we skip
 *     rather than expire a pod that is no longer the one we judged.
 * Writes the marker fields `{ expiredAt, expiredReason, expiredBy }` atomically
 * with the status flip. `now` is caller-supplied (opaque-timestamp rule).
 * NEVER hard-deletes — the audit trail survives (founder ruling: the
 * releaseSlotSeat delete precedent is not adopted for pods). Returns
 * `{ groupId, expired, status, reason? }`.
 */
export async function expireGroup(db, groupId, { reason = null, by = null, now, expectedStatus = null, expectedUpdatedAt = null, expectedProgressVersion = null } = {}) {
  if (now == null) {
    throw new Error('tournamentGroupService.expireGroup: now is required');
  }
  const ref = db.collection(TOURNAMENT_GROUPS_COLLECTION).doc(groupId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      return { groupId, expired: false, status: null, reason: 'not_found' };
    }
    const data = snap.data();
    // Version precondition — only expire the exact doc the caller judged stale.
    if (expectedStatus != null && data.status !== expectedStatus) {
      return { groupId, expired: false, status: data.status, reason: 'status_changed' };
    }
    if (expectedUpdatedAt != null && data.updatedAt !== expectedUpdatedAt) {
      return { groupId, expired: false, status: data.status, reason: 'version_changed' };
    }
    // B2: the parent progressVersion moves on EVERY draft mutation (a mid-draft
    // pick writes only the draft/state sibling, so updatedAt alone cannot see it).
    // Pinning it here means any draft activity between the caller's classification
    // and this transaction fails the precondition — an ACTIVE draft never expires.
    if (expectedProgressVersion != null && (data.progressVersion || 0) !== expectedProgressVersion) {
      return { groupId, expired: false, status: data.status, reason: 'progress_changed' };
    }
    try {
      assertTransition(data.status, GROUP_STATUS.EXPIRED);
    } catch (err) {
      // Not expirable (BATTLE / COMPLETE / already-EXPIRED) — idempotent skip,
      // never an error, so cleanup + the rolling sweep stay crash-retry safe.
      if (typeof err?.message === 'string' && err.message.includes('illegal transition')) {
        return { groupId, expired: false, status: data.status, reason: `not_expirable_from_${data.status}` };
      }
      throw err;
    }
    tx.update(ref, {
      status: GROUP_STATUS.EXPIRED,
      expiredAt: now,
      expiredReason: reason,
      expiredBy: by,
      updatedAt: now,
    });
    return { groupId, expired: true, status: GROUP_STATUS.EXPIRED };
  });
}

/**
 * VOID a live BATTLE group to the terminal VOIDED status — the League Lifecycle
 * Remediation (L-A) disposition for a poisoned/zombie cohort that must NOT
 * finalize. (A frozen advancement + banking's missing day-clamp let the group
 * bank past day 5; sealing it via the default latest-snapshot read would lock a
 * CONTAMINATED standing.) Unlike expireGroup (which retires PRE-BATTLE pods),
 * this is the only legal exit for a BATTLE group other than COMPLETE, and it is
 * NON-destructive: the per-day dailyScores (incl. the true Day-5 snapshot) are
 * left untouched — only the status flips + markers are written.
 *
 * The optimistic-lock preconditions are MANDATORY (founder ruling): the caller
 * MUST pin the exact { expectedStatus, expectedUpdatedAt } it read in the
 * pre-check, so a group that MOVED between approval and execution SKIPS rather
 * than suffering a stale-state mutation. Transactional read-check-write; NEVER
 * hard-deletes (the audit trail + intact Day-5 record survive). Writes markers
 * { voidedAt, voidedReason, voidedBy } atomically with the status flip. `now` is
 * caller-supplied (opaque-timestamp rule). Returns
 * { groupId, voided, status, reason? }.
 */
export async function voidGroup(db, groupId, { reason = null, by = null, now, expectedStatus, expectedUpdatedAt } = {}) {
  if (now == null) {
    throw new Error('tournamentGroupService.voidGroup: now is required');
  }
  // MANDATORY optimistic-lock pins (L-A, founder ruling): never void without the
  // EXACT doc the caller approved in the pre-check — a moved doc must skip, not
  // mutate. Absence is a programming error, not a runtime skip.
  if (expectedStatus == null || expectedUpdatedAt == null) {
    throw new Error('tournamentGroupService.voidGroup: expectedStatus and expectedUpdatedAt are REQUIRED (pin the pre-check read)');
  }
  const ref = db.collection(TOURNAMENT_GROUPS_COLLECTION).doc(groupId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      return { groupId, voided: false, status: null, reason: 'not_found' };
    }
    const data = snap.data();
    // L-A scope guard: VOIDED is the RANKED-cohort disposition — never void a
    // training pod (it runs its own EXPIRED/COMPLETE lifecycle). Refuse defensively
    // even if a training id is passed by mistake (skip, no write).
    if (data.isTraining === true) {
      return { groupId, voided: false, status: data.status, reason: 'training_not_voidable' };
    }
    // Precondition — only void the exact doc the caller judged poisoned.
    if (data.status !== expectedStatus) {
      return { groupId, voided: false, status: data.status, reason: 'status_changed' };
    }
    if (data.updatedAt !== expectedUpdatedAt) {
      return { groupId, voided: false, status: data.status, reason: 'version_changed' };
    }
    try {
      assertTransition(data.status, GROUP_STATUS.VOIDED);
    } catch (err) {
      // Not voidable (only BATTLE -> VOIDED is legal) — idempotent skip, never an
      // error, so a crash-retry (or an already-VOIDED re-run) is safe.
      if (typeof err?.message === 'string' && err.message.includes('illegal transition')) {
        return { groupId, voided: false, status: data.status, reason: `not_voidable_from_${data.status}` };
      }
      throw err;
    }
    tx.update(ref, {
      status: GROUP_STATUS.VOIDED,
      voidedAt: now,
      voidedReason: reason,
      voidedBy: by,
      updatedAt: now,
    });
    return { groupId, voided: true, status: GROUP_STATUS.VOIDED };
  });
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
 *
 * League Next-Arc — training exclusion: `excludeTraining: true` additionally
 * drops `isTraining: true` pods. Default is `false` (opt-in). Opted in by:
 *   - the seasonal leaderboard aggregation (tournamentLeaderboard.js): a training
 *     pod banks its own closes but never feeds the board; and
 *   - (Slice 3) the orchestrator's deploy/fan-out duties (runMondayPipeline +
 *     runWeekdayFanout): a training pod's AGENT layer is owned solely by
 *     activateTrainingPod (the flip paths + the morning backstop), NOT the ranked
 *     engine — otherwise resolveGroupAgents would mis-resolve a training human
 *     seat to the ranked agent and deploy it into the training groupId. This
 *     supersedes the Slice-3.0 "ticked by the existing engine" intent (founder
 *     Flag 1, Jun 17 2026). Banking/completion (bankAllTournamentGroups,
 *     completeBankedTrainingPods) and Friday advancement run their OWN queries and
 *     keep training (a training pod still banks + completes), so they are
 *     unaffected by this opt-in.
 */
export async function fetchEligibleGroupsByStatus(db, status, { includeDev = false, excludeTraining = false } = {}) {
  const snap = await db.collection(TOURNAMENT_GROUPS_COLLECTION)
    .where('status', '==', status)
    .get();
  const groups = [];
  snap.forEach(doc => {
    const data = doc.data();
    if (data.players?.length !== GROUP_SIZE) return;
    if (!includeDev && data.isDev === true) return;
    if (excludeTraining && data.isTraining === true) return;
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
