// api/_utils/tournamentCpu.test.js
//
// P3b battery for the CPU system-agent machinery (Ruling B1, specifics
// ratified June 12, 2026). Blocks: the system agents-doc shape (ownerId
// marker, isCpu, deterministic archetype), lazy get-or-create idempotency,
// per-round-unique seat numbering, and the user-board commit through the
// REAL board-commit core.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): this file's real import of
// tournamentCpu.js IS the runtime guard that its transitive import surface
// (src/constants/leagueTournament.js, the fenced agentArchetypeConfig
// exports) stays Node-clean. Never mock that import.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  buildCpuAgentDoc,
  ensureCpuAgents,
  commitCpuUserBoards,
  padGamesWithCpus,
} from './tournamentCpu.js';
import {
  GROUP_SIZE,
  TOURNAMENT_TUNING,
  cpuArchetypeForN,
  buildCpuUserBoard,
} from '../../src/constants/leagueTournament.js';
import { VALID_ARCHETYPES } from './agentArchetypeConfig.js';

const NOW_ISO = '2026-06-15T12:00:00.000Z';

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

// In-memory Firestore (the P3a makeDb idiom).
function makeDb(initial = {}) {
  const store = new Map(Object.entries(initial));
  const writes = [];
  function makeDocRef(path) {
    return {
      path,
      get: async () => {
        const data = store.get(path);
        return { exists: data !== undefined, id: path.split('/').pop(), data: () => data };
      },
      set: async (data) => { store.set(path, data); writes.push(path); },
      collection: (sub) => makeCollection(`${path}/${sub}`),
    };
  }
  function makeCollection(prefix) {
    return { doc: (id) => makeDocRef(`${prefix}/${id}`) };
  }
  return { db: { collection: (name) => makeCollection(name) }, store, writes };
}

