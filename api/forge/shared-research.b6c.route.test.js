// api/forge/shared-research.b6c.route.test.js
//
// Shared Research B6c — THE SHELF AND THE AGENT, at the route, on the atomic
// in-memory Firestore double with the model and the search as seams (no network).
// Explore's one read, GET ?list=explore, gains two facts:
//   X-8  `last.question` (the research record's question, the one the investigation
//        was opened with; null when the record cannot be read) and `last.statement`
//        (for a saved one, the statement the save recorded on the session's adoption;
//        null when concluded, and for a save that recorded none). The record is taken
//        from the read's window when it is there, else read by id.
//   X-9  `agent`: { id, name, equippedList: { id, name } | null } | null — the agent
//        readRankedAgent returns (never a clone, never another player's), its name,
//        and the BaggerBomb list its next game carries. One agents query per read.
// The B6a rows (shared-research.b6a.route.test.js) hold with only these keys added.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeSrFirestore } from '../_utils/sharedResearch/__fixtures__/srFirestore.js';

const state = vi.hoisted(() => ({
  mode: 'on', builder: 'on', perGame: true, user: { uid: 'u1' }, db: null, turns: [], turnQueue: [], retrievals: [], retrievalQueue: [], logs: [],
}));
// The per-game loadout switch, read at call time (the founder's Q-3): a getter, so a row can turn it off.
vi.mock('../../src/config/perGameLoadoutFlags.js', () => ({ get PER_GAME_LOADOUT_ENABLED() { return state.perGame; } }));
vi.mock('../../src/config/sharedResearchFlags.js', () => ({
  SHARED_RESEARCH_MODES: Object.freeze(['off', 'allowlist', 'on']),
  get SHARED_RESEARCH_MODE() { return state.mode; },
  SHARED_RESEARCH_BUILDER_MODES: Object.freeze(['off', 'on']),
  get SHARED_RESEARCH_BUILDER_MODE() { return state.builder; },
}));
vi.mock('../_utils/callRecords/mode.js', () => ({ isCockpitOwnerAllowlisted: () => true }));
vi.mock('../_utils/hypothesisRecords/gate.js', () => ({ hypothesisRecordsOnFor: () => true }));
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => state.db }));
vi.mock('../_utils/security.js', () => ({ applySecurityMiddleware: () => false }));
vi.mock('../_utils/authMiddleware.js', () => ({
  requireAuth: async (req, res) => { if (!state.user) { res.status(401).json({ error: 'unauthorized' }); return null; } return state.user; },
}));
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
      return typeof next === 'function' ? next(args) : next;
    },
  };
});
vi.mock('../_utils/sharedResearch/retrieval.js', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    retrieve: async (args) => {
      state.retrievals.push(args);
      return state.retrievalQueue.shift() ?? { items: [], costDollars: 0, elapsedMs: 5, readAt: new Date().toISOString() };
    },
  };
});

const { default: handler } = await import('./shared-research.js');
const { resetUidRateLimits } = await import('../_utils/sharedResearch/gate.js');
const { EXPLORE_ENDED_READ, EXPLORE_DOCS_MAX, exploreLastOf } = await import('../_utils/sharedResearch/explore.js');
const { exploreAgentOf, rankedAgentOfDocs, partnerNameOf, equippedListOf } = await import('../_utils/sharedResearch/store.js');
const { openSessionOf } = await import('../_utils/sharedResearch/session.js');
const { emptyCard } = await import('../_utils/sharedResearch/thesis.js');
const { baggerbombLoadoutOf, bookIdOf } = await import('../../src/constants/perGameLoadout.js');
const { buildRecord, buildFinding, findingAppendPatch, FINDING_ID_PREFIX, researchWorkIdFor, manualFunnel, emptyTelemetry } = await import('../_utils/researchRecords/model.js');

const UID = 'u1';
/** The ranked agent: a stored BaggerBomb slot holding a list, and League fields naming ANOTHER list. */
const AGENT = {
  ownerId: UID, name: 'Atlas', archetype: 'contrarian', equippedWatchlistId: 'wl-league', equippedWatchlistName: 'League picks',
  loadouts: { baggerbomb: { archetype: 'momentum_chaser', book: { ref: { watchlistId: 'wl-bb' }, name: '  Grid builders  ', pin: null } } },
};
const FT_STORY = { headline: 'Switchgear backlogs stretch as data centers expand', reporterName: 'Kim', reporterBeat: 'Sector Strategist', publishedAt: '2026-11-12T13:00:00.000Z', primaryTicker: 'ETN', tickers: ['ETN', 'GEV'], status: 'published', type: 'sector' };
const EXPLORE = Object.freeze({
  id: 'ai-power-1', version: 3, status: 'published', publishedAt: '2026-11-18T13:00:00.000Z', lead: 'story',
  title: 'Power gear, not chips, sets the pace of the AI buildout', reporter: { name: 'Kim', beat: 'Sector Strategist' }, tickers: ['ETN', 'GEV'],
});
const ITEMS = [
  { index: 0, url: 'https://news.example.com/eaton', title: 'Eaton books data-center orders', host: 'news.example.com', publishedDate: '2026-11-06T00:00:00.000Z', highlights: ['Eaton said data-center orders rose.'] },
  { index: 1, url: 'https://news.example.com/gev', title: 'GE Vernova sells turbines to data centers', host: 'news.example.com', publishedDate: '2026-11-07T00:00:00.000Z', highlights: ['GE Vernova sells turbines.'] },
];
const Q1 = 'Who earns when data centers wait on power gear?';

