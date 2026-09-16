// api/tournament/backing-pools.test.js
//
// GET /api/tournament/backing-pools — Backing Beta PR 2, the pod list (spec
// V1.3 §5 "Upcoming pods", §3 sealed pools, §4 window, §6 zero new indexes,
// §12 PR 2).
//
// THE ROW THIS FILE EXISTS FOR is the SEAL: while a pool is open, no per-team
// stake total and no pays × may appear ANYWHERE in the response. §3 makes the
// seal the property the whole design rests on, so it is asserted against the
// serialized body — not against the fields a reviewer happened to look at.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the route's real import below is
// the runtime guard for its api/ -> src/ imports. Never mock the constants.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const state = vi.hoisted(() => ({ flag: true, uid: 'viewer-1' }));

vi.mock('../_utils/security.js', () => ({ applySecurityMiddleware: () => false }));
vi.mock('../_utils/authMiddleware.js', () => ({
  requireAuth: async (_req, res) => {
    if (!state.uid) { res.status(401).json({ error: 'Authentication required' }); return null; }
    return { uid: state.uid, firebase: { sign_in_provider: 'password' } };
  },
}));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get BACKING_BETA_ENABLED() { return state.flag; },
}));

let DB = null;
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => DB.db }));

const { makeInMemoryDb } = await import('../_utils/__fixtures__/inMemoryFirestore.js');
const {
  default: handler, POD_LIST_MAX, listablePod, podListWeek, projectPod, REVEALED_STATUSES,
} = await import('./backing-pools.js');
const {
  BACKING_POOLS_COLLECTION, BACKING_STAKES_COLLECTION, POOL_STATUS, STAKE_STATUS,
} = await import('../_utils/backingPools.js');
const { VALIDITY_MIN_BACKERS, VALIDITY_MIN_TEAMS } = await import('../../src/constants/backing.js');

// ==================== FIXTURES ====================
const UID = 'viewer-1';
const WEEK = '2026-W40';
const MONDAY = '2026-09-28';
const CLOSE_ISO = '2026-09-28T03:59:59.000Z';
const NOW = new Date('2026-09-22T14:00:00.000Z');   // Tue of the backing week

const group = (id, over = {}) => ({
  status: 'forming',
  isLiveDraft: false,
  baseLayerWeek: WEEK,
  createdAt: '2026-09-22T13:00:00.000Z',
  updatedAt: '2026-09-22T13:00:00.000Z',
  seatNames: { 'od-a': 'Ada', 'od-b': 'Bo' },
  players: [{ odUserId: 'od-a' }, { odUserId: 'od-b' }, { odUserId: 'cpu-1', isCpu: true }],
  ...over,
  __id: id,
});

const pool = (groupId, over = {}) => ({
  groupId,
  status: POOL_STATUS.OPEN,
  formationPath: 'lobby',
  slotId: null,
  battleMondayEtDate: MONDAY,
  backingWeekStart: '2026-09-21T04:00:00.000Z',
  opensAt: '2026-09-22T13:00:00.000Z',
  closesAt: CLOSE_ISO,
  closeReason: 'clock',
  baseLayerWeek: WEEK,
  isDev: false,
  potTotal: 0,
  uniqueBackers: 0,
  teamsBacked: 0,
  createdAt: '2026-09-22T13:00:00.000Z',
  updatedAt: '2026-09-22T13:00:00.000Z',
  ...over,
});

function seed(groups = [], extra = {}) {
  const initial = { ...extra };
  for (const g of groups) {
    const { __id, ...data } = g;
    initial[`tournamentGroups/${__id}`] = data;
  }
  return makeInMemoryDb(initial);
}

const mkRes = () => ({
  statusCode: null, body: null,
  status(c) { this.statusCode = c; return this; },
  json(b) { this.body = b; return this; },
});

async function get(method = 'GET') {
  const res = mkRes();
  await handler({ method, headers: {}, query: {} }, res);
  return res;
}

