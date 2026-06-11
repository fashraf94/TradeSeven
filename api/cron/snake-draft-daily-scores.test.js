// api/cron/snake-draft-daily-scores.test.js
//
// Handler-level tests for the P1b tournament-banking branch riding this
// nightly cron (zero new schedule entries). What they lock:
//
// 1. PRODUCTION INERTNESS: zero tournament groups is a clean no-op — the
//    production state until P3+ — and every legacy response key survives
//    unchanged with the additive `tournament` key alongside.
// 2. NO SHORT-CIRCUIT: the tournament branch runs and reports even when the
//    legacy path exits early (zero battles; legacy price failure 500).
//
// firebase-admin is mocked at the module boundary; the clock is pinned to a
// trading day so the handler's ET guards behave deterministically.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const h = vi.hoisted(() => ({ db: null }));
vi.mock('firebase-admin/app', () => ({
  initializeApp: vi.fn(),
  getApps: () => [{}], // already initialized → cert/env never touched
  cert: vi.fn(),
}));
vi.mock('firebase-admin/firestore', () => ({ getFirestore: () => h.db }));

import handler from './snake-draft-daily-scores.js';

const TRADING_DAY = new Date('2026-06-10T21:15:00Z'); // Wed 17:15 ET

function makeDb({ drafts = [], groups = [], groupDocs = {} } = {}) {
  const captured = { updates: [], txUpdates: [] };
  const db = {
    collection: (name) => ({
      where: () => ({
        get: async () => ({
          forEach: (cb) => (name === 'drafts' ? drafts : name === 'tournamentGroups' ? groups : [])
            .forEach(d => cb({ id: d.id, data: () => d.data })),
        }),
      }),
      doc: (id) => ({
        get: async () => ({ exists: groupDocs[id] != null, data: () => groupDocs[id] }),
        update: async (data) => { captured.updates.push({ id, data }); },
      }),
    }),
    runTransaction: async (fn) => fn({
      get: async (ref) => ref.get(),
      update: (_ref, data) => { captured.txUpdates.push(data); },
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

function leg(overrides = {}) {
  return { direction: 'long', baselinePrice: null, baselineSource: 'draft_resolution', openedAt: 'T0', thresholdHistory: [], ...overrides };
}

function tournamentGroup() {
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
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(TRADING_DAY);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('tournament banking branch — production inertness', () => {
  it('zero battles + ZERO tournament groups: legacy response keys unchanged, tournament reports a clean no-op', async () => {
    const { db, captured } = makeDb();
    h.db = db;
    const { req, res } = makeReqRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    // Legacy contract, verbatim:
    expect(res.body).toMatchObject({ success: true, message: 'No active battles', processed: 0 });
    // Additive branch, no-op:
    expect(res.body.tournament).toEqual({ groups: 0, processed: 0, skipped: 0, errors: 0 });
    expect(captured.updates).toHaveLength(0);
    expect(captured.txUpdates).toHaveLength(0);
  });
});

describe('tournament banking branch — no short-circuit', () => {
  it('zero legacy battles does not skip the tournament branch: the group banks', async () => {
    vi.stubEnv('EODHD_API_KEY', 'test-key');
    vi.stubGlobal('fetch', async () => ({
      ok: true,
      status: 200,
      json: async () => [{ code: 'NVDA.US', open: 100, close: 103, previousClose: 99, timestamp: 1 }],
    }));

    const group = tournamentGroup();
    const { db, captured } = makeDb({ groups: [{ id: 'g1', data: group }], groupDocs: { g1: group } });
    h.db = db;
    const { req, res } = makeReqRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.tournament).toMatchObject({ groups: 1, processed: 1, skipped: 0, errors: 0 });
    expect(captured.txUpdates).toHaveLength(1);
    expect(captured.txUpdates[0]['dailyScores.day1'].closeScores.u1.totalPoints).toBe(45);
  });

  it('a legacy price-fetch failure 500 still carries the tournament result (branch ran first)', async () => {
    vi.stubEnv('EODHD_API_KEY', 'test-key');
    vi.stubGlobal('fetch', async () => ({ ok: true, status: 200, json: async () => [] }));

    const draft = {
      status: 'battle',
      players: [
        { odUserId: 'a', picks: ['NVDA'] }, { odUserId: 'b', picks: ['AMD'] },
        { odUserId: 'c', picks: ['TSLA'] }, { odUserId: 'd', picks: ['META'] },
      ],
    };
    const { db } = makeDb({ drafts: [{ id: 'd1', data: draft }] });
    h.db = db;
    const { req, res } = makeReqRes();
    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({ success: false, error: 'Failed to fetch prices' });
    expect(res.body.tournament).toEqual({ groups: 0, processed: 0, skipped: 0, errors: 0 });
  });

  it('a tournament branch crash never breaks the legacy path', async () => {
    const db = {
      collection: (name) => {
        if (name === 'tournamentGroups') throw new Error('tournament query exploded');
        return {
          where: () => ({ get: async () => ({ forEach: () => {} }) }),
        };
      },
    };
    h.db = db;
    const { req, res } = makeReqRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ success: true, message: 'No active battles', processed: 0 });
    expect(res.body.tournament).toMatchObject({ errors: 1, failed: true });
  });
});

describe('handler guards (unchanged by the branch)', () => {
  it('rejects unauthenticated invocations', async () => {
    h.db = makeDb().db;
    const req = { headers: {} };
    const res = { statusCode: null, body: null };
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (payload) => { res.body = payload; return res; };
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it('skips entirely on non-trading days — tournament branch included', async () => {
    vi.setSystemTime(new Date('2026-06-13T21:15:00Z')); // Saturday
    const { db, captured } = makeDb({ groups: [{ id: 'g1', data: tournamentGroup() }] });
    h.db = db;
    const { req, res } = makeReqRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.message).toMatch(/market closed/);
    expect(res.body.tournament).toBeUndefined(); // the shared guard sits above both branches
    expect(captured.txUpdates).toHaveLength(0);
  });
});
