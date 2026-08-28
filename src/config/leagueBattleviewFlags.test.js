// src/config/leagueBattleviewFlags.test.js
//
// League Battleview — Branch A merge-dark pin (BUILD_RULES §2). The fuse hero
// ships at its safest default while `ClimbArena` remains the live top half.
// This pin is the loud tripwire: the flip PR MUST update the assertion here AND
// drop the flag's DARK_BY_DESIGN entry in flagPinGuard.test.js, in the same
// commit (the flag-pin guard enforces the coupling). Referenced by the flag's
// "Pinned by:" docstring in featureFlags.js.
//
// Deliberately pins ONLY the fuse flag. An earlier draft also pinned
// LEAGUE_BATTLE_VIEW_V2_ENABLED as "context" — the guard correctly rejected it:
// pinning a flag obliges its docstring to name this file, which would couple an
// unrelated flag's future flip to this arc's test. The V2 dependency is stated
// in prose (featureFlags.js + FuseHero.jsx) instead, where it costs nothing.

import { describe, it, expect } from 'vitest';
import { LEAGUE_FUSE_HERO_ENABLED } from './featureFlags.js';

describe('League battleview flags — Branch A merge-dark pin (BUILD_RULES §2)', () => {
  it('the fuse hero is dark — ClimbArena is still the live top half', () => {
    expect(LEAGUE_FUSE_HERO_ENABLED).toBe(false);
  });
});
