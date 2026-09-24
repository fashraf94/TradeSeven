// api/backing/results.js
//
// GET /api/backing/results — Backing Beta PR 5, THE RESULTS READER (spec V1.3
// §5 "Results card (after settlement), in the Spectate final state", §3 the
// reveal, §7 "Retries": settle-on-read; §12 PR 5; ruling D-o; the PR 3 review
// record's finding 1). Auth → dark 404 → the viewer's SETTLED / REFUNDED /
// INSUFFICIENT pools for the last completed backing week, and paginated
// history; or ONE pod's result for the Spectate final state.
//
// THE ORDER, the same rungs every backing route climbs:
//   1  security middleware + rate limit
//   2  method — GET only
//   3  auth
//   4  THE FLAG — 404 while BACKING_BETA_ENABLED is dark, AFTER auth
//   5  query — `groupId` (one pod) OR `before` + `limit` (weeks, newest first)
//   6  the viewer's own stakes (ONE query), the pools they name, the
//      settle-on-read pass, the viewer's stakes RE-READ after the pool
//      wherever the pool moved them or contradicts them (`loadPod`), the
//      projection
//
// THIS IS THE SETTLE-ON-READ PATH THE POD LIST COULD NEVER BE (PR 3 review,
// finding 1). The pod list is keyed to the NEXT battle Monday's week and never
// lists a completed pod; this reader loads pools BY THE VIEWER'S OWN STAKES,
// across weeks, so it is the first client read that can reach a `closed` pool
// whose pod has since completed. When it does — or when the pod has been
// voided, expired or deleted — it calls `settlePool` (which routes the refund
// paths itself), with ITS OWN `TOURNAMENT_ADVANCEMENT_FROZEN` check (A-C13:
// the routes have no freeze cover of their own), and NEVER for a `resolving`
// hold, which only the admin endpoint releases. The freeze check stands in
// front of the CALL: frozen means the primitive is not called, not that it
// declines. An open pool past its close is closed first (§7's lazy close),
// exactly as the pod list and the stake route do.
//
// WHAT THE CARD IS TOLD, and from where (BUILD_RULES §9): everything comes off
// the pool document and the viewer's stake documents through the pure
// projection (api/_utils/backingResults.js) — the payout per stake is
// `stake.payout`, never `stake × paysX`; pays × per team is §3's own table as
// settlement wrote it; each team's share is the close's `stakeTotal ÷ potTotal`,
// labeled exactly; a refunded or insufficient pool is stated with its reason.
//
// WHICH WEEKS, WHICH POOLS: the viewer's stakes are grouped by `weekKey`,
// newest first. A week is listed once one of its pools HAS A RESULT OR IS
// WAITING ON ONE — decided (`resolved` / `refunded` / `insufficient`), held
// (`resolving`, for the admin), or `closed` with nothing left to play (the
// pod complete, gone, or frozen mid-settlement) — and it shows exactly those
// pools. A `closed` pool whose pod is STILL PLAYING is never listed here: it
// is Your Backing's for exactly as long as it plays, and a results card must
// never call an in-battle pod complete (HON-3); a pool that outlives Your
// Backing's three-week window while still waiting — a hold, a frozen week, a
// failed settlement (§7: "pools may sit unresolved indefinitely") — has this
// surface and no other (HON-R-3, the PR 5 review record). `before=<weekKey>`
// pages further back; `limit` is weeks per page (1–12, default 4); at most
// `MAX_WEEKS_SCANNED` weeks are examined per request, so the read cost is
// bounded whatever the history.
//
// READ-ONLY FOR THE VIEWER: the only writes this route can cause are the pool
// lifecycle's own (the lazy close, the settlement, the refund), which belong
// to the pool and not to this request's viewer. Every one is the shared
// primitive; none is this route's own logic.
//
// EVERY NAME ON THE CARD IS THE SERVER'S (Amendment C §C1, D-af): the winner
// line, the team rows and the viewer's stakes carry the one resolver's labels
// (api/_utils/backingTeamLabels.js) — a settled team is named by the agent
// settlement recorded. The pods are loaded (and passed through settle-on-read)
// first, and every name the RESPONSE carries is then resolved in ONE batch,
// so no pod reads a name of its own.

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { isValidForgeId } from '../_utils/idValidation.js';
import {
  BACKING_POOLS_COLLECTION,
  BACKING_STAKES_COLLECTION,
  POOL_STATUS,
  ensureClosed,
  liveStakeContradicts,
  readGroup,
} from '../_utils/backingPools.js';
import {
  SETTLEMENT_SOURCE,
  refundReasonForGroup,
  settlePool,
  settlementPredicate,
} from '../_utils/backingSettlement.js';
import { projectResultPool, weeksOf } from '../_utils/backingResults.js';
import { labelSeatOf, podLabelSeats, resolveTeamLabels } from '../_utils/backingTeamLabels.js';
import { isTerminalPool, readPoolByGroupId, readStakesWhere } from '../_utils/backingStats.js';
import { GROUP_STATUS } from '../../src/constants/leagueTournament.js';
import { BACKING_BETA_ENABLED, TOURNAMENT_ADVANCEMENT_FROZEN } from '../../src/config/featureFlags.js';

