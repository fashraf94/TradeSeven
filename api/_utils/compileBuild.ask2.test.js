// api/_utils/compileBuild.ask2.test.js
// Exit-Behavior Rebalance Tier 2, Ask 2 (rescoped) — the compiler carries the
// declared SX-04 × mb-08 combination (R8 / F10), doubly dark: behind the
// equip-time compile's own COMPILER_ENABLED AND EQUIPPED_RULE_PRECEDENCE_ENABLED.
//
//   DARK CONTRACT: compileBuild() without the opt-in input is BYTE-IDENTICAL
//   to the pre-edit compiler — proven against goldens captured from the
//   untouched tree at de4113fd (ask2CompilerGoldens.json) on the shared
//   fixture delta (ask2CompilerFixtures.js). No new key, same contentHash.
//
//   LIT: `declaredConflictDetection: true` adds `declaredConflicts` (present
//   even when empty — "checked, none found" is self-describing) and the build
//   still validates. compileBuild stays PURE: the flag is read by the caller
//   (compileOnSettingsChange, call-time, inside the enabled path only).
//
// RED-FIRST: written before the edit; watched fail against the untouched code.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const { flagState } = vi.hoisted(() => ({ flagState: { precedence: false } }));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get EQUIPPED_RULE_PRECEDENCE_ENABLED() { return flagState.precedence; },
}));

const { compileBuild } = await import('./compileBuild.js');
const { writeCompiledBuildsInTx } = await import('./compileOnSettingsChange.js');
const { validateCompiledBuild } = await import('./archetypeBuildSchemas.js');
const { getGameModePolicy, computeGameModePolicyHash, LIVE_DEPLOY_MODES } = await import('./gameModePolicy.js');
const { FIXTURE_NOW, fixtureArchetypeDefinition, fixtureVersions, fixturePlatformGuardrails } = await import('./compilerFixtures.js');
const { TIERED_GAME_MODE, FLAT6_GAME_MODE } = await import('../../src/constants/agentGameModes.js');
const { pairDelta, noPairDelta, holdVetoRule, PROFIT_TARGET_GUARDRAIL } = await import('./__fixtures__/ask2CompilerFixtures.js');

const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDENS = JSON.parse(readFileSync(join(HERE, '__fixtures__/ask2CompilerGoldens.json'), 'utf8'));

afterEach(() => { flagState.precedence = false; });

function compile(delta, mode = TIERED_GAME_MODE, extra = {}) {
  return compileBuild({
    archetypeDefinition: fixtureArchetypeDefinition,
    userBuildDelta: delta,
    platformGuardrails: fixturePlatformGuardrails,
    gameModePolicy: getGameModePolicy(mode),
    gameModePolicyHash: computeGameModePolicyHash(mode),
    versions: fixtureVersions,
    now: FIXTURE_NOW,
    ...extra,
  });
}

describe('DARK — compileBuild without the opt-in is byte-identical to the pre-edit compiler (goldens @ de4113fd)', () => {
  it('the pair delta compiles to the golden build in both modes — no declaredConflicts key, same contentHash', () => {
    expect(compile(pairDelta(), TIERED_GAME_MODE)).toEqual(GOLDENS.pairTiered);
    expect(compile(pairDelta(), FLAT6_GAME_MODE)).toEqual(GOLDENS.pairFlat6);
    expect('declaredConflicts' in compile(pairDelta())).toBe(false);
    expect(compile(pairDelta()).contentHash).toBe(GOLDENS.pairTiered.contentHash);
  });

  it('the no-pair delta compiles to its golden too', () => {
    expect(compile(noPairDelta())).toEqual(GOLDENS.noPairTiered);
  });

  it('an explicit false opt-in is the dark path (no key)', () => {
    expect(compile(pairDelta(), TIERED_GAME_MODE, { declaredConflictDetection: false })).toEqual(GOLDENS.pairTiered);
  });
});

