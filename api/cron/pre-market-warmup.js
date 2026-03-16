// api/cron/pre-market-warmup.js
// Pre-market cache warming — fetches fresh prices for active assets ~5 minutes before market open.
//
// Schedule: "25 13,14 * * 1-5" (runs at both 13:25 and 14:25 UTC to cover EST/EDT)
// The handler checks isPreMarketWindow() internally, so only one execution per day
// actually performs work — the other exits early.
//
// Why: Stock prices are frozen in cache overnight. This cron primes the cache with
// fresh pre-market data so the first user request at 9:30 AM gets an instant response
// instead of triggering a cold-start API flood.

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { setInCache } from '../_utils/serverCache.js';
import { isPreMarketWindow, isTodayHoliday } from '../_utils/marketSchedule.js';

const LOG_PREFIX = '[PreMarketWarmup]';

function log(message, data = null) {
  const timestamp = new Date().toISOString();
  if (data) {
    console.log(`${timestamp} ${LOG_PREFIX} ${message}`, JSON.stringify(data));
  } else {
    console.log(`${timestamp} ${LOG_PREFIX} ${message}`);
  }
}

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
 * Extract unique stock symbols from a battle document.
 * Handles both flat array and tiered { stocks: [], crypto: [] } portfolio formats.
 */
function extractStockSymbols(battle) {
  const symbols = new Set();

  for (const side of ['creator', 'opponent']) {
    const player = battle[side];
    if (!player) continue;

    const portfolio = player.portfolio;
    if (!portfolio) continue;

    // Tiered format: { stocks: [...], crypto: [...] }
    if (portfolio.stocks && Array.isArray(portfolio.stocks)) {
      portfolio.stocks.forEach(asset => {
        if (asset.symbol) symbols.add(asset.symbol.toUpperCase().replace(/\.US$/i, ''));
      });
    }

    // Flat array format
    if (Array.isArray(portfolio)) {
      portfolio.forEach(asset => {
        if (asset.symbol) {
          const sym = asset.symbol.toUpperCase();
          // Exclude crypto symbols
          if (!sym.includes('-USD') && !sym.endsWith('.CC')) {
            symbols.add(sym.replace(/\.US$/i, ''));
          }
        }
      });
    }

    // Also check bench
    const bench = player.bench;
    if (bench) {
      if (bench.stocks && Array.isArray(bench.stocks)) {
        bench.stocks.forEach(asset => {
          if (asset.symbol) symbols.add(asset.symbol.toUpperCase().replace(/\.US$/i, ''));
        });
      }
      if (Array.isArray(bench)) {
        bench.forEach(asset => {
          if (asset.symbol) {
            const sym = asset.symbol.toUpperCase();
            if (!sym.includes('-USD') && !sym.endsWith('.CC')) {
              symbols.add(sym.replace(/\.US$/i, ''));
            }
          }
        });
      }
    }
  }

  return symbols;
}

export default async function handler(req, res) {
  // --- Cron/Admin Authentication ---
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const authHeader = req.headers.authorization;
  if (!isVercelCron && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const startTime = Date.now();

  // 1. Verify we're actually in pre-market window (handles DST edge cases)
  if (!isPreMarketWindow()) {
    log('Not in pre-market window — skipping');
    return res.status(200).json({ skipped: true, reason: 'not_pre_market' });
  }

  // 2. Check if today is a holiday
  if (isTodayHoliday()) {
    log('Today is a market holiday — skipping');
    return res.status(200).json({ skipped: true, reason: 'holiday' });
  }

  log('Starting pre-market warm-up...');

  try {
    const db = getFirebaseAdmin();
    const API_KEY = process.env.EODHD_API_KEY;

    if (!API_KEY) {
      log('ERROR: EODHD_API_KEY not configured');
      return res.status(500).json({ error: 'API not configured' });
    }

    // 3. Get active battle assets from Firestore
    const allStockSymbols = new Set();

    // Query active battles (highest priority)
    const battlesSnapshot = await db.collection('battles')
      .where('status', '==', 'active')
      .get();

    log(`Found ${battlesSnapshot.size} active battles`);

    battlesSnapshot.forEach(doc => {
      const battle = doc.data();
      const symbols = extractStockSymbols(battle);
      symbols.forEach(s => allStockSymbols.add(s));
    });

    // Also check 'battle' status (snake draft post-draft phase)
    const draftBattlesSnapshot = await db.collection('battles')
      .where('status', '==', 'battle')
      .get();

    log(`Found ${draftBattlesSnapshot.size} draft battles in battle phase`);

    draftBattlesSnapshot.forEach(doc => {
      const battle = doc.data();
      const symbols = extractStockSymbols(battle);
      symbols.forEach(s => allStockSymbols.add(s));
    });

    const stockSymbols = Array.from(allStockSymbols);

    if (stockSymbols.length === 0) {
      log('No active stock symbols to warm up');
      return res.status(200).json({
        success: true,
        stocksWarmed: 0,
        reason: 'no_active_stocks',
        duration: Date.now() - startTime,
      });
    }

    log(`Warming up ${stockSymbols.length} stock symbols: ${stockSymbols.join(', ')}`);

    // 4. Batch fetch fresh prices from EODHD
    // Fetch in batches of 20 to stay within URL length limits
    const BATCH_SIZE = 20;
    let totalWarmed = 0;
    let totalFailed = 0;

    for (let i = 0; i < stockSymbols.length; i += BATCH_SIZE) {
      const batch = stockSymbols.slice(i, i + BATCH_SIZE);
      const symbolList = batch.map(s => `${s.replace(/\./g, '-')}.US`).join(',');

      try {
        const url = `https://eodhd.com/api/real-time/${symbolList}?api_token=${API_KEY}&fmt=json`;
        const response = await fetch(url);

        if (!response.ok) {
          log(`EODHD batch fetch failed with status ${response.status}`);
          totalFailed += batch.length;
          continue;
        }

        const data = await response.json();
        const results = Array.isArray(data) ? data : [data];

        // 5. Store each result in server cache
        for (const item of results) {
          if (item && item.code) {
            const symbol = item.code.replace(/\.US$/i, '');
            const cacheKey = `stock_prices_${symbol}`;

            const normalized = {
              code: symbol,
              timestamp: item.timestamp,
              open: item.open,
              high: item.high,
              low: item.low,
              close: item.close,
              previousClose: item.previousClose,
              change: item.change,
              change_p: item.change_p,
              volume: item.volume,
            };

            // Cache with 10-minute TTL (will be refreshed by normal flow once market opens)
            setInCache(cacheKey, normalized, 600, {
              dataType: 'price',
              isCrypto: false,
            });

            totalWarmed++;
          }
        }
      } catch (err) {
        log(`Batch fetch error: ${err.message}`);
        totalFailed += batch.length;
      }

      // Rate limiting between batches
      if (i + BATCH_SIZE < stockSymbols.length) {
        await new Promise(r => setTimeout(r, 200));
      }
    }

    const duration = Date.now() - startTime;
    log(`Warm-up complete: ${totalWarmed} warmed, ${totalFailed} failed (${duration}ms)`);

    // 6. Return results
    return res.status(200).json({
      success: true,
      stocksWarmed: totalWarmed,
      stocksFailed: totalFailed,
      cryptoSkipped: true, // Crypto doesn't need warming — it's already live
      totalSymbols: stockSymbols.length,
      timestamp: new Date().toISOString(),
      duration,
    });
  } catch (err) {
    log(`Fatal error: ${err.message}`);
    return res.status(500).json({
      error: 'Pre-market warm-up failed',
      message: err.message,
    });
  }
}
