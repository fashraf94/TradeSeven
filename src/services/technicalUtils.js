/**
 * Shared Technical Analysis Utilities
 * Common calculations used across confluence detection and level detection
 */

/**
 * Standard Fibonacci ratios with descriptions
 */
export const FIBONACCI_RATIOS = [
  { level: '23.6%', ratio: 0.236, weight: 15 },
  { level: '38.2%', ratio: 0.382, weight: 20 },
  { level: '50%', ratio: 0.5, weight: 25 },
  { level: '61.8%', ratio: 0.618, weight: 30 },
  { level: '78.6%', ratio: 0.786, weight: 15 },
];

/**
 * Calculate Fibonacci retracement levels from OHLCV data
 * @param {Array} data - OHLCV data (newest first)
 * @param {Object} options - Configuration options
 * @param {number} options.lookbackCandles - Number of candles to analyze (default: 60)
 * @param {number} options.minRangePercent - Minimum range % to calculate fibs (default: 0.05)
 * @param {Array} options.ratios - Custom ratios to use (default: standard ratios)
 * @returns {Array} Fibonacci level objects { level, ratio, price, isUptrend }
 */
export const calculateFibonacciLevels = (data, options = {}) => {
  const {
    lookbackCandles = 60,
    minRangePercent = 0.02,
    ratios = FIBONACCI_RATIOS,
  } = options;

  if (!data?.length || data.length < 20) return [];

  const currentPrice = data[0].close;

  // Use swing points for proper anchor detection
  const { swingHighs, swingLows } = detectSwingPoints(data, {
    lookback: 5,
    clusterThreshold: 0.01,
    maxResults: 3,
  });

  let high = swingHighs.length > 0 ? swingHighs[0].price : null;
  let low = swingLows.length > 0 ? swingLows[0].price : null;

  // If price has broken beyond swings, use current price as provisional anchor
  if (high !== null && currentPrice > high) high = currentPrice;
  if (low !== null && currentPrice < low) low = currentPrice;

  // Fallback: if no swings found, use dataset extremes
  if (high === null || low === null) {
    const recent = data.slice(0, lookbackCandles);
    high = high ?? Math.max(...recent.map(c => c.high));
    low = low ?? Math.min(...recent.map(c => c.low));
  }

  // Guard: high must be > low
  if (high <= low) {
    const recent = data.slice(0, lookbackCandles);
    high = Math.max(...recent.map(c => c.high));
    low = Math.min(...recent.map(c => c.low));
  }

  const range = high - low;

  // Skip if range is too small
  if (range / low < minRangePercent) return [];

  const isUptrend = currentPrice > (high + low) / 2;

  return ratios.map(fib => ({
    level: fib.level,
    ratio: fib.ratio,
    weight: fib.weight,
    price: isUptrend ? high - (range * fib.ratio) : low + (range * fib.ratio),
    isUptrend,
    swingHigh: high,
    swingLow: low,
  }));
};

/**
 * Find swing high and low points in OHLCV data
 * @param {Array} data - OHLCV data (newest first)
 * @param {Object} options - Configuration options
 * @param {number} options.lookback - Candles on each side to confirm swing (default: 5)
 * @param {number} options.clusterThreshold - Price % to cluster similar levels (default: 0.01)
 * @param {number} options.maxResults - Max swing points per type (default: 3)
 * @returns {Object} { swingHighs: Array, swingLows: Array }
 */
export const detectSwingPoints = (data, options = {}) => {
  const {
    lookback = 5,
    clusterThreshold = 0.01,
    maxResults = 3,
  } = options;

  if (!data?.length || data.length < lookback * 2 + 1) {
    return { swingHighs: [], swingLows: [] };
  }

  const swingHighs = [];
  const swingLows = [];

  // Data is newest first, iterate through with lookback on both sides
  for (let i = lookback; i < data.length - lookback; i++) {
    const current = data[i];
    const before = data.slice(i - lookback, i); // More recent candles (lower indices)
    const after = data.slice(i + 1, i + lookback + 1); // Older candles (higher indices)

    // Swing Low: current low is lower than all surrounding candles
    if (before.every(c => c.low >= current.low) &&
        after.every(c => c.low >= current.low)) {
      swingLows.push({
        price: current.low,
        index: i,
        date: current.date,
        touches: 1,
      });
    }

    // Swing High: current high is higher than all surrounding candles
    if (before.every(c => c.high <= current.high) &&
        after.every(c => c.high <= current.high)) {
      swingHighs.push({
        price: current.high,
        index: i,
        date: current.date,
        touches: 1,
      });
    }
  }

  // Cluster nearby levels and count touches
  const clusterPoints = (points) => {
    const clustered = [];
    points.forEach(point => {
      const existing = clustered.find(p =>
        Math.abs(p.price - point.price) / point.price < clusterThreshold
      );
      if (existing) {
        existing.touches++;
        // Keep the more recent date
        if (point.index < existing.index) {
          existing.index = point.index;
          existing.date = point.date;
        }
      } else {
        clustered.push({ ...point });
      }
    });
    return clustered.slice(0, maxResults);
  };

  return {
    swingHighs: clusterPoints(swingHighs),
    swingLows: clusterPoints(swingLows),
  };
};

/**
 * Calculate distance from current price as percentage
 * @param {number} currentPrice - Current price
 * @param {number} targetPrice - Target price level
 * @returns {string} Formatted percentage string (e.g., "+2.50%" or "-1.25%")
 */
export const calculatePriceDistance = (currentPrice, targetPrice) => {
  const distance = ((targetPrice - currentPrice) / currentPrice) * 100;
  const sign = distance >= 0 ? '+' : '';
  return `${sign}${distance.toFixed(2)}%`;
};

/**
 * Determine if a price level acts as support or resistance
 * @param {number} currentPrice - Current price
 * @param {number} levelPrice - Price level to check
 * @returns {string} 'SUPPORT' or 'RESISTANCE'
 */
export const determineLevelType = (currentPrice, levelPrice) => {
  return currentPrice > levelPrice ? 'SUPPORT' : 'RESISTANCE';
};

/**
 * Format a date string for display
 * @param {string} dateStr - ISO date string or date format
 * @returns {string} Formatted date (e.g., "Jan 15")
 */
export const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

/**
 * Check if two prices are within a threshold of each other
 * @param {number} price1 - First price
 * @param {number} price2 - Second price
 * @param {number} thresholdPercent - Threshold as decimal (e.g., 0.015 for 1.5%)
 * @returns {boolean}
 */
export const pricesAreNear = (price1, price2, thresholdPercent = 0.015) => {
  return Math.abs(price1 - price2) / price1 < thresholdPercent;
};

export default {
  calculateFibonacciLevels,
  detectSwingPoints,
  calculatePriceDistance,
  determineLevelType,
  formatDate,
  pricesAreNear,
  FIBONACCI_RATIOS,
};
