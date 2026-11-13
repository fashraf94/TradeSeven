// eodhdAPI.fetchHistoricalOHLCV — the research sheet's Battle chart (build prompt of Nov 13, 2026,
// BC2-2): '5m' bars are intraday (the cache service's 5-minute class), never 'historical' (24 h).
// The real function; the cache service and the network are recorded.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const calls = vi.hoisted(() => ({ get: [], set: [] }));
vi.mock('./cacheService.js', () => ({ default: { get: (cls, key) => { calls.get.push([cls, key]); return null; }, set: (cls, key) => { calls.set.push([cls, key]); } } }));
vi.mock('./apiMonitor.js', () => ({ apiMonitor: { track() {} } }));

import { fetchHistoricalOHLCV } from './eodhdAPI.js';

beforeEach(() => {
  calls.get.length = 0; calls.set.length = 0;
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn(async (url) => ({ ok: true, json: async () => ({ success: true, timeframe: new URL(String(url), 'http://x').searchParams.get('timeframe'), data: [{ date: '2026-10-14T13:30:00.000Z', open: 1, high: 2, low: 1, close: 2, volume: 1 }] }) })));
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("BC2-2 — the client caches '5m' as intraday", () => {
  it('reads and writes the intraday class for 5m (as for 30m); the daily series stays historical', async () => {
    await fetchHistoricalOHLCV('AAPL', '5m', { days: 5 });
    await fetchHistoricalOHLCV('AAPL', '30m', { days: 20 });
    await fetchHistoricalOHLCV('AAPL', '1d', { days: 180 });
    expect(calls.get.map((c) => c[0])).toEqual(['intraday', 'intraday', 'historical']);
    expect(calls.set).toEqual([['intraday', 'ohlcv_AAPL_5m_5d'], ['intraday', 'ohlcv_AAPL_30m_20d'], ['historical', 'ohlcv_AAPL_1d_180d']]);
  });
});
