// @vitest-environment jsdom
//
// src/screens/AgentBattleScreen.layout.jsdom.test.jsx
//
// Phase A (A4) — the layout under the controller flag, mounted:
//
//   DESKTOP (≥ the screen's 768 px breakpoint): no tab bar, no
//   LiveActivityPanel, the board left and ONE AgentChat right in a column;
//   the Why? door focuses the composer with no tab change; the unread dot
//   has nowhere to show.
//
//   MOBILE: header, This turn, the board as the page; the same ONE AgentChat
//   as a non-modal sheet — three detents cycling peek → half → full → peek,
//   a named region, keyboard-reachable controls, focus moved into the sheet
//   on expand and back to the invoking control on collapse; the door opens
//   the sheet to at least half before the chat's prefill effect focuses the
//   textarea; a typed draft survives (F13); the unread dot lives on the
//   sheet's handle and clears from the EFFECT when the sheet opens.
//
//   GAME TAPE: one header link renders the shipped view full-screen with a
//   way back; the chat stays mounted beneath it.
//
// Harness precedent: AgentBattleScreen.controller.jsdom.test.jsx.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

vi.mock('../firebase/config', () => ({ db: {}, auth: {}, default: {} }));
vi.mock('firebase/auth', () => ({ getAuth: vi.fn(() => ({ currentUser: null })) }));
vi.mock('../services/agentService', () => ({ submitDailyGrades: vi.fn(), addFeedBookmark: vi.fn(), removeFeedBookmark: vi.fn() }));
vi.mock('../contexts/ThemeContext', () => {
  const tokens = new Proxy({}, { get: () => '#000000' });
  return { useTheme: () => ({ tokens }), ThemeProvider: ({ children }) => children };
});
vi.mock('../hooks/useAgentBattleId', () => ({ default: () => ({ agentBattleId: null, loading: false }) }));
vi.mock('../hooks/useWebSocketPrices', () => ({ useWebSocketPrices: () => ({ prices: {}, status: 'disconnected' }) }));
vi.mock('../config/featureFlags', async (importOriginal) => ({
  ...(await importOriginal()),
  isAgentPresenceOn: () => false,
  isMatchupsBackdropOn: () => false,
  isBattleViewControllerOn: () => true,
}));
vi.mock('../services/eodhdAPI', () => ({
  stockAPI: {
    getMultipleStockPrices: vi.fn(async () => ({})),
    getMultipleCryptoPrices: vi.fn(async () => ({})),
  },
  POPULAR_CRYPTO: [],
}));
// A SENTINEL, not a null stub: the assertion is that the panel is absent
// from the tree under the flag, and a null stub could not fail.
vi.mock('../components/Agent/LiveActivityPanel', () => ({
  default: () => <div data-live-activity="1" />,
  BreakthroughAlerts: () => null,
}));

// The feed the hook hands back is mutable so a test can grow it between
// renders (the unread dot).
const store = vi.hoisted(() => ({ statusFeed: [], lastScoredAt: '2026-09-01T16:47:00.000Z', pendingProposal: null, feedBookmarks: [], evaluations: null }));

const LIVE_DOC = {
  id: 'ab-1',
  status: 'active',
  activatedAt: '2026-09-01T13:30:00.000Z',
  agentContext: { agentName: 'Aurora' },
  scoreState: { currentScore: 12, opponentScore: 3, tradeCount: 1, evaluationCount: 5, lastScoredAt: '2026-09-01T16:47:00.000Z' },
  portfolio: {
    star: [{ symbol: 'AAPL' }, { symbol: 'SLB', swapPrice: 34.1, swappedInAt: '2026-09-01T15:02:00.000Z' }],
    core: [{ symbol: 'NVDA' }],
    support: [],
    startingPrices: { AAPL: 150, NVDA: 900, MU: 90 },
  },
  opponent: { portfolio: { star: [{ symbol: 'AMD' }], core: [], support: [] } },
  evaluations: [
    { evalId: 'eval_005', timestamp: '2026-09-01T16:47:02.000Z', decision: 'HOLD', downgraded: false, rationale: 'Held SLB.', haikuError: null },
  ],
  trades: [],
  chatExchanges: [
    {
      userMessage: 'protect the lead', agentResponse: 'Got it.', hasDirective: true,
      directive: { text: 'Protect the lead into the close', expiry: 'end_of_battle', directiveThreadId: 't-1' },
      directiveThreadId: 't-1', timestamp: '2026-09-01T15:31:00.000Z',
    },
  ],
  directive: { text: 'Protect the lead into the close', expiry: 'end_of_battle', directiveThreadId: 't-1', createdAt: '2026-09-01T15:33:00.000Z' },
};
vi.mock('../hooks/useAgentBattle', () => ({
  default: () => ({
    battle: { ...LIVE_DOC, statusFeed: store.statusFeed, evaluations: store.evaluations || LIVE_DOC.evaluations, scoreState: { ...LIVE_DOC.scoreState, lastScoredAt: store.lastScoredAt } }, statusFeed: store.statusFeed,
    executionMode: 'copilot', pendingProposal: store.pendingProposal, strategyPreset: 'balanced', gameplanMeeting: null,
    chatExchanges: LIVE_DOC.chatExchanges, feedBookmarks: store.feedBookmarks, loading: false,
  }),
}));