const seed = (extra = {}, { agents = { 'agents/agent-1': AGENT } } = {}) => makeSrFirestore({
  ...agents,
  'fantasyTimesStories/story-1': FT_STORY,
  [`exploreStories/${EXPLORE.id}`]: EXPLORE,
  'peerRankings/ETN': { ticker: 'ETN', name: 'Eaton Corporation plc', sector: 'Industrials' },
  'peerRankings/GEV': { ticker: 'GEV', name: 'GE Vernova Inc.', sector: 'Industrials' },
  'peerRankings/NVDA': { ticker: 'NVDA', name: 'NVIDIA Corporation', sector: 'Technology' },
  ...extra,
});

const res = () => { const r = { statusCode: null, body: null, headers: {} }; r.status = (c) => { r.statusCode = c; return r; }; r.json = (b) => { r.body = b; return r; }; r.setHeader = (k, v) => { r.headers[k] = v; return r; }; return r; };
const post = async (body) => { resetUidRateLimits(); const r = res(); await handler({ method: 'POST', headers: {}, query: {}, body }, r); return r; };
const get = async (query) => { resetUidRateLimits(); const r = res(); await handler({ method: 'GET', headers: {}, query, body: undefined }, r); return r; };
const turnOk = (output) => ({ ok: true, output, usage: { input: 9000, output: 700 }, model: 'claude-sonnet-5-5', attempts: 1, elapsedMs: 900, costUsd: 0.025, stopReason: 'end_turn' });
const uuid = (n) => `9a8b7c6d-5e4f-4a3b-8c2d-${String(n).padStart(12, '0')}`;
let env;
const sessionDoc = (id) => env.doc(`sharedResearchSessions/${id}`);

beforeEach(() => {
  env = seed();
  Object.assign(state, { mode: 'on', builder: 'on', perGame: true, user: { uid: UID }, db: env.db, turns: [], turnQueue: [], retrievals: [], retrievalQueue: [], logs: [] });
});

const exploreRead = async () => {
  const r = await get({ list: 'explore' });
  expect(r.statusCode, JSON.stringify(r.body)).toBe(200);
  return r.body;
};
async function openExplore({ question = Q1, requestId = 'req-x1' } = {}) {
  const r = await post({ action: 'open', requestId, entry: { kind: 'item', itemRef: { recordKind: 'exploreStories', recordId: EXPLORE.id }, question } });
  expect(r.statusCode, JSON.stringify(r.body)).toBe(200);
  return r.body;
}
/** Counts every document read (query results and by-id gets) per collection, through a wrapper over the double. */
function countReads() {
  const counts = { docs: 0, byCollection: {}, gets: {}, queries: {} };
  const real = env.db;
  const bump = (bag, name, n) => { bag[name] = (bag[name] ?? 0) + n; };
  const wrapQ = (name, q) => ({
    ...q, where: (...a) => wrapQ(name, q.where(...a)), orderBy: (...a) => wrapQ(name, q.orderBy(...a)), limit: (n) => wrapQ(name, q.limit(n)),
    get: async () => { const snap = await q.get(); counts.docs += snap.docs.length; bump(counts.byCollection, name, snap.docs.length); bump(counts.queries, name, 1); return snap; },
    ...(q.doc ? { doc: (id) => { const d = q.doc(id); return { ...d, get: async () => { counts.docs += 1; bump(counts.byCollection, name, 1); bump(counts.gets, name, 1); return d.get(); } }; } } : {}),
  });
  state.db = { ...real, collection: (name) => wrapQ(name, real.collection(name)) };
  return counts;
}

