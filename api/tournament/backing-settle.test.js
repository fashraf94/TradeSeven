// api/tournament/backing-settle.test.js
//
// POST /api/tournament/backing-settle — Backing Beta PR 3, the admin re-run
// (spec V1.3 §7 "Retries" / "Admin re-run", §12 PR 3, D-o; A-C13 for the
// freeze). The LIT suite: the flag is mocked to true per row (and to false
// for the auth-before-flag row); the darkness suite is the sibling
// backing-settle.dark.test.js and does not move with the flip.
//
// THE ROWS THIS FILE EXISTS FOR:
//   · the route is the D-ae hold's ONLY release path, and it releases only on
//     an explicit `overrideHold: true`, recording who and why on the pool;
//   · the freeze is checked HERE, before any read (A-C13);
//   · a simulated clock settles DEV pods only — never a fictitious
//     `settledAt` on real BP.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the route's real import below is
// the runtime guard for its api/ -> src/ imports. Never mock the constants.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const flags = vi.hoisted(() => ({ backing: true, frozen: false }));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get BACKING_BETA_ENABLED() { return flags.backing; },
  get TOURNAMENT_ADVANCEMENT_FROZEN() { return flags.frozen; },
}));

let DB = null;
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => DB.db }));

const { makeInMemoryDb } = await import('../_utils/__fixtures__/inMemoryFirestore.js');
const { default: handler, MAX_REASON_LEN } = await import('./backing-settle.js');
const {
  BACKING_POOLS_COLLECTION, BACKING_STAKES_COLLECTION, POOL_STATUS, STAKE_STATUS, totalsFromStakes,
} = await import('../_utils/backingPools.js');
const { BACKING_WALLETS_COLLECTION } = await import('../_utils/backingWallet.js');
const { HOLD_REASON, SETTLEMENT_REASON, SETTLEMENT_SOURCE } = await import('../_utils/backingSettlement.js');
const { GROUP_STATUS, round2 } = await import('../../src/constants/leagueTournament.js');

// ==================== FIXTURES ====================
const SECRET = 'test-admin-secret';
const GROUP_ID = 'grp-admin-1';
const WEEK = '2026-W40';
const NOW = new Date('2026-10-02T22:30:00.000Z');
const SIM = '2026-10-03T12:00:00.000Z';
const DAYS = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02'];
const PLAYERS = [{ odUserId: 'od-a' }, { odUserId: 'od-b' }, { odUserId: 'cpu-1', isCpu: true }, { odUserId: 'cpu-2', isCpu: true }];

function bankedWeek({ agentless = false } = {}) {
  const final = { 'od-a': [60, 30], 'od-b': [40, 20], 'cpu-1': [20, 10], 'cpu-2': [10, 5] };
  const dailyScores = {};
  for (let i = 0; i < 5; i += 1) {
    const closeScores = {};
    for (const [id, [user, agentRaw]] of Object.entries(final)) {
      const agent = agentless && !id.startsWith('cpu') ? 0 : agentRaw;
      closeScores[id] = { totalPoints: user, agentPoints: agent, compositePoints: round2(agent + 1.5 * user), picks: [] };
    }
    dailyScores[`day${i + 1}`] = { recordedDate: DAYS[i], closeScores };
  }
  return dailyScores;
}

const group = (over = {}) => ({
  status: GROUP_STATUS.COMPLETE, isLiveDraft: false, baseLayerWeek: WEEK,
  createdAt: '2026-09-22T14:00:00.000Z', updatedAt: NOW.toISOString(),
  groupMembers: PLAYERS.map((p) => p.odUserId), players: PLAYERS, dailyScores: bankedWeek(), ...over,
});

const STAKES = () => [
  [`${BACKING_STAKES_COLLECTION}/s1`, { userId: 'u1', groupId: GROUP_ID, teamOdUserId: 'od-a', amount: 300, weekKey: WEEK, requestId: 'r1', status: STAKE_STATUS.LIVE }],
  [`${BACKING_STAKES_COLLECTION}/s2`, { userId: 'u2', groupId: GROUP_ID, teamOdUserId: 'od-b', amount: 200, weekKey: WEEK, requestId: 'r2', status: STAKE_STATUS.LIVE }],
  [`${BACKING_STAKES_COLLECTION}/s3`, { userId: 'u3', groupId: GROUP_ID, teamOdUserId: 'od-b', amount: 100, weekKey: WEEK, requestId: 'r3', status: STAKE_STATUS.LIVE }],
];

