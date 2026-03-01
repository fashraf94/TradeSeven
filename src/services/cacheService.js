/**
 * Multi-Tier Cache Service for MarketClash
 *
 * Provides intelligent caching with different TTLs based on data volatility:
 * - AGGRESSIVE (24h): Static data like fundamentals, historical prices
 * - MODERATE (1h): Semi-static data like news, analyst ratings
 * - LIGHT (2min): Frequently changing data like prices during market hours
 * - NONE (0): Real-time data that should never be cached
 *
 * Market-Aware Caching:
 * When the stock market is closed (evenings, weekends, holidays), stock price
 * caches are frozen until the next market open — prices don't change off-hours.
 * Crypto caches are unaffected (crypto trades 24/7).
 * During the pre-market window (9:20-9:30 AM ET), frozen stock caches are
 * invalidated so fresh prices are fetched before the opening bell.
 *
 * Uses a hybrid localStorage + memory cache approach for persistence and speed.
 */

import { getEffectiveTTL, getMarketState, isPreMarketWindow } from '../utils/marketSchedule';

// ============================================
// CACHE TIER CONFIGURATION
// ============================================

export const CACHE_TIERS = {
  AGGRESSIVE: {
    name: 'AGGRESSIVE',
    ttlMs: 24 * 60 * 60 * 1000, // 24 hours
    description: 'Static data - fundamentals, historical prices'
  },
  MODERATE: {
    name: 'MODERATE',
    ttlMs: 60 * 60 * 1000, // 1 hour
    description: 'Semi-static data - news, analyst ratings'
  },
  LIGHT: {
    name: 'LIGHT',
    ttlMs: 2 * 60 * 1000, // 2 minutes (reduced from 5 to minimize price delay)
    description: 'Frequently changing - prices during market hours'
  },
  NONE: {
    name: 'NONE',
    ttlMs: 0, // No caching
    description: 'Real-time data - never cache'
  }
};

// Map data types to their appropriate cache tier
export const DATA_TYPE_TIERS = {
  // AGGRESSIVE - 24 hour cache
  'fundamentals': CACHE_TIERS.AGGRESSIVE,
  'historical': CACHE_TIERS.AGGRESSIVE,
  'technicals': CACHE_TIERS.AGGRESSIVE,
  'earnings': CACHE_TIERS.AGGRESSIVE,
  'volatility': CACHE_TIERS.AGGRESSIVE,

  // MODERATE - 1 hour cache
  'news': CACHE_TIERS.MODERATE,
  'analyst': CACHE_TIERS.MODERATE,
  'weekAhead': CACHE_TIERS.MODERATE,
  'metrics': CACHE_TIERS.MODERATE,

  // LIGHT - 5 minute cache
  'prices': CACHE_TIERS.LIGHT,
  'crypto': CACHE_TIERS.LIGHT,
  'quotes': CACHE_TIERS.LIGHT,

  // NONE - no cache
  'realtime': CACHE_TIERS.NONE,
  'ai': CACHE_TIERS.NONE
};

// ============================================
// CACHE SERVICE CLASS
// ============================================

class CacheService {
  constructor() {
    // In-memory cache for fast access
    this.memoryCache = new Map();

    // Storage key prefix for localStorage
    this.storagePrefix = 'mc_cache_';

    // Track cache statistics
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      evictions: 0
    };

    // Maximum items in memory cache (prevent memory bloat)
    this.maxMemoryItems = 500;

