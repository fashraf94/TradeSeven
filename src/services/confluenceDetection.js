/**
 * Multi-Timeframe Confluence Detection Service
 * Identifies when micro patterns align with macro levels
 */

/**
 * Detect confluence zones by combining micro patterns with macro levels
 * @param {Array} selectedTimeframeData - OHLCV data for user's selected timeframe
 * @param {Array} dailyData - OHLCV data for daily (anchor) timeframe
 * @param {Object} dailyIndicators - Calculated indicators from daily data
 * @param {string} selectedTimeframe - '1h', '1d', or '1w'
 * @returns {Array} Confluence signals
 */
export const detectConfluence = (selectedTimeframeData, dailyData, dailyIndicators, selectedTimeframe, rvolData = null) => {
  const confluences = [];

  if (!selectedTimeframeData?.length || !dailyData?.length) {
    return confluences;
  }

  // Get macro levels from daily data
  const macroLevels = getMacroLevels(dailyData, dailyIndicators);

  // Get current price info from selected timeframe
  const currentPrice = selectedTimeframeData[0]?.close; // Data is newest first
  const recentCandles = selectedTimeframeData.slice(0, 20); // Last 20 candles (newest first)

  // Detect micro patterns on selected timeframe
  const microPatterns = detectMicroPatterns(recentCandles, selectedTimeframe, rvolData);

  // Find confluences: micro patterns near macro levels
  microPatterns.forEach(pattern => {
    macroLevels.forEach(level => {
      const distance = Math.abs(pattern.price - level.price) / level.price;

      // Within 1.5% = potential confluence
      if (distance < 0.015) {
        const strength = calculateConfluenceStrength(distance, pattern, level);

        confluences.push({
          id: `${pattern.type}-${level.type}-${level.price.toFixed(2)}`,
          strength, // 'STRONG', 'MODERATE', 'WEAK'

          // Micro pattern info
          microPattern: {
            type: pattern.type,
            name: pattern.name,
            timeframe: selectedTimeframe,
            price: pattern.price,
            description: pattern.description,
            bias: pattern.bias,
            quality: pattern.quality || null,
          },

          // Macro level info
          macroLevel: {
            type: level.type, // 'SUPPORT' or 'RESISTANCE'
            name: level.name,
            price: level.price,
            source: level.source, // 'SMA_50', 'SMA_200', 'FIBONACCI', etc.
          },

          // Combined analysis
          priceRange: {
            low: Math.min(pattern.price, level.price) * 0.995,
            high: Math.max(pattern.price, level.price) * 1.005,
          },

          currentPrice,
          distanceFromCurrent: ((currentPrice - level.price) / level.price * 100).toFixed(2),

          description: generateConfluenceDescription(pattern, level, selectedTimeframe),
          historicalContext: getHistoricalContext(pattern.type, level.source),

          // For tracking
          trackable: true,
          suggestedThesis: getSuggestedThesis(pattern, level),
        });
      }
    });
  });

  // Sort by strength and distance from current price
  return confluences.sort((a, b) => {
    const strengthOrder = { 'STRONG': 0, 'MODERATE': 1, 'WEAK': 2 };
    if (strengthOrder[a.strength] !== strengthOrder[b.strength]) {
      return strengthOrder[a.strength] - strengthOrder[b.strength];
    }
    return Math.abs(parseFloat(a.distanceFromCurrent)) - Math.abs(parseFloat(b.distanceFromCurrent));
  });
};

/**
 * Get macro support/resistance levels from daily data
 */
