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
//      settle-on-read pass, the projection
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
// WHICH WEEKS: the viewer's stakes are grouped by `weekKey`, newest first. A
// week is a RESULT once at least one of its pools has nothing left to decide;
// a week whose pools are all open, closed or held is in play (the strip and
// Your Backing own it) and is skipped. A listed week shows its TERMINAL pools
// only: a pool of that week still `closed` (its pod in battle) or held stays
// with the strip and Your Backing until it is decided — a results card must
// never call an in-battle pod complete (HON-3, the PR 5 review record).
// `before=<weekKey>` pages further back; `limit` is weeks per page (1–12,
// default 4); at most `MAX_WEEKS_SCANNED` weeks are examined per request, so
// the read cost is bounded whatever the history.
//
// READ-ONLY FOR THE VIEWER: the only writes this route can cause are the pool
// lifecycle's own (the lazy close, the settlement, the refund), which belong
// to the pool and not to this request's viewer. Every one is the shared
// primitive; none is this route's own logic.

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { isValidForgeId } from '../_utils/idValidation.js';
import { BACKING_STAKES_COLLECTION, POOL_STATUS, ensureClosed, readGroup } from '../_utils/backingPools.js';
import {
  SETTLEMENT_SOURCE,
  refundReasonForGroup,
  settlePool,
  settlementPredicate,
} from '../_utils/backingSettlement.js';
import { projectResultPool, weeksOf } from '../_utils/backingResults.js';
import { isTerminalPool, readPoolByGroupId, readStakesWhere } from '../_utils/backingStats.js';
import { BACKING_BETA_ENABLED, TOURNAMENT_ADVANCEMENT_FROZEN } from '../../src/config/featureFlags.js';

export const config = { maxDuration: 30 };

/** Weeks per page: the default and the ceiling. */
export const DEFAULT_WEEKS = 4;
export const MAX_WEEKS = 12;

/** The most weeks one request will examine while looking for results (a half-year of stakes). */
export const MAX_WEEKS_SCANNED = 26;

const WEEK_KEY_RE = /^\d{4}-W\d{2}$/;

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
 * One pod, loaded and passed through settle-on-read, then projected. The
 * settle-on-read pass never takes the reader down: a pod whose SETTLEMENT
 * fails projects with what was read (the two loads before it are plain reads
 * and surface as the request's 500 like any other read failure).
 */
async function loadPod(db, { groupId, myStakes, now }) {
  const group = await readGroup(db, groupId);
  let located = await readPoolByGroupId(db, groupId);
  if (located.pool == null) return null;
  let stakes = myStakes;
  try {
    // The status BEFORE the pass: the lazy close moves stakes on its own
    // (`insufficient` voids them, a deleted pod's tombstone refunds them, a
    // seat that left is voided) without the primitive being called, so the
    // viewer's copies are re-read whenever the pool's status moved — not only
    // when the primitive ran (WIRE-1, the PR 5 review record).
    const before = located.pool.status;
    const passed = await settleOnRead(db, { groupId, group, pool: located.pool, now });
    if (passed.pool) located = { ...located, pool: passed.pool };
    if (passed.called || located.pool.status !== before) stakes = await refreshStakes(db, myStakes);
  } catch (err) {
    // ONE pod's settlement must never take down the reader: the pod projects
    // as it stands and the failure is logged for the operator.
    console.warn(`[backing-results] settle-on-read failed for ${groupId}:`, err?.message);
  }
  return projectResultPool({ groupId, poolId: located.poolId, pool: located.pool, group, myStakes: stakes });
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
      const pod = await loadPod(db, { groupId, myStakes: stakes.filter((s) => s.groupId === groupId), now });
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
      // Every pod took the settle-on-read pass above; only the DECIDED ones are a result.
      const done = pods.filter((p) => isTerminalPool({ status: p.status }));
      if (done.length === 0) continue;
      page.push({ weekKey: week.weekKey, pools: done });
    }
    return res.status(200).json({ viewerUid: user.uid, weeks: page, nextBefore, weeksAvailable: weeks.length });
  } catch (err) {
    console.error('[backing-results] failed:', err?.message);
    return res.status(500).json({ error: 'server_error', message: 'Could not load your results.' });
  }
}