    // Initialize by loading from localStorage
    this._initFromStorage();
  }

  /**
   * Generate a cache key from data type and identifier
   */
  _generateKey(dataType, identifier) {
    return `${dataType}:${identifier}`;
  }

  /**
   * Initialize memory cache from localStorage
   */
  _initFromStorage() {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    try {
      const keys = Object.keys(localStorage).filter(k => k.startsWith(this.storagePrefix));
      const now = Date.now();

      for (const storageKey of keys) {
        try {
          const raw = localStorage.getItem(storageKey);
          if (!raw) continue;

          const cached = JSON.parse(raw);

          // Use dynamic TTL for expiration check (market-aware)
          const dataType = cached.dataType || storageKey.replace(this.storagePrefix, '').split(':')[0];
          const age = now - (cached.cachedAt || 0);
          const effectiveTTL = getEffectiveTTL(dataType);

          if (effectiveTTL > 0 && age > effectiveTTL) {
            localStorage.removeItem(storageKey);
            this.stats.evictions++;
            continue;
          }

          // Load into memory cache
          const cacheKey = storageKey.replace(this.storagePrefix, '');
          this.memoryCache.set(cacheKey, cached);
        } catch (e) {
          // Invalid cache entry, remove it
          localStorage.removeItem(storageKey);
        }
      }

      console.log(`[CacheService] Loaded ${this.memoryCache.size} items from storage`);
    } catch (e) {
      console.warn('[CacheService] Failed to init from storage:', e.message);
    }
  }

  /**
   * Get a value from cache
   * @param {string} dataType - Type of data (e.g., 'fundamentals', 'prices')
   * @param {string} identifier - Unique identifier (e.g., symbol, 'AAPL')
   * @returns {any|null} Cached value or null if not found/expired
   */
  get(dataType, identifier) {
    const tier = DATA_TYPE_TIERS[dataType] || CACHE_TIERS.LIGHT;

    // Never cache certain data types
    if (tier.ttlMs === 0) {
      this.stats.misses++;
      return null;
    }

    const key = this._generateKey(dataType, identifier);
    const now = Date.now();
    const effectiveTTL = getEffectiveTTL(dataType);

    // Check memory cache first (fastest)
    if (this.memoryCache.has(key)) {
      const cached = this.memoryCache.get(key);
      const age = now - (cached.cachedAt || 0);

      // Pre-market invalidation: if we're in the pre-market window and this is
      // a stock price cached during closed hours, force a refresh
      if (isPreMarketWindow() &&
          (dataType === 'prices' || dataType === 'quotes') &&
          cached.marketState && cached.marketState !== 'OPEN') {
        this.memoryCache.delete(key);
        this._removeFromStorage(key);
        this.stats.evictions++;
        this.stats.misses++;
        return null;
      }

      if (age < effectiveTTL) {
        this.stats.hits++;
        return cached.value;
      } else {
        // Expired, remove from both caches
        this.memoryCache.delete(key);
        this._removeFromStorage(key);
        this.stats.evictions++;
      }
    }

    // Check localStorage (slower but persistent)
    const storageEntry = this._getFromStorageFull(key);
    if (storageEntry !== null) {
      const age = now - (storageEntry.cachedAt || 0);

      // Pre-market invalidation for localStorage entries
      if (isPreMarketWindow() &&
          (dataType === 'prices' || dataType === 'quotes') &&
          storageEntry.marketState && storageEntry.marketState !== 'OPEN') {
        this._removeFromStorage(key);
        this.stats.misses++;
        return null;
      }

      if (age < effectiveTTL) {
        // Promote to memory cache with original metadata
        this.memoryCache.set(key, storageEntry);
        this.stats.hits++;
        return storageEntry.value;
      } else {
        this._removeFromStorage(key);
      }
    }

    this.stats.misses++;
    return null;
  }

  /**
   * Set a value in cache
   * @param {string} dataType - Type of data
   * @param {string} identifier - Unique identifier
   * @param {any} value - Value to cache
   * @param {object} options - Optional settings (customTtlMs)
   */
  set(dataType, identifier, value, options = {}) {
    const tier = DATA_TYPE_TIERS[dataType] || CACHE_TIERS.LIGHT;

    // Never cache certain data types
    if (tier.ttlMs === 0 && !options.forceTtlMs) {
      return;
    }

    const ttlMs = options.customTtlMs || tier.ttlMs;
    const key = this._generateKey(dataType, identifier);
    const now = Date.now();

    const cacheEntry = {
      value,
      expiresAt: now + ttlMs, // Static fallback for localStorage init
      dataType,
      identifier,
      cachedAt: now,
      marketState: getMarketState().state, // Market state when cached
    };

    // Store in memory cache
    this._enforceMemoryLimit();
    this.memoryCache.set(key, cacheEntry);

    // Persist to localStorage for data that should survive page refresh.
    // Also persist LIGHT-tier stock data when market is closed (frozen caches
    // should survive page refreshes over weekends/holidays).
    const marketClosed = cacheEntry.marketState !== 'OPEN' && cacheEntry.marketState !== 'PRE_MARKET';
    const isStockPrice = dataType === 'prices' || dataType === 'quotes';
    if (tier === CACHE_TIERS.AGGRESSIVE || tier === CACHE_TIERS.MODERATE ||
        (marketClosed && isStockPrice)) {
      this._saveToStorage(key, cacheEntry);
    }

    this.stats.sets++;
  }

  /**
   * Check if a value exists in cache and is not expired
   */
  has(dataType, identifier) {
    return this.get(dataType, identifier) !== null;
  }

  /**
   * Delete a specific cache entry
   */
  delete(dataType, identifier) {
    const key = this._generateKey(dataType, identifier);
    this.memoryCache.delete(key);
    this._removeFromStorage(key);
  }

  /**
   * Clear all cache entries of a specific data type
   */
  clearType(dataType) {
    const prefix = `${dataType}:`;

    // Clear from memory
    for (const key of this.memoryCache.keys()) {
      if (key.startsWith(prefix)) {
        this.memoryCache.delete(key);
      }
    }

    // Clear from localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      const storagePrefix = this.storagePrefix + prefix;
      const keys = Object.keys(localStorage).filter(k => k.startsWith(storagePrefix));
      keys.forEach(k => localStorage.removeItem(k));
    }
  }

  /**
   * Clear entire cache
   */
  clearAll() {
    this.memoryCache.clear();

    if (typeof window !== 'undefined' && window.localStorage) {
      const keys = Object.keys(localStorage).filter(k => k.startsWith(this.storagePrefix));
      keys.forEach(k => localStorage.removeItem(k));
    }

    console.log('[CacheService] All cache cleared');
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
      memorySize: this.memoryCache.size,
      storageSize: this._getStorageSize()
    };
  }

  /**
   * Get market-aware cache statistics.
   * Reports how many entries are "frozen" (cached during closed market, still valid
   * under dynamic TTL) and estimates API calls saved.
   */
  getMarketAwareStats() {
    const now = Date.now();
    let frozenCount = 0;
    let extendedCount = 0;
    let estimatedCallsSaved = 0;

    for (const [key, entry] of this.memoryCache) {
      const dataType = entry.dataType || key.split(':')[0];
      if (dataType === 'crypto') continue; // Crypto is never frozen

      const age = now - (entry.cachedAt || 0);
      const tier = DATA_TYPE_TIERS[dataType] || CACHE_TIERS.LIGHT;
      const staticTTL = tier.ttlMs;
      const effectiveTTL = getEffectiveTTL(dataType);

      // Entry is "frozen" if it was cached during closed market
      if (entry.marketState && entry.marketState !== 'OPEN' && entry.marketState !== 'PRE_MARKET') {
        frozenCount++;
      }

      // Entry would have expired under old static TTL but is still valid
      if (age > staticTTL && age < effectiveTTL) {
        extendedCount++;
        // Estimate calls saved: how many times this would have been re-fetched
        if (staticTTL > 0) {
          estimatedCallsSaved += Math.floor(age / staticTTL) - 1;
        }
      }
    }

    return {
      frozenCount,
      extendedCount,
      estimatedCallsSaved,
      marketState: getMarketState(),
    };
  }

  /**
   * Debug: Print cache report
   */
  report() {
    const stats = this.getStats();
    console.log('[CacheService] Cache Report:');
    console.log(`  Hit Rate: ${stats.hitRate}`);
    console.log(`  Hits: ${stats.hits}, Misses: ${stats.misses}`);
    console.log(`  Sets: ${stats.sets}, Evictions: ${stats.evictions}`);
    console.log(`  Memory Items: ${stats.memorySize}`);
    console.log(`  Storage Items: ${stats.storageSize}`);

    // Report by data type
    const byType = {};
    for (const [key] of this.memoryCache) {
      const [type] = key.split(':');
      byType[type] = (byType[type] || 0) + 1;
    }
    console.log('  By Type:', byType);
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  _getFromStorage(key) {
    const entry = this._getFromStorageFull(key);
    return entry ? entry.value : null;
  }

  /**
   * Get full cache entry from localStorage (including metadata).
   * Uses dynamic TTL for expiration check.
   */
  _getFromStorageFull(key) {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }

    try {
      const raw = localStorage.getItem(this.storagePrefix + key);
      if (!raw) return null;

      const cached = JSON.parse(raw);

      // Use dynamic TTL for expiration check
      const dataType = cached.dataType || key.split(':')[0];
      const age = Date.now() - (cached.cachedAt || 0);
      const effectiveTTL = getEffectiveTTL(dataType);

      if (effectiveTTL > 0 && age > effectiveTTL) {
        localStorage.removeItem(this.storagePrefix + key);
        return null;
      }

      return cached;
    } catch (e) {
      return null;
    }
  }

  _saveToStorage(key, cacheEntry) {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    try {
      localStorage.setItem(this.storagePrefix + key, JSON.stringify(cacheEntry));
    } catch (e) {
      // Storage quota exceeded, clear old entries
      if (e.name === 'QuotaExceededError') {
        this._evictOldestFromStorage();
        try {
          localStorage.setItem(this.storagePrefix + key, JSON.stringify(cacheEntry));
        } catch (e2) {
          console.warn('[CacheService] Storage full, could not cache:', key);
        }
      }
    }
  }

  _removeFromStorage(key) {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    try {
      localStorage.removeItem(this.storagePrefix + key);
    } catch (e) {
      // Ignore
    }
  }

  _getStorageSize() {
    if (typeof window === 'undefined' || !window.localStorage) {
      return 0;
    }

    return Object.keys(localStorage).filter(k => k.startsWith(this.storagePrefix)).length;
  }

  _enforceMemoryLimit() {
    if (this.memoryCache.size >= this.maxMemoryItems) {
      // Remove oldest 10% of entries
      const toRemove = Math.ceil(this.maxMemoryItems * 0.1);
      const keys = Array.from(this.memoryCache.keys()).slice(0, toRemove);

      for (const key of keys) {
        this.memoryCache.delete(key);
        this.stats.evictions++;
      }
    }
  }

  _evictOldestFromStorage() {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    const keys = Object.keys(localStorage)
      .filter(k => k.startsWith(this.storagePrefix));

    // Get all with their cachedAt timestamps
    const entries = keys.map(k => {
      try {
        const cached = JSON.parse(localStorage.getItem(k));
        return { key: k, cachedAt: cached.cachedAt || 0 };
      } catch {
        return { key: k, cachedAt: 0 };
      }
    });

    // Sort by oldest first and remove 20%
    entries.sort((a, b) => a.cachedAt - b.cachedAt);
    const toRemove = Math.ceil(entries.length * 0.2);

    for (let i = 0; i < toRemove; i++) {
      localStorage.removeItem(entries[i].key);
      this.stats.evictions++;
    }
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

// Create singleton instance
const cacheService = new CacheService();

export default cacheService;

// Named exports for convenience
export { cacheService };
