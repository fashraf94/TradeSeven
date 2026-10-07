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
//
// A SMOKE SESSION READS THE DEV RECORD (BUG-002, the backing QA round 2): the
// founder on a preview, allowlisted, lives in the DEV namespace end to end —
// the pod list shows dev pods and names the `dev-{uid}` wallet, the stake
// route debits it — so this route, for that session alone, reads the
// `dev-{uid}` wallet and counts dev pools only. Before this, a test session's
// "Your record" read the EMPTY production record (dev pools skipped by
// design), so the private record had never been checked end to end in a
// browser. Every other caller is unchanged: the production wallet, dev pools
// skipped and counted as before. The two namespaces never meet in one figure,
// and the decision is made for the TOKEN's uid, as the pod list's, the stake
// route's and the event sink's are (LIGHT-1, the activation review record).

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { POOL_STATUS } from '../_utils/backingPools.js';
import { walletRef } from '../_utils/backingWallet.js';
import { STATS_NAMESPACE, computeMyStats, isDevPool, readExcludedStakeIds, readPoolsFor, readRanksFor, readStakesWhere } from '../_utils/backingStats.js';
import { backingLitFor, smokeOverrideFor } from '../_utils/backingSmoke.js';

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
  // Backing activation: the code flag, OR the founder smoke override for THIS
  // uid on a Vercel preview (api/_utils/backingSmoke.js) — never the bare flag.
  if (!backingLitFor(user.uid)) return res.status(404).json({ error: 'Not found' });

  const db = getFirebaseAdmin();
  const now = new Date();
  // THE NAMESPACE (BUG-002): a smoke session's record is the dev record — its
  // `dev-{uid}` wallet, dev pools only; everyone else's is the production one.
  const smoke = smokeOverrideFor(user.uid);
  const namespace = smoke ? STATS_NAMESPACE.DEV : STATS_NAMESPACE.PRODUCTION;
  try {
    // 5a. The viewer's own wallet (of this record's namespace) and own stakes.
    const [walletSnap, stakes] = await Promise.all([
      walletRef(db, user.uid, { dev: smoke }).get(),
      readStakesWhere(db, 'userId', user.uid),
    ]);
    const wallet = walletSnap.exists ? walletSnap.data() : null;
    // The admin `excluded` flags of the viewer's own stakes (§8: an excluded
    // stake leaves the stats and their net; settlement math never moves).
    const excluded = await readExcludedStakeIds(db, stakes.map((s) => s.id));

    // 5b. The pools those stakes name, then the rank docs of every human team
    // of every settled pool OF THIS RECORD'S NAMESPACE (the baseline's
    // source), read once each — in that namespace: the fold skips the other
    // namespace's pools, so their teams' ranks are never read, and a dev
    // record's baseline is judged against the dev rank docs, never the
    // production ones (the QA rounds 1–3 review, R3-2).
    const poolsByGroup = await readPoolsFor(db, stakes.map((s) => s.groupId));
    const humanTeams = new Set();
    for (const located of poolsByGroup.values()) {
      const { pool } = located;
      if (pool?.status !== POOL_STATUS.RESOLVED || isDevPool(located) !== smoke) continue;
      for (const t of Array.isArray(pool.teams) ? pool.teams : []) if (t?.isCpu !== true) humanTeams.add(t.odUserId);
    }
    const ranksByTeam = await readRanksFor(db, [...humanTeams], { dev: smoke });

    // 5c. The pure fold — in this record's one namespace.
    const stats = computeMyStats({ stakes, poolsByGroup, ranksByTeam, wallet, now, excluded, namespace });
    return res.status(200).json({ viewerUid: user.uid, ...stats });
  } catch (err) {
    console.error('[backing-my-stats] failed:', err?.message);
    return res.status(500).json({ error: 'server_error', message: 'Could not load your backing record.' });
  }
}
