// MarketClash TD Scoring - Volatility Threshold Service
// Client-side service to fetch and cache volatility thresholds
//
// Thresholds determine how much an asset needs to move to score "breakout" points
// Uses the "DraftKings Model" - hot assets have higher thresholds

const IS_DEV = import.meta.env?.DEV ?? false;

// ============================================
// CONFIGURATION
// ============================================

const CACHE_KEY = 'marketclash_volatility_thresholds';
const CACHE_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const API_BASE = '/api/volatility/thresholds';

// ============================================
// DEFAULT THRESHOLDS (fallback when API fails)
// ============================================

const STOCK_DEFAULTS = {
  // High volatility
  'TSLA': 4.0, 'NVDA': 3.5, 'AMD': 3.5, 'COIN': 5.0, 'GME': 6.0,
  'MSTR': 5.0, 'RIVN': 4.5, 'LCID': 4.5, 'NIO': 4.0, 'PLTR': 3.5,
  // Medium volatility
  'AAPL': 2.0, 'MSFT': 2.0, 'GOOGL': 2.5, 'AMZN': 2.5, 'META': 3.0,
  'NFLX': 3.0, 'CRM': 2.5, 'ORCL': 2.0, 'ADBE': 2.5, 'INTC': 2.5,
  // Low volatility
  'JNJ': 1.2, 'KO': 1.0, 'PG': 1.0, 'WMT': 1.5, 'JPM': 1.8,
  'BAC': 1.8, 'WFC': 1.8, 'VZ': 1.2, 'T': 1.5, 'XOM': 2.0,
  'DEFAULT': 2.5
};

const CRYPTO_DEFAULTS = {
  'BTC': 5.0, 'ETH': 6.0, 'SOL': 8.0, 'ADA': 7.0,
  'DOGE': 10.0, 'XRP': 7.0, 'AVAX': 8.0, 'DOT': 7.0,
  'MATIC': 8.0, 'LINK': 7.0, 'UNI': 8.0, 'ATOM': 7.0,
  'LTC': 6.0, 'BCH': 6.0, 'NEAR': 8.0, 'APT': 8.0,
  'ARB': 9.0, 'OP': 9.0, 'SHIB': 12.0, 'PEPE': 15.0,
  'DEFAULT': 6.0
};

// ============================================
// IN-MEMORY CACHE (session cache)
// ============================================

let memoryCache = {
  stocks: {},
  crypto: {},
  lastUpdated: 0
};

// ============================================
// LOGGING
// ============================================

function logDebug(message, ...args) {
  if (IS_DEV) {
    console.log(`[VolatilityService] ${message}`, ...args);
  }
}

function logWarn(message, ...args) {
  if (IS_DEV) {
    console.warn(`[VolatilityService] ${message}`, ...args);
  }
}

// ============================================
// LOCAL STORAGE HELPERS
// ============================================

/**
 * Load cached thresholds from localStorage
 */
export function loadCachedThresholds() {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) {
      logDebug('No cached thresholds found');
      return null;
    }

    const data = JSON.parse(cached);

    // Check if cache is still valid (7 days)
    const age = Date.now() - (data.lastUpdated || 0);
    if (age > CACHE_DURATION_MS) {
      logDebug('Cache expired, clearing');
      localStorage.removeItem(CACHE_KEY);
      return null;
    }

    // Load into memory cache
    memoryCache = {
      stocks: data.stocks || {},
      crypto: data.crypto || {},
      lastUpdated: data.lastUpdated || 0
    };

    logDebug(`Loaded ${Object.keys(memoryCache.stocks).length} stock and ${Object.keys(memoryCache.crypto).length} crypto thresholds from cache`);
    return memoryCache;

  } catch (error) {
    logWarn('Failed to load cached thresholds:', error.message);
    return null;
  }
}

/**
 * Save thresholds to localStorage
 */
