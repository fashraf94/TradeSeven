// Vercel Serverless Function — Peer Rankings
// Endpoint: GET /api/stocks/peer-rankings?symbol=NVDA
//
// Returns the sector-adjusted ranking for a given stock, including:
// - Composite score and rank within sector
// - Per-dimension percentile breakdowns (8 dimensions, 6 pillars)
// - Sector leaderboard (all peers ranked)
// - Sector summary (sector's own cross-sector rank)
//
// Data is computed daily by api/cron/compute-rankings.js and cached in Firestore.

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { applySecurityMiddleware } from '../_utils/security.js';
import { getFromCache, setInCache, setCacheHeaders, CACHE_TIERS } from '../_utils/serverCache.js';
import { TICKER_TO_SECTOR, ALL_TICKERS } from '../_utils/rankingConfig.js';

// ---------------------------------------------------------------------------
// Firebase Admin
// ---------------------------------------------------------------------------

function getFirebaseAdmin() {
  if (getApps().length === 0) {
    const serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    };
    initializeApp({ credential: cert(serviceAccount) });
  }
  return getFirestore();
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export default async function handler(req, res) {
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 60, windowMs: 60000 } })) {
    return;
  }

  const { symbol } = req.query;
  if (!symbol) {
    return res.status(400).json({ error: 'Missing symbol parameter' });
  }

  const upper = symbol.toUpperCase();
  const cacheKey = `peer_rankings_${upper}`;

  // L1: Check in-memory cache (5 min TTL)
  const cached = getFromCache(cacheKey);
  if (cached) {
    setCacheHeaders(res, 3600, 600);
    return res.status(200).json(cached);
  }

  try {
    const db = getFirebaseAdmin();
    const doc = await db.collection('peerRankings').doc(upper).get();

    if (!doc.exists) {
      // Check if symbol is in our universe at all
      const isInUniverse = ALL_TICKERS.includes(upper);
      return res.status(404).json({
        success: false,
        error: 'Rankings not available',
        message: isInUniverse
          ? `Rankings for ${upper} have not been computed yet. The daily cron job runs at ~6 AM ET.`
          : `${upper} is not in the rankings universe (~220 S&P 500 stocks).`,
        inUniverse: isInUniverse,
      });
    }

    const data = doc.data();

    // Check staleness
    const computedAt = data.computedAt?.toDate?.() || new Date(data.computedAt);
    const age = Date.now() - computedAt.getTime();
    const isStale = age > 26 * 60 * 60 * 1000;

    const result = {
      success: true,
      data: {
        ...data,
        computedAt: computedAt.toISOString(),
        expiresAt: data.expiresAt?.toDate?.()?.toISOString() || null,
      },
      meta: {
        computedAt: computedAt.toISOString(),
        ageMinutes: Math.round(age / 60000),
        isStale,
      },
    };

    // Cache in memory (5 min)
    setInCache(cacheKey, result, 300);
    setCacheHeaders(res, 3600, 600);

    return res.status(200).json(result);

  } catch (error) {
    console.error(`[PeerRankings] Error fetching ${upper}:`, error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch peer rankings',
      message: error.message,
    });
  }
}
