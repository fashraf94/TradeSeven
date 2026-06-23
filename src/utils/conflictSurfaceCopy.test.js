import { describe, it, expect } from 'vitest';
import {
  buildConflictSurface,
  buildEquipWarning,
  assumedTierNote,
  BANNED_VERBS,
} from './conflictSurfaceCopy.js';

// ── Fixtures (presentational tests use crafted reports, not live reconcile) ──
const contradiction = (over = {}) => ({
  dimension: 'sector_exposure',
  outcomeClass: 'contradiction',
  ruleApplied: 'tier',
  reason: 'Kept your "Cap Technology sector at 40%". Set aside the built-in default\'s '
    + '"Allocate at least 50% to Technology" for this battle — both can\'t hold at once.',
  winner: { ruleId: 'w', text: 'Cap Technology sector at 40%', tier: 1, tierAssumed: false },
  losers: [{ ruleId: 'l', text: 'Allocate at least 50% to Technology', tier: 2, tierAssumed: false }],
  ...over,
});
const consolidation = (over = {}) => ({
  dimension: 'sector_exposure',
  outcomeClass: 'consolidation',
  ruleApplied: 'consolidation',
  reason: 'Two limits cover the same thing, so the tighter one applies: "Cap Technology sector at 40%".',
  winner: { ruleId: 'w', text: 'Cap Technology sector at 40%', tier: 1, tierAssumed: false },
  losers: [{ ruleId: 'l', text: 'Cap Technology sector at 60%', tier: 1, tierAssumed: false }],
  ...over,
});
const report = (over = {}) => ({
  conflicts: [],
  coverage: { checkedRuleIds: [], uncheckedRuleIds: [], checkedCount: 0, uncheckedCount: 0 },
  reconcilerVersion: 1,
  ...over,
});

const allStrings = (surface) => [
  surface.degradedText,
  ...surface.prominent.flatMap((p) => [p.text, p.note]),
  ...surface.quiet.map((q) => q.text),
  surface.coverageText,
].filter(Boolean);

const hasBanned = (s) => BANNED_VERBS.some((v) => s.toLowerCase().includes(v));

describe('buildConflictSurface — invisibility', () => {
  it('returns null when there is no report (INJECT off / pre-deploy)', () => {
    expect(buildConflictSurface(null)).toBeNull();
    expect(buildConflictSurface(undefined)).toBeNull();
  });
});

describe('buildConflictSurface — branches', () => {
  it('contradiction → prominent kept/set-aside line, not recency', () => {
    const s = buildConflictSurface(report({ conflicts: [contradiction()] }));
    expect(s.prominent).toHaveLength(1);
    expect(s.prominent[0].recency).toBe(false);
    expect(s.prominent[0].text).toMatch(/Kept your .*Set aside/s);
    expect(s.quiet).toHaveLength(0);
  });

  it('consolidation → quiet "tighter limit applies", no set-aside verb', () => {
    const s = buildConflictSurface(report({ conflicts: [consolidation()] }));
    expect(s.prominent).toHaveLength(0);
    expect(s.quiet).toHaveLength(1);
    expect(s.quiet[0].text).toMatch(/tighter one applies/);
    expect(s.quiet[0].text.toLowerCase()).not.toContain('set aside');
    expect(s.quiet[0].text.toLowerCase()).not.toContain('ignored');
  });

  it('tie_fallback → prominent and recency-honest', () => {
    const tie = contradiction({
      ruleApplied: 'tie_fallback',
      reason: 'Two conflicting rules had equal standing, so your most recent one ("A") applies '
        + 'and the earlier "B" is set aside for this battle.',
    });
    const s = buildConflictSurface(report({ conflicts: [tie] }));
    expect(s.prominent[0].recency).toBe(true);
    expect(s.prominent[0].text).toMatch(/most recent/);
  });

  it('tierAssumed:true → assumed-tier note with the re-equip hint', () => {
    const c = contradiction({
      losers: [{ ruleId: 'l', text: 'Allocate at least 50% to Technology', tier: 2, tierAssumed: true }],
    });
    const s = buildConflictSurface(report({ conflicts: [c] }));
    expect(s.prominent[0].note).toMatch(/no source tag/);
    expect(s.prominent[0].note).toMatch(/re-equip/);
  });

  it('coverage with unchecked + no contradictions → qualified "among your checked rules" + count', () => {
    const s = buildConflictSurface(report({
      coverage: { uncheckedRuleIds: ['c1', 'c2'], uncheckedCount: 2 },
    }));
    expect(s.coverageText).toBe('No conflicts among your checked rules. 2 custom rules couldn\'t be auto-checked.');
    expect(s.unchecked).toEqual(['c1', 'c2']);
  });

  it('coverage with unchecked + a contradiction → caveat only (no false "no conflicts")', () => {
    const s = buildConflictSurface(report({
      conflicts: [contradiction()],
      coverage: { uncheckedRuleIds: ['c1'], uncheckedCount: 1 },
    }));
    expect(s.coverageText).toBe('1 custom rule couldn\'t be auto-checked.');
    expect(s.coverageText.toLowerCase()).not.toContain('no conflicts');
  });

  it('fully covered, no conflicts → plain all-clear (only when nothing unchecked)', () => {
    const s = buildConflictSurface(report());
    expect(s.coverageText).toBe('No conflicts found among your rules.');
  });
});

