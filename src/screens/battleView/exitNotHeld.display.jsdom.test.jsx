// @vitest-environment jsdom
//
// src/screens/battleView/exitNotHeld.display.jsdom.test.jsx
//
// Cockpit exit-not-held — contract Amendment E rev 2, E-2 on the DISPLAYS
// (docs/CALL_RECORD_FIELD_CONTRACT_V1_4_AMENDMENT_E.md). While an exit call's stock is
// in NO tier of the battle document the screen already reads, no answer is legal on it
// (the endpoint refuses them all, acknowledgments included), so:
//   the 2a tile         no button, a line that reads "Not in your book"
//   the details sheet   the same buttons as the tile — none — and the same tag
//   the 2b card         no button, no "Who comes in?" step, the same tag
// The test is answers.js isExitNotHeld — ANY tier, never the call's own `slot` (in League
// battles the agent's slot label is a guess) — fed from the battle document (`book`), and
// every row drives the REAL model (buildCockpitFeed / sheetOf / cardViewOf through the
// mounted components) over record fixtures (BUILD_RULES §9: no hand-made tiles).
// The screen's own wiring (the battle document reaching buildCockpitFeed) is the last row.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

vi.mock('framer-motion', async () => {
  const ReactMod = await import('react');
  const pass = (tag) => ReactMod.forwardRef(({ initial: _initial, animate: _animate, exit: _exit, transition: _transition, layoutId: _layoutId, ...rest }, ref) => ReactMod.createElement(tag, { ref, ...rest }));
  return { motion: { div: pass('div'), span: pass('span') }, AnimatePresence: ({ children }) => children };
});

import CockpitFeed from './CockpitFeed';
import CockpitSheet from './CockpitSheet';
import Cockpit2b from './Cockpit2b';
import { buildCockpitFeed, sheetOf, eventsByCall } from './cockpitModel';
import { liveCommandOf } from './cockpit2bModel';
import { useCockpit2bAnswer } from './useCockpit2bAnswer';
import { BATTLE_VIEW_COPY as COPY } from './battleViewCopy';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const HERE = dirname(fileURLToPath(import.meta.url));
const T = (iso) => Date.parse(iso);
/** Wed Oct 21 2026, 1:20 PM ET. */
const NOW = T('2026-10-21T17:20:00.000Z');
const CLOSE = T('2026-10-21T20:00:00.000Z');
const at = (hhmmEt) => { const [h, m] = hhmmEt.split(':').map(Number); return T(`2026-10-21T${String(h + 4).padStart(2, '0')}:${String(m).padStart(2, '0')}:20.000Z`); };
const iso = (ms) => new Date(ms).toISOString();
const EVALS = [{ evalId: 'eval_020', promptBuiltAt: iso(at('12:00')), evidence: { VLO: { px: 161.22 }, ZS: { px: 301.5 } } }];
const NOT_IN_BOOK = 'Not in your book';

