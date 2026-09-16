// api/_utils/tournamentAdvancement.backingHook.test.js
//
// Backing Beta PR 3 — THE DUTY HOOK (spec V1.3 §7 "Settlement host", D-o;
// pre-build check §2.2 placement and §3 hazard H1). The hook sits after
// `summary.baseCompleted++` in the base-layer loop, inside its own try/catch,
// calls ONE primitive with `group.id`, and owns its own counters.
//
// THE LOAD-BEARING ROW: a settler that THROWS still yields `summary.errors ===
// 0`, `baseCompleted` incremented, and the duty MARKER SET. Mutation: make the
// hook rethrow → the throw lands in the loop's catch, errors becomes 1, the
// marker is withheld, and that row reds (pre-build check H1 — 18 blind
// re-dispatches that evening plus the Monday catch-up).
//
// THE DARK ROW: with BACKING_BETA_ENABLED false a full duty performs ZERO
// backing reads or writes and its summary is byte-identical to a run with no
// pool in the world at all.
//
// The settlement module is mocked with a PASS-THROUGH: rows that need a
// throwing or canned settler install one; the end-to-end row lets the real
// primitive run inside the duty, which is also the H4 mutation guard (pass the
// loop's stale group object instead of its id → the primitive's argument
// check refuses a non-string `groupId` with `invalid_group_id`, the hook
// counts a settlementError, and the pool never resolves — the row reds either
// way; the primitive's own stale-object row, in backingSettlement.test.js,
// covers the "reads `battle`" half).
//
// PLACEMENT: the hook sits after the completion transition in the base-layer
// loop (pre-build check §2.2). The end-to-end row pins that ORDER on the write
// log (transition before the first backing write); its position relative to
// the `baseCompleted++` line itself is not observable and not pinned.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): this file's real import of
// tournamentAdvancement.js is the runtime guard for its transitive import
// surface — now including backingSettlement.js. Never mock that import.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const flags = vi.hoisted(() => ({ backing: false, frozen: false }));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get BACKING_BETA_ENABLED() { return flags.backing; },
  get TOURNAMENT_ADVANCEMENT_FROZEN() { return flags.frozen; },
}));

const settler = vi.hoisted(() => ({ impl: null, calls: [] }));
vi.mock('./backingSettlement.js', async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    settlePool: async (db, groupId, opts) => {
      settler.calls.push([groupId, opts]);
      if (settler.impl) return settler.impl(db, groupId, opts);
      return original.settlePool(db, groupId, opts);
    },
  };
});

import { makeInMemoryDb } from './__fixtures__/inMemoryFirestore.js';
import { runFridayAdvancement } from './tournamentAdvancement.js';
import { DUTY, dutyMarkerKey, isDutySatisfied, runOrchestratorTick } from './tournamentOrchestrator.js';
import { BACKING_POOLS_COLLECTION, BACKING_STAKES_COLLECTION, POOL_STATUS, STAKE_STATUS, totalsFromStakes } from './backingPools.js';
import { BACKING_WALLETS_COLLECTION } from './backingWallet.js';
import { GROUP_STATUS, round2 } from '../../src/constants/leagueTournament.js';

const NOW = new Date('2026-06-19T22:30:00.000Z'); // Friday 18:30 ET
const NOW_ISO = NOW.toISOString();
const TUE_EVENING = new Date('2026-06-16T22:30:00.000Z');
const STOCKS = Array.from({ length: 40 }, (_, i) => ({ symbol: `SYM${i}` }));

