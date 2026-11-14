// api/_utils/practiceField/entry.test.js
//
// Practice Field T1a-1 — BASKET ENTRY, BY CODE, MATCHED ON BOTH SIDES (build prompt §6; shared contract V2 §14
// cases B-ENTER, B-FILL, B-RECON; Amendment C §7 cases B-NOFILL, B-OWNED), and the reconciliation itself.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { enterIdea, computeBasketEntry, entrySymbols, entryDecisionId } from './entry.js';
import { admitIdea, releaseIdea } from './admission.js';
import { closeIdeaBook } from './close.js';
import { assertReconciled } from './reconcile.js';
import { markedEquityCents } from './ledger.js';
import { roundUsd } from '../mandateRounding.js';
import { isPracticeFieldError } from './errors.js';
import { setPracticeFieldModeForTests } from './mode.js';
import { ideaEntrySlots, isLastIdeaEntrySlot, ideaEntryNotBefore, ideaSchedule, nextSessionDate, sessionAfter } from './windows.js';
import { SLOT_NAMES } from '../mandateSessionSlots.js';
import {
  seedBook, admitAndEnter, contractOf, getBook, getIdea, tickOf, tickSnapshot, closeSnapshot, slotOpenIso, etIso, DAYS, ADMIT_ISO, countDocs,
  takeSeededDbs, saleWordsOnMarkRows, bannedWordsOnResults, closeOn, storeCloseSnapshot, enterIdeaWith, entryPassWith, placeSnapshot, moneyStoreBytes,
} from './__testsupport__/fixtures.js';

const CAP = { AAPL: 3.4e12, MSFT: 3.1e12, NVDA: 3.5e12, AMD: 2.6e11, LLY: 7.5e11, JPM: 6.8e11, XOM: 5.2e11, AVGO: 8.2e11 };
const PX = { AAPL: 231.47, MSFT: 418.13, NVDA: 141.29, AMD: 139.83, LLY: 803.17, JPM: 241.37, XOM: 118.53, AVGO: 172.91, SPY: 597.31, XLK: 233.59, XLV: 147.23 };
const q = (...syms) => Object.fromEntries(syms.map((s) => [s, CAP[s] ? { price: PX[s], marketCap: CAP[s] } : PX[s]]));
const cents = (n) => Math.round(n * 100);
const openIdeas = (db, bookId) => getBook(db, bookId).openIdeaIds.map((id) => getIdea(db, bookId, id));
const nowAt = (date, slot) => new Date(Date.parse(slotOpenIso(date, slot)) + 2 * 60_000).toISOString();

let restoreMode;
beforeEach(() => { restoreMode = setPracticeFieldModeForTests('on'); takeSeededDbs(); });
afterEach(() => {
  restoreMode();
  for (const db of takeSeededDbs()) {
    expect(saleWordsOnMarkRows(db)).toEqual([]); // B-MARK on every valuation row this file's tests wrote
    expect(bannedWordsOnResults(db)).toEqual([]); // …and the three banned words on every result (review RH-11)
  }
});

describe('windows.js — when the idea book\'s code acts, in one place', () => {
  it('the entry slots are the engine\'s existing three; the last one is preClose', () => {
    expect(ideaEntrySlots()).toEqual([...SLOT_NAMES]);
    expect(ideaEntrySlots()).toEqual(['open30', 'midday', 'preClose']);
    expect(isLastIdeaEntrySlot('preClose')).toBe(true);
    expect(isLastIdeaEntrySlot('midday')).toBe(false);
  });

  it('entryNotBefore is the first entry slot of the first session strictly AFTER the admission\'s date', () => {
    const fridayMorning = etIso('2026-11-13', 8, 0); // before Friday's open: still the NEXT session
    expect(ideaEntryNotBefore(fridayMorning)).toEqual({ sessionDate: '2026-11-16', slot: 'open30', iso: etIso('2026-11-16', 10, 0) });
    expect(ideaEntryNotBefore(etIso('2026-11-13', 15, 59)).sessionDate).toBe('2026-11-16');
    expect(ideaEntryNotBefore(etIso('2026-11-14', 12, 0)).sessionDate).toBe('2026-11-16'); // a Saturday
    expect(ideaEntryNotBefore(etIso('2026-11-25', 12, 0)).sessionDate).toBe('2026-11-27'); // Thanksgiving is skipped
    expect(ideaEntryNotBefore(etIso('2026-11-27', 9, 0)).sessionDate).toBe('2026-11-30');
    expect(ideaEntryNotBefore('2027-12-31T16:00:00.000Z')).toBeNull();
    expect(ideaEntryNotBefore('not-a-date')).toBeNull();
  });

  it('the due session is the start plus the slot\'s length in trading sessions (the start is session 0)', () => {
    expect(nextSessionDate('2026-11-25')).toBe('2026-11-27');
    expect(sessionAfter('2026-11-16', 10)).toBe('2026-12-01');
    expect(ideaSchedule(ADMIT_ISO, 'short')).toMatchObject({ startSession: '2026-11-16', dueSession: '2026-12-01', sessions: 10 });
    expect(ideaSchedule(ADMIT_ISO, 'medium')).toMatchObject({ dueSession: '2026-12-30', sessions: 30 });
    expect(ideaSchedule(ADMIT_ISO, 'long')).toMatchObject({ dueSession: '2027-02-12', sessions: 60 });
    expect(ideaSchedule(ADMIT_ISO, 'intraday')).toBeNull();
  });
});

describe('B-ENTER — a four-name idea fills its basket by code at the first eligible snapshot', () => {
  it('fills every name in one transaction, with positions owned by the idea, decisions of origin basket_entry, and the model\'s action count unchanged', async () => {
    const { db, bookId } = await seedBook();
    const names = ['AAPL', 'MSFT', 'NVDA', 'AMD'];
    const before = getBook(db, bookId);
    const r = await admitAndEnter(db, bookId, { contract: contractOf({ names, capitalUsd: 20000 }), quotes: q(...names, 'SPY') });
    expect(r.entry).toEqual({ outcome: 'entered', legs: 4 });

    const book = getBook(db, bookId);
    const idea = getIdea(db, bookId, r.ideaId);
    expect(idea.status).toBe('holding');
    expect(idea.statusHistory.map((h) => h.status)).toEqual(['accepted', 'entering', 'holding']);
    expect(idea.entry).toEqual({
      sessionDate: DAYS.d1, slot: 'open30', snapshotKey: `${DAYS.d1}_open30`, filledAt: nowAt(DAYS.d1, 'open30'), startMarkAt: etIso(DAYS.d1, 9, 45), unknownCostTierLegs: [],
      legCount: 4, costsPaidUsd: idea.ledger.costsPaidUsd,
    });
    // What T1a-2a's lines, sales and result start from.
    expect(idea).toMatchObject({ postEntryFillCount: 0, unobservedLineSessions: {}, processQuality: 'followed_plan', blockedBy: [], waitedSessions: [], result: null });
    expect(idea.ledger.saleReceipts).toEqual([]);
    // E5: every holding, on every ledger, stores the cost tier it entered with.
    for (const name of names) {
      expect(idea.ledger.holdings[name].costTier, name).toEqual({ capTier: 'mega', slippageBps: 1, spreadProxyBps: 2 });
      expect(idea.comparisonLedger.holdings[name].costTier, name).toEqual({ capTier: 'mega', slippageBps: 1, spreadProxyBps: 2 });
    }
    expect(idea.spyLedger.holdings.SPY.costTier).toEqual({ capTier: 'fund:liquid_fund', slippageBps: 1, spreadProxyBps: 2 });

    // Each leg: $5,000.00 planned, shares floored to 6 dp at mark + friction, cost in whole cents, never above the plan.
    let costCents = 0;
    for (const name of names) {
      const tierBps = CAP[name] >= 200e9 ? 3 : 5;
      const execPrice = PX[name] * (1 + tierBps / 10000);
      const shares = Math.floor((5000 / execPrice) * 1e6) / 1e6;
      const pos = book.portfolio.positions[name];
      expect(pos, name).toMatchObject({ shares, ideaId: r.ideaId, openedAt: DAYS.d1, lastMark: PX[name], lastMarkSource: 'snapshot', sector: 'Technology' });
      expect(cents(pos.costBasisTotal)).toBeLessThanOrEqual(500000);
      expect(idea.ledger.holdings[name]).toMatchObject({ shares, costBasisTotal: pos.costBasisTotal });
      expect(Object.hasOwn(idea.ledger.holdings[name], 'ideaId')).toBe(false);
      costCents += cents(pos.costBasisTotal);
    }
    // The book's cash fell by exactly the four costs; the treasury did not move at entry; the idea keeps the residual.
    expect(cents(book.portfolio.cash)).toBe(cents(before.portfolio.cash) - costCents);
    expect(book.treasury.unreservedCash).toBe(80000);
    expect(cents(idea.ledger.cash)).toBe(2000000 - costCents);
    expect(book.revision).toBe(2);
    expect(() => assertReconciled(book, [idea])).not.toThrow();

    // Decisions: one per leg, code not model.
    const decisions = names.map((n) => db._get(`mandates/${bookId}/decisions/${entryDecisionId(r.ideaId, n)}`));
    for (const d of decisions) {
      expect(d).toMatchObject({
        verb: 'BUY', status: 'executed', kind: 'idea_book', origin: 'basket_entry', ideaId: r.ideaId, epochId: 'epoch-0001', contractVersion: 2,
        fillMarkQuality: 'fresh', rationale: null, rationaleStatus: 'absent', convictionDiagnostic: null, modelId: null,
        generationConfigVersion: null, rationaleAt: null, rationaleAtBasis: null, frictionModelVersion: 'p3_cap_tier_v1',
        harvestTickKey: `${DAYS.d1}_open30`, baseRevision: 1,
      });
      expect(d.friction).toMatchObject({ spreadBasis: 'proxy', frictionBasis: 'idealized_no_market_impact' });
    }
    expect(countDocs(db, `mandates/${bookId}/decisions/`)).toBe(4);
    // B-ENTER: the model's action counters did not move.
    expect(book.execState).toMatchObject({ submitted: 0, executed: 0, staleRejectStreak: 0, openBatchId: null });
    // Coverage: the names are held now.
    const cov = db._get('practiceFieldCoverage/current').symbols;
    for (const name of names) expect(cov[name].roles).toEqual(['held', 'comparison']);
    expect(cov.SPY.roles).toEqual(['benchmark']);
  });

  it('three EQUAL names enter: $6,666.66 each, two cents stay the idea\'s cash, and no leg can outspend what is left', async () => {
    const { db, bookId } = await seedBook();
    const names = ['AAPL', 'MSFT', 'NVDA'];
    const r = await admitAndEnter(db, bookId, { contract: contractOf({ names, capitalUsd: 20000 }), quotes: q(...names, 'SPY') });
    expect(r.entry.outcome).toBe('entered');
    const idea = getIdea(db, bookId, r.ideaId);
    for (const name of names) expect(cents(idea.ledger.holdings[name].costBasisTotal)).toBeLessThanOrEqual(666666);
    const basis = names.reduce((s, n) => s + cents(idea.ledger.holdings[n].costBasisTotal), 0);
    expect(cents(idea.ledger.cash)).toBe(2000000 - basis);
    expect(cents(idea.ledger.cash)).toBeGreaterThanOrEqual(2);
    expect(() => assertReconciled(getBook(db, bookId), [idea])).not.toThrow();
  });

  it('the inception row: reserved capital before costs, the snapshot\'s key and vendor times, each leg\'s fill, costs paid, every ledger\'s opening value', async () => {
    const { db, bookId } = await seedBook();
    const r = await admitAndEnter(db, bookId, { contract: contractOf({ names: ['AAPL', 'MSFT'], comparison: { type: 'sector_fund', symbols: ['XLK'] } }), quotes: q('AAPL', 'MSFT', 'SPY', 'XLK') });
    const row = db._get(`mandates/${bookId}/ideas/${r.ideaId}/rows/inception`);
    const idea = getIdea(db, bookId, r.ideaId);
    expect(row).toMatchObject({
      rowKind: 'inception', basis: 'fill', ideaId: r.ideaId, bookId, sessionDate: DAYS.d1, startSnapshotKey: `${DAYS.d1}_open30`,
      startMarkAt: etIso(DAYS.d1, 9, 45), reservedCapitalUsd: 20000, origin: { kind: 'founder_fixture', initiatedBy: 'agent' },
    });
    expect(row.legs.idea.map((l) => l.symbol)).toEqual(['AAPL', 'MSFT']);
    expect(row.legs.comparison.map((l) => l.symbol)).toEqual(['XLK']);
    expect(row.legs.spy.map((l) => l.symbol)).toEqual(['SPY']);
    for (const leg of [...row.legs.idea, ...row.legs.comparison, ...row.legs.spy]) {
      expect(leg).toMatchObject({ verb: 'BUY', markSource: 'snapshot', markVendorTimeIso: etIso(DAYS.d1, 9, 45), realizedPnl: 0 });
    }
    expect(row.costsPaidUsd).toEqual({ idea: idea.ledger.costsPaidUsd, comparison: idea.comparisonLedger.costsPaidUsd, spy: idea.spyLedger.costsPaidUsd });
    // Opening value = capital − costs paid, to the cent (the fills priced at this snapshot's own marks).
    for (const k of ['idea', 'comparison', 'spy']) expect(Math.abs(cents(row.openingMarkedValue[k]) - (2000000 - cents(row.costsPaidUsd[k])))).toBeLessThanOrEqual(1);
    expect(row.openingMarkedValue.idea).toBeLessThan(20000);
  });

  it('the lines are frozen at fill: level = fill price × (1 − distance), in the idea record\'s invalidation shape', async () => {
    const { db, bookId } = await seedBook();
    const lines = [{ symbol: 'AAPL', distancePct: 0.05 }, { symbol: 'MSFT', distancePct: 0.0777 }];
    const r = await admitAndEnter(db, bookId, { contract: contractOf({ names: ['AAPL', 'MSFT'], lines }), quotes: q('AAPL', 'MSFT', 'SPY') });
    const idea = getIdea(db, bookId, r.ideaId);
    const fill = (s) => PX[s] * (1 + 3 / 10000);
    expect(idea.lines).toEqual([
      { symbol: 'AAPL', side: 'below', level: fill('AAPL') * (1 - 0.05), basis: 'daily_close', distancePct: 0.05, fillPrice: fill('AAPL'), entryMark: PX.AAPL, adjustments: [] },
      { symbol: 'MSFT', side: 'below', level: fill('MSFT') * (1 - 0.0777), basis: 'daily_close', distancePct: 0.0777, fillPrice: fill('MSFT'), entryMark: PX.MSFT, adjustments: [] },
    ]);
    expect(idea.contract.lines).toEqual(lines); // the contract keeps the distances it was admitted with
  });
});

