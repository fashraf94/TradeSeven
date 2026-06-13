// api/tournament/lobby-join.js
//
// P10b — POST /api/tournament/lobby-join. Join one open lobby, resolved either
// by explicit `lobbyId` (the share-link path) or by typed `joinCode` (the
// 6-char private-invite path — findLobbyByJoinCode resolves it; a typo/closed
// code is an honest 404 code_not_found, never a 500). Double-join is idempotent
// (the service no-ops a re-seat). THE FILL-THE-4TH-SEAT TRIGGER: when the join
// makes the lobby full (4 humans), the group forms SYNCHRONOUSLY here (no cron),
// and the response carries `formed: { groupId, ... }`. Returns the joinLobby
// shape + `formed` (null when still waiting).

import { runLobbyEndpoint, resolveDisplayName } from '../_utils/lobbyEndpoint.js';
import { joinLobby, findLobbyByJoinCode, formGroupFromLobby } from '../_utils/tournamentLobbyService.js';
import { isValidForgeId } from '../_utils/idValidation.js';

export const config = { maxDuration: 30 };

export default function handler(req, res) {
  return runLobbyEndpoint(req, res, async ({ res, user, db, body }) => {
    const displayName = resolveDisplayName(body, user);

    // Resolve the target lobby: explicit id wins, else the typed join code.
    let lobbyId = null;
    if (typeof body.lobbyId === 'string' && body.lobbyId) {
      if (!isValidForgeId(body.lobbyId)) {
        res.status(400).json({ error: 'invalid_lobby_id', message: 'That game link looks malformed.' });
        return;
      }
      lobbyId = body.lobbyId;
    } else if (typeof body.joinCode === 'string' && body.joinCode.trim()) {
      const hit = await findLobbyByJoinCode(db, body.joinCode);
      if (!hit) {
        res.status(404).json({ error: 'code_not_found', message: 'No open game matched that code.' });
        return;
      }
      lobbyId = hit.id;
    } else {
      res.status(400).json({ error: 'missing_target', message: 'Enter a game code or link to join.' });
      return;
    }

    const result = await joinLobby(db, lobbyId, { odUserId: user.uid, displayName });

    // The 4th human seals the group — form it now, synchronously. Idempotent /
    // resume-safe (formGroupFromLobby returns alreadyFormed on a re-entry), so a
    // racing/retried fill never double-allocates.
    let formed = null;
    if (result.full) {
      formed = await formGroupFromLobby(db, lobbyId, {});
    }

    res.status(200).json({ ...result, formed });
  });
}
