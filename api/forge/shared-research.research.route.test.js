// api/forge/shared-research.research.route.test.js
//
// Research universe Build 3b, build prompt sections 5 to 7 and 9: A RESEARCH SESSION AT THE ROUTE, on the atomic
// in-memory Firestore double, with the model, the search and the provider's network as seams (no network, no model, no
// Firestore). The founder's own words about Corning: the stamp at open; the partner names Corning in words and the
// server looks it up (GLW, marked research); the card holds it, the thesis saves with it and the confirm line names it;
// the stored rows show its own numbers and no rank, at most 10 research companies fetched, and a refused or over-ceiling
// fetch never fails the step. Beside it, another player's game-list session is untouched.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeSrFirestore } from '../_utils/sharedResearch/__fixtures__/srFirestore.js';

const state = vi.hoisted(() => ({
  mode: 'on', builder: 'on', universe: 'founder', user: { uid: 'founder-1' }, db: null, turns: [], turnQueue: [], retrievals: [], retrievalQueue: [], logs: [],
  fetches: [], fetchAnswer: null,
}));
vi.mock('../../src/config/sharedResearchFlags.js', () => ({
  SHARED_RESEARCH_MODES: Object.freeze(['off', 'allowlist', 'on']),
  get SHARED_RESEARCH_MODE() { return state.mode; },
  SHARED_RESEARCH_BUILDER_MODES: Object.freeze(['off', 'on']),
  get SHARED_RESEARCH_BUILDER_MODE() { return state.builder; },
  SHARED_RESEARCH_UNIVERSE_MODES: Object.freeze(['off', 'founder', 'on']),
  get SHARED_RESEARCH_UNIVERSE_MODE() { return state.universe; },
}));
vi.mock('../_utils/callRecords/mode.js', () => ({ isCockpitOwnerAllowlisted: () => true }));
vi.mock('../_utils/hypothesisRecords/gate.js', () => ({ hypothesisRecordsOnFor: () => true }));
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => state.db }));
vi.mock('../_utils/security.js', () => ({ applySecurityMiddleware: () => false }));
vi.mock('../_utils/authMiddleware.js', () => ({ requireAuth: async () => state.user }));
vi.mock('../_utils/shadowLogger.js', () => ({ logConversation: async (r) => { state.logs.push(r); return true; } }));
vi.mock('@vercel/functions', () => ({ waitUntil: (p) => p }));
vi.mock('../_utils/sharedResearch/modelTurn.js', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    runTurn: async (args) => {
      state.turns.push(args);
      const next = state.turnQueue.shift();
      if (!next) throw new Error('test: no model answer queued');
      return structuredClone(next);
    },
  };
});
vi.mock('../_utils/sharedResearch/retrieval.js', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, retrieve: async (args) => { state.retrievals.push(args); return structuredClone(state.retrievalQueue.shift() ?? { items: [], costDollars: 0, elapsedMs: 5, readAt: new Date().toISOString() }); } };
});

const { default: handler } = await import('./shared-research.js');
const { resetUidRateLimits } = await import('../_utils/sharedResearch/gate.js');
const { RESEARCH_NAMES_RULE } = await import('../_utils/sharedResearch/stepPrompt.js');
const { RESEARCH_FETCHES_PER_INVESTIGATION } = await import('../_utils/sharedResearch/researchRows.js');

