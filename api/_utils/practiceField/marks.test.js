// api/_utils/practiceField/marks.test.js
//
// Practice Field T1a-1 — THE ELIGIBLE-MARK RULE and THE ONE FILL WRAPPER (build prompt §6, §7a requirement 1;
// acceptance cases B-FILL and B-NOFILL).
//
//   B-FILL    a decision at 10:20 never receives a mark observed before 10:20; a carried-forward mark and a
//             receipt-time substitute never qualify as a fresh fill;
//   B-NOFILL  with no eligible mark for a symbol NO fill of any kind happens on it — not an entry, a trim or a
//             sale — and the quarterly engine's exit fallback to a carried mark or to average cost
//             (mandateExecution.js computeExecution's exit lane) never applies to an idea book.

import { describe, it, expect } from 'vitest';
import { eligibleMark, closeMarkQuality, quotePastMaxAge, MARK_REFUSAL } from './marks.js';
import { executeIdeaFill } from './fills.js';
import { newLedger, LEDGER_KIND } from './ledger.js';
import { computeExecution } from '../mandateExecution.js';
import { isPracticeFieldError } from './errors.js';
import { tickSnapshot, snapshotOf, etIso, makeMandateFakeDb, DAYS } from './__testsupport__/fixtures.js';

const D = DAYS.d1; // Monday 16 Nov 2026
const at = (h, m) => etIso(D, h, m);
const snap = (quotes, extra = {}) => ({ ...snapshotOf({ tickKey: `${D}_midday`, sessionDate: D, builtAt: at(12, 46), quoteAt: at(12, 30), quotes }), ...extra });
const opts = (notBefore = etIso(DAYS.admit, 11, 0)) => ({ notBeforeIso: notBefore, sessionDate: D });

describe('Q-1 and E5 — the cost tier of a fill', () => {
  const ledger = () => newLedger(LEDGER_KIND.IDEA, 20000);
  const fill = (quote, extra = {}) => executeIdeaFill({ ledger: ledger(), verb: 'BUY', symbol: 'AAPL', sizeUsd: 5000, snapshot: snap({ AAPL: quote }), ...opts(), ...extra });

  it('a BUY whose tier cannot be resolved is refused `cost_tier_unknown` by the wrapper itself — never bought at the widest tier', () => {
    for (const marketCap of [null, 0, -1, 'big']) {
      let err = null;
      try { fill({ price: 231.47, marketCap }); } catch (e) { err = e; }
      expect(isPracticeFieldError(err, 'cost_tier_unknown'), String(marketCap)).toBe(true);
      expect(err.detail).toMatchObject({ symbol: 'AAPL', verb: 'BUY', capTier: 'unknown' });
    }
    // A fund has no market cap and needs none.
    const spy = executeIdeaFill({ ledger: ledger(), verb: 'BUY', symbol: 'SPY', sizeUsd: 5000, snapshot: snap({ SPY: 597.31 }), ...opts() });
    expect(spy.receipt.costTier).toEqual({ capTier: 'fund:liquid_fund', slippageBps: 1, spreadProxyBps: 2 });
  });

  it('a new holding stores the tier it entered with, on the holding and on the receipt; a sale handed a stored tier prices at it, whatever the snapshot says', () => {
    const bought = fill({ price: 231.47, marketCap: 5e9 }); // a mid cap: 10 bps
    const tier = { capTier: 'mid', slippageBps: 3, spreadProxyBps: 7 };
    expect(bought.ledger.holdings.AAPL.costTier).toEqual(tier);
    expect(bought.receipt.costTier).toEqual(tier);
    expect(bought.receipt.executedPrice).toBe(231.47 * (1 + 10 / 10000));
    // Sold later from a snapshot that calls it a mega cap (3 bps): the stored tier decides.
    const megaNow = snap({ AAPL: { price: 240.5, marketCap: 3e12 } });
    const sold = executeIdeaFill({ ledger: bought.ledger, verb: 'SELL', symbol: 'AAPL', snapshot: megaNow, ...opts(), friction: bought.ledger.holdings.AAPL.costTier });
    expect(sold.receipt.executedPrice).toBe(240.5 * (1 - 10 / 10000));
    expect(sold.receipt.costTier).toEqual(tier);
    // With no stored tier handed in, the snapshot's applies (the wrapper's default).
    const unstored = executeIdeaFill({ ledger: bought.ledger, verb: 'SELL', symbol: 'AAPL', snapshot: megaNow, ...opts() });
    expect(unstored.receipt.executedPrice).toBe(240.5 * (1 - 3 / 10000));
    // A stored tier that is not one — an `unknown` name, a missing figure — is refused, never used.
    for (const bad of [{ capTier: 'unknown', slippageBps: 5, spreadProxyBps: 15 }, { capTier: 'mid', slippageBps: 3 }, { capTier: '', slippageBps: 3, spreadProxyBps: 7 }]) {
      expect(() => executeIdeaFill({ ledger: bought.ledger, verb: 'SELL', symbol: 'AAPL', snapshot: megaNow, ...opts(), friction: bad })).toThrow(/cost_tier_unknown/);
    }
  });
});

