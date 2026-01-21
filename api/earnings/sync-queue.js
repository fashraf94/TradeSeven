/**
 * Sync Queue Endpoint
 * Fetches earnings calendar and adds missing stocks to verification queue
 *
 * GET /api/earnings/sync-queue?days=7
 *
 * Designed to run as a cron job to keep queue updated with upcoming earnings
 */

import { applySecurityMiddleware } from '../_utils/security.js';

// Priority stocks - high-interest for retail investors
const PRIORITY_STOCKS = new Set([
  // Mega Cap Tech
  'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'META', 'NVDA', 'TSLA', 'AMD', 'INTC',
  'AVGO', 'ORCL', 'CRM', 'ADBE', 'NFLX', 'CSCO', 'IBM', 'QCOM', 'TXN', 'MU',
  // Financials
  'JPM', 'BAC', 'WFC', 'GS', 'MS', 'C', 'PNC', 'TFC', 'COF', 'AXP',
  'BLK', 'SCHW', 'CME', 'ICE', 'SPGI', 'MCO', 'MMC', 'AON', 'CB',
  // Healthcare
  'UNH', 'JNJ', 'PFE', 'MRK', 'ABBV', 'LLY', 'TMO', 'ABT', 'DHR', 'BMY',
  // Consumer
  'WMT', 'COST', 'HD', 'TGT', 'LOW', 'NKE', 'SBUX', 'MCD', 'YUM', 'CMG',
  'PG', 'KO', 'PEP',
  // Industrial
  'CAT', 'DE', 'BA', 'HON', 'UPS', 'FDX', 'UNP', 'LMT', 'RTX', 'GD', 'GE', 'MMM',
  // Energy
  'XOM', 'CVX', 'COP', 'SLB', 'HAL',
  // Airlines
  'DAL', 'UAL', 'AAL', 'LUV', 'ALK',
  // Homebuilders
  'DHI', 'LEN', 'PHM', 'NVR', 'TOL', 'KBH',
]);

