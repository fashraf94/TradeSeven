// /api/stocks/historical — the research sheet's Battle chart bar size (build prompt of Nov 13, 2026,
// BC2-2): '5m' is an intraday timeframe of its own (EODHD intraday, interval 5m, 5 days), served
// and cached like '30m'; a daily fallback says so in `timeframe`. The provider is faked; no network.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../_utils/security.js', () => ({ applySecurityMiddleware: () => false }));
const cache = vi.hoisted(() => new Map());
vi.mock('../_utils/serverCache.js', () => ({
  getFromCache: (k) => cache.get(k) ?? null,
  setInCache: (k, v, ttl) => { cache.set(k, v); cache.set(`ttl:${k}`, ttl); },
  setCacheHeaders: () => {},
  CACHE_TIERS: { TECHNICAL: { sMaxAge: 3600, staleWhileRevalidate: 600, memoryTTL: 3600 } },
}));

import handler from './historical.js';

const res = () => {
  const r = { code: null, body: null, headers: {} };
  r.status = (c) => { r.code = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  return r;
};
const intradayRow = (ts) => ({ timestamp: ts, open: 100, high: 101, low: 99, close: 100.5, volume: 10 });

let urls;
const oldKey = process.env.EODHD_API_KEY;
beforeEach(() => {
  cache.clear();
  urls = [];
  process.env.EODHD_API_KEY = 'isolated-key';
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn(async (u) => {
    urls.push(String(u));
    if (String(u).includes('/intraday/')) return { ok: true, json: async () => [intradayRow(1792000200), intradayRow(1792000500)] };
    return { ok: true, json: async () => [{ date: '2026-10-14', open: 1, high: 2, low: 1, close: 2, volume: 1 }] };
  }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); if (oldKey === undefined) delete process.env.EODHD_API_KEY; else process.env.EODHD_API_KEY = oldKey; });

describe("BC2-2 — the '5m' timeframe", () => {
  it('asks EODHD intraday at interval=5m and answers with intraday bars (newest-first), timeframe 5m', async () => {
    const r = res();
    await handler({ query: { symbol: 'AAPL', timeframe: '5m', days: '5' } }, r);
    expect(urls).toHaveLength(1);
    expect(urls[0]).toMatch(/\/intraday\/AAPL\.US\?.*interval=5m/);
    expect(r.code).toBe(200);
    expect(r.body.timeframe).toBe('5m');
    // The intraday bar's own time survives as its ISO date (the Battle chart reads it; no daily fallback).
    expect(r.body.data.map((d) => d.date)).toEqual([new Date(1792000500 * 1000).toISOString(), new Date(1792000200 * 1000).toISOString()]);
  });
  it('cached by symbol, timeframe and days: a second ask for the same bars reaches the provider no more', async () => {
    await handler({ query: { symbol: 'AAPL', timeframe: '5m', days: '5' } }, res());
    await handler({ query: { symbol: 'AAPL', timeframe: '5m', days: '5' } }, res());
    expect(urls).toHaveLength(1);
  });
  it("cached five minutes, not TECHNICAL's hour (a live session's bars — PR 2 review A1/C2); 30m keeps its tier", async () => {
    await handler({ query: { symbol: 'AAPL', timeframe: '5m', days: '5' } }, res());
    await handler({ query: { symbol: 'AAPL', timeframe: '30m', days: '20' } }, res());
    expect(cache.get('ttl:historical_AAPL_5m_5')).toBe(300);
    expect(cache.get('ttl:historical_AAPL_30m_20')).toBe(3600);
  });
});
