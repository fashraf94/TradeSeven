/**
 * EODHD API Service for MarketClash
 *
 * This service handles all communication with the EODHD market data API
 * through Vercel serverless proxy functions to avoid CORS issues.
 *
 * ENDPOINTS:
 * - /api/stocks/prices - Stock price quotes
 * - /api/crypto/prices - Crypto price quotes
 * - /api/news/market - General market news
 * - /api/news/stock - Stock-specific news
 * - /api/stocks/earnings - Earnings data
 *
 * CACHING STRATEGY (via cacheService.js):
 * - Stock/Crypto prices: 5-minute cache (LIGHT tier)
 * - News: 1-hour cache (MODERATE tier)
 * - Earnings: 24-hour cache (AGGRESSIVE tier)
 * - Technical indicators: See technicalIndicators.js (24-hour cache)
 * - Historical data: See historicalData.js (24-hour cache)
 *
 * All fetch functions:
 * 1. Check cache first (cacheService.get)
 * 2. Return cached data if valid
 * 3. Fetch from API if cache miss
 * 4. Store result in cache (cacheService.set)
 * 5. Track call for monitoring (apiMonitor.track)
 *
 * DEBUGGING:
 * - window.mcCache.report() - View cache statistics
 * - window.apiMonitor.report() - View API usage
 * - window.mcDebug.audit() - Full system audit
 *
 * @see /src/services/cacheService.js - Cache implementation
 * @see /src/services/apiMonitor.js - Usage tracking
 * @see /src/utils/debug.js - Debug utilities
 */

import {
  STOCKS,
  CRYPTO,
  FALLBACK_STOCK_PRICES as CENTRALIZED_FALLBACK_STOCK_PRICES,
  FALLBACK_CRYPTO_PRICES as CENTRALIZED_FALLBACK_CRYPTO_PRICES,
  getStockSymbols,
  getCryptoSymbols,
  getStockNameMap,
  getCryptoNameMap,
} from '../data/assets';

// Import the multi-tier cache service
import cacheService from './cacheService.js';

// Import API monitor for tracking
import { apiMonitor } from './apiMonitor.js';
import { CRYPTO_SYMBOLS } from './sessionScoringService.js';

const IS_DEV = import.meta.env.DEV;

// Use relative URLs - works in both dev and production on Vercel
const API_BASE = '/api';

// ============================================
// LOGGING UTILITIES
// ============================================

const logDebug = (message, ...args) => {
  if (IS_DEV) {
    console.log(`[EODHD] ${message}`, ...args);
  }
};

const logWarn = (message, ...args) => {
  console.warn(`[EODHD] ${message}`, ...args);
};

// ============================================
// CACHE SERVICE INTEGRATION
// ============================================
// All caching now handled by cacheService.js with multi-tier TTLs:
// - 'prices' (stocks): 5 min cache (LIGHT tier)
// - 'crypto': 5 min cache (LIGHT tier)
// - 'news': 1 hour cache (MODERATE tier)
// - 'earnings': 24 hour cache (AGGRESSIVE tier)

// ============================================
// FETCH WITH TIMEOUT
// ============================================

const fetchWithTimeout = async (url, timeout = 30000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    throw error;
  }
};

// ============================================
// STOCK FUNCTIONS (via Vercel Proxy)
// ============================================

/**
 * Get multiple stock prices via proxy
 * @param {string[]} symbols - Array of stock symbols
 * @returns {Promise<Object>} - { AAPL: {price, change}, MSFT: {price, change}, ... }
 */
