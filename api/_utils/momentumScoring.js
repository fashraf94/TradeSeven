/**
 * Momentum Scoring — Phase 1 Foundation Metrics + Normalization Pipeline
 *
 * Pure-math module for computing the Momentum Rank: a dedicated ranking
 * dimension alongside Composite/Fundamental/Technical/BaggerBomb that measures
 * trend persistence, path quality, and acceleration.
 *
 * Zero mathematical overlap with Technical Score (no MACD/RSI/SMA/raw RS).
 *
 * All OHLCV arrays are assumed **newest-first** (index 0 = most recent),
 * matching the convention used throughout compute-index-intelligence.js after
 * its EODHD reversal.
 *
 * All functions are pure — no API calls, no Firestore access.
 *
 * Phase 1 metrics:
 *   1. Information Discreteness (FIP) — "Frog-in-the-Pan" momentum quality
 *   2. Kaufman Efficiency Ratio (KER) — path smoothness
 *   3. Momentum Acceleration — 1W vs 1M ROC comparison
 *   4. Turnover-Weighted Short-Term Momentum — volume-conditioned 1M return
 *
 * Phase 2 will add Residual Momentum + Intermediate RS and re-weight.
 */

// ---------------------------------------------------------------------------
// Weights (TEMPORARY — Phase 1 equal weighting across 4 metrics)
// Phase 2 will replace with the final 6-metric formula.
// ---------------------------------------------------------------------------

export const MOMENTUM_WEIGHTS = {
  fip: 0.25,
  ker: 0.25,
  acceleration: 0.25,
  turnoverMom: 0.25,
};

// ---------------------------------------------------------------------------
// Raw metric computations (per-stock, pure)
// ---------------------------------------------------------------------------

/**
 * Information Discreteness ("Frog-in-the-Pan").
 *
 * Measures whether cumulative momentum was delivered in small steady daily
 * increments (high-quality, continuation-prone) or a few big discrete jumps
 * (low-quality, reversal-prone).
 *
 * Skip-day convention: starts from T-1 (index 1) to avoid microstructure
 * reversal contamination at T-0.
 *
 * Returns the INVERTED score (higher = better quality), i.e. -ID.
 *
 * @param {number[]} closes - Daily closes, newest-first
 * @param {number} lookback - Number of trading days (default 60)
 * @returns {number|null} - Inverted ID or null if insufficient data
 */
export function computeInformationDiscreteness(closes, lookback = 60) {
  if (!Array.isArray(closes) || closes.length < lookback + 2) return null;

  const start = closes[1];
  const end = closes[lookback];
  if (!start || !end) return null;

  const pret = (start / end) - 1;

  let positiveDays = 0;
  let negativeDays = 0;
  for (let i = 1; i < lookback; i++) {
    // Array is newest-first: closes[i] is the day AFTER closes[i+1].
    if (closes[i] > closes[i + 1]) positiveDays++;
    else if (closes[i] < closes[i + 1]) negativeDays++;
  }

  const total = lookback - 1;
  const pctP = positiveDays / total;
  const pctN = negativeDays / total;

  const id = Math.sign(pret) * (pctN - pctP);
  return -id; // invert so higher = better quality
}

/**
 * Kaufman Efficiency Ratio.
 *
 * KER ≈ 1.0 → near-perfectly straight trend over the window.
 * KER ≈ 0   → pure chop (net movement dwarfed by path length).
 *
 * @param {number[]} closes - Daily closes, newest-first
 * @param {number} lookback - Number of trading days (default 20)
 * @returns {number|null}
 */
export function computeKER(closes, lookback = 20) {
  if (!Array.isArray(closes) || closes.length < lookback + 2) return null;

  const direction = Math.abs(closes[1] - closes[lookback]);

  let volatility = 0;
  for (let i = 1; i < lookback; i++) {
    volatility += Math.abs(closes[i] - closes[i + 1]);
  }

  if (volatility === 0) return null;
  return direction / volatility;
}

/**
 * Momentum Acceleration (1-week vs 1-month ROC).
 *
 * Positive = trend steepening, negative = trend fading.
 * Normalizes the 21-day ROC down to a 5-day-equivalent before subtracting
 * so the two horizons are directly comparable.
 *
 * @param {number[]} closes - Daily closes, newest-first
 * @returns {number|null}
 */
export function computeAcceleration(closes) {
  if (!Array.isArray(closes) || closes.length < 23) return null;

  const c1 = closes[1];
  const c6 = closes[6];
  const c22 = closes[22];
  if (!c6 || !c22) return null;

  const roc5 = (c1 - c6) / c6;
  const roc21 = (c1 - c22) / c22;

  // Explicit parentheses for clarity even though JS precedence handles it.
  return roc5 - (roc21 / 4);
}

/**
 * Turnover-Weighted Short-Term Momentum.
 *
 * 1-month return conditioned on trading volume. High-turnover + positive
 * return is a continuation signal; low-turnover + positive return is a
 * reversal risk.
 *
 * @param {number[]} closes - Daily closes, newest-first
 * @param {number} avgVolumePercentile - Pre-computed 0..1 percentile of the
 *   stock's 21-day avg volume across the universe
 * @returns {number|null}
 */
export function computeTurnoverMomentum(closes, avgVolumePercentile) {
  if (!Array.isArray(closes) || closes.length < 23) return null;
  if (avgVolumePercentile == null) return null;

  const c1 = closes[1];
  const c22 = closes[22];
  if (!c22) return null;

  const return21d = (c1 - c22) / c22;
  return return21d * avgVolumePercentile;
}

