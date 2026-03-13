// Vercel Serverless Function — Scanner Summary
// Endpoint: GET /api/scanner-summary
//
// Returns the global Coiled Spring / Running on Fumes scanner summary
// for the Research dashboard. Data is computed daily by the rankings cron.
// ~2KB payload, cached with 5-min in-memory + CDN headers.

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { applySecurityMiddleware } from './_utils/security.js';
import { getFromCache, setInCache, setCacheHeaders } from './_utils/serverCache.js';

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

const CACHE_KEY = 'scanner_summary';
const MEMORY_TTL = 300; // 5 minutes

export default async function handler(req, res) {
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 60, windowMs: 60000 } })) {
    return;
  }

  // L1: Check in-memory cache
  const cached = getFromCache(CACHE_KEY);
  if (cached) {
    setCacheHeaders(res, 3600, 600);
    return res.status(200).json(cached);
  }

  try {
    const db = getFirebaseAdmin();
    const doc = await db.collection('scannerSummary').doc('latest').get();

    if (!doc.exists) {
      const empty = {
        success: true,
        data: {
          computedAt: null,
          coiledSprings: { total: 0, top3: [], bySector: {} },
          runningOnFumes: { total: 0, top3: [], bySector: {} },
        },
        meta: { message: 'Scanner data not yet computed. The daily cron runs at ~6 AM ET.' },
      };
      setCacheHeaders(res, 300, 60);
      return res.status(200).json(empty);
    }

    const data = doc.data();
    const result = {
      success: true,
      data,
      meta: {
        computedAt: data.computedAt || null,
      },
    };

    // Cache in memory (5 min)
    setInCache(CACHE_KEY, result, MEMORY_TTL);
    setCacheHeaders(res, 3600, 600);

    return res.status(200).json(result);

  } catch (error) {
    console.error('[ScannerSummary] Error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch scanner summary',
      message: error.message,
    });
  }
}
