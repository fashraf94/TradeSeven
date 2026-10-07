// api/forge/researchRecords.joins.test.js
//
// Pilot P2 — the research → idea joins and the player's own "researched"
// (the P2 build prompt's acceptance rows 8 and 9), gate ON:
//   8  dialogue v1's evidenceRefs cite its record (and the record names the
//      list and v1); versions the player creates in the Forge cite every
//      record already attached to the list; an analysis record names the
//      version current when it ran; NO version document is ever updated by a
//      research host
//   9  mark_researched (founder ruling D4): legal only from draft, a
//      compare-and-set, reason player_marked_researched / source player —
//      and the Forge's read carries the list's research summaries
// The route-level 10 × 6 status/action matrix (which iterates the shared
// table, so it covers mark_researched) is watchlists.hypothesisRecords.test.js
// row 4; the independent restatement of the table is hypothesisRecords/model.test.js.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { stored, storedUnder } from '../_utils/__fixtures__/callsFirestore.js';
import {
  OWNER, OTHER, NOW, ALLOWLIST_ENV, AGENT_ID, DROP_ID, makeHostDb, call, rankingsDoc, screenReply, analysisReply, dialogueSession,
  screenerSession, savedList,
} from '../_utils/__fixtures__/researchHostHarness.js';
import { contentHashOf, HYPOTHESIS_STATUSES } from '../_utils/hypothesisRecords/model.js';

const state = vi.hoisted(() => ({ flagOn: true, replies: [] }));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, get HYPOTHESIS_RECORDS_ENABLED() { return state.flagOn; } };
});
let activeDb = null;
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => activeDb }));
vi.mock('../_utils/security.js', () => ({ applySecurityMiddleware: () => false }));
vi.mock('../_utils/authMiddleware.js', () => ({ requireAuth: async () => ({ uid: 'owner-1' }) }));
vi.mock('../_utils/shadowLogger.js', () => ({ logSignalDrops: async () => {}, logConversation: async () => true }));
vi.mock('@vercel/functions', () => ({ waitUntil: (p) => p }));
vi.mock('firebase-admin/firestore', () => ({
  FieldValue: { arrayUnion: (...items) => ({ __op: 'arrayUnion', items }), increment: (n) => ({ __op: 'increment', n }) },
}));
vi.mock('../_utils/gemmaClient.js', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, callGemmaVoiceWithRetry: async () => state.replies.shift() };
});

const { default: screenerHandler } = await import('../screener/chat.js');
const { default: analysisHandler } = await import('./watchlist-analysis.js');
const { default: watchlistsHandler } = await import('./watchlists.js');
const { default: versionsHandler } = await import('./watchlists/[id]/hypothesis-versions.js');
const { default: transitionHandler } = await import('./watchlists/[id]/hypothesis-transition.js');

const ref = (id) => ({ kind: 'researchWork', id });
const vPath = (wl, n) => `watchlists/${wl}/hypothesisVersions/v${n}`;
const versionWrites = () => activeDb.__access.writes.filter((w) => w.path && /\/hypothesisVersions\//.test(w.path));
const setDb = (docs = {}) => { activeDb = makeHostDb(docs); return activeDb; };
const createVersion = (wl, body) => call(versionsHandler, { query: { id: wl }, body: { opId: `op-${Math.random().toString(36).slice(2)}`, ...body } });
const transition = (wl, body) => call(transitionHandler, { query: { id: wl }, body });
const analyse = async (wl) => {
  await call(analysisHandler, { body: { watchlistId: wl } });
  const session = Object.entries(storedUnder(activeDb, 'analysisSessions')).find(([, s]) => s.watchlistId === wl);
  return session[1].researchWorkId;
};

let savedEnv;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(NOW));
  savedEnv = process.env[ALLOWLIST_ENV];
  process.env[ALLOWLIST_ENV] = OWNER;
  state.flagOn = true;
  state.replies = [];
});
afterEach(() => {
  if (savedEnv === undefined) delete process.env[ALLOWLIST_ENV]; else process.env[ALLOWLIST_ENV] = savedEnv;
  vi.useRealTimers();
});
// No research host ever updates a version document: every version write in
// every row below is a create (the save's v1, the Forge's own versions) or the
// P1a successor pointer the FORGE routes set — never a write from a host.
const HOST_PATHS = ['researchSessions/', 'watchlistSessions/', 'analysisSessions/'];

