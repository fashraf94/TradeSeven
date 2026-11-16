// api/_utils/practiceField/results.test.js
//
// Practice Field T1a-2a — THE RESULT, FIVE COLUMNS (shared contract V2 §4.4; Amendment E6, E10, E15, E16; build prompt
// §6; acceptance cases B-RESULT (10) and B-BAND (11)). Written once, at the endpoint, on the idea document; computed
// from the endpoint row's own rounded figures.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildEndpoint, ledgerEndpoint, foldCloseIntoTrack, newTrack, exitTierOf, ENDPOINT_KIND } from './settlement.js';
import { valueLedger } from './ledger.js';
import { assertReconciled } from './reconcile.js';
import { setPracticeFieldModeForTests } from './mode.js';
import { roundUsd } from '../mandateRounding.js';
import {
  seedBook, admitAndEnter, closeOn, windowAt, contractOf, getBook, getIdea, getRow, closeSnapshot, closeNowOf, etIso,
  takeSeededDbs, saleWordsOnMarkRows, bannedWordsOnResults, BANNED_RESULT_WORDS, countResults,
} from './__testsupport__/fixtures.js';

const S = ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-27', '2026-11-30', '2026-12-01', '2026-12-02'];
const DUE = S[10];
const BASE = { AAPL: 231.47, MSFT: 418.13, NVDA: 141.29, SPY: 597.31, XLK: 233.59 };
const CAPS = { AAPL: 3.4e12, MSFT: 3.1e12, NVDA: 3.5e12 };
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
const endpointRowOf = (ctx) => ctx.db._get(`mandates/${ctx.bookId}/ideas/${ctx.ideaId}/rows/endpoint`);
const recon = (ctx) => { const book = getBook(ctx.db, ctx.bookId); return assertReconciled(book, book.openIdeaIds.map((id) => getIdea(ctx.db, ctx.bookId, id))); };
const closeDay = async (ctx, date, over = {}) => { const out = await closeOn(ctx.db, ctx.bookId, date, quotes(over)); recon(ctx); return out; };
const win = async (ctx, date, slot = 'open30', over = {}) => { const out = await windowAt(ctx.db, ctx.bookId, { date, slot, quotes: quotes(over) }); recon(ctx); return out; };
async function setup(contract = {}) {
  const { db, bookId, bookRef } = await seedBook();
  const r = await admitAndEnter(db, bookId, { contract: contractOf({ names: ['AAPL'], ...contract }), quotes: quotes(), date: S[0] });
  return { db, bookId, bookRef, ideaId: r.ideaId };
}
/** A holding idea on the eve of its due session (ten closes at BASE prices), with what buildEndpoint needs for the due close. */
async function onTheEve(contract = {}) {
  const ctx = await setup(contract);
  for (let i = 0; i <= 9; i += 1) await closeDay(ctx, S[i]);
  const idea = ideaOf(ctx);
  const snapshot = closeSnapshot(DUE, quotes());
  const valuations = (i) => ({
    idea: valueLedger(i.ledger, snapshot, { sessionDate: DUE }), comparison: valueLedger(i.comparisonLedger, snapshot, { sessionDate: DUE }), spy: valueLedger(i.spyLedger, snapshot, { sessionDate: DUE }),
  });
  /** The result the due close would write if the idea's cash were `extraUsd` higher (same holdings, same marks). */
  const resultWith = (extraUsd) => {
    const tilted = { ...idea, ledger: { ...idea.ledger, cash: roundUsd(idea.ledger.cash + extraUsd) } };
    return buildEndpoint({ idea: tilted, valuations: valuations(tilted), date: DUE, kind: ENDPOINT_KIND.DUE_SESSION, observed: true, snapshotMeta: { key: `${DUE}_close`, builtAt: null }, nowIso: closeNowOf(DUE).toISOString() });
  };
  return { ctx, idea, resultWith };
}

