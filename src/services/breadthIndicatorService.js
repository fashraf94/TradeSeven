/**
 * Breadth Indicator Service
 * Calculates market breadth metrics for sectors and overall market health
 */

import { getSectorStocks } from './sectorDataService';
import { fetchSMA } from './technicalIndicatorService';

// Cache for breadth data
const breadthCache = new Map();
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

/**
 * Calculate breadth for a single sector
 * @param {string} sectorId - The sector ID
 * @returns {Promise<Object>} Breadth metrics
 */
export const calculateSectorBreadth = async (sectorId) => {
  const cacheKey = `sector_${sectorId}`;
  const cached = breadthCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    const stocks = await getSectorStocks(sectorId);

    // Sample subset for API efficiency (top 10 stocks)
    const sampleStocks = stocks.slice(0, 10);

    let above50SMA = 0;
    let above200SMA = 0;
    let advancing = 0;
    let declining = 0;
    let unchanged = 0;
    let totalAnalyzed = 0;

    for (const stock of sampleStocks) {
      try {
        // Get SMAs for breadth calculation
        const [sma50, sma200] = await Promise.all([
          fetchSMA(stock.symbol, 50).catch(() => null),
          fetchSMA(stock.symbol, 200).catch(() => null)
        ]);

        if (stock.price && sma50) {
          if (stock.price > sma50) above50SMA++;
        }

        if (stock.price && sma200) {
          if (stock.price > sma200) above200SMA++;
        }

        // Advance/Decline based on weekly change
        const weeklyChange = stock.change1W || 0;
        if (weeklyChange > 0.5) advancing++;
        else if (weeklyChange < -0.5) declining++;
        else unchanged++;

        totalAnalyzed++;
      } catch (error) {
        console.warn(`Error analyzing ${stock.symbol} for breadth:`, error);
      }
    }

    // Calculate percentages
    const percentAbove50SMA = totalAnalyzed > 0 ? (above50SMA / totalAnalyzed) * 100 : 0;
    const percentAbove200SMA = totalAnalyzed > 0 ? (above200SMA / totalAnalyzed) * 100 : 0;
    const advanceDeclineRatio = declining > 0 ? advancing / declining : advancing > 0 ? 2 : 1;

    // Calculate overall breadth score (0-100)
    const breadthScore = Math.round(
      (percentAbove50SMA * 0.4) +
      (percentAbove200SMA * 0.3) +
      (Math.min(advanceDeclineRatio, 2) * 15)
    );

    const result = {
      sectorId,
      percentAbove50SMA: Math.round(percentAbove50SMA),
      percentAbove200SMA: Math.round(percentAbove200SMA),
      advancing,
      declining,
      unchanged,
      advanceDeclineRatio: Math.round(advanceDeclineRatio * 100) / 100,
      breadthScore: Math.min(100, Math.max(0, breadthScore)),
      interpretation: getBreadthInterpretation(breadthScore),
      trend: getBreadthTrend(percentAbove50SMA, advanceDeclineRatio),
      totalAnalyzed,
      timestamp: Date.now()
    };

    breadthCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  } catch (error) {
    console.error(`Error calculating breadth for ${sectorId}:`, error);
    throw error;
  }
};

/**
 * Calculate breadth for multiple sectors
 * @param {string[]} sectorIds - Array of sector IDs
 * @returns {Promise<Object>} Breadth metrics by sector
 */
export const calculateMultiSectorBreadth = async (sectorIds) => {
  const results = {};

  for (const sectorId of sectorIds) {
    try {
      results[sectorId] = await calculateSectorBreadth(sectorId);
    } catch (error) {
      console.error(`Failed to calculate breadth for ${sectorId}:`, error);
      results[sectorId] = getDefaultBreadth(sectorId);
    }
  }

  return results;
};

/**
 * Get market-wide breadth summary
 * @param {Object} sectorBreadths - Breadth data by sector
 * @returns {Object} Market breadth summary
 */
export const getMarketBreadthSummary = (sectorBreadths) => {
  const sectors = Object.values(sectorBreadths);

  if (sectors.length === 0) {
    return {
      overallScore: 50,
      strongSectors: 0,
      weakSectors: 0,
      marketTrend: 'neutral',
      interpretation: 'Insufficient data'
    };
  }

  const avgScore = sectors.reduce((sum, s) => sum + s.breadthScore, 0) / sectors.length;
  const strongSectors = sectors.filter(s => s.breadthScore >= 60).length;
  const weakSectors = sectors.filter(s => s.breadthScore < 40).length;

  let marketTrend = 'neutral';
  if (avgScore >= 65) marketTrend = 'bullish';
  else if (avgScore >= 55) marketTrend = 'slightly_bullish';
  else if (avgScore <= 35) marketTrend = 'bearish';
  else if (avgScore <= 45) marketTrend = 'slightly_bearish';

  return {
    overallScore: Math.round(avgScore),
    strongSectors,
    weakSectors,
    totalSectors: sectors.length,
    marketTrend,
    interpretation: getMarketInterpretation(avgScore, strongSectors, weakSectors)
  };
};

