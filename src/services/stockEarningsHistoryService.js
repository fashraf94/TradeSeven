/**
 * Stock Earnings History Service
 *
 * Fetches and caches stock-specific historical earnings reactions.
 * Used by earningsReactionsService to provide stock-specific probabilities
 * instead of generic sector defaults.
 *
 * Data flow:
 * 1. Check memory cache (fastest)
 * 2. Check cacheService (localStorage, 24h TTL)
 * 3. Fetch from /api/stocks/earnings-history
 * 4. Store in both caches
 */

import cacheService from './cacheService';

const API_BASE = '/api';

// In-memory cache for this session (supplements cacheService)
const historyCache = new Map();
const MEMORY_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// Minimum quarters required to use stock-specific data
const MIN_QUARTERS_REQUIRED = 4;

/**
 * Fetch historical earnings reactions for a stock
 * Returns aggregate stats + individual reactions
 *
 * @param {string} symbol - Stock symbol (e.g., 'AAPL')
 * @returns {Promise<Object|null>} - History data or null if unavailable
 */
export async function getStockEarningsHistory(symbol) {
  if (!symbol) {
    console.warn('[stockEarningsHistory] No symbol provided');
    return null;
  }

  const upperSymbol = symbol.toUpperCase();
  const cacheKey = `earnings_history_${upperSymbol}`;

  // Check memory cache first (fastest)
  const memoryCached = historyCache.get(cacheKey);
  if (memoryCached && Date.now() - memoryCached.timestamp < MEMORY_CACHE_TTL) {
    console.log(`[stockEarningsHistory] Memory cache hit for ${upperSymbol}`);
    return memoryCached.data;
  }

  // Check persistent cache (cacheService uses 'earnings' type = 24h TTL)
  const cached = cacheService.get('earnings', cacheKey);
  if (cached !== null) {
    console.log(`[stockEarningsHistory] Storage cache hit for ${upperSymbol}`);
    // Also store in memory cache for faster subsequent access
    historyCache.set(cacheKey, { data: cached, timestamp: Date.now() });
    return cached;
  }

  console.log(`[stockEarningsHistory] Fetching history for ${upperSymbol}...`);

  try {
    const response = await fetch(`${API_BASE}/stocks/earnings-history?symbol=${upperSymbol}`);

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Unknown error');
    }

    const data = result.data;

    // Cache the result (24h via cacheService, 30min in memory)
    cacheService.set('earnings', cacheKey, data);
    historyCache.set(cacheKey, { data, timestamp: Date.now() });

    console.log(`[stockEarningsHistory] Got ${data.quartersAnalyzed || 0} quarters for ${upperSymbol}`);

    return data;

  } catch (error) {
    console.error(`[stockEarningsHistory] Error fetching ${upperSymbol}:`, error.message);
    return null;
  }
}

/**
 * Get reaction probabilities for a stock
 * Falls back to null if no history available (caller should use sector defaults)
 *
 * Only uses stock-specific data if we have >= MIN_QUARTERS_REQUIRED quarters
 *
 * @param {string} symbol - Stock symbol
 * @returns {Promise<Object|null>} - { afterBeat: {...}, afterMiss: {...} } or null
 */
