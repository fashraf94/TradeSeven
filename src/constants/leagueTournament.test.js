// src/constants/leagueTournament.test.js
//
// P0 scaffold guards for the tournamentGroups schema module.
//
// Two invariants are load-bearing:
// 1. claimSystem shape parity with the legacy snake-draft system — the
//    tournament claims branch (P1) reuses the legacy cron's idempotency guard
//    unchanged, so the initial shape must satisfy the same contract. The
//    parity check imports the REAL isAlreadyProcessedForDay from the claims
//    cron (non-fenced). Never mock that import — the import is the contract.
// 2. The schema module's zero-import surface — future api/ consumers (claims
//    branch, orchestrator) import this module under the revised June 2026
//    import rule, which requires Node-clean transitive imports. Zero imports
//    makes the consumer-side dependency-surface guard (lands with the first
//    api/ consumer in P1) satisfiable by construction.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  TOURNAMENT_GROUPS_COLLECTION,
  TOURNAMENT_GAME_MODE,
  GROUP_SIZE,
  PICKS_PER_PLAYER,
  USER_HELD_NAMES_PER_GROUP,
  AGENT_PICKS_PER_AGENT,
  AGENT_MARKET_SIZE,
  GROUP_STATUS,
  LEG_DIRECTION,
  BASELINE_SOURCE,
  LEDGER_SOURCE,
  TOURNAMENT_TUNING,
  AGENT_LEDGER_SUBCOLLECTION,
  AGENT_LEDGER_DOC_ID,
  createClaimSystemState,
  createLeg,
  createPickState,
  createAgentLedgerEntry,
  createAgentLedgerDoc,
  createTournamentGroupDoc,
  getLatestDayEntry,
  getWeeklyScore,
  deriveCurrentTradingDay,
  // P3b — bracket + CPU (ratified June 12, 2026)
  BRACKET_STATUS,
  bracketRoundKey,
  buildBracketGameId,
  parseBracketGameId,
  createBracketGame,
  createBracketRound,
  createBracketDoc,
  CPU_ARCHETYPE_ORDER,
  cpuUserId,
  cpuNFromUserId,
  cpuAgentDocId,
  isCpuUserId,
  cpuArchetypeForN,
  buildCpuUserBoard,
  // P6a — composite + leaderboard/rank identity (founder rulings A-1..A-4,
  // B-1/B-2 signed, June 12, 2026)
  computeComposite,
  getWeeklyComposite,
  WEEK_DAYS_REQUIRED,
  isWeekBanked,
  monthKeyFromEtDate,
  leaderboardDocId,
  rankDocId,
  TOURNAMENT_LEADERBOARDS_COLLECTION,
  TOURNAMENT_RANKS_COLLECTION,
  RANK_TIERS,
  RANK_TUNING,
  tierForRp,
  cpuFarmGuard,
  computeRankDelta,
  computeRankBreakdown,
  applyRankWeek,
  applyRankWeekFrozen,
  isFinalSnapshotDegraded,
  rankByScores,
  shiftMonthKey,
  rankProgress,
  round2,
  // P7 — the shared "current battle for an owner" selection (one home for the
  // participant hook + the spectator endpoint).
  pickCurrentTournamentBattle,
  // P10 — self-serve lobby + the relocated isoWeekString.
  TOURNAMENT_LOBBY_COLLECTION,
  LOBBY_STATUS,
  LOBBY_MODE,
  LOBBY_MAX_HUMANS,
  LOBBY_DISPLAY_NAME_MAX,
  createLobbyMember,
  createLobbyDoc,
  lobbyHumanIds,
  lobbyOpenSeatCount,
  lobbyHasMember,
  selectActiveLobby,
  isoWeekString,
} from './leagueTournament.js';
// Real import, zero mocks (precedent: api/cron/process-draft-claims.test.js:10).
// This is the behavioral half of the claimSystem parity guard.
import { isAlreadyProcessedForDay } from '../../api/cron/process-draft-claims.js';
// Real import (non-fenced): the CPU_ARCHETYPE_ORDER ↔ live-registry parity
// lock — the schema module is zero-import, so its archetype names are string
// literals; THIS test is what keeps them honest.
import { ARCHETYPE_WEIGHTS } from '../../api/_utils/archetypeScoring.js';

// ==================== FIXTURES ====================

const NOW = '2026-06-15T13:30:00.000Z';

function makePlayers() {
  return [
    { odUserId: 'user-a', picks: [] },
    { odUserId: 'user-b', picks: [] },
    { odUserId: 'user-c', picks: [] },
    { odUserId: 'user-d', picks: [] },
  ];
}

function makeGroupArgs(overrides = {}) {
  return {
    players: makePlayers(),
    userPool: ['NVDA', 'AMD', 'TSLA'],
    roundNumber: 1,
    baseLayerWeek: '2026-W25',
    now: NOW,
    ...overrides,
  };
}

// ==================== IDENTITY + TUNING ====================

describe('identity constants', () => {
  it('collection name and game-mode discriminator', () => {
    expect(TOURNAMENT_GROUPS_COLLECTION).toBe('tournamentGroups');
    expect(TOURNAMENT_GAME_MODE).toBe('baggerbomb_tournament');
  });

  it('group shape arithmetic (Spec §0.9)', () => {
    expect(GROUP_SIZE).toBe(4);
    expect(PICKS_PER_PLAYER).toBe(3);
    expect(USER_HELD_NAMES_PER_GROUP).toBe(12);
    expect(AGENT_PICKS_PER_AGENT).toBe(6);
    expect(AGENT_MARKET_SIZE).toBe(24);
  });
});

describe('tuning ledger (Spec §5 founder-set values)', () => {
  it('exact initial values', () => {
    expect(TOURNAMENT_TUNING).toEqual({
      USER_LAYER_K: 1.5,
      FLIP_CAP_PER_DAY: 5,
      CLAIM_PENDING_CAP_PER_CYCLE: 3,
      BOARD_DEPTH_MIN: 15,
      BOARD_DEPTH_MAX: 20,
      PLAYBACK_MS_PER_PICK: 5000,
    });
  });

  it('tuning object and enums are frozen', () => {
    expect(Object.isFrozen(TOURNAMENT_TUNING)).toBe(true);
    expect(Object.isFrozen(GROUP_STATUS)).toBe(true);
    expect(Object.isFrozen(LEG_DIRECTION)).toBe(true);
    expect(Object.isFrozen(BASELINE_SOURCE)).toBe(true);
    expect(Object.isFrozen(LEDGER_SOURCE)).toBe(true);
  });
});

