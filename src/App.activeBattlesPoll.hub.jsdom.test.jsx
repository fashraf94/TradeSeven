// @vitest-environment jsdom
//
// src/App.activeBattlesPoll.hub.jsdom.test.jsx
//
// Command Center slice S3 (rulings R-S3-3, R-S3-8, R-S3-10; S3 review T5-9) —
// what App hands the hub, driven through the real App: the hub object at both
// dashboard sites (the retained list, the poll's metadata, the explicit
// refresh, the two open handlers) and the rules of that metadata and refresh.
// Until these rows most of it was pinned only as source text
// (App.activeBattlesPoll.source.test.js; the mount guard's hub-object text);
// the stale-list rule alone had behavioural rows (the owner test).
//
//   - The hub is ON through the PICKER (pickDashboardShell is handed hubOn:
//     true), never through the flag: COMMAND_CENTER_HUB_ENABLED stays false
//     and its dark pin (commandCenterHubFlags.test.js) is not touched.
//   - The gate is replaced by a probe that records what App hands it; the Film
//     Room route and the battle view are probes too, so a row sees which battle
//     an open handler hands them.
//   - Firebase by REDIRECT mock, as in App.activeBattlesPoll.owner.jsdom.test.jsx
//     (a factory mock of a module App imports dynamically can fall through to
//     the real one): each row answers the owner + active query itself.
//   - Poll runs are counted where they begin and settle, the
//     createActivePollFlights wrap.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

vi.setConfig({ testTimeout: 60000 });

const fb = vi.hoisted(() => ({ auth: null, authListeners: [], pollQueries: [] }));

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
const viewport = vi.hoisted(() => ({ mobile: false }));
vi.mock('./hooks/useIsMobile', () => ({ useIsMobile: () => ({ isMobile: viewport.mobile, isTablet: false }) }));

// The hub ON through the picker: its inputs, with the hub flag read as on. The flag itself is never touched.
vi.mock('./components/CommandCenter/pickDashboardShell', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, pickDashboardShell: (inputs) => real.pickDashboardShell({ ...inputs, hubOn: true }) };
});

// The gate, a probe of what App hands it (and of whether it is on screen).
const gate = vi.hoisted(() => ({ props: null, mounted: false }));
vi.mock('./components/CommandCenter/CommandCenterHubGate', () => ({
  default: function GateProbe(props) {
    gate.props = props;
    React.useEffect(() => { gate.mounted = true; return () => { gate.mounted = false; }; }, []);
    return null;
  },
}));

// The two screens an open handler leads to: probes of the battle they are handed.
const screens = vi.hoisted(() => ({ filmRoom: null, battleView: null }));
vi.mock('./screens/filmRoomV2/FilmRoomRoute', () => ({
  default: function FilmRoomProbe(props) { screens.filmRoom = props; return null; },
}));
vi.mock('./screens/BattleViewScreen', () => ({
  default: function BattleViewProbe(props) { screens.battleView = props; return null; },
}));

// Each App instance's poll runs, counted where they begin and settle.
const polls = vi.hoisted(() => []);
vi.mock('./utils/activeBattlesPoll', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    createActivePollFlights: (callbacks) => {
      const flights = real.createActivePollFlights(callbacks);
      const runs = { started: 0, settled: 0 };
      polls.push(runs);
      return {
        ...flights,
        begin: (...args) => { runs.started += 1; return flights.begin(...args); },
        settle: (flight, outcome) => {
          if (flight && !flight.settled) runs.settled += 1;
          flights.settle(flight, outcome);
        },
      };
    },
  };
});

import { auth as configAuth } from './firebase/config';
import * as firestore from 'firebase/firestore';
import PortfolioDuel from './App';
import { ThemeProvider } from './contexts/ThemeContext';
import { FantasyTimesProvider } from './contexts/FantasyTimesContext';
import { resetAuthIdentityForTests } from './services/authIdentity';

fb.auth = configAuth;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};

const isPollQuery = (q) => q?.collection === 'agentBattles'
  && q.clauses?.some((c) => c.field === 'ownerId')
  && q.clauses.some((c) => c.field === 'status' && c.value === 'active');
const EMPTY = Object.freeze({ docs: [], empty: true, size: 0, forEach: () => {} });
const docsOf = (owner, ids) => ({
  size: ids.length,
  empty: ids.length === 0,
  forEach: () => {},
  docs: ids.map((id) => ({ id, data: () => ({ ownerId: owner, status: 'active', agentId: `casual-agent-${owner}` }) })),
});
/** Every owner + active query waits for the row to answer it. */
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

