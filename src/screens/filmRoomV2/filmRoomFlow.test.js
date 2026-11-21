// src/screens/filmRoomV2/filmRoomFlow.test.js
//
// Film Room D1 item 2 — THE FLOW MODEL (Build D spec V1 §4 – §8), in Node.
// This file's import of filmRoomFlow.js IS the dependency-surface guard
// (BUILD_RULES §4): the module must load in the Node test environment, so a
// React or client-SDK import entering its graph fails here. Never mock it.
//
// The acceptance rows it carries: F-FIXTURE (the model's half — the heading,
// the key, the lines, the six events, the five chosen and the one counted,
// the groups at the two phone widths, the low mark, the two counts), F-AGREE,
// F-LINE, F-LOW, F-MAKER, F-PINS, F-DIR (the panel's paths) and F-COUNT.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import {
  flowOf, headingOf, keyOf, linesOf, lowOf, domainOf, axisLabelsOf, choosePins, groupPins, openingPin, legendOf, panelOf,
  incompleteOf, countsOf, layoutOf, marginOf, fmtMargin, hundredthsOfShown, makerKeyOf, heightAt, isFinalDayOf, allPinsOf,
  FLOW_AGGREGATES, FLOW_PIN_TOUCH, momentsCountOf,
} from './filmRoomFlow.js';
import { SCREEN_AGGREGATE_CLASSES, fmtPoints, etClock } from './filmRoomModel';
import sep23Tape from './__fixtures__/sep23.tape.json';

const clone = (v) => JSON.parse(JSON.stringify(v));
const ms = (iso) => Date.parse(iso);
/** The chart's rendered width at the two phone viewports (FilmRoomFlow.jsx FLOW_LAYOUT; measured in headless Edge, report §6). */
const W390 = 350;
const W320 = 296;

/** A projection of the front that names no array index: what the player sees, in order. */
function seen(tape, flow = flowOf(tape)) {
  return {
    heading: flow.heading.kind === 'won' || flow.heading.kind === 'lost' ? [flow.heading.kind, flow.heading.margin.text] : [flow.heading.kind],
    key: [flow.key.you?.value ?? null, flow.key.cpu?.value ?? null],
    you: flow.lines.you.runs.map((r) => r.map((p) => [p.t, p.v])),
    cpu: flow.lines.cpu ? flow.lines.cpu.runs.map((r) => r.map((p) => [p.t, p.v])) : null,
    low: flow.low ? [flow.low.value?.value, flow.low.clock, flow.low.eligible] : null,
    pins: flow.pins.map((p) => {
      const panel = panelOf(tape, p);
      const at = (pth) => (pth ? pth.reduce((o, k) => o?.[k], tape) : null);
      return [p.n, p.kind, p.t, panel.maker ?? null, at(panel.out), at(panel.in), panel.clock, panel.price?.value ?? null, panel.filed ?? null, at(panel.player?.path), at(panel.reply?.path), panel.link.anchor];
    }),
    more: flow.more.value,
    selected: flow.selected ? flow.selected.n : null,
    counts: [flow.counts.heading, ...flow.counts.tiles.map((t) => [t.job, t.x.value, t.y.value])],
    groups390: groupPins(flow.pins, W390).map((g) => g.members.map((m) => m.n)),
  };
}

