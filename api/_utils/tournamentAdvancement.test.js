// api/_utils/tournamentAdvancement.test.js
//
// P3b battery for the Friday duty. Blocks: the final-snapshot top-two lock
// (never a sum; deterministic tie-break), banking-pending no-op, the
// lock→complete→compose lifecycle with its crash-shaped write order and
// idempotency, CPU identity through composition (advancing CPUs keep their
// flag; padding numbers stay unique per round), the terminal-round champion
// + recap, base-layer complete-only, and zero-group production inertness
// (the cron goes live at merge — this lock IS the safety case).
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): this file's real import of
// tournamentAdvancement.js IS the runtime guard that its transitive import
// surface (src/constants/leagueTournament.js et al.) stays Node-clean.
// Never mock that import.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  WEEK_DAYS_REQUIRED,
  isWeekBanked,
  lockTopTwo,
  pairAdvancers,
  buildChampionRecap,
  runFridayAdvancement,
} from './tournamentAdvancement.js';
import {
  GROUP_STATUS,
  BRACKET_STATUS,
  createBracketGame,
  createBracketDoc,
} from '../../src/constants/leagueTournament.js';

const NOW = new Date('2026-06-19T22:30:00.000Z'); // Friday 18:30 ET
const NOW_ISO = NOW.toISOString();

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

// ==================== IN-MEMORY FIRESTORE ====================
// The P3a makeDb idiom, extended with equality where-queries, select(), and
// dot-path update() — everything the advancement path touches.

function applyDotPathUpdate(target, updates) {
  for (const [key, value] of Object.entries(updates)) {
    const parts = key.split('.');
    let node = target;
    for (let i = 0; i < parts.length - 1; i++) {
      if (typeof node[parts[i]] !== 'object' || node[parts[i]] == null) node[parts[i]] = {};
      node = node[parts[i]];
    }
    node[parts[parts.length - 1]] = value;
  }
}

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
      update: async (updates) => {
        const data = store.get(path);
        if (data === undefined) throw new Error(`update on missing doc ${path}`);
        applyDotPathUpdate(data, updates);
        writeLog.push(['update', path]);
      },
      collection: (sub) => makeCollection(`${path}/${sub}`),
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

  function makeCollection(prefix) {
    return {
      doc: (id) => makeDocRef(`${prefix}/${id}`),
      where: (field, op, value) => ({
        select: () => ({ get: async () => snapshotOf(filterDocs(field, value)) }),
        get: async () => snapshotOf(filterDocs(field, value)),
      }),
      get: async () => snapshotOf(topLevelDocs(prefix)),
    };
    function filterDocs(field, value) {
      return topLevelDocs(prefix).filter(d => d.data()[field] === value);
    }
    function snapshotOf(docs) {
      return { docs, empty: docs.length === 0, size: docs.length, forEach: (cb) => docs.forEach(cb) };
    }
  }

  const db = {
    collection: (name) => makeCollection(name),
    runTransaction: async (fn) => fn({
      get: async (ref) => ref.get(),
      update: (ref, updates) => {
        const data = store.get(ref.path);
        if (data === undefined) throw new Error(`tx.update on missing doc ${ref.path}`);
        applyDotPathUpdate(data, updates);
        writeLog.push(['tx.update', ref.path]);
      },
      set: (ref, data) => { store.set(ref.path, structuredClone(data)); writeLog.push(['tx.set', ref.path]); },
    }),
  };

  return { db, store, writeLog };
}

// ==================== FIXTURES ====================

const POOL = Array.from({ length: 40 }, (_, i) => `SYM${i}`);
const STOCKS = POOL.map(symbol => ({ symbol }));

/** dailyScores where the FINAL snapshot disagrees with the sum-over-days —
 * the lock must read the snapshot. A number is a user-only legacy snapshot
 * (pre-P6 shape — getWeeklyComposite degrades to k × user); {user, agent}
 * writes the full P6a snapshot (compositePoints = agent + 1.5 × user). */
function bankedWeek(totalsByDay) {
  const dailyScores = {};
  totalsByDay.forEach((totals, i) => {
    dailyScores[`day${i + 1}`] = {
      recordedDate: `2026-06-${15 + i}`,
      closeScores: Object.fromEntries(
        Object.entries(totals).map(([id, v]) => (typeof v === 'number'
          ? [id, { totalPoints: v, picks: [] }]
          : [id, {
              totalPoints: v.user,
              agentPoints: v.agent,
              compositePoints: v.agent + 1.5 * v.user,
              picks: [],
            }]))
      ),
    };
  });
  return dailyScores;
}

function bracketGroup({ id, members, status = GROUP_STATUS.BATTLE, dailyScores = {}, roundNumber = 1 }) {
  return {
    status,
    roundNumber,
    bracketGameId: id,
    groupMembers: members.map(m => m.odUserId),
    players: members.map(m => ({ odUserId: m.odUserId, picks: m.picks ?? [], ...(m.isCpu ? { isCpu: true } : {}) })),
    userPool: POOL,
    claimSystem: { enabled: true, currentWaiverPriority: [], processingLog: [] },
    dailyScores,
  };
}