let seq = 0;
const call = (over = {}) => {
  seq += 1;
  const minted = at('12:00') + 40_000;
  return {
    callId: `b:eval_020:call:${String(seq).padStart(3, '0')}`, kind: 'confirmation', battleId: 'b', evalId: 'eval_020', evalSeq: 20, mintedAt: minted, mintedMode: 'on',
    symbol: 'VLO', direction: 'exit', heldAtMint: false, slot: 'core', counterpart: null, counterpartRaw: null,
    condition: { side: 'below', level: 158.4 }, horizon: { phrase: 'this_session', expiresAt: CLOSE, basis: 'this_session' },
    defaultAction: 'act', said: 'x', saidOk: true, evidence: { tickId: null, availability: 'off', priceAsOf: iso(minted - 40_000) },
    state: 'open', stateChangedAt: minted, stateSource: 'mint', playerResponse: null, directiveThreadId: null, outcome: null, refused: null,
    replacementOptions: [{ symbol: 'MPC', source: 'agent' }, { symbol: 'XOM', source: 'bench' }],
    invalidatedReason: null,
    ...over,
  };
};
const holdShot = (over = {}) => call({ kind: 'called_shot', defaultAction: 'hold', ...over });
const entryShot = (over = {}) => call({ kind: 'called_shot', symbol: 'AMD', direction: 'entry', slot: 'support', counterpart: 'KO', condition: { side: 'above', level: 163.5 }, replacementOptions: null, ...over });
/** The battle document the screen reads: VLO in core, ZS in star, KO + AMD in support. */
const bookWith = (over = {}) => ({
  directive: null,
  portfolio: { star: [{ symbol: 'ZS' }], core: [{ symbol: 'VLO' }], support: [{ symbol: 'KO' }, { symbol: 'AMD' }], bench: { stocks: [{ symbol: 'XOM' }] }, ...over },
  watchlist: { hotBench: ['MPC'] },
});
const HELD = bookWith();
/** VLO has left the book (sold elsewhere, risk loop, a swap that did not act the call). */
const LEFT = bookWith({ core: [] });
/** VLO is held — in `support`, while the call names `core` (the League slot-label guess). */
const ELSEWHERE = bookWith({ core: [], support: [{ symbol: 'KO' }, { symbol: 'VLO' }] });
const feedOf = (calls, over = {}) => buildCockpitFeed({ calls, events: [], evaluations: EVALS, directive: null, nowMs: NOW, v2: true, nextDecisionAt: iso(at('13:30')), ...over });
const tilesOf = (feed) => [...feed.needsYou, ...feed.waiting, ...feed.earlier];
const tileOf = (calls, over) => tilesOf(feedOf(calls, over))[0];
const answers = (tile) => tile.buttons.map((b) => b.answer);

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
const q = (sel) => container.querySelector(sel);
const qa = (sel) => [...container.querySelectorAll(sel)];

describe('the tile model — no button, no step, the line "Not in your book"', () => {
  it('an act-default exit whose stock is in no tier: no buttons, no "Who comes in?" step, the tag reads Not in your book, the card waits', () => {
    const t = tileOf([call()], { book: LEFT });
    expect(t.buttons).toEqual([]);
    expect(t.step).toBeNull();
    expect(t.tag).toEqual({ fact: 'call:not_held', tone: 'muted', text: NOT_IN_BOOK });
    expect(t.group).toBe('waiting');
  });

  it('a hold-default exit (the "Exit instead" card) the same; the same without the 2b flag', () => {
    for (const v2 of [true, false]) {
      const t = tileOf([holdShot()], { book: LEFT, v2 });
      expect([t.buttons, t.step, t.tag.text], `v2 ${v2}`).toEqual([[], null, NOT_IN_BOOK]);
    }
  });

  it('the control: held in the slot it names → the buttons and the step stand, and the tag is the bare Live', () => {
    const t = tileOf([call()], { book: HELD });
    expect(answers(t)).toEqual(['go', 'hold']);
    expect(t.step).toBe('on_card');
    expect(t.tag.fact).toBe('state:open');
    expect(answers(tileOf([holdShot()], { book: HELD }))).toEqual(['hold', 'go_now']);
    expect(tileOf([holdShot()], { book: HELD }).step).toBe('after_exit_instead');
  });

  it('ANY tier: held in a DIFFERENT tier than the call names → still in the book, so nothing is withdrawn', () => {
    const t = tileOf([call()], { book: ELSEWHERE });
    expect(answers(t)).toEqual(['go', 'hold']);
    expect(t.step).toBe('on_card');
    expect(t.tag.fact).toBe('state:open');
  });

  it('nothing is claimed that is not seen: no book, a book without a portfolio, or one with no tier arrays → the tile is exactly as before', () => {
    for (const book of [undefined, null, {}, { portfolio: null }, { portfolio: { bench: { stocks: [] } } }]) {
      const t = tileOf([call()], { book });
      expect(answers(t), JSON.stringify(book)).toEqual(['go', 'hold']);
      expect(t.step, JSON.stringify(book)).toBe('on_card');
      expect(t.tag.fact, JSON.stringify(book)).toBe('state:open');
    }
  });

  it('only exits: an entry call on a stock that is not held (the normal case), an upside call and a pick are untouched', () => {
    const entry = tileOf([entryShot()], { book: LEFT });
    expect(answers(entry)).toEqual(['go', 'hold']);
    expect(entry.tag.fact).toBe('state:open');
    const upside = tileOf([entryShot({ heldAtMint: true, symbol: 'VLO' })], { book: LEFT });
    expect(upside.buttons).toEqual([]);
    expect(upside.tag.fact).toBe('state:open'); // an upside call is an ENTRY on a held name — never "Not in your book"
  });

  it('what is recorded stays as recorded: an acknowledgment, a filed directive, an act, a hit — each keeps its own tag', () => {
    const ack = tileOf([call({ playerResponse: { answer: 'go', kind: 'ack', callId: 'x', filedAt: iso(at('13:05')) } })], { book: LEFT });
    expect(ack.tag.fact).toBe('answer:ack');
    const filed = call({ playerResponse: { answer: 'hold', kind: 'directive', directiveThreadId: 'th-1', callId: 'x', filedAt: iso(at('13:05')), heardEvalId: null } });
    expect(tileOf([filed], { book: LEFT }).tag.fact).toBe('answer:directive_left_slot');
    const acted = tileOf([call({ outcome: { actedEvalId: 'eval_021' } })], { book: LEFT });
    expect(acted.tag.fact).toBe('event:acted');
    expect(acted.buttons).toEqual([]);
    const hit = tileOf([call({ state: 'hit', stateChangedAt: at('13:10') })], { book: LEFT });
    expect(hit.tag.fact).toBe('state:hit');
    // A recorded event on a still-unanswered open call is a fact too: only the bare "Live" gives way.
    const c = call();
    const noMatch = { kind: 'no_matching_trade', at: at('13:05'), callIds: [c.callId], evidence: { promptBuiltAt: iso(at('13:00')) } };
    const withEvent = tileOf([c], { book: LEFT, events: [noMatch] });
    expect(withEvent.tag.fact).toBe('event:no_matching_trade');
    expect(withEvent.buttons).toEqual([]); // and still no answer is offered
  });

  it('the details sheet is the tile\'s: sheetOf carries the same (empty) buttons and the same tag', () => {
    const tile = tileOf([call()], { book: LEFT });
    const sheet = sheetOf(tile, { eventsMap: eventsByCall([]), evaluations: EVALS, nowMs: NOW });
    expect(sheet.buttons).toEqual([]);
    expect(sheet.tag).toEqual({ fact: 'call:not_held', tone: 'muted', text: NOT_IN_BOOK });
    const control = sheetOf(tileOf([call()], { book: HELD }), { eventsMap: eventsByCall([]), evaluations: EVALS, nowMs: NOW });
    expect(control.buttons.map((b) => b.answer)).toEqual(['go', 'hold']);
  });
});

