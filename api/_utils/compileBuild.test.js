// api/_utils/compileBuild.test.js
//
// Archetype Architecture Phase 2 (P2.3) — exhaustive compiler tests:
// every §5.4 illegal pair, every §5.5 guardrailBinding mismatch case, the
// strictest-wins merge matrix, A-2 mode scoping, the founder-ruled
// bundleContentHash field set, purity/determinism, and the §5.6 activation
// gate (red against the live corpus BY DESIGN, green against a complete
// fixture corpus).
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the activation-gate section's
// REAL imports pull the live corpus + compat map (api→src) through the Node
// test env. NEVER mock them — today's red gate is the asserted truth.

import { describe, it, expect } from 'vitest';

import {
  compileBuild,
  computeBundleContentHash,
  matchSupportedShape,
  SUPPORTED_GUARDRAIL_SHAPES,
  PROFIT_TARGET_GUARDRAIL_SHAPE,
  BINDING_DESCRIPTOR_FIELDS,
} from './compileBuild.js';
import { PROFIT_TARGET_EXECUTOR_ENABLED } from '../../src/config/featureFlags.js';
import { validateCompiledBuild } from './archetypeBuildSchemas.js';
import { getGameModePolicy, computeGameModePolicyHash } from './gameModePolicy.js';
import { TIERED_GAME_MODE, FLAT6_GAME_MODE } from '../../src/constants/agentGameModes.js';
import {
  FIXTURE_NOW,
  fixtureArchetypeDefinition,
  fixtureVersions,
  fixturePlatformGuardrails,
  stopLossRule,
  advisoryRule,
  leanTieBreakerRule,
  tensionRule,
  coreConflictRule,
  buildDelta,
} from './compilerFixtures.js';
import { checkActivationGate } from './activationGate.js';

const TIERED_POLICY = getGameModePolicy(TIERED_GAME_MODE);
const TIERED_POLICY_HASH = computeGameModePolicyHash(TIERED_GAME_MODE);

function compile(delta, overrides = {}) {
  return compileBuild({
    archetypeDefinition: fixtureArchetypeDefinition,
    userBuildDelta: delta,
    platformGuardrails: fixturePlatformGuardrails,
    gameModePolicy: TIERED_POLICY,
    gameModePolicyHash: TIERED_POLICY_HASH,
    versions: fixtureVersions,
    now: FIXTURE_NOW,
    ...overrides,
  });
}

const errorCodes = (build) => build.validation.errors.map((e) => e.code);

describe('compileBuild — happy path (§4.4 + A-2)', () => {
  it('compiles a complete fixture build that passes the §4.4 validator', () => {
    const build = compile(buildDelta([stopLossRule(), advisoryRule(), leanTieBreakerRule()]));
    expect(build.validation).toEqual({ pass: true, errors: [] });
    const res = validateCompiledBuild(build);
    expect(res.errors).toEqual([]);
    expect(res.valid).toBe(true);
    expect(build.compiledBuildId).toBe('fx-agent_baggerbomb_agent_rev7');
    expect(build.buildVersion).toBe(7); // A-3: the minted settingsRev IS the build revision
    expect(build.sourceRevisionVector.settingsRev).toBe(7);
    expect(build.sourceRevisionVector.gameMode).toBe(TIERED_GAME_MODE);
    expect(build.sourceRevisionVector.gameModePolicyHash).toBe(TIERED_POLICY_HASH);
  });

  it("maps the live map's 'neutral' input class to the §4.4 'compatible' verdict token", () => {
    const build = compile(buildDelta([advisoryRule({ ruleId: 'fx-n', state: 'neutral' })]));
    expect(build.compatVerdicts).toHaveLength(1);
    expect(build.compatVerdicts[0].verdict).toBe('compatible');
  });

  it('derives deterministic enforcement ONLY for an exact-matched binding; advisory otherwise (§5.3)', () => {
    const build = compile(buildDelta([stopLossRule(), advisoryRule()]));
    const byId = Object.fromEntries(build.compatVerdicts.map((v) => [v.ruleId, v]));
    expect(byId['fx-stop-loss'].effectiveEnforcement).toBe('deterministic');
    expect(byId['fx-stop-loss'].compiledToGuardrail).toBe(true);
    expect(byId['fx-stop-loss'].renderExclusion).toBe('system_enforcement_notice'); // §5.5 no double render
    expect(byId['fx-advisory'].effectiveEnforcement).toBe('prompt_advisory');
    expect(byId['fx-advisory'].compiledToGuardrail).toBeUndefined();
  });

  it('is deterministic: identical inputs produce identical contentHash', () => {
    const a = compile(buildDelta([stopLossRule(), advisoryRule()]));
    const b = compile(buildDelta([stopLossRule(), advisoryRule()]));
    expect(a.contentHash).toBe(b.contentHash);
  });
});

