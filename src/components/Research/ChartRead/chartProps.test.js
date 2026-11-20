// src/components/Research/ChartRead/chartProps.test.js
//
// The Chart view's read — WHAT THE CHART IS HANDED, every case (MK-5, MK-7, UC-1 – UC-5, CR-5, CR-7; spec
// docs/specs/CHART_READ_SPEC_V1.md).

import { describe, it, expect, beforeAll } from 'vitest';
import { bodyFor } from './__fixtures__/chartReadRecords.js';
import { readLineOf } from './chartRead.js';
import * as CP from './chartProps.js';
import { chartReadProps, barsMatchTimeframe } from './chartProps.js';
import { CHART_READ_COPY } from './chartReadCopy.js';

// FX-4's predicate, read through the namespace so the file loads before it exists (its rows then fail, not the file).
const weeklyAveragesHideMarks = (...a) => CP.weeklyAveragesHideMarks(...a);

const SESSION = '2026-11-17';
const L = {};
beforeAll(async () => {
  for (const s of ['VALID_PULLBACK', 'REGIME_A', 'UNKNOWN_V', 'SPLIT']) L[s] = readLineOf(await bodyFor(s, { session: SESSION }));
  L.ABSENT = readLineOf({ answer: 'absent', symbol: 'ABC', servedAt: 1, sessionsTried: [SESSION], read: null, previous: null });
});
const at = (over) => ({ line: L.VALID_PULLBACK, timeframe: '1D', battle: false, ruleOn: true, compact: false, lit: [], dailyDates: ['2026-11-17'], ...over });

describe('review L2-1: barsMatchTimeframe', () => {
  const days = (dates) => dates.map((date) => ({ date }));
  it('a day series is 1D, a week series is 1W; a mismatch, too few bars or any other timeframe is no', () => {
    const d = days(['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-16', '2026-11-17', '2026-11-18']);
    const w = days(['2026-10-19', '2026-10-26', '2026-11-02', '2026-11-09', '2026-11-16']);
    expect([barsMatchTimeframe(d, '1D'), barsMatchTimeframe(d, '1W'), barsMatchTimeframe(w, '1W'), barsMatchTimeframe(w, '1D')]).toEqual([true, false, true, false]);
    expect(barsMatchTimeframe(d.slice(0, 2), '1D')).toBe(false);
    expect(barsMatchTimeframe(d, 'battle')).toBe(false);
    expect(barsMatchTimeframe(null, '1D')).toBe(false);
    // a synthetic current-week bar dated today does not tip a week series
    expect(barsMatchTimeframe([...w, { date: '2026-11-18' }], '1W')).toBe(true);
  });
});

describe('chartReadProps', () => {
  it('1D: the raw candles and their note, the Rule chip on, the default marks', () => {
    const p = chartReadProps(at());
    expect(p).toEqual({ candleBasis: 'raw', basisNote: 'prices unadjusted', ruleChip: { on: true, label: 'Rule', disabled: false }, ruleMarks: { marks: L.VALID_PULLBACK.marks, shown: [1, 4, 5, 6], lit: [], dailyDates: ['2026-11-17'] } });
  });
  it('1W: the chip and the marks; no basis and no note (1W bars are raw already, UC-5)', () => {
    const p = chartReadProps(at({ timeframe: '1W' }));
    expect(p.candleBasis).toBeUndefined();
    expect(p.basisNote).toBeUndefined();
    expect(p.ruleMarks.shown).toEqual([1, 4, 5, 6]);
  });
  it('the Rule chip off: the chip stays, the marks go — unless the chart is compact (then every mark that exists, PG-3)', () => {
    expect(chartReadProps(at({ ruleOn: false }))).toEqual({ candleBasis: 'raw', basisNote: 'prices unadjusted', ruleChip: { on: false, label: 'Rule', disabled: false } });
    expect(chartReadProps(at({ ruleOn: false, compact: true, lit: [4, 1] })).ruleMarks).toMatchObject({ shown: [1, 2, 3, 4, 5, 6, 7], lit: [4, 1] });
    expect(chartReadProps(at({ ruleOn: false, compact: true })).ruleChip).toEqual({ on: true, label: 'Rule', disabled: true });
  });
  it('the Battle chart: one 20-day stub, labelled with the record\'s day — no chip, no marks, no basis (MK-5, MK-7, UC-5)', () => {
    const p = chartReadProps(at({ battle: true, timeframe: '1D' }));
    expect(p).toEqual({ dailyStub: { value: L.VALID_PULLBACK.marks.find((m) => m.n === 1).value, label: '20-day · daily · Tue close' } });
  });
  it('a read that shows no checks: the 1D candles still unadjusted under it (CR-7); no chip, no marks; Battle and 1W nothing', () => {
    for (const k of ['UNKNOWN_V', 'SPLIT', 'ABSENT']) {
      expect(chartReadProps(at({ line: L[k] }))).toEqual({ candleBasis: 'raw', basisNote: 'prices unadjusted' });
      expect(chartReadProps(at({ line: L[k], timeframe: '1W' }))).toBeNull();
      expect(chartReadProps(at({ line: L[k], battle: true }))).toBeNull();
    }
  });
  it('no read (off, loading, hidden, failed): nothing at all', () => {
    expect(chartReadProps(at({ line: null }))).toBeNull();
    expect(chartReadProps(at({ line: null, battle: true }))).toBeNull();
  });
  it('any other timeframe (the bomb views): nothing', () => {
    for (const tf of ['bomb', 'spectate', '1M']) expect(chartReadProps(at({ timeframe: tf }))).toBeNull();
  });
  it('regime: the marks 1, 2, 3', () => {
    expect(chartReadProps(at({ line: L.REGIME_A })).ruleMarks.shown).toEqual([1, 2, 3]);
  });
});

