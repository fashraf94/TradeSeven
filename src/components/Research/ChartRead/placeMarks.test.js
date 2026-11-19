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
import * as RMP from './ruleMarksPrimitive.js';
import { layoutRuleMarks, axisLabels, RuleMarksPrimitive, TICK_BARS, LOW_TICK_BARS, LINE, STUB_LEN, BRACKET_DROP, SQUARE } from './ruleMarksPrimitive.js';

// FX-8's additions, read through the namespace so this file loads before they exist (each row then fails, not the file).
const { AXIS_LABEL_H, LEADER } = RMP;
const leaderOps = (...a) => RMP.leaderOps(...a);
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
    expect(axisLabels(scene, { toY: at.toY, format: formatPriceBare })).toEqual([{ n: 1, y: 1000 - 141.1, labelY: 1000 - 141.1, text: '141.10' }]);
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

describe('review L2-8 / L2-5: coincident squares step aside; the scale takes in the shown marks in view and the stub', () => {
  const at = { toX: (t) => t * 10, toY: (p) => 1000 - p, spacing: 10, width: 400 };
  it('two marks on one bar at one price: two squares, side by side', () => {
    const ops = layoutRuleMarks({ items: [{ n: 1, kind: 'tick', time: 20, value: 150.13 }, { n: 2, kind: 'tick', time: 20, value: 150.13 }] }, at);
    const sq = ops.filter((o) => o.op === 'square');
    expect(Math.abs(sq[0].x - sq[1].x)).toBeGreaterThanOrEqual(13);
  });
  it('autoscaleInfo: the shown marks whose bars are in view, and the Battle stub always', () => {
    const p = new RuleMarksPrimitive({ ink: 'white', paper: 'black', font: 'monospace', format: formatPriceBare });
    p.attached({ chart: { timeScale: () => ({ timeToIndex: (t) => t }) }, series: {}, requestUpdate() {} });
    p.setScene({ items: [{ n: 7, kind: 'tick', time: 50, value: 210.5 }, { n: 6, kind: 'tick', time: 5, value: 120.1 }], stub: null });
    expect(p.autoscaleInfo(40, 60)).toEqual({ priceRange: { minValue: 210.5, maxValue: 210.5 } });
    expect(p.autoscaleInfo(70, 90)).toBeNull();
    p.setScene({ items: [], stub: { value: 100.75, label: 'x' } });
    expect(p.autoscaleInfo(0, 10)).toEqual({ priceRange: { minValue: 100.75, maxValue: 100.75 } });
  });
});

