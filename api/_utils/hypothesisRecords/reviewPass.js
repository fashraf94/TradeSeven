// api/_utils/hypothesisRecords/reviewPass.js
//
// Pilot P1a — THE HYPOTHESIS REVIEW PASS (founder decision D2, 7 Oct 2026;
// pilot spec §2.5 rows `activated → review_due`; Phase 0 report §5.3, §5.5).
// The FIFTH isolated tenant of api/cron/process-pending-reflections.js, after
// the call sweep, with its own time slice and outcome counters. It never
// throws. `completeBattle` is untouched (contract Amendment B §B.7 precedent):
// the pass keys on the version's own `activated` state plus the battle's end
// (terminal; since P1c also past its expiresAt), so every way a battle ends is covered, at most one
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
//
// Pilot P1c — WHEN A BATTLE IS OVER (review L2-3): terminal, or past its own
// expiresAt (battleIsOver) — the deploy's rule since P1b. An expired battle
// stays `active` until agent-evaluate completes it on its next weekday tick,
// so a battle-end review now fires at the expiry, not up to a weekend later.
//
// Pilot P1c — THE VOID UNWIND (founder ruling E3, 16 Oct 2026; spec Amendment
// E). A carrying battle that never ran — over (as above) with zero
// evaluations and no trades (battleNeverRan) — is not a deploy of the idea.
// The DEPLOY applies the same judge first (unwindVoidCarriage, called by
// carriage.js before it judges or carries an activated version), so the
// record ends the same whichever reaches the row first. For a row ARMED
// within the last REVIEW_VOID_TRADING_DAYS (3) trading days (horizon.js
// tradingDaysCutoffMs), the judge reads the row's battle and, when it never
// ran and the version is still `activated`, unwinds that carriage instead of
// any review transition:
//   · it was the ONLY carrying battle (deployedBattleIds is just it, or — for
//     a version activated before P1c wrote that list — lastDeployedBattleId
//     is it; either way firstDeployedAt is its createdAt) → the version returns to
//     `ready` (stateSource 'review_pass', stateReason 'deploy_voided') with
//     firstDeployedAt, reviewDueAt, lastDeployedAt, lastDeployedBattleId and
//     reviewClockFault cleared (null) and deployedBattleIds emptied; the row
//     is deleted — its clock never started;
//   · EARLIER carrying battles exist (the list names one before it) → this
//     id leaves deployedBattleIds, lastDeployedAt / lastDeployedBattleId point
//     at the previous battle (read in the same transaction for its
//     createdAt), and the row is re-armed to that battle with the SAME dueAtMs
//     (armedAt = its creation);
//   · a version with earlier battles its record cannot name, a void battle
//     that is not the newest carrying one, or a previous battle that cannot
//     be read → no unwind; the row is judged as before (counted
//     `voidUnresolved`).
// Judged once, in the row's own bounded transaction (fresh reads of the row,
// the version, the battle and — stepping back — the previous battle; the
// version must still be `activated`), like the pass's other transitions; a
// concurrent change (a redeploy re-arming the row, a player's move) makes the
// fresh read disagree and nothing is unwound. A battle with evaluations or
// trades is never unwound, and a row armed before the look-back is never read
// for it. The judge applies in EVERY phase (a due row whose battle never ran
// unwinds rather than flags); a THIRD phase, 'recent', reaches the rows the
// other two do not: timed rows armed within the look-back and not yet due —
// rows with armedAt >= the cutoff (armedAt ASC, __name__ ASC — the automatic
// single-field index, as the due phase) from its own persisted cursor
// `{ recentLastArmedAt, recentLastDocId }`. It runs last.
// The void writer is NOT in this repo: the one voided agent battle on record
// (Shadow, 14 Oct 2026) was voided by a one-off script (completionReason
// 'voided'); api/cron/agent-evaluate.js completes expired battles but voids
// none. The rule reads the battle's own state, whatever ended it.

