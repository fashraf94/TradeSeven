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

export const DIMENSION_DEFAULTS = Object.freeze({
  riskPosture: {
    stopLoss: 8,         // sx-01.pct
    trailingStop: 10,    // sx-02.pct (% trail distance, NOT ATR)
  },
  entryAggression: {
    rsiUpper: 65,        // se-01.upper
    volumeConfirm: true, // se-02 on/off; multiplier fixed at 1.2 when on
    fundamentalFloor: 45, // se-05.minScore
  },
  exitDiscipline: {
    profitTarget: 15,    // sx-04.pct
    timeExit: 5,         // sx-03.days (pct fixed at 1)
    technicalExit: false, // sx-05 on/off; defaults rsi_overbought @ 75
  },
  sectorStrategy: {
    maxSectorWeight: 30,       // se-07.maxPct
    sectorDriftTolerance: 10,  // sr-03.tolerance
    rebalanceOnDrift: true,    // sr-03 on/off
  },
  momentumSensitivity: {
    momentumThreshold: 2,      // se-06.pct (lookback period fixed at 10)
    addToWinners: true,        // sr-04 on/off
    cutUnderperformers: true,  // sr-05 on/off
  },
  macroAwareness: {
    earningsAvoidance: 3,      // se-04.days (0 = omit rule)
    fomcDefensive: false,      // ss-04 on/off
    benchmarkGapResponse: 'react', // 'off' | 'react' | 'aggressive'
  },
  positionSizing: {
    maxPosition: 15,           // sr-01.maxPct
    cashDeploymentTrigger: 15, // sr-02.pct
    trimThreshold: 3,          // sr-01 gap: targetPct = maxPct - trimThreshold
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

function buildSnapshot(templateId, paramValues) {
  const meta = TEMPLATE_CATALOG[templateId];
  if (!meta) return null;
  const text = renderTemplate(meta.textTemplate, paramValues);
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

/**
 * Translate dimensionValues → array of rule snapshots ready to be written
 * into a bundle's `ruleSnapshots` field AND used to upsert rule docs.
 *
 * Returns an empty array if every dimension toggle is off — caller should
 * treat that as "select at least one rule" and block deploy.
 */
export function dimensionsToRuleSnapshots(values) {
  if (!values) return [];
  const out = [];

  // ── Risk Posture ────────────────────────────────────────
  const rp = values.riskPosture || {};
  out.push(buildSnapshot('sx-01', { pct: clamp(rp.stopLoss, 3, 20) }));
  out.push(buildSnapshot('sx-02', { pct: clamp(rp.trailingStop, 3, 25) }));

  // ── Entry Aggression ────────────────────────────────────
  const ea = values.entryAggression || {};
  out.push(buildSnapshot('se-01', { upper: clamp(ea.rsiUpper, 50, 80) }));
  if (ea.volumeConfirm) {
    out.push(buildSnapshot('se-02', { multiplier: 1.2 }));
  }
  // fundamentalFloor 0 = omit (below schema min of 20)
  if (typeof ea.fundamentalFloor === 'number' && ea.fundamentalFloor >= 20) {
    out.push(buildSnapshot('se-05', { minScore: clamp(ea.fundamentalFloor, 20, 80) }));
  }

  // ── Exit Discipline ─────────────────────────────────────
  const ed = values.exitDiscipline || {};
  out.push(buildSnapshot('sx-04', { pct: clamp(ed.profitTarget, 5, 50) }));
  out.push(buildSnapshot('sx-03', {
    days: clamp(ed.timeExit, 2, 15),
    pct: 1,
  }));
  if (ed.technicalExit) {
    out.push(buildSnapshot('sx-05', {
      trigger: 'rsi_overbought',
      rsiThreshold: 75,
      smaPeriod: 20,
    }));
  }

  // ── Sector Strategy ─────────────────────────────────────
  const ss = values.sectorStrategy || {};
  out.push(buildSnapshot('se-07', { maxPct: clamp(ss.maxSectorWeight, 15, 50) }));
  if (ss.rebalanceOnDrift) {
    out.push(buildSnapshot('sr-03', { tolerance: clamp(ss.sectorDriftTolerance, 5, 20) }));
  }

  // ── Momentum Sensitivity ────────────────────────────────
  const ms = values.momentumSensitivity || {};
  out.push(buildSnapshot('se-06', {
    period: 10,
    pct: clamp(ms.momentumThreshold, 0.5, 10),
  }));
  if (ms.addToWinners) {
    out.push(buildSnapshot('sr-04', { threshold: 10, addPct: 2 }));
  }
  if (ms.cutUnderperformers) {
    out.push(buildSnapshot('sr-05', { threshold: 5, days: 5, reducePct: 3 }));
  }

  // ── Macro Awareness ─────────────────────────────────────
  const ma = values.macroAwareness || {};
  if (typeof ma.earningsAvoidance === 'number' && ma.earningsAvoidance >= 1) {
    out.push(buildSnapshot('se-04', { days: clamp(ma.earningsAvoidance, 1, 10) }));
  }
  if (ma.fomcDefensive) {
    out.push(buildSnapshot('ss-04', { reducePct: 10, days: 2 }));
  }
  if (ma.benchmarkGapResponse === 'aggressive') {
    out.push(buildSnapshot('ss-01', { pct: 3, week: 2 }));
  } else if (ma.benchmarkGapResponse === 'react') {
    out.push(buildSnapshot('ss-02', { pct: 5, tightPct: 5, maxBeta: 1.2 }));
  }

  // ── Position Sizing ─────────────────────────────────────
  const ps = values.positionSizing || {};
  const maxPct = clamp(ps.maxPosition, 10, 30);
  const trimGap = clamp(ps.trimThreshold, 3, 20);
  const targetPct = clamp(maxPct - trimGap, 8, 25);
  out.push(buildSnapshot('sr-01', { maxPct, targetPct }));
  out.push(buildSnapshot('sr-02', { pct: clamp(ps.cashDeploymentTrigger, 5, 40) }));

  return out.filter(Boolean);
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

  // Start booleans at false — presence of the corresponding snapshot flips on.
  dv.entryAggression.volumeConfirm = false;
  dv.exitDiscipline.technicalExit = false;
  dv.sectorStrategy.rebalanceOnDrift = false;
  dv.momentumSensitivity.addToWinners = false;
  dv.momentumSensitivity.cutUnderperformers = false;
  dv.macroAwareness.fomcDefensive = false;
  dv.macroAwareness.benchmarkGapResponse = 'off';
  dv.macroAwareness.earningsAvoidance = 0;

  for (const snap of snapshots) {
    const templateId = snap?.sourceRef || snap?.id?.replace(/^dim-/, '') || '';
    const pv = snap?.paramValues || {};
    switch (templateId) {
      case 'sx-01':
        if (typeof pv.pct === 'number') dv.riskPosture.stopLoss = pv.pct;
        break;
      case 'sx-02':
        if (typeof pv.pct === 'number') dv.riskPosture.trailingStop = pv.pct;
        break;
      case 'se-01':
        if (typeof pv.upper === 'number') dv.entryAggression.rsiUpper = pv.upper;
        break;
      case 'se-02':
        dv.entryAggression.volumeConfirm = true;
        break;
      case 'se-05':
        if (typeof pv.minScore === 'number') dv.entryAggression.fundamentalFloor = pv.minScore;
        break;
      case 'sx-04':
        if (typeof pv.pct === 'number') dv.exitDiscipline.profitTarget = pv.pct;
        break;
      case 'sx-03':
        if (typeof pv.days === 'number') dv.exitDiscipline.timeExit = pv.days;
        break;
      case 'sx-05':
        dv.exitDiscipline.technicalExit = true;
        break;
      case 'se-07':
        if (typeof pv.maxPct === 'number') dv.sectorStrategy.maxSectorWeight = pv.maxPct;
        break;
      case 'sr-03':
        dv.sectorStrategy.rebalanceOnDrift = true;
        if (typeof pv.tolerance === 'number') dv.sectorStrategy.sectorDriftTolerance = pv.tolerance;
        break;
      case 'se-06':
        if (typeof pv.pct === 'number') dv.momentumSensitivity.momentumThreshold = pv.pct;
        break;
      case 'sr-04':
        dv.momentumSensitivity.addToWinners = true;
        break;
      case 'sr-05':
        dv.momentumSensitivity.cutUnderperformers = true;
        break;
      case 'se-04':
        if (typeof pv.days === 'number') dv.macroAwareness.earningsAvoidance = pv.days;
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
          if (typeof pv.targetPct === 'number') {
            dv.positionSizing.trimThreshold = Math.max(3, pv.maxPct - pv.targetPct);
          }
        }
        break;
      case 'sr-02':
        if (typeof pv.pct === 'number') dv.positionSizing.cashDeploymentTrigger = pv.pct;
        break;
      default:
        break;
    }
  }

  return dv;
}
