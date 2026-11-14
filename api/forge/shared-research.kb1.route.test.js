// api/forge/shared-research.kb1.route.test.js
//
// KB-1 — THE ROUTE ON THE KB METHOD (Amendment A §A4; the KB-1 build prompt,
// Part 7 rows 1–5, 9–11), on the atomic in-memory Firestore double with the
// model and the search as seams (no network, no database, no model).
//
// The KB loader is MOCKED (its vi.mock below): its factory reads the REAL
// v0.1 method through the real loader with a test-only authorization list (the
// shipped list is empty), and each row decides what the two entry points
// answer — by default, what the real loader answers for an `allowlist` entry:
// ok for a player the audience function admits, `audience` for any other. The
// audience module is the real one wrapped in a spy; the allowlist predicate is
// mocked so that only `u-listed` is on the list. The idea-version builder is
// wrapped to capture its input (row 4). The real loader with the shipped list
// is shared-research.route.test.js's row.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { makeSrFirestore } from '../_utils/sharedResearch/__fixtures__/srFirestore.js';

const state = vi.hoisted(() => ({
  mode: 'on', user: { uid: 'u-listed' }, db: null, turns: [], turnQueue: [], retrievals: [], retrievalQueue: [], logs: [],
  listed: ['u-listed'], kbAnswer: null, offer: null, load: null, offerCalls: [], loadCalls: [], audience: null, builds: [], realBuild: null, tooLarge: false,
}));
vi.mock('../../src/config/sharedResearchFlags.js', () => ({
  SHARED_RESEARCH_MODES: Object.freeze(['off', 'allowlist', 'on']),
  get SHARED_RESEARCH_MODE() { return state.mode; },
}));
vi.mock('../_utils/callRecords/mode.js', () => ({ isCockpitOwnerAllowlisted: (uid) => state.listed.includes(uid) }));
vi.mock('../_utils/hypothesisRecords/gate.js', () => ({ hypothesisRecordsOnFor: () => true }));
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => state.db }));
vi.mock('../_utils/security.js', () => ({ applySecurityMiddleware: () => false }));
vi.mock('../_utils/authMiddleware.js', () => ({
  requireAuth: async (req, res) => { if (!state.user) { res.status(401).json({ error: 'unauthorized' }); return null; } return state.user; },
}));
vi.mock('../_utils/shadowLogger.js', () => ({ logConversation: async (r) => { state.logs.push(structuredClone(r)); return true; } }));
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
vi.mock('../_utils/sharedResearch/promptBudget.js', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, fitPrompt: (args) => (state.tooLarge ? { ok: false, error: 'prompt_too_large', tokens: 99_999 } : real.fitPrompt(args)) };
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
vi.mock('../_utils/kb/loader.js', async (importOriginal) => {
  const real = await importOriginal();
  const entry = {
    id: 'KB-IDEA-EVALUATION-001', version: '0.1',
    sha256: 'b0688fb33cdd5b16835a5a70f7fcef7ca79d00facced233d1529d26b4e77854e',
    acceptanceSha256: 'ec709781b80d2deeb325702faccb7a90abaa0c244c96103f0e956f81d26a08ee',
    consumers: ['shared_research.observation'], audience: 'allowlist',
    authorizedAt: '2026-11-13T17:00:00Z', authorizedBy: 'test', evidenceRef: 'docs/approvals/KB1_TEST_ONLY.md',
  };
  state.kbAnswer = real.authorizedMethodFor({ consumer: 'shared_research.observation', inAudience: () => true }, { authorizations: [entry] });
  const byAudience = (req) => (typeof req?.inAudience === 'function' && req.inAudience('allowlist') === true ? state.kbAnswer : { ok: false, reason: 'audience' });
  return {
    ...real,
    authorizedMethodFor(...args) { state.offerCalls.push(args); return (state.offer ?? byAudience)(...args); },
    loadAuthorizedMethod(...args) { state.loadCalls.push(args); return (state.load ?? byAudience)(...args); },
  };
});
vi.mock('../_utils/kb/audience.js', async (importOriginal) => {
  const real = await importOriginal();
  state.audience = vi.fn((uid) => real.inAudienceFor(uid));
  return { inAudienceFor: state.audience };
});
vi.mock('../_utils/hypothesisRecords/model.js', async (importOriginal) => {
  const real = await importOriginal();
  state.realBuild = real.buildSharedResearchVersion;
  return { ...real, buildSharedResearchVersion: (input) => { state.builds.push(structuredClone(input)); return real.buildSharedResearchVersion(input); } };
});

const { default: handler } = await import('./shared-research.js');
const { resetUidRateLimits } = await import('../_utils/sharedResearch/gate.js');
const { METHOD, METHOD_SOURCE, BASELINE } = await import('../_utils/sharedResearch/method.js');
const { seenSha256Of } = await import('../_utils/sharedResearch/session.js');
const { contentHashOf } = await import('../_utils/hypothesisRecords/model.js');

