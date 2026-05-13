// api/_utils/buildTechnicalSnapshot.js
// Phase 4 — Technical context snapshot builder.
//
// Given a symbol and the in-memory data maps already loaded by agent-evaluate,
// produce a lossless raw-fields snapshot of the technical context at decision
// time. Snapshots ride on proposalHistory[i].snapshot (co-pilot/manual) and on
// trades[i].snapshot (autopilot, copilot-approved, copilot-expired-auto-execute,
// risk-triggered) so Sprint 2's writers can later reason about what data was
// visible when a swap was proposed, vetoed, or executed.
//
// Pure function. No Firestore reads, no side effects. Missing leaves are null.

/**
 * Build a per-symbol technical snapshot.
 *
 * @param {string} symbol - Ticker
 * @param {Object} maps
 * @param {Object} [maps.momentumData] - { vwap: { [symbol]: { vwap, currentPrice, vwapDeviation, sma20_5m, sessionDate } } }
 * @param {Object} [maps.technicalScoresMap] - stockTechnicalScores doc data keyed by symbol
 * @param {Object} [maps.rankingsMap] - stockRankings entry keyed by symbol
 * @returns {Object} Structured snapshot with all sub-objects present; missing leaves null.
 */
export function buildTechnicalSnapshot(symbol, { momentumData = {}, technicalScoresMap = {}, rankingsMap = {} } = {}) {
  const tech = technicalScoresMap[symbol] || {};
  const ranking = rankingsMap[symbol] || {};
  const intradayEntry = momentumData?.vwap?.[symbol] || {};

  const techFactors = tech.factors || {};
  const techVolumeProfile = tech.volumeProfile || {};

  const rankingTrend = ranking.trend || {};
  const rankingMomentum = ranking.momentum || {};
  const rankingLevels = ranking.levels || {};
  const rankingRecentAction = ranking.recentAction || {};

  return {
    symbol,
    sectorName: ranking.sectorName ?? null,
    capturedAt: new Date().toISOString(),

    trend: {
      shortTerm: rankingTrend.shortTerm ?? null,
      intermediate: rankingTrend.intermediate ?? null,
      longTerm: rankingTrend.longTerm ?? null,
    },

    momentum: {
      rsi: techFactors.rsi ?? null,
      macdAboveSignal: techFactors.macdAboveSignal ?? null,
      macdFreshBullishCross: techFactors.macdFreshBullishCross ?? null,
      macdFreshBearishCross: techFactors.macdFreshBearishCross ?? null,
      macdHistogram: techFactors.macdHistogram ?? null,
      divergence: rankingMomentum.divergence ?? null,
      upDayVolRatio: techFactors.upDayVolRatio ?? null,
    },

    volatility: {
      bbPercentB: tech.bbPercentB ?? null,
      bbUpper: tech.bbUpper ?? null,
      bbLower: tech.bbLower ?? null,
      bBandwidthPercentile: ranking.bBandwidthPercentile ?? null,
      atrPercent: tech.atrPercent ?? null,
    },

    volume: {
      avgVolume: techVolumeProfile.avgVolume ?? null,
      ratio: techVolumeProfile.ratio ?? null,
      tier: techVolumeProfile.tier ?? null,
      nr7Flag: ranking.nr7Flag ?? null,
      dailyRange: ranking.dailyRange ?? null,
    },

    smaStack: {
      aboveSMA20: techFactors.aboveSMA20 ?? null,
      aboveSMA50: techFactors.aboveSMA50 ?? null,
      aboveSMA200: techFactors.aboveSMA200 ?? null,
      sma200_position: ranking.sma200_position ?? tech.sma200_position ?? null,
      distTo52wkHigh: techFactors.distTo52wkHigh ?? null,
    },

    rs: {
      rsPercentile: techFactors.rsPercentile ?? null,
      sectorRSPercentile: techFactors.sectorRSPercentile ?? null,
    },

    levels: {
      nearestSupport: rankingLevels.nearestSupport ?? null,
      nearestResistance: rankingLevels.nearestResistance ?? null,
      distanceToSupportPct: rankingLevels.distanceToSupportPct ?? null,
      distanceToResistancePct: rankingLevels.distanceToResistancePct ?? null,
    },

    pivots: ranking.pivots ?? null,

    recentAction: {
      lastCandlePattern: rankingRecentAction.lastCandlePattern ?? null,
    },

    intraday: {
      vwap: intradayEntry.vwap ?? null,
      currentPrice: intradayEntry.currentPrice ?? null,
      vwapDeviation: intradayEntry.vwapDeviation ?? null,
      sma20_5m: intradayEntry.sma20_5m ?? null,
      sessionDate: intradayEntry.sessionDate ?? null,
    },

    composite: {
      technicalScore: ranking.technicalScore ?? null,
      technicalRank: ranking.technicalRank ?? null,
      sectorTechnicalRank: ranking.sectorTechnicalRank ?? null,
      sectorTechnicalTotal: ranking.sectorTechnicalTotal ?? null,
    },
  };
}
