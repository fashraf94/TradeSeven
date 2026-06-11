// api/_utils/adminSecretAuth.js
//
// Shared admin/cron secret gate for manually-invocable endpoints (pattern of
// record: api/admin/backfill-snake-draft-day.js — header, query param, or
// Bearer token against ADMIN_SECRET, falling back to CRON_SECRET). Extracted
// at P1a so the tournament endpoints don't each re-state the block.

/**
 * Pure check: does this request carry the admin secret? No response writes —
 * for endpoints that are NOT admin-gated but honor admin-only OPTIONAL flags
 * (P1b's preview time-control bypasses on user-authed endpoints): an invalid
 * or absent secret must silently disable the flag, never 401 a normal user.
 *
 * Header / Bearer ONLY — deliberately narrower than requireAdminSecret: this
 * variant runs on user-facing routes, and a query-string secret would land
 * in request logs (the secret falls back to CRON_SECRET, the key to every
 * cron and admin operation).
 */
export function isAdminSecretValid(req) {
  const adminSecret = process.env.ADMIN_SECRET || process.env.CRON_SECRET;
  if (!adminSecret) return false;
  const providedSecret =
    req.headers['x-admin-secret'] ||
    (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);
  return providedSecret === adminSecret;
}

/**
 * Returns true if the request carries the admin secret. Otherwise writes the
 * 401/500 response itself and returns false — callers just `if (!ok) return`.
 *
 * Header / Bearer only, like isAdminSecretValid: every consumer is a
 * tournament admin endpoint and none may accept a query-string secret
 * (founder ruling — URLs persist in request logs and the secret falls back
 * to CRON_SECRET). Legacy admin endpoints with inline `?secret=` checks are
 * separate tasking and do not use this module.
 */
export function requireAdminSecret(req, res) {
  const adminSecret = process.env.ADMIN_SECRET || process.env.CRON_SECRET;
  if (!adminSecret) {
    res.status(500).json({ error: 'Server not configured for admin operations' });
    return false;
  }
  if (!isAdminSecretValid(req)) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}