/** Real time, in act, until `done()` — false past the cap. */
async function waitUntil(done, capMs = 20_000) {
  const start = Date.now();
  while (!done()) {
    if (Date.now() - start > capMs) return false;
    await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
  }
  return true;
}
const poll = () => polls[polls.length - 1];
const hub = () => gate.props.hub;
const openQueries = () => fb.pollQueries.filter((q) => !q.settled);
/** A run reaches its query after its lazy imports: wait for it rather than assume it is out. */
async function nextOpenQuery() {
  expect(await waitUntil(() => openQueries().length > 0), 'a poll query is out').toBe(true);
  return openQueries()[0];
}
async function answer(q, owner, ids) {
  const before = poll().settled;
  q.settled = true;
  await act(async () => { q.resolve(docsOf(owner, ids)); });
  expect(await waitUntil(() => poll().settled > before), 'the answered run settled').toBe(true);
}
async function fail(q, message = 'unavailable') {
  const before = poll().settled;
  q.settled = true;
  await act(async () => { q.reject(new Error(message)); });
  expect(await waitUntil(() => poll().settled > before), 'the failed run settled').toBe(true);
}
/** Another account the way Firebase reports it: currentUser first, then the observers. */
async function switchTo(uid) {
  fb.auth.currentUser = uid ? { uid, getIdToken: async () => 'tok' } : null;
  await act(async () => { for (const cb of [...fb.authListeners]) cb(fb.auth.currentUser); });
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
  gate.props = null;
  gate.mounted = false;
  screens.filmRoom = null;
  screens.battleView = null;
  viewport.mobile = false;
  errors = vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('no network in this test'); }));
  deferPollQueries();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  // A row that hid the page shows it again; a query a row left unanswered fails now, and a run still out ends here.
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
  for (const q of fb.pollQueries) if (!q.settled) { q.settled = true; q.reject(new Error('the row ended')); }
  if (polls.length) await waitUntil(() => poll().settled === poll().started);
  await act(async () => { root.unmount(); });
  container.remove();
  errors.mockRestore();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

/** App on the dashboard with the hub on: the gate probe mounted, the mount run's query out. */
async function mountWithHub() {
  await act(async () => { root.render(<Mounted />); });
  expect(await waitUntil(() => gate.props !== null && openQueries().length > 0), 'App reached the hub gate and its first poll query is out').toBe(true);
}

describe('the hub object at both sites (R-S3-10, merged with S5\'s R-S5-9): S3\'s five keys and S5\'s four, live — no agent', () => {
  it.each([['desktop', false], ['mobile', true]])('%s: the retained list, the poll\'s metadata, the refresh and both open handlers', async (site, mobile) => {
    viewport.mobile = mobile;
    await mountWithHub();
    expect(gate.props.site).toBe(site);
    // The live games are one key and the agent is none: the hub reads it through its own owner-tagged reader.
    expect(Object.keys(hub()).sort()).toEqual([
      'activeBattles', 'activePoll', 'onOpenForge', 'openFilmRoom', 'openGame', 'refreshActiveBattles', 'setScreen', 'setSidebarOpen', 'unreadCount',
    ]);
    for (const key of ['onOpenForge', 'setScreen', 'setSidebarOpen']) expect(typeof hub()[key], key).toBe('function');
    expect(hub().unreadCount).toBe(0);
    expect(hub().activeBattles).toEqual([]);
    expect(hub().activePoll).toMatchObject({ status: 'loading', ownerUid: null, ownerEpoch: null, lastSuccessfulAt: null, error: null, refreshing: false });
    await answer(openQueries()[0], 'uid-A', ['bb_1']);
    expect(hub().activeBattles.map((b) => b.id)).toEqual(['bb_1']);
    expect(hub().activePoll).toMatchObject({ status: 'ready', ownerUid: 'uid-A', ownerEpoch: 1, error: null, refreshing: false });
    expect(typeof hub().refreshActiveBattles).toBe('function');
    expect(typeof hub().openGame).toBe('function');
    expect(typeof hub().openFilmRoom).toBe('function');
  });

  it.each([['desktop', false], ['mobile', true]])('%s: openGame opens the game in the battle view, as the legacy shells do (handleOpenAgentBattle)', async (site, mobile) => {
    viewport.mobile = mobile;
    await mountWithHub();
    const record = { id: 'bb_1', ownerId: 'uid-A', agentId: 'casual-agent-uid-A', status: 'active', expiresAt: '2026-10-22T20:00:00.000Z' };
    await act(async () => { hub().openGame(record); });
    expect(await waitUntil(() => screens.battleView !== null, 15_000), 'the battle view opened').toBe(true);
    expect(screens.battleView.currentBattle).toMatchObject({ id: 'bb_1', agentBattleId: 'bb_1', agentId: 'casual-agent-uid-A', agentDeployed: true });
    expect(gate.mounted).toBe(false);
  });

  it.each([['desktop', false], ['mobile', true]])('%s: openFilmRoom opens THAT battle in the Film Room, from the dashboard — and its return comes back to the hub', async (site, mobile) => {
    viewport.mobile = mobile;
    await mountWithHub();
    expect(gate.mounted).toBe(true);
    const record = { id: 'done_1', ownerId: 'uid-A', agentId: 'casual-agent-uid-A', status: 'completed' };
    await act(async () => { hub().openFilmRoom(record); });
    expect(await waitUntil(() => screens.filmRoom !== null, 15_000), 'the Film Room opened').toBe(true);
    expect(screens.filmRoom.battle).toBe(record);
    expect(screens.filmRoom.origin).toBe('dashboard');
    expect(gate.mounted).toBe(false);
    await act(async () => { screens.filmRoom.onReturn(); });
    expect(await waitUntil(() => gate.mounted === true, 15_000), 'the hub came back').toBe(true);
  });
});

