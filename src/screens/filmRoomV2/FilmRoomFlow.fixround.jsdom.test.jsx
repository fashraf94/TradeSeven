// @vitest-environment jsdom
//
// src/screens/filmRoomV2/FilmRoomFlow.fixround.jsdom.test.jsx
//
// Film Room D1 fix round — the FRONT's rows (build report §11): Astra's D1 review §1 findings on the front as rows,
// each of which FAILED at the reviewed head 368dc113 (run in an LF git archive before any code change), and the
// rulings that closed them (Build D Amendments A and B), with the harness's sweeps over every new state.

import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import FilmRoomFlow, { FLOW_LAYOUT } from './FilmRoomFlow.jsx';
import { flowOf, layoutOf } from './filmRoomFlow.js';
import { Quotation } from './FilmRoomKit';
import { mounter, sep23Tape, clone, battleOf, sweepFlow, flowCopyDefects, sweepWords, quoteDefects, flowPinsOf } from './__fixtures__/filmRoomHarness';

const m = mounter();
let restoreWidth = null;
/** The chart's rendered width, as a browser lays it out (jsdom has no layout): the chart block reports `w`. */
function stubChartWidth(w) {
  const desc = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get() { return this.hasAttribute('data-flow-chart-block') ? w : 0; } });
  restoreWidth = () => { if (desc) Object.defineProperty(HTMLElement.prototype, 'clientWidth', desc); else delete HTMLElement.prototype.clientWidth; };
}
afterEach(() => { if (m.root) m.teardown(); m.root = null; if (restoreWidth) restoreWidth(); restoreWidth = null; });

function mount(tape, props = {}) {
  m.setup();
  m.render(<FilmRoomFlow tape={tape} battle={battleOf(tape)} onOpenTape={() => {}} onOpenAt={() => {}} doorId="door-1" renderAgentMark={() => <span data-agent-mark="" />} {...props} />);
}
const text = (sel) => m.q(sel)?.textContent ?? null;
const D = sep23Tape.etDate;
const iso = (s) => `${D}T${s}:00.000Z`;
const check = (seq, at, total, opponent = null) => ({ ...clone(sep23Tape.checks[0]), tickSeq: seq, tickId: `x:${seq}`, key: `seq:${seq}`, at, scores: total === null ? null : { active: total, banked: 0, total, opponent } });
const ACTIVE = { status: 'active', completedAt: null, final: null, result: { value: null, basis: 'not_completed' }, completionMessage: null };
const MARGIN = '[data-flow-agg="difference(the two displayed final scores)"]';
const clean = (tape, extra = {}) => {
  const docs = { tape, battle: battleOf(tape), ...extra };
  expect(sweepFlow(m.container, docs), 'sweepFlow').toEqual([]);
  expect(flowCopyDefects(m.container), 'flowCopyDefects').toEqual([]);
  expect(sweepWords(m.container, docs), 'sweepWords').toEqual([]);
  expect(quoteDefects(m.container, docs), 'quoteDefects').toEqual([]);
};

describe('item 1 — F1: a margin needs both finals in the key (Amendment B DB-1)', () => {
  it('F1: the Sep 23 tape as written before Build B1 (no score.opponentBasis) — "Won", the key "You −47" alone, no margin node, no CPU line', () => {
    const t = clone(sep23Tape);
    delete t.score.opponentBasis;
    stubChartWidth(FLOW_LAYOUT.phone.chartWidth);
    mount(t);
    expect(text('[data-flow-heading]')).toBe('Won');
    expect(m.q(MARGIN)).toBeNull();
    expect(m.qa('[data-flow-key]').map((e) => e.textContent)).toEqual(['You −47']);
    expect(m.q('[data-flow-line="cpu"], [data-flow-end="cpu"]')).toBeNull();
    clean(t);
  });
  it('F1, the harness: a margin standing beside ONE key binding is a defect — the oracle never falls back to the raw opponent', () => {
    stubChartWidth(FLOW_LAYOUT.phone.chartWidth);
    mount(sep23Tape);
    const docs = { tape: sep23Tape, battle: battleOf(sep23Tape) };
    expect(sweepFlow(m.container, docs)).toEqual([]);   // the control: both bindings, clean
    m.q('[data-flow-key="cpu"]').remove();              // plant: the margin now stands beside "You −47" alone
    expect(m.q(MARGIN)).toBeTruthy();
    expect(sweepFlow(m.container, docs).filter((d) => d.includes('difference(the two displayed final scores)'))).not.toEqual([]);
  });
  it('the harness: a margin over two finals that DISPLAY equal is a defect too (DA-4)', () => {
    const t = clone(sep23Tape);
    t.battle.final.total = 10.004; t.battle.final.opponent = 10.001;
    stubChartWidth(FLOW_LAYOUT.phone.chartWidth);
    mount(t);
    clean(t);   // the control: "Won", no margin
    const h = m.q('[data-flow-heading]');
    const planted = document.createElement('span');
    for (const [k, v] of [['data-flow-agg', 'difference(the two displayed final scores)'], ['data-flow-class', 'derived'], ['data-agg-value', '0']]) planted.setAttribute(k, v);
    planted.textContent = '0';
    h.appendChild(planted);
    expect(sweepFlow(m.container, { tape: t, battle: battleOf(t) })).toContain('aggregate difference(the two displayed final scores): computed 0, the documents give null');
  });
});

