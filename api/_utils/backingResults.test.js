// api/_utils/backingResults.test.js
//
// Backing Beta PR 5 — the results projection, pure (spec V1.3 §3, §4, §5, §7,
// §9). THE ROW THIS FILE EXISTS FOR: the payout on the card is the STAKE
// DOCUMENT's `payout`, never `stake × paysX` — the fixture is built so the two
// differ (mutation check 3 reds the row that renders the product).
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the real import of the module is
// the runtime guard for its api/ -> src/ imports. Never mock it.

import { describe, it, expect } from 'vitest';
import {
  RESULT_OUTCOME,
  TERMINAL_RESULT_STATUSES,
  loadoutChangedFor,
  monthKeyOfPool,
  outcomeOf,
  projectResultPool,
  sharePctOf,
  stakeNetOf,
  weeksOf,
} from './backingResults.js';
import { POOL_STATUS, STAKE_STATUS } from './backingPools.js';

// A settled pool where stake × paysX ≠ payout: pot 1,000 over winning stakes
// 700 (500 + 200) → paysX 1.43, but floor(500 × 1000 ÷ 700) = 714, not 715.
const SETTLED = {
  status: POOL_STATUS.RESOLVED, formationPath: 'lobby', slotId: null, humanTeams: 2, baseLayerWeek: '2026-W40',
  battleMondayEtDate: '2026-09-28', potTotal: 1000, uniqueBackers: 4, winnerOdUserIds: ['od-a'], winningStakes: 700, paysX: 1.43,
  closedAt: '2026-09-28T04:00:00.000Z', settledAt: '2026-10-02T22:30:00.000Z', monthKey: '2026-09',
  teams: [
    { odUserId: 'od-a', isCpu: false, stakeTotal: 700, backerCount: 2, paysX: 1.43, won: true, agentId: 'agent-a', hashAtSettlement: 'hash-friday' },
    { odUserId: 'od-b', isCpu: false, stakeTotal: 300, backerCount: 2, paysX: 3.33, won: false, agentId: 'agent-b', hashAtSettlement: 'hash-b' },
    { odUserId: 'cpu-1', isCpu: true, stakeTotal: 0, backerCount: 0, paysX: null, won: false, agentId: 'cpu-agent-1', hashAtSettlement: null },
  ],
};
const GROUP = { status: 'complete' };
/** The results reader's binding of the one label resolver (D-af), stubbed: agent names, player secondary. */
const NAMES = { 'od-a': { label: 'Shadow', secondary: 'Mira' }, 'od-b': { label: 'Kestrel', secondary: 'Draco' }, 'cpu-1': { label: 'CPU — Momentum', secondary: null } };
const nameTeam = (id) => NAMES[id] ?? { label: 'Unnamed team', secondary: null };
const MY_STAKES = [
  { id: 's1', groupId: 'g1', teamOdUserId: 'od-a', amount: 500, status: STAKE_STATUS.WON, payout: 714, hashAtStake: 'hash-monday', weekKey: '2026-W40' },
  { id: 's2', groupId: 'g1', teamOdUserId: 'od-b', amount: 100, status: STAKE_STATUS.LOST, payout: 0, hashAtStake: 'hash-b', weekKey: '2026-W40' },
];

