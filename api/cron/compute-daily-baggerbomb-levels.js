// api/cron/compute-daily-baggerbomb-levels.js
// Computes daily threshold dollar targets for all active V4 BaggerBomb battles.
// Runs AFTER market close and AFTER daily banking cron, writes pre-computed
// dollar levels to Firestore so clients can use simple price comparisons
// instead of computing baselines from previousClose/entry prices.
//
// Schedule: 30 1 * * 2-6 (UTC: Tue-Sat 1:30 AM = Mon-Fri 8:30 PM ET during EST)
//
// Writes to battle.state.dailyLevels:
//   { date, computedAt, assets: { SYMBOL: { baseline, baggerBomb, doubleBagger, ... } } }

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const LOG_PREFIX = '[DailyLevelsCron]';

function log(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const prefix = `${timestamp} ${LOG_PREFIX}`;
  if (data) {
    console[level](`${prefix} ${message}`, JSON.stringify(data, null, 2));
  } else {
    console[level](`${prefix} ${message}`);
  }
}

const logInfo = (message, data) => log('log', message, data);
const logWarn = (message, data) => log('warn', message, data);
const logError = (message, data) => log('error', message, data);

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

function getEasternTime() {
  const now = new Date();
  const etString = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
  return new Date(etString);
}

// 2026 US Stock Market Holidays
// Duplicated from src/constants/battleTimingV4.js since serverless functions can't import from src/.
const US_MARKET_HOLIDAYS_2026 = [
  '2026-01-01', '2026-01-19', '2026-02-16', '2026-04-03',
  '2026-05-25', '2026-07-03', '2026-09-07',
  '2026-11-26', '2026-12-25',
];

function formatDateStr(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function isTradingDay() {
  const et = getEasternTime();
  const day = et.getDay();
  if (day < 1 || day > 5) return false;
  return !US_MARKET_HOLIDAYS_2026.includes(formatDateStr(et));
}

/**
 * Compute the next trading day from a given date (skips weekends and holidays).
 * Used to set the `date` field — the trading day these levels are FOR.
 */
function getNextTradingDay(fromDate) {
  const d = new Date(fromDate);
  // Start from the next calendar day
  d.setDate(d.getDate() + 1);

  // Skip weekends and holidays (max 10 iterations to be safe)
  for (let i = 0; i < 10; i++) {
    const day = d.getDay();
    const dateStr = formatDateStr(d);
    if (day >= 1 && day <= 5 && !US_MARKET_HOLIDAYS_2026.includes(dateStr)) {
      return dateStr;
    }
    d.setDate(d.getDate() + 1);
  }

  // Fallback: shouldn't happen, but return tomorrow
  const fallback = new Date(fromDate);
  fallback.setDate(fallback.getDate() + 1);
  return formatDateStr(fallback);
}

// Flatten portfolio tiers into a flat array with tier/slot metadata
function flattenPortfolio(portfolio) {
  if (!portfolio) return [];
  const flat = [];
  for (const tier of ['star', 'core', 'support']) {
    (portfolio[tier] || []).forEach((asset, index) => {
      if (asset) flat.push({ ...asset, tier, slotIndex: index });
    });
  }
  return flat;
}

// Fetch stock prices from EODHD API
async function fetchStockPrices(symbols) {
  const apiKey = process.env.EODHD_API_KEY;
  if (!apiKey) {
    logError('EODHD_API_KEY not configured');
    return {};
  }

  const prices = {};
  try {
    const symbolList = symbols.join(',');
    const url = `https://eodhd.com/api/real-time/${symbolList}?api_token=${apiKey}&fmt=json`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`EODHD API error: ${response.status}`);

    const data = await response.json();
    const priceArray = Array.isArray(data) ? data : [data];

    for (const item of priceArray) {
      if (item.code && item.close != null) {
        prices[item.code.toUpperCase()] = item.close;
      }
    }
    logInfo(`Fetched closing prices for ${Object.keys(prices).length}/${symbols.length} symbols`);
  } catch (error) {
    logError('Error fetching stock prices', { error: error.message });
  }
  return prices;
}

/**
 * Compute dollar-level thresholds for a single battle.
 * Returns the dailyLevels object to write to Firestore.
 */
