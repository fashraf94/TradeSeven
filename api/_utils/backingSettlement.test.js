// api/_utils/backingSettlement.test.js
//
// Backing Beta PR 3 — the settlement primitive (spec V1.3 §1, §3, §7, §12 PR 3;
// Amendment B §B7.2; pre-build check §3 hazards H2–H5, each with a row here;
// H1 lives beside the hook in tournamentAdvancement.backingHook.test.js).
//
// THE ROWS THIS FILE EXISTS FOR, and the mutation each reds under:
//   · "the decision is made on the IN-TRANSACTION read" (H4) — a direct read
//     that says `complete` while the transactional read says `battle` must
//     settle NOTHING; evaluating the predicate on the cheap pre-read reds it;
//   · "a second settler returns unpaid" (H5) — two concurrent settlements on
//     a real optimistic-concurrency harness: one pays, the other sees
//     `resolved`; removing the pool-status gate reds it;
//   · "no tournament* path is written" (H2) — the write log of a full
//     settlement, walked by prefix; a `tournamentGroups` stamp reds it;
//   · "the stake side of EVERY settled stake is attributed" (§B7.2) — the
//     net-BP sum across all backers equals Σ payouts − Σ stakes in BOTH
//     `careerNet` and the season bucket; skipping `recordStakeLoss` for
//     winners reds it;
//   · "a retry converges" — the fixture-crash and SDK-retry rows compare the
//     whole store against a clean run.
//
// Runs against the shared in-memory Firestore stand-in for the ordinary rows
// (its write log is what the H2 row walks) and a versioned
// optimistic-concurrency harness for the race and retry rows, because a
// pass-through transaction cannot mean anything about serialization.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): this file's real import of
// api/_utils/backingSettlement.js is the runtime guard for that module's
// api/ -> src/ imports. Never mock it.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const flags = vi.hoisted(() => ({ frozen: false }));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get TOURNAMENT_ADVANCEMENT_FROZEN() { return flags.frozen; },
}));

import { makeInMemoryDb } from './__fixtures__/inMemoryFirestore.js';
import {
  BackingSettlementError,
  HOLD_REASON,
  SETTLEMENT_MAX_STAKES,
  SETTLEMENT_MAX_WRITES,
  SETTLEMENT_REASON,
  SETTLEMENT_SOURCE,
  agentLayerAbsent,
  humanSeatsOf,
  payoutFor,
  planSettlement,
  resolveSettlementTelemetry,
  settlePool,
  settlementPredicate,
  winningSet,
} from './backingSettlement.js';
import {
  BACKING_POOLS_COLLECTION,
  BACKING_STAKES_COLLECTION,
  POOL_STATUS,
  STAKE_STATUS,
  VOID_REASONS,
  closePool,
  totalsFromStakes,
} from './backingPools.js';
import { BACKING_WALLETS_COLLECTION, ENTRY_TYPES } from './backingWallet.js';
import { GROUP_STATUS, round2 } from '../../src/constants/leagueTournament.js';

