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
import { POOL_MIN_WINDOW_MS, TEAM_NAME_PENDING, UNNAMED_TEAM_LABEL } from '../../../constants/backing';
import {
  STRIP_KIND, backingWeekKeys, deriveStripState, etWeekdayIndex, formatEtClose, nextOpening, podDayOfFive, podStanding, podTeamLabel, podTeamLayers, teamLabelOf, weekDayOfFive,
} from './backingStripState';
import { stripLines } from './backingCopy';

const SUNDAY_CLOSE = '2026-09-28T03:59:59.000Z';   // Sun 27 Sep 23:59 ET (EDT)
const WED_FIRE = '2026-09-23T23:00:00.000Z';        // Wed 23 Sep 19:00 ET (a slot pod's fire)
const TUE = new Date('2026-09-22T14:00:00.000Z');   // Tue 10:00 ET
const WED = new Date('2026-09-23T14:00:00.000Z');
const SAT = new Date('2026-09-26T16:00:00.000Z');

const openPool = (over = {}) => ({
  status: 'open', closesAt: SUNDAY_CLOSE, closeReason: 'clock',
  backerProgress: { count: 1, floor: 3, met: false }, teamSpread: { met: false }, ...over,
});

// D-af (Amendment C §C1) — the SERVER's names, in the shapes it sends them:
// the pod list puts `label` / `secondary` on each seat and `teamLabel` on each
// of the viewer's stakes; the in-play pods' names arrive as `labelsById`
// (GET /api/backing/team-labels). The group documents below still carry
// `seatNames` — and the strip must IGNORE them: the names it shows are these.
const LABEL = { 'od-a': 'Shadow', 'od-b': 'Kestrel', 'od-x': 'Orbit', 'cpu-1': 'CPU — Trend Follower', 'cpu-2': 'CPU — Contrarian', 'cpu-3': 'CPU — Diversifier', 'cpu-4': 'CPU — Speculator' };
const SECONDARY = { 'od-a': 'Mira', 'od-b': 'Draco', 'od-x': 'Rigel' };
const named = (id) => ({ label: LABEL[id], secondary: SECONDARY[id] ?? null });
const labelsFor = (...groupIds) => Object.fromEntries(groupIds.map((g) => [g, Object.fromEntries(Object.keys(LABEL).map((id) => [id, named(id)]))]));

const pod = (groupId, over = {}) => ({
  groupId, formationPath: 'lobby', slotId: null, baseLayerWeek: '2026-W40',
  teams: [
    { odUserId: 'od-a', isCpu: false, ...named('od-a'), isOwnSeat: false, backable: true },
    { odUserId: 'od-b', isCpu: false, ...named('od-b'), isOwnSeat: false, backable: true },
    { odUserId: 'cpu-1', isCpu: true, ...named('cpu-1'), isOwnSeat: false, backable: true },
    { odUserId: 'cpu-2', isCpu: true, ...named('cpu-2'), isOwnSeat: false, backable: true },
  ],
  humanTeams: 2, pool: openPool(), myStakes: [], ...over,
});

