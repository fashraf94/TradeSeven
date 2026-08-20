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
//   5. manifestHash determinism; MANIFEST_WRITE_ENABLED is ON in production
//      (the deliberate Phase 2 flag-flip — manifest-write first)
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): real imports of the
// leanRevalidation kernel + registry graph — NEVER mock.

import { describe, it, expect } from 'vitest';

import { buildResolvedAgentManifest } from './resolvedAgentManifest.js';
import { validateResolvedAgentManifest } from './archetypeBuildSchemas.js';
import { buildCustomizationSnapshot } from './leanRevalidation.js';
import { FREEZE_POLICY_VERSION } from './archetypeVersionConstants.js';
import { computeGameModePolicyHash } from './gameModePolicy.js';
import { canonicalContentHash } from './canonicalHash.js';
import { MANIFEST_WRITE_ENABLED } from '../../src/config/featureFlags.js';
import { TIERED_GAME_MODE, FLAT6_GAME_MODE } from '../../src/constants/agentGameModes.js';

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
  it('flag is ON in production — the deliberate Phase 2 manifest-write flip (manifest-write first, shadow-assembly second)', () => {
    // Was false through Phase 2 (exit criterion 1: merge-dark). This is the
    // dedicated founder flag-flip PR that turns manifest-write on. The
    // flag-FALSE rollback stays byte-identical — locked by the P4 fence
    // battery (manifest stripped from its photograph) and the agentBattleService
    // off-state determinism test.
    expect(MANIFEST_WRITE_ENABLED).toBe(true);
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

  it('a rev-mismatched CompiledBuild is treated as absent, with the skip recorded (review finding: deploy-window race)', () => {
    const staleGateBuild = { ...compiledBuild(), sourceRevisionVector: { settingsRev: 9 } }; // agentData is at rev 6
    const m = build({ compiledBuild: staleGateBuild });
    expect(m.versionStamps.compiledBuildIdAtLock).toBeUndefined();
    expect(m.guardrails.mergeSource).toBe('user_only_no_compiled_build');
    expect(m.renderedTensionPairs).toEqual([]);
    expect(m.compiledBuildProvenanceSkipped).toEqual({
      reason: 'settings_rev_mismatch',
      buildSettingsRev: 9,
      manifestSettingsRev: 6,
    });
    expect(validateResolvedAgentManifest(m).valid).toBe(true);
    // A rev-MATCHED build keeps its provenance (the guard only fires on drift).
    const matched = { ...compiledBuild(), sourceRevisionVector: { settingsRev: 6 } };
    expect(build({ compiledBuild: matched }).versionStamps.compiledBuildIdAtLock).toBe('a1_baggerbomb_agent_rev6');
  });

  it('manifestHash is deterministic and covers content (same inputs → same hash; changed input → new hash)', () => {
    expect(build().manifestHash).toBe(build().manifestHash);
    const changed = build({ gameMode: TIERED_GAME_MODE, now: NOW, compiledBuild: null });
    expect(changed.manifestHash).not.toBe(build().manifestHash);
  });
});