const getMacroLevels = (dailyData, indicators) => {
  const levels = [];
  if (!dailyData?.length) return levels;

  const currentPrice = dailyData[0]?.close; // Data is newest first

  // Moving Averages
  if (indicators?.sma20 && indicators.sma20 > 0) {
    levels.push({
      type: currentPrice > indicators.sma20 ? 'SUPPORT' : 'RESISTANCE',
      name: '20-day SMA',
      price: indicators.sma20,
      source: 'SMA_20',
      strength: 'MODERATE',
    });
  }

  if (indicators?.sma50?.value && indicators.sma50.value > 0) {
    levels.push({
      type: currentPrice > indicators.sma50.value ? 'SUPPORT' : 'RESISTANCE',
      name: '50-day SMA',
      price: indicators.sma50.value,
      source: 'SMA_50',
      strength: 'STRONG',
    });
  }

  if (indicators?.sma200 && indicators.sma200 > 0) {
    levels.push({
      type: currentPrice > indicators.sma200 ? 'SUPPORT' : 'RESISTANCE',
      name: '200-day SMA',
      price: indicators.sma200,
      source: 'SMA_200',
      strength: 'STRONG',
    });
  }

  // Recent swing highs/lows
  const swingPoints = findSwingPoints(dailyData);
  swingPoints.forEach(point => {
    levels.push({
      type: point.type,
      name: point.type === 'SUPPORT' ? 'Recent Swing Low' : 'Recent Swing High',
      price: point.price,
      source: 'SWING_POINT',
      strength: point.touches > 2 ? 'STRONG' : 'MODERATE',
    });
  });

  // Fibonacci levels (from recent swing)
  const fibLevels = calculateFibonacciLevels(dailyData);
  fibLevels.forEach(fib => {
    levels.push({
      type: currentPrice > fib.price ? 'SUPPORT' : 'RESISTANCE',
      name: `Fibonacci ${fib.level}`,
      price: fib.price,
      source: `FIBONACCI_${fib.level.replace('%', '')}`,
      strength: fib.level === '61.8%' || fib.level === '50%' ? 'STRONG' : 'MODERATE',
    });
  });

  return levels;
};

/**
 * Build RVOL context string for pattern quality metadata
 */
const buildRVOLContext = (rvolData) => {
  if (!rvolData || rvolData.value === null) return null;
  return `RVOL ${rvolData.value}x (${rvolData.tier})`;
};

/**
 * Detect micro patterns on the selected timeframe
 * @param {Array} candles - OHLCV candles (newest first)
 * @param {string} timeframe - '1h', '1d', or '1w'
 * @param {Object|null} rvolData - Pre-calculated RVOL data for context
 */