describe('item 1 — DA-4 on the front: the result word, both key bindings, no margin node', () => {
  const finals = (total, opponent, result) => { const t = clone(sep23Tape); t.battle.final.total = total; t.battle.final.opponent = opponent; t.battle.result.value = result; return t; };
  it.each([
    ['a win whose finals display equal', 10.001, 10.004, 'win', 'Won', ['You +10', 'CPU +10']],
    ['a loss whose finals display equal', 10.004, 10.001, 'loss', 'Lost', ['You +10', 'CPU +10']],
    ['opposite signed rounded zeros', -0.004, 0.004, 'win', 'Won', null],
    ['a genuine draw', 5, 5, 'draw', 'Draw', ['You +5', 'CPU +5']],
    ['one hundredth apart', 5.01, 5, 'win', 'Won by 0.01', ['You +5.01', 'CPU +5']],
  ])('%s', (_, total, opponent, result, heading, keys) => {
    const t = finals(total, opponent, result);
    stubChartWidth(FLOW_LAYOUT.phone.chartWidth);
    mount(t);
    expect(text('[data-flow-heading]')).toBe(heading);
    expect(Boolean(m.q(MARGIN))).toBe(heading === 'Won by 0.01');
    expect(m.qa('[data-flow-keyrow] [data-flow-num]').map((e) => e.getAttribute('data-flow-num'))).toEqual(['battle.final.total', 'battle.final.opponent']);
    if (keys) expect(m.qa('[data-flow-key]').map((e) => e.textContent)).toEqual(keys);
    clean(t);
  });
});

describe('item 1 — F2 / DA-9 on the front: a day that does not read as final', () => {
  it('F2: isFinalDay null with a later completion — the date, the last check\'s key, no final dot', () => {
    const t = clone(sep23Tape);
    t.isFinalDay = null;
    t.battle.completedAt = '2026-09-24T20:05:00.000Z';
    t.battle.final = { total: 80, opponent: 20, at: '2026-09-24T20:05:00.000Z' };
    const battle = battleOf(t, { timing: { tradingDays: [D, '2026-09-24'] } });
    stubChartWidth(FLOW_LAYOUT.phone.chartWidth);
    mount(t, { battle });
    expect(text('[data-flow-heading]')).toBe('Wed, Sep 23, 2026');
    expect(m.qa('[data-flow-key]').map((e) => e.textContent)).toEqual(['You −47', 'CPU −83']);
    expect(m.q('[data-flow-end]')).toBeNull();
    clean(t, { battle });
  });
  it('DA-9: the player\'s final unrecorded on the final day — the date, the last check\'s two values, no final dot on either line', () => {
    const t = clone(sep23Tape);
    t.battle.final.total = null;
    t.battle.final.opponent = -200;
    stubChartWidth(FLOW_LAYOUT.phone.chartWidth);
    mount(t);
    expect(text('[data-flow-heading]')).toBe('Wed, Sep 23, 2026');
    expect(m.qa('[data-flow-key]').map((e) => e.textContent)).toEqual(['You −47', 'CPU −83']);
    expect(m.q('[data-flow-end]')).toBeNull();
    clean(t);
  });
  it('the harness reads the model\'s one predicate: the final\'s key on that day is a defect', () => {
    const t = clone(sep23Tape);
    t.isFinalDay = null;
    stubChartWidth(FLOW_LAYOUT.phone.chartWidth);
    mount(sep23Tape);   // a front that reads the finals …
    expect(sweepFlow(m.container, { tape: t, battle: battleOf(t) })).toContain("battle.final.total: a final score on a day that is not the battle's final day");   // … against a day that is not final
  });
});

