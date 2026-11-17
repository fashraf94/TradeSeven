// api/forge/shared-research.builder.route.test.js
//
// Shared Research B3 — THE THESIS BUILDER AT THE ROUTE (Amendment B §B2–§B6;
// §B10), on the atomic in-memory Firestore double with the model and the search
// as seams (no network). The rows: the shape stamp follows the flag at `open`
// only; own words open with no framing call; each shape refuses the other's
// intents and actions; the offered goals are the server's; a step only proposes;
// the pick goal makes no retrieval; the free action makes no model call, counts
// no step, is idempotent on opId and leaves one `card` exchange (R-21); a full
// path to a ready card and its save (the composed sentence, the card's evidence
// and price lines, `thesisCard` — S-B1, PF-1 — and the provenance stamp, PF-3);
// not_ready, card_stale, the edited sentence; out of steps still saves; the dead
// end; a ledger investigation opened beside it is unchanged.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeSrFirestore } from '../_utils/sharedResearch/__fixtures__/srFirestore.js';

const state = vi.hoisted(() => ({
  mode: 'on', builder: 'on', user: { uid: 'u1' }, db: null, turns: [], turnQueue: [], retrievals: [], retrievalQueue: [], logs: [], throwValidate: false,
}));
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
vi.mock('../_utils/sharedResearch/thesisSchema.js', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, validateBuildTurn: (o, c) => { if (state.throwValidate) throw new Error('test: the validator throws'); return real.validateBuildTurn(o, c); } };
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
const { BUILD_SCHEMAS } = await import('../_utils/sharedResearch/thesisSchema.js');

const UID = 'u1';
const AGENT = { ownerId: UID, name: 'Atlas', archetype: 'contrarian', loadouts: { baggerbomb: { archetype: 'momentum_chaser', book: null } } };
const STAMP = { agentId: 'agent-1', archetypeCodeId: 'contrarian', baggerbombArchetypeCodeId: 'momentum_chaser', identityVersion: 2 };
const STORY = { headline: 'Data centers push accelerator orders higher', reporterName: 'Kim', reporterBeat: 'Sector Strategist', publishedAt: '2026-11-12T13:00:00.000Z', primaryTicker: 'NVDA', tickers: ['NVDA'], status: 'published', type: 'sector' };
const ITEMS = [
  { index: 0, url: 'https://news.example.com/nvda-ai', title: 'Nvidia accelerators lead AI data centers', host: 'news.example.com', publishedDate: '2026-11-06T00:00:00.000Z', highlights: ['Nvidia sells the accelerators most AI data centers buy.'] },
  { index: 1, url: 'https://news.example.com/nvda-rev', title: 'Nvidia data-center revenue', host: 'news.example.com', publishedDate: '2026-11-07T00:00:00.000Z', highlights: ['Data-center sales were most of its revenue.'] },
  { index: 2, url: 'https://news.example.com/buyers', title: 'Large buyers design their own chips', host: 'news.example.com', publishedDate: '2026-11-08T00:00:00.000Z', highlights: ['Several large buyers design their own chips.'] },
];
const seed = () => makeSrFirestore({
  'agents/agent-1': AGENT,
  'fantasyTimesStories/story-1': STORY,
  'peerRankings/NVDA': { ticker: 'NVDA', name: 'NVIDIA Corporation', sector: 'Technology' },
  'peerRankings/AMD': { ticker: 'AMD', name: 'Advanced Micro Devices, Inc.', sector: 'Technology' },
});

const res = () => { const r = { statusCode: null, body: null, headers: {} }; r.status = (c) => { r.statusCode = c; return r; }; r.json = (b) => { r.body = b; return r; }; r.setHeader = (k, v) => { r.headers[k] = v; return r; }; return r; };
const post = async (body) => { resetUidRateLimits(); const r = res(); await handler({ method: 'POST', headers: {}, query: {}, body }, r); return r; };
const get = async (query) => { resetUidRateLimits(); const r = res(); await handler({ method: 'GET', headers: {}, query, body: undefined }, r); return r; };
const turnOk = (output) => ({ ok: true, output, usage: { input: 8000, output: 600 }, model: 'claude-sonnet-5-5', attempts: 1, elapsedMs: 900, costUsd: 0.022, stopReason: 'end_turn' });
const uuid = (n) => `9a8b7c6d-5e4f-4a3b-8c2d-${String(n).padStart(12, '0')}`;
const opId = (n) => `1b2c3d4e-5f6a-4b7c-8d9e-${String(n).padStart(12, '0')}`;
const EMPTY = { reply: '', findings: [], companies: [], themeSuggestion: null, segments: [], why: null, wrongIfOptions: [], timeFramePick: null, pick: null };
const out = (over) => turnOk({ ...EMPTY, ...over });
let env;
const sessionDoc = (id) => env.doc(`sharedResearchSessions/${id}`);
const quotaDoc = () => env.doc(`sharedResearchQuota/${UID}`);

beforeEach(() => {
  env = seed();
  Object.assign(state, { mode: 'on', builder: 'on', user: { uid: UID }, db: env.db, turns: [], turnQueue: [], retrievals: [], retrievalQueue: [], logs: [], throwValidate: false });
});

