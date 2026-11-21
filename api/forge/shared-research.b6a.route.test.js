// api/forge/shared-research.b6a.route.test.js
//
// Shared Research B6a — WHAT EXPLORE NEEDS FROM "WORK AN IDEA", at the route, on
// the atomic in-memory Firestore double with the model and the search as seams
// (no network). The rows:
//   X-1  GET ?list=explore — no investigations; one open builder (its counts the
//        thesis view's); one saved; one concluded; one discarded (not reported); an
//        open and an earlier closed one on the same story; a FantasyTimes story and
//        own words (not listed); no access (404 disabled); the document bound; no write.
//   X-2  an Explore story opens as its own kind: the opening finding, its label, the
//        names in scope, the version stamped; only six fields of the story read; a
//        missing, unpublished or version-less story is not found; the same story twice
//        answers the first. (A FantasyTimes story against main's: b6a.ftParity.test.js.)
//   X-7  a thesis save records the statement saved on the session's adoption — the
//        player's edit or the composed sentence — and the view carries it; a ledger
//        idea's save is written as before (no statement, review A-1); a session saved
//        before B6a carries none.
//   The record schema (the founder's ruling of Nov 21): a record minted now is version 2.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeSrFirestore } from '../_utils/sharedResearch/__fixtures__/srFirestore.js';

