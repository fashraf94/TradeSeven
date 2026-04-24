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
import { readDimensionField } from './dimensionFieldAccess';

export const DIMENSION_KEYS = [
  'riskPosture',
  'entryAggression',
  'exitDiscipline',
  'sectorStrategy',
  'momentumSensitivity',
  'eventRisk',
  'positionSizing',
];

function clamp(n, lo, hi) {
  return Math.min(Math.max(n, lo), hi);
}

// Phase 4.5: signature changed from `(key, subDimensionValues)` to
// `(key, fullDimensionValues)` so reads go through the canonical access
// layer — the layer needs cross-dimension visibility (e.g. eventRisk's
// earningsAvoidanceDays with fallback to macroAwareness.earningsAvoidance).
// `dimensionToRadarScore` now takes the whole dv blob; callers pass it
// through verbatim.
export function dimensionToRadarScore(key, dv) {
  if (!dv) return 0.5;
  switch (key) {
    case 'riskPosture': {
      const stop = readDimensionField(dv, 'stopLossPct') ?? 8;
      return clamp(1 - (stop - 3) / 17, 0.05, 1);
    }
    case 'entryAggression': {
      const rsi = readDimensionField(dv, 'rsiCeiling') ?? 65;
      const floor = readDimensionField(dv, 'fundamentalFloor') ?? 45;
      return clamp(
        0.5 * ((rsi - 50) / 30) + 0.5 * (1 - floor / 100),
        0.05,
        1
      );
    }
    case 'exitDiscipline': {
      const profit = readDimensionField(dv, 'profitTargetPct') ?? 15;
      return clamp(1 - (profit - 5) / 25, 0.05, 1);
    }
    case 'sectorStrategy': {
      const maxWeight = readDimensionField(dv, 'maxSectorWeightPct') ?? 30;
      return clamp((maxWeight - 10) / 40, 0.05, 1);
    }
    case 'momentumSensitivity': {
      const threshold = readDimensionField(dv, 'momentumThresholdPct') ?? 2;
      const addToWinners = readDimensionField(dv, 'addToWinnersEnabled');
      const cutLosers = readDimensionField(dv, 'cutUnderperformersEnabled');
      return clamp(
        0.5 * (threshold / 6) +
          0.25 * (addToWinners ? 1 : 0) +
          0.25 * (cutLosers ? 1 : 0),
        0.05,
        1
      );
    }
    case 'eventRisk': {
      // Spec §4.6: single-signal formula keeps the axis responsive to
      // the one control the user can move. Legacy fomcDefensive /
      // benchmarkGapResponse stay in defaults for data continuity but
      // no longer contribute until Season Mode tournament rules return.
      const days = readDimensionField(dv, 'earningsAvoidanceDays') ?? 0;
      return clamp(days / 10, 0.05, 1);
    }
    case 'positionSizing': {
      const maxPos = readDimensionField(dv, 'maxPositionWeightPct') ?? 15;
      return clamp((maxPos - 5) / 20, 0.05, 1);
    }
    default:
      return 0.5;
  }
}

// Compute all 7 dimension scores from a full dimensionValues map. Null /
// undefined inputs fall back to a balanced 0.5 score via the switch's
// default branch. DIMENSION_DEFAULTS import retained for backward-compat
// callers that still pass a per-dimension sub-object instead of the full
// map — the merge below rehydrates those into a full-shape blob.
export function computeAllRadarScores(values) {
  const dv = values || {};
  // If the caller passed a per-dimension sub-object by mistake (legacy
  // API shape), wrap it so readDimensionField can still resolve paths.
  // Detectable as: values has keys that aren't dimension names.
  const looksLikeFullBlob = DIMENSION_KEYS.some((k) => dv[k] !== undefined);
  const hydrated = looksLikeFullBlob
    ? dv
    : { ...DIMENSION_DEFAULTS, ...dv };
  const out = {};
  DIMENSION_KEYS.forEach((key) => {
    out[key] = dimensionToRadarScore(key, hydrated);
  });
  return out;
}
