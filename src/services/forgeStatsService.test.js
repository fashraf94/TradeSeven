// Phase 3 reconciliation — the citation positional map (label → ruleId) must
// mirror the eval prompt's hard/soft split, because the model cites rules by the
// C#/S# positional label and this map resolves that label back to a ruleId.
// Reads the RESOLVED hardness carried on each snapshot item (override ?? category)
// via the single client source (hardSoftHelper) — never re-derives from category.

import { describe, it, expect, vi } from 'vitest';

// forgeStatsService imports firebase/config (which boots a Firebase app on
// import). Mock it so importing the module is side-effect-free — the established
// pattern (see agentService.test.js). buildPositionalMap itself never touches db.
vi.mock('../firebase/config', () => ({ db: {}, auth: {} }));

const { buildPositionalMap } = await import('./forgeStatsService.js');

const item = (ruleId, category, hardness) => ({
  ruleId, category, text: `${ruleId} text`, ...(hardness ? { hardness } : {}),
});

describe('forgeStatsService.buildPositionalMap', () => {
  it('no override: risk → C, technical → S (category split — byte-identical)', () => {
    const map = buildPositionalMap([item('r-stop', 'risk'), item('r-rsi', 'technical')]);
    expect(map.C1.ruleId).toBe('r-stop');
    expect(map.S1.ruleId).toBe('r-rsi');
    expect(map.C2).toBeUndefined();
  });

  it('softening a risk rule moves it from C to S (matches the eval prompt)', () => {
    const map = buildPositionalMap([item('r-stop', 'risk', 'soft'), item('r-rsi', 'technical')]);
    expect(map.C1).toBeUndefined();
    // both are strategies now, in activeRules order
    expect(map.S1.ruleId).toBe('r-stop');
    expect(map.S2.ruleId).toBe('r-rsi');
  });

  it('hardening a technical rule moves it from S to C', () => {
    const map = buildPositionalMap([item('r-stop', 'risk'), item('r-rsi', 'technical', 'hard')]);
    expect(map.C1.ruleId).toBe('r-stop');
    expect(map.C2.ruleId).toBe('r-rsi');
    expect(map.S1).toBeUndefined();
  });

  it('corrects the prior drift: mid_battle / game_state resolve to S (were C here), matching the prompt', () => {
    const map = buildPositionalMap([item('mb', 'mid_battle'), item('gs', 'game_state')]);
    expect(map.S1.ruleId).toBe('mb');
    expect(map.S2.ruleId).toBe('gs');
    expect(map.C1).toBeUndefined();
  });

  it('legacy snapshot items without a hardness field fall back to category', () => {
    // no `hardness` key at all → category default (risk → hard, technical → soft)
    const map = buildPositionalMap([item('r-stop', 'risk'), item('r-rsi', 'technical')]);
    expect(map.C1.ruleId).toBe('r-stop');
    expect(map.S1.ruleId).toBe('r-rsi');
  });

  it('returns {} for empty / missing activeRules', () => {
    expect(buildPositionalMap([])).toEqual({});
    expect(buildPositionalMap(null)).toEqual({});
  });
});
