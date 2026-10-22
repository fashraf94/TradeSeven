// api/_utils/callRecords/retire.js
//
// Cockpit Build 2b — RETIRE ON EXIT (contract Amendment D, D-6; spec
// docs/COCKPIT_BUILD2B_SPEC_V1_0.md S-7). A live command is retired when the
// stock it is about leaves the book, by any route.
//
// WHERE: at every check at resolved 'on', in api/cron/agent-evaluate.js, after
// the last pre-prompt route that can move the book and before the prompt's
// directive is resolved — and only when the IN-MEMORY slot is call-family
// (the caller gates; this module re-checks).
//
// WHEN: the slot's stored action, re-read on the FRESH parent, fails the
// filing test (callActions.js isCallActionEligible, with its selected or
// chosen name) for a BOOK reason (copy.js RETIRED_REASONS):
//   symbol_not_held (exit) · counterpart_not_held (entry with a counterpart) ·
//   swap_out_not_held (pick) · pick_already_held (a selected or chosen name
//   that came into the book another way).
// Any other failure is not a book reason and retires nothing here.
//
// WHAT, in ONE bounded transaction (the heard pass's 800 ms ceiling and abort
// pattern, heard.js): compare-and-clear on the fresh parent
// (directiveWriter.js retireCallDirective — a newer slot, any other thread, is
// never touched) and, in the same commit, the `retired` event
// (`${directiveThreadId}:retired`, callIds [slot.callId], extra { symbol,
// reason, trade }). After the commit the in-memory battle drops the directive,
// so this check's prompt is built without it.
//
// THE TRADE: the newest row of the battle's trade log (`trades`, written by the
// executor — agentSwapExecution.js:495) after the directive's `filedAt` whose
// `symbolOut` — or `symbolIn`, for pick_already_held — is the symbol; null
// when none is found (the evidence is the book, not the trade).
//
// FAILURE: a timeout or an error leaves the slot exactly as it was, is logged,
// and never throws — the prompt is built as it would have been.
//
// A LATE COMMIT (review CB1-2): the race on the transaction does not cancel it,
// so a commit can land after the ceiling. The transaction therefore gets the
// step's budget less a reserve (publish.js's REREAD_RESERVE precedent), and an
// unconfirmed outcome is settled inside that reserve: the transaction's own
// outcome if it finishes there, else ONE bounded read of the `retired` event it
// would have written — present → the commit landed, the in-memory slot is
// dropped and the step reports retired; absent or unread → as before (a commit
// still in flight past the step's whole ceiling remains the heard pass's
// precedent: logged, never thrown).
//
// EVIDENCE: at this placement (before the prompt) the check has neither its
// committed evalId nor its prompt, so both are null on the event by
// construction; `checkLabel` is the step's own instant (D-6's evidence fields
// cannot be met here — a placement fact, recorded in the build report).

import { withTimeout } from '../intraday/evaluatorHook.js';
import { isCallDirective } from '../directiveUtils.js';
import { retireCallDirective, planRetirement } from '../directiveWriter.js';
import { isCallActionEligible } from './callActions.js';
import { buildCallEvent, createCallEvent, callEventRef, eventIdOf } from './events.js';
import { renderRetiredEvent, RETIRED_REASONS, checkLabel } from './copy.js';
import { CallsAbort, isCallsTimeout } from './publish.js';

/** The one transaction's ceiling — the heard pass's (heard.js HEARD_TX_MS). */
export const RETIRE_TX_MS = 800;
/** Kept back from the transaction for the one settling read (review CB1-2). */
export const RETIRE_REREAD_RESERVE_MS = 200;

const nonEmpty = (v) => typeof v === 'string' && v.length > 0;
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** The name that moved, for a book reason: the exit's symbol, the entry's counterpart, the pick's swap-out, or the selected / chosen name. */
export function movedSymbolOf(slot, reason) {
  const action = slot?.action || {};
  switch (reason) {
    case 'symbol_not_held': return nonEmpty(action.symbol) ? action.symbol : null;
    case 'counterpart_not_held': return nonEmpty(action.counterpart) ? action.counterpart : null;
    case 'swap_out_not_held': return nonEmpty(action.swapOut) ? action.swapOut : null;
    case 'pick_already_held': return nonEmpty(action.pickSymbol) ? action.pickSymbol : null;
    default: return null;
  }
}

