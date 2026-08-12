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
  BASELINE_POLICY,
  LEDGER_SOURCE,
  TOURNAMENT_TUNING,
  AGENT_LEDGER_SUBCOLLECTION,
  AGENT_LEDGER_DOC_ID,
  createClaimSystemState,
  createLeg,
  createPickState,
  createCanonicalOpenEntry,
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
  // League Next-Arc Slice 5b-i — the ranked/training split predicates.
  selectMyGroup,
  casualDeployMissesPodSession,
  selectMyTrainingPod,
  // League field-leak fix — THE FIELD read excludes training pods.
  selectBaseLayerField,
  BASE_LAYER_FIELD_OVERFETCH,
  isoWeekString,
  // L-A follow-up (B) — the member voided-card's dedicated read + reason projection.
  selectMyMostRecentVoidedGroup,
  selectMyMostRecentCompletedGroup,
  voidReasonLabel,
  VOID_REASON_LABELS,
  VOIDED_NO_RESULT_COPY,
  // L-B Guard 2 — the clamped result read.
  getLatestBankedDayEntry,
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
      CANONICAL_OPEN_CAPTURE: 'canonical_open_capture',
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

  it('defaults long, fresh thresholdHistory, present-null capture provenance, closed-state keys omitted', () => {
    const leg = createLeg(args);
    expect(leg).toEqual({
      direction: 'long',
      baselinePrice: 187.5,
      baselineSource: 'flip_market_open',
      openedAt: NOW,
      thresholdHistory: [],
      // Canonical-open capture provenance — present-null (like baselinePrice)
      // by default; populated only by the post-open capture sweep.
      baselineCapturedAt: null,
      baselinePriceTimestamp: null,
      captureJobId: null,
      baselineSession: null,
      instrumentId: null,
      captureState: null,
    });
    expect('closedAt' in leg).toBe(false);
    expect('bankedScore' in leg).toBe(false);
  });

  it('accepts the canonical_open_capture source and stores capture provenance', () => {
    const leg = createLeg({
      ...args,
      baselineSource: BASELINE_SOURCE.CANONICAL_OPEN_CAPTURE,
      baselineCapturedAt: NOW,
      baselinePriceTimestamp: 1719927000,
      captureJobId: 'job-1',
      baselineSession: '2026-07-02',
      instrumentId: null,
    });
    expect(leg.baselineSource).toBe('canonical_open_capture');
    expect(leg.baselineCapturedAt).toBe(NOW);
    expect(leg.baselinePriceTimestamp).toBe(1719927000);
    expect(leg.captureJobId).toBe('job-1');
    expect(leg.baselineSession).toBe('2026-07-02');
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

// ==================== CANONICAL-OPEN CAPTURE (Spec §1.1) ====================

describe('BASELINE_POLICY + createCanonicalOpenEntry (canonical-open capture)', () => {
  it('the policy enum carries the two ratified values', () => {
    expect(BASELINE_POLICY.LEGACY_OPEN_DEFER).toBe('legacy_open_defer');
    expect(BASELINE_POLICY.CANONICAL_OPEN).toBe('canonical_open');
  });

  it('BASELINE_SOURCE gains the canonical_open_capture value', () => {
    expect(BASELINE_SOURCE.CANONICAL_OPEN_CAPTURE).toBe('canonical_open_capture');
  });

  it('builds the frozen per-symbol snapshot entry', () => {
    const e = createCanonicalOpenEntry({
      open: 812.5, capturedAt: NOW, priceTimestamp: 1719927000, captureJobId: 'job-1', session: '2026-07-02',
    });
    expect(e).toEqual({
      open: 812.5, capturedAt: NOW, priceTimestamp: 1719927000, captureJobId: 'job-1', session: '2026-07-02', instrumentId: null,
    });
  });

  it('fail-closed at the shape boundary: rejects a non-positive/absent open', () => {
    expect(() => createCanonicalOpenEntry({ open: 0, capturedAt: NOW })).toThrow(/open/);
    expect(() => createCanonicalOpenEntry({ open: -1, capturedAt: NOW })).toThrow(/open/);
    expect(() => createCanonicalOpenEntry({ open: null, capturedAt: NOW })).toThrow(/open/);
  });

  it('requires an ISO capturedAt', () => {
    expect(() => createCanonicalOpenEntry({ open: 10 })).toThrow(/capturedAt/);
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

  it('OMITS baselinePolicy by default (byte-identical shape when the call site does not stamp it)', () => {
    const doc = createTournamentGroupDoc(makeGroupArgs());
    expect('baselinePolicy' in doc).toBe(false);
  });

  it('carries baselinePolicy when the call site stamps it (Spec §1.1 canonical-open policy)', () => {
    const on = createTournamentGroupDoc(makeGroupArgs({ baselinePolicy: BASELINE_POLICY.CANONICAL_OPEN }));
    expect(on.baselinePolicy).toBe('canonical_open');
    const off = createTournamentGroupDoc(makeGroupArgs({ baselinePolicy: BASELINE_POLICY.LEGACY_OPEN_DEFER }));
    expect(off.baselinePolicy).toBe('legacy_open_defer');
  });

  it('rejects an invalid baselinePolicy', () => {
    expect(() => createTournamentGroupDoc(makeGroupArgs({ baselinePolicy: 'nope' }))).toThrow(/baselinePolicy/);
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

describe('selectMyGroup — the subscribeMyGroup ranked read EXCLUDES training pods (5b-i safety gate)', () => {
  const rankedBattle = { id: 'g1', status: GROUP_STATUS.BATTLE, updatedAt: '2026-06-15T10:00:00Z' };
  const rankedForming = { id: 'g2', status: GROUP_STATUS.FORMING, updatedAt: '2026-06-15T09:00:00Z' };
  // A live training pod in BATTLE — the exact doc that would mis-render through
  // the status-keyed ranked UI if it leaked into the ranked tab.
  const trainingBattle = { id: 't1', status: GROUP_STATUS.BATTLE, isTraining: true, updatedAt: '2026-06-15T23:00:00Z' };

  it('THE GATE: a training BATTLE pod never surfaces; the ranked group does (even when the pod is newer)', () => {
    expect(selectMyGroup([trainingBattle, rankedBattle])?.id).toBe('g1');
    // training-only → null (nothing rankable, NOT the training pod)
    expect(selectMyGroup([trainingBattle])).toBeNull();
  });

  it('returns the caller\'s active ranked group; null when none active', () => {
    expect(selectMyGroup([rankedBattle])?.id).toBe('g1');
    expect(selectMyGroup([rankedForming])?.id).toBe('g2');
    expect(selectMyGroup([{ id: 'd', status: GROUP_STATUS.COMPLETE }])).toBeNull();
    expect(selectMyGroup([])).toBeNull();
    expect(selectMyGroup(null)).toBeNull();
  });

  it('picks the most-recently-updated ranked group when several match', () => {
    const older = { id: 'a', status: GROUP_STATUS.BATTLE, updatedAt: '2026-06-15T08:00:00Z' };
    const newer = { id: 'b', status: GROUP_STATUS.FORMING, updatedAt: '2026-06-15T12:00:00Z' };
    expect(selectMyGroup([older, newer]).id).toBe('b');
  });

  it('COMPETITIVE LIVE DRAFT (Phase 3 gate lift): a competitive DRAFTING/AWAITING_OPEN pod now surfaces; a training one still does not', () => {
    const compDrafting = { id: 'c1', status: GROUP_STATUS.DRAFTING, updatedAt: '2026-07-08T23:00:00Z' };
    const compAwaiting = { id: 'c2', status: GROUP_STATUS.AWAITING_OPEN, updatedAt: '2026-07-08T23:05:00Z' };
    const trainingDrafting = { id: 't2', status: GROUP_STATUS.DRAFTING, isTraining: true, updatedAt: '2026-07-08T23:10:00Z' };
    expect(selectMyGroup([compDrafting])?.id).toBe('c1');
    expect(selectMyGroup([compAwaiting])?.id).toBe('c2');
    // training in-flight pods stay excluded (they route via selectMyTrainingPod)
    expect(selectMyGroup([trainingDrafting])).toBeNull();
    // even when the training pod is newer, the competitive in-flight pod is the ranked match
    expect(selectMyGroup([compDrafting, trainingDrafting])?.id).toBe('c1');
  });
});

describe('EXPIRED is inert across the active-status selectors + predicates (R2, review Q5)', () => {
  it('selectMyGroup never selects an EXPIRED-status pod (not in the active set)', () => {
    const expiredRanked = { id: 'x', status: GROUP_STATUS.EXPIRED, updatedAt: '2026-07-22T00:00:00.000Z' };
    expect(selectMyGroup([expiredRanked])).toBeNull();
    // a live BATTLE pod still wins; the newer EXPIRED pod is ignored, not preferred
    expect(selectMyGroup([expiredRanked, { id: 'b', status: GROUP_STATUS.BATTLE, updatedAt: '2026-07-21T00:00:00.000Z' }])?.id).toBe('b');
  });

  it('selectMyTrainingPod never selects an EXPIRED training pod (so the start CTA returns + a new pod can form)', () => {
    const expiredTraining = { id: 'x', status: GROUP_STATUS.EXPIRED, isTraining: true, updatedAt: '2026-07-22T00:00:00.000Z' };
    expect(selectMyTrainingPod([expiredTraining])).toBeNull();
  });

  it('casualDeployMissesPodSession → false (no conflict) for a terminal EXPIRED pod, even with a would-conflict anchor', () => {
    // The pod carries a battleStartWeek.anchorEtDate that WOULD conflict (expiry
    // reaches it) IF EXPIRED were mistakenly treated as a pre-battle session — so
    // this asserts the EXPIRED-status exclusion, not a missing-anchor accident.
    const expired = { id: 'x', status: GROUP_STATUS.EXPIRED, battleStartWeek: { anchorEtDate: '2026-07-23', mondayEtDate: '2026-07-23', anchorIso: '2026-07-23T13:30:00.000Z' } };
    expect(casualDeployMissesPodSession(expired, { expiryEtDate: '2026-07-30', nextTradingEtDate: '2026-07-23' })).toBe(false);
  });
});

describe('VOIDED is inert across the active-status selectors + FIELD (L-A census regression lock)', () => {
  it('selectMyGroup never selects a VOIDED ranked group (positive gate excludes it, like COMPLETE/EXPIRED)', () => {
    const voidedRanked = { id: 'v', status: GROUP_STATUS.VOIDED, updatedAt: '2026-08-05T00:00:00.000Z' };
    expect(selectMyGroup([voidedRanked])).toBeNull();
    // a live BATTLE group still wins; the newer VOIDED group is ignored, never preferred
    expect(selectMyGroup([voidedRanked, { id: 'b', status: GROUP_STATUS.BATTLE, updatedAt: '2026-08-04T00:00:00.000Z' }])?.id).toBe('b');
  });

  it('selectMyTrainingPod never selects a VOIDED pod', () => {
    const voidedTraining = { id: 'v', status: GROUP_STATUS.VOIDED, isTraining: true, updatedAt: '2026-08-05T00:00:00.000Z' };
    expect(selectMyTrainingPod([voidedTraining])).toBeNull();
  });

  it('selectBaseLayerField excludes a VOIDED group from THE FIELD (a void carries no valid standing)', () => {
    const voided = { id: 'v', status: GROUP_STATUS.VOIDED, updatedAt: '2026-08-05T00:00:00.000Z' };
    const live = { id: 'g', status: GROUP_STATUS.BATTLE, updatedAt: '2026-08-04T00:00:00.000Z' };
    expect(selectBaseLayerField([voided, live]).map(g => g.id)).toEqual(['g']);
  });

  it('casualDeployMissesPodSession → false (no conflict) for a terminal VOIDED group', () => {
    const voided = { id: 'v', status: GROUP_STATUS.VOIDED, battleStartWeek: { anchorEtDate: '2026-08-05', mondayEtDate: '2026-08-05', anchorIso: '2026-08-05T13:30:00.000Z' } };
    expect(casualDeployMissesPodSession(voided, { expiryEtDate: '2026-08-12', nextTradingEtDate: '2026-08-05' })).toBe(false);
  });
});

// L-A follow-up (B) — the member voided-card's DEDICATED read + reason projection.
// The card surfaces a member's most-recent voided group WITHOUT loosening the
// active allowlist above (that inertness lock must stay green — asserted here in
// the same battery so the two can never drift).
describe('selectMyMostRecentVoidedGroup — the member voided-card read (separate from the active allowlist)', () => {
  const voidedA = { id: 'va', status: GROUP_STATUS.VOIDED, updatedAt: '2026-07-22T19:00:00.000Z' };
  const voidedB = { id: 'vb', status: GROUP_STATUS.VOIDED, updatedAt: '2026-08-05T00:00:00.000Z' };
  const battle = { id: 'b', status: GROUP_STATUS.BATTLE, updatedAt: '2026-08-04T00:00:00.000Z' };
  const complete = { id: 'c', status: GROUP_STATUS.COMPLETE, updatedAt: '2026-08-06T00:00:00.000Z' };
  const voidedTraining = { id: 'vt', status: GROUP_STATUS.VOIDED, isTraining: true, updatedAt: '2026-08-07T00:00:00.000Z' };

  it('returns the MOST-RECENT voided ranked group (most-recently-updated wins)', () => {
    expect(selectMyMostRecentVoidedGroup([voidedA, voidedB])?.id).toBe('vb');
    expect(selectMyMostRecentVoidedGroup([voidedB, voidedA])?.id).toBe('vb');
  });

  it('surfaces the void ONLY when it is the most-recent ranked group (a newer non-void group shadows it)', () => {
    expect(selectMyMostRecentVoidedGroup([battle, complete])).toBeNull();
    // a COMPLETE newer than the void SHADOWS it — the void is no longer the member's
    // latest situation, so the card must NOT resurface (durable auto-expiry).
    expect(selectMyMostRecentVoidedGroup([voidedA, complete])).toBeNull();
    // but when the void IS the most-recent ranked group (older finishes behind it), it surfaces.
    const oldComplete = { id: 'oc', status: GROUP_STATUS.COMPLETE, updatedAt: '2026-08-01T00:00:00.000Z' };
    expect(selectMyMostRecentVoidedGroup([voidedB, oldComplete])?.id).toBe('vb');
  });

  it('DURABLE auto-expiry: a stale void does NOT resurface after a LATER group completes (§2 review finding fix)', () => {
    // void1 voided (T1); a later group forms and then COMPLETEs (T2 > T1). selectMyGroup
    // drops back to null (COMPLETE is not in the active allowlist), but the card must NOT
    // show the old void — the member's most-recent battle recorded a real result.
    const void1 = { id: 'v1', status: GROUP_STATUS.VOIDED, updatedAt: '2026-07-22T19:00:00.000Z' };
    const complete2 = { id: 'c2', status: GROUP_STATUS.COMPLETE, updatedAt: '2026-08-06T00:00:00.000Z' };
    expect(selectMyGroup([void1, complete2])).toBeNull();                 // no ACTIVE group
    expect(selectMyMostRecentVoidedGroup([void1, complete2])).toBeNull();  // …and no stale void card
  });

  it('excludes a training voided pod (the ranked-cohort void is the only surfaced kind)', () => {
    expect(selectMyMostRecentVoidedGroup([voidedTraining])).toBeNull();
    // a training void does not shadow a real ranked void either (training is out of this read entirely)
    expect(selectMyMostRecentVoidedGroup([voidedB, voidedTraining])?.id).toBe('vb');
  });

  it('returns null for no voids / empty / null input', () => {
    expect(selectMyMostRecentVoidedGroup([battle])).toBeNull();
    expect(selectMyMostRecentVoidedGroup([])).toBeNull();
    expect(selectMyMostRecentVoidedGroup(null)).toBeNull();
  });

  it('is COMPLEMENTARY to selectMyGroup and never leaks a void into the active read (inertness intact)', () => {
    // ONLY a void present: the active read is null (empty state) but the card read has content.
    expect(selectMyGroup([voidedB])).toBeNull();
    expect(selectMyMostRecentVoidedGroup([voidedB])?.id).toBe('vb');
    // an active BATTLE newer than the void: the active read picks the battle, and the
    // void is shadowed (a newer group exists) so the card read is null — the void never
    // reaches an active consumer, and the card won't compete with a live game.
    const newerBattle = { id: 'nb', status: GROUP_STATUS.BATTLE, updatedAt: '2026-08-09T00:00:00.000Z' };
    expect(selectMyGroup([voidedB, newerBattle])?.id).toBe('nb');
    expect(selectMyMostRecentVoidedGroup([voidedB, newerBattle])).toBeNull();
  });
});

describe('selectMyMostRecentCompletedGroup — the survives-the-bank recap read (twin of the voided read)', () => {
  const completeA = { id: 'ca', status: GROUP_STATUS.COMPLETE, updatedAt: '2026-07-22T19:00:00.000Z' };
  const completeB = { id: 'cb', status: GROUP_STATUS.COMPLETE, updatedAt: '2026-08-05T00:00:00.000Z' };
  const battle = { id: 'b', status: GROUP_STATUS.BATTLE, updatedAt: '2026-08-04T00:00:00.000Z' };
  const voided = { id: 'v', status: GROUP_STATUS.VOIDED, updatedAt: '2026-08-06T00:00:00.000Z' };
  const expired = { id: 'e', status: GROUP_STATUS.EXPIRED, updatedAt: '2026-08-06T00:00:00.000Z' };
  const completeTraining = { id: 'ct', status: GROUP_STATUS.COMPLETE, isTraining: true, updatedAt: '2026-08-07T00:00:00.000Z' };

  it('returns the MOST-RECENT completed ranked group (most-recently-updated wins)', () => {
    expect(selectMyMostRecentCompletedGroup([completeA, completeB])?.id).toBe('cb');
    expect(selectMyMostRecentCompletedGroup([completeB, completeA])?.id).toBe('cb');
  });

  it('surfaces the recap the instant a battle banks (BATTLE→COMPLETE is the latest situation)', () => {
    // A single ranked group that just completed: selectMyGroup drops to null
    // (COMPLETE not in the active allowlist) and the recap read picks it up.
    expect(selectMyGroup([completeB])).toBeNull();
    expect(selectMyMostRecentCompletedGroup([completeB])?.id).toBe('cb');
  });

  it('CLEARS the instant a newer group appears (durable auto-expiry — a forming/battle group shadows the recap)', () => {
    const newerForming = { id: 'nf', status: GROUP_STATUS.FORMING, updatedAt: '2026-08-09T00:00:00.000Z' };
    expect(selectMyMostRecentCompletedGroup([completeB, newerForming])).toBeNull();
    const newerBattle = { id: 'nb', status: GROUP_STATUS.BATTLE, updatedAt: '2026-08-09T00:00:00.000Z' };
    expect(selectMyMostRecentCompletedGroup([completeB, newerBattle])).toBeNull();
  });

  it('a VOIDED or EXPIRED most-recent group is NOT a completed recap (each has its own handling)', () => {
    // VOIDED has its own card; EXPIRED never climbed → no history. Neither surfaces here.
    expect(selectMyMostRecentCompletedGroup([completeA, voided])).toBeNull();
    expect(selectMyMostRecentCompletedGroup([completeA, expired])).toBeNull();
    // but an OLDER void/expired behind a completed group does not shadow it.
    const oldVoided = { id: 'ov', status: GROUP_STATUS.VOIDED, updatedAt: '2026-08-01T00:00:00.000Z' };
    expect(selectMyMostRecentCompletedGroup([completeB, oldVoided])?.id).toBe('cb');
  });

  it('excludes a training completed pod (the ranked recap is the only surfaced kind)', () => {
    expect(selectMyMostRecentCompletedGroup([completeTraining])).toBeNull();
    expect(selectMyMostRecentCompletedGroup([completeB, completeTraining])?.id).toBe('cb');
  });

  it('returns null for no completions / empty / null input', () => {
    expect(selectMyMostRecentCompletedGroup([battle])).toBeNull();
    expect(selectMyMostRecentCompletedGroup([])).toBeNull();
    expect(selectMyMostRecentCompletedGroup(null)).toBeNull();
  });

  it('is COMPLEMENTARY to selectMyGroup and never leaks a completed group into the active read (inertness intact)', () => {
    expect(selectMyGroup([completeB])).toBeNull();
    expect(selectMyMostRecentCompletedGroup([completeB])?.id).toBe('cb');
    // an active BATTLE newer than the completion: active read picks the battle; recap read
    // is null (the completed group is shadowed) — the completion never reaches an active
    // consumer, and the recap won't compete with a live game.
    const newerBattle = { id: 'nb', status: GROUP_STATUS.BATTLE, updatedAt: '2026-08-09T00:00:00.000Z' };
    expect(selectMyGroup([completeB, newerBattle])?.id).toBe('nb');
    expect(selectMyMostRecentCompletedGroup([completeB, newerBattle])).toBeNull();
  });

  it('the completed and voided reads are mutually exclusive on the same most-recent group', () => {
    // Whichever terminal state the most-recent ranked group is in, only ONE read returns it.
    expect(selectMyMostRecentCompletedGroup([completeB])?.id).toBe('cb');
    expect(selectMyMostRecentVoidedGroup([completeB])).toBeNull();
    expect(selectMyMostRecentVoidedGroup([voided])?.id).toBe('v');
    expect(selectMyMostRecentCompletedGroup([voided])).toBeNull();
  });
});

describe('voidReasonLabel + VOIDED_NO_RESULT_COPY — the §9 single-source reason projection', () => {
  it('projects a KNOWN void code to its human one-line reason', () => {
    const label = voidReasonLabel({ voidedReason: 'poisoned_cohort_l_a' });
    expect(label).toBe(VOID_REASON_LABELS.poisoned_cohort_l_a);
    expect(label).toContain('quarantined');
  });

  it('accepts either the group doc or the raw code (reads the SAME voidedReason datum)', () => {
    expect(voidReasonLabel('poisoned_cohort_l_a')).toBe(voidReasonLabel({ voidedReason: 'poisoned_cohort_l_a' }));
  });

  it('falls back safely for a null / missing / unknown reason (datum stays voidedReason; only the copy defaults)', () => {
    const fallback = 'This battle was voided by the League.';
    expect(voidReasonLabel({ voidedReason: null })).toBe(fallback);
    expect(voidReasonLabel({})).toBe(fallback);
    expect(voidReasonLabel(null)).toBe(fallback);
    expect(voidReasonLabel({ voidedReason: 'some_future_code_not_yet_mapped' })).toBe(fallback);
  });

  it('the shared no-result headline is the one used by the arena top-strip (§9 one source)', () => {
    expect(VOIDED_NO_RESULT_COPY).toBe('Battle voided — no result recorded');
  });
});

describe('casualDeployMissesPodSession — the G2 honest-warning window test', () => {
  const anchoredPod = (status, anchorEtDate) => ({
    id: 'p1', status,
    battleStartWeek: { anchorEtDate, mondayEtDate: anchorEtDate, anchorIso: `${anchorEtDate}T13:30:00.000Z` },
    updatedAt: '2026-06-13T22:00:00Z',
  });

  it('pre-battle pod: a casual deploy whose fullday expiry reaches the Monday anchor CONFLICTS', () => {
    const pod = anchoredPod(GROUP_STATUS.AWAITING_OPEN, '2026-06-15'); // Monday anchor
    // Fri-after-close / weekend deploy → 'fullday' expiry rolls to Monday 2026-06-15 (same date as the anchor).
    expect(casualDeployMissesPodSession(pod, { expiryEtDate: '2026-06-15', nextTradingEtDate: '2026-06-15' })).toBe(true);
  });

  it('pre-battle pod: a mid-week casual deploy that expires before the anchor is SAFE', () => {
    const pod = anchoredPod(GROUP_STATUS.AWAITING_OPEN, '2026-06-15');
    // Wednesday deploy → expires Wed 2026-06-10, days before the Monday anchor.
    expect(casualDeployMissesPodSession(pod, { expiryEtDate: '2026-06-10', nextTradingEtDate: '2026-06-11' })).toBe(false);
  });

  it('pre-battle FORMING/DRAFTING use the anchor exactly like AWAITING_OPEN', () => {
    expect(casualDeployMissesPodSession(anchoredPod(GROUP_STATUS.FORMING, '2026-06-15'), { expiryEtDate: '2026-06-15' })).toBe(true);
    expect(casualDeployMissesPodSession(anchoredPod(GROUP_STATUS.DRAFTING, '2026-06-15'), { expiryEtDate: '2026-06-12' })).toBe(false);
  });

  it('BATTLE pod: uses the next trading day — a casual deploy that survives to it CONFLICTS', () => {
    const pod = { id: 'b1', status: GROUP_STATUS.BATTLE, updatedAt: '2026-06-15T22:00:00Z' };
    // After-close deploy: expiry rolls to Tue 06-16 == the next session → conflict.
    expect(casualDeployMissesPodSession(pod, { expiryEtDate: '2026-06-16', nextTradingEtDate: '2026-06-16' })).toBe(true);
    // Mid-session (market open): casual expires today 06-16, next session is 06-17 → no conflict.
    expect(casualDeployMissesPodSession(pod, { expiryEtDate: '2026-06-16', nextTradingEtDate: '2026-06-17' })).toBe(false);
  });

  it('never warns: no group, a training pod, a completed pod, or missing dates', () => {
    expect(casualDeployMissesPodSession(null, { expiryEtDate: '2026-06-15' })).toBe(false);
    expect(casualDeployMissesPodSession({ status: GROUP_STATUS.BATTLE, isTraining: true }, { expiryEtDate: '2026-06-16', nextTradingEtDate: '2026-06-16' })).toBe(false);
    expect(casualDeployMissesPodSession({ id: 'c', status: GROUP_STATUS.COMPLETE }, { expiryEtDate: '2026-06-15', nextTradingEtDate: '2026-06-15' })).toBe(false);
    expect(casualDeployMissesPodSession(anchoredPod(GROUP_STATUS.AWAITING_OPEN, '2026-06-15'), {})).toBe(false); // no expiry date
    expect(casualDeployMissesPodSession({ id: 'p', status: GROUP_STATUS.FORMING }, { expiryEtDate: '2026-06-15' })).toBe(false); // no anchor
  });
});

describe('selectMyTrainingPod — the re-entry read + the server already_active guard (one predicate, both sides)', () => {
  const drafting = { id: 't1', status: GROUP_STATUS.DRAFTING, isTraining: true, updatedAt: '2026-06-15T09:00:00Z' };
  const awaiting = { id: 't2', status: GROUP_STATUS.AWAITING_OPEN, isTraining: true, updatedAt: '2026-06-15T10:00:00Z' };
  const battle = { id: 't3', status: GROUP_STATUS.BATTLE, isTraining: true, updatedAt: '2026-06-15T11:00:00Z' };
  const rankedBattle = { id: 'g1', status: GROUP_STATUS.BATTLE, updatedAt: '2026-06-15T23:00:00Z' };

  it('matches a training pod in any in-flight status (DRAFTING/AWAITING_OPEN/BATTLE)', () => {
    expect(selectMyTrainingPod([drafting])?.id).toBe('t1');
    expect(selectMyTrainingPod([awaiting])?.id).toBe('t2');
    expect(selectMyTrainingPod([battle])?.id).toBe('t3');
  });

  it('excludes a ranked group (isTraining not true) AND a COMPLETE training pod', () => {
    expect(selectMyTrainingPod([rankedBattle])).toBeNull();
    expect(selectMyTrainingPod([{ id: 'x', status: GROUP_STATUS.COMPLETE, isTraining: true }])).toBeNull();
    expect(selectMyTrainingPod([])).toBeNull();
    expect(selectMyTrainingPod(null)).toBeNull();
  });

  it('picks the most-recently-updated active pod (the re-entry target / guard subject)', () => {
    expect(selectMyTrainingPod([drafting, awaiting, battle]).id).toBe('t3');
  });
});

describe('selectBaseLayerField — THE FIELD read EXCLUDES training pods AND never lets one consume a cap slot', () => {
  // Mirrors selectMyGroup: base-layer groups (Quick Play / isTraining:false or the
  // flag OMITTED) count; training pods (isTraining:true) do not. CPUs carry no
  // isTraining flag, so they stay by design (absolute-score, harmless).
  const ranked = (id, updatedAt) => ({ id, baseLayerWeek: '2026-W27', updatedAt });
  const training = (id, updatedAt) => ({ id, baseLayerWeek: '2026-W27', isTraining: true, updatedAt });

  it('THE GATE: a training pod never appears; a base-layer group does — even when the training pod is newer', () => {
    const t = training('t1', '2026-06-15T23:00:00Z'); // newest of the two
    const r = ranked('g1', '2026-06-15T10:00:00Z');
    expect(selectBaseLayerField([t, r], 12).map(g => g.id)).toEqual(['g1']);
    // training-only → [] (nothing field-eligible, NOT the training pod)
    expect(selectBaseLayerField([t], 12)).toEqual([]);
  });

  it('mirrors the selectMyGroup `!== true` idiom: a flag-OMITTING doc AND an explicit isTraining:false both COUNT (Quick Play stays)', () => {
    const omitted = { id: 'g1', updatedAt: '2026-06-15T10:00:00Z' };                       // no isTraining field
    const explicitFalse = { id: 'g2', isTraining: false, updatedAt: '2026-06-15T09:00:00Z' }; // Quick Play
    expect(selectBaseLayerField([omitted, explicitFalse], 12).map(g => g.id).sort()).toEqual(['g1', 'g2']);
  });

  it('CPUs stay: a base-layer group carrying CPU seats (no isTraining flag) is field-eligible — CPU inclusion is unchanged', () => {
    const withCpus = { id: 'g1', groupMembers: ['u1', 'cpu-1', 'u2', 'cpu-2'], updatedAt: '2026-06-15T10:00:00Z' };
    expect(selectBaseLayerField([withCpus], 12).map(g => g.id)).toEqual(['g1']);
  });

  it('THE SLOT: training pods do NOT consume cap slots — all 12 real groups survive even when 10 NEWER training pods are present', () => {
    // 12 real base-layer groups, older...
    const reals = Array.from({ length: 12 }, (_, i) =>
      ranked(`g${i}`, `2026-06-15T08:${String(i).padStart(2, '0')}:00Z`));
    // ...plus 10 training pods, every one NEWER than every real group.
    const trainings = Array.from({ length: 10 }, (_, i) =>
      training(`t${i}`, `2026-06-15T23:${String(i).padStart(2, '0')}:00Z`));
    const out = selectBaseLayerField([...trainings, ...reals], 12);
    // filter-BEFORE-cap: had the cap run first (the bug), the 10 newer training
    // pods would take 10 of 12 slots, leaving only 2 real groups.
    expect(out).toHaveLength(12);
    expect(out.every(g => g.isTraining !== true)).toBe(true);
    expect(out.map(g => g.id).sort()).toEqual(reals.map(g => g.id).sort());
  });

  it('caps to `max` by recency AFTER filtering (the most-recent real groups win the slots)', () => {
    const a = ranked('a', '2026-06-15T08:00:00Z');
    const b = ranked('b', '2026-06-15T12:00:00Z'); // newest real
    const c = ranked('c', '2026-06-15T10:00:00Z');
    expect(selectBaseLayerField([a, b, c], 2).map(g => g.id)).toEqual(['b', 'c']); // 'a' dropped
  });

  it('empty / null / undefined → []', () => {
    expect(selectBaseLayerField([], 12)).toEqual([]);
    expect(selectBaseLayerField(null, 12)).toEqual([]);
    expect(selectBaseLayerField(undefined)).toEqual([]);
  });

  it('BASE_LAYER_FIELD_OVERFETCH gives the client filter headroom — a ~24-30 read window for the default 12-slot field', () => {
    const window = Math.ceil(12 * BASE_LAYER_FIELD_OVERFETCH);
    expect(window).toBeGreaterThanOrEqual(24);
    expect(window).toBeLessThanOrEqual(30);
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

// ==================== L-B Guard 2 — the scoped result-read clamp ====================
//
// THE INVARIANT (L-B spec): a week's result must be the WEEK's result regardless
// of what extra days exist in the doc. The REAL zombie shape: the voided cohort
// lds_wed-1900_2026-07-22 banked day1–day8 (three days past its end), so every
// latest-day result read silently returned the contaminated day8. These are the
// red-first tests: getWeeklyComposite/getWeeklyScore/isFinalSnapshotDegraded
// returned day8 values before the clamp.
//
// Fixture provenance: the SEAT and the day5/day8 compositePoints (−344 / −469.5)
// are the REAL values from the voided group (L-B spec). The user/agent layer
// split was not captured in discovery, so those are SYNTHETIC — chosen to
// satisfy the one-k identity (composite = agentPoints + 1.5 × totalPoints):
// day5 −164 + 1.5×(−120) = −344; day8 −207 + 1.5×(−175) = −469.5.

const ZOMBIE_SEAT = '7ML6i7WyfuaAtJjl16Smh2kETPw1';

/** The real zombie doc shape: day1–day8 present, day5 = the week's result.
 * recordedDates follow the real cohort's trading calendar (fired Wed 2026-07-22:
 * days 1–5 = Wed–Tue 22,23,24,27,28; zombie days 6–8 = 29,30,31 — review B's
 * chronology note). */
function zombieGroup({ day5Carried = false, day8Carried = false } = {}) {
  const ZOMBIE_DATES = { 1: '2026-07-22', 2: '2026-07-23', 3: '2026-07-24', 4: '2026-07-27', 6: '2026-07-29', 7: '2026-07-30' };
  const filler = (n) => ({
    closeScores: { [ZOMBIE_SEAT]: { totalPoints: -10 * n, agentPoints: -5 * n, compositePoints: -20 * n } },
    recordedDate: ZOMBIE_DATES[n],
  });
  return {
    status: 'voided',
    dailyScores: {
      day1: filler(1), day2: filler(2), day3: filler(3), day4: filler(4),
      day5: {
        closeScores: { [ZOMBIE_SEAT]: { totalPoints: -120, agentPoints: -164, compositePoints: -344 } },
        recordedDate: '2026-07-28',
        ...(day5Carried ? { agentScoresCarried: true } : {}),
      },
      day6: filler(6), day7: filler(7),
      day8: {
        closeScores: { [ZOMBIE_SEAT]: { totalPoints: -175, agentPoints: -207, compositePoints: -469.5 } },
        recordedDate: '2026-07-31',
        ...(day8Carried ? { agentScoresCarried: true } : {}),
      },
    },
  };
}

describe('L-B Guard 2 — result reads return the WEEK, not the contaminated latest day', () => {
  it('getWeeklyComposite on the real zombie shape returns the day5 record (−344), never day8 (−469.5)', () => {
    expect(getWeeklyComposite(zombieGroup(), ZOMBIE_SEAT)).toBe(-344);
  });

  it('getWeeklyScore returns the day5 user layer, never day8 (synthetic split, one-k-consistent)', () => {
    expect(getWeeklyScore(zombieGroup(), ZOMBIE_SEAT)).toBe(-120);
  });

  it('F-1 danger direction: day5 CARRIED + day8 clean → isFinalSnapshotDegraded TRUE (the §7.2 gate must consult the week\'s final snapshot — a permanent lock over a degraded score of record is unrecoverable)', () => {
    expect(isFinalSnapshotDegraded(zombieGroup({ day5Carried: true }))).toBe(true);
  });

  it('F-1 reverse: day5 clean + day8 carried → FALSE (day8 is not the week\'s snapshot)', () => {
    expect(isFinalSnapshotDegraded(zombieGroup({ day8Carried: true }))).toBe(false);
  });

  it('doubly-pathological edge: a doc with ONLY day6+ has NO in-week result → 0 (intended semantics)', () => {
    // INTENDED SEMANTICS (founder-ruled): no day ≤ WEEK_DAYS_REQUIRED exists, so
    // "the week's result" does not exist — the 0 is the honest "no in-week result
    // recorded", NOT a swallowed bug. A doc like this can only arise from a
    // pathological write path (the real flow banks day1 first); returning day7's
    // value would re-assert exactly the contamination this clamp exists to stop.
    const only7 = { dailyScores: { day7: { closeScores: { [ZOMBIE_SEAT]: { totalPoints: -9, agentPoints: -9, compositePoints: -22.5 } }, recordedDate: '2026-07-30' } } };
    expect(getWeeklyComposite(only7, ZOMBIE_SEAT)).toBe(0);
    expect(getWeeklyScore(only7, ZOMBIE_SEAT)).toBe(0);
    expect(isFinalSnapshotDegraded(only7)).toBe(false);
  });

  it('clamp no-op on well-formed docs: a mid-week day-3 doc reads day3 exactly as before', () => {
    const day3 = {
      dailyScores: {
        day1: { closeScores: { u1: { totalPoints: 4, agentPoints: 2, compositePoints: 8 } }, recordedDate: '2026-08-03' },
        day2: { closeScores: { u1: { totalPoints: 6, agentPoints: 3, compositePoints: 12 } }, recordedDate: '2026-08-04' },
        day3: { closeScores: { u1: { totalPoints: 10, agentPoints: 5, compositePoints: 20 } }, recordedDate: '2026-08-05' },
      },
    };
    expect(getWeeklyComposite(day3, 'u1')).toBe(20);
    expect(getWeeklyScore(day3, 'u1')).toBe(10);
  });
});

describe('getLatestBankedDayEntry — the clamped helper contract', () => {
  it('selects day5 on the zombie (the week), day8 on the primitive (the doc) — the deliberate contrast', () => {
    const z = zombieGroup();
    expect(getLatestBankedDayEntry(z)).toEqual({ dayN: 5, entry: z.dailyScores.day5 });
    expect(getLatestDayEntry(z)).toEqual({ dayN: 8, entry: z.dailyScores.day8 });
  });

  it('agrees with getLatestDayEntry on every well-formed doc (the clamp-safety identity)', () => {
    const day3 = { dailyScores: {
      day1: { closeScores: {}, recordedDate: 'a' },
      day3: { closeScores: {}, recordedDate: 'b' }, // gap allowed, like the primitive
    } };
    expect(getLatestBankedDayEntry(day3)).toEqual(getLatestDayEntry(day3));
    expect(getLatestBankedDayEntry({ dailyScores: {} })).toBeNull();
    expect(getLatestBankedDayEntry(null)).toBeNull();
  });

  it('a doc with ONLY day6+ has no in-week entry → null (the callers surface 0 / not-degraded)', () => {
    expect(getLatestBankedDayEntry({ dailyScores: { day7: { closeScores: {}, recordedDate: 'x' } } })).toBeNull();
  });

  it('maxDay is overridable (the spec-shaped option bag), defaulting to WEEK_DAYS_REQUIRED', () => {
    const z = zombieGroup();
    expect(getLatestBankedDayEntry(z, { maxDay: 7 })?.dayN).toBe(7);
    expect(getLatestBankedDayEntry(z, {})?.dayN).toBe(5);
  });
});

describe('L-B Guard 2 — live derivation is UNCLAMPED (the crux non-regression)', () => {
  it('getLatestDayEntry still reads the doc truth on the zombie (day 8) — the primitive is deliberately unclamped', () => {
    expect(getLatestDayEntry(zombieGroup())?.dayN).toBe(8);
  });

  it('deriveCurrentTradingDay keeps live claims-window semantics on the doc truth (day 9 next)', () => {
    expect(deriveCurrentTradingDay(zombieGroup(), '2026-08-06')).toBe(9);
    // and the banked-today arm on a well-formed doc is untouched
    const day3 = { dailyScores: { day3: { closeScores: {}, recordedDate: '2026-08-05' } } };
    expect(deriveCurrentTradingDay(day3, '2026-08-05')).toBe(3);
    expect(deriveCurrentTradingDay(day3, '2026-08-06')).toBe(4);
  });

  it('isWeekBanked reads the clamped entry (review A-F1): true on the zombie (day5 exists), false mid-week', () => {
    expect(isWeekBanked(zombieGroup())).toBe(true);
    expect(isWeekBanked({ dailyScores: { day3: { closeScores: {}, recordedDate: 'x' } } })).toBe(false);
  });

  it('A-F1: the only-day6+ shape reads banking-PENDING, so the §7.2 pipeline can never lock its zeros', () => {
    // Review finding A-F1 (executed repro): unclamped, isWeekBanked said true
    // (7 ≥ 5) while the clamped readers said "no in-week result" — the two
    // halves of the advancement gate disagreed, and lockTopTwo would have
    // permanently locked an all-zero result. Clamped, gate and readers share
    // ONE definition of the week's final snapshot: no in-week day → not banked
    // → a loud, recoverable banking-pending pause (over-blocking is
    // recoverable; permitting is not — the F-1 rationale, completed).
    const only7 = { dailyScores: { day7: { closeScores: {}, recordedDate: 'x', agentScoresCarried: true } } };
    expect(isWeekBanked(only7)).toBe(false);
  });
});
