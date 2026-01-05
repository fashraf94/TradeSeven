/**
 * Stock Scoring Service
 * Calculates Breakout Probability and Bust Risk scores for BaggerBomb
 */

import { fetchAllIndicators } from './technicalIndicatorService';
import { getVolatilityThresholds } from './volatilityService';

/**
 * Calculate Breakout Probability Score (0-100)
 * Higher score = more likely to hit BaggerBomb threshold
 *
 * Factors:
 * - Volatility Ratio (7d vs 30d) - 25 points
 * - RSI Momentum - 25 points
 * - Price vs Moving Averages - 25 points
 * - Trend Alignment - 25 points
 */
export const calculateBreakoutProbability = async (symbol, currentPrice, priceHistory = []) => {
  try {
    // Fetch technical indicators
    const indicators = await fetchAllIndicators(symbol);

    // Fetch threshold data
    const thresholds = await getVolatilityThresholds([symbol], 'stock');
    const threshold = thresholds[symbol]?.threshold || 2.0;

    let score = 0;
    const factors = {};

    // Factor 1: RSI Momentum (25 points)
    // RSI 50-70 = bullish momentum without being overbought
    if (indicators.rsi !== null) {
      if (indicators.rsi >= 50 && indicators.rsi <= 65) {
        factors.rsiScore = 25;
        factors.rsiLabel = 'Strong momentum';
      } else if (indicators.rsi >= 40 && indicators.rsi < 50) {
        factors.rsiScore = 15;
        factors.rsiLabel = 'Building momentum';
      } else if (indicators.rsi > 65 && indicators.rsi <= 75) {
        factors.rsiScore = 18;
        factors.rsiLabel = 'Hot (caution)';
      } else if (indicators.rsi > 75) {
        factors.rsiScore = 10;
        factors.rsiLabel = 'Overbought';
      } else {
        factors.rsiScore = 8;
        factors.rsiLabel = 'Weak momentum';
      }
      score += factors.rsiScore;
    } else {
      factors.rsiScore = 12; // Neutral if unavailable
      factors.rsiLabel = 'Unknown';
      score += 12;
    }

    // Factor 2: MACD Signal (25 points)
    // Bullish when MACD > Signal line
    if (indicators.macd !== null) {
      const { macd, signal, histogram } = indicators.macd;
      if (macd > signal && histogram > 0) {
        factors.macdScore = 25;
        factors.macdLabel = 'Bullish crossover';
      } else if (macd > signal) {
        factors.macdScore = 20;
        factors.macdLabel = 'Bullish';
      } else if (macd < signal && histogram < 0) {
        factors.macdScore = 8;
        factors.macdLabel = 'Bearish crossover';
      } else {
        factors.macdScore = 12;
        factors.macdLabel = 'Neutral';
      }
      score += factors.macdScore;
    } else {
      factors.macdScore = 12;
      factors.macdLabel = 'Unknown';
      score += 12;
    }

    // Factor 3: Price vs Moving Averages (25 points)
    // Above both 50 and 200 = strong position
    if (indicators.sma50 !== null && indicators.sma200 !== null && currentPrice) {
      const above50 = currentPrice > indicators.sma50;
      const above200 = currentPrice > indicators.sma200;

      if (above50 && above200) {
        factors.maScore = 25;
        factors.maLabel = 'Above both MAs';
      } else if (above50) {
        factors.maScore = 18;
        factors.maLabel = 'Above 50-day';
      } else if (above200) {
        factors.maScore = 15;
        factors.maLabel = 'Above 200-day only';
      } else {
        factors.maScore = 8;
        factors.maLabel = 'Below both MAs';
      }
      score += factors.maScore;
    } else {
      factors.maScore = 12;
      factors.maLabel = 'Unknown';
      score += 12;
    }

    // Factor 4: Trend Alignment (25 points)
    // 50-day above 200-day = uptrend
    if (indicators.sma50 !== null && indicators.sma200 !== null) {
      const goldenCross = indicators.sma50 > indicators.sma200;
      const trendStrength = ((indicators.sma50 - indicators.sma200) / indicators.sma200) * 100;

      if (goldenCross && trendStrength > 5) {
        factors.trendScore = 25;
        factors.trendLabel = 'Strong uptrend';
      } else if (goldenCross) {
        factors.trendScore = 20;
        factors.trendLabel = 'Uptrend';
      } else if (trendStrength > -5) {
        factors.trendScore = 12;
        factors.trendLabel = 'Consolidating';
      } else {
        factors.trendScore = 6;
        factors.trendLabel = 'Downtrend';
      }
      score += factors.trendScore;
    } else {
      factors.trendScore = 12;
      factors.trendLabel = 'Unknown';
      score += 12;
    }

    return {
      symbol,
      score: Math.min(100, Math.round(score)),
      threshold,
      factors,
      indicators: {
        rsi: indicators.rsi,
        macd: indicators.macd,
        sma50: indicators.sma50,
        sma200: indicators.sma200
      },
      interpretation: getScoreInterpretation(score)
    };
  } catch (error) {
    console.error(`Error calculating breakout probability for ${symbol}:`, error);
    return {
      symbol,
      score: 50,
      threshold: 2.0,
      factors: {},
      indicators: {},
      interpretation: { label: 'Unknown', color: '#8b949e' },
      error: error.message
    };
  }
};

