// api/_utils/tournamentOrchestrator.test.js
//
// P3b battery for the orchestrator (Ruling A verbatim). Blocks: the ET-aware
// dispatcher under BOTH DST arms, the two-grain idempotency (per-duty/
// per-ET-date markers + natural guards), the deploy plumbing (credentials +
// ownership assertion on every call; the P4 gate sending NOTHING and logging
// loudly), the Monday pipeline end-to-end on an all-CPU group (no model
// call anywhere — Ruling B1's deterministic path), the P5 deadline
// auto-commit (defaulted boards heal the pipeline in-tick; finding #5's loud
// defer holds as the fallback), the synthetic refusal (the P3a contract),
// the incumbent fan-out via the
// fenced flattenPortfolioServer, and zero-group production inertness (the
// cron is live at merge — this lock IS the safety case).
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): this file's real import of
// tournamentOrchestrator.js IS the runtime guard that its transitive import
// surface (src/constants/leagueTournament.js via every pipeline step) stays
// Node-clean. Never mock that import.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// TOURNAMENT_ADVANCEMENT_FROZEN defaults TRUE (the emergency freeze). This
// suite drives runMondayPipeline (whose Friday catch-up calls the now-frozen-by-
// default runFridayAdvancement) and runOrchestratorTick — exercise them in the
// NORMAL, flag-OFF regime; the freeze's own behavior is covered by
// tournamentAdvancementFreeze.test.js. Override only this flag (importOriginal
// spread keeps every other flag real).
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  TOURNAMENT_ADVANCEMENT_FROZEN: false,
}));

import {
  DUTY,
  TOURNAMENT_DEPLOY_ENABLED,
  DEPLOY_FAILURE_COOLDOWN_MS,
  getDutyForInstant,
  dutyMarkerKey,
  isDutyComplete,
  markDutyComplete,
  readOrchestratorState,
  pruneState,
  deployBaseUrl,
  buildDeployRequest,
  latestTournamentBattlesByAgent,
  fanOutDeploys,
  runMondayPipeline,
  runWeekdayFanout,
  isDutySatisfied,
  runOrchestratorTick,
  sweepTrainingActivation,
  activateTrainingPod,
} from './tournamentOrchestrator.js';
import {
  GROUP_STATUS,
  AGENT_MARKET_SIZE,
  TOURNAMENT_GAME_MODE,
  cpuAgentDocId,
  trainingCloneDocId,
} from '../../src/constants/leagueTournament.js';
import { buildCpuAgentDoc } from './tournamentCpu.js';

// Monday 2026-06-15 08:00 ET (EDT). Friday evening + EST arms below.
const MON_MORNING_EDT = new Date('2026-06-15T12:00:00.000Z');

let logSpy;
beforeEach(() => {
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

// ==================== IN-MEMORY FIRESTORE ====================
// The advancement-battery fake, plus where().limit() (the agents ownerId
// lookup) and tx.getAll (the user-draft resolution).

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
      doc: (id) => makeDocRef(`${prefix}/${id}`),
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
  symbol,
  sectorName: 'Technology',
  fundamentalScore: 95 - i,
  technicalScore: 95 - i,
  baggerBombFit: 95 - i,
  atrPercentile: 0.5,
}));

const CPU_IDS = ['cpu-4', 'cpu-5', 'cpu-6', 'cpu-7'];

/** A forming all-CPU group with all four user boards committed (Ruling B1:
 * the pipeline needs NO model call end to end). */
function formingCpuGroup() {
  return {
    status: GROUP_STATUS.FORMING,
    roundNumber: 1,
    bracketGameId: 'b-r1-g2',
    groupMembers: [...CPU_IDS],
    players: CPU_IDS.map(odUserId => ({ odUserId, picks: [], isCpu: true })),
    userPool: [...SYMBOLS],
    claimSystem: { enabled: true, currentWaiverPriority: [], processingLog: [] },
    dailyScores: {},
  };
}

function mondayDb() {
  const initial = {
    'tournamentGroups/b-r1-g2': formingCpuGroup(),
    'indexIntelligence/stockRankings': { stocks: STOCKS },
  };
  CPU_IDS.forEach((id, i) => {
    const n = 4 + i;
    initial[`agents/${cpuAgentDocId(n)}`] = buildCpuAgentDoc(n, '2026-06-12T00:00:00.000Z');
    initial[`tournamentGroups/b-r1-g2/boards/${id}`] = { odUserId: id, board: SYMBOLS.slice(i * 3, i * 3 + 15), isCpu: true };
  });
  return makeDb(initial);
}

// ==================== DISPATCHER (both DST arms) ====================

