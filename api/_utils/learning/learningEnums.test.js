// api/_utils/learning/learningEnums.test.js
import { describe, it, expect } from 'vitest';
import {
  RECEIPT_SOURCES,
  RECEIPT_EXIT_REASONS,
  D3_DISCRETIONARY_EXIT_REASONS,
  isValidSource,
  isValidExitReason,
  isAllowlistedDiscretionary,
} from './learningEnums.js';

describe('learningEnums — closed enums (ANNEX A5)', () => {
  it('source enum is exactly the five members, frozen', () => {
    expect([...RECEIPT_SOURCES]).toEqual(['haiku', 'archetype', 'risk_manager', 'guardrail', 'gameplan_meeting']);
    expect(Object.isFrozen(RECEIPT_SOURCES)).toBe(true);
  });

  it('exitReason enum is exactly the eight members, frozen', () => {
    expect([...RECEIPT_EXIT_REASONS]).toEqual([
      'haiku_decision', 'bust_avoidance', 'vwap_failure', 'stepped_trail',
      'stagnation', 'guardrail_stopLoss', 'guardrail_trailingStop', 'gameplan_rotation',
    ]);
    expect(Object.isFrozen(RECEIPT_EXIT_REASONS)).toBe(true);
  });

  it('isValidSource accepts members and rejects out-of-enum / coercions', () => {
    for (const s of RECEIPT_SOURCES) expect(isValidSource(s)).toBe(true);
    for (const bad of ['HAIKU', 'haiku ', 'unknown', '', null, undefined, 0, 'gameplan', 'risk']) {
      expect(isValidSource(bad)).toBe(false);
    }
  });

  it('isValidExitReason accepts members and rejects out-of-enum', () => {
    for (const r of RECEIPT_EXIT_REASONS) expect(isValidExitReason(r)).toBe(true);
    for (const bad of ['haikudecision', 'HAIKU_DECISION', 'emergency', null, undefined, 42, 'stop_loss']) {
      expect(isValidExitReason(bad)).toBe(false);
    }
  });
});

describe('D3 discretionary allowlist (ANNEX A5)', () => {
  it('allowlist is exactly {haiku_decision}', () => {
    expect([...D3_DISCRETIONARY_EXIT_REASONS]).toEqual(['haiku_decision']);
  });

  it('includes iff exitReason === haiku_decision (fail closed on all else)', () => {
    expect(isAllowlistedDiscretionary('haiku_decision')).toBe(true);
    // Every OTHER valid exitReason is excluded — including the guardrail reasons.
    for (const r of RECEIPT_EXIT_REASONS.filter((x) => x !== 'haiku_decision')) {
      expect(isAllowlistedDiscretionary(r)).toBe(false);
    }
    // And out-of-enum values fail closed.
    for (const bad of [null, undefined, '', 'haiku', 'bust_avoidance ', 'stagnation']) {
      expect(isAllowlistedDiscretionary(bad)).toBe(false);
    }
  });

  it('EMERGENCY_BYPASS_REASONS is NOT the exclusion set — stagnation/gameplan_rotation are valid exitReasons but not discretionary', () => {
    // These two are exactly the ones EMERGENCY_BYPASS_REASONS omits; prove they
    // are recognized enum members yet excluded from the discretionary allowlist.
    expect(isValidExitReason('stagnation')).toBe(true);
    expect(isValidExitReason('gameplan_rotation')).toBe(true);
    expect(isAllowlistedDiscretionary('stagnation')).toBe(false);
    expect(isAllowlistedDiscretionary('gameplan_rotation')).toBe(false);
  });
});
