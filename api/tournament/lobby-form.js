// api/tournament/lobby-form.js
//
// P10b — POST /api/tournament/lobby-form. "Start now": the lobby creator pads
// the remaining seats with CPUs and forms the base-layer group BEFORE four
// humans arrive (the solo joiner who doesn't want to wait). SYNCHRONOUS, ZERO
// cron. OWNERSHIP: only the lobby's creator can start it (server-authoritative
// — a random joiner can't force-start someone else's game). Idempotent /
// resume-safe via formGroupFromLobby. Returns { groupId, humanCount, cpuNs,
// alreadyFormed }.

import { runLobbyEndpoint } from '../_utils/lobbyEndpoint.js';
import { formGroupFromLobby } from '../_utils/tournamentLobbyService.js';
import { isValidForgeId } from '../_utils/idValidation.js';
import { TOURNAMENT_LOBBY_COLLECTION } from '../../src/constants/leagueTournament.js';

export const config = { maxDuration: 30 };

export default function handler(req, res) {
  return runLobbyEndpoint(req, res, async ({ res, user, db, body }) => {
    const lobbyId = body.lobbyId;
    if (!isValidForgeId(lobbyId)) {
      res.status(400).json({ error: 'invalid_lobby_id', message: 'That game looks malformed.' });
      return;
    }

    // Ownership assertion (mirrors flip.js owner-only): read the lobby, confirm
    // the caller created it, THEN form. A missing lobby is an honest 404.
    const snap = await db.collection(TOURNAMENT_LOBBY_COLLECTION).doc(lobbyId).get();
    if (!snap.exists) {
      res.status(404).json({ error: 'lobby_not_found', message: 'That game could not be found.' });
      return;
    }
    if (snap.data().createdBy !== user.uid) {
      res.status(403).json({ error: 'not_lobby_owner', message: 'Only the player who created this game can start it.' });
      return;
    }

    const formed = await formGroupFromLobby(db, lobbyId, {});
    res.status(200).json(formed);
  });
}
