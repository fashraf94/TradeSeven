// api/tournament/lobby-quickplay.js
//
// P10b — POST /api/tournament/lobby-quickplay. The solo cold-start: open a
// private lobby and IMMEDIATELY form a CPU-padded base-layer group (one human +
// three CPUs), playable from the next Monday. SYNCHRONOUS formation, ZERO cron
// (the P10a ruling). Thin over the service's quickPlay; isDev is never set (the
// service never sets it). Returns { lobbyId, groupId, humanCount, cpuNs }.

import { runLobbyEndpoint, resolveDisplayName } from '../_utils/lobbyEndpoint.js';
import { quickPlay } from '../_utils/tournamentLobbyService.js';

export const config = { maxDuration: 30 };

export default function handler(req, res) {
  return runLobbyEndpoint(req, res, async ({ res, user, db, body }) => {
    const result = await quickPlay(db, {
      odUserId: user.uid,
      displayName: resolveDisplayName(body, user),
    });
    res.status(200).json(result);
  });
}
