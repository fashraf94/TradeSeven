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

/**
 * The stream's text WITHOUT the scope's live region — that node exists to say
 * out loud that the filter changed, so it is the one thing that legitimately
 * differs between two otherwise identical renders.
 */
const visibleText = () => {
  const clone = container.cloneNode(true);
  clone.querySelectorAll('[data-scope-announce]').forEach((el) => el.remove());
  return clone.textContent;
};

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

  it('a scope→SCOPE switch moves the stream to the new piece\'s newest entry (review RA-F5)', () => {
    // Reachable without ever clearing: open one row's Why?, tap its door, open
    // another row, tap its door — `setScopeSymbol` goes SLB → NVDA with no
    // null in between. The transition ref held a BOOLEAN, so this read as "no
    // change" and wrote nothing: the reader stayed at SLB's offset inside
    // NVDA's stream, against this effect's own premise.
    render();
    const el = giveLayout(listEl(), { scrollHeight: 900, scrollTop: 0 });
    render({ scopeSymbol: 'SLB' });
    expect(el.scrollTop).toBe(900);

    // Somewhere else in SLB's stream, then straight to NVDA.
    el.scrollTop = 42;
    act(() => { el.dispatchEvent(new Event('scroll')); });
    render({ scopeSymbol: 'NVDA' });
    expect(el.scrollTop).toBe(900);

    // …and clearing from the SECOND scope still restores the WHOLE tape's
    // position, not the first scope's — the scoped scroll was never recorded.
    render({ scopeSymbol: null });
    expect(el.scrollTop).toBe(0);
  });

  it('THE EFFECT WRITES NOTHING ON MOUNT — the early return\'s own claim (review RA-F5)', () => {
    // Which half of the L2-F5 fix is load-bearing, stated honestly. The two
    // are redundant GIVEN each other: with the dep list narrow the effect
    // never re-runs at an unchanged scope, so the early return has nothing to
    // catch there; with the early return present a widened dep list re-runs
    // the effect and it returns immediately. Neither `writes === 0` row can
    // separate them, which is why both survived mutation (refuter A M26/M27)
    // and why the review record's claim that the DEP LIST is the fix was
    // wrong. Only one behaviour distinguishes them, and it is this one: the
    // effect must not write on MOUNT. Without the early return it does — and a
    // programmatic `scrollTop` on mount is exactly the cancelled auto-scroll
    // the finding was about. The dep list is kept for cost, not for behaviour.
    //
    // Spied on the prototype, because the element does not exist until the
    // render whose mount is under test.
    const proto = Object.getPrototypeOf(document.createElement('div'));
    const original = Object.getOwnPropertyDescriptor(proto, 'scrollTop');
    let writes = 0;
    Object.defineProperty(proto, 'scrollTop', {
      configurable: true, get: () => 0, set: () => { writes += 1; },
    });
    try {
      render();                                   // mount, unscoped
      expect(writes).toBe(0);
      render({ scopeSymbol: 'SLB' });             // …and a real transition still writes
      expect(writes).toBe(1);
    } finally {
      if (original) Object.defineProperty(proto, 'scrollTop', original);
      else delete proto.scrollTop;
    }
  });

  it('a re-render with an UNCHANGED scope writes no scroll at all (review L2-F5)', () => {
    // `tapeEntries` is a fresh array on every Firestore snapshot — and through
    // `receipts`, on renders that touch nothing in the tape — so keeping it in
    // this effect's deps wrote `scrollTop` on the coarse clock's minute tick
    // and on every price poll, cancelling the smooth auto-scroll that runs two
    // effects earlier. The scope's TRANSITION is the whole trigger.
    render();
    const el = giveLayout(listEl(), { scrollHeight: 900, scrollTop: 0 });
    let writes = 0;
    Object.defineProperty(el, 'scrollTop', {
      configurable: true, get: () => 0, set: () => { writes += 1; },
    });
    // A fresh tape array, twice, with the scope unchanged.
    render({ tapeEntries: [...tapeEntries] });
    render({ tapeEntries: [...tapeEntries] });
    expect(writes).toBe(0);
    // …and the transition itself still writes.
    render({ tapeEntries: [...tapeEntries], scopeSymbol: 'SLB' });
    expect(writes).toBe(1);
  });

  it('the review-mode blocks do NOT leak into a scope (review RB-F8)', () => {
    // Both blocks are attached by INDEX, after the filter has run, and neither
    // is a tape item the filter could judge: the grading block lists EVERY
    // trade in the battle, the proposal cards are the day's unanswered ones.
    // With an auto-debrief that names NVDA, `NVDA · All` was rendering a
    // `GILD → MOS` grading card — one line under a filter that had just
    // dropped GILD's own card. Every battle past its first debrief reaches it.
    const withDebrief = [
      ...EXCHANGES,
      {
        userMessage: '__AUTO__', agentResponse: 'Debrief: NVDA carried the book today.',
        isAutoDebrief: true, messageType: 'auto_debrief', timestamp: T('21:01'),
      },
    ];
    const props = {
      chatExchanges: withDebrief,
      tapeEntries: buildTape({
        trades: TRADES, statusFeed: [], evaluations: EVALUATIONS, receipts: {},
        chatExchanges: withDebrief,
      }),
      trades: [{ symbolOut: 'GILD', symbolIn: 'MOS', tier: 'core', status: 'open' }],
      proposalHistory: [{ resolution: 'lapsed', symbolOut: 'GILD', symbolIn: 'MOS' }],
    };

    // UNSCOPED both blocks are on screen, exactly as they shipped.
    render(props);
    expect(container.textContent).toContain("Grade Today's Trades");
    const unscopedGrading = visibleText();

    // SCOPED to the piece the debrief names — the debrief itself survives the
    // filter, so the index it anchors is a real one and the old code fired.
    render({ ...props, scopeSymbol: 'NVDA' });
    expect(container.querySelector('[data-tape-scope="NVDA"]')).toBeTruthy();
    expect(container.textContent).toContain('NVDA carried the book today.');
    expect(container.textContent).not.toContain("Grade Today's Trades");

    // MUTATION ROW — the suppression is what removes them, not the fixture.
    // Restore the scope to null and the same two blocks come back, so neither
    // absence above is an artefact of the props.
    render({ ...props, scopeSymbol: null });
    expect(container.textContent).toContain("Grade Today's Trades");
    expect(visibleText()).toBe(unscopedGrading);
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
