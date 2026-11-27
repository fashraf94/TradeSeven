// api/forge/shared-research.b6a.ftParity.test.js
//
// Shared Research B6a X-2 — A FANTASYTIMES STORY OPENS EXACTLY AS BEFORE, compared
// key by key against `main`'s. The same opens — a ledger and a thesis builder, each
// followed by its read and a second open of the same story — and a ledger idea saved
// (one step, its preview, the save, the read after: review A-1) run with the ids and
// the clock pinned, and everything they answer and store is compared with the
// golden that THIS FILE wrote when run on `main` (cf35151b):
//   GENERATE_B6A_FT_GOLDEN=1 npx vitest run api/forge/shared-research.b6a.ftParity.test.js   (in a main snapshot)
// The one difference allowed is the ruled one: a record minted now carries schema
// version 2 (the founder's ruling of Nov 21, 2026); main's carries 1. Nothing else.
// This file imports nothing B6a added, so it runs unchanged on main.
//
// Build 3b PR A (RU-21, the founder's ruling of Nov 27, 2026) is the second ruled
// difference: the opening's stored rows now read what the rankings job writes
// (peerRankings' sectorName, compositeRank, totalPeers, computedAt), no longer the
// `sector` field and the top-level stockRankings collection nothing writes. The rows
// (`storedRows`, `opening.storedRows`) are compared apart: everything else equals
// main's exactly, and the rows equal RU21_ROWS below.

import { readFileSync, writeFileSync } from 'node:fs';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeSrFirestore } from '../_utils/sharedResearch/__fixtures__/srFirestore.js';

const state = vi.hoisted(() => ({ mode: 'on', builder: 'off', user: { uid: 'u1' }, db: null, ids: 0 }));
vi.mock('node:crypto', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, randomUUID: () => `00000000-0000-4000-8000-${String(++state.ids).padStart(12, '0')}` };
});
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
vi.mock('../_utils/authMiddleware.js', () => ({ requireAuth: async () => state.user }));
vi.mock('../_utils/shadowLogger.js', () => ({ logConversation: async () => true }));
vi.mock('@vercel/functions', () => ({ waitUntil: (p) => p }));
// The one step of the ledger save below: a fixed model answer and a fixed search (no network).
vi.mock('../_utils/sharedResearch/modelTurn.js', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, runTurn: async () => state.turn() };
});
vi.mock('../_utils/sharedResearch/retrieval.js', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, retrieve: async () => state.search() };
});

const { default: handler } = await import('./shared-research.js');
const { resetUidRateLimits } = await import('../_utils/sharedResearch/gate.js');

