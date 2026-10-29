// @vitest-environment jsdom
//
// src/App.bootOrder.jsdom.test.jsx
//
// Command Center slice S3 (ruling R-S3-3; review T1-1) — the boot order App's
// owner-aware poll relies on, pinned. The poll captures the identity before its
// first await and drops a completion whose capture is no longer current; a
// capture taken BEFORE Firebase's first answer would be dropped when that
// answer arrives (the first answer is an identity change: epoch 0 → 1), and the
// identity effect would start a second run — one more read, and the list one
// query later. That cannot happen today: `screen` starts 'home', and only a
// user in UserContext — set after Firebase has answered — moves App to the
// dashboard. These rows fail the day a change lets the dashboard render before
// the first answer (an optimistic cached user, a deep link), which is when that
// gap needs closing.
//
// The real App and the real UserProvider and authService, with Firebase at its
// edge: the auth edge follows @firebase/auth's AuthImpl (a listener's FIRST
// call waits for initialisation, in registration order; a sign-in notifies
// each observer before the sign-in promise resolves). Firebase config and
// Firestore are the redirect mocks (src/firebase/__mocks__/config.js,
// __mocks__/firebase/firestore.js; see App.activeBattlesPoll.owner.jsdom.test.jsx),
// and poll runs are counted where they begin (createActivePollFlights).
//
// Both states of the hub flag (its flip, October 28, 2026): each row runs with
// the accessor mocked false — the rollback state, App on the legacy desktop
// shell, the rows as S3 wrote them — and with it true, the shipped state, App
// on the hub gate (a probe here). The boot order is App's, so it holds for
// whichever shell the dashboard renders first.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

vi.setConfig({ testTimeout: 60000 });

const fb = vi.hoisted(() => ({ auth: null, observers: [], initialised: false, initPromise: null, initResolve: null }));

vi.mock('./firebase/config');
vi.mock('firebase/firestore');
vi.mock('firebase/auth', () => {
  const notify = () => { for (const cb of [...fb.observers]) Promise.resolve().then(() => cb(fb.auth.currentUser)); };
  return {
    getAuth: vi.fn(() => fb.auth),
    onAuthStateChanged: vi.fn((auth, cb) => {
      const ready = fb.initialised ? Promise.resolve() : fb.initPromise;
      ready.then(() => { cb(fb.auth.currentUser); });
      fb.observers.push(cb);
      return () => { fb.observers = fb.observers.filter((o) => o !== cb); };
    }),
    signInWithEmailAndPassword: vi.fn(async (auth, email) => {
      fb.auth.currentUser = { uid: 'uid-A', email, getIdToken: async () => 'tok' };
      notify();
      return { user: fb.auth.currentUser };
    }),
    signOut: vi.fn(async () => { fb.auth.currentUser = null; notify(); }),
    createUserWithEmailAndPassword: vi.fn(),
    sendPasswordResetEmail: vi.fn(),
    updateProfile: vi.fn(),
    GoogleAuthProvider: class {},
    signInWithPopup: vi.fn(),
  };
});
vi.mock('./firebase/firebaseService', () => ({
  createBattle: vi.fn(async () => ({})), joinBattle: vi.fn(async () => ({})), subscribeToBattles: vi.fn(() => () => {}),
  createBaggerBombBattle: vi.fn(async () => ({})), createBaggerBombBattleV3: vi.fn(async () => ({})), createBaggerBombBattleV4: vi.fn(async () => ({})),
  joinBaggerBombBattle: vi.fn(async () => ({})), joinBaggerBombBattleV3: vi.fn(async () => ({})), joinBaggerBombBattleV4: vi.fn(async () => ({})),
  subscribeToLobby: vi.fn(() => () => {}), subscribeToAllLobbies: vi.fn(() => () => {}), getOpenBaggerBombBattles: vi.fn(async () => []), completeBattle: vi.fn(async () => ({})),
}));
const { stockAPIStub } = vi.hoisted(() => ({
  stockAPIStub: {
    getStockPrice: async () => null, getMultipleStockPrices: async () => ({}), getCryptoPrice: async () => null,
    getMultipleCryptoPrices: async () => ({}), searchStocks: async () => [], getQuote: async () => null,
    getPopularStocks: async () => [], getPopularCrypto: async () => [],
  },
}));
vi.mock('./services/eodhdAPI', () => ({
  stockAPI: stockAPIStub, POPULAR_CRYPTO: [], FALLBACK_CRYPTO_PRICES: {},
  getMarketNews: vi.fn(async () => []), getTopMoversWithNews: vi.fn(async () => ({ gainers: [], losers: [] })),
  getMultipleStockNews: vi.fn(async () => ({})), getStockNews: vi.fn(async () => []),
  fetchLatestEarnings: vi.fn(async () => null), fetchHistoricalOHLCV: vi.fn(async () => []),
}));
vi.mock('./services/wsCacheBridge', () => ({ startWsCacheBridge: vi.fn(() => () => {}) }));
vi.mock('./hooks/useAgent', () => ({
  default: () => ({ agent: { id: 'a1', name: 'Aurora', archetype: 'degen' }, hasAgent: true, loading: false }),
}));
vi.mock('./hooks/useIsMobile', () => ({ useIsMobile: () => ({ isMobile: false, isTablet: false }) }));
// The hub flag through its accessor, the one every reader calls (App's pick, the hub chrome predicates, the deploy
// provider): each state below sets it.
const hubFlag = vi.hoisted(() => ({ on: false }));
vi.mock('./config/featureFlags', async (importOriginal) => ({ ...(await importOriginal()), isCommandCenterHubOn: () => hubFlag.on }));

