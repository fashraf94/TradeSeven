// @vitest-environment jsdom
//
// src/screens/battleView/entryAlreadyHeld.display.jsdom.test.jsx
//
// Cockpit entry-already-held — contract Amendment F, F-2 on the DISPLAYS
// (docs/CALL_RECORD_FIELD_CONTRACT_V1_4_AMENDMENT_F.md), the entry-side mirror of exitNotHeld.display.jsdom.test.jsx.
// While an ENTRY call's stock is in ANY tier of the battle document the screen already reads, no answer is legal on
// it (the endpoint refuses them all, acknowledgments included), so:
//   the 2a tile         no button, a line that reads "Already in your book"
//   the details sheet   the same buttons as the tile — none — and the same tag
//   the 2b card         no button, no silence line ("If you say nothing, it …"), the same tag
//   the strip chip      "… · already in your book"
//   the Now card        the entry never leads it
// The test is answers.js isEntryAlreadyHeld — ANY tier, never the call's own `slot` — fed from the battle document
// (`book`), and every row drives the REAL model (buildCockpitFeed / sheetOf / cardViewOf through the mounted
// components) over record fixtures (BUILD_RULES §9: no hand-made tiles). An upside call keeps its own treatment.
// The two refusal lines (§7.3) and the screen's own wiring are the last rows.

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
import { buildCockpitFeed, sheetOf, eventsByCall, refusalLineOf } from './cockpitModel';
import { liveCommandOf, chipWordOf } from './cockpit2bModel';
import { useCockpit2bAnswer } from './useCockpit2bAnswer';
import { BATTLE_VIEW_COPY as COPY, COCKPIT_FACT_TAGS, cockpitRefusalLine } from './battleViewCopy';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const HERE = dirname(fileURLToPath(import.meta.url));
const T = (iso) => Date.parse(iso);
/** Wed Oct 21 2026, 1:20 PM ET. */
const NOW = T('2026-10-21T17:20:00.000Z');
const CLOSE = T('2026-10-21T20:00:00.000Z');
const at = (hhmmEt) => { const [h, m] = hhmmEt.split(':').map(Number); return T(`2026-10-21T${String(h + 4).padStart(2, '0')}:${String(m).padStart(2, '0')}:20.000Z`); };
const iso = (ms) => new Date(ms).toISOString();
const EVALS = [{ evalId: 'eval_020', promptBuiltAt: iso(at('12:00')), evidence: { AMD: { px: 161.22 }, ZS: { px: 301.5 } } }];
const ALREADY_HELD = 'Already in your book';
const GENERIC = 'That answer isn\'t available for this call — nothing was filed.';

let seq = 0;
/** An ENTRY called shot on AMD (act-default: "Go if it triggers" / "Hold off"), counterpart KO (held in support). */
const entry = (over = {}) => {
  seq += 1;
  const minted = at('12:00') + 40_000;
  return {
    callId: `b:eval_020:call:${String(seq).padStart(3, '0')}`, kind: 'called_shot', battleId: 'b', evalId: 'eval_020', evalSeq: 20, mintedAt: minted, mintedMode: 'on',
    symbol: 'AMD', direction: 'entry', heldAtMint: false, slot: 'support', counterpart: 'KO', counterpartRaw: null,
    condition: { side: 'above', level: 163.5 }, horizon: { phrase: 'this_session', expiresAt: CLOSE, basis: 'this_session' },
    defaultAction: 'act', said: 'x', saidOk: true, evidence: { tickId: null, availability: 'off', priceAsOf: iso(minted - 40_000) },
    state: 'open', stateChangedAt: minted, stateSource: 'mint', playerResponse: null, directiveThreadId: null, outcome: null, refused: null,
    replacementOptions: null, invalidatedReason: null,
    ...over,
  };
};
const waitEntry = (over = {}) => entry({ defaultAction: 'hold', ...over });
/** An exit on VLO (held in core): the control that Amendment E's treatment and the buttons are untouched. */
const exitCall = (over = {}) => entry({ kind: 'confirmation', symbol: 'VLO', direction: 'exit', slot: 'core', counterpart: null, condition: { side: 'below', level: 158.4 }, replacementOptions: [{ symbol: 'MPC', source: 'agent' }], ...over });
/** The battle document the screen reads. AMD sits on the BENCH here: the ordinary entry. */
const bookWith = (over = {}) => ({
  directive: null,
  portfolio: { star: [{ symbol: 'ZS' }], core: [{ symbol: 'VLO' }], support: [{ symbol: 'KO' }], bench: { stocks: [{ symbol: 'AMD' }, { symbol: 'XOM' }] }, ...over },
  watchlist: { hotBench: ['MPC'] },
});
const NOT_HELD = bookWith();
/** AMD came into the book — the check's own trade bought it (the R2-01 shape), in the tier the call names. */
const HELD_SUPPORT = bookWith({ support: [{ symbol: 'KO' }, { symbol: 'AMD' }] });
/** AMD is held — in `core`, while the call names `support` (the League slot-label guess): ANY tier counts. */
const HELD_ELSEWHERE = bookWith({ core: [{ symbol: 'VLO' }, { symbol: 'AMD' }] });
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

