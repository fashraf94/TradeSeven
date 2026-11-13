// api/_utils/practiceField/close.test.js
//
// Practice Field T1a-1 — THE IDEA-BOOK CLOSE (build prompt §7, §7a requirements 2 and 3; Amendment C §7 cases
// B-MARK and B-STAMP; shared contract V2 §14 case B-RECON): valuation every session, corporate actions once per
// ledger, comparisons that stay matched, and rows that are marks — never sales.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { closeIdeaBook, closeSnapshotKeyFor } from './close.js';
import { admitIdea } from './admission.js';
import { enterIdea } from './entry.js';
import { assertReconciled } from './reconcile.js';
import { setPracticeFieldModeForTests } from './mode.js';
import { roundUsd } from '../mandateRounding.js';
import {
  seedBook, admitAndEnter, closeOn, contractOf, getBook, getIdea, getRow, closeSnapshot, tickSnapshot, tickOf, slotOpenIso, etIso, DAYS, ADMIT_ISO,
  countDocs, makeMandateFakeDb,
} from './__testsupport__/fixtures.js';

const CAP = { AAPL: 3.4e12, MSFT: 3.1e12, NVDA: 3.5e12, LLY: 7.5e11, AMD: 2.6e11, AVGO: 8.2e11 };
const ENTRY = { AAPL: 231.47, MSFT: 418.13, NVDA: 141.29, LLY: 803.17, AMD: 139.83, AVGO: 172.91, SPY: 597.31, XLK: 233.59, XLV: 147.23 };
const entryQuotes = (...syms) => Object.fromEntries(syms.map((s) => [s, CAP[s] ? { price: ENTRY[s], marketCap: CAP[s] } : ENTRY[s]]));
const cents = (n) => Math.round(n * 100);
const openIdeas = (db, bookId) => getBook(db, bookId).openIdeaIds.map((id) => getIdea(db, bookId, id));
const SESSIONS = ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-27', '2026-11-30', '2026-12-01', '2026-12-02'];
/** A deterministic, decimal, non-repeating price path: day i moves each symbol by its own small step. */
const pathPrice = (sym, i) => roundUsd(ENTRY[sym] * (1 + ((i * 37 + sym.charCodeAt(0) * 13 + sym.length * 7) % 211 - 105) / 4000));
const dayQuotes = (i, ...syms) => Object.fromEntries(syms.map((s) => [s, pathPrice(s, i)]));
const FORBIDDEN_ON_A_MARK_ROW = /proceeds|realized|realised|sold|liquidat/i;
const keysDeep = (v, out = []) => {
  if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { out.push(k); keysDeep(x, out); }
  return out;
};

let restoreMode;
beforeEach(() => { restoreMode = setPracticeFieldModeForTests('on'); });
afterEach(() => restoreMode());

