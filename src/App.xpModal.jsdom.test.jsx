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
    getPopularCrypto: async () => [],
  },
  // The authenticated user the modal reads. Level 3 Expert on 2,000 XP —
  // an (xp, rank) pair the game can actually produce: determineRank(2000)
  // IS 'Expert' (services/battleTimer.js). Chosen so every derived value is
  // distinct and non-trivial: 20% bar, 3,000 XP to the next rung, next rung
  // 'Master'.
  //
  // This fixture used to be `{ xp: 6000, rank: 'Trader' }`, a pair the app
  // cannot produce, because the modal carried its own six-rung ladder that
  // shared only two rungs with the real one (record §8 F1 / F4). That ladder
  // is gone: the modal now reads the rungs and thresholds from the same
  // module that ASSIGNS a rank, so the fixture has to be honest too.
  USER: {
    uid: 'u1',
    id: 'u1',
    username: 'tester',
    email: 'tester@example.com',
    xp: 2000,
    level: 3,
    rank: 'Expert',
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

// Mutable so a row can drop the user mid-session the way a failed
// getUserData read does (firebase/authService.js:265 delivers it as a
// sign-out). Reset in beforeEach.
const session = vi.hoisted(() => ({ user: null }));

vi.mock('./contexts/UserContext', () => ({
  useUser: () => ({
    user: session.user,
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
  session.user = USER;
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

/**
 * The Rank chip in the desktop bottom stats bar — the player's way in.
 * Matched on '(Lvl ' rather than on a rank name, so the ladder rows below
 * can drive it with any rank without the selector needing to know which.
 */
const rankChip = () =>
  Array.from(container.querySelectorAll('button')).find((b) =>
    b.textContent.includes('(Lvl ')
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
    /** Trimmed text of every element matching `sel` — for EXACT comparisons. */
    const texts = (sel) =>
      Array.from(container.querySelectorAll(sel)).map((n) => n.textContent.trim());

    // xpForNextLevel — the denominator, rendered verbatim beside user.xp.
    expect(text).toContain('2000 / 10000 XP');

    // xpNeeded — 10000 - 6000. Asserted as the EXACT text of its own <p>, not
    // as a substring of the container: the mutation pass (§7.4 M4) showed a
    // `toContain` here survives flipping the subtraction, because the mutant
    // renders '-4000 XP to next rank', which still CONTAINS the expected
    // string. An exact element match kills that mutant.
    expect(texts('p')).toContain('3000 XP to next rank');

    // The next rung above Expert on the real ladder. Also exact: a substring
    // match over the whole app's text is not something to rely on.
    expect(texts('p')).toContain('Master');
  }, 120000);

  it('drives the XP bar width from xpProgress', async () => {
    await act(async () => { root.render(<Mounted />); });

    const chip = rankChip();
    expect(chip, 'the Rank chip in the desktop bottom stats bar').toBeTruthy();
    await act(async () => { chip.click(); });

    // The bar is a framer-motion div animating `width` from 0 to
    // `${xpProgress}%` over 0.8s. Let it settle rather than stubbing framer
    // out: stubbing `motion` app-wide would change how dozens of unrelated
    // components in this tree render. Measured: the bar reaches 60% at
    // t~810ms and holds, so 1400ms carries ~590ms of slack.
    await act(async () => { await new Promise((r) => setTimeout(r, 1400)); });

    const widths = Array.from(container.querySelectorAll('div'))
      .map((d) => d.style.width)
      .filter(Boolean);

    // (2000 / 10000) * 100 = 20. Assert on the bar's own node rather than the
    // container text, so the row cannot pass on a coincidental "20" elsewhere.
    expect(widths, 'the XP progress bar settled at 20% width').toContain('20%');
  }, 120000);

  // Found by the §2 review (lens A A-3, lens C C-1) while this fix was in
  // flight. The modal reads user.rank / user.level / user.xp unguarded, and
  // was gated on `showXPModal` alone — which nothing resets on sign-out. So
  // a user going null WHILE THE MODAL IS OPEN threw a TypeError and unmounted
  // the tree: the same crash class A1 exists to remove, through the same
  // modal, one input away from the one A1's own guards already handle.
  it('survives the user going null while the modal is open', async () => {
    await act(async () => { root.render(<Mounted />); });

    const chip = rankChip();
    expect(chip, 'the Rank chip in the desktop bottom stats bar').toBeTruthy();
    await act(async () => { chip.click(); });
    expect(container.textContent).toContain('2000 / 10000 XP');

    // A failed getUserData read, delivered as a sign-out, with the modal up.
    session.user = null;
    await act(async () => { root.render(<Mounted />); });

    // Pre-fix: TypeError: Cannot read properties of null (reading 'rank').
    // Post-fix: the modal simply stops rendering and the app stays mounted.
    expect(container.textContent).not.toContain('2000 / 10000 XP');
  }, 120000);
});


// ─────────────────────────────────────────────────────────────────────────
// F1 / F4 — ONE LADDER, AND THE MODAL READS IT.
//
// The record's §8 F1 table, row for row. Before this fix the modal carried
// its own six-rung literal (Rookie / Apprentice / Trader / Expert / Master /
// Legend) that shared only two rungs with the one the game assigns
// (Beginner / Veteran / Expert / Master, services/battleTimer.js). So
// `indexOf(user.rank)` returned -1 for the two commonest production ranks
// and the modal named 'Rookie' as the next rung; above 10,000 XP the
// "XP to next rank" figure counted DOWN past zero and the bar animated past
// 100%.
//
// Each row is a real (xp, determineRank(xp)) pair. Every one asserts the
// EXACT rendered string, never toContain — the mutation pass (record §7.4
// M4) showed a substring match passes for a negated value, which is the
// precise defect these rows exist to catch.
//
// Founder ruling on the top rung: at max rank the modal shows
// "Max rank reached" — no next-rung label, no XP-to-next number, bar full.

const LADDER_ROWS = [
  { xp: 0,     rank: 'Beginner', next: 'Veteran', xpToNext: 500,  bar: '0%' },
  { xp: 500,   rank: 'Veteran',  next: 'Expert',  xpToNext: 1500, bar: '5%' },
  { xp: 1999,  rank: 'Veteran',  next: 'Expert',  xpToNext: 1,    bar: '19.99%' },
  { xp: 2000,  rank: 'Expert',   next: 'Master',  xpToNext: 3000, bar: '20%' },
  { xp: 5000,  rank: 'Master',   next: null,      xpToNext: null, bar: '100%' },
  { xp: 12000, rank: 'Master',   next: null,      xpToNext: null, bar: '100%' },
];

describe('F1/F4 — the XP modal reads the ladder the game assigns', () => {
  /** Open the modal for a given (xp, rank) pair and hand back what it shows. */
  const openModalFor = async ({ xp, rank }) => {
    session.user = { ...USER, xp, rank };
    await act(async () => { root.render(<Mounted />); });
    const chip = rankChip();
    expect(chip, 'the Rank chip in the desktop bottom stats bar').toBeTruthy();
    await act(async () => { chip.click(); });
    // Let the bar's framer animation settle before reading its width.
    await act(async () => { await new Promise((r) => setTimeout(r, 1400)); });
    return {
      headings: Array.from(container.querySelectorAll('h2')).map((n) => n.textContent.trim()),
      paras: Array.from(container.querySelectorAll('p')).map((n) => n.textContent.trim()),
      widths: Array.from(container.querySelectorAll('div'))
        .map((d) => d.style.width)
        .filter(Boolean),
    };
  };

  // Kills the mutant that points the heading back at the persisted
  // `user.rank` (record §F1-A, N8). Every other row feeds a consistent
  // (xp, rank) pair — which is all the app ever writes, since settlement
  // sets rank = determineRank(xp) at App.jsx:5453 — so no other row can
  // tell the two sources apart. This one feeds an INCONSISTENT pair and
  // pins the §9 binding: what the modal says about rank is derived from
  // xp, the same input the number beside it comes from.
  it('derives the heading from XP, not from a stale persisted rank', async () => {
    const { headings, paras } = await openModalFor({ xp: 5000, rank: 'Beginner' });
    expect(headings, 'the assigned rank for 5000 XP').toContain('Master');
    expect(headings, 'not the stale persisted field').not.toContain('Beginner');
    expect(paras, 'and the rest of the modal agrees with it').toContain('Max rank reached');
  }, 120000);

  for (const row of LADDER_ROWS) {
    const label = row.next
      ? `${row.xp} XP is ${row.rank}, ${row.xpToNext} from ${row.next}`
      : `${row.xp} XP is ${row.rank} — max rank`;

    it(label, async () => {
      const { headings, paras, widths } = await openModalFor(row);

      // The heading is the rank the GAME assigns, not a rung from a private
      // ladder. Exact match: 'Master' must not be satisfied by 'Max rank'.
      expect(headings, 'the modal heading names the assigned rank')
        .toContain(row.rank);

      if (row.next) {
        expect(paras, 'the XP-to-next-rung figure')
          .toContain(`${row.xpToNext} XP to next rank`);
        expect(paras, 'the next rung on the assigned ladder').toContain(row.next);
        expect(paras, 'a non-max rank must not claim to be maxed')
          .not.toContain('Max rank reached');
      } else {
        // Founder ruling: no label, no number, at the top rung.
        expect(paras, 'the max-rank line').toContain('Max rank reached');
        expect(
          paras.filter((t) => t.includes('XP to next rank')),
          'no XP-to-next line at max rank'
        ).toEqual([]);
      }

      // THE TWO THINGS THE OLD LADDER GOT WRONG, asserted on every row:
      // never a negative figure, never a bar past 100%.
      expect(
        paras.filter((t) => /-\d/.test(t) && t.includes('XP to next rank')),
        'no negative XP-to-next figure'
      ).toEqual([]);
      expect(widths, 'the bar settled at its expected width').toContain(row.bar);
      for (const w of widths) {
        if (w.endsWith('%')) {
          expect(parseFloat(w), `no width above 100% (saw ${w})`).toBeLessThanOrEqual(100);
        }
      }
    }, 120000);
  }
});
