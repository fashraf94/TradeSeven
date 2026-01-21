/**
 * Verification Status Endpoint
 * Returns verification status and cached data for a symbol
 *
 * GET /api/earnings/verification-status?symbol=UAL
 * Returns complete verification status including cache data
 *
 * GET /api/earnings/verification-status?dashboard=true
 * Returns overall verification dashboard stats
 */

import { applySecurityMiddleware } from '../_utils/security.js';

export default async function handler(req, res) {
  // Security middleware
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 30, windowMs: 60000 } })) {
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { symbol, dashboard } = req.query;

  if (dashboard === 'true') {
    return handleDashboard(req, res);
  }

  if (!symbol) {
    return res.status(400).json({ error: 'Symbol required (or use dashboard=true for stats)' });
  }

  return handleSymbolStatus(req, res, symbol.toUpperCase());
}

/**
 * Get verification status for a specific symbol
 */
async function handleSymbolStatus(req, res, symbol) {
  try {
    const db = await getFirestore();

    // Get verification cache
    const verificationDoc = await db.collection('earningsVerification').doc(symbol).get();

    // Get queue status
    const queueDoc = await db.collection('verificationQueue').doc(symbol).get();

    if (!verificationDoc.exists && !queueDoc.exists) {
      return res.status(200).json({
        success: true,
        symbol,
        status: 'not_found',
        verified: false,
        inQueue: false,
        message: 'No verification data found. Add to queue using POST /api/earnings/queue-verification'
      });
    }

    const verification = verificationDoc.exists ? verificationDoc.data() : null;
    const queue = queueDoc.exists ? queueDoc.data() : null;

    // Determine overall status
    let status = 'unknown';
    if (verification && verification.quartersVerified >= 12) {
      status = 'complete';
    } else if (verification && verification.quartersVerified > 0) {
      status = 'partial';
    } else if (queue?.status === 'in_progress') {
      status = 'in_progress';
    } else if (queue?.status === 'pending') {
      status = 'pending';
    } else if (queue?.status === 'failed') {
      status = 'failed';
    }

    // Check if verification is fresh (within 30 days)
    let verificationFresh = false;
    let verificationAge = null;
    if (verification?.verifiedAt) {
      const verifiedAt = new Date(verification.verifiedAt);
      const ageMs = Date.now() - verifiedAt.getTime();
      const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
      verificationFresh = ageDays < 30;
      verificationAge = {
        days: ageDays,
        hours: Math.floor(ageMs / (1000 * 60 * 60)) % 24,
        fresh: verificationFresh
      };
    }

    // Build response
    const response = {
      success: true,
      symbol,
      status,
      verified: status === 'complete',
      verificationFresh,
      verificationAge,

      // Verification data (if available)
      verification: verification ? {
        verifiedAt: verification.verifiedAt,
        quartersVerified: verification.quartersVerified,
        quartersTotal: verification.quartersTotal || 12,
        mismatches: verification.mismatches,
        summary: verification.summary
      } : null,

      // Queue data (if in queue)
      queue: queue ? {
        status: queue.status,
        priority: queue.priority,
        quartersVerified: queue.quartersVerified,
        quartersTotal: queue.quartersTotal,
        addedAt: queue.addedAt,
        lastAttempt: queue.lastAttempt,
        nextAttempt: queue.nextAttempt,
        reportDate: queue.reportDate,
        errors: queue.errors?.slice(-3) // Last 3 errors only
      } : null,

      // Full quarter details if complete
      quarters: verification?.quarters?.map(q => ({
        quarterLabel: q.quarterLabel,
        reportDate: q.reportDate,
        eodhBeat: q.eodh?.didBeat,
        verifiedBeat: q.verified?.didBeat,
        mismatch: q.mismatch,
        confidence: q.verified?.confidence || q.webSearch?.confidence,
        source: q.webSearch?.source
      })) || []
    };

    return res.status(200).json(response);

  } catch (error) {
    console.error(`[verification-status] Error for ${symbol}:`, error);
    return res.status(500).json({
      error: 'Failed to get verification status',
      message: error.message
    });
  }
}

/**
 * Get verification dashboard statistics
 */
