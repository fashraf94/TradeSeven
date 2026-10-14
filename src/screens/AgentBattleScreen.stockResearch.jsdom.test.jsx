// @vitest-environment jsdom
//
// Review K1-1/K1-2 (takeover, 2026-10-14): THE SCREEN, MOUNTED, on a pinned
// stock battle. A bare held name (a cockpit Monitoring chip calls
// handleSymbolClick({ symbol }) exactly as the chat ticker and trade cards do)
// must open research on the held row's own committed context — the player's
// position when both sides hold the ticker — and never the legacy table.
// Harness: AgentBattleScreen.cockpit.jsdom.test.jsx (real screen, readers and
// components; Firestore, the HTTP routes and the flag accessor are fakes; the
// research modal records the asset it is handed).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

vi.mock('../firebase/config', () => ({ db: {}, auth: {}, default: {} }));
vi.mock('firebase/auth', () => ({ getAuth: vi.fn(() => ({ currentUser: { getIdToken: async () => 'token-1' } })) }));
vi.mock('../services/agentService', () => ({ submitDailyGrades: vi.fn(), addFeedBookmark: vi.fn(), removeFeedBookmark: vi.fn() }));
const FS = vi.hoisted(() => ({ docs: {} }));
vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    collection: vi.fn((db, ...path) => ({ __path: path.join('/') })),
    query: vi.fn((ref, ...constraints) => ({ __path: ref.__path, constraints })),
    orderBy: vi.fn((field, dir) => ({ field, dir })),
    limit: vi.fn((n) => ({ n })),
    onSnapshot: vi.fn((q, next) => {
      const docs = FS.docs[q.__path];
      if (docs) next({ docs: docs.map((d) => ({ id: d.id ?? 'x', data: () => d })) });
      return () => {};
    }),
    doc: vi.fn((db, ...path) => ({ __path: path.join('/') })),
    getDoc: vi.fn(async (ref) => ({ exists: () => Boolean(FS.docs[ref.__path]), data: () => FS.docs[ref.__path] })),
  };
});
vi.mock('../contexts/ThemeContext', () => {
  const tokens = new Proxy({}, { get: () => '#000000' });
  return { useTheme: () => ({ tokens }), ThemeProvider: ({ children }) => children };
});
vi.mock('../hooks/useAgentBattleId', () => ({ default: () => ({ agentBattleId: null, loading: false }) }));
vi.mock('../hooks/useWebSocketPrices', () => ({ useWebSocketPrices: () => ({ prices: {}, status: 'disconnected' }) }));
vi.mock('../config/featureFlags', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, isAgentPresenceOn: () => false, isMatchupsBackdropOn: () => false, isBattleViewControllerOn: () => true, isCharacterPaneOn: () => true, isCockpitUiOn: () => true };
});
vi.mock('../services/eodhdAPI', () => ({
  stockAPI: { getMultipleStockPrices: vi.fn(async () => ({})), getMultipleCryptoPrices: vi.fn(async () => ({})) },
  POPULAR_CRYPTO: [],
}));
vi.mock('../components/Agent/LiveActivityPanel', () => ({ default: () => null, BreakthroughAlerts: () => null }));
const OPENED = vi.hoisted(() => ({ assets: [] }));
vi.mock('../components/draft/AssetResearchModal', () => ({
  default: (props) => { OPENED.assets.push(props.asset); return React.createElement('div', { 'data-research-modal': props.asset?.symbol ?? '' }); },
}));
const HOOK = vi.hoisted(() => ({ doc: null }));
vi.mock('../hooks/useAgentBattle', () => ({
  default: () => ({ battle: HOOK.doc, statusFeed: [], executionMode: 'copilot', pendingProposal: null, strategyPreset: 'balanced', gameplanMeeting: null, chatExchanges: [], feedBookmarks: [], loading: false }),
}));

import AgentBattleScreen from './AgentBattleScreen';
import { STOCK_TEST_NOW, correctedStockBattle, stockWriterDb } from '../../api/_utils/__fixtures__/stockThresholdHarness.js';
import { correctedScorePatch, scoreCorrectedPosition } from '../../api/_utils/stockThresholdAdmission.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};

