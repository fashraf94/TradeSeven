// @vitest-environment jsdom
//
// Research Modal Build C — the Battle View with the sheet ON (spec §4.2, BC-11,
// BC-12): the real screen (Build A's harness — readers, components and the
// cockpit; Firestore, the routes and the flag accessors are fakes), the modal a
// recorder of the props the screen hands it. The two gated mounts sit behind a
// flag that ships false; their spreads are pinned at the source in
// AgentBattleScreen.sheetMounts.static.test.js.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

// CI-shaped clock zone (tests.yml runs under TZ=UTC): the 1D chart parses calendar
// dates at LOCAL midnight, so the golden is written and read in UTC everywhere.
vi.hoisted(() => { process.env.TZ = 'UTC'; });
const FLAGS = vi.hoisted(() => ({ sheet: 'off' }));
const VERDICT = vi.hoisted(() => ({ allowlisted: false }));
vi.mock('../config/researchModalFlags', () => ({ RESEARCH_MODAL_BOMB_MODE: 'off', RESEARCH_MODAL_BOMB_MODES: Object.freeze(['off', 'allowlist', 'on']), get RESEARCH_MODAL_SHEET_MODE() { return FLAGS.sheet; }, RESEARCH_MODAL_SHEET_MODES: Object.freeze(['off', 'allowlist', 'on']) }));
vi.mock('../config/researchModalFlags.js', () => ({ RESEARCH_MODAL_BOMB_MODE: 'off', RESEARCH_MODAL_BOMB_MODES: Object.freeze(['off', 'allowlist', 'on']), get RESEARCH_MODAL_SHEET_MODE() { return FLAGS.sheet; }, RESEARCH_MODAL_SHEET_MODES: Object.freeze(['off', 'allowlist', 'on']) }));
vi.mock('../firebase/config', () => ({ db: {}, auth: {}, default: {} }));
vi.mock('firebase/auth', () => ({ getAuth: vi.fn(() => ({ currentUser: { getIdToken: async () => 'token-1' } })) }));
vi.mock('../services/agentService', () => ({ submitDailyGrades: vi.fn(), addFeedBookmark: vi.fn(), removeFeedBookmark: vi.fn() }));
const FS = vi.hoisted(() => ({ docs: {} }));
vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    collection: vi.fn((db, ...p) => ({ __path: p.join('/') })),
    query: vi.fn((ref, ...constraints) => ({ __path: ref.__path, constraints })),
    orderBy: vi.fn((field, dir) => ({ field, dir })),
    limit: vi.fn((n) => ({ n })),
    onSnapshot: vi.fn((q, next) => {
      const docs = FS.docs[q.__path];
      if (docs) next({ docs: docs.map((d) => ({ id: d.id ?? 'x', data: () => d })) });
      return () => {};
    }),
    doc: vi.fn((db, ...p) => ({ __path: p.join('/') })),
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
// framer-motion, stubbed to plain elements (the quoteAvailability suite's
// pattern): an in-flight animation's opacity would otherwise make the markup
// differ run to run.
vi.mock('framer-motion', async () => {
  const ReactMod = await import('react');
  const MOTION_PROPS = new Set(['initial', 'animate', 'exit', 'transition', 'variants', 'whileHover', 'whileTap', 'whileFocus',
    'whileInView', 'layout', 'layoutId', 'drag', 'dragConstraints', 'dragElastic', 'dragMomentum', 'onDragEnd', 'onDragStart',
    'dragTransition', 'dragControls', 'dragListener', 'onAnimationComplete', 'onAnimationStart', 'custom', 'viewport', 'onUpdate']);
  const cache = {};
  const make = (tag) => {
    if (!cache[tag]) {
      cache[tag] = ReactMod.forwardRef(function MotionStub(props, ref) {
        const dom = {};
        for (const [k, v] of Object.entries(props)) if (!MOTION_PROPS.has(k)) dom[k] = v;
        return ReactMod.createElement(tag, { ...dom, ref });
      });
    }
    return cache[tag];
  };
  return {
    motion: new Proxy({}, { get: (_, tag) => make(String(tag)) }),
    AnimatePresence: ({ children }) => ReactMod.createElement(ReactMod.Fragment, null, children),
    useReducedMotion: () => false,
    useAnimationControls: () => ({ start: () => Promise.resolve(), stop() {}, set() {} }),
    useMotionValue: (v) => ({ get: () => v, set() {}, on: () => () => {} }),
    useTransform: () => ({ get: () => 0, on: () => () => {} }),
    useDragControls: () => ({ start() {} }),
  };
});
const OPENED = vi.hoisted(() => ({ props: [] }));
vi.mock('../components/draft/AssetResearchModal', () => ({
  default: (props) => { OPENED.props.push(props); return React.createElement('div', { 'data-research-modal': props.asset?.symbol ?? '' }); },
}));
const HOOK = vi.hoisted(() => ({ doc: null }));
vi.mock('../hooks/useAgentBattle', () => ({
  default: () => ({ battle: HOOK.doc, statusFeed: [], executionMode: 'copilot', pendingProposal: null, strategyPreset: 'balanced', gameplanMeeting: null, chatExchanges: [], feedBookmarks: [], loading: false }),
}));

