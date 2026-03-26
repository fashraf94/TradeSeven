// api/_utils/agentTriggerGate.js
// Determines whether to wake Haiku for a mid-battle evaluation.
// Returns { shouldEvaluate: boolean, triggers: [] }

import { flattenPortfolioServer, flattenBenchServer } from './agentScoring.js';

/**
 * Evaluate whether triggers warrant a Haiku call.
 *
 * @param {Object} battle - Full agentBattle document
 * @param {Object[]} assetScores - Scored active assets (from calculateAssetScoreServer)
 * @param {Object} prices - { symbol: { current, previousClose, change, changePercent } }
 * @param {Object[]} news - FantasyTimes stories matching active tickers (or null)
 * @param {Object} [momentumData] - Optional intraday momentum data
 * @param {Object} [momentumData.vwap] - { symbol: { vwap, currentPrice, vwapDeviation } }
 * @param {Object} [momentumData.rankings] - { symbol: { bBandwidthPercentile, nr7Flag, dailyRange } }
 * @returns {{ shouldEvaluate: boolean, triggers: Array<{ type: string, detail: string }> }}
 */
export function evaluateTriggers(battle, assetScores, prices, news, momentumData) {
  const triggers = [];
  const evaluations = battle.evaluations || [];

  // ---- FORCED TRIGGERS (always fire) ----

  // First evaluation of the battle
  if (evaluations.length === 0) {
    triggers.push({ type: 'forced_open', detail: 'First evaluation of the battle.' });
    return { shouldEvaluate: true, triggers };
  }

  // Final hour detection
  const phase = computePhaseFromBattle(battle);
  if (phase === 'FINAL_HOUR') {
    triggers.push({ type: 'forced_close', detail: 'Final evaluation before battle ends.' });
    return { shouldEvaluate: true, triggers };
  }

  // ---- CONDITIONAL TRIGGERS ----

  // Price drop: active asset down > 0.5x ATR from entry
  for (const score of assetScores) {
    if (score.multiplier <= -0.5) {
      triggers.push({
        type: 'price_drop',
        detail: `${score.symbol} down ${Math.abs(score.priceChange).toFixed(2)}% from entry (${score.multiplier.toFixed(2)}x ATR — approaching Bust at -1.0x)`,
      });
    }
  }

  // Threshold proximity: asset within 0.2x ATR of a bonus or penalty threshold
  for (const score of assetScores) {
    const mult = score.multiplier;

    // Negative thresholds: approaching penalties
    const penaltyThresholds = [
      { name: 'Bust', level: -1.0 },
      { name: 'Crash', level: -1.5 },
      { name: 'Meltdown', level: -2.0 },
    ];
    for (const threshold of penaltyThresholds) {
      const distance = mult - threshold.level;
      if (distance > 0 && distance <= 0.2) {
        triggers.push({
          type: 'threshold_proximity',
          detail: `${score.symbol} at ${mult.toFixed(2)}x ATR — only ${distance.toFixed(2)}x from ${threshold.name} (${threshold.level}x)`,
        });
      }
    }

    // Positive thresholds: approaching bonuses
    const bonusThresholds = [
      { name: 'BaggerBomb (+15 pts)', level: 1.0, badge: 'bagger' },
      { name: 'DoubleBagger (+30 pts)', level: 1.5, badge: 'doubleBagger' },
      { name: 'TenBagger (+50 pts)', level: 2.0, badge: 'tenBagger' },
    ];
    for (const threshold of bonusThresholds) {
      // Approaching from below, within 0.2x ATR, and badge not already earned
      if (mult > 0 && mult < threshold.level && mult >= threshold.level - 0.2) {
        if (!score.badges?.includes(threshold.badge)) {
          triggers.push({
            type: 'threshold_proximity',
            detail: `${score.symbol} at +${mult.toFixed(2)}x ATR — approaching ${threshold.name} at +${threshold.level}x`,
          });
        }
      }
    }
  }

  // Bench outperformance: bench stock up > 0.5x ATR today while an active asset is flat/down
  const benchAssets = flattenBenchServer(battle.portfolio?.bench);
  const hasWeakActive = assetScores.some(s => s.priceChange <= 0);

  if (hasWeakActive) {
    for (const benchAsset of benchAssets) {
      // Skip assets on cooldown
      if (benchAsset.cooldownUntil && new Date(benchAsset.cooldownUntil) > new Date()) continue;

      const benchPrice = prices[benchAsset.symbol];
      if (!benchPrice) continue;

      const dailyChangePct = benchPrice.changePercent || 0;
      const benchATR = benchAsset.baseATR || 2.5;
      const benchATRMult = dailyChangePct / benchATR;

      if (benchATRMult >= 0.5) {
        triggers.push({
          type: 'bench_outperformance',
          detail: `${benchAsset.symbol} up ${dailyChangePct.toFixed(2)}% today (${benchATRMult.toFixed(2)}x ATR from daily open)`,
        });
      }
    }
  }

  // Intraday momentum: VWAP deviation (price significantly above/below VWAP)
  if (momentumData?.vwap) {
    for (const score of assetScores) {
      const vwapInfo = momentumData.vwap[score.symbol];
      if (!vwapInfo || vwapInfo.vwapDeviation == null) continue;

      const dev = vwapInfo.vwapDeviation;
      // Trigger if price deviates more than 1.5% from VWAP in either direction
      if (Math.abs(dev) >= 1.5) {
        const direction = dev > 0 ? 'above' : 'below';
        triggers.push({
          type: 'vwap_deviation',
          detail: `${score.symbol} trading ${Math.abs(dev).toFixed(2)}% ${direction} VWAP ($${vwapInfo.vwap.toFixed(2)}) — ${dev > 0 ? 'bullish momentum' : 'bearish momentum'}`,
        });
      }
    }
  }

  // Intraday momentum: Bollinger bandwidth squeeze (low percentile = contraction → potential breakout)
  if (momentumData?.rankings) {
    for (const score of assetScores) {
      const rankInfo = momentumData.rankings[score.symbol];
      if (!rankInfo) continue;

      // Bandwidth squeeze: below 20th percentile signals compression
      if (rankInfo.bBandwidthPercentile != null && rankInfo.bBandwidthPercentile <= 20) {
        triggers.push({
          type: 'bandwidth_squeeze',
          detail: `${score.symbol} Bollinger bandwidth at ${rankInfo.bBandwidthPercentile}th percentile — volatility squeeze, potential breakout imminent`,
        });
      }

      // NR7 flag: narrowest range of 7 days
      if (rankInfo.nr7Flag) {
        triggers.push({
          type: 'nr7_contraction',
          detail: `${score.symbol} NR7 detected — narrowest daily range in 7 days (range: $${(rankInfo.dailyRange || 0).toFixed(2)}), breakout setup`,
        });
      }
    }
  }

  // News catalyst: FantasyTimes stories mentioning active tickers
  if (news && news.length > 0) {
    const activeSymbols = new Set(assetScores.map(s => s.symbol));
    for (const story of news) {
      const matchingTickers = (story.tickers || []).filter(t => activeSymbols.has(t));
      if (matchingTickers.length > 0) {
        const ago = getTimeAgo(story.publishedAt);
        triggers.push({
          type: 'news_catalyst',
          detail: `[${story.reporterName || story.reporter}, ${ago}, ${story.sentiment || 'neutral'}] "${story.headline}" | Tickers: ${matchingTickers.join(', ')}`,
        });
      }
    }
  }

  return {
    shouldEvaluate: triggers.length > 0,
    triggers,
  };
}

