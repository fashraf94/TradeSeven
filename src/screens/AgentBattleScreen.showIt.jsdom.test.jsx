// @vitest-environment jsdom
//
// src/screens/AgentBattleScreen.showIt.jsdom.test.jsx
//
// Phase C — THE SHOW-IT FAILURE PATH, MOUNTED AND TAPPED (§2 review, F2).
//
// WHY THIS FILE EXISTS, and it is the review's single most important outcome.
// Every claim commits 4 and 5 make about `handleShowIt` — which sentence a
// failure gets, that the line appears at all, that it clears — was guarded by
// THREE SOURCE-TEXT TRIPWIRES in showItDoor.jsdom.test.jsx and by nothing else.
// Those greps read `AgentBattleScreen.jsx` as a string; they cannot see
// behaviour. The review proved what that costs, on this exact code:
//
//   · adding `setResearchError(null)` to the handler's `finally` — a tidy-up a
//     person makes — means React batches the set and the clear into one
//     continuation, so NO RENDER EVER PAINTS THE LINE. 0 red across 12,266
//     tests (finding C2).
//   · moving one `researchError={researchError}` from the row `WhyPanel` onto
//     an unrelated component keeps the tripwire's occurrence count at 2 and
//     kills the door. 0 red across the same 12,266 (findings B6 / C1).
//
// Nothing in the repo mocked `isShowItOn` true and mounted the screen, so the
// whole screen half of the feature was untested. This file is that test: it
// taps the real doors, through the real handler, against a stubbed `fetch`,
// and asserts what a player would see.
//
// THE FLAG IS MOCKED ON, DELIBERATELY. `SHOW_IT_ENABLED` ships false and
// `showItFlags.test.js` pins it there; that pin is about what MERGES, and this
// file is about what happens at the flip. Mocking the accessor is the only way
// to exercise the lit path before the founder's own one-line PR.
//
// Harness: AgentBattleScreen.tickStamps.jsdom.test.jsx, trimmed to what these
// rows need, plus a fetch stub and an authenticated user.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { RESEARCH_FAILED_LINE, RESEARCH_UNREACHABLE_LINE } from '../data/decisionRecord';

vi.mock('../firebase/config', () => ({ db: {}, auth: {}, default: {} }));
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({ currentUser: { uid: 'u1', getIdToken: async () => 'tok' } })),
}));
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
  // THE ONE MOCK THIS FILE EXISTS FOR.
  isShowItOn: () => true,
}));
vi.mock('../services/eodhdAPI', () => ({
  stockAPI: { getMultipleStockPrices: vi.fn(async () => ({})), getMultipleCryptoPrices: vi.fn(async () => ({})) },
  POPULAR_CRYPTO: [],
}));
vi.mock('../components/Agent/LiveActivityPanel', () => ({ default: () => null, BreakthroughAlerts: () => null }));

const SCORED = '2026-09-01T16:47:00.000Z';
const CHECK = '2026-09-01T16:47:02.000Z';

const BASE_DOC = {
  id: 'ab-1',
  // `handleShowIt` refuses without BOTH ids — they are what it posts.
  agentId: 'agent-1',
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
  directive: null,
  opponent: { portfolio: { star: [{ symbol: 'AMD' }], core: [], support: [] } },
  evaluations: [{
    evalId: 'eval_005', timestamp: CHECK, decision: 'HOLD', haikuError: null,
    rationale: 'Holding the book. SLB is steady into the afternoon.',
  }],
  trades: [],
  statusFeed: [],
  chatExchanges: [],
};

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

/** A research card, as the route writes it — what the subscription delivers. */
const researchExchange = (symbol) => ({
  messageType: 'research', researchId: `r-${symbol}`, symbol, agentId: 'agent-1',
  card: { symbol, sections: [] }, agentResponse: '', suggestedActions: null,
  timestamp: '2026-09-01T17:00:05.000Z',
});

let container;
let root;
let fetchCalls;

beforeEach(() => {
  DOC = BASE_DOC;
  fetchCalls = [];
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
  vi.unstubAllGlobals();
});

/**
 * Stub `fetch` with one outcome for THE RESEARCH ROUTE. `throws` models a
 * request that never came back; everything else models a response, `body` being
 * what the route sent.
 *
 * Routed by URL, and only research calls are recorded: the screen also posts to
 * `/api/agent/ensure-opener` on mount, and a stub that answered every URL the
 * same way would both mis-count the taps and fail an unrelated request.
 */
const stubFetch = ({ ok = false, status = 500, body = {}, throws = false } = {}) => {
  fetchCalls = [];
  vi.stubGlobal('fetch', vi.fn(async (url, init) => {
    if (url !== '/api/agent/research') return { ok: true, status: 200, json: async () => ({}) };
    fetchCalls.push({ url, body: JSON.parse(init.body) });
    if (throws) throw new TypeError('Failed to fetch');
    return { ok, status, json: async () => body };
  }));
};