export async function getMultipleStockPrices(symbols) {
  const upperSymbols = symbols.map(s => s.toUpperCase());
  const result = {};
  const symbolsToFetch = [];

  // Check cache for each symbol individually
  for (const symbol of upperSymbols) {
    const cached = cacheService.get('prices', symbol);
    if (cached !== null) {
      result[symbol] = cached;
    } else {
      symbolsToFetch.push(symbol);
    }
  }

  // If all symbols were cached, return early
  if (symbolsToFetch.length === 0) {
    console.log(`[EODHD] All ${upperSymbols.length} stock prices from cache`);
    return result;
  }

  console.log(`[EODHD] Fetching ${symbolsToFetch.length} stock prices (${upperSymbols.length - symbolsToFetch.length} cached)`);

  try {
    const response = await fetchWithTimeout(
      `${API_BASE}/stocks/prices?symbols=${symbolsToFetch.join(',')}`
    );

    if (!response.ok) {
      throw new Error(`Proxy error: ${response.status}`);
    }

    const data = await response.json();

    if (data.success && data.prices) {
      // Track API call
      apiMonitor.track('/api/stocks/prices', { symbols: symbolsToFetch }, 'eodhdAPI.getMultipleStockPrices');

      // Cache each result and add to result object
      Object.entries(data.prices).forEach(([symbol, priceData]) => {
        const normalized = {
          price: parseFloat(priceData.price) || 0,
          previousClose: parseFloat(priceData.previousClose) || 0,
          open: parseFloat(priceData.open) || 0,
          change: parseFloat(priceData.change) || 0,
          percentChange: parseFloat(priceData.changePercent) || 0,
          high: parseFloat(priceData.high) || 0,
          low: parseFloat(priceData.low) || 0,
        };

        // Cache with LIGHT tier (2-minute TTL)
        cacheService.set('prices', symbol, normalized);
        result[symbol] = normalized;
      });

      console.log(`[EODHD] Got ${data.count} stock prices via proxy`);

      // Fill in any missing symbols with fallbacks
      for (const symbol of symbolsToFetch) {
        if (!result[symbol]) {
          result[symbol] = {
            price: FALLBACK_STOCK_PRICES[symbol] || 100,
            previousClose: FALLBACK_STOCK_PRICES[symbol] || 100,
            open: FALLBACK_STOCK_PRICES[symbol] || 100,
            change: 0,
            percentChange: 0
          };
        }
      }

      return result;
    }

    throw new Error(data.error || 'Unknown proxy error');

  } catch (error) {
    console.warn('[EODHD] Stock proxy fetch failed:', error.message);

    // Return fallbacks for symbols we couldn't fetch
    for (const symbol of symbolsToFetch) {
      const fallbackPrice = FALLBACK_STOCK_PRICES[symbol] || 100;
      result[symbol] = {
        price: fallbackPrice,
        previousClose: fallbackPrice,
        open: fallbackPrice,
        change: 0,
        percentChange: 0
      };
    }
    return result;
  }
}

// Alias for backward compatibility
export const getAllStockPrices = getMultipleStockPrices;

/**
 * Get single stock price via proxy
 */
export async function getStockPrice(symbol) {
  const prices = await getMultipleStockPrices([symbol]);
  const upper = symbol.toUpperCase();
  const p = prices[upper];
  const price = p?.price || FALLBACK_STOCK_PRICES[upper] || 100;
  return {
    symbol: upper,
    price,
    change: p?.change || 0,
    percentChange: p?.percentChange || 0,
    high: p?.high || price,
    low: p?.low || price,
    open: p?.open || price,
    previousClose: p?.previousClose || price,
    week52High: price * 1.25,
    week52Low: price * 0.75
  };
}

/**
 * Get list of popular stocks with prices (ensures all numeric fields are numbers)
 */
export async function getPopularStocks() {
  const prices = await getMultipleStockPrices(POPULAR_STOCK_SYMBOLS);

  return POPULAR_STOCK_SYMBOLS.map(symbol => {
    const price = parseFloat(prices[symbol]?.price) || FALLBACK_STOCK_PRICES[symbol] || 100;
    const percentChange = parseFloat(prices[symbol]?.percentChange) || 0;
    return {
      symbol,
      name: STOCK_NAMES[symbol] || symbol,
      price: price,
      change: parseFloat(prices[symbol]?.change) || 0,
      percentChange: percentChange,
      priceChange7d: null, // Not available from EODHD API
      priceChange30d: null, // Not available from EODHD API
      volatility: 'medium',
      week52High: price * 1.25,
      week52Low: price * 0.75,
      marketCap: 0,
      volume24h: 0,
      communityData: generateCommunityData(symbol, price, percentChange)
    };
  });
}

// ============================================
// CRYPTO FUNCTIONS (via Vercel Proxy)
// ============================================

/**
 * Get multiple crypto prices via proxy
 * @param {string[]} symbols - Array of crypto symbols (e.g., ['BTC', 'ETH'])
 * @returns {Promise<Object>} - Keyed by symbol: { BTC: {price, change24h}, ETH: {...} }
 */
