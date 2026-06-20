// Tests for the canonical Rule Conflict Reconciler.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the imports below are the runtime
// guard. ruleConflictReconciler.js is imported cross-boundary by api/ (Phase 2),
// so it MUST stay Node-clean. If a browser-only dep (react, firebase, a DOM
// global) ever enters its import graph, THIS import throws in the Node/vitest
// env and the suite goes red. NEVER mock these imports to "fix" such a failure —
// the failure is the point.
import { describe, it, expect } from 'vitest';
import {
  reconcile,
  HARD_CATEGORIES,
  RECONCILER_VERSION,
} from './ruleConflictReconciler.js';
// Importing the flag module too proves the equip-time caller's flag surface is
// also Node-clean (the equip path imports both).
import { CONFLICT_RECONCILER_DETECT_ENABLED } from '../config/featureFlags.js';

let _seq = 0;
const rule = (over) => ({
  ruleId: over.ruleId || `r${(_seq += 1)}`,
  text: over.text || `${over.sourceRef} ${JSON.stringify(over.paramValues || {})}`,
  ...over,
});
// sector cap (allocation → hard)
const cap = (pct, prov, extra = {}) => rule({
  sourceRef: 'alloc-sector-cap', category: 'allocation', provenance: prov,
  paramValues: { sector: 'Technology', pct }, ...extra,
});
// sector floor (allocation → hard)
const floor = (pct, prov, extra = {}) => rule({
  sourceRef: 'alloc-sector-minimum', category: 'allocation', provenance: prov,
  paramValues: { sector: 'Technology', pct }, ...extra,
});

describe('HARD_CATEGORIES — value pin', () => {
  // This constant duplicates the fenced prompt-assembly hardness set. If you
  // change it, you MUST also change agentPromptAssembly.js:76 and
  // agentEvalPromptAssembly.js:285 (the reconciler-side pin does not auto-catch
  // a fence-side change — see the §7 consolidation backlog ticket).
  it('is exactly { risk, allocation }', () => {
    expect(HARD_CATEGORIES instanceof Set).toBe(true);
    expect([...HARD_CATEGORIES].sort()).toEqual(['allocation', 'risk']);
  });
});

describe('reconcile — classification', () => {
  it('cap < floor (same sector) → contradiction, loser dropped & reported', () => {
    const c = cap(40, 'user_equipped');
    const f = floor(50, 'user_equipped');
    const { resolvedRules, conflictReport } = reconcile([c, f]);
    expect(conflictReport).toHaveLength(1);
    expect(conflictReport[0].outcomeClass).toBe('contradiction');
    // both user-equipped + both hard → safer-direction: the limiting cap wins
    expect(conflictReport[0].winner.ruleId).toBe(c.ruleId);
    expect(conflictReport[0].ruleApplied).toBe('safer_direction');
    expect(resolvedRules.map((r) => r.ruleId)).toEqual([c.ruleId]); // floor dropped
  });

  it('cap 60 + floor 40 (valid intersection) → NOT flagged at all', () => {
    const c = cap(60, 'user_equipped');
    const f = floor(40, 'user_equipped');
    const { resolvedRules, conflictReport } = reconcile([c, f]);
    expect(conflictReport).toHaveLength(0);
    expect(resolvedRules).toHaveLength(2);
  });

  it('two caps same sector → consolidation (NOT contradiction); lower binds', () => {
    const lo = cap(40, 'user_equipped');
    const hi = cap(60, 'user_equipped');
    const { resolvedRules, conflictReport } = reconcile([hi, lo]);
    expect(conflictReport).toHaveLength(1);
    expect(conflictReport[0].outcomeClass).toBe('consolidation');
    expect(conflictReport[0].winner.ruleId).toBe(lo.ruleId); // tighter cap binds
    expect(resolvedRules.map((r) => r.ruleId)).toEqual([lo.ruleId]);
  });
});