// FX-8 — the three faults of the founder's PANW screenshot (19 Nov), each reproduced on a fixture first: the 50-day
// ($366.70, mark 2, on the record's day) and the 50-day five sessions earlier ($367.81, mark 3) a few pixels apart and
// lit together, and the touch bracket under the latest three bars.
describe('FX-8: no tick through another mark\'s square; two close lit values both readable; nothing cut off', () => {
  // 4 px a dollar: the two 50-days sit 4.4 px apart, as on the screenshot's scale ($366.70 at y 233.2, $367.81 at 228.76).
  const at = { toX: (t) => t * 10, toY: (p) => 1700 - p * 4, spacing: 10, width: 400, height: 300 };
  const rectOf = (s) => ({ x0: s.x, x1: s.x + SQUARE, y0: s.y - SQUARE / 2, y1: s.y + SQUARE / 2 });
  const segsOf = (o) => (o.op === 'line'
    ? [{ x0: o.x0, x1: o.x1, y0: o.y, y1: o.y, w: o.w }]
    : o.points.slice(1).map(([x, y], i) => ({ x0: Math.min(x, o.points[i][0]), x1: Math.max(x, o.points[i][0]), y0: Math.min(y, o.points[i][1]), y1: Math.max(y, o.points[i][1]), w: o.w })));
  const crosses = (seg, r) => seg.x0 - seg.w / 2 < r.x1 && seg.x1 + seg.w / 2 > r.x0 && seg.y0 - seg.w / 2 < r.y1 && seg.y1 + seg.w / 2 > r.y0;
  /** Every pair (a mark's line, ANOTHER mark's square) that meets. */
  const throughSquares = (ops) => {
    const out = [];
    for (const sq of ops.filter((o) => o.op === 'square')) {
      for (const o of ops.filter((x) => (x.op === 'line' || x.op === 'path') && x.n !== sq.n)) {
        if (segsOf(o).some((s) => crosses(s, rectOf(sq)))) out.push(`${o.n} through ${sq.n}`);
      }
    }
    return out;
  };
  const PANW = { items: [
    { n: 2, kind: 'tick', time: 30, value: 366.7, lit: true },
    { n: 3, kind: 'tick', time: 25, value: 367.81, lit: true },
  ] };
  it('fault 1: mark 3\'s tick never runs through mark 2\'s square (the screenshot\'s pair, with room on the right)', () => {
    expect(throughSquares(layoutRuleMarks(PANW, at))).toEqual([]);
  });
  it('fault 1: …and with the record\'s day at the right edge (no room right of mark 2): its square steps clear, still inside the pane', () => {
    const edge = { ...at, width: 340 };
    const ops = layoutRuleMarks(PANW, edge);
    expect(throughSquares(ops)).toEqual([]);
    for (const s of ops.filter((o) => o.op === 'square')) expect([s.n, s.x >= 0, s.x + SQUARE <= edge.width]).toEqual([s.n, true, true]);
  });
  it('fault 1: every square is drawn after every line, so no line is ever painted over a square', () => {
    const ops = layoutRuleMarks({ items: [...PANW.items, { n: 1, kind: 'tick', time: 30, value: 360.1 }, { n: 4, kind: 'bracket', time: 31, value: 355.37, times: [29, 30, 31] }] }, at);
    const lastLine = Math.max(...ops.map((o, i) => (o.op === 'line' || o.op === 'path' ? i : -1)));
    const firstSquare = ops.findIndex((o) => o.op === 'square');
    expect(firstSquare).toBeGreaterThan(lastLine);
  });
  it('fault 2: two lit values 4.4 px apart get two labels a full label apart, each with a leader from its own price', () => {
    const labels = axisLabels(PANW, { toY: at.toY, format: formatPriceBare, height: at.height });
    expect(labels.map((l) => l.text).sort()).toEqual(['366.70', '367.81']);
    const [a, b] = [...labels].sort((p, q) => p.labelY - q.labelY);
    expect(b.labelY - a.labelY).toBeGreaterThanOrEqual(AXIS_LABEL_H);
    // each label still names its own price: its y is its value's coordinate, and the higher price sits higher
    for (const l of labels) expect(l.y).toBe(at.toY(Number(l.text)));
    expect(a.text).toBe('367.81');
    const leaders = leaderOps(labels, at.width);
    expect(leaders).toHaveLength(2);
    for (const [l, p] of labels.map((x) => [x, leaders.find((o) => o.n === x.n)])) {
      expect(p.points[0]).toEqual([at.width - LEADER, l.y]); // starts at its price
      expect(p.points.at(-1)).toEqual([at.width, l.labelY]); // ends at its label
    }
  });
  it('fault 2: labels far apart are not moved and need no leader; a label is never pushed off the pane', () => {
    const apart = { items: [{ n: 1, kind: 'tick', time: 30, value: 360.13, lit: true }, { n: 2, kind: 'tick', time: 30, value: 366.7, lit: true }] };
    const labels = axisLabels(apart, { toY: at.toY, format: formatPriceBare, height: at.height });
    for (const l of labels) expect(l.labelY).toBe(l.y);
    expect(leaderOps(labels, at.width)).toEqual([]);
    const top = { items: [{ n: 2, kind: 'tick', time: 30, value: 423.75, lit: true }, { n: 3, kind: 'tick', time: 25, value: 424.13, lit: true }] }; // y 5 and 3.48
    for (const l of axisLabels(top, { toY: at.toY, format: formatPriceBare, height: at.height })) expect(l.labelY).toBeGreaterThanOrEqual(AXIS_LABEL_H / 2);
  });
  it('fault 3: the touch bracket under the latest three bars keeps its square inside the pane, left of the price scale', () => {
    const ops = layoutRuleMarks({ items: [{ n: 4, kind: 'bracket', time: 38, value: 360.37, lit: true, times: [37, 38, 39] }] }, at);
    const sq = ops.find((o) => o.op === 'square');
    expect(sq.x).toBeGreaterThanOrEqual(0);
    expect(sq.x + SQUARE).toBeLessThanOrEqual(at.width);
    const path = ops.find((o) => o.op === 'path');
    for (const [x] of path.points) expect(x).toBeLessThanOrEqual(at.width);
  });
  it('fault 3: a tick at the left edge puts its square right of the tick, and a square never leaves the pane\'s height', () => {
    const ops = layoutRuleMarks({ items: [{ n: 6, kind: 'tick', time: 2, value: 400.61 }, { n: 1, kind: 'tick', time: 20, value: 424.37 }] }, at);
    for (const s of ops.filter((o) => o.op === 'square')) {
      expect(s.x, `square ${s.n}`).toBeGreaterThanOrEqual(0);
      expect(s.y - SQUARE / 2, `square ${s.n}`).toBeGreaterThanOrEqual(0);
      expect(s.y + SQUARE / 2, `square ${s.n}`).toBeLessThanOrEqual(at.height);
    }
  });
  it('the primitive hands the library fixed coordinates (so it never moves them again) and hides the tick of a moved label', () => {
    const p = new RuleMarksPrimitive({ ink: 'white', paper: 'black', font: 'monospace', format: formatPriceBare });
    p.attached({ chart: { timeScale: () => ({}), paneSize: () => ({ width: 400, height: 300 }) }, series: { priceToCoordinate: at.toY }, requestUpdate() {} });
    p.setScene(PANW);
    const views = p.priceAxisViews();
    expect(views).toHaveLength(2);
    const coords = views.map((v) => v.fixedCoordinate()).sort((x, y) => x - y);
    expect(coords[1] - coords[0]).toBeGreaterThanOrEqual(AXIS_LABEL_H);
    for (const v of views) expect(v.coordinate()).toBe(v.fixedCoordinate());
    expect(views.filter((v) => v.tickVisible())).toHaveLength(0);
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
