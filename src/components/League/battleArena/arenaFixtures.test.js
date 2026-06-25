// src/components/League/battleArena/arenaFixtures.test.js
//
// Shape tests for the preview fixtures. These exist to lock the fixtures to the
// Phase-1 data contracts (star rows ↔ leagueStarMeter, climb ↔ leagueClimbAdapter,
// beats ↔ leagueBeats) so the later live-data wiring is a drop-in swap. The
// import of deriveStarState / BAGGER_TIERS loading clean is also the guard that
// the fixture states + badges are the REAL vocabulary, not invented strings.

import { describe, it, expect } from 'vitest';
import { BAGGER_TIERS, BUST_TIERS } from '../../../constants/baggerBombScoring';
import { deriveStarState } from '../../../utils/leagueStarState';
import {
  ARENA_SEATS, ARENA_YOU, ARENA_CLIMB, ARENA_BEATS, arenaAgentStars, arenaUserStars,
} from './arenaFixtures';

const VALID_STATES = new Set(['hit', 'busted', 'edge', 'danger', 'heating', 'quiet']);
const VALID_BADGES = new Set([...BAGGER_TIERS.map((t) => t.label), ...BUST_TIERS.map((t) => t.label)]);
const VALID_TONES = new Set(['good', 'bad', 'neutral']);
const VALID_KINDS = new Set(['edge', 'hit', 'swap', 'danger', 'claim', 'lead', 'flip']);

describe('seats + climb series (buildClimbSeries shape)', () => {
  it('every seat has a climb series and "you" is among them', () => {
    expect(ARENA_SEATS.find((s) => s.id === ARENA_YOU)?.you).toBe(true);
    for (const seat of ARENA_SEATS) {
      expect(Array.isArray(ARENA_CLIMB[seat.id])).toBe(true);
      expect(ARENA_CLIMB[seat.id].every(Number.isFinite)).toBe(true);
    }
  });
  it('all series share one length (aligned closes)', () => {
    const lens = new Set(Object.values(ARENA_CLIMB).map((a) => a.length));
    expect(lens.size).toBe(1);
  });
});

describe('star rows (readAgentStar / readUserStar shape)', () => {
  const FIELDS = ['tk', 'tier', 'dir', 'mult', 'banked', 'points', 'badge', 'state', 'justIn'];
  for (const state of ['awaiting', 'live', 'complete']) {
    it(`agent six + user three are well-formed in the ${state} state`, () => {
      const rows = [...arenaAgentStars(state), ...arenaUserStars(state)];
      expect(arenaAgentStars(state)).toHaveLength(6);
      expect(arenaUserStars(state)).toHaveLength(3);
      for (const r of rows) {
        for (const f of FIELDS) expect(r).toHaveProperty(f);
        expect(VALID_STATES.has(r.state)).toBe(true);
        if (r.badge !== null) expect(VALID_BADGES.has(r.badge)).toBe(true);
        expect(Number.isFinite(r.mult)).toBe(true);
        expect(['long', 'short']).toContain(r.dir);
      }
    });
  }
  it('awaiting rows are at rest (no movement, no badges)', () => {
    for (const r of [...arenaAgentStars('awaiting'), ...arenaUserStars('awaiting')]) {
      expect(r.mult).toBe(0);
      expect(r.state).toBe('quiet');
      expect(r.badge).toBeNull();
      expect(r.justIn).toBe(false);
    }
  });
  it('each live reading is consistent with deriveStarState (the real disposition fn)', () => {
    // The fixture state must be one deriveStarState could itself produce for that
    // multiplier (badge-free rows are fully determined; badge rows are sticky).
    for (const r of [...arenaAgentStars('live'), ...arenaUserStars('live')]) {
      if (!r.badge) {
        expect(deriveStarState({ multiplier: r.mult, badges: [], direction: r.dir })).toBe(r.state);
      }
    }
  });
});

describe('beats (deriveBeats shape)', () => {
  it('every beat carries a known kind + tone and points are numeric-or-null', () => {
    for (const b of ARENA_BEATS) {
      expect(VALID_KINDS.has(b.kind)).toBe(true);
      expect(VALID_TONES.has(b.tone)).toBe(true);
      expect(b.pts === null || Number.isFinite(b.pts)).toBe(true);
      expect('star' in b).toBe(true);
    }
  });
});
