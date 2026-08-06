// api/agent/ensure-casual-clone.js
//
// POST /api/agent/ensure-casual-clone — get-or-create the caller's PERSISTENT
// casual clone (agents/casual-agent-{odUserId}) and return its agentId. The
// client deploy path (src/services/agentDeploy.js) calls this BEFORE POSTing
// /api/agent/decide so a Command-Center BaggerBomb deploy runs on the clone, not
// the real ranked agent (Per-Battle Loadout + Concurrency Phase 1). Still ONE
// deploy path — this only resolves WHICH agentId decide receives.
//
// WHY A SERVER ENDPOINT (not a client helper, design-lock Option A): a faithful
// clone inherits the ranked agent's LOADED fields (activeRules / equippedTraits /
// deployedStrategy / consolidatedInsight …), and the agents create rule
// (firestore.rules:171-220) deliberately FORBIDS a client from minting a loaded
// agent. So creation must be Admin SDK (which bypasses rules) — this thin authed
// wrapper over the pure ensureCasualClone helper (testable in isolation).
//
// SECURITY (design-lock addition #1): odUserId is derived from the AUTH TOKEN,
// never the request body, and the parent is resolved by ownerId == the caller —
// so the endpoint can ONLY clone the caller's OWN ranked agent. There is no
// body-supplied id to spoof, so the minting hole the rules close is NOT reopened
// at the endpoint layer.
//
// IDEMPOTENT + NEVER-OVERWRITE (design-lock addition #2): ensureCasualClone
// returns an existing clone AS-IS, so a repeat deploy never wipes the accumulated
// memory/lessons/insight the redirects fold forward.

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { ensureCasualClone } from '../_utils/casualClone.js';
import { CASUAL_CLONE_CONCURRENCY_ENABLED } from '../../src/config/featureFlags.js';

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

  // Server-side flag gate (defense-in-depth): a casual clone is minted ONLY while
  // the SERVER flag is on, whatever the client believes. Flag-off → never created.
  if (!CASUAL_CLONE_CONCURRENCY_ENABLED) {
    return res.status(403).json({ error: 'feature_disabled', message: 'Casual concurrency is not enabled.' });
  }

  const db = getFirebaseAdmin();
  try {
    // odUserId from the TOKEN (user.uid), never the body; ensureCasualClone
    // resolves the parent by ownerId == this uid, so only the caller's OWN ranked
    // agent is ever cloned.
    const { cloneId, rankedAgentId, created } = await ensureCasualClone(db, { odUserId: user.uid });
    return res.status(200).json({ cloneId, rankedAgentId, created });
  } catch (err) {
    if (err?.message === 'no_ranked_agent') {
      return res.status(409).json({ error: 'no_ranked_agent', message: 'Create your agent before deploying.' });
    }
    console.error('[ensure-casual-clone] error:', err);
    return res.status(500).json({ error: 'server_error', message: 'Could not prepare the casual agent.' });
  }
}
