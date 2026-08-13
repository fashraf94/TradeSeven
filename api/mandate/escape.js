// api/mandate/escape.js
//
// Spec 1 — Mandate Substrate — the ESCAPE HATCH endpoint (§5.4, §7). A USER
// action (D-3), unlike the founder-only create endpoint: any authenticated user
// may escape their OWN first book once, within 14 days. Spec 2 (onboarding) is
// the real caller; Spec 1 ships it dark behind the master flag.
//
// AUTH CONTRACT (§7 / F29) — mirrors create.js MINUS the founder allowlist:
//   • Firebase ID token verified server-side; uid FROM THE TOKEN, never the body.
//   • The escape acts on the caller's OWN active book (userMeta.activeMandateId);
//     escapeMandate re-asserts book.userId === uid inside the transaction.
//   • Idempotent by a client-supplied requestKey (retry-safe).
//   • Gated dark by the MANAGED_MANDATE_ENABLED master (the §7 flag list has no
//     dedicated escape flag — escape rides the master; token auth + ownership
//     make it non-exploitable even after the master flips for dark acceptance).

import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { escapeMandate } from '../_utils/mandateEscape.js';
import { listArchetypeIds } from '../_utils/archetypeRegistry.js';
import { MANAGED_MANDATE_ENABLED } from '../../src/config/featureFlags.js';

export default async function handler(req, res) {
  // 1. CORS + rate limit (an escape is rare — a tight limit is fine).
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 5, windowMs: 60000 } })) {
    return;
  }
  // 2. Method
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  // 3. Firebase auth — uid from the token, never the body (§7).
  const user = await requireAuth(req, res);
  if (!user) return; // 401 already sent
  const uid = user.uid;

  // 4. Master gate (§7) — dark default. A 404 hides the endpoint's existence
  //    while the system is dark (the create endpoint uses 403 for its founder
  //    gate; escape has no founder gate, so a plain dark 404 is right).
  if (!MANAGED_MANDATE_ENABLED) {
    return res.status(404).json({ error: 'not_found' });
  }

  // 5. Validate body — the replacement archetype (+ optional requestKey).
  const { archetype, requestKey } = req.body || {};
  if (typeof archetype !== 'string' || !listArchetypeIds().includes(archetype)) {
    return res.status(400).json({
      error: 'invalid_archetype',
      message: `archetype must be one of: ${listArchetypeIds().join(', ')}`,
    });
  }

  // 6. Escape.
  const db = getFirebaseAdmin();
  try {
    const result = await escapeMandate(db, {
      userId: uid,
      archetype,
      requestKey: typeof requestKey === 'string' && requestKey ? requestKey : null,
    });

    if (!result.ok) {
      const status = ({
        unknown_archetype: 400,
        no_active_book: 409,
        escape_already_used: 409,
        escape_window_expired: 409,
        not_active: 409,
        concurrent_modification: 409,
        book_missing: 404,
        not_owner: 403,
      })[result.code] || 400;
      return res.status(status).json({ error: result.code || 'escape_failed' });
    }

    return res.status(result.idempotentReplay ? 200 : 201).json({
      success: true,
      oldMandateId: result.oldMandateId,
      newMandateId: result.newMandateId,
      vintageRef: result.vintageRef,
      managerAgentId: result.managerAgentId,
      cadenceTier: result.cadenceTier,
      quarterKey: result.quarterKey,
      nextRolloverAt: result.nextRolloverAt,
      idempotentReplay: result.idempotentReplay,
    });
  } catch (err) {
    console.error('[mandate/escape] internal error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
}