describe('§5.4 legal-combination matrix — every illegal pair rejected at compile', () => {
  it('tie_breaker intendedMode on non-lean content → illegal', () => {
    const r = leanTieBreakerRule();
    delete r.metadata.contentClass;
    expect(errorCodes(compile(buildDelta([r])))).toContain('illegal_pair_tie_breaker_non_lean');
    const r2 = leanTieBreakerRule();
    r2.metadata.contentClass = 'rule';
    expect(errorCodes(compile(buildDelta([r2])))).toContain('illegal_pair_tie_breaker_non_lean');
  });

  it("deterministic × missingDataFallback 'ignore_rule' → illegal (failing open is prohibited)", () => {
    const r = stopLossRule();
    r.metadata.missingDataFallback = 'ignore_rule';
    expect(errorCodes(compile(buildDelta([r])))).toContain('illegal_fallback_for_deterministic');
  });

  it('deterministic × missing fallback → illegal; abstain and block are the only legal tokens', () => {
    const missing = stopLossRule();
    delete missing.metadata.missingDataFallback;
    expect(errorCodes(compile(buildDelta([missing])))).toContain('illegal_fallback_for_deterministic');

    const weird = stopLossRule();
    weird.metadata.missingDataFallback = 'assume_fine';
    expect(errorCodes(compile(buildDelta([weird])))).toContain('illegal_fallback_for_deterministic');

    for (const legal of ['abstain', 'block']) {
      const ok = stopLossRule();
      ok.metadata.missingDataFallback = legal;
      expect(compile(buildDelta([ok])).validation.pass, `fallback ${legal}`).toBe(true);
    }
  });

  it("advisory × 'ignore_rule' is LEGAL; an unknown advisory fallback token is not", () => {
    expect(compile(buildDelta([advisoryRule()])).validation.pass).toBe(true);
    const bad = advisoryRule();
    bad.metadata.missingDataFallback = 'assume_fine';
    expect(errorCodes(compile(buildDelta([bad])))).toContain('unknown_fallback');
  });

  it('tension without an authored treatment → illegal (§5.6: never defaulted)', () => {
    const r = tensionRule();
    delete r.cell.treatment;
    expect(errorCodes(compile(buildDelta([r])))).toContain('tension_missing_treatment');
  });

  it('tension + advisoryDowngrade FORCES prompt_advisory regardless of a valid binding, with advisory copyClass', () => {
    const build = compile(buildDelta([tensionRule({ treatment: 'advisoryDowngrade' })]));
    expect(build.validation.pass).toBe(true);
    const v = build.compatVerdicts[0];
    expect(v.verdict).toBe('tension');
    expect(v.treatment).toBe('advisoryDowngrade');
    expect(v.effectiveEnforcement).toBe('prompt_advisory');
    expect(v.copyClass).toBe('advisory'); // §5.3: never presented as enforced
    expect(build.effectiveGuardrailsPreview.perType).toEqual({}); // nothing compiled
    expect(build.renderedTensionCandidates).toHaveLength(1); // DR-13 recording feed
  });

  it('a non-downgrade tension treatment compiles normally and records the pair', () => {
    const build = compile(buildDelta([tensionRule({ treatment: 'renderWithSubordination' })]));
    expect(build.validation.pass).toBe(true);
    expect(build.compatVerdicts[0].effectiveEnforcement).toBe('deterministic');
    expect(build.renderedTensionCandidates[0].treatment).toBe('renderWithSubordination');
  });

  it('core_conflict never compiles: blocked control, no guardrail, no error (§5.2)', () => {
    const build = compile(buildDelta([coreConflictRule()]));
    expect(build.validation.pass).toBe(true);
    expect(build.blockedControls).toEqual([
      expect.objectContaining({ ruleId: 'fx-core-conflict', blockedBy: 'core_conflict', zone1Ref: 'TF-Z1-BUY-STRENGTH' }),
    ]);
    expect(build.compatVerdicts[0]).toMatchObject({ verdict: 'core_conflict', blocked: true });
    expect(build.effectiveGuardrailsPreview.perType).toEqual({});
  });

  it('missing base metadata (each §5.6 field) and unknown intendedMode → illegal', () => {
    for (const field of ['intendedMode', 'copyClass', 'receiptTag']) {
      const r = advisoryRule();
      delete r.metadata[field];
      expect(errorCodes(compile(buildDelta([r]))), `missing ${field}`).toContain('metadata_missing');
    }
    const noMeta = advisoryRule({ ruleId: 'fx-none' });
    const delta = buildDelta([noMeta]);
    delete delta.ruleMetadata['fx-none'];
    expect(errorCodes(compile(delta))).toContain('metadata_missing');

    const badMode = advisoryRule();
    badMode.metadata.intendedMode = 'hard';
    expect(errorCodes(compile(buildDelta([badMode])))).toContain('unknown_intended_mode');
  });

  it('deterministic × missing detectorSource → illegal (§5.6 deterministic tier)', () => {
    const r = stopLossRule();
    delete r.metadata.detectorSource;
    expect(errorCodes(compile(buildDelta([r])))).toContain('metadata_missing');
  });

  it('a missing compat cell — including live-map fallthrough — is absence, not a verdict (A-4)', () => {
    const noCell = advisoryRule({ ruleId: 'fx-nocell' });
    const delta = buildDelta([noCell]);
    delete delta.compatCells['fx-nocell'];
    expect(errorCodes(compile(delta))).toContain('compat_cell_missing');

    const fallthrough = advisoryRule({ ruleId: 'fx-fall' });
    fallthrough.cell = { state: 'neutral', via: 'fallthrough' };
    expect(errorCodes(compile(buildDelta([fallthrough])))).toContain('compat_cell_missing');
  });

  it('exact-parent rule (§3.3): version or archetype mismatch fails explicitly, no silent fallback', () => {
    const stale = compile(buildDelta([advisoryRule()], { parentIdentityVersion: 99 }));
    expect(errorCodes(stale)).toContain('parent_version_mismatch');
    const wrongParent = compile(buildDelta([advisoryRule()], { parentArchetypeId: 'contrarian' }));
    expect(errorCodes(wrongParent)).toContain('parent_archetype_mismatch');
  });

  it('unknown game mode cannot compile (A-2)', () => {
    const build = compile(buildDelta([advisoryRule()]), { gameModePolicy: null, gameModePolicyHash: null });
    expect(errorCodes(build)).toContain('unknown_game_mode');
    expect(build.validation.pass).toBe(false);
  });

  it('a season-only rule in a clash-mode compile is blocked by the ruleModeGate (§1.3)', () => {
    const r = advisoryRule({ ruleId: 'fx-season' });
    r.metadata.modes = 'season';
    const build = compile(buildDelta([r]));
    expect(build.validation.pass).toBe(true);
    expect(build.blockedControls).toEqual([
      expect.objectContaining({ ruleId: 'fx-season', blockedBy: 'ruleModeGate' }),
    ]);
  });
});