describe('the tile model — no button, the line "Already in your book"', () => {
  it('an act-default entry whose stock is in the book: no buttons, the tag reads Already in your book, the card waits', () => {
    for (const book of [HELD_SUPPORT, HELD_ELSEWHERE]) {
      const t = tileOf([entry()], { book });
      expect(t.buttons).toEqual([]);
      expect(t.tag).toEqual({ fact: 'call:already_held', tone: 'muted', text: ALREADY_HELD });
      expect(t.group).toBe('waiting');
    }
  });

  it('a hold-default entry the same; the same without the 2b flag; a Confirmation the same', () => {
    for (const v2 of [true, false]) {
      const t = tileOf([waitEntry()], { book: HELD_SUPPORT, v2 });
      expect([t.buttons, t.tag.text], `v2 ${v2}`).toEqual([[], ALREADY_HELD]);
    }
    const confirmation = tileOf([entry({ kind: 'confirmation' })], { book: HELD_SUPPORT });
    expect([confirmation.buttons, confirmation.tag.fact]).toEqual([[], 'call:already_held']);
  });

  it('the control: AMD on the bench (held in no tier) → the buttons stand and the tag is the bare Live', () => {
    const t = tileOf([entry()], { book: NOT_HELD });
    expect(answers(t)).toEqual(['go', 'hold']);
    expect(t.tag.fact).toBe('state:open');
    expect(t.group).toBe('needsYou');
    expect(answers(tileOf([waitEntry()], { book: NOT_HELD }))).toEqual(['hold', 'go_now']);
  });

  it('ANY tier: held in a DIFFERENT tier than the call names is still held — withdrawn all the same', () => {
    expect(answers(tileOf([entry({ slot: 'star' })], { book: HELD_SUPPORT }))).toEqual([]);
    expect(answers(tileOf([entry({ slot: 'core' })], { book: HELD_ELSEWHERE }))).toEqual([]);
    expect(answers(tileOf([entry({ slot: 'support' })], { book: HELD_ELSEWHERE }))).toEqual([]);
  });

  it('nothing is claimed that is not seen: no book, a book without a portfolio, or one with no tier arrays → the tile is exactly as before', () => {
    for (const book of [undefined, null, {}, { portfolio: null }, { portfolio: { bench: { stocks: [] } } }]) {
      const t = tileOf([entry()], { book });
      expect(answers(t), JSON.stringify(book)).toEqual(['go', 'hold']);
      expect(t.tag.fact, JSON.stringify(book)).toBe('state:open');
    }
  });

  it('exits are untouched: an exit on a held stock keeps its buttons, and Amendment E\'s "Not in your book" still reads for an exit on a stock that left', () => {
    const held = tileOf([exitCall()], { book: HELD_SUPPORT });
    expect(answers(held)).toEqual(['go', 'hold']);
    expect(held.tag.fact).toBe('state:open');
    const left = tileOf([exitCall()], { book: bookWith({ core: [] }) });
    expect(left.buttons).toEqual([]);
    expect(left.tag.fact).toBe('call:not_held');
  });

  it('an UPSIDE call keeps its own treatment: no button, the bare Live tag — never "Already in your book" — on a held stock', () => {
    const upside = tileOf([entry({ heldAtMint: true })], { book: HELD_SUPPORT });
    expect(upside.buttons).toEqual([]);
    expect(upside.tag.fact).toBe('state:open');
    expect(upside.upside).toBe(true);
    // and with the stock NOT in the book (it left again) the upside call still reads upside, not an ordinary entry
    const left = tileOf([entry({ heldAtMint: true })], { book: NOT_HELD });
    expect([left.buttons, left.tag.fact, left.upside]).toEqual([[], 'state:open', true]);
  });

  it('what is recorded stays as recorded: an acknowledgment, a filed directive, an act, a hit — each keeps its own tag', () => {
    const ack = tileOf([entry({ playerResponse: { answer: 'go', kind: 'ack', callId: 'x', filedAt: iso(at('13:05')) } })], { book: HELD_SUPPORT });
    expect(ack.tag.fact).toBe('answer:ack');
    const filed = entry({ playerResponse: { answer: 'hold', kind: 'directive', directiveThreadId: 'th-1', callId: 'x', filedAt: iso(at('13:05')), heardEvalId: null } });
    expect(tileOf([filed], { book: HELD_SUPPORT }).tag.fact).toBe('answer:directive_left_slot');
    const acted = tileOf([entry({ outcome: { actedEvalId: 'eval_021' } })], { book: HELD_SUPPORT });
    expect(acted.tag.fact).toBe('event:acted');
    expect(acted.buttons).toEqual([]);
    const hit = tileOf([entry({ state: 'hit', stateChangedAt: at('13:10') })], { book: HELD_SUPPORT });
    expect(hit.tag.fact).toBe('state:hit');
    // A recorded event on a still-unanswered open call is a fact too: only the bare "Live" gives way.
    const c = entry();
    const noMatch = { kind: 'no_matching_trade', at: at('13:05'), callIds: [c.callId], evidence: { promptBuiltAt: iso(at('13:00')) } };
    const withEvent = tileOf([c], { book: HELD_SUPPORT, events: [noMatch] });
    expect(withEvent.tag.fact).toBe('event:no_matching_trade');
    expect(withEvent.buttons).toEqual([]);
  });

  it('the 2b strip chip says "already in your book" only for such a tile: a NOT-held entry that offers no button (past its deadline, or acted on) keeps the agent\'s word', () => {
    const pastDeadline = entry({ horizon: { phrase: 'this_session', expiresAt: NOW - 1_000, basis: 'this_session' } });
    const acted = entry({ outcome: { actedEvalId: 'eval_021' } });
    for (const c of [pastDeadline, acted]) {
      const t = tileOf([c], { book: NOT_HELD });
      expect(t.buttons).toEqual([]);
      expect(chipWordOf(t).word).toBe(COPY.cockpit2bWordEnter);
    }
    expect(chipWordOf(tileOf([entry()], { book: HELD_SUPPORT })).word).toBe(COPY.cockpit2bWordAlreadyHeld);
    expect(chipWordOf(tileOf([waitEntry()], { book: HELD_SUPPORT })).word).toBe('already in your book');
    expect(chipWordOf(tileOf([waitEntry()], { book: NOT_HELD })).word).toBe(COPY.cockpit2bWordWait);
    expect(chipWordOf(tileOf([entry({ heldAtMint: true })], { book: HELD_SUPPORT })).word).toBe(COPY.cockpit2bWordUpside);
  });

  it('the details sheet is the tile\'s: sheetOf carries the same (empty) buttons and the same tag', () => {
    const tile = tileOf([entry()], { book: HELD_SUPPORT });
    const sheet = sheetOf(tile, { eventsMap: eventsByCall([]), evaluations: EVALS, nowMs: NOW });
    expect(sheet.buttons).toEqual([]);
    expect(sheet.tag).toEqual({ fact: 'call:already_held', tone: 'muted', text: ALREADY_HELD });
    const control = sheetOf(tileOf([entry()], { book: NOT_HELD }), { eventsMap: eventsByCall([]), evaluations: EVALS, nowMs: NOW });
    expect(control.buttons.map((b) => b.answer)).toEqual(['go', 'hold']);
  });

  it('the copy table: the new tag is muted, says the words, and obeys the never-appear list', () => {
    expect(COCKPIT_FACT_TAGS['call:already_held'].tone).toBe('muted');
    expect(COCKPIT_FACT_TAGS['call:already_held'].text()).toBe(ALREADY_HELD);
    expect(COPY.cockpit2bWordAlreadyHeld).toBe('already in your book');
  });
});