import AgentBattleScreen from './AgentBattleScreen';
import { STOCK_TEST_NOW, correctedStockBattle, stockWriterDb } from '../../api/_utils/__fixtures__/stockThresholdHarness.js';
import { correctedScorePatch, scoreCorrectedPosition } from '../../api/_utils/stockThresholdAdmission.js';

import { resetFilmRoomVerdicts } from '../utils/filmRoomGate.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};

async function committedBattle({ stamped = true, cpuSymbol = 'AAPL' } = {}) {
  process.env.EODHD_API_KEY = 'isolated-key';
  const { battle } = await correctedStockBattle({ fill: 100.75, cpuFill: 99.5, cpuSymbol });
  const at = Date.parse(STOCK_TEST_NOW) / 1000;
  const prices = { AAPL: { current: 101, timestamp: at }, MSFT: { current: 101, timestamp: at } };
  const scores = ['agent', 'cpu'].map(side => scoreCorrectedPosition(battle, { ...(side === 'agent' ? battle.portfolio : battle.opponent.portfolio).star[0], tier: 'star' }, side, prices, STOCK_TEST_NOW));
  const h = stockWriterDb({ battle }); await h.db.doc('battle').update(correctedScorePatch(battle, [scores[0]], [scores[1]], STOCK_TEST_NOW)); Object.assign(battle, h.store.get('battle'));
  delete process.env.EODHD_API_KEY;
  const doc = { ...battle, agentContext: { agentName: 'Aurora', archetype: 'degen' }, timing: { tradingDays: ['d1'], currentTradingDay: 1 }, evaluations: [], statusFeed: [], chatExchanges: [], chatBudgetUsed: 0, scoring: { ...battle.scoring, thresholds: { AAPL: { threshold: 2.5 }, MSFT: { threshold: 2.5 } } } };
  if (!stamped) delete doc.scoring.stockThresholdModel;
  return doc;
}
const battleProp = cpuSymbol => ({ agentId: 'agent', agentBattleId: 'stock-battle', creator: { portfolio: { star: [{ symbol: 'AAPL' }], core: [], support: [] } }, opponent: { portfolio: { star: [{ symbol: cpuSymbol }], core: [], support: [] } }, state: { startingPrices: { AAPL: 100.75, [cpuSymbol]: 99.5 } } });
const watch = watching => { FS.docs = { 'agentBattles/stock-battle/declarations': [{ id: 'd1', evalId: 'eval_001', evalSeq: 1, mintedAt: Date.parse('2026-10-14T14:30:00Z'), mintedMode: 'on', watching, watchingSource: 'top_level' }], 'agentBattles/stock-battle/calls': [], 'agentBattles/stock-battle/callEvents': [] }; };

