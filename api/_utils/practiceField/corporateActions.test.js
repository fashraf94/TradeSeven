// api/_utils/practiceField/corporateActions.test.js
//
// Practice Field T1a-2a — THE TWO IDENTITY EVENTS (Amendment E11; Amendment D Q-8; build prompt §7). T1a-1 applied
// splits and dividends and held everything else at a carried mark. This build decides the rest:
//   a ticker change  renames the holding on every ledger that holds it, its line, the book's position and the
//                    coverage entry. No cash moves. A receipt on each ledger. Reconciliation holds before and after;
//   a delisting      is NEVER applied as a sale. With a cash amount per share it is credited as a receipted corporate
//                    action on every ledger that holds the name, and the holding closes. Without one, the idea's
//                    holding becomes a waiting sale (E9), and nothing is sold at a carried mark.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { applyLedgerActions, newLedger, renameDeferralSymbols } from './ledger.js';
import { ideaCoveragePlanFromLedgers } from './coverage.js';
import { assertReconciled } from './reconcile.js';
import { admitIdea } from './admission.js';
import { setPracticeFieldModeForTests } from './mode.js';
import { roundUsd } from '../mandateRounding.js';
import {
  seedBook, admitAndEnter, closeOn, windowAt, contractOf, getBook, getIdea, getRow, closeNowOf, countDocs,
  takeSeededDbs, saleWordsOnMarkRows, bannedWordsOnResults, etIso as etIsoOf,
} from './__testsupport__/fixtures.js';

const S = ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-27', '2026-11-30', '2026-12-01', '2026-12-02', '2026-12-03'];
const DUE = S[10];
const BASE = { AAPL: 231.47, MSFT: 418.13, NVDA: 141.29, AMD: 139.83, SPY: 597.31, XLK: 233.59 };
const CAPS = { AAPL: 3.4e12, MSFT: 3.1e12, NVDA: 3.5e12, AMD: 2.6e11 };
function quotes(over = {}) {
  const out = {};
  for (const [sym, v] of Object.entries({ ...BASE, ...over })) {
    if (v === undefined) continue;
    if (typeof v === 'number') out[sym] = CAPS[sym] ? { price: v, marketCap: CAPS[sym] } : v;
    else out[sym] = CAPS[sym] && !Object.hasOwn(v, 'marketCap') ? { marketCap: CAPS[sym], ...v } : v;
  }
  return out;
}
const cents = (n) => Math.round(n * 100);
const ideaOf = (ctx) => getIdea(ctx.db, ctx.bookId, ctx.ideaId);
const bookOf = (ctx) => getBook(ctx.db, ctx.bookId);
const rowOf = (ctx, date) => getRow(ctx.db, ctx.bookId, ctx.ideaId, date);
const coverageOf = (ctx) => ctx.db._get('practiceFieldCoverage/current').symbols;
const recon = (ctx) => { const book = bookOf(ctx); return assertReconciled(book, book.openIdeaIds.map((id) => getIdea(ctx.db, ctx.bookId, id))); };
const closeDay = async (ctx, date, over = {}) => { const out = await closeOn(ctx.db, ctx.bookId, date, quotes(over)); recon(ctx); return out; };
const win = async (ctx, date, slot = 'open30', over = {}) => { const out = await windowAt(ctx.db, ctx.bookId, { date, slot, quotes: quotes(over) }); recon(ctx); return out; };
async function setup(contract = {}) {
  const { db, bookId, bookRef } = await seedBook();
  const r = await admitAndEnter(db, bookId, { contract: contractOf({ names: ['AAPL', 'MSFT'], ...contract }), quotes: quotes(), date: S[0] });
  const ctx = { db, bookId, bookRef, ideaId: r.ideaId };
  recon(ctx);
  await closeDay(ctx, S[0]);
  return ctx;
}
const rename = (ticker, renamedTo, effectiveDate = S[1]) => ({ type: 'ticker_change', ticker, renamedTo, effectiveDate, source: 'founder_action' });
const delisting = (ticker, cashPerShare, effectiveDate = S[1]) => ({ type: 'delisting', ticker, effectiveDate, source: 'founder_action', ...(cashPerShare === undefined ? {} : { cashPerShare }) });
const receiptsOf = (ledger, type) => ledger.corporateActionReceipts.filter((r) => r.type === type);

let restoreMode;
beforeEach(() => { restoreMode = setPracticeFieldModeForTests('on'); takeSeededDbs(); });
afterEach(() => {
  restoreMode();
  vi.restoreAllMocks();
  for (const db of takeSeededDbs()) {
    expect(saleWordsOnMarkRows(db)).toEqual([]);
    expect(bannedWordsOnResults(db)).toEqual([]);
  }
});

