// @vitest-environment jsdom
//
// Research modal follow-up (build report
// docs/audits/20261015_BUILD_RESEARCH_MODAL_F3_FOLLOWUP.md):
//   F3   the daily series asks for 400 days, so the 200-day average, a full
//        52-week range and a 30-session volume average exist; the 1D chart is
//        still handed exactly the bars the server's 180-day default returns,
//        and a symbol with no bar in those 180 days is "no data", as before.
//   D-2  turning the chart's S/R toggle on (off 1D) asks for the same single
//        daily request the Technical tab does — shared, never twice; after a
//        failed request, opening the Technical tab still asks again.
//   V-11 the session date the tab's "Today" label is matched against.
//
// The REAL hook and the REAL Technical tab; stubbed: the network (eodhdAPI,
// which here answers like the server — `days` calendar days back, 180 when
// absent), the dormant WebSocket daily high/low and the sector summary.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act, useLayoutEffect } from 'react';
import { createRoot } from 'react-dom/client';

const NOW = Date.parse('2026-10-15T17:00:00.000Z'); // Thu 1:00 PM ET, market open
const DAY_MS = 24 * 60 * 60 * 1000;

/** Daily bars the server would return for `days` calendar days back from
 *  NOW (UTC start date, as api/stocks/historical.js computes it), up to
 *  yesterday — during the session EODHD has no bar for today. Newest-first.
 *  Stocks: weekdays only; crypto: every day. Closes alternate 199.5 / 200.5
 *  plus 0.001 per bar back, so means over 50, 126 and 200 closes all differ.
 *  `staleOnly`: only bars on or before 2026-04-01 (none in the last 180 days). */
function serverDaily(days, { crypto = false, staleOnly = false } = {}) {
  const from = new Date(NOW - days * DAY_MS).toISOString().slice(0, 10);
  const out = [];
  const d = new Date(staleOnly ? '2026-04-01T00:00:00Z' : '2026-10-14T00:00:00Z');
  while (d.toISOString().slice(0, 10) >= from) {
    const day = d.getUTCDay();
    if (crypto || (day !== 0 && day !== 6)) {
      const i = out.length; // 0 = newest
      const close = (i % 2 ? 199.5 : 200.5) + 0.001 * i;
      // Volume: newest 20 at 1M, next 10 at 4M, older at 9M — a 30-session
      // mean of 2.0M (a 20-bar mean would read 1.0M, a 40-bar mean 3.75M).
      const volume = i < 20 ? 1e6 : i < 30 ? 4e6 : 9e6;
      out.push({ date: d.toISOString().slice(0, 10), open: close - 0.5, high: close + 1.5, low: close - 1.5, close, volume });
    }
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return out;
}

const net = vi.hoisted(() => ({ calls: [], weekly: {}, hold: new Set(), fail: new Set(), stale: new Set() }));
vi.mock('../../services/eodhdAPI', () => ({
  fetchHistoricalOHLCV: (symbol, timeframe, opts) => {
    net.calls.push(['fetchHistoricalOHLCV', symbol, timeframe, opts ?? null]);
    if (net.hold.has(`${symbol}_${timeframe}`)) return new Promise(() => {});
    const failKey = `${symbol}_${timeframe}_${opts?.days ?? ''}`; // one-shot, by symbol, timeframe and days
    if (net.fail.has(failKey)) {
      net.fail.delete(failKey);
      return Promise.reject(new Error('Proxy error: 500'));
    }
    if (timeframe === '1d') {
      // No bar in the window: the server answers 404, which the fetcher resolves as null.
      const rows = serverDaily(opts?.days ?? 180, { crypto: opts?.type === 'crypto', staleOnly: net.stale.has(symbol) });
      return Promise.resolve(rows.length > 0 ? rows : null);
    }
    if (timeframe === '1w') return Promise.resolve(net.weekly[symbol] ?? []);
    return Promise.resolve([]);
  },
  getStockPrice: (symbol) => {
    net.calls.push(['getStockPrice', symbol]);
    return Promise.resolve(null);
  },
}));
vi.mock('../../services/websocketService', () => ({ getDailyHL: () => null }));
vi.mock('../../services/sectorDataService', () => ({ getQuickSectorSummary: () => Promise.resolve(null) }));

import useResearchData, { sessionDateOf } from './useResearchData';
import TechnicalTabV2 from './TechnicalTabV2';
import { calculateRollingSMA } from '../../services/technicalIndicators';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;
let latest;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(NOW));
  net.calls.length = 0;
  net.weekly = { AAPL: [{ date: '2026-10-05', open: 198, high: 202, low: 197, close: 200, volume: 5e6 }, { date: '2026-09-28', open: 199, high: 201, low: 196, close: 198, volume: 5e6 }] };
  net.hold.clear();
  net.fail.clear();
  net.stale.clear();
  latest = null;
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function Probe({ symbol, options }) {
  const r = useResearchData(symbol, options);
  useLayoutEffect(() => { latest = r; });
  return null;
}
const settle = async () => {
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
};
async function render(symbol, options) {
  await act(async () => { root.render(<Probe symbol={symbol} options={options} />); });
  await settle();
}
const historyCalls = () => net.calls.filter((c) => c[0] === 'fetchHistoricalOHLCV');
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

