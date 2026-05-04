// api/cron/voice-layer-cache.js
// Pre-computes market intelligence for the Voice Layer every 15 minutes during market hours.
// Writes portfolioBriefs, scoutAlerts, and marketContext to voiceLayerCache/{battleId}.
// Gemma reads the cache at chat time instead of making live API calls.
//
// Schedule: */15 13,14,15,16,17,18,19,20 * * 1-5

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { FieldValue } from 'firebase-admin/firestore';
import { getMarketState } from '../_utils/marketSchedule.js';
import { findActiveAgentBattles } from '../_utils/agentBattleService.js';

export const config = { maxDuration: 60 };

const LOG_PREFIX = '[VoiceLayerCache]';
const EODHD_BATCH_SIZE = 20;

function log(msg) {
  console.log(`${LOG_PREFIX} ${msg}`);
}

// ============================================
// EODHD BULK PRICE FETCH
// ============================================

async function fetchBulkPrices(symbols) {
  const priceMap = {};
  if (symbols.length === 0) return priceMap;

  const apiKey = process.env.EODHD_API_KEY;
  if (!apiKey) {
    log('WARNING: EODHD_API_KEY not set');
    return priceMap;
  }

  for (let i = 0; i < symbols.length; i += EODHD_BATCH_SIZE) {
    const batch = symbols.slice(i, i + EODHD_BATCH_SIZE);
    const symbolList = batch.map(s => `${s.replace(/\./g, '-')}.US`).join(',');

    try {
      const url = `https://eodhd.com/api/real-time/${symbolList}?api_token=${apiKey}&fmt=json`;
      const response = await fetch(url);

      if (!response.ok) {
        log(`EODHD batch fetch failed with status ${response.status}`);
        continue;
      }

      const data = await response.json();
      const results = Array.isArray(data) ? data : [data];

      for (const item of results) {
        if (item && item.code) {
          const symbol = item.code.replace(/\.US$/i, '');
          priceMap[symbol] = {
            close: item.close,
            previousClose: item.previousClose,
            change: item.change,
            change_p: item.change_p,
            volume: item.volume,
            open: item.open,
            high: item.high,
            low: item.low,
            timestamp: item.timestamp,
          };
        }
      }
    } catch (err) {
      log(`EODHD batch error: ${err.message}`);
    }

    // Rate limit between batches
    if (i + EODHD_BATCH_SIZE < symbols.length) {
      await new Promise(r => setTimeout(r, 200));
    }
  }

  return priceMap;
}

// ============================================
// PORTFOLIO BRIEFS BUILDER
// ============================================

