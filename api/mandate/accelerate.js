// api/mandate/accelerate.js
//
// Spec 1 — Mandate Substrate — the ACCELERATED-CLOCK harness endpoint (§9
// acceptance item 5, P4). FOUNDER-ONLY and DARK — same gate as the create
// endpoint (MANDATE_FOUNDER_CREATE_ENABLED + an allowlisted uid; a flag alone is
// not authorization). It drives the real lifecycle cores through a fast-forwarded
// rollover / catch-up / escape against the live (dark) db so the §9 acceptance
// run can observe capital carried, the FR-1 assertion firing, per-boundary
// summaries (incl. empty:true), and the escape reset — without waiting a quarter.
//
// This is founder/dev machinery: it CREATES synthetic backdated books and seeds
// synthetic rows. It is inert unless a founder both holds the flag and is
// allowlisted, so it can never run for a real user or in production-with-flag-off.

import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { runScenario, acceleratedScenarios } from '../_utils/mandateAcceleratedClock.js';
import { isFounderAuthorized, founderAllowlist } from './create.js';
import { MANDATE_FOUNDER_CREATE_ENABLED } from '../../src/config/featureFlags.js';

export default async function handler(req, res) {
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 5, windowMs: 60000 } })) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = await requireAuth(req, res);
  if (!user) return; // 401 already sent
  const uid = user.uid;

  // Founder gate — flag AND allowlist (same contract as create.js). Do not reveal
  // which condition failed.
  if (!isFounderAuthorized(uid, MANDATE_FOUNDER_CREATE_ENABLED, founderAllowlist())) {
    return res.status(403).json({ error: 'forbidden' });
  }

  const { scenario, archetype, replacementArchetype } = req.body || {};
  if (!acceleratedScenarios().includes(scenario)) {
    return res.status(400).json({ error: 'unknown_scenario', scenarios: acceleratedScenarios() });
  }

  const db = getFirebaseAdmin();
  try {
    const result = await runScenario(db, { scenario, archetype, replacementArchetype, now: new Date() });
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error('[mandate/accelerate] scenario error', err);
    return res.status(500).json({ error: 'internal_error', message: err.message });
  }
}
