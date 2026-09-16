// api/_utils/backingPools.test.js
//
// Backing Beta PR 2 — the pool: lazy open, the live team derivation and the §3
// close transaction (spec V1.3 §1, §3, §4, §6, §7).
//
// THE ROW THIS FILE EXISTS FOR is "the close runs in §3's ORDER". Asserting the
// OUTCOME of a close would pass under a reordered implementation in most
// fixtures, so the order is proved two ways that a reorder cannot both survive:
//   · a pool that is valid ONLY if the departed seat's stakes are counted must
//     come out `insufficient` — which is true iff step 2 (void) precedes step 3
//     (validity);
//   · an `insufficient` pool's revealed totals must be ZERO — which is true iff
//     step 4 (reveal) follows step 3's voids;
//   · and the WRITE LOG must show every stake void and wallet credit landing
//     before the pool document, so a reader of the committed transaction sees
//     the steps in the spec's sequence.
//
// Runs against the shared in-memory Firestore stand-in, so the transaction
// boundary, the subcollection and the write log are real enough to assert
// against. Nothing about the module is mocked.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): this file's real import of
// api/_utils/backingPools.js is the runtime guard for that module's api/ -> src/
// imports (src/constants/backing.js, src/constants/leagueTournament.js) — it
// explodes in this Node test env if a browser-only dep ever enters the graph.
// Never mock it.

import { describe, it, expect } from 'vitest';
import { makeInMemoryDb } from './__fixtures__/inMemoryFirestore.js';
import {
  BACKING_POOLS_COLLECTION,
  BACKING_STAKES_COLLECTION,
  BackingPoolError,
  FORMATION_PATH,
  POOL_STATUS,
  STAKE_STATUS,
  VOID_REASONS,
  buildOpenPool,
  closePool,
  ensureClosed,
  liveTeamsFor,
  materializePool,
  monthKeyForPool,
  poolIdFor,
  poolRefFor,
  poolTotalsRefFor,
  seatedIdsFor,
  totalsFromBackers,
  totalsFromStakes,
} from './backingPools.js';
import { BACKING_WALLETS_COLLECTION, ENTRY_TYPES } from './backingWallet.js';
import { POOL_INELIGIBLE } from './backingWeek.js';
import {
  ALLOWANCE_BP,
  VALIDITY_MIN_BACKERS,
  VALIDITY_MIN_TEAMS,
} from '../../src/constants/backing.js';

// ============================ FIXTURES ============================
// The battle Monday is 2026-09-28, so the backing week is 2026-W40 and the
// clock close is Sunday 2026-09-27 23:59:59 ET = 2026-09-28T03:59:59Z.
const MONDAY = '2026-09-28';
const WEEK = '2026-W40';
const CLOSE_ISO = '2026-09-28T03:59:59.000Z';
const NOW = new Date('2026-09-22T14:00:00.000Z');   // Tue of the backing week
const AFTER_CLOSE = new Date('2026-09-28T04:30:00.000Z');
const GROUP_ID = 'grp-pool-1';

const lobbyGroup = (over = {}) => ({
  id: GROUP_ID,
  status: 'forming',
  isLiveDraft: false,
  baseLayerWeek: WEEK,
  createdAt: '2026-09-22T14:00:00.000Z',
  players: [
    { odUserId: 'od-a', picks: [] },
    { odUserId: 'od-b', picks: [] },
    { odUserId: 'cpu-1', isCpu: true, picks: [] },
    { odUserId: 'cpu-2', isCpu: true, picks: [] },
  ],
  ...over,
});

const openPool = (over = {}) => ({
  groupId: GROUP_ID,
  status: POOL_STATUS.OPEN,
  formationPath: FORMATION_PATH.LOBBY,
  slotId: null,
  battleMondayEtDate: MONDAY,
  backingWeekStart: '2026-09-21T04:00:00.000Z',
  opensAt: '2026-09-22T14:00:00.000Z',
  closesAt: CLOSE_ISO,
  closeReason: 'clock',
  baseLayerWeek: WEEK,
  isDev: false,
  potTotal: 0,
  uniqueBackers: 0,
  teamsBacked: 0,
  createdAt: '2026-09-22T14:00:00.000Z',
  updatedAt: '2026-09-22T14:00:00.000Z',
  ...over,
});

const stake = (id, userId, teamOdUserId, amount = 100, over = {}) => ([
  `${BACKING_STAKES_COLLECTION}/${id}`,
  {
    userId, groupId: GROUP_ID, teamOdUserId, amount,
    hashAtStake: null, placedAt: '2026-09-23T14:00:00.000Z',
    weekKey: WEEK, requestId: `req-${id}`, status: STAKE_STATUS.LIVE, ...over,
  },
]);

/** A wallet that has already been granted this week and spent `spent` BP. */
const wallet = (spent = 0, appliedEntries = {}) => ({
  lastAllowanceWeek: WEEK,
  allowanceRemaining: ALLOWANCE_BP - spent,
  careerNet: -spent,
  seasons: {},
  appliedEntries: { [`allowance:${WEEK}`]: '2026-09-22T14:00:00.000Z', ...appliedEntries },
  createdAt: '2026-09-22T14:00:00.000Z',
  updatedAt: '2026-09-22T14:00:00.000Z',
});

