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
  collection,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';

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
    benchmarkGapResponse: 'react',     // 'off' | 'react' | 'aggressive'
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

function posture_riskPosture(v) {
  const tight = v.stopLoss <= 5 && v.trailingStop <= 6;
  const loose = v.stopLoss > 12 || v.trailingStop > 15;
  return bucket(tight, loose, 'Conservative', 'Moderate', 'Aggressive');
}

function posture_entryAggression(v) {
  const strict = v.rsiUpper <= 55 && v.fundamentalFloor >= 60;
  const wide = v.rsiUpper > 70 || v.fundamentalFloor < 35;
  return bucket(strict, wide, 'Strict', 'Moderate', 'Wide open');
}

function posture_exitDiscipline(v) {
  const patient = v.profitTarget >= 20 && v.timeExit >= 10;
  const quick = v.profitTarget < 10 || v.timeExit < 5;
  return bucket(patient, quick, 'Patient', 'Balanced', 'Quick');
}

function posture_sectorStrategy(v) {
  const concentrated = v.maxSectorWeight >= 40;
  const diversified = v.maxSectorWeight < 25;
  return bucket(diversified, concentrated, 'Diversified', 'Balanced', 'Concentrated');
}

function posture_momentumSensitivity(v) {
  const chaser = v.momentumThreshold >= 5 && v.addToWinners;
  const contrarian = v.momentumThreshold < 2 || !v.addToWinners;
  return bucket(contrarian, chaser, 'Contrarian', 'Balanced', 'Momentum chaser');
}

function posture_macroAwareness(v) {
  const reactive = v.earningsAvoidance >= 5 && v.fomcDefensive;
  const ignore = v.earningsAvoidance <= 1 && !v.fomcDefensive;
  return bucket(ignore, reactive, 'Ignore', 'Moderate', 'Reactive');
}

function posture_positionSizing(v) {
  const concentrated = v.maxPosition >= 20;
  const spread = v.maxPosition < 12;
  return bucket(spread, concentrated, 'Spread thin', 'Equal weight', 'Concentrated');
}

const POSTURE_FNS = {
  riskPosture: posture_riskPosture,
  entryAggression: posture_entryAggression,
  exitDiscipline: posture_exitDiscipline,
  sectorStrategy: posture_sectorStrategy,
  momentumSensitivity: posture_momentumSensitivity,
  macroAwareness: posture_macroAwareness,
  positionSizing: posture_positionSizing,
};