export const config = { maxDuration: 30 };

/** Weeks per page: the default and the ceiling. */
export const DEFAULT_WEEKS = 4;
export const MAX_WEEKS = 12;

/** The most weeks one request will examine while looking for results (a half-year of stakes). */
export const MAX_WEEKS_SCANNED = 26;

const WEEK_KEY_RE = /^\d{4}-W\d{2}$/;

/** A pod with nothing left to play: complete, voided, expired — or gone. */
const POD_DONE = new Set([GROUP_STATUS.COMPLETE, GROUP_STATUS.VOIDED, GROUP_STATUS.EXPIRED]);
const podDone = (podStatus) => podStatus == null || POD_DONE.has(podStatus);

/**
 * Whether a projected pool belongs on the results surface: it has a result,
 * or it is waiting on one with nothing left to play. A closed pool of a pod
 * still playing is Your Backing's (HON-3 / HON-R-3, the PR 5 review record).
 */
export function showsInResults(pod) {
  if (!pod) return false;
  if (isTerminalPool({ status: pod.status })) return true;
  if (pod.status === POOL_STATUS.RESOLVING) return true;
  return pod.status === POOL_STATUS.CLOSED && podDone(pod.podStatus);
}

/** Why the settle-on-read pass did not call the primitive — the row vocabulary. */
export const SETTLE_ON_READ_SKIP = Object.freeze({
  NO_POOL: 'no_pool',
  NOT_CLOSED: 'not_closed',
  FROZEN: 'frozen',
  NOT_FINAL: 'not_final',
});

/**
 * THE SETTLE-ON-READ PASS for one pod — the contract the pod list carried
 * (backing-pools.js) and this reader inherits: close an open pool past its
 * close; then, for a CLOSED pool whose pod is final, voided, expired or gone,
 * call the one primitive — never under the freeze, never for a `resolving`
 * hold. Returns the pool as it stands afterwards.
 *
 * @returns {Promise<{pool: Object|null, called: boolean, skipped?: string, settled?: boolean, refunded?: boolean, reason?: string}>}
 */
export async function settleOnRead(db, { groupId, group, pool, now }) {
  let current = pool;
  if (current?.status === POOL_STATUS.OPEN) {
    const closed = await ensureClosed(db, group ?? groupId, now);
    if (closed.pool) current = closed.pool;
  }
  if (current == null) return { pool: null, called: false, skipped: SETTLE_ON_READ_SKIP.NO_POOL };
  if (current.status !== POOL_STATUS.CLOSED) return { pool: current, called: false, skipped: SETTLE_ON_READ_SKIP.NOT_CLOSED };
  // THE FREEZE, this route's own check, in front of the call (A-C13).
  if (TOURNAMENT_ADVANCEMENT_FROZEN) return { pool: current, called: false, skipped: SETTLE_ON_READ_SKIP.FROZEN };
  const terminal = refundReasonForGroup(group) !== null;
  if (!terminal && !settlementPredicate(group).final) return { pool: current, called: false, skipped: SETTLE_ON_READ_SKIP.NOT_FINAL };
  const out = await settlePool(db, groupId, { now, source: SETTLEMENT_SOURCE.SETTLE_ON_READ });
  return { pool: out.pool ?? current, called: true, settled: out.settled === true, refunded: out.refunded === true, reason: out.reason ?? null };
}