/**
 * Calculate Bust Risk Score (0-100)
 * Higher score = more likely to hit negative threshold
 */
export const calculateBustRisk = async (symbol, currentPrice) => {
  try {
    const indicators = await fetchAllIndicators(symbol);

    let risk = 0;
    const factors = {};

    // Factor 1: Overbought RSI (25 points)
    if (indicators.rsi !== null) {
      if (indicators.rsi > 80) {
        factors.rsiRisk = 25;
        factors.rsiLabel = 'Extremely overbought';
      } else if (indicators.rsi > 70) {
        factors.rsiRisk = 18;
        factors.rsiLabel = 'Overbought';
      } else if (indicators.rsi < 30) {
        factors.rsiRisk = 10;
        factors.rsiLabel = 'Oversold (bounce likely)';
      } else {
        factors.rsiRisk = 5;
        factors.rsiLabel = 'Normal range';
      }
      risk += factors.rsiRisk;
    }

    // Factor 2: Bearish MACD (25 points)
    if (indicators.macd !== null) {
      const { macd, signal, histogram } = indicators.macd;
      if (macd < signal && histogram < 0) {
        factors.macdRisk = 25;
        factors.macdLabel = 'Bearish momentum';
      } else if (macd < signal) {
        factors.macdRisk = 18;
        factors.macdLabel = 'Weakening';
      } else {
        factors.macdRisk = 5;
        factors.macdLabel = 'Bullish';
      }
      risk += factors.macdRisk;
    }

    // Factor 3: Extended from MAs (25 points)
    if (indicators.sma50 !== null && currentPrice) {
      const extensionPercent = ((currentPrice - indicators.sma50) / indicators.sma50) * 100;

      if (extensionPercent > 15) {
        factors.extensionRisk = 25;
        factors.extensionLabel = 'Very extended';
      } else if (extensionPercent > 10) {
        factors.extensionRisk = 18;
        factors.extensionLabel = 'Extended';
      } else if (extensionPercent > 5) {
        factors.extensionRisk = 10;
        factors.extensionLabel = 'Slightly extended';
      } else {
        factors.extensionRisk = 3;
        factors.extensionLabel = 'Normal';
      }
      risk += factors.extensionRisk;
    }

    // Factor 4: Death Cross / Downtrend (25 points)
    if (indicators.sma50 !== null && indicators.sma200 !== null) {
      const deathCross = indicators.sma50 < indicators.sma200;

      if (deathCross) {
        factors.trendRisk = 25;
        factors.trendLabel = 'Downtrend';
      } else {
        factors.trendRisk = 5;
        factors.trendLabel = 'Uptrend';
      }
      risk += factors.trendRisk;
    }

    return {
      symbol,
      risk: Math.min(100, Math.round(risk)),
      factors,
      interpretation: getBustRiskInterpretation(risk)
    };
  } catch (error) {
    console.error(`Error calculating bust risk for ${symbol}:`, error);
    return {
      symbol,
      risk: 50,
      factors: {},
      interpretation: { label: 'Unknown', color: '#8b949e' },
      error: error.message
    };
  }
};

/**
 * Get interpretation label and color for breakout score
 */
const getScoreInterpretation = (score) => {
  if (score >= 80) return { label: 'Excellent', color: '#10b981', emoji: '🔥' };
  if (score >= 65) return { label: 'Good', color: '#22c55e', emoji: '✅' };
  if (score >= 50) return { label: 'Moderate', color: '#f59e0b', emoji: '➖' };
  if (score >= 35) return { label: 'Below Average', color: '#f97316', emoji: '⚠️' };
  return { label: 'Poor', color: '#ef4444', emoji: '❌' };
};

/**
 * Get interpretation for bust risk
 */
const getBustRiskInterpretation = (risk) => {
  if (risk >= 70) return { label: 'High Risk', color: '#ef4444', emoji: '🚨' };
  if (risk >= 50) return { label: 'Elevated Risk', color: '#f97316', emoji: '⚠️' };
  if (risk >= 30) return { label: 'Moderate Risk', color: '#f59e0b', emoji: '➖' };
  return { label: 'Low Risk', color: '#10b981', emoji: '✅' };
};

/**
 * Score multiple stocks and sort by breakout probability
 * @param {Array<{symbol: string, price: number}>} stocks
 * @returns {Promise<Array>} Sorted by breakout probability (highest first)
 */
export const scoreAndRankStocks = async (stocks) => {
  const results = await Promise.all(
    stocks.map(async (stock) => {
      const [breakout, bustRisk] = await Promise.all([
        calculateBreakoutProbability(stock.symbol, stock.price),
        calculateBustRisk(stock.symbol, stock.price)
      ]);

      return {
        ...stock,
        breakoutScore: breakout.score,
        breakoutFactors: breakout.factors,
        breakoutInterpretation: breakout.interpretation,
        threshold: breakout.threshold,
        bustRisk: bustRisk.risk,
        bustInterpretation: bustRisk.interpretation,
        indicators: breakout.indicators,
        // Combined score: high breakout + low bust risk
        combinedScore: breakout.score - (bustRisk.risk * 0.3)
      };
    })
  );

  return results.sort((a, b) => b.combinedScore - a.combinedScore);
};

export default {
  calculateBreakoutProbability,
  calculateBustRisk,
  scoreAndRankStocks
};
