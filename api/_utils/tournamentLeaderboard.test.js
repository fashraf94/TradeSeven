// api/_utils/tournamentLeaderboard.test.js
//
// P6a battery for the seasonal-leaderboard writer. Blocks: month attribution
// (ruling A-3 — day-1 banking month, boundary-straddling weeks never split),
// upsert idempotency (re-run = same totals — the SET-not-increment grain),
// dev routing (ruling A-4 — smoke rows can never land on production docs),
// CPU marking + derived names, negative totals first-class (the
// cautionary-learning ruling), display-name resolution + degrade, and the
// nightly aggregator's zero-group production inertness.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): this file's real import of
// tournamentLeaderboard.js IS the runtime guard that its transitive import
// surface (src/constants/leagueTournament.js, the fenced-but-exported
// getArchetypeLabel) stays Node-clean. Never mock that import.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  monthKeyForGroup,
  cpuDisplayName,
  resolveDisplayNames,
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

/** A battle group with one banked day carrying full P6a snapshots. */
function group({
  id = 'g1',
  day1Date = '2026-06-15',
  scores = {},
  status = GROUP_STATUS.BATTLE,
  isDev = false,
  days = 1,
  bracketGameId = 'b-r1-g1',
} = {}) {
  const dailyScores = {};
  for (let d = 1; d <= days; d++) {
    dailyScores[`day${d}`] = {
      recordedDate: d === 1 ? day1Date : `2026-06-${15 + d - 1}`,
      closeScores: Object.fromEntries(Object.entries(scores).map(([uid, v]) => [uid, {
        totalPoints: v.user ?? 0,
        agentPoints: v.agent ?? 0,
        compositePoints: (v.agent ?? 0) + 1.5 * (v.user ?? 0),
        picks: [],
      }])),
    };
  }
  return {
    id,
    status,
    roundNumber: 1,
    bracketGameId,
    groupMembers: Object.keys(scores),
    players: Object.keys(scores).map(uid => ({
      odUserId: uid,
      picks: [],
      ...(uid.startsWith('cpu-') ? { isCpu: true } : {}),
    })),
    dailyScores,
    ...(isDev ? { isDev: true } : {}),
  };
}

const SCORES = {
  founder: { user: 20, agent: 30 },   // composite 60
  'cpu-1': { user: -10, agent: -5 },  // composite -20 — negative row, first-class
  'cpu-2': { user: 0, agent: 0 },
  'cpu-3': { user: 4, agent: 4 },     // composite 10
};

// ==================== PURE PIECES ====================

describe('monthKeyForGroup — ruling A-3 (day-1 banking month)', () => {
  it('reads day1.recordedDate; a month-straddling week never splits', () => {
    expect(monthKeyForGroup(group({ day1Date: '2026-06-29', days: 5 }))).toBe('2026-06');
  });

  it('null before the first banking (nothing to publish)', () => {
    expect(monthKeyForGroup({ dailyScores: {} })).toBeNull();
    expect(monthKeyForGroup({})).toBeNull();
  });
});

describe('cpuDisplayName — derived from the id alone', () => {
  it('names the archetype; malformed ids fall back to CPU', () => {
    expect(cpuDisplayName('cpu-1')).toMatch(/^CPU — /);
    expect(cpuDisplayName('not-a-cpu')).toBe('CPU');
  });
});

describe('resolveDisplayNames', () => {
  it('users/{uid} username || displayName, falling back to the id; CPUs never hit Firestore', async () => {
    const { db } = makeDb({
      'users/founder': { username: 'Flash' },
      'users/u2': { displayName: 'Player Two' },
    });
    const names = await resolveDisplayNames(db, ['founder', 'u2', 'u3', 'cpu-1']);
    expect(names.founder).toBe('Flash');
    expect(names.u2).toBe('Player Two');
    expect(names.u3).toBe('u3');
    expect(names['cpu-1']).toMatch(/^CPU/);
  });
});