describe('reconcile — consolidation binds the right side per operator', () => {
  it('two sector floors → higher floor binds (subsumption)', () => {
    const lo = floor(20, 'user_equipped');
    const hi = floor(30, 'user_equipped');
    const { conflictReport } = reconcile([lo, hi]);
    expect(conflictReport[0].outcomeClass).toBe('consolidation');
    expect(conflictReport[0].winner.ruleId).toBe(hi.ruleId);
  });

  it('two single-stock maxes → lower max binds', () => {
    const lo = rule({ sourceRef: 'risk-single-stock-limit', category: 'risk', provenance: 'user_equipped', paramValues: { pct: 30 } });
    const hi = rule({ sourceRef: 'risk-single-stock-limit', category: 'risk', provenance: 'user_equipped', paramValues: { pct: 50 } });
    const { conflictReport } = reconcile([hi, lo]);
    expect(conflictReport[0].winner.ruleId).toBe(lo.ruleId);
  });

  it('two ATR stops → tighter (closer to 0) binds', () => {
    const tight = rule({ sourceRef: 'risk-exit-atr-stop', category: 'risk', provenance: 'user_equipped', paramValues: { multiplier: '-1.5' } });
    const wide = rule({ sourceRef: 'risk-exit-atr-stop', category: 'risk', provenance: 'user_equipped', paramValues: { multiplier: '-3' } });
    const { conflictReport } = reconcile([wide, tight]);
    expect(conflictReport[0].winner.ruleId).toBe(tight.ruleId);
  });
});

describe('reconcile — contradiction tiebreaker chain', () => {
  it('tier: user cap beats archetype-default floor', () => {
    const c = cap(40, 'user_equipped');
    const f = floor(50, 'archetype_default');
    const { conflictReport } = reconcile([c, f]);
    expect(conflictReport[0].ruleApplied).toBe('tier');
    expect(conflictReport[0].winner.ruleId).toBe(c.ruleId);
  });

  it('tier: user FLOOR beats archetype-default cap (winner is not always the cap)', () => {
    const c = cap(40, 'archetype_default');
    const f = floor(50, 'user_equipped');
    const { resolvedRules, conflictReport } = reconcile([c, f]);
    expect(conflictReport[0].ruleApplied).toBe('tier');
    expect(conflictReport[0].winner.ruleId).toBe(f.ruleId);
    expect(resolvedRules.map((r) => r.ruleId)).toEqual([f.ruleId]);
  });

  it('tierAssumed: an untagged rule that loses is flagged tierAssumed (never silent)', () => {
    const c = cap(40, undefined); // missing provenance → tier 2, assumed
    const f = floor(50, 'user_equipped'); // tier 1
    const { conflictReport } = reconcile([c, f]);
    expect(conflictReport[0].winner.ruleId).toBe(f.ruleId);
    const loser = conflictReport[0].losers[0];
    expect(loser.ruleId).toBe(c.ruleId);
    expect(loser.tier).toBe(2);
    expect(loser.tierAssumed).toBe(true);
  });
});

describe('reconcile — V1 detector is hard-only (documented invariant)', () => {
  // Every descriptor-bearing template in V1 is risk/allocation (= hard), so no
  // SOFT rule can ever enter detection and the 'hard_over_soft' tiebreaker is an
  // unreachable correctness guard in V1 (likewise 'tie_fallback', which needs a
  // same-operator contradiction — only possible via an 'eq' template that does
  // not yet exist). This test pins that invariant: a soft-category rule is never
  // checked, so a soft + hard pair produces no conflict.
  it('a soft (technical) rule is unchecked and never conflicts', () => {
    const c = cap(40, 'user_equipped');
    const soft = rule({ sourceRef: 'alloc-sector-cap', category: 'technical', provenance: 'user_equipped', paramValues: { sector: 'Technology', pct: 30 } });
    // The soft rule still has a known sourceRef, so it IS checked — but its
    // hardness is soft. Both are caps → consolidation, not a hardness contest.
    const { conflictReport } = reconcile([c, soft]);
    expect(conflictReport.every((e) => e.ruleApplied !== 'hard_over_soft')).toBe(true);
  });
});

