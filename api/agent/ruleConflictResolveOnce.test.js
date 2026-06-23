// Resolve-once guarantee (Rule Conflict Reconciler, Phase 2).
//
// Proves the load-bearing claim behind the single decide.js seam: resolving
// activeRules ONCE at deploy keeps the losing side of a contradiction out of the
// intraday EVAL prompt — not just the opening strategy prompt. decide.js sets
// agent.activeRules = resolveForDeploy(...).activeRules once; createAgentBattle
// freezes that into agentContext.activeRules; agent-evaluate.js re-reads only
// that frozen snapshot (no re-projection). So the eval prompt is built from the
// resolved set. This test composes the REAL (fenced, call-only) eval-prompt
// assembler with resolveForDeploy to verify the loser never appears.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): importing the Node-clean reconciler
// here (and exercising it under vitest's Node env) is part of the guard for the
// api→src import added in decide.js. Never mock it.
import { describe, it, expect } from 'vitest';
import { resolveForDeploy } from '../../src/utils/ruleConflictReconciler.js';
import { buildAgentIdentityBlock } from '../_utils/agentEvalPromptAssembly.js';

// The classic launch-blocker contradiction: a user cap vs an archetype-default
// floor on the same sector. Distinctive `text` so we can assert presence/absence
// in the assembled prompt (resolveRuleText returns r.text when no textTemplate).
const userCap = {
  ruleId: 'cap-1',
  text: 'Cap Technology sector at 40 percent of portfolio',
  category: 'allocation',
  sourceRef: 'alloc-sector-cap',
  provenance: 'user_equipped', // tier 1
  paramValues: { sector: 'Technology', pct: 40 },
};
const archetypeFloor = {
  ruleId: 'floor-1',
  text: 'Allocate at least 50 percent to Technology sector',
  category: 'allocation',
  sourceRef: 'alloc-sector-minimum',
  provenance: 'archetype_default', // tier 2 — the loser
  paramValues: { sector: 'Technology', pct: 50 },
};
const projected = [userCap, archetypeFloor];

const evalPromptFor = (activeRules) =>
  buildAgentIdentityBlock({ agentContext: { agentName: 'T', archetype: 'analyst', activeRules } });

const LOSER = 'Allocate at least 50 percent';
const WINNER = 'Cap Technology sector at 40 percent';

describe('resolve-once: the loser is absent from the mid-battle eval prompt', () => {
  it('INJECT ON → resolved set drops the floor; eval prompt keeps cap, omits floor', () => {
    const { activeRules } = resolveForDeploy(projected, [], [], { inject: true });
    expect(activeRules.map((r) => r.ruleId)).toEqual(['cap-1']); // floor resolved out
    const prompt = evalPromptFor(activeRules);
    expect(prompt).toContain(WINNER);
    expect(prompt).not.toContain(LOSER);
  });

  it('control: the RAW projected set leaks the loser into the eval prompt', () => {
    // Without resolution both rules reach the prompt — the bug Phase 2 fixes.
    const prompt = evalPromptFor(projected);
    expect(prompt).toContain(WINNER);
    expect(prompt).toContain(LOSER);
  });

  it('INJECT OFF → activeRules unchanged (byte-identical); both rules still present', () => {
    const { activeRules, report } = resolveForDeploy(projected, [], [], { inject: false });
    expect(activeRules).toBe(projected);
    expect(report).toBeNull();
    const prompt = evalPromptFor(activeRules);
    expect(prompt).toContain(WINNER);
    expect(prompt).toContain(LOSER);
  });
});
