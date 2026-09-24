// api/_utils/backingStats.test.js
//
// Backing Beta PR 5 — the private stats, pure folds and their reads (spec
// V1.3 §5 my stats / trainer stats, §8, §10 the naive baseline, D-v, D-w).
//
// THE ROWS THIS FILE EXISTS FOR:
//   · net BP is the WALLET's ledger figure, never re-summed here;
//   · the baseline is "last week's best placement" from the rank history,
//     judged BEFORE the pool closed, this pod's own event excluded; a pool
//     with no prior history on any team is EXCLUDED and counted separately;
//   · an admin-excluded stake is dropped from the trainer's social counts;
//   · dev pools are skipped, and the skip is counted;
//   · an OPEN pool is sealed even to the trainer: none of its stakes reaches
//     any figure or tally (SEAL-1, the desktop review record), and the seal
//     itself is read from the trainer's own pods, never from stakes (SEAL-R-2);
//   · the trainer's reads (the pre-flip fixes 2 review record): a live copy
//     the pool contradicts is stale and never counted (SEAL-A1); the seal is
//     bounded to the pods of this week or later and never a dev pod's
//     (WIRE-A2, WIRE-A3); round 2 closes a seated pod's pool past its close
//     (PLACE-A3); no stake on an open pool costs a read (SEAL-A2).
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the real import of the module is
// the runtime guard for its api/ -> src/ imports. Never mock it.

import { describe, it, expect } from 'vitest';
import { makeInMemoryDb } from './__fixtures__/inMemoryFirestore.js';
import {
  BETA_STATS_LABEL,
  COUNTED_STAKE_STATUSES,
  STAKE_META_DOC,
  STAKE_PRIVATE_SUBCOLLECTION,
  baselinePick,
  computeMyStats,
  computeTrainerStats,
  currentSeasonKey,
  isTerminalPool,
  priorPlacementBefore,
  closeIsDue,
  countedStakes,
  flaggedStakeIds,
  readExcludedStakeIds,
  readPoolByGroupId,
  readPoolsFor,
  readRanksFor,
  readSeatedPods,
  readStakesWhere, rankEventsOf,
  readTrainerPools,
  sealPodsOf,
  trainerSealed } from './backingStats.js';
import { STAKE_PRIVATE_SUBCOLLECTION as WRITER_SUB, STAKE_META_DOC as WRITER_DOC } from '../tournament/backing-stake.js';

const NOW = new Date('2026-10-05T14:00:00.000Z'); // Monday Oct 5 — the season is 2026-10; last week's pools banked in 2026-09
const pool = (over = {}) => ({
  status: 'resolved', battleMondayEtDate: '2026-09-28', monthKey: '2026-09', closedAt: '2026-09-28T04:00:00.000Z', settledAt: '2026-10-02T22:30:00.000Z',
  winnerOdUserIds: ['od-b'], teams: [{ odUserId: 'od-a', isCpu: false }, { odUserId: 'od-b', isCpu: false }, { odUserId: 'cpu-1', isCpu: true }], ...over,
});
const rank = (events) => ({ history: events.map(([groupId, placement, appliedAt]) => ({ groupId, placement, appliedAt })) });

describe('the baseline (§10) — pure', () => {
  it('priorPlacementBefore: the latest event applied BEFORE the close, this pod excluded; null with no such history', () => {
    const r = rank([['g-w1', 3, '2026-09-11T21:00:00.000Z'], ['g-w2', 1, '2026-09-18T21:00:00.000Z'], ['g-w3', 2, '2026-09-25T21:00:00.000Z'], ['g-this', 4, '2026-10-02T21:00:00.000Z']]);
    expect(priorPlacementBefore(r, { beforeIso: '2026-09-28T04:00:00.000Z', excludeGroupId: 'g-this' })).toBe(2);
    expect(priorPlacementBefore(r, { beforeIso: '2026-09-15T00:00:00.000Z' })).toBe(3);
    expect(priorPlacementBefore(r, { beforeIso: '2026-09-01T00:00:00.000Z' })).toBeNull();
    expect(priorPlacementBefore(null, { beforeIso: 'x' })).toBeNull();
    expect(priorPlacementBefore({ history: [{ groupId: 'g', placement: 'first', appliedAt: '2026-09-01T00:00:00.000Z' }] }, { beforeIso: '2026-09-02T00:00:00.000Z' })).toBeNull();
    // No close instant to judge against: every prior event counts.
    expect(priorPlacementBefore(r, { excludeGroupId: 'g-this' })).toBe(2);
  });

  it('baselinePick: the human team with the LOWEST prior placement; ties go to the earlier seat; CPUs never; none → null', () => {
    const teams = [{ odUserId: 'od-a' }, { odUserId: 'od-b' }, { odUserId: 'cpu-1', isCpu: true }, { odUserId: 'cpu-2' }];
    expect(baselinePick(teams, new Map([['od-a', 3], ['od-b', 1]]))).toBe('od-b');
    expect(baselinePick(teams, new Map([['od-a', 2], ['od-b', 2]]))).toBe('od-a');
    expect(baselinePick(teams, new Map([['od-a', null], ['od-b', 2], ['cpu-1', 1], ['cpu-2', 1]]))).toBe('od-b');
    expect(baselinePick(teams, new Map([['cpu-1', 1]]))).toBeNull();
    expect(baselinePick(teams, new Map())).toBeNull();
    expect(baselinePick([], new Map([['od-a', 1]]))).toBeNull();
  });
});

