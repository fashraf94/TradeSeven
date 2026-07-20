// src/utils/dimensionMapper.js
//
// Strategy Dimensions ↔ Season Rules translation layer.
//
// The UI exposes 7 strategic "dimensions" — each a handful of sliders/toggles —
// while the Proving Ground engine speaks in individual season-mode rules
// (se-*, sx-*, sr-*, ss-*). This file is the ONLY place that knows how a
// dimension knob becomes a rule param, and how to materialize a bundle +
// rule docs in Firestore so the existing create-entry API can consume it.
//
// Design contracts:
//   * `DIMENSION_DEFAULTS` is the blank-slate state for a fresh user.
//   * `COLLECTION_PRESETS` seeds the 4 Trading Style presets + Custom.
//   * `dimensionsToRuleSnapshots(values)` produces the array of
//     `{id, textTemplate, paramValues, category, …}` objects that
//     `api/season/create-entry.js:buildBundleRules` validates against the
//     live rule doc. Disabled toggles OMIT rules entirely.
//   * `materializeDimensionBundle(...)` writes rule docs + a forged bundle
//     doc to Firestore under `agents/{agentId}/{rules,bundles}`, returning
//     a deterministic `bundleId` that can be passed to create-entry.
//
// Phase 3 scope notes (per user decisions):
//   * Dropped: riskPosture.circuitBreaker, entryAggression.rsiLow,
//     positionSizing.targetPositions (no matching season rule template).
//   * Trailing stop (sx-02) is % not ATR — clamped to 3–25.
//   * benchmarkGapResponse toggles between ss-01 (aggressive) and
//     ss-02 (protective, "lead-protection"), or off.

