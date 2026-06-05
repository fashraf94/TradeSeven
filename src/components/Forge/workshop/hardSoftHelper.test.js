// Tests for the hard/soft single source — Phase 1 category derivation AND the
// Phase 3 authored per-bundle override, with the central PARITY guarantee:
// with no override set, every result is identical to the category-derived value.

import { describe, it, expect } from 'vitest';
import {
  HARD_CATEGORIES,
  classifyRuleHardSoft,
  ruleCategory,
  normalizeHardness,
  bundleRuleHardness,
  resolveRuleHardness,
  isHardRule,
  bundleHardSoftCounts,
} from './hardSoftHelper';

const ruleDoc = (id, category) => ({ id, category, text: `${id} text` });

describe('classifyRuleHardSoft (Phase-1 category default)', () => {
  it('treats risk + allocation as hard, everything else as soft', () => {
    expect(classifyRuleHardSoft('risk')).toBe('hard');
    expect(classifyRuleHardSoft('allocation')).toBe('hard');
    expect(classifyRuleHardSoft('technical')).toBe('soft');
    expect(classifyRuleHardSoft('fundamental')).toBe('soft');
    expect(classifyRuleHardSoft('institutional')).toBe('soft');
    expect(classifyRuleHardSoft(null)).toBe('soft');
    expect(classifyRuleHardSoft(undefined)).toBe('soft');
  });
  it('HARD_CATEGORIES is exactly {risk, allocation}', () => {
    expect([...HARD_CATEGORIES].sort()).toEqual(['allocation', 'risk']);
  });
});

describe('ruleCategory', () => {
  it('reads a loaded rule doc category', () => {
    expect(ruleCategory({ category: 'risk' })).toBe('risk');
  });
  it('falls back to a KB template category', () => {
    expect(ruleCategory({ forgeTemplates: [{ category: 'allocation' }] })).toBe('allocation');
  });
  it('returns null for nullish input', () => {
    expect(ruleCategory(null)).toBeNull();
    expect(ruleCategory(undefined)).toBeNull();
  });
});

describe('normalizeHardness', () => {
  it("passes through 'hard' / 'soft' and nulls everything else", () => {
    expect(normalizeHardness('hard')).toBe('hard');
    expect(normalizeHardness('soft')).toBe('soft');
    expect(normalizeHardness('HARD')).toBeNull();
    expect(normalizeHardness('')).toBeNull();
    expect(normalizeHardness(undefined)).toBeNull();
    expect(normalizeHardness(true)).toBeNull();
  });
});

describe('resolveRuleHardness (override wins, else category)', () => {
  it('with no override, equals the category default (PARITY)', () => {
    expect(resolveRuleHardness(ruleDoc('a', 'risk'))).toBe('hard');
    expect(resolveRuleHardness(ruleDoc('b', 'technical'))).toBe('soft');
    expect(resolveRuleHardness(ruleDoc('c', 'risk'), undefined)).toBe('hard');
  });
  it('an explicit override beats the category default in both directions', () => {
    // soften a category-hard rule
    expect(resolveRuleHardness(ruleDoc('a', 'risk'), 'soft')).toBe('soft');
    // harden a category-soft rule
    expect(resolveRuleHardness(ruleDoc('b', 'technical'), 'hard')).toBe('hard');
  });
  it('an invalid override is ignored and falls back to category', () => {
    expect(resolveRuleHardness(ruleDoc('a', 'risk'), 'HARD')).toBe('hard');
    expect(resolveRuleHardness(ruleDoc('b', 'technical'), '')).toBe('soft');
    expect(resolveRuleHardness(ruleDoc('b', 'technical'), 'maybe')).toBe('soft');
  });
});

describe('isHardRule', () => {
  it('matches the category default with no override', () => {
    expect(isHardRule(ruleDoc('a', 'allocation'))).toBe(true);
    expect(isHardRule(ruleDoc('b', 'fundamental'))).toBe(false);
  });
  it('honors an override', () => {
    expect(isHardRule(ruleDoc('a', 'allocation'), 'soft')).toBe(false);
    expect(isHardRule(ruleDoc('b', 'fundamental'), 'hard')).toBe(true);
  });
});

describe('bundleRuleHardness', () => {
  it('reads the per-rule override off the bundle doc', () => {
    const bundle = { ruleHardness: { r1: 'soft' } };
    expect(bundleRuleHardness(bundle, 'r1')).toBe('soft');
    expect(bundleRuleHardness(bundle, 'r2')).toBeUndefined();
    expect(bundleRuleHardness({}, 'r1')).toBeUndefined();
    expect(bundleRuleHardness(null, 'r1')).toBeUndefined();
  });
});

describe('bundleHardSoftCounts', () => {
  const rulesById = {
    stop: ruleDoc('stop', 'risk'),
    sect: ruleDoc('sect', 'allocation'),
    rsi: ruleDoc('rsi', 'technical'),
    pe: ruleDoc('pe', 'fundamental'),
  };
  const bundle = { ruleIds: ['stop', 'sect', 'rsi', 'pe'] };

  it('with no ruleHardness, counts by category (2 hard, 2 soft)', () => {
    expect(bundleHardSoftCounts(bundle, rulesById)).toEqual({ hard: 2, soft: 2, total: 4 });
  });

  it('PARITY: an empty ruleHardness map is identical to none', () => {
    const withEmpty = { ...bundle, ruleHardness: {} };
    expect(bundleHardSoftCounts(withEmpty, rulesById)).toEqual(
      bundleHardSoftCounts(bundle, rulesById),
    );
  });

  it('softening a category-hard rule drops the hard count', () => {
    const b = { ...bundle, ruleHardness: { stop: 'soft' } };
    expect(bundleHardSoftCounts(b, rulesById)).toEqual({ hard: 1, soft: 3, total: 4 });
  });

  it('hardening a category-soft rule raises the hard count', () => {
    const b = { ...bundle, ruleHardness: { rsi: 'hard' } };
    expect(bundleHardSoftCounts(b, rulesById)).toEqual({ hard: 3, soft: 1, total: 4 });
  });

  it('a Map of rulesById works too', () => {
    const map = new Map(Object.entries(rulesById));
    expect(bundleHardSoftCounts(bundle, map)).toEqual({ hard: 2, soft: 2, total: 4 });
  });

  it('unresolved rules with no override default to soft (never overstates)', () => {
    const b = { ruleIds: ['ghost', 'stop'] };
    expect(bundleHardSoftCounts(b, rulesById)).toEqual({ hard: 1, soft: 1, total: 2 });
  });

  it('handles an empty / missing bundle', () => {
    expect(bundleHardSoftCounts(null, rulesById)).toEqual({ hard: 0, soft: 0, total: 0 });
    expect(bundleHardSoftCounts({ ruleIds: [] }, rulesById)).toEqual({ hard: 0, soft: 0, total: 0 });
  });
});
