// api/agent/log-watchlist-equip.js
//
// Telemetry-only endpoint for the onboarding "born-equipped" path. That path
// creates the agent with its starter watchlist already equipped in a single
// atomic client-side write (a deliberate choice to avoid a routing-gate race),
// which bypasses POST /api/agent/equip-watchlist and therefore its shadow-log
// emission. This endpoint emits the SAME `watchlist_equip` signal_drops entry
// so onboarding-time equip events still land in the telemetry/training stream.
//
// Scope is deliberately narrow: it ONLY emits the log. It performs no equip and
// re-introduces NONE of the equip endpoint's validation/gating (the ownership
// transaction, the committed-status check, the battle-active guard) — the equip
// already happened atomically at agent creation, so re-running those checks
// would be redundant and would reintroduce the race the born-equipped write
// exists to avoid.
//
// Unlike the equip endpoint's fire-and-forget emission
// (`logSignalDrops(...).catch(() => {})`), this surfaces failures: the call is
// awaited and any throw is logged + returned as a 500. Silent shadow-log loss
// is a known failure mode in this codebase, so an onboarding equip that fails
// to log should be visible rather than vanish.

import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { logSignalDrops } from '../_utils/shadowLogger.js';
import { isValidForgeId, FORGE_ID_REGEX, FORGE_ID_MAX_LEN } from '../_utils/idValidation.js';

export const config = { maxDuration: 10 };

export default async function handler(req, res) {
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 10, windowMs: 60_000 } })) {
    return;
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  const { agentId, watchlistId, equippedWatchlistName, equippedAt } = req.body || {};
  if (!isValidForgeId(agentId)) {
    return res.status(400).json({
      error: 'invalid_agent_id',
      message: `agentId must match ${FORGE_ID_REGEX} and be ≤${FORGE_ID_MAX_LEN} chars`,
    });
  }
  if (!isValidForgeId(watchlistId)) {
    return res.status(400).json({
      error: 'invalid_watchlist_id',
      message: `watchlistId must match ${FORGE_ID_REGEX} and be ≤${FORGE_ID_MAX_LEN} chars`,
    });
  }

  const nowIso = new Date().toISOString();
  try {
    // Mirror the equip endpoint's signal_drops entry exactly so onboarding-time
    // equips are indistinguishable downstream from endpoint-driven equips.
    // Awaited (not fire-and-forget) and NOT wrapped in a silent `.catch(() => {})`
    // so a failure surfaces.
    await logSignalDrops({
      stage: 'watchlist_equip',
      userId: user.uid,
      agentId,
      watchlistId,
      equippedWatchlistName: typeof equippedWatchlistName === 'string' ? equippedWatchlistName : null,
      equippedAt: typeof equippedAt === 'string' ? equippedAt : null,
      loggedAt: nowIso,
    });
  } catch (err) {
    console.error('[log-watchlist-equip] shadow-log emit failed:', err?.message || err);
    return res.status(500).json({ error: 'log_failed', message: 'Could not emit equip telemetry.' });
  }

  return res.status(200).json({ ok: true });
}