describe('the baseline reads the UNCAPPED map (HON-12)', () => {
  it('a pre-close event that rolled off the capped `history` is still judged from `appliedGroups`; `history` alone serves a legacy doc', () => {
    const pre = { groupId: 'g-pre', placement: 1, appliedAt: '2026-09-18T21:00:00.000Z' };
    const later = Array.from({ length: 20 }, (_, i) => ({ groupId: `g-later-${i}`, placement: 3, appliedAt: `2026-10-${String(10 + i).padStart(2, '0')}T21:00:00.000Z` }));
    const rolled = { appliedGroups: Object.fromEntries([pre, ...later].map((e) => [e.groupId, e])), history: later };
    expect(priorPlacementBefore(rolled, { beforeIso: '2026-09-28T04:00:00.000Z' })).toBe(1);
    expect(priorPlacementBefore({ history: later }, { beforeIso: '2026-09-28T04:00:00.000Z' })).toBeNull();
    expect(priorPlacementBefore({ history: [pre, ...later] }, { beforeIso: '2026-09-28T04:00:00.000Z' })).toBe(1);
    expect(rankEventsOf(rolled)).toHaveLength(21);
    expect(rankEventsOf({ appliedGroups: { 'g-pre': pre }, history: [pre] })).toHaveLength(1);
  });
});

