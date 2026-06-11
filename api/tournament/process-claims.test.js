// api/tournament/process-claims.test.js
//
// Manual claim-processing trigger — the preview-side processing-window
// time-control: reaching it requires the admin secret, so it is window-free
// by construction; the per-day idempotency guard inside the resolution is
// untouched. (The production cron path keeps its own 9:20-9:35 AM ET gate.)

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const h = vi.hoisted(() => ({ db: null }));
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => h.db }));

import handler from './process-claims.js';

const SECRET = 'test-admin-secret';
const OFF_WINDOW = new Date('2026-06-10T18:00:00Z'); // 14:00 ET — far outside 9:20-9:35

function pickState(symbol) {
  return {
    symbol,
    legs: [{ direction: 'long', baselinePrice: 100, baselineSource: 'draft_resolution', openedAt: 'T0', thresholdHistory: [] }],
    flipCountToday: 0,
  };
}

function battleGroup(overrides = {}) {
  return {
    status: 'battle',
    groupMembers: ['u1', 'u2', 'u3', 'u4'],
    players: [
      { odUserId: 'u1', picks: [pickState('NVDA')] },
      { odUserId: 'u2', picks: [] },
      { odUserId: 'u3', picks: [] },
      { odUserId: 'u4', picks: [] },
    ],
    userPool: ['COIN'],
    dailyScores: {},
    claimSystem: { enabled: true, currentWaiverPriority: [], processingLog: [] },
    ...overrides,
  };
}

function makeDb({ groupDoc = null, claims = [] } = {}) {
  const captured = { claimUpdates: [], groupUpdates: [] };
  const pendingQuery = { __pendingClaims: true };
  const groupRef = {
    get: async () => ({ exists: groupDoc != null, data: () => groupDoc }),
    collection: () => ({ where: () => pendingQuery, doc: (id) => ({ __claimId: id }) }),
  };
  const db = {
    collection: () => ({ doc: () => ({ ...groupRef, id: 'group-1' }) }),
    runTransaction: async (fn) => fn({
      get: async (refOrQuery) => {
        if (refOrQuery === pendingQuery) {
          return {
            empty: claims.length === 0,
            size: claims.length,
            forEach: (cb) => claims.forEach(({ id, ...data }) => cb({ id, data: () => data })),
          };
        }
        return refOrQuery.get();
      },
      update: (ref, data) => {
        if (ref.__claimId) captured.claimUpdates.push({ id: ref.__claimId, ...data });
        else captured.groupUpdates.push(data);
      },
    }),
  };
  return { db, captured };
}

function makeReqRes(body = {}, headers = { 'x-admin-secret': SECRET }) {
  const req = { method: 'POST', headers, body: { groupId: 'group-1', ...body } };
  const res = { statusCode: null, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (payload) => { res.body = payload; return res; };
  return { req, res };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(OFF_WINDOW);
  vi.stubEnv('ADMIN_SECRET', SECRET);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('gates', () => {
  it('admin secret required; group must exist and be in battle', async () => {
    h.db = makeDb({ groupDoc: battleGroup() }).db;

    const unauthorized = makeReqRes({}, {});
    await handler(unauthorized.req, unauthorized.res);
    expect(unauthorized.res.statusCode).toBe(401);

    h.db = makeDb().db;
    const missing = makeReqRes();
    await handler(missing.req, missing.res);
    expect(missing.res.statusCode).toBe(404);

    h.db = makeDb({ groupDoc: battleGroup({ status: 'complete' }) }).db;
    const done = makeReqRes();
    await handler(done.req, done.res);
    expect(done.res.statusCode).toBe(409);
    expect(done.res.body.error).toBe('not_battle');
  });
});

describe('processing', () => {
  it('resolves pending claims with NO window gate (admin-gated bypass by construction)', async () => {
    const { db, captured } = makeDb({
      groupDoc: battleGroup(),
      claims: [{ id: 'c1', odUserId: 'u1', dropSymbol: 'NVDA', addSymbol: 'COIN', rank: 1, status: 'pending' }],
    });
    h.db = db;
    const { req, res } = makeReqRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ groupId: 'group-1', status: 'processed', approved: 1, denied: 0 });
    expect(captured.claimUpdates[0]).toMatchObject({ id: 'c1', status: 'approved' });
    expect(captured.groupUpdates).toHaveLength(1);
  });

  it('per-day idempotency still applies — never bypassed', async () => {
    const processed = battleGroup({
      claimSystem: { enabled: true, currentWaiverPriority: [], processingLog: [], lastProcessedDay: 1 },
    });
    const { db, captured } = makeDb({
      groupDoc: processed,
      claims: [{ id: 'c1', odUserId: 'u1', dropSymbol: 'NVDA', addSymbol: 'COIN', rank: 1, status: 'pending' }],
    });
    h.db = db;
    const { req, res } = makeReqRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ status: 'already_processed', day: 1 });
    expect(captured.claimUpdates).toHaveLength(0);
    expect(captured.groupUpdates).toHaveLength(0);
  });
});
