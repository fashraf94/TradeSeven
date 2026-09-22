// src/components/League/backing/backingStripState.test.js
//
// Backing Beta PR 4 — the strip's four states, derived from real data (design
// brief rev3 §1). Each state from its inputs; the priority order; the close
// from each pool's `closesAt` (never a hardcoded Sunday — a slot pod's fire
// close reads as its own weekday); the ET day of five; the between-state's
// reopening line from the backing week's close and the 24-hour rule; and the
// SEAL: nothing about the pool leaves the derivation while a pool is open.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the real import of the state
// module (and through it leagueAdapter / leagueTournament) is the runtime
// guard that the derivation stays React-free and Node-clean. Never mock it.

import { describe, it, expect } from 'vitest';
import { POOL_MIN_WINDOW_MS } from '../../../constants/backing';
import {
  STRIP_KIND, deriveStripState, etWeekdayIndex, formatEtClose, nextOpening, podStanding, seatDisplayName, weekDayOfFive,
} from './backingStripState';

const SUNDAY_CLOSE = '2026-09-28T03:59:59.000Z';   // Sun 27 Sep 23:59 ET (EDT)
const WED_FIRE = '2026-09-23T23:00:00.000Z';        // Wed 23 Sep 19:00 ET (a slot pod's fire)
const TUE = new Date('2026-09-22T14:00:00.000Z');   // Tue 10:00 ET
const WED = new Date('2026-09-23T14:00:00.000Z');
const SAT = new Date('2026-09-26T16:00:00.000Z');

const openPool = (over = {}) => ({
  status: 'open', closesAt: SUNDAY_CLOSE, closeReason: 'clock',
  backerProgress: { count: 1, floor: 3, met: false }, teamSpread: { met: false }, ...over,
});

const pod = (groupId, over = {}) => ({
  groupId, formationPath: 'lobby', slotId: null, baseLayerWeek: '2026-W40',
  seatNames: { 'od-a': 'Mira', 'od-b': 'Draco' },
  teams: [
    { odUserId: 'od-a', isCpu: false, isOwnSeat: false, backable: true },
    { odUserId: 'od-b', isCpu: false, isOwnSeat: false, backable: true },
    { odUserId: 'cpu-1', isCpu: true, isOwnSeat: false, backable: true },
    { odUserId: 'cpu-2', isCpu: true, isOwnSeat: false, backable: true },
  ],
  humanTeams: 2, pool: openPool(), myStakes: [], ...over,
});

const inPlayGroup = (over = {}) => ({
  status: 'battle', seatNames: { 'od-a': 'Mira', 'od-x': 'Rigel' },
  players: [{ odUserId: 'od-a' }, { odUserId: 'od-x' }, { odUserId: 'cpu-3', isCpu: true }, { odUserId: 'cpu-4', isCpu: true }],
  dailyScores: { day2: { closeScores: { 'od-a': { compositePoints: 4.8 }, 'od-x': { compositePoints: 5.1 }, 'cpu-3': { compositePoints: 1 }, 'cpu-4': { compositePoints: -0.5 } } } },
  ...over,
});

