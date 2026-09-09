// src/config/tickStampsFlags.test.js
//
// Phase B — the tick stamps: THE FLAG PIN (BUILD_RULES §2).
//
// TICK_STAMPS_ENABLED ships FALSE by design (spec §1.1 / §4, D-113): B1 merges
// dark, the founder flips it in its own one-line PR after B1 merges, and the
// first stamped production check is the smoke. The flag-pin guard
// (flagPinGuard.test.js) tracks this row against the live value and, because
// the flag sits in DARK_BY_DESIGN there, an accidental flip fails loudly with
// the runway note; a DELIBERATE flip moves the first row below to `true` and
// drops the DARK_BY_DESIGN entry in the same commit.
//
// Deliberately pins ONLY this flag (the characterPaneFlags.test.js precedent):
// pinning a flag obliges its docstring to name this file, so an unrelated flag
// added here "as context" would couple its future flip to this arc.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { TICK_STAMPS_ENABLED } from './featureFlags.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(path.join(HERE, 'featureFlags.js'), 'utf8');

describe('Phase B tick stamps flag — the pin (BUILD_RULES §2)', () => {
  it('ships DARK: TICK_STAMPS_ENABLED is false at merge (D-113 — the founder flips it in its own PR after B1 merges)', () => {
    // THE ROW THAT MOVES WITH THE FLIP, in the flip PR's own commit.
    expect(TICK_STAMPS_ENABLED).toBe(false);
  });

  it('is a plain boolean export (a bare-factory featureFlags mock resolves it undefined → off, never a throw)', () => {
    expect(typeof TICK_STAMPS_ENABLED).toBe('boolean');
    expect(SRC).toMatch(/^export const TICK_STAMPS_ENABLED = (true|false);$/m);
  });

  it('its docstring names this pinning suite and the flip map (kept honest by flagPinGuard item 4)', () => {
    const idx = SRC.indexOf('export const TICK_STAMPS_ENABLED');
    const window = SRC.slice(Math.max(0, idx - 3000), idx);
    expect(window).toContain('Pinned by: tickStampsFlags.test.js');
    expect(window).toContain('FLIP MAP');
    expect(window).toContain('DARK_BY_DESIGN');
  });
});
