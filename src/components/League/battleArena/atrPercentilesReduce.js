// src/components/League/battleArena/atrPercentilesReduce.js
//
// Phase 2.5 — the PURE reduction of the stockRankings doc to {SYMBOL: atrPercentile},
// split out of useAtrPercentiles so it stays node-clean and unit-testable (the hook
// itself carries the firebase read and can't load in Node). Mirrors the server's
// loadAtrPercentiles reduction (tournamentUserScoring.js:70-76) — same uppercase
// keying, same null-on-non-array — so the client and banking agree on the doc shape.

/**
 * Reduce a stockRankings doc's data to {SYMBOL: atrPercentile}. Null when the doc
 * has no usable `stocks` array (→ the caller falls back to the port-contract ATR,
 * matching banking's own null path). Symbols are trimmed + upper-cased, exactly as
 * loadAtrPercentiles / resolveBaseATR key them.
 * @param {Object|null|undefined} data - the stockRankings doc data
 * @returns {Object<string, number>|null}
 */
export function reduceRankingsToPercentiles(data) {
  const stocks = Array.isArray(data?.stocks) ? data.stocks : null;
  if (!stocks) return null;
  const map = {};
  for (const s of stocks) {
    const sym = typeof s?.symbol === 'string' ? s.symbol.trim().toUpperCase() : '';
    if (sym) map[sym] = s.atrPercentile;
  }
  return map;
}