/** main's baseline system prompts (c85f7b41), captured before the change — what a baseline turn must send, byte for byte. */
const MAIN = JSON.parse(readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '_utils', 'sharedResearch', '__fixtures__', 'baselinePrompts.main.json'), 'utf8'));
/** Every path in a document holding `undefined` — Firestore refuses one; the in-memory double keeps it. */
const undefinedPaths = (v, at = '') => (v === undefined ? [at] : v && typeof v === 'object' ? Object.entries(v).flatMap(([k, x]) => undefinedPaths(x, `${at}.${k}`)) : []);
const KB_REF = Object.freeze({ id: 'KB-IDEA-EVALUATION-001', version: '0.1', sha256: 'b0688fb33cdd5b16835a5a70f7fcef7ca79d00facced233d1529d26b4e77854e', source: 'kb' });
const BASE_REF = Object.freeze({ id: 'baseline', version: 'v0', sha256: BASELINE.sha256, source: 'baseline' });
const KB_SOURCE = Object.freeze({ recordKind: 'kb', recordId: 'KB-IDEA-EVALUATION-001@0.1', label: 'Method · Evaluating an Idea v0.1' });
const KB_HEADER = 'METHOD — KB-IDEA-EVALUATION-001 v0.1 "Evaluating an Idea" · accepted 2026-11-12 · sha256 b0688fb3…';
const AGENT = (uid, name) => ({ ownerId: uid, name, archetype: 'contrarian', loadouts: { baggerbomb: { archetype: 'momentum_chaser', book: null } } });
const STORY = { headline: 'Switchgear backlogs stretch as data centers expand', reporterName: 'Kim', reporterBeat: 'Sector Strategist', publishedAt: '2026-11-12T13:00:00.000Z', primaryTicker: 'ETN', tickers: ['ETN', 'GEV'], status: 'published', type: 'sector' };
const QUESTION = 'Which companies earn from the switchgear backlog, and how directly?';
const OBSERVATION = 'Data-center builders keep waiting on power equipment.';
const ITEMS = [
  { index: 0, url: 'https://news.example.com/eaton', title: 'Eaton books data-center orders', host: 'news.example.com', publishedDate: '2026-11-06T00:00:00.000Z', highlights: ['Eaton said data-center orders rose.'] },
  { index: 1, url: 'https://news.example.com/gev', title: 'GE Vernova sells turbines to data centers', host: 'news.example.com', publishedDate: '2026-11-07T00:00:00.000Z', highlights: ['GE Vernova sells turbines.'] },
];

const seed = () => makeSrFirestore({
  'agents/agent-1': AGENT('u-listed', 'Rook'),
  'agents/agent-2': AGENT('u-off', 'Wren'),
  'fantasyTimesStories/story-1': STORY,
  'peerRankings/ETN': { ticker: 'ETN', name: 'Eaton Corporation plc', sector: 'Industrials' },
  'peerRankings/GEV': { ticker: 'GEV', name: 'GE Vernova Inc.', sector: 'Industrials' },
  'users/u-listed/signalDrops/drop-1': { dropId: 'drop-1', userId: 'u-listed', input: { type: 'text', text: 'ETN is the switchgear winner', note: null }, parse: { topic: 'switchgear backlog', dataPoints: [] }, validation: { validated: [{ symbol: 'ETN', sectorId: 'XLI' }], unsupported: [] }, shouldBailout: false, droppedAt: '2026-11-12T12:00:00.000Z' },
});
let seedEnv;
const res = () => { const r = { statusCode: null, body: null, headers: {} }; r.status = (c) => { r.statusCode = c; return r; }; r.json = (b) => { r.body = b; return r; }; r.setHeader = (k, v) => { r.headers[k] = v; return r; }; return r; };
const answers = [];
const post = async (body) => { resetUidRateLimits(); const r = res(); await handler({ method: 'POST', headers: {}, query: {}, body }, r); answers.push(r.body); return r; };
const get = async (query) => { resetUidRateLimits(); const r = res(); await handler({ method: 'GET', headers: {}, query, body: undefined }, r); answers.push(r.body); return r; };
const turnOk = (output, model = 'claude-sonnet-5-5') => ({ ok: true, output, usage: { input: 9000, output: 700 }, model, attempts: 1, elapsedMs: 900, costUsd: 0.025, stopReason: 'end_turn' });
const frameOk = () => turnOk({ question: 'Which companies sell power equipment to data-center builders?', check: 'Find who supplies switchgear to data-center builders.', notEstablished: 'That builders are waiting at all.' }, 'claude-haiku-5-5');
const uuid = (n) => `9a8b7c6d-5e4f-4a3b-8c2d-${String(n).padStart(12, '0')}`;
const sessionDoc = (id) => seedEnv.doc(`sharedResearchSessions/${id}`);
const recordDoc = (id) => seedEnv.doc(`researchWork/sr_${id}`);
const partnerTurns = (id) => sessionDoc(id).exchanges.filter((e) => e.who === 'partner');
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
const quiet = (reply = 'Nothing new this step.') => turnOk({ reply, findings: [], summary: null, lines: { support: null, complication: null, missing: null }, nextAction: { label: 'Look for a filing', purpose: 'Primary source.' }, companies: [] });
async function step(sessionId, n, answer, { intent = 'next', items = ITEMS, retrieval = null, extra = {} } = {}) {
  state.retrievalQueue.push(retrieval ?? { items, costDollars: 0.005, elapsedMs: 300, readAt: new Date().toISOString() });
  if (answer) state.turnQueue.push(answer);
  return post({ action: 'step', sessionId, stepId: uuid(n), intent, ...extra });
}
/** An own-words investigation, framed and opened, as `uid` — the body planting another uid each time (row 2). */
async function ownWords({ uid = 'u-listed', requestId = 'fr-1' } = {}) {
  state.user = { uid };
  state.turnQueue.push(frameOk());
  const f = await post({ action: 'frame', observation: OBSERVATION, requestId, uid: 'u-listed', userId: 'u-listed', user: { uid: 'u-listed' } });
  expect(f.statusCode, JSON.stringify(f.body)).toBe(200);
  const o = await post({ action: 'open', sessionId: f.body.sessionId, question: QUESTION, uid: 'u-listed' });
  expect(o.statusCode, JSON.stringify(o.body)).toBe(200);
  return { sessionId: f.body.sessionId, frame: f, open: o };
}
async function openStory(requestId = 'req-1') {
  const r = await post({ action: 'open', requestId, entry: { kind: 'item', itemRef: { recordKind: 'fantasyTimesStories', recordId: 'story-1' }, question: QUESTION } });
  expect(r.statusCode, JSON.stringify(r.body)).toBe(200);
  return r.body.session.sessionId;
}

beforeEach(() => {
  seedEnv = seed();
  answers.length = 0;
  Object.assign(state, {
    mode: 'on', user: { uid: 'u-listed' }, db: seedEnv.db, turns: [], turnQueue: [], retrievals: [], retrievalQueue: [], logs: [],
    listed: ['u-listed'], offer: null, load: null, offerCalls: [], loadCalls: [], builds: [], tooLarge: false,
  });
  state.audience.mockClear();
});

