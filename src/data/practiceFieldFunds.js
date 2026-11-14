// src/data/practiceFieldFunds.js
//
// The funds an idea book may hold in a comparison ledger or as its SPY context line (concept V6.1 §4; Astra V5 A1:
// "an ETF needs an explicit friction classification rather than an unexplained fallback to the stock market-cap
// tiers"). DATA ONLY, ZERO IMPORTS, versioned. A fund is never an idea's NAME: it is bought only in a comparison or
// benchmark ledger, which is paper beside the book and never part of its portfolio.
//
// `represents` is a sector in the MANDATE's own sector vocabulary (api/_utils/mandateCandidateUniverse.js:
// "Health Care", not the house universe's "Healthcare"), or 'broad_market'. practiceFieldFunds.test.js binds every
// value to that vocabulary and each sector fund to the house universe's own fund for the same sector.
//
// `frictionTier` names a tier in PRACTICE_FIELD_FUND_FRICTION_TIERS. Its basis-point values are the friction
// model's LOWEST-COST tier's (mandateConfig.js MANDATE_FRICTION_TIERS.mega at model version 'p3_cap_tier_v1'),
// restated here because this file has no imports and bound to the model by the same test. A fund never prices
// through the market-cap fallback (a fund has no market cap in the daily layer, so the fallback would charge it the
// WIDEST tier).

export const PRACTICE_FIELD_FUNDS_VERSION = 1;

/** The friction model version the tier values below were read from. */
export const PRACTICE_FIELD_FUND_FRICTION_MODEL_VERSION = 'p3_cap_tier_v1';

export const PRACTICE_FIELD_FUND_FRICTION_TIERS = Object.freeze({
  liquid_fund: Object.freeze({ slippageBps: 1, spreadProxyBps: 2 }),
});

const fund = (represents) => Object.freeze({ assetClass: 'etf', represents, frictionTier: 'liquid_fund' });

export const PRACTICE_FIELD_BROAD_MARKET = 'broad_market';

/** The benchmark every idea carries as its second line. */
export const PRACTICE_FIELD_BENCHMARK_SYMBOL = 'SPY';

export const PRACTICE_FIELD_FUNDS = Object.freeze({
  SPY: fund(PRACTICE_FIELD_BROAD_MARKET),
  QQQ: fund(PRACTICE_FIELD_BROAD_MARKET),
  DIA: fund(PRACTICE_FIELD_BROAD_MARKET),
  IWM: fund(PRACTICE_FIELD_BROAD_MARKET),
  XLK: fund('Technology'),
  XLF: fund('Financials'),
  XLV: fund('Health Care'),
  XLY: fund('Consumer Discretionary'),
  XLP: fund('Consumer Staples'),
  XLE: fund('Energy'),
  XLI: fund('Industrials'),
  XLB: fund('Materials'),
  XLU: fund('Utilities'),
  XLRE: fund('Real Estate'),
  XLC: fund('Communication Services'),
});