import AgentBattleScreen from './AgentBattleScreen';
import { derivePeekLine } from './battleView/derivePeekLine';
import { mergeRecordedTape } from './battleView/scopeTape';
import { buildTape } from './battleView/buildTape';
import { deriveReceipts } from './battleView/deriveReceipts';
import { deriveChatMessages } from '../components/Agent/deriveChatMessages';

const BATTLE = {
  agentId: 'agent-1', agentBattleId: 'ab-1',
  creator: { portfolio: { star: [{ symbol: 'AAPL' }, { symbol: 'MU' }], core: [{ symbol: 'NVDA' }], support: [] } },
  opponent: { portfolio: { star: [{ symbol: 'MSFT' }], core: [], support: [] } },
  state: { startingPrices: { AAPL: 150, NVDA: 900, MU: 90 } },
};

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};

// The screen reads window.innerWidth for its breakpoint at mount and
// matchMedia `change` events for later crossings. The stub answers the
// breakpoint query from a mutable width and records its listeners so a test
// can cross 768 px after mount (`crossTo`); every other query (framer's
// `(prefers-reduced-motion)`, latched once per module) answers false, so the
// landing can play and the sheet can animate.
const mq = { width: 1280, listeners: new Set() };
window.matchMedia = (query) => {
  const isWidth = /min-width/.test(String(query));
  return {
    media: String(query),
    get matches() { return isWidth ? mq.width >= 768 : false; },
    addEventListener: (_type, handler) => { if (isWidth) mq.listeners.add(handler); },
    removeEventListener: (_type, handler) => { mq.listeners.delete(handler); },
    addListener() {},
    removeListener() {},
  };
};
const setViewport = (width, height = 800) => {
  mq.width = width;
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: height });
};
const crossTo = (width) => {
  mq.width = width;
  window.innerWidth = width;
  act(() => { [...mq.listeners].forEach((handler) => handler({ matches: width >= 768 })); });
};
const resizeTo = (height) => act(() => {
  window.innerHeight = height;
  window.dispatchEvent(new Event('resize'));
});
// A pull on the grabber: real PointerEvents, the way framer's drag listens.
const pev = (type, y) => new PointerEvent(type, {
  bubbles: true, cancelable: true, clientX: 100, clientY: y, pointerId: 1, pointerType: 'touch', isPrimary: true, button: 0,
});
const pull = async (dy) => {
  act(() => { q('[data-sheet-grabber]').dispatchEvent(pev('pointerdown', 500)); });
  await settle(40);
  act(() => { window.dispatchEvent(pev('pointermove', 500 + dy)); });
  await settle(40);
  act(() => { window.dispatchEvent(pev('pointerup', 500 + dy)); });
  await settle(80);
};

let container;
let root;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-01T17:00:00.000Z'));
  store.statusFeed = [];
  store.lastScoredAt = '2026-09-01T16:47:00.000Z';
  store.pendingProposal = null;
  store.feedBookmarks = [];
  store.evaluations = null;
  mq.listeners.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

const mount = () => act(() => {
  root.render(<AgentBattleScreen battle={BATTLE} user={{ uid: 'u1' }} onBack={() => {}} onOpenFilmRoom={null} />);
});
const rerender = mount; // a fresh element → the tree re-renders and re-reads the hook
const click = (el) => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); });
const settle = (ms = 400) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const q = (sel) => container.querySelector(sel);
const qa = (sel) => [...container.querySelectorAll(sel)];
const rowButtonFor = (symbol) => qa('[role="button"][aria-expanded]')
  .find((el) => el.querySelector('[data-why-label]') && el.textContent.includes(symbol));
const doorButton = () => qa('button').find((b) => b.textContent === 'Ask a follow-up · 1 message');
const tabButtons = () => qa('button').filter((b) => ['Matchups', 'Command Center', 'Huddle'].includes(b.textContent));
const typeDraft = (text) => act(() => {
  const ta = q('textarea');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
  setter.call(ta, text);
  ta.dispatchEvent(new Event('input', { bubbles: true }));
});

