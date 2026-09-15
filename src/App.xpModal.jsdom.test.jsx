// @vitest-environment jsdom
//
// src/App.xpModal.jsdom.test.jsx
//
// A1 — THE XP MODAL'S FOUR OUT-OF-SCOPE IDENTIFIERS, MOUNTED.
//
// The lint cleanup (docs/audits/20260913_LINT_NODE_GLOBALS.md §7 A1) surfaced
// four `no-undef` errors in src/App.jsx: `xpForNextLevel`, `xpProgress`,
// `xpNeeded` and `nextRank` are read by the app-level XP progress modal but
// were declared ~1,800 lines away inside `getScreenContent`'s dashboard branch
// — a SIBLING scope. At the point of use they are not in the scope chain, so
// the modal threw a ReferenceError and unmounted the whole React tree the
// instant it painted.
//
// The player path: log in -> dashboard -> the desktop bottom stats bar
// (gated `user && screen === 'dashboard'`, App.jsx:12218) -> click the Rank
// chip (App.jsx:12259), which calls `setShowXPModal(true)`. A live, reachable
// control, not a dev route.
//
// WHY THIS FILE IS THE FIRST TEST TO IMPORT App.jsx. It is — BUILD_RULES §2
// records that "no test in the repo imports App.jsx, so a syntax error there
// passes the entire suite". That is exactly why a ReferenceError on a live
// render path could sit in main unnoticed.
//
// SHOWN FAILING FIRST: against the pre-fix tree both rows fail with
//   ReferenceError: xpForNextLevel is not defined
// thrown from the modal's JSX. Against the fixed tree they render and the four
// values are the ones the code intends.
//
// The mocks below are the app's I/O edges only — Firebase, the price API, the
// WebSocket bridge, the agent subscription, `fetch`. Nothing about the XP
// modal, its state, or its arithmetic is mocked: that is the code under test.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

// ── Firebase: no SDK, no sockets, no retry loops ─────────────────────────
vi.mock('./firebase/config', () => ({ db: {}, auth: {}, default: {} }));
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({ currentUser: { uid: 'u1', getIdToken: async () => 'tok' } })),
  onAuthStateChanged: vi.fn(() => () => {}),
}));
vi.mock('firebase/firestore', () => {
  const unsub = () => {};
  return {
    getFirestore: vi.fn(() => ({})),
    collection: vi.fn(() => ({})),
    doc: vi.fn(() => ({})),
    query: vi.fn(() => ({})),
    where: vi.fn(() => ({})),
    orderBy: vi.fn(() => ({})),
    limit: vi.fn(() => ({})),
    onSnapshot: vi.fn(() => unsub),
    getDoc: vi.fn(async () => ({ exists: () => false, data: () => null })),
    getDocs: vi.fn(async () => ({ docs: [], empty: true, forEach: () => {} })),
    setDoc: vi.fn(async () => {}),
    addDoc: vi.fn(async () => ({ id: 'x' })),
    updateDoc: vi.fn(async () => {}),
    deleteDoc: vi.fn(async () => {}),
    serverTimestamp: vi.fn(() => new Date(0)),
    Timestamp: { now: () => ({ toDate: () => new Date(0) }), fromDate: (d) => ({ toDate: () => d }) },
    writeBatch: vi.fn(() => ({ set: vi.fn(), update: vi.fn(), delete: vi.fn(), commit: vi.fn(async () => {}) })),
    arrayUnion: vi.fn((...a) => a),
    arrayRemove: vi.fn((...a) => a),
    increment: vi.fn((n) => n),
    runTransaction: vi.fn(async () => {}),
  };
});

// The thirteen named exports App.jsx pulls from firebaseService (App.jsx:12).
// Every subscribe* must hand back an unsubscribe function or teardown throws.
vi.mock('./firebase/firebaseService', () => ({
  createBattle: vi.fn(async () => ({})),
  joinBattle: vi.fn(async () => ({})),
  subscribeToBattles: vi.fn(() => () => {}),
  createBaggerBombBattle: vi.fn(async () => ({})),
  createBaggerBombBattleV3: vi.fn(async () => ({})),
  createBaggerBombBattleV4: vi.fn(async () => ({})),
  joinBaggerBombBattle: vi.fn(async () => ({})),
  joinBaggerBombBattleV3: vi.fn(async () => ({})),
  joinBaggerBombBattleV4: vi.fn(async () => ({})),
  subscribeToLobby: vi.fn(() => () => {}),
  subscribeToAllLobbies: vi.fn(() => () => {}),
  getOpenBaggerBombBattles: vi.fn(async () => []),
  completeBattle: vi.fn(async () => ({})),
}));

// ── Market data: the nine named exports App.jsx pulls (App.jsx:14) ───────
// vi.hoisted, because vi.mock factories are hoisted above module scope and
// cannot close over an ordinary top-level const.
const { stockAPIStub, USER } = vi.hoisted(() => ({
  stockAPIStub: {
    getStockPrice: async () => null,
    getMultipleStockPrices: async () => ({}),
    getCryptoPrice: async () => null,
    getMultipleCryptoPrices: async () => ({}),
    searchStocks: async () => [],
    getQuote: async () => null,
    getPopularStocks: async () => [],
  },
  // The authenticated user the modal reads. Level 3 "Trader", 6,000 XP —
  // chosen so all four values are distinct and non-trivial: 60% progress,
  // 4,000 XP needed, next rank "Expert".
  //
  // "Trader" IS NOT A RANK THE APP CAN ASSIGN, and that is not an oversight
  // in the fixture — it is a defect in the modal, recorded for separate
  // tasking. determineRank (services/battleTimer.js:265-270) only ever
  // returns Beginner / Veteran / Expert / Master, and new accounts start at
  // 'Beginner' (firebase/authService.js:72); the modal carries its own
  // six-rung ladder (App.jsx `ranks`) that shares only Expert and Master with
  // it. So for a real account `indexOf` returns -1 and the modal names
  // "Rookie" as the next rank. This file exists to guard the SCOPE fix — that
  // the modal renders at all instead of throwing a ReferenceError — and it
  // asserts what the modal's own code intends. It deliberately does not pin
  // the ladder, which is a BUILD_RULES §9 display-agreement fix with a
  // product decision in it (what the rungs are, what "XP to next" means above
  // 10,000 XP, where Master caps).
  USER: {
    uid: 'u1',
    id: 'u1',
    username: 'tester',
    email: 'tester@example.com',
    xp: 6000,
    level: 3,
    rank: 'Trader',
    wins: 7,
    losses: 2,
  },
}));