beforeEach(() => {
  state.flag = true;
  state.uid = UID;
  DB = seed([group('g1')]);
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

// ============================================================================
describe('the pipeline, in order', () => {
  it('405s anything but GET', async () => {
    for (const method of ['POST', 'PUT', 'DELETE']) {
      expect((await get(method)).statusCode).toBe(405);
    }
  });

  it('401s without a caller, then 404s while the flag is dark — auth first', async () => {
    state.uid = null;
    for (const flag of [true, false]) {
      state.flag = flag;
      expect((await get()).statusCode).toBe(401);
    }
    state.uid = UID;
    state.flag = false;
    expect((await get()).statusCode).toBe(404);
  });
});

// ============================================================================
describe('the week the list is keyed to (§5)', () => {
  it('names the NEXT battle Monday\'s week — the writers\' own exported pair', () => {
    expect(podListWeek(NOW)).toBe(WEEK);
    // A Monday BEFORE 09:30 ET names that same Monday's week, whose backing
    // closed the night before — §5's own parenthetical, shown as closed.
    expect(podListWeek(new Date('2026-09-28T12:00:00.000Z'))).toBe(WEEK);
    // ...and from 09:30 ET on that Monday, the NEXT week.
    expect(podListWeek(new Date('2026-09-28T14:00:00.000Z'))).toBe('2026-W41');
  });

  it('answers the week and its bounds even when no pod matches', async () => {
    DB = seed([]);
    const res = await get();
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      baseLayerWeek: WEEK,
      backingWeekStart: '2026-09-21T04:00:00.000Z',
      // The WEEK's close, not a pod's: a slot pod's pool closes at its fire
      // instant, which is a different instant and a different field (§4).
      backingWeekCloses: CLOSE_ISO,
      viewerUid: UID,
      pods: [],
    });
  });
});

// ============================================================================
describe('the in-memory filters §6 keeps out of the query', () => {
  const rows = [
    ['a dev pod', { isDev: true }],
    ['a training pod', { isTraining: true }],
    ['a voided group', { status: 'voided' }],
    ['an expired group', { status: 'expired' }],
    ['the Mon 08:45 slot', { isLiveDraft: true, slotId: 'mon-0845' }],
  ];
  for (const [label, over] of rows) {
    it(`drops ${label}`, async () => {
      DB = seed([group('g1', over), group('g2')]);
      const res = await get();
      expect(res.body.pods.map((p) => p.groupId)).toEqual(['g2']);
    });
  }

  it('listablePod is the ONE predicate — each clause exercised against it directly', () => {
    expect(listablePod(group('g'))).toBe(true);
    expect(listablePod(group('g', { isDev: true }))).toBe(false);
    expect(listablePod(group('g', { isTraining: true }))).toBe(false);
    expect(listablePod(group('g', { status: 'voided' }))).toBe(false);
    expect(listablePod(group('g', { status: 'expired' }))).toBe(false);
    expect(listablePod(group('g', { slotId: 'mon-0845' }))).toBe(false);
    // A pod already in battle or complete is NOT filtered here: its pool may be
    // closed and still belongs on the list (§5 shows closed pools of the week).
    expect(listablePod(group('g', { status: 'battle' }))).toBe(true);
    expect(listablePod(group('g', { status: 'complete' }))).toBe(true);
  });

  it('keys on baseLayerWeek — a pod of another week is not listed', async () => {
    DB = seed([group('g1'), group('g2', { baseLayerWeek: '2026-W41' })]);
    expect((await get()).body.pods.map((p) => p.groupId)).toEqual(['g1']);
  });

  it('caps the query at POD_LIST_MAX', () => {
    expect(POD_LIST_MAX).toBeGreaterThanOrEqual(12);
  });
});

