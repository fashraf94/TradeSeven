// @vitest-environment jsdom
//
// src/screens/filmRoomV2/__fixtures__/filmRoomHarness.flow.jsdom.test.jsx
//
// Film Room D1 item 8 — THE HARNESS GAINS THE FRONT: its oracle covers the front's numbers. The sweeps are proved on
// planted markup, independent of the front's own code: a clean front passes, and each defect the oracle exists for is
// caught — a number at a path the front may not show, a wrong class, a wrong value, a mark on the front (FL-12), each
// aggregate recomputed from the documents (the margin from the key's DISPLAYED finals), a stray digit, a digit in an
// attribute, a word that is not §11's.

import { describe, it, expect, afterEach } from 'vitest';
import { sweepFlow, flowCopyDefects, sep23Tape, clone, SPEC_AGGREGATE_CLASSES, SPEC_FLOW_AGGREGATE_SITES, SPEC_FLOW_COPY } from './filmRoomHarness';

let host;
afterEach(() => { host?.remove(); host = null; });
const plant = (html) => { host = document.createElement('div'); host.innerHTML = `<div data-flow-front="phone">${html}</div>`; document.body.appendChild(host); return host; };

const num = (path, cls, text) => `<span data-flow-num="${path}" data-flow-doc="tape" data-flow-class="${cls}">${text}</span>`;
const agg = (name, value, text = String(value), cls = 'derived') => `<span data-flow-agg="${name}" data-flow-class="${cls}" data-agg-value="${value}">${text}</span>`;
const pin = (n, members, label = String(n)) => `<button data-flow-pin="${n}" data-flow-pin-members="${members}">${agg('ordinal(pins in time order)', n, label)}</button>`;
/** A Sep 23 front, planted by hand: the heading, the key, the five pins in three groups, the panel, "1 more", the tiles. */
const front = (over = {}) => [
  `<h1 data-flow-heading="won">Won by ${over.margin ?? agg('difference(the two displayed final scores)', 46)}</h1>`,
  `<div data-flow-keyrow=""><span data-flow-key="you">You ${over.you ?? num('battle.final.total', 'recorded', '−47')}</span><span data-flow-key="cpu">CPU ${num('battle.final.opponent', 'recorded', '−93')}</span></div>`,
  over.pins ?? `${pin(1, 'action:0')}${pin(2, 'directive:0 action:1 directive:1')}${pin(5, 'directive:2')}`,
  `<div data-flow-panel="3" data-flow-panel-member="action:1">${agg('ordinal(pins in time order)', 3)}<span data-flow-fact=""><span>Your agent</span> · <span data-flow-text="actions[1].symbolOut">DE</span> → <span data-flow-text="actions[1].symbolIn">PLTR</span> · <span data-time="">2:00 PM</span><span> · </span>sold at ${num('actions[1].exitPrice', 'recorded', '468.43')}</span>`,
  `<div data-flow-more="">${over.more ?? agg('count(tape rows beyond the chosen pins)', 1)} more on the full tape</div></div>`,
  `<div data-flow-tile="trading">${agg('count(actions[] by the agent)', over.agentSwaps ?? 1)} of ${agg('count(actions[])', 3)}</div>`,
  `<div data-flow-tile="withYou">${agg('count(directives[] filed)', 1)} of ${agg('count(directives[])', 3)}</div>`,
  over.extra ?? '',
].join('');

