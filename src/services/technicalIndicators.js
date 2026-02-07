/**
 * Technical Indicators Service for MarketClash
 *
 * Calculates and caches technical indicators with AGGRESSIVE (24h) caching.
 * Uses historical price data to derive:
 * - Moving Averages (SMA, EMA)
 * - RSI (Relative Strength Index)
 * - MACD
 * - Bollinger Bands
 * - Volatility metrics
 */

import cacheService from './cacheService.js';

// ============================================
// CONFIGURATION
// ============================================

const DEFAULT_PERIODS = {
  RSI: 14,
  SMA_SHORT: 20,
  SMA_LONG: 50,
  EMA_SHORT: 12,
  EMA_LONG: 26,
  MACD_SIGNAL: 9,
  BOLLINGER: 20,
  BOLLINGER_STD: 2,
  ATR: 14,
  RVOL: 20
};

// ============================================
// MOVING AVERAGES
// ============================================

/**
 * Calculate Simple Moving Average
 * @param {number[]} prices - Array of prices (newest first)
 * @param {number} period - Number of periods
 * @returns {number|null}
 */
export function calculateSMA(prices, period = DEFAULT_PERIODS.SMA_SHORT) {
  if (!prices || prices.length < period) return null;

  const slice = prices.slice(0, period);
  const sum = slice.reduce((acc, val) => acc + val, 0);
  return sum / period;
}

/**
 * Calculate rolling SMA array for chart overlay lines
 * Unlike calculateSMA (which returns a single value), this returns an array
 * of { date, value } in newest-first order matching the input OHLCV data.
 * @param {Array} ohlcvData - OHLCV candles (newest first)
 * @param {number} period - SMA period
 * @returns {Array} Array of { date, value } or empty array
 */
export function calculateRollingSMA(ohlcvData, period) {
  if (!ohlcvData || ohlcvData.length < period) return [];
  const result = [];
  for (let i = 0; i <= ohlcvData.length - period; i++) {
    const slice = ohlcvData.slice(i, i + period);
    const avg = slice.reduce((sum, c) => sum + c.close, 0) / period;
    result.push({
      date: ohlcvData[i].date || ohlcvData[i].datetime || ohlcvData[i].timestamp,
      value: Math.round(avg * 100) / 100,
    });
  }
  return result;
}

/**
 * Calculate Exponential Moving Average
 * @param {number[]} prices - Array of prices (newest first)
 * @param {number} period - Number of periods
 * @returns {number|null}
 */
export function calculateEMA(prices, period = DEFAULT_PERIODS.EMA_SHORT) {
  if (!prices || prices.length < period) return null;

  // Reverse to get oldest first for EMA calculation
  const reversed = [...prices].reverse();
  const multiplier = 2 / (period + 1);

  // Start with SMA for first EMA value
  let ema = reversed.slice(0, period).reduce((a, b) => a + b, 0) / period;

  // Calculate EMA for remaining values
  for (let i = period; i < reversed.length; i++) {
    ema = (reversed[i] - ema) * multiplier + ema;
  }

  return ema;
}

/**
 * Calculate all moving averages for a symbol
 */
export function calculateMovingAverages(prices) {
  return {
    sma20: calculateSMA(prices, 20),
    sma50: calculateSMA(prices, 50),
    sma200: calculateSMA(prices, 200),
    ema12: calculateEMA(prices, 12),
    ema26: calculateEMA(prices, 26),
    ema50: calculateEMA(prices, 50)
  };
}

// ============================================
// RSI (Relative Strength Index)
// ============================================

/**
 * Calculate RSI
 * @param {number[]} prices - Array of prices (newest first)
 * @param {number} period - Number of periods (default 14)
 * @returns {number|null} RSI value (0-100)
 */
export function calculateRSI(prices, period = DEFAULT_PERIODS.RSI) {
  if (!prices || prices.length < period + 1) return null;

  // Reverse to get oldest first
  const reversed = [...prices].reverse();

  // Calculate price changes
  const changes = [];
  for (let i = 1; i < reversed.length; i++) {
    changes.push(reversed[i] - reversed[i - 1]);
  }

  if (changes.length < period) return null;

  // Separate gains and losses
  const gains = changes.map(c => c > 0 ? c : 0);
  const losses = changes.map(c => c < 0 ? Math.abs(c) : 0);

  // Calculate average gain/loss for first period
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

  // Smooth the averages
  for (let i = period; i < changes.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
  }

  if (avgLoss === 0) return 100;

  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));

  return Number(rsi.toFixed(2));
}

