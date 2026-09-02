// api/_utils/axisDerivation.js
//
// Archetype Rank Interface V2 — the axis vocabulary (spec §2,
// docs/specs/ARCHETYPE_RANK_INTERFACE_V2_BUILD_SPEC_V1_3.md). Pure,
// dependency-free, unit-tested (the returnCalculations.js / momentumScoring.js
// helper pattern). Two callers, ONE function:
//   • the producer cron (api/cron/compute-index-intelligence.js, Phase A) calls
//     deriveAxes() on the PERSISTED-SHAPE stock entries and writes the result as
//     each stock's additive `axes` object;
//   • the V2 scorer (archetypeScoringV2.js, Phase B) calls the SAME function on a
//     doc that predates Phase A (the P-8 / R-16 fallback).
// Parity test 12 asserts the two paths are byte-identical after rounding.
//
// Invariants (spec §2):
//   • every field in `axes` is a number in [0, 100] rounded to 1 dp, or null;
//   • deriveAxes consumes ONLY persisted-shape fields — rounded first, derived
//     second (P-10) — so producer and fallback paths cannot disagree;
//   • raw gate fields (return1W, return1M) never live inside `axes`;
//   • nothing is ever imputed: a missing input yields a null axis (R10).
//
// Axis → persisted source → derivation:
//   quality      fundamentalScore (0–100 int, WITHIN-SECTOR — spec §9)  passthrough
//   strength     technicalScore                                          tie-aware percentile (P-9)
//   persistence  momentumScore (0–100 int)                               passthrough
//   volatility   atrPercentile (0–1, 2 dp) gated by techRaw.atrPercent   × 100
//   calm         100 − volatility                                        mirror
//   dislocation  return1M, return3M, sma200_position (signed %, 2 dp)    percentile of a weighted
//                                                                        blend of the three negated percentiles
//   catalyst, sectorStanding                                             reserved — always null in V2

export const AXES_FORMULA_VERSION = 1;

export const AXIS_KEYS = Object.freeze([
  'quality',
  'strength',
  'persistence',
  'volatility',
  'calm',
  'dislocation',
  'catalyst',
  'sectorStanding',
]);

// Dislocation blend (spec §2). More negative return / further below the SMA-200
// = more dislocated, so each term is the percentile of the NEGATED input.
export const DISLOCATION_WEIGHTS = Object.freeze({
  return1M: 0.5,
  return3M: 0.3,
  sma200_position: 0.2,
});

const isFiniteNumber = (v) => typeof v === 'number' && Number.isFinite(v);
const numOrNull = (v) => (isFiniteNumber(v) ? v : null);
const clamp100 = (x) => Math.max(0, Math.min(100, x));

/** Round to 1 dp; normalizes -0 to 0 so a rounded axis never serializes or compares as -0. */
export function round1(x) {
  const r = Math.round(x * 10) / 10;
  return r === 0 ? 0 : r;
}

/**
 * Tie-aware percentile (P-9):
 *   100 × (countBelow + 0.5 × (countEqual − 1)) / (N − 1), N = number of
 *   non-null values; N = 1 → 100.
 * Returns an array aligned with `values` (null where the input is null).
 * UNROUNDED — the caller rounds once, at the axis (the P-10 single-rounding
 * rule), so a percentile-of-percentiles (dislocation) never double-rounds.
 */
export function tieAwarePercentiles(values) {
  const finite = [];
  for (const v of values) if (isFiniteNumber(v)) finite.push(v);
  const n = finite.length;
  if (n === 0) return values.map(() => null);
  const sorted = [...finite].sort((a, b) => a - b);
  // Per distinct value: countBelow = its first index in the sorted array,
  // countEqual = the run length. (Map keys use SameValueZero, so -0 and 0 share a run.)
  const stats = new Map();
  for (let i = 0; i < sorted.length; ) {
    let j = i;
    while (j < sorted.length && sorted[j] === sorted[i]) j++;
    stats.set(sorted[i], { below: i, equal: j - i });
    i = j;
  }
  return values.map((v) => {
    if (!isFiniteNumber(v)) return null;
    if (n === 1) return 100;
    const { below, equal } = stats.get(v);
    return (100 * (below + 0.5 * (equal - 1))) / (n - 1);
  });
}

