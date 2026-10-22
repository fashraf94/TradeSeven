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
// THE LIMIT, STATED. Under this harness App's own `import('firebase/firestore')`
// and `import('./firebase/config')` — the poll's lazy imports — reach the REAL
// modules on some runs and the mocks on others (the XP-modal suite's poll fails
// on the real ones, unnoticed). So no row here depends on a query answer: the
// mocked query fails too, and a run is counted either way — a mocked owner +
// active query or a logged failure. The rows seed the list the way a deploy
// does — R1's optimistic entry through the shell's own onCreateAgentBattle, no
// read — and pin:
//   parity   the poll runs at mount and once per 120 s and nowhere else; a
//            failed run keeps the list as it was; the same owner's identity
//            answering again changes nothing;
//   defects  rows written to fail on the pre-S3 App: an account switch or a
//            sign-out leaves the former owner's games in place.
// What needs a query answer — a stale completion ignored, A→B→A — is pinned
// on the pure rules (src/utils/activeBattlesPoll.test.js) and on the poll's
// source (src/App.activeBattlesPoll.source.test.js).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

vi.setConfig({ testTimeout: 60000 });

const fb = vi.hoisted(() => ({
  auth: { currentUser: { uid: 'uid-A', getIdToken: async () => 'tok' } },
  authListeners: [],
  pollQueries: [],         // the owner of every owner + active query that reached the mock
}));

vi.mock('./firebase/config', () => ({ db: {}, auth: fb.auth, default: {} }));
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => fb.auth),
  // Firebase answers a new observer with the current user; this one does so at once.
  onAuthStateChanged: vi.fn((auth, callback) => {
    fb.authListeners.push(callback);
    callback(fb.auth.currentUser);
    return () => {};
  }),
}));
vi.mock('firebase/firestore', () => {
  const unsub = () => {};
  return {
    getFirestore: vi.fn(() => ({})),
    collection: vi.fn((db, name) => ({ collection: name })),
    doc: vi.fn(() => ({})),
    query: vi.fn((col, ...clauses) => ({ ...col, clauses })),
    where: vi.fn((field, op, value) => ({ field, op, value })),
    orderBy: vi.fn(() => ({})),
    limit: vi.fn(() => ({})),
    onSnapshot: vi.fn(() => unsub),
    getDoc: vi.fn(async () => ({ exists: () => false, data: () => null })),
    getDocs: vi.fn(async (q) => {
      const owner = q?.clauses?.find((c) => c.field === 'ownerId')?.value;
      if (q?.collection === 'agentBattles' && owner && q.clauses.some((c) => c.field === 'status' && c.value === 'active')) {
        fb.pollQueries.push(owner);
        // Every poll answer fails here, on this path as on the real one.
        throw new Error('the owner + active query fails in this test');
      }
      return { docs: [], empty: true, size: 0, forEach: () => {} };
    }),
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

// The legacy desktop shell App renders with the hub off: a probe of what App hands it.
const shell = vi.hoisted(() => ({ lists: [], props: null }));
vi.mock('./components/Dashboard/CommandDashboardDesktop', () => ({
  default: function CommandDashboardDesktopProbe(props) {
    shell.lists.push(props.activeAgentBattles);
    shell.props = props;
    return null;
  },
}));

import PortfolioDuel from './App';
import { ThemeProvider } from './contexts/ThemeContext';
import { FantasyTimesProvider } from './contexts/FantasyTimesContext';
import { resetAuthIdentityForTests } from './services/authIdentity';

const Mounted = () => (
  <ThemeProvider>
    <FantasyTimesProvider>
      <PortfolioDuel />
    </FantasyTimesProvider>
  </ThemeProvider>
);

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};

const POLL_FAILURE = 'Error fetching agent battles (retaining last-known-good):';
const flush = async (turns = 6) => {
  for (let i = 0; i < turns; i += 1) {
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  }
};
const latest = () => shell.lists[shell.lists.length - 1];

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
  shell.lists = [];
  shell.props = null;
  errors = vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('no network in this test'); }));
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => { root.unmount(); });
  container.remove();
  errors.mockRestore();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

/** Poll runs that reached a request: each ends in the poll's catch, on either path. */
const pollRuns = () => errors.mock.calls.filter((c) => c[0] === POLL_FAILURE).length;

async function mountOnDashboard() {
  await act(async () => { root.render(<Mounted />); });
  await flush();
  expect(shell.props, 'App reached the dashboard and rendered the legacy desktop shell').not.toBeNull();
}

describe('parity — the signed-in owner\'s list and the poll\'s schedule are today\'s', () => {
  it('the poll runs once at mount and once per 120 s, and nothing else starts it', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    await mountOnDashboard();
    expect(pollRuns()).toBe(1);
    await act(async () => { vi.advanceTimersByTime(119_999); });
    await flush();
    expect(pollRuns()).toBe(1);
    await act(async () => { vi.advanceTimersByTime(1); });
    await flush();
    expect(pollRuns()).toBe(2);
    await act(async () => { vi.advanceTimersByTime(240_000); });
    await flush();
    expect(pollRuns()).toBe(4);
  });

  it('a deploy\'s entry stays through a failed run: the list is never blanked on an error', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    await mountOnDashboard();
    await deployAsTheShellDoes();
    const seeded = latest();
    expect(seeded.map((b) => b.id)).toEqual(['bb_new']);
    await act(async () => { vi.advanceTimersByTime(120_000); });
    await flush();
    expect(pollRuns()).toBe(2);
    expect(latest()).toBe(seeded);
  });

  it('the same owner\'s identity answering again changes nothing: no clear, no extra run', async () => {
    await mountOnDashboard();
    await deployAsTheShellDoes();
    const seeded = latest();
    const runs = pollRuns();
    await act(async () => { for (const cb of [...fb.authListeners]) cb({ uid: 'uid-A' }); });
    await flush();
    expect(latest()).toBe(seeded);
    expect(pollRuns()).toBe(runs);
  });
});

describe('defects the pre-S3 App has (R-S3-3)', () => {
  it('an account switch clears the former owner\'s games at once, and the poll runs at once for the new owner', async () => {
    await mountOnDashboard();
    await deployAsTheShellDoes('uid-A');
    expect(latest().map((b) => b.id)).toEqual(['bb_new']);
    const runs = pollRuns();
    await switchTo('uid-B');
    expect(latest()).toEqual([]);
    await flush();
    expect(pollRuns()).toBe(runs + 1);
  });

  it('a sign-out clears the former owner\'s games at once', async () => {
    await mountOnDashboard();
    await deployAsTheShellDoes('uid-A');
    await switchTo(null);
    expect(latest()).toEqual([]);
  });
});
