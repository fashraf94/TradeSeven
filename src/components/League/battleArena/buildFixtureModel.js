// src/components/League/battleArena/buildFixtureModel.js
//
// League Battle View V2 — the PREVIEW fixtures packed into buildArenaModel's
// output shape (Phase 4, pure + node-clean). Extracted VERBATIM from ArenaDesktop's
// inline `fixtureModel` memo so BOTH the desktop and the mobile arenas share one
// fixtures fallback for the dev `?battleViewV2=1` surface (and their render-smoke
// tests). The live path passes real `data`; only the preview (`data == null`) falls
// back here — so this MUST reproduce exactly what ArenaDesktop produced inline
// (byte-identical preview), and callers MUST keep it memoized on `[state]`
// (a bare call churns identity → restarts the engine's preview beat-loop).

import { frameDayIdx } from './arenaStateMap';
import {
  ARENA_SEATS, ARENA_CLIMB, ARENA_YOU, ARENA_POD, ARENA_WIRE, ARENA_VOICE, ARENA_ASK,
  ARENA_BEATS, ARENA_AGENT_MOVE, arenaAgentStars, arenaUserStars,
} from './arenaFixtures';

/**
 * Pack the Phase-2 preview fixtures into the arena's model shape for a given
 * state. Pure; same value the ArenaDesktop inline memo returned.
 * @param {'awaiting'|'live'|'complete'} state
 */
export function buildFixtureModel(state) {
  const ranking = ARENA_SEATS
    .map((s) => ({ id: s.id, v: ARENA_CLIMB[s.id]?.[frameDayIdx(state)] ?? 0 }))
    .sort((a, b) => b.v - a.v);
  const yi = ranking.findIndex((s) => s.id === ARENA_YOU);
  return {
    seats: ARENA_SEATS, climb: ARENA_CLIMB, youId: ARENA_YOU,
    agentStars: arenaAgentStars(state), userStars: arenaUserStars(state),
    voice: ARENA_VOICE, ask: ARENA_ASK, pod: ARENA_POD, wire: ARENA_WIRE,
    agentMove: ARENA_AGENT_MOVE, beats: ARENA_BEATS,
    youRank: yi >= 0 ? yi + 1 : ranking.length,
  };
}