let restoreMode;
const scanned = { results: 0 };
beforeEach(() => { restoreMode = setPracticeFieldModeForTests('on'); takeSeededDbs(); });
afterEach(() => {
  restoreMode();
  for (const db of takeSeededDbs()) {
    expect(saleWordsOnMarkRows(db)).toEqual([]);
    expect(bannedWordsOnResults(db)).toEqual([]);
    scanned.results += countResults(db);
  }
});

describe('B-BAND (B4) — the no-difference band is 0.25% of the idea\'s own reserved capital', () => {
  it('a $20,000 idea with a $40 gap reads within_band; the same $40 on a $10,000 idea reads ahead (Astra\'s pair)', async () => {
    const big = await onTheEve({ capitalUsd: 20000 });
    expect(big.idea.contract.band).toEqual({ shareOfReserved: 0.0025, usd: 50 });
    const a = big.resultWith(40);
    expect(a.endpointRow.gapUsd).toBe(40); // a same-stock comparison: the whole gap is the planted cash
    expect(a.result).toMatchObject({ economicResult: 'within_band', economic: { gapUsd: 40, bandUsd: 50, gapPctOfReserved: 0.2 } });
    const small = await onTheEve({ capitalUsd: 10000 });
    expect(small.idea.contract.band).toEqual({ shareOfReserved: 0.0025, usd: 25 });
    const b = small.resultWith(40);
    expect(b.endpointRow.gapUsd).toBe(40);
    expect(b.result).toMatchObject({ economicResult: 'ahead', economic: { gapUsd: 40, bandUsd: 25, gapPctOfReserved: 0.4 } });
    expect(small.resultWith(-40).result.economicResult).toBe('behind');
  });

  it('the band is inclusive on both sides, to the cent: ±$50.00 is within_band; $50.01 is ahead; −$50.01 is behind', async () => {
    const { resultWith } = await onTheEve({ capitalUsd: 20000 });
    const label = (usd) => resultWith(usd).result.economicResult;
    expect([0, 49.99, 50, -49.99, -50].map(label)).toEqual(['within_band', 'within_band', 'within_band', 'within_band', 'within_band']);
    expect([50.01, 51, 4000].map(label)).toEqual(['ahead', 'ahead', 'ahead']);
    expect([-50.01, -51, -4000].map(label)).toEqual(['behind', 'behind', 'behind']);
    // The gap is computed from the ROUNDED, displayed values; the raw ones sit beside it.
    const out = resultWith(50.01);
    expect(cents(out.result.economic.gapUsd)).toBe(cents(out.result.economic.ideaValueUsd) - cents(out.result.economic.comparisonValueUsd));
    expect(out.result.economic.raw.gapUsd).toBeCloseTo(50.01, 6);
  });
});