describe('item 2 — DB-8 / DB-6 on the front', () => {
  const D28 = '2028-03-15';
  const at28 = (hm) => `${D28}T${hm}:00.000Z`;
  const unknownDay = (final) => {
    const t = clone(sep23Tape);
    t.etDate = D28;
    t.isFinalDay = final;
    if (!final) t.battle = { status: 'active', completedAt: null, final: null, result: { value: null, basis: 'not_completed' }, completionMessage: null };
    t.checks = [{ ...clone(sep23Tape.checks[0]), tickSeq: 1, at: at28('14:15'), scores: { active: 12, banked: 0, total: 12, opponent: 3 } }];
    t.actions = [];
    t.directives = [{ ...clone(sep23Tape.directives[0]), filedAt: at28('15:00') }, { ...clone(sep23Tape.directives[1]), filedAt: at28('18:00') }];
    t.score.lastCheck = { ...t.score.lastCheck, at: at28('14:15'), tickSeq: 1, total: 12, opponent: 3 };
    return t;
  };
  it('F8 on the front: a date the calendar does not know, one check — no chart, no axis, no legend, no pin; "2 more on the full tape"', () => {
    const t = unknownDay(false);
    mount(t);
    expect(m.q('[data-flow-chart-block], [data-flow-chart], [data-flow-axis], [data-flow-legend], [data-flow-pin]')).toBeNull();
    expect(text('[data-flow-more]')).toBe('2 more on the full tape');
    expect(m.q('[data-flow-quiet]')).toBeNull();
    expect(m.qa('[data-flow-key]').map((e) => e.textContent)).toEqual(['You +12', 'CPU +3']);
    clean(t);
  });
  it('the final day there: the heading and the key keep the recorded finals — no chart to draw them on', () => {
    const t = unknownDay(true);
    mount(t);
    expect(text('[data-flow-heading]')).toBe('Won by 46');
    expect(m.qa('[data-flow-key]').map((e) => e.textContent)).toEqual(['You −47', 'CPU −93']);
    expect(m.q('[data-flow-chart]')).toBeNull();
    clean(t);
  });
  it('desktop, no time basis: the panel\'s count still shows, the counts and the door below it', () => {
    const t = unknownDay(false);
    mount(t, { desktop: true });
    expect(m.q('[data-flow-chart]')).toBeNull();
    expect(text('[data-flow-more]')).toBe('2 more on the full tape');
    expect(m.q('[data-flow-door]')).toBeTruthy();
    clean(t);
  });
  it('DB-6: the front mounted from the same bytes under TZ=UTC and TZ=America/Chicago — the same pins, names, groups and panel', () => {
    const t = clone(sep23Tape);
    t.directives[0].filedAt = '2026-09-23T17:40';   // its zone lost
    const bytes = JSON.stringify(t);
    const was = process.env.TZ;
    const offset = () => new Date(Date.UTC(2026, 8, 23, 12)).getTimezoneOffset();
    const read = () => {
      const x = JSON.parse(bytes);
      stubChartWidth(FLOW_LAYOUT.phone.chartWidth);
      mount(x);
      const out = { pins: m.qa('[data-flow-pin]').map((b) => [b.getAttribute('data-flow-pin'), b.getAttribute('data-flow-pin-members'), b.style.left, b.textContent]), fact: text('[data-flow-fact]'), more: text('[data-flow-more]'), heading: text('[data-flow-heading]') };
      clean(x);
      m.teardown(); m.root = null; restoreWidth(); restoreWidth = null;
      return out;
    };
    try {
      process.env.TZ = 'UTC';
      const o0 = offset(); const a = read();
      process.env.TZ = 'America/Chicago';
      const o1 = offset(); const b = read();
      expect([o0, o1]).toEqual([0, 300]);
      expect(b).toEqual(a);
      expect(a.pins.some(([, members]) => members.split(' ').includes('directive:0'))).toBe(false);
    } finally {
      if (was === undefined) delete process.env.TZ; else process.env.TZ = was;
    }
  });
});

describe('item 3 — F7: a single scored check is a point (DB-7)', () => {
  it('F7: scores 8 / missing / 8 at 10:00, 10:01 and 10:02 AM ET, 350 px wide — no drawn path crosses the missing instant', () => {
    const t = clone(sep23Tape);
    t.isFinalDay = false;
    t.battle = clone(ACTIVE);
    t.checks = [check(1, iso('14:00'), 8, 2), check(2, iso('14:01'), null), check(3, iso('14:02'), 8, 2)];
    t.actions = [];
    t.directives = [];
    t.score.lastCheck = { ...t.score.lastCheck, tickSeq: 3, at: iso('14:02'), total: 8, opponent: 2 };
    stubChartWidth(FLOW_LAYOUT.phone.chartWidth);
    mount(t);
    const x = layoutOf(flowOf(t, { battle: battleOf(t) }), FLOW_LAYOUT.phone.chartWidth, FLOW_LAYOUT.phone.chartHeight).x;
    const missX = x(Date.parse(iso('14:01')));
    const spans = m.qa('path[data-flow-line]').map((p) => {
      const xs = [...p.getAttribute('d').matchAll(/[ML]\s*(-?[\d.]+)/g)].map((mm) => Number(mm[1]));
      return [Math.min(...xs), Math.max(...xs)];
    });
    expect(spans.filter(([a, b]) => a <= missX && missX <= b)).toEqual([]);
    // both recorded scores can still be located: a dot at each one's own instant
    const at = (s) => Math.round(x(Date.parse(iso(s))) * 10) / 10;
    expect(m.qa('[data-flow-dot="you"]').map((c) => Math.round(Number(c.getAttribute('cx')) * 10) / 10)).toEqual([at('14:00'), at('14:02')]);
  });
});

