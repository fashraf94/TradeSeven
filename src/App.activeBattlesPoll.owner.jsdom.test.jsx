// @vitest-environment jsdom
//
// src/App.activeBattlesPoll.owner.jsdom.test.jsx
//
// Command Center slice S3 (ruling R-S3-3) — App's active-battle list across an
// identity change, driven through the real App: mounted with the hub OFF, the
// legacy desktop shell replaced by a probe that records the
// `activeAgentBattles` App hands it and the handlers it passes, Firebase auth
// at its edge (the App.xpModal.jsdom.test.jsx harness).
//
// FIREBASE BY REDIRECT, NOT FACTORY. App's effects import firebase/firestore and
// ./firebase/config dynamically from many places in one mount flush; with a
// FACTORY mock, vitest's module runner lets an import that overlaps another of
// the same mocked module from the same importer fall through to the REAL
// module (the real config throws without Firebase env; review T2-8). The bare
// `vi.mock`s below load the redirect mocks (src/firebase/__mocks__/config.js,
// __mocks__/firebase/firestore.js) as ordinary modules, so every one of App's
// imports gets them, and each row programs the owner + active query: it fails
// (the parity and clear rows) or waits for the row to answer it (the stale
// completion rows). Runs are counted where they begin and settle — each App
// instance's run bookkeeping (createActivePollFlights), wrapped below — and a
// row waits for its runs to settle before it reads what they left.
//
// The rows seed the list the way a deploy does — R1's optimistic entry through
// the shell's own onCreateAgentBattle, no read — and pin:
//   parity   the poll runs at mount and once per 120 s and nowhere else; a
//            failed run keeps the list as it was; the same owner's identity
//            answering again changes nothing;
//   defects  rows that fail on the pre-S3 App: an account switch or a
//            sign-out leaves the former owner's games in place; a query of
//            owner A answered after A→B, A→B→A or a sign-out lands its list.
// Against the base App (ff6248d1) the review ran base-compatible copies of
// these rows: the parity rows pass there and the defect rows fail
// (docs/audits/20261022_BUILD_COMMAND_CENTER_HUB_S3.md, the review record).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

vi.setConfig({ testTimeout: 60000 });

const fb = vi.hoisted(() => ({
  auth: null,              // the redirect config's own `auth` (set below), so the poll and the observers agree
  authListeners: [],
  pollQueries: [],         // every owner + active query a row asked to answer itself
}));

vi.mock('./firebase/config');
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => fb.auth),
  // Firebase answers a new observer with the current user; this one does so at once.
  onAuthStateChanged: vi.fn((auth, callback) => {
    fb.authListeners.push(callback);
    callback(fb.auth.currentUser);
    return () => {};
  }),
}));
vi.mock('firebase/firestore');

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
  USER: { uid: 'uid-A', id: 'uid-A', odUserId: 'uid-A', username: 'tester', email: 'tester@example.com', xp: 2000, level: 3, rank: 'Expert', wins: 7, losses: 2 },
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
vi.mock('./hooks/useAgent', () => ({
  default: () => ({ agent: { id: 'a1', name: 'Aurora', archetype: 'degen' }, hasAgent: true, loading: false }),
}));
vi.mock('./hooks/useIsMobile', () => ({ useIsMobile: () => ({ isMobile: false, isTablet: false }) }));

// Each App instance's poll runs, counted where they begin and settle (App's one
// run bookkeeping, unchanged underneath): `started`, `settled`, `failed`.
const polls = vi.hoisted(() => []);
vi.mock('./utils/activeBattlesPoll', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    createActivePollFlights: (callbacks) => {
      const flights = real.createActivePollFlights(callbacks);
      const runs = { started: 0, settled: 0, failed: 0 };
      polls.push(runs);
      return {
        ...flights,
        begin: (...args) => { runs.started += 1; return flights.begin(...args); },
        settle: (flight, outcome) => {
          if (flight && !flight.settled) {
            runs.settled += 1;
            if (outcome?.ok === false) runs.failed += 1;
          }
          flights.settle(flight, outcome);
        },
      };
    },
  };
});

// The legacy desktop shell App renders with the hub off: a probe of what App hands it.
const shell = vi.hoisted(() => ({ lists: [], props: null }));
vi.mock('./components/Dashboard/CommandDashboardDesktop', () => ({
  default: function CommandDashboardDesktopProbe(props) {
    shell.lists.push(props.activeAgentBattles);
    shell.props = props;
    return null;
  },
}));