describe('BUILD_RULES §9 — the label is decided from the figures the result shows', () => {
  it('the gap is the difference of the two ROUNDED values, never a rounding of the raw difference', () => {
    // Two one-holding ledgers at a zero-cost tier whose raw values are 100.004 and 99.996: both display 100.00.
    const free = { capTier: 'test_free', slippageBps: 0, spreadProxyBps: 0 };
    const ledgerAt = (kind) => ({ kind, reservedCapitalUsd: 100, cash: 0, holdings: { AAPL: { shares: 1, costBasisTotal: 100, avgCost: 100, lastMark: 100, openedAt: S[0], costTier: free } }, costsPaidUsd: 0, dividendsUsd: 0, realizedPnlUsd: 0, appliedActionIds: [], declinedActionIds: [], corporateActionReceipts: [], saleReceipts: [] });
    const valuationAt = (mark) => ({ marks: { AAPL: { mark, shares: 1, quality: 'vendor_time', markSource: 'snapshot', vendorTimeIso: null } } });
    const idea = {
      ideaId: 'i', bookId: 'b', contract: { capitalUsd: 100, band: { usd: 0, shareOfReserved: 0 }, comparison: { type: 'frozen_basket' }, schedule: { dueSession: DUE } },
      ledger: ledgerAt('idea'), comparisonLedger: ledgerAt('comparison'), spyLedger: ledgerAt('spy'), lines: [], entry: { legCount: 1, costsPaidUsd: 0 },
    };
    const out = buildEndpoint({
      idea, valuations: { idea: valuationAt(100.004), comparison: valuationAt(99.996), spy: valuationAt(100) },
      date: DUE, kind: ENDPOINT_KIND.DUE_SESSION, observed: true, snapshotMeta: { key: `${DUE}_close`, builtAt: null }, nowIso: closeNowOf(DUE).toISOString(),
    });
    expect(out.endpointRow.idea.valueUsd).toBe(100);
    expect(out.endpointRow.comparison.valueUsd).toBe(100);
    expect(out.endpointRow.gapUsd).toBe(0); // 100.00 − 100.00, not round(0.008)
    expect(out.result.economic.gapUsd).toBe(0);
    expect(out.result.economicResult).toBe('within_band'); // a zero band: any gap at all would read ahead
    expect(out.endpointRow.raw.gapUsd).toBeCloseTo(0.008, 9); // the raw difference sits beside
  });
});

describe('BUILD_RULES §9, continued — a ledger\'s endpoint value is the sum of its displayed parts', () => {
  it('three holdings whose net proceeds each round DOWN: the value is cash + the three rounded figures, never a rounding of the raw total', () => {
    const free = { capTier: 'test_free', slippageBps: 0, spreadProxyBps: 0 };
    const holding = (mark) => ({ shares: 1, costBasisTotal: 10, avgCost: 10, lastMark: mark, openedAt: S[0], costTier: free });
    const ledger = { kind: 'idea', reservedCapitalUsd: 30, cash: 0.5, holdings: { AAPL: holding(10.004), MSFT: holding(10.004), NVDA: holding(10.004) }, corporateActionReceipts: [], saleReceipts: [] };
    const mark = (m) => ({ mark: m, shares: 1, quality: 'vendor_time', markSource: 'snapshot', vendorTimeIso: null });
    const side = ledgerEndpoint(ledger, { marks: { AAPL: mark(10.004), MSFT: mark(10.004), NVDA: mark(10.004) } });
    // Each holding displays 10.00; the raw total is 30.512, which would round to 30.51.
    expect(Object.values(side.holdings).map((h) => h.netOfModelledCostUsd)).toEqual([10, 10, 10]);
    expect(side).toMatchObject({ cashUsd: 0.5, holdingsAtMarksUsd: 30, modelledExitCostUsd: 0, holdingsNetUsd: 30, valueUsd: 30.5, valueCents: 3050 });
    expect(side.rawValue).toBeCloseTo(30.512, 9);
  });
});

