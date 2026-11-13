// api/forge/shared-research.route.test.js
//
// Shared Research B1 — the route (spec §6.2, §6.3, §6.11, §9, §12 focused
// cases, §15), on the atomic in-memory Firestore double with the model and the
// search as seams (no network). The rows: the gate order; every action's
// refusals; Correction B (two companies → two prompts, two exchanges);
// Correction A at the route; a stepId replay makes no model call; an aborted
// model answers 504 and records the failure; a failed search runs the turn
// without verified facts; the drop entry; the provenance stamp; preview_stale
// after a step and the saved v1's refs; fields a client plants are ignored;
// the shadow log.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeSrFirestore } from '../_utils/sharedResearch/__fixtures__/srFirestore.js';

const state = vi.hoisted(() => ({
  mode: 'on', user: { uid: 'u1' }, db: null, turns: [], turnQueue: [], retrievals: [], retrievalQueue: [], logs: [],
}));
vi.mock('../../src/config/sharedResearchFlags.js', () => ({
  SHARED_RESEARCH_MODES: Object.freeze(['off', 'allowlist', 'on']),
  get SHARED_RESEARCH_MODE() { return state.mode; },
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
const { SHARED_RESEARCH_LIST_MARKER } = await import('../_utils/hypothesisRecords/model.js');

const UID = 'u1';
const AGENT = { ownerId: UID, name: 'Rook', archetype: 'contrarian', loadouts: { baggerbomb: { archetype: 'momentum_chaser', book: null } } };
const STAMP = { agentId: 'agent-1', archetypeCodeId: 'contrarian', baggerbombArchetypeCodeId: 'momentum_chaser', identityVersion: 2 };
const STORY = { headline: 'Switchgear backlogs stretch as data centers expand', reporterName: 'Kim', reporterBeat: 'Sector Strategist', publishedAt: '2026-11-12T13:00:00.000Z', primaryTicker: 'ETN', tickers: ['ETN', 'GEV'], status: 'published', type: 'sector' };
const ITEMS = [
  { index: 0, url: 'https://news.example.com/eaton', title: 'Eaton books data-center orders', host: 'news.example.com', publishedDate: '2026-11-06T00:00:00.000Z', highlights: ['Eaton said data-center orders rose.'] },
  { index: 1, url: 'https://news.example.com/gev', title: 'GE Vernova sells turbines to data centers', host: 'news.example.com', publishedDate: '2026-11-07T00:00:00.000Z', highlights: ['GE Vernova sells turbines.'] },
];
const QUESTION = 'Which companies earn from the switchgear backlog, and how directly?';

const seed = () => makeSrFirestore({
  'agents/agent-1': AGENT,
  'fantasyTimesStories/story-1': STORY,
  'fantasyTimesStories/deep-1': { ...STORY, type: 'deepdive' },
  'peerRankings/ETN': { ticker: 'ETN', name: 'Eaton Corporation plc', sector: 'Industrials' },
  'peerRankings/GEV': { ticker: 'GEV', name: 'GE Vernova Inc.', sector: 'Industrials' },
  'estimatesCache/latest': { computedAt: '2026-11-12T06:00:00.000Z', stocks: { ETN: { forwardEstimates: { currentYear: { growth: '0.12' }, nextYear: { growth: '0.15', numAnalysts: '20' } } } } },
  [`users/${UID}/signalDrops/drop-1`]: { dropId: 'drop-1', userId: UID, input: { type: 'text', text: 'ETN is the switchgear winner', note: null }, parse: { topic: 'switchgear backlog', dataPoints: ['ETN orders up 20%', 'lead times past a year'], extractedText: 'OCR', impliedTickers: ['GEV'] }, validation: { validated: [{ symbol: 'ETN', sectorId: 'XLI' }], unsupported: [] }, shouldBailout: false, droppedAt: '2026-11-12T12:00:00.000Z' },
  [`users/${UID}/signalDrops/drop-bail`]: { dropId: 'drop-bail', userId: UID, input: { type: 'text', text: 'just vibes', note: null }, parse: { topic: '', dataPoints: [] }, validation: { validated: [], unsupported: [] }, shouldBailout: true, droppedAt: '2026-11-12T12:00:00.000Z' },
  'users/u2/signalDrops/drop-2': { dropId: 'drop-2', userId: 'u2', input: { type: 'text', text: 'theirs', note: null }, parse: {}, validation: { validated: [] } },
});

const res = () => { const r = { statusCode: null, body: null, headers: {} }; r.status = (c) => { r.statusCode = c; return r; }; r.json = (b) => { r.body = b; return r; }; r.setHeader = (k, v) => { r.headers[k] = v; return r; }; return r; };
const post = async (body) => { const r = res(); await handler({ method: 'POST', headers: {}, query: {}, body }, r); return r; };
const get = async (query) => { const r = res(); await handler({ method: 'GET', headers: {}, query, body: undefined }, r); return r; };
const turnOk = (output) => ({ ok: true, output, usage: { input: 9000, output: 700 }, model: 'claude-sonnet-5-5', attempts: 1, elapsedMs: 900, costUsd: 0.025, stopReason: 'end_turn' });
const uuid = (n) => `9a8b7c6d-5e4f-4a3b-8c2d-${String(n).padStart(12, '0')}`;
const sessionDoc = (id) => state.db && seedEnv.doc(`sharedResearchSessions/${id}`);
const recordDoc = (id) => seedEnv.doc(`researchWork/sr_${id}`);
let seedEnv;

beforeEach(() => {
  seedEnv = seed();
  Object.assign(state, { mode: 'on', user: { uid: UID }, db: seedEnv.db, turns: [], turnQueue: [], retrievals: [], retrievalQueue: [], logs: [] });
});

async function openStory(over = {}) {
  const r = await post({ action: 'open', requestId: over.requestId ?? 'req-1', entry: { kind: 'item', itemRef: { recordKind: 'fantasyTimesStories', recordId: 'story-1' }, question: QUESTION, ...over.entry }, ...over.body });
  expect(r.statusCode, JSON.stringify(r.body)).toBe(200);
  return r.body;
}
/** The model finds Eaton and GE Vernova, each with an open significance question. */
const twoCompanies = () => turnOk({
  reply: 'Eaton and GE Vernova both sell power equipment to data-center builders.',
  findings: [
    { tempId: 'e', kind: 'relationship', fact: 'Eaton sells switchgear to data-center builders.', symbolCandidate: 'ETN', companyName: 'Eaton', support: { kind: 'retrieval', index: 0, from: [], reason: null }, at: null, supersedes: null },
    { tempId: 'eo', kind: 'relationship', fact: "The size of Eaton's data-center sales is not disclosed.", symbolCandidate: 'ETN', companyName: 'Eaton', support: { kind: 'unresolved', index: null, from: [], reason: 'not_disclosed' }, at: null, supersedes: null },
    { tempId: 'g', kind: 'relationship', fact: 'GE Vernova sells turbines to data centers.', symbolCandidate: 'GEV', companyName: 'GE Vernova', support: { kind: 'retrieval', index: 1, from: [], reason: null }, at: null, supersedes: null },
  ],
  summary: { text: 'Eaton sells switchgear to data-center builders; GE Vernova sells turbines to data centers.', basedOn: ['e', 'g'] },
  lines: { support: 'e', complication: null, missing: 'eo' },
  nextAction: { label: "Size Eaton's data-center sales", purpose: 'Significance is the weakest link.' },
  companies: [
    { companyName: 'Eaton', symbolCandidate: 'ETN', role: 'Supplier', relationshipRef: 'e', openRef: 'eo', claim: null },
    { companyName: 'GE Vernova', symbolCandidate: 'GEV', role: 'Supplier', relationshipRef: 'g', openRef: null, claim: null },
  ],
});
const quiet = () => turnOk({ reply: 'Nothing new this step.', findings: [], summary: null, lines: { support: null, complication: null, missing: null }, nextAction: { label: 'Look for a filing', purpose: 'Primary source.' }, companies: [] });
async function stepWith(sessionId, n, intent, answer, extra = {}) {
  state.retrievalQueue.push({ items: ITEMS, costDollars: 0.005, elapsedMs: 300, readAt: new Date().toISOString() });
  if (answer) state.turnQueue.push(answer);
  return post({ action: 'step', sessionId, stepId: uuid(n), intent, ...extra });
}

describe('the gate order (spec §6.2)', () => {
  it("'off': every action and read answers 404 disabled before auth — no read, no write", async () => {
    state.mode = 'off';
    state.user = null;
    for (const r of [await post({ action: 'frame', observation: 'x', requestId: 'r' }), await get({ list: 'open' })]) {
      expect([r.statusCode, r.body]).toEqual([404, { error: 'disabled' }]);
    }
    expect(seedEnv.reads).toEqual([]);
    expect(seedEnv.writes).toEqual([]);
  });
  it('on, without a token: 401', async () => {
    state.user = null;
    expect((await post({ action: 'frame' })).statusCode).toBe(401);
  });
});

describe('open from a story (spec §4.2, §6.3)', () => {
  it('the opening: reporter content, the names\' stored facts, the next action; the stamp from the ranked agent; nothing Source-backed from the story', async () => {
    const out = await openStory();
    expect(out.session).toMatchObject({ status: 'open', stepsUsed: 0, stepBudget: 10, entry: { kind: 'item', names: ['ETN', 'GEV'] } });
    expect(out.session).not.toHaveProperty('attribution');
    const [story] = out.record.findings;
    expect(story).toMatchObject({ kind: 'coverage', symbol: 'ETN', status: 'unverified', statusReason: 'reporter_content', source: { recordKind: 'fantasyTimesStories', recordId: 'story-1' } });
    expect(out.record.findings.filter((f) => f.kind === 'earnings_fact').map((f) => f.source.recordKind)).toEqual(['estimatesCache']);
    expect(out.record.nextAction).toMatchObject({ kind: 'next_action', statusReason: 'proposed' });
    expect(out.record.summary).toBeNull();
    expect(out.opening.storedRows.map((r) => [r.symbol, r.name])).toEqual([['ETN', 'Eaton Corporation plc'], ['GEV', 'GE Vernova Inc.']]);
    expect(out.quota).toEqual({ investigationsToday: 1, perDay: 3, framingsToday: 0, framingsPerDay: 10 });
    expect(sessionDoc(out.session.sessionId).attribution).toMatchObject(STAMP);
  });
  it('refusals: an unsupported kind, a mismatched entry, a missing or deep-dive story, a bad question, a bad request id', async () => {
    const entry = { kind: 'item', itemRef: { recordKind: 'fantasyTimesStories', recordId: 'story-1' }, question: QUESTION };
    const cases = [
      [{ ...entry, itemRef: { recordKind: 'researchWork', recordId: 'x' } }, 'req', 400, 'item_kind_unsupported'],
      [{ ...entry, kind: 'signaldrop' }, 'req', 400, 'invalid_entry'],
      [{ ...entry, kind: 'theme' }, 'req', 400, 'invalid_entry'],
      [{ ...entry, itemRef: { recordKind: 'fantasyTimesStories', recordId: 'nope' } }, 'req', 404, 'item_not_found'],
      [{ ...entry, itemRef: { recordKind: 'fantasyTimesStories', recordId: 'deep-1' } }, 'req', 404, 'item_not_found'],
      [{ ...entry, question: '   ' }, 'req', 400, 'invalid_question'],
      [{ ...entry, question: 'x'.repeat(501) }, 'req', 400, 'invalid_question'],
      [entry, 'bad id!', 400, 'invalid_request'],
    ];
    for (const [e, requestId, status, code] of cases) {
      const r = await post({ action: 'open', requestId, entry: e });
      expect([r.statusCode, r.body.error], code).toEqual([status, code]);
    }
  });
  it('a second open of the same story answers the existing investigation', async () => {
    const first = await openStory();
    const again = await openStory({ requestId: 'req-2' });
    expect(again.existing).toBe(true);
    expect(again.session.sessionId).toBe(first.session.sessionId);
  });
});

describe('§15 S-1 — open from the player\'s own SignalDrop', () => {
  const openDrop = (recordId, requestId = 'd1') => post({ action: 'open', requestId, entry: { kind: 'signaldrop', itemRef: { recordKind: 'signalDrops', recordId }, question: 'What is behind the switchgear backlog, and which company earns from it?' } });
  it('"Your drop", its claims as "From your drop", the validated names\' facts; the topic on the entry; impliedTickers never names', async () => {
    const r = await openDrop('drop-1');
    expect(r.statusCode).toBe(200);
    expect(r.body.session.entry).toMatchObject({ kind: 'signaldrop', topic: 'switchgear backlog', names: ['ETN'] });
    const fs = r.body.record.findings;
    expect(fs[0]).toMatchObject({ kind: 'observation', fact: 'ETN is the switchgear winner', statusReason: 'player_drop', source: { recordKind: 'exchange', recordId: null, label: 'Your drop · text' } });
    expect(fs.filter((f) => f.statusReason === 'from_drop').map((f) => [f.fact, f.symbol])).toEqual([['ETN orders up 20%', 'ETN'], ['lead times past a year', null]]);
    expect(JSON.stringify(r.body.record)).not.toContain('GEV');
    expect(r.body.session.exchanges[0]).toMatchObject({ who: 'player', kind: 'observation', text: 'ETN is the switchgear winner' });
  });
  it("another owner's drop is item_not_found; a bailout parse still opens", async () => {
    expect((await openDrop('drop-2')).body.error).toBe('item_not_found');
    const bail = await openDrop('drop-bail', 'd2');
    expect(bail.statusCode).toBe(200);
    expect(bail.body.record.findings.map((f) => f.kind)).toEqual(['observation', 'next_action']);
  });
});

describe('frame → open (an observation)', () => {
  it('one model call frames the question; open mints the record with the confirmed question; refusals', async () => {
    state.turnQueue.push({ ...turnOk({ question: 'Which companies sell tools that shorten security reviews?', check: 'Find who sells review-automation tools.', notEstablished: 'That reviews delay deals at all.' }), model: 'claude-haiku-5-5' });
    const f = await post({ action: 'frame', observation: 'Security reviews and integration requirements often delay approvals.', requestId: 'fr-1' });
    expect(f.statusCode).toBe(200);
    expect(f.body).toMatchObject({ status: 'framing', frame: { question: 'Which companies sell tools that shorten security reviews?' }, quota: { framingsToday: 1 } });
    expect(state.turns[0]).toMatchObject({ kind: 'frame' });
    expect(state.turns[0].system).toMatch(/^You are Rook, /);
    const again = await post({ action: 'frame', observation: 'Security reviews and integration requirements often delay approvals.', requestId: 'fr-1' });
    expect(state.turns).toHaveLength(1); // a framed session answers itself: no second call
    expect(again.body.frame).toEqual(f.body.frame);
    const o = await post({ action: 'open', sessionId: f.body.sessionId, question: 'Which companies shorten security reviews?' });
    expect(o.statusCode).toBe(200);
    expect(o.body.record.question).toBe('Which companies shorten security reviews?');
    expect(o.body.record.findings[0]).toMatchObject({ kind: 'observation', fact: 'Security reviews and integration requirements often delay approvals.', statusReason: 'player_words' });
    expect(state.logs.find((l) => l.intent === 'frame')).toMatchObject({ gameMode: 'shared_research', model: 'claude-haiku-5-5', outcome: 'completion', methodId: 'baseline', methodVersion: 'v0' });
    expect((await post({ action: 'frame', observation: '', requestId: 'x' })).body.error).toBe('invalid_observation');
    expect((await post({ action: 'frame', observation: 'ok', requestId: '' })).body.error).toBe('invalid_request');
  });
  it('a failed framing leaves the session framing with its error, the call counted', async () => {
    state.turnQueue.push({ ok: false, reason: 'model_error_500', usage: null, model: 'claude-haiku-5-5', attempts: 1, elapsedMs: 10, costUsd: null, stopReason: null });
    const f = await post({ action: 'frame', observation: 'Reviews delay deals.', requestId: 'fr-2' });
    expect([f.statusCode, f.body.error, f.body.status]).toEqual([200, 'frame_failed', 'framing']);
    expect(sessionDoc(f.body.sessionId).lastError).toMatchObject({ code: 'frame_failed', reason: 'model_error_500' });
  });
});

describe('steps', () => {
  it('Correction B — two "Examine" steps on two companies: two distinct target blocks in the prompts, two distinct targets on the exchanges', async () => {
    const { session } = await openStory();
    const s1 = await stepWith(session.sessionId, 1, 'next', twoCompanies());
    expect(s1.statusCode, JSON.stringify(s1.body)).toBe(200);
    const supported = s1.body.companies.supported;
    expect(supported.map((c) => c.symbol)).toEqual(['ETN', 'GEV']);
    const [etn, gev] = supported;
    const a = await stepWith(session.sessionId, 2, 'examine', quiet(), { target: { symbol: 'ETN', relationshipFindingId: etn.relationshipFindingId, openFindingId: etn.openQuestion.findingId } });
    const b = await stepWith(session.sessionId, 3, 'examine', quiet(), { target: { symbol: 'GEV', relationshipFindingId: gev.relationshipFindingId, openFindingId: null } });
    expect([a.statusCode, b.statusCode]).toEqual([200, 200]);
    const [pa, pb] = state.turns.slice(1).map((t) => t.user);
    expect(pa).toContain("Investigate ETN's Eaton sells switchgear to data-center builders. Resolve: The size of Eaton's data-center sales is not disclosed.");
    expect(pb).toContain("Investigate GEV's GE Vernova sells turbines to data centers. Resolve: how much this relationship matters to its results.");
    expect(pa).not.toBe(pb);
    expect(pa).toContain(QUESTION.replace(/\?$/, ''));
    const exs = sessionDoc(session.sessionId).exchanges.filter((e) => e.intent === 'examine');
    expect(exs.map((e) => e.target)).toEqual([
      { symbol: 'ETN', relationshipFindingId: etn.relationshipFindingId, openFindingId: etn.openQuestion.findingId },
      { symbol: 'GEV', relationshipFindingId: gev.relationshipFindingId, openFindingId: null },
    ]);
    expect(state.retrievals.slice(1).map((r) => r.symbols)).toEqual([['ETN'], ['GEV']]);
  });
  it('a target naming a finding that is not this record\'s current supported relationship is invalid_target (no model call)', async () => {
    const { session } = await openStory();
    await stepWith(session.sessionId, 1, 'next', twoCompanies());
    const calls = state.turns.length;
    const bad = await stepWith(session.sessionId, 2, 'examine', null, { target: { symbol: 'ETN', relationshipFindingId: 'f_00000000-0000-4000-8000-000000000000', openFindingId: null } });
    expect([bad.statusCode, bad.body.error]).toEqual([400, 'invalid_target']);
    expect(state.turns).toHaveLength(calls);
    expect(sessionDoc(session.sessionId).lastStep).toMatchObject({ stepId: uuid(2), status: 'failed' });
  });
  it('Correction A at the route: after a refresh with no relationship, `companies` equals the answer before it', async () => {
    const { session } = await openStory();
    const s1 = await stepWith(session.sessionId, 1, 'next', twoCompanies());
    const r = await stepWith(session.sessionId, 2, 'refresh', quiet());
    expect(r.body.companies).toEqual(s1.body.companies);
  });
  it('a stepId replay returns the stored result and makes no model call', async () => {
    const { session } = await openStory();
    await stepWith(session.sessionId, 1, 'next', twoCompanies());
    const calls = state.turns.length;
    const again = await post({ action: 'step', sessionId: session.sessionId, stepId: uuid(1), intent: 'next' });
    expect([again.statusCode, again.body.replay]).toEqual([200, true]);
    expect(state.turns).toHaveLength(calls);
    expect(sessionDoc(session.sessionId).stepsUsed).toBe(1);
  });
  it('the model aborted: 504, the failure recorded on the record and the host, nothing appended, the log written', async () => {
    const { session } = await openStory();
    const findings = recordDoc(session.sessionId).findings.length;
    const r = await stepWith(session.sessionId, 1, 'next', { ok: false, reason: 'aborted', usage: null, model: 'claude-sonnet-5-5', attempts: 1, elapsedMs: 16000, costUsd: null, stopReason: null });
    expect([r.statusCode, r.body.error, r.body.reason]).toEqual([504, 'step_failed', 'aborted']);
    expect(recordDoc(session.sessionId).findings).toHaveLength(findings);
    expect(recordDoc(session.sessionId).telemetry).toMatchObject({ failures: 1, completions: 0 });
    expect(sessionDoc(session.sessionId)).toMatchObject({ stepsUsed: 0, lastStep: { status: 'failed', error: 'aborted' } });
    expect(state.logs.at(-1)).toMatchObject({ outcome: 'failure', failureReason: 'aborted', intent: 'next' });
  });
  it('a failed search: the turn runs without retrieval, the prompt says so, and no fact lands verified', async () => {
    const { session } = await openStory();
    state.retrievalQueue.push({ error: 'retrieval_failed', elapsedMs: 8000 });
    state.turnQueue.push(twoCompanies());
    const r = await post({ action: 'step', sessionId: session.sessionId, stepId: uuid(1), intent: 'next' });
    expect(r.statusCode).toBe(200);
    expect(state.turns[0].user).toContain('Retrieved items: the search could not be reached this step.');
    expect(r.body.record.findings.filter((f) => f.source.recordKind === 'retrieval')).toEqual([]);
    expect(r.body.companies.supported).toEqual([]);
  });
  it('a validation failure is a failed step: nothing appended, the failure recorded, the model not re-asked', async () => {
    const { session } = await openStory();
    const bad = twoCompanies();
    bad.output.reply = 'You should buy Eaton now.';
    const r = await stepWith(session.sessionId, 1, 'next', bad);
    expect([r.statusCode, r.body.reason]).toEqual([200, 'invalid_forbidden']);
    expect(state.turns).toHaveLength(1);
    expect(recordDoc(session.sessionId).telemetry.failures).toBe(1);
  });
  it('the budget: the 11th step is budget_spent; the app\'s ceiling is budget_paused (503) with no model call', async () => {
    const { session } = await openStory();
    seedEnv.store.get(`sharedResearchSessions/${session.sessionId}`).stepsUsed = 10;
    expect((await stepWith(session.sessionId, 1, 'next', null)).body.error).toBe('budget_spent');
    seedEnv.store.get(`sharedResearchSessions/${session.sessionId}`).stepsUsed = 0;
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
    seedEnv.store.set('sharedResearchQuota/_global', { etDate: today, steps: 150, framings: 0 });
    const paused = await stepWith(session.sessionId, 2, 'next', null);
    expect([paused.statusCode, paused.body.error]).toEqual([503, 'budget_paused']);
    expect(state.turns).toHaveLength(0);
  });
  it('a foreign session is session_not_found; malformed requests are invalid_request; a running step blocks another', async () => {
    const { session } = await openStory();
    state.user = { uid: 'u2' };
    expect((await stepWith(session.sessionId, 1, 'next', null)).body.error).toBe('session_not_found');
    expect((await get({ sessionId: session.sessionId })).body.error).toBe('session_not_found');
    state.user = { uid: UID };
    expect((await post({ action: 'step', sessionId: session.sessionId, stepId: 'not-a-uuid', intent: 'next' })).body.error).toBe('invalid_request');
    expect((await post({ action: 'step', sessionId: session.sessionId, stepId: uuid(1), intent: 'teleport' })).body.error).toBe('invalid_request');
    expect((await post({ action: 'step', sessionId: session.sessionId, stepId: uuid(1), intent: 'direction', direction: '' })).body.error).toBe('invalid_direction');
    seedEnv.store.get(`sharedResearchSessions/${session.sessionId}`).lastStep = { stepId: uuid(9), status: 'running', startedAt: new Date().toISOString() };
    expect((await stepWith(session.sessionId, 1, 'next', null)).body.error).toBe('step_in_flight');
    expect((await post({ action: 'nope' })).body.error).toBe('invalid_request');
  });
  it('every completed model call is logged with its usage, attempts and cost', async () => {
    const { session } = await openStory();
    await stepWith(session.sessionId, 1, 'next', twoCompanies());
    expect(state.logs.at(-1)).toMatchObject({
      userId: UID, gameMode: 'shared_research', sessionId: session.sessionId, researchWorkId: `sr_${session.sessionId}`, stepId: uuid(1), intent: 'next',
      model: 'claude-sonnet-5-5', attempts: 1, usage: { input: 9000, output: 700 }, costUsd: 0.025, outcome: 'completion',
      retrieval: { calls: 1, costDollars: 0.005, elapsedMs: 300 }, methodId: 'baseline', methodVersion: 'v0',
    });
  });
});

describe('close', () => {
  it('concluded → completed / concluded; refusals', async () => {
    const { session } = await openStory();
    const r = await post({ action: 'close', sessionId: session.sessionId, reason: 'concluded' });
    expect(r.body.record).toMatchObject({ state: 'completed', terminalReason: 'concluded' });
    expect((await post({ action: 'close', sessionId: session.sessionId, reason: 'whatever' })).body.error).toBe('invalid_request');
  });
});

describe('adopt (spec §6.6, Correction C at the route)', () => {
  async function ready() {
    const { session } = await openStory();
    await stepWith(session.sessionId, 1, 'next', twoCompanies());
    const g = await get({ sessionId: session.sessionId });
    return { sessionId: session.sessionId, preview: g.body.adoptPreview };
  }
  it('preview_stale after a step between the preview and Save', async () => {
    const { sessionId, preview } = await ready();
    await stepWith(sessionId, 2, 'refresh', quiet());
    const etn = preview.companies.find((c) => c.symbol === 'ETN');
    const r = await post({ action: 'adopt', sessionId, statement: etn.fragment, horizonEnum: 'positional', symbols: ['ETN'], previewRev: preview.previewRev });
    expect([r.statusCode, r.body.error]).toEqual([409, 'preview_stale']);
    expect(r.body.adoptPreview.previewRev.findingsCount).toBeGreaterThan(preview.previewRev.findingsCount);
  });
  it('the saved v1 cites the carried set in order; planted client fields (refs, kept findings, origin, marker, attribution) change nothing', async () => {
    const { sessionId, preview } = await ready();
    const etn = preview.companies.find((c) => c.symbol === 'ETN');
    const r = await post({
      action: 'adopt', sessionId, statement: etn.fragment, horizonEnum: 'positional', symbols: ['ETN'], previewRev: preview.previewRev,
      // planted — every one ignored:
      keptFindingIds: ['f_00000000-0000-4000-8000-000000000001'], evidenceRefs: [{ kind: 'researchWork', id: 'sr_forged' }], origin: 'manual',
      [SHARED_RESEARCH_LIST_MARKER]: 'forged', attribution: { agentId: 'forged-agent' }, findings: [{ fact: 'forged' }], summary: { text: 'forged' },
    });
    expect(r.statusCode, JSON.stringify(r.body)).toBe(200);
    const v = seedEnv.doc(`watchlists/${r.body.watchlistId}/hypothesisVersions/v1`);
    expect(v.evidenceRefs.slice(1, -1).map((ref) => ref.itemId)).toEqual(etn.carried);
    expect(v.origin).toBe('shared_research');
    const list = seedEnv.doc(`watchlists/${r.body.watchlistId}`);
    expect(list[SHARED_RESEARCH_LIST_MARKER]).toBe(sessionId);
    expect(list).toMatchObject({ status: 'committed', attribution: STAMP });
    expect(JSON.stringify(seedEnv.doc(`researchWork/sr_${sessionId}`))).not.toContain('forged');
  });
  it('unsupported_assertion and names_not_supported are 400s with nothing created', async () => {
    const { sessionId, preview } = await ready();
    const base = { action: 'adopt', sessionId, horizonEnum: 'swing', symbols: ['ETN'], previewRev: preview.previewRev };
    expect((await post({ ...base, statement: 'Eaton sells switchgear; orders rose 71%.' })).body).toMatchObject({ error: 'unsupported_assertion', detail: '71' });
    expect((await post({ ...base, statement: 'Eaton and GE Vernova sell gear.' })).body).toMatchObject({ error: 'names_not_supported' });
    expect((await post({ ...base, horizonEnum: 'intraday', statement: 'Eaton sells switchgear.' })).body).toMatchObject({ error: 'invalid_adoption', reason: 'invalid_horizon' });
    expect([...seedEnv.store.keys()].some((k) => k.startsWith('watchlists/'))).toBe(false);
  });
});

describe('GET', () => {
  it('?list=open: the caller\'s open investigations; ?sessionId: the projection, companies, preview, stored rows, quota', async () => {
    const { session } = await openStory();
    const l = await get({ list: 'open' });
    expect(l.body.open.map((o) => o.sessionId)).toEqual([session.sessionId]);
    const g = await get({ sessionId: session.sessionId });
    expect(Object.keys(g.body).sort()).toEqual(['adoptPreview', 'companies', 'quota', 'record', 'session', 'storedRows']);
    expect(g.body.record).not.toHaveProperty('symbolKeys');
    expect((await get({ sessionId: 'bad id!' })).body.error).toBe('invalid_request');
  });
});