function seedClosable({ stakes = [], group = lobbyGroup(), pool = openPool(), spentByUser = {} } = {}) {
  const initial = {
    [`tournamentGroups/${group.id}`]: group,
    [`${BACKING_POOLS_COLLECTION}/${GROUP_ID}`]: pool,
  };
  for (const [path, data] of stakes) initial[path] = data;
  for (const [uid, spent] of Object.entries(spentByUser)) {
    initial[`${BACKING_WALLETS_COLLECTION}/${uid}`] = wallet(spent, Object.fromEntries(
      stakes.filter(([, s]) => s.userId === uid).map(([path]) => [`stake:${path.split('/').pop()}`, '2026-09-23T14:00:00.000Z']),
    ));
  }
  return makeInMemoryDb(initial);
}

const poolOf = (store) => store.get(`${BACKING_POOLS_COLLECTION}/${GROUP_ID}`);
const stakeOf = (store, id) => store.get(`${BACKING_STAKES_COLLECTION}/${id}`);
const walletOf = (store, uid) => store.get(`${BACKING_WALLETS_COLLECTION}/${uid}`);
const totalsOf = (store) => store.get(`${BACKING_POOLS_COLLECTION}/${GROUP_ID}/private/totals`);

// ============================ IDENTITY ============================
describe('poolIdFor — the wallet id rule, verbatim, refusal included (§6)', () => {
  it('is the groupId, and `dev-{groupId}` for a dev pod', () => {
    expect(poolIdFor({ id: 'g1' })).toBe('g1');
    expect(poolIdFor({ id: 'g1', isDev: true })).toBe('dev-g1');
    expect(poolIdFor('g1')).toBe('g1');
  });

  it('refuses a groupId already inside the dev namespace — one doc, one pod', () => {
    // `poolIdFor({id:'x',isDev:true})` and `poolIdFor({id:'dev-x'})` name the
    // SAME document; admitting both would sum two pods' stakes into one pot.
    expect(() => poolIdFor({ id: 'dev-x' })).toThrow(BackingPoolError);
    expect(() => poolIdFor({ id: 'dev-x' })).toThrow(/ambiguous pool id/);
    try { poolIdFor({ id: 'dev-x' }); } catch (e) { expect(e.code).toBe('invalid_group_id'); }
  });

  it('refuses an absent or empty groupId', () => {
    for (const bad of [undefined, null, '', {}, { id: '' }, { id: 7 }]) {
      expect(() => poolIdFor(bad)).toThrow(BackingPoolError);
    }
  });

  it('poolRefFor and poolTotalsRefFor name the §6 paths', () => {
    const { db } = makeInMemoryDb();
    expect(poolRefFor(db, { id: 'g1' }).path).toBe('backingPools/g1');
    expect(poolTotalsRefFor(db, { id: 'g1' }).path).toBe('backingPools/g1/private/totals');
    expect(poolTotalsRefFor(db, { id: 'g1', isDev: true }).path).toBe('backingPools/dev-g1/private/totals');
  });
});

// ============================ LIVE TEAMS ============================
describe('liveTeamsFor — §1 derives the teams from players[] on every read', () => {
  it('returns every seat, with isCpu from the FLAG or the id shape', () => {
    expect(liveTeamsFor(lobbyGroup())).toEqual([
      { odUserId: 'od-a', isCpu: false },
      { odUserId: 'od-b', isCpu: false },
      { odUserId: 'cpu-1', isCpu: true },
      { odUserId: 'cpu-2', isCpu: true },
    ]);
    // The flag alone would miss a seat the advancement writer did not stamp;
    // the id alone would miss one stamped under another scheme. Either marks it.
    expect(liveTeamsFor({ players: [{ odUserId: 'cpu-9' }] })).toEqual([{ odUserId: 'cpu-9', isCpu: true }]);
    expect(liveTeamsFor({ players: [{ odUserId: 'od-z', isCpu: true }] })).toEqual([{ odUserId: 'od-z', isCpu: true }]);
  });

  it('a slot pod before fire simply reflects its claimants — no CPUs (§1)', () => {
    const slot = lobbyGroup({ isLiveDraft: true, players: [{ odUserId: 'od-a' }, { odUserId: 'od-b' }] });
    expect(liveTeamsFor(slot)).toEqual([
      { odUserId: 'od-a', isCpu: false },
      { odUserId: 'od-b', isCpu: false },
    ]);
  });

  it('drops malformed seats and collapses a duplicate odUserId', () => {
    const g = { players: [{ odUserId: 'od-a' }, {}, { odUserId: '' }, { odUserId: 7 }, { odUserId: 'od-a' }] };
    expect(liveTeamsFor(g)).toEqual([{ odUserId: 'od-a', isCpu: false }]);
    expect(liveTeamsFor(null)).toEqual([]);
    expect(liveTeamsFor({ players: 'nope' })).toEqual([]);
  });

  it('seatedIdsFor is the same derivation as a Set — one source for seat-present', () => {
    expect([...seatedIdsFor(lobbyGroup())]).toEqual(['od-a', 'od-b', 'cpu-1', 'cpu-2']);
  });
});