describe('the KB answer these rows run on', () => {
  it('is the real v0.1 method from the real loader (a test-only list)', () => {
    expect(state.kbAnswer).toMatchObject({ ok: true, method: { id: 'KB-IDEA-EVALUATION-001', version: '0.1', title: 'Evaluating an Idea', sha256: KB_REF.sha256 } });
  });
});

describe('row 1 — selection at the route', () => {
  it('own words, a player in the audience: the session is stamped with the KB method once, at frame; the frame runs on it', async () => {
    const { sessionId } = await ownWords();
    const s = sessionDoc(sessionId);
    expect(s.method).toEqual({ ...KB_REF, consumer: 'shared_research.observation', selectedAt: s.createdAt });
    expect('fallbackReason' in s.method).toBe(false);
    expect(state.offerCalls).toHaveLength(1); // selected once: open selects nothing
    expect(state.turns[0].system).toContain(KB_HEADER);
    expect(state.turns[0].system).not.toContain(METHOD.text);
    expect(partnerTurns(sessionId)[0]).toMatchObject({ kind: 'frame', method: KB_REF });
  });

  it.each([['a story', 'item'], ['a drop', 'signaldrop']])('%s: the baseline by rule — no fallbackReason, no consumer, the loader never asked, even when it would answer ok', async (_label, kind) => {
    state.offer = () => state.kbAnswer;
    state.load = () => state.kbAnswer;
    const sessionId = kind === 'item'
      ? await openStory()
      : (await post({ action: 'open', requestId: 'req-d', entry: { kind: 'signaldrop', itemRef: { recordKind: 'signalDrops', recordId: 'drop-1' }, question: QUESTION } })).body.session.sessionId;
    expect(sessionDoc(sessionId).method).toEqual({ ...BASE_REF, consumer: null, selectedAt: sessionDoc(sessionId).createdAt });
    expect(recordDoc(sessionId).findings.at(-1)).toMatchObject({ kind: 'next_action', source: METHOD_SOURCE });
    await step(sessionId, 1, twoCompanies());
    expect(partnerTurns(sessionId).at(-1)).toMatchObject({ kind: 'step', method: BASE_REF });
    expect(state.turns.at(-1).system).toBe(MAIN.step.Rook); // what the route SENT, byte for byte main's (review TST-9)
    expect(recordDoc(sessionId).findings.filter((f) => f.kind === 'next_action').at(-1).source).toEqual(METHOD_SOURCE);
    expect(state.offerCalls).toEqual([]);
    expect(state.loadCalls).toEqual([]);
  });
});

describe('row 6 at the route — a baseline turn sends main\'s prompts byte for byte (review TST-9)', () => {
  it('own words refused (the shipped case): the frame and the step the route sends equal main\'s, for the partner Rook', async () => {
    state.offer = () => ({ ok: false, reason: 'not_authorized' });
    const { sessionId } = await ownWords();
    await step(sessionId, 1, twoCompanies());
    expect(state.turns.map((t) => [t.kind, t.system])).toEqual([['frame', MAIN.frame.Rook], ['step', MAIN.step.Rook]]);
    expect(partnerTurns(sessionId).map((t) => t.method)).toEqual([BASE_REF, BASE_REF]);
  });
});

describe('row 2 — the method\'s audience, whatever the mode', () => {
  it('mode on, a player off the method\'s list: the frame and every step run on the baseline, each recorded — the uid is the gate\'s, never a body field', async () => {
    state.mode = 'on';
    const { sessionId } = await ownWords({ uid: 'u-off', requestId: 'fr-off' });
    expect(sessionDoc(sessionId).method).toMatchObject({ ...BASE_REF, consumer: 'shared_research.observation', fallbackReason: 'audience' });
    await step(sessionId, 1, twoCompanies());
    await step(sessionId, 2, quiet());
    const turns = partnerTurns(sessionId);
    expect(turns.map((t) => [t.kind, t.method])).toEqual([['frame', BASE_REF], ['step', BASE_REF], ['step', BASE_REF]]);
    expect(turns.some((t) => t.methodChange)).toBe(false);
    for (const t of state.turns) expect(t.system).toContain(METHOD.text);
    expect(state.logs.map((l) => [l.intent, l.methodSource, l.methodSha256])).toEqual([['frame', 'baseline', BASELINE.sha256], ['next', 'baseline', BASELINE.sha256], ['next', 'baseline', BASELINE.sha256]]);
    // Every audience function was made for the gate's uid; the planted body uid never reached one.
    expect(state.audience.mock.calls.length).toBeGreaterThan(0);
    expect(new Set(state.audience.mock.calls.map((c) => c[0]))).toEqual(new Set(['u-off']));
  });

  it('…and the same mode, a player on the list: the KB method', async () => {
    const { sessionId } = await ownWords({ uid: 'u-listed', requestId: 'fr-on' });
    expect(sessionDoc(sessionId).method.source).toBe('kb');
    expect(new Set(state.audience.mock.calls.map((c) => c[0]))).toEqual(new Set(['u-listed']));
  });

  it('every step re-checks the audience for the gate\'s uid: the player taken off the list, a listed uid planted in the step\'s body → the baseline, audience', async () => {
    const { sessionId } = await ownWords({ uid: 'u-listed', requestId: 'fr-step' });
    await step(sessionId, 1, quiet());
    state.listed = ['u-vip']; // the founder narrows the method's list
    state.audience.mockClear();
    await step(sessionId, 2, quiet(), { extra: { uid: 'u-vip', userId: 'u-vip', user: { uid: 'u-vip' } } });
    expect(partnerTurns(sessionId).slice(1).map((t) => [t.method.source, t.methodChange ?? null])).toEqual([
      ['kb', null], ['baseline', { from: 'KB-IDEA-EVALUATION-001@0.1', to: 'baseline@v0', reason: 'audience' }],
    ]);
    expect(new Set(state.audience.mock.calls.map((c) => c[0]))).toEqual(new Set(['u-listed']));
  });
});