// ── the thesis builder's path to a ready card, on an Explore story ─────────────────
const NV_ITEMS = [
  { index: 0, url: 'https://news.example.com/nvda-ai', title: 'Nvidia accelerators lead AI data centers', host: 'news.example.com', publishedDate: '2026-11-06T00:00:00.000Z', highlights: ['Nvidia sells the accelerators most AI data centers buy.'] },
  { index: 1, url: 'https://news.example.com/nvda-rev', title: 'Nvidia data-center revenue', host: 'news.example.com', publishedDate: '2026-11-07T00:00:00.000Z', highlights: ['Data-center sales were most of its revenue.'] },
  { index: 2, url: 'https://news.example.com/buyers', title: 'Large buyers design their own chips', host: 'news.example.com', publishedDate: '2026-11-08T00:00:00.000Z', highlights: ['Several large buyers design their own chips.'] },
];
const EMPTY = { reply: '', findings: [], companies: [], themeSuggestion: null, segments: [], why: null, wrongIfOptions: [], timeFramePick: null, pick: null };
const out = (over) => turnOk({ ...EMPTY, ...over });
const VERIFY = () => out({ reply: 'The story matches its source.', themeSuggestion: 'Data-center accelerators' });
const MAP = () => out({
  reply: 'Here is how the theme splits. The map is reasoning, not a ranking.',
  segments: [{ label: 'GPUs and accelerators', line: 'The chips that train and run models', refs: [] }, { label: 'Data-center power', line: 'Electricity and cooling for the buildings', refs: [] }],
  pick: { part: 'segment', value: 'GPUs and accelerators', reason: 'It is where sales tie most directly to the theme.', refs: [], reasons: [] },
});
const NAMES = () => out({
  reply: 'One listed company has a sourced connection to this segment.',
  findings: [{ tempId: 'n1', kind: 'relationship', fact: 'Nvidia sells the accelerators most AI data centers buy.', symbolCandidate: 'NVDA', companyName: 'Nvidia', support: { kind: 'retrieval', index: 0, from: [], reason: null }, at: null, supersedes: null }],
  companies: [{ companyName: 'Nvidia', symbolCandidate: 'NVDA', role: 'Supplier', relationshipRef: 'n1', openRef: null, claim: null }],
  pick: { part: 'names', value: 'NVDA', reason: 'It has the sourced connection.', refs: ['n1'], reasons: [] },
});
const WHY = () => out({
  reply: 'One reason holds up in the sources, and one point cuts against it.',
  findings: [
    { tempId: 'w1', kind: 'earnings_fact', fact: 'Nvidia said data-center sales were most of its revenue.', symbolCandidate: 'NVDA', companyName: 'Nvidia', support: { kind: 'retrieval', index: 1, from: [], reason: null }, at: null, supersedes: null },
    { tempId: 'w2', kind: 'coverage', fact: 'Several large buyers design their own chips.', symbolCandidate: null, companyName: null, support: { kind: 'retrieval', index: 2, from: [], reason: null }, at: null, supersedes: null },
  ],
  why: {
    shared: 'it sells the accelerators AI data centers are buying',
    reasons: [{ companyName: 'Nvidia', symbolCandidate: 'NVDA', text: 'Data-center sales are most of its revenue.', refs: ['w1'] }],
    against: { text: 'Several large buyers design their own chips.', refs: ['w2'] },
  },
  wrongIfOptions: [{ text: 'big buyers cut accelerator spending for two quarters', refs: [] }, { text: 'a big buyer switches to its own chips', refs: ['w2'] }],
  timeFramePick: { horizon: 'positional', reason: 'Spending plans run over several quarters.' },
  pick: { part: 'wrongIf', value: 'big buyers cut accelerator spending for two quarters', reason: 'It turns the point against into something to check.', refs: [], reasons: [] },
});
/** An Explore story opened as a thesis builder and worked to a ready card through the route. */
async function exploreToReady() {
  const o = await openExplore();
  const id = o.session.sessionId;
  let rev = o.thesis.rev;
  let n = 10;
  const step = async (goal, a) => {
    state.retrievalQueue.push({ items: NV_ITEMS, costDollars: 0.005, elapsedMs: 300, readAt: new Date().toISOString() });
    state.turnQueue.push(a);
    const r = await post({ action: 'step', sessionId: id, stepId: uuid(n++), intent: 'build', goal });
    expect(r.statusCode, JSON.stringify(r.body)).toBe(200);
    rev = r.body.thesis.rev;
  };
  const tap = async (op, part, value) => {
    const r = await post({ action: 'card', sessionId: id, opId: `1b2c3d4e-5f6a-4b7c-8d9e-${String(n++).padStart(12, '0')}`, rev, op, part, ...(value === undefined ? {} : { value }) });
    expect(r.statusCode, JSON.stringify(r.body)).toBe(200);
    rev = r.body.thesis.rev;
    return r;
  };
  await step('verify_source', VERIFY());
  await tap('confirm', 'theme');
  await step('map_segments', MAP());
  await tap('set', 'segment', 'GPUs and accelerators');
  await step('find_names', NAMES());
  await tap('set', 'names', ['NVDA']);
  await step('build_why', WHY());
  await tap('confirm', 'why');
  await tap('set', 'wrongIf', { option: 0, priceLines: [{ symbol: 'NVDA', level: 120 }] });
  const last = await tap('set', 'timeFrame', 'positional');
  expect(last.body.thesis.ready).toBe(true);
  return { id, rev, sentence: last.body.thesis.sentence };
}
const EDIT = "NVDA earns from GPUs and accelerators because it sells them to AI data centers. It's wrong if big buyers cut accelerator spending for two quarters. Positional · about 30 sessions.";

const twoCompanies = () => turnOk({
  reply: 'Eaton and GE Vernova both sell power equipment to data-center builders.',
  findings: [
    { tempId: 'e', kind: 'relationship', fact: 'Eaton sells switchgear to data-center builders.', symbolCandidate: 'ETN', companyName: 'Eaton', support: { kind: 'retrieval', index: 0, from: [], reason: null }, at: null, supersedes: null },
    { tempId: 'g', kind: 'relationship', fact: 'GE Vernova sells turbines to data centers.', symbolCandidate: 'GEV', companyName: 'GE Vernova', support: { kind: 'retrieval', index: 1, from: [], reason: null }, at: null, supersedes: null },
  ],
  summary: { text: 'Eaton sells switchgear to data-center builders; GE Vernova sells turbines to data centers.', basedOn: ['e', 'g'] },
  lines: { support: 'e', complication: null, missing: null },
  nextAction: { label: "Size Eaton's data-center sales", purpose: 'Significance is the weakest link.' },
  companies: [
    { companyName: 'Eaton', symbolCandidate: 'ETN', role: 'Supplier', relationshipRef: 'e', openRef: null, claim: null },
    { companyName: 'GE Vernova', symbolCandidate: 'GEV', role: 'Supplier', relationshipRef: 'g', openRef: null, claim: null },
  ],
});
/** An older-style idea (the ledger) saved through the route: one step, the preview, adopt. */
async function ledgerSave(sessionId) {
  state.retrievalQueue.push({ items: ITEMS, costDollars: 0.005, elapsedMs: 300, readAt: new Date().toISOString() });
  state.turnQueue.push(twoCompanies());
  expect((await post({ action: 'step', sessionId, stepId: uuid(1), intent: 'next' })).statusCode).toBe(200);
  const preview = (await get({ sessionId })).body.adoptPreview;
  const etn = preview.companies.find((c) => c.symbol === 'ETN');
  const r = await post({ action: 'adopt', sessionId, statement: etn.fragment, horizonEnum: 'positional', symbols: ['ETN'], previewRev: preview.previewRev });
  expect(r.statusCode, JSON.stringify(r.body)).toBe(200);
  return { watchlistId: r.body.watchlistId, statement: etn.fragment };
}

