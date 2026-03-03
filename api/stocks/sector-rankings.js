// Vercel Serverless Function — Sector Rankings
// Endpoint: GET /api/stocks/sector-rankings[?highlight=XLK]
//
// Returns all 11 GICS sectors ranked by composite score, including:
// - Per-sector composite score and tier label
// - Breadth (% of stocks above 52w midpoint)
// - 3M relative momentum vs SPY
// - Median revenue growth, forward P/E, earnings revisions
//
// Optional ?highlight=XLK parameter marks a specific sector for frontend highlighting.
// Optional ?symbol=NVDA resolves the symbol to its sector and highlights it.
//
// Data is computed daily by api/cron/compute-rankings.js and cached in Firestore.

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { applySecurityMiddleware } from '../_utils/security.js';
import { getFromCache, setInCache, setCacheHeaders } from '../_utils/serverCache.js';
import { TICKER_TO_SECTOR } from '../_utils/rankingConfig.js';

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

  const cacheKey = 'sector_rankings_latest';

  // L1: Check in-memory cache (5 min TTL)
  const cached = getFromCache(cacheKey);
  if (cached) {
    // Apply highlight before returning
    const result = applyHighlight(cached, req.query);
    setCacheHeaders(res, 3600, 600);
    return res.status(200).json(result);
  }

  try {
    const db = getFirebaseAdmin();
    const doc = await db.collection('sectorRankings').doc('latest').get();

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Sector rankings not available',
        message: 'The daily cron job has not run yet. Rankings are computed at ~6 AM ET.',
      });
    }

    const data = doc.data();
    const computedAt = data.computedAt?.toDate?.() || new Date(data.computedAt);
    const age = Date.now() - computedAt.getTime();
    const isStale = age > 26 * 60 * 60 * 1000;

    const baseResult = {
      success: true,
      data: {
        sectors: data.sectors || [],
        computedAt: computedAt.toISOString(),
        expiresAt: data.expiresAt?.toDate?.()?.toISOString() || null,
      },
      meta: {
        computedAt: computedAt.toISOString(),
        ageMinutes: Math.round(age / 60000),
        isStale,
        totalSectors: (data.sectors || []).length,
      },
    };

    // Cache base result (5 min)
    setInCache(cacheKey, baseResult, 300);
    setCacheHeaders(res, 3600, 600);

    // Apply highlight
    const result = applyHighlight(baseResult, req.query);
    return res.status(200).json(result);

  } catch (error) {
    console.error('[SectorRankings] Error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch sector rankings',
      message: error.message,
    });
  }
}

/**
 * Mark a highlighted sector based on query params.
 */
function applyHighlight(result, query) {
  const { highlight, symbol } = query || {};

  let highlightSectorId = highlight?.toUpperCase() || null;

  // Resolve symbol to sector if provided
  if (!highlightSectorId && symbol) {
    highlightSectorId = TICKER_TO_SECTOR[symbol.toUpperCase()] || null;
  }

  if (!highlightSectorId) return result;

  // Clone and mark
  return {
    ...result,
    data: {
      ...result.data,
      highlightSectorId,
      sectors: result.data.sectors.map(s => ({
        ...s,
        isHighlighted: s.sectorId === highlightSectorId,
      })),
    },
  };
}
