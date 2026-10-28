// api/_utils/setupEvaluator/tfSetupV1.entry.test.js
//
// Measured Trend Evidence, slice 1 (P3) — V3 build prompt §9.1: the entry
// evaluator on deterministic synthetic bars. Every row asserts the correct
// result of a defined rule or unknown path (definition §1–§5 as clarified by
// C1); none asserts a distribution of verdicts.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): this file's REAL, unmocked import
// of tfSetupV1.js (and through it technicalCalculations.js) is the runtime
// guard for the evaluator's import graph. Never mock it.

import { describe, it, expect } from 'vitest';
import {
  evaluateTfEntry, computeTfFacts, deriveEntryVerdict, deriveRegime, derivePatterns,
  FACT_NAMES, PATTERN_ORDER,
} from './tfSetupV1.js';
import { THRESHOLDS_HASH, SEMANTICS_ID, MIN_COMPLETED_BARS } from './thresholds.js';
import { SCENARIOS, SCENARIO_NAMES, buildBars, evidenceOf, BASE_SMA_FAST, BASE_SWING_HIGH, smaOf } from './__fixtures__/syntheticBars.js';

const run = (name) => evaluateTfEntry(SCENARIOS[name].build());
const checkOf = (rec, id) => rec.checks.find((c) => c.id === id);
const ENTRY_SCENARIOS = SCENARIO_NAMES.filter((n) => SCENARIOS[n].kind === 'entry');

describe('the base series is what the fixture says it is (hand-computed facts)', () => {
  it('SMA_fast 97.625, SMA_slow 93.875, SMA_slow_5ago 92.625, swingHigh 101.25 on bar 1, swingLow 93.5 on bar 20, ATR 3, V = V_avg = 1,000,000', () => {
    const ev = SCENARIOS.uptrend_no_setup.build();
    const { facts, evidence } = computeTfFacts(ev);
    expect(facts).toEqual({ C: 100, SMA_fast: 97.625, SMA_slow: 93.875, SMA_slow_5ago: 92.625, swingHigh: 101.25, swingLow: 93.5, ATR: 3, V: 1_000_000, V_avg: 1_000_000 });
    expect(evidence.swingHigh).toEqual({ value: 101.25, date: ev.bars[1].date });
    expect(evidence.swingLow).toEqual({ value: 93.5, date: ev.bars[20].date });
    expect(evidence.windows).toEqual({
      smaFast: { from: ev.bars[19].date, to: ev.bars[0].date },
      smaSlow: { from: ev.bars[49].date, to: ev.bars[0].date },
      smaSlowPrior: { from: ev.bars[54].date, to: ev.bars[5].date },
      swing: { from: ev.bars[20].date, to: ev.bars[1].date },
      atr: { from: ev.bars[14].date, to: ev.bars[0].date },
      volumeAvg: { from: ev.bars[20].date, to: ev.bars[1].date },
      pullbackTouch: { from: ev.bars[2].date, to: ev.bars[0].date },
    });
    expect(smaOf(ev.bars, 20)).toBe(97.625);
    expect(BASE_SMA_FAST).toBe(97.625);
    expect(BASE_SWING_HIGH).toBe(101.25);
  });
});

