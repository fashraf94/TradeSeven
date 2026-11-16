// @vitest-environment jsdom
//
// src/App.leagueHide.jsdom.test.jsx
//
// League hide (direction note BB-1; founder rulings Q1–Q6, Nov 15, 2026) — App's doors, driven through the real App on the
// harness of App.activeBattlesPoll.hub.jsdom.test.jsx (Firebase by redirect mock; the hub gate a probe that records what App
// hands it). The flag is put on through a mock of the flag module that holds every other flag's real value; it is read at
// call time by the effects and the render, so a row's control can turn it off before the same step runs. The constant is
// never asserted here (the pin is src/config/leagueHideFlag.test.js).
//
//   ROUTE      'league' renders the BaggerBomb page, handed this render's hub object and the width fork; LeagueScreen is
//              not rendered. (The nav items that set it are src/components/Navigation/leagueHide.nav.jsdom.test.jsx.)
//   POLL       the active-battle poll runs while the page is on screen (it ran only on the dashboard before): the page reads
//              the hub's readers, which read that poll's list.
//   ADDRESS    ?tournamentDev=1, ?trainingDraft=<id> and ?trainingBattle=<id> open nothing (each opens its screen with the
//              flag off: the control).
//   SEASON     the Season banner is not rendered (it renders with the flag off: the control).
//
// The pages and screens are probes: the page itself is src/components/CommandCenter/BaggerBombPage.jsdom.test.jsx.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

vi.setConfig({ testTimeout: 60000 });

const h = vi.hoisted(() => ({ hide: true }));
vi.mock('./config/featureFlags', async (importOriginal) => ({
  ...(await importOriginal()),
  get LEAGUE_HIDE_ENABLED() { return h.hide; },
}));

const fb = vi.hoisted(() => ({ auth: null, authListeners: [], pollQueries: [] }));

vi.mock('./firebase/config');
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => fb.auth),
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

// The signed-in user is the row's to hold back: App's own "go to the dashboard when the user loads" effect moves a user who is
// already there at mount off 'home' AFTER the address-parameter effects have run, which would hide every address door whatever
// the flag says. The door rows therefore mount with no user yet and let it arrive, as it does in production.
const session = vi.hoisted(() => ({ user: null, loading: false }));
vi.mock('./contexts/UserContext', () => ({
  useUser: () => ({
    user: session.user,
    login: vi.fn(), register: vi.fn(), loginWithGoogle: vi.fn(),
    logout: vi.fn(), updateUser: vi.fn(), forgotPassword: vi.fn(),
    loading: session.loading, authLoading: false,
  }),
  UserProvider: ({ children }) => children,
}));
vi.mock('./hooks/useAgent', () => ({
  default: () => ({ agent: { id: 'a1', name: 'Aurora', archetype: 'degen' }, hasAgent: true, loading: false }),
}));
const viewport = vi.hoisted(() => ({ mobile: false }));
vi.mock('./hooks/useIsMobile', () => ({ useIsMobile: () => ({ isMobile: viewport.mobile, isTablet: false }) }));

// The hub ON through the picker; the gate a probe of what App hands it.
vi.mock('./components/CommandCenter/pickDashboardShell', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, pickDashboardShell: (inputs) => real.pickDashboardShell({ ...inputs, hubOn: true }) };
});
const gate = vi.hoisted(() => ({ props: null, mounted: false }));
vi.mock('./components/CommandCenter/CommandCenterHubGate', () => ({
  default: function GateProbe(props) {
    gate.props = props;
    React.useEffect(() => { gate.mounted = true; return () => { gate.mounted = false; }; }, []);
    return null;
  },
}));

