// api/lobbies/cleanup-expired.js
// Cron job to disband expired lobbies and delete old disbanded lobbies
//
// Actions:
//   1. Find waiting lobbies past expiration (scheduledStart + 5 min grace)
//   2. Mark them as 'disbanded' with disbandedAt timestamp
//   3. Delete lobbies with 'disbanded' status older than 7 days
//
// Expiration Rules:
//   - Snake Draft: 4 players minimum, scheduledStart + 5 min
//   - BaggerBomb: 2 players minimum (creator + opponent), scheduledStart + 5 min (or createdAt + 24h fallback)
//   - Full lobbies are NEVER disbanded - they wait for host to start
//
// This is IDEMPOTENT - safe to run multiple times

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const LOG_PREFIX = '[LobbyCleanup]';

// Configuration constants (mirrored from client-side lobbyUtils.js)
const LOBBY_CONFIG = {
  EXPIRATION_GRACE_PERIOD_MS: 5 * 60 * 1000,          // 5 minutes
  SNAKE_DRAFT_MIN_PLAYERS: 4,
  BAGGER_BOMB_MIN_PLAYERS: 2,
  DISBANDED_RETENTION_MS: 7 * 24 * 60 * 60 * 1000,    // 7 days
  BAGGER_BOMB_FALLBACK_EXPIRY_MS: 24 * 60 * 60 * 1000, // 24 hours
  BATCH_SIZE: 100,                                     // Max documents per batch
};

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

/**
 * Check if a Snake Draft lobby is expired
 */
function isSnakeDraftExpired(draft, now) {
  // Only check waiting lobbies
  if (draft.status !== 'waiting') return false;

  // Full lobbies never expire
  const playerCount = draft.players?.length || 0;
  if (playerCount >= LOBBY_CONFIG.SNAKE_DRAFT_MIN_PLAYERS) return false;

  // Must have scheduledStart
  if (!draft.scheduledStart) return false;

  const scheduledStart = new Date(draft.scheduledStart);
  const expirationTime = new Date(scheduledStart.getTime() + LOBBY_CONFIG.EXPIRATION_GRACE_PERIOD_MS);

  return now >= expirationTime;
}

/**
 * Check if a BaggerBomb V3 lobby is expired
 */
function isBaggerBombExpired(battle, now) {
  // Only check waiting V3 lobbies
  if (battle._v !== 3 || battle.state?.status !== 'waiting') return false;

  // Count players
  let playerCount = 0;
  if (battle.creator?.uid || battle.creator?.odUserId) playerCount++;
  if (battle.opponent?.uid || battle.opponent?.odUserId) playerCount++;

  // Full lobbies never expire
  if (playerCount >= LOBBY_CONFIG.BAGGER_BOMB_MIN_PLAYERS) return false;

  // Calculate expiration time
  let expirationTime;
  if (battle.timing?.scheduledStart) {
    const scheduledStart = new Date(battle.timing.scheduledStart);
    expirationTime = new Date(scheduledStart.getTime() + LOBBY_CONFIG.EXPIRATION_GRACE_PERIOD_MS);
  } else if (battle.timing?.createdAt) {
    // Fallback: createdAt + 24 hours
    const createdAt = new Date(battle.timing.createdAt);
    expirationTime = new Date(createdAt.getTime() + LOBBY_CONFIG.BAGGER_BOMB_FALLBACK_EXPIRY_MS);
  } else {
    return false; // Can't determine expiration
  }

  return now >= expirationTime;
}

/**
 * Check if a disbanded lobby should be deleted
 */
function shouldDeleteDisbanded(lobby, now) {
  if (!lobby.disbandedAt) return false;

  const disbandedAt = new Date(lobby.disbandedAt);
  const retentionExpired = now.getTime() - disbandedAt.getTime() >= LOBBY_CONFIG.DISBANDED_RETENTION_MS;

  return retentionExpired;
}

/**
 * Process Snake Draft lobbies
 */
async function processSnakeDraftLobbies(db, now, isDryRun) {
  const results = {
    disbanded: [],
    deleted: [],
    errors: [],
    checked: 0,
  };

  const draftsRef = db.collection('drafts');

  // Query waiting lobbies
  const waitingSnap = await draftsRef
    .where('status', '==', 'waiting')
    .where('isTraining', '==', false)
    .limit(LOBBY_CONFIG.BATCH_SIZE)
    .get();

  logInfo('SNAKE_DRAFT', `Found ${waitingSnap.size} waiting Snake Draft lobbies`);
  results.checked = waitingSnap.size;

  // Process each waiting lobby
  for (const doc of waitingSnap.docs) {
    const draft = doc.data();

    if (isSnakeDraftExpired(draft, now)) {
      if (isDryRun) {
        logInfo('DRY_RUN', `Would disband Snake Draft ${doc.id}`, {
          code: draft.code,
          players: draft.players?.length || 0,
          scheduledStart: draft.scheduledStart,
        });
        results.disbanded.push({ id: doc.id, code: draft.code, dryRun: true });
      } else {
        try {
          await doc.ref.update({
            status: 'disbanded',
            disbandedAt: now.toISOString(),
            disbandedReason: 'expired_insufficient_players',
          });
          logInfo('DISBAND', `Disbanded Snake Draft ${doc.id}`, { code: draft.code });
          results.disbanded.push({ id: doc.id, code: draft.code });
        } catch (error) {
          logError('ERROR', `Failed to disband Snake Draft ${doc.id}`, { error: error.message });
          results.errors.push({ id: doc.id, error: error.message });
        }
      }
    }
  }

  // Query disbanded lobbies for cleanup
  const disbandedSnap = await draftsRef
    .where('status', '==', 'disbanded')
    .limit(LOBBY_CONFIG.BATCH_SIZE)
    .get();

  logInfo('SNAKE_DRAFT', `Found ${disbandedSnap.size} disbanded Snake Draft lobbies`);

  // Process each disbanded lobby
  for (const doc of disbandedSnap.docs) {
    const draft = doc.data();

    if (shouldDeleteDisbanded(draft, now)) {
      if (isDryRun) {
        logInfo('DRY_RUN', `Would delete disbanded Snake Draft ${doc.id}`, {
          code: draft.code,
          disbandedAt: draft.disbandedAt,
        });
        results.deleted.push({ id: doc.id, code: draft.code, dryRun: true });
      } else {
        try {
          await doc.ref.delete();
          logInfo('DELETE', `Deleted disbanded Snake Draft ${doc.id}`, { code: draft.code });
          results.deleted.push({ id: doc.id, code: draft.code });
        } catch (error) {
          logError('ERROR', `Failed to delete Snake Draft ${doc.id}`, { error: error.message });
          results.errors.push({ id: doc.id, error: error.message });
        }
      }
    }
  }

  return results;
}