describe('LIT — the declaration rides the build', () => {
  it('bundle-hosted mb-08 × profit target → one declaration on the build; the build still validates; contentHash covers it', () => {
    const build = compile(pairDelta({ equippedTraits: [] }), TIERED_GAME_MODE, { declaredConflictDetection: true });
    expect(build.declaredConflicts).toHaveLength(1);
    expect(build.declaredConflicts[0]).toMatchObject({
      code: 'profit_target_vs_hold_veto', sourceRef: 'mb-08', ruleId: 'fx-mb-08', host: 'bundle', hostRef: 'fx-bundle-1', targetPct: 15, resolution: 'executor_wins',
    });
    expect(validateCompiledBuild(build).valid).toBe(true);
    expect(build.contentHash).not.toBe(GOLDENS.pairTiered.contentHash);
    // Everything else on the build is the golden's — the declaration is purely additive.
    const rest = { ...build };
    delete rest.declaredConflicts;
    delete rest.contentHash;
    const goldenRest = { ...GOLDENS.pairTiered };
    delete goldenRest.contentHash;
    expect(rest).toEqual(goldenRest);
  });

  it('trait-hosted mb-08 (legacy compile mode sees no trait docs) is declared by trait definition', () => {
    const build = compile(pairDelta(), TIERED_GAME_MODE, { declaredConflictDetection: true });
    expect(build.declaredConflicts.map((c) => `${c.host}:${c.hostRef}`).sort()).toEqual(['bundle:fx-bundle-1', 'trait:trait-let-winners-run']);
    expect(build.declaredConflicts.find((c) => c.host === 'trait').basis).toBe('trait_definition');
  });

  it('unified-projection inputs (PR 3.5 candidate mode) declare through the projected rule\'s sourceRef with host provenance', () => {
    const delta = {
      ...noPairDelta(),
      projectedRules: [
        { id: 'fx-stop-loss', sourceRef: 'risk-exit-atr-stop', paramValues: { threshold: 5 }, params: null, hostBundleId: 'fx-bundle-1' },
        { id: 'doc-mb08-t', sourceRef: 'mb-08', paramValues: null, params: null, hostTraitId: 'trait-patient-holder' },
      ],
      ruleMetadata: { ...noPairDelta().ruleMetadata, 'doc-mb08-t': holdVetoRule().metadata },
      compatCells: { ...noPairDelta().compatCells, 'doc-mb08-t': holdVetoRule().cell },
    };
    const build = compile(delta, TIERED_GAME_MODE, { declaredConflictDetection: true });
    expect(build.declaredConflicts).toHaveLength(1);
    expect(build.declaredConflicts[0]).toMatchObject({ host: 'projection', hostRef: 'trait-patient-holder', ruleId: 'doc-mb08-t', basis: 'rule_doc' });
  });

  it('no pair → the key is present and empty ("checked, none found")', () => {
    const build = compile(noPairDelta(), TIERED_GAME_MODE, { declaredConflictDetection: true });
    expect(build.declaredConflicts).toEqual([]);
    expect(validateCompiledBuild(build).valid).toBe(true);
  });

  it('a profit target with a non-positive value never declares (the executor would never fire)', () => {
    const delta = pairDelta({ userGuardrails: [{ ...PROFIT_TARGET_GUARDRAIL, value: 0 }] });
    expect(compile(delta, TIERED_GAME_MODE, { declaredConflictDetection: true }).declaredConflicts).toEqual([]);
  });

  it('stays pure: the same lit input twice → identical builds', () => {
    const a = compile(pairDelta(), TIERED_GAME_MODE, { declaredConflictDetection: true });
    const b = compile(pairDelta(), TIERED_GAME_MODE, { declaredConflictDetection: true });
    expect(a).toEqual(b);
  });
});

// ==================== the equip-time caller threads the flag at CALL time ====================

function makeTx() {
  const calls = { set: [] };
  return { calls, set: (ref, data) => { calls.set.push({ path: ref.path, data }); } };
}
function makeAgentRef(id) {
  return { collection: (name) => ({ doc: (docId) => ({ path: `agents/${id}/${name}/${docId}` }) }) };
}
const NOW = '2026-09-02T12:00:00.000Z';
const bundleFromDelta = (delta) => ({ bundleId: delta.equippedBundles[0].bundleId, ...delta.equippedBundles[0] });

describe('compileOnSettingsChange — the flag is read at CALL time, inside the enabled path only', () => {
  const write = (tx, { equippedTraits = [{ traitId: 'trait-let-winners-run' }], enabled = true } = {}) => writeCompiledBuildsInTx(tx, {
    agentRef: makeAgentRef('a1'),
    agentId: 'a1',
    agent: { archetype: 'momentum_chaser', settingsRev: 4, deployedStrategy: { guardrails: [PROFIT_TARGET_GUARDRAIL] }, equippedTraits },
    nextState: {},
    bundles: [bundleFromDelta(pairDelta())],
    enabled,
    nowIso: NOW,
  });

  it('flag OFF: no build carries the key and no preview carries it', () => {
    const tx = makeTx();
    const previews = write(tx);
    expect(tx.calls.set).toHaveLength(LIVE_DEPLOY_MODES.length);
    for (const { data } of tx.calls.set) expect('declaredConflicts' in data).toBe(false);
    for (const mode of LIVE_DEPLOY_MODES) expect('declaredConflicts' in previews[mode]).toBe(false);
  });

  it('flag ON: every mode\'s build and preview carry the declaration (bundle + trait hosts)', () => {
    flagState.precedence = true;
    const tx = makeTx();
    const previews = write(tx);
    for (const { data } of tx.calls.set) {
      expect(data.declaredConflicts.map((c) => c.host).sort()).toEqual(['bundle', 'trait']);
    }
    for (const mode of LIVE_DEPLOY_MODES) {
      expect(previews[mode].declaredConflicts).toEqual(tx.calls.set.find((s) => s.path.endsWith(`/${mode}`)).data.declaredConflicts);
    }
  });

  it('flag ON: equippedTraits come from nextState when the save changes them (update-agent-settings path)', () => {
    flagState.precedence = true;
    const tx = makeTx();
    writeCompiledBuildsInTx(tx, {
      agentRef: makeAgentRef('a1'),
      agentId: 'a1',
      agent: { archetype: 'momentum_chaser', settingsRev: 4, deployedStrategy: { guardrails: [PROFIT_TARGET_GUARDRAIL] }, equippedTraits: [{ traitId: 'trait-let-winners-run' }] },
      nextState: { equippedTraits: [] }, // the save UNEQUIPS the mb-08 trait
      bundles: [bundleFromDelta(noPairDelta())],
      enabled: true,
      nowIso: NOW,
    });
    for (const { data } of tx.calls.set) expect(data.declaredConflicts).toEqual([]);
  });

  it('disabled compile returns null before any flag read (the dark endpoints never touch the flag)', () => {
    flagState.precedence = true;
    const tx = makeTx();
    expect(write(tx, { enabled: false })).toBeNull();
    expect(tx.calls.set).toEqual([]);
  });
});