function saveCacheToStorage() {
  try {
    const data = {
      stocks: memoryCache.stocks,
      crypto: memoryCache.crypto,
      lastUpdated: Date.now()
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    memoryCache.lastUpdated = data.lastUpdated;
    logDebug('Saved thresholds to localStorage');
  } catch (error) {
    logWarn('Failed to save cache to localStorage:', error.message);
  }
}

/**
 * Clear all cached thresholds
 */
export function clearThresholdCache() {
  memoryCache = { stocks: {}, crypto: {}, lastUpdated: 0 };
  localStorage.removeItem(CACHE_KEY);
  logDebug('Threshold cache cleared');
}

/**
 * Get all cached thresholds (for debugging)
 */
export function getAllCachedThresholds() {
  return {
    ...memoryCache,
    cacheAgeMs: Date.now() - memoryCache.lastUpdated,
    cacheAgeDays: (Date.now() - memoryCache.lastUpdated) / (24 * 60 * 60 * 1000)
  };
}

// ============================================
// DEFAULT THRESHOLD HELPERS
// ============================================

/**
 * Get default threshold for a symbol
 */
function getDefaultThreshold(symbol, type) {
  const defaults = type === 'crypto' ? CRYPTO_DEFAULTS : STOCK_DEFAULTS;
  const threshold = defaults[symbol.toUpperCase()] || defaults['DEFAULT'];

  return {
    symbol: symbol.toUpperCase(),
    threshold,
    baseATR: threshold / (type === 'crypto' ? 2.0 : 1.5),
    recentATR: threshold / (type === 'crypto' ? 2.0 : 1.5),
    momentumFactor: 1.0,
    rallyThreshold: Number((threshold * 1.5).toFixed(2)),
    moonshotThreshold: Number((threshold * 2.0).toFixed(2)),
    bustThreshold: threshold,
    crashThreshold: Number((threshold * 1.5).toFixed(2)),
    meltdownThreshold: Number((threshold * 2.0).toFixed(2)),
    type,
    calculatedAt: new Date().toISOString(),
    isDefault: true
  };
}

// ============================================
// CACHE LOOKUP
// ============================================

/**
 * Check if symbol is in cache
 */
function getCachedThreshold(symbol, type) {
  const cache = type === 'crypto' ? memoryCache.crypto : memoryCache.stocks;
  return cache[symbol.toUpperCase()] || null;
}

/**
 * Add threshold to cache
 */
function addToCache(thresholdData, type) {
  const cache = type === 'crypto' ? memoryCache.crypto : memoryCache.stocks;
  cache[thresholdData.symbol.toUpperCase()] = thresholdData;
}

/**
 * Find which symbols are missing from cache
 */
function findMissingSymbols(symbols, type) {
  const cache = type === 'crypto' ? memoryCache.crypto : memoryCache.stocks;
  return symbols.filter(s => !cache[s.toUpperCase()]);
}

// ============================================
// API FETCHING
// ============================================

/**
 * Fetch thresholds from API for given symbols
 */
async function fetchFromAPI(symbols, type) {
  if (symbols.length === 0) {
    return {};
  }

  const symbolsParam = symbols.map(s => s.toUpperCase()).join(',');
  const url = `${API_BASE}?symbols=${encodeURIComponent(symbolsParam)}&type=${type}`;

  logDebug(`Fetching thresholds for ${symbols.length} ${type} symbols from API`);

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const data = await response.json();

    if (!data.success || !data.thresholds) {
      throw new Error('Invalid API response');
    }

    logDebug(`Received ${Object.keys(data.thresholds).length} thresholds from API`);
    return data.thresholds;

  } catch (error) {
    logWarn(`API fetch failed:`, error.message);
    return null;
  }
}

// ============================================
// PUBLIC API
// ============================================

/**
 * Fetch thresholds for multiple symbols
 * Checks cache first, only fetches missing symbols from API
 *
 * @param {string[]} symbols - Array of symbol strings (e.g., ['AAPL', 'MSFT'])
 * @param {string} type - 'stock' or 'crypto'
 * @returns {Object} Map of symbol -> threshold data
 */
