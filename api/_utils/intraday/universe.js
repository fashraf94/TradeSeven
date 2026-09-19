// api/_utils/intraday/universe.js
//
// Intraday Data — Build 1, contract §4: the universe list and the actionable
// set. The universe is the 255 real-time symbols of compute-index-intelligence
// (5 index + 11 sector ETFs + 239 stocks, assembled at
// api/cron/compute-index-intelligence.js:738-742) plus every crypto symbol
// held or benched in an active battle. The actionable set is held ∪ bench
// across active battles, recomputed each sweep.

import { ALL_TICKERS, SECTOR_ETFS } from '../rankingConfig.js';
import { VALID_CRYPTO_SYMBOLS } from '../agentCryptoAssets.js';

/** compute-index-intelligence.js INDEX_SYMBOLS (pinned by universe.test.js against that file's source). */
export const INDEX_SYMBOLS = Object.freeze(['SPY', 'QQQ', 'DIA', 'IWM', 'RSP']);

export const UNIVERSE_STOCKS = Object.freeze([...new Set([...INDEX_SYMBOLS, ...SECTOR_ETFS, ...ALL_TICKERS])]);

/** BRK.B → BRK-B.US — the same normalisation compute-index-intelligence applies (:741). */
export const toVendorStock = (sym) => `${String(sym).replace(/\./g, '-')}.US`;
export const toVendorCrypto = (sym) => `${String(sym).replace(/-USD\.CC$/i, '').replace(/\.CC$/i, '')}-USD.CC`;

export function isCryptoAsset(asset) {
  if (!asset) return false;
  if (asset.isCrypto === true) return true;
  const sym = String(asset.symbol || '').toUpperCase();
  return VALID_CRYPTO_SYMBOLS.includes(sym) || sym.endsWith('.CC');
}

/**
 * held ∪ bench across active battles, split into stocks and crypto.
 * @param {Array<{portfolio?: object}>} battles
 * @returns {{ stocks: string[], crypto: string[] }}
 */
export function actionableFromBattles(battles) {
  const stocks = new Set();
  const crypto = new Set();
  for (const b of Array.isArray(battles) ? battles : []) {
    const p = b?.portfolio || {};
    const held = [...(p.star || []), ...(p.core || []), ...(p.support || [])];
    const bench = [...(p.bench?.stocks || []), ...(p.bench?.crypto ? [p.bench.crypto] : [])];
    for (const asset of [...held, ...bench]) {
      const sym = typeof asset?.symbol === 'string' ? asset.symbol.trim().toUpperCase() : null;
      if (!sym) continue;
      if (isCryptoAsset(asset)) crypto.add(sym.replace(/-USD\.CC$/i, '').replace(/\.CC$/i, ''));
      else stocks.add(sym);
    }
  }
  return { stocks: [...stocks].sort(), crypto: [...crypto].sort() };
}
