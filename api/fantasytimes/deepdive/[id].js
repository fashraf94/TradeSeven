// api/fantasytimes/deepdive/[id].js
// FantasyTimes Deepdive Detail — returns a single Vera deepdive doc by Firestore ID.
// GET endpoint with CDN caching. Mirrors story/[id].js.
//
// Vera's full long-form markdown lives in the `fantasyTimesDeepdives` collection,
// separate from the lightweight summary that lands in `fantasyTimesStories`. The
// story object carries `visualConfig.fullDeepdiveId`; the VeraDeepDive page uses
// that id to fetch the full markdown via this endpoint on mount.

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
    return res.status(400).json({ success: false, error: 'Valid deepdive ID required' });
  }

  // Sanitize: Firestore doc IDs are alphanumeric
  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!safeId) {
    return res.status(400).json({ success: false, error: 'Invalid deepdive ID' });
  }

  try {
    const db = getFirebaseAdmin();
    const doc = await db.collection('fantasyTimesDeepdives').doc(safeId).get();

    if (!doc.exists) {
      return res.status(404).json({ success: false, error: 'Deepdive not found' });
    }

    const data = doc.data();
    const deepdive = {
      id: doc.id,
      ...data,
      generatedAt: data.generatedAt?.toDate?.()
        ? data.generatedAt.toDate().toISOString()
        : data.generatedAt,
    };

    // CDN cache: 5 minutes
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');

    return res.status(200).json({ success: true, deepdive });
  } catch (error) {
    console.error('[FantasyTimes:Deepdive:Fetch] Error:', error.message);
    return res.status(500).json({ success: false, error: 'Failed to fetch deepdive' });
  }
}
