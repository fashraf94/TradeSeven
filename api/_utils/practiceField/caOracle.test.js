// api/_utils/practiceField/caOracle.test.js
//
// Practice Field T1a-2b-3, final fix (Astra's round-2 confirmation) — THE INDEPENDENT I-2 ORACLE'S OWN ROWS
// (__testsupport__/caOracle.js). The oracle is test support; these rows make sure it rejects what Astra showed the old
// check accepted, so a weakened oracle cannot pass the sequence files silently: a movement authorized only by a
// `suspicion` ruling, one authorized by a conflict ruling choosing ANOTHER payload, one with no receipt behind it, and an
// ambiguity it must derive from the rows alone (a conflict, a revision, a re-date, a founder split's disagreeing vendor row).

import { describe, it, expect } from 'vitest';
import { InputOracle } from './__testsupport__/caOracle.js';
import { parseSplitsPayload, parseDividendsPayload } from '../mandateCorporateActions.js';
import { nextSessionDate } from './windows.js';

const S = ['2026-11-16'];
while (S.length < 12) S.push(nextSessionDate(S.at(-1)));
const div = (i, v) => parseDividendsPayload('AAPL', [{ date: S[i], unadjustedValue: v }]).actions[0];
const spl = (i, v) => parseSplitsPayload('AAPL', [{ date: S[i], split: v }]).actions[0];
const SH = 99.970008;
const ENTRY = { ledger: { AAPL: { shares: SH } }, comparisonLedger: { AAPL: { shares: SH } }, spyLedger: {} };

/** An idea whose idea ledger applied `receipts` (the comparison and SPY lines untouched). */
function ideaWith(receipts, { dividendsUsd = null, shares = SH } = {}) {
  const income = receipts.reduce((t, r) => t + (Number(r.incomeUsd) || 0), 0);
  const plain = { holdings: { AAPL: { shares: SH } }, dividendsUsd: 0, corporateActionReceipts: [] };
  return {
    ledger: { holdings: { AAPL: { shares } }, dividendsUsd: dividendsUsd ?? Math.round(income * 100) / 100, corporateActionReceipts: receipts },
    comparisonLedger: plain, spyLedger: { holdings: {}, dividendsUsd: 0, corporateActionReceipts: [] },
  };
}
const paid = (id, amount, on, extra = {}) => ({ actionId: id, type: 'cash_dividend', ticker: 'AAPL', effectiveDate: id.slice(-10), ratio: null, amount, incomeUsd: Math.round(amount * SH * 100) / 100, applied: true, appliedOn: on, ...extra });
const split = (id, ratio, on, extra = {}) => ({ actionId: id, type: 'split', ticker: 'AAPL', effectiveDate: id.slice(-10), ratio, amount: null, incomeUsd: 0, applied: true, appliedOn: on, sharesBefore: SH, sharesAfter: Math.round(SH * ratio * 1e6) / 1e6, ...extra });
const ID1 = `cash_dividend_AAPL_${S[1]}`;
const ID3 = `cash_dividend_AAPL_${S[3]}`;
const SPLIT1 = `split_AAPL_${S[1]}`;

