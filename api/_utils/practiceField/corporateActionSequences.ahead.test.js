// api/_utils/practiceField/corporateActionSequences.ahead.test.js
//
// T1a-2b-4 final fix (the founder's ruling of 21 Nov 2026, A-1 to A-5) — ROWS THE BATTERY AND THE SOAK ASKED FOR, through the
// S-6 harness (caSequences.js `run`: the real close, windows and founder endpoint, I-1 to I-7 after every close and its
// re-run). The harness lists a close's rows exactly as the step gives them, so an announcement can be listed several sessions
// ahead (Astra's harness clips the vendor to the daily layer's two-day lookahead, where a switch made before both dates is
// rarely reachable — the battery's NA2d survived the rows written there).
//   · a switch made before both dates stays an update after the new id is paid; the replaced id listed again is a re-date;
//   · an announcement listed again after the sale undoes a switch made before it (the sold symbol is still observed);
//   · the soak's three histories (2161123005, 2140002387, 2140002610): a founder's correction pending on one ledger re-posted
//     on the other at every close — $0 there, and, with a late split in between, the split's difference under the old ruling
//     with no approval (the row below). A ruling's correction posts once on a ledger; a later count change is a late_basis.

import { describe, it, expect } from 'vitest';
import { run, generateLate, installSequenceHooks, S } from './__testsupport__/caSequences.js';
import { parseDividendsPayload, parseSplitsPayload } from '../mandateCorporateActions.js';

installSequenceHooks();

const div = (day, amount) => parseDividendsPayload('AAPL', [{ date: S[day], unadjustedValue: amount }]).actions[0];
const spl = (day, ratio) => parseSplitsPayload('AAPL', [{ date: S[day], split: ratio }]).actions[0];
const c = (i, rows = [], price = 100, extra = {}) => ({ kind: 'close', i, price, rows, ...extra });
const at = (fn) => ({ kind: 'expectIdea', fn });
const D = (i) => `cash_dividend_AAPL_${S[i]}`;
const records = (idea, f = 'ledger') => idea[f].corporateActionReceipts.filter((r) => r.reason === 'possible_redate' || r.reason === 'conflicting_action').map((r) => [r.reason, r.actionId]).sort();
const xlk = { type: 'sector_fund', symbols: ['XLK'] };

describe('A-1: a switch made before both dates, through the S-6 harness', () => {
  it('Friday $1 announced Monday, replaced by Wednesday $1 on Tuesday: Wednesday pays once, and the switch stays an update after it is paid', async () => {
    await run({
      seed: 'ahead-switch-paid', comparison: xlk,
      steps: [c(0, [div(4, 1)]), c(1, [div(2, 1)]), c(2, [div(2, 1)]),
        at((idea) => { expect(idea.ledger.dividendsUsd).toBe(99.97); }),
        c(3, [div(2, 1)]),
        at((idea, book, label, ctx) => { expect(records(idea), `${label} no pairing with the paid id`).toEqual([]); expect(ctx.row(S[3]).fullQuality).toBe(true); }),
        c(4, [div(2, 1)]),
        at((idea) => { expect([idea.ledger.dividendsUsd, records(idea)]).toEqual([99.97, []]); })],
    });
  });

  it('…and the replaced id listed again after the other was paid is a re-date of it: it is recorded, and waits', async () => {
    await run({
      seed: 'ahead-switch-undone', comparison: xlk,
      steps: [c(0, [div(4, 1)]), c(1, [div(2, 1)]), c(2, [div(2, 1)]), c(3, [div(2, 1), div(4, 1)]),
        at((idea) => { expect(records(idea)).toEqual([['possible_redate', D(4)]]); }),
        c(4, [div(2, 1), div(4, 1)]),
        at((idea, book, label, ctx) => { expect(idea.ledger.dividendsUsd).toBe(99.97); expect(ctx.row(S[4]).fullQuality).toBe(false); })],
    });
  });

  it('across a sale: Friday announced, replaced by Wednesday (the sale day) before both dates; Friday listed again just after the sale (only then) — Wednesday listed late is a re-date, never a proposal', async () => {
    await run({
      seed: 'ahead-switch-undone-after-sale', comparison: xlk,
      steps: [c(0, [div(4, 1)]), c(1, [div(2, 1)], 100, { belowLine: true }), { kind: 'window', i: 2, price: 100 },
        c(2, [div(4, 1)]),
        at((idea) => { expect(idea.ledger.holdings.AAPL).toBeUndefined(); expect(idea.ledger.saleReceipts[0].sessionDate).toBe(S[2]); }),
        c(3, [div(2, 1)]),
        at((idea) => { expect(records(idea)).toContainEqual(['possible_redate', D(2)]); expect(idea.ledger.lateProposals ?? []).toEqual([]); }),
        { kind: 'lateExact', status: 404, body: { kind: 'late_adjustment', recordId: `late_idea_${D(2)}`, decision: 'approve' } },
        c(4, [div(2, 1)]),
        at((idea) => { expect(idea.ledger.dividendsUsd).toBe(0); })],
    });
  });
});

