// api/_utils/compilerFixtures.js
//
// Archetype Architecture Phase 2 (P2.3) — fixture metadata for compiler
// development (Spec §5.6: "Compiler development uses fixture metadata; no
// permissive production defaults are ever invented"). Every fixture rule
// carries COMPLETE authored metadata; tests derive their negative cases by
// deleting fields from these, so the absence paths are always exercised
// against a known-good base.
//
// Test-support module: no production imports, no I/O.

import { SUPPORTED_GUARDRAIL_SHAPES } from './compileBuild.js';

export const FIXTURE_NOW = '2026-07-23T12:00:00.000Z';

export const fixtureArchetypeDefinition = Object.freeze({
  codeId: 'momentum_chaser',
  identityVersion: 1,
  identityHash: 'fixture-identity-hash-v1',
});

export const fixtureVersions = Object.freeze({
  ruleLibraryVersion: 1,
  calibrationBundleVersion: 1,
});

// A §1.2-shaped stub — only the fields the compiler reads. Tests that need
// the real contract import buildPlatformGuardrails() directly.
export const fixturePlatformGuardrails = Object.freeze({
  guardrailSetVersion: 1,
});

/** A complete deterministic-eligible stop-loss rule. */
export function stopLossRule({ ruleId = 'fx-stop-loss', pct = 5 } = {}) {
  return {
    snapshot: {
      id: ruleId,
      text: `Exit any position down ${pct}% from entry`,
      textTemplate: 'Exit any position down {threshold}% from entry',
      params: { threshold: { type: 'number', default: pct } },
      paramValues: { threshold: pct },
      category: 'risk',
    },
    metadata: {
      intendedMode: 'execution_constraint',
      copyClass: 'enforced',
      receiptTag: 'stop_loss_exit',
      detectorSource: 'guardrail_engine',
      missingDataFallback: 'abstain',
      modes: 'both',
      guardrailBinding: { ...SUPPORTED_GUARDRAIL_SHAPES.stopLoss, valueParamKey: 'threshold' },
    },
    cell: { state: 'native', via: 'fixture' },
  };
}

/** A complete advisory (no binding) rule. */
export function advisoryRule({ ruleId = 'fx-advisory', state = 'neutral' } = {}) {
  return {
    snapshot: {
      id: ruleId,
      text: 'Prefer stocks with RSI below 30',
      textTemplate: 'Prefer stocks with RSI below {threshold}',
      params: { threshold: { type: 'number', default: 30 } },
      paramValues: { threshold: 30 },
      category: 'technical',
    },
    metadata: {
      intendedMode: 'required_consideration',
      copyClass: 'advisory',
      receiptTag: 'rsi_preference',
      missingDataFallback: 'ignore_rule',
      modes: 'both',
    },
    cell: { state, via: 'fixture' },
  };
}

/** A lean-class tie-breaker rule (the ONLY legal tie_breaker content class). */
export function leanTieBreakerRule({ ruleId = 'fx-lean-tiebreak' } = {}) {
  return {
    snapshot: {
      id: ruleId,
      text: 'Between equal candidates, prefer the stronger sector',
      textTemplate: null,
      params: null,
      paramValues: null,
      category: 'strategy',
    },
    metadata: {
      intendedMode: 'tie_breaker',
      contentClass: 'lean',
      copyClass: 'advisory',
      receiptTag: 'lean_tiebreak',
      modes: 'both',
    },
    cell: { state: 'native', via: 'fixture' },
  };
}

/** A tension rule with an authored treatment. */
export function tensionRule({ ruleId = 'fx-tension', treatment = 'advisoryDowngrade' } = {}) {
  const base = stopLossRule({ ruleId, pct: 4 });
  return {
    ...base,
    metadata: { ...base.metadata, receiptTag: 'tension_rule' },
    cell: { state: 'tension', via: 'fixture', treatment, tensionReason: 'pulls against ride-the-winner identity' },
  };
}

/** A core-conflict rule (blocked, never compiles). */
export function coreConflictRule({ ruleId = 'fx-core-conflict' } = {}) {
  const base = advisoryRule({ ruleId });
  return {
    ...base,
    cell: { state: 'core_conflict', via: 'fixture', zone1Ref: 'TF-Z1-BUY-STRENGTH' },
  };
}

/**
 * Assemble a userBuildDelta from fixture rules. Each entry is a
 * {snapshot, metadata, cell} triple from the builders above (tests mutate
 * copies to create the negative cases).
 */
export function buildDelta(rules, {
  agentId = 'fx-agent',
  settingsRev = 7,
  bundleId = 'fx-bundle-1',
  userGuardrails = [],
  ruleHardness,
  dimensionValues,
  parentArchetypeId = fixtureArchetypeDefinition.codeId,
  parentIdentityVersion = fixtureArchetypeDefinition.identityVersion,
} = {}) {
  const ruleMetadata = {};
  const compatCells = {};
  for (const r of rules) {
    ruleMetadata[r.snapshot.id] = r.metadata;
    compatCells[r.snapshot.id] = r.cell;
  }
  return {
    agentId,
    settingsRev,
    parentArchetypeId,
    parentIdentityVersion,
    equippedBundles: [{
      bundleId,
      ruleIds: rules.map((r) => r.snapshot.id),
      ruleSnapshots: rules.map((r) => r.snapshot),
      ...(ruleHardness !== undefined ? { ruleHardness } : {}),
      ...(dimensionValues !== undefined ? { dimensionValues } : {}),
    }],
    ruleMetadata,
    compatCells,
    userGuardrails,
  };
}