function buildPortfolioBriefs(portfolio, priceMap, rankingsMap, techScoresMap) {
  if (!portfolio) return [];
  const briefs = [];

  ['star', 'core', 'support'].forEach(tier => {
    (portfolio[tier] || []).forEach(stock => {
      if (!stock?.symbol) return;
      const symbol = stock.symbol;
      const price = priceMap[symbol];
      const ranking = rankingsMap[symbol];
      const techScore = techScoresMap[symbol];

      if (!price) return;

      const changePercent = price.change_p || 0;
      const technicalScore = ranking?.technicalScore ?? techScore?.technicalScore ?? 0;
      const technicalRank = ranking?.technicalRank ?? 0;
      const factors = techScore?.factors || {};
      const rsPercentile = factors.rsPercentile ?? 50;

      // Trend summary from SMA alignment
      const aboveSMA200 = factors.aboveSMA200 === true;
      const aboveSMA50 = factors.aboveSMA50 === true;
      const aboveSMA20 = factors.aboveSMA20 === true;

      let trendSummary = '';
      if (aboveSMA200 && aboveSMA50 && aboveSMA20) {
        trendSummary = 'Strong uptrend. Above all major SMAs.';
      } else if (aboveSMA50 && aboveSMA20) {
        trendSummary = 'Moderate uptrend. Above 20 and 50-day SMAs.';
      } else if (aboveSMA20) {
        trendSummary = 'Short-term bounce. Above 20-day SMA only.';
      } else {
        trendSummary = 'Downtrend. Below major SMAs.';
      }

      if (rsPercentile >= 75) trendSummary += ' RS vs SPY rising.';
      else if (rsPercentile <= 25) trendSummary += ' RS vs SPY declining.';

      // Momentum summary from RSI + MACD + volume factor scores
      const rsiContext = techScore?.rsiContext ?? 4;
      const macdScore = techScore?.macdScore ?? 6;
      const volumeConfirmation = techScore?.volumeConfirmation ?? 6;

      let momentumParts = [];
      if (rsiContext >= 7) momentumParts.push('RSI healthy, not extended.');
      else if (rsiContext <= 3) momentumParts.push('RSI weak or overbought.');

      if (macdScore >= 8) momentumParts.push('MACD expanding.');
      else if (macdScore <= 4) momentumParts.push('MACD contracting.');

      if (volumeConfirmation >= 8) {
        const volRatio = factors.upDayVolRatio;
        if (volRatio != null) {
          momentumParts.push(`Volume ${volRatio.toFixed(1)}x avg.`);
        } else {
          momentumParts.push('Volume confirming.');
        }
      } else {
        momentumParts.push('Volume subdued.');
      }

      const momentumSummary = momentumParts.join(' ');

      // Threshold proximity note
      const atrPercentile = ranking?.atrPercentile ?? 0;
      let thresholdNote = null;
      if (atrPercentile > 0.7) {
        thresholdNote = 'High ATR — volatile, could hit thresholds quickly';
      }

      briefs.push({
        symbol,
        tier,
        price: price.close || price.previousClose,
        changePercent: Math.round(changePercent * 100) / 100,
        technicalScore,
        technicalRank,
        rsPercentile: Math.round(rsPercentile),
        trendSummary,
        momentumSummary,
        supportLevel: null,
        resistanceLevel: null,
        thresholdNote,
        atrPercent: Math.round(atrPercentile * 100) / 100,
      });
    });
  });

  return briefs;
}

// ============================================
// BENCH BRIEFS BUILDER
// ============================================

