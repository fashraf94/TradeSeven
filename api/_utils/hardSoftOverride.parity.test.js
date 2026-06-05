// Phase 3 — authored hard/soft override: PROMPT PARITY contract.
//
// The founder's hard requirement: with NO override authored, the assembled
// prompt from BOTH server assemblies (strategy + eval/swap) and the deploy-time
// projection must be byte-identical to pre-Phase-3 behavior — calibration is
// provably unchanged except where a user explicitly overrides a rule.
//
// The expected ("golden") strings below are hand-specified independently of the
// assembler internals, so a regression in the split logic is caught by the exact
// byte compare AND by the structural / override-movement assertions.

import { describe, it, expect } from 'vitest';
import { buildStrategyUserPrompt } from './agentPromptAssembly.js';
import { buildAgentIdentityBlock } from './agentEvalPromptAssembly.js';
import { projectActiveRules } from './projectActiveRules.js';

// A representative loadout spanning both hard categories (risk, allocation) and
// both soft categories (technical, fundamental), in a fixed order. No hardness
// field set — i.e., exactly the item shape projectActiveRules produced pre-Phase-3.
const item = (ruleId, category, text) => ({
  ruleId, category, text, textTemplate: null, params: null, paramValues: null, bundleName: null,
});
const FIXTURE = [
  item('r-stop', 'risk', 'Exit a position once it drops past your line.'),
  item('r-rsi', 'technical', 'Avoid buying overbought names.'),
  item('r-sect', 'allocation', 'Limit how much rides on one sector.'),
  item('r-pe', 'fundamental', 'Skip expensive names.'),
];
const withNull = (rules) => rules.map((r) => ({ ...r, hardness: null }));
const withOverride = (rules, id, hardness) => rules.map((r) => (r.ruleId === id ? { ...r, hardness } : r));

// ── extractors (the Forge-rules section of each prompt) ──
const strategyAgent = (activeRules) => ({ name: 'Atlas', archetype: 'momentum_hunter', activeRules });
const strategyForgeBlock = (rules) =>
  (buildStrategyUserPrompt(strategyAgent(rules)).split('\n\n').find((p) => p.startsWith('FORGE RULES')) || '');
const evalForgeBlock = (rules) => {
  const s = buildAgentIdentityBlock({ agentContext: { agentName: 'Atlas', archetype: 'momentum_hunter', activeRules: rules } });
  const i = s.indexOf('YOUR FORGE RULES:');
  return i === -1 ? '' : s.slice(i); // FORGE RULES is the last part → slice-to-end
};

// ── golden bytes (the pre-Phase-3 output for FIXTURE) ──
const STRATEGY_GOLDEN = `FORGE RULES (your equipped strategy):
CONSTRAINTS:
C1. Exit a position once it drops past your line.
C2. Limit how much rides on one sector.
STRATEGY PREFERENCES:
S1. Avoid buying overbought names.
S2. Skip expensive names.`;

const EVAL_GOLDEN = `YOUR FORGE RULES:
== CONSTRAINTS (must obey) ==
C1. Exit a position once it drops past your line. [Risk]
C2. Limit how much rides on one sector. [Allocation]

== STRATEGY PREFERENCES (should follow) ==
S1. Avoid buying overbought names. [Technical]
S2. Skip expensive names. [Fundamental]

When making trades:
- Check ALL constraints before executing. If a trade violates a constraint, do not execute. Cite the constraint.
- Use strategy preferences to rank opportunities. Cite preferences that influenced your picks.
- If no strategy preference matches, trade on your own analysis.
- Constraints always override strategy preferences.`;

describe('strategy prompt — parity with no override', () => {
  it('is byte-identical to the pre-Phase-3 golden (category split)', () => {
    expect(strategyForgeBlock(FIXTURE)).toBe(STRATEGY_GOLDEN);
  });
  it('hardness:null is identical to the field being absent', () => {
    expect(strategyForgeBlock(withNull(FIXTURE))).toBe(strategyForgeBlock(FIXTURE));
  });
  it('an unrecognized hardness value falls back to category (no change)', () => {
    const garbage = FIXTURE.map((r) => ({ ...r, hardness: 'maybe' }));
    expect(strategyForgeBlock(garbage)).toBe(STRATEGY_GOLDEN);
  });
});

