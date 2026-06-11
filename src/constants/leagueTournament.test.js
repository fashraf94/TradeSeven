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
  LEDGER_SOURCE,
  TOURNAMENT_TUNING,
  createClaimSystemState,
  createLeg,
  createPickState,
  createAgentLedgerEntry,
  createTournamentGroupDoc,
} from './leagueTournament.js';
// Real import, zero mocks (precedent: api/cron/process-draft-claims.test.js:10).
// This is the behavioral half of the claimSystem parity guard.
import { isAlreadyProcessedForDay } from '../../api/cron/process-draft-claims.js';

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
    expect(Object.isFrozen(LEDGER_SOURCE)).toBe(true);
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
  const args = { baselinePrice: 187.5, baselineSource: 'market_open', openedAt: NOW };

  it('defaults long, fresh thresholdHistory, closed-state keys omitted', () => {
    const leg = createLeg(args);
    expect(leg).toEqual({
      direction: 'long',
      baselinePrice: 187.5,
      baselineSource: 'market_open',
      openedAt: NOW,
      thresholdHistory: [],
    });
    expect('closedAt' in leg).toBe(false);
    expect('bankedScore' in leg).toBe(false);
  });

  it('accepts short; null baselinePrice (market-closed open) is valid', () => {
    expect(createLeg({ ...args, direction: LEG_DIRECTION.SHORT }).direction).toBe('short');
    expect(createLeg({ ...args, baselinePrice: null }).baselinePrice).toBeNull();
  });

  it('rejects invalid shapes', () => {
    expect(() => createLeg({ ...args, direction: 'sideways' })).toThrow(/direction/);
    expect(() => createLeg({ ...args, baselineSource: '' })).toThrow(/baselineSource/);
    expect(() => createLeg({ ...args, openedAt: undefined })).toThrow(/openedAt/);
    expect(() => createLeg({ ...args, baselinePrice: 'NaN-ish' })).toThrow(/baselinePrice/);
  });
});

describe('createPickState', () => {
  const args = { symbol: 'nvda', baselineSource: 'market_open', baselinePrice: 187.5, openedAt: NOW };

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
      agentLedger: {},
      createdAt: NOW,
      updatedAt: NOW,
    });
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