describe('item 3 — DB-7: dots and butt caps', () => {
  // the narrowest chart: a 280 px viewport takes the narrow layout, 256 px wide — its inset x-range 212 px, so fifteen
  // minutes is 8.15 px there (DB-7 counted "at least 9 px"; DA-11's inset came after — build report §11, a question)
  it('a fifteen-minute break on the narrowest chart (256 px, a 280 px viewport) stays visible — each line\'s stroke stops at its last check (butt caps)', () => {
    const t = clone(sep23Tape);
    t.isFinalDay = false;
    t.battle = clone(ACTIVE);
    t.checks = [check(1, iso('13:45'), 4, 1), check(2, iso('14:00'), 6, 1), check(3, iso('14:07'), null), check(4, iso('14:15'), 6, 1), check(5, iso('14:30'), 8, 1)];
    t.actions = [];
    t.directives = [];
    t.score.lastCheck = { ...t.score.lastCheck, tickSeq: 5, at: iso('14:30'), total: 8, opponent: 1 };
    stubChartWidth(256);
    mount(t);
    for (const who of ['you', 'cpu']) {
      const paths = m.qa(`path[data-flow-line="${who}"]`);
      expect(paths, who).toHaveLength(2);
      expect(paths.every((p) => /stroke-linecap:\s*butt/.test(p.getAttribute('style'))), who).toBe(true);
      const xs = (p) => [...p.getAttribute('d').matchAll(/[ML]\s*(-?[\d.]+)/g)].map((mm) => Number(mm[1]));
      expect(Math.min(...xs(paths[1])) - Math.max(...xs(paths[0])), who).toBeGreaterThanOrEqual(8);   // 8.15 px, nothing reaching into it
    }
    expect(m.q('[data-flow-dot]')).toBeNull();
    clean(t);
  });
  it('an isolated final point is drawn once, by its end dot — never also as a single-check dot', () => {
    const t = clone(sep23Tape);
    t.checks[22].scores = null;   // the last check scoreless: the final stands alone
    stubChartWidth(FLOW_LAYOUT.phone.chartWidth);
    mount(t);
    expect(m.qa('[data-flow-end="you"]')).toHaveLength(1);
    expect(m.q('[data-flow-dot]')).toBeNull();
  });
});

describe('item 4 — DA-11: one inset x-range, one grouping for the chart and the panel', () => {
  /** A day with a directive filed the evening before (DA-2: at the open's edge) and one after the close (at its end). */
  const edges = () => {
    const t = clone(sep23Tape);
    t.actions = [];
    t.directives = [{ ...clone(sep23Tape.directives[0]), filedAt: '2026-09-23T00:30:00.000Z' }, { ...clone(sep23Tape.directives[1]), filedAt: '2026-09-23T23:30:00.000Z' }];
    return t;
  };
  // the chart's width at each viewport: 280 and 320 take the narrow layout (16 px padding, 4 px bleed: W − 24), 390 the
  // phone's (W − 40), the desktop its measured 639
  it.each([['280', 256], ['320', 296], ['390', 350], ['desktop', 639]])('at %s (chart %i px): both edge pins keep their whole 44 px inside the chart', (_, w) => {
    stubChartWidth(w);
    mount(edges());
    const pins = m.qa('[data-flow-pin]');
    expect(pins).toHaveLength(2);
    for (const b of pins) {
      const left = parseFloat(b.style.left);
      expect([b.style.width, b.style.height]).toEqual(['44px', '44px']);
      expect(left).toBeGreaterThanOrEqual(0);
      expect(left + 44).toBeLessThanOrEqual(w);
    }
    expect(parseFloat(pins[0].style.left)).toBe(0);         // the open's edge: x = 22, the touch area from 0
    expect(parseFloat(pins[1].style.left) + 44).toBe(w);    // the close's: x = W − 22
  });
  it('the lines, the final dot and the drop line share the range: the final at W − 22, the axis\'s labels padded by 22', () => {
    stubChartWidth(350);
    mount(sep23Tape);
    expect(m.q('[data-flow-end="you"]').getAttribute('cx')).toBe('328');
    expect(m.q('[data-flow-end="cpu"]').getAttribute('cx')).toBe('328');
    const first = m.q('path[data-flow-line="you"]').getAttribute('d').match(/^M(-?[\d.]+)/)[1];
    expect(Number(first)).toBeCloseTo(22 + (45.333333 / 390) * 306, 1);   // the first check, 10:15:20 AM
    const drop = m.q('[data-flow-drop]');
    const sel = m.q('[data-flow-pin][aria-pressed="true"]');
    expect(Number(drop.getAttribute('x1'))).toBeCloseTo(parseFloat(sel.style.left) + 22, 6);
    expect(m.q('[data-flow-axis]').style.padding).toBe('0px 22px');
  });
  /** Two directives `gapPx` apart on the x-range of a chart `w` px wide, then a swap far to their right. */
  const pair = (gapPx, w) => {
    const t = clone(sep23Tape);
    const open = Date.parse('2026-09-23T13:30:00.000Z');
    const span = Date.parse('2026-09-23T20:00:00.000Z') - open;
    const at = (px) => new Date(open + Math.round((px / (w - 44)) * span)).toISOString();
    t.actions = [{ ...clone(sep23Tape.actions[1]), at: at(w - 60) }];
    t.directives = [{ ...clone(sep23Tape.directives[0]), filedAt: at(100) }, { ...clone(sep23Tape.directives[1]), filedAt: at(100 + gapPx) }];
    return t;
  };
  it.each([[43.5, true], [44.5, false]])('%s px apart: merged %s — and the panel steps through exactly the group the chart draws', (gap, merged) => {
    const w = 300;
    stubChartWidth(w);
    mount(pair(gap, w));
    const drawn = m.qa('[data-flow-pin]').map((b) => b.getAttribute('data-flow-pin-members').split(' '));
    expect(drawn[0].length > 1).toBe(merged);
    // walk the first group in the panel: select it, then Next to its end — the members the panel shows, in order
    m.click(m.q('[data-flow-pin]'));
    const walked = [m.q('[data-flow-panel]').getAttribute('data-flow-panel-member')];
    for (let k = 0; k < 4; k += 1) {
      const next = m.qa('[data-flow-stepper] button').find((b) => b.textContent === 'Next');
      if (!next || next.getAttribute('aria-disabled') === 'true') break;
      m.click(next);
      walked.push(m.q('[data-flow-panel]').getAttribute('data-flow-panel-member'));
    }
    expect(walked).toEqual(drawn[0]);
  });
  it('a measured width that is not the layout\'s first-paint width: the panel steps through the MEASURED groups (639 on the phone layout)', () => {
    stubChartWidth(639);
    mount(sep23Tape);   // the phone layout's first paint assumes 350, where the agent's swap opens "3–5"
    expect(flowPinsOf(m.container).map((p) => p.members.length)).toEqual([1, 2, 1, 1]);
    const steps = () => m.qa('[data-flow-stepper] button').map((b) => [b.textContent, b.getAttribute('aria-disabled')]);
    expect(text('[data-flow-fact]')).toBe('Your agent · DE → PLTR · 2:00 PM · sold at 468.43');
    expect(steps()).toEqual([['Previous', null], ['Next', 'true']]);   // the group "2–3": the agent's swap is its last
    m.click(m.qa('[data-flow-stepper] button')[0]);
    expect(text('[data-flow-fact]')).toBe('Your directive · 1:40 PM · filed');
  });
});

