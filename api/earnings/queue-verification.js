/**
 * Queue Verification Endpoint
 * Adds stocks to the verification queue with priority scoring
 *
 * POST /api/earnings/queue-verification
 * Body: { symbol: "UAL", reportDate: "2026-01-28", priority: "high" }
 *
 * GET /api/earnings/queue-verification?symbol=UAL
 * Returns queue status for a specific symbol
 */

import { applySecurityMiddleware } from '../_utils/security.js';

// Priority stocks from polymarketService - high-interest stocks for retail investors
const PRIORITY_STOCKS = new Set([
  // Mega Cap Tech
  'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'META', 'NVDA', 'TSLA', 'AMD', 'INTC',
  'AVGO', 'ORCL', 'CRM', 'ADBE', 'NFLX', 'CSCO', 'IBM', 'QCOM', 'TXN', 'MU',
  // Financials
  'JPM', 'BAC', 'WFC', 'GS', 'MS', 'C', 'PNC', 'TFC', 'COF', 'AXP',
  'BLK', 'SCHW', 'CME', 'ICE', 'SPGI', 'MCO', 'MMC', 'AON', 'CB',
  // Healthcare
  'UNH', 'JNJ', 'PFE', 'MRK', 'ABBV', 'LLY', 'TMO', 'ABT', 'DHR', 'BMY',
  'AMGN', 'GILD', 'VRTX', 'REGN', 'ISRG', 'MDT', 'SYK', 'BDX', 'ZTS', 'CI',
  // Consumer
  'WMT', 'COST', 'HD', 'TGT', 'LOW', 'NKE', 'SBUX', 'MCD', 'YUM', 'CMG',
  'PG', 'KO', 'PEP', 'PM', 'MO', 'CL', 'KMB', 'GIS', 'K', 'CAG',
  // Industrial
  'CAT', 'DE', 'BA', 'HON', 'UPS', 'FDX', 'UNP', 'LMT', 'RTX', 'GD',
  'NOC', 'GE', 'MMM', 'EMR', 'ETN', 'ITW', 'PH', 'ROK', 'CMI', 'PCAR',
  // Energy
  'XOM', 'CVX', 'COP', 'SLB', 'EOG', 'MPC', 'VLO', 'PSX', 'OXY', 'HAL',
  // Airlines
  'DAL', 'UAL', 'AAL', 'LUV', 'ALK', 'JBLU',
  // Homebuilders
  'DHI', 'LEN', 'PHM', 'NVR', 'TOL', 'KBH',
]);

// Market cap tiers (approximate values for priority calculation)
const MEGA_CAP_THRESHOLD = 200e9;
const LARGE_CAP_THRESHOLD = 10e9;
const MID_CAP_THRESHOLD = 2e9;