describe('the four states, from data', () => {
  it('OPEN — the window is open and the viewer has no stake: N pods, the latest close among them', () => {
    const s = deriveStripState({ pods: [pod('g1'), pod('g2'), pod('g3', { pool: openPool({ closesAt: WED_FIRE, closeReason: 'fire' }) })], now: TUE });
    expect(s.kind).toBe(STRIP_KIND.OPEN);
    expect(s.pods).toBe(3);
    expect(s.closesAt).toBe(SUNDAY_CLOSE);
  });

  it('STAKED — the window is open and the viewer has live stakes on it: the staked pods and each stake with its team name', () => {
    const s = deriveStripState({
      pods: [
        pod('g1', { myStakes: [{ stakeId: 's1', teamOdUserId: 'od-a', amount: 250, status: 'live' }] }),
        pod('g2', { myStakes: [{ stakeId: 's2', teamOdUserId: 'cpu-1', amount: 100, status: 'live' }, { stakeId: 's3', teamOdUserId: 'od-b', amount: 50, status: 'voided' }] }),
        pod('g3'),
      ],
      now: TUE,
    });
    expect(s.kind).toBe(STRIP_KIND.STAKED);
    expect(s.pods).toBe(2);
    expect(s.closesAt).toBe(SUNDAY_CLOSE);
    expect(s.stakes.map((x) => [x.teamName, x.amount])).toEqual([['Mira', 250], ['CPU — Trend Follower', 100]]);
    expect(s.stakes.every((x) => typeof x.podName === 'string' && x.podName.length > 0)).toBe(true);
  });

  it('WEEK — the viewer has stakes IN PLAY (pool closed, pod in battle): day N of 5 and where the teams stand', () => {
    const s = deriveStripState({
      pods: [pod('g-next')],
      inPlay: {
        stakes: [{ id: 's9', groupId: 'g-play', teamOdUserId: 'od-a', amount: 250, status: 'live', weekKey: '2026-W39' }],
        poolsById: { 'g-play': { status: 'closed', closesAt: '2026-09-21T03:59:59.000Z' } },
        groupsById: { 'g-play': inPlayGroup() },
      },
      now: WED,
    });
    expect(s.kind).toBe(STRIP_KIND.WEEK);
    expect(s.day).toBe(3);
    expect(s.pods).toBe(1);
    expect(s.teams).toEqual([{
      groupId: 'g-play', podName: s.teams[0].podName, teamOdUserId: 'od-a', teamName: 'Mira', amount: 250, rank: 2, score: 4.8, seatCount: 4,
    }]);
  });

  it('BETWEEN — the stakes have settled and no pool is open: the settled pods and when pools reopen', () => {
    const s = deriveStripState({
      pods: [],
      inPlay: {
        stakes: [{ id: 's9', groupId: 'g-done', teamOdUserId: 'od-a', amount: 250, status: 'won', weekKey: '2026-W39' }],
        poolsById: { 'g-done': { status: 'resolved' } },
        groupsById: { 'g-done': inPlayGroup({ status: 'complete' }) },
      },
      now: SAT,
      backingWeekCloses: SUNDAY_CLOSE,
    });
    expect(s.kind).toBe(STRIP_KIND.BETWEEN);
    expect(s.pods).toBe(1);
    expect(s.reopens).toBe('onFormation');
  });

  it('QUIET — no pods, no stakes: the honest empty state, never "0 pods"', () => {
    const s = deriveStripState({ pods: [], inPlay: { stakes: [], poolsById: {}, groupsById: {} }, now: TUE });
    expect(s).toEqual({ kind: STRIP_KIND.QUIET });
  });
});

describe('priority — one strip says one thing', () => {
  const inPlayLive = {
    stakes: [{ id: 's9', groupId: 'g-play', teamOdUserId: 'od-a', amount: 250, status: 'live' }],
    poolsById: { 'g-play': { status: 'closed' } },
    groupsById: { 'g-play': inPlayGroup() },
  };

  it('in-play stakes outrank an open window with stakes on it (Monday–Friday reads as the week)', () => {
    const s = deriveStripState({ pods: [pod('g1', { myStakes: [{ stakeId: 's1', teamOdUserId: 'od-a', amount: 100, status: 'live' }] })], inPlay: inPlayLive, now: WED });
    expect(s.kind).toBe(STRIP_KIND.WEEK);
  });

  it('an open window outranks a settled week — "pools open again Monday" is never said while a pool is open', () => {
    const s = deriveStripState({
      pods: [pod('g1')],
      inPlay: { stakes: [{ id: 's9', groupId: 'g-done', teamOdUserId: 'od-a', amount: 250, status: 'lost' }], poolsById: { 'g-done': { status: 'resolved' } }, groupsById: {} },
      now: SAT,
    });
    expect(s.kind).toBe(STRIP_KIND.OPEN);
  });

  it('a stake whose pool is still OPEN is the window\'s, not the week\'s — it never reads as in play', () => {
    const s = deriveStripState({
      pods: [pod('g1', { myStakes: [{ stakeId: 's1', teamOdUserId: 'od-a', amount: 100, status: 'live' }] })],
      inPlay: { stakes: [{ id: 's1', groupId: 'g1', teamOdUserId: 'od-a', amount: 100, status: 'live' }], poolsById: { g1: openPool() }, groupsById: {} },
      now: TUE,
    });
    expect(s.kind).toBe(STRIP_KIND.STAKED);
  });

  it('a voided stake on a closed pool counts as settled, not in play', () => {
    const s = deriveStripState({
      pods: [],
      inPlay: { stakes: [{ id: 's1', groupId: 'g-thin', teamOdUserId: 'od-a', amount: 100, status: 'voided', voidReason: 'insufficient' }], poolsById: { 'g-thin': { status: 'insufficient' } }, groupsById: {} },
      now: WED,
    });
    expect(s.kind).toBe(STRIP_KIND.BETWEEN);
  });
});