describe('regime (definition §2)', () => {
  it('the base uptrend with no pattern is invalid(no_setup), regime uptrend', () => {
    const r = run('uptrend_no_setup');
    expect([r.verdict, r.reason, r.pattern, r.patternsSatisfied, r.regime]).toEqual(['invalid', 'no_setup', null, [], 'uptrend']);
    expect(r.patterns).toEqual({ breakout: 'failed', pullback_resume: 'failed' });
    expect(checkOf(r, 'regime_stack')).toEqual({ id: 'regime_stack', lhs: [100, 97.625], op: '>', rhs: [97.625, 93.875], result: true, facts: ['C', 'SMA_fast', 'SMA_slow'] });
    expect(checkOf(r, 'slow_rising')).toEqual({ id: 'slow_rising', lhs: 93.875, op: '>', rhs: 92.625, result: true, facts: ['SMA_slow', 'SMA_slow_5ago'] });
  });

  it('a flat SMA_slow (equal to five bars ago) is not rising: invalid(regime), no_trend, even with the stack true', () => {
    const r = run('flat_slow_sma');
    expect([r.verdict, r.reason, r.regime]).toEqual(['invalid', 'regime', 'no_trend']);
    expect(checkOf(r, 'regime_stack').result).toBe(true);
    expect(checkOf(r, 'slow_rising')).toMatchObject({ lhs: 100.1, rhs: 100.1, result: false });
  });

  it('the downtrend mirror is invalid(regime) with regime downtrend', () => {
    const r = run('downtrend_mirror');
    expect([r.verdict, r.reason, r.regime]).toEqual(['invalid', 'regime', 'downtrend']);
    expect(checkOf(r, 'regime_stack_down').result).toBe(true);
    expect(checkOf(r, 'slow_falling').result).toBe(true);
  });

  it('C > SMA_fast with SMA_fast < SMA_slow is no_trend', () => {
    const r = run('bounce_fast_below_slow');
    expect([r.verdict, r.reason, r.regime]).toEqual(['invalid', 'regime', 'no_trend']);
    expect(r.factsUsed.C.value).toBeGreaterThan(r.factsUsed.SMA_fast.value);
    expect(r.factsUsed.SMA_fast.value).toBeLessThan(r.factsUsed.SMA_slow.value);
  });

  it('a null regime fact makes the verdict unknown(missing_fact) with regime unknown and every other fact still recorded', () => {
    const ev = evidenceOf(buildBars({ patch: (b) => { b[30].close = null; } }));
    const r = evaluateTfEntry(ev);
    expect([r.verdict, r.reason, r.regime]).toEqual(['unknown', 'missing_fact', 'unknown']);
    expect(r.missing).toEqual(['SMA_slow', 'SMA_slow_5ago']);
    expect(r.factsUsed.C.value).toBe(100);
    expect(r.factsUsed.SMA_fast.value).toBe(97.625);
    expect(r.factsUsed.ATR.value).toBe(3);
    expect(checkOf(r, 'regime_stack').result).toBe('unknown');
    expect(checkOf(r, 'slow_rising').result).toBe('unknown');
  });
});

describe('pattern A, breakout (definition §3; S3, S5, S7)', () => {
  it('C equal to swingHigh with volume above the multiple is valid/breakout', () => {
    const r = run('breakout_at_swing_high');
    expect([r.verdict, r.reason, r.pattern, r.patternsSatisfied]).toEqual(['valid', null, 'breakout', ['breakout']]);
    expect(checkOf(r, 'breakout_close')).toEqual({ id: 'breakout_close', lhs: 101.25, op: '>=', rhs: 101.25, result: true, facts: ['C', 'swingHigh'] });
  });

  it('volume at exactly 1.5x V_avg satisfies the multiple (>=)', () => {
    const r = run('breakout_volume_exact_1_5x');
    expect([r.verdict, r.pattern]).toEqual(['valid', 'breakout']);
    expect(checkOf(r, 'breakout_volume')).toEqual({ id: 'breakout_volume', lhs: 1_500_000, op: '>=', rhs: 1_500_000, result: true, facts: ['V', 'V_avg'] });
  });

  it('one cent below swingHigh is not a breakout', () => {
    const r = run('breakout_one_tick_below');
    expect([r.verdict, r.reason]).toEqual(['invalid', 'no_setup']);
    expect(checkOf(r, 'breakout_close')).toMatchObject({ lhs: 101.24, rhs: 101.25, result: false });
    expect(r.patterns.breakout).toBe('failed');
  });

  it('1.49x volume with no pullback is invalid(no_setup)', () => {
    const r = run('breakout_volume_1_49x');
    expect([r.verdict, r.reason, r.patternsSatisfied]).toEqual(['invalid', 'no_setup', []]);
    expect(checkOf(r, 'breakout_volume')).toMatchObject({ lhs: 1_490_000, rhs: 1_500_000, result: false });
    expect(checkOf(r, 'breakout_close').result).toBe(true);
  });
});

