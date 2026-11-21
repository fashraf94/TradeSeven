// @vitest-environment jsdom
//
// src/screens/filmRoomV2/FilmRoomFlow.jsdom.test.jsx
//
// Film Room D1 item 4 — THE FRONT, mounted (Build D spec §4 – §8): the Sep 23
// front pinned whole as the player sees it (F-FIXTURE), the directive panel
// (F-DIR), the front's words (F-COPY), the pins as buttons — named by their
// fact lines, in time order, 44 px — and the panel as a polite live region,
// with the harness's sweeps over every state: the front's numbers bound
// (sweepFlow), its words the spec's (flowCopyDefects), the screen's own voice
// (sweepWords) and every quotation bound to its tape path (quoteDefects).

import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import FilmRoomFlow, { FLOW_LAYOUT } from './FilmRoomFlow.jsx';
import { mounter, sep23Tape, clone, sweepFlow, flowCopyDefects, sweepWords, quoteDefects, flowPinsOf, SPEC_FLOW_COPY } from './__fixtures__/filmRoomHarness';
import { momentsCountOf } from './filmRoomFlow.js';

const m = mounter();
const docs = (tape, extra = {}) => ({ tape, ...extra });
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
  const calls = { tape: 0, at: [] };
  m.render(<FilmRoomFlow tape={tape} onOpenTape={() => { calls.tape += 1; }} onOpenAt={(a) => calls.at.push(a)} doorId="door-1" renderAgentMark={() => <span data-agent-mark="" />} {...props} />);
  return calls;
}
const text = (sel) => m.q(sel)?.textContent ?? null;
const clean = (tape, extra) => {
  expect(sweepFlow(m.container, docs(tape, extra)), 'sweepFlow').toEqual([]);
  expect(flowCopyDefects(m.container), 'flowCopyDefects').toEqual([]);
  expect(sweepWords(m.container, docs(tape)), 'sweepWords').toEqual([]);
  expect(quoteDefects(m.container, docs(tape)), 'quoteDefects').toEqual([]);
};

