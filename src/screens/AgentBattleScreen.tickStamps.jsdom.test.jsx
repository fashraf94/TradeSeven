// @vitest-environment jsdom
//
// src/screens/AgentBattleScreen.tickStamps.jsdom.test.jsx
//
// Phase B (B1 client half) — THE JOIN ITSELF, mounted.
//
// WHY THIS FILE EXISTS (review B-1 / B-2, a BLOCKER). Every other Phase B row
// hands its component finished props: `withHeard(...)`, `receiptsWith(...)`,
// `selectEvidence(stamped(...))`. Nothing rendered the SCREEN with a stamped
// `evaluations[]`, so the two lines that actually connect the record to the
// surfaces were untested — and both survived being replaced with `null`:
//
//   AgentBattleScreen.jsx  base[threadId] = { ...base[threadId], heard: null }
//   AgentBattleScreen.jsx  evidence={null}
//
// Either mutation ships a feature that renders NOTHING in production while CI
// stays green. And because the server flag is dark at merge and the spec's
// only stated verification is "the flip is the smoke" (D-113), a dead join
// would not surface until the founder flipped `TICK_STAMPS_ENABLED` against
// live battles. That is the whole cost of a dark build with an untested seam,
// and it is what this file removes.
//
// The doc below is the shape the cron actually writes at flag-on (server build
// report §3): the four stamp keys on the newest evaluation entry, nothing
// else moved. The rows assert the rendered surfaces, never the selectors —
// the selectors have their own files.
//
// Harness: AgentBattleScreen.pane.jsdom.test.jsx, trimmed to what these rows
// need.

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
  isCharacterPaneOn: () => true,
}));
vi.mock('../services/eodhdAPI', () => ({
  stockAPI: { getMultipleStockPrices: vi.fn(async () => ({})), getMultipleCryptoPrices: vi.fn(async () => ({})) },
  POPULAR_CRYPTO: [],
}));
vi.mock('../components/Agent/LiveActivityPanel', () => ({ default: () => null, BreakthroughAlerts: () => null }));

const SCORED = '2026-09-01T16:47:00.000Z';
const CHECK = '2026-09-01T16:47:02.000Z'; // 12:47:02 PM ET → the 12:45 slot
const FILED = '2026-09-01T15:31:00.000Z'; // 11:31 AM ET

/** The four stamp keys, exactly as the cron composes them at flag-on. */
const STAMPS = {
  heard: { directiveThreadId: 't-1', suppressed: null },
  evidence: {
    SLB: {
      px: 44.12, chg: 2.57, atrX: 0.83, vwapDev: 0.95, bbPct: 15, nr7: true,
      regime: 'directional_expansion', risk: { action: 'LOCK', reason: 'threshold_proximity' },
    },
  },
  vintages: {
    quote: 'tick', vwap: 'tick',
    techAt: '2026-09-01T16:30:00.000Z', fundAsOf: '2026-09-08', rankingsAt: '2026-09-01T11:00:00.000Z',
  },
  candidates: [{ symbol: 'NOW', direction: 'potential_entry', signalSummary: 'BB squeeze', threshold: '2.1x RVOL' }],
};

const EXCHANGE = {
  userMessage: 'protect the lead', agentResponse: 'Got it.', hasDirective: true,
  directive: { text: 'Protect the lead into the close', expiry: 'end_of_battle', directiveThreadId: 't-1' },
  directiveThreadId: 't-1', timestamp: FILED,
};