const FOUNDER = 'founder-1';
const OTHER = 'player-2';
const agentOf = (uid, name) => ({ ownerId: uid, name, archetype: 'contrarian', loadouts: { baggerbomb: { archetype: 'momentum_chaser', book: null } } });
const seed = (extra = {}) => makeSrFirestore({
  'agents/agent-1': agentOf(FOUNDER, 'Atlas'),
  'agents/agent-2': agentOf(OTHER, 'Rook'),
  'peerRankings/NVDA': { ticker: 'NVDA', name: 'NVIDIA Corporation', sectorId: 'XLK', sectorName: 'Technology', compositeRank: 2, totalPeers: 21, computedAt: new Date('2026-11-26T11:00:51.000Z') },
  ...extra,
});
const res = () => { const r = { statusCode: null, body: null }; r.status = (c) => { r.statusCode = c; return r; }; r.json = (b) => { r.body = b; return r; }; r.setHeader = () => r; return r; };
const as = (uid) => { state.user = { uid }; };
const post = async (body) => { resetUidRateLimits(); const r = res(); await handler({ method: 'POST', headers: {}, query: {}, body }, r); return r; };
const get = async (query) => { resetUidRateLimits(); const r = res(); await handler({ method: 'GET', headers: {}, query, body: undefined }, r); return r; };
const turnOk = (output) => ({ ok: true, output, usage: { input: 8000, output: 600 }, model: 'claude-sonnet-5-5', attempts: 1, elapsedMs: 900, costUsd: 0.022, stopReason: 'end_turn' });
const uuid = (n) => `9a8b7c6d-5e4f-4a3b-8c2d-${String(n).padStart(12, '0')}`;
const opId = (n) => `1b2c3d4e-5f6a-4b7c-8d9e-${String(n).padStart(12, '0')}`;
const ITEMS = [
  { index: 0, url: 'https://news.example.com/corning-fiber', title: 'Corning (GLW) fiber demand from AI data centers', host: 'news.example.com', publishedDate: '2026-11-06T00:00:00.000Z', highlights: ['Corning supplies optical fiber and glass for data centers.'] },
  { index: 1, url: 'https://news.example.com/corning-results', title: 'Corning results', host: 'news.example.com', publishedDate: '2026-11-07T00:00:00.000Z', highlights: ['Optical communications sales rose.'] },
  { index: 2, url: 'https://news.example.com/hyperscalers', title: 'Hyperscalers buy their own fiber', host: 'news.example.com', publishedDate: '2026-11-08T00:00:00.000Z', highlights: ['Some buyers source fiber from several suppliers.'] },
];
const search = () => ({ items: ITEMS, costDollars: 0.005, elapsedMs: 300, readAt: new Date().toISOString() });
const EMPTY = { reply: '', findings: [], companies: [], themeSuggestion: null, segments: [], why: null, wrongIfOptions: [], timeFramePick: null, pick: null };
const out = (over) => turnOk({ ...EMPTY, ...over });
const MAP = () => out({
  reply: 'Here is how the idea splits.',
  segments: [{ label: 'Optical fiber', line: 'The glass links inside data centers', refs: [] }, { label: 'Data-center power', line: 'Electricity and cooling for the buildings', refs: [] }],
  pick: { part: 'segment', value: 'Optical fiber', reason: 'It is where the idea ties most directly to sales.', refs: [], reasons: [] },
});
// The partner names Corning in words and leaves the symbol empty, as the research session's rule tells it.
const CORNING = () => out({
  reply: 'One listed company has a sourced connection to this segment.',
  findings: [{ tempId: 'c1', kind: 'relationship', fact: 'Corning supplies the optical fiber inside AI data centers.', symbolCandidate: null, companyName: 'Corning', support: { kind: 'retrieval', index: 0, from: [], reason: null }, at: null, supersedes: null }],
  companies: [{ companyName: 'Corning', symbolCandidate: null, role: 'Supplier', relationshipRef: 'c1', openRef: null, claim: null }],
  pick: { part: 'names', value: 'GLW', reason: 'It has the sourced connection.', refs: ['c1'], reasons: [] },
});
const WHY = () => out({
  reply: 'One reason holds up in the sources, and one point cuts against it.',
  findings: [
    { tempId: 'w1', kind: 'earnings_fact', fact: 'Corning said optical communications sales rose.', symbolCandidate: null, companyName: 'Corning', support: { kind: 'retrieval', index: 1, from: [], reason: null }, at: null, supersedes: null },
    { tempId: 'w2', kind: 'coverage', fact: 'Some buyers source fiber from several suppliers.', symbolCandidate: null, companyName: null, support: { kind: 'retrieval', index: 2, from: [], reason: null }, at: null, supersedes: null },
  ],
  why: {
    shared: 'it supplies the fiber AI data centers are buying',
    reasons: [{ companyName: 'Corning', symbolCandidate: null, text: 'Its optical communications sales rose.', refs: ['w1'] }],
    against: { text: 'Some buyers source fiber from several suppliers.', refs: ['w2'] },
  },
  wrongIfOptions: [{ text: 'data-center fiber orders fall for two quarters', refs: [] }],
  timeFramePick: { horizon: 'positional', reason: 'Build-outs run over several quarters.' },
  pick: { part: 'wrongIf', value: 'data-center fiber orders fall for two quarters', reason: 'It is the business condition to check.', refs: [], reasons: [] },
});

