// api/mandate/drain.js
//
// Spec 1 — Mandate Substrate — the DRAIN PROTOCOL endpoint (§3.3 / F26, P5).
// FOUNDER-ONLY and DARK — the same gate as create/accelerate
// (MANDATE_FOUNDER_CREATE_ENABLED + an allowlisted uid; a flag alone is not
// authorization; the P4 ambiguity-4 precedent: founder ops machinery reuses the
// founder flag, no new flag, no flag-pin churn).
//
// A MANDATE_TRANSPORT_MODE change takes effect only after every open batch is
// harvested or cancelled with its undelivered decisions written rejected_stale
// (§3.3). This endpoint is that protocol made EXPLICIT AND INVOCABLE — never an
// implicit side effect of the config flip: the founder flips the mode (a
// separate one-line config PR), invokes this, and books gated on old-mode
// batches return to submit-eligibility immediately. Without it the automatic
// backstops still release every book — the eval sweep expires any gate older
// than MANDATE_RESULT_MAX_AGE_MS on its next fire under EITHER transport
// (MANDATE_GATE_EXPIRED), and the close pass's once-daily expiry duty layers
// beneath that — but the drain is the prompt path, and the only one that
// finishes the BATCH DOCS (an undrained doc waits on founder action or the
// 30-day MANDATE_BATCH_STUCK_OPEN alert). Idempotent: already-terminal
// entries and already-finalized batches no-op; re-invoke until `batches: 0`
// (an incomplete pass logs MANDATE_DRAIN_INCOMPLETE loudly).
//
// Mode-agnostic by design: draining under EITHER transport mode is safe (it
// only disposes open submissions), so the flip order (flip-then-drain or
// drain-then-flip) cannot corrupt anything — openBatchId gating covers the gap.

import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { drainOpenBatches } from '../_utils/mandateBatchTransport.js';
import { isFounderAuthorized, founderAllowlist } from './create.js';
import { MANDATE_FOUNDER_CREATE_ENABLED } from '../../src/config/featureFlags.js';

export default async function handler(req, res) {
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 5, windowMs: 60000 } })) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = await requireAuth(req, res);
  if (!user) return; // 401 already sent

  // Founder gate — flag AND allowlist (same contract as create.js). Do not
  // reveal which condition failed.
  if (!isFounderAuthorized(user.uid, MANDATE_FOUNDER_CREATE_ENABLED, founderAllowlist())) {
    return res.status(403).json({ error: 'forbidden' });
  }

  const db = getFirebaseAdmin();
  try {
    const result = await drainOpenBatches(db, { now: new Date() });
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error('[mandate/drain] drain error', err);
    return res.status(500).json({ error: 'internal_error', message: err.message });
  }
}
