// @vitest-environment jsdom
//
// src/components/Research/useResearchData.controlledQuote.test.jsx
//
// Shadow vs CPU quote integrity — the research data hook's controlled mode
// (spec SHADOW_CPU_PLACEHOLDER_PRICE_SPEC_V1_6.md §7.2 items 3–4, A-3, V-6,
// B-7, B-8, B-9, B-10; build record
// docs/audits/20261002_SHADOW_CPU_QUOTE_INTEGRITY_BUILD_REVIEW.md).
//
// The REAL hook; the network (eodhdAPI) and the dormant WebSocket daily
// high/low are the only stubs. Calls and intervals are recorded.
//
// OFF — with no controlled option the hook makes the same requests on the
// same schedule and returns the same candles, todayDailyCandle, extremes and
// daily change as the pre-build SHA (captured there with
// SHADOW_OFF_CAPTURE_DIR).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act, useLayoutEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

export const OFF_REFERENCE_SHA = '44d0c63eba4e3099552d3ec3dbde6a89660a7e06';
const CAPTURE_DIR = process.env.SHADOW_OFF_CAPTURE_DIR || '';
function offReference(name, actual, expected) {
  if (CAPTURE_DIR) {
    writeFileSync(path.join(CAPTURE_DIR, `researchData.${name}.json`), JSON.stringify(actual, null, 1));
    return;
  }
  expect(actual).toEqual(expected);
}

const net = vi.hoisted(() => ({ calls: [], daily: {}, intraday: {}, weekly: {}, quote: {} }));
vi.mock('../../services/eodhdAPI', () => ({
  fetchHistoricalOHLCV: (symbol, timeframe, opts) => {
    net.calls.push(['fetchHistoricalOHLCV', symbol, timeframe, opts ?? null]);
    const table = timeframe === '1d' ? net.daily : timeframe === '30m' ? net.intraday : timeframe === '1w' ? net.weekly : {};
    return Promise.resolve(table[symbol] ?? []);
  },
  getStockPrice: (symbol) => {
    net.calls.push(['getStockPrice', symbol]);
    return Promise.resolve(net.quote[symbol] ?? null);
  },
}));
vi.mock('../../services/websocketService', () => ({ getDailyHL: () => null }));

