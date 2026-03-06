/**
 * Historical Data Service for FantasyTrades
 *
 * Fetches and caches historical price data with AGGRESSIVE (24h) caching.
 * Provides:
 * - Historical OHLC data retrieval
 * - Price history for charts
 * - Performance calculations
 * - Batch fetching for multiple symbols
 */

import cacheService from './cacheService.js';

// ============================================
// CONFIGURATION
// ============================================

const HISTORICAL_PERIODS = {
  WEEK: 7,
  MONTH: 30,
  QUARTER: 90,
  YEAR: 365,
  TWO_YEARS: 730
};

// ============================================
// API FETCHING
// ============================================

/**
 * Fetch historical OHLC data from API
 * @param {string} symbol - Stock/crypto symbol
 * @param {string} type - 'stock' or 'crypto'
 * @param {number} days - Number of days of history
 * @returns {Promise<object[]>} Array of OHLC data
 */
export async function fetchHistoricalData(symbol, type = 'stock', days = HISTORICAL_PERIODS.QUARTER) {
  const cacheKey = `${symbol}_${type}_${days}`;

  // Check cache first
  const cached = cacheService.get('historical', cacheKey);
  if (cached) {
    console.log(`[HistoricalData] Cache hit for ${cacheKey}`);
    return cached;
  }

  console.log(`[HistoricalData] Fetching ${days} days of data for ${symbol} (${type})`);

  try {
    // For stocks, use the stock prices API
    // For crypto, use the crypto prices API
    const endpoint = type === 'crypto'
      ? `/api/crypto/prices?symbols=${symbol}`
      : `/api/stocks/fundamentals?symbol=${symbol}`;

    const response = await fetch(endpoint);

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch data');
    }

    // Extract historical prices from the response
    const result = extractHistoricalPrices(data, type, symbol);

    // Cache with AGGRESSIVE tier (24 hours)
    cacheService.set('historical', cacheKey, result);

    return result;
  } catch (error) {
    console.error(`[HistoricalData] Error fetching ${symbol}:`, error.message);
    return null;
  }
}

/**
 * Extract historical prices from API response
 */
function extractHistoricalPrices(data, type, symbol) {
  if (type === 'crypto') {
    // Crypto API returns price data differently
    const cryptoData = data.data?.[symbol] || data.data;
    return {
      symbol,
      type: 'crypto',
      prices: cryptoData?.historicalPrices || [],
      currentPrice: cryptoData?.price || cryptoData?.currentPrice || null,
      fetchedAt: new Date().toISOString()
    };
  } else {
    // Stock fundamentals API returns historicalPrices array
    const stockData = data.data || data;
    return {
      symbol,
      type: 'stock',
      prices: stockData.historicalPrices || [],
      currentPrice: stockData.currentPrice || null,
      ohlcData: stockData.ohlcData || null,
      fetchedAt: new Date().toISOString()
    };
  }
}

// ============================================
// PRICE HISTORY UTILITIES
// ============================================

/**
 * Get closing prices from historical data
 * @param {object} historicalData - Data from fetchHistoricalData
 * @returns {number[]} Array of closing prices (newest first)
 */
export function getClosingPrices(historicalData) {
  if (!historicalData?.prices) return [];

  // Handle both array of prices and array of OHLC objects
  if (typeof historicalData.prices[0] === 'number') {
    return historicalData.prices;
  } else {
    return historicalData.prices.map(d => d.close || d.price || 0);
  }
}

/**
 * Get OHLC data from historical data
 * @param {object} historicalData - Data from fetchHistoricalData
 * @returns {object[]} Array of {date, open, high, low, close, volume}
 */
export function getOHLCData(historicalData) {
  if (!historicalData?.prices) return [];

  // If already OHLC format
  if (historicalData.ohlcData) {
    return historicalData.ohlcData;
  }

  // If prices are OHLC objects
  if (typeof historicalData.prices[0] === 'object' && historicalData.prices[0]?.high) {
    return historicalData.prices;
  }

  // Can't convert simple price array to OHLC
  return [];
}

// ============================================
// PERFORMANCE CALCULATIONS
// ============================================