const mount = () => act(() => {
  root.render(<AgentBattleScreen battle={BATTLE} user={{ uid: 'u1' }} onBack={() => {}} onOpenFilmRoom={null} />);
});

/** Open the Why? panel on a held row, where the panel's door lives. */
const openWhyFor = (symbol) => {
  const row = [...container.querySelectorAll('[role="button"][aria-expanded]')]
    .find((el) => (el.textContent || '').includes(symbol) && el.querySelector('[data-why-label]'));
  expect(row, `a player row for ${symbol} with a Why? door`).toBeTruthy();
  act(() => { row.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); });
};

const panelDoor = (s) => container.querySelector(`[data-why-showit="${s}"]`);
const panelError = (s) => container.querySelector(`[data-why-showit-error="${s}"]`);
const benchChip = (s) => container.querySelector(`[data-bench-chip="${s}"][data-bench-chip-door="showit"]`);
const benchError = (s) => container.querySelector(`[data-bench-showit-error="${s}"]`);

/** Tap and let the handler's awaits settle. */
const tap = async (el) => {
  await act(async () => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
};

// ── The panel's door ────────────────────────────────────────────────────────

describe('the Why? panel door, tapped for real', () => {
  it('an ATTESTED refusal paints the cost clause — and the tap reached the route', async () => {
    stubFetch({ ok: false, status: 409, body: { noCardWritten: true, status: 'research_exhausted' } });
    mount();
    openWhyFor('SLB');
    expect(panelDoor('SLB'), 'the door under the lit flag').toBeTruthy();
    expect(panelError('SLB')).toBeNull();

    await tap(panelDoor('SLB'));

    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0].url).toBe('/api/agent/research');
    expect(fetchCalls[0].body).toEqual({ agentId: 'agent-1', battleId: 'ab-1', symbol: 'SLB' });
    expect(panelError('SLB'), 'the failure line').toBeTruthy();
    expect(panelError('SLB').textContent).toBe(RESEARCH_FAILED_LINE);
    expect(panelError('SLB').getAttribute('data-why-showit-attested')).toBe('true');
  });

  it('an UNATTESTED refusal takes the claimless line — the body decides, not the status', async () => {
    // The three A1 shapes reach the client as a non-2xx with no attestation:
    // a retried transaction's 409, a 500 thrown after the commit landed, and a
    // platform 504 with no body of ours at all.
    for (const failure of [
      { ok: false, status: 409, body: { status: 'research_exhausted' } },
      { ok: false, status: 500, body: { error: 'Research failed' } },
      { ok: false, status: 504, body: null },
    ]) {
      stubFetch(failure);
      mount();
      openWhyFor('SLB');
      await tap(panelDoor('SLB'));
      expect(panelError('SLB').textContent, `status ${failure.status}`).toBe(RESEARCH_UNREACHABLE_LINE);
      expect(panelError('SLB').textContent).not.toContain('use spent');
      expect(panelError('SLB').getAttribute('data-why-showit-attested')).toBe('false');
      act(() => root.unmount());
      container.remove();
      container = document.createElement('div');
      document.body.appendChild(container);
      root = createRoot(container);
    }
  });

  it('a request that NEVER CAME BACK takes the claimless line too', async () => {
    stubFetch({ throws: true });
    mount();
    openWhyFor('SLB');
    await tap(panelDoor('SLB'));
    expect(panelError('SLB').textContent).toBe(RESEARCH_UNREACHABLE_LINE);
    expect(panelError('SLB').getAttribute('data-why-showit-attested')).toBe('false');
  });

  it('THE TWO SENTENCES ARE DIFFERENT, through the real handler', async () => {
    // The pair that proves the split is live rather than merely declared: one
    // fixture attested, one not, everything else identical.
    stubFetch({ ok: false, status: 500, body: { noCardWritten: true } });
    mount();
    openWhyFor('SLB');
    await tap(panelDoor('SLB'));
    const attested = panelError('SLB').textContent;

    act(() => root.unmount());
    container.remove();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    stubFetch({ ok: false, status: 500, body: {} });
    mount();
    openWhyFor('SLB');
    await tap(panelDoor('SLB'));
    expect(panelError('SLB').textContent).not.toBe(attested);
  });

  it('the line CLEARS on the next tap, and the door stays the retry', async () => {
    // The C2 defect lives here: a stray clear in the handler's `finally` batches
    // with the set and no render ever paints. The first assertion below is what
    // catches it; the rest is the clearing contract.
    stubFetch({ ok: false, status: 500, body: { noCardWritten: true } });
    mount();
    openWhyFor('SLB');
    await tap(panelDoor('SLB'));
    expect(panelError('SLB')).toBeTruthy();
    expect(panelDoor('SLB').disabled, 'the door is still tappable').toBe(false);

    // A second tap that succeeds: the line goes as the tap starts and stays gone.
    stubFetch({ ok: true, status: 200, body: { status: 'shown' } });
    await tap(panelDoor('SLB'));
    expect(panelError('SLB')).toBeNull();
    expect(fetchCalls).toHaveLength(1);   // the fresh stub's own count
  });

  it('the door DESCRIBES the failure, so tabbing back to it reaches the line', async () => {
    stubFetch({ ok: false, status: 500, body: { noCardWritten: true } });
    mount();
    openWhyFor('SLB');
    expect(panelDoor('SLB').getAttribute('aria-describedby')).toBeNull();
    await tap(panelDoor('SLB'));
    const described = panelDoor('SLB').getAttribute('aria-describedby');
    expect(described).toBeTruthy();
    expect(container.querySelector(`#${described}`)).toBe(panelError('SLB'));
  });

  it('the failure belongs to the NAME it was about — another piece says nothing', async () => {
    stubFetch({ ok: false, status: 500, body: { noCardWritten: true } });
    mount();
    openWhyFor('SLB');
    await tap(panelDoor('SLB'));
    expect(panelError('SLB')).toBeTruthy();
    // AAPL's own panel carries no line for SLB's failure.
    openWhyFor('AAPL');
    expect(panelError('AAPL')).toBeNull();
  });
});

