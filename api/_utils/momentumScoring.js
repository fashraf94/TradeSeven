/**
 * Momentum Scoring — Phase 2: Full 6-Metric Engine + Sub-Pillars
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
 * Six metrics grouped into three sub-pillars:
 *   Stability (35%):
 *     1. Residual Momentum (20%)    — beta-neutral firm-specific alpha
 *     2. Intermediate RS   (15%)    — 6-month excess return, skip last month
 *   Heat (30%):
 *     3. Acceleration      (15%)    — 1W vs 1M ROC comparison
 *     4. Turnover Momentum (15%)    — volume-conditioned 1M return
 *   Quality (35%):
 *     5. Information Discreteness (20%) — Frog-in-the-Pan
 *     6. Kaufman Efficiency Ratio (15%) — path smoothness
 */

// ---------------------------------------------------------------------------
// Weights — final 6-metric formula (sum = 1.0)
// ---------------------------------------------------------------------------

export const MOMENTUM_WEIGHTS = {
  residualMomentum: 0.20,
  intermediateRS:   0.15,
  acceleration:     0.15,
  turnoverMom:      0.15,
  fip:              0.20,
  ker:              0.15,
};

// Sub-pillar groupings. Each pillar's totalWeight equals the sum of its
// member metric weights in MOMENTUM_WEIGHTS and is used to normalize the
// within-pillar weighted average.
export const SUB_PILLARS = {
  stability: { metrics: ['residualMomentum', 'intermediateRS'], totalWeight: 0.35 },
  heat:      { metrics: ['acceleration', 'turnoverMom'],        totalWeight: 0.30 },
  quality:   { metrics: ['fip', 'ker'],                         totalWeight: 0.35 },
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

/**
 * Residual Momentum (beta-neutral).
 *
 * Regresses daily stock log-returns against SPY log-returns over the lookback
 * window, then sums the residuals and standardizes by their stddev. Isolates
 * firm-specific momentum from market beta so stocks that "rode the SPY wave"
 * don't score highly here.
 *
 * Skip-day convention: window is indices 1..lookback (excludes T-0).
 *
 * @param {number[]} stockCloses - Stock closes, newest-first
 * @param {number[]} spyCloses - SPY closes, newest-first (same date alignment)
 * @param {number} lookback - Regression window in trading days (default 90)
 * @returns {number|null} - Standardized residual sum, or null if insufficient data
 */
export function computeResidualMomentum(stockCloses, spyCloses, lookback = 90) {
  if (!Array.isArray(stockCloses) || !Array.isArray(spyCloses)) return null;
  if (stockCloses.length < lookback + 2 || spyCloses.length < lookback + 2) return null;

  // Build daily log returns for i = 1..lookback.
  const stockReturns = new Array(lookback);
  const spyReturns = new Array(lookback);
  for (let i = 1; i <= lookback; i++) {
    const s0 = stockCloses[i];
    const s1 = stockCloses[i + 1];
    const m0 = spyCloses[i];
    const m1 = spyCloses[i + 1];
    if (!s0 || !s1 || !m0 || !m1) return null;
    stockReturns[i - 1] = Math.log(s0 / s1);
    spyReturns[i - 1] = Math.log(m0 / m1);
  }

  // Means
  const n = lookback;
  let sumS = 0;
  let sumM = 0;
  for (let i = 0; i < n; i++) {
    sumS += stockReturns[i];
    sumM += spyReturns[i];
  }
  const meanS = sumS / n;
  const meanM = sumM / n;

  // Covariance and variance of SPY returns
  let cov = 0;
  let varM = 0;
  for (let i = 0; i < n; i++) {
    const dS = stockReturns[i] - meanS;
    const dM = spyReturns[i] - meanM;
    cov += dS * dM;
    varM += dM * dM;
  }
  cov /= n;
  varM /= n;

  if (varM === 0) return null;
  const beta = cov / varM;

  // Residuals: the portion of stock return not explained by SPY.
  // Using the classical OLS residual form (includes alpha implicitly via mean-centering
  // when we sum the residuals — the sum reflects both alpha*N and idiosyncratic drift).
  const residuals = new Array(n);
  let resSum = 0;
  for (let i = 0; i < n; i++) {
    const r = stockReturns[i] - beta * spyReturns[i];
    residuals[i] = r;
    resSum += r;
  }

  // Standardize by residual stddev.
  const meanR = resSum / n;
  let varR = 0;
  for (let i = 0; i < n; i++) {
    const d = residuals[i] - meanR;
    varR += d * d;
  }
  varR /= n;
  const stdR = Math.sqrt(varR);

  if (stdR === 0) return null;
  return resSum / stdR;
}

/**
 * Intermediate Relative Strength (RS_126_21).
 *
 * Stock's excess return vs SPY over roughly 6 months (126 trading days),
 * skipping the most recent month (21 days) to avoid short-term reversal
 * contamination. The classic institutional trend anchor.
 *
 * @param {number[]} stockCloses - Stock closes, newest-first
 * @param {number[]} spyCloses - SPY closes, newest-first
 * @returns {number|null}
 */
export function computeIntermediateRS(stockCloses, spyCloses) {
  if (!Array.isArray(stockCloses) || !Array.isArray(spyCloses)) return null;
  if (stockCloses.length < 127 || spyCloses.length < 127) return null;

  const sNow = stockCloses[21];
  const sThen = stockCloses[126];
  const mNow = spyCloses[21];
  const mThen = spyCloses[126];
  if (!sNow || !sThen || !mNow || !mThen) return null;

  const stockReturn = (sNow / sThen) - 1;
  const spyReturn = (mNow / mThen) - 1;
  return stockReturn - spyReturn;
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
// Master: compute full-universe Momentum Rank (Phase 2 — 6 metrics)
// ---------------------------------------------------------------------------

const ROUND3 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 1000) / 1000);

