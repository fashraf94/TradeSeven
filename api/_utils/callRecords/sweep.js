// api/_utils/callRecords/sweep.js
//
// Cockpit Build 1a — THE SWEEP (spec docs/COCKPIT_BUILD1A_SPEC_V1_2.md §8;
// contract V1.4 §9 H2 as amended by Amendment B §7, §10). Runs LAST in
// api/cron/process-pending-reflections.js, after the reflections, the Wire
// sweep and the editorial, with `deadline = min(now + 20 s, handlerStart + 45 s)`.
//
// THE GLOBAL GATE. At global 'off' and at 'shadow' the branch returns BEFORE
// any read: a battle can resolve 'on' only under global 'on' (spec §3), and
// every transition below needs resolved 'on'. At global 'on' with an owner
// off the allowlist (per-owner off) the sweep reads the battle's queue row
// and its parent document to discover and skip it, and touches nothing else
// for it — the one explicit exception Amendment B §10 records; its call,
// declaration, receipt and event records stay frozen.
//
// THE QUEUE `callSweepQueue/{battleId}` = { battleId, nextExpiresAt, pendingHeard,
// updatedAt } (legacy Build 0 rows normalized on read, queue.js). TRAVERSAL
// (spec §8): nextExpiresAt ASC NULLS LAST, __name__ ASC, as three cursor
// phases persisted in `callSweepState/singleton` = { lastNextExpiresAt,
// lastDocId, phase }: 'due' (finite nextExpiresAt, ascending), 'nullOnly'
// (null nextExpiresAt, by id), 'reconcile' (page agentBattles by expiresAt
// over the last 7 days — the automatic single-field index — and enroll any
// open call lacking a queue row), then a deterministic wrap to 'due'. Frozen
// and off rows advance the cursor. The queue's two queries use the automatic
// single-field index on nextExpiresAt (declared in firestore.indexes.json).
//
// TRANSITIONS, per battle at resolved 'on', each in ONE transaction with
// FRESH reads of the parent, the call, the receipt and the queue, each event
// created in that same transaction (spec §10):
//   · terminal parent → every open call `ended_with_battle` (hit outcomes
//     preserved — only OPEN calls move); completion itself writes nothing to
//     calls (completeBattle is untouched — Amendment B §7);
//   · this_session / this_battle / explicit past the deadline → expired_unresolved;
//   · next_check → expired_unresolved with reason 'unobserved' ONLY when the
//     regular ET session containing the slot has closed (maintenanceNowMs >=
//     session.closeMs — early closes honored, the next session when the slot
//     falls there) and the call is still open under a fresh ACTIVE parent;
//     a calendar that cannot resolve the slot leaves the call and logs (H2:
//     the sweep never expires a next_check call mechanically at its slot);
//   · sweep receipts carry the FULL receipt shape with source 'sweep', px
//     null, evalId null, observedAtMs = the maintenance instant, and `reason`;
//   · heard repair for `pendingHeard`: the retained evaluations[] scanned for
//     the exact unsuppressed thread at or after the answer; stamped only if
//     null (first-confirmed), with the heard event; not found → "not confirmed
//     heard" (nothing written); TICK_STAMPS_ENABLED false → never;
//   · a call-family slot past its lifetime → compare-and-clear retirement.
// The queue row is deleted ONLY when nextExpiresAt is null and pendingHeard is
// empty, inside a transaction that re-read it (a stale pass cannot delete new
// work).
//
// BUDGET: every query and transaction is bounded; the deadline is rechecked
// before each write; a timed-out attempt is UNCONFIRMED (it may commit late —
// the next pass re-reads); best-effort progress, and the observable
// starvation condition is logged (`[calls] sweep starved`) when the branch
// gets < 2 s. Never throws.

import { withTimeout } from '../intraday/evaluatorHook.js';
import { TICK_STAMPS_ENABLED } from '../../../src/config/featureFlags.js';
import { resolveCallRecordsMode, resolveGlobalCallRecordsMode } from './mode.js';
import { sessionCloseAfter } from './horizon.js';
import { buildReceipt, receiptPathOf } from './receipt.js';
import { buildCallEvent, createCallEvent } from './events.js';
import { renderExpiredEvent, renderEndedWithBattleEvent, renderHeardEvent, renderAnswerExpiredLine, checkLabel } from './copy.js';
import { queueRef, sweepStateRef, normalizeQueueRow, QUEUE_COLLECTION } from './queue.js';
import { directiveRecordOf } from './threads.js';
import { CallsAbort, isCallsTimeout } from './publish.js';
import { isCallDirective } from '../directiveUtils.js';
import { retireCallDirective } from '../directiveWriter.js';

