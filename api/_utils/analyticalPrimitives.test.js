// api/_utils/analyticalPrimitives.test.js
// Coverage for PATTERN_DISPLAY_NAMES — the snake_case → lowercase display
// map shared by voice-layer and agent-eval renderers (F3.4).

import { describe, it, expect } from 'vitest';
import { detectCandlePattern, PATTERN_DISPLAY_NAMES } from './analyticalPrimitives.js';

describe('PATTERN_DISPLAY_NAMES', () => {
  it('exports a non-empty map', () => {
    expect(typeof PATTERN_DISPLAY_NAMES).toBe('object');
    expect(PATTERN_DISPLAY_NAMES).not.toBeNull();
    expect(Object.keys(PATTERN_DISPLAY_NAMES).length).toBeGreaterThan(0);
  });

  it('every value is a non-empty lowercase string with no underscores', () => {
    for (const [key, value] of Object.entries(PATTERN_DISPLAY_NAMES)) {
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
      expect(value).toBe(value.toLowerCase());
      expect(value).not.toContain('_');
      expect(key).toBe(key.toLowerCase());
    }
  });

  it('covers every pattern key returned by detectCandlePattern', () => {
    // Patterns documented in the detectCandlePattern JSDoc union.
    const documentedKeys = ['bullish_engulfing', 'bearish_engulfing', 'hammer', 'shooting_star', 'doji'];
    for (const key of documentedKeys) {
      expect(PATTERN_DISPLAY_NAMES[key]).toBeDefined();
      expect(PATTERN_DISPLAY_NAMES[key].length).toBeGreaterThan(0);
    }
  });

  it('detectCandlePattern outputs match the map keys (engulfing case)', () => {
    // Yesterday bearish: open 105, close 100. Today bullish engulfing.
    const opens = [99, 105];
    const closes = [106, 100];
    const highs = [107, 106];
    const lows = [98, 99];
    const volumes = [1e6, 1e6];
    const pattern = detectCandlePattern(opens, highs, lows, closes, volumes, 1e6);
    expect(pattern).toBe('bullish_engulfing');
    expect(PATTERN_DISPLAY_NAMES[pattern]).toBe('bullish engulfing');
  });

  it('detectCandlePattern outputs match the map keys (doji case)', () => {
    const opens = [100];
    const highs = [102.5];
    const lows = [97.5];
    const closes = [100.05];
    const volumes = [1e6];
    const pattern = detectCandlePattern(opens, highs, lows, closes, volumes, 1e6);
    expect(pattern).toBe('doji');
    expect(PATTERN_DISPLAY_NAMES[pattern]).toBe('doji');
  });
});
