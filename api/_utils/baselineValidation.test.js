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
import {
  errorATR,
  validateActivationPrice,
  selectPriorSessionBar,
  validateBadgeBaseline,
  resolveBadgeBaseline,
  resolveThresholdBaseline,
  T1_ACTIVATION_ATR,
  T2_PREVCLOSE_ATR,
} from './baselineValidation.js';
import { calculateAssetScoreServer } from './agentScoring.js';

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

// ===================== Guard 2 =====================

describe('selectPriorSessionBar', () => {
  const series = [
    { date: '2026-06-03', rawClose: 103 },
    { date: '2026-06-02', rawClose: 102 },
    { date: '2026-05-29', rawClose: 99 },
  ];

  it('returns the most recent bar strictly before the cutoff (today excluded)', () => {
    expect(selectPriorSessionBar(series, '2026-06-03')).toEqual({ date: '2026-06-02', rawClose: 102 });
  });

  it('returns the newest bar when today has no bar yet', () => {
    expect(selectPriorSessionBar(series, '2026-06-04')).toEqual({ date: '2026-06-03', rawClose: 103 });
  });

  it('skips a weekend gap (Monday cutoff -> Friday bar)', () => {
    // 2026-06-01 is a Monday; the prior session is Friday 2026-05-29.
    expect(selectPriorSessionBar(series, '2026-06-01')).toEqual({ date: '2026-05-29', rawClose: 99 });
  });

  it('returns null for empty/missing inputs', () => {
    expect(selectPriorSessionBar([], '2026-06-03')).toBeNull();
    expect(selectPriorSessionBar(null, '2026-06-03')).toBeNull();
    expect(selectPriorSessionBar(series, undefined)).toBeNull();
  });
});

describe('validateBadgeBaseline — raw-vs-raw (preferred path)', () => {
  it('stays silent when previousClose matches the prior-session raw close', () => {
    const r = validateBadgeBaseline({ previousClose: 100, refRawClose: 100, refAdjClose: 100, baseATR: 2.5 });
    expect(r.fired).toBe(false);
    expect(r.value).toBe(100);
  });

  it('stays silent within T2 (0.2 ATR)', () => {
    const r = validateBadgeBaseline({ previousClose: 100.5, refRawClose: 100, baseATR: 2.5 });
    expect(errorATR(100.5, 100, 2.5)).toBeLessThan(T2_PREVCLOSE_ATR);
    expect(r.fired).toBe(false);
    expect(r.value).toBe(100.5);
  });

  it('substitutes the raw close when previousClose disagrees beyond T2', () => {
    // 102 vs 100 on a 2.5% ATR asset = 0.8 ATR > 0.5 -> stale/wrong-session.
    const r = validateBadgeBaseline({ previousClose: 102, refRawClose: 100, baseATR: 2.5 });
    expect(r.fired).toBe(true);
    expect(r.corporateActionSuspected).toBe(false);
    expect(r.value).toBe(100);
  });

  it('raw-vs-raw does NOT fire on a split day (raw closes match)', () => {
    // A 2:1 split: adjusted close halves, but the raw close still equals the
    // raw previousClose -> no false fire because we compare raw-vs-raw.
    const r = validateBadgeBaseline({ previousClose: 100, refRawClose: 100, refAdjClose: 50, baseATR: 2.5 });
    expect(r.fired).toBe(false);
    expect(r.value).toBe(100);
  });
});

describe('validateBadgeBaseline — accept-and-tag fallback (raw close absent)', () => {
  it('stays silent when only adjusted is available but it agrees', () => {
    const r = validateBadgeBaseline({ previousClose: 100, refRawClose: undefined, refAdjClose: 100, baseATR: 2.5 });
    expect(r.fired).toBe(false);
    expect(r.value).toBe(100);
  });

  it('flags a likely corporate action but does NOT substitute (accept-and-tag)', () => {
    // Only adjusted close available and it diverges (split). We must NOT swap in
    // the adjusted close (that would fabricate a move vs a raw current); keep
    // previousClose and tag it.
    const r = validateBadgeBaseline({ previousClose: 100, refRawClose: undefined, refAdjClose: 50, baseATR: 2.5 });
    expect(r.fired).toBe(true);
    expect(r.corporateActionSuspected).toBe(true);
    expect(r.value).toBe(100); // accepted, not substituted
  });
});

describe('validateBadgeBaseline — guards', () => {
  it('does nothing when previousClose is missing/zero (caller guard owns it)', () => {
    expect(validateBadgeBaseline({ previousClose: 0, refRawClose: 100, baseATR: 2.5 }).fired).toBe(false);
    expect(validateBadgeBaseline({ previousClose: undefined, refRawClose: 100, baseATR: 2.5 }).fired).toBe(false);
  });

  it('accepts (no reference) when neither raw nor adjusted is available', () => {
    const r = validateBadgeBaseline({ previousClose: 100, refRawClose: undefined, refAdjClose: undefined, baseATR: 2.5 });
    expect(r.fired).toBe(false);
    expect(r.value).toBe(100);
  });
});

describe('resolveBadgeBaseline — stock vs crypto day boundary', () => {
  // After the ET close, the just-closed UTC crypto session shares the prior ET
  // date. A stock (ET) cutoff would mis-select an older bar; the crypto (UTC)
  // cutoff selects the correct just-closed session.
  const daily = [
    { date: '2026-06-02', rawClose: 200, close: 200 }, // just-closed UTC session
    { date: '2026-06-01', rawClose: 100, close: 100 }, // older session
  ];
  const etToday = '2026-06-02';   // ET calendar date at 8:45pm ET
  const utcToday = '2026-06-03';  // UTC has already rolled over

  it('crypto uses the UTC cutoff and validates against the just-closed session (silent)', () => {
    const r = resolveBadgeBaseline({
      daily, previousClose: 200, isCrypto: true, baseATR: 5.0, etToday, utcToday,
    });
    expect(r.fired).toBe(false);  // 200 matches the 2026-06-02 raw close
    expect(r.value).toBe(200);
  });

  it('stock uses the ET cutoff and selects the prior trading session', () => {
    const r = resolveBadgeBaseline({
      daily, previousClose: 100, isCrypto: false, baseATR: 2.5, etToday, utcToday,
    });
    expect(r.fired).toBe(false);  // ET cutoff -> 2026-06-01 raw close 100
    expect(r.value).toBe(100);
  });
});

