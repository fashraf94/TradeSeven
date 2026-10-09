// api/_utils/__fixtures__/deployHarness.js
//
// Pilot P1b — THE DEPLOY HARNESS: everything a suite needs to drive the REAL
// deploy endpoint (api/agent/decide.js — the self-select handler AND the
// prescribed tournament branch) end to end through the REAL battle writer
// (agentBattleService.createAgentBattle) and the REAL creation transaction
// (compositionGenerationFence.commitBattleDocWithPin), over an in-memory store.
// Only the edges are doubles: the model SDK, the voice model, pricing, auth,
// the shadow logger and the store itself.
//
// It is written so the SAME harness runs against `main`'s untouched code (the
// off golden is captured there — api/agent/decide.carriageOffGolden.test.js):
// ZERO product imports; nothing here knows what P1b adds.
//
//   · makeDeployDb(docs)   the general optimistic double (callsFirestore.js),
//                          plus auto-ids for `collection(x).doc()` with no id
//                          (`auto-1`, `auto-2`, … per store — deterministic);
//   · seedDeploy(opts)     the documents a deploy reads: the agent, its
//                          equipped list (and, when asked, the list's
//                          hypothesis versions), the stock rankings, stories;
//   · makeAnthropicDouble  answers submit_strategy / submit_portfolio with
//                          fixed tool input and RECORDS every request (the
//                          prompt bytes: system, messages, tools, model,
//                          temperature);
//   · captureDeploy(...)   the normalized capture a golden compares: the
//                          response, every model request, every voice-model
//                          request, the shadow-log arguments, every store
//                          read / query / write in order, the transaction
//                          attempt count, and the final documents.
//
// Deterministic by construction: the suite pins the clock (Date only) and
// Math.random (seededRandom below); the store's auto-ids are a per-store
// counter.

import { makeCallsFirestore } from './callsFirestore.js';

export const OWNER = 'p1b-owner-1';
export const AGENT_ID = 'agent-p1b-1';
export const WATCHLIST_ID = 'wl-p1b-1';
/** Tue 13 Oct 2026, 11:00 ET — a regular session, mid-morning. */
export const FROZEN_NOW = '2026-10-13T15:00:00.000Z';
export const CRON_SECRET = 'p1b-cron-secret';

const SECTORS = ['Technology', 'Financials', 'Energy', 'Health Care', 'Consumer Staples'];
const SYMBOLS = [
  'AAPL', 'MSFT', 'NVDA', 'AMD', 'JPM', 'XOM', 'COST', 'LLY', 'UNH', 'GOOGL',
  'AMZN', 'META', 'TSLA', 'CRM', 'NFLX', 'ORCL', 'ADBE', 'INTC', 'QCOM', 'AVGO',
  'BAC', 'CVX', 'PFE', 'WMT',
];
/** The ranked universe (stockRankings.stocks) — every field a deploy reads, fixed. */
export const UNIVERSE = Object.freeze(SYMBOLS.map((symbol, i) => Object.freeze({
  symbol,
  name: `${symbol} Inc.`,
  sectorName: SECTORS[i % SECTORS.length],
  price: 100 + i,
  baggerBombFit: 90 - i,
  atrPercentile: (i % 10) / 10,
  baseATR: 2 + (i % 4) * 0.25,
  momentumScore: 80 - i,
  trendScore: 70 - (i % 7),
  volatilityScore: 40 + (i % 9),
  valueScore: 50 + (i % 5),
  qualityScore: 60 - (i % 6),
})));

/** The model's fixed answers. The shortlist is 16 universe symbols (≥ 15: no padding). */
export const STRATEGY_INPUT = Object.freeze({
  brief: 'Lean into the strongest trends; keep one defensive sleeve.',
  shortlist: SYMBOLS.slice(0, 16),
});
export const PORTFOLIO_INPUT = Object.freeze({
  star: ['AAPL', 'MSFT'],
  core: ['NVDA', 'AMD'],
  support_stocks: ['JPM', 'XOM'],
  support_crypto: 'BTC',
  bench_stocks: ['COST', 'LLY', 'UNH'],
  bench_crypto: 'ETH',
  innerMonologue: { strategy: 'Trend leaders first.', risk: 'Two defensive names.' },
});

