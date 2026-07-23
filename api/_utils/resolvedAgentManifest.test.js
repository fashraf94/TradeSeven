// api/_utils/resolvedAgentManifest.test.js
//
// Archetype Architecture Phase 2 (P2.5, §7-signed) — the manifest builder.
// The fenced spread's flag-false byte-identity is locked by the P4
// equivalence battery (agentBattleService doc photograph); this suite locks
// the BUILDER contract:
//
//   1. Output passes the P2.1 §4.1 validator
//   2. Frozen leans/dials/settingsRev come from the SAME
//      buildCustomizationSnapshot kernel (one source — §9 discipline)
//   3. R1-10 three-part guardrails: user source copied, never mutated;
//      compiled + effective from the CompiledBuild; honest user-only merge
//      without one
//   4. §4.3 version stamps incl. the A-2 mode fields; R1-2
//      freezePolicyVersion; DR-13 renderedTensionPairs pass-through
//   5. manifestHash determinism; MANIFEST_WRITE_ENABLED defaults false
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): real imports of the
// leanRevalidation kernel + registry graph — NEVER mock.

import { describe, it, expect } from 'vitest';

import { buildResolvedAgentManifest } from './resolvedAgentManifest.js';
import { validateResolvedAgentManifest } from './archetypeBuildSchemas.js';
import { buildCustomizationSnapshot } from './leanRevalidation.js';
import { FREEZE_POLICY_VERSION } from './archetypeVersionConstants.js';
import { computeGameModePolicyHash } from './gameModePolicy.js';
import { MANIFEST_WRITE_ENABLED } from '../../src/config/featureFlags.js';
import { TIERED_GAME_MODE } from '../../src/constants/agentGameModes.js';

const NOW = '2026-07-23T15:00:00.000Z';

const agentData = () => ({
  id: 'a1',
  name: 'Viper',
  archetype: 'momentum_chaser',
  settingsRev: 6,
  activeRules: [{ ruleId: 'tech-rsi-oversold', text: 'Prefer stocks with RSI below 30' }],
  equippedBundleIds: ['b1'],
  standingLeans: [{ adjustmentId: 'TF-01', version: 1, equippedAt: NOW }],
  dials: { tempo: 'standard' },
  config: { risk: 72 },
  deployedStrategy: { guardrails: [{ type: 'stopLoss', value: 8, enforcement: 'hard' }] },
});

const compiledBuild = () => ({
  compiledBuildId: 'a1_baggerbomb_agent_rev6',
  contentHash: 'ch',
  compilerVersion: 1,
  effectiveGuardrailsPreview: {
    perType: {
      stopLoss: {
        requestedByUser: 8,
        derivedFromRules: [{ ruleId: 'fx-stop', value: 5, binding: { type: 'stopLoss' } }],
        effective: 5,
        governingSource: 'rule:fx-stop',
        onUnequipBehavior: 'reverts to user value 8',
      },
    },
  },
  renderedTensionCandidates: [{ ruleId: 'fx-t', treatment: 'renderWithSubordination', tensionReason: 'r' }],
});

function build(overrides = {}) {
  return buildResolvedAgentManifest({
    agentData: agentData(),
    compiledBuild: compiledBuild(),
    equippedWatchlist: { watchlistId: 'w1', name: 'Focus', tickers: ['NVDA'] },
    gameMode: TIERED_GAME_MODE,
    now: NOW,
    ...overrides,
  });
}

