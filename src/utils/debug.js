/**
 * Debug utilities for MarketClash
 *
 * Access in browser console via window.mcDebug
 */

import cacheService from '../services/cacheService';
import { apiMonitor } from '../services/apiMonitor';

export const mcDebug = {
  /**
   * Run a full system audit
   */
  audit() {
    console.log('\n Running MarketClash System Audit...\n');

    // Cache report
    console.log('--- CACHE STATUS ---');
    cacheService.report();

    // API monitor report
    console.log('\n--- API USAGE ---');
    apiMonitor.report();

    // Environment check
    console.log('--- ENVIRONMENT ---');
    console.log(`Mode: ${import.meta.env?.MODE || 'unknown'}`);
    console.log(`Dev: ${import.meta.env?.DEV || false}`);

    // LocalStorage usage
    const lsKeys = Object.keys(localStorage);
    const mcKeys = lsKeys.filter(k => k.startsWith('mc_'));
    console.log(`\n--- STORAGE ---`);
    console.log(`Total localStorage keys: ${lsKeys.length}`);
    console.log(`MarketClash keys: ${mcKeys.length}`);

    let totalSize = 0;
    mcKeys.forEach(key => {
      totalSize += localStorage.getItem(key)?.length || 0;
    });
    console.log(`MarketClash storage: ~${(totalSize / 1024).toFixed(1)} KB`);

    console.log('\nAudit complete\n');
  },

  /**
   * Clear all MarketClash data
   */
  clearAll() {
    cacheService.clearAll();
    apiMonitor.clear();

    // Clear any other mc_ prefixed localStorage
    Object.keys(localStorage)
      .filter(k => k.startsWith('mc_'))
      .forEach(k => localStorage.removeItem(k));

    console.log('All MarketClash data cleared');
  },

  /**
   * Clear only cache data
   */
  clearCache() {
    cacheService.clearAll();
    console.log('Cache cleared');
  },

  /**
   * View cache contents for a specific type
   */
  viewCache(type) {
    const prefix = `mc_cache_${type}:`;
    const entries = [];

    Object.keys(localStorage)
      .filter(k => k.startsWith(prefix))
      .forEach(key => {
        try {
          const entry = JSON.parse(localStorage.getItem(key));
          entries.push({
            key: key.replace('mc_cache_', ''),
            age: entry.cachedAt ? Math.round((Date.now() - entry.cachedAt) / 1000 / 60) + ' min' : 'unknown',
            expiresIn: entry.expiresAt ? Math.round((entry.expiresAt - Date.now()) / 1000 / 60) + ' min' : 'unknown',
            data: entry.value
          });
        } catch (e) {
          // Skip invalid entries
        }
      });

    if (entries.length === 0) {
      console.log(`No cache entries found for type: ${type}`);
    } else {
      console.table(entries);
    }
    return entries;
  },

  /**
   * Test cache effectiveness by simulating repeated calls
   */
  async testCacheEffectiveness() {
    console.log('Testing cache effectiveness...\n');

    apiMonitor.clear();
    apiMonitor.enable();

    // Import and call a function that uses cache
    const { getMultipleStockPrices } = await import('../services/eodhdAPI');

    const testSymbols = ['AAPL', 'MSFT', 'GOOGL'];

    console.log('First call (should fetch from API):');
    await getMultipleStockPrices(testSymbols);

    console.log('\nSecond call (should be from cache):');
    await getMultipleStockPrices(testSymbols);

    console.log('\nThird call (should be from cache):');
    await getMultipleStockPrices(testSymbols);

    const stats = apiMonitor.getStats();
    console.log(`\nResult: ${stats.totalCalls} API calls for 3 requests`);
    console.log(stats.totalCalls === 1
      ? 'Cache is working! Only 1 actual API call made.'
      : 'Cache may not be working correctly.');

    cacheService.report();
  },

  /**
   * Simulate a user session to estimate API usage
   */
  async simulateSession() {
    console.log('Simulating user session...\n');

    apiMonitor.clear();
    apiMonitor.enable();

    const { getMultipleStockPrices, getMultipleCryptoPrices, getMarketNews } = await import('../services/eodhdAPI');

    const stocks = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA'];
    const crypto = ['BTC', 'ETH', 'SOL'];

    console.log('Step 1: User opens app (fetch prices)');
    await getMultipleStockPrices(stocks);
    await getMultipleCryptoPrices(crypto);

    console.log('Step 2: User views news');
    await getMarketNews(10);

    console.log('Step 3: User returns to dashboard (prices again)');
    await getMultipleStockPrices(stocks);
    await getMultipleCryptoPrices(crypto);

    console.log('Step 4: User checks news again');
    await getMarketNews(10);

    console.log('\n--- Session Simulation Results ---');
    apiMonitor.report();

    console.log('Expected: 3 actual API calls (rest from cache)');
  },

  /**
   * Export debug data for sharing
   */
  exportDebugData() {
    const data = {
      timestamp: new Date().toISOString(),
      cache: cacheService.getStats(),
      api: apiMonitor.export(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A',
      url: typeof window !== 'undefined' ? window.location.href : 'N/A'
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `marketclash-debug-${Date.now()}.json`;
    a.click();

    URL.revokeObjectURL(url);
    console.log('Debug data exported');
  },

  /**
   * Get a summary of current state
   */
  summary() {
    const cacheStats = cacheService.getStats();
    const apiStats = apiMonitor.getStats();

    return {
      cache: {
        hitRate: cacheStats.hitRate,
        memoryItems: cacheStats.memorySize,
        storageItems: cacheStats.storageSize
      },
      api: {
        totalCalls: apiStats.totalCalls,
        callsPerMinute: apiStats.callsPerMinute,
        issuesDetected: apiStats.rapidCalls.length
      }
    };
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.mcDebug = mcDebug;
}

export default mcDebug;
