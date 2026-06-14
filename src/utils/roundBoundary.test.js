// src/utils/roundBoundary.test.js
//
// P7 (C) — the round-boundary branch resolution. Locks: latest-completed-game
// selection (seat filter, completedAt filter, highest round), and the
// advancer / eliminated / champion branch with composite placement.

import { describe, it, expect } from 'vitest';
import { findLatestCompletedGameForUser, resolveRoundBoundary } from './roundBoundary';

function bracket({ champion = null, totalRounds = 2 } = {}) {
  return {
    totalRounds,
    champion,
    rounds: {
      r1: {
        roundNumber: 1,
        games: {
          'B-r1-g1': {
            roundNumber: 1,
            seats: [{ odUserId: 'u1' }, { odUserId: 'u2' }, { odUserId: 'cpu-1' }, { odUserId: 'cpu-2' }],
            advancers: ['u1', 'u2'],
            finalScores: { u1: 50, u2: 40, 'cpu-1': 10, 'cpu-2': -5 },
            completedAt: '2026-06-12T20:00:00Z',
          },
        },
      },
      r2: {
        roundNumber: 2,
        games: {
          'B-r2-g1': {
            roundNumber: 2,
            seats: [{ odUserId: 'u1' }, { odUserId: 'u2' }, { odUserId: 'cpu-3' }, { odUserId: 'cpu-4' }],
            advancers: ['u1'],
            finalScores: { u1: 70, u2: 30, 'cpu-3': 5, 'cpu-4': 0 },
            completedAt: '2026-06-19T20:00:00Z',
          },
        },
      },
    },
  };
}

describe('findLatestCompletedGameForUser', () => {
  it('picks the highest-round completed game the user is seated in', () => {
    expect(findLatestCompletedGameForUser(bracket(), 'u1').gameId).toBe('B-r2-g1');
    // u2 lost round 2 but played both — latest completed is still r2.
    expect(findLatestCompletedGameForUser(bracket(), 'u2').roundNumber).toBe(2);
  });
  it('returns null for a non-seated user', () => {
    expect(findLatestCompletedGameForUser(bracket(), 'stranger')).toBeNull();
  });
  it('skips games with no completedAt', () => {
    const b = bracket();
    delete b.rounds.r2.games['B-r2-g1'].completedAt;
    expect(findLatestCompletedGameForUser(b, 'u1').roundNumber).toBe(1);
  });
});

describe('resolveRoundBoundary', () => {
  it('advancer: in advancers, placement from composite (1st)', () => {
    // Round 1 only completed.
    const b = bracket();
    delete b.rounds.r2.games['B-r2-g1'].completedAt;
    const r = resolveRoundBoundary(b, 'u1');
    expect(r.kind).toBe('advancer');
    expect(r.placement).toBe(1);
    expect(r.composite).toBe(50);
    expect(r.advancers).toEqual(['u1', 'u2']);
  });

  it('eliminated: a CPU not in advancers, placement 3rd', () => {
    const b = bracket();
    delete b.rounds.r2.games['B-r2-g1'].completedAt;
    const r = resolveRoundBoundary(b, 'cpu-1');
    expect(r.kind).toBe('eliminated');
    expect(r.placement).toBe(3);
  });

  it('champion: bracket.champion === uid at the terminal round', () => {
    const b = bracket({ champion: { odUserId: 'u1' } });
    const r = resolveRoundBoundary(b, 'u1');
    expect(r.kind).toBe('champion');
    expect(r.roundNumber).toBe(2);
    expect(r.isTerminal).toBe(true);
    expect(r.composite).toBe(70);
  });

  it('eliminated at the final: u2 lost round 2 (not champion, not advancer)', () => {
    const b = bracket({ champion: { odUserId: 'u1' } });
    const r = resolveRoundBoundary(b, 'u2');
    expect(r.kind).toBe('eliminated');
    expect(r.roundNumber).toBe(2);
  });

  it('placement is null (never fabricated from seat order) when finalScores is missing', () => {
    const b = bracket();
    delete b.rounds.r2.games['B-r2-g1'].completedAt; // round 1 is the latest completed
    delete b.rounds.r1.games['B-r1-g1'].finalScores;
    const r = resolveRoundBoundary(b, 'cpu-1'); // seated 3rd, but no scores → unknown
    expect(r.placement).toBeNull();
    expect(r.composite).toBeNull();
  });

  it('a champion is terminal even if roundNumber < totalRounds (no contradictory flag)', () => {
    const b = bracket({ champion: { odUserId: 'u1' }, totalRounds: 3 });
    delete b.rounds.r2.games['B-r2-g1'].completedAt; // champion crowned at round 1 (mismatch)
    const r = resolveRoundBoundary(b, 'u1');
    expect(r.kind).toBe('champion');
    expect(r.isTerminal).toBe(true);
  });

  it('returns null when the user has no completed game', () => {
    expect(resolveRoundBoundary(bracket(), 'stranger')).toBeNull();
    expect(resolveRoundBoundary(null, 'u1')).toBeNull();
  });
});