const G1_MEMBERS = [
  { odUserId: 'founder' },
  { odUserId: 'cpu-1', isCpu: true },
  { odUserId: 'cpu-2', isCpu: true },
  { odUserId: 'cpu-3', isCpu: true },
];
const G2_MEMBERS = [
  { odUserId: 'cpu-4', isCpu: true },
  { odUserId: 'cpu-5', isCpu: true },
  { odUserId: 'cpu-6', isCpu: true },
  { odUserId: 'cpu-7', isCpu: true },
];

// Cumulative weeks: founder finishes 2nd in g1 (day5 snapshot), cpu-2 first;
// the day-sums would rank differently — the snapshot is what must win.
const G1_WEEK = bankedWeek([
  { founder: 50, 'cpu-1': 10, 'cpu-2': 5, 'cpu-3': 8 },
  { founder: 55, 'cpu-1': 20, 'cpu-2': 25, 'cpu-3': 12 },
  { founder: 58, 'cpu-1': 30, 'cpu-2': 45, 'cpu-3': 20 },
  { founder: 60, 'cpu-1': 35, 'cpu-2': 60, 'cpu-3': 22 },
  { founder: 62, 'cpu-1': 40, 'cpu-2': 70, 'cpu-3': 25 },
]);
const G2_WEEK = bankedWeek([
  { 'cpu-4': 5, 'cpu-5': 5, 'cpu-6': 5, 'cpu-7': 5 },
  { 'cpu-4': 12, 'cpu-5': 9, 'cpu-6': 30, 'cpu-7': 6 },
  { 'cpu-4': 20, 'cpu-5': 15, 'cpu-6': 40, 'cpu-7': 9 },
  { 'cpu-4': 28, 'cpu-5': 22, 'cpu-6': 55, 'cpu-7': 12 },
  { 'cpu-4': 33, 'cpu-5': 30, 'cpu-6': 61, 'cpu-7': 15 },
]);

function seededBracketDb({ g1DailyScores = G1_WEEK, g2DailyScores = G2_WEEK } = {}) {
  const g1 = bracketGroup({ id: 'b-r1-g1', members: G1_MEMBERS, dailyScores: g1DailyScores });
  const g2 = bracketGroup({ id: 'b-r1-g2', members: G2_MEMBERS, dailyScores: g2DailyScores });
  const round1Games = {
    'b-r1-g1': createBracketGame({ bracketGameId: 'b-r1-g1', gameIndex: 1, groupId: 'b-r1-g1', seats: g1.players }),
    'b-r1-g2': createBracketGame({ bracketGameId: 'b-r1-g2', gameIndex: 2, groupId: 'b-r1-g2', seats: g2.players }),
  };
  return makeDb({
    'tournamentGroups/b-r1-g1': g1,
    'tournamentGroups/b-r1-g2': g2,
    'tournamentBrackets/b': createBracketDoc({ bracketId: 'b', round1Games, now: '2026-06-12T00:00:00.000Z' }),
    'indexIntelligence/stockRankings': { stocks: STOCKS },
  });
}

// ==================== PURE BLOCKS ====================

describe('lockTopTwo — the FINAL snapshot, never a sum (composite of record, ruling A-1)', () => {
  it('locks by getWeeklyComposite (day-5 snapshot) with every member scored; user-only legacy snapshots degrade to k × user', () => {
    const group = bracketGroup({ id: 'b-r1-g1', members: G1_MEMBERS, dailyScores: G1_WEEK });
    const { advancers, finalScores, finalUserScores } = lockTopTwo(group);
    expect(advancers).toEqual(['cpu-2', 'founder']); // 105, 93 — snapshots, not sums
    expect(finalScores).toEqual({ founder: 93, 'cpu-1': 60, 'cpu-2': 105, 'cpu-3': 37.5 });
    expect(finalUserScores).toEqual({ founder: 62, 'cpu-1': 40, 'cpu-2': 70, 'cpu-3': 25 });
  });

  it('ranks by the COMPOSITE — the agent layer can flip the user-only order (ruling A-1)', () => {
    const group = bracketGroup({
      id: 'x', members: G1_MEMBERS,
      dailyScores: bankedWeek([{
        founder: { user: 10, agent: 100 },   // composite 115
        'cpu-1': { user: 40, agent: 10 },    // composite 70
        'cpu-2': { user: 30, agent: 20 },    // composite 65
        'cpu-3': { user: 5, agent: 5 },      // composite 12.5
      }]),
    });
    const { advancers, finalScores, finalUserScores } = lockTopTwo(group);
    expect(advancers).toEqual(['founder', 'cpu-1']); // user-only would advance cpu-1, cpu-2
    expect(finalScores).toEqual({ founder: 115, 'cpu-1': 70, 'cpu-2': 65, 'cpu-3': 12.5 });
    expect(finalUserScores).toEqual({ founder: 10, 'cpu-1': 40, 'cpu-2': 30, 'cpu-3': 5 });
  });

  it('tie-break is draft order (groupMembers index), deterministically', () => {
    const group = bracketGroup({
      id: 'x', members: G1_MEMBERS,
      dailyScores: bankedWeek([{ founder: 10, 'cpu-1': 30, 'cpu-2': 30, 'cpu-3': 30 }]),
    });
    expect(lockTopTwo(group).advancers).toEqual(['cpu-1', 'cpu-2']);
  });
});