describe('getDutyForInstant — the ruled duty table, ET-aware', () => {
  it('Monday morning → monday_pipeline (EDT and EST arms)', () => {
    expect(getDutyForInstant(new Date('2026-06-15T12:00:00Z')).duty).toBe(DUTY.MONDAY_PIPELINE); // 08:00 EDT
    expect(getDutyForInstant(new Date('2026-01-12T13:00:00Z')).duty).toBe(DUTY.MONDAY_PIPELINE); // 08:00 EST
  });

  it('Tue–Fri morning → weekday_fanout', () => {
    expect(getDutyForInstant(new Date('2026-06-16T12:10:00Z')).duty).toBe(DUTY.WEEKDAY_FANOUT);
    expect(getDutyForInstant(new Date('2026-06-19T11:30:00Z')).duty).toBe(DUTY.WEEKDAY_FANOUT); // Fri morning
  });

  it('Friday evening → friday_advancement (EDT and EST arms)', () => {
    expect(getDutyForInstant(new Date('2026-06-19T22:30:00Z')).duty).toBe(DUTY.FRIDAY_ADVANCEMENT); // 18:30 EDT
    expect(getDutyForInstant(new Date('2026-01-16T22:30:00Z')).duty).toBe(DUTY.FRIDAY_ADVANCEMENT); // 17:30 EST
  });

  it('Mon–Thu evenings and weekends → skip; the ET weekday decides, not UTC', () => {
    expect(getDutyForInstant(new Date('2026-06-15T22:30:00Z')).duty).toBe(DUTY.SKIP); // Mon evening
    // 01:00Z Tuesday = Monday 21:00 ET — still Monday in ET, still skip.
    expect(getDutyForInstant(new Date('2026-06-16T01:00:00Z')).duty).toBe(DUTY.SKIP);
    expect(getDutyForInstant(new Date('2026-06-20T13:00:00Z')).duty).toBe(DUTY.SKIP); // Saturday
  });

  it('reports the ET date the markers key on', () => {
    const routed = getDutyForInstant(new Date('2026-06-16T01:00:00Z'));
    expect(routed.etDate).toBe('2026-06-15');
  });
});

// ==================== STATE MARKERS ====================

describe('duty markers — grain one of the two-grain idempotency', () => {
  it('marks transactionally, reads back, and prunes beyond the retention window', async () => {
    const { db, store } = makeDb();
    const stale = dutyMarkerKey('2026-05-01', DUTY.WEEKDAY_FANOUT);
    store.set('tournamentOrchestrator/state', { duties: { [stale]: { completedAt: 'old' } }, deployCooldowns: {} });

    let state = await readOrchestratorState(db);
    expect(isDutyComplete(state, '2026-06-15', DUTY.MONDAY_PIPELINE)).toBe(false);

    await markDutyComplete(db, '2026-06-15', DUTY.MONDAY_PIPELINE, { groups: 1 }, '2026-06-15T12:00:00Z');
    state = await readOrchestratorState(db);
    expect(isDutyComplete(state, '2026-06-15', DUTY.MONDAY_PIPELINE)).toBe(true);
    expect(state.duties[stale]).toBeUndefined(); // pruned (> 14 days old)
  });

  it('the write reads the doc FRESH inside the transaction — a concurrent marker is never lost', async () => {
    const { db, store } = makeDb();
    // A marker written by "another run" after this run's stale snapshot.
    store.set('tournamentOrchestrator/state', {
      duties: { [dutyMarkerKey('2026-06-15', DUTY.WEEKDAY_FANOUT)]: { completedAt: 'other-run' } },
      deployCooldowns: { 'agent-x': '2026-06-15T12:30:00.000Z' },
    });
    await markDutyComplete(db, '2026-06-15', DUTY.MONDAY_PIPELINE, { groups: 1 }, '2026-06-15T12:00:00.000Z');
    const state = await readOrchestratorState(db);
    expect(isDutyComplete(state, '2026-06-15', DUTY.WEEKDAY_FANOUT)).toBe(true); // survived
    expect(state.deployCooldowns['agent-x']).toBe('2026-06-15T12:30:00.000Z');   // survived (unexpired)
  });

  it('SIMULATED markers live in their own namespace — a smoke run can never pre-satisfy the real cron', async () => {
    const { db } = makeDb();
    // Thursday smoke run "for next Monday" (the documented smoke arc).
    await markDutyComplete(db, '2026-06-15', DUTY.MONDAY_PIPELINE, { groups: 1 }, '2026-06-11T15:00:00.000Z', { simulated: true });
    const state = await readOrchestratorState(db);
    expect(isDutyComplete(state, '2026-06-15', DUTY.MONDAY_PIPELINE, { simulated: true })).toBe(true);  // re-click no-ops
    expect(isDutyComplete(state, '2026-06-15', DUTY.MONDAY_PIPELINE)).toBe(false);                       // real Monday RUNS
  });

  it('pruneState drops expired cooldowns and dates sim markers by their embedded date', () => {
    const pruned = pruneState({
      duties: {
        'sim:2026-05-01:monday_pipeline': { completedAt: 'old-sim' },
        'sim:2026-06-15:monday_pipeline': { completedAt: 'fresh-sim' },
        '2026-06-14:weekday_fanout': { completedAt: 'fresh' },
      },
      deployCooldowns: {
        'agent-old': '2026-06-15T11:00:00.000Z', // expired
        'agent-hot': '2026-06-15T12:30:00.000Z', // live
      },
    }, '2026-06-15', '2026-06-15T12:00:00.000Z');
    expect(pruned.duties['sim:2026-05-01:monday_pipeline']).toBeUndefined();
    expect(pruned.duties['sim:2026-06-15:monday_pipeline']).toBeDefined();
    expect(pruned.duties['2026-06-14:weekday_fanout']).toBeDefined();
    expect(pruned.deployCooldowns['agent-old']).toBeUndefined();
    expect(pruned.deployCooldowns['agent-hot']).toBeDefined();
  });
});

// ==================== DEPLOY PLUMBING ====================