describe('baselineSource vocabulary (ratified June 11, 2026 — P1 docket #3)', () => {
  it('exact ratified values', () => {
    expect(BASELINE_SOURCE).toEqual({
      DRAFT_RESOLUTION: 'draft_resolution',
      CLAIM_EXECUTION: 'claim_execution',
      FLIP_MARKET_OPEN: 'flip_market_open',
      FLIP_MARKET_CLOSED: 'flip_market_closed',
    });
  });
});

// ==================== CLAIMSYSTEM PARITY (load-bearing) ====================

describe('claimSystem parity with the legacy snake-draft shape', () => {
  it('matches the legacy initializers verbatim (draftService.js:534-538, snake-draft-autopick.js:323-327)', () => {
    expect(createClaimSystemState()).toEqual({
      enabled: true,
      currentWaiverPriority: [],
      processingLog: [],
    });
    expect(Object.keys(createClaimSystemState()).sort()).toEqual([
      'currentWaiverPriority',
      'enabled',
      'processingLog',
    ]);
  });

  it('lastProcessedDay is absent until first processing (legacy contract)', () => {
    expect('lastProcessedDay' in createClaimSystemState()).toBe(false);
  });

  it('fresh state never blocks processing — real cron guard, any trading day', () => {
    const state = createClaimSystemState();
    for (let day = 0; day <= 5; day++) {
      expect(isAlreadyProcessedForDay(state, day)).toBe(false);
    }
  });

  it('processed state blocks exactly the processed day', () => {
    const state = { ...createClaimSystemState(), lastProcessedDay: 2 };
    expect(isAlreadyProcessedForDay(state, 2)).toBe(true);
    for (const day of [0, 1, 3, 4, 5]) {
      expect(isAlreadyProcessedForDay(state, day)).toBe(false);
    }
  });

  it('day-0 carve-out holds (battle not started — never skipped on equality)', () => {
    const state = { ...createClaimSystemState(), lastProcessedDay: 0 };
    expect(isAlreadyProcessedForDay(state, 0)).toBe(false);
  });
});

// ==================== LEG / PICK FACTORIES ====================

describe('createLeg', () => {
  const args = { baselinePrice: 187.5, baselineSource: BASELINE_SOURCE.FLIP_MARKET_OPEN, openedAt: NOW };

  it('defaults long, fresh thresholdHistory, closed-state keys omitted', () => {
    const leg = createLeg(args);
    expect(leg).toEqual({
      direction: 'long',
      baselinePrice: 187.5,
      baselineSource: 'flip_market_open',
      openedAt: NOW,
      thresholdHistory: [],
    });
    expect('closedAt' in leg).toBe(false);
    expect('bankedScore' in leg).toBe(false);
  });

  it('accepts short; null baselinePrice (market-closed open) is valid', () => {
    expect(createLeg({ ...args, direction: LEG_DIRECTION.SHORT }).direction).toBe('short');
    expect(createLeg({
      ...args, baselinePrice: null, baselineSource: BASELINE_SOURCE.DRAFT_RESOLUTION,
    }).baselinePrice).toBeNull();
  });

  it('rejects invalid shapes', () => {
    expect(() => createLeg({ ...args, direction: 'sideways' })).toThrow(/direction/);
    expect(() => createLeg({ ...args, baselineSource: '' })).toThrow(/baselineSource/);
    expect(() => createLeg({ ...args, openedAt: undefined })).toThrow(/openedAt/);
    expect(() => createLeg({ ...args, baselinePrice: 'NaN-ish' })).toThrow(/baselinePrice/);
  });

  it('rejects free-form sources — the P0 string era is closed (vocabulary ratified)', () => {
    expect(() => createLeg({ ...args, baselineSource: 'market_open' })).toThrow(/baselineSource/);
    expect(() => createLeg({ ...args, baselineSource: 'DRAFT_RESOLUTION' })).toThrow(/baselineSource/);
  });
});

describe('createPickState', () => {
  const args = { symbol: 'nvda', baselineSource: BASELINE_SOURCE.DRAFT_RESOLUTION, baselinePrice: 187.5, openedAt: NOW };

  it('uppercases the symbol, opens one leg, zero flips', () => {
    const pick = createPickState(args);
    expect(pick.symbol).toBe('NVDA');
    expect(pick.legs).toHaveLength(1);
    expect(pick.flipCountToday).toBe(0);
  });

  it('rejects a missing symbol', () => {
    expect(() => createPickState({ ...args, symbol: '  ' })).toThrow(/symbol/);
  });
});

describe('createAgentLedgerEntry', () => {
  it('builds the Spec §1.2 entry shape', () => {
    expect(createAgentLedgerEntry({ heldBy: 'agent-1', since: NOW, source: LEDGER_SOURCE.DRAFT }))
      .toEqual({ heldBy: 'agent-1', since: NOW, source: 'draft' });
  });

  it('rejects invalid provenance', () => {
    expect(() => createAgentLedgerEntry({ heldBy: 'agent-1', since: NOW, source: 'trade' })).toThrow(/source/);
    expect(() => createAgentLedgerEntry({ heldBy: '', since: NOW, source: 'swap' })).toThrow(/heldBy/);
    expect(() => createAgentLedgerEntry({ heldBy: 'agent-1', source: 'swap' })).toThrow(/since/);
  });
});

describe('createAgentLedgerDoc (P2 — sibling-doc ruling)', () => {
  it('builds the empty sibling-doc shape', () => {
    expect(createAgentLedgerDoc({ now: NOW })).toEqual({
      held: {},
      reservations: {},
      doubleDowns: [],
      updatedAt: NOW,
    });
  });

  it('requires the opaque caller-supplied timestamp', () => {
    expect(() => createAgentLedgerDoc()).toThrow(/now/);
    expect(() => createAgentLedgerDoc({})).toThrow(/now/);
  });

  it('the sibling path constants are the ratified values', () => {
    expect(AGENT_LEDGER_SUBCOLLECTION).toBe('ledger');
    expect(AGENT_LEDGER_DOC_ID).toBe('agentHeldSet');
  });
});

// ==================== GROUP DOC FACTORY ====================

