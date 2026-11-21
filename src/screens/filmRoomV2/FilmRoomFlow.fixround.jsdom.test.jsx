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
import { mounter, sep23Tape, clone, battleOf, sweepFlow, flowCopyDefects, sweepWords, quoteDefects } from './__fixtures__/filmRoomHarness';

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
  it('a fifteen-minute break at 280 px wide stays visible — each line\'s stroke stops at its last check (butt caps)', () => {
    const t = clone(sep23Tape);
    t.isFinalDay = false;
    t.battle = clone(ACTIVE);
    t.checks = [check(1, iso('13:45'), 4, 1), check(2, iso('14:00'), 6, 1), check(3, iso('14:07'), null), check(4, iso('14:15'), 6, 1), check(5, iso('14:30'), 8, 1)];
    t.actions = [];
    t.directives = [];
    t.score.lastCheck = { ...t.score.lastCheck, tickSeq: 5, at: iso('14:30'), total: 8, opponent: 1 };
    stubChartWidth(280);
    mount(t);
    for (const who of ['you', 'cpu']) {
      const paths = m.qa(`path[data-flow-line="${who}"]`);
      expect(paths, who).toHaveLength(2);
      expect(paths.every((p) => /stroke-linecap:\s*butt/.test(p.getAttribute('style'))), who).toBe(true);
      const xs = (p) => [...p.getAttribute('d').matchAll(/[ML]\s*(-?[\d.]+)/g)].map((mm) => Number(mm[1]));
      expect(Math.min(...xs(paths[1])) - Math.max(...xs(paths[0])), who).toBeGreaterThanOrEqual(8);
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
