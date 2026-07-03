// api/_utils/ruleCompatCleanup.test.js
//
// WS1 Phase 4 — fixture coverage for the cleanup core. The real imports
// (cleanup core → projectActiveRules + the compatibility map) ARE the
// BUILD_RULES §4 dependency-surface guard; never mock them.
//
// The mini-executor below applies plan ops to plain fixtures with EXACTLY the
// runner's semantics (delete/set bundle override, reseed-safe trait swap,
// reprojection) so idempotency is proven end-to-end: apply(plan) → re-analyze
// → zero conflicts, zero ops.

import { describe, it, expect } from 'vitest';
import { analyzeAgentCompat, buildCleanupReport, deriveOrigin, SEEDED_TRAIT_FIX } from './ruleCompatCleanup.js';
import { projectActiveRules } from './projectActiveRules.js';
import { buildSeedPlan } from '../../src/data/traitEquip.js';

// ── fixture builders ──────────────────────────────────────────────────────
const agent = (over = {}) => ({
  id: 'a1', archetype: 'guardian', activeBattleId: null, equippedTraits: [], ...over,
});
const traitEntry = (traitId) => ({ traitId, strength: 'moderate', isCustom: false, equippedAt: 1 });
const rule = (id, sourceRef, category, over = {}) => ({
  id, sourceRef, category, text: `t-${id}`, isDeleted: false, traitId: null, provenance: 'user_equipped', ...over,
});
const bundle = (id, ruleIds, over = {}) => ({
  id, status: 'forged', name: id, ruleIds, ruleHardness: {}, ...over,
});

// ── the runner's op semantics, applied to fixtures ────────────────────────
function applyPlan(fix, plan) {
  for (const op of plan) {
    if (op.op === 'demote_bundle_override') {
      const b = fix.bundleDocs.find((x) => x.id === op.bundleId);
      b.ruleHardness = { ...(b.ruleHardness || {}) };
      if (op.action === 'delete') delete b.ruleHardness[op.ruleDocId];
      else b.ruleHardness[op.ruleDocId] = 'soft';
    } else if (op.op === 'swap_seeded_trait') {
      // Runner semantics: the replacement seeds at the plan's captured strength.
      const { ruleSpecs, equippedTraits: newEntries } = buildSeedPlan([op.addTraitId], op.strength || 'moderate');
      ruleSpecs.forEach((spec, i) => fix.ruleDocs.push({ id: `new-${i}`, ...spec, isDeleted: false }));
      fix.agent.equippedTraits = [
        ...fix.agent.equippedTraits.filter((t) => t.traitId !== op.removeTraitId),
        ...newEntries,
      ];
      for (const docId of op.softDeleteRuleDocIds) {
        fix.ruleDocs.find((r) => r.id === docId).isDeleted = true;
      }
    } else if (op.op === 'reproject_active_rules') {
      fix.agent.activeRules = projectActiveRules(
        fix.agent.equippedTraits, fix.ruleDocs.filter((r) => !r.isDeleted), fix.bundleDocs,
      );
    }
  }
  return fix;
}

const analyze = (fix, groupStatusById = {}) =>
  analyzeAgentCompat({ agent: fix.agent, ruleDocs: fix.ruleDocs, bundleDocs: fix.bundleDocs, groupStatusById });

