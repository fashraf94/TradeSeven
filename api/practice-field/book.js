// api/practice-field/book.js
//
// Practice Field build B3 — GET /api/practice-field/book: the caller's own idea book, as a finished, read-only view
// (rulings B3-1 to B3-8; api/_utils/practiceField/bookView.js builds it, bookViewRead.js reads it).
//
// THE GATE (the api/_utils/filmRoom/cardsGate.js order):
//   1. the security middleware (headers, CORS, preflight, the rate limiter);
//   2. `Cache-Control: private, no-store` on every answer from here on (B3-7: marks are as of the last close; nothing is
//      cached between owners or between visits);
//   3. PRACTICE_FIELD_MODE 'off' or the screen switch off (mode.js practiceFieldScreenOn) → 404 { error: 'disabled' },
//      BEFORE auth and before any read;
//   4. a verified Firebase ID token → the uid, FROM THE TOKEN ONLY (no query, body or header names a user or a book);
//      none → 401;
//   5. the mode's own gate for that uid (mode.js practiceFieldAdmits) → the same 404 when it does not admit them;
//   6. GET only → 405.
// THE ANSWER: `{ book: <view> }`, or `{ book: null }` when the caller has no open idea book. Reads only, all of them the
// caller's own documents; nothing is written.

import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { practiceFieldScreenOn, practiceFieldAdmits, practiceFieldAgentOn } from '../_utils/practiceField/mode.js';
import { readBookView } from '../_utils/practiceField/bookViewRead.js';

export const config = { maxDuration: 15 };

/** The per-IP window the shared middleware's limiter applies. The page reads on open and on focus. */
export const BOOK_RATE_LIMIT = Object.freeze({ limit: 30, windowMs: 60_000 });
/** The body every refusal of the switch, the mode or the mode's gate answers (the caller is not told which). */
export const DISABLED_BODY = Object.freeze({ error: 'disabled' });

export default async function handler(req, res) {
  if (applySecurityMiddleware(req, res, { rateLimit: BOOK_RATE_LIMIT })) return;
  res.setHeader('Cache-Control', 'private, no-store');
  if (!practiceFieldScreenOn()) return res.status(404).json({ ...DISABLED_BODY });

  const user = await requireAuth(req, res);
  if (!user) return; // 401 already sent
  const uid = user.uid;
  if (!practiceFieldAdmits(uid)) return res.status(404).json({ ...DISABLED_BODY });

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const out = await readBookView(getFirebaseAdmin(), { uid, agentOn: practiceFieldAgentOn() });
    return res.status(200).json(out);
  } catch (err) {
    console.error('[practice-field/book] internal error', err?.message ?? err);
    return res.status(500).json({ error: 'internal_error' });
  }
}
