/**
 * Chart utility functions for Research modal StockChart
 * Extracted from TechnicalAnalysis/CandlestickChart.jsx for reuse
 */

// Strict validation for numeric values
export const isValidNumber = (val) => {
  if (val === null || val === undefined || val === '') return false;
  const num = typeof val === 'number' ? val : parseFloat(val);
  return Number.isFinite(num) && num > 0;
};

/**
 * Convert various time formats to what lightweight-charts expects:
 * - Unix timestamp in SECONDS for intraday
 * - 'YYYY-MM-DD' string for daily data
 */
export const formatTime = (dateValue, isIntraday = false) => {
  if (!dateValue) return null;

  if (typeof dateValue === 'number' && dateValue < 9999999999) {
    return dateValue;
  }
  if (typeof dateValue === 'number' && dateValue > 9999999999) {
    return Math.floor(dateValue / 1000);
  }

  if (typeof dateValue === 'string') {
    if (isIntraday || dateValue.includes('T') || dateValue.includes(':')) {
      const timestamp = new Date(dateValue).getTime();
      if (isNaN(timestamp)) return null;
      return Math.floor(timestamp / 1000);
    }
    return dateValue.split('T')[0];
  }

  return null;
};

// Validate raw OHLCV candle before transformation
export const isValidRawCandle = (candle) => {
  if (!candle) return false;
  const hasDate = candle.date || candle.datetime || candle.timestamp;
  if (!hasDate) return false;
  return (
    isValidNumber(candle.open) &&
    isValidNumber(candle.high) &&
    isValidNumber(candle.low) &&
    isValidNumber(candle.close)
  );
};

// Validate formatted candle (after transformation for lightweight-charts)
export const isValidFormattedCandle = (candle) => {
  if (!candle || !candle.time) return false;
  const validTime = typeof candle.time === 'number'
    ? Number.isFinite(candle.time) && candle.time > 0
    : typeof candle.time === 'string' && candle.time.length > 0;
  return validTime &&
    Number.isFinite(candle.open) && candle.open > 0 &&
    Number.isFinite(candle.high) && candle.high > 0 &&
    Number.isFinite(candle.low) && candle.low > 0 &&
    Number.isFinite(candle.close) && candle.close > 0;
};

/**
 * Remove consecutive duplicate timestamps from sorted data.
 * lightweight-charts crashes on duplicate timestamps.
 */
export const deduplicateByTime = (sortedData) => {
  if (!sortedData || sortedData.length <= 1) return sortedData;
  const result = [sortedData[0]];
  for (let i = 1; i < sortedData.length; i++) {
    if (sortedData[i].time !== sortedData[i - 1].time) {
      result.push(sortedData[i]);
    }
  }
  return result;
};

/**
 * Aggregate weekly OHLCV candles into monthly candles.
 * Groups by YYYY-MM from each candle's date, taking:
 * - open: first candle's open
 * - high: max of all highs
 * - low: min of all lows
 * - close: last candle's close
 * - volume: sum of all volumes
 *
 * @param {Array} weeklyData - Weekly candles (oldest-first)
 * @returns {Array} Monthly candles (oldest-first)
 */
export const aggregateToMonthly = (weeklyData) => {
  if (!weeklyData || weeklyData.length === 0) return [];

  const months = {};
  const monthOrder = [];

  weeklyData.forEach(candle => {
    const dateStr = candle.date || candle.datetime || '';
    const ym = dateStr.substring(0, 7); // 'YYYY-MM'
    if (!ym || ym.length < 7) return;

    if (!months[ym]) {
      months[ym] = {
        date: `${ym}-01`, // First of month
        open: Number(candle.open),
        high: Number(candle.high),
        low: Number(candle.low),
        close: Number(candle.close),
        volume: Number(candle.volume) || 0,
      };
      monthOrder.push(ym);
    } else {
      const m = months[ym];
      m.high = Math.max(m.high, Number(candle.high));
      m.low = Math.min(m.low, Number(candle.low));
      m.close = Number(candle.close);
      m.volume += Number(candle.volume) || 0;
    }
  });

  return monthOrder.map(ym => months[ym]);
};

