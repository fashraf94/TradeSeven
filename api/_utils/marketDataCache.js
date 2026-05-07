/**
 * Market Data Cache — Centralized caching layer for stock/crypto analysis data.
 *
 * Two-layer architecture:
 *   L1: In-memory (serverCache.js) — fast, short-lived (2-30 min)
 *   L2: Firestore "marketDataCache" collection — persistent, longer TTLs (30 min - 24 hours)
 *
 * Wraps EODHD API calls with TTL-based caching so AI features (Stock Intelligence Agent,
 * Research Advisor, etc.) can assemble pre-cached data instead of waiting 2-4 seconds
 * for multiple API calls per query.
 *
 * Consumed by: Stock Intelligence Agent, existing research features, and potentially
 * any endpoint that needs comprehensive stock data.
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getFromCache, setInCache } from './serverCache.js';
import { calculateAllIndicators } from './technicalCalculations.js';
import { isMarketOpen, isPreMarketWindow, getEffectiveTTLMs, getMarketState } from './marketSchedule.js';
import { VALID_CRYPTO_SYMBOLS } from './agentCryptoAssets.js';

// ============================================
// CONSTANTS
// ============================================

const API_BASE = 'https://eodhd.com/api';

// Firestore (L2) TTLs in milliseconds
const CACHE_TTL = {
  daily:        4 * 60 * 60 * 1000,    // 4 hours
  fundamentals: 24 * 60 * 60 * 1000,   // 24 hours
  news:         30 * 60 * 1000,         // 30 minutes
  technicals:   4 * 60 * 60 * 1000,    // 4 hours
  earnings:     24 * 60 * 60 * 1000,   // 24 hours
  holders:      7 * 24 * 60 * 60 * 1000, // 7 days (quarterly data, weekly refresh)
};

// In-memory (L1) TTLs in seconds (shorter than Firestore, fast access)
const MEMORY_TTL = {
  daily:        300,   // 5 min
  fundamentals: 1800,  // 30 min
  news:         120,   // 2 min
  technicals:   300,   // 5 min
  earnings:     1800,  // 30 min
  holders:      3600,  // 1 hour
};

// All possible data field types
const STOCK_FIELDS = ['daily', 'technicals', 'fundamentals', 'news', 'earnings'];
const CRYPTO_FIELDS = ['daily', 'technicals', 'news'];

// ============================================
// FIREBASE ADMIN
// ============================================

function getFirebaseAdmin() {
  if (getApps().length === 0) {
    const serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    };

    initializeApp({
      credential: cert(serviceAccount),
    });
  }
  return getFirestore();
}

// ============================================
// SYMBOL HELPERS
// ============================================

function isCryptoSymbol(symbol) {
  if (!symbol) return false;
  const upper = symbol.toUpperCase();
  return upper.includes('-USD.CC') || upper.endsWith('.CC') || VALID_CRYPTO_SYMBOLS.includes(upper);
}

function getCleanSymbol(symbol) {
  return symbol.toUpperCase().replace(/\.US$/, '').replace(/-USD\.CC$/, '').replace(/\.CC$/, '');
}

function formatEODHDSymbol(cleanSymbol, isCrypto) {
  // Normalize dots to hyphens for EODHD (BRK.B → BRK-B)
  const normalized = isCrypto ? cleanSymbol : cleanSymbol.replace(/\./g, '-');
  return isCrypto ? `${normalized}-USD.CC` : `${normalized}.US`;
}

function getDateDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
}

// ============================================
// CACHE HIT/MISS LOGGING
// ============================================

const cacheStats = { hits: 0, misses: 0, errors: 0, staleServes: 0 };

function logCacheAccess(action, key, details = '') {
  if (action === 'HIT') cacheStats.hits++;
  else if (action === 'MISS') cacheStats.misses++;
  else if (action === 'STALE') cacheStats.staleServes++;
  else if (action === 'ERROR') cacheStats.errors++;

  const total = cacheStats.hits + cacheStats.misses;
  const hitRate = total > 0 ? ((cacheStats.hits / total) * 100).toFixed(1) : '0.0';

  console.log(`[MarketDataCache] ${action} | key=${key} | hitRate=${hitRate}% | total=${total} ${details}`);
}

// ============================================
// CACHE READ / WRITE (L1 + L2)
// ============================================

/**
 * Read from cache: L1 (memory) first, then L2 (Firestore).
 * Returns { data, source, isStale } — stale data is returned for fallback use.
 *
 * Market-aware: When the market is closed, stock data TTLs are extended to next
 * market open (prices don't change off-hours). Crypto data keeps normal TTLs.
 */