describe('a founder\'s correction posts once on a ledger (found by the soak)', () => {
  it.each([[2161123005, { refuter: true }], [2140002387, { ahead: true }], [2140002610, { ahead: true }]])('soak seed %i: one ruled_correction per ruling and ledger', async (seed, opts) => {
    const { idea } = await run(generateLate(seed, opts));
    for (const f of ['ledger', 'comparisonLedger']) {
      const keys = (idea[f].adjustments || []).filter((a) => a.kind === 'ruled_correction' && a.held !== true).map((a) => `${a.actionId}:${a.ruling?.requestKey}`);
      expect(keys.length, f).toBe(new Set(keys).size);
    }
  }, 120_000);

  it('a late split listed while the correction waits on the idea\'s ledger: the comparison takes a late_basis PROPOSAL, never a second posting under the old ruling', async () => {
    // 2161123005 is the soak's history: a frozen-basket comparison holds AAPL; the idea sold it at S5; the $0.31 of S1, paid
    // while held, the vendor revised to $0.94, and the founder ruled the correction; a rejected row at S5 defers it on the idea's
    // sold holding (A-4), so the ruling stays pending while the comparison posts it (at S6). Here a 2-for-1 dated S1 is listed at S7.
    const plan = generateLate(2161123005, { refuter: true });
    const steps = [];
    for (const s of plan.steps) {
      if (s.kind === 'close' && s.i >= 7) {
        const rows = s.i === 7 ? [...(s.rowsBySym.AAPL || []), spl(1, '2/1')] : s.rowsBySym.AAPL;
        steps.push({ ...s, prices: { ...s.prices, AAPL: Math.round(s.prices.AAPL * 50) / 100 }, rowsBySym: { ...s.rowsBySym, AAPL: rows } });
        if (s.i === 7) {
          steps.push(at((idea) => {
            const cmp = idea.comparisonLedger;
            expect(cmp.adjustments.filter((a) => a.kind === 'ruled_correction' && a.held !== true).map((a) => a.amountUsd), 'the correction posted once, before the split').toHaveLength(1);
            expect((cmp.lateProposals || []).filter((p) => p.status === 'open' && p.kind === 'late_basis').map((p) => p.actionId)).toContain(D(1));
          }));
        }
        continue;
      }
      if (s.kind === 'late' || s.kind === 'rule') continue; // (no other decision: the proposal must wait for the founder)
      steps.push(s);
    }
    const { idea } = await run({ ...plan, seed: 'correction-once-late-split', steps });
    expect(idea.comparisonLedger.adjustments.filter((a) => a.held !== true).map((a) => a.kind)).toEqual(['ruled_correction']);
  }, 120_000);
});