/**
 * One session and its record, written straight to the store (B6a's plant): the record carries the story's opening
 * coverage finding and the question `Question {n}`; a completed one is closed with its terminal reason and end time.
 */
function plant({ n, storyId, status = 'open', createdAt, updatedAt = createdAt, adoption = null, kind = 'exploreStories', builder = false, record: recordOver = {} }) {
  const sessionId = uuid(500 + n);
  const s = {
    ...openSessionOf({
      sessionId, userId: UID, requestId: `req-p${n}`, attribution: { agentId: 'agent-1' }, researchWorkId: researchWorkIdFor({ collection: 'sharedResearchSessions', id: sessionId }), nowIso: createdAt,
      entry: { kind: 'item', itemRef: { recordKind: kind, recordId: storyId }, names: [], ...(kind === 'exploreStories' ? { itemVersion: 1 } : {}) }, exchanges: [],
    }),
    status, updatedAt, adoption, stepsUsed: 0,
    ...(builder ? { shape: 'builder', thesis: emptyCard() } : {}),
  };
  const minted = buildRecord({
    researchWorkId: s.researchWorkId, userId: UID, origin: 'shared_research', host: { collection: 'sharedResearchSessions', id: sessionId }, createdAt,
    question: `Question ${n}`, funnel: manualFunnel(), budget: null, telemetry: emptyTelemetry(),
  });
  const coverage = buildFinding({
    kind: 'coverage', symbol: null, fact: `Story ${storyId}`, source: { recordKind: kind, recordId: storyId, label: 'FantasyTimes · Kim' },
    at: createdAt, asOf: null, status: 'unverified', statusReason: 'reporter_content',
  }, { findingId: `${FINDING_ID_PREFIX}${uuid(900 + n)}`, nowIso: createdAt });
  const record = { ...minted, ...findingAppendPatch(minted, coverage, { nowIso: createdAt }) };
  const ended = status === 'open' ? {} : {
    state: status === 'abandoned' ? 'abandoned' : 'completed',
    terminalReason: status === 'abandoned' ? 'user_close' : adoption ? 'saved_to_list' : 'concluded', endedAt: updatedAt,
  };
  env.store.set(`sharedResearchSessions/${sessionId}`, s);
  env.store.set(`researchWork/${s.researchWorkId}`, { ...record, ...ended, ...recordOver });
  return s;
}
const at = (minute) => new Date(Date.parse('2026-11-20T15:00:00.000Z') + minute * 60_000).toISOString();
/** 50 newer research records of another kind (FantasyTimes, concluded): they fill the read's window. */
const fillWindow = (from = 100) => { for (let n = from; n < from + 50; n++) plant({ n, storyId: `ft-${n}`, kind: 'fantasyTimesStories', status: 'completed', createdAt: at(n), updatedAt: at(n) }); };

// ── X-8 ────────────────────────────────────────────────────────────────────────