describe('the comparison and SPY: same capital, same snapshot, same cost policy', () => {
  it('same_stock_held is the idea\'s own fill copied — quantities, basis, costs, residual cash', async () => {
    const { db, bookId } = await seedBook();
    const r = await admitAndEnter(db, bookId, { contract: contractOf({ names: ['AAPL', 'MSFT', 'NVDA'] }), quotes: q('AAPL', 'MSFT', 'NVDA', 'SPY') });
    const idea = getIdea(db, bookId, r.ideaId);
    expect(idea.comparisonLedger).toEqual({ ...idea.ledger, kind: 'comparison' });
    expect(idea.comparisonLedger.holdings).not.toBe(idea.ledger.holdings);
    // Never part of the book's portfolio: the book holds each share once.
    expect(Object.keys(getBook(db, bookId).portfolio.positions).sort()).toEqual(['AAPL', 'MSFT', 'NVDA']);
  });

  it('sector_fund buys the fund with the SAME capital at the fund\'s explicit tier (3 bps), never the market-cap fallback (20 bps)', async () => {
    const { db, bookId } = await seedBook();
    const r = await admitAndEnter(db, bookId, { contract: contractOf({ names: ['LLY'], comparison: { type: 'sector_fund', symbols: ['XLV'] } }), quotes: q('LLY', 'SPY', 'XLV') });
    const idea = getIdea(db, bookId, r.ideaId);
    const execPrice = PX.XLV * (1 + 3 / 10000);
    const shares = Math.floor((20000 / execPrice) * 1e6) / 1e6;
    expect(idea.comparisonLedger).toMatchObject({ kind: 'comparison', reservedCapitalUsd: 20000 });
    expect(idea.comparisonLedger.holdings.XLV).toMatchObject({ shares, sector: 'Health Care', openedAt: DAYS.d1 });
    expect(cents(idea.comparisonLedger.cash)).toBe(2000000 - cents(idea.comparisonLedger.holdings.XLV.costBasisTotal));
    expect(Object.keys(getBook(db, bookId).portfolio.positions)).toEqual(['LLY']); // the fund is paper beside the book
    const row = db._get(`mandates/${bookId}/ideas/${r.ideaId}/rows/inception`);
    expect(row.legs.comparison[0].friction).toMatchObject({ slippageBps: 1, spreadProxyBps: 2, capTier: 'fund:liquid_fund' });
    expect(row.legs.idea[0].friction).toMatchObject({ slippageBps: 1, spreadProxyBps: 2, capTier: 'mega' }); // a stock: its market-cap tier
  });

  it('frozen_basket splits the same capital equally in whole cents, each stock at ITS market-cap tier', async () => {
    const { db, bookId } = await seedBook();
    const basket = ['NVDA', 'AMD', 'AVGO'];
    const r = await admitAndEnter(db, bookId, { contract: contractOf({ names: ['AAPL'], comparison: { type: 'frozen_basket', symbols: basket } }), quotes: q('AAPL', ...basket, 'SPY') });
    const idea = getIdea(db, bookId, r.ideaId);
    const row = db._get(`mandates/${bookId}/ideas/${r.ideaId}/rows/inception`);
    expect(row.legs.comparison.map((l) => [l.symbol, l.requestedSizeUsd, l.friction.capTier])).toEqual([['NVDA', 6666.66, 'mega'], ['AMD', 6666.66, 'mega'], ['AVGO', 6666.66, 'mega']]);
    const basis = basket.reduce((s, n) => s + cents(idea.comparisonLedger.holdings[n].costBasisTotal), 0);
    expect(cents(idea.comparisonLedger.cash)).toBe(2000000 - basis);
    expect(Object.keys(getBook(db, bookId).portfolio.positions)).toEqual(['AAPL']);
  });

  it('SPY is a third ledger built the same way; a small-cap STOCK pays its own tier, by name', async () => {
    const { db, bookId } = await seedBook();
    const r = await admitAndEnter(db, bookId, { contract: contractOf({ names: ['AAPL'] }), quotes: { AAPL: PX.AAPL, SPY: PX.SPY } }); // the fixture's small-cap market cap on AAPL
    const idea = getIdea(db, bookId, r.ideaId);
    const execPrice = PX.SPY * (1 + 3 / 10000);
    expect(idea.spyLedger.holdings.SPY).toMatchObject({ shares: Math.floor((20000 / execPrice) * 1e6) / 1e6, sector: 'broad_market' });
    const row = db._get(`mandates/${bookId}/ideas/${r.ideaId}/rows/inception`);
    expect(row.legs.idea[0].friction).toMatchObject({ slippageBps: 5, spreadProxyBps: 15, capTier: 'small' });
    expect(row.legs.spy[0].friction.capTier).toBe('fund:liquid_fund');
    // Since Amendment D's Q-1 no leg enters at an unresolved tier, so none is ever named.
    expect(idea.entry.unknownCostTierLegs).toEqual([]);
    expect(row.unknownCostTierLegs).toEqual([]);
  });

  it('Q-1 — a leg whose cost tier cannot be resolved (a stock with NO market cap on the snapshot) is not eligible: the basket waits, neither side buys, and the timeout names the leg `cost_tier_unknown`', async () => {
    // The idea's own name, with a same-stock comparison.
    const one = await seedBook();
    const a = await admitIdea(one.db, { bookId: one.bookId, contract: contractOf({ names: ['AAPL'] }), opId: 'idea-1', nowIso: ADMIT_ISO });
    const noCap = { AAPL: { price: PX.AAPL, marketCap: null }, SPY: PX.SPY };
    const tryAt = (ctx, ideaId, slot, quotes) => enterIdeaWith(ctx.db, { bookRef: ctx.bookRef, ideaId, tick: tickOf(DAYS.d1, slot), snapshot: tickSnapshot(DAYS.d1, slot, quotes), nowIso: nowAt(DAYS.d1, slot) });
    expect(await tryAt(one, a.ideaId, 'open30', noCap)).toEqual({ outcome: 'waiting', refusals: [{ symbol: 'AAPL', refusal: 'cost_tier_unknown' }] });
    expect(getIdea(one.db, one.bookId, a.ideaId)).toMatchObject({ status: 'accepted', ledger: { cash: 20000, holdings: {} }, comparisonLedger: null, spyLedger: null });
    expect(getBook(one.db, one.bookId).portfolio.positions).toEqual({});
    expect(countDocs(one.db, `mandates/${one.bookId}/decisions/`)).toBe(0);
    // A zero, a negative or a non-number market cap resolves no tier either.
    for (const marketCap of [0, -5, 'big']) {
      expect((await tryAt(one, a.ideaId, 'midday', { AAPL: { price: PX.AAPL, marketCap }, SPY: PX.SPY })).refusals, String(marketCap)).toEqual([{ symbol: 'AAPL', refusal: 'cost_tier_unknown' }]);
    }
    // At the session's last entry slot the failed attempt is the timeout, and it names the leg.
    expect(await tryAt(one, a.ideaId, 'preClose', noCap)).toEqual({ outcome: 'cancelled', reason: 'entry_timeout', refusals: [{ symbol: 'AAPL', refusal: 'cost_tier_unknown' }] });
    const cancelled = getIdea(one.db, one.bookId, a.ideaId);
    expect(cancelled).toMatchObject({ status: 'cancelled', cancelled: { reason: 'entry_timeout', returnedToTreasuryUsd: 20000 } });
    expect(cancelled.lastEntryAttempt.refusals).toEqual([{ symbol: 'AAPL', refusal: 'cost_tier_unknown' }]);
    expect(getBook(one.db, one.bookId).treasury.unreservedCash).toBe(100000);

    // A frozen-basket MEMBER with no market cap holds the whole basket back too (the comparison pays the same policy).
    const two = await seedBook({ uid: 'owner-2' });
    const b = await admitIdea(two.db, { bookId: two.bookId, contract: contractOf({ names: ['AAPL'], comparison: { type: 'frozen_basket', symbols: ['NVDA', 'AMD'] } }), opId: 'idea-1', nowIso: ADMIT_ISO });
    expect(await tryAt(two, b.ideaId, 'open30', { ...q('AAPL', 'NVDA', 'SPY'), AMD: { price: PX.AMD, marketCap: null } }))
      .toEqual({ outcome: 'waiting', refusals: [{ symbol: 'AMD', refusal: 'cost_tier_unknown' }] });
    // EVERY leg with no tier is named, not only the first.
    expect((await tryAt(two, b.ideaId, 'open30', { AAPL: { price: PX.AAPL, marketCap: null }, NVDA: { price: PX.NVDA, marketCap: null }, AMD: { price: PX.AMD, marketCap: CAP.AMD }, SPY: PX.SPY })).refusals)
      .toEqual([{ symbol: 'AAPL', refusal: 'cost_tier_unknown' }, { symbol: 'NVDA', refusal: 'cost_tier_unknown' }]);
    // A fund never has a market cap and never needs one: its tier is explicit. With every stock's cap present, it fills.
    expect((await tryAt(two, b.ideaId, 'midday', q('AAPL', 'NVDA', 'AMD', 'SPY'))).outcome).toBe('entered');
  });

  it('a record written before Q-1 that names a leg at the unknown tier still says so on every later row: `entryCostTiersKnown` is false', async () => {
    const { db, bookId, bookRef } = await seedBook();
    const r = await admitAndEnter(db, bookId, { contract: contractOf({ names: ['AAPL'] }), quotes: q('AAPL', 'SPY') });
    await closeOn(db, bookId, DAYS.d1, { AAPL: PX.AAPL, SPY: PX.SPY });
    expect(db._get(`mandates/${bookId}/ideas/${r.ideaId}/rows/${DAYS.d1}`).entryCostTiersKnown).toBe(true);
    // A T1a-1 idea: its entry recorded a leg that paid the widest tier for want of a market cap.
    const ideaRef = bookRef.collection('ideas').doc(r.ideaId);
    const idea = (await ideaRef.get()).data();
    await ideaRef.set({ ...idea, entry: { ...idea.entry, unknownCostTierLegs: [{ ledger: 'idea', symbol: 'AAPL' }] } });
    await closeOn(db, bookId, DAYS.d2, { AAPL: PX.AAPL, SPY: PX.SPY });
    expect(db._get(`mandates/${bookId}/ideas/${r.ideaId}/rows/${DAYS.d2}`)).toMatchObject({ entryCostTiersKnown: false, fullQuality: true });
  });

  it('each side pays its OWN tier and every row says the tiers are known: a small-cap name against its sector fund shows the cost difference as a gap', async () => {
    const { db, bookId } = await seedBook();
    // The idea's name is a small cap on the entry snapshot (20 bps); its sector fund pays the fund tier (3 bps).
    const r = await admitAndEnter(db, bookId, { contract: contractOf({ names: ['AAPL'], comparison: { type: 'sector_fund', symbols: ['XLK'] } }), quotes: { AAPL: PX.AAPL, SPY: PX.SPY, XLK: PX.XLK } });
    expect(getIdea(db, bookId, r.ideaId).entry.unknownCostTierLegs).toEqual([]);
    await closeOn(db, bookId, DAYS.d1, { AAPL: PX.AAPL, SPY: PX.SPY, XLK: PX.XLK });
    const row = db._get(`mandates/${bookId}/ideas/${r.ideaId}/rows/${DAYS.d1}`);
    expect(row.markedGapUsd).toBeLessThan(-30); // closed at the entry prices: the whole gap is the cost difference
    expect(row).toMatchObject({ entryCostTiersKnown: true, fullQuality: true });
    // With the market cap present the same idea shows no gap and says so.
    const ok = await seedBook({ uid: 'owner-2' });
    const r2 = await admitAndEnter(ok.db, ok.bookId, { contract: contractOf({ names: ['AAPL'], comparison: { type: 'sector_fund', symbols: ['XLK'] } }), quotes: q('AAPL', 'SPY', 'XLK') });
    await closeOn(ok.db, ok.bookId, DAYS.d1, { AAPL: PX.AAPL, SPY: PX.SPY, XLK: PX.XLK });
    expect(ok.db._get(`mandates/${ok.bookId}/ideas/${r2.ideaId}/rows/${DAYS.d1}`)).toMatchObject({ entryCostTiersKnown: true, markedGapUsd: 0 });
  });
});