async function getCachedData(db, docKey, ttlMs, options = {}) {
  const { isCrypto: cryptoFlag = false } = options;

  // Determine market-aware effective TTL
  const ttlType = docKey.split('_').pop();
  const effectiveTTL = getEffectiveTTLMs(ttlType, ttlMs, { isCrypto: cryptoFlag });

  // L1: Check in-memory cache first
  const memoryKey = `mdc_${docKey}`;
  const memoryCached = getFromCache(memoryKey, ttlType);
  if (memoryCached) {
    logCacheAccess('HIT', docKey, '(L1 memory)');
    return { data: memoryCached, source: 'memory', isStale: false };
  }

  // L2: Check Firestore
  try {
    const doc = await db.collection('marketDataCache').doc(docKey).get();

    if (!doc.exists) {
      logCacheAccess('MISS', docKey, '(not in Firestore)');
      return { data: null, source: null, isStale: false };
    }

    const cached = doc.data();
    const cachedAt = cached.cachedAt?.toDate ? cached.cachedAt.toDate() : new Date(cached.cachedAt);
    const age = Date.now() - cachedAt.getTime();
    const isStale = age > effectiveTTL;

    if (isStale) {
      logCacheAccess('MISS', docKey, `(stale: ${Math.round(age / 1000)}s old, TTL: ${effectiveTTL / 1000}s)`);
      return { data: cached.data, source: 'firestore_stale', isStale: true };
    }

    // Log when serving frozen cache during closed market
    if (!cryptoFlag && !isMarketOpen() && age > ttlMs) {
      logCacheAccess('HIT', docKey, `(L2 Firestore, FROZEN — market closed, ${Math.round(age / 1000)}s old)`);
    } else {
      logCacheAccess('HIT', docKey, `(L2 Firestore, ${Math.round(age / 1000)}s old)`);
    }

    // Promote to L1 cache with market-aware metadata
    const memoryTtl = MEMORY_TTL[ttlType] || 300;
    setInCache(memoryKey, cached.data, memoryTtl, {
      dataType: ttlType,
      isCrypto: cryptoFlag,
    });

    return { data: cached.data, source: 'firestore', isStale: false };
  } catch (err) {
    console.error(`[MarketDataCache] Firestore read error for ${docKey}:`, err.message);
    logCacheAccess('ERROR', docKey, err.message);
    return { data: null, source: null, isStale: false };
  }
}

/**
 * Write to both L1 (memory) and L2 (Firestore).
 */
async function setCachedData(db, docKey, data, ttlType) {
  try {
    await db.collection('marketDataCache').doc(docKey).set({
      data,
      cachedAt: new Date(),
      ttlType,
      ttlMs: CACHE_TTL[ttlType],
      expiresAt: new Date(Date.now() + CACHE_TTL[ttlType]),
    });

    // Also set in L1 memory cache
    const memoryKey = `mdc_${docKey}`;
    const memoryTtl = MEMORY_TTL[ttlType] || 300;
    setInCache(memoryKey, data, memoryTtl);

    console.log(`[MarketDataCache] SET ${docKey} (ttl=${ttlType}, ${CACHE_TTL[ttlType] / 1000}s)`);
  } catch (err) {
    console.error(`[MarketDataCache] Firestore write error for ${docKey}:`, err.message);
  }
}

// ============================================
// EODHD FETCH FUNCTIONS
// ============================================

function getApiKey() {
  const key = process.env.EODHD_API_KEY;
  if (!key) throw new Error('EODHD_API_KEY not configured');
  return key;
}

/**
 * Fetch 30 days of daily OHLCV data
 */
async function fetchDailyOHLCV(eohdSymbol, apiKey) {
  const from = getDateDaysAgo(30);
  const url = `${API_BASE}/eod/${eohdSymbol}?api_token=${apiKey}&fmt=json&period=d&order=d&from=${from}`;

  console.log(`[MarketDataCache] Fetching daily OHLCV for ${eohdSymbol}`);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`EODHD daily OHLCV responded with ${response.status}`);
  }

  const data = await response.json();
  if (!Array.isArray(data)) return [];

  return data.map(d => ({
    date: d.date,
    open: d.open,
    high: d.high,
    low: d.low,
    close: d.adjusted_close || d.close,
    volume: d.volume,
  }));
}

