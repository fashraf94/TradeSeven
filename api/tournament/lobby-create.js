// api/tournament/lobby-create.js
//
// P10b — POST /api/tournament/lobby-create. Open a waiting lobby seated by its
// creator. Defaults to a PRIVATE lobby (the founder's invite-known-beta-users
// path) so the creator gets a shareable 6-char join code; pass mode
// 'matchmaking' for a public FIFO lobby. Does NOT form (an OPEN lobby — it
// forms later when a 4th human joins, or via "Start now"/lobby-form).
// Returns { lobbyId, lobby: { id, ...doc } } (the doc carries joinCode when
// private — the share token).

import { runLobbyEndpoint, resolveDisplayName } from '../_utils/lobbyEndpoint.js';
import { createLobby } from '../_utils/tournamentLobbyService.js';
import { LOBBY_MODE } from '../../src/constants/leagueTournament.js';

export const config = { maxDuration: 10 };

export default function handler(req, res) {
  return runLobbyEndpoint(req, res, async ({ res, user, db, body }) => {
    // "Create a group" is invite-first → PRIVATE (shareable) unless the caller
    // explicitly asks for a public matchmaking lobby.
    const mode = body.mode === LOBBY_MODE.MATCHMAKING ? LOBBY_MODE.MATCHMAKING : LOBBY_MODE.PRIVATE;
    const { id, doc } = await createLobby(db, {
      createdBy: user.uid,
      displayName: resolveDisplayName(body, user),
      mode,
    });
    res.status(200).json({ lobbyId: id, lobby: { id, ...doc } });
  });
}