export const SWEEP_BRANCH_MS = 20_000;
export const SWEEP_HANDLER_CAP_MS = 45_000;
export const SWEEP_STARVATION_MS = 2_000;
export const SWEEP_PAGE = 20;
export const SWEEP_RECONCILE_PAGE = 25;
export const SWEEP_RECONCILE_LOOKBACK_MS = 7 * 86_400_000;
export const SWEEP_TX_MS = 1_500;
export const OPEN_CALLS_PAGE = 50;
export const SWEEP_PHASES = Object.freeze(['due', 'nullOnly', 'reconcile']);
export const SWEEP_SOURCE = 'sweep';

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const nonEmpty = (v) => typeof v === 'string' && v.length > 0;
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** The branch's deadline: min(now + 20 s, handlerStart + 45 s). */
export function sweepDeadline({ nowMs, handlerStartMs }) {
  return Math.min(nowMs + SWEEP_BRANCH_MS, handlerStartMs + SWEEP_HANDLER_CAP_MS);
}

/** The cursor as read (defaults: phase 'due', nothing consumed). */
export function normalizeSweepState(data) {
  const d = isPlainObject(data) ? data : {};
  return {
    phase: SWEEP_PHASES.includes(d.phase) ? d.phase : 'due',
    lastNextExpiresAt: finite(d.lastNextExpiresAt) || nonEmpty(d.lastNextExpiresAt) ? d.lastNextExpiresAt : null,
    lastDocId: nonEmpty(d.lastDocId) ? d.lastDocId : null,
  };
}

/** The phase after `phase`, with the cursor reset (the deterministic wrap). */
export function nextPhase(phase) {
  const i = SWEEP_PHASES.indexOf(phase);
  return SWEEP_PHASES[(i + 1) % SWEEP_PHASES.length];
}

/**
 * The H2 cutoff for a next_check call: the close of the regular ET session
 * containing the slot (the next session when the slot falls outside one).
 * @returns {{ closeMs: number } | { reason: 'calendar_unavailable' }}
 */
export function nextCheckCutoff(slotMs) {
  return sessionCloseAfter(slotMs);
}

/**
 * What the maintenance instant proves for an OPEN call under an ACTIVE parent:
 *   { next: 'expired_unresolved', reason } | { next: null, reason? }
 */
export function decideSweepExpiry(call, nowMs) {
  const expiresAt = call?.horizon?.expiresAt;
  if (!finite(expiresAt)) return { next: null, reason: 'no_deadline' };
  if (call.horizon.basis === 'next_check') {
    const cutoff = nextCheckCutoff(expiresAt);
    if ('reason' in cutoff) return { next: null, reason: 'calendar_unresolvable' };
    return nowMs >= cutoff.closeMs ? { next: 'expired_unresolved', reason: 'unobserved' } : { next: null, reason: 'before_session_close' };
  }
  return nowMs > expiresAt ? { next: 'expired_unresolved', reason: 'past_deadline' } : { next: null, reason: 'before_deadline' };
}

/** The sweep's receipt: the full shape, source 'sweep', px null, evalId null, the maintenance instant, the reason. */
export function buildSweepReceipt(call, nowMs, reason) {
  return { ...buildReceipt({ call, evalId: null, observation: { observedAtMs: nowMs, source: SWEEP_SOURCE, symbols: {} } }), reason };
}

/**
 * Heard repair (spec §7, §8): the earliest retained evaluation whose
 * UNSUPPRESSED heard stamp names the answer's thread at or after the answer
 * was filed. Null → "not confirmed heard".
 */
export function findHeardEvaluation(evaluations, { directiveThreadId, filedAt }) {
  if (!TICK_STAMPS_ENABLED) return null;
  const list = Array.isArray(evaluations) ? evaluations : [];
  const filedMs = Date.parse(filedAt ?? '');
  for (const e of list) {
    const h = e?.heard;
    if (!isPlainObject(h) || h.directiveThreadId !== directiveThreadId || h.suppressed !== null) continue;
    const built = Date.parse(e.promptBuiltAt ?? '');
    if (finite(filedMs) && finite(built) && built < filedMs) continue;
    if (!nonEmpty(e.evalId)) continue;
    return e;
  }
  return null;
}