describe('B-RESULT — a breach and an economic result coexist', () => {
  it('an idea that breached a line and finished ahead carries contractCondition breached AND economicResult ahead, both', async () => {
    const ctx = await setup({ names: ['AAPL', 'MSFT'], comparison: { type: 'sector_fund', symbols: ['XLK'] } });
    await closeDay(ctx, S[0]);
    const level = ideaOf(ctx).lines.find((l) => l.symbol === 'MSFT').level;
    await closeDay(ctx, S[1], { MSFT: roundUsd(level - 0.02) });
    await win(ctx, S[2], 'open30', { MSFT: roundUsd(level - 0.5) });
    for (let i = 2; i <= 9; i += 1) await closeDay(ctx, S[i], { AAPL: roundUsd(BASE.AAPL * (1 + 0.02 * i)) });
    await closeDay(ctx, DUE, { AAPL: 279.83 });
    const { result } = ideaOf(ctx);
    expect(result.contractCondition).toBe('breached');
    expect(result.economicResult).toBe('ahead');
    expect(result.contractDetail.breaches).toEqual([expect.objectContaining({ symbol: 'MSFT', session: S[1], onDueSession: false, recognisedLate: false })]);
    expect(result.economic.gapUsd).toBeGreaterThan(50);
    expect(result.trades).toMatchObject({ entry: { count: 2 }, lineExit: { count: 1 } });
    expect(result.trades.lineExit.costsUsd).toBe(ideaOf(ctx).ledger.saleReceipts[0].frictionPaidUsd);
    expect(result.processQuality).toBe('followed_plan');
  });

  it('contractCondition: breached if any line was recognised; otherwise unobserved if any line went unobserved on any session; otherwise met — with the count', async () => {
    const met = await onTheEve();
    expect(met.resultWith(0).result).toMatchObject({ contractCondition: 'met', contractDetail: { unobservedLineSessionCount: 0 } });
    // One unobserved line-session, no breach.
    const ctx = await setup({ names: ['AAPL', 'MSFT'] });
    await closeDay(ctx, S[0]);
    await closeDay(ctx, S[1], { MSFT: { price: 418.13, at: null } }); // no vendor time: MSFT's line is unobserved for S[1]
    await closeDay(ctx, S[2], { AAPL: undefined, MSFT: undefined }); // both unobserved for S[2]
    for (let i = 3; i <= 10; i += 1) await closeDay(ctx, S[i]);
    expect(ideaOf(ctx).result).toMatchObject({
      contractCondition: 'unobserved',
      contractDetail: { breaches: [], unobservedLineSessions: { MSFT: [S[1], S[2]], AAPL: [S[2]] }, unobservedLineSessionCount: 3 },
      dataQuality: { rows: 11, rowsNotFullQuality: 2, unobservedLineSessions: 3 },
    });
    // A breach outranks an unobserved session.
    const both = await setup({ names: ['AAPL', 'MSFT'] });
    await closeDay(both, S[0], { MSFT: undefined });
    await closeDay(both, S[1], { AAPL: roundUsd(ideaOf(both).lines.find((l) => l.symbol === 'AAPL').level - 0.02) });
    await win(both, S[2]);
    for (let i = 2; i <= 10; i += 1) await closeDay(both, S[i]);
    expect(ideaOf(both).result).toMatchObject({ contractCondition: 'breached', contractDetail: { unobservedLineSessionCount: 1 } });
  });
});