beforeEach(() => {
  flags.backing = false;
  flags.frozen = false;
  settler.impl = null;
  settler.calls.length = 0;
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

// ==================== FIXTURES ====================
const MEMBERS = [
  { odUserId: 'founder' },
  { odUserId: 'cpu-1', isCpu: true },
  { odUserId: 'cpu-2', isCpu: true },
  { odUserId: 'cpu-3', isCpu: true },
];
/** Final composites: founder 124, cpu-2 105, cpu-1 60, cpu-3 37.5 — founder wins. */
const FINAL = { founder: { user: 62, agent: 31 }, 'cpu-1': { user: 40, agent: 0 }, 'cpu-2': { user: 70, agent: 0 }, 'cpu-3': { user: 25, agent: 0 } };

function bankedWeek(finalByUser) {
  const dailyScores = {};
  for (let i = 0; i < 5; i += 1) {
    const closeScores = {};
    for (const [id, v] of Object.entries(finalByUser)) {
      const user = i === 4 ? v.user : Math.round(v.user * (i + 1) / 5);
      const agent = i === 4 ? v.agent : Math.round(v.agent * (i + 1) / 5);
      closeScores[id] = { totalPoints: user, agentPoints: agent, compositePoints: round2(agent + 1.5 * user), picks: [] };
    }
    dailyScores[`day${i + 1}`] = { recordedDate: `2026-06-${15 + i}`, closeScores };
  }
  return dailyScores;
}

function baseGroup(over = {}) {
  return {
    status: GROUP_STATUS.BATTLE,
    baseLayerWeek: '2026-W25',
    groupMembers: MEMBERS.map((m) => m.odUserId),
    players: MEMBERS.map((m) => ({ odUserId: m.odUserId, picks: [], ...(m.isCpu ? { isCpu: true } : {}) })),
    userPool: STOCKS.map((s) => s.symbol),
    claimSystem: { enabled: true, currentWaiverPriority: [], processingLog: [] },
    dailyScores: bankedWeek(FINAL),
    createdAt: '2026-06-08T14:00:00.000Z',
    updatedAt: '2026-06-19T21:20:00.000Z',
    ...over,
  };
}

/** A closed pool + sealed totals + three live stakes + wallets for `groupId`. */
function closedPoolWorld(groupId, group) {
  const stakes = [
    [`${BACKING_STAKES_COLLECTION}/${groupId}-s1`, { userId: 'u1', groupId, teamOdUserId: 'founder', amount: 300, weekKey: '2026-W25', requestId: 'r1', status: STAKE_STATUS.LIVE, placedAt: '2026-06-10T14:00:00.000Z', hashAtStake: null }],
    [`${BACKING_STAKES_COLLECTION}/${groupId}-s2`, { userId: 'u2', groupId, teamOdUserId: 'cpu-2', amount: 200, weekKey: '2026-W25', requestId: 'r2', status: STAKE_STATUS.LIVE, placedAt: '2026-06-10T14:00:00.000Z', hashAtStake: null }],
    [`${BACKING_STAKES_COLLECTION}/${groupId}-s3`, { userId: 'u3', groupId, teamOdUserId: 'cpu-2', amount: 100, weekKey: '2026-W25', requestId: 'r3', status: STAKE_STATUS.LIVE, placedAt: '2026-06-10T14:00:00.000Z', hashAtStake: null }],
  ];
  const totals = totalsFromStakes(stakes.map(([, s]) => s));
  const world = {
    [`${BACKING_POOLS_COLLECTION}/${groupId}`]: {
      groupId, status: POOL_STATUS.CLOSED, formationPath: 'lobby', slotId: null,
      battleMondayEtDate: '2026-06-15', backingWeekStart: '2026-06-08T04:00:00.000Z',
      opensAt: '2026-06-08T14:00:00.000Z', closesAt: '2026-06-15T03:59:59.000Z', closeReason: 'clock',
      baseLayerWeek: '2026-W25', isDev: false,
      teams: group.players.map((p) => ({ odUserId: p.odUserId, isCpu: p.isCpu === true, stakeTotal: totals.byTeam[p.odUserId]?.stakeTotal ?? 0, backerCount: totals.byTeam[p.odUserId]?.backerCount ?? 0 })),
      humanTeams: 1, potTotal: totals.private.potTotal, uniqueBackers: totals.private.uniqueBackers, teamsBacked: totals.private.teamsBacked,
      closedAt: '2026-06-15T04:00:00.000Z', createdAt: '2026-06-08T14:00:00.000Z', updatedAt: '2026-06-15T04:00:00.000Z',
    },
    [`${BACKING_POOLS_COLLECTION}/${groupId}/private/totals`]: { ...totals.private, updatedAt: '2026-06-15T04:00:00.000Z' },
  };
  for (const [path, data] of stakes) world[path] = data;
  for (const [, s] of stakes) {
    world[`${BACKING_WALLETS_COLLECTION}/${s.userId}`] = {
      lastAllowanceWeek: '2026-W25', allowanceRemaining: 1000 - s.amount, careerNet: -s.amount, seasons: {},
      appliedEntries: { 'allowance:2026-W25': 'x', [`stake:${groupId}-${s.requestId.replace('r', 's')}`]: 'x' },
      createdAt: '2026-06-08T14:00:00.000Z', updatedAt: '2026-06-10T14:00:00.000Z',
    };
  }
  return world;
}

function seed({ groups = { base1: baseGroup() }, pools = true } = {}) {
  const initial = { 'indexIntelligence/stockRankings': { stocks: STOCKS } };
  for (const [id, group] of Object.entries(groups)) {
    initial[`tournamentGroups/${id}`] = group;
    if (pools) Object.assign(initial, closedPoolWorld(id, group));
  }
  return makeInMemoryDb(initial);
}

const backingWrites = (writeLog) => writeLog.filter(([, p]) => p.startsWith('backing'));
const backingReads = (readLog) => readLog.filter(([, p]) => p.startsWith('backing'));

// ==================== THE DARK ROW ====================
describe('while DARK (BACKING_BETA_ENABLED false) the duty is byte-identical', () => {
  it('a full Friday duty performs ZERO backing reads or writes, never calls the settler, and its summary carries no backing key', async () => {
    const { db, store, writeLog, readLog } = seed();
    const summary = await runFridayAdvancement(db, { now: NOW });
    expect(summary.baseCompleted).toBe(1);
    expect(summary.errors).toBe(0);
    expect(store.get('tournamentGroups/base1').status).toBe(GROUP_STATUS.COMPLETE);
    expect(backingReads(readLog)).toEqual([]);
    expect(backingWrites(writeLog)).toEqual([]);
    expect(settler.calls).toEqual([]);
    expect(summary).not.toHaveProperty('backing');
    expect(store.get(`${BACKING_POOLS_COLLECTION}/base1`).status).toBe(POOL_STATUS.CLOSED);

    // Byte-identical to a world with no pool at all.
    const bare = seed({ pools: false });
    const bareSummary = await runFridayAdvancement(bare.db, { now: NOW });
    expect(summary).toEqual(bareSummary);
  });
});

// ==================== THE LOAD-BEARING ROWS (H1) ====================
describe('while LIT, a backing failure never touches the duty (H1)', () => {
  it('a settler that THROWS still yields errors 0, baseCompleted 1, and the duty MARKER SET', async () => {
    flags.backing = true;
    settler.impl = async () => { throw new Error('settlement exploded'); };
    const { db, store } = seed();

    const result = await runOrchestratorTick(db, { now: NOW, forceDuty: DUTY.FRIDAY_ADVANCEMENT });
    expect(result.duty).toBe(DUTY.FRIDAY_ADVANCEMENT);
    expect(result.errors).toBe(0);
    expect(result.baseCompleted).toBe(1);
    expect(result.complete).toBe(true);
    expect(result.backing).toEqual({ settled: 0, unsettled: 0, settlementErrors: 1 });
    expect(store.get('tournamentGroups/base1').status).toBe(GROUP_STATUS.COMPLETE);

    // THE MARKER: set for this ET date, and it carries no backing counter.
    const marker = store.get('tournamentOrchestrator/state').duties[dutyMarkerKey('2026-06-19', DUTY.FRIDAY_ADVANCEMENT)];
    expect(marker).toBeDefined();
    expect(Object.keys(marker).sort()).toEqual(['bankingPending', 'champion', 'completedAt', 'composed', 'frozen', 'gamesLocked', 'groups']);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('backing settlement base1 FAILED (non-blocking)'), 'settlement exploded');
  });

  it('the four marker-withholding fields are untouched by the failure, and isDutySatisfied stays true', async () => {
    flags.backing = true;
    settler.impl = async () => { throw new Error('settlement exploded'); };
    const { db } = seed();
    const summary = await runFridayAdvancement(db, { now: NOW });
    expect(summary.errors).toBe(0);
    expect(summary.bankingPending).toBe(0);
    expect(summary.frozen).toBe(0);
    expect(summary.deferredToNextTick).toBeUndefined();
    expect(isDutySatisfied(DUTY.FRIDAY_ADVANCEMENT, summary)).toBe(true);
  });

  it('a settler that throws for one group does not prevent the NEXT group from completing (or settling)', async () => {
    flags.backing = true;
    settler.impl = async (_db, groupId) => {
      if (groupId === 'base1') throw new Error('first pool exploded');
      return { settled: true };
    };
    const { db, store } = seed({ groups: { base1: baseGroup(), base2: baseGroup() } });
    const summary = await runFridayAdvancement(db, { now: NOW });
    expect(summary.baseCompleted).toBe(2);
    expect(summary.errors).toBe(0);
    expect(summary.backing).toEqual({ settled: 1, unsettled: 0, settlementErrors: 1 });
    expect(store.get('tournamentGroups/base1').status).toBe(GROUP_STATUS.COMPLETE);
    expect(store.get('tournamentGroups/base2').status).toBe(GROUP_STATUS.COMPLETE);
    expect(settler.calls.map(([id]) => id).sort()).toEqual(['base1', 'base2']);
  });

  it('an unsettled answer (a hold, not_final) is counted, not an error', async () => {
    flags.backing = true;
    settler.impl = async () => ({ settled: false, reason: 'agent_layer_absent' });
    const { db } = seed();
    const summary = await runFridayAdvancement(db, { now: NOW });
    expect(summary.errors).toBe(0);
    expect(summary.backing).toEqual({ settled: 0, unsettled: 1, settlementErrors: 0 });
  });
});

// ==================== THE CALL SHAPE (H4) AND THE HOSTS ====================
describe('the hook calls the ONE primitive with group.id (H4)', () => {
  it('passes the id — a string — never the loop\'s stale group object, with the duty\'s instant and source', async () => {
    flags.backing = true;
    settler.impl = async () => ({ settled: true });
    const { db } = seed();
    await runFridayAdvancement(db, { now: NOW });
    expect(settler.calls).toHaveLength(1);
    const [groupId, opts] = settler.calls[0];
    expect(typeof groupId).toBe('string');
    expect(groupId).toBe('base1');
    expect(opts).toEqual({ now: NOW_ISO, source: 'friday_duty' });
  });

  it('END TO END: the real primitive settles the closed pool during the duty, AFTER the transition, writing only backing paths (H2)', async () => {
    // Mutation guard for H4: pass the loop's group object instead of its id
    // and the primitive refuses it (`invalid_group_id` — a non-string
    // groupId), the hook counts a settlementError, and this pool never
    // resolves.
    flags.backing = true;
    const { db, store, writeLog } = seed();
    const summary = await runFridayAdvancement(db, { now: NOW });
    expect(summary.baseCompleted).toBe(1);
    expect(summary.errors).toBe(0);
    expect(summary.backing).toEqual({ settled: 1, unsettled: 0, settlementErrors: 0 });

    const pool = store.get(`${BACKING_POOLS_COLLECTION}/base1`);
    expect(pool).toMatchObject({ status: POOL_STATUS.RESOLVED, winnerOdUserIds: ['founder'], winningStakes: 300, paysX: 2, settlementRef: 'friday_duty', settledAt: NOW_ISO });
    expect(store.get(`${BACKING_STAKES_COLLECTION}/base1-s1`)).toMatchObject({ status: STAKE_STATUS.WON, payout: 600 });
    expect(store.get(`${BACKING_STAKES_COLLECTION}/base1-s2`)).toMatchObject({ status: STAKE_STATUS.LOST, payout: 0 });
    expect(store.get(`${BACKING_WALLETS_COLLECTION}/u1`).careerNet).toBe(300);

    // ORDER: the group's completion lands before the first backing write, and
    // nothing under a tournament* path is written after it.
    const transitionAt = writeLog.findIndex(([op, p]) => op === 'tx.update' && p === 'tournamentGroups/base1');
    const firstBackingAt = writeLog.findIndex(([, p]) => p.startsWith('backing'));
    expect(transitionAt).toBeGreaterThan(-1);
    expect(firstBackingAt).toBeGreaterThan(transitionAt);
    expect(writeLog.slice(transitionAt + 1).every(([, p]) => p.startsWith('backing'))).toBe(true);
    // The group doc itself is untouched by settlement.
    expect(store.get('tournamentGroups/base1')).not.toHaveProperty('settledAt');
  });

  it('fires on a TUESDAY evening too — advancement routes every weekday evening, the hook assumes no Friday', async () => {
    flags.backing = true;
    settler.impl = async () => ({ settled: true });
    const { db } = seed();
    const summary = await runFridayAdvancement(db, { now: TUE_EVENING });
    expect(summary.baseCompleted).toBe(1);
    expect(settler.calls).toHaveLength(1);
    expect(settler.calls[0][1]).toEqual({ now: TUE_EVENING.toISOString(), source: 'friday_duty' });
  });

  it('a banking-pending group never reaches the hook; while FROZEN nothing does', async () => {
    flags.backing = true;
    settler.impl = async () => ({ settled: true });
    const pending = seed({ groups: { base1: baseGroup({ dailyScores: { day1: baseGroup().dailyScores.day1 } }) } });
    const s1 = await runFridayAdvancement(pending.db, { now: NOW });
    expect(s1.bankingPending).toBe(1);
    expect(settler.calls).toEqual([]);

    flags.frozen = true;
    const { db } = seed();
    const s2 = await runFridayAdvancement(db, { now: NOW });
    expect(s2.frozen).toBe(1);
    expect(settler.calls).toEqual([]);
  });
});

// ==================== THE CATCH ITSELF (review lens A, A2) ====================
describe('the hook\'s catch survives any rejection shape', () => {
  it('a NULLISH rejection (throw null / Promise.reject()) is still caught by the hook — never by the loop', async () => {
    // `err.message` on null throws a TypeError INSIDE the inner catch, which
    // would escape to the loop's catch and count on summary.errors — the H1
    // failure by another route. `err?.message` closes it.
    flags.backing = true;
    for (const rejection of [null, undefined]) {
      settler.impl = async () => { throw rejection; };
      const { db } = seed();
      const summary = await runFridayAdvancement(db, { now: NOW });
      expect(summary.errors).toBe(0);
      expect(summary.baseCompleted).toBe(1);
      expect(summary.backing).toEqual({ settled: 0, unsettled: 0, settlementErrors: 1 });
      expect(isDutySatisfied(DUTY.FRIDAY_ADVANCEMENT, summary)).toBe(true);
    }
  });

  it('an unsettled answer is logged per group with its reason, so an operator can find a closed-unsettled pool', async () => {
    flags.backing = true;
    settler.impl = async () => ({ settled: false, reason: 'not_final' });
    const { db } = seed();
    await runFridayAdvancement(db, { now: NOW });
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('backing settlement base1: unsettled (not_final)'));
  });
});

