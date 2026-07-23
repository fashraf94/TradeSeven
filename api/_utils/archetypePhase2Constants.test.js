// api/_utils/archetypePhase2Constants.test.js
//
// Archetype Architecture Phase 2 (P2.1) — unit tests for the constants,
// contract modules, and schema validators. Nothing here touches production
// behavior; these lock the CONTRACTS:
//
//   1. canonicalHash determinism
//   2. CALIBRATION_BUNDLE_VERSION bump discipline (§4.3) — the recorded-hash
//      lock fails on physics-table content change without a version bump
//   3. PlatformGuardrails contract (§1.2) — live-value grounding
//   4. GameModePolicy contract (§1.3 + A-2) — per-mode content hashes
//   5. The three artifact validators (§4.4+A-2, §4.1, A-1)
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): this file's REAL imports of
// platformGuardrails.js / gameModePolicy.js / calibrationBundle.js pull the
// full api→src transitive graph (featureFlags, agentGameModes,
// leagueTournament) plus the fenced agentArchetypeConfig / agentRiskManager /
// archetypeScoring read surfaces through the Node test environment — if a
// browser-only dependency ever enters that graph, this suite explodes at
// import time. That is the guard. NEVER mock these imports.

import { describe, it, expect } from 'vitest';

import { stableStringify, canonicalContentHash } from './canonicalHash.js';
import {
  CALIBRATION_BUNDLE_VERSION,
  GUARDRAIL_SET_VERSION,
  GAME_MODE_POLICY_VERSION,
} from './archetypeVersionConstants.js';
import { buildCalibrationBundle, computeCalibrationBundleHash } from './calibrationBundle.js';
import { buildPlatformGuardrails, computePlatformGuardrailsHash } from './platformGuardrails.js';
import {
  GAME_MODE_POLICIES,
  LIVE_DEPLOY_MODES,
  getGameModePolicy,
  computeGameModePolicyHash,
} from './gameModePolicy.js';
import {
  validateCompiledBuild,
  validateResolvedAgentManifest,
  validateBehaviorRecordEnvelope,
  ENVELOPE_SCHEMA_VERSION,
  SOURCE_REVISION_VECTOR_KEYS,
  PREVIEW_PER_TYPE_KEYS,
} from './archetypeBuildSchemas.js';
import { EMERGENCY_BYPASS_REASONS } from './agentRiskManager.js';
import { KNOB_CONFIG_VERSION, VALID_ARCHETYPES } from './agentArchetypeConfig.js';
import { TEMPO_DIAL_BANDS } from './tempoDialBands.js';
import { TIERED_GAME_MODE, FLAT6_GAME_MODE } from '../../src/constants/agentGameModes.js';

// ── Recorded content hashes (the §4.3/§2.3 bump-discipline locks) ────────
// REMEDY when a lock fails: if you changed a covered table DELIBERATELY,
// bump the paired version constant in archetypeVersionConstants.js AND
// re-record the hash here in the SAME commit (founder-visible diff). If you
// did not change a table, you have an accidental calibration edit — stop.
const RECORDED_CALIBRATION_HASH = '4f701ffa100212863f2e0a6db3628241a5ca57720cbd2983cbe87aaa1a051658';
// NOTE: SECTOR_CAP_MODE is part of the §1.2 contract (sectorCapPolicy.mode),
// so fixing the census-flagged 'true' value WILL trip this lock — that is
// correct per §1.2 ("bumped on any change below"): bump GUARDRAIL_SET_VERSION
// and re-record alongside the flag fix.
const RECORDED_PLATFORM_HASH = '1ce1e68b2f434725af7066bc5973789072a8762aa4a6ba3d22bb43662927f606';
const RECORDED_POLICY_HASHES = {
  [TIERED_GAME_MODE]: 'c5ad06be25564ce95adb58c8f8068fa8817efca9162f773879f6e5ee77c8eedc',
  [FLAT6_GAME_MODE]: '39da0fc4ba8ebe2f55a044617a96d7712d2d8fd513c6820d2ec9d4b931d23063',
  training: 'ff261e37cdba08a0e2bac5d6d47805d37e9625758872afe3d5557e1086e33e73',
  season: 'c9d56a3708dbdc3e79a34031832d4019a9cacfd845ca3ac7c6fac9fcf89eb714',
};