describe('F-FIXTURE — the Sep 23 front, as the player sees it, pinned whole', () => {
  it('at 390: "Won by 46", the key, three groups of five pins, the agent\'s swap open, "1 more on the full tape", the two counts, the door', () => {
    stubChartWidth(FLOW_LAYOUT.phone.chartWidth);
    mount(sep23Tape);
    expect(text('[data-flow-heading]')).toBe('Won by 46');
    expect(m.q('[data-flow-heading]').tagName).toBe('H1');
    expect(text('[data-flow-key="you"]')).toBe('You −47');
    expect(text('[data-flow-key="cpu"]')).toBe('CPU −93');
    expect(m.qa('[data-flow-axis] [data-time]').map((e) => e.textContent)).toEqual(['9:30 AM', '12:45 PM', '4:00 PM']);
    expect(flowPinsOf(m.container).map((p) => [p.n, p.kind, p.label, p.members.join(' '), p.pressed])).toEqual([
      [1, 'other', '1', 'action:0', 'false'],
      [2, 'agent', '2+', 'directive:0 action:1 directive:1', 'true'],
      [5, 'directive', '5', 'directive:2', 'false'],
    ]);
    expect(m.qa('[data-flow-legend-kind]').map((e) => e.textContent)).toEqual(["Agent's swap", 'Other swap', 'Your directive']);
    expect(text('[data-flow-fact]')).toBe('Your agent · DE → PLTR · 2:00 PM · sold at 468.43');
    expect(text('[data-flow-panel] [data-flow-more]')).toBe('1 more on the full tape');
    expect(m.q('[data-flow-incomplete]')).toBeNull();
    expect(m.qa('[data-flow-tile]').map((t) => t.textContent)).toEqual(['Trading1of3swaps were its own call', 'Working with you1of3directives filed']);
    expect(text('[data-flow-counts] h2')).toBe('This game');
    expect(text('[data-flow-door]')).toBe('Open the full tape');
    expect(m.q('[data-flow-door]').id).toBe('door-1');
    expect(m.q('[data-flow-low]')).toBeNull();   // its label would sit over a pin's touch area (filmRoomFlow.test.js)
    expect(m.q('[data-flow-cards-line]')).toBeNull();
    clean(sep23Tape);
  });

  it('at 320: two groups — 1+ (the 12:45 PM swap and the 1:40 PM directive) and 3+ (the agent\'s swap first, then two directives)', () => {
    stubChartWidth(FLOW_LAYOUT.narrow.chartWidth);
    mount(sep23Tape);
    expect(flowPinsOf(m.container).map((p) => [p.n, p.kind, p.label, p.members.join(' '), p.pressed])).toEqual([
      [1, 'directive', '1+', 'action:0 directive:0', 'false'],
      [3, 'agent', '3+', 'action:1 directive:1 directive:2', 'true'],
    ]);
    expect(m.q('[data-flow-chart]').getAttribute('data-chart-width')).toBe('296');
    clean(sep23Tape);
  });

  it('the chart draws the tape\'s lines: one solid run for the player, one dashed for the CPU, each ending at its final point; the selected pin\'s drop line', () => {
    stubChartWidth(350);
    mount(sep23Tape);
    expect(m.qa('[data-flow-line="you"]')).toHaveLength(1);
    expect(m.qa('[data-flow-line="cpu"]')).toHaveLength(1);
    expect(m.q('[data-flow-line="cpu"]').style.strokeDasharray).toBe('5 4');
    expect(m.q('[data-flow-line="you"]').style.strokeDasharray).toBe('');
    expect(m.q('[data-flow-line="you"]').getAttribute('d').split(/[ML]/).filter(Boolean)).toHaveLength(24);
    expect(m.q('[data-flow-end="you"]').getAttribute('cx')).toBe('350');
    expect(m.qa('[data-flow-zero]')).toHaveLength(1);
    expect(m.qa('[data-flow-guide]').length).toBeLessThanOrEqual(2);
    expect(m.qa('[data-flow-drop]')).toHaveLength(1);
    // no green or red, nothing animates
    expect(m.container.innerHTML).not.toMatch(/--ft-(success|danger)|animation|transition/);
  });
});

describe('the pins are buttons (§6; exit criterion 10)', () => {
  it('each a button, 44 px, named by its fact line(s), in time order — no aria-label, the visible number hidden from the name', () => {
    stubChartWidth(350);
    mount(sep23Tape);
    const buttons = m.qa('[data-flow-pin]');
    for (const b of buttons) {
      expect(b.tagName).toBe('BUTTON');
      expect(b.getAttribute('type')).toBe('button');
      expect([b.style.width, b.style.height]).toEqual(['44px', '44px']);
      expect(b.hasAttribute('aria-label')).toBe(false);
    }
    expect(flowPinsOf(m.container).map((p) => p.name)).toEqual([
      'Stall rule · MSFT → CRWD · 12:45 PM · sold at 498.79',
      'Your directive · 1:40 PM · filed Your agent · DE → PLTR · 2:00 PM · sold at 468.43 Your directive · 2:20 PM · not filed',
      'Your directive · 2:50 PM · not filed',
    ]);
    // the keyboard's order is the DOM's: by time
    const lefts = buttons.map((b) => parseFloat(b.style.left));
    expect([...lefts].sort((a, b) => a - b)).toEqual(lefts);
  });

  it('a tap selects a pin (its first member), the ring moves, the panel follows; the stepper walks a merged pin in time order', () => {
    stubChartWidth(350);
    mount(sep23Tape);
    m.click(m.q('[data-flow-pin="1"]'));
    expect(flowPinsOf(m.container).map((p) => p.pressed)).toEqual(['true', 'false', 'false']);
    expect(text('[data-flow-fact]')).toBe('Stall rule · MSFT → CRWD · 12:45 PM · sold at 498.79');
    expect(m.q('[data-flow-stepper]')).toBeNull();
    m.click(m.q('[data-flow-pin="2"]'));
    expect(text('[data-flow-fact]')).toBe('Your directive · 1:40 PM · filed');
    const step = (label) => m.click(m.qa('[data-flow-stepper] button').find((b) => b.textContent === label));
    step('Next');
    expect(text('[data-flow-fact]')).toBe('Your agent · DE → PLTR · 2:00 PM · sold at 468.43');
    step('Next');
    expect(text('[data-flow-fact]')).toBe('Your directive · 2:20 PM · not filed');
    expect(m.qa('[data-flow-stepper] button').find((b) => b.textContent === 'Next').getAttribute('aria-disabled')).toBe('true');
    step('Next');   // at the end: stays
    expect(text('[data-flow-fact]')).toBe('Your directive · 2:20 PM · not filed');
    step('Previous');
    step('Previous');
    expect(text('[data-flow-fact]')).toBe('Your directive · 1:40 PM · filed');
    expect(m.qa('[data-flow-stepper] button').find((b) => b.textContent === 'Previous').getAttribute('aria-disabled')).toBe('true');
    clean(sep23Tape);
  });

  it('the panel is a polite live region; the pin link opens the tape at its anchor', () => {
    stubChartWidth(350);
    const calls = mount(sep23Tape);
    expect(m.q('[data-flow-below]').getAttribute('aria-live')).toBe('polite');
    expect(m.q('[data-flow-panel]').closest('[aria-live="polite"]')).toBeTruthy();
    m.click(m.q('[data-flow-pin-link]'));
    m.click(m.q('[data-flow-pin="1"]'));
    m.click(m.q('[data-flow-pin-link]'));
    m.click(m.q('[data-flow-pin="5"]'));
    m.click(m.q('[data-flow-pin-link]'));
    expect(calls.at).toEqual(['swap-2', 'swap-1', 'directives']);
    m.click(m.q('[data-flow-door]'));
    expect(calls.tape).toBe(1);
  });
});