// ---------------------------------------------------------------------------
// Risk-guardrail overlays (Phase 3)
//
// Applied to the 6-metric composite Z (BMZ) AFTER weighting but BEFORE
// percentile ranking. They reshape the final order without touching the raw
// per-metric Z columns, so sub-pillar scores (Stability/Heat/Quality) remain
// based on the pre-overlay signal.
// ---------------------------------------------------------------------------

/**
 * Overextension penalty — Bollinger-style z-score of current price vs 20-day
 * SMA/stddev (skip-day). Penalty kicks in above +2.5σ.
 *
 * @param {number[]} closes - newest-first
 * @returns {number} non-negative penalty (subtracted from BMZ)
 */
function computeOverextensionPenalty(closes) {
  if (!Array.isArray(closes) || closes.length < 22) return 0;
  const window = closes.slice(1, 21);
  const sma = window.reduce((a, b) => a + b, 0) / window.length;
  const variance = window.reduce((acc, v) => acc + (v - sma) ** 2, 0) / window.length;
  const stdDev = Math.sqrt(variance);
  if (stdDev === 0) return 0;
  const bollingerZ = (closes[1] - sma) / stdDev;
  if (bollingerZ > 2.5) return 0.10 * (bollingerZ - 2.5);
  return 0;
}

/**
 * Momentum-break penalty — drawdown from 20-day peak (skip-day).
 * Flat 0.3 at -5%, 0.6 at -10% or worse. Captures trend fractures even when
 * the underlying metrics still look healthy.
 *
 * @param {number[]} closes - newest-first
 * @returns {number} 0 / 0.3 / 0.6
 */
function computeMomentumBreakPenalty(closes) {
  if (!Array.isArray(closes) || closes.length < 22) return 0;
  const peak20 = Math.max(...closes.slice(1, 22));
  if (!peak20) return 0;
  const drawdown = (closes[1] - peak20) / peak20;
  if (drawdown < -0.10) return 0.6;
  if (drawdown < -0.05) return 0.3;
  return 0;
}

/**
 * Post-Earnings Announcement Drift adjustment.
 *
 * Stocks are known to drift in the direction of their earnings surprise for
 * ~10 trading days. When a recent earnings event with a meaningful reaction
 * is present, add/subtract a fixed 0.5σ to the composite.
 *
 * @param {{daysAgo: number, returnPct: number}|null} earningsInfo
 * @returns {number} -0.5 / 0 / +0.5
 */