/**
 * Get RSI interpretation
 */
export function getRSISignal(rsi) {
  if (rsi === null) return { signal: 'unknown', strength: 0 };

  if (rsi >= 70) {
    return { signal: 'overbought', strength: Math.min((rsi - 70) / 30, 1) };
  } else if (rsi <= 30) {
    return { signal: 'oversold', strength: Math.min((30 - rsi) / 30, 1) };
  } else {
    return { signal: 'neutral', strength: 0 };
  }
}

// ============================================
// MACD
// ============================================

/**
 * Calculate EMA series (returns array of all EMA values)
 * @param {number[]} data - Array of values (oldest first)
 * @param {number} period - EMA period
 * @returns {number[]} Array of EMA values (null for insufficient data points)
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
    ema.push(null); // Not enough data yet
  }
  ema[period - 1] = sum / period; // First valid EMA

  // Calculate remaining EMA values
  for (let i = period; i < data.length; i++) {
    const currentEma = (data[i] - ema[i - 1]) * multiplier + ema[i - 1];
    ema.push(currentEma);
  }

  return ema;
}

/**
 * Calculate MACD (Moving Average Convergence Divergence)
 * Uses proper 9-period EMA of MACD line for signal line (L3 fix)
 * @param {number[]} prices - Array of prices (newest first)
 * @returns {object|null} MACD data { macd, signal, histogram }
 */
export function calculateMACD(prices) {
  if (!prices || prices.length < 35) return null; // Need 26 + 9 periods minimum

  // Reverse to get oldest first for calculations
  const chronological = [...prices].reverse();

  // Calculate 12-period and 26-period EMA series
  const ema12Series = calculateEMASeries(chronological, 12);
  const ema26Series = calculateEMASeries(chronological, 26);

  // Calculate MACD Line series (12 EMA - 26 EMA)
  const macdLine = [];
  for (let i = 0; i < chronological.length; i++) {
    if (ema12Series[i] !== null && ema26Series[i] !== null) {
      macdLine.push(ema12Series[i] - ema26Series[i]);
    } else {
      macdLine.push(null);
    }
  }

  // Get valid MACD values for signal calculation
  const validMacdValues = macdLine.filter(v => v !== null);
  if (validMacdValues.length < 9) return null;

  // Calculate 9-period EMA of MACD Line for Signal Line
  const signalSeries = calculateEMASeries(validMacdValues, 9);

  // Get latest values (end of series = most recent)
  const latestMacd = macdLine[macdLine.length - 1];
  const latestSignal = signalSeries[signalSeries.length - 1];

  if (latestMacd === null || latestSignal === null) return null;

  const histogram = latestMacd - latestSignal;

  return {
    macd: Number(latestMacd.toFixed(4)),
    signal: Number(latestSignal.toFixed(4)),
    histogram: Number(histogram.toFixed(4))
  };
}

/**
 * Get MACD signal interpretation
 */
export function getMACDSignal(macdData) {
  if (!macdData) return { signal: 'unknown', strength: 0 };

  const { histogram } = macdData;

  if (histogram > 0) {
    return { signal: 'bullish', strength: Math.min(Math.abs(histogram) * 10, 1) };
  } else if (histogram < 0) {
    return { signal: 'bearish', strength: Math.min(Math.abs(histogram) * 10, 1) };
  } else {
    return { signal: 'neutral', strength: 0 };
  }
}

// ============================================
// BOLLINGER BANDS
// ============================================

/**
 * Calculate Bollinger Bands
 * @param {number[]} prices - Array of prices (newest first)
 * @param {number} period - Number of periods (default 20)
 * @param {number} stdMultiplier - Standard deviation multiplier (default 2)
 * @returns {object|null} { upper, middle, lower, bandwidth, percentB }
 */
