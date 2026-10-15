// @vitest-environment jsdom
//
// Research modal follow-up, D-2 (build report
// docs/audits/20261015_BUILD_RESEARCH_MODAL_F3_FOLLOWUP.md): on the 1W/1M
// chart, turning the S/R toggle on asks for the daily series the levels are
// computed from — the same single request the Technical tab makes — so the
// toggle draws the daily levels instead of nothing. The toggle's state is
// private to StockChart, so the modal notices the click on its pill; these
// rows click the REAL pill in the REAL chart.
//
// The REAL modal, hook and chart (lightweight-charts mocked — jsdom cannot
// paint — recording the price lines the chart draws). Stubbed: the network,
// the company profile, the dormant WebSocket daily high/low, and the drawer's
// heavy tabs.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

const NOW = Date.parse('2026-10-15T17:00:00.000Z'); // Thu 1:00 PM ET
const DAY_MS = 24 * 60 * 60 * 1000;

/** Weekday daily bars for `days` calendar days back from NOW, up to yesterday, newest-first. */
function serverDaily(days, base) {
  const from = new Date(NOW - days * DAY_MS).toISOString().slice(0, 10);
  const out = [];
  const d = new Date('2026-10-14T00:00:00Z');
  while (d.toISOString().slice(0, 10) >= from) {
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) {
      const close = out.length % 2 ? base - 0.5 : base + 0.5;
      out.push({ date: d.toISOString().slice(0, 10), open: close - 0.5, high: close + 1.5, low: close - 1.5, close, volume: 1e6 });
    }
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return out;
}
const BASE = { AAPL: 200, MSFT: 400 };

const net = vi.hoisted(() => ({ calls: [] }));
vi.mock('../../services/eodhdAPI', () => ({
  fetchHistoricalOHLCV: (symbol, timeframe, opts) => {
    net.calls.push(['fetchHistoricalOHLCV', symbol, timeframe, opts ?? null]);
    if (timeframe === '1d') return Promise.resolve(serverDaily(opts?.days ?? 180, BASE[symbol]));
    if (timeframe === '1w') {
      const b = BASE[symbol];
      return Promise.resolve([
        { date: '2026-10-12', open: b - 1, high: b + 2, low: b - 2, close: b, volume: 5e6 },
        { date: '2026-10-05', open: b, high: b + 2, low: b - 3, close: b - 1, volume: 5e6 },
      ]);
    }
    return Promise.resolve([]);
  },
  getStockPrice: (symbol) => {
    net.calls.push(['getStockPrice', symbol]);
    return Promise.resolve({ symbol, price: 0 });
  },
}));
vi.mock('../../services/fundamentalsService', () => ({ getCompanyProfile: () => Promise.resolve(null) }));
vi.mock('../../services/websocketService', () => ({ getDailyHL: () => null }));
const chart = vi.hoisted(() => ({ priceLines: [] }));
vi.mock('lightweight-charts', () => {
  const series = () => ({
    setData() {},
    createPriceLine(opts) { chart.priceLines.push(opts.price); return { applyOptions() {} }; },
    removePriceLine() {},
    setMarkers() {},
    priceScale() { return { applyOptions() {} }; },
    applyOptions() {},
  });
  return {
    createChart: () => ({
      addSeries: () => series(),
      removeSeries() {},
      subscribeCrosshairMove() {},
      timeScale() { return { applyOptions() {}, fitContent() {}, scrollToRealTime() {}, setVisibleLogicalRange() {}, getVisibleLogicalRange() { return null; } }; },
      applyOptions() {},
      remove() {},
    }),
    CandlestickSeries: 'Candlestick', HistogramSeries: 'Histogram', LineSeries: 'Line', AreaSeries: 'Area',
  };
});
const tabs = vi.hoisted(() => ({ navigate: null }));
vi.mock('../Research/AnalysisDrawer', () => ({
  default: ({ children, setActiveTab }) => (
    <div data-test-drawer="1">
      {['baggerbomb', 'technical', 'compete'].map((t) => (
        <button key={t} type="button" data-test-tab={t} onClick={() => setActiveTab(t)}>{t}</button>
      ))}
      {children}
    </div>
  ),
}));
vi.mock('./ResearchTabs/BaggerBombTab', () => ({ default: () => null }));
vi.mock('./CompeteTab', () => ({
  default: ({ onNavigateToStock }) => { tabs.navigate = onNavigateToStock; return null; },
}));
vi.mock('../Research/AnalysisQATab', () => ({ default: () => null }));
vi.mock('../Research/TechnicalTabV2', () => ({ default: () => null }));
vi.mock('../Research/HealthTab', () => ({ default: () => null }));
vi.mock('./ResearchTabs/TechnicalAnalysisTab', () => ({ default: () => null }));
vi.mock('./SectorTab', () => ({ default: () => null }));
vi.mock('../Research/MarketContextTab', () => ({ default: () => null }));
vi.mock('../Research/HoldingsTab', () => ({ default: () => null }));
vi.mock('../Research/SectorETFRanksTab', () => ({ default: () => null }));
vi.mock('../Research/SmartMoneyTab', () => ({ default: () => null }));
vi.mock('../../firebase/config', () => ({ db: {}, auth: { currentUser: null }, default: {} }));