export async function getMultipleCryptoPrices(symbols) {
  const upperSymbols = symbols.map(s => s.toUpperCase());
  const result = {};
  const symbolsToFetch = [];

  // Check cache for each symbol individually
  for (const symbol of upperSymbols) {
    const cached = cacheService.get('crypto', symbol);
    if (cached !== null) {
      result[symbol] = cached;
    } else {
      symbolsToFetch.push(symbol);
    }
  }

  // If all symbols were cached, return early
  if (symbolsToFetch.length === 0) {
    console.log(`[EODHD] All ${upperSymbols.length} crypto prices from cache`);
    return result;
  }

  console.log(`[EODHD] Fetching ${symbolsToFetch.length} crypto prices (${upperSymbols.length - symbolsToFetch.length} cached)`);

  try {
    const response = await fetchWithTimeout(
      `${API_BASE}/crypto/prices?symbols=${symbolsToFetch.join(',')}`
    );

    if (!response.ok) {
      throw new Error(`Proxy error: ${response.status}`);
    }

    const data = await response.json();

    if (data.success && data.prices) {
      // Track API call
      apiMonitor.track('/api/crypto/prices', { symbols: symbolsToFetch }, 'eodhdAPI.getMultipleCryptoPrices');

      const missing = [];

      // Cache each result and add to result object
      Object.entries(data.prices).forEach(([symbol, priceData]) => {
        const price = parseFloat(priceData.price);
        if (price > 0) {
          const normalized = {
            price: price,
            previousClose: parseFloat(priceData.previousClose) || 0,
            change24h: parseFloat(priceData.changePercent) || 0,
            high: parseFloat(priceData.high) || 0,
            low: parseFloat(priceData.low) || 0,
          };

          // Cache with LIGHT tier (5-minute TTL)
          cacheService.set('crypto', symbol, normalized);
          result[symbol] = normalized;
        }
      });

      console.log(`[EODHD] Got ${data.count} crypto prices via proxy`);

      // Fill in missing with fallbacks (check multiple key formats)
      for (const symbol of symbolsToFetch) {
        if (!result[symbol]) {
          missing.push(symbol);
          const fallbackPrice = FALLBACK_CRYPTO_PRICES[symbol] ||
                                FALLBACK_CRYPTO_PRICES[symbol.toLowerCase()] ||
                                FALLBACK_CRYPTO_PRICES[symbol.toUpperCase()] ||
                                1;
          result[symbol] = {
            price: fallbackPrice,
            change24h: 0,
            isFallback: true
          };
        }
      }

      if (missing.length > 0) {
        console.warn(`[EODHD] Using fallbacks for:`, missing);
      }

      return result;
    }

    throw new Error(data.error || 'Unknown proxy error');

  } catch (error) {
    console.warn('[EODHD] Crypto proxy fetch failed:', error.message);

    // Return fallbacks for symbols we couldn't fetch (check multiple key formats)
    for (const symbol of symbolsToFetch) {
      const fallbackPrice = FALLBACK_CRYPTO_PRICES[symbol] ||
                            FALLBACK_CRYPTO_PRICES[symbol.toLowerCase()] ||
                            FALLBACK_CRYPTO_PRICES[symbol.toUpperCase()] ||
                            1;
      result[symbol] = {
        price: fallbackPrice,
        change24h: 0,
        isFallback: true
      };
    }
    console.warn(`[EODHD] ${symbolsToFetch.length} prices using fallbacks due to error`);
    return result;
  }
}

// Alias for backward compatibility
export const getAllCryptoPrices = getMultipleCryptoPrices;

/**
 * Get single crypto price via proxy
 */
