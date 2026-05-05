/**
 * Server-side Technical Indicator Calculations
 *
 * Pure math module — no API calls, no caching, no Firebase.
 * All functions take arrays of numeric data (newest-first) and return calculated values.
 * Mirrors algorithms from src/services/technicalIndicators.js for server-side use.
 */

// ============================================
// MOVING AVERAGES
// ============================================

/**
 * Calculate Simple Moving Average
 * @param {number[]} closes - Array of closing prices (newest first)
 * @param {number} period - Number of periods
 * @returns {number|null}
 */
export function calculateSMA(closes, period) {
  if (!closes || closes.length < period) return null;
  const slice = closes.slice(0, period);
  const sum = slice.reduce((a, b) => a + b, 0);
  return Number((sum / period).toFixed(4));
}

/**
 * Calculate Exponential Moving Average
 * @param {number[]} closes - Array of closing prices (newest first)
 * @param {number} period - Number of periods
 * @returns {number|null}
 */
export function calculateEMA(closes, period) {
  if (!closes || closes.length < period) return null;

  // Reverse to oldest-first for calculation
  const chronological = [...closes].reverse();
  const multiplier = 2 / (period + 1);

  // Start with SMA for first EMA value
  let ema = chronological.slice(0, period).reduce((a, b) => a + b, 0) / period;

  // Calculate EMA for remaining values
  for (let i = period; i < chronological.length; i++) {
    ema = (chronological[i] - ema) * multiplier + ema;
  }

  return Number(ema.toFixed(4));
}

// ============================================
// RSI (Relative Strength Index)
// ============================================

/**
 * Calculate RSI with zone classification
 * Uses Wilder's smoothed average (matching client-side implementation)
 * @param {number[]} closes - Array of closing prices (newest first)
 * @param {number} period - Number of periods (default 14)
 * @returns {{ value: number, zone: string }|null}
 */
export function calculateRSI(closes, period = 14) {
  if (!closes || closes.length < period + 1) return null;

  // Reverse to oldest-first for calculation
  const chronological = [...closes].reverse();

  // Calculate price changes
  const changes = [];
  for (let i = 1; i < chronological.length; i++) {
    changes.push(chronological[i] - chronological[i - 1]);
  }

  if (changes.length < period) return null;

  // Separate gains and losses
  const gains = changes.map(c => (c > 0 ? c : 0));
  const losses = changes.map(c => (c < 0 ? Math.abs(c) : 0));

  // Wilder's smoothed average gain/loss
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

  for (let i = period; i < changes.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
  }

  if (avgLoss === 0) return { value: 100, zone: 'overbought' };

  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));

  return {
    value: Number(rsi.toFixed(2)),
    zone: rsi >= 70 ? 'overbought' : rsi <= 30 ? 'oversold' : 'neutral',
  };
}

// ============================================
// MACD
// ============================================

/**
 * Calculate EMA series (returns array of all EMA values)
 * @param {number[]} data - Array of values (oldest first)
 * @param {number} period - EMA period
 * @returns {Array<number|null>}
 */
function calculateEMASeries(data, period) {
  if (!data || data.length < period) {
    return new Array(data?.length || 0).fill(null);
  }

  const multiplier = 2 / (period + 1);
  const ema = [];

  // First EMA value is SMA of first `period` values
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i];
    ema.push(null);
  }
  ema[period - 1] = sum / period;

  // Calculate remaining EMA values
  for (let i = period; i < data.length; i++) {
    const currentEma = (data[i] - ema[i - 1]) * multiplier + ema[i - 1];
    ema.push(currentEma);
  }

  return ema;
}

/**
 * Calculate MACD (Moving Average Convergence Divergence)
 * Uses proper 9-period EMA of MACD line for signal line
 * @param {number[]} closes - Array of closing prices (newest first)
 * @param {number} fast - Fast EMA period (default 12)
 * @param {number} slow - Slow EMA period (default 26)
 * @param {number} signal - Signal EMA period (default 9)
 * @returns {{ macd: number, signal: number, histogram: number }|null}
 */
