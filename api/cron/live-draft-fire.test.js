// api/cron/live-draft-fire.test.js
//
// The dedicated slot-fire cron: cron auth, the flag gate (flag-off = strict
// no-op, byte-identical dark), and the flag-on query → fire → drive wiring over
// the REAL liveDraftLifecycle service against an in-memory Firestore.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the real import of the handler
// (which pulls liveDraftLifecycle → trainingLifecycle → tournamentCpu →
// tournamentGroupService) is the runtime guard for that api/ -> src/ surface.
// Only the admin boundary and the zero-import flag are mocked.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const h = vi.hoisted(() => ({ flag: true, db: null }));

vi.mock('../../src/config/featureFlags.js', () => ({
  get LEAGUE_LIVE_DRAFT() { return h.flag; },
  // liveDraftLifecycle's transitive graph (tournamentLobbyService) reads this.
  LEAGUE_CANONICAL_OPEN_CAPTURE: false,
}));
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => h.db }));

import handler from './live-draft-fire.js';
import { GROUP_STATUS, GROUP_SIZE } from '../../src/constants/leagueTournament.js';

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubEnv('CRON_SECRET', 's3cret');
  h.flag = true;
  h.db = null;
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

// ---- minimal in-memory Firestore (fire/drive touch groups, agents, boards, seq) ----
function applyDot(t, u) { for (const [k, v] of Object.entries(u)) { const p = k.split('.'); let n = t; for (let i = 0; i < p.length - 1; i++) { if (typeof n[p[i]] !== 'object' || n[p[i]] == null) n[p[i]] = {}; n = n[p[i]]; } n[p[p.length - 1]] = v; } }
function makeDb(initial = {}) {
  const store = new Map(Object.entries(initial).map(([k, v]) => [k, structuredClone(v)]));
  const top = (prefix) => { const d = []; for (const [path, data] of store.entries()) { if (!path.startsWith(`${prefix}/`)) continue; const rel = path.slice(prefix.length + 1); if (rel.includes('/')) continue; d.push({ id: rel, data: () => structuredClone(data) }); } return d; };
  const snap = (docs) => ({ docs, empty: !docs.length, size: docs.length, forEach: (cb) => docs.forEach(cb) });
  const ref = (path) => ({ path, id: path.split('/').pop(), get: async () => ({ exists: store.has(path), id: path.split('/').pop(), data: () => structuredClone(store.get(path)) }), set: async (d) => store.set(path, structuredClone(d)), update: async (u) => { const d = store.get(path); applyDot(d, u); }, collection: (s) => coll(`${path}/${s}`) });
  const coll = (prefix) => ({ doc: (id) => ref(`${prefix}/${id}`), where: (f, o, v) => ({ get: async () => snap(top(prefix).filter((d) => d.data()[f] === v)) }), get: async () => snap(top(prefix)) });
  return { store, db: { collection: coll, runTransaction: async (fn) => fn({ get: async (r) => r.get(), set: (r, d) => store.set(r.path, structuredClone(d)), update: (r, u) => { const d = store.get(r.path); applyDot(d, u); }, delete: (r) => store.delete(r.path) }) } };
}
const SYMBOLS = Array.from({ length: 40 }, (_, i) => `SYM${i}`);
const req = (headers = {}) => ({ method: 'GET', headers });
function res() { return { statusCode: null, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } }; }

describe('live-draft-fire cron — auth + flag gate', () => {
  it('401s without the cron secret', async () => {
    const r = res();
    await handler(req({}), r);
    expect(r.statusCode).toBe(401);
  });

  it('flag-off is a strict no-op (byte-identical dark) — never touches the db', async () => {
    h.flag = false;
    h.db = { collection: () => { throw new Error('db must not be touched flag-off'); } };
    const r = res();
    await handler(req({ authorization: 'Bearer s3cret' }), r);
    expect(r.statusCode).toBe(200);
    expect(r.body).toMatchObject({ skipped: 'flag_off' });
  });
});

describe('live-draft-fire cron — flag-on query → fire → drive', () => {
  it('fires a due FORMING slot group into DRAFTING', async () => {
    const seed = { 'indexIntelligence/stockRankings': { stocks: SYMBOLS.map((symbol, i) => ({ symbol, sectorName: 'T', fundamentalScore: 95 - i, technicalScore: 95 - i, baggerBombFit: 95 - i, atrPercentile: 0.5 })) }, 'agents/human-1': { ownerId: 'human-1', isCpu: false, archetype: 'analyst', config: {}, personality: { traits: [] } } };
    const { db, store } = makeDb(seed);
    store.set('tournamentGroups/lds_wed-1900_2026-07-08', {
      status: GROUP_STATUS.FORMING, isLiveDraft: true, roundNumber: 1, baseLayerWeek: '2026-W28',
      scheduledDraftAt: '2026-07-08T23:00:00.000Z',
      battleStartWeek: { mondayEtDate: '2026-07-13', anchorEtDate: '2026-07-13', anchorIso: '2026-07-13T13:30:00.000Z' },
      groupMembers: ['human-1'], players: [{ odUserId: 'human-1', picks: [] }], seatNames: { 'human-1': 'Ada' },
      userPool: [], claimSystem: { enabled: true, currentWaiverPriority: [], processingLog: [] }, dailyScores: {},
      createdAt: '2026-07-06T12:00:00.000Z', updatedAt: '2026-07-06T12:00:00.000Z',
    });
    h.db = db;

    // Firestore-Timestamp-free: the handler uses new Date() for `now`; the seeded
    // scheduledDraftAt is in the past relative to the test run, so it is due.
    const r = res();
    await handler(req({ authorization: 'Bearer s3cret' }), r);
    expect(r.statusCode).toBe(200);
    expect(r.body.ok).toBe(true);
    expect(r.body.fired).toBe(1);
    const group = store.get('tournamentGroups/lds_wed-1900_2026-07-08');
    expect(group.status).toBe(GROUP_STATUS.DRAFTING);
    expect(group.players).toHaveLength(GROUP_SIZE);
  });
});
