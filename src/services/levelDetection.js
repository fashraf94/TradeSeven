/**
 * Level Detection Service
 * Identifies high-quality support/resistance levels with explanations
 * Only displays levels with at least 2 technical factors supporting them
 */

/**
 * Detect and score support/resistance levels
 * @param {Array} dailyData - OHLCV data (daily timeframe)
 * @param {Object} indicators - Calculated technical indicators
 * @returns {Object} Scored levels with explanations { support, resistance, currentPrice }
 */
export const detectLevels = (dailyData, indicators) => {
  if (!dailyData?.length) return { support: [], resistance: [], currentPrice: 0 };

  const currentPrice = dailyData[0]?.close; // Most recent candle first
  const potentialLevels = [];

  // 1. Moving Average Levels
  const maLevels = getMovingAverageLevels(indicators, currentPrice);
  potentialLevels.push(...maLevels);

  // 2. Fibonacci Levels
  const fibLevels = getFibonacciLevels(dailyData, currentPrice);
  potentialLevels.push(...fibLevels);

  // 3. Swing High/Low Levels
  const swingLevels = getSwingLevels(dailyData, currentPrice);
  potentialLevels.push(...swingLevels);

  // 4. Round Number Levels (psychological)
  const roundLevels = getRoundNumberLevels(currentPrice);
  potentialLevels.push(...roundLevels);

  // 5. Volume Profile Levels (if volume data available)
  const volumeLevels = getVolumeLevels(dailyData, currentPrice);
  potentialLevels.push(...volumeLevels);

  // Cluster nearby levels and calculate confluence
  const clusteredLevels = clusterLevels(potentialLevels, currentPrice);

  // Filter to only high-quality levels (2+ factors)
  const qualityLevels = clusteredLevels.filter(level => level.factors.length >= 2);

  // Separate into support and resistance
  const support = qualityLevels
    .filter(l => l.price < currentPrice)
    .sort((a, b) => b.price - a.price) // Closest first
    .slice(0, 4); // Top 4 support levels

  const resistance = qualityLevels
    .filter(l => l.price >= currentPrice)
    .sort((a, b) => a.price - b.price) // Closest first
    .slice(0, 4); // Top 4 resistance levels

  return { support, resistance, currentPrice };
};

/**
 * Get moving average levels
 */
const getMovingAverageLevels = (indicators, currentPrice) => {
  const levels = [];

  if (indicators?.sma20) {
    levels.push({
      price: indicators.sma20,
      type: currentPrice > indicators.sma20 ? 'SUPPORT' : 'RESISTANCE',
      factor: {
        name: '20-day SMA',
        description: 'Short-term moving average tracking recent price momentum',
        weight: 20,
      },
    });
  }

  if (indicators?.sma50?.value) {
    levels.push({
      price: indicators.sma50.value,
      type: currentPrice > indicators.sma50.value ? 'SUPPORT' : 'RESISTANCE',
      factor: {
        name: '50-day SMA',
        description: 'Medium-term trend indicator widely watched by institutions',
        weight: 30,
      },
    });
  }

  if (indicators?.sma200) {
    levels.push({
      price: indicators.sma200,
      type: currentPrice > indicators.sma200 ? 'SUPPORT' : 'RESISTANCE',
      factor: {
        name: '200-day SMA',
        description: 'Major long-term trend line - institutional benchmark for bull/bear markets',
        weight: 35,
      },
    });
  }

  return levels;
};

/**
 * Calculate Fibonacci retracement levels
 */
