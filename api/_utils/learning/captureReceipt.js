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
import { buildTechnicalSnapshot } from '../buildTechnicalSnapshot.js';
// Node-clean constants module (zero imports — VERIFIED), already imported across
// api/ (§4 dependency-surface: captureReceipt.test.js's import of THIS module is
// the runtime guard and must never be mocked). The `isCpu` boolean is the
// authoritative CPU contract (leagueTournament.js §1.1: the flag is the contract,
// the id prefix a secondary readable signal); CPU_AGENT_ID_PREFIX ('cpu-agent-')
// is that secondary CPU signal and TRAINING_CLONE_ID_PREFIX ('training-agent-')
// the in-scope training signal.
import { TRAINING_CLONE_ID_PREFIX, CPU_AGENT_ID_PREFIX } from '../../../src/constants/leagueTournament.js';

const MS_PER_HOUR = 3_600_000;

/** The evidence-provenance taxonomy stamped on every receipt (outcome-blind). */
export const EVIDENCE_CLASSES = Object.freeze(['live_agent', 'cpu', 'training', 'unknown']);

/**
 * Classify a capture opportunity's EVIDENCE provenance from in-scope battle/agent
 * identity — outcome-blind (reads only identity, never any outcome/return/score).
 *
 * A CPU seat runs a prescribed tournament deployment (the drafted six) and a
 * training clone runs a cloned pod; neither is a real archetype-driven decision,
 * so a "lesson" from them is about the scripting, not about trading — they are
 * contaminated evidence and must be excluded from the corpus. Only 'live_agent'
 * receipts are real evidence.
 *
 *   isCpu === true                          → 'cpu'   (authoritative contract)
 *   agentId startsWith 'training-agent-'    → 'training'
 *   agentId startsWith 'cpu-agent-'         → 'cpu'   (secondary, belt-and-suspenders)
 *   agentId is a non-empty string           → 'live_agent'
 *   otherwise (no attributable agentId)     → 'unknown'
 *
 * @param {{isCpu?: boolean, agentId?: string|null}} [args]
 * @returns {'live_agent'|'cpu'|'training'|'unknown'}
 */
export function classifyEvidence({ isCpu, agentId } = {}) {
  if (isCpu === true) return 'cpu';
  if (typeof agentId === 'string') {
    if (agentId.startsWith(TRAINING_CLONE_ID_PREFIX)) return 'training';
    if (agentId.startsWith(CPU_AGENT_ID_PREFIX)) return 'cpu';
    if (agentId.length > 0) return 'live_agent';
  }
  return 'unknown';
}

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
 * @param {Object} techDoc  the raw stockTechnicalScores doc for the symbol (for dataUpdatedAt)
 * @param {string|null|undefined} dataMode  the source-doc write mode. The per-stock
 *   stockTechnicalScores doc carries NO `mode` field — it lives on the sibling rankings
 *   doc written in the same cron run — so production passes the sibling `mode` here
 *   (may be null; never fabricated). When omitted (undefined, legacy/test callers) it
 *   falls back to `techDoc.mode` for byte-identical behavior.
 */
export function extractPredicateInputs(snapshot, regime, techDoc = {}, dataMode = undefined) {
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
    dataMode: dataMode !== undefined ? dataMode : (techDoc?.mode ?? null),
    dataUpdatedAt: techDoc?.updatedAt ?? null,
  });
}

/**
 * Resolve the ENTRY (symbolIn) technical snapshot for capture, with a DARK,
 * POST-TRADE, CAPTURE-ONLY refetch. When the in-request `technicalScoresMap`
 * already carries the symbol's tech doc it is used as-is ('primary_fetch'). When
 * it does not — the swap-in came from the hotBench, which `allTechSymbols` in
 * agent-evaluate.js deliberately does NOT tech-fetch (a decision-path constraint
 * left untouched) — the doc still EXISTS (same atomic batch as the rankings doc),
 * so this refetches `stockTechnicalScores/{symbol}` and rebuilds the snapshot
 * ('capture_refetch'). A genuinely absent doc preserves the nulls
 * ('refetch_missing'); a failed read degrades to nulls ('refetch_error') and
 * NEVER throws into the (already-executed) swap path. Called only inside the
 * `if (LEARNING_L1_CAPTURE_ENABLED)` capture block — a strict no-op when the flag
 * is off (the caller never invokes it).
 *
 * @returns {Promise<{snapshotIn: Object, techDocIn: Object|null, entrySnapshotSource: string}>}
 */
export async function resolveEntrySnapshot({
  db, symbol, primarySnapshotIn = null, primaryTechDoc = null, momentumData = {}, technicalScoresMap = {},
} = {}) {
  if (primaryTechDoc) {
    return { snapshotIn: primarySnapshotIn, techDocIn: primaryTechDoc, entrySnapshotSource: 'primary_fetch' };
  }
  try {
    const snap = await db.collection('stockTechnicalScores').doc(symbol).get();
    if (snap?.exists) {
      const techDocIn = snap.data();
      const snapshotIn = buildTechnicalSnapshot(symbol, {
        momentumData,
        technicalScoresMap: { ...(technicalScoresMap || {}), [symbol]: techDocIn },
        rankingsMap: momentumData?.rankingsMap,
      });
      return { snapshotIn, techDocIn, entrySnapshotSource: 'capture_refetch' };
    }
    return { snapshotIn: primarySnapshotIn, techDocIn: null, entrySnapshotSource: 'refetch_missing' };
  } catch (err) {
    // Degrade to the existing null behavior; never throw into the swap path.
    console.warn(`${LOG_PREFIX} entry tech-doc refetch failed for ${symbol} (nulls preserved): ${err?.message}`);
    return { snapshotIn: primarySnapshotIn, techDocIn: null, entrySnapshotSource: 'refetch_error' };
  }
}

