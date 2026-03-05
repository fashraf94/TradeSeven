// api/earnings/manual-resolve.js
// Manual resolution trigger for testing and debugging
//
// POST /api/earnings/manual-resolve
// Body: { tournamentId: "xxx" } for specific tournament
//       { all: true } for all active tournaments
//
// Requires admin secret for authentication
//
// Created: Jan 2026 for EarningsGame resolution debugging

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getEarningsResult } from './_helpers/getEarningsResult.js';
import { safeParseDate, toYYYYMMDD } from '../../src/utils/dateUtils.js';
import { sanitizeDocumentId } from '../_utils/sanitizeInput.js';

const LOG_PREFIX = '[ManualResolve]';

function log(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const prefix = `${timestamp} ${LOG_PREFIX}`;
  if (data) {
    console[level](`${prefix} ${message}`, JSON.stringify(data));
  } else {
    console[level](`${prefix} ${message}`);
  }
}

const logInfo = (message, data) => log('log', message, data);
const logWarn = (message, data) => log('warn', message, data);
const logError = (message, data) => log('error', message, data);

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

// Score a single prediction against actual result (same logic as resolve-tournament.js)
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

  const outcomeCorrect = prediction.outcome === result.outcome;
  const magnitudeCorrect = prediction.magnitude === result.magnitude;
  let isWinner = outcomeCorrect && magnitudeCorrect;
  let precisionCorrect = true;

  if (isWinner && prediction.precisionTier && prediction.precisionTier !== 'standard') {
    const precisionRange = prediction.precisionRange;
    if (precisionRange && precisionRange.min !== undefined && precisionRange.max !== undefined) {
      const actualMove = result.priceMove;
      precisionCorrect = actualMove >= precisionRange.min && actualMove <= precisionRange.max;
      isWinner = precisionCorrect;
    }
  }

  const pointsEarned = isWinner ? (prediction.potentialPayout || prediction.potentialPoints || 0) : 0;

  return {
    ...prediction,
    resolved: true,
    status: 'complete',
    resolvedAt: new Date().toISOString(),
    actualMove: result.priceMove,
    actualMagnitude: result.magnitude,
    actualOutcome: result.outcome,
    didBeat: result.didBeat,
    epsActual: result.epsActual,
    epsEstimate: result.epsEstimate,
    outcomeCorrect,
    magnitudeCorrect,
    precisionCorrect,
    isCorrect: isWinner,
    pointsEarned,
    resolutionNote: isWinner
      ? `Correct! ${prediction.outcome} + ${prediction.magnitude}`
      : `Wrong: predicted ${prediction.outcome}/${prediction.magnitude}, actual ${result.outcome}/${result.magnitude}`
  };
}

function calculateBracket(rank, totalEntries) {
  if (rank === 1) return 'diamond';
  if (rank <= 3) return 'gold';
  if (rank <= 10) return 'silver';
  if (rank <= 25) return 'bronze';
  return 'participant';
}