describe('a valuation: every ledger marked from the one close snapshot', () => {
  it('writes the idea\'s row and the book\'s row, both `basis: mark`, labelled post_close_snapshot, carrying the snapshot\'s key and build time', async () => {
    const { db, bookId } = await seedBook();
    const r = await admitAndEnter(db, bookId, { contract: contractOf({ names: ['AAPL', 'MSFT'], comparison: { type: 'sector_fund', symbols: ['XLK'] } }), quotes: entryQuotes('AAPL', 'MSFT', 'SPY', 'XLK') });
    const prices = { AAPL: 233.11, MSFT: 420.77, SPY: 599.02, XLK: 234.93 };
    const out = await closeOn(db, bookId, DAYS.d1, prices);
    expect(out.closed).toBe(true);
    expect(out.alerts).toEqual([]);

    const idea = getIdea(db, bookId, r.ideaId);
    const row = getRow(db, bookId, r.ideaId, DAYS.d1);
    const built = etIso(DAYS.d1, 16, 20);
    expect(row).toMatchObject({
      rowKind: 'valuation', basis: 'mark', label: 'post_close_snapshot', date: DAYS.d1, ideaId: r.ideaId, bookId,
      closeSnapshotKey: `${DAYS.d1}_close`, closeSnapshotBuiltAt: built, reservedCapitalUsd: 20000, comparisonType: 'sector_fund', fullQuality: true,
    });
    // value = cash + Σ shares × mark, the holdings rounded once.
    const holdings = idea.ledger.holdings;
    const rawHoldings = holdings.AAPL.shares * prices.AAPL + holdings.MSFT.shares * prices.MSFT;
    expect(row.markedHoldingsValue).toBe(roundUsd(rawHoldings));
    expect(cents(row.markedValue)).toBe(cents(row.cash) + cents(row.markedHoldingsValue));
    expect(row.cash).toBe(idea.ledger.cash);
    expect(row.quantities).toEqual({ AAPL: holdings.AAPL.shares, MSFT: holdings.MSFT.shares });
    expect(row.marks.AAPL).toEqual({ mark: 233.11, quality: 'vendor_time', markSource: 'snapshot', vendorTimeIso: etIso(DAYS.d1, 16, 0) });
    expect(row.cumulativeCostsUsd).toBe(idea.ledger.costsPaidUsd);
    expect(row.comparisonQuantities).toEqual({ XLK: idea.comparisonLedger.holdings.XLK.shares });
    expect(row.comparisonMarkedValue).toBe(roundUsd(idea.comparisonLedger.cash + roundUsd(idea.comparisonLedger.holdings.XLK.shares * prices.XLK)));
    expect(row.spyMarkedValue).toBe(roundUsd(idea.spyLedger.cash + roundUsd(idea.spyLedger.holdings.SPY.shares * prices.SPY)));
    expect(row.raw.markedValue).toBe(idea.ledger.cash + rawHoldings);

    // The marks are written back onto every ledger and onto the book's positions.
    expect(idea.ledger.holdings.AAPL).toMatchObject({ lastMark: 233.11, lastMarkAsOf: etIso(DAYS.d1, 16, 0), lastMarkSource: 'snapshot' });
    expect(idea.comparisonLedger.holdings.XLK.lastMark).toBe(234.93);
    expect(idea.spyLedger.holdings.SPY.lastMark).toBe(599.02);
    const book = getBook(db, bookId);
    expect(book.portfolio.positions.MSFT).toMatchObject({ lastMark: 420.77, ideaId: r.ideaId });

    // The book's row: equity = treasury + reserved + positions, each a displayed part.
    const bookRow = db._get(`mandates/${bookId}/dailyRows/${DAYS.d1}`);
    expect(bookRow).toMatchObject({
      kind: 'idea_book', rowKind: 'valuation', basis: 'mark', label: 'post_close_snapshot', date: DAYS.d1,
      closeSnapshotKey: `${DAYS.d1}_close`, closeSnapshotBuiltAt: built, treasuryCash: 80000, reservedCash: idea.ledger.cash,
      markedPositionsValue: roundUsd(rawHoldings), costsToDateUsd: idea.ledger.costsPaidUsd, positionCount: 2, openIdeaIds: [r.ideaId], fullQuality: true,
    });
    expect(cents(bookRow.markedEquity)).toBe(cents(bookRow.treasuryCash) + cents(bookRow.reservedCash) + cents(bookRow.markedPositionsValue));
    expect(book.portfolio.totalValue).toBe(bookRow.markedEquity);
    // No quarter lens, no scoring stream.
    for (const f of ['quarterIndex', 'quarterDrawdown', 'agencyState', 'regime', 'dayReturnPct']) expect(Object.hasOwn(bookRow, f), f).toBe(false);
    expect(countDocs(db, `mandates/${bookId}/pendingScoringAppends/`)).toBe(0);
    expect(book).toMatchObject({ revision: 3, execState: { lastCloseKey: DAYS.d1 }, health: { consecutiveCloseFailures: 0 } });
    expect(book.health.lastCloseAttemptAt).toBeInstanceOf(Date);
    expect(() => assertReconciled(book, [idea])).not.toThrow();
  });

  it('is idempotent per date: a replayed close writes nothing', async () => {
    const { db, bookId } = await seedBook();
    await admitAndEnter(db, bookId, { contract: contractOf(), quotes: entryQuotes('AAPL', 'SPY') });
    await closeOn(db, bookId, DAYS.d1, { AAPL: 233.11, SPY: 599.02 });
    const versions = [...db._store.keys()].map((p) => [p, db._versionOf(p)]);
    const replay = await closeOn(db, bookId, DAYS.d1, { AAPL: 199.99, SPY: 512.34 }); // even with other prices in hand
    expect(replay).toEqual({ closed: false, skipped: 'already_closed', alerts: [] });
    expect([...db._store.keys()].map((p) => [p, db._versionOf(p)])).toEqual(versions);
  });

  it('an idea that has not entered gets no valuation row; its reserved cash is in the book\'s row', async () => {
    const { db, bookId } = await seedBook();
    // Admitted during D1: its start session is D2, so D1's close leaves it accepted.
    const a = await admitIdea(db, { bookId, contract: contractOf(), opId: 'idea-1', nowIso: etIso(DAYS.d1, 11, 0) });
    const out = await closeOn(db, bookId, DAYS.d1, { SPY: 599.02 });
    expect(out).toMatchObject({ closed: true, cancelled: [], ideaRows: {} });
    expect(getIdea(db, bookId, a.ideaId).status).toBe('accepted');
    expect(db._get(`mandates/${bookId}/dailyRows/${DAYS.d1}`)).toMatchObject({ markedEquity: 100000, treasuryCash: 80000, reservedCash: 20000, markedPositionsValue: 0, positionCount: 0 });
  });

  it('an accepted idea whose start session is over is cancelled entry_timeout at that session\'s close — its reservation returns, nothing was bought', async () => {
    const { db, bookId } = await seedBook();
    const a = await admitIdea(db, { bookId, contract: contractOf(), opId: 'idea-1', nowIso: ADMIT_ISO }); // start session D1
    const out = await closeOn(db, bookId, DAYS.d1, { AAPL: 233.11, SPY: 599.02 });
    expect(out.cancelled).toEqual([a.ideaId]);
    expect(getIdea(db, bookId, a.ideaId)).toMatchObject({ status: 'cancelled', cancelled: { reason: 'entry_timeout', returnedToTreasuryUsd: 20000 } });
    const book = getBook(db, bookId);
    expect(book).toMatchObject({ treasury: { unreservedCash: 100000 }, slots: { short: null }, openIdeaIds: [] });
    expect(book.portfolio).toMatchObject({ cash: 100000, positions: {} });
    expect(db._get('practiceFieldCoverage/current').symbols).toEqual({});
    expect(db._get(`mandates/${bookId}/dailyRows/${DAYS.d1}`)).toMatchObject({ treasuryCash: 100000, reservedCash: 0, openIdeaIds: [] });
    expect(countDocs(db, `mandates/${bookId}/decisions/`)).toBe(0);
  });
});