// ── The bench chip's door ───────────────────────────────────────────────────

describe('the bench chip door, tapped for real', () => {
  it('paints ONE line for the tapped name, and the chip keeps its element', async () => {
    stubFetch({ ok: false, status: 409, body: { noCardWritten: true } });
    mount();
    const before = benchChip('NOW');
    expect(before, 'the bench chip under the lit flag').toBeTruthy();
    expect(before.tagName).toBe('BUTTON');

    await tap(before);

    expect(fetchCalls[0].body.symbol).toBe('NOW');
    expect(container.querySelectorAll('[data-bench-showit-error]')).toHaveLength(1);
    expect(benchError('NOW').textContent).toBe(RESEARCH_FAILED_LINE);
    // B4: the chip is the SAME NODE it was — the failure is a sibling, not a
    // wrapper, so a keyboard user's focus is not dumped to <body>.
    expect(benchChip('NOW')).toBe(before);
    expect(benchChip('NOW').tagName).toBe('BUTTON');
    // …and the chip points at the line, which is how focus reaches it.
    expect(benchChip('NOW').getAttribute('aria-describedby'))
      .toBe(benchError('NOW').getAttribute('id'));
  });

  it('the other bench names say nothing about it', async () => {
    stubFetch({ ok: false, status: 409, body: { noCardWritten: true } });
    mount();
    await tap(benchChip('NOW'));
    expect(benchError('NOW')).toBeTruthy();
    expect(benchError('TSLA')).toBeNull();
    expect(benchChip('TSLA').getAttribute('aria-describedby')).toBeNull();
  });

  it('an unattested failure on the bench takes the claimless line too', async () => {
    stubFetch({ throws: true });
    mount();
    await tap(benchChip('NOW'));
    expect(benchError('NOW').textContent).toBe(RESEARCH_UNREACHABLE_LINE);
    expect(benchError('NOW').getAttribute('data-bench-showit-attested')).toBe('false');
  });
});

// ── The record retires the line (§2 review, A4/B8) ──────────────────────────

describe('the subscribed record clears a line it refutes', () => {
  it('the count moving retires the failure — the card landed, whatever the line said', async () => {
    // Exactly the A1 state: an unattested refusal, and then the card arrives
    // through the subscription anyway. `no use spent` beside a door that has
    // advanced is false; so is `didn't come back` beside the card that did.
    stubFetch({ ok: false, status: 500, body: { noCardWritten: true } });
    mount();
    openWhyFor('SLB');
    await tap(panelDoor('SLB'));
    expect(panelError('SLB')).toBeTruthy();
    expect(panelDoor('SLB').textContent).toBe('Show it · 1 of 3');

    // The subscription delivers the card the tap did not think it wrote.
    DOC = { ...BASE_DOC, chatExchanges: [researchExchange('SLB')] };
    mount();

    expect(panelDoor('SLB').textContent, 'the count moved').toBe('Show it · 2 of 3');
    expect(panelError('SLB'), 'and the line went with it').toBeNull();
  });

  it('a different battle retires it too', async () => {
    stubFetch({ ok: false, status: 500, body: { noCardWritten: true } });
    mount();
    openWhyFor('SLB');
    await tap(panelDoor('SLB'));
    expect(panelError('SLB')).toBeTruthy();

    DOC = { ...BASE_DOC, id: 'ab-2' };
    mount();
    expect(panelError('SLB')).toBeNull();
  });
});