/** Is there any retained check whose prompt was built after the directive's lifetime ended? Then no later check can hear it. */
function noLaterCheckCanHear(evaluations, lifetimeEndMs) {
  if (!finite(lifetimeEndMs)) return false;
  const list = Array.isArray(evaluations) ? evaluations : [];
  return list.some((e) => { const built = Date.parse(e?.promptBuiltAt ?? ''); return finite(built) && built > lifetimeEndMs; });
}

// ---------------------------------------------------------------------------

async function boundedTx(db, deadlineMs, label, body) {
  const budgetMs = Math.min(SWEEP_TX_MS, deadlineMs - Date.now());
  if (budgetMs <= 0) return { result: 'not_started' };
  const attemptDeadlineMs = Date.now() + budgetMs;
  try {
    return await withTimeout(db.runTransaction(async (tx) => {
      if (Date.now() >= attemptDeadlineMs) throw new CallsAbort('deadline');
      return body(tx, attemptDeadlineMs);
    }), budgetMs, label);
  } catch (err) {
    if (err?.callsAbort === 'deadline' || isCallsTimeout(err)) return { result: 'unconfirmed' };
    const error = String(err?.message || err).slice(0, 200);
    console.error(`[calls] sweep ${label} failed: ${error}`);
    return { result: 'failed', error };
  }
}

/** One call's transition (terminal rule or expiry). Fresh reads; create-once receipt and event. */
async function transitionOne({ db, battleId, callId, nowMs, deadlineMs, mode }) {
  const battleRef = db.collection('agentBattles').doc(battleId);
  const callRef = battleRef.collection('calls').doc(callId);
  const receiptRef = battleRef.collection('callObservations').doc(callId);
  return boundedTx(db, deadlineMs, 'calls_sweep_transition', async (tx, attemptDeadlineMs) => {
    const [callSnap, parentSnap, receiptSnap] = await tx.getAll(callRef, battleRef, receiptRef);
    if (!callSnap?.exists) return { result: 'skipped', reason: 'missing' };
    const call = callSnap.data();
    if (call.state !== 'open') return { result: 'skipped', reason: 'not_open' };
    const parent = parentSnap?.exists ? parentSnap.data() : null;
    if (!parent) return { result: 'skipped', reason: 'parent_missing' };
    if (resolveCallRecordsMode(parent) !== 'on') return { result: 'skipped', reason: 'parent_off' };
    if (receiptSnap?.exists) return { result: 'skipped', reason: 'receipt_exists' };
    let next; let reason;
    if (parent.status !== 'active') { next = 'ended_with_battle'; reason = 'battle_ended'; } else {
      const d = decideSweepExpiry(call, nowMs);
      if (!d.next) return { result: 'skipped', reason: d.reason };
      next = d.next; reason = d.reason;
    }
    if (Date.now() >= attemptDeadlineMs) throw new CallsAbort('deadline');
    const receipt = buildSweepReceipt(call, nowMs, reason);
    tx.create(receiptRef, receipt);
    tx.update(callRef, { state: next, stateChangedAt: nowMs, stateSource: SWEEP_SOURCE, outcome: { ...(isPlainObject(call.outcome) ? call.outcome : {}), receiptRef: receiptPathOf(battleId, callId) } });
    const lines = [next === 'ended_with_battle' ? renderEndedWithBattleEvent() : renderExpiredEvent({ reason })];
    const pr = call.playerResponse;
    if (next !== 'ended_with_battle' && pr?.kind === 'directive' && pr.heardEvalId == null) {
      const lifetime = directiveRecordOf(parent, pr.directiveThreadId)?.expiresAtMs;
      if (finite(lifetime) && lifetime < nowMs) lines.push(renderAnswerExpiredLine({ promptBuiltAt: null }));
    }
    createCallEvent(tx, db, battleId, {
      kind: next === 'ended_with_battle' ? 'ended_with_battle' : 'expired',
      idParams: { callId },
      event: buildCallEvent({ kind: next === 'ended_with_battle' ? 'ended_with_battle' : 'expired', at: nowMs, callIds: [callId], text: lines.join(' · '), evidence: {}, extra: { source: SWEEP_SOURCE, reason } }),
    });
    void mode;
    return { result: 'transitioned', next, reason };
  });
}

