// api/earnings/resolve-tournament.js
// Triggers resolution for earnings tournaments
// Called by Vercel cron at multiple times daily:
//   - 23:00 UTC (6 PM ET) - First attempt for pre-market earnings
//   - 03:00 UTC (10 PM ET) - Retry for after-market announcements
//   - 14:00 UTC (9 AM ET) - Morning cleanup for overnight data updates
//
// Resolution is IDEMPOTENT - safe to run multiple times:
//   - Already resolved predictions are skipped (unless force=true)
//   - Already completed tournaments are skipped
//   - Resolution attempts are tracked for debugging

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getEarningsResult } from './_helpers/getEarningsResult.js';
import { safeParseDate, toYYYYMMDD } from '../../src/utils/dateUtils.js';

// Structured logging helper with timestamps and consistent prefixes
const LOG_PREFIX = '[EarningsResolution]';

function log(level, category, message, data = null) {
  const timestamp = new Date().toISOString();
  const prefix = `${timestamp} ${LOG_PREFIX} [${category}]`;

  if (data) {
    console[level](`${prefix} ${message}`, JSON.stringify(data, null, 2));
  } else {
    console[level](`${prefix} ${message}`);
  }
}

const logInfo = (category, message, data) => log('log', category, message, data);
const logWarn = (category, message, data) => log('warn', category, message, data);
const logError = (category, message, data) => log('error', category, message, data);

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

