// src/config/cockpitUiFlags.test.js
//
// Cockpit Build 2a — THE SCREEN FLAG PIN (BUILD_RULES §2; spec
// docs/COCKPIT_BUILD2A_SPEC_V1_0.md §10.1).
//
// COCKPIT_UI_ENABLED ships FALSE by design: the build merges dark and the
// founder flips it in his own flip PR (§10.3) together with CALL_RECORDS_MODE =
// 'on'. The flag-pin guard (flagPinGuard.test.js) tracks this row against the
// live value and, because the flag sits in DARK_BY_DESIGN there, an accidental
// flip fails loudly with the runway note; the DELIBERATE flip moves the first
// row below to `true` and drops the DARK_BY_DESIGN entry in the same commit.
//
// Deliberately pins ONLY this flag (the showItFlags.test.js precedent): pinning
// a flag obliges its docstring to name this file, so an unrelated flag added
// here "as context" would couple its future flip to this arc.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { COCKPIT_UI_ENABLED, isCockpitUiOn } from './featureFlags.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(path.join(HERE, 'featureFlags.js'), 'utf8').replace(/\r\n/g, '\n');
const GUARD = readFileSync(path.join(HERE, 'flagPinGuard.test.js'), 'utf8').replace(/\r\n/g, '\n');

describe('COCKPIT_UI_ENABLED — the pin (BUILD_RULES §2)', () => {
  it('ships DARK: COCKPIT_UI_ENABLED is false at merge (§10.1 — the founder flips it in his own PR)', () => {
    // THE ROW THAT MOVES WITH THE FLIP, in the flip PR's own commit.
    expect(COCKPIT_UI_ENABLED).toBe(false);
  });

  it('the render-time accessor is false with the live flags: every cockpit path is unreachable', () => {
    expect(isCockpitUiOn()).toBe(false);
  });

  it('the accessor is the pane AND the flag, read at call time (never a module-scope derivation)', () => {
    expect(SRC).toMatch(/export function isCockpitUiOn\(\) \{\n {2}return isCharacterPaneOn\(\) && COCKPIT_UI_ENABLED;\n\}/);
    expect(SRC).not.toMatch(/const \w+ = isCockpitUiOn\(\)/);
  });

  it('is a plain boolean export the flag-pin guard can scan', () => {
    expect(typeof COCKPIT_UI_ENABLED).toBe('boolean');
    expect(SRC).toMatch(/^export const COCKPIT_UI_ENABLED = (true|false);$/m);
  });

  it('its docstring names this pinning suite, the runway and the server-side gate', () => {
    const idx = SRC.indexOf('export const COCKPIT_UI_ENABLED');
    expect(idx).toBeGreaterThan(-1);
    const window = SRC.slice(Math.max(0, idx - 3000), idx);
    expect(window).toContain('Pinned by: cockpitUiFlags.test.js');
    expect(window).toContain('RUNWAY:');
    expect(window).toContain('Never a build PR');
    expect(window).toContain('GET /api/agent/cockpit-status');
  });

  it('is registered DARK_BY_DESIGN with its runway note (the loud tripwire)', () => {
    expect(GUARD).toMatch(/ {2}COCKPIT_UI_ENABLED:\n {4}'Cockpit Build 2a/);
  });
});
