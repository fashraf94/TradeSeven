// api/_utils/callRecords/heard.js
//
// Cockpit Build 1a — THE HEARD WRITER and the acted / no-match receipts
// (spec docs/COCKPIT_BUILD1A_SPEC_V1_2.md §2, §7; contract Amendment B §9),
// run in the Build 0 model-path phase AFTER the evaluation commit and the
// flips, at resolved mode 'on' only.
//
// THREE FACTS, each from its own evidence, none inferred from another:
//   heard   — the committed entry's unsuppressed `heard.directiveThreadId`
//             equals the answer's thread: "in that check's prompt", stamped
//             even when transport failed; never comprehension or agreement.
//             `playerResponse.heardEvalId` is FIRST-CONFIRMED and monotonic
//             (set only if null); the `heard` event rides that first stamp.
//   acted   — the committed executor result of a check that heard the thread
//             matches the call's WHOLE trade (Build 0's matcher, extended with
//             the selected pick) → `outcome.actedEvalId` (only if null), the
//             `acted` event, and the retirement of a go / pick directive
//             (compare-and-clear on the fresh parent, in the same transaction).
//   no matching trade — the check heard the thread AND its executor result is
//             PRESENT and parsed, and the call's affected leg is not in it →
//             the `no_matching_trade` event. A null result is unknown: nothing.
// THERE IS NO "HELD" FACT. A late answer (filedAt after promptBuiltAt) is not
// heard by that check. Scope: calls that are open, or whose transition
// committed in this same phase; post-terminal reconciliation is Build 1b.
//
// Every write is one transaction per call under the phase's shared deadline,
// re-reading the call and the parent; a timeout is unconfirmed. Never throws.

import { withTimeout } from '../intraday/evaluatorHook.js';
import { matchesWholeTrade } from './flip.js';
import { buildCallEvent, createCallEvent } from './events.js';
import { renderHeardEvent, renderActedEvent, renderNoMatchingTradeEvent, checkLabel } from './copy.js';
import { isCallsTimeout, CallsAbort } from './publish.js';
import { retireCallDirective } from '../directiveWriter.js';
import { heardThreadOf, directiveRecordOf, selectedPickOf } from './threads.js';

/** One heard transaction's ceiling (the flip's 800 ms). */
export const HEARD_TX_MS = 800;
/** How many calls one thread may name (one, in practice; bounded anyway). */
export const HEARD_PAGE = 8;

const nonEmpty = (v) => typeof v === 'string' && v.length > 0;
const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

export { heardThreadOf, directiveRecordOf, selectedPickOf };

/** Is the executor result a PRESENT, PARSED trade (both symbols)? Anything else is unknown. */
export function executorResultPresent(result) {
  return isPlainObject(result) && nonEmpty(result.symbolIn) && nonEmpty(result.symbolOut);
}

/**
 * Does the result touch the call's AFFECTED LEG (Astra B1R2-1: exiting X for
 * Z still touches a request about X)? Used only to decide "no matching trade"
 * — never to claim acted.
 */
export function legMatches(call, result) {
  if (!executorResultPresent(result)) return false;
  if (result.tier !== call?.slot) return false;
  if (call.kind === 'pick') return result.symbolOut === call.swapOut;
  if (call.direction === 'entry') return result.symbolIn === call.symbol;
  if (call.direction === 'exit') return result.symbolOut === call.symbol;
  return false;
}

/** A late answer: filed after the prompt was built (so it cannot have been in that prompt). */
export function answerIsLate(playerResponse, promptBuiltAt) {
  const filed = Date.parse(playerResponse?.filedAt ?? '');
  const built = Date.parse(promptBuiltAt ?? '');
  if (!finite(filed) || !finite(built)) return false;
  return filed > built;
}

/**
 * The plan for one call, from fresh reads. `skip` names why nothing happens;
 * otherwise the writes to make.
 */
export function planHeard(call, parent, { thread, evalId, promptBuiltAt, executorResult, flippedIds }) {
  const pr = call?.playerResponse;
  if (!isPlainObject(pr) || pr.kind !== 'directive' || pr.directiveThreadId !== thread) return { skip: 'not_this_thread' };
  if (answerIsLate(pr, promptBuiltAt)) return { skip: 'late_answer' };
  const inScope = call.state === 'open' || (flippedIds && flippedIds.has(call.callId));
  if (!inScope) return { skip: 'post_terminal' };
  const stampHeard = pr.heardEvalId == null;
  const present = executorResultPresent(executorResult);
  const pick = selectedPickOf(parent, thread);
  // Acted THIS check: a whole-trade match (the selected pick bound) and no
  // EARLIER check's actedEvalId — the Build 0 flip may already have stamped
  // this very check's id on an open call in the same phase; that is the same
  // fact, and the acted event rides it.
  const priorActed = isPlainObject(call.outcome) && nonEmpty(call.outcome.actedEvalId) ? call.outcome.actedEvalId : null;
  const acted = present && (priorActed === null || priorActed === evalId)
    && matchesWholeTrade(call, executorResult, { selectedSymbol: pick });
  const noMatch = present && !acted && !legMatches(call, executorResult);
  const retire = acted && (call.kind === 'pick' || call.defaultAction === 'hold');
  return { stampHeard, acted, noMatch, retire, pick, answerId: directiveRecordOf(parent, thread)?.answerId ?? null };
}