export function calculateBollingerBands(prices, period = DEFAULT_PERIODS.BOLLINGER, stdMultiplier = DEFAULT_PERIODS.BOLLINGER_STD) {
  if (!prices || prices.length < period) return null;

  const slice = prices.slice(0, period);
  const middle = slice.reduce((a, b) => a + b, 0) / period;

  // Calculate standard deviation
  const squaredDiffs = slice.map(price => Math.pow(price - middle, 2));
  const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / period;
  const stdDev = Math.sqrt(avgSquaredDiff);

  const upper = middle + (stdDev * stdMultiplier);
  const lower = middle - (stdDev * stdMultiplier);

  const currentPrice = prices[0];
  const bandwidth = ((upper - lower) / middle) * 100;
  const percentB = (currentPrice - lower) / (upper - lower);

  return {
    upper: Number(upper.toFixed(2)),
    middle: Number(middle.toFixed(2)),
    lower: Number(lower.toFixed(2)),
    bandwidth: Number(bandwidth.toFixed(2)),
    percentB: Number(percentB.toFixed(4))
  };
}

/**
 * Get Bollinger Band signal
 */
export function getBollingerSignal(bbData, currentPrice) {
  if (!bbData) return { signal: 'unknown', strength: 0 };

  const { upper, lower, percentB } = bbData;

  if (currentPrice >= upper) {
    return { signal: 'overbought', strength: Math.min((percentB - 1) + 0.5, 1) };
  } else if (currentPrice <= lower) {
    return { signal: 'oversold', strength: Math.min(Math.abs(percentB) + 0.5, 1) };
  } else {
    return { signal: 'neutral', strength: 0 };
  }
}

// ============================================
// VOLATILITY METRICS
// ============================================

/**
 * Calculate Average True Range (ATR)
 * @param {object[]} ohlcData - Array of {high, low, close} (newest first)
 * @param {number} period - Number of periods (default 14)
 * @returns {number|null} ATR value
 */
export function calculateATR(ohlcData, period = DEFAULT_PERIODS.ATR) {
  if (!ohlcData || ohlcData.length < period + 1) return null;

  // Reverse to get oldest first
  const reversed = [...ohlcData].reverse();

  const trueRanges = [];
  for (let i = 1; i < reversed.length; i++) {
    const current = reversed[i];
    const prev = reversed[i - 1];

    const tr = Math.max(
      current.high - current.low,
      Math.abs(current.high - prev.close),
      Math.abs(current.low - prev.close)
    );
    trueRanges.push(tr);
  }

  if (trueRanges.length < period) return null;

  // Simple average of last N true ranges
  const recentTR = trueRanges.slice(-period);
  const atr = recentTR.reduce((a, b) => a + b, 0) / period;

  return Number(atr.toFixed(4));
}

/**
 * Calculate ATR as percentage of price
 */
export function calculateATRPercent(ohlcData, period = DEFAULT_PERIODS.ATR) {
  if (!ohlcData || ohlcData.length < period + 1) return null;

  const atr = calculateATR(ohlcData, period);
  if (atr === null) return null;

  const currentPrice = ohlcData[0].close;
  if (currentPrice <= 0) return null;

  return Number(((atr / currentPrice) * 100).toFixed(2));
}

/**
 * Calculate historical volatility (standard deviation of returns)
 */
export function calculateVolatility(prices, period = 20) {
  if (!prices || prices.length < period + 1) return null;

  // Calculate daily returns
  const returns = [];
  for (let i = 0; i < period; i++) {
    if (prices[i + 1] && prices[i + 1] > 0) {
      returns.push((prices[i] - prices[i + 1]) / prices[i + 1]);
    }
  }

  if (returns.length < period - 1) return null;

  // Calculate mean return
  const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;

  // Calculate variance
  const variance = returns.reduce((acc, r) => acc + Math.pow(r - meanReturn, 2), 0) / returns.length;

  // Standard deviation (daily volatility)
  const dailyVol = Math.sqrt(variance);

  // Annualized volatility (assuming 252 trading days)
  const annualizedVol = dailyVol * Math.sqrt(252);

  return Number((annualizedVol * 100).toFixed(2));
}

// ============================================
// RELATIVE VOLUME (RVOL)
// ============================================