export default async function handler(req, res) {
  // Security middleware
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 30, windowMs: 60000 } })) {
    return;
  }

  if (req.method === 'POST') {
    return handleAddToQueue(req, res);
  } else if (req.method === 'GET') {
    return handleGetQueueStatus(req, res);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

/**
 * Add a stock to the verification queue
 */
async function handleAddToQueue(req, res) {
  const { symbol, reportDate, priority, marketCap, previousMismatches } = req.body;

  if (!symbol) {
    return res.status(400).json({ error: 'Symbol required' });
  }

  const upperSymbol = symbol.toUpperCase();

  try {
    const db = await getFirestore();

    // Calculate priority score
    const priorityScore = calculatePriority({
      symbol: upperSymbol,
      reportDate: reportDate || null,
      priority: priority,
      marketCap: marketCap || 0,
      previousMismatches: previousMismatches || 0
    });

    // Check if already in queue
    const existingDoc = await db.collection('verificationQueue').doc(upperSymbol).get();

    if (existingDoc.exists) {
      const existing = existingDoc.data();
      // Update if new priority is higher or status is failed
      if (priorityScore > existing.priority || existing.status === 'failed') {
        await db.collection('verificationQueue').doc(upperSymbol).update({
          priority: Math.max(priorityScore, existing.priority),
          reportDate: reportDate || existing.reportDate,
          status: existing.status === 'failed' ? 'pending' : existing.status,
          lastUpdated: new Date().toISOString()
        });

        console.log(`[queue-verification] Updated ${upperSymbol} in queue with priority ${priorityScore}`);
        return res.status(200).json({
          success: true,
          queued: true,
          updated: true,
          symbol: upperSymbol,
          priority: Math.max(priorityScore, existing.priority),
          status: existing.status === 'failed' ? 'pending' : existing.status
        });
      }

      console.log(`[queue-verification] ${upperSymbol} already in queue with higher priority`);
      return res.status(200).json({
        success: true,
        queued: false,
        alreadyExists: true,
        symbol: upperSymbol,
        currentPriority: existing.priority,
        currentStatus: existing.status
      });
    }

    // Add new entry to queue
    const queueEntry = {
      symbol: upperSymbol,
      reportDate: reportDate || null,
      addedAt: new Date().toISOString(),
      priority: priorityScore,
      status: 'pending',
      quartersVerified: 0,
      quartersTotal: 12,
      lastAttempt: null,
      nextAttempt: new Date().toISOString(),
      errors: []
    };

    await db.collection('verificationQueue').doc(upperSymbol).set(queueEntry);

    // Get queue position (count of items with higher priority)
    const higherPriorityCount = await db.collection('verificationQueue')
      .where('priority', '>', priorityScore)
      .where('status', 'in', ['pending', 'partial'])
      .count()
      .get();

    const position = higherPriorityCount.data().count + 1;

    console.log(`[queue-verification] Added ${upperSymbol} to queue at position ${position} with priority ${priorityScore}`);

    return res.status(200).json({
      success: true,
      queued: true,
      symbol: upperSymbol,
      priority: priorityScore,
      position,
      estimatedCompletion: getEstimatedCompletion(position)
    });

  } catch (error) {
    console.error(`[queue-verification] Error adding ${upperSymbol} to queue:`, error);
    return res.status(500).json({
      error: 'Failed to add to queue',
      message: error.message
    });
  }
}

/**
 * Get queue status for a symbol
 */
async function handleGetQueueStatus(req, res) {
  const { symbol } = req.query;

  if (!symbol) {
    return res.status(400).json({ error: 'Symbol required' });
  }

  const upperSymbol = symbol.toUpperCase();

  try {
    const db = await getFirestore();

    const doc = await db.collection('verificationQueue').doc(upperSymbol).get();

    if (!doc.exists) {
      // Check if verification already complete
      const verificationDoc = await db.collection('earningsVerification').doc(upperSymbol).get();

      if (verificationDoc.exists) {
        const verification = verificationDoc.data();
        return res.status(200).json({
          success: true,
          symbol: upperSymbol,
          status: 'complete',
          inQueue: false,
          verification: {
            verifiedAt: verification.verifiedAt,
            quartersVerified: verification.quartersVerified,
            mismatches: verification.mismatches
          }
        });
      }

      return res.status(200).json({
        success: true,
        symbol: upperSymbol,
        status: 'not_found',
        inQueue: false
      });
    }

    const data = doc.data();

    // Get current position in queue
    const higherPriorityCount = await db.collection('verificationQueue')
      .where('priority', '>', data.priority)
      .where('status', 'in', ['pending', 'partial'])
      .count()
      .get();

    const position = higherPriorityCount.data().count + 1;

    return res.status(200).json({
      success: true,
      symbol: upperSymbol,
      inQueue: true,
      status: data.status,
      priority: data.priority,
      position,
      quartersVerified: data.quartersVerified,
      quartersTotal: data.quartersTotal,
      reportDate: data.reportDate,
      addedAt: data.addedAt,
      lastAttempt: data.lastAttempt,
      nextAttempt: data.nextAttempt,
      errors: data.errors || [],
      estimatedCompletion: getEstimatedCompletion(position)
    });

  } catch (error) {
    console.error(`[queue-verification] Error getting status for ${upperSymbol}:`, error);
    return res.status(500).json({
      error: 'Failed to get queue status',
      message: error.message
    });
  }
}

/**
 * Calculate priority score (0-100)
 * Higher score = higher priority = processed first
 */
function calculatePriority(stock) {
  const { symbol, reportDate, priority, marketCap, previousMismatches } = stock;

  // Manual priority override
  if (priority === 'high' || priority === 100) return 100;
  if (priority === 'low' || priority === 0) return 25;
  if (typeof priority === 'number') return Math.min(100, Math.max(0, priority));

  // Days until earnings factor (30% weight)
  let daysFactor = 50; // Default if no report date
  if (reportDate) {
    const daysUntilEarnings = Math.ceil(
      (new Date(reportDate) - new Date()) / (1000 * 60 * 60 * 24)
    );
    // Closer = higher priority (7 days = 100, 0 days = 0)
    daysFactor = Math.max(0, Math.min(100, 100 - (daysUntilEarnings * 10)));
  }

  // Market cap tier factor (25% weight)
  let capFactor = 50; // Default if no market cap
  if (marketCap) {
    if (marketCap >= MEGA_CAP_THRESHOLD) capFactor = 100;
    else if (marketCap >= LARGE_CAP_THRESHOLD) capFactor = 75;
    else if (marketCap >= MID_CAP_THRESHOLD) capFactor = 50;
    else capFactor = 25;
  }

  // Priority stocks list factor (20% weight)
  const priorityListFactor = PRIORITY_STOCKS.has(symbol) ? 100 : 0;

  // User interest factor (15% weight) - simplified, could be enhanced with actual metrics
  const userInterestFactor = PRIORITY_STOCKS.has(symbol) ? 75 : 25;

  // Previous mismatches factor (10% weight)
  const mismatchFactor = previousMismatches > 0 ? 100 : 0;

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
 * Estimate when verification will complete based on queue position
 * Assumes ~2 stocks per hour processing rate
 */
function getEstimatedCompletion(position) {
  const hoursPerStock = 0.5; // Approximately 2 stocks per hour
  const hoursUntilComplete = position * hoursPerStock;
  const estimatedDate = new Date(Date.now() + hoursUntilComplete * 60 * 60 * 1000);
  return estimatedDate.toISOString();
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