// ── the model's answers along one path ─────────────────────────────────────────
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
const NO_NAMES = () => out({ reply: 'No listed company has a sourced connection to this segment.' });
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

async function openOwn(observation = 'I want to play AI', requestId = 'req-own-1') {
  const r = await post({ action: 'open', requestId, entry: { kind: 'observation', observation } });
  expect(r.statusCode, JSON.stringify(r.body)).toBe(200);
  return r.body;
}
async function build(sessionId, n, goal, answer, extra = {}) {
  if (goal !== 'pick') state.retrievalQueue.push({ items: ITEMS, costDollars: 0.005, elapsedMs: 300, readAt: new Date().toISOString() });
  if (answer) state.turnQueue.push(answer);
  return post({ action: 'step', sessionId, stepId: uuid(n), intent: 'build', goal, ...extra });
}
async function card(sessionId, n, op, part, value, rev) {
  const r = await post({ action: 'card', sessionId, opId: opId(n), rev, op, part, ...(value === undefined ? {} : { value }) });
  return r;
}
/** Own words → map → segment → names → NVDA → why → confirm → wrong if + price line → time frame: a ready card. */
async function toReady() {
  const opened = await openOwn();
  const id = opened.session.sessionId;
  let rev = opened.thesis.rev;
  const step = async (n, goal, a) => { const r = await build(id, n, goal, a); expect(r.statusCode, JSON.stringify(r.body)).toBe(200); rev = r.body.thesis.rev; return r; };
  const tap = async (n, op, part, value) => { const r = await card(id, n, op, part, value, rev); expect(r.statusCode, JSON.stringify(r.body)).toBe(200); rev = r.body.thesis.rev; return r; };
  await step(1, 'map_segments', MAP());
  await tap(1, 'set', 'segment', 'GPUs and accelerators');
  await step(2, 'find_names', NAMES());
  await tap(2, 'set', 'names', ['NVDA']);
  await step(3, 'build_why', WHY());
  await tap(3, 'confirm', 'why');
  await tap(4, 'set', 'wrongIf', { option: 0, priceLines: [{ symbol: 'NVDA', level: 120 }] });
  const last = await tap(5, 'set', 'timeFrame', 'positional');
  return { id, rev, last };
}

describe('the shape stamp (§B2; §B10 S-B2; K-2)', () => {
  it("builder mode 'off': a story opens as today's ledger — no shape, no card, no thesis in any answer", async () => {
    state.builder = 'off';
    const r = await post({ action: 'open', requestId: 'req-1', entry: { kind: 'item', itemRef: { recordKind: 'fantasyTimesStories', recordId: 'story-1' }, question: 'Which companies earn from this?' } });
    expect(r.statusCode).toBe(200);
    const id = r.body.session.sessionId;
    expect(Object.keys(sessionDoc(id))).not.toEqual(expect.arrayContaining(['shape']));
    expect('thesis' in sessionDoc(id)).toBe(false);
    expect('thesis' in r.body).toBe(false);
    expect('shape' in r.body.session).toBe(false);
    const g = await get({ sessionId: id });
    expect('thesis' in g.body).toBe(false);
    expect(g.body.record.nextAction).not.toBeNull(); // the ledger's opening keeps its next action
  });
  it("builder mode 'off': own words as an open entry is refused exactly as before (invalid_entry)", async () => {
    state.builder = 'off';
    const r = await post({ action: 'open', requestId: 'req-1', entry: { kind: 'observation', observation: 'I want to play AI' } });
    expect([r.statusCode, r.body.error]).toEqual([400, 'invalid_entry']);
    expect(env.writes).toEqual([]);
  });
  it("builder mode 'on': a story opens stamped builder with an empty card and no opening next action", async () => {
    const r = await post({ action: 'open', requestId: 'req-1', entry: { kind: 'item', itemRef: { recordKind: 'fantasyTimesStories', recordId: 'story-1' }, question: 'Which companies earn from this?' } });
    const id = r.body.session.sessionId;
    expect(sessionDoc(id)).toMatchObject({ shape: 'builder', thesis: { rev: 0 } });
    expect(r.body.session.shape).toBe('builder');
    expect(r.body.thesis.choices.research).toEqual([{ goal: 'verify_source' }, { goal: 'direction' }]);
    expect(r.body.record.nextAction).toBeNull();
  });
  it('the stamp never changes: flipping the mode leaves open sessions on their own shape', async () => {
    const builderOpen = await openOwn();
    state.builder = 'off';
    expect((await build(builderOpen.session.sessionId, 1, 'map_segments', MAP())).statusCode).toBe(200);
    const ledger = await post({ action: 'open', requestId: 'req-2', entry: { kind: 'item', itemRef: { recordKind: 'fantasyTimesStories', recordId: 'story-1' }, question: 'Which companies earn from this?' } });
    state.builder = 'on';
    const r = await build(ledger.body.session.sessionId, 2, 'verify_source', null);
    expect([r.statusCode, r.body.error, r.body.reason]).toEqual([400, 'invalid_intent', 'shape']);
  });
});

