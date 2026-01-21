// api/earnings/resolve-tournament.js
// Triggers resolution for earnings tournaments
// Called by Vercel cron daily at 6 PM ET, or manually for testing

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin (server-side)
function getFirebaseAdmin() {
  if (getApps().length === 0) {
    const serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    };

    initializeApp({
      credential: cert(serviceAccount),
    });
  }
  return getFirestore();
}

// Magnitude band classification (matches earningsReactionsService.js)
function classifyMagnitude(percentMove) {
  if (percentMove > 5) return 'upBig';
  if (percentMove >= 2) return 'up';
  if (percentMove > -2) return 'flat';
  if (percentMove >= -5) return 'down';
  return 'downBig';
}

/**
 * Safely parse a date from various formats (Firestore Timestamp, ISO string, Date object)
 * Returns null if parsing fails instead of throwing
 */
function safeParseDate(value) {
  if (!value) return null;

  try {
    // Firestore Timestamp object - has toDate() method
    if (typeof value?.toDate === 'function') {
      return value.toDate();
    }

    // Firestore Timestamp-like object with seconds/nanoseconds
    if (typeof value === 'object' && value.seconds !== undefined) {
      return new Date(value.seconds * 1000 + (value.nanoseconds || 0) / 1000000);
    }

    // Already a Date object
    if (value instanceof Date) {
      return isNaN(value.getTime()) ? null : value;
    }

    // String or number - try to parse
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed;
  } catch (error) {
    console.warn(`[resolve-tournament] Failed to parse date:`, value, error.message);
    return null;
  }
}

// Fetch earnings result for a single symbol using existing API
async function fetchEarningsResult(symbol, earningsDate) {
  // Determine base URL for internal API call
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXT_PUBLIC_VERCEL_URL
    ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
    : 'http://localhost:3000';

  // Build URL - date is optional, API returns most recent if not provided
  let url = `${baseUrl}/api/earnings/results?symbol=${encodeURIComponent(symbol)}`;
  if (earningsDate) {
    // Format date as YYYY-MM-DD - handle strings, Dates, and Firestore Timestamps
    let dateStr;
    if (typeof earningsDate === 'string') {
      dateStr = earningsDate.split('T')[0];
    } else {
      const parsed = safeParseDate(earningsDate);
      dateStr = parsed ? parsed.toISOString().split('T')[0] : null;
    }
    if (dateStr) {
      url += `&date=${dateStr}`;
    }
  }

  console.log(`Fetching result: ${url}`);

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok || !data.success) {
      console.warn(`No result for ${symbol}: ${data.error || response.status}`);
      return null;
    }

    return data;
  } catch (error) {
    console.error(`Error fetching ${symbol}:`, error.message);
    return null;
  }
}

// Score a single prediction against actual result
function scorePrediction(prediction, result) {
  if (!result || !result.outcome) {
    return {
      ...prediction,
      resolved: false,
      status: 'pending',
      pointsEarned: 0,
      resolutionNote: 'Result not available yet'
    };
  }

  // Check outcome (beat/miss)
  const outcomeCorrect = prediction.outcome === result.outcome;

  // Check magnitude band
  const magnitudeCorrect = prediction.magnitude === result.magnitude;

  // Base win condition: both outcome AND magnitude correct
  let isWinner = outcomeCorrect && magnitudeCorrect;
  let precisionCorrect = true;

  // For precision tier predictions, also check if within narrowed range
  if (isWinner && prediction.precisionTier && prediction.precisionTier !== 'standard') {
    const precisionRange = prediction.precisionRange;
    if (precisionRange && precisionRange.min !== undefined && precisionRange.max !== undefined) {
      const actualMove = result.priceMove;
      precisionCorrect = actualMove >= precisionRange.min && actualMove <= precisionRange.max;
      isWinner = precisionCorrect;
    }
  }

  // Calculate points earned
  const pointsEarned = isWinner ? (prediction.potentialPayout || prediction.potentialPoints || 0) : 0;

  return {
    ...prediction,
    resolved: true,
    status: 'complete',
    resolvedAt: new Date().toISOString(),
    // Actual results
    actualMove: result.priceMove,
    actualMagnitude: result.magnitude,
    actualOutcome: result.outcome,
    didBeat: result.didBeat,
    epsActual: result.epsActual,
    epsEstimate: result.epsEstimate,
    // Correctness flags
    outcomeCorrect,
    magnitudeCorrect,
    precisionCorrect,
    isCorrect: isWinner,
    // Points
    pointsEarned,
    // Debug info
    resolutionNote: isWinner
      ? `Correct! ${prediction.outcome} + ${prediction.magnitude}`
      : `Wrong: predicted ${prediction.outcome}/${prediction.magnitude}, actual ${result.outcome}/${result.magnitude}`
  };
}

