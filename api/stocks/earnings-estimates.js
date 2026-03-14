// Vercel Serverless Function — Earnings Estimates
// Endpoint: GET /api/stocks/earnings-estimates?symbol=NVDA
//
// Returns cached earnings estimates for a given stock, including:
// - RSR, EMS, EMS percentile
// - Surprise streak and average surprise
// - Forward estimates (current/next quarter, current/next year)
// - Estimate spread
//
// Data is computed weekly by api/cron/compute-estimates.js and cached in Firestore.

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { applySecurityMiddleware } from '../_utils/security.js';
import { getFromCache, setInCache, setCacheHeaders } from '../_utils/serverCache.js';

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

  const symbol = req.query.symbol || req.query.ticker;
  if (!symbol) {
    return res.status(400).json({ error: 'Missing symbol parameter' });
  }

  const upper = symbol.toUpperCase();
  const cacheKey = `estimates_${upper}`;

  // L1: Check in-memory cache (5 min TTL)
  const cached = getFromCache(cacheKey);
  if (cached) {
    setCacheHeaders(res, 3600, 600);
    return res.status(200).json(cached);
  }

  try {
    const db = getFirebaseAdmin();
    const doc = await db.collection('estimatesCache').doc('latest').get();

    if (!doc.exists) {
      return res.status(503).json({
        success: false,
        error: 'Estimates not yet computed',
        message: 'The estimates cache has not been populated yet. The weekly cron runs Saturday at ~6 AM ET.',
      });
    }

    const data = doc.data();
    const stockData = data.stocks?.[upper];

    if (!stockData) {
      return res.status(404).json({
        success: false,
        error: 'Stock not found in estimates cache',
        message: `No estimates data for ${upper}.`,
      });
    }

    const computedAt = data.computedAt ? new Date(data.computedAt) : new Date();
    const age = Date.now() - computedAt.getTime();

    const response = {
      success: true,
      data: {
        ticker: upper,
        ...stockData,
      },
      meta: {
        computedAt: computedAt.toISOString(),
        ageMinutes: Math.round(age / 60000),
      },
    };

    setInCache(cacheKey, response, 300);
    setCacheHeaders(res, 3600, 600);
    return res.status(200).json(response);

  } catch (err) {
    console.error(`[EarningsEstimates] Error: ${err.message}`);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: err.message,
    });
  }
}
