// api/_utils/hypothesisRecords/reviewPass.js
//
// Pilot P1a — THE HYPOTHESIS REVIEW PASS (founder decision D2, 7 Oct 2026;
// pilot spec §2.5 rows `activated → review_due`; Phase 0 report §5.3, §5.5).
// The FIFTH isolated tenant of api/cron/process-pending-reflections.js, after
// the call sweep, with its own time slice and outcome counters. It never
// throws. `completeBattle` is untouched (contract Amendment B §B.7 precedent):
// the pass keys on the version's own `activated` state plus the battle's
// terminal status, so every way a battle ends is covered, at most one
// 15-minute tick late, on a state that grants no authority (R6).
//
// P1b (deploy carriage) arms the queue rows at activation, in the battle's
// creation transaction (api/_utils/hypothesisRecords/carriage.js
// activateCarriedVersionInTx → armReviewRow). P1a shipped the pass, the queue
// shape and `armReviewRow`.
//
// THE GATE: the flag off, or no owner admitted at all → return BEFORE ANY
// READ (the gate is off for everyone). Otherwise each row's
// owner must be on the cockpit allowlist, else the row is read, counted
// `skippedOff`, and nothing else is read or written for it (the call sweep's
// per-owner-off posture, Amendment B §B.10).
//
// THE QUEUE `hypothesisReviewQueue/{watchlistId}:{version}` = { userId,
// watchlistId, version, battleId, dueAtMs (null when the horizon is
// `unspecified`), armedAt } — its own server-only collection; NOT
// `callSweepQueue`, whose orphan handling would delete a version-keyed row on
// first visit (Phase 0 §5.3).
//
// TWO PHASES per invocation, each bounded by the deadline and each paged from
// its own PERSISTED cursor in hypothesisReviewState/cursor (the call sweep's
// precedent; review L2-2), so rows the pass never consumes — an owner off the
// allowlist, a malformed row, one that keeps failing — are passed over rather
// than re-read from the head every tick, and cannot starve the rows behind
// them; a short page wraps a cursor to the start, where they are retried:
//   'due'          rows with dueAtMs <= now (dueAtMs ASC, __name__ ASC) from
//                  `{ dueLastDueAtMs, dueLastDocId }`;
//   'unspecified'  rows with dueAtMs == null (__name__ ASC) from `{ lastDocId }`.
// Each transition is ONE bounded transaction (the call sweep's boundedTx
// shape): fresh reads of the row and the version (and, for an unspecified row,
// the battle); it acts ONLY if the version is still `activated`, then writes
// `review_due` (stateSource 'review_pass', reason `horizon_elapsed` |
// `battle_ended`) and deletes the row in the same commit. A row whose version
// is no longer `activated` (or is gone) is deleted with no transition. A
// timed-out attempt is UNCONFIRMED — it may commit late; the next pass
// re-reads and judges once (spec §2.5 "judged once").

import { withTimeout } from '../intraday/evaluatorHook.js';
import { hypothesisRecordsOnForAnyone, isHypothesisOwnerAllowlisted } from './gate.js';
import { STATE_REASONS, versionDocId, isVersionNumber, WATCHLISTS_COLLECTION, VERSIONS_SUBCOLLECTION } from './model.js';

export const REVIEW_QUEUE_COLLECTION = 'hypothesisReviewQueue';
export const REVIEW_STATE_COLLECTION = 'hypothesisReviewState';
export const REVIEW_STATE_DOC = 'cursor';
export const REVIEW_BRANCH_MS = 8_000;
/** The reflections cron's own TIME_BUDGET_MS — the pass never runs past it. */
export const REVIEW_HANDLER_CAP_MS = 50_000;
export const REVIEW_STARVATION_MS = 1_500;
export const REVIEW_PAGE = 20;
export const REVIEW_TX_MS = 1_500;
export const REVIEW_SOURCE = 'review_pass';

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const nonEmpty = (v) => typeof v === 'string' && v.length > 0;
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

class ReviewAbort extends Error {
  constructor(reason) {
    super(`review_abort_${reason}`);
    this.reviewAbort = reason;
  }
}
const isTimeout = (err) => String(err?.message || '').includes('_timeout_');

