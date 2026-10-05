// @vitest-environment jsdom
//
// src/screens/AgentBattleScreen.cockpit.jsdom.test.jsx
//
// Cockpit Build 2a — THE SCREEN, MOUNTED (spec
// docs/COCKPIT_BUILD2A_SPEC_V1_0.md §4–§8, §10.1, §11 "Client" and "Off path").
// The REAL status hook, readers, model and components run; only the edges are
// fakes: the HTTP routes (a stubbed fetch), Firestore (a recorder that serves
// the cockpit's four subcollections from fixtures) and the flag ACCESSOR.
//
//   off   COCKPIT_UI_ENABLED as shipped (false): no status request, no
//         listener, Chat · Bench · Tape on desktop, the shipped phone
//   on    the server says { on: true }: the desktop pane computes Cockpit ·
//         Chat · Bench · Tape and opens on Cockpit; "Chat · {n}"; the remembered
//         section repaired when the cockpit goes away; answering; the sheet and
//         its check-card link; Monitoring into the research modal; the phone's
//         Board · Cockpit; the mode gate on cockpit filings and the call slot
//
// Harness: AgentBattleScreen.pane.jsdom.test.jsx.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

vi.mock('../firebase/config', () => ({ db: {}, auth: {}, default: {} }));
const AUTH = vi.hoisted(() => ({ user: { getIdToken: async () => 'token-1' } }));
vi.mock('firebase/auth', () => ({ getAuth: vi.fn(() => ({ currentUser: AUTH.user })) }));
vi.mock('../services/agentService', () => ({ submitDailyGrades: vi.fn(), addFeedBookmark: vi.fn(), removeFeedBookmark: vi.fn() }));

