// api/tournament/live-composites.js
//
// Phase B (B-server) — GET /api/tournament/live-composites?groupId=...
// The server-computed per-seat LIVE composite for the League arena. Returns ONLY
// { groupId, composites: { [odUserId]: liveComposite } } — scalars, never rival
// holdings/positions/reasoning (Ruling 1). It exposes no new information: each
// rival's BANKED composite is already visible on the leaderboard; this makes the
// same quantity live.
//
// WHY server-side (B1 hard-stop): rival agent-six holdings live in owner-scoped
// agentBattles docs the client cannot read (firestore.rules), and the arena hook
// is owner-only. The Admin SDK (rule-exempt) is the only place a per-rival live
// composite can be formed. Mirrors api/tournament/battle-view.js: authenticated
// read, Admin-SDK group read, no writes, no cron, no new firestore rule/index.
//
// Freshness path (a): the agent half is the per-owner scoreState.currentScore
// total via fetchGroupAgentScores (fresh to the last ~15-min agent-evaluate pass);
// the user half is recomputed live from this-request quotes. Path (b) — live-
// recompute the rival agent half — is a parked fast-follow, not built here.
//
// FENCE: this endpoint CALLS scorePick / resolveBaseATR / loadAtrPercentiles
// (fenced tournamentUserScoring.js) and fetchGroupAgentScores / computeComposite
// — calling is BUILD_RULES §1 permitted; no fenced edit, no persistence.
//
// DARK/INERT on merge: nothing consumes it yet (B-client is a separate task).

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { isValidForgeId } from '../_utils/idValidation.js';
import { TOURNAMENT_GROUPS_COLLECTION } from '../../src/constants/leagueTournament.js';
import { fetchGroupAgentScores } from '../_utils/tournamentBanking.js';
import { fetchBatchQuotes } from '../_utils/tournamentPrices.js';
import { loadAtrPercentiles } from '../_utils/tournamentUserScoring.js';
import { computeGroupLiveComposites, collectGroupUserSymbols } from '../_utils/tournamentLiveComposite.js';

export const config = { maxDuration: 10 };

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }
  const user = await requireAuth(req, res);
  if (!user) return;

  const groupId = typeof req.query?.groupId === 'string' ? req.query.groupId : '';
  if (!isValidForgeId(groupId)) {
    return res.status(400).json({ error: 'invalid_group_id', message: 'A valid groupId is required.' });
  }

  try {
    const db = getFirebaseAdmin();

    const groupSnap = await db.collection(TOURNAMENT_GROUPS_COLLECTION).doc(groupId).get();
    if (!groupSnap.exists) {
      return res.status(404).json({ error: 'group_not_found' });
    }
    const group = groupSnap.data();

    // Agent half (all seats incl. CPU): Σ scoreState.currentScore per owner — a
    // single field-masked equality query (no new index). User half: one batch
    // quote over the pod's held ∪ dropped symbols + the shared ATR basis banking
    // uses. Pre-transaction / read-only, degrade-not-throw on price loss.
    const [agentScores, atrPercentiles] = await Promise.all([
      fetchGroupAgentScores(db, groupId),
      loadAtrPercentiles(db),
    ]);
    const symbols = collectGroupUserSymbols(group);
    const quotes = symbols.length > 0 ? await fetchBatchQuotes(symbols) : {};

    const composites = computeGroupLiveComposites(group, agentScores, quotes, atrPercentiles);

    return res.status(200).json({ groupId, composites });
  } catch (err) {
    console.error('[Tournament] live-composites error:', err);
    return res.status(500).json({ error: 'server_error', message: 'Could not compute live composites.' });
  }
}
