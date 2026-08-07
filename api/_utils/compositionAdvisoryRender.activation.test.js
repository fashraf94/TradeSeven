// api/_utils/compositionAdvisoryRender.activation.test.js
//
// Composition PR 4 (D14) — the PRIMARY ON-state contract suite (PROMOTED
// from the PR-3 dual-golden set per the founder's flip amendment: the code
// supports BOTH states and the RUNBOOK flips — these rows are gated on the
// ACTIVATION-RECORD-DERIVED surface, never a build-time constant). The
// epoch-simulating harness forces the compiled-identity flag ON via the
// config mock; the compat surface is the activated CompiledBuild slice —
// which in production EXISTS only on battles created after the record is
// written (FC-1 stamps it; dark-by-absence is the record gating). The
// record-driven end-to-end rows live in compositionGenerationFence.test.js
// (FC-1: pin → stamp → assembler consistency); the DARK goldens
// (p4Equivalence battery, ruleCompatInvariantR, hardSoftOverride parity)
// remain the PRE-FLIP regression lock until the runbook runs — both suites
// ride every CI run, which is exactly the dual-state contract.
//
//   A13 — the advisory lands on the equipped rule's OWN line, EXACTLY once,
//         in BOTH assemblers
//   A14 — native/neutral rules render byte-identically to the dark output
//   A15 — an inadmissible surface (quarantined / unblocked illegal pair)
//         renders NOTHING (output byte-equal to dark)

import { describe, it, expect, vi } from 'vitest';

const flagState = { compiledIdentity: true };
vi.mock('./compositionConfig.js', () => ({
  get COMPOSITION_ENFORCEMENT_MODE() { return 'off'; },
  get COMPOSITION_EPOCH_FENCE_ENABLED() { return false; },
  get COMPOSITION_MIGRATION_FEED_ENABLED() { return false; },
  get COMPOSITION_COMPILED_IDENTITY_ENABLED() { return flagState.compiledIdentity; },
}));

const { buildStrategyUserPrompt } = await import('./agentPromptAssembly.js');
const { buildAgentIdentityBlock } = await import('./agentEvalPromptAssembly.js');

const ADVISORY = 'the agent is instructed that the cap limits how much a leading sector may hold, not whether leading sectors are preferred.';

const RULES = [
  { ruleId: 'rd-tension', text: 'Cap any single sector at 60% of portfolio', category: 'allocation', hardness: 'hard' },
  { ruleId: 'rd-neutral', text: 'Prefer high relative-strength names', category: 'strategy', hardness: 'soft' },
];

const COMPAT = {
  entries: [
    { ruleId: 'rd-tension', verdict: 'tension', advisory: ADVISORY, narrowedParams: { pct: { min: 40, max: 80 } } },
    { ruleId: 'rd-neutral', verdict: 'compatible', advisory: null, narrowedParams: null },
  ],
};

function draftAgent(compositionCompat) {
  return {
    name: 'Fixture', archetype: 'momentum_chaser', config: {},
    activeRules: RULES.map((r) => ({ ...r })),
    ...(compositionCompat ? { compositionCompat } : {}),
  };
}

function evalBattle(compositionCompat) {
  return {
    agentContext: {
      name: 'Fixture', archetype: 'momentum_chaser',
      activeRules: RULES.map((r) => ({ ...r })),
    },
    ...(compositionCompat ? { resolvedAgentManifest: { compositionCompat } } : {}),
  };
}

const countOf = (s, needle) => s.split(needle).length - 1;

describe('activation-state goldens — draft assembler (buildStrategyUserPrompt)', () => {
  it('A13: the tension rule line carries its advisory EXACTLY once; A14: the neutral line is byte-identical to dark', () => {
    flagState.compiledIdentity = true;
    const lit = buildStrategyUserPrompt(draftAgent(COMPAT), null);
    expect(countOf(lit, `— Advisory: ${ADVISORY}`)).toBe(1);
    expect(lit).toContain(`Cap any single sector at 60% of portfolio — Advisory: ${ADVISORY}`);
    flagState.compiledIdentity = false;
    const dark = buildStrategyUserPrompt(draftAgent(COMPAT), null);
    expect(countOf(dark, 'Advisory:')).toBe(0);
    // A14: the neutral rule's rendered line is the SAME bytes lit and dark.
    const neutralLine = (s) => s.split('\n').find((l) => l.includes('Prefer high relative-strength names'));
    expect(neutralLine(lit)).toBe(neutralLine(dark));
  });

  it('A15: a QUARANTINED surface renders NOTHING — output byte-equal to dark', () => {
    flagState.compiledIdentity = true;
    const lit = buildStrategyUserPrompt(draftAgent({ ...COMPAT, quarantined: true }), null);
    flagState.compiledIdentity = false;
    const dark = buildStrategyUserPrompt(draftAgent({ ...COMPAT, quarantined: true }), null);
    expect(lit).toBe(dark);
  });

  it('A15: an UNBLOCKED illegal pair in the surface renders NOTHING (fail closed, never partial)', () => {
    flagState.compiledIdentity = true;
    const tampered = { entries: [...COMPAT.entries, { ruleId: 'rd-banned', verdict: 'core_conflict', advisory: null, narrowedParams: null }] };
    const out = buildStrategyUserPrompt(draftAgent(tampered), null);
    expect(countOf(out, 'Advisory:')).toBe(0);
  });

  it('dark by ABSENCE: no compositionCompat field (production today) renders zero advisory bytes even with the flag on', () => {
    flagState.compiledIdentity = true;
    const out = buildStrategyUserPrompt(draftAgent(null), null);
    expect(countOf(out, 'Advisory:')).toBe(0);
  });
});