// FIRESTORE: a recorder. The cockpit's readers are the only callers of these
// functions on this screen; anything else falls through to the real module.
const FS = vi.hoisted(() => ({ docs: {}, listeners: [], gets: [], next: {}, error: {} }));
vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    collection: vi.fn((db, ...path) => ({ __path: path.join('/') })),
    query: vi.fn((ref, ...constraints) => ({ __path: ref.__path, constraints })),
    orderBy: vi.fn((field, dir) => ({ field, dir })),
    limit: vi.fn((n) => ({ n })),
    onSnapshot: vi.fn((q, next, error) => {
      FS.listeners.push(q.__path);
      FS.next[q.__path] = next;
      FS.error[q.__path] = error;
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
import {
  PANE_HEADER_FIXED_PX, PANE_HEADER_FIXED_COCKPIT_PX, PANE_ARCHETYPE_MIN_PX, PANE_VIEWPORT_SHARE,
  ARCHETYPE_MIN_VIEWPORT_PX, ARCHETYPE_MIN_VIEWPORT_COCKPIT_PX,
} from './battleView/CharacterPane';
import { checkEntryId } from './battleView/buildTape';
import { buildCockpitExchange } from '../../api/agent/call-response.js';

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

const setShell = (isDesktop, desktopWidth = 1600) => {
  const width = isDesktop ? desktopWidth : 480;
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
  window.matchMedia = (query) => {
    const q = String(query);
    if (q.includes('prefers-reduced-motion')) return { matches: false, addEventListener() {}, removeEventListener() {} };
    const min = /min-width:\s*(\d+)px/.exec(q);
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
  FS.next = {};
  FS.error = {};
  seedRecords();
  delete window.visualViewport;
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
const rerender = async () => { await act(async () => { root.render(element()); }); await settle(); };
const q = (sel) => container.querySelector(sel);
const qa = (sel) => [...container.querySelectorAll(sel)];
const click = async (el) => {
  expect(el).toBeTruthy();
  await act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); });
  await settle();
};
const tabs = () => qa('[data-pane-tab]').map((t) => t.getAttribute('data-pane-tab'));
const shownSection = () => qa('[data-pane-section]').find((p) => !p.hidden)?.getAttribute('data-pane-section') ?? null;
const statusCalls = () => fetchSpy.mock.calls.filter(([u]) => String(u).startsWith('/api/agent/cockpit-status'));
const cockpitListeners = () => FS.listeners.filter((p) => /\/(calls|declarations|callEvents)$/.test(p));

// ---------------------------------------------------------------------------

describe('OFF PATH — COCKPIT_UI_ENABLED as shipped (false)', () => {
  it('desktop: Chat · Bench · Tape, opening on Chat; no status request; no listener; no cockpit markup', async () => {
    FLAG.cockpit = null; // the real accessor over the real flag
    await mount();
    expect(tabs()).toEqual(['chat', 'bench', 'tape']);
    expect(shownSection()).toBe('chat');
    expect(statusCalls()).toHaveLength(0);
    expect(cockpitListeners()).toEqual([]);
    expect(FS.gets).toEqual([]);
    expect(q('[data-cockpit-panel]')).toBeNull();
    expect(q('[data-cockpit-feed]')).toBeNull();
  });

  it('phone: the shipped layout — no switch, no track; no request, no listener', async () => {
    FLAG.cockpit = null;
    setShell(false);
    await mount();
    expect(q('[data-board-cockpit-switch]')).toBeNull();
    expect(q('[data-board-cockpit-track]')).toBeNull();
    expect(statusCalls()).toHaveLength(0);
    expect(cockpitListeners()).toEqual([]);
  });

  it('the flag on but the server says off → exactly the off screen (unknown and off read the same)', async () => {
    STATUS_ON = false;
    await mount();
    expect(statusCalls()).toHaveLength(1);
    expect(tabs()).toEqual(['chat', 'bench', 'tape']);
    expect(cockpitListeners()).toEqual([]);
    expect(q('[data-cockpit-feed]')).toBeNull();
  });

  it('a battle that is not active asks nothing', async () => {
    DOC = { ...LIVE_DOC, status: 'completed' };
    await mount();
    expect(statusCalls()).toHaveLength(0);
    expect(tabs()).toEqual(['chat', 'bench', 'tape']);
  });
});

describe('ON — desktop: the Cockpit tab', () => {
  it('asks the server for THIS battle, then computes Cockpit · Chat · Bench · Tape and opens on Cockpit', async () => {
    await mount();
    expect(statusCalls()).toHaveLength(1);
    expect(String(statusCalls()[0][0])).toBe('/api/agent/cockpit-status?battleId=ab-1');
    expect(tabs()).toEqual(['cockpit', 'chat', 'bench', 'tape']);
    expect(shownSection()).toBe('cockpit');
    expect(q('[data-pane-tab="cockpit"]').textContent).toBe('Cockpit');
    expect(cockpitListeners().sort()).toEqual(['agentBattles/ab-1/callEvents', 'agentBattles/ab-1/calls', 'agentBattles/ab-1/declarations']);
  });

  it('the feed: Needs you holds the open calls (C-5 drops the shadow record), Earlier the resolved one; Monitoring from the record', async () => {
    await mount();
    expect(qa('[data-cockpit-tile-group="needsYou"]').map((t) => t.getAttribute('data-cockpit-tile'))).toEqual([OPEN.callId, GONE.callId]);
    expect(qa('[data-cockpit-tile-group="earlier"]').map((t) => t.getAttribute('data-cockpit-tile'))).toEqual([RESOLVED.callId]);
    expect(q(`[data-cockpit-tile="${SHADOW.callId}"]`)).toBeNull();
    expect(q('[data-cockpit-monitoring]').textContent).toContain('From the 12:45 PM check');
    expect(qa('[data-cockpit-monitoring-symbol]').map((c) => c.textContent)).toEqual(['CRWD', 'NOW']);
  });

  it('the top row: the prices\' vintage and "{n} messages left" from the battle\'s own counter', async () => {
    await mount();
    expect(q('[data-cockpit-vintage]').textContent).toMatch(/^Prices as of the 12:45 PM check/);
    expect(q('[data-cockpit-messages-left]').textContent).toBe('7 messages left');
  });

  it('a league battle shows no budget number (its answers charge the group\'s daily budget, which this document does not carry)', async () => {
    DOC = { ...LIVE_DOC, gameMode: 'baggerbomb_tournament', groupId: 'g1' };
    await mount();
    expect(q('[data-cockpit-vintage]')).toBeTruthy();
    expect(q('[data-cockpit-messages-left]')).toBeNull();
  });

  it('"Chat · {n}" while another section shows and the chain counts unread; plain "Chat" once Chat shows', async () => {
    // The seen-marker WAITS while the status is asked (review L4-2): the first
    // paint is the off layout, so without the wait the check card that
    // predates the load would be marked seen and then hidden behind Cockpit.
    // A fresh mount counts everything as unseen (the A4 rule).
    await mount();
    expect(shownSection()).toBe('cockpit');
    expect(q('[data-pane-tab="chat"]').textContent).toBe('Chat · 1');
    DOC = { ...LIVE_DOC, evaluations: [CHECK, { ...CHECK, evalId: 'eval_006', timestamp: '2026-09-01T16:59:02.000Z', promptBuiltAt: '2026-09-01T16:58:20.000Z' }] };
    await rerender();
    expect(q('[data-pane-tab="chat"]').textContent).toBe('Chat · 2');
    await click(q('[data-pane-tab="chat"]'));
    expect(shownSection()).toBe('chat');
    expect(q('[data-pane-tab="chat"]').textContent).toBe('Chat');
  });

  it('the label caps at "Chat · 9+" — the widest label the width budget was measured at', async () => {
    const many = Array.from({ length: 14 }, (_, i) => ({ ...CHECK, evalId: `eval_1${String(i).padStart(2, '0')}`, timestamp: new Date(T('2026-09-01T15:00:00.000Z') + i * 60_000).toISOString() }));
    DOC = { ...LIVE_DOC, evaluations: [...many, CHECK] };
    await mount();
    expect(q('[data-pane-tab="chat"]').textContent).toBe('Chat · 9+');
  });

  it('REPAIR: the battle stops being cockpit-on while Cockpit shows → the list\'s first entry (Chat), and the cockpit is gone', async () => {
    await mount();
    expect(shownSection()).toBe('cockpit');
    FLAG.cockpit = false;
    await rerender();
    expect(tabs()).toEqual(['chat', 'bench', 'tape']);
    expect(shownSection()).toBe('chat');
    expect(q('[data-cockpit-feed]')).toBeNull();
  });

  it('answering: both buttons disable while sending; the POST carries the belief; a refusal\'s line comes from the BODY', async () => {
    DOC = { ...LIVE_DOC, directive: { text: 'Lean defensive', directiveThreadId: 't-cur', expiry: 'end_of_battle', createdAt: '2026-09-01T15:00:00.000Z' } };
    ANSWER = { status: 409, body: { error: 'refused', reason: 'budget' } };
    await mount();
    await click(q(`[data-cockpit-tile="${OPEN.callId}"] [data-cockpit-answer="hold"]`));
    const post = fetchSpy.mock.calls.find(([u]) => u === '/api/agent/call-response');
    expect(JSON.parse(post[1].body)).toEqual({ battleId: 'ab-1', callId: OPEN.callId, answer: 'hold', expectedDirectiveThreadId: 't-cur' });
    expect(post[1].headers.Authorization).toBe('Bearer token-1');
    expect(q(`[data-cockpit-tile="${OPEN.callId}"] [role="status"]`).textContent).toBe('No messages left — nothing was filed.');
    // No optimistic state: the tile is the record's, unchanged.
    expect(q(`[data-cockpit-tile="${OPEN.callId}"] [data-cockpit-tag]`).textContent).toBe('Live');
  });

  it('a 404 cockpit_unavailable re-runs the status check', async () => {
    ANSWER = { status: 404, body: { error: 'cockpit_unavailable' } };
    await mount();
    expect(statusCalls()).toHaveLength(1);
    await click(q(`[data-cockpit-tile="${OPEN.callId}"] [data-cockpit-answer="go"]`));
    expect(statusCalls()).toHaveLength(2);
    expect(q(`[data-cockpit-tile="${OPEN.callId}"] [role="status"]`).textContent).toBe('The cockpit is off for this battle — nothing was filed.');
  });

  it('the sheet opens inside the pane; "From the {t} check →" opens Chat at that check\'s card', async () => {
    const scrolled = [];
    Element.prototype.scrollIntoView = function scrollIntoView() { scrolled.push(this.getAttribute?.('data-tape-entry-id')); };
    await mount();
    await click(q(`[data-cockpit-tile="${OPEN.callId}"] [data-cockpit-tile-open]`));
    const layer = q('[data-cockpit-sheet-layer]');
    expect(layer.getAttribute('data-cockpit-sheet-layer')).toBe('desktop');
    expect(q('[data-cockpit-panel="desktop"]').contains(layer)).toBe(true);
    expect(q('[role="dialog"]').getAttribute('aria-modal')).toBe('true');
    await click(q('[data-cockpit-check-link]'));
    expect(shownSection()).toBe('chat');
    expect(q('[data-cockpit-sheet]')).toBeNull();
    expect(scrolled).toContain(checkEntryId(CHECK));
  });

  it('…and when that check is no longer in the chat it says so, and nothing moves', async () => {
    await mount();
    await click(q(`[data-cockpit-tile="${GONE.callId}"] [data-cockpit-tile-open]`));
    await click(q('[data-cockpit-check-link]'));
    expect(q('[data-cockpit-check-gone]').textContent).toBe('That check is no longer in the chat');
    expect(shownSection()).toBe('cockpit');
    expect(q('[data-cockpit-sheet]')).toBeTruthy();
  });

  it('a resolved call\'s sheet reads its observation ONCE (callObservations/{callId})', async () => {
    FS.docs[`agentBattles/ab-1/callObservations/${RESOLVED.callId}`] = { px: 252.4, observedAtMs: T('2026-09-01T16:30:10.000Z') };
    await mount();
    expect(FS.gets).toEqual([]);
    await click(q(`[data-cockpit-tile="${RESOLVED.callId}"] [data-cockpit-tile-open]`));
    expect(FS.gets).toEqual([`agentBattles/ab-1/callObservations/${RESOLVED.callId}`]);
    expect(q('[data-cockpit-receipts]').textContent).toContain('Hit at $252.40 · the 12:30 PM check');
  });

  it('a Monitoring chip opens the existing research modal for its symbol', async () => {
    await mount();
    await click(q('[data-cockpit-monitoring-symbol="CRWD"]'));
    expect(q('[data-research-modal]')?.getAttribute('data-research-modal')).toBe('CRWD');
  });
});

describe('§5 — the width budget: the archetype line keeps its room with FOUR tabs', () => {
  it('the four-tab cost is measured (423) and the threshold derived from it, above the shipped one', () => {
    expect(PANE_HEADER_FIXED_PX).toBe(327);
    expect(PANE_HEADER_FIXED_COCKPIT_PX).toBe(423);
    expect(ARCHETYPE_MIN_VIEWPORT_COCKPIT_PX).toBe(Math.ceil((PANE_HEADER_FIXED_COCKPIT_PX + PANE_ARCHETYPE_MIN_PX) / PANE_VIEWPORT_SHARE));
    expect(ARCHETYPE_MIN_VIEWPORT_COCKPIT_PX).toBe(1410);
    expect(ARCHETYPE_MIN_VIEWPORT_COCKPIT_PX).toBeGreaterThan(ARCHETYPE_MIN_VIEWPORT_PX);
  });

  it('one pixel under the four-tab threshold: cockpit-on hides the line; the same width with the cockpit off shows it (the shipped threshold)', async () => {
    setShell(true, ARCHETYPE_MIN_VIEWPORT_COCKPIT_PX - 1);
    await mount();
    expect(tabs()).toHaveLength(4);
    expect(q('[data-pane-archetype]')).toBeNull();
    FLAG.cockpit = false;
    await rerender();
    expect(tabs()).toHaveLength(3);
    expect(q('[data-pane-archetype]')).toBeTruthy();
  });

  it('at the four-tab threshold, cockpit-on shows the line', async () => {
    setShell(true, ARCHETYPE_MIN_VIEWPORT_COCKPIT_PX);
    await mount();
    expect(tabs()).toHaveLength(4);
    expect(q('[data-pane-archetype]')).toBeTruthy();
  });
});

describe('ON — the mode gate (Build 1a spec :39): cockpit filings and the call slot show only while cockpit-on', () => {
  const FILING = buildCockpitExchange({
    record: { text: "Hold off on AMD until today's close", expiry: 'until_ms', directiveThreadId: 't-call', kind: 'call_hold' },
    directiveThreadId: 't-call', createdAt: '2026-09-01T16:50:00.000Z', callId: OPEN.callId,
  });
  const CALL_SLOT = { family: 'call', text: "Hold off on AMD until today's close", expiry: 'until_ms', expiresAtMs: CLOSE, directiveThreadId: 't-call', createdAt: '2026-09-01T16:50:00.000Z', callId: OPEN.callId, kind: 'call_hold' };

  it('cockpit-on: the filing renders in the chat with "From the cockpit"', async () => {
    DOC = { ...LIVE_DOC, chatExchanges: [FILING], directive: CALL_SLOT };
    await mount();
    await click(q('[data-pane-tab="chat"]'));
    expect(qa('[data-from-cockpit]')).toHaveLength(1);
    expect(q('[data-pane-section="chat"]').textContent).toContain("Hold off on AMD until today's close");
  });

  it('not cockpit-on: the filing is not in the chat, and the call slot is not shown as This turn\'s directive', async () => {
    FLAG.cockpit = null;
    DOC = { ...LIVE_DOC, chatExchanges: [FILING], directive: CALL_SLOT };
    await mount();
    expect(q('[data-from-cockpit]')).toBeNull();
    expect(container.textContent).not.toContain("Hold off on AMD until today's close");
  });
});

describe('ON — a filed answer, the slot and THIS TURN read ONE predicate (founder ruling Oct 4; polish review P1-4, P1-5 — BUILD_RULES §9)', () => {
  // OPEN answered "Hold off" from the cockpit: its record and the battle's slot, one thread, as the endpoint writes them.
  const SLOT = { family: 'call', text: "Hold off on AMD until today's close", expiry: 'until_ms', expiresAtMs: CLOSE, directiveThreadId: 't-call', createdAt: '2026-09-01T16:50:00.000Z', callId: OPEN.callId, kind: 'call_hold' };
  const FILED = { ...OPEN, directiveThreadId: 't-call', playerResponse: { answer: 'hold', kind: 'directive', directiveThreadId: 't-call', callId: OPEN.callId, filedAt: '2026-09-01T16:50:00.000Z', heardEvalId: null } };
  const tagOf = (call) => q(`[data-cockpit-tile="${call.callId}"] [data-cockpit-tag]`)?.textContent ?? null;
  const strip = () => q('[data-this-turn]');
  const goneHold = () => q(`[data-cockpit-tile="${GONE.callId}"] [data-cockpit-answer="hold"]`);
  beforeEach(() => { FS.docs['agentBattles/ab-1/calls'] = [FILED, GONE, RESOLVED, SHADOW]; });

  it('the slot holds it, live: the tile reads "Filed · not yet heard", THIS TURN carries it, and the other call\'s override waits (one call at a time)', async () => {
    DOC = { ...LIVE_DOC, directive: SLOT };
    await mount();
    expect(tagOf(FILED)).toBe('Filed · not yet heard');
    expect(strip().getAttribute('data-this-turn')).toBe('filed');
    expect(strip().textContent).toContain("Hold off on AMD until today's close");
    expect(goneHold().getAttribute('aria-disabled')).toBe('true');
    expect(q(`[data-cockpit-tile="${GONE.callId}"] [data-cockpit-blocked]`).textContent).toBe("Waiting · your last answer hasn't been heard yet.");
  });

  it('KILLED by a control epoch: the tile reads "Filed · not heard" and THIS TURN is empty — never one surface saying it is over while the other queues it', async () => {
    DOC = { ...LIVE_DOC, directive: SLOT, controlEpochLog: [{ epochKey: 'k-1', suppressedDirectiveIds: ['t-call'], suppressedLeanIds: [] }] };
    await mount();
    expect(tagOf(FILED)).toBe('Filed · not heard');
    expect(strip().getAttribute('data-this-turn')).toBe('empty');
    expect(strip().textContent).not.toContain('Hold off on AMD');
    expect(goneHold().getAttribute('aria-disabled')).toBeNull();
  });

  it('PAST ITS LIFETIME, not yet retired by the sweep: "Filed · not heard" and THIS TURN is empty', async () => {
    DOC = { ...LIVE_DOC, directive: { ...SLOT, expiresAtMs: T('2026-09-01T16:59:00.000Z') } };
    await mount();
    expect(tagOf(FILED)).toBe('Filed · not heard');
    expect(strip().getAttribute('data-this-turn')).toBe('empty');
  });

  it('an ordinary (non-call) directive in the slot passes to THIS TURN unchanged, and the cockpit answer it replaced reads "Filed · not heard" until its event loads', async () => {
    DOC = { ...LIVE_DOC, directive: { text: 'Lean defensive', directiveThreadId: 't-chat', expiry: 'end_of_battle', createdAt: '2026-09-01T16:55:00.000Z' } };
    await mount();
    expect(strip().getAttribute('data-this-turn')).toBe('filed');
    expect(strip().textContent).toContain('Lean defensive');
    expect(tagOf(FILED)).toBe('Filed · not heard');
  });
});

describe('ON — phone: Board · Cockpit', () => {
  beforeEach(() => setShell(false));

  it('the switch and the track; Board the default; "Cockpit · {n}" counts Needs you; the overlay keeps Chat · Bench · Tape', async () => {
    await mount();
    const switchEl = q('[data-board-cockpit-switch]');
    expect(switchEl).toBeTruthy();
    expect(qa('[data-board-cockpit-tab]').map((t) => t.textContent)).toEqual(['Board', 'Cockpit · 2']);
    expect(q('[data-board-cockpit-tab="board"]').getAttribute('aria-selected')).toBe('true');
    const track = q('[data-board-cockpit-track]');
    expect(track.style.scrollSnapType).toBe('x mandatory');
    expect(q('[data-board-cockpit-panel="cockpit"] [data-cockpit-feed]')).toBeTruthy();
    expect(q('[data-board-cockpit-panel="board"] [data-phone-board]')).toBeTruthy();
    expect(q('[data-board-cockpit-panel="cockpit"]').hasAttribute('inert')).toBe(true);
    // Chat stays behind the mark: the overlay's sections are the shipped three.
    await click(q('[data-character-mark]'));
    expect(tabs()).toEqual(['chat', 'bench', 'tape']);
  });

  it('tapping Cockpit scrolls the track there (smooth) and moves the selection', async () => {
    await mount();
    const track = q('[data-board-cockpit-track]');
    Object.defineProperty(track, 'clientWidth', { configurable: true, value: 480 });
    track.scrollTo = vi.fn();
    await click(q('[data-board-cockpit-tab="cockpit"]'));
    expect(track.scrollTo).toHaveBeenCalledWith({ left: 480, behavior: 'smooth' });
    expect(q('[data-board-cockpit-tab="cockpit"]').getAttribute('aria-selected')).toBe('true');
    expect(q('[data-board-cockpit-panel="cockpit"]').hasAttribute('inert')).toBe(false);
  });

  it('the phone root takes the viewport-high layout; the mark keeps its clearance on both screens', async () => {
    await mount();
    for (const s of ['board', 'cockpit']) {
      const panel = q(`[data-board-cockpit-panel="${s}"]`);
      expect(parseInt(panel.firstElementChild?.style.paddingBottom || panel.style.paddingBottom || '0', 10)).toBeGreaterThanOrEqual(48 + 14);
    }
  });

  it('the sheet is a bottom sheet fixed to the viewport', async () => {
    await mount();
    const track = q('[data-board-cockpit-track]');
    track.scrollTo = vi.fn();
    await click(q('[data-board-cockpit-tab="cockpit"]'));
    await click(q(`[data-cockpit-tile="${OPEN.callId}"] [data-cockpit-tile-open]`));
    const layer = q('[data-cockpit-sheet-layer]');
    expect(layer.getAttribute('data-cockpit-sheet-layer')).toBe('mobile');
    expect(layer.style.position).toBe('fixed');
  });
});

// ---------------------------------------------------------------------------
// The review's fixes, mounted (docs/audits — the Build 2a review record).

const chipFiling = (iso, id) => ({
  userMessage: null, agentResponse: '', hasDirective: true, messageType: 'directive_filed', source: 'chip',
  directive: { text: 'Widen the spread', expiry: 'end_of_battle', directiveThreadId: id }, directiveThreadId: id,
  timestamp: iso, groundingVersion: 1, elicitationTarget: 'directive_filed', mode: 'battle',
});
const cockpitFiling = (iso, id) => buildCockpitExchange({
  record: { text: "Hold off on AMD until today's close", expiry: 'until_ms', directiveThreadId: id, kind: 'call_hold' },
  directiveThreadId: id, createdAt: iso, callId: OPEN.callId,
});
const deliver = async (path, docs) => {
  await act(async () => { FS.next[path]?.({ docs: docs.map((d) => ({ id: d.callId ?? d.id ?? 'x', data: () => d })) }); });
  await settle();
};

describe('REVIEW — the unread chain and the first paint (L3-1, L4-2, L4-7, L4-8)', () => {
  it('the count NEVER counts the player\'s own cockpit answers — the old ones the gate admits on load, or a new one', async () => {
    DOC = { ...LIVE_DOC, chatExchanges: [cockpitFiling('2026-09-01T16:40:00.000Z', 't-a'), cockpitFiling('2026-09-01T16:50:00.000Z', 't-b')] };
    await mount();
    expect(q('[data-pane-tab="chat"]').textContent).toBe('Chat · 1'); // the check card only
    DOC = { ...DOC, chatExchanges: [...DOC.chatExchanges, cockpitFiling('2026-09-01T16:58:00.000Z', 't-c')] };
    await rerender();
    expect(q('[data-pane-tab="chat"]').textContent).toBe('Chat · 1');
  });

  it('OFF PATH: with the flag as shipped, the Chat tab never carries a count (a new reply while Bench shows reads "Chat")', async () => {
    FLAG.cockpit = null;
    await mount();
    await click(q('[data-pane-tab="bench"]'));
    DOC = { ...LIVE_DOC, evaluations: [CHECK, { ...CHECK, evalId: 'eval_006', timestamp: '2026-09-01T16:59:02.000Z' }] };
    await rerender();
    expect(q('[data-pane-tab="chat"]').textContent).toBe('Chat');
  });

  it('PHONE, cockpit on: the overlay keeps the shipped tabs AND the shipped label — no count there (§6)', async () => {
    setShell(false);
    await mount();
    await click(q('[data-character-mark]'));
    await click(q('[data-pane-tab="bench"]'));
    DOC = { ...LIVE_DOC, evaluations: [CHECK, { ...CHECK, evalId: 'eval_006', timestamp: '2026-09-01T16:59:02.000Z' }] };
    await rerender();
    expect(tabs()).toEqual(['chat', 'bench', 'tape']);
    expect(q('[data-pane-tab="chat"]').textContent).toBe('Chat');
  });
});

describe('a refusal line clears for good when the record behind its tile changes (founder ruling Oct 5)', () => {
  // The next check restates OPEN: the same key, a level within 1 % — the thread's newest call.
  const RESTATED = callRec({ callId: 'ab-1:eval_006:call:0', evalId: 'eval_006', evalSeq: 6, mintedAt: T('2026-09-01T16:58:00.000Z'), condition: { side: 'above', level: 161.5 } });
  // The tile's live region is always there; it carries a line only while data-cockpit-refusal is "1".
  const refusalOn = (call) => q(`[data-cockpit-tile="${call.callId}"] [data-cockpit-refusal="1"]`)?.textContent ?? null;

  it('a call folded under a restatement takes its refusal with it — and does NOT get it back when it resurfaces as its own tile', async () => {
    ANSWER = { status: 409, body: { error: 'refused', reason: 'budget' } };
    await mount();
    await click(q(`[data-cockpit-tile="${OPEN.callId}"] [data-cockpit-answer="hold"]`));
    expect(refusalOn(OPEN)).toBe('No messages left — nothing was filed.');
    await deliver('agentBattles/ab-1/calls', [RESTATED, OPEN, GONE, RESOLVED, SHADOW]);
    expect(q(`[data-cockpit-tile="${OPEN.callId}"]`)).toBeNull(); // folded: the tile is the restatement's
    expect(refusalOn(RESTATED)).toBeNull();
    // The restatement resolves; OPEN is its own tile again — without the old line.
    await deliver('agentBattles/ab-1/calls', [{ ...RESTATED, state: 'hit', stateChangedAt: T('2026-09-01T16:59:30.000Z') }, OPEN, GONE, RESOLVED, SHADOW]);
    expect(q(`[data-cockpit-tile="${OPEN.callId}"]`)).toBeTruthy();
    expect(refusalOn(OPEN)).toBeNull();
  });

  it('a refusal clears when its call is answered (the model hides an answered call\'s line; the prune then forgets the outcome)', async () => {
    ANSWER = { status: 409, body: { error: 'refused', reason: 'budget' } };
    await mount();
    await click(q(`[data-cockpit-tile="${OPEN.callId}"] [data-cockpit-answer="hold"]`));
    expect(refusalOn(OPEN)).toBe('No messages left — nothing was filed.');
    await deliver('agentBattles/ab-1/calls', [{ ...OPEN, playerResponse: { answer: 'go', kind: 'ack', callId: OPEN.callId, filedAt: '2026-09-01T16:59:00.000Z' } }, GONE, RESOLVED, SHADOW]);
    expect(q(`[data-cockpit-tile="${OPEN.callId}"]`)).toBeTruthy();
    expect(refusalOn(OPEN)).toBeNull();
  });

  // The coarse clock refreshes on a visibility change (battleView/useCoarseNow.js).
  const tick = async (iso) => {
    vi.setSystemTime(new Date(iso));
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    await settle();
  };
  const sheetRefusal = () => q('[data-cockpit-sheet-refusal="1"]')?.textContent ?? null;

  it('a "one call at a time" line that aged out is gone for good: a block that shows later does not bring it back — the block line says it instead (review Q4-1)', async () => {
    const SLOT_GONE = { family: 'call', text: "Hold off on the MU exit until today's close", expiry: 'until_ms', expiresAtMs: CLOSE, directiveThreadId: 't-gone', createdAt: '2026-09-01T16:50:00.000Z', callId: GONE.callId, kind: 'call_hold' };
    await mount();
    ANSWER = { status: 409, body: { error: 'refused', reason: 'directive_pending', pendingDirectiveThreadId: 't-gone', pendingCallId: GONE.callId } };
    await click(q(`[data-cockpit-tile="${OPEN.callId}"] [data-cockpit-answer="hold"]`));
    const line = refusalOn(OPEN);
    expect(line).toMatch(/One call at a time\.$/);
    await tick('2026-09-01T17:00:20.000Z'); // inside the 30 s grace: it stands
    expect(refusalOn(OPEN)).toBe(line);
    await tick('2026-09-01T17:00:45.000Z'); // past it, with nothing blocking: it goes
    expect(refusalOn(OPEN)).toBeNull();
    DOC = { ...LIVE_DOC, directive: SLOT_GONE }; // later, another call's directive is live in the slot
    await rerender();
    expect(q(`[data-cockpit-tile="${OPEN.callId}"] [data-cockpit-blocked]`)).toBeTruthy();
    expect(refusalOn(OPEN)).toBeNull();
  });

  it('a standing line survives the cockpit going off and on while its record is unchanged: nothing is pruned until the calls are read again (review Q2-2)', async () => {
    ANSWER = { status: 409, body: { error: 'refused', reason: 'budget' } };
    await mount();
    await click(q(`[data-cockpit-tile="${OPEN.callId}"] [data-cockpit-answer="hold"]`));
    expect(refusalOn(OPEN)).toBe('No messages left — nothing was filed.');
    FLAG.cockpit = false;
    await rerender();
    expect(q('[data-cockpit-feed]')).toBeNull();
    FLAG.cockpit = true;
    await rerender();
    expect(refusalOn(OPEN)).toBe('No messages left — nothing was filed.');
  });

  it('a failed events read does not stop the prune: a refusal made in the open sheet does not come back after a fold and a resurface (review Q2-1)', async () => {
    await mount();
    await click(q(`[data-cockpit-tile="${OPEN.callId}"] [data-cockpit-tile-open]`));
    await act(async () => { FS.error['agentBattles/ab-1/callEvents']?.(new Error('permission-denied')); });
    await settle();
    expect(q('[data-cockpit-feed]').getAttribute('data-cockpit-status')).toBe('error');
    ANSWER = { status: 409, body: { error: 'refused', reason: 'budget' } };
    await click(q('[data-cockpit-sheet] [data-cockpit-answer="hold"]'));
    expect(sheetRefusal()).toBe('No messages left — nothing was filed.');
    await deliver('agentBattles/ab-1/calls', [RESTATED, OPEN, GONE, RESOLVED, SHADOW]);
    await deliver('agentBattles/ab-1/calls', [{ ...RESTATED, state: 'hit', stateChangedAt: T('2026-09-01T16:59:30.000Z') }, OPEN, GONE, RESOLVED, SHADOW]);
    expect(q('[data-cockpit-sheet]')).toBeTruthy();
    expect(sheetRefusal()).toBeNull();
  });
});

describe('REVIEW — nothing claimed before the records arrive (L3-2)', () => {
  it('records not yet delivered → no empty line; a failed read → its own line, never "No calls yet"', async () => {
    FS.docs = {};
    await mount();
    expect(q('[data-cockpit-feed]').getAttribute('data-cockpit-status')).toBe('loading');
    expect(q('[data-cockpit-empty]')).toBeNull();
    await act(async () => { FS.error['agentBattles/ab-1/calls']?.(new Error('permission-denied')); });
    await settle();
    expect(q('[data-cockpit-read-error]')).toBeTruthy();
    expect(q('[data-cockpit-empty]')).toBeNull();
  });
});

describe('REVIEW — the desktop sheet (L4-1, L4-4, L5-7)', () => {
  it('the feed scroller holds still DECLARATIVELY while the sheet is open, and scrolls again after (no shorthand written)', async () => {
    await mount();
    const scroller = q('[data-cockpit-scroll]');
    expect(scroller.style.overflowY).toBe('auto');
    await click(q(`[data-cockpit-tile="${OPEN.callId}"] [data-cockpit-tile-open]`));
    expect(scroller.style.overflowY).toBe('hidden');
    expect(scroller.hasAttribute('inert')).toBe(true);
    await click(q('[data-cockpit-sheet-close]'));
    expect(scroller.style.overflowY).toBe('auto');
    expect(scroller.hasAttribute('inert')).toBe(false);
    expect(scroller.style.overflow).toBe('');
  });

  it('the pane\'s tabs and collapse wait (inert) while the sheet is open; a section change away from Cockpit closes it', async () => {
    await mount();
    await click(q(`[data-cockpit-tile="${OPEN.callId}"] [data-cockpit-tile-open]`));
    expect(q('[data-pane-controls]').hasAttribute('inert')).toBe(true);
    await click(q('[data-pane-tab="chat"]')); // a door can still move the pane
    expect(q('[data-cockpit-sheet]')).toBeNull();
    expect(q('[data-pane-controls]').hasAttribute('inert')).toBe(false);
    await click(q('[data-pane-tab="cockpit"]'));
    expect(q('[data-cockpit-sheet]')).toBeNull(); // never re-shown by itself
  });

  it('a sheet whose call LEAVES the feed closes — and never re-opens by itself when the call comes back', async () => {
    await mount();
    await click(q(`[data-cockpit-tile="${GONE.callId}"] [data-cockpit-tile-open]`));
    expect(q('[data-cockpit-sheet]')).toBeTruthy();
    await deliver('agentBattles/ab-1/calls', [OPEN, RESOLVED]);
    expect(q('[data-cockpit-sheet]')).toBeNull();
    await deliver('agentBattles/ab-1/calls', [OPEN, GONE, RESOLVED]);
    expect(q(`[data-cockpit-tile="${GONE.callId}"]`)).toBeTruthy();
    expect(q('[data-cockpit-sheet]')).toBeNull();
  });
});

describe('REVIEW — the phone sheet and layout (L5-1, L5-4, L5-8, L5-11)', () => {
  beforeEach(() => setShell(false));

  it('while the sheet is open the mark steps aside and everything behind it is inert; both come back on close', async () => {
    await mount();
    q('[data-board-cockpit-track]').scrollTo = vi.fn();
    await click(q('[data-board-cockpit-tab="cockpit"]'));
    expect(q('[data-character-mark]')).toBeTruthy();
    await click(q(`[data-cockpit-tile="${OPEN.callId}"] [data-cockpit-tile-open]`));
    expect(q('[data-character-mark]')).toBeNull();
    expect(q('[data-layout]').hasAttribute('inert')).toBe(true);
    expect(q('[data-board-cockpit-panel="cockpit"]').style.overflowY).toBe('hidden');
    await click(q('[data-cockpit-sheet-close]'));
    expect(q('[data-character-mark]')).toBeTruthy();
    expect(q('[data-layout]').hasAttribute('inert')).toBe(false);
    expect(q('[data-board-cockpit-panel="cockpit"]').style.overflowY).toBe('auto');
  });

  it('the phone root takes the viewport-high layout with a floor, and pinch-zoom does not shrink it', async () => {
    await mount();
    const root = [...container.querySelectorAll('div')].find((d) => d.style.minHeight === '480px');
    expect(root).toBeTruthy();
    expect(root.style.height).toBe(`${window.innerHeight}px`);
    // Zoomed 2×: the visual viewport halves, the layout must not.
    window.visualViewport = { height: Math.round(window.innerHeight / 2), scale: 2, addEventListener() {}, removeEventListener() {} };
    await act(async () => { window.dispatchEvent(new Event('resize')); }); // the zoom's own resize
    await settle();
    const zoomed = [...container.querySelectorAll('div')].find((d) => d.style.minHeight === '480px');
    expect(zoomed.style.height).toBe(`${Math.round(window.innerHeight / 2) * 2}px`);
  });

  it('cockpit OFF on the phone: the shipped page layout (min-height 100vh, no fixed height, no floor)', async () => {
    FLAG.cockpit = null;
    await mount();
    expect([...container.querySelectorAll('div')].some((d) => d.style.minHeight === '480px')).toBe(false);
    expect([...container.querySelectorAll('div')].some((d) => d.style.minHeight === '100vh')).toBe(true);
  });

  it('when the cockpit goes away the phone returns to Board, so a later return never lands on a stale screen', async () => {
    await mount();
    q('[data-board-cockpit-track]').scrollTo = vi.fn();
    await click(q('[data-board-cockpit-tab="cockpit"]'));
    expect(q('[data-board-cockpit-tab="cockpit"]').getAttribute('aria-selected')).toBe('true');
    FLAG.cockpit = false;
    await rerender();
    FLAG.cockpit = true;
    await rerender();
    expect(q('[data-board-cockpit-tab="board"]').getAttribute('aria-selected')).toBe('true');
  });
});

describe('REVIEW — the off path does no cockpit work (L3-4)', () => {
  it('with the flag as shipped no (min-width: 1410px) query is ever subscribed', async () => {
    FLAG.cockpit = null;
    const queries = [];
    const base = window.matchMedia;
    window.matchMedia = (query) => { queries.push(String(query)); return base(query); };
    await mount();
    expect(queries.some((q2) => q2.includes('1410'))).toBe(false);
    window.matchMedia = base;
  });
});

describe('REVIEW — receipts read the UNGATED exchanges (L3-9)', () => {
  it('a chat directive a cockpit filing replaced reads "Replaced" even while the gate hides the filing', async () => {
    FLAG.cockpit = null; // the gate closed: the filing is not shown
    const slot = { family: 'call', text: "Hold off on AMD until today's close", expiry: 'until_ms', expiresAtMs: CLOSE, directiveThreadId: 't-call', createdAt: '2026-09-01T16:50:00.000Z', callId: OPEN.callId, kind: 'call_hold' };
    DOC = { ...LIVE_DOC, chatExchanges: [chipFiling('2026-09-01T14:10:00.000Z', 't-chip'), cockpitFiling('2026-09-01T16:50:00.000Z', 't-call')], directive: slot };
    await mount();
    expect(q('[data-from-cockpit]')).toBeNull();
    expect(q('[data-pane-section="chat"]').textContent).toContain('Replaced 12:50 PM');
  });
});