export function calculateMACD(closes, fast = 12, slow = 26, signal = 9) {
  if (!closes || closes.length < slow + signal) return null;

  // Reverse to oldest-first for calculations
  const chronological = [...closes].reverse();

  // Calculate 12-period and 26-period EMA series
  const emaFastSeries = calculateEMASeries(chronological, fast);
  const emaSlowSeries = calculateEMASeries(chronological, slow);

  // Calculate MACD Line series (fast EMA - slow EMA)
  const macdLine = [];
  for (let i = 0; i < chronological.length; i++) {
    if (emaFastSeries[i] !== null && emaSlowSeries[i] !== null) {
      macdLine.push(emaFastSeries[i] - emaSlowSeries[i]);
    } else {
      macdLine.push(null);
    }
  }

  // Get valid MACD values for signal calculation
  const validMacdValues = macdLine.filter(v => v !== null);
  if (validMacdValues.length < signal) return null;

  // Calculate 9-period EMA of MACD Line for Signal Line
  const signalSeries = calculateEMASeries(validMacdValues, signal);

  // Get latest values (end of series = most recent)
  const latestMacd = macdLine[macdLine.length - 1];
  const latestSignal = signalSeries[signalSeries.length - 1];

  if (latestMacd === null || latestSignal === null) return null;

  const histogram = latestMacd - latestSignal;

  return {
    macd: Number(latestMacd.toFixed(4)),
    signal: Number(latestSignal.toFixed(4)),
    histogram: Number(histogram.toFixed(4)),
  };
}

// ============================================
// BOLLINGER BANDS
// ============================================

/**
 * Calculate Bollinger Bands
 * @param {number[]} closes - Array of closing prices (newest first)
 * @param {number} period - Number of periods (default 20)
 * @param {number} stdDev - Standard deviation multiplier (default 2)
 * @returns {{ upper: number, middle: number, lower: number, bandwidth: number, percentB: number }|null}
 */
export function calculateBollingerBands(closes, period = 20, stdDev = 2) {
  if (!closes || closes.length < period) return null;

  const slice = closes.slice(0, period);
  const middle = slice.reduce((a, b) => a + b, 0) / period;

  // Population standard deviation
  const squaredDiffs = slice.map(price => Math.pow(price - middle, 2));
  const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / period;
  const sd = Math.sqrt(avgSquaredDiff);

  const upper = middle + sd * stdDev;
  const lower = middle - sd * stdDev;
  const currentPrice = closes[0];
  const bandwidth = ((upper - lower) / middle) * 100;
  const percentB = upper !== lower ? (currentPrice - lower) / (upper - lower) : 0.5;

  return {
    upper: Number(upper.toFixed(2)),
    middle: Number(middle.toFixed(2)),
    lower: Number(lower.toFixed(2)),
    bandwidth: Number(bandwidth.toFixed(2)),
    percentB: Number(percentB.toFixed(4)),
  };
}

// ============================================
// ATR (Average True Range)
// ============================================

/**
 * Calculate Average True Range with volatility regime classification
 * @param {number[]} highs - Array of high prices (newest first)
 * @param {number[]} lows - Array of low prices (newest first)
 * @param {number[]} closes - Array of closing prices (newest first)
 * @param {number} period - Number of periods (default 14)
 * @returns {{ value: number, percent: number, regime: string }|null}
 */
