// @vitest-environment jsdom
//
// Research Modal Build C — THE MODE-OFF IDENTITY GOLDEN for the Battle View
// (spec docs/specs/RESEARCH_MODAL_BUILD_C_SHEET_SPEC_V1.md §4.2 and §6: the
// sheet context is passed "only when the mode is on", and "a byte-identical
// render of … the Battle View with the mode off").
//
// GENERATED at the pre-build product tree: the golden file was written by
// this harness (GENERATE_SHEET_MODE_OFF_GOLDEN=1) at the branch's flag
// commit, whose AgentBattleScreen.jsx is byte-identical to main f095dc29.
// Never regenerate it from build output. The harness is Build A's
// AgentBattleScreen.bombModeOff.golden.test.jsx with the sheet flag added.
//
// Harness: AgentBattleScreen.stockResearch.jsdom.test.jsx (the real screen,
// readers and components; Firestore, the HTTP routes and the flag accessors
// are fakes). The research modal is a recorder: each scene opens research on
// one name and records the screen's markup (SHA-256) and EVERY prop the screen
// hands the modal — so a new prop (bombContext) leaking into the off path, or
// a changed asset, fails here — and sheetContext leaking into the off path
// fails the key list. RESEARCH_MODAL_SHEET_MODE and RESEARCH_MODAL_BOMB_MODE
// are both forced 'off'.

import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// CI-shaped clock zone (tests.yml runs under TZ=UTC): the 1D chart parses calendar
// dates at LOCAL midnight, so the golden is written and read in UTC everywhere.
vi.hoisted(() => { process.env.TZ = 'UTC'; });
vi.mock('../config/researchModalFlags', () => ({ RESEARCH_MODAL_BOMB_MODE: 'off', RESEARCH_MODAL_BOMB_MODES: Object.freeze(['off', 'allowlist', 'on']), RESEARCH_MODAL_SHEET_MODE: 'off', RESEARCH_MODAL_SHEET_MODES: Object.freeze(['off', 'allowlist', 'on']) }));
vi.mock('../config/researchModalFlags.js', () => ({ RESEARCH_MODAL_BOMB_MODE: 'off', RESEARCH_MODAL_BOMB_MODES: Object.freeze(['off', 'allowlist', 'on']), RESEARCH_MODAL_SHEET_MODE: 'off', RESEARCH_MODAL_SHEET_MODES: Object.freeze(['off', 'allowlist', 'on']) }));
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

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GOLDEN = path.join(HERE, '__goldens__', 'AgentBattleScreen.sheetModeOff.golden.json');
const GENERATE = process.env.GENERATE_SHEET_MODE_OFF_GOLDEN === '1';

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
  vi.stubGlobal('fetch', vi.fn(async (url) => ({ ok: String(url).startsWith('/api/agent/cockpit-status'), status: String(url).startsWith('/api/agent/cockpit-status') ? 200 : 404, json: async () => ({ on: true }) })));
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1600 });
  window.matchMedia = (query) => { const min = /min-width:\s*(\d+)px/.exec(String(query)); return { matches: min ? 1600 >= Number(min[1]) : !String(query).includes('prefers-reduced-motion'), addEventListener() {}, removeEventListener() {} }; };
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });
const settle = async () => { for (let i = 0; i < 12; i += 1) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const mount = async (cpuSymbol = 'AAPL') => { await act(async () => { root.render(<AgentBattleScreen battle={battleProp(cpuSymbol)} user={{ uid: 'u1' }} onBack={() => {}} onOpenFilmRoom={null} />); }); await settle(); };
const click = async (el) => { expect(el).toBeTruthy(); await act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); }); await settle(); };
const chip = symbol => container.querySelector(`[data-cockpit-monitoring-symbol="${symbol}"]`);

// The fixture mints a fresh receipt hash and snapshot uuid per run; both are masked.
const stable = (s) => s.replace(/[0-9a-f]{64}/g, '<hash>').replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, '<uuid>');
// Every prop, functions named by kind only: the KEYS are the contract (no sheetContext off).
const propsRecord = (p) => JSON.parse(stable(JSON.stringify(p, (k, v) => (typeof v === 'function' ? '[function]' : v === undefined ? '[undefined]' : v))));
const snapshot = () => ({
  screen: { sha256: createHash('sha256').update(stable(container.innerHTML)).digest('hex'), length: container.innerHTML.length },
  modal: OPENED.props.length ? propsRecord(OPENED.props.at(-1)) : null,
  modalKeys: OPENED.props.length ? Object.keys(OPENED.props.at(-1)).sort() : null,
});

const SCENES = {
  // A held measured name through the cockpit Monitoring chip (the legacy mount at HEAD's flags).
  held_measured_chip: async () => { HOOK.doc = await committedBattle(); await mount(); await click(chip('AAPL')); return snapshot(); },
  // The CPU-only name: the opponent's measured row.
  cpu_only_chip: async () => { watch(['MSFT']); HOOK.doc = await committedBattle({ cpuSymbol: 'MSFT' }); await mount('MSFT'); await click(chip('MSFT')); return snapshot(); },
  // An unstamped (legacy) battle: the shipped calibrated research asset.
  legacy_unstamped_chip: async () => { HOOK.doc = await committedBattle({ stamped: false }); await mount(); await click(chip('AAPL')); return snapshot(); },
  // The screen with nothing opened.
  closed: async () => { HOOK.doc = await committedBattle(); await mount(); return snapshot(); },
};

describe('sheet mode off: the Battle View renders and hands research exactly what main does (Build C spec §4.2, §6)', () => {
  const golden = !GENERATE && existsSync(GOLDEN) ? JSON.parse(readFileSync(GOLDEN, 'utf8')) : null;
  const out = {};
  afterAll(() => {
    if (!GENERATE) return;
    mkdirSync(path.dirname(GOLDEN), { recursive: true });
    writeFileSync(GOLDEN, `${JSON.stringify(out, null, 1)}\n`);
  });
  it.each(Object.keys(SCENES))('%s — same markup, same modal props', async (name) => {
    const got = await SCENES[name]();
    if (GENERATE) { out[name] = got; return; }
    expect(golden, 'golden file missing — it is generated only at the pre-build tree').not.toBeNull();
    expect(got.modalKeys).toEqual(golden[name].modalKeys);
    expect(got.modal).toEqual(golden[name].modal);
    expect(got.screen).toEqual(golden[name].screen);
    if (got.modalKeys) expect(got.modalKeys).not.toContain('sheetContext');
  });
});