describe('item 4 — DA-15: a merged pin shows its range', () => {
  it('"1–2" and "3–5" at 350: two BOUND ordinals each, one en dash — every name still its members\' fact lines', () => {
    stubChartWidth(350);
    mount(sep23Tape);
    const marks = m.qa('[data-flow-pin]').map((b) => [...b.querySelectorAll('[data-flow-agg="ordinal(pins in time order)"]')].map((e) => [e.textContent, e.getAttribute('data-flow-member')]));
    expect(marks).toEqual([[['1', 'action:0'], ['2', 'directive:0']], [['3', 'action:1'], ['5', 'directive:2']]]);
    expect(flowPinsOf(m.container).map((p) => p.label)).toEqual(['1–2', '3–5']);
    for (const b of m.qa('[data-flow-pin]')) expect(b.querySelector('[data-pin-wide]')).toBeTruthy();
    clean(sep23Tape);
  });
  it('a three-member group, stepped through: the panel names 3, 4, 5 — each placeable on the chart\'s "3–5"', () => {
    stubChartWidth(350);
    mount(sep23Tape);
    const seenN = [m.q('[data-flow-panel]').getAttribute('data-flow-panel')];
    for (let k = 0; k < 2; k += 1) { m.click(m.qa('[data-flow-stepper] button').find((b) => b.textContent === 'Next')); seenN.push(m.q('[data-flow-panel]').getAttribute('data-flow-panel')); }
    expect(seenN).toEqual(['3', '4', '5']);
    clean(sep23Tape);
  });
  it('the shape is the highest-priority member\'s, widened: a directive group\'s lozenge, the agent\'s filled pill; a lone pin is not widened', () => {
    stubChartWidth(350);
    mount(sep23Tape);
    expect(m.qa('[data-flow-pin] [data-pin-shape]').map((e) => e.getAttribute('data-pin-shape'))).toEqual(['diamond', 'filled']);
    expect(m.q('[data-flow-pin="1"] svg polygon')).toBeTruthy();
    expect(m.q('[data-flow-pin="3"] [data-pin-shape]').style.width).toBe('36px');   // selected (24) + 12
    m.teardown(); m.root = null; restoreWidth();
    stubChartWidth(639);
    mount(sep23Tape);
    expect(m.q('[data-flow-pin="1"] [data-pin-wide]')).toBeNull();
    expect(m.q('[data-flow-pin="1"] [data-pin-shape]').style.width).toBe('22px');
  });
  it('the touch areas never overlap: each group\'s 44 px stands at least 44 px from the next — the layout at every chart width from 256 to 1440, the mounted buttons at the four viewports\'', () => {
    const flow = flowOf(sep23Tape, { battle: battleOf(sep23Tape) });
    for (let w = 256; w <= 1440; w += 1) {
      const xs = layoutOf(flow, w, 150).groups.map((g) => g.x);
      for (let k = 1; k < xs.length; k += 1) if (!(xs[k] - xs[k - 1] >= 44)) throw new Error(`${w}: groups ${k} and ${k + 1} are ${xs[k] - xs[k - 1]} px apart`);
    }
    for (const w of [256, 296, 350, 639]) {
      stubChartWidth(w);
      mount(sep23Tape);
      const lefts = m.qa('[data-flow-pin]').map((b) => parseFloat(b.style.left));
      for (let k = 1; k < lefts.length; k += 1) expect(lefts[k] - lefts[k - 1], `${w}`).toBeGreaterThanOrEqual(44);
      m.teardown(); m.root = null; restoreWidth(); restoreWidth = null;
    }
  });
  it('the harness reads each ordinal\'s own member: a range\'s last number swapped for the wrong one is a defect', () => {
    stubChartWidth(350);
    mount(sep23Tape);
    const last = m.qa('[data-flow-pin="3"] [data-flow-agg]')[1];
    last.textContent = '4'; last.setAttribute('data-agg-value', '4');
    expect(sweepFlow(m.container, { tape: sep23Tape, battle: battleOf(sep23Tape) })).toContain('aggregate ordinal(pins in time order): computed 4, the documents give 5');
  });
});