import { auth as configAuth } from './firebase/config';
import * as firestore from 'firebase/firestore';
import PortfolioDuel from './App';
import { ThemeProvider } from './contexts/ThemeContext';
import { FantasyTimesProvider } from './contexts/FantasyTimesContext';
import { resetAuthIdentityForTests } from './services/authIdentity';

fb.auth = configAuth;

const isPollQuery = (q) => q?.collection === 'agentBattles'
  && q.clauses?.some((c) => c.field === 'ownerId')
  && q.clauses.some((c) => c.field === 'status' && c.value === 'active');
const EMPTY = Object.freeze({ docs: [], empty: true, size: 0, forEach: () => {} });
/** The owner + active query fails: the parity and clear rows. */
const failPollQueries = () => firestore.getDocs.mockImplementation(async (q) => {
  if (isPollQuery(q)) throw new Error('the owner + active query fails in this test');
  return EMPTY;
});
/** The owner + active query waits for the row to answer it: the stale completion rows. */
const deferPollQueries = () => firestore.getDocs.mockImplementation((q) => {
  if (!isPollQuery(q)) return Promise.resolve(EMPTY);
  const owner = q.clauses.find((c) => c.field === 'ownerId').value;
  return new Promise((resolve, reject) => { fb.pollQueries.push({ owner, resolve, reject, settled: false }); });
});

const Mounted = () => (
  <ThemeProvider>
    <FantasyTimesProvider>
      <PortfolioDuel />
    </FantasyTimesProvider>
  </ThemeProvider>
);

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};

const flush = async (turns = 6) => {
  for (let i = 0; i < turns; i += 1) {
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  }
};
/** Real time (a row fakes only setInterval/clearInterval), in act, until `done()` — false past the cap. */
async function waitUntil(done, capMs = 20_000) {
  const start = Date.now();
  while (!done()) {
    if (Date.now() - start > capMs) return false;
    await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
  }
  return true;
}
const latest = () => shell.lists[shell.lists.length - 1];
/** The mounted App's poll runs. */
const poll = () => polls[polls.length - 1];
/** Every run the App started has settled (its lazy imports done, its request failed or skipped). */
async function runsSettle() {
  expect(await waitUntil(() => poll().settled === poll().started), 'every poll run settled').toBe(true);
}

/** Another account the way Firebase reports it: currentUser first, then the observers. */
async function switchTo(uid) {
  fb.auth.currentUser = uid ? { uid, getIdToken: async () => 'tok' } : null;
  await act(async () => { for (const cb of [...fb.authListeners]) cb(fb.auth.currentUser); });
}

/** A deploy's handoff, the shell's own way: R1's optimistic entry for the signed-in owner. No read. */
async function deployAsTheShellDoes(ownerUid = 'uid-A', id = 'bb_new') {
  await act(async () => {
    await shell.props.onCreateAgentBattle(
      { star: [], core: [], support: [] },
      { stocks: [], crypto: null },
      { agentId: `casual-agent-${ownerUid}`, agentBattleId: id, ownerUid, expiresAt: '2026-10-22T20:00:00.000Z', opponent: null, opponentBench: null },
    );
  });
}

let container;
let root;
let errors;

beforeEach(() => {
  resetAuthIdentityForTests();
  fb.auth.currentUser = { uid: 'uid-A', getIdToken: async () => 'tok' };
  fb.authListeners = [];
  fb.pollQueries = [];
  polls.length = 0;
  shell.lists = [];
  shell.props = null;
  errors = vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('no network in this test'); }));
  failPollQueries();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  // A query a row left unanswered fails now, and a run still on its imports finishes here, not inside the next row.
  for (const q of fb.pollQueries) if (!q.settled) { q.settled = true; q.reject(new Error('the row ended')); }
  if (polls.length) await waitUntil(() => poll().settled === poll().started);
  await act(async () => { root.unmount(); });
  container.remove();
  errors.mockRestore();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

async function mountOnDashboard() {
  await act(async () => { root.render(<Mounted />); });
  await waitUntil(() => shell.props !== null);
  expect(shell.props, 'App reached the dashboard and rendered the legacy desktop shell').not.toBeNull();
}

