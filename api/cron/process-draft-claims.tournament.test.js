// api/cron/process-draft-claims.tournament.test.js
//
// Handler-level tests for the P1b tournament claims branch riding this cron
// (zero new schedule entries). Companion to process-draft-claims.test.js —
// that file's DST/idempotency batteries stay untouched; this one mocks the
// firebase-admin boundary to exercise the full handler. What it locks:
//
// 1. PRODUCTION INERTNESS: zero tournament groups is a clean no-op — the
//    production state until P3+ — with every legacy response key unchanged.
// 2. NO SHORT-CIRCUIT: zero legacy drafts does not skip the tournament
//    branch, and a tournament failure never breaks the legacy path.
// 3. The shared window + trading-day gates sit above BOTH branches.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const h = vi.hoisted(() => ({ db: null }));
vi.mock('firebase-admin/app', () => ({
  initializeApp: vi.fn(),
  getApps: () => [{}],
  cert: vi.fn(),
}));
vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => h.db,
  FieldValue: { arrayUnion: vi.fn(), serverTimestamp: vi.fn() },
}));

import handler from './process-draft-claims.js';

const IN_WINDOW = new Date('2026-06-10T13:25:00Z'); // Wed 9:25 AM ET (EDT)

function pickState(symbol) {
  return {
    symbol,
    legs: [{ direction: 'long', baselinePrice: 100, baselineSource: 'draft_resolution', openedAt: 'T0', thresholdHistory: [] }],
    flipCountToday: 0,
  };
}

function tournamentGroup() {
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
  };
}

function makeDb({ drafts = [], groups = [], claims = [] } = {}) {
  const captured = { claimUpdates: [], groupUpdates: [], batchUpdates: [] };
  const pendingQuery = { __pendingClaims: true };
  const groupRef = {
    get: async () => {
      const doc = groups[0];
      return { exists: doc != null, data: () => doc?.data };
    },
    collection: () => ({ where: () => pendingQuery, doc: (id) => ({ __claimId: id }) }),
  };
  const db = {
    collection: (name) => ({
      where: () => ({
        get: async () => ({
          forEach: (cb) => (name === 'drafts' ? drafts : name === 'tournamentGroups' ? groups : [])
            .forEach(d => cb({ id: d.id, data: () => d.data })),
        }),
      }),
      doc: () => groupRef,
    }),
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
    batch: () => ({
      update: (_ref, data) => { captured.batchUpdates.push(data); },
      commit: async () => {},
    }),
  };
  return { db, captured };
}

function makeReqRes() {
  const req = { headers: { 'x-vercel-cron': '1' } };
  const res = { statusCode: null, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (payload) => { res.body = payload; return res; };
  return { req, res };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(IN_WINDOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('tournament claims branch — production inertness', () => {
  it('zero drafts + ZERO tournament groups: legacy response unchanged, tournament reports a clean no-op', async () => {
    const { db, captured } = makeDb();
    h.db = db;
    const { req, res } = makeReqRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      message: 'No drafts with claim system enabled',
      processed: 0,
    });
    expect(res.body.tournament).toEqual({ groups: 0, processed: 0, skipped: 0, errors: 0 });
    expect(captured.groupUpdates).toHaveLength(0);
    expect(captured.claimUpdates).toHaveLength(0);
  });
});

describe('tournament claims branch — no short-circuit', () => {
  it('zero legacy drafts does not skip the branch: the group\'s pending claim resolves', async () => {
    const group = tournamentGroup();
    const { db, captured } = makeDb({
      groups: [{ id: 'g1', data: group }],
      claims: [{ id: 'c1', odUserId: 'u1', dropSymbol: 'NVDA', addSymbol: 'COIN', rank: 1, status: 'pending' }],
    });
    h.db = db;
    const { req, res } = makeReqRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe('No drafts with claim system enabled'); // legacy untouched
    expect(res.body.tournament).toMatchObject({ groups: 1, processed: 1, skipped: 0, errors: 0 });
    expect(captured.claimUpdates[0]).toMatchObject({ id: 'c1', status: 'approved' });
    expect(captured.groupUpdates).toHaveLength(1);
    expect(captured.groupUpdates[0]['claimSystem.lastProcessedDay']).toBe(1);
  });

  it('a tournament branch crash never breaks the legacy path', async () => {
    const db = {
      collection: (name) => {
        if (name === 'tournamentGroups') throw new Error('tournament query exploded');
        return { where: () => ({ get: async () => ({ forEach: () => {} }) }) };
      },
    };
    h.db = db;
    const { req, res } = makeReqRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ success: true, message: 'No drafts with claim system enabled' });
    expect(res.body.tournament).toMatchObject({ errors: 1, failed: true });
  });
});

describe('shared gates sit above both branches', () => {
  it('the off-DST firing window-skips before either branch runs', async () => {
    vi.setSystemTime(new Date('2026-06-10T14:25:00Z')); // 10:25 ET — out of window
    const { db, captured } = makeDb({
      groups: [{ id: 'g1', data: tournamentGroup() }],
      claims: [{ id: 'c1', odUserId: 'u1', dropSymbol: 'NVDA', addSymbol: 'COIN', rank: 1, status: 'pending' }],
    });
    h.db = db;
    const { req, res } = makeReqRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ skipped: true, reason: 'not_claim_window' });
    expect(res.body.tournament).toBeUndefined();
    expect(captured.groupUpdates).toHaveLength(0);
  });

  it('unauthenticated invocations are rejected', async () => {
    h.db = makeDb().db;
    const req = { headers: {} };
    const res = { statusCode: null, body: null };
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (payload) => { res.body = payload; return res; };
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });
});
