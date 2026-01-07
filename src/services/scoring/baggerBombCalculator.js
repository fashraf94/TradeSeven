// /src/services/scoring/baggerBombCalculator.js

import { BAGGERBOMB, getConvictionMultiplier, SNAKE_DRAFT } from './constants';

/**
 * Calculate the number of BaggerBombs triggered based on price movement
 *
 * @param {number} percentChange - The percentage change (can be from close or intraday high)
 * @param {number} threshold - The asset's volatility threshold percentage
 * @returns {number} Number of BaggerBombs triggered (0 or more)
 *
 * @example
 * // Asset threshold is 2.8%
 * calculateBaggerBombs(2.8, 2.8)   // Returns 1 (crossed 1x)
 * calculateBaggerBombs(5.6, 2.8)   // Returns 2 (crossed 2x)
 * calculateBaggerBombs(2.0, 2.8)   // Returns 0 (didn't reach threshold)
 * calculateBaggerBombs(-3.0, 2.8)  // Returns 0 (negative, use calculateBusts)
 */
export const calculateBaggerBombs = (percentChange, threshold) => {
  if (percentChange <= 0 || threshold <= 0) return 0;
  return Math.floor(percentChange / threshold);
};

/**
 * Calculate the number of Busts triggered based on negative price movement
 *
 * @param {number} percentChange - The percentage change (negative value)
 * @param {number} threshold - The asset's volatility threshold percentage
 * @returns {number} Number of Busts triggered (0 or more)
 *
 * @example
 * // Asset threshold is 2.8%
 * calculateBusts(-2.8, 2.8)   // Returns 1 (crossed -1x)
 * calculateBusts(-5.6, 2.8)   // Returns 2 (crossed -2x)
 * calculateBusts(-2.0, 2.8)   // Returns 0 (didn't reach threshold)
 * calculateBusts(3.0, 2.8)    // Returns 0 (positive, use calculateBaggerBombs)
 */
export const calculateBusts = (percentChange, threshold) => {
  if (percentChange >= 0 || threshold <= 0) return 0;
  return Math.floor(Math.abs(percentChange) / threshold);
};

/**
 * Calculate BaggerBomb points from a percentage change
 *
 * @param {number} percentChange - The percentage change
 * @param {number} threshold - The asset's volatility threshold
 * @returns {object} { baggerBombs, busts, points }
 */
export const calculateBreakoutPoints = (percentChange, threshold) => {
  const baggerBombs = calculateBaggerBombs(percentChange, threshold);
  const busts = calculateBusts(percentChange, threshold);

  const baggerBombPoints = baggerBombs * BAGGERBOMB.POINTS_PER_THRESHOLD;
  const bustPoints = busts * BAGGERBOMB.BUST_POINTS_PER_THRESHOLD;

  return {
    baggerBombs,
    busts,
    baggerBombPoints,
    bustPoints,
    totalBreakoutPoints: baggerBombPoints + bustPoints
  };
};

/**
 * Calculate complete asset score for PvP mode
 * Includes base points, breakout points, and conviction multiplier
 *
 * @param {number} percentChange - The asset's percentage change
 * @param {number} threshold - The asset's volatility threshold
 * @param {number} allocation - The asset's allocation percentage (7.5-20)
 * @param {boolean} useConviction - Whether to apply conviction multiplier
 * @returns {object} Complete scoring breakdown
 */
export const calculateAssetScore = (
  percentChange,
  threshold,
  allocation = 10,
  useConviction = true
) => {
  // Base points: +5 for green, -2 for red
  const basePoints = percentChange >= 0 ? 5 : -2;

  // Breakout points
  const { baggerBombs, busts, baggerBombPoints, bustPoints, totalBreakoutPoints } =
    calculateBreakoutPoints(percentChange, threshold);

  // Raw score before conviction
  const rawScore = basePoints + totalBreakoutPoints;

  // Apply conviction multiplier if enabled
  const convictionMultiplier = useConviction ? getConvictionMultiplier(allocation) : 1.0;
  const finalScore = rawScore * convictionMultiplier;

  return {
    percentChange,
    threshold,
    allocation,
    basePoints,
    baggerBombs,
    busts,
    baggerBombPoints,
    bustPoints,
    totalBreakoutPoints,
    rawScore,
    convictionMultiplier,
    finalScore: Math.round(finalScore * 100) / 100  // Round to 2 decimal places
  };
};

/**
 * Calculate asset score for Snake Draft mode
 * Uses daily % return * 10 as base, plus breakout bonuses
 * No conviction multipliers (equal weight assets)
 *
 * @param {number} percentChange - The asset's daily percentage change
 * @param {number} threshold - The asset's volatility threshold
 * @param {number} intradayHigh - Highest % gain reached during day (for BaggerBomb detection)
 * @param {number} intradayLow - Lowest % loss reached during day (for Bust detection)
 * @returns {object} Complete scoring breakdown
 */
export const calculateSnakeDraftAssetScore = (
  percentChange,
  threshold,
  intradayHigh = null,
  intradayLow = null
) => {
  // Base points: % return * 10 (so 3.5% = 35 points)
  const basePoints = percentChange * SNAKE_DRAFT.PERCENT_MULTIPLIER;

  // For BaggerBombs, use intraday high if available, otherwise closing %
  const baggerBombPercent = intradayHigh !== null ? intradayHigh : Math.max(0, percentChange);
  const baggerBombs = calculateBaggerBombs(baggerBombPercent, threshold);
  const baggerBombPoints = baggerBombs * BAGGERBOMB.POINTS_PER_THRESHOLD;

  // For Busts, use intraday low if available, otherwise closing %
  const bustPercent = intradayLow !== null ? intradayLow : Math.min(0, percentChange);
  const busts = calculateBusts(bustPercent, threshold);
  const bustPoints = busts * BAGGERBOMB.BUST_POINTS_PER_THRESHOLD;

  const totalScore = basePoints + baggerBombPoints + bustPoints;

  return {
    percentChange,
    threshold,
    basePoints: Math.round(basePoints * 100) / 100,
    baggerBombs,
    busts,
    baggerBombPoints,
    bustPoints,
    totalScore: Math.round(totalScore * 100) / 100
  };
};

/**
 * Calculate complete portfolio score
 *
 * @param {Array} assetScores - Array of asset score objects
 * @param {object} options - Scoring options
 * @returns {object} Portfolio scoring summary
 */
export const calculatePortfolioScore = (assetScores, options = {}) => {
  const { includeSessionBonus = false, sessionWon = false, allGreen = false } = options;

  let totalScore = 0;
  let totalBaggerBombs = 0;
  let totalBusts = 0;
  let greenCount = 0;
  let redCount = 0;

  for (const score of assetScores) {
    totalScore += score.finalScore || score.totalScore || 0;
    totalBaggerBombs += score.baggerBombs || 0;
    totalBusts += score.busts || 0;

    if (score.percentChange >= 0) {
      greenCount++;
    } else {
      redCount++;
    }
  }

  // Session bonus (PvP only)
  let sessionBonus = 0;
  if (includeSessionBonus) {
    if (sessionWon && allGreen) {
      sessionBonus = 30; // Clean Sweep
    } else if (allGreen) {
      sessionBonus = 20; // Green Sweep
    } else if (sessionWon) {
      sessionBonus = 10; // Win Session
    }
  }

  return {
    assetCount: assetScores.length,
    totalScore: Math.round((totalScore + sessionBonus) * 100) / 100,
    totalBaggerBombs,
    totalBusts,
    greenCount,
    redCount,
    allGreen: redCount === 0,
    sessionBonus
  };
};