/** An EODHD fundamentals response in Corning's shape (made-up values), statements in `currency`. */
const fundamentals = (name = 'Corning Incorporated', currency = 'USD') => ({
  Highlights: { MarketCapitalization: 86346842112, QuarterlyRevenueGrowthYOY: 0.184, QuarterlyEarningsGrowthYOY: 0.56, GrossProfitTTM: 6464000000, RevenueTTM: 17718999040 },
  Valuation: { PriceSalesTTM: 4.8731 },
  Earnings: { History: { '2026-09-30': { date: '2026-09-30', epsActual: 0.91, epsEstimate: 0.89 } }, Trend: { '2027-12-31': { date: '2027-12-31', period: '+1y', earningsEstimateGrowth: '0.3477', earningsEstimateNumberOfAnalysts: '19.0000' }, '2026-12-31': { date: '2026-12-31', period: '0y', earningsEstimateGrowth: '0.3400' } } },
  Financials: {
    Income_Statement: { currency_symbol: currency, yearly: { '2025-12-31': { operatingIncome: '2412000000', interestExpense: '-331000000', depreciationAndAmortization: '1302000000' } } },
    Cash_Flow: { currency_symbol: currency, quarterly: Object.fromEntries(['2025-12-31', '2026-03-31', '2026-06-30', '2026-09-30'].map((d) => [d, { totalCashFromOperatingActivities: '712000000', capitalExpenditures: '-311000000' }])) },
    Balance_Sheet: { currency_symbol: currency, yearly: { '2025-12-31': { shortLongTermDebtTotal: '8456000000', totalStockholderEquity: '11234000000', totalCurrentAssets: '8123000000', totalCurrentLiabilities: '4567000000', netDebt: '6987000000' } } },
  },
  'General::Name': name,
});

let env;
const sessionDoc = (id) => env.doc(`sharedResearchSessions/${id}`);
beforeEach(() => {
  env = seed();
  Object.assign(state, { mode: 'on', builder: 'on', universe: 'founder', user: { uid: FOUNDER }, db: env.db, turns: [], turnQueue: [], retrievals: [], retrievalQueue: [], logs: [], fetches: [], fetchAnswer: () => fundamentals() });
  process.env.MANDATE_FOUNDER_UIDS = FOUNDER;
  process.env.EODHD_API_KEY = 'TEST-KEY';
  vi.stubGlobal('fetch', async (url) => {
    state.fetches.push(String(url).replace(/api_token=[^&]+/, 'api_token=<key>'));
    const a = state.fetchAnswer(url);
    if (a instanceof Error) throw a;
    if (typeof a === 'number') return { ok: false, status: a, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => structuredClone(a) };
  });
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); delete process.env.MANDATE_FOUNDER_UIDS; delete process.env.EODHD_API_KEY; });