describe('strategy prompt — an authored override moves the rule', () => {
  // filter() preserves activeRules order, so a softened first rule becomes S1.
  it('softening a risk rule drops it out of CONSTRAINTS into STRATEGY PREFERENCES', () => {
    const block = strategyForgeBlock(withOverride(FIXTURE, 'r-stop', 'soft'));
    expect(block).toBe(`FORGE RULES (your equipped strategy):
CONSTRAINTS:
C1. Limit how much rides on one sector.
STRATEGY PREFERENCES:
S1. Exit a position once it drops past your line.
S2. Avoid buying overbought names.
S3. Skip expensive names.`);
  });
  it('hardening a technical rule promotes it into CONSTRAINTS', () => {
    const block = strategyForgeBlock(withOverride(FIXTURE, 'r-rsi', 'hard'));
    expect(block).toBe(`FORGE RULES (your equipped strategy):
CONSTRAINTS:
C1. Exit a position once it drops past your line.
C2. Avoid buying overbought names.
C3. Limit how much rides on one sector.
STRATEGY PREFERENCES:
S1. Skip expensive names.`);
  });
});

describe('eval/swap prompt — parity with no override', () => {
  it('is byte-identical to the pre-Phase-3 golden (category split)', () => {
    expect(evalForgeBlock(FIXTURE)).toBe(EVAL_GOLDEN);
  });
  it('hardness:null is identical to the field being absent', () => {
    expect(evalForgeBlock(withNull(FIXTURE))).toBe(evalForgeBlock(FIXTURE));
  });
});

describe('eval/swap prompt — an authored override moves the rule', () => {
  // filter() preserves activeRules order, so a softened first rule becomes S1.
  it('softening a risk rule moves it under STRATEGY PREFERENCES', () => {
    const block = evalForgeBlock(withOverride(FIXTURE, 'r-stop', 'soft'));
    expect(block).toContain('== CONSTRAINTS (must obey) ==\nC1. Limit how much rides on one sector. [Allocation]');
    expect(block).toContain('== STRATEGY PREFERENCES (should follow) ==\nS1. Exit a position once it drops past your line. [Risk]');
    expect(block).not.toMatch(/C\d\. Exit a position once it drops past your line\. \[Risk\]/);
  });
  it('hardening a fundamental rule moves it under CONSTRAINTS', () => {
    const block = evalForgeBlock(withOverride(FIXTURE, 'r-pe', 'hard'));
    expect(block).toContain('C3. Skip expensive names. [Fundamental]');
    expect(block).not.toMatch(/S\d\. Skip expensive names\. \[Fundamental\]/);
  });
});

describe('projectActiveRules carries the override (deploy path)', () => {
  const ruleDocs = [
    { id: 'r-stop', category: 'risk', text: 'Exit a position once it drops past your line.', isDeleted: false },
    { id: 'r-rsi', category: 'technical', text: 'Avoid buying overbought names.', isDeleted: false },
  ];

  it('no ruleHardness on the bundle → every item.hardness is null (parity)', () => {
    const bundles = [{ id: 'b1', status: 'forged', name: 'B', ruleIds: ['r-stop', 'r-rsi'] }];
    const items = projectActiveRules([], ruleDocs, bundles);
    expect(items.every((i) => i.hardness === null)).toBe(true);
  });

  it('an authored ruleHardness value rides onto the matching item', () => {
    const bundles = [{ id: 'b1', status: 'forged', name: 'B', ruleIds: ['r-stop', 'r-rsi'], ruleHardness: { 'r-stop': 'soft' } }];
    const byId = Object.fromEntries(projectActiveRules([], ruleDocs, bundles).map((i) => [i.ruleId, i]));
    expect(byId['r-stop'].hardness).toBe('soft');
    expect(byId['r-rsi'].hardness).toBeNull();
  });

  it('an unrecognized override value is dropped (item.hardness stays null)', () => {
    const bundles = [{ id: 'b1', status: 'forged', name: 'B', ruleIds: ['r-stop'], ruleHardness: { 'r-stop': 'firm' } }];
    expect(projectActiveRules([], ruleDocs, bundles)[0].hardness).toBeNull();
  });

  it('first non-archived bundle with an explicit override wins', () => {
    const bundles = [
      { id: 'b1', status: 'forged', name: 'B1', ruleIds: ['r-stop'] },
      { id: 'b2', status: 'forged', name: 'B2', ruleIds: ['r-stop'], ruleHardness: { 'r-stop': 'soft' } },
    ];
    expect(projectActiveRules([], ruleDocs, bundles)[0].hardness).toBe('soft');
  });
});

describe('end-to-end: deploy projection with no override → byte-identical prompts', () => {
  const ruleDocs = FIXTURE.map((r) => ({ id: r.ruleId, category: r.category, text: r.text, isDeleted: false }));
  const bundles = [{ id: 'b1', status: 'forged', name: 'B', ruleIds: FIXTURE.map((r) => r.ruleId) }];

  it('projected rules (no override) assemble to the golden strategy + eval blocks', () => {
    const projected = projectActiveRules([], ruleDocs, bundles);
    expect(strategyForgeBlock(projected)).toBe(STRATEGY_GOLDEN);
    expect(evalForgeBlock(projected)).toBe(EVAL_GOLDEN);
  });
});
