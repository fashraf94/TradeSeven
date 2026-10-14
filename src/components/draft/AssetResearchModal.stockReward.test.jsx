// @vitest-environment jsdom
// Review K1-1 (takeover, 2026-10-14): the held research modal opened from a
// pinned stock row draws no second target set. REAL: corrected battle fixture,
// canonical scorer, committed patch, enrichHeldPosition, buildResearchAsset,
// AssetResearchModal, useResearchData, StockChart, BaggerBombTab. Mocked:
// network, lightweight-charts (records price lines), drawer shell, other tabs.
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

const net = vi.hoisted(() => ({ daily: {}, intraday: {} }));
const lines = vi.hoisted(() => []);
vi.mock('../../services/eodhdAPI', () => ({
  fetchHistoricalOHLCV: (symbol, timeframe) => Promise.resolve((timeframe === '1d' ? net.daily : timeframe === '30m' ? net.intraday : {})[symbol] ?? []),
  getStockPrice: (symbol) => Promise.resolve({ symbol, price: 0 }),
}));
vi.mock('../../services/fundamentalsService', () => ({ getCompanyProfile: () => Promise.resolve(null) }));
vi.mock('../../services/websocketService', () => ({ getDailyHL: () => null }));
vi.mock('../../utils/fetchWithAuth', () => ({ fetchWithAuth: () => Promise.resolve({ json: async () => ({ success: true, data: {} }) }) }));
vi.mock('lightweight-charts', () => {
  const series = () => ({ setData() {}, createPriceLine(o) { lines.push(o); return { applyOptions() {} }; }, removePriceLine() {}, setMarkers() {}, priceScale() { return { applyOptions() {} }; }, applyOptions() {} });
  return {
    createChart: () => ({ addSeries: () => series(), removeSeries() {}, subscribeCrosshairMove() {}, timeScale() { return { applyOptions() {}, fitContent() {}, scrollToRealTime() {}, setVisibleLogicalRange() {}, getVisibleLogicalRange() { return null; } }; }, applyOptions() {}, remove() {} }),
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
beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); lines.length = 0; vi.spyOn(console, 'log').mockImplementation(() => {}); vi.spyOn(console, 'warn').mockImplementation(() => {}); });
afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.useRealTimers(); });
const flush = async () => { for (let i = 0; i < 4; i++) await act(async () => { await vi.advanceTimersByTimeAsync(0); }); };

async function committedRow() {
  const { battle } = await correctedStockBattle({ fill: 100.75 });
  const prices = { AAPL: { current: 101, timestamp: Date.parse(STOCK_TEST_NOW) / 1000 } };
  const scores = ['agent', 'cpu'].map(side => scoreCorrectedPosition(battle, { ...(side === 'agent' ? battle.portfolio : battle.opponent.portfolio).star[0], tier: 'star' }, side, prices, STOCK_TEST_NOW));
  const h = stockWriterDb({ battle }); await h.db.doc('battle').update(correctedScorePatch(battle, [scores[0]], [scores[1]], STOCK_TEST_NOW)); Object.assign(battle, h.store.get('battle'));
  return enrichHeldPosition(battle.portfolio.star[0], 'star', { stockBattle: battle, stockSide: 'agent', stockSlot: 0 });
}
// Previous session closed at 99; the 13:30Z bar (before the 14:02Z entry)
// printed 101.4 — enough for a previous-close-anchored chart to call a "HIT".
function seedMarket() {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-14T15:00:00.000Z'));
  const bar = (iso, o, hi, lo, c) => ({ date: iso, datetime: iso, timestamp: Math.floor(Date.parse(iso) / 1000), open: o, high: hi, low: lo, close: c, volume: 100 });
  net.daily.AAPL = [{ date: '2026-10-14', open: 100, high: 101.4, low: 99.5, close: 101, volume: 1 }, { date: '2026-10-13', open: 99, high: 99.5, low: 98.5, close: 99, volume: 1 }, { date: '2026-10-12', open: 98, high: 99, low: 97, close: 98, volume: 1 }];
  net.intraday.AAPL = [bar('2026-10-14T14:30:00.000Z', 100.9, 100.97, 100.85, 100.95), bar('2026-10-14T14:00:00.000Z', 100.8, 100.95, 100.7, 100.9), bar('2026-10-14T13:30:00.000Z', 100, 101.4, 99.8, 100.8), bar('2026-10-13T19:30:00.000Z', 99, 99.2, 98.9, 99)];
}
const open = async research => {
  await act(async () => { root.render(<AssetResearchModal asset={research} onClose={() => {}} showActionButton={false} isGameContext version={2} defaultTab="baggerbomb" defaultTimeframe="bomb" wsPrice={101.2} />); });
  await flush();
};
const tierLines = () => lines.filter(l => typeof l.title === 'string' && /pts/.test(l.title));

describe('K1-1: held research on the pinned stock route draws no second target set', () => {
  it('the screen-built research asset opens the real modal with the context tab and no bomb levels or HIT', async () => {
    const left = await committedRow();
    expect(left.rewardContext).toMatchObject({ status: 'valid', crossedTiers: [] });
    const research = buildResearchAsset(left, { livePrices: { AAPL: 101.2 }, thresholds: { AAPL: { threshold: 2.5 } }, startingPrices: { AAPL: 100.75 }, useDefaultThreshold: true });
    expect(research).toMatchObject({ stockRewardRoute: true, threshold: null, lockedPrice: 100.75 });
    seedMarket(); await open(research);
    expect(document.body.textContent).toContain('BaggerBomb: $102.76 (rounded); exact $102.765; unearned');
    expect(tierLines()).toEqual([]);
    expect(lines.some(l => /HIT/.test(l.title || ''))).toBe(false);
  });
  it('legacy control: an unstamped held asset keeps its shipped bomb chart', async () => {
    const research = buildResearchAsset({ symbol: 'AAPL', tier: 'star' }, { livePrices: { AAPL: 101.2 }, thresholds: { AAPL: { threshold: 2 } }, startingPrices: { AAPL: 100.75 }, useDefaultThreshold: true });
    expect(research.threshold).toBe(2);
    seedMarket(); await open(research);
    expect(tierLines().find(l => /\+15 pts/.test(l.title)).price).toBeCloseTo(99 * 1.02, 10);
  });
});
