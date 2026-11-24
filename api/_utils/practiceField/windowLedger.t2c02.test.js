// api/_utils/practiceField/windowLedger.t2c02.test.js
//
// Practice Field build B2 — the carried T1b condition T2C-02 (Astra, T1a-2b-2 review): "window count normalization is
// conditional". Two rows, as Astra put them, and their positive controls:
//   • a SERVED row whose window acted again after its stamp was lost — a waiting sale that then filled — reconciles the
//     new receipt: it says one fill and `code_action`, not zero and `no_model_action`;
//   • folding attempt B (its receipts already hold delayed attempt A's) and then A counts each fill ONCE: 2, not 3.
// And the normal path is unchanged: a served row whose counts cover its receipts is the SAME row, and nothing is written.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { foldWindowAttempt, attemptOf, reconcileServedRow, recordWindowAttempt, windowActionKey, WINDOW_ACTION_KIND, windowsRefOf } from './windowLedger.js';
import { setPracticeFieldModeForTests } from './mode.js';
import { seedBook } from './__testsupport__/fixtures.js';

let restore;
beforeEach(() => { restore = setPracticeFieldModeForTests('on'); });
afterEach(() => restore());

const tick = { date: '2026-11-17', slot: 'open30', tickKey: '2026-11-17_open30' };
const win = (over = {}) => ({ complete: true, errors: 0, caughtUp: [], sales: { sold: 0, waiting: 0, resulted: 0 }, entries: { entered: 0, waiting: 0, cancelled: 0 }, ...over });
const receipt = (kind, id, at) => ({ [windowActionKey(kind, id)]: { kind, at } });

describe('T2C-02 — a served row reconciles receipts written after it was served', () => {
  it('a waiting sale served, its stamp lost, then filled at the retry: the row says one fill and code_action', () => {
    const served = foldWindowAttempt(null, attemptOf(win({ sales: { sold: 0, waiting: 1, resulted: 0 } }), { nowIso: '2026-11-17T15:02:00.000Z' }), { bookId: 'b', tick });
    expect(served).toMatchObject({ served: true, code: { sales: { filled: 0, waiting: 1 } }, outcome: 'no_model_action' });
    // The retry fills the sale, which writes its receipt on the row (exits.js) — then folds its attempt.
    const withReceipt = { ...served, actions: receipt(WINDOW_ACTION_KIND.SALE, 'idea_1__settlement__XOM', '2026-11-17T15:17:00.000Z') };
    const row = foldWindowAttempt(withReceipt, attemptOf(win({ sales: { sold: 1, waiting: 0, resulted: 0 } }), { nowIso: '2026-11-17T15:17:00.000Z' }), { bookId: 'b', tick });
    expect(row).toMatchObject({ served: true, servedAt: served.servedAt, attempts: 1, code: { sales: { filled: 1 } }, outcome: 'code_action', receiptsReconciled: true });
  });

  it('…and only receipts move it: a served row whose counts already cover its receipts is the SAME object (nothing is written)', () => {
    const served = foldWindowAttempt({ actions: receipt(WINDOW_ACTION_KIND.ENTRY, 'idea_1', '2026-11-17T15:02:00.000Z') }, attemptOf(win({ entries: { entered: 1, waiting: 0, cancelled: 0 } }), { nowIso: '2026-11-17T15:02:00.000Z' }), { bookId: 'b', tick });
    expect(served.code.entries.filled).toBe(1);
    expect(reconcileServedRow(served)).toBe(served);
    expect(foldWindowAttempt(served, attemptOf(win(), { nowIso: '2026-11-17T15:17:00.000Z' }), { bookId: 'b', tick })).toBe(served);
  });

  it('recordWindowAttempt on a served row: writes the reconciled row when a receipt is new, and nothing otherwise', async () => {
    const ctx = await seedBook();
    const rowRef = windowsRefOf(ctx.bookRef).doc('2026-11-17_open30');
    const first = await recordWindowAttempt(ctx.db, { bookRef: ctx.bookRef, tick, win: win({ sales: { sold: 0, waiting: 1, resulted: 0 } }), now: new Date('2026-11-17T15:02:00.000Z') });
    expect(first).toEqual({ wrote: true, served: true });
    const bytes = JSON.stringify(ctx.db._get(rowRef.path));
    expect(await recordWindowAttempt(ctx.db, { bookRef: ctx.bookRef, tick, win: win(), now: new Date('2026-11-17T15:17:00.000Z') })).toEqual({ wrote: false, served: true });
    expect(JSON.stringify(ctx.db._get(rowRef.path))).toBe(bytes);
    await rowRef.set({ actions: receipt(WINDOW_ACTION_KIND.SALE, 'idea_1__settlement__XOM', '2026-11-17T15:17:00.000Z') }, { merge: true });
    expect(await recordWindowAttempt(ctx.db, { bookRef: ctx.bookRef, tick, win: win({ sales: { sold: 1, waiting: 0, resulted: 0 } }), now: new Date('2026-11-17T15:17:30.000Z') })).toEqual({ wrote: true, served: true, reconciled: true });
    expect(ctx.db._get(rowRef.path)).toMatchObject({ code: { sales: { filled: 1 } }, outcome: 'code_action', attempts: 1 });
  });
});

describe('T2C-02 — a delayed attempt is never added on top of receipts that already hold it', () => {
  it('B (receipts of A and B) folded first, then the delayed A: two fills, not three', () => {
    const receipts = { ...receipt(WINDOW_ACTION_KIND.SALE, 'a', '2026-11-17T15:02:00.000Z'), ...receipt(WINDOW_ACTION_KIND.SALE, 'b', '2026-11-17T15:03:00.000Z') };
    const failed = (sold, at) => attemptOf(win({ complete: false, errors: 1, sales: { sold, waiting: 0, resulted: 0 } }), { nowIso: at });
    const afterB = foldWindowAttempt({ actions: receipts }, failed(1, '2026-11-17T15:03:00.000Z'), { bookId: 'b', tick });
    expect(afterB.code.sales.filled).toBe(2); // the receipts: A's fill is known though its attempt is not
    const afterA = foldWindowAttempt(afterB, failed(1, '2026-11-17T15:04:00.000Z'), { bookId: 'b', tick });
    expect(afterA.code.sales.filled).toBe(2); // was 3 before the fix: B's total already held A's receipt
    expect(afterA.attempts).toBe(2);
  });

  it('positive control: two attempts each filling one sale, each with its receipt, fold in order to two', () => {
    const r1 = receipt(WINDOW_ACTION_KIND.SALE, 'a', '2026-11-17T15:02:00.000Z');
    const one = foldWindowAttempt({ actions: r1 }, attemptOf(win({ complete: false, errors: 1, sales: { sold: 1, waiting: 0, resulted: 0 } }), { nowIso: '2026-11-17T15:02:00.000Z' }), { bookId: 'b', tick });
    const two = foldWindowAttempt({ ...one, actions: { ...one.actions, ...receipt(WINDOW_ACTION_KIND.SALE, 'b', '2026-11-17T15:17:00.000Z') } }, attemptOf(win({ sales: { sold: 1, waiting: 0, resulted: 0 } }), { nowIso: '2026-11-17T15:17:00.000Z' }), { bookId: 'b', tick });
    expect([one.code.sales.filled, two.code.sales.filled, two.served]).toEqual([1, 2, true]);
  });
});
