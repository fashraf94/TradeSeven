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

    // Step 3: FantasyTimes Wire 30-day retention ride (Wire Spec V1.5 §4.3/
    // §4.8, D1). All three Wire surfaces are FLAT documents — receipts live
    // as a map INSIDE the daily doc, not a subcollection — so plain deletes
    // orphan nothing. Envelopes are transient (minutes); anything older than
    // 30 days is leaked residue from a rollback window and is drained here.
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().slice(0, 10);
    let wireDeleted = 0;
    for (const [collection, field, cutoff] of [
      ['fantasyTimesWire', 'date', thirtyDaysAgoStr],
      ['wireMetrics', 'date', thirtyDaysAgoStr],
      ['fantasyTimesWireEnvelopes', 'createdAt', thirtyDaysAgo],
    ]) {
      const oldDocs = await db
        .collection(collection)
        .where(field, '<', cutoff)
        .limit(200)
        .get();
      if (!oldDocs.empty) {
        const wireBatch = db.batch();
        oldDocs.docs.forEach((doc) => {
          wireBatch.delete(doc.ref);
          wireDeleted++;
        });
        await wireBatch.commit();
      }
    }

    console.log(`${LOG_PREFIX} Cleaned up ${expiredCount} expired stories, deleted ${deletedCount} old stories, ${wireDeleted} old wire docs`);

    return res.status(200).json({
      success: true,
      expiredCount,
      deletedCount,
      wireDeleted,
    });
  } catch (error) {
    console.error(`${LOG_PREFIX} Error:`, error.message);
    return res.status(500).json({ success: false, error: 'Cleanup failed' });
  }
}
