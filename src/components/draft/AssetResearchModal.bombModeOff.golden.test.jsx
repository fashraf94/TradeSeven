// @vitest-environment jsdom
//
// Research Modal Build A — THE MODE-OFF IDENTITY GOLDEN for the modal (spec
// docs/specs/RESEARCH_MODAL_BUILD_A_BOMB_MODE_SPEC_V1.md §6, "byte-identical
// render … of the modal with the mode off on representative fixtures").
//
// GENERATED at the pre-build product tree: the golden file was written by
// this harness (GENERATE_BOMB_MODE_OFF_GOLDEN=1) at the branch's second commit,
// whose AssetResearchModal / StockChart / useResearchData / BaggerBombTab /
// AnalysisDrawer are byte-identical to main d503dd07. Never regenerate it from
// build output: a diff here is a mode-off change, and the build promises none.
//
// Each scene renders the REAL modal (useResearchData, StockChart, the drawer,
// BaggerBombTab) with RESEARCH_MODAL_BOMB_MODE forced 'off', and records three
// things: the rendered HTML, every data request (the call-count table's
// source), and every chart-library call (series data, price lines). Mocked:
// the network, lightweight-charts (a recorder) and the unrelated tabs.

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// CI-shaped clock zone (tests.yml runs under TZ=UTC): the 1D chart parses calendar
// dates at LOCAL midnight, so the golden is written and read in UTC everywhere.
vi.hoisted(() => { process.env.TZ = 'UTC'; });
vi.mock('../../config/researchModalFlags', () => ({ RESEARCH_MODAL_BOMB_MODE: 'off', RESEARCH_MODAL_BOMB_MODES: Object.freeze(['off', 'allowlist', 'on']) }));
vi.mock('../../config/researchModalFlags.js', () => ({ RESEARCH_MODAL_BOMB_MODE: 'off', RESEARCH_MODAL_BOMB_MODES: Object.freeze(['off', 'allowlist', 'on']) }));

const net = vi.hoisted(() => ({ daily: {}, intraday: {}, minute: {}, calls: [] }));
const rec = vi.hoisted(() => ({ calls: [] }));
vi.mock('../../services/eodhdAPI', () => ({
  fetchHistoricalOHLCV: (symbol, timeframe, opts) => {
    net.calls.push(['history', symbol, timeframe, opts ?? null]);
    const src = timeframe === '1d' ? net.daily : timeframe === '30m' ? net.intraday : timeframe === '1m' ? net.minute : {};
    return Promise.resolve(src[symbol] ?? []);
  },
  getStockPrice: (symbol) => { net.calls.push(['quote', symbol]); return Promise.resolve({ symbol, price: 0 }); },
}));
vi.mock('../../services/fundamentalsService', () => ({ getCompanyProfile: (s) => { net.calls.push(['profile', s]); return Promise.resolve(null); } }));
vi.mock('../../services/volatilityService', () => ({ getVolatilityThresholds: (syms, kind) => { net.calls.push(['thresholds', syms, kind]); return Promise.resolve({}); } }));
vi.mock('../../services/websocketService', () => ({ getDailyHL: () => null }));
vi.mock('../../utils/fetchWithAuth', () => ({ fetchWithAuth: (u) => { net.calls.push(['fetchWithAuth', String(u)]); return Promise.resolve({ json: async () => ({ success: true, data: {} }) }); } }));
vi.mock('lightweight-charts', () => {
  const series = (kind) => ({
    setData(d) { rec.calls.push(['setData', kind, d.length, d.length ? d[d.length - 1] : null]); },
    createPriceLine(o) { rec.calls.push(['priceLine', kind, o.price, o.title ?? '']); return { applyOptions() {} }; },
    removePriceLine() { rec.calls.push(['removePriceLine', kind]); },
    setMarkers(m) { rec.calls.push(['setMarkers', kind, m.length]); },
    priceScale() { return { applyOptions() {} }; },
    applyOptions() {},
  });
  return {
    createChart: () => { rec.calls.push(['createChart']); return { addSeries: (k) => { rec.calls.push(['addSeries', k]); return series(k); }, removeSeries() {}, subscribeCrosshairMove() {}, unsubscribeCrosshairMove() {}, timeScale() { return { applyOptions() {}, fitContent() {}, scrollToRealTime() {}, setVisibleLogicalRange() {}, getVisibleLogicalRange() { return null; }, subscribeVisibleLogicalRangeChange() {}, unsubscribeVisibleLogicalRangeChange() {} }; }, applyOptions() {}, resize() {}, remove() {} }; },
    CandlestickSeries: 'Candlestick', HistogramSeries: 'Histogram', LineSeries: 'Line', AreaSeries: 'Area',
  };
});
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

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GOLDEN = path.join(HERE, '__goldens__', 'AssetResearchModal.bombModeOff.golden.json');
const GENERATE = process.env.GENERATE_BOMB_MODE_OFF_GOLDEN === '1';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
if (!globalThis.ResizeObserver) globalThis.ResizeObserver = class { observe() {} disconnect() {} unobserve() {} };
const oldKey = process.env.EODHD_API_KEY;
beforeAll(() => { process.env.EODHD_API_KEY = 'isolated-key'; });
afterAll(() => { if (oldKey === undefined) delete process.env.EODHD_API_KEY; else process.env.EODHD_API_KEY = oldKey; });

