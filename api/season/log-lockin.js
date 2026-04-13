// api/season/log-lockin.js
//
// Phase 6 — Shadow Logger Extension
// Captures the user's "what am I trying to fix" hypothesis at weekly-review
// lock-in time and fires a review_interactions shadow log record.
//
// The Sunday-night `season-pit-stop-manage.js` cron is the canonical place
// that validates and applies the pitStop.changes[] (that file is protected).
// This endpoint is additive — it only writes the `hypothesis` field onto
// the pitStop doc and forwards the lock-in snapshot to GCS for training.
// If the cron later rejects the changes, the hypothesis remains attached
// for dataset harvesting.
//
// Client flow:
//   1. User types optional hypothesis in PitStopLockInBar confirm stage.
//   2. Client POSTs { entryId, week, hypothesis } to this endpoint as
//      fire-and-forget (.catch swallows). UX animation runs in parallel.
//   3. Endpoint verifies ownership, persists the hypothesis, and logs.
//
// Request:  POST { entryId, week, hypothesis? }
// Response: { ok: true } | { error: string }

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { logReviewInteraction } from '../_utils/shadowLogger.js';

export const config = { maxDuration: 10 };

const MAX_HYPOTHESIS_LENGTH = 200;

export default async function handler(req, res) {
  // ─── 1. CORS + rate limit ────────────────────────────────────
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 10, windowMs: 60000 } })) {
    return;
  }

  // ─── 2. Method ───────────────────────────────────────────────
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ─── 3. Firebase auth ────────────────────────────────────────
  const user = await requireAuth(req, res);
  if (!user) return;

  // ─── 4. Validate request body ────────────────────────────────
  const { entryId, week, hypothesis } = req.body || {};
  if (!entryId || typeof entryId !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid entryId' });
  }
  if (week == null) {
    return res.status(400).json({ error: 'Missing week' });
  }

  // Hypothesis is optional — coerce to a trimmed, length-capped string
  // or null. Missing/empty input is normal, not an error.
  let normalizedHypothesis = null;
  if (typeof hypothesis === 'string') {
    const trimmed = hypothesis.trim();
    if (trimmed.length > 0) {
      normalizedHypothesis = trimmed.slice(0, MAX_HYPOTHESIS_LENGTH);
    }
  }

  const db = getFirebaseAdmin();

  try {
    // ─── 5. Load entry + verify ownership ──────────────────────
    const entryRef = db.collection('seasonEntries').doc(entryId);
    const entrySnap = await entryRef.get();
    if (!entrySnap.exists) {
      return res.status(404).json({ error: 'Entry not found' });
    }
    const entry = entrySnap.data();
    if (entry.userId !== user.uid) {
      return res.status(403).json({ error: 'Not your entry' });
    }

    // ─── 6. Load pit stop ──────────────────────────────────────
    const pitStopRef = entryRef.collection('pitStops').doc(String(week));
    const pitStopSnap = await pitStopRef.get();
    if (!pitStopSnap.exists) {
      return res.status(404).json({ error: 'Pit stop not found' });
    }
    const pitStop = pitStopSnap.data();

    // ─── 7. Persist hypothesis on pit stop doc ─────────────────
    // Only writes when we actually have something to save. An empty
    // hypothesis still proceeds to the shadow log (which records the
    // lock-in event even without text).
    const nowIso = new Date().toISOString();
    if (normalizedHypothesis !== null) {
      await pitStopRef.update({
        hypothesis: normalizedHypothesis,
        hypothesisAt: nowIso,
        updatedAt: nowIso,
      });
    }

    // ─── 8. Shadow log (fire-and-forget) ───────────────────────
    // Full lock-in snapshot for Gemma training. Silent failure.
    const changes = Array.isArray(pitStop.changes) ? pitStop.changes : [];
    const shortlist = Array.isArray(pitStop.shortlist) ? pitStop.shortlist : [];
    logReviewInteraction({
      type: 'lockin',
      userId: user.uid,
      entryId,
      seasonId: entry.seasonId || null,
      agentId: entry.agentId || null,
      week,
      hypothesis: normalizedHypothesis,
      changeCount: changes.length,
      changes: changes.map((c) => ({
        ruleId: c?.ruleId || null,
        field: c?.field || null,
        oldValue: c?.oldValue ?? null,
        newValue: c?.newValue ?? null,
      })),
      shortlistCount: shortlist.length,
      shortlistTickers: shortlist.map((s) => s?.ticker).filter(Boolean),
      conversationTurns: pitStop.conversationCount || 0,
      timestamp: nowIso,
      schemaVersion: 1,
    }).catch(() => {});

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('[SEASON] log-lockin failed:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