describe('E10 — an economic label needs full-quality endpoint marks', () => {
  const run = async (contract, dueOver) => {
    const ctx = await setup(contract);
    for (let i = 0; i <= 9; i += 1) await closeDay(ctx, S[i]);
    await closeDay(ctx, DUE, dueOver);
    return ctx;
  };

  it('an endpoint mark of the IDEA that is not full quality: unmeasurable (shown as inconclusive), and the endpoint valuation reads blocked', async () => {
    const ctx = await run({ comparison: { type: 'sector_fund', symbols: ['XLK'] } }, { AAPL: { price: 240.11, at: null } });
    expect(ideaOf(ctx).result).toMatchObject({
      economicResult: 'unmeasurable', economic: { unmeasurableBecause: ['idea_mark_not_full_quality'] },
      processQuality: 'blocked', processDetail: { blockedBy: [{ kind: 'endpoint_valuation', session: DUE }] },
    });
    expect(endpointRowOf(ctx).idea).toMatchObject({ fullQuality: false, holdings: { AAPL: { markQuality: 'receipt_time_fallback' } } });
    // The numbers are still written: the label is what is withheld.
    expect(ideaOf(ctx).result.economic.gapUsd).toBe(endpointRowOf(ctx).gapUsd);
  });

  it('an endpoint mark of the COMPARISON that is not full quality: unmeasurable; a pre-open print (Q-3) counts', async () => {
    const missing = await run({ comparison: { type: 'sector_fund', symbols: ['XLK'] } }, { XLK: undefined });
    expect(ideaOf(missing).result).toMatchObject({ economicResult: 'unmeasurable', economic: { unmeasurableBecause: ['comparison_mark_not_full_quality'] }, processQuality: 'followed_plan' });
    const preOpen = await run({ comparison: { type: 'sector_fund', symbols: ['XLK'] } }, { XLK: { price: 236.17, at: etIso(DUE, 9, 29) } });
    expect(ideaOf(preOpen).result.economicResult).toBe('unmeasurable');
    expect(endpointRowOf(preOpen).comparison.holdings.XLK.markQuality).toBe('pre_open_print');
  });

  it('a conflicting corporate action never settled leaves the value in doubt though every mark is clean (review RH-7): unmeasurable under its own reason; on the idea\'s own ledger the endpoint also reads blocked', async () => {
    const { idea } = await onTheEve({ comparison: { type: 'sector_fund', symbols: ['XLK'] } });
    const snapshot = closeSnapshot(DUE, quotes());
    const conflict = (ticker) => ({ actionId: `split_${ticker}_${S[5]}`, type: 'split', ticker, effectiveDate: S[5], applied: false, reason: 'conflicting_action', seenOn: S[5] });
    const build = (i) => buildEndpoint({
      idea: i, date: DUE, kind: ENDPOINT_KIND.DUE_SESSION, observed: true, snapshotMeta: { key: `${DUE}_close`, builtAt: null }, nowIso: closeNowOf(DUE).toISOString(),
      valuations: { idea: valueLedger(i.ledger, snapshot, { sessionDate: DUE }), comparison: valueLedger(i.comparisonLedger, snapshot, { sessionDate: DUE }), spy: valueLedger(i.spyLedger, snapshot, { sessionDate: DUE }) },
    });
    const clean = build(idea).result;
    expect(clean).toMatchObject({ economicResult: 'within_band', economic: { unmeasurableBecause: [] }, processQuality: 'followed_plan' });
    const own = build({ ...idea, ledger: { ...idea.ledger, corporateActionReceipts: [conflict('AAPL')] } });
    expect(own.result).toMatchObject({
      economicResult: 'unmeasurable', economic: { unmeasurableBecause: ['idea_unsettled_corporate_action'], gapUsd: clean.economic.gapUsd },
      processQuality: 'blocked', processDetail: { blockedBy: [{ kind: 'endpoint_unsettled_corporate_action', session: DUE, actions: [`split_AAPL_${S[5]}`] }] },
    });
    expect(own.endpointRow.idea).toMatchObject({ fullQuality: false, marksFullQuality: true, unsettledActions: [`split_AAPL_${S[5]}`] });
    const cmp = build({ ...idea, comparisonLedger: { ...idea.comparisonLedger, corporateActionReceipts: [conflict('XLK')] } });
    expect(cmp.result).toMatchObject({ economicResult: 'unmeasurable', economic: { unmeasurableBecause: ['comparison_unsettled_corporate_action'] }, processQuality: 'followed_plan' });
    // A conflict the ledger has since settled (applied or declined) is no doubt at all.
    const settled = build({ ...idea, ledger: { ...idea.ledger, corporateActionReceipts: [conflict('AAPL')], declinedActionIds: [`split_AAPL_${S[5]}`] } });
    expect(settled.result.economicResult).toBe('within_band');
  });

  it('the endpoint states each holding at its own rounded figure and carries the valuation row\'s one-sum figure beside it (review SX-9)', async () => {
    const ctx = await run({ names: ['AAPL', 'MSFT', 'NVDA'], comparison: { type: 'sector_fund', symbols: ['XLK'] } }, {});
    const ep = endpointRowOf(ctx);
    const row = getRow(ctx.db, ctx.bookId, ctx.ideaId, DUE);
    expect(ep.idea.rowMarkedHoldingsValueUsd).toBe(row.markedHoldingsValue);
    const parts = Object.values(ep.idea.holdings).reduce((sum, h) => sum + cents(h.atMarkUsd), 0);
    expect(cents(ep.idea.holdingsAtMarksUsd)).toBe(parts);
    expect(Math.abs(cents(ep.idea.holdingsAtMarksUsd) - cents(ep.idea.rowMarkedHoldingsValueUsd))).toBeLessThanOrEqual(3); // at most a cent a holding
    expect(typeof ep.comparison.rowMarkedHoldingsValueUsd).toBe('number');
    expect(typeof ep.spy.rowMarkedHoldingsValueUsd).toBe('number');
  });

  it('a session with no stored close snapshot is labelled `unobserved`, on its valuation row and on an endpoint written for it — never `post_close_snapshot` (review RH-8)', async () => {
    const ctx = await setup({ comparison: { type: 'sector_fund', symbols: ['XLK'] } });
    for (let i = 0; i <= 9; i += 1) await closeDay(ctx, S[i]);
    // The due session is missed and has no stored snapshot; the next session's close catches it up.
    const out = await closeDay(ctx, S[11]);
    expect(out.caughtUp).toEqual([{ date: DUE, observed: false }]);
    expect(getRow(ctx.db, ctx.bookId, ctx.ideaId, S[9]).label).toBe('post_close_snapshot');
    expect(getRow(ctx.db, ctx.bookId, ctx.ideaId, DUE)).toMatchObject({ label: 'unobserved', observed: false, fullQuality: false });
    expect(ctx.db._get(`mandates/${ctx.bookId}/dailyRows/${DUE}`)).toMatchObject({ label: 'unobserved' }); // the book's row of the session too
    expect(ctx.db._get(`mandates/${ctx.bookId}/dailyRows/${S[9]}`)).toMatchObject({ label: 'post_close_snapshot' });
    expect(endpointRowOf(ctx)).toMatchObject({ label: 'unobserved', observed: false, endpointSession: DUE, writtenLate: true, closeSnapshotKey: null });
    expect(ideaOf(ctx).result).toMatchObject({ economicResult: 'unmeasurable', processQuality: 'blocked' });
    expect(ideaOf(ctx).result.economic.unmeasurableBecause).toContain('endpoint_session_unobserved');
  });

  it('SPY is context and carries no label: a SPY mark that is not full quality leaves the economic result measurable and says so beside the SPY figure', async () => {
    const ctx = await run({ comparison: { type: 'sector_fund', symbols: ['XLK'] } }, { SPY: undefined, AAPL: 251.3 });
    const { result } = ideaOf(ctx);
    expect(result.economicResult).toBe('ahead');
    expect(result.economic.unmeasurableBecause).toEqual([]);
    expect(result.spy.fullQuality).toBe(false);
    expect(Object.keys(result.spy).sort()).toEqual(['fullQuality', 'gapPctOfReserved', 'gapUsd', 'valueUsd']); // no label of its own
  });
});