describe('a ticker change (E11) — the holding is renamed everywhere it is held; no cash moves', () => {
  it('on a HELD name: the idea\'s holding, its same-stock comparison\'s, the line, the book\'s position and the coverage entry all move to the new symbol, with a receipt on each ledger', async () => {
    const ctx = await setup();
    const before = { idea: ideaOf(ctx), book: bookOf(ctx) };
    expect(Object.keys(coverageOf(ctx)).sort()).toEqual(['AAPL', 'MSFT', 'SPY']);
    // The rename day: the snapshot still lists the old symbol (it was built from yesterday's coverage) and has no quote for the new one.
    const out = await closeDay(ctx, S[1], { MSFT: { price: 419.5, corporateActions: [rename('MSFT', 'MSFX')] } });
    const idea = ideaOf(ctx);
    const book = bookOf(ctx);
    const id = `ticker_change_MSFT_${S[1]}`;
    for (const ledger of [idea.ledger, idea.comparisonLedger]) {
      expect(Object.keys(ledger.holdings).sort(), ledger.kind).toEqual(['AAPL', 'MSFX']);
      expect(ledger.holdings.MSFX.shares).toBe(before.idea.ledger.holdings.MSFT.shares);
      expect(ledger.holdings.MSFX.costBasisTotal).toBe(before.idea.ledger.holdings.MSFT.costBasisTotal);
      expect(ledger.holdings.MSFX.costTier).toEqual(before.idea.ledger.holdings.MSFT.costTier); // the tier it entered with travels with it
      expect(ledger.cash).toBe(before.idea.ledger.cash); // no cash change
      expect(ledger.appliedActionIds).toEqual([id]);
      expect(receiptsOf(ledger, 'ticker_change')).toEqual([expect.objectContaining({ actionId: id, ticker: 'MSFT', renamedTo: 'MSFX', applied: true, appliedOn: S[1], incomeUsd: 0 })]);
    }
    expect(idea.spyLedger.corporateActionReceipts).toEqual([]); // SPY does not hold it
    // The line follows its holding, and remembers where it came from; the frozen contract is not rewritten.
    const line = idea.lines.find((l) => l.symbol === 'MSFX');
    expect(line).toMatchObject({ level: before.idea.lines.find((l) => l.symbol === 'MSFT').level, renamedFrom: [{ symbol: 'MSFT', actionId: id, appliedOn: S[1] }] });
    expect(idea.lines.some((l) => l.symbol === 'MSFT')).toBe(false);
    expect(idea.contract.names).toEqual(['AAPL', 'MSFT']);
    // The book's position, still the idea's own.
    expect(Object.keys(book.portfolio.positions).sort()).toEqual(['AAPL', 'MSFX']);
    expect(book.portfolio.positions.MSFX).toMatchObject({ ideaId: ctx.ideaId, shares: before.book.portfolio.positions.MSFT.shares, costBasisTotal: before.book.portfolio.positions.MSFT.costBasisTotal });
    expect(book.portfolio.cash).toBe(before.book.portfolio.cash);
    expect(ctx.db._get(`mandates/${ctx.bookId}/corporateActions/${id}`)).toMatchObject({ type: 'ticker_change', ticker: 'MSFT', ideaId: ctx.ideaId });
    // The coverage entry: the new symbol is what the idea needs a price for from now on.
    expect(Object.keys(coverageOf(ctx)).sort()).toEqual(['AAPL', 'MSFX', 'SPY']);
    expect(coverageOf(ctx).MSFX.roles).toEqual(['held', 'comparison']);
    // On the rename day the new symbol has no quote: a carried mark, not full quality, and its line unobserved.
    expect(out.alerts).toEqual([]);
    expect(rowOf(ctx, S[1])).toMatchObject({ fullQuality: false, marks: { MSFX: { quality: 'carried_forward', mark: BASE.MSFT } }, lineObservations: { AAPL: 'at_or_above', MSFX: 'unobserved' }, corporateActionsApplied: { idea: [id], comparison: [id], spy: [] } });
    expect(idea.unobservedLineSessions).toEqual({ MSFX: [S[1]] });
    // The same-stock tie still holds (rule 9): no fill was made.
    expect(idea.postEntryFillCount).toBe(0);

    // From the next close the new symbol is quoted; the action is not applied twice; the line works under the new name.
    const level = line.level;
    await closeDay(ctx, S[2], { MSFT: undefined, MSFX: { price: roundUsd(level - 0.02), marketCap: CAPS.MSFT, corporateActions: [rename('MSFT', 'MSFX')] } });
    const later = ideaOf(ctx);
    expect(later.ledger.appliedActionIds).toEqual([id]);
    expect(rowOf(ctx, S[2]).marks.MSFX.quality).toBe('vendor_time');
    expect(later.status).toBe('line_hit_exit_pending');
    expect(later.ledger.holdings.MSFX.exitPending).toMatchObject({ reason: 'line', session: S[2] });
    const w = await win(ctx, S[3], 'open30', { MSFT: undefined, MSFX: { price: 395.2, marketCap: CAPS.MSFT } });
    expect(w.sales).toMatchObject({ sold: 1 });
    expect(ideaOf(ctx).ledger.saleReceipts[0]).toMatchObject({ symbol: 'MSFX', kind: 'line_exit', costTier: { capTier: 'mega' } });
    expect(Object.keys(bookOf(ctx).portfolio.positions)).toEqual(['AAPL']);
  });

  it('on a COMPARISON name (a frozen basket member): only the comparison ledger and the coverage entry move', async () => {
    const ctx = await setup({ names: ['AAPL'], comparison: { type: 'frozen_basket', symbols: ['NVDA', 'AMD'] } });
    const before = ideaOf(ctx);
    await closeDay(ctx, S[1], { AMD: { price: 140.2, corporateActions: [rename('AMD', 'AMDX')] } });
    const idea = ideaOf(ctx);
    expect(idea.ledger).toEqual({ ...before.ledger, holdings: idea.ledger.holdings }); // the idea's own ledger: only its marks moved
    expect(Object.keys(idea.ledger.holdings)).toEqual(['AAPL']);
    expect(Object.keys(idea.comparisonLedger.holdings).sort()).toEqual(['AMDX', 'NVDA']);
    expect(idea.comparisonLedger.holdings.AMDX.shares).toBe(before.comparisonLedger.holdings.AMD.shares);
    expect(idea.comparisonLedger.cash).toBe(before.comparisonLedger.cash);
    expect(receiptsOf(idea.comparisonLedger, 'ticker_change')).toHaveLength(1);
    expect(idea.lines).toEqual(before.lines); // no line of the idea names it
    expect(Object.keys(bookOf(ctx).portfolio.positions)).toEqual(['AAPL']);
    expect(countDocs(ctx.db, `mandates/${ctx.bookId}/corporateActions/`)).toBe(0); // nothing of the book's moved
    expect(Object.keys(coverageOf(ctx)).sort()).toEqual(['AAPL', 'AMDX', 'NVDA', 'SPY']);
    expect(coverageOf(ctx).AMDX.roles).toEqual(['comparison']);
  });

  it('on SPY\'s own symbol: the SPY ledger and the coverage entry move, and the line still costs out at the fund tier it entered with', async () => {
    const ctx = await setup({ names: ['AAPL'] });
    const before = ideaOf(ctx);
    await closeDay(ctx, S[1], { SPY: { price: 598.4, corporateActions: [rename('SPY', 'SPYX')] } });
    const idea = ideaOf(ctx);
    expect(Object.keys(idea.spyLedger.holdings)).toEqual(['SPYX']);
    expect(idea.spyLedger.holdings.SPYX).toMatchObject({ shares: before.spyLedger.holdings.SPY.shares, costTier: { capTier: 'fund:liquid_fund', slippageBps: 1, spreadProxyBps: 2 } });
    expect(idea.spyLedger.cash).toBe(before.spyLedger.cash);
    expect(Object.keys(idea.ledger.holdings)).toEqual(['AAPL']);
    expect(Object.keys(coverageOf(ctx)).sort()).toEqual(['AAPL', 'SPYX']);
    expect(coverageOf(ctx).SPYX.roles).toEqual(['benchmark']);
    // At the endpoint the renamed line is valued and costed like any other holding, at its stored tier.
    for (let i = 2; i <= 10; i += 1) await closeDay(ctx, S[i], { SPY: undefined, SPYX: 601.2 });
    const ep = ctx.db._get(`mandates/${ctx.bookId}/ideas/${ctx.ideaId}/rows/endpoint`);
    expect(ep.spy.holdings.SPYX).toMatchObject({ mark: 601.2, markQuality: 'vendor_time', costTier: { capTier: 'fund:liquid_fund' } });
    expect(ep.spy.valueUsd).toBe(roundUsd(idea.spyLedger.cash + roundUsd(idea.spyLedger.holdings.SPYX.shares * (601.2 * (1 - 3 / 10000)))));
    expect(ideaOf(ctx).result.spy.fullQuality).toBe(true);
  });

  it('a rename the applier cannot make — no target, or a target the ledger already holds — is applied to no ledger and held at a carried mark', async () => {
    const ctx = await setup();
    const out = await closeDay(ctx, S[1], { MSFT: { price: 419.5, corporateActions: [rename('MSFT', 'AAPL')] } }); // would merge two holdings
    const idea = ideaOf(ctx);
    expect(Object.keys(idea.ledger.holdings).sort()).toEqual(['AAPL', 'MSFT']);
    expect(idea.ledger.appliedActionIds).toEqual([]);
    expect(out.alerts.some((a) => /PRACTICE_FIELD_MARK_HELD_BACK .* idea MSFT/.test(a))).toBe(true);
    expect(rowOf(ctx, S[1]).marks.MSFT.quality).toBe('carried_forward');
    expect(coverageOf(ctx).MSFT.roles).toEqual(['held', 'comparison']);
  });

  it('a ticker change INTO a symbol another idea of the book holds is applied to no ledger of the idea — one name, one idea — and the book\'s close still completes, with an alert and a carried mark', async () => {
    const { db, bookId, bookRef } = await seedBook({ archetypeCodeId: 'degen' });
    const a = await admitAndEnter(db, bookId, { contract: contractOf({ names: ['AAPL', 'MSFT'] }), quotes: quotes(), date: S[0] });
    const b = await admitAndEnter(db, bookId, { contract: contractOf({ slot: 'medium', names: ['NVDA'], capitalUsd: 15000 }), opId: 'idea-2', quotes: quotes(), date: S[0], slot: 'midday' });
    expect(b.entry.outcome).toBe('entered');
    const ctx = { db, bookId, bookRef, ideaId: a.ideaId };
    await closeDay(ctx, S[0]);
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const out = await closeDay(ctx, S[1], { MSFT: { price: 419.5, corporateActions: [rename('MSFT', 'NVDA')] } });
    expect(out.closed).toBe(true); // the whole book closed: the other idea has its row too
    expect(getRow(db, bookId, b.ideaId, S[1])).toMatchObject({ fullQuality: true, quantities: { NVDA: expect.any(Number) } });
    const idea = ideaOf(ctx);
    expect(Object.keys(idea.ledger.holdings).sort()).toEqual(['AAPL', 'MSFT']);
    expect(Object.keys(idea.comparisonLedger.holdings).sort()).toEqual(['AAPL', 'MSFT']);
    expect(idea.ledger.appliedActionIds).toEqual([]);
    expect(out.alerts.filter((x) => /PRACTICE_FIELD_RENAME_BLOCKED/.test(x))).toEqual([
      `PRACTICE_FIELD_RENAME_BLOCKED ${ctx.ideaId} idea MSFT — a ticker change into a symbol another idea of the book holds is not applied; the holding is valued at its carried mark`,
      `PRACTICE_FIELD_RENAME_BLOCKED ${ctx.ideaId} comparison MSFT — a ticker change into a symbol another idea of the book holds is not applied; the holding is valued at its carried mark`,
    ]);
    expect(rowOf(ctx, S[1])).toMatchObject({ fullQuality: false, marks: { MSFT: { quality: 'carried_forward', mark: BASE.MSFT } } });
    expect(Object.keys(getBook(db, bookId).portfolio.positions).sort()).toEqual(['AAPL', 'MSFT', 'NVDA']);
    // The same rename into a symbol NO other idea holds is applied (the row above this describe).
    errors.mockRestore();
  });

  it('the coverage plan of a filled idea is read from what its ledgers hold now', () => {
    const idea = { ledger: { holdings: { MSFX: {}, AAPL: {} } }, comparisonLedger: { holdings: { MSFX: {}, AAPL: {} } }, spyLedger: { holdings: { SPY: {} } } };
    expect(ideaCoveragePlanFromLedgers(idea)).toEqual({ AAPL: ['held', 'comparison'], MSFX: ['held', 'comparison'], SPY: ['benchmark'] });
    expect(ideaCoveragePlanFromLedgers({ ledger: { holdings: {} }, comparisonLedger: null, spyLedger: null })).toEqual({});
  });
});