import AssetResearchModal from './AssetResearchModal';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class { observe() {} disconnect() {} unobserve() {} };
}

let container;
let root;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(NOW));
  net.calls.length = 0;
  chart.priceLines.length = 0;
  tabs.navigate = null;
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const flush = async () => {
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
};
async function mount(timeframe) {
  await act(async () => {
    root.render(<AssetResearchModal onClose={() => {}} asset={{ symbol: 'AAPL', name: 'AAPL', price: 200 }}
      version={2} showActionButton={false} isGameContext defaultTab="baggerbomb" defaultTimeframe={timeframe} />);
  });
  await flush();
}
const button = (text) => [...document.body.querySelectorAll('button')].find((b) => b.textContent.trim() === text);
async function click(el) {
  await act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  await flush();
}
const historyCalls = () => net.calls.filter((c) => c[0] === 'fetchHistoricalOHLCV');
const daily400 = (symbol) => ['fetchHistoricalOHLCV', symbol, '1d', { days: 400 }];
const OPEN_1W = [
  ['fetchHistoricalOHLCV', 'AAPL', '1w', null],
  ['fetchHistoricalOHLCV', 'AAPL', '1d', { days: 5 }],
];

describe('D-2 — the chart\'s S/R pill asks for the daily levels', () => {
  it('1W: S/R on → one daily request and the chart draws its levels; then the Technical tab → no second request', async () => {
    await mount('1W');
    expect(historyCalls()).toEqual(OPEN_1W);
    expect(chart.priceLines).toEqual([]); // nothing drawn yet
    await click(button('S/R'));
    expect(historyCalls()).toEqual([...OPEN_1W, daily400('AAPL')]);
    expect(chart.priceLines.length).toBeGreaterThan(0); // the daily levels, drawn
    await click(document.body.querySelector('[data-test-tab="technical"]'));
    await click(document.body.querySelector('[data-test-tab="baggerbomb"]'));
    await click(document.body.querySelector('[data-test-tab="technical"]'));
    expect(historyCalls()).toEqual([...OPEN_1W, daily400('AAPL')]);
  });

  it('1W: S/R off again, and the SMA pill, ask for nothing more', async () => {
    await mount('1W');
    await click(button('SMA'));
    expect(historyCalls()).toEqual(OPEN_1W);
    await click(button('S/R'));
    await click(button('S/R'));
    expect(historyCalls()).toEqual([...OPEN_1W, daily400('AAPL')]);
  });

  it('1D: S/R adds nothing — the chart\'s own daily series serves', async () => {
    await mount('1D');
    expect(historyCalls()).toEqual([daily400('AAPL')]);
    await click(button('S/R'));
    expect(historyCalls()).toEqual([daily400('AAPL')]);
    expect(chart.priceLines.length).toBeGreaterThan(0);
  });

  it('a new symbol starts with S/R off: no daily request for it until its own pill is clicked', async () => {
    await mount('1W');
    await click(button('S/R'));
    await click(document.body.querySelector('[data-test-tab="compete"]'));
    await act(async () => { tabs.navigate('MSFT', 'MSFT'); });
    await flush();
    const msft = () => historyCalls().filter((c) => c[1] === 'MSFT');
    expect(msft()).toEqual([
      ['fetchHistoricalOHLCV', 'MSFT', '1w', null],
      ['fetchHistoricalOHLCV', 'MSFT', '1d', { days: 5 }],
    ]);
    await click(button('S/R'));
    expect(msft()).toEqual([
      ['fetchHistoricalOHLCV', 'MSFT', '1w', null],
      ['fetchHistoricalOHLCV', 'MSFT', '1d', { days: 5 }],
      daily400('MSFT'),
    ]);
  });
});
