// api/fantasytimes/backfill-visuals.js
// One-time backfill for pre-Phase-1 stories missing visualType.
// GET endpoint protected by cron auth.

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { getDefaultVisual } from '../_utils/fantasyTimesVisuals.js';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Cron auth
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const authHeader = req.headers.authorization;
  if (!isVercelCron && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const db = getFirebaseAdmin();
    const snapshot = await db
      .collection('fantasyTimesStories')
      .where('status', '==', 'published')
      .get();

    const toBackfill = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      if (!data.visualType) {
        toBackfill.push({ ref: doc.ref, data });
      }
    });

    if (toBackfill.length === 0) {
      return res.status(200).json({
        success: true,
        backfilled: 0,
        total: snapshot.size,
        skipped: snapshot.size,
      });
    }

    // Batch updates in chunks of 500 (Firestore limit)
    let backfilled = 0;
    for (let i = 0; i < toBackfill.length; i += 500) {
      const chunk = toBackfill.slice(i, i + 500);
      const batch = db.batch();

      for (const { ref, data } of chunk) {
        const { visualType, visualConfig } = getDefaultVisual(
          data.reporter,
          data.type,
          data.dataSnapshot,
          data.primaryTicker
        );
        batch.update(ref, { visualType, visualConfig });
        backfilled++;
      }

      await batch.commit();
    }

    return res.status(200).json({
      success: true,
      backfilled,
      total: snapshot.size,
      skipped: snapshot.size - backfilled,
    });
  } catch (error) {
    console.error('[Backfill] Failed:', error.message);
    return res.status(500).json({ success: false, error: 'Backfill failed' });
  }
}