/**
 * Calculate Relative Volume (RVOL)
 * RVOL = Current Volume / Average Volume (20-day SMA)
 *
 * Uses a 7-tier institutional classification scale:
 * - < 0.5: Very Low (unsustainable moves)
 * - 0.5–0.75: Below Average (low conviction)
 * - 0.75–1.25: Normal (balanced auction)
 * - 1.25–2.5: Elevated (increased interest, "in-play")
 * - 2.5–4.0: High Institutional (strong conviction, breakout fuel)
 * - > 4.0: Climax/Exhaustion (potential blow-off top or selling climax)
 *
 * @param {Array} ohlcvData - OHLCV candles (newest first)
 * @param {number} period - Lookback period for average (default 20)
 * @returns {Object} RVOL data with value, classification, and metadata
 */
export function calculateRVOL(ohlcvData, period = DEFAULT_PERIODS.RVOL) {
  if (!ohlcvData || ohlcvData.length < period + 1) {
    return { value: null, label: 'Insufficient data', tier: 'UNKNOWN', isHigh: false, isClimax: false };
  }

  const currentVolume = ohlcvData[0].volume;

  // Average volume over the lookback period (excluding current day)
  const historicalVolumes = ohlcvData.slice(1, period + 1).map(c => c.volume);
  const validVolumes = historicalVolumes.filter(v => v > 0);

  if (validVolumes.length < Math.floor(period / 2)) {
    return { value: null, label: 'No volume data', tier: 'UNKNOWN', isHigh: false, isClimax: false };
  }

  const avgVolume = validVolumes.reduce((sum, v) => sum + v, 0) / validVolumes.length;

  if (avgVolume === 0) {
    return { value: null, label: 'No volume data', tier: 'UNKNOWN', isHigh: false, isClimax: false };
  }

  const rvol = currentVolume / avgVolume;

  // 7-tier institutional classification
  let label, tier, isHigh, isClimax;
  if (rvol > 4.0) {
    label = 'Climax/Exhaustion — Potential blow-off or selling climax';
    tier = 'CLIMAX';
    isHigh = true;
    isClimax = true;
  } else if (rvol >= 2.5) {
    label = 'High Institutional — Strong conviction, breakout-grade volume';
    tier = 'INSTITUTIONAL';
    isHigh = true;
    isClimax = false;
  } else if (rvol >= 1.25) {
    label = 'Elevated — Increased interest, stock is "in-play"';
    tier = 'ELEVATED';
    isHigh = false;
    isClimax = false;
  } else if (rvol >= 0.75) {
    label = 'Normal — Balanced auction, typical participation';
    tier = 'NORMAL';
    isHigh = false;
    isClimax = false;
  } else if (rvol >= 0.5) {
    label = 'Below Average — Low conviction move';
    tier = 'LOW';
    isHigh = false;
    isClimax = false;
  } else {
    label = 'Very Low — Extremely thin participation, move likely unsustainable';
    tier = 'VERY_LOW';
    isHigh = false;
    isClimax = false;
  }

  return {
    value: parseFloat(rvol.toFixed(2)),
    label,
    tier,
    isHigh,
    isClimax,
    currentVolume,
    avgVolume: Math.round(avgVolume)
  };
}

// ============================================
// COMPREHENSIVE ANALYSIS
// ============================================

/**
 * Calculate all technical indicators for a symbol
 * @param {string} symbol - Stock/crypto symbol
 * @param {number[]} prices - Array of closing prices (newest first)
 * @param {object[]} ohlcData - Optional OHLC data for ATR
 * @returns {object} All technical indicators
 */
