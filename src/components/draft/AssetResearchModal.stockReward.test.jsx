// @vitest-environment jsdom
// Review K1-1 (takeover, 2026-10-14): the held research modal opened from a
// pinned stock row draws no second target set. REAL: corrected battle fixture,
// canonical scorer, committed patch, enrichHeldPosition, buildResearchAsset,
// AssetResearchModal, useResearchData, StockChart, BaggerBombTab. Mocked:
// network, lightweight-charts (records price lines), drawer shell, other tabs.
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

const net = vi.hoisted(() => ({ daily: {}, intraday: {}, profile: null }));
const lines = vi.hoisted(() => []);
const charts = vi.hoisted(() => ({ created: 0 }));
vi.mock('../../services/eodhdAPI', () => ({
  fetchHistoricalOHLCV: (symbol, timeframe) => Promise.resolve((timeframe === '1d' ? net.daily : timeframe === '30m' ? net.intraday : {})[symbol] ?? []),
  getStockPrice: (symbol) => Promise.resolve({ symbol, price: 0 }),
}));
vi.mock('../../services/fundamentalsService', () => ({ getCompanyProfile: () => Promise.resolve(net.profile) }));
vi.mock('../../services/websocketService', () => ({ getDailyHL: () => null }));
vi.mock('../../utils/fetchWithAuth', () => ({ fetchWithAuth: () => Promise.resolve({ json: async () => ({ success: true, data: {} }) }) }));
vi.mock('lightweight-charts', () => {
  const series = () => ({ setData() {}, createPriceLine(o) { lines.push(o); return { applyOptions() {} }; }, removePriceLine() {}, setMarkers(m) { if (m?.length) lines.push({ title: `CANDLE MARKERS HIT ${m.length}` }); }, priceScale() { return { applyOptions() {} }; }, applyOptions() {} });
  return {
    createChart: () => { charts.created += 1; return { addSeries: () => series(), removeSeries() {}, subscribeCrosshairMove() {}, timeScale() { return { applyOptions() {}, fitContent() {}, scrollToRealTime() {}, setVisibleLogicalRange() {}, getVisibleLogicalRange() { return null; } }; }, applyOptions() {}, remove() {} }; },
    CandlestickSeries: 'Candlestick', HistogramSeries: 'Histogram', LineSeries: 'Line', AreaSeries: 'Area',
  };
});
vi.mock('../Research/AnalysisDrawer', () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock('../Research/AnalysisQATab', () => ({ default: () => null }));
vi.mock('../Research/TechnicalTabV2', () => ({ default: () => null }));
vi.mock('../Research/HealthTab', () => ({ default: () => null }));
vi.mock('./ResearchTabs/TechnicalAnalysisTab', () => ({ default: () => null }));
vi.mock('./SectorTab', () => ({ default: () => null }));
vi.mock('./CompeteTab', () => ({ default: () => null }));
vi.mock('../Research/MarketContextTab', () => ({ default: () => null }));
vi.mock('../Research/HoldingsTab', () => ({ default: () => null }));
vi.mock('../Research/SectorETFRanksTab', () => ({ default: () => null }));
vi.mock('../Research/SmartMoneyTab', () => ({ default: () => null }));
vi.mock('../../firebase/config', () => ({ db: {}, auth: { currentUser: null }, default: {} }));

import { STOCK_TEST_NOW, correctedStockBattle, stockWriterDb } from '../../../api/_utils/__fixtures__/stockThresholdHarness.js';
import { correctedScorePatch, scoreCorrectedPosition } from '../../../api/_utils/stockThresholdAdmission.js';
import { enrichHeldPosition } from '../../screens/AgentBattleScreen.jsx';
import { buildResearchAsset } from '../../utils/researchAssetBuilder.js';
import AssetResearchModal from './AssetResearchModal';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
if (!globalThis.ResizeObserver) globalThis.ResizeObserver = class { observe() {} disconnect() {} unobserve() {} };
const oldKey = process.env.EODHD_API_KEY;
beforeAll(() => { process.env.EODHD_API_KEY = 'isolated-key'; });
afterAll(() => { if (oldKey === undefined) delete process.env.EODHD_API_KEY; else process.env.EODHD_API_KEY = oldKey; });
let container, root;
beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); lines.length = 0; charts.created = 0; vi.spyOn(console, 'log').mockImplementation(() => {}); vi.spyOn(console, 'warn').mockImplementation(() => {}); });
afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.useRealTimers(); });
const flush = async () => { for (let i = 0; i < 4; i++) await act(async () => { await vi.advanceTimersByTimeAsync(0); }); };