describe('createTournamentGroupDoc', () => {
  it('builds the Spec §1.1 shape', () => {
    const doc = createTournamentGroupDoc(makeGroupArgs());
    expect(doc).toEqual({
      status: 'forming',
      roundNumber: 1,
      baseLayerWeek: '2026-W25',
      groupMembers: ['user-a', 'user-b', 'user-c', 'user-d'],
      players: makePlayers(),
      userPool: ['NVDA', 'AMD', 'TSLA'],
      claimSystem: { enabled: true, currentWaiverPriority: [], processingLog: [] },
      dailyScores: {},
      createdAt: NOW,
      updatedAt: NOW,
    });
  });

  it('carries NO agentLedger field — the held-set ledger is the sibling doc (P2 ruling)', () => {
    const doc = createTournamentGroupDoc(makeGroupArgs());
    expect('agentLedger' in doc).toBe(false);
  });

  it('players carry exactly {odUserId, picks} — no category system, by construction', () => {
    const doc = createTournamentGroupDoc(makeGroupArgs());
    for (const player of doc.players) {
      expect(Object.keys(player).sort()).toEqual(['odUserId', 'picks']);
    }
    expect(JSON.stringify(doc)).not.toMatch(/categor/i);
  });

  it('XOR on round identity: the unpopulated key is absent', () => {
    const base = createTournamentGroupDoc(makeGroupArgs());
    expect('bracketGameId' in base).toBe(false);

    const bracket = createTournamentGroupDoc(makeGroupArgs({ baseLayerWeek: null, bracketGameId: 'bracket-r2-g7' }));
    expect(bracket.bracketGameId).toBe('bracket-r2-g7');
    expect('baseLayerWeek' in bracket).toBe(false);

    expect(() => createTournamentGroupDoc(makeGroupArgs({ bracketGameId: 'x' }))).toThrow(/exactly one/);
    expect(() => createTournamentGroupDoc(makeGroupArgs({ baseLayerWeek: null }))).toThrow(/exactly one/);
  });

  it('shape guards throw', () => {
    expect(() => createTournamentGroupDoc(makeGroupArgs({ players: makePlayers().slice(0, 3) }))).toThrow(/exactly 4/);
    expect(() => createTournamentGroupDoc(makeGroupArgs({
      players: [...makePlayers().slice(0, 3), { odUserId: 'user-a', picks: [] }],
    }))).toThrow(/unique/);
    expect(() => createTournamentGroupDoc(makeGroupArgs({
      players: makePlayers().map((p, i) => (i === 0 ? { ...p, picks: ['A', 'B', 'C', 'D'] } : p)),
    }))).toThrow(/at most 3/);
    expect(() => createTournamentGroupDoc(makeGroupArgs({ roundNumber: 0 }))).toThrow(/roundNumber/);
    expect(() => createTournamentGroupDoc(makeGroupArgs({ status: 'paused' }))).toThrow(/status/);
    expect(() => createTournamentGroupDoc(makeGroupArgs({ now: undefined }))).toThrow(/now/);
    expect(() => createTournamentGroupDoc(makeGroupArgs({ userPool: 'NVDA' }))).toThrow(/userPool/);
  });

  it('is deterministic and pure: frozen inputs accepted, outputs are fresh', () => {
    const players = makePlayers();
    players.forEach(p => Object.freeze(p.picks) && Object.freeze(p));
    Object.freeze(players);
    const userPool = Object.freeze(['NVDA', 'AMD', 'TSLA']);

    const a = createTournamentGroupDoc(makeGroupArgs({ players, userPool }));
    const b = createTournamentGroupDoc(makeGroupArgs({ players, userPool }));
    expect(a).toEqual(b);
    expect(a.userPool).not.toBe(userPool);
    expect(a.players[0]).not.toBe(players[0]);
    expect(a.players[0].picks).not.toBe(players[0].picks);
  });
});

// ==================== ZERO-IMPORT SURFACE GUARD ====================

describe('schema module dependency surface', () => {
  const moduleSource = readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), 'leagueTournament.js'),
    'utf8'
  );

  it('has zero imports — keeps the future api/ consumer guard satisfiable by construction', () => {
    expect(moduleSource).not.toMatch(/^\s*import[\s{]/m);
    expect(moduleSource).not.toMatch(/\brequire\s*\(/);
  });
});

// ==================== DAILY-SCORES READ HELPERS (P1b) ====================

describe('getLatestDayEntry', () => {
  it('returns the highest day{N} entry; null before the first banking', () => {
    const group = {
      dailyScores: {
        day1: { closeScores: {}, recordedDate: '2026-06-08' },
        day2: { closeScores: {}, recordedDate: '2026-06-09' },
        dayDecoy: { closeScores: {} }, // non-matching keys are ignored
      },
    };
    expect(getLatestDayEntry(group)).toEqual({ dayN: 2, entry: group.dailyScores.day2 });
    expect(getLatestDayEntry({ dailyScores: {} })).toBeNull();
    expect(getLatestDayEntry(null)).toBeNull();
  });
});

describe('getWeeklyScore — the FINAL snapshot, never a sum (founder ruling #1)', () => {
  const group = {
    dailyScores: {
      day1: { closeScores: { 'user-a': { totalPoints: 10, picks: [] } } },
      day2: { closeScores: { 'user-a': { totalPoints: 25, picks: [] } } },
    },
  };

  it('reads the final day snapshot — 25, where a sum over days would say 35', () => {
    expect(getWeeklyScore(group, 'user-a')).toBe(25);
    const wrongSum = Object.values(group.dailyScores)
      .reduce((sum, day) => sum + day.closeScores['user-a'].totalPoints, 0);
    expect(wrongSum).toBe(35); // the model this ruling supersedes
    expect(getWeeklyScore(group, 'user-a')).not.toBe(wrongSum);
  });

  it('0 for unknown players and unbanked groups', () => {
    expect(getWeeklyScore(group, 'user-z')).toBe(0);
    expect(getWeeklyScore({ dailyScores: {} }, 'user-a')).toBe(0);
  });
});

describe('deriveCurrentTradingDay — banking-derived day clock', () => {
  const TODAY = '2026-06-10';

  it('day 1 before any banking', () => {
    expect(deriveCurrentTradingDay({ dailyScores: {} }, TODAY)).toBe(1);
  });

  it('today IS day N when day N was banked today (evening, post-banking)', () => {
    const group = { dailyScores: { day2: { closeScores: {}, recordedDate: TODAY } } };
    expect(deriveCurrentTradingDay(group, TODAY)).toBe(2);
  });

  it('today is day N+1 when the latest banking was a prior date (morning / pre-banking)', () => {
    const group = { dailyScores: { day2: { closeScores: {}, recordedDate: '2026-06-09' } } };
    expect(deriveCurrentTradingDay(group, TODAY)).toBe(3);
  });
});