// ══════════════════════════════════════════════════════════════════════════
describe('class: category_hard_trait — the guardian seeded-kit fix (§3)', () => {
  // The pre-close-out founder-agent shape: guardian still holding
  // trait-diversifier (a-05 conflict-hard, a-09 adjudicated NEUTRAL).
  const seededGuardian = () => ({
    agent: agent({ equippedTraits: [traitEntry('trait-diversifier'), traitEntry('trait-iron-discipline')] }),
    ruleDocs: [
      rule('d1', 'a-05', 'allocation', { traitId: 'trait-diversifier', provenance: 'archetype_default' }),
      rule('d2', 'a-09', 'allocation', { traitId: 'trait-diversifier', provenance: 'archetype_default' }),
      rule('d3', 'mb-09', 'mid_battle', { traitId: 'trait-iron-discipline', provenance: 'archetype_default' }),
    ],
    bundleDocs: [],
  });

  it('flags ONLY a-05 (a-09 is adjudicated neutral), classed category_hard_trait, seededFixCase', () => {
    const a = analyze(seededGuardian());
    expect(a.hardConflicts).toHaveLength(1);
    expect(a.hardConflicts[0]).toMatchObject({
      templateId: 'a-05', class: 'category_hard_trait', seededFixCase: true, origin: 'seeded_trait',
    });
    expect(a.softConflicts).toHaveLength(0);
  });

  it('plans ONE swap_seeded_trait (soft-deleting BOTH trait docs — the whole trait is replaced) + reprojection', () => {
    const a = analyze(seededGuardian());
    const swap = a.plan.find((op) => op.op === 'swap_seeded_trait');
    expect(swap).toMatchObject({
      removeTraitId: SEEDED_TRAIT_FIX.removeTraitId,
      addTraitId: SEEDED_TRAIT_FIX.addTraitId,
      previousEquippedTraitsEntry: { traitId: 'trait-diversifier' },
    });
    expect(swap.softDeleteRuleDocIds.sort()).toEqual(['d1', 'd2']);
    expect(a.plan.at(-1)).toEqual({ op: 'reproject_active_rules' });
  });

  it('IDEMPOTENT: applying the plan yields zero conflicts, zero ops, and the steady-anchor kit projecting', () => {
    const fix = seededGuardian();
    applyPlan(fix, analyze(fix).plan);
    const again = analyze(fix);
    expect(again.hardConflicts).toEqual([]);
    expect(again.plan).toEqual([]);
    const projectedTraitIds = new Set(
      fix.agent.activeRules.map((i) => fix.ruleDocs.find((r) => r.id === i.ruleId)?.traitId)
    );
    expect(projectedTraitIds.has('trait-steady-anchor')).toBe(true);
    expect(projectedTraitIds.has('trait-diversifier')).toBe(false);
  });

  it('the swap op captures and applies the agent\'s PREVIOUS strength (never a silent moderate reset)', () => {
    const fix = {
      agent: agent({ equippedTraits: [{ traitId: 'trait-diversifier', strength: 'dominant', isCustom: false, equippedAt: 1 }] }),
      ruleDocs: [rule('d1', 'a-05', 'allocation', { traitId: 'trait-diversifier', provenance: 'archetype_default' })],
      bundleDocs: [],
    };
    const swap = analyze(fix).plan.find((op) => op.op === 'swap_seeded_trait');
    expect(swap.strength).toBe('dominant');
    applyPlan(fix, analyze(fix).plan);
    const newEntry = fix.agent.equippedTraits.find((t) => t.traitId === SEEDED_TRAIT_FIX.addTraitId);
    expect(newEntry.strength).toBe('dominant');
  });

  it('a trait rule whose doc ALSO sits in a bundle with a hard override is DEMOTABLE (override_hard), not report-only', () => {
    // projectActiveRules applies a carrier bundle's ruleHardness to trait items,
    // so the bundle demote genuinely fixes it — the trait-layer treatment is
    // only for hard conflicts no carrier can reach.
    const fix = {
      agent: agent({ equippedTraits: [traitEntry('trait-squeeze-whisperer')] }),
      ruleDocs: [rule('t1', 'tech-bollinger-squeeze', 'technical', { traitId: 'trait-squeeze-whisperer' })],
      bundleDocs: [bundle('b1', ['t1'], { ruleHardness: { t1: 'hard' } })],
    };
    const a = analyze(fix);
    expect(a.hardConflicts[0]).toMatchObject({ class: 'override_hard', traitId: 'trait-squeeze-whisperer' });
    expect(a.plan.some((op) => op.op === 'report_only_trait_conflict')).toBe(false);
    applyPlan(fix, a.plan);
    const again = analyze(fix);
    expect(again.hardConflicts).toEqual([]);
    expect(again.plan).toEqual([]);
    expect(fix.agent.activeRules.find((i) => i.ruleId === 't1').hardness).toBe('soft');
  });

  it('a NON-seed trait hard conflict (contrarian × trait-sector-rotator) is REPORT-ONLY — no auto-fix', () => {
    const fix = {
      agent: agent({ archetype: 'contrarian', equippedTraits: [traitEntry('trait-sector-rotator')] }),
      ruleDocs: [
        rule('h1', 'tv-14', 'allocation', { traitId: 'trait-sector-rotator' }), // contrarian conflict, hard category
        rule('h2', 'a-08', 'allocation', { traitId: 'trait-sector-rotator' }),  // contrarian conflict, hard category
      ],
      bundleDocs: [],
    };
    const a = analyze(fix);
    expect(a.hardConflicts).toHaveLength(2);
    expect(a.hardConflicts.every((h) => h.class === 'category_hard_trait' && h.seededFixCase === false)).toBe(true);
    expect(a.plan.filter((op) => op.op === 'report_only_trait_conflict')).toHaveLength(2);
    // Report-only ops never trigger the reprojection terminal op on their own.
    expect(a.plan.some((op) => op.op === 'reproject_active_rules')).toBe(false);
  });
});

