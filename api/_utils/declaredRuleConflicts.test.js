// api/_utils/declaredRuleConflicts.test.js
// Exit-Behavior Rebalance Tier 2, Ask 2 (rescoped) — R8 / Fable F10: the
// SX-04 × mb-08 combination is DECLARED at equip time, never discovered in a
// battle. The deterministic profit-target executor wins over mb-08's
// prompt-delegated hold veto; this pure detector names the pair so the
// compiler can carry it on the CompiledBuild.
//
// Pure module: no I/O, no flag reads, no clock — identical inputs produce
// identical output. RED-FIRST: written before the module existed.

import { describe, it, expect } from 'vitest';
import {
  detectDeclaredRuleConflicts,
  DECLARED_CONFLICT_CODES,
  HOLD_VETO_SOURCE_REFS,
  resolveDeclaredProfitTargetPct,
} from './declaredRuleConflicts.js';
// Parity tripwire (/code-review CR-4): the fenced assembler's SX-04 render
// cites the ENGINE's X through its own resolver; the declaration must cite
// the same number, so the two resolvers are held equal through the render
// (no fenced export needed). Unmocked import = dependency-surface guard.
import { buildAgentIdentityBlock } from './agentEvalPromptAssembly.js';
import { makeBattle, FLAT6_GAME_MODE } from './__fixtures__/ask1PromptFixtures.js';
// NOT pinned: the executor flag's live value is read as a behavior branch
// (pinning it here would couple Ask 3's flip to this suite — the
// leagueBattleviewFlags.test.js lesson the flag-pin guard enforces).
import { PROFIT_TARGET_EXECUTOR_ENABLED } from '../../src/config/featureFlags.js';

const TARGET = { type: 'profitTarget', value: 15, unit: '%', enforcement: 'hard' };
const STOP = { type: 'stopLoss', value: 5, unit: '%', enforcement: 'hard' };
const MB08_BUNDLE = { id: 'doc-mb08', sourceRef: 'mb-08', host: 'bundle', hostRef: 'bundle-1' };
const RSI_BUNDLE = { id: 'doc-rsi', sourceRef: 'tech-rsi-oversold', host: 'bundle', hostRef: 'bundle-1' };

describe('vocabulary', () => {
  it('names the one declared code and the hold-veto template set', () => {
    expect(DECLARED_CONFLICT_CODES.PROFIT_TARGET_VS_HOLD_VETO).toBe('profit_target_vs_hold_veto');
    expect(HOLD_VETO_SOURCE_REFS).toEqual(['mb-08']);
    expect(Object.isFrozen(HOLD_VETO_SOURCE_REFS)).toBe(true);
  });
});

describe('the enforced target value mirrors the engine (keep-LAST, Math.abs, non-positive never fires)', () => {
  it('resolves the last profitTarget entry, absolute value', () => {
    expect(resolveDeclaredProfitTargetPct([TARGET])).toBe(15);
    expect(resolveDeclaredProfitTargetPct([TARGET, { type: 'profitTarget', value: -20 }])).toBe(20);
  });
  it('null when absent, non-numeric, zero, or not an array', () => {
    expect(resolveDeclaredProfitTargetPct([STOP])).toBeNull();
    expect(resolveDeclaredProfitTargetPct([{ type: 'profitTarget', value: '15' }])).toBeNull();
    expect(resolveDeclaredProfitTargetPct([{ type: 'profitTarget', value: 0 }])).toBeNull();
    expect(resolveDeclaredProfitTargetPct(null)).toBeNull();
    expect(resolveDeclaredProfitTargetPct(undefined)).toBeNull();
  });
});