describe('the independent I-2 oracle — ambiguity from the inputs, authorization from the harness\'s own requests', () => {
  it('a conflict in the rows makes the id ambiguous; paying it without a ruling is rejected, and a matching conflict ruling authorizes it', () => {
    const o = new InputOracle(S);
    o.close(1, [div(1, 1), div(1, 2)]);
    expect(o.ambiguousSinceOn(ideaWith([]).ledger, ID1)).toBe(1);
    expect(() => o.check(ideaWith([paid(ID1, 1, S[2])]), S[2], 't', ENTRY)).toThrow(/I-2 \(inputs\)/);
    o.ruling({ kind: 'conflict', recordId: ID1, decision: 'payload', payload: { amount: 2 } }, { status: 200 }, 'k', 2);
    expect(() => o.check(ideaWith([paid(ID1, 1, S[2])]), S[2], 't', ENTRY), 'a ruling choosing ANOTHER payload authorizes nothing').toThrow(/I-2 \(inputs\)/);
    o.ruling({ kind: 'conflict', recordId: ID1, decision: 'payload', payload: { amount: 1 } }, { status: 422 }, 'k2', 2);
    expect(() => o.check(ideaWith([paid(ID1, 1, S[2])]), S[2], 't', ENTRY), 'a REJECTED request authorizes nothing').toThrow(/I-2 \(inputs\)/);
    o.ruling({ kind: 'conflict', recordId: ID1, decision: 'payload', payload: { amount: 1 } }, { status: 200 }, 'k3', 2);
    expect(() => o.check(ideaWith([paid(ID1, 1, S[2])]), S[2], 't', ENTRY)).not.toThrow();
  });

  it('a receipt naming a founder ruling of another kind authorizes nothing (Astra: the old check accepted any truthy founderRuling)', () => {
    const o = new InputOracle(S);
    o.close(1, [div(1, 1), div(1, 2)]);
    o.ruling({ kind: 'coverage_gap', recordId: `ca_coverage_gap_AAPL_${S[0]}`, decision: 'row', actionId: ID1 }, { status: 200 }, 'g', 2);
    expect(() => o.check(ideaWith([paid(ID1, 1, S[2], { founderRuling: { kind: 'coverage_gap' } })]), S[2], 't', ENTRY)).toThrow(/I-2 \(inputs\)/);
  });

  it('T2D-D02\'s shape: a pending founder split met by a disagreeing vendor row of its id — its own 2:1, applied under a `suspicion` ruling, is rejected', () => {
    const o = new InputOracle(S);
    o.close(1, []);
    o.ruling({ kind: 'suspicion', recordId: `suspected_split_AAPL_${S[1]}`, decision: 'split', ratio: 2 }, { status: 200 }, 's', 2);
    o.close(2, [spl(1, '3/2'), spl(1, '5/4')], { pendingSplits: new Map([[SPLIT1, 2]]), uncoveredSyms: ['AAPL'] });
    expect(o.ambiguousSinceOn(ideaWith([]).ledger, SPLIT1)).toBe(2);
    expect(o.shapes().d02).toBe(1);
    const idea = ideaWith([split(SPLIT1, 2, S[3], { founderRuling: { kind: 'suspicion' } })], { shares: 199.940016 });
    expect(() => o.check(idea, S[3], 't', ENTRY)).toThrow(/I-2 \(inputs\)/);
    // An AGREEING vendor row is no ambiguity: the founder's split moves the count, authorized by nothing more.
    const p = new InputOracle(S);
    p.close(1, []);
    p.ruling({ kind: 'suspicion', recordId: `suspected_split_AAPL_${S[1]}`, decision: 'split', ratio: 2 }, { status: 200 }, 's', 2);
    p.close(2, [spl(1, '2/1')], { pendingSplits: new Map([[SPLIT1, 2]]) });
    expect(p.ambiguousSinceOn(ideaWith([]).ledger, SPLIT1)).toBeNull();
    expect(() => p.check(idea, S[3], 't', ENTRY)).not.toThrow();
  });

  it('T2D-D01\'s shape: a founder-settled id shows a new payload and its re-date in ONE close — the re-date is ambiguous from that close', () => {
    const o = new InputOracle(S);
    o.close(1, [div(1, 1), div(1, 2)]);
    o.ruling({ kind: 'conflict', recordId: ID1, decision: 'none' }, { status: 200 }, 'n', 2);
    o.close(2, []);
    o.close(3, [div(3, 3), div(1, 3)]);
    expect(o.ambiguousSinceOn(ideaWith([]).ledger, ID3)).toBe(3);
    expect(o.shapes().d01).toBe(1);
    expect(() => o.check(ideaWith([paid(ID3, 3, S[3])]), S[3], 't', ENTRY)).toThrow(/I-2 \(inputs\)/);
  });

  it('a revision of an id listed before is ambiguity; a re-date through a payload the FEED corrected after settling the id is carved out (T2D-05, carried) and counted', () => {
    const o = new InputOracle(S);
    o.close(1, [div(1, 0.5)]);
    o.close(2, [div(1, 0.75)]);
    expect(o.ambiguousSinceOn(ideaWith([]).ledger, ID1)).toBe(2);
    o.close(3, [div(1, 0.75), div(3, 0.75)]);
    const settled = paid(ID1, 0.5, S[1]);
    expect(o.ambiguousSinceOn(ideaWith([settled]).ledger, ID3), 'the feed settled ID1 at $0.50 before it listed $0.75').toBeNull();
    expect(o.carveOuts).toBe(1);
    // …but not once the founder settled it (that is T2D-D01, not T2D-05).
    expect(o.ambiguousSinceOn(ideaWith([{ ...settled, founderRuling: { kind: 'conflict' } }]).ledger, ID3)).toBe(3);
  });

  it('conservation: dividends with no receipt, a share count off its receipt chain, or income that is not the receipt\'s own amount are rejected', () => {
    const o = new InputOracle(S);
    o.close(1, [div(1, 1)]);
    expect(() => o.check(ideaWith([], { dividendsUsd: 99.97 }), S[1], 't', ENTRY)).toThrow(/dividends = Σ receipts/);
    expect(() => o.check(ideaWith([], { shares: 199.940016 }), S[1], 't', ENTRY)).toThrow(/shares = receipt chain/);
    const wrong = { ...paid(ID1, 1, S[1]), incomeUsd: 199.94 };
    expect(() => o.check(ideaWith([wrong]), S[1], 't', ENTRY)).toThrow(/income = amount × a count held/);
    expect(() => o.check(ideaWith([paid(ID1, 1, S[1])]), S[1], 't', ENTRY)).not.toThrow();
  });

  it('C03\'s order on one id: an ex-date conflict; the old id overlapping its re-date; the new row only; the old row only', () => {
    const o = new InputOracle(S);
    o.close(1, [div(1, 1), div(1, 2)]);
    o.close(2, [div(1, 1), div(2, 2)]);
    o.close(3, [div(2, 2)]);
    o.close(4, [div(1, 1)]);
    expect(o.shapes().c03).toBe(1);
    const pairs = o.orderedPairs({ idea: ['AAPL'] });
    expect(pairs['idea conflict → dropped']).toBe(1);
    expect(pairs['idea dropped → returned']).toBe(1);
  });
});
