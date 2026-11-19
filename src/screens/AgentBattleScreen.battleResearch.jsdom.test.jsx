// @vitest-environment jsdom
//
// src/screens/AgentBattleScreen.battleResearch.jsdom.test.jsx
//
// Battle Research Slice 1 — THE SURFACE, MOUNTED IN THE BATTLE SCREEN (spec
// docs/specs/BATTLE_RESEARCH_SLICE1_SPEC_V1.md BRS-1, BRS-2, BRS-17, BRS-19, §7,
// §11 "UI (PR B, jsdom)"). The REAL screen, store, engine, surface and chat run;
// the edges are fakes: the HTTP routes (a stubbed fetch — cockpit status, the
// bench, the research quotes), Firestore (a recorder serving the rankings doc),
// the flag ACCESSORS and the research modal (a recorder of its props).
//
//   off   BATTLE_RESEARCH_MODE 'off': the pill opens the bench sheet BYTE FOR BYTE
//         as main does (a golden captured on origin/main), and no research read
//   on    the tap flow: propose → weakest → move order → can come in now → undo →
//         open a candidate (the modal gets the research context, the whole
//         rankings doc and the weakest) → Escape closes only the modal, focus to
//         the row → draft (the composer prefilled, NO POST) → the pill reopens the
//         same investigation and step; only one of the bench sheet and the surface
//         is ever open
//
// Harness: AgentBattleScreen.cockpit2b.jsdom.test.jsx (copied; the research flags,
// the quotes route, the rankings doc and a props-recording modal added).

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createHash } from 'node:crypto';
import { FLAT6_GAME_MODE } from '../constants/agentGameModes.js';

// The golden's bytes include clock text: pin the zone so a Windows run and the UTC CI runner read the same.
vi.hoisted(() => { process.env.TZ = 'UTC'; });
vi.mock('../firebase/config', () => ({ db: {}, auth: {}, default: {} }));
const AUTH = vi.hoisted(() => ({ user: { getIdToken: async () => 'token-1' } }));
vi.mock('firebase/auth', () => ({ getAuth: vi.fn(() => ({ currentUser: AUTH.user })) }));
vi.mock('../services/agentService', () => ({ submitDailyGrades: vi.fn(), addFeedBookmark: vi.fn(), removeFeedBookmark: vi.fn() }));

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
const FLAG = vi.hoisted(() => ({ cockpit: true, v2: true }));
vi.mock('../config/featureFlags', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    isAgentPresenceOn: () => false,
    isMatchupsBackdropOn: () => false,
    isBattleViewControllerOn: () => true,
    isCharacterPaneOn: () => true,
    isCockpitUiOn: () => FLAG.cockpit,
    isCockpit2bOn: () => FLAG.v2,
  };
});
// THE RESEARCH FLAGS — read at call time through getters; the shell ('on') in every row, Battle Research per row.
const RF = vi.hoisted(() => ({ br: 'off', sheet: 'on' }));
vi.mock('../config/researchModalFlags', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    get BATTLE_RESEARCH_MODE() { return RF.br; },
    get RESEARCH_MODAL_SHEET_MODE() { return RF.sheet; },
  };
});
vi.mock('../services/eodhdAPI', () => ({
  stockAPI: { getMultipleStockPrices: vi.fn(async () => ({})), getMultipleCryptoPrices: vi.fn(async () => ({})) },
  POPULAR_CRYPTO: [],
}));
vi.mock('../components/Agent/LiveActivityPanel', () => ({ default: () => null, BreakthroughAlerts: () => null }));
// The research modal: a recorder of its props (its own research blocks are AssetResearchModal.research.jsdom.test.jsx's).
const MODAL = vi.hoisted(() => ({ last: null }));
vi.mock('../components/draft/AssetResearchModal', () => ({
  default: (props) => { MODAL.last = props; return React.createElement('div', { 'data-research-modal': props.asset?.symbol ?? '' }); },
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
    strategyPreset: 'balanced', gameplanMeeting: null, chatExchanges: DOC.chatExchanges ?? [],
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

let QUOTES = null; // the research route's body (set by the research rows)
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
  SCREEN = BATTLE;
  FLAG.cockpit = true;
  FLAG.v2 = true;
  RF.br = 'off';
  RF.sheet = 'on';
  QUOTES = null;
  MODAL.last = null;
  AUTH.user = { getIdToken: async () => 'token-1' };
  FS.listeners = [];
  FS.gets = [];
  FS.next = {};
  FS.error = {};
  FS.docs = { 'agentBattles/ab-1/calls': [OPEN, NVDA_EXIT], 'agentBattles/ab-1/declarations': [], 'agentBattles/ab-1/callEvents': [] };
  delete window.visualViewport;
  fetchSpy = vi.fn(async (url) => {
    const u = String(url);
    if (u.startsWith('/api/agent/cockpit-status')) return json(200, { on: true });
    if (u.startsWith('/api/agent/cockpit-bench')) return json(200, BENCH_BODY);
    if (u.startsWith('/api/agent/battle-research-quotes')) return QUOTES ? json(200, QUOTES) : json(404, { error: 'battle_research_unavailable' });
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

let SCREEN = BATTLE; // the research rows mount on 'stock-battle' (the measured receipts are bound to that id)
const element = () => <AgentBattleScreen battle={SCREEN} user={{ uid: 'u1' }} onBack={() => {}} onOpenFilmRoom={null} />;
const settle = async () => { for (let i = 0; i < 12; i += 1) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const mount = async () => { await act(async () => { root.render(element()); }); await settle(); };
const q = (sel) => container.querySelector(sel);
const click = async (el) => {
  expect(el).toBeTruthy();
  await act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); });
  await settle();
};
const key = async (el, k) => {
  await act(async () => { el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })); });
  await settle();
};
// The real screen mounts in 1–3 s alone; under the 8-worker suite (or a 2-vCPU runner) give every row room.
const ROW_MS = 20_000;
const FLOW_MS = 45_000;
const calledUrls = () => fetchSpy.mock.calls.map(([u]) => String(u));
const researchReads = () => calledUrls().filter((u) => u.startsWith('/api/agent/battle-research-quotes'));
const rankingsReads = () => FS.gets.filter((p) => p === 'indexIntelligence/stockRankings');
// The board's trail of refinements, one line each (null when the question stands as asked).
const thenLines = () => { const t = q('[data-br-then]'); return t ? [...t.children].map((c) => c.textContent) : null; };