describe('FX-4 (founder Q-4): on 1W with SMA on, marks 1, 2 and 3 are not drawn, lit or unlit', () => {
  it('1W + SMA: 1 – 3 leave the shown and the lit lists; every other mark stays', () => {
    expect(chartReadProps(at({ timeframe: '1W', smaOn: true })).ruleMarks).toMatchObject({ shown: [4, 5, 6], lit: [] });
    expect(chartReadProps(at({ timeframe: '1W', smaOn: true, line: L.REGIME_A })).ruleMarks.shown).toEqual([]);
    expect(chartReadProps(at({ timeframe: '1W', smaOn: true, compact: true, lit: [2, 3] })).ruleMarks).toMatchObject({ shown: [4, 5, 6, 7], lit: [] });
    expect(chartReadProps(at({ timeframe: '1W', smaOn: true, compact: true, lit: [4, 1] })).ruleMarks.lit).toEqual([4]);
  });
  it('SMA off, or 1D: the marks come back', () => {
    expect(chartReadProps(at({ timeframe: '1W', smaOn: false })).ruleMarks.shown).toEqual([1, 4, 5, 6]);
    expect(chartReadProps(at({ timeframe: '1D', smaOn: true })).ruleMarks.shown).toEqual([1, 4, 5, 6]);
    expect(chartReadProps(at({ timeframe: '1D', smaOn: true, compact: true, lit: [2, 3] })).ruleMarks).toMatchObject({ shown: [1, 2, 3, 4, 5, 6, 7], lit: [2, 3] });
  });
  it('the state that hides them is one named predicate, and its quiet line is the copy module\'s', () => {
    expect([weeklyAveragesHideMarks({ timeframe: '1W', smaOn: true }), weeklyAveragesHideMarks({ timeframe: '1W', smaOn: false }), weeklyAveragesHideMarks({ timeframe: '1D', smaOn: true }), weeklyAveragesHideMarks({ timeframe: 'battle', smaOn: true })]).toEqual([true, false, false, false]);
    expect(CHART_READ_COPY.weeklyAveragesNote).toBe('On 1W the drawn averages are weekly; marks 1 to 3 are on 1D.');
  });
});

describe('PG-3: which marks show — the default set at full height, every mark compact, a tapped check\'s marks always, lit', () => {
  it('full height, Rule on: the default set; a tapped check outside it joins it, lit', () => {
    expect(chartReadProps(at()).ruleMarks).toMatchObject({ shown: [1, 4, 5, 6], lit: [] });
    // valid · Pullback's default set is 1, 4, 5, 6: "50-day rising" (2, 3) adds its two marks, lit
    expect(chartReadProps(at({ lit: [2, 3] })).ruleMarks).toMatchObject({ shown: [1, 2, 3, 4, 5, 6], lit: [2, 3] });
  });
  it('full height, Rule off: no marks — but a tapped check\'s marks show, lit, and the chip still reads off', () => {
    expect(chartReadProps(at({ ruleOn: false })).ruleMarks).toBeUndefined();
    const p = chartReadProps(at({ ruleOn: false, lit: [4, 1] }));
    expect(p.ruleMarks).toMatchObject({ shown: [1, 4], lit: [4, 1] });
    expect(p.ruleChip).toEqual({ on: false, label: 'Rule', disabled: false });
  });
  it('compact: every mark that exists; the chip pressed and disabled (it cannot turn them off)', () => {
    const p = chartReadProps(at({ compact: true, ruleOn: false }));
    expect(p.ruleMarks.shown).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(p.ruleChip).toEqual({ on: true, label: 'Rule', disabled: true });
  });
  it('a tapped mark that does not exist is never lit', () => {
    const regime = chartReadProps(at({ line: L.REGIME_A, lit: [9, 1] }));
    expect(regime.ruleMarks.lit).toEqual([1]);
  });
});
