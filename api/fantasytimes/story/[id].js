// api/fantasytimes/story/[id].js
// FantasyTimes Story Detail — returns a single story by Firestore ID.
// GET endpoint with CDN caching.

import { applySecurityMiddleware } from '../../_utils/security.js';
import { getFirebaseAdmin } from '../../_utils/firebaseAdmin.js';

export default async function handler(req, res) {
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 30, windowMs: 60000 } })) {
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { id } = req.query;

  if (!id || typeof id !== 'string' || id.length > 128) {
    return res.status(400).json({ success: false, error: 'Valid story ID required' });
  }

  // Sanitize: Firestore doc IDs are alphanumeric
  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!safeId) {
    return res.status(400).json({ success: false, error: 'Invalid story ID' });
  }

  try {
    const db = getFirebaseAdmin();
    const doc = await db.collection('fantasyTimesStories').doc(safeId).get();

    if (!doc.exists) {
      return res.status(404).json({ success: false, error: 'Story not found' });
    }

    const data = doc.data();
    const story = {
      id: doc.id,
      ...data,
      publishedAt: data.publishedAt?.toDate?.()
        ? data.publishedAt.toDate().toISOString()
        : data.publishedAt,
      expiresAt: data.expiresAt?.toDate?.()
        ? data.expiresAt.toDate().toISOString()
        : data.expiresAt,
    };

    // CDN cache: 5 minutes
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');

    return res.status(200).json({ success: true, story });
  } catch (error) {
    console.error('[FantasyTimes:Story] Error:', error.message);
    return res.status(500).json({ success: false, error: 'Failed to fetch story' });
  }
}
