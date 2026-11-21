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