describe('matched comparisons', () => {
  it('same_stock_held ties its comparison TO THE CENT over ten closes with no actions', async () => {
    const { db, bookId } = await seedBook();
    const names = ['AAPL', 'MSFT', 'NVDA'];
    const r = await admitAndEnter(db, bookId, { contract: contractOf({ names }), quotes: entryQuotes(...names, 'SPY') });
    const seen = new Set();
    for (let i = 0; i < 10; i += 1) {
      const out = await closeOn(db, bookId, SESSIONS[i], dayQuotes(i + 1, ...names, 'SPY'));
      expect(out.closed, SESSIONS[i]).toBe(true);
      const row = getRow(db, bookId, r.ideaId, SESSIONS[i]);
      expect(row.markedValue, SESSIONS[i]).toBe(row.comparisonMarkedValue);
      expect(row.markedGapUsd).toBe(0);
      expect(row.markedGapPct).toBe(0);
      expect(row.raw.markedGapUsd).toBe(0);
      expect(row.fullQuality).toBe(true);
      seen.add(row.markedValue);
    }
    expect(seen.size).toBe(10); // ten different values: the tie is not a constant
  });

  it('the gap is computed from the ROUNDED, displayed values — never from the raw ones — with the raw values beside it', async () => {
    const { db, bookId } = await seedBook();
    const r = await admitAndEnter(db, bookId, { contract: contractOf({ names: ['AAPL', 'MSFT'], comparison: { type: 'frozen_basket', symbols: ['NVDA', 'AMD', 'AVGO'] } }), quotes: entryQuotes('AAPL', 'MSFT', 'NVDA', 'AMD', 'AVGO', 'SPY') });
    let differs = 0;
    for (let i = 0; i < 12; i += 1) {
      await closeOn(db, bookId, SESSIONS[i], dayQuotes(i + 1, 'AAPL', 'MSFT', 'NVDA', 'AMD', 'AVGO', 'SPY'));
      const row = getRow(db, bookId, r.ideaId, SESSIONS[i]);
      const displayed = cents(row.markedValue) - cents(row.comparisonMarkedValue);
      expect(cents(row.markedGapUsd), SESSIONS[i]).toBe(displayed);
      expect(row.markedGapPct).toBe((displayed * 100) / 2000000);
      expect(cents(row.markedGapToSpyUsd)).toBe(cents(row.markedValue) - cents(row.spyMarkedValue));
      expect(row.raw.markedGapUsd).toBe(row.raw.markedValue - row.raw.comparisonMarkedValue);
      if (cents(roundUsd(row.raw.markedGapUsd)) !== displayed) differs += 1;
    }
    // The fixture really distinguishes the two bases: on some days rounding the raw gap gives a different cent.
    expect(differs).toBeGreaterThan(0);
  });
});