// ============================ THE LAZY OPEN ============================
describe('materializePool — the §4 lazy open, refused per poolEligible', () => {
  const cases = [
    ['a dev pod', lobbyGroup({ isDev: true }), POOL_INELIGIBLE.DEV_POD],
    ['a training pod', lobbyGroup({ isTraining: true }), POOL_INELIGIBLE.TRAINING_POD],
    ['the Mon 08:45 slot', lobbyGroup({ isLiveDraft: true, slotId: 'mon-0845' }), POOL_INELIGIBLE.SLOT_EXCLUDED],
    ['a pod that is not forming', lobbyGroup({ status: 'battle' }), POOL_INELIGIBLE.NOT_FORMING],
    ['no derivable battle Monday', lobbyGroup({ createdAt: null }), POOL_INELIGIBLE.NO_BATTLE_MONDAY],
  ];

  for (const [label, group, reason] of cases) {
    it(`refuses ${label} with reason ${reason}, and writes nothing`, async () => {
      const { db, store, writeLog } = makeInMemoryDb();
      const out = await materializePool(db, group, NOW);
      expect(out).toEqual({ pool: null, created: false, reason });
      expect(writeLog).toEqual([]);
      expect(store.size).toBe(0);
    });
  }

  it('refuses a window under 24 hours — the pod read late gets no pool', async () => {
    const { db, writeLog } = makeInMemoryDb();
    // Saturday night: less than 24h remains before the Sunday 23:59 close.
    const out = await materializePool(db, lobbyGroup(), new Date('2026-09-27T12:00:00.000Z'));
    expect(out.pool).toBeNull();
    expect(out.reason).toBe(POOL_INELIGIBLE.WINDOW_TOO_SHORT);
    expect(writeLog).toEqual([]);
  });

  it('opens the §6 document — and does NOT write teams[] (§1)', async () => {
    const { db, store, writeLog } = makeInMemoryDb();
    const out = await materializePool(db, lobbyGroup(), NOW);
    expect(out.created).toBe(true);
    expect(out.reason).toBeNull();
    expect(writeLog).toEqual([['tx.set', `${BACKING_POOLS_COLLECTION}/${GROUP_ID}`]]);

    const pool = poolOf(store);
    expect(pool).toEqual({
      groupId: GROUP_ID,
      status: 'open',
      formationPath: 'lobby',
      slotId: null,
      battleMondayEtDate: MONDAY,
      backingWeekStart: '2026-09-21T04:00:00.000Z',
      opensAt: '2026-09-22T14:00:00.000Z',
      closesAt: CLOSE_ISO,
      closeReason: 'clock',
      baseLayerWeek: WEEK,
      isDev: false,
      potTotal: 0,
      uniqueBackers: 0,
      teamsBacked: 0,
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    });
    // THE ROW THAT FAILS IF teams[] IS EVER WRITTEN AT OPEN (§1): the seats are
    // derived live from players[] until close, so a stored copy is a second
    // source that a departed seat would leave stale.
    expect(pool).not.toHaveProperty('teams');
    expect(pool).not.toHaveProperty('humanTeams');
  });

  it('a slot pod opens with formationPath `slot`, its slotId, and the FIRE close', async () => {
    const slot = lobbyGroup({
      isLiveDraft: true,
      slotId: 'wed-1900',
      scheduledDraftAt: '2026-09-24T23:00:00.000Z',
      battleStartWeek: { mondayEtDate: MONDAY },
      players: [{ odUserId: 'od-a' }, { odUserId: 'od-b' }],
    });
    const { db, store } = makeInMemoryDb();
    await materializePool(db, slot, NOW);
    const pool = poolOf(store);
    expect(pool.formationPath).toBe('slot');
    expect(pool.slotId).toBe('wed-1900');
    expect(pool.closesAt).toBe('2026-09-24T23:00:00.000Z');
    expect(pool.closeReason).toBe('fire');
  });

  it('a dev pod that IS materialized (dev namespace) lands at dev-{groupId}', async () => {
    // poolEligible excludes dev pods from the PRODUCTION list; the namespace is
    // the separate mechanism (§6), so the id rule is asserted on its own.
    const { db } = makeInMemoryDb();
    expect(poolRefFor(db, lobbyGroup({ isDev: true })).path).toBe(`backingPools/dev-${GROUP_ID}`);
  });

  it('opening twice is ONE pool — the second call returns it unchanged and writes nothing', async () => {
    const { db, store, writeLog } = makeInMemoryDb();
    const first = await materializePool(db, lobbyGroup(), NOW);
    const later = new Date('2026-09-23T14:00:00.000Z');
    const second = await materializePool(db, lobbyGroup(), later);
    expect(second.created).toBe(false);
    expect(second.pool).toEqual(first.pool);
    expect(poolOf(store).createdAt).toBe(NOW.toISOString());
    expect(writeLog.filter(([, p]) => p.endsWith(GROUP_ID))).toHaveLength(1);
  });

  it('an EXISTING pool comes back even once the pod would no longer be eligible', async () => {
    const { db } = makeInMemoryDb();
    await materializePool(db, lobbyGroup(), NOW);
    // The pod has since left `forming` — closing the pool is closePool's job.
    const out = await materializePool(db, lobbyGroup({ status: 'battle' }), NOW);
    expect(out.created).toBe(false);
    expect(out.reason).toBeNull();
    expect(out.pool.status).toBe(POOL_STATUS.OPEN);
  });

  it('buildOpenPool is the ONE shape — the suite above asserts it, not a re-typed literal', () => {
    const built = buildOpenPool(lobbyGroup(), NOW, {
      eligibility: { opensAt: 'o', closesAt: 'c', closeReason: 'clock' },
    });
    expect(built.opensAt).toBe('o');
    expect(built.closesAt).toBe('c');
    expect(built.status).toBe(POOL_STATUS.OPEN);
  });
});

