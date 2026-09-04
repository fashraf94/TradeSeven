// src/config/battleViewControllerFlags.test.js
//
// Battle View controller — LIVE pin (BUILD_RULES §2). The flag shipped FALSE
// through Phase A and the flip-prep PR, and flipped TRUE on September 4, 2026
// in its own deliberate one-line PR after the founder's preview smoke
// (docs/design/PHASE_A_RULINGS_AND_AMENDMENTS_V1.md §1.4 — smoke Pattern B,
// the `?battleViewController=1` override, which that same commit deleted).
//
// This row is a tripwire in BOTH directions, and it still is. An accidental
// revert to false would silently return every player to the shipped tabbed
// screen; the flag-pin guard turns that into a loud failure naming this file.
// A DELIBERATE rollback is legitimate and is one literal in featureFlags.js —
// it moves this assertion back to false and re-adds the DARK_BY_DESIGN entry,
// in the same commit, which is the coupling the guard enforces in both
// directions. Referenced by the flag's "Pinned by:" docstring in
// featureFlags.js.
//
// Deliberately pins ONLY this flag (the commandCenterSyncFlags.test.js
// precedent): pinning a flag obliges its docstring to name this file, so an
// unrelated flag added here "as context" would couple its future flip to this
// arc's test. COMMAND_CENTER_SYNC_ENABLED (the dashboard Desk) is a separate
// flag on a separate runway and is NOT pinned here.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { BATTLE_VIEW_CONTROLLER_ENABLED, isBattleViewControllerOn } from './featureFlags.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

describe('Battle View controller flag — live pin (BUILD_RULES §2)', () => {
  it('ships LIVE — the controller is the battle screen', () => {
    expect(BATTLE_VIEW_CONTROLLER_ENABLED).toBe(true);
  });

  it('the accessor is the flag, read at call time', () => {
    // vitest's default environment is node: there is no window, and after the
    // flip there is nothing for one to answer anyway. The accessor survives as
    // the one consumer seam (AgentBattleScreen reads it, never the constant),
    // so this row is what proves the seam still resolves to the flag.
    expect(isBattleViewControllerOn()).toBe(BATTLE_VIEW_CONTROLLER_ENABLED);
    expect(isBattleViewControllerOn()).toBe(true);
  });

  it('the ?battleViewController=1 override is DELETED, not disabled', () => {
    // The `?leagueLiveOrb=1` lesson, asserted rather than trusted: that retired
    // override left a URLSearchParams read wired to nothing and sat in this
    // file for months, because nobody could tell whether it was load-bearing.
    // The fuseHeroGate flip (fuseHeroGate.test.jsx) is the precedent for making
    // the absence testable, and this is its equivalent row.
    //
    // It has to be a SOURCE row. Once the flag is true the accessor returns
    // true for every input, so a behavioural row cannot observe an override
    // that came back — it would be a test that cannot fail under the defect it
    // names, which BUILD_RULES §2 says is not a guard.
    const src = readFileSync(path.join(HERE, 'featureFlags.js'), 'utf8');
    const body = src.slice(src.indexOf('export function isBattleViewControllerOn'));
    const fn = body.slice(0, body.indexOf('\n}') + 2);
    expect(fn).not.toMatch(/URLSearchParams|location\.search|battleViewController=/);
  });
});