describe('item 5 — DA-16 / DB-13: quotations on the front', () => {
  /** Every quote paragraph reports a long text: 500 px of content in a 60 px clamp — "Read more" would show (jsdom has no layout). */
  function stubLongQuotes() {
    const sh = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight');
    const ch = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, get() { return this.hasAttribute('data-quote-path') ? 500 : 0; } });
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get() { return this.hasAttribute('data-quote-path') ? 60 : 0; } });
    return () => {
      if (sh) Object.defineProperty(HTMLElement.prototype, 'scrollHeight', sh); else delete HTMLElement.prototype.scrollHeight;
      if (ch) Object.defineProperty(HTMLElement.prototype, 'clientHeight', ch); else delete HTMLElement.prototype.clientHeight;
    };
  }
  const directiveDay = () => { const t = clone(sep23Tape); t.actions = []; t.directives = [clone(sep23Tape.directives[0])]; return t; };

  it('a long quotation on the front: clamped at three lines, no "Read more" or "Show less" — the pin\'s link is the way to the rest', () => {
    const undo = stubLongQuotes();
    try {
      const t = directiveDay();
      mount(t);
      const quotes = m.qa('[data-flow-said] [data-quotation]');
      expect(quotes).toHaveLength(2);
      for (const q of quotes) {
        expect(q.querySelector('[data-quote-path]').getAttribute('data-collapsed')).toBe('yes');
        expect(q.querySelector('[data-quote-path]').style.webkitLineClamp || q.querySelector('[data-quote-path]').getAttribute('style')).toMatch(/3/);
        expect(q.querySelector('button')).toBeNull();
      }
      expect(m.qa('button').map((b) => b.textContent)).not.toContain('Read more');
      expect(m.q('[data-flow-pin-link]')).toBeTruthy();
      clean(t);
    } finally { undo(); }
  });
  it('each attribution stays — a direct child, its source and its instant intact — and is hidden only visually', () => {
    const t = directiveDay();
    mount(t);
    const quotes = m.qa('[data-flow-said] [data-quotation]');
    expect(quotes.map((q) => [q.getAttribute('data-quotation'), q.querySelector(':scope > [data-quote-attribution]')?.textContent.trim()])).toEqual([
      ['player', '— the player · 1:40 PM'],
      ['agent', '— the agent · 1:40 PM'],
    ]);
    for (const q of quotes) {
      const a = q.querySelector(':scope > [data-quote-attribution]');
      expect(a.getAttribute('data-quote-at')).toBe('directives[0].filedAt');
      expect([a.style.position, a.style.width, a.style.height, a.style.overflow]).toEqual(['absolute', '1px', '1px', 'hidden']);
      expect(a.getAttribute('style')).toMatch(/clip: rect\(0/);
    }
    expect(quoteDefects(m.container, { tape: t })).toEqual([]);
    clean(t);
  });
  it('the oracle still bites: an attribution removed, or its instant changed, is a defect', () => {
    const t = directiveDay();
    mount(t);
    const a = m.q('[data-flow-said="player"] [data-quote-attribution] [data-time]');
    a.textContent = '9:00 AM';
    expect(quoteDefects(m.container, { tape: t })).not.toEqual([]);
    m.q('[data-flow-said="player"] [data-quote-attribution]').remove();
    expect(quoteDefects(m.container, { tape: t })).not.toEqual([]);
  });
  it('the copy sweep\'s exemption is the quoted text and its attribution only: a "Read more" inside a quotation on the front is named', () => {
    const t = directiveDay();
    mount(t);
    const q = m.q('[data-flow-said="player"] [data-quotation]');
    const b = document.createElement('button'); b.textContent = 'Read more';
    q.appendChild(b);
    expect(flowCopyDefects(m.container)).toEqual(['not the spec\'s copy: “Read more”']);
    b.remove();
    expect(flowCopyDefects(m.container)).toEqual([]);   // the quoted words and the attribution themselves stay exempt
  });
});