// ==================== P3b — BRACKET + CPU (ratified June 12, 2026) ====================

describe('bracketGameId helpers', () => {
  it('round-trips build → parse', () => {
    const id = buildBracketGameId('jun-2026', 2, 3);
    expect(id).toBe('jun-2026-r2-g3');
    expect(parseBracketGameId(id)).toEqual({ bracketId: 'jun-2026', roundNumber: 2, gameIndex: 3 });
  });

  it('parse survives dashes inside the bracketId and rejects junk', () => {
    expect(parseBracketGameId('dev-bracket-abc-r1-g2').bracketId).toBe('dev-bracket-abc');
    expect(parseBracketGameId('not-a-game-id')).toBeNull();
    expect(parseBracketGameId(null)).toBeNull();
  });
});

describe('createBracketGame / createBracketRound', () => {
  const seats = [
    { odUserId: 'u1' }, { odUserId: 'u2' },
    { odUserId: 'cpu-1', isCpu: true }, { odUserId: 'cpu-2', isCpu: true },
  ];

  it('normalizes seats to {odUserId, isCpu} and nulls the lock fields', () => {
    const game = createBracketGame({ bracketGameId: 'b-r1-g1', gameIndex: 1, groupId: 'b-r1-g1', seats });
    expect(game.seats).toEqual([
      { odUserId: 'u1', isCpu: false }, { odUserId: 'u2', isCpu: false },
      { odUserId: 'cpu-1', isCpu: true }, { odUserId: 'cpu-2', isCpu: true },
    ]);
    expect(game.finalScores).toBeNull();
    expect(game.advancers).toBeNull();
    expect(game.completedAt).toBeNull();
  });

  it('rejects a non-4 seat count', () => {
    expect(() => createBracketGame({ bracketGameId: 'x', gameIndex: 1, groupId: 'x', seats: seats.slice(0, 3) }))
      .toThrow(/exactly 4/);
  });

  it('round entry carries roundNumber + lockedAt null', () => {
    const game = createBracketGame({ bracketGameId: 'b-r1-g1', gameIndex: 1, groupId: 'b-r1-g1', seats });
    const round = createBracketRound({ roundNumber: 1, games: { 'b-r1-g1': game }, composedAt: 'T0' });
    expect(round.roundNumber).toBe(1);
    expect(round.lockedAt).toBeNull();
  });
});

describe('createBracketDoc', () => {
  const seats = [
    { odUserId: 'u1' }, { odUserId: 'u2' },
    { odUserId: 'cpu-1', isCpu: true }, { odUserId: 'cpu-2', isCpu: true },
  ];
  const game = (i) => createBracketGame({ bracketGameId: `b-r1-g${i}`, gameIndex: i, groupId: `b-r1-g${i}`, seats });

  it('derives totalRounds/slots from the round-1 game count (16-slot skeleton: 4 games → 3 rounds)', () => {
    const doc4 = createBracketDoc({ bracketId: 'b', round1Games: { g1: game(1), g2: game(2), g3: game(3), g4: game(4) }, now: 'T0' });
    expect(doc4.totalRounds).toBe(3);
    expect(doc4.slots).toBe(16);
    const doc2 = createBracketDoc({ bracketId: 'b', round1Games: { g1: game(1), g2: game(2) }, now: 'T0' });
    expect(doc2.totalRounds).toBe(2);
    expect(doc2.currentRound).toBe(1);
    expect(doc2.status).toBe(BRACKET_STATUS.ACTIVE);
    expect(doc2.champion).toBeNull();
    expect(doc2.recap).toBeNull();
    expect(Object.keys(doc2.rounds)).toEqual([bracketRoundKey(1)]);
  });

  it('rejects a non-power-of-two game count', () => {
    expect(() => createBracketDoc({ bracketId: 'b', round1Games: { g1: game(1), g2: game(2), g3: game(3) }, now: 'T0' }))
      .toThrow(/power of two/);
  });
});

describe('CPU identity helpers (Ruling B1)', () => {
  it('cpuUserId / cpuAgentDocId / isCpuUserId are deterministic and prefix-consistent', () => {
    expect(cpuUserId(3)).toBe('cpu-3');
    expect(cpuAgentDocId(3)).toBe('cpu-agent-3');
    expect(isCpuUserId('cpu-3')).toBe(true);
    expect(isCpuUserId('user-3')).toBe(false);
    expect(() => cpuUserId(0)).toThrow();
  });

  it('cpuNFromUserId is the exact inverse of cpuUserId and rejects every drift shape', () => {
    expect(cpuNFromUserId(cpuUserId(7))).toBe(7);
    expect(cpuNFromUserId('cpu-12')).toBe(12);
    expect(cpuNFromUserId('user-3')).toBeNull();
    expect(cpuNFromUserId('cpu-')).toBeNull();
    expect(cpuNFromUserId('cpu-01')).toBeNull();  // zero-padded = not our codec
    expect(cpuNFromUserId('cpu-1x')).toBeNull();
    expect(cpuNFromUserId(null)).toBeNull();
  });

  it('archetype round-robin: 4 consecutive CPUs field 4 distinct archetypes, reproducibly', () => {
    const four = [1, 2, 3, 4].map(cpuArchetypeForN);
    expect(new Set(four).size).toBe(4);
    expect(cpuArchetypeForN(7)).toBe(cpuArchetypeForN(1)); // (n-1) % 6
    expect(cpuArchetypeForN(1)).toBe(CPU_ARCHETYPE_ORDER[0]);
  });

  it('CPU_ARCHETYPE_ORDER parity with the live archetype registry (zero-import rule: literals here, parity locked)', () => {
    expect([...CPU_ARCHETYPE_ORDER].sort()).toEqual(Object.keys(ARCHETYPE_WEIGHTS).sort());
  });
});