describe('the poll\'s metadata follows the poll (R-S3-3)', () => {
  it('a run answered: ready, owned by the uid it queried at this epoch, as of the run\'s start; a failed run keeps the list and the owner and records the failure', async () => {
    const before = Date.now();
    await mountWithHub();
    await answer(openQueries()[0], 'uid-A', ['bb_1']);
    const stamp = hub().activePoll.lastSuccessfulAt;
    expect(stamp).toBeGreaterThanOrEqual(before);
    expect(stamp).toBeLessThanOrEqual(Date.now());
    await act(async () => { hub().refreshActiveBattles(); });
    await fail(await nextOpenQuery());
    expect(hub().activePoll).toMatchObject({ status: 'error', ownerUid: 'uid-A', ownerEpoch: 1, lastSuccessfulAt: stamp, refreshing: false });
    expect(hub().activePoll.error.message).toBe('unavailable');
    expect(hub().activeBattles.map((b) => b.id)).toEqual(['bb_1']);
    // The next success ends the failure.
    await act(async () => { hub().refreshActiveBattles(); });
    await answer(await nextOpenQuery(), 'uid-A', ['bb_1', 'bb_2']);
    expect(hub().activePoll).toMatchObject({ status: 'ready', error: null, ownerUid: 'uid-A', refreshing: false });
    expect(hub().activePoll.lastSuccessfulAt).toBeGreaterThan(stamp);
    expect(hub().activeBattles.map((b) => b.id)).toEqual(['bb_1', 'bb_2']);
  });

  it('an identity change resets the metadata at once: A answered, then B — loading for the new epoch, nothing retained, before B\'s answer', async () => {
    await mountWithHub();
    await answer(openQueries()[0], 'uid-A', ['bb_1']);
    expect(hub().activePoll.ownerUid).toBe('uid-A');
    await switchTo('uid-B');
    expect(hub().activePoll).toMatchObject({ epoch: 2, status: 'loading', ownerUid: null, ownerEpoch: null, lastSuccessfulAt: null, error: null, refreshing: false });
    expect(hub().activeBattles).toEqual([]);
    expect(await waitUntil(() => openQueries().some((q) => q.owner === 'uid-B')), 'the identity change ran the poll for B').toBe(true);
    await answer(openQueries().find((q) => q.owner === 'uid-B'), 'uid-B', ['b_live']);
    expect(hub().activePoll).toMatchObject({ epoch: 2, status: 'ready', ownerUid: 'uid-B', ownerEpoch: 2 });
    expect(hub().activeBattles.map((b) => b.id)).toEqual(['b_live']);
  });
});

describe('refreshActiveBattles: guarded, deduplicated, explicit (R-S3-3)', () => {
  it('while a run is in flight it joins it: no second run, refreshing from the call to the settle, true on success', async () => {
    await mountWithHub();
    expect(poll().started).toBe(1);
    let done;
    await act(async () => { done = hub().refreshActiveBattles(); });
    expect(poll().started).toBe(1);
    expect(hub().activePoll.refreshing).toBe(true);
    await answer(openQueries()[0], 'uid-A', ['bb_1']);
    await expect(done).resolves.toBe(true);
    expect(hub().activePoll).toMatchObject({ status: 'ready', refreshing: false });
  });

  it('with no run in flight it starts exactly one, and a second call joins it', async () => {
    await mountWithHub();
    await answer(openQueries()[0], 'uid-A', []);
    expect(poll().started).toBe(1);
    await act(async () => { hub().refreshActiveBattles(); hub().refreshActiveBattles(); });
    expect(poll().started).toBe(2);
    expect(hub().activePoll.refreshing).toBe(true);
  });

  it('a failed explicit run resolves false and ends the refresh', async () => {
    await mountWithHub();
    await answer(openQueries()[0], 'uid-A', []);
    let done;
    await act(async () => { done = hub().refreshActiveBattles(); });
    expect(hub().activePoll.refreshing).toBe(true);
    await fail(await nextOpenQuery());
    await expect(done).resolves.toBe(false);
    expect(hub().activePoll).toMatchObject({ status: 'error', refreshing: false });
  });

  it('with the poll not running (the page hidden) it starts nothing and resolves false', async () => {
    await mountWithHub();
    await answer(openQueries()[0], 'uid-A', []);
    const started = poll().started;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    let result;
    await act(async () => {
      result = await Promise.race([hub().refreshActiveBattles(), new Promise((resolve) => setTimeout(() => resolve('still waiting after 1.5 s'), 1500))]);
    });
    expect(result).toBe(false);
    expect(poll().started).toBe(started);
  });
});
