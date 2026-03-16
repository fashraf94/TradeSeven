// api/fantasytimes/ingest-cleanup.js
// Cron endpoint: removes expired ingested claims from Firestore.
// Runs weekly on Sunday 3 AM ET.

import { applySecurityMiddleware } from '../_utils/security.js';
import { cleanupExpiredClaims } from '../_utils/ingestedClaims.js';

export const config = { maxDuration: 30 };

const LOG_PREFIX = '[FantasyTimes:IngestCleanup]';

export default async function handler(req, res) {
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 5, windowMs: 60000 } })) {
    return;
  }

  // --- Cron/Admin Authentication ---
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const authHeader = req.headers.authorization;
  if (!isVercelCron && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const result = await cleanupExpiredClaims();
    console.log(`${new Date().toISOString()} ${LOG_PREFIX} Cleanup complete: deleted ${result.deleted} expired claims`);
    return res.status(200).json({ success: true, deleted: result.deleted });
  } catch (err) {
    console.error(`${new Date().toISOString()} ${LOG_PREFIX} Cleanup failed:`, err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}