describe('buildCpuUserBoard — deterministic ranked-slice user boards', () => {
  const pool = Array.from({ length: 40 }, (_, i) => `SYM${i}`);

  it('CPU n slices at offset (n-1)×3, depth BOARD_DEPTH_MIN', () => {
    const board = buildCpuUserBoard(pool, 2);
    expect(board).toHaveLength(TOURNAMENT_TUNING.BOARD_DEPTH_MIN);
    expect(board[0]).toBe('SYM3');
    expect(buildCpuUserBoard(pool, 1)[0]).toBe('SYM0');
  });

  it('neighboring CPUs collide by construction (the snipe stagger)', () => {
    const b1 = new Set(buildCpuUserBoard(pool, 1));
    const b2 = buildCpuUserBoard(pool, 2);
    expect(b2.filter(s => b1.has(s)).length).toBeGreaterThan(0);
  });

  it('wraps modulo the pool and is reproducible', () => {
    const board = buildCpuUserBoard(pool, 14); // offset 39 → wraps
    expect(board[0]).toBe('SYM39');
    expect(board[1]).toBe('SYM0');
    expect(buildCpuUserBoard(pool, 14)).toEqual(board);
  });
});

describe('createTournamentGroupDoc — isCpu passthrough (Ruling B1)', () => {
  const base = {
    userPool: ['NVDA', 'AMD'],
    roundNumber: 1,
    bracketGameId: 'b-r1-g1',
    now: 'T0',
  };

  it('carries isCpu: true on CPU seats and OMITS it elsewhere (the omission idiom)', () => {
    const doc = createTournamentGroupDoc({
      ...base,
      players: [
        { odUserId: 'u1' },
        { odUserId: 'u2', isCpu: false },
        { odUserId: 'cpu-1', isCpu: true },
        { odUserId: 'cpu-2', isCpu: true },
      ],
    });
    expect(doc.players[0]).not.toHaveProperty('isCpu');
    expect(doc.players[1]).not.toHaveProperty('isCpu');
    expect(doc.players[2].isCpu).toBe(true);
    expect(doc.players[3].isCpu).toBe(true);
  });
});

describe('createTournamentGroupDoc — isTraining passthrough (League Next-Arc Slice 3.0)', () => {
  it('carries isTraining: true when flagged and OMITS it otherwise (the omission idiom)', () => {
    const training = createTournamentGroupDoc(makeGroupArgs({ isTraining: true }));
    expect(training.isTraining).toBe(true);
    // The XOR still holds — a training pod is a base-layer-shaped group; the
    // exclusion keys on the flag, not the round metadata.
    expect(training.baseLayerWeek).toBe('2026-W25');
    expect('bracketGameId' in training).toBe(false);

    const normal = createTournamentGroupDoc(makeGroupArgs());
    expect('isTraining' in normal).toBe(false);
    const explicitFalse = createTournamentGroupDoc(makeGroupArgs({ isTraining: false }));
    expect('isTraining' in explicitFalse).toBe(false);
  });
});

// ==================== P6a — COMPOSITE + LEADERBOARD/RANK IDENTITY ====================

describe('computeComposite — the ONE home for k (ruling A-1)', () => {
  it('composite = agent + 1.5 × user, signed throughout', () => {
    expect(computeComposite(10, 20)).toBe(40);
    expect(computeComposite(0, 0)).toBe(0);
    expect(computeComposite(-10, -20)).toBe(-40);   // negatives preserved, never floored
    expect(computeComposite(null, undefined)).toBe(0);
  });
});

describe('getWeeklyComposite — final snapshot, never a sum', () => {
  const group = (entry) => ({ dailyScores: {
    day1: { recordedDate: '2026-06-15', closeScores: { u1: { totalPoints: 1, agentPoints: 1, compositePoints: 999 } } },
    day2: { recordedDate: '2026-06-16', closeScores: { u1: entry } },
  } });

  it('reads the FINAL day compositePoints', () => {
    expect(getWeeklyComposite(group({ totalPoints: 10, agentPoints: 5, compositePoints: 20 }), 'u1')).toBe(20);
  });

  it('pre-P6 snapshots (no compositePoints) degrade by deriving from what exists', () => {
    expect(getWeeklyComposite(group({ totalPoints: 10, agentPoints: 4 }), 'u1')).toBe(19); // 4 + 1.5×10
    expect(getWeeklyComposite(group({ totalPoints: 10 }), 'u1')).toBe(15);                 // k × user only
  });

  it('missing player / no banking → 0', () => {
    expect(getWeeklyComposite(group({ totalPoints: 1 }), 'nobody')).toBe(0);
    expect(getWeeklyComposite({ dailyScores: {} }, 'u1')).toBe(0);
  });
});

describe('isWeekBanked — hoisted at P6a (one definition, advancement re-exports)', () => {
  it('false below day 5, true at day 5', () => {
    expect(WEEK_DAYS_REQUIRED).toBe(5);
    expect(isWeekBanked({ dailyScores: { day4: { recordedDate: 'x', closeScores: {} } } })).toBe(false);
    expect(isWeekBanked({ dailyScores: { day5: { recordedDate: 'x', closeScores: {} } } })).toBe(true);
  });
});

describe('month + doc-id helpers (rulings A-3 / A-4)', () => {
  it('monthKeyFromEtDate: ET month of the date string; null on malformed input', () => {
    expect(monthKeyFromEtDate('2026-06-29')).toBe('2026-06');
    expect(monthKeyFromEtDate('2026-07-01')).toBe('2026-07');
    expect(monthKeyFromEtDate('garbage')).toBeNull();
    expect(monthKeyFromEtDate(undefined)).toBeNull();
  });

  it('leaderboardDocId / rankDocId: dev namespace prefixes (smoke can never touch production docs)', () => {
    expect(leaderboardDocId('2026-06')).toBe('2026-06');
    expect(leaderboardDocId('2026-06', { dev: true })).toBe('dev-2026-06');
    expect(rankDocId('founder')).toBe('founder');
    expect(rankDocId('founder', { dev: true })).toBe('dev-founder');
  });

  it('collection identities', () => {
    expect(TOURNAMENT_LEADERBOARDS_COLLECTION).toBe('tournamentLeaderboards');
    expect(TOURNAMENT_RANKS_COLLECTION).toBe('tournamentRanks');
  });
});

