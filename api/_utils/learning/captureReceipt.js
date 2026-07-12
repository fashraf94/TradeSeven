// api/_utils/learning/captureReceipt.js
//
// Agent Learning System — L1 Foundation, Phase 4 (+ Phase A.5).
//
// The receipt carries raw predicate inputs plus OUTCOME-BLIND derived annotations
// (Phase A.5: D1 dual-rule class labels, dR null-reason, predicate staleness /
// provenance). NO outcome-derived / estimator field — no MPE, regret, contrast,
// return, effect, or scoring; every derived field reads only predicate inputs,
// level fields, symbol, and timestamps. This module assembles the receipt from
// values already in scope at the swap-execution site and, ONLY when the dark flag
// is on, writes it server-side (Admin SDK). With the flag off it is a strict
// no-op: no receipt built, no Firestore call, zero latency.
//
// Signal Capture Rider §5: catalog events persist via AWAITED in-request writes —
// fire-and-forget `.catch(() => {})` is forbidden. So the write is awaited and its
// failure is LOGGED (never silently swallowed), but never allowed to break the
// (already-completed) trade.

import { makeReceiptSkeleton, makePredicateInputs, makePredicateClassification } from './learningSchemas.js';
import { classifyD1, classifyD1DrAbstain, drNullReason } from './detectorClassifiers.js';
import { validateReceipt } from './learningValidators.js';

const MS_PER_HOUR = 3_600_000;

/**
 * Normalize a timestamp to epoch-ms. Handles a Firestore Timestamp (`.toMillis()`),
 * an ISO string (`Date.parse`), a raw epoch-ms number, or null/undefined/unparseable
 * → null. Keeps buildRawReceipt pure and Firestore-type-agnostic (and test-safe).
 * @returns {number|null}
 */
