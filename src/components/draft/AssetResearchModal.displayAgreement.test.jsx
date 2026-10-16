// @vitest-environment jsdom
//
// Research modal follow-up, at modal level (build report
// docs/audits/20261015_BUILD_RESEARCH_MODAL_F3_FOLLOWUP.md):
//   D-2  on the 1W/1M chart, turning the S/R toggle on asks for the daily
//        series the levels are computed from — the same single request the
//        Technical tab makes — so the toggle draws the daily levels instead of
//        nothing. The toggle's state is private to StockChart, so the modal
//        notices the click on its pill; these rows click the REAL pill.
//   D-1  the chart's S/R lines and its highlighted level are sided from the
//        same shown price as the Technical tab's rows (BUILD_RULES §9).
//   D-4  the tab's "Today" is matched against the session date the modal
//        passes (ET for stocks, UTC for crypto).
//
// The REAL modal, hook, chart and Technical tab (lightweight-charts mocked —
// jsdom cannot paint — recording the price lines the chart draws). Stubbed: the
// network, the company profile, the sector summary, the dormant WebSocket
// daily high/low, the drawer's other heavy tabs, and detectLevels (so a row
// can place a level between the close and the shown price).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

const NOW = Date.parse('2026-10-15T17:00:00.000Z'); // Thu 1:00 PM ET
const DAY_MS = 24 * 60 * 60 * 1000;
const BASE = { AAPL: 200, MSFT: 400, BTC: 60000 };

