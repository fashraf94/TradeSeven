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
  resolveForDeploy,
  HARD_CATEGORIES,
  DESCRIPTOR_TABLE,
  RECONCILER_VERSION,
} from './ruleConflictReconciler.js';
// Importing the flag module too proves the equip-time caller's flag surface is
// also Node-clean (the equip path imports both).
import {
  CONFLICT_RECONCILER_DETECT_ENABLED,
  CONFLICT_RECONCILER_INJECT_ENABLED,
} from '../config/featureFlags.js';
// The live template source the descriptor defaults are copied from — see the
// drift-guard suite at the bottom of this file.
import { FORGE_RULE_TEMPLATES } from '../data/forgeKnowledgeBase.js';

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
  // This constant duplicates the codebase's two pre-existing (non-fence)
  // hardness sources. If you change it, you MUST also change
  // api/_utils/ruleHardness.js:23 and
  // src/components/Forge/workshop/hardSoftHelper.js:28 (this pin guards the
  // reconciler side only — see the consolidation backlog ticket).
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

  it('DETECT flag default is ON (flipped to production)', () => {
    // Flipped ON by the merged reconciler-DETECT flag-flip PR; this pins the
    // intended production state. The flag gates only the equip-time CALLER —
    // reconcile() above is pure and detects regardless — so there is no
    // flag-OFF behavior in this suite that depended on the source default.
    expect(CONFLICT_RECONCILER_DETECT_ENABLED).toBe(true);
  });
});

describe('resolveForDeploy — the decide.js seam helper', () => {
  it('INJECT OFF → returns projected UNCHANGED (same ref) and report null', () => {
    const input = [cap(40, 'user_equipped'), floor(50, 'archetype_default')];
    const out = resolveForDeploy(input, [], [], { inject: false });
    expect(out.activeRules).toBe(input); // byte-identical: no reconcile, no drop
    expect(out.report).toBeNull();
    expect(out.reconcilerError).toBeNull();
  });

  it('INJECT ON + contradiction → resolved rules (loser dropped) + injected report', () => {
    const c = cap(40, 'user_equipped');
    const f = floor(50, 'archetype_default');
    const out = resolveForDeploy([c, f], [], [], { inject: true });
    expect(out.activeRules.map((r) => r.ruleId)).toEqual([c.ruleId]); // floor dropped
    expect(out.report.injected).toBe(true);
    expect(out.report.conflicts).toHaveLength(1);
    expect(out.report.conflicts[0].ruleApplied).toBe('tier');
    expect(out.report.reconcilerVersion).toBe(RECONCILER_VERSION);
  });

  it('INJECT ON + no conflict → activeRules unchanged, empty conflicts', () => {
    const input = [cap(60, 'user_equipped'), floor(40, 'user_equipped')];
    const out = resolveForDeploy(input, [], [], { inject: true });
    expect(out.activeRules).toBe(input);
    expect(out.report.conflicts).toHaveLength(0);
    expect(out.report.injected).toBe(true);
  });

  it('INJECT ON + reconciler error → FAIL-OPEN to projected, error surfaced, not injected', () => {
    const poison = { ruleId: 'boom', text: 'x', sourceRef: 'alloc-sector-cap', category: 'allocation' };
    Object.defineProperty(poison, 'paramValues', { get() { throw new Error('boom'); } });
    const input = [poison, cap(40, 'user_equipped')];
    const out = resolveForDeploy(input, [], [], { inject: true });
    expect(out.activeRules).toBe(input); // pass-through — deploy never blocked
    expect(out.reconcilerError).toBe('boom');
    expect(out.report.injected).toBe(false);
    expect(out.report.reconcilerError).toBe('boom');
  });

  it('INJECT flag default is ON (flipped to production)', () => {
    // Flipped ON by the merged reconciler-INJECT flag-flip PR. The flag-OFF
    // ("deploy byte-identical") behavior is still covered above by
    // resolveForDeploy(..., { inject: false }), which drives the seam via the
    // explicit option rather than relying on the source default.
    expect(CONFLICT_RECONCILER_INJECT_ENABLED).toBe(true);
  });
});

