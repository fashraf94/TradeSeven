// @vitest-environment jsdom
//
// src/screens/AgentBattleScreen.cockpit.reducedMotion.jsdom.test.jsx
//
// Cockpit Build 2a — THE PHONE UNDER REDUCED MOTION (spec §6: the track
// scrolls 'auto', the thumb is instant). framer latches
// `prefers-reduced-motion` in module scope on its first read, so this lives in
// a file of its own (the AgentBattleScreen.bagger.reducedMotion precedent);
// the harness is AgentBattleScreen.cockpit.jsdom.test.jsx's, copied whole.
//
// The edges are faked exactly as there: a stubbed fetch, a Firestore recorder
// serving the cockpit's subcollections, the flag ACCESSOR.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

vi.mock('../firebase/config', () => ({ db: {}, auth: {}, default: {} }));
const AUTH = vi.hoisted(() => ({ user: { getIdToken: async () => 'token-1' } }));
vi.mock('firebase/auth', () => ({ getAuth: vi.fn(() => ({ currentUser: AUTH.user })) }));
vi.mock('../services/agentService', () => ({ submitDailyGrades: vi.fn(), addFeedBookmark: vi.fn(), removeFeedBookmark: vi.fn() }));

// FIRESTORE: a recorder. The cockpit's readers are the only callers of these
// functions on this screen; anything else falls through to the real module.
const FS = vi.hoisted(() => ({ docs: {}, listeners: [], gets: [] }));
vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    collection: vi.fn((db, ...path) => ({ __path: path.join('/') })),
    query: vi.fn((ref, ...constraints) => ({ __path: ref.__path, constraints })),
    orderBy: vi.fn((field, dir) => ({ field, dir })),
    limit: vi.fn((n) => ({ n })),
    onSnapshot: vi.fn((q, next) => {
      FS.listeners.push(q.__path);
      const docs = FS.docs[q.__path];
      if (docs) next({ docs: docs.map((d) => ({ id: d.callId ?? d.id ?? 'x', data: () => d })) });
      return () => {};
    }),
    doc: vi.fn((db, ...path) => ({ __path: path.join('/') })),
    getDoc: vi.fn(async (ref) => {
      FS.gets.push(ref.__path);
      const d = FS.docs[ref.__path];
      return { exists: () => Boolean(d), data: () => d };
    }),
  };
});

vi.mock('../contexts/ThemeContext', () => {
  const tokens = new Proxy({}, { get: () => '#000000' });
  return { useTheme: () => ({ tokens }), ThemeProvider: ({ children }) => children };
});
vi.mock('../hooks/useAgentBattleId', () => ({ default: () => ({ agentBattleId: null, loading: false }) }));
vi.mock('../hooks/useWebSocketPrices', () => ({ useWebSocketPrices: () => ({ prices: {}, status: 'disconnected' }) }));
// THE FLAG ACCESSOR — null = the shipped accessor itself (the flag as it ships).
const FLAG = vi.hoisted(() => ({ cockpit: null }));
vi.mock('../config/featureFlags', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    isAgentPresenceOn: () => false,
    isMatchupsBackdropOn: () => false,
    isBattleViewControllerOn: () => true,
    isCharacterPaneOn: () => true,
    isCockpitUiOn: () => (FLAG.cockpit === null ? actual.isCockpitUiOn() : FLAG.cockpit),
  };
});
vi.mock('../services/eodhdAPI', () => ({
  stockAPI: { getMultipleStockPrices: vi.fn(async () => ({})), getMultipleCryptoPrices: vi.fn(async () => ({})) },
  POPULAR_CRYPTO: [],
}));
vi.mock('../components/Agent/LiveActivityPanel', () => ({ default: () => null, BreakthroughAlerts: () => null }));
vi.mock('../components/draft/AssetResearchModal', () => ({
  default: (props) => React.createElement('div', { 'data-research-modal': props.asset?.symbol ?? '' }),
}));

const T = (iso) => Date.parse(iso);
const CHECK = { evalId: 'eval_005', timestamp: '2026-09-01T16:47:02.000Z', promptBuiltAt: '2026-09-01T16:45:20.000Z', decision: 'HOLD', rationale: 'Holding the book.', haikuError: null };
const LIVE_DOC = {
  id: 'ab-1',
  status: 'active',
  activatedAt: '2026-09-01T13:30:00.000Z',
  agentContext: { agentName: 'Aurora', archetype: 'degen', equippedWatchlist: { name: 'Energy leaders', tickers: ['DVN'] } },
  scoreState: { currentScore: 12, opponentScore: 3, tradeCount: 1, evaluationCount: 5, lastScoredAt: '2026-09-01T16:47:00.000Z' },
  timing: { tradingDays: ['d1', 'd2', 'd3'], currentTradingDay: 2 },
  portfolio: {
    star: [{ symbol: 'AAPL' }], core: [{ symbol: 'NVDA' }], support: [],
    startingPrices: { AAPL: 150, NVDA: 900 },
    bench: { stocks: [{ symbol: 'NOW' }], crypto: null },
  },
  watchlist: { hotBench: ['CRWD'] },
  opponent: { portfolio: { star: [{ symbol: 'AMD' }], core: [], support: [] } },
  evaluations: [CHECK],
  trades: [],
  statusFeed: [],
  chatExchanges: [],
  chatBudgetUsed: 3,
};
let DOC = LIVE_DOC;
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
  creator: { portfolio: { star: [{ symbol: 'AAPL' }], core: [{ symbol: 'NVDA' }], support: [] } },
  opponent: { portfolio: { star: [{ symbol: 'MSFT' }], core: [], support: [] } },
  state: { startingPrices: { AAPL: 150, NVDA: 900 } },
};

