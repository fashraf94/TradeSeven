// api/tournament/place-cpu-claims.test.js
//
// Slice 4 (B4) — the dev/preview CPU-claim trigger: admin-secret gate,
// training-scoped + battle checks, and the per-cycle idempotency it inherits
// from placeCpuClaimsForGroup (a re-run is a no-op).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const h = vi.hoisted(() => ({ db: null }));
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => h.db }));

import handler from './place-cpu-claims.js';

const SECRET = 'test-admin-secret';
const NOW = new Date('2026-06-10T21:00:00Z'); // Wed 17:00 ET → etDate 2026-06-10
const ET = '2026-06-10';

function pick(symbol) {
  return { symbol, legs: [{ direction: 'long', baselinePrice: 100, baselineSource: 'draft_resolution', openedAt: 'T0', thresholdHistory: [] }], flipCountToday: 0 };
}

function trainingPod(overrides = {}) {
  return {
    isTraining: true,
    status: 'battle',
    groupMembers: ['u1', 'cpu-1', 'cpu-2', 'cpu-3'],
    players: [
      { odUserId: 'u1', picks: [pick('HUM1'), pick('HUM2'), pick('HUM3')] },
      { odUserId: 'cpu-1', isCpu: true, displayName: 'Bot 1', picks: [pick('AAA'), pick('BBB'), pick('CCC')] },
      { odUserId: 'cpu-2', isCpu: true, displayName: 'Bot 2', picks: [pick('DDD'), pick('EEE'), pick('FFF')] },
      { odUserId: 'cpu-3', isCpu: true, displayName: 'Bot 3', picks: [pick('GGG'), pick('HHH'), pick('III')] },
    ],
    userPool: ['P0', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10', 'P11', 'P12', 'P13', 'P14'],
    claimSystem: { enabled: true, currentWaiverPriority: [], processingLog: [] },
    dailyScores: { day1: { recordedDate: ET, closeScores: {
      'cpu-1': { picks: [{ symbol: 'AAA', totalPoints: 5 }, { symbol: 'BBB', totalPoints: -3 }, { symbol: 'CCC', totalPoints: 2 }] },
    } } },
    ...overrides,
  };
}

function makeDb(groupsById) {
  let seq = 0;
  const placed = [];
  const docRef = (groupId) => ({
    id: groupId,
    get: async () => ({ exists: groupsById[groupId] != null, id: groupId, data: () => groupsById[groupId] }),
    collection: () => {
      const q = { where: () => q, get: async () => ({ size: 0, forEach: () => {} }), doc: () => ({ id: `claim-${++seq}`, __groupId: groupId }) };
      return q;
    },
  });
  const db = {
    collection: () => ({ doc: (id) => docRef(id) }),
    runTransaction: async (fn) => fn({
      get: async (x) => x.get(),
      update: (ref, data) => {
        const g = groupsById[ref.id];
        if (Object.prototype.hasOwnProperty.call(data, 'claimSystem.lastCpuClaimDay')) {
          g.claimSystem = { ...(g.claimSystem || {}), lastCpuClaimDay: data['claimSystem.lastCpuClaimDay'] };
        }
      },
      set: (ref, doc) => placed.push({ groupId: ref.__groupId, claim: doc }),
    }),
  };
  return { db, placed };
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
  vi.setSystemTime(NOW);
  vi.stubEnv('ADMIN_SECRET', SECRET);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('place-cpu-claims gates', () => {
  it('rejects non-POST, missing admin secret, and a malformed id', async () => {
    h.db = makeDb({ 'group-1': trainingPod() }).db;

    const get = makeReqRes(); get.req.method = 'GET';
    await handler(get.req, get.res);
    expect(get.res.statusCode).toBe(405);

    const noSecret = makeReqRes({}, {});
    await handler(noSecret.req, noSecret.res);
    expect(noSecret.res.statusCode).toBe(401);

    const badId = makeReqRes({ groupId: 'a/b' });
    await handler(badId.req, badId.res);
    expect(badId.res.statusCode).toBe(400);
  });

  it('404 missing; 409 not_training (ranked); 409 not_battle', async () => {
    h.db = makeDb({}).db;
    const missing = makeReqRes();
    await handler(missing.req, missing.res);
    expect(missing.res.statusCode).toBe(404);

    h.db = makeDb({ 'group-1': trainingPod({ isTraining: false }) }).db;
    const ranked = makeReqRes();
    await handler(ranked.req, ranked.res);
    expect(ranked.res.statusCode).toBe(409);
    expect(ranked.res.body.error).toBe('not_training');

    h.db = makeDb({ 'group-1': trainingPod({ status: 'awaiting_open' }) }).db;
    const notBattle = makeReqRes();
    await handler(notBattle.req, notBattle.res);
    expect(notBattle.res.statusCode).toBe(409);
    expect(notBattle.res.body.error).toBe('not_battle');
  });
});

describe('placement (idempotent per cycle)', () => {
  it('reserves the cycle and returns 200; a re-run is an already_placed no-op', async () => {
    const pod = trainingPod();
    h.db = makeDb({ 'group-1': pod }).db;

    const first = makeReqRes();
    await handler(first.req, first.res);
    expect(first.res.statusCode).toBe(200);
    expect(first.res.body.groupId).toBe('group-1');
    expect(['placed', 'no_claims']).toContain(first.res.body.status);
    expect(pod.claimSystem.lastCpuClaimDay).toBe(1); // cycle reserved

    const second = makeReqRes();
    await handler(second.req, second.res);
    expect(second.res.statusCode).toBe(200);
    expect(second.res.body).toMatchObject({ status: 'already_placed', placed: 0 });
  });
});
