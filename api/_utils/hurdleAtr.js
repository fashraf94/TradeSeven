// api/_utils/hurdleAtr.js
// Knob Calibration Task A — narrow hurdle-only ATR freshening.
//
// Pure re-derivation of a position's ATR volatility unit from the FRESH hourly
// rankings (Option B, compute-index-intelligence.js `?mode=intraday`), for use
// ONLY as the clearsHurdleFloor divisor (`userATR`). It deliberately does NOT
// touch the stored asset.baseATR, scoring.thresholds, badges, guardrails, or the
// banked score of record — those stay frozen. Per the A0/B0 discovery report,
// baseATR is the master scoring divisor, so a full held-position rescore is its
// own post-launch workstream; this helper refreshes ONLY the hurdle's own divisor.
//
// SINGLE SOURCE OF TRUTH (drift rider a): imported by BOTH the cron hurdle call
// sites (api/cron/agent-evaluate.js) AND the B2 calibration replay harness, so the
// two can never diverge. Mirrors the 8x mapping used everywhere baseATR is derived
// from a ranking's atrPercentile: tournamentUserScoring.js:99
// (resolveBaseATR = atrPercentile * 8), agent-evaluate.js:874, decide.js:934.
//
// Pure: no I/O, no Firestore, no clock, no randomness. This is NOT a fenced file.

// atrPercentile (0..1) → baseATR (percent). The one canonical mapping.
export const ATR_PERCENTILE_TO_BASEATR = 8;

// Derive a baseATR from a ranking's atrPercentile, or null if the input is not a
// usable non-negative finite number. (0 is derivable but not usable as a divisor;
// the > 0 gate lives in resolveHurdleAtr.)
export function atrFromPercentile(atrPercentile) {
  if (typeof atrPercentile !== 'number' || !Number.isFinite(atrPercentile) || atrPercentile < 0) return null;
  return atrPercentile * ATR_PERCENTILE_TO_BASEATR;
}

// Build a Map<symbol, atrPercentile> from the fresh stockRankings array (the cron
// already loads this each tick as `stockRankingsArray`). Skips malformed entries.
export function buildFreshAtrPercentileMap(stockRankingsArray) {
  const map = new Map();
  if (!Array.isArray(stockRankingsArray)) return map;
  for (const s of stockRankingsArray) {
    if (s && typeof s.symbol === 'string' && typeof s.atrPercentile === 'number') {
      map.set(s.symbol, s.atrPercentile);
    }
  }
  return map;
}

// Resolve the ATR the hurdle floor should divide by for `symbol`:
//   - symbol present in the fresh rankings with a positive derived ATR → fresh
//   - otherwise → the caller's frozen fallback, returned VERBATIM so behavior is
//     byte-identical to the pre-fix path whenever no fresh value exists.
// Returns { atr, source: 'fresh' | 'frozen' }. The `source` lets the B2 harness
// quantify the fresh-vs-frozen shift offline (live receipts are unchanged by design).
export function resolveHurdleAtr(symbol, freshAtrPercentileMap, frozenBaseATR) {
  const pct = freshAtrPercentileMap instanceof Map ? freshAtrPercentileMap.get(symbol) : undefined;
  const fresh = atrFromPercentile(pct);
  if (fresh != null && fresh > 0) return { atr: fresh, source: 'fresh' };
  return { atr: frozenBaseATR, source: 'frozen' };
}