// ============================================================================
describe('the lazy jobs ride here (§4, §7)', () => {
  it('MATERIALIZES a pool for an eligible pod that has none', async () => {
    DB = seed([group('g1')]);
    const res = await get();
    expect(res.body.pods[0].pool).toMatchObject({
      status: POOL_STATUS.OPEN, potTotal: 0, uniqueBackers: 0, closesAt: CLOSE_ISO, closeReason: 'clock',
    });
    expect(DB.store.get(`${BACKING_POOLS_COLLECTION}/g1`).status).toBe(POOL_STATUS.OPEN);
  });

  it('lists an INELIGIBLE pod with no pool rather than dropping it', async () => {
    // A pod read on Saturday night fails the 24-hour rule: it is still a pod of
    // the week, it simply has nothing to back.
    vi.setSystemTime(new Date('2026-09-27T12:00:00.000Z'));
    DB = seed([group('g1')]);
    const res = await get();
    expect(res.body.pods).toHaveLength(1);
    expect(res.body.pods[0].pool).toBeNull();
    expect(res.body.pods[0].teams.every((t) => t.backable === false)).toBe(true);
  });

  it('CLOSES a pool whose clock has passed, and shows it closed', async () => {
    const stakes = {};
    for (const [i, uid] of ['u1', 'u2', 'u3'].entries()) {
      stakes[`${BACKING_STAKES_COLLECTION}/s${i}`] = {
        userId: uid, groupId: 'g1', teamOdUserId: i === 0 ? 'od-b' : 'od-a',
        amount: 100, weekKey: WEEK, status: STAKE_STATUS.LIVE,
      };
      stakes[`backingWallets/${uid}`] = {
        lastAllowanceWeek: WEEK, allowanceRemaining: 900, careerNet: -100,
        seasons: {}, appliedEntries: { [`allowance:${WEEK}`]: 'x', [`stake:s${i}`]: 'x' },
      };
    }
    DB = seed([group('g1')], { [`${BACKING_POOLS_COLLECTION}/g1`]: pool('g1'), ...stakes });
    vi.setSystemTime(new Date('2026-09-28T05:00:00.000Z'));
    const res = await get();
    expect(res.body.pods[0].pool.status).toBe(POOL_STATUS.CLOSED);
    expect(DB.store.get(`${BACKING_POOLS_COLLECTION}/g1`).status).toBe(POOL_STATUS.CLOSED);
  });

  it('one pod\'s pool failure does not take down the list', async () => {
    DB = seed([group('g1'), group('g2')]);
    const realCollection = DB.db.collection;
    DB.db.collection = (name) => {
      if (name === BACKING_POOLS_COLLECTION) {
        return { doc: (id) => (id === 'g1' ? { get: async () => { throw new Error('pool read failed'); }, collection: () => { throw new Error('nope'); } } : realCollection(name).doc(id)) };
      }
      return realCollection(name);
    };
    const res = await get();
    expect(res.statusCode).toBe(200);
    expect(res.body.pods.map((p) => p.groupId).sort()).toEqual(['g1', 'g2']);
    expect(res.body.pods.find((p) => p.groupId === 'g1').pool).toBeNull();
  });
});

