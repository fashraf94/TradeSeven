/**
 * Game-Mode Context Weighting — Fit Score Computation
 *
 * Computes game-specific fit scores by applying different weight profiles
 * to the same underlying fundamental pillar + technical factor base scores.
 * ATR percentile acts as a volatility modifier (rewarded in BaggerBomb).
 *
 * All functions are pure math — no API calls, no Firestore access.
 */

import { GAME_MODE_PROFILES, COMPETE_PILLAR_WEIGHTS, TECHNICAL_FACTOR_WEIGHTS } from './rankingConfig.js';

// ---------------------------------------------------------------------------
// Core: Apply override multipliers and re-normalize weights
// ---------------------------------------------------------------------------

/**
 * Apply per-factor override multipliers to base weights, then re-normalize
 * so the adjusted weights still sum to 1.0.
 *
 * @param {Object} baseWeights - e.g. { growth: 0.15, profitability: 0.15, ... }
 * @param {Object|undefined} overrides - e.g. { growth: 1.2, profitability: 0.8, ... }
 * @returns {Object} Re-normalized weights
 */
function applyOverrides(baseWeights, overrides) {
  if (!overrides) return { ...baseWeights };

  const adjusted = {};
  let total = 0;
  for (const [key, weight] of Object.entries(baseWeights)) {
    const multiplier = overrides[key] ?? 1.0;
    adjusted[key] = weight * multiplier;
    total += adjusted[key];
  }

  // Re-normalize to sum to 1.0
  if (total > 0) {
    for (const key of Object.keys(adjusted)) {
      adjusted[key] /= total;
    }
  }

  return adjusted;
}

// ---------------------------------------------------------------------------
// Compute weighted score from pillar/factor scores and adjusted weights
// ---------------------------------------------------------------------------

/**
 * Compute a weighted composite from individual scores and weights.
 * Handles missing scores by redistributing weight proportionally.
 *
 * @param {Object} scores - e.g. { growth: 75, profitability: 88, ... } (0-100 each)
 * @param {Object} weights - e.g. { growth: 0.15, profitability: 0.15, ... }
 * @returns {number|null} Weighted score (0-100) or null if insufficient data
 */
function computeWeightedScore(scores, weights) {
  let totalWeight = 0;
  let weightedSum = 0;
  let available = 0;

  for (const [key, weight] of Object.entries(weights)) {
    if (scores[key] != null) {
      totalWeight += weight;
      weightedSum += scores[key] * weight;
      available++;
    }
  }

  if (available < 3 || totalWeight === 0) return null;
  return weightedSum / totalWeight;
}

// ---------------------------------------------------------------------------
// Public API: Compute game-mode fit scores for a single stock
// ---------------------------------------------------------------------------

/**
 * Compute fit scores for all game modes for a single stock.
 *
 * @param {Object} params
 * @param {Object} params.pillarScores - Fundamental pillar scores { growth: 75, profitability: 88, ... }
 * @param {Object} params.technicalFactorScores - Technical factor scores { rsVsSpy: 95, sectorRS: 88, ... }
 * @param {number} params.atrPercentile - ATR percentile rank (0-1 scale)
 * @returns {Object} { baggerBombFit } (0-100 or null)
 */
export function computeGameModeFits({ pillarScores, technicalFactorScores, atrPercentile }) {
  const results = {};

  for (const [modeName, profile] of Object.entries(GAME_MODE_PROFILES)) {
    if (modeName === 'standard') continue; // Standard composite is computed separately

    const adjFundWeights = applyOverrides(COMPETE_PILLAR_WEIGHTS, profile.fundamentalOverrides);
    const adjTechWeights = applyOverrides(TECHNICAL_FACTOR_WEIGHTS, profile.technicalOverrides);

    const fundScore = computeWeightedScore(pillarScores || {}, adjFundWeights);
    const techScore = computeWeightedScore(technicalFactorScores || {}, adjTechWeights);

    let fitScore = null;
    if (fundScore != null || techScore != null) {
      const fScore = fundScore ?? 50; // neutral fallback
      const tScore = techScore ?? 50;
      fitScore = (fScore * profile.fundamentalWeight) + (tScore * profile.technicalWeight);

      // Apply ATR modifier
      if (profile.atrModifier !== 0 && atrPercentile != null) {
        fitScore += atrPercentile * profile.atrModifier * 100;
      }

      // Clamp to 0-100
      fitScore = Math.round(Math.max(0, Math.min(100, fitScore)));
    }

    results[`${modeName}Fit`] = fitScore;
  }

  return results;
}

/**
 * Rank stocks by each game-mode fit score.
 * Mutates stock objects to add rank fields (e.g. baggerBombRank).
 *
 * @param {Array} stocks - Array of stock objects with fit scores already computed
 */
export function assignGameModeRanks(stocks) {
  const modes = ['baggerBomb'];

  for (const mode of modes) {
    const fitKey = `${mode}Fit`;
    const rankKey = `${mode}Rank`;

    const withScores = stocks
      .filter(s => s[fitKey] != null)
      .sort((a, b) => b[fitKey] - a[fitKey]);

    withScores.forEach((stock, idx) => {
      stock[rankKey] = idx + 1;
    });
  }
}
