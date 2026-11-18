// src/components/Research/ChartRead/placeMarks.test.js
//
// The Chart view's read — WHERE THE MARKS SIT AND HOW THEY ARE DRAWN (MK-4, MK-5, CR-4; spec
// docs/specs/CHART_READ_SPEC_V1.md): each mark on its own day's bar on 1D, on the week bar holding its day on 1W,
// mark 3 five daily sessions back on both, nothing for a day with no bar; and the primitive's geometry — a tick
// seven bars wide centred on its bar, never to the chart's edge, a bracket under the three touch sessions, the
// number in a square, the lit mark thicker with its value on the price scale, the Battle stub at the right edge.

import { describe, it, expect, beforeAll } from 'vitest';
import { bodyFor } from './__fixtures__/chartReadRecords.js';
import { marksOf } from './marks.js';
import { placeMarks, calendarDateOf, weekStartOf, sessionsBefore } from './placeMarks.js';
import { layoutRuleMarks, axisLabels, RuleMarksPrimitive, TICK_BARS, LOW_TICK_BARS, LINE, STUB_LEN, BRACKET_DROP } from './ruleMarksPrimitive.js';
import { formatTime } from '../chartUtils.js';
import { formatPriceBare } from './format.js';

const SESSION = '2026-11-17';
let VP;
let rows;
beforeAll(async () => {
  VP = await bodyFor('VALID_PULLBACK', { session: SESSION });
  const { STATE_ROWS } = await import('./__fixtures__/chartReadRecords.js');
  rows = STATE_ROWS.VALID_PULLBACK(SESSION); // newest first
});
const barTimesOf = (dates) => [...dates].reverse().map((d) => formatTime(d, false)); // oldest first, as the chart's

describe('placeMarks', () => {
  it('1D: each shown mark on its own day\'s bar; mark 3 five daily sessions back; the touch bracket on its three bars', () => {
    const marks = marksOf(VP.read);
    const dates = rows.map((r) => r.date);
    const items = placeMarks({ marks, shown: [1, 2, 3, 4, 5, 6, 7], lit: [4], barTimes: barTimesOf(dates), timeframe: '1D', dailyDates: dates });
    const day = (n) => calendarDateOf(items.find((i) => i.n === n).time);
    expect(day(1)).toBe(SESSION);
    expect(day(3)).toBe(dates[5]); // five sessions before the record's day
    expect(day(5)).toBe(VP.read.swingHigh.date);
    expect(day(6)).toBe(VP.read.swingLow.date);
    expect(items.find((i) => i.n === 4).times.map(calendarDateOf)).toEqual(VP.read.pullbackLows.map((p) => p.date));
    expect(items.map((i) => [i.n, i.lit])).toEqual([[1, false], [2, false], [3, false], [4, true], [5, false], [6, false], [7, false]]);
    for (const i of items) expect(i.value).toBe(marks.find((m) => m.n === i.n).value); // positions only: the values pass through
  });
  it('only the shown numbers are placed', () => {
    const dates = rows.map((r) => r.date);
    expect(placeMarks({ marks: marksOf(VP.read), shown: [1, 4, 5, 6], lit: [], barTimes: barTimesOf(dates), timeframe: '1D', dailyDates: dates }).map((i) => i.n)).toEqual([1, 4, 5, 6]);
  });
  it('1W: a mark sits on the week bar that holds its date (MK-5)', () => {
    const dates = rows.map((r) => r.date);
    const weeks = [...new Set(dates.map(weekStartOf))]; // newest first
    const items = placeMarks({ marks: marksOf(VP.read), shown: [1, 3, 5], lit: [], barTimes: barTimesOf(weeks), timeframe: '1W', dailyDates: dates });
    expect(items.map((i) => [i.n, calendarDateOf(i.time)])).toEqual([[1, weekStartOf(SESSION)], [3, weekStartOf(dates[5])], [5, weekStartOf(VP.read.swingHigh.date)]]);
  });
  it('a date with no bar on the chart draws nothing — never the nearest bar', () => {
    const dates = rows.map((r) => r.date).filter((d) => d !== VP.read.swingHigh.date);
    const items = placeMarks({ marks: marksOf(VP.read), shown: [1, 5], lit: [], barTimes: barTimesOf(dates), timeframe: '1D', dailyDates: dates });
    expect(items.map((i) => i.n)).toEqual([1]);
    expect(placeMarks({ marks: marksOf(VP.read), shown: [3], lit: [], barTimes: barTimesOf(rows.map((r) => r.date)), timeframe: '1D', dailyDates: null })).toEqual([]);
    expect(sessionsBefore(SESSION, 5, rows.slice(0, 4).map((r) => r.date))).toBeNull();
  });
  it('the Battle chart and any other timeframe: no daily mark (MK-5)', () => {
    const dates = rows.map((r) => r.date);
    for (const tf of ['battle', 'bomb', 'spectate', null]) expect(placeMarks({ marks: marksOf(VP.read), shown: [1, 2], lit: [], barTimes: barTimesOf(dates), timeframe: tf, dailyDates: dates })).toEqual([]);
  });
});