const BASE_DOC = {
  id: 'ab-1',
  status: 'active',
  activatedAt: '2026-09-01T13:30:00.000Z',
  agentContext: { agentName: 'Aurora', archetype: 'degen', equippedWatchlist: { name: 'Energy leaders', tickers: [] } },
  scoreState: { currentScore: 12, opponentScore: 3, tradeCount: 1, evaluationCount: 5, lastScoredAt: SCORED },
  timing: { tradingDays: ['d1', 'd2', 'd3'], currentTradingDay: 2 },
  portfolio: {
    star: [{ symbol: 'AAPL' }, { symbol: 'SLB' }],
    core: [{ symbol: 'NVDA' }],
    support: [],
    startingPrices: { AAPL: 150, NVDA: 900, SLB: 40 },
    bench: { stocks: [{ symbol: 'NOW' }, { symbol: 'TSLA' }], crypto: null },
  },
  watchlist: { hotBench: ['CRWD'] },
  agentContext2: null,
  directive: { text: 'Protect the lead into the close', expiry: 'end_of_battle', directiveThreadId: 't-1', createdAt: FILED },
  opponent: { portfolio: { star: [{ symbol: 'AMD' }], core: [], support: [] } },
  evaluations: [{
    evalId: 'eval_005', timestamp: CHECK, decision: 'HOLD', haikuError: null,
    rationale: 'Holding the book. SLB is steady into the afternoon.',
  }],
  trades: [],
  statusFeed: [],
  chatExchanges: [EXCHANGE],
};

/** The same doc with the cron's stamps on its newest entry. */
const stampedDoc = () => ({
  ...BASE_DOC,
  evaluations: [{ ...BASE_DOC.evaluations[0], ...STAMPS }],
});

let DOC = BASE_DOC;
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
  creator: { portfolio: { star: [{ symbol: 'AAPL' }, { symbol: 'SLB' }], core: [{ symbol: 'NVDA' }], support: [] } },
  opponent: { portfolio: { star: [{ symbol: 'AMD' }], core: [], support: [] } },
  state: { startingPrices: { AAPL: 150, NVDA: 900, SLB: 40 } },
};

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};

let container;
let root;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-01T17:00:00.000Z'));
  DOC = BASE_DOC;
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1280 });
  window.matchMedia = (query) => ({
    matches: /min-width/.test(query), media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  });
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
const html = () => container.innerHTML;

/** Open the Why? panel on the row that has one (SLB carries the evidence). */
const openWhyFor = (symbol) => {
  const row = [...container.querySelectorAll('[role="button"][aria-expanded]')]
    .find((el) => (el.textContent || '').includes(symbol) && el.querySelector('[data-why-label]'));
  expect(row, `a player row for ${symbol} with a Why? door`).toBeTruthy();
  act(() => { row.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); });
};

