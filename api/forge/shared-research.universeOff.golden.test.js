// api/forge/shared-research.universeOff.golden.test.js
//
// Build 3b (Work an idea accepts research companies), build prompt section 9, "Off means off": with
// SHARED_RESEARCH_UNIVERSE_MODE 'off', every Work an idea route answer, every prompt and every stored record is
// byte-identical to main after PR A.
//
// THE GOLDEN WAS WRITTEN BY THIS FILE AT PR A'S TIP (claude/work-an-idea-card-and-currency @ e6bee4f5), before any PR B
// code existed:
//   GENERATE_UNIVERSE_OFF_GOLDEN=1 npx vitest run api/forge/shared-research.universeOff.golden.test.js
// Five investigations run through the real route with the ids and the clock pinned, the model and the search as fixed
// seams: a thesis builder from the player's own words — a failed step, then to a saved thesis (a stale save refused
// first) and the read after it; a builder from a story; a ledger from a story — a step, an examine step, a direction
// step, a replayed step, a failed step, a card op refused, its preview, the save and the read after; a framed ledger,
// its step and its close; a SignalDrop; then the open list and Explore's read. Everything they answer, every model
// call's system and user text and schema, every search's arguments, every shadow-log record, every write and every
// stored document at the end are compared, key by key, with the golden. (Review L1-2 and L1-3 widened it to the shadow
// log and these paths; it was regenerated at PR A's tip, as before, with the widened file.)
//
// The runs that compare (PR B adds the switch; at PR A's tip the mock's extra export is simply unread):
//   - the switch 'off';
//   - the switch 'founder' for a player who is not on the founder list (another player's game-list session);
//   - the switch 'on' turned on after each investigation opened (a game-list session opened before the switch
//     behaves the same after it is on: the universe is stamped at open, never re-read).
// This file names nothing PR B adds, so it ran unchanged at PR A's tip.

import { readFileSync, writeFileSync } from 'node:fs';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeSrFirestore } from '../_utils/sharedResearch/__fixtures__/srFirestore.js';

const state = vi.hoisted(() => ({
  mode: 'on', builder: 'on', universe: 'off', user: { uid: 'u1' }, db: null, ids: 0, turns: [], turnQueue: [], retrievals: [], retrievalQueue: [],
  openWith: 'off', thenUniverse: null, logs: [],
}));
vi.mock('node:crypto', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, randomUUID: () => `00000000-0000-4000-8000-${String(++state.ids).padStart(12, '0')}` };
});
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
vi.mock('../_utils/shadowLogger.js', () => ({ logConversation: async (r) => { state.logs.push(structuredClone(r)); return true; } }));
vi.mock('@vercel/functions', () => ({ waitUntil: (p) => p }));
vi.mock('../_utils/sharedResearch/modelTurn.js', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    runTurn: async (args) => {
      state.turns.push({ kind: args.kind, system: args.system, user: args.user, schema: JSON.stringify(args.schema) });
      const next = state.turnQueue.shift();
      if (!next) throw new Error('test: no model answer queued');
      return structuredClone(next);
    },
  };
});
vi.mock('../_utils/sharedResearch/retrieval.js', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    retrieve: async (args) => {
      state.retrievals.push(structuredClone(args));
      const next = state.retrievalQueue.shift();
      return structuredClone(next ?? { items: [], costDollars: 0, elapsedMs: 5, readAt: new Date().toISOString() });
    },
  };
});

const { default: handler } = await import('./shared-research.js');
const { resetUidRateLimits } = await import('../_utils/sharedResearch/gate.js');

const GOLDEN = new URL('./__fixtures__/universeOff.prA.json', import.meta.url);
const NOW = '2026-11-27T15:00:00.000Z';
const UID = 'u1';
const COMPUTED = '2026-11-26T11:00:51.000Z';

