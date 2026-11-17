// api/_utils/leagueHidden.js
//
// League hide (direction note BB-1; founder rulings Q1 and Q4 of Nov 15, 2026) — the ONE typed refusal the league's
// entry endpoints answer while LEAGUE_HIDE_ENABLED is on: slot-claim and the six lobby-* routes (create, form, join,
// matchmake, quickplay, quickplay-training). It takes the shape the lobby's own "disabled" path returns (a 404 with
// { error, message }, lobbyEndpoint.js), under its own key so a caller can tell "the league is hidden" from "the lobby
// is off".
//
// Read by the two transport wrappers only (lobbyEndpoint.js runLobbyEndpoint; liveDraftEndpoint.js runSlotEndpoint, for a
// route that names itself an entry door). The in-week endpoints (live-draft-pick, slot-release, training-pick,
// activate-training-pod, commit-board, flip, place-claim), the read-only views and the operator levers never call it,
// so a group already in flight can still be played and settled; no job reads the flag either.
//
// Imports the zero-import flag module from src/ under the revised June 2026 import rule (BUILD_RULES §4); the
// endpoint tests' real import of a route that reaches this file is the dependency-surface guard for that edge.

import { LEAGUE_HIDE_ENABLED } from '../../src/config/featureFlags.js';

export const LEAGUE_HIDDEN_ERROR = 'league_hidden';
export const LEAGUE_HIDDEN_MESSAGE = 'The league is not available right now.';

/**
 * While the league is hidden: answer the refusal and return true (the caller returns at once). Otherwise do nothing and
 * return false. Called after the method guard and before auth, where the lobby's own "disabled" path sits.
 */
export function refuseWhenLeagueHidden(res) {
  if (LEAGUE_HIDE_ENABLED !== true) return false;
  res.status(404).json({ error: LEAGUE_HIDDEN_ERROR, message: LEAGUE_HIDDEN_MESSAGE });
  return true;
}
