// api/tournament/lobby-quickplay-training.js
//
// League Next-Arc Slice 3.1 — POST /api/tournament/lobby-quickplay-training.
// The no-stakes TRAINING variant of the solo cold-start: open a private lobby
// and IMMEDIATELY form a CPU-padded base-layer pod (one human + three CPUs)
// flagged isTraining — the SAME solo-seat composition and the SAME Monday-start
// cadence as ranked Quick Play, but the Slice 3.0 exclusion spine keeps it off
// the leaderboard / career rank / bracket (it still banks its own daily closes
// and its agent layer is deployed + ticked by the existing engine, keyed by
// groupId). Thin over the service's quickPlay({ isTraining: true }); the live
// lobby-quickplay.js is left byte-unchanged.
//
// GATED AS A WHOLE — built dark, NO CTA (that is Slice 3.2). The base lobby
// surface gate (LEAGUE_LOBBY_ENABLED), Bearer-ID-token auth, and the service-
// error -> HTTP map are inherited from runLobbyEndpoint, so this route can
// never diverge from the ranked path. ON TOP of that, the training branch is
// reachable ONLY when LEAGUE_NEXT_ARC_ENABLED is on (no-flip in a build PR — the
// PR #510 lesson) OR via the founder's dev-invoke preview param ?nextArc=1 (the
// ?leagueRealData=1 idiom), so it can be smoked on a Vercel preview while the
// flag stays OFF. Off + no param -> 404, indistinguishable from a missing route.

import { runLobbyEndpoint, resolveDisplayName } from '../_utils/lobbyEndpoint.js';
import { quickPlay } from '../_utils/tournamentLobbyService.js';
import { LEAGUE_NEXT_ARC_ENABLED } from '../../src/config/featureFlags.js';

export const config = { maxDuration: 30 };

export default function handler(req, res) {
  return runLobbyEndpoint(req, res, async ({ req, res, user, db, body }) => {
    // The training gate sits AFTER the shared lobby flag + auth (inside the
    // wrapper) so LEAGUE_LOBBY_ENABLED off still yields the sibling's
    // lobby_disabled; here we add the Next-Arc-specific dark gate.
    if (!(LEAGUE_NEXT_ARC_ENABLED === true || req.query?.nextArc === '1')) {
      return res.status(404).json({ error: 'training_disabled', message: 'Training mode is not available.' });
    }
    const result = await quickPlay(db, {
      odUserId: user.uid,
      displayName: resolveDisplayName(body, user),
      isTraining: true,
    });
    res.status(200).json(result);
  });
}
