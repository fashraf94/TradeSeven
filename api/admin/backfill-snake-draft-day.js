// api/admin/backfill-snake-draft-day.js
// Admin endpoint to retroactively backfill a missed Snake Draft scoring day
// using EODHD historical end-of-day data.
//
// Usage: POST /api/admin/backfill-snake-draft-day
// Auth: X-Admin-Secret header, ?secret= query param, or Authorization: Bearer
// Body: { draftId, dayNumber, date, dryRun?, force? }

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { calculateSnakeDraftAssetScore } from '../../src/services/scoring/baggerBombCalculator.js';

const LOG_PREFIX = '[SnakeDraftBackfill]';

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

async function fetchEodPrices(symbols, date, assetType) {
  const apiKey = process.env.EODHD_API_KEY;
  if (!apiKey) {
    throw new Error('EODHD_API_KEY not configured');
  }

  const results = {};
  const failed = [];

  const fetches = symbols.map(async (symbol) => {
    const upperSymbol = symbol.toUpperCase();
    const suffix = assetType === 'crypto' ? `${upperSymbol}-USD.CC` : `${upperSymbol}.US`;
    const url = `https://eodhd.com/api/eod/${encodeURIComponent(suffix)}?api_token=${apiKey}&from=${date}&to=${date}&fmt=json`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`EODHD returned ${response.status}`);
      }

      const data = await response.json();
      if (!Array.isArray(data) || data.length === 0) {
        failed.push(upperSymbol);
        logWarn(`No EOD data for ${upperSymbol} on ${date}`);
        return;
      }

      results[upperSymbol] = {
        open: data[0].open,
        close: data[0].close,
        high: data[0].high,
        low: data[0].low,
        date: data[0].date,
      };
    } catch (err) {
      failed.push(upperSymbol);
      logWarn(`Failed to fetch EOD for ${upperSymbol}`, { error: err.message });
    }
  });

  await Promise.allSettled(fetches);
  return { results, failed };
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Secret');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  // Authentication
  const adminSecret = process.env.ADMIN_SECRET || process.env.CRON_SECRET;
  const providedSecret =
    req.headers['x-admin-secret'] ||
    req.query.secret ||
    (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);

  if (!adminSecret) {
    logError('No ADMIN_SECRET or CRON_SECRET configured');
    return res.status(500).json({ error: 'Server not configured for admin operations' });
  }

  if (providedSecret !== adminSecret) {
    logWarn('Unauthorized backfill attempt');
    return res.status(401).json({
      error: 'Unauthorized',
      hint: 'Provide X-Admin-Secret header, ?secret= query parameter, or Authorization: Bearer token',
    });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { draftId, dayNumber, date, dryRun, force } = body;

    // --- Validate inputs ---
    if (!draftId || typeof draftId !== 'string') {
      return res.status(400).json({ error: 'draftId is required (non-empty string)' });
    }

    const dayNum = parseInt(dayNumber, 10);
    if (!Number.isInteger(dayNum) || dayNum < 1 || dayNum > 5) {
      return res.status(400).json({ error: 'dayNumber must be an integer 1-5' });
    }

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'date must be a valid YYYY-MM-DD string' });
    }

    const isDryRun = dryRun === true;
    const isForce = force === true;
    const dayKey = `day${dayNum}`;

    logInfo('Backfill requested', { draftId, dayNumber: dayNum, date, dryRun: isDryRun, force: isForce });

    // --- Fetch draft ---
    const db = getFirebaseAdmin();
    const draftRef = db.collection('drafts').doc(draftId);
    const draftDoc = await draftRef.get();

    if (!draftDoc.exists) {
      return res.status(404).json({ error: 'Draft not found', draftId });
    }

    const draft = draftDoc.data();

    if (!['battle', 'completed'].includes(draft.status)) {
      return res.status(400).json({
        error: `Draft status is '${draft.status}'. Must be 'battle' or 'completed' to backfill.`,
        draftId,
      });
    }

    const dailyData = draft.dailyData || {};

    if (dailyData[dayKey]?.recorded && !isForce) {
      return res.status(409).json({
        error: `Day ${dayNum} already has recorded scores. Use force: true to overwrite.`,
        draftId,
        dayKey,
        recordedBy: dailyData[dayKey].recordedBy,
        recordedAt: dailyData[dayKey].recordedAt,
      });
    }

    // --- Collect all symbols ---
    const symbolSet = new Set();
    for (const player of (draft.players || [])) {
      for (const symbol of (player.picks || [])) {
        symbolSet.add(symbol.toUpperCase());
      }
    }
    const allSymbols = [...symbolSet];

    if (allSymbols.length === 0) {
      return res.status(400).json({ error: 'No player picks found in draft', draftId });
    }

    // --- Fetch EOD prices ---
    const assetType = draft.assetType || 'stocks';
    const { results: eodData, failed: failedSymbols } = await fetchEodPrices(allSymbols, date, assetType);

    if (Object.keys(eodData).length === 0) {
      return res.status(400).json({
        error: `No EOD data returned for any symbol on ${date}. The market may have been closed on this date.`,
        failedSymbols,
      });
    }

    // --- Determine baseline (open) prices ---
    let baselinePrices;
    if (dayNum === 1) {
      baselinePrices = draft.lockedPrices || {};
    } else {
      baselinePrices = dailyData[dayKey]?.openPrices || {};
    }

    // If no baseline prices stored, fall back to EODHD open prices, then lockedPrices
    const effectiveBaseline = {};
    for (const symbol of allSymbols) {
      effectiveBaseline[symbol] =
        baselinePrices[symbol] ||
        baselinePrices[symbol.toLowerCase()] ||
        eodData[symbol]?.open ||
        draft.lockedPrices?.[symbol] ||
        draft.lockedPrices?.[symbol.toLowerCase()] ||
        0;
    }

    // --- Calculate scores ---
    const closeScores = {};
    const closePrices = {};
    const thresholds = draft.thresholds || {};

    for (const player of (draft.players || [])) {
      const playerAssets = [];
      let playerTotalPoints = 0;

      for (const symbol of (player.picks || [])) {
        const upperSymbol = symbol.toUpperCase();

        const openPrice = effectiveBaseline[upperSymbol] || 0;
        const closePrice = eodData[upperSymbol]?.close || 0;
        closePrices[upperSymbol] = closePrice;

        let dailyGain = 0;
        if (openPrice > 0 && closePrice > 0) {
          dailyGain = ((closePrice - openPrice) / openPrice) * 100;
        }

        const threshold = thresholds[upperSymbol]?.threshold || thresholds[symbol]?.threshold || 3.0;
        const assetScore = calculateSnakeDraftAssetScore(dailyGain, threshold);

        playerAssets.push({
          symbol,
          openPrice,
          closePrice,
          gain: parseFloat(dailyGain.toFixed(2)),
          points: assetScore.totalScore,
          baggerBombs: assetScore.baggerBombs,
          busts: assetScore.busts,
          basePoints: assetScore.basePoints,
          baggerBombPoints: assetScore.baggerBombPoints,
          bustPoints: assetScore.bustPoints,
        });

        playerTotalPoints += assetScore.totalScore;
      }

      closeScores[player.odUserId] = {
        totalPoints: parseFloat(playerTotalPoints.toFixed(2)),
        assets: playerAssets,
      };
    }

    // --- Build response ---
    const result = {
      status: isDryRun ? 'dry_run' : 'success',
      draftId,
      dayNumber: dayNum,
      date,
      baselinePrices: effectiveBaseline,
      closePrices,
      scores: closeScores,
      failedSymbols,
      wasForced: isForce && dailyData[dayKey]?.recorded === true,
    };

    if (isDryRun) {
      logInfo('Dry run complete — no data written', { draftId, dayKey });
      return res.status(200).json(result);
    }

    // --- Write to Firestore ---
    const updatedDailyData = { ...dailyData };
    updatedDailyData[dayKey] = {
      ...updatedDailyData[dayKey],
      date,
      closeScores,
      recorded: true,
      recordedAt: new Date().toISOString(),
      recordedBy: 'admin-backfill',
    };

    // If we derived open prices from EODHD and none were stored, persist them
    if (!updatedDailyData[dayKey].openPrices) {
      updatedDailyData[dayKey].openPrices = effectiveBaseline;
    }

    const updatePayload = {
      dailyData: updatedDailyData,
    };

    // Only update currentTradingDay and waiver priority for active battles
    if (draft.status === 'battle') {
      updatePayload.currentTradingDay = dayNum;

      if (draft.claimSystem?.enabled) {
        const waiverPriority = Object.entries(closeScores)
          .sort((a, b) => a[1].totalPoints - b[1].totalPoints)
          .map(([odUserId]) => odUserId);
        updatePayload['claimSystem.currentWaiverPriority'] = waiverPriority;
      }
    }

    await draftRef.update(updatePayload);

    logInfo('Backfill complete', { draftId, dayKey, playerCount: Object.keys(closeScores).length });

    return res.status(200).json(result);
  } catch (err) {
    logError('Backfill error', { error: err.message, stack: err.stack });
    return res.status(500).json({ error: 'Internal server error', message: err.message });
  }
}
