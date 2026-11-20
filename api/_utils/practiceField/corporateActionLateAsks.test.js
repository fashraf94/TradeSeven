// api/_utils/practiceField/corporateActionLateAsks.test.js
//
// Practice Field T1a-2b-4, fix round (late data asks, 20 Nov 2026) — ASTRA'S EIGHT FINDINGS (T2E-01 to T2E-08) AS ROWS, and
// the founder's ruling L-1 to L-8 through the real close, sales, founder endpoint and daily builder.
//
//   L-1  no late adjustment posts on its own: a late_entitlement or late_basis is a PROPOSAL on the ledger, alerted; the row
//        and the endpoint read below full quality while it waits; resolve_hold `late_adjustment` approves or declines it.
//   L-2  approval posts the net owed now (ruled payloads, dated count) less everything received for the id — refused (409)
//        while the id is unresolved, pairs under the re-date rule, a share-basis id dated within the holding is unresolved,
//        or a date in the holding interval is uncovered.
//   L-3  closed holdings are screened like held ones (re-date pairing within the close and against rows observed just
//        outside the holding, kept for the window).
//   L-4  counts are recomputed along the dated chain (T2E-04).
//   L-5  two share-basis ids of one symbol and one date are one ambiguity (T2E-06, Q-9).
//   L-6  a correction after a sale leaves a standing reason (T2E-05, Q-5).
//   L-7  parse observations merge, and doubt sticks (T2E-07).
//   L-8  a resulted idea: late data is named and alerted only.
//
// The named histories are reconstructed from Astra's description (her generator extension is not in the attachment):
// __testsupport__/caSequences.js ASTRA_T2E, ASTRA_T2E04, ASTRA_T2E06, ASTRA_T2E08. Each failed at df9b7278.

import { describe, it, expect } from 'vitest';
import { run, installSequenceHooks, S, ASTRA_T2E, ASTRA_T2E04, ASTRA_T2E06, ASTRA_T2E08 } from './__testsupport__/caSequences.js';
import { InputOracle, EntitlementOracle, proposalOf } from './__testsupport__/caOracle.js';
import { parseDividendsPayload, parseSplitsPayload } from '../mandateCorporateActions.js';

installSequenceHooks();

const div = (day, amount) => parseDividendsPayload('AAPL', [{ date: S[day], unadjustedValue: amount }]).actions[0];
const spl = (day, ratio) => parseSplitsPayload('AAPL', [{ date: S[day], split: ratio }]).actions[0];
const cl = (i, price, rows = [], extra = {}) => ({ kind: 'close', i, price, rows, ...extra });
const xlk = { type: 'sector_fund', symbols: ['XLK'] };

describe('the oracle (Astra\'s "Oracle" section) — I-6 scoped, and I-7', () => {
  it('her $0.10/$0.20 variant of T2E-04: an unrelated dividend conflict excuses nothing — I-6 still checks $516.64 (red at df9b7278: $516.65 received)', async () => {
    const conflict = [div(2, 0.1), div(2, 0.2)];
    const out = await run({
      seed: 'oracle-T2E-04-with-unrelated-0.10-0.20', comparison: xlk,
      steps: [cl(0, 100), cl(1, 125), cl(2, 62.5, [spl(2, '2/1'), ...conflict]), cl(3, 62.5, [spl(1, '4/5'), spl(2, '2/1'), div(3, 3.23), ...conflict])],
    });
    expect(out.idea.ledger.dividendsUsd).toBe(516.64);
    expect(out.entitlement.checked, 'the $3.23 dividend was checked, not excused').toBeGreaterThan(0);
  });

  it('I-7 is derived from the inputs alone: an adjustment with no approval or ruling in the request log fails; its approval passes', () => {
    const inputs = new InputOracle(S);
    const e = new EntitlementOracle(S, inputs);
    const idea = { ledger: { adjustments: [{ kind: 'late_entitlement', actionId: `cash_dividend_AAPL_${S[1]}`, amountUsd: 99.97, amountPerShare: 1, postedOn: S[4] }] } };
    expect(() => e.checkAuthority(idea, 4, 'unit'), 'no approval: I-7 fails').toThrow(/I-7 ledger cash_dividend_AAPL_2026-11-17/);
    inputs.ruling({ kind: 'late_adjustment', recordId: `late_comparison_cash_dividend_AAPL_${S[1]}`, decision: 'approve' }, { status: 200 }, 'k1', 4);
    expect(() => e.checkAuthority(idea, 4, 'unit'), 'another ledger\'s approval is not this one\'s').toThrow(/I-7/);
    inputs.ruling({ kind: 'late_adjustment', recordId: `late_idea_cash_dividend_AAPL_${S[1]}`, decision: 'approve' }, { status: 409 }, 'k2', 4);
    expect(() => e.checkAuthority(idea, 4, 'unit'), 'a refused approval authorizes nothing').toThrow(/I-7/);
    inputs.ruling({ kind: 'late_adjustment', recordId: `late_idea_cash_dividend_AAPL_${S[1]}`, decision: 'approve' }, { status: 200 }, 'k3', 5);
    expect(() => e.checkAuthority(idea, 4, 'unit'), 'an approval made after the posting close is too late').toThrow(/I-7/);
    inputs.ruling({ kind: 'late_adjustment', recordId: `late_idea_cash_dividend_AAPL_${S[1]}`, decision: 'approve' }, { status: 200 }, 'k4', 4);
    expect(() => e.checkAuthority(idea, 4, 'unit')).not.toThrow();
    expect(proposalOf(`late_spy_cash_dividend_SPY_${S[2]}_2`)).toEqual({ field: 'spyLedger', actionId: `cash_dividend_SPY_${S[2]}`, n: 2 });
  });

  it('I-7: a ruled_correction needs an accepted conflict ruling choosing exactly its payload', () => {
    const inputs = new InputOracle(S);
    const e = new EntitlementOracle(S, inputs);
    const id = `cash_dividend_AAPL_${S[2]}`;
    const idea = { comparisonLedger: { adjustments: [{ kind: 'ruled_correction', actionId: id, amountUsd: 99.97, payload: { amount: 2 }, postedOn: S[5] }] } };
    inputs.ruling({ kind: 'conflict', recordId: id, decision: 'payload', payload: { amount: 3 } }, { status: 200 }, 'k1', 5);
    expect(() => e.checkAuthority(idea, 5, 'unit')).toThrow(/I-7 comparisonLedger/);
    inputs.ruling({ kind: 'conflict', recordId: id, decision: 'payload', payload: { amount: 2 } }, { status: 200 }, 'k2', 5);
    expect(() => e.checkAuthority(idea, 5, 'unit')).not.toThrow();
  });
});

describe('T2E-01, T2E-02, T2E-03 — late data on a dividend id moves no money without the founder (Astra\'s named seeds)', () => {
  for (const plan of ASTRA_T2E) it(plan.seed, async () => { await run(plan); });
});

describe('T2E-04 — counts recomputed along the dated chain: $516.64 on every affected ledger and the book, both listing orders', () => {
  for (const plan of ASTRA_T2E04) it(plan.seed, async () => { await run(plan); });
});

describe('T2E-06 (Q-9) — same-date opposite share-basis ids hold: no dividend, no sale (2011202612 to 2011202619)', () => {
  for (const plan of ASTRA_T2E06) it(plan.seed, async () => { await run(plan); });
});

describe('T2E-08 — a rejected in-holding row is not forgotten once the line is sold: $0 and below full quality on both arms', () => {
  for (const plan of ASTRA_T2E08) it(plan.seed, async () => { await run(plan); });
});