/** Heard repair for one pending call. */
async function repairHeardOne({ db, battleId, callId, parent, nowMs, deadlineMs }) {
  const battleRef = db.collection('agentBattles').doc(battleId);
  const callRef = battleRef.collection('calls').doc(callId);
  return boundedTx(db, deadlineMs, 'calls_sweep_heard', async (tx, attemptDeadlineMs) => {
    const callSnap = await tx.get(callRef);
    if (!callSnap?.exists) return { result: 'settled', reason: 'missing' };
    const call = callSnap.data();
    const pr = call.playerResponse;
    if (!isPlainObject(pr) || pr.kind !== 'directive' || !nonEmpty(pr.directiveThreadId)) return { result: 'settled', reason: 'no_directive_answer' };
    if (pr.heardEvalId != null) return { result: 'settled', reason: 'already_stamped' };
    const entry = findHeardEvaluation(parent?.evaluations, { directiveThreadId: pr.directiveThreadId, filedAt: pr.filedAt });
    if (!entry) {
      const lifetime = directiveRecordOf(parent, pr.directiveThreadId)?.expiresAtMs;
      const terminal = call.state !== 'open';
      // Not confirmed heard: settled only once no later check can hear it and the call is terminal.
      if (terminal && noLaterCheckCanHear(parent?.evaluations, lifetime)) return { result: 'settled', reason: 'not_confirmed_heard' };
      return { result: 'pending', reason: TICK_STAMPS_ENABLED ? 'not_found' : 'stamps_disabled' };
    }
    if (Date.now() >= attemptDeadlineMs) throw new CallsAbort('deadline');
    tx.update(callRef, { 'playerResponse.heardEvalId': entry.evalId });
    createCallEvent(tx, db, battleId, {
      kind: 'heard',
      idParams: { callId, evalId: entry.evalId },
      event: buildCallEvent({ kind: 'heard', at: nowMs, callIds: [callId], text: renderHeardEvent({ promptBuiltAt: entry.promptBuiltAt }), evidence: { evalId: entry.evalId, promptBuiltAt: entry.promptBuiltAt ?? null, checkLabel: checkLabel(entry.promptBuiltAt) }, extra: { source: SWEEP_SOURCE } }),
    });
    return { result: 'repaired', evalId: entry.evalId };
  });
}

/**
 * The queue row's settlement after a battle's pass: RE-READ in the transaction,
 * recompute, delete only when empty. Work enrolled since this pass read the
 * row — the endpoint's pendingHeard additions, a publication's newer
 * nextExpiresAt — is detected by comparing the fresh row to the row as read
 * (never by timestamps, which collide within a millisecond) and merged in, so
 * a stale pass cannot delete new work.
 */
async function settleQueueRow({ db, battleId, rowAsRead = null, nextExpiresAt, pendingHeard, settled = new Set(), nowMs, deadlineMs }) {
  return boundedTx(db, deadlineMs, 'calls_sweep_queue', async (tx, attemptDeadlineMs) => {
    const snap = await tx.get(queueRef(db, battleId));
    const fresh = normalizeQueueRow(snap?.exists ? snap.data() : null, battleId);
    const asRead = normalizeQueueRow(rowAsRead, battleId);
    const changed = JSON.stringify([fresh.nextExpiresAt, fresh.pendingHeard]) !== JSON.stringify([asRead.nextExpiresAt, asRead.pendingHeard]);
    const ourNext = finite(nextExpiresAt) ? nextExpiresAt : null;
    const heard = changed
      ? [...new Set([...pendingHeard, ...fresh.pendingHeard.filter((id) => !settled.has(id))])]
      : [...pendingHeard];
    const next = changed && finite(fresh.nextExpiresAt) ? (ourNext === null ? fresh.nextExpiresAt : Math.min(ourNext, fresh.nextExpiresAt)) : ourNext;
    if (Date.now() >= attemptDeadlineMs) throw new CallsAbort('deadline');
    if (next === null && heard.length === 0) {
      if (snap?.exists) tx.delete(queueRef(db, battleId));
      return { result: 'deleted' };
    }
    tx.set(queueRef(db, battleId), { battleId, nextExpiresAt: next, pendingHeard: heard, updatedAt: nowMs }, { merge: true });
    return { result: 'kept', nextExpiresAt: next, pendingHeard: heard };
  });
}