describe('pattern B, pullback-and-resume (definition §3; S8, S9)', () => {
  it('a touch on bar 2 exactly at SMA_fast is valid/pullback_resume', () => {
    const r = run('pullback_touch_bar2_exact');
    expect([r.verdict, r.reason, r.pattern, r.patternsSatisfied]).toEqual(['valid', null, 'pullback_resume', ['pullback_resume']]);
    expect(checkOf(r, 'pullback_touch')).toEqual({ id: 'pullback_touch', lhs: 97.625, op: '<=', rhs: 97.625, result: true, facts: ['pullbackLows', 'SMA_fast'] });
    expect(checkOf(r, 'pullback_close')).toEqual({ id: 'pullback_close', lhs: 100, op: '>', rhs: 97.625, result: true, facts: ['C', 'SMA_fast'] });
  });

  it('a touch on bar 3 only is outside the window: not a pullback', () => {
    const r = run('pullback_touch_bar3_only');
    expect([r.verdict, r.reason]).toEqual(['invalid', 'no_setup']);
    expect(checkOf(r, 'pullback_touch')).toMatchObject({ lhs: 98, result: false });
    expect(r.evidence.pullbackLows.map((p) => p.low)).toEqual([98.5, 98.25, 98]);
  });

  it('a close at SMA_fast is not a resume (strict >); the record shows it, and the regime refuses first', () => {
    const r = run('close_at_sma_fast');
    expect(checkOf(r, 'pullback_close')).toMatchObject({ lhs: 97.5, rhs: 97.5, result: false });
    expect(checkOf(r, 'pullback_touch').result).toBe(true);
    expect(r.patterns.pullback_resume).toBe('failed');
    expect([r.verdict, r.reason, r.regime]).toEqual(['invalid', 'regime', 'no_trend']);
  });

  it('a close below SMA_fast is not a resume either', () => {
    const r = run('close_below_sma_fast');
    expect(checkOf(r, 'pullback_close')).toMatchObject({ lhs: 97, rhs: 97.475, result: false });
    expect(r.patterns.pullback_resume).toBe('failed');
    expect([r.verdict, r.reason]).toEqual(['invalid', 'regime']);
  });

  it('both patterns satisfied: pattern is breakout (the first in order) and both are listed', () => {
    const r = run('both_patterns');
    expect([r.verdict, r.pattern, r.patternsSatisfied]).toEqual(['valid', 'breakout', ['breakout', 'pullback_resume']]);
    expect(r.patterns).toEqual({ breakout: 'satisfied', pullback_resume: 'satisfied' });
  });
});

describe('the extension guard (definition §3; S4, S10)', () => {
  it('a satisfied pullback beyond SMA_fast + 2 ATR is invalid(extended), the satisfied pattern still listed', () => {
    const r = run('extended_pullback');
    expect([r.verdict, r.reason, r.pattern, r.patternsSatisfied]).toEqual(['invalid', 'extended', null, ['pullback_resume']]);
    expect(checkOf(r, 'extension')).toEqual({ id: 'extension', lhs: 100, op: '<=', rhs: 99.8214, result: false, facts: ['C', 'SMA_fast', 'ATR'] });
    expect(r.factsUsed.ATR.value).toBe(1.0982);
  });

  it('a satisfied breakout beyond the guard is invalid(extended) too', () => {
    const r = run('extended_breakout');
    expect([r.verdict, r.reason, r.patternsSatisfied]).toEqual(['invalid', 'extended', ['breakout']]);
  });

  it('C exactly at SMA_fast + 2 ATR is valid (<=), with every number exact', () => {
    const r = run('at_extension_guard');
    expect([r.verdict, r.pattern]).toEqual(['valid', 'pullback_resume']);
    expect(r.factsUsed.SMA_fast.value).toBe(97.625);
    expect(r.factsUsed.ATR.value).toBe(1.1875);
    expect(checkOf(r, 'extension')).toMatchObject({ lhs: 100, rhs: 100, result: true });
  });
});