describe('the 2a tile, mounted', () => {
  const render = (props) => act(() => { root.render(<CockpitFeed emptyLine={COPY.cockpitEmpty(null)} {...props} />); });

  it('reads "Not in your book" and offers no answer; with the stock held the same tile offers its two buttons', () => {
    render({ feed: feedOf([call()], { book: LEFT, v2: false }) });
    expect(qa('[data-cockpit-answer]')).toHaveLength(0);
    expect(q('[data-cockpit-tag="call:not_held"]').textContent).toBe(NOT_IN_BOOK);
    expect(container.textContent).toContain(NOT_IN_BOOK);
    render({ feed: feedOf([call()], { book: HELD, v2: false }) });
    expect(qa('[data-cockpit-answer]').map((b) => b.getAttribute('data-cockpit-answer'))).toEqual(['go', 'hold']);
    expect(container.textContent).not.toContain(NOT_IN_BOOK);
  });
});

describe('the details sheet, mounted', () => {
  const sheetFor = (calls, book) => sheetOf(tileOf(calls, { book, v2: false }), { eventsMap: eventsByCall([]), evaluations: EVALS, nowMs: NOW });
  const render = (props) => act(() => { root.render(<CockpitSheet onClose={() => {}} onAnswer={() => {}} onOpenCheck={() => {}} {...props} />); });

  it('reads "Not in your book" and offers no answer; with the stock held it offers the tile\'s buttons', () => {
    render({ sheet: sheetFor([call()], LEFT) });
    expect(qa('[data-cockpit-answer]')).toHaveLength(0);
    expect(container.textContent).toContain(NOT_IN_BOOK);
    render({ sheet: sheetFor([call()], HELD) });
    expect(qa('[data-cockpit-answer]').map((b) => b.getAttribute('data-cockpit-answer'))).toEqual(['go', 'hold']);
    expect(container.textContent).not.toContain(NOT_IN_BOOK);
  });
});