export function calculateAllIndicators(symbol, prices, ohlcData = null) {
  // Check cache first
  const cached = cacheService.get('technicals', symbol);
  if (cached) {
    return cached;
  }

  const currentPrice = prices && prices.length > 0 ? prices[0] : null;

  const result = {
    symbol,
    currentPrice,
    calculatedAt: new Date().toISOString(),

    // Moving Averages
    movingAverages: calculateMovingAverages(prices),

    // RSI
    rsi: calculateRSI(prices),
    rsiSignal: getRSISignal(calculateRSI(prices)),

    // MACD
    macd: calculateMACD(prices),
    macdSignal: getMACDSignal(calculateMACD(prices)),

    // Bollinger Bands
    bollingerBands: calculateBollingerBands(prices),
    bollingerSignal: getBollingerSignal(calculateBollingerBands(prices), currentPrice),

    // Volatility
    volatility: calculateVolatility(prices),
    atr: ohlcData ? calculateATR(ohlcData) : null,
    atrPercent: ohlcData ? calculateATRPercent(ohlcData) : null,

    // Relative Volume
    rvol: ohlcData ? calculateRVOL(ohlcData) : null,

    // Trend detection
    trend: detectTrend(prices)
  };

  // Cache with AGGRESSIVE tier (24 hours)
  cacheService.set('technicals', symbol, result);

  return result;
}

/**
 * Simple trend detection based on moving averages
 */
export function detectTrend(prices) {
  if (!prices || prices.length < 50) {
    return { direction: 'unknown', strength: 0 };
  }

  const sma20 = calculateSMA(prices, 20);
  const sma50 = calculateSMA(prices, 50);
  const currentPrice = prices[0];

  if (sma20 === null || sma50 === null) {
    return { direction: 'unknown', strength: 0 };
  }

  // Bullish: price > SMA20 > SMA50
  // Bearish: price < SMA20 < SMA50
  if (currentPrice > sma20 && sma20 > sma50) {
    const strength = (currentPrice - sma50) / sma50;
    return { direction: 'bullish', strength: Math.min(strength, 1) };
  } else if (currentPrice < sma20 && sma20 < sma50) {
    const strength = (sma50 - currentPrice) / sma50;
    return { direction: 'bearish', strength: Math.min(strength, 1) };
  } else {
    return { direction: 'sideways', strength: 0.5 };
  }
}

/**
 * Get a simple bull/bear score (-100 to +100)
 */
export function getBullBearScore(indicators) {
  if (!indicators) return 0;

  let score = 0;
  let factors = 0;

  // RSI contribution (-20 to +20)
  if (indicators.rsi !== null) {
    if (indicators.rsi > 70) score -= 20;
    else if (indicators.rsi < 30) score += 20;
    else score += (50 - indicators.rsi) * 0.4; // Scale 30-70 to -8 to +8
    factors++;
  }

  // MACD contribution (-20 to +20)
  if (indicators.macd) {
    score += indicators.macd.histogram > 0 ? 20 : -20;
    factors++;
  }

  // Bollinger contribution (-20 to +20)
  if (indicators.bollingerBands) {
    const { percentB } = indicators.bollingerBands;
    if (percentB < 0.2) score += 20;
    else if (percentB > 0.8) score -= 20;
    else score += (0.5 - percentB) * 40;
    factors++;
  }

  // Trend contribution (-40 to +40)
  if (indicators.trend) {
    if (indicators.trend.direction === 'bullish') {
      score += 40 * indicators.trend.strength;
    } else if (indicators.trend.direction === 'bearish') {
      score -= 40 * indicators.trend.strength;
    }
    factors++;
  }

  // Normalize to -100 to +100
  return factors > 0 ? Math.round(score) : 0;
}

// ============================================
// BATCH PROCESSING
// ============================================

/**
 * Calculate indicators for multiple symbols
 */
export async function calculateIndicatorsBatch(symbolsWithPrices) {
  const results = {};

  for (const { symbol, prices, ohlcData } of symbolsWithPrices) {
    results[symbol] = calculateAllIndicators(symbol, prices, ohlcData);
  }

  return results;
}

/**
 * Clear all cached technical indicators
 */
export function clearTechnicalsCache() {
  cacheService.clearType('technicals');
}

export default {
  calculateSMA,
  calculateRollingSMA,
  calculateEMA,
  calculateMovingAverages,
  calculateRSI,
  getRSISignal,
  calculateMACD,
  getMACDSignal,
  calculateBollingerBands,
  getBollingerSignal,
  calculateATR,
  calculateATRPercent,
  calculateVolatility,
  calculateRVOL,
  calculateAllIndicators,
  detectTrend,
  getBullBearScore,
  calculateIndicatorsBatch,
  clearTechnicalsCache
};
