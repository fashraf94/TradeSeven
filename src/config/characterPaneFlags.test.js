// src/config/characterPaneFlags.test.js
//
// Battle View character pane — DARK pin (BUILD_RULES §2). Phase A3 builds the
// pane behind BATTLE_VIEW_CHARACTER_PANE_ENABLED, which ships FALSE through the
// whole build and flips in its own deliberate one-line PR after the founder's
// A3.5 preview smoke. Until then this row is the tripwire that turns an
// accidental flip into a loud failure naming this file, and the flag-pin guard
// couples the two: flipping the flag without moving this assertion (and
// dropping the DARK_BY_DESIGN entry) reds CI.
//
// Deliberately pins ONLY this flag (the commandCenterSyncFlags.test.js
// precedent): pinning a flag obliges its docstring to name this file, so an
// unrelated flag added here "as context" would couple its future flip to this
// arc's test. BATTLE_VIEW_CONTROLLER_ENABLED is pinned by its own suite and is
// only READ here, as the outer conjunct — never asserted, so this file never
// becomes a second home for the controller's pin.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import {
  BATTLE_VIEW_CHARACTER_PANE_ENABLED,
  isCharacterPaneOn,
  isBattleViewControllerOn,
} from './featureFlags.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(path.join(HERE, 'featureFlags.js'), 'utf8');

/** The body of a named export function, from its signature to its closing brace. */
function fnBody(name) {
  const body = SRC.slice(SRC.indexOf(`export function ${name}`));
  return body.slice(0, body.indexOf('\n}') + 2);
}

describe('Battle View character pane flag — dark pin (BUILD_RULES §2)', () => {
  it('ships DARK — the pane is built behind it, never merged live', () => {
    expect(BATTLE_VIEW_CHARACTER_PANE_ENABLED).toBe(false);
  });

  it('the accessor is false while the flag is dark', () => {
    expect(isCharacterPaneOn()).toBe(false);
  });

  it('the accessor is NESTED on the controller — a source row, not a behavioural one', () => {
    // This has to be a source row. The pane flag is false, so isCharacterPaneOn()
    // returns false for every input and a behavioural row could not observe the
    // nesting being dropped — it would be a test that cannot fail under the
    // defect it names, which BUILD_RULES §2 says is not a guard. (After the flip
    // it is behaviourally observable again, and the row above becomes the one
    // that moves.) The nesting matters: read alone, the pane flag would light a
    // pane over the shipped tabbed screen, which has no board to float an
    // avatar on.
    const fn = fnBody('isCharacterPaneOn');
    expect(fn).toMatch(/isBattleViewControllerOn\(\)\s*&&\s*BATTLE_VIEW_CHARACTER_PANE_ENABLED/);
  });

  it('the accessor tracks the conjunction in whatever state both flags are in', () => {
    // NOT `expect(isBattleViewControllerOn()).toBe(true)`, which is what this
    // row was until the review (lens 3 F2). That pinned the CONTROLLER's live
    // value from a second file, invisible to flagPinGuard — which only scans
    // `expect(FLAG).toBe(…)` on the constant — so a deliberate controller
    // rollback would have reddened THIS file while the guard's message named
    // only battleViewControllerFlags.test.js. The dependency A3 was cut on is
    // stated in this file's header, where it cannot red.
    //
    // What is asserted instead is the accessor's contract, which holds in every
    // combination of the two flags and therefore survives a rollback intact.
    expect(isCharacterPaneOn()).toBe(isBattleViewControllerOn() && BATTLE_VIEW_CHARACTER_PANE_ENABLED);
  });

  it('no query-string override has crept in', () => {
    // The `?battleViewController=1` override was deleted in the same commit that
    // flipped the controller (the `?fuseHero=1` precedent; the `?leagueLiveOrb=1`
    // lesson behind it — a URLSearchParams read wired to nothing that sat in this
    // file for months). This runway does not re-open that door: the A3.5 smoke
    // uses the Phase 0 §7 pattern instead.
    expect(fnBody('isCharacterPaneOn')).not.toMatch(/URLSearchParams|location\.search|characterPane=/);
  });
});