describe('X-8: last gains question and statement', () => {
  it('a saved thesis on an Explore story: the question it was opened with, and the statement the save recorded (the player\'s edit, not the composed sentence)', async () => {
    const { id, rev, sentence } = await exploreToReady();
    const r = await post({ action: 'adopt', sessionId: id, rev, statement: EDIT });
    expect(r.statusCode, JSON.stringify(r.body)).toBe(200);
    expect(EDIT).not.toBe(sentence);
    const { items } = await exploreRead();
    expect(items).toEqual([{
      itemRef: { recordKind: 'exploreStories', recordId: EXPLORE.id }, itemVersion: 3, open: null,
      last: { sessionId: id, ended: 'saved', at: sessionDoc(id).adoption.at, question: Q1, statement: EDIT },
    }]);
    // the session holds no question of its own: the record's is the one reported
    expect(JSON.stringify(sessionDoc(id))).not.toContain(Q1);
  }, 20_000);
  it('a saved thesis as composed: the statement is the composed sentence the save recorded', async () => {
    const { id, rev, sentence } = await exploreToReady();
    expect((await post({ action: 'adopt', sessionId: id, rev })).statusCode).toBe(200);
    expect((await exploreRead()).items[0].last).toMatchObject({ ended: 'saved', question: Q1, statement: sentence });
    expect(sessionDoc(id).adoption.statement).toBe(sentence);
  }, 20_000);
  it('the statement is the adoption\'s, never the card\'s sentence or the list\'s card: a recorded statement that differs from both is the one reported', async () => {
    const { id, rev, sentence } = await exploreToReady();
    const r = await post({ action: 'adopt', sessionId: id, rev, statement: EDIT });
    expect(r.statusCode).toBe(200);
    // the stored adoption alone moves; the card's composed sentence and the list's saved card keep theirs
    env.store.set(`sharedResearchSessions/${id}`, { ...sessionDoc(id), adoption: { ...sessionDoc(id).adoption, statement: 'RECORDED-ON-ADOPTION' } });
    const list = env.doc(`watchlists/${r.body.watchlistId}`);
    expect(JSON.stringify(list)).toContain(EDIT);
    expect(sentence).not.toBe('RECORDED-ON-ADOPTION');
    expect((await exploreRead()).items[0].last.statement).toBe('RECORDED-ON-ADOPTION');
  }, 20_000);
  it('the record in the read\'s window is taken from it — no by-id read; one pushed out of the window is read by id, once', async () => {
    const saved = plant({ n: 1, storyId: EXPLORE.id, status: 'completed', createdAt: at(1), updatedAt: at(2), adoption: { watchlistId: 'wl-1', version: 1, at: at(2), statement: 'Saved one.' } });
    const inWindow = countReads();
    expect((await exploreRead()).items[0].last).toEqual({ sessionId: saved.sessionId, ended: 'saved', at: at(2), question: 'Question 1', statement: 'Saved one.' });
    expect(inWindow.gets.researchWork ?? 0).toBe(0);
    state.db = env.db;
    fillWindow();
    const outside = countReads();
    expect((await exploreRead()).items[0].last).toEqual({ sessionId: saved.sessionId, ended: 'saved', at: at(2), question: 'Question 1', statement: 'Saved one.' });
    expect(outside.gets.researchWork).toBe(1);
  });
  it('a concluded one (a real close): the question, statement null', async () => {
    const o = await openExplore();
    expect((await post({ action: 'close', sessionId: o.session.sessionId, reason: 'concluded' })).statusCode).toBe(200);
    expect((await exploreRead()).items[0].last).toMatchObject({ ended: 'concluded', question: Q1, statement: null });
  });
  it('a concluded one never carries a statement, even beside a stray adoption field that is not a save', async () => {
    plant({ n: 1, storyId: EXPLORE.id, status: 'completed', createdAt: at(1), updatedAt: at(2), adoption: { statement: 'STRAY' }, builder: true });
    expect((await exploreRead()).items[0].last).toMatchObject({ ended: 'concluded', question: 'Question 1', statement: null });
  });
  it('an older-style idea save (the ledger, a real save): the question, statement null — the idea holds its statement, the session none', async () => {
    state.builder = 'off';
    const o = await openExplore();
    const saved = await ledgerSave(o.session.sessionId);
    expect(env.doc(`watchlists/${saved.watchlistId}/hypothesisVersions/v1`).statement).toBe(saved.statement);
    expect((await exploreRead()).items[0].last).toEqual({ sessionId: o.session.sessionId, ended: 'saved', at: sessionDoc(o.session.sessionId).adoption.at, question: Q1, statement: null });
  });
  it('a thesis saved before B6a (its adoption has no statement; its list and version do): statement null', async () => {
    const s = plant({ n: 1, storyId: EXPLORE.id, status: 'completed', createdAt: at(1), updatedAt: at(2), adoption: { watchlistId: 'wl-old', version: 1, at: at(2) }, builder: true });
    env.store.set('watchlists/wl-old', { userId: UID, name: 'Old thesis', thesisCard: { statement: 'CARD-STATEMENT' } });
    env.store.set('watchlists/wl-old/hypothesisVersions/v1', { statement: 'VERSION-STATEMENT' });
    expect((await exploreRead()).items[0].last).toEqual({ sessionId: s.sessionId, ended: 'saved', at: at(2), question: 'Question 1', statement: null });
  });
  it('a blank recorded statement is no statement: null', async () => {
    plant({ n: 1, storyId: EXPLORE.id, status: 'completed', createdAt: at(1), updatedAt: at(2), adoption: { watchlistId: 'wl-1', version: 1, at: at(2), statement: '' } });
    expect((await exploreRead()).items[0].last.statement).toBeNull();
  });
  it('an unreadable record: question null — a missing record, and another player\'s (the session still reported)', async () => {
    const missing = plant({ n: 1, storyId: EXPLORE.id, status: 'completed', createdAt: at(1), updatedAt: at(2) });
    env.store.delete(`researchWork/${missing.researchWorkId}`);
    const foreign = plant({ n: 2, storyId: 'ai-power-2', status: 'completed', createdAt: at(3), updatedAt: at(4), adoption: { watchlistId: 'wl-2', version: 1, at: at(4), statement: 'Kept.' }, record: { userId: 'u2' } });
    const { items } = await exploreRead();
    expect(items.map((i) => i.last)).toEqual([
      { sessionId: foreign.sessionId, ended: 'saved', at: at(4), question: null, statement: 'Kept.' },
      { sessionId: missing.sessionId, ended: 'concluded', at: at(2), question: null, statement: null },
    ]);
  });
  it('the question is the record\'s, never the story\'s title or a session field', async () => {
    const s = plant({ n: 1, storyId: EXPLORE.id, status: 'completed', createdAt: at(1), updatedAt: at(2), record: { question: 'The record\'s own question' } });
    env.store.set(`sharedResearchSessions/${s.sessionId}`, { ...sessionDoc(s.sessionId), question: 'SESSION-QUESTION', frame: { question: 'FRAME-QUESTION', check: null, notEstablished: [] } });
    expect((await exploreRead()).items[0].last.question).toBe('The record\'s own question');
  });
  it('the bound counted exactly: 221 documents with the quota, plus the agents query (one agent seeded); the last-ended records outside the window are 30, EXPLORE_ENDED_READ', async () => {
    // 40 open (the open query takes the first 30; their records are outside the window), 40 completed (the completed
    // query takes the first 30; their records are outside the window), then 50 completed in the window.
    for (let n = 0; n < 40; n++) plant({ n, storyId: `story-open-${n}`, createdAt: at(n) });
    for (let n = 40; n < 80; n++) plant({ n, storyId: `story-done-${n}`, status: 'completed', createdAt: at(n), updatedAt: at(n), adoption: { watchlistId: `wl-${n}`, version: 1, at: at(n), statement: `S${n}` } });
    for (let n = 80; n < 130; n++) plant({ n, storyId: `story-new-${n}`, status: 'completed', createdAt: at(n), updatedAt: at(n) });
    const counts = countReads();
    const writes = env.writes.length;
    const b = await exploreRead();
    expect(EXPLORE_DOCS_MAX).toBe(221);
    expect(counts.docs).toBe(EXPLORE_DOCS_MAX + 1);
    expect(counts.gets.researchWork).toBe(30 + EXPLORE_ENDED_READ); // the open ones' and the last-ended ones' records by id
    expect(counts.byCollection.agents).toBe(1);
    const lasts = b.items.filter((i) => i.last).map((i) => i.last);
    expect(lasts).toHaveLength(30 + 50);
    // every last's question is its OWN record's (review H-3 iii): the planted session `uuid(500 + n)` asks `Question n`
    const nOf = (sessionId) => Number(sessionId.slice(-12)) - 500;
    expect(lasts.every((l) => l.question === `Question ${nOf(l.sessionId)}`)).toBe(true);
    expect(lasts.filter((l) => l.statement !== null).every((l) => l.statement === `S${nOf(l.sessionId)}`)).toBe(true);
    expect(lasts.filter((l) => l.statement !== null)).toHaveLength(30);
    expect(env.writes.length).toBe(writes);
  });
  it('pure: exploreLastOf with no record reads no question; a concluded session\'s statement is null', () => {
    const saved = { sessionId: 's', updatedAt: at(1), adoption: { watchlistId: 'w', at: at(1), statement: 'Kept.' } };
    expect(exploreLastOf(saved)).toEqual({ sessionId: 's', ended: 'saved', at: at(1), question: null, statement: 'Kept.' });
    expect(exploreLastOf(saved, { question: 'Q' }).question).toBe('Q');
    expect(exploreLastOf({ sessionId: 's', updatedAt: at(2), adoption: null }, { question: 'Q' })).toEqual({ sessionId: 's', ended: 'concluded', at: at(2), question: 'Q', statement: null });
  });
});

