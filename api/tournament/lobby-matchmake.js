// api/tournament/lobby-matchmake.js
//
// P10b — POST /api/tournament/lobby-matchmake. The public "Join a game" path:
// FIFO fill-to-4 (ruling 1) — seat the player in the OLDEST open matchmaking
// lobby with a free seat, or open a fresh one. THE FILL-THE-4TH-SEAT TRIGGER:
// if this seats the 4th human, the group forms SYNCHRONOUSLY here (no cron) and
// the response carries `formed`. Returns the matchmakeJoin shape (incl.
// `created`) + `formed` (null when still waiting).

import { runLobbyEndpoint, resolveDisplayName } from '../_utils/lobbyEndpoint.js';
import { matchmakeJoin, formGroupFromLobby } from '../_utils/tournamentLobbyService.js';

export const config = { maxDuration: 30 };

export default function handler(req, res) {
  return runLobbyEndpoint(req, res, async ({ res, user, db, body }) => {
    const result = await matchmakeJoin(db, {
      odUserId: user.uid,
      displayName: resolveDisplayName(body, user),
    });

    let formed = null;
    if (result.full) {
      formed = await formGroupFromLobby(db, result.id, {});
    }

    res.status(200).json({ ...result, formed });
  });
}