/**
 * The trade row that moved the stock: the newest in `trades` after the
 * directive's filing whose symbolOut (symbolIn for pick_already_held) is the
 * symbol. `{ symbolOut, symbolIn, at, source }` or null.
 */
export function findMovingTrade(trades, { symbol, reason, filedAt }) {
  if (!nonEmpty(symbol) || !Array.isArray(trades)) return null;
  const filedMs = Date.parse(filedAt ?? '');
  const side = reason === 'pick_already_held' ? 'symbolIn' : 'symbolOut';
  for (let i = trades.length - 1; i >= 0; i -= 1) {
    const t = trades[i];
    if (!isPlainObject(t) || t[side] !== symbol) continue;
    const atMs = Date.parse(t.swappedOutAt ?? t.timestamp ?? '');
    if (Number.isFinite(filedMs) && !(Number.isFinite(atMs) && atMs > filedMs)) continue;
    return {
      symbolOut: nonEmpty(t.symbolOut) ? t.symbolOut : null,
      symbolIn: nonEmpty(t.symbolIn) ? t.symbolIn : null,
      at: Number.isFinite(atMs) ? new Date(atMs).toISOString() : null,
      source: nonEmpty(t.source) ? t.source : null,
    };
  }
  return null;
}

/**
 * Plan the retirement from FRESH reads (pure): `{ retire: false, reason }`, or
 * `{ retire: true, reason, symbol, trade }`.
 */
export function planRetire({ memorySlot, freshParent, call, atMs }) {
  const fresh = freshParent?.directive ?? null;
  if (!isCallDirective(fresh)) return { retire: false, reason: 'slot_not_call_family' };
  // Compare-and-clear's own identity test: a newer slot (any other thread or answer) is never touched.
  if (!planRetirement(fresh, { directiveThreadId: memorySlot?.directiveThreadId, answerId: memorySlot?.answerId })) return { retire: false, reason: 'slot_changed' };
  if (!isPlainObject(call)) return { retire: false, reason: 'call_missing' };
  const verdict = isCallActionEligible(fresh.kind, call, freshParent, { pickSymbol: fresh.action?.pickSymbol ?? null, atMs });
  if (verdict.ok) return { retire: false, reason: 'eligible' };
  if (!RETIRED_REASONS.includes(verdict.reason)) return { retire: false, reason: `not_a_book_reason:${verdict.reason}` };
  const symbol = movedSymbolOf(fresh, verdict.reason);
  const trade = findMovingTrade(freshParent?.trades, { symbol, reason: verdict.reason, filedAt: fresh.filedAt });
  return { retire: true, reason: verdict.reason, symbol, trade };
}

/** The transaction's own outcome if it settles before `deadlineMs`, else null (a rejection reads as unsettled). Never throws. */
async function settleLate(txPromise, deadlineMs) {
  const leftMs = deadlineMs - Date.now();
  if (!txPromise || !(leftMs > 0)) return null;
  try {
    const outcome = await withTimeout(txPromise, leftMs, 'calls_retire_late');
    return outcome && typeof outcome === 'object' && typeof outcome.retired === 'boolean' ? outcome : null;
  } catch {
    return null;
  }
}

/** Does this thread's `retired` event exist? One read, inside the step's remaining time; false when unread. Never throws. */
export async function retiredEventLanded({ db, battleId, directiveThreadId, deadlineMs }) {
  const leftMs = deadlineMs - Date.now();
  if (!(leftMs > 0) || !nonEmpty(battleId) || !nonEmpty(directiveThreadId)) return false;
  try {
    const snap = await withTimeout(callEventRef(db, battleId, eventIdOf('retired', { directiveThreadId })).get(), leftMs, 'calls_retire_settle');
    return Boolean(snap?.exists);
  } catch {
    return false;
  }
}

/**
 * THE RETIRE STEP. Never throws. Returns `{ retired, reason }`; on a commit the
 * in-memory `battle.directive` is set to null.
 *
 * @param {object} p
 * @param {object} p.db
 * @param {object} p.battleRef
 * @param {object} p.battle         the in-memory battle (its slot is the one the prompt would carry)
 * @param {number} p.nowMs          the check's instant (the lock test, the event's `at`)
 * @param {string|null} p.evalId    the check's committed identity — null before the check commits one
 * @param {string|null} p.promptBuiltAt the check's prompt instant — null before the prompt is built
 * @param {number} p.deadlineMs     the step's deadline
 */