describe('B-FILL and all-or-nothing', () => {
  const admitOne = async (contract) => {
    const { db, bookId, bookRef } = await seedBook();
    const a = await admitIdea(db, { bookId, contract, opId: 'idea-1', nowIso: ADMIT_ISO });
    return { db, bookId, bookRef, ideaId: a.ideaId };
  };
  const enter = (ctx, date, slot, quotes) => enterIdeaWith(ctx.db, { bookRef: ctx.bookRef, ideaId: ctx.ideaId, tick: tickOf(date, slot), snapshot: tickSnapshot(date, slot, quotes), nowIso: nowAt(date, slot) });

  it('one leg without an eligible mark — idea, comparison or SPY — and NEITHER side buys; the idea waits for the next slot', async () => {
    const ctx = await admitOne(contractOf({ names: ['AAPL', 'MSFT'], comparison: { type: 'sector_fund', symbols: ['XLK'] } }));
    const snapshotBefore = JSON.stringify(getBook(ctx.db, ctx.bookId));
    const cases = [
      [{ ...q('AAPL', 'MSFT', 'SPY'), XLK: { price: PX.XLK, at: null } }, [{ symbol: 'XLK', refusal: 'receipt_time_only' }]], // the comparison's leg
      [{ ...q('AAPL', 'MSFT', 'XLK') }, [{ symbol: 'SPY', refusal: 'no_quote' }]], // SPY's leg
      [{ ...q('MSFT', 'SPY', 'XLK'), AAPL: { price: PX.AAPL, at: etIso(DAYS.admit, 15, 59) } }, [{ symbol: 'AAPL', refusal: 'carried_forward' }]], // a carried mark
      [{ ...q('AAPL', 'SPY', 'XLK'), MSFT: { price: PX.MSFT, at: etIso(DAYS.d1, 9, 29) } }, [{ symbol: 'MSFT', refusal: 'outside_session' }]],
    ];
    for (const [quotes, refusals] of cases) {
      const res = await enter(ctx, DAYS.d1, 'open30', quotes);
      expect(res).toEqual({ outcome: 'waiting', refusals });
    }
    expect(JSON.stringify(getBook(ctx.db, ctx.bookId))).toBe(snapshotBefore); // no book mutation, no revision
    const idea = getIdea(ctx.db, ctx.bookId, ctx.ideaId);
    expect(idea).toMatchObject({ status: 'accepted', comparisonLedger: null, spyLedger: null });
    expect(idea.lastEntryAttempt).toMatchObject({ tickKey: `${DAYS.d1}_open30`, slot: 'open30', refusals: [{ symbol: 'MSFT', refusal: 'outside_session' }] });
    expect(countDocs(ctx.db, `mandates/${ctx.bookId}/decisions/`)).toBe(0);
    // The next slot has every mark: it fills there.
    expect((await enter(ctx, DAYS.d1, 'midday', q('AAPL', 'MSFT', 'SPY', 'XLK'))).outcome).toBe('entered');
    expect(getIdea(ctx.db, ctx.bookId, ctx.ideaId).entry.slot).toBe('midday');
  });

  it('B-FILL — a mark observed before the idea\'s admission never fills it, even in the right session', async () => {
    const { db, bookId, bookRef } = await seedBook();
    // Admitted (by a test clock) inside the start session's morning; the quote was observed before that instant.
    const a = await admitIdea(db, { bookId, contract: contractOf(), opId: 'idea-1', nowIso: ADMIT_ISO });
    const ideaRef = bookRef.collection('ideas').doc(a.ideaId);
    await ideaRef.update({ admittedAt: etIso(DAYS.d1, 10, 20) });
    const res = await enterIdeaWith(db, {
      bookRef, ideaId: a.ideaId, tick: tickOf(DAYS.d1, 'midday'), nowIso: nowAt(DAYS.d1, 'midday'),
      snapshot: tickSnapshot(DAYS.d1, 'midday', { AAPL: { price: PX.AAPL, at: etIso(DAYS.d1, 10, 19) }, SPY: PX.SPY }),
    });
    expect(res).toEqual({ outcome: 'waiting', refusals: [{ symbol: 'AAPL', refusal: 'before_decision' }] });
  });

  it('never before its start session; never after it — a missed session is a timeout, not a late entry', async () => {
    const ctx = await admitOne(contractOf());
    // A pass on the admission day itself (a later slot of that Friday): not yet.
    expect(await enter(ctx, DAYS.admit, 'preClose', q('AAPL', 'SPY'))).toEqual({ outcome: 'not_yet' });
    expect(getIdea(ctx.db, ctx.bookId, ctx.ideaId).status).toBe('accepted');
    // Every fire of the start session was missed. The first pass of the NEXT session cancels; it never enters.
    const res = await enter(ctx, DAYS.d2, 'open30', q('AAPL', 'SPY'));
    expect(res).toEqual({ outcome: 'cancelled', reason: 'entry_timeout' });
    const book = getBook(ctx.db, ctx.bookId);
    expect(book).toMatchObject({ treasury: { unreservedCash: 100000 }, slots: { short: null }, openIdeaIds: [], revision: 2 });
    expect(book.portfolio).toMatchObject({ cash: 100000, positions: {} });
    expect(getIdea(ctx.db, ctx.bookId, ctx.ideaId)).toMatchObject({ status: 'cancelled', cancelled: { reason: 'entry_timeout', returnedToTreasuryUsd: 20000 } });
    expect(ctx.db._get('practiceFieldCoverage/current').symbols).toEqual({});
    expect(await enter(ctx, DAYS.d2, 'midday', q('AAPL', 'SPY'))).toEqual({ outcome: 'not_pending' });
  });

  it('at the start session\'s LAST entry slot a failed attempt is the timeout: cancelled, reservation released', async () => {
    const ctx = await admitOne(contractOf());
    expect((await enter(ctx, DAYS.d1, 'open30', q('SPY'))).outcome).toBe('waiting');
    expect((await enter(ctx, DAYS.d1, 'midday', q('SPY'))).outcome).toBe('waiting');
    const last = await enter(ctx, DAYS.d1, 'preClose', q('SPY'));
    expect(last).toEqual({ outcome: 'cancelled', reason: 'entry_timeout', refusals: [{ symbol: 'AAPL', refusal: 'no_quote' }] });
    const idea = getIdea(ctx.db, ctx.bookId, ctx.ideaId);
    expect(idea.status).toBe('cancelled');
    expect(idea.lastEntryAttempt).toMatchObject({ slot: 'preClose', refusals: [{ symbol: 'AAPL', refusal: 'no_quote' }] });
    expect(getBook(ctx.db, ctx.bookId).treasury.unreservedCash).toBe(100000);
  });

  it('a leg the engine itself cannot fill is a failed attempt like a missing mark: neither side buys, the attempt is recorded, and at the last slot it is the timeout (review L1-1)', async () => {
    const ctx = await admitOne(contractOf({ names: ['AAPL', 'MSFT'] }));
    // A price so high that a $10,000 leg cannot buy one millionth of a share: the engine gates the leg.
    const unfillable = { ...q('AAPL', 'SPY'), MSFT: { price: 2e10, marketCap: CAP.MSFT } };
    const bookBefore = JSON.stringify(getBook(ctx.db, ctx.bookId));
    expect(await enter(ctx, DAYS.d1, 'open30', unfillable)).toEqual({ outcome: 'waiting', refusals: [{ symbol: 'MSFT', refusal: 'fill_refused:size_too_small' }] });
    expect(JSON.stringify(getBook(ctx.db, ctx.bookId))).toBe(bookBefore);
    const idea = getIdea(ctx.db, ctx.bookId, ctx.ideaId);
    expect(idea).toMatchObject({ status: 'accepted', comparisonLedger: null, spyLedger: null, ledger: { cash: 20000, holdings: {} } });
    expect(idea.lastEntryAttempt).toMatchObject({ slot: 'open30', refusals: [{ symbol: 'MSFT', refusal: 'fill_refused:size_too_small' }] });
    expect(countDocs(ctx.db, `mandates/${ctx.bookId}/decisions/`)).toBe(0);
    expect((await enter(ctx, DAYS.d1, 'midday', unfillable)).outcome).toBe('waiting');
    expect(await enter(ctx, DAYS.d1, 'preClose', unfillable)).toEqual({ outcome: 'cancelled', reason: 'entry_timeout', refusals: [{ symbol: 'MSFT', refusal: 'fill_refused:size_too_small' }] });
    expect(getBook(ctx.db, ctx.bookId)).toMatchObject({ treasury: { unreservedCash: 100000 }, slots: { short: null }, openIdeaIds: [] });
  });

  it('a failure that is NOT a refused fill still aborts the whole transaction: no ledger, no position, no decision', async () => {
    const ctx = await admitOne(contractOf({ names: ['AAPL', 'MSFT'] }));
    // A stored contract whose line names a symbol the idea does not hold: the fill has no receipt to freeze it at.
    const ideaRef = ctx.bookRef.collection('ideas').doc(ctx.ideaId);
    const idea = (await ideaRef.get()).data();
    await ideaRef.set({ ...idea, contract: { ...idea.contract, lines: [{ symbol: 'NVDA', distancePct: 0.05 }] } });
    const before = moneyStoreBytes(ctx.db);
    await expect(enter(ctx, DAYS.d1, 'open30', q('AAPL', 'MSFT', 'SPY'))).rejects.toThrow(TypeError);
    expect(moneyStoreBytes(ctx.db)).toBe(before);
  });

  it('an entry that keeps FAILING leaves its reason on the idea, so a timeout at the close is explained (refuter RF3-1); a tick with no key is never "the slot\'s own" (RF3-5)', async () => {
    const ctx = await admitOne(contractOf());
    const snapshot = tickSnapshot(DAYS.d1, 'preClose', q('AAPL', 'SPY'));
    const revisionBefore = getIdea(ctx.db, ctx.bookId, ctx.ideaId).revision;
    // Every leg has an eligible mark; the entry transaction itself fails, every fire.
    const failing = { ...ctx.db, runTransaction: async () => { throw Object.assign(new Error('UNAVAILABLE: injected'), { code: 14 }); } };
    const out = await entryPassWith(failing, { bookRef: ctx.bookRef, tick: tickOf(DAYS.d1, 'preClose'), snapshot, now: new Date(nowAt(DAYS.d1, 'preClose')) });
    expect(out).toMatchObject({ served: true, entered: 0, errors: 1 });
    const idea = getIdea(ctx.db, ctx.bookId, ctx.ideaId);
    expect(idea.status).toBe('accepted');
    expect(idea.lastEntryAttempt).toEqual({ tickKey: `${DAYS.d1}_preClose`, slot: 'preClose', at: nowAt(DAYS.d1, 'preClose'), error: 'error' });
    expect(idea.revision).toBe(revisionBefore); // bookkeeping: no revision, no money
    // The record never creates an idea that is not there.
    await ctx.bookRef.set({ openIdeaIds: [ctx.ideaId, 'ghost'] }, { merge: true });
    await entryPassWith(failing, { bookRef: ctx.bookRef, tick: tickOf(DAYS.d1, 'preClose'), snapshot, now: new Date(nowAt(DAYS.d1, 'preClose')) });
    expect(getIdea(ctx.db, ctx.bookId, 'ghost')).toBeUndefined();
    // RF3-5: neither side carrying a key is a mismatch, not a match.
    const { tickKey: _k, ...keyless } = snapshot;
    await expect(enterIdeaWith(ctx.db, { bookRef: ctx.bookRef, ideaId: ctx.ideaId, tick: { date: DAYS.d1, slot: 'preClose' }, snapshot: keyless, nowIso: nowAt(DAYS.d1, 'preClose') })).rejects.toThrow(/entry_snapshot_mismatch/);
  });

  it('FR-A7 — the fill reads THE STORED slot snapshot, by key, inside its transaction: a caller\'s object never reaches a fill; a stored document that is not this slot\'s own is refused (review L3-6)', async () => {
    const ctx = await admitOne(contractOf());
    const call = (slot, snapshot) => enterIdea(ctx.db, { bookRef: ctx.bookRef, ideaId: ctx.ideaId, tick: tickOf(DAYS.d1, slot), snapshot, nowIso: nowAt(DAYS.d1, slot) });
    // (a) NOTHING is stored for the slot. A caller hands a perfectly good snapshot object anyway: it is never read.
    expect(await call('open30', tickSnapshot(DAYS.d1, 'open30', q('AAPL', 'SPY')))).toEqual({
      outcome: 'waiting', refusals: [{ symbol: 'AAPL', refusal: 'no_stored_snapshot' }, { symbol: 'SPY', refusal: 'no_stored_snapshot' }],
    });
    expect(getIdea(ctx.db, ctx.bookId, ctx.ideaId)).toMatchObject({ status: 'accepted', ledger: { cash: 20000, holdings: {} } });
    // (b) The stored document and the caller's object DIFFER: the stored prices fill, the caller's never do.
    placeSnapshot(ctx.db, tickSnapshot(DAYS.d1, 'midday', q('AAPL', 'SPY')));
    const callers = tickSnapshot(DAYS.d1, 'midday', { AAPL: { price: 9.99, marketCap: CAP.AAPL }, SPY: 1.23 });
    expect((await call('midday', callers)).outcome).toBe('entered');
    const idea = getIdea(ctx.db, ctx.bookId, ctx.ideaId);
    expect(idea.ledger.holdings.AAPL.lastMark).toBe(PX.AAPL);
    expect(idea.spyLedger.holdings.SPY.lastMark).toBe(PX.SPY);
    expect(ctx.db._get(`mandates/${ctx.bookId}/ideas/${ctx.ideaId}/rows/inception`).legs.idea[0].mark).toBe(PX.AAPL);

    // (c) A document stored under the slot's key that is not the slot's own — a close snapshot, another slot's,
    //     another session's — is refused, and nothing is written.
    const other = await admitOne(contractOf());
    const wrongDocs = [
      closeSnapshot(DAYS.d1, q('AAPL', 'SPY')), tickSnapshot(DAYS.d1, 'open30', q('AAPL', 'SPY')),
      { ...tickSnapshot(DAYS.d1, 'preClose', q('AAPL', 'SPY')), sessionDate: DAYS.d2 },
    ];
    for (const wrong of wrongDocs) {
      other.db._store.set(`mandateUniverseSnapshots/${DAYS.d1}_preClose`, { data: wrong, version: 1 });
      const before = moneyStoreBytes(other.db);
      await expect(enterIdea(other.db, { bookRef: other.bookRef, ideaId: other.ideaId, tick: tickOf(DAYS.d1, 'preClose'), nowIso: nowAt(DAYS.d1, 'preClose') })).rejects.toThrow(/entry_snapshot_mismatch/);
      expect(moneyStoreBytes(other.db)).toBe(before);
    }
  });

  it('entrySymbols: the names, the comparison\'s symbols and SPY, once each', () => {
    expect(entrySymbols({ names: ['AAPL', 'MSFT'], comparison: { symbols: ['AAPL', 'MSFT'] } })).toEqual(['AAPL', 'MSFT', 'SPY']);
    expect(entrySymbols({ names: ['AAPL'], comparison: { symbols: ['XLK'] } })).toEqual(['AAPL', 'XLK', 'SPY']);
  });

  it('computeBasketEntry is pure: it returns the filled ledgers and leaves the idea it was given untouched', async () => {
    const ctx = await admitOne(contractOf({ names: ['AAPL', 'MSFT'] }));
    const idea = getIdea(ctx.db, ctx.bookId, ctx.ideaId);
    const frozen = JSON.stringify(idea);
    const out = computeBasketEntry({ idea, snapshot: tickSnapshot(DAYS.d1, 'open30', q('AAPL', 'MSFT', 'SPY')), sessionDate: DAYS.d1 });
    expect(JSON.stringify(idea)).toBe(frozen);
    expect(Object.keys(out.ledger.holdings)).toEqual(['AAPL', 'MSFT']);
    expect(out.receipts.idea).toHaveLength(2);
  });
});