async function openOwn(observation = 'I think Corning glass matters for AI data centers', requestId = 'req-own-1') {
  const r = await post({ action: 'open', requestId, entry: { kind: 'observation', observation } });
  expect(r.statusCode, JSON.stringify(r.body)).toBe(200);
  return r.body;
}
async function build(sessionId, n, goal, answer) {
  if (goal !== 'pick') state.retrievalQueue.push(search());
  state.turnQueue.push(answer);
  return post({ action: 'step', sessionId, stepId: uuid(n), intent: 'build', goal });
}
/** The map, then the segment set on the card: find_names is then on offer. */
async function mapped(sessionId, n = 1) {
  const m = await build(sessionId, n, 'map_segments', MAP());
  expect(m.statusCode, JSON.stringify(m.body)).toBe(200);
  const t = await post({ action: 'card', sessionId, opId: opId(100 + n), rev: m.body.thesis.rev, op: 'set', part: 'segment', value: 'Optical fiber' });
  expect(t.statusCode, JSON.stringify(t.body)).toBe(200);
  return t;
}

describe('the stamp at open (section 5.1)', () => {
  it("the founder at 'founder': the session is stamped research, and its view says so", async () => {
    const o = await openOwn();
    expect(sessionDoc(o.session.sessionId).universe).toBe('research');
    expect(o.session.universe).toBe('research');
  });
  it("another player at 'founder', or anyone at 'off': no stamp, no field, no `universe` in the view", async () => {
    as(OTHER);
    const a = await openOwn('I think glass matters', 'req-a');
    expect('universe' in sessionDoc(a.session.sessionId)).toBe(false);
    expect('universe' in a.session).toBe(false);
    as(FOUNDER);
    state.universe = 'off';
    const b = await openOwn('I think glass matters', 'req-b');
    expect('universe' in sessionDoc(b.session.sessionId)).toBe(false);
  });
  it('a framed ledger (the builder off) is stamped at open, not at its framing: the frame runs on the game list, the open stamps research', async () => {
    state.builder = 'off';
    state.turnQueue.push(turnOk({ question: 'Which listed companies sell the glass inside AI data centers?', check: 'Find who supplies fiber glass.', notEstablished: 'Whether glass is a large part of any supplier\'s sales.' }));
    const f = await post({ action: 'frame', requestId: 'req-frame', observation: 'Corning glass is in every AI data center' });
    expect(f.statusCode, JSON.stringify(f.body)).toBe(200);
    expect('universe' in sessionDoc(f.body.sessionId)).toBe(false);
    expect(state.turns[0].system).not.toContain(RESEARCH_NAMES_RULE);
    const o = await post({ action: 'open', sessionId: f.body.sessionId, question: 'Which listed companies sell the glass inside AI data centers?' });
    expect(o.statusCode, JSON.stringify(o.body)).toBe(200);
    expect(sessionDoc(f.body.sessionId).universe).toBe('research');
    expect(o.body.session.universe).toBe('research');
    // its first step runs on the research list: the rule, and Corning in words resolved
    state.retrievalQueue.push(search());
    state.turnQueue.push(turnOk({
      reply: 'Corning supplies the fiber.', findings: [{ tempId: 'c1', kind: 'relationship', fact: 'Corning supplies the optical fiber inside AI data centers.', symbolCandidate: null, companyName: 'Corning', support: { kind: 'retrieval', index: 0, from: [], reason: null }, at: null, supersedes: null }],
      summary: null, lines: { support: 'c1', complication: null, missing: null }, nextAction: { label: 'Size the fiber sales', purpose: 'Significance is the weakest link.' }, companies: [],
    }));
    const s = await post({ action: 'step', sessionId: f.body.sessionId, stepId: uuid(9), intent: 'next' });
    expect(s.statusCode, JSON.stringify(s.body)).toBe(200);
    expect(state.turns.at(-1).system).toContain(RESEARCH_NAMES_RULE);
    expect(s.body.companies.supported).toEqual([expect.objectContaining({ symbol: 'GLW', eligibility: 'research' })]);
    expect(s.body.storedRows.find((r) => r.symbol === 'GLW')).toMatchObject({ research: true, numbers: 'shown' });
  });
  it('the stamp never changes: a research session stays one with the switch off, a game-list one stays one with it on', async () => {
    const research = await openOwn('Corning glass', 'req-r');
    state.universe = 'off';
    expect((await build(research.session.sessionId, 1, 'map_segments', MAP())).body.session.universe).toBe('research');
    const game = await openOwn('Corning glass again', 'req-g');
    state.universe = 'on';
    const r = await build(game.session.sessionId, 2, 'map_segments', MAP());
    expect('universe' in r.body.session).toBe(false);
    expect(state.turns.at(-1).system).not.toContain(RESEARCH_NAMES_RULE);
  });
});