vi.mock('./services/eodhdAPI', () => ({
  stockAPI: stockAPIStub,
  POPULAR_CRYPTO: [],
  FALLBACK_CRYPTO_PRICES: {},
  getMarketNews: vi.fn(async () => []),
  getTopMoversWithNews: vi.fn(async () => ({ gainers: [], losers: [] })),
  getMultipleStockNews: vi.fn(async () => ({})),
  getStockNews: vi.fn(async () => []),
  fetchLatestEarnings: vi.fn(async () => null),
  fetchHistoricalOHLCV: vi.fn(async () => []),
}));
vi.mock('./services/wsCacheBridge', () => ({ startWsCacheBridge: vi.fn(() => () => {}) }));

vi.mock('./contexts/UserContext', () => ({
  useUser: () => ({
    user: USER,
    login: vi.fn(), register: vi.fn(), loginWithGoogle: vi.fn(),
    logout: vi.fn(), updateUser: vi.fn(), forgotPassword: vi.fn(),
    loading: false, authLoading: false,
  }),
  UserProvider: ({ children }) => children,
}));

// Past the onboarding gate (App.jsx:10005-10016): an authenticated user with
// no agent is routed to OnboardingExperience and never reaches the main shell
// that holds the modal.
vi.mock('./hooks/useAgent', () => ({
  default: () => ({
    agent: { id: 'a1', name: 'Aurora', archetype: 'degen' },
    hasAgent: true,
    loading: false,
  }),
}));

// Desktop: the stats bar carrying the Rank chip is `hidden md:flex`.
vi.mock('./hooks/useIsMobile', () => ({
  useIsMobile: () => ({ isMobile: false, isTablet: false }),
}));

import PortfolioDuel from './App';
// The real providers main.jsx wraps App in (src/main.jsx:25-33), minus the
// outer ErrorBoundary. Leaving the boundary off is deliberate: in production
// it CATCHES the ReferenceError and swaps the whole app for the error screen
// (which is what "unmounts the tree" looks like to a player). Omitting it here
// lets the error surface as a test failure with its own stack instead of being
// silently absorbed into a passing render of the fallback UI.
import { ThemeProvider } from './contexts/ThemeContext';
import { FantasyTimesProvider } from './contexts/FantasyTimesContext';

const Mounted = () => (
  <ThemeProvider>
    <FantasyTimesProvider>
      <PortfolioDuel />
    </FantasyTimesProvider>
  </ThemeProvider>
);

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};

let container;
let root;

beforeEach(() => {
  // No test in this file should reach the network; if one does, fail loudly
  // rather than hang on a real socket.
  vi.stubGlobal('fetch', vi.fn(async () => {
    throw new Error('unexpected network call from the XP modal path');
  }));
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => { root.unmount(); });
  container.remove();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

/** The Rank chip in the desktop bottom stats bar — the player's way in. */
const rankChip = () =>
  Array.from(container.querySelectorAll('button')).find(
    (b) => b.textContent.includes('Trader') && b.textContent.includes('Lvl 3')
  );

describe('A1 — the app-level XP progress modal', () => {
  it('renders the four computed values when the player clicks the Rank chip', async () => {
    await act(async () => { root.render(<Mounted />); });

    const chip = rankChip();
    expect(chip, 'the Rank chip in the desktop bottom stats bar').toBeTruthy();

    // THE MOMENT OF THE DEFECT. Pre-fix this click evaluates the modal's JSX,
    // which reads four identifiers that are not in its scope chain.
    await act(async () => { chip.click(); });

    const text = container.textContent;

    // xpForNextLevel — the denominator, rendered verbatim beside user.xp.
    expect(text).toContain('6000 / 10000 XP');
    // xpNeeded — 10000 - 6000.
    expect(text).toContain('4000 XP to next rank');
    // nextRank — the entry after 'Trader' in the ranks ladder.
    expect(text).toContain('Expert');
  }, 120000);

  it('drives the XP bar width from xpProgress', async () => {
    await act(async () => { root.render(<Mounted />); });
    await act(async () => { rankChip().click(); });

    // (6000 / 10000) * 100 = 60. Assert on the bar's own node rather than the
    // container text, so the row cannot pass on a coincidental "60" elsewhere.
    // The bar is a framer-motion div animating `width` from 0 to
    // `${xpProgress}%` over 0.8s (App.jsx:10555). Let it settle rather than
    // stubbing framer out: stubbing `motion` app-wide would change how dozens
    // of unrelated components in this tree render.
    await act(async () => { await new Promise((r) => setTimeout(r, 1400)); });

    const widths = Array.from(container.querySelectorAll('div'))
      .map((d) => d.style.width)
      .filter(Boolean);

    // (6000 / 10000) * 100 = 60. Assert on the bar's own node rather than the
    // container text, so the row cannot pass on a coincidental "60" elsewhere.
    expect(widths, 'the XP progress bar settled at 60% width').toContain('60%');
  }, 120000);
});
