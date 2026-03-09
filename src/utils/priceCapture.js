import { captureRealtimePrices } from '../services/websocketService';
import { fetchFreshPrices, fetchEODClosePrices, getMultipleStockPrices, getMultipleCryptoPrices } from '../services/eodhdAPI';
import { getMarketState } from './marketSchedule';
import { CRYPTO_SYMBOLS } from '../services/sessionScoringService';

/**
 * Two-phase price capture for battle entry/join:
 *   Phase 1: WebSocket (real-time, 5s timeout)
 *   Phase 2: Market-aware fallback for any symbols WebSocket missed
 *     - Market open: real-time REST (fetchFreshPrices)
 *     - Market closed: EOD official close for stocks, real-time for crypto
 *
 * @param {string[]} symbols - All unique symbols in the battle
 * @returns {Promise<Object>} - { AAPL: 189.50, NVDA: 132.41, ... }
 */
export async function captureBattlePrices(symbols) {
  const startTime = Date.now();

  // Phase 1: WebSocket (real-time, 5s timeout)
  const { prices: wsPrices, missing, source } = await captureRealtimePrices(symbols, 5000);

  let finalPrices = { ...wsPrices };

  // Phase 2: Market-aware fallback for missing symbols
  if (missing.length > 0) {
    const { isOpen } = getMarketState();
    const missingStocks = missing.filter(s => !CRYPTO_SYMBOLS.has(s.toUpperCase()));
    const missingCrypto = missing.filter(s => CRYPTO_SYMBOLS.has(s.toUpperCase()));

    // Stocks: EOD close when market closed, real-time when open
    if (missingStocks.length > 0) {
      try {
        if (isOpen) {
          const stockPrices = await fetchFreshPrices(missingStocks);
          for (const sym of missingStocks) {
            if (stockPrices[sym] > 0) { finalPrices[sym] = stockPrices[sym]; source[sym] = 'rest-realtime'; }
          }
        } else {
          console.log(`[PriceCapture] Market CLOSED — using EOD close for ${missingStocks.length} stocks`);
          const eodPrices = await fetchEODClosePrices(missingStocks);
          for (const sym of missingStocks) {
            if (eodPrices[sym] > 0) { finalPrices[sym] = eodPrices[sym]; source[sym] = 'eod-close'; }
          }
          // Final fallback: real-time REST for any EOD failures
          const stillMissing = missingStocks.filter(s => !(s in finalPrices) || finalPrices[s] <= 0);
          if (stillMissing.length > 0) {
            console.log(`[PriceCapture] EOD missed ${stillMissing.length} stocks, falling back to REST`);
            const rtPrices = await fetchFreshPrices(stillMissing);
            for (const sym of stillMissing) {
              if (rtPrices[sym] > 0) { finalPrices[sym] = rtPrices[sym]; source[sym] = 'rest-fallback'; }
            }
          }
        }
      } catch (err) {
        console.error('[PriceCapture] Stock fallback failed:', err);
      }
    }

    // Crypto: always real-time (trades 24/7)
    if (missingCrypto.length > 0) {
      try {
        const cryptoPrices = await fetchFreshPrices(missingCrypto);
        for (const sym of missingCrypto) {
          if (cryptoPrices[sym] > 0) { finalPrices[sym] = cryptoPrices[sym]; source[sym] = 'rest-crypto'; }
        }
      } catch (err) {
        console.error('[PriceCapture] Crypto fallback failed:', err);
      }
    }
  }

  // Diagnostic log
  const elapsed = Date.now() - startTime;
  const wsCount = Object.values(source).filter(s => s.startsWith('websocket')).length;
  const eodCount = Object.values(source).filter(s => s === 'eod-close').length;
  const restCount = Object.values(source).filter(s => s.startsWith('rest-')).length;
  const failedCount = symbols.filter(s => !(s in finalPrices) || finalPrices[s] <= 0).length;
  console.log(`[PriceCapture] ${elapsed}ms — ${wsCount} WS, ${eodCount} EOD, ${restCount} REST, ${failedCount} failed`);
  console.log('[PriceCapture] Per-symbol:', Object.entries(source).map(([sym, src]) =>
    `${sym}: $${finalPrices[sym]?.toFixed(2) || 'MISSING'} (${src})`
  ).join(' | '));

  return finalPrices;
}

/**
 * Capture previous close prices for all battle symbols.
 * Uses the cached getMultipleStockPrices / getMultipleCryptoPrices endpoints
 * which return previousClose in the normalized response. Since previousClose
 * is static for the day, caching is ideal — no extra API calls needed if
 * the data was recently fetched by captureBattlePrices.
 *
 * @param {string[]} symbols - All unique symbols in the battle
 * @returns {Promise<Record<string, number>>} - { AAPL: 188.50, BTC: 97000, ... }
 */
export async function capturePreviousClosePrices(symbols) {
  if (!symbols?.length) return {};

  const stockSymbols = symbols.filter(s => !CRYPTO_SYMBOLS.has(s.toUpperCase()));
  const cryptoSymbols = symbols.filter(s => CRYPTO_SYMBOLS.has(s.toUpperCase()));

  const previousCloses = {};

  try {
    const [stockData, cryptoData] = await Promise.all([
      stockSymbols.length > 0 ? getMultipleStockPrices(stockSymbols) : {},
      cryptoSymbols.length > 0 ? getMultipleCryptoPrices(cryptoSymbols) : {},
    ]);

    for (const [sym, data] of Object.entries(stockData)) {
      const pc = data?.previousClose;
      if (pc > 0) previousCloses[sym.toUpperCase()] = pc;
    }

    for (const [sym, data] of Object.entries(cryptoData)) {
      const pc = data?.previousClose;
      if (pc > 0) previousCloses[sym.toUpperCase()] = pc;
    }
  } catch (err) {
    console.warn('[PriceCapture] Failed to capture previousClose prices:', err.message);
  }

  const count = Object.keys(previousCloses).length;
  console.log(`[PriceCapture] Captured ${count}/${symbols.length} previousClose prices`);
  return previousCloses;
}