describe('runIdeaBookEntryPass — one book, one slot', () => {
  it('enters every due idea, isolates a failing one, and does nothing at a slot that is not an entry slot or for a book that is not active', async () => {
    const { db, bookId, bookRef } = await seedBook({ archetypeCodeId: 'degen' });
    await admitIdea(db, { bookId, contract: contractOf({ slot: 'short', names: ['AAPL'] }), opId: 's', nowIso: ADMIT_ISO });
    await admitIdea(db, { bookId, contract: contractOf({ slot: 'medium', names: ['LLY'], capitalUsd: 30000 }), opId: 'm', nowIso: ADMIT_ISO });
    await admitIdea(db, { bookId, contract: contractOf({ slot: 'long', names: ['JPM', 'XOM'], capitalUsd: 40000 }), opId: 'l', nowIso: ADMIT_ISO });
    const tick = tickOf(DAYS.d1, 'open30');
    const now = new Date(nowAt(DAYS.d1, 'open30'));
    expect(await entryPassWith(db, { bookRef, tick: { ...tick, slot: 'lunch' }, snapshot: null, now })).toEqual({ served: false, entered: 0, waiting: 0, cancelled: 0, errors: 0 });
    // LLY has no quote (waits); XOM's price makes its leg unfillable (waits, the attempt recorded); AAPL enters.
    const snapshot = tickSnapshot(DAYS.d1, 'open30', { ...q('AAPL', 'JPM', 'SPY'), XOM: { price: 3e10, marketCap: CAP.XOM } });
    const out = await entryPassWith(db, { bookRef, tick, snapshot, now });
    expect(out).toEqual({ served: true, entered: 1, waiting: 2, cancelled: 0, errors: 0 });
    const book = getBook(db, bookId);
    expect(Object.keys(book.portfolio.positions)).toEqual(['AAPL']);
    expect(() => assertReconciled(book, openIdeas(db, bookId))).not.toThrow();
    await bookRef.update({ status: 'draining' });
    expect((await entryPassWith(db, { bookRef, tick: tickOf(DAYS.d1, 'midday'), snapshot, now })).served).toBe(false);
  });
});

