// api/_utils/intraday/intradayFetch.test.js — contract §4 / §5.3 steps 3–4.
import { describe, it, expect } from 'vitest';
import { fetchQuotes, fetchIntraday1mBars, chunk, mapConcurrent, liveV2Url, liveV1CryptoUrl, intraday1mUrl, redactUrl } from './intradayFetch.js';

const KEY = 'k';
const T0 = 1_789_652_000_000;
const okJson = (json) => ({ ok: true, status: 200, json: async () => json });

const v2 = (sym) => ({ symbol: sym, lastTradePrice: 10, lastTradeTime: T0 - 15 * 60_000, timestamp: Math.floor(T0 / 1000), volume: 5, high: 11, low: 9, open: 10 });

describe('URLs', () => {
  it('Live v2 uses ?s= for every ticker; Live v1 puts the first in the path; 1m bars carry the absolute window', () => {
    expect(liveV2Url({ apiKey: KEY, vendorSymbols: ['AAPL.US', 'MSFT.US'] })).toBe('https://eodhd.com/api/us-quote-delayed?s=AAPL.US,MSFT.US&api_token=k&fmt=json');
    expect(liveV1CryptoUrl({ apiKey: KEY, vendorSymbols: ['BTC-USD.CC', 'ETH-USD.CC'] })).toBe('https://eodhd.com/api/real-time/BTC-USD.CC?api_token=k&fmt=json&s=ETH-USD.CC');
    expect(liveV1CryptoUrl({ apiKey: KEY, vendorSymbols: ['BTC-USD.CC'] })).toBe('https://eodhd.com/api/real-time/BTC-USD.CC?api_token=k&fmt=json');
    expect(intraday1mUrl({ apiKey: KEY, vendorSymbol: 'AAPL.US', fromSec: 1, toSec: 2 })).toBe('https://eodhd.com/api/intraday/AAPL.US?api_token=k&fmt=json&interval=1m&from=1&to=2');
    expect(redactUrl(liveV2Url({ apiKey: 'SECRET', vendorSymbols: ['A'] }))).not.toContain('SECRET');
  });
});

describe('fetchQuotes — batching, units, timeouts, concurrency', () => {
  it('batches ≤ 20 tickers per request, counts 1 unit per ticker REQUESTED even when a request fails, reports failures', async () => {
    const stocks = Array.from({ length: 45 }, (_, i) => ({ sym: `S${i}`, vendor: `S${i}.US` }));
    const urls = [];
    const fetchImpl = async (url) => {
      urls.push(url);
      const syms = decodeURIComponent(url.match(/s=([^&]*)/)[1]).split(',');
      if (syms[0] === 'S40.US') return { ok: false, status: 500 };
      const data = {};
      for (const v of syms) if (v !== 'S3.US') data[v] = v2(v);
      return okJson({ data });
    };
    const out = await fetchQuotes({ apiKey: KEY, stocks, crypto: [], fetchImpl, now: () => T0, timeoutMs: 100, concurrency: 4, maxPerRequest: 20 });
    expect(out.requests).toBe(3);
    expect(urls).toHaveLength(3);
    expect(out.unitsRequested).toBe(45);
    expect(out.unitsBySource).toEqual({ live_v2: 45, live_v1_crypto: 0 });
    expect(Object.keys(out.observations)).toHaveLength(39); // 45 − 5 failed batch − 1 omitted
    expect(out.missing).toContain('S3');
    expect(out.missing).toContain('S40');
    expect(out.anomalies.missing).toBe(6);
    expect(out.anomalies.requestFailed).toBe(1);
    expect(out.failures[0]).toMatchObject({ kind: 'live_v2', status: 500 });
    expect(out.observations.S0.availableAt).toBe(T0);
  });
  it('a hung request is abandoned at the timeout and counted as a failure; other batches still return', async () => {
    const stocks = [{ sym: 'A', vendor: 'A.US' }, ...Array.from({ length: 20 }, (_, i) => ({ sym: `B${i}`, vendor: `B${i}.US` }))];
    const fetchImpl = (url, { signal }) => new Promise((resolve, reject) => {
      // The second batch holds only B19 (21 symbols → [A, B0..B18], [B19]); it hangs.
      if (url.includes('B19.US')) {
        signal.addEventListener('abort', () => { const e = new Error('aborted'); e.name = 'AbortError'; reject(e); });
        return;
      }
      const syms = decodeURIComponent(url.match(/s=([^&]*)/)[1]).split(',');
      const data = {};
      for (const v of syms) data[v] = v2(v);
      resolve(okJson({ data }));
    });
    const out = await fetchQuotes({ apiKey: KEY, stocks, crypto: [], fetchImpl, now: () => T0, timeoutMs: 20, concurrency: 4, maxPerRequest: 20 });
    expect(out.observations.A).toBeTruthy();
    expect(out.failures).toHaveLength(1);
    expect(out.failures[0].error).toBe('timeout');
    expect(out.missing).toEqual(['B19']);
    expect(out.unitsRequested).toBe(21);
  });
  it('runs at most `concurrency` requests at once', async () => {
    let inFlight = 0; let peak = 0;
    const fetchImpl = async () => {
      inFlight += 1; peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight -= 1;
      return okJson({ data: {} });
    };
    const stocks = Array.from({ length: 200 }, (_, i) => ({ sym: `S${i}`, vendor: `S${i}.US` }));
    await fetchQuotes({ apiKey: KEY, stocks, crypto: [], fetchImpl, now: () => T0, timeoutMs: 100, concurrency: 4, maxPerRequest: 20 });
    expect(peak).toBeLessThanOrEqual(4);
    expect(peak).toBeGreaterThan(1);
  });
  it('crypto goes through Live v1 and lands in the same observation map', async () => {
    const fetchImpl = async (url) => okJson(url.includes('real-time') ? [{ code: 'BTC-USD.CC', close: 1, timestamp: Math.floor(T0 / 1000) }] : { data: {} });
    const out = await fetchQuotes({ apiKey: KEY, stocks: [], crypto: [{ sym: 'BTC', vendor: 'BTC-USD.CC' }], fetchImpl, now: () => T0, timeoutMs: 100, concurrency: 4, maxPerRequest: 20 });
    expect(out.observations.BTC.source).toBe('eodhd_live_v1_crypto');
    expect(out.unitsBySource).toEqual({ live_v2: 0, live_v1_crypto: 1 });
  });
});

describe('fetchIntraday1mBars — raw rows, 5 units', () => {
  it('returns the vendor rows unfiltered (the 16:00 row survives) and costs 5 units even on failure', async () => {
    const rows = [{ timestamp: 1, close: 1, volume: null, open: 1, high: 1, low: 1 }];
    const ok = await fetchIntraday1mBars({ apiKey: KEY, vendorSymbol: 'AAPL.US', fromSec: 1, toSec: 2, fetchImpl: async () => okJson(rows), timeoutMs: 100 });
    expect(ok).toEqual({ ok: true, bars: rows, units: 5, status: 200 });
    const bad = await fetchIntraday1mBars({ apiKey: KEY, vendorSymbol: 'AAPL.US', fromSec: 1, toSec: 2, fetchImpl: async () => ({ ok: false, status: 404 }), timeoutMs: 100 });
    expect(bad).toMatchObject({ ok: false, units: 5, status: 404 });
  });
  it('chunk and mapConcurrent helpers', async () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(await mapConcurrent([1, 2, 3], 2, async (x) => x * 2)).toEqual([2, 4, 6]);
    expect(await mapConcurrent([], 2, async (x) => x)).toEqual([]);
  });
});