describe('history (MIN_COMPLETED_BARS = 55)', () => {
  it('54 bars is unknown(insufficient_history) with regime unknown', () => {
    const r = run('bars_54');
    expect([r.verdict, r.reason, r.regime, r.pattern]).toEqual(['unknown', 'insufficient_history', 'unknown', null]);
    expect(r.evidence.bars.count).toBe(54);
    expect(r.missing).toEqual(['SMA_slow_5ago']);
  });

  it('55 bars is evaluable', () => {
    const r = run('bars_55');
    expect([r.verdict, r.reason, r.regime]).toEqual(['invalid', 'no_setup', 'uptrend']);
    expect(r.evidence.bars.count).toBe(MIN_COMPLETED_BARS);
    expect(r.missing).toEqual([]);
  });
});

describe('C1 — pattern-scoped missing facts (FD-P3-1 option (a)) and the volume policy (§6.3)', () => {
  it('an unusable bar-0 volume with a satisfied pullback is valid/pullback_resume, missing [V], breakout untestable', () => {
    const r = run('c1_pullback_null_bar0_volume');
    expect([r.verdict, r.reason, r.pattern]).toEqual(['valid', null, 'pullback_resume']);
    expect(r.missing).toEqual(['V']);
    expect(r.patterns).toEqual({ breakout: 'untestable', pullback_resume: 'satisfied' });
    expect(checkOf(r, 'breakout_volume')).toMatchObject({ lhs: null, result: 'unknown' });
    expect(r.evidence.volume.bar0).toEqual({ date: r.asOf, value: null, usable: false, reason: 'null' });
  });

  it('a breakout price with an unusable volume and no pullback is unknown(missing_fact), never no_setup', () => {
    const r = run('c1_breakout_price_unusable_volume');
    expect([r.verdict, r.reason, r.regime]).toEqual(['unknown', 'missing_fact', 'uptrend']);
    expect(r.missing).toEqual(['V']);
    expect(r.patterns).toEqual({ breakout: 'untestable', pullback_resume: 'failed' });
    expect(checkOf(r, 'breakout_close').result).toBe(true);
  });

  it('one unusable volume inside bars 1..20 leaves V_avg null: breakout untestable, the pullback unaffected', () => {
    const r = run('c1_zero_volume_in_window');
    expect([r.verdict, r.pattern, r.missing]).toEqual(['valid', 'pullback_resume', ['V_avg']]);
    expect(r.patterns.breakout).toBe('untestable');
    expect(r.evidence.volume.avg).toEqual({ value: null, barsRequired: 20, barsUsable: 19, unusable: [{ date: SCENARIOS.c1_zero_volume_in_window.build().bars[7].date, reason: 'zero' }] });
    expect(r.evidence.volume.bar0.usable).toBe(true);
  });

  it.each([
    ['volume_bar0_null', 'null'], ['volume_bar0_zero', 'zero'], ['volume_bar0_negative', 'negative'], ['volume_bar0_non_finite', 'non_finite'],
  ])('%s: V is null with reason %s and the breakout is untestable', (name, reason) => {
    const r = run(name);
    expect(r.factsUsed.V.value).toBeNull();
    expect(r.factsUsed.V_avg.value).toBe(1_000_000);
    expect(r.evidence.volume.bar0).toMatchObject({ usable: false, reason });
    expect(r.missing).toEqual(['V']);
    expect(r.patterns.breakout).toBe('untestable');
    expect([r.verdict, r.reason]).toEqual(['unknown', 'missing_fact']);
  });

  it.each([
    ['volume_window_null', 'null'], ['volume_window_zero', 'zero'], ['volume_window_negative', 'negative'], ['volume_window_non_finite', 'non_finite'],
  ])('%s: V_avg is null, the bar is listed with reason %s, 19 bars usable', (name, reason) => {
    const r = run(name);
    const ev = SCENARIOS[name].build();
    expect(r.factsUsed.V.value).toBe(1_000_000);
    expect(r.factsUsed.V_avg.value).toBeNull();
    expect(r.evidence.volume.avg).toEqual({ value: null, barsRequired: 20, barsUsable: 19, unusable: [{ date: ev.bars[7].date, reason }] });
    expect(r.missing).toEqual(['V_avg']);
    expect(r.patterns.breakout).toBe('untestable');
  });

  it('V_avg is a mean over all 20 usable bars, never a reduced sample', () => {
    const ev = evidenceOf(buildBars({ patch: (b) => { for (let i = 1; i <= 20; i++) b[i].volume = 1_000_000 + i * 20; } }));
    const r = evaluateTfEntry(ev);
    expect(r.factsUsed.V_avg.value).toBe(1_000_210); // (20 × 1,000,000 + 20 × 210) / 20
    expect(r.evidence.volume.avg.barsUsable).toBe(20);
  });
});

