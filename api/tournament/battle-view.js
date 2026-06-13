// api/tournament/battle-view.js
//
// P7 — GET /api/tournament/battle-view?groupId=...  The spectator read path for
// the flat6 tournament battle view. The agentBattles read rule is owner-private
// (firestore.rules:201-202), so a spectator cannot read another player's battle
// doc directly. This authenticated endpoint reads the group's battles via the
// Admin SDK (rule-exempt) and returns each one PROJECTED for the requester:
// full WHY for the owner or for completed battles, WHAT-only for a non-owner's
// view of an active battle (founder ruling, P7 Stage A — conceal live WHY
// server-side, never by client non-render). See api/_utils/tournamentBattleView.js.
//
// Read-only: no writes, no cron, no new firestore rule (the projection at the
// boundary is what the rule relaxation could never do). Participant mode does
// NOT use this endpoint — a player reads their OWN battle live via onSnapshot
// (rule-allowed); this is purely the cross-owner spectator path.

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { isValidForgeId } from '../_utils/idValidation.js';
import { TOURNAMENT_GAME_MODE } from '../../src/constants/leagueTournament.js';
import { projectTournamentBattle, pickCurrentBattlesByOwner } from '../_utils/tournamentBattleView.js';

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
    // Single equality filter (groupId) — automatic single-field index, no
    // composite index needed. Tournament battles only; tiered battles never
    // carry a groupId so they can't surface here even if one slipped through.
    const snap = await db.collection('agentBattles').where('groupId', '==', groupId).get();
    const raw = [];
    snap.forEach((doc) => {
      const data = doc.data();
      if (data.gameMode === TOURNAMENT_GAME_MODE) raw.push({ id: doc.id, ...data });
    });

    const currentByOwner = pickCurrentBattlesByOwner(raw);
    const battles = {};
    for (const [ownerId, battle] of Object.entries(currentByOwner)) {
      battles[ownerId] = projectTournamentBattle(battle, { isOwner: ownerId === viewerUid });
    }

    return res.status(200).json({ groupId, viewerUid, battles });
  } catch (err) {
    console.error('[Tournament] battle-view error:', err);
    return res.status(500).json({ error: 'server_error', message: 'Could not load the battle view.' });
  }
}