describe("the founder's own words about Corning, to a saved thesis (sections 5, 6 and 7)", () => {
  it('Corning in words with no symbol ends as a verified relationship carrying GLW, a supported company marked research', async () => {
    const o = await openOwn();
    const id = o.session.sessionId;
    await mapped(id);
    const r = await build(id, 2, 'find_names', CORNING());
    expect(r.statusCode, JSON.stringify(r.body)).toBe(200);
    const rel = r.body.record.findings.find((f) => f.kind === 'relationship');
    expect(rel).toMatchObject({ symbol: 'GLW', status: 'verified' });
    expect(r.body.companies.supported).toEqual([expect.objectContaining({ symbol: 'GLW', name: 'Corning Incorporated', eligibility: 'research' })]);
    expect(r.body.companies.leads).toEqual([]);
  });
  it('the prompts: the one research rule, the game list unchanged and no directory symbol added; the research ticker not masked', async () => {
    const o = await openOwn();
    await build(o.session.sessionId, 1, 'map_segments', MAP());
    const { system, user } = state.turns[0];
    expect(system).toContain(RESEARCH_NAMES_RULE);
    expect(system.split('\n').filter((l) => l === RESEARCH_NAMES_RULE)).toHaveLength(1);
    expect(system).toContain(' NVDA ');
    expect(system).not.toMatch(/\bGLW\b/);
    expect(system).not.toMatch(/\bTSM\b/);
    expect(user).toContain('Corning (GLW) fiber demand');
    // a game-list session sees the same item masked, and no rule
    as(OTHER);
    const g = await openOwn('Corning glass', 'req-other');
    await build(g.session.sessionId, 3, 'map_segments', MAP());
    expect(state.turns[1].system).not.toContain(RESEARCH_NAMES_RULE);
    expect(state.turns[1].user).toContain("Corning ((symbol not in the app's records)) fiber demand");
  });
  it('the card holds Corning; the thesis saves with GLW on the list; the confirm line names Corning; the saved read says research', async () => {
    const o = await openOwn();
    const id = o.session.sessionId;
    let rev = o.thesis.rev;
    const step = async (n, goal, a) => { const r = await build(id, n, goal, a); expect(r.statusCode, JSON.stringify(r.body)).toBe(200); rev = r.body.thesis.rev; return r; };
    const tap = async (n, op, part, value) => { const r = await post({ action: 'card', sessionId: id, opId: opId(n), rev, op, part, ...(value === undefined ? {} : { value }) }); expect(r.statusCode, JSON.stringify(r.body)).toBe(200); rev = r.body.thesis.rev; return r; };
    await step(1, 'map_segments', MAP());
    await tap(1, 'set', 'segment', 'Optical fiber');
    await step(2, 'find_names', CORNING());
    const named = await tap(2, 'set', 'names', ['GLW']);
    expect(named.body.thesis.parts.names.value).toEqual(['GLW']);
    await step(3, 'build_why', WHY());
    await tap(3, 'confirm', 'why');
    await tap(4, 'set', 'wrongIf', { option: 0, priceLines: [] });
    await tap(5, 'set', 'timeFrame', 'positional');
    const saved = await post({ action: 'adopt', sessionId: id, rev });
    expect(saved.statusCode, JSON.stringify(saved.body)).toBe(200);
    const list = env.doc(`watchlists/${saved.body.watchlistId}`);
    expect(list.tickers.map((t) => t.symbol)).toEqual(['GLW']);
    expect(list.status).toBe('committed');
    const confirm = sessionDoc(id).exchanges.find((e) => e.kind === 'confirm');
    expect(confirm.text).toContain('Corning Incorporated');
    const after = await get({ sessionId: id });
    expect(after.body.companies.supported.find((c) => c.symbol === 'GLW').eligibility).toBe('research');
  });
});