// The screens under test, as probes: what each is handed, and whether it is on screen.
const probes = vi.hoisted(() => ({ page: null, league: false, draftRoom: false, trainingBattle: false, dev: false, banner: false }));
vi.mock('./components/CommandCenter/BaggerBombPage', () => ({
  default: function PageProbe(props) { probes.page = props; return <div data-probe="baggerbomb-page" data-site={props.site} />; },
}));
vi.mock('./screens/LeagueScreen', () => ({ default: function LeagueProbe() { probes.league = true; return <div data-probe="league-screen" />; } }));
vi.mock('./screens/TrainingDraftRoomScreen', () => ({ default: function DraftRoomProbe() { probes.draftRoom = true; return <div data-probe="training-draft-room" />; } }));
vi.mock('./screens/LeagueTrainingBattleView', () => ({ default: function TrainingBattleProbe() { probes.trainingBattle = true; return <div data-probe="training-battle" />; } }));
vi.mock('./screens/TournamentDevScreen', () => ({ default: function DevProbe() { probes.dev = true; return <div data-probe="tournament-dev" />; } }));
vi.mock('./components/Season/ActiveSeasonBanner', () => ({ default: function BannerProbe() { probes.banner = true; return <div data-probe="season-banner" />; } }));

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
const season = vi.hoisted(() => ({ on: false }));
/** The poll's owner + active query waits for the row to answer it; the Season reads answer from `season`. */
const programReads = () => {
  firestore.getDocs.mockImplementation((q) => {
    if (isPollQuery(q)) {
      const owner = q.clauses.find((c) => c.field === 'ownerId').value;
      return new Promise((resolve, reject) => { fb.pollQueries.push({ owner, resolve, reject, settled: false }); });
    }
    if (season.on && q?.collection === 'seasonEntries') {
      const docs = [{ id: 'entry-1', data: () => ({ userId: 'uid-A', status: 'active', seasonId: 'season-1', isPitStopOpen: false }) }];
      return Promise.resolve({ docs, empty: false, size: 1, forEach: (cb) => docs.forEach(cb) });
    }
    return Promise.resolve(EMPTY);
  });
  firestore.doc.mockImplementation((db, name, id) => ({ collection: name, id }));
  firestore.getDoc.mockImplementation(async (ref) => (season.on && ref?.collection === 'seasons'
    ? { exists: () => true, id: ref.id, data: () => ({ name: 'Season 1', status: 'active', isPitStopWeekend: false }) }
    : { exists: () => false, data: () => null }));
};

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
const openQueries = () => fb.pollQueries.filter((q) => !q.settled);
const probe = (name) => container.querySelector(`[data-probe="${name}"]`);
const settleOpenQueries = async () => {
  for (const q of fb.pollQueries) if (!q.settled) { q.settled = true; await act(async () => { q.resolve(EMPTY); }); }
  if (polls.length) await waitUntil(() => poll().settled === poll().started);
};

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
  Object.assign(probes, { page: null, league: false, draftRoom: false, trainingBattle: false, dev: false, banner: false });
  viewport.mobile = false;
  season.on = false;
  session.user = USER;
  session.loading = false;
  h.hide = true;
  window.history.replaceState({}, '', '/');
  errors = vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('no network in this test'); }));
  programReads();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  for (const q of fb.pollQueries) if (!q.settled) { q.settled = true; q.reject(new Error('the row ended')); }
  if (polls.length) await waitUntil(() => poll().settled === poll().started);
  await act(async () => { root.unmount(); });
  container.remove();
  errors.mockRestore();
  window.history.replaceState({}, '', '/');
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

/** App on the dashboard, the hub gate probe mounted and its first poll query out. */
async function mountOnDashboard() {
  await act(async () => { root.render(<Mounted />); });
  expect(await waitUntil(() => gate.props !== null && openQueries().length > 0), 'App reached the hub gate and its first poll query is out').toBe(true);
}
/** App mounted with no user yet (so the address-parameter effects run first), then the user arrives, as in production. */
async function mountThenUserArrives() {
  session.user = null;
  session.loading = true;
  await act(async () => { root.render(<Mounted />); });
  session.user = USER;
  session.loading = false;
  await act(async () => { root.render(<Mounted />); });
}
/** The route the nav items take: the screen id 'league'. The hub object carries App's own setScreen. */
const goToLeagueId = () => act(async () => { gate.props.hub.setScreen('league'); });

describe('league hide, App — the route', () => {
  it.each([['desktop', false], ['mobile', true]])('%s: the league screen id renders the BaggerBomb page with this render\'s hub object, and not LeagueScreen', async (site, mobile) => {
    viewport.mobile = mobile;
    await mountOnDashboard();
    const hubObject = gate.props.hub;
    await goToLeagueId();
    expect(await waitUntil(() => probe('baggerbomb-page') !== null, 15_000), 'the BaggerBomb page is on screen').toBe(true);
    expect(probe('baggerbomb-page').getAttribute('data-site')).toBe(site);
    // The same object the hub gate was handed (App's `hubProps`, built per render): the same keys, the same live list.
    expect(Object.keys(probes.page.hub).sort()).toEqual(Object.keys(hubObject).sort());
    expect(probes.page.hub.activeBattles).toEqual(hubObject.activeBattles);
    expect(typeof probes.page.hub.openGame).toBe('function');
    expect(probe('league-screen')).toBeNull();
    expect(probes.league).toBe(false);
    expect(gate.mounted).toBe(false);
  });

  it('control — the flag off: the same screen id renders LeagueScreen (TOURNAMENT_TAB_ENABLED as shipped), never the page', async () => {
    await mountOnDashboard();
    h.hide = false;
    await goToLeagueId();
    expect(await waitUntil(() => probe('league-screen') !== null, 15_000), 'LeagueScreen is on screen').toBe(true);
    expect(probe('baggerbomb-page')).toBeNull();
    expect(probes.page).toBeNull();
  });
});