let container, root;
beforeEach(() => {
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  net.calls.length = 0; rec.calls.length = 0;
  vi.spyOn(console, 'log').mockImplementation(() => {}); vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.useRealTimers(); });
const flush = async () => { for (let i = 0; i < 6; i++) await act(async () => { await vi.advanceTimersByTimeAsync(0); }); };

const bar = (iso, o, hi, lo, c) => ({ date: iso, datetime: iso, timestamp: Math.floor(Date.parse(iso) / 1000), open: o, high: hi, low: lo, close: c, volume: 100 });
function seedMarket(nowIso) {
  vi.useFakeTimers(); vi.setSystemTime(new Date(nowIso));
  net.daily.AAPL = [{ date: '2026-10-14', open: 100, high: 103.5, low: 99.5, close: 101, volume: 1 }, { date: '2026-10-13', open: 99, high: 99.5, low: 98.5, close: 99, volume: 1 }, { date: '2026-10-12', open: 98, high: 99, low: 97, close: 98, volume: 1 }];
  net.intraday.AAPL = [bar('2026-10-14T14:30:00.000Z', 100.9, 100.97, 100.85, 100.95), bar('2026-10-14T14:00:00.000Z', 100.8, 100.95, 100.7, 100.9), bar('2026-10-14T13:30:00.000Z', 100, 103.5, 99.8, 100.8), bar('2026-10-13T19:30:00.000Z', 99, 99.2, 98.9, 99)];
  net.minute.AAPL = [bar('2026-10-14T14:59:00.000Z', 101.1, 101.2, 101.0, 101.15), bar('2026-10-14T14:58:00.000Z', 101.0, 101.1, 100.95, 101.1), bar('2026-10-14T14:57:00.000Z', 100.98, 101.02, 100.9, 101.0)];
}
// The Oct 17 shape: the 30-minute cache ends Thursday, and it is Saturday 11:00 ET.
function seedWeekend() {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-17T15:00:00.000Z'));
  net.daily.AAPL = [{ date: '2026-10-16', open: 152.0, high: 154.1, low: 151.2, close: 153.4, volume: 1 }, { date: '2026-10-15', open: 151, high: 152.9, low: 150.5, close: 152.62, volume: 1 }];
  net.intraday.AAPL = [bar('2026-10-15T19:30:00.000Z', 152.4, 152.7, 152.3, 152.62), bar('2026-10-15T19:00:00.000Z', 152.2, 152.5, 152.1, 152.4)];
  net.minute.AAPL = [];
}

async function committedRow(quote = 101) {
  const { battle } = await correctedStockBattle({ fill: 100.75 });
  const prices = { AAPL: { current: quote, timestamp: Date.parse(STOCK_TEST_NOW) / 1000 } };
  const scores = ['agent', 'cpu'].map(side => scoreCorrectedPosition(battle, { ...(side === 'agent' ? battle.portfolio : battle.opponent.portfolio).star[0], tier: 'star' }, side, prices, STOCK_TEST_NOW));
  const h = stockWriterDb({ battle }); await h.db.doc('battle').update(correctedScorePatch(battle, [scores[0]], [scores[1]], STOCK_TEST_NOW)); Object.assign(battle, h.store.get('battle'));
  return enrichHeldPosition(battle.portfolio.star[0], 'star', { stockBattle: battle, stockSide: 'agent', stockSlot: 0 });
}
const research = (left) => buildResearchAsset(left, { livePrices: { AAPL: 101.2 }, thresholds: { AAPL: { threshold: 2.5 } }, startingPrices: { AAPL: 100.75 }, useDefaultThreshold: true });

const render = async (el) => { await act(async () => { root.render(el); }); await flush(); };
// The modal renders through a portal into document.body. The fixture mints a
// fresh receipt hash and snapshot uuid per run; both are masked.
const stable = (html) => html.replace(/[0-9a-f]{64}/g, '<hash>').replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, '<uuid>');
const snapshot = () => ({ html: stable(document.body.innerHTML), net: JSON.parse(JSON.stringify(net.calls)), chart: JSON.parse(JSON.stringify(rec.calls)) });
const click = async (el) => { await act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); }); await flush(); };