/**
 * Fetch fundamentals (General, Highlights, Valuation, Technicals, AnalystRatings)
 */
async function fetchFundamentals(eohdSymbol, apiKey) {
  const url = `${API_BASE}/fundamentals/${eohdSymbol}?api_token=${apiKey}&filter=General,Highlights,Valuation,Technicals,AnalystRatings&fmt=json`;

  console.log(`[MarketDataCache] Fetching fundamentals for ${eohdSymbol}`);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`EODHD fundamentals responded with ${response.status}`);
  }

  const raw = await response.json();
  const highlights = raw.Highlights || {};
  const technicals = raw.Technicals || {};
  const valuation = raw.Valuation || {};
  const analysts = raw.AnalystRatings || {};
  const general = raw.General || {};

  // Build analyst consensus
  const totalAnalysts = (analysts.StrongBuy || 0) + (analysts.Buy || 0) +
    (analysts.Hold || 0) + (analysts.Sell || 0) + (analysts.StrongSell || 0);
  const buyCount = (analysts.StrongBuy || 0) + (analysts.Buy || 0);
  let analystRating = 3;
  if (totalAnalysts > 0) {
    analystRating = (
      (analysts.StrongBuy || 0) * 5 +
      (analysts.Buy || 0) * 4 +
      (analysts.Hold || 0) * 3 +
      (analysts.Sell || 0) * 2 +
      (analysts.StrongSell || 0) * 1
    ) / totalAnalysts;
  }

  return {
    name: general.Name || null,
    sector: general.Sector || null,
    industry: general.Industry || null,
    description: general.Description || null,
    marketCap: highlights.MarketCapitalization || null,
    peRatio: highlights.PERatio || valuation.TrailingPE || null,
    pegRatio: highlights.PEGRatio || null,
    profitMargin: highlights.ProfitMargin || null,
    revenueGrowthYOY: highlights.QuarterlyRevenueGrowthYOY || null,
    beta: technicals.Beta || null,
    week52High: technicals['52WeekHigh'] || null,
    week52Low: technicals['52WeekLow'] || null,
    ma50: technicals['50DayMA'] || null,
    ma200: technicals['200DayMA'] || null,
    targetPrice: analysts.TargetPrice || highlights.WallStreetTargetPrice || null,
    analystRating,
    analystConsensus: {
      totalAnalysts,
      buyPercent: totalAnalysts > 0 ? Number(((buyCount / totalAnalysts) * 100).toFixed(1)) : 0,
      strongBuy: analysts.StrongBuy || 0,
      buy: analysts.Buy || 0,
      hold: analysts.Hold || 0,
      sell: analysts.Sell || 0,
      strongSell: analysts.StrongSell || 0,
    },
  };
}

/**
 * Fetch institutional + mutual fund holders from EODHD Fundamentals API.
 * Uses filter=Holders which returns both Institutions and Funds subsections.
 *
 * EODHD returns object-indexed responses ({"0": {...}, "1": {...}}), not arrays.
 * Cost: 10 API calls per request (EODHD fundamentals billing).
 * Data: Quarterly (13F filings), up to 90 days stale.
 * Availability: Equities only (not ETFs, funds, or indices).
 */
async function fetchHolders(eohdSymbol, apiKey) {
  const url = `${API_BASE}/fundamentals/${eohdSymbol}?api_token=${apiKey}&filter=Holders&fmt=json`;

  console.log(`[MarketDataCache] Fetching holders for ${eohdSymbol}`);
  const response = await fetch(url);

  if (!response.ok) {
    console.error(`[MarketDataCache] Holders fetch failed for ${eohdSymbol}: ${response.status}`);
    return null;
  }

  const data = await response.json();

  // EODHD returns object-indexed responses, convert to arrays
  const institutions = data?.Institutions ? Object.values(data.Institutions) : [];
  const funds = data?.Funds ? Object.values(data.Funds) : [];

  return { Institutions: institutions, Funds: funds };
}

/**
 * Fetch recent news headlines (last 10)
 */
