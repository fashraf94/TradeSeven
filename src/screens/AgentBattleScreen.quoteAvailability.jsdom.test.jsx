// @vitest-environment jsdom
//
// src/screens/AgentBattleScreen.quoteAvailability.jsdom.test.jsx
//
// Shadow vs CPU quote integrity — the REAL battle screen (spec
// SHADOW_CPU_PLACEHOLDER_PRICE_SPEC_V1_6.md §3–§7; OFF-5/OFF-6/OFF-7 and the
// screen-level ON rows; build record
// docs/audits/20261002_SHADOW_CPU_QUOTE_INTEGRITY_BUILD_REVIEW.md).
//
// Boundaries only: Firestore (a recording fake under the REAL useAgentBattleId
// and useAgentBattle hooks), the price network (stockAPI), the WebSocket
// prices hook, auth, and framer-motion (stubbed per
// ChatSheet.motion.jsdom.test.jsx so markup is deterministic and the bar's
// motion props are observable). The research modal, the breakdown popover,
// the chat and the presence face are recorders: their own behaviour has its
// own suites; here what matters is what the screen hands them.
//
// OFF-5/OFF-6 — flag off: markup, price requests, polling, subscriptions and
// the payloads handed to research, breakdown and faces match the pre-build
// SHA. References were captured there by running this file's OFF rows with
// SHADOW_OFF_CAPTURE_DIR set; markup is compared by SHA-256 digest.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act, Profiler } from 'react';
import { createRoot } from 'react-dom/client';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

export const OFF_REFERENCE_SHA = '44d0c63eba4e3099552d3ec3dbde6a89660a7e06';
const CAPTURE_DIR = process.env.SHADOW_OFF_CAPTURE_DIR || '';
const digest = (s) => ({ sha256: createHash('sha256').update(s).digest('hex'), length: s.length });
function offReference(name, actual, expected) {
  if (CAPTURE_DIR) {
    writeFileSync(path.join(CAPTURE_DIR, `screen.${name}.json`), JSON.stringify(actual, null, 1));
    return;
  }
  expect(actual, `OFF reference ${name} (captured at ${OFF_REFERENCE_SHA})`).toEqual(expected);
}

// ── Flags (accessors only — never the constants) ─────────────────────────────
const flags = vi.hoisted(() => ({ gate: false, controller: true, pane: true, presence: false }));
vi.mock('./../config/featureFlags', async (importOriginal) => ({
  ...(await importOriginal()),
  isAgentPresenceOn: () => flags.presence,
  isMatchupsBackdropOn: () => false,
  isBattleViewControllerOn: () => flags.controller,
  isCharacterPaneOn: () => flags.controller && flags.pane,
  isShowItOn: () => false,
  isShadowCpuQuoteIntegrityOn: () => flags.gate,
}));

// ── Firestore at the module boundary, under the REAL hooks ──────────────────
const fsBox = vi.hoisted(() => ({ listeners: [], log: [] }));
const authBox = vi.hoisted(() => ({ currentUser: { uid: 'u1' } }));
vi.mock('firebase/firestore', () => {
  const agentOf = (q) => q?.constraints?.find((c) => c.field === 'agentId')?.value ?? null;
  return {
    collection: (db, name) => ({ kind: 'collection', name }),
    where: (field, op, value) => ({ kind: 'where', field, op, value }),
    limit: (n) => ({ kind: 'limit', n }),
    query: (coll, ...constraints) => ({ kind: 'query', coll, constraints }),
    doc: (db, coll, id) => ({ kind: 'doc', coll, id }),
    getDoc: () => Promise.resolve({ exists: () => false, data: () => undefined }),
    onSnapshot: (...args) => {
      const ref = args[0];
      const hasOptions = args.length === 4;
      const key = ref.kind === 'doc' ? ref.id : agentOf(ref);
      const l = {
        id: fsBox.listeners.length, kind: ref.kind, key, ref, arity: args.length,
        options: hasOptions ? args[1] : undefined,
        next: hasOptions ? args[2] : args[1],
        error: hasOptions ? args[3] : args[2],
        active: true,
      };
      fsBox.listeners.push(l);
      fsBox.log.push(['subscribe', ref.kind, key, args.length]);
      return () => { l.active = false; fsBox.log.push(['unsubscribe', ref.kind, key]); };
    },
  };
});
vi.mock('../firebase/config', () => ({ db: {}, auth: authBox, default: {} }));
vi.mock('firebase/auth', () => ({ getAuth: vi.fn(() => ({ currentUser: null })) }));
vi.mock('../services/agentService', () => ({ submitDailyGrades: vi.fn(), addFeedBookmark: vi.fn(), removeFeedBookmark: vi.fn() }));
vi.mock('../contexts/ThemeContext', () => {
  const tokens = new Proxy({}, { get: () => '#000000' });
  return { useTheme: () => ({ tokens }), ThemeProvider: ({ children }) => children };
});

// ── The price network and the WebSocket overlay ─────────────────────────────
const priceBox = vi.hoisted(() => ({ calls: [], table: {}, mode: 'resolve', modeFor: {}, pending: [] }));
vi.mock('../services/eodhdAPI', () => {
  const answer = (kind, symbols) => {
    priceBox.calls.push([kind, [...symbols]]);
    const build = () => Object.fromEntries(symbols.filter((s) => priceBox.table[s] !== undefined).map((s) => [s, priceBox.table[s]]));
    // `modeFor[kind]` overrides `mode` for one batch kind (§4.3 rule 2 rows).
    const mode = priceBox.modeFor[kind] || priceBox.mode;
    if (mode === 'defer') {
      return new Promise((resolve, reject) => priceBox.pending.push({ kind, symbols: [...symbols], resolve, reject, build }));
    }
    if (mode === 'throw') return Promise.reject(new Error('network down'));
    return Promise.resolve(build());
  };
  return {
    stockAPI: {
      getMultipleStockPrices: (symbols) => answer('stock', symbols),
      getMultipleCryptoPrices: (symbols) => answer('crypto', symbols),
    },
    POPULAR_CRYPTO: [{ symbol: 'BTC' }, { symbol: 'ETH' }],
  };
});
const wsBox = vi.hoisted(() => ({ prices: {}, args: [] }));
vi.mock('../hooks/useWebSocketPrices', () => ({
  useWebSocketPrices: (symbols) => { wsBox.args.push(symbols); return { prices: wsBox.prices, status: 'disconnected' }; },
}));

// ── framer-motion, stubbed (deterministic markup; motion props observable) ───
const framerSeen = vi.hoisted(() => ({ bars: [] }));
vi.mock('framer-motion', async () => {
  const ReactMod = await import('react');
  const MOTION_PROPS = new Set(['initial', 'animate', 'exit', 'transition', 'variants', 'whileHover', 'whileTap', 'whileFocus',
    'whileInView', 'layout', 'layoutId', 'drag', 'dragConstraints', 'dragElastic', 'dragMomentum', 'onDragEnd', 'onDragStart',
    'dragTransition', 'dragControls', 'dragListener', 'onAnimationComplete', 'onAnimationStart', 'custom', 'viewport', 'onUpdate']);
  // The gated tug-of-war bar — `initial={false}` plus `data-bar-pct`, in BOTH
  // headers — is rendered by the REAL library, so its committed inline width is
  // observable per commit (B-12 at the screen: a keyed remount commits the
  // target; the same-kind negative control commits the OLD width). A flag-off
  // bar carries neither prop and stays stubbed, so every OFF digest is unchanged.
  const actual = await vi.importActual('framer-motion');
  const cache = {};
  const make = (tag) => {
    if (!cache[tag]) {
      cache[tag] = ReactMod.forwardRef(function MotionStub(props, ref) {
        if (props.animate && typeof props.animate === 'object' && 'width' in props.animate) {
          framerSeen.bars.push({ width: props.animate.width, initial: props.initial, barPct: props['data-bar-pct'] ?? null });
        }
        if (props.initial === false && props['data-bar-pct'] != null) {
          return ReactMod.createElement(actual.motion[tag], { ...props, ref });
        }
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

// ── Recorders for the consumers whose own behaviour has its own suites ──────
const seen = vi.hoisted(() => ({ research: [], breakdown: [], presence: [], chatPayload: { symbol: 'TSLA' }, admission: null, closeResearch: null, researchMounts: 0 }));
vi.mock('../components/draft/AssetResearchModal', () => ({
  default: function ResearchModalRecorder(props) {
    // The admission callback is recorded only when supplied (gated non-held
    // views), so every legacy entry serializes exactly as captured.
    seen.research.push(JSON.parse(JSON.stringify({
      ...props,
      onClose: typeof props.onClose,
      ...(props.onNavigateAdmission ? { onNavigateAdmission: 'function' } : {}),
    })));
    seen.admission = props.onNavigateAdmission ?? null;
    seen.closeResearch = props.onClose;
    // Counts MOUNTS (not renders), so a same-position update can be told
    // apart from a remount. Records nothing into `seen.research`.
    React.useEffect(() => { seen.researchMounts += 1; }, []);
    return <div data-test-research-modal={props.asset?.symbol} />;
  },
}));
vi.mock('../components/draft/ScoreBreakdownPopover', () => ({
  default: (props) => {
    seen.breakdown.push(JSON.parse(JSON.stringify({ asset: props.asset, entryPrice: props.entryPrice })));
    return <div data-test-breakdown={props.asset?.symbol} />;
  },
}));
vi.mock('../components/Agent/AgentChat', () => ({
  default: (props) => (
    <div data-test-chat="1">
      <button type="button" data-test-chat-symbol="1" onClick={() => props.onSymbolClick?.(seen.chatPayload)}>chat symbol</button>
    </div>
  ),
}));
// `faceBox.live`: each MOUNTED face's current duel input, keyed by instance —
// so a row can assert what every face on screen shows right now, including a
// face that did not re-render (the recorded payloads and markup are unchanged).
const faceBox = vi.hoisted(() => ({ seq: 0, live: new Map() }));
vi.mock('../components/AgentPresence/AgentPresenceMount', async () => {
  const ReactMod = await import('react');
  return {
    default: function FaceRecorder(props) {
      const id = ReactMod.useRef(0);
      if (id.current === 0) { faceBox.seq += 1; id.current = faceBox.seq; }
      seen.presence.push(JSON.parse(JSON.stringify({ duel: props.duel ?? null, reactivityLevel: props.reactivityLevel ?? null })));
      faceBox.live.set(id.current, JSON.parse(JSON.stringify(props.duel ?? null)));
      ReactMod.useEffect(() => () => { faceBox.live.delete(id.current); }, []);
      return <span data-test-face="1" />;
    },
  };
});
vi.mock('../components/Agent/LiveActivityPanel', () => ({ default: () => null, BreakthroughAlerts: () => null }));

import AgentBattleScreen from './AgentBattleScreen';
import { computeTugOfWarWidth } from './battleView/computeTugOfWarWidth';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};

// ── Shell (both halves of the breakpoint, as the pane suite does) ───────────
function setShell(isDesktop) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: isDesktop ? 1280 : 480 });
  window.matchMedia = (query) => {
    const q = String(query);
    if (q.includes('prefers-reduced-motion')) return { matches: false, addEventListener() {}, removeEventListener() {} };
    const min = /min-width:\s*(\d+)px/.exec(q);
    const width = isDesktop ? 1280 : 480;
    return { matches: min ? width >= Number(min[1]) : isDesktop, addEventListener() {}, removeEventListener() {} };
  };
}

let container;
let root;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
  vi.setSystemTime(new Date('2026-10-01T17:00:00.000Z')); // Thu 1:00 PM ET
  Object.assign(flags, { gate: false, controller: true, pane: true, presence: false });
  fsBox.listeners.length = 0;
  fsBox.log.length = 0;
  authBox.currentUser = { uid: 'u1' };
  priceBox.calls.length = 0;
  priceBox.pending.length = 0;
  priceBox.mode = 'resolve';
  priceBox.modeFor = {};
  priceBox.table = {};
  wsBox.prices = {};
  wsBox.args.length = 0;
  framerSeen.bars.length = 0;
  seen.research.length = 0;
  seen.breakdown.length = 0;
  seen.presence.length = 0;
  faceBox.seq = 0;
  faceBox.live.clear();
  seen.chatPayload = { symbol: 'TSLA' };
  seen.admission = null;
  seen.closeResearch = null;
  seen.researchMounts = 0;
  globalThis.fetch = vi.fn(() => Promise.reject(new Error('no network in tests')));
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  setShell(true);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.useRealTimers();
  delete globalThis.fetch;
});

// ── Fixtures ─────────────────────────────────────────────────────────────────
const NOW_TS = Math.floor(Date.parse('2026-10-01T16:50:00.000Z') / 1000);
const QUOTE = {
  AAPL: 153, NVDA: 920, MSFT: 404, TSLA: 255, AMZN: 181, META: 498, BTC: 61000,
  GOOGL: 162, AMD: 139, NFLX: 610, ORCL: 121, CRM: 252, INTC: 31, ETH: 2520,
};
const PREV = {
  AAPL: 151, NVDA: 905, MSFT: 401, TSLA: 251, AMZN: 180, META: 499, BTC: 60500,
  GOOGL: 160, AMD: 140, NFLX: 600, ORCL: 120, CRM: 250, INTC: 30.5, ETH: 2500,
};
const PROVIDER = { version: 1, price: 'provider-close', previousClose: 'provider-previous-close' };
const CRYPTO = new Set(['BTC', 'ETH']);
/** A client-normalized record exactly as eodhdAPI returns it (stock or crypto). */
function quote(sym, over = {}) {
  const price = over.price ?? QUOTE[sym];
  const base = CRYPTO.has(sym)
    ? { price, previousClose: PREV[sym], change24h: 0.5, high: price + 300, low: price - 400, timestamp: NOW_TS, quoteOrigin: PROVIDER }
    : { price, previousClose: PREV[sym], open: PREV[sym] + 0.5, change: price - PREV[sym], percentChange: 1, high: price + 1, low: price - 2, timestamp: NOW_TS, quoteOrigin: PROVIDER };
  return { ...base, ...over };
}
const genuineTable = () => Object.fromEntries(Object.keys(QUOTE).map((s) => [s, quote(s)]));

const PLAYER_PORTFOLIO = {
  star: [{ symbol: 'AAPL', price: 150 }, { symbol: 'NVDA', price: 900 }],
  core: [{ symbol: 'MSFT', price: 400 }, { symbol: 'TSLA', swapPrice: 248, swappedInAt: '2026-10-01T15:00:00.000Z', swappedInDay: 1 }],
  support: [{ symbol: 'AMZN', price: 180 }, { symbol: 'META', price: 500 }, { symbol: 'BTC', price: 60000, isCrypto: true, direction: 'long' }],
  startingPrices: { AAPL: 150, NVDA: 900, MSFT: 400, AMZN: 180, META: 500, BTC: 60000 },
};
const CPU_PORTFOLIO = {
  star: [{ symbol: 'GOOGL', price: 160 }, { symbol: 'AMD', price: 140 }],
  core: [{ symbol: 'NFLX', price: 600 }, { symbol: 'ORCL', price: 120 }],
  support: [{ symbol: 'CRM', price: 250 }, { symbol: 'INTC', price: 30 }, { symbol: 'ETH', price: 2500, isCrypto: true, direction: 'long' }],
};
const ACTIVE_DOC = {
  agentId: 'agent-1',
  ownerId: 'u1',
  status: 'active',
  gameMode: 'baggerbomb_agent',
  activatedAt: '2026-10-01T13:30:00.000Z',
  createdAt: '2026-10-01T13:00:00.000Z',
  agentContext: { agentName: 'Aurora', archetype: 'degen' },
  scoreState: { currentScore: 12.4, opponentScore: 3.1, tradeCount: 1, evaluationCount: 3, lastScoredAt: '2026-10-01T16:47:00.000Z' },
  timing: { tradingDays: ['d1', 'd2', 'd3', 'd4', 'd5'], currentTradingDay: 1 },
  portfolio: PLAYER_PORTFOLIO,
  opponent: { odUserId: 'cpu', portfolio: CPU_PORTFOLIO },
  scoring: { thresholds: { AAPL: { threshold: 2.5 }, NVDA: { threshold: 3.5 }, MSFT: { threshold: 2 }, TSLA: { threshold: 4 }, BTC: { threshold: 5 } } },
  thresholdHistory: { NVDA: { maxMultiplier: 1.2, minMultiplier: 0 }, GOOGL: { maxMultiplier: 0, minMultiplier: -1.1 } },
  trades: [{ symbolOut: 'XOM', symbolIn: 'TSLA', lockedPoints: 7.5, executedAt: '2026-10-01T15:00:00.000Z' }],
  statusFeed: [],
  chatExchanges: [],
  evaluations: [],
};
/** The opening prop: a client snapshot that nothing refreshes (DashboardDesktop / App). */
const openingProp = ({ direct = true, portfolio = PLAYER_PORTFOLIO, opponent = CPU_PORTFOLIO } = {}) => ({
  agentId: 'agent-1',
  ...(direct ? { agentBattleId: 'ab-1' } : {}),
  agentDeployed: true,
  creator: { portfolio },
  opponent: { portfolio: opponent },
  state: { startingPrices: PLAYER_PORTFOLIO.startingPrices },
});

const docSnap = (id, data) => ({ id, exists: () => data != null, data: () => (data == null ? undefined : JSON.parse(JSON.stringify(data))) });
const querySnap = (ids, { fromCache = false } = {}) => ({ empty: ids.length === 0, docs: ids.map((id) => ({ id })), metadata: { fromCache, hasPendingWrites: false } });
const activeListener = (kind, key) => [...fsBox.listeners].reverse().find((l) => l.active && l.kind === kind && (key === undefined || l.key === key));

const flush = async () => {
  for (let i = 0; i < 4; i++) await act(async () => { await Promise.resolve(); });
};
async function mount(battle) {
  await act(async () => {
    root.render(<AgentBattleScreen battle={battle} user={{ uid: 'u1' }} onBack={() => {}} onOpenFilmRoom={null} />);
  });
  await flush();
}
async function deliverDoc(id, data) {
  const l = activeListener('doc', id);
  if (!l) throw new Error(`no active doc listener for ${id}`);
  await act(async () => { l.next(docSnap(id, data)); });
  await flush();
}
async function failDoc(id, err = { message: 'permission-denied', code: 'permission-denied' }) {
  const l = activeListener('doc', id);
  await act(async () => { l.error(err); });
  await flush();
}
async function deliverQuery(agentId, ids, opts) {
  const l = activeListener('query', agentId);
  if (!l) throw new Error(`no active query listener for ${agentId}`);
  await act(async () => { l.next(querySnap(ids, opts)); });
  await flush();
}
async function poll() {
  await act(async () => { vi.advanceTimersByTime(60000); });
  await flush();
}
const html = () => container.innerHTML;

/** The row's clickable symbol for `symbol` on `side` ('player' = left, 'cpu' = right). */
function symbolEl(symbol, side = 'player') {
  const all = [...container.querySelectorAll('div')].filter((d) => d.style.display === 'inline-block'
    && d.style.cursor === 'pointer' && d.firstChild && d.firstChild.textContent === symbol);
  return side === 'player' ? all[0] : all[all.length - 1];
}
function pointsEl(symbol, side = 'player') {
  const sym = symbolEl(symbol, side);
  const topRow = sym?.parentElement?.parentElement;
  return topRow?.children?.[1]?.children?.[0] ?? null;
}
async function click(el) {
  await act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); });
  await flush();
}

/** One flag-off scenario's whole observable record. */
const record = () => ({
  html: digest(html()),
  priceCalls: [...priceBox.calls],
  fsLog: [...fsBox.log],
  research: [...seen.research],
  breakdown: [...seen.breakdown],
  presence: [...seen.presence],
});

