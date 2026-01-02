/**
 * Technical Indicators Service
 * Fetches RSI, MACD, SMA from EODHD API on-demand
 * Each technical API request costs 5 API calls
 */

const EODHD_API_KEY = import.meta.env.VITE_EODHD_API_KEY;
const EODHD_BASE_URL = 'https://eodhd.com/api';

// Cache for technical data (per symbol, expires after 30 minutes)
const technicalCache = new Map();
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

/**
 * Get cached data or null if expired/missing
 */
const getCachedData = (symbol, indicator) => {
  const key = `${symbol}_${indicator}`;
  const cached = technicalCache.get(key);

  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  return null;
};

/**
 * Set cache data
 */
const setCacheData = (symbol, indicator, data) => {
  const key = `${symbol}_${indicator}`;
  technicalCache.set(key, {
    data,
    timestamp: Date.now()
  });
};

/**
 * Fetch RSI (Relative Strength Index) for a symbol
 * @param {string} symbol - Stock symbol (e.g., 'AAPL')
 * @param {number} period - RSI period (default 14)
 * @returns {Promise<number|null>} - Current RSI value or null
 */
export const fetchRSI = async (symbol, period = 14) => {
  // Check cache first
  const cached = getCachedData(symbol, `rsi_${period}`);
  if (cached !== null) return cached;

  try {
    const response = await fetch(
      `${EODHD_BASE_URL}/technical/${symbol}.US?api_token=${EODHD_API_KEY}&function=rsi&period=${period}&fmt=json`
    );

    if (!response.ok) {
      console.error(`RSI fetch failed for ${symbol}: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      return null;
    }

    // Get most recent RSI value
    const latestRSI = data[data.length - 1]?.rsi;

    if (latestRSI !== undefined) {
      setCacheData(symbol, `rsi_${period}`, latestRSI);
    }

    return latestRSI || null;
  } catch (error) {
    console.error(`Error fetching RSI for ${symbol}:`, error);
    return null;
  }
};

/**
 * Fetch MACD (Moving Average Convergence Divergence) for a symbol
 * @param {string} symbol - Stock symbol
 * @returns {Promise<{macd: number, signal: number, histogram: number}|null>}
 */
export const fetchMACD = async (symbol) => {
  const cached = getCachedData(symbol, 'macd');
  if (cached !== null) return cached;

  try {
    const response = await fetch(
      `${EODHD_BASE_URL}/technical/${symbol}.US?api_token=${EODHD_API_KEY}&function=macd&fmt=json`
    );

    if (!response.ok) {
      console.error(`MACD fetch failed for ${symbol}: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      return null;
    }

    // Get most recent MACD values
    const latest = data[data.length - 1];
    const result = {
      macd: latest?.macd || 0,
      signal: latest?.macd_signal || 0,
      histogram: latest?.macd_histogram || 0
    };

    setCacheData(symbol, 'macd', result);
    return result;
  } catch (error) {
    console.error(`Error fetching MACD for ${symbol}:`, error);
    return null;
  }
};

/**
 * Fetch SMA (Simple Moving Average) for a symbol
 * @param {string} symbol - Stock symbol
 * @param {number} period - SMA period (e.g., 50, 200)
 * @returns {Promise<number|null>}
 */
export const fetchSMA = async (symbol, period = 50) => {
  const cached = getCachedData(symbol, `sma_${period}`);
  if (cached !== null) return cached;

  try {
    const response = await fetch(
      `${EODHD_BASE_URL}/technical/${symbol}.US?api_token=${EODHD_API_KEY}&function=sma&period=${period}&fmt=json`
    );

    if (!response.ok) {
      console.error(`SMA fetch failed for ${symbol}: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      return null;
    }

    const latestSMA = data[data.length - 1]?.sma;

    if (latestSMA !== undefined) {
      setCacheData(symbol, `sma_${period}`, latestSMA);
    }

    return latestSMA || null;
  } catch (error) {
    console.error(`Error fetching SMA for ${symbol}:`, error);
    return null;
  }
};

/**
 * Fetch EMA (Exponential Moving Average) for a symbol
 * @param {string} symbol - Stock symbol
 * @param {number} period - EMA period
 * @returns {Promise<number|null>}
 */
export const fetchEMA = async (symbol, period = 20) => {
  const cached = getCachedData(symbol, `ema_${period}`);
  if (cached !== null) return cached;

  try {
    const response = await fetch(
      `${EODHD_BASE_URL}/technical/${symbol}.US?api_token=${EODHD_API_KEY}&function=ema&period=${period}&fmt=json`
    );

    if (!response.ok) return null;

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) return null;

    const latestEMA = data[data.length - 1]?.ema;

    if (latestEMA !== undefined) {
      setCacheData(symbol, `ema_${period}`, latestEMA);
    }

    return latestEMA || null;
  } catch (error) {
    console.error(`Error fetching EMA for ${symbol}:`, error);
    return null;
  }
};

/**
 * Fetch ATR (Average True Range) for volatility
 * @param {string} symbol - Stock symbol
 * @param {number} period - ATR period
 * @returns {Promise<number|null>}
 */
export const fetchATR = async (symbol, period = 14) => {
  const cached = getCachedData(symbol, `atr_${period}`);
  if (cached !== null) return cached;

  try {
    const response = await fetch(
      `${EODHD_BASE_URL}/technical/${symbol}.US?api_token=${EODHD_API_KEY}&function=atr&period=${period}&fmt=json`
    );

    if (!response.ok) return null;

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) return null;

    const latestATR = data[data.length - 1]?.atr;

    if (latestATR !== undefined) {
      setCacheData(symbol, `atr_${period}`, latestATR);
    }

    return latestATR || null;
  } catch (error) {
    console.error(`Error fetching ATR for ${symbol}:`, error);
    return null;
  }
};

/**
 * Fetch all technical indicators for a symbol (batched)
 * Use this when user clicks on a stock for details
 * @param {string} symbol - Stock symbol
 * @returns {Promise<Object>} - All indicators
 */
export const fetchAllIndicators = async (symbol) => {
  try {
    const [rsi, macd, sma50, sma200, ema20, atr] = await Promise.all([
      fetchRSI(symbol, 14),
      fetchMACD(symbol),
      fetchSMA(symbol, 50),
      fetchSMA(symbol, 200),
      fetchEMA(symbol, 20),
      fetchATR(symbol, 14)
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
    console.error(`Error fetching all indicators for ${symbol}:`, error);
    return {
      symbol,
      rsi: null,
      macd: null,
      sma50: null,
      sma200: null,
      ema20: null,
      atr: null,
      fetchedAt: Date.now(),
      error: error.message
    };
  }
};

/**
 * Clear cache for a symbol or all symbols
 */
export const clearCache = (symbol = null) => {
  if (symbol) {
    // Clear all entries for this symbol
    for (const key of technicalCache.keys()) {
      if (key.startsWith(`${symbol}_`)) {
        technicalCache.delete(key);
      }
    }
  } else {
    technicalCache.clear();
  }
};

export default {
  fetchRSI,
  fetchMACD,
  fetchSMA,
  fetchEMA,
  fetchATR,
  fetchAllIndicators,
  clearCache
};