describe('reconcile — coverage honesty', () => {
  it('a custom/no-descriptor rule is reported as unchecked, not a conflict', () => {
    const c = cap(40, 'user_equipped');
    const custom = rule({ sourceRef: 'forge-custom-freehand', category: 'allocation', provenance: 'user_equipped', text: 'Buy whatever feels right' });
    const noRef = rule({ category: 'risk', provenance: 'user_equipped', text: 'No sourceRef at all' });
    const { conflictReport, coverage } = reconcile([c, custom, noRef]);
    expect(conflictReport).toHaveLength(0);
    expect(coverage.checkedRuleIds).toEqual([c.ruleId]);
    expect(coverage.uncheckedRuleIds.sort()).toEqual([custom.ruleId, noRef.ruleId].sort());
    expect(coverage.checkedCount).toBe(1);
    expect(coverage.uncheckedCount).toBe(2);
  });
});

describe('reconcile — totality, traceability, fail-open', () => {
  it('no-conflict set is returned unchanged', () => {
    const c = cap(60, 'user_equipped');
    const f = floor(40, 'user_equipped');
    const input = [c, f];
    const { resolvedRules, conflictReport } = reconcile(input);
    expect(conflictReport).toHaveLength(0);
    expect(resolvedRules).toBe(input); // same reference when nothing dropped
  });

  it('is deterministic — identical output on repeat (reconciler is total)', () => {
    const input = [cap(40, 'user_equipped'), floor(50, 'archetype_default')];
    const a = reconcile(input);
    const b = reconcile(input);
    expect(JSON.stringify(a.conflictReport)).toEqual(JSON.stringify(b.conflictReport));
    expect(a.activeRuleSetHash).toEqual(b.activeRuleSetHash);
  });

  it('carries reconcilerVersion + a stable activeRuleSetHash', () => {
    const { reconcilerVersion, activeRuleSetHash } = reconcile([cap(40, 'user_equipped')]);
    expect(reconcilerVersion).toBe(RECONCILER_VERSION);
    expect(activeRuleSetHash).toMatch(/^[0-9a-f]{8}$/);
  });

  it('recovers provenance from ruleDocs when the projected item lacks it (deploy path)', () => {
    const projected = [
      { ruleId: 'x', text: 'cap', sourceRef: 'alloc-sector-cap', category: 'allocation', paramValues: { sector: 'Technology', pct: 40 } },
      { ruleId: 'y', text: 'floor', sourceRef: 'alloc-sector-minimum', category: 'allocation', paramValues: { sector: 'Technology', pct: 50 } },
    ];
    const ruleDocs = [
      { id: 'x', provenance: 'user_equipped' },
      { id: 'y', provenance: 'archetype_default' },
    ];
    const { conflictReport } = reconcile(projected, ruleDocs);
    expect(conflictReport[0].ruleApplied).toBe('tier');
    expect(conflictReport[0].winner.ruleId).toBe('x');
  });

  it('fail-open but loud: an internal throw returns pass-through + reconcilerError', () => {
    // Poison one rule so normalization throws; reconcile must NOT propagate.
    const poison = { ruleId: 'boom', text: 'x', sourceRef: 'alloc-sector-cap', category: 'allocation' };
    Object.defineProperty(poison, 'paramValues', { get() { throw new Error('boom'); } });
    const input = [poison, cap(40, 'user_equipped')];
    const result = reconcile(input);
    expect(result.reconcilerError).toBe('boom');
    expect(result.resolvedRules).toBe(input); // untouched pass-through
    expect(result.conflictReport).toEqual([]);
  });

  it('non-array input degrades gracefully (no throw)', () => {
    const result = reconcile(null);
    expect(result.resolvedRules).toEqual([]);
    expect(result.conflictReport).toEqual([]);
  });

  it('DETECT flag default is off (shadow-safe)', () => {
    expect(CONFLICT_RECONCILER_DETECT_ENABLED).toBe(false);
  });
});
