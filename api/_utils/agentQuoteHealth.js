// api/_utils/agentQuoteHealth.js
//
// Containment M1 — settlement-safety quote validation for the agent evaluation
// cron (api/cron/agent-evaluate.js). An unusable quote set (provider/auth
// failure, or missing / zero / NaN / synthetic-fallback prices) must NEVER be
// converted into flat 0% active/current scores, and must not advance
// settlement-sensitive state. These pure helpers decide usability; the cron
// uses them to skip a battle's tick and preserve its prior scoreState.
//
// Extracted as a standalone module (like agentCronState.js / buildTechnical
// Snapshot.js) so the decision logic is unit-tested directly, without importing
// the monolithic handler.

/**
 * A quote is usable for settlement-sensitive scoring only if it exists, is not
 * a synthetic/stale fallback (marketDataCache marks its real-time-fallback
 * price object with `fallback: true`), and carries a finite, strictly-positive
 * `current` price.
 *
 * @param {{ current?: number, fallback?: boolean }|null|undefined} quote
 * @returns {boolean}
 */
export function isSettlementQuoteUsable(quote) {
  return !!quote
    && quote.fallback !== true
    && typeof quote.current === 'number'
    && Number.isFinite(quote.current)
    && quote.current > 0;
}

/**
 * Assess whether every required (held-position) symbol has a usable quote.
 * Settlement-sensitive writes prefer all-required-symbol completeness: any
 * missing or unusable required quote makes the whole set unusable. An empty
 * required set is vacuously usable (nothing to protect).
 *
 * @param {string[]} requiredSymbols - held-position symbols whose scores get written
 * @param {Object<string, {current?: number, fallback?: boolean}>} prices
 * @returns {{ usable: boolean, requiredCount: number, usableCount: number, missing: string[] }}
 */
export function assessRequiredQuotes(requiredSymbols, prices) {
  const required = Array.isArray(requiredSymbols)
    ? [...new Set(requiredSymbols.filter(Boolean))]
    : [];
  const priceMap = prices || {};
  const missing = required.filter(sym => !isSettlementQuoteUsable(priceMap[sym]));
  return {
    usable: missing.length === 0,
    requiredCount: required.length,
    usableCount: required.length - missing.length,
    missing,
  };
}
