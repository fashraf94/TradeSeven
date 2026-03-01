/**
 * Server-side caching utilities for Vercel serverless functions.
 *
 * Two layers:
 * 1. In-memory Map (survives warm function reuse, ~5-10min on Vercel)
 * 2. Cache-Control headers (Vercel Edge CDN, configurable TTL)
 *
 * Market-aware: When a dataType is provided, TTLs are dynamically extended
 * for stock data when the market is closed (prices don't change off-hours).
 */

import { getEffectiveTTL, isMarketOpen, getTimeUntilNextOpen } from './marketSchedule.js';

// In-memory cache (module-level, persists across warm invocations)
const memoryCache = new Map();

// Track whether we've logged market-closed extension (avoid log spam)
let _lastMarketClosedLog = 0;

/**
 * Get from memory cache if still valid
 * @param {string} key - Cache key
 * @param {string} [dataType] - Optional data type for market-aware TTL
 * @returns {object|null} Cached data or null
 */
export function getFromCache(key, dataType = null) {
  const entry = memoryCache.get(key);
  if (!entry) return null;

  // If dataType provided, use market-aware dynamic TTL
  if (dataType && entry.cachedAt) {
    const effectiveTTLSec = getEffectiveTTL(dataType, { isCrypto: entry.isCrypto || false });
    const age = Date.now() - entry.cachedAt;

    if (age > effectiveTTLSec * 1000) {
      memoryCache.delete(key);
      return null;
    }

    return entry.data;
  }

  // Fallback: use static expiresAt for backward compatibility
  if (Date.now() > entry.expiresAt) {
    memoryCache.delete(key);
    return null;
  }

  return entry.data;
}

/**
 * Store in memory cache
 * @param {string} key - Cache key
 * @param {object} data - Data to cache
 * @param {number} ttlSeconds - Time to live in seconds
 * @param {object} [options] - Optional metadata
 * @param {string} [options.dataType] - Data type for market-aware TTL on read
 * @param {boolean} [options.isCrypto] - Whether this is crypto data
 */
export function setInCache(key, data, ttlSeconds, options = {}) {
  if (ttlSeconds <= 0) return;

  const entry = {
    data,
    expiresAt: Date.now() + (ttlSeconds * 1000),
    cachedAt: Date.now(),
  };

  // Store metadata for market-aware TTL on subsequent reads
  if (options.dataType) entry.dataType = options.dataType;
  if (options.isCrypto) entry.isCrypto = true;

  // Log market-closed TTL extension (throttled to once per 5 min)
  if (options.dataType && !options.isCrypto && !isMarketOpen()) {
    const now = Date.now();
    if (now - _lastMarketClosedLog > 300_000) {
      const hoursUntilOpen = (getTimeUntilNextOpen() / 3600_000).toFixed(1);
      console.log(`[ServerCache] Market closed — extending ${options.dataType} TTL to next open (${hoursUntilOpen}h)`);
      _lastMarketClosedLog = now;
    }
  }

  memoryCache.set(key, entry);

  // Prevent unbounded growth - cap at 500 entries
  if (memoryCache.size > 500) {
    const oldestKey = memoryCache.keys().next().value;
    memoryCache.delete(oldestKey);
  }
}

/**
 * Set Cache-Control headers for Vercel Edge CDN caching.
 * Also clears the no-cache headers set by applySecurityHeaders().
 * @param {object} res - Vercel response object
 * @param {number} sMaxAge - CDN cache duration in seconds
 * @param {number} staleWhileRevalidate - Serve stale while refreshing (seconds)
 */
export function setCacheHeaders(res, sMaxAge, staleWhileRevalidate = 0) {
  let cacheValue = `public, s-maxage=${sMaxAge}`;
  if (staleWhileRevalidate > 0) {
    cacheValue += `, stale-while-revalidate=${staleWhileRevalidate}`;
  }
  res.setHeader('Cache-Control', cacheValue);
  // Clear no-cache headers set by security middleware
  res.removeHeader('Pragma');
  res.removeHeader('Expires');
}

// Pre-defined cache tiers matching the existing client-side strategy
export const CACHE_TIERS = {
  // Current prices during market hours - fresh enough for gameplay
  PRICE: { sMaxAge: 60, staleWhileRevalidate: 30, memoryTTL: 60 },

  // Technical indicators, fundamentals - change slowly
  TECHNICAL: { sMaxAge: 3600, staleWhileRevalidate: 600, memoryTTL: 3600 },

  // News articles - moderate freshness
  NEWS: { sMaxAge: 1800, staleWhileRevalidate: 300, memoryTTL: 1800 },

  // AI-generated content (research intel, tracker) - cacheable per context
  AI_INTEL: { sMaxAge: 300, staleWhileRevalidate: 60, memoryTTL: 300 },

  // AI follow-up / thread - unique per question, don't cache
  AI_REALTIME: { sMaxAge: 0, staleWhileRevalidate: 0, memoryTTL: 0 },

  // Economic calendar - updates infrequently
  CALENDAR: { sMaxAge: 7200, staleWhileRevalidate: 1800, memoryTTL: 7200 },

  // Earnings data - changes daily at most
  EARNINGS: { sMaxAge: 3600, staleWhileRevalidate: 600, memoryTTL: 3600 },
};

/**
 * Get current in-memory cache size (for health checks)
 * @returns {number} Number of entries in memory cache
 */
export function getCacheSize() {
  return memoryCache.size;
}