// ===================== Guard 3 — swap-lock parity =====================

// Inline replica of agent-evaluate.js's badge-baseline precedence + Guard 2,
// to prove resolveThresholdBaseline (used by the swap path) is byte-equivalent.
function evalThresholdBaseline(a) {
  let pc = a.previousClose;
  if (!a.swapPrice && (!a.isActivationDay || !(a.startingPrice > 0))) {
    pc = resolveBadgeBaseline({
      daily: a.daily, previousClose: a.previousClose, isCrypto: a.isCrypto,
      baseATR: a.baseATR, etToday: a.etToday, utcToday: a.utcToday,
    }).value;
  }
  return a.swapPrice || (a.isActivationDay ? (a.startingPrice || pc) : pc);
}

describe('resolveThresholdBaseline — parity with agent-evaluate precedence', () => {
  const daily = [{ date: '2026-06-02', rawClose: 100, close: 100 }];
  const base = { daily, isCrypto: false, baseATR: 2.5, etToday: '2026-06-03', utcToday: '2026-06-03' };

  const cases = {
    'swap-day uses swapPrice':                 { ...base, swapPrice: 105, isActivationDay: false, startingPrice: 100, previousClose: 98 },
    'day-1 held uses startingPrice':           { ...base, swapPrice: undefined, isActivationDay: true, startingPrice: 100, previousClose: 98 },
    'day-2+ valid prev (silent)':              { ...base, swapPrice: undefined, isActivationDay: false, startingPrice: 100, previousClose: 100 },
    'day-2+ glitched prev (substituted)':      { ...base, swapPrice: undefined, isActivationDay: false, startingPrice: 100, previousClose: 120 },
    'day-1 missing startingPrice -> prev':     { ...base, swapPrice: undefined, isActivationDay: true, startingPrice: undefined, previousClose: 100 },
  };

  for (const [name, args] of Object.entries(cases)) {
    it(`matches the eval formula: ${name}`, () => {
      expect(resolveThresholdBaseline(args).baseline).toBe(evalThresholdBaseline(args));
    });
  }

  it('swap-day short-circuits without running Guard 2', () => {
    const r = resolveThresholdBaseline(cases['swap-day uses swapPrice']);
    expect(r.baseline).toBe(105);
    expect(r.guard2).toBeNull();
  });

  it('day-2+ glitched prev substitutes the prior-session raw close (100, not 120)', () => {
    const r = resolveThresholdBaseline(cases['day-2+ glitched prev (substituted)']);
    expect(r.baseline).toBe(100);
    expect(r.guard2.fired).toBe(true);
  });

  it('crypto uses the UTC cutoff for the prior-session lookup', () => {
    const cryptoDaily = [
      { date: '2026-06-02', rawClose: 200, close: 200 }, // just-closed UTC session
      { date: '2026-06-01', rawClose: 100, close: 100 },
    ];
    const r = resolveThresholdBaseline({
      swapPrice: undefined, isActivationDay: false, startingPrice: 100, previousClose: 200,
      daily: cryptoDaily, isCrypto: true, baseATR: 5.0, etToday: '2026-06-02', utcToday: '2026-06-03',
    });
    expect(r.baseline).toBe(200);  // matches the 2026-06-02 raw close, silent
    expect(r.guard2.fired).toBe(false);
  });
});

describe('Guard 3 badge outcome — a glitched day-2+ previousClose no longer fabricates badges', () => {
  // Near-flat ticker (exit ~ entry), day 2+, baseATR 2.5%. The feed returns a
  // stale/high previousClose of 106; the correct prior-session close is 100.
  const daily = [{ date: '2026-06-02', rawClose: 100, close: 100 }];
  const exitPrice = 100.03;
  const baseATR = 2.5;

  it('UNGUARDED baseline (106) fabricates Bust + Crash + Meltdown', () => {
    const tpc = ((exitPrice - 106) / 106) * 100; // ~ -5.6%
    const score = calculateAssetScoreServer(
      { symbol: 'SHOP', baseATR, tier: 'core', direction: null },
      ((exitPrice - 100) / 100) * 100, {}, {}, tpc,
    );
    expect(score.badges).toEqual(expect.arrayContaining(['bust', 'crash', 'meltdown']));
  });

  it('GUARDED baseline (Guard 3 substitutes 100) fires no negative badges', () => {
    const { baseline } = resolveThresholdBaseline({
      swapPrice: undefined, isActivationDay: false, startingPrice: 100, previousClose: 106,
      daily, isCrypto: false, baseATR, etToday: '2026-06-03', utcToday: '2026-06-03',
    });
    expect(baseline).toBe(100); // substituted prior-session raw close
    const tpc = ((exitPrice - baseline) / baseline) * 100; // ~ +0.03%
    const score = calculateAssetScoreServer(
      { symbol: 'SHOP', baseATR, tier: 'core', direction: null },
      ((exitPrice - 100) / 100) * 100, {}, {}, tpc,
    );
    expect(score.badges).not.toContain('bust');
    expect(score.badges).not.toContain('crash');
    expect(score.badges).not.toContain('meltdown');
  });
});
