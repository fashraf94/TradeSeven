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
// Voice-layer grounding §3.5 — the fundamentals mirror rides the brief only
// while the battle owner's mode is not 'off' (shadow assembles the new prompt
// too), so a flag-off cache doc stays field-wise byte-identical (the newsLines
// precedent). Read at call time per battle, never module scope.
import { getVoiceGroundingMode } from '../../src/config/featureFlags.js';

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
// `options.fundamentals` (voice-layer grounding §3.5): copy the `fundamentals`
// mirror the rankings entry already holds onto the brief — zero added reads,
// null-honest (absent when the entry carries none). Default false → the
// shipped brief, field for field.
// A persisted `aboveSMAn` flag is only a READING when the average behind it
// exists. `computeTechnicalScore` writes `smaBasis.smaN !== null && price >
// smaBasis.smaN` (indexIntelligence.js:424-426), so a missing average is stored
// as the boolean `false` — indistinguishable, by type, from a measured "below".
// The averages themselves ARE stored null-honestly (`:532-534`), and are the
// same ones the flags were derived from, so both brief writers gate on this
// pair. ONE definition, shared, so the two paths cannot
// drift apart again (BUILD_RULES §9).
function smaRead(flag, value) {
  return typeof flag === 'boolean' && value != null;
}

export function buildPortfolioBriefs(portfolio, priceMap, rankingsMap, techScoresMap, thresholdHistory = {}, startingPrices = {}, intradayMomentumMap = {}, options = {}) {
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
      // (The `factors.rsPercentile ?? 50` default that used to live here is
      //  gone: both its readers — the trend suffix and the brief field — now
      //  ride the raw reading, so the imputed 50 had no honest use left.)

      // Trend summary from SMA alignment — gated on the READINGS, not on the
      // booleans derived from them (D-120 / BUILD_RULES §9).
      //
      // `computeTechnicalScore` writes `aboveSMA50 = smaBasis.sma50 !== null
      // && smaBasis.price > smaBasis.sma50` (indexIntelligence.js:425), so a
      // MISSING 50-day average is persisted as the boolean `false`, not as an
      // absent field. A `typeof === 'boolean'` guard therefore passes for every
      // real document and suppresses nothing: a thin-history symbol
      // (sma50/sma200 null, technicalCalculations.js:20) still fell through the
      // chain to 'Downtrend. Below major SMAs.' — a bearish claim about two
      // averages that do not exist. The review caught this; the first guard was
      // inert for the exact case it was written for.
      //
      // The averages THEMSELVES are null-honest in the same document
      // (indexIntelligence.js:532-534), so the claim now binds to them. All
      // four sentences below speak about the whole 20/50/200 stack — including
      // 'Above 20-day SMA only', which is a claim about the other two — so all
      // three readings must exist before any of them may be said. Byte-identical
      // for every full-history symbol.
      let trendSummary;
      if (
        smaRead(factors.aboveSMA200, factors.sma200) &&
        smaRead(factors.aboveSMA50, factors.sma50) &&
        smaRead(factors.aboveSMA20, factors.sma20)
      ) {
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

        // The RS clause rides the RAW reading, as the bench path does (`:423`):
        // the `?? 50` default below is an imputed number, not a measurement.
        const rs = factors.rsPercentile;
        if (typeof rs === 'number') {
          if (rs >= 75) trendSummary += ' RS vs SPY rising.';
          else if (rs <= 25) trendSummary += ' RS vs SPY declining.';
        }
      }

      // Momentum summary — same rule, same reason. `computeTechnicalScore`
      // seeds each of these three sub-scores with a hardcoded NEUTRAL DEFAULT
      // (`macdScore = 6` at indexIntelligence.js:432, `volumeConfirmation = 6`
      // at `:463`, `rsiContext = 4` at `:489`) and only replaces it when the
      // underlying data exists. Every one is therefore a number in every
      // document, so a `typeof === 'number'` guard suppresses nothing either.
      //
      // Two of the three defaults are harmlessly silent — 4 and 6 both fall
      // between their phrase thresholds. The volume default did NOT: `6 < 8`
      // took the else-branch and published 'Volume subdued.' about a ratio the
      // scorer never measured (a symbol with fewer than 20 daily rows,
      // indexIntelligence.js:464). Each phrase now needs positive evidence:
      //
      //   · Volume speaks only at the two ends the scorer reaches ONLY from
      //     real data (12/9 → confirming, 3 → subdued). The ambiguous middle —
      //     6, which is both the default and a real 1.0–1.2 ratio — now says
      //     nothing, exactly as the RSI phrase already did. THIS is the
      //     behaviour change: a symbol with fewer than 20 daily rows scores a
      //     defaulted 6 and was being called 'Volume subdued.'
      //   · MACD additionally rides `factors.macdAboveSignal`, which IS
      //     null-honest (`indexIntelligence.js:539` — `macd ? … : null`).
      //     BE HONEST ABOUT THIS ONE: it changes nothing today. `macdScore`
      //     leaves its default of 6 only inside `if (macd && …)`
      //     (indexIntelligence.js:434), so a banded 8+/4- already implies MACD
      //     was computed, and 6 falls between the thresholds. The condition is
      //     belt-and-braces so that a future change to that default cannot
      //     silently start fabricating a MACD verdict — no test pins it,
      //     because no input can currently tell the two versions apart.
      let momentumSummary;
      if (techScore) {
        const momentumParts = [];

        const rsiContext = techScore.rsiContext;
        if (typeof rsiContext === 'number') {
          if (rsiContext >= 7) momentumParts.push('RSI healthy, not extended.');
          else if (rsiContext <= 3) momentumParts.push('RSI weak or overbought.');
        }

        const macdScore = techScore.macdScore;
        if (typeof macdScore === 'number' && factors.macdAboveSignal != null) {
          if (macdScore >= 8) momentumParts.push('MACD expanding.');
          else if (macdScore <= 4) momentumParts.push('MACD contracting.');
        }

        const volumeConfirmation = techScore.volumeConfirmation;
        if (typeof volumeConfirmation === 'number') {
          if (volumeConfirmation >= 8) {
            const volRatio = factors.upDayVolRatio;
            if (volRatio != null) {
              momentumParts.push(`Volume ${volRatio.toFixed(1)}x avg.`);
            } else {
              momentumParts.push('Volume confirming.');
            }
          } else if (volumeConfirmation <= 3) {
            momentumParts.push('Volume subdued.');
          }
        }

        if (momentumParts.length > 0) momentumSummary = momentumParts.join(' ');
      }

      // Threshold proximity note (qualitative, ATR-rank-based — distinct from
      // quantitative thresholdProximity below). F3.1: null sentinel — the
      // `> 0.7` predicate is false for null, so the note correctly omits.
      const atrPercentile = ranking?.atrPercentile ?? null;
      let thresholdNote = null;
      if (atrPercentile != null && atrPercentile > 0.7) {
        thresholdNote = 'High ATR — volatile, could hit thresholds quickly';
      }

      // The REAL ATR percent (percent-of-price, e.g. 2.3) is a different
      // reading in a different unit from the 0-1 percentile above, and the two
      // must never share a field: `atrPercent: atrPercentile` rendered a
      // 71st-percentile name as "ATR 0.71%" on every voice surface. The rankings
      // entry mirrors it under techRaw.atrPercent off the same in-memory tech
      // object stockTechnicalScores persists at top level
      // (compute-index-intelligence.js:1222 and :953) — ranking first, tech-score
      // fallback, matching the precedence the other mirrored fields use.
      const atrPercentRaw = ranking?.techRaw?.atrPercent ?? techScore?.atrPercent ?? null;

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
        // Null-honest, as the bench writer already is (`:480-482`): the `?? 50`
        // above is an imputed default and publishing it rendered
        // "RS 50th %ile" into the prompt for symbols with no technical-score
        // document at all.
        rsPercentile: typeof factors.rsPercentile === 'number'
          ? Math.round(factors.rsPercentile)
          : null,
        supportLevel: null,
        resistanceLevel: null,
        thresholdNote,
        // Two ATR readings, two units, two names (buildHeaderLine renders each
        // with its own unit). F3.1: null sentinel for missing; a legitimate 0
        // survives as 0.
        //   atrPercent    — percent of price      (2.3  -> "ATR 2.3%")
        //   atrPercentile — 0-1 cross-sectional rank (0.71 -> "ATR 71st %ile")
        atrPercent: typeof atrPercentRaw === 'number'
          ? Math.round(atrPercentRaw * 100) / 100
          : null,
        atrPercentile: typeof atrPercentile === 'number'
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

      // D-120: absent summaries are ABSENT FIELDS, not empty strings —
      // Firestore rejects `undefined`, and the renderer reads presence
      // (voiceLayerPrompt.js `buildPortfolioBriefsBlock`). Same two lines as
      // buildBenchBriefs.
      if (trendSummary) brief.trendSummary = trendSummary;
      if (momentumSummary) brief.momentumSummary = momentumSummary;

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

      // Voice-layer grounding §3.5 — the mirror, when asked for and present.
      if (options.fundamentals === true && ranking?.fundamentals && typeof ranking.fundamentals === 'object') {
        brief.fundamentals = ranking.fundamentals;
      }

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
export function buildBenchBriefs(portfolio, priceMap, rankingsMap, techScoresMap, now = new Date(), options = {}) {
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
    // Real ATR percent (percent-of-price), distinct from the 0-1 percentile
    // above — same sourcing and same reason as buildPortfolioBriefs.
    const atrPercentRaw = ranking?.techRaw?.atrPercent ?? techScore?.atrPercent ?? null;

    // Trend summary — gated on the READINGS, identical rule and identical
    // reason to buildPortfolioBriefs above. The `typeof === 'boolean'` form
    // this replaces only ever caught the missing-DOCUMENT case: a thin-history
    // symbol whose sma50/sma200 are null still carries both flags as `false`
    // and published 'Downtrend. Below major SMAs.' from here too.
    let trendSummary;
    if (factors && (
      smaRead(factors.aboveSMA200, factors.sma200) &&
      smaRead(factors.aboveSMA50, factors.sma50) &&
      smaRead(factors.aboveSMA20, factors.sma20)
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

    // Momentum summary — identical rule to buildPortfolioBriefs above: MACD
    // rides the null-honest `factors.macdAboveSignal`, and volume speaks only
    // at the two ends the scorer reaches from real data, never from its
    // hardcoded neutral 6.
    let momentumSummary;
    if (techScore) {
      const parts = [];
      const rsiContext = techScore.rsiContext;
      if (typeof rsiContext === 'number') {
        if (rsiContext >= 7) parts.push('RSI healthy, not extended.');
        else if (rsiContext <= 3) parts.push('RSI weak or overbought.');
      }
      const macdScore = techScore.macdScore;
      if (typeof macdScore === 'number' && factors?.macdAboveSignal != null) {
        if (macdScore >= 8) parts.push('MACD expanding.');
        else if (macdScore <= 4) parts.push('MACD contracting.');
      }
      const volumeConfirmation = techScore.volumeConfirmation;
      if (typeof volumeConfirmation === 'number') {
        if (volumeConfirmation >= 8) {
          const volRatio = factors?.upDayVolRatio;
          if (volRatio != null) parts.push(`Volume ${volRatio.toFixed(1)}x avg.`);
          else parts.push('Volume confirming.');
        } else if (volumeConfirmation <= 3) {
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
      // atrPercent = percent of price; atrPercentile = 0-1 rank. See the
      // buildPortfolioBriefs note — the two units keep separate names.
      atrPercent: typeof atrPercentRaw === 'number'
        ? Math.round(atrPercentRaw * 100) / 100
        : null,
      atrPercentile: typeof atrPercentileRaw === 'number'
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

    // Voice-layer grounding §3.5 — see buildPortfolioBriefs.
    if (options.fundamentals === true && ranking?.fundamentals && typeof ranking.fundamentals === 'object') {
      brief.fundamentals = ranking.fundamentals;
    }

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
        // D-120: the RS verdict rides the RAW reading. `rsPercentile` below is
        // `factors.rsPercentile ?? 50`, so an unmeasured symbol was being
        // called 'RS neutral or weak.' — a verdict on a number that does not
        // exist. Omitted now, as the MACD clause beside it already omits.
        detail: `${scoreClause}${typeof factors.rsPercentile === 'number'
          ? (factors.rsPercentile >= 60 ? 'RS supportive.' : 'RS neutral or weak.')
          : ''} ${(techScore?.macdScore ?? 0) >= 8 ? 'MACD expanding.' : ''}`.trim(),
        relevance: 'all',
      });
    }

    // Game fit: high BaggerBomb fit
    if (ranking?.baggerBombFit >= 85 && ranking?.baggerBombRank <= 15) {
      // D-120: an absent reading is an absent CLAUSE. Both of these printed
      // the literal string 'N/A' as if it were a value — the exact placeholder
      // this arc removes everywhere else.
      const atrClause = typeof ranking?.atrPercentile === 'number'
        ? `ATR percentile ${Math.round(ranking.atrPercentile * 100)}%.`
        : '';
      const compositeClause = ranking.compositeScore != null
        ? `Composite score ${ranking.compositeScore}.`
        : '';
      alerts.push({
        symbol,
        type: 'game_fit',
        headline: `${symbol} BaggerBomb Fit #${ranking.baggerBombRank} — high scoring potential`,
        detail: `${compositeClause} ${atrClause}`.trim(),
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
      // Voice-layer grounding §3.5 — per battle, at call time: the mirror rides
      // the brief whenever the owner's mode is not 'off'.
      const briefOptions = { fundamentals: getVoiceGroundingMode(battle.ownerId) !== 'off' };
      const portfolioBriefs = buildPortfolioBriefs(
        battle.portfolio,
        priceMap,
        rankingsMap,
        techScoresMap,
        battle.thresholdHistory || {},
        battle.startingPrices || {},
        intradayMomentumMap,
        briefOptions,
      );
      const benchBriefs = buildBenchBriefs(battle.portfolio, priceMap, rankingsMap, techScoresMap, undefined, briefOptions);
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
