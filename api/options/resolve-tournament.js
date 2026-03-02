// api/options/resolve-tournament.js
// Triggers resolution for options tournaments
// Called by Vercel cron at end of tournament period (Friday 4 PM ET)
//
// Resolution is IDEMPOTENT - safe to run multiple times:
//   - Already resolved entries are skipped
//   - Already completed tournaments are skipped

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const LOG_PREFIX = '[OptionsResolution]';

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

// Fetch current stock prices from EODHD API
async function fetchCurrentPrices(symbols) {
  const apiKey = process.env.EODHD_API_KEY;
  if (!apiKey) {
    throw new Error('EODHD_API_KEY not configured');
  }

  const prices = {};

  // Fetch prices for all symbols
  for (const symbol of symbols) {
    try {
      const url = `https://eodhd.com/api/real-time/${symbol.replace(/\./g, '-')}.US?api_token=${apiKey}&fmt=json`;
      const response = await fetch(url);

      if (!response.ok) {
        logError('PRICE', `Failed to fetch ${symbol}: ${response.status}`);
        continue;
      }

      const data = await response.json();
      if (data.close) {
        prices[symbol] = data.close;
      }
    } catch (err) {
      logError('PRICE', `Error fetching ${symbol}:`, { error: err.message });
    }
  }

  return prices;
}

// Calculate mark-to-market value for an option contract
function calculateContractValue(contract, currentPrice) {
  // Already locked - use locked value
  if (contract.lockedValue !== null) {
    return contract.lockedValue;
  }

  // Already settled - use final value
  if (contract.settled) {
    return contract.finalValue || 0;
  }

  // Check if option is in-the-money
  const isWinning = contract.direction === 'call'
    ? currentPrice >= contract.strike
    : currentPrice <= contract.strike;

  if (isWinning) {
    // In the money - use 70% of potential payout as mark-to-market
    return contract.potentialPayout * 0.7;
  } else {
    // Out of the money - decaying value based on distance from strike
    const distanceToStrike = Math.abs(currentPrice - contract.strike) / contract.strike;
    return contract.entryAmount * Math.max(0.1, 1 - distanceToStrike * 3);
  }
}

// Resolve a single tournament
async function resolveTournament(db, tournament, prices) {
  const tournamentId = tournament.id;
  logInfo('RESOLVE', `Processing tournament: ${tournamentId}`);

  // Get all entries for this tournament
  const entriesSnap = await db.collection('optionsEntries')
    .where('tournamentId', '==', tournamentId)
    .get();

  if (entriesSnap.empty) {
    logInfo('RESOLVE', `No entries found for tournament ${tournamentId}`);
    return { entriesProcessed: 0, status: 'no_entries' };
  }

  const entries = entriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  logInfo('RESOLVE', `Found ${entries.length} entries to process`);

  let entriesProcessed = 0;

  for (const entry of entries) {
    // Skip already completed entries
    if (entry.status === 'complete') {
      logInfo('RESOLVE', `Entry ${entry.id} already complete, skipping`);
      continue;
    }

    let totalValue = entry.virtualCash || 0;

    for (const contract of entry.contracts) {
      const currentPrice = prices[contract.symbol];

      if (!currentPrice) {
        // No price available - use entry amount as fallback
        totalValue += contract.lockedValue ?? contract.entryAmount;
        continue;
      }

      const contractValue = calculateContractValue(contract, currentPrice);
      totalValue += contractValue;
    }

    // Calculate percent return
    const percentReturn = ((totalValue - 10000) / 10000) * 100;

    // Update entry with final values
    const entryRef = db.collection('optionsEntries').doc(entry.id);
    await entryRef.update({
      'results.totalValue': totalValue,
      'results.percentReturn': percentReturn,
      status: 'complete',
      resolvedAt: FieldValue.serverTimestamp()
    });

    entriesProcessed++;
    logInfo('RESOLVE', `Resolved entry ${entry.id}: $${totalValue.toFixed(2)} (${percentReturn.toFixed(2)}%)`);
  }

  // Calculate rankings
  await calculateRankings(db, tournamentId);

  // Check if tournament should be marked complete
  const now = new Date();
  const endDate = new Date(tournament.endDate);

  if (now >= endDate) {
    await db.collection('optionsTournaments').doc(tournamentId).update({
      status: 'completed',
      completedAt: FieldValue.serverTimestamp()
    });
    logInfo('RESOLVE', `Tournament ${tournamentId} marked as completed`);
    return { entriesProcessed, status: 'completed' };
  }

  return { entriesProcessed, status: 'in_progress' };
}