describe('isWeekBanked — the ruled day-5 check', () => {
  it('false below day 5, true at day 5', () => {
    expect(isWeekBanked({ dailyScores: {} })).toBe(false);
    expect(isWeekBanked({ dailyScores: bankedWeek([{}, {}, {}, {}]) })).toBe(false);
    expect(isWeekBanked({ dailyScores: bankedWeek([{}, {}, {}, {}, {}]) })).toBe(true);
    expect(WEEK_DAYS_REQUIRED).toBe(5);
  });
});

describe('pairAdvancers — adjacent-game pairing', () => {
  it('games 1+2 feed next game 1; 3+4 feed game 2; order by gameIndex, not map order', () => {
    const next = pairAdvancers([
      { gameIndex: 3, advancers: ['e', 'f'] },
      { gameIndex: 1, advancers: ['a', 'b'] },
      { gameIndex: 4, advancers: ['g', 'h'] },
      { gameIndex: 2, advancers: ['c', 'd'] },
    ]);
    expect(next).toEqual([['a', 'b', 'c', 'd'], ['e', 'f', 'g', 'h']]);
  });
});

// ==================== PRODUCTION INERTNESS (test-locked) ====================

describe('zero groups — production state at merge', () => {
  it('no battle groups → clean no-op summary and ZERO writes', async () => {
    const { db, writeLog } = makeDb({
      'tournamentGroups/done': bracketGroup({ id: 'b-r1-g1', members: G1_MEMBERS, status: GROUP_STATUS.COMPLETE }),
    });
    const summary = await runFridayAdvancement(db, { now: NOW });
    expect(summary.groups).toBe(0);
    expect(writeLog).toHaveLength(0);
  });
});

// ==================== BANKING-PENDING NO-OP ====================

describe('banking pending (the loud no-op until day-5 is banked)', () => {
  it('an unbanked group locks nothing, completes nothing, and counts bankingPending', async () => {
    const { db, store, writeLog } = seededBracketDb({ g2DailyScores: bankedWeek([{}, {}, {}]) });
    const summary = await runFridayAdvancement(db, { now: NOW });

    expect(summary.bankingPending).toBe(1);
    // g1 (banked) locks + completes; g2 untouched; NO round lock, NO composition.
    expect(summary.gamesLocked).toBe(1);
    expect(store.get('tournamentGroups/b-r1-g1').status).toBe(GROUP_STATUS.COMPLETE);
    expect(store.get('tournamentGroups/b-r1-g2').status).toBe(GROUP_STATUS.BATTLE);
    const bracket = store.get('tournamentBrackets/b');
    expect(bracket.rounds.r1.games['b-r1-g2'].advancers).toBeNull();
    expect(bracket.rounds.r1.lockedAt).toBeNull();
    expect(bracket.rounds.r2).toBeUndefined();
    expect(summary.composedGroups).toEqual([]);
    expect(writeLog.some(([, path]) => path === 'tournamentGroups/b-r2-g1')).toBe(false);
  });
});

// ==================== FULL ADVANCEMENT ====================