// currentPrice 0: no live candle is synthesized, so the chart's series is
// exactly what the hook hands the chart.
const STOCK_1D = { currentPrice: 0, isCrypto: false, initialTimeframe: '1D', technicalActive: true };
const DAILY_400 = ['fetchHistoricalOHLCV', 'AAPL', '1d', { days: 400 }];
const WEEKLY = ['fetchHistoricalOHLCV', 'AAPL', '1w', null];
const DAILY_CHANGE = ['fetchHistoricalOHLCV', 'AAPL', '1d', { days: 5 }];

describe('F3 — 400 days of daily history: the 200-day average, a 52-week range, a 30-session volume average', () => {
  it('one request for { days: 400 }; ≥ 260 closes; sma200 is the mean of the newest 200 closes', async () => {
    await render('AAPL', STOCK_1D);
    expect(historyCalls()).toEqual([DAILY_400]);
    const closes = latest.dailyData.map((c) => c.close);
    expect(closes.length).toBeGreaterThanOrEqual(260);
    expect(Number.isFinite(latest.indicators.sma200)).toBe(true);
    expect(latest.indicators.sma200).toBeCloseTo(mean(closes.slice(0, 200)), 10);
  });

  it('the price levels include a 200-day SMA factor', async () => {
    await render('AAPL', STOCK_1D);
    const factors = [...latest.levels.support, ...latest.levels.resistance].flatMap((l) => l.factors.map((f) => f.name));
    expect(factors).toContain('200-day SMA');
  });

  it('the Technical tab reads "52-week range" and a 30-session "30d Avg"', async () => {
    await render('AAPL', STOCK_1D);
    const tab = document.createElement('div');
    document.body.appendChild(tab);
    const tabRoot = createRoot(tab);
    await act(async () => {
      tabRoot.render(<TechnicalTabV2 asset={{ symbol: 'AAPL', price: 200 }} dailyData={latest.dailyData} indicators={latest.indicators} levels={latest.levels} sessionDate="2026-10-15" />);
    });
    expect(tab.textContent).toContain('52-week range');
    expect(tab.textContent).not.toContain('Range (');
    const avg = [...tab.querySelectorAll('span')].find((s) => s.textContent === '30d Avg');
    expect(avg.parentElement.lastElementChild.textContent).toBe('2.0M');
    act(() => tabRoot.unmount());
    tab.remove();
  });
});

describe('F3 — the 1D chart keeps its framing: exactly the bars of the server\'s 180-day default', () => {
  it('fresh fetch: the chart\'s series (and its SMA overlay) is the 180-day window; the daily series keeps all 400 days', async () => {
    await render('AAPL', STOCK_1D);
    const window180 = serverDaily(180);
    expect(latest.rawData).toEqual(window180);
    expect(latest.ohlcvData).toEqual([...window180].reverse());
    expect(latest.smaData).toEqual({ sma20: calculateRollingSMA(window180, 20), sma50: calculateRollingSMA(window180, 50) });
    expect(latest.dailyData).toEqual(serverDaily(400));
    expect(latest.dailyData.length).toBeGreaterThan(latest.rawData.length);
  });

  it('back to 1D from the cache (1D → 1W → 1D): the same 180-day window, no new daily request', async () => {
    await render('AAPL', STOCK_1D);
    await act(async () => { latest.setTimeframe('1W'); });
    await settle();
    await act(async () => { latest.setTimeframe('1D'); });
    await settle();
    expect(latest.timeframe).toBe('1D');
    expect(latest.rawData).toEqual(serverDaily(180));
    expect(historyCalls().filter((c) => c[2] === '1d' && c[3]?.days === 400)).toHaveLength(1);
  });

  it('after a failed first request, Retry asks for { days: 400 } and the chart again gets the 180-day window', async () => {
    net.fail.add('AAPL_1d_400');
    await render('AAPL', STOCK_1D);
    expect(latest.error).toBeTruthy();
    expect(latest.rawData).toBeNull();
    await act(async () => { latest.retry(); });
    await settle();
    expect(historyCalls()).toEqual([DAILY_400, DAILY_400]);
    expect(latest.rawData).toEqual(serverDaily(180));
    expect(latest.dailyData).toEqual(serverDaily(400));
  });

  it('crypto: { days: 400, type: crypto }; the chart keeps its 180 daily bars (not a 126-bar count)', async () => {
    await render('BTC', { ...STOCK_1D, isCrypto: true });
    expect(historyCalls()).toEqual([['fetchHistoricalOHLCV', 'BTC', '1d', { days: 400, type: 'crypto' }]]);
    expect(latest.rawData).toEqual(serverDaily(180, { crypto: true }));
    expect(latest.rawData.length).toBe(180);
    expect(latest.dailyData.length).toBe(400);
  });
});

