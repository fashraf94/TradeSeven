/**
 * Multi-Timeframe Confluence Detection Service
 * Identifies when micro patterns align with macro levels
 */

import { detectSwingPoints, calculateFibonacciLevels, FIBONACCI_RATIOS } from './technicalUtils';

/**
 * Distance threshold scaling by timeframe
 * Weekly candles have much wider ranges, so thresholds must be proportionally wider
 */
const getDistanceThresholds = (timeframe) => {
  switch (timeframe) {
    case '1h':
      return { strong: 0.005, moderate: 0.01, weak: 0.015 };
    case '1w':
      return { strong: 0.015, moderate: 0.03, weak: 0.05 };
    case '1d':
    default:
      return { strong: 0.005, moderate: 0.01, weak: 0.015 };
  }
};

/**
 * Pattern detection threshold scaling by timeframe
 * Weekly candles have much wider ranges and fewer data points
 */
const getPatternThresholds = (timeframe) => {
  switch (timeframe) {
    case '1w':
      return {
        doubleFormationTolerance: 0.02,  // 2% (vs 0.5% daily)
        trendLookback: 8,                // 8 weeks (vs 4 days)
        swingLookback: 3,                // 3 bars each side for weekly swings
      };
    case '1h':
      return {
        doubleFormationTolerance: 0.005,
        trendLookback: 4,
        swingLookback: 5,
      };
    case '1d':
    default:
      return {
        doubleFormationTolerance: 0.005,
        trendLookback: 4,
        swingLookback: 5,
      };
  }
};

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

  // For weekly timeframe, use weekly data as its own macro anchor
  // Daily macro levels are too granular for multi-year weekly charts
  const isWeekly = selectedTimeframe === '1w';
  const macroData = isWeekly ? selectedTimeframeData : dailyData;
  const macroIndicators = isWeekly ? (dailyIndicators || {}) : dailyIndicators;
  const macroLevels = getMacroLevels(macroData, macroIndicators, selectedTimeframe);

  // Get current price info from selected timeframe
  const currentPrice = selectedTimeframeData[0]?.close; // Data is newest first
  const recentCandles = selectedTimeframeData.slice(0, 20); // Last 20 candles (newest first)

  // Detect micro patterns on selected timeframe
  const microPatterns = detectMicroPatterns(recentCandles, selectedTimeframe, rvolData);

  // Get timeframe-aware distance thresholds
  const thresholds = getDistanceThresholds(selectedTimeframe);

  // Find confluences: micro patterns near macro levels
  microPatterns.forEach(pattern => {
    macroLevels.forEach(level => {
      const distance = Math.abs(pattern.price - level.price) / level.price;

      // Use timeframe-scaled threshold for maximum distance
      if (distance < thresholds.weak) {
        // Doji bias-matching: directional dojis only match appropriate level types
        if (pattern.type === 'GRAVESTONE_DOJI' && level.type !== 'RESISTANCE') return;
        if (pattern.type === 'DRAGONFLY_DOJI' && level.type !== 'SUPPORT') return;

        const strength = calculateConfluenceStrength(distance, pattern, level, thresholds);

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
            time: pattern.time,
            shortName: pattern.shortName,
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

  // Sort by proximity to current price (closest first), then by strength
  return confluences.sort((a, b) => {
    const distA = Math.abs(parseFloat(a.distanceFromCurrent));
    const distB = Math.abs(parseFloat(b.distanceFromCurrent));
    if (distA !== distB) return distA - distB;
    const strengthOrder = { 'STRONG': 0, 'MODERATE': 1, 'WEAK': 2 };
    return strengthOrder[a.strength] - strengthOrder[b.strength];
  });
};

/**
 * Get macro support/resistance levels from daily (or weekly) data
 * Identifies SMAs, swing points, and Fibonacci levels as macro anchors
 * @param {Array} dailyData - OHLCV data (newest first)
 * @param {Object} indicators - Calculated indicators (sma20, sma50, sma200)
 * @param {string} timeframe - '1h', '1d', or '1w' (affects swing lookback)
 * @returns {Array} Level objects { type, name, price, source, strength }
 */
const getMacroLevels = (dailyData, indicators, timeframe = '1d') => {
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

  // Recent swing highs/lows (smaller lookback for weekly to find more swing points)
  const swingLookback = timeframe === '1w' ? 3 : 5;
  const { swingHighs, swingLows } = detectSwingPoints(dailyData, {
    lookback: swingLookback,
    clusterThreshold: 0.01,
    maxResults: 3,
  });
  swingLows.forEach(point => {
    levels.push({
      type: 'SUPPORT',
      name: 'Recent Swing Low',
      price: point.price,
      source: 'SWING_POINT',
      strength: point.touches > 2 ? 'STRONG' : 'MODERATE',
    });
  });
  swingHighs.forEach(point => {
    levels.push({
      type: 'RESISTANCE',
      name: 'Recent Swing High',
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
export const detectMicroPatterns = (candles, timeframe, rvolData = null) => {
  const patterns = [];
  const len = candles.length;
  if (len < 5) return patterns;

  // Timeframe-aware pattern thresholds
  const patternThresholds = getPatternThresholds(timeframe);

  // Note: candles are newest first, so candles[0] is latest
  const latest = candles[0];
  const prev = candles[1];
  const prev2 = candles[2];
  const rvolContext = buildRVOLContext(rvolData);

  // Capture latest candle time for chart marker placement
  const latestTime = latest.date || latest.datetime || latest.timestamp;

  // Double Bottom Detection (look at last 10 candles)
  const recentSlice = candles.slice(0, 10);
  const recentLows = recentSlice.map(c => c.low);
  const minLow = Math.min(...recentLows);
  const dblTolerance = patternThresholds.doubleFormationTolerance;
  const lowTouches = recentLows.filter(l => Math.abs(l - minLow) / minLow < dblTolerance).length;
  if (lowTouches >= 2) {
    // Volume comparison between first and second touch
    const lowCandleIndices = recentSlice
      .map((c, i) => ({ index: i, low: c.low, volume: c.volume }))
      .filter(c => Math.abs(c.low - minLow) / minLow < dblTolerance);
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
      shortName: 'DBL',
      time: latestTime,
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
  const highTouches = recentHighs.filter(h => Math.abs(h - maxHigh) / maxHigh < dblTolerance).length;
  if (highTouches >= 2) {
    // Volume comparison between first and second peak
    const highCandleIndices = recentSlice
      .map((c, i) => ({ index: i, high: c.high, volume: c.volume }))
      .filter(c => Math.abs(c.high - maxHigh) / maxHigh < dblTolerance);
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
      shortName: 'DBL',
      time: latestTime,
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
      shortName: 'HAM',
      time: latestTime,
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
      shortName: 'STAR',
      time: latestTime,
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
      shortName: 'ENG',
      time: latestTime,
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
      shortName: 'ENG',
      time: latestTime,
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

  // Higher Lows (uptrend confirmation) - check last N candles (scaled by timeframe)
  const trendLookback = patternThresholds.trendLookback;
  if (len >= trendLookback) {
    const lows = candles.slice(0, trendLookback).map(c => c.low);
    // Check that each successive low is higher (lows[0] is newest)
    let isHigherLows = true;
    for (let i = 0; i < lows.length - 1; i++) {
      if (lows[i] <= lows[i + 1]) { isHigherLows = false; break; }
    }
    if (isHigherLows) {
      patterns.push({
        type: 'HIGHER_LOWS',
        name: 'Higher Lows',
        shortName: 'H-LO',
        time: latestTime,
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
  if (len >= trendLookback) {
    const highs = candles.slice(0, trendLookback).map(c => c.high);
    // Check that each successive high is lower (highs[0] is newest)
    let isLowerHighs = true;
    for (let i = 0; i < highs.length - 1; i++) {
      if (highs[i] >= highs[i + 1]) { isLowerHighs = false; break; }
    }
    if (isLowerHighs) {
      patterns.push({
        type: 'LOWER_HIGHS',
        name: 'Lower Highs',
        shortName: 'L-HI',
        time: latestTime,
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

  // Doji Sub-Type Detection
  const range = latest.high - latest.low;
  if (range > 0 && bodySize / range < 0.1) {
    const dojiUpperShadow = latest.high - Math.max(latest.open, latest.close);
    const dojiLowerShadow = Math.min(latest.open, latest.close) - latest.low;

    let dojiType, dojiName, dojiBias, dojiNote;

    if (dojiUpperShadow > range * 0.6 && dojiLowerShadow < range * 0.15) {
      dojiType = 'GRAVESTONE_DOJI';
      dojiName = 'Gravestone Doji';
      dojiBias = 'BEARISH';
      dojiNote = 'Gravestone Doji — long upper shadow, bearish at resistance';
    } else if (dojiLowerShadow > range * 0.6 && dojiUpperShadow < range * 0.15) {
      dojiType = 'DRAGONFLY_DOJI';
      dojiName = 'Dragonfly Doji';
      dojiBias = 'BULLISH';
      dojiNote = 'Dragonfly Doji — long lower shadow, bullish at support';
    } else if (dojiUpperShadow > range * 0.3 && dojiLowerShadow > range * 0.3) {
      dojiType = 'LONG_LEGGED_DOJI';
      dojiName = 'Long-Legged Doji';
      dojiBias = 'NEUTRAL';
      dojiNote = 'Long-Legged Doji — high indecision, both sides contested';
    } else {
      dojiType = 'STANDARD_DOJI';
      dojiName = 'Standard Doji';
      dojiBias = 'NEUTRAL';
      dojiNote = 'Standard Doji — indecision candle';
    }

    patterns.push({
      type: dojiType,
      name: dojiName,
      shortName: 'DOJI',
      time: latestTime,
      price: (latest.high + latest.low) / 2,
      description: `${dojiName} detected — ${dojiBias === 'NEUTRAL' ? 'indecision' : dojiBias.toLowerCase() + ' signal'}`,
      bias: dojiBias,
      quality: {
        bodyRatio: null,
        shadowRatio: null,
        isStrong: dojiType === 'GRAVESTONE_DOJI' || dojiType === 'DRAGONFLY_DOJI',
        volumeContext: null,
        rvolContext,
        qualityNote: dojiNote,
      },
    });
  }

  // Morning Star (3-candle bullish reversal)
  if (prev2 && prev && latest && len >= 8) {
    // Require bearish context: 4+ of 5 candles before the pattern window must be bearish
    const msContextCandles = candles.slice(3, 8);
    const msBearishCount = msContextCandles.filter(c => c.close < c.open).length;

    if (msBearishCount >= 4) {
    const prev2BodyMS = Math.abs(prev2.close - prev2.open);
    const prev2RangeMS = prev2.high - prev2.low;
    const prevBodyMS = Math.abs(prev.close - prev.open);
    const latestBodyMS = Math.abs(latest.close - latest.open);
    const prev2MidpointMS = (prev2.open + prev2.close) / 2;

    if (prev2.close < prev2.open &&                          // prev2 is bearish
        prev2RangeMS > 0 && prev2BodyMS / prev2RangeMS > 0.5 && // large bearish body
        prevBodyMS < prev2BodyMS * 0.3 &&                     // middle candle has small body
        latest.close > latest.open &&                          // latest is bullish
        latest.close > prev2MidpointMS) {                      // closes above prev2 midpoint
      patterns.push({
        type: 'MORNING_STAR',
        name: 'Morning Star',
        shortName: 'M\u2605',
        time: latestTime,
        price: prev.low,
        description: 'Morning Star — 3-candle bullish reversal pattern',
        bias: 'BULLISH',
        quality: {
          bodyRatio: prev2BodyMS > 0 ? parseFloat((latestBodyMS / prev2BodyMS).toFixed(1)) : null,
          shadowRatio: null,
          isStrong: latest.close > prev2.open,
          volumeContext: null,
          rvolContext,
          qualityNote: latest.close > prev2.open
            ? 'Strong Morning Star — confirmation closes above first candle'
            : 'Morning Star — confirmation closes above midpoint',
        },
      });
    }
    } // end bearish context check
  }

  // Evening Star (3-candle bearish reversal)
  if (prev2 && prev && latest && len >= 8) {
    // Require bullish context: 4+ of 5 candles before the pattern window must be bullish
    const esContextCandles = candles.slice(3, 8);
    const esBullishCount = esContextCandles.filter(c => c.close > c.open).length;

    if (esBullishCount >= 4) {
    const prev2BodyES = Math.abs(prev2.close - prev2.open);
    const prev2RangeES = prev2.high - prev2.low;
    const prevBodyES = Math.abs(prev.close - prev.open);
    const latestBodyES = Math.abs(latest.close - latest.open);
    const prev2MidpointES = (prev2.open + prev2.close) / 2;

    if (prev2.close > prev2.open &&                          // prev2 is bullish
        prev2RangeES > 0 && prev2BodyES / prev2RangeES > 0.5 && // large bullish body
        prevBodyES < prev2BodyES * 0.3 &&                     // middle candle has small body
        latest.close < latest.open &&                          // latest is bearish
        latest.close < prev2MidpointES) {                      // closes below prev2 midpoint
      patterns.push({
        type: 'EVENING_STAR',
        name: 'Evening Star',
        shortName: 'E\u2605',
        time: latestTime,
        price: prev.high,
        description: 'Evening Star — 3-candle bearish reversal pattern',
        bias: 'BEARISH',
        quality: {
          bodyRatio: prev2BodyES > 0 ? parseFloat((latestBodyES / prev2BodyES).toFixed(1)) : null,
          shadowRatio: null,
          isStrong: latest.close < prev2.open,
          volumeContext: null,
          rvolContext,
          qualityNote: latest.close < prev2.open
            ? 'Strong Evening Star — confirmation closes below first candle'
            : 'Evening Star — confirmation closes below midpoint',
        },
      });
    }
    } // end bullish context check
  }

  // Inside Bar (volatility compression)
  if (prev && latest.high < prev.high && latest.low > prev.low) {
    const isDoubleInside = prev2 && prev.high < prev2.high && prev.low > prev2.low;
    const recentRanges = candles.slice(0, 4).map(c => c.high - c.low);
    const latestRange = recentRanges[0];
    const isNR4 = len >= 4 && recentRanges.every((r, i) => i === 0 || latestRange <= r);

    let ibNote = 'Inside Bar — volatility compression';
    if (isDoubleInside) ibNote = 'Double Inside Bar — extended compression, breakout imminent';
    else if (isNR4) ibNote = 'Inside Bar + NR4 — narrowest range in 4 bars, expansion expected';

    patterns.push({
      type: 'INSIDE_BAR',
      name: isDoubleInside ? 'Double Inside Bar' : (isNR4 ? 'Inside Bar (NR4)' : 'Inside Bar'),
      shortName: 'IN',
      time: latestTime,
      price: (latest.high + latest.low) / 2,
      description: `${isDoubleInside ? 'Double Inside Bar' : 'Inside Bar'} — volatility compression${isNR4 ? ', narrowest range in 4 bars' : ''}`,
      bias: 'NEUTRAL',
      quality: {
        bodyRatio: null,
        shadowRatio: null,
        isStrong: isDoubleInside || isNR4,
        volumeContext: null,
        rvolContext,
        qualityNote: ibNote,
      },
    });
  }

  // Mutual exclusion: Morning Star and Evening Star cannot coexist
  const morningStar = patterns.find(p => p.type === 'MORNING_STAR');
  const eveningStar = patterns.find(p => p.type === 'EVENING_STAR');
  if (morningStar && eveningStar) {
    const keepEvening = eveningStar.quality.isStrong && !morningStar.quality.isStrong;
    if (keepEvening) {
      const idx = patterns.indexOf(morningStar);
      if (idx !== -1) patterns.splice(idx, 1);
    } else {
      const idx = patterns.indexOf(eveningStar);
      if (idx !== -1) patterns.splice(idx, 1);
    }
  }

  return patterns;
};

/**
 * Calculate confluence strength based on distance and pattern/level quality
 */
const calculateConfluenceStrength = (distance, pattern, level, thresholds = { strong: 0.005, moderate: 0.01, weak: 0.015 }) => {
  let score = 0;

  // Distance factor (closer = stronger), using timeframe-aware thresholds
  if (distance < thresholds.strong) score += 3;
  else if (distance < thresholds.moderate) score += 2;
  else score += 1;  // Within weak threshold

  // Level strength factor
  if (level.strength === 'STRONG') score += 2;
  else if (level.strength === 'MODERATE') score += 1;

  // Pattern type factor (some patterns are more reliable)
  const strongPatterns = ['DOUBLE_BOTTOM', 'DOUBLE_TOP', 'BULLISH_ENGULFING', 'BEARISH_ENGULFING', 'MORNING_STAR', 'EVENING_STAR'];
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
    'GRAVESTONE_DOJI_SMA': 'Gravestone Doji at moving average resistance historically signals rejection.',
    'DRAGONFLY_DOJI_SMA': 'Dragonfly Doji at moving average support historically signals a bounce.',
    'MORNING_STAR_SMA': 'Morning Star at moving average support is a high-probability bullish reversal.',
    'MORNING_STAR_FIBONACCI': 'Morning Star at Fibonacci support has historically strong reversal rates.',
    'MORNING_STAR_SWING': 'Morning Star at swing low support frequently marks significant bottoms.',
    'EVENING_STAR_SMA': 'Evening Star at moving average resistance is a high-probability bearish reversal.',
    'EVENING_STAR_FIBONACCI': 'Evening Star at Fibonacci resistance shows strong follow-through historically.',
    'EVENING_STAR_SWING': 'Evening Star at swing high resistance frequently marks significant tops.',
    'INSIDE_BAR_SMA': 'Inside Bar at key moving average often precedes a directional breakout.',
    'INSIDE_BAR_FIBONACCI': 'Inside Bar compression at Fibonacci levels precedes high-conviction breakouts.',
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

export { calculateFibonacciLevels };
export default detectConfluence;