describe('desktop — board left, the chat right, no tab bar', () => {
  beforeEach(() => setViewport(1280));

  it('renders no tab bar and no LiveActivityPanel; exactly ONE AgentChat, in the chat column', () => {
    mount();
    expect(q('[data-layout="desktop"]')).toBeTruthy();
    expect(tabButtons()).toEqual([]);
    expect(q('[data-live-activity]')).toBeNull();
    expect(qa('textarea').length).toBe(1);
    expect(q('[data-chat-column] textarea')).toBeTruthy();
    expect(q('[data-chat-sheet]')).toBeNull();
    expect(q('[data-chat-layout="controller"]')).toBeTruthy();
    // The board keeps its order: This turn, then the tiers.
    const board = q('[data-board]');
    expect(board.querySelectorAll('[data-this-turn]').length).toBe(1);
    expect(board.textContent.indexOf('This turn')).toBeLessThan(board.textContent.indexOf('Star Picks'));
    // The Game Tape link is the one header control for the tape.
    expect(qa('[data-game-tape-link]').length).toBe(1);
    expect(q('[data-game-tape-link]').textContent).toContain('Game Tape');
  });

  it('the door focuses the composer with the prefill and changes no layout; a typed draft survives (F13)', () => {
    mount();
    click(rowButtonFor('SLB'));
    click(doorButton());
    const ta = q('textarea');
    expect(document.activeElement).toBe(ta);
    expect(ta.value).toBe('About SLB — ');
    expect(q('[data-layout="desktop"]')).toBeTruthy();
    expect(q('[data-game-tape="open"]')).toBeNull();
    // Now a draft: the door leaves it alone and still focuses.
    typeDraft('my own words');
    ta.blur();
    click(rowButtonFor('AAPL'));
    click(doorButton());
    expect(q('textarea').value).toBe('my own words');
    expect(document.activeElement).toBe(q('textarea'));
  });

  it('the landing still plays across the SEVEN tier slots in render order when a check lands (rowCount unchanged by the layout)', () => {
    mount();
    expect(qa('[data-wash]').length).toBe(0); // never on open
    store.lastScoredAt = '2026-09-01T17:02:00.000Z';
    rerender();
    const washes = qa('[data-wash]');
    expect(washes.length).toBe(7);
    // Every wash sits inside the board column, in document order with the rows,
    // and its landing index runs across the seven slots (never restarting per tier).
    expect(washes.every((w) => q('[data-board]').contains(w))).toBe(true);
    expect(washes.map((w) => w.getAttribute('data-wash-index'))).toEqual(['0', '1', '2', '3', '4', '5', '6']);
  });

  it('an OPEN desktop column has nowhere to show the dot and MARKS the feed seen — the entries stay seen across a crossing', () => {
    mount();
    store.statusFeed = [{ action: 'hold', message: 'Held.', timestamp: '2026-09-01T16:47:00.000Z' }, { action: 'hold', message: 'Held again.', timestamp: '2026-09-01T17:02:00.000Z' }];
    rerender();
    expect(q('[data-sheet-dot]')).toBeNull();
    expect(q('[data-peek-dot]')).toBeNull();
    expect(q('[data-unread]')).toBeNull();
    // Seen on the desktop (the effect ran with the column visible). A2.4: the
    // detent SURVIVES the crossing, so the phone arrives at half — still
    // visible, still no dot — and only a collapse can show one again.
    crossTo(390);
    expect(q('[data-layout="mobile"]')).toBeTruthy();
    expect(q('[data-chat-sheet]').getAttribute('data-chat-sheet')).toBe('half');
    expect(q('[data-sheet-cycle]').getAttribute('data-unread')).toBe('false');
    click(q('[data-sheet-collapse]'));
    expect(q('[data-chat-sheet]').getAttribute('data-chat-sheet')).toBe('peek');
    // …and a NEW entry at peek does show.
    store.statusFeed = [...store.statusFeed, { action: 'hold', message: 'Held once more.', timestamp: '2026-09-01T17:17:00.000Z' }];
    rerender();
    expect(q('[data-sheet-cycle]').getAttribute('data-unread')).toBe('true');
  });

  it('A2.4 (D-74) — collapsing folds the chat to the strip and the board takes the full width', () => {
    mount();
    const board = q('[data-board]');
    expect(board.style.flex).toBe('3 1 0%');
    expect(q('[data-chat-column]')).toBeTruthy();
    expect(q('[data-peek-strip]')).toBeNull();

    const collapse = q('[data-chat-collapse]');
    expect(collapse.getAttribute('aria-label')).toBe('Collapse the chat');
    // `aria-expanded` has to NAME something (review RB-F11). The two controls
    // live in each other's chrome, so the region both of them are about is the
    // COLUMN — the one node that holds the strip and the chat beneath it.
    expect(collapse.getAttribute('aria-expanded')).toBe('true');
    expect(collapse.getAttribute('aria-controls')).toBe(q('[data-chat-column]').id);
    expect(q('[data-chat-column]').id).toBeTruthy();
    click(collapse);

    // The column is the chat's ONE home and it does not go away — it wraps
    // onto its own line as the strip (review L2-F1). What changes is its
    // chrome and its flex basis, never its position in the tree.
    expect(q('[data-chat-column]').getAttribute('data-chat-collapsed')).toBe('true');
    expect(q('[data-chat-collapse]')).toBeNull();
    expect(q('[data-board]').style.flex).toBe('0 0 100%');
    expect(q('[data-layout="desktop"]').style.flexWrap).toBe('wrap');
    // The strip sits BENEATH the full-width board, on its own wrapped line.
    // It is the board's SIBLING, not its child (review L2-F1): nesting it in
    // the board column is what moved the chat between two tree positions and
    // remounted it on every collapse. Same picture, stable tree.
    const strip = q('[data-peek-strip]');
    expect(strip).toBeTruthy();
    const row = q('[data-layout="desktop"]');
    const children = [...row.children];
    expect(children.indexOf(q('[data-board]'))).toBeLessThan(children.indexOf(q('[data-chat-column]')));
    expect(q('[data-chat-column]').contains(strip)).toBe(true);
    expect(qa('textarea').length).toBe(1);
    expect(q('[data-chat-column]').contains(q('textarea'))).toBe(true);
    // …and the strip carries the turn line and the newest tape line.
    const expand = q('[data-peek-expand]');
    expect(expand.getAttribute('aria-label')).toBe('Expand the chat');
    expect(expand.getAttribute('aria-expanded')).toBe('false');
    // …the SAME region, across the collapse: one id, so neither reference is
    // a dangling one and the pair reads as one disclosure (review RB-F11).
    expect(expand.getAttribute('aria-controls')).toBe(q('[data-chat-column]').id);
    expect(document.getElementById(expand.getAttribute('aria-controls'))).toBe(q('[data-chat-column]'));
    expect(expand.textContent).toContain('Checked 12:45 PM');
    expect(q('[data-peek-line]')).toBeTruthy();

    // Expanding restores the chrome and the 60/40 split.
    click(expand);
    expect(q('[data-chat-column]').getAttribute('data-chat-collapsed')).toBe('false');
    expect(q('[data-peek-strip]')).toBeNull();
    expect(q('[data-board]').style.flex).toBe('3 1 0%');
    expect(q('[data-layout="desktop"]').style.flexWrap).toBe('');
    expect(qa('textarea').length).toBe(1);
  });

  it('A2.4 (review L2-F1) — collapsing and expanding NEVER remount the chat: the draft survives', () => {
    // A4's F13 rule, on the desktop's new control. `{chat}` is rendered in ONE
    // tree position; only its chrome and the column's flex basis change.
    mount();
    const before = q('[data-chat-layout="controller"]');
    const ta = q('textarea');
    typeDraft('sell SLB at the open');
    expect(q('textarea').value).toBe('sell SLB at the open');

    click(q('[data-chat-collapse]'));
    expect(q('[data-peek-strip]')).toBeTruthy();
    expect(q('textarea').value).toBe('sell SLB at the open');
    // …the very same DOM node, not a fresh one with a restored value.
    expect(q('[data-chat-layout="controller"]')).toBe(before);
    expect(q('textarea')).toBe(ta);

    click(q('[data-peek-expand]'));
    expect(q('textarea').value).toBe('sell SLB at the open');
    expect(q('[data-chat-layout="controller"]')).toBe(before);
  });

  it('A2.4 (review L2-F4) — focus moves to the control that replaces the one that vanished', () => {
    mount();
    const collapse = q('[data-chat-collapse]');
    act(() => { collapse.focus(); });
    expect(document.activeElement).toBe(collapse);
    click(collapse);
    expect(document.activeElement).toBe(q('[data-peek-expand]'));
    click(q('[data-peek-expand]'));
    expect(document.activeElement).toBe(q('[data-chat-collapse]'));
  });

  it('A2.4 (review L4-F2) — the strip\'s line IS the tape\'s newest entry, not a constant', () => {
    // The presence assertions could not tell `derivePeekLine`'s output from
    // any other string. This one recomputes it from the fixture's own doc and
    // then moves the tape to prove the strip follows.
    mount();
    click(q('[data-chat-collapse]'));
    const expected = derivePeekLine(mergeRecordedTape(
      deriveChatMessages(LIVE_DOC.chatExchanges),
      buildTape({
        trades: LIVE_DOC.trades, statusFeed: LIVE_DOC.statusFeed,
        evaluations: LIVE_DOC.evaluations,
        receipts: deriveReceipts(LIVE_DOC.chatExchanges, LIVE_DOC.directive, LIVE_DOC.status),
        chatExchanges: LIVE_DOC.chatExchanges,
      }),
    ));
    expect(expected).toBeTruthy();
    expect(q('[data-peek-line]').textContent).toBe(expected);

    // A newer entry lands: the line moves with it.
    store.evaluations = [...LIVE_DOC.evaluations, {
      evalId: 'eval_new', timestamp: '2026-09-01T19:46:00.000Z', decision: 'HOLD',
      downgraded: false, rationale: 'The book is quiet.', scores: { banked: 0 },
    }];
    // `rerender` re-renders the same root, so the detent survives — the strip
    // is still up and only its line should have moved.
    rerender();
    expect(q('[data-peek-strip]')).toBeTruthy();
    expect(q('[data-peek-line]').textContent).toBe('3:45 PM · Held');
    expect(q('[data-peek-line]').textContent).not.toBe(expected);
  });

  it('A2.4 (D-74) — a COLLAPSED desktop shows the dot on the strip, the mobile rule', () => {
    mount();
    click(q('[data-chat-collapse]'));
    expect(q('[data-peek-strip]')).toBeTruthy();
    // Seen while the column was open, so nothing is unread yet…
    expect(q('[data-peek-expand]').getAttribute('data-unread')).toBe('false');
    expect(q('[data-peek-dot]')).toBeNull();
    // …a new entry arrives with the chat collapsed, and the strip says so.
    store.statusFeed = [{ action: 'hold', message: 'Held.', timestamp: '2026-09-01T17:17:00.000Z' }];
    rerender();
    expect(q('[data-peek-expand]').getAttribute('data-unread')).toBe('true');
    expect(q('[data-peek-dot]')).toBeTruthy();
    // Expanding clears it, exactly as opening the sheet does.
    click(q('[data-peek-expand]'));
    expect(q('[data-chat-column]')).toBeTruthy();
    expect(q('[data-peek-strip]')).toBeNull();
    store.statusFeed = [...store.statusFeed];
    rerender();
    expect(q('[data-peek-dot]')).toBeNull();
  });

  it('the Game Tape link carries the bookmark dot exactly when a bookmark exists', () => {
    mount();
    expect(q('[data-game-tape-dot]')).toBeNull();
    store.feedBookmarks = [{ evalId: 'eval_003' }];
    rerender();
    expect(q('[data-game-tape-link] [data-game-tape-dot]')).toBeTruthy();
  });

  it('mounting steals no focus: the Game Tape focus effect acts only after an OPEN (review CR6)', () => {
    mount();
    expect(document.activeElement).toBe(document.body);
  });

  it('the score header button is named for the book and DESCRIBED by the names and scores inside it (review CR2)', () => {
    mount();
    const header = qa('[role="button"][aria-expanded]').find((el) => el.textContent.includes('Aurora') && el.textContent.includes('CPU'));
    expect(header.getAttribute('aria-label')).toBe('Why? · the whole book');
    const ids = header.getAttribute('aria-describedby').split(' ');
    const described = ids.map((id) => document.getElementById(id));
    expect(described.every(Boolean)).toBe(true);
    expect(described.every((el) => header.contains(el))).toBe(true);
    // The description is the names + scores row (the scores animate from 0
    // in jsdom, so the numbers are not pinned here) and the trade count.
    const description = described.map((el) => el.textContent).join(' ');
    expect(description).toContain('Aurora');
    expect(description).toContain('CPU');
    expect(description).toContain('1 trade');
  });

  it('Game Tape: the header link opens the shipped view full-screen with a way back; the chat stays mounted beneath', async () => {
    mount();
    const link = q('[data-game-tape-link]');
    click(link);
    const tape = q('[data-game-tape="open"]');
    expect(tape).toBeTruthy();
    expect(tape.getAttribute('role')).toBe('region');
    expect(tape.getAttribute('aria-label')).toBe('Game Tape');
    expect(document.activeElement).toBe(q('[data-game-tape-back]'));
    expect(q('[data-game-tape-back]').textContent).toContain('Back to the battle');
    // The page beneath is hidden, the chat still mounted (its draft survives),
    // and the document does not scroll under the tape (review L2-F10).
    expect(q('[data-layout="desktop"]').style.visibility).toBe('hidden');
    expect(qa('textarea').length).toBe(1);
    expect(document.body.style.overflow).toBe('hidden');
    click(q('[data-game-tape-back]'));
    await settle();
    expect(q('[data-game-tape="open"]')).toBeNull();
    expect(q('[data-layout="desktop"]').style.visibility).not.toBe('hidden');
    expect(document.body.style.overflow).toBe('');
    expect(document.activeElement).toBe(q('[data-game-tape-link]'));
  });
});