describe('canonicalHash', () => {
  it('is key-order independent but array-order preserving', () => {
    expect(canonicalContentHash({ a: 1, b: [1, 2] })).toBe(canonicalContentHash({ b: [1, 2], a: 1 }));
    expect(canonicalContentHash({ a: [1, 2] })).not.toBe(canonicalContentHash({ a: [2, 1] }));
  });
  it('drops undefined properties, keeps null, mirrors JSON array-slot semantics', () => {
    expect(stableStringify({ a: undefined, b: null })).toBe('{"b":null}');
    expect(stableStringify([undefined])).toBe('[null]');
  });
});

describe('CALIBRATION_BUNDLE_VERSION coverage + bump discipline (§4.3)', () => {
  it('composes every covered physics table for all six archetypes', () => {
    const bundle = buildCalibrationBundle();
    expect(bundle.calibrationBundleVersion).toBe(CALIBRATION_BUNDLE_VERSION);
    expect(bundle.knobConfigVersion).toBe(KNOB_CONFIG_VERSION);
    expect(VALID_ARCHETYPES).toHaveLength(6);
    for (const a of VALID_ARCHETYPES) {
      expect(bundle.hftConfigByArchetype[a], `hftConfig for ${a}`).toBeTruthy();
      expect(bundle.archetypeWeights[a], `weights for ${a}`).toBeTruthy();
      expect(bundle.archetypeTemperatures[a], `temperatures for ${a}`).toBeTruthy();
      expect(bundle.archetypeConstraints[a], `constraints for ${a}`).toBeTruthy();
    }
    expect(Object.keys(bundle.presetLevers).sort()).toEqual(['aggressive', 'balanced', 'defensive']);
    expect(bundle.tempoBands).toBe(TEMPO_DIAL_BANDS); // by reference — never a copy (BUILD_RULES §4)
  });

  it('FAILS on physics-table content change without a CALIBRATION_BUNDLE_VERSION bump', () => {
    expect(computeCalibrationBundleHash()).toBe(RECORDED_CALIBRATION_HASH);
  });

  it('tempo bands remain bound to the live knob generation (fail-closed pairing)', () => {
    expect(TEMPO_DIAL_BANDS.forKnobConfigVersion).toBe(KNOB_CONFIG_VERSION);
  });
});

describe('PlatformGuardrails contract (§1.2)', () => {
  it('grounds every floor in the live platform values', () => {
    const pg = buildPlatformGuardrails();
    expect(pg.guardrailSetVersion).toBe(GUARDRAIL_SET_VERSION);
    expect(pg.floors.convictionFloor).toBe(70); // agentSwapExecution.js:77
    expect(pg.floors.cooldownHours).toBe(24); // agentSwapExecution.js:311
    expect(pg.floors.lockProximity).toBe(0.2); // agentRiskManager.js:8
    expect(pg.floors.selfSwapBan).toBe(true);
    expect(pg.floors.duplicateSlotBan).toBe(true);
    expect(pg.universalFilters.distressedSwapInBlock).toBe(true);
    expect(pg.precedencePosition).toBe(1);
  });

  it('references the fenced EMERGENCY_BYPASS_REASONS by identity — the single source, never a copy', () => {
    expect(buildPlatformGuardrails().emergencyBypassReasonsRef).toBe(EMERGENCY_BYPASS_REASONS);
    expect(EMERGENCY_BYPASS_REASONS.has('bust_avoidance')).toBe(true);
  });

  it('FAILS on platform-contract content change without a GUARDRAIL_SET_VERSION bump', () => {
    expect(computePlatformGuardrailsHash()).toBe(RECORDED_PLATFORM_HASH);
  });
});

