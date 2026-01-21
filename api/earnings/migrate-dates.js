// api/earnings/migrate-dates.js
// One-time migration script to fix predictions with empty reportDate: {}
//
// Usage:
//   GET /api/earnings/migrate-dates?testMode=true&dryRun=true  - Preview changes
//   GET /api/earnings/migrate-dates?testMode=true              - Apply fixes
//
// The bug: removeUndefined() was stripping Date objects to {} because
// Date objects have no enumerable properties (Object.entries returns [])

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { isEmptyDate, toYYYYMMDD } from '../../src/utils/dateUtils.js';

// Initialize Firebase Admin
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

/**
 * Fetch earnings calendar from EODHD for a date range
 * Returns a map of symbol -> reportDate
 */
async function fetchEarningsCalendar(fromDate, toDate) {
  const apiKey = process.env.EODHD_API_KEY;
  if (!apiKey) {
    throw new Error('EODHD_API_KEY not configured');
  }

  const url = `https://eodhd.com/api/calendar/earnings?api_token=${apiKey}&from=${fromDate}&to=${toDate}&fmt=json`;
  console.log(`[migrate-dates] Fetching calendar: ${fromDate} to ${toDate}`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`EODHD calendar API error: ${response.status}`);
  }

  const data = await response.json();
  const earnings = data.earnings || [];

  // Build a map of symbol -> reportDate
  const calendarMap = new Map();
  for (const event of earnings) {
    const symbol = event.code?.split('.')[0]?.toUpperCase();
    if (symbol && event.report_date) {
      // Store as ISO string with time at midnight UTC
      const reportDate = `${event.report_date}T00:00:00.000Z`;
      calendarMap.set(symbol, {
        reportDate,
        reportTime: event.before_after_market || 'TBD',
        rawDate: event.report_date
      });
    }
  }

  console.log(`[migrate-dates] Found ${calendarMap.size} earnings events in calendar`);
  return calendarMap;
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Require testMode for safety
  if (req.query.testMode !== 'true') {
    return res.status(401).json({
      error: 'Safety check: Add ?testMode=true to run this migration',
      usage: {
        preview: '/api/earnings/migrate-dates?testMode=true&dryRun=true',
        apply: '/api/earnings/migrate-dates?testMode=true'
      }
    });
  }

  const isDryRun = req.query.dryRun === 'true';
  const tournamentId = req.query.tournamentId; // Optional: specific tournament

  console.log('');
  console.log('========================================');
  console.log('  MIGRATION: Fix Empty reportDate Fields');
  console.log(`  Mode: ${isDryRun ? 'DRY RUN (preview only)' : 'LIVE (will save changes)'}`);
  console.log('  Time:', new Date().toISOString());
  console.log('========================================');

  try {
    const db = getFirebaseAdmin();

    // Get tournaments to process
    let tournamentDocs = [];
    if (tournamentId) {
      const doc = await db.collection('earningsTournaments').doc(tournamentId).get();
      if (doc.exists) {
        tournamentDocs = [doc];
      } else {
        return res.status(404).json({ error: `Tournament ${tournamentId} not found` });
      }
    } else {
      // Get recent tournaments (W3 and W4 of 2026)
      const snapshot = await db.collection('earningsTournaments')
        .where('status', 'in', ['open', 'locked', 'in_progress', 'completed'])
        .get();
      tournamentDocs = snapshot.docs;
    }

    console.log(`[migrate-dates] Found ${tournamentDocs.length} tournament(s)`);

    // Track results
    const results = {
      tournamentsProcessed: 0,
      entriesProcessed: 0,
      predictionsChecked: 0,
      predictionsFixed: 0,
      predictionsAlreadyGood: 0,
      predictionsNoCalendarMatch: 0,
      fixes: []
    };

    // Process each tournament
    for (const tournamentDoc of tournamentDocs) {
      const tournament = tournamentDoc.data();
      const tId = tournamentDoc.id;

      console.log('');
      console.log(`--- Tournament: ${tId} ---`);
      console.log(`    Week: ${tournament.weekStart} to ${tournament.weekEnd}`);

      // Fetch calendar for this tournament's week (with buffer)
      const weekStart = tournament.weekStart || '2026-01-01';
      const weekEnd = tournament.weekEnd || '2026-12-31';

      // Add buffer days to catch edge cases
      const startDate = new Date(weekStart);
      startDate.setDate(startDate.getDate() - 3);
      const endDate = new Date(weekEnd);
      endDate.setDate(endDate.getDate() + 3);

      const calendarMap = await fetchEarningsCalendar(
        toYYYYMMDD(startDate),
        toYYYYMMDD(endDate)
      );

      // Get all entries for this tournament
      const entriesSnapshot = await db.collection('earningsEntries')
        .where('tournamentId', '==', tId)
        .get();

      console.log(`    Entries: ${entriesSnapshot.docs.length}`);

      if (entriesSnapshot.empty) {
        console.log('    No entries to process');
        results.tournamentsProcessed++;
        continue;
      }

      // Process each entry
      for (const entryDoc of entriesSnapshot.docs) {
        const entry = entryDoc.data();
        const predictions = entry.predictions || [];
        let entryModified = false;
        const updatedPredictions = [];

        for (const pred of predictions) {
          results.predictionsChecked++;
          const symbol = pred.symbol;

          // Check if reportDate is empty/broken
          if (isEmptyDate(pred.reportDate)) {
            // Look up correct date from calendar
            const calendarEntry = calendarMap.get(symbol);

            if (calendarEntry) {
              const fix = {
                entryId: entryDoc.id,
                symbol,
                oldValue: pred.reportDate,
                newValue: calendarEntry.reportDate
              };
              results.fixes.push(fix);
              results.predictionsFixed++;
              entryModified = true;

              console.log(`    ✓ Fixed ${symbol}: ${JSON.stringify(pred.reportDate)} → ${calendarEntry.reportDate}`);

              updatedPredictions.push({
                ...pred,
                reportDate: calendarEntry.reportDate
              });
            } else {
              // No calendar match - can't fix automatically
              results.predictionsNoCalendarMatch++;
              console.log(`    ✗ ${symbol}: No calendar match found (reportDate=${JSON.stringify(pred.reportDate)})`);
              updatedPredictions.push(pred);
            }
          } else {
            // Already has valid reportDate
            results.predictionsAlreadyGood++;
            updatedPredictions.push(pred);
          }
        }

        // Save updated predictions if modified
        if (entryModified && !isDryRun) {
          await db.collection('earningsEntries').doc(entryDoc.id).update({
            predictions: updatedPredictions,
            _migratedAt: new Date().toISOString(),
            _migrationNote: 'Fixed empty reportDate fields'
          });
          console.log(`    💾 Saved entry: ${entryDoc.id}`);
        }

        results.entriesProcessed++;
      }

      results.tournamentsProcessed++;
    }

    console.log('');
    console.log('========================================');
    console.log('  MIGRATION COMPLETE');
    console.log('========================================');
    console.log('  Tournaments processed:', results.tournamentsProcessed);
    console.log('  Entries processed:', results.entriesProcessed);
    console.log('  Predictions checked:', results.predictionsChecked);
    console.log('  Predictions fixed:', results.predictionsFixed);
    console.log('  Already good:', results.predictionsAlreadyGood);
    console.log('  No calendar match:', results.predictionsNoCalendarMatch);
    console.log('========================================');

    // Build response
    const response = {
      success: true,
      dryRun: isDryRun,
      timestamp: new Date().toISOString(),
      summary: {
        tournamentsProcessed: results.tournamentsProcessed,
        entriesProcessed: results.entriesProcessed,
        predictionsChecked: results.predictionsChecked,
        predictionsFixed: results.predictionsFixed,
        predictionsAlreadyGood: results.predictionsAlreadyGood,
        predictionsNoCalendarMatch: results.predictionsNoCalendarMatch
      },
      // Include first 20 fixes for verification
      sampleFixes: results.fixes.slice(0, 20).map(f => ({
        entryId: f.entryId,
        symbol: f.symbol,
        oldValue: JSON.stringify(f.oldValue),
        newValue: f.newValue
      }))
    };

    if (isDryRun) {
      response.message = 'DRY RUN: No changes were saved. Remove dryRun=true to apply fixes.';
    } else {
      response.message = `Applied ${results.predictionsFixed} fixes to predictions.`;
    }

    return res.status(200).json(response);

  } catch (error) {
    console.error('');
    console.error('!!! MIGRATION ERROR !!!');
    console.error(error);

    return res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
