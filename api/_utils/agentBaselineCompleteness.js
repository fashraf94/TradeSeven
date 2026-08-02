// api/_utils/agentBaselineCompleteness.js
//
// Containment — DEPLOY-TIME baseline completeness gate for agent battles.
//
// An agent battle must not be created ACTIVE unless every required held-position
// symbol (the scored star/core/support picks on both sides — the same set the
// agent-evaluate M1 quote guard protects) has a complete, usable, non-fallback
// validated starting-price baseline. A wrong-but-positive baseline (a glitched
// or stale close read only a few % off) fabricates Bust/Crash/Meltdown badges on
// a near-flat ticker — the exact hazard baselineValidation.js guards against —
// and an EODHD credential rotation is precisely when such degraded reads spike.
//
// These pure helpers decide usability from the ALREADY-computed validation
// result (decide.js's fetchValidatedStartingPrices output + the set of symbols
// whose price object was a real-time fallback). They NEVER fetch market data.
//
// A required symbol's baseline is UNUSABLE when it is:
//   - missing            — Guard-1 omitted it (fetch/auth failure, no current
//                          price, or an out-of-range read with no sane close to
//                          substitute) so there is no key in startingPrices;
//   - non-finite / non-positive — NaN, Infinity, <= 0, or a non-number;
//   - fallback-derived   — real-time was unavailable and the value came from a
//                          daily close (fallback:true). A stale cached close can
//                          pass Guard-1 (current === recentClose → 0 ATR error),
//                          so it is rejected here for the pre-rotation window.

/**
 * A starting-price baseline is usable only if it is a finite, strictly-positive
 * number. (Zero, negative, NaN, Infinity, and non-numbers are all rejected.)
 *
 * @param {*} price
 * @returns {boolean}
 */
export function isUsableBaseline(price) {
  return typeof price === 'number' && Number.isFinite(price) && price > 0;
}

/**
 * Assess whether every required held-position symbol has a complete, usable,
 * non-fallback validated baseline. Any required symbol that is missing, unusable,
 * or fallback-derived makes the set incomplete. An empty required set is
 * vacuously complete (nothing to protect).
 *
 * @param {string[]} requiredSymbols - held-position symbols that get scored
 * @param {Object<string, number>} startingPrices - decide.js validated baselines
 * @param {Set<string>|string[]} [fallbackSymbols] - symbols whose price object was
 *   a real-time fallback (fallback:true), so their baseline is not a live quote
 * @returns {{ complete: boolean, requiredCount: number, usableCount: number, missing: string[] }}
 */
export function assessRequiredBaselines(requiredSymbols, startingPrices, fallbackSymbols) {
  const required = Array.isArray(requiredSymbols)
    ? [...new Set(requiredSymbols.filter(Boolean))]
    : [];
  const prices = startingPrices || {};
  const fb = fallbackSymbols instanceof Set
    ? fallbackSymbols
    : new Set(Array.isArray(fallbackSymbols) ? fallbackSymbols : []);

  const missing = required.filter(
    (sym) => !isUsableBaseline(prices[sym]) || fb.has(sym),
  );

  return {
    complete: missing.length === 0,
    requiredCount: required.length,
    usableCount: required.length - missing.length,
    missing,
  };
}