/**
 * Calculate McClellan-style oscillator for a sector
 * Simplified version based on advance/decline data
 */
export const calculateMcClellanOscillator = (advanceDeclineHistory) => {
  if (!advanceDeclineHistory || advanceDeclineHistory.length < 19) {
    return { value: 0, signal: 'neutral' };
  }

  // Calculate 19-day and 39-day EMAs of advance-decline difference
  const adDiffs = advanceDeclineHistory.map(d => d.advancing - d.declining);

  const ema19 = calculateEMA(adDiffs, 19);
  const ema39 = calculateEMA(adDiffs, 39);

  const oscillator = ema19 - ema39;

  let signal = 'neutral';
  if (oscillator > 50) signal = 'strongly_bullish';
  else if (oscillator > 20) signal = 'bullish';
  else if (oscillator < -50) signal = 'strongly_bearish';
  else if (oscillator < -20) signal = 'bearish';

  return {
    value: Math.round(oscillator),
    ema19: Math.round(ema19),
    ema39: Math.round(ema39),
    signal
  };
};

/**
 * Get stocks showing relative strength
 * @param {string} sectorId - The sector ID
 * @returns {Promise<Array>} Stocks with relative strength
 */
export const getRelativeStrengthStocks = async (sectorId) => {
  try {
    const stocks = await getSectorStocks(sectorId);

    // Calculate relative strength based on performance vs sector average
    const avgPerformance = stocks.reduce((sum, s) => sum + (s.change1W || 0), 0) / stocks.length;

    const withRS = stocks.map(stock => ({
      ...stock,
      relativeStrength: ((stock.change1W || 0) - avgPerformance),
      rsRating: getRSRating((stock.change1W || 0) - avgPerformance)
    }));

    // Return top performers with positive relative strength
    return withRS
      .filter(s => s.relativeStrength > 0)
      .sort((a, b) => b.relativeStrength - a.relativeStrength)
      .slice(0, 5);
  } catch (error) {
    console.error('Error getting relative strength stocks:', error);
    return [];
  }
};

// Helper Functions

const calculateEMA = (data, period) => {
  if (data.length < period) return data[data.length - 1] || 0;

  const multiplier = 2 / (period + 1);
  let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;

  for (let i = period; i < data.length; i++) {
    ema = (data[i] - ema) * multiplier + ema;
  }

  return ema;
};

const getBreadthInterpretation = (score) => {
  if (score >= 70) return 'Strong breadth - broad participation in rally';
  if (score >= 55) return 'Healthy breadth - good market internals';
  if (score >= 45) return 'Mixed breadth - selective strength';
  if (score >= 30) return 'Weak breadth - narrow leadership';
  return 'Poor breadth - widespread weakness';
};

const getBreadthTrend = (percentAbove50, adRatio) => {
  if (percentAbove50 >= 60 && adRatio >= 1.5) return 'strong_uptrend';
  if (percentAbove50 >= 50 && adRatio >= 1.0) return 'uptrend';
  if (percentAbove50 <= 40 && adRatio <= 0.7) return 'downtrend';
  if (percentAbove50 <= 30 && adRatio <= 0.5) return 'strong_downtrend';
  return 'neutral';
};

const getMarketInterpretation = (avgScore, strongCount, weakCount) => {
  if (avgScore >= 65 && strongCount >= 3) {
    return 'Broad market strength across multiple sectors - favorable for breakout hunting';
  }
  if (avgScore >= 55) {
    return 'Market showing selective strength - focus on leading sectors';
  }
  if (avgScore <= 40 && weakCount >= 3) {
    return 'Broad market weakness - exercise caution, consider defensive positions';
  }
  return 'Mixed market conditions - be selective with picks';
};

const getRSRating = (relativeStrength) => {
  if (relativeStrength >= 5) return 'A';
  if (relativeStrength >= 2) return 'B';
  if (relativeStrength >= 0) return 'C';
  if (relativeStrength >= -2) return 'D';
  return 'F';
};

const getDefaultBreadth = (sectorId) => ({
  sectorId,
  percentAbove50SMA: 50,
  percentAbove200SMA: 50,
  advancing: 0,
  declining: 0,
  unchanged: 0,
  advanceDeclineRatio: 1,
  breadthScore: 50,
  interpretation: 'Data unavailable',
  trend: 'neutral',
  totalAnalyzed: 0,
  timestamp: Date.now()
});

export default {
  calculateSectorBreadth,
  calculateMultiSectorBreadth,
  getMarketBreadthSummary,
  calculateMcClellanOscillator,
  getRelativeStrengthStocks
};
