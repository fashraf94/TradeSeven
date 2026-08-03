// api/_utils/agentBaselineCompleteness.test.js
//
// Containment — the deploy gate must never let an agent battle be created active
// on an incomplete/unusable/fallback-derived baseline set. These tests pin the
// pure usability decision the gate in api/agent/decide.js relies on.

import { describe, it, expect } from 'vitest';
import { isUsableBaseline, assessRequiredBaselines } from './agentBaselineCompleteness.js';

describe('agentBaselineCompleteness — isUsableBaseline', () => {
  it('accepts a finite, strictly-positive number', () => {
    expect(isUsableBaseline(150)).toBe(true);
    expect(isUsableBaseline(0.01)).toBe(true);
    expect(isUsableBaseline(1e6)).toBe(true);
  });

  it('rejects zero, negative, NaN, Infinity, and non-numbers', () => {
    for (const bad of [0, -5, NaN, Infinity, -Infinity, '150', null, undefined, {}, []]) {
      expect(isUsableBaseline(bad)).toBe(false);
    }
  });
});

describe('agentBaselineCompleteness — assessRequiredBaselines', () => {
  it('a complete valid baseline set is complete', () => {
    const r = assessRequiredBaselines(['AAPL', 'NVDA'], { AAPL: 150, NVDA: 900 });
    expect(r.complete).toBe(true);
    expect(r.missing).toEqual([]);
    expect(r.requiredCount).toBe(2);
    expect(r.usableCount).toBe(2);
  });

  it('empty validated result -> incomplete, names every required symbol', () => {
    const r = assessRequiredBaselines(['AAPL', 'NVDA'], {});
    expect(r.complete).toBe(false);
    expect(r.missing.sort()).toEqual(['AAPL', 'NVDA']);
    expect(r.usableCount).toBe(0);
  });

  it('undefined/null price map -> incomplete (no throw)', () => {
    expect(assessRequiredBaselines(['AAPL'], undefined).complete).toBe(false);
    expect(assessRequiredBaselines(['AAPL'], null).complete).toBe(false);
  });

  it('one missing required symbol -> incomplete and names it', () => {
    const r = assessRequiredBaselines(['AAPL', 'NVDA'], { AAPL: 150 });
    expect(r.complete).toBe(false);
    expect(r.missing).toEqual(['NVDA']);
    expect(r.usableCount).toBe(1);
  });

  it('zero / negative / NaN / Infinity / non-number values are unusable', () => {
    expect(assessRequiredBaselines(['A'], { A: 0 }).complete).toBe(false);
    expect(assessRequiredBaselines(['A'], { A: -5 }).complete).toBe(false);
    expect(assessRequiredBaselines(['A'], { A: NaN }).complete).toBe(false);
    expect(assessRequiredBaselines(['A'], { A: Infinity }).complete).toBe(false);
    expect(assessRequiredBaselines(['A'], { A: '150' }).complete).toBe(false);
  });

  it('a fallback-derived symbol is unusable even when its price is finite/positive', () => {
    const r = assessRequiredBaselines(
      ['AAPL', 'NVDA'],
      { AAPL: 150, NVDA: 900 },
      new Set(['NVDA']),
    );
    expect(r.complete).toBe(false);
    expect(r.missing).toEqual(['NVDA']);
    expect(r.usableCount).toBe(1);
  });

  it('accepts the fallback set as a plain array too', () => {
    const r = assessRequiredBaselines(['AAPL'], { AAPL: 150 }, ['AAPL']);
    expect(r.complete).toBe(false);
    expect(r.missing).toEqual(['AAPL']);
  });

  it('extra non-required symbols never block a deploy (only required are checked)', () => {
    const r = assessRequiredBaselines(
      ['AAPL'],
      { AAPL: 150, BENCH1: 0, BENCH2: NaN, CPUX: 10 },
      new Set(['BENCH1']),
    );
    expect(r.complete).toBe(true);
    expect(r.missing).toEqual([]);
  });

  it('empty / non-array required set is vacuously complete (nothing to protect)', () => {
    expect(assessRequiredBaselines([], { AAPL: 150 }).complete).toBe(true);
    expect(assessRequiredBaselines(undefined, {}).complete).toBe(true);
    expect(assessRequiredBaselines(null, {}).complete).toBe(true);
  });

  it('dedups required symbols and drops falsy entries', () => {
    const r = assessRequiredBaselines(['AAPL', 'AAPL', null, ''], { AAPL: 150 });
    expect(r.requiredCount).toBe(1);
    expect(r.complete).toBe(true);
  });

  it('the returned outcome carries only symbol names + counts (sanitized shape)', () => {
    const r = assessRequiredBaselines(['AAPL', 'NVDA'], { AAPL: 150 });
    expect(Object.keys(r).sort()).toEqual(['complete', 'missing', 'requiredCount', 'usableCount']);
    for (const sym of r.missing) expect(typeof sym).toBe('string');
    const serialized = JSON.stringify(r);
    expect(serialized).not.toMatch(/api_token|http|wss:|token|secret/i);
  });
});