describe('class: override_hard — authored bundle override on a conflict rule', () => {
  const overrideHard = () => ({
    agent: agent(),
    ruleDocs: [rule('rc', 'tech-bollinger-squeeze', 'technical')], // guardian conflict, soft category
    bundleDocs: [bundle('b1', ['rc'], { ruleHardness: { rc: 'hard' } })],
  });

  it('classes override_hard; demote DELETES the entry (soft category default) + reprojects', () => {
    const a = analyze(overrideHard());
    expect(a.hardConflicts[0]).toMatchObject({ class: 'override_hard', templateId: 'tech-bollinger-squeeze', bundleIds: ['b1'] });
    expect(a.plan).toEqual([
      { op: 'demote_bundle_override', bundleId: 'b1', ruleDocId: 'rc', action: 'delete', previousValue: 'hard' },
      { op: 'reproject_active_rules' },
    ]);
  });

  it('a hard-CATEGORY rule with an authored hard override demotes via set_soft in EVERY carrier', () => {
    const fix = {
      agent: agent(),
      ruleDocs: [rule('ra', 'a-05', 'allocation')], // guardian conflict, hard category
      bundleDocs: [
        bundle('b1', ['ra'], { ruleHardness: { ra: 'hard' } }),
        bundle('b2', ['ra']), // second carrier, no override — must also get 'soft'
      ],
    };
    const a = analyze(fix);
    expect(a.hardConflicts[0].class).toBe('override_hard');
    expect(a.plan).toEqual([
      { op: 'demote_bundle_override', bundleId: 'b1', ruleDocId: 'ra', action: 'set_soft', previousValue: 'hard' },
      { op: 'demote_bundle_override', bundleId: 'b2', ruleDocId: 'ra', action: 'set_soft', previousValue: null },
      { op: 'reproject_active_rules' },
    ]);
  });

  it('IDEMPOTENT: apply → re-analyze → clean (and the rule now projects soft)', () => {
    const fix = overrideHard();
    applyPlan(fix, analyze(fix).plan);
    const again = analyze(fix);
    expect(again.hardConflicts).toEqual([]);
    expect(again.softConflicts).toHaveLength(1); // still equipped — now a soft conflict (census)
    expect(again.plan).toEqual([]);
    expect(fix.agent.activeRules.find((i) => i.ruleId === 'rc').hardness).toBe('soft');
  });
});