describe('a delisting (E11) — never applied as a sale', () => {
  it('WITH a cash amount per share: credited as a receipted corporate action on every ledger that holds the name; the holding closes; realised profit and loss is the cash minus the cost basis, receipted', async () => {
    const ctx = await setup();
    const before = { idea: ideaOf(ctx), book: bookOf(ctx) };
    const shares = before.idea.ledger.holdings.MSFT.shares;
    const basis = before.idea.ledger.holdings.MSFT.costBasisTotal;
    const cash = roundUsd(shares * 402.5);
    const id = `delisting_MSFT_${S[1]}`;
    const out = await closeDay(ctx, S[1], { MSFT: { price: 402.4, corporateActions: [delisting('MSFT', 402.5)] } });
    expect(out.alerts).toEqual([]);
    const idea = ideaOf(ctx);
    const book = bookOf(ctx);
    for (const ledger of [idea.ledger, idea.comparisonLedger]) {
      expect(Object.keys(ledger.holdings), ledger.kind).toEqual(['AAPL']);
      expect(cents(ledger.cash), ledger.kind).toBe(cents(before.idea.ledger.cash) + cents(cash));
      expect(ledger.realizedPnlUsd, ledger.kind).toBe(roundUsd(cash - basis));
      expect(ledger.dividendsUsd).toBe(0);
      expect(ledger.appliedActionIds).toEqual([id]);
      expect(receiptsOf(ledger, 'delisting')).toEqual([expect.objectContaining({
        actionId: id, applied: true, appliedOn: S[1], cashPerShare: 402.5, shares, cashUsd: cash, costBasisUsd: basis, realizedPnlUsd: roundUsd(cash - basis), incomeUsd: 0,
      })]);
      expect(ledger.saleReceipts).toEqual([]); // not a sale
    }
    // NEVER A SALE: no decision, no fill count, and the same-stock tie still holds.
    expect(countDocs(ctx.db, `mandates/${ctx.bookId}/decisions/`)).toBe(2);
    expect(idea.postEntryFillCount).toBe(0);
    expect(idea.status).toBe('holding');
    expect(idea.lines.find((l) => l.symbol === 'MSFT').breach).toBeUndefined();
    // The book mirrors it: the position is gone and the cash is up by the same amount.
    expect(Object.keys(book.portfolio.positions)).toEqual(['AAPL']);
    expect(cents(book.portfolio.cash)).toBe(cents(before.book.portfolio.cash) + cents(cash));
    expect(book.treasury.unreservedCash).toBe(before.book.treasury.unreservedCash); // the cash stays the idea's
    expect(ctx.db._get(`mandates/${ctx.bookId}/corporateActions/${id}`)).toMatchObject({ type: 'delisting', ideaId: ctx.ideaId });
    expect(rowOf(ctx, S[1])).toMatchObject({ quantities: { AAPL: before.idea.ledger.holdings.AAPL.shares }, markedGapUsd: 0, corporateActionsApplied: { idea: [id], comparison: [id], spy: [] } });
    // Presented again the next close: applied once.
    await closeDay(ctx, S[2], { MSFT: { price: 402.4, corporateActions: [delisting('MSFT', 402.5)] } });
    expect(ideaOf(ctx).ledger.appliedActionIds).toEqual([id]);
    expect(cents(ideaOf(ctx).ledger.cash)).toBe(cents(before.idea.ledger.cash) + cents(cash));
  });

  it('cash a delisting paid BEFORE the endpoint is already in the idea\'s cash at the endpoint: it is not counted again beside the liquidation (review RH-6)', async () => {
    const ctx = await setup();
    await closeDay(ctx, S[1], { MSFT: { price: 402.4, corporateActions: [delisting('MSFT', 402.5)] } });
    for (let i = 2; i <= 10; i += 1) await closeDay(ctx, S[i], { MSFT: undefined });
    expect(ideaOf(ctx).status).toBe('settled');
    expect((await win(ctx, S[11], 'open30', { MSFT: undefined })).sales).toMatchObject({ sold: 1, resulted: 1 });
    const idea = ideaOf(ctx);
    expect(idea.liquidation).toMatchObject({ corporateActionCashUsd: 0, corporateActions: [], sales: [`${ctx.ideaId}__settlement__AAPL`] });
    expect(cents(idea.liquidationSlippageUsd)).toBe(cents(idea.liquidation.proceedsUsd) - cents(idea.liquidation.endpointHoldingsNetUsd));
  });

  it('WITH cash, on an idea\'s LAST holding: nothing is left, so the idea resolves at that close (E2) — with no sale anywhere', async () => {
    const ctx = await setup({ names: ['AAPL'], comparison: { type: 'sector_fund', symbols: ['XLK'] } });
    const shares = ideaOf(ctx).ledger.holdings.AAPL.shares;
    const cashBefore = ideaOf(ctx).ledger.cash;
    const out = await closeDay(ctx, S[1], { AAPL: { price: 244.9, corporateActions: [delisting('AAPL', 245)] } });
    expect(out.resulted).toEqual([ctx.ideaId]);
    const idea = ideaOf(ctx);
    const value = roundUsd(cashBefore + roundUsd(shares * 245));
    expect(idea).toMatchObject({ status: 'resulted', result: { endpointKind: 'early_resolution', endpointSession: S[1], economic: { ideaValueUsd: value }, trades: { lineExit: { count: 0 } } }, liquidation: { returnedToTreasuryUsd: value, sales: [] } });
    expect(idea.ledger.saleReceipts).toEqual([]);
    expect(countDocs(ctx.db, `mandates/${ctx.bookId}/decisions/`)).toBe(1); // the entry's only
    expect(bookOf(ctx)).toMatchObject({ slots: { short: null }, openIdeaIds: [], portfolio: { positions: {} } });
    expect(cents(bookOf(ctx).treasury.unreservedCash)).toBe(8000000 + cents(value));
  });

  it('WITHOUT a cash amount: nothing is applied — no forced close at the carried mark — and the idea\'s holding becomes a waiting sale that fills only at an eligible price', async () => {
    const ctx = await setup();
    const before = { idea: ideaOf(ctx), book: bookOf(ctx) };
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const id = `delisting_MSFT_${S[1]}`;
    const out = await closeDay(ctx, S[1], { MSFT: { price: 300.1, corporateActions: [delisting('MSFT')] } });
    expect(out.alerts).toEqual(expect.arrayContaining([
      `PRACTICE_FIELD_DELISTING_WAITING ${ctx.ideaId} MSFT ${id} — a delisting with no cash amount is not applied; the holding waits for an eligible price`,
    ]));
    const idea = ideaOf(ctx);
    // Nothing moved: the engine's applier would have sold the holding at its carried mark (B-NOFILL).
    expect(idea.ledger.holdings.MSFT.shares).toBe(before.idea.ledger.holdings.MSFT.shares);
    expect(idea.ledger.cash).toBe(before.idea.ledger.cash);
    expect(idea.ledger.realizedPnlUsd).toBe(0);
    expect(idea.ledger.appliedActionIds).toEqual([]); // settled by nobody: a later row with the cash still applies
    expect(bookOf(ctx).portfolio.positions.MSFT.shares).toBe(before.book.portfolio.positions.MSFT.shares);
    expect(bookOf(ctx).portfolio.cash).toBe(before.book.portfolio.cash);
    expect(countDocs(ctx.db, `mandates/${ctx.bookId}/decisions/`)).toBe(2);
    expect(countDocs(ctx.db, `mandates/${ctx.bookId}/corporateActions/`)).toBe(0);
    // The idea's holding is a waiting sale (E9); the line was NOT breached; the mark is the carried one, not full quality.
    expect(idea.status).toBe('line_hit_exit_pending');
    expect(idea.ledger.holdings.MSFT.exitPending).toEqual({ reason: 'delisting', session: S[1], at: closeNowOf(S[1]).toISOString(), actionId: id, recognisedLate: false, waiting: null });
    expect(idea.lines.find((l) => l.symbol === 'MSFT').breach).toBeUndefined();
    expect(rowOf(ctx, S[1])).toMatchObject({ fullQuality: false, marks: { MSFT: { quality: 'carried_forward', mark: BASE.MSFT } } });
    // The comparison never trades: it keeps the holding, at its carried mark.
    expect(idea.comparisonLedger.holdings.MSFT.shares).toBe(before.idea.comparisonLedger.holdings.MSFT.shares);
    expect(idea.comparisonLedger.holdings.MSFT.exitPending).toBeUndefined();

    // Windows with no quote for it: the sale waits. Nothing fills.
    expect((await win(ctx, S[2], 'open30', { MSFT: undefined })).sales).toMatchObject({ sold: 0, waiting: 1 });
    await closeDay(ctx, S[2], { MSFT: { price: 300.1, corporateActions: [delisting('MSFT')] } });
    expect(ideaOf(ctx).ledger.holdings.MSFT.exitPending.session).toBe(S[1]); // not re-queued
    expect(out.alerts.filter((a) => /DELISTING_WAITING/.test(a))).toHaveLength(1);
    // A later row DOES carry the cash: it is credited, once, and the waiting holding closes without ever being sold.
    await closeDay(ctx, S[3], { MSFT: { price: 300.1, corporateActions: [delisting('MSFT', 301.25)] } });
    const settled = ideaOf(ctx);
    expect(Object.keys(settled.ledger.holdings)).toEqual(['AAPL']);
    expect(settled.status).toBe('holding');
    expect(settled.ledger.saleReceipts).toEqual([]);
    expect(receiptsOf(settled.ledger, 'delisting')).toHaveLength(1);
    expect(settled.result).toBeNull();
    errors.mockRestore();
  });

  it('WITHOUT cash — the waiting holding\'s line is still read (review RH-3), and its sale — recorded under the origin `line_exit`, one of the two the build prompt names — is counted apart from the line exits', async () => {
    const ctx = await setup();
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const level = ideaOf(ctx).lines.find((l) => l.symbol === 'MSFT').level;
    const under = roundUsd(level - 0.02);
    await closeDay(ctx, S[1], { MSFT: { price: under, corporateActions: [delisting('MSFT')] } });
    // The delisting's own close is not full quality: the line is unobserved there, not breached.
    expect(ideaOf(ctx).lines.find((l) => l.symbol === 'MSFT').breach).toBeUndefined();
    expect(ideaOf(ctx).unobservedLineSessions.MSFT).toEqual([S[1]]);
    expect((await win(ctx, S[2], 'open30', { MSFT: undefined })).sales).toMatchObject({ sold: 0, waiting: 1 });
    // S[2]'s close has a full-quality mark below the line: the breach is RECORDED while the holding waits…
    await closeDay(ctx, S[2], { MSFT: under });
    let idea = ideaOf(ctx);
    expect(idea.lines.find((l) => l.symbol === 'MSFT').breach).toMatchObject({ session: S[2], close: under, level, onDueSession: false });
    // …and queues nothing: one holding, one pending sale — still the delisting's.
    expect(idea.ledger.holdings.MSFT.exitPending).toMatchObject({ reason: 'delisting', session: S[1], actionId: `delisting_MSFT_${S[1]}` });
    expect(idea.status).toBe('line_hit_exit_pending');
    // The sale fills at the next eligible price. Its decision record and receipt carry the origin `line_exit`; what queued it says delisting.
    // A delisted name's price falling to HALF its carried mark is the delisting, not a split: the gap screen that holds
    // an ordinary sale back (exits.test.js) does not hold this one, or it could wait for ever.
    const collapsed = roundUsd(ideaOf(ctx).ledger.holdings.MSFT.lastMark / 2);
    expect((await win(ctx, S[3], 'open30', { MSFT: collapsed })).sales).toMatchObject({ sold: 1 });
    expect(ideaOf(ctx).ledger.saleReceipts[0].mark).toBe(collapsed);
    idea = ideaOf(ctx);
    const decisionId = `${ctx.ideaId}__line_exit__MSFT`;
    expect(idea.ledger.saleReceipts).toEqual([expect.objectContaining({ decisionId, kind: 'line_exit', symbol: 'MSFT', queuedBy: expect.objectContaining({ reason: 'delisting', session: S[1] }) })]);
    expect(ctx.db._get(`mandates/${ctx.bookId}/decisions/${decisionId}`)).toMatchObject({ verb: 'SELL', ticker: 'MSFT', origin: 'line_exit', kind: 'idea_book', ideaId: ctx.ideaId });
    expect(countDocs(ctx.db, `mandates/${ctx.bookId}/decisions/`)).toBe(3); // two entry legs and this one sale
    expect(idea.status).toBe('holding');
    expect(idea.blockedBy.map((b) => b.kind)).toEqual(['delisting_exit_waited']);
    for (let i = 3; i <= 10; i += 1) await closeDay(ctx, S[i], { MSFT: undefined });
    const result = ideaOf(ctx).result;
    expect(result).toMatchObject({ contractCondition: 'breached', processQuality: 'blocked' });
    expect(result.trades.lineExit).toEqual({ count: 0, costsUsd: 0 });
    expect(result.trades.delistingExit).toEqual({ count: 1, costsUsd: idea.ledger.saleReceipts[0].frictionPaidUsd });
    errors.mockRestore();
  });

  it('a holding still waiting on a delisting at the due session becomes the settlement sale with its cause kept, and is still not held back by the gap screen: it sells at a third of its carried mark, counted once', async () => {
    const ctx = await setup();
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    await closeDay(ctx, S[1], { MSFT: { price: 300.1, corporateActions: [delisting('MSFT')] } });
    for (let i = 2; i <= 10; i += 1) await closeDay(ctx, S[i], { MSFT: undefined }); // no price all the way to the due session
    let idea = ideaOf(ctx);
    expect(idea.status).toBe('settled');
    expect(idea.ledger.holdings.MSFT.settlementPending).toMatchObject({ replacedExit: { reason: 'delisting', session: S[1] } });
    expect(idea.ledger.holdings.MSFT.exitPending).toBeUndefined();
    expect(idea.result.trades).toMatchObject({ lineExit: { count: 0 }, delistingExit: { count: 0 } }); // nothing was sold before the endpoint
    const third = roundUsd(idea.ledger.holdings.MSFT.lastMark / 3);
    expect((await win(ctx, S[11], 'open30', { MSFT: third })).sales).toMatchObject({ sold: 2, resulted: 1 });
    idea = ideaOf(ctx);
    expect(idea.ledger.saleReceipts.map((r) => [r.symbol, r.kind, r.mark])).toEqual([['AAPL', 'settlement', BASE.AAPL], ['MSFT', 'settlement', third]]);
    expect(idea.liquidation.sales).toEqual([`${ctx.ideaId}__settlement__AAPL`, `${ctx.ideaId}__settlement__MSFT`]);
    errors.mockRestore();
  });

  it('a DIVIDEND credited between the endpoint and the settlement sale is part of what the holding fetched: counted beside the proceeds under its own name, so the slippage is the price move and not the dividend (second refuter pass, 4a)', async () => {
    const ctx = await setup({ names: ['AAPL'], comparison: { type: 'sector_fund', symbols: ['XLK'] } });
    for (let i = 1; i <= 10; i += 1) await closeDay(ctx, S[i]);
    expect(ideaOf(ctx).status).toBe('settled');
    const endpointNet = ideaOf(ctx).endpoint.holdingsNetUsd;
    const shares = ideaOf(ctx).ledger.holdings.AAPL.shares;
    // The liquidation session is AAPL's ex-date: the price is down by the dividend, and the sale waits for the close to credit it.
    const dividend = { type: 'cash_dividend', ticker: 'AAPL', effectiveDate: S[11], amount: 2.26, source: 'eodhd_dividends' };
    const ex = roundUsd(BASE.AAPL - 2.26);
    expect((await win(ctx, S[11], 'open30', { AAPL: { price: ex, corporateActions: [dividend] } })).sales).toMatchObject({ sold: 0, waiting: 1 });
    await closeDay(ctx, S[11], { AAPL: { price: ex, corporateActions: [dividend] } });
    const income = ideaOf(ctx).ledger.dividendsUsd;
    expect(income).toBe(roundUsd(shares * 2.26));
    expect((await win(ctx, S[12], 'open30', { AAPL: { price: ex, corporateActions: [dividend] } })).sales).toMatchObject({ sold: 1, resulted: 1 });
    const idea = ideaOf(ctx);
    expect(idea.liquidation).toMatchObject({ corporateActionCashUsd: income, corporateActions: [`cash_dividend_AAPL_${S[11]}`], endpointHoldingsNetUsd: endpointNet });
    expect(cents(idea.liquidationSlippageUsd)).toBe(cents(idea.liquidation.proceedsUsd) + cents(income) - cents(endpointNet));
    expect(Math.abs(idea.liquidationSlippageUsd)).toBeLessThan(1); // the price fell by exactly the dividend: no slippage to speak of
    // The parts add up to what came back.
    expect(cents(idea.liquidation.returnedToTreasuryUsd)).toBe(cents(ideaOf(ctx).endpoint.cashUsd ?? 0) + cents(idea.liquidation.proceedsUsd) + cents(income));
    expect(idea.liquidation.blockedBy.map((b) => b.kind)).toEqual(['settlement_sale_held_for_corporate_action']);
  });

  it('a dividend credited ON the endpoint session is already in the endpoint\'s cash: it is not counted again beside the liquidation', async () => {
    const ctx = await setup({ names: ['AAPL'], comparison: { type: 'sector_fund', symbols: ['XLK'] } });
    for (let i = 1; i <= 9; i += 1) await closeDay(ctx, S[i]);
    const dividend = { type: 'cash_dividend', ticker: 'AAPL', effectiveDate: DUE, amount: 2.26, source: 'eodhd_dividends' };
    await closeDay(ctx, DUE, { AAPL: { price: BASE.AAPL, corporateActions: [dividend] } });
    const settled = ideaOf(ctx);
    expect(settled.status).toBe('settled');
    expect(settled.ledger.dividendsUsd).toBeGreaterThan(0);
    expect(cents(settled.endpoint.cashUsd)).toBe(cents(settled.ledger.cash)); // the dividend is in the endpoint's cash
    // The feed still lists the (applied) dividend the next morning: it holds nothing, and the sale fills.
    expect((await win(ctx, S[11], 'open30', { AAPL: { price: BASE.AAPL, corporateActions: [dividend] } })).sales).toMatchObject({ sold: 1, resulted: 1 });
    const idea = ideaOf(ctx);
    expect(idea.liquidation).toMatchObject({ corporateActionCashUsd: 0, corporateActions: [] });
    expect(cents(idea.liquidationSlippageUsd)).toBe(cents(idea.liquidation.proceedsUsd) - cents(idea.liquidation.endpointHoldingsNetUsd));
    expect(cents(idea.liquidation.returnedToTreasuryUsd)).toBe(cents(settled.endpoint.cashUsd) + cents(idea.liquidation.proceedsUsd));
  });

  it('a delisting with cash is settled by the pure ledger function without touching a mark, and a zero, negative or non-number cash amount is no cash amount', () => {
    const ledger = { ...newLedger('idea', 20000), cash: 100, holdings: { MSFT: { shares: 10, costBasisTotal: 4000, avgCost: 400, lastMark: 999, openedAt: S[0] } } };
    const paid = applyLedgerActions(ledger, { MSFT: [delisting('MSFT', 402.5)] }, { date: S[1] });
    expect(paid.ledger).toMatchObject({ cash: 4125, holdings: {}, realizedPnlUsd: 25 }); // 10 × 402.5, never 10 × the 999 mark
    expect(paid.closedByCash).toEqual([{ ticker: 'MSFT', actionId: `delisting_MSFT_${S[1]}`, cashUsd: 4025, realizedPnlUsd: 25 }]);
    expect(paid.delistedWaiting).toEqual([]);
    for (const bad of [0, -5, '402.5', null, NaN, Infinity]) {
      const out = applyLedgerActions(ledger, { MSFT: [{ ...delisting('MSFT'), cashPerShare: bad }] }, { date: S[1] });
      expect(out.ledger, String(bad)).toMatchObject({ cash: 100, holdings: { MSFT: { shares: 10 } }, realizedPnlUsd: 0, appliedActionIds: [] });
      expect(out.delistedWaiting, String(bad)).toEqual([{ ticker: 'MSFT', actionId: `delisting_MSFT_${S[1]}`, effectiveDate: S[1] }]);
      expect([...out.unresolved]).toEqual(['MSFT']);
    }
    // Two rows of one delisting with different cash amounts are a conflict: neither is applied.
    const conflict = applyLedgerActions(ledger, { MSFT: [delisting('MSFT', 402.5), delisting('MSFT', 410)] }, { date: S[1] });
    expect(conflict.ledger.holdings.MSFT.shares).toBe(10);
    expect(conflict.conflicts).toHaveLength(1);
  });

  it('a delisting that finds an idea already at its endpoint: a settled idea whose last waiting holding is paid out in cash is resulted at that close', async () => {
    const ctx = await setup({ names: ['AAPL'] });
    for (let i = 1; i <= 10; i += 1) await closeDay(ctx, S[i]);
    expect(ideaOf(ctx).status).toBe('settled');
    await win(ctx, S[11], 'open30', { AAPL: undefined }); // the settlement sale waits
    const endpointNet = ideaOf(ctx).endpoint.holdingsNetUsd;
    const out = await closeDay(ctx, S[11], { AAPL: { price: 233.2, corporateActions: [delisting('AAPL', 233.5, S[11])] } });
    expect(out.resulted).toEqual([ctx.ideaId]);
    const idea = ideaOf(ctx);
    expect(idea.status).toBe('resulted');
    expect(idea.ledger.saleReceipts).toEqual([]);
    expect(idea).toMatchObject({ liquidationProceedsUsd: 0, liquidation: { sales: [], endpointHoldingsNetUsd: endpointNet } }); // no sale: the cash came from the action
    // …and that cash is what the holding fetched (review RH-6): counted beside the sales' proceeds, under its own name,
    // so the slippage is the cash against the endpoint's figure — not a loss of the whole holding.
    const paid = idea.ledger.corporateActionReceipts.find((r) => r.type === 'delisting' && r.applied);
    expect(idea.liquidation).toMatchObject({ corporateActionCashUsd: paid.cashUsd, corporateActions: [`delisting_AAPL_${S[11]}`], proceedsUsd: 0 });
    expect(cents(idea.liquidationSlippageUsd)).toBe(cents(paid.cashUsd) - cents(endpointNet));
    expect(idea.liquidation.slippageUsd).toBe(idea.liquidationSlippageUsd);
    expect(Math.abs(idea.liquidationSlippageUsd)).toBeLessThan(200); // a few dollars of price move, never the holding's ~$10,000
    expect(bookOf(ctx)).toMatchObject({ slots: { short: null }, openIdeaIds: [] });
    expect(bookOf(ctx).treasury.unreservedCash).toBe(bookOf(ctx).portfolio.cash);
    expect(DUE).toBe(S[10]);
  });
});