describe('RANK_TIERS — the founder-signed ladder (B-1, June 12, 2026)', () => {
  it('exact signed names and floors', () => {
    expect(RANK_TIERS.map(t => [t.tier, t.name, t.floor])).toEqual([
      [1, 'Intern', 0],
      [2, 'Analyst', 250],
      [3, 'Associate', 750],
      [4, 'Strategist', 1750],
      [5, 'Desk Head', 3500],
      [6, 'Fund Manager', 6500],
      [7, 'Market Legend', 11000],
    ]);
    expect(Object.isFrozen(RANK_TIERS)).toBe(true);
    expect(Object.isFrozen(RANK_TUNING)).toBe(true);
  });

  it('signed tuning values (B-2): scale 1.0, placement 100/66/33/0', () => {
    expect(RANK_TUNING.RP_PER_POINT).toBe(1.0);
    expect(RANK_TUNING.PLACEMENT_BONUS).toEqual([100, 66, 33, 0]);
  });

  it('tierForRp: floors inclusive, boundaries exact', () => {
    expect(tierForRp(0).name).toBe('Intern');
    expect(tierForRp(249.99).name).toBe('Intern');
    expect(tierForRp(250).name).toBe('Analyst');
    expect(tierForRp(11000).name).toBe('Market Legend');
    expect(tierForRp(999999).name).toBe('Market Legend');
    expect(tierForRp(-50).name).toBe('Intern');
    expect(tierForRp(NaN).name).toBe('Intern');
  });
});

describe('cpuFarmGuard + computeRankDelta — the founder-signed math (B-2)', () => {
  it('guard by CPU density among the other three: 1, ⅔, ⅓, 0', () => {
    expect(cpuFarmGuard(0)).toBe(1);
    expect(cpuFarmGuard(1)).toBeCloseTo(2 / 3, 10);
    expect(cpuFarmGuard(2)).toBeCloseTo(1 / 3, 10);
    expect(cpuFarmGuard(3)).toBe(0);   // fully padded → zero positive RP (consciously noted)
    expect(cpuFarmGuard(99)).toBe(0);  // clamped
    expect(cpuFarmGuard(-1)).toBe(1);  // clamped
  });

  it('delta = (composite × scale + placement bonus), guard on GAINS only', () => {
    // Un-padded winner: 60 + 100 = 160.
    expect(computeRankDelta({ weeklyComposite: 60, placement: 1, cpuOpponents: 0 })).toBe(160);
    // One CPU opponent: ×⅔.
    expect(computeRankDelta({ weeklyComposite: 60, placement: 1, cpuOpponents: 1 })).toBeCloseTo(160 * 2 / 3, 10);
    // Fully padded: zero positive RP.
    expect(computeRankDelta({ weeklyComposite: 60, placement: 1, cpuOpponents: 3 })).toBe(0);
    // Negative weeks are NEVER discounted — padding can't shield losses.
    expect(computeRankDelta({ weeklyComposite: -200, placement: 4, cpuOpponents: 3 })).toBe(-200);
    // A negative composite can still net positive via the placement bonus —
    // and then it IS a gain, so the guard applies.
    expect(computeRankDelta({ weeklyComposite: -10, placement: 1, cpuOpponents: 3 })).toBe(0);
    expect(computeRankDelta({ weeklyComposite: -10, placement: 1, cpuOpponents: 0 })).toBe(90);
  });
});

describe('computeRankBreakdown — math and audit from ONE computation (code review)', () => {
  it('returns {raw, guard, delta} consistent with computeRankDelta', () => {
    const args = { weeklyComposite: 60, placement: 1, cpuOpponents: 1 };
    const b = computeRankBreakdown(args);
    expect(b.raw).toBe(160);
    expect(b.guard).toBeCloseTo(2 / 3, 10);
    expect(b.delta).toBe(computeRankDelta(args));
  });
});

describe('rankByScores — the ONE comparator home (code review)', () => {
  it('score desc, order-index tie-break; missing/non-finite scores rank as 0', () => {
    expect(rankByScores({ a: 10, b: 30, c: 10 }, ['a', 'b', 'c'])).toEqual(['b', 'a', 'c']);
    expect(rankByScores({ a: -5, b: NaN }, ['a', 'b', 'c'])).toEqual(['b', 'c', 'a']); // NaN/missing → 0 > −5
    expect(rankByScores({}, [])).toEqual([]);
  });
});

describe('round2 — the shared rounding home', () => {
  it('two decimals; NaN/undefined guard to 0', () => {
    expect(round2(1.005)).toBe(1.0); // toFixed semantics, documented
    expect(round2(97.499)).toBe(97.5);
    expect(round2(NaN)).toBe(0);
    expect(round2(undefined)).toBe(0);
  });
});

describe('applyRankWeek — the ratchet (B-2): floors permanent, within-tier slide, no debt', () => {
  it('accrues, crosses a tier, and the floor ratchets to that tier', () => {
    let state = applyRankWeek(null, 160);
    expect(state).toMatchObject({ rp: 160, tier: 1, tierName: 'Intern', floorRp: 0 });
    state = applyRankWeek(state, 160);
    expect(state).toMatchObject({ rp: 320, tier: 2, tierName: 'Analyst', floorRp: 250, peakRp: 320 });
  });

  it('FLOOR PERMANENCE: huge negative weeks never drop RP below the achieved tier floor', () => {
    let state = applyRankWeek(null, 800); // straight into Associate
    expect(state).toMatchObject({ tier: 3, floorRp: 750 });
    state = applyRankWeek(state, -10000);
    expect(state).toMatchObject({ rp: 750, tier: 3, tierName: 'Associate', floorRp: 750 });
    state = applyRankWeek(state, -10000);
    expect(state.rp).toBe(750); // forever
  });

  it('within-tier slide is real: negatives subtract down to the floor, not past it', () => {
    let state = applyRankWeek(null, 400); // Analyst, 150 above floor
    state = applyRankWeek(state, -100);
    expect(state).toMatchObject({ rp: 300, tier: 2 });
    state = applyRankWeek(state, -100);
    expect(state).toMatchObject({ rp: 250, tier: 2, floorRp: 250 }); // clamped at the floor
  });

  it('NO DEBT: an unranked player losing big sits at 0, never negative', () => {
    const state = applyRankWeek(null, -500);
    expect(state).toMatchObject({ rp: 0, tier: 1, floorRp: 0, peakRp: 0 });
  });

  it('peakRp tracks the high-water mark across slides', () => {
    let state = applyRankWeek(null, 400);
    state = applyRankWeek(state, -100);
    expect(state.peakRp).toBe(400);
  });
});