/** One call's transaction. Never throws. */
async function heardOne({ db, battleId, callId, thread, evalId, promptBuiltAt, executorResult, flippedIds, deadlineMs, nowMs }) {
  const budgetMs = Math.min(HEARD_TX_MS, deadlineMs - Date.now());
  if (budgetMs <= 0) return { result: 'not_started' };
  const attemptDeadlineMs = Date.now() + budgetMs;
  const battleRef = db.collection('agentBattles').doc(battleId);
  const callRef = battleRef.collection('calls').doc(callId);
  try {
    return await withTimeout(db.runTransaction(async (tx) => {
      if (Date.now() >= attemptDeadlineMs) throw new CallsAbort('deadline');
      const [callSnap, parentSnap] = await tx.getAll(callRef, battleRef);
      if (!callSnap?.exists) return { result: 'skipped', reason: 'missing' };
      const call = callSnap.data();
      const parent = parentSnap?.exists ? parentSnap.data() : null;
      const plan = planHeard(call, parent, { thread, evalId, promptBuiltAt, executorResult, flippedIds });
      if (plan.skip) return { result: 'skipped', reason: plan.skip };
      if (!plan.stampHeard && !plan.acted && !plan.noMatch) return { result: 'skipped', reason: 'nothing_to_do' };
      if (Date.now() >= attemptDeadlineMs) throw new CallsAbort('deadline');
      const label = checkLabel(promptBuiltAt);
      const evidence = { evalId, promptBuiltAt: promptBuiltAt ?? null, checkLabel: label };
      const change = {};
      if (plan.stampHeard) {
        change['playerResponse.heardEvalId'] = evalId;
        createCallEvent(tx, db, battleId, { kind: 'heard', idParams: { callId, evalId }, event: buildCallEvent({ kind: 'heard', at: nowMs, callIds: [callId], text: renderHeardEvent({ promptBuiltAt }), evidence }) });
      }
      let retired = false;
      if (plan.acted) {
        change.outcome = { ...(isPlainObject(call.outcome) ? call.outcome : {}), actedEvalId: evalId };
        createCallEvent(tx, db, battleId, { kind: 'acted', idParams: { callId, evalId }, event: buildCallEvent({ kind: 'acted', at: nowMs, callIds: [callId], text: renderActedEvent({ executorResult, promptBuiltAt }), evidence }) });
        if (plan.retire && parent) retired = retireCallDirective(tx, battleRef, parent, { directiveThreadId: thread, answerId: plan.answerId });
      }
      if (plan.noMatch) {
        createCallEvent(tx, db, battleId, { kind: 'no_matching_trade', idParams: { callId, evalId }, event: buildCallEvent({ kind: 'no_matching_trade', at: nowMs, callIds: [callId], text: renderNoMatchingTradeEvent({ promptBuiltAt }), evidence }) });
      }
      tx.update(callRef, change);
      return { result: 'written', heard: plan.stampHeard, acted: plan.acted, noMatch: plan.noMatch, retired };
    }), budgetMs, 'calls_heard');
  } catch (err) {
    if (err?.callsAbort === 'deadline' || isCallsTimeout(err)) return { result: 'unconfirmed' };
    const error = String(err?.message || err).slice(0, 200);
    console.error(`[calls] heard failed battle=${battleId} call=${callId}: ${error}`);
    return { result: 'failed', error };
  }
}

/**
 * THE HEARD PHASE (spec §7): for the thread this check's committed, unsuppressed
 * `heard` stamp names, every call answered on that thread. Resolved mode 'on'
 * only (the caller gates). Never throws.
 *
 * @param {object} callsCtx
 * @param {object} p
 * @param {object} p.db
 * @param {string} p.battleId
 * @param {string} p.evalId             the committed identity
 * @param {string|null} p.promptBuiltAt the committed entry's promptBuiltAt (ISO)
 * @param {object|null} p.heard         the committed entry's heard stamp
 * @param {object|null} p.executorResult
 * @param {Set<string>} [p.flippedIds]  calls whose transition committed in this phase
 * @param {number} p.deadlineMs
 */
export async function runHeardPhase(callsCtx, { db, battleId, evalId, promptBuiltAt, heard, executorResult, flippedIds = new Set(), deadlineMs }) {
  const diag = { thread: null, scanned: 0, heard: 0, acted: 0, noMatch: 0, retired: 0, skipped: {}, unconfirmed: 0, failed: 0, stopped: null };
  if (!callsCtx || callsCtx.mode !== 'on' || !nonEmpty(evalId)) { diag.stopped = 'inactive'; return diag; }
  const thread = heardThreadOf(heard);
  if (!thread) { diag.stopped = heard ? 'suppressed' : 'no_heard'; return diag; }
  diag.thread = thread;
  const nowMs = Date.now();
  let page;
  try {
    const q = db.collection('agentBattles').doc(battleId).collection('calls').where('directiveThreadId', '==', thread).limit(HEARD_PAGE);
    page = await withTimeout(q.get(), Math.max(1, deadlineMs - Date.now()), 'calls_heard_query');
  } catch (err) {
    diag.stopped = isCallsTimeout(err) ? 'deadline' : 'query_failed';
    return diag;
  }
  for (const doc of page?.docs || []) {
    if (Date.now() >= deadlineMs) { diag.stopped = 'deadline'; return diag; }
    diag.scanned += 1;
    const res = await heardOne({ db, battleId, callId: doc.id, thread, evalId, promptBuiltAt, executorResult, flippedIds, deadlineMs, nowMs });
    if (res.result === 'written') {
      if (res.heard) diag.heard += 1;
      if (res.acted) diag.acted += 1;
      if (res.noMatch) diag.noMatch += 1;
      if (res.retired) diag.retired += 1;
    } else if (res.result === 'skipped') {
      diag.skipped[res.reason] = (diag.skipped[res.reason] || 0) + 1;
    } else if (res.result === 'unconfirmed' || res.result === 'not_started') {
      diag.unconfirmed += 1;
      if (res.result === 'not_started') { diag.stopped = 'deadline'; return diag; }
    } else {
      diag.failed += 1;
    }
  }
  return diag;
}