import useResearchData from './useResearchData';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;
let latest;
beforeEach(() => {
  vi.useFakeTimers();
  net.calls.length = 0;
  net.daily = {};
  net.intraday = {};
  net.weekly = {};
  net.quote = {};
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
async function mount(symbol, options) {
  await act(async () => { root.render(<Probe symbol={symbol} options={options} />); });
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
}
async function rerender(symbol, options) {
  await act(async () => { root.render(<Probe symbol={symbol} options={options} />); });
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
}

/** What the chart and the popup read, plus the calls made. */
function view() {
  const tail = (latest.ohlcvData || []).slice(-3);
  return {
    timeframe: latest.timeframe,
    tail,
    length: (latest.ohlcvData || []).length,
    todayDailyCandle: latest.todayDailyCandle ?? null,
    realtimeExtremes: latest.realtimeExtremes ?? null,
    dailyChange: latest.dailyChange,
    previousClose: latest.previousClose,
    calls: [...net.calls],
  };
}

// ── Fixtures (API order: newest-first) ──────────────────────────────────────
function dailyHistory(lastDate, lastClose, n = 25) {
  const out = [];
  const d = new Date(`${lastDate}T00:00:00Z`);
  let close = lastClose;
  for (let i = 0; i < n; i++) {
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) {
      const ds = d.toISOString().slice(0, 10);
      out.push({ date: ds, open: close - 0.5, high: close + 1, low: close - 1.5, close, volume: 1000 + i });
      close -= 0.25;
    }
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return out;
}
// 30-minute bars for one ET session (13:30Z–19:30Z in October, EDT).
function sessionBars(date, startPrice, { upto = '19:30' } = {}) {
  const bars = [];
  let p = startPrice;
  for (let h = 13; h <= 19; h++) {
    for (const m of [0, 30]) {
      if (h === 13 && m === 0) continue;
      const hm = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      if (hm > upto) continue;
      const iso = `${date}T${hm}:00.000Z`;
      bars.push({ date: iso, datetime: iso, timestamp: Math.floor(Date.parse(iso) / 1000), open: p, high: p + 0.4, low: p - 0.3, close: p + 0.1, volume: 100 });
      p += 0.1;
    }
  }
  return bars.reverse(); // newest-first
}

// BEGIN GENERATED OFF REFERENCES — captured at the pre-build SHA 44d0c63eba4e3099552d3ec3dbde6a89660a7e06 (6 entries).
// Regenerate ONLY by re-running this file's OFF rows at that SHA with
// SHADOW_OFF_CAPTURE_DIR set; never by blessing build output.
const OFF = {
 "cryptoEveningPriority2": {
  "calls": [
   [
    "fetchHistoricalOHLCV",
    "BTC",
    "1d",
    {
     "type": "crypto"
    }
   ],
   [
    "getStockPrice",
    "BTC"
   ]
  ],
  "dailyChange": 0,
  "length": 3,
  "previousClose": 61000,
  "realtimeExtremes": null,
  "tail": [
   {
    "close": 60000,
    "date": "2026-09-30",
    "high": 60100,
    "low": 59000,
    "open": 59500,
    "volume": 7
   },
   {
    "close": 60900,
    "date": "2026-10-01",
    "high": 61500,
    "low": 59000,
    "open": 60000,
    "volume": 8
   },
   {
    "close": 61000,
    "date": "2026-10-02",
    "high": 61200,
    "low": 60800,
    "open": 60900,
    "volume": 9
   }
  ],
  "timeframe": "1D",
  "todayDailyCandle": {
   "close": 60900,
   "date": "2026-10-01",
   "high": 61500,
   "low": 59000,
   "open": 60000,
   "volume": 8
  }
 },
 "stock1D": {
  "calls": [
   [
    "fetchHistoricalOHLCV",
    "AAPL",
    "1d",
    null
   ],
   [
    "getStockPrice",
    "AAPL"
   ]
  ],
  "dailyChange": 4,
  "length": 19,
  "previousClose": 100,
  "realtimeExtremes": {
   "high": 106,
   "low": 101.5,
   "open": 0
  },
  "tail": [
   {
    "close": 99.75,
    "date": "2026-09-29",
    "high": 100.75,
    "low": 98.25,
    "open": 99.25,
    "volume": 1001
   },
   {
    "close": 100,
    "date": "2026-09-30",
    "high": 101,
    "low": 98.5,
    "open": 99.5,
    "volume": 1000
   },
   {
    "close": 104,
    "date": "2026-10-01",
    "high": 106,
    "low": 100,
    "open": 100,
    "volume": 0
   }
  ],
  "timeframe": "1D",
  "todayDailyCandle": {
   "_source": "realtime",
   "close": 0,
   "high": 106,
   "low": 101.5,
   "open": 0
  }
 },
 "stock1W": {
  "calls": [
   [
    "fetchHistoricalOHLCV",
    "AAPL",
    "1w",
    null
   ],
   [
    "fetchHistoricalOHLCV",
    "AAPL",
    "1d",
    {
     "days": 5
    }
   ],
   [
    "getStockPrice",
    "AAPL"
   ]
  ],
  "dailyChange": 4,
  "length": 3,
  "previousClose": 100,
  "realtimeExtremes": {
   "high": 106,
   "low": 101.5,
   "open": 103
  },
  "tail": [
   {
    "close": 97,
    "date": "2026-09-15",
    "high": 100,
    "low": 96,
    "open": 98,
    "volume": 5100
   },
   {
    "close": 101,
    "date": "2026-09-22",
    "high": 102,
    "low": 96,
    "open": 97,
    "volume": 5200
   },
   {
    "close": 104,
    "date": "2026-09-28",
    "high": 106,
    "low": 101,
    "open": 101,
    "volume": 0
   }
  ],
  "timeframe": "1W",
  "todayDailyCandle": {
   "_source": "realtime",
   "close": 0,
   "high": 106,
   "low": 101.5,
   "open": 103
  }
 },
 "stockBombEarlyGapUp": {
  "calls": [
   [
    "fetchHistoricalOHLCV",
    "AAPL",
    "30m",
    {
     "days": 20
    }
   ],
   [
    "fetchHistoricalOHLCV",
    "AAPL",
    "1d",
    {
     "days": 5
    }
   ],
   [
    "getStockPrice",
    "AAPL"
   ]
  ],
  "dailyChange": 4.799999999999997,
  "length": 14,
  "previousClose": 100,
  "realtimeExtremes": {
   "high": 105,
   "low": 103.9,
   "open": 104
  },
  "tail": [
   {
    "close": 100.19999999999993,
    "date": "2026-09-30T19:00:00.000Z",
    "datetime": "2026-09-30T19:00:00.000Z",
    "high": 100.49999999999994,
    "low": 99.79999999999994,
    "open": 100.09999999999994,
    "timestamp": 1790794800,
    "volume": 100
   },
   {
    "close": 100.29999999999993,
    "date": "2026-09-30T19:30:00.000Z",
    "datetime": "2026-09-30T19:30:00.000Z",
    "high": 105,
    "low": 99.89999999999993,
    "open": 100.19999999999993,
    "timestamp": 1790796600,
    "volume": 100
   },
   {
    "close": 104.8,
    "date": "2026-10-01T13:30:00.000Z",
    "datetime": "2026-10-01T13:30:00.000Z",
    "high": 105,
    "low": 103.9,
    "open": 104,
    "timestamp": 1790861400,
    "volume": 0
   }
  ],
  "timeframe": "bomb",
  "todayDailyCandle": {
   "_source": "realtime",
   "close": 0,
   "high": 105,
   "low": 103.9,
   "open": 104
  }
 },
 "stockBombMidSession": {
  "afterTickCalls": [
   [
    "fetchHistoricalOHLCV",
    "AAPL",
    "30m",
    {
     "days": 20
    }
   ],
   [
    "fetchHistoricalOHLCV",
    "AAPL",
    "1d",
    {
     "days": 5
    }
   ],
   [
    "getStockPrice",
    "AAPL"
   ],
   [
    "getStockPrice",
    "AAPL"
   ]
  ],
  "first": {
   "calls": [
    [
     "fetchHistoricalOHLCV",
     "AAPL",
     "30m",
     {
      "days": 20
     }
    ],
    [
     "fetchHistoricalOHLCV",
     "AAPL",
     "1d",
     {
      "days": 5
     }
    ],
    [
     "getStockPrice",
     "AAPL"
    ]
   ],
   "dailyChange": 4,
   "length": 20,
   "previousClose": 100,
   "realtimeExtremes": {
    "high": 106,
    "low": 101.5,
    "open": 102
   },
   "tail": [
    {
     "close": 102.49999999999997,
     "date": "2026-10-01T15:30:00.000Z",
     "datetime": "2026-10-01T15:30:00.000Z",
     "high": 102.79999999999998,
     "low": 102.09999999999998,
     "open": 102.39999999999998,
     "timestamp": 1790868600,
     "volume": 100
    },
    {
     "close": 102.59999999999997,
     "date": "2026-10-01T16:00:00.000Z",
     "datetime": "2026-10-01T16:00:00.000Z",
     "high": 106,
     "low": 101.5,
     "open": 102.49999999999997,
     "timestamp": 1790870400,
     "volume": 100
    },
    {
     "close": 104,
     "date": "2026-10-01T17:00:00.000Z",
     "datetime": "2026-10-01T17:00:00.000Z",
     "high": 106,
     "low": 101.5,
     "open": 102,
     "timestamp": 1790874000,
     "volume": 0
    }
   ],
   "timeframe": "bomb",
   "todayDailyCandle": {
    "_source": "realtime",
    "close": 0,
    "high": 106,
    "low": 101.5,
    "open": 102
   }
  }
 },
 "symbolChange": {
  "calls": [
   [
    "fetchHistoricalOHLCV",
    "AAPL",
    "1d",
    null
   ],
   [
    "getStockPrice",
    "AAPL"
   ],
   [
    "fetchHistoricalOHLCV",
    "MSFT",
    "1d",
    null
   ],
   [
    "getStockPrice",
    "MSFT"
   ]
  ],
  "dailyChange": 1.25,
  "length": 19,
  "previousClose": 400,
  "realtimeExtremes": {
   "high": 407,
   "low": 399,
   "open": 401
  },
  "tail": [
   {
    "close": 399.75,
    "date": "2026-09-29",
    "high": 400.75,
    "low": 398.25,
    "open": 399.25,
    "volume": 1001
   },
   {
    "close": 400,
    "date": "2026-09-30",
    "high": 401,
    "low": 398.5,
    "open": 399.5,
    "volume": 1000
   },
   {
    "close": 405,
    "date": "2026-10-01",
    "high": 407,
    "low": 399,
    "open": 401,
    "volume": 0
   }
  ],
  "timeframe": "1D",
  "todayDailyCandle": {
   "_source": "realtime",
   "close": 0,
   "high": 407,
   "low": 399,
   "open": 401
  }
 }
};
// END GENERATED OFF REFERENCES

describe('OFF — default (uncontrolled) research data', () => {
  it('OFF stockBombMidSession: 1 PM ET, last bar >30 min old → patched last bar + synthetic bar; extremes poll on mount and every 60 s', async () => {
    vi.setSystemTime(new Date('2026-10-01T17:00:00.000Z'));
    net.daily.AAPL = dailyHistory('2026-09-30', 100);
    net.intraday.AAPL = [...sessionBars('2026-10-01', 102, { upto: '16:00' }), ...sessionBars('2026-09-30', 99)];
    net.quote.AAPL = { symbol: 'AAPL', price: 104, high: 106, low: 101.5, open: 102, previousClose: 100 };
    await mount('AAPL', { currentPrice: 104, isCrypto: false, initialTimeframe: 'bomb' });
    const first = view();
    await act(async () => { await vi.advanceTimersByTimeAsync(60000); });
    const afterTick = view();
    offReference('stockBombMidSession', { first, afterTickCalls: afterTick.calls }, OFF.stockBombMidSession);
  });

  it('OFF stockBombEarlyGapUp: 9:45 AM ET, yesterday\'s 15:30 bar is the last real bar and gets today\'s high (the legacy patch)', async () => {
    vi.setSystemTime(new Date('2026-10-01T13:45:00.000Z'));
    net.daily.AAPL = dailyHistory('2026-09-30', 100);
    net.intraday.AAPL = sessionBars('2026-09-30', 99);
    net.quote.AAPL = { symbol: 'AAPL', price: 104.8, high: 105, low: 103.9, open: 104, previousClose: 100 };
    await mount('AAPL', { currentPrice: 104.8, isCrypto: false, initialTimeframe: 'bomb' });
    offReference('stockBombEarlyGapUp', view(), OFF.stockBombEarlyGapUp);
  });

  it('OFF stock1D: synthetic today candle opens at the realtime open (or the last close)', async () => {
    vi.setSystemTime(new Date('2026-10-01T17:00:00.000Z'));
    net.daily.AAPL = dailyHistory('2026-09-30', 100);
    net.quote.AAPL = { symbol: 'AAPL', price: 104, high: 106, low: 101.5, open: 0, previousClose: 100 };
    await mount('AAPL', { currentPrice: 104, isCrypto: false, initialTimeframe: '1D' });
    offReference('stock1D', view(), OFF.stock1D);
  });

  it('OFF stock1W: a new week gets a synthetic candle opened at the last close', async () => {
    vi.setSystemTime(new Date('2026-10-01T17:00:00.000Z'));
    net.daily.AAPL = dailyHistory('2026-09-30', 100);
    net.weekly.AAPL = [
      { date: '2026-09-22', open: 97, high: 102, low: 96, close: 101, volume: 5200 },
      { date: '2026-09-15', open: 98, high: 100, low: 96, close: 97, volume: 5100 },
    ];
    net.quote.AAPL = { symbol: 'AAPL', price: 104, high: 106, low: 101.5, open: 103, previousClose: 100 };
    await mount('AAPL', { currentPrice: 104, isCrypto: false, initialTimeframe: '1W' });
    offReference('stock1W', view(), OFF.stock1W);
  });

  it('OFF cryptoEveningPriority2: 9:30 PM ET, no realtime extremes → Priority 2 picks the ET-dated daily candle', async () => {
    vi.setSystemTime(new Date('2026-10-02T01:30:00.000Z'));
    net.daily.BTC = [
      { date: '2026-10-02', open: 60900, high: 61200, low: 60800, close: 61000, volume: 9 },
      { date: '2026-10-01', open: 60000, high: 61500, low: 59000, close: 60900, volume: 8 },
      { date: '2026-09-30', open: 59500, high: 60100, low: 59000, close: 60000, volume: 7 },
    ];
    net.quote.BTC = { symbol: 'BTC', price: 61000, high: 0, low: 0, open: 0 };
    await mount('BTC', { currentPrice: 61000, isCrypto: true, initialTimeframe: '1D' });
    offReference('cryptoEveningPriority2', view(), OFF.cryptoEveningPriority2);
  });

  it('OFF symbolChange: a new symbol clears the old extremes and re-polls', async () => {
    vi.setSystemTime(new Date('2026-10-01T17:00:00.000Z'));
    net.daily.AAPL = dailyHistory('2026-09-30', 100);
    net.daily.MSFT = dailyHistory('2026-09-30', 400);
    net.quote.AAPL = { symbol: 'AAPL', price: 104, high: 106, low: 101.5, open: 102 };
    net.quote.MSFT = { symbol: 'MSFT', price: 405, high: 407, low: 399, open: 401 };
    await mount('AAPL', { currentPrice: 104, isCrypto: false, initialTimeframe: '1D' });
    await rerender('MSFT', { currentPrice: 405, isCrypto: false, initialTimeframe: '1D' });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    offReference('symbolChange', view(), OFF.symbolChange);
  });
});

// ── ON — controlled held-quote mode ─────────────────────────────────────────
// `controlled.extremes` is what the screen supplies: the accepted REST
// observation's finite positive fields, already qualified for the current
// session (shadowCpuQuoteIntegrity.sessionExtremes), or null.
const TODAY_STOCK = { sessionDate: '2026-10-01', high: 106, low: 101.5, open: 102 };
const historyCalls = (calls) => calls.filter((c) => c[0] === 'fetchHistoricalOHLCV');

describe('ON — controlled mode: no quote request, no poll (§7.2 item 4)', () => {
  it('bomb view: never calls getStockPrice, schedules no interval, and requests the same history as legacy', async () => {
    vi.setSystemTime(new Date('2026-10-01T17:00:00.000Z'));
    net.daily.AAPL = dailyHistory('2026-09-30', 100);
    net.intraday.AAPL = [...sessionBars('2026-10-01', 102, { upto: '16:00' }), ...sessionBars('2026-09-30', 99)];
    net.quote.AAPL = { symbol: 'AAPL', price: 104, high: 999, low: 1, open: 1 };
    await mount('AAPL', { currentPrice: 104, isCrypto: false, initialTimeframe: 'bomb', controlled: { extremes: TODAY_STOCK } });
    expect(vi.getTimerCount()).toBe(0);
    await act(async () => { await vi.advanceTimersByTimeAsync(5 * 60 * 1000); });
    expect(net.calls.some((c) => c[0] === 'getStockPrice')).toBe(false);
    expect(net.calls).toEqual(historyCalls(OFF.stockBombMidSession.first.calls));
    // The supplied values, never the (poisoned) poll's.
    expect(latest.realtimeExtremes).toEqual({ high: 106, low: 101.5, open: 102 });
  });

  it('1D and 1W: no getStockPrice either; history requests unchanged', async () => {
    vi.setSystemTime(new Date('2026-10-01T17:00:00.000Z'));
    net.daily.AAPL = dailyHistory('2026-09-30', 100);
    net.weekly.AAPL = [{ date: '2026-09-22', open: 97, high: 102, low: 96, close: 101, volume: 5200 }];
    await mount('AAPL', { currentPrice: 104, isCrypto: false, initialTimeframe: '1D', controlled: { extremes: null } });
    expect(net.calls).toEqual(historyCalls(OFF.stock1D.calls));
    net.calls.length = 0;
    act(() => root.unmount());
    root = createRoot(container);
    await mount('AAPL', { currentPrice: 104, isCrypto: false, initialTimeframe: '1W', controlled: { extremes: null } });
    expect(net.calls).toEqual(historyCalls(OFF.stock1W.calls));
    expect(vi.getTimerCount()).toBe(0);
  });

  it('a same-position quote change updates the live bar at once — no throttle hold-back, no request', async () => {
    vi.setSystemTime(new Date('2026-10-01T17:00:00.000Z'));
    net.daily.AAPL = dailyHistory('2026-09-30', 100);
    await mount('AAPL', { currentPrice: 104, isCrypto: false, initialTimeframe: '1D', controlled: { extremes: TODAY_STOCK } });
    const before = net.calls.length;
    await rerender('AAPL', { currentPrice: 104.01, isCrypto: false, initialTimeframe: '1D', controlled: { extremes: TODAY_STOCK } });
    expect(latest.ohlcvData.at(-1).close).toBe(104.01);
    expect(net.calls.length).toBe(before);
  });
});

describe('ON — controlled live candles (V-6 a–c, B-7, B-10)', () => {
  it('bomb mid-session: today\'s last real bar takes the supplied extremes; the live half-hour bar is the no-body scaffold', async () => {
    vi.setSystemTime(new Date('2026-10-01T17:00:00.000Z'));
    net.daily.AAPL = dailyHistory('2026-09-30', 100);
    const today = sessionBars('2026-10-01', 102, { upto: '16:00' });
    net.intraday.AAPL = [...today, ...sessionBars('2026-09-30', 99)];
    await mount('AAPL', { currentPrice: 104, isCrypto: false, initialTimeframe: 'bomb', controlled: { extremes: TODAY_STOCK } });
    const tail = latest.ohlcvData.slice(-2);
    expect(tail[0]).toEqual({ ...today[0], high: 106, low: 101.5 });
    expect(tail[1]).toEqual({
      date: '2026-10-01T17:00:00.000Z', datetime: '2026-10-01T17:00:00.000Z', timestamp: 1790874000,
      open: 104, high: 106, low: 101.5, close: 104, volume: 0, _scaffold: true,
    });
  });

  it('[B-7] bomb, gap-up day early in the session: yesterday\'s last bar keeps its own high and low', async () => {
    vi.setSystemTime(new Date('2026-10-01T13:45:00.000Z'));
    net.daily.AAPL = dailyHistory('2026-09-30', 100);
    const yesterday = sessionBars('2026-09-30', 99);
    net.intraday.AAPL = yesterday;
    await mount('AAPL', {
      currentPrice: 104.8, isCrypto: false, initialTimeframe: 'bomb',
      controlled: { extremes: { sessionDate: '2026-10-01', high: 105, low: 103.9, open: 104 } },
    });
    const tail = latest.ohlcvData.slice(-2);
    expect(tail[0]).toEqual(yesterday[0]);
    // The scaffold: never the day's open (104) as a half-hour bar's open.
    expect(tail[1]).toMatchObject({ open: 104.8, high: 105, low: 103.9, close: 104.8, _scaffold: true });
    expect(OFF.stockBombEarlyGapUp.tail[1].high).toBe(105); // the pre-build defect, for contrast
  });

  it('1D with a supplied observed open: a real body (no scaffold flag)', async () => {
    vi.setSystemTime(new Date('2026-10-01T17:00:00.000Z'));
    net.daily.AAPL = dailyHistory('2026-09-30', 100);
    await mount('AAPL', { currentPrice: 104, isCrypto: false, initialTimeframe: '1D', controlled: { extremes: TODAY_STOCK } });
    expect(latest.ohlcvData.at(-1)).toEqual({ date: '2026-10-01', open: 102, high: 106, low: 101.5, close: 104, volume: 0 });
  });

  it('1D without a supplied open: the scaffold — open = close = current, high/low the supplied extremes', async () => {
    vi.setSystemTime(new Date('2026-10-01T17:00:00.000Z'));
    net.daily.AAPL = dailyHistory('2026-09-30', 100);
    await mount('AAPL', {
      currentPrice: 104, isCrypto: false, initialTimeframe: '1D',
      controlled: { extremes: { sessionDate: '2026-10-01', high: 106, low: 101.5 } },
    });
    expect(latest.ohlcvData.at(-1)).toEqual({ date: '2026-10-01', open: 104, high: 106, low: 101.5, close: 104, volume: 0, _scaffold: true });
  });

  it('[V-6 c] 1D gap-down: the previous close (100) is never folded into today\'s high', async () => {
    vi.setSystemTime(new Date('2026-10-01T17:00:00.000Z'));
    net.daily.AAPL = dailyHistory('2026-09-30', 100);
    await mount('AAPL', {
      currentPrice: 95, isCrypto: false, initialTimeframe: '1D',
      controlled: { extremes: { sessionDate: '2026-10-01', high: 97, low: 94 } },
    });
    expect(latest.ohlcvData.at(-1)).toMatchObject({ open: 95, high: 97, low: 94, close: 95, _scaffold: true });
  });

  it('[V-6 c] 1D gap-up: the previous close is never folded into today\'s low', async () => {
    vi.setSystemTime(new Date('2026-10-01T17:00:00.000Z'));
    net.daily.AAPL = dailyHistory('2026-09-30', 100);
    await mount('AAPL', {
      currentPrice: 107, isCrypto: false, initialTimeframe: '1D',
      controlled: { extremes: { sessionDate: '2026-10-01', high: 108, low: 104.5 } },
    });
    expect(latest.ohlcvData.at(-1)).toMatchObject({ open: 107, high: 108, low: 104.5, close: 107, _scaffold: true });
  });

  it('extremes from another session are ignored: the scaffold is the current alone', async () => {
    vi.setSystemTime(new Date('2026-10-01T17:00:00.000Z'));
    net.daily.AAPL = dailyHistory('2026-09-30', 100);
    await mount('AAPL', {
      currentPrice: 104, isCrypto: false, initialTimeframe: '1D',
      controlled: { extremes: { sessionDate: '2026-09-30', high: 106, low: 99, open: 100 } },
    });
    expect(latest.ohlcvData.at(-1)).toEqual({ date: '2026-10-01', open: 104, high: 104, low: 104, close: 104, volume: 0, _scaffold: true });
    expect(latest.todayDailyCandle).toBeNull();
    expect(latest.realtimeExtremes).toBeNull();
  });

  it('1W, new week: the current-week bar is a scaffold dated the session\'s Monday — never opened at the last close', async () => {
    vi.setSystemTime(new Date('2026-10-01T17:00:00.000Z'));
    net.daily.AAPL = dailyHistory('2026-09-30', 100);
    net.weekly.AAPL = [
      { date: '2026-09-22', open: 97, high: 102, low: 96, close: 101, volume: 5200 },
      { date: '2026-09-15', open: 98, high: 100, low: 96, close: 97, volume: 5100 },
    ];
    await mount('AAPL', { currentPrice: 104, isCrypto: false, initialTimeframe: '1W', controlled: { extremes: TODAY_STOCK } });
    expect(latest.ohlcvData.at(-1)).toEqual({ date: '2026-09-28', open: 104, high: 106, low: 101.5, close: 104, volume: 0, _scaffold: true });
  });

  it('1W, current week present: the real weekly candle keeps its open and takes the current and today\'s extremes', async () => {
    vi.setSystemTime(new Date('2026-10-01T17:00:00.000Z'));
    net.daily.AAPL = dailyHistory('2026-09-30', 100);
    net.weekly.AAPL = [
      { date: '2026-09-28', open: 101, high: 104, low: 99, close: 103, volume: 5300 },
      { date: '2026-09-22', open: 97, high: 102, low: 96, close: 101, volume: 5200 },
    ];
    await mount('AAPL', { currentPrice: 104, isCrypto: false, initialTimeframe: '1W', controlled: { extremes: TODAY_STOCK } });
    expect(latest.ohlcvData.at(-1)).toEqual({ date: '2026-09-28', open: 101, high: 106, low: 99, close: 104, volume: 5300 });
  });

  it('crypto bomb: a supplied open is dropped (V-11) — the live bar is always a scaffold', async () => {
    vi.setSystemTime(new Date('2026-10-02T01:40:00.000Z'));
    net.daily.BTC = [{ date: '2026-10-01', open: 60000, high: 61500, low: 59000, close: 60900, volume: 8 }];
    net.intraday.BTC = [
      { date: '2026-10-02T00:30:00.000Z', datetime: '2026-10-02T00:30:00.000Z', timestamp: 1790829000, open: 60200, high: 60900, low: 60100, close: 60800, volume: 6 },
      { date: '2026-10-02T00:00:00.000Z', datetime: '2026-10-02T00:00:00.000Z', timestamp: 1790827200, open: 60000, high: 60500, low: 59800, close: 60200, volume: 5 },
    ];
    await mount('BTC', {
      currentPrice: 61000, isCrypto: true, initialTimeframe: 'bomb',
      controlled: { extremes: { sessionDate: '2026-10-02', high: 61200, low: 59800, open: 60000 } },
    });
    expect(latest.ohlcvData.at(-1)).toMatchObject({ open: 61000, high: 61200, low: 59800, close: 61000, _scaffold: true });
    expect(latest.realtimeExtremes).toEqual({ high: 61200, low: 59800 });
  });
});

describe('ON — controlled todayDailyCandle and daily change (A-3, V-6 b, B-8, B-9)', () => {
  it('Priority 1 is the supplied extremes: only present fields, no close, no zero', async () => {
    vi.setSystemTime(new Date('2026-10-01T17:00:00.000Z'));
    net.daily.AAPL = dailyHistory('2026-09-30', 100);
    await mount('AAPL', {
      currentPrice: 104, isCrypto: false, initialTimeframe: 'bomb',
      controlled: { extremes: { sessionDate: '2026-10-01', high: 106, low: 101.5 } },
    });
    expect(latest.todayDailyCandle).toEqual({ high: 106, low: 101.5, _source: 'controlled' });
    expect('close' in latest.todayDailyCandle).toBe(false);
    expect('open' in latest.todayDailyCandle).toBe(false);
  });

  it('with a supplied open (stock): the open is carried, still no close', async () => {
    vi.setSystemTime(new Date('2026-10-01T17:00:00.000Z'));
    net.daily.AAPL = dailyHistory('2026-09-30', 100);
    await mount('AAPL', { currentPrice: 104, isCrypto: false, initialTimeframe: '1D', controlled: { extremes: TODAY_STOCK } });
    expect(latest.todayDailyCandle).toEqual({ high: 106, low: 101.5, open: 102, _source: 'controlled' });
  });

  it('[B-8] crypto between 8 PM and midnight ET: Priority 2 is the UTC-today candle (no open, no close); previous close skips it', async () => {
    vi.setSystemTime(new Date('2026-10-02T01:30:00.000Z'));
    net.daily.BTC = [
      { date: '2026-10-02', open: 60900, high: 61200, low: 60800, close: 61000, volume: 9 },
      { date: '2026-10-01', open: 60000, high: 61500, low: 59000, close: 60900, volume: 8 },
      { date: '2026-09-30', open: 59500, high: 60100, low: 59000, close: 60000, volume: 7 },
    ];
    await mount('BTC', { currentPrice: 61000, isCrypto: true, initialTimeframe: '1D', controlled: { extremes: null } });
    expect(latest.todayDailyCandle).toEqual({ high: 61200, low: 60800, _source: 'daily' });
    // Pre-build: the previous UTC day (ET-dated) was presented as today.
    expect(OFF.cryptoEveningPriority2.todayDailyCandle.date).toBe('2026-10-01');
    expect(latest.previousClose).toBe(60900);
    expect(latest.dailyChange).toBeCloseTo(((61000 - 60900) / 60900) * 100, 10);
    // Today's real UTC candle is patched with the current, not replaced.
    expect(latest.ohlcvData.at(-1)).toEqual({ date: '2026-10-02', open: 60900, high: 61200, low: 60800, close: 61000, volume: 9 });
    expect(net.calls.some((c) => c[0] === 'getStockPrice')).toBe(false);
  });

  it('stock Priority 2: the daily candle dated today ET, open kept as observed research data, close omitted', async () => {
    vi.setSystemTime(new Date('2026-10-01T21:00:00.000Z'));
    net.daily.AAPL = [{ date: '2026-10-01', open: 101, high: 105, low: 100.5, close: 104, volume: 9 }, ...dailyHistory('2026-09-30', 100)];
    await mount('AAPL', { currentPrice: 104, isCrypto: false, initialTimeframe: '1D', controlled: { extremes: null } });
    expect(latest.todayDailyCandle).toEqual({ high: 105, low: 100.5, open: 101, _source: 'daily' });
    expect(latest.previousClose).toBe(100);
  });

  it('stock daily change: the same figure legacy computes (ET session key)', async () => {
    vi.setSystemTime(new Date('2026-10-01T17:00:00.000Z'));
    net.daily.AAPL = dailyHistory('2026-09-30', 100);
    await mount('AAPL', { currentPrice: 104, isCrypto: false, initialTimeframe: '1D', controlled: { extremes: TODAY_STOCK } });
    expect(latest.previousClose).toBe(OFF.stock1D.previousClose);
    expect(latest.dailyChange).toBe(OFF.stock1D.dailyChange);
  });
});
