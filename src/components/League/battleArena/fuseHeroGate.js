// src/components/League/battleArena/fuseHeroGate.js
//
// Branch A — the ONE gate for the fuse hero, mirroring arenaLiveGate.js so the
// two hosts and the trail wiring can't drift.
//
// FUSE_HERO_ON is the flag OR the dedicated `?fuseHero=1` PREVIEW override
// (Amendment C §C3): a dark-merged visual redesign needs a preview path — a
// founder must be able to LOOK at the board on a Vercel preview before the
// production flip, or the first human look happens on the PR that turns it on
// for everyone.
//
// REMOVAL IS SCHEDULED (C3, the ?leagueLiveOrb=1 lesson): the flip PR deletes
// the SP line and the `|| SP.get(...)` clause below IN THE SAME COMMIT that
// flips the pin — flip, pin, and override travel together. Both are whole-line
// deletions by construction, so nothing can be left dangling the way the orb
// override was. This gate module itself SURVIVES the flip (the ARENA_LIVE_ON
// precedent) as the flag's one consumer seam.
//
// Evaluated once at module load (a dev param doesn't change within a session) —
// the arenaLiveGate idiom. NOT a flag-source module: the pinned literal stays
// in featureFlags.js where the flag-pin guard reads it.

import { LEAGUE_FUSE_HERO_ENABLED } from '../../../config/featureFlags';

const SP = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();

export const FUSE_HERO_ON = LEAGUE_FUSE_HERO_ENABLED || SP.get('fuseHero') === '1';

/**
 * H2 — the dock-row target, overridable for the founder's device inspection:
 * `?heroRows=2` (two full rows) vs `?heroRows=1` (one + a partial) vs the
 * shipped default. Without the param the shipped value is used.
 *
 * REMOVED WITH THE OVERRIDE: this line goes in the same flip commit as the
 * `?fuseHero=1` clause above — flip, pin and both overrides travel together.
 */
export const FUSE_HERO_ROWS = (() => {
  const raw = Number(SP.get('heroRows'));
  return Number.isFinite(raw) && raw > 0 && raw <= 4 ? raw : null;
})();
