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
//   · dev pools are skipped, and the skip is counted.
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
  readExcludedStakeIds,
  readPoolByGroupId,
  readPoolsFor,
  readRanksFor,
  readStakesWhere, rankEventsOf } from './backingStats.js';
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
    { id: 't4', groupId: 'g-d', userId: 'u3', teamOdUserId: 'me', amount: 100, status: 'live' },
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

  it('unique backers, BP backed and the backers\' net — over the stakes that count, the excluded one dropped, the voided one never in', () => {
    expect(out.label).toBe(BETA_STATS_LABEL);
    expect(out.career).toMatchObject({ uniqueBackers: 3, bpBacked: 600, backersNet: 100, pending: 100, poolsBackedOn: 3, stakes: 4, decidedStakes: 3 });
    expect(out.excludedStakes).toBe(1);
    expect(out.devPoolsSkipped).toBe(1);
  });

  it('season buckets follow each pool\'s ladder month; the current season is October\'s (the open pool\'s pending stake)', () => {
    expect(out.seasonKey).toBe('2026-10');
    expect(out.seasons['2026-09']).toMatchObject({ uniqueBackers: 2, bpBacked: 500, backersNet: 100, pending: 0, poolsBackedOn: 2 });
    expect(out.season).toMatchObject({ monthKey: '2026-10', uniqueBackers: 1, bpBacked: 100, backersNet: 0, pending: 100, poolsBackedOn: 1 });
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