export function calculateATR(highs, lows, closes, period = 14) {
  if (!highs || !lows || !closes || highs.length < period + 1) return null;

  // Reverse to oldest-first for calculation
  const h = [...highs].reverse();
  const l = [...lows].reverse();
  const c = [...closes].reverse();

  const trueRanges = [];
  for (let i = 1; i < h.length; i++) {
    const tr = Math.max(
      h[i] - l[i],
      Math.abs(h[i] - c[i - 1]),
      Math.abs(l[i] - c[i - 1])
    );
    trueRanges.push(tr);
  }

  if (trueRanges.length < period) return null;

  // Simple average of last N true ranges
  const recentTR = trueRanges.slice(-period);
  const atr = recentTR.reduce((a, b) => a + b, 0) / period;

  const currentPrice = closes[0];
  const atrPercent = currentPrice > 0 ? (atr / currentPrice) * 100 : 0;

  let regime;
  if (atrPercent > 4) regime = 'extreme';
  else if (atrPercent > 3) regime = 'high';
  else if (atrPercent > 1.5) regime = 'normal';
  else regime = 'low';

  return {
    value: Number(atr.toFixed(4)),
    percent: Number(atrPercent.toFixed(2)),
    regime,
  };
}

// ============================================
// VOLUME PROFILE
// ============================================

/**
 * Calculate Volume Profile (Relative Volume)
 * Uses 6-tier institutional classification matching client-side RVOL tiers
 * @param {number[]} volumes - Array of volume values (newest first)
 * @param {number} period - Lookback period for average (default 20)
 * @returns {{ ratio: number, currentVolume: number, avgVolume: number, tier: string }|null}
 */
export function calculateVolumeProfile(volumes, period = 20) {
  if (!volumes || volumes.length < period + 1) return null;

  const currentVolume = volumes[0];

  // Average volume over lookback period (excluding current day)
  const historical = volumes.slice(1, period + 1).filter(v => v > 0);

  if (historical.length < Math.floor(period / 2)) return null;

  const avgVolume = historical.reduce((a, b) => a + b, 0) / historical.length;
  if (avgVolume === 0) return null;

  const ratio = currentVolume / avgVolume;

  let tier;
  if (ratio > 4.0) tier = 'CLIMAX';
  else if (ratio >= 2.5) tier = 'INSTITUTIONAL';
  else if (ratio >= 1.25) tier = 'ELEVATED';
  else if (ratio >= 0.75) tier = 'NORMAL';
  else if (ratio >= 0.5) tier = 'LOW';
  else tier = 'VERY_LOW';

  return {
    ratio: Number(ratio.toFixed(2)),
    currentVolume,
    avgVolume: Math.round(avgVolume),
    tier,
  };
}

// ============================================
// VWAP (Volume-Weighted Average Price)
// ============================================

/**
 * Calculate VWAP from intraday OHLCV candles.
 * @param {Array<{ high: number, low: number, close: number, volume: number }>} intradayCandles
 *   Array of intraday candles (oldest first — chronological order)
 * @returns {{ vwap: number, currentPrice: number, vwapDeviation: number }|null}
 *   vwapDeviation is % above (+) or below (-) VWAP
 */
export function calculateVWAP(intradayCandles) {
  if (!intradayCandles || intradayCandles.length === 0) return null;

  let cumulativeTPV = 0; // cumulative(typicalPrice * volume)
  let cumulativeVolume = 0;

  for (const candle of intradayCandles) {
    const typicalPrice = (candle.high + candle.low + candle.close) / 3;
    const vol = candle.volume || 0;
    cumulativeTPV += typicalPrice * vol;
    cumulativeVolume += vol;
  }

  if (cumulativeVolume === 0) return null;

  const vwap = cumulativeTPV / cumulativeVolume;
  const currentPrice = intradayCandles[intradayCandles.length - 1].close;
  const vwapDeviation = ((currentPrice - vwap) / vwap) * 100;

  return {
    vwap: Number(vwap.toFixed(4)),
    currentPrice: Number(currentPrice.toFixed(4)),
    vwapDeviation: Number(vwapDeviation.toFixed(4)),
  };
}

// ============================================
// NR7 (Narrowest Range of 7 Days)
// ============================================

