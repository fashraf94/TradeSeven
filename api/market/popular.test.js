// @vitest-environment node
//
// api/market/popular.test.js
//
// EODHD Quick Wins QW-4 — GET /api/market/popular and its shared cache (build
// report docs/audits/20261007_BUILD_EODHD_QUICK_WINS.md §2, §5).
//
// The REAL route over the REAL cache/lease module (api/_utils/popularMarketCache.js)
// and the TRANSACTION-FAITHFUL Firestore fake (mandateFakeFirestore.js —
// versioned docs, read-set validation, retry), so concurrent lease takers race
// exactly as Firestore transactions do. The vendor is the only stub, and it
// counts every upstream request per list.
//
// Dependency-surface guard (BUILD_RULES §4): this file imports the route
// UNMOCKED, and the route imports src/data/assets.js and src/config/featureFlags.js
// — if a browser-only dependency ever entered that graph, this import would
// explode in the Node test environment. Never mock those two imports here.
//
// Proofs: N simulated tabs → ONE upstream fetch per list, independent of N; the
// records are field-for-field the per-symbol routes' own; TTL, market-closed
// freeze and pre-market rules; lease takeover, waiting and give-up; flag off →
// 404 with no read and no vendor call; the CDN header only on a complete answer.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeMandateFakeDb } from '../_utils/__testsupport__/mandateFakeFirestore.js';

const flag = vi.hoisted(() => ({ on: true }));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, get EODHD_QUICK_WINS_ENABLED() { return flag.on; } };
});
const dbBox = vi.hoisted(() => ({ db: null }));
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => dbBox.db }));
vi.mock('../_utils/security.js', () => ({ applySecurityMiddleware: () => false }));

const { default: handler, popularStockSymbols, popularCryptoSymbols } = await import('./popular.js');
const { readPopularList, POPULAR_MARKET_TTL_MS, POPULAR_MARKET_WAIT_MS } = await import('../_utils/popularMarketCache.js');
const { default: stockRoute } = await import('../stocks/prices.js');
const { default: cryptoRoute } = await import('../crypto/prices.js');

const OPEN = '2026-10-07T15:00:00.000Z';   // Wed 11:00 ET — session open

function makeRes() {
  const res = { statusCode: null, headers: {}, body: undefined };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = JSON.parse(JSON.stringify(b)); return res; };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.removeHeader = (k) => { delete res.headers[k]; };
  return res;
}
const GET = (query = {}) => ({ method: 'GET', query, headers: {} });

// ── The vendor: one real-time list request returns one item per code ─────────
let upstream;          // { stocks: n, crypto: n }
let vendorDown;        // { stocks: bool, crypto: bool }
function itemFor(code, i) {
  const base = 50 + i * 3.1;
  const item = {
    code, timestamp: 1791385200 + i, gmtoffset: 0,
    open: +(base - 0.5).toFixed(2), high: +(base + 1).toFixed(2), low: +(base - 1).toFixed(2),
    close: +base.toFixed(2), volume: 100_000 + i, previousClose: +(base - 0.8).toFixed(2),
    change: 0.8, change_p: 1.6,
  };
  if (i === 2) item.close = 0;            // price falls to previousClose — the route's own `||`
  if (i === 3) delete item.volume;        // an undefined field (Firestore rejects undefined)
  return item;
}
function installVendor() {
  upstream = { stocks: 0, crypto: 0 };
  vendorDown = { stocks: false, crypto: false };
  globalThis.fetch = vi.fn(async (url) => {
    const m = String(url).match(/\/api\/real-time\/([^?]+)\?/);
    const codes = decodeURIComponent(m[1]).split(',');
    const kind = codes[0].endsWith('.CC') ? 'crypto' : 'stocks';
    upstream[kind]++;
    if (vendorDown[kind]) return { ok: false, status: 503, json: async () => null };
    // One code is never returned, so a consumer's fallback path is exercised.
    const items = codes.filter((c) => c !== 'AMZN.US' && c !== 'DOGE-USD.CC').map(itemFor);
    return { ok: true, status: 200, json: async () => items };
  });
}

