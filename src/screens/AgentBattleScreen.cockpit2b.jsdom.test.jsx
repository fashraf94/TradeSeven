// @vitest-environment jsdom
//
// src/screens/AgentBattleScreen.cockpit2b.jsdom.test.jsx
//
// Cockpit Build 2b — THE V5 SCREEN, MOUNTED IN THE BATTLE SCREEN (spec
// docs/COCKPIT_BUILD2B_SPEC_V1_0.md §5, §11 "Client" and "Off paths"). The REAL
// status hook, readers, models, components and answer flow run; the edges are
// fakes: the HTTP routes (a stubbed fetch — status, answer, bench), Firestore
// (a recorder serving the cockpit's subcollections) and the flag ACCESSORS.
//
//   off  COCKPIT_2B_ENABLED off: the 2a feed, and no 2b prop anywhere — no meter,
//        no row mark, no Research pill, no composer line, no bench read
//   on   desktop and phone: the V5 screen in the feed's place, the meter from
//        the raw exchanges, the Now card and its step, board dots, the bench
//        sheet scoped and browsing (one read each), a Pick filing replace with
//        the name, the research door over the sheet, the composer line
//
// Harness: AgentBattleScreen.cockpit.jsdom.test.jsx (copied; the 2b flag added).

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
const FLAG = vi.hoisted(() => ({ cockpit: null, v2: false }));
vi.mock('../config/featureFlags', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    isAgentPresenceOn: () => false,
    isMatchupsBackdropOn: () => false,
    isBattleViewControllerOn: () => true,
    isCharacterPaneOn: () => true,
    isCockpitUiOn: () => (FLAG.cockpit === null ? actual.isCockpitUiOn() : FLAG.cockpit),
    isCockpit2bOn: () => FLAG.v2,
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
    // MU is held (support): GONE below is an EXIT on it, and since Amendment E (E-2) an exit on a stock the book does not hold offers no answer.
    star: [{ symbol: 'AAPL' }], core: [{ symbol: 'NVDA' }], support: [{ symbol: 'MU' }],
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
  FLAG.v2 = false;
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
    if (u.startsWith('/api/agent/cockpit-bench')) return json(200, BENCH_BODY);
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
const qa = (sel) => [...container.querySelectorAll(sel)];
const click = async (el) => {
  expect(el).toBeTruthy();
  await act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); });
  await settle();
};

// ---------------------------------------------------------------------------
// Cockpit Build 2b fixtures: an exit on a HELD symbol with no counterpart (the
// Who comes in case — the Now card), the bench read, a live cockpit command.

const NVDA_EXIT = callRec({
  callId: 'ab-1:eval_005:call:1', kind: 'confirmation', symbol: 'NVDA', direction: 'exit', slot: 'core', counterpart: null,
  condition: { side: 'below', level: 880 }, replacementOptions: [{ symbol: 'NOW', source: 'bench', rank: 4 }], invalidatedReason: null,
});
const BENCH_BODY = {
  asOf: '2026-09-01T16:45:20.000Z', out: { symbol: 'NVDA', slot: 'core' },
  rows: [
    { symbol: 'NOW', name: 'ServiceNow', sector: 'Technology', rank: 4, price: 800, changePct: 1.1, atrPct: 2.0, status: 'available', lockedUntil: null },
    { symbol: 'CRWD', name: null, sector: 'Technology', rank: 9, price: 300, changePct: -0.4, atrPct: 3.1, status: 'available', lockedUntil: null },
  ],
};
const LIVE_COMMAND = {
  family: 'call', text: 'Hold NVDA through today\'s close, even if it goes below $880.00.', expiry: 'until_ms', expiresAtMs: CLOSE,
  directiveThreadId: 't-cmd', callId: NVDA_EXIT.callId, kind: 'call_hold', action: { direction: 'exit', symbol: 'NVDA', slot: 'core' },
};
const benchCalls = () => fetchSpy.mock.calls.filter(([u]) => String(u).startsWith('/api/agent/cockpit-bench'));
const answerBodies = () => fetchSpy.mock.calls.filter(([u]) => String(u) === '/api/agent/call-response').map(([, init]) => JSON.parse(init.body));