// ============================ THE CLOSE ============================
describe('closePool — the §3 order, and nothing may reorder it', () => {
  it('closes a pool whose seats are intact: teams frozen, totals revealed, counters stamped', async () => {
    const stakes = [
      stake('s1', 'u1', 'od-a', 300),
      stake('s2', 'u2', 'od-b', 200),
      stake('s3', 'u3', 'od-a', 100),
    ];
    const { db, store } = seedClosable({ stakes, spentByUser: { u1: 300, u2: 200, u3: 100 } });
    const out = await closePool(db, lobbyGroup(), AFTER_CLOSE);

    expect(out).toMatchObject({ closed: true, status: POOL_STATUS.CLOSED, voided: 0, refunded: 0 });
    const pool = poolOf(store);
    expect(pool.status).toBe(POOL_STATUS.CLOSED);
    expect(pool.potTotal).toBe(600);
    expect(pool.uniqueBackers).toBe(3);
    expect(pool.teamsBacked).toBe(2);
    expect(pool.humanTeams).toBe(2);       // od-a and od-b; the two CPUs are not human
    expect(pool.closedAt).toBe(AFTER_CLOSE.toISOString());

    // (1) teams[] frozen to the seats present at close, (4) with the reveal.
    expect(pool.teams).toEqual([
      { odUserId: 'od-a', isCpu: false, stakeTotal: 400, backerCount: 2 },
      { odUserId: 'od-b', isCpu: false, stakeTotal: 200, backerCount: 1 },
      { odUserId: 'cpu-1', isCpu: true, stakeTotal: 0, backerCount: 0 },
      { odUserId: 'cpu-2', isCpu: true, stakeTotal: 0, backerCount: 0 },
    ]);
    // Every stake survives; no refund entry exists.
    for (const id of ['s1', 's2', 's3']) expect(stakeOf(store, id).status).toBe(STAKE_STATUS.LIVE);
    expect(walletOf(store, 'u1').careerNet).toBe(-300);
    // The sealed cache agrees with the public reveal, because both were derived
    // from the same pass over the surviving stakes.
    expect(totalsOf(store).byTeam).toEqual({
      'od-a': { stakeTotal: 400, backerCount: 2 },
      'od-b': { stakeTotal: 200, backerCount: 1 },
    });
  });

  it('a seat that LEFT voids only that backer — and refunds them score-neutrally (§3 step 2)', async () => {
    const stakes = [
      stake('s1', 'u1', 'od-a', 300),
      stake('s2', 'u2', 'od-b', 200),   // od-b leaves
      stake('s3', 'u3', 'od-a', 100),
      stake('s4', 'u4', 'cpu-1', 150),
    ];
    // od-b is gone from players[] at close; everyone else is seated.
    const atClose = lobbyGroup({
      players: [{ odUserId: 'od-a' }, { odUserId: 'cpu-1', isCpu: true }, { odUserId: 'cpu-2', isCpu: true }],
    });
    const { db, store } = seedClosable({
      stakes, group: atClose, spentByUser: { u1: 300, u2: 200, u3: 100, u4: 150 },
    });
    const out = await closePool(db, atClose, AFTER_CLOSE);

    expect(out).toMatchObject({ closed: true, status: POOL_STATUS.CLOSED, voided: 1, refunded: 1 });
    const voided = stakeOf(store, 's2');
    expect(voided.status).toBe(STAKE_STATUS.VOIDED);
    expect(voided.voidReason).toBe(VOID_REASONS.SEAT_LEFT);
    expect(voided.voidedAt).toBe(AFTER_CLOSE.toISOString());
    // The document id is not written back as a field.
    expect(voided).not.toHaveProperty('id');

    // SCORE-NEUTRAL (§2): the stake debited careerNet, the refund credits it back.
    expect(walletOf(store, 'u2').careerNet).toBe(0);
    // ...and NOT as spendable BP — the week has closed.
    expect(walletOf(store, 'u2').allowanceRemaining).toBe(ALLOWANCE_BP - 200);
    const refundEntry = store.get(`${BACKING_WALLETS_COLLECTION}/u2/entries/refund:s2`);
    expect(refundEntry).toMatchObject({ type: ENTRY_TYPES.REFUND, delta: 200, ref: 's2', groupId: GROUP_ID, monthKey: '2026-09' });

    // The others are untouched.
    for (const id of ['s1', 's3', 's4']) expect(stakeOf(store, id).status).toBe(STAKE_STATUS.LIVE);
    expect(walletOf(store, 'u1').careerNet).toBe(-300);

    // The departed seat is not in the frozen teams[], and its stakes are not in
    // the pot.
    expect(poolOf(store).teams.map((t) => t.odUserId)).toEqual(['od-a', 'cpu-1', 'cpu-2']);
    expect(poolOf(store).potTotal).toBe(550);
    expect(poolOf(store).uniqueBackers).toBe(3);
  });

  it('VOID BEFORE VALIDITY: a pool valid only WITH the departed seat closes `insufficient`', async () => {
    // 3 backers on 2 teams — valid, IF you count u2's stake on the seat that
    // left. After step 2 only u1 and u3 remain, both on od-a: 2 backers, 1 team.
    // This row fails under ANY implementation that evaluates validity first.
    const stakes = [
      stake('s1', 'u1', 'od-a', 300),
      stake('s2', 'u2', 'od-b', 200),
      stake('s3', 'u3', 'od-a', 100),
    ];
    const atClose = lobbyGroup({ players: [{ odUserId: 'od-a' }, { odUserId: 'cpu-1', isCpu: true }] });
    const { db, store } = seedClosable({ stakes, group: atClose, spentByUser: { u1: 300, u2: 200, u3: 100 } });
    const out = await closePool(db, atClose, AFTER_CLOSE);

    expect(out.status).toBe(POOL_STATUS.INSUFFICIENT);
    expect(stakeOf(store, 's2').voidReason).toBe(VOID_REASONS.SEAT_LEFT);
    expect(stakeOf(store, 's1').voidReason).toBe(VOID_REASONS.INSUFFICIENT);
    expect(stakeOf(store, 's3').voidReason).toBe(VOID_REASONS.INSUFFICIENT);
    expect(out.voided).toBe(3);
    expect(out.refunded).toBe(3);
  });

  it('REVEAL AFTER THE VOIDS: an `insufficient` pool reveals zeros, not the pre-void pot', async () => {
    const stakes = [stake('s1', 'u1', 'od-a', 300), stake('s2', 'u2', 'od-a', 200)];
    const { db, store } = seedClosable({ stakes, spentByUser: { u1: 300, u2: 200 } });
    const out = await closePool(db, lobbyGroup(), AFTER_CLOSE);
    expect(out.status).toBe(POOL_STATUS.INSUFFICIENT);
    const pool = poolOf(store);
    expect(pool.potTotal).toBe(0);
    expect(pool.uniqueBackers).toBe(0);
    expect(pool.teamsBacked).toBe(0);
    expect(pool.teams.every((t) => t.stakeTotal === 0 && t.backerCount === 0)).toBe(true);
    expect(totalsOf(store).byTeam).toEqual({});
  });

  it('fails the BACKER arm: enough teams, too few backers', async () => {
    expect(VALIDITY_MIN_BACKERS).toBe(3);
    const stakes = [stake('s1', 'u1', 'od-a', 300), stake('s2', 'u2', 'od-b', 200)];
    const { db, store } = seedClosable({ stakes, spentByUser: { u1: 300, u2: 200 } });
    const out = await closePool(db, lobbyGroup(), AFTER_CLOSE);
    expect(out.status).toBe(POOL_STATUS.INSUFFICIENT);
    expect(stakeOf(store, 's1').voidReason).toBe(VOID_REASONS.INSUFFICIENT);
    expect(walletOf(store, 'u1').careerNet).toBe(0);
  });

  it('fails the TEAM arm: enough backers, all on one team', async () => {
    expect(VALIDITY_MIN_TEAMS).toBe(2);
    const stakes = [
      stake('s1', 'u1', 'od-a', 300),
      stake('s2', 'u2', 'od-a', 200),
      stake('s3', 'u3', 'od-a', 100),
    ];
    const { db, store } = seedClosable({ stakes, spentByUser: { u1: 300, u2: 200, u3: 100 } });
    const out = await closePool(db, lobbyGroup(), AFTER_CLOSE);
    expect(out.status).toBe(POOL_STATUS.INSUFFICIENT);
    expect(out.voided).toBe(3);
    for (const [uid] of [['u1'], ['u2'], ['u3']]) expect(walletOf(store, uid).careerNet).toBe(0);
  });

  it('passes on EXACTLY the floor — 3 backers, 2 teams (the boundary, not one past it)', async () => {
    const stakes = [
      stake('s1', 'u1', 'od-a', 100),
      stake('s2', 'u2', 'od-a', 100),
      stake('s3', 'u3', 'od-b', 100),
    ];
    const { db, store } = seedClosable({ stakes, spentByUser: { u1: 100, u2: 100, u3: 100 } });
    const out = await closePool(db, lobbyGroup(), AFTER_CLOSE);
    expect(out.status).toBe(POOL_STATUS.CLOSED);
    expect(poolOf(store).potTotal).toBe(300);
  });

  it('a MISSING group doc refunds everything (§7 — the last human left a slot pod)', async () => {
    const stakes = [
      stake('s1', 'u1', 'od-a', 300),
      stake('s2', 'u2', 'od-b', 200),
      stake('s3', 'u3', 'od-a', 100),
    ];
    const { db, store } = seedClosable({ stakes, spentByUser: { u1: 300, u2: 200, u3: 100 } });
    store.delete(`tournamentGroups/${GROUP_ID}`);

    const out = await closePool(db, { id: GROUP_ID, isDev: false, missing: true }, AFTER_CLOSE);
    expect(out).toMatchObject({ closed: true, status: POOL_STATUS.REFUNDED, voided: 3, refunded: 3 });
    for (const id of ['s1', 's2', 's3']) {
      expect(stakeOf(store, id).status).toBe(STAKE_STATUS.VOIDED);
      expect(stakeOf(store, id).voidReason).toBe(VOID_REASONS.GROUP_DELETED);
    }
    const pool = poolOf(store);
    expect(pool.status).toBe(POOL_STATUS.REFUNDED);
    expect(pool.teams).toEqual([]);
    expect(pool.humanTeams).toBe(0);
    expect(pool.potTotal).toBe(0);
    for (const uid of ['u1', 'u2', 'u3']) expect(walletOf(store, uid).careerNet).toBe(0);
  });

  it('closing TWICE is a no-op — idempotent on status (§7)', async () => {
    const stakes = [
      stake('s1', 'u1', 'od-a', 300),
      stake('s2', 'u2', 'od-b', 200),
      stake('s3', 'u3', 'od-a', 100),
    ];
    const { db, store, writeLog } = seedClosable({ stakes, spentByUser: { u1: 300, u2: 200, u3: 100 } });
    await closePool(db, lobbyGroup(), AFTER_CLOSE);
    const afterFirst = writeLog.length;
    const snapshot = JSON.stringify([...store.entries()].sort());

    const second = await closePool(db, lobbyGroup(), new Date('2026-09-28T06:00:00.000Z'));
    expect(second).toMatchObject({ closed: false, reason: 'not_open', status: POOL_STATUS.CLOSED });
    expect(writeLog.length).toBe(afterFirst);
    expect(JSON.stringify([...store.entries()].sort())).toBe(snapshot);
  });

  it('a second close cannot double-refund even if it ran — appliedEntries is the ledger guard', async () => {
    // Belt on the status guard above: force the pool back to `open` and close
    // again. The stakes are already voided so nothing is re-voided, and the
    // wallet refuses a replayed `refund:` entry either way (PR 1).
    const stakes = [stake('s1', 'u1', 'od-a', 300), stake('s2', 'u2', 'od-a', 200)];
    const { db, store } = seedClosable({ stakes, spentByUser: { u1: 300, u2: 200 } });
    await closePool(db, lobbyGroup(), AFTER_CLOSE);
    expect(walletOf(store, 'u1').careerNet).toBe(0);
    store.set(`${BACKING_POOLS_COLLECTION}/${GROUP_ID}`, { ...poolOf(store), status: POOL_STATUS.OPEN });
    await closePool(db, lobbyGroup(), AFTER_CLOSE);
    expect(walletOf(store, 'u1').careerNet).toBe(0);
  });

  it('two stakes by ONE backer refund once each, threaded through one wallet read', async () => {
    // The PR 1 threading contract under the shape that would break a naive
    // caller: the second creditRefund must build on the first's returned state,
    // or the first refund's entry key is dropped while its entry doc commits.
    const stakes = [stake('s1', 'u1', 'od-a', 300), stake('s2', 'u1', 'od-b', 200)];
    const { db, store } = seedClosable({ stakes, spentByUser: { u1: 500 } });
    const out = await closePool(db, lobbyGroup(), AFTER_CLOSE);
    expect(out.status).toBe(POOL_STATUS.INSUFFICIENT);   // one backer, two teams
    const w = walletOf(store, 'u1');
    expect(w.careerNet).toBe(0);
    expect(Object.keys(w.appliedEntries).sort()).toEqual([
      `allowance:${WEEK}`, 'refund:s1', 'refund:s2', 'stake:s1', 'stake:s2',
    ]);
  });

  it('THE WRITE ORDER: every void and refund lands before the pool document', async () => {
    const stakes = [stake('s1', 'u1', 'od-a', 300), stake('s2', 'u2', 'od-a', 200)];
    const { db, writeLog } = seedClosable({ stakes, spentByUser: { u1: 300, u2: 200 } });
    await closePool(db, lobbyGroup(), AFTER_CLOSE);

    const paths = writeLog.map(([, p]) => p);
    const poolAt = paths.indexOf(`${BACKING_POOLS_COLLECTION}/${GROUP_ID}`);
    expect(poolAt).toBeGreaterThan(-1);
    for (const p of paths.filter((x) => x.startsWith(`${BACKING_STAKES_COLLECTION}/`))) {
      expect(paths.indexOf(p)).toBeLessThan(poolAt);
    }
    for (const p of paths.filter((x) => x.startsWith(`${BACKING_WALLETS_COLLECTION}/`))) {
      expect(paths.indexOf(p)).toBeLessThan(poolAt);
    }
    // The sealed cache is written before the public doc it is copied into, so a
    // reader of the committed transaction never sees a revealed pool whose
    // private totals still hold the pre-void numbers.
    expect(paths.indexOf(`${BACKING_POOLS_COLLECTION}/${GROUP_ID}/private/totals`)).toBeLessThan(poolAt);
  });

  it('reads EVERY read before its first write — the Firestore transaction rule', async () => {
    const stakes = [stake('s1', 'u1', 'od-a', 300), stake('s2', 'u2', 'od-b', 200)];
    const { db, readLog, writeLog } = seedClosable({ stakes, spentByUser: { u1: 300, u2: 200 } });
    await closePool(db, lobbyGroup(), AFTER_CLOSE);
    // The fixture does not enforce it, so the suite does: a violation here is a
    // production-only failure the unit tests would otherwise never see.
    const txReads = readLog.filter(([ch]) => ch === 'tx.get').length;
    expect(txReads).toBeGreaterThan(0);
    expect(writeLog.length).toBeGreaterThan(0);
  });

  it('refuses to close a pool that does not exist', async () => {
    const { db, writeLog } = makeInMemoryDb({ [`tournamentGroups/${GROUP_ID}`]: lobbyGroup() });
    expect(await closePool(db, lobbyGroup(), AFTER_CLOSE)).toEqual({ closed: false, reason: 'no_pool' });
    expect(writeLog).toEqual([]);
  });

  it('closes a DEV pod against the dev wallet namespace', async () => {
    const devGroup = lobbyGroup({ isDev: true });
    const { db, store } = makeInMemoryDb({
      [`tournamentGroups/${GROUP_ID}`]: devGroup,
      [`${BACKING_POOLS_COLLECTION}/dev-${GROUP_ID}`]: openPool({ isDev: true }),
      ...Object.fromEntries([stake('s1', 'u1', 'od-a', 300)]),
      [`${BACKING_WALLETS_COLLECTION}/dev-u1`]: wallet(300, { 'stake:s1': '2026-09-23T14:00:00.000Z' }),
    });
    await closePool(db, devGroup, AFTER_CLOSE);
    expect(store.get(`${BACKING_WALLETS_COLLECTION}/dev-u1`).careerNet).toBe(0);
    expect(store.get(`${BACKING_WALLETS_COLLECTION}/u1`)).toBeUndefined();
  });
});

