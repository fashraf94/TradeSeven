// api/tournament/lobby-quickplay-training.js
//
// League Next-Arc Slice 3.1 / Training Slice 1+2 — POST
// /api/tournament/lobby-quickplay-training. The no-stakes TRAINING variant of
// the solo cold-start: open a private lobby and IMMEDIATELY form a CPU-padded
// base-layer pod (one human + three CPUs) flagged isTraining — the same solo-
// seat composition as ranked Quick Play, but ON-DEMAND. The Slice 3.0 exclusion
// spine keeps it off the leaderboard / career rank / bracket (it still banks
// its own daily closes). Thin over formTrainingDraft (which reuses
// quickPlay({ isTraining: true })); the live lobby-quickplay.js is byte-unchanged.
//
// Training Slice 2 (interactive draft): the form returns the pod in DRAFTING
// with its live-draft state, NOT a synchronously-resolved AWAITING_OPEN pod —
// the client navigates into the live snake draft. The five-day clock anchors at
// the transition-only completion handoff (and flips to AWAITING_OPEN/BATTLE
// there), not at the tap. (Sanctioned return-contract change, founder review.)
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
import { formTrainingDraft } from '../_utils/trainingLifecycle.js';
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
    const result = await formTrainingDraft(db, {
      odUserId: user.uid,
      displayName: resolveDisplayName(body, user),
    });
    res.status(200).json(result);
  });
}
