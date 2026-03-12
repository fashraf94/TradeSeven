// api/admin/generate-briefs.js
// Admin endpoint to manually trigger brief generation for specific stocks or all.
//
// Usage:
//   POST /api/admin/generate-briefs
//   Auth: X-Admin-Secret header or ?secret= query param
//   Body: { symbols: ['RKLB', 'CRWV'] }  — specific stocks
//   Body: { all: true }                   — all non-Tier-1 draft stocks

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import {
  TIER_1_STOCKS,
  getAllDraftStocks,
  getNonTier1Stocks,
  generateBrief,
} from '../_utils/briefGenerator.js';

// Vercel serverless config: allow up to 5 minutes
export const config = { maxDuration: 300 };

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

const LOG_PREFIX = '[BriefsAdmin]';

function logInfo(message, data = null) {
  const ts = new Date().toISOString();
  if (data) console.log(`${ts} ${LOG_PREFIX} ${message}`, JSON.stringify(data));
  else console.log(`${ts} ${LOG_PREFIX} ${message}`);
}

function logError(message, data = null) {
  const ts = new Date().toISOString();
  if (data) console.error(`${ts} ${LOG_PREFIX} ${message}`, JSON.stringify(data));
  else console.error(`${ts} ${LOG_PREFIX} ${message}`);
}

// ---------------------------------------------------------------------------
// Firebase Admin
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const DELAY_BETWEEN_CALLS_MS = 500;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  // Auth: x-admin-secret header or ?secret= query param
  const adminSecret = process.env.ADMIN_SECRET || process.env.CRON_SECRET;
  const providedSecret = req.headers['x-admin-secret'] || req.query.secret;

  if (!adminSecret) {
    logError('No ADMIN_SECRET or CRON_SECRET configured');
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  if (providedSecret !== adminSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { symbols, all } = req.body || {};

  // Determine which stocks to process
  let stocks;
  if (all) {
    stocks = getNonTier1Stocks();
    logInfo(`Generating briefs for ALL ${stocks.length} non-Tier-1 stocks`);
  } else if (Array.isArray(symbols) && symbols.length > 0) {
    const allDraft = getAllDraftStocks();
    const draftMap = new Map(allDraft.map(s => [s.symbol, s]));

    stocks = [];
    const notFound = [];
    const tier1Skipped = [];

    for (const sym of symbols) {
      const upper = sym.toUpperCase();
      if (TIER_1_STOCKS.has(upper)) {
        tier1Skipped.push(upper);
      } else if (draftMap.has(upper)) {
        stocks.push(draftMap.get(upper));
      } else {
        notFound.push(upper);
      }
    }

    if (tier1Skipped.length) {
      logInfo(`Skipping Tier 1 stocks: ${tier1Skipped.join(', ')}`);
    }
    if (notFound.length) {
      logInfo(`Symbols not in draft pool: ${notFound.join(', ')}`);
    }

    if (stocks.length === 0) {
      return res.status(400).json({
        error: 'No valid non-Tier-1 draft stocks to process',
        tier1Skipped,
        notFound,
      });
    }

    logInfo(`Generating briefs for ${stocks.length} stocks: ${stocks.map(s => s.symbol).join(', ')}`);
  } else {
    return res.status(400).json({
      error: 'Provide { symbols: ["RKLB", "CRWV"] } or { all: true }',
    });
  }

  const db = getFirebaseAdmin();
  let success = 0;
  let failed = 0;
  const failures = [];

  for (const stock of stocks) {
    try {
      const briefData = await generateBrief(stock.symbol, stock.name, stock.category);

      await db.collection('stockBriefs').doc(stock.symbol).set({
        symbol: stock.symbol,
        name: stock.name,
        category: stock.category,
        brief: briefData,
        generatedAt: FieldValue.serverTimestamp(),
        expiresAt: new Date(Date.now() + SEVEN_DAYS_MS),
        tier: 2,
        model: 'sonar',
      });

      success++;
      logInfo(`✓ ${stock.symbol} (${success}/${stocks.length})`);
    } catch (err) {
      failed++;
      failures.push({ symbol: stock.symbol, error: err.message });
      logError(`✗ ${stock.symbol}: ${err.message}`);
    }

    // Rate-limit delay between calls
    if (stocks.indexOf(stock) < stocks.length - 1) {
      await sleep(DELAY_BETWEEN_CALLS_MS);
    }
  }

  const summary = { success, failed, total: stocks.length, failures: failures.slice(0, 10) };
  logInfo('Brief generation complete', summary);

  return res.status(200).json(summary);
}