// Bench briefs differ from portfolio briefs: bench positions aren't actively
// scoring, so we drop `tier` (use assetClass instead), drop `thresholdNote`,
// and surface `cooldownUntil`/`cooldownActive` for revolving-door swap-readiness.
// We also retain entries when priceMap data is missing (degraded brief with
// price: null) — relevant for crypto bench, where EODHD US-equity feed has no
// data, and for newly-warm symbols not yet covered by today's bulk pull.
export function buildBenchBriefs(portfolio, priceMap, rankingsMap, techScoresMap, now = new Date()) {
  const bench = portfolio?.bench;
  if (!bench) return [];

  const briefs = [];
  const positions = [
    ...(bench.stocks || []).map(s => ({ asset: s, assetClass: 'stock' })),
    ...(bench.crypto ? [{ asset: bench.crypto, assetClass: 'crypto' }] : []),
  ];

  for (const { asset, assetClass } of positions) {
    if (!asset?.symbol) continue;

    const symbol = asset.symbol;
    const price = priceMap[symbol] || null;
    const ranking = rankingsMap[symbol] || null;
    const techScore = techScoresMap[symbol] || null;
    const factors = techScore?.factors || null;

    const changePercentRaw = price?.change_p;
    const priceValue = price ? (price.close ?? price.previousClose ?? null) : null;

    const technicalScore = ranking?.technicalScore ?? techScore?.technicalScore ?? null;
    const technicalRank = ranking?.technicalRank ?? null;
    const rsPercentileRaw = factors?.rsPercentile;
    const atrPercentileRaw = ranking?.atrPercentile;

    // Trend summary: emit only when factors carry SMA flags
    let trendSummary;
    if (factors && (
      typeof factors.aboveSMA200 === 'boolean' ||
      typeof factors.aboveSMA50 === 'boolean' ||
      typeof factors.aboveSMA20 === 'boolean'
    )) {
      const aboveSMA200 = factors.aboveSMA200 === true;
      const aboveSMA50 = factors.aboveSMA50 === true;
      const aboveSMA20 = factors.aboveSMA20 === true;
      if (aboveSMA200 && aboveSMA50 && aboveSMA20) {
        trendSummary = 'Strong uptrend. Above all major SMAs.';
      } else if (aboveSMA50 && aboveSMA20) {
        trendSummary = 'Moderate uptrend. Above 20 and 50-day SMAs.';
      } else if (aboveSMA20) {
        trendSummary = 'Short-term bounce. Above 20-day SMA only.';
      } else {
        trendSummary = 'Downtrend. Below major SMAs.';
      }
      const rs = factors.rsPercentile;
      if (typeof rs === 'number') {
        if (rs >= 75) trendSummary += ' RS vs SPY rising.';
        else if (rs <= 25) trendSummary += ' RS vs SPY declining.';
      }
    }

    // Momentum summary: emit only when techScore carries the underlying scores
    let momentumSummary;
    if (techScore && (
      techScore.rsiContext != null ||
      techScore.macdScore != null ||
      techScore.volumeConfirmation != null
    )) {
      const parts = [];
      const rsiContext = techScore.rsiContext;
      if (typeof rsiContext === 'number') {
        if (rsiContext >= 7) parts.push('RSI healthy, not extended.');
        else if (rsiContext <= 3) parts.push('RSI weak or overbought.');
      }
      const macdScore = techScore.macdScore;
      if (typeof macdScore === 'number') {
        if (macdScore >= 8) parts.push('MACD expanding.');
        else if (macdScore <= 4) parts.push('MACD contracting.');
      }
      const volumeConfirmation = techScore.volumeConfirmation;
      if (typeof volumeConfirmation === 'number') {
        if (volumeConfirmation >= 8) {
          const volRatio = factors?.upDayVolRatio;
          if (volRatio != null) parts.push(`Volume ${volRatio.toFixed(1)}x avg.`);
          else parts.push('Volume confirming.');
        } else {
          parts.push('Volume subdued.');
        }
      }
      if (parts.length > 0) momentumSummary = parts.join(' ');
    }

    const cooldownUntil = asset.cooldownUntil || null;
    const cooldownActive = cooldownUntil ? new Date(cooldownUntil) > now : false;

    const sector = asset.sector || (assetClass === 'crypto' ? 'Crypto' : 'Unknown');

    const brief = {
      symbol,
      assetClass,
      price: priceValue,
      changePercent: typeof changePercentRaw === 'number'
        ? Math.round(changePercentRaw * 100) / 100
        : null,
      technicalScore,
      technicalRank,
      rsPercentile: typeof rsPercentileRaw === 'number'
        ? Math.round(rsPercentileRaw)
        : null,
      sector,
      cooldownUntil,
      cooldownActive,
      atrPercent: typeof atrPercentileRaw === 'number'
        ? Math.round(atrPercentileRaw * 100) / 100
        : null,
    };
    if (trendSummary) brief.trendSummary = trendSummary;
    if (momentumSummary) brief.momentumSummary = momentumSummary;

    briefs.push(brief);
  }

  return briefs;
}

// ============================================
// SCOUT ALERTS BUILDER
// ============================================