describe('sweepFlow — the front\'s numbers, bound', () => {
  it('a clean planted front passes, and every aggregate the front states has a site and a declared class', () => {
    expect(sweepFlow(plant(front()), { tape: sep23Tape })).toEqual([]);
    for (const name of Object.keys(SPEC_FLOW_AGGREGATE_SITES)) expect(SPEC_AGGREGATE_CLASSES[name], name).toBe('derived');
  });
  it('a tape number: a path the front may not show, a class not the tape\'s, a value not the tape\'s, more than its number', () => {
    expect(sweepFlow(plant(front({ you: num('score.dayChange.value', 'derived', '−47') })), { tape: sep23Tape })).toContain('score.dayChange.value: not a path the front may show');
    expect(sweepFlow(plant(front({ you: num('battle.final.total', 'derived', '−47') })), { tape: sep23Tape })).toContain('battle.final.total: class derived, declared recorded');
    expect(sweepFlow(plant(front({ you: num('battle.final.total', 'recorded', '−46') })), { tape: sep23Tape })).toContain('battle.final.total: shows −46, the document holds -47');
    expect(sweepFlow(plant(front({ you: `<span data-flow-num="battle.final.total" data-flow-doc="tape" data-flow-class="recorded">−47<b></b></span>` })), { tape: sep23Tape })).toContain('battle.final.total: holds more than its number');
  });
  it('the margin is the key\'s DISPLAYED finals\' difference: a margin from other values is caught; one equal to the display passes', () => {
    expect(sweepFlow(plant(front({ margin: agg('difference(the two displayed final scores)', 47) })), { tape: sep23Tape })).toContain('aggregate difference(the two displayed final scores): computed 47, the documents give 46');
    const t = clone(sep23Tape); t.battle.final.total = 10.004; t.battle.final.opponent = 5.006;
    const key = `<div data-flow-keyrow=""><span>${num('battle.final.total', 'recorded', '+10')}</span><span>${num('battle.final.opponent', 'recorded', '+5.01')}</span></div>`;
    const page = (margin) => `<h1 data-flow-heading="won">Won by ${agg('difference(the two displayed final scores)', margin)}</h1>${key}`;
    expect(sweepFlow(plant(page(4.99)), { tape: t })).toEqual([]);
    host.remove();
    expect(sweepFlow(plant(page(5)), { tape: t })).toContain('aggregate difference(the two displayed final scores): computed 5, the documents give 4.99');
  });
  it('each count recomputed from the tape: the agent\'s swaps by the recorded mechanism, the rows beyond the pins, the ordinals in time order', () => {
    expect(sweepFlow(plant(front({ agentSwaps: 2 })), { tape: sep23Tape })).toContain('aggregate count(actions[] by the agent): computed 2, the documents give 1');
    expect(sweepFlow(plant(front({ more: agg('count(tape rows beyond the chosen pins)', 2) })), { tape: sep23Tape })).toContain('aggregate count(tape rows beyond the chosen pins): computed 2, the documents give 1');
    const swapped = `${pin(1, 'action:0')}${pin(5, 'directive:0 action:1 directive:1')}${pin(2, 'directive:2')}`;
    const bad = sweepFlow(plant(front({ pins: swapped })), { tape: sep23Tape });
    expect(bad).toContain('aggregate ordinal(pins in time order): computed 5, the documents give 2');
    expect(bad).toContain('aggregate ordinal(pins in time order): computed 2, the documents give 5');
  });
  it('an aggregate away from its site, or under the wrong class, is caught', () => {
    expect(sweepFlow(plant(front({ extra: `<p>${agg('count(actions[])', 3)}</p>` })), { tape: sep23Tape })).toContain('aggregate count(actions[]): outside its site');
    expect(sweepFlow(plant(front({ more: agg('count(tape rows beyond the chosen pins)', 1, '1', 'recorded') })), { tape: sep23Tape })).toContain('aggregate count(tape rows beyond the chosen pins): class recorded, declared derived');
  });
  it('a stray digit, a digit in an attribute, a number-kind mark, a symbol not the tape\'s — each caught', () => {
    expect(sweepFlow(plant(front({ extra: '<p>Low 92</p>' })), { tape: sep23Tape })).toEqual(['stray digit on the front: “Low 92”']);
    expect(sweepFlow(plant(front({ extra: '<button aria-label="Pin 1">x</button>' })), { tape: sep23Tape })).toEqual(['a digit in aria-label on the front: “Pin 1”']);
    expect(sweepFlow(plant(front({ extra: '<span data-kind-mark="recorded">R</span>' })), { tape: sep23Tape })).toEqual(['a number-kind mark on the front (FL-12)']);
    expect(sweepFlow(plant(front({ extra: '<span data-flow-text="actions[0].symbolOut">AAPL</span>' })), { tape: sep23Tape })).toEqual(['actions[0].symbolOut: shows “AAPL”, the tape holds "MSFT"']);
    expect(sweepFlow(plant(front({ extra: '<span data-time="">12:45 PM</span>' })), { tape: sep23Tape })).toEqual([]);
  });
});

describe('the review round (NUM-5): each tape number at its site, on its day', () => {
  it("a final score on an earlier day, the last check's value on the final day, a check that is not the lowest, a price outside a fact — each caught", () => {
    const earlier = clone(sep23Tape); earlier.isFinalDay = false;
    expect(sweepFlow(plant(front()), { tape: earlier })).toContain("battle.final.total: a final score on a day that is not the battle's final day");
    host.remove();
    expect(sweepFlow(plant(front({ you: num('score.lastCheck.total', 'recorded', '−47') })), { tape: sep23Tape })).toContain("score.lastCheck.total: the last check's value on the battle's final day");
    host.remove();
    expect(sweepFlow(plant(front({ extra: `<span data-flow-low="">Low ${num('checks[14].scores.total', 'recorded', '−91')}</span>` })), { tape: sep23Tape })).toContain("checks[14].scores.total: not the day's lowest scored check (checks[13])");
    host.remove();
    expect(sweepFlow(plant(front({ extra: `<span data-flow-low="">Low ${num('checks[13].scores.total', 'recorded', '−92')}</span>` })), { tape: sep23Tape })).toEqual([]);
    host.remove();
    expect(sweepFlow(plant(front({ extra: `<p>${num('actions[0].exitPrice', 'recorded', '498.79')}</p>` })), { tape: sep23Tape })).toContain('actions[0].exitPrice: outside its site');
  });
});

describe('flowCopyDefects — the front\'s words are §11\'s', () => {
  it('the planted front passes; a word that is not the spec\'s is named; the pinned list is §11\'s', () => {
    expect(flowCopyDefects(plant(front()))).toEqual([]);
    host.remove();
    expect(flowCopyDefects(plant(front({ extra: '<p>A strong game</p>' })))).toEqual(['not the spec\'s copy: “A strong game”']);
    expect(SPEC_FLOW_COPY).toHaveLength(41);   // fix round item 1: "Won" and "Lost" (Amendment A DA-4; 39 before)
    expect(SPEC_FLOW_COPY).not.toContain('directives acted on');
  });
});

describe('the review round (TI-4) — the copy oracle reads attributes and instants, inside the panel too', () => {
  it('words in an aria-label or a title on the front, words in an instant element, and a word planted INSIDE the panel — each caught', () => {
    expect(flowCopyDefects(plant(front({ extra: '<div role="img" aria-label="The game chart"></div>' })))).toEqual(['words in aria-label on the front: “The game chart”']);
    host.remove();
    expect(flowCopyDefects(plant(front({ extra: '<span data-time="">Details we chose</span>' })))).toEqual(['not an instant: “Details we chose”']);
    host.remove();
    expect(flowCopyDefects(plant(front({ extra: '<span data-time="">Sep 22, 8:30 PM</span>' })))).toEqual([]);
    host.remove();
    const page = plant(`<div data-flow-below=""><div data-flow-panel="1"><span>Details</span></div></div>`);
    expect(flowCopyDefects(page)).toEqual(["not the spec's copy: “Details”"]);
  });
});
