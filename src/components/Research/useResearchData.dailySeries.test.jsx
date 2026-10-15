// @vitest-environment jsdom
//
// Research modal honesty fixes, F2 (+ the F8 histogram it feeds) — the
// Technical tab's indicators and levels come from a DAILY series whatever the
// chart shows (build report docs/audits/20261015_BUILD_RESEARCH_MODAL_HONESTY_FIXES.md).
// On 1D the chart's own series is the daily series; off 1D the daily series is
// fetched only while the Technical tab is showing, once per symbol.
//
// The REAL hook; stubbed: the network (eodhdAPI) and the dormant WebSocket
// daily high/low. Daily closes sit near 200, 30-minute closes near 100, so a
// reading taken from the wrong series cannot pass.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act, useLayoutEffect } from 'react';
import { createRoot } from 'react-dom/client';

const net = vi.hoisted(() => ({ calls: [], daily: {}, intraday: {}, quote: {}, hold: new Set() }));
vi.mock('../../services/eodhdAPI', () => ({
  fetchHistoricalOHLCV: (symbol, timeframe, opts) => {
    net.calls.push(['fetchHistoricalOHLCV', symbol, timeframe, opts ?? null]);
    if (net.hold.has(`${symbol}_${timeframe}`)) return new Promise(() => {});
    const rows = (timeframe === '1d' ? net.daily : timeframe === '30m' ? net.intraday : {})[symbol] ?? [];
    return Promise.resolve(opts?.days && timeframe === '1d' ? rows.slice(0, opts.days) : rows);
  },
  getStockPrice: (symbol) => {
    net.calls.push(['getStockPrice', symbol]);
    return Promise.resolve(net.quote[symbol] ?? null);
  },
}));
vi.mock('../../services/websocketService', () => ({ getDailyHL: () => null }));

import useResearchData from './useResearchData';
import { calculateMACD } from '../../services/technicalIndicators';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;
let latest;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-01T17:00:00.000Z')); // Thu 1:00 PM ET
  net.calls.length = 0;
  net.daily = {};
  net.intraday = {};
  net.quote = {};
  net.hold.clear();
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
async function render(symbol, options) {
  await act(async () => { root.render(<Probe symbol={symbol} options={options} />); });
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
}
const historyCalls = () => net.calls.filter((c) => c[0] === 'fetchHistoricalOHLCV');

/** `n` weekday daily bars ending 2026-09-30, newest-first, closes ~200 with a wobble. */
function dailyBars(n = 60) {
  const out = [];
  const d = new Date('2026-09-30T00:00:00Z');
  while (out.length < n) {
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) {
      const i = out.length;
      const close = 200 - i * 0.4 + (i % 3) * 0.7;
      out.push({ date: d.toISOString().slice(0, 10), open: close - 0.5, high: close + 1.5, low: close - 1.5, close, volume: 5000 + i });
    }
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return out;
}
/** 30-minute bars for one ET session, newest-first, closes ~100. */
function sessionBars(date, startPrice) {
  const bars = [];
  let p = startPrice;
  for (let h = 13; h <= 19; h++) {
    for (const m of [0, 30]) {
      if (h === 13 && m === 0) continue;
      const iso = `${date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00.000Z`;
      bars.push({ date: iso, datetime: iso, timestamp: Math.floor(Date.parse(iso) / 1000), open: p, high: p + 0.4, low: p - 0.3, close: p + 0.1, volume: 100 });
      p += 0.1;
    }
  }
  return bars.reverse();
}
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

function seed() {
  net.daily.AAPL = dailyBars();
  net.intraday.AAPL = [...sessionBars('2026-10-01', 102), ...sessionBars('2026-09-30', 99), ...sessionBars('2026-09-29', 98)];
  net.quote.AAPL = { symbol: 'AAPL', price: 104, high: 106, low: 101.5, open: 102 };
}
const BOMB_CALL = ['fetchHistoricalOHLCV', 'AAPL', '30m', { days: 20 }];
const DAILY_CHANGE_CALL = ['fetchHistoricalOHLCV', 'AAPL', '1d', { days: 5 }];
const DAILY_CALL = ['fetchHistoricalOHLCV', 'AAPL', '1d', { days: 400 }]; // the 1D chart's own request (re-pinned by founder ruling 2026-10-15, research modal F3)