const state = vi.hoisted(() => ({
  mode: 'on', builder: 'on', user: { uid: 'u1' }, db: null, turns: [], turnQueue: [], retrievals: [], retrievalQueue: [], logs: [],
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
const { EXPLORE_OPEN_READ, EXPLORE_RECORDS_READ, EXPLORE_DOCS_MAX } = await import('../_utils/sharedResearch/explore.js');
const { openSessionOf } = await import('../_utils/sharedResearch/session.js');
const { emptyCard } = await import('../_utils/sharedResearch/thesis.js');
const { findingLabelOf } = await import('../../src/constants/sharedResearch.js');
const { buildRecord, buildFinding, findingAppendPatch, FINDING_ID_PREFIX, researchWorkIdFor, manualFunnel, emptyTelemetry, RECORD_SCHEMA_VERSION } = await import('../_utils/researchRecords/model.js');

const UID = 'u1';
const AGENT = { ownerId: UID, name: 'Atlas', archetype: 'contrarian', loadouts: { baggerbomb: { archetype: 'momentum_chaser', book: null } } };
const FT_STORY = { headline: 'Switchgear backlogs stretch as data centers expand', reporterName: 'Kim', reporterBeat: 'Sector Strategist', publishedAt: '2026-11-12T13:00:00.000Z', primaryTicker: 'ETN', tickers: ['ETN', 'GEV'], status: 'published', type: 'sector' };
/** An Explore story in the spec's §5.1 shape. Every field `open` must not read carries a marker that must never surface. */
const EXPLORE = Object.freeze({
  id: 'ai-power-1', version: 3, status: 'published', publishedAt: '2026-11-18T13:00:00.000Z', lead: 'story',
  title: 'Power gear, not chips, sets the pace of the AI buildout', deck: 'DECK-NEVER-READ',
  reporter: { name: 'Kim', beat: 'Sector Strategist' }, evidenceSpan: 'SPAN-NEVER-READ', body: ['BODY-NEVER-READ'],
  parts: [{ name: 'PARTS-NEVER-READ', job: 'x', timing: 'y' }], openQuestion: 'OPENQ-NEVER-READ',
  connections: [{ who: 'CONN-NEVER-READ', what: 'x', basis: 'source_cited', basisLine: 'x', sourceIds: ['s1'], leads: ['NVDA'] }],
  sources: [{ id: 's1', name: 'SOURCE-NEVER-READ', kind: 'filing', dated: '2026-09-01', excerpt: 'EXCERPT-NEVER-READ', url: null }],
  questions: [{ id: 'q1', angleLabel: 'ANGLE-NEVER-READ', text: 'QUESTION-NEVER-READ', unknown: 'UNKNOWN-NEVER-READ', featured: true, sourceIds: ['s1'], leads: ['NVDA'] }],
  topics: ['TOPIC-NEVER-READ'], tickers: ['ETN', 'GEV', 'QZXW'], sample: false,
});
const ITEMS = [
  { index: 0, url: 'https://news.example.com/eaton', title: 'Eaton books data-center orders', host: 'news.example.com', publishedDate: '2026-11-06T00:00:00.000Z', highlights: ['Eaton said data-center orders rose.'] },
  { index: 1, url: 'https://news.example.com/gev', title: 'GE Vernova sells turbines to data centers', host: 'news.example.com', publishedDate: '2026-11-07T00:00:00.000Z', highlights: ['GE Vernova sells turbines.'] },
];
const Q1 = 'Who earns when data centers wait on power gear?';
const Q2 = 'Which suppliers are short of transformers?';

const seed = (extra = {}) => makeSrFirestore({
  'agents/agent-1': AGENT,
  'fantasyTimesStories/story-1': FT_STORY,
  [`exploreStories/${EXPLORE.id}`]: EXPLORE,
  'exploreStories/ai-power-2': { ...EXPLORE, id: 'ai-power-2', title: 'Transformers are the new bottleneck', version: 1 },
  'exploreStories/draft-1': { ...EXPLORE, id: 'draft-1', status: 'draft' },
  'exploreStories/noversion-1': { ...EXPLORE, id: 'noversion-1', version: undefined },
  'exploreStories/notitle-1': { ...EXPLORE, id: 'notitle-1', title: '   ' },
  'peerRankings/ETN': { ticker: 'ETN', name: 'Eaton Corporation plc', sector: 'Industrials' },
  'peerRankings/GEV': { ticker: 'GEV', name: 'GE Vernova Inc.', sector: 'Industrials' },
  ...extra,
});

const res = () => { const r = { statusCode: null, body: null, headers: {} }; r.status = (c) => { r.statusCode = c; return r; }; r.json = (b) => { r.body = b; return r; }; r.setHeader = (k, v) => { r.headers[k] = v; return r; }; return r; };
const post = async (body) => { resetUidRateLimits(); const r = res(); await handler({ method: 'POST', headers: {}, query: {}, body }, r); return r; };
const get = async (query) => { resetUidRateLimits(); const r = res(); await handler({ method: 'GET', headers: {}, query, body: undefined }, r); return r; };
const turnOk = (output) => ({ ok: true, output, usage: { input: 9000, output: 700 }, model: 'claude-sonnet-5-5', attempts: 1, elapsedMs: 900, costUsd: 0.025, stopReason: 'end_turn' });
const uuid = (n) => `9a8b7c6d-5e4f-4a3b-8c2d-${String(n).padStart(12, '0')}`;
let env;
const sessionDoc = (id) => env.doc(`sharedResearchSessions/${id}`);
const recordDoc = (id) => env.doc(`researchWork/sr_${id}`);

beforeEach(() => {
  env = seed();
  Object.assign(state, { mode: 'on', builder: 'on', user: { uid: UID }, db: env.db, turns: [], turnQueue: [], retrievals: [], retrievalQueue: [], logs: [] });
});

const openExplore = async ({ storyId = EXPLORE.id, question = Q1, requestId = 'req-x1' } = {}) => post({
  action: 'open', requestId, entry: { kind: 'item', itemRef: { recordKind: 'exploreStories', recordId: storyId }, question },
});
async function opened(args) {
  const r = await openExplore(args);
  expect(r.statusCode, JSON.stringify(r.body)).toBe(200);
  return r.body;
}
const exploreRead = async () => {
  const r = await get({ list: 'explore' });
  expect(r.statusCode, JSON.stringify(r.body)).toBe(200);
  return r.body;
};
/** Moves the clock on, so a later write is later (the read orders by time). */
const tick = () => new Promise((r) => { setTimeout(r, 3); });

describe('X-2: an Explore story opens as its own kind', () => {
  it('the opening finding is the title, From FantasyTimes, citing the Explore story; the names in scope are its tickers in the game; the version is stamped and shown', async () => {
    state.builder = 'off'; // the ledger keeps its opening next action: both openings are checked across the two rows
    const o = await opened();
    const id = o.session.sessionId;
    const coverage = o.record.findings[0];
    expect(coverage).toMatchObject({
      kind: 'coverage', fact: EXPLORE.title, status: 'unverified', statusReason: 'reporter_content', symbol: null,
      source: { recordKind: 'exploreStories', recordId: EXPLORE.id, label: 'FantasyTimes · Kim · Sector Strategist' },
    });
    expect(o.session.entry).toEqual({
      kind: 'item', itemRef: { recordKind: 'exploreStories', recordId: EXPLORE.id }, observation: null, direction: null, topic: null,
      names: ['ETN', 'GEV'], itemVersion: 3,
    });
    expect(findingLabelOf(coverage)).toBe('From FantasyTimes'); // the label the sheet draws, from the shared table
    expect(sessionDoc(id).entry.itemVersion).toBe(3);
    expect(sessionDoc(id).itemKey).toBe(`exploreStories/${EXPLORE.id}`);
    expect(recordDoc(id).question).toBe(Q1);
    // the record minted now carries schema version 2 (the founder's ruling of Nov 21)
    expect([RECORD_SCHEMA_VERSION, recordDoc(id).schemaVersion]).toEqual([2, 2]);
    expect(o.record.nextAction.fact).toMatch(/^Find the primary source of what this story reports/);
    const g = await get({ sessionId: id });
    expect(g.body.session.entry.itemVersion).toBe(3);
  });
  it('as a thesis builder too: the story path\'s card, verify_source on offer', async () => {
    const o = await opened();
    expect(o.session.shape).toBe('builder');
    expect(o.thesis.choices.research).toEqual([{ goal: 'verify_source' }, { goal: 'direction' }]);
    expect(o.record.findings[0].source).toMatchObject({ recordKind: 'exploreStories', recordId: EXPLORE.id });
  });
  it('reads ONLY status, title, reporter (name, beat), publishedAt, tickers and version from the story', async () => {
    const touched = new Set();
    const spy = (obj, at = '') => new Proxy(obj, {
      get(t, k) {
        if (typeof k === 'string') touched.add(`${at}${k}`);
        const v = t[k];
        return v !== null && typeof v === 'object' && !Array.isArray(v) ? spy(v, `${at}${k}.`) : v;
      },
    });
    const real = env.db;
    state.db = {
      ...real,
      collection: (name) => (name === 'exploreStories'
        ? { doc: (id) => ({ get: async () => ({ exists: true, id, data: () => spy(structuredClone(EXPLORE)) }) }) }
        : real.collection(name)),
    };
    const o = await opened();
    expect([...touched].sort()).toEqual(['publishedAt', 'reporter', 'reporter.beat', 'reporter.name', 'status', 'tickers', 'title', 'version']);
    // ...and nothing from the fields it never reads reaches the session, the record or the answer
    const written = JSON.stringify([sessionDoc(o.session.sessionId), recordDoc(o.session.sessionId), o]);
    expect(written).not.toMatch(/NEVER-READ/);
  });
  it('a missing, unpublished, version-less or untitled story is not found (404 item_not_found), and nothing is written', async () => {
    for (const storyId of ['nope-1', 'draft-1', 'noversion-1', 'notitle-1']) {
      const r = await openExplore({ storyId, requestId: `req-${storyId}` });
      expect([storyId, r.statusCode, r.body.error]).toEqual([storyId, 404, 'item_not_found']);
    }
    expect(env.writes).toEqual([]);
  });
  it('a SignalDrop entry cannot name an Explore story, nor an item another kind (invalid_entry)', async () => {
    const r = await post({ action: 'open', requestId: 'req-d', entry: { kind: 'signaldrop', itemRef: { recordKind: 'exploreStories', recordId: EXPLORE.id }, question: Q1 } });
    expect([r.statusCode, r.body.error]).toEqual([400, 'invalid_entry']);
    const s = await post({ action: 'open', requestId: 'req-s', entry: { kind: 'item', itemRef: { recordKind: 'signalDrops', recordId: 'drop-1' }, question: Q1 } });
    expect([s.statusCode, s.body.error]).toEqual([400, 'invalid_entry']);
    expect(env.writes).toEqual([]);
  });
  it('the same story opened twice answers the first (existing: true) with its original question; one investigation counted', async () => {
    const a = await opened();
    const b = await opened({ question: Q2, requestId: 'req-x2' });
    expect(b.existing).toBe(true);
    expect(b.session.sessionId).toBe(a.session.sessionId);
    expect(b.record.question).toBe(Q1);
    expect(env.doc(`sharedResearchQuota/${UID}`).investigationsOpened).toBe(1);
  });
});

/**
 * One session and its record, written straight to the store as the route leaves them (a read's fixture: the open's own
 * quota allows three a day): the record carries the story's opening coverage finding, and a completed or abandoned one
 * is closed with its terminal reason and end time.
 */
function plant({ n, storyId, status = 'open', createdAt, updatedAt = createdAt, adoption = null, builder = false, thesis = null, kind = 'exploreStories', stepsUsed = 0, version = 1 }) {
  const sessionId = uuid(500 + n);
  const s = {
    ...openSessionOf({
      sessionId, userId: UID, requestId: `req-p${n}`, attribution: { agentId: 'agent-1' }, researchWorkId: researchWorkIdFor({ collection: 'sharedResearchSessions', id: sessionId }), nowIso: createdAt,
      entry: { kind: 'item', itemRef: { recordKind: kind, recordId: storyId }, names: [], ...(kind === 'exploreStories' ? { itemVersion: version } : {}) }, exchanges: [],
    }),
    status, updatedAt, adoption, stepsUsed,
    ...(builder ? { shape: 'builder', thesis: thesis ?? emptyCard() } : {}),
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
  env.store.set(`researchWork/${s.researchWorkId}`, { ...record, ...ended });
  return s;
}
const at = (minute) => new Date(Date.parse('2026-11-20T15:00:00.000Z') + minute * 60_000).toISOString();

describe('X-1: GET ?list=explore', () => {
  it('no investigations: { quota, items: [] } — the quota as every answer carries it', async () => {
    const b = await exploreRead();
    expect(Object.keys(b)).toEqual(['quota', 'items']);
    expect(b.items).toEqual([]);
    expect(b.quota).toEqual({ investigationsToday: 0, perDay: 3, framingsToday: 0, framingsPerDay: 10, stepsToday: 0, stepsPerDay: 30 });
  });
  it('one open builder: its question, its steps left and finding count, and `filled` equal to the thesis view\'s; the item carries the story version', async () => {
    const o = await opened();
    const id = o.session.sessionId;
    const doc = sessionDoc(id);
    env.store.set(`sharedResearchSessions/${id}`, { ...doc, stepsUsed: 4, thesis: { ...doc.thesis, timeFrame: { state: 'set', by: 'player_chose', value: 'positional', suggestion: null } } });
    const b = await exploreRead();
    const g = (await get({ sessionId: id })).body;
    expect(b.items).toEqual([{
      itemRef: { recordKind: 'exploreStories', recordId: EXPLORE.id }, itemVersion: 3,
      open: {
        sessionId: id, question: Q1, lastTurnAt: g.record.lastTurnAt, filled: g.thesis.filled, parts: 6,
        stepsLeft: g.session.stepBudget - g.session.stepsUsed, findingsCount: g.record.findings.length + g.record.superseded.length,
      },
      last: null,
    }]);
    expect([b.items[0].open.filled, b.items[0].open.stepsLeft, b.items[0].open.findingsCount]).toEqual([1, 6, 1]); // the builder opens with the story alone: no next action (routine 4), no stored facts seeded
    expect(b.quota.investigationsToday).toBe(1);
  });
  it('`filled` is the view\'s count, not a count of the stored states: a set part gone stale is not filled', async () => {
    const o = await opened();
    const id = o.session.sessionId;
    const doc = sessionDoc(id);
    // the names stored `set` on a company the record does not support: the view derives them `stale`
    env.store.set(`sharedResearchSessions/${id}`, { ...doc, thesis: { ...doc.thesis, names: { state: 'set', value: ['ETN'], by: 'player_chose', blocked: null }, timeFrame: { state: 'set', by: 'player_chose', value: 'swing', suggestion: null } } });
    const g = (await get({ sessionId: id })).body;
    expect(g.thesis.parts.names.state).toBe('stale');
    const stored = ['theme', 'segment', 'names', 'why', 'wrongIf', 'timeFrame'].filter((p) => sessionDoc(id).thesis[p].state === 'set').length;
    const { items } = await exploreRead();
    expect([items[0].open.filled, g.thesis.filled, stored]).toEqual([1, 1, 2]);
  });
  it('a ledger investigation: `filled` is null (no card)', async () => {
    state.builder = 'off';
    await opened();
    const { items } = await exploreRead();
    expect(items[0].open).toMatchObject({ filled: null, parts: 6, stepsLeft: 10, findingsCount: 2 }) // the story and the next action;
  });
  it('one concluded (a real close): last { ended: \'concluded\', at: the close }, open null', async () => {
    const o = await opened();
    await tick(); // the close a moment after the open: last.at must be the close, never the creation (review M1)
    const c = await post({ action: 'close', sessionId: o.session.sessionId, reason: 'concluded' });
    expect(c.statusCode).toBe(200);
    const { items } = await exploreRead();
    expect(items).toEqual([{ itemRef: { recordKind: 'exploreStories', recordId: EXPLORE.id }, itemVersion: 3, open: null, last: { sessionId: o.session.sessionId, ended: 'concluded', at: c.body.record.endedAt } }]);
  });
  it('one discarded: not reported — the story has no item', async () => {
    const o = await opened();
    expect((await post({ action: 'close', sessionId: o.session.sessionId, reason: 'abandoned' })).statusCode).toBe(200);
    expect((await exploreRead()).items).toEqual([]);
  });
  it('one saved (a real ledger save): last { ended: \'saved\', at: the save }', async () => {
    state.builder = 'off';
    const o = await opened();
    const id = o.session.sessionId;
    const saved = await ledgerSave(id);
    const { items } = await exploreRead();
    expect(items).toEqual([{ itemRef: { recordKind: 'exploreStories', recordId: EXPLORE.id }, itemVersion: 3, open: null, last: { sessionId: id, ended: 'saved', at: sessionDoc(id).adoption.at } }]);
    expect(sessionDoc(id).adoption.watchlistId).toBe(saved.watchlistId);
  });
  it('an open one and an earlier closed one on the same story: both, each in its place; a later discard does not hide an earlier conclusion', async () => {
    const first = await opened();
    await tick(); // the close a moment after the open: last.at must be the close, never the creation (review M1)
    const closed = await post({ action: 'close', sessionId: first.session.sessionId, reason: 'concluded' });
    await tick();
    const second = await opened({ question: Q2, requestId: 'req-x2' });
    expect(second.session.sessionId).not.toBe(first.session.sessionId);
    const { items } = await exploreRead();
    expect(items).toHaveLength(1);
    expect(items[0].open).toMatchObject({ sessionId: second.session.sessionId, question: Q2 });
    expect(items[0].last).toEqual({ sessionId: first.session.sessionId, ended: 'concluded', at: closed.body.record.endedAt });
    // the newer one discarded: the story's last ended investigation is still the concluded one
    await post({ action: 'close', sessionId: second.session.sessionId, reason: 'abandoned' });
    const after = (await exploreRead()).items;
    expect(after).toEqual([{ itemRef: { recordKind: 'exploreStories', recordId: EXPLORE.id }, itemVersion: 3, open: null, last: { sessionId: first.session.sessionId, ended: 'concluded', at: closed.body.record.endedAt } }]);
  });
  it('two ended on one story: the newer is the last — a saved one after a concluded one, and the other way round', async () => {
    const older = plant({ n: 1, storyId: EXPLORE.id, status: 'completed', createdAt: at(1), updatedAt: at(2) });
    const newer = plant({ n: 2, storyId: EXPLORE.id, status: 'completed', createdAt: at(3), updatedAt: at(4), adoption: { watchlistId: 'wl-2', version: 1, at: at(4), statement: 'x' } });
    expect((await exploreRead()).items.map((i) => i.last)).toEqual([{ sessionId: newer.sessionId, ended: 'saved', at: at(4) }]);
    plant({ n: 3, storyId: 'ai-power-2', status: 'completed', createdAt: at(5), updatedAt: at(6), adoption: { watchlistId: 'wl-3', version: 1, at: at(6) } });
    const last = plant({ n: 4, storyId: 'ai-power-2', status: 'completed', createdAt: at(7), updatedAt: at(8) });
    const { items } = await exploreRead();
    expect(items.map((i) => [i.itemRef.recordId, i.last.sessionId, i.last.ended])).toEqual([['ai-power-2', last.sessionId, 'concluded'], [EXPLORE.id, newer.sessionId, 'saved']]);
    expect(older.sessionId).not.toBe(newer.sessionId);
  });
  it('a FantasyTimes story and own words are not listed; two Explore stories are, newest activity first', async () => {
    state.builder = 'on';
    expect((await post({ action: 'open', requestId: 'req-ft', entry: { kind: 'item', itemRef: { recordKind: 'fantasyTimesStories', recordId: 'story-1' }, question: Q1 } })).statusCode).toBe(200);
    expect((await post({ action: 'open', requestId: 'req-own', entry: { kind: 'observation', observation: 'I want to play power gear' } })).statusCode).toBe(200);
    expect((await exploreRead()).items).toEqual([]);
    env.store.set(`sharedResearchQuota/${UID}`, { ...env.doc(`sharedResearchQuota/${UID}`), investigationsOpened: 0 });
    await opened();
    await tick();
    await opened({ storyId: 'ai-power-2', requestId: 'req-x2' });
    expect((await exploreRead()).items.map((i) => [i.itemRef.recordId, i.itemVersion])).toEqual([['ai-power-2', 1], [EXPLORE.id, 3]]);
  });
  it('no access: 404 disabled, as every request', async () => {
    state.mode = 'off';
    const r = await get({ list: 'explore' });
    expect([r.statusCode, r.body]).toEqual([404, { error: 'disabled' }]);
    expect(env.reads).toEqual([]);
  });
  it('another player\'s investigations are never read into the answer', async () => {
    await opened();
    state.user = { uid: 'u2' };
    expect((await exploreRead()).items).toEqual([]);
  });
  it('the document bound: the open query, its records outside the window, the window, the sessions of stories ended only — 161 documents with the quota; no write', async () => {
    // 40 open investigations, the oldest; 60 ended, newer — so the window holds none of the open ones' records
    for (let n = 0; n < 40; n++) plant({ n, storyId: `story-open-${n}`, createdAt: at(n) });
    for (let n = 40; n < 100; n++) plant({ n, storyId: `story-done-${n}`, status: 'completed', createdAt: at(n), updatedAt: at(n) });
    let docs = 0;
    const real = env.db;
    const wrapQ = (q) => ({
      ...q, where: (...a) => wrapQ(q.where(...a)), orderBy: (...a) => wrapQ(q.orderBy(...a)), limit: (n) => wrapQ(q.limit(n)),
      get: async () => { const snap = await q.get(); docs += snap.docs.length; return snap; },
      ...(q.doc ? { doc: (id) => { const d = q.doc(id); return { ...d, get: async () => { docs += 1; return d.get(); } }; } } : {}),
    });
    state.db = { ...real, collection: (name) => wrapQ(real.collection(name)) };
    const writes = env.writes.length;
    const b = await exploreRead();
    expect([EXPLORE_OPEN_READ, EXPLORE_RECORDS_READ, EXPLORE_DOCS_MAX]).toEqual([30, 50, 161]);
    expect(docs).toBe(EXPLORE_DOCS_MAX);
    expect(b.items.filter((i) => i.open)).toHaveLength(30);
    expect(b.items.filter((i) => i.last)).toHaveLength(50);
    expect(b.items.every((i) => Number.isSafeInteger(i.itemVersion))).toBe(true);
    expect(env.writes.length).toBe(writes);
  });
  it('past the window, newest first (review HB-2): a story\'s last is its newest ended investigation whatever the session ids; the oldest stories age out; an open one is found at any age', async () => {
    // the story's older conclusion has the higher session id and its newer save the lower one: ids never decide
    const newer = plant({ n: 1, storyId: 'st-0', status: 'completed', createdAt: at(90), updatedAt: at(91), adoption: { watchlistId: 'wl-1', version: 1, at: at(91) } });
    plant({ n: 99, storyId: 'st-0', status: 'completed', createdAt: at(10), updatedAt: at(11) });
    for (let n = 20; n < 80; n++) plant({ n, storyId: `st-${n}`, status: 'completed', createdAt: at(n), updatedAt: at(n) });
    const old = plant({ n: 2, storyId: 'st-open', createdAt: at(0) }); // open, older than every record in the window
    const { items } = await exploreRead();
    expect(items.find((i) => i.itemRef.recordId === 'st-0').last).toEqual({ sessionId: newer.sessionId, ended: 'saved', at: at(91) });
    expect(items.find((i) => i.itemRef.recordId === 'st-open').open.sessionId).toBe(old.sessionId);
    // the window: the newest 50 records — st-0's save, st-31…st-79; st-20…st-30 and st-0's old conclusion are older
    const ended = items.filter((i) => i.last).map((i) => i.itemRef.recordId);
    expect(ended).toHaveLength(EXPLORE_RECORDS_READ);
    expect(ended).toContain('st-31');
    expect(ended).not.toContain('st-30');
  });
  it('a read writes nothing, and a second read answers the same', async () => {
    await opened();
    const writes = env.writes.length;
    const a = await exploreRead();
    const b = await exploreRead();
    expect(b).toEqual(a);
    expect(env.writes.length).toBe(writes);
  });
});

// ── X-7: the statement saved ──────────────────────────────────────────────────────

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
/** A ledger save through the route: one step, the preview, adopt with ETN's fragment as the statement. */
async function ledgerSave(sessionId) {
  state.retrievalQueue.push({ items: ITEMS, costDollars: 0.005, elapsedMs: 300, readAt: new Date().toISOString() });
  state.turnQueue.push(twoCompanies());
  expect((await post({ action: 'step', sessionId, stepId: uuid(1), intent: 'next' })).statusCode).toBe(200);
  const preview = (await get({ sessionId })).body.adoptPreview;
  const etn = preview.companies.find((c) => c.symbol === 'ETN');
  const r = await post({ action: 'adopt', sessionId, statement: `  ${etn.fragment}  `, horizonEnum: 'positional', symbols: ['ETN'], previewRev: preview.previewRev });
  expect(r.statusCode, JSON.stringify(r.body)).toBe(200);
  return { watchlistId: r.body.watchlistId, statement: etn.fragment };
}

// The thesis builder's path to a ready card (shared-research.builder.route.test.js toReady, on its own words).
const NV_ITEMS = [
  { index: 0, url: 'https://news.example.com/nvda-ai', title: 'Nvidia accelerators lead AI data centers', host: 'news.example.com', publishedDate: '2026-11-06T00:00:00.000Z', highlights: ['Nvidia sells the accelerators most AI data centers buy.'] },
  { index: 1, url: 'https://news.example.com/nvda-rev', title: 'Nvidia data-center revenue', host: 'news.example.com', publishedDate: '2026-11-07T00:00:00.000Z', highlights: ['Data-center sales were most of its revenue.'] },
  { index: 2, url: 'https://news.example.com/buyers', title: 'Large buyers design their own chips', host: 'news.example.com', publishedDate: '2026-11-08T00:00:00.000Z', highlights: ['Several large buyers design their own chips.'] },
];
const EMPTY = { reply: '', findings: [], companies: [], themeSuggestion: null, segments: [], why: null, wrongIfOptions: [], timeFramePick: null, pick: null };
const out = (over) => turnOk({ ...EMPTY, ...over });
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
async function toReady() {
  env.store.set('peerRankings/NVDA', { ticker: 'NVDA', name: 'NVIDIA Corporation', sector: 'Technology' });
  const o = await post({ action: 'open', requestId: 'req-own-1', entry: { kind: 'observation', observation: 'I want to play AI' } });
  const id = o.body.session.sessionId;
  let rev = o.body.thesis.rev;
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
  await step('map_segments', MAP());
  await tap('set', 'segment', 'GPUs and accelerators');
  await step('find_names', NAMES());
  await tap('set', 'names', ['NVDA']);
  await step('build_why', WHY());
  await tap('confirm', 'why');
  await tap('set', 'wrongIf', { option: 0, priceLines: [{ symbol: 'NVDA', level: 120 }] });
  const last = await tap('set', 'timeFrame', 'positional');
  return { id, rev, sentence: last.body.thesis.sentence };
}
const EDIT = "NVDA earns from GPUs and accelerators because it sells them to AI data centers. It's wrong if big buyers cut accelerator spending for two quarters. Positional · about 30 sessions.";

describe('X-7: the statement saved is recorded on the session\'s adoption, and the view carries it', () => {
  it('a thesis saved with the player\'s edit records the edit — what was saved, not the composed sentence', async () => {
    const { id, rev, sentence } = await toReady();
    const r = await post({ action: 'adopt', sessionId: id, rev, statement: EDIT });
    expect(r.statusCode, JSON.stringify(r.body)).toBe(200);
    expect(EDIT).not.toBe(sentence);
    expect(sessionDoc(id).adoption).toEqual({ watchlistId: r.body.watchlistId, version: 1, at: sessionDoc(id).updatedAt, statement: EDIT });
    expect(env.doc(`watchlists/${r.body.watchlistId}/hypothesisVersions/v1`).statement).toBe(EDIT); // the one saved
    const g = await get({ sessionId: id });
    expect(g.body.session.adoption.statement).toBe(EDIT);
    // Explore's read reads the same session as saved (own words: not listed — the read lists Explore stories only)
    expect((await exploreRead()).items).toEqual([]);
  });
  it('a thesis saved as composed records the composed sentence, the version\'s statement', async () => {
    const { id, rev, sentence } = await toReady();
    const r = await post({ action: 'adopt', sessionId: id, rev });
    expect(r.statusCode).toBe(200);
    expect(sessionDoc(id).adoption.statement).toBe(sentence);
    expect(env.doc(`watchlists/${r.body.watchlistId}/hypothesisVersions/v1`).statement).toBe(sentence);
  });
  it('a ledger idea\'s save is written exactly as before: its adoption carries no statement (review A-1; the saved screen is the builder\'s)', async () => {
    state.builder = 'off';
    const o = await opened();
    const saved = await ledgerSave(o.session.sessionId);
    const s = sessionDoc(o.session.sessionId);
    expect(Object.keys(s.adoption)).toEqual(['watchlistId', 'version', 'at']);
    expect(s.adoption).toEqual({ watchlistId: saved.watchlistId, version: 1, at: s.updatedAt });
    expect(env.doc(`watchlists/${saved.watchlistId}/hypothesisVersions/v1`).statement).toBe(saved.statement); // the idea holds it, as before
    expect((await get({ sessionId: o.session.sessionId })).body.session.adoption).toEqual({ watchlistId: saved.watchlistId, version: 1, at: s.updatedAt });
  });
  it('a session saved before B6a carries no statement: the view is unchanged', async () => {
    const s = plant({ n: 1, storyId: EXPLORE.id, status: 'completed', createdAt: at(1), updatedAt: at(2), adoption: { watchlistId: 'wl-old', version: 1, at: at(2) } });
    const g = await get({ sessionId: s.sessionId });
    expect(g.body.session.adoption).toEqual({ watchlistId: 'wl-old', version: 1, at: at(2) });
    const { items } = await exploreRead();
    expect(items[0].last).toEqual({ sessionId: s.sessionId, ended: 'saved', at: at(2) });
  });
});