// ============================================================================
describe('THE SEAL — an OPEN pool reveals no per-team total and no pays × (§3)', () => {
  it('omits stakeTotal, backerCount and paysX from every open pod, in the whole body', async () => {
    DB = seed([group('g1')], {
      [`${BACKING_POOLS_COLLECTION}/g1`]: pool('g1', { potTotal: 1200, uniqueBackers: 4, teamsBacked: 3 }),
      [`${BACKING_POOLS_COLLECTION}/g1/private/totals`]: {
        backers: { 'someone-else': { total: 600, byTeam: { 'od-a': 600 } } },
        byTeam: { 'od-a': { stakeTotal: 600, backerCount: 1 } },
      },
    });
    const res = await get();
    const body = JSON.stringify(res.body);
    // The assertion that matters: not "the render hides it", but "it is not here".
    expect(body).not.toContain('stakeTotal');
    expect(body).not.toContain('backerCount');
    expect(body).not.toContain('paysX');
    expect(body).not.toContain('someone-else');
    for (const team of res.body.pods[0].teams) {
      expect(Object.keys(team).sort()).toEqual(['backable', 'isCpu', 'isOwnSeat', 'odUserId']);
    }
    // What an open pool MAY show (§3): the pot, the backer count, progress.
    expect(res.body.pods[0].pool).toEqual({
      status: 'open',
      potTotal: 1200,
      uniqueBackers: 4,
      validity: { backers: 4, minBackers: VALIDITY_MIN_BACKERS, teams: 3, minTeams: VALIDITY_MIN_TEAMS },
      closesAt: CLOSE_ISO,
      closeReason: 'clock',
    });
  });

  it('progress toward validity is a COUNT against a floor, never a verdict (§3)', async () => {
    DB = seed([group('g1')], {
      [`${BACKING_POOLS_COLLECTION}/g1`]: pool('g1', { uniqueBackers: 2, teamsBacked: 1 }),
    });
    const { validity } = (await get()).body.pods[0].pool;
    expect(validity).toEqual({ backers: 2, minBackers: 3, teams: 1, minTeams: 2 });
    // No boolean, no word: the client renders "backers 2 of 3 · teams 1 of 2".
    expect(JSON.stringify(validity)).not.toMatch(/valid|insufficient|true|false/);
  });

  it('REVEALS the per-team shares once the pool is closed (§3 — the reveal is at close)', async () => {
    DB = seed([group('g1', { status: 'battle' })], {
      [`${BACKING_POOLS_COLLECTION}/g1`]: pool('g1', {
        status: POOL_STATUS.CLOSED,
        potTotal: 600, uniqueBackers: 3, teamsBacked: 2, humanTeams: 2,
        teams: [
          { odUserId: 'od-a', isCpu: false, stakeTotal: 400, backerCount: 2 },
          { odUserId: 'od-b', isCpu: false, stakeTotal: 200, backerCount: 1 },
        ],
      }),
    });
    const teams = (await get()).body.pods[0].teams;
    expect(teams).toEqual([
      { odUserId: 'od-a', isCpu: false, isOwnSeat: false, backable: false, stakeTotal: 400, backerCount: 2 },
      { odUserId: 'od-b', isCpu: false, isOwnSeat: false, backable: false, stakeTotal: 200, backerCount: 1 },
    ]);
  });

  it('a RESOLVED pool passes PR 3\'s paysX straight through, unrevealed before then', async () => {
    DB = seed([group('g1', { status: 'complete' })], {
      [`${BACKING_POOLS_COLLECTION}/g1`]: pool('g1', {
        status: POOL_STATUS.RESOLVED,
        teams: [{ odUserId: 'od-a', isCpu: false, stakeTotal: 400, backerCount: 2, paysX: 1.5 }],
      }),
    });
    expect((await get()).body.pods[0].teams[0].paysX).toBe(1.5);
    expect([...REVEALED_STATUSES]).toContain(POOL_STATUS.RESOLVED);
    expect([...REVEALED_STATUSES]).not.toContain(POOL_STATUS.OPEN);
  });

  it('a closed pool shows its FROZEN teams — a seat that left is gone from the list', async () => {
    DB = seed([group('g1', { players: [{ odUserId: 'od-a' }] })], {
      [`${BACKING_POOLS_COLLECTION}/g1`]: pool('g1', {
        status: POOL_STATUS.CLOSED,
        teams: [{ odUserId: 'od-a', isCpu: false, stakeTotal: 100, backerCount: 1 }],
      }),
    });
    expect((await get()).body.pods[0].teams.map((t) => t.odUserId)).toEqual(['od-a']);
  });
});

