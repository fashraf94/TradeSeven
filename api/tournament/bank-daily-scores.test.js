// api/tournament/bank-daily-scores.test.js
//
// Manual banking trigger — the preview smoke path. Locks the admin gate, the
// sentinel mappings, the bypassTradingDay time-control (and that idempotency
// is NEVER bypassable), and the happy path's transactional write.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the import of the REAL endpoint
// module below is the runtime guard for its api/ -> src/ import chain
// (leagueTournament.js, baggerBombUtils.js) — it explodes in this Node test
// environment if a browser-only dependency ever enters the graph. Never mock
// that part of the graph.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const h = vi.hoisted(() => ({ db: null }));
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => h.db }));

import handler from './bank-daily-scores.js';

const SECRET = 'test-admin-secret';
const TRADING_DAY = new Date('2026-06-10T21:15:00Z'); // Wed 17:15 ET
const ET_DATE = '2026-06-10';

function makeDb({ groupDoc = null, agentBattles = [] } = {}) {
  const captured = { txUpdates: [], txSets: [] };
  // P6a: the endpoint additionally reads agentBattles (field-masked query)
  // and upserts the leaderboard month doc (tx.set) — the fake supports both
  // so the battery exercises the real success paths.
  const runQuery = async () => ({
    forEach: (cb) => agentBattles.forEach(d => cb({ id: d.id, data: () => d })),
  });
  const db = {
    collection: (name) => ({
      doc: () => ({
        get: async () => ({
          id: 'group-1',
          exists: name !== 'indexIntelligence' && name !== 'users' && groupDoc != null,
          data: () => (name === 'indexIntelligence' || name === 'users' ? null : groupDoc),
        }),
      }),
      where: () => ({ get: runQuery, select: () => ({ get: runQuery }) }),
    }),
    runTransaction: async (fn) => fn({
      get: async (ref) => ref.get(),
      update: (_ref, data) => { captured.txUpdates.push(data); },
      set: (_ref, data) => { captured.txSets.push(data); },
    }),
  };
  return { db, captured };
}

function makeReqRes(body = {}, headers = {}) {
  const req = { method: 'POST', headers: { 'x-admin-secret': SECRET, ...headers }, body };
  const res = { statusCode: null, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (payload) => { res.body = payload; return res; };
  return { req, res };
}

function leg(overrides = {}) {
  return { direction: 'long', baselinePrice: null, baselineSource: 'draft_resolution', openedAt: 'T0', thresholdHistory: [], ...overrides };
}

function battleGroup(overrides = {}) {
  return {
    status: 'battle',
    players: [
      { odUserId: 'u1', picks: [{ symbol: 'NVDA', legs: [leg()], flipCountToday: 0 }] },
      { odUserId: 'u2', picks: [] },
      { odUserId: 'u3', picks: [] },
      { odUserId: 'u4', picks: [] },
    ],
    dailyScores: {},
    claimSystem: { enabled: true, currentWaiverPriority: [], processingLog: [] },
    ...overrides,
  };
}

function stubQuotes() {
  vi.stubEnv('EODHD_API_KEY', 'test-key');
  vi.stubGlobal('fetch', async () => ({
    ok: true,
    status: 200,
    json: async () => [{ code: 'NVDA.US', open: 100, close: 103, previousClose: 99, timestamp: 1 }],
  }));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(TRADING_DAY);
  vi.stubEnv('ADMIN_SECRET', SECRET);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('gates and sentinels', () => {
  it('admin secret required; POST only; groupId validated', async () => {
    h.db = makeDb().db;

    const bad = makeReqRes({ groupId: 'g1' }, { 'x-admin-secret': 'wrong' });
    await handler(bad.req, bad.res);
    expect(bad.res.statusCode).toBe(401);

    const get = makeReqRes({ groupId: 'g1' });
    get.req.method = 'GET';
    await handler(get.req, get.res);
    expect(get.res.statusCode).toBe(405);

    const malformed = makeReqRes({ groupId: 'a/b' });
    await handler(malformed.req, malformed.res);
    expect(malformed.res.statusCode).toBe(400);
    expect(malformed.res.body.error).toBe('invalid_group_id');
  });

  it('404 group_not_found / 409 not_battle', async () => {
    h.db = makeDb().db;
    const missing = makeReqRes({ groupId: 'g1' });
    await handler(missing.req, missing.res);
    expect(missing.res.statusCode).toBe(404);
    expect(missing.res.body.error).toBe('group_not_found');

    h.db = makeDb({ groupDoc: battleGroup({ status: 'forming' }) }).db;
    const forming = makeReqRes({ groupId: 'g1' });
    await handler(forming.req, forming.res);
    expect(forming.res.statusCode).toBe(409);
    expect(forming.res.body.error).toBe('not_battle');
  });

  it('409 not_trading_day on weekends — suppressed by bypassTradingDay (admin-gated by construction)', async () => {
    vi.setSystemTime(new Date('2026-06-13T15:00:00Z')); // Saturday
    stubQuotes();
    const { db, captured } = makeDb({ groupDoc: battleGroup() });
    h.db = db;

    const blocked = makeReqRes({ groupId: 'g1' });
    await handler(blocked.req, blocked.res);
    expect(blocked.res.statusCode).toBe(409);
    expect(blocked.res.body.error).toBe('not_trading_day');

    const bypassed = makeReqRes({ groupId: 'g1', bypassTradingDay: true });
    await handler(bypassed.req, bypassed.res);
    expect(bypassed.res.statusCode).toBe(200);
    expect(captured.txUpdates).toHaveLength(1);
  });

  it('502 prices_unavailable when the feed is dead and the group holds picks', async () => {
    vi.stubEnv('EODHD_API_KEY', ''); // fetchBatchQuotes degrades to {}
    h.db = makeDb({ groupDoc: battleGroup() }).db;
    const { req, res } = makeReqRes({ groupId: 'g1' });
    await handler(req, res);
    expect(res.statusCode).toBe(502);
    expect(res.body.error).toBe('prices_unavailable');
  });
});

describe('banking runs', () => {
  it('happy path: banks day1 and reports closeScores', async () => {
    stubQuotes();
    const { db, captured } = makeDb({ groupDoc: battleGroup() });
    h.db = db;
    const { req, res } = makeReqRes({ groupId: 'g1' });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ groupId: 'g1', skipped: false, dayKey: 'day1' });
    expect(res.body.closeScores.u1.totalPoints).toBe(45);
    expect(captured.txUpdates[0]['dailyScores.day1'].recordedBy).toBe('manual');
  });

  it('a same-ET-day re-run reports the skip — idempotency is never bypassable', async () => {
    stubQuotes();
    const banked = battleGroup({
      dailyScores: { day1: { closeScores: {}, recordedDate: ET_DATE } },
    });
    const { db, captured } = makeDb({ groupDoc: banked });
    h.db = db;
    const { req, res } = makeReqRes({ groupId: 'g1', bypassTradingDay: true });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ skipped: true, reason: 'already_recorded' });
    expect(captured.txUpdates).toHaveLength(0);
  });
});
