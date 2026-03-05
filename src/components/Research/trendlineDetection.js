/**
 * trendlineDetection.js
 * Automatic trendline detection for StockChart.
 * Takes oldest-first OHLCV data, returns trendline coordinate pairs
 * for rendering as LineSeries in lightweight-charts.
 */

/**
 * Find swing highs or swing lows in oldest-first OHLCV data.
 * Returns individual points (no clustering) with bar indices and timestamps.
 */
function findSwingPoints(chartData, lookback, type) {
  const points = [];
  const key = type === 'high' ? 'high' : 'low';
  const compare = type === 'high'
    ? (a, b) => a >= b
    : (a, b) => a <= b;

  for (let i = lookback; i < chartData.length - lookback; i++) {
    const current = chartData[i][key];
    let isSwing = true;

    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j === i) continue;
      if (!compare(current, chartData[j][key])) {
        isSwing = false;
        break;
      }
    }

    if (isSwing) {
      points.push({
        barIndex: i,
        time: chartData[i].time,
        price: current,
      });
    }
  }

  return points;
}

/**
 * Compute the price on a line at a given bar index.
 */
function linePriceAt(anchor, slope, barIndex) {
  return anchor.price + slope * (barIndex - anchor.barIndex);
}

/**
 * detectTrendlines(chartData, options)
 *
 * @param {Array} chartData - Array of { time, open, high, low, close } objects, oldest first.
 *                            `time` is Unix timestamp (seconds) as used by lightweight-charts.
 * @param {Object} options
 * @param {number} options.lookback - Swing point lookback window (default 5)
 * @param {number} options.maxLines - Max trendlines per type: support + resistance (default 2)
 * @param {number} options.touchTolerance - Fraction of avg price for touch detection (default 0.005)
 * @returns {Array} Array of trendline objects:
 *   {
 *     type: 'support' | 'resistance',
 *     startPoint: { time, value },
 *     endPoint: { time, value },
 *     touches: number,
 *     slope: number
 *   }
 */
export function detectTrendlines(chartData, options = {}) {
  const {
    lookback = 5,
    maxLines = 2,
    touchTolerance = 0.005,
  } = options;

  // Edge case: not enough data
  if (!chartData || chartData.length < 15) return [];

  // Edge case: flat market (< 2% price range)
  const prices = chartData.map(c => c.close);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  if (maxPrice === 0 || (maxPrice - minPrice) / maxPrice < 0.02) return [];

  const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
  const tolerance = touchTolerance * avgPrice;
  const dataLen = chartData.length;

  // Step 1: Find swing points
  const swingHighs = findSwingPoints(chartData, lookback, 'high');
  const swingLows = findSwingPoints(chartData, lookback, 'low');

  // Limit to most recent 15 swing points for performance
  const recentHighs = swingHighs.slice(-15);
  const recentLows = swingLows.slice(-15);

  // Step 2 & 3: Generate and score candidate lines
  const maxSlopePerBar = avgPrice * 0.03; // ~60° equivalent cap

  function scoreCandidates(swingPoints, type) {
    const candidates = [];

    if (swingPoints.length < 2) return candidates;

    for (let i = 0; i < swingPoints.length - 1; i++) {
      for (let j = i + 1; j < swingPoints.length; j++) {
        const p1 = swingPoints[i];
        const p2 = swingPoints[j];
        const barSpan = p2.barIndex - p1.barIndex;
        if (barSpan < 2) continue;

        const slope = (p2.price - p1.price) / barSpan;

        // Reject extreme slopes
        if (Math.abs(slope) > maxSlopePerBar) continue;

        // Validate: line must not cut through candle bodies between anchors
        let violated = false;
        let touches = 0;

        for (let k = p1.barIndex; k <= Math.min(p2.barIndex, dataLen - 1); k++) {
          const lineVal = linePriceAt(p1, slope, k);
          const candle = chartData[k];

          if (type === 'support') {
            // Check if candle close falls significantly below the support line
            if (candle.close < lineVal - tolerance && k !== p1.barIndex && k !== p2.barIndex) {
              violated = true;
              break;
            }
            // Count touch: candle low is near the line
            if (Math.abs(candle.low - lineVal) <= tolerance) {
              touches++;
            }
          } else {
            // Resistance: check if candle close rises significantly above the line
            if (candle.close > lineVal + tolerance && k !== p1.barIndex && k !== p2.barIndex) {
              violated = true;
              break;
            }
            // Count touch: candle high is near the line
            if (Math.abs(candle.high - lineVal) <= tolerance) {
              touches++;
            }
          }
        }

        if (violated) continue;

        // Also count touches beyond p2 to the end of data
        for (let k = p2.barIndex + 1; k < dataLen; k++) {
          const lineVal = linePriceAt(p1, slope, k);
          const candle = chartData[k];

          if (type === 'support') {
            if (Math.abs(candle.low - lineVal) <= tolerance) touches++;
          } else {
            if (Math.abs(candle.high - lineVal) <= tolerance) touches++;
          }
        }

        // Filter: need at least 3 touches, or 2 touches spanning > 40% of data
        const spanRatio = barSpan / dataLen;
        if (touches < 3 && !(touches >= 2 && spanRatio > 0.4)) continue;

        const score = touches * Math.sqrt(barSpan);
        candidates.push({ p1, p2, slope, touches, score, barSpan });
      }
    }

    return candidates;
  }

  const supportCandidates = scoreCandidates(recentLows, 'support');
  const resistanceCandidates = scoreCandidates(recentHighs, 'resistance');

  // Step 4: Deduplicate and select top lines
  function deduplicateAndSelect(candidates, max) {
    if (candidates.length === 0) return [];

    candidates.sort((a, b) => b.score - a.score);

    const selected = [];
    for (const cand of candidates) {
      if (selected.length >= max) break;

      // Check if too similar to an already selected line
      const isDuplicate = selected.some(sel => {
        const slopeDiff = sel.slope === 0 && cand.slope === 0
          ? 0
          : Math.abs(sel.slope - cand.slope) / (Math.abs(sel.slope) + Math.abs(cand.slope) + 1e-10);
        const priceDiff = Math.abs(sel.p1.price - cand.p1.price) / avgPrice;
        return slopeDiff < 0.15 && priceDiff < 0.01;
      });

      if (!isDuplicate) {
        selected.push(cand);
      }
    }

    return selected;
  }

  const linesPerType = Math.max(1, Math.floor(maxLines / 2));
  const bestSupport = deduplicateAndSelect(supportCandidates, linesPerType);
  const bestResistance = deduplicateAndSelect(resistanceCandidates, linesPerType);

  // Step 5: Project endpoints and build output
  const lastTime = chartData[dataLen - 1].time;

  function buildResult(candidates, type) {
    return candidates.map(cand => {
      const { p1, slope, touches } = cand;
      const lastBarIndex = dataLen - 1;
      const endValue = linePriceAt(p1, slope, lastBarIndex);

      // Compute slope in price-per-second for the output
      const timeDelta = lastTime - p1.time;
      const slopePerSecond = timeDelta > 0 ? (endValue - p1.price) / timeDelta : 0;

      return {
        type,
        startPoint: { time: p1.time, value: p1.price },
        endPoint: { time: lastTime, value: endValue },
        touches,
        slope: slopePerSecond,
      };
    });
  }

  return [
    ...buildResult(bestSupport, 'support'),
    ...buildResult(bestResistance, 'resistance'),
  ];
}
