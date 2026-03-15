// api/fantasytimes/scan-movers.js
// Server-side mover backup — scans all tracked symbols for big intraday moves
// and triggers Alex stories for any that the client-side detector missed.
// GET endpoint called every 15 min during market hours.

import { applySecurityMiddleware } from '../_utils/security.js';
import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { TICKERS, STOCK_DATA } from '../_utils/stockIntelligenceData.js';
import { generateAlexMoverStory } from './generate-mover.js';

export const config = { maxDuration: 60 };

const LOG_PREFIX = '[FantasyTimes:ScanMovers]';
const MOVE_THRESHOLD_PCT = 3; // 3% intraday move triggers a story

function logInfo(msg, data = null) {
  const ts = new Date().toISOString();
  console.log(`${ts} ${LOG_PREFIX} ${msg}`, data ? JSON.stringify(data) : '');
}

function logError(msg, data = null) {
  const ts = new Date().toISOString();
  console.error(`${ts} ${LOG_PREFIX} ${msg}`, data ? JSON.stringify(data) : '');
}

/**
 * Get the start of today in ET for dedup queries.
 */
function getStartOfTodayET() {
  const now = new Date();
  const etStr = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
  const et = new Date(etStr);
  et.setHours(0, 0, 0, 0);
  // Convert back to UTC by finding the offset
  const utcNow = now.getTime();
  const etNow = et.getTime();
  const diff = utcNow - new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' })).getTime();
  return new Date(etNow + diff);
}

export default async function handler(req, res) {
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 10, windowMs: 60000 } })) {
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  if (!process.env.EODHD_API_KEY) {
    return res.status(500).json({ success: false, error: 'EODHD API key not configured' });
  }

  try {
    const db = getFirebaseAdmin();
    const startOfToday = getStartOfTodayET();
    const results = { scanned: 0, movers: [], storiesGenerated: 0, skipped: 0, errors: [] };

    // Fetch real-time quotes for all tracked symbols
    logInfo(`Scanning ${TICKERS.length} symbols for big movers (>=${MOVE_THRESHOLD_PCT}%)`);

    for (const symbol of TICKERS) {
      try {
        const url = `https://eodhd.com/api/real-time/${symbol}.US?api_token=${process.env.EODHD_API_KEY}&fmt=json`;
        const resp = await fetch(url);
        if (!resp.ok) {
          logError(`Failed to fetch ${symbol}: HTTP ${resp.status}`);
          results.errors.push(`${symbol}: HTTP ${resp.status}`);
          continue;
        }

        const data = await resp.json();
        results.scanned++;

        const changeP = parseFloat(data.change_p);
        if (isNaN(changeP) || Math.abs(changeP) < MOVE_THRESHOLD_PCT) {
          continue;
        }

        logInfo(`Big mover detected: ${symbol} ${changeP >= 0 ? '+' : ''}${changeP.toFixed(2)}%`);
        results.movers.push({ symbol, changeP });

        // Dedup: check if Alex already has a story for this symbol today
        const dedupQuery = await db
          .collection('fantasyTimesStories')
          .where('primaryTicker', '==', symbol)
          .where('reporter', '==', 'alex')
          .where('publishedAt', '>', startOfToday)
          .limit(1)
          .get();

        if (!dedupQuery.empty) {
          logInfo(`${symbol} already has a story today, skipping`);
          results.skipped++;
          continue;
        }

        // Generate story
        const close = parseFloat(data.close) || 0;
        const previousClose = parseFloat(data.previousClose) || 0;
        const priceChange = close - previousClose;
        const sector = STOCK_DATA[symbol]?.sector || 'Unknown';

        const storyResult = await generateAlexMoverStory({
          symbol,
          currentPrice: close,
          priceChange,
          percentChange: changeP,
          atrMultiple: 1.5, // Server-side fallback; no ATR cached
          direction: changeP >= 0 ? 'up' : 'down',
          sector,
        });

        if (storyResult.success) {
          logInfo(`Generated story for ${symbol}: ${storyResult.headline}`);
          results.storiesGenerated++;
        } else {
          logInfo(`Story generation skipped for ${symbol}: ${storyResult.reason || storyResult.message}`);
          results.skipped++;
        }
      } catch (err) {
        logError(`Error processing ${symbol}`, { error: err.message });
        results.errors.push(`${symbol}: ${err.message}`);
      }
    }

    logInfo('Scan complete', {
      scanned: results.scanned,
      moversFound: results.movers.length,
      storiesGenerated: results.storiesGenerated,
      skipped: results.skipped,
    });

    return res.status(200).json({
      success: true,
      ...results,
    });
  } catch (error) {
    logError('Scan failed', { error: error.message });
    return res.status(500).json({ success: false, error: 'Mover scan failed' });
  }
}