describe('own words open at once (§B4.1, DR-6)', () => {
  it('no framing call, no framing count; one investigation counted; the theme is the player\'s words', async () => {
    const o = await openOwn('I want to play AI');
    expect(state.turns).toEqual([]);
    expect(quotaDoc()).toMatchObject({ investigationsOpened: 1, framingsRun: 0 });
    expect(o.thesis.parts.theme).toMatchObject({ state: 'set', value: 'I want to play AI', by: 'player_wrote' });
    expect(o.record.question).toBe('Build a thesis on: I want to play AI');
    expect(o.record.findings.map((f) => f.kind)).toEqual(['observation']);
    expect(sessionDoc(o.session.sessionId).attribution).toMatchObject(STAMP);
    expect(o.thesis.choices.research.map((g) => g.goal)).toEqual(['map_segments', 'strengthen', 'direction']);
  });
  it('words over 80 leave the theme unset for the first step to suggest (SQ-2)', async () => {
    const o = await openOwn('x'.repeat(81));
    expect(o.thesis.parts.theme.state).toBe('unset');
    expect(o.thesis.choices.research.map((g) => g.goal)).toEqual(['map_segments', 'direction']);
  });
  it('a retried requestId finds its session and writes nothing; a framing\'s requestId is refused (SI-3)', async () => {
    const a = await openOwn('AI', 'req-x');
    const writes = env.writes.length;
    const b = await openOwn('AI', 'req-x');
    expect(b.session.sessionId).toBe(a.session.sessionId);
    expect(env.writes.length).toBe(writes);
    state.turnQueue.push({ ok: true, output: { question: 'q?', check: 'c', notEstablished: 'n' }, usage: { input: 1, output: 1 }, model: 'claude-haiku-5-5', attempts: 1, elapsedMs: 1, costUsd: 0, stopReason: 'end_turn' });
    const f = await post({ action: 'frame', observation: 'AI', requestId: 'req-x' });
    expect([f.statusCode, f.body.error]).toEqual([400, 'invalid_request']);
  });
});

describe('the other shape is refused (§B2): invalid_intent, before any call is counted', () => {
  it('a builder session refuses a ledger intent; a ledger session refuses `build`, `card` and a builder save', async () => {
    const o = await openOwn();
    const r = await post({ action: 'step', sessionId: o.session.sessionId, stepId: uuid(1), intent: 'next' });
    expect([r.statusCode, r.body.error, r.body.reason]).toEqual([400, 'invalid_intent', 'shape']);
    expect(quotaDoc().stepCalls ?? 0).toBe(0);
    state.builder = 'off';
    const ledger = await post({ action: 'open', requestId: 'req-2', entry: { kind: 'item', itemRef: { recordKind: 'fantasyTimesStories', recordId: 'story-1' }, question: 'Which companies earn from this?' } });
    const lid = ledger.body.session.sessionId;
    const b = await build(lid, 2, 'verify_source', null);
    expect([b.statusCode, b.body.error]).toEqual([400, 'invalid_intent']);
    expect(state.turns).toEqual([]);
    expect(quotaDoc().stepCalls ?? 0).toBe(0);
    expect((await card(lid, 1, 'set', 'timeFrame', 'swing', 0)).body.error).toBe('invalid_intent');
    expect((await post({ action: 'adopt', sessionId: lid, rev: 0 })).body.error).toBe('invalid_intent');
  });
  it('a ledger save sent for a builder session is refused', async () => {
    const o = await openOwn();
    const r = await post({ action: 'adopt', sessionId: o.session.sessionId, previewRev: `pr1.${'a'.repeat(32)}`, statement: 'x', horizonEnum: 'swing', symbols: ['NVDA'] });
    expect([r.statusCode, r.body.error]).toEqual([400, 'invalid_intent']);
  });
});

describe('the server decides what is on offer (§B4.2)', () => {
  it('a story verifies first: map_segments before verify_source is refused, uncounted', async () => {
    const r0 = await post({ action: 'open', requestId: 'req-1', entry: { kind: 'item', itemRef: { recordKind: 'fantasyTimesStories', recordId: 'story-1' }, question: 'Which companies earn from this?' } });
    const r = await build(r0.body.session.sessionId, 1, 'map_segments', MAP());
    expect([r.statusCode, r.body.error, r.body.reason]).toEqual([400, 'invalid_intent', 'goal_not_offered']);
    expect(state.turns).toEqual([]);
    expect(quotaDoc().stepCalls ?? 0).toBe(0);
  });
  it('a verify step suggests a theme; confirming it is free; then the map is offered', async () => {
    const r0 = await post({ action: 'open', requestId: 'req-1', entry: { kind: 'item', itemRef: { recordKind: 'fantasyTimesStories', recordId: 'story-1' }, question: 'Which companies earn from this?' } });
    const id = r0.body.session.sessionId;
    const v = await build(id, 1, 'verify_source', out({ reply: 'The story matches its source.', themeSuggestion: 'Data-center accelerators' }));
    expect(v.body.thesis.parts.theme).toMatchObject({ state: 'suggested', suggestion: 'Data-center accelerators' });
    expect(v.body.session.exchanges.at(-1)).toMatchObject({ who: 'partner', kind: 'step', intent: 'build', goal: 'verify_source' });
    const c = await card(id, 1, 'confirm', 'theme', undefined, v.body.thesis.rev);
    expect(c.body.thesis.parts.theme).toMatchObject({ state: 'set', by: 'partner_suggested_confirmed' });
    expect(c.body.thesis.choices.research.map((g) => g.goal)).toContain('map_segments');
  });
});