const seed = () => makeSrFirestore({
  'agents/agent-1': { ownerId: UID, name: 'Atlas', archetype: 'contrarian', loadouts: { baggerbomb: { archetype: 'momentum_chaser', book: null } } },
  'fantasyTimesStories/story-1': { headline: 'Data centers push accelerator orders higher', reporterName: 'Kim', reporterBeat: 'Sector Strategist', publishedAt: '2026-11-12T13:00:00.000Z', primaryTicker: 'NVDA', tickers: ['NVDA', 'AMD', 'QZXW'], status: 'published', type: 'sector' },
  // peerRankings as the rankings job writes it (PR A's read), for the names in scope and the names the steps use
  'peerRankings/NVDA': { ticker: 'NVDA', name: 'NVIDIA Corporation', sectorId: 'XLK', sectorName: 'Technology', compositeScore: 81.2, compositeRank: 2, totalPeers: 21, tier: 'Strong', metrics: { grossMargin: 0.75 }, computedAt: new Date(COMPUTED) },
  'peerRankings/AMD': { ticker: 'AMD', name: 'Advanced Micro Devices, Inc.', sectorId: 'XLK', sectorName: 'Technology', compositeRank: null, totalPeers: 21, computedAt: new Date(COMPUTED) },
  'estimatesCache/latest': { computedAt: '2026-11-26T06:00:00.000Z', stocks: { NVDA: { forwardEstimates: { currentYear: { growth: '0.52' }, nextYear: { growth: '0.31', numAnalysts: '40' } } } } },
  'ingestedClaims/c1': { ticker: 'NVDA', sourceDate: '2026-11-20' },
  [`users/${UID}/signalDrops/drop-1`]: { dropId: 'drop-1', userId: UID, input: { type: 'text', text: 'NVDA keeps selling out of accelerators', note: null }, parse: { topic: 'accelerator supply', dataPoints: ['NVDA backlog up', 'lead times past a year'] }, validation: { validated: [{ symbol: 'NVDA', sectorId: 'XLK' }], unsupported: [] }, shouldBailout: false, droppedAt: '2026-11-27T12:00:00.000Z' },
});

const res = () => { const r = { statusCode: null, body: null }; r.status = (c) => { r.statusCode = c; return r; }; r.json = (b) => { r.body = b; return r; }; r.setHeader = () => r; return r; };
const call = async (req) => { resetUidRateLimits(); const r = res(); await handler({ headers: {}, query: {}, ...req }, r); return { status: r.statusCode, body: r.body }; };
const post = (body) => call({ method: 'POST', body });
const get = (query) => call({ method: 'GET', query });
/**
 * Called just before an investigation opens (or frames): the switch is the run's opening value. The player's day is
 * cleared first, so the five investigations fit the day's three (the quota's own rows live in the route suites).
 */
const opening = () => { state.env.store.delete(`sharedResearchQuota/${UID}`); state.universe = state.openWith; };
/** Called once it has opened: the "switch turned on after open" run turns it on here, for every later request. */
const opened = () => { if (state.thenUniverse) state.universe = state.thenUniverse; };