function buildScoutAlerts(watchlist, rankingsMap, techScoresMap, archetype, portfolioSymbols) {
  if (!watchlist?.active) return [];

  const alerts = [];

  watchlist.active.forEach(entry => {
    const symbol = entry?.symbol || entry;
    if (!symbol || typeof symbol !== 'string') return;
    if (portfolioSymbols.has(symbol)) return;

    const ranking = rankingsMap[symbol];
    const techScore = techScoresMap[symbol];
    if (!ranking && !techScore) return;

    const factors = techScore?.factors || {};
    const rsPercentile = factors.rsPercentile ?? 50;
    const technicalScore = ranking?.technicalScore ?? techScore?.technicalScore ?? 0;
    const volumeConfirmation = techScore?.volumeConfirmation ?? 0;

    // RS breakout: high RS + high technical score
    if (rsPercentile >= 85 && technicalScore >= 75) {
      alerts.push({
        symbol,
        type: 'rs_breakout',
        headline: `${symbol} relative strength breakout — RS percentile ${Math.round(rsPercentile)}`,
        detail: `Technical score ${technicalScore}, rank #${ranking?.technicalRank ?? '?'}. ${factors.aboveSMA50 ? 'Above major SMAs.' : ''} ${volumeConfirmation >= 8 ? 'Volume confirming.' : ''}`.trim(),
        relevance: 'momentum_chaser',
      });
    }

    // Volume surge
    if (volumeConfirmation >= 10) {
      alerts.push({
        symbol,
        type: 'volume_surge',
        headline: `${symbol} unusual volume — volume score ${volumeConfirmation}/12`,
        detail: `Technical score ${technicalScore}. ${rsPercentile >= 60 ? 'RS supportive.' : 'RS neutral or weak.'} ${(techScore?.macdScore ?? 0) >= 8 ? 'MACD expanding.' : ''}`.trim(),
        relevance: 'all',
      });
    }

    // Game fit: high BaggerBomb fit
    if (ranking?.baggerBombFit >= 85 && ranking?.baggerBombRank <= 15) {
      alerts.push({
        symbol,
        type: 'game_fit',
        headline: `${symbol} BaggerBomb Fit #${ranking.baggerBombRank} — high scoring potential`,
        detail: `Composite score ${ranking.compositeScore ?? 'N/A'}. ATR percentile ${Math.round((ranking.atrPercentile || 0) * 100)}%.`,
        relevance: 'all',
      });
    }
  });

  // Filter by archetype relevance
  const filtered = alerts.filter(a =>
    a.relevance === 'all' || a.relevance === archetype
  );

  // Cap at 5
  return filtered.slice(0, 5);
}

// ============================================
// MARKET CONTEXT BUILDER
// ============================================

function buildMarketContextBlock(mc) {
  if (!mc) {
    return {
      regime: 'unknown',
      regimeDetail: 'Market context unavailable',
      spyChange: null,
      vixLevel: null,
      volatilityRegime: 'unknown',
      breadthTier: 'unknown',
      breadthDetail: '',
      topSector: 'N/A',
      topSectorChange: null,
      worstSector: 'N/A',
      worstSectorChange: null,
      yieldRegime: 'unknown',
    };
  }

  return {
    regime: mc.regime || 'unknown',
    regimeDetail: mc.regimeDetail || '',
    spyChange: mc.spy?.changePercent ?? null,
    vixLevel: null, // No VIX data in codebase — volatilityRegime used as proxy
    volatilityRegime: mc.volatilityRegime || 'unknown',
    breadthTier: mc.breadthTier || 'unknown',
    breadthDetail: mc.breadthQuality?.detail || '',
    topSector: mc.topSectorToday || 'N/A',
    topSectorChange: mc.topSectorChange ?? null,
    worstSector: mc.worstSectorToday || 'N/A',
    worstSectorChange: mc.worstSectorChange ?? null,
    yieldRegime: mc.yields?.regime || 'unknown',
  };
}

// ============================================
// HANDLER
// ============================================