/**
 * Query FantasyTimes stories from the last 2 hours that mention any of the given symbols.
 */
export async function fetchRecentNews(db, symbols) {
  if (!symbols || symbols.length === 0) return [];

  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const stories = [];

  // Firestore array-contains only supports one value per query,
  // so we query for each symbol and deduplicate
  const seen = new Set();
  for (const symbol of symbols.slice(0, 7)) {
    try {
      const snap = await db
        .collection('fantasyTimesStories')
        .where('tickers', 'array-contains', symbol)
        .where('publishedAt', '>', twoHoursAgo)
        .orderBy('publishedAt', 'desc')
        .limit(2)
        .get();

      for (const doc of snap.docs) {
        if (!seen.has(doc.id)) {
          seen.add(doc.id);
          stories.push({ id: doc.id, ...doc.data() });
        }
      }
    } catch (err) {
      // Silently skip — missing index or query error shouldn't block evaluation
      console.warn(`[TriggerGate] News query failed for ${symbol}:`, err.message);
    }
  }

  return stories;
}

// ==================== HELPERS ====================

function computePhaseFromBattle(battle) {
  const timing = battle.timing;
  if (!timing?.tradingDays?.length) return 'MID';

  const now = new Date();
  const lastDay = timing.tradingDays[timing.tradingDays.length - 1];

  // Parse last trading day close time (16:00 ET)
  const closeHour = parseInt((timing.localClose || '16:00').split(':')[0], 10);
  const closeMin = parseInt((timing.localClose || '16:00').split(':')[1], 10);

  // Get current ET time
  const etNow = new Date(now.toLocaleString('en-US', { timeZone: timing.timezone || 'America/New_York' }));
  const etDateStr = `${etNow.getFullYear()}-${String(etNow.getMonth() + 1).padStart(2, '0')}-${String(etNow.getDate()).padStart(2, '0')}`;

  // Check if we're on the last trading day within the final hour
  if (etDateStr === lastDay) {
    const minutesUntilClose = (closeHour * 60 + closeMin) - (etNow.getHours() * 60 + etNow.getMinutes());
    if (minutesUntilClose <= 60 && minutesUntilClose > 0) return 'FINAL_HOUR';
  }

  // Calculate overall progress
  const totalDays = timing.tradingDays.length;
  const currentDayIndex = timing.tradingDays.indexOf(etDateStr);
  if (currentDayIndex === -1) {
    // Not a trading day — use last known position
    return 'MID';
  }

  const dayProgress = currentDayIndex / totalDays;
  // Add intraday progress
  const openHour = parseInt((timing.localOpen || '09:30').split(':')[0], 10);
  const openMin = parseInt((timing.localOpen || '09:30').split(':')[1], 10);
  const marketMinutes = (closeHour * 60 + closeMin) - (openHour * 60 + openMin);
  const elapsedMinutes = (etNow.getHours() * 60 + etNow.getMinutes()) - (openHour * 60 + openMin);
  const intradayProgress = Math.max(0, Math.min(1, elapsedMinutes / marketMinutes));
  const totalProgress = (currentDayIndex + intradayProgress) / totalDays;

  if (totalProgress < 0.4) return 'EARLY';
  if (totalProgress < 0.7) return 'MID';
  return 'LATE';
}

function getTimeAgo(timestamp) {
  if (!timestamp) return 'unknown';
  const ts = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  const diffMs = Date.now() - ts.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHours = Math.round(diffMin / 60);
  return `${diffHours}h ago`;
}
