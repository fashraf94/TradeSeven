// api/_utils/compositionAdvisoryRender.activation.test.js
//
// Composition PR 3 — the ACTIVATION-STATE golden set (spec §7 row 3, dual
// goldens). These rows run under the epoch-simulating harness: the
// compiled-identity flag is FORCED ON via the config mock and the compat
// surface is a fixture of the activated CompiledBuild slice. They are the
// goldens PR 4 PROMOTES when the flag genuinely flips — until then the DARK
// goldens (p4Equivalence battery, ruleCompatInvariantR, hardSoftOverride
// parity — all asserted in this PR's CI unchanged) remain the production
// contract.
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
