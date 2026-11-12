// api/huddle/confirm.js
//
// POST /api/huddle/confirm — the player confirms today's game plan (Huddle S1 spec V1.1 §6
// as replaced by Amendment A §A1; Amendment E §E1, one confirm per archetype in play). Body
// `{ etDate, baseRevision, replacement, acknowledged? }` — `acknowledged` maps an archetype to the
// revision its preview showed (E1). 404 while DRB_HUDDLE_ENABLED is off or the player is outside
// HUDDLE_PLAYER_UIDS (E7). Owner auth as api/agent/chat.js:421.
//
// Answers: 200 confirmed (or the confirmed state, unchanged, on a repeat) with the
// per-battle status after the applications; 409 revision_mismatch with the stored
// `current` and `revision`, or not_ready / not_proposed; 410 session_closed (a proposed
// plan is marked expired); 422 validation_changed with `{ current, revision, drops,
// transforms, dissent, previews }` (the sheet previews exactly what would be filed — per
// archetype in play — and asks again), archetype_unsupported, empty_plan or rendered_too_long
// (nothing written).
//
// The applications run after the confirm's commit, each its own B1 transaction
// (api/_utils/huddle/applyPlan.js); a battle that cannot take the plan now keeps a
// waiting receipt the sweep and reconcile retry until the close.

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { admitHuddleRoute, etDateParam, clientViewOf } from '../_utils/huddle/routeKit.js';
import { confirmPlan } from '../_utils/huddle/confirmPlan.js';
import { applyConfirmedPlan } from '../_utils/huddle/applyPlan.js';
import { huddleDayRef } from '../_utils/huddle/records.js';

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  const admitted = await admitHuddleRoute(req, res, { method: 'POST', rateLimit: { limit: 10, windowMs: 60_000 } });
  if (!admitted) return;
  const body = req.body || {};
  const etDate = etDateParam(body.etDate);
  if (!etDate || typeof body.baseRevision !== 'string' || !body.replacement || typeof body.replacement !== 'object') {
    return res.status(400).json({ error: 'etDate, baseRevision and replacement are required' });
  }
  const db = getFirebaseAdmin();
  try {
    const outcome = await confirmPlan(db, { uid: admitted.uid, etDate, baseRevision: body.baseRevision, replacement: body.replacement, acknowledged: body.acknowledged ?? null });
    if (outcome.kind === 'refused') return res.status(outcome.status).json({ error: outcome.code, ...(outcome.body || {}) });
    if (outcome.kind === 'confirmed') {
      // The confirm has committed: an apply that throws here is retried by the check-start sweep and the reconcile pass,
      // so it never turns the answer into a failed confirm (review L2-12).
      try {
        await applyConfirmedPlan(db, { uid: admitted.uid, etDate, writtenBy: 'confirm' });
      } catch (err) {
        console.warn('[huddle/confirm] immediate apply failed; the sweep and reconcile apply it', JSON.stringify({ message: err?.message }));
      }
    }
    const snap = await huddleDayRef(db, admitted.uid, etDate).get();
    return res.status(200).json({ result: outcome.kind, huddle: clientViewOf(snap.exists ? snap.data() : null) });
  } catch (err) {
    console.error('[huddle/confirm] failed', JSON.stringify({ message: err?.message }));
    return res.status(500).json({ error: 'confirm_failed' });
  }
}
