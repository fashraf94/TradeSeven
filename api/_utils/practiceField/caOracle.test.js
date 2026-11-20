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
    // (Fix round, L-4: the count is the DATED chain of the applied receipts — the message names it.)
    expect(() => o.check(ideaWith([], { shares: 199.940016 }), S[1], 't', ENTRY)).toThrow(/shares = the dated receipt chain/);
    const wrong = { ...paid(ID1, 1, S[1]), incomeUsd: 199.94 };
    expect(() => o.check(ideaWith([wrong]), S[1], 't', ENTRY)).toThrow(/income = amount × the count held when applied/);
    expect(() => o.check(ideaWith([paid(ID1, 1, S[1])]), S[1], 't', ENTRY)).not.toThrow();
  });

  // The final fix's refuter (AR3-O1 to O3): the founder's split was never an account of its id; a pending one met only rows of
  // its id in the same close; and a payload key without a delisting's cash or a rename's target, an income check against any
  // count the holding ever had.
  const SPLIT2 = `split_AAPL_${S[2]}`;
  const pendingAt = (ratio, since, at = 3) => new Map([[SPLIT2, { ratio, since, suspectedOn: S[2], at }]]);
  it('AR3-O1: a pending founder split and the vendor\'s same ratio under another date (outside the gap) are possible re-dates of each other — either moving is rejected', () => {
    const o = new InputOracle(S);
    o.close(2, []);
    o.close(3, [spl(1, '2/1')], { pendingSplits: pendingAt(2, S[1]) });
    expect(o.ambiguousSinceOn(ideaWith([]).ledger, SPLIT1)).toBe(3);
    expect(o.ambiguousSinceOn(ideaWith([]).ledger, SPLIT2)).toBe(3);
    expect(() => o.check(ideaWith([split(SPLIT1, 2, S[3])], { shares: 199.940016 }), S[3], 't', ENTRY)).toThrow(/I-2 \(inputs\)/);
  });
  it('AR3-O1, as built: a row inside the record\'s gap explains the move (B2), and an action the feed settled before the ruling is a move of its own (T2D-11) — neither is marked', () => {
    const inGap = new InputOracle(S);
    inGap.close(3, [spl(1, '2/1')], { pendingSplits: pendingAt(2, S[0]) });
    expect(inGap.ambiguousSinceOn(ideaWith([]).ledger, SPLIT1)).toBeNull();
    const settled = new InputOracle(S);
    settled.close(1, [spl(1, '2/1')]);
    settled.close(3, [spl(1, '2/1')], { pendingSplits: pendingAt(2, S[1]) });
    const l = ideaWith([split(SPLIT1, 2, S[1])], { shares: 199.940016 }).ledger;
    expect(settled.ambiguousSinceOn(l, SPLIT2)).toBeNull();
    expect(settled.founderExcused).toBeGreaterThan(0);
    // …settled by the founder's own conflict ruling too (the final soak's 1911203378: she chose another ratio for that id).
    const byFounder = ideaWith([split(SPLIT1, 1.25, S[1], { founderRuling: { kind: 'conflict' } })], { shares: 124.96251 }).ledger;
    expect(settled.ambiguousSinceOn(byFounder, SPLIT2)).toBeNull();
    // …but not by one settled only AFTER the ruling: then the two are possible re-dates of each other.
    expect(settled.ambiguousSinceOn(ideaWith([split(SPLIT1, 2, S[3])], { shares: 199.940016 }).ledger, SPLIT2)).toBe(3);
  });
  it('AR3-O2: a vendor ratio listed for the id at an EARLIER close that differs from the founder\'s pending split makes the id ambiguous', () => {
    const o = new InputOracle(S);
    o.close(2, [spl(2, '3/2')]);
    o.close(3, [], { pendingSplits: pendingAt(2, S[1]) });
    expect(o.ambiguousSinceOn(ideaWith([]).ledger, SPLIT2)).toBe(3);
  });
  it('AR3-O3: a delisting\'s cash is part of its payload, and a dividend\'s income must use the count held when it was applied', () => {
    const o = new InputOracle(S);
    const del = (v) => ({ type: 'delisting', ticker: 'AAPL', effectiveDate: S[2], cashPerShare: v });
    o.close(2, [del(10), del(12)]);
    expect(o.ambiguousSinceOn(ideaWith([]).ledger, `delisting_AAPL_${S[2]}`)).toBe(2);
    // A $1 dividend paid AFTER a 2:1 on the pre-split count (99.97, not 199.94) is rejected, though that count was held once.
    const after = [split(SPLIT1, 2, S[1]), paid(ID3, 1, S[3])];
    expect(() => o.check(ideaWith(after, { shares: 199.940016 }), S[3], 't', ENTRY)).toThrow(/income = amount × the count held when applied/);
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

// ── T1a-2b-4: I-6's own rows (EntitlementOracle). A weakened or disabled I-6 must fail here: it is told the inputs and
// the holding history, and it rejects a ledger paid more, or less, than that history was owed — a late dividend after a
// sale not paid, a late split never reflected, a dividend owed nothing paid — and excuses only what the product holds in
// doubt, counting it.
describe('I-6 — every ledger is paid what its holding was owed, from the inputs and its holding history alone', () => {
  const held = (soldAt = null) => ({ ledger: { sym: 'AAPL', entryShares: SH, boughtAt: 0, soldAt } });
  const withAdj = (idea, adjustments) => ({ ...idea, ledger: { ...idea.ledger, adjustments } });
  // (Fix round, L-1: late money is owed only once the founder approved it. Unapproved, it WAITS — counted; an adjustment
  // with no approval in the inputs is rejected in every branch: a wait is never a payment.)
  const approval = (o, ledger, id, at) => o.ruling({ kind: 'late_adjustment', recordId: `late_${ledger}_${id}`, decision: 'approve' }, { status: 200 }, `a-${ledger}-${id}-${at}`, at);
  it('T2D-03: a dividend dated while held, first listed after the sale — unapproved it waits (paid anyway: rejected); approved, NOT paid — rejected; paid by its late entitlement — passes', async () => {
    const { EntitlementOracle } = await import('./__testsupport__/caOracle.js');
    const o = new InputOracle(S);
    o.close(3, [div(1, 1)]);
    const e = new EntitlementOracle(S, o);
    const sold = { ...ideaWith([]), ledger: { ...ideaWith([]).ledger, holdings: {} } };
    const le = (on) => ({ kind: 'late_entitlement', actionId: ID1, amountUsd: 99.97, postedOn: on });
    e.check(sold, 3, held(2), 'plant');
    expect([e.checked, e.waiting]).toEqual([0, 1]);
    expect(() => e.check(withAdj(sold, [le(S[3])]), 3, held(2), 'plant')).toThrow(/\$99\.97 moved by adjustments the inputs never approved/);
    approval(o, 'idea', ID1, 4);
    expect(() => e.check(sold, 4, held(2), 'plant')).toThrow(/I-6 ledger cash_dividend_AAPL_2026-11-17: received \$0, the inputs and the holding history say \$99\.97/);
    expect(() => e.check(withAdj(sold, [le(S[4])]), 4, held(2), 'plant')).not.toThrow();
    // Paid twice is rejected too.
    expect(() => e.check(withAdj(sold, [le(S[4]), le(S[4])]), 4, held(2), 'plant')).toThrow(/received \$199\.94/);
  });
  it('T2D-04: a split listed after a dividend paid on the old count — unapproved it waits; approved, the old payment alone is rejected; with its late_basis it passes', async () => {
    const { EntitlementOracle } = await import('./__testsupport__/caOracle.js');
    const o = new InputOracle(S);
    o.close(2, [div(2, 1)]);
    o.close(3, [div(2, 1), spl(1, '5/4')]);
    const e = new EntitlementOracle(S, o);
    const idea = ideaWith([paid(`cash_dividend_AAPL_${S[2]}`, 1, S[2])]);
    e.check(idea, 3, held(), 'plant');
    expect([e.checked, e.waiting]).toEqual([0, 1]);
    approval(o, 'idea', `cash_dividend_AAPL_${S[2]}`, 4);
    expect(() => e.check(idea, 4, held(), 'plant')).toThrow(/received \$99\.97, the inputs and the holding history say \$124\.96/);
    expect(() => e.check(withAdj(idea, [{ kind: 'late_basis', actionId: `cash_dividend_AAPL_${S[2]}`, amountUsd: 24.99, postedOn: S[4] }]), 4, held(), 'plant')).not.toThrow();
  });
  it('a dividend owed nothing (dated after the sale) that was paid is rejected, never excused; a doubt excuses equality and is counted', async () => {
    const { EntitlementOracle } = await import('./__testsupport__/caOracle.js');
    const o = new InputOracle(S);
    o.close(4, [div(4, 1)]);
    approval(o, 'idea', `cash_dividend_AAPL_${S[4]}`, 4);
    const e = new EntitlementOracle(S, o);
    const idea = withAdj({ ...ideaWith([]), caCoverageGaps: { AAPL: { since: S[3] } } }, [{ kind: 'late_entitlement', actionId: `cash_dividend_AAPL_${S[4]}`, amountUsd: 99.97, postedOn: S[4] }]);
    expect(() => e.check(idea, 4, held(2), 'plant')).toThrow(/is owed nothing/);
    const o2 = new InputOracle(S);
    o2.close(3, [div(3, 1)]);
    const e2 = new EntitlementOracle(S, o2);
    e2.check({ ...ideaWith([]), caCoverageGaps: { AAPL: { since: S[2] } } }, 3, held(), 'plant');
    expect([e2.checked, e2.excused]).toEqual([0, 1]);
  });
  it('an id ambiguous by the inputs is checked only once the founder\'s accepted ruling chose its payload', async () => {
    const { EntitlementOracle } = await import('./__testsupport__/caOracle.js');
    const o = new InputOracle(S);
    o.close(2, [div(2, 1), div(2, 2)]);
    const e = new EntitlementOracle(S, o);
    e.check(ideaWith([]), 2, held(), 'plant');
    expect([e.checked, e.excused]).toEqual([0, 1]);
    o.ruling({ kind: 'conflict', recordId: `cash_dividend_AAPL_${S[2]}`, decision: 'payload', payload: { amount: 2 } }, { status: 200 }, 'r1', 3);
    expect(() => e.check(ideaWith([]), 3, held(), 'plant')).toThrow(/say \$199\.94/);
  });
});