describe('class: category_hard_bundled — hard category, no override', () => {
  const catHard = () => ({
    agent: agent(),
    ruleDocs: [rule('ra', 'a-05', 'allocation')],
    bundleDocs: [bundle('b1', ['ra']), bundle('b2', ['ra'])],
  });

  it('plans set_soft in EVERY containing non-archived bundle', () => {
    const a = analyze(catHard());
    expect(a.hardConflicts[0]).toMatchObject({ class: 'category_hard_bundled', bundleIds: ['b1', 'b2'] });
    expect(a.plan.filter((op) => op.op === 'demote_bundle_override')).toHaveLength(2);
    expect(a.plan.every((op) => op.op !== 'demote_bundle_override' || op.action === 'set_soft')).toBe(true);
  });

  it('IDEMPOTENT: apply → re-analyze → clean; projection shows soft', () => {
    const fix = catHard();
    applyPlan(fix, analyze(fix).plan);
    const again = analyze(fix);
    expect(again.hardConflicts).toEqual([]);
    expect(again.plan).toEqual([]);
    expect(fix.agent.activeRules.find((i) => i.ruleId === 'ra').hardness).toBe('soft');
  });
});

describe('skips (skip-and-report; battle.* never touched)', () => {
  it('agent with an active battle → skipped, empty plan', () => {
    const a = analyze({ agent: agent({ activeBattleId: 'bat-9' }), ruleDocs: [rule('ra', 'a-05', 'allocation')], bundleDocs: [bundle('b1', ['ra'])] });
    expect(a.skipped).toEqual({ reason: 'battle_active', battleId: 'bat-9' });
    expect(a.plan).toEqual([]);
  });

  it("training clone whose GROUP is in 'battle' → skipped group_battle_active (GO addition 1)", () => {
    const fix = {
      agent: agent({ id: 'training-agent-g1-u1', isTrainingClone: true, groupId: 'g1' }),
      ruleDocs: [rule('ra', 'a-05', 'allocation')],
      bundleDocs: [bundle('b1', ['ra'])],
    };
    const a = analyze(fix, { g1: 'battle' });
    expect(a.skipped).toEqual({ reason: 'group_battle_active', groupId: 'g1' });
    expect(a.isTrainingClone).toBe(true);
  });

  it("training clone whose group is 'complete' → analyzed like any agent (clones are in scope)", () => {
    const fix = {
      agent: agent({ id: 'training-agent-g1-u1', isTrainingClone: true, groupId: 'g1' }),
      ruleDocs: [rule('ra', 'a-05', 'allocation')],
      bundleDocs: [bundle('b1', ['ra'])],
    };
    const a = analyze(fix, { g1: 'complete' });
    expect(a.skipped).toBeNull();
    expect(a.hardConflicts).toHaveLength(1);
  });

  it('agent with no archetype → skipped no_archetype (fail-open, nothing planned)', () => {
    const a = analyze({ agent: agent({ archetype: null }), ruleDocs: [], bundleDocs: [] });
    expect(a.skipped).toEqual({ reason: 'no_archetype' });
  });
});

describe('lurking hard carriers — soft-projecting conflicts stay shuffle-proof', () => {
  // guardian × a-05 (hard category) in two bundles: b1 carries the explicit
  // 'soft' that wins first-explicit-wins projection; b2 lurks with 'hard'.
  // Archiving b1 would resurrect must-obey — the cleanup demotes b2 NOW.
  const lurking = () => ({
    agent: agent(),
    ruleDocs: [rule('ra', 'a-05', 'allocation')],
    bundleDocs: [
      bundle('b1', ['ra'], { ruleHardness: { ra: 'soft' } }),
      bundle('b2', ['ra'], { ruleHardness: { ra: 'hard' } }),
    ],
  });

  it('projects soft (census) but plans the lurking carrier demotes anyway', () => {
    const a = analyze(lurking());
    expect(a.hardConflicts).toEqual([]);
    expect(a.softConflicts).toHaveLength(1);
    expect(a.lurkingHardCarriers).toHaveLength(1);
    expect(a.lurkingHardCarriers[0].bundleIds).toEqual(['b2']);
    expect(a.plan).toEqual([
      { op: 'demote_bundle_override', bundleId: 'b2', ruleDocId: 'ra', action: 'set_soft', previousValue: 'hard' },
      { op: 'reproject_active_rules' },
    ]);
  });

  it('IDEMPOTENT: apply → re-analyze → clean; a b1 archive can no longer resurrect hard', () => {
    const fix = lurking();
    applyPlan(fix, analyze(fix).plan);
    expect(analyze(fix).plan).toEqual([]);
    // The shuffle that used to resurrect must-obey:
    fix.bundleDocs.find((b) => b.id === 'b1').status = 'archived';
    const after = analyze(fix);
    expect(after.hardConflicts).toEqual([]); // b2 now carries 'soft'
  });
});

