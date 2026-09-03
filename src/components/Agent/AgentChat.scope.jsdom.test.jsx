// @vitest-environment jsdom
//
// src/components/Agent/AgentChat.scope.jsdom.test.jsx
//
// A2.3 (D-73) — the scoped stream, the chip, and the scroll the player gets
// back.
//
// The seed asks for one thing the unit tests cannot hold: "clearing the scope
// restores the whole tape at its previous scroll." jsdom does no layout, so
// `scrollTop` and `scrollHeight` are defined on the instance here — the
// component's own reads and writes are then real, and the rows below are
// about the component's logic rather than about a browser's.
//
// The rows also hold the two structural rules the filter has to obey: a
// scoped stream does NOT fold its quiet checks (a run built for one adjacency
// is meaningless in another), and flag-off nothing here exists at all.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

vi.mock('firebase/auth', () => ({ getAuth: vi.fn(() => ({ currentUser: null })) }));
vi.mock('../../firebase/config', () => ({ auth: {}, db: {}, default: {} }));
vi.mock('../../services/agentService', () => ({ submitDailyGrades: vi.fn() }));
vi.mock('./LiveActivityPanel', () => ({ default: () => null, BreakthroughAlerts: () => null }));

import AgentChat from './AgentChat';
import { buildTape } from '../../screens/battleView/buildTape';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
}

const T = (hhmm) => `2026-09-01T${hhmm}:00.000Z`;
const ROSTER = new Set(['NVDA', 'SLB', 'GILD', 'MOS']);

const EXCHANGES = [
  { userMessage: 'how is SLB doing?', agentResponse: 'SLB is holding its bid.', timestamp: T('15:31') },
  { userMessage: 'and the rest?', agentResponse: 'NVDA is extending.', timestamp: T('16:31') },
];
const TRADES = [{
  symbolOut: 'GILD', symbolIn: 'MOS', tier: 'core', lockedPoints: 8.04,
  swappedOutAt: T('17:31'), source: 'haiku', rationale: 'A rotation of the core slot.',
}];
// Two quiet checks that WOULD fold into `2 checks · no change` unscoped.
const QUIET = { decision: 'HOLD', downgraded: false, rationale: 'SLB is quiet.', scores: { active: 1, banked: 40 } };
const EVALUATIONS = [
  { ...QUIET, evalId: 'e1', timestamp: T('18:31') },
  { ...QUIET, evalId: 'e2', timestamp: T('18:46') },
];

const tapeEntries = buildTape({
  trades: TRADES, statusFeed: [], evaluations: EVALUATIONS, receipts: {}, chatExchanges: EXCHANGES,
});

const BASE = {
  battleId: 'ab-1', agentId: 'agent-1', agentName: 'Aurora',
  chatExchanges: EXCHANGES, battleStatus: 'active', statusFeed: [], trades: [],
  knownTickers: ROSTER,
};

let container;
let root;
beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const render = (props = {}) => act(() => {
  root.render(<AgentChat {...BASE} tapeEntries={tapeEntries} onClearScope={() => {}} {...props} />);
});

/** The scroll area: the one div the chat lays out as `overflow-y: auto`. */
const listEl = () => [...container.querySelectorAll('div')].find((el) => el.style.overflowY === 'auto');

/** jsdom does no layout; give the instance the two numbers the effect reads. */
function giveLayout(el, { scrollHeight = 900, scrollTop = 0 } = {}) {
  Object.defineProperty(el, 'scrollHeight', { value: scrollHeight, configurable: true });
  Object.defineProperty(el, 'scrollTop', { value: scrollTop, writable: true, configurable: true });
  return el;
}

describe('A2.3 — the scoped stream', () => {
  it('unscoped, the quiet checks FOLD and every kind is present', () => {
    render();
    expect(container.querySelector('[data-tape-kind="checkRun"]')).toBeTruthy();
    expect(container.querySelector('[data-tape-kind="trade"]')).toBeTruthy();
    expect(container.textContent).toContain('NVDA is extending.');
    expect(container.querySelector('[data-tape-scope]')).toBeNull();
  });

  it('scoped, the chip names the piece and the way out, and only that piece\'s entries render', () => {
    render({ scopeSymbol: 'SLB' });
    const chip = container.querySelector('[data-tape-scope="SLB"]');
    expect(chip).toBeTruthy();
    expect(chip.textContent).toBe('SLB · All');

    // SLB's two messages and its two checks; not the GILD → MOS trade, not
    // the message about NVDA.
    expect(container.textContent).toContain('SLB is holding its bid.');
    expect(container.textContent).not.toContain('NVDA is extending.');
    expect(container.querySelector('[data-tape-kind="trade"]')).toBeNull();
  });

  it('a SCOPED stream does not fold — the run is meaningless at a new adjacency', () => {
    render({ scopeSymbol: 'SLB' });
    expect(container.querySelector('[data-tape-kind="checkRun"]')).toBeNull();
    expect(container.querySelectorAll('[data-tape-kind="check"]').length).toBe(2);
  });

  it('scoping moves the stream to its newest entry; CLEARING restores the whole tape\'s scroll', () => {
    render();
    const el = giveLayout(listEl(), { scrollHeight: 900, scrollTop: 0 });

    // The player scrolls the WHOLE tape to 120 and leaves it there.
    el.scrollTop = 120;
    act(() => { el.dispatchEvent(new Event('scroll', { bubbles: false })); });

    // Scoping: newest-at-the-bottom, which is the stream's own premise — a
    // carried-over 120 would land the reader in clamped whitespace.
    render({ scopeSymbol: 'SLB' });
    expect(el.scrollTop).toBe(900);

    // Clearing: back where they left it.
    render({ scopeSymbol: null });
    expect(el.scrollTop).toBe(120);
  });

  it('a scroll made WHILE scoped is not mistaken for the whole tape\'s position', () => {
    render();
    const el = giveLayout(listEl(), { scrollHeight: 900, scrollTop: 0 });
    el.scrollTop = 300;
    act(() => { el.dispatchEvent(new Event('scroll')); });

    render({ scopeSymbol: 'SLB' });
    el.scrollTop = 42;                                   // the player scrolls the SCOPED list
    act(() => { el.dispatchEvent(new Event('scroll')); });

    render({ scopeSymbol: null });
    expect(el.scrollTop).toBe(300);
  });

  it('FLAG OFF — no chip, no filter, and the scroll effect never runs', () => {
    act(() => { root.render(<AgentChat {...BASE} scopeSymbol="SLB" onClearScope={() => {}} />); });
    expect(container.querySelector('[data-tape-scope]')).toBeNull();
    expect(container.querySelector('[data-tape-kind]')).toBeNull();
    // The stream is the shipped one: both messages, unfiltered.
    expect(container.textContent).toContain('SLB is holding its bid.');
    expect(container.textContent).toContain('NVDA is extending.');
  });
});
