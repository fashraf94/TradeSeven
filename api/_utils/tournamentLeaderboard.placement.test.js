// api/_utils/tournamentLeaderboard.placement.test.js
//
// Weekly Ladder — the placement-points battery (spec
// 20260831_WEEKLY_LADDER_BUILD_SPEC_V1 §1-§3/§6, acceptance 1-4).
//
// This file runs the ladder flag ON. The flag-OFF guarantee (acceptance 7 —
// byte-identical rows and month entries) is asserted in the sibling
// tournamentLeaderboard.test.js, which leaves WEEKLY_LADDER_PLACEMENT_ENABLED at
// its real dark value; the two files are deliberately split so neither can
// silently assert the other's posture.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): this file's real import of
// tournamentLeaderboard.js IS the runtime guard that its transitive import
// surface stays Node-clean. Never mock that import.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Both flags overridden: the freeze off (this battery exercises normal writes,
// as the P6a battery does) and the ladder ON. All other flags keep their real
// value via the importOriginal spread.
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  TOURNAMENT_ADVANCEMENT_FROZEN: false,
  WEEKLY_LADDER_PLACEMENT_ENABLED: true,
}));

import {
  PLACEMENT_POINTS,
  placementPointsFor,
  buildPlacementForGroup,
  buildGroupWeekRows,
  upsertLeaderboardForGroups,
  aggregateTournamentLeaderboards,
} from './tournamentLeaderboard.js';
import { GROUP_STATUS } from '../../src/constants/leagueTournament.js';

const NOW = new Date('2026-06-19T21:20:00.000Z');
const NOW_ISO = NOW.toISOString();

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

// ==================== IN-MEMORY FIRESTORE (the advancement-battery idiom) ====================

function makeDb(initial = {}) {
  const store = new Map(Object.entries(initial).map(([k, v]) => [k, structuredClone(v)]));
  const writeLog = [];

  function makeDocRef(path) {
    return {
      path,
      get: async () => {
        const data = store.get(path);
        return { exists: data !== undefined, id: path.split('/').pop(), data: () => structuredClone(data) };
      },
      set: async (data) => { store.set(path, structuredClone(data)); writeLog.push(['set', path]); },
    };
  }

  function topLevelDocs(prefix) {
    const docs = [];
    for (const [path, data] of store.entries()) {
      if (!path.startsWith(`${prefix}/`)) continue;
      const rel = path.slice(prefix.length + 1);
      if (rel.includes('/')) continue;
      docs.push({ id: rel, data: () => structuredClone(data) });
    }
    return docs;
  }

  const db = {
    collection: (name) => ({
      doc: (id) => makeDocRef(`${name}/${id}`),
      where: (field, _op, value) => ({
        get: async () => {
          const docs = topLevelDocs(name).filter(d => d.data()[field] === value);
          return { docs, empty: docs.length === 0, forEach: (cb) => docs.forEach(cb) };
        },
      }),
    }),
    runTransaction: async (fn) => fn({
      get: async (ref) => ref.get(),
      set: (ref, data) => { store.set(ref.path, structuredClone(data)); writeLog.push(['tx.set', ref.path]); },
    }),
  };
  return { db, store, writeLog };
}

// ==================== FIXTURES ====================

/** A group with `days` banked days carrying full P6a snapshots. */
function group({
  id = 'g1',
  day1Date = '2026-06-15',
  scores = {},
  status = GROUP_STATUS.BATTLE,
  isTraining = false,
  days = 1,
  bracketGameId = null,
  baseLayerWeek = '2026-W25',
  members = null,
} = {}) {
  const dailyScores = {};
  for (let d = 1; d <= days; d++) {
    dailyScores[`day${d}`] = {
      recordedDate: d === 1 ? day1Date : `2026-06-${15 + d - 1}`,
      closeScores: Object.fromEntries(Object.entries(scores).map(([uid, v]) => [uid, {
        totalPoints: v.user ?? 0,
        agentPoints: v.agent ?? 0,
        compositePoints: v.composite,
        picks: [],
      }])),
    };
  }
  return {
    id,
    status,
    roundNumber: 1,
    ...(bracketGameId != null ? { bracketGameId } : { baseLayerWeek }),
    groupMembers: members || Object.keys(scores),
    players: Object.keys(scores).map(uid => ({
      odUserId: uid,
      picks: [],
      ...(uid.startsWith('cpu-') ? { isCpu: true } : {}),
    })),
    dailyScores,
    ...(isTraining ? { isTraining: true } : {}),
  };
}

