// api/forge/watchlists/[id]/hypothesis-versions/[n]/review.js
//
// Pilot P1c — founder ruling E2 (16 Oct 2026; pilot spec Amendment E): the
// review card's evidence for ONE version of a list's idea.
//
//   GET /api/forge/watchlists/{id}/hypothesis-versions/{n}/review
//     → { watchlistId, version, status, window: { kind, start, end, empty },
//         battles: [{ battleId, createdAt, endedAt, voided, known }],
//         agentName, honestLine, evidence: { computedAt, source, window,
//         names[], list, market } | null, pending, difference }
//
// Owner-only, behind the record slice's gate (http.js gateHypothesisRoute —
// off for the caller → 404 { error: 'disabled' } before any read; another
// owner's list → 403 forbidden). A version that was never deployed, or is not
// review_due / retired / invalidated → 409 review_unavailable; one whose
// window has not closed → 409 review_window_open. The rule, the budget and
// the once-only computation are api/_utils/hypothesisRecords/review.js's.

import { getFirebaseAdmin } from '../../../../../_utils/firebaseAdmin.js';
import { gateHypothesisRoute, requireVersion, sendHypothesisError } from '../../../../../_utils/hypothesisRecords/http.js';
import { readReview } from '../../../../../_utils/hypothesisRecords/review.js';

// Up to eleven market-data reads run on the first request for a version (in parallel).
export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  const gate = await gateHypothesisRoute(req, res, { methods: ['GET'], rateLimit: { limit: 30, windowMs: 60_000 } });
  if (!gate) return;
  const { user, watchlistId } = gate;
  try {
    const version = requireVersion(req.query?.n);
    const out = await readReview(getFirebaseAdmin(), { uid: user.uid, watchlistId, version, nowMs: Date.now() });
    return res.status(200).json({ watchlistId, ...out });
  } catch (err) {
    return sendHypothesisError(res, err, 'review');
  }
}
