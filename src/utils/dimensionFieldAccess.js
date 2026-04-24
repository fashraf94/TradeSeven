// src/utils/dimensionFieldAccess.js
//
// Canonical reader / writer abstraction for Strategy Dimension field
// values. Introduced in Phase 4.5 of the Forge Expansion sprint to
// eliminate the bug class where forward-path writes (UI canonical) and
// reverse-path reads (deploy-time legacy-only) disagree — the concrete
// instance was M2 in the mid-sprint audit: `dimensionsToDirectives` and
// `dimensionsToGuardrails` silently returned stale default values when
// callers wrote to the new canonical field names.
//
// Contract
//   * `FIELD_REGISTRY` is the exhaustive source of truth for field
//     metadata. Every entry in `DIMENSION_DEFAULTS` has a canonical
//     registry entry keyed by its canonical field name (the new,
//     post-rename name in the current schema).
//   * `readDimensionField(dv, canonicalPath)` returns the canonical
//     value when present, else walks the entry's `legacy[]` locations
//     in order. Returns `undefined` when no path yields a value.
//   * `writeDimensionField(dv, canonicalPath, value)` writes only to
//     the canonical location and returns a new object. It never
//     writes to legacy paths — legacy reads are a compatibility shim
//     for pre-Phase-2 bundles, not a write target.
//   * `getFieldMetadata(canonicalPath)` exposes the registry entry for
//     consumers that need the metadata (escape hatch).
//
// No imports from `dimensionMapper.js` — this module is consumed by it,
// avoiding the cycle.

// ─────────────────────────────────────────────────────────────
// FIELD_REGISTRY
// ─────────────────────────────────────────────────────────────