describe('beside the five columns (contract §4.4)', () => {
  it('the largest decline between recorded session-close values, for the idea and for the comparison, in dollars and as a percent of the prior peak; invested exposure; rows by quality', async () => {
    const ctx = await setup({ comparison: { type: 'sector_fund', symbols: ['XLK'] } });
    const path = [231.47, 236.9, 229.15, 224.02, 233.6, 241.88, 238.4, 219.77, 226.3, 244.1, 247.52];
    const fund = [233.59, 232.1, 234.8, 236.02, 230.44, 228.9, 231.7, 235.5, 237.2, 236.1, 238.75];
    for (let i = 0; i <= 10; i += 1) await closeDay(ctx, S[i], { AAPL: path[i], XLK: fund[i] });
    const rows = S.slice(0, 11).map((d) => getRow(ctx.db, ctx.bookId, ctx.ideaId, d));
    /** The largest peak-to-trough decline of a series, by hand. */
    const declineOf = (values) => {
      let peak = -Infinity; let peakOn = null; let best = { centsDown: 0 };
      values.forEach((v, i) => {
        if (v > peak) { peak = v; peakOn = S[i]; return; }
        if (peak - v > best.centsDown) best = { centsDown: peak - v, peakCents: peak, peakOn, troughOn: S[i] };
      });
      return best;
    };
    const own = declineOf(rows.map((r) => cents(r.markedValue)));
    const cmp = declineOf(rows.map((r) => cents(r.comparisonMarkedValue)));
    const { result } = ideaOf(ctx);
    expect(result.largestDecline).toEqual({
      basis: 'recorded_session_close_values',
      idea: { usd: own.centsDown / 100, pctOfPriorPeak: (own.centsDown * 100) / own.peakCents, priorPeakUsd: own.peakCents / 100, peakOn: own.peakOn, troughOn: own.troughOn },
      comparison: { usd: cmp.centsDown / 100, pctOfPriorPeak: (cmp.centsDown * 100) / cmp.peakCents, priorPeakUsd: cmp.peakCents / 100, peakOn: cmp.peakOn, troughOn: cmp.troughOn },
    });
    expect(result.largestDecline.idea).toMatchObject({ peakOn: S[5], troughOn: S[7] }); // 241.88 → 219.77
    expect(result.largestDecline.idea.usd).toBeGreaterThan(1800);
    const exposure = rows.reduce((sum, r) => sum + cents(r.markedHoldingsValue) / cents(r.markedValue), 0) / rows.length;
    expect(result.investedExposure).toEqual({ mean: exposure, closes: 11 });
    expect(result.dataQuality).toMatchObject({ rows: 11, rowsNotFullQuality: 0 });
    // An idea that only ever rose has no decline: zero, with its peak named.
    const up = newTrackOf([100, 101, 102]);
    expect(up.idea).toMatchObject({ declineCents: 0, peakCents: 10200, peakOn: 'd2' });
  });

  it('the running record folds a close in one step, counts an unobserved session as a row that is not full quality, and never looks back', () => {
    let track = newTrack();
    const row = (date, value, holdings, cmp, fullQuality = true) => ({ date, markedValue: value, markedHoldingsValue: holdings, comparisonMarkedValue: cmp, fullQuality });
    track = foldCloseIntoTrack(track, row('d0', 100, 99, 100), { observed: true });
    track = foldCloseIntoTrack(track, row('d1', 90, 89, 101), { observed: true });
    track = foldCloseIntoTrack(track, row('d2', 95, 94, 99, false), { observed: true });
    track = foldCloseIntoTrack(track, row('d3', 1, 1, 1, false), { observed: false }); // carried marks: nothing was observed
    track = foldCloseIntoTrack(track, row('d4', 120, 0, 97), { observed: true });
    expect(track).toMatchObject({
      rows: 5, rowsNotFullQuality: 2, closes: 4,
      idea: { peakCents: 12000, peakOn: 'd4', declineCents: 1000, declinePeakCents: 10000, declinePeakOn: 'd0', declineTroughOn: 'd1' },
      comparison: { peakCents: 10100, peakOn: 'd1', declineCents: 400, declinePeakCents: 10100, declinePeakOn: 'd1', declineTroughOn: 'd4' },
    });
    expect(track.exposureSum).toBeCloseTo(0.99 + 89 / 90 + 94 / 95 + 0, 12);
  });

  it('fixed in release 1 (E16), on every result: one forward observation, no offer, no closing note, the one-observation label; `deviated` is never written', async () => {
    const { resultWith } = await onTheEve();
    for (const usd of [0, 60, -60]) {
      const { result } = resultWith(usd);
      expect(result).toMatchObject({ evidenceScope: 'single_forward_observation', adoption: 'no_offer', closingNote: null, oneObservationLabel: true, resultVersion: 1 });
      expect(['followed_plan', 'blocked']).toContain(result.processQuality);
    }
  });

  it('a holding with no stored tier (none is written by this build) is costed at the model\'s widest tier, and the result says so; a fund is always its explicit tier', async () => {
    expect(exitTierOf('AAPL', { costTier: { capTier: 'mega', slippageBps: 1, spreadProxyBps: 2 } })).toEqual({ tier: { capTier: 'mega', slippageBps: 1, spreadProxyBps: 2 }, stored: true });
    expect(exitTierOf('AAPL', {})).toEqual({ tier: { capTier: 'unknown', slippageBps: 5, spreadProxyBps: 15 }, stored: false });
    expect(exitTierOf('AAPL', { costTier: { capTier: 'unknown', slippageBps: 5, spreadProxyBps: 15 } }).stored).toBe(false);
    expect(exitTierOf('XLK', { costTier: { capTier: 'small', slippageBps: 5, spreadProxyBps: 15 } })).toEqual({ tier: { capTier: 'fund:liquid_fund', slippageBps: 1, spreadProxyBps: 2 }, stored: true });
    const { idea } = await onTheEve();
    const stripped = { ...idea.ledger, holdings: { AAPL: { ...idea.ledger.holdings.AAPL, costTier: undefined } } };
    const snapshot = closeSnapshot(DUE, quotes());
    const side = ledgerEndpoint(stripped, valueLedger(stripped, snapshot, { sessionDate: DUE }));
    expect(side).toMatchObject({ costTiersStored: false, holdings: { AAPL: { costTier: { capTier: 'unknown' } } } });
  });
});