describe('applyRankWeekFrozen — CPU display-only, no ratchet (§7.1, June 12, 2026)', () => {
  it('RP moves for display but the floor NEVER climbs — even across a tier line', () => {
    let state = applyRankWeekFrozen(null, 160);
    expect(state).toMatchObject({ rp: 160, tier: 1, floorRp: 0, peakRp: 160 });
    // Crossing into Analyst territory: tier reflects the live RP, but the
    // floor stays 0 — a bot never permanently achieves a tier.
    state = applyRankWeekFrozen(state, 160);
    expect(state).toMatchObject({ rp: 320, tier: 2, tierName: 'Analyst', floorRp: 0 });
  });

  it('NO permanent floor: a CPU that climbs then loses slides all the way back (the human ladder would not)', () => {
    let frozen = applyRankWeekFrozen(null, 800);   // would be Associate for a human
    expect(frozen).toMatchObject({ tier: 3, floorRp: 0 });
    frozen = applyRankWeekFrozen(frozen, -800);
    expect(frozen).toMatchObject({ rp: 0, tier: 1, floorRp: 0 }); // no floor caught it
    // Contrast: the human ratchet holds the achieved floor.
    let human = applyRankWeek(null, 800);
    human = applyRankWeek(human, -800);
    expect(human).toMatchObject({ rp: 750, floorRp: 750 });
  });

  it('NO DEBT still holds: RP floors at 0', () => {
    expect(applyRankWeekFrozen(null, -500)).toMatchObject({ rp: 0, tier: 1, floorRp: 0, peakRp: 0 });
  });
});

describe('isFinalSnapshotDegraded — the §7.2 gate predicate (June 12, 2026)', () => {
  const banked = (extra = {}) => ({ dailyScores: { day5: { recordedDate: 'x', closeScores: {}, ...extra } } });
  it('true only when the LATEST day entry carries agentScoresCarried', () => {
    expect(isFinalSnapshotDegraded(banked({ agentScoresCarried: true }))).toBe(true);
    expect(isFinalSnapshotDegraded(banked())).toBe(false);
    expect(isFinalSnapshotDegraded(banked({ agentScoresCarried: false }))).toBe(false);
    expect(isFinalSnapshotDegraded({ dailyScores: {} })).toBe(false);
    expect(isFinalSnapshotDegraded(null)).toBe(false);
  });
  it('reads the LATEST day only — a carried earlier day does not gate a clean final', () => {
    const group = { dailyScores: {
      day4: { recordedDate: 'w', closeScores: {}, agentScoresCarried: true },
      day5: { recordedDate: 'x', closeScores: {} },
    } };
    expect(isFinalSnapshotDegraded(group)).toBe(false);
  });
});

describe('shiftMonthKey — the leaderboard chevron nav (P6b)', () => {
  it('shifts months with year rollover; malformed → null', () => {
    expect(shiftMonthKey('2026-06', -1)).toBe('2026-05');
    expect(shiftMonthKey('2026-06', 1)).toBe('2026-07');
    expect(shiftMonthKey('2026-01', -1)).toBe('2025-12'); // year underflow
    expect(shiftMonthKey('2026-12', 1)).toBe('2027-01');  // year overflow
    expect(shiftMonthKey('2026-06', -18)).toBe('2024-12');
    expect(shiftMonthKey('nope', 1)).toBeNull();
    expect(shiftMonthKey('2026-13', 1)).toBeNull();
  });
});

describe('rankProgress — the ratchet made legible (P6b)', () => {
  it('within-tier fraction toward the next floor; floor tier named', () => {
    // rp 500: Associate floor 750? no — 500 is Analyst (250..750). Floor 250,
    // next Associate 750 → (500-250)/(750-250) = 0.5.
    const p = rankProgress({ rp: 500, floorRp: 250 });
    expect(p).toMatchObject({ tierName: 'Analyst', floorTierName: 'Analyst', nextTierName: 'Associate', nextFloor: 750 });
    expect(p.withinTierPct).toBeCloseTo(0.5, 5);
  });

  it('floor tier can trail the live tier (RP climbed within), and the bar reflects RP', () => {
    const p = rankProgress({ rp: 300, floorRp: 250 });
    expect(p.floorTierName).toBe('Analyst');
    expect(p.withinTierPct).toBeCloseTo((300 - 250) / (750 - 250), 5);
  });

  it('top of the ladder: no next tier, full bar', () => {
    const p = rankProgress({ rp: 12000, floorRp: 11000 });
    expect(p).toMatchObject({ tierName: 'Market Legend', nextTierName: null, nextFloor: null, withinTierPct: 1 });
  });

  it('a fresh/empty rank reads as Intern at 0', () => {
    expect(rankProgress(null)).toMatchObject({ tierName: 'Intern', floorTierName: 'Intern', withinTierPct: 0 });
  });
});

describe('pickCurrentTournamentBattle (P7 — shared current-battle selection)', () => {
  it('prefers the active battle over a completed one', () => {
    const out = pickCurrentTournamentBattle([
      { id: 'done', status: 'completed', createdAt: '2026-06-13T00:00:00Z' },
      { id: 'live', status: 'active', createdAt: '2026-06-12T00:00:00Z' },
    ]);
    expect(out.id).toBe('live');
  });

  it('among same-status battles, picks the most recent createdAt (ISO lexicographic = chronological)', () => {
    const out = pickCurrentTournamentBattle([
      { id: 'd1', status: 'completed', createdAt: '2026-06-10T00:00:00Z' },
      { id: 'd2', status: 'completed', createdAt: '2026-06-12T00:00:00Z' },
    ]);
    expect(out.id).toBe('d2');
  });

  it('returns null for an empty/nullish set and skips null entries', () => {
    expect(pickCurrentTournamentBattle([])).toBeNull();
    expect(pickCurrentTournamentBattle(null)).toBeNull();
    expect(pickCurrentTournamentBattle([null, { id: 'x', status: 'active' }]).id).toBe('x');
  });
});

// ==================== P10 — SELF-SERVE LOBBY ====================

describe('lobby constants', () => {
  it('the collection name, the human cap (== group size), and the vocabularies are stable', () => {
    expect(TOURNAMENT_LOBBY_COLLECTION).toBe('tournamentLobby');
    expect(LOBBY_MAX_HUMANS).toBe(GROUP_SIZE);
    expect(LOBBY_DISPLAY_NAME_MAX).toBe(80);
    expect(LOBBY_STATUS).toEqual({ OPEN: 'open', FORMING: 'forming', FORMED: 'formed', CANCELLED: 'cancelled' });
    expect(LOBBY_MODE).toEqual({ MATCHMAKING: 'matchmaking', PRIVATE: 'private' });
  });
});