const net = vi.hoisted(() => ({ calls: [], now: 0, lastBar: '' }));
/** Daily bars for `days` calendar days back from net.now, up to net.lastBar, newest-first (stocks: weekdays). */
function serverDaily(days, base, crypto) {
  const from = new Date(net.now - days * DAY_MS).toISOString().slice(0, 10);
  const out = [];
  const d = new Date(`${net.lastBar}T00:00:00Z`);
  while (d.toISOString().slice(0, 10) >= from) {
    const day = d.getUTCDay();
    if (crypto || (day !== 0 && day !== 6)) {
      const close = out.length % 2 ? base - 0.5 : base + 0.5;
      out.push({ date: d.toISOString().slice(0, 10), open: close - 0.5, high: close + 1.5, low: close - 1.5, close, volume: 1e6 });
    }
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return out;
}
vi.mock('../../services/eodhdAPI', () => ({
  fetchHistoricalOHLCV: (symbol, timeframe, opts) => {
    net.calls.push(['fetchHistoricalOHLCV', symbol, timeframe, opts ?? null]);
    if (timeframe === '1d') return Promise.resolve(serverDaily(opts?.days ?? 180, BASE[symbol], opts?.type === 'crypto'));
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
const lv = vi.hoisted(() => ({ levels: null }));
vi.mock('../../services/levelDetection', () => ({ detectLevels: () => lv.levels, default: () => lv.levels }));
vi.mock('../../services/fundamentalsService', () => ({ getCompanyProfile: () => Promise.resolve(null) }));
vi.mock('../../services/sectorDataService', () => ({ getQuickSectorSummary: () => Promise.resolve(null) }));
vi.mock('../../services/websocketService', () => ({ getDailyHL: () => null }));
// Every price line the chart creates (`priceLines`, prices only) and the ones
// currently drawn (`live`, with their options) — a removed line, series or
// chart takes its lines with it.
const chart = vi.hoisted(() => ({ priceLines: [], live: new Set() }));
vi.mock('lightweight-charts', () => {
  const series = () => {
    const own = new Set();
    return {
      own,
      setData() {},
      createPriceLine(opts) {
        chart.priceLines.push(opts.price);
        const line = { opts, applyOptions() {} };
        own.add(line);
        chart.live.add(line);
        return line;
      },
      removePriceLine(line) { own.delete(line); chart.live.delete(line); },
      setMarkers() {},
      priceScale() { return { applyOptions() {} }; },
      applyOptions() {},
    };
  };
  const drop = (s) => { for (const line of s.own) chart.live.delete(line); s.own.clear(); };
  return {
    createChart: () => {
      const all = [];
      return {
        addSeries: () => { const s = series(); all.push(s); return s; },
        removeSeries(s) { drop(s); },
        subscribeCrosshairMove() {},
        timeScale() { return { applyOptions() {}, fitContent() {}, scrollToRealTime() {}, setVisibleLogicalRange() {}, getVisibleLogicalRange() { return null; } }; },
        applyOptions() {},
        remove() { all.forEach(drop); },
      };
    },
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

const LEVELS_AROUND_200 = {
  support: [{ price: 198, strength: 'MODERATE', factors: [], distanceFromCurrent: '-1.00' }],
  resistance: [{ price: 202, strength: 'MODERATE', factors: [], distanceFromCurrent: '1.00' }],
  currentPrice: 200,
};
// detectLevels sided these from a newest daily close of $485.05.
const CLOSE_LEVELS = {
  support: [
    { price: 480.0, strength: 'MODERATE', factors: [], distanceFromCurrent: '-1.04' },
    { price: 470.62, strength: 'STRONG', factors: [], distanceFromCurrent: '-2.97' },
  ],
  resistance: [{ price: 490.0, strength: 'WEAK', factors: [], distanceFromCurrent: '1.02' }],
  currentPrice: 485.05,
};
const SR_RESISTANCE = 'rgba(255, 71, 87, 0.5)';
const SR_SUPPORT = 'rgba(0, 255, 136, 0.5)';

let container;
let root;
function setNow(ms, lastBar) {
  net.now = ms;
  net.lastBar = lastBar;
  vi.setSystemTime(new Date(ms));
}
beforeEach(() => {
  vi.useFakeTimers();
  setNow(NOW, '2026-10-14');
  net.calls.length = 0;
  chart.priceLines.length = 0;
  chart.live.clear();
  lv.levels = LEVELS_AROUND_200;
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
async function mount(timeframe, props = {}) {
  await act(async () => {
    root.render(<AssetResearchModal onClose={() => {}} asset={{ symbol: 'AAPL', name: 'AAPL', price: 200 }}
      version={2} showActionButton={false} isGameContext defaultTab="baggerbomb" defaultTimeframe={timeframe} {...props} />);
  });
  await flush();
}
const button = (text) => [...document.body.querySelectorAll('button')].find((b) => b.textContent.trim() === text);
async function click(el) {
  await act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  await flush();
}
const openTab = (t) => click(document.body.querySelector(`[data-test-tab="${t}"]`));
const historyCalls = () => net.calls.filter((c) => c[0] === 'fetchHistoricalOHLCV');
const quoteCalls = () => net.calls.filter((c) => c[0] === 'getStockPrice');
const daily400 = (symbol) => ['fetchHistoricalOHLCV', symbol, '1d', { days: 400 }];
const OPEN_1W = [
  ['fetchHistoricalOHLCV', 'AAPL', '1w', null],
  ['fetchHistoricalOHLCV', 'AAPL', '1d', { days: 5 }],
];
/** The chart's dashed S/R lines now drawn, [price, color], highest first. */
const srLines = () => [...chart.live].filter((l) => l.opts.lineStyle === 2)
  .map((l) => [l.opts.price, l.opts.color]).sort((a, b) => b[0] - a[0]);
/** The chart's solid highlight line now drawn, [price, color]. */
const highlightLines = () => [...chart.live].filter((l) => l.opts.lineStyle === 0 && l.opts.lineWidth === 2)
  .map((l) => [l.opts.price, l.opts.color]);
/** The Technical tab's level row whose price reads `text`. */
const levelRow = (text) => [...document.body.querySelectorAll('div')]
  .find((d) => d.style.cursor === 'pointer' && d.querySelector('span')?.textContent === text);
/** The Technical tab's first volume bar label. */
function firstVolumeLabel() {
  const grid = [...document.body.querySelectorAll('div')].find((d) => d.style.display === 'grid');
  return grid.firstElementChild.firstElementChild.textContent;
}

describe('D-2 — the chart\'s S/R pill asks for the daily levels', () => {
  it('1W: S/R on → one daily request and the chart draws its levels; then the Technical tab → no second request', async () => {
    await mount('1W');
    expect(historyCalls()).toEqual(OPEN_1W);
    expect(chart.priceLines).toEqual([]); // nothing drawn yet
    await click(button('S/R'));
    expect(historyCalls()).toEqual([...OPEN_1W, daily400('AAPL')]);
    expect(srLines().length).toBeGreaterThan(0); // the daily levels, drawn
    await openTab('technical');
    await openTab('baggerbomb');
    await openTab('technical');
    expect(historyCalls()).toEqual([...OPEN_1W, daily400('AAPL')]);
  });

  it('1W: a second S/R click, and the SMA pill, ask for nothing more', async () => {
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
    expect(srLines().length).toBeGreaterThan(0);
  });

  it('a new symbol starts with S/R off: no daily request for it until its own pill is clicked', async () => {
    await mount('1W');
    await click(button('S/R'));
    await openTab('compete');
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

  it('controlled (held) view on 1W: S/R asks for the daily series once, and never for a quote', async () => {
    const contract = { posKey: 'player:star:0', symbol: 'AAPL', price: 200, extremes: null };
    await mount('1W', { controlledQuote: contract });
    expect(historyCalls()).toEqual(OPEN_1W);
    await click(button('S/R'));
    await act(async () => { await vi.advanceTimersByTimeAsync(5 * 60 * 1000); });
    expect(historyCalls()).toEqual([...OPEN_1W, daily400('AAPL')]);
    expect(quoteCalls()).toEqual([]);
  });
});

describe('D-1 — the chart and the tab side a level from the same shown price', () => {
  it('close $485.05, shown $475.60: $480 is resistance on the chart\'s S/R line, in the tab, and on the tapped highlight', async () => {
    lv.levels = CLOSE_LEVELS;
    await mount('1D', { asset: { symbol: 'AAPL', name: 'AAPL', price: 475.6 } });
    await click(button('S/R'));
    expect(srLines()).toEqual([[490, SR_RESISTANCE], [480, SR_RESISTANCE], [470.62, SR_SUPPORT]]);
    await openTab('technical');
    expect(levelRow('$480.00').querySelector('span').style.color).toBe('rgb(255, 71, 87)'); // the tab's resistance red
    await click(levelRow('$480.00'));
    expect(highlightLines()).toEqual([[480, '#ff4757']]);
  });

  it('controlled: when the qualified price moves above $480, the line and the highlight turn support', async () => {
    lv.levels = CLOSE_LEVELS;
    const asset = { symbol: 'AAPL', name: 'AAPL', price: 475.6 };
    const contract = { posKey: 'player:star:0', symbol: 'AAPL', price: 475.6, extremes: null };
    await mount('1D', { asset, controlledQuote: contract });
    await click(button('S/R'));
    await openTab('technical');
    await click(levelRow('$480.00'));
    expect(highlightLines()).toEqual([[480, '#ff4757']]);
    await mount('1D', { asset, controlledQuote: { ...contract, price: 481 } });
    expect(srLines()).toEqual([[490, SR_RESISTANCE], [480, SR_SUPPORT], [470.62, SR_SUPPORT]]);
    expect(highlightLines()).toHaveLength(1);
    expect(highlightLines()[0][1]).not.toBe('#ff4757');
  });
});

describe('D-4 — the modal passes the tab the session date (ET stocks, UTC crypto)', () => {
  it('stock after the close, with today\'s bar in: "Today"', async () => {
    setNow(Date.parse('2026-10-15T21:00:00.000Z'), '2026-10-15'); // 5 PM ET
    await mount('1D');
    await openTab('technical');
    expect(firstVolumeLabel()).toBe('Today');
  });

  it('crypto at 9 PM ET: the UTC day has turned, and its bar is "Today" (an ET date would call it "Last session · Oct 16")', async () => {
    setNow(Date.parse('2026-10-16T01:00:00.000Z'), '2026-10-16');
    await mount('1D', { asset: { symbol: 'BTC', name: 'Bitcoin', price: 60000, isCrypto: true } });
    await openTab('technical');
    expect(firstVolumeLabel()).toBe('Today');
  });
});