describe('full Friday advancement (lock → complete → compose)', () => {
  it('locks both games, completes both groups, composes round 2 from advancers — flags intact', async () => {
    const { db, store } = seededBracketDb();
    const summary = await runFridayAdvancement(db, { now: NOW });

    expect(summary.gamesLocked).toBe(2);
    expect(summary.roundsLocked).toEqual(['b:r1']);
    expect(summary.composedGroups).toEqual(['b-r2-g1']);
    expect(summary.errors).toBe(0);

    const bracket = store.get('tournamentBrackets/b');
    expect(bracket.rounds.r1.games['b-r1-g1'].advancers).toEqual(['cpu-2', 'founder']);
    expect(bracket.rounds.r1.games['b-r1-g2'].advancers).toEqual(['cpu-6', 'cpu-4']);
    expect(bracket.rounds.r1.lockedAt).toBe(NOW_ISO);
    expect(bracket.currentRound).toBe(2);

    // The new group: P1a factory shape, forming, fresh pool, deterministic id.
    const g = store.get('tournamentGroups/b-r2-g1');
    expect(g.status).toBe(GROUP_STATUS.FORMING);
    expect(g.roundNumber).toBe(2);
    expect(g.bracketGameId).toBe('b-r2-g1');
    expect(g.groupMembers).toEqual(['cpu-2', 'founder', 'cpu-6', 'cpu-4']);
    expect(g.userPool).toEqual(POOL); // fresh full universe
    expect(g.dailyScores).toEqual({});
    // ADVANCING CPUs keep isCpu through composition; the founder doesn't gain it.
    expect(g.players.find(p => p.odUserId === 'cpu-2').isCpu).toBe(true);
    expect(g.players.find(p => p.odUserId === 'founder').isCpu).toBeUndefined();
    // Bracket seats mirror the flags.
    const seats = bracket.rounds.r2.games['b-r2-g1'].seats;
    expect(seats.find(s => s.odUserId === 'cpu-6').isCpu).toBe(true);
    expect(seats.find(s => s.odUserId === 'founder').isCpu).toBe(false);

    // No padding needed (4 advancers); advancing CPUs got their user boards.
    expect(store.get('tournamentGroups/b-r2-g1/boards/cpu-2')).toBeDefined();
    expect(store.get('tournamentGroups/b-r2-g1/boards/cpu-2').isCpu).toBe(true);
    expect(store.get('tournamentGroups/b-r2-g1/boards/founder')).toBeUndefined(); // humans commit their own

    // Both source groups completed.
    expect(store.get('tournamentGroups/b-r1-g1').status).toBe(GROUP_STATUS.COMPLETE);
    expect(store.get('tournamentGroups/b-r1-g2').status).toBe(GROUP_STATUS.COMPLETE);
  });

  it('is idempotent: a second run sees zero battle groups and writes nothing', async () => {
    const { db, writeLog } = seededBracketDb();
    await runFridayAdvancement(db, { now: NOW });
    const writesAfterFirst = writeLog.length;
    const summary = await runFridayAdvancement(db, { now: NOW });
    expect(summary.groups).toBe(0);
    expect(writeLog.length).toBe(writesAfterFirst);
  });

  it('materializes a missing round-1 bracket doc from the observed groups (crash recovery, loud)', async () => {
    const { db, store } = seededBracketDb();
    store.delete('tournamentBrackets/b');
    const summary = await runFridayAdvancement(db, { now: NOW });
    expect(summary.gamesLocked).toBe(2);
    const bracket = store.get('tournamentBrackets/b');
    expect(bracket.rounds.r1.games['b-r1-g1'].advancers).toEqual(['cpu-2', 'founder']);
    expect(bracket.rounds.r2).toBeDefined();
  });
});

// ==================== TERMINAL ROUND + CHAMPION ====================

describe('terminal round — champion + the spec-§3 recap', () => {
  async function runToChampion({ ledgerDoubleDowns = null } = {}) {
    const { db, store } = seededBracketDb();
    await runFridayAdvancement(db, { now: NOW });

    // Play out the terminal group: founder wins the final four.
    const final = store.get('tournamentGroups/b-r2-g1');
    final.status = GROUP_STATUS.BATTLE;
    final.dailyScores = bankedWeek([
      { founder: 10, 'cpu-2': 9, 'cpu-6': 8, 'cpu-4': 7 },
      { founder: 30, 'cpu-2': 22, 'cpu-6': 18, 'cpu-4': 12 },
      { founder: 45, 'cpu-2': 30, 'cpu-6': 25, 'cpu-4': 20 },
      { founder: 70, 'cpu-2': 41, 'cpu-6': 33, 'cpu-4': 28 },
      { founder: 90, 'cpu-2': 50, 'cpu-6': 40, 'cpu-4': 35 },
    ]);
    if (ledgerDoubleDowns) {
      store.set('tournamentGroups/b-r2-g1/ledger/agentHeldSet', { held: {}, reservations: {}, doubleDowns: ledgerDoubleDowns });
    }
    const summary = await runFridayAdvancement(db, { now: NOW });
    return { summary, store };
  }

  it('one-game round → champion (top-1), bracket complete, recap populated from what exists', async () => {
    const { summary, store } = await runToChampion({
      ledgerDoubleDowns: [
        { kind: 'formed', symbol: 'SYM7', agentId: 'agent-f', odUserId: 'founder', userDirection: 'long', at: 'T1' },
      ],
    });

    expect(summary.champion).toMatchObject({ bracketId: 'b', odUserId: 'founder', isCpu: false, weeklyScore: 135 });
    const bracket = store.get('tournamentBrackets/b');
    expect(bracket.status).toBe(BRACKET_STATUS.COMPLETE);
    expect(bracket.champion.odUserId).toBe('founder');
    expect(bracket.rounds.r2.lockedAt).toBe(NOW_ISO);

    // Recap: the champion's road (r1 second place, r2 first), best week, the
    // swap-formed double-down — all COMPOSITE values (ruling A-1; these
    // user-only fixtures degrade via k × user), and the P3b finalComposite
    // contract closed at P6a: the championship week's composite.
    expect(bracket.recap.bracketPath).toEqual([
      { roundNumber: 1, groupId: 'b-r1-g1', weeklyScore: 93, placement: 2 },
      { roundNumber: 2, groupId: 'b-r2-g1', weeklyScore: 135, placement: 1 },
    ]);
    expect(bracket.recap.bestWeek).toEqual({ roundNumber: 2, weeklyScore: 135 });
    expect(bracket.recap.signatureDoubleDown).toEqual({ symbol: 'SYM7', roundNumber: 2, kind: 'swap', at: 'T1' });
    expect(bracket.recap.finalComposite).toBe(135);

    // The terminal group completes; no round 3 is composed.
    expect(store.get('tournamentGroups/b-r2-g1').status).toBe(GROUP_STATUS.COMPLETE);
    expect(bracket.rounds.r3).toBeUndefined();
  });

  it('no double-down anywhere → signatureDoubleDown null (populate what exists)', async () => {
    const { store } = await runToChampion();
    expect(store.get('tournamentBrackets/b').recap.signatureDoubleDown).toBeNull();
  });

  it('a CPU can be champion, marked as such', async () => {
    const { db, store } = seededBracketDb();
    await runFridayAdvancement(db, { now: NOW });
    const final = store.get('tournamentGroups/b-r2-g1');
    final.status = GROUP_STATUS.BATTLE;
    final.dailyScores = bankedWeek([{ founder: 1, 'cpu-2': 99, 'cpu-6': 2, 'cpu-4': 3 },
      {}, {}, {}, { founder: 10, 'cpu-2': 80, 'cpu-6': 20, 'cpu-4': 30 }]);
    const summary = await runFridayAdvancement(db, { now: NOW });
    expect(summary.champion.odUserId).toBe('cpu-2');
    expect(summary.champion.isCpu).toBe(true);
  });
});

