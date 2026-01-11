// EODHD API Service for MarketClash
// Uses Vercel serverless proxy to avoid CORS issues
// Endpoints: /api/crypto/prices, /api/stocks/prices

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
// PRICE CACHE (reduces API calls)
// ============================================

const priceCache = {
  stocks: {},
  crypto: {},
  lastFetch: {
    stocks: 0,
    crypto: 0
  },
  CACHE_DURATION: 60000, // 1 minute cache
};

// ============================================
// NEWS CACHE (reduces API calls)
// ============================================

const newsCache = {
  market: { data: null, timestamp: 0 },
  stocks: {}, // keyed by symbol
  CACHE_DURATION: 300000, // 5 minute cache for news
};

// ============================================
// FETCH WITH TIMEOUT
// ============================================

const fetchWithTimeout = async (url, timeout = 15000) => {
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
  const now = Date.now();
  const upperSymbols = symbols.map(s => s.toUpperCase());

  // Check cache
  if (now - priceCache.lastFetch.stocks < priceCache.CACHE_DURATION) {
    const allCached = upperSymbols.every(s => priceCache.stocks[s]);
    if (allCached) {
      console.log('[EODHD] Using cached stock prices');
      const result = {};
      upperSymbols.forEach(s => result[s] = priceCache.stocks[s]);
      return result;
    }
  }

  console.log(`[EODHD] Fetching ${symbols.length} stock prices via proxy...`);

  try {
    const response = await fetchWithTimeout(
      `${API_BASE}/stocks/prices?symbols=${upperSymbols.join(',')}`
    );

    if (!response.ok) {
      throw new Error(`Proxy error: ${response.status}`);
    }

    const data = await response.json();

    if (data.success && data.prices) {
      // Update cache (ensure all values are numbers)
      Object.entries(data.prices).forEach(([symbol, priceData]) => {
        priceCache.stocks[symbol] = {
          price: parseFloat(priceData.price) || 0,
          change: parseFloat(priceData.change) || 0,
          percentChange: parseFloat(priceData.changePercent) || 0
        };
      });
      priceCache.lastFetch.stocks = now;

      console.log(`[EODHD] Got ${data.count} stock prices via proxy`);

      // Return in expected format, with fallbacks for missing (ensure all values are numbers)
      const result = {};
      upperSymbols.forEach(s => {
        if (data.prices[s]) {
          result[s] = {
            price: parseFloat(data.prices[s].price) || FALLBACK_STOCK_PRICES[s] || 100,
            change: parseFloat(data.prices[s].change) || 0,
            percentChange: parseFloat(data.prices[s].changePercent) || 0
          };
        } else {
          result[s] = {
            price: FALLBACK_STOCK_PRICES[s] || 100,
            change: 0,
            percentChange: 0
          };
        }
      });

      return result;
    }

    throw new Error(data.error || 'Unknown proxy error');

  } catch (error) {
    console.warn('[EODHD] Stock proxy fetch failed:', error.message);

    // Return fallback prices
    const result = {};
    upperSymbols.forEach(s => {
      result[s] = {
        price: FALLBACK_STOCK_PRICES[s] || 100,
        change: 0,
        percentChange: 0
      };
    });
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
  return {
    symbol: upper,
    price: prices[upper]?.price || FALLBACK_STOCK_PRICES[upper] || 100,
    change: prices[upper]?.change || 0,
    percentChange: prices[upper]?.percentChange || 0,
    high: prices[upper]?.price || 100,
    low: prices[upper]?.price || 100,
    open: prices[upper]?.price || 100,
    previousClose: prices[upper]?.price || 100,
    week52High: (prices[upper]?.price || 100) * 1.25,
    week52Low: (prices[upper]?.price || 100) * 0.75
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
      priceChange7d: (Math.random() - 0.5) * 10,
      priceChange30d: (Math.random() - 0.5) * 30,
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
  const now = Date.now();
  const upperSymbols = symbols.map(s => s.toUpperCase());

  console.log(`[EODHD] Requesting crypto prices for:`, upperSymbols);

  // Check cache
  if (now - priceCache.lastFetch.crypto < priceCache.CACHE_DURATION) {
    const allCached = upperSymbols.every(s => priceCache.crypto[s]);
    if (allCached) {
      console.log('[EODHD] Using cached crypto prices');
      const result = {};
      upperSymbols.forEach(s => result[s] = priceCache.crypto[s]);
      return result;
    }
  }

  console.log(`[EODHD] Fetching ${symbols.length} crypto prices via proxy...`);

  try {
    const response = await fetchWithTimeout(
      `${API_BASE}/crypto/prices?symbols=${upperSymbols.join(',')}`
    );

    if (!response.ok) {
      throw new Error(`Proxy error: ${response.status}`);
    }

    const data = await response.json();
    console.log(`[EODHD] Proxy response:`, data);

    if (data.success && data.prices) {
      // Update cache (ensure all values are numbers)
      Object.entries(data.prices).forEach(([symbol, priceData]) => {
        priceCache.crypto[symbol] = {
          price: parseFloat(priceData.price) || 0,
          change24h: parseFloat(priceData.changePercent) || 0
        };
      });
      priceCache.lastFetch.crypto = now;

      console.log(`[EODHD] Got ${data.count} crypto prices via proxy`);

      // Return in expected format, with fallbacks for missing (ensure all values are numbers)
      const result = {};
      const missing = [];

      upperSymbols.forEach(s => {
        const price = parseFloat(data.prices[s]?.price);
        if (data.prices[s] && price > 0) {
          result[s] = {
            price: price,
            change24h: parseFloat(data.prices[s].changePercent) || 0
          };
        } else {
          missing.push(s);
          result[s] = {
            price: FALLBACK_CRYPTO_PRICES[s] || 1,
            change24h: 0,
            isFallback: true
          };
        }
      });

      if (missing.length > 0) {
        console.warn(`[EODHD] Using fallbacks for:`, missing);
      }

      return result;
    }

    throw new Error(data.error || 'Unknown proxy error');

  } catch (error) {
    console.warn('[EODHD] Crypto proxy fetch failed:', error.message);

    // Return fallback prices
    const result = {};
    upperSymbols.forEach(s => {
      result[s] = {
        price: FALLBACK_CRYPTO_PRICES[s] || 1,
        change24h: 0,
        isFallback: true
      };
    });
    console.warn(`[EODHD] All ${upperSymbols.length} prices using fallbacks due to error`);
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
  return {
    id: upper.toLowerCase(),
    symbol: upper,
    price: prices[upper]?.price || FALLBACK_CRYPTO_PRICES[upper] || 1,
    change24h: prices[upper]?.change24h || 0,
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
      priceChange7d: (Math.random() - 0.5) * 15,
      priceChange30d: (Math.random() - 0.5) * 40,
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
  // EODHD doesn't have 7d/30d change, so we return estimates
  return {
    priceChange7d: (Math.random() - 0.5) * 15,
    priceChange30d: (Math.random() - 0.5) * 40,
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
  const now = Date.now();

  // Check cache
  if (now - newsCache.market.timestamp < newsCache.CACHE_DURATION && newsCache.market.data) {
    console.log('[EODHD] Using cached market news');
    return newsCache.market.data.slice(0, limit);
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
      // Update cache
      newsCache.market = {
        data: data.news,
        timestamp: now
      };

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
  const now = Date.now();
  const upperSymbol = symbol.toUpperCase();

  // Check cache
  const cached = newsCache.stocks[upperSymbol];
  if (cached && now - cached.timestamp < newsCache.CACHE_DURATION) {
    console.log(`[EODHD] Using cached news for ${upperSymbol}`);
    return cached.data.slice(0, limit);
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
      // Update cache
      newsCache.stocks[upperSymbol] = {
        data: data.news,
        timestamp: now
      };

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
  newsCache.market = { data: null, timestamp: 0 };
  newsCache.stocks = {};
  logDebug('News cache cleared');
}

// ============================================
// EARNINGS DATA
// ============================================

// Cache for earnings data (24 hours)
const earningsCache = {
  data: {}, // keyed by symbol
  CACHE_DURATION: 24 * 60 * 60 * 1000 // 24 hours
};

/**
 * Fetch latest earnings data for a stock
 * @param {string} symbol - Stock symbol (e.g., 'AAPL')
 * @returns {Promise<Object|null>} - Earnings data or null
 */
export async function fetchLatestEarnings(symbol) {
  const upperSymbol = symbol.toUpperCase();
  const now = Date.now();

  // Check cache first
  const cached = earningsCache.data[upperSymbol];
  if (cached && now - cached.timestamp < earningsCache.CACHE_DURATION) {
    console.log(`[EODHD] Using cached earnings for ${upperSymbol}`);
    return cached.data;
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
      // Update cache
      earningsCache.data[upperSymbol] = {
        data: result.data,
        timestamp: now
      };

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
  earningsCache.data = {};
  logDebug('Earnings cache cleared');
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
  priceCache.stocks = {};
  priceCache.crypto = {};
  priceCache.lastFetch = { stocks: 0, crypto: 0 };
  logDebug('Cache cleared');
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
  // Constants
  POPULAR_STOCKS,
  POPULAR_CRYPTO,
  FALLBACK_CRYPTO_PRICES,
  FALLBACK_STOCK_PRICES,
  SYMBOL_TO_COINGECKO_ID,
  COINGECKO_ID_TO_SYMBOL
};

export default stockAPI;
