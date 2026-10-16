// @vitest-environment jsdom
//
// Research modal wiring follow-up, at modal level (build report
// docs/audits/20261015_BUILD_RESEARCH_MODAL_WIRING.md):
//   W-1  the chart reports its S/R pill through onToggleSR, so the modal's
//        request follows the pill's real state: after a failed daily request,
//        S/R off and on retries; closing the Technical tab asks nothing; with
//        S/R off, a view switch, A→B→A or a remounted chart asks nothing.
//   W-2  in the default (legacy) modal the header price, "Current", the level
//        distances and sides and the chart's S/R colors follow the live price
//        (wsPrice); the held (controlled) view keeps the accepted observation.
//   W-3  the header price and the chart's price format are per asset.
//   W-5  a tapped level is cleared on a symbol change, before the new chart
//        mounts.
//
// The REAL modal, hook, chart, header and Technical tab (lightweight-charts
// mocked — jsdom cannot paint — recording each series' options and the price
// lines drawn on it). Stubbed: the network (with one-shot failures), the
// company profile, the sector summary, the dormant WebSocket daily high/low,
// the drawer's other heavy tabs, and detectLevels (so a row places its levels).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

const NOW = Date.parse('2026-10-15T17:00:00.000Z'); // Thu 1:00 PM ET
const DAY_MS = 24 * 60 * 60 * 1000;
const BASE = { AAPL: 200, MSFT: 400, DOGE: 0.2, SHIB: 0.0000123, FALL: 0.5 };