describe('buildGroupWeekRows', () => {
  it('weekly composite of record + user detail per player; final only at day 5 / completion', () => {
    const rows = buildGroupWeekRows(group({ scores: SCORES }), NOW_ISO);
    const founder = rows.find(r => r.odUserId === 'founder');
    expect(founder.week).toMatchObject({ points: 60, userPoints: 20, bracketGameId: 'b-r1-g1', final: false });
    expect(rows.find(r => r.odUserId === 'cpu-1').week.points).toBe(-20); // signed, never floored
    expect(rows.find(r => r.odUserId === 'cpu-1').isCpu).toBe(true);

    const finalRows = buildGroupWeekRows(group({ scores: SCORES, days: 5 }), NOW_ISO);
    expect(finalRows[0].week.final).toBe(true);
    const completeRows = buildGroupWeekRows(group({ scores: SCORES, status: GROUP_STATUS.COMPLETE }), NOW_ISO);
    expect(completeRows[0].week.final).toBe(true);
  });
});

// ==================== THE UPSERT ====================

describe('upsertLeaderboardForGroups', () => {
  it('creates the month doc with entries: composite points, names, CPU marks, currentGroupId', async () => {
    const { db, store } = makeDb({ 'users/founder': { username: 'Flash' } });
    const summary = await upsertLeaderboardForGroups(db, [group({ scores: SCORES })], { now: NOW });
    expect(summary).toMatchObject({ groups: 1, docsWritten: 1, errors: 0, skippedNoBanking: 0 });

    const doc = store.get('tournamentLeaderboards/2026-06');
    expect(doc.monthKey).toBe('2026-06');
    expect(doc.entries.founder).toMatchObject({
      displayName: 'Flash', isCpu: false, points: 60, currentGroupId: 'g1',
    });
    expect(doc.entries.founder.weeks.g1).toMatchObject({ points: 60, userPoints: 20, final: false });
    expect(doc.entries['cpu-1']).toMatchObject({ isCpu: true, points: -20 }); // negative row, rendered honestly downstream
  });

  it('IDEMPOTENT: re-running the same group yields the same totals (SET, never increment)', async () => {
    const { db, store } = makeDb({});
    const g = group({ scores: SCORES });
    await upsertLeaderboardForGroups(db, [g], { now: NOW });
    await upsertLeaderboardForGroups(db, [g], { now: NOW });
    await upsertLeaderboardForGroups(db, [g], { now: NOW });
    expect(store.get('tournamentLeaderboards/2026-06').entries.founder.points).toBe(60);
  });

  it('nightly progression updates the SAME week key; a second group-week ADDS to the month total', async () => {
    const { db, store } = makeDb({});
    // Mid-week snapshot, then the final one — same groupId key, value replaced.
    await upsertLeaderboardForGroups(db, [group({ scores: { founder: { user: 10, agent: 10 } } })], { now: NOW });
    expect(store.get('tournamentLeaderboards/2026-06').entries.founder.points).toBe(25);
    await upsertLeaderboardForGroups(db, [group({ scores: SCORES, days: 5 })], { now: NOW });
    expect(store.get('tournamentLeaderboards/2026-06').entries.founder.points).toBe(60);
    expect(store.get('tournamentLeaderboards/2026-06').entries.founder.weeks.g1.final).toBe(true);

    // A second week (fresh group, same month) accumulates.
    await upsertLeaderboardForGroups(db, [group({
      id: 'g2', bracketGameId: 'b-r2-g1', day1Date: '2026-06-22',
      scores: { founder: { user: -20, agent: -10 } }, // composite −40
    })], { now: NOW });
    expect(store.get('tournamentLeaderboards/2026-06').entries.founder.points).toBe(20); // 60 − 40, signed
    expect(Object.keys(store.get('tournamentLeaderboards/2026-06').entries.founder.weeks)).toEqual(['g1', 'g2']);
  });

  it('MONTHLY RESET BOUNDARY (ruling A-3): a July-day-1 group writes a NEW doc; June is untouched', async () => {
    const { db, store } = makeDb({});
    await upsertLeaderboardForGroups(db, [group({ scores: SCORES })], { now: NOW });
    const juneBefore = JSON.stringify(store.get('tournamentLeaderboards/2026-06'));

    await upsertLeaderboardForGroups(db, [group({
      id: 'g-july', bracketGameId: 'b2-r1-g1', day1Date: '2026-07-06',
      scores: { founder: { user: 10, agent: 0 } },
    })], { now: new Date('2026-07-10T21:20:00.000Z') });

    expect(store.get('tournamentLeaderboards/2026-07').entries.founder.points).toBe(15);
    expect(JSON.stringify(store.get('tournamentLeaderboards/2026-06'))).toBe(juneBefore); // history preserved
  });

  it('DEV ROUTING (ruling A-4): an isDev group writes dev-{month}, production doc untouched', async () => {
    const { db, store } = makeDb({});
    await upsertLeaderboardForGroups(db, [group({ scores: SCORES, isDev: true })], { now: NOW });
    expect(store.get('tournamentLeaderboards/dev-2026-06')).toBeDefined();
    expect(store.get('tournamentLeaderboards/2026-06')).toBeUndefined();
  });

  it('DEV OVERRIDE (code review): a caller-resolved namespace wins over the group flag — both side-effect halves route from ONE decision', async () => {
    const { db, store } = makeDb({});
    // The advancement resolved dev=true (e.g. from the bracket flag) for a
    // group whose own flag is missing — the override routes it dev-side.
    await upsertLeaderboardForGroups(db, [group({ scores: SCORES })], { now: NOW, dev: true });
    expect(store.get('tournamentLeaderboards/dev-2026-06')).toBeDefined();
    expect(store.get('tournamentLeaderboards/2026-06')).toBeUndefined();
  });

  it('a group with no banked day is skipped (nothing to publish)', async () => {
    const { db, writeLog } = makeDb({});
    const g = group({ scores: SCORES });
    g.dailyScores = {};
    const summary = await upsertLeaderboardForGroups(db, [g], { now: NOW });
    expect(summary.skippedNoBanking).toBe(1);
    expect(writeLog).toHaveLength(0);
  });

  it('a completed group keeps the prior currentGroupId pointer', async () => {
    const { db, store } = makeDb({});
    await upsertLeaderboardForGroups(db, [group({ scores: SCORES })], { now: NOW });
    await upsertLeaderboardForGroups(db, [group({
      id: 'g0', bracketGameId: 'b0-r1-g1', day1Date: '2026-06-08',
      scores: { founder: { user: 1, agent: 1 } }, status: GROUP_STATUS.COMPLETE,
    })], { now: NOW });
    expect(store.get('tournamentLeaderboards/2026-06').entries.founder.currentGroupId).toBe('g1');
  });
});