describe('the stored rows (section 6)', () => {
  async function toCorning() {
    const o = await openOwn();
    const id = o.session.sessionId;
    await mapped(id);
    return { id, step: await build(id, 2, 'find_names', CORNING()) };
  }
  it("a research company's row: name and symbol, its sector, no rank, its measures as kept, fetched once and reused", async () => {
    const { id, step } = await toCorning();
    const row = step.body.storedRows.find((r) => r.symbol === 'GLW');
    expect(row).toMatchObject({ symbol: 'GLW', name: 'Corning Incorporated', research: true, ranking: null, numbers: 'shown', reportsIn: 'USD', heldBack: [] });
    expect(row.peer.sector).toBe('Technology');
    expect(row.peer.metrics.revenueGrowthYOY).toBe(0.184);
    expect(state.fetches).toHaveLength(1);
    expect(state.fetches[0]).toContain('/fundamentals/GLW.US?api_token=<key>');
    const read = await get({ sessionId: id });
    expect(read.body.storedRows.find((r) => r.symbol === 'GLW')).toEqual(row);
    expect(state.fetches).toHaveLength(1); // kept for 7 days: no second call
    expect(env.doc('researchMeasures/GLW')).toMatchObject({ symbol: 'GLW', status: 'ok' });
  });
  it('a company reporting in another currency: the three measures held back, and the row says which currency', async () => {
    state.fetchAnswer = () => fundamentals('Corning Incorporated', 'TWD');
    const { step } = await toCorning();
    const row = step.body.storedRows.find((r) => r.symbol === 'GLW');
    expect(row).toMatchObject({ reportsIn: 'TWD', heldBack: ['fcfYield', 'fcfMargin', 'priceSalesTTM'] });
    for (const k of ['fcfYield', 'fcfMargin', 'priceSalesTTM']) expect(row.peer.metrics[k]).toBeNull();
  });
  it('a refused fetch (the provider fails) leaves the step intact: 200, the company supported, the row not available today', async () => {
    state.fetchAnswer = () => new Error('ECONNRESET');
    const { step } = await toCorning();
    expect(step.statusCode).toBe(200);
    expect(step.body.companies.supported.map((c) => c.symbol)).toEqual(['GLW']);
    expect(step.body.storedRows.find((r) => r.symbol === 'GLW')).toMatchObject({ numbers: 'not_available', peer: { metrics: null } });
  });
  it('an over-ceiling fetch leaves the step intact: no call, the row not available today', async () => {
    const day = new Date().toISOString().slice(0, 10);
    env.store.set(`researchFetchDays/${day}`, { day, fetches: 200, ceiling: 200, callsPerFetch: 10, symbols: {} });
    const { step } = await toCorning();
    expect(step.statusCode).toBe(200);
    expect(state.fetches).toEqual([]);
    expect(step.body.storedRows.find((r) => r.symbol === 'GLW')).toMatchObject({ numbers: 'not_available' });
  });
  it('no key in the environment: the fetch throws inside, and the step is intact', async () => {
    delete process.env.EODHD_API_KEY;
    const { step } = await toCorning();
    expect(step.statusCode).toBe(200);
    expect(step.body.storedRows.find((r) => r.symbol === 'GLW').numbers).toBe('not_available');
  });
  it('at most 10 research companies are fetched per investigation: the 11th row says its numbers were not fetched', async () => {
    const eleven = ['GLW', 'ANET', 'MRVL', 'COHR', 'CIEN', 'VRT', 'HPE', 'TSM', 'ASML', 'ARM', 'APH'];
    const { researchNameOf } = await import('../_utils/researchUniverse.js');
    state.fetchAnswer = (url) => fundamentals(researchNameOf(/fundamentals\/([^.?]+)/.exec(url)[1].replace(/-/g, '-')) ?? 'X');
    const o = await openOwn();
    const id = o.session.sessionId;
    await mapped(id);
    const findings = eleven.map((s, i) => ({ tempId: `c${i}`, kind: 'relationship', fact: `${researchNameOf(s)} supplies parts for AI data centers.`.replace(/[A-Z]{2,}/g, (w) => w.charAt(0) + w.slice(1).toLowerCase()), symbolCandidate: s, companyName: researchNameOf(s), support: { kind: 'retrieval', index: 0, from: [], reason: null }, at: null, supersedes: null }));
    const r = await build(id, 2, 'find_names', out({ reply: 'Several listed companies.', findings: findings.slice(0, 11) }));
    expect(r.statusCode, JSON.stringify(r.body)).toBe(200);
    expect(r.body.companies.supported).toHaveLength(11);
    const rows = r.body.storedRows;
    expect(rows.filter((x) => x.numbers === 'shown')).toHaveLength(RESEARCH_FETCHES_PER_INVESTIGATION);
    expect(rows.filter((x) => x.numbers === 'not_fetched').map((x) => x.symbol)).toEqual(['APH']);
    expect(state.fetches).toHaveLength(10);
    // a later read never fetches the eleventh either
    await get({ sessionId: id });
    expect(state.fetches).toHaveLength(10);
  });
  it('a game stock on a research session keeps its PR A row (sector and rank), never a research row', async () => {
    const o = await openOwn();
    const id = o.session.sessionId;
    await mapped(id);
    const r = await build(id, 2, 'find_names', out({
      reply: 'One listed company.',
      findings: [{ tempId: 'n1', kind: 'relationship', fact: 'Nvidia sells the accelerators most AI data centers buy.', symbolCandidate: 'NVDA', companyName: 'Nvidia', support: { kind: 'retrieval', index: 0, from: [], reason: null }, at: null, supersedes: null }],
    }));
    expect(r.body.storedRows).toEqual([{ symbol: 'NVDA', name: 'NVIDIA Corporation', peer: { sector: 'Technology', metrics: null, asOf: '2026-11-26T11:00:51.000Z' }, ranking: { rank: 2, of: 21, sector: 'Technology', asOf: '2026-11-26T11:00:51.000Z' } }]);
    expect(r.body.companies.supported[0].eligibility).toBe('eligible');
    expect(state.fetches).toEqual([]);
  });
});

describe("side by side: the founder's research session and another player's game-list session (section 9)", () => {
  it('do not affect each other: the same answer resolves Corning on one, and leaves it a lead on the other', async () => {
    const research = await openOwn('Corning glass', 'req-f');
    as(OTHER);
    const game = await openOwn('Corning glass', 'req-o');
    as(FOUNDER);
    await mapped(research.session.sessionId, 1);
    as(OTHER);
    await mapped(game.session.sessionId, 2);
    as(FOUNDER);
    const r = await build(research.session.sessionId, 3, 'find_names', CORNING());
    as(OTHER);
    const g = await build(game.session.sessionId, 4, 'find_names', CORNING());
    expect(r.body.companies.supported.map((c) => [c.symbol, c.eligibility])).toEqual([['GLW', 'research']]);
    expect(g.statusCode).toBe(200);
    expect(g.body.companies.supported).toEqual([]);
    expect(g.body.companies.leads).toEqual([expect.objectContaining({ name: 'Corning', symbol: null, unresolved: 'identity_unresolved' })]);
    expect('storedRows' in g.body).toBe(false);
    expect('universe' in sessionDoc(game.session.sessionId)).toBe(false);
  });
});
