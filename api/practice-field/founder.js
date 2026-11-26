// api/practice-field/founder.js
//
// Practice Field T1a-2b-1 — THE FOUNDER'S ONE ENDPOINT (build prompt §6). POST { action, requestKey, … }, dispatched
// by `action` (api/_utils/practiceField/founderControls.js): create_book, admit_fixture, pause, resume, wind_down,
// (T1a-2b-3, Amendment F-5) resolve_hold, and (build B4, ruling B4-2) create_book_for — a book for a player on the idea
// book's player list. Build B4 (ruling B4-4): pause, resume, wind_down and resolve_hold take an optional `ownerUid`, the
// player whose book the founder acts on.
//
// AUTH CONTRACT (the api/mandate/create.js pattern):
//   • Firebase ID token verified server-side; the uid comes FROM THE TOKEN, never the request body — a body's `uid`
//     or `userId` is never read. A body's `ownerUid` names the book a FOUNDER acts on; it is never the caller.
//   • Founder-only, BOTH required: PRACTICE_FIELD_MODE is not 'off', AND the uid is in MANDATE_FOUNDER_UIDS (the
//     Mandate founder endpoint's own allowlist, reused — read at call time, never cached; unset means nobody). The
//     caller is not told which condition failed.
//   • Idempotent on the client's `requestKey`.
// No model call, no market-data call. Every write is the Practice Field's own, in its own transactions.

import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { isPracticeFieldFounder, runFounderAction } from '../_utils/practiceField/founderControls.js';

export default async function handler(req, res) {
  // 1. CORS + rate limit
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 10, windowMs: 60000 } })) return;

  // 2. Method
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // 3. Firebase auth — uid from the token, never the body
  const user = await requireAuth(req, res);
  if (!user) return; // 401 already sent
  const uid = user.uid;

  // 4. Founder gate — the mode AND the allowlist, both required; which one failed is not revealed.
  if (!isPracticeFieldFounder(uid)) return res.status(403).json({ error: 'forbidden' });

  // 5. Dispatch
  try {
    const out = await runFounderAction(getFirebaseAdmin(), { uid, body: req.body || {}, nowIso: new Date().toISOString() });
    return res.status(out.status).json(out.body);
  } catch (err) {
    console.error('[practice-field/founder] internal error', err?.message ?? err);
    return res.status(500).json({ error: 'internal_error' });
  }
}