/**
 * The viewer's stakes on a pod, RE-READ by id after the pass moved them
 * (`live` → `won` | `lost` | `voided`): the card must show the documents as
 * settlement or the refund left them, never the pre-pass copies.
 */
async function refreshStakes(db, myStakes) {
  return Promise.all(myStakes.map(async (s) => {
    const snap = await db.collection(BACKING_STAKES_COLLECTION).doc(s.id).get();
    return snap.exists ? { id: snap.id, ...snap.data() } : s;
  }));
}

/**
 * One pod, loaded and passed through settle-on-read — the documents as the
 * pass left them, ready for `projectPods`. The settle-on-read pass never takes
 * the reader down: a pod whose SETTLEMENT fails projects as it now stands
 * (the two loads before it are plain reads and surface as the request's 500
 * like any other read failure).
 *
 * THE VIEWER'S STAKES ARE ANSWERED AS THEY STAND AFTER THE POOL — the pod
 * list's rule, mirrored (WIRE-R-1 / WIRING-1 there; WIRING-15 and WIRING-1's
 * twin here, the pre-flip cleanup's review record). The copies come from the
 * ONE stakes query in 6a, read BEFORE any pool, so they are re-read by id
 * whenever they can be stale:
 *   · the pass MOVED the pool, or called the primitive — the lazy close moves
 *     stakes on its own (`insufficient` voids them, a deleted pod's tombstone
 *     refunds them, a seat that left is voided) without the primitive being
 *     called (WIRE-1, the PR 5 review record);
 *   · the answered pool CONTRADICTS a `live` copy (`liveStakeContradicts`, the
 *     one predicate the pod list re-reads on): ANOTHER request's close or
 *     settlement committed between the stakes query and this pod's pool read,
 *     so `before` already carries the new status and nothing here moved it
 *     (WIRING-1's twin);
 *   · the pass FAILED after moving the pool — the lazy close committed, then
 *     the settlement threw — so the pool is RE-READ as it now stands, never
 *     answered from the copy read before the pass, and the same rule runs on
 *     it (WIRING-15).
 * Zero reads in the steady state: a decided pool's decided stakes and a closed
 * pool's live stakes on its frozen teams contradict nothing. BOTH RE-READS ARE
 * PLAIN READS, and a failed one is the request's 500 like any other (the
 * pre-flip fixes 2 review record): a pool that cannot be re-read is never
 * dropped from its week — a page would step past it and never come back
 * (WIRE-E1) — and stakes that cannot be re-read are never answered from copies
 * this request knows may be stale, beside a pool that contradicts them
 * (WIRE-E3). The reader's pages keep their cursor on an error, so the read is
 * retried, not lost. (The pod list keeps its own rule — one pod never takes
 * down the list — for a list of pods still to be backed.)
 */
async function loadPod(db, { groupId, myStakes, now }) {
  const group = await readGroup(db, groupId);
  let located = await readPoolByGroupId(db, groupId);
  if (located.pool == null) return null;
  // The status BEFORE the pass — the state the viewer's copies are judged against.
  const before = located.pool.status;
  let called = false;
  try {
    const passed = await settleOnRead(db, { groupId, group, pool: located.pool, now });
    called = passed.called === true;
    if (passed.pool) located = { ...located, pool: passed.pool };
  } catch (err) {
    // ONE pod's settlement must never take down the reader: the failure is
    // logged for the operator, and the pod projects as it NOW stands — the
    // pool RE-READ (a plain read: its own failure is the request's 500).
    console.warn(`[backing-results] settle-on-read failed for ${groupId}:`, err?.message);
    const snap = await db.collection(BACKING_POOLS_COLLECTION).doc(located.poolId).get();
    located = { ...located, pool: snap.exists ? snap.data() : null };
    if (located.pool == null) return null;
  }
  let stakes = myStakes;
  const stale = called
    || located.pool.status !== before
    || myStakes.some((s) => liveStakeContradicts(located.pool, s));
  // A plain read, too: never the stale copies instead (WIRE-E3).
  if (myStakes.length > 0 && stale) stakes = await refreshStakes(db, myStakes);
  return { groupId, poolId: located.poolId, pool: located.pool, group, myStakes: stakes };
}

/** What `showsInResults` reads, off a LOADED pod: the pool's status and the pod's own. */
function statusesOf(loaded) {
  return { status: loaded.pool?.status ?? null, podStatus: typeof loaded.group?.status === 'string' ? loaded.group.status : null };
}