export const FIELD_REGISTRY = {
  // ── Risk Posture ─────────────────────────────────────────
  stopLossPct: {
    canonical: { dimension: 'riskPosture', field: 'stopLossPct' },
    legacy: [{ dimension: 'riskPosture', field: 'stopLoss' }],
  },
  trailingStopPct: {
    canonical: { dimension: 'riskPosture', field: 'trailingStopPct' },
    legacy: [{ dimension: 'riskPosture', field: 'trailingStop' }],
  },

  // ── Entry Aggression ─────────────────────────────────────
  rsiCeiling: {
    canonical: { dimension: 'entryAggression', field: 'rsiCeiling' },
    legacy: [{ dimension: 'entryAggression', field: 'rsiUpper' }],
  },
  volumeConfirmEnabled: {
    canonical: { dimension: 'entryAggression', field: 'volumeConfirmEnabled' },
    legacy: [{ dimension: 'entryAggression', field: 'volumeConfirm' }],
  },
  volumeMultiplier: {
    canonical: { dimension: 'entryAggression', field: 'volumeMultiplier' },
    legacy: [],
  },
  fundamentalFloor: {
    canonical: { dimension: 'entryAggression', field: 'fundamentalFloor' },
    legacy: [],
  },
  trendAlignmentEnabled: {
    canonical: { dimension: 'entryAggression', field: 'trendAlignmentEnabled' },
    legacy: [],
  },
  trendAlignmentSmaPeriod: {
    canonical: { dimension: 'entryAggression', field: 'trendAlignmentSmaPeriod' },
    legacy: [],
  },
  momentumThresholdPct: {
    canonical: { dimension: 'entryAggression', field: 'momentumThresholdPct' },
    // Phase 2's Haiku output also writes to momentumSensitivity.momentumThresholdPct
    // (vestigial per spec §4.5), but nothing reads that duplicate. Registry only
    // recognizes the legacy name at the legacy dimension.
    legacy: [{ dimension: 'momentumSensitivity', field: 'momentumThreshold' }],
  },
  momentumLookbackDays: {
    canonical: { dimension: 'entryAggression', field: 'momentumLookbackDays' },
    legacy: [],
  },
  institutionalEnabled: {
    canonical: { dimension: 'entryAggression', field: 'institutionalEnabled' },
    legacy: [],
  },
  institutionalDirection: {
    canonical: { dimension: 'entryAggression', field: 'institutionalDirection' },
    legacy: [],
  },
  institutionalQuarters: {
    canonical: { dimension: 'entryAggression', field: 'institutionalQuarters' },
    legacy: [],
  },

  // ── Exit Discipline ──────────────────────────────────────
  profitTargetPct: {
    canonical: { dimension: 'exitDiscipline', field: 'profitTargetPct' },
    legacy: [{ dimension: 'exitDiscipline', field: 'profitTarget' }],
  },
  timeExitDays: {
    canonical: { dimension: 'exitDiscipline', field: 'timeExitDays' },
    legacy: [{ dimension: 'exitDiscipline', field: 'timeExit' }],
  },
  timeExitMinGainPct: {
    canonical: { dimension: 'exitDiscipline', field: 'timeExitMinGainPct' },
    legacy: [],
  },
  technicalExitEnabled: {
    canonical: { dimension: 'exitDiscipline', field: 'technicalExitEnabled' },
    legacy: [{ dimension: 'exitDiscipline', field: 'technicalExit' }],
  },
  technicalExitTrigger: {
    canonical: { dimension: 'exitDiscipline', field: 'technicalExitTrigger' },
    legacy: [],
  },
  technicalExitRsiThreshold: {
    canonical: { dimension: 'exitDiscipline', field: 'technicalExitRsiThreshold' },
    legacy: [],
  },
  technicalExitSmaPeriod: {
    canonical: { dimension: 'exitDiscipline', field: 'technicalExitSmaPeriod' },
    legacy: [],
  },
  earningsExitEnabled: {
    canonical: { dimension: 'exitDiscipline', field: 'earningsExitEnabled' },
    legacy: [],
  },
  earningsExitDays: {
    canonical: { dimension: 'exitDiscipline', field: 'earningsExitDays' },
    legacy: [],
  },
  earningsExitOnlyIfProfitable: {
    canonical: { dimension: 'exitDiscipline', field: 'earningsExitOnlyIfProfitable' },
    legacy: [],
  },

  // ── Sector Strategy ──────────────────────────────────────
  maxSectorWeightPct: {
    canonical: { dimension: 'sectorStrategy', field: 'maxSectorWeightPct' },
    legacy: [{ dimension: 'sectorStrategy', field: 'maxSectorWeight' }],
  },
  sectorDriftTolerancePct: {
    canonical: { dimension: 'sectorStrategy', field: 'sectorDriftTolerancePct' },
    legacy: [{ dimension: 'sectorStrategy', field: 'sectorDriftTolerance' }],
  },
  rebalanceOnDrift: {
    canonical: { dimension: 'sectorStrategy', field: 'rebalanceOnDrift' },
    legacy: [],
  },
  sectorFilterEnabled: {
    canonical: { dimension: 'sectorStrategy', field: 'sectorFilterEnabled' },
    legacy: [],
  },
  sectorFilterMode: {
    canonical: { dimension: 'sectorStrategy', field: 'sectorFilterMode' },
    legacy: [],
  },
  sectorFilterTimeframe: {
    canonical: { dimension: 'sectorStrategy', field: 'sectorFilterTimeframe' },
    legacy: [],
  },
  sectorFilterTopN: {
    canonical: { dimension: 'sectorStrategy', field: 'sectorFilterTopN' },
    legacy: [],
  },
  sectorFilterSelected: {
    canonical: { dimension: 'sectorStrategy', field: 'sectorFilterSelected' },
    legacy: [],
  },

  // ── Event Risk (renamed dimension from macroAwareness) ──
  earningsAvoidanceDays: {
    canonical: { dimension: 'eventRisk', field: 'earningsAvoidanceDays' },
    legacy: [{ dimension: 'macroAwareness', field: 'earningsAvoidance' }],
  },
  // Legacy-only macro holdovers — no canonical rename. Included in the
  // registry so `readDimensionField` can serve them uniformly. Post-audit
  // S1, their defaults are 'off' / false and they emit no rules unless a
  // legacy bundle explicitly carries a non-default value.
  fomcDefensive: {
    canonical: { dimension: 'macroAwareness', field: 'fomcDefensive' },
    legacy: [],
  },
  benchmarkGapResponse: {
    canonical: { dimension: 'macroAwareness', field: 'benchmarkGapResponse' },
    legacy: [],
  },

  // ── Position Sizing ──────────────────────────────────────
  maxPositionWeightPct: {
    canonical: { dimension: 'positionSizing', field: 'maxPositionWeightPct' },
    legacy: [{ dimension: 'positionSizing', field: 'maxPosition' }],
  },
  cashDeploymentTriggerPct: {
    canonical: { dimension: 'positionSizing', field: 'cashDeploymentTriggerPct' },
    legacy: [{ dimension: 'positionSizing', field: 'cashDeploymentTrigger' }],
  },
  trimThreshold: {
    canonical: { dimension: 'positionSizing', field: 'trimThreshold' },
    legacy: [],
  },
  addToWinnersEnabled: {
    canonical: { dimension: 'positionSizing', field: 'addToWinnersEnabled' },
    // Relocated from momentumSensitivity.addToWinners per spec §4.7.
    legacy: [{ dimension: 'momentumSensitivity', field: 'addToWinners' }],
  },
  winnerReturnTrigger: {
    canonical: { dimension: 'positionSizing', field: 'winnerReturnTrigger' },
    legacy: [],
  },
  winnerAddWeight: {
    canonical: { dimension: 'positionSizing', field: 'winnerAddWeight' },
    legacy: [],
  },
  cutUnderperformersEnabled: {
    canonical: { dimension: 'positionSizing', field: 'cutUnderperformersEnabled' },
    // Relocated from momentumSensitivity.cutUnderperformers per spec §4.7.
    legacy: [{ dimension: 'momentumSensitivity', field: 'cutUnderperformers' }],
  },
  loserUnderperformanceTrigger: {
    canonical: { dimension: 'positionSizing', field: 'loserUnderperformanceTrigger' },
    legacy: [],
  },
  loserLookbackDays: {
    canonical: { dimension: 'positionSizing', field: 'loserLookbackDays' },
    legacy: [],
  },
  loserReduceWeight: {
    canonical: { dimension: 'positionSizing', field: 'loserReduceWeight' },
    legacy: [],
  },
  correlationExitEnabled: {
    canonical: { dimension: 'positionSizing', field: 'correlationExitEnabled' },
    legacy: [],
  },
  correlationThreshold: {
    canonical: { dimension: 'positionSizing', field: 'correlationThreshold' },
    legacy: [],
  },
  correlationLookbackDays: {
    canonical: { dimension: 'positionSizing', field: 'correlationLookbackDays' },
    legacy: [],
  },
};