describe('F-DIR — the directive panel', () => {
  const openDirective = (tape, n) => { stubChartWidth(2000); mount(tape); m.click(m.q(`[data-flow-pin="${n}"]`)); };
  it('"filed": the player\'s words marked "You", the agent\'s reply with its mark — each a quotation of its own path, clamped at three lines', () => {
    openDirective(sep23Tape, 2);
    expect(text('[data-flow-fact]')).toBe('Your directive · 1:40 PM · filed');
    const said = m.qa('[data-flow-said]');
    expect(said.map((s) => s.getAttribute('data-flow-said'))).toEqual(['player', 'agent']);
    expect(said[0].firstChild.textContent).toBe('You');
    expect(said[1].querySelector('[data-agent-mark]')).toBeTruthy();
    expect(m.qa('[data-quote-path]').map((q) => [q.getAttribute('data-quote-path'), q.textContent, q.getAttribute('data-collapsed')])).toEqual([
      ['directives[0].playerText', 'Protect the lead into the close.', 'yes'],
      ['directives[0].agentReply', 'Heard. I will tighten the downside stop for the rest of the session.', 'yes'],
    ]);
    expect(m.qa('[data-quote-attribution]').map((a) => a.textContent)).toEqual(['— the player · 1:40 PM', '— the agent · 1:40 PM']);
    clean(sep23Tape);
  });
  it('"not filed", and the reply LEFT OUT when agentReplyDiffers is true (it describes a filing that did not happen)', () => {
    openDirective(sep23Tape, 5);
    expect(text('[data-flow-fact]')).toBe('Your directive · 2:50 PM · not filed');
    expect(m.qa('[data-quote-path]').map((q) => q.getAttribute('data-quote-path'))).toEqual(['directives[2].playerText']);
    expect(m.container.textContent).not.toContain('Done — a chip tilt is filed.');
    clean(sep23Tape);
    m.teardown(); m.root = null; restoreWidth(); restoreWidth = null;
    const t = clone(sep23Tape);
    t.directives[0].agentReplyDiffers = true;
    openDirective(t, 2);
    expect(m.qa('[data-quote-path]').map((q) => q.getAttribute('data-quote-path'))).toEqual(['directives[0].playerText']);
    expect(m.container.textContent).not.toContain(t.directives[0].agentReply);
  });
  it('no Film Room sentence holds anyone\'s words: each recorded string appears only inside its own bound quotation', () => {
    openDirective(sep23Tape, 2);
    for (const q of m.qa('[data-quote-path]')) {
      const words = q.textContent;
      const outside = [...m.container.querySelectorAll('*')].filter((el) => !el.closest('[data-quote-path]') && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.includes(words)));
      expect(outside, words).toEqual([]);
    }
    for (const el of m.qa('[aria-label], [title]')) expect(`${el.getAttribute('aria-label')} ${el.getAttribute('title')}`).not.toMatch(/Protect|Heard/);
  });
});