beforeEach(() => {
  flag.on = true;
  dbBox.db = makeMandateFakeDb();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(OPEN));
  process.env.EODHD_API_KEY = 'test-key';
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  installVendor();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('QW-4 — N tabs cost ONE upstream fetch per list, independent of N', () => {
  for (const n of [1, 5, 40]) {
    it(`${n} concurrent tab poll(s) → 1 stock request + 1 crypto request, every tab served the same lists`, async () => {
      const results = await Promise.all(Array.from({ length: n }, async () => {
        const res = makeRes();
        await handler(GET(), res);
        return res;
      }));
      expect(upstream).toEqual({ stocks: 1, crypto: 1 });
      for (const r of results) {
        expect(r.statusCode).toBe(200);
        expect(r.body.stocks).toEqual(results[0].body.stocks);
        expect(r.body.crypto).toEqual(results[0].body.crypto);
      }
      const sources = results.flatMap((r) => [r.body.source.stocks, r.body.source.crypto]);
      expect(sources.filter((s) => s === 'fetched')).toHaveLength(2);
    });
  }

  it('later polls inside the 60 s TTL cost nothing; the first poll after it costs one fetch per list', async () => {
    await handler(GET(), makeRes());
    vi.setSystemTime(new Date(Date.parse(OPEN) + POPULAR_MARKET_TTL_MS - 1000));
    for (let i = 0; i < 10; i++) await handler(GET(), makeRes());
    expect(upstream).toEqual({ stocks: 1, crypto: 1 });
    vi.setSystemTime(new Date(Date.parse(OPEN) + POPULAR_MARKET_TTL_MS + 1000));
    await handler(GET(), makeRes());
    expect(upstream).toEqual({ stocks: 2, crypto: 2 });
  });

  it('the shared TTL is ONE named constant of 60 s (founder ruling)', () => {
    expect(POPULAR_MARKET_TTL_MS).toBe(60_000);
  });
});

describe('QW-4 — the records are the per-symbol routes\' own, field for field', () => {
  it('stocks: identical to what /api/stocks/prices returns for the whole list (as a cold tab requests it)', async () => {
    const res = makeRes();
    await handler(GET(), res);
    const single = makeRes();
    await stockRoute(GET({ symbols: popularStockSymbols().join(','), nocache: '1' }), single);
    expect(single.statusCode).toBe(200);
    expect(res.body.stocks.prices).toEqual(single.body.prices);
    expect(res.body.stocks.count).toBe(single.body.count);
    expect(Object.keys(res.body.stocks.prices).length).toBe(popularStockSymbols().length - 1); // AMZN withheld
  });

  it('crypto: identical to what /api/crypto/prices returns for the whole list', async () => {
    const res = makeRes();
    await handler(GET(), res);
    const single = makeRes();
    await cryptoRoute(GET({ symbols: popularCryptoSymbols().join(','), nocache: '1' }), single);
    expect(single.statusCode).toBe(200);
    expect(res.body.crypto.prices).toEqual(single.body.prices);
    expect(res.body.crypto.count).toBe(single.body.count);
  });

  it('a cache-served answer carries the same records as the fetching one (the doc is the JSON a tab receives)', async () => {
    const first = makeRes();
    await handler(GET(), first);
    const second = makeRes();
    await handler(GET(), second);
    expect(second.body.source).toEqual({ stocks: 'cache', crypto: 'cache' });
    expect(second.body.stocks).toEqual(first.body.stocks);
    expect(second.body.crypto).toEqual(first.body.crypto);
  });

  it('the server owns the list: the same 54 stocks + 33 crypto the client\'s popular helpers request', () => {
    expect(popularStockSymbols()).toHaveLength(54);
    expect(popularCryptoSymbols()).toHaveLength(33);
  });
});

describe('QW-4 — market-aware TTL (today\'s client rule)', () => {
  it('market closed: stocks freeze until the next open, crypto still refreshes every 60 s', async () => {
    vi.setSystemTime(new Date('2026-10-07T23:00:00.000Z')); // 19:00 ET
    await handler(GET(), makeRes());
    vi.setSystemTime(new Date('2026-10-08T01:00:00.000Z')); // 21:00 ET
    await handler(GET(), makeRes());
    expect(upstream).toEqual({ stocks: 1, crypto: 2 });
  });

  it('overnight the stock list holds while its age is inside the time left to the open (the client\'s getEffectiveTTL rule)', async () => {
    vi.setSystemTime(new Date('2026-10-08T02:00:00.000Z')); // 22:00 ET
    await handler(GET(), makeRes());
    vi.setSystemTime(new Date('2026-10-08T03:00:00.000Z')); // 23:00 ET — 1 h old, 10.5 h to the open
    await handler(GET(), makeRes());
    expect(upstream.stocks).toBe(1);
  });

  it('inside 9:20–9:30 ET the stock list falls back to 60 s (the client evicts closed-market prices there)', async () => {
    vi.setSystemTime(new Date('2026-10-08T13:21:00.000Z')); // 09:21 ET
    await handler(GET(), makeRes());
    // 2 min later: inside the time left to the open (7 min), so the freeze alone
    // would serve it — the pre-market rule makes it 60 s and it re-fetches.
    vi.setSystemTime(new Date('2026-10-08T13:23:00.000Z'));
    await handler(GET(), makeRes());
    expect(upstream.stocks).toBe(2);
  });
});

describe('QW-4 — the lease', () => {
  const fetchList = vi.fn(async () => ({ prices: { AAPL: { price: 1 } }, count: 1 }));
  beforeEach(() => fetchList.mockClear());

  it('a dead holder\'s expired lease is taken over', async () => {
    const db = makeMandateFakeDb({ 'marketDataLeases/stocks_popular': { owner: 'dead', expiresAtMs: Date.now() - 1 } });
    const r = await readPopularList(db, 'stocks', { fetchList });
    expect(r.source).toBe('fetched');
    expect(fetchList).toHaveBeenCalledTimes(1);
    expect(db._get('marketDataLeases/stocks_popular')).toBeUndefined(); // released
  });

  it('a live foreign lease: the waiter never fetches, it reads the holder\'s write', async () => {
    const db = makeMandateFakeDb({ 'marketDataLeases/stocks_popular': { owner: 'holder', expiresAtMs: Date.now() + 10_000 } });
    const sleep = vi.fn(async () => {
      await db.collection('marketDataCache').doc('stocks_popular').set({ data: { prices: {}, count: 0 }, cachedAt: new Date(), ttlType: 'popular' });
    });
    const r = await readPopularList(db, 'stocks', { fetchList, sleep });
    expect(r.source).toBe('waited');
    expect(fetchList).not.toHaveBeenCalled();
  });

  it('a waiter gives up after POPULAR_MARKET_WAIT_MS without ever fetching', async () => {
    const db = makeMandateFakeDb({ 'marketDataLeases/stocks_popular': { owner: 'holder', expiresAtMs: Date.now() + 10 * POPULAR_MARKET_WAIT_MS } });
    let t = Date.now();
    await expect(readPopularList(db, 'stocks', { fetchList, now: () => t, sleep: async () => { t += 5_000; } }))
      .rejects.toThrow(/held the lease/);
    expect(fetchList).not.toHaveBeenCalled();
  });

  it('a failed fetch releases the lease, so the next caller can take it', async () => {
    const db = makeMandateFakeDb();
    await expect(readPopularList(db, 'stocks', { fetchList: async () => { throw new Error('vendor 503'); } })).rejects.toThrow('vendor 503');
    expect(db._get('marketDataLeases/stocks_popular')).toBeUndefined();
    const r = await readPopularList(db, 'stocks', { fetchList });
    expect(r.source).toBe('fetched');
  });
});

describe('QW-4 — the route\'s edges', () => {
  it('flag OFF → 404, no Firestore read, no vendor call', async () => {
    flag.on = false;
    const spy = vi.spyOn(dbBox.db, 'collection');
    const res = makeRes();
    await handler(GET(), res);
    expect(res.statusCode).toBe(404);
    expect(spy).not.toHaveBeenCalled();
    expect(upstream).toEqual({ stocks: 0, crypto: 0 });
  });

  it('a complete answer carries the per-symbol routes\' CDN tier (s-maxage 60 ≤ the TTL)', async () => {
    const res = makeRes();
    await handler(GET(), res);
    expect(res.headers['Cache-Control']).toBe('public, s-maxage=60, stale-while-revalidate=30');
  });

  it('one list down → the other is still served, the failed one is null, and nothing is CDN-cached', async () => {
    vendorDown.crypto = true;
    const res = makeRes();
    await handler(GET(), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.stocks.count).toBeGreaterThan(0);
    expect(res.body.crypto).toBeNull();
    expect(res.body.errors.crypto).toMatch(/503/);
    expect(res.headers['Cache-Control']).toBeUndefined();
  });

  it('both lists down → 502', async () => {
    vendorDown.stocks = true;
    vendorDown.crypto = true;
    const res = makeRes();
    await handler(GET(), res);
    expect(res.statusCode).toBe(502);
    expect(res.body.success).toBe(false);
  });

  it('only GET', async () => {
    const res = makeRes();
    await handler({ method: 'POST', query: {}, headers: {} }, res);
    expect(res.statusCode).toBe(405);
  });
});
