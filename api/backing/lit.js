// api/backing/lit.js
//
// GET /api/backing/lit — Backing activation: IS THE BACKING LAYER LIT FOR THIS
// CALLER? The one thing the client may learn from the server about the
// founder smoke override (api/_utils/backingSmoke.js): `{ lit: boolean }` for
// the caller's OWN verified uid. The client never decides it is on a preview
// from its hostname, and never decides who is allowlisted — it asks, once per
// signed-in session (src/hooks/useBackingLit.js), and renders the answer.
//
// THE ORDER, the same rungs every backing route climbs:
//   1  security middleware + rate limit
//   2  method — GET only
//   3  auth — the uid from the VERIFIED token; nothing is read from the request
//   4  the answer: `{ lit: backingLitFor(user.uid) }`
//
// THE ONE BACKING ROUTE THAT DOES NOT 404 WHILE DARK, and deliberately so: it
// is how a client learns the decision, so it must answer. While dark it says
// `{ lit: false }` to everyone — the same thing every other route's 404 says —
// and touches Firestore zero times (backing-routes.dark.test.js). It answers
// AFTER auth, so an anonymous caller gets 401 whether lit or not, and it is no
// oracle on the rollout: a lit answer exists only for an allowlisted uid on a
// preview, or for everyone once the flag flips.

import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { backingLitFor } from '../_utils/backingSmoke.js';

export const config = { maxDuration: 5 };

export default async function handler(req, res) {
  // 1. Security middleware + rate limit.
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 60, windowMs: 60000 } })) return;

  // 2. Method.
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed. Use GET.' });

  // 3. Auth — the ONLY identity this route answers for.
  const user = await requireAuth(req, res);
  if (!user) return;

  // 4. The decision, read at call time, for this uid alone.
  return res.status(200).json({ lit: backingLitFor(user.uid) === true });
}