// Both sides hold AAPL (agent fill 100.75, CPU fill 99.5); scored at 101.
async function committedBattle({ stamped = true } = {}) {
  process.env.EODHD_API_KEY = 'isolated-key';
  const { battle } = await correctedStockBattle({ fill: 100.75, cpuFill: 99.5 });
  const prices = { AAPL: { current: 101, timestamp: Date.parse(STOCK_TEST_NOW) / 1000 } };
  const scores = ['agent', 'cpu'].map(side => scoreCorrectedPosition(battle, { ...(side === 'agent' ? battle.portfolio : battle.opponent.portfolio).star[0], tier: 'star' }, side, prices, STOCK_TEST_NOW));
  const h = stockWriterDb({ battle }); await h.db.doc('battle').update(correctedScorePatch(battle, [scores[0]], [scores[1]], STOCK_TEST_NOW)); Object.assign(battle, h.store.get('battle'));
  delete process.env.EODHD_API_KEY;
  const doc = { ...battle, agentContext: { agentName: 'Aurora', archetype: 'degen' }, timing: { tradingDays: ['d1'], currentTradingDay: 1 }, evaluations: [], statusFeed: [], chatExchanges: [], chatBudgetUsed: 0, scoring: { ...battle.scoring, thresholds: { AAPL: { threshold: 2.5 } } } };
  if (!stamped) delete doc.scoring.stockThresholdModel;
  return doc;
}
const BATTLE = { agentId: 'agent', agentBattleId: 'stock-battle', creator: { portfolio: { star: [{ symbol: 'AAPL' }], core: [], support: [] } }, opponent: { portfolio: { star: [{ symbol: 'AAPL' }], core: [], support: [] } }, state: { startingPrices: { AAPL: 100.75 } } };

let container, root;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-14T15:00:00.000Z'));
  OPENED.assets = [];
  FS.docs = { 'agentBattles/stock-battle/declarations': [{ id: 'd1', evalId: 'eval_001', evalSeq: 1, mintedAt: Date.parse('2026-10-14T14:30:00Z'), mintedMode: 'on', watching: ['AAPL'], watchingSource: 'top_level' }], 'agentBattles/stock-battle/calls': [], 'agentBattles/stock-battle/callEvents': [] };
  vi.stubGlobal('fetch', vi.fn(async (url) => ({ ok: String(url).startsWith('/api/agent/cockpit-status'), status: String(url).startsWith('/api/agent/cockpit-status') ? 200 : 404, json: async () => ({ on: true }) })));
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1600 });
  window.matchMedia = (query) => { const min = /min-width:\s*(\d+)px/.exec(String(query)); return { matches: min ? 1600 >= Number(min[1]) : !String(query).includes('prefers-reduced-motion'), addEventListener() {}, removeEventListener() {} }; };
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });
const settle = async () => { for (let i = 0; i < 12; i += 1) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const mount = async () => { await act(async () => { root.render(<AgentBattleScreen battle={BATTLE} user={{ uid: 'u1' }} onBack={() => {}} onOpenFilmRoom={null} />); }); await settle(); };
const openBareName = async () => {
  const chip = container.querySelector('[data-cockpit-monitoring-symbol="AAPL"]');
  expect(chip).toBeTruthy();
  await act(async () => { chip.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); });
  await settle();
  return OPENED.assets.at(-1);
};

describe('K1-2: a bare held name opens research on the pinned row context', () => {
  it('a Monitoring chip for a held corrected AAPL opens the player row context, no legacy threshold', async () => {
    HOOK.doc = await committedBattle();
    await mount();
    const asset = await openBareName();
    expect(asset).toMatchObject({ symbol: 'AAPL', stockRewardRoute: true, threshold: null, positionId: 'position-agent', rewardContext: { status: 'valid', fill: 100.75, positionId: 'position-agent' } });
    expect(asset.rewardContext.targets.find(t => t.key === 'bagger').target).toBe(102.765);
  });
  it('legacy control: the same unstamped battle keeps the shipped calibrated research asset', async () => {
    HOOK.doc = await committedBattle({ stamped: false });
    await mount();
    const asset = await openBareName();
    expect(asset.stockRewardRoute).toBeUndefined();
    expect(asset.threshold).toBe(2.5);
  });
});
