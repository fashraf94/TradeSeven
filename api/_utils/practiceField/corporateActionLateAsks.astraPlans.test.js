// api/_utils/practiceField/corporateActionLateAsks.astraPlans.test.js
//
// Practice Field T1a-2b-4, fix round (late data asks, 20 Nov 2026) — ASTRA'S FOUR GENERATOR PLANS, VERBATIM, from her
// review's "Copyable generator inputs for the dark-merge blockers" (docs/audits/20261120_ASTRA_REVIEW_T1A2B4.md). Below
// this header the file is her code block exactly as she wrote it. Each plan fails at df9b7278 (T2E-01, T2E-02 and T2E-03
// paid late data without a ruling; T2E-04 rounded a settled cent differently when two splits arrived out of date order)
// and passes under the founder's ruling of 20 Nov 2026 (L-1 to L-8).

import { expect, it } from 'vitest';
import { S, run, installSequenceHooks } from './__testsupport__/caSequences.js';
import { parseDividendsPayload, parseSplitsPayload } from '../mandateCorporateActions.js';

installSequenceHooks();
const dividend = (day, amount) =>
  parseDividendsPayload('AAPL', [{ date: S[day], unadjustedValue: amount }]).actions[0];
const split = (day, ratio) =>
  parseSplitsPayload('AAPL', [{ date: S[day], split: ratio }]).actions[0];
const close = (i, price, rows = [], extra = {}) => ({ kind: 'close', i, price, rows, ...extra });
const income = (usd) => ({
  kind: 'expectIdea',
  fn: (idea) => expect(idea.ledger.dividendsUsd).toBe(usd),
});
const sold = [
  close(0, 100), close(1, 94, [], { belowLine: true }),
  { kind: 'window', i: 2, price: 94 }, close(2, 94),
];
const plans = [
  ['T2E-01', [...sold, close(3, 94, [dividend(1, 1), dividend(2, 1)]), income(0)]],
  ['T2E-02', [...sold, close(3, 94, [dividend(3, 1)]), close(4, 94, [dividend(2, 1)]), income(0)]],
  ['T2E-03', [close(0, 100), close(1, 100), close(2, 100, [dividend(2, 1)]),
    close(3, 100, [dividend(2, 2)]), close(4, 80, [split(1, '5/4'), dividend(2, 2)]), income(99.97)]],
  ['T2E-04', [close(0, 100), close(1, 125), close(2, 62.5, [split(2, '2/1')]),
    close(3, 62.5, [split(1, '4/5'), split(2, '2/1'), dividend(3, 3.23)]), income(516.64)]],
];
for (const [seed, steps] of plans) {
  it(seed, async () => {
    await run({ seed, steps, comparison: { type: 'sector_fund', symbols: ['XLK'] } });
  });
}