describe('a step only proposes (V2-4)', () => {
  it('map_segments lands a map and Atlas\'s pick; no part is set; rev + 1; the call is logged with its goal', async () => {
    const o = await openOwn();
    const r = await build(o.session.sessionId, 1, 'map_segments', MAP());
    expect(r.statusCode).toBe(200);
    expect(r.body.thesis.parts.segment).toMatchObject({ state: 'unset', map: [{ label: 'GPUs and accelerators' }, { label: 'Data-center power' }] });
    expect(r.body.thesis.pick).toMatchObject({ part: 'segment', value: 'GPUs and accelerators', asked: false, basis: 'reasoning' });
    expect(r.body.thesis.rev).toBe(o.thesis.rev + 1);
    expect(r.body.thesis.filled).toBe(1);
    expect(state.turns[0].schema).toBe(BUILD_SCHEMAS.map_segments);
    expect(state.turns[0].system).not.toContain('weakest link');
    expect(state.logs.at(-1)).toMatchObject({ outcome: 'completion', intent: 'build', goal: 'map_segments' });
    expect(sessionDoc(o.session.sessionId).stepsUsed).toBe(1);
  });
  it('the pick goal makes no retrieval and one model turn; its answer shows the part as suggested', async () => {
    const o = await openOwn();
    const id = o.session.sessionId;
    await build(id, 1, 'map_segments', MAP());
    const before = state.retrievals.length;
    const r = await build(id, 2, 'pick', out({ reply: 'I would stand on GPUs and accelerators.', pick: { part: 'segment', value: 'GPUs and accelerators', reason: 'Sales tie to it most directly.', refs: [], reasons: [{ text: 'It is the easiest to tie to sales.', refs: [] }, { text: 'The theme names it first.', refs: [] }] } }), { part: 'segment' });
    expect(r.statusCode, JSON.stringify(r.body)).toBe(200);
    expect(state.retrievals.length).toBe(before);
    expect(state.turns).toHaveLength(2);
    expect(r.body.thesis.parts.segment.state).toBe('suggested');
    expect(r.body.thesis.pick.reasons.map((x) => x.basis)).toEqual(['reasoning', 'reasoning']);
  });
  it('the dead end: find_names with no supported company blocks the names; the free choices offer another segment', async () => {
    const o = await openOwn();
    const id = o.session.sessionId;
    const m = await build(id, 1, 'map_segments', MAP());
    const s = await card(id, 1, 'set', 'segment', 'GPUs and accelerators', m.body.thesis.rev);
    const r = await build(id, 2, 'find_names', NO_NAMES());
    expect(r.body.thesis.parts.names).toMatchObject({ state: 'unset', blocked: 'no_listed_company' });
    expect(r.body.thesis.choices.research.map((g) => g.goal)).not.toContain('find_names');
    expect(r.body.thesis.choices.free).toContainEqual({ op: 'clear', part: 'segment', clears: ['names', 'why'] });
    expect(s.statusCode).toBe(200);
  });
  it('a failed step answers with the card unchanged', async () => {
    const o = await openOwn();
    state.retrievalQueue.push({ items: ITEMS, costDollars: 0, elapsedMs: 1, readAt: new Date().toISOString() });
    state.turnQueue.push({ ok: false, reason: 'model_error_500', usage: null, model: 'claude-sonnet-5-5', attempts: 1, elapsedMs: 5, costUsd: null, stopReason: null });
    const r = await post({ action: 'step', sessionId: o.session.sessionId, stepId: uuid(1), intent: 'build', goal: 'map_segments' });
    expect(r.body).toMatchObject({ error: 'step_failed', reason: 'model_error_500', thesis: { rev: o.thesis.rev } });
  });
});