// ==================== BASE LAYER ====================

describe('base-layer groups — COMPLETE ONLY (ruled; recomposition docketed)', () => {
  it('banked base group completes; nothing is composed and no bracket is touched', async () => {
    const base = {
      ...bracketGroup({ id: 'ignored', members: G1_MEMBERS, dailyScores: G1_WEEK }),
      bracketGameId: undefined,
    };
    delete base.bracketGameId;
    base.baseLayerWeek = '2026-W25';
    const { db, store, writeLog } = makeDb({
      'tournamentGroups/base1': base,
      'indexIntelligence/stockRankings': { stocks: STOCKS },
    });

    const summary = await runFridayAdvancement(db, { now: NOW });
    expect(summary.baseCompleted).toBe(1);
    expect(summary.composedGroups).toEqual([]);
    expect(store.get('tournamentGroups/base1').status).toBe(GROUP_STATUS.COMPLETE);
    expect(writeLog.every(([, path]) => !path.startsWith('tournamentBrackets/'))).toBe(true);
  });

  it('unbanked base group is a banking-pending no-op', async () => {
    const base = bracketGroup({ id: 'x', members: G1_MEMBERS, dailyScores: bankedWeek([{}]) });
    delete base.bracketGameId;
    base.baseLayerWeek = '2026-W25';
    const { db, store } = makeDb({ 'tournamentGroups/base1': base });
    const summary = await runFridayAdvancement(db, { now: NOW });
    expect(summary.bankingPending).toBe(1);
    expect(store.get('tournamentGroups/base1').status).toBe(GROUP_STATUS.BATTLE);
  });
});

// ==================== ORPHAN RESUME (the active-bracket sweep) ====================
//
// Code-review finding (June 12, 2026): a crash after the groups complete
// but before composition / the champion lands leaves work no battle-group
// query can see. The sweep resumes it from the bracket doc alone.

describe('active-bracket sweep — finalization resumable from the bracket doc alone', () => {
  it('round fully locked, groups gone, next round missing → sweep composes it', async () => {
    const { db, store, writeLog } = seededBracketDb();
    await runFridayAdvancement(db, { now: NOW });

    // Simulate the crash window: composition's round entry never landed
    // (groups are complete and invisible to the battle query).
    const bracket = store.get('tournamentBrackets/b');
    delete bracket.rounds.r2;
    bracket.currentRound = 1;
    store.delete('tournamentGroups/b-r2-g1');
    store.delete('tournamentGroups/b-r2-g1/boards/cpu-2');
    store.delete('tournamentGroups/b-r2-g1/boards/cpu-6');
    store.delete('tournamentGroups/b-r2-g1/boards/cpu-4');
    const writesBefore = writeLog.length;

    const summary = await runFridayAdvancement(db, { now: NOW });
    expect(summary.groups).toBe(0);          // nothing in battle…
    expect(summary.activeBrackets).toBe(1);  // …but the bracket still owes work
    expect(summary.composedGroups).toEqual(['b-r2-g1']);
    expect(store.get('tournamentGroups/b-r2-g1').status).toBe(GROUP_STATUS.FORMING);
    expect(store.get('tournamentBrackets/b').rounds.r2).toBeDefined();
    expect(store.get('tournamentBrackets/b').currentRound).toBe(2);
    expect(writeLog.length).toBeGreaterThan(writesBefore);
  });

  it('terminal round locked, champion missing → sweep writes champion + recap', async () => {
    const { db, store } = seededBracketDb();
    await runFridayAdvancement(db, { now: NOW });
    const final = store.get('tournamentGroups/b-r2-g1');
    final.status = GROUP_STATUS.BATTLE;
    final.dailyScores = bankedWeek([{}, {}, {}, {},
      { founder: 90, 'cpu-2': 50, 'cpu-6': 40, 'cpu-4': 35 }]);
    await runFridayAdvancement(db, { now: NOW });

    // Simulate the crash window: champion write lost after the round lock.
    const bracket = store.get('tournamentBrackets/b');
    bracket.champion = null;
    bracket.recap = null;
    bracket.status = 'active';

    const summary = await runFridayAdvancement(db, { now: NOW });
    expect(summary.groups).toBe(0);
    expect(summary.champion).toMatchObject({ odUserId: 'founder', weeklyScore: 135 });
    expect(store.get('tournamentBrackets/b').status).toBe(BRACKET_STATUS.COMPLETE);
    expect(store.get('tournamentBrackets/b').recap.bracketPath.length).toBeGreaterThan(0);
  });

  it('a settled bracket sweeps as a pure no-op (zero writes)', async () => {
    const { db, store, writeLog } = seededBracketDb();
    await runFridayAdvancement(db, { now: NOW });
    // Bracket is active with r2 composed and r2 not yet locked — sweep
    // finds r1 locked+composed (no-op) and r2 unlockable (no advancers).
    const writesAfterFirst = writeLog.length;
    const summary = await runFridayAdvancement(db, { now: NOW });
    expect(summary.activeBrackets).toBe(1);
    expect(writeLog.length).toBe(writesAfterFirst);
    expect(store.get('tournamentBrackets/b').currentRound).toBe(2);
  });
});

