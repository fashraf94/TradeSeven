// @vitest-environment jsdom
//
// THE BATTLE CHART in the real modal (build prompt of Nov 13, 2026, BC2-1 – BC2-5;
// spec docs/specs/RESEARCH_MODAL_SHELL_SPEC_V1.md §12): a third time pill in
// battle, loaded on its tap (never on open), 5-minute bars for a one-day battle and
// 30-minute bars for a longer one, the record's markers by TIME on Battle and one
// counted marker per day on 1D, "see on chart" from a timed item opening Battle,
// and the next rung each way at 💣's displayed prices. Network and chart library
// faked and recorded; RESEARCH_MODAL_SHEET_MODE mocked 'on'.

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

vi.hoisted(() => { process.env.TZ = 'UTC'; });
const FLAGS = vi.hoisted(() => ({
  RESEARCH_MODAL_SHEET_MODE: 'on',
  RESEARCH_MODAL_SHEET_MODES: Object.freeze(['off', 'allowlist', 'on']),
  RESEARCH_MODAL_BOMB_MODE: 'on',
  RESEARCH_MODAL_BOMB_MODES: Object.freeze(['off', 'allowlist', 'on']),
}));
vi.mock('../../config/researchModalFlags', () => FLAGS);
vi.mock('../../config/researchModalFlags.js', () => FLAGS);

const net = vi.hoisted(() => ({ calls: [], intraday: null, daily: null, fallback: false }));
const rec = vi.hoisted(() => ({ lines: [], markers: [], clicks: [] }));
vi.mock('../../services/eodhdAPI', () => ({
  fetchHistoricalOHLCV: (symbol, timeframe, opts) => {
    net.calls.push(['history', symbol, timeframe, opts ?? null]);
    if (timeframe === '5m' || timeframe === '30m') {
      if (net.fallback) { const d = [...net.daily]; d._meta = { actualTimeframe: '1d' }; return Promise.resolve(d); }
      return Promise.resolve(net.intraday(timeframe));
    }
    return Promise.resolve(net.daily);
  },
  getStockPrice: (symbol) => { net.calls.push(['quote', symbol]); return Promise.resolve({ symbol, price: 0 }); },
}));
vi.mock('../../services/fundamentalsService', () => ({ getCompanyProfile: () => Promise.resolve({ Name: 'Apple Inc', sector: 'Technology', industry: 'Consumer Electronics', description: 'It makes things.', ratingText: 'Buy', analystConsensus: { totalAnalysts: 24 } }) }));
vi.mock('../../services/volatilityService', () => ({ getVolatilityThresholds: () => Promise.resolve({}) }));
vi.mock('../../services/websocketService', () => ({ getDailyHL: () => null }));
vi.mock('../../utils/fetchWithAuth', () => ({ fetchWithAuth: async (u) => { net.calls.push(['fetchWithAuth', String(u)]); return { ok: true, status: 200, json: async () => ({ success: true }) }; } }));
vi.mock('lightweight-charts', () => {
  const series = () => ({ setData() {}, createPriceLine(o) { rec.lines.push(o); return o; }, removePriceLine() {}, setMarkers() {}, priceScale() { return { applyOptions() {} }; }, applyOptions() {} });
  return {
    createChart: () => ({
      addSeries: () => series(), removeSeries() {}, subscribeCrosshairMove() {},
      subscribeClick(fn) { rec.clicks.push(fn); }, unsubscribeClick(fn) { rec.clicks = rec.clicks.filter((f) => f !== fn); },
      timeScale() { return { applyOptions() {}, fitContent() {}, scrollToRealTime() {}, setVisibleLogicalRange() {}, getVisibleLogicalRange() { return null; } }; },
      applyOptions() {}, remove() {},
    }),
    createSeriesMarkers: (s, m) => { rec.markers.push(m); return { setMarkers(x) { rec.markers.push(x); }, detach() {} }; },
    CandlestickSeries: 'Candlestick', HistogramSeries: 'Histogram', LineSeries: 'Line', AreaSeries: 'Area',
  };
});
vi.mock('./CompeteTab', () => ({ default: () => null }));
vi.mock('./SectorTab', () => ({ default: () => null }));
vi.mock('../Research/SmartMoneyTab', () => ({ default: () => null }));
vi.mock('../Research/TechnicalTabV2', () => ({ default: () => <div data-stub="technical" /> }));
vi.mock('../Research/HoldingsTab', () => ({ default: () => null }));
vi.mock('../Research/SectorETFRanksTab', () => ({ default: () => null }));
vi.mock('../Research/MarketContextTab', () => ({ default: () => null }));
vi.mock('../Research/HealthTab', () => ({ default: () => null }));
vi.mock('../../firebase/config', () => ({ db: {}, auth: { currentUser: null }, default: {} }));
vi.mock('firebase/firestore', async (importOriginal) => ({
  ...(await importOriginal()),
  doc: (_db, ...p) => ({ path: p.join('/') }),
  getDoc: (ref) => { net.calls.push(['getDoc', ref.path]); return Promise.resolve({ exists: () => false, data: () => null }); },
}));