describe('row 3 — the method on every turn', () => {
  it('frame and steps carry their method; a revocation gives the next step the baseline and a methodChange; restored, the KB method and a change with no reason; the stamp never moves', async () => {
    const { sessionId } = await ownWords();
    const stamp = structuredClone(sessionDoc(sessionId).method);
    // The opening's next action, written from the frame, cites the KB method.
    expect(recordDoc(sessionId).findings.at(-1)).toMatchObject({ kind: 'next_action', source: KB_SOURCE });
    await step(sessionId, 1, twoCompanies());
    state.load = () => ({ ok: false, reason: 'not_authorized' }); // the founder removes the entry
    await step(sessionId, 2, quiet());
    state.load = null; // …and puts it back
    await step(sessionId, 3, quiet());
    const turns = partnerTurns(sessionId);
    expect(turns.map((t) => [t.kind, t.method, t.methodChange ?? null])).toEqual([
      ['frame', KB_REF, null],
      ['step', KB_REF, null],
      ['step', BASE_REF, { from: 'KB-IDEA-EVALUATION-001@0.1', to: 'baseline@v0', reason: 'not_authorized' }],
      ['step', KB_REF, { from: 'baseline@v0', to: 'KB-IDEA-EVALUATION-001@0.1', reason: null }],
    ]);
    expect(sessionDoc(sessionId).method).toEqual(stamp);
    expect(state.turns.map((t) => t.system.includes(KB_HEADER))).toEqual([true, true, false, true]);
    expect(state.logs.map((l) => l.methodSource)).toEqual(['kb', 'kb', 'baseline', 'kb']);
    expect(state.logs.map((l) => [l.methodId, l.methodVersion])).toEqual([['KB-IDEA-EVALUATION-001', '0.1'], ['KB-IDEA-EVALUATION-001', '0.1'], ['baseline', 'v0'], ['KB-IDEA-EVALUATION-001', '0.1']]);
    // Each step's next action cites the method that step ran on.
    const nexts = recordDoc(sessionId).findings.filter((f) => f.kind === 'next_action').map((f) => f.source.recordId);
    expect(nexts).toEqual(['KB-IDEA-EVALUATION-001@0.1', 'KB-IDEA-EVALUATION-001@0.1', 'baseline@v0', 'KB-IDEA-EVALUATION-001@0.1']);
    // Every re-check used the stamp, one argument each.
    for (const args of state.loadCalls) {
      expect(args).toHaveLength(1);
      expect(args[0]).toMatchObject({ id: 'KB-IDEA-EVALUATION-001', version: '0.1', consumer: 'shared_research.observation' });
    }
  });

  it('a baseline-stamped session stays baseline when the loader starts answering ok (never upgraded)', async () => {
    const { sessionId } = await ownWords({ uid: 'u-off', requestId: 'fr-b' });
    state.offer = () => state.kbAnswer;
    state.load = () => state.kbAnswer;
    state.listed.push('u-off');
    await step(sessionId, 1, quiet());
    expect(partnerTurns(sessionId).at(-1)).toMatchObject({ method: BASE_REF });
    expect('methodChange' in partnerTurns(sessionId).at(-1)).toBe(false);
    expect(state.loadCalls).toEqual([]);
  });

  it('a retried framing keeps its first stamp: a baseline stamp is not upgraded by the retry\'s selection', async () => {
    state.user = { uid: 'u-off' };
    state.turnQueue.push({ ok: false, reason: 'model_error_500', usage: null, model: 'claude-haiku-5-5', attempts: 1, elapsedMs: 10, costUsd: null, stopReason: null });
    const first = await post({ action: 'frame', observation: OBSERVATION, requestId: 'fr-retry' });
    expect(first.body.error).toBe('frame_failed');
    const stamp = structuredClone(sessionDoc(first.body.sessionId).method);
    expect(stamp).toMatchObject({ source: 'baseline', fallbackReason: 'audience' });
    state.listed.push('u-off'); // now the loader would answer ok for this player
    state.turnQueue.push(frameOk());
    const again = await post({ action: 'frame', observation: OBSERVATION, requestId: 'fr-retry' });
    expect(again.body.sessionId).toBe(first.body.sessionId);
    expect(sessionDoc(first.body.sessionId).method).toEqual(stamp);
    expect(state.turns.at(-1).system).toContain(METHOD.text);
    expect(partnerTurns(first.body.sessionId)).toMatchObject([{ kind: 'frame', method: BASE_REF }]);
  });

  it('the letter: a KB stamp whose FIRST turn falls back (a retried framing after the entry is removed) records the baseline it ran on, with no methodChange — there is no previous partner turn (review SEL-1: founder question FQ-2)', async () => {
    state.turnQueue.push({ ok: false, reason: 'model_error_500', usage: null, model: 'claude-haiku-5-5', attempts: 1, elapsedMs: 10, costUsd: null, stopReason: null });
    const first = await post({ action: 'frame', observation: OBSERVATION, requestId: 'fr-sel1' });
    expect(sessionDoc(first.body.sessionId).method.source).toBe('kb');
    state.load = () => ({ ok: false, reason: 'not_authorized' }); // the founder removes the entry
    state.turnQueue.push(frameOk());
    await post({ action: 'frame', observation: OBSERVATION, requestId: 'fr-sel1' });
    const [frame] = partnerTurns(first.body.sessionId);
    expect(frame).toMatchObject({ kind: 'frame', method: BASE_REF });
    expect('methodChange' in frame).toBe(false);
    expect(sessionDoc(first.body.sessionId).method.source).toBe('kb'); // the stamp is never rewritten
    // Each call record names the method its turn ran on — the failed first framing's too (review TST-8).
    expect(state.logs.map((l) => [l.intent, l.outcome, l.methodSource, l.methodId])).toEqual([
      ['frame', 'failure', 'kb', 'KB-IDEA-EVALUATION-001'], ['frame', 'completion', 'baseline', 'baseline'],
    ]);
  });

  it('revoked between the frame and the open: the opening\'s next action still cites the KB method the frame ran on (labelled by its id)', async () => {
    state.turnQueue.push(frameOk());
    const f = await post({ action: 'frame', observation: OBSERVATION, requestId: 'fr-rev' });
    state.load = () => ({ ok: false, reason: 'not_authorized' });
    await post({ action: 'open', sessionId: f.body.sessionId, question: QUESTION });
    expect(recordDoc(f.body.sessionId).findings.at(-1)).toMatchObject({ kind: 'next_action', source: { recordKind: 'kb', recordId: 'KB-IDEA-EVALUATION-001@0.1', label: 'Method · KB-IDEA-EVALUATION-001 v0.1' } });
  });
});

