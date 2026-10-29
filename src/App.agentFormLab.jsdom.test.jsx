// @vitest-environment jsdom
//
// src/App.agentFormLab.jsdom.test.jsx
//
// Build S0 — App's one gated mount of the agent form lab (src/config/agentFormFlags.js). The real App, signed
// out, with Firebase at its edge (the boot-order suite's mocks, src/App.bootOrder.jsdom.test.jsx). Flag off
// (the shipped state): `?agentFormLab=1` changes nothing — App renders byte-identically with and without it,
// and the lab module is never loaded. Flag on (the smoke branch only): `?agentFormLab=1` opens the lab full
// screen, ahead of the login screen; without the parameter App is unchanged. The lab itself is a probe here
// (src/screens/AgentFormLab.jsx is covered by its own suites); the production bundle's flag-off identity is the
// build report's hash-masked dist diff.

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

const lab = vi.hoisted(() => ({ on: false, loaded: 0, rendered: 0 }));
vi.mock('./config/agentFormFlags', () => ({ get AGENT_FORM_LAB_ENABLED() { return lab.on; } }));
vi.mock('./screens/AgentFormLab', () => {
  lab.loaded += 1;
  return { default: function AgentFormLabProbe() { lab.rendered += 1; return null; } };
});

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};

const flush = async (turns = 12) => { for (let i = 0; i < turns; i += 1) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };

/**
 * Render the real App (fresh modules, so the flag is read as the module loads), signed out, at `url`. `until`
 * waits in real time (cap 15 s) for the lazy lab chunk on a loaded runner, instead of a fixed number of turns.
 */
async function renderApp(url, until = null) {
  window.history.replaceState(null, '', url);
  vi.resetModules();
  const [{ default: App }, { UserProvider }, { ThemeProvider }, { FantasyTimesProvider }, config] = await Promise.all([
    import('./App'), import('./contexts/UserContext'), import('./contexts/ThemeContext'), import('./contexts/FantasyTimesContext'), import('./firebase/config'),
  ]);
  fb.auth = config.auth; fb.auth.currentUser = null; fb.observers = []; fb.initialised = true;
  const container = document.createElement('div'); document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => { root.render(<UserProvider><ThemeProvider><FantasyTimesProvider><App /></FantasyTimesProvider></ThemeProvider></UserProvider>); });
  await flush();
  for (const start = Date.now(); until && !until() && Date.now() - start < 15000;) await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
  const html = container.innerHTML;
  await act(async () => { root.unmount(); });
  container.remove();
  return html;
}

beforeEach(() => {
  lab.loaded = 0; lab.rendered = 0;
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('no network in this test'); }));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); window.history.replaceState(null, '', '/'); });

describe('AGENT_FORM_LAB_ENABLED false (the shipped state)', () => {
  beforeEach(() => { lab.on = false; });

  it('?agentFormLab=1 changes nothing: App renders byte-identically with and without it, and the lab module is never loaded', async () => {
    const plain = await renderApp('/');
    const withParam = await renderApp('/?agentFormLab=1');
    expect(plain.length).toBeGreaterThan(1000);
    expect(withParam).toBe(plain);
    expect(lab.loaded).toBe(0);
    expect(lab.rendered).toBe(0);
  });
});

describe('AGENT_FORM_LAB_ENABLED true (the smoke branch only)', () => {
  beforeEach(() => { lab.on = true; });

  it('?agentFormLab=1 opens the lab full screen, ahead of the login screen', async () => {
    const plain = await renderApp('/');
    expect(lab.rendered).toBe(0);
    const html = await renderApp('/?agentFormLab=1', () => lab.rendered > 0);
    expect(lab.rendered).toBeGreaterThan(0);
    expect(html).not.toBe(plain);
    expect(html.length).toBeLessThan(200); // nothing but the lab (a probe here): no login screen, no app chrome
  });

  it('any other value of the parameter leaves App as it is', async () => {
    const plain = await renderApp('/');
    expect(await renderApp('/?agentFormLab=0')).toBe(plain);
    expect(await renderApp('/?agentFormLab=true')).toBe(plain);
    expect(lab.rendered).toBe(0);
  });
});