// At ONE head these rows pin `preview` omitted and `false` to identical markup for every existing call site's props (a
// changed default fails them). That the default renders as it did BEFORE item 5 is the cross-tree proof in the build
// report §11.6 (the parents of every call site, hashed in LF archives of 62e4243b and the head) — not these rows.
describe('item 5 — the kit\'s Quotation: `preview` omitted and `preview={false}` serialize identically for every existing call site\'s props (DA-16)', () => {
  /** Every quote paragraph reports a long text, so a clamped quotation measures as clamped (jsdom has no layout). */
  function stubLong() {
    const sh = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight');
    const ch = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, get() { return this.hasAttribute('data-quote-path') ? 500 : 0; } });
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get() { return this.hasAttribute('data-quote-path') ? 60 : 0; } });
    return () => {
      if (sh) Object.defineProperty(HTMLElement.prototype, 'scrollHeight', sh); else delete HTMLElement.prototype.scrollHeight;
      if (ch) Object.defineProperty(HTMLElement.prototype, 'clientHeight', ch); else delete HTMLElement.prototype.clientHeight;
    };
  }
  const tape = sep23Tape;
  // every existing call site's props (grep "<Quotation" in src/screens/filmRoomV2 at the reviewed head), with a document that holds text at the path
  const SITES = [
    ['Glance, the platform\'s words', { doc: tape, path: ['battle', 'completionMessage', 'text'], by: 'platform', at: ['battle', 'completionMessage', 'at'], size: 12 }],
    ['Study, a filed directive', { doc: tape, path: ['directives', 0, 'playerText'], by: 'directive', at: ['directives', 0, 'filedAt'], size: 12.5, weight: 600, color: 'var(--ft-ink)' }],
    ['Study, the player\'s words', { doc: tape, path: ['directives', 0, 'playerText'], by: 'player', at: ['directives', 0, 'filedAt'], lines: 3, color: 'var(--ft-ink)' }],
    ['Study, the agent\'s reply', { doc: tape, path: ['directives', 0, 'agentReply'], by: 'agent', at: ['directives', 0, 'filedAt'], lines: 2 }],
    ['Study, a rationale', { doc: tape, path: ['rationale', 0, 'rationale'], by: 'agent', at: ['rationale', 0, 'at'], lines: 2 }],
    ['Study, a hypothesis', { doc: tape, path: ['rationale', 0, 'hypothesis'], by: 'agent', at: ['rationale', 0, 'at'], weight: 600, color: 'var(--ft-ink)' }],
    ['the cards, a ledger note', { doc: { cards: { e1: { note: 'Hold the line.', createdAt: '2026-09-23T17:00:00.000Z' } } }, path: ['cards', 'e1', 'note'], by: 'you', at: ['cards', 'e1', 'createdAt'], docLabel: 'ledger' }],
  ];
  const renumber = (html) => html.replace(/_r_[0-9a-z]+_|«r[0-9a-z]+»|:r[0-9a-z]+:/g, 'ID');
  const html = (props) => { m.setup(); m.render(<Quotation {...props} />); const out = renumber(m.container.innerHTML); m.teardown(); m.root = null; return out; };
  it.each(SITES)('%s: omitted and `false` serialize identically — the attribution visible, "Read more" kept on a clamp', (_, props) => {
    const undo = stubLong();
    try {
      const omitted = html(props);
      expect(omitted).toContain('data-quotation');
      expect(html({ ...props, preview: false })).toBe(omitted);
      expect(omitted).not.toMatch(/clip: rect/);
      expect(omitted.includes('Read more')).toBe(Boolean(props.lines));
      expect(html({ ...props, preview: true })).not.toBe(omitted);   // the control: the prop does change what it should
    } finally { undo(); }
  });
});

describe('item 2 — the harness reads instants as the front does (flowMs, DB-6)', () => {
  it('a zoneless check holding the day\'s lowest score is no check to the front — the low is the strict −10, and the sweep agrees', () => {
    const t = clone(sep23Tape);
    t.isFinalDay = false;
    t.battle = clone(ACTIVE);
    t.checks = [check(1, iso('14:00'), 5, 1), check(2, iso('14:30'), -10, 1), check(3, '2026-09-23T15:30:00', -50, 1), check(4, iso('16:30'), 3, 1), check(5, iso('17:00'), 4, 1)];
    t.actions = [];
    t.directives = [];
    t.score.lastCheck = { ...t.score.lastCheck, tickSeq: 5, at: iso('17:00'), total: 4, opponent: 1 };
    stubChartWidth(639);
    mount(t);
    expect(text('[data-flow-low]')).toBe('Low −10 · 10:30 AM');
    expect(m.q('[data-flow-low] [data-flow-num]').getAttribute('data-flow-num')).toBe('checks[1].scores.total');
    clean(t);   // a harness reading the zoneless instant with Date.parse would demand checks[2] — the row that bites
  });
});

