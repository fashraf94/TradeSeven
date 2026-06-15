// api/_utils/tournamentLobbyFormation.seam.test.js
//
// P10a — THE SEAM BATTERY (founder directive, June 13, 2026: "prove it, don't
// assume it"). P10 discovery finding #2: CPU padding (Ruling B1) had only ever
// run on BRACKET groups (the bracket seeder, Friday round composition). A
// self-serve lobby forms BASE-LAYER groups, so a base-layer-group-WITH-CPU-
// seats is a combination that had never existed in any path. The primitives
// are bracket-agnostic by construction — but the P8 lesson is "fine in
// isolation, untested in COMBINATION." This battery walks a FORMATION-produced
// base-layer + CPU group through the live duties end to end:
//
//   formation → Monday pipeline (battle + 24 drafted + deploys) → banking →
//   Friday base-layer COMPLETE (rank + leaderboard, the CPU-farm guard).
//
// No model call except a tiny anthropic STUB for the ONE human's agent board
// (CPUs use the deterministic fallback; the human's user board is committed as
// in the forming week). This must be GREEN before P10b builds any surface on it.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the real imports of the lobby
// service AND every duty module below are the runtime guard that the whole
// api/ → src/ transitive graph stays Node-clean. Never mock these imports.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createLobby, formGroupFromLobby, quickPlay } from './tournamentLobbyService.js';
import { runMondayPipeline } from './tournamentOrchestrator.js';
import { runFridayAdvancement } from './tournamentAdvancement.js';
import { bankGroup } from './tournamentBanking.js';
import { aggregateTournamentLeaderboards } from './tournamentLeaderboard.js';
import { buildBoardCommit } from './tournamentBoards.js';
import {
  GROUP_STATUS,
  AGENT_MARKET_SIZE,
  TOURNAMENT_GAME_MODE,
  TOURNAMENT_LEADERBOARDS_COLLECTION,
  TOURNAMENT_RANKS_COLLECTION,
  leaderboardDocId,
  rankDocId,
  cpuAgentDocId,
} from '../../src/constants/leagueTournament.js';

const HUMAN = 'human-1';
const HUMAN_AGENT_ID = 'agent-human-1';
const MON_MORNING = new Date('2026-06-15T12:00:00.000Z'); // Mon 08:00 ET (EDT)
const MON_EVENING = new Date('2026-06-15T21:15:00.000Z'); // Mon 17:15 ET → day-1 banking
const FRI_EVENING = new Date('2026-06-19T22:30:00.000Z'); // Fri 18:30 ET → advancement

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubEnv('CRON_SECRET', 's3cret');
  vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', 'tradeseven.vercel.app');
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

