/**
 * Server-side caching utilities for Vercel serverless functions.
 *
 * Two layers:
 * 1. In-memory Map (survives warm function reuse, ~5-10min on Vercel)
 * 2. Cache-Control headers (Vercel Edge CDN, configurable TTL)
 */

// In-memory cache (module-level, persists across warm invocations)
const memoryCache = new Map();

/**
 * Get from memory cache if still valid
 * @param {string} key - Cache key
 * @returns {object|null} Cached data or null
 */
export function getFromCache(key) {
  const entry = memoryCache.get(key);
  if (!entry) return null;

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
 */
export function setInCache(key, data, ttlSeconds) {
  if (ttlSeconds <= 0) return;

  memoryCache.set(key, {
    data,
    expiresAt: Date.now() + (ttlSeconds * 1000)
  });

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