function computePeadAdjustment(earningsInfo) {
  if (earningsInfo == null) return 0;
  if (earningsInfo.daysAgo == null || earningsInfo.daysAgo > 10) return 0;
  const r = earningsInfo.returnPct;
  if (r == null || !Number.isFinite(r)) return 0;
  if (r > 0.03) return 0.5;
  if (r < -0.03) return -0.5;
  return 0;
}

/**
 * Compute a single sub-pillar's weighted Z-score for every stock using
 * null-aware reweighting within the pillar. Returns an array of Z-scores
 * (one per stock, null where all pillar metrics are null).
 */
function computeSubPillarZ(zArrays, metricKeys) {
  const n = zArrays[metricKeys[0]].length;
  const out = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    const parts = metricKeys
      .map(key => ({ z: zArrays[key][i], w: MOMENTUM_WEIGHTS[key] }))
      .filter(p => p.z != null && Number.isFinite(p.z));
    if (parts.length === 0) continue;
    const totalW = parts.reduce((a, p) => a + p.w, 0);
    out[i] = parts.reduce((acc, p) => acc + p.z * (p.w / totalW), 0);
  }
  return out;
}

/**
 * Compute Phase 2 Momentum Rank for the full stock universe.
 *
 * @param {Array<{symbol: string, closes: number[], volumes: number[]}>} stockDataArray
 * @param {number[]} spyCloses - SPY closes, newest-first (for Residual Momentum & Intermediate RS)
 * @param {Map<string, {daysAgo: number, returnPct: number}>|null} earningsMap -
 *   Optional per-symbol earnings context for the PEAD overlay. Pass null to
 *   disable PEAD (all adjustments will be 0).
 * @returns {Array<{
 *   symbol: string,
 *   momentumScore: number|null,   // 0-100 cross-sectional percentile of composite Z (BMZ)
 *   momentumRank: number|null,    // Ordinal rank, 1 = best
 *   momentumFactors: {
 *     residualMomentum: number|null,  // winsorized Z
 *     intermediateRS: number|null,    // winsorized Z
 *     acceleration: number|null,      // winsorized Z
 *     turnoverMom: number|null,       // winsorized Z
 *     fip: number|null,               // winsorized Z
 *     ker: number|null,               // winsorized Z
 *     stability: number|null,         // 0-100 percentile
 *     heat: number|null,              // 0-100 percentile
 *     quality: number|null,           // 0-100 percentile
 *     overextensionPenalty: number,   // ≥0, subtracted from BMZ
 *     momentumBreakPenalty: number,   // 0 / 0.3 / 0.6
 *     peadAdjustment: number,         // -0.5 / 0 / +0.5
 *   }
 * }>}
 */