function world({ g = group(), poolOver = {}, stakes = STAKES() } = {}) {
  const dev = g.isDev === true;
  const poolId = dev ? `dev-${GROUP_ID}` : GROUP_ID;
  const totals = totalsFromStakes(stakes.map(([, s]) => s));
  const initial = {
    [`tournamentGroups/${GROUP_ID}`]: g,
    [`${BACKING_POOLS_COLLECTION}/${poolId}`]: {
      groupId: GROUP_ID, status: POOL_STATUS.CLOSED, formationPath: 'lobby', slotId: null,
      battleMondayEtDate: '2026-09-28', backingWeekStart: '2026-09-21T04:00:00.000Z',
      opensAt: '2026-09-22T14:00:00.000Z', closesAt: '2026-09-28T03:59:59.000Z', closeReason: 'clock',
      baseLayerWeek: WEEK, isDev: dev,
      teams: PLAYERS.map((p) => ({ odUserId: p.odUserId, isCpu: p.isCpu === true, stakeTotal: totals.byTeam[p.odUserId]?.stakeTotal ?? 0, backerCount: totals.byTeam[p.odUserId]?.backerCount ?? 0 })),
      humanTeams: 2, potTotal: totals.private.potTotal, uniqueBackers: totals.private.uniqueBackers, teamsBacked: totals.private.teamsBacked,
      closedAt: '2026-09-28T04:00:00.000Z', createdAt: '2026-09-22T14:00:00.000Z', updatedAt: '2026-09-28T04:00:00.000Z',
      ...poolOver,
    },
    [`${BACKING_POOLS_COLLECTION}/${poolId}/private/totals`]: { ...totals.private, updatedAt: '2026-09-28T04:00:00.000Z' },
  };
  for (const [path, data] of stakes) initial[path] = data;
  for (const [, s] of stakes) {
    initial[`${BACKING_WALLETS_COLLECTION}/${dev ? `dev-${s.userId}` : s.userId}`] = {
      lastAllowanceWeek: WEEK, allowanceRemaining: 1000 - s.amount, careerNet: -s.amount, seasons: {},
      appliedEntries: { [`allowance:${WEEK}`]: 'x', [`stake:${s.requestId.replace('r', 's')}`]: 'x' },
      createdAt: '2026-09-22T14:00:00.000Z', updatedAt: '2026-09-23T14:00:00.000Z',
    };
  }
  return initial;
}

const mkRes = () => ({
  statusCode: null, body: null,
  status(c) { this.statusCode = c; return this; },
  json(b) { this.body = b; return this; },
});
async function post(body, { method = 'POST', secret = SECRET } = {}) {
  const res = mkRes();
  await handler({ method, headers: secret ? { 'x-admin-secret': secret } : {}, body }, res);
  return res;
}
const poolOf = (id = GROUP_ID) => DB.store.get(`${BACKING_POOLS_COLLECTION}/${id}`);