// Each App instance's poll runs, counted where they begin (App's one run bookkeeping, unchanged underneath).
const polls = vi.hoisted(() => []);
vi.mock('./utils/activeBattlesPoll', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    createActivePollFlights: (callbacks) => {
      const flights = real.createActivePollFlights(callbacks);
      const runs = { started: 0 };
      polls.push(runs);
      return { ...flights, begin: (...args) => { runs.started += 1; return flights.begin(...args); } };
    },
  };
});

// The dashboard shell — the legacy desktop shell with the hub off, the hub gate with it on: a probe of the identity
// the FIRST dashboard render saw, and of which shell that render was.
const shell = vi.hoisted(() => ({ rendered: false, firstIdentity: null, read: null, which: null }));
vi.mock('./components/Dashboard/CommandDashboardDesktop', () => ({
  default: function CommandDashboardDesktopProbe() {
    if (!shell.rendered) { shell.firstIdentity = shell.read(); shell.which = 'legacy'; }
    shell.rendered = true;
    return null;
  },
}));
vi.mock('./components/CommandCenter/CommandCenterHubGate', () => ({
  default: function CommandCenterHubGateProbe() {
    if (!shell.rendered) { shell.firstIdentity = shell.read(); shell.which = 'hub'; }
    shell.rendered = true;
    return null;
  },
}));

import { auth as configAuth } from './firebase/config';
import * as firestore from 'firebase/firestore';
import PortfolioDuel from './App';
import { UserProvider, useUser } from './contexts/UserContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { FantasyTimesProvider } from './contexts/FantasyTimesContext';
import { readAuthIdentity, resetAuthIdentityForTests } from './services/authIdentity';

fb.auth = configAuth;
shell.read = readAuthIdentity;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};

const USER_DOC = {
  auth: { uid: 'uid-A', email: 'tester@example.com', createdAt: '2026-01-01T00:00:00.000Z', lastLoginAt: '2026-10-22T00:00:00.000Z' },
  profile: { username: 'tester', displayName: 'Tester', avatarUrl: null },
  stats: { xp: 2000, level: 3, rank: 'Expert', wins: 7, losses: 2, winStreak: 0, totalBattles: 9 },
};
const EMPTY = Object.freeze({ docs: [], empty: true, size: 0, forEach: () => {} });
const isPollQuery = (q) => q?.collection === 'agentBattles'
  && q.clauses?.some((c) => c.field === 'ownerId')
  && q.clauses.some((c) => c.field === 'status' && c.value === 'active');

