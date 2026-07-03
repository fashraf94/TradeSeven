// api/_utils/ruleCompatInvariantR.test.js
//
// WS1 Phase 3 — INVARIANT R: runtime neutrality of the compatibility build.
// With RULE_COMPAT_MODE mocked to 'enforce' for this whole file, an equipped
// SOFT core_conflict rule projects into activeRules and renders under
// == STRATEGY PREFERENCES == byte-identically to 'off' behavior. The golden
// strings below are hand-specified from TODAY'S (flag-off) output — them
// passing under an enforce-mocked module graph IS the byte-identity proof.
//
// Fence posture (BUILD_RULES §1): the two prompt assemblies are FENCED —
// their exported builders are CALLED here (permitted), never edited. The
// projection is exercised, never modified. Pattern:
// hardSoftOverride.parity.test.js (golden bytes + structural assertions).
//
// The structural half: neither the projection nor either assembly references
// the flag, the map, or the guard — asserted from source, so the behavioral
// goldens cannot silently rot into "passes because someone wired the flag in
// symmetrically".

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Pin the WHOLE module graph to enforce for this file. Every other flag
// forgeService-adjacent modules read is irrelevant to these imports.
vi.mock('../../src/config/featureFlags.js', () => ({
  RULE_COMPAT_MODE: 'enforce',
}));

import { projectActiveRules } from './projectActiveRules.js';
import { buildStrategyUserPrompt } from './agentPromptAssembly.js';       // fenced — called, never edited
import { buildAgentIdentityBlock } from './agentEvalPromptAssembly.js';   // fenced — called, never edited
import { classifyRule } from '../../src/data/archetypeRuleCompatibility.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Fixture: a guardian holding TWO core_conflict rules both resolving SOFT —
// one soft-by-category (tech-bollinger-squeeze, technical), one hard-by-
// category DEMOTED to soft via the bundle's authored override (a-05,
// allocation) — exactly the shape the Phase 4 cleanup script produces. Plus a
// guardian-native hard rule (risk category) so the CONSTRAINTS block is real.
const ARCHETYPE = 'guardian';
const RULE_DOCS = [
  { id: 'd-squeeze', sourceRef: 'tech-bollinger-squeeze', category: 'technical', text: 'Target stocks coiled for a breakout.', isDeleted: false },
  { id: 'd-barbell', sourceRef: 'a-05', category: 'allocation', text: 'Build a barbell of anchors and rockets.', isDeleted: false },
  { id: 'd-spread', sourceRef: 'risk-sector-diversification', category: 'risk', text: 'Diversify across at least 4 sectors.', isDeleted: false },
];
const BUNDLES = [{
  id: 'b1', status: 'forged', name: 'Mixed',
  ruleIds: ['d-squeeze', 'd-barbell', 'd-spread'],
  // The cleanup-script demote shape: the hard-category conflict runs soft.
  ruleHardness: { 'd-barbell': 'soft' },
}];

const project = () => projectActiveRules([], RULE_DOCS, BUNDLES);
const strategyForgeBlock = (rules) =>
  (buildStrategyUserPrompt({ name: 'Atlas', archetype: ARCHETYPE, activeRules: rules })
    .split('\n\n').find((p) => p.startsWith('FORGE RULES')) || '');
const evalForgeBlock = (rules) => {
  const s = buildAgentIdentityBlock({ agentContext: { agentName: 'Atlas', archetype: ARCHETYPE, activeRules: rules } });
  const i = s.indexOf('YOUR FORGE RULES:');
  return i === -1 ? '' : s.slice(i);
};

// ── Golden bytes — hand-specified from the flag-off contract (category split
// + authored override), independent of the assembler internals.
const STRATEGY_GOLDEN = `FORGE RULES (your equipped strategy):
CONSTRAINTS:
C1. Diversify across at least 4 sectors.
STRATEGY PREFERENCES:
S1. Target stocks coiled for a breakout.
S2. Build a barbell of anchors and rockets.`;

