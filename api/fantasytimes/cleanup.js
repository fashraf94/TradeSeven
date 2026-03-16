// api/fantasytimes/cleanup.js
// FantasyTimes Story Cleanup — expires published stories past their expiresAt,
// and deletes expired stories older than 30 days.
// GET endpoint called by daily cron (2 AM ET / 07:00 UTC).

import { applySecurityMiddleware } from '../_utils/security.js';
import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';

export const config = { maxDuration: 30 };

const LOG_PREFIX = '[FantasyTimes:Cleanup]';

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

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const db = getFirebaseAdmin();
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Step 1: Mark published stories past their expiresAt as 'expired'
    const expiredSnapshot = await db
      .collection('fantasyTimesStories')
      .where('status', '==', 'published')
      .where('expiresAt', '<', now)
      .limit(500)
      .get();

    let expiredCount = 0;
    if (!expiredSnapshot.empty) {
      const batch = db.batch();
      expiredSnapshot.docs.forEach((doc) => {
        batch.update(doc.ref, { status: 'expired' });
        expiredCount++;
      });
      await batch.commit();
    }

    // Step 2: Delete expired stories older than 30 days
    const deleteSnapshot = await db
      .collection('fantasyTimesStories')
      .where('status', '==', 'expired')
      .where('expiresAt', '<', thirtyDaysAgo)
      .limit(500)
      .get();

    let deletedCount = 0;
    if (!deleteSnapshot.empty) {
      const batch = db.batch();
      deleteSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
        deletedCount++;
      });
      await batch.commit();
    }

    console.log(`${LOG_PREFIX} Cleaned up ${expiredCount} expired stories, deleted ${deletedCount} old stories`);

    return res.status(200).json({
      success: true,
      expiredCount,
      deletedCount,
    });
  } catch (error) {
    console.error(`${LOG_PREFIX} Error:`, error.message);
    return res.status(500).json({ success: false, error: 'Cleanup failed' });
  }
}