describe('the 2a tile, mounted', () => {
  const render = (props) => act(() => { root.render(<CockpitFeed emptyLine={COPY.cockpitEmpty(null)} {...props} />); });

  it('reads "Already in your book" and offers no answer; with the stock off the book the same tile offers its two buttons', () => {
    render({ feed: feedOf([entry()], { book: HELD_SUPPORT, v2: false }) });
    expect(qa('[data-cockpit-answer]')).toHaveLength(0);
    expect(q('[data-cockpit-tag="call:already_held"]').textContent).toBe(ALREADY_HELD);
    expect(container.textContent).toContain(ALREADY_HELD);
    render({ feed: feedOf([entry()], { book: NOT_HELD, v2: false }) });
    expect(qa('[data-cockpit-answer]').map((b) => b.getAttribute('data-cockpit-answer'))).toEqual(['go', 'hold']);
    expect(container.textContent).not.toContain(ALREADY_HELD);
  });
});

describe('the details sheet, mounted', () => {
  const sheetFor = (calls, book) => sheetOf(tileOf(calls, { book, v2: false }), { eventsMap: eventsByCall([]), evaluations: EVALS, nowMs: NOW });
  const render = (props) => act(() => { root.render(<CockpitSheet onClose={() => {}} onAnswer={() => {}} onOpenCheck={() => {}} {...props} />); });

  it('reads "Already in your book" and offers no answer; with the stock off the book it offers the tile\'s buttons', () => {
    render({ sheet: sheetFor([entry()], HELD_SUPPORT) });
    expect(qa('[data-cockpit-answer]')).toHaveLength(0);
    expect(container.textContent).toContain(ALREADY_HELD);
    render({ sheet: sheetFor([entry()], NOT_HELD) });
    expect(qa('[data-cockpit-answer]').map((b) => b.getAttribute('data-cockpit-answer'))).toEqual(['go', 'hold']);
    expect(container.textContent).not.toContain(ALREADY_HELD);
  });
});