import {
  doc,
  getDoc,
  collection,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import {
  readDimensionField,
  writeDimensionField,
  FIELD_REGISTRY,
} from './dimensionFieldAccess';

// ─────────────────────────────────────────────────────────────
// Dimension defaults
// ─────────────────────────────────────────────────────────────
//
// These mirror the `default` field on each season rule's forge template in
// `src/data/forgeKnowledgeBase.js`, so a blank dimensionValues object
// produces rule params identical to clicking "use defaults" in the rule
// config drawer.

// Phase 1 (Forge Expansion Sprint v3): defaults carry BOTH the legacy shape
// (old field names, old dimension locations) AND the new semantic schema
// names. Keeping both keyed alongside each other is deliberate:
//   * downstream consumers (RadarChart, StrategyDimensions card config,
//     compile-dimensions prompt, dimensionRadarScore) still read the legacy
//     keys. They get migrated in later phases of this sprint.
//   * emit helpers in this file prefer the NEW field names and fall back to
//     legacy names, so freshly-compiled bundles + old bundles both work.
export const DIMENSION_DEFAULTS = Object.freeze({
  riskPosture: {
    // Legacy
    stopLoss: 8,               // sx-01.pct
    trailingStop: 10,          // sx-02.pct (% trail distance, NOT ATR)
    // New
    stopLossPct: 8,
    trailingStopPct: 10,
  },
  entryAggression: {
    // Legacy
    rsiUpper: 65,              // se-01.upper
    volumeConfirm: true,       // se-02 toggle (was: multiplier fixed at 1.2)
    fundamentalFloor: 45,      // se-05.minScore
    // New
    rsiCeiling: 65,
    volumeConfirmEnabled: true,
    volumeMultiplier: 1.5,     // se-02 param: 1.2 | 1.5 | 2.0 | 3.0
    trendAlignmentEnabled: false,  // se-03 toggle
    trendAlignmentSmaPeriod: 50,   // se-03: 20 | 50 | 100 | 200
    momentumThresholdPct: 2,       // se-06.pct
    momentumLookbackDays: 10,      // se-06.period: 5 | 10 | 20
    institutionalEnabled: false,   // se-08 toggle
    institutionalDirection: 'increased', // 'any'|'increased'|'stable_or_increased'
    institutionalQuarters: 2,      // 1 | 2 | 4
  },
  exitDiscipline: {
    // Legacy
    profitTarget: 15,          // sx-04.pct
    timeExit: 5,               // sx-03.days
    technicalExit: false,      // sx-05 toggle
    // New
    profitTargetPct: 15,
    timeExitDays: 5,
    timeExitMinGainPct: 1,     // sx-03 min gain: 0 | 1 | 3 | 5
    technicalExitEnabled: false,
    technicalExitTrigger: 'rsi_overbought', // rsi_overbought|macd_bearish|either_rsi_or_macd|below_sma
    technicalExitRsiThreshold: 75, // 65 | 70 | 75 | 80 | 85
    technicalExitSmaPeriod: 50,    // 20 | 50 | 100 | 200
    earningsExitEnabled: false,    // sx-06 toggle
    earningsExitDays: 2,           // 1 | 2 | 3 | 5
    earningsExitOnlyIfProfitable: true,
  },
  sectorStrategy: {
    // Legacy
    maxSectorWeight: 30,       // se-07.maxPct
    sectorDriftTolerance: 10,  // sr-03.tolerance
    rebalanceOnDrift: true,    // sr-03 toggle
    // New
    maxSectorWeightPct: 30,
    sectorDriftTolerancePct: 10,
    // NOTE: se-09 Sector Momentum Filter defaults live here in the schema
    // but emission is deferred to Phase 1.5 (evaluator doesn't exist yet).
    sectorFilterEnabled: false,
    sectorFilterMode: 'top_n',
    sectorFilterTimeframe: '1W',
    sectorFilterTopN: 3,
    sectorFilterSelected: [],
  },
  momentumSensitivity: {
    // Legacy dimension, retained for Phase 4 visual continuity. Holds
    // legacy copies of sr-04/sr-05 toggles; emit helpers prefer the new
    // positionSizing location and fall back here.
    momentumThreshold: 2,      // se-06.pct (legacy name for momentumThresholdPct)
    addToWinners: true,        // legacy sr-04 toggle
    cutUnderperformers: true,  // legacy sr-05 toggle
  },
  macroAwareness: {
    // Legacy dimension, renamed to eventRisk. Retained so legacy consumers
    // keep reading. New bundles populate `eventRisk` below.
    earningsAvoidance: 3,              // se-04.days (legacy name)
    fomcDefensive: false,              // ss-04 toggle
    // Mid-sprint audit S1: default flipped from 'react' to 'off'. Phase 4
    // removed the UI control for this field while emitRule_benchmarkGap
    // still emits ss-02 when the value is 'react'. The old default caused
    // every fresh bundle to silently carry ss-02 (Lead Protection) that
    // users could neither see nor disable. Legacy bundles that carry
    // 'react' or 'aggressive' continue to emit the same rules as before.
    benchmarkGapResponse: 'off',       // 'off' | 'react' | 'aggressive'
  },
  eventRisk: {
    // New dimension. Sole rule today is se-04.
    earningsAvoidanceDays: 3,
  },
  positionSizing: {
    // Legacy
    maxPosition: 15,           // sr-01.maxPct
    cashDeploymentTrigger: 15, // sr-02.pct
    trimThreshold: 3,          // sr-01 gap: targetPct = maxPct - trimThreshold
    // New
    maxPositionWeightPct: 15,
    cashDeploymentTriggerPct: 15,
    // sr-04 relocated here from momentumSensitivity
    addToWinnersEnabled: true,
    winnerReturnTrigger: 10,   // 5 | 10 | 15 | 20
    winnerAddWeight: 2,        // 1 | 2 | 3 | 5
    // sr-05 relocated here from momentumSensitivity
    cutUnderperformersEnabled: true,
    loserUnderperformanceTrigger: 5,  // 3 | 5 | 8 | 10
    loserLookbackDays: 5,             // 3 | 5 | 10 | 15
    loserReduceWeight: 3,             // 1 | 2 | 3 | 5
    // sx-07 correlation exit (portfolio-level)
    correlationExitEnabled: false,
    correlationThreshold: 0.8,        // 0.7 | 0.8 | 0.9
    correlationLookbackDays: 30,      // 20 | 30 | 60 | 90
  },
});

// Deep clone of defaults, callable wherever fresh state is needed.
export function cloneDefaults() {
  return JSON.parse(JSON.stringify(DIMENSION_DEFAULTS));
}

// ─────────────────────────────────────────────────────────────
// Posture labels
// ─────────────────────────────────────────────────────────────
//
// Each dimension renders a small colored badge that changes as the user
// moves sliders. The thresholds below are the source of truth — the UI
// calls getPostureLabel(dimensionKey, values) and renders the returned
// { label, tone }.
//
// `tone` is a semantic bucket ('cool' | 'neutral' | 'hot') the UI maps to
// color opacities; the category color itself is owned by the panel config.

function bucket(low, high, conservative, moderate, aggressive) {
  if (low && conservative) return { label: conservative, tone: 'cool' };
  if (high && aggressive) return { label: aggressive, tone: 'hot' };
  return { label: moderate, tone: 'neutral' };
}

// Posture functions receive the full `dimensionValues` object and read
// fields through the canonical access layer. Pre-Phase-4.5 the API was
// `fn(values[dimensionKey])` with legacy-name reads inline; post-refactor
// every read goes through `readDimensionField` so legacy and canonical
// bundles produce identical postures.
function posture_riskPosture(dv) {
  const stop = readDimensionField(dv, 'stopLossPct');
  const trail = readDimensionField(dv, 'trailingStopPct');
  const tight = stop <= 5 && trail <= 6;
  const loose = stop > 12 || trail > 15;
  return bucket(tight, loose, 'Conservative', 'Moderate', 'Aggressive');
}

function posture_entryAggression(dv) {
  const rsi = readDimensionField(dv, 'rsiCeiling');
  const floor = readDimensionField(dv, 'fundamentalFloor');
  const strict = rsi <= 55 && floor >= 60;
  const wide = rsi > 70 || floor < 35;
  return bucket(strict, wide, 'Strict', 'Moderate', 'Wide open');
}

function posture_exitDiscipline(dv) {
  const profit = readDimensionField(dv, 'profitTargetPct');
  const time = readDimensionField(dv, 'timeExitDays');
  const patient = profit >= 20 && time >= 10;
  const quick = profit < 10 || time < 5;
  return bucket(patient, quick, 'Patient', 'Balanced', 'Quick');
}

function posture_sectorStrategy(dv) {
  const maxWeight = readDimensionField(dv, 'maxSectorWeightPct');
  const concentrated = maxWeight >= 40;
  const diversified = maxWeight < 25;
  return bucket(diversified, concentrated, 'Diversified', 'Balanced', 'Concentrated');
}

function posture_momentumSensitivity(dv) {
  const threshold = readDimensionField(dv, 'momentumThresholdPct');
  const addToWinners = readDimensionField(dv, 'addToWinnersEnabled');
  const chaser = threshold >= 5 && addToWinners;
  const contrarian = threshold < 2 || !addToWinners;
  return bucket(contrarian, chaser, 'Contrarian', 'Balanced', 'Momentum chaser');
}

// Legacy macroAwareness dimension — kept so legacy bundles that still
// render under `macroAwareness` in the UI (shouldn't happen post-Phase-4
// but defensive) produce a sensible label. Reads via canonical helper so
// the legacy earningsAvoidance fallback path resolves identically.
function posture_macroAwareness(dv) {
  const days = readDimensionField(dv, 'earningsAvoidanceDays') ?? 0;
  const fomc = readDimensionField(dv, 'fomcDefensive');
  const reactive = days >= 5 && fomc;
  const ignore = days <= 1 && !fomc;
  return bucket(ignore, reactive, 'Ignore', 'Moderate', 'Reactive');
}

function posture_eventRisk(dv) {
  const days = readDimensionField(dv, 'earningsAvoidanceDays') ?? 0;
  const reactive = days >= 5;
  const ignore = days <= 1;
  return bucket(ignore, reactive, 'Ignore', 'Moderate', 'Reactive');
}

function posture_positionSizing(dv) {
  const maxPos = readDimensionField(dv, 'maxPositionWeightPct');
  const concentrated = maxPos >= 20;
  const spread = maxPos < 12;
  return bucket(spread, concentrated, 'Spread thin', 'Equal weight', 'Concentrated');
}

const POSTURE_FNS = {
  riskPosture: posture_riskPosture,
  entryAggression: posture_entryAggression,
  exitDiscipline: posture_exitDiscipline,
  sectorStrategy: posture_sectorStrategy,
  momentumSensitivity: posture_momentumSensitivity,
  macroAwareness: posture_macroAwareness,
  eventRisk: posture_eventRisk,
  positionSizing: posture_positionSizing,
};

// Phase 4.5: signature changed from `(dimensionKey, subDimensionValues)`
// to `(dimensionKey, fullDimensionValues)` so posture functions can use
// the canonical reader, which needs cross-dimension visibility (e.g.
// eventRisk's earningsAvoidanceDays with fallback to
// macroAwareness.earningsAvoidance). Callers pass the whole dv blob.
export function getPostureLabel(dimensionKey, dimensionValues) {
  const fn = POSTURE_FNS[dimensionKey];
  if (!fn || !dimensionValues) return { label: '—', tone: 'neutral' };
  try {
    return fn(dimensionValues);
  } catch {
    return { label: '—', tone: 'neutral' };
  }
}

// ─────────────────────────────────────────────────────────────
// Collection presets
// ─────────────────────────────────────────────────────────────
//
// Trading Style Collections that preload the 7 dimensions with a coherent
// personality. The existing `forgeCollections.js` catalog is anchored on
// BaggerBomb rule IDs (th-*, mb-*, etc.), so these presets are tuned
// independently for the season-mode dimension surface while preserving
// each collection's strategic intent.
//
// Each preset merges over DIMENSION_DEFAULTS, so only the values a
// collection cares about need to be listed.

export const COLLECTION_DEFS = [
  {
    id: 'momentum-rider',
    label: 'Momentum Rider',
    accentColor: '#5EEAD4',
    tagline: 'Chase strength, add to winners.',
  },
  {
    id: 'swing-trader',
    label: 'Swing Trader',
    accentColor: '#F0C75E',
    tagline: 'Patient entries, balanced exits.',
  },
  {
    id: 'day-trader',
    label: 'Day Trader',
    accentColor: '#38BDF8',
    tagline: 'Quick profits, tight stops.',
  },
  {
    id: 'defensive-fortress',
    label: 'Defensive Fortress',
    accentColor: '#EF4444',
    tagline: 'Capital protection first.',
  },
  {
    id: 'custom',
    label: 'Custom',
    accentColor: '#8B5CF6',
    tagline: 'Blank slate — tune every knob.',
  },
];

// Partial preset objects, merged over DIMENSION_DEFAULTS in applyPreset.
// Phase 4.5 (audit B2 pulled in): migrated from legacy field names to
// canonical schema so the canonical-wins reader in `dimensionFieldAccess`
// sees preset values, not stale defaults. Relocated fields land in their
// new dimensions:
//   momentumSensitivity.addToWinners → positionSizing.addToWinnersEnabled
//   momentumSensitivity.cutUnderperformers → positionSizing.cutUnderperformersEnabled
//   macroAwareness.earningsAvoidance → eventRisk.earningsAvoidanceDays
// Legacy macroAwareness.fomcDefensive and .benchmarkGapResponse are
// dropped from presets — their UI controls are gone and their defaults
// are now 'off'/false per audit S1, so emitting them from presets would
// re-introduce the silent-rule-emission bug.
const COLLECTION_DELTAS = {
  'momentum-rider': {
    riskPosture: { stopLossPct: 12, trailingStopPct: 15 },
    entryAggression: {
      rsiCeiling: 72,
      volumeConfirmEnabled: true,
      fundamentalFloor: 30,
      momentumThresholdPct: 5,
    },
    exitDiscipline: { profitTargetPct: 25, timeExitDays: 7, technicalExitEnabled: false },
    sectorStrategy: { maxSectorWeightPct: 40, sectorDriftTolerancePct: 15, rebalanceOnDrift: false },
    eventRisk: { earningsAvoidanceDays: 2 },
    positionSizing: {
      maxPositionWeightPct: 20,
      cashDeploymentTriggerPct: 10,
      trimThreshold: 5,
      addToWinnersEnabled: true,
      cutUnderperformersEnabled: true,
    },
  },
  'swing-trader': {
    riskPosture: { stopLossPct: 8, trailingStopPct: 10 },
    entryAggression: {
      rsiCeiling: 65,
      volumeConfirmEnabled: true,
      fundamentalFloor: 50,
      momentumThresholdPct: 2,
    },
    exitDiscipline: { profitTargetPct: 15, timeExitDays: 8, technicalExitEnabled: true },
    sectorStrategy: { maxSectorWeightPct: 30, sectorDriftTolerancePct: 10, rebalanceOnDrift: true },
    eventRisk: { earningsAvoidanceDays: 3 },
    positionSizing: {
      maxPositionWeightPct: 15,
      cashDeploymentTriggerPct: 15,
      trimThreshold: 3,
      addToWinnersEnabled: false,
      cutUnderperformersEnabled: true,
    },
  },
  'day-trader': {
    riskPosture: { stopLossPct: 4, trailingStopPct: 5 },
    entryAggression: {
      rsiCeiling: 60,
      volumeConfirmEnabled: true,
      fundamentalFloor: 35,
      momentumThresholdPct: 4,
    },
    exitDiscipline: { profitTargetPct: 8, timeExitDays: 3, technicalExitEnabled: true },
    sectorStrategy: { maxSectorWeightPct: 35, sectorDriftTolerancePct: 15, rebalanceOnDrift: false },
    eventRisk: { earningsAvoidanceDays: 1 },
    positionSizing: {
      maxPositionWeightPct: 12,
      cashDeploymentTriggerPct: 8,
      trimThreshold: 3,
      addToWinnersEnabled: true,
      cutUnderperformersEnabled: false,
    },
  },
  'defensive-fortress': {
    riskPosture: { stopLossPct: 5, trailingStopPct: 6 },
    entryAggression: {
      rsiCeiling: 55,
      volumeConfirmEnabled: true,
      fundamentalFloor: 65,
      momentumThresholdPct: 1,
    },
    exitDiscipline: { profitTargetPct: 20, timeExitDays: 10, technicalExitEnabled: true },
    sectorStrategy: { maxSectorWeightPct: 20, sectorDriftTolerancePct: 7, rebalanceOnDrift: true },
    eventRisk: { earningsAvoidanceDays: 5 },
    positionSizing: {
      maxPositionWeightPct: 10,
      cashDeploymentTriggerPct: 25,
      trimThreshold: 3,
      addToWinnersEnabled: false,
      cutUnderperformersEnabled: true,
    },
  },
  'custom': {}, // blank slate uses defaults
};

// Returns a fresh dimensionValues object for a collection.
export function applyCollectionPreset(collectionId) {
  const base = cloneDefaults();
  const delta = COLLECTION_DELTAS[collectionId];
  if (!delta) return base;
  // Merge one level deep — each dimension is an object of primitives.
  for (const dimKey of Object.keys(delta)) {
    base[dimKey] = { ...base[dimKey], ...delta[dimKey] };
  }
  return base;
}

// ─────────────────────────────────────────────────────────────
// Translation: dimensions → rule snapshots
// ─────────────────────────────────────────────────────────────
//
// Produces the array of snapshot objects the create-entry endpoint
// expects to see under `bundle.ruleSnapshots`. The server will re-read
// `agents/{agentId}/rules/{snap.id}.sourceRef` to validate each one — so
// the rule docs we write later MUST share the same template id as
// `snap.id` (we key both on `dim-{templateId}`).
//
// Each snapshot shape mirrors what `forgeService.forgeBundle` produces:
//   { id, text, textTemplate, params, paramValues, category, visibility }
//
// Disabled toggles omit their rule(s) entirely — the snapshot list
// just won't contain them, so the server never instantiates them.

const TEMPLATE_CATALOG = {
  'se-01': {
    category: 'entry_criteria',
    textTemplate: 'Only enter positions where RSI is below {upper}',
  },
  'se-02': {
    category: 'entry_criteria',
    textTemplate: 'Require volume to be at least {multiplier}x the 20-day average before entering',
  },
  'se-03': {
    category: 'entry_criteria',
    textTemplate: 'Only enter stocks trading above their {period}-day SMA',
  },
  'se-04': {
    category: 'entry_criteria',
    textTemplate: "Don't enter within {days} trading days of an earnings report",
  },
  'se-05': {
    category: 'entry_criteria',
    textTemplate: 'Only enter stocks with a Fundamental Score above {minScore}',
  },
  'se-06': {
    category: 'entry_criteria',
    textTemplate: 'Require a minimum {period}-day price change of {pct}%',
  },
  'se-07': {
    category: 'entry_criteria',
    textTemplate: "Don't enter if sector already at {maxPct}% or more of portfolio",
  },
  'se-08': {
    category: 'entry_criteria',
    textTemplate: 'Require institutional ownership to be {direction} over the last {quarters} quarters',
  },
  'se-09': {
    category: 'entry_criteria',
    // Base template covers top_n mode. specific_sectors mode uses a text
    // override from emitRule_se09 since the parameter shape differs.
    textTemplate: 'Only enter stocks from the top {topN} momentum sectors on the {timeframe} timeframe',
  },
  'sx-01': {
    category: 'exit_stops',
    textTemplate: 'Sell any position that drops {pct}% from entry',
  },
  'sx-02': {
    category: 'exit_stops',
    textTemplate: 'Sell if position drops {pct}% from its highest closing price since entry',
  },
  'sx-03': {
    category: 'exit_stops',
    textTemplate: "Close any position that hasn't gained {pct}% within {days} trading days",
  },
  'sx-04': {
    category: 'exit_stops',
    textTemplate: 'Sell any position that gains {pct}% from entry',
  },
  'sx-05': {
    category: 'exit_stops',
    textTemplate: 'Sell on technical breakdown: {trigger}',
  },
  'sx-06': {
    category: 'exit_stops',
    textTemplate: 'Close positions {days} trading days before earnings',
  },
  'sx-07': {
    category: 'exit_stops',
    textTemplate: 'Trim one position from any holdings pair whose {days}-day correlation exceeds {threshold}',
  },
  'sr-01': {
    category: 'rebalancing',
    textTemplate: 'Trim any position above {maxPct}% back to {targetPct}%',
  },
  'sr-02': {
    category: 'rebalancing',
    textTemplate: 'If cash exceeds {pct}%, prioritize deploying into entry candidates',
  },
  'sr-03': {
    category: 'rebalancing',
    textTemplate: 'If any sector drifts more than {tolerance}% from initial weight, rebalance',
  },
  'sr-04': {
    category: 'rebalancing',
    textTemplate: 'Add {addPct}% to holdings up more than {threshold}%',
  },
  'sr-05': {
    category: 'rebalancing',
    textTemplate: 'Reduce by {reducePct}% any holding underperforming S&P by {threshold}% over {days} days',
  },
  'ss-01': {
    category: 'season_state',
    textTemplate: 'If trailing S&P by {pct}% after Week {week}, shift to higher-beta entries',
  },
  'ss-02': {
    category: 'season_state',
    textTemplate: 'If leading S&P by {pct}%, tighten trailing stops to {tightPct}% and cap beta at {maxBeta}',
  },
  'ss-04': {
    category: 'season_state',
    textTemplate: 'Reduce high-beta exposure by {reducePct}% in the {days} days before Fed/CPI',
  },
};

function renderTemplate(textTemplate, paramValues) {
  if (!textTemplate) return '';
  return textTemplate.replace(/\{(\w+)\}/g, (_, k) =>
    paramValues[k] === undefined ? `{${k}}` : String(paramValues[k])
  );
}

function clamp(n, min, max) {
  if (typeof n !== 'number' || Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function buildSnapshot(templateId, paramValues, textOverride) {
  const meta = TEMPLATE_CATALOG[templateId];
  if (!meta) return null;
  const text = textOverride != null
    ? textOverride
    : renderTemplate(meta.textTemplate, paramValues);
  return {
    id: `dim-${templateId}`,
    text,
    textTemplate: meta.textTemplate,
    params: null,
    paramValues,
    category: meta.category,
    visibility: 'private',
    // Extra metadata consumed by create-entry via the live rule doc's sourceRef
    sourceRef: templateId,
  };
}

// ─── Per-rule emit helpers ──────────────────────────────────
//
// Each helper returns a snapshot or null. The orchestrator `dimensionsToRuleSnapshots`
// composes them and drops nulls. Rules with toggles check the toggle first;
// rules without toggles (sx-01, se-01, etc.) always emit.
//
// Phase 4.5: every field read goes through `readDimensionField`. The
// canonical reader handles legacy fallback (pre-Phase-2 bundles,
// cached data, relocated fields) via FIELD_REGISTRY — no inline
// readField/firstDefined helpers remain.

function nearestAllowed(value, allowed) {
  return allowed.reduce(
    (best, v) => (Math.abs(v - value) < Math.abs(best - value) ? v : best),
    allowed[0]
  );
}

// Risk Posture
function emitRule_sx01(dv) {
  const pct = readDimensionField(dv, 'stopLossPct') ?? 8;
  return buildSnapshot('sx-01', { pct: clamp(pct, 3, 20) });
}

function emitRule_sx02(dv) {
  const pct = readDimensionField(dv, 'trailingStopPct') ?? 10;
  return buildSnapshot('sx-02', { pct: clamp(pct, 3, 25) });
}

// Entry Aggression
function emitRule_se01(dv) {
  const upper = readDimensionField(dv, 'rsiCeiling') ?? 65;
  return buildSnapshot('se-01', { upper: clamp(upper, 50, 80) });
}

function emitRule_se02(dv) {
  if (!readDimensionField(dv, 'volumeConfirmEnabled')) return null;
  const raw = readDimensionField(dv, 'volumeMultiplier');
  // Snap to the nearest allowed enum value (1.2, 1.5, 2.0, 3.0) so users who
  // drift off-grid via the compile prompt still land on a valid choice.
  const allowed = [1.2, 1.5, 2.0, 3.0];
  const m = typeof raw === 'number' ? nearestAllowed(raw, allowed) : 1.5;
  return buildSnapshot('se-02', { multiplier: m });
}

function emitRule_se03(dv) {
  if (!readDimensionField(dv, 'trendAlignmentEnabled')) return null;
  const rawPeriod = readDimensionField(dv, 'trendAlignmentSmaPeriod') ?? 50;
  const allowed = [20, 50, 100, 200];
  const period = allowed.includes(rawPeriod) ? rawPeriod : 50;
  return buildSnapshot('se-03', { period });
}

function emitRule_se05(dv) {
  // fundamentalFloor 0 = omit (below schema min of 20)
  const floor = readDimensionField(dv, 'fundamentalFloor');
  if (typeof floor !== 'number' || floor < 20) return null;
  return buildSnapshot('se-05', { minScore: clamp(floor, 20, 80) });
}

function emitRule_se06(dv) {
  const pct = readDimensionField(dv, 'momentumThresholdPct') ?? 2;
  const rawPeriod = readDimensionField(dv, 'momentumLookbackDays') ?? 10;
  const allowed = [5, 10, 20];
  const period = allowed.includes(rawPeriod) ? rawPeriod : 10;
  return buildSnapshot('se-06', {
    period,
    pct: clamp(pct, 0.5, 10),
  });
}

function emitRule_se07(dv) {
  const maxPct = readDimensionField(dv, 'maxSectorWeightPct') ?? 30;
  return buildSnapshot('se-07', { maxPct: clamp(maxPct, 15, 50) });
}

function emitRule_se08(dv) {
  if (!readDimensionField(dv, 'institutionalEnabled')) return null;
  const rawDir = readDimensionField(dv, 'institutionalDirection') ?? 'increased';
  const allowedDirs = ['any', 'increased', 'stable_or_increased'];
  const direction = allowedDirs.includes(rawDir) ? rawDir : 'increased';
  const rawQ = readDimensionField(dv, 'institutionalQuarters') ?? 2;
  const allowedQ = [1, 2, 4];
  const quarters = allowedQ.includes(rawQ) ? rawQ : 2;

  // Custom text for the 'any' pass-through case — the generic template
  // reads awkwardly ("Require institutional ownership to be any...").
  const textOverride = direction === 'any'
    ? 'Allow entries regardless of institutional ownership trend'
    : null;

  return buildSnapshot('se-08', { direction, quarters }, textOverride);
}

// Exit Discipline
function emitRule_sx03(dv) {
  const days = readDimensionField(dv, 'timeExitDays') ?? 5;
  const rawMin = readDimensionField(dv, 'timeExitMinGainPct');
  const allowedMin = [0, 1, 3, 5];
  const minGain = typeof rawMin === 'number' && allowedMin.includes(rawMin) ? rawMin : 1;
  // Evaluator still expects `params.pct`; only the schema-side name changed.
  return buildSnapshot('sx-03', {
    days: clamp(days, 2, 15),
    pct: minGain,
  });
}

function emitRule_sx04(dv) {
  const pct = readDimensionField(dv, 'profitTargetPct') ?? 15;
  return buildSnapshot('sx-04', { pct: clamp(pct, 5, 50) });
}

function emitRule_sx05(dv) {
  if (!readDimensionField(dv, 'technicalExitEnabled')) return null;

  const rawTrigger = readDimensionField(dv, 'technicalExitTrigger') ?? 'rsi_overbought';
  const allowedTriggers = [
    'rsi_overbought', 'macd_bearish', 'either_rsi_or_macd', 'below_sma',
  ];
  const trigger = allowedTriggers.includes(rawTrigger) ? rawTrigger : 'rsi_overbought';

  const params = { trigger };

  // Conditional sub-params based on the selected trigger. macd_bearish uses
  // no sub-params (precomputed MACD line/signal fields drive it directly).
  if (trigger === 'rsi_overbought' || trigger === 'either_rsi_or_macd') {
    const rawR = readDimensionField(dv, 'technicalExitRsiThreshold') ?? 75;
    params.rsiThreshold = clamp(rawR, 65, 85);
  }
  if (trigger === 'below_sma') {
    const rawP = readDimensionField(dv, 'technicalExitSmaPeriod') ?? 50;
    const allowedP = [20, 50, 100, 200];
    params.smaPeriod = allowedP.includes(rawP) ? rawP : 50;
  }

  return buildSnapshot('sx-05', params);
}

function emitRule_sx06(dv) {
  if (!readDimensionField(dv, 'earningsExitEnabled')) return null;
  const rawDays = readDimensionField(dv, 'earningsExitDays') ?? 2;
  const allowed = [1, 2, 3, 5];
  const days = allowed.includes(rawDays) ? rawDays : 2;
  const onlyIfProfitable = readDimensionField(dv, 'earningsExitOnlyIfProfitable') !== false;

  // Template wording shifts with the profitable-only gate.
  const textOverride = onlyIfProfitable
    ? `Close profitable positions ${days} trading days before earnings`
    : `Close positions ${days} trading days before earnings`;

  return buildSnapshot('sx-06', { days, onlyIfProfitable }, textOverride);
}

function emitRule_sx07(dv) {
  if (!readDimensionField(dv, 'correlationExitEnabled')) return null;
  const rawT = readDimensionField(dv, 'correlationThreshold') ?? 0.8;
  const allowedT = [0.7, 0.8, 0.9];
  const threshold = nearestAllowed(rawT, allowedT);
  const rawD = readDimensionField(dv, 'correlationLookbackDays') ?? 30;
  const allowedD = [20, 30, 60, 90];
  const days = allowedD.includes(rawD) ? rawD : 30;
  return buildSnapshot('sx-07', { threshold, days });
}

// Sector Strategy
function emitRule_sr03(dv) {
  if (!readDimensionField(dv, 'rebalanceOnDrift')) return null;
  const tol = readDimensionField(dv, 'sectorDriftTolerancePct') ?? 10;
  return buildSnapshot('sr-03', { tolerance: clamp(tol, 5, 20) });
}

// SE-09 Sector Momentum Filter. Two modes (top_n | specific_sectors) with
// mutually-exclusive parameter shapes — text template swaps to match.
// 3M timeframe intentionally omitted from the accepted enum until
// compute-index-intelligence emits quarterChange.
function emitRule_se09(dv) {
  if (!readDimensionField(dv, 'sectorFilterEnabled')) return null;

  const rawMode = readDimensionField(dv, 'sectorFilterMode') ?? 'top_n';
  const mode = rawMode === 'specific_sectors' ? 'specific_sectors' : 'top_n';

  if (mode === 'specific_sectors') {
    const raw = readDimensionField(dv, 'sectorFilterSelected');
    const selected = Array.isArray(raw) ? raw : [];
    const label = selected.length > 0 ? selected.join(', ') : '(none selected)';
    return buildSnapshot(
      'se-09',
      { mode, selectedSectors: selected },
      `Only enter stocks from selected sectors: ${label}`
    );
  }

  // mode === 'top_n'
  const rawTf = readDimensionField(dv, 'sectorFilterTimeframe') ?? '1W';
  const allowedTf = ['1D', '1W', '1M'];
  const timeframe = allowedTf.includes(rawTf) ? rawTf : '1W';
  const rawN = readDimensionField(dv, 'sectorFilterTopN') ?? 3;
  const allowedN = [1, 2, 3, 5];
  const topN = allowedN.includes(rawN) ? rawN : 3;
  return buildSnapshot('se-09', { mode, timeframe, topN });
}

// Event Risk / Macro Awareness
function emitRule_se04(dv) {
  // Relocated: macroAwareness.earningsAvoidance → eventRisk.earningsAvoidanceDays.
  // Registry handles the cross-dimension legacy fallback transparently.
  const days = readDimensionField(dv, 'earningsAvoidanceDays');
  if (typeof days !== 'number' || days < 1) return null;
  return buildSnapshot('se-04', { days: clamp(days, 1, 10) });
}

function emitRule_ss04(dv) {
  if (!readDimensionField(dv, 'fomcDefensive')) return null;
  return buildSnapshot('ss-04', { reducePct: 10, days: 2 });
}

function emitRule_benchmarkGap(dv) {
  const resp = readDimensionField(dv, 'benchmarkGapResponse');
  if (resp === 'aggressive') {
    return buildSnapshot('ss-01', { pct: 3, week: 2 });
  }
  if (resp === 'react') {
    return buildSnapshot('ss-02', { pct: 5, tightPct: 5, maxBeta: 1.2 });
  }
  return null;
}

// Position Sizing
function emitRule_sr01(dv) {
  const rawMax = readDimensionField(dv, 'maxPositionWeightPct') ?? 15;
  const maxPct = clamp(rawMax, 10, 30);
  const trimGap = clamp(readDimensionField(dv, 'trimThreshold') ?? 3, 3, 20);
  const targetPct = clamp(maxPct - trimGap, 8, 25);
  return buildSnapshot('sr-01', { maxPct, targetPct });
}

function emitRule_sr02(dv) {
  const pct = readDimensionField(dv, 'cashDeploymentTriggerPct') ?? 15;
  return buildSnapshot('sr-02', { pct: clamp(pct, 5, 40) });
}

function emitRule_sr04(dv) {
  // Relocated: momentumSensitivity.addToWinners → positionSizing.addToWinnersEnabled.
  // Registry legacy fallback handles the cross-dimension read.
  if (!readDimensionField(dv, 'addToWinnersEnabled')) return null;
  const rawT = readDimensionField(dv, 'winnerReturnTrigger') ?? 10;
  const allowedT = [5, 10, 15, 20];
  const threshold = allowedT.includes(rawT) ? rawT : 10;
  const rawA = readDimensionField(dv, 'winnerAddWeight') ?? 2;
  const allowedA = [1, 2, 3, 5];
  const addPct = allowedA.includes(rawA) ? rawA : 2;
  return buildSnapshot('sr-04', { threshold, addPct });
}

function emitRule_sr05(dv) {
  // Relocated: momentumSensitivity.cutUnderperformers → positionSizing.cutUnderperformersEnabled.
  if (!readDimensionField(dv, 'cutUnderperformersEnabled')) return null;
  const rawT = readDimensionField(dv, 'loserUnderperformanceTrigger') ?? 5;
  const allowedT = [3, 5, 8, 10];
  const threshold = allowedT.includes(rawT) ? rawT : 5;
  const rawD = readDimensionField(dv, 'loserLookbackDays') ?? 5;
  const allowedD = [3, 5, 10, 15];
  const days = allowedD.includes(rawD) ? rawD : 5;
  const rawR = readDimensionField(dv, 'loserReduceWeight') ?? 3;
  const allowedR = [1, 2, 3, 5];
  const reducePct = allowedR.includes(rawR) ? rawR : 3;
  return buildSnapshot('sr-05', { threshold, days, reducePct });
}

/**
 * Translate dimensionValues → array of rule snapshots ready to be written
 * into a bundle's `ruleSnapshots` field AND used to upsert rule docs.
 *
 * Returns an empty array if every dimension toggle is off — caller should
 * treat that as "select at least one rule" and block deploy.
 *
 * Phase 1 rewrite: previously hardcoded params for se-02, se-06, sx-03,
 * sx-05, sr-04, sr-05 now flow through from schema fields. Newly emits
 * se-03, se-08, sx-06, sx-07. se-09 (sector momentum filter) is deferred
 * to Phase 1.5 pending evaluator.
 */
export function dimensionsToRuleSnapshots(values) {
  if (!values) return [];
  const snapshots = [];
  const push = (snap) => { if (snap) snapshots.push(snap); };

  push(emitRule_sx01(values));
  push(emitRule_sx02(values));

  push(emitRule_se01(values));
  push(emitRule_se02(values));
  push(emitRule_se03(values));
  push(emitRule_se04(values));
  push(emitRule_se05(values));
  push(emitRule_se06(values));
  push(emitRule_se07(values));
  push(emitRule_se08(values));

  push(emitRule_sx03(values));
  push(emitRule_sx04(values));
  push(emitRule_sx05(values));
  push(emitRule_sx06(values));
  push(emitRule_sx07(values));

  push(emitRule_sr03(values));
  push(emitRule_se09(values));

  push(emitRule_ss04(values));
  push(emitRule_benchmarkGap(values));

  push(emitRule_sr01(values));
  push(emitRule_sr02(values));
  push(emitRule_sr04(values));
  push(emitRule_sr05(values));

  return snapshots;
}

// Phase-count summary for UI — reuses server's phaseOfRuleId logic.
export function countPhasesForDimensions(values) {
  const counts = { entry: 0, exit: 0, rebalance: 0, strategy: 0 };
  for (const snap of dimensionsToRuleSnapshots(values)) {
    const id = snap.sourceRef;
    if (id.startsWith('se-')) counts.entry++;
    else if (id.startsWith('sx-')) counts.exit++;
    else if (id.startsWith('sr-')) counts.rebalance++;
    else if (id.startsWith('ss-')) counts.strategy++;
  }
  return counts;
}

// ─────────────────────────────────────────────────────────────
// Deterministic IDs + Firestore materialization
// ─────────────────────────────────────────────────────────────
//
// create-entry.js only accepts a bundleId — and since its contract is
// protected, we have to give it one. We materialize an ephemeral bundle
// + rule docs under the caller's agent on Deploy click.
//
// Both the bundle id and the rule ids are deterministic so retries and
// duplicate clicks are idempotent: same dimensions → same bundle id →
// we overwrite with identical data.

// Tiny, stable, non-crypto hash. djb2 variant. Sufficient for bundle
// de-duplication; we don't need cryptographic collision resistance.
function hashString(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
  }
  // Force unsigned and base36 for a short, URL-safe suffix.
  return (h >>> 0).toString(36);
}

function canonicalize(obj) {
  // Stable JSON stringify — keys sorted at every level.
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) {
    return `[${obj.map(canonicalize).join(',')}]`;
  }
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(obj[k])}`).join(',')}}`;
}