describe('the three banned words (contract §4.4; concept V6.1 §4)', () => {
  it('the scan finds each word as a key and as a value, on a result and on an endpoint row — and finds none in what this build writes', async () => {
    const { ctx } = await onTheEve();
    await closeDay(ctx, DUE);
    expect(bannedWordsOnResults(ctx.db)).toEqual([]);
    expect(countResults(ctx.db)).toBe(2); // one result, one endpoint row
    for (const word of ['validated', 'proven', 'supported', 'Validated', 'unsupported', 'PROVEN']) expect(BANNED_RESULT_WORDS.test(word), word).toBe(true);
    const ideaPath = `mandates/${ctx.bookId}/ideas/${ctx.ideaId}`;
    const endpointPath = `${ideaPath}/rows/endpoint`;
    const plant = (path, mutate) => { const e = ctx.db._store.get(path); const data = structuredClone(e.data); mutate(data); ctx.db._store.set(path, { data, version: e.version + 1 }); return () => ctx.db._store.set(path, e); };
    for (const word of ['validated', 'proven', 'supported']) {
      let undo = plant(ideaPath, (d) => { d.result[word] = true; });
      expect(bannedWordsOnResults(ctx.db), `${word} as a result key`).toEqual([`${ideaPath}: result key ${word}`, `${ideaPath}: result value`]);
      undo();
      undo = plant(ideaPath, (d) => { d.result.closingNote = `the idea was ${word}`; });
      expect(bannedWordsOnResults(ctx.db), `${word} as a result value`).toEqual([`${ideaPath}: result value`]);
      undo();
      undo = plant(endpointPath, (d) => { d.idea[word] = 1; });
      expect(bannedWordsOnResults(ctx.db), `${word} on an endpoint row`).toHaveLength(2);
      undo();
    }
    expect(bannedWordsOnResults(ctx.db)).toEqual([]);
  });

  it('this file wrote results and endpoint rows, and every one was scanned', () => {
    expect(scanned.results).toBeGreaterThan(10);
  });
});

/** A running record over a simple series of dollar values, dated d0, d1, … (for the zero-decline case). */
function newTrackOf(values) {
  let track = newTrack();
  values.forEach((v, i) => { track = foldCloseIntoTrack(track, { date: `d${i}`, markedValue: v, markedHoldingsValue: v, comparisonMarkedValue: v, fullQuality: true }, { observed: true }); });
  return track;
}
