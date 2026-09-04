// @vitest-environment jsdom
//
// src/screens/AgentBattleScreen.bagger.reducedMotion.jsdom.test.jsx
//
// A3.6 (D-97) — "reduced motion renders the tag and footer with no burst"
// (the seed's own row), IN ITS OWN FILE, and it has to be.
//
// framer-motion latches `prefersReducedMotion` in MODULE scope the first time
// any component calls useReducedMotion (utils/reduced-motion/index.mjs:10,
// guarded by hasReducedMotionListener). Every later read returns the latched
// value, whatever matchMedia says by then. So a reduced-motion row sharing a
// file with ordinary rows is decided by which of them mounts first — it would
// pass or fail on the file's ordering rather than on the preference, which is
// the "a row that cannot fail under the defect it names" problem in its most
// deceptive form. Vitest isolates modules per file, so a file that sets the
// preference before its first mount gets the setting it asked for.
//
// The matching burst-IS-painted row lives in the sibling pane suite; this file
// only has to prove the negative, plus the two things reduced motion must NOT
// take away.

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
  agentContext: { agentName: 'Aurora', archetype: 'degen', equippedWatchlist: { name: 'Energy leaders', tickers: ['DVN'] } },
  scoreState: { currentScore: 12, opponentScore: 3, tradeCount: 1, evaluationCount: 5, lastScoredAt: '2026-09-01T16:47:00.000Z' },
  timing: { tradingDays: ['d1', 'd2', 'd3'], currentTradingDay: 2 },
  portfolio: {
    star: [{ symbol: 'AAPL' }, { symbol: 'SLB' }],
    core: [{ symbol: 'NVDA' }],
    support: [],
    startingPrices: { AAPL: 150, NVDA: 900, MU: 90 },
    bench: { stocks: [{ symbol: 'NOW' }, { symbol: 'TSLA' }], crypto: null },
  },
  watchlist: { hotBench: ['CRWD'] },
  agentContext2: null,
  opponent: { portfolio: { star: [{ symbol: 'AMD' }], core: [], support: [] } },
  evaluations: [
    { evalId: 'eval_005', timestamp: '2026-09-01T16:47:02.000Z', decision: 'HOLD', rationale: 'Holding the book. NOW would need +7.4% more to lock in the bonus.', haikuError: null },
  ],
  trades: [],
  statusFeed: [],
  chatExchanges: [],
};

let DOC = LIVE_DOC;
const withDoc = (over) => { DOC = { ...LIVE_DOC, ...over }; };
let FEED = [];
let BOOKMARKS = [];
vi.mock('../hooks/useAgentBattle', () => ({
  default: () => ({
    battle: DOC, statusFeed: FEED, executionMode: 'copilot', pendingProposal: null,
    strategyPreset: 'balanced', gameplanMeeting: null, chatExchanges: DOC.chatExchanges,
    feedBookmarks: BOOKMARKS, loading: false,
  }),
}));

import AgentBattleScreen from './AgentBattleScreen';
import { removeFeedBookmark } from '../services/agentService';
import { SHEET_PEEK_PX } from './battleView/useChatSheet';

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
  FEED = [];
  BOOKMARKS = [];
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
const setShell = (isDesktop, { reducedMotion = true } = {}) => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: isDesktop ? 1280 : 480 });
  // ANSWER EACH QUERY ON ITS OWN TERMS (A3.6). This used to return `isDesktop`
  // to every query, so framer's useReducedMotion — which asks for
  // `(prefers-reduced-motion: reduce)` — read TRUE on every desktop row and
  // FALSE on every mobile one. Harmless while nothing asserted on motion; the
  // moment the bagger burst did, "reduced motion renders no burst" would have
  // been proved by the shell rather than by the setting.
  window.matchMedia = (query) => ({
    matches: String(query).includes('prefers-reduced-motion') ? reducedMotion : isDesktop,
    addEventListener() {},
    removeEventListener() {},
  });
};

const mount = () => act(() => {
  root.render(<AgentBattleScreen battle={BATTLE} user={{ uid: 'u1' }} onBack={() => {}} onOpenFilmRoom={null} />);
});

/**
 * Open the pane, whatever the shell's opening default is. Desktop opens WITH
 * the pane showing (the brief's resting working state, §5 deliverable 1), so
 * there is no mark to press; the phone starts closed.
 */
const paneIsOpen = () => container.querySelector('[data-character-pane]')?.getAttribute('data-pane-open') === 'true';
const openPane = () => {
  if (paneIsOpen()) return;
  act(() => {
    container.querySelector('[data-character-mark]')
      .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
};
const closePane = () => act(() => {
  container.querySelector('[data-pane-close]')
    .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
});
const selectTab = (section) => act(() => {
  container.querySelector(`[data-pane-tab="${section}"]`)
    .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
});


describe('A3.6 — reduced motion: the footer and the line, with no burst', () => {
  const withHistory = (max) => withDoc({ thresholdHistory: { NVDA: { maxMultiplier: max } } });
  const rerender = () => act(() => {
    root.render(<AgentBattleScreen battle={BATTLE} user={{ uid: 'u1' }} onBack={() => {}} onOpenFilmRoom={null} />);
  });

  it('a crossing under reduced motion paints NO burst', () => {
    setShell(false, { reducedMotion: true });
    withHistory(0.8);
    mount();
    withHistory(1.1);
    rerender();
    expect(container.querySelectorAll('[data-bagger-burst]')).toHaveLength(0);
  });

  it('…and still banks it in words, which is the news', () => {
    // The seed is explicit that reduced motion removes the MOTION and nothing
    // else. A reduced-motion player who lost the footer and the line would
    // simply not be told their piece had baggered.
    setShell(false, { reducedMotion: true });
    withHistory(0.8);
    mount();
    withHistory(1.1);
    rerender();
    expect([...container.querySelectorAll('[data-bagger-footer]')].map((n) => n.textContent))
      .toEqual(['Bagger hit · 1.5× banked']);
    expect(container.querySelector('[data-character-bubble]').textContent)
      .toContain('Bagger · NVDA hit +2.5%');
  });

  it('the banked footer is there on MOUNT too, with no crossing to reduce', () => {
    setShell(false, { reducedMotion: true });
    withHistory(1.6);
    mount();
    expect(container.querySelectorAll('[data-bagger-burst]')).toHaveLength(0);
    expect(container.querySelector('[data-bagger-footer]').textContent).toBe('Bagger hit · 1.5× banked');
  });
});