// Calculate rankings for a tournament
async function calculateRankings(db, tournamentId) {
  const entriesSnap = await db.collection('optionsEntries')
    .where('tournamentId', '==', tournamentId)
    .get();

  const entries = entriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  // Sort by total value descending
  entries.sort((a, b) => {
    const aValue = a.results?.totalValue ?? 0;
    const bValue = b.results?.totalValue ?? 0;
    return bValue - aValue;
  });

  // Update ranks
  const batch = db.batch();
  entries.forEach((entry, index) => {
    const ref = db.collection('optionsEntries').doc(entry.id);
    batch.update(ref, { rank: index + 1 });
  });

  await batch.commit();
  logInfo('RANKINGS', `Updated rankings for ${entries.length} entries`);
}

export default async function handler(req, res) {
  // Verify cron secret for automated calls
  if (req.method === 'GET') {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  // Allow POST for manual testing
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { dryRun, testMode, tournamentId: specificTournamentId } = req.query;

  logInfo('START', `Options tournament resolution started`, { dryRun, testMode, specificTournamentId });

  try {
    const db = getFirebaseAdmin();

    // Get tournaments to resolve
    let tournamentsQuery = db.collection('optionsTournaments')
      .where('status', 'in', ['in_progress', 'locked']);

    if (specificTournamentId) {
      // Resolve specific tournament
      const tournamentDoc = await db.collection('optionsTournaments').doc(specificTournamentId).get();
      if (!tournamentDoc.exists) {
        return res.status(404).json({ error: 'Tournament not found' });
      }

      const tournament = { id: tournamentDoc.id, ...tournamentDoc.data() };

      // Collect all unique symbols from entries
      const entriesSnap = await db.collection('optionsEntries')
        .where('tournamentId', '==', specificTournamentId)
        .get();

      const symbols = new Set();
      entriesSnap.docs.forEach(doc => {
        const entry = doc.data();
        entry.contracts?.forEach(c => symbols.add(c.symbol));
      });

      // Fetch prices
      const prices = await fetchCurrentPrices([...symbols]);
      logInfo('PRICES', `Fetched prices for ${Object.keys(prices).length} symbols`);

      if (dryRun === 'true') {
        return res.status(200).json({
          dryRun: true,
          tournament: { id: tournament.id, name: tournament.name },
          symbols: [...symbols],
          prices
        });
      }

      const result = await resolveTournament(db, tournament, prices);

      return res.status(200).json({
        success: true,
        tournament: { id: tournament.id, name: tournament.name },
        ...result
      });
    }

    // Get all in-progress tournaments
    const tournamentsSnap = await tournamentsQuery.get();

    if (tournamentsSnap.empty) {
      logInfo('END', 'No tournaments to resolve');
      return res.status(200).json({ success: true, message: 'No tournaments to resolve' });
    }

    const tournaments = tournamentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    logInfo('TOURNAMENTS', `Found ${tournaments.length} tournaments to process`);

    // Collect all unique symbols
    const allSymbols = new Set();
    for (const tournament of tournaments) {
      const entriesSnap = await db.collection('optionsEntries')
        .where('tournamentId', '==', tournament.id)
        .get();

      entriesSnap.docs.forEach(doc => {
        const entry = doc.data();
        entry.contracts?.forEach(c => allSymbols.add(c.symbol));
      });
    }

    // Fetch all prices at once
    const prices = await fetchCurrentPrices([...allSymbols]);
    logInfo('PRICES', `Fetched prices for ${Object.keys(prices).length} symbols`);

    if (dryRun === 'true') {
      return res.status(200).json({
        dryRun: true,
        tournaments: tournaments.map(t => ({ id: t.id, name: t.name })),
        symbols: [...allSymbols],
        prices
      });
    }

    // Resolve each tournament
    const results = [];
    for (const tournament of tournaments) {
      const result = await resolveTournament(db, tournament, prices);
      results.push({
        tournamentId: tournament.id,
        name: tournament.name,
        ...result
      });
    }

    logInfo('END', `Resolution complete`, { results });

    return res.status(200).json({
      success: true,
      results
    });

  } catch (error) {
    logError('ERROR', 'Resolution failed', { error: error.message, stack: error.stack });
    return res.status(500).json({ error: error.message });
  }
}