// ── Astra T2A-01: a ticker change waits while the holding's share basis is unresolved ─────────────────────────────
// A conflict's receipt and the sale guard know the holding by its OLD ticker. Applied over an unresolved split,
// reverse split or stock distribution, a rename carried the unadjusted share count to a ticker no receipt names, and
// the next window sold it (Astra's three variants sold 199.940017 unadjusted shares and passed reconciliation). The
// rename now waits — on every ledger of the idea — until the share basis settles, and is applied at that close.
describe('Astra T2A-01 — a ticker change waits while the holding\'s share basis is unresolved', () => {
  const RENAME_ID = `ticker_change_AAPL_${S[1]}`;
  const VARIANTS = [['stock_distribution', 1.2, 1.3], ['split', 1.5, 1.6], ['reverse_split', 2 / 3, 2 / 3 + 0.1]];
  const basisRow = (type, ratio, effectiveDate = S[1]) => ({ type, ticker: 'AAPL', ratio, effectiveDate, source: 'eodhd' });
  const DOWN = roundUsd(BASE.AAPL * 0.9); // below the short slot's 5% line
  const daily = (ctx, date, syms) => ctx.db.collection('mandateUniverseDaily').doc(date).set({ date, symbols: Object.fromEntries(syms.map((s) => [s, { caFetchFailed: false }])) });
  const record = { from: 'AAPL', to: 'AAPLX', actionId: RENAME_ID, effectiveDate: S[1], deferredOn: S[1] };
  /** One name, AAPL, entered on S[0]. With `exit`, it closes S[0] below its line, so a line exit waits for a window. */
  async function setupOne({ exit = true } = {}) {
    const { db, bookId, bookRef } = await seedBook();
    const r = await admitAndEnter(db, bookId, { contract: contractOf({ names: ['AAPL'] }), quotes: quotes(), date: S[0] });
    const ctx = { db, bookId, bookRef, ideaId: r.ideaId };
    recon(ctx);
    await closeDay(ctx, S[0], exit ? { AAPL: DOWN } : {});
    if (exit) expect(ideaOf(ctx).ledger.holdings.AAPL.exitPending).toMatchObject({ reason: 'line', session: S[0] });
    return ctx;
  }
  /** S[1]: two contradictory rows of one share-basis action, and AAPL → AAPLX. */
  const conflictAndRename = (ctx, type, ratio, alt, price) => closeDay(ctx, S[1], {
    AAPL: { price, corporateActions: [basisRow(type, ratio), basisRow(type, alt), rename('AAPL', 'AAPLX')] },
  });

  for (const [type, ratio, alt] of VARIANTS) {
    it(`${type}: the rename waits on every ledger; the holding keeps its symbol and its record; the sale is held, nothing is sold, and the book reconciles`, async () => {
      const ctx = await setupOne();
      const before = ideaOf(ctx);
      const price = roundUsd(DOWN / ratio);
      const out = await conflictAndRename(ctx, type, ratio, alt, price);
      const idea = ideaOf(ctx);
      for (const ledger of [idea.ledger, idea.comparisonLedger]) {
        expect(Object.keys(ledger.holdings), ledger.kind).toEqual(['AAPL']);
        expect(ledger.holdings.AAPL.shares).toBe(before.ledger.holdings.AAPL.shares); // nothing adjusted, nothing renamed
        expect(ledger.holdings.AAPL.deferredRename).toEqual(record);
        expect(ledger.appliedActionIds).toEqual([]);
        expect(receiptsOf(ledger, 'ticker_change')).toEqual([]);
      }
      expect(idea.spyLedger.holdings.SPY.deferredRename).toBeUndefined();
      expect(Object.keys(bookOf(ctx).portfolio.positions)).toEqual(['AAPL']);
      expect(Object.keys(coverageOf(ctx)).sort()).toEqual(['AAPL', 'SPY']);
      expect(idea.lines.map((l) => l.symbol)).toEqual(['AAPL']);
      expect(out.alerts.filter((a) => /PRACTICE_FIELD_RENAME_DEFERRED/.test(a))).toEqual([
        `PRACTICE_FIELD_RENAME_DEFERRED ${ctx.ideaId} idea AAPL→AAPLX ${RENAME_ID} — the holding's share basis is unresolved; the ticker change waits (since ${S[1]}), the holding keeps its symbol and its sale stays held`,
        `PRACTICE_FIELD_RENAME_DEFERRED ${ctx.ideaId} comparison AAPL→AAPLX ${RENAME_ID} — the holding's share basis is unresolved; the ticker change waits (since ${S[1]}), the holding keeps its symbol and its sale stays held`,
      ]);
      expect(rowOf(ctx, S[1])).toMatchObject({ fullQuality: false, marks: { AAPL: { quality: 'carried_forward' } }, corporateActionsApplied: { idea: [], comparison: [], spy: [] } });

      // The next window quotes the new ticker only, and the feed no longer lists the conflict: the sale is HELD
      // under its own name, because the conflict's receipt still names the symbol the holding is held under.
      await daily(ctx, S[2], ['AAPL', 'AAPLX', 'SPY']);
      const w = await win(ctx, S[2], 'open30', { AAPL: undefined, AAPLX: price });
      expect(w.sales).toMatchObject({ sold: 0, waiting: 1 });
      const held = ideaOf(ctx);
      expect(held.ledger.saleReceipts).toEqual([]);
      expect(held.ledger.holdings.AAPL).toMatchObject({ shares: before.ledger.holdings.AAPL.shares, deferredRename: record });
      expect(held.ledger.holdings.AAPL.exitPending.waiting.lastRefusal).toBe('corporate_action_unsettled');
      expect(held.blockedBy).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'line_exit_held_for_corporate_action', symbol: 'AAPL' })]));
      expect(bookOf(ctx).slots.short).toBe(ctx.ideaId);
    });

    for (const listed of [true, false]) {
      it(`${type}: when the feed then presents ONE consistent row, the action applies, then the rename (${listed ? 'its row still listed' : 'from the record, its row dropped'}), and the sale fills on the adjusted share count`, async () => {
        const ctx = await setupOne();
        const oldShares = ideaOf(ctx).ledger.holdings.AAPL.shares;
        const price = roundUsd(DOWN / ratio);
        await conflictAndRename(ctx, type, ratio, alt, price);
        const out = await closeDay(ctx, S[2], {
          AAPL: { price, corporateActions: [basisRow(type, ratio), ...(listed ? [rename('AAPL', 'AAPLX')] : [])] }, AAPLX: price,
        });
        const basisId = `${type}_AAPL_${S[1]}`;
        const adjusted = Math.round(oldShares * ratio * 1e6) / 1e6;
        const idea = ideaOf(ctx);
        for (const ledger of [idea.ledger, idea.comparisonLedger]) {
          expect(Object.keys(ledger.holdings), ledger.kind).toEqual(['AAPLX']);
          expect(ledger.holdings.AAPLX.shares).toBe(adjusted);
          expect(ledger.holdings.AAPLX).not.toHaveProperty('deferredRename');
          expect(ledger.appliedActionIds).toEqual([basisId, RENAME_ID]); // the share basis first, then the rename
          expect(receiptsOf(ledger, 'ticker_change')).toEqual([expect.objectContaining({
            actionId: RENAME_ID, ticker: 'AAPL', renamedTo: 'AAPLX', applied: true, appliedOn: S[2], deferred: true, deferredOn: S[1],
          })]);
        }
        expect(idea.ledger.holdings.AAPLX.exitPending).toMatchObject({ reason: 'line', session: S[0] });
        expect(idea.lines.map((l) => l.symbol)).toEqual(['AAPLX']);
        expect(idea.lines[0].renamedFrom).toEqual([{ symbol: 'AAPL', actionId: RENAME_ID, appliedOn: S[2] }]);
        expect(Object.keys(bookOf(ctx).portfolio.positions)).toEqual(['AAPLX']);
        expect(bookOf(ctx).portfolio.positions.AAPLX).toMatchObject({ ideaId: ctx.ideaId, shares: adjusted });
        expect(Object.keys(coverageOf(ctx)).sort()).toEqual(['AAPLX', 'SPY']); // coverage follows (R-18)
        expect(out.alerts.filter((a) => /PRACTICE_FIELD_RENAME_DEFERRED/.test(a))).toEqual([]);
        expect(rowOf(ctx, S[2]).corporateActionsApplied).toEqual({ idea: [basisId, RENAME_ID], comparison: [basisId, RENAME_ID], spy: [] });

        await daily(ctx, S[3], ['AAPLX', 'SPY']);
        const w = await win(ctx, S[3], 'open30', { AAPL: undefined, AAPLX: price });
        expect(w.sales).toMatchObject({ sold: 1 });
        expect(ideaOf(ctx).ledger.saleReceipts[0]).toMatchObject({ symbol: 'AAPLX', shares: adjusted });
      });
    }
  }

  it('a conflict the feed DROPS never settles: the holding stays held under its old symbol, keeps its record, alerts from the fifth session, and keeps its slot', async () => {
    const ctx = await setupOne();
    const price = roundUsd(DOWN / 1.5);
    await conflictAndRename(ctx, 'split', 1.5, 1.6, price);
    const shares = ideaOf(ctx).ledger.holdings.AAPL.shares;
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    for (let i = 0; i < 6; i += 1) {
      const date = S[2 + i];
      await daily(ctx, date, ['AAPL', 'AAPLX', 'SPY']);
      const w = await win(ctx, date, 'open30', { AAPL: undefined, AAPLX: price });
      expect(w.sales.sold, date).toBe(0);
      expect(w.sales.alerts.filter((a) => /PRACTICE_FIELD_SALE_WAITING/.test(a)).length, date).toBe(i >= 4 ? 1 : 0);
      const out = await closeDay(ctx, date, { AAPL: undefined, AAPLX: price });
      expect(out.alerts.filter((a) => /PRACTICE_FIELD_RENAME_DEFERRED .* idea /.test(a)).length, date).toBe(1);
      const idea = ideaOf(ctx);
      expect(idea.ledger.holdings.AAPL).toMatchObject({ shares, deferredRename: record });
      expect(idea.comparisonLedger.holdings.AAPL.deferredRename).toEqual(record);
      expect(idea.ledger.appliedActionIds).toEqual([]);
    }
    expect(bookOf(ctx).slots.short).toBe(ctx.ideaId);
    errors.mockRestore();
  });

  it('a same-stock idea and its comparison stay TIED through the wait and the settling close (rule 9: no fill was made)', async () => {
    const ctx = await setupOne({ exit: false });
    const tied = () => {
      const idea = ideaOf(ctx);
      expect(idea.postEntryFillCount).toBe(0);
      expect(idea.comparisonLedger.holdings).toEqual(idea.ledger.holdings);
      expect(idea.comparisonLedger.cash).toBe(idea.ledger.cash);
      expect(idea.comparisonLedger.appliedActionIds).toEqual(idea.ledger.appliedActionIds);
      return idea;
    };
    const price = roundUsd(BASE.AAPL / 1.5);
    await conflictAndRename(ctx, 'split', 1.5, 1.6, price);
    expect(tied().ledger.holdings.AAPL.deferredRename).toEqual(record);
    expect(rowOf(ctx, S[1]).markedGapUsd).toBe(0);
    // The snapshot still quotes the old symbol, unmoved: a holding whose rename waits is valued at its CARRIED mark, as
    // R-36's blocked rename is (its share basis is unresolved) — never the snapshot's price against an unadjusted count.
    await closeDay(ctx, S[2], { AAPL: BASE.AAPL, AAPLX: price });
    expect(tied().ledger.holdings.AAPL.deferredRename).toEqual(record);
    expect(rowOf(ctx, S[2]).marks.AAPL.quality).toBe('carried_forward');
    expect(rowOf(ctx, S[2]).comparisonMarks.AAPL.quality).toBe('carried_forward');
    expect(rowOf(ctx, S[2]).markedGapUsd).toBe(0);
    await closeDay(ctx, S[3], { AAPL: { price, corporateActions: [basisRow('split', 1.5)] }, AAPLX: price });
    expect(Object.keys(tied().ledger.holdings)).toEqual(['AAPLX']);
    expect(rowOf(ctx, S[3]).markedGapUsd).toBe(0);
  });

  it('the choice is the IDEA\'s: a ledger whose own share basis is settled still waits when another ledger of the idea has the symbol unresolved', () => {
    const held = { AAPL: { shares: 10, costBasisTotal: 1000, avgCost: 100, lastMark: 100, lastMarkAsOf: null, lastMarkSource: 'snapshot', sector: 'Technology', openedAt: S[0] } };
    const clean = { ...newLedger('comparison', 1000), cash: 0, holdings: held };
    const unsettled = {
      ...newLedger('idea', 1000), cash: 0, holdings: held,
      corporateActionReceipts: [{ actionId: `split_AAPL_${S[1]}`, type: 'split', ticker: 'AAPL', effectiveDate: S[1], applied: false, reason: 'conflicting_action', entitled: true, rows: [], seenOn: S[1] }],
    };
    const feed = { AAPL: [rename('AAPL', 'AAPLX', S[2])] };
    expect([...renameDeferralSymbols([clean], feed, { date: S[2] })]).toEqual([]);
    const deferRenames = renameDeferralSymbols([unsettled, clean], feed, { date: S[2] });
    expect([...deferRenames]).toEqual(['AAPL']);
    expect(Object.keys(applyLedgerActions(clean, feed, { date: S[2] }).ledger.holdings)).toEqual(['AAPLX']); // alone, it would rename
    const waited = applyLedgerActions(clean, feed, { date: S[2], deferRenames });
    expect(Object.keys(waited.ledger.holdings)).toEqual(['AAPL']);
    expect(waited.ledger.holdings.AAPL.deferredRename).toEqual({ from: 'AAPL', to: 'AAPLX', actionId: `ticker_change_AAPL_${S[2]}`, effectiveDate: S[2], deferredOn: S[2] });
    expect(waited.renames).toEqual([]);
    expect([...waited.unresolved]).toEqual(['AAPL']);
    // And on the ledger with the conflict, alone, it waits too.
    expect(Object.keys(applyLedgerActions(unsettled, feed, { date: S[2] }).ledger.holdings)).toEqual(['AAPL']);
    // A share-basis action DUE that the ledger has neither applied nor declined holds it the same way (here, one
    // whose ratio the applier refuses).
    const due = { AAPL: [{ type: 'split', ticker: 'AAPL', ratio: -2, effectiveDate: S[2], source: 'eodhd' }, rename('AAPL', 'AAPLX', S[2])] };
    expect(Object.keys(applyLedgerActions(clean, due, { date: S[2] }).ledger.holdings)).toEqual(['AAPL']);
  });

  /** A holds AAPL; at S[1] a split conflict and AAPL → AMD: the rename waits. `beforeWait` runs before that close. */
  async function waitingOnAmd(beforeWait = async () => {}) {
    const { db, bookId, bookRef } = await seedBook({ archetypeCodeId: 'degen' });
    const a = await admitAndEnter(db, bookId, { contract: contractOf({ names: ['AAPL'] }), quotes: quotes(), date: S[0] });
    const ctx = { db, bookId, bookRef, ideaId: a.ideaId };
    await closeDay(ctx, S[0]);
    const extra = await beforeWait(ctx);
    const price = roundUsd(BASE.AAPL / 1.5);
    await closeDay(ctx, S[1], { AAPL: { price, corporateActions: [basisRow('split', 1.5), basisRow('split', 1.6), rename('AAPL', 'AMD')] } });
    expect(ideaOf(ctx).ledger.holdings.AAPL.deferredRename).toMatchObject({ to: 'AMD', deferredOn: S[1] });
    return { ctx, price, extra };
  }

  it('while a rename waits, its TARGET is the waiting idea\'s at ADMISSION (review finding 1): another idea naming it is refused, as it would be had the rename applied', async () => {
    const { ctx } = await waitingOnAmd();
    const late = await admitIdea(ctx.db, { bookId: ctx.bookId, opId: 'idea-late', contract: contractOf({ slot: 'medium', names: ['AMD'], capitalUsd: 15000 }), nowIso: etIsoOf(S[1], 18, 0) });
    expect(late.ok).toBe(false);
    expect(late.refusals).toEqual([expect.objectContaining({ code: 'ticker_held_by_other_idea', symbol: 'AMD', ideaId: ctx.ideaId })]);
  });

  it('…and at ENTRY: an idea naming the target, admitted before the wait began, does not buy it; nothing is written', async () => {
    const { ctx, price, extra: early } = await waitingOnAmd(async (c) => {
      // Admitted on S[1] before the close (it starts on S[2]): nothing reserved AMD then.
      const r = await admitIdea(c.db, { bookId: c.bookId, opId: 'idea-early', contract: contractOf({ slot: 'medium', names: ['AMD'], capitalUsd: 15000 }), nowIso: etIsoOf(S[1], 11, 0) });
      expect(r).toMatchObject({ ok: true, startSession: S[2] });
      return r;
    });
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const before = bookOf(ctx).portfolio;
    const w = await win(ctx, S[2], 'open30', { AAPL: undefined, AMD: price });
    expect(w.entries.entered).toBe(0);
    expect(getIdea(ctx.db, ctx.bookId, early.ideaId).status).toBe('accepted');
    expect(bookOf(ctx).portfolio).toEqual(before);
    errors.mockRestore();
  });

  it('R-36 on the record path: a deferred rename taken from its record into a symbol another idea holds is not applied, keeps its record and is reported blocked (ledger.js)', () => {
    const record = { from: 'AAPL', to: 'AMD', actionId: `ticker_change_AAPL_${S[1]}`, effectiveDate: S[1], deferredOn: S[1] };
    const held = { AAPL: { shares: 10, costBasisTotal: 1000, avgCost: 100, lastMark: 100, lastMarkAsOf: null, lastMarkSource: 'snapshot', sector: 'Technology', openedAt: S[0], deferredRename: record } };
    const ledger = { ...newLedger('idea', 1000), cash: 0, holdings: held };
    // The feed no longer lists the rename, and nothing holds the share basis now.
    const blocked = applyLedgerActions(ledger, {}, { date: S[2], renameTargetsTaken: new Set(['AMD']) });
    expect(Object.keys(blocked.ledger.holdings)).toEqual(['AAPL']);
    expect(blocked.ledger.holdings.AAPL.deferredRename).toEqual(record);
    expect(blocked.renamesBlocked).toEqual([{ from: 'AAPL', to: 'AMD', actionId: record.actionId }]);
    expect([...blocked.unresolved]).toEqual(['AAPL']);
    expect(blocked.ledger.appliedActionIds).toEqual([]);
    // With the target free, the record applies it, receipted as deferred.
    const free = applyLedgerActions(ledger, {}, { date: S[2], renameTargetsTaken: new Set() });
    expect(Object.keys(free.ledger.holdings)).toEqual(['AMD']);
    expect(free.ledger.holdings.AMD).not.toHaveProperty('deferredRename');
    expect(free.renames).toEqual([{ from: 'AAPL', to: 'AMD', actionId: record.actionId, deferred: true, deferredOn: S[1] }]);
  });

  it('the choice is the IDEA\'s, through the close (review finding 2): when only the comparison cannot apply a share-basis action, the idea\'s own ledger waits too — the idea, its line and the book are not renamed', async () => {
    // A frozen-basket comparison that holds the idea's name, with a different quantity: a reverse split so extreme it
    // rounds the comparison's smaller holding to nothing (not applied, so unresolved there) but not the idea's.
    const { db, bookId, bookRef } = await seedBook({ archetypeCodeId: 'degen' });
    const a = await admitAndEnter(db, bookId, { contract: contractOf({ names: ['AAPL'], comparison: { type: 'frozen_basket', symbols: ['AAPL', 'MSFT'] } }), quotes: quotes(), date: S[0] });
    const ctx = { db, bookId, bookRef, ideaId: a.ideaId };
    await closeDay(ctx, S[0]);
    const r = 1e-8;
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    await closeDay(ctx, S[1], { AAPL: { price: roundUsd(BASE.AAPL / r), corporateActions: [basisRow('reverse_split', r), rename('AAPL', 'AAPLX')] }, AAPLX: roundUsd(BASE.AAPL / r) });
    const idea = ideaOf(ctx);
    expect(idea.ledger.appliedActionIds).toEqual([`reverse_split_AAPL_${S[1]}`]); // the idea's own ledger applied it…
    expect(idea.comparisonLedger.appliedActionIds).toEqual([]); // …the comparison's could not
    for (const ledger of [idea.ledger, idea.comparisonLedger]) {
      expect(ledger.holdings.AAPL?.deferredRename, ledger.kind).toMatchObject({ from: 'AAPL', to: 'AAPLX' });
      expect(ledger.holdings).not.toHaveProperty('AAPLX');
    }
    expect(idea.lines.map((l) => l.symbol)).toEqual(['AAPL']);
    expect(Object.keys(bookOf(ctx).portfolio.positions)).toEqual(['AAPL']);
    errors.mockRestore();
  });
});
