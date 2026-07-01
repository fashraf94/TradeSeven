// api/agent/chat-budget.js
//
// GET — the League arena "Ask your agent" per-day remaining count, for the on-open
// counter ("N left today"). READ-ONLY: no agent call, no charge — it never mutates
// the budget. The count stays server-authoritative and is NEVER computed on the
// client (the agentChatBudget collection is server-only in firestore.rules; the
// count reaches the arena only through this response and the POST /api/agent/chat
// response).
//
// The game-day dayN is derived server-side from the group doc (deriveCurrentTradingDay
// — the same index the daily close writes), exactly as the POST budget gate does, so
// the counter and the charge always agree on "today".

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { LEAGUE_AGENT_CHAT_ENABLED } from '../../src/config/featureFlags.js';
import { resolveBudgetDay, readAgentChatBudget } from '../_utils/agentChatBudget.js';

export const config = { maxDuration: 10 };

export default async function handler(req, res) {
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 30, windowMs: 60000 } })) {
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  // Feature off => nothing to report (the arena keeps its stub and never calls this).
  if (!LEAGUE_AGENT_CHAT_ENABLED) {
    return res.status(200).json({ remaining: null });
  }

  const battleId = req.query?.battleId;
  if (!battleId) {
    return res.status(400).json({ error: 'battleId is required' });
  }

  const db = getFirebaseAdmin();

  try {
    const battleDoc = await db.collection('agentBattles').doc(String(battleId)).get();
    if (!battleDoc.exists) {
      return res.status(404).json({ error: 'Battle not found' });
    }
    const battle = battleDoc.data();
    if (battle.ownerId !== user.uid) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // The SAME group-read + dayN derivation the POST charge uses, so the counter and
    // the charge never disagree on "today". null => the budget is unkeyable (non-
    // tournament, or a group/read failure) => remaining null so the arena HIDES the
    // counter rather than showing a frozen full count it can't actually track.
    const key = await resolveBudgetDay(db, battle);
    if (!key) {
      return res.status(200).json({ remaining: null, dayN: null });
    }

    const { remaining } = await readAgentChatBudget(db, { groupId: key.groupId, uid: user.uid, dayN: key.dayN });
    return res.status(200).json({ remaining, dayN: key.dayN });
  } catch (error) {
    console.error('[LeagueChatBudget] read failed:', error?.message);
    // Never block the arena on a counter read — unknown => null (counter hidden).
    return res.status(200).json({ remaining: null, dayN: null });
  }
}
