// api/_utils/tournamentAdvancementFreeze.test.js
//
// Emergency-freeze battery (TOURNAMENT_ADVANCEMENT_FROZEN). Proves the
// tourniquet holds with the flag ON: a day-5-banked group advances NOTHING —
// no bracket lock/finalScores, no rank appliedGroups, no leaderboard week-row,
// no completion — the duty is never marked satisfied, and the leaderboard skip
// is precise (battle non-training only; completed groups still publish). The
// flag-OFF regression (existing advancement/leaderboard/seam batteries pass
// unchanged) lives in those files via a scoped importOriginal override.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the real imports of
// tournamentAdvancement.js / tournamentLeaderboard.js / tournamentOrchestrator.js
// below ARE the runtime guard that their transitive surface stays Node-clean —
// never mock them. Only the featureFlags module is mocked (a zero-import module),
// forcing the freeze ON for this file.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  TOURNAMENT_ADVANCEMENT_FROZEN: true,
}));

import { runFridayAdvancement } from './tournamentAdvancement.js';
import { upsertLeaderboardForGroups, aggregateTournamentLeaderboards } from './tournamentLeaderboard.js';
import { isDutySatisfied, DUTY } from './tournamentOrchestrator.js';
import { GROUP_STATUS, createBracketGame, createBracketDoc } from '../../src/constants/leagueTournament.js';

const NOW = new Date('2026-06-19T22:30:00.000Z'); // Friday 18:30 ET

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

// ---- In-memory Firestore with a write log (the advancement-test makeDb idiom;
// only reads are un-logged, so an empty writeLog proves ZERO writes). ----
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
        applyDotPathUpdate(data, updates); writeLog.push(['update', path]);
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
    function filterDocs(field, value) { return topLevelDocs(prefix).filter(d => d.data()[field] === value); }
    function snapshotOf(docs) { return { docs, empty: docs.length === 0, size: docs.length, forEach: (cb) => docs.forEach(cb) }; }
  }
  const db = {
    collection: (name) => makeCollection(name),
    runTransaction: async (fn) => fn({
      get: async (ref) => ref.get(),
      update: (ref, updates) => {
        const data = store.get(ref.path);
        if (data === undefined) throw new Error(`tx.update on missing doc ${ref.path}`);
        applyDotPathUpdate(data, updates); writeLog.push(['tx.update', ref.path]);
      },
      set: (ref, data) => { store.set(ref.path, structuredClone(data)); writeLog.push(['tx.set', ref.path]); },
    }),
  };
  return { db, store, writeLog };
}

// ---- Fixtures: a day-5-banked week (cumulative snapshots). ----
const MEMBERS = [
  { odUserId: 'human-1' },
  { odUserId: 'cpu-1', isCpu: true },
  { odUserId: 'cpu-2', isCpu: true },
  { odUserId: 'cpu-3', isCpu: true },
];
function bankedDays(n = 5) {
  const ds = {};
  for (let i = 0; i < n; i++) {
    ds[`day${i + 1}`] = {
      recordedDate: `2026-06-${15 + i}`,
      closeScores: Object.fromEntries(MEMBERS.map((m, k) => [m.odUserId, {
        totalPoints: -100 * (i + 1) - k, agentPoints: -50 * (i + 1),
        compositePoints: -50 * (i + 1) + 1.5 * (-100 * (i + 1) - k), picks: [],
      }])),
    };
  }
  return ds;
}
function group({ id, status = GROUP_STATUS.BATTLE, bracket = false, isTraining = false, days = 5 }) {
  return {
    status, roundNumber: 1,
    ...(bracket ? { bracketGameId: id } : { baseLayerWeek: '2026-W25' }),
    ...(isTraining ? { isTraining: true } : {}),
    groupMembers: MEMBERS.map(m => m.odUserId),
    players: MEMBERS.map(m => ({ odUserId: m.odUserId, picks: [], ...(m.isCpu ? { isCpu: true } : {}) })),
    userPool: [], claimSystem: { enabled: true, currentWaiverPriority: [], processingLog: [] },
    dailyScores: bankedDays(days),
  };
}
function seededDb() {
  const bg = group({ id: 'b-r1-g1', bracket: true });
  const round1Games = { 'b-r1-g1': createBracketGame({ bracketGameId: 'b-r1-g1', gameIndex: 1, groupId: 'b-r1-g1', seats: bg.players }) };
  return makeDb({
    'tournamentGroups/b-r1-g1': bg,
    'tournamentGroups/base-1': group({ id: 'base-1' }),
    'tournamentBrackets/b': createBracketDoc({ bracketId: 'b', round1Games, now: '2026-06-12T00:00:00.000Z' }),
    'indexIntelligence/stockRankings': { stocks: [] },
  });
}

