// src/config/cockpitUiFlags.test.js
//
// Cockpit Build 2a — THE SCREEN FLAG PIN (BUILD_RULES §2; spec
// docs/COCKPIT_BUILD2A_SPEC_V1_0.md §10.1).
//
// COCKPIT_UI_ENABLED shipped FALSE (the build merged dark) and is now TRUE: the
// founder's flip PR (§10.3), together with CALL_RECORDS_MODE = 'on', moved the
// first row below to `true` and dropped the flag's DARK_BY_DESIGN entry in the
// same commit; the registration row now asserts that entry is gone. The
// flag-pin guard (flagPinGuard.test.js) tracks the first row against the live
// value. A rollback moves both rows, and the entry, back together.
//
// Deliberately pins ONLY this flag (the showItFlags.test.js precedent): pinning
// a flag obliges its docstring to name this file, so an unrelated flag added
// here "as context" would couple its future flip to this arc.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { COCKPIT_UI_ENABLED, isCockpitUiOn, isCharacterPaneOn } from './featureFlags.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(path.join(HERE, 'featureFlags.js'), 'utf8').replace(/\r\n/g, '\n');
const GUARD = readFileSync(path.join(HERE, 'flagPinGuard.test.js'), 'utf8').replace(/\r\n/g, '\n');

describe('COCKPIT_UI_ENABLED — the pin (BUILD_RULES §2)', () => {
  it('LIT by the founder\'s flip (§10.3): COCKPIT_UI_ENABLED is true — the Battle View asks the server, which admits the allowlisted owners only', () => {
    // THE ROW THAT MOVES WITH THE FLIP, in the flip PR's own commit.
    expect(COCKPIT_UI_ENABLED).toBe(true);
  });

  it('the render-time accessor follows the pane with the live flags: wherever the character pane is on, the screen asks', () => {
    expect(isCockpitUiOn()).toBe(isCharacterPaneOn());
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

  it('is NO LONGER registered DARK_BY_DESIGN — the deliberate flip dropped its entry in the same commit', () => {
    expect(GUARD).not.toMatch(/ {2}COCKPIT_UI_ENABLED:\n/);
  });
});
