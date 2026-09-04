// src/config/characterPaneFlags.test.js
//
// Battle View character pane — THE FLAG PIN (BUILD_RULES §2).
//
// ⚠ THIS IS THE `smoke/character-pane` BRANCH, WHERE THE FLAG IS LIT. It exists
// only to give the founder a Vercel preview with the pane on, and it is NEVER
// MERGED — the build branch keeps the flag dark, keeps this row pinned FALSE,
// and keeps its DARK_BY_DESIGN entry. Do not port this file back.
//
// On the build branch this pins the flag DARK: Phase A3 is built behind
// BATTLE_VIEW_CHARACTER_PANE_ENABLED, which ships FALSE through the whole build
// and flips in its own deliberate one-line PR after the founder's smoke. The
// flag-pin guard couples the three edits, which is why they all appear in this
// branch's single commit: flipping the flag without moving this assertion AND
// dropping the DARK_BY_DESIGN entry reds CI. Exercising that coupling — rather
// than bypassing it — is half of what this branch is for.
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
  it('is LIT on this branch — the preview, never merged', () => {
    // FALSE on the build branch. See the header: this file is the pin, and on
    // `smoke/character-pane` the pin moves with the flag.
    expect(BATTLE_VIEW_CHARACTER_PANE_ENABLED).toBe(true);
  });

  it('the accessor is TRUE — the controller is live, so the conjunction lights', () => {
    // The row the next one predicted would move. With the flag lit the nesting
    // becomes behaviourally observable again, which is why the source row below
    // exists on the build branch at all.
    expect(isCharacterPaneOn()).toBe(true);
  });

  it('the accessor is NESTED on the controller — a source row, not a behavioural one', () => {
    // On the BUILD branch this has to be a source row: the pane flag is false
    // there, so isCharacterPaneOn() returns false for every input and a
    // behavioural row could not observe the nesting being dropped — a test that
    // cannot fail under the defect it names, which BUILD_RULES §2 says is not a
    // guard. On THIS branch the flip has made it observable again and the row
    // above has moved, exactly as that note predicted. The source row stays
    // either way, so the two branches differ by the pin and nothing else. The nesting matters: read alone, the pane flag would light a
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