describe('row 4 — finding → turn, and adoption', () => {
  it('every finding a step appends is in its exchange\'s findingIds, in order', async () => {
    const { sessionId } = await ownWords();
    const before = recordDoc(sessionId).findings.length;
    await step(sessionId, 1, twoCompanies());
    const appended = recordDoc(sessionId).findings.slice(before).map((f) => f.findingId);
    expect(appended.length).toBeGreaterThan(2);
    expect(partnerTurns(sessionId).at(-1).findingIds).toEqual(appended);
    await step(sessionId, 2, quiet());
    expect(partnerTurns(sessionId).at(-1).findingIds).toEqual(recordDoc(sessionId).findings.slice(before + appended.length).map((f) => f.findingId));
  });

  it('adoption: the confirm exchange holds methodsUsed — the distinct methods of the kept findings; the idea version is exactly the builder\'s output', async () => {
    const { sessionId } = await ownWords();
    await step(sessionId, 1, twoCompanies());
    const preview = (await get({ sessionId })).body.adoptPreview;
    const etn = preview.companies.find((c) => c.symbol === 'ETN');
    const r = await post({ action: 'adopt', sessionId, statement: etn.fragment, horizonEnum: 'positional', symbols: ['ETN'], previewRev: preview.previewRev });
    expect(r.statusCode, JSON.stringify(r.body)).toBe(200);
    const confirm = sessionDoc(sessionId).exchanges.at(-1);
    expect(confirm).toMatchObject({ who: 'player', kind: 'confirm', methodsUsed: [KB_REF] });
    // …computed independently: the kept findings are the version's evidence items; each one's method is its turn's.
    const version = seedEnv.doc(`watchlists/${r.body.watchlistId}/hypothesisVersions/v1`);
    const kept = version.evidenceRefs.filter((ref) => ref.kind === 'evidenceItem').map((ref) => ref.itemId);
    expect(kept.length).toBeGreaterThan(0);
    const turns = partnerTurns(sessionId).filter((t) => (t.findingIds ?? []).some((id) => kept.includes(id))); // in the order they ran
    const distinct = [...new Map(turns.map((t) => [JSON.stringify(t.method), t.method])).values()];
    expect(confirm.methodsUsed).toEqual(distinct);
    // The version is byte for byte the builder's output for its input, its exchange ref the confirm's unchanged id;
    // the builder's input is the same shape it always took (nothing method-shaped added).
    expect(state.builds).toHaveLength(1);
    const input = state.builds[0];
    expect(Object.keys(input).sort()).toEqual(['activation', 'attribution', 'confirmExchangeId', 'horizonEnum', 'invalidation', 'keptFindingIds', 'list', 'nowIso', 'record', 'sessionId', 'statement', 'userId', 'watchlistId']);
    expect(JSON.stringify(version)).toBe(JSON.stringify(state.realBuild(input)));
    expect(contentHashOf(version)).toBe(version.contentHash);
    expect(input.confirmExchangeId).toBe(confirm.exchangeId);
    expect(version.evidenceRefs.at(-1)).toMatchObject({ kind: 'exchange', exchangeId: confirm.exchangeId });
    expect(JSON.stringify(input)).not.toContain('methodsUsed');
    expect(JSON.stringify(version)).not.toMatch(/methodsUsed|methodChange|findingIds|seenSha256/);
  });
});

describe('row 3 — the shadow log names the turn\'s method on every call record, failures included (review TST-8)', () => {
  it('a KB frame whose write fails (persist_failed), and a KB step whose prompt is over the cap (prompt_too_large): each record names the KB method', async () => {
    state.turnQueue.push(() => {
      seedEnv.hooks.beforeCommit = () => { throw new Error('contention'); }; // recordFrame's transaction fails at commit
      return frameOk();
    });
    const f = await post({ action: 'frame', observation: OBSERVATION, requestId: 'fr-persist' });
    expect(f.statusCode).toBe(500);
    seedEnv.hooks.beforeCommit = null;
    expect(state.logs.at(-1)).toMatchObject({ intent: 'frame', outcome: 'failure', failureReason: 'persist_failed', methodSource: 'kb', methodId: 'KB-IDEA-EVALUATION-001', methodSha256: KB_REF.sha256 });
    const { sessionId } = await ownWords({ requestId: 'fr-big' });
    state.tooLarge = true;
    const r = await step(sessionId, 1, null);
    expect([r.statusCode, r.body.error]).toEqual([400, 'prompt_too_large']);
    expect(state.logs.at(-1)).toMatchObject({ intent: 'next', outcome: 'failure', failureReason: 'prompt_too_large', methodSource: 'kb', methodId: 'KB-IDEA-EVALUATION-001', methodVersion: '0.1' });
  });
});

