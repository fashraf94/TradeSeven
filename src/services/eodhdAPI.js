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
      // Update cache
      Object.entries(data.prices).forEach(([symbol, priceData]) => {
        priceCache.stocks[symbol] = {
          price: priceData.price,
          change: priceData.change,
          percentChange: priceData.changePercent
        };
      });
      priceCache.lastFetch.stocks = now;

      console.log(`[EODHD] Got ${data.count} stock prices via proxy`);

      // Return in expected format, with fallbacks for missing
      const result = {};
      upperSymbols.forEach(s => {
        if (data.prices[s]) {
          result[s] = {
            price: data.prices[s].price,
            change: data.prices[s].change,
            percentChange: data.prices[s].changePercent
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
 * Get list of popular stocks with prices
 */
export async function getPopularStocks() {
  const prices = await getMultipleStockPrices(POPULAR_STOCK_SYMBOLS);

  return POPULAR_STOCK_SYMBOLS.map(symbol => ({
    symbol,
    name: STOCK_NAMES[symbol] || symbol,
    price: prices[symbol]?.price || FALLBACK_STOCK_PRICES[symbol] || 100,
    change: prices[symbol]?.change || 0,
    percentChange: prices[symbol]?.percentChange || 0,
    priceChange7d: (Math.random() - 0.5) * 10,
    priceChange30d: (Math.random() - 0.5) * 30,
    volatility: 'medium',
    week52High: (prices[symbol]?.price || 100) * 1.25,
    week52Low: (prices[symbol]?.price || 100) * 0.75,
    marketCap: 0,
    volume24h: 0,
    communityData: generateCommunityData(symbol, prices[symbol]?.price || 100, prices[symbol]?.percentChange || 0)
  }));
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
      // Update cache
      Object.entries(data.prices).forEach(([symbol, priceData]) => {
        priceCache.crypto[symbol] = {
          price: priceData.price,
          change24h: priceData.changePercent
        };
      });
      priceCache.lastFetch.crypto = now;

      console.log(`[EODHD] Got ${data.count} crypto prices via proxy`);

      // Return in expected format, with fallbacks for missing
      const result = {};
      const missing = [];

      upperSymbols.forEach(s => {
        if (data.prices[s] && data.prices[s].price > 0) {
          result[s] = {
            price: data.prices[s].price,
            change24h: data.prices[s].changePercent || 0
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
 * Get list of popular crypto with prices
 */
export async function getPopularCrypto() {
  const prices = await getMultipleCryptoPrices(POPULAR_CRYPTO_SYMBOLS);

  return POPULAR_CRYPTO_SYMBOLS.map(symbol => ({
    symbol,
    name: CRYPTO_NAMES[symbol] || symbol,
    price: prices[symbol]?.price || FALLBACK_CRYPTO_PRICES[symbol] || 1,
    change24h: prices[symbol]?.change24h || 0,
    percentChange: prices[symbol]?.change24h || 0,
    priceChange7d: (Math.random() - 0.5) * 15,
    priceChange30d: (Math.random() - 0.5) * 40,
    volatility: 'high',
    week52High: (prices[symbol]?.price || 100) * 1.5,
    week52Low: (prices[symbol]?.price || 100) * 0.5,
    marketCap: 0,
    volume24h: 0,
    communityData: generateCommunityData(symbol, prices[symbol]?.price || 100, prices[symbol]?.change24h || 0)
  }));
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
 * Symbol conversion helper (for backward compatibility)
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

// Empty symbol mapping (EODHD uses symbols directly)
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
  // Constants
  POPULAR_STOCKS,
  POPULAR_CRYPTO,
  FALLBACK_CRYPTO_PRICES,
  FALLBACK_STOCK_PRICES,
  SYMBOL_TO_COINGECKO_ID,
  COINGECKO_ID_TO_SYMBOL
};

export default stockAPI;
