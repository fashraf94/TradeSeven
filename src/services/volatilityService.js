// MarketClash TD Scoring - Volatility Threshold Service
// Client-side service to fetch and cache volatility thresholds
//
// Thresholds determine how much an asset needs to move to score "breakout" points
// Uses the "DraftKings Model" - hot assets have higher thresholds

const IS_DEV = import.meta.env?.DEV ?? false;

// ============================================
// CONFIGURATION
// ============================================

const CACHE_KEY = 'marketclash_volatility_thresholds_v2';
const CACHE_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const API_BASE = '/api/volatility/thresholds';

// ============================================
// DEFAULT THRESHOLDS (fallback when API fails)
// ============================================

const STOCK_DEFAULTS = {
  // High volatility
  'TSLA': 3.5, 'NVDA': 2.8, 'AMD': 3.0, 'COIN': 4.0, 'GME': 5.0,
  'MSTR': 4.0, 'RIVN': 3.5, 'LCID': 3.5, 'NIO': 3.0, 'PLTR': 3.0,
  // Medium volatility
  'AAPL': 1.8, 'MSFT': 1.8, 'GOOGL': 2.0, 'AMZN': 2.0, 'META': 2.5,
  'NFLX': 2.5, 'CRM': 2.0, 'ORCL': 1.8, 'ADBE': 2.0, 'INTC': 2.0,
  // Low volatility
  'JNJ': 1.0, 'KO': 0.8, 'PG': 0.8, 'WMT': 1.2, 'JPM': 1.5,
  'BAC': 1.5, 'WFC': 1.5, 'VZ': 1.0, 'T': 1.2, 'XOM': 1.8,
  'DEFAULT': 2.0
};

const CRYPTO_DEFAULTS = {
  // Major coins
  'BTC': 4.0, 'ETH': 5.0, 'SOL': 6.5, 'ADA': 5.5,
  'DOGE': 8.0, 'XRP': 5.5, 'AVAX': 6.5, 'DOT': 5.5,
  'MATIC': 6.5, 'LINK': 5.5, 'UNI': 6.5, 'ATOM': 5.5,
  'LTC': 5.0, 'BCH': 5.0, 'NEAR': 6.5, 'APT': 6.5,
  // Layer 2 / Alt L1
  'ARB': 7.0, 'OP': 7.0, 'SHIB': 10.0, 'PEPE': 12.0,
  'BNB': 5.0, 'TRX': 5.5, 'TON': 6.5, 'XLM': 5.5,
  // DeFi / Infrastructure
  'ALGO': 6.5, 'FIL': 6.5, 'AAVE': 6.5, 'MKR': 5.5,
  'CRV': 7.0, 'SNX': 7.0, 'COMP': 6.5, 'VET': 6.5,
  // Gaming / Metaverse
  'SAND': 8.0, 'MANA': 8.0, 'AXS': 8.0, 'IMX': 7.0,
  'GALA': 10.0, 'ENJ': 7.0,
  // AI / Data
  'RNDR': 8.0, 'RENDER': 8.0, 'FET': 8.0, 'OCEAN': 8.0, 'TAO': 10.0,
  'ASI': 8.0,
  // Stablecoins (very low threshold - shouldn't move much)
  'USDT': 0.5, 'USDC': 0.5,
  // Draft defensive crypto
  'FTM': 7.0, 'EGLD': 7.0, 'RUNE': 8.0, 'KAVA': 7.0, 'CELO': 7.0,
  'DEFAULT': 5.0
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
    baseATR: threshold,
    recentATR: threshold,
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

const FETCH_TIMEOUT_MS = 30000; // 30 second timeout
const MAX_SYMBOLS_PER_REQUEST = 20; // Server limit

/**
 * Fetch a single batch of thresholds from API
 * Includes 30-second timeout to prevent UI from hanging indefinitely
 */
async function fetchBatch(symbols, type) {
  const symbolsParam = symbols.map(s => s.toUpperCase()).join(',');
  const url = `${API_BASE}?symbols=${encodeURIComponent(symbolsParam)}&type=${type}`;

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const data = await response.json();

    if (!data.success || !data.thresholds) {
      throw new Error('Invalid API response');
    }

    return data.thresholds;

  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      logWarn(`API fetch timed out after ${FETCH_TIMEOUT_MS}ms`);
    } else {
      logWarn(`API fetch failed:`, error.message);
    }
    return null;
  }
}

/**
 * Fetch thresholds from API for given symbols
 * Automatically batches requests to stay under server limit (20 symbols max)
 */
async function fetchFromAPI(symbols, type) {
  if (symbols.length === 0) {
    return {};
  }

  const upperSymbols = symbols.map(s => s.toUpperCase());

  // If under limit, make a single request
  if (upperSymbols.length <= MAX_SYMBOLS_PER_REQUEST) {
    logDebug(`Fetching thresholds for ${upperSymbols.length} ${type} symbols from API`);
    return await fetchBatch(upperSymbols, type);
  }

  // Batch symbols into chunks of MAX_SYMBOLS_PER_REQUEST
  const batches = [];
  for (let i = 0; i < upperSymbols.length; i += MAX_SYMBOLS_PER_REQUEST) {
    batches.push(upperSymbols.slice(i, i + MAX_SYMBOLS_PER_REQUEST));
  }

  logDebug(`Fetching thresholds for ${upperSymbols.length} ${type} symbols in ${batches.length} batches`);

  // Fetch all batches in parallel
  const batchResults = await Promise.all(
    batches.map(batch => fetchBatch(batch, type))
  );

  // Merge results from all batches
  const mergedResults = {};
  let successCount = 0;

  for (const result of batchResults) {
    if (result) {
      Object.assign(mergedResults, result);
      successCount++;
    }
  }

  // If all batches failed, return null to trigger fallback
  if (successCount === 0) {
    return null;
  }

  logDebug(`Received ${Object.keys(mergedResults).length} thresholds from ${successCount}/${batches.length} batches`);
  return mergedResults;
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