describe('computeMyStats — the viewer\'s own record, pure', () => {
  const wallet = { careerNet: -150, seasons: { '2026-09': { net: -150 }, '2026-08': { net: 40 } } };
  const stakes = [
    // Pool A (resolved, Sept): backed od-b (won 214 on 500) and od-a (lost 100).
    { id: 's1', groupId: 'g-a', teamOdUserId: 'od-b', amount: 500, status: 'won', payout: 714, weekKey: '2026-W40' },
    { id: 's2', groupId: 'g-a', teamOdUserId: 'od-a', amount: 100, status: 'lost', payout: 0, weekKey: '2026-W40' },
    // Pool B (resolved, Sept, no prior history on any team): lost.
    { id: 's3', groupId: 'g-b', teamOdUserId: 'od-a', amount: 100, status: 'lost', weekKey: '2026-W40' },
    // Pool C (resolved, Sept, the previous week): baseline right, viewer wrong.
    { id: 's4', groupId: 'g-c', teamOdUserId: 'od-a', amount: 200, status: 'lost', weekKey: '2026-W39' },
    // Pool D (open, the window): pending.
    { id: 's5', groupId: 'g-d', teamOdUserId: 'od-a', amount: 100, status: 'live', weekKey: '2026-W41' },
    // Pool E (insufficient): voided.
    { id: 's6', groupId: 'g-e', teamOdUserId: 'od-a', amount: 100, status: 'voided', voidReason: 'insufficient', weekKey: '2026-W39' },
    // A dev pool: skipped.
    { id: 's7', groupId: 'g-dev', teamOdUserId: 'od-a', amount: 100, status: 'won', payout: 300, weekKey: '2026-W40' },
  ];
  const poolsByGroup = new Map([
    ['g-a', { poolId: 'g-a', isDev: false, pool: pool() }],
    ['g-b', { poolId: 'g-b', isDev: false, pool: pool({ winnerOdUserIds: ['od-b'], teams: [{ odUserId: 'od-x' }, { odUserId: 'od-y' }] }) }],
    ['g-c', { poolId: 'g-c', isDev: false, pool: pool({ winnerOdUserIds: ['od-b'], closedAt: '2026-09-21T04:00:00.000Z', settledAt: '2026-09-25T22:30:00.000Z' }) }],
    ['g-d', { poolId: 'g-d', isDev: false, pool: { status: 'open', battleMondayEtDate: '2026-10-12' } }],
    ['g-e', { poolId: 'g-e', isDev: false, pool: { status: 'insufficient', battleMondayEtDate: '2026-09-21' } }],
    ['g-dev', { poolId: 'dev-g-dev', isDev: true, pool: pool() }],
  ]);
  const ranksByTeam = new Map([
    ['od-a', rank([['g-old', 3, '2026-09-18T21:00:00.000Z'], ['g-a', 2, '2026-10-02T21:00:00.000Z']])],
    ['od-b', rank([['g-older', 1, '2026-09-11T21:00:00.000Z'], ['g-a', 1, '2026-10-02T21:00:00.000Z']])],
  ]);
  const out = computeMyStats({ stakes, poolsByGroup, ranksByTeam, wallet, now: NOW });

  it('net BP is the wallet\'s ledger figure under §2\'s ONE definition in both columns: career as the wallet carries it (every placement debited), each season\'s settled figure less the BP still in play on that month\'s pools (HON-4)', () => {
    expect(out.label).toBe(BETA_STATS_LABEL);
    expect(out.seasonKey).toBe('2026-10');
    // The live 100 on g-d (battle Monday 2026-10-12) is October's: the wallet
    // has no October bucket yet, so October reads −100 — exactly what the
    // career column already counts for it.
    expect(out.net).toEqual({ career: -150, season: -100 });
    expect(out.seasons['2026-10']).toMatchObject({ net: -100, pending: 1, inPlayBp: 100 });
    expect(out.seasons['2026-09'].net).toBe(-150);
    expect(out.seasons['2026-08'].net).toBe(40);
    expect(out.career.net).toBe(-150);
    expect(out.career.inPlayBp).toBe(100);
    expect(out.excludedStakes).toBe(0);
  });

  it('HON-4 — a first-week backer with ONE live stake and nothing decided reads the same net in both columns (−500), never +0 beside −500', () => {
    const first = computeMyStats({
      stakes: [{ id: 'f1', groupId: 'g-f', teamOdUserId: 'od-a', amount: 500, status: 'live', weekKey: '2026-W41' }],
      poolsByGroup: new Map([['g-f', { poolId: 'g-f', isDev: false, pool: { status: 'open', battleMondayEtDate: '2026-10-05' } }]]),
      wallet: { careerNet: -500, seasons: {} },
      now: NOW,
    });
    expect(first.net).toEqual({ career: -500, season: -500 });
    expect(first.season).toMatchObject({ pending: 1, inPlayBp: 500, poolsBacked: 0 });
    expect(first.career).toMatchObject({ pending: 1, inPlayBp: 500, net: -500 });
  });

  it('HON-5 — an admin-EXCLUDED stake leaves the counts and the net (§8): s1\'s +214 comes out of career and of September; g-a stays backed through s2', () => {
    const ex = computeMyStats({ stakes, poolsByGroup, ranksByTeam, wallet, now: NOW, excluded: new Set(['s1']) });
    expect(ex.excludedStakes).toBe(1);
    expect(ex.net).toEqual({ career: -150 - 214, season: -100 });
    expect(ex.seasons['2026-09'].net).toBe(-150 - 214);
    expect(ex.career).toMatchObject({ poolsBacked: 3, poolsWon: 0, stakes: 5, stakedBp: 400, paidBp: 0 });
    // The excluded stake's pool is still judged for accuracy through the remaining decided stake (s2 lost).
    expect(ex.accuracy.career.pools).toBe(out.accuracy.career.pools);
    expect(ex.accuracy.career.youWon).toBe(out.accuracy.career.youWon - 1);
  });

  it('counts pools backed (decided), pools won, weeks played, pending pools and voided pools; skips dev pools and says so', () => {
    expect(out.career).toMatchObject({ poolsBacked: 3, poolsWon: 1, weeksPlayed: 2, pending: 1, voidedPools: 1, stakes: 6, stakedBp: 900, paidBp: 714 });
    expect(out.seasons['2026-09']).toMatchObject({ poolsBacked: 3, poolsWon: 1, weeksPlayed: 2, voidedPools: 1 });
    expect(out.seasons['2026-10']).toMatchObject({ pending: 1, poolsBacked: 0 });
    expect(out.devPoolsSkipped).toBe(1);
    expect(out.unknownPools).toBe(0);
  });

  it('accuracy versus the naive baseline: pool A (baseline od-b wins, viewer backed od-b), pool C (baseline right, viewer wrong), pool B EXCLUDED (no prior history)', () => {
    // Pool A: priors before 2026-09-28 — od-a 3 (g-old), od-b 1 (g-older) → baseline od-b, winner od-b.
    // Pool C: priors before 2026-09-21 — od-a none (g-old applied 09-18 < 09-21 → 3), od-b 1 → baseline od-b, winner od-b; viewer backed od-a → wrong.
    expect(out.accuracy.career).toEqual({ pools: 2, youWon: 1, baselineWon: 2, both: 1, excluded: 1 });
    expect(out.accuracy.seasons['2026-09']).toEqual({ pools: 2, youWon: 1, baselineWon: 2, both: 1, excluded: 1 });
    expect(out.accuracy.season).toEqual({ pools: 0, youWon: 0, baselineWon: 0, both: 0, excluded: 0 });
  });

  it('this pod\'s OWN rank event never feeds its baseline (the prior week, not the week being judged)', () => {
    // If g-a's own event (od-a placement 2, od-b placement 1, applied Oct 2) were read, od-b would still be the pick; give od-a the better OWN placement to make the mistake visible.
    const ranks = new Map([
      ['od-a', rank([['g-old', 3, '2026-09-18T21:00:00.000Z'], ['g-a', 1, '2026-10-02T21:00:00.000Z']])],
      ['od-b', rank([['g-older', 2, '2026-09-11T21:00:00.000Z'], ['g-a', 2, '2026-10-02T21:00:00.000Z']])],
    ]);
    const one = computeMyStats({ stakes: stakes.slice(0, 2), poolsByGroup: new Map([['g-a', poolsByGroup.get('g-a')]]), ranksByTeam: ranks, wallet, now: NOW });
    // Prior: od-a 3, od-b 2 → baseline od-b (the winner) → baselineWon 1. Reading g-a's own event would pick od-a (1) → baselineWon 0.
    expect(one.accuracy.career).toEqual({ pools: 1, youWon: 1, baselineWon: 1, both: 1, excluded: 0 });
  });

  it('an empty record is all zeros with the wallet\'s net, never a null the card would have to guess at', () => {
    const empty = computeMyStats({ stakes: [], poolsByGroup: new Map(), ranksByTeam: new Map(), wallet: null, now: NOW });
    expect(empty.net).toEqual({ career: 0, season: 0 });
    expect(empty.career).toMatchObject({ poolsBacked: 0, poolsWon: 0, weeksPlayed: 0, pending: 0, net: 0 });
    expect(empty.accuracy.career).toEqual({ pools: 0, youWon: 0, baselineWon: 0, both: 0, excluded: 0 });
  });
});