describe('GameModePolicy contract (§1.3 + A-2)', () => {
  it('covers the two live deploy modes plus the spec-named training/season policies', () => {
    expect(LIVE_DEPLOY_MODES).toEqual([TIERED_GAME_MODE, FLAT6_GAME_MODE]);
    expect(Object.keys(GAME_MODE_POLICIES).sort()).toEqual(
      [TIERED_GAME_MODE, FLAT6_GAME_MODE, 'training', 'season'].sort()
    );
    for (const policy of Object.values(GAME_MODE_POLICIES)) {
      expect(policy.gameModePolicyVersion).toBe(GAME_MODE_POLICY_VERSION);
      expect(policy.precedencePosition).toBe(2);
    }
  });

  it('resolves unknown modes to null — no silent tiered fallback for compile targets (A-2)', () => {
    expect(getGameModePolicy('nope')).toBeNull();
    expect(computeGameModePolicyHash('nope')).toBeNull();
  });

  it('FAILS on per-mode policy content change without a GAME_MODE_POLICY_VERSION bump', () => {
    for (const [mode, hash] of Object.entries(RECORDED_POLICY_HASHES)) {
      expect(computeGameModePolicyHash(mode), `policy hash for ${mode}`).toBe(hash);
    }
  });
});

// ── Validator fixtures ───────────────────────────────────────────────────
function validBuild() {
  return {
    compiledBuildId: 'agent1_baggerbomb_agent_rev7',
    compilerVersion: 1,
    compiledAt: '2026-07-23T12:00:00.000Z',
    contentHash: 'h'.repeat(8),
    agentId: 'agent1',
    buildVersion: 7,
    parentArchetypeId: 'momentum_chaser',
    parentIdentityVersion: 1,
    identityHash: 'idhash',
    gameMode: TIERED_GAME_MODE,
    gameModePolicyVersion: 1,
    gameModePolicyHash: 'polhash',
    sourceRevisionVector: {
      settingsRev: 7,
      bundleContentHashes: { b1: 'bh1' },
      ruleLibraryVersion: 1,
      identityHash: 'idhash',
      calibrationBundleVersion: 1,
      guardrailSetVersion: 1,
      gameMode: TIERED_GAME_MODE,
      gameModePolicyVersion: 1,
      gameModePolicyHash: 'polhash',
    },
    validation: { pass: true, errors: [] },
    compatVerdicts: [{ ruleId: 'tech-rsi-oversold', verdict: 'native' }],
    blockedControls: [],
    effectiveGuardrailsPreview: {
      perType: {
        stopLoss: {
          requestedByUser: 8,
          derivedFromRules: [{ ruleId: 'r-stop', value: 5, binding: { type: 'stopLoss' } }],
          effective: 5,
          governingSource: 'rule:r-stop',
          onUnequipBehavior: 'reverts to user value 8',
        },
      },
    },
    freshness: { validUntilSourceChange: true },
  };
}

function validManifest() {
  return {
    manifestId: 'm1',
    manifestHash: 'mh1',
    freezePolicyVersion: 1,
    renderedTensionPairs: [],
    frozenLayers: { activeRules: [], standingLeans: [], dials: { tempo: 'standard' } },
    valuesAtLock: { strategyPreset: 'balanced' },
    versionStamps: { calibrationBundleVersionAtLock: 1 },
    guardrails: { userGuardrails: [], compiledRuleGuardrails: [], effectiveGuardrails: [] },
  };
}

function validEnvelope() {
  return {
    envelopeSchemaVersion: ENVELOPE_SCHEMA_VERSION,
    manifestId: 'm1',
    manifestHash: 'mh1',
    versionsAtLock: { calibrationBundleVersionAtLock: 1 },
    effectiveRuntimeResolution: {
      calibrationBundleVersion: 1,
      knobConfigVersion: 2,
      dialBandVersion: 2,
      modelId: 'claude-haiku-4-5-20251001',
      promptSpecVersion: 1,
      guardrailSetVersion: 1,
      gameModePolicyVersion: 1,
      commitSha: 'abc123',
    },
    tickId: '2026-07-23T13:00:00.000Z_battle1',
    evaluatedAt: '2026-07-23T13:00:05.000Z',
  };
}