import { measuredSheetBattle, SHEET_NOW, RANKINGS } from '../Research/Sheet/__fixtures__/sheetBattles.js';
import { selectBombRecord } from '../Research/BombMode/selectBombRecord.js';
import { measuredLadder } from '../Research/BombMode/ladder.js';
import { rungFacts } from '../Research/BombMode/bombView.js';
import { enrichHeldPosition } from '../../screens/AgentBattleScreen.jsx';
import { buildResearchAsset } from '../../utils/researchAssetBuilder.js';
import AssetResearchModal from './AssetResearchModal';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
if (!globalThis.ResizeObserver) globalThis.ResizeObserver = class { observe() {} disconnect() {} unobserve() {} };
let BATTLE;
const oldKey = process.env.EODHD_API_KEY;
beforeAll(async () => { BATTLE = await measuredSheetBattle({ archetype: 'momentum_chaser' }); process.env.EODHD_API_KEY = 'isolated-key'; });
afterAll(() => { if (oldKey === undefined) delete process.env.EODHD_API_KEY; else process.env.EODHD_API_KEY = oldKey; });

// Wed Oct 14 2026 (EDT): the regular session 13:30Z – 20:00Z; SHEET_NOW is 17:07Z (1:07 PM ET).
const T = (hhmm) => Date.parse(`2026-10-14T${hhmm}:00.000Z`);
/** Provider bars, newest-first, every `minutes` from 13:30Z of each day up to now, plus a pre-market and an after-hours bar. */
function bars(minutes, days) {
  const out = [];
  for (const day of days) {
    for (let ms = Date.parse(`${day}T12:00:00.000Z`); ms < Date.parse(`${day}T21:00:00.000Z`); ms += minutes * 60_000) {
      if (ms > SHEET_NOW) break;
      const p = 101 + ((ms / 60_000) % 37) / 20;
      out.push({ date: new Date(ms).toISOString(), timestamp: ms / 1000, open: p, high: p + 0.2, low: p - 0.2, close: p + 0.05, volume: 100 });
    }
  }
  return out.reverse();
}
const DAILY = [
  { date: '2026-10-14', open: 101, high: 104.1, low: 100.6, close: 103.2, volume: 1 },
  { date: '2026-10-13', open: 99.4, high: 101.2, low: 99, close: 100.9, volume: 1 },
  { date: '2026-10-12', open: 98.8, high: 99.9, low: 98.1, close: 99.3, volume: 1 },
];
// The record on ONE day: the entry (its fill quote, 13:47Z), two calls and their answers, the 16:45 check.
const CALLS = [
  { callId: 'c1', symbol: 'AAPL', mintedAt: T('14:20'), playerResponse: { filedAt: T('14:31') } },
  { callId: 'c2', symbol: 'AAPL', mintedAt: T('15:10'), playerResponse: { filedAt: T('15:22') } },
];
const oneDay = () => ({ ...BATTLE, timing: { tradingDays: ['2026-10-14'] } });
const threeDay = () => ({ ...BATTLE, timing: { tradingDays: ['2026-10-14', '2026-10-15', '2026-10-16'] } });