const turnOk = (output) => ({ ok: true, output, usage: { input: 8000, output: 600 }, model: 'claude-sonnet-5-5', attempts: 1, elapsedMs: 900, costUsd: 0.022, stopReason: 'end_turn' });
const ITEMS = [
  { index: 0, url: 'https://news.example.com/nvda-ai', title: 'Nvidia accelerators lead AI data centers', host: 'news.example.com', publishedDate: '2026-11-06T00:00:00.000Z', highlights: ['Nvidia sells the accelerators most AI data centers buy.'] },
  { index: 1, url: 'https://news.example.com/nvda-rev', title: 'Nvidia data-center revenue', host: 'news.example.com', publishedDate: '2026-11-07T00:00:00.000Z', highlights: ['Data-center sales were most of its revenue.'] },
  { index: 2, url: 'https://news.example.com/buyers', title: 'Large buyers design their own chips; GLW and TSM named', host: 'news.example.com', publishedDate: '2026-11-08T00:00:00.000Z', highlights: ['Several large buyers design their own chips.', 'Corning (GLW) supplies glass; TSM makes the chips.'] },
];
const search = () => ({ items: ITEMS, costDollars: 0.005, elapsedMs: 300, readAt: new Date().toISOString() });
const EMPTY = { reply: '', findings: [], companies: [], themeSuggestion: null, segments: [], why: null, wrongIfOptions: [], timeFramePick: null, pick: null };
const out = (over) => turnOk({ ...EMPTY, ...over });
const MAP = () => out({
  reply: 'Here is how the theme splits. The map is reasoning, not a ranking.',
  segments: [{ label: 'GPUs and accelerators', line: 'The chips that train and run models', refs: [] }, { label: 'Data-center power', line: 'Electricity and cooling for the buildings', refs: [] }],
  pick: { part: 'segment', value: 'GPUs and accelerators', reason: 'It is where sales tie most directly to the theme.', refs: [], reasons: [] },
});
// The names step also writes what a research session reads differently: Corning named in words with no symbol, a
// ticker-shaped research symbol written in capitals in a fact (GLW), "Google" in words, and a word that is a directory
// symbol ("Well"). On a game-list session each stays exactly as main treats it.
const NAMES = () => out({
  reply: 'One listed company has a sourced connection to this segment.',
  findings: [
    { tempId: 'n1', kind: 'relationship', fact: 'Nvidia sells the accelerators most AI data centers buy.', symbolCandidate: 'NVDA', companyName: 'Nvidia', support: { kind: 'retrieval', index: 0, from: [], reason: null }, at: null, supersedes: null },
    { tempId: 'n2', kind: 'relationship', fact: 'Corning supplies the glass for the fiber links inside AI data centers.', symbolCandidate: null, companyName: 'Corning', support: { kind: 'retrieval', index: 2, from: [], reason: null }, at: null, supersedes: null },
    { tempId: 'n3', kind: 'relationship', fact: 'Google designs its own accelerator chips.', symbolCandidate: null, companyName: 'Google', support: { kind: 'retrieval', index: 2, from: [], reason: null }, at: null, supersedes: null },
    { tempId: 'n4', kind: 'product', fact: 'Well run data centers buy accelerators in bulk.', symbolCandidate: null, companyName: 'Well', support: { kind: 'inference', index: null, from: ['n1'], reason: null }, at: null, supersedes: null },
  ],
  companies: [
    { companyName: 'Nvidia', symbolCandidate: 'NVDA', role: 'Supplier', relationshipRef: 'n1', openRef: null, claim: null },
    { companyName: 'Corning', symbolCandidate: null, role: 'Supplier', relationshipRef: 'n2', openRef: null, claim: null },
    { companyName: 'Google', symbolCandidate: null, role: 'Customer', relationshipRef: 'n3', openRef: null, claim: null },
  ],
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
const VERIFY = () => out({
  reply: 'The story rests on Nvidia\'s own results.',
  findings: [{ tempId: 'v1', kind: 'release', fact: 'Nvidia reported record data-center revenue.', symbolCandidate: 'NVDA', companyName: 'Nvidia', support: { kind: 'retrieval', index: 1, from: [], reason: null }, at: '2026-11-07', supersedes: null }],
  themeSuggestion: 'AI accelerators',
});
const LEDGER_STEP = () => turnOk({
  reply: 'Nvidia and AMD both sell accelerators to data-center builders; Corning supplies glass.',
  findings: [
    { tempId: 'e', kind: 'relationship', fact: 'Nvidia sells accelerators to data-center builders.', symbolCandidate: 'NVDA', companyName: 'Nvidia', support: { kind: 'retrieval', index: 0, from: [], reason: null }, at: null, supersedes: null },
    { tempId: 'g', kind: 'relationship', fact: 'Corning supplies glass for data-center fiber.', symbolCandidate: null, companyName: 'Corning', support: { kind: 'retrieval', index: 2, from: [], reason: null }, at: null, supersedes: null },
  ],
  summary: { text: 'Nvidia sells accelerators to data-center builders; Corning supplies glass for data-center fiber.', basedOn: ['e', 'g'] },
  lines: { support: 'e', complication: null, missing: null },
  nextAction: { label: "Size Nvidia's data-center sales", purpose: 'Significance is the weakest link.' },
  companies: [
    { companyName: 'Nvidia', symbolCandidate: 'NVDA', role: 'Supplier', relationshipRef: 'e', openRef: null, claim: null },
    { companyName: 'Corning', symbolCandidate: null, role: 'Supplier', relationshipRef: 'g', openRef: null, claim: null },
  ],
});
const QUIET = () => turnOk({ reply: 'Nothing new this step.', findings: [], summary: null, lines: { support: null, complication: null, missing: null }, nextAction: { label: 'Look for a filing', purpose: 'Primary source.' }, companies: [] });
const FRAME = () => turnOk({ question: 'Which listed companies sell the glass inside AI data centers?', check: 'Find who supplies fiber glass to data-center builders.', notEstablished: 'Whether glass is a large part of any supplier\'s sales.' });

/** Own words → map → segment → names → NVDA → why → confirm → wrong if → time frame → save → the read after. */
async function ownWords() {
  const r = {};
  opening();
  const o = await post({ action: 'open', requestId: 'req-own-1', entry: { kind: 'observation', observation: 'I think Corning glass matters for AI data centers' } });
  opened();
  r.open = o;
  const id = o.body.session.sessionId;
  let rev = o.body.thesis.rev;
  let n = 0;
  const step = async (goal, answer) => {
    if (goal !== 'pick') state.retrievalQueue.push(search());
    state.turnQueue.push(answer);
    n += 1;
    const a = await post({ action: 'step', sessionId: id, stepId: `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`, intent: 'build', goal });
    rev = a.body.thesis?.rev ?? rev;
    return a;
  };
  let m = 0;
  const tap = async (op, part, value) => {
    m += 1;
    const a = await post({ action: 'card', sessionId: id, opId: `22222222-2222-4222-8222-${String(m).padStart(12, '0')}`, rev, op, part, ...(value === undefined ? {} : { value }) });
    rev = a.body.thesis?.rev ?? rev;
    return a;
  };
  r.map = await step('map_segments', MAP());
  r.segment = await tap('set', 'segment', 'GPUs and accelerators');
  r.namesFailed = await step('find_names', out({ reply: 'One company.', findings: [{ tempId: 'x1', kind: 'relationship', fact: 'QZXW sells the accelerators.', symbolCandidate: null, companyName: null, support: { kind: 'retrieval', index: 0, from: [], reason: null }, at: null, supersedes: null }] }));
  r.names = await step('find_names', NAMES());
  r.readAfterNames = await get({ sessionId: id });
  r.setNames = await tap('set', 'names', ['NVDA']);
  r.why = await step('build_why', WHY());
  r.confirm = await tap('confirm', 'why');
  r.wrongIf = await tap('set', 'wrongIf', { option: 0, priceLines: [{ symbol: 'NVDA', level: 120 }] });
  r.timeFrame = await tap('set', 'timeFrame', 'positional');
  r.saveStale = await post({ action: 'adopt', sessionId: id, rev: rev + 5 });
  r.save = await post({ action: 'adopt', sessionId: id, rev });
  r.after = await get({ sessionId: id });
  return r;
}

/** A story opened as a thesis builder: the names in scope, their stored rows, the source check. */
async function storyBuilder() {
  const r = {};
  opening();
  r.open = await post({ action: 'open', requestId: 'req-sb-1', entry: { kind: 'item', itemRef: { recordKind: 'fantasyTimesStories', recordId: 'story-1' }, question: 'Which companies earn from accelerator orders?' } });
  opened();
  const id = r.open.body.session.sessionId;
  state.retrievalQueue.push(search());
  state.turnQueue.push(VERIFY());
  r.verify = await post({ action: 'step', sessionId: id, stepId: '33333333-3333-4333-8333-000000000001', intent: 'build', goal: 'verify_source' });
  r.read = await get({ sessionId: id });
  r.close = await post({ action: 'close', sessionId: id, reason: 'abandoned' });
  return r;
}

/** A story opened as a ledger: one step, the read with its preview, the save, the read after. */
async function storyLedger() {
  const r = {};
  opening();
  r.open = await post({ action: 'open', requestId: 'req-sl-1', entry: { kind: 'item', itemRef: { recordKind: 'fantasyTimesStories', recordId: 'story-1' }, question: 'Which companies earn from accelerator orders?', direction: 'suppliers first' } });
  opened();
  const id = r.open.body.session.sessionId;
  state.retrievalQueue.push(search());
  state.turnQueue.push(LEDGER_STEP());
  r.step = await post({ action: 'step', sessionId: id, stepId: '44444444-4444-4444-8444-000000000001', intent: 'next' });
  const rel = r.step.body.record.findings.find((x) => x.kind === 'relationship' && x.symbol === 'NVDA');
  state.retrievalQueue.push(search());
  state.turnQueue.push(QUIET());
  r.examine = await post({ action: 'step', sessionId: id, stepId: '44444444-4444-4444-8444-000000000002', intent: 'examine', target: { symbol: 'NVDA', relationshipFindingId: rel.findingId, openFindingId: null } });
  state.retrievalQueue.push(search());
  state.turnQueue.push(QUIET());
  r.direction = await post({ action: 'step', sessionId: id, stepId: '44444444-4444-4444-8444-000000000003', intent: 'direction', direction: 'look at GLW and the glass suppliers' });
  r.replay = await post({ action: 'step', sessionId: id, stepId: '44444444-4444-4444-8444-000000000002', intent: 'examine', target: { symbol: 'NVDA', relationshipFindingId: rel.findingId, openFindingId: null } });
  state.retrievalQueue.push(search());
  state.turnQueue.push(turnOk({ ...QUIET().output, findings: [{ tempId: 'q1', kind: 'coverage', fact: 'QZXW also sells them.', symbolCandidate: null, companyName: null, support: { kind: 'retrieval', index: 0, from: [], reason: null }, at: null, supersedes: null }] }));
  r.failed = await post({ action: 'step', sessionId: id, stepId: '44444444-4444-4444-8444-000000000004', intent: 'refresh' });
  r.cardRefused = await post({ action: 'card', sessionId: id, opId: '66666666-6666-4666-8666-000000000001', rev: 0, op: 'set', part: 'timeFrame', value: 'swing' });
  r.read = await get({ sessionId: id });
  const nvda = r.read.body.adoptPreview?.companies?.find((c) => c.symbol === 'NVDA');
  r.adopt = await post({ action: 'adopt', sessionId: id, statement: nvda?.fragment ?? 'x', horizonEnum: 'positional', symbols: ['NVDA'], previewRev: r.read.body.adoptPreview?.previewRev });
  r.after = await get({ sessionId: id });
  return r;
}

/** Own words framed as a ledger (the builder off): the frame, the open, one step. */
async function framedLedger() {
  const r = {};
  opening();
  state.turnQueue.push(FRAME());
  r.frame = await post({ action: 'frame', requestId: 'req-fr-1', observation: 'Corning glass is in every AI data center' });
  const id = r.frame.body.sessionId;
  r.open = await post({ action: 'open', sessionId: id, question: 'Which listed companies sell the glass inside AI data centers?' });
  opened();
  state.retrievalQueue.push(search());
  state.turnQueue.push(LEDGER_STEP());
  r.step = await post({ action: 'step', sessionId: id, stepId: '55555555-5555-4555-8555-000000000001', intent: 'next' });
  r.close = await post({ action: 'close', sessionId: id, reason: 'concluded' });
  return r;
}

/** A SignalDrop opened as a ledger. */
async function drop() {
  const r = {};
  opening();
  r.open = await post({ action: 'open', requestId: 'req-dr-1', entry: { kind: 'signaldrop', itemRef: { recordKind: 'signalDrops', recordId: 'drop-1' }, question: 'Is the accelerator backlog real?' } });
  opened();
  r.read = await get({ sessionId: r.open.body.session.sessionId });
  return r;
}

/** Every scenario on one fresh store, in order: the answers, the model calls, the searches, the writes and the store. */
async function runAll({ universe = 'off', thenUniverse = null } = {}) {
  Object.assign(state, { universe, openWith: universe, thenUniverse, ids: 0, turns: [], turnQueue: [], retrievals: [], retrievalQueue: [], logs: [] });
  const env = seed();
  state.env = env;
  state.db = env.db;
  const answers = {};
  state.builder = 'on';
  answers.ownWords = await ownWords();
  answers.storyBuilder = await storyBuilder();
  state.builder = 'off';
  answers.storyLedger = await storyLedger();
  answers.framedLedger = await framedLedger();
  answers.drop = await drop();
  answers.lists = { open: await get({ list: 'open' }), explore: await get({ list: 'explore' }) };
  state.builder = 'on';
  const docs = Object.fromEntries([...env.store.keys()].sort().map((k) => [k, env.doc(k)]));
  return JSON.parse(JSON.stringify({ answers, turns: state.turns, retrievals: state.retrievals, logs: state.logs, writes: env.writes, docs }));
}

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(NOW)); });
afterEach(() => { vi.useRealTimers(); Object.assign(state, { universe: 'off', openWith: 'off', thenUniverse: null }); delete process.env.MANDATE_FOUNDER_UIDS; });