async function fetchNews(eohdSymbol, apiKey) {
  const url = `${API_BASE}/news?s=${eohdSymbol}&api_token=${apiKey}&limit=10&fmt=json`;

  console.log(`[MarketDataCache] Fetching news for ${eohdSymbol}`);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`EODHD news responded with ${response.status}`);
  }

  const data = await response.json();
  if (!Array.isArray(data)) return [];

  return data.map(item => ({
    title: item.title || 'Untitled',
    summary: item.content
      ? item.content.substring(0, 250) + (item.content.length > 250 ? '...' : '')
      : '',
    source: item.source || 'Unknown',
    url: item.link || null,
    publishedAt: item.date || null,
    sentiment: item.sentiment || null,
  }));
}

/**
 * Fetch earnings history and next earnings date from fundamentals endpoint
 */
async function fetchEarnings(eohdSymbol, apiKey) {
  const url = `${API_BASE}/fundamentals/${eohdSymbol}?api_token=${apiKey}&filter=General,Earnings&fmt=json`;

  console.log(`[MarketDataCache] Fetching earnings for ${eohdSymbol}`);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`EODHD earnings responded with ${response.status}`);
  }

  const raw = await response.json();
  const earningsHistory = raw?.Earnings?.History || {};
  const nextEarningsDate = raw?.General?.NextEarningsDate || null;

  const now = new Date();

  // Get completed earnings (past dates with actual EPS data), sorted newest-first
  const completedEarnings = Object.entries(earningsHistory)
    .map(([key, value]) => ({ ...value, key }))
    .filter(e => {
      if (!e.reportDate) return false;
      if (new Date(e.reportDate) > now) return false;
      if (e.epsActual === null || e.epsActual === undefined) return false;
      return true;
    })
    .sort((a, b) => new Date(b.reportDate) - new Date(a.reportDate))
    .slice(0, 4); // Last 4 quarters

  // Format history entries
  const history = completedEarnings.map(e => ({
    reportDate: e.reportDate,
    quarter: e.fiscalQuarter && e.fiscalYear ? `Q${e.fiscalQuarter} ${e.fiscalYear}` : null,
    epsActual: e.epsActual,
    epsEstimate: e.epsEstimate,
    epsDifference: e.epsDifference,
    beat: e.epsActual != null && e.epsEstimate != null ? e.epsActual > e.epsEstimate : null,
    beforeAfterMarket: e.beforeAfterMarket || null,
  }));

  return {
    nextEarningsDate,
    history,
  };
}

// ============================================
// MAIN EXPORT: getStockAnalysisData
// ============================================

/**
 * Get comprehensive analysis data for a symbol with caching.
 *
 * @param {string} symbol - Stock or crypto symbol (e.g., 'AAPL', 'BTC', 'BTC-USD.CC')
 * @param {object} options
 * @param {boolean} options.forceRefresh - Bypass cache entirely
 * @param {string[]} options.fields - Only fetch specific fields (e.g., ['price', 'technicals'])
 * @param {string} options.type - Explicit 'crypto' or 'stock' type
 * @returns {object} Analysis data with cache status and stale data indicators
 */