import { withTimeout } from '../intraday/evaluatorHook.js';
import { hypothesisRecordsOnForAnyone, isHypothesisOwnerAllowlisted } from './gate.js';
import {
  STATE_REASONS, versionDocId, isVersionNumber, WATCHLISTS_COLLECTION, VERSIONS_SUBCOLLECTION,
  DEPLOYED_BATTLE_IDS_FIELD, carryingBattleIdsOf,
} from './model.js';
import { tradingDaysCutoffMs } from './horizon.js';

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
/** Pilot P1c (ruling E3): the look-back, in trading days, within which a carrying battle that never ran is unwound. */
export const REVIEW_VOID_TRADING_DAYS = 3;

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

/** A battle's own expiry instant (a Firestore Timestamp or an ISO string), or NaN. Pure. */
export function battleExpiresAtMs(battle) {
  const e = battle?.expiresAt;
  if (e && typeof e.toDate === 'function') return e.toDate().getTime();
  return typeof e === 'string' ? Date.parse(e) : NaN;
}

/**
 * Has a battle ended at `atMs`? Terminal, or past its own `expiresAt`: an
 * expired battle stays `active` until agent-evaluate completes it on its next
 * weekday tick (or the next deploy of its agent does), and it never runs
 * again meanwhile. ONE rule for the pass's battle-end review, the deploy's
 * judgment (carriage.js activatedReviewDue) and the review card's window
 * (review.js) — Pilot P1c review L2-3. Pure.
 */
export function battleIsOver(battle, atMs) {
  if (battleIsTerminal(battle)) return true;
  const exp = battleExpiresAtMs(battle);
  return isPlainObject(battle) && Number.isFinite(exp) && Number.isFinite(atMs) && exp <= atMs;
}

/**
 * Pilot P1c (ruling E3): did this battle never run? Over at `atMs`
 * (battleIsOver), with no evaluation on any of the battle's own counters (the
 * evaluations array, the cron's evalSeq, the score state's count) and no
 * trade. An expired battle is completed without a new evaluation
 * (agent-evaluate.js's expiry branch), so its count is final. Pure.
 */
export function battleNeverRan(battle, atMs) {
  if (!battleIsOver(battle, atMs)) return false;
  const evaluations = Math.max(
    Array.isArray(battle.evaluations) ? battle.evaluations.length : 0,
    finite(battle.cronState?.evalSeq) ? battle.cronState.evalSeq : 0,
    finite(battle.scoreState?.evaluationCount) ? battle.scoreState.evaluationCount : 0,
  );
  const trades = Array.isArray(battle.trades) ? battle.trades.length : 0;
  return evaluations === 0 && trades === 0;
}

/**
 * Pilot P1c (ruling E3): which unwind a never-ran carrying battle gets, from
 * the version's own record. Pure.
 * @returns {{ branch: 'only' } | { branch: 'previous', previousBattleId: string, remaining: string[] } | { unresolved: string }}
 */
export function voidBranchOf({ version, battleId, battle }) {
  const listed = Array.isArray(version?.[DEPLOYED_BATTLE_IDS_FIELD]) && version[DEPLOYED_BATTLE_IDS_FIELD].some(nonEmpty);
  if (!listed) {
    // Activated before P1c: the record names only the newest carrying battle.
    if (version?.lastDeployedBattleId !== battleId) return { unresolved: 'void_not_latest' };
    return nonEmpty(version.firstDeployedAt) && version.firstDeployedAt === battle?.createdAt
      ? { branch: 'only' } : { unresolved: 'void_previous_unknown' };
  }
  const ids = carryingBattleIdsOf(version);
  if (ids[ids.length - 1] !== battleId) return { unresolved: 'void_not_latest' };
  if (ids.length === 1) {
    // The clock restarts only when this battle IS the first deploy: a list seeded from a pre-P1c record, or
    // stepped back to a later battle, may hold one id while an earlier battle that ran stays unnamed (review L2-10).
    return nonEmpty(version.firstDeployedAt) && version.firstDeployedAt === battle?.createdAt
      ? { branch: 'only' } : { unresolved: 'void_previous_unknown' };
  }
  const remaining = ids.slice(0, -1);
  return { branch: 'previous', previousBattleId: remaining[remaining.length - 1], remaining };
}