describe('row 4 — methodsUsed across two methods (review TST-7)', () => {
  const eatonOnly = () => turnOk({
    reply: 'Eaton sells switchgear to data-center builders.',
    findings: [
      { tempId: 'e', kind: 'relationship', fact: 'Eaton sells switchgear to data-center builders.', symbolCandidate: 'ETN', companyName: 'Eaton', support: { kind: 'retrieval', index: 0, from: [], reason: null }, at: null, supersedes: null },
    ],
    summary: { text: 'Eaton sells switchgear to data-center builders.', basedOn: ['e'] },
    lines: { support: 'e', complication: null, missing: null },
    nextAction: { label: 'Find who else supplies the builders', purpose: 'One supplier is a narrow answer.' },
    companies: [{ companyName: 'Eaton', symbolCandidate: 'ETN', role: 'Supplier', relationshipRef: 'e', openRef: null, claim: null }],
  });
  const vernovaOnly = () => turnOk({
    reply: 'GE Vernova sells turbines to data centers.',
    findings: [
      { tempId: 'g', kind: 'relationship', fact: 'GE Vernova sells turbines to data centers.', symbolCandidate: 'GEV', companyName: 'GE Vernova', support: { kind: 'retrieval', index: 1, from: [], reason: null }, at: null, supersedes: null },
    ],
    summary: null,
    lines: { support: 'g', complication: null, missing: null },
    nextAction: { label: "Size GE Vernova's data-center sales", purpose: 'Significance is the weakest link.' },
    companies: [{ companyName: 'GE Vernova', symbolCandidate: 'GEV', role: 'Supplier', relationshipRef: 'g', openRef: null, claim: null }],
  });
  it('a KB step writes Eaton, a revoked (baseline) step writes GE Vernova; adopting GE Vernova records the baseline only — the kept findings\' turns, never the stamp or the whole record', async () => {
    const { sessionId } = await ownWords();
    await step(sessionId, 1, eatonOnly());
    state.load = () => ({ ok: false, reason: 'not_authorized' });
    await step(sessionId, 2, vernovaOnly());
    expect(partnerTurns(sessionId).slice(1).map((t) => t.method.source)).toEqual(['kb', 'baseline']);
    const preview = (await get({ sessionId })).body.adoptPreview;
    const gev = preview.companies.find((c) => c.symbol === 'GEV');
    expect(gev, JSON.stringify(preview.companies.map((c) => c.symbol))).toBeTruthy();
    const r = await post({ action: 'adopt', sessionId, statement: gev.fragment, horizonEnum: 'positional', symbols: ['GEV'], previewRev: preview.previewRev });
    expect(r.statusCode, JSON.stringify(r.body)).toBe(200);
    const confirm = sessionDoc(sessionId).exchanges.at(-1);
    expect(confirm.methodsUsed).toEqual([BASE_REF]);
    expect(sessionDoc(sessionId).method.source).toBe('kb'); // the stamp says KB; the kept evidence came from a baseline turn
  });
});

describe('row 5 — what each step keeps', () => {
  it('every item shown, as shown, in order; the hash recomputes; trimmed items absent; an undated item null with its finding " · undated"', async () => {
    const sessionId = await openStory();
    const readAt = new Date().toISOString();
    const future = new Date(Date.parse(readAt) + 86_400_000).toISOString();
    const items = [
      { ...ITEMS[0], highlights: ['First.', 'Second.', 'Third — the budget keeps two.'] },
      { ...ITEMS[1], publishedDate: null },
      { index: 2, url: 'https://news.example.com/later', title: 'ZZZQ  wins a\nswitchgear order', host: 'news.example.com', publishedDate: future, highlights: ['ZZZQ said  orders rose.'] },
      ...[3, 4, 5, 6].map((i) => ({ index: i, url: `https://news.example.com/p${i}`, title: `Piece ${i}`, host: 'news.example.com', publishedDate: '2026-11-01T00:00:00.000Z', highlights: [`Text ${i}.`] })),
    ];
    const r = await step(sessionId, 1, twoCompanies(), { retrieval: { items, costDollars: 0.005, elapsedMs: 300, readAt } });
    expect(r.statusCode, JSON.stringify(r.body)).toBe(200);
    const kept = partnerTurns(sessionId).at(-1).retrieval;
    expect(kept.readAt).toBe(readAt);
    expect(kept.items.map((it) => it.index)).toEqual([0, 1, 2, 3, 4]); // the budget's ITEMS_MAX: items 5 and 6 were never shown
    expect(kept.items[0]).toMatchObject({ url: ITEMS[0].url, host: 'news.example.com', title: ITEMS[0].title, highlights: ['First.', 'Second.'], publishedDate: '2026-11-06T00:00:00.000Z' });
    for (const it of kept.items) expect(it.seenSha256).toBe(createHash('sha256').update(`${it.title}\n${it.highlights.join('\n')}`, 'utf8').digest('hex'));
    for (const it of kept.items) expect(seenSha256Of(it.title, it.highlights)).toBe(it.seenSha256);
    // The text retained is the item's bounded text as given to the prompt (reading R1): the prompt renders it with
    // whitespace collapsed and tickers outside the game universe masked; the record keeps the text before that rendering.
    const user = state.turns.at(-1).user;
    expect(kept.items.map((it) => [it.title, it.highlights])).toEqual(items.slice(0, 5).map((it) => [it.title, it.highlights.slice(0, 2)]));
    expect(kept.items[2].title).toBe('ZZZQ  wins a\nswitchgear order'); // the raw text, not the rendered line (reading R1; review REC-1)
    expect(user).toContain("item 2 | news.example.com | no date | (symbol not in the app's records) wins a switchgear order");
    expect(user).toContain("    - (symbol not in the app's records) said orders rose.");
    expect(user).not.toContain('ZZZQ');
    for (const it of kept.items.filter((x) => x.index !== 2)) {
      expect(user).toContain(it.title);
      for (const h of it.highlights) expect(user).toContain(h);
    }
    expect(user).not.toContain('Third — the budget keeps two.');
    expect(user).not.toContain('Piece 5');
    // Unknown stays unknown: no date, and a date after the read (treated as absent, spec §16 FQ-2 — the prompt showed
    // "no date"), are null (reading R2; review REC-6, refuted).
    expect(kept.items[1].publishedDate).toBeNull();
    expect(kept.items[2].publishedDate).toBeNull();
    // Each item names the findings that cite it; the undated item's finding is labelled so.
    const findings = recordDoc(sessionId).findings;
    const byId = new Map(findings.map((f) => [f.findingId, f]));
    expect(kept.items[0].findingIds).toHaveLength(1);
    expect(byId.get(kept.items[0].findingIds[0])).toMatchObject({ source: { recordKind: 'retrieval', url: ITEMS[0].url } });
    expect(kept.items[1].findingIds).toHaveLength(1);
    expect(byId.get(kept.items[1].findingIds[0]).source.label.endsWith(' · undated')).toBe(true);
    for (const it of kept.items.slice(2)) expect(it.findingIds).toEqual([]);
    expect(undefinedPaths(sessionDoc(sessionId))).toEqual([]); // no field Firestore would refuse (review TST-17)
  });

  it('no retrieval block on a step that did not retrieve, or whose retrieval failed', async () => {
    const sessionId = await openStory();
    await step(sessionId, 1, quiet(), { retrieval: { error: 'retrieval_failed', elapsedMs: 40 } });
    expect('retrieval' in partnerTurns(sessionId).at(-1)).toBe(false);
    await step(sessionId, 2, quiet(), { intent: 'refresh' });
    state.retrievalQueue.length = 0;
    await step(sessionId, 3, quiet('Still nothing.'), { intent: 'refresh' }); // the same search text: no retrieval this step
    expect(state.retrievals).toHaveLength(2);
    expect('retrieval' in partnerTurns(sessionId).at(-2)).toBe(true);
    expect('retrieval' in partnerTurns(sessionId).at(-1)).toBe(false);
  });
});