describe('corporate actions: once per ledger', () => {
  const split = { type: 'split', ticker: 'AAPL', effectiveDate: DAYS.d3, ratio: 2, source: 'eodhd_splits' };
  const dividend = { type: 'cash_dividend', ticker: 'AAPL', effectiveDate: DAYS.d2, amount: 0.26, source: 'eodhd_dividends' };
  const spyDividend = { type: 'cash_dividend', ticker: 'SPY', effectiveDate: DAYS.d2, amount: 1.83, source: 'eodhd_dividends' };

  it('a 2-for-1 split moves the idea\'s quantity, the book\'s, the comparison\'s and the line level by the same ratio, and the book still reconciles', async () => {
    const { db, bookId } = await seedBook();
    const r = await admitAndEnter(db, bookId, { contract: contractOf({ names: ['AAPL', 'MSFT'] }), quotes: entryQuotes('AAPL', 'MSFT', 'SPY') });
    await closeOn(db, bookId, DAYS.d1, { AAPL: 233.11, MSFT: 420.77, SPY: 599.02 });
    await closeOn(db, bookId, DAYS.d2, { AAPL: 234.5, MSFT: 419.9, SPY: 600.1 });
    const before = getIdea(db, bookId, r.ideaId);
    const beforeRow = getRow(db, bookId, r.ideaId, DAYS.d2);
    const out = await closeOn(db, bookId, DAYS.d3, { AAPL: { price: 117.25, corporateActions: [split] }, MSFT: 419.9, SPY: 600.1 });
    expect(out.alerts).toEqual([]);
    const idea = getIdea(db, bookId, r.ideaId);
    const book = getBook(db, bookId);
    const shares = before.ledger.holdings.AAPL.shares;
    expect(idea.ledger.holdings.AAPL.shares).toBe(roundSharesOf(shares * 2));
    expect(idea.comparisonLedger.holdings.AAPL.shares).toBe(roundSharesOf(shares * 2));
    expect(book.portfolio.positions.AAPL.shares).toBe(roundSharesOf(shares * 2));
    expect(idea.ledger.holdings.AAPL.costBasisTotal).toBe(before.ledger.holdings.AAPL.costBasisTotal); // basis unchanged
    expect(idea.ledger.holdings.MSFT.shares).toBe(before.ledger.holdings.MSFT.shares);
    const lineBefore = before.lines.find((l) => l.symbol === 'AAPL');
    const lineAfter = idea.lines.find((l) => l.symbol === 'AAPL');
    expect(lineAfter.level).toBe(lineBefore.level / 2);
    expect(lineAfter.adjustments).toEqual([{ actionId: `split_AAPL_${DAYS.d3}`, ratio: 2, appliedOn: DAYS.d3 }]);
    expect(idea.lines.find((l) => l.symbol === 'MSFT')).toEqual(before.lines.find((l) => l.symbol === 'MSFT'));
    expect(idea.ledger.cash).toBe(before.ledger.cash); // a split moves no cash
    // The value is continuous across the split (234.50 → 117.25 × 2) and still ties the comparison.
    const row = getRow(db, bookId, r.ideaId, DAYS.d3);
    expect(row.markedValue).toBe(beforeRow.markedValue);
    expect(row.markedValue).toBe(row.comparisonMarkedValue);
    expect(row.fullQuality).toBe(true);
    expect(row.corporateActionsApplied).toEqual({ idea: [`split_AAPL_${DAYS.d3}`], comparison: [`split_AAPL_${DAYS.d3}`], spy: [] });
    expect(db._get(`mandates/${bookId}/corporateActions/split_AAPL_${DAYS.d3}`)).toMatchObject({ type: 'split', ticker: 'AAPL', ratio: 2, applied: true, ideaId: r.ideaId, effectiveDate: DAYS.d3 });
    expect(() => assertReconciled(book, [idea])).not.toThrow();
  });

  it('a dividend credits the cash of whichever ledger holds the shares — ONCE, although the feed presents it on every later close in its window', async () => {
    const { db, bookId } = await seedBook();
    const r = await admitAndEnter(db, bookId, { contract: contractOf({ names: ['AAPL'], comparison: { type: 'sector_fund', symbols: ['XLK'] } }), quotes: entryQuotes('AAPL', 'SPY', 'XLK') });
    await closeOn(db, bookId, DAYS.d1, { AAPL: 233.11, SPY: 599.02, XLK: 234.93 });
    const before = getIdea(db, bookId, r.ideaId);
    const bookBefore = getBook(db, bookId);
    const withActions = (aapl, spy, xlk) => ({ AAPL: { price: aapl, corporateActions: [dividend] }, SPY: { price: spy, corporateActions: [spyDividend] }, XLK: xlk });

    await closeOn(db, bookId, DAYS.d2, withActions(232.9, 597.4, 234.1));
    const idea = getIdea(db, bookId, r.ideaId);
    const book = getBook(db, bookId);
    const income = roundUsd(before.ledger.holdings.AAPL.shares * 0.26);
    const spyIncome = roundUsd(before.spyLedger.holdings.SPY.shares * 1.83);
    expect(idea.ledger).toMatchObject({ cash: roundUsd(before.ledger.cash + income), dividendsUsd: income, appliedActionIds: [`cash_dividend_AAPL_${DAYS.d2}`] });
    expect(cents(book.portfolio.cash)).toBe(cents(bookBefore.portfolio.cash) + cents(income)); // the book's cash, once
    expect(book.treasury.unreservedCash).toBe(80000); // a dividend stays in its idea
    expect(idea.spyLedger).toMatchObject({ cash: roundUsd(before.spyLedger.cash + spyIncome), dividendsUsd: spyIncome, appliedActionIds: [`cash_dividend_SPY_${DAYS.d2}`] });
    expect(idea.comparisonLedger.cash).toBe(before.comparisonLedger.cash); // XLK paid nothing
    expect(idea.ledger.corporateActionReceipts).toEqual([expect.objectContaining({ actionId: `cash_dividend_AAPL_${DAYS.d2}`, applied: true, appliedOn: DAYS.d2, incomeUsd: income, amount: 0.26 })]);
    expect(getRow(db, bookId, r.ideaId, DAYS.d2)).toMatchObject({ dividendsToDateUsd: income, cash: idea.ledger.cash });

    // The NEXT three closes still carry both actions in the feed window. Nothing is credited again.
    for (const date of [DAYS.d3, DAYS.d4, DAYS.d5]) {
      const out = await closeOn(db, bookId, date, withActions(233.4, 598.2, 234.6));
      expect(out.closed, date).toBe(true);
      const later = getIdea(db, bookId, r.ideaId);
      expect(later.ledger.cash, date).toBe(idea.ledger.cash);
      expect(later.ledger.dividendsUsd).toBe(income);
      expect(later.spyLedger.cash).toBe(idea.spyLedger.cash);
      expect(later.ledger.appliedActionIds).toEqual([`cash_dividend_AAPL_${DAYS.d2}`]);
      expect(cents(getBook(db, bookId).portfolio.cash)).toBe(cents(book.portfolio.cash));
      expect(getRow(db, bookId, r.ideaId, date).corporateActionsApplied).toEqual({ idea: [], comparison: [], spy: [] });
    }
    expect(countDocs(db, `mandates/${bookId}/corporateActions/`)).toBe(1); // the book's own positions: AAPL's dividend only
    expect(() => assertReconciled(getBook(db, bookId), openIdeas(db, bookId))).not.toThrow();
  });

  it('one action reaches every ledger that holds the symbol — SPY in two ideas\' ledgers is credited in each, once each', async () => {
    const { db, bookId } = await seedBook({ archetypeCodeId: 'degen' });
    const a = await admitAndEnter(db, bookId, { contract: contractOf({ slot: 'short', names: ['AAPL'] }), opId: 'a', quotes: entryQuotes('AAPL', 'LLY', 'SPY') });
    const bAdmit = await admitIdea(db, { bookId, contract: contractOf({ slot: 'medium', names: ['LLY'], capitalUsd: 25000 }), opId: 'b', nowIso: ADMIT_ISO });
    // (the medium idea enters in the same start session, at the next slot)
    await enterIdea(db, { bookRef: db.collection('mandates').doc(bookId), ideaId: bAdmit.ideaId, tick: tickOf(DAYS.d1, 'midday'), snapshot: tickSnapshot(DAYS.d1, 'midday', entryQuotes('LLY', 'SPY')), nowIso: new Date(Date.parse(slotOpenIso(DAYS.d1, 'midday')) + 120000).toISOString() });
    await closeOn(db, bookId, DAYS.d1, { AAPL: 233.11, LLY: 805.2, SPY: 599.02 });
    const before = [getIdea(db, bookId, a.ideaId), getIdea(db, bookId, bAdmit.ideaId)];
    await closeOn(db, bookId, DAYS.d2, { AAPL: 232.9, LLY: 806.1, SPY: { price: 597.4, corporateActions: [spyDividend] } });
    await closeOn(db, bookId, DAYS.d3, { AAPL: 232.9, LLY: 806.1, SPY: { price: 597.4, corporateActions: [spyDividend] } });
    for (const prior of before) {
      const idea = getIdea(db, bookId, prior.ideaId);
      const income = roundUsd(prior.spyLedger.holdings.SPY.shares * 1.83);
      expect(income).toBeGreaterThan(0);
      expect(idea.spyLedger.cash).toBe(roundUsd(prior.spyLedger.cash + income));
      expect(idea.spyLedger.appliedActionIds).toEqual([`cash_dividend_SPY_${DAYS.d2}`]);
    }
  });

  it('a holding opened ON the effective date is not entitled: declined once, recorded, never credited', async () => {
    const { db, bookId } = await seedBook();
    const r = await admitAndEnter(db, bookId, { contract: contractOf(), quotes: entryQuotes('AAPL', 'SPY') });
    const sameDay = { ...dividend, effectiveDate: DAYS.d1 }; // bought on the ex-date: the price already reflects it
    const before = getIdea(db, bookId, r.ideaId);
    await closeOn(db, bookId, DAYS.d1, { AAPL: { price: 233.11, corporateActions: [sameDay] }, SPY: 599.02 });
    await closeOn(db, bookId, DAYS.d2, { AAPL: { price: 233.4, corporateActions: [sameDay] }, SPY: 599.5 });
    const idea = getIdea(db, bookId, r.ideaId);
    expect(idea.ledger.cash).toBe(before.ledger.cash);
    expect(idea.ledger.dividendsUsd).toBe(0);
    expect(idea.ledger.declinedActionIds).toEqual([`cash_dividend_AAPL_${DAYS.d1}`]);
    expect(idea.ledger.corporateActionReceipts).toEqual([{ actionId: `cash_dividend_AAPL_${DAYS.d1}`, type: 'cash_dividend', ticker: 'AAPL', effectiveDate: DAYS.d1, applied: false, reason: 'not_entitled', seenOn: DAYS.d1 }]);
    expect(getRow(db, bookId, r.ideaId, DAYS.d2).fullQuality).toBe(true);
  });

  it('B-NOFILL / B-MARK — a delisting is NOT applied (the engine\'s is a forced sale at a carried mark): no cash moves; the symbol is held at its carried mark and the row is not full quality', async () => {
    const { db, bookId } = await seedBook();
    const r = await admitAndEnter(db, bookId, { contract: contractOf(), quotes: entryQuotes('AAPL', 'SPY') });
    await closeOn(db, bookId, DAYS.d1, { AAPL: 233.11, SPY: 599.02 });
    const before = getIdea(db, bookId, r.ideaId);
    const delisting = { type: 'delisting', ticker: 'AAPL', effectiveDate: DAYS.d2, source: 'founder' };
    const out = await closeOn(db, bookId, DAYS.d2, { AAPL: { price: 250.01, corporateActions: [delisting] }, SPY: 600.3 });
    const idea = getIdea(db, bookId, r.ideaId);
    expect(idea.ledger.cash).toBe(before.ledger.cash);
    expect(idea.ledger.holdings.AAPL.shares).toBe(before.ledger.holdings.AAPL.shares);
    expect(idea.ledger.appliedActionIds).toEqual([]);
    expect(getBook(db, bookId).portfolio.positions.AAPL).toMatchObject({ shares: before.ledger.holdings.AAPL.shares, lastMark: 233.11, lastMarkSource: 'carry_over' });
    const row = getRow(db, bookId, r.ideaId, DAYS.d2);
    expect(row.marks.AAPL).toMatchObject({ mark: 233.11, quality: 'carried_forward', markSource: 'carry_over' });
    expect(row.fullQuality).toBe(false);
    expect(out.alerts.some((a) => /PRACTICE_FIELD_MARK_HELD_BACK .* AAPL/.test(a))).toBe(true);
    expect(countDocs(db, `mandates/${bookId}/decisions/`)).toBe(1); // the entry's own; no CORPORATE_CLOSE
  });

  it('a gap with a split\'s signature and NO feed entry is not trusted: the symbol is valued at its carried mark, not halved', async () => {
    const { db, bookId } = await seedBook();
    const r = await admitAndEnter(db, bookId, { contract: contractOf(), quotes: entryQuotes('AAPL', 'SPY') });
    await closeOn(db, bookId, DAYS.d1, { AAPL: 233.11, SPY: 599.02 });
    const prior = getRow(db, bookId, r.ideaId, DAYS.d1);
    await closeOn(db, bookId, DAYS.d2, { AAPL: 116.56, SPY: 599.4 }); // ÷2, no split in the feed
    const row = getRow(db, bookId, r.ideaId, DAYS.d2);
    expect(row.marks.AAPL).toMatchObject({ mark: 233.11, quality: 'carried_forward' });
    expect(row.markedValue).toBe(prior.markedValue);
    expect(row.fullQuality).toBe(false);
    // A news-sized move is trusted.
    await closeOn(db, bookId, DAYS.d3, { AAPL: 209.8, SPY: 599.4 });
    expect(getRow(db, bookId, r.ideaId, DAYS.d3).marks.AAPL).toMatchObject({ mark: 209.8, quality: 'vendor_time' });
  });
});