/**
 * Calculate performance over different time periods
 * @param {number[]} prices - Array of prices (newest first)
 * @returns {object} Performance by period
 */
export function calculatePerformance(prices) {
  if (!prices || prices.length === 0) return null;

  const currentPrice = prices[0];

  const performance = {
    day: calculatePeriodReturn(prices, 1),
    week: calculatePeriodReturn(prices, 7),
    month: calculatePeriodReturn(prices, 30),
    quarter: calculatePeriodReturn(prices, 90),
    year: calculatePeriodReturn(prices, 365),
    ytd: calculateYTDReturn(prices)
  };

  return performance;
}

/**
 * Calculate return for a specific period
 */
function calculatePeriodReturn(prices, days) {
  if (!prices || prices.length <= days) return null;

  const currentPrice = prices[0];
  const pastPrice = prices[Math.min(days, prices.length - 1)];

  if (pastPrice === 0) return null;

  const returnPct = ((currentPrice - pastPrice) / pastPrice) * 100;
  return Number(returnPct.toFixed(2));
}

/**
 * Calculate year-to-date return
 */
function calculateYTDReturn(prices) {
  if (!prices || prices.length < 2) return null;

  // Approximate: assume trading days in year
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const daysSinceStart = Math.floor((now - startOfYear) / (1000 * 60 * 60 * 24));
  const tradingDays = Math.floor(daysSinceStart * 0.7); // ~70% are trading days

  return calculatePeriodReturn(prices, tradingDays);
}

/**
 * Calculate price momentum
 * @param {number[]} prices - Array of prices (newest first)
 * @param {number} shortPeriod - Short momentum period (default 7)
 * @param {number} longPeriod - Long momentum period (default 30)
 */
export function calculateMomentum(prices, shortPeriod = 7, longPeriod = 30) {
  if (!prices || prices.length < longPeriod + 1) return null;

  const shortReturn = calculatePeriodReturn(prices, shortPeriod);
  const longReturn = calculatePeriodReturn(prices, longPeriod);

  if (shortReturn === null || longReturn === null) return null;

  return {
    shortTerm: shortReturn,
    longTerm: longReturn,
    acceleration: Number((shortReturn - (longReturn / (longPeriod / shortPeriod))).toFixed(2))
  };
}

/**
 * Calculate maximum drawdown
 * @param {number[]} prices - Array of prices (newest first)
 * @returns {object} { maxDrawdown, drawdownStart, drawdownEnd }
 */
export function calculateMaxDrawdown(prices) {
  if (!prices || prices.length < 2) return null;

  // Reverse to process oldest first
  const reversed = [...prices].reverse();

  let peak = reversed[0];
  let maxDrawdown = 0;
  let drawdownStart = 0;
  let drawdownEnd = 0;
  let currentStart = 0;

  for (let i = 1; i < reversed.length; i++) {
    if (reversed[i] > peak) {
      peak = reversed[i];
      currentStart = i;
    }

    const drawdown = ((peak - reversed[i]) / peak) * 100;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
      drawdownStart = currentStart;
      drawdownEnd = i;
    }
  }

  return {
    maxDrawdown: Number(maxDrawdown.toFixed(2)),
    daysFromPeakToTrough: drawdownEnd - drawdownStart
  };
}

/**
 * Count up and down days
 */
export function countTrendDays(prices, days = 30) {
  if (!prices || prices.length < days + 1) return null;

  let upDays = 0;
  let downDays = 0;
  let unchanged = 0;

  for (let i = 0; i < days; i++) {
    if (prices[i] > prices[i + 1]) {
      upDays++;
    } else if (prices[i] < prices[i + 1]) {
      downDays++;
    } else {
      unchanged++;
    }
  }

  return {
    upDays,
    downDays,
    unchanged,
    upRatio: Number((upDays / days * 100).toFixed(1))
  };
}

// ============================================
// 52-WEEK HIGH/LOW
// ============================================

/**
 * Calculate 52-week high/low data
 * @param {number[]} prices - Array of prices (newest first, at least 252 days)
 */
