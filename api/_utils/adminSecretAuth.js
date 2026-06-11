// api/_utils/adminSecretAuth.js
//
// Shared admin/cron secret gate for manually-invocable endpoints (pattern of
// record: api/admin/backfill-snake-draft-day.js — header, query param, or
// Bearer token against ADMIN_SECRET, falling back to CRON_SECRET). Extracted
// at P1a so the tournament endpoints don't each re-state the block.

/**
 * Returns true if the request carries the admin secret. Otherwise writes the
 * 401/500 response itself and returns false — callers just `if (!ok) return`.
 */
export function requireAdminSecret(req, res) {
  const adminSecret = process.env.ADMIN_SECRET || process.env.CRON_SECRET;
  const providedSecret =
    req.headers['x-admin-secret'] ||
    req.query?.secret ||
    (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);

  if (!adminSecret) {
    res.status(500).json({ error: 'Server not configured for admin operations' });
    return false;
  }
  if (providedSecret !== adminSecret) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}