export async function retireLeftBook({ db, battleRef, battle, nowMs, evalId = null, promptBuiltAt = null, deadlineMs }) {
  const memorySlot = battle?.directive ?? null;
  if (!isCallDirective(memorySlot)) return { retired: false, reason: 'not_call_family' };
  const stepMs = Math.min(RETIRE_TX_MS, deadlineMs - Date.now());
  const budgetMs = stepMs - RETIRE_REREAD_RESERVE_MS;
  if (!(budgetMs > 0)) return { retired: false, reason: 'not_started' };
  const stepDeadlineMs = Date.now() + stepMs;
  const attemptDeadlineMs = Date.now() + budgetMs;
  const battleId = battleRef.id ?? battle?.id;
  let txPromise = null;
  try {
    txPromise = db.runTransaction(async (tx) => {
      if (Date.now() >= attemptDeadlineMs) throw new CallsAbort('deadline');
      const callRef = nonEmpty(memorySlot.callId) ? battleRef.collection('calls').doc(memorySlot.callId) : null;
      const [parentSnap, callSnap] = callRef ? await tx.getAll(battleRef, callRef) : [await tx.get(battleRef), null];
      const freshParent = parentSnap?.exists ? parentSnap.data() : null;
      const call = callSnap?.exists ? callSnap.data() : null;
      const plan = planRetire({ memorySlot, freshParent, call, atMs: nowMs });
      if (!plan.retire) return { retired: false, reason: plan.reason };
      if (Date.now() >= attemptDeadlineMs) throw new CallsAbort('deadline');
      const directiveThreadId = memorySlot.directiveThreadId;
      if (!retireCallDirective(tx, battleRef, freshParent, { directiveThreadId, answerId: memorySlot.answerId })) return { retired: false, reason: 'slot_changed' };
      const label = checkLabel(promptBuiltAt) ?? checkLabel(nowMs);
      createCallEvent(tx, db, battleId, {
        kind: 'retired',
        idParams: { directiveThreadId },
        event: buildCallEvent({
          kind: 'retired',
          at: nowMs,
          callIds: nonEmpty(memorySlot.callId) ? [memorySlot.callId] : [],
          text: renderRetiredEvent({ symbol: plan.symbol, reason: plan.reason, promptBuiltAt: promptBuiltAt ?? nowMs }),
          evidence: { evalId, promptBuiltAt, checkLabel: label },
          extra: { symbol: plan.symbol, reason: plan.reason, trade: plan.trade },
        }),
      });
      return { retired: true, reason: plan.reason };
    });
    const outcome = await withTimeout(txPromise, budgetMs, 'calls_retire');
    // After the commit — never before: this check's prompt is built without the directive.
    if (outcome.retired) battle.directive = null;
    return outcome;
  } catch (err) {
    if (err?.callsAbort === 'deadline' || isCallsTimeout(err)) {
      // Settle it inside the reserve: the transaction's own outcome if it finishes there, else ONE bounded read of
      // the event it would have written.
      const late = await settleLate(txPromise, stepDeadlineMs);
      if (late && late.retired) {
        battle.directive = null;
        console.log(`[calls] retire landed late battle=${battleId} thread=${memorySlot.directiveThreadId} (settled by the transaction)`);
        return { retired: true, reason: late.reason };
      }
      if (late) return late;
      if (await retiredEventLanded({ db, battleId, directiveThreadId: memorySlot.directiveThreadId, deadlineMs: stepDeadlineMs })) {
        battle.directive = null;
        console.log(`[calls] retire landed late battle=${battleId} thread=${memorySlot.directiveThreadId} (settled by the event read)`);
        return { retired: true, reason: 'landed_late' };
      }
      console.log(`[calls] retire unconfirmed battle=${battleId} thread=${memorySlot.directiveThreadId} (slot left as it was)`);
      return { retired: false, reason: 'unconfirmed' };
    }
    console.error(`[calls] retire failed battle=${battleId} thread=${memorySlot.directiveThreadId}: ${String(err?.message || err).slice(0, 200)}`);
    return { retired: false, reason: 'failed' };
  }
}
