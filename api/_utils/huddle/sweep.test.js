// api/_utils/huddle/sweep.test.js
//
// Huddle S1 — the check-start sweep's outcomes, flag on (spec V1.1 §6.3; Amendment A §A5;
// Amendment B §B1–B2): committed → the committed slot is mirrored; unknown (deadline or
// error after dispatch) → nothing mirrored, ever, even if the commit lands later; a CPU
// seat, a short budget or a malformed battle dispatch nothing; it never throws.

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/config/huddleFlags.js', () => ({ DRB_HUDDLE_ENABLED: true }));
const apply = vi.hoisted(() => ({ fn: null }));
vi.mock('./applyPlan.js', () => ({ applyPlanToBattle: (...a) => apply.fn(...a) }));
vi.mock('./worker.js', () => ({ runReconcilePass: async () => ({ visited: 0, of: 0, retired: 0 }) }));

const { applyPendingPlanForCheck, runSettleReconcile, SWEEP_MIN_BUDGET_MS } = await import('./sweep.js');

const SLOT = { text: 'GAME PLAN', directiveThreadId: 'plan:u1:2026-11-09:r1', createdAt: '2026-11-09T14:35:00.000Z', expiry: 'end_of_battle', textVersion: 'plan.v1' };
const battle = (over = {}) => ({ id: 'b1', ownerId: 'u1', timing: { tradingDays: ['2026-11-09'] }, directive: null, ...over });
const ctx = (over = {}) => ({ db: {}, cronStartTime: Date.now(), timeBudgetMs: 290_000, ...over });

beforeEach(() => {
  apply.fn = vi.fn(async () => ({ outcome: 'written', disposition: 'written', slot: SLOT }));
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('applyPendingPlanForCheck', () => {
  it("committed: one dispatch, keyed by the battle's own owner and session; the committed slot is mirrored", async () => {
    const b = battle();
    expect(await applyPendingPlanForCheck(b, ctx())).toMatchObject({ outcome: 'committed', disposition: 'written' });
    expect(apply.fn).toHaveBeenCalledTimes(1);
    expect(apply.fn.mock.calls[0][1]).toMatchObject({ uid: 'u1', etDate: '2026-11-09', battleId: 'b1', writtenBy: 'sweep' });
    expect(b.directive).toEqual(SLOT);
  });

  it('found already filed: the fresh slot it returns is mirrored; nothing filed returns no slot and mirrors nothing', async () => {
    apply.fn = vi.fn(async () => ({ outcome: 'already_written', disposition: null, slot: SLOT }));
    const b = battle();
    await applyPendingPlanForCheck(b, ctx());
    expect(b.directive).toEqual(SLOT);
    apply.fn = vi.fn(async () => ({ outcome: 'not_confirmed', disposition: null }));
    const c = battle({ directive: { text: 'chat', directiveThreadId: 't' } });
    await applyPendingPlanForCheck(c, ctx());
    expect(c.directive).toEqual({ text: 'chat', directiveThreadId: 't' });
  });

  it('unknown at the deadline: no mirror — not then, and not when the commit lands afterwards', async () => {
    let land;
    apply.fn = vi.fn(() => new Promise((resolve) => { land = () => resolve({ outcome: 'written', disposition: 'written', slot: SLOT }); }));
    const b = battle();
    expect(await applyPendingPlanForCheck(b, ctx({ deadlineMs: 5 }))).toEqual({ outcome: 'unknown' });
    land();
    await new Promise((r) => setTimeout(r, 10));
    expect(b.directive).toBeNull();
    expect(apply.fn).toHaveBeenCalledTimes(1);
  });

  it('an error after dispatch is unknown too, and never thrown into the check', async () => {
    apply.fn = vi.fn(async () => { throw new Error('contention'); });
    const b = battle();
    expect(await applyPendingPlanForCheck(b, ctx())).toEqual({ outcome: 'unknown' });
    expect(b.directive).toBeNull();
  });

  it('a CPU seat, a short budget, or a battle with no session dispatch nothing', async () => {
    expect((await applyPendingPlanForCheck(battle({ isCpu: true }), ctx())).outcome).toBe('skipped');
    expect((await applyPendingPlanForCheck(battle({ ownerId: 'cpu-1' }), ctx())).outcome).toBe('skipped');
    expect((await applyPendingPlanForCheck(battle(), ctx({ timeBudgetMs: SWEEP_MIN_BUDGET_MS - 1 }))).outcome).toBe('no_budget');
    expect((await applyPendingPlanForCheck(battle({ timing: {} }), ctx())).outcome).toBe('skipped');
    expect(apply.fn).not.toHaveBeenCalled();
  });

  it('the settle backstop runs the reconcile pass when on', async () => {
    expect(await runSettleReconcile({})).toMatchObject({ outcome: 'reconciled', visited: 0 });
  });
});
