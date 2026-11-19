// @vitest-environment jsdom
//
// FX-9 — today's candle is dated by the MARKET's day, not the device's (build prompt of 19 Nov 2026, §3; the 18 Nov
// report's L2-2). The 1D live candle (useResearchData, the non-controlled path) appended or patched "today" from the
// device's local midnight: its date was that midnight's UTC date (east of UTC: yesterday's), and the weekend was the
// device's weekday. It now reads the ET session date for a stock, as the controlled path already does (V-11).
//
// The rule every device must now follow is an ET device's of today: after the last daily bar, on an ET weekday, a
// synthetic bar dated today (ET) carries the live price; on the last bar's own ET day, that bar is patched; on an ET
// weekend nothing is added. The REAL hook; the network and the WebSocket high/low stubbed; the device's clock set per
// row (process.env.TZ, read by Node at each Date call). The holiday rows pin today's behaviour on an ET clock
// (a synthetic bar on Thanksgiving) — the calendar is not consulted, as before.

import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

const net = vi.hoisted(() => ({ last: null }));
vi.mock('../../services/eodhdAPI', () => ({
  fetchHistoricalOHLCV: (symbol, timeframe) => {
    if (timeframe !== '1d') return Promise.resolve([]);
    // 60 weekday bars, newest first, ending on net.last (a decimal close per bar).
    const out = [];
    const d = new Date(`${net.last}T00:00:00Z`);
    while (out.length < 60) {
      const dow = d.getUTCDay();
      if (dow !== 0 && dow !== 6) {
        const close = 200.37 - 0.13 * out.length;
        out.push({ date: d.toISOString().slice(0, 10), open: close - 0.41, high: close + 1.13, low: close - 1.07, close, volume: 1_000_000 + out.length });
      }
      d.setUTCDate(d.getUTCDate() - 1);
    }
    return Promise.resolve(out);
  },
  getStockPrice: () => Promise.resolve(null),
}));
vi.mock('../../services/websocketService', () => ({ getDailyHL: () => null }));

import useResearchData from './useResearchData';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const LIVE = 203.61;
const TZ0 = process.env.TZ;
let container;
let root;
let latest;
function Probe() {
  latest = useResearchData('AAPL', { currentPrice: LIVE, isCrypto: false, initialTimeframe: '1D' });
  return null;
}
beforeAll(() => { vi.useFakeTimers({ toFake: ['Date'] }); });
afterAll(() => { vi.useRealTimers(); process.env.TZ = TZ0; });
afterEach(() => { act(() => root.unmount()); container.remove(); });

async function lastCandleAt(zone, iso, lastBar) {
  process.env.TZ = zone;
  vi.setSystemTime(new Date(iso));
  net.last = lastBar;
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  await act(async () => { root.render(<Probe />); });
  for (let i = 0; i < 5; i++) await act(async () => { await Promise.resolve(); });
  const bars = latest.ohlcvData;
  const last = bars.at(-1);
  return { date: String(last.date).slice(0, 10), live: last.close === LIVE, count: bars.length };
}

// Each instant: the series' last bar (the latest session past its 16:00 ET close), and what an ET device draws.
//   append D — a synthetic bar dated D carrying the live price; patch D — bar D carries the live price; none.
const INSTANTS = [
  ['Wed 18 Nov, 08:30 ET (before the open)', '2026-11-18T13:30:00Z', '2026-11-17', { date: '2026-11-18', live: true, added: true }],
  ['Wed 18 Nov, 21:30 ET (after the close)', '2026-11-19T02:30:00Z', '2026-11-18', { date: '2026-11-18', live: true, added: false }],
  ['Tue 17 Nov, 00:30 ET (just past ET midnight)', '2026-11-17T05:30:00Z', '2026-11-16', { date: '2026-11-17', live: true, added: true }],
  ['Fri 20 Nov, 20:30 ET (Saturday east of ET)', '2026-11-21T01:30:00Z', '2026-11-20', { date: '2026-11-20', live: true, added: false }],
  ['Sat 21 Nov, 12:00 ET', '2026-11-21T17:00:00Z', '2026-11-20', { date: '2026-11-20', live: false, added: false }],
  ['Sun 22 Nov, 20:30 ET (Monday east of ET)', '2026-11-23T01:30:00Z', '2026-11-20', { date: '2026-11-20', live: false, added: false }],
  ['Thu 26 Nov, 12:00 ET (Thanksgiving: a holiday)', '2026-11-26T17:00:00Z', '2026-11-25', { date: '2026-11-26', live: true, added: true }],
];
const CLOCKS = [
  ['east of UTC', 'Europe/Berlin'],
  ['east of UTC', 'Asia/Tokyo'],
  ['at UTC', 'UTC'],
  ['west of UTC', 'America/Sao_Paulo'],
  ['west of UTC (a US zone)', 'America/Los_Angeles'],
  ['the market\'s own clock', 'America/New_York'],
];

describe('FX-9: every device draws the market day\'s candle — the same as an ET device', () => {
  for (const [where, zone] of CLOCKS) {
    it.each(INSTANTS)(`${where} (${zone}): %s`, async (_label, iso, lastBar, want) => {
      const got = await lastCandleAt(zone, iso, lastBar);
      expect({ date: got.date, live: got.live, added: got.count === 61 }).toEqual(want);
    });
  }
});
