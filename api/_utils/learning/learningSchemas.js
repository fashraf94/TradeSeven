// api/_utils/learning/learningSchemas.js
//
// Agent Learning System — L1 Foundation, Phase 2.
// SHAPES ONLY. No derived values, no computation, no writer for atoms/dossiers.
//
// These skeleton factories define the stable shape of each collection's docs so
// the Phase-B estimators can be written against them WITHOUT a migration. Every
// factory returns a fully-keyed object with null leaves (the buildTechnicalSnapshot
// convention: all sub-objects present, missing leaves null). Merge overrides in
// for the fields you actually have.
//
// Collections (firestore.rules — all server-write-only):
//   learningReceipts/{battleId}/receipts/{receiptId}   raw decision-opportunity record  (WRITTEN in Phase 4, raw only)
//   learningEvidence/{agentId}/atoms/{atomId}          schema only — NO writer this phase
//   learningDossiers/{agentId}                         schema only — NO writer this phase
//   learningCalibration/{manifestVersion}              schema only — manifest instance shape

import { BAR_BASIS_TABLE_VERSION } from './barBasis.js';

/** Bump when any skeleton's shape changes. */
export const LEARNING_SCHEMA_VERSION = 1;

// ── The predicate snapshot inputs for ONE symbol (raw values at decision instant) ──
// These are the exact D1/D2/D3 predicate fields, read raw off the technical
// snapshot. `dataMode`/`dataUpdatedAt` are the raw provenance of the source doc
// (which, with barBasis.js, pins the in-force bar basis per field). regime is
// the raw per-stock regime string (D3 chop input). No classification here.
export function makePredicateInputs(overrides = {}) {
  return {
    bbPercentB: null, // volatility.bbPercentB
    distanceToResistancePct: null, // levels.distanceToResistancePct
    distTo52wkHigh: null, // smaStack.distTo52wkHigh
    volumeRatio: null, // volume.ratio
    upDayVolRatio: null, // momentum.upDayVolRatio
    macdAboveSignal: null, // momentum.macdAboveSignal
    macdFreshBullishCross: null, // momentum.macdFreshBullishCross (strength tier only)
    regime: null, // per-stock regime (D3 chop input)
    dataMode: null, // 'premarket' | 'intraday' — raw source-doc write mode
    dataUpdatedAt: null, // raw source-doc updatedAt
    ...overrides,
  };
}

