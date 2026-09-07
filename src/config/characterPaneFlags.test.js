// src/config/characterPaneFlags.test.js
//
// Battle View character pane — THE FLAG PIN (BUILD_RULES §2).
//
// The flag is LIT. Phase A3 was built dark behind
// BATTLE_VIEW_CHARACTER_PANE_ENABLED, which shipped FALSE through the whole
// build and flipped here in its own deliberate one-line PR, after the founder's
// A3.5 preview smoke on `smoke/character-pane`. The flag-pin guard couples the
// three edits that flip makes, which is why they all land in one commit:
// moving the flag without moving this assertion AND dropping the
// DARK_BY_DESIGN entry reds CI.
//
// The tripwire did not retire, it turned around. Pinned TRUE, this row is now
// what turns an accidental ROLLBACK into a loud failure naming this file — and
// a deliberate one moves the same three lines back.
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

describe('Battle View character pane flag — the pin (BUILD_RULES §2)', () => {
  it('is LIT — the pane ships to every player', () => {
    // The row flagPinGuard scans. It moved with the flag, in the flip commit;
    // a rollback moves it back, together with the DARK_BY_DESIGN entry.
    expect(BATTLE_VIEW_CHARACTER_PANE_ENABLED).toBe(true);
  });

  it('the accessor is TRUE — the controller is live, so the conjunction lights', () => {
    // The row the next one predicted would move. Invisible to flagPinGuard,
    // which scans the constant and not the accessor, so it moves by this rule
    // rather than by that machinery: BUILD_RULES §2 couples EVERY assertion
    // pinning the pre-flip state to the flip commit, not just the guarded one.
    expect(isCharacterPaneOn()).toBe(true);
  });

  it('the accessor is NESTED on the controller — a source row, not a behavioural one', () => {
    // This was a source row of necessity while the flag was dark: the pane flag
    // was false, so isCharacterPaneOn() returned false for every input and a
    // behavioural row could not observe the nesting being dropped — a test that
    // cannot fail under the defect it names, which BUILD_RULES §2 says is not a
    // guard. The flip has made it observable again, exactly as that note
    // predicted, and the row above is the one that moved.
    //
    // It STAYS a source row anyway. Behaviourally the nesting is now only
    // visible where the controller is off, which is a state no row here can
    // reach without mocking the module this file exists to read straight. The
    // nesting matters: read alone, the pane flag would light a pane over the
    // shipped tabbed screen, which has no board to float an avatar on.
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