describe('§5.5 guardrailBinding — every mismatch case stays prompt_advisory (no lossy coercion)', () => {
  it.each(BINDING_DESCRIPTOR_FIELDS)('a binding differing in %s alone does not compile', (field) => {
    const r = stopLossRule();
    r.metadata.guardrailBinding = { ...r.metadata.guardrailBinding, [field]: 'something_else' };
    // Advisory-legal fallback so the ONLY divergence under test is the binding.
    r.metadata.missingDataFallback = 'abstain';
    const build = compile(buildDelta([r]));
    expect(build.validation.pass).toBe(true);
    const v = build.compatVerdicts[0];
    expect(v.effectiveEnforcement).toBe('prompt_advisory');
    expect(v.compiledToGuardrail).toBeUndefined();
    expect(v.bindingMismatch).toBe(field === 'type' ? 'unsupported_type:something_else' : `mismatch:${field}`);
    expect(build.effectiveGuardrailsPreview.perType).toEqual({});
  });

  it('the engine-no-op type maxPosition is NOT a supported shape (display-agreement §9)', () => {
    expect(SUPPORTED_GUARDRAIL_SHAPES.maxPosition).toBeUndefined();
    expect(matchSupportedShape({ type: 'maxPosition' })).toEqual({ matched: false, reason: 'unsupported_type:maxPosition' });
  });

  it('profitTarget tracks its executor flag — absent while dark, present-and-matching once live (Ask 3 F11: same §9 rule, both directions)', () => {
    // Behavior-branched so the Ask 1 flip PR does not have to reconcile this
    // pin: the assertion states the COUPLING, not the constant.
    if (PROFIT_TARGET_EXECUTOR_ENABLED) {
      expect(SUPPORTED_GUARDRAIL_SHAPES.profitTarget).toEqual(PROFIT_TARGET_GUARDRAIL_SHAPE);
    } else {
      expect(SUPPORTED_GUARDRAIL_SHAPES.profitTarget).toBeUndefined();
      expect(matchSupportedShape({ type: 'profitTarget' })).toEqual({ matched: false, reason: 'unsupported_type:profitTarget' });
    }
  });

  it('an absent binding is simply advisory — eligible-but-unbound is not an error', () => {
    const build = compile(buildDelta([advisoryRule()]));
    expect(build.validation.pass).toBe(true);
    expect(build.compatVerdicts[0].effectiveEnforcement).toBe('prompt_advisory');
  });

  it('a matched binding without valueParamKey, or pointing at a non-numeric param, is an authoring error', () => {
    const noKey = stopLossRule();
    delete noKey.metadata.guardrailBinding.valueParamKey;
    expect(errorCodes(compile(buildDelta([noKey])))).toContain('binding_missing_value_param');

    const badKey = stopLossRule();
    badKey.metadata.guardrailBinding = { ...badKey.metadata.guardrailBinding, valueParamKey: 'nope' };
    expect(errorCodes(compile(buildDelta([badKey])))).toContain('binding_value_unresolved');
  });
});