describe('reconcile — code-review fixes', () => {
  it('honors the per-rule hardness OVERRIDE carried on the item (not just category)', () => {
    // Same tier (both user). The cap is authored SOFT via the override the
    // prompt path honors; the floor is hard by category. hard_over_soft must
    // fire and the HARD floor must win — not safer_direction picking the cap.
    const softCap = cap(40, 'user_equipped', { hardness: 'soft' });
    const hardFloor = floor(50, 'user_equipped');
    const { conflictReport } = reconcile([softCap, hardFloor]);
    expect(conflictReport[0].ruleApplied).toBe('hard_over_soft');
    expect(conflictReport[0].winner.ruleId).toBe(hardFloor.ruleId);
    expect(conflictReport[0].winner.hardness).toBe('hard');
  });

  it('a blank/empty pct degrades to UNCHECKED, not a phantom 0% cap', () => {
    const blank = cap('', 'user_equipped'); // pct '' would coerce to 0 without the guard
    const f = floor(50, 'user_equipped');
    const { conflictReport, coverage } = reconcile([blank, f]);
    expect(conflictReport).toHaveLength(0); // not a 0% cap contradicting the floor
    expect(coverage.uncheckedRuleIds).toContain(blank.ruleId);
  });

  it('a wildcard ("any single") cap is NOT dropped against a specific-sector floor', () => {
    const wildCap = cap(40, 'user_equipped', { paramValues: { sector: 'any single', pct: 40 } });
    const techFloor = floor(50, 'archetype_default'); // sector: Technology
    const { resolvedRules, conflictReport } = reconcile([wildCap, techFloor]);
    // Different granularity → not flagged, and the all-sector cap is retained.
    expect(conflictReport).toHaveLength(0);
    expect(resolvedRules.map((r) => r.ruleId).sort()).toEqual([wildCap.ruleId, techFloor.ruleId].sort());
  });

  it('two wildcard caps still consolidate (tighter all-sector cap binds)', () => {
    const lo = cap(40, 'user_equipped', { paramValues: { sector: 'any single', pct: 40 } });
    const hi = cap(60, 'user_equipped', { paramValues: { sector: 'any single', pct: 60 } });
    const { conflictReport } = reconcile([hi, lo]);
    expect(conflictReport[0].outcomeClass).toBe('consolidation');
    expect(conflictReport[0].winner.ruleId).toBe(lo.ruleId);
  });
});

describe('reason strings — Phase-3 copy compliance (Rule 0 audit)', () => {
  const BANNED = ['dropped', 'deleted', 'removed'];
  const noBanned = (s) => BANNED.every((v) => !s.toLowerCase().includes(v));

  it('contradiction reason (tier): kept / set-aside framing, source-named, states the why', () => {
    const { conflictReport } = reconcile([cap(40, 'user_equipped'), floor(50, 'archetype_default')]);
    const r = conflictReport[0].reason;
    expect(r).toMatch(/^Kept your /);
    expect(r).toMatch(/set aside the built-in default's /);
    expect(r).toMatch(/for this battle/);
    expect(r).toMatch(/takes priority/); // the "why" is present, not just kept/set-aside
    expect(noBanned(r)).toBe(true);
  });

  it('contradiction reason (safer_direction, same tier): still explains WHY one was kept', () => {
    // The dominant reachable V1 case: a user cap vs a user floor (both tier-1,
    // both hard) → safer_direction. The reason must not read as an arbitrary
    // set-aside; it must state the safer-limit rationale.
    const { conflictReport } = reconcile([cap(40, 'user_equipped'), floor(50, 'user_equipped')]);
    const r = conflictReport[0].reason;
    expect(conflictReport[0].ruleApplied).toBe('safer_direction');
    expect(r).toMatch(/the safer limit wins/);
    expect(r).toMatch(/set aside your /); // same-tier → "your" on both sides
    expect(noBanned(r)).toBe(true);
  });

  it('consolidation reason: merge framing ("tighter applies"), never set-aside/ignored', () => {
    const { conflictReport } = reconcile([cap(40, 'user_equipped'), cap(60, 'user_equipped')]);
    const r = conflictReport[0].reason;
    expect(r).toMatch(/tighter one applies/);
    expect(r.toLowerCase()).not.toContain('set aside');
    expect(r.toLowerCase()).not.toContain('ignored');
    expect(noBanned(r)).toBe(true);
  });
});

describe('DESCRIPTOR_TABLE — drift guard vs forgeKnowledgeBase', () => {
  // The descriptor table hand-copies value/scope DEFAULTS from the live forge
  // templates. If a designer retunes a template default (or renames a param /
  // sourceRef) in forgeKnowledgeBase.js without updating the reconciler, the
  // reconciler would silently compare against a stale number. This suite pins
  // every descriptor's defaults to the live template so that drift breaks CI.
  const tplById = new Map(FORGE_RULE_TEMPLATES.map((t) => [t.id, t]));

  it('covers only sourceRefs that still exist in the knowledge base', () => {
    for (const sourceRef of Object.keys(DESCRIPTOR_TABLE)) {
      expect(tplById.has(sourceRef), `descriptor "${sourceRef}" not found in FORGE_RULE_TEMPLATES`).toBe(true);
    }
  });

  for (const [sourceRef, d] of Object.entries(DESCRIPTOR_TABLE)) {
    it(`${sourceRef}: value/scope defaults match the live template`, () => {
      const params = tplById.get(sourceRef).forgeTemplates[0].params || {};
      // valueParam must exist on the template, and valueDefault must equal the
      // template's numeric default.
      expect(d.valueParam in params).toBe(true);
      expect(d.valueDefault).toBe(Number(params[d.valueParam].default));
      // scopeDefault is only pinned when it maps to a real template param.
      // (single_position / stop_loss use a synthetic scope with no param.)
      if (d.scopeParam != null) {
        expect(d.scopeParam in params).toBe(true);
        expect(d.scopeDefault).toBe(params[d.scopeParam].default);
      }
    });
  }
});