describe('F2 — indicators and levels come from the daily series', () => {
  it('bomb view + Technical tab: one extra daily request, and every reading is from the daily closes', async () => {
    seed();
    await render('AAPL', { currentPrice: 104, isCrypto: false, initialTimeframe: 'bomb', technicalActive: true });
    expect(historyCalls()).toEqual([BOMB_CALL, DAILY_CHANGE_CALL, DAILY_CALL]);

    const daily = net.daily.AAPL;
    const closes = daily.map((c) => c.close);
    expect(latest.dailyData).toEqual(daily);
    expect(latest.indicators.sma20).toBeCloseTo(mean(closes.slice(0, 20)), 10);
    expect(latest.indicators.sma50).toBeCloseTo(mean(closes.slice(0, 50)), 10);
    expect(latest.indicators.macd).toEqual(calculateMACD(closes));
    // Levels are anchored on the newest DAILY close, not a 30-minute bar.
    expect(latest.levels.currentPrice).toBe(daily[0].close);
    // The chart still shows the 30-minute bars.
    expect(latest.timeframe).toBe('bomb');
    expect(latest.ohlcvData.every((c) => c.close < 150)).toBe(true);
  });

  it('bomb view, Technical tab never opened: no daily request, no indicators, no levels', async () => {
    seed();
    await render('AAPL', { currentPrice: 104, isCrypto: false, initialTimeframe: 'bomb', technicalActive: false });
    await act(async () => { await vi.advanceTimersByTimeAsync(60000); });
    expect(historyCalls()).toEqual([BOMB_CALL, DAILY_CHANGE_CALL]);
    expect(latest.dailyData).toBeNull();
    expect(latest.indicators).toBeNull();
    expect(latest.levels).toBeNull();
  });

  it('bomb view: opening the Technical tab later fetches the daily series once; reopening it fetches nothing more', async () => {
    seed();
    const opts = { currentPrice: 104, isCrypto: false, initialTimeframe: 'bomb' };
    await render('AAPL', { ...opts, technicalActive: false });
    expect(historyCalls()).toEqual([BOMB_CALL, DAILY_CHANGE_CALL]);
    await render('AAPL', { ...opts, technicalActive: true });
    expect(historyCalls()).toEqual([BOMB_CALL, DAILY_CHANGE_CALL, DAILY_CALL]);
    await render('AAPL', { ...opts, technicalActive: false });
    await render('AAPL', { ...opts, technicalActive: true });
    expect(historyCalls()).toEqual([BOMB_CALL, DAILY_CHANGE_CALL, DAILY_CALL]);
    expect(latest.indicators.sma20).toBeCloseTo(mean(net.daily.AAPL.slice(0, 20).map((c) => c.close)), 10);
  });

  it('1D chart + Technical tab: the chart\'s own series serves — no extra request, and switching to the bomb view keeps it', async () => {
    seed();
    await render('AAPL', { currentPrice: 104, isCrypto: false, initialTimeframe: '1D', technicalActive: true });
    expect(historyCalls()).toEqual([DAILY_CALL]);
    const sma20 = mean(net.daily.AAPL.slice(0, 20).map((c) => c.close));
    expect(latest.indicators.sma20).toBeCloseTo(sma20, 10);

    await act(async () => { latest.setTimeframe('bomb'); });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(latest.timeframe).toBe('bomb');
    expect(historyCalls()).toEqual([DAILY_CALL, BOMB_CALL]);
    expect(latest.indicators.sma20).toBeCloseTo(sma20, 10);
    expect(latest.levels.currentPrice).toBe(net.daily.AAPL[0].close);
  });

  it('a new symbol never shows the previous symbol\'s readings while its own daily series is pending', async () => {
    seed();
    await render('AAPL', { currentPrice: 104, isCrypto: false, initialTimeframe: '1D', technicalActive: true });
    expect(latest.indicators).not.toBeNull();
    net.hold.add('MSFT_1d');
    await render('MSFT', { currentPrice: 400, isCrypto: false, initialTimeframe: '1D', technicalActive: true });
    expect(latest.dailyData).toBeNull();
    expect(latest.indicators).toBeNull();
    expect(latest.levels).toBeNull();
  });
});

describe('F8 (hook side) — the MACD histogram of the latest 6 daily bars', () => {
  it('newest-first, index k = the reading k bars ago, index 0 = the displayed MACD', async () => {
    seed();
    await render('AAPL', { currentPrice: 104, isCrypto: false, initialTimeframe: '1D', technicalActive: true });
    const closes = net.daily.AAPL.map((c) => c.close);
    const expected = [0, 1, 2, 3, 4, 5].map((k) => calculateMACD(closes.slice(k)).histogram);
    expect(latest.indicators.macdHistogram).toEqual(expected);
    expect(latest.indicators.macdHistogram[0]).toBe(latest.indicators.macd.histogram);
  });
});
