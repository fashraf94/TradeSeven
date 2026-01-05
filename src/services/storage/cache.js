// src/services/storage/cache.js
// API Response caching layer to reduce redundant network calls

/**
 * Cache duration presets (in milliseconds)
 */
export const CACHE_DURATIONS = {
  PRICES: 30 * 1000,           // 30 seconds - stock/crypto prices
  TECHNICALS: 30 * 60 * 1000,  // 30 minutes - technical indicators
  SECTOR_DATA: 5 * 60 * 1000,  // 5 minutes - sector analysis
  HISTORICAL: 60 * 60 * 1000,  // 1 hour - historical data
  NEWS: 10 * 60 * 1000,        // 10 minutes - market news
  THRESHOLDS: 15 * 60 * 1000,  // 15 minutes - volatility thresholds
};

/**
 * APICache - In-memory cache with TTL support
 */
class APICache {
  constructor() {
    this.cache = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
    };
  }

  /**
   * Generate a cache key from endpoint and params
   */
  generateKey(endpoint, params = {}) {
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((acc, key) => {
        acc[key] = params[key];
        return acc;
      }, {});
    return `${endpoint}:${JSON.stringify(sortedParams)}`;
  }

  /**
   * Get cached data if valid
   * @returns {any|null} Cached data or null if expired/missing
   */
  get(key) {
    const cached = this.cache.get(key);

    if (!cached) {
      this.stats.misses++;
      return null;
    }

    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return cached.data;
  }

  /**
   * Store data in cache with TTL
   */
  set(key, data, duration) {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + duration,
      cachedAt: Date.now(),
    });
    this.stats.sets++;
  }

  /**
   * Check if a key exists and is valid
   */
  has(key) {
    const cached = this.cache.get(key);
    if (!cached) return false;
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Delete a specific key
   */
  delete(key) {
    return this.cache.delete(key);
  }

  /**
   * Clear all cached data
   */
  clear() {
    this.cache.clear();
    console.log('[Cache] Cleared all cached data');
  }

  /**
   * Clear expired entries (garbage collection)
   */
  clearExpired() {
    const now = Date.now();
    let cleared = 0;

    for (const [key, value] of this.cache.entries()) {
      if (now > value.expiresAt) {
        this.cache.delete(key);
        cleared++;
      }
    }

    if (cleared > 0) {
      console.log(`[Cache] Cleared ${cleared} expired entries`);
    }
    return cleared;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0
      ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(1)
      : 0;

    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
      size: this.cache.size,
    };
  }

  /**
   * Get or fetch - returns cached data or executes fetch function
   * @param {string} key - Cache key
   * @param {Function} fetchFn - Async function to fetch data if not cached
   * @param {number} duration - Cache duration in ms
   */
  async getOrFetch(key, fetchFn, duration) {
    const cached = this.get(key);
    if (cached !== null) {
      return cached;
    }

    const data = await fetchFn();
    this.set(key, data, duration);
    return data;
  }
}

// Singleton instance
export const apiCache = new APICache();

// Auto-cleanup expired entries every 5 minutes
setInterval(() => {
  apiCache.clearExpired();
}, 5 * 60 * 1000);

export default apiCache;