// ── X-9 ────────────────────────────────────────────────────────────────────────

describe('X-9: the read gains agent', () => {
  const reseed = (agents) => { env = seed({}, { agents }); state.db = env.db; };

  it('a ranked agent with a stored BaggerBomb slot holding a list: its id, name, and the slot\'s list (trimmed) — never the League fields\' list', async () => {
    const b = await exploreRead();
    expect(b.agent).toEqual({ id: 'agent-1', name: 'Atlas', equippedList: { id: 'wl-bb', name: 'Grid builders' } });
    expect(b.agent.equippedList.id).toBe(bookIdOf(baggerbombLoadoutOf({ ...AGENT, id: 'agent-1' }).book));
  });
  it('the default slot (no stored slot): the list from the League fields', async () => {
    reseed({ 'agents/agent-1': { ownerId: UID, name: 'Atlas', archetype: 'contrarian', equippedWatchlistId: 'wl-league', equippedWatchlistName: ' League picks ' } });
    expect((await exploreRead()).agent).toEqual({ id: 'agent-1', name: 'Atlas', equippedList: { id: 'wl-league', name: 'League picks' } });
  });
  it('no list: equippedList null — a stored slot without a book, and a default with no equipped list', async () => {
    reseed({ 'agents/agent-1': { ...AGENT, loadouts: { baggerbomb: { archetype: 'momentum_chaser', book: null } } } });
    expect((await exploreRead()).agent).toEqual({ id: 'agent-1', name: 'Atlas', equippedList: null });
    reseed({ 'agents/agent-1': { ownerId: UID, name: 'Atlas', archetype: 'contrarian' } });
    expect((await exploreRead()).agent).toEqual({ id: 'agent-1', name: 'Atlas', equippedList: null });
    reseed({ 'agents/agent-1': { ...AGENT, loadouts: { baggerbomb: { archetype: 'momentum_chaser', book: { ref: { watchlistId: '   ' }, name: 'Named but no id', pin: null } } } } });
    expect((await exploreRead()).agent.equippedList).toBeNull();
  });
  it('a list with an id and a blank name: { id, name: null }', async () => {
    reseed({ 'agents/agent-1': { ...AGENT, loadouts: { baggerbomb: { archetype: 'momentum_chaser', book: { ref: { watchlistId: 'wl-bb' }, name: '   ', pin: null } } } } });
    expect((await exploreRead()).agent.equippedList).toEqual({ id: 'wl-bb', name: null });
  });
  it('a blank name: name null (the sheet\'s fallback then applies)', async () => {
    reseed({ 'agents/agent-1': { ...AGENT, name: '   ' } });
    expect((await exploreRead()).agent).toEqual({ id: 'agent-1', name: null, equippedList: { id: 'wl-bb', name: 'Grid builders' } });
    expect(partnerNameOf({ name: '   ' })).toBeNull();
  });
  it('training and casual clones are never chosen: the ranked agent among them; with clones only, null', async () => {
    reseed({
      'agents/a-train': { ...AGENT, name: 'Trainee', isTrainingClone: true, loadouts: { baggerbomb: { archetype: 'x', book: { ref: { watchlistId: 'wl-train' }, name: 'Clone list', pin: null } } } },
      'agents/a-casual': { ...AGENT, name: 'Casual', isCasualClone: true },
      'agents/agent-1': AGENT,
    });
    expect((await exploreRead()).agent).toEqual({ id: 'agent-1', name: 'Atlas', equippedList: { id: 'wl-bb', name: 'Grid builders' } });
    reseed({ 'agents/a-train': { ...AGENT, isTrainingClone: true }, 'agents/a-casual': { ...AGENT, isCasualClone: true } });
    expect((await exploreRead()).agent).toBeNull();
  });
  it('no ranked agent: agent null, still 200 with the quota and the items (nothing refused for it)', async () => {
    reseed({});
    const o = await post({ action: 'open', requestId: 'req-none', entry: { kind: 'item', itemRef: { recordKind: 'exploreStories', recordId: EXPLORE.id }, question: Q1 } });
    expect([o.statusCode, o.body.error]).toEqual([503, 'attribution_unavailable']); // open's rule: no ranked agent, no investigation
    plant({ n: 1, storyId: EXPLORE.id, status: 'completed', createdAt: at(1), updatedAt: at(2) });
    const r = await get({ list: 'explore' });
    expect(r.statusCode).toBe(200);
    expect(Object.keys(r.body)).toEqual(['quota', 'items', 'agent']);
    expect(r.body.agent).toBeNull();
    expect(r.body.items).toHaveLength(1);
  });
  it('another player\'s agent is never returned: only theirs → null; theirs and mine → mine', async () => {
    reseed({ 'agents/agent-2': { ...AGENT, ownerId: 'u2', name: 'Other' } });
    expect((await exploreRead()).agent).toBeNull();
    reseed({ 'agents/agent-2': { ...AGENT, ownerId: 'u2', name: 'Other' }, 'agents/agent-1': AGENT });
    expect((await exploreRead()).agent.id).toBe('agent-1');
    // the owner check is the shaping's too (attributionIn's): a document that is not the caller's is never shaped
    expect(exploreAgentOf({ ...AGENT, id: 'agent-2', ownerId: 'u2' }, UID)).toBeNull();
    expect(exploreAgentOf(null, UID)).toBeNull();
  });
  it('it is readRankedAgent\'s choice, exactly: the same document the rule picks over the same docs', async () => {
    reseed({ 'agents/a-casual': { ...AGENT, isCasualClone: true }, 'agents/agent-1': AGENT, 'agents/agent-3': { ...AGENT, name: 'Second ranked' } });
    const docs = (await env.db.collection('agents').where('ownerId', '==', UID).get()).docs;
    expect((await exploreRead()).agent.id).toBe(rankedAgentOfDocs(docs).id);
  });
  it('it is the agent `open` stamps (review H-3 i): an investigation opened through the route carries the read\'s agent id', async () => {
    reseed({ 'agents/a-train': { ...AGENT, isTrainingClone: true }, 'agents/a-casual': { ...AGENT, isCasualClone: true }, 'agents/agent-1': AGENT, 'agents/agent-3': { ...AGENT, name: 'Second ranked' } });
    const o = await openExplore();
    const read = await exploreRead();
    expect(sessionDoc(o.session.sessionId).attribution.agentId).toBe(read.agent.id);
    expect(read.agent.id).toBe('agent-1');
  });
  it('one agents query per read, and nothing else read for the agent (no by-id agent read, no list read)', async () => {
    const counts = countReads();
    await exploreRead();
    expect(counts.queries.agents).toBe(1);
    expect(counts.gets.agents ?? 0).toBe(0);
    expect(counts.byCollection.watchlists ?? 0).toBe(0);
  });
  it('no access: 404 disabled before the agent is read', async () => {
    state.mode = 'off';
    const r = await get({ list: 'explore' });
    expect([r.statusCode, r.body]).toEqual([404, { error: 'disabled' }]);
    expect(env.reads).toEqual([]);
  });
});