// A committed frame at `quote` (dated after the 13:47 fill quote).
async function committedRow(quote = 101) {
  const { battle } = await correctedStockBattle({ fill: 100.75 });
  const prices = { AAPL: { current: quote, timestamp: Date.parse(STOCK_TEST_NOW) / 1000 } };
  const scores = ['agent', 'cpu'].map(side => scoreCorrectedPosition(battle, { ...(side === 'agent' ? battle.portfolio : battle.opponent.portfolio).star[0], tier: 'star' }, side, prices, STOCK_TEST_NOW));
  const h = stockWriterDb({ battle }); await h.db.doc('battle').update(correctedScorePatch(battle, [scores[0]], [scores[1]], STOCK_TEST_NOW)); Object.assign(battle, h.store.get('battle'));
  return enrichHeldPosition(battle.portfolio.star[0], 'star', { stockBattle: battle, stockSide: 'agent', stockSlot: 0 });
}
// Previous session closed at 99. The 13:30Z bar — before the 13:47 fill quote and
// the 14:02 entry — printed 103.5: above the measured bagger target (102.765), so a
// candle-driven chart would call a "HIT" the position never earned.
function seedMarket() {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-14T15:00:00.000Z'));
  const bar = (iso, o, hi, lo, c) => ({ date: iso, datetime: iso, timestamp: Math.floor(Date.parse(iso) / 1000), open: o, high: hi, low: lo, close: c, volume: 100 });
  net.daily.AAPL = [{ date: '2026-10-14', open: 100, high: 103.5, low: 99.5, close: 101, volume: 1 }, { date: '2026-10-13', open: 99, high: 99.5, low: 98.5, close: 99, volume: 1 }, { date: '2026-10-12', open: 98, high: 99, low: 97, close: 98, volume: 1 }];
  net.intraday.AAPL = [bar('2026-10-14T14:30:00.000Z', 100.9, 100.97, 100.85, 100.95), bar('2026-10-14T14:00:00.000Z', 100.8, 100.95, 100.7, 100.9), bar('2026-10-14T13:30:00.000Z', 100, 103.5, 99.8, 100.8), bar('2026-10-13T19:30:00.000Z', 99, 99.2, 98.9, 99)];
}
const open = async (research, defaultTab = 'baggerbomb') => {
  await act(async () => { root.render(<AssetResearchModal asset={research} onClose={() => {}} showActionButton={false} isGameContext version={2} defaultTab={defaultTab} defaultTimeframe="bomb" wsPrice={101.2} />); });
  await flush();
};
const tierLines = () => lines.filter(l => typeof l.title === 'string' && /pts/.test(l.title));
const tierRow = key => document.querySelector(`[data-tier="${key}"]`);
const research = left => buildResearchAsset(left, { livePrices: { AAPL: 101.2 }, thresholds: { AAPL: { threshold: 2.5 } }, startingPrices: { AAPL: 100.75 }, useDefaultThreshold: true });
const nextDown = n => { const a = new Float64Array([n]), b = new BigUint64Array(a.buffer); b[0] -= 1n; return a[0]; };

