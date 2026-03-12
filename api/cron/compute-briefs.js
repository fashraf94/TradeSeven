// api/cron/compute-briefs.js
// Weekly cron: generates Tier 2 company briefs for draft stocks via Perplexity Sonar.
//
// Schedule: 0 1 * * 0 (UTC 01:00 Sunday = ET ~8-9 PM Saturday/Sunday)
//
// Flow:
//   1. Get all 75 draft stocks, filter out 14 with Tier 1 knowledge packages
//   2. For each of the ~61 remaining stocks, call Sonar for a structured brief
//   3. Store in Firestore: stockBriefs/{SYMBOL} with 7-day TTL
//
// Expected runtime: ~35-45 seconds (61 stocks × ~500ms delay + API latency)

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

const LOG_PREFIX = '[BriefsCron]';

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
  // Auth: Vercel cron header or Bearer token
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const authHeader = req.headers.authorization;
  if (req.method === 'GET' && !isVercelCron && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  logInfo('Starting brief generation run');

  const db = getFirebaseAdmin();
  const stocks = getNonTier1Stocks();
  const total = getAllDraftStocks().length;
  const skipped = total - stocks.length;

  logInfo(`Processing ${stocks.length} stocks (${skipped} Tier 1 skipped, ${total} total draft)`);

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

  const summary = { success, failed, skipped, total, failures: failures.slice(0, 10) };
  logInfo('Brief generation complete', summary);

  return res.status(200).json(summary);
}