const loginRef = { current: null };
function LoginHandle() {
  loginRef.current = useUser().login;
  return null;
}
const Mounted = () => (
  <UserProvider>
    <ThemeProvider>
      <FantasyTimesProvider>
        <LoginHandle />
        <PortfolioDuel />
      </FantasyTimesProvider>
    </ThemeProvider>
  </UserProvider>
);

const flush = async (turns = 10) => {
  for (let i = 0; i < turns; i += 1) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
};
/** Real time, in act, until `done()` — false past the cap. */
async function waitUntil(done, capMs = 20_000) {
  const start = Date.now();
  while (!done()) {
    if (Date.now() - start > capMs) return false;
    await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
  }
  return true;
}
const runs = () => (polls.length ? polls[polls.length - 1].started : 0);

let container;
let root;

beforeEach(() => {
  resetAuthIdentityForTests();
  fb.auth.currentUser = null;
  fb.observers = [];
  fb.initialised = false;
  fb.initPromise = new Promise((resolve) => { fb.initResolve = resolve; });
  polls.length = 0;
  shell.rendered = false;
  shell.firstIdentity = null;
  shell.which = null;
  firestore.getDoc.mockImplementation(async (ref) => (
    ref ? { exists: () => true, data: () => USER_DOC } : { exists: () => false, data: () => null }
  ));
  firestore.doc.mockImplementation((db, col, id) => ({ col, id }));
  firestore.getDocs.mockImplementation(async (q) => {
    if (isPollQuery(q)) throw new Error('the owner + active query fails in this test');
    return EMPTY;
  });
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('no network in this test'); }));
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => { root.unmount(); });
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe.each([
  ['the hub off (the rollback state, the accessor mocked false): App renders the legacy desktop shell', false, 'legacy'],
  ['the hub on (the shipped state): App renders the hub gate', true, 'hub'],
])('%s', (_state, hubOn, which) => {
  beforeEach(() => { hubFlag.on = hubOn; });

  describe('the dashboard cannot start the poll before Firebase has answered once (the boot order the owner capture relies on)', () => {
    it('a restored session, Firebase still initialising at mount: the identity is resolved when the dashboard first renders, and the poll runs once', async () => {
      // The SDK sets currentUser while it persists the user, before it announces it.
      fb.auth.currentUser = { uid: 'uid-A', getIdToken: async () => 'tok' };
      await act(async () => { root.render(<Mounted />); });
      await flush(4);
      expect(readAuthIdentity().resolved).toBe(false);
      fb.initialised = true;
      await act(async () => { fb.initResolve(); });
      expect(await waitUntil(() => shell.rendered), 'App reached the dashboard shell').toBe(true);
      expect(shell.which, 'the shell the hub flag picks').toBe(which);
      await flush();
      expect(shell.firstIdentity, 'the identity the FIRST dashboard render saw').toEqual({ resolved: true, uid: 'uid-A', authEpoch: 1 });
      expect(runs(), 'one run: no capture was taken before the first answer').toBe(1);
    });

    it('a form login from a signed-out start: the dashboard first renders under the new identity, and the poll runs once', async () => {
      fb.initialised = true;
      await act(async () => { root.render(<Mounted />); });
      await flush(4);
      expect(readAuthIdentity()).toEqual({ resolved: true, uid: null, authEpoch: 1 });
      await act(async () => { await loginRef.current('tester@example.com', 'pw'); });
      expect(await waitUntil(() => shell.rendered), 'App reached the dashboard shell').toBe(true);
      expect(shell.which, 'the shell the hub flag picks').toBe(which);
      await flush();
      expect(shell.firstIdentity, 'the identity the FIRST dashboard render saw').toEqual({ resolved: true, uid: 'uid-A', authEpoch: 2 });
      expect(runs()).toBe(1);
    });
  });
});