// ── E9 — equippedConfigHash (the equipped-config fingerprint) ─────────────
//
// Founder-authorized 2026-08-20 off the Strategy Foundation audit. Contract:
// config as frozen at battle birth, six axes BY VALUE (activeRules incl.
// params + hardness, equippedBundleIds, standingLeans + the bounded
// invalidated record, dials/tempo, deployedGuardrails, equippedWatchlist),
// version stamps deliberately excluded. The battery below is the acceptance
// bar as ruled: stability across identical configs, one mutation per axis,
// context-indifference. (The emulator query round-trip lives in
// test/rules/equippedConfigHashQuery.rules.mjs — npm run test:rules.)
describe('E9 — equippedConfigHash', () => {
  const mutate = (patch) => build({ agentData: { ...agentData(), ...patch } }).equippedConfigHash;

  it('is a sha256 hex string, STABLE across battle creations of the same config (different now) — while manifestHash moves with the clock', () => {
    const a = build();
    const b = build({ now: '2026-07-24T09:30:00.000Z' });
    expect(a.equippedConfigHash).toMatch(/^[0-9a-f]{64}$/);
    // Identical equipped config at a different creation instant is the SAME
    // config — the snapshotAt exclusion is load-bearing here: hashing
    // frozenLayers literally would fail this row whenever a watchlist is
    // equipped.
    expect(b.equippedConfigHash).toBe(a.equippedConfigHash);
    // The whole-manifest hash rightly DOES move (createdAt + snapshotAt are
    // content there) — the two fields answer different questions.
    expect(b.manifestHash).not.toBe(a.manifestHash);
  });

  it('binds to the manifest\'s OWN frozenLayers minus only the snapshotAt stamp (§9: the query key and the frozen record cannot disagree)', () => {
    const m = build();
    const { snapshotAt, ...watchlistContent } = m.frozenLayers.equippedWatchlist;
    expect(m.equippedConfigHash).toBe(canonicalContentHash({
      ...m.frozenLayers,
      equippedWatchlist: watchlistContent,
    }));
    // And with no watchlist equipped the binding is frozenLayers verbatim.
    const bare = build({ equippedWatchlist: null });
    expect(bare.equippedConfigHash).toBe(canonicalContentHash(bare.frozenLayers));
  });

  it('is indifferent to context: compiledBuild presence and gameMode never move it (version stamps deliberately excluded)', () => {
    const base = build().equippedConfigHash;
    expect(build({ compiledBuild: null }).equippedConfigHash).toBe(base);
    expect(build({ gameMode: FLAT6_GAME_MODE }).equippedConfigHash).toBe(base);
  });

  it('moves when any single equipped axis moves — one mutation per axis', () => {
    const base = build().equippedConfigHash;

    // activeRules — a rule param value moves.
    expect(mutate({ activeRules: [{ ruleId: 'tech-rsi-oversold', text: 'Prefer stocks with RSI below 30', paramValues: { threshold: 25 } }] }), 'paramValues').not.toBe(base);
    // activeRules — resolved hardness moves (the axis projectedRulesHash is
    // structurally blind to; this hash must not be).
    expect(mutate({ activeRules: [{ ruleId: 'tech-rsi-oversold', text: 'Prefer stocks with RSI below 30', hardness: 'hard' }] }), 'hardness').not.toBe(base);
    // equippedBundleIds.
    expect(mutate({ equippedBundleIds: ['b1', 'b2'] }), 'equippedBundleIds').not.toBe(base);
    // standingLeans — the valid channel (unequip the lean).
    expect(mutate({ standingLeans: [] }), 'standingLeans').not.toBe(base);
    // standingLeansInvalidated — the bounded invalidated record (a not-in-menu
    // pin lands there, valid channel unchanged).
    expect(mutate({ standingLeans: [{ adjustmentId: 'TF-01', version: 1, equippedAt: NOW }, { adjustmentId: 'ZZ-99', version: 1 }] }), 'standingLeansInvalidated').not.toBe(base);
    // dials.tempo.
    expect(mutate({ dials: { tempo: 'aggressive' } }), 'dials.tempo').not.toBe(base);
    // deployedGuardrails.
    expect(mutate({ deployedStrategy: { guardrails: [{ type: 'stopLoss', value: 6, enforcement: 'hard' }] } }), 'deployedGuardrails').not.toBe(base);
    // equippedWatchlist — content moves, and unequip entirely.
    expect(build({ equippedWatchlist: { watchlistId: 'w1', name: 'Focus', tickers: ['NVDA', 'AMD'] } }).equippedConfigHash, 'watchlist tickers').not.toBe(base);
    expect(build({ equippedWatchlist: null }).equippedConfigHash, 'watchlist unequip').not.toBe(base);
  });
});
