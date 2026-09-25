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

const state = vi.hoisted(() => ({ flag: true, uid: 'viewer-1', frozen: false }));

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
  // PR 3: settle-on-read checks the freeze itself (A-C13); rows flip it.
  get TOURNAMENT_ADVANCEMENT_FROZEN() { return state.frozen; },
}));

let DB = null;
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => DB.db }));

const { makeInMemoryDb } = await import('../_utils/__fixtures__/inMemoryFirestore.js');
const {
  default: handler, POD_LIST_MAX, listablePod, liveStakeContradicts, podListWeek, projectPod, REVEALED_STATUSES,
} = await import('./backing-pools.js');
const {
  BACKING_POOLS_COLLECTION, BACKING_STAKES_COLLECTION, POOL_STATUS, STAKE_STATUS, closePool,
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

/**
 * A pool document, in the shape the WRITERS actually write (Amendment B §B5):
 * an OPEN pool carries the capped `backerProgress` / `teamSpread` pair and no
 * pot or exact count; a terminal pool carries the revealed pot and counts and
 * no capped pair, because `closePool` deletes it at the reveal. The helper
 * mirrors that split rather than handing every fixture both halves — a fixture
 * carrying a shape no writer produces would let the projection's branches pass
 * against documents that cannot exist.
 */
const pool = (groupId, over = {}) => {
  const doc = {
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
    backerProgress: { count: 0, floor: VALIDITY_MIN_BACKERS, met: false },
    teamSpread: { met: false },
    createdAt: '2026-09-22T13:00:00.000Z',
    updatedAt: '2026-09-22T13:00:00.000Z',
    ...over,
  };
  if (doc.status !== POOL_STATUS.OPEN) {
    delete doc.backerProgress;
    delete doc.teamSpread;
  }
  return doc;
};

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
  state.frozen = false;
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
      status: POOL_STATUS.OPEN,
      backerProgress: { count: 0, floor: VALIDITY_MIN_BACKERS, met: false },
      teamSpread: { met: false },
      closesAt: CLOSE_ISO,
      closeReason: 'clock',
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

  it('costs NO transaction once a pool exists — a plain read is the steady state', async () => {
    // `materializePool` must be transactional (two first readers race to create
    // one pool), but the steady state is "the pool already exists", and paying
    // for a transaction to learn that put one transaction per listed pod on
    // EVERY request, for ever. The first GET creates; the rest only read.
    DB = seed([group('g1'), group('g2')]);
    await get();
    const writesAfterFirst = DB.writeLog.length;
    expect(writesAfterFirst).toBe(2);              // one pool per pod, once

    DB.writeLog.length = 0;
    await get();
    await get();
    expect(DB.writeLog).toEqual([]);               // nothing written again
  });

  it('an INELIGIBLE pod costs no write on any request, all week', async () => {
    vi.setSystemTime(new Date('2026-09-27T12:00:00.000Z'));   // under the 24h rule
    DB = seed([group('g1')]);
    await get();
    await get();
    expect(DB.writeLog).toEqual([]);
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
      // Four backers across three teams, and the capped pair the writer would
      // have stamped for them (Amendment B §B2 — 3 of 3, met).
      [`${BACKING_POOLS_COLLECTION}/g1`]: pool('g1', {
        backerProgress: { count: VALIDITY_MIN_BACKERS, floor: VALIDITY_MIN_BACKERS, met: true },
        teamSpread: { met: true },
      }),
      [`${BACKING_POOLS_COLLECTION}/g1/private/totals`]: {
        backers: { 'someone-else': { total: 600, byTeam: { 'od-a': 600 } } },
        byTeam: { 'od-a': { stakeTotal: 600, backerCount: 1 } },
        potTotal: 1200, uniqueBackers: 4, teamsBacked: 3,
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
      // Identity, the server's NAME for the seat (D-af — Amendment C §C1:
      // `label` and `secondary` are names, nothing about the book) and
      // backability. Nothing else.
      expect(Object.keys(team).sort()).toEqual(['backable', 'isCpu', 'isOwnSeat', 'label', 'odUserId', 'secondary']);
    }
    // What an open pool MAY show (§3, Amendment B §B2): the CAPPED validity
    // signals, the close — and nothing about the book. Four backers are on this
    // pool; the count it publishes is 3, because 3 is the floor and there is no
    // fourth value to publish.
    expect(res.body.pods[0].pool).toEqual({
      status: 'open',
      backerProgress: { count: VALIDITY_MIN_BACKERS, floor: VALIDITY_MIN_BACKERS, met: true },
      teamSpread: { met: true },
      closesAt: CLOSE_ISO,
      closeReason: 'clock',
    });
  });

  it('NO POT AND NO EXACT-COUNT KEY anywhere in an open pod, by key name (Amendment B §B2)', async () => {
    // THE SEAL, ASSERTED AS A PROPERTY OF THE WHOLE BODY rather than of one
    // field. A spot check on `pool.potTotal` passes the day the pot reappears
    // one level down — inside `validity`, inside a team, inside a future
    // summary object — so this WALKS the open pod's response and fails on the
    // KEY NAME wherever it sits, at any depth.
    //
    // The pool document is seeded with everything the amendment moved, exactly
    // as a pre-amendment document would still carry it, so the row measures the
    // PROJECTION rather than an empty fixture.
    DB = seed([group('g1')], {
      [`${BACKING_POOLS_COLLECTION}/g1`]: pool('g1', {
        potTotal: 1200,
        uniqueBackers: 4,
        teamsBacked: 3,
        backerProgress: { count: 3, floor: VALIDITY_MIN_BACKERS, met: true },
        teamSpread: { met: true },
      }),
      [`${BACKING_POOLS_COLLECTION}/g1/private/totals`]: {
        backers: { 'someone-else': { total: 1200, byTeam: { 'od-a': 1200 } } },
        byTeam: { 'od-a': { stakeTotal: 1200, backerCount: 1 } },
        potTotal: 1200, uniqueBackers: 4, teamsBacked: 3,
      },
    });
    const openPod = (await get()).body.pods.find((p) => p.groupId === 'g1');
    expect(openPod.pool.status).toBe('open');   // the fixture is actually open

    const keysAtEveryDepth = (node, into = new Set()) => {
      if (Array.isArray(node)) { for (const item of node) keysAtEveryDepth(item, into); return into; }
      if (node === null || typeof node !== 'object') return into;
      for (const [key, value] of Object.entries(node)) {
        into.add(key);
        keysAtEveryDepth(value, into);
      }
      return into;
    };
    const keys = keysAtEveryDepth(openPod);

    // Every key the amendment took off an open pool, plus the sealed cache's
    // own field names — so a projection that ever reached into `private/totals`
    // fails here too.
    for (const sealed of [
      'potTotal', 'uniqueBackers', 'teamsBacked', 'validity',
      'stakeTotal', 'backerCount', 'paysX', 'byTeam', 'backers',
    ]) {
      expect(keys.has(sealed), `an OPEN pod published "${sealed}" (Amendment B §B2)`).toBe(false);
    }
    // And the positive half: what IS there is the capped pair, the close, the
    // live teams and the viewer's own stakes.
    expect(Object.keys(openPod.pool).sort())
      .toEqual(['backerProgress', 'closeReason', 'closesAt', 'status', 'teamSpread']);
    expect(keys.has('myStakes')).toBe(true);
    expect(keys.has('teams')).toBe(true);
  });

  it('the backer count STOPS at the floor — 3 of 3, never 4 of 3 (§B2)', async () => {
    DB = seed([group('g1')], {
      [`${BACKING_POOLS_COLLECTION}/g1`]: pool('g1', {
        backerProgress: { count: VALIDITY_MIN_BACKERS, floor: VALIDITY_MIN_BACKERS, met: true },
        teamSpread: { met: true },
      }),
    });
    const { backerProgress } = (await get()).body.pods[0].pool;
    expect(backerProgress.count).toBeLessThanOrEqual(backerProgress.floor);
    expect(backerProgress).toEqual({ count: 3, floor: 3, met: true });
  });

  it('below the floor it is a COUNT against that floor, never a verdict (§3, §B4)', async () => {
    // §B4: thin-pool risk outranks further sealing BELOW the floor — a
    // spectator is told what the pool needs, because that is the rescue signal
    // the counters exist to carry. At and above the floor, nothing.
    DB = seed([group('g1')], {
      [`${BACKING_POOLS_COLLECTION}/g1`]: pool('g1', {
        backerProgress: { count: 2, floor: VALIDITY_MIN_BACKERS, met: false },
        teamSpread: { met: false },
      }),
    });
    const { backerProgress, teamSpread } = (await get()).body.pods[0].pool;
    expect(backerProgress).toEqual({ count: 2, floor: 3, met: false });
    // The client renders "Backers 2 of 3 · Team spread: needs another team"
    // (§B6) — a count and a need, never an outcome word.
    expect(JSON.stringify(backerProgress)).not.toMatch(/valid|insufficient/);
    expect(teamSpread).toEqual({ met: false });
    // AND NO TEAM COUNT COMES WITH IT. `teamsBacked` in a 2-human-team pod
    // names WHICH team took a stake by arithmetic (§B1), so the spread is a
    // boolean and has no count to leak.
    expect(teamSpread).not.toHaveProperty('count');
    expect(teamSpread).not.toHaveProperty('teams');
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
      { odUserId: 'od-a', isCpu: false, label: 'Ada', secondary: null, isOwnSeat: false, backable: false, stakeTotal: 400, backerCount: 2 },
      { odUserId: 'od-b', isCpu: false, label: 'Bo', secondary: null, isOwnSeat: false, backable: false, stakeTotal: 200, backerCount: 1 },
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
    expect(g1.myStakes).toEqual([{ stakeId: 'mine1', teamOdUserId: 'od-a', teamLabel: 'Ada', amount: 250, status: 'live' }]);
    expect(g2.myStakes).toEqual([{ stakeId: 'mine2', teamOdUserId: 'od-b', teamLabel: 'Bo', amount: 100, status: 'live' }]);
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
      .toEqual({ stakeId: 'v1', teamOdUserId: 'od-a', teamLabel: 'Ada', amount: 250, status: 'voided', voidReason: 'insufficient' });
  });
});