describe('the dependency surface (BUILD_RULES §4): pure, no React, no reads', () => {
  it('imports only the screen\'s model — no React, no Firestore, no fetch, no clock', () => {
    const src = readFileSync(path.join(process.cwd(), 'src', 'screens', 'filmRoomV2', 'filmRoomFlow.js'), 'utf8');
    const imports = [...src.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]);
    expect(imports).toEqual(['./filmRoomModel']);
    const code = src.split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
    expect(code).not.toMatch(/\bDate\.now\(|\bnew Date\(\)|\bfetch\(|getDoc|firebase|\breact\b|useState|useEffect/i);
  });
  it('every aggregate it states is declared in SCREEN_AGGREGATE_CLASSES, derived', () => {
    for (const name of Object.values(FLOW_AGGREGATES)) expect(SCREEN_AGGREGATE_CLASSES[name], name).toBe('derived');
    expect(momentsCountOf(2)).toEqual({ value: 2, aggregate: 'count(moments on the tape day)', cls: 'derived' });
  });
  it('the model and the front differ only by case (filmRoomFlow.js, FilmRoomFlow.jsx): every importer names its extension — on a case-insensitive disk an extension-less "./FilmRoomFlow" resolves to the model', () => {
    const dir = path.join(process.cwd(), 'src', 'screens', 'filmRoomV2');
    const files = readdirSync(dir).filter((f) => /\.(js|jsx)$/.test(f));
    const bare = files.filter((f) => /from '\.\/[Ff]ilmRoomFlow'/.test(readFileSync(path.join(dir, f), 'utf8')));
    expect(bare).toEqual([]);
    const importers = files.filter((f) => /from '\.\/[Ff]ilmRoomFlow\.jsx?'/.test(readFileSync(path.join(dir, f), 'utf8')));
    expect(importers.length).toBeGreaterThanOrEqual(3);
  });
});

describe('F-FIXTURE — the Sep 23 front, the model\'s half, pinned whole', () => {
  const flow = flowOf(sep23Tape);
  it('the heading "Won by 46" and the key\'s two values, each bound to battle.final', () => {
    expect(flow.final).toBe(true);
    expect(flow.heading).toEqual({ kind: 'won', margin: { value: 46, aggregate: 'difference(the two displayed final scores)', cls: 'derived', text: '46' } });
    expect(flow.key.you).toEqual({ value: -47, cls: 'recorded', path: ['battle', 'final', 'total'] });
    expect(flow.key.cpu).toEqual({ value: -93, cls: 'recorded', path: ['battle', 'final', 'opponent'] });
  });
  it('the player\'s line from the first check (11 at 10:15 AM, never 0 at the open), unbroken through 23 checks, ending at the final point at the close', () => {
    const run = flow.lines.you.runs;
    expect(run).toHaveLength(1);
    expect(run[0]).toHaveLength(24);
    expect(run[0][0]).toEqual({ t: ms('2026-09-23T14:15:20.000Z'), v: 11, i: 0 });
    expect(run[0][22]).toEqual({ t: ms('2026-09-23T19:45:20.000Z'), v: -47, i: 22 });
    expect(run[0][23]).toEqual({ t: ms('2026-09-23T20:00:00.000Z'), v: -47, i: null, final: true });
    expect(flow.lines.cpu.runs[0][0].v).toBe(-61);
    expect(flow.lines.cpu.runs[0].at(-1)).toEqual({ t: ms('2026-09-23T20:00:00.000Z'), v: -93, i: null, final: true });
    expect(flow.domain).toEqual({ startMs: ms('2026-09-23T13:30:00.000Z'), endMs: ms('2026-09-23T20:00:00.000Z'), session: true });
    expect(flow.axis).toEqual(['9:30 AM', '12:45 PM', '4:00 PM']);
  });
  it('six events: five chosen (the agent\'s swap, the three directives, the first rule swap) and one counted as "1 more"', () => {
    expect(allPinsOf(sep23Tape)).toHaveLength(6);
    expect(seen(sep23Tape).pins).toEqual([
      [1, 'other', ms('2026-09-23T16:45:08.000Z'), 'stall', 'MSFT', 'CRWD', '12:45 PM', 498.79, null, null, null, 'swap-1'],
      [2, 'directive', ms('2026-09-23T17:40:00.000Z'), null, null, null, '1:40 PM', null, true, 'Protect the lead into the close.', 'Heard. I will tighten the downside stop for the rest of the session.', 'directives'],
      [3, 'agent', ms('2026-09-23T18:00:05.000Z'), 'agent', 'DE', 'PLTR', '2:00 PM', 468.43, null, null, null, 'swap-2'],
      [4, 'directive', ms('2026-09-23T18:20:00.000Z'), null, null, null, '2:20 PM', null, false, 'Sell everything right now.', 'That runs against how I trade; the plan stays as it is.', 'directives'],
      [5, 'directive', ms('2026-09-23T18:50:00.000Z'), null, null, null, '2:50 PM', null, false, 'Tilt into chips for the last hour.', null, 'directives'],
    ]);
    expect(flow.more).toEqual({ value: 1, aggregate: 'count(tape rows beyond the chosen pins)', cls: 'derived' });
    expect(flow.selected.n).toBe(3);
    expect(flow.legend).toEqual(['agent', 'other', 'directive']);
  });
  it('the groups at 390 (chart 350 px) and at 320 (chart 296 px)', () => {
    expect(groupPins(flow.pins, W390).map((g) => [g.n, g.merged, g.kind, g.members.map((m) => m.n)])).toEqual([[1, false, 'other', [1]], [2, true, 'agent', [2, 3, 4]], [5, false, 'directive', [5]]]);
    expect(groupPins(flow.pins, W320).map((g) => [g.n, g.merged, g.kind, g.members.map((m) => m.n)])).toEqual([[1, true, 'directive', [1, 2]], [3, true, 'agent', [3, 4, 5]]]);
  });
  it('the low mark\'s value and clock: −92 at 1:30 PM; eligible, and left out at both phone widths — its label sits over a pin\'s touch area', () => {
    expect(flow.low).toEqual({ index: 13, t: ms('2026-09-23T17:30:20.000Z'), value: { value: -92, cls: 'recorded', path: ['checks', 13, 'scores', 'total'] }, clock: '1:30 PM', eligible: true });
    const text = `Low ${fmtPoints(-92)} · 1:30 PM`;
    for (const [w, h] of [[W390, 150], [W320, 112]]) {
      const lay = layoutOf(flow, w, h, text);
      expect(lay.low.overlaps, `${w}`).toBe(true);
      expect(lay.low.shown, `${w}`).toBe(false);
    }
  });
  it('the two counts: Trading 1 of 3, Working with you 1 of 3, under "This game"', () => {
    expect(seen(sep23Tape).counts).toEqual(['thisGame', ['trading', 1, 3], ['withYou', 1, 3]]);
    expect(flow.counts.tiles.map((t) => [t.x.aggregate, t.y.aggregate])).toEqual([['count(actions[] by the agent)', 'count(actions[])'], ['count(directives[] filed)', 'count(directives[])']]);
    expect(countsOf(sep23Tape, { oneDay: false }).heading).toBe('thisDay');
    expect(flow.incomplete).toBe(false);
  });
});

describe('F-AGREE — the margin is the difference of the two DISPLAYED finals (BUILD_RULES §9)', () => {
  const finals = (total, opponent, result = 'win') => { const t = clone(sep23Tape); t.battle.final.total = total; t.battle.final.opponent = opponent; t.battle.result.value = result; return t; };
  it('finals 10.004 and 5.006 display +10 and +5.01: the heading says 4.99, never the raw difference\'s 5', () => {
    expect([fmtPoints(10.004), fmtPoints(5.006)]).toEqual(['+10', '+5.01']);
    expect(fmtPoints(10.004 - 5.006)).toBe('+5');
    expect(headingOf(finals(10.004, 5.006)).margin.text).toBe('4.99');
    expect(headingOf(finals(10.004, 5.006)).margin.value).toBe(4.99);
  });
  it('a loss across zero: −0.004 and +0.006 display 0 and +0.01 — "Lost by 0.01"', () => {
    expect(headingOf(finals(-0.004, 0.006, 'loss'))).toMatchObject({ kind: 'lost', margin: { text: '0.01' } });
  });
  it('the readers: hundredths of fmtPoints\'s own strings, the unsigned margin\'s form', () => {
    expect(['−47', '+12.5', '0', '+0.01', '−1,000', 'x'].map(hundredthsOfShown)).toEqual([-4700, 1250, 0, 1, null, null]);
    expect([4600, 499, 50, 0].map(fmtMargin)).toEqual(['46', '4.99', '0.5', '0']);
    expect(marginOf(-47, -93)).toBe(4600);
  });
  it('draw, and the "anything else" rows: a missing final score, an unknown result, an earlier day', () => {
    expect(headingOf(finals(-10, -10, 'draw'))).toEqual({ kind: 'draw' });
    const noOpp = finals(-47, null);
    expect(headingOf(noOpp)).toEqual({ kind: 'final', total: { value: -47, cls: 'recorded', path: ['battle', 'final', 'total'] } });
    expect(headingOf(finals(-47, -93, 'pending')).kind).toBe('final');
    const drawNoScore = finals(null, -10, 'draw');
    expect(headingOf(drawNoScore)).toEqual({ kind: 'final', total: null });
    const earlier = clone(sep23Tape); earlier.battle.status = 'active';
    expect(isFinalDayOf(earlier)).toBe(false);
    expect(headingOf(earlier)).toEqual({ kind: 'date', date: 'Wed, Sep 23, 2026' });
    expect(keyOf(earlier).you.path).toEqual(['score', 'lastCheck', 'total']);
    expect(keyOf(earlier).cpu).toEqual({ value: -83, cls: 'recorded', path: ['score', 'lastCheck', 'opponent'] });
  });
});

describe('F-LINE — the chart is the tape\'s', () => {
  it('a check with no score breaks the line: nothing is joined across it, on either line', () => {
    const t = clone(sep23Tape);
    t.checks[5].scores = null;
    const lines = linesOf(t);
    expect(lines.you.runs.map((r) => r.length)).toEqual([5, 18]);
    expect(lines.you.runs[0].at(-1).i).toBe(4);
    expect(lines.you.runs[1][0].i).toBe(6);
    expect(lines.cpu.runs.map((r) => r.length)).toEqual([5, 18]);
    t.checks[7].scores.total = 'x';   // a total that is not a number breaks too
    expect(linesOf(t).you.runs.map((r) => r.length)).toEqual([5, 1, 16]);
  });
  it('a last check with no score: the final point stands alone, never joined across it', () => {
    const t = clone(sep23Tape);
    t.checks[22].scores = null;
    const runs = linesOf(t).you.runs;
    expect(runs.map((r) => r.length)).toEqual([22, 1]);
    expect(runs[1][0]).toMatchObject({ v: -47, final: true });
  });
  it('the lines start at the first check: no point at the open, none at zero', () => {
    const { you } = linesOf(sep23Tape);
    expect(you.points[0].t).toBe(ms('2026-09-23T14:15:20.000Z'));
    expect(you.points.some((p) => p.t === ms('2026-09-23T13:30:00.000Z'))).toBe(false);
    expect(you.points.filter((p) => p.v === 0)).toEqual([]);
  });
  it('no opponent line and no CPU key without the cpu_portfolio basis; none with the basis but no value to show', () => {
    const t = clone(sep23Tape);
    t.score.opponentBasis = 'none';
    expect(keyOf(t).cpu).toBeNull();
    expect(linesOf(t).cpu).toBeNull();
    delete t.score.opponentBasis;
    expect(linesOf(t).cpu).toBeNull();
    const u = clone(sep23Tape);
    u.battle.final.opponent = null;
    expect(keyOf(u).cpu).toBeNull();
    expect(linesOf(u).cpu).toBeNull();
  });
  it('a day whose session the calendar does not know: the axis runs from the first check to the last', () => {
    const t = clone(sep23Tape);
    t.etDate = '2026-09-26';   // a Saturday
    const d = domainOf(t);
    expect(d).toEqual({ startMs: ms('2026-09-23T14:15:20.000Z'), endMs: ms('2026-09-23T19:45:20.000Z'), session: false });
    expect(axisLabelsOf(d)).toEqual(['10:15 AM', '1:00 PM', '3:45 PM']);
    expect(linesOf(t, d).you.runs[0].at(-1)).toMatchObject({ t: d.endMs, final: true });
  });
  it('the rows\' order on the tape does not move a line', () => {
    const t = clone(sep23Tape);
    t.checks.reverse();
    expect(linesOf(t).you.points.map((p) => [p.t, p.v])).toEqual(linesOf(sep23Tape).you.points.map((p) => [p.t, p.v]));
  });
});

describe('F-LOW — the low mark', () => {
  const day = (totals, { final = false, step = 900_000 } = {}) => {
    const t = clone(sep23Tape);
    t.checks = totals.map((v, i) => ({ at: new Date(ms('2026-09-23T14:00:00.000Z') + i * step).toISOString(), tickSeq: i + 1, state: 'completed', scores: v === null ? null : { total: v, opponent: -1 } }));
    if (!final) t.battle.status = 'active';
    return t;
  };
  it('a tie: the earliest check wins', () => {
    const low = lowOf(day([1, -5, 3, -5, 2]));
    expect([low.index, low.value.value, low.clock, low.eligible]).toEqual([1, -5, '10:15 AM', true]);
  });
  it('fewer than three scored checks: not shown (a check with no score does not count)', () => {
    expect(lowOf(day([1, -5])).eligible).toBe(false);
    expect(lowOf(day([1, null, -5])).eligible).toBe(false);
    expect(lowOf(day([1, 2, -5])).eligible).toBe(false);   // three, but the low is the last point
    expect(lowOf(day([1, -5, 2])).eligible).toBe(true);
  });
  it('the low as the line\'s last point: not shown; on a final day the line ends at the final point, so the last check is not its last point', () => {
    expect(lowOf(day([3, 2, 1, -4])).eligible).toBe(false);
    expect(lowOf(day([3, 2, 1, -4], { final: true })).eligible).toBe(true);
  });
  it('a label that would overlap a pin\'s touch area, or leave the chart, is left out; clear of both, it is drawn', () => {
    const t = day([0, -10, -40, -10, 0, 5], { step: 3_600_000 });   // 10 AM to 3 PM, the low at noon
    t.actions = [];
    t.directives = [];
    const flow = flowOf(t);
    const text = 'Low −40 · 12:00 PM';
    expect(layoutOf(flow, 300, 150, text).low).toMatchObject({ shown: true, overlaps: false, leaves: false });
    // a directive pin filed at the low's own instant: its touch area covers the label
    t.directives = [{ filedAt: t.checks[2].at, cardState: 'committed', playerText: 'x' }];
    expect(layoutOf(flowOf(t), 300, 150, text).low).toMatchObject({ shown: false, overlaps: true });
    // too narrow a chart: the label leaves it
    t.directives = [];
    expect(layoutOf(flowOf(t), 60, 150, text).low).toMatchObject({ shown: false, leaves: true });
    // the chart's bottom padding (26 px) holds the label under the lowest point at any height: it never leaves below
    for (const h of [60, 112, 150, 230]) expect(layoutOf(flowOf(t), 300, h, text).low.box.bottom, String(h)).toBeLessThanOrEqual(h);
  });
});

describe('F-MAKER — the maker from the recorded mechanism only', () => {
  it('each mechanism\'s key; an unknown or missing mechanism is "not recorded" and a hollow pin', () => {
    const rows = ['agent_decision', 'archetype_rotation', 'platform_risk_manager', 'guardrail', 'gameplan_meeting', 'gameplan_rotation', 'haiku_decision', '', undefined, 'toString'];
    expect(rows.map((mechanism) => makerKeyOf({ mechanism }))).toEqual(['agent', 'stall', 'risk', 'guardrail', 'meeting', 'unrecorded', 'unrecorded', 'unrecorded', 'unrecorded', 'unrecorded']);
    const t = clone(sep23Tape);
    t.actions.forEach((a, i) => { a.mechanism = rows[i + 7]; });
    expect(allPinsOf(t).filter((p) => p.src === 'action').map((p) => p.kind)).toEqual(['other', 'other', 'other']);
    expect(t.actions.map((a, i) => panelOf(t, { src: 'action', index: i, kind: 'other' }).maker)).toEqual(['unrecorded', 'unrecorded', 'unrecorded']);
  });
  it('a gameplan_meeting swap is another maker\'s, never the agent\'s own call — pin and count', () => {
    const t = clone(sep23Tape);
    t.actions[1].mechanism = 'gameplan_meeting';
    expect(allPinsOf(t).find((p) => p.src === 'action' && p.index === 1).kind).toBe('other');
    expect(countsOf(t).tiles[0].x.value).toBe(0);
    expect(panelOf(t, { src: 'action', index: 1, kind: 'other' }).maker).toBe('meeting');
  });
  it('a symbol the tape does not hold has no path (the panel says "not recorded"); no exit price, no price', () => {
    const t = clone(sep23Tape);
    delete t.actions[0].symbolIn;
    t.actions[0].exitPrice = null;
    const p = panelOf(t, { src: 'action', index: 0, kind: 'other' });
    expect([p.out, p.in, p.price]).toEqual([['actions', 0, 'symbolOut'], null, null]);
  });
});

describe('F-PINS — at most five, by priority; the merge; the order of the rows; the selection', () => {
  const at = (h, m) => `2026-09-23T${String(h + 4).padStart(2, '0')}:${String(m).padStart(2, '0')}:00.000Z`;   // ET hour:minute → UTC
  const swap = (h, m, mechanism, out = 'A', inn = 'B') => ({ at: at(h, m), mechanism, symbolOut: out, symbolIn: inn, exitPrice: 10 });
  const dir = (h, m, text) => ({ filedAt: at(h, m), cardState: 'committed', playerText: text, agentReply: 'ok' });
  const dayOf = (actions, directives) => { const t = clone(sep23Tape); t.actions = actions; t.directives = directives; return t; };
  it('more than five: the agent\'s swaps, then the directives, then the rule swaps — numbered in time order, the rest counted', () => {
    const t = dayOf(
      [swap(10, 0, 'archetype_rotation', 'R1'), swap(11, 0, 'agent_decision', 'A1'), swap(12, 0, 'archetype_rotation', 'R2'), swap(13, 0, 'agent_decision', 'A2'), swap(14, 0, 'agent_decision', 'A3')],
      [dir(10, 30, 'd1'), dir(12, 30, 'd2'), dir(15, 0, 'd3')],
    );
    const { pins, more } = choosePins(t);
    expect(pins.map((p) => [p.n, p.kind, p.src === 'action' ? t.actions[p.index].symbolOut : t.directives[p.index].playerText])).toEqual([
      [1, 'directive', 'd1'], [2, 'agent', 'A1'], [3, 'directive', 'd2'], [4, 'agent', 'A2'], [5, 'agent', 'A3'],
    ]);
    expect(more.value).toBe(3);
  });
  it('the priority never drops an agent\'s swap before a rule\'s, nor a directive before a rule swap', () => {
    const t = dayOf([swap(10, 0, 'archetype_rotation'), swap(10, 5, 'guardrail'), swap(10, 10, 'platform_risk_manager'), swap(10, 15, 'gameplan_meeting'), swap(10, 20, 'archetype_rotation'), swap(15, 55, 'agent_decision')], [dir(15, 50, 'late')]);
    const kinds = choosePins(t).pins.map((p) => p.kind);
    expect(kinds).toContain('agent');
    expect(kinds).toContain('directive');
    expect(kinds.filter((k) => k === 'other')).toHaveLength(3);
  });
  it('a row with no instant is never drawn and is counted with the rest', () => {
    const t = dayOf([swap(10, 0, 'agent_decision'), { ...swap(11, 0, 'agent_decision'), at: null }], []);
    const { pins, more } = choosePins(t);
    expect([pins.length, more.value]).toEqual([1, 1]);
  });
  it('the grouping: a chain of close pins joins only while each is within 44 px of its GROUP\'S FIRST pin', () => {
    const pins = [0, 30, 60, 90, 133.9, 134, 177.8, 178].map((x, k) => ({ n: k + 1, kind: 'other', frac: x / 1000 }));
    // 177.8 is 43.9 px from its group's first pin (133.9) and joins; 178 is 44.1 px from it and starts a group — though
    // only 0.2 px from the pin before it (a chain measured pin to pin would join it)
    expect(groupPins(pins, 1000).map((g) => g.members.map((m) => m.n))).toEqual([[1, 2], [3, 4], [5, 6, 7], [8]]);
    expect(groupPins(pins, 1000).map((g) => g.x)).toEqual([0, 60, 133.9, 178]);
    // exactly 44 px apart is not "closer than 44"
    expect(groupPins([{ n: 1, kind: 'other', frac: 0 }, { n: 2, kind: 'other', frac: FLOW_PIN_TOUCH / 100 }], 100).length).toBe(2);
    // the shape is the highest-priority member's; the label the lowest number
    const g = groupPins([{ n: 1, kind: 'other', frac: 0 }, { n: 2, kind: 'directive', frac: 0.01 }, { n: 3, kind: 'agent', frac: 0.02 }], 100)[0];
    expect([g.kind, g.n, g.merged]).toEqual(['agent', 1, true]);
    // a width that is not a number places every pin at the edge: one group
    expect(groupPins(pins, NaN)).toHaveLength(1);
  });
  it('the same front under any order of the tape\'s rows', () => {
    const base = seen(sep23Tape);
    const orders = [(a) => a.reverse(), (a) => a.push(a.shift()), (a) => a.splice(1, 0, a.pop())];
    for (const f of orders) {
      const t = clone(sep23Tape);
      f(t.actions); f(t.directives); f(t.checks);
      expect(seen(t), String(f)).toEqual({ ...base, pins: base.pins.map((p) => [...p.slice(0, 11), p[11]]) });
    }
    // two pins at one instant: ordered by their content, never their place
    const twin = dayOf([swap(11, 0, 'archetype_rotation', 'X', 'Y'), swap(11, 0, 'archetype_rotation', 'P', 'Q')], []);
    const flipped = clone(twin); flipped.actions.reverse();
    const syms = (t) => choosePins(t).pins.map((p) => t.actions[p.index].symbolOut);
    expect(syms(twin)).toEqual(syms(flipped));
  });
  it('the selected pin on opening: the agent\'s first swap — inside a group or alone —, else the first pin', () => {
    const { pins } = choosePins(sep23Tape);
    expect(openingPin(pins).n).toBe(3);
    const inGroup = groupPins(pins, W390).find((g) => g.members.includes(openingPin(pins)));
    expect(inGroup.members.map((m) => m.n)).toEqual([2, 3, 4]);
    expect(groupPins(pins, 2000).find((g) => g.members.includes(openingPin(pins))).merged).toBe(false);
    const noAgent = dayOf([swap(12, 0, 'archetype_rotation')], [dir(11, 0, 'first')]);
    expect(openingPin(choosePins(noAgent).pins)).toMatchObject({ n: 1, kind: 'directive' });
    expect(openingPin([])).toBeNull();
  });
  it('a pin sits on the player\'s line at its instant, interpolated; outside the line, the nearest point\'s height', () => {
    const pts = [{ t: 0, v: 10 }, { t: 100, v: 0 }, { t: 200, v: -20 }];
    expect([heightAt(pts, -50), heightAt(pts, 0), heightAt(pts, 50), heightAt(pts, 150), heightAt(pts, 500), heightAt([], 5)]).toEqual([10, 10, 5, -10, -20, 0]);
    const p = choosePins(sep23Tape).pins.find((x) => x.n === 3);   // 2:00:05 PM, between −91 (1:45:20) and −65 (2:00:20)
    expect(p.v).toBeCloseTo(-91 + 26 * (885 / 900), 9);
  });
  it('the legend lists only the kinds on the chart', () => {
    expect(legendOf([{ kind: 'other' }])).toEqual(['other']);
    expect(legendOf([])).toEqual([]);
  });
});

describe('F-DIR — the directive panel: filed or not, the two quotations as paths, the reply left out when it differs', () => {
  it('"filed" for a committed card, "not filed" for any other state', () => {
    const t = clone(sep23Tape);
    expect([0, 1, 2].map((j) => panelOf(t, { src: 'directive', index: j, kind: 'directive' }).filed)).toEqual([true, false, false]);
  });
  it('the player\'s words and the reply, each its own path at the row\'s filedAt; the reply left out when agentReplyDiffers is true', () => {
    const p0 = panelOf(sep23Tape, { src: 'directive', index: 0, kind: 'directive' });
    expect(p0.player).toEqual({ path: ['directives', 0, 'playerText'], at: ['directives', 0, 'filedAt'] });
    expect(p0.reply).toEqual({ path: ['directives', 0, 'agentReply'], at: ['directives', 0, 'filedAt'] });
    expect(panelOf(sep23Tape, { src: 'directive', index: 2, kind: 'directive' }).reply).toBeNull();
    const t = clone(sep23Tape);
    t.directives[0].agentReplyDiffers = true;
    expect(panelOf(t, { src: 'directive', index: 0, kind: 'directive' }).reply).toBeNull();
    t.directives[0].agentReplyDiffers = 'true';   // only the boolean says it differs
    expect(panelOf(t, { src: 'directive', index: 0, kind: 'directive' }).reply).not.toBeNull();
    t.directives[0].playerText = '';
    expect(panelOf(t, { src: 'directive', index: 0, kind: 'directive' }).player).toBeNull();
  });
  it('a directive filed the evening before reads with its date (etWhen), never a bare clock that would place it on this day', () => {
    const t = clone(sep23Tape);
    t.directives[0].filedAt = '2026-09-23T00:30:00.000Z';
    expect(panelOf(t, { src: 'directive', index: 0, kind: 'directive' }).clock).toBe('Sep 22, 8:30 PM');
    expect(etClock(t.directives[0].filedAt)).toBe('8:30 PM');
  });
});

describe('F-COUNT — the two counts mean what §8 says', () => {
  it('each count\'s two numbers: the agent\'s own swaps of all swaps; committed directives of all directives', () => {
    const t = clone(sep23Tape);
    t.actions[0].mechanism = 'agent_decision';
    t.directives[1].cardState = 'committed';
    expect(countsOf(t).tiles.map((x) => [x.job, x.x.value, x.y.value, x.caption])).toEqual([['trading', 2, 3, 'ownCall'], ['withYou', 2, 3, 'filed']]);
  });
  it('no tile when its section\'s coverage is not complete; none without a row; no heading with no tile', () => {
    const partial = clone(sep23Tape);
    partial.coverage.actions.status = 'partial';
    expect(countsOf(partial).tiles.map((x) => x.job)).toEqual(['withYou']);
    partial.coverage.directives.status = 'unavailable';
    expect(countsOf(partial)).toEqual({ heading: null, tiles: [] });
    const none = clone(sep23Tape);
    none.actions = [];
    none.directives = [];
    expect(countsOf(none)).toEqual({ heading: null, tiles: [] });
    const absent = clone(sep23Tape);
    delete absent.coverage.directives;
    expect(countsOf(absent).tiles.map((x) => x.job)).toEqual(['trading']);
  });
  it('the incomplete line: the actions\' or the directives\' coverage not complete — absent counts as not complete', () => {
    expect(incompleteOf(sep23Tape)).toBe(false);
    for (const [s, status] of [['actions', 'partial'], ['directives', 'unavailable'], ['directives', undefined]]) {
      const t = clone(sep23Tape);
      if (status === undefined) delete t.coverage[s]; else t.coverage[s].status = status;
      expect(incompleteOf(t), `${s} ${status}`).toBe(true);
    }
  });
});
