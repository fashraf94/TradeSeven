// api/tournament/backing-pools.js
//
// GET /api/tournament/backing-pools — Backing Beta PR 2, THE POD LIST (spec
// V1.3 §5 "Upcoming pods", §3 sealed pools, §4 window, §6 the zero-new-index
// ruling, §12 PR 2).
//
// THE ORDER, the same rungs the stake route climbs:
//   1  security middleware + rate limit
//   2  method — GET only
//   3  auth
//   4  THE FLAG — 404 while BACKING_BETA_ENABLED is dark, AFTER auth
//   5  the week, the query, the in-memory filters, the lazy jobs, the projection
//
// KEYED TO THE NEXT BATTLE MONDAY'S WEEK (§5):
// `deriveBaseLayerWeek(deriveBattleStartWeek(now))` — THE WRITERS' OWN EXPORTED
// PAIR (liveDraftFormation.js), never a re-implementation, so the list and the
// pods it lists agree on what week it is by construction (§12's fence note, and
// the same discipline backingWeek.js applies to the close). On a Monday before
// 09:30 ET this deliberately names the week whose pools closed last night, which
// the list shows as CLOSED — §5's own parenthetical, and the reason this uses
// `deriveBattleStartWeek(now)` rather than the wallet's `currentBackingWeek`.
//
// ZERO NEW INDEXES (§6, addendum Q5). The pod query REUSES the committed
// `tournamentGroups (baseLayerWeek ASC, updatedAt DESC)` composite — the same
// shape the client's `subscribeBaseLayerGroups` uses — with the Admin SDK, and
// every other criterion is an IN-MEMORY filter, the `fetchEligibleGroupsByStatus`
// house pattern. The viewer's own stakes come from the committed
// `backingStakes (userId ASC, weekKey ASC)` composite in ONE query for the whole
// request, not one per pod.
//
// WHAT THE FILTERS DROP, and why each is not a query clause: `isDev !== true`
// (D-DEVFIELD — dev pods never surface to a production viewer), `isTraining
// !== true` (training pods complete with zero ladder effects), a `voided` or
// `expired` group (terminal dispositions with no result to back), and the
// Mon 08:45 slot (D-x — no honest window). Adding any of them to the query would
// need a new composite, which §6 rules out.
//
// SEALED WHILE OPEN, AND THE TEST SAYS SO (§3). An OPEN pool's projection carries
// the pot total, the unique backer count, progress toward validity, the close,
// and the VIEWER'S OWN stakes — and nothing else. Per-team stake totals and
// pays × are not merely omitted from the render: they are absent from the
// response, asserted by a row in the co-located suite rather than left to
// review. A CLOSED / INSUFFICIENT / RESOLVED pool reveals its per-team shares,
// because §3 says the reveal happens at close.
//
// THE TWO LAZY JOBS RIDE HERE (§4, §7). An eligible pod with no pool gets one
// materialized; a pool past its `closesAt` gets closed. Both are idempotent and
// both are the same functions the stake route and PR 3's settlement call, so
// "who opens a pool" and "who closes one" each have one answer.
//
// READ-ONLY FOR THE VIEWER: this route writes nothing on its own account. The
// pool documents it may create or close are the lazy jobs above, which belong to
// the pool's own lifecycle and not to this request's viewer.

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { deriveBaseLayerWeek, deriveBattleStartWeek } from '../_utils/liveDraftFormation.js';
import {
  BACKING_STAKES_COLLECTION,
  POOL_STATUS,
  ensureClosed,
  listablePod,
  liveTeamsFor,
  materializePool,
  poolRefFor,
} from '../_utils/backingPools.js';
import { backingWeekFor } from '../_utils/backingWeek.js';
import {
  VALIDITY_MIN_BACKERS,
  VALIDITY_MIN_TEAMS,
} from '../../src/constants/backing.js';
import { TOURNAMENT_GROUPS_COLLECTION } from '../../src/constants/leagueTournament.js';
import { BACKING_BETA_ENABLED } from '../../src/config/featureFlags.js';

export const config = { maxDuration: 15 };

/**
 * How many pods of the week the list considers. The client field is capped at
 * 12 (`subscribeBaseLayerGroups`); this over-fetches so the in-memory filters
 * (dev, training, terminal, excluded slot) cannot starve the list — the same
 * over-fetch reasoning the client selector carries.
 */
export const POD_LIST_MAX = 40;

