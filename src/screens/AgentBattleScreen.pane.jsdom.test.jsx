// @vitest-environment jsdom
//
// src/screens/AgentBattleScreen.pane.jsdom.test.jsx
//
// Phase A3 — the screen MOUNTED with the character pane on. The sibling
// AgentBattleScreen.paneOff.golden.test.jsx guards the else-arm (pane-off is
// the A2 render, byte for byte); this file guards the then-arm.
//
// It grows one describe block per build phase. A3.0 is the arena header.
//
// Harness: AgentBattleScreen.controller.jsdom.test.jsx, with isCharacterPaneOn
// mocked true alongside the controller.

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
  // THE PANE ON — what this file is for. The flag itself ships false; mocking
  // the ACCESSOR (never the constant) is the seam the flag docstring names.
  isCharacterPaneOn: () => true,
}));
vi.mock('../services/eodhdAPI', () => ({
  stockAPI: {
    getMultipleStockPrices: vi.fn(async () => ({})),
    getMultipleCryptoPrices: vi.fn(async () => ({})),
  },
  POPULAR_CRYPTO: [],
}));
vi.mock('../components/Agent/LiveActivityPanel', () => ({ default: () => null, BreakthroughAlerts: () => null }));

const LIVE_DOC = {
  id: 'ab-1',
  status: 'active',
  activatedAt: '2026-09-01T13:30:00.000Z',
  agentContext: { agentName: 'Aurora' },
  scoreState: { currentScore: 12, opponentScore: 3, tradeCount: 1, evaluationCount: 5, lastScoredAt: '2026-09-01T16:47:00.000Z' },
  timing: { tradingDays: ['d1', 'd2', 'd3'], currentTradingDay: 2 },
  portfolio: {
    star: [{ symbol: 'AAPL' }, { symbol: 'SLB' }],
    core: [{ symbol: 'NVDA' }],
    support: [],
    startingPrices: { AAPL: 150, NVDA: 900, MU: 90 },
  },
  opponent: { portfolio: { star: [{ symbol: 'AMD' }], core: [], support: [] } },
  evaluations: [
    { evalId: 'eval_005', timestamp: '2026-09-01T16:47:02.000Z', decision: 'HOLD', rationale: 'Holding the book.', haikuError: null },
  ],
  trades: [],
  statusFeed: [],
  chatExchanges: [],
};