// ============================================================================
describe('WIRE-R-1 — a lazy close THIS request ran re-reads the viewer\'s stakes before the reply (the PR 5 review record)', () => {
  const liveStake = (over = {}) => ({ userId: UID, groupId: 'g1', teamOdUserId: 'od-a', amount: 250, weekKey: WEEK, status: STAKE_STATUS.LIVE, ...over });
  const walletFor = (...stakeIds) => ({
    lastAllowanceWeek: WEEK, allowanceRemaining: 750, careerNet: -250, seasons: {},
    appliedEntries: { [`allowance:${WEEK}`]: 'x', ...Object.fromEntries(stakeIds.map((id) => [`stake:${id}`, 'x'])) },
  });
  const PAST_THE_CLOCK = new Date('2026-09-28T05:00:00.000Z');
  const stakeReads = () => DB.readLog.filter(([channel, path]) => channel === 'get' && path.startsWith(`${BACKING_STAKES_COLLECTION}/`));

  it('a close that VOIDS the viewer\'s stake (below the floor → insufficient) answers it voided, with its reason — never the `live` copy read before the close', async () => {
    DB = seed([group('g1')], {
      [`${BACKING_POOLS_COLLECTION}/g1`]: pool('g1'),
      [`${BACKING_STAKES_COLLECTION}/mine1`]: liveStake(),
      [`backingWallets/${UID}`]: walletFor('mine1'),
    });
    vi.setSystemTime(PAST_THE_CLOCK);
    const pod = (await get()).body.pods[0];
    expect(pod.pool.status).toBe(POOL_STATUS.INSUFFICIENT);                                  // this request closed it
    expect(DB.store.get(`${BACKING_STAKES_COLLECTION}/mine1`).status).toBe(STAKE_STATUS.VOIDED); // and the close voided the stake
    expect(pod.myStakes).toEqual([{ stakeId: 'mine1', teamOdUserId: 'od-a', teamLabel: 'Ada', amount: 250, status: 'voided', voidReason: 'insufficient' }]);
    expect(stakeReads()).toEqual([['get', `${BACKING_STAKES_COLLECTION}/mine1`]]);             // re-read by id, once
  });

  it('a seat that LEFT before the close: the viewer\'s stake on it answers voided `seat_left`', async () => {
    DB = seed([group('g1')], {
      [`${BACKING_POOLS_COLLECTION}/g1`]: pool('g1'),
      [`${BACKING_STAKES_COLLECTION}/mine1`]: liveStake({ teamOdUserId: 'od-gone' }),
      [`backingWallets/${UID}`]: walletFor('mine1'),
    });
    vi.setSystemTime(PAST_THE_CLOCK);
    const pod = (await get()).body.pods[0];
    expect(pod.myStakes).toEqual([{ stakeId: 'mine1', teamOdUserId: 'od-gone', teamLabel: 'Unnamed team', amount: 250, status: 'voided', voidReason: 'seat_left' }]);
  });

  it('the steady state costs NO read: a pool this request did not move re-reads no stake — open and not due, or closed before the request', async () => {
    DB = seed([group('g1'), group('g2')], {
      [`${BACKING_POOLS_COLLECTION}/g1`]: pool('g1'),
      [`${BACKING_POOLS_COLLECTION}/g2`]: pool('g2', { status: POOL_STATUS.INSUFFICIENT, teams: [] }),
      [`${BACKING_STAKES_COLLECTION}/mine1`]: liveStake(),
      [`${BACKING_STAKES_COLLECTION}/mine2`]: liveStake({ groupId: 'g2', status: STAKE_STATUS.VOIDED, voidReason: 'insufficient' }),
    });
    const res = await get();
    expect(res.body.pods.find((p) => p.groupId === 'g1').myStakes[0].status).toBe('live');
    expect(res.body.pods.find((p) => p.groupId === 'g2').myStakes[0].status).toBe('voided');
    expect(stakeReads()).toEqual([]);
  });

  /**
   * ANOTHER request's close, landing at the Nth read of the pool document —
   * the real `closePool` against the same store, as a racing viewer's list,
   * the stake route or the results reader would run it.
   */
  function closeOnPoolRead(n) {
    const realCollection = DB.db.collection;
    let reads = 0;
    DB.db.collection = (name) => {
      const col = realCollection(name);
      if (name !== BACKING_POOLS_COLLECTION) return col;
      return {
        ...col,
        doc: (id) => {
          const ref = col.doc(id);
          return {
            ...ref,
            get: async () => {
              if (id === 'g1' && (reads += 1) === n) {
                await closePool({ ...DB.db, collection: realCollection }, { id: 'g1', ...DB.store.get('tournamentGroups/g1') }, PAST_THE_CLOCK);
              }
              return ref.get();
            },
          };
        },
      };
    };
  }
  const dueWorld = () => seed([group('g1')], {
    [`${BACKING_POOLS_COLLECTION}/g1`]: pool('g1'),
    [`${BACKING_STAKES_COLLECTION}/mine1`]: liveStake(),
    [`backingWallets/${UID}`]: walletFor('mine1'),
  });

  it('WIRING-1: a close ANOTHER request commits between the stakes query and the pool read — the answered pool contradicts the live copy, so it is re-read: voided, with its reason', async () => {
    DB = dueWorld();
    vi.setSystemTime(PAST_THE_CLOCK);
    closeOnPoolRead(1);                                   // before this request's plain read: `before` already says insufficient
    const pod = (await get()).body.pods[0];
    expect(pod.pool.status).toBe(POOL_STATUS.INSUFFICIENT);
    expect(pod.myStakes).toEqual([{ stakeId: 'mine1', teamOdUserId: 'od-a', teamLabel: 'Ada', amount: 250, status: 'voided', voidReason: 'insufficient' }]);
  });

  it('WIRING-2: a close the list FINDS already committed (a racing request, or its own retried transaction) is adopted — the closed pool answered, nothing backable, the stake re-read', async () => {
    DB = dueWorld();
    vi.setSystemTime(PAST_THE_CLOCK);
    closeOnPoolRead(2);                                   // between the plain read (open) and ensureClosed's own read
    const pod = (await get()).body.pods[0];
    expect(DB.store.get(`${BACKING_POOLS_COLLECTION}/g1`).status).toBe(POOL_STATUS.INSUFFICIENT);
    expect(pod.pool.status).toBe(POOL_STATUS.INSUFFICIENT);
    expect(pod.teams.every((t) => t.backable === false)).toBe(true);
    expect(pod.myStakes).toEqual([{ stakeId: 'mine1', teamOdUserId: 'od-a', teamLabel: 'Ada', amount: 250, status: 'voided', voidReason: 'insufficient' }]);
  });

  it('a CLOSED pool\'s live stakes on its frozen teams contradict nothing — every list load until settlement costs NO stake read', async () => {
    DB = seed([group('g1')], {
      [`${BACKING_POOLS_COLLECTION}/g1`]: pool('g1', {
        status: POOL_STATUS.CLOSED, teams: [{ odUserId: 'od-a', isCpu: false, stakeTotal: 250, backerCount: 1 }], potTotal: 250,
      }),
      [`${BACKING_STAKES_COLLECTION}/mine1`]: liveStake(),
    });
    const pod = (await get()).body.pods[0];
    expect(pod.myStakes[0].status).toBe('live');
    expect(stakeReads()).toEqual([]);
  });

  it('liveStakeContradicts — the one predicate, every pool status', () => {
    const live = { status: STAKE_STATUS.LIVE, teamOdUserId: 'od-a' };
    const frozen = (status, teams = [{ odUserId: 'od-a' }]) => ({ status, teams });
    expect(liveStakeContradicts(pool('g1'), live)).toBe(false);                                    // open
    expect(liveStakeContradicts(frozen(POOL_STATUS.CLOSED), live)).toBe(false);                    // closed, its seat frozen
    expect(liveStakeContradicts(frozen(POOL_STATUS.RESOLVING), live)).toBe(false);                 // a hold keeps stakes live
    expect(liveStakeContradicts(frozen(POOL_STATUS.CLOSED, [{ odUserId: 'od-b' }]), live)).toBe(true);   // its seat left at the close
    for (const status of [POOL_STATUS.INSUFFICIENT, POOL_STATUS.REFUNDED, POOL_STATUS.RESOLVED]) {
      expect(liveStakeContradicts(frozen(status), live), status).toBe(true);
    }
    expect(liveStakeContradicts(frozen(POOL_STATUS.INSUFFICIENT), { ...live, status: STAKE_STATUS.VOIDED })).toBe(false);
    expect(liveStakeContradicts(null, live)).toBe(false);
  });

  it('a failed re-read keeps the copies read before and never takes down the list', async () => {
    DB = seed([group('g1')], {
      [`${BACKING_POOLS_COLLECTION}/g1`]: pool('g1'),
      [`${BACKING_STAKES_COLLECTION}/mine1`]: liveStake(),
      [`backingWallets/${UID}`]: walletFor('mine1'),
    });
    const realCollection = DB.db.collection;
    DB.db.collection = (name) => {
      const col = realCollection(name);
      if (name !== BACKING_STAKES_COLLECTION) return col;
      return { ...col, doc: (id) => ({ ...col.doc(id), get: async () => { throw new Error('stake read failed'); } }) };
    };
    vi.setSystemTime(PAST_THE_CLOCK);
    const res = await get();
    expect(res.statusCode).toBe(200);
    expect(res.body.pods[0].pool.status).toBe(POOL_STATUS.INSUFFICIENT);
    expect(res.body.pods[0].myStakes).toEqual([{ stakeId: 'mine1', teamOdUserId: 'od-a', teamLabel: 'Ada', amount: 250, status: 'live' }]);
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

// ============================================================================
// Backing Beta PR 3 — SETTLE-ON-READ (spec V1.3 §7 "Retries", D-o; A-C13).
// A CLOSED pool whose pod now satisfies the settlement predicate is settled by
// the list read, through the same primitive the Friday duty calls. The rows:
// it settles; it checks the freeze ITSELF; and it never touches a `resolving`
// hold. The pod must sit in the list's week, so these seed a COMPLETE group
// under the list's own baseLayerWeek with five banked days.
describe('settle-on-read (§7) — PR 3', () => {
  const DAYS = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02'];
  function bankedWeek() {
    const final = { 'od-a': [60, 30], 'od-b': [40, 20], 'cpu-1': [20, 10] };
    const dailyScores = {};
    for (let i = 0; i < 5; i += 1) {
      const closeScores = {};
      for (const [id, [user, agent]] of Object.entries(final)) {
        closeScores[id] = { totalPoints: user, agentPoints: agent, compositePoints: agent + 1.5 * user, picks: [] };
      }
      dailyScores[`day${i + 1}`] = { recordedDate: DAYS[i], closeScores };
    }
    return dailyScores;
  }
  const completeGroup = (over = {}) => group('g1', {
    status: 'complete',
    groupMembers: ['od-a', 'od-b', 'cpu-1'],
    players: [{ odUserId: 'od-a' }, { odUserId: 'od-b' }, { odUserId: 'cpu-1', isCpu: true }],
    dailyScores: bankedWeek(),
    ...over,
  });
  /** A closed pool over three live stakes (u1 → od-a 300; u2, u3 → od-b), with totals and wallets; `s1Backer` renames u1. */
  function closedWorld(poolOver = {}, { s1Backer = 'u1' } = {}) {
    const stakes = [
      ['s1', s1Backer, 'od-a', 300], ['s2', 'u2', 'od-b', 200], ['s3', 'u3', 'od-b', 100],
    ];
    const extra = {
      [`${BACKING_POOLS_COLLECTION}/g1`]: pool('g1', {
        status: POOL_STATUS.CLOSED,
        teams: [
          { odUserId: 'od-a', isCpu: false, stakeTotal: 300, backerCount: 1 },
          { odUserId: 'od-b', isCpu: false, stakeTotal: 300, backerCount: 2 },
          { odUserId: 'cpu-1', isCpu: true, stakeTotal: 0, backerCount: 0 },
        ],
        humanTeams: 2, potTotal: 600, uniqueBackers: 3, teamsBacked: 2, closedAt: '2026-09-28T04:00:00.000Z',
        ...poolOver,
      }),
      [`${BACKING_POOLS_COLLECTION}/g1/private/totals`]: {
        backers: { [s1Backer]: { total: 300, byTeam: { 'od-a': 300 } }, u2: { total: 200, byTeam: { 'od-b': 200 } }, u3: { total: 100, byTeam: { 'od-b': 100 } } },
        byTeam: { 'od-a': { stakeTotal: 300, backerCount: 1 }, 'od-b': { stakeTotal: 300, backerCount: 2 } },
        potTotal: 600, uniqueBackers: 3, teamsBacked: 2, updatedAt: '2026-09-28T04:00:00.000Z',
      },
    };
    for (const [id, uid, team, amount] of stakes) {
      extra[`${BACKING_STAKES_COLLECTION}/${id}`] = { userId: uid, groupId: 'g1', teamOdUserId: team, amount, weekKey: WEEK, requestId: `r-${id}`, status: STAKE_STATUS.LIVE };
      extra[`backingWallets/${uid}`] = {
        lastAllowanceWeek: WEEK, allowanceRemaining: 1000 - amount, careerNet: -amount, seasons: {},
        appliedEntries: { [`allowance:${WEEK}`]: 'x', [`stake:${id}`]: 'x' },
      };
    }
    return extra;
  }
  const poolDoc = () => DB.store.get(`${BACKING_POOLS_COLLECTION}/g1`);

  it('a CLOSED pool whose pod is COMPLETE is settled on read — the list shows it resolved, by the one primitive', async () => {
    DB = seed([completeGroup()], closedWorld());
    const res = await get();
    expect(res.statusCode).toBe(200);
    expect(res.body.pods[0].pool.status).toBe(POOL_STATUS.RESOLVED);
    expect(res.body.pods[0].teams.find((t) => t.odUserId === 'od-a')).toMatchObject({ stakeTotal: 300, paysX: 2 });
    expect(poolDoc()).toMatchObject({ status: POOL_STATUS.RESOLVED, settlementRef: 'settle_on_read', winnerOdUserIds: ['od-a'], paysX: 2 });
    expect(DB.store.get(`${BACKING_STAKES_COLLECTION}/s1`)).toMatchObject({ status: STAKE_STATUS.WON, payout: 600 });
    // Only backing paths were written — the pod list still writes nothing to a tournament* store.
    expect(DB.writeLog.every(([, p]) => p.startsWith('backing'))).toBe(true);
  });

  // THE ROUTE'S OWN GATE IS WHAT THESE THREE ROWS PROVE (review lens D, #6):
  // the primitive carries its own freeze / predicate / hold belts, so "nothing
  // was written" would stay true with the route's gate deleted. The gate's
  // observable effect is that the primitive is never CALLED — no direct group
  // doc read, no telemetry read, no transaction — and that is what is pinned.
  const primitiveNeverCalled = () => {
    expect(DB.readLog.filter(([ch, p]) => ch === 'get' && p === 'tournamentGroups/g1')).toEqual([]);
    expect(DB.readLog.filter(([, p]) => p.startsWith('agentBattles'))).toEqual([]);
    expect(DB.readLog.filter(([ch]) => ch === 'tx.get')).toEqual([]);
  };

  it('WIRING-3 (this build\'s review record): a settlement THIS read ran re-reads the VIEWER\'s stake — answered won, with its payout, never the live copy', async () => {
    DB = seed([completeGroup()], closedWorld({}, { s1Backer: UID }));
    const pod = (await get()).body.pods[0];
    expect(pod.pool.status).toBe(POOL_STATUS.RESOLVED);
    expect(pod.myStakes).toEqual([expect.objectContaining({ stakeId: 's1', teamOdUserId: 'od-a', amount: 300, status: 'won', payout: 600 })]);
  });

  it('checks the FREEZE itself (A-C13): frozen → the list answers, the primitive is never called', async () => {
    state.frozen = true;
    DB = seed([completeGroup()], closedWorld());
    const res = await get();
    expect(res.statusCode).toBe(200);
    expect(res.body.pods[0].pool.status).toBe(POOL_STATUS.CLOSED);
    expect(poolDoc().status).toBe(POOL_STATUS.CLOSED);
    expect(DB.writeLog).toEqual([]);
    primitiveNeverCalled();
  });

  it('a pod still in BATTLE does not trigger settlement — the predicate gates the read, the primitive is never called', async () => {
    DB = seed([completeGroup({ status: 'battle' })], closedWorld());
    const res = await get();
    expect(res.body.pods[0].pool.status).toBe(POOL_STATUS.CLOSED);
    expect(DB.writeLog).toEqual([]);
    primitiveNeverCalled();
  });

  it('a `resolving` HOLD is never touched by a read — admin-only release, the primitive is never called', async () => {
    DB = seed([completeGroup()], closedWorld({ status: POOL_STATUS.RESOLVING, holdReason: 'agent_layer_absent' }));
    const res = await get();
    expect(res.statusCode).toBe(200);
    expect(res.body.pods[0].pool.status).toBe(POOL_STATUS.RESOLVING);
    expect(poolDoc()).toMatchObject({ status: POOL_STATUS.RESOLVING, holdReason: 'agent_layer_absent' });
    expect(DB.writeLog).toEqual([]);
    primitiveNeverCalled();
  });

  it('a settlement failure never takes down the list — the pod lists with the pool as it stands', async () => {
    DB = seed([completeGroup()], closedWorld());
    DB.store.delete(`${BACKING_POOLS_COLLECTION}/g1/private/totals`);   // a corrupt book: the primitive aborts loudly
    const res = await get();
    expect(res.statusCode).toBe(200);
    expect(res.body.pods).toHaveLength(1);
    expect(res.body.pods[0].pool.status).toBe(POOL_STATUS.CLOSED);
  });
});

// ============================================================================
// THE DOCUMENTED LIMIT (PR 3 review — lenses A, B and C independently): this
// list is keyed to the NEXT battle Monday's week, which rolls forward at
// Monday 09:30 ET, while a pod satisfies the settlement predicate no earlier
// than the Tuesday evening of its own week. So a completed pod is NEVER in this
// list in production, and the settle-on-read block above cannot reach it: the
// rows above pin the block's CONTRACT on a fixture the list can see; this row
// pins the LIMIT, so the two cannot be mistaken for a live retry path. The
// results reader (PR 5) is settle-on-read's live host; the admin re-run is the
// practical whole-pool retry until then.
describe('settle-on-read (§7) — the documented limit on THIS route', () => {
  it('once a pod\'s week has banked, the list has moved to the next Monday and no longer lists it — nothing settles here', async () => {
    const DAYS = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02'];
    const dailyScores = {};
    for (let i = 0; i < 5; i += 1) {
      dailyScores[`day${i + 1}`] = { recordedDate: DAYS[i], closeScores: {
        'od-a': { totalPoints: 60, agentPoints: 30, compositePoints: 120, picks: [] },
        'od-b': { totalPoints: 40, agentPoints: 20, compositePoints: 80, picks: [] },
      } };
    }
    const complete = group('g1', { status: 'complete', groupMembers: ['od-a', 'od-b', 'cpu-1'], dailyScores });
    DB = seed([complete], {
      [`${BACKING_POOLS_COLLECTION}/g1`]: pool('g1', { status: POOL_STATUS.CLOSED, teams: [], potTotal: 600, uniqueBackers: 3, teamsBacked: 2 }),
    });
    // Every instant from the pod's own Tuesday onward, including the Friday
    // evening the duty runs, the following weekend, and the next Monday.
    for (const instant of ['2026-09-29T22:30:00.000Z', '2026-10-02T22:30:00.000Z', '2026-10-03T12:00:00.000Z', '2026-10-05T12:00:00.000Z', '2026-10-05T14:00:00.000Z']) {
      vi.setSystemTime(new Date(instant));
      const res = await get();
      expect(res.statusCode).toBe(200);
      expect(res.body.baseLayerWeek, instant).not.toBe(WEEK);
      expect(res.body.pods, instant).toEqual([]);
    }
    expect(DB.store.get(`${BACKING_POOLS_COLLECTION}/g1`).status).toBe(POOL_STATUS.CLOSED);
    expect(DB.writeLog).toEqual([]);
  });
});

// ============================================================================
describe('D-af — every seat is named by the SERVER, by its primary agent (Amendment C §C1)', () => {
  // Firebase-uid-shaped seats — the production id shape the pre-flip list
  // printed on a lobby pod, which carries no `seatNames` (HON-17).
  const ADA = 'AdaLovelace0000000000000001a';
  const CY = 'CyHarrison000000000000003ccc';
  const lobby = (id, over = {}) => group(id, {
    seatNames: undefined,
    players: [{ odUserId: ADA }, { odUserId: CY }, { odUserId: 'cpu-1', isCpu: true }],
    ...over,
  });
  const names = () => ({
    'agents/agt-ada': { ownerId: ADA, name: 'Shadow' },
    'agents/agt-ada-clone': { ownerId: ADA, name: 'Clone', isTrainingClone: true },
    // The production shape — names NESTED under `profile` (RAWID-1).
    [`users/${ADA}`]: { _v: 1, auth: { uid: ADA, email: 'ada@example.com' }, profile: { username: 'ada', displayName: 'ada', avatarUrl: null, bio: null } },
  });

  it('a lobby pod with NO seatNames names every seat — agent, then player, then "Unnamed team"; never the id', async () => {
    DB = seed([lobby('g1')], names());
    const res = await get();
    const teams = res.body.pods[0].teams;
    expect(teams.map((t) => [t.odUserId, t.label, t.secondary])).toEqual([
      [ADA, 'Shadow', 'ada'],
      [CY, 'Unnamed team', null],
      ['cpu-1', expect.stringMatching(/^CPU — /), null],
    ]);
    // The client is handed names, not the map it used to compose them from.
    expect(res.body.pods[0]).not.toHaveProperty('seatNames');
    for (const t of teams) {
      expect(t.label).not.toBe(t.odUserId);
      expect(t.secondary ?? '').not.toContain(t.odUserId);
    }
  });

  it('the viewer\'s stakes carry their team\'s label — including a seat that has since LEFT the pod', async () => {
    DB = seed([lobby('g1', { players: [{ odUserId: CY }, { odUserId: 'cpu-1', isCpu: true }] })], {
      ...names(),
      [`${BACKING_STAKES_COLLECTION}/mine`]: { userId: UID, groupId: 'g1', teamOdUserId: ADA, amount: 250, weekKey: WEEK, status: STAKE_STATUS.LIVE },
    });
    const pod = (await get()).body.pods[0];
    expect(pod.teams.map((t) => t.odUserId)).not.toContain(ADA);     // ADA has left
    expect(pod.myStakes).toEqual([expect.objectContaining({ teamOdUserId: ADA, teamLabel: 'Shadow' })]);
  });

  it('a SETTLED pool names each team by the agent settlement RECORDED, not the owner\'s current one', async () => {
    DB = seed([lobby('g1', { status: 'battle' })], {
      ...names(),
      'agents/agt-ada-old': { ownerId: 'someone-else', name: 'Played The Week' },
      [`${BACKING_POOLS_COLLECTION}/g1`]: pool('g1', {
        status: POOL_STATUS.RESOLVED, potTotal: 300, uniqueBackers: 3, teamsBacked: 2, humanTeams: 2,
        teams: [
          { odUserId: ADA, isCpu: false, stakeTotal: 200, backerCount: 2, agentId: 'agt-ada-old' },
          { odUserId: CY, isCpu: false, stakeTotal: 100, backerCount: 1, agentId: 'agt-gone' },
        ],
      }),
    });
    const teams = (await get()).body.pods[0].teams;
    expect(teams.map((t) => [t.odUserId, t.label, t.secondary])).toEqual([
      [ADA, 'Played The Week', 'ada'],
      // A recorded agent that is gone falls to the player — and CY has none either.
      [CY, 'Unnamed team', null],
    ]);
  });

  it('BATCHED PER RESPONSE — one owner lookup for every pod on the list, each profile read once', async () => {
    DB = seed([lobby('g1'), lobby('g2', { players: [{ odUserId: CY }, { odUserId: ADA }] })], names());
    const res = await get();
    expect(res.body.pods).toHaveLength(2);
    const agentQueries = DB.readLog.filter(([ch, p]) => ch === 'get' && p === 'agents');
    expect(agentQueries).toHaveLength(1);
    const profileReads = DB.readLog.filter(([, p]) => p.startsWith('users/')).map(([, p]) => p);
    expect(new Set(profileReads).size).toBe(profileReads.length);
  });
});

// ============================================================================
// THE ACTIVATION PR — a SMOKE session's list is the DEV NAMESPACE ONLY.
describe('the founder smoke override (the activation PR): a smoke session is listed dev pods and nothing else', () => {
  // The marker scripts/backing-smoke.js stamps on every pod it seeds: a smoke
  // session is listed THOSE dev pods and no other (SCRIPT-08).
  const SMOKE_MARK = { tool: 'scripts/backing-smoke.js', stamp: '20260922_abc123' };
  const lit = () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('BACKING_SMOKE_ENABLED', 'true');
    vi.stubEnv('BACKING_SMOKE_UIDS', `other-1, ${UID}`);
  };
  afterEach(() => { vi.unstubAllEnvs(); });

  it('dark flag, lit preview, allowlisted uid: ONLY the isDev pod is listed — the production pod is dropped (mutation check: the dev-only row)', async () => {
    state.flag = false;
    lit();
    DB = seed([group('prod-1'), group('smoke-1', { isDev: true, smoke: SMOKE_MARK }), group('train-1', { isDev: true, isTraining: true })]);
    const res = await get();
    expect(res.statusCode).toBe(200);
    expect(res.body.pods.map((p) => p.groupId)).toEqual(['smoke-1']);
  });

  it('…and the dev pod\'s pool is MATERIALIZED at `dev-{groupId}` (allowDev), never at the production id', async () => {
    state.flag = false;
    lit();
    DB = seed([group('smoke-1', { isDev: true, smoke: SMOKE_MARK })]);
    const res = await get();
    expect(res.body.pods[0].pool?.status).toBe('open');
    expect(DB.store.has(`${BACKING_POOLS_COLLECTION}/dev-smoke-1`)).toBe(true);
    expect(DB.store.has(`${BACKING_POOLS_COLLECTION}/smoke-1`)).toBe(false);
    expect(DB.store.get(`${BACKING_POOLS_COLLECTION}/dev-smoke-1`).isDev).toBe(true);
  });

  it('the SAME uid and env in PRODUCTION reads dark: 404, no read', async () => {
    state.flag = false;
    lit();
    vi.stubEnv('VERCEL_ENV', 'production');
    DB = seed([group('smoke-1', { isDev: true, smoke: SMOKE_MARK })]);
    const res = await get();
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });

  it('a NON-allowlisted uid on the lit preview reads dark', async () => {
    state.flag = false;
    lit();
    state.uid = 'someone-else';
    expect((await get()).statusCode).toBe(404);
  });

  it('a LIT viewer who is not a smoke user (the flag on) is unchanged: production pods only, never a dev pod, no dev pool opened', async () => {
    state.flag = true;
    lit(); // the env is irrelevant to a non-smoke caller
    state.uid = 'someone-else';
    DB = seed([group('prod-1'), group('smoke-1', { isDev: true, smoke: SMOKE_MARK })]);
    const res = await get();
    expect(res.body.pods.map((p) => p.groupId)).toEqual(['prod-1']);
    expect(DB.store.has(`${BACKING_POOLS_COLLECTION}/dev-smoke-1`)).toBe(false);
  });

  it('an isDev pod WITHOUT the smoke marker — a teammate\'s dev pod, a seed-tournament-group pod — is NOT listed for a smoke session, and its pool is never opened (SCRIPT-08)', async () => {
    state.flag = false;
    lit();
    DB = seed([group('smoke-1', { isDev: true, smoke: SMOKE_MARK }), group('other-dev', { isDev: true }), group('mis-marked', { isDev: true, smoke: { tool: 'scripts/seed-tournament-group.js' } })]);
    const res = await get();
    expect(res.statusCode).toBe(200);
    expect(res.body.pods.map((p) => p.groupId)).toEqual(['smoke-1']);
    expect(DB.store.has(`${BACKING_POOLS_COLLECTION}/dev-smoke-1`)).toBe(true);
    expect(DB.store.has(`${BACKING_POOLS_COLLECTION}/dev-other-dev`)).toBe(false);
    expect(DB.store.has(`${BACKING_POOLS_COLLECTION}/dev-mis-marked`)).toBe(false);
  });

  it('a smoke session\'s answer names its DEV wallet (`walletId: dev-{uid}`) — where its stakes debit; a lit non-smoke caller\'s answer carries no such key (DEV-5)', async () => {
    state.flag = false;
    lit();
    DB = seed([group('smoke-1', { isDev: true, smoke: SMOKE_MARK })]);
    const res = await get();
    expect(res.statusCode).toBe(200);
    expect(res.body.walletId).toBe(`dev-${UID}`);
    state.flag = true;
    state.uid = 'someone-else';
    DB = seed([group('prod-1')]);
    const res2 = await get();
    expect(res2.statusCode).toBe(200);
    expect(Object.keys(res2.body)).not.toContain('walletId');
  });

  it('smokeListablePod is the mirror predicate — only an isDev pod CARRYING THE SMOKE MARKER, still never training, terminal or the excluded slot', async () => {
    const { smokeListablePod } = await import('./backing-pools.js');
    expect(smokeListablePod(group('g', { isDev: true, smoke: SMOKE_MARK }))).toBe(true);
    expect(smokeListablePod(group('g', { isDev: true }))).toBe(false);
    expect(smokeListablePod(group('g', { isDev: true, smoke: { tool: 'something-else' } }))).toBe(false);
    expect(smokeListablePod(group('g', { smoke: SMOKE_MARK }))).toBe(false);
    expect(smokeListablePod(group('g'))).toBe(false);
    expect(smokeListablePod(group('g', { isDev: true, smoke: SMOKE_MARK, isTraining: true }))).toBe(false);
    expect(smokeListablePod(group('g', { isDev: true, smoke: SMOKE_MARK, status: 'voided' }))).toBe(false);
    expect(smokeListablePod(group('g', { isDev: true, smoke: SMOKE_MARK, status: 'expired' }))).toBe(false);
    expect(smokeListablePod(group('g', { isDev: true, smoke: SMOKE_MARK, slotId: 'mon-0845' }))).toBe(false);
    expect(smokeListablePod(group('g', { isDev: true, smoke: SMOKE_MARK, status: 'battle' }))).toBe(true);
  });
});