describe('Cockpit Build 2b — the flag OFF: the 2a screen, no 2b prop anywhere', () => {
  beforeEach(() => { FLAG.v2 = false; });
  it('desktop: the 2a feed, its "messages left", no meter; no row mark; no Research pill; no bench request', async () => {
    FS.docs['agentBattles/ab-1/calls'] = [OPEN, NVDA_EXIT];
    await mount();
    expect(q('[data-cockpit-feed]').getAttribute('data-cockpit-feed')).toBe('1');
    expect(q('[data-cockpit-messages-left]')).toBeTruthy();
    expect(q('[data-cockpit-meter]')).toBeNull();
    expect(q('[data-row-call-mark]')).toBeNull();
    expect(q('[data-this-turn-research]')).toBeNull();
    expect(benchCalls()).toHaveLength(0);
  });
  it('a live cockpit command: still no composer line and no mark', async () => {
    const nvda = { ...NVDA_EXIT, playerResponse: { answer: 'hold', kind: 'directive', directiveThreadId: 't-cmd', callId: NVDA_EXIT.callId, filedAt: '2026-09-01T16:50:00.000Z', heardEvalId: null }, directiveThreadId: 't-cmd' };
    FS.docs['agentBattles/ab-1/calls'] = [OPEN, nvda];
    DOC = { ...LIVE_DOC, directive: LIVE_COMMAND };
    await mount();
    expect(q('[data-chat-cockpit-command]')).toBeNull();
    expect(q('[data-row-call-mark]')).toBeNull();
  });
});

