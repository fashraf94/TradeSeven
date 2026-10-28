// api/_utils/setupEvaluator/tfSetupV1.holding.test.js
//
// Measured Trend Evidence, slice 1 (P3) — V3 build prompt §9.2: the holding
// evaluator's chart leg (definition §4; Practice Field Amendment A, A6). A
// separate function and record: it never reads an entry verdict, and an
// invalid(extended) or invalid(no_setup) candidate says nothing about the
// same name held.

import { describe, it, expect } from 'vitest';
import { evaluateTfHolding, evaluateTfEntry, deriveChartLeg, HOLDING_CHECKS, FACT_NAMES } from './tfSetupV1.js';
import { THRESHOLDS_HASH, SEMANTICS_ID } from './thresholds.js';
import { SCENARIOS, SCENARIO_NAMES, buildBars, evidenceOf } from './__fixtures__/syntheticBars.js';

const run = (name) => evaluateTfHolding(SCENARIOS[name].build(), SCENARIOS[name].options);
const checkOf = (rec, id) => rec.checks.find((c) => c.id === id);
const holdingResults = (rec) => Object.fromEntries(HOLDING_CHECKS.map((id) => [id, checkOf(rec, id).result]));
const HOLDING_SCENARIOS = SCENARIO_NAMES.filter((n) => SCENARIOS[n].kind === 'holding');

describe('each check true (definition §4)', () => {
  it('close_below_slow alone: broken, reasons [close_below_slow]', () => {
    const r = run('holding_close_below_slow');
    expect(holdingResults(r)).toEqual({ close_below_slow: true, structure_break: false, regime_flip: false });
    // SMA_slow = (85 + Σ_{i=1..49} (100 − 0.25 i)) / 50 = (85 + 4900 − 306.25) / 50 = 93.575
    expect(checkOf(r, 'close_below_slow')).toEqual({ id: 'close_below_slow', lhs: 85, op: '<', rhs: 93.575, result: true, facts: ['C', 'SMA_slow'] });
    expect([r.chartLeg, r.reasons, r.regime]).toEqual(['broken', ['close_below_slow'], 'no_trend']);
  });

  it('structure_break alone: C below the supplied anchor, broken', () => {
    const r = run('holding_structure_break');
    expect(holdingResults(r)).toEqual({ close_below_slow: false, structure_break: true, regime_flip: false });
    expect(checkOf(r, 'structure_break')).toEqual({ id: 'structure_break', lhs: 100, op: '<', rhs: 100.5, result: true, facts: ['C', 'anchorSwingLow'] });
    expect([r.chartLeg, r.reasons]).toEqual(['broken', ['structure_break']]);
    expect(r.anchorSwingLow).toEqual({ value: 100.5, provenance: 'supplied' });
  });

  it('regime_flip: a downtrend is broken (the mirror stack puts C below SMA_slow too, so close_below_slow is true by construction)', () => {
    const r = run('holding_regime_flip');
    expect(holdingResults(r)).toEqual({ close_below_slow: true, structure_break: false, regime_flip: true });
    expect(checkOf(r, 'regime_flip')).toEqual({ id: 'regime_flip', lhs: 'downtrend', op: '===', rhs: 'downtrend', result: true, facts: ['regime'] });
    expect([r.chartLeg, r.reasons, r.regime]).toEqual(['broken', ['close_below_slow', 'regime_flip'], 'downtrend']);
  });
});

describe('the absent anchor (ID-1 unbuilt)', () => {
  it('anchor absent with the other checks false: structure_break unknown, chartLeg unknown, provenance absent', () => {
    const r = run('holding_anchor_absent_all_false');
    expect(holdingResults(r)).toEqual({ close_below_slow: false, structure_break: 'unknown', regime_flip: false });
    expect([r.chartLeg, r.reasons]).toEqual(['unknown', []]);
    expect(r.anchorSwingLow).toEqual({ value: null, provenance: 'absent' });
    expect(checkOf(r, 'structure_break')).toMatchObject({ lhs: 100, rhs: null, result: 'unknown' });
  });

  it('anchor absent with close_below_slow true: broken', () => {
    const r = run('holding_anchor_absent_close_below_slow');
    expect(holdingResults(r)).toEqual({ close_below_slow: true, structure_break: 'unknown', regime_flip: false });
    expect([r.chartLeg, r.reasons]).toEqual(['broken', ['close_below_slow']]);
    expect(r.anchorSwingLow.provenance).toBe('absent');
  });

  it('a non-finite anchor is absent, never compared', () => {
    for (const bad of [NaN, Infinity, '100', undefined, null]) {
      const r = evaluateTfHolding(SCENARIOS.holding_intact_with_anchor.build(), { anchorSwingLow: bad });
      expect(r.anchorSwingLow, String(bad)).toEqual({ value: null, provenance: 'absent' });
      expect(checkOf(r, 'structure_break').result).toBe('unknown');
    }
  });
});