describe('the screen joins the record to the receipts (review B-1)', () => {
  it('a stamped entry puts `Heard at the {slot} check` on the directive card', () => {
    DOC = stampedDoc();
    mount();
    expect(html()).toContain('data-heard="heard"');
    // The CHECK's slot (12:45), not the check's exact minute and not the
    // filing's minute — the two live on the same card and must not be confused.
    expect(html()).toContain('Heard at the 12:45 PM check');
    expect(html()).toContain('Filed 11:31 AM');
  });

  it('a WITHHELD stamp puts the reasonless negative there, and never the reason', () => {
    DOC = { ...BASE_DOC, evaluations: [{ ...BASE_DOC.evaluations[0], ...STAMPS, heard: { directiveThreadId: 't-1', suppressed: 'epoch_killed' } }] };
    mount();
    expect(html()).toContain('data-heard="not-heard"');
    expect(html()).toContain('Not heard at this check');
    expect(html()).not.toContain('epoch_killed');
  });

  it('THE JOIN IS THE THING UNDER TEST — an unstamped doc renders no Heard line', () => {
    DOC = BASE_DOC;
    mount();
    expect(html()).not.toContain('data-heard');
    expect(html()).not.toContain('Heard at the');
    // …and the Phase A receipt is untouched beside it.
    expect(html()).toContain('Filed 11:31 AM');
  });

  it('TWO THREADS: each receipt takes ITS OWN stamp, not the first in the map', () => {
    // t-1 was filed first, WITHHELD at its check, then replaced by t-2, which
    // was heard. The strip shows the CURRENT directive, so it must read t-2's
    // verdict. A reader that took `Object.values(receipts)[0]` would take
    // t-1's — insertion order — and print the wrong thread's answer on the
    // current one (review B-1b).
    const T2_FILED = '2026-09-01T16:00:00.000Z'; // 12:00 PM ET
    const EX2 = {
      userMessage: 'lean into tech', agentResponse: 'Understood.', hasDirective: true,
      directive: { text: 'Lean into tech strength', expiry: 'end_of_battle', directiveThreadId: 't-2' },
      directiveThreadId: 't-2', timestamp: T2_FILED,
    };
    DOC = {
      ...BASE_DOC,
      directive: { text: 'Lean into tech strength', expiry: 'end_of_battle', directiveThreadId: 't-2', createdAt: T2_FILED },
      chatExchanges: [EXCHANGE, EX2],
      evaluations: [
        { evalId: 'e-a', timestamp: '2026-09-01T16:15:00.000Z', decision: 'HOLD', haikuError: null,
          rationale: 'Holding.', heard: { directiveThreadId: 't-1', suppressed: 'epoch_killed' } },
        { ...BASE_DOC.evaluations[0], ...STAMPS, heard: { directiveThreadId: 't-2', suppressed: null } },
      ],
    };
    mount();
    // The strip carries the CURRENT thread's verdict…
    const strip = container.querySelector('[data-this-turn="filed"]');
    expect(strip, 'the This turn strip').toBeTruthy();
    expect(strip.textContent).toContain('Heard at the 12:45 PM check');
    expect(strip.textContent).not.toContain('Not heard');
    // …and t-1's replaced card carries no Heard line at all (review A-2 / D-2:
    // the deictic negative has no check to mean on a scrollback card).
    expect(html()).not.toContain('data-heard="not-heard"');
    expect(html()).not.toContain('Not heard at this check');
    expect(html()).toContain('Replaced 12:00 PM');
  });

  it('the stamp reaches the receipt for ITS OWN thread, never another', () => {
    // A stamp naming a thread this battle never filed must not land on the
    // filed one (the `Object.values(receipts)[0]` mix-up this row exists for).
    DOC = { ...BASE_DOC, evaluations: [{ ...BASE_DOC.evaluations[0], heard: { directiveThreadId: 't-other', suppressed: null } }] };
    mount();
    expect(html()).not.toContain('data-heard');
  });
});

describe('the screen joins the record to Why? (review B-2)', () => {
  it('a stamped entry puts `What the {slot} check saw` under the piece, with its facts', () => {
    DOC = stampedDoc();
    mount();
    openWhyFor('SLB');
    expect(html()).toContain('data-evidence="seen"');
    expect(html()).toContain('What the 12:45 PM check saw');
    expect(html()).toContain('Price $44.12');
    expect(html()).toContain('Gain since entry +2.57%');
    expect(html()).toContain('Regime directional_expansion');
    expect(html()).toContain('Risk LOCK');
  });

  it('the carve-outs survive the whole wiring, not just the selector', () => {
    DOC = stampedDoc();
    mount();
    openWhyFor('SLB');
    // The stored reason code is never text the decider saw (Sol B-1)…
    expect(html()).not.toContain('threshold_proximity');
    // …and the provenance names its fields rather than promising freshness.
    expect(html()).toContain('Fundamentals block as of Sep 8');
    expect(html()).toContain('Latest held technical stamp');
    expect(html()).not.toContain('Technical data as of');
  });

  it('THE JOIN IS THE THING UNDER TEST — an unstamped doc renders no evidence section', () => {
    DOC = BASE_DOC;
    mount();
    openWhyFor('SLB');
    expect(html()).not.toContain('data-evidence');
    expect(html()).not.toContain('check saw');
  });

  it('a piece with no row in the stamp gets nothing — never an empty heading', () => {
    DOC = stampedDoc();
    mount();
    openWhyFor('AAPL');   // the stamp carries SLB only
    expect(html()).not.toContain('data-evidence');
  });
});