export async function getCryptoPrice(symbol) {
  const prices = await getMultipleCryptoPrices([symbol]);
  const upper = symbol.toUpperCase();
  const lower = symbol.toLowerCase();

  // Check multiple key formats for fallback (keys may be lowercase like 'bitcoin' or uppercase like 'BTC')
  const fallbackPrice = FALLBACK_CRYPTO_PRICES[upper] ||
                        FALLBACK_CRYPTO_PRICES[lower] ||
                        FALLBACK_CRYPTO_PRICES[symbol] ||
                        1;

  const price = prices[upper]?.price || prices[lower]?.price || prices[symbol]?.price || fallbackPrice;

  // Debug: Log crypto price resolution
  if (price === 1 || price === fallbackPrice) {
    console.log(`[EODHD] getCryptoPrice(${symbol}): resolved price=${price}, fallback=${fallbackPrice}`);
  }

  return {
    id: lower,
    symbol: upper,
    price,
    change24h: prices[upper]?.change24h || prices[lower]?.change24h || 0,
    high: prices[upper]?.high || prices[lower]?.high || price,
    low: prices[upper]?.low || prices[lower]?.low || price,
    marketCap: 0,
    volume24h: 0
  };
}

/**
 * Get list of popular crypto with prices (ensures all numeric fields are numbers)
 */
export async function getPopularCrypto() {
  const prices = await getMultipleCryptoPrices(POPULAR_CRYPTO_SYMBOLS);

  return POPULAR_CRYPTO_SYMBOLS.map(symbol => {
    const price = parseFloat(prices[symbol]?.price) || FALLBACK_CRYPTO_PRICES[symbol] || 1;
    const change24h = parseFloat(prices[symbol]?.change24h) || 0;
    return {
      symbol,
      name: CRYPTO_NAMES[symbol] || symbol,
      price: price,
      change24h: change24h,
      percentChange: change24h,
      priceChange7d: null, // Not available from EODHD API
      priceChange30d: null, // Not available from EODHD API
      volatility: 'high',
      week52High: price * 1.5,
      week52Low: price * 0.5,
      marketCap: 0,
      volume24h: 0,
      communityData: generateCommunityData(symbol, price, change24h)
    };
  });
}

/**
 * Get extended crypto data (for compatibility with old API)
 */
export async function getCryptoExtendedData(cryptoId) {
  // EODHD doesn't provide 7d/30d historical price changes
  return {
    priceChange7d: null, // Not available from EODHD API
    priceChange30d: null, // Not available from EODHD API
    week52High: 0,
    week52Low: 0
  };
}

// ============================================
// NEWS FUNCTIONS (via Vercel Proxy)
// ============================================

/**
 * Get general market news
 * @param {number} limit - Number of news items (default 10)
 * @returns {Promise<Array>} - Array of news items
 */
export async function getMarketNews(limit = 10) {
  const cacheKey = `market_${limit}`;

  // Check cache (MODERATE tier - 1 hour TTL)
  const cached = cacheService.get('news', cacheKey);
  if (cached !== null) {
    console.log('[EODHD] Using cached market news');
    return cached;
  }

  console.log(`[EODHD] Fetching market news (limit: ${limit})...`);

  try {
    const response = await fetchWithTimeout(
      `${API_BASE}/news/market?limit=${limit}`
    );

    if (!response.ok) {
      throw new Error(`Proxy error: ${response.status}`);
    }

    const data = await response.json();

    if (data.success && data.news) {
      // Track API call
      apiMonitor.track('/api/news/market', { limit }, 'eodhdAPI.getMarketNews');

      // Cache with MODERATE tier (1 hour)
      cacheService.set('news', cacheKey, data.news);

      console.log(`[EODHD] Got ${data.news.length} market news items`);
      return data.news;
    }

    throw new Error(data.error || 'Unknown proxy error');

  } catch (error) {
    console.warn('[EODHD] Market news fetch failed:', error.message);
    return getFallbackMarketNews();
  }
}

/**
 * Get news for a specific stock
 * @param {string} symbol - Stock symbol
 * @param {number} limit - Number of news items (default 5)
 * @returns {Promise<Array>} - Array of news items
 */