/**
 * Label WHICH branch of executeSwapServer's baseATR selection produced entryATR,
 * derived from CAPTURE-SCOPE data ONLY — it never re-enters the fenced
 * executeSwapServer. Mirrors that selection's precedence (agentSwapExecution.js):
 *   scoring.thresholds[inSymbol].threshold → 'scored_threshold'
 *   benchAsset.baseATR                     → 'bench_proxy' (incl. the hotBench atrPercentile×8 proxy)
 *   isCrypto ? 5.0 : 2.5                    → 'default_fallback'
 * If the final value matches none of the capture-scope candidates (e.g. in-memory
 * battle vs the transaction's re-read scoring diverge), it is 'unknown' — honest,
 * never guessed. Records provenance ONLY; entryATR is unchanged (accept the proxy).
 */
export function classifyEntryAtrSource({ entryATR, scoredThreshold, benchBaseATR, isCrypto } = {}) {
  if (entryATR === null || entryATR === undefined) return 'unknown';
  const cryptoOrStockDefault = isCrypto ? 5.0 : 2.5;
  if (scoredThreshold && entryATR === scoredThreshold) return 'scored_threshold';
  if (!scoredThreshold && benchBaseATR && entryATR === benchBaseATR) return 'bench_proxy';
  if (!scoredThreshold && !benchBaseATR && entryATR === cryptoOrStockDefault) return 'default_fallback';
  return 'unknown';
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
 * @param {'entry'|'exit_context'} role  symbolIn is the entry (the D1 signal of
 *   record for M1–M3); symbolOut is exit context only — never an entry signal.
 */
function buildPredicateClassification(symbol, inputs, techDoc, decisionAtMs, role, snapshotSource) {
  const techDocUpdatedAtMs = toMillis(techDoc?.updatedAt);
  // Raw diff, intentionally NOT clamped: it can be slightly NEGATIVE under
  // clock skew (the doc's updatedAt is a Firestore server timestamp; decisionAtMs
  // is the Vercel function's `new Date()`). Recording the raw value is honest —
  // clamping would hide skew — but Part-3 staleness stats must expect negatives.
  const predicateStalenessMs =
    decisionAtMs !== null && techDocUpdatedAtMs !== null ? decisionAtMs - techDocUpdatedAtMs : null;
  return makePredicateClassification({
    role: role ?? null,
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
    entrySnapshotSource: snapshotSource ?? null,
  });
}

/**
 * Assemble the receipt from explicit raw inputs. PURE (no Firestore I/O) and
 * OUTCOME-BLIND: it carries raw predicate inputs plus DETERMINISTIC classification
 * annotations (D1 dual-rule labels, dR null-reason, staleness/provenance) computed
 * from the predicate snapshot alone — never any outcome/return/estimator/scoring.
 * Returns the receipt object (schema shape).
 */
export function buildRawReceipt(raw = {}) {
  // dataMode is sourced from the sibling rankings doc (Defect 1b): the per-stock
  // tech doc has no `mode` field. Applied to BOTH symbols (same cron run). When
  // raw.dataMode is omitted (legacy/test callers) extractPredicateInputs falls
  // back to techDoc.mode for byte-identical behavior.
  const predicateInputs = {
    symbolIn: extractPredicateInputs(raw.snapshotIn, raw.regimeIn, raw.techDocIn, raw.dataMode),
    symbolOut: extractPredicateInputs(raw.snapshotOut, raw.regimeOut, raw.techDocOut, raw.dataMode),
  };

  const decisionAtMs = toMillis(raw.timestamp);
  const predicateClassification = {
    // symbolIn is the ENTRY (the D1 signal of record); symbolOut is exit CONTEXT.
    // entrySnapshotSource: the entry may be refetched (see resolveEntrySnapshot);
    // the caller passes the resolved source. When omitted, derive from techDoc
    // presence so legacy/test callers stay stable. The exit is always the primary
    // in-request fetch.
    symbolIn: buildPredicateClassification(raw.symbolIn, predicateInputs.symbolIn, raw.techDocIn, decisionAtMs, 'entry',
      raw.entrySnapshotSource ?? (raw.techDocIn ? 'primary_fetch' : null)),
    symbolOut: buildPredicateClassification(raw.symbolOut, predicateInputs.symbolOut, raw.techDocOut, decisionAtMs, 'exit_context',
      raw.techDocOut ? 'primary_fetch' : null),
  };

  return makeReceiptSkeleton({
    capturedAt: raw.capturedAt ?? null,

    // Fix 2 — outcome-blind evidence provenance. Prefer the value the caller
    // already computed (captureSwapReceipt passes it, so the guard and the stamp
    // never disagree); fall back to deriving it from identity for direct callers.
    evidenceClass: raw.evidenceClass ?? classifyEvidence({ isCpu: raw.isCpu, agentId: raw.agentId }),

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
    entryAtrSource: raw.entryAtrSource ?? null,

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

  // Fix 1 — never capture a non-evidence agent. A CPU prescribed deployment or a
  // training clone has no real archetype-driven entry decision to record, so the
  // corpus never contains a non-live_agent receipt in the first place: an early
  // return BEFORE buildRawReceipt, no Firestore write. (The call site applies the
  // same guard so the post-trade tech-doc refetch is skipped too; this is the
  // defense-in-depth boundary and the unit-test seam.)
  const evidenceClass = classifyEvidence({ isCpu: raw.isCpu, agentId: raw.agentId });
  if (evidenceClass !== 'live_agent') {
    return { emitted: false, reason: 'non_evidence', evidenceClass };
  }

  const receipt = buildRawReceipt({ ...raw, evidenceClass });

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