describe('the close comes from the pool, never a hardcoded Sunday', () => {
  it('a slot pod whose pool closes at its Wednesday fire reads Wednesday', () => {
    const s = deriveStripState({ pods: [pod('g-slot', { formationPath: 'slot', pool: openPool({ closesAt: WED_FIRE, closeReason: 'fire' }) })], now: TUE });
    expect(s.closesAt).toBe(WED_FIRE);
    expect(formatEtClose(s.closesAt)).toBe('Wed 7:00 PM ET');
  });

  it('formatEtClose renders the ET wall clock and is null for an unreadable instant', () => {
    expect(formatEtClose(SUNDAY_CLOSE)).toBe('Sun 11:59 PM ET');
    expect(formatEtClose(null)).toBeNull();
    expect(formatEtClose('nope')).toBeNull();
  });

  it('with mixed closes the window reads the LATEST (the last door to shut)', () => {
    const s = deriveStripState({ pods: [pod('g-slot', { pool: openPool({ closesAt: WED_FIRE }) }), pod('g-lobby')], now: TUE });
    expect(s.closesAt).toBe(SUNDAY_CLOSE);
  });
});

describe('the ET day of five', () => {
  it('Mon..Fri → 1..5 in New York, the weekend clamps to 5', () => {
    expect(weekDayOfFive(new Date('2026-09-21T14:00:00.000Z'))).toBe(1);
    expect(weekDayOfFive(WED)).toBe(3);
    expect(weekDayOfFive(new Date('2026-09-25T14:00:00.000Z'))).toBe(5);
    expect(weekDayOfFive(SAT)).toBe(5);
    expect(weekDayOfFive(new Date('2026-09-27T14:00:00.000Z'))).toBe(5);
  });

  it('reads the ET weekday, not UTC — 02:00Z Wednesday is still Tuesday evening in New York', () => {
    expect(etWeekdayIndex(new Date('2026-09-23T02:00:00.000Z'))).toBe(2);
    expect(weekDayOfFive(new Date('2026-09-23T02:00:00.000Z'))).toBe(2);
  });
});

describe('the between-state reopening line — the 24-hour rule, from the week\'s close', () => {
  it('inside the last 24 hours before the week closes, no pool can open → Monday', () => {
    const closeMs = new Date(SUNDAY_CLOSE).getTime();
    expect(nextOpening(new Date(closeMs - POOL_MIN_WINDOW_MS + 1000), SUNDAY_CLOSE)).toBe('monday');
    expect(nextOpening(new Date(closeMs - 1000), SUNDAY_CLOSE)).toBe('monday');
  });

  it('earlier in the week a pod can still form and open a pool', () => {
    expect(nextOpening(SAT, SUNDAY_CLOSE)).toBe('onFormation');
    expect(nextOpening(TUE, SUNDAY_CLOSE)).toBe('onFormation');
  });

  it('with no week close to read, it never claims Monday', () => {
    expect(nextOpening(SAT, null)).toBe('onFormation');
  });
});

describe('names and standings', () => {
  it('seatDisplayName reads the pod\'s own seatNames, synthesizes CPUs, and falls back to the id', () => {
    expect(seatDisplayName({ 'od-a': 'Mira' }, 'od-a')).toBe('Mira');
    expect(seatDisplayName({}, 'cpu-2')).toBe('CPU — Contrarian');
    expect(seatDisplayName(null, 'od-zz')).toBe('od-zz');
  });

  it('podStanding ranks the pod by the tournament\'s own comparator on the banked composite', () => {
    expect(podStanding(inPlayGroup()).map((r) => [r.odUserId, r.rank, r.score])).toEqual([
      ['od-x', 1, 5.1], ['od-a', 2, 4.8], ['cpu-3', 3, 1], ['cpu-4', 4, -0.5],
    ]);
  });
});

describe('THE SEAL — nothing about an open pool leaves the derivation', () => {
  it('an open pod carrying a pot, exact counts, per-team totals or pays × (a mutated reply) contributes none of them to the state', () => {
    const leaky = pod('g-leak', {
      pool: openPool({ potTotal: 1200, uniqueBackers: 5, teamsBacked: 3 }),
      teams: [
        { odUserId: 'od-a', isCpu: false, isOwnSeat: false, backable: true, stakeTotal: 700, backerCount: 3, paysX: 1.7 },
        { odUserId: 'od-b', isCpu: false, isOwnSeat: false, backable: true, stakeTotal: 500, backerCount: 2 },
      ],
      myStakes: [{ stakeId: 's1', teamOdUserId: 'od-a', amount: 250, status: 'live' }],
    });
    const s = deriveStripState({ pods: [leaky], now: TUE });
    const text = JSON.stringify(s);
    expect(s.kind).toBe(STRIP_KIND.STAKED);
    expect(text).not.toContain('1200');
    expect(text).not.toContain('potTotal');
    expect(text).not.toContain('uniqueBackers');
    expect(text).not.toContain('stakeTotal');
    expect(text).not.toContain('backerCount');
    expect(text).not.toContain('paysX');
    expect(text).not.toContain('700');
    // The viewer's OWN stake is the one number the open state may carry.
    expect(text).toContain('250');
  });
});
