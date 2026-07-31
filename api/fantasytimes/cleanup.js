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
    // ISOLATED: a Wire retention failure must not discard the Steps 1-2
    // result the way an unguarded throw would (the same isolating-rider
    // pattern this arc uses in process-pending-reflections.js).
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().slice(0, 10);
    // N3.5: editorial evidence outlives its Wire sources by design — memos
    // cite copies of 30-day-retention entries, so wireEditorial holds 90
    // days. Flat docs (runs are a map INSIDE the week doc, D-P2-15), so the
    // plain delete orphans nothing — the same invariant as the other three.
    const ninetyDaysAgoStr = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
      .toISOString().slice(0, 10);
    let wireDeleted = 0;
    let wireCleanupError = null;
    try {
      for (const [collection, field, cutoff] of [
        ['fantasyTimesWire', 'date', thirtyDaysAgoStr],
        ['wireMetrics', 'date', thirtyDaysAgoStr],
        ['fantasyTimesWireEnvelopes', 'createdAt', thirtyDaysAgo],
        ['wireEditorial', 'scheduledSlotDate', ninetyDaysAgoStr],
      ]) {
        const oldDocs = await db
          .collection(collection)
          .where(field, '<', cutoff)
          .limit(200)
          .get();
        if (oldDocs.empty) continue;

        const wireBatch = db.batch();
        let queued = 0;
        for (const doc of oldDocs.docs) {
          // An envelope is the ONLY replayable copy of a pending story's
          // Wire state. Deleting one whose story is still wirePending would
          // convert a recoverable story into an envelope_missing alarm —
          // manufacturing the very anomaly whose acceptance expectation is
          // zero. Leave it; the sweep owns it.
          if (collection === 'fantasyTimesWireEnvelopes') {
            const storySnap = await db.collection('fantasyTimesStories').doc(doc.id).get();
            if (storySnap.exists && storySnap.data().wirePending === true) {
              console.warn(`${LOG_PREFIX} keeping envelope ${doc.id} — its story is still wirePending`);
              continue;
            }
          }
          wireBatch.delete(doc.ref);
          queued++;
        }
        if (queued > 0) {
          await wireBatch.commit();
          wireDeleted += queued;
        }
      }
    } catch (wireErr) {
      wireCleanupError = wireErr?.message || String(wireErr);
      console.error(`${LOG_PREFIX} Wire retention failed (isolated):`, wireCleanupError);
    }

    console.log(`${LOG_PREFIX} Cleaned up ${expiredCount} expired stories, deleted ${deletedCount} old stories, ${wireDeleted} old wire docs`);

    return res.status(200).json({
      success: true,
      expiredCount,
      deletedCount,
      wireDeleted,
      ...(wireCleanupError ? { wireCleanupError } : {}),
    });
  } catch (error) {
    console.error(`${LOG_PREFIX} Error:`, error.message);
    return res.status(500).json({ success: false, error: 'Cleanup failed' });
  }
}