describe('parity — the signed-in owner\'s list and the poll\'s schedule are today\'s', () => {
  it('the poll runs once at mount and once per 120 s, and nothing else starts it', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    await mountOnDashboard();
    expect(poll().started).toBe(1);
    await runsSettle();
    await act(async () => { vi.advanceTimersByTime(119_999); });
    await flush();
    expect(poll().started).toBe(1);
    await act(async () => { vi.advanceTimersByTime(1); });
    expect(poll().started).toBe(2);
    await act(async () => { vi.advanceTimersByTime(240_000); });
    expect(poll().started).toBe(4);
    await runsSettle();
    // Each run reached its request and failed — on either path of its imports.
    expect(poll().failed).toBe(4);
  });

  it('a deploy\'s entry stays through a failed run: the list is never blanked on an error', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    await mountOnDashboard();
    await runsSettle();
    await deployAsTheShellDoes();
    const seeded = latest();
    expect(seeded.map((b) => b.id)).toEqual(['bb_new']);
    await act(async () => { vi.advanceTimersByTime(120_000); });
    expect(poll().started).toBe(2);
    await runsSettle();
    expect(poll().failed).toBe(2);
    expect(latest()).toBe(seeded);
  });

  it('the hub off, App holds exactly one auth listener: the identity source (R-S3-2; review T1-4)', async () => {
    await mountOnDashboard();
    expect(fb.authListeners).toHaveLength(1);
  });

  it('the same owner\'s identity answering again changes nothing: no clear, no extra run', async () => {
    await mountOnDashboard();
    await deployAsTheShellDoes();
    const seeded = latest();
    const runs = poll().started;
    await act(async () => { for (const cb of [...fb.authListeners]) cb({ uid: 'uid-A' }); });
    await flush();
    expect(latest()).toBe(seeded);
    expect(poll().started).toBe(runs);
  });
});

describe('defects the pre-S3 App has (R-S3-3)', () => {
  it('an account switch clears the former owner\'s games at once, and the poll runs at once for the new owner', async () => {
    await mountOnDashboard();
    await deployAsTheShellDoes('uid-A');
    expect(latest().map((b) => b.id)).toEqual(['bb_new']);
    const runs = poll().started;
    await switchTo('uid-B');
    expect(latest()).toEqual([]);
    expect(poll().started).toBe(runs + 1);
  });

  it('a sign-out clears the former owner\'s games at once', async () => {
    await mountOnDashboard();
    await deployAsTheShellDoes('uid-A');
    await switchTo(null);
    expect(latest()).toEqual([]);
  });
});

/** A battle list as getDocs answers it. */
const docsOf = (owner, ids) => ({
  size: ids.length,
  empty: ids.length === 0,
  forEach: () => {},
  docs: ids.map((id) => ({ id, data: () => ({ ownerId: owner, status: 'active', agentId: `casual-agent-${owner}` }) })),
});
/** Answer a deferred owner + active query, and let its run finish (other runs may still be out). */
async function answer(q, owner, ids) {
  const before = poll().settled;
  q.settled = true;
  await act(async () => { q.resolve(docsOf(owner, ids)); });
  expect(await waitUntil(() => poll().settled > before), 'the answered run settled').toBe(true);
}
const openQuery = (owner) => fb.pollQueries.filter((q) => !q.settled && q.owner === owner).pop();
const ids = () => (latest() || []).map((b) => b.id);

describe('a completion whose capture is no longer current is ignored (R-S3-3; rows that fail on the pre-S3 App)', () => {
  beforeEach(() => { deferPollQueries(); });

  it('A→B while A\'s query is out: its answer never lands; B\'s does', async () => {
    await mountOnDashboard();
    const qa = openQuery('uid-A');
    expect(qa, 'the mount run queried for A').toBeTruthy();
    await switchTo('uid-B');
    await answer(qa, 'uid-A', ['a-late']);
    expect(ids()).toEqual([]);
    const qb = openQuery('uid-B');
    expect(qb, 'the identity change ran the poll for B').toBeTruthy();
    await answer(qb, 'uid-B', ['b-live']);
    expect(ids()).toEqual(['b-live']);
  });

  it('A→B→A while the first A query is out: the A@1 answer is dropped, the A@3 answer lands', async () => {
    await mountOnDashboard();
    const first = openQuery('uid-A');
    await switchTo('uid-B');
    await switchTo('uid-A');
    await answer(first, 'uid-A', ['a1-stale']);
    expect(ids()).toEqual([]);
    const third = openQuery('uid-A');
    expect(third).toBeTruthy();
    expect(third).not.toBe(first);
    await answer(third, 'uid-A', ['a3']);
    expect(ids()).toEqual(['a3']);
  });

  it('a sign-out while A\'s query is out: its answer never lands', async () => {
    await mountOnDashboard();
    const qa = openQuery('uid-A');
    await switchTo(null);
    await answer(qa, 'uid-A', ['a-late']);
    expect(ids()).toEqual([]);
  });
});
