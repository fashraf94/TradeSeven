// api/_utils/backingRefund.test.js
//
// Backing Beta PR 5 — THE REFUND PRIMITIVE (spec V1.3 §7 "Refund paths", §2
// "voided stakes are score-neutral"; the PR 3 review record's finding 21;
// Amendment B §B7.2 for the pairing). `refundPool` and `settlePool`'s routing
// to it.
//
// THE ROWS THIS FILE EXISTS FOR, and the mutation each reds under:
//   · "THE NET-BP SUM — every refunded stake nets to ZERO" — careerNet AND the
//     season bucket both return to what they were before the stake; skipping
//     `recordStakeLoss` in the refund leaves +amount in the season bucket and
//     reds it (mutation check 1);
//   · "A REFUND RACING A SETTLEMENT — exactly one wins" — on the versioned
//     optimistic-concurrency harness: the pool is resolved XOR refunded, the
//     stakes are decided XOR voided, no wallet carries both a payout and a
//     refund; removing the refund's in-transaction status gate reds it
//     (mutation check 2);
//   · "A RETRY MID-REFUND converges" — a crash after the first writes leaves
//     the partial store only the non-atomic stand-in can produce, and the
//     second pass lands the SAME final store a clean pass does;
//   · "each trigger" — voided, expired, deleted, admin — through `refundPool`
//     directly and through `settlePool`'s routing;
//   · "nothing tournament-shaped is written" — the write log by prefix.
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
import { makeVersionedDb } from './__fixtures__/versionedFirestore.js';
import {
  BackingSettlementError,
  HOLD_REASON,
  REFUND_REASON,
  SETTLEMENT_MAX_STAKES,
  SETTLEMENT_REASON,
  SETTLEMENT_SOURCE,
  refundPool,
  refundReasonForGroup,
  settlePool,
} from './backingSettlement.js';
import {
  BACKING_POOLS_COLLECTION,
  BACKING_STAKES_COLLECTION,
  POOL_STATUS,
  STAKE_STATUS,
  VOID_REASONS,
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
// Battle Monday 2026-09-28 → backing week 2026-W40; the ladder's month for a
// pod that banked day 1 is 2026-09 — and so is the pool's battle-Monday month,
// the fallback for a pod that never banked (`monthKeyForPool`).
const GROUP_ID = 'grp-refund-1';
const WEEK = '2026-W40';
const MONDAY = '2026-09-28';
const MONTH = '2026-09';
const CLOSE_ISO = '2026-09-28T03:59:59.000Z';
const NOW = new Date('2026-09-29T20:30:00.000Z');   // Tuesday 16:30 ET — an in-week void
const NOW_ISO = NOW.toISOString();
const DAYS = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02'];
const MEMBERS = ['od-a', 'od-b', 'cpu-1', 'cpu-2'];
const PLAYERS = [
  { odUserId: 'od-a', picks: [] },
  { odUserId: 'od-b', picks: [] },
  { odUserId: 'cpu-1', isCpu: true, picks: [] },
  { odUserId: 'cpu-2', isCpu: true, picks: [] },
];
const SCORES = {
  'od-a': { user: 60, agent: 30 },
  'od-b': { user: 40, agent: 20 },
  'cpu-1': { user: 20, agent: 10 },
  'cpu-2': { user: 10, agent: 5 },
};

/** `days` banked days whose FINAL snapshot is `finalByUser`. */
function bankedWeek(finalByUser, { days = 5, dates = DAYS } = {}) {
  const dailyScores = {};
  for (let i = 0; i < days; i += 1) {
    const closeScores = {};
    for (const [id, v] of Object.entries(finalByUser)) {
      const scale = (i + 1) / days;
      const user = i === days - 1 ? v.user : Math.round(v.user * scale);
      const agent = i === days - 1 ? v.agent : Math.round(v.agent * scale);
      closeScores[id] = { totalPoints: user, agentPoints: agent, compositePoints: round2(agent + 1.5 * user), picks: [] };
    }
    dailyScores[`day${i + 1}`] = { recordedDate: dates[i], closeScores };
  }
  return dailyScores;
}

const groupDoc = (over = {}) => ({
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
/** A pod VOIDED on Tuesday, one day banked (L-A: voided is reachable only from battle). */
const voidedGroup = (over = {}) => groupDoc({ status: GROUP_STATUS.VOIDED, dailyScores: bankedWeek(SCORES, { days: 1 }), ...over });
/** A pod that EXPIRED before ever battling (from forming) — nothing banked. */
const expiredGroup = (over = {}) => groupDoc({ status: GROUP_STATUS.EXPIRED, dailyScores: {}, ...over });

const stake = (id, userId, teamOdUserId, amount = 100, over = {}) => ([
  `${BACKING_STAKES_COLLECTION}/${id}`,
  {
    userId, groupId: GROUP_ID, teamOdUserId, amount,
    hashAtStake: null, placedAt: '2026-09-23T14:00:00.000Z',
    weekKey: WEEK, requestId: `req-${id}`, status: STAKE_STATUS.LIVE, ...over,
  },
]);
/** Four live stakes, three backers, two teams; u1 holds TWO (the wallet threading case). Pot 700. */
const STAKES = () => [
  stake('s1', 'u1', 'od-a', 300),
  stake('s2', 'u2', 'od-b', 200),
  stake('s3', 'u3', 'od-b', 100),
  stake('s4', 'u1', 'od-b', 100),
];

/** A CLOSED pool in the shape closePool writes. */
function closedPool(stakes, group, over = {}) {
  const totals = totalsFromStakes(stakes.map(([, s]) => s));
  const seats = (group.players ?? []).map((p) => ({ odUserId: p.odUserId, isCpu: p.isCpu === true }));
  return {
    pool: {
      groupId: group.id, status: POOL_STATUS.CLOSED, formationPath: 'lobby', slotId: null,
      battleMondayEtDate: MONDAY, backingWeekStart: '2026-09-21T04:00:00.000Z',
      opensAt: '2026-09-22T14:00:00.000Z', closesAt: CLOSE_ISO, closeReason: 'clock',
      baseLayerWeek: WEEK, isDev: group.isDev === true,
      teams: seats.map((t) => ({
        odUserId: t.odUserId, isCpu: t.isCpu,
        stakeTotal: totals.byTeam[t.odUserId]?.stakeTotal ?? 0,
        backerCount: totals.byTeam[t.odUserId]?.backerCount ?? 0,
      })),
      humanTeams: seats.filter((t) => !t.isCpu).length,
      potTotal: totals.private.potTotal, uniqueBackers: totals.private.uniqueBackers, teamsBacked: totals.private.teamsBacked,
      closedAt: '2026-09-28T04:00:00.000Z', createdAt: '2026-09-22T14:00:00.000Z', updatedAt: '2026-09-28T04:00:00.000Z',
      ...over,
    },
    totals: { ...totals.private, updatedAt: '2026-09-28T04:00:00.000Z' },
  };
}

/** A wallet granted this week that placed `stakes` (careerNet = −Σ, no season bucket yet). */
function walletFor(uid, stakes) {
  const mine = stakes.filter(([, s]) => s.userId === uid);
  const spent = mine.reduce((sum, [, s]) => sum + s.amount, 0);
  return {
    lastAllowanceWeek: WEEK, allowanceRemaining: 1000 - spent, careerNet: -spent, seasons: {},
    appliedEntries: {
      [`allowance:${WEEK}`]: '2026-09-22T14:00:00.000Z',
      ...Object.fromEntries(mine.map(([path]) => [`stake:${path.split('/').pop()}`, '2026-09-23T14:00:00.000Z'])),
    },
    createdAt: '2026-09-22T14:00:00.000Z', updatedAt: '2026-09-23T14:00:00.000Z',
  };
}

/** The whole world for one pod, as a plain initial-store map. `group: null` means the doc is GONE. */
function world({ stakes = STAKES(), group = voidedGroup(), poolOver = {}, extra = {}, withGroup = true } = {}) {
  const g = group ?? voidedGroup();
  const dev = g.isDev === true;
  const poolId = dev ? `dev-${GROUP_ID}` : GROUP_ID;
  const { pool, totals } = closedPool(stakes, g, poolOver);
  const initial = {
    [`${BACKING_POOLS_COLLECTION}/${poolId}`]: pool,
    [`${BACKING_POOLS_COLLECTION}/${poolId}/private/totals`]: totals,
    ...extra,
  };
  if (withGroup && group != null) initial[`tournamentGroups/${g.id}`] = (({ id, ...data }) => data)(g);
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
const refund = (db, over = {}) => refundPool(db, GROUP_ID, { now: NOW, source: SETTLEMENT_SOURCE.SETTLE_ON_READ, reason: VOID_REASONS.GROUP_VOIDED, ...over });
const settle = (db, over = {}) => settlePool(db, GROUP_ID, { now: NOW, source: SETTLEMENT_SOURCE.SETTLE_ON_READ, ...over });
const BACKING_PREFIXES = ['backingPools/', 'backingStakes/', 'backingWallets/'];
const STAKE_IDS = ['s1', 's2', 's3', 's4'];
const UIDS = ['u1', 'u2', 'u3'];

/** Every store entry the backing layer can touch, as a comparable snapshot. */
function backingSnapshot(store) {
  const out = {};
  for (const [path, data] of [...store.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    if (BACKING_PREFIXES.some((p) => path.startsWith(p))) out[path] = data;
  }
  return out;
}

/** The score-neutrality claim, asserted on every backer at once. */
function expectEveryStakeNetsToZero(store, { voidReason, stakes = STAKES() }) {
  for (const [path, s] of stakes) {
    const id = path.split('/').pop();
    expect(stakeOf(store, id), id).toMatchObject({ status: STAKE_STATUS.VOIDED, voidReason, voidedAt: NOW_ISO });
    expect(entryOf(store, s.userId, `${ENTRY_TYPES.REFUND}:${id}`), `refund entry ${id}`).toMatchObject({ type: ENTRY_TYPES.REFUND, delta: s.amount, groupId: GROUP_ID, monthKey: MONTH, at: NOW_ISO });
    expect(entryOf(store, s.userId, `${ENTRY_TYPES.LOSS}:${id}`), `loss entry ${id}`).toMatchObject({ type: ENTRY_TYPES.LOSS, delta: -s.amount, groupId: GROUP_ID, monthKey: MONTH, at: NOW_ISO });
  }
  for (const uid of new Set(stakes.map(([, s]) => s.userId))) {
    const w = walletOf(store, uid);
    // The stake debited careerNet when placed; the refund credits it back.
    expect(w.careerNet, `${uid} careerNet`).toBe(0);
    // The refund's credit and the stake side's attribution cancel in the month.
    expect(w.seasons[MONTH]?.net, `${uid} season net`).toBe(0);
    // Never spendable again — the week has closed (§2).
    expect(w.allowanceRemaining).toBe(walletFor(uid, stakes).allowanceRemaining);
    expect(w.lastAllowanceWeek).toBe(WEEK);
  }
}

// ============================ PURE ============================
describe('refundReasonForGroup — the ONE derivation of a group\'s own refund reason', () => {
  it('a missing doc, a voided group and an expired group each name their §7 reason; anything else is null', () => {
    expect(refundReasonForGroup(null)).toBe(VOID_REASONS.GROUP_DELETED);
    expect(refundReasonForGroup(undefined)).toBe(VOID_REASONS.GROUP_DELETED);
    expect(refundReasonForGroup(voidedGroup())).toBe(VOID_REASONS.GROUP_VOIDED);
    expect(refundReasonForGroup(expiredGroup())).toBe(VOID_REASONS.GROUP_EXPIRED);
    for (const status of [GROUP_STATUS.FORMING, GROUP_STATUS.DRAFTING, GROUP_STATUS.AWAITING_OPEN, GROUP_STATUS.BATTLE, GROUP_STATUS.COMPLETE]) {
      expect(refundReasonForGroup(groupDoc({ status })), status).toBeNull();
    }
  });
});

// ============================ EACH TRIGGER ============================
describe('refundPool — each §7 trigger voids every live stake with ITS reason', () => {
  it('a VOIDED group: every live stake → voided group_voided; the pool → refunded with the reason, the instant, the host and the ladder month', async () => {
    const { db, store, writeLog } = seed();
    const out = await refund(db);
    expect(out).toMatchObject({ refunded: true, refundReason: VOID_REASONS.GROUP_VOIDED, stakesVoided: 4, priorVoided: 0 });
    expect(poolOf(store)).toMatchObject({
      status: POOL_STATUS.REFUNDED, refundReason: VOID_REASONS.GROUP_VOIDED, refundedAt: NOW_ISO,
      refundRef: SETTLEMENT_SOURCE.SETTLE_ON_READ, monthKey: MONTH, stakesVoided: 4, updatedAt: NOW_ISO,
    });
    // The close's reveal is untouched — the record of the book stays.
    expect(poolOf(store)).toMatchObject({ potTotal: 700, uniqueBackers: 3, teamsBacked: 2, closedAt: '2026-09-28T04:00:00.000Z' });
    expectEveryStakeNetsToZero(store, { voidReason: VOID_REASONS.GROUP_VOIDED });
    // 4 stake docs + 4 × (2 entries + 2 wallet re-sets) + the pool = 21 writes, all backing paths.
    expect(writeLog).toHaveLength(21);
    expect(writeLog.every(([, p]) => BACKING_PREFIXES.some((x) => p.startsWith(x)))).toBe(true);
  });

  it('an EXPIRED group (never banked): group_expired, the month from the pool\'s battle Monday', async () => {
    const { db, store } = seed({ group: expiredGroup() });
    const out = await refund(db, { reason: VOID_REASONS.GROUP_EXPIRED });
    expect(out).toMatchObject({ refunded: true, refundReason: VOID_REASONS.GROUP_EXPIRED });
    expect(poolOf(store)).toMatchObject({ status: POOL_STATUS.REFUNDED, refundReason: VOID_REASONS.GROUP_EXPIRED, monthKey: MONTH });
    expectEveryStakeNetsToZero(store, { voidReason: VOID_REASONS.GROUP_EXPIRED });
  });

  it('a DELETED group doc over a pool that had already closed: group_deleted, the pool found by probing the production namespace first', async () => {
    const { db, store, readLog } = seed({ withGroup: false });
    const out = await refund(db, { reason: VOID_REASONS.GROUP_DELETED });
    expect(out).toMatchObject({ refunded: true, refundReason: VOID_REASONS.GROUP_DELETED });
    expect(poolOf(store).status).toBe(POOL_STATUS.REFUNDED);
    expectEveryStakeNetsToZero(store, { voidReason: VOID_REASONS.GROUP_DELETED });
    // The production id was probed and found; the dev namespace was never read.
    expect(readLog.some(([, p]) => p === `${BACKING_POOLS_COLLECTION}/dev-${GROUP_ID}`)).toBe(false);
  });

  it('a DELETED group doc over a DEV pool: found in the dev namespace, refunded to the dev wallets', async () => {
    const dev = voidedGroup({ isDev: true });
    const { db, store } = makeInMemoryDb(world({ group: dev, withGroup: false }));
    const out = await refund(db, { reason: VOID_REASONS.GROUP_DELETED });
    expect(out).toMatchObject({ refunded: true, refundReason: VOID_REASONS.GROUP_DELETED });
    expect(poolOf(store, `dev-${GROUP_ID}`).status).toBe(POOL_STATUS.REFUNDED);
    expect(walletOf(store, 'dev-u1')).toMatchObject({ careerNet: 0, seasons: { [MONTH]: { net: 0 } } });
    expect(walletOf(store, 'u1')).toBeUndefined();
  });

  it('the caller\'s reason is a NAME for the path, the group\'s fresh state is the truth: asked group_voided of an EXPIRED group, the stakes carry group_expired', async () => {
    const { db, store } = seed({ group: expiredGroup() });
    const out = await refund(db, { reason: VOID_REASONS.GROUP_VOIDED });
    expect(out).toMatchObject({ refunded: true, refundReason: VOID_REASONS.GROUP_EXPIRED });
    expect(stakeOf(store, 's1').voidReason).toBe(VOID_REASONS.GROUP_EXPIRED);
  });

  it('ADMIN: refunds a closed pool whatever the group\'s state (a complete pod that never settled), voidReason admin; the note is LOGGED and never on the pool', async () => {
    const { db, store } = seed({ group: groupDoc() });
    const note = 'holiday week never completed — refund by founder decision';
    const out = await refund(db, { reason: VOID_REASONS.ADMIN, source: SETTLEMENT_SOURCE.ADMIN, actor: 'admin', note });
    expect(out).toMatchObject({ refunded: true, refundReason: VOID_REASONS.ADMIN, stakesVoided: 4 });
    expect(poolOf(store)).toMatchObject({ status: POOL_STATUS.REFUNDED, refundReason: VOID_REASONS.ADMIN, refundRef: SETTLEMENT_SOURCE.ADMIN });
    expectEveryStakeNetsToZero(store, { voidReason: VOID_REASONS.ADMIN });
    expect(JSON.stringify(poolOf(store))).not.toContain('founder decision');
    for (const id of STAKE_IDS) expect(JSON.stringify(stakeOf(store, id))).not.toContain('founder decision');
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining(note));
  });
});

// ============================ THE NET-BP SUM ============================
describe('THE NET-BP SUM — every refunded stake nets to ZERO in careerNet AND the season bucket (§2, §B7.2)', () => {
  it('pairs creditRefund with recordStakeLoss for EVERY voided stake, threading the wallet across a backer\'s two stakes', async () => {
    const { db, store } = seed();
    await refund(db);
    // MUTATION CHECK 1: skip `recordStakeLoss` in the refund → the season
    // bucket reads +400 / +200 / +100 and this row reds.
    expect(walletOf(store, 'u1')).toMatchObject({ careerNet: 0, seasons: { [MONTH]: { net: 0 } } });
    expect(walletOf(store, 'u2')).toMatchObject({ careerNet: 0, seasons: { [MONTH]: { net: 0 } } });
    expect(walletOf(store, 'u3')).toMatchObject({ careerNet: 0, seasons: { [MONTH]: { net: 0 } } });
    // Both halves of both of u1's pairs are on the ledger, once each.
    for (const id of ['s1', 's4']) {
      expect(entryOf(store, 'u1', `refund:${id}`).delta).toBe(stakeOf(store, id).amount);
      expect(entryOf(store, 'u1', `loss:${id}`).delta).toBe(-stakeOf(store, id).amount);
      expect(walletOf(store, 'u1').appliedEntries).toHaveProperty(`refund:${id}`);
      expect(walletOf(store, 'u1').appliedEntries).toHaveProperty(`loss:${id}`);
    }
    // Σ over the whole book: every refund is matched by a loss of the same size.
    let sum = 0;
    for (const [path, s] of STAKES()) {
      const id = path.split('/').pop();
      sum += entryOf(store, s.userId, `refund:${id}`).delta + entryOf(store, s.userId, `loss:${id}`).delta;
    }
    expect(sum).toBe(0);
  });

  it('a backer with a prior season record keeps it: the pair moves the bucket by exactly zero', async () => {
    const initial = world();
    initial[`${BACKING_WALLETS_COLLECTION}/u2`].seasons = { [MONTH]: { net: 150 }, '2026-08': { net: -20 } };
    initial[`${BACKING_WALLETS_COLLECTION}/u2`].careerNet = -200 + 130;
    const { db, store } = makeInMemoryDb(initial);
    await refund(db);
    expect(walletOf(store, 'u2').seasons).toEqual({ [MONTH]: { net: 150 }, '2026-08': { net: -20 } });
    expect(walletOf(store, 'u2').careerNet).toBe(130);
  });
});

// ============================ THE GATE ============================
describe('refundPool — allowed from `closed` or `resolving` only; everything else writes nothing', () => {
  const arms = [
    ['an OPEN pool (the clock closes it first)', { status: POOL_STATUS.OPEN }, REFUND_REASON.POOL_OPEN],
    ['a RESOLVED pool', { status: POOL_STATUS.RESOLVED }, REFUND_REASON.ALREADY_SETTLED],
    ['a REFUNDED pool (idempotent)', { status: POOL_STATUS.REFUNDED, refundReason: VOID_REASONS.GROUP_VOIDED }, REFUND_REASON.ALREADY_REFUNDED],
    ['an INSUFFICIENT pool (every stake already voided at close)', { status: POOL_STATUS.INSUFFICIENT }, REFUND_REASON.TERMINAL],
    ['a pool HELD in resolving without fromHold', { status: POOL_STATUS.RESOLVING, holdReason: HOLD_REASON.AGENT_LAYER_ABSENT }, REFUND_REASON.HELD],
  ];
  for (const [label, poolOver, reason] of arms) {
    it(`${label} → ${reason}, no write`, async () => {
      const { db, writeLog, store } = seed({ poolOver });
      const before = JSON.stringify(backingSnapshot(store));
      expect(await refund(db)).toMatchObject({ refunded: false, reason });
      expect(writeLog).toEqual([]);
      expect(JSON.stringify(backingSnapshot(store))).toBe(before);
      for (const id of STAKE_IDS) expect(stakeOf(store, id).status).toBe(STAKE_STATUS.LIVE);
    });
  }

  it('a pool HELD in resolving IS refunded with fromHold (the admin\'s act): the hold is released and recorded, the free text is not', async () => {
    const { db, store } = seed({ poolOver: { status: POOL_STATUS.RESOLVING, holdReason: HOLD_REASON.AGENT_LAYER_ABSENT, heldAt: '2026-10-02T22:00:00.000Z', holdSource: SETTLEMENT_SOURCE.FRIDAY_DUTY, liveStakesAtHold: 4 } });
    const out = await refund(db, { fromHold: true, reason: VOID_REASONS.ADMIN, source: SETTLEMENT_SOURCE.ADMIN, actor: 'admin', note: 'agent layer confirmed absent; the week is void' });
    expect(out).toMatchObject({ refunded: true, refundReason: VOID_REASONS.ADMIN });
    expect(poolOf(store)).toMatchObject({ status: POOL_STATUS.REFUNDED, holdRelease: { by: 'admin', at: NOW_ISO, priorHoldReason: HOLD_REASON.AGENT_LAYER_ABSENT } });
    expect(poolOf(store)).not.toHaveProperty('holdReason');
    expect(poolOf(store)).not.toHaveProperty('heldAt');
    expect(poolOf(store)).not.toHaveProperty('holdSource');
    expect(JSON.stringify(poolOf(store))).not.toContain('confirmed absent');
    expectEveryStakeNetsToZero(store, { voidReason: VOID_REASONS.ADMIN });
  });

  it('a group that is NOT terminal on the fresh read is `not_terminal` for the group paths — a caller\'s belief refunds nothing', async () => {
    for (const status of [GROUP_STATUS.BATTLE, GROUP_STATUS.COMPLETE, GROUP_STATUS.FORMING]) {
      const { db, writeLog } = seed({ group: groupDoc({ status, dailyScores: {} }) });
      expect(await refund(db, { reason: VOID_REASONS.GROUP_VOIDED })).toMatchObject({ refunded: false, reason: REFUND_REASON.NOT_TERMINAL, groupStatus: status });
      expect(writeLog).toEqual([]);
    }
  });

  it('THE FRESH READ DECIDES (the H4 analogue): a direct read saying `voided` while the TRANSACTIONAL read says `battle` refunds NOTHING', async () => {
    const { db, store, writeLog } = seed({ group: groupDoc({ status: GROUP_STATUS.BATTLE, dailyScores: bankedWeek(SCORES, { days: 1 }) }) });
    const real = db.collection;
    db.collection = (name) => {
      const col = real(name);
      if (name !== 'tournamentGroups') return col;
      return {
        ...col,
        doc: (id) => {
          const ref = col.doc(id);
          return { ...ref, get: async () => ({ exists: true, id, data: () => ({ ...store.get(`tournamentGroups/${id}`), status: GROUP_STATUS.VOIDED }) }) };
        },
      };
    };
    expect(await refund(db)).toMatchObject({ refunded: false, reason: REFUND_REASON.NOT_TERMINAL, groupStatus: GROUP_STATUS.BATTLE });
    expect(writeLog).toEqual([]);
    expect(poolOf(store).status).toBe(POOL_STATUS.CLOSED);
  });

  it('no pool at all → no_pool, no write; argument refusals are typed', async () => {
    const { db, writeLog } = makeInMemoryDb({ [`tournamentGroups/${GROUP_ID}`]: voidedGroup() });
    expect(await refund(db)).toEqual({ refunded: false, reason: REFUND_REASON.NO_POOL });
    expect(writeLog).toEqual([]);
    const { db: db2 } = seed();
    await expect(refundPool(db2, GROUP_ID, { source: SETTLEMENT_SOURCE.ADMIN, reason: 'seat_left', now: NOW })).rejects.toThrow(BackingSettlementError);
    await expect(refundPool(db2, GROUP_ID, { source: SETTLEMENT_SOURCE.ADMIN, reason: 'insufficient', now: NOW })).rejects.toThrow(/reason/);
    await expect(refundPool(db2, GROUP_ID, { source: 'bogus', reason: VOID_REASONS.ADMIN, now: NOW })).rejects.toThrow(/source/);
    await expect(refundPool(db2, GROUP_ID, { source: SETTLEMENT_SOURCE.ADMIN, reason: VOID_REASONS.ADMIN, now: NOW, fromHold: 'yes' })).rejects.toThrow(/fromHold/);
    await expect(refundPool(db2, '', { source: SETTLEMENT_SOURCE.ADMIN, reason: VOID_REASONS.ADMIN, now: NOW })).rejects.toThrow(/groupId/);
  });
});

// ============================ THE RACE ============================
describe('A REFUND RACING A SETTLEMENT — exactly one wins, decided on the IN-TRANSACTION status (H5 for the refund)', () => {
  /** The invariant every interleaving must satisfy. */
  function expectExactlyOneOutcome(store) {
    const pool = poolOf(store);
    const settled = pool.status === POOL_STATUS.RESOLVED;
    const refunded = pool.status === POOL_STATUS.REFUNDED;
    expect(settled !== refunded, `pool is ${pool.status}`).toBe(true);
    for (const id of STAKE_IDS) {
      const s = stakeOf(store, id);
      if (settled) expect([STAKE_STATUS.WON, STAKE_STATUS.LOST], id).toContain(s.status);
      else expect(s, id).toMatchObject({ status: STAKE_STATUS.VOIDED, voidReason: VOID_REASONS.ADMIN });
    }
    for (const uid of UIDS) {
      const w = walletOf(store, uid);
      const hasRefund = Object.keys(w.appliedEntries).some((k) => k.startsWith('refund:'));
      const hasPayout = Object.keys(w.appliedEntries).some((k) => k.startsWith('payout:'));
      // Never both a payout and a refund on one wallet.
      expect(hasRefund && hasPayout, `${uid} carries both`).toBe(false);
      if (settled) {
        expect(hasRefund, `${uid} refunded in a settled pool`).toBe(false);
        // od-a wins (u1's 300 at 700/300); u2 and u3 lose; u1's od-b stake loses.
        expect(w.careerNet).toBe(uid === 'u1' ? -400 + 700 : uid === 'u2' ? -200 : -100);
      } else {
        expect(hasPayout, `${uid} paid in a refunded pool`).toBe(false);
        expect(w.careerNet).toBe(0);
        expect(w.seasons[MONTH].net).toBe(0);
      }
    }
    return settled ? 'settled' : 'refunded';
  }

  it('concurrently: the pool is resolved XOR refunded, the stakes decided XOR voided, no wallet carries both, and the loser conflicted', async () => {
    const { db, store, stats, writeLog } = makeVersionedDb(world({ group: groupDoc() }));
    const [s, r] = await Promise.all([
      settlePool(db, GROUP_ID, { now: NOW, source: SETTLEMENT_SOURCE.ADMIN }),
      refundPool(db, GROUP_ID, { now: NOW, source: SETTLEMENT_SOURCE.ADMIN, reason: VOID_REASONS.ADMIN, note: 'race' }),
    ]);
    // On this harness the REFUND commits first (fewer reads before its
    // commit), so this row exercises the SETTLEMENT's in-transaction gate:
    // removing it makes the settlement re-run over the refunded pool and pay
    // out beside `voided` stakes — the XOR reds. MUTATION CHECK 2 (the
    // REFUND's gate) is carried by the two rows below — "the SETTLEMENT lands
    // between the refund's read and its commit" and "TWO refunds racing" —
    // which red when that gate is removed (MONEY-1, the PR 5 review record).
    expect((s.settled === true) !== (r.refunded === true)).toBe(true);
    const outcome = expectExactlyOneOutcome(store);
    if (outcome === 'settled') expect(r).toMatchObject({ refunded: false, reason: REFUND_REASON.ALREADY_SETTLED });
    else expect(s).toMatchObject({ settled: false, reason: SETTLEMENT_REASON.TERMINAL, status: POOL_STATUS.REFUNDED });
    expect(stats.conflicts).toBeGreaterThanOrEqual(1);
    // ONE writer reached the pool document; the loser's re-run committed nothing
    // (an empty commit is still counted by the harness — the write log is the fact).
    expect(writeLog.filter(([, p]) => p === `${BACKING_POOLS_COLLECTION}/${GROUP_ID}`)).toHaveLength(1);
  });

  it('the SETTLEMENT lands between the refund\'s read and its commit: the refund re-runs, sees `resolved`, pays back nothing', async () => {
    let landed = false;
    const { db, store, stats } = makeVersionedDb(world({ group: groupDoc() }), {
      beforeCommit: async ({ attempt, commitWrites }) => {
        if (attempt !== 1 || landed) return;
        landed = true;
        // A settlement committed by another host, in the gap.
        const pool = store.get(`${BACKING_POOLS_COLLECTION}/${GROUP_ID}`);
        commitWrites([
          [`${BACKING_POOLS_COLLECTION}/${GROUP_ID}`, { ...pool, status: POOL_STATUS.RESOLVED, winnerOdUserIds: ['od-a'], settledAt: NOW_ISO }],
          ...STAKE_IDS.map((id) => [`${BACKING_STAKES_COLLECTION}/${id}`, { ...store.get(`${BACKING_STAKES_COLLECTION}/${id}`), status: id === 's1' ? STAKE_STATUS.WON : STAKE_STATUS.LOST, payout: id === 's1' ? 700 : 0, settledAt: NOW_ISO }]),
        ]);
      },
    });
    const out = await refundPool(db, GROUP_ID, { now: NOW, source: SETTLEMENT_SOURCE.ADMIN, reason: VOID_REASONS.ADMIN, note: 'race' });
    expect(out).toMatchObject({ refunded: false, reason: REFUND_REASON.ALREADY_SETTLED });
    expect(stats).toMatchObject({ conflicts: 1, commits: 1 });
    expect(poolOf(store).status).toBe(POOL_STATUS.RESOLVED);
    expect(stakeOf(store, 's1')).toMatchObject({ status: STAKE_STATUS.WON, payout: 700 });
    for (const uid of UIDS) expect(Object.keys(walletOf(store, uid).appliedEntries).some((k) => k.startsWith('refund:'))).toBe(false);
  });

  it('the REFUND lands between the settlement\'s read and its commit: the settlement re-runs, sees `refunded`, pays nothing', async () => {
    let landed = false;
    const { db, store, stats } = makeVersionedDb(world({ group: groupDoc() }), {
      beforeCommit: async ({ attempt, commitWrites }) => {
        if (attempt !== 1 || landed) return;
        landed = true;
        const pool = store.get(`${BACKING_POOLS_COLLECTION}/${GROUP_ID}`);
        commitWrites([
          [`${BACKING_POOLS_COLLECTION}/${GROUP_ID}`, { ...pool, status: POOL_STATUS.REFUNDED, refundReason: VOID_REASONS.ADMIN, refundedAt: NOW_ISO }],
          ...STAKE_IDS.map((id) => [`${BACKING_STAKES_COLLECTION}/${id}`, { ...store.get(`${BACKING_STAKES_COLLECTION}/${id}`), status: STAKE_STATUS.VOIDED, voidReason: VOID_REASONS.ADMIN, voidedAt: NOW_ISO }]),
        ]);
      },
    });
    const out = await settlePool(db, GROUP_ID, { now: NOW, source: SETTLEMENT_SOURCE.ADMIN });
    expect(out).toMatchObject({ settled: false, reason: SETTLEMENT_REASON.TERMINAL, status: POOL_STATUS.REFUNDED });
    expect(stats).toMatchObject({ conflicts: 1, commits: 1 });
    expect(poolOf(store).status).toBe(POOL_STATUS.REFUNDED);
    for (const uid of UIDS) expect(Object.keys(walletOf(store, uid).appliedEntries).some((k) => k.startsWith('payout:'))).toBe(false);
  });

  it('TWO refunds racing: one voids, the other answers already_refunded — no stake is refunded twice', async () => {
    const { db, store, stats, writeLog } = makeVersionedDb(world());
    const [a, b] = await Promise.all([refund(db), refund(db, { source: SETTLEMENT_SOURCE.ADMIN })]);
    expect([a.refunded, b.refunded].filter(Boolean)).toHaveLength(1);
    expect([a, b].find((x) => !x.refunded)).toMatchObject({ reason: REFUND_REASON.ALREADY_REFUNDED });
    expect(stats.conflicts).toBeGreaterThanOrEqual(1);
    expect(writeLog.filter(([, p]) => p === `${BACKING_POOLS_COLLECTION}/${GROUP_ID}`)).toHaveLength(1);
    expect(writeLog.filter(([, p]) => p === `${BACKING_STAKES_COLLECTION}/s1`)).toHaveLength(1);
    for (const uid of UIDS) {
      const w = walletOf(store, uid);
      expect(w.careerNet).toBe(0);
      expect(w.seasons[MONTH].net).toBe(0);
    }
    // Every refund entry exists exactly once (deterministic ids; one commit).
    for (const [path, s] of STAKES()) {
      expect(entryOf(store, s.userId, `refund:${path.split('/').pop()}`).delta).toBe(s.amount);
    }
  });

  it('the SDK RETRY: the body re-runs on ONE transaction object after a conflict and still nets every stake to zero (the wallet memo is reset by the re-read)', async () => {
    let bumped = false;
    const { db, store, stats } = makeVersionedDb(world(), {
      beforeCommit: ({ attempt, commitWrites }) => {
        if (attempt !== 1 || bumped) return;
        bumped = true;
        // An unrelated bump of a wallet the refund read (a concurrent allowance touch) — a real conflict.
        const w = store.get(`${BACKING_WALLETS_COLLECTION}/u2`);
        commitWrites([[`${BACKING_WALLETS_COLLECTION}/u2`, { ...w, updatedAt: '2026-09-29T20:29:00.000Z' }]]);
      },
    });
    const out = await refund(db);
    expect(out).toMatchObject({ refunded: true, stakesVoided: 4 });
    expect(stats).toMatchObject({ attempts: 2, conflicts: 1, commits: 1 });
    expectEveryStakeNetsToZero(store, { voidReason: VOID_REASONS.GROUP_VOIDED });
  });
});

// ============================ THE RETRY ============================
describe('A RETRY MID-REFUND converges (idempotent at every grain)', () => {
  it('a crash after ANY write leaves a partial store; the second pass lands the SAME final store a clean pass does — EVERY position (MONEY-2: one position could not see a one-stake backer\'s partial pair)', async () => {
    const clean = seed();
    await refund(clean.db);
    const expected = backingSnapshot(clean.store);

    // 4 stakes × 5 writes (the stake, the refund entry, the wallet, the loss
    // entry, the wallet) + the pool, written last. The in-memory stand-in
    // applies writes as they are issued, so a throw on the Nth write leaves a
    // PARTIAL store at every grain the refund has: a stake voided with no
    // entry, an entry with the wallet unmoved (a one-stake backer's included,
    // at the 8th write), a pair applied with the pool still `closed`.
    const total = 4 * 5 + 1;
    for (let failAt = 1; failAt <= total; failAt += 1) {
      const crashed = seed();
      const realRun = crashed.db.runTransaction;
      let sets = 0;
      crashed.db.runTransaction = (fn) => realRun((tx) => fn({
        ...tx,
        set: (ref, data) => { sets += 1; if (sets === failAt) throw new Error(`crash at write ${failAt}`); return tx.set(ref, data); },
      }));
      await expect(refund(crashed.db)).rejects.toThrow(`crash at write ${failAt}`);
      expect(poolOf(crashed.store).status, `the pool write is last: untouched after a crash at ${failAt}`).toBe(POOL_STATUS.CLOSED);
      if (failAt === 3) {
        // The partial store the original one-position row pinned: s1 voided,
        // its refund entry written, its wallet NOT yet moved.
        expect(stakeOf(crashed.store, 's1').status).toBe(STAKE_STATUS.VOIDED);
        expect(walletOf(crashed.store, 'u1').careerNet).toBe(-400);
      }
      if (failAt === 8) {
        // MONEY-2's position: s2 voided with its refund entry landed and u2's
        // wallet — a backer with NO other live stake — unmoved; only the
        // prior-stake wallet read can carry it to zero.
        expect(stakeOf(crashed.store, 's2').status).toBe(STAKE_STATUS.VOIDED);
        expect(walletOf(crashed.store, 'u2').careerNet).toBe(-200);
      }

      crashed.db.runTransaction = realRun;
      const out = await refund(crashed.db);
      expect(out.refunded, `re-run after a crash at ${failAt}`).toBe(true);
      expect(out.stakesVoided + out.priorVoided, `every stake accounted for after a crash at ${failAt}`).toBe(4);
      expect(backingSnapshot(crashed.store), `state after a crash at ${failAt}`).toEqual(expected);
      expectEveryStakeNetsToZero(crashed.store, { voidReason: VOID_REASONS.GROUP_VOIDED });
    }
  });

  it('MONEY-5 — a week straddling a month (Memorial Day Monday 2027-05-31; day 1 banks 2027-06-01): a voided pod refunds into 2027-06, an expired one into 2027-05; each pair nets zero in ITS bucket and the pool carries the same key', async () => {
    const MON = '2027-05-31';
    const dates = ['2027-06-01', '2027-06-02', '2027-06-03', '2027-06-04', '2027-06-05'];
    const v = seed({ group: voidedGroup({ dailyScores: bankedWeek(SCORES, { days: 1, dates }) }), poolOver: { battleMondayEtDate: MON } });
    await settlePool(v.db, GROUP_ID, { now: NOW, source: SETTLEMENT_SOURCE.SETTLE_ON_READ });
    expect(poolOf(v.store)).toMatchObject({ status: POOL_STATUS.REFUNDED, monthKey: '2027-06' });
    for (const uid of ['u1', 'u2', 'u3']) {
      expect(walletOf(v.store, uid).careerNet).toBe(0);
      expect(walletOf(v.store, uid).seasons, `${uid}: the ladder month is the first BANKED day's`).toEqual({ '2027-06': { net: 0 } });
    }
    const e = seed({ group: expiredGroup(), poolOver: { battleMondayEtDate: MON } });
    await settlePool(e.db, GROUP_ID, { now: NOW, source: SETTLEMENT_SOURCE.SETTLE_ON_READ });
    expect(poolOf(e.store)).toMatchObject({ status: POOL_STATUS.REFUNDED, monthKey: '2027-05' });
    for (const uid of ['u1', 'u2', 'u3']) expect(walletOf(e.store, uid).seasons, `${uid}: nothing banked → the pool's Monday`).toEqual({ '2027-05': { net: 0 } });
  });

  it('a second refund after a complete one is already_refunded and writes nothing', async () => {
    const { db, store, writeLog } = seed();
    await refund(db);
    const writes = writeLog.length;
    const before = JSON.stringify(backingSnapshot(store));
    expect(await refund(db)).toMatchObject({ refunded: false, reason: REFUND_REASON.ALREADY_REFUNDED });
    expect(writeLog.length).toBe(writes);
    expect(JSON.stringify(backingSnapshot(store))).toBe(before);
  });
});

// ============================ H2, H3, THE WALLET ============================
describe('the refund\'s belts', () => {
  it('writes ONLY backing collections — never tournamentGroups, tournamentRanks, leaderboards or orchestrator state (H2)', async () => {
    const { db, store, writeLog } = seed();
    const groupBefore = JSON.stringify(store.get(`tournamentGroups/${GROUP_ID}`));
    await refund(db);
    expect(writeLog.length).toBeGreaterThan(0);
    expect(writeLog.every(([, p]) => BACKING_PREFIXES.some((x) => p.startsWith(x)))).toBe(true);
    expect(writeLog.some(([, p]) => p.startsWith('tournament'))).toBe(false);
    expect(JSON.stringify(store.get(`tournamentGroups/${GROUP_ID}`))).toBe(groupBefore);
  });

  it('THE STAKE CEILING (H3): past SETTLEMENT_MAX_STAKES live stakes a closed pool is HELD resolving with stake_ceiling, no stake written', async () => {
    const many = Array.from({ length: SETTLEMENT_MAX_STAKES + 1 }, (_, i) => stake(`m${i}`, `b${i % 7}`, i % 2 ? 'od-a' : 'od-b', 50));
    const { db, store, writeLog } = seed({ stakes: many });
    const out = await refund(db);
    expect(out).toMatchObject({ refunded: false, reason: REFUND_REASON.STAKE_CEILING, holdReason: HOLD_REASON.STAKE_CEILING });
    expect(poolOf(store)).toMatchObject({ status: POOL_STATUS.RESOLVING, holdReason: HOLD_REASON.STAKE_CEILING, holdSource: SETTLEMENT_SOURCE.SETTLE_ON_READ, liveStakesAtHold: SETTLEMENT_MAX_STAKES + 1 });
    expect(writeLog).toEqual([['tx.set', `${BACKING_POOLS_COLLECTION}/${GROUP_ID}`]]);
    expect(stakeOf(store, 'm0').status).toBe(STAKE_STATUS.LIVE);
    // And a held pool over the ceiling re-holds without a write when asked again from the hold.
    const again = await refund(db, { fromHold: true, reason: VOID_REASONS.ADMIN, source: SETTLEMENT_SOURCE.ADMIN });
    expect(again).toMatchObject({ refunded: false, reason: REFUND_REASON.STAKE_CEILING });
    expect(writeLog).toHaveLength(1);
  });

  it('the WRITE projection holds too: 95 live stakes refund (1 + 95 × 5 = 476 ≤ 480); 96 hold', async () => {
    const stakesOf = (n) => Array.from({ length: n }, (_, i) => stake(`m${i}`, `b${i % 7}`, i % 2 ? 'od-a' : 'od-b', 50));
    const ok = seed({ stakes: stakesOf(95) });
    expect(await refund(ok.db)).toMatchObject({ refunded: true, stakesVoided: 95 });
    const over = seed({ stakes: stakesOf(96) });
    expect(await refund(over.db)).toMatchObject({ refunded: false, reason: REFUND_REASON.STAKE_CEILING });
  });

  it('a MISSING wallet aborts `wallet_missing` and writes nothing — never a record minted from nothing (finding 17\'s posture)', async () => {
    const initial = world();
    delete initial[`${BACKING_WALLETS_COLLECTION}/u3`];
    const { db, store, writeLog } = makeInMemoryDb(initial);
    await expect(refund(db)).rejects.toMatchObject({ code: 'wallet_missing' });
    expect(writeLog).toEqual([]);
    expect(poolOf(store).status).toBe(POOL_STATUS.CLOSED);
    expect(walletOf(store, 'u3')).toBeUndefined();
  });

  it('MONEY-3 — a `won` stake inside a CLOSED pool (out of band) is REFUSED as corrupt_book with zero writes: the refund never voids AROUND it and seals a recoverable book as refunded', async () => {
    const initial = world();
    initial[`${BACKING_STAKES_COLLECTION}/s1`] = { ...initial[`${BACKING_STAKES_COLLECTION}/s1`], status: STAKE_STATUS.WON, payout: 700 };
    const { db, store, writeLog } = makeInMemoryDb(initial);
    const out = await refund(db, { source: SETTLEMENT_SOURCE.ADMIN, reason: VOID_REASONS.ADMIN, note: 'by hand' });
    expect(out).toMatchObject({ refunded: false, reason: REFUND_REASON.CORRUPT_BOOK, stakeIds: ['s1'], status: POOL_STATUS.CLOSED });
    expect(writeLog).toEqual([]);
    expect(poolOf(store).status).toBe(POOL_STATUS.CLOSED);
    expect(stakeOf(store, 's1')).toMatchObject({ status: STAKE_STATUS.WON, payout: 700 });
    expect(stakeOf(store, 's2').status).toBe(STAKE_STATUS.LIVE);
    expect(walletOf(store, 'u1').careerNet).toBe(-400);
    // Repaired in the Console (the stake back to live), the same call refunds every stake.
    store.set(`${BACKING_STAKES_COLLECTION}/s1`, { ...stakeOf(store, 's1'), status: STAKE_STATUS.LIVE, payout: undefined });
    const again = await refund(db, { source: SETTLEMENT_SOURCE.ADMIN, reason: VOID_REASONS.ADMIN, note: 'by hand' });
    expect(again).toMatchObject({ refunded: true, stakesVoided: 4 });
    expectEveryStakeNetsToZero(store, { voidReason: VOID_REASONS.ADMIN });
  });

  it('MONEY-R-3 — a malformed stake amount is refused BEFORE the first write (the settlement\'s own posture), never part-way through the book', async () => {
    const initial = world();
    initial[`${BACKING_STAKES_COLLECTION}/s3`] = { ...initial[`${BACKING_STAKES_COLLECTION}/s3`], amount: 100.5 };
    const { db, store, writeLog } = makeInMemoryDb(initial);
    const out = await refund(db);
    expect(out).toMatchObject({ refunded: false, reason: REFUND_REASON.MALFORMED_STAKE, stakeIds: ['s3'] });
    expect(writeLog).toEqual([]);
    expect(poolOf(store).status).toBe(POOL_STATUS.CLOSED);
    for (const id of ['s1', 's2', 's3', 's4']) expect(stakeOf(store, id).status).toBe(STAKE_STATUS.LIVE);
  });
});

// ============================ settlePool ROUTES ============================
describe('settlePool routes a voided, expired or deleted pod to the refund (finding 21) — every host inherits it', () => {
  it('a VOIDED group with a closed pool: refunded group_voided through settlePool, never not_final, never paid', async () => {
    const { db, store } = seed();
    const out = await settle(db);
    expect(out).toMatchObject({ settled: false, refunded: true, reason: SETTLEMENT_REASON.REFUNDED, refundReason: VOID_REASONS.GROUP_VOIDED, stakesVoided: 4 });
    expect(out.pool).toMatchObject({ status: POOL_STATUS.REFUNDED, refundRef: SETTLEMENT_SOURCE.SETTLE_ON_READ });
    expectEveryStakeNetsToZero(store, { voidReason: VOID_REASONS.GROUP_VOIDED });
    for (const uid of UIDS) expect(Object.keys(walletOf(store, uid).appliedEntries).some((k) => k.startsWith('payout:'))).toBe(false);
  });

  it('an EXPIRED group with a closed pool: refunded group_expired', async () => {
    const { db, store } = seed({ group: expiredGroup() });
    expect(await settle(db)).toMatchObject({ settled: false, refunded: true, reason: SETTLEMENT_REASON.REFUNDED, refundReason: VOID_REASONS.GROUP_EXPIRED });
    expectEveryStakeNetsToZero(store, { voidReason: VOID_REASONS.GROUP_EXPIRED });
  });

  it('a DELETED group doc over a pool that had already CLOSED: refunded group_deleted (the close\'s tombstone path cannot reach a closed pool)', async () => {
    const { db, store } = seed({ withGroup: false });
    expect(await settle(db)).toMatchObject({ settled: false, refunded: true, reason: SETTLEMENT_REASON.REFUNDED, refundReason: VOID_REASONS.GROUP_DELETED });
    expectEveryStakeNetsToZero(store, { voidReason: VOID_REASONS.GROUP_DELETED });
  });

  it('a DELETED group doc over an OPEN pool: the close\'s own tombstone refund, answered as a refund', async () => {
    const { db, store } = seed({ withGroup: false, poolOver: { status: POOL_STATUS.OPEN, teams: undefined } });
    expect(await settle(db)).toMatchObject({ settled: false, refunded: true, reason: SETTLEMENT_REASON.REFUNDED, refundReason: VOID_REASONS.GROUP_DELETED });
    expect(poolOf(store).status).toBe(POOL_STATUS.REFUNDED);
    for (const id of STAKE_IDS) expect(stakeOf(store, id)).toMatchObject({ status: STAKE_STATUS.VOIDED, voidReason: VOID_REASONS.GROUP_DELETED });
  });

  it('a VOIDED group whose pool is still OPEN inside its window: pool_open, nothing written — the clock closes it, the next read refunds it', async () => {
    const { db, store, writeLog } = seed({ poolOver: { status: POOL_STATUS.OPEN, closesAt: '2099-01-01T00:00:00.000Z', teams: undefined } });
    expect(await settle(db)).toEqual({ settled: false, reason: SETTLEMENT_REASON.POOL_OPEN });
    expect(writeLog).toEqual([]);
    expect(poolOf(store).status).toBe(POOL_STATUS.OPEN);
  });

  it('a VOIDED group whose pool is OPEN but PAST its close: closed by the clock (validity judged), then refunded', async () => {
    const { db, store } = seed({ poolOver: { status: POOL_STATUS.OPEN, teams: undefined } });
    const out = await settle(db);
    expect(out).toMatchObject({ settled: false, refunded: true, reason: SETTLEMENT_REASON.REFUNDED, refundReason: VOID_REASONS.GROUP_VOIDED });
    expect(poolOf(store)).toMatchObject({ status: POOL_STATUS.REFUNDED, closedAt: NOW_ISO, refundedAt: NOW_ISO });
    expectEveryStakeNetsToZero(store, { voidReason: VOID_REASONS.GROUP_VOIDED });
  });

  it('a VOIDED group whose pool is HELD in resolving: held for the automatic hosts; refunded out of the hold by an admin override', async () => {
    const { db, store, writeLog } = seed({ poolOver: { status: POOL_STATUS.RESOLVING, holdReason: HOLD_REASON.AGENT_LAYER_ABSENT } });
    for (const source of [SETTLEMENT_SOURCE.SETTLE_ON_READ, SETTLEMENT_SOURCE.FRIDAY_DUTY]) {
      expect(await settle(db, { source })).toMatchObject({ settled: false, refunded: false, reason: SETTLEMENT_REASON.HELD, holdReason: HOLD_REASON.AGENT_LAYER_ABSENT });
    }
    expect(writeLog).toEqual([]);
    const out = await settle(db, { source: SETTLEMENT_SOURCE.ADMIN, overrideHold: true, actor: 'admin', reason: 'void confirmed' });
    expect(out).toMatchObject({ settled: false, refunded: true, reason: SETTLEMENT_REASON.REFUNDED, refundReason: VOID_REASONS.GROUP_VOIDED });
    expect(poolOf(store)).toMatchObject({ status: POOL_STATUS.REFUNDED, holdRelease: { by: 'admin', at: NOW_ISO, priorHoldReason: HOLD_REASON.AGENT_LAYER_ABSENT } });
    expect(JSON.stringify(poolOf(store))).not.toContain('void confirmed');
    expectEveryStakeNetsToZero(store, { voidReason: VOID_REASONS.GROUP_VOIDED });
  });

  it('THE FLIP (H4 for the refund): a cheap read saying `complete` while the TRANSACTIONAL read says `voided` REFUNDS and never pays', async () => {
    const { db, store } = seed({ group: voidedGroup({ dailyScores: bankedWeek(SCORES) }) });
    const real = db.collection;
    let doctored = 0;
    db.collection = (name) => {
      const col = real(name);
      if (name !== 'tournamentGroups') return col;
      return {
        ...col,
        doc: (id) => {
          const ref = col.doc(id);
          return {
            ...ref,
            // ONLY the first direct read is stale (settlePool's cheap read);
            // every later read — the refund primitive's own — sees the truth.
            get: async () => {
              doctored += 1;
              const data = store.get(`tournamentGroups/${id}`);
              return { exists: true, id, data: () => (doctored === 1 ? { ...data, status: GROUP_STATUS.COMPLETE } : data) };
            },
          };
        },
      };
    };
    const out = await settle(db);
    expect(out).toMatchObject({ settled: false, refunded: true, reason: SETTLEMENT_REASON.REFUNDED, refundReason: VOID_REASONS.GROUP_VOIDED });
    expectEveryStakeNetsToZero(store, { voidReason: VOID_REASONS.GROUP_VOIDED });
    for (const uid of UIDS) expect(Object.keys(walletOf(store, uid).appliedEntries).some((k) => k.startsWith('payout:'))).toBe(false);
  });

  it('FROZEN: the automatic refund is withheld with ZERO reads (the freeze is the one belt every settlePool host shares); the admin refund is not gated here', async () => {
    flags.frozen = true;
    const { db, writeLog, readLog } = seed();
    expect(await settle(db)).toEqual({ settled: false, reason: SETTLEMENT_REASON.FROZEN });
    expect(writeLog).toEqual([]);
    expect(readLog).toEqual([]);
    // refundPool itself carries no freeze check: the admin endpoint refunds a
    // frozen week deliberately (§7 names it) and reads no composite to do so.
    expect(await refund(db, { reason: VOID_REASONS.ADMIN, source: SETTLEMENT_SOURCE.ADMIN })).toMatchObject({ refunded: true });
  });

  it('CONTROL: a complete, banked group still SETTLES through the same call — the routing changes nothing for a pod with a result', async () => {
    const { db, store } = seed({ group: groupDoc() });
    const out = await settle(db);
    expect(out).toMatchObject({ settled: true, winners: ['od-a'], winningStakes: 300, paysX: round2(700 / 300) });
    expect(out.refunded).toBeUndefined();
    expect(stakeOf(store, 's1')).toMatchObject({ status: STAKE_STATUS.WON, payout: 700 });
    expect(walletOf(store, 'u1').careerNet).toBe(300);
  });

  it('DUPLICATE TRIGGERS after a refund: settlePool answers already_refunded and writes nothing; after a settlement, a refund answers already_settled', async () => {
    const { db, writeLog } = seed();
    await settle(db);
    const writes = writeLog.length;
    expect(await settle(db)).toMatchObject({ settled: false, refunded: false, reason: REFUND_REASON.ALREADY_REFUNDED });
    expect(await settle(db, { source: SETTLEMENT_SOURCE.FRIDAY_DUTY })).toMatchObject({ settled: false, refunded: false, reason: REFUND_REASON.ALREADY_REFUNDED });
    expect(writeLog.length).toBe(writes);
    const settledWorld = seed({ group: groupDoc() });
    await settle(settledWorld.db);
    const w2 = settledWorld.writeLog.length;
    expect(await refund(settledWorld.db, { reason: VOID_REASONS.ADMIN, source: SETTLEMENT_SOURCE.ADMIN })).toMatchObject({ refunded: false, reason: REFUND_REASON.ALREADY_SETTLED });
    expect(settledWorld.writeLog.length).toBe(w2);
  });
});