export function hashDimensions(values) {
  return hashString(canonicalize(values || {}));
}

export function computeDeterministicBundleId(seasonId, values) {
  const safeSeason = String(seasonId || 'noseason').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `dim-${safeSeason}-${hashDimensions(values)}`;
}

/**
 * Write rule docs + a forged bundle doc to Firestore so the existing
 * create-entry endpoint can consume them via `bundleId`.
 *
 * Idempotent: same dimensions + same season → same bundleId, overwritten
 * with identical data. On retry after a failed deploy, the same bundle
 * is reused.
 *
 * Returns the bundleId to pass to /api/season/create-entry.
 */
export async function materializeDimensionBundle({
  agentId,
  seasonId,
  dimensionValues,
  bundleName,
}) {
  if (!agentId) throw new Error('materializeDimensionBundle: agentId required');
  const snapshots = dimensionsToRuleSnapshots(dimensionValues);
  if (snapshots.length === 0) {
    throw new Error('Configure at least one strategy dimension before deploying.');
  }

  const bundleId = computeDeterministicBundleId(seasonId, dimensionValues);
  const rulesCol = collection(db, 'agents', agentId, 'rules');
  const bundleRef = doc(db, 'agents', agentId, 'bundles', bundleId);

  // Idempotent short-circuit for a bundle that has moved past 'forged'
  // (Mastery end-of-branch ruling B3: bundle status transitions out of
  // 'equipped' are server-owned — the firestore.rules vocabulary denies
  // the overwrite below on an equipped doc). The deterministic id means an
  // existing doc carries IDENTICAL content for these dimensions, and
  // create-entry accepts 'forged' or 'equipped' bundles alike, so reusing
  // the equipped doc as-is is the same launch. An 'archived' copy cannot
  // be relaunched (create-entry rejects it and the rules deny reviving it
  // client-side) — fail loudly instead of surfacing a permission error.
  const existingSnap = await getDoc(bundleRef);
  if (existingSnap.exists()) {
    const existingStatus = existingSnap.data()?.status;
    if (existingStatus === 'equipped') {
      return bundleId;
    }
    if (existingStatus === 'archived') {
      throw new Error(
        'This exact strategy was archived earlier — adjust a dimension to forge a fresh bundle.'
      );
    }
  }

  const batch = writeBatch(db);

  // Upsert one rule doc per template, keyed `dim-{templateId}`. Using
  // setDoc-style merge keeps us idempotent across retries / redeploys.
  for (const snap of snapshots) {
    const ruleRef = doc(rulesCol, snap.id);
    batch.set(
      ruleRef,
      {
        text: snap.text,
        textTemplate: snap.textTemplate,
        paramValues: snap.paramValues,
        params: null,
        category: snap.category,
        sourceRef: snap.sourceRef,
        source: 'forge_discover',
        visibility: 'private',
        status: 'active',
        priority: 0,
        traitId: null,
        isRefined: false,
        isDeleted: false,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  // Build the frozen ruleSnapshots array the server will read. Strip the
  // sourceRef helper field — the server looks that up off the live rule doc.
  const frozenSnapshots = snapshots.map((s) => ({
    id: s.id,
    text: s.text,
    textTemplate: s.textTemplate,
    params: s.params,
    paramValues: s.paramValues,
    category: s.category,
    visibility: s.visibility,
  }));

  batch.set(bundleRef, {
    name: bundleName || 'Strategy Dimensions',
    version: 1,
    previousVersionId: null,
    status: 'forged',
    ruleIds: snapshots.map((s) => s.id),
    ruleSnapshots: frozenSnapshots,
    conflictCheckResult: null,
    entrySource: 'dimensions',
    hiddenFromBundleList: true,
    dimensionHash: hashDimensions(dimensionValues),
    createdAt: serverTimestamp(),
    forgedAt: serverTimestamp(),
    equippedAt: null,
    archivedAt: null,
    updatedAt: serverTimestamp(),
    performanceData: {
      battlesEquipped: 0,
      totalCitations: 0,
      successfulCitations: 0,
    },
  });

  await batch.commit();
  return bundleId;
}

// ─────────────────────────────────────────────────────────────
// Phase 4A: Deploy-to-Agent support
// ─────────────────────────────────────────────────────────────
//
// The Deploy flow reads a completed experiment's dimensionValues at confirm
// time so it can generate directives + guardrails to show in the preview and
// persist on the agent doc. Since dimensionValues are not stored on the
// entry document, we persist them onto the bundle doc at launch time via
// `persistDimensionValuesOnBundle`, and provide a best-effort reverse map
// for any legacy bundles that pre-date this write.
//
// All symbols below are APPEND-ONLY additions — no existing code modified.

/**
 * Merge-write dimensionValues onto an existing bundle doc so the Deploy
 * flow (which runs weeks later) can recover the original knob settings.
 *
 * Fire-and-forget from the caller. Safe to call more than once per bundle
 * (idempotent under merge). Uses writeBatch so we stay inside the module's
 * existing imports (append-only constraint).
 */
export async function persistDimensionValuesOnBundle(
  agentId,
  bundleId,
  dimensionValues
) {
  if (!agentId || !bundleId || !dimensionValues) return;
  const bundleRef = doc(db, 'agents', agentId, 'bundles', bundleId);
  const batch = writeBatch(db);
  batch.set(
    bundleRef,
    {
      dimensionValues,
      dimensionSchemaVersion: 1,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  await batch.commit();
}

/**
 * Merge-write Workshop compile transparency outputs onto an existing bundle
 * doc. Sibling to `persistDimensionValuesOnBundle` — same fire-and-forget
 * contract, same merge-write pattern, same idempotency guarantees.
 *
 * Persists:
 *   compileConfidence       — top-level scalar for query-friendly auditing
 *                             of confidence-vs-outcome correlations
 *   compileTransparency     — sub-object holding warnings / mappingNotes /
 *                             appliedClamps verbatim from the compile endpoint
 *
 * No-ops when the launch did not originate from Workshop (all inputs empty
 * / null), so manual-configure launches never write these fields.
 */
export async function persistCompileTransparencyOnBundle(
  agentId,
  bundleId,
  { confidence = null, warnings = [], mappingNotes = [], appliedClamps = [] } = {}
) {
  if (!agentId || !bundleId) return;
  const hasConfidence = typeof confidence === 'number';
  const hasArrays =
    (Array.isArray(warnings) && warnings.length > 0) ||
    (Array.isArray(mappingNotes) && mappingNotes.length > 0) ||
    (Array.isArray(appliedClamps) && appliedClamps.length > 0);
  if (!hasConfidence && !hasArrays) return;

  const bundleRef = doc(db, 'agents', agentId, 'bundles', bundleId);
  const batch = writeBatch(db);
  batch.set(
    bundleRef,
    {
      compileConfidence: hasConfidence ? confidence : null,
      compileTransparency: {
        warnings: Array.isArray(warnings) ? warnings : [],
        mappingNotes: Array.isArray(mappingNotes) ? mappingNotes : [],
        appliedClamps: Array.isArray(appliedClamps) ? appliedClamps : [],
      },
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  await batch.commit();
}

/**
 * Translate dimensionValues into BaggerBomb-appropriate natural-language
 * directives the Haiku prompt can reason about during intraday battles.
 *
 * Disabled toggles (`volumeConfirm: false`, `rebalanceOnDrift: false`, etc.)
 * omit their directive. Returns an array of `{ id, text, category }`.
 *
 * NOTE: These are intentionally distinct from the Season-mode rule text —
 * they are tuned for 1-day intraday context, not 4-week EOD simulation.
 */
export function dimensionsToDirectives(dv) {
  if (!dv) return [];
  const out = [];
  const push = (id, category, text) => out.push({ id, category, text });

  // Phase 4.5: every field read goes through the canonical reader so
  // new-schema writes from the Phase 4 UI are honored here. Pre-Phase-4.5
  // this function read legacy-only keys, silently returning defaults
  // when the UI wrote canonical names (mid-sprint audit M2).

  // Risk Posture
  const stopLoss = readDimensionField(dv, 'stopLossPct');
  if (typeof stopLoss === 'number') {
    push('dir-stop-loss', 'risk',
      `Stop-loss at ${stopLoss}% — exit any position that drops below entry price by this amount.`);
  }
  const trailingStop = readDimensionField(dv, 'trailingStopPct');
  if (typeof trailingStop === 'number') {
    push('dir-trailing-stop', 'risk',
      `Trailing stop at ${trailingStop}% — protect gains by exiting when a position pulls back this much from its high.`);
  }

  // Entry Aggression
  const rsiCeiling = readDimensionField(dv, 'rsiCeiling');
  if (typeof rsiCeiling === 'number' && rsiCeiling < 75) {
    push('dir-rsi-ceiling', 'entry',
      `Avoid overbought stocks — do not enter positions with RSI above ${rsiCeiling}.`);
  }
  if (readDimensionField(dv, 'volumeConfirmEnabled')) {
    push('dir-volume-confirm', 'entry',
      'Require volume confirmation — only enter stocks trading above their average volume.');
  }
  const fundamentalFloor = readDimensionField(dv, 'fundamentalFloor');
  if (typeof fundamentalFloor === 'number' && fundamentalFloor >= 30) {
    push('dir-fundamental-floor', 'entry',
      `Fundamental quality filter — prefer stocks with composite scores above ${fundamentalFloor}.`);
  }

  // Exit Discipline
  const profitTarget = readDimensionField(dv, 'profitTargetPct');
  if (typeof profitTarget === 'number') {
    push('dir-profit-target', 'exit',
      `Profit target at ${profitTarget}% — lock in gains when a position reaches this return.`);
  }
  const timeExit = readDimensionField(dv, 'timeExitDays');
  if (typeof timeExit === 'number' && timeExit > 0) {
    push('dir-time-exit', 'exit',
      `Time-based exit — close positions that haven't gained meaningfully within ${timeExit} trading days.`);
  }
  if (readDimensionField(dv, 'technicalExitEnabled')) {
    push('dir-technical-exit', 'exit',
      'Technical exit enabled — cut positions on RSI overbought breakdowns.');
  }

  // Sector Strategy
  const maxSectorWeight = readDimensionField(dv, 'maxSectorWeightPct');
  if (typeof maxSectorWeight === 'number') {
    push('dir-sector-cap', 'allocation',
      `Sector diversification — no single sector above ${maxSectorWeight}% of the portfolio.`);
  }
  const sectorDriftTolerance = readDimensionField(dv, 'sectorDriftTolerancePct');
  if (readDimensionField(dv, 'rebalanceOnDrift') && typeof sectorDriftTolerance === 'number') {
    push('dir-sector-drift', 'allocation',
      `Rebalance if any sector drifts more than ${sectorDriftTolerance}% from its initial weight.`);
  }

  // Momentum
  const momentumThreshold = readDimensionField(dv, 'momentumThresholdPct');
  if (typeof momentumThreshold === 'number') {
    push('dir-momentum', 'momentum',
      `Momentum sensitivity — prefer stocks with a ${momentumThreshold}%+ lookback-period price change.`);
  }
  if (readDimensionField(dv, 'addToWinnersEnabled')) {
    push('dir-add-to-winners', 'momentum',
      'Add to winners — scale into positions that continue working in your favor.');
  }
  if (readDimensionField(dv, 'cutUnderperformersEnabled')) {
    push('dir-cut-losers', 'momentum',
      'Cut underperformers — reduce exposure to positions lagging the benchmark.');
  }

  // Event Risk (renamed from macroAwareness)
  const earningsAvoidance = readDimensionField(dv, 'earningsAvoidanceDays');
  if (typeof earningsAvoidance === 'number' && earningsAvoidance >= 1) {
    push('dir-earnings-avoid', 'macro',
      `Avoid stocks within ${earningsAvoidance} trading days of earnings announcements.`);
  }
  if (readDimensionField(dv, 'fomcDefensive')) {
    push('dir-fomc-defensive', 'macro',
      'Reduce high-beta exposure in the days before Fed / CPI releases.');
  }
  const benchmarkGap = readDimensionField(dv, 'benchmarkGapResponse');
  if (benchmarkGap === 'aggressive') {
    push('dir-benchmark-gap-aggressive', 'macro',
      'React to benchmark gaps — increase position aggression when trailing the S&P.');
  } else if (benchmarkGap === 'react') {
    push('dir-benchmark-gap-protect', 'macro',
      'Lead protection — tighten stops and cap beta when leading the S&P.');
  }

  // Position Sizing
  const maxPosition = readDimensionField(dv, 'maxPositionWeightPct');
  if (typeof maxPosition === 'number') {
    push('dir-max-position', 'allocation',
      `Position cap — no single holding above ${maxPosition}% of the portfolio.`);
  }
  const cashDeployment = readDimensionField(dv, 'cashDeploymentTriggerPct');
  if (typeof cashDeployment === 'number') {
    push('dir-cash-deploy', 'allocation',
      `Cash deployment — prioritize entries when cash exceeds ${cashDeployment}%.`);
  }

  return out;
}

/**
 * Structured quantitative thresholds to be written onto the agent doc at
 * Deploy time. Phase 4B will read these in `agentEvalPromptAssembly.js`
 * and enforce `enforcement: 'hard'` items deterministically.
 *
 * Phase 4A only persists them — nothing in the battle path reads them yet.
 */
export function dimensionsToGuardrails(dv) {
  if (!dv) return [];
  // Phase 4.5: canonical reader honors Phase 4 UI writes (M2 fix).
  // Pre-Phase-4.5 this function read legacy-only keys and silently
  // deployed stale default guardrails to the agent. Guardrail `type`
  // strings (stopLoss, trailingStop, etc.) are the downstream-consumer
  // contract with agentGuardrails.js and are NOT canonical field names
  // — they're guardrail-record identifiers, unchanged.
  const out = [];
  const stopLoss = readDimensionField(dv, 'stopLossPct');
  if (typeof stopLoss === 'number') {
    out.push({ type: 'stopLoss', value: stopLoss, unit: '%', enforcement: 'hard' });
  }
  const trailingStop = readDimensionField(dv, 'trailingStopPct');
  if (typeof trailingStop === 'number') {
    out.push({ type: 'trailingStop', value: trailingStop, unit: '%', enforcement: 'hard' });
  }
  const maxSectorWeight = readDimensionField(dv, 'maxSectorWeightPct');
  if (typeof maxSectorWeight === 'number') {
    out.push({ type: 'maxSectorWeight', value: maxSectorWeight, unit: '%', enforcement: 'hard' });
  }
  const maxPosition = readDimensionField(dv, 'maxPositionWeightPct');
  if (typeof maxPosition === 'number') {
    out.push({ type: 'maxPosition', value: maxPosition, unit: '%', enforcement: 'hard' });
  }
  const profitTarget = readDimensionField(dv, 'profitTargetPct');
  if (typeof profitTarget === 'number') {
    out.push({ type: 'profitTarget', value: profitTarget, unit: '%', enforcement: 'soft' });
  }
  return out;
}

/**
 * Best-effort reverse map from a bundle's ruleSnapshots array back to a
 * partial dimensionValues object. Used as a last-resort fallback in the
 * Deploy flow when the bundle doc pre-dates `persistDimensionValuesOnBundle`
 * and no localStorage copy exists.
 *
 * Inferred values are less reliable than canonical ones — caller may flag
 * them in the UI. Booleans default to false for off-by-absence semantics,
 * numeric values fall back to DIMENSION_DEFAULTS where snapshots are absent.
 */
export function deriveDimensionsFromSnapshots(snapshots) {
  let dv = cloneDefaults();
  if (!Array.isArray(snapshots)) return dv;

  // Phase 4.5: canonical-only writes via `writeDimensionField`. Legacy
  // readers (dimensionsToDirectives, posture functions, radar score)
  // were migrated to go through `readDimensionField`, so the registry's
  // canonical-wins-else-legacy-fallback contract keeps both schemas
  // consistent without duplicated writes. Booleans are pre-flipped to
  // false so absent-snapshot = disabled; other fields inherit defaults.
  const toggleFalse = [
    'volumeConfirmEnabled',
    'trendAlignmentEnabled',
    'institutionalEnabled',
    'technicalExitEnabled',
    'earningsExitEnabled',
    'rebalanceOnDrift',
    'sectorFilterEnabled',
    'addToWinnersEnabled',
    'cutUnderperformersEnabled',
    'correlationExitEnabled',
    'fomcDefensive',
  ];
  for (const t of toggleFalse) dv = writeDimensionField(dv, t, false);
  dv = writeDimensionField(dv, 'benchmarkGapResponse', 'off');
  dv = writeDimensionField(dv, 'earningsAvoidanceDays', 0);

  for (const snap of snapshots) {
    const templateId = snap?.sourceRef || snap?.id?.replace(/^dim-/, '') || '';
    const pv = snap?.paramValues || {};
    switch (templateId) {
      case 'sx-01':
        if (typeof pv.pct === 'number') dv = writeDimensionField(dv, 'stopLossPct', pv.pct);
        break;
      case 'sx-02':
        if (typeof pv.pct === 'number') dv = writeDimensionField(dv, 'trailingStopPct', pv.pct);
        break;
      case 'se-01':
        if (typeof pv.upper === 'number') dv = writeDimensionField(dv, 'rsiCeiling', pv.upper);
        break;
      case 'se-02':
        dv = writeDimensionField(dv, 'volumeConfirmEnabled', true);
        if (typeof pv.multiplier === 'number') {
          dv = writeDimensionField(dv, 'volumeMultiplier', pv.multiplier);
        }
        break;
      case 'se-03':
        dv = writeDimensionField(dv, 'trendAlignmentEnabled', true);
        if (typeof pv.period === 'number') {
          dv = writeDimensionField(dv, 'trendAlignmentSmaPeriod', pv.period);
        }
        break;
      case 'se-05':
        if (typeof pv.minScore === 'number') {
          dv = writeDimensionField(dv, 'fundamentalFloor', pv.minScore);
        }
        break;
      case 'se-06':
        if (typeof pv.pct === 'number') dv = writeDimensionField(dv, 'momentumThresholdPct', pv.pct);
        if (typeof pv.period === 'number') {
          dv = writeDimensionField(dv, 'momentumLookbackDays', pv.period);
        }
        break;
      case 'se-08':
        dv = writeDimensionField(dv, 'institutionalEnabled', true);
        if (typeof pv.direction === 'string') {
          dv = writeDimensionField(dv, 'institutionalDirection', pv.direction);
        }
        if (typeof pv.quarters === 'number') {
          dv = writeDimensionField(dv, 'institutionalQuarters', pv.quarters);
        }
        break;
      case 'sx-04':
        if (typeof pv.pct === 'number') dv = writeDimensionField(dv, 'profitTargetPct', pv.pct);
        break;
      case 'sx-03':
        if (typeof pv.days === 'number') dv = writeDimensionField(dv, 'timeExitDays', pv.days);
        if (typeof pv.pct === 'number') dv = writeDimensionField(dv, 'timeExitMinGainPct', pv.pct);
        break;
      case 'sx-05':
        dv = writeDimensionField(dv, 'technicalExitEnabled', true);
        if (typeof pv.trigger === 'string') {
          dv = writeDimensionField(dv, 'technicalExitTrigger', pv.trigger);
        }
        if (typeof pv.rsiThreshold === 'number') {
          dv = writeDimensionField(dv, 'technicalExitRsiThreshold', pv.rsiThreshold);
        }
        if (typeof pv.smaPeriod === 'number') {
          dv = writeDimensionField(dv, 'technicalExitSmaPeriod', pv.smaPeriod);
        }
        break;
      case 'sx-06':
        dv = writeDimensionField(dv, 'earningsExitEnabled', true);
        if (typeof pv.days === 'number') {
          dv = writeDimensionField(dv, 'earningsExitDays', pv.days);
        }
        if (typeof pv.onlyIfProfitable === 'boolean') {
          dv = writeDimensionField(dv, 'earningsExitOnlyIfProfitable', pv.onlyIfProfitable);
        }
        break;
      case 'sx-07':
        dv = writeDimensionField(dv, 'correlationExitEnabled', true);
        if (typeof pv.threshold === 'number') {
          dv = writeDimensionField(dv, 'correlationThreshold', pv.threshold);
        }
        if (typeof pv.days === 'number') {
          dv = writeDimensionField(dv, 'correlationLookbackDays', pv.days);
        }
        break;
      case 'se-07':
        if (typeof pv.maxPct === 'number') {
          dv = writeDimensionField(dv, 'maxSectorWeightPct', pv.maxPct);
        }
        break;
      case 'sr-03':
        dv = writeDimensionField(dv, 'rebalanceOnDrift', true);
        if (typeof pv.tolerance === 'number') {
          dv = writeDimensionField(dv, 'sectorDriftTolerancePct', pv.tolerance);
        }
        break;
      case 'se-09':
        dv = writeDimensionField(dv, 'sectorFilterEnabled', true);
        if (typeof pv.mode === 'string') {
          dv = writeDimensionField(dv, 'sectorFilterMode', pv.mode);
        }
        if (typeof pv.timeframe === 'string') {
          dv = writeDimensionField(dv, 'sectorFilterTimeframe', pv.timeframe);
        }
        if (typeof pv.topN === 'number') {
          dv = writeDimensionField(dv, 'sectorFilterTopN', pv.topN);
        }
        if (Array.isArray(pv.selectedSectors)) {
          dv = writeDimensionField(dv, 'sectorFilterSelected', pv.selectedSectors);
        }
        break;
      case 'sr-04':
        dv = writeDimensionField(dv, 'addToWinnersEnabled', true);
        if (typeof pv.threshold === 'number') {
          dv = writeDimensionField(dv, 'winnerReturnTrigger', pv.threshold);
        }
        if (typeof pv.addPct === 'number') {
          dv = writeDimensionField(dv, 'winnerAddWeight', pv.addPct);
        }
        break;
      case 'sr-05':
        dv = writeDimensionField(dv, 'cutUnderperformersEnabled', true);
        if (typeof pv.threshold === 'number') {
          dv = writeDimensionField(dv, 'loserUnderperformanceTrigger', pv.threshold);
        }
        if (typeof pv.days === 'number') {
          dv = writeDimensionField(dv, 'loserLookbackDays', pv.days);
        }
        if (typeof pv.reducePct === 'number') {
          dv = writeDimensionField(dv, 'loserReduceWeight', pv.reducePct);
        }
        break;
      case 'se-04':
        if (typeof pv.days === 'number') {
          dv = writeDimensionField(dv, 'earningsAvoidanceDays', pv.days);
        }
        break;
      case 'ss-04':
        dv = writeDimensionField(dv, 'fomcDefensive', true);
        break;
      case 'ss-01':
        dv = writeDimensionField(dv, 'benchmarkGapResponse', 'aggressive');
        break;
      case 'ss-02':
        dv = writeDimensionField(dv, 'benchmarkGapResponse', 'react');
        break;
      case 'sr-01':
        if (typeof pv.maxPct === 'number') {
          dv = writeDimensionField(dv, 'maxPositionWeightPct', pv.maxPct);
          if (typeof pv.targetPct === 'number') {
            dv = writeDimensionField(dv, 'trimThreshold', Math.max(3, pv.maxPct - pv.targetPct));
          }
        }
        break;
      case 'sr-02':
        if (typeof pv.pct === 'number') {
          dv = writeDimensionField(dv, 'cashDeploymentTriggerPct', pv.pct);
        }
        break;
      default:
        break;
    }
  }

  return dv;
}
