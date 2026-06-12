// api/_utils/tournamentOrchestrator.test.js
//
// P3b battery for the orchestrator (Ruling A verbatim). Blocks: the ET-aware
// dispatcher under BOTH DST arms, the two-grain idempotency (per-duty/
// per-ET-date markers + natural guards), the deploy plumbing (credentials +
// ownership assertion on every call; the P4 gate sending NOTHING and logging
// loudly), the Monday pipeline end-to-end on an all-CPU group (no model
// call anywhere — Ruling B1's deterministic path), finding-#5 deferral,
// the synthetic refusal (the P3a contract), the incumbent fan-out via the
// fenced flattenPortfolioServer, and zero-group production inertness (the
// cron is live at merge — this lock IS the safety case).
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): this file's real import of
// tournamentOrchestrator.js IS the runtime guard that its transitive import
// surface (src/constants/leagueTournament.js via every pipeline step) stays
// Node-clean. Never mock that import.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  DUTY,
  TOURNAMENT_DEPLOY_ENABLED,
  DEPLOY_FAILURE_COOLDOWN_MS,
  getDutyForInstant,
  dutyMarkerKey,
  isDutyComplete,
  markDutyComplete,
  readOrchestratorState,
  deployBaseUrl,
  buildDeployRequest,
  latestTournamentBattlesByAgent,
  fanOutDeploys,
  runMondayPipeline,
  runWeekdayFanout,
  isDutySatisfied,
  runOrchestratorTick,
} from './tournamentOrchestrator.js';
import {
  GROUP_STATUS,
  AGENT_MARKET_SIZE,
  TOURNAMENT_GAME_MODE,
  cpuAgentDocId,
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
  it('marks, reads back, and prunes beyond the retention window', async () => {
    const { db, store } = makeDb();
    const stale = dutyMarkerKey('2026-05-01', DUTY.WEEKDAY_FANOUT);
    store.set('tournamentOrchestrator/state', { duties: { [stale]: { completedAt: 'old' } }, deployCooldowns: {} });

    let state = await readOrchestratorState(db);
    expect(isDutyComplete(state, '2026-06-15', DUTY.MONDAY_PIPELINE)).toBe(false);

    await markDutyComplete(db, state, '2026-06-15', DUTY.MONDAY_PIPELINE, { groups: 1 }, '2026-06-15T12:00:00Z');
    state = await readOrchestratorState(db);
    expect(isDutyComplete(state, '2026-06-15', DUTY.MONDAY_PIPELINE)).toBe(true);
    expect(state.duties[stale]).toBeUndefined(); // pruned (> 14 days old)
  });
});

// ==================== DEPLOY PLUMBING ====================