let container, root;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-14T15:00:00.000Z'));
  OPENED.props = [];
  watch(['AAPL']);
  vi.stubGlobal('fetch', vi.fn(async (url) => ({ ok: String(url).startsWith('/api/agent/cockpit-status'), status: String(url).startsWith('/api/agent/cockpit-status') ? 200 : 404, json: async () => ({ on: true, allowlisted: VERDICT.allowlisted }) })));
  resetFilmRoomVerdicts(); FLAGS.sheet = 'off'; VERDICT.allowlisted = false;
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1600 });
  window.matchMedia = (query) => { const min = /min-width:\s*(\d+)px/.exec(String(query)); return { matches: min ? 1600 >= Number(min[1]) : !String(query).includes('prefers-reduced-motion'), addEventListener() {}, removeEventListener() {} }; };
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });
const settle = async () => { for (let i = 0; i < 12; i += 1) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const mount = async (cpuSymbol = 'AAPL') => { await act(async () => { root.render(<AgentBattleScreen battle={battleProp(cpuSymbol)} user={{ uid: 'u1' }} onBack={() => {}} onOpenFilmRoom={null} />); }); await settle(); };
const click = async (el) => { expect(el).toBeTruthy(); await act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); }); await settle(); };
const chip = symbol => container.querySelector(`[data-cockpit-monitoring-symbol="${symbol}"]`);

const propsOf = () => OPENED.props.at(-1);

describe('sheet mode off — no mount gets sheetContext', () => {
  it('opening a held name through the Monitoring chip: no sheetContext prop', async () => {
    FLAGS.sheet = 'off';
    HOOK.doc = await committedBattle(); await mount(); await click(chip('AAPL'));
    expect(propsOf()).toBeTruthy();
    expect('sheetContext' in propsOf()).toBe(false);
  });
});

describe("sheet mode 'on' — the in-battle contract (§4.2)", () => {
  it('the legacy mount hands the screen\'s own document, its row, the header\'s pair, the directive and the cockpit door', async () => {
    FLAGS.sheet = 'on';
    HOOK.doc = await committedBattle(); await mount(); await click(chip('AAPL'));
    const ctx = propsOf().sheetContext;
    expect(ctx).toBeTruthy();
    expect(ctx.battleId).toBe('stock-battle');
    expect(ctx.agentId).toBe(HOOK.doc.agentId);
    expect(ctx.archetype).toBe('degen');
    expect(ctx.agentName).toBe('Aurora');
    expect(ctx.battle).toBe(HOOK.doc);
    expect(ctx.row).toEqual({ held: false, positionId: HOOK.doc.portfolio.star[0].positionId ?? null });
    expect(ctx.standing).toEqual(expect.objectContaining({ player: expect.any(Number), opponent: expect.any(Number) }));
    expect('directive' in ctx).toBe(true);
    expect(typeof ctx.onOpenCockpit).toBe('function');
    expect('incumbent' in ctx).toBe(false);
  });
  it('→ Cockpit closes research and opens the cockpit through the screen\'s own path (the desktop pane)', async () => {
    FLAGS.sheet = 'on';
    HOOK.doc = await committedBattle(); await mount(); await click(chip('AAPL'));
    expect(container.querySelector('[data-research-modal]')).toBeTruthy();
    await act(async () => { propsOf().sheetContext.onOpenCockpit(); });
    await settle();
    expect(container.querySelector('[data-research-modal]')).toBeNull();
    expect(container.querySelector('[data-cockpit-panel="desktop"]')).toBeTruthy();
  });
});

describe("sheet mode 'allowlist' — per agent battle, by the cockpit-status verdict", () => {
  it('allowlisted: the mount gets sheetContext', async () => {
    FLAGS.sheet = 'allowlist'; VERDICT.allowlisted = true;
    HOOK.doc = await committedBattle(); await mount(); await click(chip('AAPL'));
    expect(propsOf().sheetContext).toBeTruthy();
  });
  it('not allowlisted: nothing', async () => {
    FLAGS.sheet = 'allowlist'; VERDICT.allowlisted = false;
    HOOK.doc = await committedBattle(); await mount(); await click(chip('AAPL'));
    expect('sheetContext' in propsOf()).toBe(false);
  });
});