async function handleDashboard(req, res) {
  try {
    const db = await getFirestore();

    // Get queue statistics
    const queueStats = {
      pending: 0,
      inProgress: 0,
      partial: 0,
      complete: 0,
      failed: 0,
      expired: 0
    };

    const queueSnapshot = await db.collection('verificationQueue').get();
    queueSnapshot.forEach(doc => {
      const status = doc.data().status;
      if (queueStats[status] !== undefined) {
        queueStats[status]++;
      } else if (status === 'in_progress') {
        queueStats.inProgress++;
      }
    });

    // Get verification statistics
    const verificationSnapshot = await db.collection('earningsVerification').get();
    let totalVerified = 0;
    let totalMismatches = 0;
    let recentlyVerified = 0;
    let verificationsByDay = {};

    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

    verificationSnapshot.forEach(doc => {
      const data = doc.data();
      totalVerified++;
      totalMismatches += data.mismatches || 0;

      if (data.verifiedAt) {
        const verifiedDate = new Date(data.verifiedAt);
        if (verifiedDate.getTime() > thirtyDaysAgo) {
          recentlyVerified++;
        }

        // Group by day
        const dayKey = verifiedDate.toISOString().split('T')[0];
        verificationsByDay[dayKey] = (verificationsByDay[dayKey] || 0) + 1;
      }
    });

    // Get top priority stocks in queue
    const topPrioritySnapshot = await db.collection('verificationQueue')
      .where('status', 'in', ['pending', 'partial'])
      .orderBy('priority', 'desc')
      .limit(10)
      .get();

    const topPriority = [];
    topPrioritySnapshot.forEach(doc => {
      const data = doc.data();
      topPriority.push({
        symbol: data.symbol,
        priority: data.priority,
        status: data.status,
        quartersVerified: data.quartersVerified,
        reportDate: data.reportDate
      });
    });

    // Get recently failed
    const failedSnapshot = await db.collection('verificationQueue')
      .where('status', '==', 'failed')
      .orderBy('lastAttempt', 'desc')
      .limit(5)
      .get();

    const recentlyFailed = [];
    failedSnapshot.forEach(doc => {
      const data = doc.data();
      recentlyFailed.push({
        symbol: data.symbol,
        lastAttempt: data.lastAttempt,
        errors: data.errors?.slice(-1) // Last error only
      });
    });

    // Get stocks with mismatches
    const mismatchSnapshot = await db.collection('earningsVerification')
      .where('mismatches', '>', 0)
      .orderBy('mismatches', 'desc')
      .limit(10)
      .get();

    const stocksWithMismatches = [];
    mismatchSnapshot.forEach(doc => {
      const data = doc.data();
      stocksWithMismatches.push({
        symbol: data.symbol,
        mismatches: data.mismatches,
        quartersVerified: data.quartersVerified,
        verifiedAt: data.verifiedAt,
        eodhBeatRate: data.summary?.eodhBeatRate,
        verifiedBeatRate: data.summary?.verifiedBeatRate
      });
    });

    // Calculate daily verification rate
    const sortedDays = Object.keys(verificationsByDay).sort().slice(-7);
    const dailyRate = sortedDays.map(day => ({
      date: day,
      count: verificationsByDay[day]
    }));

    return res.status(200).json({
      success: true,
      dashboard: true,
      timestamp: new Date().toISOString(),

      queue: {
        total: queueSnapshot.size,
        ...queueStats
      },

      verification: {
        total: totalVerified,
        recentlyVerified,
        totalMismatches,
        averageMismatchRate: totalVerified > 0
          ? (totalMismatches / (totalVerified * 12) * 100).toFixed(2) + '%'
          : '0%'
      },

      topPriority,
      recentlyFailed,
      stocksWithMismatches,
      dailyRate
    });

  } catch (error) {
    console.error('[verification-status] Dashboard error:', error);
    return res.status(500).json({
      error: 'Failed to get dashboard stats',
      message: error.message
    });
  }
}

/**
 * Firebase Admin initialization
 */
let firestoreInstance = null;

async function getFirestore() {
  if (firestoreInstance) return firestoreInstance;

  const { getFirestore: getFs } = await import('firebase-admin/firestore');
  const { initializeApp, getApps, cert } = await import('firebase-admin/app');

  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  }

  firestoreInstance = getFs();
  return firestoreInstance;
}