describe('deploy plumbing — credentials + ownership assertion from day one', () => {
  it('the gate is CLOSED at P3b (P4 flips it inside the fence-entry PR)', () => {
    expect(TOURNAMENT_DEPLOY_ENABLED).toBe(false);
  });

  it('base URL: VERCEL_PROJECT_PRODUCTION_URL with env-var override', () => {
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', 'tradeseven.vercel.app');
    expect(deployBaseUrl()).toBe('https://tradeseven.vercel.app');
    vi.stubEnv('TOURNAMENT_DEPLOY_BASE_URL', 'https://override.example');
    expect(deployBaseUrl()).toBe('https://override.example');
  });

  it('every call carries Bearer CRON_SECRET, the ownership assertion, gameMode, the prescribed six, and the CPU marker', () => {
    vi.stubEnv('CRON_SECRET', 's3cret');
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', 'tradeseven.vercel.app');
    const request = buildDeployRequest({
      agentId: 'agent-1', odUserId: 'user-1', isCpu: true, groupId: 'g1', symbols: ['NVDA', 'AMD'],
    });
    expect(request.url).toBe('https://tradeseven.vercel.app/api/agent/decide');
    expect(request.headers.Authorization).toBe('Bearer s3cret');
    expect(request.body).toEqual({
      agentId: 'agent-1',
      ownerOdUserId: 'user-1',
      groupId: 'g1',
      gameMode: TOURNAMENT_GAME_MODE,
      prescribedPortfolio: ['NVDA', 'AMD'],
      isCpu: true,
    });
    expect(buildDeployRequest({ agentId: 'a', odUserId: 'u', groupId: 'g', symbols: [] }).body).not.toHaveProperty('isCpu');
  });

  it('GATED: nothing is fetched, every seat logs a loud "P4 pending" line, no pacing burned', async () => {
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

// ==================== MONDAY PIPELINE ====================

describe('runMondayPipeline — the full Monday arc on an all-CPU group (no model call)', () => {
  it('resolves the user draft, produces CPU boards, drafts 24 held, gates 4 deploys', async () => {
    const { db, store } = mondayDb();
    const summary = await runMondayPipeline(db, { now: MON_MORNING_EDT, anthropic: null });

    expect(summary).toMatchObject({
      groups: 1, resolved: 1, deferredBoards: 0, refusedSynthetic: 0, drafted: 1, errors: 0,
    });
    expect(summary.deploys.gated).toBe(4);
    expect(summary.deploys.deployed).toBe(0);

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

  it('re-run resumes idempotently: nothing re-resolves, deploys re-gate', async () => {
    const { db } = mondayDb();
    await runMondayPipeline(db, { now: MON_MORNING_EDT, anthropic: null });
    const second = await runMondayPipeline(db, { now: MON_MORNING_EDT, anthropic: null });
    expect(second).toMatchObject({ groups: 1, resolved: 0, drafted: 1, errors: 0 });
    expect(second.deploys.gated).toBe(4); // natural guards skip everything durable
  });

  it('FINDING #5: a missing committed board defers the group with a loud log', async () => {
    const { db, store } = mondayDb();
    store.delete('tournamentGroups/b-r1-g2/boards/cpu-7');
    const errorSpy = console.error;
    const summary = await runMondayPipeline(db, { now: MON_MORNING_EDT, anthropic: null });
    expect(summary.deferredBoards).toBe(1);
    expect(summary.drafted).toBe(0);
    expect(store.get('tournamentGroups/b-r1-g2').status).toBe(GROUP_STATUS.FORMING);
    expect(errorSpy.mock.calls.map(c => c.join(' ')).some(l => l.includes('USER BOARDS NOT COMMITTED'))).toBe(true);
    expect(isDutySatisfied(DUTY.MONDAY_PIPELINE, summary)).toBe(false); // no marker → next tick retries
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

  it('pre-P4 steady state: no battles → one quiet line per group, satisfied (marker-worthy)', async () => {
    const { db, writeLog } = battleDb({ withBattle: false });
    const summary = await runWeekdayFanout(db, { now: TUE });
    expect(summary).toMatchObject({ groups: 1, noBattles: 1, errors: 0 });
    expect(isDutySatisfied(DUTY.WEEKDAY_FANOUT, summary)).toBe(true);
    expect(writeLog).toHaveLength(0);
  });

  it("an incumbent battle's six flatten into a gated deploy seat", async () => {
    const { db } = battleDb();
    const summary = await runWeekdayFanout(db, { now: TUE });
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
    const first = await runOrchestratorTick(db, { now: MON_MORNING_EDT });
    expect(first.complete).toBe(true);
    expect(store.get('tournamentOrchestrator/state').duties[dutyMarkerKey('2026-06-15', DUTY.MONDAY_PIPELINE)]).toBeDefined();

    const second = await runOrchestratorTick(db, { now: new Date('2026-06-15T12:10:00Z') });
    expect(second.status).toBe('already_complete');
  });

  it('forceDuty + injected clock are the dev time controls (run Monday on any instant)', async () => {
    const { db } = mondayDb();
    const result = await runOrchestratorTick(db, {
      now: new Date('2026-06-18T15:00:00Z'), // a Thursday
      forceDuty: DUTY.MONDAY_PIPELINE,
    });
    expect(result.duty).toBe(DUTY.MONDAY_PIPELINE);
    expect(result.complete).toBe(true);
  });

  it('an unsatisfied duty (finding-#5 deferral) sets NO marker — the next tick retries', async () => {
    const { db, store } = mondayDb();
    store.delete('tournamentGroups/b-r1-g2/boards/cpu-7');
    const result = await runOrchestratorTick(db, { now: MON_MORNING_EDT });
    expect(result.complete).toBe(false);
    expect(store.get('tournamentOrchestrator/state')).toBeUndefined();
  });
});

// ==================== DUTY SATISFACTION ====================

describe('isDutySatisfied — what earns the marker', () => {
  it('gated deploys count as done (the ruled pre-P4 posture); failures and deferrals do not', () => {
    const base = { groups: 1, resolved: 1, deferredBoards: 0, refusedSynthetic: 0, drafted: 1, deferredToNextTick: 0, errors: 0 };
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