/**
 * Process BaggerBomb V3 lobbies
 */
async function processBaggerBombLobbies(db, now, isDryRun) {
  const results = {
    disbanded: [],
    deleted: [],
    errors: [],
    checked: 0,
  };

  const battlesRef = db.collection('battles');

  // Query waiting V3 lobbies
  const waitingSnap = await battlesRef
    .where('_v', '==', 3)
    .where('state.status', '==', 'waiting')
    .limit(LOBBY_CONFIG.BATCH_SIZE)
    .get();

  logInfo('BAGGER_BOMB', `Found ${waitingSnap.size} waiting BaggerBomb V3 lobbies`);
  results.checked = waitingSnap.size;

  // Process each waiting lobby
  for (const doc of waitingSnap.docs) {
    const battle = doc.data();

    if (isBaggerBombExpired(battle, now)) {
      if (isDryRun) {
        logInfo('DRY_RUN', `Would disband BaggerBomb ${doc.id}`, {
          creator: battle.creator?.username,
          hasOpponent: !!(battle.opponent?.uid || battle.opponent?.odUserId),
        });
        results.disbanded.push({ id: doc.id, dryRun: true });
      } else {
        try {
          await doc.ref.update({
            'state.status': 'disbanded',
            disbandedAt: now.toISOString(),
            disbandedReason: 'expired_insufficient_players',
          });
          logInfo('DISBAND', `Disbanded BaggerBomb ${doc.id}`);
          results.disbanded.push({ id: doc.id });
        } catch (error) {
          logError('ERROR', `Failed to disband BaggerBomb ${doc.id}`, { error: error.message });
          results.errors.push({ id: doc.id, error: error.message });
        }
      }
    }
  }

  // Query disbanded lobbies for cleanup
  const disbandedSnap = await battlesRef
    .where('_v', '==', 3)
    .where('state.status', '==', 'disbanded')
    .limit(LOBBY_CONFIG.BATCH_SIZE)
    .get();

  logInfo('BAGGER_BOMB', `Found ${disbandedSnap.size} disbanded BaggerBomb V3 lobbies`);

  // Process each disbanded lobby
  for (const doc of disbandedSnap.docs) {
    const battle = doc.data();

    if (shouldDeleteDisbanded(battle, now)) {
      if (isDryRun) {
        logInfo('DRY_RUN', `Would delete disbanded BaggerBomb ${doc.id}`, {
          disbandedAt: battle.disbandedAt,
        });
        results.deleted.push({ id: doc.id, dryRun: true });
      } else {
        try {
          await doc.ref.delete();
          logInfo('DELETE', `Deleted disbanded BaggerBomb ${doc.id}`);
          results.deleted.push({ id: doc.id });
        } catch (error) {
          logError('ERROR', `Failed to delete BaggerBomb ${doc.id}`, { error: error.message });
          results.errors.push({ id: doc.id, error: error.message });
        }
      }
    }
  }

  return results;
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Verify cron secret for automated calls
  if (req.method === 'GET') {
    const authHeader = req.headers.authorization;
    const isVercelCron = req.headers['x-vercel-cron'] === '1';

    if (!isVercelCron && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  // Allow POST for manual testing
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { dryRun, testMode } = req.query;
  const isDryRun = dryRun === 'true';
  const isTestMode = testMode === 'true';

  logInfo('START', 'Lobby cleanup started', { dryRun: isDryRun, testMode: isTestMode });

  const now = new Date();

  try {
    const db = getFirebaseAdmin();

    // Process both lobby types
    const [snakeDraftResults, baggerBombResults] = await Promise.all([
      processSnakeDraftLobbies(db, now, isDryRun),
      processBaggerBombLobbies(db, now, isDryRun),
    ]);

    const summary = {
      success: true,
      timestamp: now.toISOString(),
      dryRun: isDryRun,
      testMode: isTestMode,
      snakeDraft: snakeDraftResults,
      baggerBomb: baggerBombResults,
      totals: {
        checked: snakeDraftResults.checked + baggerBombResults.checked,
        disbanded: snakeDraftResults.disbanded.length + baggerBombResults.disbanded.length,
        deleted: snakeDraftResults.deleted.length + baggerBombResults.deleted.length,
        errors: snakeDraftResults.errors.length + baggerBombResults.errors.length,
      },
    };

    logInfo('COMPLETE', 'Lobby cleanup completed', summary);
    return res.status(200).json(summary);

  } catch (error) {
    logError('FATAL', 'Fatal error during lobby cleanup', { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: now.toISOString(),
    });
  }
}