/** The queue row id. */
export const reviewRowId = (watchlistId, version) => `${watchlistId}:${version}`;
export const reviewRowRef = (db, watchlistId, version) => db.collection(REVIEW_QUEUE_COLLECTION).doc(reviewRowId(watchlistId, version));
const reviewStateRef = (db) => db.collection(REVIEW_STATE_COLLECTION).doc(REVIEW_STATE_DOC);
const versionRefOf = (db, watchlistId, version) => db.collection(WATCHLISTS_COLLECTION).doc(watchlistId).collection(VERSIONS_SUBCOLLECTION).doc(versionDocId(version));

/** The pass's deadline: min(now + 8 s, handlerStart + 50 s). */
export function reviewDeadline({ nowMs, handlerStartMs }) {
  return Math.min(nowMs + REVIEW_BRANCH_MS, handlerStartMs + REVIEW_HANDLER_CAP_MS);
}

/** A queue row as read: null when its identity is unusable (a malformed row is skipped and counted, never acted on). */
export function normalizeReviewRow(data) {
  const d = isPlainObject(data) ? data : null;
  if (!d || !nonEmpty(d.userId) || !nonEmpty(d.watchlistId) || !isVersionNumber(d.version) || !nonEmpty(d.battleId)) return null;
  if (!(d.dueAtMs === null || finite(d.dueAtMs))) return null;
  return { userId: d.userId, watchlistId: d.watchlistId, version: d.version, battleId: d.battleId, dueAtMs: d.dueAtMs, armedAt: finite(d.armedAt) ? d.armedAt : null };
}

/**
 * Arm a review row — P1b's activation calls this in the battle's creation
 * transaction (carriage.js activateCarriedVersionInTx).
 * Buffers ONE `tx.set` on the caller's transaction. Throws on a malformed row
 * — arming is a programming contract, never a guess.
 */
export function armReviewRow(tx, db, { userId, watchlistId, version, battleId, dueAtMs, armedAt }) {
  const row = normalizeReviewRow({ userId, watchlistId, version, battleId, dueAtMs, armedAt });
  if (!row || !finite(armedAt)) throw new Error('hypothesisRecords: armReviewRow needs { userId, watchlistId, version, battleId, dueAtMs: number|null, armedAt: number }');
  tx.set(reviewRowRef(db, watchlistId, version), { userId, watchlistId, version, battleId, dueAtMs, armedAt });
  return row;
}

/** Is a battle over? Any status other than 'active' (the call sweep's terminal rule). */
export function battleIsTerminal(battle) {
  return isPlainObject(battle) && typeof battle.status === 'string' && battle.status !== 'active';
}

/**
 * What the pass may do with one row, from FRESH reads. Pure.
 * @returns {{ act: 'transition', reason: string } | { act: 'delete_stale' } | { act: 'skip', why: string }}
 */
export function decideReview({ row, version, battle, nowMs }) {
  if (!isPlainObject(version) || version.status !== 'activated') return { act: 'delete_stale' };
  if (finite(row.dueAtMs)) {
    return nowMs >= row.dueAtMs ? { act: 'transition', reason: STATE_REASONS.horizonElapsed } : { act: 'skip', why: 'not_due' };
  }
  if (battle === null) return { act: 'skip', why: 'battle_missing' };
  return battleIsTerminal(battle) ? { act: 'transition', reason: STATE_REASONS.battleEnded } : { act: 'skip', why: 'battle_live' };
}

async function boundedTx(db, deadlineMs, label, body) {
  const budgetMs = Math.min(REVIEW_TX_MS, deadlineMs - Date.now());
  if (budgetMs <= 0) return { result: 'not_started' };
  const attemptDeadlineMs = Date.now() + budgetMs;
  try {
    return await withTimeout(db.runTransaction(async (tx) => {
      if (Date.now() >= attemptDeadlineMs) throw new ReviewAbort('deadline');
      return body(tx, attemptDeadlineMs);
    }), budgetMs, label);
  } catch (err) {
    if (err?.reviewAbort === 'deadline' || isTimeout(err)) return { result: 'unconfirmed' };
    const error = String(err?.message || err).slice(0, 200);
    console.error(`[hypothesis] review ${label} failed: ${error}`);
    return { result: 'failed', error };
  }
}

