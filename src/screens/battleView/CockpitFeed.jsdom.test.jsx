// @vitest-environment jsdom
//
// src/screens/battleView/CockpitFeed.jsdom.test.jsx
//
// Cockpit Build 2a — THE FEED, MOUNTED (spec docs/COCKPIT_BUILD2A_SPEC_V1_0.md
// §5 top row, §7.1 groups, §7.3 anatomy and taps, §8.3 the line under a tile,
// §9 tokens). The feed renders cockpitModel's output and nothing else, so the
// rows here drive it from the REAL model (buildCockpitFeed / monitoringRow)
// over record fixtures — a test feeding hand-made tiles would agree with
// itself while disagreeing with the product (BUILD_RULES §9).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import CockpitFeed, { toneColor } from './CockpitFeed';
import { buildCockpitFeed, monitoringRow } from './cockpitModel';
import { BATTLE_VIEW_COPY as COPY } from './battleViewCopy';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const T = (iso) => Date.parse(iso);
const NOW = T('2026-09-09T15:05:00.000Z');
const EVALS = [
  { evalId: 'eval_010', promptBuiltAt: '2026-09-09T14:30:20.000Z' },
  { evalId: 'eval_011', promptBuiltAt: '2026-09-09T14:45:20.000Z' },
];
let n = 0;
const call = (over = {}) => {
  n += 1;
  return {
    callId: `b:eval_010:call:${n}`, kind: 'called_shot', evalId: 'eval_010', mintedAt: T('2026-09-09T14:31:00.000Z'), mintedMode: 'on',
    symbol: 'AMD', direction: 'entry', heldAtMint: false, slot: 'support', counterpart: 'KO',
    condition: { side: 'above', level: 161 }, horizon: { phrase: 'this_session', expiresAt: T('2026-09-09T20:00:00.000Z'), basis: 'this_session' },
    defaultAction: 'act', said: 'x', saidOk: true, evidence: { priceAsOf: '2026-09-09T14:30:20.000Z' },
    state: 'open', stateChangedAt: T('2026-09-09T14:31:00.000Z'), playerResponse: null, ...over,
  };
};
const feedOf = (calls, over = {}) => buildCockpitFeed({ calls, events: [], evaluations: EVALS, directive: null, nowMs: NOW, ...over });

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

const render = (props) => act(() => { root.render(<CockpitFeed emptyLine={COPY.cockpitEmpty(null)} {...props} />); });
const click = (el) => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); });
const q = (sel) => container.querySelector(sel);
const qa = (sel) => [...container.querySelectorAll(sel)];

describe('§7.1 — the groups, in order, with the shipped headers', () => {
  it('⚡ Needs you · ⏱ Waiting on the check · 👁 Monitoring · Earlier — in that order, each only when it has content', () => {
    const open = call({ symbol: 'MU' });
    const answered = call({ symbol: 'NVDA', playerResponse: { kind: 'ack', answer: 'go', filedAt: '2026-09-09T14:32:00.000Z' } });
    const resolved = call({ symbol: 'AAPL', state: 'hit', stateChangedAt: T('2026-09-09T14:46:00.000Z') });
    render({ feed: feedOf([open, answered, resolved]), monitoring: monitoringRow({ symbols: ['JPM'], evalId: 'eval_011' }, EVALS) });
    expect(qa('[data-cockpit-group]').map((h) => h.getAttribute('data-cockpit-group'))).toEqual(['needsYou', 'waiting', 'monitoring', 'earlier']);
    expect(qa('[data-cockpit-group]').map((h) => h.textContent.replace(/\d+$/, ''))).toEqual(['⚡ Needs you', '⏱ Waiting on the check', '👁 Monitoring', 'Earlier']);
    expect(qa('[data-cockpit-group]').every((h) => h.getAttribute('role') === 'heading')).toBe(true);
  });

  it('a group with nothing in it is not shown (no empty header), and no Guarding group exists', () => {
    render({ feed: feedOf([call()]) });
    expect(qa('[data-cockpit-group]').map((h) => h.getAttribute('data-cockpit-group'))).toEqual(['needsYou']);
    expect(container.textContent).not.toMatch(/Guard/i);
  });

  it('the empty state: no calls and no Monitoring → the one line, and nothing else', () => {
    render({ feed: feedOf([]), emptyLine: COPY.cockpitEmpty('2026-09-09T15:15:00.000Z') });
    expect(q('[data-cockpit-empty]').textContent).toBe('No calls yet. Your agent declares calls at its checks — next one ~11:15 AM.');
    expect(qa('[data-cockpit-group]')).toHaveLength(0);
  });

  it('Monitoring alone is not "empty": the row shows, the empty line does not', () => {
    render({ feed: feedOf([]), monitoring: monitoringRow({ symbols: ['JPM'], evalId: 'eval_011' }, EVALS) });
    expect(q('[data-cockpit-empty]')).toBeNull();
    expect(q('[data-cockpit-monitoring]').textContent).toContain('From the 10:45 AM check');
  });

  it('Earlier shows ten and a "Show all · n" door that expands it', () => {
    const resolved = Array.from({ length: 12 }, (_, i) => call({ symbol: `S${i}`, state: 'hit', stateChangedAt: T('2026-09-09T14:40:00.000Z') + i }));
    const onShowAllEarlier = vi.fn();
    render({ feed: feedOf(resolved), onShowAllEarlier });
    expect(qa('[data-cockpit-tile-group="earlier"]')).toHaveLength(10);
    const door = q('[data-cockpit-show-all]');
    expect(door.textContent).toBe('Show all · 12');
    click(door);
    expect(onShowAllEarlier).toHaveBeenCalledTimes(1);
    render({ feed: feedOf(resolved, { showAllEarlier: true }), showAllEarlier: true, onShowAllEarlier });
    expect(qa('[data-cockpit-tile-group="earlier"]')).toHaveLength(12);
    expect(q('[data-cockpit-show-all]')).toBeNull();
  });
});

