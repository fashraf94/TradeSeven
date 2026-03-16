// api/earnings/debug-tournaments.js
// Debug endpoint to list all tournaments and their status
//
// PURPOSE: Provides visibility into tournament state for debugging resolution issues.
// Shows tournament counts by status, prediction resolution progress, and identifies
// tournaments that may be stuck (e.g., 'open' but past deadline).
//
// SECURITY: Requires ?testMode=true parameter to access. Does not expose user data
// or financial information - only tournament IDs, status, and aggregate counts.
//
// Usage:
//   GET /api/earnings/debug-tournaments?testMode=true
//
// Created: Jan 2026 during tournament resolution debugging

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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

export default async function handler(req, res) {
  // --- Cron/Admin Authentication ---
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const authHeader = req.headers.authorization;
  if (!isVercelCron && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Require testMode for safety
  if (req.query.testMode !== 'true') {
    return res.status(401).json({ error: 'Add ?testMode=true to access this endpoint' });
  }

  try {
    const db = getFirebaseAdmin();

    // Get ALL tournaments (no status filter)
    console.log('[debug-tournaments] Fetching all tournaments...');
    const tournamentsSnapshot = await db.collection('earningsTournaments').get();

    const tournaments = [];
    for (const doc of tournamentsSnapshot.docs) {
      const data = doc.data();

      // Get entry count for this tournament
      const entriesSnapshot = await db.collection('earningsEntries')
        .where('tournamentId', '==', doc.id)
        .get();

      // Count predictions by status
      let totalPredictions = 0;
      let resolvedPredictions = 0;
      let pendingPredictions = 0;
      const symbolsWithPredictions = new Set();

      entriesSnapshot.docs.forEach(entryDoc => {
        const entry = entryDoc.data();
        (entry.predictions || []).forEach(pred => {
          totalPredictions++;
          if (pred.resolved) resolvedPredictions++;
          else pendingPredictions++;
          if (pred.symbol) symbolsWithPredictions.add(pred.symbol);
        });
      });

      tournaments.push({
        id: doc.id,
        name: data.name,
        status: data.status,
        weekStart: data.weekStart,
        weekEnd: data.weekEnd,
        lockDeadline: data.lockDeadline,
        entryCount: data.entryCount || entriesSnapshot.docs.length,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
        completedAt: data.completedAt?.toDate?.()?.toISOString() || data.completedAt,
        predictions: {
          total: totalPredictions,
          resolved: resolvedPredictions,
          pending: pendingPredictions,
          symbols: Array.from(symbolsWithPredictions).slice(0, 10)
        }
      });
    }

    // Sort by creation date (newest first)
    tournaments.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0);
      const dateB = new Date(b.createdAt || 0);
      return dateB - dateA;
    });

    // Also check what the resolution query would find
    const resolutionQuerySnapshot = await db.collection('earningsTournaments')
      .where('status', 'in', ['open', 'locked', 'in_progress'])
      .get();

    const resolutionQueryResults = resolutionQuerySnapshot.docs.map(doc => ({
      id: doc.id,
      status: doc.data().status
    }));

    // Check for 'open' tournaments that might need processing
    const openTournaments = tournaments.filter(t => t.status === 'open');
    const now = new Date();
    const openButPastDeadline = openTournaments.filter(t => {
      if (!t.lockDeadline) return false;
      return new Date(t.lockDeadline) < now;
    });

    return res.status(200).json({
      success: true,
      summary: {
        totalTournaments: tournaments.length,
        byStatus: {
          open: tournaments.filter(t => t.status === 'open').length,
          locked: tournaments.filter(t => t.status === 'locked').length,
          in_progress: tournaments.filter(t => t.status === 'in_progress').length,
          completed: tournaments.filter(t => t.status === 'completed').length,
          other: tournaments.filter(t => !['open', 'locked', 'in_progress', 'completed'].includes(t.status)).length
        },
        resolutionQueryWouldFind: resolutionQueryResults.length,
        openButPastDeadline: openButPastDeadline.length
      },
      resolutionQueryResults,
      openButPastDeadline: openButPastDeadline.map(t => ({
        id: t.id,
        status: t.status,
        lockDeadline: t.lockDeadline,
        entryCount: t.entryCount,
        predictions: t.predictions
      })),
      tournaments,
      checkedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('[debug-tournaments] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