const detectMicroPatterns = (candles, timeframe, rvolData = null) => {
  const patterns = [];
  const len = candles.length;
  if (len < 5) return patterns;

  // Note: candles are newest first, so candles[0] is latest
  const latest = candles[0];
  const prev = candles[1];
  const prev2 = candles[2];
  const rvolContext = buildRVOLContext(rvolData);

  // Double Bottom Detection (look at last 10 candles)
  const recentSlice = candles.slice(0, 10);
  const recentLows = recentSlice.map(c => c.low);
  const minLow = Math.min(...recentLows);
  const lowTouches = recentLows.filter(l => Math.abs(l - minLow) / minLow < 0.005).length;
  if (lowTouches >= 2) {
    // Volume comparison between first and second touch
    const lowCandleIndices = recentSlice
      .map((c, i) => ({ index: i, low: c.low, volume: c.volume }))
      .filter(c => Math.abs(c.low - minLow) / minLow < 0.005);
    let volumeContext = null;
    if (lowCandleIndices.length >= 2) {
      // In newest-first: higher index = older candle
      const firstTouch = lowCandleIndices[lowCandleIndices.length - 1]; // oldest
      const secondTouch = lowCandleIndices[0]; // newest
      if (firstTouch.volume > 0 && secondTouch.volume > 0) {
        const volChange = ((secondTouch.volume - firstTouch.volume) / firstTouch.volume * 100).toFixed(0);
        volumeContext = secondTouch.volume < firstTouch.volume
          ? `Second low on ${Math.abs(volChange)}% lower volume — weakening selling pressure`
          : `Second low on ${volChange}% higher volume`;
      }
    }
    patterns.push({
      type: 'DOUBLE_BOTTOM',
      name: 'Double Bottom',
      price: minLow,
      description: `Double bottom forming near $${minLow.toFixed(2)}`,
      bias: 'BULLISH',
      quality: {
        bodyRatio: null,
        shadowRatio: null,
        isStrong: lowTouches >= 3,
        volumeContext,
        rvolContext,
        qualityNote: `${lowTouches} touches at support${volumeContext ? '. ' + volumeContext : ''}`,
      },
    });
  }

  // Double Top Detection
  const recentHighs = recentSlice.map(c => c.high);
  const maxHigh = Math.max(...recentHighs);
  const highTouches = recentHighs.filter(h => Math.abs(h - maxHigh) / maxHigh < 0.005).length;
  if (highTouches >= 2) {
    // Volume comparison between first and second peak
    const highCandleIndices = recentSlice
      .map((c, i) => ({ index: i, high: c.high, volume: c.volume }))
      .filter(c => Math.abs(c.high - maxHigh) / maxHigh < 0.005);
    let volumeContext = null;
    if (highCandleIndices.length >= 2) {
      const firstPeak = highCandleIndices[highCandleIndices.length - 1]; // oldest
      const secondPeak = highCandleIndices[0]; // newest
      if (firstPeak.volume > 0 && secondPeak.volume > 0) {
        const volChange = ((secondPeak.volume - firstPeak.volume) / firstPeak.volume * 100).toFixed(0);
        volumeContext = secondPeak.volume < firstPeak.volume
          ? `Second peak on ${Math.abs(volChange)}% lower volume — weakening conviction`
          : `Second peak on ${volChange}% higher volume`;
      }
    }
    patterns.push({
      type: 'DOUBLE_TOP',
      name: 'Double Top',
      price: maxHigh,
      description: `Double top forming near $${maxHigh.toFixed(2)}`,
      bias: 'BEARISH',
      quality: {
        bodyRatio: null,
        shadowRatio: null,
        isStrong: highTouches >= 3,
        volumeContext,
        rvolContext,
        qualityNote: `${highTouches} tests at resistance${volumeContext ? '. ' + volumeContext : ''}`,
      },
    });
  }

  // Hammer/Bullish Pin Bar (at lows)
  const bodySize = Math.abs(latest.close - latest.open);
  const lowerWick = Math.min(latest.open, latest.close) - latest.low;
  const upperWick = latest.high - Math.max(latest.open, latest.close);

  if (lowerWick > bodySize * 2 && upperWick < bodySize * 0.5 && bodySize > 0) {
    const shadowRatio = parseFloat((lowerWick / bodySize).toFixed(1));
    patterns.push({
      type: 'HAMMER',
      name: 'Hammer Candle',
      price: latest.low,
      description: `Bullish hammer pattern detected${shadowRatio >= 3 ? ' (strong)' : ''}`,
      bias: 'BULLISH',
      quality: {
        bodyRatio: null,
        shadowRatio,
        isStrong: shadowRatio >= 3,
        volumeContext: null,
        rvolContext,
        qualityNote: `Shadow-to-body ratio: ${shadowRatio}x`,
      },
    });
  }

  // Shooting Star/Bearish Pin Bar (at highs)
  if (upperWick > bodySize * 2 && lowerWick < bodySize * 0.5 && bodySize > 0) {
    const shadowRatio = parseFloat((upperWick / bodySize).toFixed(1));
    patterns.push({
      type: 'SHOOTING_STAR',
      name: 'Shooting Star',
      price: latest.high,
      description: `Bearish shooting star pattern detected${shadowRatio >= 3 ? ' (strong)' : ''}`,
      bias: 'BEARISH',
      quality: {
        bodyRatio: null,
        shadowRatio,
        isStrong: shadowRatio >= 3,
        volumeContext: null,
        rvolContext,
        qualityNote: `Shadow-to-body ratio: ${shadowRatio}x`,
      },
    });
  }

  // Bullish Engulfing
  if (prev && prev.close < prev.open && // Previous was bearish
      latest.close > latest.open && // Current is bullish
      latest.open < prev.close && // Opens below prev close
      latest.close > prev.open) { // Closes above prev open
    const prevBody = Math.abs(prev.close - prev.open);
    const currBody = Math.abs(latest.close - latest.open);
    const bodyRatio = prevBody > 0 ? parseFloat((currBody / prevBody).toFixed(1)) : null;
    const isStrong = bodyRatio !== null && bodyRatio >= 2.0;
    patterns.push({
      type: 'BULLISH_ENGULFING',
      name: 'Bullish Engulfing',
      price: latest.low,
      description: `Bullish engulfing pattern detected${isStrong ? ' (strong)' : ''}`,
      bias: 'BULLISH',
      quality: {
        bodyRatio,
        shadowRatio: null,
        isStrong,
        volumeContext: null,
        rvolContext,
        qualityNote: isStrong
          ? `Engulfing body ${bodyRatio}x prior candle`
          : `Engulfing body ${bodyRatio}x prior — marginal`,
      },
    });
  }

  // Bearish Engulfing
  if (prev && prev.close > prev.open && // Previous was bullish
      latest.close < latest.open && // Current is bearish
      latest.open > prev.close && // Opens above prev close
      latest.close < prev.open) { // Closes below prev open
    const prevBody = Math.abs(prev.close - prev.open);
    const currBody = Math.abs(latest.close - latest.open);
    const bodyRatio = prevBody > 0 ? parseFloat((currBody / prevBody).toFixed(1)) : null;
    const isStrong = bodyRatio !== null && bodyRatio >= 2.0;
    patterns.push({
      type: 'BEARISH_ENGULFING',
      name: 'Bearish Engulfing',
      price: latest.high,
      description: `Bearish engulfing pattern detected${isStrong ? ' (strong)' : ''}`,
      bias: 'BEARISH',
      quality: {
        bodyRatio,
        shadowRatio: null,
        isStrong,
        volumeContext: null,
        rvolContext,
        qualityNote: isStrong
          ? `Engulfing body ${bodyRatio}x prior candle`
          : `Engulfing body ${bodyRatio}x prior — marginal`,
      },
    });
  }

  // Higher Lows (uptrend confirmation) - check last 4 candles (newest first, so reverse logic)
  if (len >= 4) {
    const lows = candles.slice(0, 4).map(c => c.low);
    // lows[0] is newest, lows[3] is oldest
    if (lows[0] > lows[1] && lows[1] > lows[2] && lows[2] > lows[3]) {
      patterns.push({
        type: 'HIGHER_LOWS',
        name: 'Higher Lows',
        price: lows[0],
        description: 'Series of higher lows indicating uptrend',
        bias: 'BULLISH',
        quality: {
          bodyRatio: null,
          shadowRatio: null,
          isStrong: false,
          volumeContext: null,
          rvolContext,
          qualityNote: 'Trend continuation pattern',
        },
      });
    }
  }

  // Lower Highs (downtrend confirmation)
  if (len >= 4) {
    const highs = candles.slice(0, 4).map(c => c.high);
    // highs[0] is newest, highs[3] is oldest
    if (highs[0] < highs[1] && highs[1] < highs[2] && highs[2] < highs[3]) {
      patterns.push({
        type: 'LOWER_HIGHS',
        name: 'Lower Highs',
        price: highs[0],
        description: 'Series of lower highs indicating downtrend',
        bias: 'BEARISH',
        quality: {
          bodyRatio: null,
          shadowRatio: null,
          isStrong: false,
          volumeContext: null,
          rvolContext,
          qualityNote: 'Trend continuation pattern',
        },
      });
    }
  }

  // Doji (indecision)
  const range = latest.high - latest.low;
  if (range > 0 && bodySize / range < 0.1) {
    patterns.push({
      type: 'DOJI',
      name: 'Doji',
      price: (latest.high + latest.low) / 2,
      description: 'Doji candle showing indecision',
      bias: 'NEUTRAL',
      quality: {
        bodyRatio: null,
        shadowRatio: null,
        isStrong: false,
        volumeContext: null,
        rvolContext,
        qualityNote: 'Indecision candle',
      },
    });
  }

  return patterns;
};