const getFibonacciLevels = (dailyData, currentPrice) => {
  if (dailyData.length < 30) return [];

  // Use last 60 days for swing range
  const recent = dailyData.slice(0, 60);
  const high = Math.max(...recent.map(c => c.high));
  const low = Math.min(...recent.map(c => c.low));
  const range = high - low;

  // Skip if range is too small (< 5%)
  if (range / low < 0.05) return [];

  const isUptrend = currentPrice > (high + low) / 2;

  const fibRatios = [
    { level: '38.2%', ratio: 0.382, weight: 20 },
    { level: '50%', ratio: 0.5, weight: 25 },
    { level: '61.8%', ratio: 0.618, weight: 30 },
  ];

  return fibRatios.map(fib => {
    const price = isUptrend
      ? high - (range * fib.ratio)
      : low + (range * fib.ratio);

    return {
      price,
      type: currentPrice > price ? 'SUPPORT' : 'RESISTANCE',
      factor: {
        name: `Fibonacci ${fib.level}`,
        description: `Key Fibonacci retracement level from recent ${isUptrend ? 'swing high' : 'swing low'}`,
        weight: fib.weight,
      },
    };
  });
};

/**
 * Find swing high/low levels
 */
const getSwingLevels = (dailyData, currentPrice) => {
  const levels = [];
  const lookback = 5;

  // Data is newest first, so iterate in reverse for chronological analysis
  const chronological = [...dailyData].reverse();

  for (let i = lookback; i < chronological.length - lookback; i++) {
    const current = chronological[i];
    const before = chronological.slice(i - lookback, i);
    const after = chronological.slice(i + 1, i + lookback + 1);

    // Swing Low
    if (before.every(c => c.low >= current.low) &&
        after.every(c => c.low >= current.low)) {
      levels.push({
        price: current.low,
        type: currentPrice > current.low ? 'SUPPORT' : 'RESISTANCE',
        factor: {
          name: 'Swing Low',
          description: `Price bounced from $${current.low.toFixed(2)} on ${formatDate(current.date)}`,
          weight: 25,
          date: current.date,
        },
      });
    }

    // Swing High
    if (before.every(c => c.high <= current.high) &&
        after.every(c => c.high <= current.high)) {
      levels.push({
        price: current.high,
        type: currentPrice > current.high ? 'SUPPORT' : 'RESISTANCE',
        factor: {
          name: 'Swing High',
          description: `Price rejected from $${current.high.toFixed(2)} on ${formatDate(current.date)}`,
          weight: 25,
          date: current.date,
        },
      });
    }
  }

  // Keep only most recent swing points (already chronological, take last 3 of each)
  const swingLows = levels
    .filter(l => l.factor.name === 'Swing Low')
    .slice(-3);
  const swingHighs = levels
    .filter(l => l.factor.name === 'Swing High')
    .slice(-3);

  return [...swingLows, ...swingHighs];
};

/**
 * Get psychological round number levels
 */
const getRoundNumberLevels = (currentPrice) => {
  const levels = [];

  // Determine round number intervals based on price magnitude
  let interval;
  if (currentPrice > 1000) interval = 100;
  else if (currentPrice > 500) interval = 50;
  else if (currentPrice > 100) interval = 25;
  else if (currentPrice > 50) interval = 10;
  else interval = 5;

  // Find nearby round numbers
  const nearestBelow = Math.floor(currentPrice / interval) * interval;
  const nearestAbove = Math.ceil(currentPrice / interval) * interval;

  // Only include if within 5% of current price
  if (Math.abs(nearestBelow - currentPrice) / currentPrice < 0.05) {
    levels.push({
      price: nearestBelow,
      type: 'SUPPORT',
      factor: {
        name: 'Psychological Level',
        description: `Round number at $${nearestBelow} - traders often place orders at round numbers`,
        weight: 10,
      },
    });
  }

  if (Math.abs(nearestAbove - currentPrice) / currentPrice < 0.05 && nearestAbove !== nearestBelow) {
    levels.push({
      price: nearestAbove,
      type: 'RESISTANCE',
      factor: {
        name: 'Psychological Level',
        description: `Round number at $${nearestAbove} - traders often place orders at round numbers`,
        weight: 10,
      },
    });
  }

  return levels;
};

/**
 * Get volume-based levels (areas of high trading activity)
 */