/** Retire a call-family slot past its lifetime (compare-and-clear on the fresh parent). */
async function retirePastLifetime({ db, battleId, slot, nowMs, deadlineMs }) {
  if (!isCallDirective(slot) || !finite(slot.expiresAtMs) || slot.expiresAtMs >= nowMs) return { result: 'skipped' };
  const battleRef = db.collection('agentBattles').doc(battleId);
  return boundedTx(db, deadlineMs, 'calls_sweep_retire', async (tx, attemptDeadlineMs) => {
    const snap = await tx.get(battleRef);
    const fresh = snap?.exists ? snap.data() : null;
    if (Date.now() >= attemptDeadlineMs) throw new CallsAbort('deadline');
    const cleared = fresh ? retireCallDirective(tx, battleRef, fresh, { directiveThreadId: slot.directiveThreadId, answerId: slot.answerId }) : false;
    return { result: cleared ? 'retired' : 'skipped' };
  });
}

/** The open calls of a parent, oldest first (the existing composite). */
async function openCallsOf(db, battleId, deadlineMs) {
  const q = db.collection('agentBattles').doc(battleId).collection('calls').where('state', '==', 'open').orderBy('mintedAt', 'asc').orderBy('__name__', 'asc').limit(OPEN_CALLS_PAGE);
  const page = await withTimeout(q.get(), Math.max(1, deadlineMs - Date.now()), 'calls_sweep_open');
  return (page?.docs || []).map((d) => d.data());
}

/**
 * One battle's pass (resolved 'on' only — the caller checked). Returns the
 * counts and whether the deadline cut it short.
 */
async function sweepBattle({ db, battleId, parent, row, nowMs, deadlineMs, summary }) {
  const tally = (k, n = 1) => { summary[k] = (summary[k] || 0) + n; };
  const note = (res) => {
    if (res.result === 'unconfirmed') tally('unconfirmed');
    else if (res.result === 'failed') tally('failed');
    return res.result === 'not_started';
  };
  // 1. Transitions over the open calls.
  let open;
  try { open = await openCallsOf(db, battleId, deadlineMs); } catch (err) { tally(isCallsTimeout(err) ? 'unconfirmed' : 'failed'); return { cut: true }; }
  const remainingOpen = [];
  for (const call of open) {
    if (Date.now() >= deadlineMs) return { cut: true };
    const terminal = parent.status !== 'active';
    const decision = terminal ? { next: 'ended_with_battle' } : decideSweepExpiry(call, nowMs);
    if (!decision.next) {
      if (decision.reason === 'calendar_unresolvable') { tally('calendarUnresolvable'); console.log(`[calls] sweep calendar unresolvable battle=${battleId} call=${call.callId} slot=${call.horizon?.expiresAt}`); }
      remainingOpen.push(call);
      continue;
    }
    const res = await transitionOne({ db, battleId, callId: call.callId, nowMs, deadlineMs, mode: 'on' });
    if (note(res)) return { cut: true };
    if (res.result === 'transitioned') tally(res.next === 'ended_with_battle' ? 'ended' : 'expired');
    else if (res.result !== 'skipped') remainingOpen.push(call);
    else if (res.reason !== 'not_open' && res.reason !== 'receipt_exists') remainingOpen.push(call);
  }
  // 2. Heard repair for the pending answers.
  const stillPending = [];
  const settled = new Set();
  for (const callId of row.pendingHeard) {
    if (Date.now() >= deadlineMs) return { cut: true };
    const res = await repairHeardOne({ db, battleId, callId, parent, nowMs, deadlineMs });
    if (note(res)) return { cut: true };
    if (res.result === 'repaired') { tally('heardRepaired'); settled.add(callId); }
    else if (res.result === 'settled') { tally('heardSettled'); settled.add(callId); }
    else stillPending.push(callId);
  }
  // 3. Retirement of a call-family slot past its lifetime.
  const retire = await retirePastLifetime({ db, battleId, slot: parent.directive, nowMs, deadlineMs });
  if (note(retire)) return { cut: true };
  if (retire.result === 'retired') tally('retired');
  // 4. The queue row: the minimum remaining finite expiry (a full page keeps its own minimum), the pending set; delete only when empty.
  const expiries = remainingOpen.map((c) => c.horizon?.expiresAt).filter(finite);
  const nextExpiresAt = expiries.length ? Math.min(...expiries) : null;
  const queue = await settleQueueRow({ db, battleId, rowAsRead: row, nextExpiresAt, pendingHeard: stillPending, settled, nowMs, deadlineMs });
  if (note(queue)) return { cut: true };
  if (queue.result === 'deleted') tally('deleted');
  return { cut: false };
}