export default async function handler(req, res) {
  const startTime = Date.now();

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Secret');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  // Authentication - require admin secret
  const adminSecret = process.env.ADMIN_SECRET || process.env.CRON_SECRET;
  const providedSecret = req.headers['x-admin-secret'] || req.query.secret;

  if (!adminSecret) {
    logError('No ADMIN_SECRET or CRON_SECRET configured');
    return res.status(500).json({ error: 'Server not configured for manual resolution' });
  }

  if (providedSecret !== adminSecret) {
    logWarn('Unauthorized manual resolution attempt');
    return res.status(401).json({
      error: 'Unauthorized',
      hint: 'Provide X-Admin-Secret header or ?secret= query parameter'
    });
  }

  logInfo('Manual resolution triggered', { method: req.method });

  try {
    const db = getFirebaseAdmin();
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { tournamentId: rawTournamentId, all, dryRun, force } = body;
    const tournamentId = rawTournamentId ? sanitizeDocumentId(rawTournamentId) : null;
    if (rawTournamentId && !tournamentId) {
      return res.status(400).json({ error: 'Invalid tournament ID format' });
    }

    const isDryRun = dryRun === true;
    const forceResolve = force === true;

    if (!tournamentId && !all) {
      return res.status(400).json({
        error: 'Missing required parameter',
        usage: {
          specific: 'POST with body { tournamentId: "tournament_2026_W4" }',
          all: 'POST with body { all: true }',
          options: {
            dryRun: 'boolean - if true, show what would happen without saving',
            force: 'boolean - if true, re-resolve already resolved predictions'
          }
        }
      });
    }

    logInfo('Starting manual resolution', { tournamentId, all, isDryRun, forceResolve });

    // Get tournaments to resolve
    let tournamentDocs = [];

    if (tournamentId) {
      const doc = await db.collection('earningsTournaments').doc(tournamentId).get();
      if (!doc.exists) {
        return res.status(404).json({ error: `Tournament ${tournamentId} not found` });
      }
      tournamentDocs = [doc];
    } else if (all) {
      const snapshot = await db.collection('earningsTournaments')
        .where('status', 'in', ['open', 'locked', 'in_progress'])
        .get();
      tournamentDocs = snapshot.docs;
    }

    logInfo(`Found ${tournamentDocs.length} tournament(s) to process`);

    const results = {
      tournamentsProcessed: 0,
      entriesProcessed: 0,
      predictionsResolved: 0,
      predictionsAlreadyResolved: 0,
      predictionsPending: 0,
      tournaments: []
    };

    for (const tournamentDoc of tournamentDocs) {
      const tournament = tournamentDoc.data();
      const tId = tournamentDoc.id;

      logInfo(`Processing tournament: ${tId}`, { name: tournament.name, status: tournament.status });

      const tournamentResult = {
        id: tId,
        name: tournament.name,
        status: tournament.status,
        entries: []
      };

      const entriesSnapshot = await db.collection('earningsEntries')
        .where('tournamentId', '==', tId)
        .get();

      if (entriesSnapshot.empty) {
        logInfo(`No entries for tournament ${tId}`);
        tournamentResult.entriesCount = 0;
        results.tournaments.push(tournamentResult);
        continue;
      }

      tournamentResult.entriesCount = entriesSnapshot.docs.length;

      // Collect unique symbol/date pairs
      const symbolDatePairs = new Map();
      entriesSnapshot.docs.forEach(doc => {
        const entry = doc.data();
        (entry.predictions || []).forEach(pred => {
          if (pred.resolved && !forceResolve) {
            results.predictionsAlreadyResolved++;
            return;
          }
          const rawDate = pred.reportDate || pred.earningsDate || pred.date;
          const date = toYYYYMMDD(rawDate);
          if (date) {
            const key = `${pred.symbol}_${date}`;
            if (!symbolDatePairs.has(key)) {
              symbolDatePairs.set(key, { symbol: pred.symbol, date });
            }
          }
        });
      });

      logInfo(`Fetching ${symbolDatePairs.size} earnings results`);

      // Fetch results
      const resultsMap = new Map();
      const fetchDetails = [];

      for (const [key, { symbol, date }] of symbolDatePairs) {
        const result = await getEarningsResult(symbol, date);
        const detail = {
          key,
          symbol,
          date,
          success: result?.resolved || false,
          outcome: result?.outcome || null,
          magnitude: result?.magnitude || null,
          error: result?.error || null
        };

        if (result && result.resolved) {
          resultsMap.set(key, result);
        }

        fetchDetails.push(detail);

        // Rate limiting
        await new Promise(r => setTimeout(r, 100));
      }

      tournamentResult.fetchDetails = fetchDetails;
      tournamentResult.resultsFound = resultsMap.size;
      tournamentResult.resultsMissing = symbolDatePairs.size - resultsMap.size;

      // Score entries
      const batch = db.batch();
      let tournamentPendingCount = 0;

      for (const entryDoc of entriesSnapshot.docs) {
        const entry = entryDoc.data();
        let totalPoints = 0;
        let correctCount = 0;
        let incorrectCount = 0;
        let pendingCount = 0;

        const entryResult = {
          id: entryDoc.id,
          username: entry.username || entry.odUserId,
          predictionsCount: (entry.predictions || []).length,
          predictions: []
        };

        const scoredPredictions = (entry.predictions || []).map(pred => {
          if (pred.resolved && !forceResolve) {
            totalPoints += pred.pointsEarned || 0;
            if (pred.isCorrect) correctCount++;
            else incorrectCount++;
            return pred;
          }

          const rawDate = pred.reportDate || pred.earningsDate || pred.date;
          const date = toYYYYMMDD(rawDate) || rawDate;
          const key = `${pred.symbol}_${date}`;
          const result = resultsMap.get(key);

          if (!result) {
            pendingCount++;
            tournamentPendingCount++;
            results.predictionsPending++;

            entryResult.predictions.push({
              symbol: pred.symbol,
              date,
              status: 'pending',
              reason: 'No result available'
            });

            return { ...pred, resolved: false, status: 'pending' };
          }

          const scored = scorePrediction(pred, result);
          totalPoints += scored.pointsEarned;
          if (scored.isCorrect) correctCount++;
          else incorrectCount++;
          results.predictionsResolved++;

          entryResult.predictions.push({
            symbol: pred.symbol,
            date,
            status: 'resolved',
            predicted: `${pred.outcome}/${pred.magnitude}`,
            actual: `${result.outcome}/${result.magnitude}`,
            isCorrect: scored.isCorrect,
            pointsEarned: scored.pointsEarned
          });

          return scored;
        });

        entryResult.totalPoints = totalPoints;
        entryResult.correct = correctCount;
        entryResult.incorrect = incorrectCount;
        entryResult.pending = pendingCount;

        tournamentResult.entries.push(entryResult);

        if (!isDryRun) {
          const entryStatus = pendingCount === 0 ? 'complete' : 'in_progress';
          batch.update(entryDoc.ref, {
            predictions: scoredPredictions,
            'results.totalPoints': totalPoints,
            'results.correctPredictions': correctCount,
            'results.incorrectPredictions': incorrectCount,
            'results.pendingPredictions': pendingCount,
            status: entryStatus,
            lastResolvedAt: new Date(),
            manuallyResolvedAt: new Date()
          });
        }

        results.entriesProcessed++;
      }

      // Update tournament status
      const allResolved = tournamentPendingCount === 0;
      tournamentResult.allResolved = allResolved;
      tournamentResult.pendingCount = tournamentPendingCount;

      if (!isDryRun) {
        if (allResolved) {
          batch.update(tournamentDoc.ref, {
            status: 'completed',
            completedAt: new Date(),
            manuallyCompletedAt: new Date()
          });
        } else {
          batch.update(tournamentDoc.ref, {
            status: 'in_progress',
            lastManualResolution: new Date()
          });
        }

        await batch.commit();
        logInfo(`Batch committed for ${tId}`);
      }

      results.tournaments.push(tournamentResult);
      results.tournamentsProcessed++;
    }

    // Calculate rankings if not dry run
    if (!isDryRun) {
      for (const tournamentDoc of tournamentDocs) {
        const rankedEntries = await db.collection('earningsEntries')
          .where('tournamentId', '==', tournamentDoc.id)
          .orderBy('results.totalPoints', 'desc')
          .get();

        if (!rankedEntries.empty) {
          const rankBatch = db.batch();
          let rank = 1;
          const totalEntries = rankedEntries.docs.length;

          for (const doc of rankedEntries.docs) {
            const bracket = calculateBracket(rank, totalEntries);
            rankBatch.update(doc.ref, { rank, bracket });
            rank++;
          }

          await rankBatch.commit();
        }
      }
    }

    const duration = Date.now() - startTime;

    logInfo('Manual resolution complete', {
      duration: `${duration}ms`,
      tournamentsProcessed: results.tournamentsProcessed,
      predictionsResolved: results.predictionsResolved,
      predictionsPending: results.predictionsPending
    });

    return res.status(200).json({
      success: true,
      dryRun: isDryRun,
      force: forceResolve,
      durationMs: duration,
      summary: {
        tournamentsProcessed: results.tournamentsProcessed,
        entriesProcessed: results.entriesProcessed,
        predictionsResolved: results.predictionsResolved,
        predictionsAlreadyResolved: results.predictionsAlreadyResolved,
        predictionsPending: results.predictionsPending
      },
      tournaments: results.tournaments
    });

  } catch (error) {
    logError('Manual resolution failed', { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