// ════════════════════════════════════════════════════════════════════════════
describe('row 8 — the joins', () => {
  it('dialogue save: v1 cites the record; the record names the list and v1; the list names the record', async () => {
    setDb({ 'watchlistSessions/ws-1': dialogueSession({ researchWorkId: 'ws_ws-1' }) });
    // The record the dialogue minted (as its first turn would have).
    await activeDb.collection('researchWork').doc('ws_ws-1').set({
      schemaVersion: 1, researchWorkId: 'ws_ws-1', userId: OWNER, origin: 'signaldrop', host: { collection: 'watchlistSessions', id: 'ws-1' }, createdAt: NOW,
      watchlistId: null, hypothesisVersion: null, stages: {}, symbols: [], symbolsTruncated: false, budget: null, telemetry: {}, state: 'open', terminalReason: null, endedAt: null, updatedAt: NOW,
    });
    const res = await call(watchlistsHandler, { body: { sessionId: 'ws-1', agentId: AGENT_ID, dropId: DROP_ID } });
    const wl = res.body.watchlistId;
    const v1 = stored(activeDb, vPath(wl, 1));
    expect(v1.evidenceRefs).toEqual([ref('ws_ws-1')]);
    expect(v1.contentHash).toBe(contentHashOf(v1));
    expect(stored(activeDb, 'researchWork/ws_ws-1')).toMatchObject({ watchlistId: wl, hypothesisVersion: 1, state: 'completed' });
    expect(stored(activeDb, `watchlists/${wl}`).researchWorkId).toBe('ws_ws-1');
  });
  it('a session with NO record saves as before: v1 cites nothing, the list names nothing', async () => {
    setDb({ 'watchlistSessions/ws-1': dialogueSession() });
    const res = await call(watchlistsHandler, { body: { sessionId: 'ws-1', agentId: AGENT_ID, dropId: DROP_ID } });
    expect(stored(activeDb, vPath(res.body.watchlistId, 1)).evidenceRefs).toEqual([]);
    expect('researchWorkId' in stored(activeDb, `watchlists/${res.body.watchlistId}`)).toBe(false);
  });
  it('Forge versions cite every record attached to the list, oldest first; an analysis record names the version current when it ran; the version is never touched', async () => {
    setDb({ 'indexIntelligence/stockRankings': rankingsDoc() });
    const made = await call(watchlistsHandler, { body: {} }); // manual
    const wl = made.body.watchlistId;
    await activeDb.collection('watchlists').doc(wl).update({ tickers: [{ symbol: 'NVDA' }, { symbol: 'AMD' }] });
    const v1 = await createVersion(wl, { expectedVersion: 0, statement: 'Chips lead the cycle' });
    expect(v1.statusCode).toBe(200);
    expect(v1.body.version.evidenceRefs).toEqual([ref(`wl_${wl}`)]);

    vi.setSystemTime(new Date('2026-10-07T15:00:00.000Z'));
    const before = versionWrites().length;
    const analysisRw = await analyse(wl);
    expect(versionWrites().length, 'the analysis host wrote no version').toBe(before);
    expect(stored(activeDb, `researchWork/${analysisRw}`)).toMatchObject({ watchlistId: wl, hypothesisVersion: 1, origin: 'analysis', state: 'open' });

    const v2 = await createVersion(wl, { expectedVersion: 1, statement: 'Chips lead the cycle, memory too' });
    expect(v2.body.version.evidenceRefs).toEqual([ref(`wl_${wl}`), ref(analysisRw)]);
    // The analysis record still names v1 — the version current when it ran — and v1's own refs never moved.
    expect(stored(activeDb, `researchWork/${analysisRw}`).hypothesisVersion).toBe(1);
    expect(stored(activeDb, vPath(wl, 1)).evidenceRefs).toEqual([ref(`wl_${wl}`)]);
    for (const w of activeDb.__access.writes) {
      if (w.path && /\/hypothesisVersions\//.test(w.path) && w.op !== 'create') {
        expect(Object.keys(w.data), `${w.op} ${w.path}`).toEqual(['successorVersion']); // P1a's Forge pointer only
      }
    }
  });
  it('screener lists: v1 cites the record its list was saved against; a second list from the same session cites none (the record is the first save\'s — reviews R1-1 / R4-4)', async () => {
    setDb({ 'indexIntelligence/stockRankings': rankingsDoc() });
    state.replies.push({ success: true, content: screenReply() });
    await call(screenerHandler, { body: { userMessage: 'strong chips' } });
    const make = async (tickers) => (await call(watchlistsHandler, { body: { tickers, name: 'x', sourceScreenSpec: { filters: [] }, screenerSessionId: 'researchSessions-auto-1' } })).body.watchlistId;
    const first = await make([{ symbol: 'NVDA' }]);
    const second = await make([{ symbol: 'AMD' }]);
    const v1 = await createVersion(first, { expectedVersion: 0, statement: 'Screened strength persists' });
    expect(v1.body.version).toMatchObject({ origin: 'screener', evidenceRefs: [ref('rs_researchSessions-auto-1')] });
    const v2 = await createVersion(second, { expectedVersion: 0, statement: 'Screened strength persists' });
    expect(v2.body.version).toMatchObject({ origin: 'screener', evidenceRefs: [] });
    expect(stored(activeDb, 'researchWork/rs_researchSessions-auto-1').watchlistId).toBe(first);
  });
  it('version creation reads the list\'s research BEFORE its transaction — no record is in the transaction\'s read set (review R2-3)', async () => {
    setDb({
      'watchlists/wl-1': savedList({ researchWorkId: 'wl_wl-1' }),
      'researchWork/wl_wl-1': { researchWorkId: 'wl_wl-1', userId: OWNER, origin: 'manual', state: 'completed', watchlistId: 'wl-1', createdAt: NOW },
      'researchWork/as_1': { researchWorkId: 'as_1', userId: OWNER, origin: 'analysis', state: 'open', watchlistId: 'wl-1', createdAt: NOW },
    });
    const txReads = [];
    activeDb.__hooks.afterTxBody = async ({ readPaths }) => { txReads.push(...readPaths); };
    const v = await createVersion('wl-1', { expectedVersion: 0, statement: 'An idea' });
    expect(v.body.version.evidenceRefs).toEqual([ref('as_1'), ref('wl_wl-1')].sort((a, b) => (a.id < b.id ? -1 : 1)));
    expect(txReads.length).toBeGreaterThan(0);
    expect(txReads.filter((p) => p.startsWith('researchWork/'))).toEqual([]);
  });
  it('a record whose subject is ANOTHER list is never cited, even if a list names it', async () => {
    setDb({
      'watchlists/wl-2': savedList({ watchlistId: 'wl-2', researchWorkId: 'rs_s1' }),
      'researchWork/rs_s1': { researchWorkId: 'rs_s1', userId: OWNER, origin: 'screener', state: 'completed', watchlistId: 'wl-1', createdAt: NOW },
    });
    const v = await createVersion('wl-2', { expectedVersion: 0, statement: 'An idea' });
    expect(v.body.version.evidenceRefs).toEqual([]);
  });
  it('a reaffirmed version cites the list\'s research too; another player\'s record is never cited', async () => {
    const due = {
      version: 1, watchlistId: 'wl-1', userId: OWNER, opId: 'seed-1', opFingerprint: 'f'.repeat(64), createdAt: NOW,
      statement: 'Due idea', horizonEnum: 'swing', horizonSource: 'parse', activation: [], invalidation: [], evidenceRefs: [], publishedAt: null, origin: 'manual',
      status: 'review_due', stateChangedAt: NOW, stateSource: 'review_pass', stateReason: 'horizon_elapsed', missingEvidence: null, successorVersion: null,
      firstDeployedAt: NOW, lastDeployedAt: NOW, lastDeployedBattleId: 'b-1', reviewDueAt: NOW,
    };
    setDb({
      'watchlists/wl-1': savedList({ currentHypothesisVersion: 1, hypothesisVersionCount: 1, researchWorkId: 'wl_wl-1' }),
      'watchlists/wl-1/hypothesisVersions/v1': { ...due, contentHash: contentHashOf(due) },
      'researchWork/wl_wl-1': { researchWorkId: 'wl_wl-1', userId: OWNER, origin: 'manual', state: 'completed', watchlistId: 'wl-1', createdAt: NOW },
      'researchWork/as_theirs': { researchWorkId: 'as_theirs', userId: OTHER, origin: 'analysis', state: 'open', watchlistId: 'wl-1', createdAt: NOW },
    });
    const res = await transition('wl-1', { version: 1, action: 'reaffirm', opId: 'op-r', expectedVersion: 1 });
    expect(res.statusCode).toBe(200);
    expect(res.body.version.evidenceRefs).toEqual([ref('wl_wl-1')]);
  });
  it('the Forge read carries the list\'s research summaries — its own research first, then analysis sessions newest first; counts, completed turns and state, never the cohort or the rest of telemetry', async () => {
    setDb({ 'indexIntelligence/stockRankings': rankingsDoc() });
    const wl = (await call(watchlistsHandler, { body: {} })).body.watchlistId;
    await activeDb.collection('watchlists').doc(wl).update({ tickers: [{ symbol: 'NVDA' }, { symbol: 'ZZZZ' }] });
    vi.setSystemTime(new Date('2026-10-07T15:00:00.000Z'));
    const analysisRw = await analyse(wl);
    const res = await call(versionsHandler, { method: 'GET', query: { id: wl } });
    expect(res.statusCode).toBe(200);
    expect(res.body.research).toEqual([
      {
        researchWorkId: `wl_${wl}`, origin: 'manual', createdAt: NOW, watchlistId: wl, hypothesisVersion: null,
        stages: { universeSize: null, matchedPreLimit: null, shortlisted: null, selectedForInvestigation: null, investigationsCompleted: null, eligible: null },
        completions: 0, state: 'completed', terminalReason: 'player_authored', endedAt: NOW,
      },
      {
        researchWorkId: analysisRw, origin: 'analysis', createdAt: '2026-10-07T15:00:00.000Z', watchlistId: wl, hypothesisVersion: null,
        stages: { universeSize: null, matchedPreLimit: null, shortlisted: null, selectedForInvestigation: 2, investigationsCompleted: 1, eligible: null },
        completions: 0, state: 'open', terminalReason: null, endedAt: null,
      },
    ]);
  });
  it('research hosts never write a version: every host-path request in this suite left hypothesisVersions alone', async () => {
    setDb({ 'indexIntelligence/stockRankings': rankingsDoc(), 'watchlists/wl-1': savedList({ currentHypothesisVersion: 1, hypothesisVersionCount: 1 }), 'researchSessions/rs-1': screenerSession() });
    await analyse('wl-1');
    state.replies.push({ success: true, content: analysisReply() });
    await call(analysisHandler, { body: { watchlistId: 'wl-1', sessionId: 'analysisSessions-auto-1', userMessage: 'What do these share?' } });
    state.replies.push({ success: true, content: screenReply() });
    await call(screenerHandler, { body: { userMessage: 'more', sessionId: 'rs-1' } });
    expect(versionWrites()).toEqual([]);
    expect(activeDb.__access.writes.every((w) => !w.path || HOST_PATHS.some((p) => w.path.startsWith(p)) || w.path.startsWith('researchWork/'))).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe('row 9 — mark_researched (founder ruling D4; spec Amendment B)', () => {
  const draft = (over = {}) => {
    const v = {
      version: 1, watchlistId: 'wl-1', userId: OWNER, opId: 'seed-1', opFingerprint: 'f'.repeat(64), createdAt: NOW,
      statement: 'My own idea', horizonEnum: 'unspecified', horizonSource: 'default', activation: [], invalidation: [], evidenceRefs: [], publishedAt: null, origin: 'manual',
      status: 'draft', stateChangedAt: NOW, stateSource: 'player', stateReason: 'player_authored', missingEvidence: null, successorVersion: null,
      firstDeployedAt: null, lastDeployedAt: null, lastDeployedBattleId: null, reviewDueAt: null, ...over,
    };
    return { ...v, contentHash: contentHashOf(v) };
  };
  const seed = (versions) => setDb({
    'watchlists/wl-1': savedList({ currentHypothesisVersion: versions.length, hypothesisVersionCount: versions.length }),
    ...Object.fromEntries(versions.map((v) => [vPath('wl-1', v.version), v])),
  });
  it('draft → researched: source player, reason player_marked_researched, a fresh stateChangedAt — content untouched; ready is now legal', async () => {
    seed([draft()]);
    vi.setSystemTime(new Date('2026-10-08T15:00:00.000Z'));
    const res = await transition('wl-1', { version: 1, action: 'mark_researched', expectedStatus: 'draft' });
    expect(res.statusCode).toBe(200);
    expect(stored(activeDb, vPath('wl-1', 1))).toEqual({
      ...draft(), status: 'researched', stateSource: 'player', stateReason: 'player_marked_researched', stateChangedAt: '2026-10-08T15:00:00.000Z',
    });
    expect((await transition('wl-1', { version: 1, action: 'ready', expectedStatus: 'researched' })).statusCode).toBe(200);
  });
  it('compare-and-set: a stale expectedStatus loses cleanly (409 status_conflict, no write)', async () => {
    seed([draft()]);
    const res = await transition('wl-1', { version: 1, action: 'mark_researched', expectedStatus: 'researched' });
    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({ error: 'status_conflict', status: 'draft' });
    expect(versionWrites()).toEqual([]);
  });
  it('illegal from every status but draft (409 illegal_transition, no write)', async () => {
    for (const status of HYPOTHESIS_STATUSES.filter((s) => s !== 'draft')) {
      seed([draft({ status })]);
      const res = await transition('wl-1', { version: 1, action: 'mark_researched', expectedStatus: status });
      expect(res.statusCode, status).toBe(409);
      expect(res.body.error).toBe('illegal_transition');
      expect(versionWrites()).toEqual([]);
    }
  });
  it('a SUPERSEDED draft cannot be marked researched (it acts on the current version only)', async () => {
    seed([draft({ successorVersion: 2 }), draft({ version: 2 })]);
    const res = await transition('wl-1', { version: 1, action: 'mark_researched', expectedStatus: 'draft' });
    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({ error: 'illegal_transition', superseded: true });
  });
  it('gate off → 404 disabled, no store access (P1a\'s gate, unchanged)', async () => {
    state.flagOn = false;
    seed([draft()]);
    const res = await transition('wl-1', { version: 1, action: 'mark_researched', expectedStatus: 'draft' });
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: 'disabled' });
    expect(activeDb.__access.reads).toEqual([]);
  });
});