describe('one schema per goal (the founder\'s S-1, Nov 17)', () => {
  it('each step is asked in its own goal\'s schema', async () => {
    const o = await openOwn();
    const id = o.session.sessionId;
    let rev = o.thesis.rev;
    const step = async (n, goal, a, extra) => { const r = await build(id, n, goal, a, extra); expect(r.statusCode, JSON.stringify(r.body)).toBe(200); rev = r.body.thesis.rev; };
    const tap = async (n, op, part, value) => { const r = await card(id, n, op, part, value, rev); expect(r.statusCode, JSON.stringify(r.body)).toBe(200); rev = r.body.thesis.rev; };
    await step(1, 'map_segments', MAP());
    await step(2, 'pick', out({ reply: 'I would stand on GPUs and accelerators.', pick: { value: 'GPUs and accelerators', reason: 'Sales tie to it most directly.', reasons: [] } }), { part: 'segment' });
    await tap(1, 'set', 'segment', 'GPUs and accelerators');
    await step(3, 'find_names', NAMES());
    await tap(2, 'set', 'names', ['NVDA']);
    await step(4, 'build_why', WHY());
    await step(5, 'strengthen', out({ reply: 'Nothing new changes the theme.' }), { part: 'theme' });
    expect(state.turns.map((t) => t.schema)).toEqual([
      BUILD_SCHEMAS.map_segments, BUILD_SCHEMAS.pick, BUILD_SCHEMAS.find_names, BUILD_SCHEMAS.build_why, BUILD_SCHEMAS['strengthen:theme'],
    ]);
  });
  it('a direction step is asked as the research goal the card would offer next, read at admission, and lands only that goal\'s proposals', async () => {
    const o = await openOwn();
    const id = o.session.sessionId;
    const r = await build(id, 1, 'direction', out({
      reply: 'Power is one part of the theme. Here is a map.',
      segments: [{ label: 'GPUs and accelerators', line: 'The chips that train and run models', refs: [] }, { label: 'Data-center power', line: 'Electricity and cooling for the buildings', refs: [] }],
      why: { shared: 'x', reasons: [], against: { text: '', refs: [] } },
    }), { direction: 'look at power' });
    expect(r.statusCode, JSON.stringify(r.body)).toBe(200);
    expect(state.turns[0].schema).toBe(BUILD_SCHEMAS.map_segments);
    expect(state.turns[0].user).toContain("The proposals you may make are those of the card's next step (map segments)");
    expect(r.body.thesis.parts.segment.map.map((m) => m.label)).toEqual(['GPUs and accelerators', 'Data-center power']);
    expect(state.logs.at(-1).validationNotes).toContain('ignored:why');
  });
  it('with nothing else on offer, direction is asked with findings and companies only, and lands nothing on the card', async () => {
    const long = 'I want to play AI through the chips, the power and the networking that the largest data centers keep buying';
    const o = await openOwn(long, 'req-own-long');
    const id = o.session.sessionId;
    const m = await build(id, 1, 'map_segments', out({ ...MAP().output, themeSuggestion: 'AI data-center build-out' }));
    expect(m.statusCode, JSON.stringify(m.body)).toBe(200);
    expect(m.body.thesis.parts.theme).toMatchObject({ state: 'suggested', suggestion: 'AI data-center build-out' });
    expect(m.body.thesis.choices.research.map((g) => g.goal)).not.toContain('map_segments');
    const r = await build(id, 2, 'direction', out({ reply: 'I looked at power.', segments: [{ label: 'A', line: 'a', refs: [] }, { label: 'B', line: 'b', refs: [] }] }), { direction: 'look at power' });
    expect(r.statusCode, JSON.stringify(r.body)).toBe(200);
    expect(state.turns[1].schema).toBe(BUILD_SCHEMAS.direction);
    expect(state.turns[1].user).toContain('Propose nothing for the card this step: findings only.');
    expect(r.body.thesis.parts.segment.map.map((x) => x.label)).toEqual(['GPUs and accelerators', 'Data-center power']);
    expect(state.logs.at(-1).validationNotes).toContain('ignored:segments');
  });
});

describe('the free action (§B4.3; K-5; §B10 R-21)', () => {
  it('makes no model call and counts no step and no step call', async () => {
    const o = await openOwn();
    const id = o.session.sessionId;
    const r = await card(id, 1, 'set', 'timeFrame', 'swing', o.thesis.rev);
    expect(r.statusCode).toBe(200);
    expect(state.turns).toEqual([]);
    expect(state.retrievals).toEqual([]);
    expect(sessionDoc(id).stepsUsed).toBe(0);
    expect(quotaDoc().stepCalls ?? 0).toBe(0);
    expect(r.body).toMatchObject({ applied: true, thesis: { rev: o.thesis.rev + 1, parts: { timeFrame: { state: 'set', value: 'swing' } } } });
  });
  it('leaves one `card` exchange per applied op; a retried opId applies and appends nothing', async () => {
    const o = await openOwn();
    const id = o.session.sessionId;
    const a = await card(id, 1, 'set', 'timeFrame', 'swing', o.thesis.rev);
    expect(a.body.session.exchanges.at(-1)).toMatchObject({ who: 'player', kind: 'card', text: 'Time frame: Swing · about 10 sessions', card: { op: 'set', part: 'timeFrame' } });
    const count = sessionDoc(id).exchanges.length;
    const again = await card(id, 1, 'set', 'timeFrame', 'longterm', o.thesis.rev);
    expect([again.statusCode, again.body.applied, again.body.thesis.parts.timeFrame.value]).toEqual([200, false, 'swing']);
    expect(sessionDoc(id).exchanges.length).toBe(count);
  });
  it('a rev that is not current answers 409 card_stale with the fresh card; an invalid op 400 invalid_card', async () => {
    const o = await openOwn();
    const id = o.session.sessionId;
    const stale = await card(id, 1, 'set', 'timeFrame', 'swing', o.thesis.rev + 5);
    expect([stale.statusCode, stale.body.error, stale.body.thesis.rev]).toEqual([409, 'card_stale', o.thesis.rev]);
    const bad = await card(id, 2, 'set', 'timeFrame', 'intraday', o.thesis.rev);
    expect([bad.statusCode, bad.body.error, bad.body.reason]).toEqual([400, 'invalid_card', 'invalid_value']);
    const theme = await card(id, 3, 'set', 'theme', 'Something else', o.thesis.rev);
    expect([theme.statusCode, theme.body.reason]).toEqual([400, 'theme_fixed']);
  });
  it('never takes a part\'s finding, a reason or a ready verdict from the client — only an operation', async () => {
    const o = await openOwn();
    const r = await post({ action: 'card', sessionId: o.session.sessionId, opId: opId(1), rev: o.thesis.rev, op: 'set', part: 'why', value: { shared: 'x', reasons: [{ symbol: 'NVDA', findingIds: ['f_x'] }] }, ready: true, thesis: { ready: true } });
    expect([r.statusCode, r.body.error]).toEqual([400, 'invalid_card']);
  });
});