describe('buildConflictSurface — degraded (Rule 6)', () => {
  it('reconcilerError → degraded indicator, never a false all-clear', () => {
    const s = buildConflictSurface(report({ reconcilerError: 'boom' }));
    expect(s.degraded).toBe(true);
    expect(s.degradedText).toMatch(/running on its raw rules/);
    expect(s.degradedText.toLowerCase()).not.toContain('no conflicts');
    expect(s.prominent).toHaveLength(0);
    expect(s.coverageText).toBeNull();
  });
});

describe('buildEquipWarning — bundle-scoped (Surface 1, Rule 7)', () => {
  it('null/undefined (DETECT off) → no toast', () => {
    expect(buildEquipWarning(null)).toBeNull();
    expect(buildEquipWarning(undefined)).toBeNull();
  });

  it('contradiction → warning that is explicitly bundle-scoped, not agent-wide', () => {
    const w = buildEquipWarning({ conflicts: [contradiction()] });
    expect(w).toMatch(/in this bundle/);
    expect(w).toMatch(/Checked this bundle only/);
    expect(w.toLowerCase()).not.toMatch(/all (your )?rules|whole agent|agent-wide|no conflicts/);
  });

  it('consolidation only → no warning (quiet at equip)', () => {
    expect(buildEquipWarning({ conflicts: [consolidation()] })).toBeNull();
  });

  it('detection error → silent (no false warning, no false all-clear)', () => {
    expect(buildEquipWarning({ reconcilerError: 'boom', conflicts: [] })).toBeNull();
  });
});

describe('copy rules — no banned verbs anywhere user-facing', () => {
  const batteries = [
    report({ conflicts: [contradiction()] }),
    report({ conflicts: [consolidation()] }),
    report({ conflicts: [contradiction({ ruleApplied: 'tie_fallback' })] }),
    report({ conflicts: [contradiction({ losers: [{ ruleId: 'l', text: 'X', tier: 2, tierAssumed: true }] })] }),
    report({ coverage: { uncheckedRuleIds: ['c1'], uncheckedCount: 1 } }),
    report({ reconcilerError: 'boom' }),
  ];

  it('buildConflictSurface strings never contain dropped/deleted/removed', () => {
    for (const r of batteries) {
      for (const s of allStrings(buildConflictSurface(r))) {
        expect(hasBanned(s), `banned verb in: ${s}`).toBe(false);
      }
    }
  });

  it('buildEquipWarning never contains dropped/deleted/removed', () => {
    const w = buildEquipWarning({ conflicts: [contradiction()] });
    expect(hasBanned(w)).toBe(false);
  });
});

describe('assumedTierNote', () => {
  it('returns null when no participant is tier-assumed', () => {
    expect(assumedTierNote(contradiction())).toBeNull();
  });
});