// BEGIN GENERATED OFF REFERENCES — captured at the pre-build SHA 44d0c63eba4e3099552d3ec3dbde6a89660a7e06 (15 entries; loadingReturn and swapTransition added after the first capture, captured at the same SHA).
// Regenerate ONLY by re-running this file's OFF rows at that SHA with
// SHADOW_OFF_CAPTURE_DIR set; never by blessing build output.
const OFF = {
 "battleSwitch": {
  "afterB": {
   "breakdown": [],
   "fsLog": [
    [
     "subscribe",
     "doc",
     "ab-1",
     3
    ],
    [
     "unsubscribe",
     "doc",
     "ab-1"
    ],
    [
     "subscribe",
     "doc",
     "ab-2",
     3
    ]
   ],
   "html": {
    "length": 77813,
    "sha256": "c8193fc6e6ae355414c4169abaa3206d404d58035c8a926a5540ad5fb55d2d72"
   },
   "presence": [],
   "priceCalls": [
    [
     "stock",
     [
      "AAPL",
      "NVDA",
      "MSFT",
      "TSLA",
      "AMZN",
      "META",
      "GOOGL",
      "AMD",
      "NFLX",
      "ORCL",
      "CRM",
      "INTC"
     ]
    ],
    [
     "crypto",
     [
      "BTC",
      "ETH"
     ]
    ],
    [
     "stock",
     [
      "AAPL",
      "NVDA",
      "MSFT",
      "TSLA",
      "AMZN",
      "META",
      "GOOGL",
      "AMD",
      "NFLX",
      "ORCL",
      "CRM",
      "INTC"
     ]
    ],
    [
     "crypto",
     [
      "BTC",
      "ETH"
     ]
    ]
   ],
   "research": []
  },
  "beforeB": {
   "breakdown": [],
   "fsLog": [
    [
     "subscribe",
     "doc",
     "ab-1",
     3
    ],
    [
     "unsubscribe",
     "doc",
     "ab-1"
    ],
    [
     "subscribe",
     "doc",
     "ab-2",
     3
    ]
   ],
   "html": {
    "length": 77813,
    "sha256": "c8193fc6e6ae355414c4169abaa3206d404d58035c8a926a5540ad5fb55d2d72"
   },
   "presence": [],
   "priceCalls": [
    [
     "stock",
     [
      "AAPL",
      "NVDA",
      "MSFT",
      "TSLA",
      "AMZN",
      "META",
      "GOOGL",
      "AMD",
      "NFLX",
      "ORCL",
      "CRM",
      "INTC"
     ]
    ],
    [
     "crypto",
     [
      "BTC",
      "ETH"
     ]
    ],
    [
     "stock",
     [
      "AAPL",
      "NVDA",
      "MSFT",
      "TSLA",
      "AMZN",
      "META",
      "GOOGL",
      "AMD",
      "NFLX",
      "ORCL",
      "CRM",
      "INTC"
     ]
    ],
    [
     "crypto",
     [
      "BTC",
      "ETH"
     ]
    ]
   ],
   "research": []
  }
 },
 "chatResearch": {
  "research": [
   {
    "asset": {
     "lockedPrice": null,
     "name": "CRWD",
     "percentChange": 0,
     "price": 0,
     "symbol": "CRWD",
     "threshold": 2.5
    },
    "defaultTab": "baggerbomb",
    "defaultTimeframe": "bomb",
    "isGameContext": true,
    "onClose": "function",
    "showActionButton": false,
    "version": 2
   },
   {
    "asset": {
     "lockedPrice": 150,
     "name": "AAPL",
     "percentChange": 2,
     "price": 153,
     "symbol": "AAPL",
     "threshold": 2.5
    },
    "defaultTab": "baggerbomb",
    "defaultTimeframe": "bomb",
    "isGameContext": true,
    "onClose": "function",
    "showActionButton": false,
    "version": 2,
    "wsPrice": 153
   }
  ]
 },
 "completed": {
  "breakdown": [],
  "fsLog": [
   [
    "subscribe",
    "doc",
    "ab-1",
    3
   ]
  ],
  "html": {
   "length": 77269,
   "sha256": "c779035c9d27810b7c9f22aab4a1b5c06827c42ffe78493e420f1f7adcb4f172"
  },
  "presence": [],
  "priceCalls": [
   [
    "stock",
    [
     "AAPL",
     "NVDA",
     "MSFT",
     "TSLA",
     "AMZN",
     "META",
     "GOOGL",
     "AMD",
     "NFLX",
     "ORCL",
     "CRM",
     "INTC"
    ]
   ],
   [
    "crypto",
    [
     "BTC",
     "ETH"
    ]
   ],
   [
    "stock",
    [
     "AAPL",
     "NVDA",
     "MSFT",
     "TSLA",
     "AMZN",
     "META",
     "GOOGL",
     "AMD",
     "NFLX",
     "ORCL",
     "CRM",
     "INTC"
    ]
   ],
   [
    "crypto",
    [
     "BTC",
     "ETH"
    ]
   ]
  ],
  "research": []
 },
 "dayTwo": {
  "breakdown": [],
  "fsLog": [
   [
    "subscribe",
    "doc",
    "ab-1",
    3
   ]
  ],
  "html": {
   "length": 77813,
   "sha256": "648d5b6ade11a353a201c9e9e8ef4287f3fbda98f311b984fc90bd99607a46d1"
  },
  "presence": [],
  "priceCalls": [
   [
    "stock",
    [
     "AAPL",
     "NVDA",
     "MSFT",
     "TSLA",
     "AMZN",
     "META",
     "GOOGL",
     "AMD",
     "NFLX",
     "ORCL",
     "CRM",
     "INTC"
    ]
   ],
   [
    "crypto",
    [
     "BTC",
     "ETH"
    ]
   ],
   [
    "stock",
    [
     "AAPL",
     "NVDA",
     "MSFT",
     "TSLA",
     "AMZN",
     "META",
     "GOOGL",
     "AMD",
     "NFLX",
     "ORCL",
     "CRM",
     "INTC"
    ]
   ],
   [
    "crypto",
    [
     "BTC",
     "ETH"
    ]
   ]
  ],
  "research": []
 },
 "failureAndRecovery": {
  "failed": {
   "breakdown": [],
   "fsLog": [
    [
     "subscribe",
     "doc",
     "ab-1",
     3
    ]
   ],
   "html": {
    "length": 80545,
    "sha256": "45cc83ab0a71f0532e1d200ebf4bc1e19b1bb11b4bdddb25f641d2a603d01ab6"
   },
   "presence": [],
   "priceCalls": [
    [
     "stock",
     [
      "AAPL",
      "NVDA",
      "MSFT",
      "TSLA",
      "AMZN",
      "META",
      "GOOGL",
      "AMD",
      "NFLX",
      "ORCL",
      "CRM",
      "INTC"
     ]
    ],
    [
     "crypto",
     [
      "BTC",
      "ETH"
     ]
    ],
    [
     "stock",
     [
      "AAPL",
      "NVDA",
      "MSFT",
      "TSLA",
      "AMZN",
      "META",
      "GOOGL",
      "AMD",
      "NFLX",
      "ORCL",
      "CRM",
      "INTC"
     ]
    ],
    [
     "crypto",
     [
      "BTC",
      "ETH"
     ]
    ]
   ],
   "research": []
  },
  "recovered": {
   "breakdown": [],
   "fsLog": [
    [
     "subscribe",
     "doc",
     "ab-1",
     3
    ]
   ],
   "html": {
    "length": 78073,
    "sha256": "3269a47ab3e975081e340c8b1759c985c18f56cc0752ac80b68945204171b4f2"
   },
   "presence": [],
   "priceCalls": [
    [
     "stock",
     [
      "AAPL",
      "NVDA",
      "MSFT",
      "TSLA",
      "AMZN",
      "META",
      "GOOGL",
      "AMD",
      "NFLX",
      "ORCL",
      "CRM",
      "INTC"
     ]
    ],
    [
     "crypto",
     [
      "BTC",
      "ETH"
     ]
    ],
    [
     "stock",
     [
      "AAPL",
      "NVDA",
      "MSFT",
      "TSLA",
      "AMZN",
      "META",
      "GOOGL",
      "AMD",
      "NFLX",
      "ORCL",
      "CRM",
      "INTC"
     ]
    ],
    [
     "crypto",
     [
      "BTC",
      "ETH"
     ]
    ],
    [
     "stock",
     [
      "AAPL",
      "NVDA",
      "MSFT",
      "TSLA",
      "AMZN",
      "META",
      "GOOGL",
      "AMD",
      "NFLX",
      "ORCL",
      "CRM",
      "INTC"
     ]
    ],
    [
     "crypto",
     [
      "BTC",
      "ETH"
     ]
    ]
   ],
   "research": []
  }
 },
 "initialZerosLoading": {
  "breakdown": [],
  "fsLog": [
   [
    "subscribe",
    "doc",
    "ab-1",
    3
   ]
  ],
  "html": {
   "length": 76679,
   "sha256": "65e24eda979ec2ca0d6be549e16282ce5c4a4b13c76b4d511ee629296a45873e"
  },
  "presence": [],
  "priceCalls": [
   [
    "stock",
    [
     "AAPL",
     "NVDA",
     "MSFT",
     "TSLA",
     "AMZN",
     "META",
     "GOOGL",
     "AMD",
     "NFLX",
     "ORCL",
     "CRM",
     "INTC"
    ]
   ],
   [
    "crypto",
    [
     "BTC",
     "ETH"
    ]
   ],
   [
    "stock",
    [
     "AAPL",
     "NVDA",
     "MSFT",
     "TSLA",
     "AMZN",
     "META",
     "GOOGL",
     "AMD",
     "NFLX",
     "ORCL",
     "CRM",
     "INTC"
    ]
   ],
   [
    "crypto",
    [
     "BTC",
     "ETH"
    ]
   ]
  ],
  "research": []
 },
 "loadingReturn": {
  "pane": {
   "html": "<div style=\"min-height: 100vh; background: rgb(0, 0, 0); display: flex; align-items: center; justify-content: center;\"><div style=\"display: flex; flex-direction: column; align-items: center; gap: 12px;\"><div><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#5eead4\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-bot\" aria-hidden=\"true\"><path d=\"M12 8V4H8\"></path><rect width=\"16\" height=\"12\" x=\"4\" y=\"8\" rx=\"2\"></rect><path d=\"M2 14h2\"></path><path d=\"M20 14h2\"></path><path d=\"M15 13v2\"></path><path d=\"M9 13v2\"></path></svg></div><span style=\"font-size: 13px; color: rgb(0, 0, 0);\">Loading agent battle...</span></div></div>",
   "text": "Loading agent battle..."
  },
  "tabbed": {
   "html": "<div style=\"min-height: 100vh; background: rgb(0, 0, 0); display: flex; align-items: center; justify-content: center;\"><div style=\"display: flex; flex-direction: column; align-items: center; gap: 12px;\"><div><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#5eead4\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-bot\" aria-hidden=\"true\"><path d=\"M12 8V4H8\"></path><rect width=\"16\" height=\"12\" x=\"4\" y=\"8\" rx=\"2\"></rect><path d=\"M2 14h2\"></path><path d=\"M20 14h2\"></path><path d=\"M15 13v2\"></path><path d=\"M9 13v2\"></path></svg></div><span style=\"font-size: 13px; color: rgb(0, 0, 0);\">Loading agent battle...</span></div></div>",
   "text": "Loading agent battle..."
  }
 },
 "paneDesktopActive": {
  "after": {
   "breakdown": [
    {
     "asset": {
      "baggerBombPoints": 15,
      "baggerBombs": 1,
      "basePoints": 22,
      "bustPoints": 0,
      "busts": 0,
      "currentPrice": 920,
      "gain": 2.2222222222222223,
      "startingPrice": 900,
      "symbol": "NVDA",
      "threshold": 3.5,
      "tierMultiplier": 1,
      "totalScore": 59
     },
     "entryPrice": 900
    }
   ],
   "fsLog": [
    [
     "subscribe",
     "doc",
     "ab-1",
     3
    ]
   ],
   "html": {
    "length": 77860,
    "sha256": "e59075715b59460eae44c260de7e1ea796a86b1fac4d18102bccf926b3ca5b88"
   },
   "presence": [],
   "priceCalls": [
    [
     "stock",
     [
      "AAPL",
      "NVDA",
      "MSFT",
      "TSLA",
      "AMZN",
      "META",
      "GOOGL",
      "AMD",
      "NFLX",
      "ORCL",
      "CRM",
      "INTC"
     ]
    ],
    [
     "crypto",
     [
      "BTC",
      "ETH"
     ]
    ],
    [
     "stock",
     [
      "AAPL",
      "NVDA",
      "MSFT",
      "TSLA",
      "AMZN",
      "META",
      "GOOGL",
      "AMD",
      "NFLX",
      "ORCL",
      "CRM",
      "INTC"
     ]
    ],
    [
     "crypto",
     [
      "BTC",
      "ETH"
     ]
    ],
    [
     "stock",
     [
      "AAPL",
      "NVDA",
      "MSFT",
      "TSLA",
      "AMZN",
      "META",
      "GOOGL",
      "AMD",
      "NFLX",
      "ORCL",
      "CRM",
      "INTC"
     ]
    ],
    [
     "crypto",
     [
      "BTC",
      "ETH"
     ]
    ]
   ],
   "research": [
    {
     "asset": {
      "currentPrice": 153,
      "lockedPrice": 150,
      "name": "AAPL",
      "percentChange": 2,
      "price": 153,
      "symbol": "AAPL",
      "threshold": 2.5
     },
     "defaultTab": "baggerbomb",
     "defaultTimeframe": "bomb",
     "isGameContext": true,
     "onClose": "function",
     "showActionButton": false,
     "version": 2,
     "wsPrice": 153
    },
    {
     "asset": {
      "currentPrice": 162,
      "lockedPrice": null,
      "name": "GOOGL",
      "percentChange": 1.25,
      "price": 162,
      "symbol": "GOOGL",
      "threshold": 2.5
     },
     "defaultTab": "baggerbomb",
     "defaultTimeframe": "bomb",
     "isGameContext": true,
     "onClose": "function",
     "showActionButton": false,
     "version": 2,
     "wsPrice": 162
    },
    {
     "asset": {
      "currentPrice": 162,
      "lockedPrice": null,
      "name": "GOOGL",
      "percentChange": 1.25,
      "price": 162,
      "symbol": "GOOGL",
      "threshold": 2.5
     },
     "defaultTab": "baggerbomb",
     "defaultTimeframe": "bomb",
     "isGameContext": true,
     "onClose": "function",
     "showActionButton": false,
     "version": 2,
     "wsPrice": 162
    }
   ]
  },
  "polled": {
   "html": {
    "length": 77778,
    "sha256": "1bfc2a9a99ed2b1bf9f9cb624dd56dfd2e44aa575851dd3f8d796b7dfbd392ce"
   },
   "priceCalls": [
    [
     "stock",
     [
      "AAPL",
      "NVDA",
      "MSFT",
      "TSLA",
      "AMZN",
      "META",
      "GOOGL",
      "AMD",
      "NFLX",
      "ORCL",
      "CRM",
      "INTC"
     ]
    ],
    [
     "crypto",
     [
      "BTC",
      "ETH"
     ]
    ],
    [
     "stock",
     [
      "AAPL",
      "NVDA",
      "MSFT",
      "TSLA",
      "AMZN",
      "META",
      "GOOGL",
      "AMD",
      "NFLX",
      "ORCL",
      "CRM",
      "INTC"
     ]
    ],
    [
     "crypto",
     [
      "BTC",
      "ETH"
     ]
    ],
    [
     "stock",
     [
      "AAPL",
      "NVDA",
      "MSFT",
      "TSLA",
      "AMZN",
      "META",
      "GOOGL",
      "AMD",
      "NFLX",
      "ORCL",
      "CRM",
      "INTC"
     ]
    ],
    [
     "crypto",
     [
      "BTC",
      "ETH"
     ]
    ]
   ]
  },
  "priced": {
   "breakdown": [],
   "fsLog": [
    [
     "subscribe",
     "doc",
     "ab-1",
     3
    ]
   ],
   "html": {
    "length": 77813,
    "sha256": "c8193fc6e6ae355414c4169abaa3206d404d58035c8a926a5540ad5fb55d2d72"
   },
   "presence": [],
   "priceCalls": [
    [
     "stock",
     [
      "AAPL",
      "NVDA",
      "MSFT",
      "TSLA",
      "AMZN",
      "META",
      "GOOGL",
      "AMD",
      "NFLX",
      "ORCL",
      "CRM",
      "INTC"
     ]
    ],
    [
     "crypto",
     [
      "BTC",
      "ETH"
     ]
    ],
    [
     "stock",
     [
      "AAPL",
      "NVDA",
      "MSFT",
      "TSLA",
      "AMZN",
      "META",
      "GOOGL",
      "AMD",
      "NFLX",
      "ORCL",
      "CRM",
      "INTC"
     ]
    ],
    [
     "crypto",
     [
      "BTC",
      "ETH"
     ]
    ]
   ],
   "research": []
  }
 },
 "paneMobileActive": {
  "breakdown": [],
  "fsLog": [
   [
    "subscribe",
    "doc",
    "ab-1",
    3
   ]
  ],
  "html": {
   "length": 78067,
   "sha256": "28b71adf29bf10897be25d2b632086d7b44daaf61a62466e43288315aeb2e300"
  },
  "presence": [],
  "priceCalls": [
   [
    "stock",
    [
     "AAPL",
     "NVDA",
     "MSFT",
     "TSLA",
     "AMZN",
     "META",
     "GOOGL",
     "AMD",
     "NFLX",
     "ORCL",
     "CRM",
     "INTC"
    ]
   ],
   [
    "crypto",
    [
     "BTC",
     "ETH"
    ]
   ],
   [
    "stock",
    [
     "AAPL",
     "NVDA",
     "MSFT",
     "TSLA",
     "AMZN",
     "META",
     "GOOGL",
     "AMD",
     "NFLX",
     "ORCL",
     "CRM",
     "INTC"
    ]
   ],
   [
    "crypto",
    [
     "BTC",
     "ETH"
    ]
   ]
  ],
  "research": []
 },
 "paneOffActive": {
  "breakdown": [],
  "fsLog": [
   [
    "subscribe",
    "doc",
    "ab-1",
    3
   ]
  ],
  "html": {
   "length": 69892,
   "sha256": "355e174da6f53bd5fb00ad00233bc41bff9c9e80727d32ab3cd29c9e12f62399"
  },
  "presence": [],
  "priceCalls": [
   [
    "stock",
    [
     "AAPL",
     "NVDA",
     "MSFT",
     "TSLA",
     "AMZN",
     "META",
     "GOOGL",
     "AMD",
     "NFLX",
     "ORCL",
     "CRM",
     "INTC"
    ]
   ],
   [
    "crypto",
    [
     "BTC",
     "ETH"
    ]
   ],
   [
    "stock",
    [
     "AAPL",
     "NVDA",
     "MSFT",
     "TSLA",
     "AMZN",
     "META",
     "GOOGL",
     "AMD",
     "NFLX",
     "ORCL",
     "CRM",
     "INTC"
    ]
   ],
   [
    "crypto",
    [
     "BTC",
     "ETH"
    ]
   ]
  ],
  "research": []
 },
 "presenceFaces": {
  "pane": [
   {
    "duel": {
     "opponentScore": 88,
     "playerScore": 183,
     "statusFeed": null
    },
    "reactivityLevel": "static"
   },
   {
    "duel": {
     "opponentScore": 88,
     "playerScore": 183,
     "statusFeed": null
    },
    "reactivityLevel": "static"
   },
   {
    "duel": {
     "opponentScore": 88,
     "playerScore": 183,
     "statusFeed": null
    },
    "reactivityLevel": "static"
   },
   {
    "duel": {
     "opponentScore": 88,
     "playerScore": 183,
     "statusFeed": null
    },
    "reactivityLevel": "static"
   }
  ],
  "paneOff": [
   {
    "duel": {
     "opponentScore": 88,
     "playerScore": 183,
     "statusFeed": []
    },
    "reactivityLevel": null
   },
   {
    "duel": {
     "opponentScore": 88,
     "playerScore": 183,
     "statusFeed": []
    },
    "reactivityLevel": null
   }
  ]
 },
 "queryPath": {
  "pending": {
   "breakdown": [],
   "fsLog": [
    [
     "subscribe",
     "query",
     "agent-1",
     3
    ]
   ],
   "html": {
    "length": 719,
    "sha256": "fcac21e1aa1300194723471ef1af296b6f1c78aad9924a1aa330f60d9417b534"
   },
   "presence": [],
   "priceCalls": [
    [
     "stock",
     [
      "AAPL",
      "NVDA",
      "MSFT",
      "TSLA",
      "AMZN",
      "META",
      "GOOGL",
      "AMD",
      "NFLX",
      "ORCL",
      "CRM",
      "INTC"
     ]
    ],
    [
     "crypto",
     [
      "BTC",
      "ETH"
     ]
    ]
   ],
   "research": []
  },
  "resolved": {
   "breakdown": [],
   "fsLog": [
    [
     "subscribe",
     "query",
     "agent-1",
     3
    ],
    [
     "subscribe",
     "doc",
     "ab-1",
     3
    ]
   ],
   "html": {
    "length": 77813,
    "sha256": "c8193fc6e6ae355414c4169abaa3206d404d58035c8a926a5540ad5fb55d2d72"
   },
   "presence": [],
   "priceCalls": [
    [
     "stock",
     [
      "AAPL",
      "NVDA",
      "MSFT",
      "TSLA",
      "AMZN",
      "META",
      "GOOGL",
      "AMD",
      "NFLX",
      "ORCL",
      "CRM",
      "INTC"
     ]
    ],
    [
     "crypto",
     [
      "BTC",
      "ETH"
     ]
    ],
    [
     "stock",
     [
      "AAPL",
      "NVDA",
      "MSFT",
      "TSLA",
      "AMZN",
      "META",
      "GOOGL",
      "AMD",
      "NFLX",
      "ORCL",
      "CRM",
      "INTC"
     ]
    ],
    [
     "crypto",
     [
      "BTC",
      "ETH"
     ]
    ]
   ],
   "research": []
  }
 },
 "subscriptionError": {
  "breakdown": [],
  "fsLog": [
   [
    "subscribe",
    "doc",
    "ab-1",
    3
   ]
  ],
  "html": {
   "length": 77813,
   "sha256": "c8193fc6e6ae355414c4169abaa3206d404d58035c8a926a5540ad5fb55d2d72"
  },
  "presence": [],
  "priceCalls": [
   [
    "stock",
    [
     "AAPL",
     "NVDA",
     "MSFT",
     "TSLA",
     "AMZN",
     "META",
     "GOOGL",
     "AMD",
     "NFLX",
     "ORCL",
     "CRM",
     "INTC"
    ]
   ],
   [
    "crypto",
    [
     "BTC",
     "ETH"
    ]
   ],
   [
    "stock",
    [
     "AAPL",
     "NVDA",
     "MSFT",
     "TSLA",
     "AMZN",
     "META",
     "GOOGL",
     "AMD",
     "NFLX",
     "ORCL",
     "CRM",
     "INTC"
    ]
   ],
   [
    "crypto",
    [
     "BTC",
     "ETH"
    ]
   ]
  ],
  "research": []
 },
 "swapTransition": {
  "before": {
   "html": {
    "sha256": "479a3241f9860013f4cb74eebfcff340d5d622ed13f0c625f9c22917f5c5cd76",
    "length": 77894
   },
   "priceCalls": [
    [
     "stock",
     [
      "AAPL",
      "NVDA",
      "MSFT",
      "TSLA",
      "AMZN",
      "META",
      "GOOGL",
      "AMD",
      "NFLX",
      "ORCL",
      "CRM",
      "INTC"
     ]
    ],
    [
     "crypto",
     [
      "BTC",
      "ETH"
     ]
    ],
    [
     "stock",
     [
      "AAPL",
      "NVDA",
      "MSFT",
      "TSLA",
      "AMZN",
      "META",
      "GOOGL",
      "AMD",
      "NFLX",
      "ORCL",
      "CRM",
      "INTC"
     ]
    ],
    [
     "crypto",
     [
      "BTC",
      "ETH"
     ]
    ]
   ],
   "fsLog": [
    [
     "subscribe",
     "doc",
     "ab-1",
     3
    ]
   ],
   "research": [
    {
     "asset": {
      "symbol": "TSLA",
      "name": "TSLA",
      "price": 255,
      "percentChange": 2.82258064516129,
      "threshold": 4,
      "lockedPrice": null,
      "currentPrice": 255
     },
     "onClose": "function",
     "showActionButton": false,
     "isGameContext": true,
     "version": 2,
     "defaultTab": "baggerbomb",
     "defaultTimeframe": "bomb",
     "wsPrice": 255
    }
   ],
   "breakdown": [
    {
     "asset": {
      "symbol": "MSFT",
      "gain": 1,
      "threshold": 2,
      "tierMultiplier": 1,
      "baggerBombs": 0,
      "busts": 0,
      "basePoints": 10,
      "baggerBombPoints": 0,
      "bustPoints": 0,
      "totalScore": 15,
      "startingPrice": 400,
      "currentPrice": 404
     },
     "entryPrice": 400
    },
    {
     "asset": {
      "symbol": "MSFT",
      "gain": 1,
      "threshold": 2,
      "tierMultiplier": 1,
      "baggerBombs": 0,
      "busts": 0,
      "basePoints": 10,
      "baggerBombPoints": 0,
      "bustPoints": 0,
      "totalScore": 15,
      "startingPrice": 400,
      "currentPrice": 404
     },
     "entryPrice": 400
    }
   ],
   "presence": []
  },
  "afterSwap": {
   "html": {
    "sha256": "b64f91c1f3af1b475c5e67a28d2781fe3e1ef90fdfabc8d84ebeb371136d4998",
    "length": 77912
   },
   "priceCalls": [
    [
     "stock",
     [
      "AAPL",
      "NVDA",
      "MSFT",
      "TSLA",
      "AMZN",
      "META",
      "GOOGL",
      "AMD",
      "NFLX",
      "ORCL",
      "CRM",
      "INTC"
     ]
    ],
    [
     "crypto",
     [
      "BTC",
      "ETH"
     ]
    ],
    [
     "stock",
     [
      "AAPL",
      "NVDA",
      "MSFT",
      "TSLA",
      "AMZN",
      "META",
      "GOOGL",
      "AMD",
      "NFLX",
      "ORCL",
      "CRM",
      "INTC"
     ]
    ],
    [
     "crypto",
     [
      "BTC",
      "ETH"
     ]
    ],
    [
     "stock",
     [
      "AAPL",
      "NVDA",
      "XOM",
      "TSLA",
      "AMZN",
      "META",
      "GOOGL",
      "AMD",
      "NFLX",
      "ORCL",
      "CRM",
      "INTC"
     ]
    ],
    [
     "crypto",
     [
      "BTC",
      "ETH"
     ]
    ]
   ],
   "fsLog": [
    [
     "subscribe",
     "doc",
     "ab-1",
     3
    ]
   ],
   "research": [
    {
     "asset": {
      "symbol": "TSLA",
      "name": "TSLA",
      "price": 255,
      "percentChange": 2.82258064516129,
      "threshold": 4,
      "lockedPrice": null,
      "currentPrice": 255
     },
     "onClose": "function",
     "showActionButton": false,
     "isGameContext": true,
     "version": 2,
     "defaultTab": "baggerbomb",
     "defaultTimeframe": "bomb",
     "wsPrice": 255
    },
    {
     "asset": {
      "symbol": "TSLA",
      "name": "TSLA",
      "price": 255,
      "percentChange": 2.82258064516129,
      "threshold": 4,
      "lockedPrice": null,
      "currentPrice": 255
     },
     "onClose": "function",
     "showActionButton": false,
     "isGameContext": true,
     "version": 2,
     "defaultTab": "baggerbomb",
     "defaultTimeframe": "bomb",
     "wsPrice": 255
    },
    {
     "asset": {
      "symbol": "TSLA",
      "name": "TSLA",
      "price": 255,
      "percentChange": 2.82258064516129,
      "threshold": 4,
      "lockedPrice": null,
      "currentPrice": 255
     },
     "onClose": "function",
     "showActionButton": false,
     "isGameContext": true,
     "version": 2,
     "defaultTab": "baggerbomb",
     "defaultTimeframe": "bomb",
     "wsPrice": 255
    }
   ],
   "breakdown": [
    {
     "asset": {
      "symbol": "MSFT",
      "gain": 1,
      "threshold": 2,
      "tierMultiplier": 1,
      "baggerBombs": 0,
      "busts": 0,
      "basePoints": 10,
      "baggerBombPoints": 0,
      "bustPoints": 0,
      "totalScore": 15,
      "startingPrice": 400,
      "currentPrice": 404
     },
     "entryPrice": 400
    },
    {
     "asset": {
      "symbol": "MSFT",
      "gain": 1,
      "threshold": 2,
      "tierMultiplier": 1,
      "baggerBombs": 0,
      "busts": 0,
      "basePoints": 10,
      "baggerBombPoints": 0,
      "bustPoints": 0,
      "totalScore": 15,
      "startingPrice": 400,
      "currentPrice": 404
     },
     "entryPrice": 400
    },
    {
     "asset": {
      "symbol": "MSFT",
      "gain": 1,
      "threshold": 2,
      "tierMultiplier": 1,
      "baggerBombs": 0,
      "busts": 0,
      "basePoints": 10,
      "baggerBombPoints": 0,
      "bustPoints": 0,
      "totalScore": 15,
      "startingPrice": 400,
      "currentPrice": 404
     },
     "entryPrice": 400
    },
    {
     "asset": {
      "symbol": "MSFT",
      "gain": 1,
      "threshold": 2,
      "tierMultiplier": 1,
      "baggerBombs": 0,
      "busts": 0,
      "basePoints": 10,
      "baggerBombPoints": 0,
      "bustPoints": 0,
      "totalScore": 15,
      "startingPrice": 400,
      "currentPrice": 404
     },
     "entryPrice": 400
    }
   ],
   "presence": []
  },
  "polled": {
   "html": {
    "sha256": "f499c3689dc9f22f13c1f073226655e0c25699c4936cad1905d469fa6903eb02",
    "length": 77874
   },
   "priceCalls": [
    [
     "stock",
     [
      "AAPL",
      "NVDA",
      "MSFT",
      "TSLA",
      "AMZN",
      "META",
      "GOOGL",
      "AMD",
      "NFLX",
      "ORCL",
      "CRM",
      "INTC"
     ]
    ],
    [
     "crypto",
     [
      "BTC",
      "ETH"
     ]
    ],
    [
     "stock",
     [
      "AAPL",
      "NVDA",
      "MSFT",
      "TSLA",
      "AMZN",
      "META",
      "GOOGL",
      "AMD",
      "NFLX",
      "ORCL",
      "CRM",
      "INTC"
     ]
    ],
    [
     "crypto",
     [
      "BTC",
      "ETH"
     ]
    ],
    [
     "stock",
     [
      "AAPL",
      "NVDA",
      "XOM",
      "TSLA",
      "AMZN",
      "META",
      "GOOGL",
      "AMD",
      "NFLX",
      "ORCL",
      "CRM",
      "INTC"
     ]
    ],
    [
     "crypto",
     [
      "BTC",
      "ETH"
     ]
    ],
    [
     "stock",
     [
      "AAPL",
      "NVDA",
      "XOM",
      "TSLA",
      "AMZN",
      "META",
      "GOOGL",
      "AMD",
      "NFLX",
      "ORCL",
      "CRM",
      "INTC"
     ]
    ],
    [
     "crypto",
     [
      "BTC",
      "ETH"
     ]
    ]
   ],
   "fsLog": [
    [
     "subscribe",
     "doc",
     "ab-1",
     3
    ]
   ],
   "research": [
    {
     "asset": {
      "symbol": "TSLA",
      "name": "TSLA",
      "price": 255,
      "percentChange": 2.82258064516129,
      "threshold": 4,
      "lockedPrice": null,
      "currentPrice": 255
     },
     "onClose": "function",
     "showActionButton": false,
     "isGameContext": true,
     "version": 2,
     "defaultTab": "baggerbomb",
     "defaultTimeframe": "bomb",
     "wsPrice": 255
    },
    {
     "asset": {
      "symbol": "TSLA",
      "name": "TSLA",
      "price": 255,
      "percentChange": 2.82258064516129,
      "threshold": 4,
      "lockedPrice": null,
      "currentPrice": 255
     },
     "onClose": "function",
     "showActionButton": false,
     "isGameContext": true,
     "version": 2,
     "defaultTab": "baggerbomb",
     "defaultTimeframe": "bomb",
     "wsPrice": 255
    },
    {
     "asset": {
      "symbol": "TSLA",
      "name": "TSLA",
      "price": 255,
      "percentChange": 2.82258064516129,
      "threshold": 4,
      "lockedPrice": null,
      "currentPrice": 255
     },
     "onClose": "function",
     "showActionButton": false,
     "isGameContext": true,
     "version": 2,
     "defaultTab": "baggerbomb",
     "defaultTimeframe": "bomb",
     "wsPrice": 255
    },
    {
     "asset": {
      "symbol": "TSLA",
      "name": "TSLA",
      "price": 255,
      "percentChange": 2.82258064516129,
      "threshold": 4,
      "lockedPrice": null,
      "currentPrice": 255
     },
     "onClose": "function",
     "showActionButton": false,
     "isGameContext": true,
     "version": 2,
     "defaultTab": "baggerbomb",
     "defaultTimeframe": "bomb",
     "wsPrice": 255
    }
   ],
   "breakdown": [
    {
     "asset": {
      "symbol": "MSFT",
      "gain": 1,
      "threshold": 2,
      "tierMultiplier": 1,
      "baggerBombs": 0,
      "busts": 0,
      "basePoints": 10,
      "baggerBombPoints": 0,
      "bustPoints": 0,
      "totalScore": 15,
      "startingPrice": 400,
      "currentPrice": 404
     },
     "entryPrice": 400
    },
    {
     "asset": {
      "symbol": "MSFT",
      "gain": 1,
      "threshold": 2,
      "tierMultiplier": 1,
      "baggerBombs": 0,
      "busts": 0,
      "basePoints": 10,
      "baggerBombPoints": 0,
      "bustPoints": 0,
      "totalScore": 15,
      "startingPrice": 400,
      "currentPrice": 404
     },
     "entryPrice": 400
    },
    {
     "asset": {
      "symbol": "MSFT",
      "gain": 1,
      "threshold": 2,
      "tierMultiplier": 1,
      "baggerBombs": 0,
      "busts": 0,
      "basePoints": 10,
      "baggerBombPoints": 0,
      "bustPoints": 0,
      "totalScore": 15,
      "startingPrice": 400,
      "currentPrice": 404
     },
     "entryPrice": 400
    },
    {
     "asset": {
      "symbol": "MSFT",
      "gain": 1,
      "threshold": 2,
      "tierMultiplier": 1,
      "baggerBombs": 0,
      "busts": 0,
      "basePoints": 10,
      "baggerBombPoints": 0,
      "bustPoints": 0,
      "totalScore": 15,
      "startingPrice": 400,
      "currentPrice": 404
     },
     "entryPrice": 400
    },
    {
     "asset": {
      "symbol": "MSFT",
      "gain": 1,
      "threshold": 2,
      "tierMultiplier": 1,
      "baggerBombs": 0,
      "busts": 0,
      "basePoints": 10,
      "baggerBombPoints": 0,
      "bustPoints": 0,
      "totalScore": 15,
      "startingPrice": 400,
      "currentPrice": 404
     },
     "entryPrice": 400
    }
   ],
   "presence": []
  }
 },
 "tabbedActive": {
  "breakdown": [],
  "fsLog": [
   [
    "subscribe",
    "doc",
    "ab-1",
    3
   ]
  ],
  "html": {
   "length": 63955,
   "sha256": "5f713e84d285553a79c61ec6156f076d0e82f895938ce62bd5cd2f0342072d12"
  },
  "presence": [],
  "priceCalls": [
   [
    "stock",
    [
     "AAPL",
     "NVDA",
     "MSFT",
     "XOM",
     "AMZN",
     "META",
     "GOOGL",
     "AMD",
     "NFLX",
     "ORCL",
     "CRM",
     "INTC"
    ]
   ],
   [
    "crypto",
    [
     "BTC",
     "ETH"
    ]
   ]
  ],
  "research": []
 }
};
// END GENERATED OFF REFERENCES

