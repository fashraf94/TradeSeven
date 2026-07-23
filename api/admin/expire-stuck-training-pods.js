// api/admin/expire-stuck-training-pods.js
//
// Training-Pod P0 R3 — the founder-gated ONE-TIME cleanup of the stuck-pod
// census. POST /api/admin/expire-stuck-training-pods. Retires training pods
// stranded pre-BATTLE (FORMING orphans, wedged DRAFTING drafts, AWAITING_OPEN
// pods whose flip failed past an arrived anchor) to the terminal EXPIRED status —
// NEVER retro-advancing them (D1 ruling) and NEVER hard-deleting (audit trail
// survives). It shares the exact training-only predicate + staleness rules with
// the rolling backstop (expireStaleTrainingPods), so the two can never drift.
//
// DRY-RUN → APPLY BOUNDARY (review B1): a bare/default call is a DRY-RUN that
// returns the census AND a signed, short-lived PREVIEW TOKEN digesting the exact
// params (cutoff + threshold + includeDev) and matched pod ids. `apply:true` is
// refused unless it carries a valid, unexpired token whose params match — so a
// blind apply is impossible, and the applied population is bound to the token's
// ids. Additionally: apply REQUIRES an explicit cutoff, and thresholdHours is
// floored at a sane minimum. Idempotent under crash-retry.

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { requireAdminSecret, getAdminSecret } from '../_utils/adminSecretAuth.js';
import { expireStaleTrainingPods } from '../_utils/trainingLifecycle.js';
import { signPreviewToken, verifyPreviewToken, PREVIEW_TOKEN_TTL_MS } from '../_utils/expiryPreviewToken.js';
import { TRAINING_TUNING } from '../../src/constants/leagueTournament.js';

export const config = { maxDuration: 60 };

// A sane floor well above the 3h idle-sweep and any single session, so a mis-set
// tiny threshold can never expire a pod that is legitimately mid-flight (B2's
// progressVersion + the future-anchor guard are the primary defenses; this is
// defense-in-depth).
const MIN_THRESHOLD_HOURS = 12;
const DEFAULT_THRESHOLD_HOURS = TRAINING_TUNING.POD_EXPIRY_STALE_MS / (60 * 60 * 1000);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }
  if (!requireAdminSecret(req, res)) return;

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  } catch {
    return res.status(400).json({ error: 'invalid_json', message: 'Request body is not valid JSON.' });
  }
  const { apply = false, cutoffIso = null, thresholdHours = null, includeDev = false, previewToken = null } = body;
  const doApply = apply === true; // EXPLICIT boolean true — everything else is a dry-run
  const inclDev = includeDev === true;

  if (cutoffIso != null && (typeof cutoffIso !== 'string' || Number.isNaN(Date.parse(cutoffIso)))) {
    return res.status(400).json({ error: 'invalid_cutoff', message: 'cutoffIso must be an ISO-8601 timestamp string.' });
  }
  if (thresholdHours != null && (!Number.isFinite(thresholdHours) || thresholdHours <= 0)) {
    return res.status(400).json({ error: 'invalid_threshold', message: 'thresholdHours must be a positive number of hours.' });
  }
  const requestedHours = thresholdHours != null ? thresholdHours : DEFAULT_THRESHOLD_HOURS;
  if (requestedHours < MIN_THRESHOLD_HOURS) {
    return res.status(400).json({ error: 'threshold_below_floor', message: `thresholdHours must be at least ${MIN_THRESHOLD_HOURS}.` });
  }
  const thresholdMs = requestedHours * 60 * 60 * 1000;
  // Canonicalize the cutoff to UTC-Z so the core's `createdAt < cutoffIso` string
  // compare is a valid CHRONOLOGICAL (not merely lexical) test (F1).
  const cutoffCanonical = cutoffIso != null ? new Date(cutoffIso).toISOString() : null;
  const secret = getAdminSecret();

  try {
    const db = getFirebaseAdmin();

    if (!doApply) {
      // ---- DRY-RUN: census + mint a preview token ----
      const summary = await expireStaleTrainingPods(db, {
        now: new Date(), includeDev: inclDev, thresholdMs, cutoffIso: cutoffCanonical,
        dryRun: true, by: 'one_time_cleanup',
      });
      const expMs = Date.now() + PREVIEW_TOKEN_TTL_MS;
      const previewTokenOut = secret
        ? signPreviewToken({ cutoffIso: cutoffCanonical, thresholdMs, includeDev: inclDev, ids: summary.matchedIds, expMs }, secret)
        : null;
      return res.status(200).json({
        ok: true, apply: false, cutoffIso: cutoffCanonical, thresholdHours: requestedHours,
        ...summary, previewToken: previewTokenOut, previewExpiresAt: new Date(expMs).toISOString(),
      });
    }

    // ---- APPLY: cutoff mandatory + a valid, matching, unexpired token ----
    if (cutoffCanonical == null) {
      return res.status(400).json({ error: 'cutoff_required', message: 'apply requires an explicit cutoffIso (bounding the population).' });
    }
    if (!secret) {
      return res.status(500).json({ error: 'no_secret', message: 'Server not configured to verify preview tokens.' });
    }
    const verdict = verifyPreviewToken(previewToken, { cutoffIso: cutoffCanonical, thresholdMs, includeDev: inclDev, nowMs: Date.now() }, secret);
    if (!verdict.valid) {
      return res.status(400).json({ error: 'invalid_preview_token', reason: verdict.reason, message: 'apply requires a valid, unexpired preview token from a dry-run with the SAME cutoff / threshold / includeDev. Re-run the dry-run and apply its token.' });
    }
    const summary = await expireStaleTrainingPods(db, {
      now: new Date(), includeDev: inclDev, thresholdMs, cutoffIso: cutoffCanonical,
      dryRun: false, by: 'one_time_cleanup', onlyIds: new Set(verdict.ids),
    });
    return res.status(200).json({
      ok: true, apply: true, cutoffIso: cutoffCanonical, thresholdHours: requestedHours, ...summary,
    });
  } catch (err) {
    console.error('[expire-stuck-training-pods] failed:', err?.message);
    return res.status(500).json({ error: 'server_error', message: 'Stuck-pod expiry run failed.' });
  }
}
