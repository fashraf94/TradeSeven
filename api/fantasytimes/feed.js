// api/fantasytimes/feed.js
// FantasyTimes Feed — returns all active (non-expired) stories.
// GET endpoint. Client handles personalization and lazy rendering.

import { applySecurityMiddleware } from '../_utils/security.js';
import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';

export default async function handler(req, res) {
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 30, windowMs: 60000 } })) {
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const db = getFirebaseAdmin();
    const now = new Date();

    // Query active stories: published + not expired, ordered by newest first
    const snapshot = await db
      .collection('fantasyTimesStories')
      .where('status', '==', 'published')
      .where('expiresAt', '>', now)
      .orderBy('expiresAt', 'asc') // Required by Firestore for range filter
      .orderBy('publishedAt', 'desc')
      .limit(100)
      .get();

    const stories = snapshot.docs
      // Phase 1: suppress Vera deepdive stories from the feed until Phase 2
      // implements the deepdive card render. Single-line revert when Phase 2 ships.
      .filter((doc) => doc.data().type !== 'deepdive')
      .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          // Convert Firestore timestamps to ISO strings for JSON serialization
          publishedAt: data.publishedAt?.toDate?.()
            ? data.publishedAt.toDate().toISOString()
            : data.publishedAt,
          expiresAt: data.expiresAt?.toDate?.()
            ? data.expiresAt.toDate().toISOString()
            : data.expiresAt,
        };
      });

    // Re-sort by publishedAt desc since Firestore required expiresAt ordering
    stories.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

    // CDN cache: 60 seconds, serve stale for 30s while revalidating
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30');

    return res.status(200).json({
      success: true,
      count: stories.length,
      stories,
    });
  } catch (error) {
    console.error('[FantasyTimes:Feed] Error:', error.message);
    return res.status(500).json({ success: false, error: 'Failed to fetch stories' });
  }
}