export async function getStockAnalysisData(symbol, options = {}) {
  const { forceRefresh = false, fields = null, type = null } = options;

  const clean = getCleanSymbol(symbol);
  const isCrypto = type === 'crypto' || isCryptoSymbol(symbol);
  const eohdSymbol = formatEODHDSymbol(clean, isCrypto);
  const db = getFirebaseAdmin();
  const apiKey = getApiKey();

  // Determine which fields to fetch
  const allFields = isCrypto ? CRYPTO_FIELDS : STOCK_FIELDS;
  const requestedFields = fields
    ? allFields.filter(f => fields.includes(f) || fields.includes(mapFieldAlias(f)))
    : [...allFields];

  const result = {
    symbol: clean,
    isCrypto,
    fetchedAt: new Date().toISOString(),
    cacheStatus: {},
    errors: {},
    staleData: false,
    staleFields: [],
  };

  // Stale data tracking for fallback
  const staleBackup = {};

  // Fetch non-technical fields in parallel
  const nonTechnicalFields = requestedFields.filter(f => f !== 'technicals');
  const fetches = nonTechnicalFields.map(async (fieldType) => {
    const docKey = `${clean}_${fieldType}`;
    const ttlMs = CACHE_TTL[fieldType];

    // Check cache unless force refresh
    if (!forceRefresh) {
      const cached = await getCachedData(db, docKey, ttlMs, { isCrypto });
      if (cached.data && !cached.isStale) {
        result[fieldType] = cached.data;
        result.cacheStatus[fieldType] = 'hit';
        return;
      }
      if (cached.data && cached.isStale) {
        staleBackup[fieldType] = cached.data;
      }
    }

    // Fetch fresh data from EODHD
    try {
      let freshData;
      switch (fieldType) {
        case 'daily':
          freshData = await fetchDailyOHLCV(eohdSymbol, apiKey);
          break;
        case 'fundamentals':
          freshData = await fetchFundamentals(eohdSymbol, apiKey);
          break;
        case 'news':
          freshData = await fetchNews(eohdSymbol, apiKey);
          break;
        case 'earnings':
          freshData = await fetchEarnings(eohdSymbol, apiKey);
          break;
        default:
          return;
      }

      result[fieldType] = freshData;
      result.cacheStatus[fieldType] = 'fresh';

      // Write to cache (fire-and-forget)
      setCachedData(db, docKey, freshData, fieldType).catch(err =>
        console.error(`[MarketDataCache] Background cache write failed for ${docKey}:`, err.message)
      );
    } catch (err) {
      console.error(`[MarketDataCache] Fetch failed for ${fieldType} (${clean}):`, err.message);
      result.errors[fieldType] = err.message;

      // Fall back to stale data if available
      if (staleBackup[fieldType]) {
        result[fieldType] = staleBackup[fieldType];
        result.cacheStatus[fieldType] = 'stale_fallback';
        result.staleData = true;
        result.staleFields.push(fieldType);
        logCacheAccess('STALE', docKey, 'using stale data after fetch failure');
      }
    }
  });

  await Promise.all(fetches);

  // Compute technicals from OHLCV data if requested
  if (requestedFields.includes('technicals')) {
    await fetchTechnicals(db, clean, result, staleBackup, forceRefresh, isCrypto);
  }

  // Get real-time price if requested
  if (!fields || fields.includes('price')) {
    await fetchRealTimePrice(eohdSymbol, apiKey, result);
  }

  return result;
}

/**
 * Fetch or compute technicals, with cache and stale-fallback support.
 */
async function fetchTechnicals(db, clean, result, staleBackup, forceRefresh, isCrypto = false) {
  const docKey = `${clean}_technicals`;
  const ttlMs = CACHE_TTL.technicals;

  // Check cache first
  if (!forceRefresh) {
    const cached = await getCachedData(db, docKey, ttlMs, { isCrypto });
    if (cached.data && !cached.isStale) {
      result.technicals = cached.data;
      result.cacheStatus.technicals = 'hit';
      return;
    }
    if (cached.data && cached.isStale) {
      staleBackup.technicals = cached.data;
    }
  }

  // Compute from daily OHLCV data
  if (result.daily && Array.isArray(result.daily) && result.daily.length > 0) {
    try {
      result.technicals = calculateAllIndicators(result.daily);
      result.cacheStatus.technicals = 'computed';

      // Cache the computed technicals (fire-and-forget)
      setCachedData(db, docKey, result.technicals, 'technicals').catch(err =>
        console.error(`[MarketDataCache] Background cache write failed for ${docKey}:`, err.message)
      );
      return;
    } catch (err) {
      console.error(`[MarketDataCache] Technical calculation failed for ${clean}:`, err.message);
      result.errors.technicals = err.message;
    }
  }

  // Fall back to stale data if computation failed or no daily data
  if (staleBackup.technicals) {
    result.technicals = staleBackup.technicals;
    result.cacheStatus.technicals = 'stale_fallback';
    result.staleData = true;
    result.staleFields.push('technicals');
    logCacheAccess('STALE', docKey, 'using stale technicals after computation failure');
  }
}

/**
 * Fetch real-time price (never cached long-term).
 * Falls back to latest OHLCV close on failure.
 */
async function fetchRealTimePrice(eohdSymbol, apiKey, result) {
  try {
    const url = `${API_BASE}/real-time/${eohdSymbol}?api_token=${apiKey}&fmt=json`;
    const response = await fetch(url);

    if (response.ok) {
      const data = await response.json();
      result.price = {
        current: data.close || data.previousClose || 0,
        previousClose: data.previousClose || 0,
        change: data.change || 0,
        changePercent: data.change_p || 0,
        high: data.high,
        low: data.low,
        volume: data.volume,
        timestamp: data.timestamp,
      };
    } else {
      throw new Error(`Real-time price responded with ${response.status}`);
    }
  } catch (err) {
    console.error(`[MarketDataCache] Real-time price fetch failed for ${eohdSymbol}:`, err.message);
    result.errors.price = err.message;

    // Use latest close from OHLCV as fallback
    if (result.daily && result.daily.length > 0) {
      result.price = {
        current: result.daily[0].close,
        fallback: true,
      };
    }
  }
}

