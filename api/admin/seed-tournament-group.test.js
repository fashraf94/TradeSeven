// api/admin/seed-tournament-group.test.js
//
// P5 — the seeder pool-floor fix (P3b-reported, founder-pulled into P5: the
// auto-commit smoke depends on seeded pools satisfying the board-commit
// floor). Locks that a pool at exactly the floor lets the DEEPEST staggered
// placeholder slice reach BOARD_DEPTH_MIN — the precondition buildBoardCommit
// enforces.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): this file's real import of
// seed-tournament-group.js IS the runtime guard that its transitive import
// surface (src/constants/leagueTournament.js) stays Node-clean. Never mock
// that import.

import { describe, it, expect } from 'vitest';
import { SEED_POOL_FLOOR } from './seed-tournament-group.js';
import { TOURNAMENT_TUNING, PICKS_PER_PLAYER } from '../../src/constants/leagueTournament.js';

describe('SEED_POOL_FLOOR — the placeholder boards\' real precondition', () => {
  it('covers the deepest staggered slice (3 placeholders, offset i×PICKS_PER_PLAYER)', () => {
    expect(SEED_POOL_FLOOR).toBe(TOURNAMENT_TUNING.BOARD_DEPTH_MIN + 2 * PICKS_PER_PLAYER);
    const pool = Array.from({ length: SEED_POOL_FLOOR }, (_, i) => `SYM${i}`);
    // The handler's deepest slice (third placeholder, i = 2) at a pool of
    // exactly the floor still yields a full BOARD_DEPTH_MIN board.
    const deepest = pool.slice(2 * PICKS_PER_PLAYER, 2 * PICKS_PER_PLAYER + TOURNAMENT_TUNING.BOARD_DEPTH_MIN);
    expect(deepest).toHaveLength(TOURNAMENT_TUNING.BOARD_DEPTH_MIN);
  });
});