let DOC = LIVE_DOC;
const withDoc = (over) => { DOC = { ...LIVE_DOC, ...over }; };
vi.mock('../hooks/useAgentBattle', () => ({
  default: () => ({
    battle: DOC, statusFeed: [], executionMode: 'copilot', pendingProposal: null,
    strategyPreset: 'balanced', gameplanMeeting: null, chatExchanges: DOC.chatExchanges,
    feedBookmarks: [], loading: false,
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

let container;
let root;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-01T17:00:00.000Z'));
  DOC = LIVE_DOC;
  setShell(true);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

/**
 * The breakpoint, both halves of it: useIsDesktop seeds from window.innerWidth
 * at MOUNT and then listens on matchMedia, so a test that sets only one of the
 * two gets a shell that disagrees with itself.
 */
const setShell = (isDesktop) => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: isDesktop ? 1280 : 480 });
  window.matchMedia = () => ({ matches: isDesktop, addEventListener() {}, removeEventListener() {} });
};

const mount = () => act(() => {
  root.render(<AgentBattleScreen battle={BATTLE} user={{ uid: 'u1' }} onBack={() => {}} onOpenFilmRoom={null} />);
});

describe('A3.0 — the arena replaces the shipped header under the pane flag (D-96)', () => {
  it('mounts the arena header, and exactly one of it', () => {
    mount();
    expect(container.querySelectorAll('[data-arena-header]')).toHaveLength(1);
    expect(container.querySelector('[data-arena-bar]')).toBeTruthy();
  });

  it('keeps ONE book tap surface — the arena\'s, not a second one beside it', () => {
    // The shipped ScoreHeader also renders data-why-book-toggle. If the branch
    // were an insertion rather than a swap, both would mount and the panel's
    // close (which finds the control by attribute) would hand focus to whichever
    // came first.
    mount();
    expect(container.querySelectorAll('[data-why-book-toggle]')).toHaveLength(1);
    expect(container.querySelector('[data-arena-header] [data-why-book-toggle]')).toBeTruthy();
  });

  it('carries the turn line inside the arena, not beside it', () => {
    mount();
    const line = container.querySelector('[data-turn-state]');
    expect(line).toBeTruthy();
    expect(container.querySelector('[data-arena-header]').contains(line)).toBe(true);
  });

  it('lets the starfield through: the top section is no longer opaque (hazard 39)', () => {
    // The arena is the floor. The persistent top section paints an opaque
    // bgAgent pane-off; under the flag it drops to a scrim so the existing
    // BaggerBombBackground canvas at z1 is visible through it. Read off the
    // element's own inline style — the token is not resolved in this harness,
    // so the assertion is that the VALUE changed shape, not its computed colour.
    mount();
    const top = container.querySelector('[data-arena-header]').closest('div[style*="z-index"]');
    expect(top).toBeTruthy();
    expect(top.style.background).toContain('--ft-shadow-rgb');
    expect(top.style.background).not.toContain('#1C1A27');
  });

  it('renders the day label the screen derives, not one the header re-derives (§9)', () => {
    // computeDayLabel lives in the screen and is passed in. The arena must not
    // grow its own copy of that arithmetic off `timing`.
    mount();
    expect(container.querySelector('[data-arena-header]').textContent).toContain('Day 2 of 3');
  });
});

describe('A3.1 — the character on the board (D-91, D-98)', () => {
  it('mounts exactly one mark, inside the board column', () => {
    mount();
    const marks = container.querySelectorAll('[data-character-mark]');
    expect(marks).toHaveLength(1);
    expect(container.querySelector('[data-board]').contains(marks[0])).toBe(true);
  });

  it('the board reserves the mark\'s clearance instead of the sheet\'s peek (D-93)', () => {
    mount();
    // matchMedia is stubbed true here, so this is the DESKTOP branch: the
    // column takes `position: relative` so the absolutely-positioned mark has a
    // containing block, and the mobile branch swaps the padding. Both are the
    // paneOn arm of the same conditional.
    const board = container.querySelector('[data-board]');
    expect(board.style.position).toBe('relative');
  });

  it('speaks the newest RECORDED entry when something is unread, and clears on open', () => {
    // MOBILE, deliberately. On desktop the A2 chat column opens at HALF by
    // default, so `chatVisible` is true on the first paint and the effect marks
    // everything seen before a count can exist — correct behaviour, and the
    // reason the pane's own closed-by-default machine (A3.2) is what finally
    // makes the desktop count meaningful. The phone starts at peek, so the
    // unread path is live there today.
    setShell(false);
    // The tape is unseen on a fresh mount (the A4 rule kept in flip-prep), so
    // the mark carries a count and the character has a line.
    mount();
    const mark = container.querySelector('[data-character-mark]');
    expect(mark.getAttribute('data-unread')).toBeTruthy();
    const bubble = container.querySelector('[data-character-bubble]');
    expect(bubble).toBeTruthy();
    // The eyebrow is the check CARD's own label, not a second one.
    expect(bubble.textContent).toContain('Status check');

    // Opening the conversation marks it seen; the count and the bubble go.
    act(() => { mark.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); });
    expect(container.querySelector('[data-character-mark]').getAttribute('data-unread')).toBeNull();
    expect(container.querySelector('[data-character-bubble]')).toBeNull();
  });

  it('says nothing when the tape has nothing the character said', () => {
    withDoc({ evaluations: [], chatExchanges: [], trades: [] });
    mount();
    expect(container.querySelector('[data-character-mark]')).toBeTruthy();
    expect(container.querySelector('[data-character-bubble]')).toBeNull();
    expect(container.querySelector('[data-character-mark]').getAttribute('data-unread')).toBeNull();
  });

  it('a TIMER alone creates no bubble — only a tape change can (D-97)', () => {
    // The seed's row. Mount with an empty tape, advance the clock past several
    // cron slots, re-render: still nothing. The only input that can produce a
    // bubble is a new entry.
    withDoc({ evaluations: [], chatExchanges: [], trades: [] });
    mount();
    expect(container.querySelector('[data-character-bubble]')).toBeNull();
    act(() => { vi.setSystemTime(new Date('2026-09-01T18:30:00.000Z')); });
    mount();
    expect(container.querySelector('[data-character-bubble]')).toBeNull();
  });

  it('the bubble and the mark are both doors onto the same pane', () => {
    setShell(false);
    mount();
    const bubble = container.querySelector('[data-character-bubble]');
    expect(bubble.tagName).toBe('BUTTON');
    act(() => { bubble.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); });
    expect(container.querySelector('[data-character-mark]').getAttribute('data-unread')).toBeNull();
  });
});