// ============================ monthKeyForPool ============================
describe('monthKeyForPool — the substitute key for a pod that never banks (§2)', () => {
  it('is the battle Monday\'s ET month', () => {
    expect(monthKeyForPool(openPool())).toBe('2026-09');
    expect(monthKeyForPool(openPool({ battleMondayEtDate: '2026-10-05' }))).toBe('2026-10');
  });

  it('refuses a pool with no battle Monday rather than guessing from the clock', () => {
    for (const bad of [undefined, null, {}, { battleMondayEtDate: 'W40' }, { battleMondayEtDate: 7 }]) {
      expect(() => monthKeyForPool(bad)).toThrow(BackingPoolError);
    }
  });
});

// ============================ THE FOLDS ============================
describe('totalsFromStakes / totalsFromBackers — one arithmetic, two entry points (§9)', () => {
  it('agree on the same data', () => {
    const stakes = [
      { userId: 'u1', teamOdUserId: 'od-a', amount: 300 },
      { userId: 'u2', teamOdUserId: 'od-b', amount: 200 },
      { userId: 'u1', teamOdUserId: 'od-b', amount: 100 },
    ];
    const fromStakes = totalsFromStakes(stakes);
    const fromBackers = totalsFromBackers(fromStakes.private.backers);
    expect(fromBackers.byTeam).toEqual(fromStakes.byTeam);
    expect(fromBackers.potTotal).toBe(600);
    expect(fromStakes.uniqueBackers).toBe(2);
    expect(fromStakes.teamsBacked).toBe(2);
    expect(fromStakes.byTeam).toEqual({
      'od-a': { stakeTotal: 300, backerCount: 1 },
      'od-b': { stakeTotal: 300, backerCount: 2 },
    });
  });

  it('a backer staking twice on ONE team counts as one backer of that team', () => {
    const totals = totalsFromStakes([
      { userId: 'u1', teamOdUserId: 'od-a', amount: 100 },
      { userId: 'u1', teamOdUserId: 'od-a', amount: 150 },
    ]);
    expect(totals.byTeam['od-a']).toEqual({ stakeTotal: 250, backerCount: 1 });
    expect(totals.uniqueBackers).toBe(1);
  });

  it('drops malformed rows rather than minting fractional or negative BP', () => {
    const totals = totalsFromStakes([
      { userId: 'u1', teamOdUserId: 'od-a', amount: 100 },
      { userId: 'u2', teamOdUserId: 'od-a', amount: -50 },
      { userId: 'u3', teamOdUserId: 'od-a', amount: 'x' },
      { userId: null, teamOdUserId: 'od-a', amount: 50 },
      { userId: 'u4', teamOdUserId: null, amount: 50 },
    ]);
    expect(totals.potTotal).toBe(100);
    expect(totals.uniqueBackers).toBe(1);
  });

  it('an empty pool folds to zeros, not to undefined', () => {
    expect(totalsFromStakes([])).toMatchObject({ potTotal: 0, uniqueBackers: 0, teamsBacked: 0, byTeam: {} });
    expect(totalsFromBackers(undefined)).toMatchObject({ potTotal: 0, uniqueBackers: 0, teamsBacked: 0 });
  });
});