describe('eligibleMark — the only source of a fill price for an idea book', () => {
  it('a complete quote with the vendor\'s own time, observed in the session and after the decision, qualifies', () => {
    const m = eligibleMark(snap({ AAPL: 231.47 }), 'aapl', opts());
    expect(m).toEqual({ ok: true, symbol: 'AAPL', price: 231.47, quoteTs: Date.parse(at(12, 30)) / 1000, vendorTimeIso: at(12, 30) });
  });

  it('no_quote: an absent symbol, an incomplete quote, a zero price', () => {
    expect(eligibleMark(snap({ MSFT: 418.13 }), 'AAPL', opts())).toEqual({ ok: false, symbol: 'AAPL', refusal: MARK_REFUSAL.NO_QUOTE });
    expect(eligibleMark(snap({ AAPL: { price: null } }), 'AAPL', opts()).refusal).toBe('no_quote');
    // An entry the builder marked incomplete is refused even if a positive price sits on it.
    const incomplete = snap({ AAPL: 231.47 }); incomplete.symbols.AAPL.complete = false;
    expect(eligibleMark(incomplete, 'AAPL', opts()).refusal).toBe('no_quote');
    const zero = snap({ AAPL: 231.47 }); zero.symbols.AAPL.price = 0;
    expect(eligibleMark(zero, 'AAPL', opts()).refusal).toBe('no_quote');
    expect(eligibleMark(null, 'AAPL', opts()).refusal).toBe('no_quote');
  });

  it('receipt_time_only: a quote with no vendor time is refused although its priceAsOf looks fresh (the builder stamped its own fetch instant)', () => {
    const s = snap({ AAPL: { price: 231.47, at: null } });
    expect(s.symbols.AAPL.priceAsOf).toBe(at(12, 46)); // the fetch instant, inside the session and after the decision
    expect(s.symbols.AAPL.quoteTs).toBeNull();
    expect(eligibleMark(s, 'AAPL', opts())).toEqual({ ok: false, symbol: 'AAPL', refusal: MARK_REFUSAL.RECEIPT_TIME_ONLY });
  });

  it('carried_forward: a quote the vendor last printed in an earlier session, a flagged carry, a snapshot built for another session', () => {
    expect(eligibleMark(snap({ AAPL: { price: 231.47, at: etIso(DAYS.admit, 15, 59) } }), 'AAPL', opts()).refusal).toBe('carried_forward');
    const flagged = snap({ AAPL: 231.47 }); flagged.symbols.AAPL.carriedForward = true;
    expect(eligibleMark(flagged, 'AAPL', opts()).refusal).toBe('carried_forward');
    expect(eligibleMark(snap({ AAPL: 231.47 }, { sessionDate: DAYS.d2 }), 'AAPL', opts()).refusal).toBe('carried_forward');
  });

  it('outside_session: a pre-market or an after-hours print of the same day', () => {
    expect(eligibleMark(snap({ AAPL: { price: 231.47, at: at(9, 29) } }), 'AAPL', opts()).refusal).toBe('outside_session');
    expect(eligibleMark(snap({ AAPL: { price: 231.47, at: at(16, 1) } }), 'AAPL', opts()).refusal).toBe('outside_session');
    // The session's own bounds are inside (each in a snapshot built a minute after the print: Q-2's age is another row's).
    expect(eligibleMark(snap({ AAPL: { price: 231.47, at: at(9, 30) } }, { builtAt: new Date(at(9, 31)) }), 'AAPL', opts()).ok).toBe(true);
    expect(eligibleMark(snap({ AAPL: { price: 231.47, at: at(16, 0) } }, { builtAt: new Date(at(16, 1)) }), 'AAPL', opts()).ok).toBe(true);
  });

  it('B-FILL — before_decision: a decision at 10:20 never receives a mark observed before, or AT, 10:20', () => {
    const decision = at(10, 20);
    expect(eligibleMark(snap({ AAPL: { price: 231.47, at: at(10, 19) } }), 'AAPL', opts(decision)).refusal).toBe('before_decision');
    expect(eligibleMark(snap({ AAPL: { price: 231.47, at: at(10, 20) } }), 'AAPL', opts(decision)).refusal).toBe('before_decision');
    expect(eligibleMark(snap({ AAPL: { price: 231.47, at: at(10, 21) } }, { builtAt: new Date(at(10, 22)) }), 'AAPL', opts(decision)).ok).toBe(true);
  });

  it('Q-2 — stale_quote: a quote more than 20 minutes old at the window\'s tick (the stored snapshot\'s own build time) is refused; exactly 20 minutes is not', () => {
    // The tick is 12:46 (snap's build time). 12:26 is exactly twenty minutes before it; 12:25 is twenty-one.
    expect(eligibleMark(snap({ AAPL: { price: 231.47, at: at(12, 26) } }), 'AAPL', opts()).ok).toBe(true);
    expect(eligibleMark(snap({ AAPL: { price: 231.47, at: at(12, 25) } }), 'AAPL', opts())).toEqual({ ok: false, symbol: 'AAPL', refusal: MARK_REFUSAL.STALE_QUOTE });
    expect(MARK_REFUSAL.STALE_QUOTE).toBe('stale_quote');
    // The tick is the DOCUMENT's: a build time as a Firestore Timestamp or an ISO string reads the same…
    const stamp = { toDate: () => new Date(at(12, 46)) };
    expect(eligibleMark(snap({ AAPL: { price: 231.47, at: at(12, 25) } }, { builtAt: stamp }), 'AAPL', opts()).refusal).toBe('stale_quote');
    expect(eligibleMark(snap({ AAPL: { price: 231.47, at: at(12, 26) } }, { builtAt: at(12, 46) }), 'AAPL', opts()).ok).toBe(true);
    // …and a snapshot with no readable build time certifies no age.
    for (const builtAt of [undefined, null, 'soon', 1794849000]) {
      expect(eligibleMark(snap({ AAPL: 231.47 }, { builtAt }), 'AAPL', opts()).refusal, String(builtAt)).toBe('stale_quote');
    }
    // The earlier refusals are tested first: a stale quote from before the decision is `before_decision`.
    expect(eligibleMark(snap({ AAPL: { price: 231.47, at: at(10, 19) } }), 'AAPL', opts(at(10, 20))).refusal).toBe('before_decision');
  });

  it('quotePastMaxAge asks the SAME question as the age test above, alone — so a sale can tell a quote that merely predates its decision from one that has not printed for more than twenty minutes', () => {
    // The tick is 12:46. Exactly twenty minutes is not past the age; one second more is — as eligibleMark judges.
    expect(quotePastMaxAge(snap({ AAPL: { price: 231.47, at: at(12, 26) } }), 'AAPL')).toBe(false);
    const oneSecondMore = new Date(Date.parse(at(12, 26)) - 1000).toISOString();
    expect(quotePastMaxAge(snap({ AAPL: { price: 231.47, at: oneSecondMore } }), 'AAPL')).toBe(true);
    expect(eligibleMark(snap({ AAPL: { price: 231.47, at: oneSecondMore } }), 'AAPL', opts()).refusal).toBe('stale_quote');
    expect(quotePastMaxAge(snap({ AAPL: { price: 231.47, at: at(12, 45) } }), 'AAPL')).toBe(false);
    expect(quotePastMaxAge(snap({ AAPL: { price: 231.47, at: at(11, 0) } }), 'AAPL')).toBe(true);
    // A fractional vendor time is judged by the same arithmetic as eligibleMark's (no truncation between the two):
    // a quote at 12:26:00.5 against a build at 12:46:00.5 is EXACTLY twenty minutes old — not past the age. Truncated
    // to the whole second it would read twenty minutes and half a second (fourth refuter pass).
    const fractional = snap({ AAPL: { price: 231.47, at: at(12, 26) } }, { builtAt: new Date(Date.parse(at(12, 46)) + 500) });
    fractional.symbols.AAPL.quoteTs += 0.5;
    expect(quotePastMaxAge(fractional, 'AAPL')).toBe(false);
    expect(eligibleMark(fractional, 'AAPL', opts()).ok).toBe(true);
    // The build time as a Timestamp or an ISO string reads the same; one that cannot be read certifies no age.
    expect(quotePastMaxAge(snap({ AAPL: { price: 231.47, at: at(12, 26) } }, { builtAt: { toDate: () => new Date(at(12, 46)) } }), 'AAPL')).toBe(false);
    expect(quotePastMaxAge(snap({ AAPL: { price: 231.47, at: at(12, 26) } }, { builtAt: at(12, 46) }), 'AAPL')).toBe(false);
    for (const builtAt of [undefined, null, 'soon', 1794849000]) expect(quotePastMaxAge(snap({ AAPL: 231.47 }, { builtAt }), 'AAPL'), String(builtAt)).toBe(true);
    // No vendor time, no quote, no symbol: nothing certifies an age.
    expect(quotePastMaxAge(snap({ AAPL: { price: 231.47, at: null } }), 'AAPL')).toBe(true);
    expect(quotePastMaxAge(snap({ AAPL: 231.47 }), 'MSFT')).toBe(true);
    expect(quotePastMaxAge(snap({ AAPL: 231.47 }), null)).toBe(true);
  });

  it('Q-3 — closeMarkQuality: a print the vendor timed before that session\'s open is not full quality; one at the open is', () => {
    const entry = (h, m) => snap({ AAPL: { price: 231.47, at: at(h, m) } }).symbols.AAPL;
    expect(closeMarkQuality(entry(9, 29), D)).toEqual({ quality: 'pre_open_print', vendorTimeIso: at(9, 29) });
    expect(closeMarkQuality(entry(4, 0), D).quality).toBe('pre_open_print');
    expect(closeMarkQuality(entry(9, 30), D).quality).toBe('vendor_time');
    expect(closeMarkQuality(entry(16, 0), D).quality).toBe('vendor_time');
    expect(closeMarkQuality(entry(19, 55), D).quality).toBe('vendor_time'); // after the close, on the session's date: the post-close snapshot value
  });

  it('a price that is not a real positive number is no quote; a vendor time that is not epoch seconds is no vendor time (review L3-5)', () => {
    for (const bad of ['231.47', true, Infinity, -1, NaN]) {
      const s = snap({ AAPL: 231.47 }); s.symbols.AAPL.price = bad;
      expect(eligibleMark(s, 'AAPL', opts()).refusal, String(bad)).toBe('no_quote');
      expect(closeMarkQuality(s.symbols.AAPL, D).quality, String(bad)).toBe('carried_forward');
    }
    for (const bad of [0, -5, Date.parse(at(12, 30)), 1e13, Infinity, '1794849000']) { // zero, negative, MILLISECONDS, absurd, a string
      const s = snap({ AAPL: 231.47 }); s.symbols.AAPL.quoteTs = bad;
      expect(eligibleMark(s, 'AAPL', opts()).refusal, String(bad)).toBe('receipt_time_only');
      expect(closeMarkQuality(s.symbols.AAPL, D).quality, String(bad)).toBe('receipt_time_fallback');
    }
  });

  it('refuses to run without a decision instant or off the maintained calendar (never a guess)', () => {
    expect(() => eligibleMark(snap({ AAPL: 231.47 }), 'AAPL', { sessionDate: D })).toThrow(/notBeforeIso/);
    expect(() => eligibleMark(snap({ AAPL: 231.47 }), 'AAPL', { notBeforeIso: at(10, 0), sessionDate: '2026-11-15' })).toThrow(/not a trading session/); // Sunday
    expect(() => eligibleMark(snap({ AAPL: 231.47 }), 'AAPL', { notBeforeIso: at(10, 0), sessionDate: '2028-01-04' })).toThrow(/not a trading session/);
  });
});