describe('B-RECON and B-OWNED — the reconciliation that guards every mutation', () => {
  const state = async () => {
    const { db, bookId } = await seedBook({ archetypeCodeId: 'degen' });
    await admitAndEnter(db, bookId, { contract: contractOf({ slot: 'short', names: ['AAPL', 'MSFT'] }), opId: 'a', quotes: q('AAPL', 'MSFT', 'SPY') });
    // 29,000, not 30,000: the first entry's costs took the book's equity a few dollars under 100,000, and with it the 30% cap.
    const second = await admitIdea(db, { bookId, contract: contractOf({ slot: 'medium', names: ['LLY'], capitalUsd: 29000 }), opId: 'b', nowIso: etIso(DAYS.d1, 11, 0) });
    expect(second.ok).toBe(true);
    const book = getBook(db, bookId);
    return { book, ideas: book.openIdeaIds.map((id) => getIdea(db, bookId, id)) };
  };
  const problems = (book, ideas) => {
    try { assertReconciled(book, ideas); return []; } catch (err) {
      if (!isPracticeFieldError(err, 'recon_failed')) throw err;
      return err.detail.problems.map((p) => p.rule).sort();
    }
  };
  const clone = (v) => structuredClone(v);

  it('a consistent book reconciles: treasury + Σ ideas\' cash = portfolio cash; every position is one idea\'s holding', async () => {
    const { book, ideas } = await state();
    const out = assertReconciled(book, ideas);
    expect(out.treasuryCents + out.ideaCashCents).toBe(out.portfolioCashCents);
    expect(out).toMatchObject({ treasuryCents: 5100000, positions: 2 });
  });

  it('one cent off anywhere is caught, by rule', async () => {
    const { book, ideas } = await state();
    let b = clone(book); b.portfolio.cash = Math.round((b.portfolio.cash + 0.01) * 100) / 100;
    expect(problems(b, ideas)).toEqual(['cash_mismatch']);
    // Since Astra T1A-02 the treasury and an idea's cash are also parts of the book's marked equity (rule 7), and an
    // idea's cash is half of its same-stock tie (rule 9): one cent there breaks those rules too.
    b = clone(book); b.treasury.unreservedCash -= 0.01;
    expect(problems(b, ideas)).toEqual(['cash_mismatch', 'equity_mismatch']);
    let i = clone(ideas); i[0].ledger.cash = Math.round((i[0].ledger.cash + 0.01) * 100) / 100;
    expect(problems(book, i)).toEqual(['cash_mismatch', 'comparison_not_tied', 'equity_mismatch', 'ledger_not_conserved']);
    b = clone(book); b.portfolio.positions.AAPL.costBasisTotal = Math.round((b.portfolio.positions.AAPL.costBasisTotal + 0.01) * 100) / 100;
    expect(problems(b, ideas)).toEqual(['basis_mismatch']);
    b = clone(book); b.portfolio.positions.AAPL.shares += 0.000001;
    expect(problems(b, ideas)).toEqual(['shares_mismatch']);
    // A cent of dividends with no receipt for it: not conserved, and (refuter RF-A3) not receipted either.
    i = clone(ideas); i[0].ledger.dividendsUsd = 0.01;
    expect(problems(book, i)).toEqual(['dividends_not_receipted', 'ledger_not_conserved']);
  });

  it('B-OWNED — a position with no idea, with an unknown idea, or that its idea\'s ledger does not hold, is caught', async () => {
    const { book, ideas } = await state();
    let b = clone(book); delete b.portfolio.positions.AAPL.ideaId;
    expect(problems(b, ideas)).toEqual(['position_without_idea']);
    b = clone(book); b.portfolio.positions.AAPL.ideaId = 'idea_nobody';
    expect(problems(b, ideas)).toEqual(['position_idea_missing']);
    b = clone(book); b.portfolio.positions.AAPL.ideaId = ideas[1].ideaId; // the other idea's id: it does not hold AAPL
    expect(problems(b, ideas)).toEqual(['position_not_in_idea_ledger']);
    b = clone(book); b.portfolio.positions.NVDA = { shares: 1, costBasisTotal: 141.29, lastMark: 141.29, ideaId: ideas[0].ideaId };
    expect(problems(b, ideas)).toContain('position_not_in_idea_ledger');
    b = clone(book); delete b.portfolio.positions.MSFT;
    expect(problems(b, ideas)).toEqual(['idea_holding_not_in_book']);
    const i = clone(ideas); i[1].ledger.holdings.AAPL = clone(i[0].ledger.holdings.AAPL);
    expect(problems(book, i)).toContain('ticker_in_two_ideas');
  });

  it('the open set must be exactly the book\'s openIdeaIds, and every occupied slot must name one of them', async () => {
    const { book, ideas } = await state();
    expect(problems(book, [ideas[0]])).toContain('open_idea_set_mismatch');
    const b = clone(book); b.slots.long = 'idea_ghost';
    expect(problems(b, ideas)).toEqual(['slot_names_unknown_idea']);
    const neg = clone(book); neg.treasury.unreservedCash = -1;
    expect(problems(neg, ideas)).toContain('treasury_negative_or_missing');
  });

  it('an open idea must be live, in its own slot, holding exactly what its contract reserved — and every amount a real number (review L1-8)', async () => {
    const { book, ideas } = await state();
    let i = clone(ideas); i[1].status = 'cancelled';
    expect(problems(book, i)).toEqual(['open_idea_not_live']);
    let b = clone(book); b.slots.medium = null;
    expect(problems(b, ideas)).toEqual(['idea_not_in_its_slot']);
    b = clone(book); b.slots.medium = ideas[0].ideaId; // another idea's id in this idea's slot
    expect(problems(b, ideas)).toEqual(['idea_not_in_its_slot']);
    i = clone(ideas); i[1].ledger.reservedCapitalUsd = 28999.99; i[1].ledger.cash = 28999.99;
    expect(problems(book, i)).toEqual(['cash_mismatch', 'equity_mismatch', 'reserved_capital_mismatch']);
    b = clone(book); b.treasury.unreservedCash = NaN;
    expect(problems(b, ideas)).toContain('treasury_negative_or_missing');
    b = clone(book); b.portfolio.cash = NaN;
    expect(problems(b, ideas)).toContain('not_a_number');
    i = clone(ideas); i[0].ledger.cash = NaN;
    expect(problems(book, i)).toContain('not_a_number');
    i = clone(ideas); i[0].ledger.holdings.AAPL.shares = NaN;
    expect(problems(book, i)).toContain('not_a_number');
  });

  it('B-OWNED — a fill for a ticker the book already holds is refused inside the entry transaction', async () => {
    const { db, bookId, bookRef } = await seedBook({ archetypeCodeId: 'degen' });
    const a = await admitIdea(db, { bookId, contract: contractOf({ slot: 'short', names: ['AAPL'] }), opId: 'a', nowIso: ADMIT_ISO });
    // A position planted with no owner — the state B-OWNED forbids. The entry must not build on it.
    const book = getBook(db, bookId);
    await bookRef.update({ 'portfolio.positions': { AAPL: { shares: 1, costBasisTotal: 231.47, lastMark: 231.47 } }, 'portfolio.cash': book.portfolio.cash - 231.47 });
    const before = moneyStoreBytes(db);
    // Since Astra T1A-02 the book is reconciled as read, so the planted position is refused there (an unowned
    // position, and cash the treasury and ideas cannot account for) before any leg is priced. The entry's own
    // `ticker_held_by_other_idea` check stays behind it.
    await expect(enterIdeaWith(db, { bookRef, ideaId: a.ideaId, tick: tickOf(DAYS.d1, 'open30'), snapshot: tickSnapshot(DAYS.d1, 'open30', q('AAPL', 'SPY')), nowIso: nowAt(DAYS.d1, 'open30') }))
      .rejects.toThrow(/recon_failed.*cash_mismatch.*position_without_idea/);
    expect(moneyStoreBytes(db)).toBe(before);
  });

  it('EVERY mutating transaction reconciles the state it is about to write, and writes nothing when it does not: admission, release, entry, the entry timeout and the close', async () => {
    // A book one cent out: the treasury says a cent more than the portfolio's cash can account for.
    const corrupt = async (bookRef) => {
      const book = (await bookRef.get()).data();
      await bookRef.update({ treasury: { unreservedCash: Math.round((book.treasury.unreservedCash + 0.01) * 100) / 100 } });
    };
    const refused = async (db, run) => {
      const before = moneyStoreBytes(db);
      let err = null;
      try { await run(); } catch (e) { err = e; }
      expect(isPracticeFieldError(err, 'recon_failed'), String(err)).toBe(true);
      expect(err.detail.problems.map((p) => p.rule)).toContain('cash_mismatch');
      expect(moneyStoreBytes(db)).toBe(before);
    };

    // Admission and release, on a book with one accepted idea.
    const one = await seedBook({ archetypeCodeId: 'degen' });
    const pending = await admitIdea(one.db, { bookId: one.bookId, contract: contractOf({ slot: 'short', names: ['AAPL'] }), opId: 'a', nowIso: ADMIT_ISO });
    await corrupt(one.bookRef);
    await refused(one.db, () => admitIdea(one.db, { bookId: one.bookId, contract: contractOf({ slot: 'medium', names: ['LLY'], capitalUsd: 25000 }), opId: 'b', nowIso: ADMIT_ISO }));
    await refused(one.db, () => releaseIdea(one.db, { bookId: one.bookId, ideaId: pending.ideaId, nowIso: ADMIT_ISO }));
    // Entry, and the entry timeout (the pass of a later session).
    await refused(one.db, () => enterIdeaWith(one.db, { bookRef: one.bookRef, ideaId: pending.ideaId, tick: tickOf(DAYS.d1, 'open30'), snapshot: tickSnapshot(DAYS.d1, 'open30', q('AAPL', 'SPY')), nowIso: nowAt(DAYS.d1, 'open30') }));
    await refused(one.db, () => enterIdeaWith(one.db, { bookRef: one.bookRef, ideaId: pending.ideaId, tick: tickOf(DAYS.d2, 'open30'), snapshot: tickSnapshot(DAYS.d2, 'open30', q('AAPL', 'SPY')), nowIso: nowAt(DAYS.d2, 'open30') }));
    // The close, with a timed-out idea (D1) …
    await storeCloseSnapshot(one.db, DAYS.d1, q('AAPL', 'SPY'));
    await refused(one.db, () => closeIdeaBook(one.db, one.bookRef, { date: DAYS.d1, now: new Date(etIso(DAYS.d1, 16, 25)) }));
    // … and with a holding idea.
    const two = await seedBook({ archetypeCodeId: 'degen', uid: 'owner-2' });
    await admitAndEnter(two.db, two.bookId, { contract: contractOf({ names: ['AAPL', 'MSFT'] }), quotes: q('AAPL', 'MSFT', 'SPY') });
    await corrupt(two.bookRef);
    await storeCloseSnapshot(two.db, DAYS.d1, q('AAPL', 'MSFT', 'SPY'));
    await refused(two.db, () => closeIdeaBook(two.db, two.bookRef, { date: DAYS.d1, now: new Date(etIso(DAYS.d1, 16, 25)) }));
  });

  it('B-OWNED — a book that already holds a position with no idea cannot be built on: the next entry is refused whole', async () => {
    const { db, bookId, bookRef } = await seedBook({ archetypeCodeId: 'degen' });
    const a = await admitIdea(db, { bookId, contract: contractOf({ slot: 'short', names: ['AAPL'] }), opId: 'a', nowIso: ADMIT_ISO });
    const book = getBook(db, bookId);
    // An unowned NVDA position, with the cash it would have cost taken out so the cash still balances.
    await bookRef.update({ 'portfolio.positions': { NVDA: { shares: 1, costBasisTotal: 141.29, lastMark: 141.29 } }, 'portfolio.cash': Math.round((book.portfolio.cash - 141.29) * 100) / 100, treasury: { unreservedCash: Math.round((book.treasury.unreservedCash - 141.29) * 100) / 100 } });
    const before = moneyStoreBytes(db);
    let err = null;
    try { await enterIdeaWith(db, { bookRef, ideaId: a.ideaId, tick: tickOf(DAYS.d1, 'open30'), snapshot: tickSnapshot(DAYS.d1, 'open30', q('AAPL', 'SPY')), nowIso: nowAt(DAYS.d1, 'open30') }); } catch (e) { err = e; }
    expect(isPracticeFieldError(err, 'recon_failed')).toBe(true);
    // The equity rule (Astra T1A-02, rule 7) sees it too: the treasury paid for a position no idea holds.
    expect(err.detail.problems.map((p) => p.rule)).toEqual(['position_without_idea', 'equity_mismatch']);
    expect(moneyStoreBytes(db)).toBe(before);
  });
});