describe('league hide, App — the active-battle poll runs on the page (it ran on the dashboard only)', () => {
  it('moving to the page starts a poll run; the page is handed the list that run answers', async () => {
    await mountOnDashboard();
    await settleOpenQueries();
    expect(openQueries()).toHaveLength(0);
    const startedBefore = poll().started;
    await goToLeagueId();
    expect(await waitUntil(() => probe('baggerbomb-page') !== null, 15_000)).toBe(true);
    expect(await waitUntil(() => openQueries().length > 0, 15_000), 'a poll run started on the page').toBe(true);
    expect(poll().started).toBeGreaterThan(startedBefore);
    const run = openQueries()[0];
    run.settled = true;
    await act(async () => { run.resolve({ size: 1, empty: false, forEach: () => {}, docs: [{ id: 'bb_1', data: () => ({ ownerId: 'uid-A', status: 'active', agentId: 'casual-agent-uid-A' }) }] }); });
    expect(await waitUntil(() => probes.page?.hub?.activeBattles?.some((b) => b.id === 'bb_1') === true, 15_000), 'the page sees the polled list').toBe(true);
  });

  it('control — the flag off: moving to the league screen starts no run (the poll is the dashboard\'s, as before)', async () => {
    await mountOnDashboard();
    await settleOpenQueries();
    h.hide = false;
    const startedBefore = poll().started;
    await goToLeagueId();
    expect(await waitUntil(() => probe('league-screen') !== null, 15_000)).toBe(true);
    // Give a wrongly-started run every chance to show itself.
    await act(async () => { await new Promise((r) => setTimeout(r, 300)); });
    expect(openQueries()).toHaveLength(0);
    expect(poll().started).toBe(startedBefore);
  });
});

describe('league hide, App — the three web-address doors are closed', () => {
  const DOORS = [
    ['?tournamentDev=1', 'tournament-dev', 'dev'],
    ['?trainingDraft=grp-1', 'training-draft-room', 'draftRoom'],
    ['?trainingBattle=pod-1', 'training-battle', 'trainingBattle'],
  ];
  for (const [search, probeName, flag] of DOORS) {
    it(`${search}: ignored — the dashboard stays, the screen is never rendered`, async () => {
      window.history.replaceState({}, '', `/${search}`);
      await mountThenUserArrives();
      // The dashboard (the hub gate) is where the user lands, and nothing else was ever drawn.
      expect(await waitUntil(() => gate.props !== null, 15_000), 'the user landed on the dashboard').toBe(true);
      expect(probe(probeName)).toBeNull();
      expect(probes[flag]).toBe(false);
    });

    it(`control — the flag off: ${search} opens its screen`, async () => {
      h.hide = false;
      window.history.replaceState({}, '', `/${search}`);
      await mountThenUserArrives();
      expect(await waitUntil(() => probe(probeName) !== null, 15_000), `${probeName} is on screen`).toBe(true);
      expect(gate.mounted).toBe(false);
    });
  }
});

describe('league hide, App — the Season banner is not rendered', () => {
  /** A signed-in phone with an active season entry, on a screen that is not the hub (the hub withholds the banner itself). */
  async function phoneWithSeasonOn(screenId) {
    viewport.mobile = true;
    season.on = true;
    await mountOnDashboard();
    await act(async () => { gate.props.hub.setScreen(screenId); });
  }

  it('control — the flag off: an active season on the league screen shows the banner', async () => {
    h.hide = false;
    await phoneWithSeasonOn('league');
    expect(await waitUntil(() => probe('season-banner') !== null, 15_000), 'the banner shows with the flag off').toBe(true);
  });

  it('ON: the same phone, season and screen id show the BaggerBomb page and no banner', async () => {
    await phoneWithSeasonOn('league');
    expect(await waitUntil(() => probe('baggerbomb-page') !== null, 15_000)).toBe(true);
    // Let the season read answer: the banner would have mounted by now.
    await act(async () => { await new Promise((r) => setTimeout(r, 300)); });
    expect(probe('season-banner')).toBeNull();
    expect(probes.banner).toBe(false);
  });
});