describe('the 2b card, the strip chip and the Now card, mounted', () => {
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

  it('no button and no silence line; the chip says "already in your book" and the opened card reads "Already in your book"', async () => {
    render({ calls: [entry()], battle: HELD_SUPPORT });
    // Nothing needs you: the call waits in the strip, whose chip names the fact in place of the agent's default word.
    expect(q('[data-cockpit-now]')).toBeNull();
    expect(q('[data-cockpit-chip]').textContent).toBe('AMD↑163.50 · already in your book');
    expect(container.textContent).not.toContain(` · ${COPY.cockpit2bWordEnter}`);
    await click(q('[data-cockpit-chip-toggle]'));
    expect(q('[data-cockpit-tag="call:already_held"]').textContent).toBe(ALREADY_HELD);
    expect(qa('[data-cockpit-answer]')).toHaveLength(0);
    // The card no longer promises it brings in a stock the book already holds (the chip stopped saying "enter" for the same reason).
    expect(container.textContent).not.toContain('If you say nothing');
    expect(container.textContent).toContain('plans to bring in AMD for KO');
  });

  it('the wait variant drops its silence line too ("it waits")', async () => {
    render({ calls: [waitEntry()], battle: HELD_ELSEWHERE });
    expect(q('[data-cockpit-chip]').textContent).toBe('AMD↑163.50 · already in your book');
    await click(q('[data-cockpit-chip-toggle]'));
    expect(container.textContent).not.toContain('If you say nothing');
    expect(container.textContent).toContain('plans to wait');
  });

  it('the control: with AMD on the bench the Now card has its buttons ("Go if it triggers") and its silence line', () => {
    render({ calls: [entry()], battle: NOT_HELD });
    expect(qa('[data-cockpit-now] [data-cockpit-answer]').length).toBeGreaterThanOrEqual(2);
    expect(container.textContent).toContain(COPY.cockpit2bGoIfTriggers);
    expect(container.textContent).toContain('If you say nothing, it brings it in.');
    expect(container.textContent).not.toContain(ALREADY_HELD);
    expect(container.textContent).not.toContain('already in your book');
  });

  it('the Now card: the entry never leads it — the next call that can be answered does', () => {
    const held = entry();
    const exit = exitCall();
    render({ calls: [held, exit], battle: HELD_SUPPORT });
    expect(q('[data-cockpit-now]').getAttribute('data-cockpit-now')).toBe(exit.callId);
    expect(qa('[data-cockpit-chip]').map((c) => c.textContent)).toContain('AMD↑163.50 · already in your book');
  });

  it('an upside call keeps its own chip ("upside") and its upside line on a held stock', () => {
    render({ calls: [entry({ heldAtMint: true })], battle: HELD_SUPPORT });
    expect(q('[data-cockpit-chip]').textContent).toContain('· upside');
    expect(container.textContent).not.toContain('already in your book');
  });
});

