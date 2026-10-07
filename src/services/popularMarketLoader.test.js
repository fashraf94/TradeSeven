// @vitest-environment jsdom
//
// src/services/popularMarketLoader.test.js
//
// EODHD Quick Wins QW-4 — the app-wide market poll's client half (build report
// docs/audits/20261007_BUILD_EODHD_QUICK_WINS.md §2, §5).
//
// END TO END, in process: the client's `fetch('/api/…')` is answered by the
// REAL route handlers (api/stocks/prices.js, api/crypto/prices.js,
// api/market/popular.js over the transaction-faithful Firestore fake), and
// those routes' own `fetch` reaches a stubbed vendor. So the comparison below is
// the old client path through the per-symbol routes against the new client path
// through the shared route, on the SAME vendor data:
//
//   • flag OFF — the pre-build sequence: the stock list (handed to App.jsx),
//     then the crypto list, through the per-symbol routes; never the new route;
//   • flag ON — one request, to /api/market/popular; the per-tab price cache is
//     NEVER written (founder ruling, Oct 7);
//   • the lists App.jsx receives are IDENTICAL, field for field, either way —
//     on success, with a symbol the vendor withholds, with one list down, and
//     with everything down (today's fallbacks);
//   • a hermetic featureFlags mock that omits the flag reads as OFF, never throws;
//   • App.jsx's market effect calls the loader (source pin — no test imports App.jsx).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeMandateFakeDb } from '../../api/_utils/__testsupport__/mandateFakeFirestore.js';

const flag = vi.hoisted(() => ({ on: false }));
vi.mock('../config/featureFlags.js', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, get EODHD_QUICK_WINS_ENABLED() { return flag.on; } };
});
const dbBox = vi.hoisted(() => ({ db: null }));
vi.mock('../../api/_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => dbBox.db }));
vi.mock('../../api/_utils/security.js', () => ({ applySecurityMiddleware: () => false }));

const { loadPopularMarketData } = await import('./popularMarketLoader.js');
const { default: cacheService } = await import('./cacheService.js');
const { default: stockRoute } = await import('../../api/stocks/prices.js');
const { default: cryptoRoute } = await import('../../api/crypto/prices.js');
const { default: popularRoute } = await import('../../api/market/popular.js');

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = readFileSync(resolve(HERE, '..', 'App.jsx'), 'utf8');

// ── The vendor (stubbed) and the routes (real), behind the client's fetch ────
let vendorDown;
let clientRequests;
function vendorItems(codes) {
  return codes.filter((c) => c !== 'AMZN.US' && c !== 'DOGE-USD.CC').map((code, i) => ({
    code, timestamp: 1791385200 + i, gmtoffset: 0,
    open: 40 + i, high: 41 + i, low: 39 + i, close: i === 4 ? 0 : 40.5 + i, volume: i === 5 ? undefined : 1000 + i,
    previousClose: 40.2 + i, change: 0.3, change_p: i % 3 === 0 ? 0.75 : -1.25,
  }));
}
function makeRes() {
  const res = { statusCode: 200, headers: {}, body: undefined };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = JSON.parse(JSON.stringify(b)); return res; };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.removeHeader = (k) => { delete res.headers[k]; };
  return res;
}
function installNetwork() {
  vendorDown = { stocks: false, crypto: false };
  clientRequests = [];
  globalThis.fetch = vi.fn(async (input) => {
    const url = String(input);
    if (url.startsWith('https://eodhd.com/')) {
      const codes = decodeURIComponent(url.match(/\/api\/real-time\/([^?]+)\?/)[1]).split(',');
      const kind = codes[0].endsWith('.CC') ? 'crypto' : 'stocks';
      if (vendorDown[kind]) return { ok: false, status: 503, json: async () => null };
      return { ok: true, status: 200, json: async () => vendorItems(codes) };
    }
    clientRequests.push(url);
    const u = new URL(url, 'https://app.test');
    const req = { method: 'GET', query: Object.fromEntries(u.searchParams), headers: {} };
    const res = makeRes();
    if (u.pathname === '/api/stocks/prices') await stockRoute(req, res);
    else if (u.pathname === '/api/crypto/prices') await cryptoRoute(req, res);
    else if (u.pathname === '/api/market/popular') await popularRoute(req, res);
    else throw new Error(`unexpected client request ${url}`);
    return { ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, json: async () => res.body };
  });
}

async function load() {
  const calls = [];
  const out = {};
  await loadPopularMarketData(
    (s) => { calls.push(['stocks', clientRequests.length]); out.stocks = s; },
    (c) => { calls.push(['crypto', clientRequests.length]); out.crypto = c; },
  );
  return { ...out, calls };
}