// ==================== RECAP UNIT ====================

describe('buildChampionRecap — degrade posture', () => {
  it('a ledger read failure degrades the double-down to the next source, never throws', async () => {
    const bracket = {
      rounds: {
        r1: {
          roundNumber: 1,
          games: {
            g1: {
              bracketGameId: 'g1', gameIndex: 1, groupId: 'g1',
              seats: [{ odUserId: 'u1', isCpu: false }, { odUserId: 'u2', isCpu: false }, { odUserId: 'u3', isCpu: false }, { odUserId: 'u4', isCpu: false }],
              finalScores: { u1: 50, u2: 40, u3: 30, u4: 20 },
              advancers: ['u1', 'u2'],
              completedAt: 'T',
            },
          },
        },
      },
    };
    const throwingDb = {
      collection: () => ({
        doc: () => ({
          get: async () => { throw new Error('boom'); },
          collection: () => ({ doc: () => ({ get: async () => { throw new Error('boom'); } }) }),
        }),
      }),
    };
    const recap = await buildChampionRecap(throwingDb, bracket, 'u1');
    expect(recap.bracketPath).toHaveLength(1);
    expect(recap.signatureDoubleDown).toBeNull();
    expect(recap.bestWeek).toEqual({ roundNumber: 1, weeklyScore: 50 });
  });
});

// ==================== P6a — FINALIZATION SIDE-EFFECTS (rank + leaderboard) ====================