export async function getStockNews(symbol, limit = 5) {
  const upperSymbol = symbol.toUpperCase();
  const cacheKey = `${upperSymbol}_${limit}`;

  // Check cache (MODERATE tier - 1 hour TTL)
  const cached = cacheService.get('news', cacheKey);
  if (cached !== null) {
    console.log(`[EODHD] Using cached news for ${upperSymbol}`);
    return cached;
  }

  console.log(`[EODHD] Fetching news for ${upperSymbol}...`);

  try {
    const response = await fetchWithTimeout(
      `${API_BASE}/news/stock?symbol=${upperSymbol}&limit=${limit}`
    );

    if (!response.ok) {
      throw new Error(`Proxy error: ${response.status}`);
    }

    const data = await response.json();

    if (data.success && data.news) {
      // Track API call
      apiMonitor.track('/api/news/stock', { symbol: upperSymbol, limit }, 'eodhdAPI.getStockNews');

      // Cache with MODERATE tier (1 hour)
      cacheService.set('news', cacheKey, data.news);

      console.log(`[EODHD] Got ${data.news.length} news items for ${upperSymbol}`);
      return data.news;
    }

    throw new Error(data.error || 'Unknown proxy error');

  } catch (error) {
    console.warn(`[EODHD] Stock news fetch failed for ${upperSymbol}:`, error.message);
    return [];
  }
}

/**
 * Get news for multiple stocks
 * @param {string[]} symbols - Array of stock symbols
 * @param {number} limitPerStock - News items per stock (default 2)
 * @returns {Promise<Object>} - News keyed by symbol
 */
export async function getMultipleStockNews(symbols, limitPerStock = 2) {
  const results = {};

  // Fetch news for all symbols in parallel
  const newsPromises = symbols.map(async (symbol) => {
    const news = await getStockNews(symbol, limitPerStock);
    return { symbol: symbol.toUpperCase(), news };
  });

  const allNews = await Promise.all(newsPromises);
  allNews.forEach(({ symbol, news }) => {
    results[symbol] = news;
  });

  return results;
}

/**
 * Get top movers with their associated news
 * Combines price data with relevant news for context
 * @returns {Promise<Object>} - { gainers: [...], losers: [...] }
 */
export async function getTopMoversWithNews() {
  console.log('[EODHD] Fetching top movers with news...');

  try {
    // Get all stock prices first
    const prices = await getMultipleStockPrices(POPULAR_STOCK_SYMBOLS);

    // Convert to array and sort by percent change
    const stocksWithPrices = POPULAR_STOCK_SYMBOLS.map(symbol => ({
      symbol,
      name: STOCK_NAMES[symbol] || symbol,
      price: prices[symbol]?.price || FALLBACK_STOCK_PRICES[symbol] || 100,
      change: prices[symbol]?.change || 0,
      percentChange: prices[symbol]?.percentChange || 0
    }));

    // Sort and get top 5 gainers and losers
    const sorted = [...stocksWithPrices].sort((a, b) => b.percentChange - a.percentChange);
    const gainers = sorted.slice(0, 5);
    const losers = sorted.slice(-5).reverse();

    // Fetch news for top movers (gainers and losers)
    const moverSymbols = [...gainers, ...losers].map(s => s.symbol);
    const newsMap = await getMultipleStockNews(moverSymbols, 1);

    // Attach news to movers
    const attachNews = (movers) => movers.map(mover => ({
      ...mover,
      news: newsMap[mover.symbol] || [],
      reason: generateMoveReason(mover, newsMap[mover.symbol])
    }));

    return {
      gainers: attachNews(gainers),
      losers: attachNews(losers)
    };

  } catch (error) {
    console.warn('[EODHD] Top movers with news failed:', error.message);
    return { gainers: [], losers: [] };
  }
}

/**
 * Generate a human-readable reason for stock movement
 * @param {Object} stock - Stock data with price info
 * @param {Array} news - Related news items
 * @returns {string} - Reason string
 */
function generateMoveReason(stock, news) {
  if (news && news.length > 0) {
    // Use first news headline as reason
    const headline = news[0].title;
    if (headline.length > 60) {
      return headline.substring(0, 57) + '...';
    }
    return headline;
  }

  // Fallback reasons based on movement direction and magnitude
  const absChange = Math.abs(stock.percentChange);
  const direction = stock.percentChange > 0 ? 'up' : 'down';

  if (absChange > 5) {
    return direction === 'up'
      ? 'Strong buying pressure, possible institutional activity'
      : 'Heavy selling pressure, potential sector rotation';
  } else if (absChange > 2) {
    return direction === 'up'
      ? 'Positive market sentiment lifting shares'
      : 'Market pullback affecting shares';
  } else {
    return direction === 'up'
      ? 'Modest gains on light trading'
      : 'Minor pullback on mixed signals';
  }
}