describe('census + dormant + origins (GO addition 2)', () => {
  it('soft conflicts are counted, untouched, and never planned against', () => {
    const fix = {
      agent: agent({ archetype: 'momentum_chaser' }),
      ruleDocs: [
        rule('r1', 'tech-rsi-oversold', 'technical'),  // TF conflict, soft
        rule('r2', 'fund-value-pe', 'fundamental'),    // TF conflict, soft
        rule('r3', 'tech-moving-average-trend', 'technical'), // TF native
      ],
      bundleDocs: [bundle('b1', ['r1', 'r2', 'r3'])],
    };
    const a = analyze(fix);
    expect(a.softConflicts.map((s) => s.templateId).sort()).toEqual(['fund-value-pe', 'tech-rsi-oversold']);
    expect(a.hardConflicts).toEqual([]);
    expect(a.plan).toEqual([]);
  });

  it('a conflict-hard doc that does NOT project (archived-bundle-only) is dormant — reported, never planned', () => {
    const fix = {
      agent: agent(),
      ruleDocs: [rule('ra', 'a-05', 'allocation')],
      bundleDocs: [bundle('b1', ['ra'], { status: 'archived' })],
    };
    const a = analyze(fix);
    expect(a.hardConflicts).toEqual([]);
    expect(a.dormantHardConflicts).toHaveLength(1);
    expect(a.plan).toEqual([]);
  });

  it('deriveOrigin covers the write-path vocabulary', () => {
    expect(deriveOrigin({ traitId: 't', provenance: 'archetype_default' })).toBe('seeded_trait');
    expect(deriveOrigin({ traitId: 't', provenance: 'user_equipped' })).toBe('hand_equipped_trait');
    expect(deriveOrigin({ id: 'dim-abc', traitId: null })).toBe('dimension_deploy');
    expect(deriveOrigin({ id: 'x', traitId: null, provenance: 'archetype_default' })).toBe('starter_kit');
    expect(deriveOrigin({ id: 'x', traitId: null, provenance: 'user_equipped' })).toBe('user_bundle');
    expect(deriveOrigin({ id: 'x', traitId: null, provenance: null })).toBe('unknown_legacy');
  });
});

describe('buildCleanupReport — the dry-run deliverable shape', () => {
  it('aggregates census by archetype + class, splits skips, counts planned writes', () => {
    const analyses = [
      analyze({
        agent: agent({ id: 'g1' , equippedTraits: [traitEntry('trait-diversifier')]}),
        ruleDocs: [rule('d1', 'a-05', 'allocation', { traitId: 'trait-diversifier', provenance: 'archetype_default' })],
        bundleDocs: [],
      }),
      analyze({
        agent: agent({ id: 'm1', archetype: 'momentum_chaser' }),
        ruleDocs: [rule('r1', 'tech-rsi-oversold', 'technical')],
        bundleDocs: [bundle('b1', ['r1'])],
      }),
      analyze({ agent: agent({ id: 'busy', activeBattleId: 'x' }), ruleDocs: [], bundleDocs: [] }),
    ];
    const report = buildCleanupReport({ analyses, runId: 'run-1', mode: 'dry-run', generatedAt: 'T0' });
    expect(report.totals).toMatchObject({ agentsAnalyzed: 2, agentsSkipped: 1, agentsWithFindings: 2 });
    expect(report.census.hardConflictsByArchetype).toEqual({ guardian: 1 });
    expect(report.census.softConflictsByArchetype).toEqual({ momentum_chaser: 1 });
    expect(report.census.hardByClass).toMatchObject({ category_hard_trait: 1, override_hard: 0, category_hard_bundled: 0 });
    expect(report.skipped[0]).toMatchObject({ agentId: 'busy', reason: 'battle_active' });
    expect(report.totals.plannedWriteOps).toBe(2); // swap + reproject (report-only excluded)
  });
});
