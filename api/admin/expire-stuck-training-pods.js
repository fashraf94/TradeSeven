// api/admin/expire-stuck-training-pods.js
//
// Training-Pod P0 R3 — the founder-gated ONE-TIME cleanup of the stuck-pod
// census. POST /api/admin/expire-stuck-training-pods. Retires training pods
// stranded pre-BATTLE (FORMING orphans, wedged DRAFTING drafts, AWAITING_OPEN
// pods whose flip failed past an arrived anchor) to the terminal EXPIRED status —
// NEVER retro-advancing them (D1 ruling) and NEVER hard-deleting (the audit trail
// survives). It shares the exact training-only predicate + staleness rules with
// the rolling backstop (expireStaleTrainingPods), so the two can never drift.
//
// SAFE BY DEFAULT: the run is a DRY-RUN (count-only, zero writes) unless the body
// carries `apply: true` — the mandatory pre-count. `cutoffIso` bounds it to pods
// created before a chosen instant (e.g. the pre-fix era); `thresholdHours`
// overrides the 48h staleness bound. Idempotent under crash-retry: expireGroup
// treats an already-EXPIRED (or since-advanced) pod as a no-op skip.

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { requireAdminSecret } from '../_utils/adminSecretAuth.js';
import { expireStaleTrainingPods } from '../_utils/trainingLifecycle.js';
import { TRAINING_TUNING } from '../../src/constants/leagueTournament.js';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }
  if (!requireAdminSecret(req, res)) return;

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  const { apply = false, cutoffIso = null, thresholdHours = null, includeDev = false } = body;

  // The apply gate is an EXPLICIT true — anything else (including a bare call) is
  // the mandatory dry-run pre-count.
  const dryRun = apply !== true;

  if (cutoffIso != null && (typeof cutoffIso !== 'string' || Number.isNaN(Date.parse(cutoffIso)))) {
    return res.status(400).json({ error: 'invalid_cutoff', message: 'cutoffIso must be an ISO-8601 timestamp string.' });
  }
  if (thresholdHours != null && (!Number.isFinite(thresholdHours) || thresholdHours <= 0)) {
    return res.status(400).json({ error: 'invalid_threshold', message: 'thresholdHours must be a positive number of hours.' });
  }
  const thresholdMs = thresholdHours != null
    ? thresholdHours * 60 * 60 * 1000
    : TRAINING_TUNING.POD_EXPIRY_STALE_MS;

  try {
    const db = getFirebaseAdmin();
    const summary = await expireStaleTrainingPods(db, {
      now: new Date(),
      includeDev: includeDev === true,
      thresholdMs,
      cutoffIso,
      dryRun,
      by: 'one_time_cleanup',
    });
    return res.status(200).json({
      ok: true,
      apply: !dryRun,
      cutoffIso: cutoffIso ?? null,
      thresholdHours: thresholdMs / (60 * 60 * 1000),
      ...summary,
    });
  } catch (err) {
    console.error('[expire-stuck-training-pods] failed:', err?.message);
    return res.status(500).json({ error: 'server_error', message: 'Stuck-pod expiry run failed.' });
  }
}
