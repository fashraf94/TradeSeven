/**
 * Technical Indicator Service
 * Fetches RSI, MACD, SMA, EMA, ATR via Vercel proxy (CORS-safe)
 */

// Cache for technical data
const technicalCache = new Map();
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

/**
 * Get cache key
 */
const getCacheKey = (symbol, fn, period) => `${symbol}-${fn}-${period}`;

/**
 * Check if cached data is still valid
 */
const getCachedData = (symbol, fn, period) => {
  const key = getCacheKey(symbol, fn, period);
  const cached = technicalCache.get(key);

  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log(`[Technical] Cache hit: ${key}`);
    return cached.data;
  }

  return null;
};

/**
 * Store data in cache
 */
const setCachedData = (symbol, fn, period, data) => {
  const key = getCacheKey(symbol, fn, period);
  technicalCache.set(key, {
    data,
    timestamp: Date.now()
  });
};

/**
 * Fetch technical indicator via proxy
 */
const fetchTechnicalIndicator = async (symbol, fn, period = 14) => {
  // Check cache first
  const cached = getCachedData(symbol, fn, period);
  if (cached) return cached;

  try {
    const url = `/api/stocks/prices?symbols=${symbol}&type=technical&function=${fn}&period=${period}`;
    console.log(`[Technical] Fetching ${fn} for ${symbol}`);

    const response = await fetch(url);

    if (!response.ok) {
      console.error(`[Technical] Failed to fetch ${fn} for ${symbol}: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (!data.success) {
      console.error(`[Technical] API error for ${fn}/${symbol}:`, data.error);
      return null;
    }

    // Cache the result
    setCachedData(symbol, fn, period, data);

    return data;

  } catch (error) {
    console.error(`[Technical] Error fetching ${fn} for ${symbol}:`, error);
    return null;
  }
};

/**
 * Get RSI for a symbol
 * @param {string} symbol - Stock symbol
 * @param {number} period - RSI period (default 14)
 * @returns {Promise<number|null>} RSI value (0-100) or null
 */
export const getRSI = async (symbol, period = 14) => {
  const data = await fetchTechnicalIndicator(symbol, 'rsi', period);
  return data?.latestValue ?? null;
};

// Legacy alias
export const fetchRSI = getRSI;

/**
 * Get MACD for a symbol
 * @param {string} symbol - Stock symbol
 * @returns {Promise<{macd: number, signal: number, histogram: number}|null>}
 */
export const getMACD = async (symbol) => {
  const data = await fetchTechnicalIndicator(symbol, 'macd', 12);

  if (!data?.latestValue) return null;

  return {
    macd: data.latestValue.macd,
    signal: data.latestValue.signal,
    histogram: data.latestValue.histogram
  };
};

// Legacy alias
export const fetchMACD = getMACD;

/**
 * Get SMA for a symbol
 * @param {string} symbol - Stock symbol
 * @param {number} period - SMA period (e.g., 50, 200)
 * @returns {Promise<number|null>}
 */
export const getSMA = async (symbol, period = 50) => {
  const data = await fetchTechnicalIndicator(symbol, 'sma', period);
  return data?.latestValue ?? null;
};

// Legacy alias
export const fetchSMA = getSMA;

/**
 * Get EMA for a symbol
 * @param {string} symbol - Stock symbol
 * @param {number} period - EMA period
 * @returns {Promise<number|null>}
 */
export const getEMA = async (symbol, period = 20) => {
  const data = await fetchTechnicalIndicator(symbol, 'ema', period);
  return data?.latestValue ?? null;
};

// Legacy alias
export const fetchEMA = getEMA;

/**
 * Get ATR for a symbol
 * @param {string} symbol - Stock symbol
 * @param {number} period - ATR period (default 14)
 * @returns {Promise<number|null>}
 */
export const getATR = async (symbol, period = 14) => {
  const data = await fetchTechnicalIndicator(symbol, 'atr', period);
  return data?.latestValue ?? null;
};

// Legacy alias
export const fetchATR = getATR;

/**
 * Get all technical indicators for a symbol
 * @param {string} symbol - Stock symbol
 * @returns {Promise<Object>} All indicators
 */
export const getAllIndicators = async (symbol) => {
  console.log(`[Technical] Fetching all indicators for ${symbol}`);

  try {
    // Fetch all in parallel
    const [rsi, macd, sma50, sma200, ema20, atr] = await Promise.all([
      getRSI(symbol, 14),
      getMACD(symbol),
      getSMA(symbol, 50),
      getSMA(symbol, 200),
      getEMA(symbol, 20),
      getATR(symbol, 14)
    ]);

    return {
      symbol,
      rsi,
      macd,
      sma50,
      sma200,
      ema20,
      atr,
      fetchedAt: Date.now()
    };

  } catch (error) {
    console.error(`[Technical] Error fetching all indicators for ${symbol}:`, error);
    return {
      symbol,
      rsi: null,
      macd: null,
      sma50: null,
      sma200: null,
      ema20: null,
      atr: null,
      error: true,
      message: error.message,
      fetchedAt: Date.now()
    };
  }
};

// Legacy alias
export const fetchAllIndicators = getAllIndicators;

/**
 * Batch fetch indicators for multiple symbols
 * Limits concurrent requests to avoid overwhelming API
 * @param {string[]} symbols - Array of symbols
 * @param {string[]} indicators - Which indicators to fetch (default: ['rsi'])
 * @returns {Promise<Object>} Map of symbol -> indicators
 */
export const batchFetchIndicators = async (symbols, indicators = ['rsi']) => {
  console.log(`[Technical] Batch fetching ${indicators.join(', ')} for ${symbols.length} symbols`);

  const results = {};

  // Process in batches of 5 to avoid rate limits
  const BATCH_SIZE = 5;

  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    const batch = symbols.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (symbol) => {
        results[symbol] = {};

        for (const indicator of indicators) {
          switch (indicator) {
            case 'rsi':
              results[symbol].rsi = await getRSI(symbol);
              break;
            case 'macd':
              results[symbol].macd = await getMACD(symbol);
              break;
            case 'sma50':
              results[symbol].sma50 = await getSMA(symbol, 50);
              break;
            case 'sma200':
              results[symbol].sma200 = await getSMA(symbol, 200);
              break;
            case 'ema':
            case 'ema20':
              results[symbol].ema20 = await getEMA(symbol, 20);
              break;
            case 'atr':
              results[symbol].atr = await getATR(symbol);
              break;
          }
        }
      })
    );

    // Small delay between batches
    if (i + BATCH_SIZE < symbols.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return results;
};

/**
 * Clear technical indicator cache
 */
export const clearCache = (symbol = null) => {
  if (symbol) {
    // Clear all entries for this symbol
    for (const key of technicalCache.keys()) {
      if (key.startsWith(`${symbol}-`)) {
        technicalCache.delete(key);
      }
    }
    console.log(`[Technical] Cache cleared for ${symbol}`);
  } else {
    technicalCache.clear();
    console.log('[Technical] Cache cleared');
  }
};

export default {
  // New names
  getRSI,
  getMACD,
  getSMA,
  getEMA,
  getATR,
  getAllIndicators,
  batchFetchIndicators,
  clearCache,
  // Legacy aliases
  fetchRSI,
  fetchMACD,
  fetchSMA,
  fetchEMA,
  fetchATR,
  fetchAllIndicators
};