/**
 * The loaded pods' projections, every name from ONE batched call of the label
 * resolver (D-af — no per-row reads): each pod's seats, its frozen teams with
 * settlement's recorded agents, and the teams the viewer's stakes name.
 */
async function projectPods(db, loaded) {
  const labels = await resolveTeamLabels(db, loaded.flatMap(({ group, pool, myStakes }) => podLabelSeats({
    group, pool, extraTeamIds: myStakes.map((s) => s.teamOdUserId),
  })));
  return loaded.map(({ groupId, poolId, pool, group, myStakes }) => projectResultPool({
    groupId,
    poolId,
    pool,
    group,
    myStakes,
    nameTeam: (odUserId) => labels.teamLabelFor(labelSeatOf({ group, pool }, odUserId)),
  }));
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

  // 5. Query.
  const q = req.query && typeof req.query === 'object' ? req.query : {};
  const groupId = typeof q.groupId === 'string' && q.groupId.length > 0 ? q.groupId : null;
  if (groupId !== null && !isValidForgeId(groupId)) {
    return res.status(400).json({ error: 'invalid_group_id', message: 'groupId must be a valid id when present.' });
  }
  const before = typeof q.before === 'string' && q.before.length > 0 ? q.before : null;
  if (before !== null && !WEEK_KEY_RE.test(before)) {
    return res.status(400).json({ error: 'invalid_before', message: 'before must be a week key (YYYY-Www) when present.' });
  }
  let limit = DEFAULT_WEEKS;
  if (q.limit !== undefined) {
    const n = Number(q.limit);
    if (!Number.isInteger(n) || n < 1 || n > MAX_WEEKS) {
      return res.status(400).json({ error: 'invalid_limit', message: `limit must be a whole number from 1 to ${MAX_WEEKS} when present.` });
    }
    limit = n;
  }

  const db = getFirebaseAdmin();
  const now = new Date();
  try {
    // 6a. The viewer's OWN stakes — one query; the reader never reads anyone else's.
    const stakes = await readStakesWhere(db, 'userId', user.uid);

    // 6b. ONE POD (the Spectate final state): its result, with the viewer's stakes on it, if any.
    if (groupId !== null) {
      const loaded = await loadPod(db, { groupId, myStakes: stakes.filter((s) => s.groupId === groupId), now });
      const [pod] = loaded ? await projectPods(db, [loaded]) : [null];
      return res.status(200).json({ viewerUid: user.uid, pod });
    }

    // 6c. WEEKS, newest first: a week is a result once one of its pools is done.
    const weeks = weeksOf(stakes).filter((w) => before === null || w.weekKey < before);
    const page = [];
    let scanned = 0;
    let lastScanned = null;
    let nextBefore = null;
    for (const week of weeks) {
      // The cursor is always the LAST WEEK EXAMINED: the next page filters
      // `weekKey < before`, so a cursor naming the first UNexamined week would
      // skip it for ever (WIRE-2, the PR 5 review record).
      if (page.length >= limit) { nextBefore = lastScanned; break; }
      if (scanned >= MAX_WEEKS_SCANNED) { nextBefore = lastScanned; break; }
      scanned += 1;
      lastScanned = week.weekKey;
      const pods = (await Promise.all(week.groupIds.map((id) => loadPod(db, { groupId: id, myStakes: stakes.filter((s) => s.groupId === id), now })))).filter(Boolean);
      // Every pod took the settle-on-read pass above; the week shows the pools
      // that have a result or are waiting on one (see the header).
      const shown = pods.filter((loaded) => showsInResults(statusesOf(loaded)));
      if (shown.length === 0) continue;
      page.push({ weekKey: week.weekKey, pools: shown });
    }
    // The page's names, in ONE batch, then the projections in page order.
    const projected = await projectPods(db, page.flatMap((w) => w.pools));
    let at = 0;
    const weeksOut = page.map((w) => ({ weekKey: w.weekKey, pools: w.pools.map(() => projected[at++]) }));
    return res.status(200).json({ viewerUid: user.uid, weeks: weeksOut, nextBefore, weeksAvailable: weeks.length });
  } catch (err) {
    console.error('[backing-results] failed:', err?.message);
    return res.status(500).json({ error: 'server_error', message: 'Could not load your results.' });
  }
}