// Fetch earnings result for a single symbol using direct function call
// (Avoids internal HTTP calls which can fail silently on Vercel)
async function fetchEarningsResult(symbol, earningsDate) {
  // Format date as YYYY-MM-DD using shared utility
  const dateStr = toYYYYMMDD(earningsDate);

  console.log(`[resolve] Fetching result: ${symbol} (date: ${dateStr || 'latest'})`);

  try {
    // Call the shared function directly instead of making HTTP request
    const result = await getEarningsResult(symbol, dateStr);

    if (!result.success || !result.resolved) {
      console.warn(`No result for ${symbol}: ${result.error || 'Not resolved'}`);
      return result; // Return full result for debug info
    }

    return result;
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
  const startTime = Date.now();
  const runId = `run_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

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
      logWarn('AUTH', 'Unauthorized resolution attempt');
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (isTestMode) {
      logInfo('AUTH', 'Test mode enabled - auth bypassed');
    }
  }

  logInfo('START', '========================================');
  logInfo('START', 'TOURNAMENT RESOLUTION STARTED');
  logInfo('START', `Run ID: ${runId}`);
  logInfo('START', `Trigger: ${req.headers['x-vercel-cron'] === '1' ? 'Vercel Cron' : 'Manual'}`);
  logInfo('START', '========================================');

  try {
    const db = getFirebaseAdmin();
    const { tournamentId, dryRun, force } = req.query;
    const isDryRun = dryRun === 'true';
    const forceResolve = force === 'true';

    if (isDryRun) {
      logInfo('CONFIG', '*** DRY RUN MODE - No changes will be saved ***');
    }
    if (forceResolve) {
      logInfo('CONFIG', '*** FORCE MODE - Re-resolving already resolved predictions ***');
    }

    // Get tournaments to resolve
    let tournamentDocs = [];

    if (tournamentId) {
      // Specific tournament requested
      logInfo('QUERY', `Fetching specific tournament: ${tournamentId}`);
      const doc = await db.collection('earningsTournaments').doc(tournamentId).get();
      if (doc.exists) {
        const data = doc.data();
        // Skip if already completed (unless forcing)
        if (data.status === 'completed' && !forceResolve) {
          logInfo('SKIP', `Tournament ${tournamentId} already completed - skipping`);
          return res.status(200).json({
            success: true,
            message: 'Tournament already resolved',
            tournamentId,
            status: 'completed',
            completedAt: data.completedAt
          });
        }
        tournamentDocs = [doc];
      } else {
        return res.status(404).json({ error: `Tournament ${tournamentId} not found` });
      }
    } else {
      // Get all tournaments that need resolution
      // Include 'open' because tournaments may not have been transitioned to 'locked' yet
      // Explicitly exclude 'completed' to ensure idempotency
      logInfo('QUERY', 'Fetching tournaments for resolution...');
      const snapshot = await db.collection('earningsTournaments')
        .where('status', 'in', ['open', 'locked', 'in_progress'])
        .get();

      logInfo('QUERY', `Found ${snapshot.docs.length} tournament(s) in open/locked/in_progress status`);

      // Filter and auto-transition 'open' tournaments that are past their lock deadline
      const now = new Date();
      tournamentDocs = [];

      for (const doc of snapshot.docs) {
        const data = doc.data();

        logInfo('TOURNAMENT', `Checking: ${doc.id}`, {
          status: data.status,
          entryCount: data.entryCount,
          lockDeadline: data.lockDeadline,
          resolutionAttempts: data.resolutionAttempts || 0
        });

        if (data.status === 'open') {
          // Check if lock deadline has passed
          // Handle both Firestore Timestamps and ISO strings
          const lockDeadline = safeParseDate(data.lockDeadline);
          if (lockDeadline && lockDeadline < now) {
            logInfo('TRANSITION', `Auto-transitioning ${doc.id} from 'open' to 'locked'`, {
              deadline: lockDeadline.toISOString(),
              now: now.toISOString()
            });
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
            logInfo('SKIP', `Skipping ${doc.id} - still open (deadline: ${deadlineStr})`);
          }
        } else {
          // Already locked or in_progress
          tournamentDocs.push(doc);
        }
      }
    }

    logInfo('QUERY', `Processing ${tournamentDocs.length} tournament(s)`);

    if (tournamentDocs.length === 0) {
      logInfo('COMPLETE', 'No active tournaments to resolve');
      return res.status(200).json({
        success: true,
        message: 'No active tournaments to resolve',
        tournamentsProcessed: 0,
        runId
      });
    }

    // Track results with detailed statistics
    const results = {
      runId,
      tournamentsProcessed: 0,
      tournamentsCompleted: 0,
      tournamentsStillPending: 0,
      entriesProcessed: 0,
      predictionsResolved: 0,
      predictionsAlreadyResolved: 0,
      predictionsPending: 0,
      predictionsByReason: {
        success: 0,
        no_eps_data: 0,
        date_mismatch: 0,
        no_price_data: 0,
        api_error: 0
      },
      errors: []
    };

    // Debug samples for dry run (collect first 10 for diagnosis)
    const debugSamples = [];

    // Process each tournament
    for (const tournamentDoc of tournamentDocs) {
      const tournament = tournamentDoc.data();
      const tId = tournamentDoc.id;
      const tournamentStartTime = Date.now();

      logInfo('TOURNAMENT', '========================================');
      logInfo('TOURNAMENT', `Processing: ${tId}`);
      logInfo('TOURNAMENT', `Name: ${tournament.name || 'Unnamed'}`);
      logInfo('TOURNAMENT', `Status: ${tournament.status}`);
      logInfo('TOURNAMENT', `Previous resolution attempts: ${tournament.resolutionAttempts || 0}`);
      if (tournament.lastResolutionAttempt) {
        logInfo('TOURNAMENT', `Last attempt: ${tournament.lastResolutionAttempt}`);
      }

      // Track this resolution attempt (update at start)
      if (!isDryRun) {
        await db.collection('earningsTournaments').doc(tId).update({
          resolutionAttempts: FieldValue.increment(1),
          lastResolutionAttempt: new Date().toISOString(),
          lastResolutionRunId: runId
        });
      }

      // Get all entries for this tournament
      const entriesSnapshot = await db.collection('earningsEntries')
        .where('tournamentId', '==', tId)
        .get();

      logInfo('TOURNAMENT', `Entries: ${entriesSnapshot.docs.length}`);

      if (entriesSnapshot.empty) {
        logInfo('TOURNAMENT', 'No entries to process');
        continue;
      }

      // Collect all unique symbol/date pairs we need results for
      const symbolDatePairs = new Map();
      let skippedAlreadyResolved = 0;
      let skippedBadDate = 0;

      entriesSnapshot.docs.forEach(doc => {
        const entry = doc.data();
        (entry.predictions || []).forEach(pred => {
          // Skip already resolved unless forcing
          if (pred.resolved && !forceResolve) {
            results.predictionsAlreadyResolved++;
            skippedAlreadyResolved++;
            return;
          }

          const symbol = pred.symbol;
          // Extract date - handle various field names and formats
          const rawDate = pred.reportDate || pred.earningsDate || pred.date;
          // Log the type and structure of the raw date for debugging
          const rawDateType = typeof rawDate;
          const rawDateKeys = rawDate && typeof rawDate === 'object' ? Object.keys(rawDate).slice(0, 5) : [];

          // Normalize date to YYYY-MM-DD string using shared utility
          const date = toYYYYMMDD(rawDate);

          if (!date) {
            logWarn('PREDICTION', `${symbol}: Could not parse date`, {
              rawDate: JSON.stringify(rawDate),
              type: rawDateType,
              keys: rawDateKeys
            });
            skippedBadDate++;
            return; // Skip this prediction
          }

          const key = `${symbol}_${date}`;

          if (!symbolDatePairs.has(key)) {
            symbolDatePairs.set(key, { symbol, date, rawDate });
          }
        });
      });

      logInfo('PREDICTIONS', `Unique earnings events to fetch: ${symbolDatePairs.size}`);
      logInfo('PREDICTIONS', `Already resolved (skipped): ${skippedAlreadyResolved}`);
      if (skippedBadDate > 0) {
        logWarn('PREDICTIONS', `Bad dates (skipped): ${skippedBadDate}`);
      }

      // Fetch all results
      const resultsMap = new Map();
      let fetchCount = 0;
      const fetchStats = { success: 0, date_mismatch: 0, no_eps_data: 0, no_price_data: 0, api_error: 0 };

      logInfo('FETCH', `Starting to fetch ${symbolDatePairs.size} earnings results from EODHD...`);

      for (const [key, { symbol, date, rawDate }] of symbolDatePairs) {
        logInfo('FETCH', `${symbol} | key=${key} | queryDate=${date}`);
        const result = await fetchEarningsResult(symbol, date);

        // Determine match status for debug
        let matchStatus = 'unknown';
        let pendingReason = null;

        if (result && result.resolved) {
          resultsMap.set(key, result);
          matchStatus = 'success';
          fetchStats.success++;
          logInfo('FETCH', `✓ ${symbol}: ${result.outcome} / ${result.magnitude} (${result.priceMove?.toFixed(2)}%)`, {
            resultDate: result.reportDate,
            epsActual: result.epsActual,
            epsEstimate: result.epsEstimate
          });
        } else if (result && result.availableDates) {
          matchStatus = 'date_mismatch';
          pendingReason = 'date_mismatch';
          fetchStats.date_mismatch++;
          logWarn('FETCH', `✗ ${symbol}: Date mismatch`, {
            queriedDate: date,
            availableDates: result.availableDates.map(d => d.reportDate)
          });
        } else if (result && result.debug?.entriesWithEpsActual === 0) {
          matchStatus = 'no_eps_data';
          pendingReason = 'awaiting_eodhd_eps_data';
          fetchStats.no_eps_data++;
          logWarn('FETCH', `✗ ${symbol}: No EPS data yet - EODHD hasn't updated`, {
            totalHistoryEntries: result.debug?.totalHistoryEntries,
            pendingEntries: result.debug?.pendingEntries
          });
        } else if (result && result.error?.includes('price')) {
          matchStatus = 'no_price_data';
          pendingReason = 'awaiting_price_data';
          fetchStats.no_price_data++;
          logWarn('FETCH', `✗ ${symbol}: No price data yet`, { error: result.error });
        } else {
          matchStatus = 'api_error';
          pendingReason = 'api_error';
          fetchStats.api_error++;
          logWarn('FETCH', `✗ ${symbol}: No result`, {
            error: result?.error,
            success: result?.success,
            resolved: result?.resolved
          });
        }

        // Collect debug sample (first 10 only)
        if (debugSamples.length < 10) {
          const rawDateType = typeof rawDate;
          debugSamples.push({
            symbol,
            predictionRawDate: rawDate,
            predictionRawDateType: rawDateType,
            predictionNormalizedDate: date,
            resultLookupKey: key,
            resultResponse: result ? {
              success: result.success,
              resolved: result.resolved,
              error: result.error,
              reportDate: result.reportDate,
              availableDates: result.availableDates?.slice(0, 3),
              debug: result.debug
            } : null,
            matchStatus,
            pendingReason
          });
        }

        fetchCount++;
        // Rate limiting: small delay every 5 requests
        if (fetchCount % 5 === 0) {
          await new Promise(r => setTimeout(r, 200));
        }
      }

      logInfo('FETCH', `Results fetched: ${resultsMap.size} / ${symbolDatePairs.size}`, fetchStats);

      // Debug: Show all keys in resultsMap
      if (resultsMap.size > 0) {
        logInfo('FETCH', `resultsMap keys: ${Array.from(resultsMap.keys()).join(', ')}`);
      }

      // Score each entry
      const batch = db.batch();
      let tournamentPendingCount = 0;
      let botEntriesProcessed = 0;
      let botPredictionsResolved = 0;
      let botPredictionsPending = 0;
      let botTotalPoints = 0;

      for (const entryDoc of entriesSnapshot.docs) {
        const entry = entryDoc.data();
        const isBot = entry.isBot === true;
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

          // Build lookup key - normalize date using shared utility
          const rawDate = pred.reportDate || pred.earningsDate || pred.date;
          const date = toYYYYMMDD(rawDate) || rawDate;
          const key = `${pred.symbol}_${date}`;
          const result = resultsMap.get(key);

          // Enhanced logging for bot predictions to diagnose 0 pts issue
          if (isBot) {
            const rawDateType = typeof rawDate;
            const rawDateStr = rawDate && typeof rawDate === 'object'
              ? (rawDate.toDate ? 'FirestoreTimestamp' : (rawDate.seconds ? 'TimestampLike' : JSON.stringify(rawDate)))
              : String(rawDate);
            logInfo('BOT_PREDICTION', `${entry.username} | ${pred.symbol}`, {
              rawDate: rawDateStr,
              rawDateType,
              normalizedDate: date,
              lookupKey: key,
              resultFound: !!result,
              predicted: `${pred.outcome}/${pred.magnitude}`,
              actual: result ? `${result.outcome}/${result.magnitude}` : 'N/A',
              potentialPayout: pred.potentialPayout || pred.potentialPoints || 0
            });
          }

          if (!result) {
            // Result not available yet
            pendingCount++;
            tournamentPendingCount++;
            results.predictionsPending++;
            logInfo('SCORE', `[PENDING] ${pred.symbol} | key=${key} | not in resultsMap - will retry next run`);
            return {
              ...pred,
              resolved: false,
              status: 'pending',
              lastCheckedAt: new Date().toISOString()
            };
          }

          // Score this prediction
          const scored = scorePrediction(pred, result);
          totalPoints += scored.pointsEarned;
          if (scored.isCorrect) correctCount++;
          else incorrectCount++;
          results.predictionsResolved++;

          // Log bot prediction scoring details
          if (isBot) {
            logInfo('BOT_SCORE', `${entry.username} | ${pred.symbol} | ${scored.isCorrect ? 'CORRECT' : 'WRONG'} | earned=${scored.pointsEarned}`, {
              predicted: `${pred.outcome}/${pred.magnitude}`,
              actual: `${scored.actualOutcome}/${scored.actualMagnitude}`,
              outcomeCorrect: scored.outcomeCorrect,
              magnitudeCorrect: scored.magnitudeCorrect
            });
          }

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

        // Track bot-specific stats for debugging
        if (isBot) {
          botEntriesProcessed++;
          botPredictionsResolved += scoredPredictions.filter(p => p.resolved).length;
          botPredictionsPending += pendingCount;
          botTotalPoints += totalPoints;

          // Log each bot entry's resolution status
          logInfo('BOT_ENTRY', `${entry.username} | resolved=${scoredPredictions.filter(p => p.resolved).length}/${scoredPredictions.length} | points=${totalPoints} | correct=${correctCount}/${scoredPredictions.length}`);
        }
      }

      // Log bot summary for this tournament
      if (botEntriesProcessed > 0) {
        logInfo('BOT_SUMMARY', `Tournament ${tId} bot stats`, {
          botEntries: botEntriesProcessed,
          botPredictionsResolved,
          botPredictionsPending,
          botTotalPoints,
          avgPointsPerBot: Math.round(botTotalPoints / botEntriesProcessed)
        });
      }

      // Update tournament status and resolution tracking
      const allResolved = tournamentPendingCount === 0;
      const tournamentUpdate = {
        lastResolutionSuccess: new Date().toISOString(),
        lastResolutionStats: {
          resolved: results.predictionsResolved,
          pending: tournamentPendingCount,
          runId
        }
      };

      if (allResolved && !isDryRun) {
        tournamentUpdate.status = 'completed';
        tournamentUpdate.completedAt = new Date();
        batch.update(tournamentDoc.ref, tournamentUpdate);
        results.tournamentsCompleted++;
        logInfo('TOURNAMENT', `✓ Tournament marked as COMPLETED`);
      } else if (!allResolved) {
        tournamentUpdate.status = 'in_progress';
        tournamentUpdate.pendingReason = `${tournamentPendingCount} predictions awaiting EODHD data`;
        if (!isDryRun) {
          batch.update(tournamentDoc.ref, tournamentUpdate);
        }
        results.tournamentsStillPending++;
        logInfo('TOURNAMENT', `Tournament still has ${tournamentPendingCount} pending predictions - will retry next cron run`);
      }

      // Commit batch
      if (!isDryRun) {
        await batch.commit();
        const tournamentDuration = Date.now() - tournamentStartTime;
        logInfo('TOURNAMENT', `✓ Batch committed (${tournamentDuration}ms)`);
      } else {
        logInfo('TOURNAMENT', `(Dry run - no changes saved)`);
      }

      results.tournamentsProcessed++;
    }

    // Calculate final rankings for completed tournaments
    if (!isDryRun) {
      logInfo('RANKINGS', '========================================');
      logInfo('RANKINGS', 'Calculating Final Rankings');

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
          if (rank <= 10) {
            logInfo('RANKINGS', `#${rank} ${entry.username || entry.odUserId}: ${entry.results?.totalPoints || 0} pts (${bracket})`);
          }

          rank++;
        }

        await rankBatch.commit();
        logInfo('RANKINGS', `✓ Rankings saved for ${tId} (${totalEntries} entries)`);
      }
    }

    const totalDuration = Date.now() - startTime;

    logInfo('COMPLETE', '========================================');
    logInfo('COMPLETE', 'RESOLUTION COMPLETE');
    logInfo('COMPLETE', '========================================');
    logInfo('COMPLETE', `Run ID: ${runId}`);
    logInfo('COMPLETE', `Duration: ${totalDuration}ms`);
    logInfo('COMPLETE', `Tournaments processed: ${results.tournamentsProcessed}`);
    logInfo('COMPLETE', `Tournaments completed: ${results.tournamentsCompleted}`);
    logInfo('COMPLETE', `Tournaments still pending: ${results.tournamentsStillPending}`);
    logInfo('COMPLETE', `Entries processed: ${results.entriesProcessed}`);
    logInfo('COMPLETE', `Predictions resolved: ${results.predictionsResolved}`);
    logInfo('COMPLETE', `Already resolved (skipped): ${results.predictionsAlreadyResolved}`);
    logInfo('COMPLETE', `Still pending: ${results.predictionsPending}`);
    logInfo('COMPLETE', '========================================');

    // Build response
    const response = {
      success: true,
      dryRun: isDryRun,
      timestamp: new Date().toISOString(),
      durationMs: totalDuration,
      ...results
    };

    // Include debug samples for dry runs to help diagnose issues
    if (isDryRun && debugSamples.length > 0) {
      response.debugSamples = debugSamples;
      response.debugSummary = {
        totalSamples: debugSamples.length,
        byStatus: {
          success: debugSamples.filter(s => s.matchStatus === 'success').length,
          date_mismatch: debugSamples.filter(s => s.matchStatus === 'date_mismatch').length,
          no_eps_data: debugSamples.filter(s => s.matchStatus === 'no_eps_data').length,
          no_price_data: debugSamples.filter(s => s.matchStatus === 'no_price_data').length,
          api_error: debugSamples.filter(s => s.matchStatus === 'api_error').length,
          unknown: debugSamples.filter(s => s.matchStatus === 'unknown').length
        }
      };
    }

    return res.status(200).json(response);

  } catch (error) {
    const totalDuration = Date.now() - startTime;
    logError('ERROR', '!!! RESOLUTION ERROR !!!', {
      error: error.message,
      stack: error.stack,
      runId,
      durationMs: totalDuration
    });

    return res.status(500).json({
      success: false,
      error: error.message,
      runId,
      durationMs: totalDuration,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