describe('validateCompiledBuild (§4.4 + A-2)', () => {
  it('accepts the reference shape', () => {
    expect(validateCompiledBuild(validBuild())).toEqual({ valid: true, errors: [] });
  });

  it('requires every sourceRevisionVector component including the A-2 mode fields', () => {
    for (const key of SOURCE_REVISION_VECTOR_KEYS) {
      const b = validBuild();
      delete b.sourceRevisionVector[key];
      const res = validateCompiledBuild(b);
      expect(res.valid, `missing vector.${key}`).toBe(false);
      expect(res.errors.join(' ')).toContain(key);
    }
  });

  it('rejects vector/build mode-field disagreement (A-2: one build, one mode)', () => {
    const b = validBuild();
    b.sourceRevisionVector.gameMode = FLAT6_GAME_MODE;
    const res = validateCompiledBuild(b);
    expect(res.valid).toBe(false);
    expect(res.errors.join(' ')).toContain('one build, one mode');
  });

  it('rejects a tension verdict without a treatment (§5.6: no invented defaults)', () => {
    const b = validBuild();
    b.compatVerdicts.push({ ruleId: 'r-t', verdict: 'tension' });
    expect(validateCompiledBuild(b).valid).toBe(false);
  });

  it('rejects an unknown verdict token', () => {
    const b = validBuild();
    b.compatVerdicts[0].verdict = 'neutral'; // input vocabulary, not verdict vocabulary
    expect(validateCompiledBuild(b).valid).toBe(false);
  });

  it('requires every R1-12 mandatory preview field per type', () => {
    for (const key of PREVIEW_PER_TYPE_KEYS) {
      const b = validBuild();
      delete b.effectiveGuardrailsPreview.perType.stopLoss[key];
      expect(validateCompiledBuild(b).valid, `missing preview.${key}`).toBe(false);
    }
  });

  it('requires freshness.validUntilSourceChange === true', () => {
    const b = validBuild();
    b.freshness = { validUntilSourceChange: false };
    expect(validateCompiledBuild(b).valid).toBe(false);
  });
});

describe('validateResolvedAgentManifest (§4.1 amendments + P2.5 block)', () => {
  it('accepts the reference shape', () => {
    expect(validateResolvedAgentManifest(validManifest())).toEqual({ valid: true, errors: [] });
  });

  it('requires each specified component', () => {
    for (const key of ['manifestId', 'manifestHash', 'freezePolicyVersion', 'renderedTensionPairs', 'frozenLayers', 'valuesAtLock', 'versionStamps', 'guardrails']) {
      const m = validManifest();
      delete m[key];
      expect(validateResolvedAgentManifest(m).valid, `missing ${key}`).toBe(false);
    }
  });

  it('enforces the R1-10 three-part guardrails layer', () => {
    for (const key of ['userGuardrails', 'compiledRuleGuardrails', 'effectiveGuardrails']) {
      const m = validManifest();
      delete m.guardrails[key];
      expect(validateResolvedAgentManifest(m).valid, `missing guardrails.${key}`).toBe(false);
    }
  });
});

describe('validateBehaviorRecordEnvelope (A-1)', () => {
  it('accepts the reference shape', () => {
    expect(validateBehaviorRecordEnvelope(validEnvelope())).toEqual({ valid: true, errors: [] });
  });

  it('rejects a missing or wrong envelopeSchemaVersion (no grandfathering)', () => {
    const e = validEnvelope();
    delete e.envelopeSchemaVersion;
    expect(validateBehaviorRecordEnvelope(e).valid).toBe(false);
    e.envelopeSchemaVersion = 999;
    expect(validateBehaviorRecordEnvelope(e).valid).toBe(false);
  });

  it('requires every §4.3 effectiveRuntimeResolution key', () => {
    for (const key of ['calibrationBundleVersion', 'knobConfigVersion', 'dialBandVersion', 'modelId', 'promptSpecVersion', 'guardrailSetVersion', 'gameModePolicyVersion', 'commitSha']) {
      const e = validEnvelope();
      delete e.effectiveRuntimeResolution[key];
      expect(validateBehaviorRecordEnvelope(e).valid, `missing resolution.${key}`).toBe(false);
    }
  });

  it('tolerates null resolution values (captured null, never invented) but rejects wrong types', () => {
    const e = validEnvelope();
    e.effectiveRuntimeResolution.modelId = null;
    expect(validateBehaviorRecordEnvelope(e).valid).toBe(true);
    e.effectiveRuntimeResolution.modelId = { nope: true };
    expect(validateBehaviorRecordEnvelope(e).valid).toBe(false);
  });
});