describe('createLobbyMember', () => {
  it('trims + caps the display name, keeps odUserId and joinedAt', () => {
    const m = createLobbyMember({ odUserId: 'u1', displayName: '  Ada  ', joinedAt: NOW });
    expect(m).toEqual({ odUserId: 'u1', displayName: 'Ada', joinedAt: NOW });
    const long = createLobbyMember({ odUserId: 'u1', displayName: 'x'.repeat(200), joinedAt: NOW });
    expect(long.displayName).toHaveLength(LOBBY_DISPLAY_NAME_MAX);
  });

  it('a blank/absent display name is null, not empty string', () => {
    expect(createLobbyMember({ odUserId: 'u1', joinedAt: NOW }).displayName).toBeNull();
    expect(createLobbyMember({ odUserId: 'u1', displayName: '   ', joinedAt: NOW }).displayName).toBeNull();
  });

  it('throws on a missing odUserId or joinedAt', () => {
    expect(() => createLobbyMember({ joinedAt: NOW })).toThrow(/odUserId/);
    expect(() => createLobbyMember({ odUserId: 'u1' })).toThrow(/joinedAt/);
  });
});

describe('createLobbyDoc', () => {
  it('an open matchmaking lobby seats the creator, no join code, group/cpu fields null', () => {
    const doc = createLobbyDoc({ createdBy: 'u1', displayName: 'Ada', mode: LOBBY_MODE.MATCHMAKING, baseLayerWeek: '2026-W25', now: NOW });
    expect(doc.status).toBe(LOBBY_STATUS.OPEN);
    expect(doc.mode).toBe(LOBBY_MODE.MATCHMAKING);
    expect(doc).not.toHaveProperty('joinCode');
    expect(doc.members).toEqual([{ odUserId: 'u1', displayName: 'Ada', joinedAt: NOW }]);
    expect(doc.createdBy).toBe('u1');
    expect(doc.baseLayerWeek).toBe('2026-W25');
    expect(doc.groupId).toBeNull();
    expect(doc.cpuStartN).toBeNull();
    expect(doc.createdAt).toBe(NOW);
  });

  it('a private lobby requires + carries a join code', () => {
    const doc = createLobbyDoc({ createdBy: 'u1', mode: LOBBY_MODE.PRIVATE, joinCode: 'ABC234', baseLayerWeek: '2026-W25', now: NOW });
    expect(doc.joinCode).toBe('ABC234');
    expect(() => createLobbyDoc({ createdBy: 'u1', mode: LOBBY_MODE.PRIVATE, baseLayerWeek: '2026-W25', now: NOW })).toThrow(/joinCode/);
  });

  it('throws on bad inputs (createdBy, mode, baseLayerWeek, now)', () => {
    expect(() => createLobbyDoc({ mode: LOBBY_MODE.MATCHMAKING, baseLayerWeek: '2026-W25', now: NOW })).toThrow(/createdBy/);
    expect(() => createLobbyDoc({ createdBy: 'u1', mode: 'bogus', baseLayerWeek: '2026-W25', now: NOW })).toThrow(/mode/);
    expect(() => createLobbyDoc({ createdBy: 'u1', now: NOW })).toThrow(/baseLayerWeek/);
    expect(() => createLobbyDoc({ createdBy: 'u1', baseLayerWeek: '2026-W25' })).toThrow(/now/);
  });
});

describe('lobby pure helpers', () => {
  const lobby = { members: [{ odUserId: 'a' }, { odUserId: 'b' }] };
  it('lobbyHumanIds preserves FIFO order', () => {
    expect(lobbyHumanIds(lobby)).toEqual(['a', 'b']);
    expect(lobbyHumanIds(null)).toEqual([]);
  });
  it('lobbyOpenSeatCount = GROUP_SIZE − humans, never negative', () => {
    expect(lobbyOpenSeatCount(lobby)).toBe(GROUP_SIZE - 2);
    expect(lobbyOpenSeatCount({ members: [1, 2, 3, 4, 5] })).toBe(0);
    expect(lobbyOpenSeatCount(null)).toBe(GROUP_SIZE);
  });
  it('lobbyHasMember detects an existing seat (double-join guard)', () => {
    expect(lobbyHasMember(lobby, 'a')).toBe(true);
    expect(lobbyHasMember(lobby, 'z')).toBe(false);
    expect(lobbyHasMember(null, 'a')).toBe(false);
  });
});

describe('selectActiveLobby — the subscribeMyLobby selection + the lobby→group handoff', () => {
  const open = { id: 'l1', status: LOBBY_STATUS.OPEN, updatedAt: '2026-06-10T10:00:00Z', members: [{ odUserId: 'me' }] };
  const formed = { id: 'l2', status: LOBBY_STATUS.FORMED, updatedAt: '2026-06-10T12:00:00Z', members: [{ odUserId: 'me' }] };

  it('returns the caller\'s OPEN/FORMING lobby; null when they aren\'t a member', () => {
    expect(selectActiveLobby([open], 'me')?.id).toBe('l1');
    expect(selectActiveLobby([open], 'someone-else')).toBeNull();
    expect(selectActiveLobby([], 'me')).toBeNull();
    expect(selectActiveLobby(null, 'me')).toBeNull();
  });

  it('the HANDOFF: a FORMED lobby is excluded → null (the group subscription takes over)', () => {
    expect(selectActiveLobby([formed], 'me')).toBeNull();
  });

  it('picks the most-recently-updated when more than one is active', () => {
    const older = { id: 'a', status: LOBBY_STATUS.OPEN, updatedAt: '2026-06-10T09:00:00Z', members: [{ odUserId: 'me' }] };
    const newer = { id: 'b', status: LOBBY_STATUS.FORMING, updatedAt: '2026-06-10T11:00:00Z', members: [{ odUserId: 'me' }] };
    expect(selectActiveLobby([older, newer], 'me').id).toBe('b');
  });
});

describe('isoWeekString (relocated from the dev seeder — one home, BUILD_RULES §4)', () => {
  it('labels the ISO-8601 (UTC) week, Thursday-anchored', () => {
    expect(isoWeekString(new Date('2026-06-15T00:00:00Z'))).toBe('2026-W25'); // Monday
    expect(isoWeekString(new Date('2026-01-01T00:00:00Z'))).toBe('2026-W01');
    expect(isoWeekString(new Date('2025-12-29T00:00:00Z'))).toBe('2026-W01'); // belongs to 2026 W1
  });
  it('requires a valid Date (the schema module never reads a clock)', () => {
    expect(() => isoWeekString()).toThrow(/valid Date/);
    expect(() => isoWeekString('2026-06-15')).toThrow(/valid Date/);
    expect(() => isoWeekString(new Date('nope'))).toThrow(/valid Date/);
  });
});
