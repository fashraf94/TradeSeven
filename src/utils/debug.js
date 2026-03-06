/**
 * Debug utilities for FantasyTrades
 *
 * Access in browser console via window.mcDebug
 */

import cacheService from '../services/cacheService';
import { apiMonitor } from '../services/apiMonitor';
import { getMarketState, getEffectiveTTL, isPreMarketWindow, getNextMarketOpen } from '../utils/marketSchedule';
import wsManager from '../services/websocketService';

function timeSince(date) {
  if (!date) return 'Never';
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

function formatDuration(ms) {
  if (!ms) return 'N/A';
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

export const mcDebug = {
  /**
   * Run a full system audit
   */
  audit() {
    console.log('\n Running FantasyTrades System Audit...\n');

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
    console.log(`FantasyTrades keys: ${mcKeys.length}`);

    let totalSize = 0;
    mcKeys.forEach(key => {
      totalSize += localStorage.getItem(key)?.length || 0;
    });
    console.log(`FantasyTrades storage: ~${(totalSize / 1024).toFixed(1)} KB`);

    console.log('\nAudit complete\n');
  },

  /**
   * Clear all FantasyTrades data
   */
  clearAll() {
    cacheService.clearAll();
    apiMonitor.clear();

    // Clear any other mc_ prefixed localStorage
    Object.keys(localStorage)
      .filter(k => k.startsWith('mc_'))
      .forEach(k => localStorage.removeItem(k));

    console.log('All FantasyTrades data cleared');
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
    a.download = `fantasytrades-debug-${Date.now()}.json`;
    a.click();

    URL.revokeObjectURL(url);
    console.log('Debug data exported');
  },

  /**
   * Show current market state and cache savings from market-aware caching
   */
  marketState() {
    const state = getMarketState();
    const stats = cacheService.getMarketAwareStats();

    console.log('\n--- MARKET STATE ---');
    console.log(`  State: ${state.state}`);
    console.log(`  Market Open: ${state.isOpen}`);
    console.log(`  Pre-Market Window: ${isPreMarketWindow()}`);
    console.log(`  Early Close Today: ${state.isEarlyClose}`);
    console.log(`  Next Open: ${state.nextOpenTime.toLocaleString('en-US', { timeZone: 'America/New_York' })} ET`);
    console.log(`  Next Close: ${state.nextCloseTime.toLocaleString('en-US', { timeZone: 'America/New_York' })} ET`);

    console.log('\n--- EFFECTIVE TTLs ---');
    ['prices', 'crypto', 'news', 'technicals', 'fundamentals'].forEach(type => {
      const ttl = getEffectiveTTL(type);
      const hours = (ttl / 3600_000).toFixed(1);
      const minutes = (ttl / 60_000).toFixed(0);
      console.log(`  ${type}: ${ttl > 3600_000 ? hours + 'h' : minutes + 'min'}`);
    });

    console.log('\n--- CACHE SAVINGS ---');
    console.log(`  Frozen entries: ${stats.frozenCount}`);
    console.log(`  Extended entries: ${stats.extendedCount}`);
    console.log(`  Estimated API calls saved: ${stats.estimatedCallsSaved}`);

    const wsDiag = wsManager.getDiagnostics();
    console.log('\n--- WEBSOCKET ---');
    console.log(`  Connections: ${wsDiag.stocks.connected ? '🟢' : '🔴'} Stocks (${wsDiag.stocks.subscribedSymbols} syms) | ${wsDiag.crypto.connected ? '🟢' : '🔴'} Crypto (${wsDiag.crypto.subscribedSymbols} syms)`);
    console.log(`  Messages: ${wsDiag.messagesReceived.toLocaleString()} | Uptime: ${formatDuration(wsDiag.connectionUptime)}`);

    return { state, stats };
  },

  /**
   * Show detailed WebSocket connection diagnostics
   */
  websocket() {
    const diagnostics = wsManager.getDiagnostics();
    const marketState = getMarketState();
    const RS_LABELS = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'];

    console.log('%c--- WEBSOCKET DIAGNOSTICS ---', 'color: #00d9ff; font-weight: bold');

    console.log('\n📡 Stock Connection:');
    console.log(`  Status: ${diagnostics.stocks.connected ? '🟢 Connected' : '🔴 Disconnected'}`);
    console.log(`  ReadyState: ${RS_LABELS[diagnostics.stocks.readyState] || 'N/A'}`);
    console.log(`  Symbols: ${diagnostics.stocks.subscribedSymbols}`);
    if (diagnostics.stocks.symbolList.length > 0) {
      console.log(`  Symbol list: ${diagnostics.stocks.symbolList.join(', ')}`);
    }
    console.log(`  Reconnect attempts: ${diagnostics.stocks.reconnectAttempts}`);
    console.log(`  Last message: ${timeSince(diagnostics.stocks.lastMessageTime)}`);

    console.log('\n🪙 Crypto Connection:');
    console.log(`  Status: ${diagnostics.crypto.connected ? '🟢 Connected' : '🔴 Disconnected'}`);
    console.log(`  ReadyState: ${RS_LABELS[diagnostics.crypto.readyState] || 'N/A'}`);
    console.log(`  Symbols: ${diagnostics.crypto.subscribedSymbols}`);
    if (diagnostics.crypto.symbolList.length > 0) {
      console.log(`  Symbol list: ${diagnostics.crypto.symbolList.join(', ')}`);
    }
    console.log(`  Reconnect attempts: ${diagnostics.crypto.reconnectAttempts}`);
    console.log(`  Last message: ${timeSince(diagnostics.crypto.lastMessageTime)}`);

    console.log('\n📊 Summary:');
    console.log(`  Total subscriptions: ${diagnostics.totalSubscriptions}`);
    console.log(`  Messages received: ${diagnostics.messagesReceived.toLocaleString()}`);
    console.log(`  Session uptime: ${formatDuration(diagnostics.connectionUptime)}`);
    console.log(`  Market state: ${marketState.state}`);

    if (diagnostics.lastError) {
      console.log(`\n⚠️ Last error: ${diagnostics.lastError}`);
    }

    console.log('\n📐 EODHD Limit Check:');
    const activeConns = (diagnostics.stocks.connected ? 1 : 0) + (diagnostics.crypto.connected ? 1 : 0);
    console.log(`  Active connections: ${activeConns} / 2 possible per user`);
    console.log(`  Plan limit: 50 concurrent connections across all users`);
    console.log(`  Estimated headroom: ${50 - 2} connections for other users (assuming 2 per user)`);

    return diagnostics;
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