// ============================================
// EXPORT: fetchIntradayCandles
// ============================================

/**
 * Fetch intraday OHLCV candles from EODHD for a single symbol.
 * Returns candles in chronological order (oldest first) — ready for VWAP calculation.
 *
 * @param {string} symbol - Stock or crypto symbol (e.g., 'AAPL', 'BTC-USD.CC')
 * @param {object} options
 * @param {string} options.interval - Candle interval: '5m' (default), '1m', '1h'
 * @param {number} [options.hoursBack] - Optional explicit lookback window. When omitted,
 *   EODHD's default response window is used (recommended — sidesteps feed-delay edge cases
 *   where a NOW-relative window can fall entirely outside published candles).
 * @returns {Array<{ datetime: string, open: number, high: number, low: number, close: number, volume: number }>}
 */
export async function fetchIntradayCandles(symbol, options = {}) {
  const { interval = '5m', hoursBack } = options;
  const apiKey = getApiKey();
  const clean = getCleanSymbol(symbol);
  const isCrypto = isCryptoSymbol(symbol);
  const eohdSymbol = formatEODHDSymbol(clean, isCrypto);

  let url = `${API_BASE}/intraday/${eohdSymbol}?api_token=${apiKey}&fmt=json&interval=${interval}`;
  if (hoursBack) {
    const fromTs = Math.floor((Date.now() - hoursBack * 60 * 60 * 1000) / 1000);
    const toTs = Math.floor(Date.now() / 1000);
    url += `&from=${fromTs}&to=${toTs}`;
  }

  console.log(`[MarketDataCache] Fetching intraday ${interval} for ${eohdSymbol}`);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`EODHD intraday responded with ${response.status} for ${eohdSymbol}`);
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    console.warn(`[MarketDataCache] Intraday response was not an array for ${eohdSymbol}`);
    return [];
  }
  if (data.length === 0) {
    console.warn(`[MarketDataCache] Intraday response was empty for ${eohdSymbol}`);
    return [];
  }

  // EODHD returns oldest-first (chronological) — keep that order for VWAP.
  // Drop in-progress / partial candles where any OHLC field is null/undefined/
  // non-finite. At market open the most recent 5-min bar is still forming and
  // EODHD returns close=null (and sometimes the rest of OHLC too); letting
  // those reach calculateVWAP crashes the whole eval cron with a null toFixed.
  const validCandles = data.filter(d => {
    const ohlcValid =
      Number.isFinite(d.open) &&
      Number.isFinite(d.high) &&
      Number.isFinite(d.low) &&
      Number.isFinite(d.close);
    return ohlcValid;
  });

  const droppedCount = data.length - validCandles.length;
  if (droppedCount > 0) {
    console.warn(`[MarketDataCache] Dropped ${droppedCount} partial candle(s) for ${eohdSymbol} (incomplete OHLC, likely in-progress)`);
  }

  return validCandles.map(d => ({
    datetime: d.datetime || new Date(d.timestamp * 1000).toISOString(),
    open: d.open,
    high: d.high,
    low: d.low,
    close: d.close,
    volume: d.volume || 0,
  }));
}

/**
 * Batch fetch intraday candles for multiple symbols with concurrency limiting.
 * Returns a map of symbol → candles array.
 *
 * @param {string[]} symbols - Array of symbols
 * @param {object} options - Same as fetchIntradayCandles options
 * @returns {Object<string, Array>} Map of symbol → candles (empty array on failure)
 */
export async function fetchIntradayBatch(symbols, options = {}) {
  const CONCURRENCY = 5;
  const results = {};

  for (let i = 0; i < symbols.length; i += CONCURRENCY) {
    const batch = symbols.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.allSettled(
      batch.map(async (symbol) => {
        const candles = await fetchIntradayCandles(symbol, options);
        return { symbol, candles };
      })
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results[result.value.symbol] = result.value.candles;
      } else {
        const sym = batch[batchResults.indexOf(result)];
        console.warn(`[MarketDataCache] Intraday fetch failed for ${sym}:`, result.reason?.message);
        results[sym] = [];
      }
    }

    // Rate limiting between batches
    if (i + CONCURRENCY < symbols.length) {
      await new Promise(r => setTimeout(r, 200));
    }
  }

  return results;
}