const net = vi.hoisted(() => ({ calls: [], fail: new Map(), holdQuote: false }));
/** Daily bars for `days` calendar days back from NOW, up to Oct 14, newest-first (stocks: weekdays). */
function serverDaily(days, base, crypto) {
  const from = new Date(NOW - days * DAY_MS).toISOString().slice(0, 10);
  const out = [];
  const d = new Date('2026-10-14T00:00:00Z');
  while (d.toISOString().slice(0, 10) >= from) {
    const day = d.getUTCDay();
    if (crypto || (day !== 0 && day !== 6)) {
      const close = base * (out.length % 2 ? 0.9975 : 1.0025);
      out.push({ date: d.toISOString().slice(0, 10), open: close, high: close * 1.01, low: close * 0.99, close, volume: 1e6 });
    }
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return out;
}
/** A coin that fell through $1: every day back to `days` ago, newest-first, closing at 0.50 + 0.01 per day back. */
function fallingDaily(days) {
  const out = [];
  const d = new Date('2026-10-14T00:00:00Z');
  for (let i = 0; i <= days; i++) {
    const close = 0.5 + 0.01 * i;
    out.push({ date: d.toISOString().slice(0, 10), open: close, high: close * 1.01, low: close * 0.99, close, volume: 1e6 });
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return out;
}
/** Today's half-hour bars, 9:30 AM to 12:30 PM ET, newest-first. */
function intradayBars(base) {
  const out = [];
  for (let t = Date.parse('2026-10-15T13:30:00.000Z'); t <= Date.parse('2026-10-15T16:30:00.000Z'); t += 30 * 60 * 1000) {
    const iso = new Date(t).toISOString();
    out.push({ date: iso, datetime: iso, timestamp: t / 1000, open: base, high: base * 1.002, low: base * 0.998, close: base, volume: 100 });
  }
  return out.reverse();
}
vi.mock('../../services/eodhdAPI', () => ({
  fetchHistoricalOHLCV: (symbol, timeframe, opts) => {
    net.calls.push(['fetchHistoricalOHLCV', symbol, timeframe, opts ?? null]);
    const key = `${symbol}_${timeframe}_${opts?.days ?? ''}`;
    const left = net.fail.get(key) || 0;
    if (left > 0) {
      net.fail.set(key, left - 1);
      return Promise.reject(new Error('Proxy error: 500'));
    }
    const b = BASE[symbol];
    if (timeframe === '1d') return Promise.resolve(symbol === 'FALL' ? fallingDaily(opts?.days ?? 180) : serverDaily(opts?.days ?? 180, b, opts?.type === 'crypto'));
    if (timeframe === '1w') {
      return Promise.resolve([
        { date: '2026-10-12', open: b, high: b * 1.01, low: b * 0.99, close: b, volume: 5e6 },
        { date: '2026-10-05', open: b, high: b * 1.01, low: b * 0.98, close: b, volume: 5e6 },
      ]);
    }
    if (timeframe === '30m') return Promise.resolve(intradayBars(b));
    return Promise.resolve([]);
  },
  getStockPrice: (symbol) => {
    net.calls.push(['getStockPrice', symbol]);
    if (net.holdQuote) return new Promise(() => {});
    return Promise.resolve({ symbol, price: 0 });
  },
}));
const lv = vi.hoisted(() => ({ levels: null }));
vi.mock('../../services/levelDetection', () => ({ detectLevels: () => lv.levels, default: () => lv.levels }));
vi.mock('../../services/fundamentalsService', () => ({ getCompanyProfile: () => Promise.resolve(null) }));
vi.mock('../../services/sectorDataService', () => ({ getQuickSectorSummary: () => Promise.resolve(null) }));
vi.mock('../../services/websocketService', () => ({ getDailyHL: () => null }));
// Every series the chart adds (`series`: type and options) and every price
// line created (`created`) or now drawn (`live`), each with its series — a
// removed series or chart takes its lines with it.
const chart = vi.hoisted(() => ({ series: [], created: [], live: new Set() }));
vi.mock('lightweight-charts', () => {
  const series = (type, opts) => {
    const own = new Set();
    const s = {
      type, opts, own,
      setData() {},
      createPriceLine(o) {
        const line = { opts: o, series: s, applyOptions() {} };
        chart.created.push(line);
        own.add(line);
        chart.live.add(line);
        return line;
      },
      removePriceLine(line) { own.delete(line); chart.live.delete(line); },
      setMarkers() {},
      priceScale() { return { applyOptions() {} }; },
      applyOptions() {},
    };
    chart.series.push(s);
    return s;
  };
  const drop = (s) => { for (const line of s.own) chart.live.delete(line); s.own.clear(); };
  return {
    createChart: () => {
      const all = [];
      return {
        addSeries: (type, opts) => { const s = series(type, opts); all.push(s); return s; },
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
import StockChart from '../Research/StockChart';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class { observe() {} disconnect() {} unobserve() {} };
}

const level = (price, strength = 'MODERATE') => ({ price, strength, factors: [], distanceFromCurrent: '0' });
const LEVELS_AROUND_200 = { support: [level(198)], resistance: [level(202)], currentPrice: 200 };
const SR_RESISTANCE = 'rgba(255, 71, 87, 0.5)';
const SR_SUPPORT = 'rgba(0, 255, 136, 0.5)';
const AAPL = { symbol: 'AAPL', name: 'AAPL', price: 200 };

let container;
let root;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(NOW));
  net.calls.length = 0;
  net.fail.clear();
  net.holdQuote = false;
  chart.series.length = 0;
  chart.created.length = 0;
  chart.live.clear();
  lv.levels = LEVELS_AROUND_200;
  tabs.navigate = null;
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
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
    root.render(<AssetResearchModal onClose={() => {}} asset={AAPL}
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
async function navigateTo(symbol) {
  await openTab('compete');
  await act(async () => { tabs.navigate(symbol, symbol); });
  await flush();
}
const daily400 = (symbol) => ['fetchHistoricalOHLCV', symbol, '1d', { days: 400 }];
const dailyRequests = (symbol) => net.calls.filter((c) => c[0] === 'fetchHistoricalOHLCV' && c[1] === symbol && c[2] === '1d' && c[3]?.days === 400);
const quoteCalls = () => net.calls.filter((c) => c[0] === 'getStockPrice');
/** The chart's dashed S/R lines now drawn, [price, color], highest first. */
const srLines = () => [...chart.live].filter((l) => l.opts.lineStyle === 2)
  .map((l) => [l.opts.price, l.opts.color]).sort((a, b) => b[0] - a[0]);
const isHighlight = (l) => l.opts.lineStyle === 0 && l.opts.lineWidth === 2;
/** The chart's solid highlight line now drawn, [price, color]. */
const highlightLines = () => [...chart.live].filter(isHighlight).map((l) => [l.opts.price, l.opts.color]);
/** The Technical tab's level row whose price reads `text`. */
const levelRow = (text) => [...document.body.querySelectorAll('div')]
  .find((d) => d.style.cursor === 'pointer' && d.querySelector('span')?.textContent === text);
/** The header's price and daily-change pill, as text. */
function header() {
  const hdr = [...document.body.querySelectorAll('div')].find((d) => d.style.height === '52px');
  return [...hdr.querySelectorAll('span')].map((s) => s.textContent).filter((t) => t.startsWith('$') || t.includes('%'));
}
/** The Technical tab's "Current" price. */
const current = () => [...document.body.querySelectorAll('span')].find((s) => s.textContent === 'Current').nextElementSibling.textContent;
/** [price text, distance text, price color] of the tab's level rows, top to bottom. */
const levelRows = () => [...document.body.querySelectorAll('div')].filter((d) => d.style.cursor === 'pointer' && d.querySelector('span'))
  .map((row) => { const spans = row.querySelectorAll('span'); return [spans[0].textContent, spans[spans.length - 1].textContent, spans[0].style.color]; });
const candleSeries = () => chart.series.filter((s) => s.type === 'Candlestick');

describe('W-1 — the request follows the S/R pill the chart reports (onToggleSR)', () => {
  it('a failed daily request: S/R off, then on again → exactly one retry, and the levels draw', async () => {
    net.fail.set('AAPL_1d_400', 1);
    await mount('1W');
    await click(button('S/R'));
    expect(dailyRequests('AAPL')).toEqual([daily400('AAPL')]); // asked, and it failed
    expect(srLines()).toEqual([]);
    await click(button('S/R')); // off: nothing asked
    expect(dailyRequests('AAPL')).toHaveLength(1);
    await click(button('S/R')); // on again: the retry
    expect(dailyRequests('AAPL')).toHaveLength(2);
    expect(srLines()).toEqual([[202, SR_RESISTANCE], [198, SR_SUPPORT]]);
  });

  it('a failed daily request with S/R on: closing the Technical tab asks nothing; opening it again retries', async () => {
    net.fail.set('AAPL_1d_400', 2);
    await mount('1W');
    await click(button('S/R'));
    expect(dailyRequests('AAPL')).toHaveLength(1); // failed
    await openTab('technical');
    expect(dailyRequests('AAPL')).toHaveLength(2); // the tab opening asks again — failed again
    await openTab('baggerbomb'); // close the Technical tab, S/R still on
    expect(dailyRequests('AAPL')).toHaveLength(2);
    await openTab('technical');
    expect(dailyRequests('AAPL')).toHaveLength(3);
  });

  it('A→B→A after a failed request with S/R on: neither B nor A asks while its own S/R is off', async () => {
    net.fail.set('AAPL_1d_400', 1);
    await mount('1W');
    await click(button('S/R'));
    expect(dailyRequests('AAPL')).toHaveLength(1);
    await navigateTo('MSFT');
    expect(dailyRequests('MSFT')).toEqual([]);
    await click(button('←')); // back to AAPL
    expect(button('S/R')).toBeTruthy(); // AAPL's chart is back, S/R off
    expect(dailyRequests('AAPL')).toHaveLength(1);
    expect(dailyRequests('MSFT')).toEqual([]);
    await click(button('S/R'));
    expect(dailyRequests('AAPL')).toHaveLength(2);
  });

  it('a failed request, then S/R off: a view switch (1W → bomb → 1W) asks nothing', async () => {
    net.fail.set('AAPL_1d_400', 1);
    await mount('1W', { asset: { ...AAPL, threshold: 2.5 } });
    await click(button('S/R'));
    await click(button('S/R')); // off
    expect(dailyRequests('AAPL')).toHaveLength(1);
    await click(button('💣'));
    expect(net.calls.some((c) => c[2] === '30m')).toBe(true); // the bomb view loaded
    await click(button('1W'));
    expect(dailyRequests('AAPL')).toHaveLength(1);
  });

  it('S/R on, then the chart unmounts on a failed bomb request and remounts (S/R off): switching back to 1W asks nothing', async () => {
    net.fail.set('AAPL_1d_400', 2);
    net.fail.set('AAPL_30m_20', 1);
    await mount('1W', { asset: { ...AAPL, threshold: 2.5 } });
    await click(button('S/R'));
    expect(dailyRequests('AAPL')).toHaveLength(1);
    await click(button('💣'));
    expect(dailyRequests('AAPL')).toHaveLength(2); // S/R was still on as the view changed: it asked again (failed)
    expect(button('Retry')).toBeTruthy(); // the bomb request failed too: no chart on screen
    await click(button('Retry'));
    expect(button('1W')).toBeTruthy(); // a new chart, S/R off
    await click(button('1W'));
    expect(dailyRequests('AAPL')).toHaveLength(2);
    await click(button('S/R'));
    expect(dailyRequests('AAPL')).toHaveLength(3);
  });
});

describe('W-1 — S/R starts off for every symbol and every mounted chart, on every path', () => {
  const contract = (symbol, price) => ({ posKey: 'player:star:0', symbol, price, extremes: null });
  const MSFT = { symbol: 'MSFT', name: 'MSFT', price: 400 };

  it('the chart reports a flip only when its pill is clicked — never on mount (no effect stands in for the click)', async () => {
    const reports = [];
    const bars = [
      { date: '2026-10-05', open: 200, high: 202, low: 197, close: 199, volume: 5e6 },
      { date: '2026-10-12', open: 199, high: 202, low: 198, close: 200, volume: 5e6 },
    ];
    await act(async () => {
      root.render(<StockChart ohlcvData={bars} rawData={[...bars].reverse()} timeframe="1W" onTimeframeChange={() => {}} levels={null} symbol="AAPL" onToggleSR={(on) => reports.push(on)} />);
    });
    await flush();
    expect(reports).toEqual([]);
    await click(button('S/R'));
    await click(button('S/R'));
    expect(reports).toEqual([true, false]);
  });

  it('legacy re-open for MSFT (the asset prop changes) with S/R on for AAPL: MSFT asks nothing until its own pill', async () => {
    await mount('1W');
    await click(button('S/R'));
    expect(dailyRequests('AAPL')).toHaveLength(1);
    await mount('1W', { asset: MSFT });
    expect(button('S/R')).toBeTruthy();
    expect(dailyRequests('MSFT')).toEqual([]);
  });

  it('held (controlled) view re-opened for MSFT with S/R on for AAPL: MSFT asks nothing until its own pill', async () => {
    await mount('1W', { controlledQuote: contract('AAPL', 200) });
    await click(button('S/R'));
    expect(dailyRequests('AAPL')).toHaveLength(1);
    await mount('1W', { asset: MSFT, controlledQuote: contract('MSFT', 400) });
    expect(button('S/R')).toBeTruthy();
    expect(dailyRequests('MSFT')).toEqual([]);
  });

  it('S/R on for MSFT, then back (←) to AAPL: AAPL asks nothing (its S/R is off)', async () => {
    await mount('1W');
    await navigateTo('MSFT');
    await click(button('S/R'));
    expect(dailyRequests('MSFT')).toHaveLength(1);
    await click(button('\u2190'));
    expect(button('S/R')).toBeTruthy();
    expect(dailyRequests('AAPL')).toEqual([]);
  });

  it('the Technical tab open on MSFT, then back (←) to AAPL with the tab still open: AAPL\'s daily series is asked for', async () => {
    await mount('1W');
    await navigateTo('MSFT');
    await openTab('technical');
    expect(dailyRequests('MSFT')).toHaveLength(1);
    await click(button('\u2190'));
    expect(dailyRequests('AAPL')).toEqual([daily400('AAPL')]);
  });

  it('a failed daily request with the Technical tab open, then a view switch (1W → bomb): it asks again', async () => {
    net.fail.set('AAPL_1d_400', 1);
    await mount('1W', { asset: { ...AAPL, threshold: 2.5 }, defaultTab: 'technical' });
    expect(dailyRequests('AAPL')).toHaveLength(1);
    await click(button('\uD83D\uDCA3'));
    expect(dailyRequests('AAPL')).toHaveLength(2);
  });
});

describe('W-2 — the legacy modal\'s price is the live price, everywhere on the sheet', () => {
  const LEVELS = { support: [level(198)], resistance: [level(200.4), level(202)], currentPrice: 200 };

  it('a live price update moves the header price, "Current", the level distances and sides, and the chart\'s S/R colors together', async () => {
    lv.levels = LEVELS;
    await mount('1D', { wsPrice: 200 });
    await click(button('S/R'));
    await openTab('technical');
    expect(header()[0]).toBe('$200.00');
    expect(current()).toBe('$200.00');
    expect(levelRows().map((r) => r.slice(0, 2))).toEqual([['$202.00', '+1.00%'], ['$200.40', '+0.20%'], ['$198.00', '-1.00%']]);
    expect(srLines()).toEqual([[202, SR_RESISTANCE], [200.4, SR_RESISTANCE], [198, SR_SUPPORT]]);
    const quotesBefore = quoteCalls().length;

    await mount('1D', { wsPrice: 200.8 }); // the parent's live price moves; the asset prop does not
    expect(header()[0]).toBe('$200.80');
    expect(current()).toBe('$200.80');
    // (200.4 − 200.8) / 200.8 = −0.199 %; (198 − 200.8) / 200.8 = −1.394 %; (202 − 200.8) / 200.8 = +0.598 %
    expect(levelRows()).toEqual([
      ['$202.00', '+0.60%', 'rgb(255, 71, 87)'],
      ['$200.40', '-0.20%', 'rgb(0, 255, 136)'],
      ['$198.00', '-1.39%', 'rgb(0, 255, 136)'],
    ]);
    expect(srLines()).toEqual([[202, SR_RESISTANCE], [200.4, SR_SUPPORT], [198, SR_SUPPORT]]);
    expect(quoteCalls()).toHaveLength(quotesBefore); // no new price request
  });

  it('the tapped level\'s line follows the live price across the level', async () => {
    lv.levels = LEVELS;
    await mount('1D', { wsPrice: 200 });
    await openTab('technical');
    await click(levelRow('$200.40'));
    expect(highlightLines()).toEqual([[200.4, '#ff4757']]);
    await mount('1D', { wsPrice: 200.8 });
    expect(highlightLines()).toHaveLength(1);
    expect(highlightLines()[0][1]).not.toBe('#ff4757');
  });

  it('a live tick that moves no level across sides redraws no S/R line (200 → 200.05, under the live candle\'s throttle)', async () => {
    await mount('1D', { wsPrice: 200 });
    await click(button('S/R'));
    const srCreated = () => chart.created.filter((l) => l.opts.lineStyle === 2).length;
    expect(srCreated()).toBe(2);
    await mount('1D', { wsPrice: 200.05 });
    expect(header()[0]).toBe('$200.05');
    expect(srCreated()).toBe(2);
  });

  it('a priceless asset before its price arrives: the header reads "$—", not "$0.00"', async () => {
    net.holdQuote = true;
    await mount('1D', { asset: { symbol: 'AAPL', name: 'AAPL' } });
    expect(header()[0]).toBe('$\u2014');
  });

  it('a stock navigated to before its price arrives: the header reads "$—" (not the original asset\'s live price, not "$0.00")', async () => {
    await mount('1D', { wsPrice: 200 });
    await navigateTo('MSFT'); // its quote answers price 0: never filled
    expect(header()[0]).toBe('$\u2014');
  });

  it('the held (controlled) view keeps the accepted observation: a different wsPrice moves nothing', async () => {
    lv.levels = LEVELS;
    const contract = { posKey: 'player:star:0', symbol: 'AAPL', price: 200, extremes: null };
    await mount('1D', { controlledQuote: contract, wsPrice: 200.8 });
    await openTab('technical');
    expect(header()[0]).toBe('$200.00');
    expect(current()).toBe('$200.00');
    expect(levelRows().map((r) => r[0])).toEqual(['$202.00', '$200.40', '$198.00']);
    expect(quoteCalls()).toEqual([]);
  });
});

describe('W-3 — per-asset price format in the header and on the chart', () => {
  it('DOGE-class: the header reads "$0.2049"; the chart\'s axis (and the tapped line\'s label on it) gets 4 decimals', async () => {
    lv.levels = { support: [level(0.2001)], resistance: [level(0.2051)], currentPrice: 0.2 };
    await mount('1D', { asset: { symbol: 'DOGE', name: 'Dogecoin', price: 0.2049, isCrypto: true } });
    expect(header()[0]).toBe('$0.2049');
    const candles = candleSeries();
    expect(candles.length).toBeGreaterThan(0);
    for (const s of candles) expect(s.opts.priceFormat).toEqual({ type: 'price', precision: 4, minMove: 0.0001 });
    for (const s of chart.series.filter((x) => x.type === 'Histogram')) expect(s.opts.priceFormat).toEqual({ type: 'volume' }); // the volume series keeps its own
    await openTab('technical');
    await click(levelRow('$0.2051'));
    const [line] = [...chart.live].filter(isHighlight);
    expect(line.opts.price).toBe(0.2051);
    expect(line.series.opts.priceFormat).toEqual({ type: 'price', precision: 4, minMove: 0.0001 });
  });

  it('sub-cent: the header reads "$0.00001234" and the axis gets four significant figures (8 decimals)', async () => {
    lv.levels = { support: [level(0.0000118)], resistance: [level(0.0000129)], currentPrice: 0.0000123 };
    await mount('1D', { asset: { symbol: 'SHIB', name: 'Shiba Inu', price: 0.00001234, isCrypto: true } });
    expect(header()[0]).toBe('$0.00001234');
    const candles = candleSeries();
    expect(candles.length).toBeGreaterThan(0);
    for (const s of candles) expect(s.opts.priceFormat).toEqual({ type: 'price', precision: 8, minMove: 1e-8 });
  });

  it('the axis precision comes from the latest candle: a coin that fell through $1 (older bars above $1) gets four decimals', async () => {
    await mount('1D', { asset: { symbol: 'FALL', name: 'Fall', price: 0.5049, isCrypto: true } });
    expect(header()[0]).toBe('$0.5049');
    const candles = candleSeries();
    expect(candles.length).toBeGreaterThan(0);
    for (const s of candles) expect(s.opts.priceFormat).toEqual({ type: 'price', precision: 4, minMove: 0.0001 });
  });

  it('the bomb view\'s series keep the default format (the precision is the normal view\'s only)', async () => {
    await mount('bomb', { asset: { symbol: 'DOGE', name: 'Dogecoin', price: 0.2049, isCrypto: true, threshold: 2.5 } });
    expect(button('S/R')).toBeUndefined(); // the bomb view is up
    const candles = candleSeries();
    expect(candles.length).toBeGreaterThan(0);
    for (const s of candles) expect('priceFormat' in s.opts).toBe(false);
    for (const s of chart.series.filter((x) => x.type === 'Histogram')) expect(s.opts.priceFormat).toEqual({ type: 'volume' });
  });

  it('the held (controlled) view formats a sub-dollar asset the same way, and a different wsPrice moves nothing', async () => {
    lv.levels = { support: [level(0.2001)], resistance: [level(0.2051)], currentPrice: 0.2 };
    const asset = { symbol: 'DOGE', name: 'Dogecoin', price: 0.2049, isCrypto: true };
    await mount('1D', { asset, wsPrice: 0.25, controlledQuote: { posKey: 'player:star:0', symbol: 'DOGE', price: 0.2049, extremes: null } });
    await openTab('technical');
    expect(header()[0]).toBe('$0.2049');
    expect(current()).toBe('$0.2049');
    expect(levelRows().map((r) => r[0])).toEqual(['$0.2051', '$0.2001']);
    for (const s of candleSeries()) expect(s.opts.priceFormat).toEqual({ type: 'price', precision: 4, minMove: 0.0001 });
    expect(quoteCalls()).toEqual([]);
  });

  it('a stock: "$200.00", and the chart\'s series options are unchanged (no priceFormat — the default two decimals)', async () => {
    await mount('1D');
    expect(header()[0]).toBe('$200.00');
    const candles = candleSeries();
    expect(candles.length).toBeGreaterThan(0);
    for (const s of candles) expect('priceFormat' in s.opts).toBe(false);
  });
});

describe('W-5 — a tapped level is cleared on a symbol change, before the new chart mounts', () => {
  async function tapOnAapl() {
    await mount('1D');
    await openTab('technical');
    await click(levelRow('$202.00'));
    expect(highlightLines()).toEqual([[202, '#ff4757']]);
  }

  it('tap a level on AAPL, navigate to MSFT → no highlight, and no highlight line ever drawn for MSFT', async () => {
    await tapOnAapl();
    const mark = chart.created.length;
    await navigateTo('MSFT');
    expect(button('S/R')).toBeTruthy(); // MSFT's chart is up
    expect(highlightLines()).toEqual([]);
    expect(chart.created.slice(mark).filter(isHighlight)).toEqual([]);
  });

  it('tap a level on MSFT, then back (←) to AAPL: MSFT\'s tap is not drawn on AAPL\'s chart', async () => {
    await mount('1D');
    lv.levels = { support: [level(398)], resistance: [level(402)], currentPrice: 400 };
    await navigateTo('MSFT');
    await openTab('technical');
    await click(levelRow('$402.00'));
    expect(highlightLines()).toEqual([[402, '#ff4757']]);
    const mark = chart.created.length;
    await click(button('\u2190'));
    expect(button('S/R')).toBeTruthy();
    expect(highlightLines()).toEqual([]);
    expect(chart.created.slice(mark).filter(isHighlight)).toEqual([]);
  });

  it('legacy re-open for another symbol (the asset prop changes): the tap is cleared before MSFT\'s chart mounts', async () => {
    await tapOnAapl();
    lv.levels = { support: [level(398)], resistance: [level(402)], currentPrice: 400 };
    const mark = chart.created.length;
    await mount('1D', { asset: { symbol: 'MSFT', name: 'MSFT', price: 400 } });
    expect(button('S/R')).toBeTruthy();
    expect(highlightLines()).toEqual([]);
    expect(chart.created.slice(mark).filter(isHighlight)).toEqual([]);
  });

  it('held (controlled) view re-opened for another symbol: the new chart mounts with nothing tapped', async () => {
    const contract = (symbol, price) => ({ posKey: 'player:star:0', symbol, price, extremes: null });
    await mount('1D', { controlledQuote: contract('AAPL', 200) });
    await openTab('technical');
    await click(levelRow('$202.00'));
    expect(highlightLines()).toEqual([[202, '#ff4757']]);
    const mark = chart.created.length;
    await mount('1D', { asset: { symbol: 'MSFT', name: 'MSFT', price: 400 }, controlledQuote: contract('MSFT', 400) });
    expect(button('S/R')).toBeTruthy();
    expect(highlightLines()).toEqual([]);
    expect(chart.created.slice(mark).filter(isHighlight)).toEqual([]);
  });
});