describe('row 9 — the client answer is unchanged', () => {
  const FORBIDDEN_KEYS = ['method', 'methodChange', 'findingIds', 'methodsUsed', 'seenSha256', 'fallbackReason', 'consumer', 'selectedAt'];
  const keysIn = (v, out = new Set()) => { if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { out.add(k); keysIn(x, out); } return out; };
  it('no answer — frame, open, step, a failed step, a replay, GET, the list, adopt — carries a method field, and no exchange carries a retrieval', async () => {
    const { sessionId } = await ownWords();
    await step(sessionId, 1, twoCompanies());
    await step(sessionId, 1, null); // a replay
    await step(sessionId, 2, turnOk({ ...quiet().output, reply: 'We will track this idea.' })); // fails service_promise on the KB turn
    expect(answers.at(-1)).toMatchObject({ error: 'step_failed', reason: 'invalid_service_promise' });
    // the failed KB step's call record names the KB method it ran on (review TST-8)
    expect(state.logs.at(-1)).toMatchObject({ intent: 'next', outcome: 'failure', failureReason: 'invalid_service_promise', methodId: 'KB-IDEA-EVALUATION-001', methodVersion: '0.1', methodSha256: KB_REF.sha256, methodSource: 'kb' });
    expect(sessionDoc(sessionId).lastStep).toMatchObject({ status: 'failed', error: 'invalid_service_promise' });
    expect(partnerTurns(sessionId)).toHaveLength(2); // nothing appended: the frame and step 1 only
    await get({ sessionId });
    await get({ list: 'open' });
    const preview = (await get({ sessionId })).body.adoptPreview;
    const etn = preview.companies.find((c) => c.symbol === 'ETN');
    await post({ action: 'adopt', sessionId, statement: etn.fragment, horizonEnum: 'positional', symbols: ['ETN'], previewRev: preview.previewRev });
    expect(answers.length).toBeGreaterThan(8);
    for (const body of answers) {
      const keys = keysIn(body);
      for (const k of FORBIDDEN_KEYS) expect(keys.has(k), `${k} in ${JSON.stringify(body).slice(0, 120)}`).toBe(false);
      for (const ex of body?.session?.exchanges ?? []) expect(Object.keys(ex).every((k) => ['who', 'kind', 'text', 'at', 'stepId', 'intent', 'target'].includes(k))).toBe(true);
    }
  });

  it('every answer\'s keys equal main\'s — frame, open, step, replay, a failed step, the list, GET, adopt, close (review TST-10)', async () => {
    const SESSION_KEYS = ['sessionId', 'status', 'entry', 'frame', 'lastError', 'exchanges', 'stepsUsed', 'stepBudget', 'lastStep', 'researchWorkId', 'adoption', 'createdAt', 'updatedAt'];
    state.turnQueue.push(frameOk());
    const f = await post({ action: 'frame', observation: OBSERVATION, requestId: 'fr-keys' });
    expect(Object.keys(f.body)).toEqual(['sessionId', 'status', 'frame', 'quota']);
    const o = await post({ action: 'open', sessionId: f.body.sessionId, question: QUESTION });
    expect(Object.keys(o.body)).toEqual(['session', 'record', 'companies', 'opening', 'quota', 'previous']);
    const sessionId = f.body.sessionId;
    const s1 = await step(sessionId, 1, twoCompanies());
    expect(Object.keys(s1.body)).toEqual(['session', 'record', 'companies', 'changed', 'quota']);
    expect(Object.keys(s1.body.changed)).toEqual(['summary', 'findings', 'summaryWithheld']);
    const again = await step(sessionId, 1, null);
    expect(Object.keys(again.body)).toEqual(['session', 'record', 'companies', 'quota', 'replay', 'changed']);
    const bad = await step(sessionId, 2, turnOk({ ...quiet().output, reply: 'We will track this idea.' }));
    expect(Object.keys(bad.body)).toEqual(['error', 'reason', 'session', 'quota']);
    expect(Object.keys((await get({ list: 'open' })).body)).toEqual(['open', 'quota']);
    for (const body of [o.body, s1.body, again.body, bad.body]) expect(Object.keys(body.session)).toEqual(SESSION_KEYS);
    const closed = await post({ action: 'close', sessionId, reason: 'abandoned' });
    expect(Object.keys(closed.body)).toEqual(['session', 'record']);
    expect(Object.keys(closed.body.session)).toEqual(SESSION_KEYS);
    // adopt, on a second investigation
    const { sessionId: other } = await ownWords({ requestId: 'fr-keys-2' });
    await step(other, 3, twoCompanies());
    const preview = (await get({ sessionId: other })).body.adoptPreview;
    const etn = preview.companies.find((c) => c.symbol === 'ETN');
    const adopted = await post({ action: 'adopt', sessionId: other, statement: etn.fragment, horizonEnum: 'positional', symbols: ['ETN'], previewRev: preview.previewRev });
    expect(Object.keys(adopted.body)).toEqual(['watchlistId', 'version', 'researchWorkId', 'idempotent']);
  });

  it('the GET answer\'s keys equal main\'s', async () => {
    const { sessionId } = await ownWords();
    await step(sessionId, 1, twoCompanies());
    const g = (await get({ sessionId })).body;
    expect(Object.keys(g)).toEqual(['session', 'record', 'companies', 'adoptPreview', 'storedRows', 'previous', 'quota']);
    expect(Object.keys(g.session)).toEqual(['sessionId', 'status', 'entry', 'frame', 'lastError', 'exchanges', 'stepsUsed', 'stepBudget', 'lastStep', 'researchWorkId', 'adoption', 'createdAt', 'updatedAt']);
    expect(g.session.exchanges.map((e) => Object.keys(e))).toEqual([['who', 'kind', 'text', 'at'], ['who', 'kind', 'text', 'at'], ['who', 'kind', 'text', 'at', 'stepId', 'intent']]);
  });
});