describe('§7.3 — a tile: dot · eyebrow · tag · line · at most two buttons; taps', () => {
  it('renders the anatomy from the model', () => {
    const c = call();
    render({ feed: feedOf([c]) });
    const tile = q(`[data-cockpit-tile="${c.callId}"]`);
    expect(tile.textContent).toContain('Called shot · from the 10:30 AM check');
    expect(tile.querySelector('[data-cockpit-tag]').textContent).toBe('Live');
    expect(tile.querySelector('[data-cockpit-line]').textContent).toBe("AMD above $161.00 by today's close");
    expect([...tile.querySelectorAll('[data-cockpit-answer]')].map((b) => b.textContent)).toEqual(['Go if it triggers', 'Hold off · 1 message']);
  });

  it('a button answers through the screen with (callId, answer) and does NOT open the sheet', () => {
    const c = call();
    const onAnswer = vi.fn();
    const onOpenSheet = vi.fn();
    render({ feed: feedOf([c]), onAnswer, onOpenSheet });
    click(q('[data-cockpit-answer="hold"]'));
    expect(onAnswer).toHaveBeenCalledWith(c.callId, 'hold');
    expect(onOpenSheet).not.toHaveBeenCalled();
  });

  it('tapping the tile body opens its sheet', () => {
    const c = call();
    const onOpenSheet = vi.fn();
    render({ feed: feedOf([c]), onOpenSheet });
    click(q('[data-cockpit-tile-open]'));
    expect(onOpenSheet).toHaveBeenCalledWith(c.callId);
  });

  it('while sending: both buttons wait (aria-disabled — the pressed one KEEPS focus, review L5-5), the pressed one reads "Sending…", a tap does nothing', () => {
    const c = call();
    const onAnswer = vi.fn();
    render({ feed: feedOf([c], { pending: { callId: c.callId, answer: 'go' } }), onAnswer });
    const buttons = qa('[data-cockpit-answer]');
    expect(buttons.map((b) => [b.textContent, b.getAttribute('aria-disabled')])).toEqual([['Sending…', 'true'], ['Hold off · 1 message', 'true']]);
    expect(buttons.every((b) => b.disabled === false)).toBe(true); // never the real `disabled`, which drops focus to <body>
    buttons[0].focus();
    click(buttons[0]);
    expect(onAnswer).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(buttons[0]);
  });

  it('one call at a time: the override is disabled with its line; agreeing stays tappable', () => {
    const slotCall = call({ symbol: 'NVDA' });
    slotCall.playerResponse = { kind: 'directive', answer: 'hold', callId: slotCall.callId, directiveThreadId: 'th-1', filedAt: '2026-09-09T14:33:00.000Z', heardEvalId: null };
    const other = call({ symbol: 'MU' });
    const directive = { family: 'call', text: 'Hold off on NVDA', directiveThreadId: 'th-1', expiresAtMs: T('2026-09-09T20:00:00.000Z'), callId: slotCall.callId };
    const onAnswer = vi.fn();
    render({ feed: feedOf([slotCall, other], { directive }), onAnswer });
    const tile = q(`[data-cockpit-tile="${other.callId}"]`);
    const [agree, override] = tile.querySelectorAll('[data-cockpit-answer]');
    expect(override.getAttribute('aria-disabled')).toBe('true');
    expect(agree.hasAttribute('aria-disabled')).toBe(false);
    click(override);
    expect(onAnswer).not.toHaveBeenCalled();
    expect(tile.querySelector('[data-cockpit-blocked]').textContent).toBe("Waiting · your last answer hasn't been heard yet.");
    click(agree);
    expect(onAnswer).toHaveBeenCalledWith(other.callId, 'go');
  });

  it('an upside call shows its kind and no buttons', () => {
    const c = call({ heldAtMint: true });
    render({ feed: feedOf([c]) });
    const tile = q(`[data-cockpit-tile="${c.callId}"]`);
    expect(tile.textContent).toContain('Upside call');
    expect(tile.querySelectorAll('[data-cockpit-answer]')).toHaveLength(0);
  });
});