// Each test runs on its OWN 10-minute slot of the session clock: the per-symbol
// routes keep a module-level 60 s L1 cache (api/_utils/serverCache.js, no clear
// export), and a frozen clock would let one test's answer leak into the next.
let slot = 0;
beforeEach(() => {
  flag.on = false;
  dbBox.db = makeMandateFakeDb();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(Date.parse('2026-10-07T14:00:00.000Z') + (slot++) * 10 * 60_000)); // Wed from 10:00 ET
  process.env.EODHD_API_KEY = 'test-key';
  vi.spyOn(Math, 'random').mockReturnValue(0.5);          // generateCommunityData
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  cacheService.clearAll();
  installNetwork();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** Old path then new path, each from a cold tab, on the same vendor data. */
async function bothPaths() {
  flag.on = false;
  cacheService.clearAll();
  const before = clientRequests.length;
  const oldOut = await load();
  const oldRequests = clientRequests.slice(before);
  flag.on = true;
  cacheService.clearAll();
  const setSpy = vi.spyOn(cacheService, 'set');
  const mid = clientRequests.length;
  const newOut = await load();
  const newRequests = clientRequests.slice(mid);
  const priceWrites = setSpy.mock.calls.filter(([type]) => type === 'prices' || type === 'crypto');
  setSpy.mockRestore();
  return { oldOut, newOut, oldRequests, newRequests, priceWrites };
}

describe('QW-4 client — which path runs', () => {
  it('flag OFF: the stock list then the crypto list through the per-symbol routes; never the shared route', async () => {
    const { calls } = await load();
    expect(clientRequests).toHaveLength(2);
    expect(clientRequests[0]).toMatch(/^\/api\/stocks\/prices\?symbols=/);
    expect(clientRequests[1]).toMatch(/^\/api\/crypto\/prices\?symbols=/);
    // App.jsx received the stock list BEFORE the crypto request went out.
    expect(calls).toEqual([['stocks', 1], ['crypto', 2]]);
  });

  it('flag ON: exactly one request, to /api/market/popular, and the per-tab price cache is never written', async () => {
    flag.on = true;
    const setSpy = vi.spyOn(cacheService, 'set');
    await load();
    expect(clientRequests).toEqual(['/api/market/popular']);
    expect(setSpy.mock.calls.filter(([type]) => type === 'prices' || type === 'crypto')).toEqual([]);
    expect(cacheService.get('prices', 'AAPL')).toBeNull();
    expect(cacheService.get('crypto', 'BTC')).toBeNull();
  });
});

describe('QW-4 client — App.jsx receives the identical lists, field for field', () => {
  it('on success (one stock and one crypto withheld by the vendor, a zero close, an absent volume)', async () => {
    const { oldOut, newOut, newRequests, priceWrites } = await bothPaths();
    expect(newRequests).toEqual(['/api/market/popular']);
    expect(priceWrites).toEqual([]);
    expect(newOut.stocks).toHaveLength(54);
    expect(newOut.crypto).toHaveLength(33);
    expect(newOut.stocks).toEqual(oldOut.stocks);
    expect(newOut.crypto).toEqual(oldOut.crypto);
    // The withheld symbols took the configured fallback on both paths.
    expect(newOut.stocks.find((s) => s.symbol === 'AMZN')).toEqual(oldOut.stocks.find((s) => s.symbol === 'AMZN'));
  });

  it('with the crypto list down (stocks real, crypto all fallbacks)', async () => {
    vendorDown.crypto = true;
    const { oldOut, newOut } = await bothPaths();
    expect(newOut).toEqual(expect.objectContaining({ stocks: oldOut.stocks, crypto: oldOut.crypto }));
  });

  it('with everything down (today\'s fallbacks for every symbol)', async () => {
    vendorDown.stocks = true;
    vendorDown.crypto = true;
    const { oldOut, newOut } = await bothPaths();
    expect(newOut.stocks).toEqual(oldOut.stocks);
    expect(newOut.crypto).toEqual(oldOut.crypto);
    expect(newOut.stocks.every((s) => typeof s.price === 'number')).toBe(true);
    // Both paths really fell back: AAPL is not the vendor's 40.5.
    expect(oldOut.stocks.find((s) => s.symbol === 'AAPL').price).not.toBe(40.5);
    expect(newOut.stocks.find((s) => s.symbol === 'AAPL').price).not.toBe(40.5);
  });

  it('every field a consumer reads today is present on the new path\'s items', async () => {
    flag.on = true;
    const { stocks, crypto } = await load();
    for (const k of ['symbol', 'name', 'price', 'change', 'percentChange', 'priceChange7d', 'priceChange30d', 'volatility', 'week52High', 'week52Low', 'marketCap', 'volume24h', 'communityData']) {
      expect(stocks[0]).toHaveProperty(k);
    }
    for (const k of ['symbol', 'name', 'price', 'change24h', 'percentChange', 'priceChange7d', 'priceChange30d', 'volatility', 'week52High', 'week52Low', 'marketCap', 'volume24h', 'communityData']) {
      expect(crypto[0]).toHaveProperty(k);
    }
  });
});

describe('QW-4 client — fail-safe and wiring', () => {
  it('a hermetic featureFlags mock that omits the flag reads as OFF and never throws', async () => {
    vi.resetModules();
    vi.doMock('../config/featureFlags.js', () => ({}));
    const fresh = await import('./popularMarketLoader.js');
    const seen = [];
    await fresh.loadPopularMarketData(() => seen.push('stocks'), () => seen.push('crypto'));
    expect(seen).toEqual(['stocks', 'crypto']);
    expect(clientRequests.some((u) => u.startsWith('/api/market/popular'))).toBe(false);
    vi.doUnmock('../config/featureFlags.js');
  });

  it('App.jsx\'s visibility-gated market effect calls the loader, and nothing else in App.jsx calls the old list helpers', () => {
    const effect = APP.slice(APP.indexOf('// Load market data on mount (pauses when tab is hidden)'), APP.indexOf('}, [isPageVisible]);'));
    expect(effect).toContain('if (!isPageVisible) return;');
    expect(effect).toContain('await loadPopularMarketData(setStocksData, setCryptoData);');
    expect(effect).toContain('setInterval(loadMarketData, 5 * 60 * 1000)');
    expect(APP).not.toMatch(/stockAPI\.getPopular(Stocks|Crypto)\(/);
    expect(APP).toMatch(/^import \{ loadPopularMarketData \} from '\.\/services\/popularMarketLoader';\r?$/m);
  });
});