export async function getStockReactionProbabilities(symbol) {
  const history = await getStockEarningsHistory(symbol);

  if (!history || !history.hasHistory || !history.probabilities) {
    return null;
  }

  // Only use stock-specific data if we have enough history
  if (history.quartersAnalyzed < MIN_QUARTERS_REQUIRED) {
    console.log(`[stockEarningsHistory] ${symbol}: Only ${history.quartersAnalyzed} quarters, using sector defaults`);
    return null;
  }

  // Fill in missing magnitude bands with 0 probability
  // This handles edge cases where a stock has never had certain magnitude moves
  const { afterBeat = {}, afterMiss = {} } = history.probabilities;
  const requiredBands = ['upBig', 'up', 'flat', 'down', 'downBig'];

  // Create complete probability objects, filling in missing bands with 0
  const normalizedAfterBeat = {};
  const normalizedAfterMiss = {};

  requiredBands.forEach(band => {
    normalizedAfterBeat[band] = afterBeat[band] !== undefined ? afterBeat[band] : 0;
    normalizedAfterMiss[band] = afterMiss[band] !== undefined ? afterMiss[band] : 0;
  });

  // Verify we have at least SOME data (not all zeros in both)
  const beatTotal = Object.values(normalizedAfterBeat).reduce((sum, val) => sum + val, 0);
  const missTotal = Object.values(normalizedAfterMiss).reduce((sum, val) => sum + val, 0);

  if (beatTotal === 0 && missTotal === 0) {
    console.log(`[stockEarningsHistory] ${symbol}: No probability data available, using sector defaults`);
    return null;
  }

  console.log(`[stockEarningsHistory] ${symbol}: Using stock-specific probabilities (${history.quartersAnalyzed} quarters)`);

  return {
    afterBeat: normalizedAfterBeat,
    afterMiss: normalizedAfterMiss
  };
}

/**
 * Get display stats for UI (StockStatsBar component)
 *
 * @param {string} symbol - Stock symbol
 * @returns {Promise<Object|null>} - Stats object or null
 */
export async function getStockEarningsStats(symbol) {
  const history = await getStockEarningsHistory(symbol);

  if (!history || !history.hasHistory) {
    return null;
  }

  return {
    symbol: history.symbol,
    quartersAnalyzed: history.quartersAnalyzed,
    avgMoveOnBeat: history.stats.avgMoveOnBeat,
    avgMoveOnMiss: history.stats.avgMoveOnMiss,
    beatRate: history.stats.beatRate,
    volatility: history.stats.volatility,
    totalBeats: history.stats.totalBeats,
    totalMisses: history.stats.totalMisses,
    recentReactions: history.reactions || []
  };
}

/**
 * Prefetch earnings history for multiple symbols
 * Useful when loading earnings calendar to warm the cache
 *
 * @param {string[]} symbols - Array of stock symbols
 */
export async function prefetchEarningsHistory(symbols) {
  if (!symbols || symbols.length === 0) return;

  // Limit concurrent requests to avoid rate limiting
  const batchSize = 3;
  const uniqueSymbols = [...new Set(symbols.map(s => s.toUpperCase()))];

  console.log(`[stockEarningsHistory] Prefetching ${uniqueSymbols.length} symbols...`);

  for (let i = 0; i < uniqueSymbols.length; i += batchSize) {
    const batch = uniqueSymbols.slice(i, i + batchSize);
    await Promise.all(batch.map(symbol => getStockEarningsHistory(symbol)));

    // Small delay between batches to avoid rate limiting
    if (i + batchSize < uniqueSymbols.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log(`[stockEarningsHistory] Prefetch complete`);
}

/**
 * Clear cached history for a symbol (useful for testing)
 *
 * @param {string} [symbol] - Symbol to clear, or all if not provided
 */
export function clearHistoryCache(symbol) {
  if (symbol) {
    const cacheKey = `earnings_history_${symbol.toUpperCase()}`;
    historyCache.delete(cacheKey);
    cacheService.delete('earnings', cacheKey);
    console.log(`[stockEarningsHistory] Cleared cache for ${symbol}`);
  } else {
    historyCache.clear();
    console.log(`[stockEarningsHistory] Cleared all memory cache`);
  }
}

/**
 * Check if a symbol has cached history data
 *
 * @param {string} symbol - Stock symbol
 * @returns {boolean} - True if cached
 */
export function hasCachedHistory(symbol) {
  if (!symbol) return false;
  const cacheKey = `earnings_history_${symbol.toUpperCase()}`;

  // Check memory cache
  const memoryCached = historyCache.get(cacheKey);
  if (memoryCached && Date.now() - memoryCached.timestamp < MEMORY_CACHE_TTL) {
    return true;
  }

  // Check storage cache
  return cacheService.has('earnings', cacheKey);
}

export default {
  getStockEarningsHistory,
  getStockReactionProbabilities,
  getStockEarningsStats,
  prefetchEarningsHistory,
  clearHistoryCache,
  hasCachedHistory
};
