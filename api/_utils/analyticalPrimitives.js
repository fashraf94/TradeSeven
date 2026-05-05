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
 * SINGLE-SERIES MODE (Phase 2B): when both `highs` and `lows` are null, the
 * function falls back to using `closes` as both. This is how RSI divergence
 * detection runs swing analysis on a single indicator series. Null entries
 * within the scanned window are treated as disqualifying — a candidate or
 * its neighbors cannot be null for that index to count as a swing.
 *
 * @param {(number|null)[]} closes - Stock closes (newest-first); also used as
 *   highs/lows when those args are null.
 * @param {(number|null)[]|null} highs - Stock highs (newest-first), or null
 *   for single-series mode.
 * @param {(number|null)[]|null} lows - Stock lows (newest-first), or null
 *   for single-series mode.
 * @param {number} lookback - Max bars back to scan as candidates (default 20)
 * @returns {{ swingHighs: Array<{ index: number, price: number }>,
 *             swingLows:  Array<{ index: number, price: number }> }|null}
 *   Each list is most-recent-first (lowest index first).
 *   Returns null when input arrays are too short (need at least lookback + 5 bars).
 */
export function findSwingHighsLows(closes, highs, lows, lookback = 20) {
  // Single-series fallback for indicator-only divergence checks.
  if (highs == null && lows == null) {
    if (!closes) return null;
    highs = closes;
    lows = closes;
  }

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
    if (candHigh == null || candLow == null) continue;

    let isSwingHigh = true;
    let isSwingLow = true;

    for (let offset = -WINDOW; offset <= WINDOW; offset++) {
      if (offset === 0) continue;
      const neighborHigh = highs[i + offset];
      const neighborLow = lows[i + offset];
      if (neighborHigh == null || neighborLow == null) {
        // Can't validate with missing data — disqualify this candidate.
        isSwingHigh = false;
        isSwingLow = false;
        break;
      }
      if (neighborHigh > candHigh) isSwingHigh = false;
      if (neighborLow < candLow) isSwingLow = false;
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

// ============================================
// RSI DIVERGENCE DETECTION
// ============================================

/**
 * Find the swing whose index is closest to targetIndex within ±tolerance bars.
 * Returns null when no swing is within tolerance.
 */
function findClosestSwing(swings, targetIndex, tolerance) {
  let best = null;
  let bestDist = Infinity;
  for (const swing of swings) {
    const dist = Math.abs(swing.index - targetIndex);
    if (dist <= tolerance && dist < bestDist) {
      best = swing;
      bestDist = dist;
    }
  }
  return best;
}

/**
 * Detect bullish or bearish divergence between price (closes) and RSI.
 *
 * Bullish divergence: price prints a lower low while RSI prints a higher low —
 * the down-move is losing momentum. Bearish divergence is the inverse on highs.
 *
 * Swings on the two series rarely align exactly to the same bar, so each
 * price swing is matched to the closest RSI swing within ±2 bars (standard
 * professional convention).
 *
 * @param {number[]} closes - Closing prices, newest-first
 * @param {(number|null)[]} rsiValues - RSI series, newest-first (from
 *   calculateRSISeries — older bars may be null where RSI couldn't seed)
 * @param {number} lookback - Bars-back window (default 20)
 * @returns {'bullish'|'bearish'|'none'|null}
 *   null when there is insufficient swing structure to assess.
 */
export function detectRSIDivergence(closes, rsiValues, lookback = 20) {
  if (!closes || !rsiValues) return null;

  const priceSwings = findSwingHighsLows(closes, null, null, lookback);
  const rsiSwings = findSwingHighsLows(rsiValues, null, null, lookback);

  if (!priceSwings || !rsiSwings) return null;

  const enoughLowStructure = priceSwings.swingLows.length >= 2 && rsiSwings.swingLows.length >= 1;
  const enoughHighStructure = priceSwings.swingHighs.length >= 2 && rsiSwings.swingHighs.length >= 1;

  if (!enoughLowStructure && !enoughHighStructure) return null;

  // Bullish divergence on the two most recent price swing lows.
  // priceSwings is most-recent-first, so [0] is newer than [1].
  if (enoughLowStructure) {
    const [pLowNewer, pLowOlder] = priceSwings.swingLows;
    const rNewer = findClosestSwing(rsiSwings.swingLows, pLowNewer.index, 2);
    const rOlder = findClosestSwing(rsiSwings.swingLows, pLowOlder.index, 2);
    if (rNewer && rOlder &&
        pLowNewer.price < pLowOlder.price &&  // price made a LOWER low
        rNewer.price > rOlder.price) {        // RSI made a HIGHER low
      return 'bullish';
    }
  }

  // Bearish divergence on the two most recent price swing highs.
  if (enoughHighStructure) {
    const [pHighNewer, pHighOlder] = priceSwings.swingHighs;
    const rNewer = findClosestSwing(rsiSwings.swingHighs, pHighNewer.index, 2);
    const rOlder = findClosestSwing(rsiSwings.swingHighs, pHighOlder.index, 2);
    if (rNewer && rOlder &&
        pHighNewer.price > pHighOlder.price &&  // price made a HIGHER high
        rNewer.price < rOlder.price) {          // RSI made a LOWER high
      return 'bearish';
    }
  }

  return 'none';
}

// ============================================
// CANDLE PATTERN RECOGNITION
// ============================================

/**
 * Flag candles that look like split-day artifacts or other non-market
 * price moves: a 25%+ body without correspondingly extreme volume (10x+)
 * is almost certainly an administrative price adjustment, not real action.
 *
 * Real 25%+ moves (earnings shocks, FDA decisions, M&A) come with massive
 * volume — those candles pass through and pattern detection runs normally.
 */
function isSuspiciousCandle(open, high, low, close, volume, avgVolume) {
  if (avgVolume == null || avgVolume <= 0) return false;
  if (open == null || close == null || open <= 0) return false;
  if (volume == null) return false;

  const bodyRatio = Math.abs(close - open) / open;
  const volumeRatio = volume / avgVolume;
  return bodyRatio > 0.25 && volumeRatio < 10;
}

/**
 * Detect a single-candle or two-candle pattern on the most recent bar(s).
 * Returns the first match in priority order:
 *   bullish_engulfing → bearish_engulfing → hammer → shooting_star → doji
 * Or null if no pattern matches (or if the input candles are flagged as
 * suspicious by isSuspiciousCandle, which guards against split-day false
 * positives caused by mixed adjusted/unadjusted OHLC).
 *
 * Geometry mirrors the client-side confluenceDetection.js implementation.
 *
 * @param {number[]} opens   - Open prices, newest-first
 * @param {number[]} highs   - High prices, newest-first
 * @param {number[]} lows    - Low prices, newest-first
 * @param {number[]} closes  - Close prices, newest-first
 * @param {number[]} volumes - Volumes, newest-first
 * @param {number|null} avgVolume - Average volume (e.g., volumeProfile.avgVolume)
 * @returns {'bullish_engulfing'|'bearish_engulfing'|'hammer'|'shooting_star'|'doji'|null}
 */
export function detectCandlePattern(opens, highs, lows, closes, volumes, avgVolume) {
  if (!opens || !highs || !lows || !closes) return null;
  if (opens.length < 1) return null;

  const o0 = opens[0], h0 = highs[0], l0 = lows[0], c0 = closes[0];
  if (o0 == null || h0 == null || l0 == null || c0 == null) return null;

  const v0 = volumes ? volumes[0] : null;
  const has2 = opens.length >= 2 && closes.length >= 2;
  const o1 = has2 ? opens[1] : null;
  const c1 = has2 ? closes[1] : null;
  const h1 = has2 ? highs[1] : null;
  const l1 = has2 ? lows[1] : null;
  const v1 = has2 && volumes ? volumes[1] : null;

  const todaySuspicious = isSuspiciousCandle(o0, h0, l0, c0, v0, avgVolume);
  const yesterdaySuspicious = has2 && isSuspiciousCandle(o1, h1, l1, c1, v1, avgVolume);

  // Two-candle patterns: skipped if EITHER candle is suspicious.
  if (has2 && !todaySuspicious && !yesterdaySuspicious) {
    // Bullish Engulfing
    if (c1 < o1 && c0 > o0 && o0 < c1 && c0 > o1) return 'bullish_engulfing';
    // Bearish Engulfing
    if (c1 > o1 && c0 < o0 && o0 > c1 && c0 < o1) return 'bearish_engulfing';
  }

  // One-candle patterns: skipped if today is suspicious. (Yesterday being
  // suspicious doesn't disqualify a today-only pattern.)
  if (todaySuspicious) return null;

  const bodySize = Math.abs(c0 - o0);
  const upperWick = h0 - Math.max(o0, c0);
  const lowerWick = Math.min(o0, c0) - l0;
  const range = h0 - l0;

  // Hammer — small body, long lower wick (≥ 2× body), short upper wick (< 0.5× body)
  if (bodySize > 0 && lowerWick > bodySize * 2 && upperWick < bodySize * 0.5) {
    return 'hammer';
  }

  // Shooting Star — small body, long upper wick (≥ 2× body), short lower wick (< 0.5× body)
  if (bodySize > 0 && upperWick > bodySize * 2 && lowerWick < bodySize * 0.5) {
    return 'shooting_star';
  }

  // Doji — body is < 10% of total range
  if (range > 0 && bodySize / range < 0.1) {
    return 'doji';
  }

  return null;
}