// Calculate bracket based on rank
function calculateBracket(rank, totalEntries) {
  if (rank === 1) return 'diamond';
  if (rank <= 3) return 'gold';
  if (rank <= 10) return 'silver';
  if (rank <= 25) return 'bronze';
  return 'participant';
}

// Main handler
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Simple auth check for cron security
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;

  // If CRON_SECRET is configured, require it (but allow local testing without it)
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    // Also check for Vercel cron header or test mode
    const isVercelCron = req.headers['x-vercel-cron'] === '1';
    const isTestMode = req.query.testMode === 'true';
    if (!isVercelCron && !isTestMode) {
      console.warn('Unauthorized resolution attempt');
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (isTestMode) {
      console.log('⚠️ Test mode enabled - auth bypassed');
    }
  }

  console.log('');
  console.log('========================================');
  console.log('  TOURNAMENT RESOLUTION STARTED');
  console.log('  Time:', new Date().toISOString());
  console.log('========================================');

  try {
    const db = getFirebaseAdmin();
    const { tournamentId, dryRun, force } = req.query;
    const isDryRun = dryRun === 'true';
    const forceResolve = force === 'true';

    if (isDryRun) {
      console.log('*** DRY RUN MODE - No changes will be saved ***');
    }

    // Get tournaments to resolve
    let tournamentDocs = [];

    if (tournamentId) {
      // Specific tournament requested
      console.log(`Fetching specific tournament: ${tournamentId}`);
      const doc = await db.collection('earningsTournaments').doc(tournamentId).get();
      if (doc.exists) {
        tournamentDocs = [doc];
      } else {
        return res.status(404).json({ error: `Tournament ${tournamentId} not found` });
      }
    } else {
      // Get all tournaments that need resolution
      // Include 'open' because tournaments may not have been transitioned to 'locked' yet
      console.log('Fetching tournaments for resolution...');
      const snapshot = await db.collection('earningsTournaments')
        .where('status', 'in', ['open', 'locked', 'in_progress'])
        .get();

      // Filter and auto-transition 'open' tournaments that are past their lock deadline
      const now = new Date();
      tournamentDocs = [];

      for (const doc of snapshot.docs) {
        const data = doc.data();

        if (data.status === 'open') {
          // Check if lock deadline has passed
          // Handle both Firestore Timestamps and ISO strings
          const lockDeadline = safeParseDate(data.lockDeadline);
          if (lockDeadline && lockDeadline < now) {
            console.log(`  Auto-transitioning ${doc.id} from 'open' to 'locked' (deadline: ${lockDeadline.toISOString()})`);
            // Update status to 'locked'
            if (!isDryRun) {
              await db.collection('earningsTournaments').doc(doc.id).update({
                status: 'locked',
                lockedAt: new Date()
              });
            }
            tournamentDocs.push(doc);
          } else {
            const deadlineStr = lockDeadline ? lockDeadline.toISOString() : (data.lockDeadline || 'none');
            console.log(`  Skipping ${doc.id} - still open (deadline: ${deadlineStr})`);
          }
        } else {
          // Already locked or in_progress
          tournamentDocs.push(doc);
        }
      }
    }

    console.log(`Found ${tournamentDocs.length} tournament(s) to process`);

    if (tournamentDocs.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No active tournaments to resolve',
        tournamentsProcessed: 0
      });
    }

    // Track results
    const results = {
      tournamentsProcessed: 0,
      entriesProcessed: 0,
      predictionsResolved: 0,
      predictionsAlreadyResolved: 0,
      predictionsPending: 0,
      errors: []
    };

    // Process each tournament
    for (const tournamentDoc of tournamentDocs) {
      const tournament = tournamentDoc.data();
      const tId = tournamentDoc.id;

      console.log('');
      console.log(`--- Processing Tournament: ${tId} ---`);
      console.log(`    Name: ${tournament.name || 'Unnamed'}`);
      console.log(`    Status: ${tournament.status}`);

      // Get all entries for this tournament
      const entriesSnapshot = await db.collection('earningsEntries')
        .where('tournamentId', '==', tId)
        .get();

      console.log(`    Entries: ${entriesSnapshot.docs.length}`);

      if (entriesSnapshot.empty) {
        console.log('    No entries to process');
        continue;
      }

      // Collect all unique symbol/date pairs we need results for
      const symbolDatePairs = new Map();

      entriesSnapshot.docs.forEach(doc => {
        const entry = doc.data();
        (entry.predictions || []).forEach(pred => {
          // Skip already resolved unless forcing
          if (pred.resolved && !forceResolve) {
            results.predictionsAlreadyResolved++;
            return;
          }

          const symbol = pred.symbol;
          // Extract date - handle various field names and formats
          const rawDate = pred.reportDate || pred.earningsDate || pred.date;
          // Log the type and structure of the raw date for debugging
          const rawDateType = typeof rawDate;
          const rawDateKeys = rawDate && typeof rawDate === 'object' ? Object.keys(rawDate).slice(0, 5) : [];

          // Normalize date to YYYY-MM-DD string for consistent keying
          let date;
          if (typeof rawDate === 'string') {
            date = rawDate.split('T')[0]; // Handle ISO strings
          } else {
            const parsed = safeParseDate(rawDate);
            date = parsed ? parsed.toISOString().split('T')[0] : null;
          }

          if (!date) {
            console.warn(`    [WARN] ${symbol}: Could not parse date. rawDate=${JSON.stringify(rawDate)}, type=${rawDateType}, keys=${rawDateKeys.join(',')}`);
            return; // Skip this prediction
          }

          const key = `${symbol}_${date}`;

          if (!symbolDatePairs.has(key)) {
            symbolDatePairs.set(key, { symbol, date, rawDate });
            console.log(`    [DEBUG] Prediction: ${symbol} | type=${rawDateType} | rawDate=${JSON.stringify(rawDate).substring(0, 50)} | normalized=${date}`);
          }
        });
      });

      console.log(`    Unique earnings events to fetch: ${symbolDatePairs.size}`);

      // Fetch all results
      const resultsMap = new Map();
      let fetchCount = 0;

      for (const [key, { symbol, date, rawDate }] of symbolDatePairs) {
        console.log(`    [FETCH] ${symbol} | key=${key} | queryDate=${date}`);
        const result = await fetchEarningsResult(symbol, date);
        if (result && result.resolved) {
          resultsMap.set(key, result);
          console.log(`    ✓ ${symbol}: ${result.outcome} / ${result.magnitude} (${result.priceMove?.toFixed(2)}%) | resultDate=${result.reportDate}`);
        } else {
          console.log(`    ✗ ${symbol}: No result | response=${JSON.stringify(result || {}).substring(0, 200)}`);
        }

        fetchCount++;
        // Rate limiting: small delay every 5 requests
        if (fetchCount % 5 === 0) {
          await new Promise(r => setTimeout(r, 200));
        }
      }

      console.log(`    Results fetched: ${resultsMap.size} / ${symbolDatePairs.size}`);

      // Debug: Show all keys in resultsMap
      if (resultsMap.size > 0) {
        console.log(`    [DEBUG] resultsMap keys: ${Array.from(resultsMap.keys()).join(', ')}`);
      }

      // Score each entry
      const batch = db.batch();
      let tournamentPendingCount = 0;

      for (const entryDoc of entriesSnapshot.docs) {
        const entry = entryDoc.data();
        let totalPoints = 0;
        let correctCount = 0;
        let incorrectCount = 0;
        let pendingCount = 0;

        const scoredPredictions = (entry.predictions || []).map(pred => {
          // If already resolved and not forcing, keep existing
          if (pred.resolved && !forceResolve) {
            totalPoints += pred.pointsEarned || 0;
            if (pred.isCorrect) correctCount++;
            else incorrectCount++;
            return pred;
          }

          // Build lookup key - normalize date the same way as when fetching
          const rawDate = pred.reportDate || pred.earningsDate || pred.date;
          let date;
          if (typeof rawDate === 'string') {
            date = rawDate.split('T')[0];
          } else {
            const parsed = safeParseDate(rawDate);
            date = parsed ? parsed.toISOString().split('T')[0] : rawDate;
          }
          const key = `${pred.symbol}_${date}`;
          const result = resultsMap.get(key);

          if (!result) {
            // Result not available yet
            pendingCount++;
            tournamentPendingCount++;
            results.predictionsPending++;
            console.log(`    [PENDING] ${pred.symbol} | key=${key} | not in resultsMap`);
            return {
              ...pred,
              resolved: false,
              status: 'pending'
            };
          }

          // Score this prediction
          const scored = scorePrediction(pred, result);
          totalPoints += scored.pointsEarned;
          if (scored.isCorrect) correctCount++;
          else incorrectCount++;
          results.predictionsResolved++;

          return scored;
        });

        // Determine entry status
        const entryStatus = pendingCount === 0 ? 'complete' : 'in_progress';

        // Build update object
        const entryUpdate = {
          predictions: scoredPredictions,
          'results.totalPoints': totalPoints,
          'results.correctPredictions': correctCount,
          'results.incorrectPredictions': incorrectCount,
          'results.pendingPredictions': pendingCount,
          status: entryStatus,
          lastResolvedAt: new Date()
        };

        if (!isDryRun) {
          batch.update(entryDoc.ref, entryUpdate);
        }

        results.entriesProcessed++;
      }

      // Update tournament status
      const allResolved = tournamentPendingCount === 0;
      if (allResolved && !isDryRun) {
        batch.update(tournamentDoc.ref, {
          status: 'completed',
          completedAt: new Date()
        });
        console.log(`    Tournament marked as COMPLETED`);
      } else if (!allResolved) {
        console.log(`    Tournament still has ${tournamentPendingCount} pending predictions`);
        if (!isDryRun) {
          batch.update(tournamentDoc.ref, { status: 'in_progress' });
        }
      }

      // Commit batch
      if (!isDryRun) {
        await batch.commit();
        console.log(`    ✓ Batch committed`);
      } else {
        console.log(`    (Dry run - no changes saved)`);
      }

      results.tournamentsProcessed++;
    }

    // Calculate final rankings for completed tournaments
    if (!isDryRun) {
      console.log('');
      console.log('--- Calculating Final Rankings ---');

      for (const tournamentDoc of tournamentDocs) {
        const tId = tournamentDoc.id;

        // Get entries sorted by points
        const rankedEntries = await db.collection('earningsEntries')
          .where('tournamentId', '==', tId)
          .orderBy('results.totalPoints', 'desc')
          .get();

        if (rankedEntries.empty) continue;

        const rankBatch = db.batch();
        let rank = 1;
        const totalEntries = rankedEntries.docs.length;

        for (const doc of rankedEntries.docs) {
          const bracket = calculateBracket(rank, totalEntries);
          rankBatch.update(doc.ref, { rank, bracket });

          const entry = doc.data();
          console.log(`    #${rank} ${entry.username || entry.odUserId}: ${entry.results?.totalPoints || 0} pts (${bracket})`);

          rank++;
        }

        await rankBatch.commit();
        console.log(`    ✓ Rankings saved for ${tId}`);
      }
    }

    console.log('');
    console.log('========================================');
    console.log('  RESOLUTION COMPLETE');
    console.log('========================================');
    console.log('  Tournaments:', results.tournamentsProcessed);
    console.log('  Entries:', results.entriesProcessed);
    console.log('  Predictions resolved:', results.predictionsResolved);
    console.log('  Already resolved:', results.predictionsAlreadyResolved);
    console.log('  Still pending:', results.predictionsPending);
    console.log('========================================');
    console.log('');

    return res.status(200).json({
      success: true,
      dryRun: isDryRun,
      timestamp: new Date().toISOString(),
      ...results
    });

  } catch (error) {
    console.error('');
    console.error('!!! RESOLUTION ERROR !!!');
    console.error(error);

    return res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