describe('v2 Ruling 15: the measured-model modal — tab and chart from the committed context only', () => {
  it('the chart draws all six exact targets from the fill plus the Entry line, with no HIT from session candles', async () => {
    const left = await committedRow();
    expect(left.rewardContext).toMatchObject({ status: 'valid', crossedTiers: [] });
    const r = research(left);
    expect(r).toMatchObject({ stockRewardRoute: true, threshold: null, lockedPrice: 100.75 });
    seedMarket(); await open(r);
    const byTier = Object.fromEntries(left.rewardContext.targets.map(t => [t.key, t.target]));
    expect(tierLines().map(l => l.price).sort((a, b) => b - a)).toEqual(Object.values(byTier).sort((a, b) => b - a));
    expect(lines.find(l => l.title === '— Entry —').price).toBe(100.75);
    expect(lines.some(l => /HIT/.test(l.title || ''))).toBe(false); // the 103.5 pre-entry print crossed nothing
    expect(tierRow('bagger').dataset.tierStatus).toBe('unearned');
    expect(tierRow('bagger').textContent).toContain('$102.76'); expect(tierRow('bagger').textContent).toContain('+2.00%');
    expect(document.body.textContent).toContain('Entry: $100.75');
  });
  it.each([['exact', t => t, true], ['one ulp short', t => nextDown(t), false]])('at the %s bagger target, tab and chart agree with the server context', async (_, at, earned) => {
    const { battle } = await correctedStockBattle({ fill: 100.75 });
    const target = battle.portfolio.star[0].stockThresholdReceipt.fill * (1 + 1 * 2 / 100);
    const left = await committedRow(at(target));
    expect(left.rewardContext.crossedTiers.includes('bagger')).toBe(earned);
    seedMarket(); await open(research(left));
    expect(tierRow('bagger').dataset.tierStatus).toBe(earned ? 'earned' : 'unearned');
    const hit = lines.filter(l => /HIT/.test(l.title || ''));
    expect(hit.map(l => l.price)).toEqual(earned ? [left.rewardContext.targets.find(t => t.key === 'bagger').target] : []);
  });
  it('an equal committed context rebuilt by every screen render keeps the same chart; a new crossing still reaches it (review B3-2)', async () => {
    const quote = { posKey: 'agent|star|0', symbol: 'AAPL', price: 101.2, extremes: null };
    const show = async left => { await act(async () => { root.render(<AssetResearchModal asset={research(left)} onClose={() => {}} showActionButton={false} isGameContext version={2} defaultTab="baggerbomb" defaultTimeframe="bomb" controlledQuote={quote} />); }); await flush(); };
    const left = await committedRow(); seedMarket();
    await show(left); const first = charts.created; expect(first).toBeGreaterThan(0);
    await show({ ...left, rewardContext: structuredClone(left.rewardContext) }); await show({ ...left, rewardContext: structuredClone(left.rewardContext) });
    expect(charts.created).toBe(first);
    const crossed = await committedRow(103); await show(crossed);
    expect(tierRow('bagger').dataset.tierStatus).toBe('earned');
    expect(lines.some(l => /HIT/.test(l.title || ''))).toBe(true);
  });
  it('an unavailable context reads as a short state and draws no targets', async () => {
    const left = await committedRow();
    const unavailable = { ...left, rewardContext: { status: 'unavailable', reason: 'missing_post_entry_quote' } };
    seedMarket(); await open(research(unavailable));
    expect(document.body.textContent).toContain('Measured reward unavailable');
    expect(tierLines()).toEqual([]);
  });
  it('legacy control: an unstamped held asset keeps its shipped bomb chart, without the placeholder history block', async () => {
    const r = buildResearchAsset({ symbol: 'AAPL', tier: 'star' }, { livePrices: { AAPL: 101.2 }, thresholds: { AAPL: { threshold: 2 } }, startingPrices: { AAPL: 100.75 }, useDefaultThreshold: true });
    expect(r.threshold).toBe(2);
    seedMarket(); await open(r);
    expect(tierLines().find(l => /\+15 pts/.test(l.title)).price).toBeCloseTo(99 * 1.02, 10);
    expect(document.body.textContent).toContain('THRESHOLDS');
    for (const gone of ['HISTORICAL (30 DAYS)', 'Hit Rate', 'Avg Daily Move', 'Days Hit']) expect(document.body.textContent).not.toContain(gone);
  });
  it('the Fundamental tab shows a rating only when the profile carries a real one (never the mock default)', async () => {
    const r = buildResearchAsset({ symbol: 'AAPL', tier: 'star' }, { livePrices: { AAPL: 101.2 }, thresholds: { AAPL: { threshold: 2 } }, useDefaultThreshold: true });
    seedMarket(); net.profile = null; await open(r, 'fundamental');
    for (const rating of ['Strong Buy', 'Buy', 'Hold']) expect(document.body.textContent).not.toContain(`● ${rating}`);
    act(() => root.unmount()); root = createRoot(container);
    net.profile = { ratingText: 'Hold' }; await open(r, 'fundamental');
    expect(document.body.textContent).toContain('● Hold');
    net.profile = null;
  });
});