function computeBattleLevels(battleData, closingPrices, targetDate, computedAt) {
  const thresholds = battleData.thresholds || {};
  const assets = {};

  // Collect all unique symbols from both players' portfolios
  const allSymbols = new Set();
  for (const role of ['creator', 'opponent']) {
    const flat = flattenPortfolio(battleData[role]?.portfolio);
    flat.forEach(a => allSymbols.add(a.symbol));
  }

  let computed = 0;
  let skipped = 0;

  for (const symbol of allSymbols) {
    const baseline = closingPrices[symbol];
    if (!baseline || baseline <= 0) {
      skipped++;
      continue;
    }

    const threshold = thresholds[symbol]?.threshold || 2.5; // ATR % (default 2.5)

    assets[symbol] = {
      baseline: round2(baseline),
      baggerBomb: round2(baseline * (1 + threshold / 100)),
      doubleBagger: round2(baseline * (1 + 1.5 * threshold / 100)),
      tenBagger: round2(baseline * (1 + 2.0 * threshold / 100)),
      bust: round2(baseline * (1 - threshold / 100)),
      crash: round2(baseline * (1 - 1.5 * threshold / 100)),
      meltdown: round2(baseline * (1 - 2.0 * threshold / 100)),
      threshold,
    };
    computed++;
  }

  return {
    levels: {
      date: targetDate,
      computedAt,
      assets,
    },
    computed,
    skipped,
  };
}

/** Round to 2 decimal places */
function round2(n) {
  return Math.round(n * 100) / 100;
}

// Main handler
export default async function handler(req, res) {
  // --- Cron/Admin Authentication ---
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const authHeader = req.headers.authorization;
  if (!isVercelCron && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const startTime = Date.now();
  logInfo('Starting daily levels computation cron');

  if (!isTradingDay()) {
    logInfo('Skipping - not a trading day');
    return res.status(200).json({
      success: true,
      message: 'Skipped - market closed',
      processed: 0,
    });
  }

  try {
    const db = getFirebaseAdmin();
    const et = getEasternTime();
    const computedAt = new Date().toISOString();
    const targetDate = getNextTradingDay(et);

    logInfo(`Computing levels for target date: ${targetDate}`);

    // Query all active V4 battles (not training)
    const battlesSnapshot = await db.collection('battles')
      .where('_v', '==', 4)
      .where('state.status', '==', 'active')
      .get();

    const battles = [];
    battlesSnapshot.forEach(doc => {
      const data = doc.data();
      if (!data.isTraining) {
        battles.push(doc);
      }
    });

    logInfo(`Found ${battles.length} active V4 battles`);

    if (battles.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No active V4 battles',
        processed: 0,
      });
    }

    // Collect all unique symbols across all battles
    const allSymbols = new Set();
    for (const battleDoc of battles) {
      const data = battleDoc.data();
      for (const role of ['creator', 'opponent']) {
        const flat = flattenPortfolio(data[role]?.portfolio);
        flat.forEach(a => allSymbols.add(a.symbol));
      }
    }

    // Fetch closing prices from EODHD (single batch for all symbols)
    const symbolList = Array.from(allSymbols);
    logInfo(`Fetching closing prices for ${symbolList.length} unique symbols`);
    const closingPrices = await fetchStockPrices(symbolList);

    if (Object.keys(closingPrices).length === 0) {
      logError('Failed to fetch any closing prices');
      return res.status(500).json({ success: false, error: 'Failed to fetch closing prices' });
    }

    // Process each battle
    const results = { processed: 0, skipped: 0, errors: 0, totalAssets: 0 };

    for (const battleDoc of battles) {
      try {
        const data = battleDoc.data();
        const { levels, computed, skipped } = computeBattleLevels(
          data, closingPrices, targetDate, computedAt
        );

        if (computed === 0) {
          logWarn(`Battle ${battleDoc.id}: No assets computed (${skipped} skipped)`);
          results.skipped++;
          continue;
        }

        // Write dailyLevels to the battle document
        await db.collection('battles').doc(battleDoc.id).update({
          'state.dailyLevels': levels,
          updatedAt: new Date().toISOString(),
        });

        results.processed++;
        results.totalAssets += computed;

        logInfo(`Battle ${battleDoc.id}: Computed levels for ${computed} assets`, {
          targetDate,
          sampleSymbol: Object.keys(levels.assets)[0],
          sampleLevels: levels.assets[Object.keys(levels.assets)[0]],
        });
      } catch (error) {
        logError(`Error processing battle ${battleDoc.id}`, { error: error.message });
        results.errors++;
      }
    }

    const duration = Date.now() - startTime;
    logInfo('Cron job complete', { ...results, durationMs: duration });

    return res.status(200).json({
      success: true,
      targetDate,
      ...results,
      durationMs: duration,
    });

  } catch (error) {
    logError('Cron job failed', { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, error: error.message });
  }
}
