// src/services/oddsService.js
// Frontend service for fetching calculated odds from Market-Informed Odds Engine
//
// Features:
// - In-memory caching (10 minute TTL)
// - IV data caching (24 hour TTL) for API resilience
// - Batch fetching for multiple symbols
// - Graceful fallback on errors

const CACHE = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// IV Data Cache - prevents good stocks from being excluded due to temporary API failures
const ivDataCache = new Map();
const IV_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Get cached IV data for a symbol
 * @param {string} symbol - Stock ticker
 * @returns {Object|null} Cached IV data or null
 */
function getCachedIVData(symbol) {
  const cached = ivDataCache.get(symbol.toUpperCase());
  if (cached && Date.now() - cached.timestamp < IV_CACHE_DURATION) {
    console.log(`[IV Cache] Hit for ${symbol}`);
    return cached.data;
  }
  return null;
}

/**
 * Store IV data in cache
 * @param {string} symbol - Stock ticker
 * @param {Object} data - IV data to cache
 */
function setCachedIVData(symbol, data) {
  ivDataCache.set(symbol.toUpperCase(), {
    data,
    timestamp: Date.now()
  });
  console.log(`[IV Cache] Stored for ${symbol}`);
}

/**
 * Get expired cached IV data (for fallback during API failures)
 * @param {string} symbol - Stock ticker
 * @returns {Object|null} Expired cached IV data or null
 */
function getExpiredIVCache(symbol) {
  const cached = ivDataCache.get(symbol.toUpperCase());
  if (cached) {
    console.log(`[IV Cache] Using expired cache for ${symbol}`);
    return cached.data;
  }
  return null;
}

// Default sector beat rates (fallback if API fails)
const DEFAULT_SECTOR_RATES = {
  technology: 0.78,
  financial: 0.74,
  healthcare: 0.76,
  consumer_cyclical: 0.71,
  consumer_defensive: 0.73,
  industrial: 0.70,
  energy: 0.65,
  default: 0.70
};

/**
 * Get calculated odds for a single stock
 * @param {string} symbol - Stock ticker
 * @param {string} sector - Optional sector for better defaults
 * @returns {Promise<Object>} Odds data with probability, confidence, breakdown
 */
export async function getStockOdds(symbol, sector = null) {
  const cacheKey = `${symbol.toUpperCase()}-${sector || 'default'}`;

  // Check cache
  const cached = CACHE.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`[OddsService] Cache hit for ${symbol}`);
    return cached.data;
  }

  try {
    const params = new URLSearchParams({ symbol: symbol.toUpperCase() });
    if (sector) params.append('sector', sector);

    console.log(`[OddsService] Fetching odds for ${symbol}...`);
    const response = await fetch(`/api/earnings/odds?${params}`);

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const data = await response.json();

    // Cache the result
    CACHE.set(cacheKey, { data, timestamp: Date.now() });

    // Cache IV data separately for longer retention (API resilience)
    const ivData = data.breakdown?.optionsIV || data.rawData;
    if (ivData && (ivData.expectedMove !== null || ivData.expectedMovePercent !== null)) {
      setCachedIVData(symbol, {
        expectedMove: ivData.expectedMove ?? ivData.expectedMovePercent,
        signal: ivData.signal || 'available',
        factor: ivData.factor,
        hasIVData: true
      });
    }

    console.log(`[OddsService] ${symbol}: ${data.probabilityPercent}% beat (${data.confidence})`);
    return data;

  } catch (error) {
    console.error(`[OddsService] Error for ${symbol}:`, error);

    // Return fallback odds
    const sectorKey = (sector || 'default').toLowerCase().replace(/\s+/g, '_');
    const fallbackRate = DEFAULT_SECTOR_RATES[sectorKey] || 0.70;

    return {
      symbol: symbol.toUpperCase(),
      probability: fallbackRate,
      probabilityPercent: Math.round(fallbackRate * 100),
      missOdds: 1 - fallbackRate,
      confidence: 'none',
      fallback: true,
      error: error.message
    };
  }
}

/**
 * Get odds for multiple stocks (fetches in parallel)
 * @param {Array<{symbol: string, sector?: string}>} stocks - Array of stocks
 * @returns {Promise<Map<string, Object>>} Map of symbol -> odds data
 */
export async function getBatchOdds(stocks) {
  console.log(`[OddsService] Batch fetching odds for ${stocks.length} stocks...`);

  const results = await Promise.all(
    stocks.map(({ symbol, sector }) => getStockOdds(symbol, sector))
  );

  // Convert to Map for easy lookup
  const oddsMap = new Map();
  stocks.forEach((stock, i) => {
    oddsMap.set(stock.symbol.toUpperCase(), results[i]);
  });

  return oddsMap;
}