describe('OFF-5/OFF-6 — flag off: the whole legacy lifecycle is unchanged', () => {
  it('OFF paneDesktopActive: production layout, both sides priced, poll, research and breakdown', async () => {
    priceBox.table = genuineTable();
    await mount(openingProp());
    await deliverDoc('ab-1', ACTIVE_DOC);
    const priced = record();
    await poll();
    const polled = { priceCalls: [...priceBox.calls], html: digest(html()) };
    await click(symbolEl('AAPL', 'player'));
    await click(symbolEl('GOOGL', 'cpu'));
    await click(pointsEl('NVDA', 'player'));
    offReference('paneDesktopActive', { priced, polled, after: record() }, OFF.paneDesktopActive);
  });

  it('OFF paneMobileActive: production layout on the phone', async () => {
    setShell(false);
    priceBox.table = genuineTable();
    await mount(openingProp());
    await deliverDoc('ab-1', ACTIVE_DOC);
    offReference('paneMobileActive', record(), OFF.paneMobileActive);
  });

  it('OFF paneOffActive: controller on, pane off (the A2 layout)', async () => {
    flags.pane = false;
    priceBox.table = genuineTable();
    await mount(openingProp());
    await deliverDoc('ab-1', ACTIVE_DOC);
    offReference('paneOffActive', record(), OFF.paneOffActive);
  });

  it('OFF tabbedActive: controller off — rows read the OPENING PROP, not the subscribed doc', async () => {
    flags.controller = false;
    setShell(false);
    priceBox.table = genuineTable();
    const OLD = { ...PLAYER_PORTFOLIO, core: [{ symbol: 'MSFT', price: 400 }, { symbol: 'XOM', price: 110 }] };
    priceBox.table.XOM = quote('AAPL', { price: 112, previousClose: 111 });
    await mount(openingProp({ portfolio: OLD }));
    await deliverDoc('ab-1', ACTIVE_DOC);
    offReference('tabbedActive', record(), OFF.tabbedActive);
  });

  it('OFF loadingReturn: before the first snapshot the legacy loading return renders the shipped markup', async () => {
    // The build moved the spinner into a shared indicator (the gated pending
    // shell reuses it rather than copying its motion); flag off the markup
    // must stay byte-identical, both layouts and the tabbed screen.
    await mount(openingProp());
    const pane = { html: html(), text: container.textContent };
    flags.controller = false;
    setShell(false);
    await mount(openingProp());
    offReference('loadingReturn', { pane, tabbed: { html: html(), text: container.textContent } }, OFF.loadingReturn);
  });

  it('OFF initialZerosLoading: a new battle (0, null time) while quotes are still in flight', async () => {
    priceBox.mode = 'defer';
    await mount(openingProp());
    await deliverDoc('ab-1', { ...ACTIVE_DOC, scoreState: { currentScore: 0, lastScoredAt: null, tradeCount: 0 }, trades: [] });
    offReference('initialZerosLoading', record(), OFF.initialZerosLoading);
  });

  it('OFF failureAndRecovery: configured fallbacks shown as prices, then a genuine poll', async () => {
    priceBox.table = {
      ...genuineTable(),
      NVDA: { price: 140, previousClose: 140, open: 140, change: 0, percentChange: 0 }, // the stock fallback shape
      ETH: { price: 3400, change24h: 0, isFallback: true },
    };
    await mount(openingProp());
    await deliverDoc('ab-1', ACTIVE_DOC);
    const failed = record();
    priceBox.table = genuineTable();
    await poll();
    offReference('failureAndRecovery', { failed, recovered: record() }, OFF.failureAndRecovery);
  });

  it('OFF dayTwo: previousClose baselines, one missing', async () => {
    priceBox.table = genuineTable();
    priceBox.table.AAPL = quote('AAPL', { previousClose: 0 });
    await mount(openingProp());
    await deliverDoc('ab-1', { ...ACTIVE_DOC, activatedAt: '2026-09-30T13:30:00.000Z', timing: { ...ACTIVE_DOC.timing, currentTradingDay: 2 } });
    offReference('dayTwo', record(), OFF.dayTwo);
  });

  it('OFF completed: the stored final freezes the header', async () => {
    priceBox.table = genuineTable();
    await mount(openingProp());
    await deliverDoc('ab-1', { ...ACTIVE_DOC, status: 'completed', scoreState: { ...ACTIVE_DOC.scoreState, currentScore: 40.25, opponentScore: 38.5 } });
    offReference('completed', record(), OFF.completed);
  });

  it('OFF presenceFaces: the faces\' duel inputs on the production layout and pane-off', async () => {
    flags.presence = true;
    priceBox.table = genuineTable();
    await mount(openingProp());
    await deliverDoc('ab-1', ACTIVE_DOC);
    const pane = [...seen.presence];
    act(() => root.unmount());
    root = createRoot(container);
    seen.presence.length = 0;
    flags.pane = false;
    await mount(openingProp());
    await deliverDoc('ab-1', ACTIVE_DOC);
    offReference('presenceFaces', { pane, paneOff: [...seen.presence] }, OFF.presenceFaces);
  });

  it('OFF queryPath: no direct id — the lookup resolves, then the document', async () => {
    priceBox.table = genuineTable();
    await mount(openingProp({ direct: false }));
    const pending = record();
    await deliverQuery('agent-1', ['ab-1']);
    await deliverDoc('ab-1', ACTIVE_DOC);
    offReference('queryPath', { pending, resolved: record() }, OFF.queryPath);
  });

  it('OFF chatResearch: a non-held chat symbol and a held one open the legacy builder payload', async () => {
    priceBox.table = genuineTable();
    await mount(openingProp());
    await deliverDoc('ab-1', ACTIVE_DOC);
    seen.chatPayload = { symbol: 'CRWD' };
    await click(container.querySelector('[data-test-chat-symbol]'));
    seen.chatPayload = { symbol: 'AAPL' };
    await click(container.querySelector('[data-test-chat-symbol]'));
    offReference('chatResearch', { research: [...seen.research] }, OFF.chatResearch);
  });

  it('OFF battleSwitch: A→B with a shared symbol (screen not remounted)', async () => {
    priceBox.table = genuineTable();
    await mount(openingProp());
    await deliverDoc('ab-1', ACTIVE_DOC);
    await mount({ ...openingProp(), agentBattleId: 'ab-2' });
    const beforeB = record();
    await deliverDoc('ab-2', { ...ACTIVE_DOC, scoreState: { ...ACTIVE_DOC.scoreState, currentScore: 1, opponentScore: 2 } });
    offReference('battleSwitch', { beforeB, afterB: record() }, OFF.battleSwitch);
  });

  it('OFF subscriptionError: an error after a good snapshot keeps the old battle on screen', async () => {
    priceBox.table = genuineTable();
    await mount(openingProp());
    await deliverDoc('ab-1', ACTIVE_DOC);
    await failDoc('ab-1');
    offReference('subscriptionError', record(), OFF.subscriptionError);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// ON — the gated path (isShadowCpuQuoteIntegrityOn() true)
// ═════════════════════════════════════════════════════════════════════════════

const counters = () => [...container.querySelectorAll('span')].filter((s) => s.style.letterSpacing === '-0.06em').map((s) => s.textContent);
function label() {
  const el = container.querySelector('[data-comparison-label]');
  return el ? { kind: el.getAttribute('data-comparison-kind'), text: el.textContent } : null;
}
const unavailableRows = () => [...container.querySelectorAll('[data-quote-unavailable]')].map((e) => e.getAttribute('data-quote-unavailable'));
const rowStatus = (symbol) => [...container.querySelectorAll(`[data-row-quote-status="${symbol}"]`)].map((e) => e.textContent);
const shell = () => container.querySelector('[data-battle-shell]')?.getAttribute('data-battle-shell') ?? null;
// The error identity "Battle unavailable" carries (C-2), exposed as data on the shell.
const shellError = () => container.querySelector('[data-battle-shell]')?.getAttribute('data-battle-error') ?? null;
const lastResearch = () => seen.research[seen.research.length - 1] ?? null;
const lastBar = () => framerSeen.bars[framerSeen.bars.length - 1] ?? null;

async function mountGated(battle = openingProp(), doc = ACTIVE_DOC) {
  flags.gate = true;
  await mount(battle);
  if (doc) await deliverDoc('ab-1', doc);
}

describe('ON — smoke: an admitted battle with genuine quotes', () => {
  it('shows the live browser estimate, priced rows on both sides, and requests only held symbols', async () => {
    priceBox.table = genuineTable();
    await mountGated();
    expect(shell()).toBeNull();
    expect(unavailableRows()).toEqual([]);
    expect(label()).toEqual({ kind: 'browser', text: expect.stringContaining('Live browser estimate') });
    expect(counters().length).toBe(2);
    expect(priceBox.calls).toEqual([
      ['stock', ['AAPL', 'NVDA', 'MSFT', 'TSLA', 'AMZN', 'META', 'GOOGL', 'AMD', 'NFLX', 'ORCL', 'CRM', 'INTC']],
      ['crypto', ['BTC', 'ETH']],
    ]);
  });
});

// ── ON helpers: deferred settlement and a per-commit probe ───────────────────
async function settle(transform = (p) => p.build()) {
  const batch = priceBox.pending.splice(0);
  await act(async () => { for (const p of batch) p.resolve(transform(p)); });
  await flush();
}
async function pollAndSettle() {
  await poll();
  await settle();
}

/** Entry-priced quotes: every position flat against its entry and its close. */
function flatTable() {
  const entries = {
    AAPL: 150, NVDA: 900, MSFT: 400, TSLA: 248, AMZN: 180, META: 500, BTC: 60000,
    GOOGL: 160, AMD: 140, NFLX: 600, ORCL: 120, CRM: 250, INTC: 30, ETH: 2500,
  };
  return Object.fromEntries(Object.entries(entries).map(([s, v]) => [s, quote(s, { price: v, previousClose: v })]));
}
const without = (table, ...syms) => Object.fromEntries(Object.entries(table).filter(([s]) => !syms.includes(s)));
const NEW_DOC = { ...ACTIVE_DOC, scoreState: { currentScore: 0, lastScoredAt: null, tradeCount: 1 }, thresholdHistory: {}, trades: [] };
const STORED = (my, opp, at = '2026-10-01T16:47:00.000Z') => ({ currentScore: my, opponentScore: opp, lastScoredAt: at, tradeCount: 1 });

const commits = [];
function captureCommit() {
  const el = container.querySelector('[data-comparison-label]');
  const bar = container.querySelector('[data-arena-bar] [data-bar-pct], [data-score-bar] [data-bar-pct]');
  commits.push({
    kind: el?.getAttribute('data-comparison-kind') ?? null,
    label: el ? el.firstChild?.textContent ?? null : null,
    prose: container.querySelector('[data-comparison-prose]')?.textContent ?? null,
    digits: counters(),
    barPct: bar ? Number(bar.getAttribute('data-bar-pct')) : null,
    tealBg: bar ? bar.style.background : null,
    redBg: bar ? bar.parentElement.children[2].style.background : null,
    // The teal half's inline width AT COMMIT (real framer-motion for the gated
    // bar, see the stub): the selected width on a switch render, else the old one.
    width: bar ? bar.style.width : null,
    // Face renders happen in the render phase of the commit they belong to.
    faceCount: seen.presence.length,
  });
}
/** The face renders that belong to commit `c` (between the previous commit and it). */
function facesOf(list, c, floor) {
  const i = list.indexOf(c);
  const from = i > 0 ? list[i - 1].faceCount : floor;
  return seen.presence.slice(from, c.faceCount);
}
async function mountProbed(battle) {
  flags.gate = true;
  commits.length = 0;
  await act(async () => {
    root.render(
      <Profiler id="screen" onRender={captureCommit}>
        <AgentBattleScreen battle={battle} user={{ uid: 'u1' }} onBack={() => {}} onOpenFilmRoom={null} />
      </Profiler>,
    );
  });
  await flush();
}

const LAYOUTS = [
  { name: 'arena (controller + pane)', controller: true, pane: true },
  { name: 'legacy header (controller, pane off)', controller: true, pane: false },
  { name: 'tabbed (controller off)', controller: false, pane: false },
];

/** Every committed render tells ONE story: digits, label, prose and bar from one pair. */
function assertCommitsCoherent(list) {
  for (const c of list) {
    if (c.kind === null) continue; // pending / shell commits
    if (c.kind === 'unavailable') {
      expect(c.digits, JSON.stringify(c)).toEqual([]);
      expect(c.barPct, JSON.stringify(c)).toBeNull();
      continue;
    }
    expect(c.digits.length, JSON.stringify(c)).toBe(2);
    const twoDecimals = c.kind === 'last-scored' || c.kind === 'final';
    for (const d of c.digits) expect(d, JSON.stringify(c)).toMatch(twoDecimals ? /^[+-]?\d+\.\d{2}$/ : /^[+-]?\d+$/);
    expect(c.barPct, JSON.stringify(c)).not.toBeNull();
    // V-2/B-12: the committed inline width is ALWAYS a number — a keyed remount
    // WITHOUT `initial={false}` would commit no width at all (header NC2).
    expect(c.width, JSON.stringify(c)).toMatch(/^\d+(\.\d+)?%$/);
  }
}

describe('ON — §5.4 the mandatory new-battle sequence (every layout)', () => {
  for (const layout of LAYOUTS) {
    it(`${layout.name}: unavailable → browser now (lastScoredAt null) → one failure → stored pair → browser again → completed finals`, async () => {
      Object.assign(flags, { controller: layout.controller, pane: layout.pane, presence: true });
      setShell(true);
      priceBox.mode = 'defer';
      priceBox.table = genuineTable();
      await mountProbed(openingProp());
      await deliverDoc('ab-1', NEW_DOC);

      // 1. A new battle with incomplete quotes: unavailable in EVERY consumer.
      expect(label()).toEqual({ kind: 'unavailable', text: 'Comparison unavailable' });
      expect(counters()).toEqual([]);
      expect(container.querySelector('[data-bar-pct]')).toBeNull();
      const faces = seen.presence.slice(-4);
      for (const f of faces) {
        expect(f.duel).toEqual({ statusFeed: null });
        expect(f.reactivityLevel).toBe('static');
      }

      // 2. All holdings genuine, lastScoredAt still null: the browser comparison at once.
      const facesBefore = seen.presence.length;
      await settle();
      expect(label().kind).toBe('browser');
      expect(label().text).toContain('Live browser estimate');
      expect(counters()).toHaveLength(2);
      const facesAfter = seen.presence.slice(facesBefore);
      expect(facesAfter.length).toBeGreaterThan(0);
      for (const f of facesAfter) expect(Object.keys(f.duel).sort()).toEqual(['opponentScore', 'playerScore', 'statusFeed']);

      // 3. Fail one required quote — player-only, then CPU-only: unavailable (no stored pair yet).
      priceBox.table = without(genuineTable(), 'AAPL');
      await pollAndSettle();
      expect(label()).toEqual({ kind: 'unavailable', text: 'Comparison unavailable' });
      priceBox.table = genuineTable();
      await pollAndSettle();
      expect(label().kind).toBe('browser');
      priceBox.table = without(genuineTable(), 'GOOGL');
      await pollAndSettle();
      expect(label()).toEqual({ kind: 'unavailable', text: 'Comparison unavailable' });

      // 4. A matching snapshot with a qualified stored pair: shown with its exact time.
      await deliverDoc('ab-1', { ...NEW_DOC, scoreState: STORED(3.1, 12.4) });
      expect(label()).toEqual({ kind: 'last-scored', text: expect.stringContaining('Last scored Oct 1, 12:47 PM EDT · browser quotes incomplete') });
      expect(counters()).toEqual(['+3.10', '+12.40']);
      expect(container.querySelector('[data-comparison-prose]').textContent).toBe('CPU leads by 9.30');
      priceBox.table = genuineTable();
      await pollAndSettle();
      expect(label().kind).toBe('browser'); // complete quotes take priority again
      // …and a stored legitimate 0–0 (entered by a SWITCH, so it is instant).
      await deliverDoc('ab-1', { ...NEW_DOC, scoreState: STORED(0, 0) });
      expect(label().kind).toBe('browser');
      priceBox.table = without(genuineTable(), 'ETH');
      await pollAndSettle();
      expect(label().kind).toBe('last-scored');
      expect(counters()).toEqual(['+0.00', '+0.00']);
      expect(container.querySelector('[data-comparison-prose]').textContent).toBe('Tied');
      // P8: an exact tie emphasizes NEITHER side — in THIS layout's header (the
      // legacy ScoreHeader included; its shipped `>=` tints a tie as a player lead).
      const tieBar = barEl();
      expect(tieBar.getAttribute('data-bar-pct')).toBe('50');
      expect(tealStrong(tieBar.style.background)).toBe(false);
      expect(redStrong(tieBar.parentElement.children[2].style.background)).toBe(false);

      // 5. Completed: only qualified stored finals — complete quotes cannot repair them.
      priceBox.table = genuineTable();
      await pollAndSettle();
      await deliverDoc('ab-1', { ...NEW_DOC, status: 'completed', scoreState: STORED(40.25, 38.5) });
      expect(label()).toEqual({ kind: 'final', text: expect.stringContaining('Final · scored Oct 1, 12:47 PM EDT') });
      expect(counters()).toEqual(['+40.25', '+38.50']);
      await deliverDoc('ab-1', { ...NEW_DOC, status: 'completed', scoreState: { currentScore: 40.25, lastScoredAt: '2026-10-01T16:47:00.000Z', tradeCount: 1 } });
      expect(label()).toEqual({ kind: 'unavailable', text: 'Final comparison unavailable' });
      expect(counters()).toEqual([]);

      // ON-F5a: every committed render across all of the above was coherent.
      assertCommitsCoherent(commits);
    });
  }

  it('a genuine browser 0–0 is a real comparison, not a placeholder', async () => {
    priceBox.table = flatTable();
    await mountGated(openingProp(), NEW_DOC);
    expect(label().kind).toBe('browser');
    expect(counters()).toEqual(['+0', '+0']);
    expect(container.querySelector('[data-comparison-prose]').textContent).toBe('Tied');
    const tieBar = barEl();
    expect(tieBar.getAttribute('data-bar-pct')).toBe('50');
    expect(tealStrong(tieBar.style.background)).toBe(false);
    expect(redStrong(tieBar.parentElement.children[2].style.background)).toBe(false);
  });
});

// ── ON-F5a: atomic source switches, captured at EVERY commit ─────────────────
const tealStrong = (bg) => /rgba\(var\(--ft-teal-rgb\), 1\)\)$/.test(bg || '') || (bg || '').startsWith('linear-gradient(90deg, rgb(94, 234, 212)');
/** The CPU half emphasized: ArenaHeader's copper at full alpha, or the legacy header's solid red. */
const redStrong = (bg) => /^linear-gradient\(90deg, rgba\(var\(--ft-copper-rgb\), 1\)/.test(bg || '') || (bg || '').startsWith('linear-gradient(90deg, rgb(239, 68, 68)');
/** The teal half's DOM node (either header) — a switch remounts it, a same-kind change keeps it. */
const barEl = () => container.querySelector('[data-arena-bar] [data-bar-pct], [data-score-bar] [data-bar-pct]');
/** Player positions up ~6%, CPU positions down ~6%: the browser estimate has the PLAYER leading. */
function playerLeadsTable() {
  const t = flatTable();
  for (const s of ['AAPL', 'NVDA', 'MSFT', 'TSLA', 'AMZN', 'META', 'BTC']) t[s] = { ...t[s], price: Math.round(t[s].price * 1.06 * 100) / 100 };
  for (const s of ['GOOGL', 'AMD', 'NFLX', 'ORCL', 'CRM', 'INTC', 'ETH']) t[s] = { ...t[s], price: Math.round(t[s].price * 0.94 * 100) / 100 };
  return t;
}

describe('ON-F5a — one selected pair per commit, through all four consumers (presence on)', () => {
  for (const layout of LAYOUTS) {
    it(`${layout.name}: browser (player leads) ⇄ last-scored (CPU leads) switch digits, format, label, prose, bar, tint and faces in the SAME commit`, async () => {
      Object.assign(flags, { controller: layout.controller, pane: layout.pane, presence: true });
      priceBox.mode = 'defer';
      priceBox.table = playerLeadsTable();
      await mountProbed(openingProp());
      await deliverDoc('ab-1', { ...NEW_DOC, scoreState: STORED(3.1, 12.4) });
      await settle();
      expect(label().kind).toBe('browser');
      const browserDigits = counters();
      expect(container.querySelector('[data-comparison-prose]').textContent).toMatch(/^You lead by \d+$/);
      const browserBarEl = barEl();

      // → stored (a player-side failure): the FIRST stored commit is wholly stored.
      commits.length = 0;
      let facesFrom = seen.presence.length;
      priceBox.table = without(playerLeadsTable(), 'AAPL');
      await pollAndSettle();
      const toStored = commits.find((c) => c.kind === 'last-scored');
      expect(toStored).toBeDefined();
      expect(commits.slice(0, commits.indexOf(toStored)).every((c) => c.kind === 'browser')).toBe(true);
      expect(toStored.digits).toEqual(['+3.10', '+12.40']);
      expect(toStored.prose).toBe('CPU leads by 9.30');
      expect(toStored.barPct).toBe(Math.round(computeTugOfWarWidth(3.1, 12.4)));
      expect(tealStrong(toStored.tealBg)).toBe(false);
      expect(redStrong(toStored.redBg)).toBe(true);
      // B-12 at the screen (real framer-motion for the bar): the switch commit's
      // inline width IS the selected width — a keyed remount with initial={false}.
      expect(toStored.width).toBe(`${computeTugOfWarWidth(3.1, 12.4)}%`);
      const storedBarEl = barEl();
      expect(storedBarEl).not.toBe(browserBarEl);
      const storedFaces = facesOf(commits, toStored, facesFrom);
      expect(storedFaces.length).toBeGreaterThan(0);
      for (const f of [...storedFaces, ...seen.presence.slice(toStored.faceCount)]) {
        expect(f.duel).toEqual({ playerScore: 3.1, opponentScore: 12.4, statusFeed: null });
        expect(f.reactivityLevel).toBe('static');
      }
      // The bar's teal half remounted on the switch with `initial={false}` (framer stub).
      const storedBar = framerSeen.bars.filter((b) => b.barPct === toStored.barPct).at(-1);
      expect(storedBar.initial).toBe(false);

      // NEGATIVE CONTROL (B-12 NC1): same kind, same context — a new stored pair
      // re-targets the SAME instance, so at commit the inline width is still the
      // old one (the spring, not a remount, carries it to the new target later).
      commits.length = 0;
      await deliverDoc('ab-1', { ...NEW_DOC, scoreState: STORED(5, 12.4) });
      const sameKind = commits.find((c) => c.kind === 'last-scored' && c.prose === 'CPU leads by 7.40');
      expect(sameKind.barPct).toBe(Math.round(computeTugOfWarWidth(5, 12.4)));
      expect(sameKind.width).toBe(`${computeTugOfWarWidth(3.1, 12.4)}%`);
      expect(barEl()).toBe(storedBarEl);
      // V-3 WITHOUT an unmount: a trade-count change the lineage cannot explain
      // starts a new battle generation (evidence reset, same stored KIND, new
      // CONTEXT identity) — a switch: a fresh instance committed AT its target.
      commits.length = 0;
      await deliverDoc('ab-1', { ...NEW_DOC, scoreState: { ...STORED(7, 12.4), tradeCount: 2 } });
      const newContext = commits.find((c) => c.kind === 'last-scored' && c.prose === 'CPU leads by 5.40');
      expect(newContext.width).toBe(`${computeTugOfWarWidth(7, 12.4)}%`);
      const newContextBarEl = barEl();
      expect(newContextBarEl).not.toBe(storedBarEl);

      // → browser (a CPU-side failure resolved): wholly browser again, player tint.
      commits.length = 0;
      facesFrom = seen.presence.length;
      priceBox.table = playerLeadsTable();
      await pollAndSettle();
      const toBrowser = commits.find((c) => c.kind === 'browser');
      expect(toBrowser.digits).toEqual(browserDigits);
      expect(toBrowser.prose).toMatch(/^You lead by \d+$/);
      expect(toBrowser.barPct).toBe(90); // opposite signs pin at 90 (B-2)
      expect(tealStrong(toBrowser.tealBg)).toBe(true);
      expect(redStrong(toBrowser.redBg)).toBe(false);
      expect(toBrowser.width).toBe('90%'); // the switch commit, at target
      expect(barEl()).not.toBe(newContextBarEl);
      const browserFaces = facesOf(commits, toBrowser, facesFrom);
      expect(browserFaces.length).toBeGreaterThan(0);
      for (const f of [...browserFaces, ...seen.presence.slice(toBrowser.faceCount)]) {
        expect(f.duel.statusFeed).toBeNull();
        expect([f.duel.playerScore, f.duel.opponentScore].map((n) => `${n >= 0 ? '+' : ''}${n}`)).toEqual(browserDigits);
      }

      // → unavailable and back: nothing lingers in the unavailable commits.
      commits.length = 0;
      await deliverDoc('ab-1', { ...NEW_DOC, scoreState: { currentScore: 0, lastScoredAt: null, tradeCount: 1 } });
      priceBox.table = without(playerLeadsTable(), 'ETH');
      await pollAndSettle();
      expect(label().kind).toBe('unavailable');
      assertCommitsCoherent(commits);
      expect(commits.filter((c) => c.kind === 'unavailable').every((c) => c.digits.length === 0 && c.barPct === null)).toBe(true);
      for (const f of seen.presence.slice(-1)) expect(f.duel).toEqual({ statusFeed: null });
    });
  }

  it('A→B never ramps across battles: the context identity is part of the switch', async () => {
    priceBox.table = playerLeadsTable();
    await mountProbed(openingProp());
    await deliverDoc('ab-1', NEW_DOC);
    expect(label().kind).toBe('browser');
    const barA = barEl();
    // The SAME screen instance: the Profiler wrapper is kept (a bare re-render
    // would change the root element type and remount the whole screen).
    await mountProbed({ ...openingProp(), agentBattleId: 'ab-2' });
    expect(shell()).toBe('pending');
    expect(container.querySelector('[data-bar-pct]')).toBeNull(); // nothing of A lingers
    await deliverDoc('ab-2', NEW_DOC);
    expect(label().kind).toBe('browser');
    // B's first comparison commit: a fresh bar instance committed AT its target
    // (initial={false}) — never A's width, never a ramp from it.
    const firstB = commits.find((c) => c.kind === 'browser');
    expect(firstB.width).toBe('90%');
    expect(barEl()).not.toBe(barA);
    assertCommitsCoherent(commits);
  });
});

// ── ON-F2a/b/c: held research admission and containment (§7.2) ──────────────
const modalOpen = () => container.querySelector('[data-test-research-modal]')?.getAttribute('data-test-research-modal') ?? null;
const notice = () => {
  const el = container.querySelector('[data-quote-notice]');
  return el ? { symbol: el.getAttribute('data-quote-notice'), text: el.textContent } : null;
};
const STOCK_FALLBACK = (s) => ({ price: 140, previousClose: 140, open: 140, change: 0, percentChange: 0, isFallback: true, quoteOrigin: { version: 1, price: 'configured-fallback', previousClose: 'configured-fallback' }, symbol: s });
async function chatClick(payload) {
  seen.chatPayload = payload;
  await click(container.querySelector('[data-test-chat-symbol]'));
}

describe('ON-F2a — a held symbol click on either side', () => {
  it('valid (player): the controlled view — qualified current, separate entry, same-observation extremes, no wsPrice, no builder, no request', async () => {
    priceBox.table = genuineTable();
    wsBox.prices = { AAPL: 999 }; // a bare WebSocket overlay changes nothing
    await mountGated();
    const calls = priceBox.calls.length;
    await click(symbolEl('AAPL', 'player'));
    const r = lastResearch();
    expect(modalOpen()).toBe('AAPL');
    expect(r.asset).toEqual({ symbol: 'AAPL', name: 'AAPL', price: 153, currentPrice: 153, lockedPrice: 150, threshold: 2.5 });
    expect(r.controlledQuote).toEqual({ posKey: 'player:star:0', symbol: 'AAPL', price: 153, extremes: { sessionDate: '2026-10-01', high: 154, low: 151, open: 151.5 } });
    expect('wsPrice' in r).toBe(false);
    expect('onNavigateAdmission' in r).toBe(false);
    expect(priceBox.calls.length).toBe(calls);
  });

  it('a bare WebSocket overlay for HELD symbols (both sides, crypto too) never reaches gated SCORING: rows, counters and the comparison equal the overlay-free render (§4.2 screen merge, R-3)', async () => {
    priceBox.table = genuineTable();
    await mountGated();
    const reference = { board: container.querySelector('[data-board]').innerHTML, digits: counters(), label: label() };
    expect(reference.label.kind).toBe('browser');
    act(() => root.unmount());
    root = createRoot(container);
    wsBox.prices = { AAPL: 999, GOOGL: 1, BTC: 1 }; // provenance-less numbers for a player, a CPU and a crypto holding
    priceBox.table = genuineTable();
    await mountGated();
    expect(label()).toEqual(reference.label);
    expect(counters()).toEqual(reference.digits);
    expect(container.querySelector('[data-board]').innerHTML).toBe(reference.board);
  });

  it('valid (CPU, and crypto): the CPU position, its own entry; crypto extremes carry no open (V-11)', async () => {
    priceBox.table = genuineTable();
    await mountGated();
    await click(symbolEl('GOOGL', 'cpu'));
    expect(lastResearch().controlledQuote.posKey).toBe('cpu:star:0');
    expect(lastResearch().asset.lockedPrice).toBe(160);
    await act(async () => { seen.closeResearch(); });
    await click(symbolEl('BTC', 'player'));
    expect(lastResearch().asset.isCrypto).toBe(true);
    expect(lastResearch().controlledQuote.extremes).toEqual({ sessionDate: '2026-10-01', high: 61300, low: 60600 });
  });

  const UNQUALIFIED = {
    missing: (t) => without(t, 'AAPL'),
    'configured fallback': (t) => ({ ...t, AAPL: STOCK_FALLBACK('AAPL') }),
    'unknown origin': (t) => ({ ...t, AAPL: { ...t.AAPL, quoteOrigin: undefined } }),
    'previous-close substitution': (t) => ({ ...t, AAPL: { ...t.AAPL, price: 151, quoteOrigin: { version: 1, price: 'provider-previous-close', previousClose: 'provider-previous-close' } } }),
    'websocket-written cache record': (t) => ({ ...t, AAPL: { ...t.AAPL, price: 999, source: 'websocket' } }),
  };
  for (const [name, mutate] of Object.entries(UNQUALIFIED)) {
    it(`${name}: no priced modal, no builder call, no request — the notice, with the entry still labeled "Entry"`, async () => {
      priceBox.table = mutate(genuineTable());
      await mountGated();
      const calls = priceBox.calls.length;
      const before = seen.research.length;
      await click(symbolEl('AAPL', 'player'));
      expect(modalOpen()).toBeNull();
      expect(seen.research.length).toBe(before);
      expect(notice()).toEqual({ symbol: 'AAPL', text: expect.stringContaining('Quote unavailable — price details unavailable') });
      expect(notice().text).toContain('Entry $150.00');
      expect(priceBox.calls.length).toBe(calls);
      expect(rowStatus('AAPL')).toEqual(['Quote unavailable']);
    });
  }

  it('stale (good, then a failed poll): the row reads the dated last quote; the click still opens no priced view', async () => {
    priceBox.table = genuineTable();
    await mountGated();
    priceBox.mode = 'throw';
    await poll();
    expect(rowStatus('AAPL')).toEqual(['Last quote $153.00 · as of Oct 1, 12:50 PM EDT']);
    expect(rowStatus('GOOGL')).toEqual(['Quote unavailable']); // CPU side: no dollars (D-85)
    await click(symbolEl('AAPL', 'player'));
    expect(modalOpen()).toBeNull();
    expect(notice().symbol).toBe('AAPL');
  });

  it('CPU-side failure: the CPU click is contained too', async () => {
    priceBox.table = without(genuineTable(), 'GOOGL');
    await mountGated();
    await click(symbolEl('GOOGL', 'cpu'));
    expect(modalOpen()).toBeNull();
    expect(notice()).toEqual({ symbol: 'GOOGL', text: expect.stringContaining('Entry $160.00') });
  });
});

describe('ON-F2b — open while good, update, failure, recovery', () => {
  it('a same-position quote updates in place; a failure closes before any stale render; recovery does not reopen; a click uses the recovered value', async () => {
    priceBox.table = genuineTable();
    await mountGated();
    await click(symbolEl('AAPL', 'player'));
    expect(seen.researchMounts).toBe(1);
    priceBox.table = { ...genuineTable(), AAPL: quote('AAPL', { price: 154 }) };
    await poll();
    expect(lastResearch().asset.price).toBe(154);
    expect(lastResearch().controlledQuote.price).toBe(154);
    expect(seen.researchMounts).toBe(1); // updated, not remounted
    const rendersBeforeFailure = seen.research.length;
    priceBox.table = without(genuineTable(), 'AAPL');
    await poll();
    expect(modalOpen()).toBeNull();
    expect(seen.research.length).toBe(rendersBeforeFailure); // never rendered with stale dollars
    priceBox.table = { ...genuineTable(), AAPL: quote('AAPL', { price: 155 }) };
    await poll();
    expect(modalOpen()).toBeNull(); // recovery does not auto-reopen
    await click(symbolEl('AAPL', 'player'));
    expect(lastResearch().controlledQuote.price).toBe(155);
  });

  it('battle A→B with the same symbol: the view closes, and B never reopens it', async () => {
    priceBox.table = genuineTable();
    await mountGated();
    await click(symbolEl('AAPL', 'player'));
    await mount({ ...openingProp(), agentBattleId: 'ab-2' });
    expect(modalOpen()).toBeNull();
    expect(shell()).toBe('pending');
    await deliverDoc('ab-2', ACTIVE_DOC);
    expect(modalOpen()).toBeNull();
  });

  it('a same-symbol swap at an identical price (re-entry) is a new position: the view closes', async () => {
    priceBox.table = genuineTable();
    await mountGated();
    await click(symbolEl('TSLA', 'player'));
    expect(lastResearch().controlledQuote.posKey).toBe('player:core:1');
    const reentered = {
      ...ACTIVE_DOC,
      portfolio: { ...PLAYER_PORTFOLIO, core: [PLAYER_PORTFOLIO.core[0], { symbol: 'TSLA', swapPrice: 248, swappedInAt: '2026-10-01T16:30:00.000Z', swappedInDay: 1 }] },
      scoreState: { ...ACTIVE_DOC.scoreState, tradeCount: 3 },
      trades: [...ACTIVE_DOC.trades, { symbolOut: 'TSLA', symbolIn: 'XOM', lockedPoints: 1, executedAt: '2026-10-01T16:00:00.000Z' }, { symbolOut: 'XOM', symbolIn: 'TSLA', lockedPoints: 0, executedAt: '2026-10-01T16:30:00.000Z' }],
    };
    await deliverDoc('ab-1', reentered);
    expect(modalOpen()).toBeNull();
    await click(symbolEl('TSLA', 'player'));
    expect(lastResearch().controlledQuote.posKey).toBe('player:core:1');
  });

  it('leaving and re-entering a position (CPU side): the view closes on leaving and stays closed on re-entry', async () => {
    priceBox.table = { ...genuineTable(), CRWD: quote('AAPL', { price: 300, previousClose: 298 }) };
    await mountGated();
    await click(symbolEl('GOOGL', 'cpu'));
    expect(modalOpen()).toBe('GOOGL');
    const cpuWithout = { ...CPU_PORTFOLIO, star: [{ symbol: 'CRWD', price: 300 }, CPU_PORTFOLIO.star[1]] };
    await deliverDoc('ab-1', { ...ACTIVE_DOC, opponent: { odUserId: 'cpu', portfolio: cpuWithout } });
    expect(modalOpen()).toBeNull();
    await deliverDoc('ab-1', ACTIVE_DOC);
    expect(modalOpen()).toBeNull();
  });
});

describe('ON-F2c — non-held research, both-sides resolution, navigation admission, reclassification', () => {
  const BOTH_NVDA = { ...ACTIVE_DOC, opponent: { odUserId: 'cpu', portfolio: { ...CPU_PORTFOLIO, star: [CPU_PORTFOLIO.star[0], { symbol: 'NVDA', price: 905 }] } } };

  it('a non-held chat name opens the legacy builder path even while an unrelated held quote is unavailable', async () => {
    priceBox.table = without(genuineTable(), 'AAPL');
    await mountGated();
    await chatClick({ symbol: 'CRWD' });
    const r = lastResearch();
    expect(modalOpen()).toBe('CRWD');
    expect(r.controlledQuote).toBeUndefined();
    expect(r.onNavigateAdmission).toBe('function');
    expect(r.asset).toEqual({ symbol: 'CRWD', name: 'CRWD', price: 0, percentChange: 0, threshold: 2.5, lockedPrice: null });
  });

  it('a symbol held on both sides: player row → player, CPU row → CPU, untagged chat → player, CPU-tagged chat → CPU', async () => {
    priceBox.table = genuineTable();
    await mountGated(openingProp(), BOTH_NVDA);
    await click(symbolEl('NVDA', 'player'));
    expect(lastResearch().controlledQuote.posKey).toBe('player:star:1');
    await click(symbolEl('NVDA', 'cpu'));
    expect(lastResearch().controlledQuote.posKey).toBe('cpu:star:1');
    await chatClick({ symbol: 'NVDA' });
    expect(lastResearch().controlledQuote.posKey).toBe('player:star:1');
    await chatClick({ symbol: 'NVDA', side: 'cpu' });
    expect(lastResearch().controlledQuote.posKey).toBe('cpu:star:1');
    await chatClick({ symbol: 'GOOGL' }); // CPU-only → CPU
    expect(lastResearch().controlledQuote.posKey).toBe('cpu:star:0');
  });

  it('non-held → held navigation re-enters admission; unheld → unheld stays legacy', async () => {
    priceBox.table = genuineTable();
    await mountGated();
    await chatClick({ symbol: 'CRWD' });
    let admitted;
    await act(async () => { admitted = seen.admission('SHOP'); });
    await flush();
    expect(admitted).toBe(true);
    expect(modalOpen()).toBe('CRWD');
    await act(async () => { admitted = seen.admission('AAPL'); });
    await flush();
    expect(admitted).toBe(false);
    expect(modalOpen()).toBe('AAPL');
    expect(lastResearch().controlledQuote.posKey).toBe('player:star:0');
  });

  it('non-held → held navigation to an unqualified held name: the notice, no priced view', async () => {
    priceBox.table = without(genuineTable(), 'AAPL');
    await mountGated();
    await chatClick({ symbol: 'CRWD' });
    await act(async () => { seen.admission('AAPL'); });
    await flush();
    expect(modalOpen()).toBeNull();
    expect(notice().symbol).toBe('AAPL');
  });

  it('held ↔ non-held transitions close the open view', async () => {
    priceBox.table = { ...genuineTable(), CRWD: quote('AAPL', { price: 300, previousClose: 298 }) };
    await mountGated();
    await chatClick({ symbol: 'CRWD' });
    expect(modalOpen()).toBe('CRWD');
    const cpuHoldsCrwd = { ...CPU_PORTFOLIO, support: [{ symbol: 'CRWD', price: 300 }, ...CPU_PORTFOLIO.support.slice(1)] };
    await deliverDoc('ab-1', { ...ACTIVE_DOC, opponent: { odUserId: 'cpu', portfolio: cpuHoldsCrwd } });
    expect(modalOpen()).toBeNull(); // non-held → held: closed
    await deliverDoc('ab-1', ACTIVE_DOC);
    await click(symbolEl('AAPL', 'player'));
    expect(modalOpen()).toBe('AAPL');
    const aaplGone = { ...PLAYER_PORTFOLIO, star: [{ symbol: 'SHOP', price: 70 }, PLAYER_PORTFOLIO.star[1]] };
    await deliverDoc('ab-1', { ...ACTIVE_DOC, portfolio: aaplGone });
    expect(modalOpen()).toBeNull(); // held → non-held: closed
  });

  it('term explanations stay accessible', async () => {
    priceBox.table = without(genuineTable(), 'AAPL');
    await mountGated();
    await chatClick({ type: 'term', token: 'VWAP' });
    expect(modalOpen()).toBeNull();
    expect(notice()).toBeNull();
  });
});

// ── ON-F3: Option 1 at the screen — R1/R2 arrivals and later cache hits ──────
/** Resolve one deferred request with the table plus per-symbol overrides. */
async function resolvePending(i, overrides = {}) {
  const p = priceBox.pending[i];
  const data = { ...p.build() };
  for (const [sym, rec] of Object.entries(overrides)) if (p.symbols.includes(sym)) data[sym] = rec;
  await act(async () => { p.resolve(data); });
  await flush();
}
async function openedPrice(symbol, side = 'player') {
  await click(symbolEl(symbol, side));
  const price = modalOpen() ? lastResearch().controlledQuote.price : null;
  if (seen.closeResearch && modalOpen()) await act(async () => { seen.closeResearch(); });
  await flush();
  return price;
}
const T2 = NOW_TS;           // 12:50 PM ET
const OLDER = NOW_TS - 300;  // 12:45 PM ET
const NEWER = NOW_TS + 300;  // 12:55 PM ET (still before the 1:00 PM clock)

describe('ON-F3 — R1 starts, R2 starts and returns 110-style, then R1 returns', () => {
  const CASES = [
    { name: 'R1 strictly older (both timed) → R2 kept', r1Ts: OLDER, expectPrice: 160, expectAsOf: 'Oct 1, 12:50 PM EDT' },
    { name: 'R1 newer → R1 adopted', r1Ts: NEWER, expectPrice: 155, expectAsOf: 'Oct 1, 12:55 PM EDT' },
    { name: 'equal times → R1 adopted (latest arrival)', r1Ts: T2, expectPrice: 155, expectAsOf: 'Oct 1, 12:50 PM EDT' },
    { name: 'R1 untimed → adopted with no time', r1Ts: undefined, expectPrice: 155, expectAsOf: null },
    { name: 'R1 "NA" time → adopted with no time', r1Ts: 'NA', expectPrice: 155, expectAsOf: null },
  ];
  for (const c of CASES) {
    it(c.name, async () => {
      priceBox.mode = 'defer';
      priceBox.table = genuineTable();
      await mountGated();
      await poll(); // R2 issued
      expect(priceBox.pending.map((p) => p.kind)).toEqual(['stock', 'crypto', 'stock', 'crypto']);
      // R2 lands first (both halves — the two batch calls settle together)…
      await resolvePending(2, { AAPL: quote('AAPL', { price: 160, previousClose: 150, timestamp: T2 }) });
      await resolvePending(3);
      expect(await openedPrice('AAPL')).toBe(160);
      // …then R1.
      await resolvePending(1);
      await resolvePending(0, { AAPL: quote('AAPL', { price: 155, previousClose: 151, timestamp: c.r1Ts }) });
      expect(await openedPrice('AAPL')).toBe(c.expectPrice);
      // The retained tuple surfaces after a failure — the accepted value and ITS time only.
      priceBox.mode = 'throw';
      await poll();
      expect(rowStatus('AAPL')).toEqual([c.expectAsOf ? `Last quote $${c.expectPrice.toFixed(2)} · as of ${c.expectAsOf}` : 'Quote unavailable']);
    });
  }

  it('an older valid-time record keeps being rejected on every later (cache-served) arrival; no extra requests', async () => {
    priceBox.table = { ...genuineTable(), AAPL: quote('AAPL', { price: 160, timestamp: T2 }) };
    await mountGated();
    const calls = priceBox.calls.length;
    priceBox.table = { ...genuineTable(), AAPL: quote('AAPL', { price: 155, timestamp: OLDER }) };
    await poll();
    await poll();
    expect(await openedPrice('AAPL')).toBe(160);
    expect(priceBox.calls.length).toBe(calls + 4); // two polls × (stock + crypto), nothing more
  });

  it('a failed later request does not poison an earlier success that arrives after it', async () => {
    priceBox.mode = 'defer';
    priceBox.table = genuineTable();
    await mountGated();
    await poll();
    await act(async () => { priceBox.pending[2].reject(new Error('R2 failed')); priceBox.pending[3].reject(new Error('R2 failed')); });
    await flush();
    await resolvePending(1);
    await resolvePending(0);
    expect(await openedPrice('AAPL')).toBe(153);
  });

  it('a retired callback is ignored: a battle switch retires R1, whose late answer cannot write the new battle', async () => {
    priceBox.mode = 'defer';
    priceBox.table = genuineTable();
    await mountGated();
    const r1 = priceBox.pending.splice(0);
    await mount({ ...openingProp(), agentBattleId: 'ab-2' });
    await deliverDoc('ab-2', ACTIVE_DOC);
    await act(async () => { for (const p of r1) p.resolve(p.build()); });
    await flush();
    expect(unavailableRows().length).toBe(14); // B's positions: still nothing qualified
    await settle();
    expect(unavailableRows()).toEqual([]);
  });
});

// ── ON-TIME ──────────────────────────────────────────────────────────────────
describe('ON-TIME — market time is evidence about the value it is attached to', () => {
  it('a genuine current without a timestamp is usable, but after a failure it shows no stale dollars', async () => {
    priceBox.table = { ...genuineTable(), AAPL: quote('AAPL', { timestamp: undefined }) };
    await mountGated();
    expect(rowStatus('AAPL')).toEqual([]);
    expect(label().kind).toBe('browser');
    priceBox.table = without(genuineTable(), 'AAPL');
    await poll();
    expect(rowStatus('AAPL')).toEqual(['Quote unavailable']);
  });

  it('[A-7/V-9] a time later than the browser clock fails as a TIME only: the price stays usable, untimed', async () => {
    priceBox.table = { ...genuineTable(), AAPL: quote('AAPL', { timestamp: NOW_TS + 3600 }) };
    await mountGated();
    expect(rowStatus('AAPL')).toEqual([]);
    expect(await openedPrice('AAPL')).toBe(153);
    priceBox.mode = 'throw';
    await poll();
    expect(rowStatus('AAPL')).toEqual(['Quote unavailable']);
  });

  it('a substituted price carries no usable time, and a WebSocket-written record is unknown with no inherited stale label', async () => {
    priceBox.table = genuineTable();
    await mountGated();
    priceBox.table = { ...genuineTable(), AAPL: { ...quote('AAPL'), price: 999, source: 'websocket' } };
    await poll();
    // Current unknown: stale tuple from the earlier GENUINE observation only.
    expect(rowStatus('AAPL')).toEqual(['Last quote $153.00 · as of Oct 1, 12:50 PM EDT']);
    priceBox.table = { ...genuineTable(), MSFT: { ...quote('MSFT'), price: 401, quoteOrigin: { version: 1, price: 'provider-previous-close', previousClose: 'provider-previous-close' } } };
    await poll();
    expect(rowStatus('MSFT')).toEqual(['Last quote $404.00 · as of Oct 1, 12:50 PM EDT']);
  });
});

// ── ON-DAY2 ──────────────────────────────────────────────────────────────────
describe('ON-DAY2 — a genuine current with no genuine previous close keeps the entry baseline', () => {
  const DAY2 = {
    ...ACTIVE_DOC,
    activatedAt: '2026-09-30T13:30:00.000Z',
    timing: { ...ACTIVE_DOC.timing, currentTradingDay: 2 },
    thresholdHistory: {},
    trades: [],
    scoreState: { currentScore: 0, opponentScore: 0, lastScoredAt: null, tradeCount: 0 },
    portfolio: { ...PLAYER_PORTFOLIO, star: [{ symbol: 'AAPL', price: 100 }, PLAYER_PORTFOLIO.star[1]], startingPrices: { ...PLAYER_PORTFOLIO.startingPrices, AAPL: 100 } },
    opponent: { odUserId: 'cpu', portfolio: { ...CPU_PORTFOLIO, star: [{ symbol: 'GOOGL', price: 100 }, CPU_PORTFOLIO.star[1]] } },
    scoring: { thresholds: { ...ACTIVE_DOC.scoring.thresholds, AAPL: { threshold: 2.5 }, GOOGL: { threshold: 2.5 } } },
  };
  const at103 = (sym, pc, originPc = 'provider-previous-close') => quote(sym, { price: 103, previousClose: pc, quoteOrigin: { version: 1, price: 'provider-close', previousClose: originPc } });
  async function pointsOf(symbol, side) {
    await click(pointsEl(symbol, side));
    const total = seen.breakdown[seen.breakdown.length - 1].asset.totalScore;
    return total;
  }

  for (const [sym, side] of [['AAPL', 'player'], ['GOOGL', 'cpu']]) {
    it(`${side}: no retained close → 75; a genuine close of 103 → 60; kept across a missing-close response; configured and unknown closes rejected`, async () => {
      priceBox.table = { ...genuineTable(), [sym]: at103(sym, 0, 'missing') };
      await mountGated(openingProp(), DAY2);
      expect(await pointsOf(sym, side)).toBe(75);
      priceBox.table = { ...genuineTable(), [sym]: at103(sym, 103) };
      await poll();
      expect(await pointsOf(sym, side)).toBe(60);
      priceBox.table = { ...genuineTable(), [sym]: at103(sym, 0, 'missing') };
      await poll();
      expect(await pointsOf(sym, side)).toBe(60); // the genuine close is retained
    });

    it(`${side}: a configured or an unknown previous close never becomes the baseline`, async () => {
      priceBox.table = { ...genuineTable(), [sym]: at103(sym, 103, 'configured-fallback') };
      await mountGated(openingProp(), DAY2);
      expect(await pointsOf(sym, side)).toBe(75);
      priceBox.table = { ...genuineTable(), [sym]: { ...at103(sym, 103), quoteOrigin: { version: 1, price: 'provider-close' } } };
      await poll();
      expect(await pointsOf(sym, side)).toBe(75);
    });
  }

  it('[A-8] an unqualified current still contributes its independently genuine close', async () => {
    priceBox.table = { ...genuineTable(), AAPL: { ...at103('AAPL', 103), price: 999, source: 'websocket' } };
    await mountGated(openingProp(), DAY2);
    expect(rowStatus('AAPL')).toEqual(['Quote unavailable']);
    priceBox.table = { ...genuineTable(), AAPL: at103('AAPL', 0, 'missing') };
    await poll();
    expect(await pointsOf('AAPL', 'player')).toBe(60);
  });
});

// ── ON-ROW ───────────────────────────────────────────────────────────────────
describe('ON-ROW — an unavailable row withholds every current-derived channel', () => {
  it('no percent, no points, no badges, no price — symbol, status and entry only; closed trades stay', async () => {
    priceBox.table = without(genuineTable(), 'NVDA');
    await mountGated();
    const side = container.querySelector('[data-quote-unavailable="NVDA"]');
    expect(side.textContent).toBe('NVDAQuote unavailableEntry $900.00');
    expect(side.textContent).not.toMatch(/%|pts/);
    expect(pointsEl('NVDA', 'player')).toBeNull();
    // The recorded closed trade is still listed.
    const closed = [...container.querySelectorAll('button')].find((b) => b.textContent.includes('Closed Trades'));
    expect(closed).toBeTruthy();
    await click(closed);
    expect(html()).toContain('XOM');
  });

  it('an open breakdown closes on failure, on a swap, and on a battle change — and recovery never reopens it', async () => {
    priceBox.table = genuineTable();
    await mountGated();
    await click(pointsEl('MSFT', 'player'));
    expect(container.querySelector('[data-test-breakdown]')).not.toBeNull();
    priceBox.table = without(genuineTable(), 'MSFT');
    await poll();
    expect(container.querySelector('[data-test-breakdown]')).toBeNull();
    priceBox.table = genuineTable();
    await poll();
    expect(container.querySelector('[data-test-breakdown]')).toBeNull();
    await click(pointsEl('MSFT', 'player'));
    expect(container.querySelector('[data-test-breakdown]')).not.toBeNull();
    const swapped = { ...ACTIVE_DOC, portfolio: { ...PLAYER_PORTFOLIO, core: [{ symbol: 'MSFT', swapPrice: 404, swappedInAt: '2026-10-01T16:40:00.000Z', swappedInDay: 1 }, PLAYER_PORTFOLIO.core[1]] }, scoreState: { ...ACTIVE_DOC.scoreState, tradeCount: 2 } };
    await deliverDoc('ab-1', swapped);
    expect(container.querySelector('[data-test-breakdown]')).toBeNull();
    await click(pointsEl('MSFT', 'player'));
    expect(container.querySelector('[data-test-breakdown]')).not.toBeNull();
    await mount({ ...openingProp(), agentBattleId: 'ab-2' });
    expect(container.querySelector('[data-test-breakdown]')).toBeNull();
  });

  it('the breakdown reads the CURRENT position, not the clicked object', async () => {
    priceBox.table = genuineTable();
    await mountGated();
    await click(pointsEl('MSFT', 'player'));
    const first = seen.breakdown[seen.breakdown.length - 1].asset.currentPrice;
    priceBox.table = { ...genuineTable(), MSFT: quote('MSFT', { price: 410 }) };
    await poll();
    expect(first).toBe(404);
    expect(seen.breakdown[seen.breakdown.length - 1].asset.currentPrice).toBe(410);
  });

  it('an open Why? panel closes when its position becomes unavailable and is not reopened by recovery', async () => {
    priceBox.table = genuineTable();
    await mountGated();
    const btn = container.querySelector('[role="button"][aria-label="Why? NVDA"]');
    expect(btn).toBeTruthy();
    await click(btn);
    expect(container.querySelector('#why-star-1-heading')).not.toBeNull();
    priceBox.table = without(genuineTable(), 'AAPL', 'NVDA');
    await poll();
    expect(container.querySelector('#why-star-1-heading')).toBeNull();
    priceBox.table = genuineTable();
    await poll();
    expect(container.querySelector('#why-star-1-heading')).toBeNull();
  });

  it('a held asset carrying a lock marker still requires its quote for completeness', async () => {
    const locked = { ...ACTIVE_DOC, portfolio: { ...PLAYER_PORTFOLIO, support: [{ ...PLAYER_PORTFOLIO.support[0], riskLocked: true, locked: true }, ...PLAYER_PORTFOLIO.support.slice(1)] } };
    priceBox.table = without(genuineTable(), 'AMZN');
    await mountGated(openingProp(), { ...locked, scoreState: { currentScore: 0, lastScoredAt: null, tradeCount: 1 } });
    expect(label()).toEqual({ kind: 'unavailable', text: 'Comparison unavailable' });
  });
});

// ── ON-VALID ─────────────────────────────────────────────────────────────────
describe('ON-VALID — genuine fixtures keep the established arithmetic and presentation', () => {
  for (const layout of LAYOUTS.slice(0, 2)) {
    it(`${layout.name}: the board's rows are byte-identical to the flag-off rows`, async () => {
      Object.assign(flags, { controller: layout.controller, pane: layout.pane });
      priceBox.table = genuineTable();
      await mount(openingProp());
      await deliverDoc('ab-1', ACTIVE_DOC);
      const offBoard = container.querySelector('[data-board]').innerHTML;
      act(() => root.unmount());
      root = createRoot(container);
      await mountGated();
      const onBoard = container.querySelector('[data-board]').innerHTML;
      expect(onBoard).toBe(offBoard);
    });
  }

  it('repeated polls and content-only snapshots cause no extra request cycles', async () => {
    priceBox.table = genuineTable();
    await mountGated();
    expect(priceBox.calls.length).toBe(2);
    await deliverDoc('ab-1', { ...ACTIVE_DOC, chatExchanges: [{ id: 'x1', userMessage: 'hi' }], statusFeed: [{ action: 'hold', timestamp: '2026-10-01T16:58:00.000Z' }] });
    expect(priceBox.calls.length).toBe(2);
    await poll();
    await poll();
    expect(priceBox.calls.length).toBe(6);
  });
});

// ── ON-F4a: the subscribed snapshot is the only source ───────────────────────
const shownSymbols = (side) => {
  const all = [...container.querySelectorAll('div')].filter((d) => d.style.display === 'inline-block' && d.style.cursor === 'pointer' && d.firstChild && /^[A-Z-]+$/.test(d.firstChild.textContent || ''));
  const texts = all.map((d) => d.firstChild.textContent);
  // Rows alternate player, CPU.
  return texts.filter((_, i) => (side === 'player' ? i % 2 === 0 : i % 2 === 1));
};

describe('ON-F4a — controller-off opening prop OLD, subscribed snapshot NEW', () => {
  const OLD = { ...PLAYER_PORTFOLIO, core: [{ symbol: 'MSFT', price: 400 }, { symbol: 'XOM', price: 110 }] };
  for (const layout of [LAYOUTS[0], LAYOUTS[2]]) {
    it(`${layout.name}: only NEW drives holdings, requests and enrichment; later player and CPU changes follow the snapshot`, async () => {
      Object.assign(flags, { controller: layout.controller, pane: layout.pane });
      priceBox.table = { ...genuineTable(), XOM: quote('AAPL', { price: 112, previousClose: 111 }), SHOP: quote('AAPL', { price: 71, previousClose: 70 }), CRWD: quote('AAPL', { price: 300, previousClose: 298 }) };
      await mountGated(openingProp({ portfolio: OLD }));
      expect(priceBox.calls[0][1]).toContain('TSLA');
      expect(priceBox.calls.flatMap((c) => c[1])).not.toContain('XOM');
      expect(html()).not.toContain('>XOM<');
      expect(shownSymbols('player')).toContain('TSLA');
      // A player change, then a CPU change: rows and requests follow the snapshot.
      await deliverDoc('ab-1', { ...ACTIVE_DOC, portfolio: { ...PLAYER_PORTFOLIO, star: [{ symbol: 'SHOP', price: 70 }, PLAYER_PORTFOLIO.star[1]], startingPrices: { ...PLAYER_PORTFOLIO.startingPrices, SHOP: 70 } } });
      expect(shownSymbols('player')[0]).toBe('SHOP');
      expect(priceBox.calls.at(-2)[1]).toContain('SHOP');
      await deliverDoc('ab-1', { ...ACTIVE_DOC, opponent: { odUserId: 'cpu', portfolio: { ...CPU_PORTFOLIO, star: [{ symbol: 'CRWD', price: 300 }, CPU_PORTFOLIO.star[1]] } } });
      expect(shownSymbols('cpu')[0]).toBe('CRWD');
      expect(priceBox.calls.at(-2)[1]).toContain('CRWD');
    });
  }

  it('[A-5/V-8] the exact nightly rewrite is a NEW position generation: observations dropped, details closed, entry falls to the start price else 0', async () => {
    priceBox.table = genuineTable();
    await mountGated();
    await click(symbolEl('TSLA', 'player'));
    expect(modalOpen()).toBe('TSLA');
    priceBox.mode = 'defer';
    const rewritten = {
      ...ACTIVE_DOC,
      portfolio: {
        ...PLAYER_PORTFOLIO,
        // The writer exactly: swapPrice and swappedInDay deleted, both previous*
        // fields added, swappedInAt kept (agent-daily-scores.js).
        core: [PLAYER_PORTFOLIO.core[0], { symbol: 'TSLA', swappedInAt: '2026-10-01T15:00:00.000Z', previousSwapPrice: 248, previousSwapDay: 1 }],
      },
    };
    await deliverDoc('ab-1', rewritten);
    expect(modalOpen()).toBeNull();                       // identity-bound detail closed
    expect(rowStatus('TSLA')).toEqual(['Quote unavailable']); // no inherited stale tuple
    expect(container.querySelector('[data-row-entry="TSLA"]')).toBeNull(); // entry 0 → no entry label
    await settle();
    expect(rowStatus('TSLA')).toEqual([]);
    await click(pointsEl('TSLA', 'player'));
    const bd = seen.breakdown[seen.breakdown.length - 1];
    expect(bd.entryPrice).toBe(0);
    expect(bd.asset.gain).toBe(0); // an entry of 0 makes the entry-relative return 0
  });
});

// ── ON-F4b: battle identity, terminal states and recovery ────────────────────
describe('ON-F4b — A→B, late callbacks, terminal states, recovery', () => {
  it('A→B before B\'s snapshot: the pending shell, no A content, no request built from A; a late A callback or error is ignored', async () => {
    priceBox.table = genuineTable();
    await mountGated();
    const aListener = activeListener('doc', 'ab-1');
    const calls = priceBox.calls.length;
    await mount({ ...openingProp(), agentBattleId: 'ab-2' });
    expect(shell()).toBe('pending');
    expect(container.querySelector('[data-board]')).toBeNull();
    expect(counters()).toEqual([]);
    expect(priceBox.calls.length).toBe(calls);
    await act(async () => { aListener.next(docSnap('ab-1', { ...ACTIVE_DOC, scoreState: STORED(99, 1) })); });
    await flush();
    await act(async () => { aListener.error({ message: 'late', code: 'unavailable' }); });
    await flush();
    expect(shell()).toBe('pending');
    await deliverDoc('ab-2', { ...ACTIVE_DOC, scoreState: STORED(1, 2) });
    expect(shell()).toBeNull();
    expect(priceBox.calls.length).toBe(calls + 2);
  });

  it('A→B→A: pending until A\'s NEW subscription delivers', async () => {
    priceBox.table = genuineTable();
    await mountGated();
    await mount({ ...openingProp(), agentBattleId: 'ab-2' });
    await mount(openingProp());
    expect(shell()).toBe('pending');
    await deliverDoc('ab-1', ACTIVE_DOC);
    expect(shell()).toBeNull();
  });

  it('a missing document → "Battle unavailable": no loader, no opening-prop fallback, no request', async () => {
    priceBox.table = genuineTable();
    flags.gate = true;
    await mount(openingProp());
    await deliverDoc('ab-1', null);
    expect(shell()).toBe('unavailable');
    expect(container.textContent).toContain('Battle unavailable');
    expect(container.textContent).not.toContain('Loading agent battle');
    expect(priceBox.calls).toEqual([]);
  });

  it('a subscription error before ready, and after ready: "Battle unavailable", polling stopped, no stale content; a remount recovers', async () => {
    priceBox.table = genuineTable();
    flags.gate = true;
    await mount(openingProp());
    await failDoc('ab-1');
    expect(shell()).toBe('unavailable');
    act(() => root.unmount());
    root = createRoot(container);
    await mountGated();
    expect(shell()).toBeNull();
    const calls = priceBox.calls.length;
    await failDoc('ab-1');
    expect(shell()).toBe('unavailable');
    expect(container.querySelector('[data-board]')).toBeNull();
    await poll();
    expect(priceBox.calls.length).toBe(calls); // polling stopped
    act(() => root.unmount());
    root = createRoot(container);
    await mountGated();
    expect(shell()).toBeNull();
    expect(label().kind).toBe('browser');
  });

  it('the direct-ID route never subscribes the lookup query (its errors cannot matter)', async () => {
    priceBox.table = genuineTable();
    await mountGated();
    expect(fsBox.listeners.some((l) => l.kind === 'query')).toBe(false);
  });

  it('[A-4] an excluded-then-errored battle keeps the legacy behaviour', async () => {
    priceBox.table = genuineTable();
    flags.gate = true;
    await mount(openingProp());
    await deliverDoc('ab-1', { ...ACTIVE_DOC, gameMode: 'baggerbomb_tournament' });
    expect(shell()).toBeNull();
    expect(label()).toBeNull(); // legacy header, no comparison
    const before = digest(html());
    await failDoc('ab-1');
    expect(shell()).toBeNull();
    expect(digest(html())).toEqual(before);
  });
});

// ── [A-4] the exclusion memory, and an excluded battle's lookup error ───────
// Review round (refuter A, lifecycle F-1 / offstate F3): the memory names ONE
// requested ID and ends when any other ID is requested — a return to it starts
// unclassified, so R-5 governs again; and on the query path an excluded
// battle's lookup error follows legacy, which keeps the retained ID.
const EXCLUDED_DOC = { ...ACTIVE_DOC, gameMode: 'baggerbomb_tournament' };
const B_DOC = { ...ACTIVE_DOC, agentId: 'agent-2', agentContext: { agentName: 'Borealis', archetype: 'degen' } };
const atQuery = (agentId) => ({ ...openingProp({ direct: false }), agentId });
const boardShown = () => container.querySelector('[data-board]') !== null;
const docListenerAlive = (id) => !!activeListener('doc', id);
async function failQuery(agentId, err = { code: 'permission-denied', message: 'Missing or insufficient permissions.' }) {
  const l = activeListener('query', agentId);
  if (!l) throw new Error(`no active query listener for ${agentId}`);
  await act(async () => { l.error(err); });
  await flush();
}

describe('ON-F4b [A-4] — the exclusion memory ends with the requested ID', () => {
  it('direct route: A excluded → B admitted → A again → A\'s NEW subscription errors before its snapshot → "Battle unavailable"; no B content, no request', async () => {
    priceBox.table = genuineTable();
    flags.gate = true;
    await mount(openingProp());
    await deliverDoc('ab-1', EXCLUDED_DOC);
    expect(shell()).toBeNull();
    await mount({ ...openingProp(), agentBattleId: 'ab-2' });
    expect(shell()).toBe('pending');
    await deliverDoc('ab-2', B_DOC);
    expect(label()?.kind).toBe('browser');
    await mount(openingProp());
    expect(shell()).toBe('pending');
    const calls = priceBox.calls.length;
    await failDoc('ab-1');
    expect({ shell: shell(), board: boardShown(), retainedB: container.textContent.includes('Borealis'), requested: priceBox.calls.length - calls })
      .toEqual({ shell: 'unavailable', board: false, retainedB: false, requested: 0 });
  });

  it('query route: P (excluded ab-1) → Q (admitted ab-2) → P again → doc error before its snapshot → "Battle unavailable"; never Q\'s battle or the opening prop', async () => {
    priceBox.table = genuineTable();
    flags.gate = true;
    await mount(atQuery('agent-1'));
    await deliverQuery('agent-1', ['ab-1']);
    await deliverDoc('ab-1', EXCLUDED_DOC);
    expect(shell()).toBeNull();
    await mount(atQuery('agent-2'));
    await deliverQuery('agent-2', ['ab-2']);
    await deliverDoc('ab-2', B_DOC);
    expect(label()?.kind).toBe('browser');
    await mount(atQuery('agent-1'));
    await deliverQuery('agent-1', ['ab-1']);
    expect(shell()).toBe('pending');
    const calls = priceBox.calls.length;
    await failDoc('ab-1');
    expect({ shell: shell(), board: boardShown(), retainedQ: container.textContent.includes('Borealis'), requested: priceBox.calls.slice(calls).map((c) => c[0]) })
      .toEqual({ shell: 'unavailable', board: false, retainedQ: false, requested: [] });
  });

  it('same agent, same lookup generation: ab-1 excluded → the query moves to ab-9 → back to ab-1 (a new subscription) → error before its snapshot → "Battle unavailable"', async () => {
    priceBox.table = genuineTable();
    flags.gate = true;
    await mount(atQuery('agent-1'));
    await deliverQuery('agent-1', ['ab-1']);
    await deliverDoc('ab-1', EXCLUDED_DOC);
    expect(shell()).toBeNull();
    await deliverQuery('agent-1', ['ab-9']);
    expect(shell()).toBe('pending');
    expect(docListenerAlive('ab-1')).toBe(false);
    await deliverQuery('agent-1', ['ab-1']);
    expect(shell()).toBe('pending');
    const calls = priceBox.calls.length;
    await failDoc('ab-1');
    expect({ shell: shell(), board: boardShown(), requested: priceBox.calls.length - calls }).toEqual({ shell: 'unavailable', board: false, requested: 0 });
  });

  it('another ID never inherits the memory: A excluded → B\'s subscription errors before ready → "Battle unavailable"', async () => {
    priceBox.table = genuineTable();
    flags.gate = true;
    await mount(openingProp());
    await deliverDoc('ab-1', EXCLUDED_DOC);
    await mount({ ...openingProp(), agentBattleId: 'ab-2' });
    await failDoc('ab-2');
    expect(shell()).toBe('unavailable');
  });
});

describe('ON-F4b [A-4] / OFF-7 — an excluded battle on the query path, then a lookup error', () => {
  it('same generation: the legacy screen stays — retained ID, live document listener, the same board and header as flag-off, no (un)subscribe', async () => {
    priceBox.table = genuineTable();
    await mount(atQuery('agent-1'));
    await deliverQuery('agent-1', ['ab-1']);
    await deliverDoc('ab-1', EXCLUDED_DOC);
    await failQuery('agent-1');
    const off = { shell: shell(), doc: docListenerAlive('ab-1'), board: legacyView().board, header: legacyView().header };
    expect(off.shell).toBeNull();
    expect(off.doc).toBe(true);
    expect(off.board).toContain('AAPL');
    act(() => root.unmount());
    root = createRoot(container);
    fsBox.listeners.length = 0; fsBox.log.length = 0; priceBox.calls.length = 0;

    flags.gate = true;
    await mount(atQuery('agent-1'));
    await deliverQuery('agent-1', ['ab-1']);
    await deliverDoc('ab-1', EXCLUDED_DOC);
    expect(shell()).toBeNull();
    const logBefore = fsBox.log.length;
    await failQuery('agent-1');
    expect({ shell: shell(), doc: docListenerAlive('ab-1'), board: legacyView().board, header: legacyView().header }).toEqual(off);
    expect(fsBox.log.slice(logBefore)).toEqual([]);
  });

  it('another agent\'s lookup error never revives the excluded battle: P excluded ab-1 → Q → Q\'s lookup errors → "Battle unavailable", no ab-1 resubscribe', async () => {
    priceBox.table = genuineTable();
    flags.gate = true;
    await mount(atQuery('agent-1'));
    await deliverQuery('agent-1', ['ab-1']);
    await deliverDoc('ab-1', EXCLUDED_DOC);
    expect(shell()).toBeNull();
    await mount(atQuery('agent-2'));
    expect(shell()).toBe('pending');
    const logBefore = fsBox.log.length;
    await failQuery('agent-2');
    expect({ shell: shell(), board: boardShown(), ab1: docListenerAlive('ab-1'), docSubscribes: fsBox.log.slice(logBefore).filter((e) => e[0] === 'subscribe' && e[1] === 'doc') })
      .toEqual({ shell: 'unavailable', board: false, ab1: false, docSubscribes: [] });
  });

  it('after the legacy retention an agent change starts pending and releases the ab-1 listener', async () => {
    priceBox.table = genuineTable();
    flags.gate = true;
    await mount(atQuery('agent-1'));
    await deliverQuery('agent-1', ['ab-1']);
    await deliverDoc('ab-1', EXCLUDED_DOC);
    await failQuery('agent-1');
    await mount(atQuery('agent-2'));
    expect({ shell: shell(), ab1: docListenerAlive('ab-1'), board: boardShown() }).toEqual({ shell: 'pending', ab1: false, board: false });
  });

  it('a server-confirmed empty lookup still ends at "No active battle" for an excluded battle (any battle type)', async () => {
    priceBox.table = genuineTable();
    flags.gate = true;
    await mount(atQuery('agent-1'));
    await deliverQuery('agent-1', ['ab-1']);
    await deliverDoc('ab-1', EXCLUDED_DOC);
    await deliverQuery('agent-1', [], { fromCache: false });
    expect({ shell: shell(), ab1: docListenerAlive('ab-1') }).toEqual({ shell: 'no-battle', ab1: false });
  });

  it('an unconfirmed empty (fromCache: true) is "Battle unavailable" — legacy nulls the ID on any empty snapshot, so nothing is retained', async () => {
    priceBox.table = genuineTable();
    flags.gate = true;
    await mount(atQuery('agent-1'));
    await deliverQuery('agent-1', ['ab-1']);
    await deliverDoc('ab-1', EXCLUDED_DOC);
    await deliverQuery('agent-1', [], { fromCache: true });
    expect({ shell: shell(), ab1: docListenerAlive('ab-1') }).toEqual({ shell: 'unavailable', ab1: false });
  });
});

// ── §4.3 rule 2: one poll, two batch calls ──────────────────────────────────
// Review round (refuter A, lifecycle F-2): "A later request failure does not
// disqualify another request's genuine success."
describe('§4.3 rule 2 — one poll, two independent batch calls', () => {
  const HELD = ['AAPL', 'NVDA', 'MSFT', 'TSLA', 'AMZN', 'META', 'BTC', 'GOOGL', 'AMD', 'NFLX', 'ORCL', 'CRM', 'INTC', 'ETH'];
  const STOCKS = HELD.filter((s) => !CRYPTO.has(s));

  it('the stock call rejects, the crypto call resolves: crypto rows stay priced, stock rows are withheld, last-scored; same calls in the same order', async () => {
    priceBox.table = genuineTable();
    await mountGated();
    expect(unavailableRows()).toEqual([]);
    priceBox.modeFor.stock = 'throw';
    await poll();
    expect(priceBox.calls.slice(-2).map((c) => c[0])).toEqual(['stock', 'crypto']);
    expect({ crypto: unavailableRows().filter((s) => CRYPTO.has(s)).sort(), stocks: unavailableRows().filter((s) => !CRYPTO.has(s)).sort(), comparison: label()?.kind })
      .toEqual({ crypto: [], stocks: [...STOCKS].sort(), comparison: 'last-scored' });
  });

  it('the crypto call rejects, the stock call resolves: only BTC and ETH are withheld', async () => {
    priceBox.table = genuineTable();
    await mountGated();
    priceBox.modeFor.crypto = 'throw';
    await poll();
    expect({ crypto: unavailableRows().filter((s) => CRYPTO.has(s)).sort(), stocks: unavailableRows().filter((s) => !CRYPTO.has(s)), comparison: label()?.kind })
      .toEqual({ crypto: ['BTC', 'ETH'], stocks: [], comparison: 'last-scored' });
  });

  it('both calls reject: every held row is withheld; last-scored', async () => {
    priceBox.table = genuineTable();
    await mountGated();
    priceBox.mode = 'throw';
    await poll();
    expect({ rows: [...unavailableRows()].sort(), comparison: label()?.kind }).toEqual({ rows: [...HELD].sort(), comparison: 'last-scored' });
  });

  it('after a stock-only failure the next good poll restores every row and the browser comparison', async () => {
    priceBox.table = genuineTable();
    await mountGated();
    priceBox.modeFor.stock = 'throw';
    await poll();
    priceBox.modeFor = {};
    await poll();
    expect({ rows: unavailableRows(), comparison: label()?.kind }).toEqual({ rows: [], comparison: 'browser' });
  });
});

// ── §4.2 / §3.1: the gated path subscribes no WebSocket symbols ──────────────
// Review round (refuter C's hardening): nothing gated reads a bare WebSocket
// number, and while pending the legacy list would come from the opening prop.
describe('§4.2 / §3.1 — no WebSocket subscription on the gated path', () => {
  it('pending, admitted and terminal: the hook only ever gets an empty list; flag-off and an excluded battle: the shipped held-symbol list', async () => {
    const HELD_SOME = ['AAPL', 'MSFT', 'BTC', 'GOOGL', 'ETH'];
    priceBox.table = genuineTable();
    flags.gate = true;
    await mount(openingProp());
    expect(shell()).toBe('pending');
    await deliverDoc('ab-1', ACTIVE_DOC);
    expect(label().kind).toBe('browser');
    await failDoc('ab-1');
    expect(shell()).toBe('unavailable');
    expect(wsBox.args.length).toBeGreaterThan(0);
    expect(wsBox.args.every((a) => Array.isArray(a) && a.length === 0)).toBe(true);

    for (const [gate, doc] of [[false, ACTIVE_DOC], [true, EXCLUDED_DOC]]) {
      act(() => root.unmount());
      root = createRoot(container);
      fsBox.listeners.length = 0; fsBox.log.length = 0; wsBox.args.length = 0;
      flags.gate = gate;
      await mount(openingProp());
      await deliverDoc('ab-1', doc);
      expect(shell()).toBeNull();
      expect(wsBox.args.at(-1)).toEqual(expect.arrayContaining(HELD_SOME));
    }
  });
});

// ── ON-F5a: every LIVE face shows the one selected duel ─────────────────────
// Review round (mutation pass): the rows above inspect the faces RENDERED in a
// window; a consumer that stopped receiving the comparison (the pane's mark)
// would keep showing a stale or legacy duel without re-rendering. Here the
// current input of every mounted face is read at each step.
describe('ON-F5a — every live presence face (headers, the mark, the pane) shows the ONE selected duel', () => {
  const liveDuels = () => [...faceBox.live.values()];
  for (const shell of [{ name: 'desktop', desktop: true }, { name: 'phone', desktop: false }]) {
    it(`arena (controller + pane), ${shell.name}: unavailable → browser → stored → unavailable`, async () => {
      Object.assign(flags, { controller: true, pane: true, presence: true });
      setShell(shell.desktop);
      priceBox.mode = 'defer';
      priceBox.table = genuineTable();
      await mountProbed(openingProp());
      await deliverDoc('ab-1', NEW_DOC);
      expect(label()).toEqual({ kind: 'unavailable', text: 'Comparison unavailable' });
      expect(liveDuels().length).toBeGreaterThanOrEqual(2); // the header face and the mark at least
      for (const d of liveDuels()) expect(d).toEqual({ statusFeed: null });

      await settle();
      expect(label().kind).toBe('browser');
      const browser = liveDuels()[0];
      expect(Object.keys(browser).sort()).toEqual(['opponentScore', 'playerScore', 'statusFeed']);
      for (const d of liveDuels()) expect(d).toEqual(browser);

      priceBox.table = without(genuineTable(), 'AAPL');
      await pollAndSettle();
      await deliverDoc('ab-1', { ...NEW_DOC, scoreState: STORED(3.1, 12.4) });
      expect(label().kind).toBe('last-scored');
      for (const d of liveDuels()) expect(d).toEqual({ playerScore: 3.1, opponentScore: 12.4, statusFeed: null });

      await deliverDoc('ab-1', { ...NEW_DOC, scoreState: { currentScore: 0, lastScoredAt: null, tradeCount: 0 } });
      expect(label().kind).toBe('unavailable');
      for (const d of liveDuels()) expect(d).toEqual({ statusFeed: null });
    });
  }
});

// ── ON-ID at the screen (query path) ─────────────────────────────────────────
describe('ON-ID — lookup identity evidence through the real screen', () => {
  const queryProp = (agentId = 'agent-1') => ({ ...openingProp({ direct: false }), agentId });

  it('(1) A→B→A ending on the original ID: pending until generation 3 settles; generation-1 evidence never settles it', async () => {
    priceBox.table = genuineTable();
    flags.gate = true;
    await mount(queryProp('agent-1'));
    const gen1 = activeListener('query', 'agent-1');
    await deliverQuery('agent-1', ['ab-1']);
    await deliverDoc('ab-1', ACTIVE_DOC);
    expect(shell()).toBeNull();
    await mount(queryProp('agent-2'));
    expect(shell()).toBe('pending');
    await mount(queryProp('agent-1'));
    expect(shell()).toBe('pending');
    const docSubscribes = () => fsBox.log.filter(([op, kind]) => op === 'subscribe' && kind === 'doc').length;
    const subscribedBefore = docSubscribes();
    await act(async () => { gen1.next(querySnap(['ab-1'])); });
    await flush();
    expect(shell()).toBe('pending');
    // The pending shell looks the same either way; settling from the retired
    // evidence would have SUBSCRIBED ab-1 here. It must not.
    expect(activeListener('doc', 'ab-1')).toBeUndefined();
    expect(docSubscribes()).toBe(subscribedBefore);
    await deliverQuery('agent-1', ['ab-1']);
    expect(shell()).toBe('pending'); // now awaiting the matching snapshot
    expect(activeListener('doc', 'ab-1')).toBeTruthy(); // the CURRENT generation's evidence does subscribe
    expect(docSubscribes()).toBe(subscribedBefore + 1);
    await deliverDoc('ab-1', ACTIVE_DOC);
    expect(shell()).toBeNull();
  });

  it('(1b) direct↔query in place: query agent-1 (ab-1 admitted) → direct ab-2 → query agent-1 again: pending, and the retired lookup\'s ab-1 is never subscribed or shown before the current lookup delivers', async () => {
    priceBox.table = genuineTable();
    flags.gate = true;
    await mount(queryProp('agent-1'));
    const gen1 = activeListener('query', 'agent-1');
    await deliverQuery('agent-1', ['ab-1']);
    await deliverDoc('ab-1', ACTIVE_DOC);
    expect(shell()).toBeNull();
    // The direct-ID route: the hook is called with null and no opt-in (row 7).
    await mount({ ...openingProp(), agentBattleId: 'ab-2' });
    expect(shell()).toBe('pending');
    await deliverDoc('ab-2', ACTIVE_DOC);
    expect(shell()).toBeNull();
    const docSubscribes = () => fsBox.log.filter(([op, kind]) => op === 'subscribe' && kind === 'doc').length;
    const before = docSubscribes();
    // Back to the query path, the same agent: generation 1's `success ab-1` is retired evidence.
    await mount(queryProp('agent-1'));
    expect(shell()).toBe('pending');
    // C-2 / C-4: "Evidence from a retired generation never settles the screen, whatever its ID."
    expect(activeListener('doc', 'ab-1')).toBeUndefined();
    expect(activeListener('doc', 'ab-2')).toBeUndefined();
    expect(docSubscribes()).toBe(before);
    expect(boardShown()).toBe(false);
    await act(async () => { gen1.next(querySnap(['ab-1'])); }); // a callback queued on the retired listener
    await flush();
    expect(shell()).toBe('pending');
    expect(docSubscribes()).toBe(before);
    // The CURRENT lookup delivers: agent-1 has since moved on to ab-3.
    await deliverQuery('agent-1', ['ab-3']);
    expect(activeListener('doc', 'ab-3')).toBeTruthy();
    expect(docSubscribes()).toBe(before + 1);
    await deliverDoc('ab-3', ACTIVE_DOC);
    expect(shell()).toBeNull();
    expect(boardShown()).toBe(true);
  });

  it('(2) an unchanged successful result: no pending flash, no resubscribe', async () => {
    priceBox.table = genuineTable();
    flags.gate = true;
    await mount(queryProp());
    await deliverQuery('agent-1', ['ab-1']);
    await deliverDoc('ab-1', ACTIVE_DOC);
    const log = fsBox.log.length;
    await deliverQuery('agent-1', ['ab-1']);
    expect(shell()).toBeNull();
    expect(fsBox.log.length).toBe(log);
  });

  it('(3) null→null: "No active battle" only from the CURRENT agent\'s confirmed empty', async () => {
    flags.gate = true;
    await mount(queryProp('agent-1'));
    await deliverQuery('agent-1', [], { fromCache: false });
    expect(shell()).toBe('no-battle');
    expect(container.textContent).toContain('No active battle');
    await mount(queryProp('agent-2'));
    expect(shell()).toBe('pending');
    await deliverQuery('agent-2', [], { fromCache: false });
    expect(shell()).toBe('no-battle');
  });

  it('(4)(5) a retired lookup\'s late answer is ignored; the current error is shown', async () => {
    flags.gate = true;
    await mount(queryProp('agent-1'));
    const retired = activeListener('query', 'agent-1');
    await mount(queryProp('agent-2'));
    await act(async () => { retired.next(querySnap(['ab-1'])); retired.error({ message: 'old', code: 'old' }); });
    await flush();
    expect(shell()).toBe('pending');
    expect(shellError()).toBeNull();
    await act(async () => { activeListener('query', 'agent-2').error({ message: 'denied', code: 'permission-denied' }); });
    await flush();
    expect(shell()).toBe('unavailable');
    // (5) the CURRENT generation's error identity — never the retired 'old'.
    expect(shellError()).toBe('permission-denied');
  });

  it('(6) no signed-in user → "Battle unavailable", never "No active battle"', async () => {
    authBox.currentUser = null;
    flags.gate = true;
    await mount(queryProp());
    expect(shell()).toBe('unavailable');
    expect(shellError()).toBe('no-auth');
    expect(container.textContent).not.toContain('No active battle');
  });

  it('(10)(12) unconfirmed empty → "Battle unavailable" → server-confirmed empty → "No active battle", which a later from-cache event does not downgrade', async () => {
    flags.gate = true;
    await mount(queryProp());
    await deliverQuery('agent-1', [], { fromCache: true });
    expect(shell()).toBe('unavailable');
    expect(shellError()).toBe('unconfirmed-empty');
    await deliverQuery('agent-1', [], { fromCache: false });
    expect(shell()).toBe('no-battle');
    expect(shellError()).toBeNull();
    await deliverQuery('agent-1', [], { fromCache: true });
    expect(shell()).toBe('no-battle');
  });

  it('(11) unconfirmed empty → a non-empty result: subscribe and continue to admission', async () => {
    priceBox.table = genuineTable();
    flags.gate = true;
    await mount(queryProp());
    await deliverQuery('agent-1', [], { fromCache: true });
    expect(shell()).toBe('unavailable');
    await deliverQuery('agent-1', ['ab-1'], { fromCache: false });
    expect(activeListener('doc', 'ab-1')).toBeTruthy();
    await deliverDoc('ab-1', ACTIVE_DOC);
    expect(shell()).toBeNull();
  });

  it('(13) the listener-call shape: gated → the options object with includeMetadataChanges; the SAME single listener', async () => {
    flags.gate = true;
    await mount(queryProp());
    const queries = fsBox.listeners.filter((l) => l.kind === 'query');
    expect(queries).toHaveLength(1);
    expect(queries[0].arity).toBe(4);
    expect(queries[0].options).toEqual({ includeMetadataChanges: true });
    expect(OFF.queryPath.resolved.fsLog[0]).toEqual(['subscribe', 'query', 'agent-1', 3]); // flag-off, captured
  });

  it('a query-only battle that completes and drops out of the active query ends at "No active battle"', async () => {
    priceBox.table = genuineTable();
    flags.gate = true;
    await mount(queryProp());
    await deliverQuery('agent-1', ['ab-1']);
    await deliverDoc('ab-1', ACTIVE_DOC);
    expect(shell()).toBeNull();
    await deliverQuery('agent-1', [], { fromCache: false });
    expect(shell()).toBe('no-battle');
  });
});

// ── OFF-7: flag on, excluded battles ─────────────────────────────────────────
/**
 * A canonical DOM serialization: attributes sorted, style declarations sorted,
 * empty style attributes dropped. Two renders that reached the same DOM by
 * different update histories (React patches attributes in place) compare equal.
 */
function canonical(node) {
  if (node.nodeType === 3) return node.textContent;
  if (node.nodeType !== 1) return '';
  const tag = node.tagName.toLowerCase();
  const attrs = [...node.attributes]
    .filter((a) => !(a.name === 'style' && !a.value.trim()))
    .map((a) => (a.name === 'style'
      ? `style="${a.value.split(';').map((d) => d.trim()).filter(Boolean).sort().join('; ')}"`
      : `${a.name}="${a.value}"`))
    .sort();
  return `<${tag} ${attrs.join(' ')}>${[...node.childNodes].map(canonical).join('')}</${tag}>`;
}
/** What the legacy path shows once settled: the board, the header's words and digits, the requests. */
const legacyView = () => ({
  board: canonical(container.querySelector('[data-board]')),
  // The persistent top section (z-index 3): back bar, status, names, digits, day, turn line.
  header: [...container.querySelectorAll('div')].find((d) => d.style.zIndex === '3')?.textContent ?? null,
  lastCalls: priceBox.calls.slice(-2),
});

describe('OFF-7 — flag on with an excluded battle: pending first, then exactly the legacy path', () => {
  const EXCLUSIONS = {
    'tournament mode': { gameMode: 'baggerbomb_tournament' },
    'missing mode': { gameMode: undefined },
    'a group stamp': { groupId: 'g-1' },
    'an empty-string group stamp (not coerced)': { groupId: '' },
    'a non-CPU opponent': { opponent: { odUserId: 'user-2', portfolio: CPU_PORTFOLIO } },
  };
  for (const [name, patch] of Object.entries(EXCLUSIONS)) {
    it(`${name}: the same screen and requests as flag-off once the record arrives`, async () => {
      const doc = { ...ACTIVE_DOC, ...patch };
      priceBox.table = genuineTable();
      await mount(openingProp());
      await deliverDoc('ab-1', doc);
      const off = legacyView();
      expect(off.header).toMatch(/CPU/);
      expect(off.board).toContain('AAPL');
      act(() => root.unmount());
      root = createRoot(container);
      priceBox.calls.length = 0;
      flags.gate = true;
      await mount(openingProp());
      expect(shell()).toBe('pending');
      expect(priceBox.calls).toEqual([]);
      await deliverDoc('ab-1', doc);
      expect(legacyView()).toEqual(off);
    });
  }

  it('terminal missing / error before classification: "Battle unavailable" (never legacy)', async () => {
    flags.gate = true;
    await mount(openingProp());
    await failDoc('ab-1');
    expect(shell()).toBe('unavailable');
  });
});

// ── ON-F5b and the extremes' session rule, at the screen ─────────────────────
describe('ON-F5b — stored evidence is qualified strictly; complete quotes override it while active', () => {
  const BAD_STORED = {
    'numeric strings': { currentScore: '12.4', opponentScore: '3.1', lastScoredAt: '2026-10-01T16:47:00.000Z' },
    null: { currentScore: null, opponentScore: 3.1, lastScoredAt: '2026-10-01T16:47:00.000Z' },
    NaN: { currentScore: Number.NaN, opponentScore: 3.1, lastScoredAt: '2026-10-01T16:47:00.000Z' },
    'a missing score': { currentScore: 12.4, lastScoredAt: '2026-10-01T16:47:00.000Z' },
    'a date-only time': { currentScore: 12.4, opponentScore: 3.1, lastScoredAt: '2026-10-01' },
    'an impossible date': { currentScore: 12.4, opponentScore: 3.1, lastScoredAt: '2026-02-30T16:47:00.000Z' },
    'a future time': { currentScore: 12.4, opponentScore: 3.1, lastScoredAt: '2026-10-01T18:00:00.000Z' },
  };
  for (const [name, scoreState] of Object.entries(BAD_STORED)) {
    it(`${name} with incomplete quotes → "Comparison unavailable"; complete quotes → the browser estimate`, async () => {
      priceBox.table = without(genuineTable(), 'AAPL');
      await mountGated(openingProp(), { ...NEW_DOC, scoreState: { ...scoreState, tradeCount: 1 } });
      expect(label()).toEqual({ kind: 'unavailable', text: 'Comparison unavailable' });
      priceBox.table = genuineTable();
      await poll();
      expect(label().kind).toBe('browser');
    });
  }

  it('a finite zero pair with a valid old time qualifies, and repeated polls never move its time', async () => {
    priceBox.table = without(genuineTable(), 'AAPL');
    await mountGated(openingProp(), { ...NEW_DOC, scoreState: STORED(0, 0, '2026-09-29T19:59:00.000Z') });
    expect(label()).toEqual({ kind: 'last-scored', text: expect.stringContaining('Last scored Sep 29, 3:59 PM EDT') });
    await poll();
    await poll();
    expect(label().text).toContain('Last scored Sep 29, 3:59 PM EDT');
  });
});

describe('§7.2 item 4 — the controlled extremes are TODAY\'s only', () => {
  it('a genuine current timed in a previous session stays usable, but its high/low/open are withheld from today\'s slot', async () => {
    priceBox.table = { ...genuineTable(), AAPL: quote('AAPL', { timestamp: Math.floor(Date.parse('2026-09-30T20:00:00.000Z') / 1000) }) };
    await mountGated();
    await click(symbolEl('AAPL', 'player'));
    expect(lastResearch().controlledQuote).toEqual({ posKey: 'player:star:0', symbol: 'AAPL', price: 153, extremes: null });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Refuter D (cumulative review; findings F7, F8, F10, F11, F16 of the
// test-integrity lens) — rows the spec's acceptance text names and the suite
// above does not run. Each block is labeled by the finding it answers. A row
// marked PARITY is a spec-literal variant that no expressible defect on the
// current tree distinguishes from a row above (recorded as such in
// REFUTATION.md); the others fail under the mutation named beside them.
// ═════════════════════════════════════════════════════════════════════════════

// ── F7: ON-F2a "Real held symbol click on EACH SIDE while missing, fallback,
//        unknown or stale". The CPU side's matrix, and the CPU STALE click —
//        the one CPU state the rows above never click (a retained tuple with
//        no current). Fails under F7_cpuStaleDetails (REFUTATION.md).
describe('ON-F2a (F7) — the CPU side: every unqualified state, including STALE', () => {
  const CPU_UNQUALIFIED = {
    missing: (t) => without(t, 'GOOGL'),
    'configured fallback': (t) => ({ ...t, GOOGL: STOCK_FALLBACK('GOOGL') }),
    'unknown origin': (t) => ({ ...t, GOOGL: { ...t.GOOGL, quoteOrigin: undefined } }),
    'previous-close substitution': (t) => ({ ...t, GOOGL: { ...t.GOOGL, price: 160, quoteOrigin: { version: 1, price: 'provider-previous-close', previousClose: 'provider-previous-close' } } }),
    'websocket-written cache record': (t) => ({ ...t, GOOGL: { ...t.GOOGL, price: 999, source: 'websocket' } }),
  };
  for (const [name, mutate] of Object.entries(CPU_UNQUALIFIED)) {
    it(`${name} (CPU): no priced modal, no builder call, no request — the notice, with the CPU entry still labeled "Entry"`, async () => {
      priceBox.table = mutate(genuineTable());
      await mountGated();
      const calls = priceBox.calls.length;
      const before = seen.research.length;
      await click(symbolEl('GOOGL', 'cpu'));
      expect(modalOpen()).toBeNull();
      expect(seen.research.length).toBe(before);
      expect(notice()).toEqual({ symbol: 'GOOGL', text: expect.stringContaining('Quote unavailable — price details unavailable') });
      expect(notice().text).toContain('Entry $160.00');
      expect(priceBox.calls.length).toBe(calls);
      expect(rowStatus('GOOGL')).toEqual(['Quote unavailable']);
    });
  }

  it('stale (CPU): a good quote, then a failed poll — the CPU row reads the plain status and its click opens NO priced view; the retained tuple is never a detail', async () => {
    priceBox.table = genuineTable();
    await mountGated();
    expect(await openedPrice('GOOGL', 'cpu')).toBe(162); // healthy first: the CPU click works
    priceBox.mode = 'throw';
    await poll();
    expect(rowStatus('GOOGL')).toEqual(['Quote unavailable']); // D-85: no dollars on the CPU side
    const calls = priceBox.calls.length;
    const before = seen.research.length;
    await click(symbolEl('GOOGL', 'cpu'));
    expect(modalOpen()).toBeNull();
    expect(seen.research.length).toBe(before);
    expect(notice()).toEqual({ symbol: 'GOOGL', text: expect.stringContaining('Entry $160.00') });
    expect(priceBox.calls.length).toBe(calls);
  });
});

// ── F8: ON-F2b "Repeat across battle A→B with the same symbol, a same-symbol
//        swap at an identical price, and leaving/re-entering a position, ON
//        BOTH SIDES" — each scenario on the side the rows above do not run it
//        on. The CPU re-entry row fails under F8_cpuLineageNoSwapId; the CPU
//        lifecycle row fails under F7_cpuStaleDetails (REFUTATION.md).
describe('ON-F2b (F8) — the same lifecycle on the OTHER side of each scenario', () => {
  it('CPU: a same-position quote updates in place; a failure closes before any stale render; recovery does not reopen; a click uses the recovered value', async () => {
    priceBox.table = genuineTable();
    await mountGated();
    await click(symbolEl('GOOGL', 'cpu'));
    expect(modalOpen()).toBe('GOOGL');
    expect(lastResearch().controlledQuote.posKey).toBe('cpu:star:0');
    expect(seen.researchMounts).toBe(1);
    priceBox.table = { ...genuineTable(), GOOGL: quote('GOOGL', { price: 163 }) };
    await poll();
    expect(lastResearch().asset.price).toBe(163);
    expect(lastResearch().controlledQuote.price).toBe(163);
    expect(seen.researchMounts).toBe(1); // updated, not remounted
    const rendersBeforeFailure = seen.research.length;
    priceBox.table = without(genuineTable(), 'GOOGL');
    await poll();
    expect(modalOpen()).toBeNull();
    expect(seen.research.length).toBe(rendersBeforeFailure); // never rendered with stale dollars
    priceBox.table = { ...genuineTable(), GOOGL: quote('GOOGL', { price: 164 }) };
    await poll();
    expect(modalOpen()).toBeNull(); // recovery does not auto-reopen
    await click(symbolEl('GOOGL', 'cpu'));
    expect(lastResearch().controlledQuote.price).toBe(164);
  });

  it('CPU: battle A→B with the same symbol closes the view, and B never reopens it', async () => {
    priceBox.table = genuineTable();
    await mountGated();
    await click(symbolEl('GOOGL', 'cpu'));
    expect(modalOpen()).toBe('GOOGL');
    await mount({ ...openingProp(), agentBattleId: 'ab-2' });
    expect(modalOpen()).toBeNull();
    expect(shell()).toBe('pending');
    await deliverDoc('ab-2', ACTIVE_DOC);
    expect(modalOpen()).toBeNull();
  });

  it('CPU: a same-symbol re-entry at an IDENTICAL price (swap identity only) is a NEW position generation — the open view closes, the evidence restarts empty, the poll restarts', async () => {
    priceBox.table = genuineTable();
    await mountGated();
    await click(symbolEl('GOOGL', 'cpu'));
    expect(lastResearch().controlledQuote.posKey).toBe('cpu:star:0');
    const calls = priceBox.calls.length;
    priceBox.mode = 'defer';
    // The CPU snapshot transition: the same symbol in the same slot at the same
    // price, carrying swap identity (§3.2: "the same lifecycle rule to CPU
    // snapshot transitions"). scoreState.tradeCount is the PLAYER's and does
    // not move, so the slot's own lineage is the only evidence.
    const reentered = { ...CPU_PORTFOLIO, star: [{ symbol: 'GOOGL', price: 160, swapPrice: 160, swappedInAt: '2026-10-01T16:30:00.000Z', swappedInDay: 1 }, CPU_PORTFOLIO.star[1]] };
    await deliverDoc('ab-1', { ...ACTIVE_DOC, opponent: { odUserId: 'cpu', portfolio: reentered } });
    expect(modalOpen()).toBeNull();                 // identity-bound detail closed
    expect(unavailableRows()).toContain('GOOGL');   // no inherited observation
    expect(priceBox.calls.length).toBe(calls + 2);  // the poll restarted for the new lineage (stock + crypto)
    await settle();
    expect(unavailableRows()).toEqual([]);
    await click(symbolEl('GOOGL', 'cpu'));
    expect(lastResearch().controlledQuote).toMatchObject({ posKey: 'cpu:star:0', price: 162 });
    expect(lastResearch().asset.lockedPrice).toBe(160); // the identical entry, still the entry
  });

  it('player: leaving and re-entering a position closes the view on leaving and keeps it closed on re-entry', async () => {
    priceBox.table = { ...genuineTable(), SHOP: quote('AAPL', { price: 71, previousClose: 70 }) };
    await mountGated();
    await click(symbolEl('AAPL', 'player'));
    expect(modalOpen()).toBe('AAPL');
    const aaplGone = { ...PLAYER_PORTFOLIO, star: [{ symbol: 'SHOP', price: 70 }, PLAYER_PORTFOLIO.star[1]], startingPrices: { ...PLAYER_PORTFOLIO.startingPrices, SHOP: 70 } };
    await deliverDoc('ab-1', { ...ACTIVE_DOC, portfolio: aaplGone });
    expect(modalOpen()).toBeNull();
    await deliverDoc('ab-1', ACTIVE_DOC);
    expect(modalOpen()).toBeNull();
    await click(symbolEl('AAPL', 'player'));
    expect(lastResearch().controlledQuote.posKey).toBe('player:star:0');
  });
});

// ── F10: ON-F3a "Stocks AND crypto … Assert row, badges, totals, the
//        last-quote tuple and no extra requests". (a) Crypto at the screen, on
//        both sides — PARITY: after the two batch halves merge, the screen's
//        ordering path is market-agnostic, and the batch suite parameterizes
//        both markets through the real gate. (b) The stock case on a DAY-2
//        fixture, where the retained previousClose is load-bearing for the
//        badge and the total: fails under F10_importRejectedClose (which the
//        gate and batch suites also catch — REFUTATION.md).
describe('ON-F3a (F10, parity) — crypto at the screen, on both sides', () => {
  const CRYPTO_CASES = [
    { name: 'R1 strictly older (both timed) → R2 kept', r1Ts: OLDER, keepR2: true, asOf: 'Oct 1, 12:50 PM EDT' },
    { name: 'R1 newer → R1 adopted', r1Ts: NEWER, keepR2: false, asOf: 'Oct 1, 12:55 PM EDT' },
    { name: 'equal times → R1 adopted (latest arrival)', r1Ts: T2, keepR2: false, asOf: 'Oct 1, 12:50 PM EDT' },
    { name: 'R1 untimed → adopted with no time', r1Ts: undefined, keepR2: false, asOf: null },
  ];
  const SYMBOLS = [
    { sym: 'BTC', side: 'player', r2: 62000, r1: 61500, label: { r2: '$62,000.00', r1: '$61,500.00' } },
    { sym: 'ETH', side: 'cpu', r2: 2600, r1: 2550 },
  ];
  for (const s of SYMBOLS) {
    for (const c of CRYPTO_CASES) {
      it(`${s.sym} (${s.side}): ${c.name}`, async () => {
        priceBox.mode = 'defer';
        priceBox.table = genuineTable();
        await mountGated();
        await poll(); // R2 issued
        expect(priceBox.pending.map((p) => p.kind)).toEqual(['stock', 'crypto', 'stock', 'crypto']);
        await resolvePending(2);
        await resolvePending(3, { [s.sym]: quote(s.sym, { price: s.r2, previousClose: PREV[s.sym], timestamp: T2 }) });
        expect(await openedPrice(s.sym, s.side)).toBe(s.r2);
        await resolvePending(1, { [s.sym]: quote(s.sym, { price: s.r1, previousClose: PREV[s.sym] - 100, timestamp: c.r1Ts }) });
        await resolvePending(0);
        const expectPrice = c.keepR2 ? s.r2 : s.r1;
        expect(await openedPrice(s.sym, s.side)).toBe(expectPrice);
        expect(priceBox.calls.length).toBe(4); // mount + one poll: nothing more
        priceBox.mode = 'throw';
        await poll();
        // The retained tuple: dated on the player's side only (D-85); the CPU side shows the plain status.
        const dated = s.side === 'player' && c.asOf ? `Last quote ${c.keepR2 ? s.label.r2 : s.label.r1} · as of ${c.asOf}` : 'Quote unavailable';
        expect(rowStatus(s.sym)).toEqual([dated]);
      });
    }
  }
});

describe('ON-F3a (F10) — badges, totals, the row and the tuple at the screen, on a DAY-2 fixture', () => {
  // Day two, AAPL entered at 100 (Star, ATR 2.5), no history, no banked points:
  // the threshold baseline is the retained GENUINE close, so a wrongly
  // imported close moves the badge and the total (ON-DAY2's 75 is 60 + 15).
  const DAY2 = {
    ...ACTIVE_DOC,
    activatedAt: '2026-09-30T13:30:00.000Z',
    timing: { ...ACTIVE_DOC.timing, currentTradingDay: 2 },
    thresholdHistory: {},
    trades: [],
    scoreState: { currentScore: 0, opponentScore: 0, lastScoredAt: null, tradeCount: 0 },
    portfolio: { ...PLAYER_PORTFOLIO, star: [{ symbol: 'AAPL', price: 100 }, PLAYER_PORTFOLIO.star[1]], startingPrices: { ...PLAYER_PORTFOLIO.startingPrices, AAPL: 100 } },
    scoring: { thresholds: { ...ACTIVE_DOC.scoring.thresholds, AAPL: { threshold: 2.5 } } },
  };
  async function breakdownOf(symbol, side) {
    await click(pointsEl(symbol, side));
    const b = seen.breakdown[seen.breakdown.length - 1];
    return { total: b.asset.totalScore, baggers: b.asset.baggerBombs, busts: b.asset.busts, currentPrice: b.asset.currentPrice };
  }
  const rowPrice = (symbol) => container.querySelector(`[data-row-price="${symbol}"]`)?.textContent ?? null;
  // R2: 103 with a genuine close of 100 (3% → ×1.2 → Bagger: 60 + 15 = 75).
  // R1: 101 with a genuine close of 101.5 (if adopted: 1% → 20, no badge; if
  // only its close were imported: baseline 101.5 → ×0.59 → 60, no badge).
  const CASES = [
    { name: 'R1 strictly older → R2 kept WHOLE: price, close, badge and total unchanged', r1Ts: OLDER, expect: { total: 75, baggers: 1, busts: 0, currentPrice: 103 }, prose: 'You lead by 75', price: '$103.00', asOf: 'Oct 1, 12:50 PM EDT' },
    { name: 'R1 newer → R1 adopted WHOLE: price, close, no badge, total', r1Ts: NEWER, expect: { total: 20, baggers: 0, busts: 0, currentPrice: 101 }, prose: 'You lead by 20', price: '$101.00', asOf: 'Oct 1, 12:55 PM EDT' },
    { name: 'equal times → R1 adopted (latest arrival) with its own close', r1Ts: T2, expect: { total: 20, baggers: 0, busts: 0, currentPrice: 101 }, prose: 'You lead by 20', price: '$101.00', asOf: 'Oct 1, 12:50 PM EDT' },
  ];
  // The TOTAL is read from the comparison prose (one derivation from the
  // selected pair, C-1 item 4): the counter digits ramp between two consecutive
  // same-kind (browser→browser) pairs by design (A-2), so they are not the
  // place to read a changed total synchronously.
  const prose = () => container.querySelector('[data-comparison-prose]')?.textContent ?? null;
  for (const c of CASES) {
    it(c.name, async () => {
      priceBox.mode = 'defer';
      priceBox.table = flatTable(); // every other position flat: the player total is AAPL's points alone
      await mountGated(openingProp(), DAY2);
      await poll(); // R2 issued
      await resolvePending(2, { AAPL: quote('AAPL', { price: 103, previousClose: 100, timestamp: T2 }) });
      await resolvePending(3);
      expect(await breakdownOf('AAPL', 'player')).toEqual({ total: 75, baggers: 1, busts: 0, currentPrice: 103 });
      expect(counters()).toEqual(['+75', '+0']); // the first browser pair enters on a switch: instant
      expect(prose()).toBe('You lead by 75');
      expect(rowPrice('AAPL')).toBe('$103.00');
      await resolvePending(1);
      await resolvePending(0, { AAPL: quote('AAPL', { price: 101, previousClose: 101.5, timestamp: c.r1Ts }) });
      expect(await breakdownOf('AAPL', 'player')).toEqual(c.expect);
      expect(label().kind).toBe('browser');
      expect(prose()).toBe(c.prose);
      expect(rowPrice('AAPL')).toBe(c.price);
      expect(priceBox.calls.length).toBe(4); // no extra requests
      priceBox.mode = 'throw';
      await poll();
      expect(rowStatus('AAPL')).toEqual([`Last quote ${c.price} · as of ${c.asOf}`]);
      expect(counters()).toEqual([]); // the comparison is unavailable now (no stored pair)
    });
  }
});

// ── F11: ON-ROW "closed-trade points are kept with NO DOUBLE COUNT" and
//        ON-VALID "the established browser arithmetic" — the gated browser
//        TOTAL with banked points, which no row above pins (every switch
//        fixture above uses NEW_DOC, whose `trades` is empty). Fails under
//        F11b_doubleBanked (REFUTATION.md).
describe('ON-ROW / ON-VALID (F11) — closed-trade points enter the gated browser total exactly once', () => {
  it('flat quotes, one closed trade of 7 points: the player total IS the banked sum, the swapped-in row carries none of it, the CPU total is 0', async () => {
    priceBox.table = flatTable();
    await mountGated(openingProp(), { ...ACTIVE_DOC, thresholdHistory: {}, trades: [{ symbolOut: 'XOM', symbolIn: 'TSLA', lockedPoints: 7, executedAt: '2026-10-01T15:00:00.000Z' }] });
    expect(label().kind).toBe('browser');
    expect(counters()).toEqual(['+7', '+0']);
    expect(container.querySelector('[data-comparison-prose]').textContent).toBe('You lead by 7');
    await click(pointsEl('TSLA', 'player'));
    expect(seen.breakdown[seen.breakdown.length - 1].asset.totalScore).toBe(0);
  });

  it('moving quotes: the total equals Σ(row points) + banked 7.5, from the SAME breakdown totals the rows show', async () => {
    priceBox.table = genuineTable();
    await mountGated(); // ACTIVE_DOC: one closed trade, 7.5 locked
    let sum = 0;
    for (const tier of ['star', 'core', 'support']) {
      for (const a of PLAYER_PORTFOLIO[tier]) {
        await click(pointsEl(a.symbol, 'player'));
        sum += seen.breakdown[seen.breakdown.length - 1].asset.totalScore;
      }
    }
    const expected = Math.round(sum + 7.5); // the shipped formula, in the shipped summation order
    expect(sum).toBeGreaterThan(0); // the fixture moves: not the banked sum alone
    expect(counters()[0]).toBe(`+${expected}`);
  });
});

// ── F16: ON-F4a "Layouts and controller states agree" — the legacy-header
//        (controller on, pane off) layout. PARITY: the rows are ONE `boardRows`
//        element rendered by both controller-on layouts (AgentBattleScreen.jsx
//        :2414, :3060, :3217), so no pane-off-only holdings defect is expressible.
describe('ON-F4a (F16, parity) — the legacy-header (pane-off) layout agrees', () => {
  const OLD = { ...PLAYER_PORTFOLIO, core: [{ symbol: 'MSFT', price: 400 }, { symbol: 'XOM', price: 110 }] };
  it('legacy header (controller, pane off): only NEW drives holdings, requests and enrichment; later player and CPU changes follow the snapshot', async () => {
    Object.assign(flags, { controller: true, pane: false });
    priceBox.table = { ...genuineTable(), XOM: quote('AAPL', { price: 112, previousClose: 111 }), SHOP: quote('AAPL', { price: 71, previousClose: 70 }), CRWD: quote('AAPL', { price: 300, previousClose: 298 }) };
    await mountGated(openingProp({ portfolio: OLD }));
    expect(priceBox.calls[0][1]).toContain('TSLA');
    expect(priceBox.calls.flatMap((c) => c[1])).not.toContain('XOM');
    expect(html()).not.toContain('>XOM<');
    expect(shownSymbols('player')).toContain('TSLA');
    await deliverDoc('ab-1', { ...ACTIVE_DOC, portfolio: { ...PLAYER_PORTFOLIO, star: [{ symbol: 'SHOP', price: 70 }, PLAYER_PORTFOLIO.star[1]], startingPrices: { ...PLAYER_PORTFOLIO.startingPrices, SHOP: 70 } } });
    expect(shownSymbols('player')[0]).toBe('SHOP');
    expect(priceBox.calls.at(-2)[1]).toContain('SHOP');
    await deliverDoc('ab-1', { ...ACTIVE_DOC, opponent: { odUserId: 'cpu', portfolio: { ...CPU_PORTFOLIO, star: [{ symbol: 'CRWD', price: 300 }, CPU_PORTFOLIO.star[1]] } } });
    expect(shownSymbols('cpu')[0]).toBe('CRWD');
    expect(priceBox.calls.at(-2)[1]).toContain('CRWD');
    expect(label().kind).toBe('browser'); // the legacy header consumes the same completeness
  });
});

// ── F15: OFF-5 "swaps" — a swap DELIVERED MID-SESSION with the flag off, with
//        the breakdown and the legacy research view open; then a poll. The
//        OFF rows above hold a statically swapped-in position only. Its
//        reference (`swapTransition`) is in the generated block above, captured
//        at the pre-build SHA like the others.
describe('OFF-5 (F15) — a mid-session swap, flag off', () => {
  // The legacy header's counters ramp on animation frames, which this harness
  // does not fake (Date and setInterval only): whether a frame has fired by
  // record() time differs between a filtered and a full-file run (observed: 3
  // bytes of markup, REFUTATION.md F15). The counter is pinned frame by frame
  // by OFF-AS; this row pins the SWAP path, so frames are held for its duration
  // and the digits rest at their mount text in every run and on both trees.
  it('OFF swapTransition: breakdown and research open across a swap; the poll restarts for the incoming symbol; a later poll', async () => {
    const realRaf = window.requestAnimationFrame;
    const realCaf = window.cancelAnimationFrame;
    window.requestAnimationFrame = () => 0;
    window.cancelAnimationFrame = () => {};
    try {
    priceBox.table = { ...genuineTable(), XOM: quote('AAPL', { price: 112, previousClose: 111 }) };
    await mount(openingProp());
    await deliverDoc('ab-1', ACTIVE_DOC);
    await click(pointsEl('MSFT', 'player'));
    await click(symbolEl('TSLA', 'player'));
    const before = record();
    // The swap writer's shape (agentSwapExecution.js): the incoming position
    // carries swapPrice / swappedInAt / swappedInDay and no price; tradeCount
    // increments; the closed trade records its locked points.
    const swapped = {
      ...ACTIVE_DOC,
      portfolio: { ...PLAYER_PORTFOLIO, core: [{ symbol: 'XOM', swapPrice: 112, swappedInAt: '2026-10-01T16:40:00.000Z', swappedInDay: 1 }, PLAYER_PORTFOLIO.core[1]] },
      scoreState: { ...ACTIVE_DOC.scoreState, tradeCount: 2 },
      trades: [...ACTIVE_DOC.trades, { symbolOut: 'MSFT', symbolIn: 'XOM', lockedPoints: 3, executedAt: '2026-10-01T16:40:00.000Z' }],
    };
    await deliverDoc('ab-1', swapped);
    const afterSwap = record();
    await poll();
    offReference('swapTransition', { before, afterSwap, polled: record() }, OFF.swapTransition);
    } finally {
      window.requestAnimationFrame = realRaf;
      window.cancelAnimationFrame = realCaf;
    }
  });
});