// ---------------------------------------------------------------------------
// Normalization pipeline
// ---------------------------------------------------------------------------

/**
 * Cross-sectional Z-score with winsorization at ±3.0.
 * Preserves nulls in the output (null in → null out).
 *
 * @param {Array<number|null>} values
 * @returns {Array<number|null>}
 */
export function zScoreWinsorize(values) {
  const valid = values.filter(v => v != null && Number.isFinite(v));
  if (valid.length === 0) return values.map(() => null);

  const mean = valid.reduce((a, b) => a + b, 0) / valid.length;
  const variance = valid.reduce((acc, v) => acc + (v - mean) ** 2, 0) / valid.length;
  const std = Math.sqrt(variance);

  if (std === 0) {
    // All stocks have identical value → no cross-sectional signal.
    return values.map(v => (v == null || !Number.isFinite(v) ? null : 0));
  }

  return values.map(v => {
    if (v == null || !Number.isFinite(v)) return null;
    const z = (v - mean) / std;
    return Math.max(-3, Math.min(3, z));
  });
}

/**
 * Percentile rank an array of scores to a 0-100 integer scale.
 * Null entries stay null (distinguishes "insufficient data" from "ranked last").
 *
 * @param {Array<number|null>} scores
 * @returns {Array<number|null>}
 */
export function percentileRank(scores) {
  const indexed = scores
    .map((v, i) => ({ v, i }))
    .filter(({ v }) => v != null && Number.isFinite(v));

  const n = indexed.length;
  const out = new Array(scores.length).fill(null);
  if (n === 0) return out;

  indexed.sort((a, b) => a.v - b.v);
  indexed.forEach(({ i }, idx) => {
    out[i] = n > 1 ? Math.round((idx / (n - 1)) * 100) : 50;
  });

  return out;
}

// ---------------------------------------------------------------------------
// Master: compute full-universe Momentum Rank (Phase 1)
// ---------------------------------------------------------------------------

/**
 * Compute Phase 1 Momentum Rank for the full stock universe.
 *
 * @param {Array<{symbol: string, closes: number[], volumes: number[]}>} stockDataArray
 * @returns {Array<{
 *   symbol: string,
 *   momentumScore: number|null,
 *   momentumRank: number|null,
 *   momentumFactors: { fip: number|null, ker: number|null, acceleration: number|null, turnoverMom: number|null }
 * }>}
 */
export function computeMomentumRankings(stockDataArray) {
  const n = stockDataArray.length;

  // Step 1: 21-day avg volume per stock (uses skip-day convention).
  const avgVolumes = stockDataArray.map(s => {
    if (!Array.isArray(s.volumes) || s.volumes.length < 22) return null;
    const window = s.volumes.slice(1, 22);
    const sum = window.reduce((a, b) => a + (b || 0), 0);
    return sum / window.length;
  });

  // Step 2: percentile-rank avg volume across the universe → 0..1 scale.
  const avgVolPctRank100 = percentileRank(avgVolumes);
  const avgVolPct = avgVolPctRank100.map(p => (p == null ? null : p / 100));

  // Step 3: raw metrics per stock.
  const rawFip = new Array(n).fill(null);
  const rawKer = new Array(n).fill(null);
  const rawAccel = new Array(n).fill(null);
  const rawTurnover = new Array(n).fill(null);

  for (let i = 0; i < n; i++) {
    const { closes } = stockDataArray[i];
    rawFip[i] = computeInformationDiscreteness(closes, 60);
    rawKer[i] = computeKER(closes, 20);
    rawAccel[i] = computeAcceleration(closes);
    rawTurnover[i] = computeTurnoverMomentum(closes, avgVolPct[i]);
  }

  // Step 4: z-score + winsorize each metric column independently.
  const zFip = zScoreWinsorize(rawFip);
  const zKer = zScoreWinsorize(rawKer);
  const zAccel = zScoreWinsorize(rawAccel);
  const zTurnover = zScoreWinsorize(rawTurnover);

  // Step 5: weighted composite with null-aware reweighting.
  const bmz = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    const parts = [
      { z: zFip[i], w: MOMENTUM_WEIGHTS.fip },
      { z: zKer[i], w: MOMENTUM_WEIGHTS.ker },
      { z: zAccel[i], w: MOMENTUM_WEIGHTS.acceleration },
      { z: zTurnover[i], w: MOMENTUM_WEIGHTS.turnoverMom },
    ].filter(p => p.z != null);

    if (parts.length === 0) {
      bmz[i] = null;
      continue;
    }

    const totalW = parts.reduce((a, p) => a + p.w, 0);
    bmz[i] = parts.reduce((acc, p) => acc + p.z * (p.w / totalW), 0);
  }

  // Step 6: percentile-rank composites to 0..100.
  const ranks = percentileRank(bmz);

  // Assemble output.
  return stockDataArray.map((s, i) => ({
    symbol: s.symbol,
    momentumScore: bmz[i] != null ? Math.round(bmz[i] * 1000) / 1000 : null,
    momentumRank: ranks[i],
    momentumFactors: {
      fip: zFip[i] != null ? Math.round(zFip[i] * 1000) / 1000 : null,
      ker: zKer[i] != null ? Math.round(zKer[i] * 1000) / 1000 : null,
      acceleration: zAccel[i] != null ? Math.round(zAccel[i] * 1000) / 1000 : null,
      turnoverMom: zTurnover[i] != null ? Math.round(zTurnover[i] * 1000) / 1000 : null,
    },
  }));
}
