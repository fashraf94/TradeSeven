import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { applySecurityMiddleware } from '../_utils/security.js';

export const config = { maxDuration: 10 };

/**
 * POST /api/agent/set-opponent
 *
 * Writes the CPU opponent portfolio and its starting prices to an existing
 * agentBattle document.  The CPU portfolio is generated client-side (needs the
 * full stock universe) but Firestore rules only allow Admin SDK writes for
 * non-whitelisted fields, so the client calls this endpoint instead.
 *
 * Body: { agentBattleId, opponent: { portfolio, bench }, startingPrices }
 */
export default async function handler(req, res) {
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 5, windowMs: 60000 } })) {
    return;
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { agentBattleId, opponent, startingPrices } = req.body;

  if (!agentBattleId || !opponent?.portfolio) {
    return res.status(400).json({ error: 'agentBattleId and opponent.portfolio required' });
  }

  const db = getFirebaseAdmin();

  try {
    const battleRef = db.collection('agentBattles').doc(agentBattleId);
    const battleSnap = await battleRef.get();

    if (!battleSnap.exists) {
      return res.status(404).json({ error: 'Agent battle not found' });
    }

    const battle = battleSnap.data();

    // Ownership check
    const uid = req.headers['x-user-uid'];
    if (battle.ownerId !== uid) {
      return res.status(403).json({ error: 'Not authorised' });
    }

    // Only allow writes to active battles
    if (battle.status !== 'active') {
      return res.status(409).json({ error: 'Battle is not active' });
    }

    // Freshness check — reject writes to battles older than 5 minutes
    const createdAt = new Date(battle.createdAt);
    const ageMs = Date.now() - createdAt.getTime();
    if (ageMs > 5 * 60 * 1000) {
      return res.status(409).json({ error: 'Battle too old for opponent init' });
    }

    // Idempotency — don't overwrite if opponent already set
    if (battle.opponent?.portfolio) {
      return res.status(200).json({ success: true, alreadySet: true });
    }

    // Merge CPU starting prices into the existing portfolio.startingPrices
    const mergedStartingPrices = {
      ...(battle.portfolio?.startingPrices || {}),
      ...(startingPrices || {}),
    };

    await battleRef.update({
      opponent: {
        portfolio: opponent.portfolio,
        bench: opponent.bench || null,
        username: 'CPU Opponent',
        odUserId: 'cpu',
      },
      'portfolio.startingPrices': mergedStartingPrices,
      updatedAt: new Date().toISOString(),
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[agent/set-opponent] Error:', error);
    return res.status(500).json({ error: 'Failed to set opponent', details: error.message });
  }
}