describe('the refusal lines (spec §7.3, flag on)', () => {
  const body = (reason) => ({ error: 'ineligible_action', reason });

  it('symbol_already_held → "{SYM} is already in your book — nothing was filed."', () => {
    expect(cockpitRefusalLine(400, body('symbol_already_held'), { v2: true, names: { symbol: 'AMD' } })).toBe('AMD is already in your book — nothing was filed.');
  });

  it('counterpart_not_held → "{CP} has already left your book — nothing was filed."', () => {
    expect(cockpitRefusalLine(400, body('counterpart_not_held'), { v2: true, names: { counterpart: 'ZS' } })).toBe('ZS has already left your book — nothing was filed.');
  });

  it('flag off, or a name it does not have → the generic 400 line, never a guessed name', () => {
    expect(cockpitRefusalLine(400, body('symbol_already_held'), { v2: false, names: { symbol: 'AMD' } })).toBe(GENERIC);
    expect(cockpitRefusalLine(400, body('counterpart_not_held'), { v2: false, names: { counterpart: 'ZS' } })).toBe(GENERIC);
    expect(cockpitRefusalLine(400, body('symbol_already_held'), { v2: true, names: {} })).toBe(GENERIC);
    expect(cockpitRefusalLine(400, body('counterpart_not_held'), { v2: true, names: { symbol: 'AMD' } })).toBe(GENERIC);
  });

  it('the neighbouring rows are untouched: symbol_not_held and counterpart_unavailable keep their lines', () => {
    expect(cockpitRefusalLine(400, body('symbol_not_held'), { v2: true, names: { symbol: 'VLO' } })).toBe('VLO has already left your book — nothing was filed.');
    expect(cockpitRefusalLine(400, body('counterpart_unavailable'), { v2: true, names: { counterpart: 'KO' } })).toBe('KO can\'t come in right now — nothing was filed.');
  });

  it('through the real model: refusalLineOf names the call\'s own stock and counterpart from its record', () => {
    const c = entry({ counterpart: 'ZS' });
    const tile = tileOf([c], { book: NOT_HELD });
    const outcome = (reason) => ({ status: 400, body: body(reason), callId: c.callId });
    expect(refusalLineOf(tile, outcome('symbol_already_held'), { calls: [c], v2: true })).toBe('AMD is already in your book — nothing was filed.');
    expect(refusalLineOf(tile, outcome('counterpart_not_held'), { calls: [c], v2: true })).toBe('ZS has already left your book — nothing was filed.');
    expect(refusalLineOf(tile, outcome('symbol_already_held'), { calls: [c], v2: false })).toBe(GENERIC);
  });
});

describe('the screen hands the tiles the battle document it already reads', () => {
  it('the model asks answers.js\'s one test — it holds no held-test of its own — and the screen\'s `book` is the one E wired', () => {
    const model = readFileSync(resolve(HERE, 'cockpitModel.js'), 'utf8');
    expect(model).toMatch(/import \{[^}]*\bisEntryAlreadyHeld\b[^}]*\} from '\.\.\/\.\.\/\.\.\/api\/_utils\/callRecords\/answers\.js'/);
    expect(model).not.toMatch(/function isEntryAlreadyHeld|function heldInAnyTier/);
    const screen = readFileSync(resolve(HERE, '..', 'AgentBattleScreen.jsx'), 'utf8');
    const start = screen.indexOf('useMemo(() => (cockpitOn ? buildCockpitFeed({');
    expect(start).toBeGreaterThan(-1);
    expect(screen.slice(start, screen.indexOf('}) : null), [', start) + 400)).toMatch(/\bbook:\s*\{\s*portfolio:\s*agentBattle\?\.portfolio\b/);
  });
});