/**
 * Calculate confluence strength based on distance and pattern/level quality
 */
const calculateConfluenceStrength = (distance, pattern, level) => {
  let score = 0;

  // Distance factor (closer = stronger)
  if (distance < 0.005) score += 3;      // Within 0.5%
  else if (distance < 0.01) score += 2;  // Within 1%
  else score += 1;                        // Within 1.5%

  // Level strength factor
  if (level.strength === 'STRONG') score += 2;
  else if (level.strength === 'MODERATE') score += 1;

  // Pattern type factor (some patterns are more reliable)
  const strongPatterns = ['DOUBLE_BOTTOM', 'DOUBLE_TOP', 'BULLISH_ENGULFING', 'BEARISH_ENGULFING'];
  if (strongPatterns.includes(pattern.type)) score += 2;
  else score += 1;

  // Quality factor: strong patterns (high body ratio, deep shadow, etc.) get a bonus
  if (pattern.quality?.isStrong) score += 1;

  // Determine strength
  if (score >= 6) return 'STRONG';
  if (score >= 4) return 'MODERATE';
  return 'WEAK';
};

/**
 * Generate human-readable confluence description
 */
const generateConfluenceDescription = (pattern, level, timeframe) => {
  const tfLabel = timeframe === '1h' ? 'hourly' : timeframe === '1d' ? 'daily' : 'weekly';

  return `${pattern.name} pattern detected on the ${tfLabel} chart near the ${level.name} at $${level.price.toFixed(2)}. ` +
    `When short-term patterns align with longer-term support/resistance levels, it often indicates a significant price reaction zone.`;
};

/**
 * Get historical context for pattern + level combination
 */