// THE GOLDEN: the bench sheet the pill opens, as origin/main renders it (captured at 5a8c3620 with
// BRS_GOLDEN_PRINT=1 on this file's harness above the research rows). Pinned: the SHEET. The whole screen behind
// it hashed identical to main's too, once, at that commit (ceb2584c…, League 9e735439…; the build report records
// it) — not pinned, so a later change to the battle screen never trips this row with an opaque hash. React's
// useId values are renumbered in order of appearance so the hash pins the markup, not the id counter.
const renumberIds = (html) => {
  const seen = new Map();
  return html.replace(/_r_[0-9a-z]+_|«r[0-9a-z]+»|:r[0-9a-z]+:/g, (m) => {
    if (!seen.has(m)) seen.set(m, `__id${seen.size}__`);
    return seen.get(m);
  });
};
const sha = (s) => createHash('sha256').update(renumberIds(s)).digest('hex');
const GOLDEN = {
  off: { sheet: '37a3d5ffdffd1bc485d311a73073bb0750267c01f52faf8c4fb2cbd707ed9909' },
  league: { sheet: '37a3d5ffdffd1bc485d311a73073bb0750267c01f52faf8c4fb2cbd707ed9909' },
};
const goldenOf = async (name) => {
  await mount();
  await click(q('[data-this-turn-research]'));
  // The sheet's entrance (framer-motion, real frames) runs out before the bytes are read: mid-flight its
  // opacity and offset are fractions of wall time, never the same twice. Wait (bounded) until the screen's
  // markup holds still across two reads 150 ms apart, rather than for a fixed time a loaded runner can miss.
  let prev = null;
  for (let i = 0; i < 40; i += 1) {
    await act(async () => { await new Promise((r) => setTimeout(r, 150)); });
    const now = container.innerHTML;
    if (now === prev) break;
    prev = now;
  }
  await settle();
  const sheet = q('[data-cockpit-bench-sheet]');
  expect(sheet).toBeTruthy();
  const out = { sheet: sha(sheet.outerHTML), screen: sha(container.innerHTML) };
  if (globalThis.process?.env?.BRS_GOLDEN_PRINT === '1') console.log(`BRS_GOLDEN ${name} ${JSON.stringify(out)}`); // eslint-disable-line no-console
  return out;
};