// composites 60 / 40 / 20 / -40 → mean 20 → margins +40 / +20 / 0 / -60
const SPREAD = {
  founder: { composite: 60 },
  u2: { composite: 40 },
  'cpu-1': { composite: 20 },
  'cpu-2': { composite: -40 },
};

const finalGroup = (over = {}) => group({ scores: SPREAD, days: 5, ...over });

// ==================== §1 — THE AWARD ====================

describe('placementPointsFor — the 3/2/1/0 table (spec §1)', () => {
  it('awards 3 / 2 / 1 / 0 by 1-based finish', () => {
    expect(PLACEMENT_POINTS).toEqual([3, 2, 1, 0]);
    expect([1, 2, 3, 4].map(placementPointsFor)).toEqual([3, 2, 1, 0]);
  });

  it('unplaced and out-of-table finishes score 0, never undefined', () => {
    expect(placementPointsFor(0)).toBe(0);
    expect(placementPointsFor(5)).toBe(0);
    expect(placementPointsFor(null)).toBe(0);
    expect(placementPointsFor(1.5)).toBe(0);
  });
});

describe('buildPlacementForGroup — order of record + margin (spec §1/§3)', () => {
  it('ranks on the day-5 clamped composite and awards 3/2/1/0', () => {
    const p = buildPlacementForGroup(finalGroup(), true);
    expect(p.founder).toMatchObject({ placement: 1, placementPoints: 3 });
    expect(p.u2).toMatchObject({ placement: 2, placementPoints: 2 });
    expect(p['cpu-1']).toMatchObject({ placement: 3, placementPoints: 1 });
    expect(p['cpu-2']).toMatchObject({ placement: 4, placementPoints: 0 });
  });

  it('margin is the seat composite MINUS the group mean, signed', () => {
    const p = buildPlacementForGroup(finalGroup(), true);
    // mean(60, 40, 20, -40) = 20
    expect(p.founder.compositeMargin).toBe(40);
    expect(p.u2.compositeMargin).toBe(20);
    expect(p['cpu-1'].compositeMargin).toBe(0);
    expect(p['cpu-2'].compositeMargin).toBe(-60);
  });

  it('the margins over one group sum to zero (it is a mean-centred quantity)', () => {
    const p = buildPlacementForGroup(finalGroup(), true);
    const sum = Object.values(p).reduce((s, v) => s + v.compositeMargin, 0);
    expect(sum).toBeCloseTo(0, 10);
  });

  it('ranks over groupMembers — the order of record — not players', () => {
    // Two seats TIED on composite. rankByScores breaks the tie on the
    // groupMembers index, so reversing that order must reverse the placements
    // while `players` order stays constant. This is what pins the seat order to
    // lockTopTwo's, so the board cannot disagree with the advancement's cut.
    const tied = { a: { composite: 10 }, b: { composite: 10 } };
    const ab = buildPlacementForGroup(group({ scores: tied, days: 5, members: ['a', 'b'] }), true);
    const ba = buildPlacementForGroup(group({ scores: tied, days: 5, members: ['b', 'a'] }), true);
    expect([ab.a.placement, ab.b.placement]).toEqual([1, 2]);
    expect([ba.a.placement, ba.b.placement]).toEqual([2, 1]);
  });

  it('falls back to the players ids when groupMembers is absent', () => {
    const g = finalGroup();
    delete g.groupMembers;
    expect(buildPlacementForGroup(g, true).founder).toMatchObject({ placement: 1, placementPoints: 3 });
  });
});

// ==================== §4 — CPU SEATS ====================