// ==================== IN-MEMORY FIRESTORE (auto-id + where/limit/select/tx) ====================

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
  let autoSeq = 0;

  function makeDocRef(path) {
    return {
      path,
      id: path.split('/').pop(),
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
      delete: async () => { store.delete(path); writeLog.push(['delete', path]); },
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

  function snapshotOf(docs) {
    return { docs, empty: docs.length === 0, size: docs.length, forEach: (cb) => docs.forEach(cb) };
  }

  function makeCollection(prefix) {
    const filtered = (field, value) => topLevelDocs(prefix).filter(d => d.data()[field] === value);
    return {
      doc: (id) => makeDocRef(`${prefix}/${id ?? `auto-${++autoSeq}`}`),
      where: (field, op, value) => ({
        get: async () => snapshotOf(filtered(field, value)),
        limit: (n) => ({ get: async () => snapshotOf(filtered(field, value).slice(0, n)) }),
        select: () => ({ get: async () => snapshotOf(filtered(field, value)) }),
      }),
      get: async () => snapshotOf(topLevelDocs(prefix)),
    };
  }

  const db = {
    collection: (name) => makeCollection(name),
    runTransaction: async (fn) => fn({
      get: async (ref) => ref.get(),
      getAll: async (...refs) => Promise.all(refs.map(r => r.get())),
      set: (ref, data) => { store.set(ref.path, structuredClone(data)); writeLog.push(['tx.set', ref.path]); },
      update: (ref, updates) => {
        const data = store.get(ref.path);
        if (data === undefined) throw new Error(`tx.update on missing doc ${ref.path}`);
        applyDotPathUpdate(data, updates);
        writeLog.push(['tx.update', ref.path]);
      },
    }),
  };

  return { db, store, writeLog };
}

// ==================== FIXTURES ====================

const SYMBOLS = [
  'NVDA', 'AMD', 'TSLA', 'META', 'AAPL', 'MSFT', 'AMZN', 'GOOG', 'NFLX', 'AVGO',
  'CRM', 'ORCL', 'ADBE', 'COIN', 'PLTR', 'SHOP', 'SQ', 'UBER', 'ABNB', 'SNOW',
  'DDOG', 'NET', 'MDB', 'CRWD', 'PANW', 'ZS', 'TEAM', 'NOW', 'WDAY', 'HUBS',
  'INTC', 'MU', 'QCOM', 'TXN', 'ADI', 'LRCX', 'KLAC', 'AMAT', 'ASML', 'SMCI',
];
const STOCKS = SYMBOLS.map((symbol, i) => ({
  symbol, sectorName: 'Technology',
  fundamentalScore: 95 - i, technicalScore: 95 - i, baggerBombFit: 95 - i, atrPercentile: 0.5,
}));

// A flat quote per symbol — banking just needs settle-able prices; this
// battery proves the group BANKS, not exact scores (proven in its own battery).
const QUOTES = Object.fromEntries(SYMBOLS.map(s => [s, { open: 100, current: 101, previousClose: 100, timestamp: 1 }]));

/** The one human's agent (real, non-CPU) so resolveGroupAgents finds it and
 * the stub produces its board; CPUs get real system agents from formation. */
function humanAgentDoc() {
  return {
    ownerId: HUMAN, isCpu: false, name: 'Ada', archetype: 'analyst',
    config: { risk: 50, concentration: 50, momentum: 50 },
    personality: { traits: [] }, consolidatedInsight: '', evolutionCycle: 0,
  };
}

/** Tool-forced submit_board stub for the human's agent (the only model call). */
const anthropicStub = {
  messages: {
    create: async () => ({
      content: [{
        type: 'tool_use', name: 'submit_board',
        input: {
          board: SYMBOLS.slice(0, 18).map(symbol => ({ symbol, rationale: 'edge' })),
          userPicksReaction: [],
        },
      }],
    }),
  },
};

/** The seam db: the full rankings universe + the one human's real agent. */
function makeSeamDb() {
  return makeDb({
    'indexIntelligence/stockRankings': { stocks: STOCKS },
    [`agents/${HUMAN_AGENT_ID}`]: humanAgentDoc(),
  });
}

/** The human commits their own 3-pick user board during the forming window. */
function commitHumanBoard(db, store, groupId) {
  const groupDoc = store.get(`tournamentGroups/${groupId}`);
  const commit = buildBoardCommit({
    group: { id: groupId, ...groupDoc }, odUserId: HUMAN,
    board: SYMBOLS.slice(0, 15), prefillAsSuggested: [], now: MON_MORNING.toISOString(),
  });
  return db.collection('tournamentGroups').doc(groupId).collection('boards').doc(HUMAN).set(commit);
}

/** Run the live Monday pipeline with the deploy fetch stubbed (the one model
 * call is the human's agent board via anthropicStub; CPUs use the fallback). */
async function runSeamMonday(db) {
  const fetchImpl = vi.fn(async () => ({ ok: true }));
  const mondaySummary = await runMondayPipeline(db, {
    now: MON_MORNING, anthropic: anthropicStub, fetchImpl, deployEnabled: true, pacingMs: 0,
  });
  return { mondaySummary, fetchImpl };
}

/** Form a solo base-layer group from a lobby, commit the human's user board
 * (the forming-week act), and run the live Monday pipeline. Returns the
 * battle-ready, formation-produced group. */
async function formAndRunMonday() {
  const { db, store, writeLog } = makeSeamDb();
  const { id } = await createLobby(db, { createdBy: HUMAN, displayName: 'Ada', now: MON_MORNING });
  const formed = await formGroupFromLobby(db, id, { now: MON_MORNING });
  const groupId = formed.groupId;
  await commitHumanBoard(db, store, groupId);
  const { mondaySummary, fetchImpl } = await runSeamMonday(db);
  return { db, store, writeLog, groupId, formed, mondaySummary, fetchImpl };
}

// ==================== STAGE 1+2 — FORMATION → MONDAY PIPELINE ====================

describe('SEAM: formation → Monday pipeline (a base-layer + CPU group through the live Monday arc)', () => {
  it('the formed group is a PRODUCTION base-layer group of one human + three CPUs', async () => {
    const { store, groupId, formed } = await formAndRunMonday();
    expect(formed.humanCount).toBe(1);
    expect(formed.cpuNs).toEqual([1, 2, 3]);
    const group = store.get(`tournamentGroups/${groupId}`);
    expect(group.baseLayerWeek).toBeTruthy();
    expect(group).not.toHaveProperty('bracketGameId'); // base-layer, not bracket
    expect(group).not.toHaveProperty('isDev');         // production scope
  });

  it('resolves the user draft, produces boards (human=model, CPUs=fallback, 0 synthetic), drafts 24, deploys 4', async () => {
    const { store, groupId, mondaySummary, fetchImpl } = await formAndRunMonday();

    expect(mondaySummary).toMatchObject({
      groups: 1, resolved: 1, deferredBoards: 0, refusedSynthetic: 0, drafted: 1, errors: 0,
    });
    expect(mondaySummary.deploys.deployed).toBe(4);

    const group = store.get(`tournamentGroups/${groupId}`);
    expect(group.status).toBe(GROUP_STATUS.BATTLE);
    expect(group.players.every(p => p.picks.length === 3)).toBe(true);

    // Board provenance: the human's is a model board; the CPUs' are the
    // deterministic fallback; NOTHING is synthetic (the P3a refusal contract
    // holds on a real base-layer group too).
    const humanBoard = store.get(`tournamentGroups/${groupId}/agentBoards/${HUMAN_AGENT_ID}`);
    expect(humanBoard.fallback).toBe(false);
    expect(humanBoard.synthetic).toBeUndefined();
    for (const n of [1, 2, 3]) {
      const b = store.get(`tournamentGroups/${groupId}/agentBoards/${cpuAgentDocId(n)}`);
      expect(b.fallback).toBe(true);
      expect(b.fallbackReason).toBe('cpu_agent');
      expect(b.synthetic).toBeUndefined();
      // Agent boards carry baseLayerWeek (not bracketGameId) for a base group.
      expect(b.baseLayerWeek).toBeTruthy();
      expect(b).not.toHaveProperty('bracketGameId');
    }

    // The agent draft acquired the full 24-name market.
    const stream = store.get(`tournamentGroups/${groupId}/streams/agentDraft`);
    expect(stream.events).toHaveLength(AGENT_MARKET_SIZE);
    const ledger = store.get(`tournamentGroups/${groupId}/ledger/agentHeldSet`);
    expect(Object.keys(ledger.held)).toHaveLength(AGENT_MARKET_SIZE);

    // Deploys: the three CPU seats carry the CPU marker, the human does not;
    // all four carry tournament gameMode + the groupId.
    const bodies = fetchImpl.mock.calls.map(([, opts]) => JSON.parse(opts.body));
    expect(bodies).toHaveLength(4);
    expect(bodies.every(b => b.gameMode === TOURNAMENT_GAME_MODE && b.groupId === groupId)).toBe(true);
    expect(bodies.filter(b => b.isCpu === true)).toHaveLength(3);
    expect(bodies.filter(b => b.isCpu === undefined)).toHaveLength(1);
  });
});

// ==================== STAGE 3+4 — BANKING → FRIDAY BASE-LAYER COMPLETE ====================

describe('SEAM: formation → banking → Friday base-layer COMPLETE (rank + leaderboard, CPU-farm guard)', () => {
  it('a real banking day records all four seats (CPU + human) on the formed base-layer group', async () => {
    const { db, store, groupId } = await formAndRunMonday();
    const agentScores = { [HUMAN]: 30, 'cpu-1': 10, 'cpu-2': 12, 'cpu-3': 8 };
    const res = await bankGroup(db, groupId, QUOTES, { now: MON_EVENING, agentScores, recordedBy: 'seam' });
    expect(res.skipped).toBe(false);
    const banked = store.get(`tournamentGroups/${groupId}`).dailyScores.day1;
    expect(banked).toBeDefined();
    expect(Object.keys(banked.closeScores).sort()).toEqual([HUMAN, 'cpu-1', 'cpu-2', 'cpu-3'].sort());
  });

  it('a banked week completes the base-layer group: status COMPLETE, rank applied to four, CPU-farm guard = 0 for the solo human', async () => {
    const { db, store, groupId } = await formAndRunMonday();

    // Day 1 is a REAL banking pass (proves banking runs on the combination);
    // days 2–5 are injected clean cumulative snapshots — exactly the shape the
    // advancement battery banks — to reach a clean day-5 week (banking's own
    // multi-day accumulation is proven in tournamentBanking.test.js). The
    // advancement reads the day-5 snapshot for scores and day-1 for the month.
    await bankGroup(db, groupId, QUOTES, {
      now: MON_EVENING, agentScores: { [HUMAN]: 10, 'cpu-1': 5, 'cpu-2': 5, 'cpu-3': 5 }, recordedBy: 'seam',
    });
    const cumulative = (user, agent) => ({ totalPoints: user, agentPoints: agent, compositePoints: agent + 1.5 * user, picks: [] });
    const injectDay = (n, date, scores) => ({
      [`dailyScores.day${n}`]: {
        recordedDate: date, recordedAt: `${date}T21:15:00.000Z`, recordedBy: 'seam',
        closeScores: {
          [HUMAN]: cumulative(scores.h.u, scores.h.a),
          'cpu-1': cumulative(scores.c1.u, scores.c1.a),
          'cpu-2': cumulative(scores.c2.u, scores.c2.a),
          'cpu-3': cumulative(scores.c3.u, scores.c3.a),
        },
      },
    });
    // Cumulative standings climbing to a clean day-5 close; human finishes top.
    await db.collection('tournamentGroups').doc(groupId).update(injectDay(2, '2026-06-16', { h: { u: 14, a: 12 }, c1: { u: 8, a: 6 }, c2: { u: 9, a: 7 }, c3: { u: 6, a: 4 } }));
    await db.collection('tournamentGroups').doc(groupId).update(injectDay(3, '2026-06-17', { h: { u: 18, a: 16 }, c1: { u: 12, a: 9 }, c2: { u: 13, a: 10 }, c3: { u: 8, a: 6 } }));
    await db.collection('tournamentGroups').doc(groupId).update(injectDay(4, '2026-06-18', { h: { u: 22, a: 20 }, c1: { u: 16, a: 12 }, c2: { u: 17, a: 13 }, c3: { u: 10, a: 8 } }));
    await db.collection('tournamentGroups').doc(groupId).update(injectDay(5, '2026-06-19', { h: { u: 26, a: 24 }, c1: { u: 20, a: 14 }, c2: { u: 22, a: 16 }, c3: { u: 12, a: 9 } }));

    const summary = await runFridayAdvancement(db, { now: FRI_EVENING });

    // Base-layer COMPLETE (ruled): completed, never recomposed; rank +
    // leaderboard finalized for all four.
    expect(summary.baseCompleted).toBe(1);
    expect(summary.composedGroups).toEqual([]);
    expect(summary.rankApplied).toBe(4);
    expect(summary.errors).toBe(0);
    expect(store.get(`tournamentGroups/${groupId}`).status).toBe(GROUP_STATUS.COMPLETE);

    // The CPU-farm guard (B-2): a solo human's three opponents are all CPUs →
    // cpuOpponents 3 on the rank application (guard nils positive RP — proven
    // in the schema battery; here we prove the COUNT is correct from a
    // formation-produced base-layer group).
    const humanRank = store.get(`${TOURNAMENT_RANKS_COLLECTION}/${rankDocId(HUMAN)}`);
    expect(humanRank.appliedGroups[groupId]).toBeDefined();
    expect(humanRank.appliedGroups[groupId].cpuOpponents).toBe(3);
    expect(humanRank.isCpu).toBe(false);

    // CPU rows never ratchet a tier floor (§7.1).
    const cpuRank = store.get(`${TOURNAMENT_RANKS_COLLECTION}/${rankDocId('cpu-1')}`);
    expect(cpuRank.isCpu).toBe(true);
    expect(cpuRank.floorRp).toBe(0);

    // The seasonal leaderboard recorded the human's finalized week (production
    // namespace — not dev). Month = ET month of the day-1 banking date.
    const board = store.get(`${TOURNAMENT_LEADERBOARDS_COLLECTION}/${leaderboardDocId('2026-06')}`);
    expect(board.entries[HUMAN].weeks[groupId].final).toBe(true);
  });
});

// ==================== STAGE 5 — THE WRITER-FED EXCLUSION INVARIANT (Slice 3.1) ====================
//
// Slice 3.0 proved the exclusion READS drop a HAND-BUILT { isTraining: true }
// fixture (tournamentLeaderboard/advancement/banking/p4Flips tests). Slice 3.1
// closes the loop the fixtures couldn't: it feeds the REAL WRITER's output — the
// group doc quickPlay({ isTraining: true }) actually produces, padded + drafted +
// deployed + banked by the LIVE duties — through those same reads, asserting it is
// ABSENT from leaderboard / career rank / bracket, yet PRESENT in banking and
// reaching COMPLETE. The writer is non-fenced: the training pod rides the existing
// deploy -> createAgentBattle path UNCHANGED (battles keyed by groupId; isTraining
// is a group-doc concept, NEVER stamped on the battle doc — zero fence contact).

/** quickPlay a TRAINING pod (the real entry-point writer threads isTraining ->
 * formGroupFromLobby -> createTournamentGroupDoc), commit the one human's board,
 * and run the live Monday pipeline — exactly the ranked helper, flagged no-stakes. */
async function quickPlayTrainingAndRunMonday() {
  const { db, store, writeLog } = makeSeamDb();
  // The REAL entry-point writer: quickPlay threads isTraining -> formGroupFromLobby
  // -> createTournamentGroupDoc. Same solo cold-start, flagged no-stakes.
  const { lobbyId, groupId } = await quickPlay(db, {
    odUserId: HUMAN, displayName: 'Ada', now: MON_MORNING, isTraining: true,
  });
  await commitHumanBoard(db, store, groupId);
  const { mondaySummary, fetchImpl } = await runSeamMonday(db);
  return { db, store, writeLog, lobbyId, groupId, mondaySummary, fetchImpl };
}

describe('SEAM: the writer-fed exclusion invariant (Slice 3.1 — the REAL isTraining writer through the 3.0 reads)', () => {
  it('quickPlay(isTraining:true) WRITES a correct training pod: isTraining, baseLayerWeek, FORMING, 1 human + 3 CPU, never isDev/bracket', async () => {
    const { db, store } = makeSeamDb();
    const { groupId, humanCount, cpuNs } = await quickPlay(db, {
      odUserId: HUMAN, displayName: 'Ada', now: MON_MORNING, isTraining: true,
    });
    expect(humanCount).toBe(1);
    expect(cpuNs).toEqual([1, 2, 3]);                 // solo seat padded 1 human + 3 CPU (reused)
    const group = store.get(`tournamentGroups/${groupId}`);
    expect(group.isTraining).toBe(true);              // the writer stamped the flag
    expect(group.baseLayerWeek).toBeTruthy();         // a training pod still carries the week (XOR holds)
    expect(group.status).toBe(GROUP_STATUS.FORMING);
    expect(group).not.toHaveProperty('bracketGameId'); // base-layer, never a bracket cohort
    expect(group).not.toHaveProperty('isDev');         // production scope (seam fact #2)
    expect(group.players.filter(p => p.isCpu === true)).toHaveLength(3);
    expect(group.players.filter(p => p.isCpu !== true)).toHaveLength(1);
  });

  it('the writer output RUNS the agent layer like any group: Monday -> BATTLE, 4 deploys keyed by groupId, isTraining NEVER on a battle body', async () => {
    const { store, groupId, mondaySummary, fetchImpl } = await quickPlayTrainingAndRunMonday();
    expect(mondaySummary).toMatchObject({ groups: 1, resolved: 1, drafted: 1, errors: 0 });
    expect(mondaySummary.deploys.deployed).toBe(4);
    expect(store.get(`tournamentGroups/${groupId}`).status).toBe(GROUP_STATUS.BATTLE);

    // The training pod is just another group the deploy processes: every battle
    // carries the tournament gameMode + the groupId (the joint-stamp contract) and
    // NONE carries isTraining — proving zero fence contact (createAgentBattle's doc
    // shape is reached via the existing deploy path, never edited, no new call site).
    const bodies = fetchImpl.mock.calls.map(([, opts]) => JSON.parse(opts.body));
    expect(bodies).toHaveLength(4);
    expect(bodies.every(b => b.gameMode === TOURNAMENT_GAME_MODE && b.groupId === groupId)).toBe(true);
    expect(bodies.some(b => 'isTraining' in b)).toBe(false);
  });

  it('PRESENT in banking: a real banking day records all four seats on the training pod (the flag is irrelevant to banking)', async () => {
    const { db, store, groupId } = await quickPlayTrainingAndRunMonday();
    const res = await bankGroup(db, groupId, QUOTES, {
      now: MON_EVENING, agentScores: { [HUMAN]: 20, 'cpu-1': 10, 'cpu-2': 12, 'cpu-3': 8 }, recordedBy: 'seam',
    });
    expect(res.skipped).toBe(false);
    const banked = store.get(`tournamentGroups/${groupId}`).dailyScores.day1;
    expect(banked).toBeDefined();
    expect(Object.keys(banked.closeScores).sort()).toEqual([HUMAN, 'cpu-1', 'cpu-2', 'cpu-3'].sort());
  });

  it('ABSENT from the leaderboard READ: the nightly aggregation excludes the BATTLE-status training pod the writer produced', async () => {
    const { db } = await quickPlayTrainingAndRunMonday();
    // The pod is in BATTLE (a non-training group of identical shape WOULD be
    // eligible). The aggregation opts into excludeTraining, so the writer's
    // output is filtered out at the query — nothing reaches the seasonal board.
    const agg = await aggregateTournamentLeaderboards(db, { now: MON_EVENING });
    expect(agg.groups).toBe(0);
    expect(agg.docsWritten).toBe(0);
  });

  it('ABSENT from rank + bracket, then COMPLETE: Friday gives the writer output the PLAIN FINISH — no rank, no leaderboard, no cut', async () => {
    const { db, store, groupId } = await quickPlayTrainingAndRunMonday();

    // Day 1 real banking; days 2–5 injected cumulative snapshots to a clean
    // day-5 week (mirrors the ranked seam + the advancement battery).
    await bankGroup(db, groupId, QUOTES, {
      now: MON_EVENING, agentScores: { [HUMAN]: 10, 'cpu-1': 5, 'cpu-2': 5, 'cpu-3': 5 }, recordedBy: 'seam',
    });
    const cumulative = (user, agent) => ({ totalPoints: user, agentPoints: agent, compositePoints: agent + 1.5 * user, picks: [] });
    const injectDay = (n, date, scores) => ({
      [`dailyScores.day${n}`]: {
        recordedDate: date, recordedAt: `${date}T21:15:00.000Z`, recordedBy: 'seam',
        closeScores: {
          [HUMAN]: cumulative(scores.h.u, scores.h.a),
          'cpu-1': cumulative(scores.c1.u, scores.c1.a),
          'cpu-2': cumulative(scores.c2.u, scores.c2.a),
          'cpu-3': cumulative(scores.c3.u, scores.c3.a),
        },
      },
    });
    await db.collection('tournamentGroups').doc(groupId).update(injectDay(2, '2026-06-16', { h: { u: 14, a: 12 }, c1: { u: 8, a: 6 }, c2: { u: 9, a: 7 }, c3: { u: 6, a: 4 } }));
    await db.collection('tournamentGroups').doc(groupId).update(injectDay(3, '2026-06-17', { h: { u: 18, a: 16 }, c1: { u: 12, a: 9 }, c2: { u: 13, a: 10 }, c3: { u: 8, a: 6 } }));
    await db.collection('tournamentGroups').doc(groupId).update(injectDay(4, '2026-06-18', { h: { u: 22, a: 20 }, c1: { u: 16, a: 12 }, c2: { u: 17, a: 13 }, c3: { u: 10, a: 8 } }));
    await db.collection('tournamentGroups').doc(groupId).update(injectDay(5, '2026-06-19', { h: { u: 26, a: 24 }, c1: { u: 20, a: 14 }, c2: { u: 22, a: 16 }, c3: { u: 12, a: 9 } }));

    const summary = await runFridayAdvancement(db, { now: FRI_EVENING });

    // The training plain finish (Spec §2/§5): COMPLETE, counted as TRAINING, NOT
    // as a base-layer ladder finish — and ZERO ladder side-effects.
    expect(store.get(`tournamentGroups/${groupId}`).status).toBe(GROUP_STATUS.COMPLETE);
    expect(summary.trainingCompleted).toBe(1);
    expect(summary.baseCompleted).toBe(0);    // not the ranked finish
    expect(summary.composedGroups).toEqual([]); // never composed into a bracket
    expect(summary.rankApplied).toBe(0);      // no career rank applied
    expect(summary.leaderboardDocs).toBe(0);  // no leaderboard finalized
    expect(summary.errors).toBe(0);

    // ABSENT from career rank: no rank doc for the human (the plain finish skips
    // runWeekSideEffects entirely).
    expect(store.get(`${TOURNAMENT_RANKS_COLLECTION}/${rankDocId(HUMAN)}`)).toBeUndefined();
    // ABSENT from the seasonal leaderboard: no board doc for the week's month.
    expect(store.get(`${TOURNAMENT_LEADERBOARDS_COLLECTION}/${leaderboardDocId('2026-06')}`)).toBeUndefined();
  });
});