describe('BATTLE_RESEARCH_MODE off — the pill opens the bench sheet, byte for byte as main', () => {
  it('the bench sheet hashes to main\'s golden; no research read, no surface', async () => {
    expect((await goldenOf('off')).sheet).toBe(GOLDEN.off.sheet);
    expect(q('[data-br-surface]')).toBeNull();
    expect(researchReads()).toEqual([]);
    expect(rankingsReads()).toEqual([]);
  }, ROW_MS);
  it('mode on but a League battle (BRS-1): still the bench sheet, byte for byte as main renders that battle', async () => {
    RF.br = 'on';
    DOC = { ...LIVE_DOC, gameMode: FLAT6_GAME_MODE };
    expect((await goldenOf('league')).sheet).toBe(GOLDEN.league.sheet);
    expect(q('[data-br-surface]')).toBeNull();
    expect(q('[data-cockpit-bench-sheet] h2').textContent).toBe('The bench');
    expect(researchReads()).toEqual([]);
  }, ROW_MS);
});

// ---- the research rows (Battle Research on) ----
import { researchBattle, rankingsDoc, quotesBody, TAKEN_AT } from '../components/Research/BattleResearch/__fixtures__/researchFixtures.js';

let RESEARCH_DOC;
beforeAll(async () => {
  const b = await researchBattle();
  RESEARCH_DOC = { ...LIVE_DOC, ...b, status: 'active', statusFeed: [], chatExchanges: [], trades: [] };
});

