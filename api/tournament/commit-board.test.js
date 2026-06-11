// api/tournament/commit-board.test.js
//
// Board-commit validation + rider-#1 doc-shape tests over the pure core.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the import of the REAL
// commit-board module below is the runtime guard for its api/ -> src/ import
// chain (src/constants/leagueTournament.js via tournamentGroupService) — it
// explodes in this Node test environment if a browser-only dependency ever
// enters the graph. Never mock this import.

import { describe, it, expect } from 'vitest';
import { buildBoardCommit, computeBoardDelta } from './commit-board.js';

const NOW = '2026-06-15T13:30:00.000Z';

// 20-name draftable pool; boards below rank subsets of it.
const POOL = [
  'NVDA', 'AMD', 'TSLA', 'META', 'AAPL', 'MSFT', 'AMZN', 'GOOG', 'NFLX', 'AVGO',
  'CRM', 'ORCL', 'ADBE', 'COIN', 'PLTR', 'SHOP', 'SQ', 'UBER', 'ABNB', 'SNOW',
];
const BOARD_15 = POOL.slice(0, 15);

function makeGroup(overrides = {}) {
  return {
    status: 'forming',
    roundNumber: 1,
    baseLayerWeek: '2026-W25',
    userPool: [...POOL],
    players: [
      { odUserId: 'user-a', picks: [] },
      { odUserId: 'user-b', picks: [] },
      { odUserId: 'user-c', picks: [] },
      { odUserId: 'user-d', picks: [] },
    ],
    ...overrides,
  };
}

function commitArgs(overrides = {}) {
  return {
    group: makeGroup(),
    odUserId: 'user-a',
    board: [...BOARD_15],
    prefillAsSuggested: [],
    now: NOW,
    ...overrides,
  };
}

// ==================== RIDER #1 DOC SHAPE ====================

describe('buildBoardCommit — rider event #1 shape (Addendum A §4 row 1)', () => {
  it('carries board, prefill-as-suggested, per-name delta, round + group context', () => {
    const prefill = ['NVDA', 'AMD', 'TSLA'];
    const doc = buildBoardCommit(commitArgs({ prefillAsSuggested: prefill }));
    expect(doc).toEqual({
      odUserId: 'user-a',
      board: BOARD_15,
      prefillAsSuggested: prefill,
      delta: computeBoardDelta(prefill, BOARD_15),
      roundNumber: 1,
      baseLayerWeek: '2026-W25',
      committedAt: NOW,
    });
  });

  it('bracket groups carry bracketGameId instead of baseLayerWeek', () => {
    const group = makeGroup({ baseLayerWeek: undefined, bracketGameId: 'bracket-r2-g7' });
    const doc = buildBoardCommit(commitArgs({ group }));
    expect(doc.bracketGameId).toBe('bracket-r2-g7');
    expect('baseLayerWeek' in doc).toBe(false);
  });

  it('normalizes symbols (uppercase/trim) and dedupes the prefill snapshot', () => {
    const doc = buildBoardCommit(commitArgs({
      board: BOARD_15.map(s => ` ${s.toLowerCase()} `),
      prefillAsSuggested: ['nvda', 'NVDA', 'amd'],
    }));
    expect(doc.board).toEqual(BOARD_15);
    expect(doc.prefillAsSuggested).toEqual(['NVDA', 'AMD']);
  });
});

// ==================== VALIDATION ====================

describe('buildBoardCommit — validation', () => {
  it('depth gate: 15-20 names (TOURNAMENT_TUNING.BOARD_DEPTH_MIN/MAX)', () => {
    expect(() => buildBoardCommit(commitArgs({ board: POOL.slice(0, 14) }))).toThrow(/invalid_board/);
    expect(() => buildBoardCommit(commitArgs({ board: [...POOL, 'XXXX'] }))).toThrow(/invalid_board/);
    expect(() => buildBoardCommit(commitArgs({ board: POOL.slice(0, 20) }))).not.toThrow();
  });

  it('rejects duplicates — ranks must be unambiguous', () => {
    const board = [...BOARD_15.slice(0, 14), 'NVDA'];
    expect(() => buildBoardCommit(commitArgs({ board }))).toThrow(/invalid_board/);
  });

  it('every name must be in the group userPool (pool exclusivity source)', () => {
    const board = [...BOARD_15.slice(0, 14), 'ZZZZ'];
    try {
      buildBoardCommit(commitArgs({ board }));
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err.message).toMatch(/invalid_board/);
      expect(err.detail).toMatch(/ZZZZ/);
    }
  });

  it('rejects non-string entries', () => {
    expect(() => buildBoardCommit(commitArgs({ board: [...BOARD_15.slice(0, 14), 42] }))).toThrow(/invalid_board/);
    expect(() => buildBoardCommit(commitArgs({ board: 'NVDA' }))).toThrow(/invalid_board/);
  });

  it('membership + lifecycle gates', () => {
    expect(() => buildBoardCommit(commitArgs({ group: null }))).toThrow(/group_not_found/);
    expect(() => buildBoardCommit(commitArgs({ odUserId: 'user-z' }))).toThrow(/not_member/);
    expect(() => buildBoardCommit(commitArgs({ group: makeGroup({ status: 'battle' }) }))).toThrow(/not_forming/);
  });
});

// ==================== DELTA ====================

describe('computeBoardDelta — per-name kept / reordered / removed / added', () => {
  it('empty prefill: everything is added', () => {
    expect(computeBoardDelta([], ['NVDA', 'AMD'])).toEqual([
      { symbol: 'NVDA', status: 'added', prefillRank: null, boardRank: 0 },
      { symbol: 'AMD', status: 'added', prefillRank: null, boardRank: 1 },
    ]);
  });

  it('identical board: everything is kept', () => {
    expect(computeBoardDelta(['NVDA', 'AMD'], ['NVDA', 'AMD'])).toEqual([
      { symbol: 'NVDA', status: 'kept', prefillRank: 0, boardRank: 0 },
      { symbol: 'AMD', status: 'kept', prefillRank: 1, boardRank: 1 },
    ]);
  });

  it('mixed: reorders, cuts, and additions are each attributed', () => {
    // suggested NVDA,AMD,TSLA → user keeps NVDA #1, promotes TSLA, cuts AMD, adds META
    const delta = computeBoardDelta(['NVDA', 'AMD', 'TSLA'], ['NVDA', 'TSLA', 'META']);
    expect(delta).toEqual([
      { symbol: 'NVDA', status: 'kept', prefillRank: 0, boardRank: 0 },
      { symbol: 'TSLA', status: 'reordered', prefillRank: 2, boardRank: 1 },
      { symbol: 'META', status: 'added', prefillRank: null, boardRank: 2 },
      { symbol: 'AMD', status: 'removed', prefillRank: 1, boardRank: null },
    ]);
  });

  it('round-trips: every prefill and board name appears exactly once', () => {
    const prefill = POOL.slice(0, 10);
    const board = [...POOL.slice(5, 15)].reverse();
    const delta = computeBoardDelta(prefill, board);
    const symbols = delta.map(d => d.symbol).sort();
    expect(symbols).toEqual([...new Set([...prefill, ...board])].sort());
  });
});