describe('mobile — the board as the page, the chat as a non-modal sheet', () => {
  beforeEach(() => setViewport(390));

  it('renders header, This turn and the board, the sheet at peek with the ONE AgentChat inside; no tab bar, no LiveActivityPanel', () => {
    mount();
    expect(q('[data-layout="mobile"]')).toBeTruthy();
    expect(tabButtons()).toEqual([]);
    expect(q('[data-live-activity]')).toBeNull();
    const sheet = q('[data-chat-sheet]');
    expect(sheet.getAttribute('data-chat-sheet')).toBe('peek');
    expect(sheet.getAttribute('role')).toBe('region');
    expect(sheet.getAttribute('aria-label')).toBe('Agent chat');
    expect(sheet.getAttribute('tabindex')).toBe('-1');
    expect(qa('textarea').length).toBe(1);
    expect(q('[data-sheet-content] textarea')).toBeTruthy();
    expect(q('[data-chat-column]')).toBeNull();
    expect(qa('[data-this-turn]').length).toBe(1);
    // The sheet is NOT inside the layout container (its z-index: 2 stacking
    // context would let the header paint over the sheet at full — review CR1).
    expect(q('[data-layout="mobile"]').contains(sheet)).toBe(false);
    // Peek: the sheet sizes itself (height auto) around the handle and the
    // composer; the message list is collapsed (review CR3).
    expect(sheet.getAttribute('data-sheet-height')).toBe('auto');
    const list = q('[data-chat-layout="controller"] > div');
    expect(list.style.display).toBe('none');
    // Peek carries the turn line — the same text the header renders.
    expect(q('[data-sheet-cycle]').textContent).toContain('Checked 12:45 PM · next ~1:00 PM');
    expect(q('[data-turn-state]').textContent).toBe('Checked 12:45 PM · next ~1:00 PM');
    // The cycle control is a real button, named for its next activation, wired to the content.
    const cycle = q('[data-sheet-cycle]');
    expect(cycle.tagName).toBe('BUTTON');
    expect(cycle.getAttribute('aria-expanded')).toBe('false');
    expect(cycle.getAttribute('aria-label')).toBe('Open the chat');
    expect(cycle.getAttribute('aria-controls')).toBe(q('[data-sheet-content]').id);
    expect(q('[data-sheet-collapse]')).toBeNull();
  });

  it('the detent state machine: peek → half → full → peek on the cycle control, focus into the sheet on expand and back to the control on collapse', () => {
    mount();
    const cycle = q('[data-sheet-cycle]');
    click(cycle);
    expect(q('[data-chat-sheet]').getAttribute('data-chat-sheet')).toBe('half');
    expect(cycle.getAttribute('aria-expanded')).toBe('true');
    expect(cycle.getAttribute('aria-label')).toBe('Show more of the chat');
    expect(document.activeElement).toBe(q('[data-chat-sheet]'));
    expect(q('[data-sheet-collapse]')).toBeTruthy();
    // Half: a viewport share in px; the message list is back.
    expect(q('[data-chat-sheet]').getAttribute('data-sheet-height')).toBe('400'); // 0.5 × the 800 px viewport
    expect(q('[data-chat-layout="controller"] > div').style.display).not.toBe('none');
    click(cycle);
    expect(q('[data-chat-sheet]').getAttribute('data-chat-sheet')).toBe('full');
    expect(cycle.getAttribute('aria-label')).toBe('Collapse the chat');
    expect(document.activeElement).toBe(q('[data-chat-sheet]'));
    click(cycle);
    expect(q('[data-chat-sheet]').getAttribute('data-chat-sheet')).toBe('peek');
    expect(cycle.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(cycle);
    expect(q('[data-sheet-collapse]')).toBeNull();
  });

  it('a pull on the grabber moves ONE detent: past 40 px up raises, past 40 px down lowers, less changes nothing', async () => {
    mount();
    const sheet = () => q('[data-chat-sheet]').getAttribute('data-chat-sheet');
    await pull(-45);
    expect(sheet()).toBe('half');
    await pull(-45);
    expect(sheet()).toBe('full');
    await pull(-45);
    expect(sheet()).toBe('full'); // saturates
    await pull(45);
    expect(sheet()).toBe('half');
    await pull(-39);
    expect(sheet()).toBe('half'); // under the threshold
    await pull(45);
    expect(sheet()).toBe('peek');
    await pull(45);
    expect(sheet()).toBe('peek'); // saturates
  });

  it('a viewport change re-sizes an open sheet (the toolbar, the keyboard) from the visible height', () => {
    mount();
    click(q('[data-sheet-cycle]'));
    expect(q('[data-chat-sheet]').getAttribute('data-sheet-height')).toBe('400');
    resizeTo(600);
    expect(q('[data-chat-sheet]').getAttribute('data-sheet-height')).toBe('300');
    click(q('[data-sheet-cycle]'));
    expect(q('[data-chat-sheet]').getAttribute('data-sheet-height')).toBe('544'); // 600 − 56
  });

  it('half → full does not move focus again: a control that holds focus keeps it', () => {
    mount();
    const cycle = q('[data-sheet-cycle]');
    click(cycle); // peek → half: the region takes focus
    expect(document.activeElement).toBe(q('[data-chat-sheet]'));
    act(() => { cycle.focus(); });
    click(cycle); // half → full: an open → open move
    expect(q('[data-chat-sheet]').getAttribute('data-chat-sheet')).toBe('full');
    expect(document.activeElement).toBe(cycle);
  });

  it('at half / full the message list is the scroll container and contains its overscroll', () => {
    mount();
    click(q('[data-sheet-cycle]'));
    const list = q('[data-chat-layout="controller"] > div');
    expect(list.style.overflowY).toBe('auto');
    expect(list.style.overscrollBehavior).toBe('contain');
  });

  it('at the server\'s feed cap the length stops moving — a newer entry still lights the dot; a shrink never hides one', () => {
    const entry = (i) => ({ action: 'hold', message: `Held ${i}.`, timestamp: `2026-09-01T16:${String(i).padStart(2, '0')}:00.000Z` });
    store.statusFeed = [entry(1), entry(2), entry(3)];
    mount();
    const cycle = q('[data-sheet-cycle]');
    click(cycle); // half: seen (length 3, newest 16:03)
    expect(cycle.getAttribute('data-unread')).toBe('false');
    click(q('[data-sheet-collapse]'));
    // A cap roll: the oldest falls off, a newer one lands — the length is still 3.
    store.statusFeed = [entry(2), entry(3), entry(4)];
    rerender();
    expect(cycle.getAttribute('data-unread')).toBe('true');
    click(cycle); // seen again (length 3, newest 16:04)
    expect(cycle.getAttribute('data-unread')).toBe('false');
    click(q('[data-sheet-collapse]'));
    // A shrink below the seen length, then a newer entry: still new.
    store.statusFeed = [entry(5)];
    rerender();
    expect(cycle.getAttribute('data-unread')).toBe('true');
  });

  it('a pending proposal colours the handle dot amber, and — as shipped — keeps it while the sheet is open', () => {
    store.pendingProposal = { proposalId: 'p-1', resolvedAt: null };
    mount();
    const dot = q('[data-sheet-dot]');
    expect(dot).toBeTruthy();
    expect(dot.style.background).toBe('var(--ft-amber)');
    click(q('[data-sheet-cycle]'));
    expect(q('[data-sheet-cycle]').getAttribute('data-unread')).toBe('true');
  });

  it('A2.4 (ruling 7) — a breakpoint crossing keeps ONE AgentChat and the DETENT SURVIVES', () => {
    // This row asserted "brings the sheet back at peek" through A4, because
    // the hook was disabled on the desktop and reset on every crossing. Ruling
    // 7 moved it: one detent, both shells, and it survives the crossing.
    mount();
    const cycle = q('[data-sheet-cycle]');
    click(cycle);
    click(cycle);
    expect(q('[data-chat-sheet]').getAttribute('data-chat-sheet')).toBe('full');

    // OPEN on the phone → the column on the desktop.
    crossTo(1280);
    expect(q('[data-layout="desktop"]')).toBeTruthy();
    expect(q('[data-chat-sheet]')).toBeNull();
    expect(q('[data-chat-column]')).toBeTruthy();
    expect(q('[data-peek-strip]')).toBeNull();
    expect(qa('textarea').length).toBe(1);
    expect(q('[data-chat-column] textarea')).toBeTruthy();

    // …and back: still open, at the detent it left with.
    crossTo(390);
    expect(q('[data-layout="mobile"]')).toBeTruthy();
    expect(q('[data-chat-column]')).toBeNull();
    expect(qa('textarea').length).toBe(1);
    expect(q('[data-sheet-content] textarea')).toBeTruthy();
    expect(q('[data-chat-sheet]').getAttribute('data-chat-sheet')).toBe('full');
  });

  it('A2.4 (ruling 7) — COLLAPSED on the desktop arrives at PEEK on the phone, and back', () => {
    setViewport(1280);
    mount();
    expect(q('[data-chat-column]')).toBeTruthy();
    click(q('[data-chat-collapse]'));
    expect(q('[data-peek-strip]')).toBeTruthy();
    expect(q('[data-chat-column]').getAttribute('data-chat-collapsed')).toBe('true');
    expect(qa('textarea').length).toBe(1);

    crossTo(390);
    expect(q('[data-layout="mobile"]')).toBeTruthy();
    expect(q('[data-chat-sheet]').getAttribute('data-chat-sheet')).toBe('peek');
    expect(q('[data-peek-strip]')).toBeNull();
    expect(qa('textarea').length).toBe(1);

    // …and the phone's peek is the desktop's strip when it goes back.
    crossTo(1280);
    expect(q('[data-peek-strip]')).toBeTruthy();
    expect(q('[data-chat-column]').getAttribute('data-chat-collapsed')).toBe('true');
    expect(qa('textarea').length).toBe(1);
  });

  it('A2.4 — expanding from the strip opens at HALF, so a crossing lands on half', () => {
    setViewport(1280);
    mount();
    click(q('[data-chat-collapse]'));
    click(q('[data-peek-expand]'));
    expect(q('[data-chat-column]')).toBeTruthy();
    crossTo(390);
    expect(q('[data-chat-sheet]').getAttribute('data-chat-sheet')).toBe('half');
  });

  it('A2.4 (D-74) — the mobile peek carries the newest tape line, and open it does not', () => {
    mount();
    expect(q('[data-chat-sheet]').getAttribute('data-chat-sheet')).toBe('peek');
    const line = q('[data-peek-line]');
    expect(line).toBeTruthy();
    // The newest entry of this fixture's tape, folded as the stream folds it.
    expect(line.textContent.length).toBeGreaterThan(0);
    expect(line.textContent).toContain(' · ');
    // The turn line stays on the handle — the strip is turn line THEN the
    // newest line, and the handle is the first of the two.
    expect(q('[data-sheet-cycle]').textContent).toContain('Checked 12:45 PM');

    // Open, the stream itself is on screen; a summary of its own last line
    // would be noise.
    click(q('[data-sheet-cycle]'));
    expect(q('[data-chat-sheet]').getAttribute('data-chat-sheet')).toBe('half');
    expect(q('[data-peek-line]')).toBeNull();
    click(q('[data-sheet-collapse]'));
    expect(q('[data-peek-line]')).toBeTruthy();
  });

  it('the collapse control at half goes straight to peek', () => {
    mount();
    click(q('[data-sheet-cycle]'));
    expect(q('[data-chat-sheet]').getAttribute('data-chat-sheet')).toBe('half');
    const collapse = q('[data-sheet-collapse]');
    expect(collapse.getAttribute('aria-label')).toBe('Collapse the chat');
    click(collapse);
    expect(q('[data-chat-sheet]').getAttribute('data-chat-sheet')).toBe('peek');
  });

  it('the door opens the sheet to at least half, then the prefill focuses the composer; collapse returns focus to the door', () => {
    mount();
    click(rowButtonFor('SLB'));
    const door = doorButton();
    act(() => { door.focus(); }); // the invoking control, as a keyboard user leaves it
    click(door);
    expect(q('[data-chat-sheet]').getAttribute('data-chat-sheet')).toBe('half');
    const ta = q('textarea');
    expect(document.activeElement).toBe(ta);
    expect(ta.value).toBe('About SLB — ');
    click(q('[data-sheet-collapse]'));
    expect(q('[data-chat-sheet]').getAttribute('data-chat-sheet')).toBe('peek');
    expect(document.activeElement).toBe(door);
  });

  it('a pointer that left nothing focused (Safari / touch): collapse hands focus to the handle, never leaves it in the composer (review CR4)', () => {
    mount();
    click(rowButtonFor('SLB'));
    expect(document.activeElement).toBe(document.body); // the click focused nothing
    click(doorButton());
    expect(q('[data-chat-sheet]').getAttribute('data-chat-sheet')).toBe('half');
    expect(document.activeElement).toBe(q('textarea'));
    click(q('[data-sheet-collapse]'));
    expect(q('[data-chat-sheet]').getAttribute('data-chat-sheet')).toBe('peek');
    expect(document.activeElement).toBe(q('[data-sheet-cycle]'));
  });

  it('entries that land while the Game Tape covers the chat stay unseen, even with the sheet open (review L1-F3)', () => {
    mount();
    const cycle = q('[data-sheet-cycle]');
    click(cycle); // half: visible
    expect(cycle.getAttribute('data-unread')).toBe('false');
    click(q('[data-game-tape-link]'));
    expect(q('[data-game-tape="open"]')).toBeTruthy();
    expect(q('[data-chat-sheet]').style.visibility).toBe('hidden');
    store.statusFeed = [{ action: 'hold', message: 'Held.', timestamp: '2026-09-01T17:02:00.000Z' }];
    rerender();
    // Behind the tape the chat is not visible: the feed stays unseen.
    expect(cycle.getAttribute('data-unread')).toBe('true');
    click(q('[data-game-tape-back]'));
    // Back on the page with the sheet at half, the effect marks it seen.
    expect(q('[data-chat-sheet]').style.visibility).not.toBe('hidden');
    expect(cycle.getAttribute('data-unread')).toBe('false');
  });

  it('the door leaves an open sheet at its detent (full stays full) and never erases a typed draft (F13)', () => {
    mount();
    typeDraft('my own words');
    act(() => { q('textarea').blur(); });
    const cycle = q('[data-sheet-cycle]');
    click(cycle);
    click(cycle);
    expect(q('[data-chat-sheet]').getAttribute('data-chat-sheet')).toBe('full');
    click(rowButtonFor('NVDA'));
    click(doorButton());
    expect(q('[data-chat-sheet]').getAttribute('data-chat-sheet')).toBe('full');
    expect(q('textarea').value).toBe('my own words');
    expect(document.activeElement).toBe(q('textarea'));
  });

  it('the unread dot lives on the sheet handle and clears when the sheet opens; it returns for new entries at peek', () => {
    store.statusFeed = [
      { action: 'hold', message: 'Held.', timestamp: '2026-09-01T16:47:00.000Z' },
      { action: 'hold', message: 'Held again.', timestamp: '2026-09-01T17:02:00.000Z' },
    ];
    mount();
    const cycle = q('[data-sheet-cycle]');
    expect(cycle.getAttribute('data-unread')).toBe('true');
    expect(q('[data-sheet-dot]')).toBeTruthy();
    expect(cycle.getAttribute('aria-label')).toBe('Open the chat · new activity');
    click(cycle); // → half: visible → the effect marks the feed seen
    expect(cycle.getAttribute('data-unread')).toBe('false');
    expect(q('[data-sheet-dot]')).toBeNull();
    expect(cycle.getAttribute('aria-label')).toBe('Show more of the chat');
    click(q('[data-sheet-collapse]'));
    expect(q('[data-chat-sheet]').getAttribute('data-chat-sheet')).toBe('peek');
    expect(cycle.getAttribute('data-unread')).toBe('false');
    // A new entry while the sheet is at peek → the dot returns; opening clears it again.
    store.statusFeed = [...store.statusFeed, { action: 'hold', message: 'Held once more.', timestamp: '2026-09-01T17:17:00.000Z' }];
    rerender();
    expect(cycle.getAttribute('data-unread')).toBe('true');
    click(cycle);
    expect(cycle.getAttribute('data-unread')).toBe('false');
  });
});