/** The equipped list: committed, three tickers (objects, as the list stores them). */
export function watchlistDoc({ status = 'committed', tickers = ['NVDA', 'PLTR', 'AMD'], name = 'AI capex', userId = OWNER, deletedAt = null } = {}) {
  return {
    watchlistId: WATCHLIST_ID, userId, agentId: null, sourceSessionId: null, sourceDropId: null,
    thesis: 'AI capex keeps compounding through 2027.',
    activationConditions: [], invalidationConditions: [],
    tickers: tickers.map((symbol) => ({ symbol, reasoning: '', category: 'core', addedBy: 'player', addedAt: '2026-10-01T14:00:00.000Z' })),
    name, notes: '', status, createdAt: '2026-10-01T14:00:00.000Z', updatedAt: '2026-10-01T14:00:00.000Z',
    committedAt: '2026-10-01T15:00:00.000Z', deletedAt,
  };
}

/** The agent document a deploy reads (a ranked, self-select agent). */
export function agentDoc({ equippedWatchlistId = WATCHLIST_ID, lastDeployedAt = '2026-10-12T15:00:00.000Z', over = {} } = {}) {
  return {
    ownerId: OWNER, name: 'Viper', archetype: 'momentum_chaser',
    equippedTraits: [], activeRules: [], equippedBundleIds: [],
    config: { risk: 50 }, stats: { gamesPlayed: 4, wins: 2, losses: 2 },
    equippedWatchlistId, equippedWatchlistName: equippedWatchlistId ? 'AI capex' : null,
    equippedAt: equippedWatchlistId ? '2026-10-02T14:00:00.000Z' : null,
    lastDeployedAt, deployingAt: null, activeBattleId: null, settingsRev: 3,
    ...over,
  };
}

/**
 * The documents a deploy reads, by path.
 * @param {{ watchlist?: object|null, versions?: object[], agent?: object, extra?: Record<string, object> }} opts
 */
export function seedDeploy({ watchlist = watchlistDoc(), versions = [], agent = agentDoc(), extra = {} } = {}) {
  const docs = {
    [`agents/${AGENT_ID}`]: agent,
    'indexIntelligence/stockRankings': { stocks: UNIVERSE.map((s) => ({ ...s })) },
    'fantasyTimesStories/s1': { type: 'news', headline: 'Chips rally on capex guidance', summary: 'Semis lead.', publishedAt: '2026-10-13T12:00:00.000Z' },
    'fantasyTimesStories/s2': { type: 'deepdive', headline: 'Vera on rates', summary: 'Long read.', publishedAt: '2026-10-13T11:00:00.000Z' },
    'fantasyTimesStories/s3': { type: 'news', headline: 'Banks steady', summary: 'Spreads flat.', publishedAt: '2026-10-12T20:00:00.000Z' },
    'indexIntelligence/marketContext': { regime: 'risk_on', regimeDetail: 'Breadth improving.' },
    ...extra,
  };
  if (watchlist) docs[`watchlists/${WATCHLIST_ID}`] = watchlist;
  for (const v of versions) docs[`watchlists/${WATCHLIST_ID}/hypothesisVersions/v${v.version}`] = v;
  return docs;
}

/** The callsFirestore double with deterministic auto-ids for `collection(x).doc()`. */
export function makeDeployDb(docs) {
  const db = makeCallsFirestore({ docs });
  let n = 0;
  const baseCollection = db.collection;
  db.collection = (name) => {
    const col = baseCollection(name);
    return { ...col, doc: (id) => col.doc(id === undefined ? `auto-${(n += 1)}` : id) };
  };
  return db;
}