describe('F-COPY — the front says only the spec\'s §11 words, the tape\'s values and quotations', () => {
  const states = () => {
    const quiet = clone(sep23Tape); quiet.actions = []; quiet.directives = [];
    const partial = clone(sep23Tape); partial.coverage.actions.status = 'partial';
    const earlier = clone(sep23Tape); earlier.battle.status = 'active';
    const noCpu = clone(sep23Tape); noCpu.score.opponentBasis = 'none';
    const unrecorded = clone(sep23Tape); unrecorded.actions[0].mechanism = 'mystery'; delete unrecorded.actions[0].symbolIn; unrecorded.actions[0].exitPrice = null;
    const loss = clone(sep23Tape); loss.battle.result.value = 'loss';
    const draw = clone(sep23Tape); draw.battle.result.value = 'draw';
    const final = clone(sep23Tape); final.battle.result.value = null;
    return { quiet, partial, earlier, noCpu, unrecorded, loss, draw, final };
  };
  it.each(['quiet', 'partial', 'earlier', 'noCpu', 'unrecorded', 'loss', 'draw', 'final'])('%s: every sweep clean', (name) => {
    const tape = states()[name];
    stubChartWidth(350);
    mount(tape, { moments: momentsCountOf(2) });
    clean(tape, { moments: 2 });
  });
  it('each state says what §4 – §9 say', () => {
    const s = states();
    const read = (tape, props) => { stubChartWidth(350); mount(tape, props); const out = { heading: text('[data-flow-heading]'), quiet: text('[data-flow-quiet]'), incomplete: text('[data-flow-incomplete]'), keys: m.qa('[data-flow-key]').map((k) => k.textContent), tiles: m.qa('[data-flow-tile]').map((t) => t.getAttribute('data-flow-tile')), legend: m.qa('[data-flow-legend-kind]').map((e) => e.getAttribute('data-flow-legend-kind')), fact: text('[data-flow-fact]'), cards: text('[data-flow-cards-line]') }; m.teardown(); m.root = null; restoreWidth(); restoreWidth = null; return out; };
    expect(read(s.quiet)).toMatchObject({ quiet: 'Nothing stood out in this game.', tiles: [], legend: [], fact: null });
    expect(read(s.partial)).toMatchObject({ incomplete: "Some of this day's record is incomplete. The full tape says what.", tiles: ['withYou'] });
    expect(read(s.earlier)).toMatchObject({ heading: 'Wed, Sep 23, 2026', keys: ['You −47', 'CPU −83'] });
    expect(read(s.noCpu)).toMatchObject({ keys: ['You −47'] });
    expect(read(s.loss).heading).toBe('Lost by 46');
    expect(read(s.draw).heading).toBe('Draw');
    expect(read(s.final).heading).toBe('Final −47');
    const u = read(s.unrecorded, {});
    expect(u.fact).toBe('Your agent · DE → PLTR · 2:00 PM · sold at 468.43');
    stubChartWidth(2000); mount(s.unrecorded); m.click(m.q('[data-flow-pin="1"]'));
    expect(text('[data-flow-fact]')).toBe('Maker not recorded · MSFT → not recorded · 12:45 PM');
    expect(m.q('[data-flow-pin="1"] [data-pin-shape]').getAttribute('data-pin-shape')).toBe('hollow');
  });
  it('the pinned copy list is §11\'s, and the sweep bites: a word that is not the spec\'s, a digit outside a binding, a mark on the front', () => {
    expect(SPEC_FLOW_COPY).toContain('Open the full tape');
    stubChartWidth(350);
    mount(sep23Tape);
    const p = document.createElement('p'); p.textContent = 'Great swap'; m.q('[data-flow-front]').appendChild(p);
    expect(flowCopyDefects(m.container)).toEqual(['not the spec\'s copy: “Great swap”']);
    p.textContent = 'Low 92';
    expect(sweepFlow(m.container, docs(sep23Tape))).toEqual(['stray digit on the front: “Low 92”']);
    p.remove();
    const mark = document.createElement('span'); mark.setAttribute('data-kind-mark', 'recorded'); m.q('[data-flow-key="you"]').appendChild(mark);
    expect(sweepFlow(m.container, docs(sep23Tape))).toContain('a number-kind mark on the front (FL-12)');
    mark.remove();
    m.q('[data-flow-key="you"] [data-flow-num]').setAttribute('data-flow-class', 'derived');
    expect(sweepFlow(m.container, docs(sep23Tape))).toContain('battle.final.total: class derived, declared recorded');
    m.q('[data-flow-key="you"] [data-flow-num]').setAttribute('data-flow-class', 'recorded');
    m.q('[data-flow-heading] [data-flow-agg]').setAttribute('data-agg-value', '47');
    m.q('[data-flow-heading] [data-flow-agg]').textContent = '47';
    expect(sweepFlow(m.container, docs(sep23Tape))).toContain('aggregate difference(the two displayed final scores): computed 47, the documents give 46');
  });
});