describe('mark quality: missing data stays visible', () => {
  it('a held symbol the snapshot lacks is a carried mark; a quote with no vendor time is a receipt-time fallback; either way the row is not full quality', async () => {
    const { db, bookId } = await seedBook();
    const r = await admitAndEnter(db, bookId, { contract: contractOf({ names: ['AAPL', 'MSFT'], comparison: { type: 'sector_fund', symbols: ['XLK'] } }), quotes: entryQuotes('AAPL', 'MSFT', 'SPY', 'XLK') });
    await closeOn(db, bookId, DAYS.d1, { AAPL: 233.11, MSFT: 420.77, SPY: 599.02, XLK: 234.93 });
    // D2: MSFT is missing; AAPL has no vendor time; XLK's quote is the vendor's from an earlier session.
    await closeOn(db, bookId, DAYS.d2, { AAPL: { price: 234.5, at: null }, SPY: 600.1, XLK: { price: 235.5, at: etIso(DAYS.d1, 16, 0) } });
    const row = getRow(db, bookId, r.ideaId, DAYS.d2);
    expect(row.marks.MSFT).toEqual({ mark: 420.77, quality: 'carried_forward', markSource: 'carry_over', vendorTimeIso: null });
    expect(row.marks.AAPL).toEqual({ mark: 234.5, quality: 'receipt_time_fallback', markSource: 'snapshot', vendorTimeIso: null });
    expect(row.comparisonMarks.XLK).toMatchObject({ mark: 235.5, quality: 'carried_forward' });
    expect(row.spyMarks.SPY.quality).toBe('vendor_time');
    expect(row.fullQuality).toBe(false);
    expect(db._get(`mandates/${bookId}/dailyRows/${DAYS.d2}`).fullQuality).toBe(false);
    expect(getBook(db, bookId).portfolio.positions.MSFT).toMatchObject({ lastMark: 420.77, lastMarkSource: 'carry_over' });
    // One ledger's bad mark alone is enough: D3 has every idea mark fresh, SPY missing.
    await closeOn(db, bookId, DAYS.d3, { AAPL: 234.5, MSFT: 421.1, XLK: 235.5 });
    const d3 = getRow(db, bookId, r.ideaId, DAYS.d3);
    expect(d3.spyMarks.SPY.quality).toBe('carried_forward');
    expect(d3.fullQuality).toBe(false);
  });
});

