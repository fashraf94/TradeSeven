// api/_utils/tournamentCpuClaims.test.js
//
// Slice 4 (B2) — CPU user-layer claim placement: the pure drop-worst/desirable-
// add heuristic, the per-pod placement with its per-cycle idempotency marker,
// and the training-scoped nightly sweep.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the real import below is the
// runtime guard for this module's api/ -> src/ import of leagueTournament.js
// (and its real reuse of tournamentClaimPlacement.js) — it explodes in this Node
// test env if a browser-only dependency ever enters the graph. Never mock it.

import { describe, it, expect } from 'vitest';
import {
  chooseCpuClaim,
  placeCpuClaimsForGroup,
  placeCpuClaimsForTrainingPods,
} from './tournamentCpuClaims.js';
import { TRAINING_TUNING, buildCpuUserBoard } from '../../src/constants/leagueTournament.js';

const NOW = new Date('2026-06-10T21:00:00Z'); // Wed 17:00 ET
const ET = '2026-06-10';

function pick(symbol) {
  return { symbol, legs: [{ direction: 'long', baselinePrice: 100, baselineSource: 'draft_resolution', openedAt: 'T0', thresholdHistory: [] }], flipCountToday: 0 };
}

// A ranked pool long enough that buildCpuUserBoard's per-CPU stagger lands
// different heads for cpu-1 vs cpu-2 (offset 0 vs 3).
const POOL = ['P0', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10', 'P11', 'P12', 'P13', 'P14'];

describe('chooseCpuClaim (drop-worst + desirable-add)', () => {
  const player = { odUserId: 'cpu-1', isCpu: true, picks: [pick('AAA'), pick('BBB'), pick('CCC')] };
  const closeScoresEntry = { picks: [
    { symbol: 'AAA', totalPoints: 5 },
    { symbol: 'BBB', totalPoints: -3 }, // worst
    { symbol: 'CCC', totalPoints: 2 },
  ] };

  it('drops the worst-scoring pick and adds the head of the CPU board', () => {
    const choice = chooseCpuClaim({ player, closeScoresEntry, userPool: POOL, cpuN: 1 });
    expect(choice.dropSymbol).toBe('BBB');
    expect(choice.addSymbol).toBe(buildCpuUserBoard(POOL, 1)[0]); // offset 0 → P0
    expect(choice.addSymbol).toBe('P0');
  });

  it('staggers the add per CPU so neighbors contest different names', () => {
    const c1 = chooseCpuClaim({ player: { ...player, odUserId: 'cpu-1' }, closeScoresEntry, userPool: POOL, cpuN: 1 });
    const c2 = chooseCpuClaim({ player: { ...player, odUserId: 'cpu-2' }, closeScoresEntry, userPool: POOL, cpuN: 2 });
    expect(c1.addSymbol).not.toBe(c2.addSymbol); // P0 vs P3
    expect(c2.addSymbol).toBe('P3');
  });

  it('never adds a name already on the roster', () => {
    // Board head collides with an owned name → skip to the next board name.
    const ownPool = ['AAA', 'ZZZ', ...POOL];
    const choice = chooseCpuClaim({ player, closeScoresEntry, userPool: ownPool, cpuN: 1 });
    expect(player.picks.map(p => p.symbol)).not.toContain(choice.addSymbol);
  });

  it('falls back to the first own pick when no snapshot is scorable', () => {
    const choice = chooseCpuClaim({ player, closeScoresEntry: undefined, userPool: POOL, cpuN: 1 });
    expect(choice.dropSymbol).toBe('AAA'); // first pick
    expect(choice.addSymbol).toBe('P0');
  });

  it('returns null on an exhausted pool or a non-CPU n', () => {
    expect(chooseCpuClaim({ player, closeScoresEntry, userPool: [], cpuN: 1 })).toBeNull();
    expect(chooseCpuClaim({ player, closeScoresEntry, userPool: POOL, cpuN: null })).toBeNull();
    expect(chooseCpuClaim({ player: { picks: [] }, closeScoresEntry, userPool: POOL, cpuN: 1 })).toBeNull();
  });
});

// ---- placement: a Firestore stand-in that backs the reserve tx (group marker)
//      and the commit tx (claims subcollection). ----
function makeDb(groupsById) {
  let seq = 0;
  const placed = []; // { groupId, claim }
  const docRef = (groupId) => ({
    id: groupId,
    get: async () => ({ exists: groupsById[groupId] != null, data: () => groupsById[groupId] }),
    collection: () => {
      const q = {
        where: () => q,
        get: async () => ({ size: 0, forEach: () => {} }), // no pre-existing pending claims
        doc: () => ({ id: `claim-${++seq}`, __groupId: groupId }),
      };
      return q;
    },
  });
  const db = {
    collection: () => ({
      where: () => ({
        get: async () => ({ forEach: (cb) => Object.entries(groupsById).forEach(([id, g]) => cb({ id, data: () => g })) }),
      }),
      doc: (id) => docRef(id),
    }),
    runTransaction: async (fn) => fn({
      get: async (x) => x.get(),
      update: (ref, data) => {
        const g = groupsById[ref.id];
        if (Object.prototype.hasOwnProperty.call(data, 'claimSystem.lastCpuClaimDay')) {
          g.claimSystem = { ...(g.claimSystem || {}), lastCpuClaimDay: data['claimSystem.lastCpuClaimDay'] };
        }
      },
      set: (ref, doc) => { placed.push({ groupId: ref.__groupId, claim: doc }); },
    }),
  };
  return { db, placed };
}

function trainingPod(overrides = {}) {
  return {
    id: 'g1',
    isTraining: true,
    status: 'battle',
    groupMembers: ['u1', 'cpu-1', 'cpu-2', 'cpu-3'],
    players: [
      { odUserId: 'u1', picks: [pick('HUM1'), pick('HUM2'), pick('HUM3')] },
      { odUserId: 'cpu-1', isCpu: true, displayName: 'Bot 1', picks: [pick('AAA'), pick('BBB'), pick('CCC')] },
      { odUserId: 'cpu-2', isCpu: true, displayName: 'Bot 2', picks: [pick('DDD'), pick('EEE'), pick('FFF')] },
      { odUserId: 'cpu-3', isCpu: true, displayName: 'Bot 3', picks: [pick('GGG'), pick('HHH'), pick('III')] },
    ],
    userPool: [...POOL],
    claimSystem: { enabled: true, currentWaiverPriority: [], processingLog: [] },
    dailyScores: {
      day1: {
        recordedDate: ET,
        closeScores: {
          'cpu-1': { picks: [{ symbol: 'AAA', totalPoints: 5 }, { symbol: 'BBB', totalPoints: -3 }, { symbol: 'CCC', totalPoints: 2 }] },
          'cpu-2': { picks: [{ symbol: 'DDD', totalPoints: -1 }, { symbol: 'EEE', totalPoints: 4 }, { symbol: 'FFF', totalPoints: 1 }] },
          'cpu-3': { picks: [{ symbol: 'GGG', totalPoints: 3 }, { symbol: 'HHH', totalPoints: 0 }, { symbol: 'III', totalPoints: -2 }] },
        },
      },
    },
    ...overrides,
  };
}

describe('placeCpuClaimsForGroup', () => {
  it('places a claim for every CPU when the probability roll passes, drop=worst', async () => {
    const group = trainingPod();
    const { db, placed } = makeDb({ g1: group });
    const res = await placeCpuClaimsForGroup(db, group, { now: NOW, etDate: ET, random: () => 0 }); // always place
    expect(res.status).toBe('placed');
    expect(res.placed).toBe(3);
    const byUser = Object.fromEntries(placed.map(p => [p.claim.odUserId, p.claim]));
    expect(byUser['cpu-1'].dropSymbol).toBe('BBB'); // -3
    expect(byUser['cpu-2'].dropSymbol).toBe('DDD'); // -1
    expect(byUser['cpu-3'].dropSymbol).toBe('III'); // -2
    expect(placed.every(p => p.claim.status === 'pending' && p.claim.rank === 1)).toBe(true);
  });

  it('is idempotent per cycle — a second call no-ops via lastCpuClaimDay', async () => {
    const group = trainingPod();
    const { db, placed } = makeDb({ g1: group });
    const first = await placeCpuClaimsForGroup(db, group, { now: NOW, etDate: ET, random: () => 0 });
    expect(first.placed).toBe(3);
    expect(group.claimSystem.lastCpuClaimDay).toBe(1); // marker reserved
    const second = await placeCpuClaimsForGroup(db, group, { now: NOW, etDate: ET, random: () => 0 });
    expect(second.status).toBe('already_placed');
    expect(second.placed).toBe(0);
    expect(placed).toHaveLength(3); // no stacking
  });

  it('places nothing when the probability roll fails for all CPUs', async () => {
    const group = trainingPod();
    const { db, placed } = makeDb({ g1: group });
    const res = await placeCpuClaimsForGroup(db, group, { now: NOW, etDate: ET, random: () => 0.99 });
    expect(res.status).toBe('no_claims');
    expect(placed).toHaveLength(0);
    // The marker is still reserved (the cycle was evaluated) → a re-run no-ops.
    expect(group.claimSystem.lastCpuClaimDay).toBe(1);
  });

  it('honors the probability threshold exactly (place iff random < CPU_CLAIM_PROBABILITY)', async () => {
    const group = trainingPod();
    const { db, placed } = makeDb({ g1: group });
    // random === threshold → NOT placed (strict <)
    await placeCpuClaimsForGroup(db, group, { now: NOW, etDate: ET, random: () => TRAINING_TUNING.CPU_CLAIM_PROBABILITY });
    expect(placed).toHaveLength(0);
  });

  it('skips non-training, non-battle, claims-disabled, and last-day pods', async () => {
    const stub = makeDb({}).db;
    expect((await placeCpuClaimsForGroup(stub, trainingPod({ isTraining: false }), { now: NOW, etDate: ET })).status).toBe('skipped');
    expect((await placeCpuClaimsForGroup(stub, trainingPod({ status: 'awaiting_open' }), { now: NOW, etDate: ET })).status).toBe('skipped');
    expect((await placeCpuClaimsForGroup(stub, trainingPod({ claimSystem: { enabled: false } }), { now: NOW, etDate: ET })).status).toBe('skipped');
    const day5 = trainingPod({ dailyScores: { day5: { recordedDate: ET, closeScores: {} } } });
    expect((await placeCpuClaimsForGroup(stub, day5, { now: NOW, etDate: ET })).reason).toBe('last_day');
  });
});

describe('placeCpuClaimsForTrainingPods (training-scoped sweep)', () => {
  it('places for training pods only and aggregates; ranked pods are untouched', async () => {
    const training = trainingPod({ id: 'g1' });
    const ranked = { ...trainingPod({ id: 'g2' }), isTraining: false };
    const { db, placed } = makeDb({ g1: training, g2: ranked });
    const summary = await placeCpuClaimsForTrainingPods(db, { now: NOW, random: () => 0 });
    expect(summary.pods).toBe(1); // only the training pod
    expect(summary.claimedPods).toBe(1);
    expect(summary.placed).toBe(3);
    expect(placed.every(p => p.groupId === 'g1')).toBe(true);
  });

  it('is a clean no-op when there are no training pods', async () => {
    const ranked = { ...trainingPod({ id: 'g2' }), isTraining: false };
    const { db } = makeDb({ g2: ranked });
    const summary = await placeCpuClaimsForTrainingPods(db, { now: NOW, random: () => 0 });
    expect(summary).toMatchObject({ pods: 0, placed: 0, claimedPods: 0 });
  });
});