describe('row 10 — provenance never leaves the loader', () => {
  it('a loader answer carrying a package\'s source, review, acceptance and exporter blocks and local paths: none reaches a session, a record, a log or an answer', async () => {
    const planted = {
      ok: true,
      method: {
        ...state.kbAnswer.method,
        source: { path: 'C:\\Users\\someone\\kb\\PLANTED-SOURCE.md' }, review: { path: 'C:/Users/someone/kb/PLANTED-REVIEW.md' },
        acceptance: { path: '/home/someone/kb/PLANTED-ACCEPTANCE.json' }, exporter: { cwd: 'C:\\kb', tool: 'PLANTED-EXPORTER' },
      },
    };
    state.offer = () => planted;
    state.load = () => planted;
    const { sessionId } = await ownWords();
    await step(sessionId, 1, twoCompanies());
    const preview = (await get({ sessionId })).body.adoptPreview;
    const etn = preview.companies.find((c) => c.symbol === 'ETN');
    const r = await post({ action: 'adopt', sessionId, statement: etn.fragment, horizonEnum: 'positional', symbols: ['ETN'], previewRev: preview.previewRev });
    expect(r.statusCode).toBe(200);
    expect(partnerTurns(sessionId).at(-1).method).toEqual(KB_REF); // it did run on the KB method
    const everything = JSON.stringify([[...seedEnv.store.entries()], state.logs, answers]);
    for (const s of ['PLANTED', 'C:\\\\', 'C:/', '/home/', '"review"', '"exporter"', '"acceptance"']) expect(everything).not.toContain(s);
    expect(everything).not.toMatch(/(?<![A-Za-z])[A-Za-z]:[\\/]/); // no drive-letter path at all
  });
});

describe('row 11 — ownership and the archetype boundary', () => {
  it('another uid\'s sessionId answers session_not_found, with no read of its record', async () => {
    const { sessionId } = await ownWords();
    state.user = { uid: 'u-off' };
    seedEnv.reads.length = 0;
    for (const r of [await get({ sessionId }), await step(sessionId, 1, null), await post({ action: 'open', sessionId, question: QUESTION })]) {
      expect([r.statusCode, r.body.error]).toEqual([404, 'session_not_found']);
    }
    expect(seedEnv.reads.filter(([, p]) => String(p).startsWith('researchWork'))).toEqual([]);
    expect(state.turns.filter((t) => t.kind === 'step')).toEqual([]);
  });

  it('no Shared Research module reaches an agent-memory, learning, Film Room card or Practice Field store, through any chain of imports', () => {
    const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
    const SR = path.join(REPO, 'api', '_utils', 'sharedResearch');
    const FORBIDDEN = [
      path.join(REPO, 'api', '_utils', 'memoryLessons.js'), path.join(REPO, 'api', '_utils', 'agentReflectionUtils.js'), path.join(REPO, 'api', '_utils', 'reflectionOutcome.js'),
      path.join(REPO, 'api', '_utils', 'learning'), path.join(REPO, 'api', '_utils', 'filmRoom'), path.join(REPO, 'api', '_utils', 'practiceField'),
    ];
    const inside = (f, d) => f === d || f.startsWith(d + path.sep);
    const specsOf = (t) => [...t.matchAll(/\bimport\s+[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]|\bimport\s*['"]([^'"]+)['"]|\bexport\s+[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]|\bimport\s*\(\s*['"`]([^'"`]+)['"`]\s*[,)]|\brequire\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g)].map((m) => m.slice(1).find(Boolean));
    /** Every file reachable from `roots` (relative specifiers, resolved as Node does for these files). */
    const reach = (roots, read) => {
      const seen = new Set();
      const queue = [...roots];
      while (queue.length) {
        const f = queue.pop();
        if (seen.has(f)) continue;
        seen.add(f);
        const text = read(f);
        if (text === null) continue;
        for (const s of specsOf(text)) {
          if (!s.startsWith('.')) continue;
          const base = path.resolve(path.dirname(f), s);
          queue.push([base, `${base}.js`, path.join(base, 'index.js')].find((c) => read(c) !== null) ?? base);
        }
      }
      return seen;
    };
    const readReal = (f) => { try { return /\.(?:m?js|json)$/.test(f) ? readFileSync(f, 'utf8') : null; } catch { return null; } };
    // Every Shared Research module, and the route that serves them (review TST-11).
    const roots = [...readdirSync(SR).filter((n) => /\.js$/.test(n) && !/\.test\.js$/.test(n)).map((n) => path.join(SR, n)), path.join(REPO, 'api', 'forge', 'shared-research.js')];
    expect(roots).toContain(path.join(SR, 'method.js'));
    const reached = [...reach(roots, readReal)];
    expect(reached.length).toBeGreaterThan(30); // not vacuous: the graph reaches the record models, the KB loader, src/ constants
    expect(reached).toContain(path.join(REPO, 'api', '_utils', 'kb', 'loader.js'));
    expect(reached.filter((f) => FORBIDDEN.some((d) => inside(f, d))).map((f) => path.relative(REPO, f))).toEqual([]);
    // Proven on a planted edge: a Shared Research module importing a Practice Field store is caught.
    const planted = new Map([[path.join(SR, 'zz.js'), "import { x } from './method.js';\nimport { y } from '../practiceField/ideaBook.js';"]]);
    const readPlanted = (f) => (planted.has(f) ? planted.get(f) : readReal(f));
    expect([...reach([path.join(SR, 'zz.js')], readPlanted)].filter((f) => FORBIDDEN.some((d) => inside(f, d)))).toContain(path.join(REPO, 'api', '_utils', 'practiceField', 'ideaBook.js'));
  });
});