describe('B-MARK — an account mark is never reported as a liquidation fill', () => {
  it('no valuation row carries a sale\'s word; rows say `basis: mark`; a close writes no decision and no receipt and moves no cash except a dividend', async () => {
    const { db, bookId } = await seedBook({ archetypeCodeId: 'degen' });
    const a = await admitAndEnter(db, bookId, { contract: contractOf({ slot: 'short', names: ['AAPL', 'MSFT'], comparison: { type: 'sector_fund', symbols: ['XLK'] } }), opId: 'a', quotes: entryQuotes('AAPL', 'MSFT', 'SPY', 'XLK') });
    const decisionsAfterEntry = countDocs(db, `mandates/${bookId}/decisions/`);
    const inceptionBefore = JSON.stringify(db._get(`mandates/${bookId}/ideas/${a.ideaId}/rows/inception`));
    const dividend = { type: 'cash_dividend', ticker: 'MSFT', effectiveDate: SESSIONS[3], amount: 0.83, source: 'eodhd_dividends' };
    let cash = getIdea(db, bookId, a.ideaId).ledger.cash;
    let bookCash = getBook(db, bookId).portfolio.cash;
    for (let i = 0; i < 12; i += 1) {
      const quotes = dayQuotes(i + 1, 'AAPL', 'MSFT', 'SPY', 'XLK');
      if (i >= 3 && i <= 6) quotes.MSFT = { price: quotes.MSFT, corporateActions: [dividend] };
      await closeOn(db, bookId, SESSIONS[i], quotes);
      const idea = getIdea(db, bookId, a.ideaId);
      const row = getRow(db, bookId, a.ideaId, SESSIONS[i]);
      const bookRow = db._get(`mandates/${bookId}/dailyRows/${SESSIONS[i]}`);
      for (const mark of [row, bookRow]) {
        expect(mark.basis).toBe('mark');
        expect(keysDeep(mark).filter((k) => FORBIDDEN_ON_A_MARK_ROW.test(k)), SESSIONS[i]).toEqual([]);
        expect(JSON.stringify(mark)).not.toMatch(FORBIDDEN_ON_A_MARK_ROW);
      }
      const expectedIncome = i === 3 ? roundUsd(idea.ledger.holdings.MSFT.shares * 0.83) : 0;
      expect(cents(idea.ledger.cash), SESSIONS[i]).toBe(cents(cash) + cents(expectedIncome));
      expect(cents(getBook(db, bookId).portfolio.cash)).toBe(cents(bookCash) + cents(expectedIncome));
      cash = idea.ledger.cash; bookCash = getBook(db, bookId).portfolio.cash;
      expect(getBook(db, bookId).treasury.unreservedCash).toBe(80000);
      expect(countDocs(db, `mandates/${bookId}/decisions/`)).toBe(decisionsAfterEntry);
    }
    expect(JSON.stringify(db._get(`mandates/${bookId}/ideas/${a.ideaId}/rows/inception`))).toBe(inceptionBefore); // the fill's own record never changes
    expect(getBook(db, bookId).execState).toMatchObject({ submitted: 0, executed: 0 });
  });
});