describe('§8.3 — the line under a tile: one plain line from the BODY, in a polite live region', () => {
  it('a refusal renders under its own tile only, role="status" aria-live="polite" — the line the model chose', () => {
    const c = call();
    const d = call({ symbol: 'MU' });
    render({ feed: feedOf([c, d], { outcomes: { [c.callId]: { status: 409, body: { error: 'refused', reason: 'budget' }, at: NOW, callId: c.callId } } }) });
    const region = q(`[data-cockpit-tile="${c.callId}"] [role="status"]`);
    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(region.textContent).toBe('No messages left — nothing was filed.');
    expect(q(`[data-cockpit-tile="${d.callId}"] [role="status"]`).textContent).toBe('');
  });

  it('no response at all → the line that never says nothing was filed', () => {
    const c = call();
    render({ feed: feedOf([c], { outcomes: { [c.callId]: { status: null, body: null, at: NOW, callId: c.callId } } }) });
    expect(q('[role="status"]').textContent).toBe("Couldn't confirm your answer. Check the tile before trying again.");
  });
});

describe('Monitoring — chips open the research modal through the screen', () => {
  it('each chip is named for its research door and hands its symbol to onSymbolClick', () => {
    const onSymbolClick = vi.fn();
    render({ feed: feedOf([]), monitoring: monitoringRow({ symbols: ['JPM', 'AMD'], evalId: 'eval_011' }, EVALS), onSymbolClick });
    const chips = qa('[data-cockpit-monitoring-symbol]');
    expect(chips.map((c) => c.textContent)).toEqual(['JPM', 'AMD']);
    expect(chips[1].getAttribute('aria-label')).toBe('Research AMD');
    click(chips[1]);
    expect(onSymbolClick).toHaveBeenCalledWith('AMD');
  });
});

describe('§5 — the desktop top row: the prices\' vintage and the messages left (no pills)', () => {
  it('renders both lines when given', () => {
    render({ feed: feedOf([call()]), topRow: { vintage: 'Prices as of the 11:00 AM check · next ~11:15 AM', messagesLeft: '7 messages left' } });
    expect(q('[data-cockpit-vintage]').textContent).toBe('Prices as of the 11:00 AM check · next ~11:15 AM');
    expect(q('[data-cockpit-messages-left]').textContent).toBe('7 messages left');
  });
  it('no budget number when the screen has none to show (a league battle) — never a placeholder', () => {
    render({ feed: feedOf([call()]), topRow: { vintage: 'Prices as of the 11:00 AM check', messagesLeft: null } });
    expect(q('[data-cockpit-messages-left]')).toBeNull();
  });
  it('the phone passes no top row', () => {
    render({ feed: feedOf([call()]), topRow: null });
    expect(q('[data-cockpit-top-row]')).toBeNull();
  });
});

