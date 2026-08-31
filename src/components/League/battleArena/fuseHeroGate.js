// src/components/League/battleArena/fuseHeroGate.js
//
// Branch A — the ONE gate for the fuse hero, mirroring arenaLiveGate.js so the
// two hosts and the trail wiring can't drift.
//
// The `?fuseHero=1` preview override (Amendment C §C3) is GONE: it existed so a
// founder could look at a dark-merged redesign on a Vercel preview before the
// production flip, and it was deleted in the SAME COMMIT that flipped the flag
// — flip, pin and override together, which is the whole point of the
// ?leagueLiveOrb=1 lesson. Nothing is left dangling: the SP read and its clause
// were whole-line deletions, and this module is now a plain re-export seam.
//
// The module SURVIVES the flip (the ARENA_LIVE_ON precedent) as the flag's one
// consumer seam — every host imports FUSE_HERO_ON, never the flag, so the
// rollback is one literal in featureFlags.js.

import { LEAGUE_FUSE_HERO_ENABLED } from '../../../config/featureFlags';

export const FUSE_HERO_ON = LEAGUE_FUSE_HERO_ENABLED;
