// api/huddle/playback-token.js
//
// POST /api/huddle/playback-token — issue a fresh playback token for one day's audio
// (Huddle S1 spec V1.1 §6, Astra AR-7). Body `{ etDate }`. The plaintext token is
// returned ONCE; only its SHA-256 is stored, and issuance rotates the previous one
// (api/_utils/huddle/playback.js). The sheet calls it before playing and again on expiry.
// 404 while DRB_HUDDLE_ENABLED is off. Owner auth as api/agent/chat.js:421. The token is
// never logged.

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { admitHuddleRoute, etDateParam } from '../_utils/huddle/routeKit.js';
import { issuePlaybackToken } from '../_utils/huddle/playback.js';

export const config = { maxDuration: 10 };

export default async function handler(req, res) {
  const admitted = await admitHuddleRoute(req, res, { method: 'POST', rateLimit: { limit: 20, windowMs: 60_000 } });
  if (!admitted) return;
  const etDate = etDateParam(req.body?.etDate);
  if (!etDate) return res.status(400).json({ error: 'etDate is required' });
  try {
    const out = await issuePlaybackToken(getFirebaseAdmin(), { uid: admitted.uid, etDate });
    if (out.kind !== 'issued') return res.status(out.status).json({ error: out.code });
    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).json({ url: `/api/huddle/audio/${out.token}`, expiresAt: out.expiresAt });
  } catch (err) {
    console.error('[huddle/playback-token] failed', JSON.stringify({ message: err?.message }));
    return res.status(500).json({ error: 'issue_failed' });
  }
}