describe('Astra T1A-02 — the reconciliation covers the marked book and all three ledgers, and rejects rather than repairs', () => {
  // Astra's fixture: a $20,000 AAPL idea at a $100 mark, normal cost policy.
  const QUOTES = { AAPL: { price: 100, marketCap: 3e12 }, SPY: 500 };
  const problems = (book, ideas) => {
    try { assertReconciled(book, ideas); return []; } catch (err) {
      if (!isPracticeFieldError(err, 'recon_failed')) throw err;
      return err.detail.problems.map((p) => p.rule).sort();
    }
  };
  const clone = (v) => structuredClone(v);
  const refusedWritingNothing = async (db, run, rules) => {
    const before = moneyStoreBytes(db);
    const err = await run().then(() => null, (e) => e);
    expect(isPracticeFieldError(err, 'recon_failed'), String(err)).toBe(true);
    expect(err.detail.problems.map((p) => p.rule).sort()).toEqual([...rules].sort());
    expect(moneyStoreBytes(db)).toBe(before);
  };
  const holding = async (comparison = { type: 'same_stock_held' }, extraQuotes = {}) => {
    const { db, bookId, bookRef } = await seedBook({ archetypeCodeId: 'degen' });
    const r = await admitAndEnter(db, bookId, { contract: contractOf({ comparison }), quotes: { ...QUOTES, ...extraQuotes } });
    expect(r.entry.outcome).toBe('entered');
    return { db, bookId, bookRef, ideaId: r.ideaId, book: getBook(db, bookId), idea: getIdea(db, bookId, r.ideaId) };
  };
  const ideaRefOf = (db, bookId, ideaId) => db.collection('mandates').doc(bookId).collection('ideas').doc(ideaId);
  /** A planted applied receipt carrying `usd` of income — so a planted dividend is receipted and another rule is isolated. */
  const plantedIncome = (usd) => ({ actionId: 'cash_dividend_AAPL_2026-11-17', type: 'cash_dividend', ticker: 'AAPL', effectiveDate: '2026-11-17', applied: true, incomeUsd: usd, appliedOn: '2026-11-17' });

  it('Astra\'s fault A — the book\'s AAPL mark changed from $100 to $200 and its equity set to $120,000: a $30,000 admission is refused recon_failed and writes nothing', async () => {
    const s = await holding();
    expect(s.book.portfolio.positions.AAPL.lastMark).toBe(100);
    await s.bookRef.set({ portfolio: { positions: { AAPL: { lastMark: 200 } }, totalValue: 120000 } }, { merge: true });
    await refusedWritingNothing(s.db, () => admitIdea(s.db, { bookId: s.bookId, contract: contractOf({ slot: 'long', names: ['LLY'], capitalUsd: 30000 }), opId: 'lly', nowIso: etIso(DAYS.d1, 13, 0) }), ['mark_mismatch', 'equity_mismatch']);
  });

  it('reject, never repair — the same fault met by a CLOSE (which re-marks every position and recomputes the equity) is refused as read, not overwritten into a book that passes', async () => {
    const s = await holding();
    await s.bookRef.set({ portfolio: { positions: { AAPL: { lastMark: 200 } }, totalValue: 120000 } }, { merge: true });
    await storeCloseSnapshot(s.db, DAYS.d1, { AAPL: 100.13, SPY: 500 });
    await refusedWritingNothing(s.db, () => closeIdeaBook(s.db, s.bookRef, { date: DAYS.d1, now: new Date(etIso(DAYS.d1, 16, 25)) }), ['mark_mismatch', 'equity_mismatch']);
    expect(s.db._get(`mandates/${s.bookId}/dailyRows/${DAYS.d1}`)).toBeUndefined();
    expect(getBook(s.db, s.bookId).portfolio.positions.AAPL.lastMark).toBe(200); // left as found, for a person to look at
  });

  it('reject, never repair — an equity a cent off is refused by ANOTHER idea\'s entry (which rewrites the equity), by its release and by its entry timeout', async () => {
    const { db, bookId, bookRef } = await seedBook({ archetypeCodeId: 'degen' });
    await admitAndEnter(db, bookId, { contract: contractOf(), opId: 'a', quotes: QUOTES });
    const b = await admitIdea(db, { bookId, contract: contractOf({ slot: 'medium', names: ['LLY'], capitalUsd: 25000 }), opId: 'b', nowIso: ADMIT_ISO });
    expect(b.ok).toBe(true);
    const book = getBook(db, bookId);
    await bookRef.update({ 'portfolio.totalValue': Math.round((book.portfolio.totalValue + 0.01) * 100) / 100 });
    await refusedWritingNothing(db, () => enterIdeaWith(db, { bookRef, ideaId: b.ideaId, tick: tickOf(DAYS.d1, 'midday'), snapshot: tickSnapshot(DAYS.d1, 'midday', q('LLY', 'SPY')), nowIso: nowAt(DAYS.d1, 'midday') }), ['equity_mismatch']);
    await refusedWritingNothing(db, () => releaseIdea(db, { bookId, ideaId: b.ideaId, nowIso: etIso(DAYS.d1, 13, 0) }), ['equity_mismatch']);
    // The entry timeout, by the entry itself, on a book with nothing filled (with a filled idea and an unclosed session
    // the entry is refused `not_this_session` before anything — see sessions.js — and the close times the idea out).
    const other = await seedBook({ uid: 'owner-2', archetypeCodeId: 'degen' });
    const c = await admitIdea(other.db, { bookId: other.bookId, contract: contractOf({ slot: 'medium', names: ['LLY'], capitalUsd: 25000 }), opId: 'c', nowIso: ADMIT_ISO });
    await other.bookRef.update({ 'portfolio.totalValue': 100000.01 });
    await refusedWritingNothing(other.db, () => enterIdeaWith(other.db, { bookRef: other.bookRef, ideaId: c.ideaId, tick: tickOf(DAYS.d2, 'open30'), snapshot: tickSnapshot(DAYS.d2, 'open30', q('LLY', 'SPY')), nowIso: nowAt(DAYS.d2, 'open30') }), ['equity_mismatch']);
  });

  it('nothing moves past an unclosed session (review RH-1): an entry is refused while an earlier session of the book is unclosed, and in a session whose close is already written', async () => {
    const { db, bookId, bookRef } = await seedBook({ archetypeCodeId: 'degen' });
    await admitAndEnter(db, bookId, { contract: contractOf(), opId: 'a', quotes: QUOTES }); // filled on D1; D1 is never closed
    const b = await admitIdea(db, { bookId, contract: contractOf({ slot: 'medium', names: ['LLY'], capitalUsd: 25000 }), opId: 'b', nowIso: etIso(DAYS.d1, 11, 0) });
    expect(b).toMatchObject({ ok: true, startSession: DAYS.d2 });
    const enterB = (date, slot) => enterIdeaWith(db, { bookRef, ideaId: b.ideaId, tick: tickOf(date, slot), snapshot: tickSnapshot(date, slot, { ...QUOTES, LLY: { price: 803.17, marketCap: 7.5e11 } }), nowIso: nowAt(date, slot) });
    // D2's window with D1 unclosed: no entry, nothing recorded on the idea.
    const before = moneyStoreBytes(db);
    expect(await enterB(DAYS.d2, 'open30')).toEqual({ outcome: 'not_this_session', reason: 'earlier_session_unclosed' });
    expect(moneyStoreBytes(db)).toBe(before);
    // D1 closed: the same window enters.
    await closeOn(db, bookId, DAYS.d1, QUOTES);
    expect((await enterB(DAYS.d2, 'open30')).outcome).toBe('entered');
    // …and once D2's own close is written, nothing more is dated in D2.
    const c = await admitIdea(db, { bookId, contract: contractOf({ slot: 'long', names: ['JPM'], capitalUsd: 15000 }), opId: 'c', nowIso: etIso(DAYS.d1, 12, 0) });
    expect(c.ok).toBe(true);
    await storeCloseSnapshot(db, DAYS.d2, { ...QUOTES, LLY: 803.17 });
    // (the close of D2 times the still-pending idea out; a late D2 window can do nothing for it)
    await closeIdeaBook(db, bookRef, { date: DAYS.d2, now: new Date(etIso(DAYS.d2, 16, 25)) });
    expect(getIdea(db, bookId, c.ideaId).status).toBe('cancelled');
    const d = await admitIdea(db, { bookId, contract: contractOf({ slot: 'long', names: ['JPM'], capitalUsd: 15000 }), opId: 'd', nowIso: etIso(DAYS.d1, 12, 30) });
    expect(d.ok).toBe(true);
    expect(await enterIdeaWith(db, { bookRef, ideaId: d.ideaId, tick: tickOf(DAYS.d2, 'preClose'), snapshot: tickSnapshot(DAYS.d2, 'preClose', { ...QUOTES, JPM: { price: 241.37, marketCap: 6.8e11 } }), nowIso: nowAt(DAYS.d2, 'preClose') }))
      .toEqual({ outcome: 'not_this_session', reason: 'session_already_closed' });
  });

  it('reject, never repair — a release would launder an idea whose own ledger does not conserve (the idea leaves the open set, so only the as-read check sees it): refused', async () => {
    const { db, bookId } = await seedBook();
    const a = await admitIdea(db, { bookId, contract: contractOf(), opId: 'a', nowIso: ADMIT_ISO });
    await db.collection('mandates').doc(bookId).collection('ideas').doc(a.ideaId).update({ 'ledger.dividendsUsd': 0.01 });
    await refusedWritingNothing(db, () => releaseIdea(db, { bookId, ideaId: a.ideaId, nowIso: etIso(DAYS.d1, 13, 0) }), ['dividends_not_receipted', 'ledger_not_conserved']);
  });

  it('the entry\'s own one-name-one-idea check is reached by a stored accepted idea whose contract names a ticker another idea holds (no as-read rule reads an accepted idea\'s names): refused, nothing written (review FR-A6)', async () => {
    const { db, bookId, bookRef } = await seedBook({ archetypeCodeId: 'degen' });
    await admitAndEnter(db, bookId, { contract: contractOf(), opId: 'a', quotes: QUOTES }); // holds AAPL
    const b = await admitIdea(db, { bookId, contract: contractOf({ slot: 'medium', names: ['LLY'], capitalUsd: 25000 }), opId: 'b', nowIso: ADMIT_ISO });
    const ref = db.collection('mandates').doc(bookId).collection('ideas').doc(b.ideaId);
    const stored = getIdea(db, bookId, b.ideaId);
    await ref.set({ ...stored, contract: { ...stored.contract, names: ['AAPL'], lines: [{ symbol: 'AAPL', distancePct: 0.1 }], comparison: { ...stored.contract.comparison, symbols: ['AAPL'] } } });
    expect(problems(getBook(db, bookId), getBook(db, bookId).openIdeaIds.map((id) => getIdea(db, bookId, id)))).toEqual([]); // the book as read reconciles
    const before = moneyStoreBytes(db);
    await expect(enterIdeaWith(db, { bookRef, ideaId: b.ideaId, tick: tickOf(DAYS.d1, 'midday'), snapshot: tickSnapshot(DAYS.d1, 'midday', { ...QUOTES, LLY: { price: 803.17, marketCap: 7.5e11 } }), nowIso: nowAt(DAYS.d1, 'midday') }))
      .rejects.toThrow(/ticker_held_by_other_idea/);
    expect(moneyStoreBytes(db)).toBe(before);
  });

  it('the R-19 basis at ENTRY: with two ideas holding, the entry writes the per-idea sum ($99,986.50) — not the whole book rounded once ($99,986.51)', async () => {
    const { db, bookId } = await seedBook({ archetypeCodeId: 'degen' });
    const quotes = { AAPL: { price: 231.47, marketCap: 3e12 }, LLY: { price: 803.17, marketCap: 7.5e11 }, SPY: 597.31 };
    await admitAndEnter(db, bookId, { contract: contractOf({ slot: 'short', names: ['AAPL'], capitalUsd: 20000 }), opId: 'a', quotes });
    await admitAndEnter(db, bookId, { contract: contractOf({ slot: 'medium', names: ['LLY'], capitalUsd: 24995.23 }), opId: 'b', slot: 'midday', quotes });
    const book = getBook(db, bookId);
    const ideas = book.openIdeaIds.map((id) => getIdea(db, bookId, id));
    expect(ideas.map((i) => i.status)).toEqual(['holding', 'holding']);
    // The fixture really separates the two bases.
    const wholeBookCents = Math.round(roundUsd(Object.values(book.portfolio.positions).reduce((s, p) => s + p.shares * p.lastMark, 0) + book.portfolio.cash) * 100);
    expect(wholeBookCents).toBe(9998651);
    expect(markedEquityCents(book.treasury.unreservedCash, ideas).equityCents).toBe(9998650);
    expect(book.portfolio.totalValue).toBe(99986.5);
    expect(problems(book, ideas)).toEqual([]);
  });

  it('Astra\'s fault B — $123.45 added to the comparison\'s cash alone: the close is refused and writes no row (it would have written a −$123.45 gap at full quality)', async () => {
    const s = await holding();
    const idea = clone(s.idea);
    idea.comparisonLedger.cash = Math.round((idea.comparisonLedger.cash + 123.45) * 100) / 100;
    await ideaRefOf(s.db, s.bookId, s.ideaId).set(idea);
    await storeCloseSnapshot(s.db, DAYS.d1, { AAPL: 100, SPY: 500 });
    await refusedWritingNothing(s.db, () => closeIdeaBook(s.db, s.bookRef, { date: DAYS.d1, now: new Date(etIso(DAYS.d1, 16, 25)) }), ['comparison_ledger_not_conserved', 'comparison_not_tied']);
    expect(s.db._get(`mandates/${s.bookId}/ideas/${s.ideaId}/rows/${DAYS.d1}`)).toBeUndefined();
    expect(s.db._get(`mandates/${s.bookId}/dailyRows/${DAYS.d1}`)).toBeUndefined();
  });

  it('rule 7 MARKED — a book mark a millionth of a dollar from its idea\'s is `mark_mismatch` alone; an equity a cent off is `equity_mismatch` alone; a missing equity is both not-a-number and a mismatch', async () => {
    const { book, idea } = await holding();
    let b = clone(book); b.portfolio.positions.AAPL.lastMark += 0.000001;
    expect(problems(b, [idea])).toEqual(['mark_mismatch']);
    b = clone(book); delete b.portfolio.positions.AAPL.lastMark;
    expect(problems(b, [idea])).toEqual(['mark_mismatch']);
    // The idea's own mark moves the equity too, and (review FR-A3) breaks its same-stock comparison's tie.
    let i = clone(idea); i.ledger.holdings.AAPL.lastMark = 100.01;
    expect(problems(book, [i])).toEqual(['comparison_not_tied', 'equity_mismatch', 'mark_mismatch']);
    b = clone(book); b.portfolio.totalValue = Math.round((b.portfolio.totalValue + 0.01) * 100) / 100;
    expect(problems(b, [idea])).toEqual(['equity_mismatch']);
    b = clone(book); delete b.portfolio.totalValue;
    expect(problems(b, [idea])).toEqual(['equity_mismatch', 'not_a_number']);
    // The basis is the one ledger.js states: treasury + Σ ideas' (cash + holdings at their recorded marks, rounded once).
    const holdingsCents = Math.round(idea.ledger.holdings.AAPL.shares * 100 * 100);
    expect(cents(book.portfolio.totalValue)).toBe(cents(book.treasury.unreservedCash) + cents(idea.ledger.cash) + holdingsCents);
    expect(cents(book.portfolio.totalValue)).toBe(markedEquityCents(book.treasury.unreservedCash, [idea]).equityCents);
    expect(problems(book, [idea])).toEqual([]);
  });

  it('rule 8 CONSERVED — the comparison ledger and the SPY ledger each conserve, on their own, with the idea\'s capital and real amounts', async () => {
    const fund = await holding({ type: 'sector_fund', symbols: ['XLK'] }, { XLK: 233.59 });
    let i = clone(fund.idea); i.comparisonLedger.cash = Math.round((i.comparisonLedger.cash + 0.01) * 100) / 100;
    expect(problems(fund.book, [i])).toEqual(['comparison_ledger_not_conserved']);
    i = clone(fund.idea); i.spyLedger.cash = Math.round((i.spyLedger.cash + 0.01) * 100) / 100;
    expect(problems(fund.book, [i])).toEqual(['spy_ledger_not_conserved']);
    i = clone(fund.idea); i.spyLedger.holdings.SPY.costBasisTotal = Math.round((i.spyLedger.holdings.SPY.costBasisTotal - 0.01) * 100) / 100;
    expect(problems(fund.book, [i])).toEqual(['spy_ledger_not_conserved']);
    i = clone(fund.idea); i.spyLedger.reservedCapitalUsd = 19999.99; i.spyLedger.holdings.SPY.costBasisTotal = Math.round((i.spyLedger.holdings.SPY.costBasisTotal - 0.01) * 100) / 100;
    expect(problems(fund.book, [i])).toEqual(['spy_capital_mismatch']); // conserved, but not the idea's capital
    i = clone(fund.idea); i.comparisonLedger.dividendsUsd = NaN;
    expect(problems(fund.book, [i])).toContain('not_a_number');
    i = clone(fund.idea); i.comparisonLedger.realizedPnlUsd = '0';
    expect(problems(fund.book, [i])).toContain('not_a_number');
    i = clone(fund.idea); i.comparisonLedger.holdings.XLK.shares = NaN;
    expect(problems(fund.book, [i])).toContain('not_a_number');
    i = clone(fund.idea); i.comparisonLedger.holdings.XLK.shares = 0;
    expect(problems(fund.book, [i])).toEqual(['comparison_holding_not_positive']);
    // Every paper holding's mark is a real number (review FR-A3).
    for (const bad of [NaN, null, undefined, '233.59']) {
      i = clone(fund.idea); i.spyLedger.holdings.SPY.lastMark = bad;
      expect(problems(fund.book, [i]), String(bad)).toEqual(['not_a_number']);
    }
    i = clone(fund.idea); i.spyLedger = null;
    expect(problems(fund.book, [i])).toEqual(['spy_ledger_missing']);
    i = clone(fund.idea); delete i.comparisonLedger;
    expect(problems(fund.book, [i])).toEqual(['comparison_ledger_missing']);
    // A same-stock comparison's dividends alone: the tie (cash, names, quantities, basis) holds; conservation does not.
    const same = await holding();
    // (The cent comes with a receipt for it, so that conservation alone is what breaks.)
    i = clone(same.idea); i.comparisonLedger.dividendsUsd = 0.01; i.comparisonLedger.corporateActionReceipts = [plantedIncome(0.01)];
    expect(problems(same.book, [i])).toEqual(['comparison_ledger_not_conserved']);
    // Refuter RF-A3 — the two amounts conservation adds are accounted for, on every ledger: a cent in cash AND in
    // dividends conserves, but no receipt carries that income; a cent in cash AND in realised P&L conserves, but this
    // build has no sale.
    for (const [ledgerOf, prefix] of [[(x) => x.ledger, ''], [(x) => x.comparisonLedger, 'comparison_'], [(x) => x.spyLedger, 'spy_']]) {
      i = clone(fund.idea); let l = ledgerOf(i);
      l.cash = Math.round((l.cash + 123.45) * 100) / 100; l.dividendsUsd = 123.45;
      const extra = prefix === '' ? ['cash_mismatch', 'equity_mismatch'] : []; // the idea's own cash is also the book's
      expect(problems(fund.book, [i]), `${prefix}dividends`).toEqual([...extra, `${prefix}dividends_not_receipted`].sort());
      i = clone(fund.idea); l = ledgerOf(i);
      l.cash = Math.round((l.cash + 123.45) * 100) / 100; l.realizedPnlUsd = 123.45;
      expect(problems(fund.book, [i]), `${prefix}realized`).toEqual([...extra, `${prefix}realized_pnl_not_receipted`].sort());
    }
    // An accepted idea has neither paper ledger yet, and needs none.
    const { db, bookId } = await seedBook();
    const a = await admitIdea(db, { bookId, contract: contractOf(), opId: 'p', nowIso: ADMIT_ISO });
    expect(getIdea(db, bookId, a.ideaId)).toMatchObject({ status: 'accepted', comparisonLedger: null, spyLedger: null });
    expect(problems(getBook(db, bookId), [getIdea(db, bookId, a.ideaId)])).toEqual([]);
  });

  it('rule 9 TIED — a same-stock comparison equals its idea in cash, names, quantities and basis while the idea has made no fill after entry; the count is written at entry and fails closed', async () => {
    const s = await holding();
    expect(s.idea.postEntryFillCount).toBe(0);
    // Cash and dividends moved together: conserved, but no longer tied.
    // (Each fault below that moves the comparison's dividends carries a receipt for them, so the tie alone breaks.)
    let i = clone(s.idea);
    i.comparisonLedger.cash = Math.round((i.comparisonLedger.cash + 0.01) * 100) / 100; i.comparisonLedger.dividendsUsd = 0.01; i.comparisonLedger.corporateActionReceipts = [plantedIncome(0.01)];
    expect(problems(s.book, [i])).toEqual(['comparison_not_tied']);
    // A millionth of a share more on the comparison: conserved (basis unchanged); not tied.
    i = clone(s.idea); i.comparisonLedger.holdings.AAPL.shares += 0.000001;
    expect(problems(s.book, [i])).toEqual(['comparison_not_tied']);
    // A cent more basis on the comparison, with a cent of dividends to account for it: conserved; not tied.
    i = clone(s.idea);
    i.comparisonLedger.holdings.AAPL.costBasisTotal = Math.round((i.comparisonLedger.holdings.AAPL.costBasisTotal + 0.01) * 100) / 100;
    i.comparisonLedger.dividendsUsd = 0.01; i.comparisonLedger.corporateActionReceipts = [plantedIncome(0.01)];
    expect(problems(s.book, [i])).toEqual(['comparison_not_tied']);
    // The recorded mark is part of the tie (review FR-A3): a comparison mark of $200 against the idea's $100.
    i = clone(s.idea); i.comparisonLedger.holdings.AAPL.lastMark = 200;
    expect(problems(s.book, [i])).toEqual(['comparison_not_tied']);
    // This build has no fill after entry, so no count but 0 is possible: a count of 1 cannot switch the tie off
    // (review FR-A3 — Astra's fault B, with the count raised, would otherwise pass in silence).
    i = clone(s.idea); i.postEntryFillCount = 1;
    i.comparisonLedger.cash = Math.round((i.comparisonLedger.cash + 123.45) * 100) / 100; i.comparisonLedger.dividendsUsd = 123.45; i.comparisonLedger.corporateActionReceipts = [plantedIncome(123.45)];
    expect(problems(s.book, [i])).toEqual(['post_entry_fill_count_invalid']);
    // A count that is not 0 never switches the tie off.
    for (const bad of [undefined, null, -1, 0.5, '0', NaN, 1, 2]) {
      i = clone(s.idea); i.postEntryFillCount = bad;
      expect(problems(s.book, [i]), String(bad)).toEqual(['post_entry_fill_count_invalid']);
    }
    // A sector-fund comparison is not tied to anything, and its count is still written.
    const fund = await holding({ type: 'sector_fund', symbols: ['XLK'] }, { XLK: 233.59 });
    expect(fund.idea.postEntryFillCount).toBe(0);
    expect(problems(fund.book, [fund.idea])).toEqual([]);
  });
});