describe('the cards line (§9) and the desktop layout', () => {
  it('one moment, several, none: "1 moment …", "3 moments …", no line', () => {
    stubChartWidth(350);
    const calls = mount(sep23Tape, { moments: momentsCountOf(1) });
    expect(text('[data-flow-cards-line]')).toBe('1 moment to take home, on the full tape');
    m.click(m.q('[data-flow-cards-line]'));
    expect(calls.tape).toBe(1);
    clean(sep23Tape, { moments: 1 });
    m.teardown(); m.root = null;
    mount(sep23Tape, { moments: momentsCountOf(3) });
    expect(text('[data-flow-cards-line]')).toBe('3 moments to take home, on the full tape');
    clean(sep23Tape, { moments: 3 });
    m.teardown(); m.root = null;
    mount(sep23Tape, { moments: null });
    expect(m.q('[data-flow-cards-line]')).toBeNull();
  });
  it('desktop: the heading at 56, the panel beside the chart, the tiles in one row', () => {
    stubChartWidth(FLOW_LAYOUT.desktop.chartWidth);
    mount(sep23Tape, { desktop: true });
    expect(m.q('[data-flow-front]').getAttribute('data-flow-front')).toBe('desktop');
    expect(m.q('[data-flow-heading]').style.fontSize).toBe('56px');
    expect(m.q('[data-flow-tile]').parentElement.style.gridTemplateColumns).toBe('repeat(2, minmax(0,1fr))');
    expect(flowPinsOf(m.container).map((p) => p.members.length)).toEqual([1, 2, 1, 1]);
    clean(sep23Tape);
  });
});