const getHistoricalContext = (patternType, levelSource) => {
  const contexts = {
    'DOUBLE_BOTTOM_SMA': 'Double bottoms at major moving averages have historically shown strong bounce rates in uptrending markets.',
    'DOUBLE_BOTTOM_FIBONACCI': 'Double bottoms at Fibonacci levels often mark significant reversal points.',
    'DOUBLE_TOP_SMA': 'Double tops at moving average resistance frequently lead to pullbacks.',
    'HAMMER_SMA': 'Hammer candles at major moving averages frequently precede short-term rallies.',
    'HAMMER_SWING': 'Hammer patterns at swing lows have approximately 60% reversal success rate.',
    'BULLISH_ENGULFING_SMA': 'Bullish engulfing patterns at support levels show strong follow-through historically.',
    'BULLISH_ENGULFING_FIBONACCI': 'Bullish engulfing patterns at Fibonacci levels show approximately 60% follow-through rates.',
    'BEARISH_ENGULFING_SMA': 'Bearish engulfing at resistance often signals the start of a pullback.',
    'SHOOTING_STAR_SMA': 'Shooting stars at moving average resistance are reliable reversal signals.',
    'HIGHER_LOWS_SMA': 'Higher lows forming above key moving averages confirm trend strength.',
    'LOWER_HIGHS_SMA': 'Lower highs below resistance confirm bearish pressure.',
  };

  // Try to find a matching context
  const sourcePrefix = levelSource.split('_')[0];
  const key = `${patternType}_${sourcePrefix}`;

  return contexts[key] ||
    'Confluence of micro patterns with macro levels historically increases the probability of price reaction at these zones.';
};

/**
 * Suggest a thesis for tracking based on pattern and level
 */
const getSuggestedThesis = (pattern, level) => {
  if (pattern.bias === 'BULLISH' && level.type === 'SUPPORT') {
    return 'BULLISH_BOUNCE';
  }
  if (pattern.bias === 'BEARISH' && level.type === 'RESISTANCE') {
    return 'BEARISH_REJECTION';
  }
  if (pattern.bias === 'BULLISH' && level.type === 'RESISTANCE') {
    return 'BULLISH_BREAKOUT';
  }
  if (pattern.bias === 'BEARISH' && level.type === 'SUPPORT') {
    return 'BEARISH_BREAKDOWN';
  }
  return 'NEUTRAL_OBSERVATION';
};

/**
 * Find swing highs and lows in price data
 */
const findSwingPoints = (data, lookback = 5) => {
  const points = [];
  if (!data?.length || data.length < lookback * 2 + 1) return points;

  // Data is newest first, so we need to reverse our logic
  for (let i = lookback; i < data.length - lookback; i++) {
    const current = data[i];
    const before = data.slice(i - lookback, i); // More recent candles
    const after = data.slice(i + 1, i + lookback + 1); // Older candles

    // Swing Low
    if (before.every(c => c.low >= current.low) &&
        after.every(c => c.low >= current.low)) {
      points.push({
        type: 'SUPPORT',
        price: current.low,
        index: i,
        date: current.date,
      });
    }

    // Swing High
    if (before.every(c => c.high <= current.high) &&
        after.every(c => c.high <= current.high)) {
      points.push({
        type: 'RESISTANCE',
        price: current.high,
        index: i,
        date: current.date,
      });
    }
  }

  // Count touches for each level and deduplicate similar prices
  const consolidatedPoints = [];
  points.forEach(point => {
    const existing = consolidatedPoints.find(p =>
      p.type === point.type &&
      Math.abs(p.price - point.price) / point.price < 0.01
    );
    if (existing) {
      existing.touches = (existing.touches || 1) + 1;
    } else {
      consolidatedPoints.push({ ...point, touches: 1 });
    }
  });

  // Return top 3 of each type
  const supports = consolidatedPoints.filter(p => p.type === 'SUPPORT').slice(0, 3);
  const resistances = consolidatedPoints.filter(p => p.type === 'RESISTANCE').slice(0, 3);

  return [...supports, ...resistances];
};

/**
 * Calculate Fibonacci retracement levels
 */
const calculateFibonacciLevels = (data) => {
  if (!data?.length || data.length < 20) return [];

  const recent = data.slice(0, 60); // Last 60 candles (newest first)
  const high = Math.max(...recent.map(c => c.high));
  const low = Math.min(...recent.map(c => c.low));
  const range = high - low;

  if (range <= 0) return [];

  const fibRatios = [
    { level: '23.6%', ratio: 0.236 },
    { level: '38.2%', ratio: 0.382 },
    { level: '50%', ratio: 0.5 },
    { level: '61.8%', ratio: 0.618 },
    { level: '78.6%', ratio: 0.786 },
  ];

  // Determine if we're in uptrend or downtrend
  const currentPrice = data[0].close;
  const isUptrend = currentPrice > (high + low) / 2;

  return fibRatios.map(fib => ({
    level: fib.level,
    price: isUptrend ? high - (range * fib.ratio) : low + (range * fib.ratio),
  }));
};

export default detectConfluence;
