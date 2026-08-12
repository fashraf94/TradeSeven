// api/mandate/create.js
//
// Spec 1 — Mandate Substrate — the FOUNDER-GATED creation endpoint (§5.2, §7).
// Spec 1 is headless (§1); this endpoint exists only so the founder can mint
// books for dark testing. Spec 2 will call mandateCreationService directly from
// onboarding for real users.
//
// AUTH CONTRACT (§7 / F29):
//   • Firebase ID token verified server-side; uid derived FROM THE TOKEN, never
//     the request body.
//   • Founder-only: requires BOTH MANDATE_FOUNDER_CREATE_ENABLED AND an
//     allowlisted uid — a flag alone is not authorization, and an allowlisted
//     uid without the flag is not either.
//   • book.userId === uid: the book is created for the authenticated founder;
//     body-supplied user ids are untrusted and ignored.
//   • Idempotent by a client-supplied requestKey (retry-safe).
//
// The founder allowlist is an env var (MANDATE_FOUNDER_UIDS, comma-separated),
// never a hardcoded uid — the uid stays out of the repo, and an unset/empty
// allowlist fails closed (nobody is a founder).

import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { createMandate } from '../_utils/mandateCreationService.js';
import { listArchetypeIds } from '../_utils/archetypeRegistry.js';
import { MANDATE_FOUNDER_CREATE_ENABLED } from '../../src/config/featureFlags.js';

export function founderAllowlist() {
  return (process.env.MANDATE_FOUNDER_UIDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * §7 founder authorization — BOTH conditions required. Pure/exported so the
 * "a flag alone is not authorization (and an allowlisted uid alone is not
 * either)" property is directly testable.
 */
export function isFounderAuthorized(uid, flagEnabled, allowlist) {
  return Boolean(flagEnabled) && Array.isArray(allowlist) && allowlist.includes(uid);
}

export default async function handler(req, res) {
  // 1. CORS + rate limit
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 5, windowMs: 60000 } })) {
    return;
  }

  // 2. Method
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 3. Firebase auth — uid from the token, never the body (§7)
  const user = await requireAuth(req, res);
  if (!user) return; // 401 already sent
  const uid = user.uid;

  // 4. Founder gate — flag AND allowlist, both required (§7). Do not reveal to
  //    the caller WHICH condition failed.
  if (!isFounderAuthorized(uid, MANDATE_FOUNDER_CREATE_ENABLED, founderAllowlist())) {
    return res.status(403).json({ error: 'forbidden' });
  }

  // 5. Validate body — only the archetype (+ optional requestKey) is honored;
  //    the userId is the authenticated founder, never the body.
  const { archetype, requestKey } = req.body || {};
  if (typeof archetype !== 'string' || !listArchetypeIds().includes(archetype)) {
    return res.status(400).json({
      error: 'invalid_archetype',
      message: `archetype must be one of: ${listArchetypeIds().join(', ')}`,
    });
  }

  // 6. Create
  const db = getFirebaseAdmin();
  try {
    const result = await createMandate(db, {
      userId: uid,
      archetype,
      requestKey: typeof requestKey === 'string' && requestKey ? requestKey : null,
    });

    if (!result.ok) {
      if (result.code === 'active_book_exists') {
        return res.status(409).json({ error: 'active_book_exists', activeMandateId: result.activeMandateId });
      }
      if (result.code === 'unknown_archetype') {
        return res.status(400).json({ error: 'unknown_archetype' });
      }
      return res.status(400).json({ error: result.code || 'create_failed' });
    }

    return res.status(result.idempotentReplay ? 200 : 201).json({
      success: true,
      mandateId: result.mandateId,
      vintageRef: result.vintageRef,
      vintagePublished: result.vintagePublished,
      managerAgentId: result.managerAgentId,
      cadenceTier: result.cadenceTier,
      quarterKey: result.quarterKey,
      nextRolloverAt: result.nextRolloverAt,
      escapeHatchEligibleUntil: result.escapeHatchEligibleUntil,
      idempotentReplay: result.idempotentReplay,
    });
  } catch (err) {
    console.error('[mandate/create] internal error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
}
