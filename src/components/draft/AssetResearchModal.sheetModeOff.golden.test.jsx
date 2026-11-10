// @vitest-environment jsdom
//
// Research Modal Build C — THE MODE-OFF IDENTITY GOLDEN for the modal (spec
// docs/specs/RESEARCH_MODAL_BUILD_C_SHEET_SPEC_V1.md §6, "a byte-identical
// render of the modal … with the mode off").
//
// GENERATED at the pre-build product tree: the golden file was written by this
// harness (GENERATE_SHEET_MODE_OFF_GOLDEN=1) at the branch's flag commit, whose
// AssetResearchModal / StockChart / AnalysisDrawer / AnalysisQATab are
// byte-identical to main f095dc29. Never regenerate it from build output: a
// diff here is a mode-off change, and the build promises none.
//
// The sheet replaces the Analysis tab, so every scene ends ON the Analysis tab
// with its real content (the profile, the analyst chip and AnalysisQATab's
// preset questions — the Haiku cards the sheet retires when on). Each scene
// records the rendered HTML, every data request and every chart-library call,
// including any createSeriesMarkers call (none may happen off).
// RESEARCH_MODAL_SHEET_MODE is forced 'off'; Bomb mode keeps its shipped
// 'allowlist' (no mount here passes bombContext, so it draws nothing new).

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

vi.hoisted(() => { process.env.TZ = 'UTC'; });
const FLAGS = vi.hoisted(() => ({
  RESEARCH_MODAL_BOMB_MODE: 'allowlist',
  RESEARCH_MODAL_BOMB_MODES: Object.freeze(['off', 'allowlist', 'on']),
  RESEARCH_MODAL_SHEET_MODE: 'off',
  RESEARCH_MODAL_SHEET_MODES: Object.freeze(['off', 'allowlist', 'on']),
}));
vi.mock('../../config/researchModalFlags', () => FLAGS);
vi.mock('../../config/researchModalFlags.js', () => FLAGS);

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
const PROFILE = {
  Name: 'Apple Inc', sector: 'Technology', industry: 'Consumer Electronics',
  description: 'Apple designs, manufactures and markets smartphones, personal computers, tablets, wearables and accessories, and sells a variety of related services worldwide.',
  ratingText: 'Buy', analystConsensus: { totalAnalysts: 24 },
};
vi.mock('../../services/fundamentalsService', () => ({ getCompanyProfile: (s) => { net.calls.push(['profile', s]); return Promise.resolve({ ...PROFILE }); } }));
vi.mock('../../services/volatilityService', () => ({ getVolatilityThresholds: (syms, kind) => { net.calls.push(['thresholds', syms, kind]); return Promise.resolve({}); } }));
vi.mock('../../services/websocketService', () => ({ getDailyHL: () => null }));
vi.mock('../../utils/fetchWithAuth', () => ({ fetchWithAuth: (u, o) => { net.calls.push(['fetchWithAuth', String(u), o?.method ?? null]); return Promise.resolve({ ok: true, json: async () => ({ success: true, data: {} }) }); } }));
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
    createSeriesMarkers: (s, m) => { rec.calls.push(['createSeriesMarkers', m?.length ?? 0]); return { setMarkers() {}, detach() {} }; },
    CandlestickSeries: 'Candlestick', HistogramSeries: 'Histogram', LineSeries: 'Line', AreaSeries: 'Area',
  };
});
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
const GOLDEN = path.join(HERE, '__goldens__', 'AssetResearchModal.sheetModeOff.golden.json');
const GENERATE = process.env.GENERATE_SHEET_MODE_OFF_GOLDEN === '1';

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
const stable = (html) => html.replace(/[0-9a-f]{64}/g, '<hash>').replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, '<uuid>');
const snapshot = () => ({ html: stable(document.body.innerHTML), net: JSON.parse(JSON.stringify(net.calls)), chart: JSON.parse(JSON.stringify(rec.calls)) });
const click = async (el) => { expect(el).toBeTruthy(); await act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); }); await flush(); };
const analysisTab = () => [...document.body.querySelectorAll('button')].find((b) => b.textContent === 'Analysis');

const SCENES = {
  // The Battle View's held (gated) mount, as it opens today, then the Analysis tab.
  held_controlled_analysis: async () => {
    const left = await committedRow(); seedMarket('2026-10-14T15:00:00.000Z');
    await render(<AssetResearchModal asset={research(left)} onClose={() => {}} showActionButton={false} isGameContext version={2} defaultTab="baggerbomb" defaultTimeframe="bomb" controlledQuote={{ posKey: 'agent|star|0', symbol: 'AAPL', price: 101.2, extremes: null }} />);
    await click(analysisTab());
    return snapshot();
  },
  // The legacy (shipped) mount with wsPrice, then the Analysis tab.
  held_ws_analysis: async () => {
    const left = await committedRow(); seedMarket('2026-10-14T15:00:00.000Z');
    await render(<AssetResearchModal asset={research(left)} onClose={() => {}} showActionButton={false} isGameContext version={2} defaultTab="baggerbomb" defaultTimeframe="bomb" wsPrice={101.2} />);
    await click(analysisTab());
    return snapshot();
  },
  // The non-held / bench door (the legacy builder), then the Analysis tab.
  bench_analysis: async () => {
    seedMarket('2026-10-14T15:00:00.000Z');
    const r = buildResearchAsset({ symbol: 'AAPL', name: 'Apple' }, { livePrices: { AAPL: 101.2 }, thresholds: {}, startingPrices: {}, useDefaultThreshold: true });
    await render(<AssetResearchModal asset={r} onClose={() => {}} showActionButton={false} isGameContext version={2} defaultTab="baggerbomb" defaultTimeframe="bomb" wsPrice={101.2} />);
    await click(analysisTab());
    return snapshot();
  },
  // A browse mount: opens on the Analysis tab by default.
  browse_analysis: async () => {
    seedMarket('2026-10-14T15:00:00.000Z');
    await render(<AssetResearchModal asset={{ symbol: 'AAPL', name: 'Apple', price: 101.2 }} onClose={() => {}} showActionButton={false} version={2} />);
    return snapshot();
  },
};

describe('sheet mode off: the modal renders, requests and charts exactly as main (Build C spec §6)', () => {
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
    expect(got.chart.some((c) => c[0] === 'createSeriesMarkers')).toBe(false);
    expect(got.html).toBe(golden[name].html);
    // The Haiku preset questions still render with the mode off (BC-1: the file stays, the off path is untouched).
    expect(got.html).toContain('What does this company do?');
    expect(got.html).toContain('Wall St: Buy · 24 analysts');
  });
});