describe('closeMarkQuality — a valuation mark\'s label (never a fill)', () => {
  const close = (q) => snapshotOf({ tickKey: `${D}_close`, sessionDate: D, builtAt: at(16, 20), quoteAt: at(16, 0), quotes: { AAPL: q } }).symbols.AAPL;
  it('vendor_time / receipt_time_fallback / carried_forward', () => {
    expect(closeMarkQuality(close(231.47), D)).toEqual({ quality: 'vendor_time', vendorTimeIso: at(16, 0) });
    expect(closeMarkQuality(close({ price: 231.47, at: null }), D)).toEqual({ quality: 'receipt_time_fallback', vendorTimeIso: null });
    expect(closeMarkQuality(close({ price: 231.47, at: etIso(DAYS.admit, 16, 0) }), D).quality).toBe('carried_forward');
    expect(closeMarkQuality(close({ price: null }), D)).toEqual({ quality: 'carried_forward', vendorTimeIso: null });
    expect(closeMarkQuality(null, D).quality).toBe('carried_forward');
  });
});

describe('executeIdeaFill — every fill goes through the eligible mark', () => {
  const ctx = (snapshot, extra = {}) => ({ snapshot, notBeforeIso: etIso(DAYS.admit, 11, 0), sessionDate: D, ...extra });
  const held = () => {
    // A ledger that bought AAPL at an eligible mark, through the wrapper itself.
    const s = tickSnapshot(D, 'open30', { AAPL: { price: 231.47, marketCap: 3.4e12 } });
    return executeIdeaFill({ ledger: newLedger(LEDGER_KIND.IDEA, 20000), verb: 'BUY', symbol: 'AAPL', sizeUsd: 20000, ...ctx(s), sector: 'Technology' });
  };

  it('a BUY fills at the eligible mark plus friction, shares floored, cost in whole cents, friction recorded once', () => {
    const { ledger, receipt } = held();
    const execPrice = 231.47 * (1 + 3 / 10000); // mega tier: 1 + 2 bps
    expect(receipt.executedPrice).toBe(execPrice);
    expect(receipt.shares).toBe(Math.floor((20000 / execPrice) * 1e6) / 1e6);
    expect(receipt.markSource).toBe('snapshot');
    expect(receipt.mark).toBe(231.47);
    expect(receipt.friction.capTier).toBe('mega');
    expect(receipt.frictionModelVersion).toBe('p3_cap_tier_v1');
    expect(ledger.cash).toBe(Math.round((20000 - receipt.executedSizeUsd) * 100) / 100);
    expect(ledger.holdings.AAPL).toMatchObject({ shares: receipt.shares, costBasisTotal: receipt.executedSizeUsd, sector: 'Technology', openedAt: D, lastMark: 231.47 });
    expect(ledger.costsPaidUsd).toBe(receipt.friction.frictionPaid);
    expect(ledger.costsPaidUsd).toBeGreaterThan(0);
  });

  it('a SELL and a TRIM at an eligible mark fill, and the ledger stays conserved (cash + basis = reserved + realised)', () => {
    const start = held().ledger;
    const s = snap({ AAPL: { price: 240.19, marketCap: 3.4e12 } });
    const trim = executeIdeaFill({ ledger: start, verb: 'TRIM', symbol: 'AAPL', sizeUsd: 5000, ...ctx(s) });
    expect(trim.receipt.markSource).toBe('snapshot');
    const cents = (n) => Math.round(n * 100);
    expect(cents(trim.ledger.cash) + cents(trim.ledger.holdings.AAPL.costBasisTotal)).toBe(cents(20000) + cents(trim.ledger.realizedPnlUsd));
    const sell = executeIdeaFill({ ledger: trim.ledger, verb: 'SELL', symbol: 'AAPL', ...ctx(s) });
    expect(sell.ledger.holdings.AAPL).toBeUndefined();
    expect(cents(sell.ledger.cash)).toBe(cents(20000) + cents(sell.ledger.realizedPnlUsd));
    // The source ledger is never mutated.
    expect(start.holdings.AAPL.shares).toBe(held().ledger.holdings.AAPL.shares);
  });

  for (const verb of ['SELL', 'TRIM']) {
    it(`B-NOFILL — a ${verb} whose only price is a CARRIED mark is refused (the engine alone would fill it at carry_over)`, () => {
      const ledger = held().ledger; // lastMark 231.47 is on the holding
      const noQuote = snap({ MSFT: 418.13 });
      // What the quarterly engine does with the same inputs — the fallback this wrapper must never reach:
      const engine = computeExecution({ decision: { verb, ticker: 'AAPL', sizeUsd: 5000 }, execSizeUsd: 5000, positions: ledger.holdings, cash: ledger.cash, snapshot: noQuote });
      expect(engine.ok).toBe(true);
      expect(engine.receipt.markSource).toBe('carry_over');
      let err = null;
      try { executeIdeaFill({ ledger, verb, symbol: 'AAPL', sizeUsd: 5000, ...ctx(noQuote) }); } catch (e) { err = e; }
      expect(isPracticeFieldError(err, 'no_eligible_mark')).toBe(true);
      expect(err.detail).toEqual({ symbol: 'AAPL', verb, refusal: 'no_quote' });
    });

    it(`B-NOFILL — a ${verb} whose only price is AVERAGE COST is refused (the engine alone would fill it at basis)`, () => {
      const base = held().ledger;
      const ledger = { ...base, holdings: { AAPL: { ...base.holdings.AAPL, lastMark: null } } };
      const noQuote = snap({ MSFT: 418.13 });
      const engine = computeExecution({ decision: { verb, ticker: 'AAPL', sizeUsd: 5000 }, execSizeUsd: 5000, positions: ledger.holdings, cash: ledger.cash, snapshot: noQuote });
      expect(engine.ok).toBe(true);
      expect(engine.receipt.markSource).toBe('basis');
      expect(() => executeIdeaFill({ ledger, verb, symbol: 'AAPL', sizeUsd: 5000, ...ctx(noQuote) })).toThrow(/no_eligible_mark/);
    });

    it(`B-NOFILL — a ${verb} is refused on a receipt-time quote too, although the engine would call that mark 'snapshot'`, () => {
      const ledger = held().ledger;
      const receiptTime = snap({ AAPL: { price: 240.19, at: null } });
      const engine = computeExecution({ decision: { verb, ticker: 'AAPL', sizeUsd: 5000 }, execSizeUsd: 5000, positions: ledger.holdings, cash: ledger.cash, snapshot: receiptTime });
      expect(engine.receipt.markSource).toBe('snapshot'); // the engine cannot tell — only the eligible-mark rule can
      let err = null;
      try { executeIdeaFill({ ledger, verb, symbol: 'AAPL', sizeUsd: 5000, ...ctx(receiptTime) }); } catch (e) { err = e; }
      expect(isPracticeFieldError(err, 'no_eligible_mark')).toBe(true);
      expect(err.detail.refusal).toBe('receipt_time_only');
    });
  }

  it('B-NOFILL — the second lock: a fill the engine priced at anything but the snapshot is refused even with an eligible mark in hand', () => {
    const ledger = held().ledger;
    const s = snap({ AAPL: { price: 240.19, marketCap: 3.4e12 } });
    for (const markSource of ['carry_over', 'basis', undefined]) {
      const compute = (args) => { const out = computeExecution(args); return { ...out, receipt: { ...out.receipt, markSource } }; };
      let err = null;
      try { executeIdeaFill({ ledger, verb: 'SELL', symbol: 'AAPL', ...ctx(s), compute }); } catch (e) { err = e; }
      expect(isPracticeFieldError(err, 'fill_mark_not_snapshot')).toBe(true);
    }
  });

  it('the third lock: a fill priced at any mark but the eligible one is refused', () => {
    const ledger = held().ledger;
    const s = snap({ AAPL: { price: 240.19, marketCap: 3.4e12 } });
    const compute = (args) => { const out = computeExecution(args); return { ...out, receipt: { ...out.receipt, executedPrice: out.receipt.executedPrice + 0.01 } }; };
    expect(() => executeIdeaFill({ ledger, verb: 'SELL', symbol: 'AAPL', ...ctx(s), compute })).toThrow(/fill_mark_mismatch/);
  });

  it('a BUY with no eligible mark is refused; an unknown verb is refused; an engine refusal is typed', () => {
    const fresh = newLedger(LEDGER_KIND.IDEA, 20000);
    expect(() => executeIdeaFill({ ledger: fresh, verb: 'BUY', symbol: 'AAPL', sizeUsd: 20000, ...ctx(snap({ AAPL: { price: 231.47, at: null } })) })).toThrow(/no_eligible_mark/);
    expect(() => executeIdeaFill({ ledger: fresh, verb: 'HOLD', symbol: 'AAPL', ...ctx(snap({ AAPL: 231.47 })) })).toThrow(/fill_verb_unsupported/);
    // A leg sized above the ledger's cash: the engine gates it, and the wrapper types that refusal.
    let err = null;
    try { executeIdeaFill({ ledger: fresh, verb: 'BUY', symbol: 'AAPL', sizeUsd: 25000, ...ctx(snap({ AAPL: 231.47 })) }); } catch (e) { err = e; }
    expect(isPracticeFieldError(err, 'fill_refused')).toBe(true);
    expect(err.detail).toMatchObject({ status: 'gated', reason: 'insufficient_cash' });
  });

  it('B-NOFILL — inside a transaction a refused SELL changes nothing and records nothing as executed', async () => {
    const db = makeMandateFakeDb();
    const start = held();
    const bookRef = db.collection('mandates').doc('book-x');
    const ideaRef = bookRef.collection('ideas').doc('idea-x');
    await bookRef.set({ kind: 'idea_book', revision: 3, portfolio: { cash: 80000 + start.ledger.cash, positions: { AAPL: { ...start.ledger.holdings.AAPL, ideaId: 'idea-x' } } } });
    await ideaRef.set({ ideaId: 'idea-x', ledger: start.ledger });
    const before = JSON.stringify([...db._store.entries()]);
    for (const [verb, snapshot] of [['SELL', snap({ MSFT: 418.13 })], ['TRIM', snap({ AAPL: { price: 240.19, at: null } })]]) {
      await expect(db.runTransaction(async (tx) => {
        const idea = (await tx.get(ideaRef)).data();
        const book = (await tx.get(bookRef)).data();
        tx.set(bookRef.collection('decisions').doc(`${verb}-1`), { status: 'executed', verb }); // buffered BEFORE the fill is computed
        const out = executeIdeaFill({ ledger: idea.ledger, verb, symbol: 'AAPL', sizeUsd: 5000, ...ctx(snapshot) });
        tx.set(ideaRef, { ...idea, ledger: out.ledger });
        tx.update(bookRef, { revision: book.revision + 1 });
      })).rejects.toThrow(/no_eligible_mark/);
    }
    expect(JSON.stringify([...db._store.entries()])).toBe(before);
    expect([...db._store.keys()].filter((p) => p.includes('/decisions/'))).toEqual([]);
  });
});