export default async function handler(req, res) {
  // Security middleware - lower rate limit for cron
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 5, windowMs: 60000 } })) {
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { days = 7 } = req.query;

  // Auth check for cron
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const isTestMode = req.query.testMode === 'true';

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    if (!isVercelCron && !isTestMode) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  try {
    console.log(`[sync-queue] Starting sync for next ${days} days`);

    const db = await getFirestore();

    // Step 1: Fetch earnings calendar
    const calendarResponse = await fetch(
      `${getBaseUrl(req)}/api/stocks/earnings-calendar?days=${days}`
    );
    const calendarData = await calendarResponse.json();

    if (!calendarData.success || !calendarData.events) {
      return res.status(500).json({
        error: 'Could not fetch calendar',
        calendarResponse: calendarData
      });
    }

    const calendarEvents = calendarData.events;
    console.log(`[sync-queue] Found ${calendarEvents.length} earnings events`);

    // Step 2: Get existing queue and verification status
    const queueSnapshot = await db.collection('verificationQueue').get();
    const existingQueue = new Map();
    queueSnapshot.forEach(doc => {
      existingQueue.set(doc.id, doc.data());
    });

    const verificationSnapshot = await db.collection('earningsVerification').get();
    const existingVerifications = new Map();
    verificationSnapshot.forEach(doc => {
      existingVerifications.set(doc.id, doc.data());
    });

    console.log(`[sync-queue] Existing queue: ${existingQueue.size}, Verified: ${existingVerifications.size}`);

    // Step 3: Process each calendar event
    const added = [];
    const skipped = [];
    const updated = [];
    const batch = db.batch();
    let batchCount = 0;

    for (const event of calendarEvents) {
      const symbol = event.symbol?.toUpperCase();
      if (!symbol) continue;

      const existingQueueEntry = existingQueue.get(symbol);
      const existingVerification = existingVerifications.get(symbol);

      // Check if verification is fresh (within 30 days)
      const verificationIsFresh = existingVerification &&
        (Date.now() - new Date(existingVerification.verifiedAt).getTime()) < 30 * 24 * 60 * 60 * 1000;

      // Calculate priority score
      const priority = calculatePriority({
        symbol,
        reportDate: event.reportDate,
        marketCap: event.marketCap || 0,
        daysUntil: calculateDaysUntil(event.reportDate)
      });

      if (existingQueueEntry) {
        // Already in queue - check if we should update
        if (existingQueueEntry.status === 'complete' && verificationIsFresh) {
          skipped.push({ symbol, reason: 'already_verified' });
          continue;
        }

        // Update if priority changed or status needs reset
        if (priority > existingQueueEntry.priority || existingQueueEntry.status === 'failed') {
          const ref = db.collection('verificationQueue').doc(symbol);
          batch.update(ref, {
            priority: Math.max(priority, existingQueueEntry.priority),
            reportDate: event.reportDate,
            status: existingQueueEntry.status === 'failed' ? 'pending' : existingQueueEntry.status,
            lastUpdated: new Date().toISOString()
          });
          updated.push({ symbol, priority, previousPriority: existingQueueEntry.priority });
          batchCount++;
        } else {
          skipped.push({ symbol, reason: 'already_queued' });
        }
      } else if (verificationIsFresh) {
        // Has fresh verification, skip
        skipped.push({ symbol, reason: 'recently_verified' });
      } else {
        // Add to queue
        const ref = db.collection('verificationQueue').doc(symbol);
        batch.set(ref, {
          symbol,
          reportDate: event.reportDate,
          addedAt: new Date().toISOString(),
          priority,
          status: 'pending',
          quartersVerified: 0,
          quartersTotal: 12,
          lastAttempt: null,
          nextAttempt: new Date().toISOString(),
          errors: [],
          marketCap: event.marketCap || null,
          companyName: event.companyName || null
        });
        added.push({ symbol, priority, reportDate: event.reportDate });
        batchCount++;
      }

      // Commit batch every 400 operations (Firestore limit is 500)
      if (batchCount >= 400) {
        await batch.commit();
        batchCount = 0;
      }
    }

    // Commit remaining
    if (batchCount > 0) {
      await batch.commit();
    }

    // Step 4: Clean up old queue entries (earnings date passed)
    const cleanedUp = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const [symbol, entry] of existingQueue) {
      if (entry.reportDate && new Date(entry.reportDate) < today && entry.status !== 'complete') {
        // Mark as expired
        await db.collection('verificationQueue').doc(symbol).update({
          status: 'expired',
          expiredAt: new Date().toISOString()
        });
        cleanedUp.push(symbol);
      }
    }

    // Step 5: Get queue statistics
    const pendingCount = await db.collection('verificationQueue')
      .where('status', '==', 'pending')
      .count()
      .get();

    const inProgressCount = await db.collection('verificationQueue')
      .where('status', '==', 'in_progress')
      .count()
      .get();

    const partialCount = await db.collection('verificationQueue')
      .where('status', '==', 'partial')
      .count()
      .get();

    const summary = {
      calendarEvents: calendarEvents.length,
      added: added.length,
      updated: updated.length,
      skipped: skipped.length,
      cleanedUp: cleanedUp.length,
      queueStats: {
        pending: pendingCount.data().count,
        inProgress: inProgressCount.data().count,
        partial: partialCount.data().count
      }
    };

    console.log(`[sync-queue] Complete:`, summary);
    console.log(`[sync-queue] Added stocks:`, added.map(a => a.symbol).slice(0, 20));

    return res.status(200).json({
      success: true,
      summary,
      added: added.slice(0, 50), // Limit response size
      updated: updated.slice(0, 20),
      cleanedUp,
      syncedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('[sync-queue] Sync failed:', error);
    return res.status(500).json({
      error: 'Sync failed',
      message: error.message
    });
  }
}

/**
 * Calculate days until a date
 */
function calculateDaysUntil(dateString) {
  if (!dateString) return 7; // Default
  const target = new Date(dateString);
  const now = new Date();
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

/**
 * Calculate priority score (0-100)
 */
function calculatePriority({ symbol, reportDate, marketCap, daysUntil }) {
  // Days until earnings factor (30% weight) - closer = higher
  const daysFactor = Math.max(0, Math.min(100, 100 - (daysUntil * 10)));

  // Market cap factor (25% weight)
  let capFactor = 50;
  if (marketCap) {
    if (marketCap >= 200e9) capFactor = 100;      // Mega cap
    else if (marketCap >= 10e9) capFactor = 75;   // Large cap
    else if (marketCap >= 2e9) capFactor = 50;    // Mid cap
    else capFactor = 25;                           // Small cap
  }

  // Priority stocks list factor (20% weight)
  const priorityListFactor = PRIORITY_STOCKS.has(symbol) ? 100 : 0;

  // User interest proxy (15% weight)
  const userInterestFactor = PRIORITY_STOCKS.has(symbol) ? 75 : 25;

  // Mismatch factor not available at sync time (10% weight) - default to 0
  const mismatchFactor = 0;

  // Calculate weighted score
  const score = Math.round(
    (daysFactor * 0.30) +
    (capFactor * 0.25) +
    (priorityListFactor * 0.20) +
    (userInterestFactor * 0.15) +
    (mismatchFactor * 0.10)
  );

  return Math.min(100, Math.max(0, score));
}

/**
 * Get base URL for internal API calls
 */
function getBaseUrl(req) {
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${protocol}://${host}`;
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