const GOLDEN = new URL('./__fixtures__/b6a.ftOpen.main.json', import.meta.url);
const NOW = '2026-11-20T15:00:00.000Z';
const UID = 'u1';
const seed = () => makeSrFirestore({
  'agents/agent-1': { ownerId: UID, name: 'Rook', archetype: 'contrarian', loadouts: { baggerbomb: { archetype: 'momentum_chaser', book: null } } },
  'fantasyTimesStories/story-1': { headline: 'Switchgear backlogs stretch as data centers expand', reporterName: 'Kim', reporterBeat: 'Sector Strategist', publishedAt: '2026-11-12T13:00:00.000Z', primaryTicker: 'ETN', tickers: ['ETN', 'GEV', 'QZXW'], status: 'published', type: 'sector' },
  'peerRankings/ETN': { ticker: 'ETN', name: 'Eaton Corporation plc', sector: 'Industrials', updatedAt: '2026-11-19T06:00:00.000Z' },
  'peerRankings/GEV': { ticker: 'GEV', name: 'GE Vernova Inc.', sector: 'Industrials', updatedAt: '2026-11-19T06:00:00.000Z' },
  'stockRankings/ETN': { compositeScore: 71, percentile: 88, tier: 'A', updatedAt: '2026-11-19T06:00:00.000Z' },
  'estimatesCache/latest': { computedAt: '2026-11-19T06:00:00.000Z', stocks: { ETN: { forwardEstimates: { currentYear: { growth: '0.12' }, nextYear: { growth: '0.15', numAnalysts: '20' } } } } },
  'ingestedClaims/c1': { ticker: 'ETN', sourceDate: '2026-11-10' },
  'ingestedClaims/c2': { ticker: 'ETN', sourceDate: '2026-11-04' },
});
// RU-21: the rows this seed gives now. The seed's peerRankings documents carry `sector` and `updatedAt` (fields the
// rankings job never writes) and no sectorName, rank or computedAt, so each row keeps its name and nothing else.
const RU21_ROWS = [
  { symbol: 'ETN', name: 'Eaton Corporation plc', peer: { sector: null, metrics: null, asOf: null }, ranking: null },
  { symbol: 'GEV', name: 'GE Vernova Inc.', peer: { sector: null, metrics: null, asOf: null }, ranking: null },
];
/** An answer with its stored rows set apart (RU-21): [the answer without them, the rows or null]. */
const apart = (answer) => {
  if (!answer?.body || typeof answer.body !== 'object') return [answer, null];
  const body = { ...answer.body };
  let rows = null;
  if (Object.hasOwn(body, 'storedRows')) { rows = body.storedRows; body.storedRows = 'RU-21'; }
  if (body.opening && Object.hasOwn(body.opening, 'storedRows')) { rows = body.opening.storedRows; body.opening = { ...body.opening, storedRows: 'RU-21' }; }
  return [{ ...answer, body }, rows];
};
/** One answer against main's: equal apart from its rows, and its rows RU-21's for the same symbols (main's were the old read's). */
const sameAsMain = (a, b, label) => {
  const [aRest, aRows] = apart(a);
  const [bRest, bRows] = apart(b);
  expect(aRest, label).toEqual(bRest);
  expect(aRows === null, `${label}: rows present`).toBe(bRows === null);
  if (aRows !== null) expect(aRows, `${label}: rows`).toEqual(bRows.map((r) => RU21_ROWS.find((x) => x.symbol === r.symbol)));
};
const res = () => { const r = { statusCode: null, body: null }; r.status = (c) => { r.statusCode = c; return r; }; r.json = (b) => { r.body = b; return r; }; r.setHeader = () => r; return r; };
const call = async (req) => { resetUidRateLimits(); const r = res(); await handler({ headers: {}, query: {}, ...req }, r); return { status: r.statusCode, body: r.body }; };

/** One story's opens, as the route answers and stores them, with the builder mode given. */
async function run(builder) {
  state.ids = 0;
  state.builder = builder;
  const env = seed();
  state.db = env.db;
  const entry = { kind: 'item', itemRef: { recordKind: 'fantasyTimesStories', recordId: 'story-1' }, question: 'Which companies earn from the switchgear backlog?', direction: 'utilities first' };
  const open = await call({ method: 'POST', body: { action: 'open', requestId: 'req-ft-1', entry } });
  const sessionId = open.body.session.sessionId;
  const read = await call({ method: 'GET', query: { sessionId } });
  const again = await call({ method: 'POST', body: { action: 'open', requestId: 'req-ft-2', entry: { ...entry, question: 'Another question?' } } });
  const list = await call({ method: 'GET', query: { list: 'open' } });
  return {
    open, read, again, list,
    session: env.doc(`sharedResearchSessions/${sessionId}`), record: env.doc(`researchWork/sr_${sessionId}`),
    quota: env.doc(`sharedResearchQuota/${UID}`), writes: env.writes,
  };
}

/**
 * A FantasyTimes ledger investigation saved as an idea (review A-1: the ledger's save stays as on main): open, one
 * step with a fixed model answer and search, the read with its preview, the save, and the read after it.
 */
