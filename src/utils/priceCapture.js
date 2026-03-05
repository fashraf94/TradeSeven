import { captureRealtimePrices } from '../services/websocketService';
import { fetchFreshPrices } from '../services/eodhdAPI';

/**
 * Two-phase price capture for battle entry/join:
 *   Phase 1: WebSocket (real-time, 5s timeout)
 *   Phase 2: REST fallback for any symbols WebSocket missed
 *
 * @param {string[]} symbols - All unique symbols in the battle
 * @returns {Promise<Object>} - { AAPL: 189.50, NVDA: 132.41, ... }
 */
export async function captureBattlePrices(symbols) {
  const startTime = Date.now();

  // Phase 1: WebSocket (real-time, 5s timeout)
  const { prices: wsPrices, missing, source } = await captureRealtimePrices(symbols, 5000);

  // Phase 2: REST fallback for missing symbols only
  let finalPrices = { ...wsPrices };

  if (missing.length > 0) {
    console.log(`[PriceCapture] WebSocket missed ${missing.length} symbols, falling back to REST:`, missing);
    try {
      const restPrices = await fetchFreshPrices(missing);
      for (const symbol of missing) {
        if (restPrices[symbol] && restPrices[symbol] > 0) {
          finalPrices[symbol] = restPrices[symbol];
          source[symbol] = 'rest-fallback';
        }
      }
    } catch (err) {
      console.error('[PriceCapture] REST fallback failed:', err);
    }
  }

  // Diagnostic log
  const elapsed = Date.now() - startTime;
  const wsCount = Object.values(source).filter(s => s === 'websocket' || s === 'websocket-cached').length;
  const restCount = Object.values(source).filter(s => s === 'rest-fallback').length;
  const failedCount = symbols.filter(s => !(s in finalPrices) || finalPrices[s] <= 0).length;
  console.log(`[PriceCapture] ${elapsed}ms — ${wsCount} WebSocket, ${restCount} REST fallback, ${failedCount} failed`);
  console.log('[PriceCapture] Per-symbol:', Object.entries(source).map(([sym, src]) =>
    `${sym}: $${finalPrices[sym]?.toFixed(2) || 'MISSING'} (${src})`
  ).join(' | '));

  return finalPrices;
}