describe('activation-state goldens — eval assembler (buildAgentIdentityBlock)', () => {
  it('A13: exactly once on the rule\'s own line, BEFORE the category tag; A14: neutral line byte-identical to dark', () => {
    flagState.compiledIdentity = true;
    const lit = buildAgentIdentityBlock(evalBattle(COMPAT));
    expect(countOf(lit, `— Advisory: ${ADVISORY}`)).toBe(1);
    expect(lit).toContain(`Cap any single sector at 60% of portfolio — Advisory: ${ADVISORY} [Allocation]`);
    flagState.compiledIdentity = false;
    const dark = buildAgentIdentityBlock(evalBattle(COMPAT));
    expect(countOf(dark, 'Advisory:')).toBe(0);
    const neutralLine = (s) => s.split('\n').find((l) => l.includes('Prefer high relative-strength names'));
    expect(neutralLine(lit)).toBe(neutralLine(dark));
  });

  it('A15: a quarantined manifest slice renders nothing — byte-equal to dark', () => {
    flagState.compiledIdentity = true;
    const lit = buildAgentIdentityBlock(evalBattle({ ...COMPAT, quarantined: true }));
    flagState.compiledIdentity = false;
    const dark = buildAgentIdentityBlock(evalBattle({ ...COMPAT, quarantined: true }));
    expect(lit).toBe(dark);
  });

  it('dark by ABSENCE: a battle without the manifest slice (every battle today) renders zero advisory bytes', () => {
    flagState.compiledIdentity = true;
    const out = buildAgentIdentityBlock(evalBattle(null));
    expect(countOf(out, 'Advisory:')).toBe(0);
  });
});

describe('B4-TRAIT invariant (c) — trait-hosted tensions RENDER their advisories, end to end', () => {
  it('trait doc → unified-projection compile → manifest slice → eval assembler line carries the advisory EXACTLY once', async () => {
    flagState.compiledIdentity = true;
    const { buildProjectedCompileInputs } = await import('./compileOnSettingsChange.js');
    const { compileBuild } = await import('./compileBuild.js');
    const { buildResolvedAgentManifest } = await import('./resolvedAgentManifest.js');
    const { getGameModePolicy, computeGameModePolicyHash } = await import('./gameModePolicy.js');
    const { FIXTURE_NOW, fixtureVersions, fixturePlatformGuardrails } = await import('./compilerFixtures.js');
    const { ARCHETYPE_IDENTITY_VERSION } = await import('./archetypeVersionConstants.js');

    const traitDoc = {
      id: 'td-e2e', sourceRef: 'tv-01', traitId: 'trait-trend-rider',
      paramValues: { low: 50, high: 70, weak: 40, stretched: 77 },
      params: { low: {}, high: {}, weak: {}, stretched: {} },
    };
    const projected = buildProjectedCompileInputs({
      agent: { equippedTraits: [{ traitId: 'trait-trend-rider' }] },
      ruleDocs: [traitDoc], allBundles: [], archetype: 'momentum_chaser',
    });
    const build = compileBuild({
      archetypeDefinition: { codeId: 'momentum_chaser', identityVersion: ARCHETYPE_IDENTITY_VERSION, identityHash: 'x' },
      userBuildDelta: {
        agentId: 'fx', settingsRev: 7, parentArchetypeId: 'momentum_chaser', parentIdentityVersion: ARCHETYPE_IDENTITY_VERSION,
        equippedBundles: [], ruleMetadata: { 'td-e2e': { intendedMode: 'behavioral_guidance', copyClass: 'advisory', receiptTag: 't', modes: 'clash' } },
        compatCells: projected.compatCells, projectedRules: projected.projectedRules, projectedRulesHash: projected.projectedRulesHash,
        userGuardrails: [],
      },
      platformGuardrails: fixturePlatformGuardrails,
      gameModePolicy: getGameModePolicy('clash'), gameModePolicyHash: computeGameModePolicyHash('clash'),
      versions: fixtureVersions, now: FIXTURE_NOW,
    });
    const manifest = buildResolvedAgentManifest({
      agentData: { id: 'fx', archetype: 'momentum_chaser', settingsRev: 7, config: {}, equippedBundleIds: [] },
      compiledBuild: build, // rev 7 == agentData.settingsRev — the manifest's rev-match gate runs for real
      equippedWatchlist: null, gameMode: 'clash', now: FIXTURE_NOW,
    });
    expect(manifest.compositionCompat.entries.some((e) => e.ruleId === 'td-e2e' && e.advisory)).toBe(true);

    const battle = {
      agentContext: {
        name: 'Fixture', archetype: 'momentum_chaser',
        activeRules: [{ ruleId: 'td-e2e', text: 'Buy the pullback within the RSI band', category: 'strategy', hardness: 'soft' }],
      },
      resolvedAgentManifest: manifest,
    };
    const out = buildAgentIdentityBlock(battle);
    const advisory = manifest.compositionCompat.entries.find((e) => e.ruleId === 'td-e2e').advisory;
    expect(out.split(`— Advisory: ${advisory}`).length - 1).toBe(1); // exactly once (A13, trait channel)
    // mutation row (audit): severing the trait channel in projectHostedRuleDocs
    // empties projected.compatVerdicts of td-e2e → the slice loses the entry →
    // this row fails at the manifest assertion above.
  });
});