// ── Q-3: the list follows the per-game loadout switch ──────────────────────────

describe('Q-3: equippedList follows PER_GAME_LOADOUT_ENABLED, read at call time', () => {
  it('on: the BaggerBomb slot\'s book; off: the League book (the ranked record\'s own fields) — the list equip then replaces; flipped between two reads', async () => {
    // AGENT: a stored slot holding "Grid builders", League fields naming "League picks"
    expect((await exploreRead()).agent.equippedList).toEqual({ id: 'wl-bb', name: 'Grid builders' });
    state.perGame = false;
    expect((await exploreRead()).agent.equippedList).toEqual({ id: 'wl-league', name: 'League picks' });
    state.perGame = true;
    expect((await exploreRead()).agent.equippedList).toEqual({ id: 'wl-bb', name: 'Grid builders' });
  });
  it('off with no League list: null, though a stale slot holds one', async () => {
    env = seed({}, { agents: { 'agents/agent-1': { ...AGENT, equippedWatchlistId: null, equippedWatchlistName: null } } });
    state.db = env.db;
    state.perGame = false;
    expect((await exploreRead()).agent).toEqual({ id: 'agent-1', name: 'Atlas', equippedList: null });
  });
  it('pure: equippedListOf reads the switch each call', () => {
    state.perGame = true;
    expect(equippedListOf(AGENT)).toEqual({ id: 'wl-bb', name: 'Grid builders' });
    state.perGame = false;
    expect(equippedListOf(AGENT)).toEqual({ id: 'wl-league', name: 'League picks' });
    expect(equippedListOf(null)).toBeNull();
  });
});