describe('§5.5 strictest-wins merge → §4.4 mandatory preview (R1-12)', () => {
  const user = (value) => [{ type: 'stopLoss', value, enforcement: 'hard' }];

  it('rule tighter than user: rule governs; unequip reverts to the user value', () => {
    const build = compile(buildDelta([stopLossRule({ pct: 5 })], { userGuardrails: user(8) }));
    expect(build.effectiveGuardrailsPreview.perType.stopLoss).toEqual({
      requestedByUser: 8,
      derivedFromRules: [{ ruleId: 'fx-stop-loss', value: 5, binding: expect.objectContaining({ type: 'stopLoss' }) }],
      effective: 5,
      governingSource: 'rule:fx-stop-loss',
      onUnequipBehavior: 'reverts to user value 8',
    });
  });

  it('user tighter than rule: user governs; unequip changes nothing', () => {
    const p = compile(buildDelta([stopLossRule({ pct: 5 })], { userGuardrails: user(3) }))
      .effectiveGuardrailsPreview.perType.stopLoss;
    expect(p.effective).toBe(3);
    expect(p.governingSource).toBe('user');
    expect(p.onUnequipBehavior).toBe('unchanged (user value governs)');
  });

  it('tie resolves to the user (equal value: removal changes nothing)', () => {
    const p = compile(buildDelta([stopLossRule({ pct: 5 })], { userGuardrails: user(5) }))
      .effectiveGuardrailsPreview.perType.stopLoss;
    expect(p.governingSource).toBe('user');
  });

  it('rule-only type: governs with reverts-to-none; user source is never mutated (R1-10)', () => {
    const guardrails = [];
    const build = compile(buildDelta([stopLossRule({ pct: 5 })], { userGuardrails: guardrails }));
    const p = build.effectiveGuardrailsPreview.perType.stopLoss;
    expect(p.requestedByUser).toBeNull();
    expect(p.governingSource).toBe('rule:fx-stop-loss');
    expect(p.onUnequipBehavior).toBe('reverts to none (no user guardrail of this type)');
    expect(guardrails).toEqual([]); // input untouched
  });

  it('user-only type still gets the full mandatory preview row', () => {
    const p = compile(buildDelta([advisoryRule()], { userGuardrails: user(6) }))
      .effectiveGuardrailsPreview.perType.stopLoss;
    expect(p).toEqual({
      requestedByUser: 6,
      derivedFromRules: [],
      effective: 6,
      governingSource: 'user',
      onUnequipBehavior: 'unchanged (user value governs)',
    });
  });

  it('two rules of the same binding: strictest of all sources wins; both appear in derivedFromRules', () => {
    const p = compile(buildDelta(
      [stopLossRule({ ruleId: 'fx-a', pct: 6 }), stopLossRule({ ruleId: 'fx-b', pct: 4 })],
      { userGuardrails: user(8) }
    )).effectiveGuardrailsPreview.perType.stopLoss;
    expect(p.derivedFromRules).toHaveLength(2);
    expect(p.effective).toBe(4);
    expect(p.governingSource).toBe('rule:fx-b');
  });
});