describe('Cockpit Build 2b — the flag ON, desktop', () => {
  beforeEach(() => { FLAG.v2 = true; FS.docs['agentBattles/ab-1/calls'] = [OPEN, NVDA_EXIT]; });

  it('the V5 screen in the feed\'s place: the meter from the raw exchanges, the Now card on the exit, Who comes in', async () => {
    DOC = { ...LIVE_DOC, chatExchanges: [{ source: 'cockpit', hasDirective: true, directiveThreadId: 'old' }] };
    await mount();
    expect(q('[data-cockpit-feed]').getAttribute('data-cockpit-feed')).toBe('2b');
    expect(q('[data-cockpit-meter]').getAttribute('aria-label')).toBe('6 of 7 commands left');
    expect(q('[data-cockpit-messages-left]')).toBeNull();
    expect(q('[data-cockpit-now]').getAttribute('data-cockpit-now')).toBe(NVDA_EXIT.callId);
    expect(q('[data-cockpit-now] [data-cockpit-plan]').textContent).toContain('Aurora plans to exit NVDA if it goes below $880.00');
    expect(q('[data-cockpit-step="on_card"]')).toBeTruthy();
    expect(q('[data-cockpit-option="NOW"]')).toBeTruthy();
  });

  it('Amendment E (E-2): the exit on NVDA once NVDA is in no tier of the battle document — no Now card, no step, no answer; the chip and the opened card say so', async () => {
    DOC = { ...LIVE_DOC, portfolio: { ...LIVE_DOC.portfolio, core: [] } };
    await mount();
    expect(q('[data-cockpit-feed]').getAttribute('data-cockpit-feed')).toBe('2b');
    // The other open call still leads (it is an entry; its buttons are its own) — the NVDA exit does not.
    expect(q('[data-cockpit-now]').getAttribute('data-cockpit-now')).not.toBe(NVDA_EXIT.callId);
    expect(q('[data-cockpit-step]')).toBeNull();
    expect(qa('[data-cockpit-option]')).toHaveLength(0);
    expect(qa('[data-cockpit-chip]').map((c) => c.textContent)).toContain('NVDA↓880 · not in your book');
    await click(qa('[data-cockpit-chip-toggle]').find((t) => t.closest('[data-cockpit-chip]')?.textContent.includes('NVDA')) ?? qa('[data-cockpit-chip-toggle]')[0]);
    const tag = q('[data-cockpit-tag="call:not_held"]');
    expect(tag.textContent).toBe('Not in your book');
    expect(tag.closest('[data-cockpit-tile]')?.querySelectorAll('[data-cockpit-answer]').length ?? 0).toBe(0);
    expect(answerBodies()).toEqual([]);
  });

  it('board dots: "an open call" beside NVDA on the player\'s row', async () => {
    await mount();
    const marks = qa('[data-row-call-mark]');
    expect(marks.map((m) => [m.getAttribute('data-row-call-mark'), m.getAttribute('aria-label')])).toEqual([['open', 'an open call']]);
  });

  it('"Browse the bench →": one scoped read; a Pick files replace with the name; the filed bar', async () => {
    ANSWER = { status: 200, body: { callId: NVDA_EXIT.callId, directive: { text: 'If you exit NVDA by today\'s close, bring in NOW.' } } };
    await mount();
    await click(q('[data-cockpit-browse]'));
    expect(benchCalls()).toHaveLength(1);
    expect(String(benchCalls()[0][0])).toBe(`/api/agent/cockpit-bench?battleId=ab-1&callId=${encodeURIComponent(NVDA_EXIT.callId)}`);
    expect(q('[data-cockpit-bench-sheet] h2').textContent).toBe('Who comes in for NVDA?');
    await click(q('[data-cockpit-bench-pick="NOW"]'));
    expect(answerBodies().at(-1)).toMatchObject({ battleId: 'ab-1', callId: NVDA_EXIT.callId, answer: 'replace', pickSymbol: 'NOW' });
    expect(q('[data-cockpit-bench-filed]').textContent).toContain('✓ Filed · If you exit NVDA by today\'s close, bring in NOW.');
    await click(q('[data-cockpit-bench-done]'));
    expect(q('[data-cockpit-bench-sheet]')).toBeNull();
  });

  it('the Research pill opens the bench in browse mode (a read with no call), the research door over it', async () => {
    await mount();
    await click(q('[data-this-turn-research]'));
    expect(String(benchCalls()[0][0])).toBe('/api/agent/cockpit-bench?battleId=ab-1');
    expect(q('[data-cockpit-bench-sheet] h2').textContent).toBe('The bench');
    expect(q('[data-cockpit-bench-pick]')).toBeNull();
    await click(q('[data-cockpit-bench-research="NOW"]'));
    expect(q('[data-research-modal="NOW"]')).toBeTruthy();
    expect(q('[data-cockpit-bench-sheet]')).toBeTruthy(); // the sheet stays beneath
  });

  it('a live cockpit command: the composer line in the chat, the teal mark on its book symbol', async () => {
    const nvda = { ...NVDA_EXIT, playerResponse: { answer: 'hold', kind: 'directive', directiveThreadId: 't-cmd', callId: NVDA_EXIT.callId, filedAt: '2026-09-01T16:50:00.000Z', heardEvalId: null }, directiveThreadId: 't-cmd' };
    FS.docs['agentBattles/ab-1/calls'] = [OPEN, nvda];
    DOC = { ...LIVE_DOC, directive: LIVE_COMMAND };
    await mount();
    expect(q('[data-chat-cockpit-command]').textContent).toBe('Sending a directive replaces your cockpit command on NVDA.');
    expect(qa('[data-row-call-mark]').map((m) => m.getAttribute('data-row-call-mark'))).toEqual(['command']);
  });
});

