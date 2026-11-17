// api/practice-field/founder.js
//
// Practice Field T1a-2b-1 — THE FOUNDER'S ONE ENDPOINT (build prompt §6). POST { action, requestKey, … }, dispatched
// by `action` (api/_utils/practiceField/founderControls.js): create_book, admit_fixture, pause, resume, wind_down.
//
// AUTH CONTRACT (the api/mandate/create.js pattern):
//   • Firebase ID token verified server-side; the uid comes FROM THE TOKEN, never the request body — a body's `uid`
//     or `userId` is never read.
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