// Each scene: the modal as one mount class opens it today.
const SCENES = {
  // AgentBattleScreen held (gated) mount: measured position, controlled quote, bomb view.
  held_measured_controlled: async () => {
    const left = await committedRow(); seedMarket('2026-10-14T15:00:00.000Z');
    await render(<AssetResearchModal asset={research(left)} onClose={() => {}} showActionButton={false} isGameContext version={2} defaultTab="baggerbomb" defaultTimeframe="bomb" controlledQuote={{ posKey: 'agent|star|0', symbol: 'AAPL', price: 101.2, extremes: null }} />);
    return snapshot();
  },
  // AgentBattleScreen legacy mount: measured position, wsPrice, bomb view.
  held_measured_ws: async () => {
    const left = await committedRow(); seedMarket('2026-10-14T15:00:00.000Z');
    await render(<AssetResearchModal asset={research(left)} onClose={() => {}} showActionButton={false} isGameContext version={2} defaultTab="baggerbomb" defaultTimeframe="bomb" wsPrice={101.2} />);
    return snapshot();
  },
  // AgentBattleScreen non-held / bench door: legacy builder with the default threshold.
  bench_legacy_bomb: async () => {
    seedMarket('2026-10-14T15:00:00.000Z');
    const r = buildResearchAsset({ symbol: 'AAPL', name: 'Apple' }, { livePrices: { AAPL: 101.2 }, thresholds: {}, startingPrices: {}, useDefaultThreshold: true });
    await render(<AssetResearchModal asset={r} onClose={() => {}} showActionButton={false} isGameContext version={2} defaultTab="baggerbomb" defaultTimeframe="bomb" wsPrice={101.2} />);
    return snapshot();
  },
  // The bomb view's distance pill → the spectate (1-minute) view.
  bench_legacy_spectate: async () => {
    seedMarket('2026-10-14T15:00:00.000Z');
    const r = buildResearchAsset({ symbol: 'AAPL', name: 'Apple' }, { livePrices: { AAPL: 101.2 }, thresholds: { AAPL: { threshold: 2 } }, startingPrices: { AAPL: 100.75 }, useDefaultThreshold: true });
    await render(<AssetResearchModal asset={r} onClose={() => {}} showActionButton={false} isGameContext version={2} defaultTab="baggerbomb" defaultTimeframe="bomb" wsPrice={101.2} />);
    const tap = [...document.body.querySelectorAll('div')].find(d => d.textContent.endsWith('TAP') && d.style.cursor === 'pointer');
    await click(tap);
    return snapshot();
  },
  // FreeAgentBar: no isGameContext prop, showActionButton false.
  free_agent_bar: async () => {
    seedMarket('2026-10-14T15:00:00.000Z');
    await render(<AssetResearchModal asset={{ symbol: 'AAPL', name: 'Apple', price: 101.2, threshold: 2.5 }} onClose={() => {}} showActionButton={false} version={2} defaultTab="baggerbomb" defaultTimeframe="bomb" />);
    return snapshot();
  },
  // A draft / acquire mount: the acquire button derives game context.
  acquire_mount: async () => {
    seedMarket('2026-10-14T15:00:00.000Z');
    await render(<AssetResearchModal asset={{ symbol: 'AAPL', name: 'Apple', price: 101.2 }} onClose={() => {}} onAcquire={() => {}} canPick version={2} />);
    return snapshot();
  },
  // A browse mount: search / Discover / FantasyTimes.
  browse_mount: async () => {
    seedMarket('2026-10-14T15:00:00.000Z');
    await render(<AssetResearchModal asset={{ symbol: 'AAPL', name: 'Apple', price: 101.2 }} onClose={() => {}} showActionButton={false} version={2} />);
    return snapshot();
  },
  // The Oct 17 Saturday: the cached series ends Thursday, the synthesizer runs.
  weekend_bench_bomb: async () => {
    seedWeekend();
    const r = buildResearchAsset({ symbol: 'AAPL', name: 'Apple' }, { livePrices: { AAPL: 153.4 }, thresholds: { AAPL: { threshold: 2 } }, startingPrices: {}, useDefaultThreshold: true });
    await render(<AssetResearchModal asset={r} onClose={() => {}} showActionButton={false} isGameContext version={2} defaultTab="baggerbomb" defaultTimeframe="bomb" wsPrice={153.4} />);
    return snapshot();
  },
};

describe('mode off: the modal renders, requests and charts exactly as main (Build A spec §6)', () => {
  const golden = !GENERATE && existsSync(GOLDEN) ? JSON.parse(readFileSync(GOLDEN, 'utf8')) : null;
  const out = {};
  afterAll(() => {
    if (!GENERATE) return;
    mkdirSync(path.dirname(GOLDEN), { recursive: true });
    writeFileSync(GOLDEN, `${JSON.stringify(out, null, 1)}\n`);
  });
  it.each(Object.keys(SCENES))('%s — same HTML, same requests, same chart calls', async (name) => {
    const got = await SCENES[name]();
    if (GENERATE) { out[name] = got; return; }
    expect(golden, 'golden file missing — it is generated only at the pre-build tree').not.toBeNull();
    expect(got.net).toEqual(golden[name].net);
    expect(got.chart).toEqual(golden[name].chart);
    expect(got.html).toBe(golden[name].html);
  });
});
