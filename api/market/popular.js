// api/market/popular.js — GET /api/market/popular
//
// EODHD Quick Wins QW-4 (build report docs/audits/20261007_BUILD_EODHD_QUICK_WINS.md).
// The app-wide market poll (src/App.jsx, via src/services/popularMarketLoader.js)
// reads the WHOLE popular list from here: every tab, one URL, no symbol
// parameters. The server owns the list, from the same source the client's
// getPopularStocks / getPopularCrypto use (src/data/assets.js — a dependency-free
// module, so this api→src import is Node-clean; BUILD_RULES §4, guarded by the
// unmocked import in api/market/popular.test.js).
//
// Each list is read through the shared Firestore cache
// (api/_utils/popularMarketCache.js: 60 s TTL, stocks frozen while the market is
// closed, one lease per list). On a miss the lease holder fetches the whole list
// ONCE and writes it through; the records are built by the per-symbol routes' own
// builders (api/stocks/prices.js, api/crypto/prices.js), so a tab receives the
// record shape it always received.
//
// Behind EODHD_QUICK_WINS_ENABLED, read at call time inside a fail-safe: flag
// off → 404 and no read of any kind (the client never calls this route then).

import { applySecurityMiddleware } from '../_utils/security.js';
import { setCacheHeaders, CACHE_TIERS } from '../_utils/serverCache.js';
import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { readPopularList, POPULAR_MARKET_LEASE_MS } from '../_utils/popularMarketCache.js';
import { stockRealtimeSymbolList, stockPriceKey, formatStockPriceRecord } from '../stocks/prices.js';
import { cryptoRealtimeSymbolList, cryptoPriceKey, formatCryptoPriceRecord } from '../crypto/prices.js';
import { getStockSymbols, getCryptoSymbols } from '../../src/data/assets.js';
import { EODHD_QUICK_WINS_ENABLED } from '../../src/config/featureFlags.js';

export const config = { maxDuration: 30 };

function eodhdQuickWinsOn() {
  try {
    return EODHD_QUICK_WINS_ENABLED === true;
  } catch {
    return false;
  }
}

/** The server-owned lists, upper-cased exactly as the client's batch helpers send them. */
export function popularStockSymbols() {
  return getStockSymbols().map((s) => s.toUpperCase());
}
export function popularCryptoSymbols() {
  return getCryptoSymbols().map((s) => s.toUpperCase());
}

/**
 * The vendor fetch is bounded BELOW the lease (review E2-4): a holder can never
 * outlive its lease while waiting on a hung vendor, so no second instance pays
 * for the same list, and a hung call cannot hold the request to maxDuration.
 */
export const POPULAR_VENDOR_TIMEOUT_MS = 10_000;
if (POPULAR_VENDOR_TIMEOUT_MS >= POPULAR_MARKET_LEASE_MS) throw new Error('vendor timeout must be below the lease');

async function fetchRealtimeList(symbolList, apiKey, keyOf, formatRecord) {
  const url = `https://eodhd.com/api/real-time/${symbolList}?api_token=${apiKey}&fmt=json`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), POPULAR_VENDOR_TIMEOUT_MS);
  let data;
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`EODHD responded with ${response.status}`);
    data = await response.json();
  } catch (err) {
    if (err?.name === 'AbortError') throw new Error(`EODHD did not answer within ${POPULAR_VENDOR_TIMEOUT_MS}ms`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
  const prices = {};
  for (const item of Array.isArray(data) ? data : [data]) {
    if (item && item.code) prices[keyOf(item)] = formatRecord(item);
  }
  return { prices, count: Object.keys(prices).length, fetchedAt: new Date().toISOString() };
}

/** ONE upstream request for the whole stock list. */
export function fetchPopularStocks(apiKey) {
  return fetchRealtimeList(stockRealtimeSymbolList(popularStockSymbols().join(',')), apiKey, stockPriceKey, formatStockPriceRecord);
}

/** ONE upstream request for the whole crypto list. */
export function fetchPopularCrypto(apiKey) {
  return fetchRealtimeList(cryptoRealtimeSymbolList(popularCryptoSymbols().join(',')), apiKey, cryptoPriceKey, formatCryptoPriceRecord);
}

export default async function handler(req, res) {
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 60, windowMs: 60000 } })) {
    return;
  }
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  // Dark: 404 with no Firestore read and no vendor call (the repo's dark-route
  // order — middleware, method, flag — as api/mandate/escape.js).
  if (!eodhdQuickWinsOn()) {
    return res.status(404).json({ error: 'Not found' });
  }

  const apiKey = process.env.EODHD_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API not configured' });
  }

  // Fail-open (review E2-3): no Firestore handle → each list is fetched
  // directly, uncached, exactly as a tab fetched it before.
  let db = null;
  try {
    db = getFirebaseAdmin();
  } catch (err) {
    console.error(`[PopularMarket] Firestore unavailable (fetching direct): ${err.message}`);
  }
  const [stocks, crypto] = await Promise.allSettled([
    readPopularList(db, 'stocks', { fetchList: () => fetchPopularStocks(apiKey), expectedCount: popularStockSymbols().length }),
    readPopularList(db, 'crypto', { fetchList: () => fetchPopularCrypto(apiKey), expectedCount: popularCryptoSymbols().length }),
  ]);

  const errors = {};
  if (stocks.status === 'rejected') {
    errors.stocks = stocks.reason?.message || 'unavailable';
    console.error(`[PopularMarket] stocks unavailable: ${errors.stocks}`);
  }
  if (crypto.status === 'rejected') {
    errors.crypto = crypto.reason?.message || 'unavailable';
    console.error(`[PopularMarket] crypto unavailable: ${errors.crypto}`);
  }
  if (stocks.status === 'rejected' && crypto.status === 'rejected') {
    return res.status(502).json({ success: false, error: 'Failed to fetch popular lists', errors });
  }

  // CDN layer: the per-symbol price routes' own tier (s-maxage 60 ≤ the 60 s
  // TTL), and only for a complete answer — a partial one stays no-store, so one
  // list's failure is never cached for every tab (the per-symbol routes never
  // cache an error either).
  if (stocks.status === 'fulfilled' && crypto.status === 'fulfilled') {
    setCacheHeaders(res, CACHE_TIERS.PRICE.sMaxAge, CACHE_TIERS.PRICE.staleWhileRevalidate);
  }

  return res.status(200).json({
    success: true,
    stocks: stocks.status === 'fulfilled' ? stocks.value.data : null,
    crypto: crypto.status === 'fulfilled' ? crypto.value.data : null,
    source: {
      stocks: stocks.status === 'fulfilled' ? stocks.value.source : 'error',
      crypto: crypto.status === 'fulfilled' ? crypto.value.source : 'error',
    },
    ...(Object.keys(errors).length ? { errors } : {}),
  });
}