describe('the review\'s route fixes (K-10; report §9)', () => {
  const ledgerStory = () => post({ action: 'open', requestId: 'req-l', entry: { kind: 'item', itemRef: { recordKind: 'fantasyTimesStories', recordId: 'story-1' }, question: 'Which companies earn from this?' } });
  it('RA-2 / RD-1: a replayed stepId in the other shape is refused invalid_intent, both ways — nothing answered in the wrong shape', async () => {
    state.builder = 'off';
    const l = await ledgerStory();
    const lid = l.body.session.sessionId;
    state.retrievalQueue.push({ items: ITEMS, costDollars: 0, elapsedMs: 1, readAt: new Date().toISOString() });
    state.turnQueue.push(turnOk({ reply: 'Nothing new.', findings: [], summary: null, lines: { support: null, complication: null, missing: null }, nextAction: { label: 'Look for a filing', purpose: 'Primary source.' }, companies: [] }));
    expect((await post({ action: 'step', sessionId: lid, stepId: uuid(1), intent: 'next' })).statusCode).toBe(200);
    const cross = await post({ action: 'step', sessionId: lid, stepId: uuid(1), intent: 'build', goal: 'verify_source' });
    expect([cross.statusCode, cross.body.error, cross.body.reason]).toEqual([400, 'invalid_intent', 'shape']);
    state.builder = 'on';
    const o = await openOwn();
    expect((await build(o.session.sessionId, 2, 'map_segments', MAP())).statusCode).toBe(200);
    const back = await post({ action: 'step', sessionId: o.session.sessionId, stepId: uuid(2), intent: 'next' });
    expect([back.statusCode, back.body.error, back.body.reason]).toEqual([400, 'invalid_intent', 'shape']);
  });
  it('RD-2: a save in the other shape on a SAVED session is refused, not answered as saved', async () => {
    const { id, rev } = await toReady();
    expect((await post({ action: 'adopt', sessionId: id, rev })).statusCode).toBe(200);
    const ledgerBody = await post({ action: 'adopt', sessionId: id, previewRev: `pr1.${'a'.repeat(32)}`, statement: 'x', horizonEnum: 'swing', symbols: ['NVDA'] });
    expect([ledgerBody.statusCode, ledgerBody.body.error]).toEqual([400, 'invalid_intent']);
  });
  it('RB-8: a free tap waits for a running step (409 step_in_flight), nothing written', async () => {
    const o = await openOwn();
    const id = o.session.sessionId;
    const doc = sessionDoc(id);
    env.store.set(`sharedResearchSessions/${id}`, { ...doc, lastStep: { stepId: uuid(9), intent: 'build', status: 'running', startedAt: new Date().toISOString(), endedAt: null, error: null } });
    const writes = env.writes.length;
    const r = await card(id, 1, 'set', 'timeFrame', 'swing', o.thesis.rev);
    expect([r.statusCode, r.body.error]).toEqual([409, 'step_in_flight']);
    expect(env.writes.length).toBe(writes);
  });
  it('RA-6: a session keeps at most 300 card exchanges; past it the free action is refused', async () => {
    const o = await openOwn();
    const id = o.session.sessionId;
    const doc = sessionDoc(id);
    const filler = Array.from({ length: 300 }, (_, i) => ({ exchangeId: `e${i}`, who: 'player', kind: 'card', text: 'Time frame: Swing', at: doc.createdAt, card: { op: 'set', part: 'timeFrame' } }));
    env.store.set(`sharedResearchSessions/${id}`, { ...doc, exchanges: [...doc.exchanges, ...filler] });
    const r = await card(id, 1, 'set', 'timeFrame', 'swing', o.thesis.rev);
    expect([r.statusCode, r.body.error, r.body.reason]).toEqual([400, 'invalid_card', 'too_many_changes']);
  });
  it('RC-1: a validator that throws after a paid call fails the step, logged, the session released', async () => {
    const o = await openOwn();
    const id = o.session.sessionId;
    state.throwValidate = true;
    const r = await build(id, 1, 'map_segments', MAP());
    expect([r.statusCode, r.body.error, r.body.reason]).toEqual([200, 'step_failed', 'invalid_unparseable']);
    expect(state.logs.at(-1)).toMatchObject({ outcome: 'failure', failureReason: 'invalid_unparseable', goal: 'map_segments' });
    expect(sessionDoc(id).lastStep).toMatchObject({ status: 'failed', error: 'invalid_unparseable' });
    state.throwValidate = false;
    expect((await build(id, 2, 'map_segments', MAP())).statusCode).toBe(200);
  });
  it('RA-1: a composed sentence whose segment states a figure no carried fact holds is refused, and the card said so first', async () => {
    const MAP5 = () => out({
      reply: 'Here is how the theme splits.',
      findings: [{ tempId: 'm1', kind: 'coverage', fact: 'The top 5 chip makers sell most AI accelerators.', symbolCandidate: null, companyName: null, support: { kind: 'retrieval', index: 0, from: [], reason: null }, at: null, supersedes: null }],
      segments: [{ label: 'The top 5 chip makers', line: 'The makers of the accelerators', refs: ['m1'] }, { label: 'Data-center power', line: 'Electricity for the buildings', refs: [] }],
    });
    const opened = await openOwn();
    const id = opened.session.sessionId;
    let rev = opened.thesis.rev;
    const step = async (n, goal, a) => { const r = await build(id, n, goal, a); expect(r.statusCode, JSON.stringify(r.body)).toBe(200); rev = r.body.thesis.rev; return r; };
    const tap = async (n, op, part, value) => { const r = await card(id, n, op, part, value, rev); expect(r.statusCode, JSON.stringify(r.body)).toBe(200); rev = r.body.thesis.rev; return r; };
    await step(1, 'map_segments', MAP5());
    await tap(1, 'set', 'segment', 'The top 5 chip makers');
    await step(2, 'find_names', NAMES());
    await tap(2, 'set', 'names', ['NVDA']);
    await step(3, 'build_why', WHY());
    await tap(3, 'confirm', 'why');
    await tap(4, 'set', 'wrongIf', { option: 0 });
    const last = await tap(5, 'set', 'timeFrame', 'positional');
    expect(last.body.thesis).toMatchObject({ ready: true, saveIssue: { code: 'unsupported_assertion', detail: '5' } });
    const r = await post({ action: 'adopt', sessionId: id, rev });
    expect([r.statusCode, r.body.error, r.body.detail]).toEqual([400, 'unsupported_assertion', '5']);
    const edited = last.body.thesis.sentence.replace('The top 5 chip makers', 'chip makers');
    expect((await post({ action: 'adopt', sessionId: id, rev, statement: edited })).statusCode).toBe(200);
  });
});