describe('detectDeclaredRuleConflicts — the pair', () => {
  it('no profit target → nothing to declare, whatever mb-08 is equipped', () => {
    expect(detectDeclaredRuleConflicts({ userGuardrails: [STOP], rules: [MB08_BUNDLE], equippedTraits: [{ traitId: 'trait-patient-holder' }] })).toEqual([]);
    expect(detectDeclaredRuleConflicts({ userGuardrails: [], rules: [MB08_BUNDLE] })).toEqual([]);
    expect(detectDeclaredRuleConflicts({})).toEqual([]);
  });

  it('a profit target with no mb-08 anywhere → nothing to declare', () => {
    expect(detectDeclaredRuleConflicts({ userGuardrails: [TARGET], rules: [RSI_BUNDLE], equippedTraits: [{ traitId: 'trait-trend-rider' }] })).toEqual([]);
  });

  it('bundle-hosted mb-08 × profit target → one declaration, executor wins, the engine value cited', () => {
    const out = detectDeclaredRuleConflicts({ userGuardrails: [TARGET], rules: [RSI_BUNDLE, MB08_BUNDLE] });
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({
      code: 'profit_target_vs_hold_veto',
      guardrailType: 'profitTarget',
      targetPct: 15,
      ruleId: 'doc-mb08',
      sourceRef: 'mb-08',
      host: 'bundle',
      hostRef: 'bundle-1',
      basis: 'rule_doc',
      resolution: 'executor_wins',
      message: out[0].message,
    });
    expect(out[0].message).toContain('15%');
    expect(out[0].message).toContain('mb-08');
    expect(out[0].message).toMatch(/fires deterministically/);
    expect(out[0].message).toMatch(/discretionary/);
  });

  it('cites the engine-mirrored value on a two-entry / negative-value guardrail doc', () => {
    const out = detectDeclaredRuleConflicts({ userGuardrails: [TARGET, { type: 'profitTarget', value: -20 }], rules: [MB08_BUNDLE] });
    expect(out[0].targetPct).toBe(20);
    expect(out[0].message).toContain('20%');
  });

  it('projection-hosted mb-08 (PR 3.5 unified projection) carries its host provenance', () => {
    const out = detectDeclaredRuleConflicts({
      userGuardrails: [TARGET],
      rules: [{ id: 'doc-mb08-t', sourceRef: 'mb-08', host: 'projection', hostRef: 'trait-patient-holder' }],
    });
    expect(out).toHaveLength(1);
    expect(out[0].host).toBe('projection');
    expect(out[0].hostRef).toBe('trait-patient-holder');
    expect(out[0].basis).toBe('rule_doc');
  });

  it('trait-hosted mb-08, resolved by TRAIT DEFINITION (traitLibrary), when no rule doc is visible (legacy compile mode)', () => {
    const out = detectDeclaredRuleConflicts({ userGuardrails: [TARGET], rules: [], equippedTraits: [{ traitId: 'trait-let-winners-run' }, { traitId: 'trait-trend-rider' }] });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      code: 'profit_target_vs_hold_veto',
      sourceRef: 'mb-08',
      host: 'trait',
      hostRef: 'trait-let-winners-run',
      ruleId: 'trait-let-winners-run:mb-08',
      basis: 'trait_definition',
      resolution: 'executor_wins',
    });
    expect(out[0].message).toContain('by trait definition');
  });

  it('both mb-08 traits declare, each on its own host; an unknown trait id is ignored', () => {
    const out = detectDeclaredRuleConflicts({ userGuardrails: [TARGET], rules: [], equippedTraits: [{ traitId: 'trait-patient-holder' }, { traitId: 'trait-let-winners-run' }, { traitId: 'trait-nope' }, null] });
    expect(out.map((c) => c.hostRef).sort()).toEqual(['trait-let-winners-run', 'trait-patient-holder']);
  });

  it('ONE declaration per pairing: a trait already declared through its own projection-hosted doc is not re-declared by definition (CR-3)', () => {
    const out = detectDeclaredRuleConflicts({
      userGuardrails: [TARGET],
      rules: [{ id: 'doc-mb08-t', sourceRef: 'mb-08', host: 'projection', hostRef: 'trait-let-winners-run' }],
      equippedTraits: [{ traitId: 'trait-let-winners-run' }],
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ host: 'projection', hostRef: 'trait-let-winners-run', ruleId: 'doc-mb08-t', basis: 'rule_doc' });
  });

  it('a bundle-hosted mb-08 and an mb-08 trait are two distinct pairings (two hosts, two declarations)', () => {
    const out = detectDeclaredRuleConflicts({ userGuardrails: [TARGET], rules: [MB08_BUNDLE], equippedTraits: [{ traitId: 'trait-let-winners-run' }] });
    expect(out.map((c) => `${c.host}:${c.hostRef}`).sort()).toEqual(['bundle:bundle-1', 'trait:trait-let-winners-run']);
  });

  it('is pure and deterministic: identical input → deep-equal output; inputs never mutated', () => {
    const input = { userGuardrails: [TARGET], rules: [MB08_BUNDLE], equippedTraits: [{ traitId: 'trait-patient-holder' }] };
    const snapshot = JSON.stringify(input);
    const a = detectDeclaredRuleConflicts(input);
    const b = detectDeclaredRuleConflicts(input);
    expect(a).toEqual(b);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});

describe('parity with the fenced assembler\'s SX-04 render (CR-4 tripwire — one engine number, two resolvers)', () => {
  const CASES = [
    [[{ type: 'profitTarget', value: 15 }], 15],
    [[{ type: 'profitTarget', value: 15 }, { type: 'profitTarget', value: -20 }], 20],
    [[{ type: 'profitTarget', value: 0 }], null],
    [[{ type: 'stopLoss', value: 5 }], null],
    [[], null],
  ];
  it.each(CASES)('guardrails %j → the trailer cites %s exactly as the declaration would', (guardrails, expected) => {
    const battle = makeBattle(FLAT6_GAME_MODE);
    battle.agentContext.deployedGuardrails = guardrails;
    const trailer = buildAgentIdentityBlock(battle);
    const declared = resolveDeclaredProfitTargetPct(guardrails);
    expect(declared).toBe(expected);
    // Behavior branch on the LIVE executor flag (never a pin): the SX-04
    // enforcement-true render exists only while the executor is live (R10);
    // with it dark the rule's own text renders and there is nothing to mirror.
    if (!PROFIT_TARGET_EXECUTOR_ENABLED) {
      expect(trailer).not.toContain("the user's target is");
      return;
    }
    if (declared === null) {
      expect(trailer).not.toContain("the user's target is");
    } else {
      expect(trailer).toContain(`the user's target is ${declared}%`);
    }
  });
});