describe('missing price facts', () => {
  it('a null high inside the swing and ATR windows leaves swingHigh and ATR null: unknown(missing_fact)', () => {
    const r = run('null_high_bar5');
    expect([r.verdict, r.reason, r.regime]).toEqual(['unknown', 'missing_fact', 'uptrend']);
    expect(r.missing).toEqual(['swingHigh', 'ATR']);
    expect(r.evidence.swingHigh).toEqual({ value: null, date: null });
    expect(checkOf(r, 'breakout_close').result).toBe('unknown');
    expect(checkOf(r, 'extension')).toMatchObject({ rhs: null, result: 'unknown' });
    expect(r.patterns).toEqual({ breakout: 'untestable', pullback_resume: 'failed' });
  });

  it('a null high at bar 20 leaves only swingHigh null (ATR reads bars 0..14)', () => {
    const r = run('null_high_bar20');
    expect(r.missing).toEqual(['swingHigh']);
    expect(r.factsUsed.ATR.value).toBe(3);
    expect([r.verdict, r.reason]).toEqual(['unknown', 'missing_fact']);
  });

  it('a non-positive price is a missing fact, never a number', () => {
    const r = evaluateTfEntry(evidenceOf(buildBars({ patch: (b) => { b[0].close = 0; } })));
    expect(r.factsUsed.C.value).toBeNull();
    expect(r.missing).toContain('C');
    expect([r.verdict, r.reason, r.regime]).toEqual(['unknown', 'missing_fact', 'unknown']);
  });
});

describe('an adapter refusal', () => {
  it('is unknown with the adapter\'s typed reason, every fact null, every check unknown, both patterns untestable', () => {
    const r = evaluateTfEntry({ ok: false, reason: 'missing_bar', detail: { expected: '2026-10-09', latest: '2026-10-08' }, asOf: '2026-10-09', basis: 'raw', source: 'eodhd_eod', symbol: 'X' });
    expect([r.verdict, r.reason, r.regime, r.pattern]).toEqual(['unknown', 'missing_bar', 'unknown', null]);
    expect(r.refusal).toEqual({ reason: 'missing_bar', detail: { expected: '2026-10-09', latest: '2026-10-08' } });
    expect(r.missing).toEqual([...FACT_NAMES]);
    expect(r.checks.every((c) => c.result === 'unknown')).toBe(true);
    expect(r.patterns).toEqual({ breakout: 'untestable', pullback_resume: 'untestable' });
    expect(r.evidence.bars).toEqual({ count: 0, newest: null, oldest: null });
    expect(r.ruleSet.semanticsId).toBe(SEMANTICS_ID);
  });
});