export function getPostureLabel(dimensionKey, values) {
  const fn = POSTURE_FNS[dimensionKey];
  if (!fn || !values) return { label: '—', tone: 'neutral' };
  try {
    return fn(values);
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
const COLLECTION_DELTAS = {
  'momentum-rider': {
    riskPosture: { stopLoss: 12, trailingStop: 15 },
    entryAggression: { rsiUpper: 72, volumeConfirm: true, fundamentalFloor: 30 },
    exitDiscipline: { profitTarget: 25, timeExit: 7, technicalExit: false },
    sectorStrategy: { maxSectorWeight: 40, sectorDriftTolerance: 15, rebalanceOnDrift: false },
    momentumSensitivity: { momentumThreshold: 5, addToWinners: true, cutUnderperformers: true },
    macroAwareness: { earningsAvoidance: 2, fomcDefensive: false, benchmarkGapResponse: 'aggressive' },
    positionSizing: { maxPosition: 20, cashDeploymentTrigger: 10, trimThreshold: 5 },
  },
  'swing-trader': {
    riskPosture: { stopLoss: 8, trailingStop: 10 },
    entryAggression: { rsiUpper: 65, volumeConfirm: true, fundamentalFloor: 50 },
    exitDiscipline: { profitTarget: 15, timeExit: 8, technicalExit: true },
    sectorStrategy: { maxSectorWeight: 30, sectorDriftTolerance: 10, rebalanceOnDrift: true },
    momentumSensitivity: { momentumThreshold: 2, addToWinners: false, cutUnderperformers: true },
    macroAwareness: { earningsAvoidance: 3, fomcDefensive: true, benchmarkGapResponse: 'react' },
    positionSizing: { maxPosition: 15, cashDeploymentTrigger: 15, trimThreshold: 3 },
  },
  'day-trader': {
    riskPosture: { stopLoss: 4, trailingStop: 5 },
    entryAggression: { rsiUpper: 60, volumeConfirm: true, fundamentalFloor: 35 },
    exitDiscipline: { profitTarget: 8, timeExit: 3, technicalExit: true },
    sectorStrategy: { maxSectorWeight: 35, sectorDriftTolerance: 15, rebalanceOnDrift: false },
    momentumSensitivity: { momentumThreshold: 4, addToWinners: true, cutUnderperformers: false },
    macroAwareness: { earningsAvoidance: 1, fomcDefensive: false, benchmarkGapResponse: 'off' },
    positionSizing: { maxPosition: 12, cashDeploymentTrigger: 8, trimThreshold: 3 },
  },
  'defensive-fortress': {
    riskPosture: { stopLoss: 5, trailingStop: 6 },
    entryAggression: { rsiUpper: 55, volumeConfirm: true, fundamentalFloor: 65 },
    exitDiscipline: { profitTarget: 20, timeExit: 10, technicalExit: true },
    sectorStrategy: { maxSectorWeight: 20, sectorDriftTolerance: 7, rebalanceOnDrift: true },
    momentumSensitivity: { momentumThreshold: 1, addToWinners: false, cutUnderperformers: true },
    macroAwareness: { earningsAvoidance: 5, fomcDefensive: true, benchmarkGapResponse: 'react' },
    positionSizing: { maxPosition: 10, cashDeploymentTrigger: 25, trimThreshold: 3 },
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

// Read a field preferring the new semantic name, falling back to the legacy
// name when old bundles (or old preset deltas) still carry it. Returns
// undefined when neither is set so the caller can apply its own default.
function readField(obj, newName, oldName) {
  if (!obj || typeof obj !== 'object') return undefined;
  if (obj[newName] !== undefined) return obj[newName];
  if (oldName && obj[oldName] !== undefined) return obj[oldName];
  return undefined;
}

// Pick the first defined value across a list of candidates. Convenient for
// cross-dimension fallbacks where a toggle/field may live in either the new
// or the legacy dimension location.
function firstDefined(...candidates) {
  for (const c of candidates) {
    if (c !== undefined) return c;
  }
  return undefined;
}

// ─── Per-rule emit helpers ──────────────────────────────────
//
// Each helper returns a snapshot or null. The orchestrator `dimensionsToRuleSnapshots`
// composes them and drops nulls. Rules with toggles check the toggle first;
// rules without toggles (sx-01, se-01, etc.) always emit.
//
// Schema-field reads use `readField` to prefer the new semantic name while
// falling back to the legacy name for old bundles. Cross-dimension moves
// (sr-04, sr-05 from momentumSensitivity → positionSizing; se-04 from
// macroAwareness → eventRisk) use `firstDefined` across both locations.

// Risk Posture
function emitRule_sx01(dv) {
  const rp = dv.riskPosture || {};
  const pct = readField(rp, 'stopLossPct', 'stopLoss') ?? 8;
  return buildSnapshot('sx-01', { pct: clamp(pct, 3, 20) });
}

function emitRule_sx02(dv) {
  const rp = dv.riskPosture || {};
  const pct = readField(rp, 'trailingStopPct', 'trailingStop') ?? 10;
  return buildSnapshot('sx-02', { pct: clamp(pct, 3, 25) });
}

// Entry Aggression
function emitRule_se01(dv) {
  const ea = dv.entryAggression || {};
  const upper = readField(ea, 'rsiCeiling', 'rsiUpper') ?? 65;
  return buildSnapshot('se-01', { upper: clamp(upper, 50, 80) });
}

function emitRule_se02(dv) {
  const ea = dv.entryAggression || {};
  const enabled = readField(ea, 'volumeConfirmEnabled', 'volumeConfirm');
  if (!enabled) return null;
  const raw = readField(ea, 'volumeMultiplier', null);
  // Snap to the nearest allowed enum value (1.2, 1.5, 2.0, 3.0) so users who
  // drift off-grid via the compile prompt still land on a valid choice.
  const allowed = [1.2, 1.5, 2.0, 3.0];
  const m = typeof raw === 'number'
    ? allowed.reduce((best, v) => Math.abs(v - raw) < Math.abs(best - raw) ? v : best, allowed[0])
    : 1.5;
  return buildSnapshot('se-02', { multiplier: m });
}

function emitRule_se03(dv) {
  const ea = dv.entryAggression || {};
  if (!ea.trendAlignmentEnabled) return null;
  const rawPeriod = ea.trendAlignmentSmaPeriod ?? 50;
  const allowed = [20, 50, 100, 200];
  const period = allowed.includes(rawPeriod) ? rawPeriod : 50;
  return buildSnapshot('se-03', { period });
}

function emitRule_se05(dv) {
  const ea = dv.entryAggression || {};
  // fundamentalFloor 0 = omit (below schema min of 20)
  const floor = readField(ea, 'fundamentalFloor', null);
  if (typeof floor !== 'number' || floor < 20) return null;
  return buildSnapshot('se-05', { minScore: clamp(floor, 20, 80) });
}

function emitRule_se06(dv) {
  const ea = dv.entryAggression || {};
  const ms = dv.momentumSensitivity || {};
  const pct = firstDefined(
    readField(ea, 'momentumThresholdPct', null),
    readField(ms, 'momentumThreshold', null)
  ) ?? 2;
  const rawPeriod = readField(ea, 'momentumLookbackDays', null) ?? 10;
  const allowed = [5, 10, 20];
  const period = allowed.includes(rawPeriod) ? rawPeriod : 10;
  return buildSnapshot('se-06', {
    period,
    pct: clamp(pct, 0.5, 10),
  });
}

function emitRule_se07(dv) {
  const ss = dv.sectorStrategy || {};
  const maxPct = readField(ss, 'maxSectorWeightPct', 'maxSectorWeight') ?? 30;
  return buildSnapshot('se-07', { maxPct: clamp(maxPct, 15, 50) });
}

function emitRule_se08(dv) {
  const ea = dv.entryAggression || {};
  if (!ea.institutionalEnabled) return null;
  const rawDir = ea.institutionalDirection ?? 'increased';
  const allowedDirs = ['any', 'increased', 'stable_or_increased'];
  const direction = allowedDirs.includes(rawDir) ? rawDir : 'increased';
  const rawQ = ea.institutionalQuarters ?? 2;
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
  const ed = dv.exitDiscipline || {};
  const days = readField(ed, 'timeExitDays', 'timeExit') ?? 5;
  const rawMin = readField(ed, 'timeExitMinGainPct', null);
  const allowedMin = [0, 1, 3, 5];
  const minGain = typeof rawMin === 'number' && allowedMin.includes(rawMin)
    ? rawMin
    : 1;
  // Evaluator still expects `params.pct`; only the schema-side name changed.
  return buildSnapshot('sx-03', {
    days: clamp(days, 2, 15),
    pct: minGain,
  });
}

function emitRule_sx04(dv) {
  const ed = dv.exitDiscipline || {};
  const pct = readField(ed, 'profitTargetPct', 'profitTarget') ?? 15;
  return buildSnapshot('sx-04', { pct: clamp(pct, 5, 50) });
}

function emitRule_sx05(dv) {
  const ed = dv.exitDiscipline || {};
  const enabled = readField(ed, 'technicalExitEnabled', 'technicalExit');
  if (!enabled) return null;

  const rawTrigger = ed.technicalExitTrigger ?? 'rsi_overbought';
  const allowedTriggers = [
    'rsi_overbought', 'macd_bearish', 'either_rsi_or_macd', 'below_sma',
  ];
  const trigger = allowedTriggers.includes(rawTrigger)
    ? rawTrigger
    : 'rsi_overbought';

  const params = { trigger };

  // Conditional sub-params based on the selected trigger. macd_bearish uses
  // no sub-params (precomputed MACD line/signal fields drive it directly).
  if (trigger === 'rsi_overbought' || trigger === 'either_rsi_or_macd') {
    const rawR = ed.technicalExitRsiThreshold ?? 75;
    params.rsiThreshold = clamp(rawR, 65, 85);
  }
  if (trigger === 'below_sma') {
    const rawP = ed.technicalExitSmaPeriod ?? 50;
    const allowedP = [20, 50, 100, 200];
    params.smaPeriod = allowedP.includes(rawP) ? rawP : 50;
  }

  return buildSnapshot('sx-05', params);
}

function emitRule_sx06(dv) {
  const ed = dv.exitDiscipline || {};
  if (!ed.earningsExitEnabled) return null;
  const rawDays = ed.earningsExitDays ?? 2;
  const allowed = [1, 2, 3, 5];
  const days = allowed.includes(rawDays) ? rawDays : 2;
  const onlyIfProfitable = ed.earningsExitOnlyIfProfitable !== false;

  // Template wording shifts with the profitable-only gate.
  const textOverride = onlyIfProfitable
    ? `Close profitable positions ${days} trading days before earnings`
    : `Close positions ${days} trading days before earnings`;

  return buildSnapshot('sx-06', { days, onlyIfProfitable }, textOverride);
}

function emitRule_sx07(dv) {
  const ps = dv.positionSizing || {};
  if (!ps.correlationExitEnabled) return null;
  const rawT = ps.correlationThreshold ?? 0.8;
  const allowedT = [0.7, 0.8, 0.9];
  const threshold = allowedT.reduce(
    (best, v) => Math.abs(v - rawT) < Math.abs(best - rawT) ? v : best,
    allowedT[1]
  );
  const rawD = ps.correlationLookbackDays ?? 30;
  const allowedD = [20, 30, 60, 90];
  const days = allowedD.includes(rawD) ? rawD : 30;
  return buildSnapshot('sx-07', { threshold, days });
}

// Sector Strategy
function emitRule_sr03(dv) {
  const ss = dv.sectorStrategy || {};
  if (!ss.rebalanceOnDrift) return null;
  const tol = readField(ss, 'sectorDriftTolerancePct', 'sectorDriftTolerance') ?? 10;
  return buildSnapshot('sr-03', { tolerance: clamp(tol, 5, 20) });
}

// SE-09 Sector Momentum Filter. Two modes (top_n | specific_sectors) with
// mutually-exclusive parameter shapes — text template swaps to match.
// 3M timeframe intentionally omitted from the accepted enum until
// compute-index-intelligence emits quarterChange.
function emitRule_se09(dv) {
  const ss = dv.sectorStrategy || {};
  if (!ss.sectorFilterEnabled) return null;

  const rawMode = ss.sectorFilterMode ?? 'top_n';
  const mode = rawMode === 'specific_sectors' ? 'specific_sectors' : 'top_n';

  if (mode === 'specific_sectors') {
    const selected = Array.isArray(ss.sectorFilterSelected) ? ss.sectorFilterSelected : [];
    const label = selected.length > 0 ? selected.join(', ') : '(none selected)';
    return buildSnapshot(
      'se-09',
      { mode, selectedSectors: selected },
      `Only enter stocks from selected sectors: ${label}`
    );
  }

  // mode === 'top_n'
  const rawTf = ss.sectorFilterTimeframe ?? '1W';
  const allowedTf = ['1D', '1W', '1M'];
  const timeframe = allowedTf.includes(rawTf) ? rawTf : '1W';
  const rawN = ss.sectorFilterTopN ?? 3;
  const allowedN = [1, 2, 3, 5];
  const topN = allowedN.includes(rawN) ? rawN : 3;
  return buildSnapshot('se-09', { mode, timeframe, topN });
}

// Event Risk / Macro Awareness
function emitRule_se04(dv) {
  // Relocated: macroAwareness.earningsAvoidance → eventRisk.earningsAvoidanceDays
  const days = firstDefined(
    dv.eventRisk?.earningsAvoidanceDays,
    dv.macroAwareness?.earningsAvoidance
  );
  if (typeof days !== 'number' || days < 1) return null;
  return buildSnapshot('se-04', { days: clamp(days, 1, 10) });
}

function emitRule_ss04(dv) {
  const ma = dv.macroAwareness || {};
  if (!ma.fomcDefensive) return null;
  return buildSnapshot('ss-04', { reducePct: 10, days: 2 });
}

function emitRule_benchmarkGap(dv) {
  const ma = dv.macroAwareness || {};
  if (ma.benchmarkGapResponse === 'aggressive') {
    return buildSnapshot('ss-01', { pct: 3, week: 2 });
  }
  if (ma.benchmarkGapResponse === 'react') {
    return buildSnapshot('ss-02', { pct: 5, tightPct: 5, maxBeta: 1.2 });
  }
  return null;
}

// Position Sizing
function emitRule_sr01(dv) {
  const ps = dv.positionSizing || {};
  const rawMax = readField(ps, 'maxPositionWeightPct', 'maxPosition') ?? 15;
  const maxPct = clamp(rawMax, 10, 30);
  const trimGap = clamp(ps.trimThreshold ?? 3, 3, 20);
  const targetPct = clamp(maxPct - trimGap, 8, 25);
  return buildSnapshot('sr-01', { maxPct, targetPct });
}

function emitRule_sr02(dv) {
  const ps = dv.positionSizing || {};
  const pct = readField(ps, 'cashDeploymentTriggerPct', 'cashDeploymentTrigger') ?? 15;
  return buildSnapshot('sr-02', { pct: clamp(pct, 5, 40) });
}

function emitRule_sr04(dv) {
  // Relocated: momentumSensitivity.addToWinners → positionSizing.addToWinnersEnabled
  const enabled = firstDefined(
    dv.positionSizing?.addToWinnersEnabled,
    dv.momentumSensitivity?.addToWinners
  );
  if (!enabled) return null;
  const ps = dv.positionSizing || {};
  const rawT = ps.winnerReturnTrigger ?? 10;
  const allowedT = [5, 10, 15, 20];
  const threshold = allowedT.includes(rawT) ? rawT : 10;
  const rawA = ps.winnerAddWeight ?? 2;
  const allowedA = [1, 2, 3, 5];
  const addPct = allowedA.includes(rawA) ? rawA : 2;
  return buildSnapshot('sr-04', { threshold, addPct });
}

function emitRule_sr05(dv) {
  // Relocated: momentumSensitivity.cutUnderperformers → positionSizing.cutUnderperformersEnabled
  const enabled = firstDefined(
    dv.positionSizing?.cutUnderperformersEnabled,
    dv.momentumSensitivity?.cutUnderperformers
  );
  if (!enabled) return null;
  const ps = dv.positionSizing || {};
  const rawT = ps.loserUnderperformanceTrigger ?? 5;
  const allowedT = [3, 5, 8, 10];
  const threshold = allowedT.includes(rawT) ? rawT : 5;
  const rawD = ps.loserLookbackDays ?? 5;
  const allowedD = [3, 5, 10, 15];
  const days = allowedD.includes(rawD) ? rawD : 5;
  const rawR = ps.loserReduceWeight ?? 3;
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
  const rp = dv.riskPosture || {};
  const ea = dv.entryAggression || {};
  const ed = dv.exitDiscipline || {};
  const ss = dv.sectorStrategy || {};
  const ms = dv.momentumSensitivity || {};
  const ma = dv.macroAwareness || {};
  const ps = dv.positionSizing || {};

  const push = (id, category, text) => out.push({ id, category, text });

  // Risk Posture
  if (typeof rp.stopLoss === 'number') {
    push(
      'dir-stop-loss',
      'risk',
      `Stop-loss at ${rp.stopLoss}% — exit any position that drops below entry price by this amount.`
    );
  }
  if (typeof rp.trailingStop === 'number') {
    push(
      'dir-trailing-stop',
      'risk',
      `Trailing stop at ${rp.trailingStop}% — protect gains by exiting when a position pulls back this much from its high.`
    );
  }

  // Entry Aggression
  if (typeof ea.rsiUpper === 'number' && ea.rsiUpper < 75) {
    push(
      'dir-rsi-ceiling',
      'entry',
      `Avoid overbought stocks — do not enter positions with RSI above ${ea.rsiUpper}.`
    );
  }
  if (ea.volumeConfirm) {
    push(
      'dir-volume-confirm',
      'entry',
      'Require volume confirmation — only enter stocks trading above their average volume.'
    );
  }
  if (typeof ea.fundamentalFloor === 'number' && ea.fundamentalFloor >= 30) {
    push(
      'dir-fundamental-floor',
      'entry',
      `Fundamental quality filter — prefer stocks with composite scores above ${ea.fundamentalFloor}.`
    );
  }

  // Exit Discipline
  if (typeof ed.profitTarget === 'number') {
    push(
      'dir-profit-target',
      'exit',
      `Profit target at ${ed.profitTarget}% — lock in gains when a position reaches this return.`
    );
  }
  if (typeof ed.timeExit === 'number' && ed.timeExit > 0) {
    push(
      'dir-time-exit',
      'exit',
      `Time-based exit — close positions that haven't gained meaningfully within ${ed.timeExit} trading days.`
    );
  }
  if (ed.technicalExit) {
    push(
      'dir-technical-exit',
      'exit',
      'Technical exit enabled — cut positions on RSI overbought breakdowns.'
    );
  }

  // Sector Strategy
  if (typeof ss.maxSectorWeight === 'number') {
    push(
      'dir-sector-cap',
      'allocation',
      `Sector diversification — no single sector above ${ss.maxSectorWeight}% of the portfolio.`
    );
  }
  if (ss.rebalanceOnDrift && typeof ss.sectorDriftTolerance === 'number') {
    push(
      'dir-sector-drift',
      'allocation',
      `Rebalance if any sector drifts more than ${ss.sectorDriftTolerance}% from its initial weight.`
    );
  }

  // Momentum Sensitivity
  if (typeof ms.momentumThreshold === 'number') {
    push(
      'dir-momentum',
      'momentum',
      `Momentum sensitivity — prefer stocks with a ${ms.momentumThreshold}%+ 10-day price change.`
    );
  }
  if (ms.addToWinners) {
    push(
      'dir-add-to-winners',
      'momentum',
      'Add to winners — scale into positions that continue working in your favor.'
    );
  }
  if (ms.cutUnderperformers) {
    push(
      'dir-cut-losers',
      'momentum',
      'Cut underperformers — reduce exposure to positions lagging the benchmark.'
    );
  }

  // Macro Awareness
  if (typeof ma.earningsAvoidance === 'number' && ma.earningsAvoidance >= 1) {
    push(
      'dir-earnings-avoid',
      'macro',
      `Avoid stocks within ${ma.earningsAvoidance} trading days of earnings announcements.`
    );
  }
  if (ma.fomcDefensive) {
    push(
      'dir-fomc-defensive',
      'macro',
      'Reduce high-beta exposure in the days before Fed / CPI releases.'
    );
  }
  if (ma.benchmarkGapResponse === 'aggressive') {
    push(
      'dir-benchmark-gap-aggressive',
      'macro',
      'React to benchmark gaps — increase position aggression when trailing the S&P.'
    );
  } else if (ma.benchmarkGapResponse === 'react') {
    push(
      'dir-benchmark-gap-protect',
      'macro',
      'Lead protection — tighten stops and cap beta when leading the S&P.'
    );
  }

  // Position Sizing
  if (typeof ps.maxPosition === 'number') {
    push(
      'dir-max-position',
      'allocation',
      `Position cap — no single holding above ${ps.maxPosition}% of the portfolio.`
    );
  }
  if (typeof ps.cashDeploymentTrigger === 'number') {
    push(
      'dir-cash-deploy',
      'allocation',
      `Cash deployment — prioritize entries when cash exceeds ${ps.cashDeploymentTrigger}%.`
    );
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
  const rp = dv.riskPosture || {};
  const ss = dv.sectorStrategy || {};
  const ps = dv.positionSizing || {};
  const ed = dv.exitDiscipline || {};

  const out = [];
  if (typeof rp.stopLoss === 'number') {
    out.push({ type: 'stopLoss', value: rp.stopLoss, unit: '%', enforcement: 'hard' });
  }
  if (typeof rp.trailingStop === 'number') {
    out.push({ type: 'trailingStop', value: rp.trailingStop, unit: '%', enforcement: 'hard' });
  }
  if (typeof ss.maxSectorWeight === 'number') {
    out.push({ type: 'maxSectorWeight', value: ss.maxSectorWeight, unit: '%', enforcement: 'hard' });
  }
  if (typeof ps.maxPosition === 'number') {
    out.push({ type: 'maxPosition', value: ps.maxPosition, unit: '%', enforcement: 'hard' });
  }
  if (typeof ed.profitTarget === 'number') {
    out.push({ type: 'profitTarget', value: ed.profitTarget, unit: '%', enforcement: 'soft' });
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
  const dv = cloneDefaults();
  if (!Array.isArray(snapshots)) return dv;

  // Start booleans at false in BOTH old and new locations — presence of the
  // corresponding snapshot flips on. Legacy keys stay in sync with new keys
  // so consumers on either schema read consistent state.
  dv.entryAggression.volumeConfirm = false;
  dv.entryAggression.volumeConfirmEnabled = false;
  dv.entryAggression.trendAlignmentEnabled = false;
  dv.entryAggression.institutionalEnabled = false;
  dv.exitDiscipline.technicalExit = false;
  dv.exitDiscipline.technicalExitEnabled = false;
  dv.exitDiscipline.earningsExitEnabled = false;
  dv.sectorStrategy.rebalanceOnDrift = false;
  dv.sectorStrategy.sectorFilterEnabled = false;
  dv.momentumSensitivity.addToWinners = false;
  dv.momentumSensitivity.cutUnderperformers = false;
  dv.positionSizing.addToWinnersEnabled = false;
  dv.positionSizing.cutUnderperformersEnabled = false;
  dv.positionSizing.correlationExitEnabled = false;
  dv.macroAwareness.fomcDefensive = false;
  dv.macroAwareness.benchmarkGapResponse = 'off';
  dv.macroAwareness.earningsAvoidance = 0;
  dv.eventRisk.earningsAvoidanceDays = 0;

  for (const snap of snapshots) {
    const templateId = snap?.sourceRef || snap?.id?.replace(/^dim-/, '') || '';
    const pv = snap?.paramValues || {};
    switch (templateId) {
      case 'sx-01':
        if (typeof pv.pct === 'number') {
          dv.riskPosture.stopLoss = pv.pct;
          dv.riskPosture.stopLossPct = pv.pct;
        }
        break;
      case 'sx-02':
        if (typeof pv.pct === 'number') {
          dv.riskPosture.trailingStop = pv.pct;
          dv.riskPosture.trailingStopPct = pv.pct;
        }
        break;
      case 'se-01':
        if (typeof pv.upper === 'number') {
          dv.entryAggression.rsiUpper = pv.upper;
          dv.entryAggression.rsiCeiling = pv.upper;
        }
        break;
      case 'se-02':
        dv.entryAggression.volumeConfirm = true;
        dv.entryAggression.volumeConfirmEnabled = true;
        if (typeof pv.multiplier === 'number') {
          dv.entryAggression.volumeMultiplier = pv.multiplier;
        }
        break;
      case 'se-03':
        dv.entryAggression.trendAlignmentEnabled = true;
        if (typeof pv.period === 'number') {
          dv.entryAggression.trendAlignmentSmaPeriod = pv.period;
        }
        break;
      case 'se-05':
        if (typeof pv.minScore === 'number') {
          dv.entryAggression.fundamentalFloor = pv.minScore;
        }
        break;
      case 'se-06':
        if (typeof pv.pct === 'number') {
          dv.entryAggression.momentumThresholdPct = pv.pct;
          dv.momentumSensitivity.momentumThreshold = pv.pct;
        }
        if (typeof pv.period === 'number') {
          dv.entryAggression.momentumLookbackDays = pv.period;
        }
        break;
      case 'se-08':
        dv.entryAggression.institutionalEnabled = true;
        if (typeof pv.direction === 'string') {
          dv.entryAggression.institutionalDirection = pv.direction;
        }
        if (typeof pv.quarters === 'number') {
          dv.entryAggression.institutionalQuarters = pv.quarters;
        }
        break;
      case 'sx-04':
        if (typeof pv.pct === 'number') {
          dv.exitDiscipline.profitTarget = pv.pct;
          dv.exitDiscipline.profitTargetPct = pv.pct;
        }
        break;
      case 'sx-03':
        if (typeof pv.days === 'number') {
          dv.exitDiscipline.timeExit = pv.days;
          dv.exitDiscipline.timeExitDays = pv.days;
        }
        if (typeof pv.pct === 'number') {
          dv.exitDiscipline.timeExitMinGainPct = pv.pct;
        }
        break;
      case 'sx-05':
        dv.exitDiscipline.technicalExit = true;
        dv.exitDiscipline.technicalExitEnabled = true;
        if (typeof pv.trigger === 'string') {
          dv.exitDiscipline.technicalExitTrigger = pv.trigger;
        }
        if (typeof pv.rsiThreshold === 'number') {
          dv.exitDiscipline.technicalExitRsiThreshold = pv.rsiThreshold;
        }
        if (typeof pv.smaPeriod === 'number') {
          dv.exitDiscipline.technicalExitSmaPeriod = pv.smaPeriod;
        }
        break;
      case 'sx-06':
        dv.exitDiscipline.earningsExitEnabled = true;
        if (typeof pv.days === 'number') {
          dv.exitDiscipline.earningsExitDays = pv.days;
        }
        if (typeof pv.onlyIfProfitable === 'boolean') {
          dv.exitDiscipline.earningsExitOnlyIfProfitable = pv.onlyIfProfitable;
        }
        break;
      case 'sx-07':
        dv.positionSizing.correlationExitEnabled = true;
        if (typeof pv.threshold === 'number') {
          dv.positionSizing.correlationThreshold = pv.threshold;
        }
        if (typeof pv.days === 'number') {
          dv.positionSizing.correlationLookbackDays = pv.days;
        }
        break;
      case 'se-07':
        if (typeof pv.maxPct === 'number') {
          dv.sectorStrategy.maxSectorWeight = pv.maxPct;
          dv.sectorStrategy.maxSectorWeightPct = pv.maxPct;
        }
        break;
      case 'sr-03':
        dv.sectorStrategy.rebalanceOnDrift = true;
        if (typeof pv.tolerance === 'number') {
          dv.sectorStrategy.sectorDriftTolerance = pv.tolerance;
          dv.sectorStrategy.sectorDriftTolerancePct = pv.tolerance;
        }
        break;
      case 'se-09':
        dv.sectorStrategy.sectorFilterEnabled = true;
        if (typeof pv.mode === 'string') {
          dv.sectorStrategy.sectorFilterMode = pv.mode;
        }
        if (typeof pv.timeframe === 'string') {
          dv.sectorStrategy.sectorFilterTimeframe = pv.timeframe;
        }
        if (typeof pv.topN === 'number') {
          dv.sectorStrategy.sectorFilterTopN = pv.topN;
        }
        if (Array.isArray(pv.selectedSectors)) {
          dv.sectorStrategy.sectorFilterSelected = pv.selectedSectors;
        }
        break;
      case 'sr-04':
        dv.momentumSensitivity.addToWinners = true;
        dv.positionSizing.addToWinnersEnabled = true;
        if (typeof pv.threshold === 'number') {
          dv.positionSizing.winnerReturnTrigger = pv.threshold;
        }
        if (typeof pv.addPct === 'number') {
          dv.positionSizing.winnerAddWeight = pv.addPct;
        }
        break;
      case 'sr-05':
        dv.momentumSensitivity.cutUnderperformers = true;
        dv.positionSizing.cutUnderperformersEnabled = true;
        if (typeof pv.threshold === 'number') {
          dv.positionSizing.loserUnderperformanceTrigger = pv.threshold;
        }
        if (typeof pv.days === 'number') {
          dv.positionSizing.loserLookbackDays = pv.days;
        }
        if (typeof pv.reducePct === 'number') {
          dv.positionSizing.loserReduceWeight = pv.reducePct;
        }
        break;
      case 'se-04':
        if (typeof pv.days === 'number') {
          dv.macroAwareness.earningsAvoidance = pv.days;
          dv.eventRisk.earningsAvoidanceDays = pv.days;
        }
        break;
      case 'ss-04':
        dv.macroAwareness.fomcDefensive = true;
        break;
      case 'ss-01':
        dv.macroAwareness.benchmarkGapResponse = 'aggressive';
        break;
      case 'ss-02':
        dv.macroAwareness.benchmarkGapResponse = 'react';
        break;
      case 'sr-01':
        if (typeof pv.maxPct === 'number') {
          dv.positionSizing.maxPosition = pv.maxPct;
          dv.positionSizing.maxPositionWeightPct = pv.maxPct;
          if (typeof pv.targetPct === 'number') {
            dv.positionSizing.trimThreshold = Math.max(3, pv.maxPct - pv.targetPct);
          }
        }
        break;
      case 'sr-02':
        if (typeof pv.pct === 'number') {
          dv.positionSizing.cashDeploymentTrigger = pv.pct;
          dv.positionSizing.cashDeploymentTriggerPct = pv.pct;
        }
        break;
      default:
        break;
    }
  }

  return dv;
}
