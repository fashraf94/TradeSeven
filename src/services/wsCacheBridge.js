/**
 * wsCacheBridge.js
 *
 * Periodically flushes WebSocket real-time prices into the app's
 * cache service so research modals and other non-battle components
 * get fresh prices without making REST API calls.
 */

import { wsManager } from './websocketService';
import cacheService from './cacheService';
import { isCrypto } from '../utils/stockHelpers';

const FLUSH_INTERVAL = 60000; // Flush every 60 seconds
let flushTimer = null;

function flushWsPricesToCache() {
  const wsPrices = wsManager.getAllCachedPrices();

  let count = 0;
  for (const [symbol, data] of Object.entries(wsPrices)) {
    if (data && data.price) {
      // Use the correct cache type so eodhdAPI.js cache lookups match:
      //   stocks → cacheService.get('prices', symbol)
      //   crypto → cacheService.get('crypto', symbol)
      const cacheType = isCrypto(symbol) ? 'crypto' : 'prices';
      cacheService.set(cacheType, symbol, {
        price: data.price,
        source: 'websocket'
      });
      count++;
    }
  }

  if (count > 0) {
    console.log(`[WS→Cache] Flushed ${count} WebSocket prices to cache`);
  }
}

export function startWsCacheBridge() {
  if (flushTimer) return; // Already running

  // Do an initial flush immediately
  flushWsPricesToCache();

  // Then flush every 60 seconds
  flushTimer = setInterval(flushWsPricesToCache, FLUSH_INTERVAL);
  console.log('[WS→Cache] Bridge started (60s interval)');
}

export function stopWsCacheBridge() {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
    console.log('[WS→Cache] Bridge stopped');
  }
}