describe('to a ready card, and its save (§B4.5; §B10 S-B1, PF-1, PF-3)', () => {
  it('the path: ready, the sentence composed, four of the parts set by the player, the why confirmed', async () => {
    const { last } = await toReady();
    const t = last.body.thesis;
    expect(t.ready).toBe(true);
    expect(t.sentence).toBe("My theme is I want to play AI, through GPUs and accelerators, built on NVDA, because it sells the accelerators AI data centers are buying. It's wrong if big buyers cut accelerator spending for two quarters. Time frame: Positional · about 30 sessions.");
    expect(t.parts.why).toMatchObject({ state: 'set', by: 'partner_suggested_confirmed', against: { text: 'Several large buyers design their own chips.' } });
    expect(t.parts.wrongIf.priceLines).toEqual([{ symbol: 'NVDA', level: 120 }]);
    const g = await get({ sessionId: last.body.session.sessionId });
    expect('adoptPreview' in g.body).toBe(false);
    expect(g.body.thesis.ready).toBe(true);
  });
  it('saves: the composed sentence, the card\'s evidence and price line, `thesisCard` written once, `thesis` left \'\', the stamp copied', async () => {
    const { id, rev } = await toReady();
    const r = await post({ action: 'adopt', sessionId: id, rev });
    expect(r.statusCode, JSON.stringify(r.body)).toBe(200);
    const list = env.doc(`watchlists/${r.body.watchlistId}`);
    const version = env.doc(`watchlists/${r.body.watchlistId}/hypothesisVersions/v1`);
    const s = sessionDoc(id);
    expect(list.thesis).toBe('');
    expect(list.attribution).toEqual(s.attribution); // PF-3: at open, on the list
    expect(list.attribution).toMatchObject(STAMP);
    expect(list.thesisCard).toMatchObject({
      schemaVersion: 1, watchlistId: r.body.watchlistId, hypothesisVersion: 1, sessionId: id, researchWorkId: `sr_${id}`,
      names: { value: ['NVDA'], by: 'player_chose' }, wrongIf: { text: 'big buyers cut accelerator spending for two quarters', by: 'player_chose' },
    });
    expect(version.statement).toBe(list.thesisCard.sentence);
    expect(version.horizonEnum).toBe('positional');
    expect(version.invalidation).toEqual([{ symbol: 'NVDA', side: 'below', level: 120, basis: 'daily_close' }]);
    const kept = version.evidenceRefs.filter((e) => e.kind === 'evidenceItem').map((e) => e.itemId);
    expect(kept).toEqual(list.thesisCard.findingIds);
    expect(kept).toHaveLength(3); // NVDA's relationship fact, its reason, the point against
    expect(r.body.thesis.choices).toEqual({ research: [], free: [] });
    // a retry answers the saved idea and writes nothing
    const writes = env.writes.length;
    const again = await post({ action: 'adopt', sessionId: id, rev });
    expect(again.body).toMatchObject({ watchlistId: r.body.watchlistId, idempotent: true });
    expect(env.writes.length).toBe(writes);
  });
  it('PF-3: the provenance stamp on a builder save as on a ledger save — on the session at open, copied to the list, passed to the version builder', async () => {
    const { id, rev } = await toReady();
    const { adoptThesis, SHARED_RESEARCH_ADAPTER } = await import('../_utils/sharedResearch/store.js');
    const { companiesOf } = await import('../_utils/sharedResearch/companies.js');
    const { exchangeOf } = await import('../_utils/sharedResearch/session.js');
    const { randomUUID } = await import('node:crypto');
    let passed;
    const adapter = { ...SHARED_RESEARCH_ADAPTER, buildVersion: (args) => { passed = args.attribution; return SHARED_RESEARCH_ADAPTER.buildVersion(args); } };
    const saved = await adoptThesis(env.db, { uid: UID, sessionId: id, rev, companiesFor: (rec) => companiesOf(rec), adapter, mintId: randomUUID, exchangeOf, nowIso: new Date().toISOString() });
    const s = sessionDoc(id);
    expect(s.attribution).toMatchObject(STAMP);
    expect(env.doc(`watchlists/${saved.watchlistId}`).attribution).toEqual(s.attribution);
    expect(passed).toEqual(s.attribution);
  });
  it('not ready → 409 not_ready with its blockers, nothing written', async () => {
    const o = await openOwn();
    const writes = env.writes.length;
    const nr = await post({ action: 'adopt', sessionId: o.session.sessionId, rev: o.thesis.rev });
    expect([nr.statusCode, nr.body.error, nr.body.blockers.map((b) => b.part)]).toEqual([409, 'not_ready', ['names', 'why', 'wrongIf', 'timeFrame']]);
    expect(env.writes.length).toBe(writes);
  });
  it('a stale rev → 409 card_stale with the fresh card, nothing written', async () => {
    const { id, rev } = await toReady();
    const writes = env.writes.length;
    const st = await post({ action: 'adopt', sessionId: id, rev: rev - 1 });
    expect([st.statusCode, st.body.error, st.body.thesis.rev]).toEqual([409, 'card_stale', rev]);
    expect(env.writes.length).toBe(writes);
  });
  it('an edited sentence: a number in the wrong-if or the label passes; a number held nowhere, or another company, is refused', async () => {
    const { id, rev } = await toReady();
    const ok = "NVDA earns from GPUs and accelerators because it sells them to AI data centers. It's wrong if big buyers cut accelerator spending for two quarters. Positional, about 30 sessions.";
    const bad = await post({ action: 'adopt', sessionId: id, rev, statement: 'NVDA will earn 40% more from AI.' });
    expect([bad.statusCode, bad.body.error]).toEqual([400, 'unsupported_assertion']);
    const other = await post({ action: 'adopt', sessionId: id, rev, statement: 'AMD earns from GPUs.' });
    expect([other.statusCode, other.body.error]).toEqual([400, 'names_not_supported']);
    const r = await post({ action: 'adopt', sessionId: id, rev, statement: ok });
    expect(r.statusCode, JSON.stringify(r.body)).toBe(200);
    expect(env.doc(`watchlists/${r.body.watchlistId}/hypothesisVersions/v1`).statement).toBe(ok);
    expect(env.doc(`watchlists/${r.body.watchlistId}`).thesisCard.statement).toBe(ok);
  });
  it('out of steps (DR-4): research is refused, free choices still work, a ready card still saves', async () => {
    const { id, rev } = await toReady();
    const doc = sessionDoc(id);
    env.store.set(`sharedResearchSessions/${id}`, { ...doc, stepsUsed: doc.stepBudget });
    const r = await build(id, 9, 'direction', null, { direction: 'look again' });
    expect([r.statusCode, r.body.error]).toEqual([409, 'budget_spent']);
    const g = await get({ sessionId: id });
    expect(g.body.thesis.choices.research).toEqual([]);
    expect(g.body.thesis.choices.free.length).toBeGreaterThan(0);
    const t = await card(id, 9, 'set', 'timeFrame', 'longterm', rev);
    expect(t.statusCode).toBe(200);
    const saved = await post({ action: 'adopt', sessionId: id, rev: t.body.thesis.rev });
    expect(saved.statusCode, JSON.stringify(saved.body)).toBe(200);
  });
});