// ==================== TYPED ERRORS (review lens D, #1) ====================
describe('a TYPED settlement error is swallowed like any other (H1)', () => {
  it('a settler that throws BackingSettlementError / BackingPoolError / BackingLedgerError still yields errors 0 and the marker', async () => {
    // The errors a REAL settlement raises (totals_missing, no_winner,
    // payout_invariant, wallet_missing, invalid_pool) are typed; a hook that
    // "surfaced data errors to the duty" by rethrowing typed ones would
    // withhold the marker with the untyped row still green.
    const { BackingSettlementError } = await import('./backingSettlement.js');
    const { BackingPoolError } = await import('./backingPools.js');
    const { BackingLedgerError } = await import('./backingWallet.js');
    flags.backing = true;
    for (const err of [
      new BackingSettlementError('totals_missing', 'no book'),
      new BackingPoolError('invalid_pool', 'no monday'),
      new BackingLedgerError('invalid_amount', 'bad amount'),
    ]) {
      settler.impl = async () => { throw err; };
      const { db, store } = seed();
      const result = await runOrchestratorTick(db, { now: NOW, forceDuty: DUTY.FRIDAY_ADVANCEMENT });
      expect(result.errors, err.name).toBe(0);
      expect(result.baseCompleted, err.name).toBe(1);
      expect(result.complete, err.name).toBe(true);
      expect(result.backing, err.name).toEqual({ settled: 0, unsettled: 0, settlementErrors: 1 });
      expect(store.get('tournamentOrchestrator/state').duties[dutyMarkerKey('2026-06-19', DUTY.FRIDAY_ADVANCEMENT)]).toBeDefined();
    }
  });

  it('END TO END: the REAL primitive aborting inside the duty (a corrupt book) still completes the group and sets the marker', async () => {
    flags.backing = true;
    const { db, store } = seed();
    store.delete(`${BACKING_POOLS_COLLECTION}/base1/private/totals`);   // totals_missing → BackingSettlementError
    const result = await runOrchestratorTick(db, { now: NOW, forceDuty: DUTY.FRIDAY_ADVANCEMENT });
    expect(result.errors).toBe(0);
    expect(result.baseCompleted).toBe(1);
    expect(result.complete).toBe(true);
    expect(result.backing).toEqual({ settled: 0, unsettled: 0, settlementErrors: 1 });
    expect(store.get('tournamentGroups/base1').status).toBe(GROUP_STATUS.COMPLETE);
    expect(store.get(`${BACKING_POOLS_COLLECTION}/base1`).status).toBe(POOL_STATUS.CLOSED);   // left for the admin re-run
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('backing settlement base1 FAILED (non-blocking)'), expect.stringContaining('private/totals'));
  });
});
