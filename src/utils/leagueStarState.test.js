// src/utils/leagueStarState.test.js
import { describe, it, expect } from 'vitest';
import { deriveStarState } from './leagueStarState';

describe('deriveStarState — design states from the canonical ladders', () => {
  it('hit: a crossed bagger badge', () => {
    expect(deriveStarState({ multiplier: 1.05, badges: ['bagger'] })).toBe('hit');
  });
  it('hit: multiplier ≥ 1.0 even before the badge is recorded (boundary)', () => {
    expect(deriveStarState({ multiplier: 1.0, badges: [] })).toBe('hit');
  });
  it('busted: a crossed bust badge', () => {
    expect(deriveStarState({ multiplier: -1.1, badges: ['bust'] })).toBe('busted');
  });
  it('busted: multiplier ≤ -1.0 even before the badge (boundary)', () => {
    expect(deriveStarState({ multiplier: -1.0, badges: [] })).toBe('busted');
  });
  it('edge: positive red zone, no badge yet (75% to BaggerBomb)', () => {
    expect(deriveStarState({ multiplier: 0.85, badges: [] })).toBe('edge');
    expect(deriveStarState({ multiplier: 0.75, badges: [] })).toBe('edge'); // zone-start inclusive
  });
  it('danger: negative red zone, no badge yet (75% to Bust)', () => {
    expect(deriveStarState({ multiplier: -0.85, badges: [] })).toBe('danger');
  });
  it('heating: positive drift below the edge zone', () => {
    expect(deriveStarState({ multiplier: 0.4, badges: [] })).toBe('heating');
  });
  it('quiet: flat, and small negative wobble (not yet danger)', () => {
    expect(deriveStarState({ multiplier: 0, badges: [] })).toBe('quiet');
    expect(deriveStarState({ multiplier: -0.5, badges: [] })).toBe('quiet');
  });

  it('STICKY: crossed-then-reverted stays hit (badge present, multiplier back to 0.9)', () => {
    expect(deriveStarState({ multiplier: 0.9, badges: ['bagger'] })).toBe('hit');
  });

  it('NO RE-NEGATION: a short whose price fell yields a positive scorer multiplier → hit', () => {
    // calculateAssetScoreV3 already negated for the short; we receive +1.2 and must NOT flip it back.
    expect(deriveStarState({ multiplier: 1.2, badges: ['bagger'], direction: 'short' })).toBe('hit');
    expect(deriveStarState({ multiplier: 0.85, badges: [], direction: 'short' })).toBe('edge');
  });

  it('busted wins over a stale bagger when both badges are present (down-move is louder)', () => {
    expect(deriveStarState({ multiplier: 0.5, badges: ['bagger', 'bust'] })).toBe('busted');
  });

  it('busted via the multiplier FLOOR even with only a stale bagger badge (a popped star crashing)', () => {
    // No bust badge yet — the mult ≤ -1.0 clause must drive this, not the bagger badge.
    expect(deriveStarState({ multiplier: -1.5, badges: ['bagger'] })).toBe('busted');
  });

  it('defaults: missing/garbage input → quiet, never throws', () => {
    expect(deriveStarState()).toBe('quiet');
    expect(deriveStarState({ multiplier: NaN, badges: null })).toBe('quiet');
  });
});
