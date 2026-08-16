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
    // Composition write-epoch fence (design note §3): a closed epoch rejects the
    // provisioning write before anything is written — same 409 contract as the
    // fenced settings endpoints. Unreachable while the fence flag is dark.
    if (err?.code === 'epoch_closed') {
      return res.status(409).json({ error: 'epoch_closed', message: 'Agent identity is briefly locked for a migration. Try again shortly.' });
    }
    // B2 provisioner lease expiry — TRANSIENT and retryable, so it gets the same
    // 409 contract as the fence rather than a 500 (review finding R3,
    // 2026-08-16). A provisioning run whose write phase straddles the 120s TTL
    // aborts deliberately rather than write past a possible watermark, and the
    // caller should simply try again. Before the step 1.1 flip the lease was an
    // inert no-op object and this could never fire, so the code fell through to
    // the generic 500 — which told the client an unrecoverable server fault
    // when the right answer is "retry".
    //
    // ⚠ NOT atomic, stated precisely (review finding T3): on the RE-SYNC path
    // the currency check at casualClone.js:210 fires AFTER
    // copyAgentSubcollections has already refreshed the clone's rules/bundles
    // but BEFORE the doc-level loadout update, so an expiry there leaves a TORN
    // re-sync — new subcollections, stale archetype/equippedTraits/activeRules.
    // That state is self-healing: the next successful call re-runs the whole
    // re-sync. The 409 is still the right status precisely BECAUSE the retry is
    // what repairs it — but do not read this as "nothing was written".
    if (err?.code === 'provisioner_lease_expired') {
      return res.status(409).json({ error: 'provisioner_lease_expired', message: 'Preparing your agent took too long. Try again.' });
    }
    console.error('[ensure-casual-clone] error:', err);
    return res.status(500).json({ error: 'server_error', message: 'Could not prepare the casual agent.' });
  }
}