describe('the review round — the front', () => {
  it('CH-3: a live switch between the phone and desktop layouts measures the chart again on its new element — the merge uses the width now rendered', () => {
    const desc = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get() { return this.hasAttribute('data-flow-chart-block') ? (this.closest('[data-flow-front]')?.getAttribute('data-flow-front') === 'desktop' ? FLOW_LAYOUT.desktop.chartWidth : FLOW_LAYOUT.phone.chartWidth) : 0; } });
    restoreWidth = () => { if (desc) Object.defineProperty(HTMLElement.prototype, 'clientWidth', desc); else delete HTMLElement.prototype.clientWidth; };
    mount(sep23Tape);
    expect(m.q('[data-flow-chart]').getAttribute('data-chart-width')).toBe('350');
    expect(flowPinsOf(m.container).map((p) => p.members.length)).toEqual([1, 3, 1]);
    m.render(<FilmRoomFlow tape={sep23Tape} desktop onOpenTape={() => {}} onOpenAt={() => {}} doorId="door-1" />);
    expect(m.q('[data-flow-chart]').getAttribute('data-chart-width')).toBe('639');
    expect(flowPinsOf(m.container).map((p) => p.members.length)).toEqual([1, 2, 1, 1]);
    m.render(<FilmRoomFlow tape={sep23Tape} onOpenTape={() => {}} onOpenAt={() => {}} doorId="door-1" />);
    expect(m.q('[data-flow-chart]').getAttribute('data-chart-width')).toBe('350');
    expect(flowPinsOf(m.container).map((p) => p.members.length)).toEqual([1, 3, 1]);
  });
  it('NUM-3: rows the chart cannot place (no instant) and no pin — the count of them on the full tape, never "Nothing stood out" beside it', () => {
    const t = clone(sep23Tape);
    for (const a of t.actions) a.at = null;
    for (const d of t.directives) d.filedAt = null;
    stubChartWidth(350);
    mount(t);
    expect(m.q('[data-flow-quiet]')).toBeNull();
    expect(text('[data-flow-more]')).toBe('6 more on the full tape');
    clean(t);
  });
});

describe("the review round — the tests' gaps on the front (TI-1, TI-5)", () => {
  it('M07: at 320 the panel steps through the group the chart DRAWS (the agent swap opens first in 3+, Previous at its end)', () => {
    stubChartWidth(FLOW_LAYOUT.narrow.chartWidth);
    mount(sep23Tape);
    const step = (label) => m.qa('[data-flow-stepper] button').find((b) => b.textContent === label);
    expect(text('[data-flow-fact]')).toBe('Your agent · DE → PLTR · 2:00 PM · sold at 468.43');
    expect(step('Previous').getAttribute('aria-disabled')).toBe('true');
    m.click(step('Next'));
    m.click(step('Next'));
    expect(text('[data-flow-fact]')).toBe('Your directive · 2:50 PM · not filed');
    expect(step('Next').getAttribute('aria-disabled')).toBe('true');
  });
  it('M08: a check with no score breaks the DRAWN line — two paths, never one through the gap', () => {
    const t = clone(sep23Tape);
    t.checks[5].scores = null;
    stubChartWidth(350);
    mount(t);
    expect(m.qa('[data-flow-line="you"]')).toHaveLength(2);
    expect(m.qa('[data-flow-line="cpu"]')).toHaveLength(2);
  });
  it('M09 / M10: a day whose low is drawn — "Low −92 · 1:30 PM" bound to that check; one event, so no "more" line', () => {
    const t = clone(sep23Tape);
    t.actions = [];
    t.directives = [t.directives[0]];
    t.directives[0].filedAt = '2026-09-23T14:20:00.000Z';
    stubChartWidth(350);
    mount(t);
    expect(text('[data-flow-low]')).toBe('Low −92 · 1:30 PM');
    expect(m.q('[data-flow-low] [data-flow-num]').getAttribute('data-flow-num')).toBe('checks[13].scores.total');
    expect(m.q('[data-flow-more]')).toBeNull();
    clean(t);
  });
  it('M38: under 360 px the narrow layout (the mock-up 320 frames): its padding, its chart height, its bleed', () => {
    const had = window.matchMedia;
    window.matchMedia = (q) => ({ matches: q === '(max-width: 359px)', addEventListener: () => {}, removeEventListener: () => {} });
    try {
      stubChartWidth(296);
      mount(sep23Tape);
      expect(m.q('[data-flow-front]').getAttribute('data-flow-front')).toBe('narrow');
      expect(m.q('[data-flow-chart]').style.height).toBe('112px');
      expect(m.q('[data-flow-chart-block]').style.margin).toBe('0px -4px');
      expect(m.q('[data-flow-heading]').style.fontSize).toBe('32px');
    } finally {
      window.matchMedia = had;
    }
  });
});
