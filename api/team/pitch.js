// api/team/pitch.js
//
// POST /api/team/pitch — Backing Beta PR 4, THE SCOUTING PITCH WRITER (design
// brief rev2 §2 "a self-written scouting line", rev3 §3 "one line, two
// homes"; spec V1.3 §9 honesty). The ONE writer of `teamPitches/{uid}`.
//
// THE ORDER (the attest.js / backing-stake.js shape):
//   1  security middleware + rate limit
//   2  method — POST only
//   3  auth — the uid from the VERIFIED token, never the body
//   4  THE FLAG — 404 while BACKING_BETA_ENABLED is dark, AFTER auth (the
//      SHOW_IT_ENABLED / research.js shape: a 404 in front of the auth check
//      answers an anonymous caller differently while dark and while lit, which
//      is a free oracle on an unreleased feature's rollout state)
//   5  body — { text } through the ONE validator (api/_utils/teamPitch.js
//      normalizePitch): trimmed, 1–140 characters, control characters
//      stripped, no newlines; an EMPTY result clears the pitch
//   6  ONE idempotent whole-doc write to teamPitches/{uid} — `{ text,
//      updatedAt }`, a plain set: the same body twice writes the same document
//
// BOTH EDIT HOMES CALL THIS ROUTE (the card's inline editor and the profile
// area's), and neither writes Firestore directly: the rules block is `write:
// if false` for every client, the owner included, so the server-validated
// text is the only text that can exist (§9 — the client never asserts).
//
// THE WRITE NAMES ITS COLLECTION AS A LITERAL, deliberately. The composition
// protected-store scanner (api/_utils/compositionProtectedStoresScan.js)
// resolves a write's collection only from a `.collection('<literal>')` chain;
// `teamPitches` is not a protected store, so the literal lets the write pass
// the deny-by-default scan without an allowlist entry, and the test pins the
// literal to TEAM_PITCHES_COLLECTION so the reader and the writer cannot drift.
//
// AWAITED (BUILD_RULES §5): the write is the reply's precondition, never
// fire-and-forget. DARK AT MERGE: the flag is read at CALL time; the
// co-located darkness suite proves the route answers 404 and touches nothing.

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { buildPitchDoc, normalizePitch } from '../_utils/teamPitch.js';
import { BACKING_BETA_ENABLED } from '../../src/config/featureFlags.js';

export const config = { maxDuration: 10 };

export default async function handler(req, res) {
  // 1. Security middleware + rate limit.
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 10, windowMs: 60000 } })) return;

  // 2. Method.
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed. Use POST.' });

  // 3. Auth — the uid comes from the token, never the body.
  const user = await requireAuth(req, res);
  if (!user) return;

  // 4. THE FLAG, read at call time, after auth. Dark ⇒ the route does not exist.
  if (!BACKING_BETA_ENABLED) return res.status(404).json({ error: 'Not found' });

  // 5. Body — one field, one validator.
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  const normalized = normalizePitch(body.text);
  if (!normalized.ok) {
    return res.status(400).json({ error: normalized.error, message: normalized.message });
  }

  // 6. One idempotent whole-doc write, awaited.
  const db = getFirebaseAdmin();
  const pitch = buildPitchDoc(normalized.text);
  try {
    await db.collection('teamPitches').doc(user.uid).set(pitch);
    return res.status(200).json({ ok: true, pitch });
  } catch (err) {
    console.error('[team/pitch] write failed:', err?.message);
    return res.status(500).json({ error: 'server_error', message: 'Could not save your pitch.' });
  }
}
