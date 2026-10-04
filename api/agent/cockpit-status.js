// api/agent/cockpit-status.js
//
// GET /api/agent/cockpit-status?battleId=… — IS THIS BATTLE COCKPIT-ON?
// (Cockpit Build 2a spec docs/COCKPIT_BUILD2A_SPEC_V1_0.md S-6; founder ruling
// R2A-7.) The one thing the client may learn about the calls mode: `{ on }`
// for a battle the CALLER OWNS, where `on = resolveCallRecordsMode(battle) ===
// 'on'` — the server's own resolution of CALL_RECORDS_MODE and its
// server-side allowlist. THE CLIENT NEVER DECIDES (the GET /api/backing/lit
// precedent): it does not hold the allowlist and never recomputes the mode
// from bundled constants; it asks here and renders the answer.
//
// THE ORDER (the call-response precedent):
//   1  security middleware + the per-IP limiter
//   2  method — GET only                                    → 405
//   3  auth — the uid from the VERIFIED token                → 401
//   4  the query — a battleId                                → 400
//   5  the per-user limiter, before any read                 → 429
//   6  read the battle — missing                             → 404
//   7  the caller is not the owner                           → 403
//   8  200 { on } with Cache-Control: no-store
//
// It answers for the caller's own battle only, so it is no oracle on who is
// admitted: a non-owner learns nothing but 403. One document read; no write.
// Cache-Control: no-store on every answer — after a rollback (the uid removed
// from the environment and production redeployed: Vercel applies environment
// changes to new deployments only) the next ask must reach the new value,
// never a cached `on: true`.

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { resolveCallRecordsMode } from '../_utils/callRecords/mode.js';

export const config = { maxDuration: 5 };

/** The per-IP window (the shared middleware's limiter). */
export const COCKPIT_STATUS_IP_RATE_LIMIT = Object.freeze({ limit: 60, windowMs: 60_000 });
/** The per-user window, kept in this process (call-response's per-battle precedent). */
export const COCKPIT_STATUS_USER_RATE_LIMIT = Object.freeze({ limit: 30, windowMs: 60_000 });

const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;

const windows = new Map();
/** Record one request against the caller's own window; true when the window is already full. */
export function userRateLimited(uid, nowMs = Date.now()) {
  const { limit, windowMs } = COCKPIT_STATUS_USER_RATE_LIMIT;
  const kept = (windows.get(uid) || []).filter((t) => nowMs - t < windowMs);
  if (kept.length >= limit) { windows.set(uid, kept); return true; }
  kept.push(nowMs);
  windows.set(uid, kept);
  return false;
}
/** Tests only. */
export function resetCockpitStatusRateLimit() { windows.clear(); }

export default async function handler(req, res) {
  // The middleware's own answers (preflight, its 429) already carry its
  // `no-store, no-cache, …` header (security.js applySecurityHeaders).
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: COCKPIT_STATUS_IP_RATE_LIMIT.limit, windowMs: COCKPIT_STATUS_IP_RATE_LIMIT.windowMs } })) {
    return;
  }
  // Every answer from here on — errors included — is exactly `no-store`.
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }
  const user = await requireAuth(req, res);
  if (!user) return;

  const raw = req.query?.battleId;
  const battleId = Array.isArray(raw) ? raw[0] : raw;
  if (!nonEmpty(battleId)) {
    return res.status(400).json({ error: 'invalid_request', message: 'battleId is required' });
  }
  if (userRateLimited(user.uid)) {
    return res.status(429).json({ error: 'rate_limited' });
  }

  try {
    const snap = await getFirebaseAdmin().collection('agentBattles').doc(battleId.trim()).get();
    if (!snap.exists) return res.status(404).json({ error: 'not_found' });
    const battle = snap.data();
    if (battle?.ownerId !== user.uid) return res.status(403).json({ error: 'forbidden' });
    return res.status(200).json({ on: resolveCallRecordsMode(battle) === 'on' });
  } catch (error) {
    console.error('[CockpitStatus] Error:', error?.message || error);
    return res.status(500).json({ error: 'Could not read the battle.' });
  }
}