describe('BATTLE_RESEARCH_MODE on — the surface in the screen', () => {
  beforeEach(() => {
    RF.br = 'on';
    DOC = RESEARCH_DOC;
    SCREEN = { ...BATTLE, agentBattleId: RESEARCH_DOC.id };
    FS.docs[`agentBattles/${RESEARCH_DOC.id}/calls`] = [];
    FS.docs[`agentBattles/${RESEARCH_DOC.id}/declarations`] = [];
    FS.docs[`agentBattles/${RESEARCH_DOC.id}/callEvents`] = [];
    FS.docs['indexIntelligence/stockRankings'] = rankingsDoc();
    QUOTES = { ...quotesBody(), servedAt: TAKEN_AT };
    vi.setSystemTime(new Date(TAKEN_AT + 20_000));
  });

  it('the pill opens the surface (not the bench sheet); the opening reads one bundle', async () => {
    await mount();
    await click(q('[data-this-turn-research]'));
    expect(q('[data-br-surface]')).toBeTruthy();
    expect(q('[data-cockpit-bench-sheet]')).toBeNull();
    expect(researchReads()).toEqual([`/api/agent/battle-research-quotes?battleId=${RESEARCH_DOC.id}`]);
    expect(rankingsReads()).toHaveLength(1);
    expect(q('[data-br-proposal="weakest"]').textContent).toContain('EQIX is our weakest holding');
  }, ROW_MS);

  it('the tap flow: weakest → move order → can come in now → undo → a candidate → Escape → draft (no POST) → the pill reopens the same step', async () => {
    await mount();
    await click(q('[data-this-turn-research]'));
    // propose → weakest (the bundle a few seconds old is reused: still one read of each)
    await click(q('[data-br-starter="weakest_alternatives"]'));
    expect(q('[data-br-title]').textContent).toBe('Compare alternatives to EQIX');
    expect(researchReads()).toHaveLength(1);
    expect(rankingsReads()).toHaveLength(1);
    // switch to today's move, add "can come in now", undo it
    await click(q('[data-br-order="today_move"]'));
    const moveThen = thenLines();
    expect(moveThen).toHaveLength(1);
    expect(moveThen[0]).toMatch(/^then: .*move/);
    await click(q('[data-br-condition="eligible_now"]'));
    expect(thenLines()).toEqual([...moveThen, 'then: only names that can come in now']);
    await click(q('[data-br-undo]'));
    expect(thenLines()).toEqual(moveThen);
    const order = [...container.querySelectorAll('[data-br-surface] [data-br-row]')].map((r) => r.getAttribute('data-br-row'));
    expect(order.length).toBeGreaterThan(1);
    // open a candidate: the modal over the surface, with the research context, the WHOLE doc and the weakest
    const cand = order.find((s) => s !== 'EQIX');
    await click(q(`[data-br-surface] [data-br-row="${cand}"]`));
    expect(q(`[data-research-modal="${cand}"]`)).toBeTruthy();
    const ctx = MODAL.last.sheetContext;
    expect(ctx.openedFromResearch).toBe(true); // CP-2 (OV-2): the modal opens on Analysis, not the Chart view
    expect(ctx.research.question.text).toBe('Compare alternatives to EQIX');
    expect(MODAL.last.asset.symbol).toBe(cand);
    expect(ctx.research.refinements).toEqual(moveThen); // the step the row was opened from: the move order
    expect(ctx.research.openedStepId).toBe(ctx.research.stepId);
    expect(ctx.rankings.stocks).toHaveLength(rankingsDoc().stocks.length);
    expect(ctx.incumbent).toBe('EQIX');
    expect(q('[data-br-layer]').hasAttribute('inert')).toBe(true);
    // Escape closes ONLY the modal; focus returns to the row, the surface and the step unchanged
    await key(document.body, 'Escape');
    expect(q('[data-research-modal]')).toBeNull();
    expect(q('[data-br-surface]')).toBeTruthy();
    expect(q('[data-br-layer]').hasAttribute('inert')).toBe(false);
    expect(document.activeElement).toBe(q(`[data-br-surface] [data-br-row="${cand}"]`));
    expect(thenLines()).toEqual(moveThen);
    // reopen the candidate and draft it for the agent: the composer is prefilled, nothing is sent
    await click(q(`[data-br-surface] [data-br-row="${cand}"]`));
    const research = MODAL.last.sheetContext.research;
    const draft = research.draftFor('EQIX');
    expect(draft.text).toMatch(/^Research: "Compare alternatives to EQIX" \(result 1:45 PM ET\)/);
    await act(async () => { research.onDraft(draft); });
    await settle();
    expect(q('[data-research-modal]')).toBeNull();
    expect(q('[data-br-surface]')).toBeNull();
    const composer = [...container.querySelectorAll('textarea')].find((t) => t.placeholder === 'Talk to your agent...');
    expect(composer).toBeTruthy();
    expect(composer.value).toBe(draft.text);
    expect(calledUrls().filter((u) => u.startsWith('/api/agent/chat'))).toEqual([]);
    // the pill again: the same investigation, at the same step, and nothing read again
    await click(q('[data-this-turn-research]'));
    expect(q('[data-br-title]').textContent).toBe('Compare alternatives to EQIX');
    expect(thenLines()).toEqual(moveThen);
    expect([...container.querySelectorAll('[data-br-surface] [data-br-row]')].map((r) => r.getAttribute('data-br-row'))).toEqual(order);
    expect(researchReads()).toHaveLength(1);
  }, FLOW_MS); // ~15 taps through the real screen, each settled

  it('the surface keeps its scroll per step across a close and the pill', async () => {
    await mount();
    await click(q('[data-this-turn-research]'));
    await click(q('[data-br-starter="weakest_alternatives"]'));
    const box = q('[data-br-scroll]');
    await act(async () => { box.scrollTop = 137; box.dispatchEvent(new Event('scroll', { bubbles: false })); });
    await settle();
    await key(q('[data-br-surface]'), 'Escape');
    expect(q('[data-br-surface]')).toBeNull();
    await click(q('[data-this-turn-research]'));
    expect(q('[data-br-scroll]').scrollTop).toBe(137);
  }, ROW_MS);

  it('Ask {Agent} about this result: the composer is prefilled (appended), nothing is sent', async () => {
    await mount();
    await click(q('[data-this-turn-research]'));
    await click(q('[data-br-starter="weakest_alternatives"]'));
    await click(q('[data-br-ask-about]'));
    const composer = [...container.querySelectorAll('textarea')].find((t) => t.placeholder === 'Talk to your agent...');
    expect(composer.value).toMatch(/^Research: "Compare alternatives to EQIX" \(result 1:45 PM ET\)/);
    expect(calledUrls().filter((u) => u.startsWith('/api/agent/chat'))).toEqual([]);
  }, ROW_MS);

  it('BRS-19: words the player already typed are kept — the draft is added after them with a blank line (live checklist step 5)', async () => {
    await mount();
    // The desktop chat stands open beside the battle: type first.
    const composer = () => [...container.querySelectorAll('textarea')].find((t) => t.placeholder === 'Talk to your agent...');
    expect(composer()).toBeTruthy();
    const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    await act(async () => { setValue.call(composer(), 'my own words first'); composer().dispatchEvent(new Event('input', { bubbles: true })); });
    await settle();
    expect(composer().value).toBe('my own words first');
    await click(q('[data-this-turn-research]'));
    await click(q('[data-br-starter="weakest_alternatives"]'));
    await click(q('[data-br-ask-about]'));
    expect(composer().value).toMatch(/^my own words first\n\nResearch: "Compare alternatives to EQIX" \(result 1:45 PM ET\)/);
    expect(calledUrls().filter((u) => u.startsWith('/api/agent/chat'))).toEqual([]);
  }, ROW_MS);

  it('only one of the bench sheet and the surface is open: the pill closes a bench sheet, a bench door closes the surface', async () => {
    DOC = LIVE_DOC;
    SCREEN = BATTLE;
    FS.docs['agentBattles/ab-1/calls'] = [OPEN, NVDA_EXIT];
    vi.setSystemTime(new Date('2026-09-01T17:00:00.000Z'));
    await mount();
    await click(q('[data-cockpit-browse]'));
    expect(q('[data-cockpit-bench-sheet]')).toBeTruthy();
    await click(q('[data-this-turn-research]'));
    expect(q('[data-br-surface]')).toBeTruthy();
    expect(q('[data-cockpit-bench-sheet]')).toBeNull();
    await click(q('[data-cockpit-browse]'));
    expect(q('[data-cockpit-bench-sheet]')).toBeTruthy();
    expect(q('[data-br-surface]')).toBeNull();
  }, ROW_MS);

  it('the battle leaving active closes the surface (BRS-1)', async () => {
    await mount();
    await click(q('[data-this-turn-research]'));
    expect(q('[data-br-surface]')).toBeTruthy();
    DOC = { ...RESEARCH_DOC, status: 'completed' };
    await mount();
    expect(q('[data-br-surface]')).toBeNull();
  }, ROW_MS);
});

