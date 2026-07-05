// scripts/ws1-observe-walk.test.js
// WS1 observe-walk — decision-layer unit tests. Importing the module runs the
// Node-clean getRuleCompatInfo import (the classification source of truth) and the
// exported pure builders; main() is guarded behind the CLI entrypoint, so no
// admin/GCS/network is touched. That passing load is the BUILD_RULES §4 guard.
import { describe, it, expect } from 'vitest';
import { buildConflictEvent, buildPlan, resolveHardness } from './ws1-observe-walk.js';

const ts = '2026-07-04T00:00:00.000Z';

describe('resolveHardness (mirrors hardSoftHelper: risk|allocation = hard)', () => {
  it('maps categories + honors overrides', () => {
    expect(resolveHardness('risk')).toBe('hard');
    expect(resolveHardness('allocation')).toBe('hard');
    expect(resolveHardness('technical')).toBe('soft');
    expect(resolveHardness('technical', 'hard')).toBe('hard'); // override wins
  });
});

describe('buildConflictEvent (mirrors ruleCompatGuard.js:106-119)', () => {
  it('mean-reversion rule on Trend Follower + equip → compat_conflict_equip, blocked:false', () => {
    const e = buildConflictEvent({ templateId: 'tech-rsi-oversold', archetype: 'momentum_chaser', path: 'equip_bundle', resolvedHardness: 'soft', ruleDocId: 'x', ts });
    expect(e).toMatchObject({ type: 'compat_conflict_equip', ruleId: 'tech-rsi-oversold', state: 'core_conflict', zone1Ref: 'TF-Z1-BUY-STRENGTH', blocked: false, path: 'equip_bundle' });
  });

  it('promote-to-hard in observe → compat_promote_blocked, blocked:false (observe never blocks)', () => {
    const e = buildConflictEvent({ templateId: 'tech-rsi-oversold', archetype: 'momentum_chaser', path: 'set_rule_hardness', resolvedHardness: 'hard', ruleDocId: 'x', ts, mode: 'observe' });
    expect(e).toMatchObject({ type: 'compat_promote_blocked', blocked: false });
  });

  it('promote-to-hard in ENFORCE → blocked:true (guard would block)', () => {
    const e = buildConflictEvent({ templateId: 'tech-rsi-oversold', archetype: 'momentum_chaser', path: 'set_rule_hardness', resolvedHardness: 'hard', ruleDocId: 'x', ts, mode: 'enforce' });
    expect(e.blocked).toBe(true);
  });

  it('momentum-aligned rule on Trend Follower → SILENCE (null)', () => {
    expect(buildConflictEvent({ templateId: 'tech-moving-average-trend', archetype: 'momentum_chaser', path: 'equip_bundle', resolvedHardness: 'soft', ts })).toBeNull();
  });

  it('ts-01 on Capital Preserver → SILENCE (native — classifier not over-firing)', () => {
    expect(buildConflictEvent({ templateId: 'ts-01', archetype: 'guardian', path: 'set_rule_hardness', resolvedHardness: 'hard', ts })).toBeNull();
  });
});

describe('buildPlan', () => {
  const plan = buildPlan(ts);
  it('equip fires for the two buy-weakness rules and stays silent for the momentum-aligned one', () => {
    expect(plan.equip_bundle.post.events).toHaveLength(2);
    expect(plan.equip_bundle.post.events.map((e) => e.ruleId).sort()).toEqual(['tech-rsi-oversold', 'tv-06']);
    expect(plan.equip_bundle.post.events.every((e) => e.type === 'compat_conflict_equip' && e.blocked === false)).toBe(true);
  });
  it('promote emits one compat_promote_blocked (blocked:false)', () => {
    expect(plan.set_rule_hardness.post.events).toHaveLength(1);
    expect(plan.set_rule_hardness.post.events[0]).toMatchObject({ type: 'compat_promote_blocked', blocked: false });
  });
  it('change-archetype does two flips ending back at momentum_chaser', () => {
    expect(plan.change_archetype.flips).toEqual([['momentum_chaser', 'analyst'], ['analyst', 'momentum_chaser']]);
  });
  it('native control is silence (no event)', () => {
    expect(plan.native_control.event).toBeNull();
  });
});
