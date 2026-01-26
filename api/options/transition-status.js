// api/options/transition-status.js
// Transitions tournaments from 'open' to 'in_progress' when lock deadline passes
// Called by Vercel cron on Monday evenings and Tuesday mornings (backup)
//
// Transition is IDEMPOTENT - safe to run multiple times:
//   - Only 'open' tournaments are checked
//   - Already transitioned tournaments are skipped

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const LOG_PREFIX = '[OptionsTransition]';

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
const logError = (category, message, data) => log('error', category, message, data);

// Initialize Firebase Admin (server-side)
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

export default async function handler(req, res) {
  // Verify cron secret for automated calls
  if (req.method === 'GET') {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  // Allow POST for manual testing (with admin verification)
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { dryRun } = req.query;
  const isDryRun = dryRun === 'true';

  logInfo('START', `Tournament status transition check started`, { dryRun: isDryRun });

  const now = new Date();
  const results = {
    transitioned: [],
    skipped: [],
    errors: [],
    checked: 0
  };

  try {
    const db = getFirebaseAdmin();

    // Get all 'open' tournaments
    const tournamentsRef = db.collection('optionsTournaments');
    const openTournamentsSnap = await tournamentsRef
      .where('status', '==', 'open')
      .get();

    logInfo('QUERY', `Found ${openTournamentsSnap.size} open tournaments`);
    results.checked = openTournamentsSnap.size;

    if (openTournamentsSnap.empty) {
      logInfo('COMPLETE', 'No open tournaments to transition');
      return res.status(200).json({
        success: true,
        message: 'No open tournaments found',
        timestamp: now.toISOString(),
        ...results
      });
    }

    // Check each tournament's lock deadline
    for (const doc of openTournamentsSnap.docs) {
      const tournament = doc.data();
      const tournamentId = doc.id;

      // Parse lock deadline (handle both Firestore Timestamp and ISO string)
      let lockDeadline;
      if (tournament.lockDeadline?.toDate) {
        lockDeadline = tournament.lockDeadline.toDate();
      } else if (tournament.lockDeadline) {
        lockDeadline = new Date(tournament.lockDeadline);
      } else {
        logError('SKIP', `Tournament ${tournamentId} has no lockDeadline`);
        results.skipped.push({
          id: tournamentId,
          name: tournament.name,
          reason: 'No lockDeadline set'
        });
        continue;
      }

      logInfo('CHECK', `Tournament ${tournamentId}`, {
        name: tournament.name,
        lockDeadline: lockDeadline.toISOString(),
        now: now.toISOString(),
        shouldTransition: now >= lockDeadline
      });

      if (now >= lockDeadline) {
        if (isDryRun) {
          logInfo('DRY_RUN', `Would transition ${tournamentId} to in_progress`);
          results.transitioned.push({
            id: tournamentId,
            name: tournament.name,
            dryRun: true
          });
        } else {
          try {
            await tournamentsRef.doc(tournamentId).update({
              status: 'in_progress',
              statusTransitionedAt: now,
              statusTransitionedBy: 'cron'
            });

            logInfo('TRANSITION', `Transitioned ${tournamentId} to in_progress`, {
              name: tournament.name
            });
            results.transitioned.push({
              id: tournamentId,
              name: tournament.name
            });
          } catch (updateError) {
            logError('ERROR', `Failed to transition ${tournamentId}`, {
              error: updateError.message
            });
            results.errors.push({
              id: tournamentId,
              name: tournament.name,
              error: updateError.message
            });
          }
        }
      } else {
        const timeUntilLock = lockDeadline - now;
        const hoursUntilLock = Math.round(timeUntilLock / (1000 * 60 * 60) * 10) / 10;

        logInfo('SKIP', `Tournament ${tournamentId} not ready for transition`, {
          name: tournament.name,
          hoursUntilLock
        });
        results.skipped.push({
          id: tournamentId,
          name: tournament.name,
          reason: `Lock deadline in ${hoursUntilLock} hours`
        });
      }
    }

    const summary = {
      success: true,
      timestamp: now.toISOString(),
      dryRun: isDryRun,
      ...results
    };

    logInfo('COMPLETE', 'Status transition check completed', summary);
    return res.status(200).json(summary);

  } catch (error) {
    logError('FATAL', 'Fatal error during status transition', { error: error.message });
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: now.toISOString()
    });
  }
}
