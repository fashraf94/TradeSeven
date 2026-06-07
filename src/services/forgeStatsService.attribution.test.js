// src/services/forgeStatsService.attribution.test.js
//
// Phase 1B step 3 — per-battle read-side attribution rollup. The service imports
// firebase at module load, so config + firestore are mocked (computeBattleTraitAttribution
// itself is pure on the battle object). Verifies the honest omissions: shared rules
// (th-01/mb-08) and manual-bundle rules are never attributed to a card.

import { describe, it, expect, vi } from 'vitest';

vi.mock('../firebase/config', () => ({ db: {}, auth: {} }));
vi.mock('firebase/firestore', () => ({
  collection: () => ({}),
  query: () => ({}),
  where: () => ({}),
  getDocs: async () => ({ docs: [] }),
  orderBy: () => ({}),
  limit: () => ({}),
}));

import { computeBattleTraitAttribution } from './forgeStatsService';

// All categories below are non-(risk/allocation), so every rule is a SOFT rule →
// labeled S1, S2, S3 in activeRules order (buildPositionalMap split).
const battle = {
  agentContext: {
    activeRules: [
      { ruleId: 'mb-09', category: 'mid_battle', text: 'Exit a sharply falling position', bundleName: null },          // S1 — iron-discipline (unique, trait rule)
      { ruleId: 'th-01', category: 'threshold', text: 'Hold near the bonus line', bundleName: null },                  // S2 — SHARED (omit)
      { ruleId: 'tech-rsi-oversold', category: 'technical', text: 'Buy oversold', bundleName: 'My Strategy' },          // S3 — unique to bargain-hunter BUT from a bundle (omit)
    ],
  },
  evaluations: [
    { citedForgeRules: [{ ruleId: 'S1', influence: 'followed' }] },
    { citedForgeRules: [{ ruleId: 'S1', influence: 'blocked_trade' }] },
    { citedForgeRules: [{ ruleId: 'S2', influence: 'followed' }] }, // th-01 (shared)
    { citedForgeRules: [{ ruleId: 'S3', influence: 'followed' }] }, // bundle rule
  ],
};

describe('computeBattleTraitAttribution', () => {
  it('attributes only the unambiguous, trait-sourced rule; counts followed + blocked', () => {
    const rollup = computeBattleTraitAttribution(battle);
    expect(rollup).toEqual([
      { traitId: 'trait-iron-discipline', traitName: 'Iron Discipline', decisions: 2 },
    ]);
  });

  it('never attributes a SHARED rule (th-01) — even when cited', () => {
    const rollup = computeBattleTraitAttribution(battle);
    expect(rollup.find((r) => r.traitId === 'trait-threshold-harvester')).toBeUndefined();
    expect(rollup.find((r) => r.traitId === 'trait-let-winners-run')).toBeUndefined();
  });

  it('never attributes a rule that came from a manual bundle (bundleName set)', () => {
    const rollup = computeBattleTraitAttribution(battle);
    // tech-rsi-oversold is uniquely owned by Bargain Hunter, but it was bundled here.
    expect(rollup.find((r) => r.traitId === 'trait-bargain-hunter')).toBeUndefined();
  });

  it('omits a ruleId that appears as BOTH a trait rule and a manual-bundle rule (sticky bundle, order-independent)', () => {
    // mb-09 projected twice: once as a trait rule (no bundleName) and once as a
    // manually-bundled rule (bundleName set). Citations are ambiguous → omit.
    const b = {
      agentContext: {
        activeRules: [
          { ruleId: 'mb-09', category: 'mid_battle', text: 'trait copy', bundleName: null },     // S1
          { ruleId: 'mb-09', category: 'mid_battle', text: 'bundle copy', bundleName: 'My Strategy' }, // S2
        ],
      },
      evaluations: [
        { citedForgeRules: [{ ruleId: 'S1', influence: 'followed' }] },
        { citedForgeRules: [{ ruleId: 'S2', influence: 'followed' }] },
      ],
    };
    expect(computeBattleTraitAttribution(b)).toEqual([]);
  });

  it('returns [] for a battle with no forge rules / no evaluations', () => {
    expect(computeBattleTraitAttribution({})).toEqual([]);
    expect(computeBattleTraitAttribution({ agentContext: { activeRules: [] }, evaluations: [] })).toEqual([]);
  });

  it('sorts by decisions desc across multiple cards', () => {
    const b = {
      agentContext: {
        activeRules: [
          { ruleId: 'mb-09', category: 'mid_battle', text: 'a', bundleName: null }, // S1 iron-discipline
          { ruleId: 'a-05', category: 'allocation', text: 'b', bundleName: null },   // C1 diversifier (allocation → hard)
        ],
      },
      evaluations: [
        { citedForgeRules: [{ ruleId: 'C1', influence: 'followed' }] },
        { citedForgeRules: [{ ruleId: 'C1', influence: 'followed' }] },
        { citedForgeRules: [{ ruleId: 'C1', influence: 'followed' }] },
        { citedForgeRules: [{ ruleId: 'S1', influence: 'followed' }] },
      ],
    };
    const rollup = computeBattleTraitAttribution(b);
    expect(rollup.map((r) => [r.traitId, r.decisions])).toEqual([
      ['trait-diversifier', 3],
      ['trait-iron-discipline', 1],
    ]);
  });
});