export default async function handler(req, res) {
  // 1. Auth
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const authHeader = req.headers.authorization;
  if (!isVercelCron && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const startTime = Date.now();

  // 2. Time guard — only run during market hours
  const marketState = getMarketState();
  if (!['OPEN', 'PRE_MARKET'].includes(marketState.state)) {
    return res.status(200).json({ skipped: true, reason: 'market_closed', state: marketState.state });
  }

  try {
    const db = getFirebaseAdmin();

    // 3. Query active agent battles
    const activeBattles = await findActiveAgentBattles(db);
    if (activeBattles.length === 0) {
      return res.status(200).json({ skipped: true, reason: 'no_active_battles', duration: Date.now() - startTime });
    }
    log(`Found ${activeBattles.length} active battle(s)`);

    // 4. Collect all unique symbols across all battles
    // allSymbols is the stock-only set used for EODHD price fetch + techScores getAll.
    // Bench crypto symbols are intentionally excluded — EODHD US-equity feed cannot
    // resolve them, and stockTechnicalScores docs don't exist for crypto. Crypto
    // bench positions are still surfaced in benchBriefs[] via degraded briefs.
    const allSymbols = new Set();
    const battlePortfolioSymbols = new Map();
    const benchStockSymbols = new Set();

    activeBattles.forEach(battle => {
      const portfolioSyms = new Set();
      const portfolio = battle.portfolio || {};
      ['star', 'core', 'support'].forEach(tier => {
        (portfolio[tier] || []).forEach(s => {
          if (s?.symbol) {
            allSymbols.add(s.symbol);
            portfolioSyms.add(s.symbol);
          }
        });
      });
      battlePortfolioSymbols.set(battle.id, portfolioSyms);

      (battle.watchlist?.active || []).forEach(entry => {
        const sym = entry?.symbol || entry;
        if (sym && typeof sym === 'string') allSymbols.add(sym);
      });

      // Bench stocks join the EODHD/techScores fetch; crypto bench is skipped.
      (portfolio.bench?.stocks || []).forEach(s => {
        if (s?.symbol) {
          allSymbols.add(s.symbol);
          benchStockSymbols.add(s.symbol);
        }
      });
    });

    log(`Collected ${allSymbols.size} unique symbols (${benchStockSymbols.size} from bench)`);

    // 5. Parallel data fetching: EODHD prices + Firestore reads
    const symbolArray = [...allSymbols];
    const techScoreRefs = symbolArray.map(s => db.collection('stockTechnicalScores').doc(s));

    const [priceMap, marketContextDoc, rankingsDoc, ...techScoreDocs] = await Promise.all([
      fetchBulkPrices(symbolArray),
      db.collection('indexIntelligence').doc('marketContext').get(),
      db.collection('indexIntelligence').doc('stockRankings').get(),
      ...(techScoreRefs.length > 0 ? [db.getAll(...techScoreRefs)] : [[]]),
    ]);

    // Flatten techScoreDocs (getAll returns an array, but Promise.all wraps it)
    const techScoreResults = techScoreDocs.flat();

    // 6. Build lookup maps
    const rankingsMap = {};
    if (rankingsDoc.exists) {
      (rankingsDoc.data().stocks || []).forEach(s => { rankingsMap[s.symbol] = s; });
    }

    const techScoresMap = {};
    techScoreResults.forEach(doc => {
      if (doc.exists) techScoresMap[doc.id] = doc.data();
    });

    const marketContext = marketContextDoc.exists ? marketContextDoc.data() : null;

    log(`Data loaded — prices: ${Object.keys(priceMap).length}, rankings: ${Object.keys(rankingsMap).length}, techScores: ${Object.keys(techScoresMap).length}`);

    // 7. Process each battle and write cache
    let written = 0;
    const writeBatch = db.batch();

    for (const battle of activeBattles) {
      const archetype = battle.agentContext?.archetype || 'unknown';
      const portfolioSyms = battlePortfolioSymbols.get(battle.id) || new Set();

      const portfolioBriefs = buildPortfolioBriefs(battle.portfolio, priceMap, rankingsMap, techScoresMap);
      const benchBriefs = buildBenchBriefs(battle.portfolio, priceMap, rankingsMap, techScoresMap);
      const scoutAlerts = buildScoutAlerts(battle.watchlist, rankingsMap, techScoresMap, archetype, portfolioSyms);
      const mcBlock = buildMarketContextBlock(marketContext);

      const cacheRef = db.collection('voiceLayerCache').doc(battle.id);
      writeBatch.set(cacheRef, {
        battleId: battle.id,
        agentId: battle.agentId || null,
        portfolioBriefs,
        benchBriefs,
        scoutAlerts,
        marketContext: mcBlock,
        dataFreshness: {
          prices: 'rest_15min',
          technicals: 'daily',
          rankings: 'daily',
          marketContext: 'daily',
        },
        forgeSeeds: null,
        updatedAt: FieldValue.serverTimestamp(),
      });
      written++;
    }

    await writeBatch.commit();
    const duration = Date.now() - startTime;
    log(`Done — wrote ${written} cache doc(s) in ${duration}ms`);

    // 8. Return summary
    return res.status(200).json({
      success: true,
      battlesProcessed: written,
      totalSymbols: allSymbols.size,
      pricesFetched: Object.keys(priceMap).length,
      duration,
    });
  } catch (err) {
    const duration = Date.now() - startTime;
    log(`ERROR: ${err.message}`);
    console.error(err);
    return res.status(500).json({ error: err.message, duration });
  }
}