/**
 * Fallback market news when API fails
 */
function getFallbackMarketNews() {
  return [
    {
      id: 'fallback-1',
      title: 'Markets Mixed Amid Economic Data',
      summary: 'Stock markets show mixed performance as investors digest latest economic indicators and Fed commentary.',
      source: 'Market Watch',
      url: '#',
      publishedAt: new Date().toISOString(),
      symbols: [],
      tags: ['markets', 'economy']
    },
    {
      id: 'fallback-2',
      title: 'Tech Sector Leads Trading Activity',
      summary: 'Technology stocks continue to drive market activity as earnings season approaches.',
      source: 'Financial Times',
      url: '#',
      publishedAt: new Date().toISOString(),
      symbols: ['AAPL', 'MSFT', 'GOOGL'],
      tags: ['tech', 'earnings']
    },
    {
      id: 'fallback-3',
      title: 'Global Markets Update',
      summary: 'International markets show varied performance amid geopolitical developments and currency movements.',
      source: 'Reuters',
      url: '#',
      publishedAt: new Date().toISOString(),
      symbols: [],
      tags: ['global', 'forex']
    }
  ];
}

/**
 * Clear news cache
 */
export function clearNewsCache() {
  cacheService.clearType('news');
  logDebug('News cache cleared');
}

// ============================================
// EARNINGS DATA
// ============================================

/**
 * Fetch latest earnings data for a stock
 * @param {string} symbol - Stock symbol (e.g., 'AAPL')
 * @returns {Promise<Object|null>} - Earnings data or null
 */
export async function fetchLatestEarnings(symbol) {
  const upperSymbol = symbol.toUpperCase();

  // Check cache (AGGRESSIVE tier - 24 hour TTL)
  const cached = cacheService.get('earnings', upperSymbol);
  if (cached !== null) {
    console.log(`[EODHD] Using cached earnings for ${upperSymbol}`);
    return cached;
  }

  console.log(`[EODHD] Fetching earnings for ${upperSymbol}...`);

  try {
    const response = await fetchWithTimeout(
      `${API_BASE}/stocks/earnings?symbol=${upperSymbol}`
    );

    if (!response.ok) {
      throw new Error(`Proxy error: ${response.status}`);
    }

    const result = await response.json();

    if (result.success && result.data) {
      // Track API call
      apiMonitor.track('/api/stocks/earnings', { symbol: upperSymbol }, 'eodhdAPI.fetchLatestEarnings');

      // Cache with AGGRESSIVE tier (24 hours)
      cacheService.set('earnings', upperSymbol, result.data);

      console.log(`[EODHD] Got earnings for ${upperSymbol}:`, result.data.quarter);
      return result.data;
    }

    console.warn(`[EODHD] No earnings data for ${upperSymbol}:`, result.error);
    return null;

  } catch (error) {
    console.warn(`[EODHD] Earnings fetch failed for ${upperSymbol}:`, error.message);
    return null;
  }
}

/**
 * Clear earnings cache
 */
export function clearEarningsCache() {
  cacheService.clearType('earnings');
  logDebug('Earnings cache cleared');
}

// ============================================
// HISTORICAL OHLCV DATA
// ============================================

/**
 * Fetch historical OHLCV data for technical analysis
 * @param {string} symbol - Stock ticker (e.g., 'AAPL')
 * @param {string} timeframe - Timeframe: '1h' (hourly), '1d' (daily), '1w' (weekly)
 * @returns {Promise<Object>} Object with { data, actualTimeframe, fallbackMessage } or just data array for backwards compatibility
 */