// ============================================================================
describe('the viewer — their own pod, and their own stakes (§5)', () => {
  it('shows the viewer\'s own pod but makes NO seat in it backable (§8 own-pod)', async () => {
    DB = seed([group('g1', { players: [{ odUserId: UID }, { odUserId: 'od-b' }] })], {
      [`${BACKING_POOLS_COLLECTION}/g1`]: pool('g1'),
    });
    const pod = (await get()).body.pods[0];
    expect(pod.teams.find((t) => t.odUserId === UID).isOwnSeat).toBe(true);
    expect(pod.teams.every((t) => t.backable === false)).toBe(true);
  });

  it('marks every seat backable in a pod the viewer is NOT in, while open', async () => {
    DB = seed([group('g1')], { [`${BACKING_POOLS_COLLECTION}/g1`]: pool('g1') });
    const pod = (await get()).body.pods[0];
    expect(pod.teams.every((t) => t.backable === true)).toBe(true);
    expect(pod.teams.every((t) => t.isOwnSeat === false)).toBe(true);
    // CPU seats are backable where they are in the pool (§1).
    expect(pod.teams.find((t) => t.odUserId === 'cpu-1').backable).toBe(true);
  });

  it('nothing is backable once the pool has closed', async () => {
    DB = seed([group('g1')], {
      [`${BACKING_POOLS_COLLECTION}/g1`]: pool('g1', { status: POOL_STATUS.CLOSED, teams: [] }),
    });
    expect((await get()).body.pods[0].teams.every((t) => t.backable === false)).toBe(true);
  });

  it('returns THIS viewer\'s own stakes, and nobody else\'s', async () => {
    DB = seed([group('g1'), group('g2')], {
      [`${BACKING_POOLS_COLLECTION}/g1`]: pool('g1'),
      [`${BACKING_POOLS_COLLECTION}/g2`]: pool('g2'),
      [`${BACKING_STAKES_COLLECTION}/mine1`]: {
        userId: UID, groupId: 'g1', teamOdUserId: 'od-a', amount: 250, weekKey: WEEK, status: STAKE_STATUS.LIVE,
      },
      [`${BACKING_STAKES_COLLECTION}/mine2`]: {
        userId: UID, groupId: 'g2', teamOdUserId: 'od-b', amount: 100, weekKey: WEEK, status: STAKE_STATUS.LIVE,
      },
      [`${BACKING_STAKES_COLLECTION}/theirs`]: {
        userId: 'other', groupId: 'g1', teamOdUserId: 'od-b', amount: 500, weekKey: WEEK, status: STAKE_STATUS.LIVE,
      },
      [`${BACKING_STAKES_COLLECTION}/lastweek`]: {
        userId: UID, groupId: 'g1', teamOdUserId: 'od-a', amount: 400, weekKey: '2026-W39', status: STAKE_STATUS.LIVE,
      },
    });
    const res = await get();
    const g1 = res.body.pods.find((p) => p.groupId === 'g1');
    const g2 = res.body.pods.find((p) => p.groupId === 'g2');
    expect(g1.myStakes).toEqual([{ stakeId: 'mine1', teamOdUserId: 'od-a', amount: 250, status: 'live' }]);
    expect(g2.myStakes).toEqual([{ stakeId: 'mine2', teamOdUserId: 'od-b', amount: 100, status: 'live' }]);
    // Another backer's stake is not in the body at all — sealed (§3).
    expect(JSON.stringify(res.body)).not.toContain('theirs');
    // Nor is last week's.
    expect(JSON.stringify(res.body)).not.toContain('lastweek');
  });

  it('a voided stake carries its reason so the backer can be told why', async () => {
    DB = seed([group('g1')], {
      [`${BACKING_POOLS_COLLECTION}/g1`]: pool('g1', { status: POOL_STATUS.INSUFFICIENT, teams: [] }),
      [`${BACKING_STAKES_COLLECTION}/v1`]: {
        userId: UID, groupId: 'g1', teamOdUserId: 'od-a', amount: 250, weekKey: WEEK,
        status: STAKE_STATUS.VOIDED, voidReason: 'insufficient',
      },
    });
    expect((await get()).body.pods[0].myStakes[0])
      .toEqual({ stakeId: 'v1', teamOdUserId: 'od-a', amount: 250, status: 'voided', voidReason: 'insufficient' });
  });
});

// ============================================================================
describe('projectPod — the seal lives in ONE function (§9)', () => {
  it('an open pool projects no revealed field; a closed one does', () => {
    const g = { id: 'g1', players: [{ odUserId: 'od-a' }] };
    const open = projectPod(g, pool('g1'), { viewerUid: 'v' });
    expect(open.teams[0]).not.toHaveProperty('stakeTotal');
    const closed = projectPod(g, pool('g1', {
      status: POOL_STATUS.CLOSED, teams: [{ odUserId: 'od-a', isCpu: false, stakeTotal: 5, backerCount: 1 }],
    }), { viewerUid: 'v' });
    expect(closed.teams[0].stakeTotal).toBe(5);
  });

  it('a pod with NO pool projects null, and nothing backable', () => {
    const projected = projectPod({ id: 'g1', players: [{ odUserId: 'od-a' }] }, null, { viewerUid: 'v' });
    expect(projected.pool).toBeNull();
    expect(projected.teams[0].backable).toBe(false);
    expect(projected.humanTeams).toBe(1);
  });

  it('counts humanTeams off the seats, CPUs excluded', () => {
    const g = { id: 'g1', players: [{ odUserId: 'od-a' }, { odUserId: 'cpu-1', isCpu: true }, { odUserId: 'cpu-2' }] };
    expect(projectPod(g, null, { viewerUid: 'v' }).humanTeams).toBe(1);
  });
});
