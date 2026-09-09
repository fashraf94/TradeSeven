// src/config/showItFlags.test.js
//
// Phase C — Show it: THE FLAG PIN (BUILD_RULES §2).
//
// SHOW_IT_ENABLED ships FALSE by design (spec V1 §6 / V1.1 §E): the build merges
// dark and the founder flips it in its own one-line PR. The flag-pin guard
// (flagPinGuard.test.js) tracks this row against the live value and, because the
// flag sits in DARK_BY_DESIGN there, an accidental flip fails loudly with the
// runway note; a DELIBERATE flip moves the first row below to `true` and drops
// the DARK_BY_DESIGN entry in the same commit.
//
// Deliberately pins ONLY this flag (the tickStampsFlags.test.js precedent):
// pinning a flag obliges its docstring to name this file, so an unrelated flag
// added here "as context" would couple its future flip to this arc.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { SHOW_IT_ENABLED } from './featureFlags.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(path.join(HERE, 'featureFlags.js'), 'utf8');

describe('Phase C Show it flag — the pin (BUILD_RULES §2)', () => {
  it('ships DARK: SHOW_IT_ENABLED is false at merge (V1.1 §E — the founder flips it in its own PR)', () => {
    // THE ROW THAT MOVES WITH THE FLIP, in the flip PR's own commit.
    expect(SHOW_IT_ENABLED).toBe(false);
  });

  it('is a plain boolean export the flag-pin guard can scan', () => {
    expect(typeof SHOW_IT_ENABLED).toBe('boolean');
    expect(SRC).toMatch(/^export const SHOW_IT_ENABLED = (true|false);$/m);
  });

  it('its docstring names this pinning suite, the flip map and the DARK_BY_DESIGN entry', () => {
    const idx = SRC.indexOf('export const SHOW_IT_ENABLED');
    expect(idx).toBeGreaterThan(-1);
    const window = SRC.slice(Math.max(0, idx - 4000), idx);
    expect(window).toContain('Pinned by: showItFlags.test.js');
    expect(window).toContain('FLIP MAP');
    expect(window).toContain('DARK_BY_DESIGN');
    // The route's darkness is the flag's whole promise; the docstring says so.
    expect(window).toContain('404s');
  });
});