/**
 * What the pass may do with one row, from FRESH reads. Pure.
 * `unwindFromMs` (Pilot P1c): rows armed at or after it are judged for the
 * void unwind first; the default reads no battle for it and unwinds nothing.
 * @returns {{ act: 'transition', reason: string } | { act: 'delete_stale' } | { act: 'skip', why: string }
 *   | { act: 'unwind', branch: 'only' } | { act: 'unwind', branch: 'previous', previousBattleId: string, remaining: string[] }}
 */
export function decideReview({ row, version, battle, nowMs, unwindFromMs = Infinity }) {
  if (!isPlainObject(version) || version.status !== 'activated') return { act: 'delete_stale' };
  let voidUnresolved = null;
  if (finite(row.armedAt) && row.armedAt >= unwindFromMs && isPlainObject(battle) && battleNeverRan(battle, nowMs)) {
    const v = voidBranchOf({ version, battleId: row.battleId, battle });
    if (!v.unresolved) return { act: 'unwind', ...v };
    voidUnresolved = v.unresolved; // judged as before
  }
  const d = decideTimedOrBattleEnd({ row, battle, nowMs });
  return voidUnresolved ? { ...d, voidUnresolved } : d;
}

function decideTimedOrBattleEnd({ row, battle, nowMs }) {
  if (finite(row.dueAtMs)) {
    return nowMs >= row.dueAtMs ? { act: 'transition', reason: STATE_REASONS.horizonElapsed } : { act: 'skip', why: 'not_due' };
  }
  if (battle === null) return { act: 'skip', why: 'battle_missing' };
  return battleIsOver(battle, nowMs) ? { act: 'transition', reason: STATE_REASONS.battleEnded } : { act: 'skip', why: 'battle_live' };
}

/** The previous carrying battle a step-back points at, read on the caller's transaction; null when it cannot anchor the record. */
async function previousBattleInTx(tx, db, battleId) {
  const snap = await tx.get(db.collection('agentBattles').doc(battleId));
  const prev = snap?.exists ? snap.data() : null;
  return prev && nonEmpty(prev.createdAt) && Number.isFinite(Date.parse(prev.createdAt)) ? prev : null;
}

/**
 * Pilot P1c (ruling E3): the unwind's writes, buffered on the caller's
 * transaction — the ONE writer the pass (reviewOne) and the deploy
 * (unwindVoidCarriage) share. `only`: that battle never ran, so this was
 * never a deploy — Ready again, the clock never started, the row deleted.
 * `previous`: an earlier carrying battle ran — the record points back at it,
 * the row is re-armed to it with the SAME dueAtMs (armedAt = its creation),
 * the clock untouched.
 */
function writeUnwindInTx(tx, db, { rowRef, versionRef, row, d, previous, nowIso, source }) {
  if (d.branch === 'only') {
    tx.update(versionRef, {
      status: 'ready', stateChangedAt: nowIso, stateSource: source, stateReason: STATE_REASONS.deployVoided,
      firstDeployedAt: null, reviewDueAt: null, lastDeployedAt: null, lastDeployedBattleId: null,
      reviewClockFault: null, [DEPLOYED_BATTLE_IDS_FIELD]: [],
    });
    tx.delete(rowRef);
    return;
  }
  tx.update(versionRef, {
    [DEPLOYED_BATTLE_IDS_FIELD]: d.remaining, lastDeployedAt: previous.createdAt, lastDeployedBattleId: d.previousBattleId,
  });
  armReviewRow(tx, db, {
    userId: row.userId, watchlistId: row.watchlistId, version: row.version, battleId: d.previousBattleId,
    dueAtMs: row.dueAtMs, armedAt: Date.parse(previous.createdAt),
  });
}