describe('deploy plumbing — credentials + ownership assertion from day one', () => {
  it('the gate is OPEN (P4 flipped it inside the fence-entry PR, as contracted at P3b)', () => {
    expect(TOURNAMENT_DEPLOY_ENABLED).toBe(true);
  });

  it('base URL: VERCEL_PROJECT_PRODUCTION_URL with env-var override', () => {
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', 'tradeseven.vercel.app');
    expect(deployBaseUrl()).toBe('https://tradeseven.vercel.app');
    vi.stubEnv('TOURNAMENT_DEPLOY_BASE_URL', 'https://override.example');
    expect(deployBaseUrl()).toBe('https://override.example');
  });

  it('every call carries Bearer CRON_SECRET, the ownership assertion, gameMode, the prescribed six, the rider-#6 fields, and the CPU marker', () => {
    vi.stubEnv('CRON_SECRET', 's3cret');
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', 'tradeseven.vercel.app');
    const request = buildDeployRequest({
      agentId: 'agent-1', odUserId: 'user-1', isCpu: true, groupId: 'g1', symbols: ['NVDA', 'AMD'],
      userPicksStance: [{ symbol: 'NVDA', stance: 'agree' }],
      doubleDownSymbols: ['NVDA'],
      userPicks: ['NVDA', 'KO', 'XOM'],
    });
    expect(request.url).toBe('https://tradeseven.vercel.app/api/agent/decide');
    expect(request.headers.Authorization).toBe('Bearer s3cret');
    expect(request.body).toEqual({
      agentId: 'agent-1',
      ownerOdUserId: 'user-1',
      groupId: 'g1',
      gameMode: TOURNAMENT_GAME_MODE,
      prescribedPortfolio: ['NVDA', 'AMD'],
      userPicksStance: [{ symbol: 'NVDA', stance: 'agree' }],
      doubleDownSymbols: ['NVDA'],
      userPicks: ['NVDA', 'KO', 'XOM'],
      isCpu: true,
    });
    const bare = buildDeployRequest({ agentId: 'a', odUserId: 'u', groupId: 'g', symbols: [] }).body;
    expect(bare).not.toHaveProperty('isCpu');
    // Rider-#6 fields degrade to empty, never absent — the fence entry's
    // intake is shape-stable.
    expect(bare.userPicksStance).toEqual([]);
    expect(bare.doubleDownSymbols).toEqual([]);
    expect(bare.userPicks).toEqual([]);
  });

  it('GATED (via injection — the production gate opened at P4): nothing fetched, loud "P4 pending" lines, no pacing burned', async () => {
    const { db } = makeDb();
    const fetchImpl = vi.fn();
    const started = Date.now();
    const out = await fanOutDeploys(db, {
      groupId: 'g1',
      seats: [
        { agentId: 'a1', odUserId: 'u1', isCpu: false, symbols: ['NVDA'] },
        { agentId: 'a2', odUserId: 'cpu-1', isCpu: true, symbols: ['AMD'] },
      ],
      now: MON_MORNING_EDT,
      state: { duties: {}, deployCooldowns: {} },
      budget: null,
      fetchImpl,
      deployEnabled: false, // P4 flipped the module gate — the branch stays test-covered by injection
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(out.gated).toBe(2);
    expect(Date.now() - started).toBeLessThan(5000); // no 20s pacing while gated
    const gateLines = logSpy.mock.calls.map(c => c.join(' ')).filter(l => l.includes('P4 pending'));
    expect(gateLines).toHaveLength(2);
    expect(gateLines[0]).toContain('owner u1');
  });

  it("today's-battle natural guard skips the seat before the gate", async () => {
    const { db } = makeDb({
      'agentBattles/b1': {
        agentId: 'a1', groupId: 'g1', gameMode: TOURNAMENT_GAME_MODE,
        ownerId: 'u1', createdAt: '2026-06-15T11:00:00.000Z', // same ET date as MON_MORNING_EDT
      },
    });
    const out = await fanOutDeploys(db, {
      groupId: 'g1',
      seats: [{ agentId: 'a1', odUserId: 'u1', isCpu: false, symbols: ['NVDA'] }],
      now: MON_MORNING_EDT,
      state: { duties: {}, deployCooldowns: {} },
      fetchImpl: vi.fn(),
    });
    expect(out.skippedExisting).toBe(1);
    expect(out.gated).toBe(0);
  });

  it('a non-tournament battle never satisfies the guard (gameMode re-checked in memory)', async () => {
    const { db } = makeDb({
      'agentBattles/b1': { agentId: 'a1', groupId: 'g1', gameMode: 'baggerbomb_agent', ownerId: 'u1', createdAt: '2026-06-15T11:00:00.000Z' },
    });
    const latest = await latestTournamentBattlesByAgent(db, 'g1');
    expect(latest.size).toBe(0);
  });
});

// The LIVE branch (P4-day machinery) — exercised now via the injectable
// `deployEnabled`; the module const stays the only production gate.
describe('deploy plumbing — the live branch (deployEnabled injection)', () => {
  beforeEach(() => {
    vi.stubEnv('CRON_SECRET', 's3cret');
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', 'tradeseven.vercel.app');
  });

  const seats2 = () => [
    { agentId: 'a1', odUserId: 'u1', isCpu: false, symbols: ['NVDA'] },
    { agentId: 'a2', odUserId: 'u2', isCpu: false, symbols: ['AMD'] },
  ];

  it('successful deploys POST with credentials + assertion and count as deployed', async () => {
    const { db } = makeDb();
    const fetchImpl = vi.fn(async () => ({ ok: true }));
    const out = await fanOutDeploys(db, {
      groupId: 'g1', seats: seats2(), now: MON_MORNING_EDT,
      state: { duties: {}, deployCooldowns: {} },
      fetchImpl, deployEnabled: true, pacingMs: 0,
    });
    expect(out.deployed).toBe(2);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const [url, opts] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://tradeseven.vercel.app/api/agent/decide');
    expect(opts.headers.Authorization).toBe('Bearer s3cret');
    expect(JSON.parse(opts.body).ownerOdUserId).toBe('u1');
  });

  it('a failed deploy writes the ≥10-min cooldown (transactionally) and the next pass defers that agent', async () => {
    const { db, store } = makeDb();
    const state = { duties: {}, deployCooldowns: {} };
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 500, text: async () => 'boom' }));
    const out = await fanOutDeploys(db, {
      groupId: 'g1', seats: seats2().slice(0, 1), now: MON_MORNING_EDT,
      state, fetchImpl, deployEnabled: true, pacingMs: 0,
    });
    expect(out.failed).toBe(1);
    const expectedUntil = new Date(MON_MORNING_EDT.getTime() + DEPLOY_FAILURE_COOLDOWN_MS).toISOString();
    expect(state.deployCooldowns.a1).toBe(expectedUntil);                           // in-memory mirror
    expect(store.get('tournamentOrchestrator/state').deployCooldowns.a1).toBe(expectedUntil); // durable

    const retry = await fanOutDeploys(db, {
      groupId: 'g1', seats: seats2().slice(0, 1), now: MON_MORNING_EDT,
      state, fetchImpl, deployEnabled: true, pacingMs: 0,
    });
    expect(retry.cooled).toBe(1);
    expect(fetchImpl).toHaveBeenCalledTimes(1); // no second POST inside the cooldown
  });

  it('pacing is DUTY-scoped: the floor holds across group boundaries through a shared pacing object', async () => {
    const { db } = makeDb();
    const pacing = { lastSentAt: 0 };
    const sentAt = [];
    const fetchImpl = vi.fn(async () => { sentAt.push(Date.now()); return { ok: true }; });
    const opts = (groupId, seats) => ({
      groupId, seats, now: MON_MORNING_EDT,
      state: { duties: {}, deployCooldowns: {} },
      fetchImpl, deployEnabled: true, pacing, pacingMs: 120,
    });
    await fanOutDeploys(db, opts('gA', seats2().slice(0, 1)));
    await fanOutDeploys(db, opts('gB', [{ agentId: 'a9', odUserId: 'u9', isCpu: false, symbols: ['TSLA'] }]));
    expect(sentAt).toHaveLength(2);
    // Group B's first send waited out group A's pacing window.
    expect(sentAt[1] - sentAt[0]).toBeGreaterThanOrEqual(110);
  });

  it('the time budget defers the remainder instead of starting a call that cannot fit', async () => {
    const { db } = makeDb();
    const fetchImpl = vi.fn(async () => ({ ok: true }));
    const out = await fanOutDeploys(db, {
      groupId: 'g1', seats: seats2(), now: MON_MORNING_EDT,
      state: { duties: {}, deployCooldowns: {} },
      budget: { startMs: Date.now() - 10_000, deadlineMs: 5_000 }, // already past
      fetchImpl, deployEnabled: true, pacingMs: 0,
    });
    expect(out.deferred).toBe(2);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

// ==================== MONDAY PIPELINE ====================

describe('runMondayPipeline — the full Monday arc on an all-CPU group (no model call)', () => {
  it('resolves the user draft, produces CPU boards, drafts 24 held, deploys 4 live (the P4 gate is open)', async () => {
    const { db, store } = mondayDb();
    const fetchImpl = vi.fn(async () => ({ ok: true }));
    const summary = await runMondayPipeline(db, { now: MON_MORNING_EDT, anthropic: null, fetchImpl, pacingMs: 0 });

    expect(summary).toMatchObject({
      groups: 1, resolved: 1, deferredBoards: 0, refusedSynthetic: 0, drafted: 1, errors: 0,
    });
    expect(summary.deploys.deployed).toBe(4);
    expect(summary.deploys.gated).toBe(0);
    // Every live deploy carries the full P4 intake (joint stamp + rider #6).
    const bodies = fetchImpl.mock.calls.map(([, opts]) => JSON.parse(opts.body));
    expect(bodies).toHaveLength(4);
    for (const body of bodies) {
      expect(body.gameMode).toBe(TOURNAMENT_GAME_MODE);
      expect(body.groupId).toBe('b-r1-g2');
      expect(body.prescribedPortfolio).toHaveLength(6);
      expect(body.isCpu).toBe(true);
      expect(Array.isArray(body.userPicksStance)).toBe(true);
      expect(Array.isArray(body.doubleDownSymbols)).toBe(true);
    }

    const group = store.get('tournamentGroups/b-r1-g2');
    expect(group.status).toBe(GROUP_STATUS.BATTLE);
    expect(group.players.every(p => p.picks.length === 3)).toBe(true);
    expect(group.players.every(p => p.isCpu === true)).toBe(true); // survives resolution

    // Agent boards: deterministic CPU fallback, never synthetic.
    const boards = CPU_IDS.map((id, i) => store.get(`tournamentGroups/b-r1-g2/agentBoards/${cpuAgentDocId(4 + i)}`));
    expect(boards.every(b => b && b.fallback === true && b.fallbackReason === 'cpu_agent')).toBe(true);
    expect(boards.every(b => !b.synthetic)).toBe(true);

    // The resolution record + the 24-held acquisition.
    const stream = store.get('tournamentGroups/b-r1-g2/streams/agentDraft');
    expect(stream.events).toHaveLength(AGENT_MARKET_SIZE);
    const ledger = store.get('tournamentGroups/b-r1-g2/ledger/agentHeldSet');
    expect(Object.keys(ledger.held)).toHaveLength(AGENT_MARKET_SIZE);
  });

  it('re-run resumes idempotently: nothing re-resolves (gated branch via injection — battle-doc creation is the live guard)', async () => {
    const { db } = mondayDb();
    await runMondayPipeline(db, { now: MON_MORNING_EDT, anthropic: null, deployEnabled: false });
    const second = await runMondayPipeline(db, { now: MON_MORNING_EDT, anthropic: null, deployEnabled: false });
    expect(second).toMatchObject({ groups: 1, resolved: 0, drafted: 1, errors: 0 });
    expect(second.deploys.gated).toBe(4); // natural guards skip everything durable
  });

  it('DEADLINE AUTO-COMMIT (P5, ratified): a missing board is defaulted at the encounter and the pipeline proceeds in the same tick', async () => {
    const { db, store } = mondayDb();
    store.delete('tournamentGroups/b-r1-g2/boards/cpu-7');
    const fetchImpl = vi.fn(async () => ({ ok: true }));
    const summary = await runMondayPipeline(db, { now: MON_MORNING_EDT, anthropic: null, fetchImpl, pacingMs: 0 });

    expect(summary).toMatchObject({
      groups: 1, resolved: 1, autoCommitted: 1, deferredBoards: 0, refusedSynthetic: 0, drafted: 1, errors: 0,
    });
    expect(summary.deploys.deployed).toBe(4); // the full Monday — nothing deferred

    // Rider #1 fired through the same core, with the corpus flag.
    const board = store.get('tournamentGroups/b-r1-g2/boards/cpu-7');
    expect(board.autoCommitted).toBe(true);
    expect(board.board.length).toBeGreaterThanOrEqual(15); // floored to depth (CPU seat: no watchlist)
    expect(board.delta.every(d => d.status === 'added')).toBe(true); // honest empty suggestion

    // The player-facing record: one feed entry, atomic with the commit.
    const feed = store.get('tournamentGroups/b-r1-g2').feed;
    expect(feed.filter(e => e.type === 'board_auto_commit' && e.odUserId === 'cpu-7')).toHaveLength(1);

    expect(store.get('tournamentGroups/b-r1-g2').status).toBe(GROUP_STATUS.BATTLE);
    // The loud defer is GONE on the healed path; the duty earns its marker.
    expect(console.error.mock.calls.map(c => c.join(' ')).some(l => l.includes('USER BOARDS NOT COMMITTED'))).toBe(false);
    expect(isDutySatisfied(DUTY.MONDAY_PIPELINE, summary)).toBe(true);
  });

  it('FINDING #5 FALLBACK: when auto-commit cannot produce a valid board, the loud defer holds (no marker)', async () => {
    const { db, store } = mondayDb();
    store.delete('tournamentGroups/b-r1-g2/boards/cpu-7');
    // 12 names passes resolution's pool floor but sits below the board-commit
    // floor (15) — the floor pads to 12 and buildBoardCommit refuses.
    store.get('tournamentGroups/b-r1-g2').userPool = SYMBOLS.slice(0, 12);
    const summary = await runMondayPipeline(db, { now: MON_MORNING_EDT, anthropic: null });
    expect(summary.autoCommitted).toBe(0);
    expect(summary.deferredBoards).toBe(1);
    expect(summary.drafted).toBe(0);
    expect(store.get('tournamentGroups/b-r1-g2').status).toBe(GROUP_STATUS.FORMING);
    expect(console.error.mock.calls.map(c => c.join(' ')).some(l => l.includes('USER BOARDS NOT COMMITTED'))).toBe(true);
    expect(isDutySatisfied(DUTY.MONDAY_PIPELINE, summary)).toBe(false); // no marker → next tick retries
  });

  it('AUTO-COMMIT IDEMPOTENT RE-RUN: a second tick re-resolves nothing and duplicates no feed entries', async () => {
    const { db, store } = mondayDb();
    store.delete('tournamentGroups/b-r1-g2/boards/cpu-7');
    await runMondayPipeline(db, { now: MON_MORNING_EDT, anthropic: null, deployEnabled: false });
    const second = await runMondayPipeline(db, { now: MON_MORNING_EDT, anthropic: null, deployEnabled: false });
    expect(second).toMatchObject({ resolved: 0, autoCommitted: 0, drafted: 1, errors: 0 });
    const feed = store.get('tournamentGroups/b-r1-g2').feed;
    expect(feed.filter(e => e.type === 'board_auto_commit')).toHaveLength(1);
  });

  it('SYNTHETIC REFUSAL: members without agents docs stop the pipeline loudly before the draft', async () => {
    const { db, store } = mondayDb();
    for (let n = 4; n <= 7; n++) store.delete(`agents/${cpuAgentDocId(n)}`);
    const summary = await runMondayPipeline(db, { now: MON_MORNING_EDT, anthropic: null });
    expect(summary.refusedSynthetic).toBe(1);
    expect(summary.drafted).toBe(0);
    expect(store.get('tournamentGroups/b-r1-g2/streams/agentDraft')).toBeUndefined();
    expect(console.error.mock.calls.map(c => c.join(' ')).some(l => l.includes('REFUSING PIPELINE'))).toBe(true);
    expect(isDutySatisfied(DUTY.MONDAY_PIPELINE, summary)).toBe(false);
  });

  it('SYNTHETIC REFUSAL HOLDS ON EVERY TICK: the persisted synthetic board still refuses on the re-run', async () => {
    // Code-review finding (June 12, 2026): tick 1 persists the synthetic
    // board; a one-shot check would count it as a plain skip on tick 2 and
    // let the configuration error draft. The skip path must classify it.
    const { db, store } = mondayDb();
    for (let n = 4; n <= 7; n++) store.delete(`agents/${cpuAgentDocId(n)}`);
    await runMondayPipeline(db, { now: MON_MORNING_EDT, anthropic: null });   // tick 1: boards persisted
    const second = await runMondayPipeline(db, { now: MON_MORNING_EDT, anthropic: null }); // tick 2
    expect(second.refusedSynthetic).toBe(1);
    expect(second.drafted).toBe(0);
    expect(store.get('tournamentGroups/b-r1-g2/streams/agentDraft')).toBeUndefined(); // never drafts
  });

  it('zero groups: clean no-op, zero writes (production state at merge)', async () => {
    const { db, writeLog } = makeDb({ 'indexIntelligence/stockRankings': { stocks: STOCKS } });
    const summary = await runMondayPipeline(db, { now: MON_MORNING_EDT, anthropic: null });
    expect(summary.groups).toBe(0);
    expect(writeLog).toHaveLength(0);
  });
});

// ==================== WEEKDAY FAN-OUT ====================

describe('runWeekdayFanout — incumbents via the fenced flattenPortfolioServer (read-only)', () => {
  const TUE = new Date('2026-06-16T12:10:00.000Z');

  function battleDb({ withBattle = true } = {}) {
    const group = { ...formingCpuGroup(), status: GROUP_STATUS.BATTLE };
    const initial = { 'tournamentGroups/b-r1-g2': group };
    if (withBattle) {
      initial['agentBattles/bt1'] = {
        agentId: cpuAgentDocId(4),
        groupId: 'b-r1-g2',
        gameMode: TOURNAMENT_GAME_MODE,
        ownerId: 'cpu-4',
        createdAt: '2026-06-15T13:40:00.000Z', // yesterday — guard must not skip
        portfolio: {
          star: [{ symbol: 'NVDA' }],
          core: [{ symbol: 'AMD' }, { symbol: 'TSLA' }],
          support: [{ symbol: 'META' }, { symbol: 'AAPL' }, { symbol: 'MSFT' }],
        },
      };
    }
    return makeDb(initial);
  }

  it('gated posture (via injection): no battles → one quiet line per group, satisfied (marker-worthy)', async () => {
    const { db, writeLog } = battleDb({ withBattle: false });
    const summary = await runWeekdayFanout(db, { now: TUE, deployEnabled: false });
    expect(summary).toMatchObject({ groups: 1, noBattles: 1, errors: 0 });
    expect(isDutySatisfied(DUTY.WEEKDAY_FANOUT, summary)).toBe(true);
    expect(writeLog).toHaveLength(0);
  });

  it("an incumbent battle's six flatten into a gated deploy seat (gated branch via injection)", async () => {
    const { db } = battleDb();
    const summary = await runWeekdayFanout(db, { now: TUE, deployEnabled: false });
    expect(summary.deploys.gated).toBe(1);
    const gateLine = logSpy.mock.calls.map(c => c.join(' ')).find(l => l.includes('P4 pending'));
    expect(gateLine).toContain('NVDA, AMD, TSLA, META, AAPL, MSFT'); // tier order — the fenced flatten
    expect(gateLine).toContain('CPU');
  });

  it('zero groups: clean no-op, zero writes', async () => {
    const { db, writeLog } = makeDb();
    const summary = await runWeekdayFanout(db, { now: TUE });
    expect(summary.groups).toBe(0);
    expect(writeLog).toHaveLength(0);
  });

  it('an empty-portfolio latest battle is a LOUD error, never a silent seat drop — marker withheld', async () => {
    const { db, store } = battleDb();
    store.get('agentBattles/bt1').portfolio = {}; // schema drift: flattens to []
    const summary = await runWeekdayFanout(db, { now: TUE, deployEnabled: true, pacingMs: 0, fetchImpl: vi.fn(async () => ({ ok: true })) });
    expect(summary.errors).toBeGreaterThan(0);
    expect(isDutySatisfied(DUTY.WEEKDAY_FANOUT, summary)).toBe(false);
    expect(console.error.mock.calls.map(c => c.join(' ')).some(l => l.includes('empty portfolio'))).toBe(true);
  });

  it("Monday-failure catch-up: an agent with NO battle deploys the stream's drafted six instead of vanishing for the week", async () => {
    // Code-review finding (June 12, 2026): post-P4, an all-morning Monday
    // failure left the agent with no battle, and the incumbent query alone
    // would never seat it again until Friday.
    vi.stubEnv('CRON_SECRET', 's3cret');
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', 'tradeseven.vercel.app');
    const { db, store } = battleDb(); // one battle (cpu-agent-4); three agents battle-less
    store.set('tournamentGroups/b-r1-g2/streams/agentDraft', {
      picksByAgent: {
        [cpuAgentDocId(4)]: ['NVDA', 'AMD', 'TSLA', 'META', 'AAPL', 'MSFT'],
        [cpuAgentDocId(5)]: ['AMZN', 'GOOG', 'NFLX', 'AVGO', 'CRM', 'ORCL'],
      },
      events: [
        { agentId: cpuAgentDocId(4), odUserId: 'cpu-4' },
        { agentId: cpuAgentDocId(5), odUserId: 'cpu-5' },
      ],
    });
    const fetchImpl = vi.fn(async () => ({ ok: true }));
    const summary = await runWeekdayFanout(db, { now: TUE, deployEnabled: true, pacingMs: 0, fetchImpl });
    expect(summary.mondayCatchupSeats).toBe(1); // cpu-agent-5 seated from the stream
    expect(summary.deploys.deployed).toBe(2);   // the incumbent AND the catch-up
    const bodies = fetchImpl.mock.calls.map(([, opts]) => JSON.parse(opts.body));
    expect(bodies.find(b => b.agentId === cpuAgentDocId(5)).prescribedPortfolio).toEqual(['AMZN', 'GOOG', 'NFLX', 'AVGO', 'CRM', 'ORCL']);
  });
});

// ==================== THE TICK ====================

describe('runOrchestratorTick — routing, markers, inertness', () => {
  it('off-table ticks are one quiet skip line, zero writes', async () => {
    const { db, writeLog } = makeDb();
    const result = await runOrchestratorTick(db, { now: new Date('2026-06-15T22:30:00Z') }); // Mon evening
    expect(result.duty).toBe(DUTY.SKIP);
    expect(writeLog).toHaveLength(0);
    expect(logSpy.mock.calls.map(c => c.join(' ')).some(l => l.includes('duty=skip'))).toBe(true);
  });

  it('zero-group duty ticks log the quiet skip and write nothing — no marker', async () => {
    const { db, writeLog } = makeDb({ 'indexIntelligence/stockRankings': { stocks: STOCKS } });
    const result = await runOrchestratorTick(db, { now: MON_MORNING_EDT });
    expect(result.duty).toBe(DUTY.MONDAY_PIPELINE);
    expect(result.groups).toBe(0);
    expect(writeLog).toHaveLength(0);
  });

  it('a satisfied duty sets the marker; the next tick is an idempotent no-op', async () => {
    const { db, store } = mondayDb();
    const fetchImpl = vi.fn(async () => ({ ok: true }));
    const first = await runOrchestratorTick(db, { now: MON_MORNING_EDT, fetchImpl, pacingMs: 0 });
    expect(first.complete).toBe(true);
    expect(first.deploys.deployed).toBe(4); // the P4 gate is open — deploys are live
    expect(store.get('tournamentOrchestrator/state').duties[dutyMarkerKey('2026-06-15', DUTY.MONDAY_PIPELINE)]).toBeDefined();

    const second = await runOrchestratorTick(db, { now: new Date('2026-06-15T12:10:00Z'), fetchImpl, pacingMs: 0 });
    expect(second.status).toBe('already_complete');
    expect(fetchImpl).toHaveBeenCalledTimes(4); // no re-deploys behind the marker
  });

  it('forceDuty + injected clock are the dev time controls (run Monday on any instant)', async () => {
    const { db } = mondayDb();
    const result = await runOrchestratorTick(db, {
      now: new Date('2026-06-18T15:00:00Z'), // a Thursday
      forceDuty: DUTY.MONDAY_PIPELINE,
      fetchImpl: vi.fn(async () => ({ ok: true })),
      pacingMs: 0,
    });
    expect(result.duty).toBe(DUTY.MONDAY_PIPELINE);
    expect(result.complete).toBe(true);
  });

  it('an unsatisfied duty (finding-#5 fallback deferral) sets NO marker — the next tick retries', async () => {
    const { db, store } = mondayDb();
    store.delete('tournamentGroups/b-r1-g2/boards/cpu-7');
    // 12-name pool: the P5 auto-commit cannot reach the board floor, so the
    // group defers (the pre-P5 fixture now heals and would satisfy the duty).
    store.get('tournamentGroups/b-r1-g2').userPool = SYMBOLS.slice(0, 12);
    const result = await runOrchestratorTick(db, { now: MON_MORNING_EDT });
    expect(result.complete).toBe(false);
    expect(store.get('tournamentOrchestrator/state')).toBeUndefined();
  });
});

// ==================== DUTY SATISFACTION ====================

describe('isDutySatisfied — what earns the marker', () => {
  it('gated deploys count as done (the ruled pre-P4 posture); failures and deferrals do not', () => {
    const base = { groups: 1, resolved: 1, autoCommitted: 0, deferredBoards: 0, refusedSynthetic: 0, drafted: 1, deferredToNextTick: 0, errors: 0 };
    const deploys = (over = {}) => ({ deployed: 0, gated: 4, skippedExisting: 0, cooled: 0, failed: 0, deferred: 0, ...over });
    expect(isDutySatisfied(DUTY.MONDAY_PIPELINE, { ...base, deploys: deploys() })).toBe(true);
    expect(isDutySatisfied(DUTY.MONDAY_PIPELINE, { ...base, deploys: deploys({ failed: 1 }) })).toBe(false);
    expect(isDutySatisfied(DUTY.MONDAY_PIPELINE, { ...base, deploys: deploys({ deferred: 2 }) })).toBe(false);
    expect(isDutySatisfied(DUTY.MONDAY_PIPELINE, { ...base, deploys: deploys(), deferredToNextTick: 1 })).toBe(false);
  });

  it('Friday: banking-pending blocks the marker', () => {
    const base = { groups: 2, bankingPending: 0, gamesLocked: 2, roundsLocked: [], composedGroups: [], champion: null, errors: 0, deferredToNextTick: 0 };
    expect(isDutySatisfied(DUTY.FRIDAY_ADVANCEMENT, base)).toBe(true);
    expect(isDutySatisfied(DUTY.FRIDAY_ADVANCEMENT, { ...base, bankingPending: 1 })).toBe(false);
  });
});

// ==================== COOLDOWN (dormant until P4, tested now) ====================

describe('failure cooldown — ≥10 min, consumed even on failure', () => {
  it('the constant prices the ruling', () => {
    expect(DEPLOY_FAILURE_COOLDOWN_MS).toBe(10 * 60 * 1000);
  });
});

// ==================== TRAINING ACTIVATION (Slice 3) ====================

describe('sweepTrainingActivation (Slice 3)', () => {
  function trainingPodDocs(id, { status = GROUP_STATUS.BATTLE, withStream = false } = {}) {
    const docs = {
      [`tournamentGroups/${id}`]: {
        status, isTraining: true, roundNumber: 1, baseLayerWeek: '2026-W25',
        groupMembers: ['u1', 'cpu-1', 'cpu-2', 'cpu-3'],
        players: [
          { odUserId: 'u1', isCpu: false, picks: [] },
          { odUserId: 'cpu-1', isCpu: true, picks: [] },
          { odUserId: 'cpu-2', isCpu: true, picks: [] },
          { odUserId: 'cpu-3', isCpu: true, picks: [] },
        ],
        userPool: [...SYMBOLS],
      },
    };
    if (withStream) docs[`tournamentGroups/${id}/streams/agentDraft`] = { picksByAgent: {}, events: [] };
    return docs;
  }

  it('the sweep processes only training BATTLE pods (ranked + non-battle ignored)', async () => {
    const { db } = makeDb({
      ...trainingPodDocs('t-streamed', { withStream: true }),
      [`agents/${trainingCloneDocId('t-streamed', 'u1')}`]: { ownerId: 'u1', isTrainingClone: true, archetype: 'analyst' },
      // ranked BATTLE pod — must be ignored (not isTraining)
      'tournamentGroups/ranked-1': {
        status: GROUP_STATUS.BATTLE,
        groupMembers: [...CPU_IDS],
        players: CPU_IDS.map(o => ({ odUserId: o, isCpu: true })),
      },
      // training AWAITING_OPEN pod — not BATTLE, ignored
      ...trainingPodDocs('t-awaiting', { status: GROUP_STATUS.AWAITING_OPEN }),
    });
    const summary = await sweepTrainingActivation(db, { now: MON_MORNING_EDT, deployEnabled: false });
    expect(summary.swept).toBe(1);     // only t-streamed (BATTLE + isTraining)
    expect(summary.activated).toBe(1); // processed (stream exists → no re-draft, no seats → no-op)
    expect(summary.errors).toBe(0);
    expect(summary.deferred).toBe(0);
  });

  it('DAILY REDEPLOY: an already-drafted pod does NOT re-draft and redeploys the incumbents every day', async () => {
    const cloneId = trainingCloneDocId('t-day2', 'u1');
    const { db } = makeDb({
      ...trainingPodDocs('t-day2', { withStream: true }),
      [`agents/${cloneId}`]: { ownerId: 'u1', isTrainingClone: true, archetype: 'analyst' },
      // the clone's day-1 incumbent battle (created a PRIOR trading day, so the
      // today's-battle guard does NOT skip — a fresh day-N deploy is due).
      'agentBattles/b-clone-day1': {
        agentId: cloneId, ownerId: 'u1', groupId: 't-day2', gameMode: TOURNAMENT_GAME_MODE,
        status: 'completed', createdAt: '2026-06-12T14:00:00.000Z',
        portfolio: {
          star: [{ symbol: 'NVDA' }, { symbol: 'AMD' }],
          core: [{ symbol: 'TSLA' }, { symbol: 'META' }],
          support: [{ symbol: 'AAPL' }, { symbol: 'MSFT' }],
        },
      },
    });
    const group = { id: 't-day2', ...(await db.collection('tournamentGroups').doc('t-day2').get()).data() };
    const res = await activateTrainingPod(db, group, { now: MON_MORNING_EDT, anthropic: null, deployEnabled: false });
    expect(res.drafted).toBe(false);                       // stream existed → NO re-draft (the bug's fix)
    expect(res.deploys.gated).toBeGreaterThanOrEqual(1);   // reached fan-out → would redeploy the incumbent six
    expect(res.errors).toBe(0);
  });

  it('LOADOUT OVERRIDE (Slice 5b-ii): the group carrier drives the provisioned clone, not the ranked loadout', async () => {
    const cloneId = trainingCloneDocId('t-override', 'u1');
    const { db } = makeDb({
      // withStream → step 2 (draft) short-circuits, isolating step 1 (clone provisioning).
      ...trainingPodDocs('t-override', { withStream: true }),
      // u1's RANKED agent: archetype 'analyst' + an equipped watchlist. The clone
      // must come out 'guardian' with NO watchlist (the override), proving the
      // formation→activation carrier is threaded into ensureTrainingClones.
      'agents/ranked-u1': {
        ownerId: 'u1', isTrainingClone: false, archetype: 'analyst',
        equippedWatchlistId: 'wl-ranked', equippedWatchlistName: 'Ranked WL',
      },
    });
    const groupSnap = await db.collection('tournamentGroups').doc('t-override').get();
    // The carrier the formation persist writes (trainingLifecycle.js FORMING→DRAFTING tx).
    const group = {
      id: 't-override', ...groupSnap.data(),
      loadoutSpecByUser: { u1: { archetype: 'guardian', equippedWatchlistId: null, equippedWatchlistName: null } },
    };
    const res = await activateTrainingPod(db, group, { now: MON_MORNING_EDT, anthropic: null, deployEnabled: false });
    expect(res.clones.created).toBe(1);
    const clone = (await db.collection('agents').doc(cloneId).get()).data();
    expect(clone.archetype).toBe('guardian');     // overridden (ranked was 'analyst')
    expect(clone.equippedWatchlistId).toBeNull();  // overridden to "no watchlist"
    expect(clone.equippedWatchlistName).toBeNull();
    expect(clone.isTrainingClone).toBe(true);
    expect(clone.rankedAgentId).toBe('ranked-u1');
  });

  it('first-time activation: a stream-MISSING pod drafts (fails fast here without stockRankings)', async () => {
    const { db } = makeDb({ ...trainingPodDocs('t-fresh') });
    const summary = await sweepTrainingActivation(db, { now: MON_MORNING_EDT, anthropic: null, deployEnabled: false });
    expect(summary.swept).toBe(1);
    expect(summary.errors).toBeGreaterThanOrEqual(1); // produceGroupBoards has no stockRankings
  });
});
