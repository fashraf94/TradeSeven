// src/config/leagueBattleviewFlags.test.js
//
// League Battleview — Branch A LIVE pin (BUILD_RULES §2). The fuse hero is the
// live top half; `ClimbArena` is still mounted behind the flag as the rollback
// path. This pin flipped WITH the flag and WITH the flag's DARK_BY_DESIGN entry
// being dropped from flagPinGuard.test.js, in one commit — the coupling the
// flag-pin guard enforces. Referenced by the flag's "Pinned by:" docstring in
// featureFlags.js.
//
// It stays a loud tripwire in the other direction now: an accidental revert to
// false is a silent rollback of a shipped redesign, and this row is what says so.
//
// Deliberately pins ONLY the fuse flag. An earlier draft also pinned
// LEAGUE_BATTLE_VIEW_V2_ENABLED as "context" — the guard correctly rejected it:
// pinning a flag obliges its docstring to name this file, which would couple an
// unrelated flag's future flip to this arc's test. The V2 dependency is stated
// in prose (featureFlags.js + FuseHero.jsx) instead, where it costs nothing.

import { describe, it, expect } from 'vitest';
import { LEAGUE_FUSE_HERO_ENABLED } from './featureFlags.js';

describe('League battleview flags — Branch A live pin (BUILD_RULES §2)', () => {
  it('the fuse hero is LIVE — it is the battle arena\'s top half', () => {
    expect(LEAGUE_FUSE_HERO_ENABLED).toBe(true);
  });
});