describe('§9 — tokens only: the four state aliases carry the tones', () => {
  it('every tone resolves to an --ft-* token, the player\'s answer to --ft-call-yours', () => {
    expect(toneColor('yours')).toContain('--ft-call-yours');
    expect(toneColor('yoursOutline')).toContain('--ft-call-yours');
    expect(toneColor('acted')).toContain('--ft-call-acted');
    expect(toneColor('dropped')).toContain('--ft-call-dropped');
    expect(toneColor('muted')).toContain('--ft-call-muted');
    expect(toneColor('neutral')).toContain('--ft-');
  });
  it('an agreement\'s tag is outlined; a fact with no row renders no tag element at all', () => {
    const c = call({ playerResponse: { kind: 'ack', answer: 'go', filedAt: '2026-09-09T14:32:00.000Z' } });
    const d = call({ symbol: 'MU', state: 'hit', stateChangedAt: T('2026-09-09T14:50:00.000Z') });
    render({ feed: feedOf([c, d]) });
    const tag = q(`[data-cockpit-tile="${c.callId}"] [data-cockpit-tag]`);
    expect(tag.getAttribute('data-cockpit-tone')).toBe('yoursOutline');
    expect(tag.style.border).toContain('1px solid');
    const unknown = { ...feedOf([d]) };
    unknown.earlier = unknown.earlier.map((t) => ({ ...t, tag: null }));
    render({ feed: unknown });
    expect(q(`[data-cockpit-tile="${d.callId}"] [data-cockpit-tag]`)).toBeNull();
  });
});

describe('nothing is claimed before the records arrive (review L3-2)', () => {
  it('LOADING: no empty line, no tile — the top row and Monitoring may show', () => {
    render({ feed: feedOf([call()]), status: 'loading', topRow: { vintage: 'Prices as of the 11:00 AM check', messagesLeft: '7 messages left' } });
    expect(q('[data-cockpit-empty]')).toBeNull();
    expect(qa('[data-cockpit-tile]')).toHaveLength(0);
    expect(q('[data-cockpit-top-row]')).toBeTruthy();
    expect(q('[data-cockpit-feed]').getAttribute('data-cockpit-status')).toBe('loading');
  });
  it('ERROR: one neutral line — never "No calls yet" for records the reader could not see', () => {
    render({ feed: feedOf([]), status: 'error' });
    expect(q('[data-cockpit-read-error]').textContent).toBe(COPY.cockpitReadError);
    expect(q('[data-cockpit-empty]')).toBeNull();
  });
  it('READY with nothing: the empty line', () => {
    render({ feed: feedOf([]), status: 'ready' });
    expect(q('[data-cockpit-empty]')).toBeTruthy();
    expect(q('[data-cockpit-read-error]')).toBeNull();
  });
});

describe('keyboard and pointer: the focus ring, the dialog door, Show all, target sizes (review L5-3, L5-5, L5-10, L5-11d)', () => {
  it('the tile body is a plain button reset by hand — never `all: unset`, which takes the focus ring — and announces its dialog', () => {
    const c = call();
    render({ feed: feedOf([c]) });
    const open = q('[data-cockpit-tile-open]');
    expect(open.getAttribute('style')).not.toMatch(/(^|;)\s*all\s*:/);
    expect(open.style.outline).toBe('');
    expect(open.getAttribute('aria-haspopup')).toBe('dialog');
  });
  it('"Show all" moves focus to the first tile it revealed (it removes itself when pressed)', () => {
    const resolved = Array.from({ length: 12 }, (_, i) => call({ symbol: `S${i}`, state: 'hit', stateChangedAt: T('2026-09-09T14:40:00.000Z') + i }));
    let expanded = false;
    const props = () => ({ feed: feedOf(resolved, { showAllEarlier: expanded }), showAllEarlier: expanded, onShowAllEarlier: () => { expanded = true; } });
    render(props());
    click(q('[data-cockpit-show-all]'));
    render(props());
    const tiles = qa('[data-cockpit-tile-group="earlier"] [data-cockpit-tile-open]');
    expect(tiles).toHaveLength(12);
    expect(document.activeElement).toBe(tiles[10]);
  });
  it('chips and buttons are at least 36 px tall; Earlier tiles are not dimmed by opacity (the muted text stays legible)', () => {
    const c = call();
    const d = call({ symbol: 'MU', state: 'hit', stateChangedAt: T('2026-09-09T14:50:00.000Z') });
    render({ feed: feedOf([c, d]), monitoring: monitoringRow({ symbols: ['JPM'], evalId: 'eval_011' }, EVALS) });
    expect(parseInt(q('[data-cockpit-monitoring-symbol]').style.minHeight, 10)).toBeGreaterThanOrEqual(36);
    expect(qa('[data-cockpit-answer]').every((b) => parseInt(b.style.minHeight, 10) >= 36)).toBe(true);
    expect(q(`[data-cockpit-tile="${d.callId}"]`).style.opacity).toBe('');
  });
  it('the sections are plain groupings: no duplicate landmark names beside their headings', () => {
    render({ feed: feedOf([call()]) });
    expect(qa('section').every((sec) => !sec.hasAttribute('aria-label'))).toBe(true);
  });
});