/**
 * Transform raw OHLCV data (from API, newest-first) into
 * chart-ready format (oldest-first, validated, deduplicated).
 *
 * @param {Array} rawData - OHLCV candles from fetchHistoricalOHLCV (newest-first)
 * @returns {Array} Chart-ready candles (oldest-first) with { time, open, high, low, close, volume }
 */
export const prepareChartData = (rawData) => {
  if (!rawData || rawData.length === 0) return [];

  const isIntraday = (() => {
    const sample = rawData[0];
    const d = sample?.date || sample?.datetime || '';
    return typeof d === 'string' && (d.includes('T') || d.includes(':'));
  })();

  // Filter valid candles
  const valid = rawData.filter(isValidRawCandle);

  // Transform to lightweight-charts format
  const formatted = valid.map(candle => {
    const rawTime = candle.date || candle.datetime || candle.timestamp;
    const time = formatTime(rawTime, isIntraday);
    if (!time) return null;
    return {
      time,
      open: Number(candle.open),
      high: Number(candle.high),
      low: Number(candle.low),
      close: Number(candle.close),
      volume: Number(candle.volume) || 0,
    };
  }).filter(c => c !== null && isValidFormattedCandle(c));

  // Sort oldest-first (ascending time)
  formatted.sort((a, b) => {
    const tA = typeof a.time === 'number' ? a.time : new Date(a.time).getTime() / 1000;
    const tB = typeof b.time === 'number' ? b.time : new Date(b.time).getTime() / 1000;
    return tA - tB;
  });

  return deduplicateByTime(formatted);
};

/**
 * Calculate 7 bomb-level price lines from a baseline price and threshold percentage.
 * Used by StockChart in "bomb" timeframe view to show BaggerBomb scoring zones.
 *
 * @param {number} baselinePrice - The locked/baseline price for the asset
 * @param {number} threshold - The threshold percentage (e.g. 2.5 for 2.5%)
 * @returns {Array} 7 level objects with { price, label, tier, color, lineWidth, lineStyle, points }
 */
export function calculateBombLevels(baselinePrice, threshold) {
  if (!baselinePrice || !threshold || baselinePrice <= 0 || threshold <= 0) return [];
  const pct = threshold / 100;
  return [
    { price: baselinePrice * (1 + pct * 2.0), label: '\uD83D\uDD25 +50 pts', tier: 'tenBagger',    color: '#ffd700', lineWidth: 1.5, lineStyle: 0, points: 50 },
    { price: baselinePrice * (1 + pct * 1.5), label: '\uD83D\uDCA3\uD83D\uDCA3 +30 pts', tier: 'doubleBagger', color: '#ff9500', lineWidth: 1.5, lineStyle: 0, points: 30 },
    { price: baselinePrice * (1 + pct * 1.0), label: '\uD83D\uDCA3 +15 pts', tier: 'bagger',        color: '#00ff88', lineWidth: 2,   lineStyle: 0, points: 15 },
    { price: baselinePrice,                    label: 'Baseline',   tier: 'baseline',      color: 'rgba(255,255,255,0.3)', lineWidth: 1, lineStyle: 2, points: 0 },
    { price: baselinePrice * (1 - pct * 1.0), label: '-10 pts',    tier: 'bust',           color: 'rgba(239, 68, 68, 0.5)', lineWidth: 1, lineStyle: 2, points: -10 },
    { price: baselinePrice * (1 - pct * 1.5), label: '-20 pts',    tier: 'crash',          color: 'rgba(239, 68, 68, 0.6)', lineWidth: 1, lineStyle: 2, points: -20 },
    { price: baselinePrice * (1 - pct * 2.0), label: '-35 pts',    tier: 'meltdown',       color: 'rgba(239, 68, 68, 0.7)', lineWidth: 1.5, lineStyle: 2, points: -35 },
  ];
}