describe('CPU seats — counted, and eligible for any position (ruling §4)', () => {
  it('a CPU may finish FIRST and take the 3 — no eligibility exclusion exists', () => {
    const cpuOnTop = group({
      days: 5,
      scores: { 'cpu-1': { composite: 99 }, founder: { composite: 10 }, u2: { composite: 5 }, 'cpu-2': { composite: 1 } },
    });
    const p = buildPlacementForGroup(cpuOnTop, true);
    expect(p['cpu-1']).toMatchObject({ placement: 1, placementPoints: 3 });
    expect(p.founder.placement).toBe(2);
  });

  it('CPU seats are ranked in, so a human beating CPUs is scored against them', () => {
    // 1 human + 3 CPUs: the human wins the pod and takes a full 3 — the monthly
    // board applies NO cpuFarmGuard (that discount lives only on the career
    // path, which this build does not touch).
    const p = buildPlacementForGroup(group({
      days: 5,
      scores: { founder: { composite: 50 }, 'cpu-1': { composite: 40 }, 'cpu-2': { composite: 30 }, 'cpu-3': { composite: 20 } },
    }), true);
    expect(p.founder).toMatchObject({ placement: 1, placementPoints: 3 });
    expect(Object.keys(p)).toHaveLength(4);
  });
});

// ==================== D1 — FINAL-ONLY AWARD ====================

describe('final-only award (founder decision D1)', () => {
  it('an unfinished week contributes nothing — 0 points, 0 margin, null placement', () => {
    const p = buildPlacementForGroup(group({ scores: SPREAD, days: 2 }), false);
    for (const seat of Object.values(p)) {
      expect(seat).toEqual({ placement: null, placementPoints: 0, compositeMargin: 0 });
    }
  });

  it('buildGroupWeekRows awards only once the week is final', () => {
    const midweek = buildGroupWeekRows(group({ scores: SPREAD, days: 2 }), NOW_ISO);
    const mid = midweek.find(r => r.odUserId === 'founder');
    expect(mid.week.final).toBe(false);
    expect(mid.week.placementPoints).toBe(0);
    expect(mid.week.placement).toBeNull();
    // the composite of record is still recorded mid-week, as it is today
    expect(mid.week.points).toBe(60);

    const banked = buildGroupWeekRows(finalGroup(), NOW_ISO).find(r => r.odUserId === 'founder');
    expect(banked.week).toMatchObject({ final: true, placement: 1, placementPoints: 3, compositeMargin: 40 });

    const completed = buildGroupWeekRows(group({ scores: SPREAD, status: GROUP_STATUS.COMPLETE }), NOW_ISO)
      .find(r => r.odUserId === 'founder');
    expect(completed.week).toMatchObject({ final: true, placement: 1, placementPoints: 3 });
  });
});

// ==================== §2 — THE MONTH TOTAL ====================

describe('the monthly board accumulates placement points (spec §2)', () => {
  it('sums placement points and margin across the season weeks', async () => {
    const { db, store } = makeDb();
    // week 1: founder 1st (3). week 2: founder 3rd (1). total 4.
    await upsertLeaderboardForGroups(db, [finalGroup({ id: 'w1', baseLayerWeek: '2026-W25' })], { now: NOW });
    await upsertLeaderboardForGroups(db, [group({
      id: 'w2', baseLayerWeek: '2026-W26', days: 5, day1Date: '2026-06-22',
      scores: { founder: { composite: 10 }, u2: { composite: 50 }, 'cpu-1': { composite: 40 }, 'cpu-2': { composite: 0 } },
    })], { now: NOW });

    const doc = store.get('tournamentLeaderboards/2026-06');
    const founder = doc.entries.founder;
    expect(founder.placementPoints).toBe(4);           // 3 + 1
    expect(Object.keys(founder.weeks)).toHaveLength(2);
    // §9: the total decomposes into the weeks that produced it
    const fromWeeks = Object.values(founder.weeks).reduce((s, w) => s + w.placementPoints, 0);
    expect(fromWeeks).toBe(founder.placementPoints);
    // margin accumulates on the same grain: +40 then (10 − 25) = −15
    expect(founder.compositeMargin).toBe(25);
  });

  it('the cumulative COMPOSITE is retained as a stored tiebreak input, not dropped', async () => {
    const { db, store } = makeDb();
    await upsertLeaderboardForGroups(db, [finalGroup()], { now: NOW });
    const founder = store.get('tournamentLeaderboards/2026-06').entries.founder;
    expect(founder.points).toBe(60);          // composite still stored
    expect(founder.placementPoints).toBe(3);  // placement is the new primary
  });

  it('training pods award nothing — the nightly aggregation never sees them', async () => {
    const { db, store } = makeDb({
      'tournamentGroups/gtrain': finalGroup({ id: 'gtrain', isTraining: true }),
    });
    const summary = await aggregateTournamentLeaderboards(db, { now: NOW });
    expect(summary.docsWritten ?? 0).toBe(0);
    expect(store.get('tournamentLeaderboards/2026-06')).toBeUndefined();
  });
});