describe('computeTrainerStats — the viewer as a team, pure', () => {
  const stakes = [
    { id: 't1', groupId: 'g-a', userId: 'u1', teamOdUserId: 'me', amount: 300, status: 'won', payout: 450 },
    { id: 't2', groupId: 'g-a', userId: 'u2', teamOdUserId: 'me', amount: 100, status: 'won', payout: 150 },
    { id: 't3', groupId: 'g-c', userId: 'u1', teamOdUserId: 'me', amount: 100, status: 'lost', payout: 0 },
    { id: 't4', groupId: 'g-d', userId: 'u3', teamOdUserId: 'me', amount: 100, status: 'live' },          // on an OPEN pool: sealed
    { id: 't5', groupId: 'g-a', userId: 'u4', teamOdUserId: 'me', amount: 500, status: 'won', payout: 750 }, // excluded by an admin
    { id: 't6', groupId: 'g-e', userId: 'u5', teamOdUserId: 'me', amount: 100, status: 'voided' },          // never in the book
    { id: 't7', groupId: 'g-dev', userId: 'u1', teamOdUserId: 'me', amount: 100, status: 'won', payout: 200 },
  ];
  const poolsByGroup = new Map([
    ['g-a', { poolId: 'g-a', isDev: false, pool: pool() }],
    ['g-c', { poolId: 'g-c', isDev: false, pool: pool({ closedAt: '2026-09-21T04:00:00.000Z' }) }],
    ['g-d', { poolId: 'g-d', isDev: false, pool: { status: 'open', battleMondayEtDate: '2026-10-12' } }],
    ['g-e', { poolId: 'g-e', isDev: false, pool: { status: 'insufficient', battleMondayEtDate: '2026-09-21' } }],
    ['g-dev', { poolId: 'dev-g-dev', isDev: true, pool: pool() }],
  ]);
  const out = computeTrainerStats({ stakes, poolsByGroup, excluded: new Set(['t5']), now: NOW });

  it('unique backers, BP backed and the backers\' net — over the stakes that count, the excluded one dropped, the voided one never in, the OPEN pool\'s stake never read (SEAL-1)', () => {
    expect(out.label).toBe(BETA_STATS_LABEL);
    // t4 sits on g-d, an OPEN pool: before SEAL-1 it counted (3 backers, 600 BP,
    // 100 BP in play on 3 pools, 4 stakes) — the trainer's own sealed book.
    expect(out.career).toMatchObject({ uniqueBackers: 2, bpBacked: 500, backersNet: 100, pending: 0, poolsBackedOn: 2, stakes: 3, decidedStakes: 3 });
    expect(out.excludedStakes).toBe(1);
    expect(out.devPoolsSkipped).toBe(1);
  });

  it('season buckets follow each pool\'s ladder month; the current season is October\'s — empty: its only stake is on an OPEN pool, sealed (SEAL-1)', () => {
    expect(out.seasonKey).toBe('2026-10');
    expect(out.seasons['2026-09']).toMatchObject({ uniqueBackers: 2, bpBacked: 500, backersNet: 100, pending: 0, poolsBackedOn: 2 });
    expect(out.season).toMatchObject({ monthKey: '2026-10', uniqueBackers: 0, bpBacked: 0, backersNet: 0, pending: 0, poolsBackedOn: 0, stakes: 0 });
    expect(Object.keys(out.seasons)).toEqual(['2026-09']);
  });

  it('SEAL-1 — a stake on an OPEN pool reaches NO figure and NO tally: an excluded one is not counted excluded, a dev one not counted skipped; each counts once its pool closes', () => {
    const openDev = { poolId: 'dev-g-open-dev', isDev: true, pool: { status: 'open', battleMondayEtDate: '2026-10-12' } };
    const sealedExtra = [
      { id: 's1', groupId: 'g-d', userId: 'u8', teamOdUserId: 'me', amount: 400, status: 'live' },          // another backer on the open pool
      { id: 's2', groupId: 'g-d', userId: 'u9', teamOdUserId: 'me', amount: 250, status: 'live' },          // admin-excluded, on the open pool
      { id: 's3', groupId: 'g-open-dev', userId: 'u1', teamOdUserId: 'me', amount: 100, status: 'live' },   // an open DEV pool
    ];
    const withSealed = computeTrainerStats({
      stakes: [...stakes, ...sealedExtra],
      poolsByGroup: new Map([...poolsByGroup, ['g-open-dev', openDev]]),
      excluded: new Set(['t5', 's2']),
      now: NOW,
    });
    // Byte-equal to the answer without them: the sealed book moves nothing.
    expect(withSealed).toEqual(out);
    // The same stakes on a CLOSED pool count — the row can fail.
    const closed = new Map([...poolsByGroup, ['g-d', { poolId: 'g-d', isDev: false, pool: { status: 'closed', battleMondayEtDate: '2026-10-12' } }], ['g-open-dev', { ...openDev, pool: { ...openDev.pool, status: 'closed' } }]]);
    const revealed = computeTrainerStats({ stakes: [...stakes, ...sealedExtra], poolsByGroup: closed, excluded: new Set(['t5', 's2']), now: NOW });
    expect(revealed.career).toMatchObject({ uniqueBackers: 4, bpBacked: 1000, pending: 500, poolsBackedOn: 3, stakes: 5 });
    expect(revealed.excludedStakes).toBe(2);
    expect(revealed.devPoolsSkipped).toBe(2);
    expect(revealed.season).toMatchObject({ monthKey: '2026-10', uniqueBackers: 2, bpBacked: 500, pending: 500 });
  });

  it('SEAL-A1 — a `live` copy the pool AS READ contradicts is stale and never counted: a close that voided it (a seat that left, a deleted pod, below the floor) landed after the stakes were read; a live copy on a closed pool that seats the team is in play', () => {
    const live = (id, userId, amount) => ({ id, groupId: 'g-x', userId, teamOdUserId: 'me', amount, status: 'live' });
    const book = [live('x1', 'u1', 100), live('x2', 'u2', 300)];
    const fold = (xPool) => computeTrainerStats({ stakes: [...stakes, ...book], poolsByGroup: new Map([...poolsByGroup, ['g-x', { poolId: 'g-x', isDev: false, pool: xPool }]]), excluded: new Set(['t5']), now: NOW });
    const seats = (...ids) => ids.map((odUserId) => ({ odUserId, isCpu: odUserId.startsWith('cpu-') }));
    const at = { battleMondayEtDate: '2026-10-12' };
    // Each close that VOIDS the seat's stakes: the copies read before it move nothing — the answer is the one without them.
    for (const [why, xPool] of [
      ['a seat that left (the frozen teams omit it)', { ...at, status: 'closed', teams: seats('od-x', 'cpu-1', 'cpu-2') }],
      ['a deleted pod (the tombstone: refunded, no teams)', { ...at, status: 'refunded', teams: [] }],
      ['below the floor', { ...at, status: 'insufficient', teams: seats('me', 'od-x') }],
    ]) {
      expect(fold(xPool), why).toEqual(out);
    }
    // The close that KEEPS them: in play on the trainer — the row can fail.
    const kept = fold({ ...at, status: 'closed', teams: seats('me', 'od-x', 'cpu-1') });
    expect(kept.career).toMatchObject({ uniqueBackers: 2, bpBacked: 900, pending: 400, poolsBackedOn: 3, stakes: 5 });
  });

  it('COUNTED_STAKE_STATUSES is exactly live / won / lost — the query\'s `in` and the fold agree', () => {
    expect([...COUNTED_STAKE_STATUSES].sort()).toEqual(['live', 'lost', 'won']);
    expect(computeTrainerStats({ stakes: [{ id: 'v', groupId: 'g-a', userId: 'u', teamOdUserId: 'me', amount: 100, status: 'voided' }], poolsByGroup, now: NOW }).career.stakes).toBe(0);
  });
});