// ==================== THE NIGHTLY AGGREGATOR ====================

describe('aggregateTournamentLeaderboards — the nightly branch', () => {
  it('zero battle groups → clean no-op, zero writes (production inertness)', async () => {
    const { db, writeLog } = makeDb({});
    const summary = await aggregateTournamentLeaderboards(db, { now: NOW });
    expect(summary).toEqual({ groups: 0, skippedNoBanking: 0, docsWritten: 0, errors: 0 });
    expect(writeLog).toHaveLength(0);
  });

  it('queries dev-INCLUSIVELY and routes by isDev (the A-4 contract)', async () => {
    const prod = group({ scores: SCORES });
    const dev = group({
      id: 'gdev', bracketGameId: 'bdev-r1-g1', isDev: true,
      scores: { founder: { user: 1, agent: 1 }, 'cpu-1': {}, 'cpu-2': {}, 'cpu-3': {} },
    });
    const { db, store } = makeDb({
      'tournamentGroups/g1': prod,
      'tournamentGroups/gdev': dev,
    });
    const summary = await aggregateTournamentLeaderboards(db, { now: NOW });
    expect(summary.groups).toBe(2);
    expect(summary.docsWritten).toBe(2);
    expect(store.get('tournamentLeaderboards/2026-06').entries.founder.points).toBe(60);
    expect(store.get('tournamentLeaderboards/dev-2026-06').entries.founder.points).toBe(2.5);
  });
});
