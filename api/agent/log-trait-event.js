// api/agent/log-trait-event.js
//
// Phase 1B — trait/card telemetry sink, on the VERIFIED-WORKING persistence path.
//
// The shadow logger (logSignalDrops) writes to GCS, which has a known silent
// write failure in this environment. So this endpoint deliberately does NOT use
// it — it writes events to Firestore via the Admin SDK (getFirebaseAdmin), which
// is the verified-working path (and bypasses client security rules, so no new
// rule is needed and there is no silent permission-denied loss).
//
// Fire-and-forget from the client (logTraitEvent in agentService.js): a failure
// returns 500 so the caller's catch can log it — but it never blocks the UI.
// Additive telemetry only; performs no equip/seeding and touches no mechanics.

import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { isValidForgeId } from '../_utils/idValidation.js';

export const config = { maxDuration: 10 };

// The closed set of trait-layer events. Anything else is rejected (fail-closed).
const VALID_EVENTS = new Set([
  'trait_card_viewed',
  'trait_equipped',
  'trait_unequipped',
  'trait_strength_changed',
  'family_comprehension',
  'attribution_tag_engaged',
]);

const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : null);

export default async function handler(req, res) {
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 120, windowMs: 60_000 } })) {
    return;
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  const { event, agentId = null, traitId = null, family = null, detail = null } = req.body || {};
  if (!VALID_EVENTS.has(event)) {
    return res.status(400).json({ error: 'invalid_event' });
  }
  if (agentId != null && !isValidForgeId(agentId)) {
    return res.status(400).json({ error: 'invalid_agent_id' });
  }

  try {
    const db = getFirebaseAdmin(); // Admin SDK Firestore — the verified-working path.
    await db.collection('traitTelemetry').add({
      event,
      userId: user.uid,
      agentId: agentId || null,
      traitId: str(traitId, 64),
      family: str(family, 32),
      detail: str(detail, 200),
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[log-trait-event] Firestore write failed:', err?.message || err);
    return res.status(500).json({ error: 'log_failed' });
  }

  return res.status(200).json({ ok: true });
}
