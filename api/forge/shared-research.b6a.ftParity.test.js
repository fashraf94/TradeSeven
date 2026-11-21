// api/forge/shared-research.b6a.ftParity.test.js
//
// Shared Research B6a X-2 — A FANTASYTIMES STORY OPENS EXACTLY AS BEFORE, compared
// key by key against `main`'s. The same opens — a ledger and a thesis builder, each
// followed by its read and a second open of the same story — run with the ids and
// the clock pinned, and everything they answer and store is compared with the
// golden that THIS FILE wrote when run on `main` (cf35151b):
//   GENERATE_B6A_FT_GOLDEN=1 npx vitest run api/forge/shared-research.b6a.ftParity.test.js   (in a main snapshot)
// The one difference allowed is the ruled one: a record minted now carries schema
// version 2 (the founder's ruling of Nov 21, 2026); main's carries 1. Nothing else.
// This file imports nothing B6a added, so it runs unchanged on main.

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

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(NOW)); });
afterEach(() => { vi.useRealTimers(); });

describe('a FantasyTimes story opens exactly as on main (X-2)', () => {
  it('the ledger and the thesis builder: every answer, the session, the quota and the writes equal main\'s; the record differs only by its schema version', async () => {
    const now = { ledger: await run('off'), builder: await run('on') };
    if (process.env.GENERATE_B6A_FT_GOLDEN === '1') writeFileSync(GOLDEN, `${JSON.stringify(now, null, 2)}\n`);
    const main = JSON.parse(readFileSync(GOLDEN, 'utf8'));
    for (const shape of ['ledger', 'builder']) {
      const a = now[shape];
      const b = main[shape];
      expect(a.open.status, shape).toBe(200);
      for (const k of ['open', 'read', 'again', 'list', 'session', 'quota', 'writes']) expect(a[k], `${shape}.${k}`).toEqual(b[k]);
      expect([b.record.schemaVersion, a.record.schemaVersion], `${shape}.record.schemaVersion`).toEqual([1, 2]);
      expect({ ...a.record, schemaVersion: 'x' }, `${shape}.record`).toEqual({ ...b.record, schemaVersion: 'x' });
      // the golden is a real open: its answers are whole
      expect(Object.keys(b.open.body).sort(), shape).toEqual(['companies', 'opening', 'previous', 'quota', 'record', 'session', ...(shape === 'builder' ? ['thesis'] : [])].sort());
      expect(b.again.body.existing, shape).toBe(true);
      expect(b.record.findings[0].source.recordKind, shape).toBe('fantasyTimesStories');
    }
  });
});