export function computeMomentumRankings(stockDataArray, spyCloses, earningsMap = null) {
  const n = stockDataArray.length;
  const hasSpy = Array.isArray(spyCloses) && spyCloses.length > 0;

  // Step 1: 21-day avg volume per stock (skip-day).
  const avgVolumes = stockDataArray.map(s => {
    if (!Array.isArray(s.volumes) || s.volumes.length < 22) return null;
    const window = s.volumes.slice(1, 22);
    const sum = window.reduce((a, b) => a + (b || 0), 0);
    return sum / window.length;
  });

  // Step 2: percentile-rank avg volume across universe → 0..1.
  const avgVolPctRank100 = percentileRank(avgVolumes);
  const avgVolPct = avgVolPctRank100.map(p => (p == null ? null : p / 100));

  // Step 3: raw metrics per stock (6 total).
  const rawFip = new Array(n).fill(null);
  const rawKer = new Array(n).fill(null);
  const rawAccel = new Array(n).fill(null);
  const rawTurnover = new Array(n).fill(null);
  const rawResMom = new Array(n).fill(null);
  const rawIntRS = new Array(n).fill(null);

  for (let i = 0; i < n; i++) {
    const { closes } = stockDataArray[i];
    rawFip[i] = computeInformationDiscreteness(closes, 60);
    rawKer[i] = computeKER(closes, 20);
    rawAccel[i] = computeAcceleration(closes);
    rawTurnover[i] = computeTurnoverMomentum(closes, avgVolPct[i]);
    if (hasSpy) {
      rawResMom[i] = computeResidualMomentum(closes, spyCloses, 90);
      rawIntRS[i] = computeIntermediateRS(closes, spyCloses);
    }
  }

  // Step 4: z-score + winsorize each metric column independently.
  const z = {
    residualMomentum: zScoreWinsorize(rawResMom),
    intermediateRS:   zScoreWinsorize(rawIntRS),
    acceleration:     zScoreWinsorize(rawAccel),
    turnoverMom:      zScoreWinsorize(rawTurnover),
    fip:              zScoreWinsorize(rawFip),
    ker:              zScoreWinsorize(rawKer),
  };

  // Step 5: 6-metric weighted composite with null-aware reweighting.
  const metricKeys = Object.keys(MOMENTUM_WEIGHTS);
  const bmz = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    const parts = metricKeys
      .map(key => ({ z: z[key][i], w: MOMENTUM_WEIGHTS[key] }))
      .filter(p => p.z != null && Number.isFinite(p.z));
    if (parts.length === 0) continue;
    const totalW = parts.reduce((a, p) => a + p.w, 0);
    bmz[i] = parts.reduce((acc, p) => acc + p.z * (p.w / totalW), 0);
  }

  // Step 5b: Risk-guardrail overlays. Applied only to stocks with a valid BMZ
  // so we don't fabricate a composite for stocks that lacked raw metrics.
  // Sub-pillar Z-scores below use the pre-overlay z columns unchanged.
  const overextArr = new Array(n).fill(0);
  const mbreakArr = new Array(n).fill(0);
  const peadArr = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    if (bmz[i] == null) continue;
    const s = stockDataArray[i];
    const overext = computeOverextensionPenalty(s.closes);
    const mbreak = computeMomentumBreakPenalty(s.closes);
    const pead = computePeadAdjustment(earningsMap?.get(s.symbol) ?? null);
    overextArr[i] = overext;
    mbreakArr[i] = mbreak;
    peadArr[i] = pead;
    bmz[i] = bmz[i] - overext - mbreak + pead;
  }

  // Step 6: momentumScore = percentile of BMZ (0-100); momentumRank = ordinal (1 = best).
  const momentumScore = percentileRank(bmz);
  const momentumRank = (() => {
    const indexed = bmz
      .map((v, i) => ({ v, i }))
      .filter(({ v }) => v != null && Number.isFinite(v))
      .sort((a, b) => b.v - a.v); // desc: highest BMZ → rank 1
    const out = new Array(n).fill(null);
    indexed.forEach(({ i }, idx) => { out[i] = idx + 1; });
    return out;
  })();

  // Step 7: sub-pillar Z-scores → percentile-rank to 0..100.
  const stabilityZ = computeSubPillarZ(z, SUB_PILLARS.stability.metrics);
  const heatZ = computeSubPillarZ(z, SUB_PILLARS.heat.metrics);
  const qualityZ = computeSubPillarZ(z, SUB_PILLARS.quality.metrics);

  const stabilityPct = percentileRank(stabilityZ);
  const heatPct = percentileRank(heatZ);
  const qualityPct = percentileRank(qualityZ);

  // Assemble output.
  return stockDataArray.map((s, i) => ({
    symbol: s.symbol,
    momentumScore: momentumScore[i],
    momentumRank: momentumRank[i],
    momentumFactors: {
      residualMomentum: ROUND3(z.residualMomentum[i]),
      intermediateRS:   ROUND3(z.intermediateRS[i]),
      acceleration:     ROUND3(z.acceleration[i]),
      turnoverMom:      ROUND3(z.turnoverMom[i]),
      fip:              ROUND3(z.fip[i]),
      ker:              ROUND3(z.ker[i]),
      stability:        stabilityPct[i],
      heat:             heatPct[i],
      quality:          qualityPct[i],
      overextensionPenalty: ROUND3(overextArr[i]),
      momentumBreakPenalty: ROUND3(mbreakArr[i]),
      peadAdjustment:       ROUND3(peadArr[i]),
    },
  }));
}