describe('the record (V3 §5)', () => {
  it.each(ENTRY_SCENARIOS)('%s carries ruleSet, evidence, patterns, checks, factsUsed with provenance, and no holding field', (name) => {
    const r = run(name);
    expect(r.ruleSet).toEqual({ setupVersion: 'tf-setup-v1', thresholdsHash: THRESHOLDS_HASH, semanticsId: SEMANTICS_ID });
    expect(r.basis).toBe('raw');
    expect(r.evidenceClass).toEqual({ bars: 'synthetic', verdict: 'derived' });
    expect(Object.keys(r.factsUsed)).toEqual([...FACT_NAMES]);
    for (const f of FACT_NAMES) expect(r.factsUsed[f]).toMatchObject({ asOf: r.asOf, source: 'synthetic', basis: 'raw' });
    expect(r.checks.map((c) => c.id)).toEqual(['regime_stack', 'slow_rising', 'regime_stack_down', 'slow_falling', 'breakout_close', 'breakout_volume', 'pullback_touch', 'pullback_close', 'extension']);
    expect(Object.keys(r.patterns)).toEqual([...PATTERN_ORDER]);
    expect(r.evidence.adjustment).toEqual({ metadata: 'absent', missingDates: [] });
    expect(r).not.toHaveProperty('chartLeg');
    expect(r).not.toHaveProperty('reasons');
    expect(r).not.toHaveProperty('anchorSwingLow');
    expect(JSON.stringify(r)).not.toMatch(/owner|battleId/);
  });

  it('evidence.pullbackLows holds the three dated lows actually compared, and swingHigh.date is the date of the maximum', () => {
    const ev = SCENARIOS.pullback_touch_bar2_exact.build();
    const r = evaluateTfEntry(ev);
    expect(r.evidence.pullbackLows).toEqual([
      { date: ev.bars[0].date, low: 98.5 }, { date: ev.bars[1].date, low: 98.25 }, { date: ev.bars[2].date, low: 97.625 },
    ]);
    expect(checkOf(r, 'pullback_touch').lhs).toBe(Math.min(...r.evidence.pullbackLows.map((p) => p.low)));
    const peaked = evidenceOf(buildBars({ patch: (b) => { b[12].high = 150; } }));
    const p = evaluateTfEntry(peaked);
    expect(p.evidence.swingHigh).toEqual({ value: 150, date: peaked.bars[12].date });
    expect(p.factsUsed.swingHigh.value).toBe(150);
  });

  it.each(ENTRY_SCENARIOS)('%s: the verdict recomputed from checks, patterns and the bar count alone equals the record\'s', (name) => {
    const r = run(name);
    const again = deriveEntryVerdict({ checks: r.checks, patterns: r.patterns, barCount: r.evidence.bars.count });
    expect(again).toEqual({ verdict: r.verdict, reason: r.reason, pattern: r.pattern, patternsSatisfied: r.patternsSatisfied, regime: r.regime });
    expect(deriveRegime(r.checks)).toBe(r.regime === 'unknown' && r.reason === 'insufficient_history' ? deriveRegime(r.checks) : r.regime);
    expect(derivePatterns(r.checks)).toEqual(r.patterns);
  });

  it.each(ENTRY_SCENARIOS)('%s is deterministic and leaves its frozen input unmutated', (name) => {
    const ev = SCENARIOS[name].build();
    const before = JSON.stringify(ev);
    const a = evaluateTfEntry(ev);
    const b = evaluateTfEntry(ev);
    expect(a).toEqual(b);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(ev)).toBe(before);
    expect(Object.isFrozen(ev.bars)).toBe(true);
  });
});
