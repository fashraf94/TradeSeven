// src/screens/battleView/landing.test.js
//
// Phase A (A1) — the landing's choreography is bounded: rows top to bottom,
// then the turn line, all inside 700 ms; reduced motion collapses every
// transition to the `instant` token. The hook that keys the landing is
// exercised in the screen's controller suite; this file pins the arithmetic
// the hook and the components share.

import { describe, it, expect } from 'vitest';
import { instant, fade } from '../../theme/motion';
import {
  LANDING_TOTAL_MS,
  landingRowDelayMs,
  landingTurnLineDelayMs,
} from './landing';

describe('the landing fits inside 700 ms for any board', () => {
  it('rows start top to bottom, monotonically', () => {
    for (let n = 1; n <= 12; n += 1) {
      let prev = -1;
      for (let i = 0; i < n; i += 1) {
        const d = landingRowDelayMs(i, n);
        expect(d).toBeGreaterThanOrEqual(prev);
        prev = d;
      }
      expect(landingRowDelayMs(0, n)).toBe(0);
    }
  });

  it('the turn line ticks last, and the whole sequence (last start + fade) stays under the cap', () => {
    for (let n = 1; n <= 12; n += 1) {
      const lastRow = landingRowDelayMs(n - 1, n);
      const turn = landingTurnLineDelayMs(n);
      expect(turn).toBeGreaterThanOrEqual(lastRow);
      expect(turn + fade.duration * 1000).toBeLessThanOrEqual(LANDING_TOTAL_MS);
    }
  });

  it('the shipped seven-row board (2 + 2 + 3) sequences at 60 ms steps', () => {
    expect(landingRowDelayMs(6, 7)).toBe(360);
    expect(landingTurnLineDelayMs(7)).toBe(420);
  });

  it('degenerate inputs never produce a negative or NaN delay', () => {
    expect(landingRowDelayMs(-1, 7)).toBe(0);
    expect(landingRowDelayMs(3, 0)).toBe(0);
    expect(landingRowDelayMs(undefined, undefined)).toBe(0);
    expect(landingTurnLineDelayMs(0)).toBeGreaterThanOrEqual(0);
  });
});

describe('reduced motion is the instant token, not a shorter animation', () => {
  it('instant stays { duration: 0 } (the motion.js contract the landing relies on)', () => {
    expect(instant).toEqual({ duration: 0 });
  });
});