describe('the review round (fix round) — the front', () => {
  it('FRB-1: two scored checks at ONE instant with ONE value — no length to stroke, so a dot at that instant (never an invisible zero-length path)', () => {
    const t = clone(sep23Tape);
    t.isFinalDay = false;
    t.battle = clone(ACTIVE);
    t.checks = [check(1, iso('14:00'), 8, 2), check(2, iso('15:00'), null), check(3, iso('16:00'), 5, 2), check(4, iso('16:00'), 5, 2), check(5, iso('17:00'), null), check(6, iso('18:00'), 9, 2)];
    t.actions = [];
    t.directives = [];
    t.score.lastCheck = { ...t.score.lastCheck, tickSeq: 6, at: iso('18:00'), total: 9, opponent: 2 };
    stubChartWidth(FLOW_LAYOUT.phone.chartWidth);
    mount(t);
    const x = layoutOf(flowOf(t, { battle: battleOf(t) }), FLOW_LAYOUT.phone.chartWidth, FLOW_LAYOUT.phone.chartHeight).x;
    const at = (s) => Math.round(x(Date.parse(iso(s))) * 10) / 10;
    expect(m.qa('path[data-flow-line="you"]')).toEqual([]);
    expect(m.qa('[data-flow-dot="you"]').map((c) => Math.round(Number(c.getAttribute('cx')) * 10) / 10)).toEqual([at('14:00'), at('16:00'), at('18:00')]);
    clean(t);
  });
  it('FRB-1\'s control: two scored checks at one instant with DIFFERENT values still draw their (vertical) stroke — a path, not a dot', () => {
    const t = clone(sep23Tape);
    t.isFinalDay = false;
    t.battle = clone(ACTIVE);
    t.checks = [check(1, iso('16:00'), 5, 2), check(2, iso('16:00'), 9, 2)];
    t.actions = [];
    t.directives = [];
    t.score.lastCheck = { ...t.score.lastCheck, tickSeq: 2, at: iso('16:00'), total: 9, opponent: 2 };
    stubChartWidth(FLOW_LAYOUT.phone.chartWidth);
    mount(t);
    expect(m.qa('path[data-flow-line="you"]')).toHaveLength(1);
    expect(m.q('[data-flow-dot="you"]')).toBeNull();
  });
  it('FRB-2: at 390 the selected pin\'s drop line stops short of the low mark\'s label — for either group selected; with no label (639) it runs to the axis', () => {
    stubChartWidth(FLOW_LAYOUT.phone.chartWidth);
    mount(sep23Tape);
    const label = m.q('[data-flow-low]');
    expect(label.textContent).toBe('Low −92 · 1:30 PM');
    const top = parseFloat(label.style.top);
    const bottom = top + 14;
    const left = parseFloat(label.style.left);
    const right = left + parseFloat(label.style.width);
    const crosses = () => {
      const d = m.q('[data-flow-drop]');
      const xd = Number(d.getAttribute('x1'));
      const [y1, y2] = [Number(d.getAttribute('y1')), Number(d.getAttribute('y2'))].sort((a, b) => a - b);
      return { inLabelColumn: xd >= left && xd <= right, crosses: xd >= left && xd <= right && y1 < bottom && y2 > top };
    };
    expect(crosses()).toEqual({ inLabelColumn: true, crosses: false });   // "3–5", selected on opening
    m.click(m.q('[data-flow-pin="1"]'));
    expect(crosses()).toEqual({ inLabelColumn: true, crosses: false });   // "1–2"
    m.teardown(); m.root = null; restoreWidth();
    stubChartWidth(639);
    mount(sep23Tape);
    expect(m.q('[data-flow-low]')).toBeNull();
    expect(m.q('[data-flow-drop]').getAttribute('y2')).toBe(String(FLOW_LAYOUT.phone.chartHeight));
  });
  it('FRD-1: a tape written before isFinalDay existed, on its battle\'s validated last day — the front reads it final through its `battle` ("Won by 46", the finals, the end dot); the harness reads it through docs.battle', () => {
    const t = clone(sep23Tape);
    delete t.isFinalDay;
    const battle = battleOf(t);   // timing.tradingDays [Sep 23]: its validated final trading day is this date
    stubChartWidth(FLOW_LAYOUT.phone.chartWidth);
    mount(t, { battle });
    expect(text('[data-flow-heading]')).toBe('Won by 46');
    expect(m.qa('[data-flow-key]').map((e) => e.textContent)).toEqual(['You −47', 'CPU −93']);
    expect(m.q('[data-flow-end="you"]')).toBeTruthy();
    clean(t, { battle });
    // the harness, handed no battle, cannot see the evidence: the finals it reads become a defect
    expect(sweepFlow(m.container, { tape: t })).toContain("battle.final.total: a final score on a day that is not the battle's final day");
  });
  it('FRD-1\'s control: the same tape on a battle whose last day is later — the date, the last check\'s values', () => {
    const t = clone(sep23Tape);
    delete t.isFinalDay;
    const battle = battleOf(t, { timing: { tradingDays: [D, '2026-09-24'] } });
    stubChartWidth(FLOW_LAYOUT.phone.chartWidth);
    mount(t, { battle });
    expect(text('[data-flow-heading]')).toBe('Wed, Sep 23, 2026');
    expect(m.qa('[data-flow-key]').map((e) => e.textContent)).toEqual(['You −47', 'CPU −83']);
    clean(t, { battle });
  });
});