/** Enroll a battle's open calls that lack a queue row (the reconciliation route). */
async function reconcileBattle({ db, battleId, nowMs, deadlineMs, summary }) {
  let open;
  try { open = await openCallsOf(db, battleId, deadlineMs); } catch { summary.failed = (summary.failed || 0) + 1; return { cut: true }; }
  if (open.length === 0) return { cut: false };
  const expiries = open.map((c) => c.horizon?.expiresAt).filter(finite);
  if (expiries.length === 0) return { cut: false };
  const res = await boundedTx(db, deadlineMs, 'calls_sweep_enroll', async (tx, attemptDeadlineMs) => {
    const snap = await tx.get(queueRef(db, battleId));
    if (snap?.exists) return { result: 'present' };
    if (Date.now() >= attemptDeadlineMs) throw new CallsAbort('deadline');
    tx.set(queueRef(db, battleId), { battleId, nextExpiresAt: Math.min(...expiries), pendingHeard: [], updatedAt: nowMs }, { merge: true });
    return { result: 'enrolled' };
  });
  if (res.result === 'enrolled') summary.enrolled = (summary.enrolled || 0) + 1;
  if (res.result === 'unconfirmed') summary.unconfirmed = (summary.unconfirmed || 0) + 1;
  if (res.result === 'failed') summary.failed = (summary.failed || 0) + 1;
  return { cut: res.result === 'not_started' };
}

/**
 * THE SWEEP. Never throws.
 *
 * @param {{ db: object, handlerStartMs: number, nowMs?: number }} p
 */