describe('F3 — a symbol with no bar in the last 180 days is "no data", as the 180-day request was', () => {
  it('1D: error (Retry), no chart bars, no daily series, no previous close — and Retry says the same', async () => {
    net.stale.add('AAPL');
    expect(serverDaily(180, { staleOnly: true })).toEqual([]); // before: the 180-day request had nothing (404)
    expect(serverDaily(400, { staleOnly: true }).length).toBeGreaterThan(0); // the 400-day one has old bars
    await render('AAPL', STOCK_1D);
    expect(latest.error).toBe('No historical data available');
    expect(latest.rawData).toBeNull();
    expect(latest.ohlcvData).toBeNull();
    expect(latest.dailyData).toBeNull();
    expect(latest.previousClose).toBeNull();
    expect(latest.dailyChange).toBeNull();
    await act(async () => { latest.retry(); });
    await settle();
    expect(historyCalls()).toEqual([DAILY_400, DAILY_400]);
    expect(latest.error).toBe('No historical data available');
    expect(latest.rawData).toBeNull();
    expect(latest.dailyData).toBeNull();
  });

  it('off 1D: the lazy daily request finds no recent bar → no daily series, no levels', async () => {
    net.stale.add('AAPL');
    await render('AAPL', { currentPrice: 0, isCrypto: false, initialTimeframe: '1W', technicalActive: true });
    expect(historyCalls()).toEqual([WEEKLY, DAILY_CHANGE, DAILY_400]);
    expect(latest.dailyData).toBeNull();
    expect(latest.indicators).toBeNull();
    expect(latest.levels).toBeNull();
  });
});

describe('D-2 — the S/R toggle asks for the daily levels (one request, shared with the Technical tab)', () => {
  const ON_1W = { currentPrice: 0, isCrypto: false, initialTimeframe: '1W' };

  it('1W, neither the toggle nor the tab: no daily series is fetched', async () => {
    await render('AAPL', { ...ON_1W, technicalActive: false, srRequested: false });
    await act(async () => { await vi.advanceTimersByTimeAsync(60000); });
    expect(historyCalls()).toEqual([WEEKLY, DAILY_CHANGE]);
    expect(latest.levels).toBeNull();
  });

  it('1W, toggle on with nothing cached → one daily request and levels; then the Technical tab → no second request', async () => {
    await render('AAPL', { ...ON_1W, technicalActive: false, srRequested: false });
    await render('AAPL', { ...ON_1W, technicalActive: false, srRequested: true });
    expect(historyCalls()).toEqual([WEEKLY, DAILY_CHANGE, DAILY_400]);
    expect(latest.levels).not.toBeNull();
    await render('AAPL', { ...ON_1W, technicalActive: true, srRequested: true });
    await render('AAPL', { ...ON_1W, technicalActive: false, srRequested: true });
    await render('AAPL', { ...ON_1W, technicalActive: true, srRequested: true });
    expect(historyCalls()).toEqual([WEEKLY, DAILY_CHANGE, DAILY_400]);
  });

  it('the other order: Technical tab first, then the toggle → still one daily request', async () => {
    await render('AAPL', { ...ON_1W, technicalActive: true, srRequested: false });
    expect(historyCalls()).toEqual([WEEKLY, DAILY_CHANGE, DAILY_400]);
    await render('AAPL', { ...ON_1W, technicalActive: false, srRequested: true });
    expect(historyCalls()).toEqual([WEEKLY, DAILY_CHANGE, DAILY_400]);
  });

  it('toggle on while the daily request is in flight, then the tab: still one request', async () => {
    net.hold.add('AAPL_1d');
    await render('AAPL', { ...ON_1W, technicalActive: false, srRequested: true });
    await render('AAPL', { ...ON_1W, technicalActive: true, srRequested: true });
    // The held 5-day request and the held 400-day request — one each.
    expect(historyCalls()).toEqual([WEEKLY, DAILY_CHANGE, DAILY_400]);
  });
});

describe('D-2 — after a failed daily request', () => {
  it('toggle on, the request fails, then the Technical tab opens → it asks again (each trigger re-runs the fetch)', async () => {
    const ON_1W = { currentPrice: 0, isCrypto: false, initialTimeframe: '1W' };
    net.fail.add('AAPL_1d_400');
    await render('AAPL', { ...ON_1W, technicalActive: false, srRequested: true });
    expect(historyCalls()).toEqual([WEEKLY, DAILY_CHANGE, DAILY_400]);
    expect(latest.dailyData).toBeNull();
    await render('AAPL', { ...ON_1W, technicalActive: true, srRequested: true });
    expect(historyCalls()).toEqual([WEEKLY, DAILY_CHANGE, DAILY_400, DAILY_400]);
    expect(latest.levels).not.toBeNull();
  });
});

describe('V-11 session date (the Technical tab\'s "Today" is matched against it)', () => {
  it('ET for stocks, UTC for crypto', () => {
    const lateEvening = Date.parse('2026-10-15T02:00:00.000Z'); // 10 PM ET on Oct 14
    expect(sessionDateOf(lateEvening, false)).toBe('2026-10-14');
    expect(sessionDateOf(lateEvening, true)).toBe('2026-10-15');
  });
});
