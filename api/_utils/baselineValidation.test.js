// api/_utils/baselineValidation.test.js
//
// Guard 1 (activation-price validation) + the shared errorATR primitive.
//
// Core guarantees under test:
//  - Healthy data is recorded UNCHANGED (guard stays silent).
//  - A legitimate gap day is NOT rejected (principle 2 — never suppress a real
//    move): the gapped price sits inside today's [low, high] even though it is
//    far from the prior close in ATR terms.
//  - The documented misfire class (a wrong-but-positive read ~2 ATR off that is
//    also out of the day's range) IS rejected and a sane close substituted.
//  - Substitute-first, skip-as-last-resort (D3).
//  - Suspect snapshot path (R1): fallback / absent high/low drops the range
//    condition and leans on the ATR check.

import { describe, it, expect } from 'vitest';
import { errorATR, validateActivationPrice, T1_ACTIVATION_ATR } from './baselineValidation.js';

describe('errorATR', () => {
  it('expresses disagreement in ATR units (4% off / 2.5% ATR = 1.6 ATR)', () => {
    expect(errorATR(96, 100, 2.5)).toBeCloseTo(1.6, 5);
  });

  it('5% off a 2.5% ATR asset = 2.0 ATR (the misfire magnitude)', () => {
    expect(errorATR(95, 100, 2.5)).toBeCloseTo(2.0, 5);
  });

  it('returns 0 when candidate equals reference', () => {
    expect(errorATR(100, 100, 2.5)).toBe(0);
  });

  it('returns Infinity for unusable inputs (so a bad reference cannot pass)', () => {
    expect(errorATR(100, 0, 2.5)).toBe(Infinity);
    expect(errorATR(100, -5, 2.5)).toBe(Infinity);
    expect(errorATR(NaN, 100, 2.5)).toBe(Infinity);
    expect(errorATR(100, 100, 0)).toBe(Infinity);
    expect(errorATR(100, 100, NaN)).toBe(Infinity);
  });
});

describe('validateActivationPrice — healthy data stays silent', () => {
  it('records a near-flat current unchanged (guard silent)', () => {
    const r = validateActivationPrice({
      current: 100.03, high: 100.5, low: 99.8,
      fallback: false, recentClose: 100, previousClose: 100, baseATR: 2.5,
    });
    expect(r.fired).toBe(false);
    expect(r.value).toBe(100.03);
    expect(r.reason).toBeNull();
  });

  it('records an in-range price unchanged even with a modest ATR gap', () => {
    const r = validateActivationPrice({
      current: 101.2, high: 101.5, low: 100.9,
      fallback: false, recentClose: 100, previousClose: 100, baseATR: 2.5,
    });
    expect(r.fired).toBe(false);
    expect(r.value).toBe(101.2);
  });
});

describe('validateActivationPrice — legitimate gap day is preserved (principle 2)', () => {
  it('does NOT reject a real 4% overnight gap (current within today range)', () => {
    // Stock gapped down ~4% on real news; current sits inside today's [low, high]
    // even though it is 1.6 ATR from the prior close. Must be kept, not rejected.
    const r = validateActivationPrice({
      current: 96, high: 97, low: 95.5,
      fallback: false, recentClose: 100, previousClose: 100, baseATR: 2.5,
    });
    expect(errorATR(96, 100, 2.5)).toBeGreaterThan(T1_ACTIVATION_ATR); // far in ATR terms
    expect(r.fired).toBe(false);                                       // ...but still kept
    expect(r.value).toBe(96);
  });
});

describe('validateActivationPrice — corrupt read is rejected (the misfire)', () => {
  it('rejects a 2 ATR out-of-range read and substitutes previousClose', () => {
    // True price ~100 (today low 99.5 / high 100.6). A glitched feed returns 95:
    // out of range AND 2.0 ATR below the prior close -> reject, substitute.
    const r = validateActivationPrice({
      current: 95, high: 100.6, low: 99.5,
      fallback: false, recentClose: 100, previousClose: 100, baseATR: 2.5,
    });
    expect(r.fired).toBe(true);
    expect(r.value).toBe(100);          // substituted previousClose (most recent sane)
    expect(r.reason).toMatch(/outside/);
  });

  it('substitutes recentClose when previousClose is absent', () => {
    const r = validateActivationPrice({
      current: 95, high: 100.6, low: 99.5,
      fallback: false, recentClose: 100, previousClose: undefined, baseATR: 2.5,
    });
    expect(r.fired).toBe(true);
    expect(r.value).toBe(100);          // fell through to recentClose
  });

  it('omits the symbol (value null) when no sane close exists — skip as last resort', () => {
    const r = validateActivationPrice({
      current: 95, high: 100.6, low: 99.5,
      fallback: false, recentClose: 0, previousClose: 0, baseATR: 2.5,
    });
    expect(r.fired).toBe(true);
    expect(r.value).toBeNull();
  });

  it('does NOT reject an out-of-range read that is within T1 ATR (both conditions required)', () => {
    // current 99 is just below today's low 99.5 (out of range) but only 0.4 ATR
    // from prior close -> below T1 -> kept (one condition alone is insufficient).
    const r = validateActivationPrice({
      current: 99, high: 100.6, low: 99.5,
      fallback: false, recentClose: 100, previousClose: 100, baseATR: 2.5,
    });
    expect(r.fired).toBe(false);
    expect(r.value).toBe(99);
  });
});

describe('validateActivationPrice — suspect snapshot path (R1)', () => {
  it('normal real-time fallback (current === recentClose) stays silent', () => {
    // marketDataCache sets price.current = daily[0].close on real-time failure.
    const r = validateActivationPrice({
      current: 100, high: undefined, low: undefined,
      fallback: true, recentClose: 100, previousClose: undefined, baseATR: 2.5,
    });
    expect(r.fired).toBe(false);
    expect(r.value).toBe(100);
  });

  it('fallback read far from recentClose fires on the ATR check alone', () => {
    const r = validateActivationPrice({
      current: 95, high: undefined, low: undefined,
      fallback: true, recentClose: 100, previousClose: 100, baseATR: 2.5,
    });
    expect(r.fired).toBe(true);
    expect(r.value).toBe(100);
    expect(r.reason).toMatch(/suspect snapshot/);
  });

  it('absent high/low (no fallback flag) is still treated as suspect', () => {
    const r = validateActivationPrice({
      current: 95, high: undefined, low: undefined,
      fallback: false, recentClose: 100, previousClose: 100, baseATR: 2.5,
    });
    expect(r.fired).toBe(true);
    expect(r.value).toBe(100);
  });

  it('crypto default ATR (5%) tolerates a larger swing before firing', () => {
    // 4% off a 5% ATR asset = 0.8 ATR < T1 -> kept, even on a suspect snapshot.
    const r = validateActivationPrice({
      current: 96, high: undefined, low: undefined,
      fallback: true, recentClose: 100, previousClose: 100, baseATR: 5.0,
    });
    expect(r.fired).toBe(false);
    expect(r.value).toBe(96);
  });
});
