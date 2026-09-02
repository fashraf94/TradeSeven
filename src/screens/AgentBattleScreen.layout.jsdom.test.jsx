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
const store = vi.hoisted(() => ({ statusFeed: [] }));

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
    battle: { ...LIVE_DOC, statusFeed: store.statusFeed }, statusFeed: store.statusFeed,
    executionMode: 'copilot', pendingProposal: null, strategyPreset: 'balanced', gameplanMeeting: null,
    chatExchanges: LIVE_DOC.chatExchanges, feedBookmarks: [], loading: false,
  }),
}));

import AgentBattleScreen from './AgentBattleScreen';

const BATTLE = {
  agentId: 'agent-1', agentBattleId: 'ab-1',
  creator: { portfolio: { star: [{ symbol: 'AAPL' }, { symbol: 'MU' }], core: [{ symbol: 'NVDA' }], support: [] } },
  opponent: { portfolio: { star: [{ symbol: 'MSFT' }], core: [], support: [] } },
  state: { startingPrices: { AAPL: 150, NVDA: 900, MU: 90 } },
};

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};

// The screen reads window.innerWidth for its breakpoint at mount and
// matchMedia for later changes; both are set per test.
const setViewport = (width, height = 800) => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: height });
  window.matchMedia = () => ({ matches: width >= 768, addEventListener() {}, removeEventListener() {} });
};

let container;
let root;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-01T17:00:00.000Z'));
  store.statusFeed = [];
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

  it('the unread dot has nowhere to show on desktop — the feed grows and no dot markup appears', () => {
    mount();
    store.statusFeed = [{ action: 'hold', message: 'Held.', timestamp: '2026-09-01T16:47:00.000Z' }, { action: 'hold', message: 'Held again.', timestamp: '2026-09-01T17:02:00.000Z' }];
    rerender();
    expect(q('[data-sheet-dot]')).toBeNull();
    expect(q('[data-unread]')).toBeNull();
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
    // The page beneath is hidden, the chat still mounted (its draft survives).
    expect(q('[data-layout="desktop"]').style.visibility).toBe('hidden');
    expect(qa('textarea').length).toBe(1);
    click(q('[data-game-tape-back]'));
    await settle();
    expect(q('[data-game-tape="open"]')).toBeNull();
    expect(q('[data-layout="desktop"]').style.visibility).not.toBe('hidden');
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
    // Peek carries the turn line — the same text the header renders.
    expect(q('[data-sheet-cycle]').textContent).toContain('Checked 12:47 PM · next ~1:02 PM');
    expect(q('[data-turn-state]').textContent).toBe('Checked 12:47 PM · next ~1:02 PM');
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
