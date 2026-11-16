// api/tournament/battle-view.js
//
// P7 — GET /api/tournament/battle-view?groupId=...  The spectator read path for
// the flat6 tournament battle view. The agentBattles read rule is owner-private
// (firestore.rules:471-472), so a spectator cannot read another player's battle
// doc directly. This authenticated endpoint reads the group's battles via the
// Admin SDK (rule-exempt) and returns each one PROJECTED for the requester.
//
// FOUNDER RULING R-F (15 Nov 2026, security pack): "Spectating stays possible.
// The fix is what a non-owner can see, at any battle status." The viewer's own
// seat is returned in full; every other seat gets the allowlist projection at
// EVERY status — completion opens nothing more, so a rival's chat, instruction,
// list, hot bench, reasoning, proposals, guardrail levels, loadout and frozen
// idea (`equippedHypothesis`, Pilot P1b) never leave the server. No account id
// travels either: `battles` is keyed by SEAT (the owner's index in the group
// document's `players`, '0'..'3'), never by owner, and the projection carries
// no `ownerId`. The client joins a seat back to its player through the same
// group document it already subscribes to (battlesByOwnerFromSeats). See
// api/_utils/tournamentBattleView.js and
// docs/audits/20261115_FIX_SECURITY_PACK_LEAGUE_VIEW.md.
//
// Read-only: no writes, no cron, no new firestore rule (the projection at the
// boundary is what the rule relaxation could never do). No membership check:
// spectating stays possible (R-F). Participant mode does NOT use this endpoint
// — a player reads their OWN battle live via onSnapshot (rule-allowed); this
// is purely the cross-owner spectator path.

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { isValidForgeId } from '../_utils/idValidation.js';
import { TOURNAMENT_GAME_MODE, TOURNAMENT_GROUPS_COLLECTION } from '../../src/constants/leagueTournament.js';
import { projectBattlesBySeat } from '../_utils/tournamentBattleView.js';

export const config = { maxDuration: 10 };

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }
  const user = await requireAuth(req, res);
  if (!user) return;
  const viewerUid = user.uid;

  const groupId = typeof req.query?.groupId === 'string' ? req.query.groupId : '';
  if (!isValidForgeId(groupId)) {
    return res.status(400).json({ error: 'invalid_group_id', message: 'A valid groupId is required.' });
  }

  try {
    const db = getFirebaseAdmin();
    // The seat order: the group document's `players` (R-F — battles are keyed
    // by seat). A missing group seats nobody, so it answers no battles.
    const groupSnap = await db.collection(TOURNAMENT_GROUPS_COLLECTION).doc(groupId).get();
    const players = groupSnap.exists ? (groupSnap.data()?.players || []) : [];
    // Single equality filter (groupId) — automatic single-field index, no
    // composite index needed. Tournament battles only; tiered battles never
    // carry a groupId so they can't surface here even if one slipped through.
    const snap = await db.collection('agentBattles').where('groupId', '==', groupId).get();
    const raw = [];
    snap.forEach((doc) => {
      const data = doc.data();
      if (data.gameMode === TOURNAMENT_GAME_MODE) raw.push({ id: doc.id, ...data });
    });

    const battles = projectBattlesBySeat(raw, players, viewerUid);
    return res.status(200).json({ groupId, viewerUid, battles });
  } catch (err) {
    console.error('[Tournament] battle-view error:', err);
    return res.status(500).json({ error: 'server_error', message: 'Could not load the battle view.' });
  }
}
