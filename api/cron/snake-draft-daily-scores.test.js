// api/cron/snake-draft-daily-scores.test.js
//
// Handler-level tests for the P1b tournament-banking branch riding this
// nightly cron (zero new schedule entries) — and, at P6a, the third
// tournament branch (seasonal-leaderboard aggregation, after banking).
// What they lock:
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

function makeDb({ drafts = [], groups = [], groupDocs = {}, agentBattles = [], ledgerDocs = {}, ledgerThrows = false } = {}) {
  const captured = { updates: [], txUpdates: [], txSets: [] };
  const db = {
    collection: (name) => ({
      // P6a code review: the fake now honors the equality filter (it
      // previously returned every seeded doc regardless of field/value, so
      // a wrong field name or status constant in a query could never fail
      // this battery — the integration lock it exists to be).
      where: (field, _op, value) => {
        const pool = name === 'drafts' ? drafts : name === 'tournamentGroups' ? groups : name === 'agentBattles' ? agentBattles : [];
        const runQuery = async () => ({
          forEach: (cb) => pool
            .filter(d => field === undefined || d.data?.[field] === value)
            .forEach(d => cb({ id: d.id, data: () => d.data })),
        });
        // select() is a field-mask hint (P2 reconcile + P6a agent scores
        // project battle docs); the fake returns full docs — a superset of
        // any projection.
        return { get: runQuery, select: () => ({ get: runQuery }) };
      },
      doc: (id) => ({
        get: async () => ({ exists: groupDocs[id] != null, data: () => groupDocs[id] }),
        update: async (data) => { captured.updates.push({ id, data }); },
        // P2: the agent held-set ledger sibling (ledger/agentHeldSet).
        collection: (sub) => {
          if (ledgerThrows) throw new Error('ledger subcollection exploded');
          return {
            doc: (subId) => ({
              get: async () => {
                const key = `${id}/${sub}/${subId}`;
                return { exists: ledgerDocs[key] != null, data: () => ledgerDocs[key] };
              },
            }),
          };
        },
      }),
    }),
    runTransaction: async (fn) => fn({
      get: async (ref) => ref.get(),
      update: (_ref, data) => { captured.txUpdates.push(data); },
      set: (_ref, data) => { captured.txSets.push(data); },
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
    // Additive branches, no-op:
    expect(res.body.tournament).toEqual({ groups: 0, processed: 0, skipped: 0, errors: 0, agentScoreFailures: 0 });
    // Training Slice 1 rolling-completion branch — additive, clean no-op with no groups.
    expect(res.body.trainingCompletion).toEqual({ groups: 0, completed: 0, skipped: 0, errors: 0 });
    expect(res.body.tournamentLedger).toEqual({ groups: 0, reconciled: 0, divergences: 0, staleCleared: 0, errors: 0, heldByGroup: {} });
    expect(res.body.tournamentLeaderboard).toEqual({ groups: 0, skippedNoBanking: 0, docsWritten: 0, errors: 0 });
    expect(captured.updates).toHaveLength(0);
    expect(captured.txUpdates).toHaveLength(0);
    expect(captured.txSets).toHaveLength(0);
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
    // P2: the ledger reconciliation also ran for the group (one tx.set of
    // the rebuilt sibling doc — empty here: no agent battles seeded).
    expect(res.body.tournamentLedger).toMatchObject({ groups: 1, reconciled: 1, errors: 0 });
    expect(captured.txSets).toHaveLength(1);
    expect(captured.txSets[0]).toMatchObject({ held: {}, reservations: {} });
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
    expect(res.body.tournament).toEqual({ groups: 0, processed: 0, skipped: 0, errors: 0, agentScoreFailures: 0 });
  });

  it('a legacy throw after the branch still reports the tournament result in the outer-catch 500', async () => {
    const db = {
      collection: (name) => {
        if (name === 'drafts') throw new Error('drafts query exploded');
        return { where: () => ({ get: async () => ({ forEach: () => {} }) }) };
      },
    };
    h.db = db;
    const { req, res } = makeReqRes();
    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.tournament).toEqual({ groups: 0, processed: 0, skipped: 0, errors: 0, agentScoreFailures: 0 });
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
    // The reconciliation branch queries the same collection — it fails
    // independently and is reported the same way.
    expect(res.body.tournamentLedger).toMatchObject({ errors: 1, failed: true });
  });

  it('P2: a ledger-reconciliation crash never breaks banking or the legacy path', async () => {
    vi.stubEnv('EODHD_API_KEY', 'test-key');
    vi.stubGlobal('fetch', async () => ({
      ok: true,
      status: 200,
      json: async () => [{ code: 'NVDA.US', open: 100, close: 103, previousClose: 99, timestamp: 1 }],
    }));

    const group = tournamentGroup();
    const { db, captured } = makeDb({
      groups: [{ id: 'g1', data: group }],
      groupDocs: { g1: group },
      ledgerThrows: true, // only the ledger sibling access explodes
    });
    h.db = db;
    const { req, res } = makeReqRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.tournament).toMatchObject({ groups: 1, processed: 1, errors: 0 }); // banking unharmed
    expect(res.body.tournamentLedger).toMatchObject({ groups: 1, reconciled: 0, errors: 1 });
    expect(captured.txUpdates).toHaveLength(1); // the banking write still landed
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

describe('P6a — tournament leaderboard branch (third branch, after banking)', () => {
  it('a banked group lands month-doc writes; the response carries the branch summary', async () => {
    vi.stubEnv('EODHD_API_KEY', 'test-key');
    vi.stubGlobal('fetch', async () => ({
      ok: true,
      status: 200,
      json: async () => [{ code: 'NVDA.US', open: 100, close: 103, previousClose: 99, timestamp: 1 }],
    }));

    // The group already carries a banked day (the static fake never applies
    // the banking tx), so the leaderboard branch has a month to attribute
    // (ruling A-3) — today's banking pass skips as already_recorded.
    const group = tournamentGroup();
    group.dailyScores = {
      day1: {
        recordedDate: '2026-06-10',
        closeScores: {
          u1: { totalPoints: 45, agentPoints: 30, compositePoints: 97.5, picks: [] },
          u2: { totalPoints: -20, agentPoints: 0, compositePoints: -30, picks: [] },
          u3: { totalPoints: 0, agentPoints: 0, compositePoints: 0, picks: [] },
          u4: { totalPoints: 0, agentPoints: 0, compositePoints: 0, picks: [] },
        },
      },
    };
    const { db, captured } = makeDb({ groups: [{ id: 'g1', data: group }], groupDocs: { g1: group } });
    h.db = db;
    const { req, res } = makeReqRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.tournamentLeaderboard).toMatchObject({ groups: 1, docsWritten: 1, errors: 0 });
    const monthDoc = captured.txSets.find(d => d.monthKey === '2026-06');
    expect(monthDoc).toBeDefined();
    expect(monthDoc.entries.u1.weeks.g1).toMatchObject({ points: 97.5, userPoints: 45, final: false });
    expect(monthDoc.entries.u2.points).toBe(-30); // negative row, first-class
  });
});