describe('freeze — runFridayAdvancement (primary guard) writes NOTHING', () => {
  it('day-5 groups advance nothing: no locks, no rank, no leaderboard, no completion — and ZERO writes', async () => {
    const { db, store, writeLog } = seededDb();
    const summary = await runFridayAdvancement(db, { now: NOW });

    expect(summary.frozen).toBe(2);                 // both banked battle groups withheld
    expect(summary.gamesLocked).toBe(0);
    expect(summary.rankApplied).toBe(0);
    expect(summary.leaderboardDocs).toBe(0);
    expect(summary.baseCompleted).toBe(0);
    expect(summary.trainingCompleted).toBe(0);
    expect(summary.errors).toBe(0);

    // The load-bearing assertion: the freeze returns before ANY write.
    expect(writeLog).toEqual([]);

    // Concretely: the bracket game never got finalScores/advancers; no rank docs.
    const bracket = store.get('tournamentBrackets/b');
    expect(bracket.rounds.r1.games['b-r1-g1'].finalScores).toBeNull();
    expect(bracket.rounds.r1.games['b-r1-g1'].advancers).toBeNull();
    expect([...store.keys()].some(k => k.startsWith('tournamentRanks/'))).toBe(false);
    expect([...store.keys()].some(k => k.startsWith('tournamentLeaderboards/'))).toBe(false);

    // Groups stay in battle (never transitioned) so they re-tick when unfrozen.
    expect(store.get('tournamentGroups/b-r1-g1').status).toBe(GROUP_STATUS.BATTLE);
    expect(store.get('tournamentGroups/base-1').status).toBe(GROUP_STATUS.BATTLE);
  });

  it('withholds PRECISELY: training pods are exempt (nightly completer owns them), not-yet-day-5 groups are banking-pending, only banked non-training groups count `frozen`', async () => {
    const { db, store, writeLog } = makeDb({
      'tournamentGroups/ranked-d5': group({ id: 'ranked-d5' }),                       // banked non-training → frozen
      'tournamentGroups/train-d5': group({ id: 'train-d5', isTraining: true }),        // training → exempt (no count, no completion here)
      'tournamentGroups/ranked-d3': group({ id: 'ranked-d3', days: 3 }),               // not day-5 → banking-pending, not frozen
      'indexIntelligence/stockRankings': { stocks: [] },
    });
    const summary = await runFridayAdvancement(db, { now: NOW });

    expect(summary.frozen).toBe(1);          // ONLY ranked-d5
    expect(summary.bankingPending).toBe(1);  // ranked-d3
    expect(writeLog).toEqual([]);            // still zero writes

    // The training pod is NOT completed by the frozen Friday path — the nightly
    // completeBankedTrainingPods owns it (Friday is only its backstop), so no
    // regression and no stuck pod.
    expect(store.get('tournamentGroups/train-d5').status).toBe(GROUP_STATUS.BATTLE);
    // A training-only or pre-day-5 Friday can therefore mark the duty complete
    // (nothing ranked to protect); a ranked banked group keeps it unsatisfied.
    expect(isDutySatisfied(DUTY.FRIDAY_ADVANCEMENT, summary)).toBe(false); // ranked-d5 present
    expect(isDutySatisfied(DUTY.FRIDAY_ADVANCEMENT, { bankingPending: 0, errors: 0, deferredToNextTick: 0, frozen: 0 })).toBe(true);
  });

  it('a frozen Friday is never marked satisfied — the orchestrator gate that writes duty markers is isDutySatisfied', async () => {
    const { db } = seededDb();
    const summary = await runFridayAdvancement(db, { now: NOW });
    // isDutySatisfied is the sole gate on markDutyComplete (tournamentOrchestrator
    // runOrchestratorTick): false ⇒ no per-date marker is ever written ⇒ a frozen
    // pass can never pre-satisfy this or any later day.
    expect(isDutySatisfied(DUTY.FRIDAY_ADVANCEMENT, summary)).toBe(false);
  });
});

