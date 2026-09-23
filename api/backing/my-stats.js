// api/backing/my-stats.js
//
// GET /api/backing/my-stats — Backing Beta PR 5, MY BACKING STATS, PRIVATE
// (spec V1.3 §5 "My Backing stats — private. Net BP (season, career), pools
// backed, pools won, accuracy versus the naive baseline (§10), weeks played.
// No public ranked leaderboard in the beta (D-v)"; §8 why it is private).
//
// THE ORDER, the same rungs every backing route climbs:
//   1  security middleware + rate limit
//   2  method — GET only
//   3  auth — the uid from the VERIFIED token; NO query parameter names a user
//   4  THE FLAG — 404 while BACKING_BETA_ENABLED is dark, AFTER auth
//   5  the viewer's wallet, the viewer's stakes, their pools, the rank docs
//      the baseline needs, the pure fold (api/_utils/backingStats.js)
//
// OWNER ONLY, BY CONSTRUCTION: the one identity this route reads for is the
// token's uid. There is no `uid`, `userId` or `odUserId` query parameter and
// none is honoured — a request that carries one gets the caller's own record,
// exactly as if it had not. Nothing here is a ranking, a comparison to any
// other player, or a consequence (§9, D-v): the response names one person's
// record and the naive baseline's, and the baseline is a rule, not a rival.
//
// READS ONLY. Net BP is the wallet's own cached ledger figure (§6
// ledger-first), never re-summed here.

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { POOL_STATUS } from '../_utils/backingPools.js';
import { walletRef } from '../_utils/backingWallet.js';
import { computeMyStats, readPoolsFor, readRanksFor, readStakesWhere } from '../_utils/backingStats.js';
import { BACKING_BETA_ENABLED } from '../../src/config/featureFlags.js';

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  // 1. Security middleware + rate limit.
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 60, windowMs: 60000 } })) return;

  // 2. Method.
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed. Use GET.' });

  // 3. Auth — the ONLY identity this route reads for.
  const user = await requireAuth(req, res);
  if (!user) return;

  // 4. THE FLAG, read at call time, after auth.
  if (!BACKING_BETA_ENABLED) return res.status(404).json({ error: 'Not found' });

  const db = getFirebaseAdmin();
  const now = new Date();
  try {
    // 5a. The viewer's own wallet (production namespace) and own stakes.
    const [walletSnap, stakes] = await Promise.all([
      walletRef(db, user.uid).get(),
      readStakesWhere(db, 'userId', user.uid),
    ]);
    const wallet = walletSnap.exists ? walletSnap.data() : null;

    // 5b. The pools those stakes name, then the rank docs of every human team
    // of every settled pool (the baseline's source), read once each.
    const poolsByGroup = await readPoolsFor(db, stakes.map((s) => s.groupId));
    const humanTeams = new Set();
    for (const { pool } of poolsByGroup.values()) {
      if (pool?.status !== POOL_STATUS.RESOLVED) continue;
      for (const t of Array.isArray(pool.teams) ? pool.teams : []) if (t?.isCpu !== true) humanTeams.add(t.odUserId);
    }
    const ranksByTeam = await readRanksFor(db, [...humanTeams]);

    // 5c. The pure fold.
    const stats = computeMyStats({ stakes, poolsByGroup, ranksByTeam, wallet, now });
    return res.status(200).json({ viewerUid: user.uid, ...stats });
  } catch (err) {
    console.error('[backing-my-stats] failed:', err?.message);
    return res.status(500).json({ error: 'server_error', message: 'Could not load your backing record.' });
  }
}