// ── Q-4: GET ?sessionId= on a saved thesis carries equippedList ─────────────────

describe('Q-4: GET ?sessionId= on a SAVED thesis-builder session gains equippedList; every other answer is unchanged', () => {
  const BUILDER_KEYS = ['session', 'record', 'companies', 'thesis', 'storedRows', 'previous', 'quota'];
  const LEDGER_KEYS = ['session', 'record', 'companies', 'adoptPreview', 'storedRows', 'previous', 'quota'];
  async function savedThesis() {
    const { id, rev } = await exploreToReady();
    const r = await post({ action: 'adopt', sessionId: id, rev, statement: EDIT });
    expect(r.statusCode, JSON.stringify(r.body)).toBe(200);
    return { id, watchlistId: r.body.watchlistId };
  }
  const read = async (sessionId) => {
    const r = await get({ sessionId });
    expect(r.statusCode, JSON.stringify(r.body)).toBe(200);
    return r.body;
  };
  const setAgent = (data) => env.store.set('agents/agent-1', data);

  it('another list equipped: { id, name } of that list, after every key the answer had; one agents query', async () => {
    const { id } = await savedThesis();
    const counts = countReads();
    const b = await read(id);
    expect(Object.keys(b)).toEqual([...BUILDER_KEYS, 'equippedList']);
    expect(b.equippedList).toEqual({ id: 'wl-bb', name: 'Grid builders' });
    expect(counts.queries.agents).toBe(1);
    expect(counts.gets.agents ?? 0).toBe(0);
  }, 20_000);
  it('this thesis\'s own list equipped: its id, equal to the saved watchlistId (the screen then says it is equipped)', async () => {
    const { id, watchlistId } = await savedThesis();
    setAgent({ ...AGENT, loadouts: { baggerbomb: { archetype: 'momentum_chaser', book: { ref: { watchlistId }, name: '', pin: null } } } });
    expect((await read(id)).equippedList).toEqual({ id: watchlistId, name: null });
  }, 20_000);
  it('another list with no name: { id, name: null }', async () => {
    const { id } = await savedThesis();
    setAgent({ ...AGENT, loadouts: { baggerbomb: { archetype: 'momentum_chaser', book: { ref: { watchlistId: 'wl-other' }, name: '  ', pin: null } } } });
    expect((await read(id)).equippedList).toEqual({ id: 'wl-other', name: null });
  }, 20_000);
  it('no list equipped, or no ranked agent: null (the key still there)', async () => {
    const { id } = await savedThesis();
    setAgent({ ...AGENT, loadouts: { baggerbomb: { archetype: 'momentum_chaser', book: null } } });
    expect((await read(id)).equippedList).toBeNull();
    env.store.delete('agents/agent-1');
    const b = await read(id);
    expect(Object.keys(b)).toContain('equippedList');
    expect(b.equippedList).toBeNull();
  }, 20_000);
  it('Q-3 holds here too: with the switch off, the League book', async () => {
    const { id } = await savedThesis();
    state.perGame = false;
    expect((await read(id)).equippedList).toEqual({ id: 'wl-league', name: 'League picks' });
  }, 20_000);
  it('never a clone\'s list: the ranked agent\'s, with a clone seeded first', async () => {
    const { id } = await savedThesis();
    // the double answers in write order: re-write the ranked agent after the clone, so the clone comes first
    const ranked = env.doc('agents/agent-1');
    env.store.delete('agents/agent-1');
    env.store.set('agents/a-train', { ...AGENT, isTrainingClone: true, loadouts: { baggerbomb: { archetype: 'x', book: { ref: { watchlistId: 'wl-clone' }, name: 'Clone list', pin: null } } } });
    env.store.set('agents/agent-1', ranked);
    expect((await read(id)).equippedList).toEqual({ id: 'wl-bb', name: 'Grid builders' });
  }, 20_000);
  it('every other answer is unchanged, with no agents query: an open builder, a concluded builder, an open ledger, a saved ledger idea', async () => {
    const o = await openExplore();
    let counts = countReads();
    expect(Object.keys(await read(o.session.sessionId))).toEqual(BUILDER_KEYS);
    expect(counts.queries.agents ?? 0).toBe(0);
    state.db = env.db;
    expect((await post({ action: 'close', sessionId: o.session.sessionId, reason: 'concluded' })).statusCode).toBe(200);
    counts = countReads();
    expect(Object.keys(await read(o.session.sessionId))).toEqual(BUILDER_KEYS);
    expect(counts.queries.agents ?? 0).toBe(0);
    state.db = env.db;
    state.builder = 'off';
    const l = await openExplore({ requestId: 'req-ledger' });
    counts = countReads();
    expect(Object.keys(await read(l.session.sessionId))).toEqual(LEDGER_KEYS);
    expect(counts.queries.agents ?? 0).toBe(0);
    state.db = env.db;
    await ledgerSave(l.session.sessionId);
    counts = countReads();
    expect(Object.keys(await read(l.session.sessionId))).toEqual(LEDGER_KEYS);
    expect(counts.queries.agents ?? 0).toBe(0);
  }, 20_000);
});