let container, root;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
  vi.setSystemTime(new Date(SHEET_NOW));
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  net.calls.length = 0; net.daily = DAILY; net.fallback = false;
  net.intraday = (tf) => bars(tf === '5m' ? 5 : 30, ['2026-10-12', '2026-10-13', '2026-10-14']);
  rec.lines.length = 0; rec.markers.length = 0; rec.clicks = [];
  Element.prototype.scrollIntoView = vi.fn();
  vi.spyOn(console, 'log').mockImplementation(() => {}); vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.useRealTimers(); });
const flush = async () => { for (let i = 0; i < 8; i++) await act(async () => { await vi.advanceTimersByTimeAsync(0); }); };
const $ = (sel) => document.body.querySelector(sel);
const $$ = (sel) => [...document.body.querySelectorAll(sel)];
const click = async (el) => { expect(el).toBeTruthy(); await act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); }); await flush(); };
const shellPill = (v) => $(`[data-shell-pill="${v}"]`);
const chartPill = (k) => $(`[data-chart-pill="${k}"]`);
const activePill = () => ['1D', '1W', 'battle'].find((k) => chartPill(k)?.style.background === 'rgba(0, 217, 255, 0.2)') ?? null;
const intradayAsks = () => net.calls.filter((c) => c[0] === 'history' && (c[2] === '5m' || c[2] === '30m'));
const lastMarkers = () => rec.markers.at(-1) ?? [];

const heldAsset = () => buildResearchAsset(enrichHeldPosition(BATTLE.portfolio.star[0], 'star', { stockBattle: BATTLE, stockSide: 'agent', stockSlot: 0 }), { livePrices: { AAPL: 103.2 }, thresholds: { AAPL: { threshold: 2.5 } }, startingPrices: { AAPL: 100.75 }, useDefaultThreshold: true });
const ctx = (battle) => ({ battleId: 'stock-battle', agentId: 'agent', archetype: 'momentum_chaser', agentName: 'Juno', row: { held: true, positionId: 'position-agent' }, battle, calls: CALLS, rankings: RANKINGS, standing: { player: 62, opponent: 68, digits: 0 }, directive: battle.directive });
const open = async (battle = oneDay()) => {
  await act(async () => { root.render(<AssetResearchModal asset={heldAsset()} onClose={() => {}} showActionButton={false} isGameContext version={2} defaultTab="fundamental" wsPrice={103.2} sheetContext={ctx(battle)} bombContext={{ kind: 'agent', battleId: 'stock-battle', held: true, record: selectBombRecord(battle, 'AAPL', SHEET_NOW) }} />); });
  await flush();
};

describe('BC2-1 / BC2-2 — the Battle pill, loaded on its tap, the bar size by the battle\'s length', () => {
  it('opening the modal and the Chart view sends no intraday request; the chart shows 1D · 1W · Battle, on 1D', async () => {
    await open();
    await click(shellPill('chart'));
    expect(intradayAsks()).toEqual([]);
    expect($$('[data-chart-pill]').map((b) => b.dataset.chartPill)).toEqual(['1D', '1W', 'battle']);
    expect(chartPill('battle').textContent).toBe('Battle');
    expect(activePill()).toBe('1D');
  });
  it('a one-day battle: one 5-minute request (5 days) on the tap; back to 1D and to Battle again asks nothing more', async () => {
    await open();
    await click(shellPill('chart'));
    await click(chartPill('battle'));
    expect(intradayAsks()).toEqual([['history', 'AAPL', '5m', { days: 5 }]]);
    expect(activePill()).toBe('battle');
    await click(chartPill('1D'));
    await click(chartPill('battle'));
    expect(intradayAsks()).toHaveLength(1);
  });
  it('a three-day battle: 30-minute bars, the 💣 series\' own request (20 days)', async () => {
    await open(threeDay());
    await click(shellPill('chart'));
    await click(chartPill('battle'));
    expect(intradayAsks()).toEqual([['history', 'AAPL', '30m', { days: 20 }]]);
  });
  it('a daily fallback from the server is refused (its bars would stack the record again): unavailable, with Retry', async () => {
    net.fallback = true;
    await open();
    await click(shellPill('chart'));
    await click(chartPill('battle'));
    expect($('[data-shell-chart-state]').dataset.shellChartState).toBe('battle-error');
    expect($('[data-battle-retry]')).toBeTruthy();
  });
  it('a battle that names no sessions: no Battle pill (today\'s two)', async () => {
    await open(BATTLE);
    await click(shellPill('chart'));
    expect($('[data-chart-pill]')).toBeNull();
  });
});