/** Pool statuses whose per-team shares are revealed (§3 — the reveal is at close). */
export const REVEALED_STATUSES = new Set([
  POOL_STATUS.CLOSED,
  POOL_STATUS.INSUFFICIENT,
  POOL_STATUS.RESOLVING,
  POOL_STATUS.RESOLVED,
  POOL_STATUS.REFUNDED,
]);

// The listability predicate now lives in api/_utils/backingPools.js, so the
// stake transaction gates on the SAME function this list filters with (§9).
// Re-exported here because it is this route's filter and its suite names it.
export { listablePod };

/** The week label the list is keyed to (§5). Exported for the suite. */
export function podListWeek(now = new Date()) {
  return deriveBaseLayerWeek(deriveBattleStartWeek(new Date(now).toISOString()));
}

/**
 * ONE pod's entry in the response.
 *
 * THE SEALED / REVEALED SPLIT LIVES HERE AND NOWHERE ELSE, so there is exactly
 * one decision about what an open pool may show (§9 — bind the label and its
 * numbers to one source). While `status === 'open'`, `teams[]` carries identity
 * and backability only; at close the same array gains `stakeTotal` and
 * `backerCount` from the pool's own frozen `teams[]`, which the close
 * transaction wrote.
 *
 * `paysX` is never computed here: PR 3 writes it at settlement and this reads
 * whatever the doc holds, which for an open pool is nothing.
 */
export function projectPod(group, pool, { viewerUid, myStakes = [] }) {
  const open = pool != null && pool.status === POOL_STATUS.OPEN;
  const revealed = pool != null && REVEALED_STATUSES.has(pool.status);
  // While OPEN the seats are derived live from `players[]` (§1); at close the
  // pool's frozen `teams[]` is the record, and a seat that left is gone from it.
  const frozen = Array.isArray(pool?.teams) ? pool.teams : null;
  const live = liveTeamsFor(group);
  const seats = revealed && frozen ? frozen : live;
  // §5: the viewer's own pod shows but is not backable — and §8's own-pod rule
  // is ACCOUNT-level, so NO seat in a pod the viewer sits in is backable, not
  // merely their own. Read off the LIVE seats even for a revealed pool: whether
  // the viewer is seated is a fact about the pod now, not about the freeze.
  const viewerSeated = live.some((s) => s.odUserId === viewerUid);

  const teams = seats.map((seat) => {
    const base = {
      odUserId: seat.odUserId,
      isCpu: seat.isCpu === true,
      isOwnSeat: seat.odUserId === viewerUid,
      backable: open === true && !viewerSeated,
    };
    if (!revealed) return base;
    return {
      ...base,
      stakeTotal: Number.isFinite(seat.stakeTotal) ? seat.stakeTotal : 0,
      backerCount: Number.isFinite(seat.backerCount) ? seat.backerCount : 0,
      ...(seat.paysX === undefined ? {} : { paysX: seat.paysX }),
    };
  });

  return {
    groupId: group.id,
    groupStatus: group.status ?? null,
    formationPath: pool?.formationPath ?? (group.isLiveDraft === true ? 'slot' : 'lobby'),
    slotId: typeof group.slotId === 'string' ? group.slotId : null,
    scheduledDraftAt: typeof group.scheduledDraftAt === 'string' ? group.scheduledDraftAt : null,
    baseLayerWeek: typeof group.baseLayerWeek === 'string' ? group.baseLayerWeek : null,
    seatNames: group.seatNames && typeof group.seatNames === 'object' ? group.seatNames : {},
    humanTeams: seats.filter((s) => s.isCpu !== true).length,
    teams,
    pool: pool == null ? null : {
      status: pool.status,
      potTotal: Number.isFinite(pool.potTotal) ? pool.potTotal : 0,
      uniqueBackers: Number.isFinite(pool.uniqueBackers) ? pool.uniqueBackers : 0,
      // PROGRESS TOWARD VALIDITY, never a pre-close verdict (§3): the list shows
      // "backers n of 3 · teams n of 2" and nothing that reads as an outcome.
      validity: {
        backers: Number.isFinite(pool.uniqueBackers) ? pool.uniqueBackers : 0,
        minBackers: VALIDITY_MIN_BACKERS,
        teams: Number.isFinite(pool.teamsBacked) ? pool.teamsBacked : 0,
        minTeams: VALIDITY_MIN_TEAMS,
      },
      closesAt: pool.closesAt ?? null,
      closeReason: pool.closeReason ?? null,
    },
    myStakes: myStakes.map((s) => ({
      stakeId: s.id,
      teamOdUserId: s.teamOdUserId,
      amount: s.amount,
      status: s.status,
      ...(s.voidReason === undefined ? {} : { voidReason: s.voidReason }),
      ...(s.payout === undefined ? {} : { payout: s.payout }),
    })),
  };
}

