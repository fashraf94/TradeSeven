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
import {
  detectRedZone,
  isSwapLocked,
  getBadgesFromHistoryServer,
} from '../_utils/agentScoring.js';
// FantasyTimes Wire newsLine (Phase 2 N1.2). The Wire is reached ONLY through
// the AgentSafeWireEntry boundary — never wireReader directly (N1.1; the
// import-graph test enforces it). Flag resolution goes through getWireFlags
// so the writes-dependency rule holds (newsline requires writes).
import { getWireFlags } from '../_utils/wireFlags.js';
import { resolveWireMarketDate, priorTradingSessions } from '../_utils/wireCalendar.js';
import { fetchAgentSafeWireDays, resolveAgentSafeEntries } from '../_utils/agentSafeWireEntry.js';

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

// Tier 0 Item 4: threshold proximity wrapper.
// Active positions receive a `thresholdProximity` sub-field exposing
// detectRedZone / isSwapLocked output, plus an `existingBadges` sibling field.
// Bench positions are intentionally excluded (no scoring semantics).
//
// `thresholdProximity` is OMITTED entirely (graceful degradation) when baseATR
// is missing or invalid — matches Item 1's prose-omission convention.
// `existingBadges` is ALWAYS emitted (defaults to []) so the agent can always
// reason about already-earned badges.
//
// Multiplier formula uses thresholdPriceChange (close vs previousClose)
// preference per canonical agentScoring.js:148-152 — the cache cron's
// price.change_p IS thresholdPriceChange, so this is zero-cost. Falls back to
// entry-relative change when thresholdPriceChange is unavailable. Short
// positions negate the multiplier (matches canonical lines 117-129).
export function buildPortfolioBriefs(portfolio, priceMap, rankingsMap, techScoresMap, thresholdHistory = {}, startingPrices = {}, intradayMomentumMap = {}) {
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
      // F3.1: null (not 0) is the missing-data sentinel for numeric metrics
      // so renderers can distinguish "no data" from legitimate bottom-decile
      // values. Matches the bench-brief writer convention (see line ~287)
      // and buildTechnicalSnapshot.
      const technicalScore = ranking?.technicalScore ?? techScore?.technicalScore ?? null;
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

      // Threshold proximity note (qualitative, ATR-rank-based — distinct from
      // quantitative thresholdProximity below). F3.1: null sentinel — the
      // `> 0.7` predicate is false for null, so the note correctly omits.
      const atrPercentile = ranking?.atrPercentile ?? null;
      let thresholdNote = null;
      if (atrPercentile != null && atrPercentile > 0.7) {
        thresholdNote = 'High ATR — volatile, could hit thresholds quickly';
      }

      // Phase 5A field propagation: surface sector context, levels, and
      // signals into the brief so buildHeaderLine / buildLevelsLine /
      // buildSignalsLine fire. Boolean flags use ?? false to match the
      // upstream writer (factors.macdFresh*Cross / ranking.nr7Flag), keeping
      // the renderer's strict `=== true` semantics defended. Source paths
      // verified against compute-index-intelligence.js stockRankings and
      // stockTechnicalScores writers (see Phase 5B-prep discovery report).
      const rankingLevels = ranking?.levels || techScore?.levels || null;
      const rankingMomentum = ranking?.momentum || techScore?.momentum || null;
      const rankingRecent = ranking?.recentAction || techScore?.recentAction || null;

      const brief = {
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
        atrPercent: typeof atrPercentile === 'number'
          ? Math.round(atrPercentile * 100) / 100
          : null,
        // Header sector context (buildHeaderLine reads brief.sector / sectorTechnicalTotal)
        sector: ranking?.sectorName ?? stock.sector ?? null,
        sectorTechnicalTotal: ranking?.sectorTechnicalTotal ?? null,
        // Levels (buildLevelsLine — gated on ±10% / ±5% thresholds in the helper)
        nearestSupport: rankingLevels?.nearestSupport ?? null,
        nearestResistance: rankingLevels?.nearestResistance ?? null,
        distanceToSupportPct: rankingLevels?.distanceToSupportPct ?? null,
        distanceToResistancePct: rankingLevels?.distanceToResistancePct ?? null,
        distTo52wkHigh: factors?.distTo52wkHigh ?? null,
        // Signals (buildSignalsLine — strict-bool flags; divergence is string-union)
        nr7Flag: ranking?.nr7Flag ?? techScore?.nr7Flag ?? false,
        macdFreshBullishCross: factors?.macdFreshBullishCross ?? false,
        macdFreshBearishCross: factors?.macdFreshBearishCross ?? false,
        divergence: rankingMomentum?.divergence ?? null,
        lastCandlePattern: rankingRecent?.lastCandlePattern ?? null,
      };

      // Tier 0 Item 4: thresholdProximity + existingBadges
      const baseATR = stock.baseATR;
      const history = thresholdHistory[symbol] || {};
      brief.existingBadges = getBadgesFromHistoryServer(history);

      if (baseATR && baseATR > 0) {
        // Canonical formula (agentScoring.js:148-152): prefer thresholdPriceChange
        // (close vs previousClose) over priceChange (close vs entry).
        const thresholdPriceChange = (typeof price.change_p === 'number' && isFinite(price.change_p))
          ? price.change_p
          : null;
        const entryPrice = stock.swapPrice ?? startingPrices[symbol];
        const currentPrice = price.close ?? price.previousClose;
        const priceChangeFromEntry = (entryPrice && currentPrice)
          ? ((currentPrice - entryPrice) / entryPrice) * 100
          : null;
        const effectiveThresholdChange = thresholdPriceChange != null
          ? thresholdPriceChange
          : priceChangeFromEntry;

        if (effectiveThresholdChange != null && isFinite(effectiveThresholdChange)) {
          // Short positions negate the multiplier (canonical lines 117-129).
          const isShort = stock.direction === 'short';
          const signedChange = isShort ? -effectiveThresholdChange : effectiveThresholdChange;
          const currentMultiplier = signedChange / baseATR;

          const redZoneRaw = detectRedZone(currentMultiplier, brief.existingBadges);
          const swapLock = isSwapLocked(currentMultiplier, baseATR);

          brief.thresholdProximity = {
            currentMultiplier,
            baseATR,
            redZone: redZoneRaw ? {
              targetThreshold: redZoneRaw.targetThreshold,
              targetMultiple: redZoneRaw.targetMultiple,
              direction: redZoneRaw.direction,
              zoneProgressPercent: redZoneRaw.progress, // RENAMED for prompt clarity
            } : null,
            swapLock,
          };
        }
      }

      // Phase 3: intraday momentum overlay (VWAP, 5m SMA20).
      // Sourced from agent-evaluate cron, which fetches intraday 5m candles for
      // active-portfolio symbols only (star/core/support — NOT bench), computes
      // VWAP + 5m-SMA20, and persists to cronState.intradayMomentum on every
      // flush. fetchIntradayBatch routes crypto correctly via formatEODHDSymbol
      // (`-USD.CC` endpoint) when crypto sits in an active tier; bench crypto
      // is handled by buildBenchBriefs separately and is unaffected here.
      // Symbols absent from the map (e.g., crypto bench placeholders, fetch
      // failures) get an explicit null sentinel so downstream readers can
      // distinguish "no data this cycle" from "field missing".
      brief.intraday = intradayMomentumMap[symbol] || null;

      briefs.push(brief);
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

    // Phase 5A field propagation — same shape as portfolio brief so the
    // shared helpers (buildLevelsLine, buildSignalsLine, buildHeaderLine
    // sector context) fire identically for both brief types.
    const rankingLevels = ranking?.levels || techScore?.levels || null;
    const rankingMomentum = ranking?.momentum || techScore?.momentum || null;
    const rankingRecent = ranking?.recentAction || techScore?.recentAction || null;

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
      // Header sector context (buildHeaderLine).
      // `sector` is already populated from asset.sector above; sectorTechnicalTotal
      // comes from the rankings doc.
      sectorTechnicalTotal: ranking?.sectorTechnicalTotal ?? null,
      // Levels (buildLevelsLine).
      nearestSupport: rankingLevels?.nearestSupport ?? null,
      nearestResistance: rankingLevels?.nearestResistance ?? null,
      distanceToSupportPct: rankingLevels?.distanceToSupportPct ?? null,
      distanceToResistancePct: rankingLevels?.distanceToResistancePct ?? null,
      distTo52wkHigh: factors?.distTo52wkHigh ?? null,
      // Signals (buildSignalsLine).
      nr7Flag: ranking?.nr7Flag ?? techScore?.nr7Flag ?? false,
      macdFreshBullishCross: factors?.macdFreshBullishCross ?? false,
      macdFreshBearishCross: factors?.macdFreshBearishCross ?? false,
      divergence: rankingMomentum?.divergence ?? null,
      lastCandlePattern: rankingRecent?.lastCandlePattern ?? null,
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

export function buildScoutAlerts(watchlist, rankingsMap, techScoresMap, archetype, portfolioSymbols) {
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
    // F3.1: null sentinel for missing technical score (matches portfolio
    // brief writer). Filter predicates use `typeof === 'number'` to
    // explicitly exclude null rather than relying on `>= 75` being false
    // for null.
    const technicalScore = ranking?.technicalScore ?? techScore?.technicalScore ?? null;
    const volumeConfirmation = techScore?.volumeConfirmation ?? 0;

    // RS breakout: high RS + high technical score
    if (rsPercentile >= 85 && typeof technicalScore === 'number' && technicalScore >= 75) {
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
      const scoreClause = typeof technicalScore === 'number'
        ? `Technical score ${technicalScore}. `
        : '';
      alerts.push({
        symbol,
        type: 'volume_surge',
        headline: `${symbol} unusual volume — volume score ${volumeConfirmation}/12`,
        detail: `${scoreClause}${rsPercentile >= 60 ? 'RS supportive.' : 'RS neutral or weak.'} ${(techScore?.macdScore ?? 0) >= 8 ? 'MACD expanding.' : ''}`.trim(),
        relevance: 'all',
      });
    }

    // Game fit: high BaggerBomb fit
    if (ranking?.baggerBombFit >= 85 && ranking?.baggerBombRank <= 15) {
      const atrClause = typeof ranking?.atrPercentile === 'number'
        ? `ATR percentile ${Math.round(ranking.atrPercentile * 100)}%.`
        : 'ATR percentile N/A.';
      alerts.push({
        symbol,
        type: 'game_fit',
        headline: `${symbol} BaggerBomb Fit #${ranking.baggerBombRank} — high scoring potential`,
        detail: `Composite score ${ranking.compositeScore ?? 'N/A'}. ${atrClause}`,
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
// WIRE NEWSLINE PACKER (Phase 2 N1.2)
// ============================================

// The exact ceiling: 240 UTF-16 code units (JS string length) over the FULLY
// assembled line including per-item recency prefixes (V1.2 N1.2, Amendment A).
export const NEWSLINE_MAX_LENGTH = 240;

/**
 * Pack one symbol's guard-passing DTOs into a newsLine string. Pure.
 *
 * Rules (V1.2 N1.2, F-M9, Amendment A — all locked):
 *   • whole digests only, never slice a unit;
 *   • newest first — callers pass dates newest-first ([today, prior]) and
 *     persisted within-day order is chronological (M9 append order), so
 *     newest-first = reverse within each date group;
 *   • per-item recency prefix ('Today: ' / 'Prior: '), bounded by
 *     construction;
 *   • two units if both fit whole under the ceiling, else one;
 *   • the over-ceiling branch FAILS CLOSED — emit nothing and log (the
 *     "bounded by construction" claim is dead: measured renderer max is
 *     363 chars). Never emit over ceiling, never fall back to an older
 *     unit when the newest alone exceeds the ceiling — a line that hides
 *     the newest story while rendering an older one misrepresents recency.
 *
 * @param {Array<{ marketDate: string, dto: object }>} resolved — from
 *   resolveAgentSafeEntries, dates scanned newest-first
 * @param {string} todayDate — the current Wire market date
 * @returns {string|null}
 */
export function packNewsLine(resolved, todayDate) {
  if (!Array.isArray(resolved) || resolved.length === 0) return null; // no coverage → no line

  // Newest first: keep date groups in scan order (newest date first),
  // reverse within each group (append order is chronological).
  const byDate = new Map();
  for (const item of resolved) {
    if (!byDate.has(item.marketDate)) byDate.set(item.marketDate, []);
    byDate.get(item.marketDate).push(item);
  }
  const newestFirst = [];
  for (const group of byDate.values()) newestFirst.push(...group.reverse());

  const units = newestFirst
    .filter((item) => typeof item.dto?.digest === 'string' && item.dto.digest.length > 0)
    .map((item) => `${item.marketDate === todayDate ? 'Today: ' : 'Prior: '}${item.dto.digest}`);
  if (units.length === 0) return null;

  if (units.length >= 2) {
    const two = `${units[0]} | ${units[1]}`;
    if (two.length <= NEWSLINE_MAX_LENGTH) return two;
  }
  if (units[0].length <= NEWSLINE_MAX_LENGTH) return units[0];

  // Over-ceiling single unit: fail closed (Amendment A; P2-42).
  log(`newsLine over ceiling (${units[0].length} > ${NEWSLINE_MAX_LENGTH} code units) — no line emitted`);
  return null;
}

/**
 * Build the per-symbol newsLines map for one battle. Pure over fetched days.
 * Symbols = portfolio (star/core/support) + bench stocks + bench crypto
 * (N1.2 "per portfolio + bench symbol" — watchlist is NOT included). A
 * symbol with no guard-passing coverage gets NO key (no coverage → no line).
 */
export function buildNewsLinesForSymbols(wireDays, wireDates, symbols, todayDate) {
  const newsLines = {};
  if (!wireDays) return newsLines;
  for (const symbol of symbols) {
    const resolved = resolveAgentSafeEntries(wireDays, wireDates, symbol);
    const line = packNewsLine(resolved, todayDate);
    if (line) newsLines[symbol] = line;
  }
  return newsLines;
}

// ============================================
// MARKET CONTEXT BUILDER
// ============================================

export function buildMarketContextBlock(mc) {
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
      leadershipSignal: 'mixed',
      divergenceSignal: 'none',
      breadthQualitySignal: null,
      breadthSpyVsRspGap: null,
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
    leadershipSignal: mc.leadership || 'mixed',
    divergenceSignal: mc.divergence?.type || 'none',
    breadthQualitySignal: mc.breadthQuality?.signal || null,
    breadthSpyVsRspGap: typeof mc.breadthQuality?.spyVsRsp === 'number'
      ? mc.breadthQuality.spyVsRsp
      : null,
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

    // ── FantasyTimes Wire newsLine window (Phase 2 N1.2) ─────────────────
    // ONE fetch per tick (today + prior session), flag-gated. Flag-off:
    // this block never runs — zero Wire reads and a byte-identical cache
    // doc (P2-1). A Wire failure degrades to no lines, never a dead tick
    // (P2-6): Gemma losing coverage context must not cost the briefs.
    const wireFlags = getWireFlags();
    let wireDays = null;
    let wireDates = null;
    let wireToday = null;
    if (wireFlags.newslineEnabled) {
      try {
        wireToday = resolveWireMarketDate(new Date());
        const [priorSession] = priorTradingSessions(wireToday, 1);
        wireDates = [wireToday, priorSession]; // newest first — packer order contract
        wireDays = await fetchAgentSafeWireDays(db, wireDates);
      } catch (err) {
        log(`Wire newsLine fetch failed — tick continues without lines: ${err.message}`);
        wireDays = null;
      }
    }

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

      const intradayMomentumMap = battle.cronState?.intradayMomentum || {};
      const portfolioBriefs = buildPortfolioBriefs(
        battle.portfolio,
        priceMap,
        rankingsMap,
        techScoresMap,
        battle.thresholdHistory || {},
        battle.startingPrices || {},
        intradayMomentumMap,
      );
      const benchBriefs = buildBenchBriefs(battle.portfolio, priceMap, rankingsMap, techScoresMap);
      const scoutAlerts = buildScoutAlerts(battle.watchlist, rankingsMap, techScoresMap, archetype, portfolioSyms);
      const mcBlock = buildMarketContextBlock(marketContext);

      // newsLines (N1.2): portfolio + bench symbols for THIS battle. The
      // field is entirely ABSENT flag-off — spreading nothing keeps the
      // cache doc field-wise byte-identical (P2-1's photograph).
      let newsLines = null;
      if (wireFlags.newslineEnabled) {
        const battleSymbols = new Set(portfolioSyms);
        (battle.portfolio?.bench?.stocks || []).forEach((s) => {
          if (s?.symbol) battleSymbols.add(s.symbol);
        });
        if (battle.portfolio?.bench?.crypto?.symbol) {
          battleSymbols.add(battle.portfolio.bench.crypto.symbol);
        }
        newsLines = buildNewsLinesForSymbols(wireDays, wireDates, battleSymbols, wireToday);
      }

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
        ...(wireFlags.newslineEnabled ? { newsLines } : {}),
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