describe('A-2 mode scoping + A-3/founder-ruled bundleContentHash', () => {
  it('the same delta compiled under two modes yields two distinct builds (id, vector, contentHash)', () => {
    const delta = buildDelta([advisoryRule()]);
    const tiered = compile(delta);
    const flat6 = compile(delta, {
      gameModePolicy: getGameModePolicy(FLAT6_GAME_MODE),
      gameModePolicyHash: computeGameModePolicyHash(FLAT6_GAME_MODE),
    });
    expect(tiered.gameMode).toBe(TIERED_GAME_MODE);
    expect(flat6.gameMode).toBe(FLAT6_GAME_MODE);
    expect(tiered.compiledBuildId).not.toBe(flat6.compiledBuildId);
    expect(tiered.contentHash).not.toBe(flat6.contentHash);
    expect(tiered.sourceRevisionVector.gameModePolicyHash).not.toBe(flat6.sourceRevisionVector.gameModePolicyHash);
  });

  it('bundleContentHash covers ruleIds/ruleSnapshots/ruleHardness/dimensionValues — ruleHardness stays IN while the field exists (founder ruling)', () => {
    const base = { bundleId: 'b', ruleIds: ['r1'], ruleSnapshots: [{ id: 'r1', paramValues: { t: 5 } }] };
    const h0 = computeBundleContentHash(base);
    expect(computeBundleContentHash({ ...base, ruleHardness: { r1: 'hard' } })).not.toBe(h0);
    expect(computeBundleContentHash({ ...base, dimensionValues: { risk: 1 } })).not.toBe(h0);
    expect(computeBundleContentHash({ ...base, ruleSnapshots: [{ id: 'r1', paramValues: { t: 6 } }] })).not.toBe(h0);
  });

  it('compileConfidence/compileTransparency are telemetry — hash-exempt (a transparency persist never invalidates a build)', () => {
    const base = { bundleId: 'b', ruleIds: ['r1'], ruleSnapshots: [{ id: 'r1' }] };
    const h0 = computeBundleContentHash(base);
    expect(computeBundleContentHash({ ...base, compileConfidence: 0.93 })).toBe(h0);
    expect(computeBundleContentHash({ ...base, compileTransparency: { warnings: ['x'] } })).toBe(h0);
  });
});

describe('§5.6 activation gate (A-4 amended)', () => {
  it('FAILS against the live metadata-less corpus — the designed Phase-2 state', () => {
    const gate = checkActivationGate();
    expect(gate.passes).toBe(false);
    // No template carries the base fields yet (census Map 3A).
    expect(gate.counts.missingBaseMetadata).toBe(gate.counts.templatesTotal);
    expect(gate.counts.templatesTotal).toBeGreaterThan(100);
    // The live compat map leaves unclassified cells to fallthrough — absence.
    expect(gate.counts.missingCompatCells).toBeGreaterThan(0);
    expect(gate.counts.compatCellsRequired).toBe(gate.counts.equippableTemplates * 6);
  });

  it('PASSES against a complete fixture corpus — the gate can go green when Phases 3–4 author metadata', () => {
    const templates = [
      { id: 'fx-1', modes: 'both', intendedMode: 'required_consideration', copyClass: 'advisory', receiptTag: 't1' },
      {
        id: 'fx-2', modes: 'clash', intendedMode: 'execution_constraint', copyClass: 'enforced', receiptTag: 't2',
        guardrailBinding: { type: 'stopLoss' }, detectorSource: 'guardrail_engine', missingDataFallback: 'abstain',
      },
      // Season-only: excluded from the launch compat matrix by the mode gate.
      { id: 'fx-3', modes: 'season' },
    ];
    const gate = checkActivationGate({
      templates,
      archetypes: ['momentum_chaser', 'contrarian'],
      getCompat: () => ({ state: 'neutral', via: 'fixture' }),
    });
    expect(gate.counts.missingBaseMetadata).toBe(1); // fx-3 (unequippable, still base-tier counted: 143/143 is all-or-nothing)
    expect(gate.counts.equippableTemplates).toBe(2);
    expect(gate.passes).toBe(false); // fx-3's base metadata is still required

    templates[2] = { ...templates[2], intendedMode: 'scoring_modifier', copyClass: 'advisory', receiptTag: 't3' };
    const green = checkActivationGate({
      templates,
      archetypes: ['momentum_chaser', 'contrarian'],
      getCompat: () => ({ state: 'neutral', via: 'fixture' }),
    });
    expect(green.passes).toBe(true);
    expect(green.counts.missingCompatCells).toBe(0);
  });
});
