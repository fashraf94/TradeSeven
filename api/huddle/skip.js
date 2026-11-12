// api/huddle/skip.js
//
// POST /api/huddle/skip — the player skips today's game plan (Huddle S1 spec V1.1 §6):
// a proposed plan becomes `skipped` and `measurement.skippedAt` is set. Body `{ etDate }`.
// Answers the flag-off 404 while DRB_HUDDLE_ENABLED is off or the cohort HUDDLE_PLAYER_UIDS is empty, and for a
// signed-in uid outside it (Amendment E §E7; routeKit.js).
// Owner auth as api/agent/chat.js:421. 409 when the
// plan is not proposed (a confirmed plan is not skipped), 410 after the close.

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { admitHuddleRoute, etDateParam, clientViewOf } from '../_utils/huddle/routeKit.js';
import { skipPlan } from '../_utils/huddle/confirmPlan.js';
import { huddleDayRef } from '../_utils/huddle/records.js';

export const config = { maxDuration: 10 };

export default async function handler(req, res) {
  const admitted = await admitHuddleRoute(req, res, { method: 'POST', rateLimit: { limit: 10, windowMs: 60_000 } });
  if (!admitted) return;
  const etDate = etDateParam(req.body?.etDate);
  if (!etDate) return res.status(400).json({ error: 'etDate is required' });
  const db = getFirebaseAdmin();
  try {
    const outcome = await skipPlan(db, { uid: admitted.uid, etDate });
    if (outcome.kind === 'refused') return res.status(outcome.status).json({ error: outcome.code, ...(outcome.body || {}) });
    const snap = await huddleDayRef(db, admitted.uid, etDate).get();
    return res.status(200).json({ result: outcome.kind, huddle: clientViewOf(snap.exists ? snap.data() : null) });
  } catch (err) {
    console.error('[huddle/skip] failed', JSON.stringify({ message: err?.message }));
    return res.status(500).json({ error: 'skip_failed' });
  }
}