/** One row: fresh reads, then a transition + delete, a stale delete, or nothing. */
async function reviewOne({ db, rowId, row, nowMs, nowIso, deadlineMs }) {
  const rowRef = db.collection(REVIEW_QUEUE_COLLECTION).doc(rowId);
  const versionRef = versionRefOf(db, row.watchlistId, row.version);
  return boundedTx(db, deadlineMs, 'hypothesis_review', async (tx, attemptDeadlineMs) => {
    const [rowSnap, versionSnap] = await tx.getAll(rowRef, versionRef);
    if (!rowSnap?.exists) return { result: 'skipped', why: 'row_gone' };
    const fresh = normalizeReviewRow(rowSnap.data());
    if (!fresh) return { result: 'skipped', why: 'malformed' };
    const version = versionSnap?.exists ? versionSnap.data() : null;
    let battle;
    if (version?.status === 'activated' && !finite(fresh.dueAtMs)) {
      const battleSnap = await tx.get(db.collection('agentBattles').doc(fresh.battleId));
      battle = battleSnap?.exists ? battleSnap.data() : null;
    }
    const d = decideReview({ row: fresh, version, battle, nowMs });
    if (d.act === 'skip') return { result: 'skipped', why: d.why };
    if (Date.now() >= attemptDeadlineMs) throw new ReviewAbort('deadline');
    if (d.act === 'delete_stale') {
      tx.delete(rowRef);
      return { result: 'stale_deleted' };
    }
    tx.update(versionRef, { status: 'review_due', stateChangedAt: nowIso, stateSource: REVIEW_SOURCE, stateReason: d.reason });
    tx.delete(rowRef);
    return { result: 'transitioned', reason: d.reason };
  });
}

/**
 * THE PASS. Never throws.
 *
 * @param {{ db: object, handlerStartMs: number, nowMs?: number }} p
 */