// ─────────────────────────────────────────────────────────────
// Reader / Writer
// ─────────────────────────────────────────────────────────────

/**
 * Read a dimension field value. Prefers the canonical location;
 * falls back through legacy locations in order when the canonical
 * value is undefined. Returns `undefined` when no path yields a
 * value, and (same) for unknown canonical paths with a console warn.
 */
export function readDimensionField(dimensionValues, canonicalPath) {
  if (!dimensionValues) return undefined;
  const entry = FIELD_REGISTRY[canonicalPath];
  if (!entry) {
    console.warn(`[dimensionFieldAccess] readDimensionField: unknown field "${canonicalPath}"`);
    return undefined;
  }
  const canonical =
    dimensionValues[entry.canonical.dimension]?.[entry.canonical.field];
  if (canonical !== undefined) return canonical;
  for (const loc of entry.legacy) {
    const v = dimensionValues[loc.dimension]?.[loc.field];
    if (v !== undefined) return v;
  }
  return undefined;
}

/**
 * Write a dimension field value to its canonical location. Immutable
 * — returns a new object, leaves the input untouched. Never writes
 * legacy locations; legacy is a compatibility shim for reads only.
 */
export function writeDimensionField(dimensionValues, canonicalPath, value) {
  const entry = FIELD_REGISTRY[canonicalPath];
  if (!entry) {
    console.warn(`[dimensionFieldAccess] writeDimensionField: unknown field "${canonicalPath}"`);
    return dimensionValues;
  }
  const { dimension, field } = entry.canonical;
  const base = dimensionValues || {};
  return {
    ...base,
    [dimension]: {
      ...(base[dimension] || {}),
      [field]: value,
    },
  };
}

/** Escape hatch: return the registry entry for a canonical path. */
export function getFieldMetadata(canonicalPath) {
  return FIELD_REGISTRY[canonicalPath];
}