describe('the 2b card, mounted', () => {
  function Harness({ calls, battle }) {
    const live = liveCommandOf({ directive: battle?.directive ?? null, nowMs: NOW });
    const flow = useCockpit2bAnswer({ submit: vi.fn(async () => ({ status: 200, body: {} })), live, calls });
    // The screen's own call (AgentBattleScreen.jsx): the battle document's portfolio rides in as `book`.
    const feed = buildCockpitFeed({ calls, events: [], evaluations: EVALS, directive: null, nowMs: NOW, v2: true, nextDecisionAt: iso(at('13:30')), book: { portfolio: battle?.portfolio ?? null } });
    return (
      <Cockpit2b
        feed={feed}
        records={{ calls, events: [], rawExchanges: [], battle, evaluations: EVALS }}
        agent="Shadow"
        monitoring={null}
        nowMs={NOW}
        phone={false}
        vintage="Prices as of the 12:00 PM check · next ~1:30 PM"
        nextDecisionAt={iso(at('13:30'))}
        flow={flow}
        onOpenSheet={() => {}}
        onOpenBench={() => {}}
      />
    );
  }
  const render = (props) => act(() => { root.render(<Harness {...props} />); });

  const click = async (el) => { await act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); }); };

  it('no button and no "Who comes in?" step; the chip says "not in your book" and the opened card reads "Not in your book"', async () => {
    render({ calls: [call()], battle: LEFT });
    // Nothing needs you: the call waits in the strip, whose chip names the fact in place of the agent's default word.
    expect(q('[data-cockpit-now]')).toBeNull();
    expect(q('[data-cockpit-chip]').textContent).toBe('VLO↓158.40 · not in your book');
    expect(container.textContent).not.toContain(` · ${COPY.cockpit2bWordExit}`);
    await click(q('[data-cockpit-chip-toggle]'));
    expect(q('[data-cockpit-tag="call:not_held"]').textContent).toBe(NOT_IN_BOOK);
    expect(qa('[data-cockpit-answer]')).toHaveLength(0);
    expect(qa('[data-cockpit-step]')).toHaveLength(0);
    expect(container.textContent).not.toContain('Who comes in');
    expect(container.textContent).not.toContain(COPY.cockpit2bConfirmExit);
  });

  it('the control: with VLO held the Now card has its buttons ("Confirm exit") and its step; held in ANOTHER tier it still does', () => {
    for (const battle of [HELD, ELSEWHERE]) {
      render({ calls: [call()], battle });
      expect(qa('[data-cockpit-now] [data-cockpit-answer]').length).toBeGreaterThanOrEqual(2);
      expect(container.textContent).toContain(COPY.cockpit2bConfirmExit);
      expect(q('[data-cockpit-step="on_card"]')).not.toBeNull();
      expect(container.textContent).not.toContain(NOT_IN_BOOK);
      expect(container.textContent).not.toContain('not in your book');
    }
  });
});

describe('the screen hands the tiles the battle document it already reads', () => {
  const screen = readFileSync(resolve(HERE, '..', 'AgentBattleScreen.jsx'), 'utf8');

  it("buildCockpitFeed is given the battle document's portfolio as `book` (the screen's own — never a second source), and the memo watches it", () => {
    const start = screen.indexOf('useMemo(() => (cockpitOn ? buildCockpitFeed({');
    expect(start).toBeGreaterThan(-1);
    const call = screen.slice(start, screen.indexOf('}) : null), [', start) + 400);
    expect(call).toMatch(/\bbook:\s*\{\s*portfolio:\s*agentBattle\?\.portfolio\b/);
    expect(call).toContain('[agentBattle?.gameMode, agentBattle?.portfolio,');
  });

  it('the model asks answers.js\'s one test — it holds no held-test of its own', () => {
    const model = readFileSync(resolve(HERE, 'cockpitModel.js'), 'utf8');
    expect(model).toMatch(/import \{[^}]*\bisExitNotHeld\b[^}]*\} from '\.\.\/\.\.\/\.\.\/api\/_utils\/callRecords\/answers\.js'/);
    expect(model).not.toMatch(/function isExitNotHeld|function heldInAnyTier/);
  });
});