describe('layoutRuleMarks — the primitive\'s geometry (MK-4, CR-4)', () => {
  const at = { toX: (t) => t * 10, toY: (p) => 1000 - p, spacing: 10, width: 400 };
  it('a tick: seven bars wide, centred on its bar, at its price; its number in a square at its left end — never to the edge', () => {
    const ops = layoutRuleMarks({ items: [{ n: 1, kind: 'tick', time: 20, value: 141.1, lit: false }] }, at);
    const line = ops.find((o) => o.op === 'line');
    expect(line).toEqual({ op: 'line', x0: 200 - (TICK_BARS / 2) * 10, x1: 200 + (TICK_BARS / 2) * 10, y: 1000 - 141.1, w: LINE.plain, n: 1 });
    expect(line.x1 - line.x0).toBe(70);
    expect(line.x1).toBeLessThan(at.width);
    expect(ops.find((o) => o.op === 'square')).toMatchObject({ n: 1, lit: false, y: 1000 - 141.1 });
  });
  it('a lit mark is thicker and its square filled; only lit marks show their value on the price scale', () => {
    const scene = { items: [{ n: 1, kind: 'tick', time: 20, value: 141.1, lit: true }, { n: 2, kind: 'tick', time: 20, value: 136.4, lit: false }] };
    const ops = layoutRuleMarks(scene, at);
    expect(ops.filter((o) => o.op === 'line').map((o) => o.w)).toEqual([LINE.lit, LINE.plain]);
    expect(ops.filter((o) => o.op === 'square').map((o) => o.lit)).toEqual([true, false]);
    expect(axisLabels(scene, { toY: at.toY, format: formatPriceBare })).toEqual([{ y: 1000 - 141.1, text: '141.10' }]);
  });
  it('the touch: a short tick at the lowest low and a bracket under its three sessions', () => {
    const ops = layoutRuleMarks({ items: [{ n: 4, kind: 'bracket', time: 31, value: 140.7, lit: false, times: [30, 31, 32] }] }, at);
    const tick = ops.find((o) => o.op === 'line');
    expect(tick.x1 - tick.x0).toBe(LOW_TICK_BARS * 10);
    const path = ops.find((o) => o.op === 'path');
    expect(path.points[1]).toEqual([300 - 5, 1000 - 140.7 + BRACKET_DROP]);
    expect(path.points[2]).toEqual([320 + 5, 1000 - 140.7 + BRACKET_DROP]);
    expect(ops.filter((o) => o.op === 'line' && o.n !== 'stub')).toHaveLength(1);
  });
  it('a mark off the price scale or off the time scale is not drawn (the library answers null)', () => {
    const ops = layoutRuleMarks({ items: [{ n: 1, kind: 'tick', time: 20, value: 1, lit: false }, { n: 2, kind: 'tick', time: 99, value: 1, lit: false }] }, { ...at, toY: () => null });
    expect(ops).toEqual([]);
    expect(layoutRuleMarks({ items: [{ n: 1, kind: 'tick', time: 20, value: 1 }] }, { ...at, toX: () => null })).toEqual([]);
  });
  it('the Battle stub: one short line at the right edge with its label, nothing else', () => {
    const ops = layoutRuleMarks({ items: [], stub: { value: 141.1, label: '20-day · daily · Tue close' } }, at);
    expect(ops).toEqual([
      { op: 'line', x0: 400 - STUB_LEN, x1: 400, y: 1000 - 141.1, w: LINE.plain, n: 'stub' },
      { op: 'text', x: 400 - STUB_LEN - 6, y: 1000 - 141.1, text: '20-day · daily · Tue close', align: 'right' },
    ]);
  });
});

describe('RuleMarksPrimitive — the library interface', () => {
  const fakeCtx = () => {
    const calls = [];
    const ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : (...a) => { calls.push([k, ...a]); return k === 'measureText' ? { width: 40 } : undefined; }), set: (t, k, v) => { t[k] = v; calls.push([`=${String(k)}`, v]); return true; } });
    return { ctx, calls };
  };
  const attach = () => {
    const updates = [];
    const p = new RuleMarksPrimitive({ ink: 'white', paper: 'black', font: 'monospace', format: formatPriceBare });
    const series = { priceToCoordinate: (v) => 1000 - v };
    const ts = { timeToCoordinate: (t) => t * 10, logicalToCoordinate: (l) => l * 10 };
    p.attached({ chart: { timeScale: () => ts }, series, requestUpdate: () => updates.push(1) });
    return { p, updates };
  };
  it('setScene asks the library for a repaint (never a rebuild)', () => {
    const { p, updates } = attach();
    p.setScene({ items: [{ n: 1, kind: 'tick', time: 20, value: 141.1, lit: true }] });
    expect(updates).toHaveLength(1);
    expect(p.priceAxisViews().map((v) => [v.coordinate(), v.text()])).toEqual([[1000 - 141.1, '141.10']]);
  });
  it('draws solid lines only, in the neutral ink — no dash, never red', () => {
    const { p } = attach();
    p.setScene({ items: [{ n: 1, kind: 'tick', time: 20, value: 141.1, lit: false }, { n: 4, kind: 'bracket', time: 31, value: 140.7, lit: true, times: [30, 31, 32] }] });
    const { ctx, calls } = fakeCtx();
    p.paneViews()[0].renderer().draw({ useMediaCoordinateSpace: (fn) => fn({ context: ctx, mediaSize: { width: 400, height: 300 } }) });
    expect(calls.find((c) => c[0] === 'setLineDash')).toEqual(['setLineDash', []]);
    const strokes = calls.filter((c) => c[0] === '=strokeStyle').map((c) => c[1]);
    expect(new Set(strokes)).toEqual(new Set(['white']));
    expect(calls.filter((c) => c[0] === 'fillText').map((c) => c[1])).toEqual(['1', '4']);
  });
  it('detached, it draws nothing and lists no label', () => {
    const p = new RuleMarksPrimitive({ ink: 'white', paper: 'black', font: 'monospace', format: formatPriceBare });
    expect(p.priceAxisViews()).toEqual([]);
    const { ctx, calls } = fakeCtx();
    p.paneViews()[0].renderer().draw({ useMediaCoordinateSpace: (fn) => fn({ context: ctx, mediaSize: { width: 400, height: 300 } }) });
    expect(calls).toEqual([]);
  });
});