export async function runHypothesisReviewPass({ db, handlerStartMs, nowMs = Date.now() }) {
  // THE GLOBAL GATE — before any read. Flag off, or flag on with NOBODY admitted: the gate resolves off
  // for every owner, so the pass returns before any read (review L2-2).
  if (!hypothesisRecordsOnForAnyone()) return { skipped: 'disabled', reads: 0 };
  const deadlineMs = reviewDeadline({ nowMs, handlerStartMs });
  const summary = {
    skipped: null, starved: false, availableMs: deadlineMs - nowMs, rows: 0,
    horizonElapsed: 0, battleEnded: 0, staleDeleted: 0, notDue: 0, battleLive: 0, battleMissing: 0,
    malformed: 0, skippedOff: 0, unconfirmed: 0, failed: 0, cut: false, cursorBefore: null, cursorAfter: null,
  };
  if (deadlineMs - nowMs < REVIEW_STARVATION_MS) {
    summary.starved = true;
    console.log(`[hypothesis] review starved available=${deadlineMs - nowMs}ms (< ${REVIEW_STARVATION_MS}) — no read performed; the next tick covers it`);
    return summary;
  }
  const nowIso = new Date(nowMs).toISOString();
  const tally = (res) => {
    if (res.result === 'transitioned') summary[res.reason === STATE_REASONS.horizonElapsed ? 'horizonElapsed' : 'battleEnded'] += 1;
    else if (res.result === 'stale_deleted') summary.staleDeleted += 1;
    else if (res.result === 'unconfirmed') summary.unconfirmed += 1;
    else if (res.result === 'failed') summary.failed += 1;
    else if (res.result === 'skipped') {
      const key = { not_due: 'notDue', battle_live: 'battleLive', battle_missing: 'battleMissing', malformed: 'malformed' }[res.why];
      if (key) summary[key] += 1;
    }
    return res.result === 'not_started';
  };
  /** One page's rows; returns { cut, last, size }. */
  const walk = async (docs) => {
    let last = null;
    for (const doc of docs) {
      if (Date.now() >= deadlineMs) return { cut: true, last };
      summary.rows += 1;
      const row = normalizeReviewRow(doc.data());
      if (!row) { summary.malformed += 1; last = doc; continue; }
      if (!isHypothesisOwnerAllowlisted(row.userId)) { summary.skippedOff += 1; last = doc; continue; }
      const res = await reviewOne({ db, rowId: doc.id, row, nowMs, nowIso, deadlineMs });
      if (tally(res)) return { cut: true, last };
      last = doc;
    }
    return { cut: false, last };
  };

  let cursorId = null;
  let cursorAfter = null;
  let dueBefore = null;
  let dueAfter = null;
  let stateRead = false;
  try {
    // The cursors, one document: { dueLastDueAtMs, dueLastDocId } for the 'due' phase and
    // { lastDocId } for the 'unspecified' phase. Each wraps to the start on a short page.
    const stateSnap = await withTimeout(reviewStateRef(db).get(), Math.max(1, deadlineMs - Date.now()), 'hypothesis_review_cursor');
    const state = stateSnap?.exists && isPlainObject(stateSnap.data()) ? stateSnap.data() : {};
    stateRead = true;
    cursorId = nonEmpty(state.lastDocId) ? state.lastDocId : null;
    dueBefore = finite(state.dueLastDueAtMs) && nonEmpty(state.dueLastDocId) ? { dueAtMs: state.dueLastDueAtMs, id: state.dueLastDocId } : null;
    summary.cursorBefore = cursorId;
    summary.dueCursorBefore = dueBefore;
    cursorAfter = cursorId;
    dueAfter = dueBefore;

    // Phase 'due' — from its persisted cursor (review L2-2): rows the pass never consumes (an owner off
    // the allowlist, a malformed row, a row that keeps failing) are passed over, not re-read from the
    // head every tick, so they cannot starve the rows behind them; the next wrap retries them.
    for (;;) {
      if (Date.now() >= deadlineMs) { summary.cut = true; break; }
      let q = db.collection(REVIEW_QUEUE_COLLECTION).where('dueAtMs', '<=', nowMs).orderBy('dueAtMs', 'asc').orderBy('__name__', 'asc');
      if (dueAfter) q = q.startAfter(dueAfter.dueAtMs, dueAfter.id);
      const page = await withTimeout(q.limit(REVIEW_PAGE).get(), Math.max(1, deadlineMs - Date.now()), 'hypothesis_review_due_page');
      const docs = page?.docs || [];
      const { cut, last } = await walk(docs);
      if (last) dueAfter = { dueAtMs: last.data().dueAtMs, id: last.id };
      if (cut) { summary.cut = true; break; }
      if (docs.length < REVIEW_PAGE) { dueAfter = null; break; }
    }

    // Phase 'unspecified' — from its persisted cursor.
    if (!summary.cut) {
      for (;;) {
        if (Date.now() >= deadlineMs) { summary.cut = true; break; }
        let q = db.collection(REVIEW_QUEUE_COLLECTION).where('dueAtMs', '==', null).orderBy('__name__', 'asc');
        if (cursorAfter) q = q.startAfter(cursorAfter);
        const page = await withTimeout(q.limit(REVIEW_PAGE).get(), Math.max(1, deadlineMs - Date.now()), 'hypothesis_review_null_page');
        const docs = page?.docs || [];
        const { cut, last } = await walk(docs);
        if (last) cursorAfter = last.id;
        if (cut) { summary.cut = true; break; }
        if (docs.length < REVIEW_PAGE) { cursorAfter = null; break; }
      }
    }
  } catch (err) {
    summary.stopped = isTimeout(err) ? 'deadline' : 'threw';
    summary.error = String(err?.message || err).slice(0, 200);
  }

  // The cursors, written only when one moved (no write in the steady empty state, none if the state was never read).
  const dueMoved = JSON.stringify(dueAfter) !== JSON.stringify(dueBefore);
  if (stateRead && (cursorAfter !== cursorId || dueMoved)) {
    try {
      await withTimeout(reviewStateRef(db).set({
        lastDocId: cursorAfter,
        dueLastDueAtMs: dueAfter ? dueAfter.dueAtMs : null,
        dueLastDocId: dueAfter ? dueAfter.id : null,
        updatedAt: nowMs,
      }), Math.max(250, deadlineMs - Date.now()), 'hypothesis_review_cursor_write');
    } catch (err) {
      summary.cursorWrite = isTimeout(err) ? 'unconfirmed' : 'failed';
    }
  }
  summary.cursorAfter = cursorAfter;
  summary.dueCursorAfter = dueAfter;
  summary.ms = Date.now() - nowMs;
  console.log(`[hypothesis] review ${JSON.stringify(summary)}`);
  return summary;
}
