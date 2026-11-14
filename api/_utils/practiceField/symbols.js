// api/_utils/practiceField/symbols.js
//
// Practice Field T1a-1 — what a symbol IS to an idea book: a universe stock (an idea's name, or a frozen-basket
// member), a fund (a comparison or the SPY line, never a name), or neither. Pure.
//
//   • STOCKS come from the house universe (api/_utils/rankingConfig.js ALL_TICKERS, 228 names; a retired stock is
//     refused). A stock's SECTOR is read through the one bridge (src/data/practiceFieldSectorBridge.js) into the
//     Mandate's sector vocabulary — for the admission-time sector cap AND for the sector stamped on a position at
//     entry, so existing exposure and a new idea are always summed in one vocabulary (the daily layer's
//     fundamentals sector is a third vocabulary and is never used by an idea book).
//   • FUNDS come from src/data/practiceFieldFunds.js. A fund's friction is its explicit named tier, never the
//     market-cap fallback (a fund has no market cap in the daily layer; the fallback would charge the widest tier).

import {
  ALL_TICKERS, STOCK_UNIVERSE, TICKER_TO_SECTOR, TICKER_TO_TYPE, isRetiredStock,
} from '../rankingConfig.js';
import { frictionFor } from '../mandateFrictionModel.js';
import {
  PRACTICE_FIELD_FUNDS, PRACTICE_FIELD_FUND_FRICTION_TIERS, PRACTICE_FIELD_BROAD_MARKET,
} from '../../../src/data/practiceFieldFunds.js';
import { PRACTICE_FIELD_SECTOR_BRIDGE } from '../../../src/data/practiceFieldSectorBridge.js';

const UNIVERSE = new Set(ALL_TICKERS);

/** Canonical symbol: trimmed, upper case. Null for anything that is not a non-empty string. */
export function normSymbol(raw) {
  if (typeof raw !== 'string') return null;
  const s = raw.trim().toUpperCase();
  return s.length > 0 ? s : null;
}

/** Is `symbol` (canonical) a pickable stock of the house universe? */
export function isUniverseStock(symbol) {
  return UNIVERSE.has(symbol) && TICKER_TO_TYPE[symbol] === 'stock' && !isRetiredStock(symbol);
}

/** The fund record for `symbol`, or null. */
export function fundOf(symbol) {
  return Object.hasOwn(PRACTICE_FIELD_FUNDS, symbol) ? PRACTICE_FIELD_FUNDS[symbol] : null;
}

/** Is `symbol` any exchange-traded fund the platform knows (a Practice Field fund, a sector or an industry ETF)? */
export function isFundSymbol(symbol) {
  return fundOf(symbol) !== null || TICKER_TO_TYPE[symbol] === 'sector_etf' || TICKER_TO_TYPE[symbol] === 'industry_etf';
}

/**
 * A universe stock's sector in the MANDATE vocabulary, through the bridge; null when the stock is unknown or its
 * house sector has no bridge entry (admission then refuses — never a guess).
 */
export function mandateSectorOf(symbol) {
  if (!isUniverseStock(symbol)) return null;
  const houseName = STOCK_UNIVERSE[TICKER_TO_SECTOR[symbol]]?.name ?? null;
  if (houseName === null) return null;
  return Object.hasOwn(PRACTICE_FIELD_SECTOR_BRIDGE, houseName) ? PRACTICE_FIELD_SECTOR_BRIDGE[houseName] : null;
}

/** The sector a held symbol counts under in an idea book: a stock's bridged sector; a fund's `represents`. */
export function classificationOf(symbol) {
  const fund = fundOf(symbol);
  if (fund) return fund.represents;
  return mandateSectorOf(symbol);
}

/**
 * The friction for one fill of `symbol` at `snapshot`: a fund's explicit tier; a stock's market-cap tier from the
 * snapshot (the engine's model, widest tier when the cap is unknown). `capTier` names what applied.
 */
export function frictionForSymbol(symbol, snapshot) {
  const fund = fundOf(symbol);
  if (fund) {
    const tier = PRACTICE_FIELD_FUND_FRICTION_TIERS[fund.frictionTier];
    return { slippageBps: tier.slippageBps, spreadProxyBps: tier.spreadProxyBps, capTier: `fund:${fund.frictionTier}` };
  }
  return frictionFor(symbol, snapshot);
}

/**
 * The static classifications the daily snapshot layer uses for funds INSTEAD of a fundamentals fetch (build prompt
 * §5): sector = what the fund represents, no market cap. Keyed by symbol.
 */
export function fundStaticClassifications() {
  const out = {};
  for (const [symbol, fund] of Object.entries(PRACTICE_FIELD_FUNDS)) {
    out[symbol] = { sector: fund.represents, industry: fund.assetClass, marketCap: null };
  }
  return out;
}

export { PRACTICE_FIELD_BROAD_MARKET };