// ── learningReceipts/{battleId}/receipts/{receiptId} — RAW decision-opportunity record ──
// Fields per Build Spec §3 (Appendix §2.12 + §2.10 STATE requirements, NOT its
// estimators). RAW ONLY — no derived metric, no classification, no scoring.
export function makeReceiptSkeleton(overrides = {}) {
  return {
    schemaVersion: LEARNING_SCHEMA_VERSION,
    barBasisTableVersion: BAR_BASIS_TABLE_VERSION,
    capturedAt: null, // ISO string, set at write time

    // identity
    agentId: null,
    battleId: null,
    battleDay: null,
    timestamp: null, // ISO instant of the executed decision
    receiptSeq: null, // raw monotonic per-battle order (scoreState.tradeCount+1); tie-break per Appendix §6.1

    // decision
    symbolIn: null,
    symbolOut: null,
    source: null, // closed enum RECEIPT_SOURCES
    exitReason: null, // closed enum RECEIPT_EXIT_REASONS
    haikuSwapReason: null, // the raw pre-gate reason (haiku_decision | guardrail_*)

    // validated sizing (post-validateTradeDecision)
    resolvedTier: null,
    resolvedSlotIndex: null,

    // entry state of the NEW position (D1/D2 outcome inputs)
    entryMark: null, // executed fill = incomingAsset.swapPrice
    entryATR: null, // baseATR at entry = incomingAsset.baseATR

    // guardrail-replay state of the OUTGOING position (D3 Path A initial-state
    // contract). RAW; fields the agent-battle position does not store are null
    // (see barBasis.js discovery): high-water mark / trail activation / trail
    // step level are NOT persisted (stateless trailing stop) — captured null and
    // flagged, never fabricated.
    guardrailReplay: {
      outgoingEntryPrice: null, // closedTrade.entryPrice (outgoing asset's own entry)
      outgoingBaseATR: null, // outgoing position baseATR (assetScores)
      highWaterMark: null, // NOT stored — null-flagged
      trailActivation: null, // NOT stored (stateless) — null-flagged
      trailStepLevel: null, // NOT stored (not stepped) — null-flagged
      thresholdHistory: null, // battle.thresholdHistory[symbolOut] = { maxMultiplier, minMultiplier, badges }
      outgoingSwappedInAt: null, // position entry timestamp (null if held-from-start)
      outgoingSwappedInDay: null,
    },

    // predicate snapshot inputs, per symbol, captured at the decision instant.
    // Bar basis per field is recorded in the referenced, versioned barBasis
    // table (barBasisTableVersion) + each symbol's raw dataMode.
    predicateInputs: {
      symbolIn: makePredicateInputs(),
      symbolOut: makePredicateInputs(),
    },

    // version stamps. In L1 only archetypeIntegrityMode exists as a live source;
    // the other seven do not exist in the codebase yet (VERIFIED) and are
    // captured null + flagged — never invented (some map to open contracts).
    versions: {
      detectorVersion: null,
      evaluationSpecVersion: null,
      calibrationManifestVersion: null,
      leanRenderConfigVersion: null,
      archetypeIntegrityMode: null, // = ARCHETYPE_INTEGRITY_MODE (live)
      ruleLibraryVersion: null,
      archetypeVersion: null,
      regimeClassifierVersion: null,
    },

    // data quality: which inputs were null/missing (the UNSCORABLE inputs).
    // Array of dotted field paths that were null/missing at capture.
    dataQuality: {
      nullFlags: [],
    },

    ...overrides,
  };
}

// ── learningEvidence/{agentId}/atoms/{atomId} — SCHEMA ONLY (no writer this phase) ──
// An atom requires a CLASSIFICATION (which requires the estimator — OUT of L1
// scope). Shape defined so it is stable; the writer lands in Phase B.
export function makeEvidenceAtomSkeleton(overrides = {}) {
  return {
    schemaVersion: LEARNING_SCHEMA_VERSION,
    atomId: null,
    agentId: null,
    battleId: null,
    receiptSeq: null, // links back to the source receipt's ordering
    detector: null, // 'D1' | 'D2' | 'D3'
    classLabel: null, // the CLASS from a Phase-B classifier run (not written in L1)
    createdAt: null,
    // NOTE: no estimate/statistic/number fields — those are Phase-B estimator
    // outputs and deliberately absent from the L1 shape.
    ...overrides,
  };
}

// ── learningDossiers/{agentId} — SCHEMA ONLY (no writer this phase) ──
// The one client-readable doc (owner-only). `userId` is the ownership field the
// firestore rule reads (request.auth.uid == resource.data.userId).
export function makeDossierSkeleton(overrides = {}) {
  return {
    schemaVersion: LEARNING_SCHEMA_VERSION,
    agentId: null,
    userId: null, // OWNERSHIP field — firestore.rules read gate
    lessons: [], // populated in Phase B from promoted evidence; empty shape now
    updatedAt: null,
    ...overrides,
  };
}

// ── learningCalibration/{manifestVersion} — manifest instance SHAPE (Manifest V5.0 §9) ──
export function makeCalibrationManifestSkeleton(overrides = {}) {
  return {
    schemaVersion: LEARNING_SCHEMA_VERSION,
    manifestVersion: null, // doc id
    frozen: null, // boolean
    createdAt: null,
    // The three-suite gate result (Build Spec §4): a manifest may not go live
    // until all three fixture suites pass. Shape only; not computed here.
    fixtureGate: {
      golden: null, // pass|fail (null until run)
      pairedCutoff: null,
      withinBar: null,
    },
    barBasisTableVersion: BAR_BASIS_TABLE_VERSION,
    ...overrides,
  };
}