const getVolumeLevels = (dailyData, currentPrice) => {
  const levels = [];

  // Check if we have volume data
  const hasVolume = dailyData.some(c => c.volume && c.volume > 0);
  if (!hasVolume) return levels;

  // Calculate volume-weighted price zones
  const priceVolume = {};
  const priceStep = currentPrice * 0.01; // 1% price buckets

  dailyData.forEach(candle => {
    if (!candle.volume) return;

    const avgPrice = (candle.high + candle.low) / 2;
    const bucket = Math.round(avgPrice / priceStep) * priceStep;

    priceVolume[bucket] = (priceVolume[bucket] || 0) + candle.volume;
  });

  // Find high volume nodes
  const sortedZones = Object.entries(priceVolume)
    .map(([price, volume]) => ({ price: parseFloat(price), volume }))
    .sort((a, b) => b.volume - a.volume);

  // Top 3 volume nodes within 10% of current price
  const nearbyHighVolume = sortedZones
    .filter(z => Math.abs(z.price - currentPrice) / currentPrice < 0.10)
    .slice(0, 3);

  nearbyHighVolume.forEach(zone => {
    levels.push({
      price: zone.price,
      type: zone.price < currentPrice ? 'SUPPORT' : 'RESISTANCE',
      factor: {
        name: 'High Volume Node',
        description: 'Area of significant historical trading activity - price may find support or resistance here',
        weight: 15,
      },
    });
  });

  return levels;
};

/**
 * Cluster nearby levels and calculate confluence
 */
const clusterLevels = (levels, currentPrice) => {
  const clusters = [];
  const threshold = currentPrice * 0.015; // 1.5% clustering threshold

  // Store original level prices for weighted average calculation
  const levelPriceMap = new Map();
  levels.forEach(level => {
    levelPriceMap.set(level.factor, level.price);
  });

  levels.forEach(level => {
    // Find existing cluster within threshold
    const existingCluster = clusters.find(
      c => Math.abs(c.price - level.price) < threshold
    );

    if (existingCluster) {
      // Add factor to existing cluster
      existingCluster.factors.push(level.factor);
      existingCluster.originalPrices.push(level.price);

      // Update cluster price to weighted average
      const totalWeight = existingCluster.factors.reduce((sum, f) => sum + f.weight, 0);
      existingCluster.price = existingCluster.factors.reduce(
        (sum, f, i) => sum + existingCluster.originalPrices[i] * f.weight,
        0
      ) / totalWeight;
    } else {
      // Create new cluster
      clusters.push({
        price: level.price,
        type: level.type,
        factors: [level.factor],
        originalPrices: [level.price],
      });
    }
  });

  // Calculate confluence score and generate explanations
  return clusters.map(cluster => {
    const totalWeight = cluster.factors.reduce((sum, f) => sum + f.weight, 0);
    const maxPossibleWeight = 100; // Theoretical max

    // Clean up - remove originalPrices from final output
    const { originalPrices, ...cleanCluster } = cluster;

    return {
      ...cleanCluster,
      confluenceScore: Math.min(100, Math.round((totalWeight / maxPossibleWeight) * 100)),
      strength: totalWeight >= 50 ? 'STRONG' : totalWeight >= 30 ? 'MODERATE' : 'WEAK',
      priceRange: {
        low: cluster.price * 0.995,
        high: cluster.price * 1.005,
      },
      explanation: generateLevelExplanation(cluster),
      distanceFromCurrent: ((cluster.price - currentPrice) / currentPrice * 100).toFixed(2),
    };
  });
};

/**
 * Generate human-readable explanation for a level
 */
const generateLevelExplanation = (cluster) => {
  const factorNames = cluster.factors.map(f => f.name);

  if (factorNames.length === 1) {
    return cluster.factors[0].description;
  }

  const primaryFactor = cluster.factors.reduce(
    (max, f) => f.weight > max.weight ? f : max,
    cluster.factors[0]
  );

  const otherFactors = factorNames.filter(n => n !== primaryFactor.name);

  return `${primaryFactor.description}. This level is strengthened by ${otherFactors.length} additional factor${otherFactors.length > 1 ? 's' : ''}: ${otherFactors.join(', ')}.`;
};

/**
 * Format date for display
 */
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export default detectLevels;
