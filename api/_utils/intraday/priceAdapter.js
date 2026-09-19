// api/_utils/intraday/priceAdapter.js
//
// Intraday Data — Build 1, contract §8.5: the price adapter, BUILT NOW, with
// NO consumer until INTRADAY_PRICE_SOURCE !== 'legacy' (stage 3). Maps the
// snapshot's price facts to the legacy shape `fetchRealTimePrice` produces
// (marketDataCache.js:749-758), which the evaluator, the quote-health guard
// (`current`, `fallback`), the scorer and the evidence stamp all read.
//
//   { current, previousClose, change, changePercent, high, low, volume,
//     timestamp, priceAsOf, source, fallback: false }
//
// `timestamp` keeps the legacy UNIT — vendor seconds — because that is what
// `price.timestamp` carries today (canonicalOpen.js / mandateUniverseSnapshot.js
// read it as seconds); `priceAsOf` is the epoch-ms instant beside it. PURE.

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/** Every field of the legacy price object, in the order fetchRealTimePrice assigns them, plus the three this adapter adds. */
export const LEGACY_PRICE_FIELDS = Object.freeze([
  'current', 'previousClose', 'change', 'changePercent', 'high', 'low', 'volume', 'timestamp', 'priceAsOf', 'source', 'fallback',
]);

/**
 * @param {object} symbolFacts the §8.2 symbol record (price + indicators)
 * @returns {object|null} null when there is no finite price (never a 0 — the
 *   legacy `current: data.close || data.previousClose || 0` coalescing is the
 *   settlement hazard agentQuoteHealth exists for; this adapter never invents one)
 */
export function toLegacyPriceShape(symbolFacts) {
  const p = symbolFacts?.price;
  if (!p || !isNum(p.value) || p.value <= 0) return null;
  const hl = symbolFacts.indicators?.sessionHL?.value || null;
  const vol = symbolFacts.indicators?.volume;
  return {
    current: p.value,
    previousClose: isNum(p.previousClose) ? p.previousClose : null,
    change: isNum(p.change) ? p.change : null,
    changePercent: isNum(p.changePercent) ? p.changePercent : null,
    high: hl && isNum(hl.high) ? hl.high : null,
    low: hl && isNum(hl.low) ? hl.low : null,
    volume: vol && vol.status === 'ready' && isNum(vol.value) ? vol.value : null,
    timestamp: isNum(p.priceAsOf) ? Math.floor(p.priceAsOf / 1000) : null,
    priceAsOf: isNum(p.priceAsOf) ? p.priceAsOf : null,
    source: symbolFacts.source ?? null,
    fallback: false,
  };
}
