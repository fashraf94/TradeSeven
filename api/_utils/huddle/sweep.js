// api/_utils/huddle/sweep.js
//
// Huddle S1 — THE CHECK-START SWEEP and THE SETTLE BACKSTOP, the Huddle's only two
// touches of the evaluation cron (api/cron/agent-evaluate.js), each ONE helper call.
//
// applyPendingPlanForCheck (spec V1.1 §6.3 as replaced by Amendment A §A5 and Amendment B
// §B1–§B2). Called once per check, after the migration guard's mirror and before the
// governing preset is resolved:
//   - DRB_HUDDLE_ENABLED off → returns before ANY read (the dark goldens, capture-off,
//     call-record goldens and P4 equivalence never see it);
//   - skips CPU seats; requires ≥ 5 s of the check's remaining budget;
//   - dispatches ONE B1 transaction (applyPlan.applyPlanToBattle: the battle's slot and the
//     huddle record's receipt in one commit) and waits for it at most 3 s;
//   - outcomes: `committed` (the transaction returned) → the COMMITTED slot is mirrored onto
//     the in-memory battle, for the reads before the check's own refresh (the epoch
//     telemetry at agent-evaluate.js:1927; B2); `unknown` (the deadline passed, or an error
//     after dispatch) → no further dispatch, NO memory mutation, `sweep_unknown_outcome`
//     logged — if that commit landed, its receipt is found by the next sweep's first read or
//     by reconcile (B1);
//   - never throws into the check. After it returns, nothing here touches the battle again.
// The check's controls come from its own refresh (refreshBattleFromDoc, agent-evaluate.js:2449,
// merging the whole document): a confirm that lands before that refresh is rendered in this
// check; one after it waits for the next (B2). The heard-stamp invariant is untouched.
//
// runSettleReconcile (B §B3): the evening settle run's reconcile pass, kept only as a
// backstop to the worker's retirement within two minutes of the close. Off → at once.

import { isHuddleOn } from './gate.js';
import { applyPlanToBattle } from './applyPlan.js';
import { isCpuBattle } from './applyRules.js';
import { etDateOfMs } from './records.js';
import { runReconcilePass } from './worker.js';

export const SWEEP_MIN_BUDGET_MS = 5_000;
export const SWEEP_DEADLINE_MS = 3_000;
const TIMED_OUT = Symbol('sweep_deadline');

/**
 * @param {object} battle  the check's in-memory battle (mirrored only on a committed outcome)
 * @param {{ db: object, cronStartTime: number, timeBudgetMs: number, nowMs?: number, deadlineMs?: number }} ctx
 * @returns {Promise<{ outcome: string, disposition?: string|null }>}
 */
export async function applyPendingPlanForCheck(battle, ctx) {
  if (!isHuddleOn()) return { outcome: 'off' };
  try {
    if (!battle || typeof battle.id !== 'string' || isCpuBattle(battle)) return { outcome: 'skipped' };
    const remaining = (ctx?.timeBudgetMs ?? 0) - (Date.now() - (ctx?.cronStartTime ?? Date.now()));
    if (!(remaining >= SWEEP_MIN_BUDGET_MS)) return { outcome: 'no_budget' };
    const etDate = battle.timing?.tradingDays?.[0];
    if (typeof battle.ownerId !== 'string' || typeof etDate !== 'string') return { outcome: 'skipped' };
    const dispatched = applyPlanToBattle(ctx.db, { uid: battle.ownerId, etDate, battleId: battle.id, writtenBy: 'sweep', nowMs: ctx.nowMs ?? Date.now() });
    dispatched.catch(() => {}); // a late failure after the deadline is never unhandled
    let timer;
    const deadline = new Promise((resolve) => { timer = setTimeout(() => resolve(TIMED_OUT), ctx.deadlineMs ?? SWEEP_DEADLINE_MS); });
    let result;
    try {
      result = await Promise.race([dispatched, deadline]);
    } catch (err) {
      console.warn('[huddle/sweep] sweep_unknown_outcome', JSON.stringify({ battleId: battle.id, cause: 'error', message: err?.message }));
      return { outcome: 'unknown' };
    } finally {
      clearTimeout(timer);
    }
    if (result === TIMED_OUT) {
      console.warn('[huddle/sweep] sweep_unknown_outcome', JSON.stringify({ battleId: battle.id, cause: 'deadline' }));
      return { outcome: 'unknown' };
    }
    // committed: mirror exactly what the transaction committed (or found already filed)
    if (result?.slot && typeof result.slot.directiveThreadId === 'string') battle.directive = result.slot;
    return { outcome: 'committed', disposition: result?.disposition ?? null, result: result?.outcome ?? null };
  } catch (err) {
    console.warn('[huddle/sweep] failed before dispatch', JSON.stringify({ message: err?.message }));
    return { outcome: 'error' };
  }
}

/** The settle run's backstop reconcile. Never throws. */
export async function runSettleReconcile(db, { clock = () => Date.now() } = {}) {
  if (!isHuddleOn()) return { outcome: 'off' };
  try {
    return { outcome: 'reconciled', ...(await runReconcilePass(db, { etDate: etDateOfMs(clock()), clock })) };
  } catch (err) {
    console.warn('[huddle/settle] reconcile failed', JSON.stringify({ message: err?.message }));
    return { outcome: 'error' };
  }
}