// ============================================
// EXPORT: prefetchBatch
// ============================================

/**
 * Pre-cache data for an array of symbols (e.g., when a draft starts).
 * Uses concurrency limiting to avoid EODHD rate limits.
 *
 * @param {string[]} symbols - Array of stock/crypto symbols
 * @returns {{ succeeded: number, failed: number, duration: number }}
 */
export async function prefetchBatch(symbols) {
  if (!Array.isArray(symbols) || symbols.length === 0) return { succeeded: 0, failed: 0, duration: 0 };

  // No point prefetching stock data when market is closed — prices haven't changed
  if (!isMarketOpen() && !isPreMarketWindow()) {
    console.log('[MarketDataCache] Skipping prefetch — market closed');
    return { skipped: true, reason: 'market_closed' };
  }

  console.log(`[MarketDataCache] Prefetching batch of ${symbols.length} symbols`);
  const startTime = Date.now();

  const CONCURRENCY = 5;
  const results = [];

  for (let i = 0; i < symbols.length; i += CONCURRENCY) {
    const batch = symbols.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.allSettled(
      batch.map(symbol => getStockAnalysisData(symbol, { fields: ['daily', 'technicals'] }))
    );
    results.push(...batchResults);

    // Rate limiting between batches
    if (i + CONCURRENCY < symbols.length) {
      await new Promise(r => setTimeout(r, 200));
    }
  }

  const succeeded = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;
  const duration = Date.now() - startTime;

  console.log(`[MarketDataCache] Prefetch complete: ${succeeded} succeeded, ${failed} failed (${duration}ms)`);

  return { succeeded, failed, duration };
}

// ============================================
// EXPORT: invalidateCache
// ============================================

/**
 * Force-expire all cached data for a symbol.
 * Deletes all Firestore cache documents and clears L1 memory cache.
 *
 * @param {string} symbol - Stock or crypto symbol
 */
export async function invalidateCache(symbol) {
  const clean = getCleanSymbol(symbol);
  const db = getFirebaseAdmin();
  const suffixes = ['daily', 'fundamentals', 'news', 'technicals', 'earnings'];

  console.log(`[MarketDataCache] Invalidating all cache for ${clean}`);

  const batch = db.batch();

  for (const suffix of suffixes) {
    const docRef = db.collection('marketDataCache').doc(`${clean}_${suffix}`);
    batch.delete(docRef);
  }

  await batch.commit();
  console.log(`[MarketDataCache] Invalidated ${suffixes.length} cache entries for ${clean}`);
}

/**
 * Fetch holders with two-layer cache (L1 memory + L2 Firestore).
 * Cache key: {SYMBOL}_holders, TTL: 7 days.
 * Used by the institutional intelligence cron.
 *
 * @param {string} symbol - Stock symbol (e.g., 'AAPL')
 * @returns {object|null} { Institutions: [...], Funds: [...] } or null
 */
export async function getCachedHolders(symbol) {
  const clean = getCleanSymbol(symbol);
  const docKey = `${clean}_holders`;
  const ttlMs = CACHE_TTL.holders;
  const db = getFirebaseAdmin();
  const apiKey = getApiKey();
  const eohdSymbol = formatEODHDSymbol(clean, false); // Holders is equities only

  // Check L1 memory cache
  const l1 = getFromCache(docKey);
  if (l1) return l1;

  // Check L2 Firestore cache
  const cached = await getCachedData(db, docKey, ttlMs);
  if (cached.data && !cached.isStale) {
    setInCache(docKey, cached.data, MEMORY_TTL.holders);
    return cached.data;
  }

  // Cache miss — fetch from EODHD
  const holders = await fetchHolders(eohdSymbol, apiKey);
  if (!holders) return null;

  // Write to L2 Firestore + L1 memory
  await setCachedData(db, docKey, holders, 'holders');
  setInCache(docKey, holders, MEMORY_TTL.holders);

  return holders;
}

// ============================================
// HELPERS
// ============================================

/**
 * Map user-friendly field names to internal field names
 */
function mapFieldAlias(field) {
  const aliases = {
    ohlcv: 'daily',
    indicators: 'technicals',
    fundamental: 'fundamentals',
  };
  return aliases[field] || field;
}