describe('P2.5 manifest builder', () => {
  it('flag defaults false at merge (exit criterion 1)', () => {
    expect(MANIFEST_WRITE_ENABLED).toBe(false);
  });

  it('output passes the §4.1 validator', () => {
    const res = validateResolvedAgentManifest(build());
    expect(res.errors).toEqual([]);
    expect(res.valid).toBe(true);
  });

  it('frozen customization values come from the SAME kernel as agentContext (one source)', () => {
    const m = build();
    const kernel = buildCustomizationSnapshot(agentData(), NOW);
    expect(m.frozenLayers.standingLeans).toEqual(kernel.standingLeans);
    expect(m.frozenLayers.standingLeansInvalidated).toEqual(kernel.standingLeansInvalidated);
    expect(m.frozenLayers.dials).toEqual(kernel.dials);
    expect(m.valuesAtLock.settingsRev).toBe(kernel.settingsRev);
    expect(m.versionStamps.settingsRevAtLock).toBe(kernel.settingsRev);
  });

  it('R1-10: user guardrails are a copy (source never mutated), compiled + effective from the build', () => {
    const data = agentData();
    const m = buildResolvedAgentManifest({
      agentData: data, compiledBuild: compiledBuild(), equippedWatchlist: null, gameMode: TIERED_GAME_MODE, now: NOW,
    });
    expect(m.guardrails.userGuardrails).toEqual(data.deployedStrategy.guardrails);
    expect(m.guardrails.userGuardrails[0]).not.toBe(data.deployedStrategy.guardrails[0]); // copy
    expect(m.guardrails.compiledRuleGuardrails).toEqual([
      { type: 'stopLoss', sourceRuleId: 'fx-stop', value: 5, guardrailBinding: { type: 'stopLoss' } },
    ]);
    expect(m.guardrails.effectiveGuardrails).toEqual([
      { type: 'stopLoss', effective: 5, governingSource: 'rule:fx-stop', onUnequipBehavior: 'reverts to user value 8' },
    ]);
    expect(m.guardrails.mergeSource).toBe('compiled_build');
    expect(data.deployedStrategy.guardrails[0]).toEqual({ type: 'stopLoss', value: 8, enforcement: 'hard' }); // untouched
  });

  it('without a CompiledBuild the merge is honestly user-only (compiler flag off case)', () => {
    const m = build({ compiledBuild: null });
    expect(m.guardrails.compiledRuleGuardrails).toEqual([]);
    expect(m.guardrails.effectiveGuardrails).toEqual([
      { type: 'stopLoss', effective: 8, governingSource: 'user', onUnequipBehavior: 'unchanged (user value governs)' },
    ]);
    expect(m.guardrails.mergeSource).toBe('user_only_no_compiled_build');
    expect(m.renderedTensionPairs).toEqual([]);
    expect(validateResolvedAgentManifest(m).valid).toBe(true);
  });

  it('stamps R1-2 freezePolicyVersion, the §4.3 …AtLock set, and the A-2 mode fields', () => {
    const m = build();
    expect(m.freezePolicyVersion).toBe(FREEZE_POLICY_VERSION);
    expect(m.versionStamps.gameModeAtLock).toBe(TIERED_GAME_MODE);
    expect(m.versionStamps.gameModePolicyHashAtLock).toBe(computeGameModePolicyHash(TIERED_GAME_MODE));
    for (const k of ['calibrationBundleVersionAtLock', 'knobConfigVersionAtLock', 'dialBandVersionAtLock', 'ruleLibraryVersionAtLock', 'identityVersionAtLock', 'guardrailSetVersionAtLock', 'promptSpecVersionAtLock', 'gameModePolicyVersionAtLock']) {
      expect(m.versionStamps[k], k).toBeTypeOf('number');
    }
    expect(m.versionStamps.identityHashAtLock).toMatch(/^[0-9a-f]{64}$/);
    expect(m.versionStamps.compiledBuildIdAtLock).toBe('a1_baggerbomb_agent_rev6');
  });

  it('records DR-13 renderedTensionPairs from the compile and freezes the watchlist with snapshotAt', () => {
    const m = build();
    expect(m.renderedTensionPairs).toEqual([{ ruleId: 'fx-t', treatment: 'renderWithSubordination', tensionReason: 'r' }]);
    expect(m.frozenLayers.equippedWatchlist).toEqual({ watchlistId: 'w1', name: 'Focus', tickers: ['NVDA'], snapshotAt: NOW });
  });

  it('manifestHash is deterministic and covers content (same inputs → same hash; changed input → new hash)', () => {
    expect(build().manifestHash).toBe(build().manifestHash);
    const changed = build({ gameMode: TIERED_GAME_MODE, now: NOW, compiledBuild: null });
    expect(changed.manifestHash).not.toBe(build().manifestHash);
  });
});
