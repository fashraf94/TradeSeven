// api/_utils/learning/learningValidators.test.js
import { describe, it, expect } from 'vitest';
import { validateReceipt } from './learningValidators.js';
import { makeReceiptSkeleton } from './learningSchemas.js';
import { RECEIPT_SOURCES, RECEIPT_EXIT_REASONS } from './learningEnums.js';

function validReceipt(overrides = {}) {
  return makeReceiptSkeleton({
    agentId: 'agent-1',
    battleId: 'battle-1',
    receiptSeq: 3,
    symbolIn: 'NVDA',
    symbolOut: 'AMD',
    source: 'haiku',
    exitReason: 'haiku_decision',
    ...overrides,
  });
}

describe('validateReceipt — closed enums, fail closed (ANNEX A5)', () => {
  it('accepts a well-formed receipt with in-enum source/exitReason', () => {
    const res = validateReceipt(validReceipt());
    expect(res).toEqual({ valid: true, errors: [] });
  });

  it('accepts every (source, exitReason) enum member combination', () => {
    for (const source of RECEIPT_SOURCES) {
      for (const exitReason of RECEIPT_EXIT_REASONS) {
        const res = validateReceipt(validReceipt({ source, exitReason }));
        expect(res.valid, `${source}/${exitReason}`).toBe(true);
      }
    }
  });

  it('FAILS CLOSED on out-of-enum source', () => {
    for (const bad of ['HAIKU', 'unknown', 'haiku ', '', null, undefined, 7]) {
      const res = validateReceipt(validReceipt({ source: bad }));
      expect(res.valid, `source=${JSON.stringify(bad)}`).toBe(false);
      expect(res.errors.join(' ')).toMatch(/source:/);
    }
  });

  it('FAILS CLOSED on out-of-enum exitReason', () => {
    for (const bad of ['haikudecision', 'emergency', 'stop_loss', '', null, undefined, 0]) {
      const res = validateReceipt(validReceipt({ exitReason: bad }));
      expect(res.valid, `exitReason=${JSON.stringify(bad)}`).toBe(false);
      expect(res.errors.join(' ')).toMatch(/exitReason:/);
    }
  });

  it('never coerces — an out-of-enum value is reported, not silently mapped', () => {
    const res = validateReceipt(validReceipt({ source: 'gameplan' })); // near-miss of 'gameplan_meeting'
    expect(res.valid).toBe(false);
    expect(res.errors.join(' ')).toContain('"gameplan"');
    expect(res.errors.join(' ')).toContain('fail closed');
  });

  it('flags missing identity fields', () => {
    expect(validateReceipt(validReceipt({ agentId: null })).valid).toBe(false);
    expect(validateReceipt(validReceipt({ battleId: '' })).valid).toBe(false);
    expect(validateReceipt(validReceipt({ receiptSeq: 0 })).valid).toBe(false);
    expect(validateReceipt(validReceipt({ receiptSeq: 1.5 })).valid).toBe(false);
    expect(validateReceipt(validReceipt({ symbolIn: null })).valid).toBe(false);
    expect(validateReceipt(validReceipt({ symbolOut: undefined })).valid).toBe(false);
  });

  it('never throws on malformed input', () => {
    expect(() => validateReceipt(null)).not.toThrow();
    expect(() => validateReceipt(undefined)).not.toThrow();
    expect(() => validateReceipt('nope')).not.toThrow();
    expect(() => validateReceipt([])).not.toThrow();
    expect(validateReceipt(null).valid).toBe(false);
  });
});

describe('validateReceipt — W1 archetype identity (Corpus Capture Patch)', () => {
  it('accepts null (absent identity) and any non-empty string', () => {
    expect(validateReceipt(validReceipt({ archetype: null })).valid).toBe(true);
    expect(validateReceipt(validReceipt({ archetype: 'degen' })).valid).toBe(true);
    expect(validateReceipt(validReceipt({ archetype: 'guardian' })).valid).toBe(true);
  });

  it('membership is NOT the validator\'s job — an out-of-set string stays VALID (warn-only lives at the capture seam)', () => {
    // A lost receipt is worse than an odd label: the legacy 'unknown' creation
    // sentinel and genuinely unexpected ids must never fail shape validation.
    expect(validateReceipt(validReceipt({ archetype: 'unknown' })).valid).toBe(true);
    expect(validateReceipt(validReceipt({ archetype: 'not_a_real_archetype' })).valid).toBe(true);
  });

  it('FAILS CLOSED on type violations (presence/type is the fail-closed half)', () => {
    for (const bad of [undefined, '', 42, false, {}, []]) {
      const res = validateReceipt(validReceipt({ archetype: bad }));
      expect(res.valid, `archetype=${JSON.stringify(bad)}`).toBe(false);
      expect(res.errors.join(' ')).toMatch(/archetype:/);
    }
  });
});