export async function getVolatilityThresholds(symbols, type = 'stock') {
  // Ensure cache is loaded
  if (memoryCache.lastUpdated === 0) {
    loadCachedThresholds();
  }

  const normalizedSymbols = symbols.map(s => s.toUpperCase());
  const results = {};

  // First, get all cached thresholds
  const missingSymbols = [];
  for (const symbol of normalizedSymbols) {
    const cached = getCachedThreshold(symbol, type);
    if (cached) {
      results[symbol] = cached;
    } else {
      missingSymbols.push(symbol);
    }
  }

  logDebug(`Cache hit: ${Object.keys(results).length}, missing: ${missingSymbols.length}`);

  // Fetch missing symbols from API
  if (missingSymbols.length > 0) {
    const apiResults = await fetchFromAPI(missingSymbols, type);

    if (apiResults) {
      // Add API results to cache and results
      for (const [symbol, data] of Object.entries(apiResults)) {
        addToCache(data, type);
        results[symbol.toUpperCase()] = data;
      }

      // Save updated cache to localStorage
      saveCacheToStorage();
    } else {
      // API failed, use defaults for missing symbols
      logWarn(`Using defaults for ${missingSymbols.length} symbols`);
      for (const symbol of missingSymbols) {
        const defaultData = getDefaultThreshold(symbol, type);
        addToCache(defaultData, type);
        results[symbol] = defaultData;
      }
      saveCacheToStorage();
    }
  }

  return results;
}

/**
 * Fetch single symbol threshold
 * Convenience wrapper around getVolatilityThresholds
 *
 * @param {string} symbol - Symbol string (e.g., 'AAPL')
 * @param {string} type - 'stock' or 'crypto'
 * @returns {Object} Threshold data for the symbol
 */
export async function getThreshold(symbol, type = 'stock') {
  const results = await getVolatilityThresholds([symbol], type);
  return results[symbol.toUpperCase()] || getDefaultThreshold(symbol, type);
}

/**
 * Force refresh thresholds (ignore cache)
 * Clears specified symbols from cache and fetches fresh data
 *
 * @param {string[]} symbols - Array of symbol strings
 * @param {string} type - 'stock' or 'crypto'
 * @returns {Object} Map of symbol -> threshold data
 */
export async function refreshThresholds(symbols, type = 'stock') {
  const cache = type === 'crypto' ? memoryCache.crypto : memoryCache.stocks;

  // Remove specified symbols from cache
  for (const symbol of symbols) {
    delete cache[symbol.toUpperCase()];
  }

  logDebug(`Cleared ${symbols.length} symbols from ${type} cache, fetching fresh data`);

  // Fetch fresh data
  return getVolatilityThresholds(symbols, type);
}

/**
 * Preload thresholds for common symbols
 * Call this at app startup to warm the cache
 *
 * @param {string[]} stockSymbols - Stock symbols to preload
 * @param {string[]} cryptoSymbols - Crypto symbols to preload
 */
export async function preloadThresholds(stockSymbols = [], cryptoSymbols = []) {
  logDebug('Preloading thresholds...');

  const promises = [];

  if (stockSymbols.length > 0) {
    promises.push(getVolatilityThresholds(stockSymbols, 'stock'));
  }

  if (cryptoSymbols.length > 0) {
    promises.push(getVolatilityThresholds(cryptoSymbols, 'crypto'));
  }

  await Promise.all(promises);
  logDebug('Preload complete');
}

// ============================================
// EXPORTS
// ============================================

// Default export with all functions
export default {
  getVolatilityThresholds,
  getThreshold,
  refreshThresholds,
  preloadThresholds,
  loadCachedThresholds,
  clearThresholdCache,
  getAllCachedThresholds,
  // Constants for testing
  STOCK_DEFAULTS,
  CRYPTO_DEFAULTS
};