describe('P6a side-effects — rank apply + leaderboard final upsert ride the Friday duty', () => {
  it('locks both games and lands rank docs + the month leaderboard, idempotently', async () => {
    const { db, store } = seededBracketDb();
    const summary = await runFridayAdvancement(db, { now: NOW });
    expect(summary.errors).toBe(0);
    expect(summary.rankApplied).toBe(8); // 4 seats × 2 games
    expect(summary.leaderboardDocs).toBeGreaterThan(0);

    // founder: composite 93 (user-only fixture × k), placement 2 behind
    // cpu-2's 105; 3 CPU opponents → guard 0 → zero positive RP (B-2,
    // consciously noted for padded groups).
    const founder = store.get('tournamentRanks/founder');
    expect(founder.appliedGroups['b-r1-g1']).toMatchObject({
      weeklyComposite: 93, placement: 2, cpuOpponents: 3, guard: 0, delta: 0,
    });
    expect(founder.rp).toBe(0);

    // cpu-2: placement 1 with 2 CPU opponents → guard ⅓ of (105 + 100).
    const cpu2 = store.get('tournamentRanks/cpu-2');
    expect(cpu2.isCpu).toBe(true);
    expect(cpu2.rp).toBeCloseTo(205 / 3, 1);

    // The month doc carries final week entries (composite, signed).
    const lb = store.get('tournamentLeaderboards/2026-06');
    expect(lb.entries.founder.weeks['b-r1-g1']).toMatchObject({ points: 93, userPoints: 62, final: true });
    expect(lb.entries.founder.isCpu).toBe(false);
    expect(lb.entries['cpu-2'].isCpu).toBe(true);

    // Idempotent re-run: the sideEffectsAt stamp short-circuits every
    // entry — zero applications AND zero per-seat skip passes (the stamp
    // is checked on the bracket doc already in hand; no rank-doc reads).
    const again = await runFridayAdvancement(db, { now: NOW });
    expect(again.rankApplied).toBe(0);
    expect(again.rankSkipped).toBe(0);
    expect(store.get('tournamentRanks/cpu-2').rp).toBeCloseTo(205 / 3, 1);
    expect(store.get('tournamentLeaderboards/2026-06').entries.founder.points).toBe(93);

    // The stamp is durable on the bracket entry.
    expect(store.get('tournamentBrackets/b').rounds.r1.games['b-r1-g1'].sideEffectsAt).toBe(NOW_ISO);
  });

  it('CRASH RESUME: an UNSTAMPED locked entry (crash before sideEffectsAt landed) is healed by the sweep from the bracket alone', async () => {
    const { db, store } = seededBracketDb();
    await runFridayAdvancement(db, { now: NOW });

    // Simulate the true crash window: the lock landed, one seat's rank
    // write was lost, and the stamp never landed (the stamp is written only
    // after a clean pass — so a crash mid-side-effects leaves it absent).
    store.delete('tournamentRanks/founder');
    store.get('tournamentBrackets/b').rounds.r1.games['b-r1-g1'].sideEffectsAt = null;

    const summary = await runFridayAdvancement(db, { now: NOW });
    expect(summary.rankApplied).toBe(1);  // exactly the orphaned seat
    expect(summary.rankSkipped).toBe(3);  // the other three skip on appliedGroups
    expect(store.get('tournamentRanks/founder').appliedGroups['b-r1-g1']).toBeDefined();
    // The resume re-stamps, so the next tick is free again.
    expect(store.get('tournamentBrackets/b').rounds.r1.games['b-r1-g1'].sideEffectsAt).toBe(NOW_ISO);
  });

  it('COMPLETION GATE: a failing leaderboard half defers completion; the group stays in the battle query and heals next tick', async () => {
    const { db, store } = seededBracketDb();
    // Break the leaderboard upsert for the whole first run (a poisoned
    // users-collection read cannot do it — names degrade), then heal.
    const realRunTransaction = db.runTransaction.bind(db);
    let fail = true;
    db.runTransaction = async (fn) => realRunTransaction(async (tx) => fn({
      get: tx.get,
      update: tx.update,
      set: (ref, data) => {
        if (ref.path.startsWith('tournamentLeaderboards/') && fail) {
          throw new Error('transient month-doc failure');
        }
        tx.set(ref, data);
      },
    }));

    const first = await runFridayAdvancement(db, { now: NOW });
    expect(first.errors).toBeGreaterThan(0);
    // Locks landed, rank applied — but no stamp, no completion.
    expect(store.get('tournamentBrackets/b').rounds.r1.games['b-r1-g1'].advancers).not.toBeNull();
    expect(store.get('tournamentBrackets/b').rounds.r1.games['b-r1-g1'].sideEffectsAt).toBeNull();
    expect(store.get('tournamentGroups/b-r1-g1').status).toBe(GROUP_STATUS.BATTLE);

    fail = false;
    const second = await runFridayAdvancement(db, { now: NOW });
    expect(second.errors).toBe(0);
    expect(store.get('tournamentBrackets/b').rounds.r1.games['b-r1-g1'].sideEffectsAt).toBe(NOW_ISO);
    expect(store.get('tournamentGroups/b-r1-g1').status).toBe(GROUP_STATUS.COMPLETE);
    expect(store.get('tournamentLeaderboards/2026-06').entries.founder.weeks['b-r1-g1'].final).toBe(true);
  });

  it('BASE-LAYER GATE: a failing side-effect withholds completion — the week is never orphaned', async () => {
    const base = bracketGroup({ id: 'ignored', members: G1_MEMBERS, dailyScores: G1_WEEK });
    delete base.bracketGameId;
    base.baseLayerWeek = '2026-W25';
    const { db, store } = makeDb({
      'tournamentGroups/base1': base,
      'indexIntelligence/stockRankings': { stocks: STOCKS },
    });
    const realRunTransaction = db.runTransaction.bind(db);
    let fail = true;
    db.runTransaction = async (fn) => realRunTransaction(async (tx) => fn({
      get: tx.get,
      update: tx.update,
      set: (ref, data) => {
        if (ref.path.startsWith('tournamentRanks/') && fail) {
          throw new Error('transient rank failure');
        }
        tx.set(ref, data);
      },
    }));

    const first = await runFridayAdvancement(db, { now: NOW });
    expect(first.errors).toBeGreaterThan(0);
    expect(first.baseCompleted).toBe(0);
    expect(store.get('tournamentGroups/base1').status).toBe(GROUP_STATUS.BATTLE); // still visible

    fail = false;
    const second = await runFridayAdvancement(db, { now: NOW });
    expect(second.baseCompleted).toBe(1);
    expect(store.get('tournamentGroups/base1').status).toBe(GROUP_STATUS.COMPLETE);
    expect(store.get('tournamentRanks/founder').appliedGroups.base1).toBeDefined();
  });

  it('DEV SWEEP FILTER: production ticks never work dev brackets; the dev duty surface does', async () => {
    const { db, store } = seededBracketDb();
    store.get('tournamentBrackets/b').isDev = true;
    store.get('tournamentGroups/b-r1-g1').isDev = true;
    store.get('tournamentGroups/b-r1-g2').isDev = true;

    // Production run: the dev groups are excluded by fetchEligibleGroupsByStatus
    // AND the sweep skips the dev bracket — zero work, zero errors.
    const prod = await runFridayAdvancement(db, { now: NOW });
    expect(prod.groups).toBe(0);
    expect(prod.rankApplied).toBe(0);
    expect(prod.errors).toBe(0);
    expect(store.get('tournamentRanks/dev-founder')).toBeUndefined();

    // The dev duty surface opts in and lands the dev-namespaced docs.
    const dev = await runFridayAdvancement(db, { now: NOW, includeDevGroups: true });
    expect(dev.rankApplied).toBe(8);
    expect(store.get('tournamentRanks/dev-founder')).toBeDefined();
    expect(store.get('tournamentRanks/founder')).toBeUndefined();
  });

  it('MATERIALIZED dev brackets inherit isDev — smoke side-effects can never route to production docs', async () => {
    const { db, store } = seededBracketDb();
    store.get('tournamentGroups/b-r1-g1').isDev = true;
    store.get('tournamentGroups/b-r1-g2').isDev = true;
    store.delete('tournamentBrackets/b'); // the lost-bracket recovery window

    await runFridayAdvancement(db, { now: NOW, includeDevGroups: true });
    expect(store.get('tournamentBrackets/b').isDev).toBe(true); // inherited at materialization
    expect(store.get('tournamentRanks/dev-founder')).toBeDefined();
    expect(store.get('tournamentRanks/founder')).toBeUndefined();
    expect(store.get('tournamentLeaderboards/dev-2026-06')).toBeDefined();
    expect(store.get('tournamentLeaderboards/2026-06')).toBeUndefined();
  });

  it('DEGRADED LOCK REFUSAL (§7.2): a degraded final snapshot (agentScoresCarried) does NOT lock — defers, counts, self-heals next pass', async () => {
    const { db, store } = seededBracketDb();
    store.get('tournamentGroups/b-r1-g1').dailyScores.day5.agentScoresCarried = true;

    // First pass: g1 refuses to lock (the bracket lock is permanent); its
    // sibling g2 locks normally. The refusal counts but is not an error.
    const first = await runFridayAdvancement(db, { now: NOW });
    expect(first.degradedLocks).toBe(1);
    expect(first.errors).toBe(0);
    // Unlocked AND uncompleted — g1 stays in the battle query for the retry.
    expect(store.get('tournamentBrackets/b').rounds.r1.games['b-r1-g1'].advancers).toBeNull();
    expect(store.get('tournamentGroups/b-r1-g1').status).toBe(GROUP_STATUS.BATTLE);
    // No rank/leaderboard side-effects from a refused lock.
    expect(store.get('tournamentRanks/founder')).toBeUndefined();

    // Banking self-heals the snapshot overnight; the next pass locks clean.
    delete store.get('tournamentGroups/b-r1-g1').dailyScores.day5.agentScoresCarried;
    const second = await runFridayAdvancement(db, { now: NOW });
    expect(second.degradedLocks).toBe(0);
    expect(store.get('tournamentBrackets/b').rounds.r1.games['b-r1-g1'].advancers).not.toBeNull();
    expect(store.get('tournamentGroups/b-r1-g1').status).toBe(GROUP_STATUS.COMPLETE);
    expect(store.get('tournamentRanks/founder').appliedGroups['b-r1-g1']).toBeDefined();
  });

  it('base-layer completion applies rank + leaderboard BEFORE the transition', async () => {
    const base = bracketGroup({ id: 'ignored', members: G1_MEMBERS, dailyScores: G1_WEEK });
    delete base.bracketGameId;
    base.baseLayerWeek = '2026-W25';
    const { db, store } = makeDb({
      'tournamentGroups/base1': base,
      'indexIntelligence/stockRankings': { stocks: STOCKS },
    });
    const summary = await runFridayAdvancement(db, { now: NOW });
    expect(summary.baseCompleted).toBe(1);
    expect(summary.rankApplied).toBe(4);
    expect(store.get('tournamentRanks/founder').appliedGroups.base1).toBeDefined();
    expect(store.get('tournamentLeaderboards/2026-06').entries.founder.weeks.base1)
      .toMatchObject({ points: 93, final: true, baseLayerWeek: '2026-W25' });
  });

  it('a DEV bracket namespaces every side-effect doc (ruling A-4)', async () => {
    const { db, store } = seededBracketDb();
    store.get('tournamentBrackets/b').isDev = true;
    store.get('tournamentGroups/b-r1-g1').isDev = true;
    store.get('tournamentGroups/b-r1-g2').isDev = true;
    await runFridayAdvancement(db, { now: NOW, includeDevGroups: true });
    expect(store.get('tournamentRanks/dev-founder')).toBeDefined();
    expect(store.get('tournamentRanks/founder')).toBeUndefined();
    expect(store.get('tournamentLeaderboards/dev-2026-06')).toBeDefined();
    expect(store.get('tournamentLeaderboards/2026-06')).toBeUndefined();
  });
});