describe('the reads, on the in-memory store', () => {
  const world = {
    'backingStakes/a': { userId: 'u1', teamOdUserId: 'me', groupId: 'g1', status: 'won', amount: 100 },
    'backingStakes/b': { userId: 'u2', teamOdUserId: 'me', groupId: 'g1', status: 'voided', amount: 100 },
    'backingStakes/c': { userId: 'u1', teamOdUserId: 'other', groupId: 'g2', status: 'live', amount: 100 },
    'backingStakes/a/private/meta': { ipHash: 'x', uaHash: 'y', excluded: true },
    'backingStakes/c/private/meta': { ipHash: 'x', uaHash: 'y', excluded: false },
    'backingPools/g1': { status: 'resolved' },
    'backingPools/dev-g3': { status: 'closed' },
    'tournamentRanks/od-a': { rp: 10, history: [] },
  };

  it('readStakesWhere applies the equality and the status disjunction (the committed composites)', async () => {
    const { db } = makeInMemoryDb(world);
    expect((await readStakesWhere(db, 'userId', 'u1')).map((s) => s.id).sort()).toEqual(['a', 'c']);
    expect((await readStakesWhere(db, 'teamOdUserId', 'me', { statuses: ['live', 'won', 'lost'] })).map((s) => s.id)).toEqual(['a']);
    expect((await readStakesWhere(db, 'teamOdUserId', 'me')).map((s) => s.id).sort()).toEqual(['a', 'b']);
  });

  it('readPoolByGroupId probes the production id first, then the dev namespace; readPoolsFor de-duplicates', async () => {
    const { db, readLog } = makeInMemoryDb(world);
    expect(await readPoolByGroupId(db, 'g1')).toEqual({ poolId: 'g1', pool: { status: 'resolved' }, isDev: false });
    expect(await readPoolByGroupId(db, 'g3')).toEqual({ poolId: 'dev-g3', pool: { status: 'closed' }, isDev: true });
    expect(await readPoolByGroupId(db, 'none')).toEqual({ poolId: null, pool: null, isDev: false });
    readLog.length = 0;
    const many = await readPoolsFor(db, ['g1', 'g1', 'g3', null]);
    expect([...many.keys()]).toEqual(['g1', 'g3']);
    expect(readLog.filter(([, p]) => p === 'backingPools/g1')).toHaveLength(1);
  });

  it('readExcludedStakeIds reads each sealed meta and answers the excluded ids; readRanksFor skips CPU ids', async () => {
    const { db } = makeInMemoryDb(world);
    expect([...(await readExcludedStakeIds(db, ['a', 'b', 'c', 'a']))]).toEqual(['a']);
    const ranks = await readRanksFor(db, ['od-a', 'cpu-1', 'od-z']);
    expect([...ranks.keys()]).toEqual(['od-a', 'od-z']);
    expect(ranks.get('od-a')).toEqual({ rp: 10, history: [] });
    expect(ranks.get('od-z')).toBeNull();
  });

  // ── THE TRAINER'S READS (SEAL-1 / SEAL-R-2; SEAL-A2, WIRE-A2, WIRE-A3, PLACE-A3) ──
  const seat = (id, isCpu = false) => ({ odUserId: id, ...(isCpu ? { isCpu: true } : {}) });
  // A pod of next week (W42 — NOW is Monday Oct 5, W41) the viewer sits in.
  const pod = (over = {}) => ({ status: 'forming', baseLayerWeek: '2026-W42', groupMembers: ['me', 'od-x'], players: [seat('me'), seat('od-x'), seat('cpu-1', true)], ...over });
  const OPEN = { status: 'open', closesAt: '2026-10-12T03:59:00.000Z', battleMondayEtDate: '2026-10-12' };
  /** The seal as the route reads it: seated pods → the seal's pods → round 2 → the line. */
  const sealOf = async (store, now = NOW) => {
    const { db, readLog, writeLog } = makeInMemoryDb(store);
    const seated = await readSeatedPods(db, 'me');
    const pools = await readTrainerPools(db, { seatedPods: seated, sealPods: sealPodsOf(seated, now), stakes: [], now });
    return { open: trainerSealed(pools), pools, readLog, writeLog };
  };

  it('the SEAL is the pool\'s fact, read from the pods the viewer is SEATED in: never from stakes (SEAL-R-2), never a training pod; the dev namespace at its own id, and a dev pod never seals (WIRE-A3)', async () => {
    // Seated in a pod whose pool is OPEN, nobody has staked: sealed all the same.
    expect((await sealOf({ 'tournamentGroups/g1': pod(), 'backingPools/g1': OPEN })).open).toBe(true);
    // The pool closed: nothing sealed.
    expect((await sealOf({ 'tournamentGroups/g1': pod(), 'backingPools/g1': { ...OPEN, status: 'closed' } })).open).toBe(false);
    // No pool yet (never materialized): nothing sealed.
    expect((await sealOf({ 'tournamentGroups/g1': pod() })).open).toBe(false);
    // A seat the viewer LEFT (a slot pod before its fire): not theirs, whatever stakes it carries.
    const left = await sealOf({
      'tournamentGroups/g1': pod({ groupMembers: ['od-x'], players: [seat('od-x')] }),
      'backingPools/g1': OPEN,
      'backingStakes/s1': { userId: 'u1', groupId: 'g1', teamOdUserId: 'me', amount: 100, status: 'live' },
    });
    expect(left.open).toBe(false);
    expect(left.readLog.filter(([, p]) => p.startsWith('backingStakes') || p.startsWith('backingPools'))).toEqual([]);
    // A training pod has no pool and is not read.
    const training = await sealOf({ 'tournamentGroups/t1': pod({ isTraining: true }), 'backingPools/t1': OPEN });
    expect(training.open).toBe(false);
    expect(training.readLog.filter(([, p]) => p.startsWith('backingPools'))).toEqual([]);
    // A dev pod's pool is read at dev-{id} — and never seals the production record (the fold skips dev pools).
    const dev = await sealOf({ 'tournamentGroups/g2': pod({ isDev: true }), 'backingPools/dev-g2': OPEN });
    expect(dev.pools.get('g2')).toMatchObject({ poolId: 'dev-g2', isDev: true, seal: true, pool: { status: 'open' } });
    expect(dev.open).toBe(false);
    // The query is member-scoped: the one groups read, and a signed-out caller reads nothing.
    const one = await sealOf({ 'tournamentGroups/g1': pod(), 'backingPools/g1': OPEN });
    expect(one.readLog.filter(([, p]) => p === 'tournamentGroups')).toHaveLength(1);
    const { db, readLog } = makeInMemoryDb({ 'tournamentGroups/g1': pod(), 'backingPools/g1': OPEN });
    expect(await readSeatedPods(db, null)).toEqual([]);
    expect(readLog).toEqual([]);
  });

  it('WIRE-A2 — the seal is BOUNDED to the pods of this week or later: an earlier week\'s pool no path closed never seals and is never read; this week\'s and a pod with no readable week are kept', async () => {
    const pods = [
      { id: 'w40', baseLayerWeek: '2026-W40' }, { id: 'w41', baseLayerWeek: '2026-W41' }, { id: 'w42', baseLayerWeek: '2026-W42' },
      { id: 'w01', baseLayerWeek: '2027-W01' }, { id: 'w52', baseLayerWeek: '2025-W52' }, { id: 'none' }, { id: 'odd', baseLayerWeek: 'week 40' },
    ];
    expect(sealPodsOf(pods, NOW).map((g) => g.id)).toEqual(['w41', 'w42', 'w01', 'none', 'odd']);
    // Sunday 23:00 ET is still W41; Monday 00:00 ET is W42 (the ET week, not the UTC one).
    expect(sealPodsOf(pods, new Date('2026-10-12T03:00:00.000Z')).map((g) => g.id)).toContain('w41');
    expect(sealPodsOf(pods, new Date('2026-10-12T04:00:00.000Z')).map((g) => g.id)).not.toContain('w41');
    // Forty earlier weeks' pods, one left open by a lifecycle gap: one pool read — next week's — and no seal from the stale one.
    const store = { 'tournamentGroups/g-next': pod(), 'backingPools/g-next': { ...OPEN, status: 'closed' } };
    for (let w = 1; w <= 40; w += 1) store[`tournamentGroups/old-${w}`] = pod({ baseLayerWeek: `2025-W${String(w).padStart(2, '0')}` });
    store['backingPools/old-7'] = { ...OPEN, closesAt: '2025-02-16T04:59:00.000Z' };
    const bounded = await sealOf(store);
    expect(bounded.open).toBe(false);
    expect(bounded.readLog.filter(([, p]) => p.startsWith('backingPools'))).toEqual([['get', 'backingPools/g-next']]);
    expect(bounded.writeLog).toEqual([]);
  });

  it('PLACE-A3 — round 2 CLOSES a seated pod\'s pool that is open past its close (the lazy close every pool reader runs): the seal lifts at the close, not when another reader happens by; a pool not yet due, or a dev pool, is never written', async () => {
    const book = {
      'backingStakes/s1': { userId: 'u1', groupId: 'g1', teamOdUserId: 'me', amount: 100, status: 'live' },
      'backingStakes/s2': { userId: 'u2', groupId: 'g1', teamOdUserId: 'od-x', amount: 200, status: 'live' },
    };
    const store = { 'tournamentGroups/g1': pod(), 'backingPools/g1': OPEN, ...book };
    // Not yet due: sealed, and nothing written.
    const before = await sealOf(store);
    expect(before.open).toBe(true);
    expect(before.writeLog).toEqual([]);
    // Past its close (Monday 00:00 ET, W42 now this week): closed by this read, the pool as the close left it.
    const after = await sealOf(store, new Date('2026-10-12T04:00:00.000Z'));
    expect(after.open).toBe(false);
    expect(after.pools.get('g1').pool.status).not.toBe('open');
    expect(after.writeLog.some(([, p]) => p === 'backingPools/g1')).toBe(true);
    // A dev pod's pool past its close is left alone: it neither seals nor counts here.
    const dev = await sealOf({ 'tournamentGroups/g2': pod({ isDev: true }), 'backingPools/dev-g2': OPEN }, new Date('2026-10-12T04:00:00.000Z'));
    expect(dev.open).toBe(false);
    expect(dev.writeLog).toEqual([]);
    expect(closeIsDue(OPEN, NOW)).toBe(false);
    expect(closeIsDue(OPEN, new Date('2026-10-12T03:59:00.000Z'))).toBe(true);
    expect(closeIsDue({ status: 'open' }, NOW)).toBe(true); // an unreadable close is closed, the conservative direction (ensureClosed's rule)
  });

  it('SEAL-A2 — the stakes round 2 and round 3 read for: a DECIDED stake always, a LIVE one only on a pod the viewer sits in (never a departed seat\'s or a deleted pod\'s); an exclusion flag only on a pool that is not open', async () => {
    const st = (id, groupId, status) => ({ id, groupId, status, teamOdUserId: 'me' });
    const all = [st('d1', 'g-left', 'won'), st('d2', 'g-gone', 'lost'), st('l1', 'g-seat', 'live'), st('l2', 'g-left', 'live'), st('l3', 'g-gone', 'live')];
    expect(countedStakes(all, new Set(['g-seat'])).map((s) => s.id)).toEqual(['d1', 'd2', 'l1']);
    const pools = new Map([
      ['g-seat', { pool: { status: 'open' } }],
      ['g-left', { pool: { status: 'resolved' } }],
      ['g-gone', { pool: null }],
      ['g-void', { pool: { status: 'closed', teams: [{ odUserId: 'od-x' }] } }],
    ]);
    // l1 is on an open pool, d2's pool is unknown, v1's live copy is contradicted by its pool: only d1's flag is read.
    expect(flaggedStakeIds([...all, st('v1', 'g-void', 'live')], pools)).toEqual(['d1']);
    // Round 2 reads the seal pods and the pods counted stakes name — once each, whatever the books hold.
    const { db, readLog } = makeInMemoryDb({ 'tournamentGroups/g-seat': pod(), 'backingPools/g-seat': OPEN, 'backingPools/g-left': { status: 'resolved' } });
    const seated = await readSeatedPods(db, 'me');
    readLog.length = 0;
    const read = await readTrainerPools(db, { seatedPods: seated, sealPods: sealPodsOf(seated, NOW), stakes: countedStakes(all, new Set(['g-seat'])), now: NOW });
    expect([...read.keys()]).toEqual(['g-seat', 'g-left', 'g-gone']);
    expect(read.get('g-left')).toMatchObject({ poolId: 'g-left', seal: false, pool: { status: 'resolved' } });
    expect(readLog.map(([, p]) => p)).toEqual(['backingPools/g-seat', 'backingPools/g-left', 'backingPools/g-gone', 'backingPools/dev-g-gone']);
  });

  it('the sealed meta path this module READS is the path the stake endpoint WRITES (one home, pinned)', () => {
    expect(STAKE_PRIVATE_SUBCOLLECTION).toBe(WRITER_SUB);
    expect(STAKE_META_DOC).toBe(WRITER_DOC);
  });

  it('currentSeasonKey is the ET month; isTerminalPool names the three done statuses', () => {
    expect(currentSeasonKey(new Date('2026-10-01T02:00:00.000Z'))).toBe('2026-09'); // still Sept 30 in New York
    expect(currentSeasonKey(NOW)).toBe('2026-10');
    expect(isTerminalPool({ status: 'resolved' })).toBe(true);
    expect(isTerminalPool({ status: 'closed' })).toBe(false);
  });
});
