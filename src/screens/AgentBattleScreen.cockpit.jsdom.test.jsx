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
    // The first paint is the off layout (unknown reads off), so the chat was
    // on screen and the existing tape is seen; what arrives WHILE Cockpit
    // shows is what the Chat tab counts — the chain stays keyed to Chat.
    await mount();
    expect(shownSection()).toBe('cockpit');
    expect(q('[data-pane-tab="chat"]').textContent).toBe('Chat');
    DOC = { ...LIVE_DOC, evaluations: [CHECK, { ...CHECK, evalId: 'eval_006', timestamp: '2026-09-01T16:59:02.000Z', promptBuiltAt: '2026-09-01T16:58:20.000Z' }] };
    await rerender();
    expect(q('[data-pane-tab="chat"]').textContent).toBe('Chat · 1');
    await click(q('[data-pane-tab="chat"]'));
    expect(shownSection()).toBe('chat');
    expect(q('[data-pane-tab="chat"]').textContent).toBe('Chat');
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
