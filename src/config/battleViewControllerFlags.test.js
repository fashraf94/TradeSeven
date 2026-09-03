// src/config/battleViewControllerFlags.test.js
//
// Battle View controller, Phase A — DARK pin (BUILD_RULES §2). The flag ships
// FALSE on purpose: Phase A is built dark behind it and flipped in its own
// deliberate PR after the founder's preview smoke (docs/design/
// PHASE_A_RULINGS_AND_AMENDMENTS_V1.md §1.4 — smoke Pattern B, the
// `?battleViewController=1` override, which the flip PR deletes).
//
// This row is a tripwire in BOTH directions. An accidental flip to true would
// promote an unsmoked controller layout to the flagship battle screen; the
// flag-pin guard turns that into a loud failure naming this file. When the
// flip IS deliberate, this assertion moves to true AND the flag's
// DARK_BY_DESIGN entry is dropped from flagPinGuard.test.js — in the same
// commit, which is the coupling the guard enforces. Referenced by the flag's
// "Pinned by:" docstring in featureFlags.js.
//
// Deliberately pins ONLY this flag (the commandCenterSyncFlags.test.js
// precedent): pinning a flag obliges its docstring to name this file, so an
// unrelated flag added here "as context" would couple its future flip to this
// arc's test.

import { describe, it, expect } from 'vitest';
import { BATTLE_VIEW_CONTROLLER_ENABLED, isBattleViewControllerOn } from './featureFlags.js';

describe('Battle View controller flag — Phase A dark pin (BUILD_RULES §2)', () => {
  it('ships DARK — the tabbed battle screen is byte-identical until a deliberate flip', () => {
    expect(BATTLE_VIEW_CONTROLLER_ENABLED).toBe(false);
  });

  it('the accessor is off in a window-less environment (no override can reach it)', () => {
    // vitest's default environment is node: there is no window, so the only
    // input is the flag itself. The URL override is a browser-only preview door.
    expect(isBattleViewControllerOn()).toBe(false);
  });
});
