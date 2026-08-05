// src/components/League/battleArena/arenaStateMap.js
//
// League Battle View V2 — the design-string ↔ server-enum MAPPER (Phase 2, pure +
// node-clean). The locked design speaks in {awaiting | live | complete} ×
// {training | ranked}; the server speaks in GROUP_STATUS plus the host that
// mounted the view. Phase 0 discovery flagged that this mapping layer "does not
// exist yet" — here it is, in ONE tested place, so no component hand-rolls a
// status comparison and drifts.
//
// STATE derives from the group's lifecycle (GROUP_STATUS), aligned with Phase 1's
// climbSeriesPhase: forming / drafting / awaiting_open are all pre-bell and read
// 'awaiting'; battle reads 'live'; complete reads 'complete'.
//
// MODE is NOT a group-doc field. A pod runs identical mechanics either way; the
// HOST decides — LeagueTrainingBattleView frames training, LeagueParticipantView
// frames ranked (leagueTrainingBattleFraming.js). So mode is caller-supplied and
// we only normalize it (defaulting to ranked, the stakes-bearing surface).

import { GROUP_STATUS } from '../../../constants/leagueTournament';

export const ARENA_STATES = Object.freeze(['awaiting', 'live', 'complete']);
export const ARENA_MODES = Object.freeze(['training', 'ranked']);

/**
 * Map a tournament group's status → the design's arena state.
 * @param {{status?: string}} group
 * @returns {'awaiting'|'live'|'complete'}
 */
export function deriveArenaState(group) {
  switch (group?.status) {
    case GROUP_STATUS.BATTLE:
      return 'live';
    case GROUP_STATUS.COMPLETE:
    case GROUP_STATUS.EXPIRED: // Training-Pod P0 R2: a pod retired pre-BATTLE reads terminal, never 'awaiting'
    case GROUP_STATUS.VOIDED: // L-A: a voided cohort reads terminal — no LIVE badge, no ticking, no "Day N"
      return 'complete';
    case GROUP_STATUS.FORMING:
    case GROUP_STATUS.DRAFTING:
    case GROUP_STATUS.AWAITING_OPEN:
      return 'awaiting';
    default:
      return 'awaiting'; // unknown / pre-seed → the rest state
  }
}

/**
 * When a group is terminal (arena state 'complete'), WHICH terminal kind — so the
 * client can tell a legitimately FINISHED battle (a real result) apart from a
 * VOIDED one (quarantined, no result). Returns 'voided' | 'final' | null (null for
 * any non-terminal state). ONE tested place — components must NOT hand-roll
 * `group.status === VOIDED` (the drift this module exists to prevent). L-A.
 * @param {{status?: string}} group
 * @returns {'voided'|'final'|null}
 */
export function deriveArenaTerminalKind(group) {
  switch (group?.status) {
    case GROUP_STATUS.VOIDED:
      return 'voided';
    case GROUP_STATUS.COMPLETE:
    case GROUP_STATUS.EXPIRED:
      return 'final';
    default:
      return null;
  }
}

/** Normalize a caller/host/param-supplied mode to a known value (default ranked). */
export function normalizeArenaMode(mode) {
  return ARENA_MODES.includes(mode) ? mode : 'ranked';
}

/**
 * The combined arena frame. `mode` is host/param supplied (see header).
 * @param {{ group?: Object, mode?: string }} args
 * @returns {{ state:'awaiting'|'live'|'complete', mode:'training'|'ranked' }}
 */
export function deriveArenaFrame({ group, mode } = {}) {
  return { state: deriveArenaState(group), mode: normalizeArenaMode(mode) };
}

/** The climb day-index a given state reads at: awaiting = start, live = mid, complete = close. */
export function frameDayIdx(state) {
  if (state === 'complete') return 4;
  if (state === 'awaiting') return 0;
  return 1;
}