describe('intact', () => {
  it('all three false with an anchor: intact', () => {
    const r = run('holding_intact_with_anchor');
    expect(holdingResults(r)).toEqual({ close_below_slow: false, structure_break: false, regime_flip: false });
    expect([r.chartLeg, r.reasons, r.regime]).toEqual(['intact', [], 'uptrend']);
  });

  it('the series whose entry is invalid(extended) is intact for holding', () => {
    const name = 'holding_extended_series_intact';
    const entry = evaluateTfEntry(SCENARIOS[name].build());
    expect([entry.verdict, entry.reason]).toEqual(['invalid', 'extended']);
    const r = run(name);
    expect(r.chartLeg).toBe('intact');
  });

  it('the series whose entry is invalid(no_setup) is intact for holding', () => {
    const name = 'holding_no_setup_series_intact';
    const entry = evaluateTfEntry(SCENARIOS[name].build());
    expect([entry.verdict, entry.reason]).toEqual(['invalid', 'no_setup']);
    const r = run(name);
    expect(r.chartLeg).toBe('intact');
  });
});

describe('short history and refusals', () => {
  it('10 bars with no anchor: every check unknown, chartLeg unknown', () => {
    const r = run('holding_short_history');
    expect(holdingResults(r)).toEqual({ close_below_slow: 'unknown', structure_break: 'unknown', regime_flip: 'unknown' });
    expect([r.chartLeg, r.reasons, r.regime]).toEqual(['unknown', [], 'unknown']);
    expect(r.missing).toEqual(['SMA_fast', 'SMA_slow', 'SMA_slow_5ago', 'swingHigh', 'swingLow', 'ATR', 'V_avg']);
  });

  it('an adapter refusal is unknown throughout, with the anchor still recorded', () => {
    const r = evaluateTfHolding({ ok: false, reason: 'insufficient_history', detail: { required: 55, available: 40 }, asOf: '2026-10-09', basis: 'raw', source: 'eodhd_eod' }, { anchorSwingLow: 90 });
    expect(holdingResults(r)).toEqual({ close_below_slow: 'unknown', structure_break: 'unknown', regime_flip: 'unknown' });
    expect([r.chartLeg, r.reasons, r.regime]).toEqual(['unknown', [], 'unknown']);
    expect(r.anchorSwingLow).toEqual({ value: 90, provenance: 'supplied' });
    expect(r.refusal).toEqual({ reason: 'insufficient_history', detail: { required: 55, available: 40 } });
    expect(r.missing).toEqual([...FACT_NAMES]);
  });
});

describe('the record (V3 §5, §7)', () => {
  it.each(HOLDING_SCENARIOS)('%s has no verdict, no pattern, carries ruleSet / evidence / patterns / checks, and its chartLeg derives from its checks', (name) => {
    const r = run(name);
    expect(r).not.toHaveProperty('verdict');
    expect(r).not.toHaveProperty('pattern');
    expect(r).not.toHaveProperty('patternsSatisfied');
    expect(r.ruleSet).toEqual({ setupVersion: 'tf-setup-v1', thresholdsHash: THRESHOLDS_HASH, semanticsId: SEMANTICS_ID });
    expect(r.checks.map((c) => c.id)).toEqual(['regime_stack', 'slow_rising', 'regime_stack_down', 'slow_falling', 'close_below_slow', 'structure_break', 'regime_flip']);
    expect(Object.keys(r.patterns)).toEqual(['breakout', 'pullback_resume']);
    expect(deriveChartLeg(r.checks)).toBe(r.chartLeg);
    expect(r.reasons).toEqual(HOLDING_CHECKS.filter((id) => checkOf(r, id).result === true));
    expect(JSON.stringify(r)).not.toMatch(/owner|battleId/);
  });

  it('the holding never reads the entry verdict: the same evidence gives the same chart leg whether or not an entry record exists', () => {
    const ev = evidenceOf(buildBars({ patch: (b) => { b[2].low = 97.625; } }));
    const entry = evaluateTfEntry(ev);
    expect(entry.verdict).toBe('valid');
    const withEntry = evaluateTfHolding({ ...ev, entry }, { anchorSwingLow: 90 });
    const without = evaluateTfHolding(ev, { anchorSwingLow: 90 });
    expect(withEntry).toEqual(without);
    expect(without.chartLeg).toBe('intact');
  });

  it.each(HOLDING_SCENARIOS)('%s is deterministic and leaves its frozen input unmutated', (name) => {
    const ev = SCENARIOS[name].build();
    const before = JSON.stringify(ev);
    expect(evaluateTfHolding(ev, SCENARIOS[name].options)).toEqual(evaluateTfHolding(ev, SCENARIOS[name].options));
    expect(JSON.stringify(ev)).toBe(before);
  });
});