const CLOSE = T('2026-09-01T20:00:00.000Z');
const callRec = (over = {}) => ({
  callId: 'ab-1:eval_005:call:0', kind: 'called_shot', battleId: 'ab-1', evalId: 'eval_005', evalSeq: 5,
  mintedAt: T('2026-09-01T16:48:00.000Z'), mintedMode: 'on',
  symbol: 'AMD', direction: 'entry', heldAtMint: false, slot: 'support', counterpart: 'NOW', counterpartRaw: null,
  condition: { side: 'above', level: 161 }, horizon: { phrase: 'this_session', expiresAt: CLOSE, basis: 'this_session' },
  defaultAction: 'act', said: 'AMD above $161 by the close.', saidOk: true,
  evidence: { tickId: 't5', availability: 'unresolved', priceAsOf: CHECK.promptBuiltAt },
  state: 'open', stateChangedAt: T('2026-09-01T16:48:00.000Z'), playerResponse: null, outcome: null,
  ...over,
});
const OPEN = callRec();
const GONE = callRec({ callId: 'ab-1:eval_001:call:0', evalId: 'eval_001', symbol: 'MU', condition: { side: 'below', level: 90 }, direction: 'exit', counterpart: null, kind: 'confirmation' });
const RESOLVED = callRec({ callId: 'ab-1:eval_004:call:0', evalId: 'eval_004', symbol: 'TSLA', state: 'hit', stateChangedAt: T('2026-09-01T16:30:00.000Z') });
const SHADOW = callRec({ callId: 'ab-1:eval_003:call:0', symbol: 'INTC', mintedMode: 'shadow' });
const seedRecords = () => {
  FS.docs = {
    'agentBattles/ab-1/calls': [OPEN, GONE, RESOLVED, SHADOW],
    'agentBattles/ab-1/declarations': [{ id: 'd5', evalId: 'eval_005', evalSeq: 5, mintedAt: T('2026-09-01T16:48:00.000Z'), mintedMode: 'on', watching: ['CRWD', 'NOW'], watchingSource: 'top_level' }],
    'agentBattles/ab-1/callEvents': [],
  };
};

let STATUS_ON = true;
let ANSWER = { status: 200, body: { callId: OPEN.callId } };
let fetchSpy;
const json = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};

const setShell = (isDesktop) => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: isDesktop ? 1600 : 480 });
  window.matchMedia = (query) => {
    const q = String(query);
    if (q.includes('prefers-reduced-motion')) return { matches: true, addEventListener() {}, removeEventListener() {} };
    const min = /min-width:\s*(\d+)px/.exec(q);
    const width = isDesktop ? 1600 : 480;
    return { matches: min ? width >= Number(min[1]) : isDesktop, addEventListener() {}, removeEventListener() {} };
  };
};

let container;
let root;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-01T17:00:00.000Z'));
  DOC = LIVE_DOC;
  FLAG.cockpit = true;
  STATUS_ON = true;
  ANSWER = { status: 200, body: { callId: OPEN.callId } };
  AUTH.user = { getIdToken: async () => 'token-1' };
  FS.listeners = [];
  FS.gets = [];
  seedRecords();
  fetchSpy = vi.fn(async (url) => {
    const u = String(url);
    if (u.startsWith('/api/agent/cockpit-status')) return json(200, { on: STATUS_ON });
    if (u === '/api/agent/call-response') return json(ANSWER.status, ANSWER.body);
    return json(404, {});
  });
  vi.stubGlobal('fetch', fetchSpy);
  setShell(true);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const element = () => <AgentBattleScreen battle={BATTLE} user={{ uid: 'u1' }} onBack={() => {}} onOpenFilmRoom={null} />;
// The status answer and the lazy readers settle over real turns of the loop.
const settle = async () => { for (let i = 0; i < 12; i += 1) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const mount = async () => { await act(async () => { root.render(element()); }); await settle(); };
const q = (sel) => container.querySelector(sel);
const click = async (el) => {
  expect(el).toBeTruthy();
  await act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); });
  await settle();
};

// ---------------------------------------------------------------------------

describe('ON — phone, reduced motion', () => {
  beforeEach(() => setShell(false));

  it('tapping Cockpit moves the track INSTANTLY (behavior auto), and the selection follows', async () => {
    await mount();
    const track = q('[data-board-cockpit-track]');
    expect(track).toBeTruthy();
    Object.defineProperty(track, 'clientWidth', { configurable: true, value: 480 });
    track.scrollTo = vi.fn();
    await click(q('[data-board-cockpit-tab="cockpit"]'));
    expect(track.scrollTo).toHaveBeenCalledWith({ left: 480, behavior: 'auto' });
    expect(q('[data-board-cockpit-tab="cockpit"]').getAttribute('aria-selected')).toBe('true');
  });
});