export async function runCallSweep({ db, handlerStartMs, nowMs = Date.now() }) {
  const global = resolveGlobalCallRecordsMode();
  if (global !== 'on') return { skipped: global, reads: 0 };
  const deadlineMs = sweepDeadline({ nowMs, handlerStartMs });
  const summary = { skipped: null, starved: false, deadlineMs, availableMs: deadlineMs - nowMs, phaseBefore: null, phaseAfter: null, rows: 0, skippedOff: 0, cut: false };
  if (deadlineMs - nowMs < SWEEP_STARVATION_MS) {
    summary.starved = true;
    console.log(`[calls] sweep starved available=${deadlineMs - nowMs}ms (< ${SWEEP_STARVATION_MS}) — no read performed; the next invocation covers it`);
    return summary;
  }
  let state;
  try {
    const snap = await withTimeout(sweepStateRef(db).get(), deadlineMs - Date.now(), 'calls_sweep_state');
    state = normalizeSweepState(snap?.exists ? snap.data() : null);
  } catch (err) {
    summary.stopped = isCallsTimeout(err) ? 'deadline' : 'state_read_failed';
    return summary;
  }
  summary.phaseBefore = { ...state };
  let cursor = { ...state };
  // ONE cycle per invocation: each phase runs at most once, in order from the
  // persisted cursor; after the third completes the cursor wraps to 'due' and
  // the invocation ends (the next one starts there). A page cut by the
  // deadline ends the invocation with the cursor at the last finished row.
  let completedPhases = 0;

  try {
    while (Date.now() < deadlineMs && completedPhases < SWEEP_PHASES.length) {
      if (cursor.phase === 'due' || cursor.phase === 'nullOnly') {
        let q = db.collection(QUEUE_COLLECTION);
        if (cursor.phase === 'due') {
          q = q.where('nextExpiresAt', '>', 0).orderBy('nextExpiresAt', 'asc').orderBy('__name__', 'asc');
          if (finite(cursor.lastNextExpiresAt) && cursor.lastDocId) q = q.startAfter(cursor.lastNextExpiresAt, cursor.lastDocId);
        } else {
          q = q.where('nextExpiresAt', '==', null).orderBy('__name__', 'asc');
          if (cursor.lastDocId) q = q.startAfter(cursor.lastDocId);
        }
        const page = await withTimeout(q.limit(SWEEP_PAGE).get(), Math.max(1, deadlineMs - Date.now()), 'calls_sweep_queue_page');
        const docs = page?.docs || [];
        for (const doc of docs) {
          if (Date.now() >= deadlineMs) { summary.cut = true; break; }
          const row = normalizeQueueRow(doc.data(), doc.id);
          summary.rows += 1;
          cursor = { phase: cursor.phase, lastNextExpiresAt: cursor.phase === 'due' ? row.nextExpiresAt : null, lastDocId: doc.id };
          // The parent: the owner's resolution and the status. Below 'on' the row is discovered and skipped; nothing else is read or written for it.
          let parent = null;
          try {
            const parentSnap = await withTimeout(db.collection('agentBattles').doc(row.battleId).get(), Math.max(1, deadlineMs - Date.now()), 'calls_sweep_parent');
            parent = parentSnap?.exists ? parentSnap.data() : null;
          } catch (err) { summary.failed = (summary.failed || 0) + 1; if (isCallsTimeout(err)) { summary.cut = true; break; } continue; }
          if (!parent) {
            // An orphaned row: no parent — settle it away (a queue row for nothing is not work).
            const res = await settleQueueRow({ db, battleId: row.battleId, rowAsRead: row, nextExpiresAt: null, pendingHeard: [], settled: new Set(row.pendingHeard), nowMs, deadlineMs });
            if (res.result === 'deleted') summary.deleted = (summary.deleted || 0) + 1;
            continue;
          }
          if (resolveCallRecordsMode(parent) !== 'on') { summary.skippedOff += 1; continue; }
          const { cut } = await sweepBattle({ db, battleId: row.battleId, parent, row, nowMs, deadlineMs, summary });
          if (cut) { summary.cut = true; break; }
        }
        if (summary.cut) break;
        if (docs.length < SWEEP_PAGE) { completedPhases += 1; cursor = { phase: nextPhase(cursor.phase), lastNextExpiresAt: null, lastDocId: null }; }
      } else {
        // reconcile: page the parents of the last seven days by their own expiry, oldest first.
        const floor = new Date(nowMs - SWEEP_RECONCILE_LOOKBACK_MS).toISOString();
        let q = db.collection('agentBattles').where('expiresAt', '>=', floor).orderBy('expiresAt', 'asc').orderBy('__name__', 'asc');
        if (nonEmpty(cursor.lastNextExpiresAt) && cursor.lastDocId) q = q.startAfter(cursor.lastNextExpiresAt, cursor.lastDocId);
        const page = await withTimeout(q.limit(SWEEP_RECONCILE_PAGE).get(), Math.max(1, deadlineMs - Date.now()), 'calls_sweep_reconcile_page');
        const docs = page?.docs || [];
        for (const doc of docs) {
          if (Date.now() >= deadlineMs) { summary.cut = true; break; }
          const parent = doc.data();
          summary.rows += 1;
          cursor = { phase: 'reconcile', lastNextExpiresAt: typeof parent.expiresAt === 'string' ? parent.expiresAt : null, lastDocId: doc.id };
          if (!['active', 'completed'].includes(parent.status)) continue;
          if (resolveCallRecordsMode(parent) !== 'on') { summary.skippedOff += 1; continue; }
          const { cut } = await reconcileBattle({ db, battleId: doc.id, nowMs, deadlineMs, summary });
          if (cut) { summary.cut = true; break; }
        }
        if (summary.cut) break;
        if (docs.length < SWEEP_RECONCILE_PAGE) { completedPhases += 1; cursor = { phase: nextPhase(cursor.phase), lastNextExpiresAt: null, lastDocId: null }; }
      }
    }
  } catch (err) {
    summary.stopped = isCallsTimeout(err) ? 'deadline' : 'threw';
    summary.error = String(err?.message || err).slice(0, 200);
  }

  // The cursor, persisted once (a stale cursor only re-reads; every transition is idempotent).
  try {
    await withTimeout(sweepStateRef(db).set({ ...cursor, updatedAt: nowMs }, { merge: true }), Math.max(250, deadlineMs - Date.now()), 'calls_sweep_state_write');
    summary.phaseAfter = { ...cursor };
  } catch (err) {
    summary.cursorWrite = isCallsTimeout(err) ? 'unconfirmed' : 'failed';
  }
  summary.ms = Date.now() - nowMs;
  console.log(`[calls] sweep ${JSON.stringify(summary)}`);
  return summary;
}
