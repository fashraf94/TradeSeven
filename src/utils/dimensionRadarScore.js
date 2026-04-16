// src/utils/dimensionRadarScore.js
//
// Shared normalization: converts a Strategy Dimensions `values` map into
// radar-axis scores in [0.05, 1]. Used by both StrategyDimensions (full-size
// radar in Season Entry) and ForgeLanding (mini radar on State 2–4 cards).
//
// Each formula is a heuristic expression of the axis's "character": tighter
// risk mgmt, more aggressive entries, quicker exits, etc. Scores are clamped
// to [0.05, 1] so the polygon remains visible even at the extremes.

import { DIMENSION_DEFAULTS } from './dimensionMapper';

export const DIMENSION_KEYS = [
  'riskPosture',
  'entryAggression',
  'exitDiscipline',
  'sectorStrategy',
  'momentumSensitivity',
  'macroAwareness',
  'positionSizing',
];

function clamp(n, lo, hi) {
  return Math.min(Math.max(n, lo), hi);
}

export function dimensionToRadarScore(key, v) {
  if (!v) return 0.5;
  switch (key) {
    case 'riskPosture':
      return clamp(1 - (v.stopLoss - 3) / 17, 0.05, 1);
    case 'entryAggression':
      return clamp(
        0.5 * ((v.rsiUpper - 50) / 30) +
          0.5 * (1 - v.fundamentalFloor / 100),
        0.05,
        1
      );
    case 'exitDiscipline':
      return clamp(1 - (v.profitTarget - 5) / 25, 0.05, 1);
    case 'sectorStrategy':
      return clamp((v.maxSectorWeight - 10) / 40, 0.05, 1);
    case 'momentumSensitivity':
      return clamp(
        0.5 * (v.momentumThreshold / 6) +
          0.25 * (v.addToWinners ? 1 : 0) +
          0.25 * (v.cutUnderperformers ? 1 : 0),
        0.05,
        1
      );
    case 'macroAwareness':
      return clamp(
        0.5 * (v.earningsAvoidance / 7) +
          0.3 * (v.fomcDefensive ? 1 : 0) +
          0.2 *
            (v.benchmarkGapResponse === 'aggressive'
              ? 1
              : v.benchmarkGapResponse === 'react'
              ? 0.5
              : 0),
        0.05,
        1
      );
    case 'positionSizing':
      return clamp((v.maxPosition - 5) / 20, 0.05, 1);
    default:
      return 0.5;
  }
}

// Compute all 7 dimension scores from a `values` map. Missing dimensions or
// missing sub-keys fall back to DIMENSION_DEFAULTS so partial inputs never
// produce NaN.
export function computeAllRadarScores(values) {
  const out = {};
  DIMENSION_KEYS.forEach((key) => {
    const merged = { ...(DIMENSION_DEFAULTS[key] || {}), ...(values?.[key] || {}) };
    out[key] = dimensionToRadarScore(key, merged);
  });
  return out;
}