describe('BC2-3 — the record\'s markers by time', () => {
  it('six markers on one day: six bars on Battle, one counted marker on 1D (with its chip)', async () => {
    await open();
    await click(shellPill('chart'));
    // 1D: one marker for Wed, its caption the count.
    expect(lastMarkers()).toHaveLength(1);
    expect(lastMarkers()[0].id).toBe('day:2026-10-14');
    expect($('[data-pin-caption]').dataset.pinCaption).toBe('day:2026-10-14');
    expect($('[data-pin-caption]').textContent).toBe('● Wed · 6');
    expect($('[data-record-day="2026-10-14"]').textContent).toBe('6 on Wed · Battle ›');
    await click(chartPill('battle'));
    const times = lastMarkers().map((m) => m.time);
    expect(times).toHaveLength(6);
    expect(new Set(times).size).toBe(6);
    // Each on the bar that holds its instant: 9:47 → the 9:45 bar, 10:20, 10:31 → 10:30, 11:10, 11:22 → 11:20, 12:45.
    expect(times).toEqual(['13:45', '14:20', '14:30', '15:10', '15:20', '16:45'].map((h) => T(h) / 1000));
  });
  it('the 1D chip opens Battle; so does a tap on the counted marker itself (the library\'s hit test)', async () => {
    await open();
    await click(shellPill('chart'));
    await click($('[data-record-day="2026-10-14"]'));
    expect(activePill()).toBe('battle');
    await click(chartPill('1D'));
    expect(activePill()).toBe('1D');
    await act(async () => { for (const fn of rec.clicks) fn({ hoveredObjectId: 'day:2026-10-14' }); });
    await flush();
    expect(activePill()).toBe('battle');
  });
});

describe('BC2-4 — see on chart', () => {
  it('a timed item (the lock, at the check) opens Battle; a price item (the downside) keeps the current pill', async () => {
    await open();
    await click($('[data-sheet-question="take_profit"]'));
    const see = (kind) => $(`[data-pack-item="${kind}"] [data-pack-see]`);
    await click(see('lock_now'));
    expect($('[data-shell-view]').dataset.shellView).toBe('chart');
    expect(activePill()).toBe('battle');
    await click(shellPill('analysis'));
    await click(see('rung_down'));
    expect(activePill()).toBe('battle');
    // Opening the Chart view on its own starts on 1D, never on Battle.
    await click(shellPill('analysis'));
    await click(shellPill('chart'));
    expect(activePill()).toBe('1D');
    await click(shellPill('analysis'));
    await click(see('rung_down'));
    expect(activePill()).toBe('1D');
  });
});

describe('BC2-5 — the next rung each way on Battle, at 💣\'s strings', () => {
  it('the two rung lines\' prices are 💣\'s displayed prices (rungFacts), labelled; none on 1D', async () => {
    await open();
    await click(shellPill('chart'));
    const rungTitles = () => rec.lines.map((l) => l.title).filter((t) => /next rung|Bust/.test(t ?? ''));
    expect(rungTitles()).toEqual([]);
    await click(chartPill('battle'));
    const ladder = measuredLadder({ measured: selectBombRecord(oneDay(), 'AAPL', SHEET_NOW).measured });
    const up = rungFacts(ladder, ladder.next, 2);
    const down = rungFacts(ladder, ladder.nextDown, 2);
    const drawn = rec.lines.slice(-6);
    expect(drawn.find((l) => l.title === `next rung +30 · ${up.priceText}`)?.price).toBe(up.shown);
    expect(drawn.find((l) => l.title === `Bust −10 · ${down.priceText}`)?.price).toBe(down.shown);
    expect(up.priceText).toBe('$103.78');
    expect(down.priceText).toBe('$98.73');
  });
});
