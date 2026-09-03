// @vitest-environment jsdom
//
// src/screens/AgentBattleScreen.flagOff.tape.jsdom.test.jsx
//
// A2.2 — THE SEAM THE GOLDENS CANNOT SEE (A2 review L3-F2).
//
// The two flag-off goldens pin the flag-off render, and between them they miss
// exactly this: `agentBattleScreen.tabbed.html` is captured on the `matchups`
// tab, which contains no chat at all, and `agentChat.tabbed.html` renders
// `<AgentChat>` DIRECTLY with a fixed prop set — bypassing the screen. So the
// screen → chat wiring is unphotographed, and a reviewer proved the point:
// removing BOTH flag gates on `tapeEntries` leaked the whole A2 tape into the
// shipped Command Center tab with all 3506 tests green.
//
// This file mounts the REAL screen with the controller OFF, opens the tab that
// holds the chat, and asserts the shipped rendering: the slim trade line, and
// not one tape card. It is the composition test the goldens cannot be.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

vi.mock('../firebase/config', () => ({ db: {}, auth: {}, default: {} }));
vi.mock('firebase/auth', () => ({ getAuth: vi.fn(() => ({ currentUser: null })) }));
vi.mock('../services/agentService', () => ({ submitDailyGrades: vi.fn() }));
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
  // THE CONTROLLER OFF — the whole point of this file.
  isBattleViewControllerOn: () => false,
}));
vi.mock('../services/eodhdAPI', () => ({
  stockAPI: {
    getMultipleStockPrices: vi.fn(async () => ({})),
    getMultipleCryptoPrices: vi.fn(async () => ({})),
  },
  POPULAR_CRYPTO: [],
}));
vi.mock('../components/Agent/LiveActivityPanel', () => ({ default: () => null, BreakthroughAlerts: () => null }));

// A document rich enough that a leak would be LOUD: an executed swap (a trade
// card under the flag, a slim line flag-off) and four quiet checks (four check
// cards and a collapsed run under the flag, nothing at all flag-off).
const quiet = (hhmm) => ({
  evalId: `e_${hhmm}`, timestamp: `2026-09-01T${hhmm}:00.000Z`, decision: 'HOLD', downgraded: false,
  rationale: 'The book is holding its shape. Nothing in the tape argues for a rotation yet.',
  scores: { active: 1, banked: 40, total: 41 },
});
const LIVE_DOC = {
  id: 'ab-1',
  status: 'active',
  activatedAt: '2026-09-01T13:30:00.000Z',
  agentContext: {
    agentName: 'Aurora',
    strategyBrief: 'Energy is the only sector with a bid this week.',
    innerMonologue: { strategy: 'Lean energy.', starRationale: 'SLB is the cleanest energy breakout.' },
  },
  scoreState: { currentScore: 12, opponentScore: 3, tradeCount: 1, evaluationCount: 5, lastScoredAt: '2026-09-01T16:47:00.000Z' },
  portfolio: {
    star: [{ symbol: 'AAPL' }, { symbol: 'SLB', swapPrice: 34.1, swappedInAt: '2026-09-01T15:02:00.000Z' }],
    core: [{ symbol: 'NVDA' }],
    support: [],
    startingPrices: { AAPL: 150, NVDA: 900, MU: 90 },
  },
  opponent: { portfolio: { star: [{ symbol: 'AMD' }], core: [], support: [] } },
  evaluations: [quiet('14:00'), quiet('14:15'), quiet('14:30'), quiet('14:45')],
  trades: [
    { symbolOut: 'MU', symbolIn: 'SLB', tier: 'star', lockedPoints: 8, swappedOutAt: '2026-09-01T15:02:00.000Z', evaluationId: 'eval_005', source: 'haiku', rationale: 'MU rolled over; SLB leads energy.' },
  ],
  statusFeed: [
    { timestamp: '2026-09-01T15:02:00.000Z', action: 'swap', evalId: 'eval_005', symbolOut: 'MU', symbolIn: 'SLB', message: 'Rotated the star slot.' },
  ],
  chatExchanges: [
    { userMessage: 'protect the lead', agentResponse: 'Got it.', timestamp: '2026-09-01T15:31:00.000Z' },
  ],
};
vi.mock('../hooks/useAgentBattle', () => ({
  default: () => ({
    battle: LIVE_DOC, statusFeed: LIVE_DOC.statusFeed, executionMode: 'copilot', pendingProposal: null,
    strategyPreset: 'balanced', gameplanMeeting: null, chatExchanges: LIVE_DOC.chatExchanges,
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
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
}

let container;
let root;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-01T17:00:00.000Z'));
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

const click = (el) => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); });
// The tab content is inside an AnimatePresence, so the outgoing tab must finish
// exiting before the incoming one mounts (the sibling controller suite's
// precedent). Timers and rAF are real here; only the clock is pinned.
const settle = (ms = 800) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });

const openTheChat = async () => {
  act(() => {
    root.render(<AgentBattleScreen battle={BATTLE} user={{ uid: 'u1' }} onBack={() => {}} onOpenFilmRoom={null} />);
  });
  // The shipped screen keeps the chat behind the Command Center tab.
  const tab = [...container.querySelectorAll('button')]
    .find((b) => /command/i.test(b.textContent || ''));
  expect(tab, 'the shipped Command Center tab should exist flag-off').toBeTruthy();
  click(tab);
  await settle();
};

describe('flag-off, through the SCREEN: the tape never reaches the shipped chat (review L3-F2)', () => {
  it('MUTATION ROW — not one tape card renders, on a document that would produce six', async () => {
    await openTheChat();
    // Under the flag this document yields one trade card, four check cards and
    // a collapsed run. Flag-off it must yield none of them.
    expect(container.querySelectorAll('[data-tape-kind]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-tape-kind="trade"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-tape-kind="check"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-tape-kind="checkRun"]')).toHaveLength(0);
  });

  it('MUTATION ROW — none of the tape\'s own copy reaches the shipped page either', async () => {
    await openTheChat();
    const text = container.textContent;
    for (const shouldNotAppear of [
      'checks · no change',
      'The agent\'s own words',
      'The system\'s reason',
      'Banked 8.0 pts',
      'Read more',
      'At the 12:47 PM check',
      'The plan at deploy',
      'At deploy ·',
      'from the scoring path',
      'Read the full check',
      'Woken by',
    ]) {
      expect(text, `flag-off page must not contain "${shouldNotAppear}"`).not.toContain(shouldNotAppear);
    }
  });

  it('and the SHIPPED chat is really on screen — this asserts a rendered chat, not a blank page', async () => {
    // Without this row the two above would pass on a blank page, which is the
    // failure mode that let the leak through in the first place.
    await openTheChat();
    // Without this row the two above would pass on a page with no chat at all,
    // which is the failure mode that let the leak through in the first place:
    // the screen golden is captured on the `matchups` tab and never sees one.
    expect(container.querySelector('textarea'), 'the shipped composer').toBeTruthy();
    expect(container.textContent).toContain('protect the lead');
    expect(container.textContent).toContain('MU');
  });
});