describe('off means off (build prompt section 9): game-list sessions answer, prompt and store exactly as at PR A', () => {
  it('the golden is a real run: every answer whole, a thesis and an idea saved, the prompts sent', async () => {
    const now = await runAll();
    if (process.env.GENERATE_UNIVERSE_OFF_GOLDEN === '1') writeFileSync(GOLDEN, `${JSON.stringify(now, null, 2)}\n`);
    const g = JSON.parse(readFileSync(GOLDEN, 'utf8'));
    expect(g.answers.ownWords.save.status).toBe(200);
    expect(g.answers.ownWords.save.body).toMatchObject({ version: 1, idempotent: false });
    expect(g.answers.storyLedger.adopt.status).toBe(200);
    expect(g.answers.storyBuilder.open.body.opening.storedRows.map((r) => r.symbol)).toEqual(['NVDA', 'AMD']);
    // map, names failed, names, why; the source check; the ledger's next, examine, direction and failed refresh; the frame and its step
    expect(g.turns.length).toBe(11);
    expect(g.logs.length).toBe(11);
    const NOT_200 = { 'ownWords.saveStale': 409, 'storyLedger.cardRefused': 400 };
    for (const [name, run] of Object.entries(g.answers)) for (const [k, a] of Object.entries(run)) expect(a.status, `${name}.${k}`).toBe(NOT_200[`${name}.${k}`] ?? 200);
    expect(g.answers.ownWords.namesFailed.body).toMatchObject({ error: 'step_failed', reason: 'invalid_stray_ticker' });
    expect(g.answers.storyLedger.failed.body).toMatchObject({ error: 'step_failed', reason: 'invalid_stray_ticker' });
    expect(g.answers.storyLedger.replay.body.replay).toBe(true);
    expect(g.answers.storyLedger.cardRefused.body.error).toBe('invalid_intent');
    expect(g.answers.ownWords.saveStale.body.error).toBe('card_stale');
    expect(g.turns.some((t) => t.user.includes('This step: examine one connection.'))).toBe(true);
    expect(g.answers.lists.open.body.open.length).toBeGreaterThan(0);
  });
  it("the switch 'off': equal to the golden, key by key", async () => {
    const now = await runAll({ universe: 'off' });
    const g = JSON.parse(readFileSync(GOLDEN, 'utf8'));
    for (const k of ['answers', 'turns', 'retrievals', 'logs', 'writes', 'docs']) expect(now[k], k).toEqual(g[k]);
  });
  it("the switch 'founder', for a player not on the founder list: equal to the golden", async () => {
    process.env.MANDATE_FOUNDER_UIDS = 'someone-else, another-founder';
    const now = await runAll({ universe: 'founder' });
    const g = JSON.parse(readFileSync(GOLDEN, 'utf8'));
    for (const k of ['answers', 'turns', 'retrievals', 'logs', 'writes', 'docs']) expect(now[k], k).toEqual(g[k]);
  });
  it("a game-list session opened before the switch behaves the same after it is 'on' (the universe is stamped at open)", async () => {
    process.env.MANDATE_FOUNDER_UIDS = UID;
    // each investigation opens (or frames) with the switch 'off'; it turns 'on' at once, for every later request of it
    const now = await runAll({ universe: 'off', thenUniverse: 'on' });
    const g = JSON.parse(readFileSync(GOLDEN, 'utf8'));
    for (const k of ['answers', 'turns', 'retrievals', 'logs', 'writes', 'docs']) expect(now[k], k).toEqual(g[k]);
  });
});
