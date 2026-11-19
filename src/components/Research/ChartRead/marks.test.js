// src/components/Research/ChartRead/marks.test.js
//
// The Chart view's read — THE MARKS (build prompt §4, MK-1 – MK-3, CR-2; spec docs/specs/CHART_READ_SPEC_V1.md):
// every id and number pinned, each value the record's own field, a null value makes no mark, an unknown rule
// set makes none, and the marks shown by default per state.

import { describe, it, expect, beforeAll } from 'vitest';
import { bodyFor } from './__fixtures__/chartReadRecords.js';
import { MARK_TABLES, DEFAULT_MARKS, SLOW_5AGO_SESSIONS_BACK, marksOf, shownMarkNumbers, markCitation, hasMarkTable } from './marks.js';
import { RULE_SET_COPY } from './chartReadCopy.js';

const SESSION = '2026-11-17';
let VP;
let EX;
beforeAll(async () => {
  VP = await bodyFor('VALID_PULLBACK', { session: SESSION });
  EX = await bodyFor('EXTENDED', { session: SESSION });
});
const clone = (x) => structuredClone(x);
const check = (read, id) => read.checks.find((c) => c.id === id);

describe('CR-2 / MK-2: one fixed table per rule set — a number names exactly one value, everywhere', () => {
  it('tf-setup-v1, pinned id by id', () => {
    expect(Object.keys(MARK_TABLES)).toEqual(['tf-setup-v1']);
    expect(MARK_TABLES['tf-setup-v1'].map((m) => [m.n, m.id, m.kind])).toEqual([
      [1, 'sma_fast', 'tick'], [2, 'sma_slow', 'tick'], [3, 'sma_slow_5ago', 'tick'], [4, 'touch_low', 'bracket'],
      [5, 'swing_high', 'tick'], [6, 'swing_low', 'tick'], [7, 'extension_limit', 'tick'],
    ]);
    expect(Object.isFrozen(MARK_TABLES)).toBe(true);
    expect(Object.isFrozen(MARK_TABLES['tf-setup-v1'])).toBe(true);
    expect(MARK_TABLES['tf-setup-v1'].every((m) => Object.isFrozen(m))).toBe(true);
    expect(SLOW_5AGO_SESSIONS_BACK).toBe(5);
  });
  it('every mark id has its name in the rule set\'s words, and nothing else does', () => {
    expect(Object.keys(RULE_SET_COPY['tf-setup-v1'].marks)).toEqual(MARK_TABLES['tf-setup-v1'].map((m) => m.id));
  });
});

describe('MK-1: each value is the record\'s own field, and a mark exists only when it is a finite number', () => {
  it('the seven values and their days, from the projection', () => {
    const r = VP.read;
    const touch = check(r, 'pullback_touch');
    const marks = marksOf(r);
    expect(marks.map((m) => [m.n, m.value, m.day])).toEqual([
      [1, r.facts.SMA_fast, SESSION],
      [2, r.facts.SMA_slow, SESSION],
      [3, r.facts.SMA_slow_5ago, SESSION],
      [4, touch.lhs, r.pullbackLows.find((p) => p.low === touch.lhs).date],
      [5, r.swingHigh.value, r.swingHigh.date],
      [6, r.swingLow.value, r.swingLow.date],
      [7, check(r, 'extension').rhs, SESSION],
    ]);
    expect(marks.find((m) => m.n === 3).sessionsBack).toBe(5);
    expect(marks.find((m) => m.n === 4).days).toEqual(r.pullbackLows.map((p) => p.date));
    for (const m of marks) expect([m.ruleSet, m.session]).toEqual(['tf-setup-v1', SESSION]);
  });
  it('the touch mark IS the lowest of the three lows (the prompt\'s definition), as the evaluator recorded it', () => {
    for (const b of [VP, EX]) {
      const m = marksOf(b.read).find((x) => x.id === 'touch_low');
      expect(m.value).toBe(Math.min(...b.read.pullbackLows.map((p) => p.low)));
    }
  });
  it.each([
    ['sma_fast', (r) => { r.facts.SMA_fast = null; }],
    ['sma_slow', (r) => { r.facts.SMA_slow = null; }],
    ['sma_slow_5ago', (r) => { r.facts.SMA_slow_5ago = Number.NaN; }],
    ['touch_low', (r) => { check(r, 'pullback_touch').lhs = null; }],
    ['swing_high', (r) => { r.swingHigh.value = null; }],
    ['swing_low', (r) => { r.swingLow = { value: 101.37, date: null }; }],
    ['extension_limit', (r) => { check(r, 'extension').rhs = 'x'; }],
  ])('%s: a missing value (or day) makes no mark, and only that one', (id, mutate) => {
    const r = clone(VP.read);
    mutate(r);
    const ids = marksOf(r).map((m) => m.id);
    expect(ids).not.toContain(id);
    expect(ids).toHaveLength(6);
  });
  it('the bracket needs its three dated sessions; a value no low equals has no bar to sit on', () => {
    const short = clone(VP.read);
    short.pullbackLows = short.pullbackLows.slice(0, 2);
    expect(marksOf(short).map((m) => m.id)).not.toContain('touch_low');
    const off = clone(VP.read);
    check(off, 'pullback_touch').lhs = 1.37;
    expect(marksOf(off).map((m) => m.id)).not.toContain('touch_low');
  });
  it('an unknown rule set, no read, or no rule set at all → no marks (MK-2)', () => {
    const r = clone(VP.read);
    r.ruleSet.setupVersion = 'tf-setup-v2';
    expect(marksOf(r)).toEqual([]);
    expect(hasMarkTable(r)).toBe(false);
    expect(marksOf(null)).toEqual([]);
    expect(marksOf({ ...VP.read, ruleSet: null })).toEqual([]);
    expect(marksOf({ ...VP.read, ruleSet: { setupVersion: 'constructor' } })).toEqual([]);
  });
});

describe('MK-3: which marks show by default; with the chart compact, all that exist (PG-3)', () => {
  it('the defaults, pinned per state', () => {
    expect(DEFAULT_MARKS).toEqual({ valid_pullback: [1, 4, 5, 6], valid_breakout: [1, 5], regime: [1, 2, 3], no_setup: [1, 4, 5], extended: [1, 7] });
    const marks = marksOf(VP.read);
    expect(shownMarkNumbers('valid_pullback', marks)).toEqual([1, 4, 5, 6]);
    expect(shownMarkNumbers('extended', marks)).toEqual([1, 7]);
    expect(shownMarkNumbers('unknown', marks)).toEqual([]);
    expect(shownMarkNumbers('valid_pullback', marks, { compact: true })).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
  it('a default whose mark does not exist is simply not shown', () => {
    const r = clone(VP.read);
    r.swingLow.value = null;
    expect(shownMarkNumbers('valid_pullback', marksOf(r))).toEqual([1, 4, 5]);
    expect(shownMarkNumbers('valid_pullback', marksOf(r), { compact: true })).toEqual([1, 2, 3, 4, 5, 7]);
  });
});

describe('spec §12: a mark is cited by rule set, session and id', () => {
  it('"tf-setup-v1 · 2026-11-17 · touch_low"', () => {
    expect(markCitation(marksOf(VP.read).find((m) => m.n === 4))).toBe('tf-setup-v1 · 2026-11-17 · touch_low');
  });
});