beforeEach(() => {
  flags.frozen = false;
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

// ============================ FIXTURES ============================
// Battle Monday 2026-09-28 → backing week 2026-W40; the week banks Mon–Fri
// 2026-09-28 … 2026-10-02, so the ladder's month key is 2026-09 (day 1).
const GROUP_ID = 'grp-settle-1';
const WEEK = '2026-W40';
const MONDAY = '2026-09-28';
const MONTH = '2026-09';
const CLOSE_ISO = '2026-09-28T03:59:59.000Z';
const NOW = new Date('2026-10-02T22:30:00.000Z');   // Friday 18:30 ET, after banking
const NOW_ISO = NOW.toISOString();
const DAYS = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02'];
const MEMBERS = ['od-a', 'od-b', 'cpu-1', 'cpu-2'];
const PLAYERS = [
  { odUserId: 'od-a', picks: [] },
  { odUserId: 'od-b', picks: [] },
  { odUserId: 'cpu-1', isCpu: true, picks: [] },
  { odUserId: 'cpu-2', isCpu: true, picks: [] },
];
/** Final-day layers: od-a 120, od-b 80, cpu-1 40, cpu-2 20 (agent + 1.5 × user). */
const SCORES = {
  'od-a': { user: 60, agent: 30 },
  'od-b': { user: 40, agent: 20 },
  'cpu-1': { user: 20, agent: 10 },
  'cpu-2': { user: 10, agent: 5 },
};

/** Five banked days whose FINAL snapshot is `finalByUser` (earlier days smaller). */
function bankedWeek(finalByUser, { days = 5, agentPointsOf = null } = {}) {
  const dailyScores = {};
  for (let i = 0; i < days; i += 1) {
    const closeScores = {};
    for (const [id, v] of Object.entries(finalByUser)) {
      const scale = (i + 1) / days;
      const user = i === days - 1 ? v.user : Math.round(v.user * scale);
      const agent = agentPointsOf ? agentPointsOf(id, i) : (i === days - 1 ? v.agent : Math.round(v.agent * scale));
      const entry = { totalPoints: user, picks: [] };
      if (agent !== undefined) entry.agentPoints = agent;
      entry.compositePoints = round2((agent ?? 0) + 1.5 * user);
      closeScores[id] = entry;
    }
    dailyScores[`day${i + 1}`] = { recordedDate: DAYS[i], closeScores };
  }
  return dailyScores;
}

const completeGroup = (over = {}) => ({
  id: GROUP_ID,
  status: GROUP_STATUS.COMPLETE,
  isLiveDraft: false,
  baseLayerWeek: WEEK,
  createdAt: '2026-09-22T14:00:00.000Z',
  updatedAt: NOW_ISO,
  groupMembers: MEMBERS,
  players: PLAYERS,
  dailyScores: bankedWeek(SCORES),
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

/** §3's worked example: A 600, B 300, C 200, D 100 — pot 1,200. */
const SPEC_STAKES = () => [
  stake('s1', 'u1', 'od-a', 500),
  stake('s2', 'u2', 'od-a', 100),
  stake('s3', 'u2', 'od-b', 300),
  stake('s4', 'u3', 'cpu-1', 200),
  stake('s5', 'u4', 'cpu-2', 100),
];

/** A CLOSED pool in the shape closePool writes (frozen teams, revealed totals). */
function closedPool(stakes, group, over = {}) {
  const totals = totalsFromStakes(stakes.map(([, s]) => s));
  const seats = (group.players ?? []).map((p) => ({ odUserId: p.odUserId, isCpu: p.isCpu === true }));
  return {
    pool: {
      groupId: group.id,
      status: POOL_STATUS.CLOSED,
      formationPath: 'lobby',
      slotId: null,
      battleMondayEtDate: MONDAY,
      backingWeekStart: '2026-09-21T04:00:00.000Z',
      opensAt: '2026-09-22T14:00:00.000Z',
      closesAt: CLOSE_ISO,
      closeReason: 'clock',
      baseLayerWeek: WEEK,
      isDev: group.isDev === true,
      teams: seats.map((t) => ({
        odUserId: t.odUserId, isCpu: t.isCpu,
        stakeTotal: totals.byTeam[t.odUserId]?.stakeTotal ?? 0,
        backerCount: totals.byTeam[t.odUserId]?.backerCount ?? 0,
      })),
      humanTeams: seats.filter((t) => !t.isCpu).length,
      potTotal: totals.private.potTotal,
      uniqueBackers: totals.private.uniqueBackers,
      teamsBacked: totals.private.teamsBacked,
      closedAt: '2026-09-28T04:00:00.000Z',
      createdAt: '2026-09-22T14:00:00.000Z',
      updatedAt: '2026-09-28T04:00:00.000Z',
      ...over,
    },
    totals: { ...totals.private, updatedAt: '2026-09-28T04:00:00.000Z' },
  };
}

/** A wallet that was granted this week and placed `stakes` (careerNet = −Σ). */
function walletFor(uid, stakes) {
  const mine = stakes.filter(([, s]) => s.userId === uid);
  const spent = mine.reduce((sum, [, s]) => sum + s.amount, 0);
  return {
    lastAllowanceWeek: WEEK,
    allowanceRemaining: 1000 - spent,
    careerNet: -spent,
    seasons: {},
    appliedEntries: {
      [`allowance:${WEEK}`]: '2026-09-22T14:00:00.000Z',
      ...Object.fromEntries(mine.map(([path]) => [`stake:${path.split('/').pop()}`, '2026-09-23T14:00:00.000Z'])),
    },
    createdAt: '2026-09-22T14:00:00.000Z',
    updatedAt: '2026-09-23T14:00:00.000Z',
  };
}

/** The whole world for one settleable pod, as a plain initial-store map. */
function world({ stakes = SPEC_STAKES(), group = completeGroup(), poolOver = {}, extra = {} } = {}) {
  const dev = group.isDev === true;
  const poolId = dev ? `dev-${group.id}` : group.id;
  const { pool, totals } = closedPool(stakes, group, poolOver);
  const initial = {
    [`tournamentGroups/${group.id}`]: (({ id, ...data }) => data)(group),
    [`${BACKING_POOLS_COLLECTION}/${poolId}`]: pool,
    [`${BACKING_POOLS_COLLECTION}/${poolId}/private/totals`]: totals,
    ...extra,
  };
  for (const [path, data] of stakes) initial[path] = data;
  for (const uid of new Set(stakes.map(([, s]) => s.userId))) {
    initial[`${BACKING_WALLETS_COLLECTION}/${dev ? `dev-${uid}` : uid}`] = walletFor(uid, stakes);
  }
  return initial;
}

const seed = (opts) => makeInMemoryDb(world(opts));
const poolOf = (store, id = GROUP_ID) => store.get(`${BACKING_POOLS_COLLECTION}/${id}`);
const stakeOf = (store, id) => store.get(`${BACKING_STAKES_COLLECTION}/${id}`);
const walletOf = (store, uid) => store.get(`${BACKING_WALLETS_COLLECTION}/${uid}`);
const entryOf = (store, uid, entryId) => store.get(`${BACKING_WALLETS_COLLECTION}/${uid}/entries/${entryId}`);
const settle = (db, over = {}) => settlePool(db, GROUP_ID, { now: NOW, source: SETTLEMENT_SOURCE.FRIDAY_DUTY, ...over });
const BACKING_PREFIXES = ['backingPools/', 'backingStakes/', 'backingWallets/'];

/** Every store entry that settlement can touch, as a comparable snapshot. */
function backingSnapshot(store) {
  const out = {};
  for (const [path, data] of [...store.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    if (BACKING_PREFIXES.some((p) => path.startsWith(p))) out[path] = data;
  }
  return out;
}

// ==================== THE VERSIONED HARNESS ====================
// An optimistic-concurrency SIMULATOR (the backing-stake.test.js shape):
// every document is versioned, a transaction remembers what it READ, and on
// commit it discards the buffered writes and re-runs the body if any of them
// moved — which is what Firestore does. It also refuses a read after a write,
// and (unlike the PR 2 copy) re-runs the body on ONE transaction object, as
// the SDK does. DOCUMENTED LIMIT, inherited from PR 2's harness: a query's
// read set is the documents it MATCHED — narrower than Firestore's, which also
// guards the range — so this harness misses conflicts Firestore would catch
// and never invents ones it would not; every "safe" conclusion drawn here
// holds a fortiori.
const tick = () => new Promise((r) => setImmediate(r));

function makeVersionedDb(initial = {}, { beforeCommit = null } = {}) {
  const store = new Map(Object.entries(initial).map(([k, v]) => [k, structuredClone(v)]));
  const versions = new Map();
  const writeLog = [];
  const stats = { attempts: 0, commits: 0, conflicts: 0 };
  const snapOf = (path) => {
    const data = store.get(path);
    return { exists: data !== undefined, id: path.split('/').pop(), data: () => structuredClone(data) };
  };
  const docsUnder = (prefix) => [...store.entries()]
    .filter(([p]) => p.startsWith(`${prefix}/`) && !p.slice(prefix.length + 1).includes('/'))
    .map(([p, d]) => ({ __path: p, id: p.slice(prefix.length + 1), data: () => structuredClone(d) }));
  const snapshotOf = (docs) => ({ docs, empty: docs.length === 0, size: docs.length, forEach: (cb) => docs.forEach(cb) });
  function makeQuery(prefix, filters) {
    const run = () => docsUnder(prefix).filter((d) => filters.every((f) => f.op !== '==' || d.data()[f.field] === f.value));
    const self = {
      path: prefix, _run: run,
      where: (field, op, value) => makeQuery(prefix, [...filters, { field, op, value }]),
      orderBy: () => makeQuery(prefix, filters), limit: () => makeQuery(prefix, filters),
      select: () => self,   // a field mask never changes WHICH docs come back
      get: async () => { await tick(); return snapshotOf(run()); },
    };
    return self;
  }
  function makeDocRef(path) {
    return {
      path, _isDoc: true,
      get: async () => { await tick(); return snapOf(path); },
      collection: (sub) => makeCollection(`${path}/${sub}`),
    };
  }
  function makeCollection(prefix) {
    return {
      path: prefix,
      doc: (id) => makeDocRef(`${prefix}/${id}`),
      where: (field, op, value) => makeQuery(prefix, [{ field, op, value }]),
      get: async () => { await tick(); return snapshotOf(docsUnder(prefix)); },
    };
  }
  const commitWrites = (buffer) => {
    for (const [p, d] of buffer) {
      store.set(p, d);
      versions.set(p, (versions.get(p) ?? 0) + 1);
      writeLog.push(['tx.set', p]);
    }
  };
  const db = {
    collection: makeCollection,
    runTransaction: async (fn) => {
      // ONE Transaction object across attempts, as the SDK does
      // (@google-cloud/firestore transaction.js runs `updateFunction(this)`
      // and only resets its write batch between attempts) — so anything the
      // code under test remembers PER TRANSACTION OBJECT (backingWallet.js's
      // per-tx wallet memo, reset by readWallet's forgetWallet) is exercised
      // the way production exercises it. A fresh object per attempt would let
      // a missing reset pass unseen (review lens E, E4).
      let reads = new Map();
      let buffer = [];
      let wrote = false;
      const remember = (path) => reads.set(path, versions.get(path) ?? 0);
      const tx = {
        get: async (ref) => {
          if (wrote) throw new Error('transaction read after write');
          await tick();
          if (ref._isDoc) { remember(ref.path); return snapOf(ref.path); }
          const docs = ref._run();
          for (const d of docs) remember(d.__path);
          return snapshotOf(docs);
        },
        set: (ref, data) => { wrote = true; buffer.push([ref.path, structuredClone(data)]); },
        update: () => { throw new Error('settlement writes whole documents or nothing'); },
      };
      for (let attempt = 1; attempt <= 6; attempt += 1) {
        stats.attempts += 1;
        reads = new Map();
        buffer = [];
        wrote = false;
        const result = await fn(tx);
        await tick();
        if (beforeCommit) beforeCommit({ attempt, store, versions, commitWrites });
        const conflict = [...reads].some(([p, v]) => (versions.get(p) ?? 0) !== v);
        if (conflict) { stats.conflicts += 1; continue; }
        commitWrites(buffer);
        stats.commits += 1;
        return result;
      }
      throw new Error('transaction contention exhausted');
    },
  };
  return { db, store, writeLog, stats };
}

// ============================ PURE BLOCKS ============================
describe('settlementPredicate — the §7 four-part predicate, one definition', () => {
  it('passes a complete, non-training, base-layer, banked group', () => {
    expect(settlementPredicate(completeGroup())).toEqual({ final: true, reason: null });
  });

  const arms = [
    ['status battle', { status: GROUP_STATUS.BATTLE }, 'not_complete'],
    ['status voided', { status: GROUP_STATUS.VOIDED }, 'not_complete'],
    ['a training pod', { isTraining: true }, 'training'],
    ['a bracket game (no baseLayerWeek)', { baseLayerWeek: undefined }, 'not_base_layer'],
    ['an unbanked week (day 4 only)', { dailyScores: bankedWeek(SCORES, { days: 4 }) }, 'not_banked'],
    ['a doubly-pathological only-day6 doc', { dailyScores: { day6: completeGroup().dailyScores.day5 } }, 'not_banked'],
  ];
  for (const [label, over, reason] of arms) {
    it(`refuses ${label} → ${reason}`, () => {
      expect(settlementPredicate(completeGroup(over))).toEqual({ final: false, reason });
    });
  }
  it('never keys on `complete` alone — a complete TRAINING pod is refused', () => {
    expect(settlementPredicate(completeGroup({ isTraining: true })).final).toBe(false);
  });
});

describe('winningSet — the D-j tie set, strict equality on stored composites', () => {
  it('names the single maximum', () => {
    expect(winningSet(completeGroup())).toMatchObject({ winners: ['od-a'], max: 120 });
  });

  it('equal stored values form ONE winning set — no epsilon, no re-rounding', () => {
    const g = completeGroup({ dailyScores: bankedWeek({ ...SCORES, 'od-b': SCORES['od-a'] }) });
    expect(winningSet(g).winners).toEqual(['od-a', 'od-b']);
  });

  it('a value 0.01 apart is NOT a tie — the tournament\'s own comparator', () => {
    const scores = bankedWeek(SCORES);
    scores.day5.closeScores['od-b'].compositePoints = 119.99;
    expect(winningSet(completeGroup({ dailyScores: scores })).winners).toEqual(['od-a']);
  });

  it('reads the FINAL clamped snapshot through getWeeklyComposite, never a sum and never day 6', () => {
    const scores = bankedWeek(SCORES);
    // Day 6 (a contaminated extra day) would flip the winner if it were read.
    scores.day6 = { recordedDate: '2026-10-05', closeScores: { 'od-b': { totalPoints: 999, agentPoints: 999, compositePoints: 2497.5 } } };
    expect(winningSet(completeGroup({ dailyScores: scores })).winners).toEqual(['od-a']);
  });

  it('a non-finite composite cannot win and cannot set the maximum', () => {
    const scores = bankedWeek(SCORES);
    scores.day5.closeScores['od-a'] = { totalPoints: 'x', agentPoints: 'y', compositePoints: 'nope' };
    const { winners, composites } = winningSet(completeGroup({ dailyScores: scores }));
    expect(composites['od-a']).toBeNull();
    expect(winners).toEqual(['od-b']);
  });

  it('a seat with NO closeScores entry reads 0 — it can still win a week where every score is 0', () => {
    const scores = bankedWeek({ 'od-a': { user: 0, agent: 0 }, 'od-b': { user: 0, agent: 0 } });
    expect(winningSet(completeGroup({ groupMembers: ['od-a', 'od-b', 'cpu-1'], dailyScores: scores })).winners)
      .toEqual(['od-a', 'od-b', 'cpu-1']);
  });

  it('no members → no winners', () => {
    expect(winningSet({ groupMembers: [] })).toEqual({ winners: [], max: null, composites: {} });
  });
});

describe('agentLayerAbsent — D-ae, on the clamped final banked day', () => {
  it('is TRUE when every human seat banked agentPoints 0 (the N1 shape)', () => {
    const g = completeGroup({ dailyScores: bankedWeek(SCORES, { agentPointsOf: (id) => (id.startsWith('cpu') ? 5 : 0) }) });
    expect(agentLayerAbsent(g)).toBe(true);
  });

  it('is FALSE when any human seat has a non-zero agent layer', () => {
    const g = completeGroup({ dailyScores: bankedWeek(SCORES, { agentPointsOf: (id) => (id === 'od-b' ? 0.5 : 0) }) });
    expect(agentLayerAbsent(g)).toBe(false);
    expect(agentLayerAbsent(completeGroup())).toBe(false);
  });

  it('reads the CLAMPED final day — a zero day 6 does not make a whole week agent-less', () => {
    const scores = bankedWeek(SCORES);
    scores.day6 = { recordedDate: '2026-10-05', closeScores: { 'od-a': { agentPoints: 0 }, 'od-b': { agentPoints: 0 } } };
    expect(agentLayerAbsent(completeGroup({ dailyScores: scores }))).toBe(false);
  });

  it('an ABSENT agentPoints reads as 0 — the conservative direction (documented)', () => {
    const g = completeGroup({ dailyScores: bankedWeek(SCORES, { agentPointsOf: () => undefined }) });
    expect(agentLayerAbsent(g)).toBe(true);
  });

  it('a pod with no human seat is not judged; an unbanked pod is not judged', () => {
    expect(agentLayerAbsent(completeGroup({ groupMembers: ['cpu-1', 'cpu-2'] }))).toBe(false);
    expect(agentLayerAbsent(completeGroup({ dailyScores: {} }))).toBe(false);
  });

  it('humanSeatsOf judges CPUs by flag OR id shape', () => {
    expect(humanSeatsOf(completeGroup())).toEqual(['od-a', 'od-b']);
    expect(humanSeatsOf({ groupMembers: ['od-z', 'bot-1'], players: [{ odUserId: 'bot-1', isCpu: true }] })).toEqual(['od-z']);
  });
});

describe('payoutFor / planSettlement — §3 math, pure', () => {
  it('payout = floor(stake × pot ÷ winningStakes), integer BP', () => {
    expect(payoutFor(500, 1200, 600)).toBe(1000);
    expect(payoutFor(100, 1000, 300)).toBe(333);
    expect(payoutFor(100, 1000, 0)).toBe(0);
  });

  it('the §3 worked example: A wins at 2.0×, every A stake doubles, nothing burned', () => {
    const stakes = SPEC_STAKES().map(([path, s]) => ({ id: path.split('/').pop(), ...s }));
    const totals = totalsFromStakes(stakes).private;
    const plan = planSettlement({ group: completeGroup(), totals, stakes });
    expect(plan).toMatchObject({ winners: ['od-a'], pot: 1200, winningStakes: 600, paysX: 2, payoutsTotal: 1200, burned: 0, winningCount: 2 });
    expect(plan.outcomes.map((o) => [o.stake.id, o.won, o.payout])).toEqual([
      ['s1', true, 1000], ['s2', true, 200], ['s3', false, 0], ['s4', false, 0], ['s5', false, 0],
    ]);
    // 1 pool + 2 winners × 5 + 3 losers × 3
    expect(plan.projectedWrites).toBe(1 + 10 + 9);
  });

  it('the §3 table: pays × for each team as if it won (pot 1,200)', () => {
    const stakes = SPEC_STAKES().map(([path, s]) => ({ id: path.split('/').pop(), ...s }));
    const totals = totalsFromStakes(stakes).private;
    for (const [winner, paysX] of [['od-a', 2], ['od-b', 4], ['cpu-1', 6], ['cpu-2', 12]]) {
      const scores = bankedWeek({ ...SCORES, [winner]: { user: 500, agent: 500 } });
      expect(planSettlement({ group: completeGroup({ dailyScores: scores }), totals, stakes }).paysX).toBe(paysX);
    }
  });

  it('burns the rounding remainder: 3 × 100 on the winner, pot 1,000 → 333 each, 1 burned (< 3)', () => {
    const stakes = [stake('a', 'u1', 'od-a', 100), stake('b', 'u2', 'od-a', 100), stake('c', 'u3', 'od-a', 100), stake('d', 'u4', 'od-b', 700)]
      .map(([path, s]) => ({ id: path.split('/').pop(), ...s }));
    const totals = totalsFromStakes(stakes).private;
    const plan = planSettlement({ group: completeGroup(), totals, stakes });
    expect(plan.outcomes.filter((o) => o.won).map((o) => o.payout)).toEqual([333, 333, 333]);
    expect(plan.payoutsTotal).toBe(999);
    expect(plan.burned).toBe(1);
    expect(plan.burned).toBeLessThan(plan.winningCount);
    expect(plan.paysX).toBe(3.33);
  });

  it('an unbacked winner set: every stake loses, winningStakes 0, paysX null', () => {
    const stakes = [stake('a', 'u1', 'od-b', 100), stake('b', 'u2', 'cpu-1', 100), stake('c', 'u3', 'cpu-2', 100)]
      .map(([path, s]) => ({ id: path.split('/').pop(), ...s }));
    const plan = planSettlement({ group: completeGroup(), totals: totalsFromStakes(stakes).private, stakes });
    expect(plan).toMatchObject({ winners: ['od-a'], winningStakes: 0, paysX: null, payoutsTotal: 0, burned: 300 });
    expect(plan.outcomes.every((o) => !o.won && o.payout === 0)).toBe(true);
  });

  it('a two-way tie pays pro-rata across BOTH teams\' stakes', () => {
    const stakes = [stake('a', 'u1', 'od-a', 300), stake('b', 'u2', 'od-b', 100), stake('c', 'u3', 'cpu-1', 600)]
      .map(([path, s]) => ({ id: path.split('/').pop(), ...s }));
    const g = completeGroup({ dailyScores: bankedWeek({ ...SCORES, 'od-b': SCORES['od-a'] }) });
    const plan = planSettlement({ group: g, totals: totalsFromStakes(stakes).private, stakes });
    expect(plan.winners).toEqual(['od-a', 'od-b']);
    expect(plan.winningStakes).toBe(400);
    expect(plan.outcomes.map((o) => [o.stake.id, o.payout])).toEqual([['a', 750], ['b', 250], ['c', 0]]);
    expect(plan.payoutsTotal).toBe(1000);
  });

  it('a malformed stake amount aborts rather than settling around it', () => {
    const stakes = [{ id: 'x', userId: 'u1', teamOdUserId: 'od-a', amount: 'lots' }];
    expect(() => planSettlement({ group: completeGroup(), totals: { potTotal: 100, byTeam: {} }, stakes }))
      .toThrow(BackingSettlementError);
  });

  it('a stake LARGER than its team\'s sealed total trips the payout invariant (Σ payouts > pot)', () => {
    // Sealed totals that disagree with the stakes — corruption, not rounding:
    // a 600 stake on a team the book says holds 500, pot 500 → floor(600 × 500
    // ÷ 500) = 600 > 500.
    const stakes = [{ id: 'x', userId: 'u1', teamOdUserId: 'od-a', amount: 600 }];
    const totals = { potTotal: 500, byTeam: { 'od-a': { stakeTotal: 500 } } };
    expect(() => planSettlement({ group: completeGroup(), totals, stakes })).toThrow(/exceeds the pot/);
    // And an earlier pass's payouts count toward the same bound.
    const fair = [{ id: 'y', userId: 'u1', teamOdUserId: 'od-a', amount: 300 }];
    const book = { potTotal: 500, byTeam: { 'od-a': { stakeTotal: 500 } } };
    expect(() => planSettlement({ group: completeGroup(), totals: book, stakes: fair, priorPayouts: 300 })).toThrow(/exceeds the pot/);
    expect(planSettlement({ group: completeGroup(), totals: book, stakes: fair, priorPayouts: 200 }).payoutsTotal).toBe(300);
  });
});

// ============================ THE TRANSACTION ============================
describe('settlePool — refusals that write nothing', () => {
  it('argument refusals are typed', async () => {
    const { db } = seed();
    await expect(settlePool(db, '', { source: SETTLEMENT_SOURCE.ADMIN })).rejects.toThrow(BackingSettlementError);
    await expect(settlePool(db, GROUP_ID, { source: 'bogus' })).rejects.toThrow(/source/);
    await expect(settlePool(db, GROUP_ID, { source: SETTLEMENT_SOURCE.ADMIN, now: 'not a date' })).rejects.toThrow(/instant/);
  });

  const arms = [
    ['status battle', { status: GROUP_STATUS.BATTLE }],
    ['a training pod', { isTraining: true }],
    ['a bracket game', { baseLayerWeek: undefined }],
    ['an unbanked week', { dailyScores: bankedWeek(SCORES, { days: 4 }) }],
  ];
  for (const [label, over] of arms) {
    it(`the predicate refuses ${label}: not_final, no transaction, no write`, async () => {
      const { db, writeLog, readLog } = seed({ group: completeGroup(over) });
      const out = await settle(db);
      expect(out).toMatchObject({ settled: false, reason: SETTLEMENT_REASON.NOT_FINAL });
      expect(writeLog).toEqual([]);
      expect(readLog.filter(([ch]) => ch === 'tx.get')).toEqual([]);
    });
  }

  it('FROZEN (TOURNAMENT_ADVANCEMENT_FROZEN): returns unsettled with ZERO reads — A-C13', async () => {
    flags.frozen = true;
    const { db, writeLog, readLog } = seed();
    expect(await settle(db, { source: SETTLEMENT_SOURCE.SETTLE_ON_READ })).toEqual({ settled: false, reason: SETTLEMENT_REASON.FROZEN });
    expect(await settle(db, { source: SETTLEMENT_SOURCE.ADMIN, overrideHold: true })).toEqual({ settled: false, reason: SETTLEMENT_REASON.FROZEN });
    expect(writeLog).toEqual([]);
    expect(readLog).toEqual([]);
  });

  it('no group doc and an OPEN pool: the deleted-pod refund rides ensureClosed, answered as a refund (PR 5); nothing to settle', async () => {
    const { db, store, writeLog } = makeInMemoryDb({
      [`${BACKING_POOLS_COLLECTION}/${GROUP_ID}`]: { ...closedPool([], completeGroup()).pool, status: POOL_STATUS.OPEN, teams: undefined },
    });
    const out = await settle(db);
    // PR 5: the close's tombstone refund is reported as what it is — a refund
    // with `group_deleted` — rather than as a bare `no_group`; the refund
    // primitive's own suite (backingRefund.test.js) covers the pool that had
    // already closed when the doc vanished.
    expect(out).toMatchObject({ settled: false, refunded: true, reason: SETTLEMENT_REASON.REFUNDED, refundReason: VOID_REASONS.GROUP_DELETED });
    expect(poolOf(store).status).toBe(POOL_STATUS.REFUNDED);
    expect(writeLog.every(([, p]) => BACKING_PREFIXES.some((x) => p.startsWith(x)))).toBe(true);
  });

  it('no group doc and NO pool: no_group, nothing written', async () => {
    const { db, writeLog } = makeInMemoryDb({});
    expect(await settle(db)).toEqual({ settled: false, reason: SETTLEMENT_REASON.NO_GROUP });
    expect(writeLog).toEqual([]);
  });

  it('no pool: no_pool, no write', async () => {
    const { db, writeLog } = makeInMemoryDb({ [`tournamentGroups/${GROUP_ID}`]: completeGroup() });
    expect(await settle(db)).toEqual({ settled: false, reason: SETTLEMENT_REASON.NO_POOL });
    expect(writeLog).toEqual([]);
  });

  for (const status of [POOL_STATUS.INSUFFICIENT, POOL_STATUS.REFUNDED]) {
    it(`a ${status} pool is terminal: nothing paid, nothing written`, async () => {
      const { db, writeLog } = seed({ poolOver: { status } });
      expect(await settle(db)).toMatchObject({ settled: false, reason: SETTLEMENT_REASON.TERMINAL, status });
      expect(writeLog).toEqual([]);
    });
  }

  it('a RESOLVED pool answers already_settled, no write', async () => {
    const { db, writeLog } = seed({ poolOver: { status: POOL_STATUS.RESOLVED } });
    expect(await settle(db)).toMatchObject({ settled: false, reason: SETTLEMENT_REASON.ALREADY_SETTLED });
    expect(writeLog).toEqual([]);
  });

  it('an OPEN pool still inside its window answers pool_open (the close is clock-driven)', async () => {
    const { db, writeLog } = seed({ poolOver: { status: POOL_STATUS.OPEN, closesAt: '2099-01-01T00:00:00.000Z' } });
    expect(await settle(db)).toEqual({ settled: false, reason: SETTLEMENT_REASON.POOL_OPEN });
    expect(writeLog).toEqual([]);
  });

  it('a pool HELD in resolving is never settled without an explicit override', async () => {
    const { db, writeLog } = seed({ poolOver: { status: POOL_STATUS.RESOLVING, holdReason: HOLD_REASON.AGENT_LAYER_ABSENT } });
    for (const source of Object.values(SETTLEMENT_SOURCE)) {
      expect(await settle(db, { source })).toMatchObject({ settled: false, reason: SETTLEMENT_REASON.HELD, holdReason: HOLD_REASON.AGENT_LAYER_ABSENT });
    }
    expect(writeLog).toEqual([]);
  });

  it('THE STALE OBJECT (H4): a direct read saying `complete` while the TRANSACTIONAL read says `battle` settles NOTHING', async () => {
    // The Friday loop's group object still reads `battle` after the transition;
    // the mirror-image hazard is any cheap read that disagrees with the
    // transaction's own. The decision must be made on the in-transaction read.
    // Mutation: evaluate the predicate on the pre-transaction read only → this
    // row pays a pool for a group that is still in battle.
    const { db, store, writeLog } = seed({ group: completeGroup({ status: GROUP_STATUS.BATTLE }) });
    const real = db.collection;
    db.collection = (name) => {
      const col = real(name);
      if (name !== 'tournamentGroups') return col;
      return {
        ...col,
        doc: (id) => {
          const ref = col.doc(id);
          return {
            ...ref,
            get: async () => ({ exists: true, id, data: () => ({ ...store.get(`tournamentGroups/${id}`), status: GROUP_STATUS.COMPLETE }) }),
          };
        },
      };
    };
    const out = await settle(db);
    expect(out).toMatchObject({ settled: false, reason: SETTLEMENT_REASON.NOT_FINAL, predicate: 'not_complete' });
    expect(writeLog).toEqual([]);
    expect(poolOf(store).status).toBe(POOL_STATUS.CLOSED);
    expect(stakeOf(store, 's1').status).toBe(STAKE_STATUS.LIVE);
  });
});

describe('settlePool — the clean settlement (§3 worked example)', () => {
  it('pays A at 2.0×: stake docs, wallet ledgers and the pool, all in one transaction', async () => {
    const { db, store, writeLog, readLog } = seed();
    const out = await settle(db);
    expect(out).toMatchObject({
      settled: true, winners: ['od-a'], winningStakes: 600, paysX: 2,
      stakesSettled: 5, payoutsTotal: 1200, burned: 0,
    });

    // The stakes: won/lost with payout and settledAt; requestId etc. untouched.
    expect(stakeOf(store, 's1')).toMatchObject({ status: STAKE_STATUS.WON, payout: 1000, settledAt: NOW_ISO, requestId: 'req-s1', amount: 500 });
    expect(stakeOf(store, 's2')).toMatchObject({ status: STAKE_STATUS.WON, payout: 200, settledAt: NOW_ISO });
    for (const id of ['s3', 's4', 's5']) {
      expect(stakeOf(store, id)).toMatchObject({ status: STAKE_STATUS.LOST, payout: 0, settledAt: NOW_ISO });
    }

    // The wallets: careerNet = −stakes + payouts; the season bucket the same
    // (§B7.2 — the stake side attributed for winners AND losers).
    expect(walletOf(store, 'u1')).toMatchObject({ careerNet: 500, seasons: { [MONTH]: { net: 500 } }, allowanceRemaining: 500 });
    expect(walletOf(store, 'u2')).toMatchObject({ careerNet: -200, seasons: { [MONTH]: { net: -200 } } });
    expect(walletOf(store, 'u3')).toMatchObject({ careerNet: -200, seasons: { [MONTH]: { net: -200 } } });
    expect(walletOf(store, 'u4')).toMatchObject({ careerNet: -100, seasons: { [MONTH]: { net: -100 } } });
    expect(entryOf(store, 'u1', 'payout:s1')).toMatchObject({ type: ENTRY_TYPES.PAYOUT, delta: 1000, ref: 's1', groupId: GROUP_ID, monthKey: MONTH, at: NOW_ISO });
    expect(entryOf(store, 'u1', 'loss:s1')).toMatchObject({ type: ENTRY_TYPES.LOSS, delta: -500, monthKey: MONTH });
    expect(entryOf(store, 'u2', 'loss:s3')).toMatchObject({ type: ENTRY_TYPES.LOSS, delta: -300 });
    expect(entryOf(store, 'u2', 'payout:s3')).toBeUndefined();

    // The pool: resolved, the §6 settlement fields, each team stamped.
    const pool = poolOf(store);
    expect(pool).toMatchObject({
      status: POOL_STATUS.RESOLVED, monthKey: MONTH, winnerOdUserIds: ['od-a'], winningStakes: 600, paysX: 2,
      settledAt: NOW_ISO, settlementRef: SETTLEMENT_SOURCE.FRIDAY_DUTY, potTotal: 1200, stakesSettled: 5, payoutsTotal: 1200, burnedBp: 0,
      updatedAt: NOW_ISO,
    });
    // EVERY team is stamped (§1 "each team's", §6 teams[].agentId /
    // teams[].hashAtSettlement) — null here because no telemetry was seeded —
    // and carries §3's own "pays × if this team wins": the spec's table, pot
    // 1,200 → 2.0× / 4.0× / 6.0× / 12.0×. `pool.paysX` is the REALIZED ratio.
    expect(pool.teams.map((t) => [t.odUserId, t.won, t.paysX, t.agentId, t.hashAtSettlement])).toEqual([
      ['od-a', true, 2, null, null],
      ['od-b', false, 4, null, null],
      ['cpu-1', false, 6, null, null],
      ['cpu-2', false, 12, null, null],
    ]);
    expect(pool.teams.find((t) => t.odUserId === 'od-a')).toMatchObject({ stakeTotal: 600, backerCount: 2 });

    // H2: ONLY backing collections are written; the group doc is read FRESH
    // inside the transaction and never written.
    expect(writeLog.every(([, p]) => BACKING_PREFIXES.some((x) => p.startsWith(x)))).toBe(true);
    expect(writeLog.some(([, p]) => p.startsWith('tournament'))).toBe(false);
    expect(readLog).toContainEqual(['tx.get', `tournamentGroups/${GROUP_ID}`]);
    expect(store.get(`tournamentGroups/${GROUP_ID}`)).toEqual((({ id, ...g }) => g)(completeGroup()));
  });

  it('THE NET-BP SUM (§B7.2): Σ careerNet and Σ season net over every backer both equal Σ payouts − Σ stakes', async () => {
    // Mutation: skip recordStakeLoss for winners → the season sum reads
    // +1,200 − 700 = +500 instead of 0 and this row reds.
    const { db, store } = seed();
    await settle(db);
    const backers = ['u1', 'u2', 'u3', 'u4'];
    const careerSum = backers.reduce((s, uid) => s + walletOf(store, uid).careerNet, 0);
    const seasonSum = backers.reduce((s, uid) => s + (walletOf(store, uid).seasons[MONTH]?.net ?? 0), 0);
    const payouts = 1200;
    const stakes = 1200;
    expect(careerSum).toBe(payouts - stakes);
    expect(seasonSum).toBe(payouts - stakes);
    // And every settled stake — winner or loser — carries exactly one loss entry.
    for (const id of ['s1', 's2', 's3', 's4', 's5']) {
      const uid = stakeOf(store, id).userId;
      expect(entryOf(store, uid, `loss:${id}`)).toBeDefined();
    }
  });

  it('the rounding remainder is BURNED and recorded — under the winner count', async () => {
    const stakes = [stake('a', 'u1', 'od-a', 100), stake('b', 'u2', 'od-a', 100), stake('c', 'u3', 'od-a', 100), stake('d', 'u4', 'od-b', 700)];
    const { db, store } = seed({ stakes });
    const out = await settle(db);
    expect(out).toMatchObject({ payoutsTotal: 999, burned: 1 });
    expect(poolOf(store).burnedBp).toBe(1);
    const careerSum = ['u1', 'u2', 'u3', 'u4'].reduce((s, uid) => s + walletOf(store, uid).careerNet, 0);
    expect(careerSum).toBe(999 - 1000);   // the burn is the only leak, and it is the pot's, not a backer's
  });

  it('an UNBACKED winner: every live stake loses; no payout entry anywhere (§3, no outcome-dependent refund)', async () => {
    const stakes = [stake('a', 'u1', 'od-b', 100), stake('b', 'u2', 'cpu-1', 100), stake('c', 'u3', 'cpu-2', 100)];
    const { db, store, writeLog } = seed({ stakes });
    const out = await settle(db);
    expect(out).toMatchObject({ settled: true, winners: ['od-a'], winningStakes: 0, paysX: null, payoutsTotal: 0, burned: 300 });
    for (const id of ['a', 'b', 'c']) expect(stakeOf(store, id)).toMatchObject({ status: STAKE_STATUS.LOST, payout: 0 });
    expect(writeLog.some(([, p]) => p.includes('/entries/payout:'))).toBe(false);
    expect(writeLog.some(([, p]) => p.includes('/entries/refund:'))).toBe(false);
    expect(walletOf(store, 'u1')).toMatchObject({ careerNet: -100, seasons: { [MONTH]: { net: -100 } } });
    expect(poolOf(store)).toMatchObject({ status: POOL_STATUS.RESOLVED, winnerOdUserIds: ['od-a'], winningStakes: 0, paysX: null });
  });

  it('a TWO-WAY tie set pays pro-rata across both teams (D-j)', async () => {
    const stakes = [stake('a', 'u1', 'od-a', 300), stake('b', 'u2', 'od-b', 100), stake('c', 'u3', 'cpu-1', 600)];
    const g = completeGroup({ dailyScores: bankedWeek({ ...SCORES, 'od-b': SCORES['od-a'] }) });
    const { db, store } = seed({ stakes, group: g });
    const out = await settle(db);
    expect(out).toMatchObject({ winners: ['od-a', 'od-b'], winningStakes: 400, paysX: 2.5, payoutsTotal: 1000 });
    expect(stakeOf(store, 'a')).toMatchObject({ status: STAKE_STATUS.WON, payout: 750 });
    expect(stakeOf(store, 'b')).toMatchObject({ status: STAKE_STATUS.WON, payout: 250 });
    expect(stakeOf(store, 'c')).toMatchObject({ status: STAKE_STATUS.LOST, payout: 0 });
    const pool = poolOf(store);
    expect(pool.winnerOdUserIds).toEqual(['od-a', 'od-b']);
    expect(pool.teams.filter((t) => t.won).map((t) => t.odUserId)).toEqual(['od-a', 'od-b']);
  });

  it('the month key is the LADDER\'S (day 1 recordedDate), not the settlement clock\'s month', async () => {
    const { db, store } = seed();
    await settlePool(db, GROUP_ID, { now: new Date('2026-11-15T12:00:00.000Z'), source: SETTLEMENT_SOURCE.ADMIN });
    expect(poolOf(store).monthKey).toBe(MONTH);
    expect(entryOf(store, 'u1', 'payout:s1').monthKey).toBe(MONTH);
    expect(walletOf(store, 'u1').seasons).toEqual({ [MONTH]: { net: 500 } });
  });

  it('accepts `now` as an ISO string (the hook passes nowIso)', async () => {
    const { db, store } = seed();
    const out = await settlePool(db, GROUP_ID, { now: NOW_ISO, source: SETTLEMENT_SOURCE.FRIDAY_DUTY });
    expect(out.settled).toBe(true);
    expect(poolOf(store).settledAt).toBe(NOW_ISO);
  });

  it('a pool still OPEN past its close is CLOSED FIRST (§7), then settled in the same call', async () => {
    const { db, store } = seed({ poolOver: { status: POOL_STATUS.OPEN, teams: undefined, closesAt: CLOSE_ISO } });
    delete poolOf(store).teams;
    const out = await settle(db);
    expect(out.settled).toBe(true);
    const pool = poolOf(store);
    expect(pool).toMatchObject({ status: POOL_STATUS.RESOLVED, closedAt: NOW_ISO, settledAt: NOW_ISO, potTotal: 1200 });
    expect(pool.teams.map((t) => t.odUserId)).toEqual(MEMBERS);
  });
});

describe('settlePool — the holds (D-ae, H3), admin-only release', () => {
  const agentless = () => completeGroup({ dailyScores: bankedWeek(SCORES, { agentPointsOf: (id) => (id.startsWith('cpu') ? 5 : 0) }) });

  it('AGENT-LESS WEEK: held in resolving with holdReason agent_layer_absent — no stake, no wallet moves', async () => {
    const { db, store, writeLog } = seed({ group: agentless() });
    const out = await settle(db);
    expect(out).toMatchObject({ settled: false, reason: SETTLEMENT_REASON.AGENT_LAYER_ABSENT, holdReason: HOLD_REASON.AGENT_LAYER_ABSENT });
    expect(poolOf(store)).toMatchObject({ status: POOL_STATUS.RESOLVING, holdReason: HOLD_REASON.AGENT_LAYER_ABSENT, heldAt: NOW_ISO, holdSource: SETTLEMENT_SOURCE.FRIDAY_DUTY, liveStakesAtHold: 5 });
    expect(writeLog).toEqual([['tx.set', `${BACKING_POOLS_COLLECTION}/${GROUP_ID}`]]);
    expect(stakeOf(store, 's1').status).toBe(STAKE_STATUS.LIVE);
    expect(walletOf(store, 'u1').careerNet).toBe(-500);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('agent_layer_absent'));
  });

  it('a held pool stays held for the duty and settle-on-read; only overrideHold releases it, recording who and why', async () => {
    const { db, store, writeLog } = seed({ group: agentless() });
    await settle(db);
    const afterHold = writeLog.length;
    expect(await settle(db, { source: SETTLEMENT_SOURCE.SETTLE_ON_READ })).toMatchObject({ settled: false, reason: SETTLEMENT_REASON.HELD });
    expect(await settle(db, { source: SETTLEMENT_SOURCE.ADMIN })).toMatchObject({ settled: false, reason: SETTLEMENT_REASON.HELD });
    expect(writeLog.length).toBe(afterHold);

    const writesBeforeRelease = writeLog.length;
    const out = await settle(db, { source: SETTLEMENT_SOURCE.ADMIN, overrideHold: true, actor: 'founder', reason: 'agent layer confirmed present via Console' });
    expect(out.settled).toBe(true);
    const pool = poolOf(store);
    expect(pool).toMatchObject({
      status: POOL_STATUS.RESOLVED, settlementRef: SETTLEMENT_SOURCE.ADMIN,
      holdRelease: { by: 'founder', at: NOW_ISO, priorHoldReason: HOLD_REASON.AGENT_LAYER_ABSENT },
    });
    // WHO / WHEN / WHAT WAS HELD are on the pool; the operator's free-text WHY
    // is in the log only — the document is authed-read by every signed-in
    // user (review lenses B and E).
    expect(pool.holdRelease).not.toHaveProperty('reason');
    expect(JSON.stringify(pool)).not.toContain('confirmed present via Console');
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('agent layer confirmed present via Console'));
    expect(pool).not.toHaveProperty('holdReason');
    expect(pool).not.toHaveProperty('heldAt');
    expect(pool).not.toHaveProperty('holdSource');
    expect(stakeOf(store, 's1')).toMatchObject({ status: STAKE_STATUS.WON, payout: 1000 });
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('HOLD RELEASED'));
    // H2 holds on the RELEASE path too: every write after the hold is a backing path.
    expect(writeLog.slice(writesBeforeRelease).length).toBeGreaterThan(0);
    expect(writeLog.slice(writesBeforeRelease).every(([, p]) => BACKING_PREFIXES.some((x) => p.startsWith(x)))).toBe(true);
  });

  it('STAKE CEILING (H3): more than SETTLEMENT_MAX_STAKES live stakes holds the pool, asserted inside the transaction', async () => {
    const stakes = [];
    for (let i = 0; i < SETTLEMENT_MAX_STAKES + 1; i += 1) {
      stakes.push(stake(`c${i}`, `u${i % 7}`, i % 2 ? 'od-a' : 'od-b', 50));
    }
    const { db, store, writeLog, readLog } = seed({ stakes });
    const out = await settle(db);
    expect(out).toMatchObject({ settled: false, reason: SETTLEMENT_REASON.STAKE_CEILING, holdReason: HOLD_REASON.STAKE_CEILING });
    expect(poolOf(store)).toMatchObject({ status: POOL_STATUS.RESOLVING, holdReason: HOLD_REASON.STAKE_CEILING, liveStakesAtHold: SETTLEMENT_MAX_STAKES + 1 });
    expect(writeLog).toEqual([['tx.set', `${BACKING_POOLS_COLLECTION}/${GROUP_ID}`]]);
    // The count was taken on the TRANSACTIONAL stake read.
    expect(readLog).toContainEqual(['tx.get', BACKING_STAKES_COLLECTION]);
    expect(stakeOf(store, 'c0').status).toBe(STAKE_STATUS.LIVE);
  });

  it('exactly SETTLEMENT_MAX_STAKES live stakes still settles (the boundary, not one past it)', async () => {
    const stakes = [];
    for (let i = 0; i < SETTLEMENT_MAX_STAKES; i += 1) {
      // 6 backers × 20 stakes; team A takes 1 in 4 so the write projection stays under the cap.
      stakes.push(stake(`c${i}`, `u${i % 6}`, i % 4 === 0 ? 'od-a' : 'od-b', 50));
    }
    const { db, store } = seed({ stakes });
    const out = await settle(db);
    expect(out.settled).toBe(true);
    expect(out.stakesSettled).toBe(SETTLEMENT_MAX_STAKES);
    expect(poolOf(store).status).toBe(POOL_STATUS.RESOLVED);
  });

  it('the WRITE PROJECTION is asserted beside the count: 100 winning stakes project 501 writes and hold', async () => {
    const stakes = [];
    for (let i = 0; i < 100; i += 1) stakes.push(stake(`w${i}`, `u${i % 5}`, 'od-a', 50));
    stakes.push(stake('loser', 'u9', 'od-b', 50));
    const { db, store } = seed({ stakes });
    expect(1 + 100 * 5 + 3).toBeGreaterThan(SETTLEMENT_MAX_WRITES);
    const out = await settle(db);
    expect(out).toMatchObject({ settled: false, holdReason: HOLD_REASON.STAKE_CEILING });
    expect(poolOf(store).status).toBe(POOL_STATUS.RESOLVING);
  });

  it('the ceiling is STRUCTURAL: an admin override re-holds rather than attempting the commit', async () => {
    const stakes = [];
    for (let i = 0; i < SETTLEMENT_MAX_STAKES + 1; i += 1) stakes.push(stake(`c${i}`, `u${i % 7}`, 'od-b', 50));
    const { db, store } = seed({ stakes });
    await settle(db);
    const out = await settle(db, { source: SETTLEMENT_SOURCE.ADMIN, overrideHold: true, actor: 'founder', reason: 'try' });
    expect(out).toMatchObject({ settled: false, holdReason: HOLD_REASON.STAKE_CEILING });
    expect(poolOf(store)).toMatchObject({
      status: POOL_STATUS.RESOLVING, holdReason: HOLD_REASON.STAKE_CEILING,
      holdReleaseRefused: { by: 'founder', at: NOW_ISO },
    });
    expect(poolOf(store).holdReleaseRefused).not.toHaveProperty('reason');
    expect(stakeOf(store, 'c0').status).toBe(STAKE_STATUS.LIVE);
  });

  it('a corrupt book (totals missing) ABORTS loudly — nothing is written, the pool stays closed', async () => {
    const { db, store, writeLog } = seed();
    store.delete(`${BACKING_POOLS_COLLECTION}/${GROUP_ID}/private/totals`);
    await expect(settle(db)).rejects.toThrow(/private\/totals/);
    expect(writeLog).toEqual([]);
    expect(poolOf(store).status).toBe(POOL_STATUS.CLOSED);
  });

  it('a week with NO finite composite anywhere aborts rather than paying "all lose"', async () => {
    const scores = bankedWeek(SCORES);
    for (const id of MEMBERS) scores.day5.closeScores[id] = { totalPoints: 'x', agentPoints: 'y', compositePoints: NaN };
    const { db, writeLog } = seed({ group: completeGroup({ dailyScores: scores }) });
    await expect(settle(db)).rejects.toThrow(/no seat with a finite composite/);
    expect(writeLog).toEqual([]);
  });
});

describe('settlePool — idempotency: the retry converges (§6)', () => {
  it('a second call after success is already_settled and writes nothing', async () => {
    const { db, store, writeLog } = seed();
    await settle(db);
    const afterFirst = writeLog.length;
    const snapshot = backingSnapshot(store);
    expect(await settle(db)).toMatchObject({ settled: false, reason: SETTLEMENT_REASON.ALREADY_SETTLED });
    expect(await settle(db, { source: SETTLEMENT_SOURCE.SETTLE_ON_READ })).toMatchObject({ settled: false, reason: SETTLEMENT_REASON.ALREADY_SETTLED });
    expect(writeLog.length).toBe(afterFirst);
    expect(backingSnapshot(store)).toEqual(snapshot);
  });

  it('A CRASH MID-SETTLEMENT (partial writes) then a re-call converges on the clean-run state', async () => {
    // The in-memory stand-in applies writes as they are issued, so a throw on
    // the Nth write leaves a PARTIAL store — stakes already moved, entries
    // already written, the pool still `closed`. That is a stricter test than
    // Firestore's atomic rollback: the per-stake status guard and the wallet's
    // appliedEntries must carry the second attempt to exactly the same place.
    const clean = seed();
    await settle(clean.db);
    const expected = backingSnapshot(clean.store);

    for (const failAt of [1, 2, 4, 7, 11]) {
      const { db, store } = seed();
      const realRun = db.runTransaction;
      let calls = 0;
      db.runTransaction = async (fn) => realRun(async (tx) => {
        const set = tx.set;
        return fn({ ...tx, set: (ref, data) => { calls += 1; if (calls === failAt) throw new Error(`crash at write ${failAt}`); set(ref, data); } });
      });
      await expect(settle(db)).rejects.toThrow(`crash at write ${failAt}`);
      db.runTransaction = realRun;
      expect(poolOf(store).status).toBe(POOL_STATUS.CLOSED);  // the pool write is last, so it never landed

      const out = await settle(db);
      expect(out.settled, `re-call after crash at ${failAt}`).toBe(true);
      expect(backingSnapshot(store), `state after crash at ${failAt}`).toEqual(expected);
    }
  });

  it('THE SDK RETRY: a contended first attempt is discarded and the re-run lands ONE settlement, equal to a clean run', async () => {
    const clean = seed();
    await settle(clean.db);
    const expected = backingSnapshot(clean.store);

    let bumped = false;
    const { db, store, stats } = makeVersionedDb(world(), {
      beforeCommit: ({ attempt, versions }) => {
        // Someone touched the pool between our read and our commit, once.
        if (attempt === 1 && !bumped) { bumped = true; versions.set(`${BACKING_POOLS_COLLECTION}/${GROUP_ID}`, 1); }
      },
    });
    const out = await settle(db);
    expect(out.settled).toBe(true);
    expect(stats).toMatchObject({ conflicts: 1, commits: 1 });
    expect(backingSnapshot(store)).toEqual(expected);
  });

  it('A SECOND SETTLER RACING (H5): two concurrent settlements — one pays, the other sees `resolved` and returns unpaid', async () => {
    // Mutation: drop the pool-status gate → both attempts pay and the wallet
    // reads +2,000 for u1 (appliedEntries would stop the entries, but the
    // stake docs would be re-set and the pool re-resolved twice; the row
    // asserts exactly one settled:true and a conflict actually occurred).
    const { db, store, stats, writeLog } = makeVersionedDb(world());
    const [a, b] = await Promise.all([
      settle(db, { source: SETTLEMENT_SOURCE.FRIDAY_DUTY }),
      settle(db, { source: SETTLEMENT_SOURCE.SETTLE_ON_READ }),
    ]);
    const results = [a, b];
    expect(results.filter((r) => r.settled === true)).toHaveLength(1);
    expect(results.filter((r) => r.settled === false && r.reason === SETTLEMENT_REASON.ALREADY_SETTLED)).toHaveLength(1);
    expect(stats.conflicts).toBeGreaterThan(0);   // they really contended
    // ONE paying commit: the pool document was written exactly once, and
    // every stake exactly once. (The harness also counts the loser's read-only
    // re-run as a commit, so the write log is the honest measure.)
    expect(writeLog.filter(([, p]) => p === `${BACKING_POOLS_COLLECTION}/${GROUP_ID}`)).toHaveLength(1);
    expect(writeLog.filter(([, p]) => p === `${BACKING_STAKES_COLLECTION}/s1`)).toHaveLength(1);
    expect(walletOf(store, 'u1').careerNet).toBe(500);
    expect(poolOf(store).status).toBe(POOL_STATUS.RESOLVED);
    expect(Object.keys(walletOf(store, 'u1').appliedEntries).filter((k) => k.startsWith('payout:'))).toEqual(['payout:s1']);
  });

  it('reads EVERYTHING before its first write — the Firestore transaction rule (the harness throws otherwise)', async () => {
    const { db, stats } = makeVersionedDb(world());
    const out = await settle(db);
    expect(out.settled).toBe(true);
    expect(stats).toMatchObject({ attempts: 1, commits: 1, conflicts: 0 });
  });
});

describe('settlePool — after closePool voided a seat-leaver', () => {
  it('voided stakes are untouched (no loss entry, no status change); survivors settle', async () => {
    // od-b left the slot pod before fire: the close voids u2's B stake
    // (seat_left) and refunds it; settlement then sees only the survivors.
    const stakes = SPEC_STAKES();
    const group = completeGroup({ players: PLAYERS.filter((p) => p.odUserId !== 'od-b'), groupMembers: ['od-a', 'cpu-1', 'cpu-2'] });
    const { db, store, writeLog } = seed({ stakes, group, poolOver: { status: POOL_STATUS.OPEN, teams: undefined } });
    delete poolOf(store).teams;
    // Close as the clock would have, with the seat gone.
    const closed = await closePool(db, { id: GROUP_ID, ...store.get(`tournamentGroups/${GROUP_ID}`) }, new Date('2026-09-28T04:00:00.000Z'));
    expect(closed).toMatchObject({ closed: true, status: POOL_STATUS.CLOSED, voided: 1, refunded: 1 });
    expect(stakeOf(store, 's3')).toMatchObject({ status: STAKE_STATUS.VOIDED, voidReason: VOID_REASONS.SEAT_LEFT });
    const u2AfterClose = structuredClone(walletOf(store, 'u2'));
    const s3AfterClose = structuredClone(stakeOf(store, 's3'));
    // The CLOSE pairs each refund with the stake side's own `loss:` entry so a
    // voided stake nets to zero in both records (§B7.2, closePool). That entry
    // is the close's; settlement must leave it, and the stake, exactly as is.
    const lossS3AfterClose = structuredClone(entryOf(store, 'u2', 'loss:s3'));
    expect(lossS3AfterClose).toMatchObject({ type: ENTRY_TYPES.LOSS, delta: -300 });
    expect(entryOf(store, 'u2', 'refund:s3')).toMatchObject({ type: ENTRY_TYPES.REFUND, delta: 300 });
    const writesAfterClose = writeLog.length;

    const out = await settle(db);
    expect(out).toMatchObject({ settled: true, winners: ['od-a'], winningStakes: 600, stakesSettled: 4, payoutsTotal: 900 });
    // Pot after the void is 900 (1,200 − 300): A stakes pay floor(500×900/600)=750 and floor(100×900/600)=150.
    expect(stakeOf(store, 's1')).toMatchObject({ status: STAKE_STATUS.WON, payout: 750 });
    expect(stakeOf(store, 's2')).toMatchObject({ status: STAKE_STATUS.WON, payout: 150 });
    // The VOIDED stake and its close-time entries: byte-identical; settlement
    // wrote NOTHING that names s3 (no second loss, no payout, no status move).
    expect(stakeOf(store, 's3')).toEqual(s3AfterClose);
    expect(entryOf(store, 'u2', 'loss:s3')).toEqual(lossS3AfterClose);
    expect(entryOf(store, 'u2', 'payout:s3')).toBeUndefined();
    expect(writeLog.slice(writesAfterClose).some(([, p]) => p.endsWith('/s3') || p.endsWith(':s3'))).toBe(false);
    // The pool's record counts the four settled stakes, not the voided one.
    expect(poolOf(store)).toMatchObject({ stakesSettled: 4, payoutsTotal: 900, burnedBp: 0, potTotal: 900 });
    // u2's voided stake stays score-neutral (the close already paired refund + loss);
    // only s2 moved: −100 (loss) + 150 (payout).
    expect(walletOf(store, 'u2').careerNet).toBe(u2AfterClose.careerNet + 150);
    expect(walletOf(store, 'u2').seasons[MONTH].net).toBe(u2AfterClose.seasons[MONTH].net - 100 + 150);
  });
});

describe('settlePool — the dev namespace, end to end', () => {
  it('a DEV pod settles its `dev-` pool against `dev-` wallets and touches no production document', async () => {
    const group = completeGroup({ isDev: true });
    const initial = world({ group });
    // A production twin that must not move.
    const prod = world();
    for (const [path, data] of Object.entries(prod)) if (!path.startsWith('tournamentGroups/')) initial[`${path}`] = initial[path] ?? data;
    const { db, store, writeLog } = makeInMemoryDb(initial);
    const out = await settle(db);
    expect(out.settled).toBe(true);
    expect(poolOf(store, `dev-${GROUP_ID}`)).toMatchObject({ status: POOL_STATUS.RESOLVED, isDev: true });
    expect(walletOf(store, 'dev-u1')).toMatchObject({ careerNet: 500 });
    expect(entryOf(store, 'dev-u1', 'payout:s1')).toBeDefined();
    // The production pool and wallets are untouched.
    expect(poolOf(store, GROUP_ID).status).toBe(POOL_STATUS.CLOSED);
    expect(walletOf(store, 'u1').careerNet).toBe(-500);
    expect(writeLog.every(([, p]) => p.startsWith(`${BACKING_POOLS_COLLECTION}/dev-`) || p.startsWith(`${BACKING_WALLETS_COLLECTION}/dev-`) || p.startsWith(`${BACKING_STAKES_COLLECTION}/`))).toBe(true);
  });
});

describe('telemetry — agentId and hashAtSettlement (§1, D-m), never deciding', () => {
  const extra = {
    [`tournamentGroups/${GROUP_ID}/streams/agentDraft`]: {
      events: [
        { pickNumber: 1, round: 1, agentId: 'agent-A', odUserId: 'od-a', symbol: 'AAPL' },
        { pickNumber: 2, round: 1, agentId: 'agent-B', odUserId: 'od-b', symbol: 'MSFT' },
        { pickNumber: 3, round: 1, agentId: 'cpu-agent-1', odUserId: 'cpu-1', symbol: 'NVDA' },
      ],
      resolvedAt: '2026-09-28T13:35:00.000Z',
    },
    'agentBattles/b-a': { groupId: GROUP_ID, gameMode: 'baggerbomb_tournament', ownerId: 'od-a', agentId: 'agent-A', resolvedAgentManifest: { equippedConfigHash: 'hash-a' } },
    'agentBattles/b-cpu': { groupId: GROUP_ID, gameMode: 'baggerbomb_tournament', ownerId: 'cpu-1', agentId: 'cpu-agent-1', isCpu: true, resolvedAgentManifest: { equippedConfigHash: 'shared-cpu-hash' } },
    'agentBattles/other-mode': { groupId: GROUP_ID, gameMode: 'tiered', ownerId: 'od-a', resolvedAgentManifest: { equippedConfigHash: 'WRONG' } },
  };

  it('resolves the winning team\'s agentId from the stream and its hash from the tournament battle doc', async () => {
    const { db, store } = seed({ extra });
    await settle(db);
    const a = poolOf(store).teams.find((t) => t.odUserId === 'od-a');
    expect(a).toMatchObject({ won: true, agentId: 'agent-A', hashAtSettlement: 'hash-a' });
    // EVERY team is stamped (§1 "each team's"; §6): the loadout-changed marker
    // sits on a backer's OWN stakes, which may be on a losing team. od-b has a
    // stream event but no battle doc → agentId from the stream, hash null.
    expect(poolOf(store).teams.find((t) => t.odUserId === 'od-b')).toMatchObject({ won: false, agentId: 'agent-B', hashAtSettlement: null });
  });

  it('a CPU winner carries its agentId and a null hash (all CPUs share one — §1 suppresses the marker)', async () => {
    const scores = bankedWeek({ ...SCORES, 'cpu-1': { user: 500, agent: 500 } });
    const { db, store } = seed({ extra, group: completeGroup({ dailyScores: scores }) });
    await settle(db);
    expect(poolOf(store).teams.find((t) => t.odUserId === 'cpu-1')).toMatchObject({ won: true, agentId: 'cpu-agent-1', hashAtSettlement: null });
  });

  it('an unreadable stream and battle collection yield nulls and settlement still lands', async () => {
    const { db, store } = seed();
    const real = db.collection;
    db.collection = (name) => {
      if (name === 'agentBattles') throw new Error('index building');
      const col = real(name);
      if (name !== 'tournamentGroups') return col;
      return { ...col, doc: (id) => ({ ...col.doc(id), collection: () => { throw new Error('streams unreadable'); } }) };
    };
    const out = await settle(db);
    expect(out.settled).toBe(true);
    expect(poolOf(store).teams.find((t) => t.odUserId === 'od-a')).toMatchObject({ won: true, agentId: null, hashAtSettlement: null });
  });

  it('resolveSettlementTelemetry ignores non-tournament battle docs and seats it was not asked about', async () => {
    const { db } = makeInMemoryDb(extra);
    const out = await resolveSettlementTelemetry(db, GROUP_ID, [{ odUserId: 'od-a', isCpu: false }]);
    expect([...out.entries()]).toEqual([['od-a', { agentId: 'agent-A', hashAtSettlement: 'hash-a' }]]);
  });
});

// ============================================================================
// Rows added by the PR 3 multi-lens review (docs/audits/20260916_BACKING_PR3_MULTILENS_REVIEW.md).
// Each names the defect it reds under; the review record carries the mutation
// evidence.
describe('review rows — guards that could not fail before', () => {
  it('ROUNDING IS FLOOR, NOT ROUND: 3 × 100 on A + 500 on B, pot 800 → 266.67 → 266 each (round would pay 267), burned 2 (lens B, C6)', async () => {
    // The 333.33 fixtures round DOWN either way, so a `Math.round` mutation
    // slipped them; this book has a ≥ .5 fraction and separates the two.
    const stakes = [stake('a', 'u1', 'od-a', 100), stake('b', 'u2', 'od-a', 100), stake('c', 'u3', 'od-a', 100), stake('d', 'u4', 'od-b', 500)];
    const plan = planSettlement({ group: completeGroup(), totals: totalsFromStakes(stakes.map(([, s]) => s)).private, stakes: stakes.map(([path, s]) => ({ id: path.split('/').pop(), ...s })) });
    expect(plan.outcomes.filter((o) => o.won).map((o) => o.payout)).toEqual([266, 266, 266]);
    expect(plan.payoutsTotal).toBe(798);
    expect(plan.burned).toBe(2);
    const { db, store } = seed({ stakes });
    const out = await settle(db);
    expect(out).toMatchObject({ payoutsTotal: 798, burned: 2 });
    expect(stakeOf(store, 'a').payout).toBe(266);
    expect(poolOf(store)).toMatchObject({ burnedBp: 2, paysX: 2.67 });
    expect(poolOf(store).teams.find((t) => t.odUserId === 'od-a').paysX).toBe(2.67);
  });

  it('THE HASH IS THE SEAT\'S CURRENT BATTLE\'S (the P7 selector), whichever order the daily docs arrive in (lens B, C4)', async () => {
    const docs = {
      'agentBattles/b-mon': { groupId: GROUP_ID, gameMode: 'baggerbomb_tournament', ownerId: 'od-a', agentId: 'agent-A', status: 'completed', createdAt: '2026-09-28T14:00:00.000Z', resolvedAgentManifest: { equippedConfigHash: 'hash-monday' } },
      'agentBattles/b-fri': { groupId: GROUP_ID, gameMode: 'baggerbomb_tournament', ownerId: 'od-a', agentId: 'agent-A', status: 'completed', createdAt: '2026-10-02T14:00:00.000Z', resolvedAgentManifest: { equippedConfigHash: 'hash-friday' } },
      'agentBattles/b-act': { groupId: GROUP_ID, gameMode: 'baggerbomb_tournament', ownerId: 'od-b', agentId: 'agent-B', status: 'active', createdAt: '2026-09-30T14:00:00.000Z', resolvedAgentManifest: { equippedConfigHash: 'hash-active' } },
      'agentBattles/b-old': { groupId: GROUP_ID, gameMode: 'baggerbomb_tournament', ownerId: 'od-b', agentId: 'agent-B', status: 'completed', createdAt: '2026-10-02T14:00:00.000Z', resolvedAgentManifest: { equippedConfigHash: 'hash-later-but-completed' } },
    };
    for (const order of [Object.keys(docs), Object.keys(docs).reverse()]) {
      const initial = {};
      for (const k of order) initial[k] = docs[k];
      const { db } = makeInMemoryDb(initial);
      const out = await resolveSettlementTelemetry(db, GROUP_ID, [{ odUserId: 'od-a', isCpu: false }, { odUserId: 'od-b', isCpu: false }]);
      expect(out.get('od-a'), order.join(',')).toEqual({ agentId: 'agent-A', hashAtSettlement: 'hash-friday' });   // latest by createdAt
      expect(out.get('od-b'), order.join(',')).toEqual({ agentId: 'agent-B', hashAtSettlement: 'hash-active' });   // active beats later-completed
    }
  });

  it('THE CEILING IS COUNTED ON THE TRANSACTIONAL READ: a direct query that under-counts does not slip a pool past it (lens D, #4)', async () => {
    const stakes = [];
    for (let i = 0; i < SETTLEMENT_MAX_STAKES + 1; i += 1) stakes.push(stake(`c${i}`, `u${i % 7}`, 'od-b', 50));
    const { db, store } = seed({ stakes });
    // A direct (non-transactional) read of backingStakes returns ONE FEWER
    // doc than the truth the transaction reads.
    const real = db.collection;
    db.collection = (name) => {
      const col = real(name);
      if (name !== BACKING_STAKES_COLLECTION) return col;
      const wrap = (q) => ({
        ...q,
        where: (...args) => wrap(q.where(...args)),
        get: async () => { const snap = await q.get(); const docs = snap.docs.slice(1); return { ...snap, docs, size: docs.length, empty: docs.length === 0, forEach: (cb) => docs.forEach(cb) }; },
      });
      return { ...col, where: (...args) => wrap(col.where(...args)) };
    };
    const out = await settle(db);
    expect(out).toMatchObject({ settled: false, holdReason: HOLD_REASON.STAKE_CEILING });
    expect(poolOf(store)).toMatchObject({ status: POOL_STATUS.RESOLVING, liveStakesAtHold: SETTLEMENT_MAX_STAKES + 1 });
  });

  it('THE CHEAP READ DECIDES NOTHING ABOUT MONEY: winners, the agent-less test and the pool namespace all come from the transactional group read (lens D, #5)', async () => {
    // THE TRUTH (the transactional read): a DEV pod, od-a leads, agent layer
    // present — with a dev pool, dev wallets, AND a production twin pool with
    // production wallets seeded beside it. THE DIRECT READ is doctored to say
    // production, od-b leads, agent layer absent. Money must follow the
    // transactional read: winners od-a, the DEV pool resolved, dev wallets
    // credited, the production twin untouched. (Routing the pool off the
    // cheap read would settle the production twin; judging winners or the
    // agent-less test off it would pick od-b or hold.)
    const truthGroup = completeGroup({ isDev: true });
    const initial = world({ group: truthGroup });
    for (const [path, data] of Object.entries(world())) if (!path.startsWith('tournamentGroups/')) initial[path] = initial[path] ?? data;
    const { db, store, writeLog } = makeInMemoryDb(initial);
    const real = db.collection;
    const doctored = () => {
      const truth = store.get(`tournamentGroups/${GROUP_ID}`);
      const scores = bankedWeek({ ...SCORES, 'od-b': { user: 500, agent: 0 }, 'od-a': { user: 1, agent: 0 } }, { agentPointsOf: (id) => (id.startsWith('cpu') ? 5 : 0) });
      return { ...truth, isDev: false, dailyScores: scores };
    };
    db.collection = (name) => {
      const col = real(name);
      if (name !== 'tournamentGroups') return col;
      return { ...col, doc: (id) => ({ ...col.doc(id), get: async () => ({ exists: true, id, data: doctored }) }) };
    };
    const out = await settle(db);
    expect(out).toMatchObject({ settled: true, winners: ['od-a'] });
    expect(poolOf(store, `dev-${GROUP_ID}`)).toMatchObject({ status: POOL_STATUS.RESOLVED, winnerOdUserIds: ['od-a'], isDev: true });
    expect(walletOf(store, 'dev-u1').careerNet).toBe(500);
    // The production twin: pool still closed, wallets untouched, no write.
    expect(poolOf(store, GROUP_ID).status).toBe(POOL_STATUS.CLOSED);
    expect(walletOf(store, 'u1').careerNet).toBe(-500);
    expect(writeLog.every(([, p]) => p.startsWith(`${BACKING_POOLS_COLLECTION}/dev-`) || p.startsWith(`${BACKING_WALLETS_COLLECTION}/dev-`) || p.startsWith(`${BACKING_STAKES_COLLECTION}/`))).toBe(true);
    expect(stakeOf(store, 's1')).toMatchObject({ status: STAKE_STATUS.WON, payout: 1000 });
  });

  it('a PRIOR `won` stake recorded with no payout is a corrupt book — abort, nothing written (lens D, #11)', async () => {
    const stakes = [...SPEC_STAKES(), stake('ghost', 'u1', 'od-a', 100, { status: STAKE_STATUS.WON, payout: 0, settledAt: '2026-10-02T22:00:00.000Z' })];
    const { db, writeLog } = seed({ stakes });
    await expect(settle(db)).rejects.toThrow(/recorded won with payout/);
    expect(writeLog).toEqual([]);
  });

  it('a MISSING wallet at settlement is never minted from the payout alone — abort, nothing written (lens D, #12)', async () => {
    const { db, store, writeLog } = seed();
    store.delete(`${BACKING_WALLETS_COLLECTION}/u1`);
    await expect(settle(db)).rejects.toThrow(/wallet .* is missing/);
    expect(writeLog).toEqual([]);
    expect(poolOf(store).status).toBe(POOL_STATUS.CLOSED);
    expect(stakeOf(store, 's1').status).toBe(STAKE_STATUS.LIVE);
  });

  it('CHARACTERISATION: winners are judged over groupMembers (D-j); a member absent from players[] can win with nothing backed on it, and then every stake loses (lens D, #13)', async () => {
    // The close voids by players[] (a seat that left); settlement wins by
    // groupMembers (the spec's tie set). The two are updated together by the
    // leave path, so this is drift-only — recorded so the rule is explicit.
    const scores = bankedWeek({ ...SCORES, 'od-z': { user: 500, agent: 500 } });
    const g = completeGroup({ groupMembers: [...MEMBERS, 'od-z'], dailyScores: scores });
    const { db, store } = seed({ group: g });
    const out = await settle(db);
    expect(out).toMatchObject({ settled: true, winners: ['od-z'], winningStakes: 0, payoutsTotal: 0, burned: 1200 });
    expect(stakeOf(store, 's1').status).toBe(STAKE_STATUS.LOST);
  });
});