export default async function handler(req, res) {
  // 1. Security middleware + rate limit.
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 60, windowMs: 60000 } })) return;

  // 2. Method.
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed. Use GET.' });

  // 3. Auth.
  const user = await requireAuth(req, res);
  if (!user) return;

  // 4. THE FLAG, read at call time, after auth.
  if (!BACKING_BETA_ENABLED) return res.status(404).json({ error: 'Not found' });

  const db = getFirebaseAdmin();
  const now = new Date();

  try {
    // 5a. The week, and the ONE reused composite.
    const baseLayerWeek = podListWeek(now);
    const snap = await db.collection(TOURNAMENT_GROUPS_COLLECTION)
      .where('baseLayerWeek', '==', baseLayerWeek)
      .orderBy('updatedAt', 'desc')
      .limit(POD_LIST_MAX)
      .get();

    const candidates = [];
    snap.forEach((doc) => {
      const group = { id: doc.id, ...doc.data() };
      if (listablePod(group)) candidates.push(group);
    });

    // 5b. The viewer's own stakes for this week — ONE query, the committed
    // (userId, weekKey) composite. The pool's backing-week key IS this label:
    // both are `deriveBaseLayerWeek` of the same battle Monday (backingWeek.js).
    const stakesSnap = await db.collection(BACKING_STAKES_COLLECTION)
      .where('userId', '==', user.uid)
      .where('weekKey', '==', baseLayerWeek)
      .get();
    const stakesByGroup = new Map();
    stakesSnap.forEach((doc) => {
      const stake = { id: doc.id, ...doc.data() };
      const list = stakesByGroup.get(stake.groupId) ?? [];
      list.push(stake);
      stakesByGroup.set(stake.groupId, list);
    });

    // 5c. The lazy jobs, then the projection. Bounded by POD_LIST_MAX.
    const pods = await Promise.all(candidates.map(async (group) => {
      let pool = null;
      try {
        // A PLAIN READ FIRST, and a transaction only when there is nothing to
        // read. `materializePool` is transactional by necessity — two first
        // readers race to create one pool — but the steady state is "the pool
        // already exists", and paying for a transaction to discover that put
        // one transaction per listed pod on EVERY request, for ever. The
        // transaction is still what creates the pool, so the race is unchanged.
        const existing = await poolRefFor(db, group).get();
        const materialized = existing.exists
          ? { pool: existing.data() }
          : await materializePool(db, group, now);
        pool = materialized.pool;
        if (pool != null && pool.status === POOL_STATUS.OPEN) {
          const closed = await ensureClosed(db, group, now);
          if (closed.closed === true) pool = closed.pool;
        }
      } catch (err) {
        // ONE pod's pool must never take down the list: the pod still lists with
        // `pool: null` (not backable, nothing sealed to leak) and the failure is
        // logged for the operator.
        console.warn(`[backing-pools] pool unavailable for ${group.id}:`, err?.message);
        try {
          const existing = await poolRefFor(db, group).get();
          pool = existing.exists ? existing.data() : null;
        } catch { pool = null; }
      }
      return projectPod(group, pool, {
        viewerUid: user.uid,
        myStakes: stakesByGroup.get(group.id) ?? [],
      });
    }));

    // The week's own bounds, derived from the SAME battle Monday the label came
    // from rather than read off whichever pod happened to sort first — a list
    // with no pods still names its week correctly (§9).
    const week = backingWeekFor(deriveBattleStartWeek(now.toISOString()).mondayEtDate);
    return res.status(200).json({
      baseLayerWeek,
      // The BACKING WEEK's own bounds. Named apart from each pod's
      // `pool.closesAt` on purpose: a slot pod's pool closes at its FIRE
      // instant, days before this Sunday clock (§4), so one name for both would
      // be the §9 display-agreement failure mode applied to a deadline.
      backingWeekStart: week?.startIso ?? null,
      backingWeekCloses: week?.closeIso ?? null,
      viewerUid: user.uid,
      pods,
    });
  } catch (err) {
    console.error('[backing-pools] list failed:', err?.message);
    return res.status(500).json({ error: 'server_error', message: 'Could not load the pod list.' });
  }
}