describe('freeze — isDutySatisfied (pure) treats frozen as not-done', () => {
  const base = { bankingPending: 0, errors: 0, deferredToNextTick: 0, frozen: 0 };
  it('frozen > 0 → not satisfied (even with nothing else pending)', () => {
    expect(isDutySatisfied(DUTY.FRIDAY_ADVANCEMENT, { ...base, frozen: 1 })).toBe(false);
  });
  it('frozen 0 / nothing pending → satisfied (flag-off regression)', () => {
    expect(isDutySatisfied(DUTY.FRIDAY_ADVANCEMENT, base)).toBe(true);
  });
});

describe('freeze — leaderboard writer skips battle rows, precisely', () => {
  it('a battle non-training group is withheld (no doc, frozenSkipped counts)', async () => {
    const { db, store } = makeDb({ 'indexIntelligence/stockRankings': { stocks: [] } });
    const res = await upsertLeaderboardForGroups(db, [{ id: 'b-1', ...group({ id: 'b-1' }) }], { now: NOW });
    expect(res.frozenSkipped).toBe(1);
    expect(res.docsWritten).toBe(0);
    expect([...store.keys()].some(k => k.startsWith('tournamentLeaderboards/'))).toBe(false);
  });

  it('a COMPLETED group still publishes (the gate is battle-only, not a blanket off-switch)', async () => {
    const { db, store } = makeDb({});
    const done = { id: 'done-1', ...group({ id: 'done-1', status: GROUP_STATUS.COMPLETE }) };
    const res = await upsertLeaderboardForGroups(db, [done], { now: NOW });
    expect(res.frozenSkipped).toBe(0);
    expect(res.docsWritten).toBe(1);
    expect([...store.keys()].some(k => k.startsWith('tournamentLeaderboards/'))).toBe(true);
  });

  it('the nightly aggregation withholds every in-flight battle group while frozen', async () => {
    const { db, store } = makeDb({
      'tournamentGroups/b-1': group({ id: 'b-1' }),
      'tournamentGroups/b-2': group({ id: 'b-2' }),
    });
    const res = await aggregateTournamentLeaderboards(db, { now: NOW });
    expect(res.frozenSkipped).toBe(2);
    expect(res.docsWritten).toBe(0);
    expect([...store.keys()].some(k => k.startsWith('tournamentLeaderboards/'))).toBe(false);
  });
});

describe('freeze — the defense-in-depth second belt exists and is distinct', () => {
  // The belt is unreachable through runFridayAdvancement while frozen (the
  // primary guard returns first), so it is asserted by construction: a future
  // refactor that drops it must fail here (the p4Flips source-assertion idiom).
  it('runWeekSideEffects carries a flag-gated belt logged distinctly from the primary guard', () => {
    const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'tournamentAdvancement.js'), 'utf8');
    const belt = src.slice(src.indexOf('async function runWeekSideEffects'));
    expect(belt).toContain('TOURNAMENT_ADVANCEMENT_FROZEN');
    expect(belt).toContain('FROZEN[belt]');
  });
});