/**
 * volatility = atrPercentile × 100, honest to the raw ATR (P-10 / V-2):
 *   • techRaw PRESENT with techRaw.atrPercent null ⇒ null — the producer had no
 *     ATR, so the persisted 0.5 is the dead `?? 0.5` fallback, not a measurement;
 *   • techRaw ABSENT (a doc written before Phase A) ⇒ the persisted atrPercentile
 *     is used as-is: the R-16 fallback derives over the full pre-Phase-A doc, and
 *     V-2 established the `?? 0.5` fallback is dead for every retained name
 *     (≥ 50 bars retained vs 15 needed).
 */
function deriveVolatility(stock) {
  const atrPercentile = numOrNull(stock?.atrPercentile);
  if (atrPercentile == null) return null;
  const techRaw = stock?.techRaw;
  if (techRaw != null && typeof techRaw === 'object' && numOrNull(techRaw.atrPercent) == null) return null;
  return clamp100(atrPercentile * 100);
}

/**
 * Derive the `axes` object for every entry of a universe. Pure; does not mutate
 * the input; returns an array aligned with `universe` (axes[i] ↔ universe[i]).
 *
 * Cross-sectional axes (strength, dislocation) are percentiles over THIS input,
 * so the function must be given the FULL universe — the V2 scorer enforces that
 * with the P-8 subset rule; the producer always passes the full rankingStocks.
 *
 * Dislocation pool: only names carrying all three inputs (null if any is null —
 * < 200 bars ⇒ sma200_position null ⇒ null). Each term's percentile is taken
 * over that same complete pool, so the three ranks are commensurable and the
 * outer percentile ranks the blend over the same names.
 */
export function deriveAxes(universe) {
  const stocks = Array.isArray(universe) ? universe : [];

  const strength = tieAwarePercentiles(stocks.map((s) => numOrNull(s?.technicalScore)));

  const disloc = stocks.map((s) => {
    const r1 = numOrNull(s?.return1M);
    const r3 = numOrNull(s?.return3M);
    const sma = numOrNull(s?.sma200_position);
    return r1 != null && r3 != null && sma != null ? { r1, r3, sma } : null;
  });
  const p1 = tieAwarePercentiles(disloc.map((d) => (d ? -d.r1 : null)));
  const p3 = tieAwarePercentiles(disloc.map((d) => (d ? -d.r3 : null)));
  const ps = tieAwarePercentiles(disloc.map((d) => (d ? -d.sma : null)));
  const blend = disloc.map((d, i) => (d
    ? DISLOCATION_WEIGHTS.return1M * p1[i]
      + DISLOCATION_WEIGHTS.return3M * p3[i]
      + DISLOCATION_WEIGHTS.sma200_position * ps[i]
    : null));
  const dislocation = tieAwarePercentiles(blend);

  return stocks.map((s, i) => {
    const quality = numOrNull(s?.fundamentalScore);
    const persistence = numOrNull(s?.momentumScore);
    const volatility = deriveVolatility(s);
    const volatilityRounded = volatility == null ? null : round1(volatility);
    return {
      quality: quality == null ? null : round1(clamp100(quality)),
      strength: strength[i] == null ? null : round1(strength[i]),
      persistence: persistence == null ? null : round1(clamp100(persistence)),
      volatility: volatilityRounded,
      // Mirror of the ROUNDED volatility so calm + volatility === 100 exactly.
      calm: volatilityRounded == null ? null : round1(100 - volatilityRounded),
      dislocation: dislocation[i] == null ? null : round1(dislocation[i]),
      catalyst: null,
      sectorStanding: null,
    };
  });
}

/**
 * Doc-level `universe_median_return1W` (P-13): the median of the universe's
 * non-null return1W values (signed percent). Median convention = the repo's
 * (compute-rankings.js:97 / compute-index-intelligence.js:395): sorted
 * ascending, upper-middle element; null on an empty set. Written by Phase A and
 * read by the Contrarian week floor — never recomputed on a subset (§3.1).
 */
export function computeUniverseMedianReturn1W(universe) {
  const vals = [];
  for (const s of Array.isArray(universe) ? universe : []) {
    const v = numOrNull(s?.return1W);
    if (v != null) vals.push(v);
  }
  if (vals.length === 0) return null;
  vals.sort((a, b) => a - b);
  return vals[Math.floor(vals.length / 2)];
}

/** Per-axis null counts over an axes list (snapshot + coverage-event input). */
export function countAxisNulls(axesList) {
  const counts = {};
  for (const key of AXIS_KEYS) counts[key] = 0;
  for (const axes of Array.isArray(axesList) ? axesList : []) {
    for (const key of AXIS_KEYS) if (axes?.[key] == null) counts[key] += 1;
  }
  return counts;
}