/**
 * Get odds for a stock, using local calculation if API unavailable
 * This uses the oddsEngine directly for offline/fast calculation
 * @param {Object} params - Stock data including earnings history
 * @returns {Object} Calculated odds
 */
export function calculateLocalOdds({
  beatRate,
  totalQuarters,
  priceChange30d,
  sector
}) {
  // Base rate
  let baseRate = 0.70;
  let confidence = 'low';

  // Minimum 4 quarters (1 full year) required for stock-specific confidence
  if (beatRate !== null && totalQuarters >= 4) {
    baseRate = beatRate;
    confidence = totalQuarters >= 10 ? 'high' : totalQuarters >= 6 ? 'medium' : 'low';
  } else {
    // Use sector average (insufficient historical data)
    const sectorKey = (sector || 'default').toLowerCase().replace(/\s+/g, '_');
    baseRate = DEFAULT_SECTOR_RATES[sectorKey] || 0.70;
  }

  // Price momentum
  let priceFactor = 1.0;
  if (priceChange30d !== null) {
    if (priceChange30d >= 15) priceFactor = 1.12;
    else if (priceChange30d >= 8) priceFactor = 1.07;
    else if (priceChange30d >= 3) priceFactor = 1.03;
    else if (priceChange30d <= -15) priceFactor = 0.88;
    else if (priceChange30d <= -8) priceFactor = 0.93;
    else if (priceChange30d <= -3) priceFactor = 0.97;
  }

  // Calculate
  let probability = baseRate * priceFactor;

  // Blend with sector (15%)
  const sectorRate = DEFAULT_SECTOR_RATES[(sector || 'default').toLowerCase()] || 0.70;
  probability = (probability * 0.85) + (sectorRate * 0.15);

  // Clamp
  probability = Math.min(0.95, Math.max(0.15, probability));

  return {
    probability,
    probabilityPercent: Math.round(probability * 100),
    missOdds: 1 - probability,
    confidence,
    local: true
  };
}

/**
 * Check if a stock has IV data available
 * Uses odds breakdown first, then falls back to IV cache
 * @param {Object} oddsData - Odds data from getStockOdds
 * @param {string} symbol - Stock ticker (for cache fallback)
 * @returns {boolean} True if IV data is available
 */
export function hasIVData(oddsData, symbol) {
  // Check fresh data first
  const ivFromOdds = oddsData?.breakdown?.optionsIV;
  if (ivFromOdds && ivFromOdds.signal !== 'no_data') {
    return true;
  }

  // Check rawData
  if (oddsData?.rawData?.expectedMovePercent !== null && oddsData?.rawData?.expectedMovePercent !== undefined) {
    return true;
  }

  // Fall back to IV cache (handles temporary API failures)
  const cachedIV = getCachedIVData(symbol) || getExpiredIVCache(symbol);
  if (cachedIV && cachedIV.hasIVData) {
    return true;
  }

  return false;
}

/**
 * Get IV data for a stock (from odds or cache)
 * @param {Object} oddsData - Odds data from getStockOdds
 * @param {string} symbol - Stock ticker
 * @returns {Object|null} IV data or null
 */
export function getIVData(oddsData, symbol) {
  // Try fresh data first
  const ivFromOdds = oddsData?.breakdown?.optionsIV;
  if (ivFromOdds && ivFromOdds.signal !== 'no_data') {
    return ivFromOdds;
  }

  // Try rawData
  if (oddsData?.rawData?.expectedMovePercent !== null) {
    return {
      expectedMove: oddsData.rawData.expectedMovePercent,
      signal: 'available',
      hasIVData: true
    };
  }

  // Fall back to cache
  return getCachedIVData(symbol) || getExpiredIVCache(symbol);
}

/**
 * Clear the odds cache
 */
export function clearOddsCache() {
  CACHE.clear();
  console.log('[OddsService] Cache cleared');
}

/**
 * Clear the IV cache
 */
export function clearIVCache() {
  ivDataCache.clear();
  console.log('[OddsService] IV Cache cleared');
}

/**
 * Get cache stats for debugging
 */
export function getCacheStats() {
  return {
    oddsCache: {
      size: CACHE.size,
      keys: Array.from(CACHE.keys()),
      ttlMs: CACHE_TTL
    },
    ivCache: {
      size: ivDataCache.size,
      keys: Array.from(ivDataCache.keys()),
      ttlMs: IV_CACHE_DURATION
    }
  };
}

export default {
  getStockOdds,
  getBatchOdds,
  calculateLocalOdds,
  hasIVData,
  getIVData,
  clearOddsCache,
  clearIVCache,
  getCacheStats
};