beforeEach(() => {
  flags.backing = true;
  flags.frozen = false;
  vi.stubEnv('ADMIN_SECRET', SECRET);
  DB = makeInMemoryDb(world());
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

// ============================================================================
describe('the pipeline, in order', () => {
  it('405s anything but POST', async () => {
    for (const method of ['GET', 'PUT', 'DELETE']) {
      expect((await post({ groupId: GROUP_ID }, { method })).statusCode).toBe(405);
    }
  });

  it('401s without the secret whether dark or lit, then 404s while dark — auth first', async () => {
    for (const backing of [true, false]) {
      flags.backing = backing;
      expect((await post({ groupId: GROUP_ID }, { secret: null })).statusCode).toBe(401);
      expect((await post({ groupId: GROUP_ID }, { secret: 'wrong' })).statusCode).toBe(401);
    }
    flags.backing = false;
    const res = await post({ groupId: GROUP_ID });
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
    expect(DB.writeLog).toEqual([]);
    expect(DB.readLog).toEqual([]);
  });

  it('accepts a Bearer token as well as the header', async () => {
    const res = mkRes();
    await handler({ method: 'POST', headers: { authorization: `Bearer ${SECRET}` }, body: { groupId: GROUP_ID } }, res);
    expect(res.statusCode).toBe(200);
  });

  const bad = [
    ['no groupId', {}, 'invalid_group_id'],
    ['a non-string groupId', { groupId: 42 }, 'invalid_group_id'],
    ['a groupId with a slash', { groupId: 'a/b' }, 'invalid_group_id'],
    ['an over-long groupId', { groupId: 'x'.repeat(201) }, 'invalid_group_id'],
    ['a non-boolean overrideHold', { groupId: GROUP_ID, overrideHold: 'yes' }, 'invalid_override'],
    ['an over-long reason', { groupId: GROUP_ID, reason: 'r'.repeat(MAX_REASON_LEN + 1) }, 'invalid_reason'],
    ['a non-string reason', { groupId: GROUP_ID, reason: 7 }, 'invalid_reason'],
    ['a malformed simulatedNow', { groupId: GROUP_ID, simulatedNow: 'tomorrow' }, 'invalid_simulated_now'],
    ['a non-string simulatedNow', { groupId: GROUP_ID, simulatedNow: 12 }, 'invalid_simulated_now'],
  ];
  for (const [label, body, error] of bad) {
    it(`400s ${label} (${error}) and reads nothing`, async () => {
      const res = await post(body);
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe(error);
      expect(DB.readLog).toEqual([]);
      expect(DB.writeLog).toEqual([]);
    });
  }

  it('400s a body that is not JSON', async () => {
    const res = await post('{not json');
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('invalid_body');
  });

  it('accepts a JSON STRING body (the run-duty shape)', async () => {
    const res = await post(JSON.stringify({ groupId: GROUP_ID }));
    expect(res.statusCode).toBe(200);
    expect(res.body.settled).toBe(true);
  });
});

// ============================================================================
describe('the freeze — this route\'s own check (A-C13)', () => {
  it('409s while TOURNAMENT_ADVANCEMENT_FROZEN, before any read, override or not', async () => {
    flags.frozen = true;
    for (const body of [{ groupId: GROUP_ID }, { groupId: GROUP_ID, overrideHold: true, reason: 'x' }]) {
      const res = await post(body);
      expect(res.statusCode).toBe(409);
      expect(res.body.error).toBe('frozen');
    }
    expect(DB.readLog).toEqual([]);
    expect(DB.writeLog).toEqual([]);
    expect(poolOf().status).toBe(POOL_STATUS.CLOSED);
  });
});

// ============================================================================
describe('the re-run', () => {
  it('settles a closed pool whose pod is complete: 200, the primitive\'s own answer, settlementRef admin', async () => {
    const res = await post({ groupId: GROUP_ID });
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      groupId: GROUP_ID, simulated: false, overrideHold: false,
      settled: true, winners: ['od-a'], winningStakes: 300, paysX: 2, stakesSettled: 3, payoutsTotal: 600,
    });
    expect(poolOf()).toMatchObject({ status: POOL_STATUS.RESOLVED, settlementRef: SETTLEMENT_SOURCE.ADMIN, settledAt: NOW.toISOString() });
    expect(DB.store.get(`${BACKING_STAKES_COLLECTION}/s1`)).toMatchObject({ status: STAKE_STATUS.WON, payout: 600 });
    expect(DB.store.get(`${BACKING_WALLETS_COLLECTION}/u1`).careerNet).toBe(300);
  });

  it('a second run is already_settled and writes nothing — the whole-pool retry is safe', async () => {
    await post({ groupId: GROUP_ID });
    const writes = DB.writeLog.length;
    const res = await post({ groupId: GROUP_ID });
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ settled: false, reason: SETTLEMENT_REASON.ALREADY_SETTLED });
    expect(DB.writeLog.length).toBe(writes);
  });

  it('answers the primitive\'s refusal for a pod that is not final, an unknown pod, or a pod with no pool', async () => {
    DB = makeInMemoryDb(world({ g: group({ status: GROUP_STATUS.BATTLE }) }));
    expect((await post({ groupId: GROUP_ID })).body).toMatchObject({ settled: false, reason: SETTLEMENT_REASON.NOT_FINAL });
    expect((await post({ groupId: 'nobody' })).body).toMatchObject({ settled: false, reason: SETTLEMENT_REASON.NO_GROUP });
    DB = makeInMemoryDb({ [`tournamentGroups/${GROUP_ID}`]: group() });
    expect((await post({ groupId: GROUP_ID })).body).toMatchObject({ settled: false, reason: SETTLEMENT_REASON.NO_POOL });
  });

  it('a typed refusal answers its status code and NEVER the internal message', async () => {
    // A groupId already inside the dev namespace: poolIdFor refuses it (a
    // BackingPoolError, 400) — the message names internal id semantics.
    DB = makeInMemoryDb({ 'tournamentGroups/dev-x': group() });
    const res = await post({ groupId: 'dev-x' });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('invalid_group_id');
    expect(JSON.stringify(res.body)).not.toContain('ambiguous');
  });

  it('a primitive that throws an untyped error is a 500 with a generic body', async () => {
    DB.db.runTransaction = async () => { throw new Error('Firestore is on fire'); };
    const res = await post({ groupId: GROUP_ID });
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: 'server_error', message: 'Could not run the settlement.' });
  });
});