// ============================ THE LAZY DRIVER ============================
describe('ensureClosed — the §7 lazy driver both endpoints and PR 3 share', () => {
  it('does nothing while the pool is still open', async () => {
    const { db, writeLog } = seedClosable({ stakes: [stake('s1', 'u1', 'od-a', 300)], spentByUser: { u1: 300 } });
    const out = await ensureClosed(db, lobbyGroup(), NOW);
    expect(out).toMatchObject({ closed: false, reason: 'still_open' });
    expect(writeLog).toEqual([]);
  });

  it('closes once the server clock has passed closesAt', async () => {
    const stakes = [
      stake('s1', 'u1', 'od-a', 100), stake('s2', 'u2', 'od-b', 100), stake('s3', 'u3', 'od-a', 100),
    ];
    const { db, store } = seedClosable({ stakes, spentByUser: { u1: 100, u2: 100, u3: 100 } });
    const out = await ensureClosed(db, lobbyGroup(), AFTER_CLOSE);
    expect(out.closed).toBe(true);
    expect(poolOf(store).status).toBe(POOL_STATUS.CLOSED);
  });

  it('accepts a groupId and reads the pod itself', async () => {
    const stakes = [
      stake('s1', 'u1', 'od-a', 100), stake('s2', 'u2', 'od-b', 100), stake('s3', 'u3', 'od-a', 100),
    ];
    const { db, store } = seedClosable({ stakes, spentByUser: { u1: 100, u2: 100, u3: 100 } });
    expect((await ensureClosed(db, GROUP_ID, AFTER_CLOSE)).closed).toBe(true);
    expect(poolOf(store).status).toBe(POOL_STATUS.CLOSED);
  });

  it('a DELETED pod still refunds — the tombstone path finds the pool in either namespace', async () => {
    const { db, store } = seedClosable({ stakes: [stake('s1', 'u1', 'od-a', 300)], spentByUser: { u1: 300 } });
    store.delete(`tournamentGroups/${GROUP_ID}`);
    const out = await ensureClosed(db, GROUP_ID, AFTER_CLOSE);
    expect(out).toMatchObject({ closed: true, status: POOL_STATUS.REFUNDED });
    expect(stakeOf(store, 's1').voidReason).toBe(VOID_REASONS.GROUP_DELETED);
    expect(walletOf(store, 'u1').careerNet).toBe(0);
  });

  it('a deleted pod with a DEV pool is found in the dev namespace', async () => {
    const { db, store } = makeInMemoryDb({
      [`${BACKING_POOLS_COLLECTION}/dev-${GROUP_ID}`]: openPool({ isDev: true }),
      ...Object.fromEntries([stake('s1', 'u1', 'od-a', 300)]),
      [`${BACKING_WALLETS_COLLECTION}/dev-u1`]: wallet(300, { 'stake:s1': '2026-09-23T14:00:00.000Z' }),
    });
    const out = await ensureClosed(db, GROUP_ID, AFTER_CLOSE);
    expect(out).toMatchObject({ closed: true, status: POOL_STATUS.REFUNDED });
    expect(store.get(`${BACKING_POOLS_COLLECTION}/dev-${GROUP_ID}`).status).toBe(POOL_STATUS.REFUNDED);
  });

  it('a deleted pod with NO pool is simply nothing to do', async () => {
    const { db, writeLog } = makeInMemoryDb();
    expect(await ensureClosed(db, 'never-existed', AFTER_CLOSE)).toEqual({ closed: false, reason: 'no_pool' });
    expect(writeLog).toEqual([]);
  });

  it('an ALREADY-closed pool is reported, not re-closed', async () => {
    const { db, writeLog } = seedClosable({ pool: openPool({ status: POOL_STATUS.CLOSED }) });
    const out = await ensureClosed(db, lobbyGroup(), AFTER_CLOSE);
    expect(out).toMatchObject({ closed: false, reason: 'not_open', status: POOL_STATUS.CLOSED });
    expect(writeLog).toEqual([]);
  });
});
