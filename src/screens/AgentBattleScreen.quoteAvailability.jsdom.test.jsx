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
const priceBox = vi.hoisted(() => ({ calls: [], table: {}, mode: 'resolve', pending: [] }));
vi.mock('../services/eodhdAPI', () => {
  const answer = (kind, symbols) => {
    priceBox.calls.push([kind, [...symbols]]);
    const build = () => Object.fromEntries(symbols.filter((s) => priceBox.table[s] !== undefined).map((s) => [s, priceBox.table[s]]));
    if (priceBox.mode === 'defer') {
      return new Promise((resolve, reject) => priceBox.pending.push({ kind, symbols: [...symbols], resolve, reject, build }));
    }
    if (priceBox.mode === 'throw') return Promise.reject(new Error('network down'));
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
const wsBox = vi.hoisted(() => ({ prices: {} }));
vi.mock('../hooks/useWebSocketPrices', () => ({ useWebSocketPrices: () => ({ prices: wsBox.prices, status: 'disconnected' }) }));

// ── framer-motion, stubbed (deterministic markup; motion props observable) ───
const framerSeen = vi.hoisted(() => ({ bars: [] }));
vi.mock('framer-motion', async () => {
  const ReactMod = await import('react');
  const MOTION_PROPS = new Set(['initial', 'animate', 'exit', 'transition', 'variants', 'whileHover', 'whileTap', 'whileFocus',
    'whileInView', 'layout', 'layoutId', 'drag', 'dragConstraints', 'dragElastic', 'dragMomentum', 'onDragEnd', 'onDragStart',
    'dragTransition', 'dragControls', 'dragListener', 'onAnimationComplete', 'onAnimationStart', 'custom', 'viewport', 'onUpdate']);
  const cache = {};
  const make = (tag) => {
    if (!cache[tag]) {
      cache[tag] = ReactMod.forwardRef(function MotionStub(props, ref) {
        if (props.animate && typeof props.animate === 'object' && 'width' in props.animate) {
          framerSeen.bars.push({ width: props.animate.width, initial: props.initial, barPct: props['data-bar-pct'] ?? null });
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
  default: (props) => {
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
vi.mock('../components/AgentPresence/AgentPresenceMount', () => ({
  default: (props) => {
    seen.presence.push(JSON.parse(JSON.stringify({ duel: props.duel ?? null, reactivityLevel: props.reactivityLevel ?? null })));
    return <span data-test-face="1" />;
  },
}));
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
  priceBox.table = {};
  wsBox.prices = {};
  framerSeen.bars.length = 0;
  seen.research.length = 0;
  seen.breakdown.length = 0;
  seen.presence.length = 0;
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

// BEGIN GENERATED OFF REFERENCES — captured at the pre-build SHA 44d0c63eba4e3099552d3ec3dbde6a89660a7e06 (14 entries; loadingReturn added after the first capture, captured at the same SHA).
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
  });
});

// ── ON-F5a: atomic source switches, captured at EVERY commit ─────────────────
const tealStrong = (bg) => /rgba\(var\(--ft-teal-rgb\), 1\)\)$/.test(bg || '') || (bg || '').startsWith('linear-gradient(90deg, rgb(94, 234, 212)');
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
      const storedFaces = facesOf(commits, toStored, facesFrom);
      expect(storedFaces.length).toBeGreaterThan(0);
      for (const f of [...storedFaces, ...seen.presence.slice(toStored.faceCount)]) {
        expect(f.duel).toEqual({ playerScore: 3.1, opponentScore: 12.4, statusFeed: null });
        expect(f.reactivityLevel).toBe('static');
      }
      // The bar's teal half remounted on the switch with `initial={false}` (framer stub).
      const storedBar = framerSeen.bars.filter((b) => b.barPct === toStored.barPct).at(-1);
      expect(storedBar.initial).toBe(false);

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
    const before = framerSeen.bars.length;
    await mount({ ...openingProp(), agentBattleId: 'ab-2' });
    expect(shell()).toBe('pending');
    await deliverDoc('ab-2', NEW_DOC);
    expect(label().kind).toBe('browser');
    // A fresh bar instance mounted at its target (initial={false}) for battle B.
    expect(framerSeen.bars.slice(before).some((b) => b.initial === false)).toBe(true);
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
    await act(async () => { gen1.next(querySnap(['ab-1'])); });
    await flush();
    expect(shell()).toBe('pending');
    await deliverQuery('agent-1', ['ab-1']);
    expect(shell()).toBe('pending'); // now awaiting the matching snapshot
    await deliverDoc('ab-1', ACTIVE_DOC);
    expect(shell()).toBeNull();
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
