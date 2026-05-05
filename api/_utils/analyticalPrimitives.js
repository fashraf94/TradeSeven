/**
 * Server-side Analytical Primitives
 *
 * Composite/derived feature detection that depends on multiple input series
 * or windowed scanning. Distinct from technicalCalculations.js, which holds
 * single-indicator math (SMA, RSI, MACD, etc.).
 *
 * All array inputs follow the established server convention: NEWEST-FIRST
 * (index 0 = most recent bar).
 *
 * Phase 2A primitives live here; Phase 2B will add divergence + candle
 * pattern detection using the same module.
 */

// ============================================
// SWING HIGH / LOW DETECTION
// ============================================

/**
 * Find local swing highs and lows over a windowed scan of recent bars.
 *
 * A swing high is a bar whose high is >= the highs of the 2 bars on each side.
 * A swing low is a bar whose low is <= the lows of the 2 bars on each side.
 * (Ties are allowed — matches the client-side technicalUtils convention.)
 *
 * @param {number[]} closes - Stock closes (newest-first; reserved for Phase 2B divergence)
 * @param {number[]} highs - Stock highs (newest-first)
 * @param {number[]} lows - Stock lows (newest-first)
 * @param {number} lookback - Max bars back to scan as candidates (default 20)
 * @returns {{ swingHighs: Array<{ index: number, price: number }>,
 *             swingLows:  Array<{ index: number, price: number }> }|null}
 *   Each list is most-recent-first (lowest index first).
 *   Returns null when input arrays are too short (need at least lookback + 5 bars).
 */
export function findSwingHighsLows(closes, highs, lows, lookback = 20) {
  if (!highs || !lows) return null;
  const minLen = lookback + 5;
  if (highs.length < minLen || lows.length < minLen) return null;

  const WINDOW = 2; // bars on each side for local-extreme confirmation
  const swingHighs = [];
  const swingLows = [];

  // Scan candidates from i = WINDOW (newest valid candidate, has 2 newer bars
  // for confirmation) through i = lookback (oldest in lookback range, still
  // has 2 older bars at i+1, i+2 within the lookback+5 buffer).
  for (let i = WINDOW; i <= lookback; i++) {
    const candHigh = highs[i];
    const candLow = lows[i];
    let isSwingHigh = true;
    let isSwingLow = true;

    for (let offset = -WINDOW; offset <= WINDOW; offset++) {
      if (offset === 0) continue;
      if (highs[i + offset] > candHigh) isSwingHigh = false;
      if (lows[i + offset] < candLow) isSwingLow = false;
      if (!isSwingHigh && !isSwingLow) break;
    }

    if (isSwingHigh) swingHighs.push({ index: i, price: candHigh });
    if (isSwingLow) swingLows.push({ index: i, price: candLow });
  }

  return { swingHighs, swingLows };
}

// ============================================
// SUPPORT / RESISTANCE LEVEL IDENTIFICATION
// ============================================

/**
 * Greedy 2%-cluster of swing points by price proximity.
 * Single-touch swings are returned as singleton clusters; the caller filters
 * for significance (≥ 2 touches).
 */
function clusterSwings(swings, threshold = 0.02) {
  const clusters = [];
  for (const swing of swings) {
    if (!swing || swing.price <= 0) continue;
    const existing = clusters.find(c =>
      Math.abs(c.avg - swing.price) / swing.price < threshold
    );
    if (existing) {
      existing.touches.push(swing);
      const sum = existing.touches.reduce((s, t) => s + t.price, 0);
      existing.avg = sum / existing.touches.length;
    } else {
      clusters.push({ avg: swing.price, touches: [swing] });
    }
  }
  return clusters;
}

/**
 * Identify the nearest significant support and resistance levels from
 * swing-point clusters within a lookback window.
 *
 * "Significant" means a 2%-price-proximity cluster of at least 2 swings —
 * single-touch swings are noise and excluded.
 *
 * @param {number} currentPrice - Latest close
 * @param {Array<{ index: number, price: number }>} swingHighs - From findSwingHighsLows
 * @param {Array<{ index: number, price: number }>} swingLows - From findSwingHighsLows
 * @param {number} lookback - Bars-back window (default 20)
 * @returns {{ nearestResistance: number|null,
 *             nearestSupport: number|null,
 *             distanceToResistancePct: number|null,
 *             distanceToSupportPct: number|null }}
 *   Distances signed: resistance is positive (price must rise), support is
 *   negative (price must fall). Rounded to 2 decimals. Null when no
 *   qualifying cluster exists on that side.
 */
export function findNearestLevels(currentPrice, swingHighs, swingLows, lookback = 20) {
  const result = {
    nearestResistance: null,
    nearestSupport: null,
    distanceToResistancePct: null,
    distanceToSupportPct: null,
  };

  if (currentPrice == null || currentPrice <= 0) return result;

  const recentHighs = (swingHighs || []).filter(s => s && s.index <= lookback);
  const recentLows = (swingLows || []).filter(s => s && s.index <= lookback);

  const significantHighClusters = clusterSwings(recentHighs).filter(c => c.touches.length >= 2);
  const significantLowClusters = clusterSwings(recentLows).filter(c => c.touches.length >= 2);

  // Nearest resistance: closest cluster strictly ABOVE current price
  const resistanceCandidates = significantHighClusters
    .filter(c => c.avg > currentPrice)
    .sort((a, b) => a.avg - b.avg);
  if (resistanceCandidates.length > 0) {
    const nearest = resistanceCandidates[0];
    result.nearestResistance = Number(nearest.avg.toFixed(2));
    result.distanceToResistancePct = Number((((nearest.avg - currentPrice) / currentPrice) * 100).toFixed(2));
  }

  // Nearest support: closest cluster strictly BELOW current price
  const supportCandidates = significantLowClusters
    .filter(c => c.avg < currentPrice)
    .sort((a, b) => b.avg - a.avg);
  if (supportCandidates.length > 0) {
    const nearest = supportCandidates[0];
    result.nearestSupport = Number(nearest.avg.toFixed(2));
    result.distanceToSupportPct = Number((((nearest.avg - currentPrice) / currentPrice) * 100).toFixed(2));
  }

  return result;
}