describe('review round on PR B (lens 2), at the screen', () => {
  beforeEach(() => {
    RF.br = 'on';
    DOC = RESEARCH_DOC;
    SCREEN = { ...BATTLE, agentBattleId: RESEARCH_DOC.id };
    FS.docs[`agentBattles/${RESEARCH_DOC.id}/calls`] = [];
    FS.docs[`agentBattles/${RESEARCH_DOC.id}/declarations`] = [];
    FS.docs[`agentBattles/${RESEARCH_DOC.id}/callEvents`] = [];
    FS.docs['indexIntelligence/stockRankings'] = rankingsDoc();
    QUOTES = { ...quotesBody(), servedAt: TAKEN_AT };
    vi.setSystemTime(new Date(TAKEN_AT + 20_000));
  });
  it('BL2-10: a row of the opening\'s list opens with the opening\'s own readings — its ATR seed and whole rankings doc', async () => {
    await mount();
    await click(q('[data-this-turn-research]'));
    await click(q('[data-br-as-they-stand-toggle]'));
    await click(q('[data-br-as-they-stand] [data-br-row="PLTR"]'));
    expect(q('[data-research-modal="PLTR"]')).toBeTruthy();
    const ctx = MODAL.last.sheetContext;
    expect(ctx.research).toBeUndefined();
    expect(ctx.openedFromResearch).toBe(true); // CP-2 (OV-2): state 1's list opens on Analysis too
    expect(ctx.atrSeed).toEqual({ pct: 4.06, asOfMs: Date.parse('2026-10-14T17:01:00.000Z') });
    expect(ctx.rankings.stocks).toHaveLength(rankingsDoc().stocks.length);
  }, ROW_MS);
  it('BL2-12: with no agent name the voice is the archetype alone, as the sheet names it — never "Your Agent · …"', async () => {
    DOC = { ...RESEARCH_DOC, agentContext: { ...RESEARCH_DOC.agentContext, agentName: '' } };
    await mount();
    await click(q('[data-this-turn-research]'));
    expect(q('[data-br-voice]').textContent).toBe('Trend Follower');
  }, ROW_MS);
});

describe('the reference line opens the holding as itself (row added after the battery: H5 survived)', () => {
  beforeEach(() => {
    RF.br = 'on';
    DOC = RESEARCH_DOC;
    SCREEN = { ...BATTLE, agentBattleId: RESEARCH_DOC.id };
    FS.docs[`agentBattles/${RESEARCH_DOC.id}/calls`] = [];
    FS.docs[`agentBattles/${RESEARCH_DOC.id}/declarations`] = [];
    FS.docs[`agentBattles/${RESEARCH_DOC.id}/callEvents`] = [];
    FS.docs['indexIntelligence/stockRankings'] = rankingsDoc();
    QUOTES = { ...quotesBody(), servedAt: TAKEN_AT };
    vi.setSystemTime(new Date(TAKEN_AT + 20_000));
  });
  it('EQIX, the weakest, opens in state 1: no research context (it is the comparison, not a candidate)', async () => {
    await mount();
    await click(q('[data-this-turn-research]'));
    await click(q('[data-br-starter="weakest_alternatives"]'));
    const ref = q('[data-br-surface] [data-br-reference="EQIX"]');
    await click(ref.tagName === 'BUTTON' ? ref : ref.querySelector('button'));
    expect(q('[data-research-modal="EQIX"]')).toBeTruthy();
    expect(MODAL.last.sheetContext.research).toBeUndefined();
    expect(MODAL.last.sheetContext.openedFromResearch).toBe(true); // opened from the surface (CP-2, OV-2)
  }, ROW_MS);
});
