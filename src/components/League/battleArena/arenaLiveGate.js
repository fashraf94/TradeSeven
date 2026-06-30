// src/components/League/battleArena/arenaLiveGate.js
//
// League Battle View V2 — the ONE gate the host screens read to decide whether to
// mount the live arena. Kept in a single home so the two hosts can't drift.
//
// ARENA_LIVE_ON is the flag OR the dedicated `?battleArenaLive=1` dev param
// (independent of the standalone fixtures preview's `?battleViewV2=1`). When
// LEAGUE_BATTLE_VIEW_V2_ENABLED is OFF and no param is set, ARENA_LIVE_ON is false →
// the hosts render today's battle composition byte-identically (the dormant gate);
// when the flag is ON, the live arena mounts (desktop → ArenaDesktop, mobile →
// ArenaMobile). The flag is owned by featureFlags.js — it is now ENABLED.
//
// Evaluated once at module load (a dev param doesn't change within a session) —
// the same idiom as LeagueScreen's CLIMB_PREVIEW / ARENA_PREVIEW consts.

import { LEAGUE_BATTLE_VIEW_V2_ENABLED } from '../../../config/featureFlags';

const SP = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();

export const ARENA_LIVE_ON = LEAGUE_BATTLE_VIEW_V2_ENABLED || SP.get('battleArenaLive') === '1';
