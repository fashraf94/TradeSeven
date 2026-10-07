// src/services/popularMarketLoader.js
//
// The app-wide market poll's ONE fetch step (src/App.jsx "Load market data on
// mount"), pulled out of App.jsx so both of its paths are testable without
// rendering App.jsx; popularMarketLoader.test.js also pins the App.jsx call
// site by source scan.
//
// EODHD Quick Wins QW-4 (docs/audits/20261007_BUILD_EODHD_QUICK_WINS.md):
//   flag OFF — exactly the pre-build sequence: the stock list, handed to
//              App.jsx, then the crypto list, each through the per-symbol batch
//              helpers (and the per-tab price cache they fill).
//   flag ON  — both lists from GET /api/market/popular in one call, then both
//              handed over. That path never writes the per-tab price cache.
// The flag is read at CALL time inside a fail-safe: a hermetic featureFlags
// mock that omits the name throws on access under vitest, and that must read
// as OFF. The visibility gate and the 5-minute interval stay in App.jsx.

import { stockAPI } from './eodhdAPI.js';
import { EODHD_QUICK_WINS_ENABLED } from '../config/featureFlags.js';

function eodhdQuickWinsOn() {
  try {
    return EODHD_QUICK_WINS_ENABLED === true;
  } catch {
    return false;
  }
}

/**
 * @param {(stocks: Array) => void} onStocks - App.jsx's setStocksData
 * @param {(crypto: Array) => void} onCrypto - App.jsx's setCryptoData
 */
export async function loadPopularMarketData(onStocks, onCrypto) {
  if (eodhdQuickWinsOn()) {
    const { stocks, crypto } = await stockAPI.getPopularMarketData();
    onStocks(stocks);
    onCrypto(crypto);
    return;
  }

  // Fetch real stock prices
  const stocks = await stockAPI.getPopularStocks();
  onStocks(stocks);

  // Fetch real crypto prices
  const crypto = await stockAPI.getPopularCrypto();
  onCrypto(crypto);
}