describe('projectResultPool — the card\'s numbers are the documents\' (§9)', () => {
  const pod = projectResultPool({ groupId: 'g1', poolId: 'g1', pool: SETTLED, group: GROUP, myStakes: MY_STAKES, nameTeam });

  it('MUTATION CHECK 3 — the payout per stake is `stake.payout`, NEVER stake × paysX', () => {
    const mine = pod.myStakes.find((s) => s.stakeId === 's1');
    expect(mine.payout).toBe(714);
    expect(mine.payout).not.toBe(Math.round(500 * 1.43));
    expect(mine.payout).not.toBe(500 * pod.teams.find((t) => t.odUserId === 'od-a').paysX);
    expect(mine.net).toBe(214);
    const lost = pod.myStakes.find((s) => s.stakeId === 's2');
    expect(lost).toMatchObject({ payout: 0, net: -100, status: STAKE_STATUS.LOST });
    expect(pod.myNet).toBe(114);
    expect(pod.myWon).toBe(true);
  });

  it('pays × per team is §3\'s own table as settlement wrote it — null for an unbacked team', () => {
    expect(pod.teams.map((t) => [t.odUserId, t.paysX])).toEqual([['od-a', 1.43], ['od-b', 3.33], ['cpu-1', null]]);
    expect(pod.paysX).toBe(1.43);
    expect(pod.winners).toEqual(['od-a']);
    expect(pod.winningStakes).toBe(700);
  });

  it('each team\'s share is the close\'s stakeTotal ÷ potTotal, whole percent; backers per team is the close\'s count', () => {
    expect(pod.teams.map((t) => [t.odUserId, t.sharePct, t.backerCount])).toEqual([['od-a', 70, 2], ['od-b', 30, 2], ['cpu-1', 0, 0]]);
    expect(pod.potTotal).toBe(1000);
    expect(pod.uniqueBackers).toBe(4);
  });

  it('the loadout marker compares the backer\'s OWN hashAtStake with the team\'s hashAtSettlement; unknown either side → null; a CPU seat → null', () => {
    expect(pod.myStakes.find((s) => s.stakeId === 's1').loadoutChanged).toBe(true);
    expect(pod.myStakes.find((s) => s.stakeId === 's2').loadoutChanged).toBe(false);
    expect(loadoutChangedFor({ hashAtStake: null }, SETTLED.teams[0])).toBeNull();
    expect(loadoutChangedFor({ hashAtStake: 'x' }, { ...SETTLED.teams[0], hashAtSettlement: null })).toBeNull();
    expect(loadoutChangedFor({ hashAtStake: 'x' }, SETTLED.teams[2])).toBeNull();
    expect(loadoutChangedFor({ hashAtStake: 'x' }, undefined)).toBeNull();
  });

  it('MONEY-8 (this build\'s review record): a TOPPED-UP stake is never "unchanged" — its one hash is the FIRST placement\'s; a difference is still a change', () => {
    const team = { odUserId: 'od-a', isCpu: false, hashAtSettlement: 'H1' };
    const first = { entryId: 'stake:dbt_1', amount: 100 };
    const topUp = { entryId: 'stake:dbt_2', amount: 150 };
    // One placement: the marker is exactly what it always was.
    expect(loadoutChangedFor({ hashAtStake: 'H1', debits: [first] }, team)).toBe(false);
    expect(loadoutChangedFor({ hashAtStake: 'H1' }, team)).toBe(false);
    // Topped up: a match says nothing about the 150 added later (the loadout
    // may have moved and moved back) — not known, never "unchanged".
    expect(loadoutChangedFor({ hashAtStake: 'H1', debits: [first, topUp] }, team)).toBeNull();
    // A difference is a change "during the week", topped up or not.
    expect(loadoutChangedFor({ hashAtStake: 'H0', debits: [first, topUp] }, team)).toBe(true);
    // Through the projection, as the card reads it.
    const projected = projectResultPool({
      groupId: 'g1', poolId: 'g1', pool: { ...SETTLED, teams: SETTLED.teams.map((t) => (t.odUserId === 'od-a' ? { ...t, hashAtSettlement: 'H1' } : t)) },
      myStakes: [{ id: 'sx', teamOdUserId: 'od-a', amount: 250, status: STAKE_STATUS.WON, payout: 300, hashAtStake: 'H1', debits: [first, topUp] }],
    });
    expect(projected.myStakes[0].loadoutChanged).toBeNull();
  });

  it('carries the outcome word and the ladder month; never a team\'s agentId or hash', () => {
    expect(pod).toMatchObject({ groupId: 'g1', poolId: 'g1', weekKey: '2026-W40', outcome: RESULT_OUTCOME.SETTLED, monthKey: '2026-09', settledAt: SETTLED.settledAt, refundReason: null, refundedAt: null, humanTeams: 2 });
    for (const t of pod.teams) {
      expect(t).not.toHaveProperty('agentId');
      expect(t).not.toHaveProperty('hashAtSettlement');
    }
  });

  it('D-af: every name is the SERVER\'s — team rows, the viewer\'s stakes and the winner line; no seatNames map to compose from', () => {
    expect(pod.teams.map((t) => [t.odUserId, t.label, t.secondary])).toEqual([
      ['od-a', 'Shadow', 'Mira'], ['od-b', 'Kestrel', 'Draco'], ['cpu-1', 'CPU — Momentum', null],
    ]);
    expect(pod.myStakes.map((s) => [s.teamOdUserId, s.teamLabel])).toEqual([['od-a', 'Shadow'], ['od-b', 'Kestrel']]);
    // The winner line's names, in the winning set's order.
    expect(pod.winners).toEqual(['od-a']);
    expect(pod.winnerLabels).toEqual(['Shadow']);
    expect(pod).not.toHaveProperty('seatNames');
  });

  it('D-af: a projection handed NO naming function names every team neutrally — never by its id', () => {
    const bare = projectResultPool({ groupId: 'g1', pool: SETTLED, myStakes: MY_STAKES });
    for (const text of [...bare.teams.map((t) => t.label), ...bare.myStakes.map((s) => s.teamLabel), ...bare.winnerLabels]) {
      expect(text).toBe('Unnamed team');
    }
  });

  it('D-af: no winner line before a settlement — the names wait for the result', () => {
    const closed = projectResultPool({ groupId: 'g1', pool: { ...SETTLED, status: POOL_STATUS.CLOSED }, myStakes: [], nameTeam });
    expect(closed.winnerLabels).toEqual([]);
  });

  it('a REFUNDED pool is stated with its reason and instant; the viewer\'s voided stakes carry their voidReason, net 0, no payout', () => {
    const refunded = { ...SETTLED, status: POOL_STATUS.REFUNDED, refundReason: 'group_voided', refundedAt: '2026-09-29T20:30:00.000Z', winnerOdUserIds: undefined, winningStakes: undefined, paysX: undefined };
    const out = projectResultPool({ groupId: 'g1', pool: refunded, group: GROUP, myStakes: MY_STAKES.map((s) => ({ ...s, status: STAKE_STATUS.VOIDED, voidReason: 'group_voided', payout: undefined })) });
    expect(out).toMatchObject({ outcome: RESULT_OUTCOME.REFUNDED, refundReason: 'group_voided', refundedAt: '2026-09-29T20:30:00.000Z', winners: [], paysX: null, winningStakes: null, myNet: null, myWon: null });
    expect(out.myStakes.map((s) => [s.status, s.voidReason, s.payout, s.net])).toEqual([[STAKE_STATUS.VOIDED, 'group_voided', null, 0], [STAKE_STATUS.VOIDED, 'group_voided', null, 0]]);
    expect(out.teams.every((t) => t.paysX === null && t.won === null)).toBe(true);
    // The close's reveal is still stated (the book existed) — with no pays ×.
    expect(out.teams[0]).toMatchObject({ stakeTotal: 700, backerCount: 2, sharePct: 70 });
  });

  it('an INSUFFICIENT pool is its own outcome word; a closed or held pool is "settling"; an open pool is "open"', () => {
    expect(projectResultPool({ groupId: 'g1', pool: { ...SETTLED, status: POOL_STATUS.INSUFFICIENT }, myStakes: [] }).outcome).toBe(RESULT_OUTCOME.INSUFFICIENT);
    const closed = projectResultPool({ groupId: 'g1', pool: { ...SETTLED, status: POOL_STATUS.CLOSED, winnerOdUserIds: undefined }, myStakes: [{ id: 's9', teamOdUserId: 'od-a', amount: 100, status: STAKE_STATUS.LIVE }] });
    expect(closed).toMatchObject({ outcome: RESULT_OUTCOME.SETTLING, winners: [], paysX: null, myNet: null });
    expect(closed.myStakes[0]).toMatchObject({ payout: null, net: null, status: STAKE_STATUS.LIVE });
    const held = projectResultPool({ groupId: 'g1', pool: { ...SETTLED, status: POOL_STATUS.RESOLVING, holdReason: 'agent_layer_absent' }, myStakes: [] });
    expect(held).toMatchObject({ outcome: RESULT_OUTCOME.SETTLING, holdReason: 'agent_layer_absent' });
    const open = projectResultPool({ groupId: 'g1', pool: { ...SETTLED, status: POOL_STATUS.OPEN, potTotal: undefined, teams: undefined }, myStakes: [] });
    expect(open).toMatchObject({ outcome: RESULT_OUTCOME.OPEN, potTotal: null, uniqueBackers: null, teams: [] });
  });

  it('a deleted pod still projects, and still names its teams through the resolver (no group doc needed)', () => {
    const out = projectResultPool({ groupId: 'g1', pool: SETTLED, group: null, myStakes: MY_STAKES, nameTeam });
    expect(out.outcome).toBe(RESULT_OUTCOME.SETTLED);
    expect(out.podStatus).toBeNull();
    expect(out.winnerLabels).toEqual(['Shadow']);
  });
});