describe('buildCpuAgentDoc — the system agents-doc shape', () => {
  it('carries the two ratified markers + the deterministic archetype', () => {
    const doc = buildCpuAgentDoc(3, NOW_ISO);
    expect(doc.ownerId).toBe('cpu-3');
    expect(doc.isCpu).toBe(true);
    expect(doc.archetype).toBe(cpuArchetypeForN(3));
    expect(VALID_ARCHETYPES).toContain(doc.archetype);
    expect(doc.name).toMatch(/^CPU — /);
  });

  it('neutral createAgent-shape fields: no equip, empty memory/rules, zeroed stats', () => {
    const doc = buildCpuAgentDoc(1, NOW_ISO);
    expect(doc.equippedWatchlistId).toBeNull();
    expect(doc.activeRules).toEqual([]);
    expect(doc.memory).toEqual([]);
    expect(doc.consolidatedInsight).toBe('');
    expect(doc.stats.gamesPlayed).toBe(0);
    expect(doc.evolutionCycle).toBe(0);
    expect(doc.createdAt).toBe(NOW_ISO);
  });

  it('config sliders come from the archetype defaults (0-100)', () => {
    for (const n of [1, 2, 3, 4, 5, 6]) {
      const { risk, concentration, momentum } = buildCpuAgentDoc(n, NOW_ISO).config;
      for (const v of [risk, concentration, momentum]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe('ensureCpuAgents — lazy get-or-create', () => {
  it('creates missing docs at deterministic ids and never rewrites existing ones', async () => {
    const existing = buildCpuAgentDoc(1, '2026-01-01T00:00:00.000Z');
    const { db, store, writes } = makeDb({ 'agents/cpu-agent-1': existing });

    const result = await ensureCpuAgents(db, [1, 2], NOW_ISO);
    expect(result.existing).toEqual([1]);
    expect(result.created).toEqual([2]);
    expect(store.get('agents/cpu-agent-1')).toBe(existing); // untouched — archetype permanent
    expect(store.get('agents/cpu-agent-2').ownerId).toBe('cpu-2');
    expect(writes).toEqual(['agents/cpu-agent-2']);

    // Re-run: full no-op.
    const again = await ensureCpuAgents(db, [1, 2], NOW_ISO);
    expect(again.created).toEqual([]);
    expect(writes).toHaveLength(1);
  });
});

describe('padGamesWithCpus — per-round-unique seat numbering', () => {
  it('pads each game to GROUP_SIZE, numbering sequentially across games', () => {
    const { seatsByGame, cpuNs } = padGamesWithCpus([['founder'], []]);
    expect(seatsByGame[0]).toHaveLength(GROUP_SIZE);
    expect(seatsByGame[1]).toHaveLength(GROUP_SIZE);
    expect(seatsByGame[0].map(s => s.odUserId)).toEqual(['founder', 'cpu-1', 'cpu-2', 'cpu-3']);
    expect(seatsByGame[1].map(s => s.odUserId)).toEqual(['cpu-4', 'cpu-5', 'cpu-6', 'cpu-7']);
    expect(seatsByGame[0][0].isCpu).toBe(false);
    expect(seatsByGame[0][1].isCpu).toBe(true);
    expect(cpuNs).toEqual([1, 2, 3, 4, 5, 6, 7]);
    // Uniqueness within the round — the one-battle-per-agent constraint.
    expect(new Set(seatsByGame.flat().map(s => s.odUserId)).size).toBe(8);
  });

  it('startN offsets fresh padding past advancing CPU identities', () => {
    const { seatsByGame } = padGamesWithCpus([['u1', 'cpu-2', 'u2']], { startN: 3 });
    expect(seatsByGame[0].map(s => s.odUserId)).toEqual(['u1', 'cpu-2', 'u2', 'cpu-3']);
  });

  it('full games take no padding; over-full games throw', () => {
    const { seatsByGame, cpuNs } = padGamesWithCpus([['a', 'b', 'c', 'd']]);
    expect(seatsByGame[0].every(s => !s.isCpu)).toBe(true);
    expect(cpuNs).toEqual([]);
    expect(() => padGamesWithCpus([['a', 'b', 'c', 'd', 'e']])).toThrow(/real seats/);
  });
});

describe('commitCpuUserBoards — through the REAL board-commit core', () => {
  const POOL = Array.from({ length: 40 }, (_, i) => `SYM${i}`);
  const group = {
    id: 'b-r1-g1',
    status: 'forming',
    roundNumber: 1,
    bracketGameId: 'b-r1-g1',
    userPool: POOL,
    groupMembers: ['founder', 'cpu-1', 'cpu-2', 'cpu-3'],
    players: [
      { odUserId: 'founder', picks: [] },
      { odUserId: 'cpu-1', picks: [], isCpu: true },
      { odUserId: 'cpu-2', picks: [], isCpu: true },
      { odUserId: 'cpu-3', picks: [], isCpu: true },
    ],
  };

  it('derives CPU seats from players[].isCpu + the id codec; rider-#1 shape + provenance; deterministic slice', async () => {
    const { db, store } = makeDb();
    const result = await commitCpuUserBoards(db, group, NOW_ISO);
    expect(result.committed).toEqual(['cpu-1', 'cpu-2', 'cpu-3']);
    expect(result.failed).toEqual([]);
    expect(store.get('tournamentGroups/b-r1-g1/boards/founder')).toBeUndefined(); // humans commit their own

    const doc = store.get('tournamentGroups/b-r1-g1/boards/cpu-1');
    expect(doc.isCpu).toBe(true);
    expect(doc.odUserId).toBe('cpu-1');
    expect(doc.board).toEqual(buildCpuUserBoard(POOL, 1));
    expect(doc.board).toHaveLength(TOURNAMENT_TUNING.BOARD_DEPTH_MIN);
    expect(doc.bracketGameId).toBe('b-r1-g1');
    expect(doc.committedAt).toBe(NOW_ISO);
    expect(Array.isArray(doc.delta)).toBe(true); // the real core ran (rider #1)
    // Slice stagger: cpu-2's board starts 3 ranks deeper.
    expect(store.get('tournamentGroups/b-r1-g1/boards/cpu-2').board[0]).toBe('SYM3');
  });

  it('is idempotent per member: existing board docs are left alone', async () => {
    const { db, store, writes } = makeDb({
      'tournamentGroups/b-r1-g1/boards/cpu-1': { odUserId: 'cpu-1', board: ['KEEP'], isCpu: true },
    });
    const result = await commitCpuUserBoards(db, group, NOW_ISO);
    expect(result.skipped).toEqual(['cpu-1']);
    expect(result.committed).toEqual(['cpu-2', 'cpu-3']);
    expect(store.get('tournamentGroups/b-r1-g1/boards/cpu-1').board).toEqual(['KEEP']);
    expect(writes).toEqual(['tournamentGroups/b-r1-g1/boards/cpu-2', 'tournamentGroups/b-r1-g1/boards/cpu-3']);
  });

  it('an unparseable CPU id is a LOUD failure, never a silent skip (the misdiagnosed-finding-#5 trap)', async () => {
    const { db, store } = makeDb();
    const drifted = {
      ...group,
      players: [
        { odUserId: 'founder', picks: [] },
        { odUserId: 'cpu-zero-pad-01', picks: [], isCpu: true }, // id-codec drift
        { odUserId: 'cpu-2', picks: [], isCpu: true },
        { odUserId: 'cpu-3', picks: [], isCpu: true },
      ],
    };
    const result = await commitCpuUserBoards(db, drifted, NOW_ISO);
    expect(result.failed).toEqual(['cpu-zero-pad-01']);
    expect(result.committed).toEqual(['cpu-2', 'cpu-3']);
    expect(store.get('tournamentGroups/b-r1-g1/boards/cpu-zero-pad-01')).toBeUndefined();
    expect(console.error.mock.calls.map(c => c.join(' ')).some(l => l.includes('id-codec drift'))).toBe(true);
  });

  it('refuses a non-forming group (the real core validates — never the seeder path)', async () => {
    const { db } = makeDb();
    await expect(commitCpuUserBoards(db, { ...group, status: 'battle' }, NOW_ISO))
      .rejects.toThrow(/not_forming/);
  });
});