const inPlayGroup = (over = {}) => ({
  status: 'battle', seatNames: { 'od-a': 'Mira', 'od-x': 'Rigel' },
  players: [{ odUserId: 'od-a' }, { odUserId: 'od-x' }, { odUserId: 'cpu-3', isCpu: true }, { odUserId: 'cpu-4', isCpu: true }],
  // day 2 banked TODAY (Tuesday) — the League's own reading of "which day" (deriveCurrentTradingDay).
  dailyScores: { day2: { recordedDate: '2026-09-22', closeScores: { 'od-a': { compositePoints: 4.8 }, 'od-x': { compositePoints: 5.1 }, 'cpu-3': { compositePoints: 1 }, 'cpu-4': { compositePoints: -0.5 } } } },
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
        pod('g1', { myStakes: [{ stakeId: 's1', teamOdUserId: 'od-a', teamLabel: LABEL['od-a'], amount: 250, status: 'live' }] }),
        pod('g2', { myStakes: [{ stakeId: 's2', teamOdUserId: 'cpu-1', teamLabel: LABEL['cpu-1'], amount: 100, status: 'live' }, { stakeId: 's3', teamOdUserId: 'od-b', teamLabel: LABEL['od-b'], amount: 50, status: 'voided' }] }),
        pod('g3'),
      ],
      now: TUE,
    });
    expect(s.kind).toBe(STRIP_KIND.STAKED);
    expect(s.pods).toBe(2);
    expect(s.closesAt).toBe(SUNDAY_CLOSE);
    expect(s.stakes.map((x) => [x.teamName, x.amount])).toEqual([['Shadow', 250], ['CPU — Trend Follower', 100]]);
    expect(s.stakes.every((x) => typeof x.podName === 'string' && x.podName.length > 0)).toBe(true);
  });

  it('WEEK — the viewer has stakes IN PLAY (pool closed, pod in battle): day N of 5 and where the teams stand', () => {
    const s = deriveStripState({
      pods: [pod('g-next')],
      inPlay: {
        stakes: [{ id: 's9', groupId: 'g-play', teamOdUserId: 'od-a', amount: 250, status: 'live', weekKey: '2026-W39' }],
        poolsById: { 'g-play': { status: 'closed', closesAt: '2026-09-21T03:59:59.000Z' } },
        groupsById: { 'g-play': inPlayGroup() },
        labelsById: labelsFor('g-play'),
      },
      now: WED,
    });
    expect(s.kind).toBe(STRIP_KIND.WEEK);
    expect(s.day).toBe(3);
    expect(s.pods).toBe(1);
    expect(s.teams).toEqual([{
      groupId: 'g-play', podName: s.teams[0].podName, teamOdUserId: 'od-a', teamName: 'Shadow', amount: 250, rank: 2, score: 4.8, seatCount: 4,
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
    const s = deriveStripState({ pods: [pod('g1', { myStakes: [{ stakeId: 's1', teamOdUserId: 'od-a', teamLabel: LABEL['od-a'], amount: 100, status: 'live' }] })], inPlay: inPlayLive, now: WED });
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
      pods: [pod('g1', { myStakes: [{ stakeId: 's1', teamOdUserId: 'od-a', teamLabel: LABEL['od-a'], amount: 100, status: 'live' }] })],
      inPlay: { stakes: [{ id: 's1', groupId: 'g1', teamOdUserId: 'od-a', amount: 100, status: 'live' }], poolsById: { g1: openPool() }, groupsById: {} },
      now: TUE,
    });
    expect(s.kind).toBe(STRIP_KIND.STAKED);
  });

  it('a stake whose pool document is not known (undelivered or unreadable) is UNKNOWN — neither in play nor settled; the strip never guesses a week or a result from it', () => {
    // SEAL-1 (docs/audits/20260922_BACKING_PR4_MULTILENS_REVIEW.md): a null pool
    // used to put the stake in play and rank a pod that had not battled.
    const s = deriveStripState({
      pods: [],
      inPlay: {
        stakes: [{ id: 's1', groupId: 'g-unknown', teamOdUserId: 'od-a', amount: 100, status: 'live', weekKey: '2026-W39' }],
        poolsById: {},
        groupsById: { 'g-unknown': inPlayGroup({ status: 'forming', dailyScores: {} }) },
      },
      now: WED,
    });
    expect(s.kind).toBe(STRIP_KIND.QUIET);
  });

  it('in play before the first close has banked: the team rows carry NO rank and NO score — seat order is never a standing', () => {
    const s = deriveStripState({
      pods: [],
      inPlay: {
        stakes: [{ id: 's1', groupId: 'g-play', teamOdUserId: 'od-a', amount: 100, status: 'live', weekKey: '2026-W39' }],
        poolsById: { 'g-play': { status: 'closed' } },
        groupsById: { 'g-play': inPlayGroup({ dailyScores: {} }) },
        labelsById: labelsFor('g-play'),
      },
      now: WED,
    });
    expect(s.kind).toBe(STRIP_KIND.WEEK);
    expect(s.teams).toHaveLength(1);
    expect(s.teams[0]).toMatchObject({ teamName: 'Shadow', amount: 100, rank: null, score: null });
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
  it('D-af: teamLabelOf renders the SERVER\'s label and nothing else — a missing or blank one reads "Unnamed team", never an id', () => {
    expect(teamLabelOf({ label: 'Shadow', secondary: 'Mira' })).toBe('Shadow');
    expect(teamLabelOf('Shadow')).toBe('Shadow');
    for (const missing of [null, undefined, {}, { label: '' }, { label: '   ' }, { secondary: 'Mira' }]) {
      expect(teamLabelOf(missing)).toBe('Unnamed team');
    }
  });

  it('D-af: podTeamLabel reads the labels map by pod and seat — a seat the map does not carry is "Unnamed team", never its id', () => {
    const labels = labelsFor('g-play');
    expect(podTeamLabel(labels, 'g-play', 'od-a')).toEqual({ label: 'Shadow', secondary: 'Mira' });
    expect(podTeamLabel(labels, 'g-play', 'cpu-3')).toEqual({ label: 'CPU — Diversifier', secondary: null });
    expect(podTeamLabel(labels, 'g-play', 'od-zz')).toEqual({ label: 'Unnamed team', secondary: null });
    expect(podTeamLabel(null, 'g-x', 'od-a')).toEqual({ label: 'Unnamed team', secondary: null });
  });

  it('WIRING-5: a pod the map does not carry YET reads the pending placeholder — a name on its way is not "Unnamed team"', () => {
    const labels = labelsFor('g-play');
    expect(podTeamLabel(labels, 'g-later', 'od-a')).toEqual({ label: TEAM_NAME_PENDING, secondary: null });
    expect(podTeamLabel({}, 'g-play', 'od-a').label).toBe(TEAM_NAME_PENDING);
    // A pod the map DOES carry names what it carries, and a team it does not is neutral.
    expect(podTeamLabel({ 'g-play': {} }, 'g-play', 'od-a').label).toBe(UNNAMED_TEAM_LABEL);
  });

  it('RAWID-R-2: podTeamLayers names the player and the agent APART — from the server\'s layers, never guessed from a lone label', () => {
    const layered = { 'g-play': {
      'od-a': { label: 'Shadow', secondary: 'Mira', player: 'Mira', agent: 'Shadow' },
      'od-b': { label: 'Shadow', secondary: null, player: null, agent: 'Shadow' },      // the player unnamed
      'od-c': { label: 'Cy', secondary: null, player: 'Cy', agent: null },              // no agent
      'cpu-3': { label: 'CPU — Diversifier', secondary: null, player: 'CPU — Diversifier', agent: 'CPU — Diversifier' },
    } };
    expect(podTeamLayers(layered, 'g-play', 'od-a')).toEqual({ player: 'Mira', agent: 'Shadow' });
    expect(podTeamLayers(layered, 'g-play', 'od-b')).toEqual({ player: UNNAMED_TEAM_LABEL, agent: 'Shadow' });
    expect(podTeamLayers(layered, 'g-play', 'od-c')).toEqual({ player: 'Cy', agent: null });
    expect(podTeamLayers(layered, 'g-play', 'cpu-3')).toEqual({ player: 'CPU — Diversifier', agent: 'CPU — Diversifier' });
    // An older reply without the layers: only what is CERTAIN — a label WITH a secondary is the agent's.
    expect(podTeamLayers({ g: { x: { label: 'Shadow', secondary: 'Mira' } } }, 'g', 'x')).toEqual({ player: 'Mira', agent: 'Shadow' });
    expect(podTeamLayers({ g: { x: { label: 'Shadow', secondary: null } } }, 'g', 'x')).toEqual({ player: UNNAMED_TEAM_LABEL, agent: null });
    // On their way: both layers wait.
    expect(podTeamLayers({}, 'g-play', 'od-a')).toEqual({ player: TEAM_NAME_PENDING, agent: TEAM_NAME_PENDING });
  });

  it('D-af: the strip IGNORES a group document\'s seatNames — the in-play names are the server\'s, or neutral', () => {
    const inPlay = {
      stakes: [{ id: 's9', groupId: 'g-play', teamOdUserId: 'od-a', amount: 250, status: 'live', weekKey: '2026-W39' }],
      poolsById: { 'g-play': { status: 'closed' } },
      groupsById: { 'g-play': inPlayGroup() },   // seatNames: od-a → 'Mira'
    };
    const withLabels = deriveStripState({ pods: [], inPlay: { ...inPlay, labelsById: labelsFor('g-play') }, now: WED });
    expect(withLabels.teams[0].teamName).toBe('Shadow');
    const without = deriveStripState({ pods: [], inPlay, now: WED });
    expect(without.teams[0].teamName).toBe('Unnamed team');
    expect(JSON.stringify(without)).not.toContain('Mira');
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
      myStakes: [{ stakeId: 's1', teamOdUserId: 'od-a', teamLabel: LABEL['od-a'], amount: 250, status: 'live' }],
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

describe('the PR 4 review record — DOM-1, FAB-1 (docs/audits/20260922_BACKING_PR4_MULTILENS_REVIEW.md)', () => {
  it('DOM-1: a live stake on a listed pod whose pool CLOSED at its fire is the viewer’s backing now — STAKED, locked, no close to show', () => {
    const s = deriveStripState({
      pods: [pod('lds-wed', { formationPath: 'slot', slotId: 'wed-1900', pool: openPool({ status: 'closed', closesAt: WED_FIRE, closeReason: 'fire' }), myStakes: [{ stakeId: 's1', teamOdUserId: 'od-a', teamLabel: LABEL['od-a'], amount: 250, status: 'live' }] })],
      inPlay: { stakes: [], poolsById: {}, groupsById: {} },
      now: SAT,
    });
    expect(s.kind).toBe(STRIP_KIND.STAKED);
    expect(s.pods).toBe(1);
    expect(s.closesAt).toBeNull();
    expect(s.stakes).toEqual([expect.objectContaining({ teamName: 'Shadow', amount: 250, closed: true })]);
  });

  it('DOM-1: with one open and one fire-closed staked pod the window’s close is the OPEN pool’s', () => {
    const s = deriveStripState({
      pods: [
        pod('g-open', { myStakes: [{ stakeId: 's1', teamOdUserId: 'od-a', teamLabel: LABEL['od-a'], amount: 100, status: 'live' }] }),
        pod('lds-wed', { pool: openPool({ status: 'closed', closesAt: WED_FIRE, closeReason: 'fire' }), myStakes: [{ stakeId: 's2', teamOdUserId: 'od-b', teamLabel: LABEL['od-b'], amount: 50, status: 'live' }] }),
      ],
      now: TUE,
    });
    expect(s.kind).toBe(STRIP_KIND.STAKED);
    expect(s.pods).toBe(2);
    expect(s.closesAt).toBe(SUNDAY_CLOSE);
    expect(s.stakes.map((x) => x.closed)).toEqual([false, true]);
  });

  it('a listed pod’s stakes are read from the list only — the same stake arriving through the week subscription is not counted twice', () => {
    const stake = { stakeId: 's1', id: 's1', groupId: 'g-open', teamOdUserId: 'od-a', teamLabel: LABEL['od-a'], amount: 100, status: 'live', weekKey: '2026-W40' };
    const s = deriveStripState({
      pods: [pod('g-open', { myStakes: [stake] })],
      inPlay: { stakes: [stake], poolsById: { 'g-open': openPool() }, groupsById: {} },
      now: TUE,
    });
    expect(s.kind).toBe(STRIP_KIND.STAKED);
    expect(s.pods).toBe(1);
    expect(s.stakes).toHaveLength(1);
  });

  it('FAB-1: a complete pod whose pool has NOT resolved is settling — WEEK, never "Last week banked"', () => {
    const s = deriveStripState({
      pods: [],
      inPlay: {
        stakes: [{ id: 's1', groupId: 'g-done', teamOdUserId: 'od-a', amount: 250, status: 'live', weekKey: '2026-W39' }],
        poolsById: { 'g-done': { status: 'resolving', holdReason: 'agent_layer_absent' } },
        groupsById: { 'g-done': inPlayGroup({ status: 'complete' }) },
        labelsById: labelsFor('g-done'),
      },
      now: SAT,
    });
    expect(s.kind).toBe(STRIP_KIND.WEEK);
    expect(s.settling).toBe(true);
    expect(s.teams[0]).toMatchObject({ teamName: 'Shadow', amount: 250, rank: 2 });
  });

  it('a closed pool on a pod whose document has not arrived is not guessed in play or pending', () => {
    const s = deriveStripState({
      pods: [],
      inPlay: { stakes: [{ id: 's1', groupId: 'g-x', teamOdUserId: 'od-a', amount: 100, status: 'live', weekKey: '2026-W39' }], poolsById: { 'g-x': { status: 'closed' } }, groupsById: {} },
      now: TUE,
    });
    expect(s.kind).toBe(STRIP_KIND.QUIET);
  });
});

describe('the PR 4 review record — refutation pass (R-A-1, R-A-4, R-A-5, FAB-9)', () => {
  it('backingWeekKeys reads LAST week, this week and the window’s week — a holiday-short week banks its day 5 on the following Monday (R-A-1)', () => {
    const monday = new Date('2026-09-14T14:00:00.000Z'); // Mon 14 Sep 10:00 ET, the Monday after Labor Day week
    expect(backingWeekKeys(monday, '2026-W39')).toEqual(['2026-W37', '2026-W38', '2026-W39']);
    expect(backingWeekKeys(monday, null)).toEqual(['2026-W37', '2026-W38']);
    expect(backingWeekKeys(monday, '2026-W38')).toEqual(['2026-W37', '2026-W38']);
  });

  it('podDayOfFive is the pod’s banking record: the latest banked day if it banked today, else the next; 5 once complete; null without a pod (FAB-9)', () => {
    const wedEvening = new Date('2026-09-23T22:00:00.000Z');
    expect(podDayOfFive(inPlayGroup({ dailyScores: { day1: { recordedDate: '2026-09-21' }, day2: { recordedDate: '2026-09-22' }, day3: { recordedDate: '2026-09-23' } } }), wedEvening)).toBe(3);
    expect(podDayOfFive(inPlayGroup({ dailyScores: { day1: { recordedDate: '2026-09-21' }, day2: { recordedDate: '2026-09-22' } } }), wedEvening)).toBe(3);
    expect(podDayOfFive(inPlayGroup({ dailyScores: {} }), wedEvening)).toBe(1);
    // A holiday-short week: its day 5 banks the FOLLOWING Monday — the pod still reads day 5, never the calendar's "day 1".
    expect(podDayOfFive(inPlayGroup({ dailyScores: { day1: {}, day2: {}, day3: {}, day4: { recordedDate: '2026-09-11' } } }), new Date('2026-09-14T14:00:00.000Z'))).toBe(5);
    expect(podDayOfFive(inPlayGroup({ status: 'complete', dailyScores: { day5: { recordedDate: '2026-09-18' } } }), new Date('2026-09-26T16:00:00.000Z'))).toBe(5);
    expect(podDayOfFive(null, wedEvening)).toBeNull();
  });

  it('the WEEK day is the pods’ banking record, not the calendar: three closes banked before today reads day 4 on a Wednesday', () => {
    const s = deriveStripState({
      pods: [],
      inPlay: {
        stakes: [{ id: 's1', groupId: 'g-play', teamOdUserId: 'od-a', amount: 100, status: 'live', weekKey: '2026-W39' }],
        poolsById: { 'g-play': { status: 'closed' } },
        groupsById: { 'g-play': inPlayGroup({ dailyScores: { day1: { recordedDate: '2026-09-21', closeScores: {} }, day2: { recordedDate: '2026-09-22', closeScores: {} }, day3: { recordedDate: '2026-09-23', closeScores: {} } } }) },
      },
      now: new Date('2026-09-24T14:00:00.000Z'), // Thursday morning
    });
    expect(s.kind).toBe(STRIP_KIND.WEEK);
    expect(s.day).toBe(4);
  });

  it('R-A-4: a listed pod fired thin (pool insufficient, the stake voided) reads BETWEEN — never "No pods to back yet"', () => {
    const s = deriveStripState({
      pods: [pod('lds-wed', { pool: openPool({ status: 'insufficient', closesAt: WED_FIRE }), myStakes: [{ stakeId: 's1', teamOdUserId: 'od-a', teamLabel: LABEL['od-a'], amount: 250, status: 'voided' }] })],
      inPlay: { stakes: [], poolsById: {}, groupsById: {} },
      now: SAT,
      backingWeekCloses: SUNDAY_CLOSE,
    });
    expect(s.kind).toBe(STRIP_KIND.BETWEEN);
    expect(s.pods).toBe(1);
  });

  it('R-A-4: a voided stake on a listed CLOSED pool is settled, not the window’s', () => {
    const s = deriveStripState({
      pods: [pod('lds-wed', { pool: openPool({ status: 'closed', closesAt: WED_FIRE }), myStakes: [{ stakeId: 's1', teamOdUserId: 'od-a', teamLabel: LABEL['od-a'], amount: 250, status: 'voided' }] })],
      now: SAT,
    });
    expect(s.kind).toBe(STRIP_KIND.BETWEEN);
  });

  it('R-A-5: Monday morning the list still names last night’s week — a listed pod already IN BATTLE with a live stake reads WEEK, not locked', () => {
    const s = deriveStripState({
      pods: [pod('g-mon', { groupStatus: 'battle', pool: openPool({ status: 'closed' }), myStakes: [{ stakeId: 's1', teamOdUserId: 'od-a', teamLabel: LABEL['od-a'], amount: 250, status: 'live' }] })],
      inPlay: { stakes: [], poolsById: {}, groupsById: { 'g-mon': inPlayGroup({ status: 'battle', dailyScores: {} }) } },
      now: new Date('2026-09-21T12:00:00.000Z'), // Monday 08:00 ET
    });
    expect(s.kind).toBe(STRIP_KIND.WEEK);
    expect(s.day).toBe(1);
    expect(s.teams[0]).toMatchObject({ teamName: 'Shadow', amount: 250, rank: null });
  });
});

describe('stripLines — the ONE mapping the landing strip and the screen header share (R-B-1)', () => {
  it('a window whose every staked pool has closed reads "Closed · plays Monday"; a settling week reads "Complete · settling"', () => {
    expect(stripLines({ kind: 'staked', pods: 1, closesAt: null, stakes: [] })).toMatchObject({ head: 'Your backing · 1 pod', when: 'Closed · plays Monday' });
    expect(stripLines({ kind: 'staked', pods: 2, closesAt: SUNDAY_CLOSE, stakes: [] })).toMatchObject({ when: 'Closes Sun 11:59 PM ET' });
    expect(stripLines({ kind: 'week', day: 5, settling: true, pods: 1, teams: [] })).toMatchObject({ head: 'Your backing · day 5 of 5', when: 'Complete · settling' });
    expect(stripLines({ kind: 'week', day: 2, settling: false, pods: 1, teams: [] })).toMatchObject({ when: 'Settles after Friday’s close' });
    expect(stripLines({ kind: 'between', pods: 1, reopens: 'monday' })).toMatchObject({ head: 'Last week’s result', when: 'Pools open again Monday' });
    expect(stripLines({ kind: 'open', pods: 3, closesAt: SUNDAY_CLOSE })).toMatchObject({ head: 'Backing open · 3 pods', when: 'Closes Sun 11:59 PM ET' });
    expect(stripLines(null)).toMatchObject({ kind: 'quiet', head: 'Backing' });
  });
});

describe('the desktop door (Backing desktop layouts): the window is the pod list\'s, the section is the strip state\'s', () => {
  it('backingWindow — open while ANY listed pool is open, closing at the latest of their closes; null otherwise', async () => {
    const { backingWindow } = await import('./backingStripState');
    const pool = (status, closesAt) => ({ pool: { status, closesAt } });
    expect(backingWindow([])).toBeNull();
    expect(backingWindow([pool('closed', '2026-09-23T23:00:00.000Z')])).toBeNull();
    expect(backingWindow([pool('open', '2026-09-23T23:00:00.000Z'), pool('open', '2026-09-28T03:59:59.000Z'), pool('closed', '2026-09-30T00:00:00.000Z')]))
      .toEqual({ kind: 'open', pods: 2, closesAt: '2026-09-28T03:59:59.000Z' });
  });
  it('stripSection — Monday–Friday\'s Your Backing for the week, the results once banked, the window otherwise', async () => {
    const { stripSection, STRIP_KIND, DESK_SECTION } = await import('./backingStripState');
    expect(stripSection({ kind: STRIP_KIND.WEEK })).toBe(DESK_SECTION.WEEK);
    expect(stripSection({ kind: STRIP_KIND.BETWEEN })).toBe(DESK_SECTION.RESULTS);
    for (const kind of [STRIP_KIND.OPEN, STRIP_KIND.STAKED, STRIP_KIND.QUIET]) expect(stripSection({ kind })).toBe(DESK_SECTION.WINDOW);
    expect(stripSection(null)).toBe(DESK_SECTION.WINDOW);
  });
});

describe('WIRE-R-2 — a pod CANCELLED after its pool closed never reads "plays Monday" (the desktop review record)', () => {
  /** The viewer's live stake on a slot pod whose pool closed at its fire; `g` is the pod as read. */
  const cancelled = (g, pool = { status: 'closed' }) => ({
    stakes: [{ id: 's1', groupId: 'lds-wed', teamOdUserId: 'od-a', amount: 250, status: 'live', weekKey: '2026-W40' }],
    poolsById: { 'lds-wed': pool },
    groupsById: { 'lds-wed': g },
    labelsById: labelsFor('lds-wed'),
  });
  const lines = (state) => stripLines(state);

  it('a live stake on a pod VOIDED or EXPIRED after its pool closed is not the window\'s — never "Closed · plays Monday", never in play', () => {
    for (const status of ['voided', 'expired']) {
      // Nothing else: the strip does not invent a window, a week or a result for it.
      const alone = deriveStripState({ pods: [], inPlay: cancelled(inPlayGroup({ status })), now: WED, backingWeekCloses: SUNDAY_CLOSE });
      expect(alone.kind, status).toBe(STRIP_KIND.QUIET);
      expect(lines(alone).when).not.toMatch(/plays Monday/);
      // Beside an open window, the window — the cancelled stake is not in it.
      const beside = deriveStripState({ pods: [pod('g-open')], inPlay: cancelled(inPlayGroup({ status })), now: WED, backingWeekCloses: SUNDAY_CLOSE });
      expect(beside).toMatchObject({ kind: STRIP_KIND.OPEN, pods: 1 });
      expect(lines(beside).when).not.toMatch(/plays Monday/);
      // A HELD pool on the cancelled pod reads the same.
      expect(deriveStripState({ pods: [], inPlay: cancelled(inPlayGroup({ status }), { status: 'resolving' }), now: WED }).kind).toBe(STRIP_KIND.QUIET);
    }
    // The same stake on a pod that will play IS the window's, locked — the row can fail.
    const playing = deriveStripState({ pods: [], inPlay: cancelled(inPlayGroup({ status: 'drafting', dailyScores: {} })), now: WED });
    expect(playing.kind).toBe(STRIP_KIND.STAKED);
    expect(lines(playing).when).toBe('Closed · plays Monday');
  });

  it('a GONE pod (the group read answered with no document) is not guessed either', () => {
    expect(deriveStripState({ pods: [], inPlay: cancelled(null), now: WED }).kind).toBe(STRIP_KIND.QUIET);
  });

  it('once the refund lands the stake is settled (voided on a refunded pool) — the between state, as every voided stake is (R-A-4)', () => {
    const refunded = cancelled(inPlayGroup({ status: 'voided' }), { status: 'refunded', refundReason: 'group_voided' });
    refunded.stakes[0] = { ...refunded.stakes[0], status: 'voided', voidReason: 'group_voided' };
    expect(deriveStripState({ pods: [], inPlay: refunded, now: WED, backingWeekCloses: SUNDAY_CLOSE }).kind).toBe(STRIP_KIND.BETWEEN);
  });

  it('podCancellation — cancelled only after the pool closed, only on a voided / expired / GONE pod, and never on a read still on its way', async () => {
    const { podCancellation } = await import('./backingStripState');
    expect(podCancellation({ pool: { status: 'closed' }, group: { status: 'voided' } })).toEqual({ refunded: false });
    expect(podCancellation({ pool: { status: 'resolving' }, group: { status: 'expired' } })).toEqual({ refunded: false });
    expect(podCancellation({ pool: { status: 'refunded' }, group: { status: 'voided' } })).toEqual({ refunded: true });
    expect(podCancellation({ pool: { status: 'closed' }, group: null, answered: true })).toEqual({ refunded: false });
    expect(podCancellation({ pool: { status: 'closed' }, group: null, answered: false })).toBeNull();
    expect(podCancellation({ pool: { status: 'closed' }, group: { status: 'battle' } })).toBeNull();
    expect(podCancellation({ pool: { status: 'refunded' }, group: { status: 'battle' } })).toBeNull();   // an admin refund of a pod that plays
    expect(podCancellation({ pool: { status: 'insufficient' }, group: { status: 'voided' } })).toBeNull(); // voided at the close already
    expect(podCancellation({ pool: { status: 'open' }, group: { status: 'expired' } })).toBeNull();
    expect(podCancellation({ pool: null, group: { status: 'voided' } })).toBeNull();
  });
});

describe('N4 — nextCloseRereadAt: the ONE instant the strip re-reads for a close (the desktop review record)', () => {
  it('the earliest close among the listed OPEN pools, plus the grace — never a closed pool\'s, never an unreadable one, never one already behind us', async () => {
    const { CLOSE_REREAD_GRACE_MS, nextCloseRereadAt } = await import('./backingStripState');
    const wedMs = new Date(WED_FIRE).getTime();
    const sunMs = new Date(SUNDAY_CLOSE).getTime();
    const pods = [pod('g-sun'), pod('g-wed', { pool: openPool({ closesAt: WED_FIRE }) }), pod('g-closed', { pool: openPool({ status: 'closed', closesAt: '2026-09-23T15:00:00.000Z' }) }), pod('g-bad', { pool: openPool({ closesAt: 'not a date' }) })];
    expect(nextCloseRereadAt(pods, WED.getTime())).toBe(wedMs + CLOSE_REREAD_GRACE_MS);
    // Inside the grace the passed close still holds the timer (a re-render there must not drop its re-read)…
    expect(nextCloseRereadAt(pods, wedMs + 1)).toBe(wedMs + CLOSE_REREAD_GRACE_MS);
    // …and once its re-read is due, it arms nothing more: the next close takes over.
    expect(nextCloseRereadAt(pods, wedMs + CLOSE_REREAD_GRACE_MS)).toBe(sunMs + CLOSE_REREAD_GRACE_MS);
    expect(nextCloseRereadAt(pods, sunMs + CLOSE_REREAD_GRACE_MS)).toBeNull();
    expect(nextCloseRereadAt([], WED.getTime())).toBeNull();
    expect(nextCloseRereadAt(null, WED.getTime())).toBeNull();
    expect(CLOSE_REREAD_GRACE_MS).toBeGreaterThan(0);
  });

  it('the stake signal (PRE-1): every listener hears a confirmed stake, a failing one never silences the rest, and an unsubscribed one hears nothing', async () => {
    const { announceStakePlaced, onStakePlaced } = await import('./backingStakeSignal');
    const heard = [];
    const warn = console.warn;
    console.warn = () => {};
    try {
      const offA = onStakePlaced((reply) => heard.push(['a', reply.stake.stakeId]));
      const offBad = onStakePlaced(() => { throw new Error('boom'); });
      const offB = onStakePlaced((reply) => heard.push(['b', reply.stake.stakeId]));
      announceStakePlaced({ stake: { stakeId: 's1' } });
      expect(heard).toEqual([['a', 's1'], ['b', 's1']]);
      offA(); offBad(); offB();
      announceStakePlaced({ stake: { stakeId: 's2' } });
      expect(heard).toHaveLength(2);
      expect(onStakePlaced('not a function')).toBeTypeOf('function');
    } finally {
      console.warn = warn;
    }
  });
});