describe('the small pure pieces', () => {
  it('outcomeOf maps every pool status; unknown → null; the terminal set is resolved / refunded / insufficient', () => {
    expect(outcomeOf({ status: 'resolved' })).toBe('settled');
    expect(outcomeOf({ status: 'bogus' })).toBeNull();
    expect(outcomeOf(null)).toBeNull();
    expect([...TERMINAL_RESULT_STATUSES].sort()).toEqual(['insufficient', 'refunded', 'resolved']);
  });

  it('monthKeyOfPool prefers the stamped key, falls back to the battle-Monday month, and is null for a malformed pool', () => {
    expect(monthKeyOfPool({ monthKey: '2026-10', battleMondayEtDate: '2026-09-28' })).toBe('2026-10');
    expect(monthKeyOfPool({ battleMondayEtDate: '2026-09-28' })).toBe('2026-09');
    expect(monthKeyOfPool({})).toBeNull();
    expect(monthKeyOfPool(null)).toBeNull();
  });

  it('sharePctOf rounds to a whole percent and is null without a pot', () => {
    expect(sharePctOf(700, 1000)).toBe(70);
    expect(sharePctOf(2, 3)).toBe(67);
    expect(sharePctOf(0, 1000)).toBe(0);
    expect(sharePctOf(100, 0)).toBeNull();
    expect(sharePctOf(100, undefined)).toBeNull();
  });

  it('stakeNetOf: won → payout − amount, lost → −amount, voided → 0, live → null', () => {
    expect(stakeNetOf({ status: 'won', amount: 500, payout: 714 })).toBe(214);
    expect(stakeNetOf({ status: 'lost', amount: 100 })).toBe(-100);
    expect(stakeNetOf({ status: 'voided', amount: 100 })).toBe(0);
    expect(stakeNetOf({ status: 'live', amount: 100 })).toBeNull();
  });

  it('weeksOf groups the viewer\'s stakes by week, NEWEST first, with distinct sorted pods', () => {
    const weeks = weeksOf([
      { weekKey: '2026-W39', groupId: 'g-b' }, { weekKey: '2026-W40', groupId: 'g-c' },
      { weekKey: '2026-W39', groupId: 'g-a' }, { weekKey: '2026-W39', groupId: 'g-a' }, { weekKey: '2025-W52', groupId: 'g-z' },
      { weekKey: null, groupId: 'x' }, { weekKey: '2026-W41' },
    ]);
    expect(weeks).toEqual([
      { weekKey: '2026-W40', groupIds: ['g-c'] },
      { weekKey: '2026-W39', groupIds: ['g-a', 'g-b'] },
      { weekKey: '2025-W52', groupIds: ['g-z'] },
    ]);
    expect(weeksOf([])).toEqual([]);
  });
});