// ==================== §6 — IDEMPOTENCY (RED-FIRST) ====================

describe('idempotency — re-running finalization does not double-award (spec §6, acceptance 3)', () => {
  // MUTATION-CHECKED (BUILD_RULES §2, founder-approved 2026-08-31): this row is
  // only a guard if it can fail. Verified by temporarily changing the month
  // accumulator in tournamentLeaderboard.js from
  //     placementPoints: Object.values(weeks).reduce(…)
  // to an increment
  //     placementPoints: (prior.placementPoints || 0) + row.week.placementPoints
  // and confirming this block goes RED (founder got 6, expected 3), then
  // reverting. The board is idempotent BY CONSTRUCTION — SET-not-increment on
  // entries.{uid}.weeks.{groupId} with the total recomputed as Σ over the weeks
  // map — so without the mutation check this assertion would pass vacuously.
  it('a second finalization of the SAME group awards once', async () => {
    const { db, store } = makeDb();
    const g = finalGroup();

    await upsertLeaderboardForGroups(db, [g], { now: NOW });
    const once = structuredClone(store.get('tournamentLeaderboards/2026-06').entries);
    expect(once.founder.placementPoints).toBe(3);

    await upsertLeaderboardForGroups(db, [g], { now: NOW });
    const twice = store.get('tournamentLeaderboards/2026-06').entries;

    expect(twice.founder.placementPoints).toBe(3);
    expect(twice['cpu-1'].placementPoints).toBe(1);
    expect(twice.founder.weeks).toEqual(once.founder.weeks);
    for (const uid of Object.keys(once)) {
      expect(twice[uid].placementPoints).toBe(once[uid].placementPoints);
      expect(twice[uid].compositeMargin).toBe(once[uid].compositeMargin);
    }
  });

  it('a THIRD replay is still stable (a retry storm cannot inflate the board)', async () => {
    const { db, store } = makeDb();
    const g = finalGroup();
    for (let i = 0; i < 3; i++) await upsertLeaderboardForGroups(db, [g], { now: NOW });
    expect(store.get('tournamentLeaderboards/2026-06').entries.founder.placementPoints).toBe(3);
  });

  it('the mid-week row is REPLACED, not added to, when the week finalizes', async () => {
    // The nightly pass writes an in-progress row (0 points); Friday's
    // finalization then SETs the same weeks.{groupId} key with the real award.
    const { db, store } = makeDb();
    await upsertLeaderboardForGroups(db, [group({ id: 'g1', scores: SPREAD, days: 2 })], { now: NOW });
    expect(store.get('tournamentLeaderboards/2026-06').entries.founder.placementPoints).toBe(0);

    await upsertLeaderboardForGroups(db, [finalGroup({ id: 'g1' })], { now: NOW });
    const founder = store.get('tournamentLeaderboards/2026-06').entries.founder;
    expect(founder.placementPoints).toBe(3);
    expect(Object.keys(founder.weeks)).toHaveLength(1); // one week, not two
  });
});
