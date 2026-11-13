// api/_utils/practiceField/entry.test.js
//
// Practice Field T1a-1 — BASKET ENTRY, BY CODE, MATCHED ON BOTH SIDES (build prompt §6; shared contract V2 §14
// cases B-ENTER, B-FILL, B-RECON; Amendment C §7 cases B-NOFILL, B-OWNED), and the reconciliation itself.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { enterIdea, runIdeaBookEntryPass, computeBasketEntry, entrySymbols, entryDecisionId } from './entry.js';
import { admitIdea } from './admission.js';
import { assertReconciled } from './reconcile.js';
import { isPracticeFieldError } from './errors.js';
import { setPracticeFieldModeForTests } from './mode.js';
import { ideaEntrySlots, isLastIdeaEntrySlot, ideaEntryNotBefore, ideaSchedule, nextSessionDate, sessionAfter } from './windows.js';
import { SLOT_NAMES } from '../mandateSessionSlots.js';
import {
  seedBook, admitAndEnter, contractOf, getBook, getIdea, tickOf, tickSnapshot, slotOpenIso, etIso, DAYS, ADMIT_ISO, countDocs,
} from './__testsupport__/fixtures.js';

const CAP = { AAPL: 3.4e12, MSFT: 3.1e12, NVDA: 3.5e12, AMD: 2.6e11, LLY: 7.5e11, JPM: 6.8e11, XOM: 5.2e11, AVGO: 8.2e11 };
const PX = { AAPL: 231.47, MSFT: 418.13, NVDA: 141.29, AMD: 139.83, LLY: 803.17, JPM: 241.37, XOM: 118.53, AVGO: 172.91, SPY: 597.31, XLK: 233.59, XLV: 147.23 };
const q = (...syms) => Object.fromEntries(syms.map((s) => [s, CAP[s] ? { price: PX[s], marketCap: CAP[s] } : PX[s]]));
const cents = (n) => Math.round(n * 100);
const openIdeas = (db, bookId) => getBook(db, bookId).openIdeaIds.map((id) => getIdea(db, bookId, id));
const nowAt = (date, slot) => new Date(Date.parse(slotOpenIso(date, slot)) + 2 * 60_000).toISOString();

let restoreMode;
beforeEach(() => { restoreMode = setPracticeFieldModeForTests('on'); });
afterEach(() => restoreMode());

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
    expect(idea.entry).toEqual({ sessionDate: DAYS.d1, slot: 'open30', snapshotKey: `${DAYS.d1}_open30`, filledAt: nowAt(DAYS.d1, 'open30'), startMarkAt: etIso(DAYS.d1, 9, 45) });

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

  it('SPY is a third ledger built the same way; an unknown market cap prices a STOCK at the widest tier', async () => {
    const { db, bookId } = await seedBook();
    const r = await admitAndEnter(db, bookId, { contract: contractOf({ names: ['AAPL'] }), quotes: { AAPL: PX.AAPL, SPY: PX.SPY } }); // no market cap on AAPL
    const idea = getIdea(db, bookId, r.ideaId);
    const execPrice = PX.SPY * (1 + 3 / 10000);
    expect(idea.spyLedger.holdings.SPY).toMatchObject({ shares: Math.floor((20000 / execPrice) * 1e6) / 1e6, sector: 'broad_market' });
    const row = db._get(`mandates/${bookId}/ideas/${r.ideaId}/rows/inception`);
    expect(row.legs.idea[0].friction).toMatchObject({ slippageBps: 5, spreadProxyBps: 15, capTier: 'unknown' });
    expect(row.legs.spy[0].friction.capTier).toBe('fund:liquid_fund');
  });
});