const ITEMS = [
  { index: 0, url: 'https://news.example.com/eaton', title: 'Eaton books data-center orders', host: 'news.example.com', publishedDate: '2026-11-06T00:00:00.000Z', highlights: ['Eaton said data-center orders rose.'] },
  { index: 1, url: 'https://news.example.com/gev', title: 'GE Vernova sells turbines to data centers', host: 'news.example.com', publishedDate: '2026-11-07T00:00:00.000Z', highlights: ['GE Vernova sells turbines.'] },
];
const STEP_OUTPUT = {
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
};
async function ledgerSave() {
  state.ids = 0;
  state.builder = 'off';
  state.turn = () => ({ ok: true, output: structuredClone(STEP_OUTPUT), usage: { input: 9000, output: 700 }, model: 'claude-sonnet-5-5', attempts: 1, elapsedMs: 900, costUsd: 0.025, stopReason: 'end_turn' });
  state.search = () => ({ items: structuredClone(ITEMS), costDollars: 0.005, elapsedMs: 300, readAt: new Date().toISOString() });
  const env = seed();
  state.db = env.db;
  const entry = { kind: 'item', itemRef: { recordKind: 'fantasyTimesStories', recordId: 'story-1' }, question: 'Which companies earn from the switchgear backlog?' };
  const open = await call({ method: 'POST', body: { action: 'open', requestId: 'req-ft-1', entry } });
  const sessionId = open.body.session.sessionId;
  const step = await call({ method: 'POST', body: { action: 'step', sessionId, stepId: '00000000-0000-4000-8000-0000000000aa', intent: 'next' } });
  const read = await call({ method: 'GET', query: { sessionId } });
  const etn = read.body.adoptPreview.companies.find((c) => c.symbol === 'ETN');
  const adopt = await call({ method: 'POST', body: { action: 'adopt', sessionId, statement: etn.fragment, horizonEnum: 'positional', symbols: ['ETN'], previewRev: read.body.adoptPreview.previewRev } });
  const after = await call({ method: 'GET', query: { sessionId } });
  const watchlistId = adopt.body.watchlistId;
  return {
    open, step, read, adopt, after,
    session: env.doc(`sharedResearchSessions/${sessionId}`), record: env.doc(`researchWork/sr_${sessionId}`),
    list: env.doc(`watchlists/${watchlistId}`), version: env.doc(`watchlists/${watchlistId}/hypothesisVersions/v1`),
    quota: env.doc(`sharedResearchQuota/${UID}`), writes: env.writes,
  };
}

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(NOW)); });
afterEach(() => { vi.useRealTimers(); });

describe('a FantasyTimes story opens exactly as on main (X-2)', () => {
  it('the ledger and the thesis builder: every answer, the session, the quota and the writes equal main\'s; the record differs only by its schema version', async () => {
    const now = { ledger: await run('off'), builder: await run('on'), ledgerSave: await ledgerSave() };
    if (process.env.GENERATE_B6A_FT_GOLDEN === '1') writeFileSync(GOLDEN, `${JSON.stringify(now, null, 2)}\n`);
    const main = JSON.parse(readFileSync(GOLDEN, 'utf8'));
    for (const shape of ['ledger', 'builder']) {
      const a = now[shape];
      const b = main[shape];
      expect(a.open.status, shape).toBe(200);
      for (const k of ['open', 'read', 'again', 'list']) sameAsMain(a[k], b[k], `${shape}.${k}`);
      for (const k of ['session', 'quota', 'writes']) expect(a[k], `${shape}.${k}`).toEqual(b[k]);
      expect([b.record.schemaVersion, a.record.schemaVersion], `${shape}.record.schemaVersion`).toEqual([1, 2]);
      expect({ ...a.record, schemaVersion: 'x' }, `${shape}.record`).toEqual({ ...b.record, schemaVersion: 'x' });
      // the golden is a real open: its answers are whole
      expect(Object.keys(b.open.body).sort(), shape).toEqual(['companies', 'opening', 'previous', 'quota', 'record', 'session', ...(shape === 'builder' ? ['thesis'] : [])].sort());
      expect(b.again.body.existing, shape).toBe(true);
      expect(b.record.findings[0].source.recordKind, shape).toBe('fantasyTimesStories');
    }
  });
  it('a FantasyTimes ledger investigation saved as an idea: every answer, the session (its adoption too), the list, the idea version, the quota and the writes equal main\'s; the record differs only by its schema version', async () => {
    const a = await ledgerSave();
    const b = JSON.parse(readFileSync(GOLDEN, 'utf8')).ledgerSave;
    // the golden is a real save: the step landed, the preview answered, the idea was saved
    expect([b.step.status, b.read.status, b.adopt.status, b.after.status]).toEqual([200, 200, 200, 200]);
    expect(b.adopt.body).toMatchObject({ version: 1, idempotent: false });
    expect(b.session.adoption).toEqual({ watchlistId: b.adopt.body.watchlistId, version: 1, at: NOW });
    for (const k of ['open', 'step', 'read', 'adopt', 'after']) sameAsMain(a[k], b[k], `ledgerSave.${k}`);
    for (const k of ['session', 'list', 'version', 'quota', 'writes']) expect(a[k], `ledgerSave.${k}`).toEqual(b[k]);
    expect([b.record.schemaVersion, a.record.schemaVersion]).toEqual([1, 2]);
    expect({ ...a.record, schemaVersion: 'x' }).toEqual({ ...b.record, schemaVersion: 'x' });
  });
});