const EVAL_GOLDEN = `YOUR FORGE RULES:
== CONSTRAINTS (must obey) ==
C1. Diversify across at least 4 sectors. [Risk]

== STRATEGY PREFERENCES (should follow) ==
S1. Target stocks coiled for a breakout. [Technical]
S2. Build a barbell of anchors and rockets. [Allocation]

When making trades:
- Check ALL constraints before executing. If a trade violates a constraint, do not execute. Cite the constraint.
- Use strategy preferences to rank opportunities. Cite preferences that influenced your picks.
- If no strategy preference matches, trade on your own analysis.
- Constraints always override strategy preferences.`;

describe('Invariant R — fixture sanity (the cells really are soft conflicts under enforce)', () => {
  it('both rules classify core_conflict for guardian while the mocked mode is enforce', () => {
    expect(classifyRule('tech-bollinger-squeeze', ARCHETYPE)).toBe('core_conflict');
    expect(classifyRule('a-05', ARCHETYPE)).toBe('core_conflict');
    expect(classifyRule('risk-sector-diversification', ARCHETYPE)).toBe('native');
  });
});

describe('Invariant R — projection is mode-blind', () => {
  it('soft core_conflict rules project with hardness soft (category and demote-override alike), conflicts unfiltered', () => {
    const byId = Object.fromEntries(project().map((i) => [i.ruleId, i]));
    expect(Object.keys(byId)).toHaveLength(3);            // nothing filtered out
    expect(byId['d-squeeze'].hardness).toBe('soft');      // soft by category
    expect(byId['d-barbell'].hardness).toBe('soft');      // demoted by override
    expect(byId['d-spread'].hardness).toBe('hard');       // native constraint intact
  });

  it('projection output matches the flag-off golden shape byte-for-byte (JSON)', () => {
    // Field-for-field golden of the emitted item shape — any compat leakage
    // into the projection (a new field, a filtered rule) breaks these bytes.
    expect(JSON.stringify(project())).toBe(JSON.stringify([
      { ruleId: 'd-squeeze', text: 'Target stocks coiled for a breakout.', textTemplate: null, params: null, paramValues: null, category: 'technical', bundleName: 'Mixed', hardness: 'soft' },
      { ruleId: 'd-barbell', text: 'Build a barbell of anchors and rockets.', textTemplate: null, params: null, paramValues: null, category: 'allocation', bundleName: 'Mixed', hardness: 'soft' },
      { ruleId: 'd-spread', text: 'Diversify across at least 4 sectors.', textTemplate: null, params: null, paramValues: null, category: 'risk', bundleName: 'Mixed', hardness: 'hard' },
    ]));
  });
});

describe('Invariant R — soft conflicts render under STRATEGY PREFERENCES, byte-identical to off', () => {
  it('strategy prompt: golden bytes; both conflicts are preferences, never constraints', () => {
    const block = strategyForgeBlock(project());
    expect(block).toBe(STRATEGY_GOLDEN);
  });

  it('eval/swap prompt: golden bytes; conflicts sit in == STRATEGY PREFERENCES (should follow) ==', () => {
    const block = evalForgeBlock(project());
    expect(block).toBe(EVAL_GOLDEN);
    expect(block.indexOf('== STRATEGY PREFERENCES (should follow) ==')).toBeLessThan(block.indexOf('S1. Target stocks coiled for a breakout.'));
  });
});

describe('Invariant R — structural: the runtime path never references the compat build', () => {
  const REPO_ROOT = resolve(__dirname, '../..');
  const RUNTIME_FILES = [
    'api/_utils/projectActiveRules.js',
    'api/_utils/agentPromptAssembly.js',
    'api/_utils/agentEvalPromptAssembly.js',
  ];

  it('no flag, map, or guard reference in the projection or either prompt assembly', () => {
    for (const rel of RUNTIME_FILES) {
      const src = readFileSync(resolve(REPO_ROOT, rel), 'utf-8');
      expect(
        /RULE_COMPAT_MODE|archetypeRuleCompatibility|ruleCompatGuard|compatSurfaceCopy/.test(src),
        `${rel} references the compat build — Invariant R violation`
      ).toBe(false);
    }
  });
});