describe('B-STAMP — every book is valued from the same snapshot', () => {
  it('no snapshot: no row, nothing fetched, valuation_missed', async () => {
    const { db, bookId, bookRef } = await seedBook();
    await admitAndEnter(db, bookId, { contract: contractOf(), quotes: entryQuotes('AAPL', 'SPY') });
    const before = JSON.stringify([...db._store.entries()]);
    expect(await closeIdeaBook(db, bookRef, { date: DAYS.d1, closeSnapshot: null })).toEqual({ closed: false, skipped: 'valuation_missed', alerts: [] });
    expect(JSON.stringify([...db._store.entries()])).toBe(before);
  });

  it('a snapshot that is not exactly `${date}_close` is refused — a slot snapshot, another date\'s close, a planted second snapshot', async () => {
    const { db, bookId, bookRef } = await seedBook();
    await admitAndEnter(db, bookId, { contract: contractOf(), quotes: entryQuotes('AAPL', 'SPY') });
    const good = closeSnapshot(DAYS.d1, { AAPL: 233.11, SPY: 599.02 });
    expect(closeSnapshotKeyFor(DAYS.d1)).toBe(`${DAYS.d1}_close`);
    const before = JSON.stringify([...db._store.entries()]);
    for (const bad of [
      { ...good, tickKey: `${DAYS.d1}_preClose` },
      { ...good, tickKey: `${DAYS.d1}_close_v2` },
      closeSnapshot(DAYS.d2, { AAPL: 233.11, SPY: 599.02 }),
      { ...good, sessionDate: DAYS.d2 },
    ]) {
      await expect(closeIdeaBook(db, bookRef, { date: DAYS.d1, closeSnapshot: bad })).rejects.toThrow(/close_snapshot_key_mismatch/);
    }
    expect(JSON.stringify([...db._store.entries()])).toBe(before);
    expect((await closeIdeaBook(db, bookRef, { date: DAYS.d1, closeSnapshot: good, now: new Date(etIso(DAYS.d1, 16, 25)) })).closed).toBe(true);
  });

  it('two idea books closed at two different times for one date carry the same key, the same build time and the same mark per shared symbol', async () => {
    const db = makeMandateFakeDb();
    const one = await seedBook({ db, uid: 'owner-1', opId: 'c1' });
    const two = await seedBook({ db, uid: 'owner-2', opId: 'c2', archetypeCodeId: 'degen' });
    const a = await admitAndEnter(db, one.bookId, { contract: contractOf({ names: ['AAPL', 'MSFT'] }), quotes: entryQuotes('AAPL', 'MSFT', 'SPY') });
    const b = await admitAndEnter(db, two.bookId, { contract: contractOf({ slot: 'long', names: ['AAPL', 'LLY'], capitalUsd: 40000 }), quotes: entryQuotes('AAPL', 'LLY', 'SPY') });
    const snapshot = closeSnapshot(DAYS.d1, { AAPL: 233.11, MSFT: 420.77, LLY: 805.2, SPY: 599.02 });
    await closeIdeaBook(db, one.bookRef, { date: DAYS.d1, closeSnapshot: snapshot, now: new Date(etIso(DAYS.d1, 16, 22)) });
    await closeIdeaBook(db, two.bookRef, { date: DAYS.d1, closeSnapshot: snapshot, now: new Date(etIso(DAYS.d1, 17, 40)) }); // a later fire
    const rowA = getRow(db, one.bookId, a.ideaId, DAYS.d1);
    const rowB = getRow(db, two.bookId, b.ideaId, DAYS.d1);
    for (const r of [rowA, rowB, db._get(`mandates/${one.bookId}/dailyRows/${DAYS.d1}`), db._get(`mandates/${two.bookId}/dailyRows/${DAYS.d1}`)]) {
      expect(r.closeSnapshotKey).toBe(`${DAYS.d1}_close`);
      expect(r.closeSnapshotBuiltAt).toBe(etIso(DAYS.d1, 16, 20));
    }
    expect(rowA.marks.AAPL).toEqual(rowB.marks.AAPL);
    expect(rowA.spyMarks.SPY).toEqual(rowB.spyMarks.SPY);
    expect(rowA.marks.AAPL.vendorTimeIso).toBe(etIso(DAYS.d1, 16, 0));
  });

  it('a close for a book that is not an idea book, or is closed, does nothing', async () => {
    const db = makeMandateFakeDb({ 'mandates/q1': { userId: 'u', status: 'active', portfolio: { cash: 1e7, positions: {} }, execState: {} } });
    const snapshot = closeSnapshot(DAYS.d1, { SPY: 599.02 });
    expect(await closeIdeaBook(db, db.collection('mandates').doc('q1'), { date: DAYS.d1, closeSnapshot: snapshot })).toEqual({ closed: false, skipped: 'not_idea_book', alerts: [] });
    expect(await closeIdeaBook(db, db.collection('mandates').doc('nope'), { date: DAYS.d1, closeSnapshot: snapshot })).toEqual({ closed: false, skipped: 'book_missing', alerts: [] });
    const { bookId, bookRef } = await seedBook({ db });
    await bookRef.update({ status: 'closed' });
    expect(await closeIdeaBook(db, bookRef, { date: DAYS.d1, closeSnapshot: snapshot })).toEqual({ closed: false, skipped: 'not_open', alerts: [] });
    expect(db._get(`mandates/${bookId}/dailyRows/${DAYS.d1}`)).toBeUndefined();
  });
});

function roundSharesOf(n) {
  return Math.round(n * 1e6) / 1e6;
}