export function toMillis(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v?.toMillis === 'function') {
    const ms = v.toMillis();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof v === 'string') {
    const ms = Date.parse(v);
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

const LOG_PREFIX = '[L1-capture]';

/**
 * Extract the raw D1/D2/D3 predicate inputs for one symbol from its technical
 * snapshot (a buildTechnicalSnapshot output) plus its regime and source-doc
 * provenance. Pure field reads — no computation.
 * @param {Object} snapshot  buildTechnicalSnapshot(symbol, ...) output (or null)
 * @param {string|null} regime  per-stock regime string (D3 chop input)
 * @param {Object} techDoc  the raw stockTechnicalScores doc for the symbol (for dataMode)
 */
export function extractPredicateInputs(snapshot, regime, techDoc = {}) {
  const s = snapshot || {};
  return makePredicateInputs({
    bbPercentB: s.volatility?.bbPercentB ?? null,
    distanceToResistancePct: s.levels?.distanceToResistancePct ?? null,
    distTo52wkHigh: s.smaStack?.distTo52wkHigh ?? null,
    volumeRatio: s.volume?.ratio ?? null,
    upDayVolRatio: s.momentum?.upDayVolRatio ?? null,
    macdAboveSignal: s.momentum?.macdAboveSignal ?? null,
    macdFreshBullishCross: s.momentum?.macdFreshBullishCross ?? null,
    regime: regime ?? null,
    nearestResistance: s.levels?.nearestResistance ?? null,
    nearestSupport: s.levels?.nearestSupport ?? null,
    distanceToSupportPct: s.levels?.distanceToSupportPct ?? null,
    dataMode: techDoc?.mode ?? null,
    dataUpdatedAt: techDoc?.updatedAt ?? null,
  });
}

// The SCORABLE D1/D2 predicate inputs whose nullness is a genuine data-quality
// signal (the UNSCORABLE inputs). Level context (nearestSupport etc.), regime,
// and provenance are legitimately null often (e.g. blue sky) and are NOT flagged.
const SCORABLE_INPUT_KEYS = Object.freeze([
  'bbPercentB', 'distanceToResistancePct', 'distTo52wkHigh',
  'volumeRatio', 'upDayVolRatio', 'macdAboveSignal',
]);

/** Collect dotted paths of null/missing SCORABLE predicate inputs. */
function collectNullFlags(predicateInputs) {
  const flags = [];
  for (const side of ['symbolIn', 'symbolOut']) {
    const pi = predicateInputs[side] || {};
    for (const k of SCORABLE_INPUT_KEYS) {
      const v = pi[k];
      if (v === null || v === undefined) flags.push(`predicateInputs.${side}.${k}`);
    }
  }
  return flags;
}

/**
 * Build the per-symbol DERIVED, outcome-blind predicate classification: both D1
 * rule labels, the dR null-reason, and staleness/provenance. Reads only the raw
 * predicate inputs + this symbol's techDoc timestamp + the decision instant.
 */
function buildPredicateClassification(symbol, inputs, techDoc, decisionAtMs) {
  const techDocUpdatedAtMs = toMillis(techDoc?.updatedAt);
  const predicateStalenessMs =
    decisionAtMs !== null && techDocUpdatedAtMs !== null ? decisionAtMs - techDocUpdatedAtMs : null;
  return makePredicateClassification({
    d1ClassAsSpecced: classifyD1(inputs).class,
    d1ClassDrAbstain: classifyD1DrAbstain(inputs).class,
    drNullReason: drNullReason({
      distanceToResistancePct: inputs.distanceToResistancePct,
      nearestSupport: inputs.nearestSupport,
    }),
    techDocUpdatedAtMs,
    predicateStalenessMs,
    // Bucket on the PREDICATE-COMPUTE time: the independence unit is "entries
    // sharing an identical predicate," i.e. the same doc compute-hour.
    symbolHourKey: techDocUpdatedAtMs !== null && symbol ? `${symbol}:${Math.floor(techDocUpdatedAtMs / MS_PER_HOUR)}` : null,
    techDocPath: symbol ? `stockTechnicalScores/${symbol}` : null,
  });
}

/**
 * Assemble a RAW receipt from explicit raw inputs. PURE — no Firestore, no
 * derivation, no classification. Returns the receipt object (schema shape).
 */
export function buildRawReceipt(raw = {}) {
  const predicateInputs = {
    symbolIn: extractPredicateInputs(raw.snapshotIn, raw.regimeIn, raw.techDocIn),
    symbolOut: extractPredicateInputs(raw.snapshotOut, raw.regimeOut, raw.techDocOut),
  };

  const decisionAtMs = toMillis(raw.timestamp);
  const predicateClassification = {
    symbolIn: buildPredicateClassification(raw.symbolIn, predicateInputs.symbolIn, raw.techDocIn, decisionAtMs),
    symbolOut: buildPredicateClassification(raw.symbolOut, predicateInputs.symbolOut, raw.techDocOut, decisionAtMs),
  };

  return makeReceiptSkeleton({
    capturedAt: raw.capturedAt ?? null,

    agentId: raw.agentId ?? null,
    battleId: raw.battleId ?? null,
    battleDay: raw.battleDay ?? null,
    timestamp: raw.timestamp ?? null,
    receiptSeq: raw.receiptSeq ?? null,

    symbolIn: raw.symbolIn ?? null,
    symbolOut: raw.symbolOut ?? null,
    source: raw.source ?? null,
    exitReason: raw.exitReason ?? null,
    haikuSwapReason: raw.haikuSwapReason ?? null,

    resolvedTier: raw.resolvedTier ?? null,
    resolvedSlotIndex: raw.resolvedSlotIndex ?? null,

    entryMark: raw.entryMark ?? null,
    entryATR: raw.entryATR ?? null,

    guardrailReplay: {
      outgoingEntryPrice: raw.outgoingEntryPrice ?? null,
      outgoingBaseATR: raw.outgoingBaseATR ?? null,
      // Not stored on agent-battle positions (VERIFIED) — null, never fabricated.
      highWaterMark: null,
      trailActivation: null,
      trailStepLevel: null,
      thresholdHistory: raw.thresholdHistory ?? null,
      outgoingSwappedInAt: raw.outgoingSwappedInAt ?? null,
      outgoingSwappedInDay: raw.outgoingSwappedInDay ?? null,
    },

    predicateInputs,
    predicateClassification,

    predicateProvenance: {
      decisionAtMs,
      rankingsComputedAtMs: toMillis(raw.rankingsComputedAtMs),
      rankingsDocPath: raw.rankingsDocPath ?? 'indexIntelligence/stockRankings',
    },

    swapContext: {
      tradeCountAtDecision: raw.tradeCountAtDecision ?? null,
      tradesLenAtDecision: raw.tradesLenAtDecision ?? null,
    },

    versions: {
      // The one live version stamp in L1. The other seven do not exist in the
      // codebase yet (VERIFIED) — captured null, never invented.
      archetypeIntegrityMode: raw.archetypeIntegrityMode ?? null,
      detectorVersion: null,
      evaluationSpecVersion: null,
      calibrationManifestVersion: null,
      leanRenderConfigVersion: null,
      ruleLibraryVersion: null,
      archetypeVersion: null,
      regimeClassifierVersion: null,
    },

    dataQuality: { nullFlags: collectNullFlags(predicateInputs) },
  });
}

/** Stable per-battle receipt id: agent + monotonic receiptSeq. */
export function receiptIdFor(agentId, receiptSeq) {
  return `${agentId || 'unknown'}_seq${receiptSeq ?? 'NA'}`;
}

/**
 * The gated capture entrypoint. Call it from the swap-execution site.
 *
 * When `enabled` is falsy this returns IMMEDIATELY with no work: no receipt is
 * built, `db` is never touched. (The call site also wraps this in an
 * `if (LEARNING_L1_CAPTURE_ENABLED)` guard so the branch is dead in production —
 * this internal short-circuit is defense-in-depth and the unit-test seam.)
 *
 * When enabled, it builds the raw receipt, validates it (fail closed — an
 * invalid receipt, e.g. an out-of-enum source/exitReason, is EXCLUDED and
 * LOGGED, never written), and AWAITS the Admin-SDK write. Any write error is
 * logged and swallowed (the trade already executed); it never throws.
 *
 * @returns {Promise<{emitted: boolean, reason?: string, receiptId?: string, errors?: string[]}>}
 */
export async function captureSwapReceipt({ enabled, db, ...raw } = {}) {
  if (!enabled) return { emitted: false, reason: 'flag_off' };

  const receipt = buildRawReceipt(raw);

  const { valid, errors } = validateReceipt(receipt);
  if (!valid) {
    // Fail closed: exclude + LOG (never silently accept, never coerce).
    console.warn(`${LOG_PREFIX} receipt excluded (validation failed): ${errors.join('; ')}`);
    return { emitted: false, reason: 'invalid', errors };
  }

  const receiptId = receiptIdFor(receipt.agentId, receipt.receiptSeq);
  try {
    await db
      .collection('learningReceipts')
      .doc(receipt.battleId)
      .collection('receipts')
      .doc(receiptId)
      .set(receipt);
    return { emitted: true, receiptId };
  } catch (err) {
    // Awaited write, non-silent failure (Rider §5). Never break the trade.
    console.error(`${LOG_PREFIX} receipt write failed for ${receipt.battleId}/${receiptId}: ${err?.message}`);
    return { emitted: false, reason: 'write_error', errors: [String(err?.message || err)] };
  }
}