/**
 * Detect if the most recent daily range is the narrowest of the last 7 trading days.
 * @param {number[]} highs - Array of high prices (newest first)
 * @param {number[]} lows - Array of low prices (newest first)
 * @returns {{ nr7: boolean, dailyRange: number, ranges: number[] }|null}
 */
export function calculateNR7(highs, lows) {
  if (!highs || !lows || highs.length < 7 || lows.length < 7) return null;

  const ranges = [];
  for (let i = 0; i < 7; i++) {
    ranges.push(highs[i] - lows[i]);
  }

  const todayRange = ranges[0];
  const isNR7 = ranges.slice(1).every(r => todayRange <= r);

  return {
    nr7: isNR7,
    dailyRange: Number(todayRange.toFixed(4)),
    ranges: ranges.map(r => Number(r.toFixed(4))),
  };
}

// ============================================
// PIVOT POINTS
// ============================================

/**
 * Calculate Standard (Floor Trader) pivot levels from prior-day OHLC.
 * @param {number|null} prevHigh - Prior session high
 * @param {number|null} prevLow - Prior session low
 * @param {number|null} prevClose - Prior session close
 * @returns {{ pivotPP: number, pivotR1: number, pivotR2: number, pivotS1: number, pivotS2: number }|null}
 */
export function calculatePivotLevels(prevHigh, prevLow, prevClose) {
  if (prevHigh == null || prevLow == null || prevClose == null) return null;

  const pp = (prevHigh + prevLow + prevClose) / 3;
  const range = prevHigh - prevLow;

  return {
    pivotPP: Number(pp.toFixed(2)),
    pivotR1: Number((2 * pp - prevLow).toFixed(2)),
    pivotR2: Number((pp + range).toFixed(2)),
    pivotS1: Number((2 * pp - prevHigh).toFixed(2)),
    pivotS2: Number((pp - range).toFixed(2)),
  };
}

// ============================================
// TREND CLASSIFICATION
// ============================================

/**
 * Classify a single timeframe's trend by current price vs SMA.
 * Returns null when SMA is unavailable (insufficient history).
 * @param {number|null} currentPrice
 * @param {number|null} smaValue
 * @returns {'up'|'down'|null}
 */
export function classifyTrend(currentPrice, smaValue) {
  if (smaValue == null || currentPrice == null) return null;
  // Strict greater-than for 'up' matches the existing aboveSMA* convention
  // in computeTechnicalScore (price === sma counts as not-above → 'down').
  return currentPrice > smaValue ? 'up' : 'down';
}

// ============================================
// CONVENIENCE: ALL INDICATORS
// ============================================

/**
 * Calculate all technical indicators from OHLCV data
 * @param {Array<{ close: number, high: number, low: number, volume: number }>} ohlcvData
 *   Array of OHLCV candles (newest first)
 * @returns {object|null} All calculated indicators
 */
export function calculateAllIndicators(ohlcvData) {
  if (!ohlcvData || !Array.isArray(ohlcvData) || ohlcvData.length === 0) {
    return null;
  }

  // Extract arrays from OHLCV objects
  const closes = ohlcvData.map(d => d.close);
  const highs = ohlcvData.map(d => d.high);
  const lows = ohlcvData.map(d => d.low);
  const volumes = ohlcvData.map(d => d.volume);

  return {
    calculatedAt: new Date().toISOString(),
    dataPoints: ohlcvData.length,

    rsi: calculateRSI(closes, 14),
    macd: calculateMACD(closes, 12, 26, 9),

    sma: {
      sma20: calculateSMA(closes, 20),
      sma50: calculateSMA(closes, 50),
      sma200: calculateSMA(closes, 200),
    },

    ema: {
      ema12: calculateEMA(closes, 12),
      ema26: calculateEMA(closes, 26),
      ema50: calculateEMA(closes, 50),
    },

    bollingerBands: calculateBollingerBands(closes, 20, 2),
    atr: calculateATR(highs, lows, closes, 14),
    volumeProfile: calculateVolumeProfile(volumes, 20),
  };
}