export async function fetchHistoricalOHLCV(symbol, timeframe = '1d', { days, from, to, type } = {}) {
  const upperSymbol = symbol.toUpperCase();
  const cacheKey = `ohlcv_${upperSymbol}_${timeframe}${days ? `_${days}d` : ''}`;

  // Check cache (AGGRESSIVE tier - longer TTL for historical data)
  const cached = cacheService.get('historical', cacheKey);
  if (cached !== null) {
    console.log(`[EODHD] Using cached ${timeframe} OHLCV for ${upperSymbol}`);
    // Return cached data - could be array (old format) or object with metadata
    return Array.isArray(cached) ? cached : cached.data || cached;
  }

  console.log(`[EODHD] Fetching ${timeframe} OHLCV for ${upperSymbol}...`);

  try {
    const isCryptoSymbol = type === 'crypto' || POPULAR_CRYPTO_SYMBOLS.includes(upperSymbol) || CRYPTO_SYMBOLS.has(upperSymbol);
    let url = `${API_BASE}/stocks/historical?symbol=${upperSymbol}&timeframe=${timeframe}`;
    if (isCryptoSymbol) url += '&type=crypto';
    if (days) url += `&days=${days}`;
    if (from) url += `&from=${from}`;
    if (to) url += `&to=${to}`;
    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      throw new Error(`Proxy error: ${response.status}`);
    }

    const result = await response.json();

    if (result.success && result.data) {
      // Track API call
      apiMonitor.track('/api/stocks/historical', { symbol: upperSymbol, timeframe }, 'eodhdAPI.fetchHistoricalOHLCV');

      // Log if there was a fallback
      if (result.fallbackMessage) {
        console.warn(`[EODHD] ${result.fallbackMessage} for ${upperSymbol}`);
      }

      // Cache with longer TTL (historical data doesn't change)
      // Cache the actual timeframe's data to avoid re-fetching
      const actualCacheKey = `ohlcv_${upperSymbol}_${result.timeframe}${days ? `_${days}d` : ''}`;
      cacheService.set('historical', actualCacheKey, result.data);

      console.log(`[EODHD] Got ${result.data.length} ${result.timeframe} OHLCV candles for ${upperSymbol}`);

      // Return data with metadata for the UI to handle
      // Attach metadata to the array for backwards compatibility
      const dataWithMeta = result.data;
      dataWithMeta._meta = {
        actualTimeframe: result.timeframe,
        requestedTimeframe: result.requestedTimeframe || timeframe,
        fallbackMessage: result.fallbackMessage || null,
        description: result.description
      };
      return dataWithMeta;
    }

    throw new Error(result.error || 'Failed to fetch historical data');

  } catch (error) {
    console.warn(`[EODHD] Historical OHLCV fetch failed for ${upperSymbol}:`, error.message);
    return null;
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Generate mock community data for social proof
 */
function generateCommunityData(symbol, price, percentChange) {
  const basePicks = Math.floor(500 + Math.random() * 3500);
  const volatilityMultiplier = Math.abs(percentChange) > 3 ? 1.5 : 1.0;
  const adjustedPicks = Math.floor(basePicks * volatilityMultiplier);

  return {
    picksThisWeek: adjustedPicks,
    trendPercentage: Math.floor(-50 + Math.random() * 250),
    isHot: adjustedPicks > 2500,
    isTrending: adjustedPicks > 2000,
    championPick: Math.random() > 0.4,
    championPercentage: Math.floor(40 + Math.random() * 45),
    rankDistribution: {
      beginner: Math.floor(adjustedPicks * 0.25),
      veteran: Math.floor(adjustedPicks * 0.35),
      expert: Math.floor(adjustedPicks * 0.25),
      master: Math.floor(adjustedPicks * 0.15)
    },
    winRate: Math.floor(50 + Math.random() * 20),
    totalBattles: Math.floor(adjustedPicks * 0.6),
    wins: Math.floor(adjustedPicks * 0.35),
    losses: Math.floor(adjustedPicks * 0.25),
    avgReturnWhenWinning: +(3 + Math.random() * 12).toFixed(1),
    popularityRank: 0,
    recentActivity: null
  };
}

/**
 * Symbol conversion helpers (legacy compatibility stubs)
 *
 * These functions originally converted between MarketClash symbols (BTC)
 * and CoinGecko IDs (bitcoin). Since EODHD uses symbols directly,
 * these are now identity functions that just return the uppercase symbol.
 *
 * Kept for backward compatibility with existing code in:
 * - DraftBattleScreen.jsx
 * - draftService.js
 *
 * @deprecated Use the symbol directly instead of calling these functions
 */
export function symbolToCoinGeckoId(symbol) {
  return symbol.toUpperCase();
}

export function coinGeckoIdToSymbol(id) {
  return id.toUpperCase();
}

/**
 * Clear all cached prices
 */
export function clearCache() {
  cacheService.clearType('prices');
  cacheService.clearType('crypto');
  logDebug('Price caches cleared');
}

// Alias for backward compatibility
export const clearBatchPriceCache = clearCache;

/**
 * Test API connection via proxy
 */
export async function testConnection() {
  try {
    const response = await fetchWithTimeout(`${API_BASE}/stocks/prices?symbols=AAPL`);

    if (response.ok) {
      const data = await response.json();
      console.log('[EODHD] Proxy connection test successful:', data);
      return true;
    }

    return false;
  } catch (error) {
    console.error('[EODHD] Proxy connection test failed:', error);
    return false;
  }
}

// ============================================
// DATA CONSTANTS (derived from centralized assets)
// ============================================

// Use centralized asset definitions
const POPULAR_STOCK_SYMBOLS = getStockSymbols();
const POPULAR_CRYPTO_SYMBOLS = getCryptoSymbols();

// Build name mappings from centralized data
const STOCK_NAMES = getStockNameMap();
const CRYPTO_NAMES = getCryptoNameMap();

// Use centralized fallback prices
const FALLBACK_STOCK_PRICES = CENTRALIZED_FALLBACK_STOCK_PRICES;
const FALLBACK_CRYPTO_PRICES = CENTRALIZED_FALLBACK_CRYPTO_PRICES;

// Export constants for backward compatibility (now includes sector/category metadata)
export const POPULAR_STOCKS = STOCKS.map(stock => ({
  symbol: stock.symbol,
  name: stock.name,
  sector: stock.sector
}));

export const POPULAR_CRYPTO = CRYPTO.map(crypto => ({
  id: crypto.id,
  symbol: crypto.symbol,
  name: crypto.name,
  category: crypto.category
}));

export { FALLBACK_CRYPTO_PRICES, FALLBACK_STOCK_PRICES };

/**
 * Legacy symbol mappings (empty - EODHD uses symbols directly)
 * @deprecated These are kept for backward compatibility only
 */
export const SYMBOL_TO_COINGECKO_ID = {};
export const COINGECKO_ID_TO_SYMBOL = {};

// ============================================
// CACHE DEBUGGING UTILITIES
// ============================================

/**
 * Get cache statistics
 * @returns {object} Cache stats including hit rate, sizes, etc.
 */
export function getCacheStats() {
  return cacheService.getStats();
}

/**
 * Print cache report to console
 */
export function printCacheReport() {
  cacheService.report();
}

/**
 * Clear all caches (prices, crypto, news, earnings)
 */
export function clearAllCaches() {
  cacheService.clearAll();
  logDebug('All caches cleared');
}

// Expose cache service to window for browser debugging
if (typeof window !== 'undefined') {
  window.mcCache = {
    get: (type, key) => cacheService.get(type, key),
    stats: () => cacheService.getStats(),
    report: () => cacheService.report(),
    clearAll: () => cacheService.clearAll(),
    clearType: (type) => cacheService.clearType(type)
  };
}

// ============================================
// BACKWARD COMPATIBLE EXPORTS
// ============================================

// These match the old stockAPI.js interface for easy migration
export const stockAPI = {
  getStockPrice,
  getCryptoPrice,
  getPopularStocks,
  getPopularCrypto,
  getCryptoExtendedData,
  getMultipleStockPrices,
  getMultipleCryptoPrices,
  // Aliases for old function names
  getAllStockPrices,
  getAllCryptoPrices,
  clearBatchPriceCache,
  clearCache,
  testConnection,
  // Symbol utilities (simplified for EODHD)
  symbolToCoinGeckoId,
  coinGeckoIdToSymbol,
  // News functions
  getMarketNews,
  getStockNews,
  getMultipleStockNews,
  getTopMoversWithNews,
  clearNewsCache,
  // Earnings functions
  fetchLatestEarnings,
  clearEarningsCache,
  // Historical OHLCV data
  fetchHistoricalOHLCV,
  // Cache utilities
  getCacheStats,
  printCacheReport,
  clearAllCaches,
  // Constants
  POPULAR_STOCKS,
  POPULAR_CRYPTO,
  FALLBACK_CRYPTO_PRICES,
  FALLBACK_STOCK_PRICES,
  SYMBOL_TO_COINGECKO_ID,
  COINGECKO_ID_TO_SYMBOL
};

export default stockAPI;