describe('Cockpit Build 2b — the flag ON, phone', () => {
  beforeEach(() => { FLAG.v2 = true; FS.docs['agentBattles/ab-1/calls'] = [OPEN, NVDA_EXIT]; setShell(false); });
  it('the Cockpit screen is the V5 screen; the board rows carry the dots there too; the pill on THIS TURN', async () => {
    await mount();
    expect(q('[data-board-cockpit-panel="cockpit"] [data-cockpit-feed="2b"]')).toBeTruthy();
    expect(q('[data-board-cockpit-panel="board"] [data-row-call-mark="open"]')).toBeTruthy();
    expect(q('[data-phone-pinned] [data-this-turn-research]')).toBeTruthy();
    expect(q('[data-cockpit-top-row] [data-cockpit-vintage]').textContent).toBe('');
  });
});

// ---------------------------------------------------------------------------
// The review's fix round, at the screen (CB4-1, CB4-2/3, CB4-12, CB4-13).
describe('Cockpit Build 2b — review fixes, at the screen', () => {
  beforeEach(() => { FLAG.v2 = true; });
  const ORCL = callRec({ callId: 'ab-1:eval_005:call:2', symbol: 'ORCL', counterpart: 'NOW', condition: { side: 'above', level: 140 }, mintedAt: T('2026-09-01T16:49:00.000Z') });
  const commanded = () => ({ ...NVDA_EXIT, playerResponse: { answer: 'hold', kind: 'directive', directiveThreadId: 't-cmd', callId: NVDA_EXIT.callId, filedAt: '2026-09-01T16:50:00.000Z', heardEvalId: null }, directiveThreadId: 't-cmd' });
  const openSheetOf = async (callId) => {
    const chip = q(`[data-cockpit-chip="${callId}"]`);
    if (chip && chip.getAttribute('aria-expanded') === 'false') await click(chip);
    await click(q(`[data-cockpit-tile="${callId}"] [data-cockpit-tile-open]`));
  };

  it('CB4-2/CB4-3: the details sheet answers in §6.2\'s words — no "Go instead", no "· 1 message"', async () => {
    FS.docs['agentBattles/ab-1/calls'] = [OPEN];
    await mount();
    await openSheetOf(OPEN.callId);
    const sheet = q('[data-cockpit-sheet]');
    expect([...sheet.querySelectorAll('[data-cockpit-answer]')].map((b) => b.textContent)).toEqual(['Go if it triggers', 'Hold off']);
    expect(sheet.textContent).not.toMatch(/Go instead|1 message/);
  });

  it('CB4-1: a prompt raised in one call\'s sheet never appears on another call\'s sheet, and closing drops it', async () => {
    FS.docs['agentBattles/ab-1/calls'] = [OPEN, ORCL, commanded()];
    DOC = { ...LIVE_DOC, directive: LIVE_COMMAND };
    await mount();
    await openSheetOf(OPEN.callId);
    await click(q('[data-cockpit-sheet] [data-cockpit-answer="hold"]'));
    expect(q('[data-cockpit-sheet] [data-cockpit-replace-confirm]')).toBeTruthy();
    await click(q('[data-cockpit-sheet-close]'));
    await openSheetOf(ORCL.callId);
    expect(q('[data-cockpit-sheet] [data-cockpit-replace-confirm]')).toBeNull();
    expect(q('[data-cockpit-sheet] [data-cockpit-answer="hold"]')).toBeTruthy();
    await click(q('[data-cockpit-sheet-close]'));
    await openSheetOf(OPEN.callId);
    expect(q('[data-cockpit-sheet] [data-cockpit-replace-confirm]')).toBeNull();
    expect(answerBodies().filter((b) => b.confirmReplace)).toEqual([]);
  });

  it('CB4-13: the bench opens on Rank every time', async () => {
    FS.docs['agentBattles/ab-1/calls'] = [OPEN, NVDA_EXIT];
    await mount();
    await click(q('[data-this-turn-research]'));
    await click(q('[data-cockpit-bench-sort="sector"]'));
    expect(q('[data-cockpit-bench-sort="sector"]').getAttribute('aria-pressed')).toBe('true');
    await click(q('[data-cockpit-bench-close]'));
    await click(q('[data-this-turn-research]'));
    expect(q('[data-cockpit-bench-sort="rank"]').getAttribute('aria-pressed')).toBe('true');
  });

  // Review L7: an exit on AAPL with no counterpart leads; a live cockpit command stands on NVDA — a Pick on the
  // AAPL bench sheet raises the replace prompt there.
  const AAPL_EXIT = callRec({
    callId: 'ab-1:eval_005:call:3', kind: 'confirmation', symbol: 'AAPL', direction: 'exit', slot: 'star', counterpart: null,
    condition: { side: 'below', level: 140 }, replacementOptions: [{ symbol: 'NOW', source: 'bench', rank: 4 }], invalidatedReason: null,
  });
  const raiseBenchPrompt = async () => {
    FS.docs['agentBattles/ab-1/calls'] = [AAPL_EXIT, commanded()];
    DOC = { ...LIVE_DOC, directive: LIVE_COMMAND };
    await mount();
    expect(q('[data-cockpit-now]').getAttribute('data-cockpit-now')).toBe(AAPL_EXIT.callId);
    await click(q('[data-cockpit-browse]'));
    await click(q('[data-cockpit-bench-pick="NOW"]'));
    expect(q('[data-cockpit-bench-sheet] [data-cockpit-replace-confirm]')).toBeTruthy();
  };

  it('review L7 C18 — the bench re-pointed to browse (the Research pill) never wears the scoped call\'s prompt', async () => {
    await raiseBenchPrompt();
    await click(q('[data-this-turn-research]'));
    expect(q('[data-cockpit-bench-sheet] h2').textContent).toBe('The bench');
    expect(q('[data-cockpit-replace-confirm]')).toBeNull();
    expect(answerBodies().filter((b) => b.confirmReplace)).toEqual([]);
  });

  it('review L7 C19b — a bench prompt orphaned with its sheet (the pane leaves Cockpit) is dropped, not revived on the next opening', async () => {
    await raiseBenchPrompt();
    await click(q('[data-pane-tab="chat"]'));
    expect(q('[data-cockpit-bench-sheet]')).toBeNull();
    await click(q('[data-pane-tab="cockpit"]'));
    await click(q('[data-cockpit-browse]'));
    expect(q('[data-cockpit-bench-sheet]')).toBeTruthy();
    expect(q('[data-cockpit-replace-confirm]')).toBeNull();
    expect(answerBodies().filter((b) => b.confirmReplace)).toEqual([]);
  });

  it('review L7 C32b — the bench opens on Rank from the card\'s door too', async () => {
    FS.docs['agentBattles/ab-1/calls'] = [OPEN, NVDA_EXIT];
    await mount();
    await click(q('[data-cockpit-browse]'));
    await click(q('[data-cockpit-bench-sort="sector"]'));
    expect(q('[data-cockpit-bench-sort="sector"]').getAttribute('aria-pressed')).toBe('true');
    await click(q('[data-cockpit-bench-close]'));
    await click(q('[data-cockpit-browse]'));
    expect(q('[data-cockpit-bench-sort="rank"]').getAttribute('aria-pressed')).toBe('true');
  });

  it('CB4-12: the scoped bench sheet closes when its call resolves (nothing filed from it)', async () => {
    FS.docs['agentBattles/ab-1/calls'] = [OPEN, NVDA_EXIT];
    await mount();
    await click(q('[data-cockpit-browse]'));
    expect(q('[data-cockpit-bench-sheet]')).toBeTruthy();
    const resolved = { ...NVDA_EXIT, state: 'expired_unresolved', stateChangedAt: T('2026-09-01T17:00:00.000Z') };
    await act(async () => { FS.next['agentBattles/ab-1/calls']({ docs: [OPEN, resolved].map((d) => ({ id: d.callId, data: () => d })) }); });
    await settle();
    expect(q('[data-cockpit-bench-sheet]')).toBeNull();
  });
});