/**
 * Pilot P1c (ruling E3; review L2-1 / L4-4): the void unwind as the DEPLOY
 * applies it, before it judges or carries an activated version — whichever
 * of the pass and the next deploy reaches a carrying battle that never ran
 * first, the record ends the same. ONE transaction: fresh reads of the row,
 * the version and the row's battle (and, stepping back, the previous
 * battle); the pass's own decision (decideReview) and writer
 * (writeUnwindInTx), stamped with the caller's `source`.
 *
 * @returns {Promise<'only' | 'previous' | 'kept' | 'moved'>} `kept`: no
 *   unwind (the fresh reads say the battle ran, or the step-back cannot be
 *   anchored) — judge the version as before; `moved`: the version is no
 *   longer `activated`, or its row is gone.
 */
export async function unwindVoidCarriage(db, { watchlistId, version, nowMs, unwindFromMs, source }) {
  const rowRef = reviewRowRef(db, watchlistId, version);
  const versionRef = versionRefOf(db, watchlistId, version);
  return db.runTransaction(async (tx) => {
    const [rowSnap, versionSnap] = await tx.getAll(rowRef, versionRef);
    const row = rowSnap?.exists ? normalizeReviewRow(rowSnap.data()) : null;
    const fresh = versionSnap?.exists ? versionSnap.data() : null;
    if (!row || fresh?.status !== 'activated') return 'moved';
    const battleSnap = await tx.get(db.collection('agentBattles').doc(row.battleId));
    const battle = battleSnap?.exists ? battleSnap.data() : null;
    const d = decideReview({ row, version: fresh, battle, nowMs, unwindFromMs });
    if (d.act !== 'unwind') return 'kept';
    let previous = null;
    if (d.branch === 'previous') {
      previous = await previousBattleInTx(tx, db, d.previousBattleId);
      if (!previous) return 'kept';
    }
    writeUnwindInTx(tx, db, { rowRef, versionRef, row, d, previous, nowIso: new Date(nowMs).toISOString(), source });
    return d.branch;
  });
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

/** One row: fresh reads, then a transition + delete, an unwind (P1c), a stale delete, or nothing. */
async function reviewOne({ db, rowId, row, nowMs, nowIso, deadlineMs, unwindFromMs = Infinity }) {
  const rowRef = db.collection(REVIEW_QUEUE_COLLECTION).doc(rowId);
  const versionRef = versionRefOf(db, row.watchlistId, row.version);
  return boundedTx(db, deadlineMs, 'hypothesis_review', async (tx, attemptDeadlineMs) => {
    const [rowSnap, versionSnap] = await tx.getAll(rowRef, versionRef);
    if (!rowSnap?.exists) return { result: 'skipped', why: 'row_gone' };
    const fresh = normalizeReviewRow(rowSnap.data());
    if (!fresh) return { result: 'skipped', why: 'malformed' };
    const version = versionSnap?.exists ? versionSnap.data() : null;
    let battle;
    // A battle-end row always reads its battle; P1c: a row armed within the look-back reads it for the unwind too.
    const armedRecently = finite(fresh.armedAt) && fresh.armedAt >= unwindFromMs;
    if (version?.status === 'activated' && (!finite(fresh.dueAtMs) || armedRecently)) {
      const battleSnap = await tx.get(db.collection('agentBattles').doc(fresh.battleId));
      battle = battleSnap?.exists ? battleSnap.data() : null;
    }
    let d = decideReview({ row: fresh, version, battle, nowMs, unwindFromMs });
    let previous = null;
    if (d.act === 'unwind' && d.branch === 'previous') {
      previous = await previousBattleInTx(tx, db, d.previousBattleId);
      // A step-back that cannot be anchored is no unwind: the row is judged as before (review L2-5).
      if (!previous) d = { ...decideTimedOrBattleEnd({ row: fresh, battle, nowMs }), voidUnresolved: 'void_previous_missing' };
    }
    if (d.act === 'skip') return { result: 'skipped', why: d.why, voidUnresolved: d.voidUnresolved ?? null };
    if (Date.now() >= attemptDeadlineMs) throw new ReviewAbort('deadline');
    if (d.act === 'delete_stale') {
      tx.delete(rowRef);
      return { result: 'stale_deleted' };
    }
    if (d.act === 'unwind') {
      writeUnwindInTx(tx, db, { rowRef, versionRef, row: fresh, d, previous, nowIso, source: REVIEW_SOURCE });
      return { result: 'unwound', branch: d.branch };
    }
    tx.update(versionRef, { status: 'review_due', stateChangedAt: nowIso, stateSource: REVIEW_SOURCE, stateReason: d.reason });
    tx.delete(rowRef);
    return { result: 'transitioned', reason: d.reason, voidUnresolved: d.voidUnresolved ?? null };
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
  // Pilot P1c (ruling E3): the void unwind's look-back. A calendar that cannot place it unwinds nothing this tick.
  let unwindFromMs = Infinity;
  try {
    unwindFromMs = tradingDaysCutoffMs(nowMs, REVIEW_VOID_TRADING_DAYS);
  } catch {
    summary.voidLookback = 'calendar_unavailable';
  }
  // P1c's void counters appear only when something happened. (The 'recent' phase still reads, and counts in
  // `rows` / `notDue`, each recently armed timed row it visits — one transaction per row per tick.)
  const bump = (key) => { summary[key] = (summary[key] || 0) + 1; };
  const tally = (res) => {
    if (res.voidUnresolved) bump('voidUnresolved');
    if (res.result === 'transitioned') summary[res.reason === STATE_REASONS.horizonElapsed ? 'horizonElapsed' : 'battleEnded'] += 1;
    else if (res.result === 'unwound') bump(res.branch === 'only' ? 'voidUnwound' : 'voidSteppedBack');
    else if (res.result === 'stale_deleted') summary.staleDeleted += 1;
    else if (res.result === 'unconfirmed') summary.unconfirmed += 1;
    else if (res.result === 'failed') summary.failed += 1;
    else if (res.result === 'skipped') {
      const key = { not_due: 'notDue', battle_live: 'battleLive', battle_missing: 'battleMissing', malformed: 'malformed' }[res.why];
      if (key) summary[key] += 1;
    }
    return res.result === 'not_started';
  };
  // Each row is judged at most once per pass: the P1c 'recent' phase passes over rows a phase before it judged.
  const visited = new Set();
  /**
   * One page's rows; returns { cut, last, size }. `notYetDueOnly` (the P1c 'recent' phase): a due row or a
   * battle-end row is passed over — the phases above reach it, with the same judge.
   */
  const walk = async (docs, { notYetDueOnly = false } = {}) => {
    let last = null;
    for (const doc of docs) {
      if (Date.now() >= deadlineMs) return { cut: true, last };
      if (visited.has(doc.id)) { last = doc; continue; }
      if (notYetDueOnly) {
        const due = doc.data()?.dueAtMs;
        if (!finite(due) || due <= nowMs) { last = doc; continue; }
      }
      visited.add(doc.id);
      summary.rows += 1;
      const row = normalizeReviewRow(doc.data());
      if (!row) { summary.malformed += 1; last = doc; continue; }
      if (!isHypothesisOwnerAllowlisted(row.userId)) { summary.skippedOff += 1; last = doc; continue; }
      const res = await reviewOne({ db, rowId: doc.id, row, nowMs, nowIso, deadlineMs, unwindFromMs });
      if (tally(res)) return { cut: true, last };
      last = doc;
    }
    return { cut: false, last };
  };

  let cursorId = null;
  let cursorAfter = null;
  let dueBefore = null;
  let dueAfter = null;
  let recentBefore = null;
  let recentAfter = null;
  let stateRead = false;
  try {
    // The cursors, one document: { dueLastDueAtMs, dueLastDocId } for the 'due' phase,
    // { lastDocId } for the 'unspecified' phase and (P1c) { recentLastArmedAt, recentLastDocId } for the
    // 'recent' phase. Each wraps to the start on a short page.
    const stateSnap = await withTimeout(reviewStateRef(db).get(), Math.max(1, deadlineMs - Date.now()), 'hypothesis_review_cursor');
    const state = stateSnap?.exists && isPlainObject(stateSnap.data()) ? stateSnap.data() : {};
    stateRead = true;
    cursorId = nonEmpty(state.lastDocId) ? state.lastDocId : null;
    dueBefore = finite(state.dueLastDueAtMs) && nonEmpty(state.dueLastDocId) ? { dueAtMs: state.dueLastDueAtMs, id: state.dueLastDocId } : null;
    recentBefore = finite(state.recentLastArmedAt) && nonEmpty(state.recentLastDocId) ? { armedAt: state.recentLastArmedAt, id: state.recentLastDocId } : null;
    summary.cursorBefore = cursorId;
    summary.dueCursorBefore = dueBefore;
    cursorAfter = cursorId;
    dueAfter = dueBefore;
    recentAfter = recentBefore;

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

    // Phase 'recent' (Pilot P1c, ruling E3) — rows armed within the look-back that the two phases above do
    // not reach (a timed row not yet due), from its persisted cursor; the judge unwinds one whose battle never
    // ran. Last, so it never delays a due review.
    if (!summary.cut && Number.isFinite(unwindFromMs)) {
      for (;;) {
        if (Date.now() >= deadlineMs) { summary.cut = true; break; }
        let q = db.collection(REVIEW_QUEUE_COLLECTION).where('armedAt', '>=', unwindFromMs).orderBy('armedAt', 'asc').orderBy('__name__', 'asc');
        if (recentAfter) q = q.startAfter(recentAfter.armedAt, recentAfter.id);
        const page = await withTimeout(q.limit(REVIEW_PAGE).get(), Math.max(1, deadlineMs - Date.now()), 'hypothesis_review_recent_page');
        const docs = page?.docs || [];
        const { cut, last } = await walk(docs, { notYetDueOnly: true });
        if (last) recentAfter = { armedAt: last.data().armedAt, id: last.id };
        if (cut) { summary.cut = true; break; }
        if (docs.length < REVIEW_PAGE) { recentAfter = null; break; }
      }
    }
  } catch (err) {
    summary.stopped = isTimeout(err) ? 'deadline' : 'threw';
    summary.error = String(err?.message || err).slice(0, 200);
  }

  // The cursors, written only when one moved (no write in the steady empty state, none if the state was never read).
  const dueMoved = JSON.stringify(dueAfter) !== JSON.stringify(dueBefore);
  const recentMoved = JSON.stringify(recentAfter) !== JSON.stringify(recentBefore);
  if (stateRead && (cursorAfter !== cursorId || dueMoved || recentMoved)) {
    try {
      await withTimeout(reviewStateRef(db).set({
        lastDocId: cursorAfter,
        dueLastDueAtMs: dueAfter ? dueAfter.dueAtMs : null,
        dueLastDocId: dueAfter ? dueAfter.id : null,
        // P1c: present only while the 'recent' cursor is mid-way (a set replaces the document, so a wrap clears it).
        ...(recentAfter ? { recentLastArmedAt: recentAfter.armedAt, recentLastDocId: recentAfter.id } : {}),
        updatedAt: nowMs,
      }), Math.max(250, deadlineMs - Date.now()), 'hypothesis_review_cursor_write');
    } catch (err) {
      summary.cursorWrite = isTimeout(err) ? 'unconfirmed' : 'failed';
    }
  }
  summary.cursorAfter = cursorAfter;
  summary.dueCursorAfter = dueAfter;
  if (recentBefore || recentAfter) { summary.recentCursorBefore = recentBefore; summary.recentCursorAfter = recentAfter; }
  summary.ms = Date.now() - nowMs;
  console.log(`[hypothesis] review ${JSON.stringify(summary)}`);
  return summary;
}