/** A deterministic Math.random (mulberry32). */
export function seededRandom(seed = 0x5eed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pricing: every symbol is a complete, non-fallback quote. */
export async function priceAnswer(symbol) {
  const i = Math.max(0, SYMBOLS.indexOf(symbol));
  const current = symbol === 'BTC' ? 62000 : symbol === 'ETH' ? 2400 : 100 + i;
  return { price: { current, high: current * 1.01, low: current * 0.99, previousClose: current * 0.995 }, daily: [{ close: current * 0.995 }] };
}

/** The model SDK double: records every request; answers by the forced tool. */
export function makeAnthropicDouble() {
  const calls = [];
  const create = async (args) => {
    calls.push(JSON.parse(JSON.stringify(args)));
    const tool = args.tool_choice?.name;
    const input = tool === 'submit_strategy' ? STRATEGY_INPUT : PORTFOLIO_INPUT;
    return {
      content: [{ type: 'tool_use', id: `toolu_${calls.length}`, name: tool, input: JSON.parse(JSON.stringify(input)) }],
      usage: { input_tokens: 1000 + calls.length, output_tokens: 100 + calls.length },
    };
  };
  return { calls, create };
}

export function makeRes() {
  return {
    statusCode: null,
    body: null,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    getHeader(k) { return this.headers[k]; },
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
    end() { return this; },
  };
}

/** A client deploy request (self-select). */
export function clientRequest(body = {}) {
  return { method: 'POST', headers: { authorization: 'Bearer client-token' }, body: { agentId: AGENT_ID, ...body }, query: {} };
}

/** An internal prescribed tournament request (the orchestrator's shape). */
export function tournamentRequest(body = {}) {
  return {
    method: 'POST',
    headers: { authorization: `Bearer ${CRON_SECRET}` },
    body: {
      agentId: AGENT_ID, ownerOdUserId: OWNER, gameMode: 'baggerbomb_tournament', groupId: 'grp-p1b-1',
      prescribedPortfolio: ['AAPL', 'MSFT', 'NVDA', 'AMD', 'JPM', 'XOM'], isCpu: false,
      userPicksStance: [], doubleDownSymbols: [], userPicks: [], ...body,
    },
    query: {},
  };
}

const clone = (v) => (v === undefined ? null : JSON.parse(JSON.stringify(v)));

/** The final documents under the collections a deploy can touch. */
export function finalDocs(db) {
  const out = {};
  const keep = /^(agents|agentBattles|watchlists|hypothesisReviewQueue)\//;
  for (const [path, data] of [...db.__docs.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    if (keep.test(path)) out[path] = clone(data);
  }
  return out;
}

/**
 * The normalized capture of one deploy.
 * @param {{ db: object, res: object, anthropic: { calls: object[] }, gemmaCalls: object[], shadow: { decisions: object[], firstMessages: object[] } }} p
 */
export function captureDeploy({ db, res, anthropic, gemmaCalls, shadow }) {
  const a = db.__access;
  return clone({
    response: { status: res.statusCode, body: res.body },
    modelRequests: anthropic.calls,
    voiceRequests: gemmaCalls,
    shadow,
    store: {
      reads: a.reads,
      queries: a.queries,
      writes: a.writes,
      txAttempts: db.__txAttempts,
    },
    docs: finalDocs(db),
  });
}

/** Every store access whose path names a hypothesis record (version, queue or cursor). */
export function hypothesisAccess(capture) {
  const hit = (p) => typeof p === 'string' && /hypothesisVersions|hypothesisReviewQueue|hypothesisReviewState/.test(p);
  return {
    reads: capture.store.reads.filter(hit),
    queries: capture.store.queries.filter((q) => hit(`${q.collectionPath}/`)),
    writes: capture.store.writes.filter((w) => hit(w.path)),
  };
}