export function calculate52WeekRange(prices) {
  if (!prices || prices.length < 50) return null;

  const tradingDays = Math.min(252, prices.length);
  const yearPrices = prices.slice(0, tradingDays);

  const week52High = Math.max(...yearPrices);
  const week52Low = Math.min(...yearPrices.filter(p => p > 0));
  const currentPrice = prices[0];

  const range = week52High - week52Low;
  const position = range > 0 ? ((currentPrice - week52Low) / range) * 100 : 50;

  return {
    week52High: Number(week52High.toFixed(2)),
    week52Low: Number(week52Low.toFixed(2)),
    currentPrice: Number(currentPrice.toFixed(2)),
    positionInRange: Number(position.toFixed(1)),
    distanceFromHigh: Number(((week52High - currentPrice) / week52High * 100).toFixed(1)),
    distanceFromLow: Number(((currentPrice - week52Low) / week52Low * 100).toFixed(1)),
    isAtHigh: currentPrice >= week52High * 0.99,
    isAtLow: currentPrice <= week52Low * 1.01
  };
}

// ============================================
// BATCH OPERATIONS
// ============================================

/**
 * Fetch historical data for multiple symbols
 * @param {string[]} symbols - Array of symbols
 * @param {string} type - 'stock' or 'crypto'
 * @param {number} days - Number of days
 */
export async function fetchHistoricalBatch(symbols, type = 'stock', days = HISTORICAL_PERIODS.QUARTER) {
  const results = {};

  // Process in parallel, but limit concurrency
  const batchSize = 5;

  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);
    const promises = batch.map(symbol => fetchHistoricalData(symbol, type, days));
    const batchResults = await Promise.all(promises);

    batch.forEach((symbol, idx) => {
      results[symbol] = batchResults[idx];
    });
  }

  return results;
}

/**
 * Get comprehensive analysis for a symbol
 */
export async function getComprehensiveAnalysis(symbol, type = 'stock') {
  const cacheKey = `analysis_${symbol}_${type}`;

  // Check cache
  const cached = cacheService.get('historical', cacheKey);
  if (cached) {
    console.log(`[HistoricalData] Cache hit for analysis ${cacheKey}`);
    return cached;
  }

  // Fetch historical data
  const historicalData = await fetchHistoricalData(symbol, type, HISTORICAL_PERIODS.YEAR);

  if (!historicalData) {
    return null;
  }

  const prices = getClosingPrices(historicalData);

  const analysis = {
    symbol,
    type,
    currentPrice: historicalData.currentPrice,
    performance: calculatePerformance(prices),
    momentum: calculateMomentum(prices),
    maxDrawdown: calculateMaxDrawdown(prices),
    trendDays: countTrendDays(prices),
    week52Range: calculate52WeekRange(prices),
    priceHistory: prices.slice(0, 30), // Last 30 days for charts
    analyzedAt: new Date().toISOString()
  };

  // Cache with AGGRESSIVE tier
  cacheService.set('historical', cacheKey, analysis);

  return analysis;
}

// ============================================
// CACHE MANAGEMENT
// ============================================

/**
 * Clear historical data cache
 */
export function clearHistoricalCache() {
  cacheService.clearType('historical');
  console.log('[HistoricalData] Cache cleared');
}

/**
 * Prefetch historical data for common symbols
 */
export async function prefetchCommonSymbols(stockSymbols = [], cryptoSymbols = []) {
  console.log(`[HistoricalData] Prefetching ${stockSymbols.length} stocks, ${cryptoSymbols.length} crypto`);

  const [stockResults, cryptoResults] = await Promise.all([
    fetchHistoricalBatch(stockSymbols, 'stock'),
    fetchHistoricalBatch(cryptoSymbols, 'crypto')
  ]);

  return {
    stocks: stockResults,
    crypto: cryptoResults
  };
}

export default {
  fetchHistoricalData,
  getClosingPrices,
  getOHLCData,
  calculatePerformance,
  calculateMomentum,
  calculateMaxDrawdown,
  countTrendDays,
  calculate52WeekRange,
  fetchHistoricalBatch,
  getComprehensiveAnalysis,
  clearHistoricalCache,
  prefetchCommonSymbols,
  HISTORICAL_PERIODS
};
