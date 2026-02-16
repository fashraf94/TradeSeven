/**
 * Bitcoin On-Chain Health Data Service
 *
 * Fetches Bitcoin on-chain metrics from our Vercel API (/api/crypto/on-chain)
 * which aggregates data from BGeometrics (free, no auth).
 *
 * Metrics include: MVRV, NUPL, Fear & Greed, Exchange Flows, ETF Balance,
 * Funding Rate, Open Interest, Active Addresses, Whale/Shark/Shrimp holdings.
 *
 * CACHING: Uses 'metrics' data type → MODERATE tier (1 hour) via cacheService.
 *
 * @see /api/crypto/on-chain.js - Server-side endpoint
 * @see /src/services/cacheService.js - Cache implementation
 */

import cacheService from './cacheService.js';
import { apiMonitor } from './apiMonitor.js';

const IS_DEV = import.meta.env.DEV;
const CACHE_TYPE = 'metrics';
const CACHE_KEY = 'btc_onchain_health';

const logDebug = (message, ...args) => {
  if (IS_DEV) {
    console.log(`[OnChain] ${message}`, ...args);
  }
};

/**
 * Fetch Bitcoin on-chain health data from our API.
 * Returns consolidated metrics with latest values, trends, and overall verdict.
 *
 * @returns {Object|null} On-chain data or null on failure
 */
export async function fetchBitcoinOnChainData() {
  // Check cache first
  const cached = cacheService.get(CACHE_TYPE, CACHE_KEY);
  if (cached) {
    logDebug('Returning cached on-chain data');
    return cached;
  }

  try {
    logDebug('Fetching fresh on-chain data...');

    const response = await fetch('/api/crypto/on-chain');

    apiMonitor.track('onchain', '/api/crypto/on-chain', response.ok);

    if (!response.ok) {
      throw new Error(`On-chain API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error('On-chain API returned unsuccessful response');
    }

    // Cache the result
    cacheService.set(CACHE_TYPE, CACHE_KEY, data);

    logDebug('On-chain data fetched:', {
      metricsAvailable: data.metricsAvailable,
      verdict: data.overall?.verdict
    });

    return data;

  } catch (error) {
    console.error('[OnChain] Failed to fetch on-chain data:', error.message);

    // Return stale cache if available
    const stale = cacheService.get(CACHE_TYPE, CACHE_KEY);
    if (stale) {
      logDebug('Returning stale cached data');
      return { ...stale, stale: true };
    }

    return null;
  }
}

/**
 * Determine if an asset should show the Health tab in the Research Modal.
 *
 * @param {Object} asset - The asset object with symbol and type info
 * @returns {'full'|'simplified'|false} - Tab type or false if not applicable
 */
export function shouldShowHealthTab(asset) {
  if (!asset) return false;

  const symbol = (asset.symbol || '').toUpperCase();

  // Full Health tab for BTC (all on-chain metrics)
  if (symbol === 'BTC' || symbol === 'BTC-USD') return 'full';

  // Simplified Health tab for other crypto (just Fear & Greed + Funding Rate)
  if (asset.isCrypto || asset.type === 'crypto') return 'simplified';

  // No Health tab for stocks
  return false;
}