describe('B-FILL and all-or-nothing', () => {
  const admitOne = async (contract) => {
    const { db, bookId, bookRef } = await seedBook();
    const a = await admitIdea(db, { bookId, contract, opId: 'idea-1', nowIso: ADMIT_ISO });
    return { db, bookId, bookRef, ideaId: a.ideaId };
  };
  const enter = (ctx, date, slot, quotes) => enterIdea(ctx.db, { bookRef: ctx.bookRef, ideaId: ctx.ideaId, tick: tickOf(date, slot), snapshot: tickSnapshot(date, slot, quotes), nowIso: nowAt(date, slot) });

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
    const res = await enterIdea(db, {
      bookRef, ideaId: a.ideaId, tick: tickOf(DAYS.d1, 'midday'), nowIso: nowAt(DAYS.d1, 'midday'),
      snapshot: tickSnapshot(DAYS.d1, 'midday', { AAPL: { price: PX.AAPL, at: etIso(DAYS.d1, 10, 19) }, SPY: { price: PX.SPY, at: etIso(DAYS.d1, 10, 21) } }),
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

  it('an invariant failure inside the fill aborts the whole transaction: no ledger, no position, no decision', async () => {
    const ctx = await admitOne(contractOf({ names: ['AAPL', 'MSFT'] }));
    // A price so high that a $10,000 leg cannot buy one millionth of a share: the engine gates the leg.
    const before = JSON.stringify([...ctx.db._store.entries()]);
    await expect(enter(ctx, DAYS.d1, 'open30', { ...q('AAPL', 'SPY'), MSFT: { price: 2e10, marketCap: CAP.MSFT } })).rejects.toThrow(/fill_refused/);
    expect(JSON.stringify([...ctx.db._store.entries()])).toBe(before);
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
    expect(await runIdeaBookEntryPass(db, { bookRef, tick: { ...tick, slot: 'lunch' }, snapshot: null, now })).toEqual({ served: false, entered: 0, waiting: 0, cancelled: 0, errors: 0 });
    // LLY has no quote (waits); XOM's price makes its leg unfillable (an error, isolated); AAPL enters.
    const snapshot = tickSnapshot(DAYS.d1, 'open30', { ...q('AAPL', 'JPM', 'SPY'), XOM: { price: 3e10, marketCap: CAP.XOM } });
    const out = await runIdeaBookEntryPass(db, { bookRef, tick, snapshot, now });
    expect(out).toEqual({ served: true, entered: 1, waiting: 1, cancelled: 0, errors: 1 });
    const book = getBook(db, bookId);
    expect(Object.keys(book.portfolio.positions)).toEqual(['AAPL']);
    expect(() => assertReconciled(book, openIdeas(db, bookId))).not.toThrow();
    await bookRef.update({ status: 'draining' });
    expect((await runIdeaBookEntryPass(db, { bookRef, tick: tickOf(DAYS.d1, 'midday'), snapshot, now })).served).toBe(false);
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
    b = clone(book); b.treasury.unreservedCash -= 0.01;
    expect(problems(b, ideas)).toEqual(['cash_mismatch']);
    let i = clone(ideas); i[0].ledger.cash = Math.round((i[0].ledger.cash + 0.01) * 100) / 100;
    expect(problems(book, i)).toEqual(['cash_mismatch', 'ledger_not_conserved']);
    b = clone(book); b.portfolio.positions.AAPL.costBasisTotal = Math.round((b.portfolio.positions.AAPL.costBasisTotal + 0.01) * 100) / 100;
    expect(problems(b, ideas)).toEqual(['basis_mismatch']);
    b = clone(book); b.portfolio.positions.AAPL.shares += 0.000001;
    expect(problems(b, ideas)).toEqual(['shares_mismatch']);
    i = clone(ideas); i[0].ledger.dividendsUsd = 0.01;
    expect(problems(book, i)).toEqual(['ledger_not_conserved']);
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

  it('B-OWNED — a fill for a ticker the book already holds is refused inside the entry transaction', async () => {
    const { db, bookId, bookRef } = await seedBook({ archetypeCodeId: 'degen' });
    const a = await admitIdea(db, { bookId, contract: contractOf({ slot: 'short', names: ['AAPL'] }), opId: 'a', nowIso: ADMIT_ISO });
    // A position planted with no owner — the state B-OWNED forbids. The entry must not build on it.
    const book = getBook(db, bookId);
    await bookRef.update({ 'portfolio.positions': { AAPL: { shares: 1, costBasisTotal: 231.47, lastMark: 231.47 } }, 'portfolio.cash': book.portfolio.cash - 231.47 });
    const before = JSON.stringify([...db._store.entries()]);
    await expect(enterIdea(db, { bookRef, ideaId: a.ideaId, tick: tickOf(DAYS.d1, 'open30'), snapshot: tickSnapshot(DAYS.d1, 'open30', q('AAPL', 'SPY')), nowIso: nowAt(DAYS.d1, 'open30') }))
      .rejects.toThrow(/ticker_held_by_other_idea|recon_failed/);
    expect(JSON.stringify([...db._store.entries()])).toBe(before);
  });
});
