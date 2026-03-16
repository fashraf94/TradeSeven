// api/fantasytimes/test-art-director.js
// Manual test endpoint for Art Director visual assignment.
// GET endpoint protected by cron auth.

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { runArtDirector } from './art-director.js';

export const config = { maxDuration: 15 };

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

    // Fetch most recent published story
    const snapshot = await db
      .collection('fantasyTimesStories')
      .where('status', '==', 'published')
      .orderBy('publishedAt', 'desc')
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.status(200).json({ success: false, error: 'No published stories found' });
    }

    const doc = snapshot.docs[0];
    const story = doc.data();

    // Run Art Director
    const artDirectorResult = await runArtDirector({
      headline: story.headline,
      body: story.body,
      reporter: story.reporter,
      type: story.type,
      primaryTicker: story.primaryTicker,
      sentiment: story.sentiment,
      dataSnapshot: story.dataSnapshot,
    });

    return res.status(200).json({
      success: true,
      storyId: doc.id,
      headline: story.headline,
      reporter: story.reporter,
      type: story.type,
      currentVisual: {
        visualType: story.visualType || 'none',
        visualConfig: story.visualConfig || {},
      },
      artDirectorResult,
      wouldOverride:
        artDirectorResult.visualType !== 'none' &&
        artDirectorResult.visualType !== (story.visualType || 'none'),
    });
  } catch (error) {
    console.error('[TestArtDirector] Failed:', error.message);
    return res.status(500).json({ success: false, error: 'Test failed' });
  }
}