// ============================================================================
describe('the D-ae hold and its ONLY release path', () => {
  beforeEach(() => { DB = makeInMemoryDb(world({ g: group({ dailyScores: bankedWeek({ agentless: true }) }) })); });

  it('a re-run WITHOUT overrideHold holds an agent-less pool and then leaves it held', async () => {
    const first = await post({ groupId: GROUP_ID });
    expect(first.body).toMatchObject({ settled: false, reason: SETTLEMENT_REASON.AGENT_LAYER_ABSENT, holdReason: HOLD_REASON.AGENT_LAYER_ABSENT });
    expect(poolOf()).toMatchObject({ status: POOL_STATUS.RESOLVING, holdReason: HOLD_REASON.AGENT_LAYER_ABSENT, holdSource: SETTLEMENT_SOURCE.ADMIN });
    const writes = DB.writeLog.length;
    const second = await post({ groupId: GROUP_ID });
    expect(second.body).toMatchObject({ settled: false, reason: SETTLEMENT_REASON.HELD, holdReason: HOLD_REASON.AGENT_LAYER_ABSENT });
    expect(DB.writeLog.length).toBe(writes);
    expect(DB.store.get(`${BACKING_STAKES_COLLECTION}/s1`).status).toBe(STAKE_STATUS.LIVE);
  });

  it('overrideHold: true releases the hold and settles, logging and recording who and why', async () => {
    await post({ groupId: GROUP_ID });
    const res = await post({ groupId: GROUP_ID, overrideHold: true, reason: 'agent layer verified in the Console' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ overrideHold: true, settled: true, winners: ['od-a'] });
    expect(poolOf()).toMatchObject({
      status: POOL_STATUS.RESOLVED,
      holdRelease: { by: 'admin', at: NOW.toISOString(), priorHoldReason: HOLD_REASON.AGENT_LAYER_ABSENT, reason: 'agent layer verified in the Console' },
    });
    expect(poolOf()).not.toHaveProperty('holdReason');
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('HOLD OVERRIDE requested for grp-admin-1 by admin — reason: agent layer verified in the Console'));
    expect(DB.store.get(`${BACKING_STAKES_COLLECTION}/s1`)).toMatchObject({ status: STAKE_STATUS.WON, payout: 600 });
  });

  it('overrideHold on a pool that is NOT held simply settles it (no hold to clear, nothing recorded)', async () => {
    DB = makeInMemoryDb(world());
    const res = await post({ groupId: GROUP_ID, overrideHold: true, reason: 'belt' });
    expect(res.body.settled).toBe(true);
    expect(poolOf()).not.toHaveProperty('holdRelease');
  });
});

// ============================================================================
describe('a simulated clock settles DEV pods only', () => {
  it('refuses a PRODUCTION pod under simulatedNow — 409, nothing written', async () => {
    const res = await post({ groupId: GROUP_ID, simulatedNow: SIM });
    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe('simulated_requires_dev');
    expect(DB.writeLog).toEqual([]);
    expect(poolOf().status).toBe(POOL_STATUS.CLOSED);
  });

  it('settles a DEV pod at the simulated instant, in the dev namespace, stamped admin_sim', async () => {
    DB = makeInMemoryDb(world({ g: group({ isDev: true }) }));
    const res = await post({ groupId: GROUP_ID, simulatedNow: SIM });
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ simulated: true, settled: true });
    expect(poolOf(`dev-${GROUP_ID}`)).toMatchObject({ status: POOL_STATUS.RESOLVED, settledAt: SIM, settlementRef: SETTLEMENT_SOURCE.ADMIN_SIM });
    expect(DB.store.get(`${BACKING_WALLETS_COLLECTION}/dev-u1`).careerNet).toBe(300);
    expect(DB.writeLog.every(([, p]) => p.startsWith('backing'))).toBe(true);
  });

  it('an unknown pod under simulatedNow is not refused as production — it is simply no_group', async () => {
    const res = await post({ groupId: 'nobody', simulatedNow: SIM });
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ settled: false, reason: SETTLEMENT_REASON.NO_GROUP, simulated: true });
  });
});
