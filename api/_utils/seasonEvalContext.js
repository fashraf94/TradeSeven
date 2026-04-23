/**
 * Season Evaluation Context Builder
 *
 * Assembles the EvaluationContext object consumed by every rule evaluator.
 * Two-phase design:
 *   1. fetchSharedMarketData() — called ONCE per cron run (expensive)
 *   2. buildEvaluationContext() — called per-entry (cheap, no I/O)
 *
 * No data fetching happens during rule evaluation — everything is
 * pre-assembled here.
 */

import { getFirebaseAdmin } from './firebaseAdmin.js';
import { getStockAnalysisData, getCachedHolders } from './marketDataCache.js';
import { SEASON_CONFIG, SEASON_API } from './seasonConfig.js';

// ─── Shared Market Data Fetcher ───────────────────────────────

/**
 * Fetches all market data needed for evaluation — called ONCE per cron run,
 * shared across all entries. Includes EODHD prices, technicals,
 * fundamentals, earnings, institutional data, and SPY benchmark.
 *
 * @param {string[]} universe - Ticker symbols from season.universe
 * @param {Object} seasonDoc - Season Firestore document
 * @returns {Object} Shared market data cache keyed by ticker
 */
export async function fetchSharedMarketData(universe, seasonDoc) {
  const allTickers = [...new Set([...universe, 'SPY'])];

  // Fetch analysis data for all tickers in parallel (batched)
  const batchSize = 10;
  const analysisResults = {};
  const holdersResults = {};
  const errors = [];

  for (let i = 0; i < allTickers.length; i += batchSize) {
    const batch = allTickers.slice(i, i + batchSize);
    const analysisPromises = batch.map(ticker =>
      fetchWithRetry(() =>
        getStockAnalysisData(ticker, {
          fields: ['daily', 'technicals', 'fundamentals', 'earnings'],
        })
      ).catch(err => {
        errors.push({ ticker, error: err.message });
        return null;
      })
    );
    const holdersPromises = batch.map(ticker =>
      getCachedHolders(ticker).catch(() => null)
    );

    const [analysisSettled, holdersSettled] = await Promise.all([
      Promise.all(analysisPromises),
      Promise.all(holdersPromises),
    ]);

    batch.forEach((ticker, idx) => {
      analysisResults[ticker] = analysisSettled[idx];
      holdersResults[ticker] = holdersSettled[idx];
    });
  }

  // Check for total EODHD failure (no data for any ticker)
  const successCount = Object.values(analysisResults).filter(Boolean).length;
  if (successCount === 0) {
    return { error: 'eodhd_failure', message: 'All ticker fetches failed', errors };
  }

  // ─── Assemble structured caches ───────────────────────────

  const marketData = {};
  const technicals = {};
  const fundamentals = {};
  const earnings = {};
  const institutional = {};

  for (const ticker of allTickers) {
    const analysis = analysisResults[ticker];
    if (!analysis) continue;

    // Market data: close price, volume, and trailing price history
    if (analysis.daily && analysis.daily.length > 0) {
      // daily is newest-first from EODHD; reverse for chronological order
      const chronological = [...analysis.daily].reverse();
      const latest = chronological[chronological.length - 1];
      marketData[ticker] = {
        closePrice: latest.close,
        volume: latest.volume,
        priceHistory: chronological.map(d => d.close),
      };
    }

    // Technicals: flatten nested structure into the shape rules expect
    if (analysis.technicals) {
      const tech = analysis.technicals;
      technicals[ticker] = {
        rsiValue: tech.rsi?.value ?? null,
        macdLine: tech.macd?.macd ?? null,
        macdSignal: tech.macd?.signal ?? null,
        // Previous MACD values for crossover detection: use histogram sign change
        // as a proxy when only current snapshot is available. The pipeline can
        // enrich this with yesterday's cached technicals if needed.
        previousMacdLine: null,
        previousMacdSignal: null,
        sma20: tech.sma?.sma20 ?? null,
        sma50: tech.sma?.sma50 ?? null,
        sma100: null, // not available from EODHD/technicals — rules should use sma50 or sma200
        sma200: tech.sma?.sma200 ?? null,
        rvol: tech.volumeProfile?.ratio ?? null,
      };
    }

    // Fundamentals: pass through with overallScore derived from analystRating
    if (analysis.fundamentals) {
      const fund = analysis.fundamentals;
      fundamentals[ticker] = {
        overallScore: fund.analystRating != null ? Math.round(fund.analystRating * 20) : null,
        peRatio: fund.peRatio ?? null,
        freeCashFlow: null, // not directly available from EODHD fundamentals fetch
        marketCap: fund.marketCap ?? null,
        sector: fund.sector ?? null,
        beta: fund.beta ?? null,
      };
    }

    // Earnings: compute tradingDaysUntil from nextEarningsDate
    if (analysis.earnings) {
      const nextDate = analysis.earnings.nextEarningsDate;
      earnings[ticker] = nextDate
        ? { nextEarningsDate: nextDate, tradingDaysUntil: estimateTradingDaysUntil(nextDate) }
        : null;
    }

    // Institutional: map conviction to ownershipTrend
    const holders = holdersResults[ticker];
    if (holders) {
      institutional[ticker] = mapInstitutionalData(holders, ticker);
    }
  }

  // Read institutional aggregates for richer context
  try {
    const db = getFirebaseAdmin();
    const aggDoc = await db.collection('institutionalAggregates').doc('latest').get();
    if (aggDoc.exists) {
      const aggData = aggDoc.data();
      // Enrich institutional entries with sector flow context
      for (const ticker of allTickers) {
        if (institutional[ticker] && fundamentals[ticker]?.sector) {
          institutional[ticker].sectorFlow = aggData.sectorFlows?.[fundamentals[ticker].sector] ?? null;
        }
      }
    }
  } catch (err) {
    console.warn('[SeasonEvalCtx] Failed to fetch institutional aggregates:', err.message);
  }

  // Enrich with per-stock institutional holdings from Firestore
  try {
    const db = getFirebaseAdmin();
    for (let i = 0; i < allTickers.length; i += batchSize) {
      const batch = allTickers.slice(i, i + batchSize);
      const docs = await Promise.all(
        batch.map(sym => db.collection('institutionalHoldings').doc(sym).get().catch(() => null))
      );
      docs.forEach((doc, idx) => {
        if (doc?.exists) {
          const data = doc.data();
          const ticker = batch[idx];
          if (!institutional[ticker]) institutional[ticker] = {};
          institutional[ticker].ownershipTrend = mapConvictionToTrend(data.summary?.conviction);
          institutional[ticker].convictionScore = data.summary?.convictionScore ?? null;
        }
      });
    }
  } catch (err) {
    console.warn('[SeasonEvalCtx] Failed to fetch institutional holdings:', err.message);
  }

  // Enrich with sector performance for SE-09 Sector Momentum Filter.
  // Read indexIntelligence/marketContext.sectorSnapshot once per cron run
  // and transpose into { '1D': {sector:ret}, '1W': {...}, '1M': {...} }.
  // Note: 3M timeframe not yet emitted by compute-index-intelligence — add
  // back when that cron ships quarterChange.
  let sectorPerformance = null;
  try {
    const db = getFirebaseAdmin();
    const mcDoc = await db.collection('indexIntelligence').doc('marketContext').get();
    const snap = mcDoc.exists ? mcDoc.data()?.sectorSnapshot : null;
    if (Array.isArray(snap) && snap.length > 0) {
      const oneD = {}, oneW = {}, oneM = {};
      for (const row of snap) {
        if (!row || typeof row.sector !== 'string') continue;
        if (typeof row.changePercent === 'number') oneD[row.sector] = row.changePercent;
        if (typeof row.weekChange === 'number') oneW[row.sector] = row.weekChange;
        if (typeof row.monthChange === 'number') oneM[row.sector] = row.monthChange;
      }
      const missing = [];
      if (Object.keys(oneD).length === 0) missing.push('1D');
      if (Object.keys(oneW).length === 0) missing.push('1W');
      if (Object.keys(oneM).length === 0) missing.push('1M');
      // If every timeframe is empty we leave sectorPerformance=null so the
      // evaluator's silent-pass policy triggers. Partial coverage still
      // populates; missing timeframes emit a one-time warn.
      if (missing.length < 3) {
        sectorPerformance = { '1D': oneD, '1W': oneW, '1M': oneM };
        if (missing.length > 0) {
          console.warn(`[SeasonEvalCtx] sectorPerformance partial coverage — missing timeframes: ${missing.join(', ')}`);
        }
      } else {
        console.warn('[SeasonEvalCtx] sectorPerformance unavailable — indexIntelligence/marketContext.sectorSnapshot empty or malformed');
      }
    } else {
      console.warn('[SeasonEvalCtx] sectorPerformance unavailable — indexIntelligence/marketContext.sectorSnapshot missing');
    }
  } catch (err) {
    console.warn('[SeasonEvalCtx] Failed to fetch sector performance:', err.message);
  }

  return { marketData, technicals, fundamentals, earnings, institutional, sectorPerformance, errors };
}

// ─── Per-Entry Context Builder ────────────────────────────────

/**
 * Assembles the complete EvaluationContext for a single entry's daily evaluation.
 * Cheap operation — no I/O, just data assembly and recalculation.
 *
 * @param {Object} entryDoc - seasonEntries/{entryId} Firestore document data
 * @param {Object} seasonDoc - seasons/{seasonId} Firestore document data
 * @param {Object} sharedMarketData - From fetchSharedMarketData()
 * @returns {Object} EvaluationContext
 */
export function buildEvaluationContext(entryDoc, seasonDoc, sharedMarketData) {
  const { marketData, technicals, fundamentals, earnings, institutional, sectorPerformance } = sharedMarketData;

  // ─── Date / Season Info ───────────────────────────────────
  const tradingDay = seasonDoc.currentTradingDay || 1;
  const today = seasonDoc.tradingCalendar?.[tradingDay - 1]?.date || new Date().toISOString().slice(0, 10);
  const currentWeek = resolveCurrentWeek(tradingDay, seasonDoc.weeks);
  const isFirstDayOfWeek = resolveIsFirstDayOfWeek(tradingDay, seasonDoc.weeks);

  // ─── Portfolio State ──────────────────────────────────────
  const portfolio = buildPortfolio(entryDoc.portfolio, tradingDay, marketData);

  // ─── Macro Calendar ───────────────────────────────────────
  const macro = buildMacro(seasonDoc.macroEvents, tradingDay);

  // ─── Season State ─────────────────────────────────────────
  const spyReturn = computeSpyReturn(marketData, seasonDoc);
  const portfolioReturn = portfolio.totalReturn;
  const seasonState = entryDoc.seasonState || {};

  const season = {
    alphaVsSpy: portfolioReturn - spyReturn,
    spyReturn,
    portfolioReturn,
    currentWeek,
    totalWeeks: SEASON_CONFIG.TOTAL_WEEKS,
    isFirstDayOfWeek,
    weeklyResults: seasonState.weeklyResults || [],
    weeklySectorReturns: seasonState.weeklySectorReturns || {},
    userShortlist: seasonState.userShortlist || [],
  };

  // ─── Benchmark ────────────────────────────────────────────
  const spyData = marketData['SPY'];
  const benchmark = {
    spyClosePrice: spyData?.closePrice ?? null,
    spyDailyReturn: computeDailyReturn(spyData?.priceHistory),
    spyPriceHistory: spyData?.priceHistory || [],
  };

  return {
    today,
    tradingDay,
    currentWeek,
    totalWeeks: SEASON_CONFIG.TOTAL_WEEKS,
    isFirstDayOfWeek,
    portfolio,
    marketData: marketData || {},
    technicals: technicals || {},
    fundamentals: fundamentals || {},
    earnings: earnings || {},
    institutional: institutional || {},
    sectorPerformance: sectorPerformance || null,
    macro,
    season,
    benchmark,
  };
}

// ─── Internal Helpers ─────────────────────────────────────────

/**
 * Recalculates portfolio positions with fresh market prices.
 */
function buildPortfolio(rawPortfolio, tradingDay, marketData) {
  if (!rawPortfolio) {
    return {
      cash: 0, cashPct: 0, totalValue: 0, initialValue: 0,
      totalReturn: 0, highWaterMark: 0, drawdownFromPeak: 0,
      positions: {}, positionCount: 0, sectorWeights: {},
      initialSectorWeights: {},
    };
  }

  const positions = {};
  let positionsValue = 0;
  const sectorValues = {};

  const rawPositions = rawPortfolio.positions || {};
  for (const [ticker, pos] of Object.entries(rawPositions)) {
    const freshPrice = marketData[ticker]?.closePrice ?? pos.currentPrice ?? pos.entryPrice;
    const currentValue = pos.shares * freshPrice;
    const returnSinceEntry = ((freshPrice - pos.entryPrice) / pos.entryPrice) * 100;
    const hwm = Math.max(pos.highWaterMark || pos.entryPrice, freshPrice);
    const drawdownFromPeak = ((freshPrice - hwm) / hwm) * 100;

    positions[ticker] = {
      shares: pos.shares,
      entryPrice: pos.entryPrice,
      entryDate: pos.entryDate || null,
      entryDay: pos.entryDay || 1,
      currentPrice: freshPrice,
      currentValue,
      currentWeight: 0, // set below after totalValue is known
      returnSinceEntry,
      highWaterMark: hwm,
      drawdownFromPeak,
      sector: pos.sector || null,
      beta: pos.beta || null,
      daysSinceEntry: tradingDay - (pos.entryDay || 1),
    };

    positionsValue += currentValue;
    if (pos.sector) {
      sectorValues[pos.sector] = (sectorValues[pos.sector] || 0) + currentValue;
    }
  }

  const cash = rawPortfolio.cash ?? 0;
  const totalValue = positionsValue + cash;
  const initialValue = rawPortfolio.initialValue ?? SEASON_CONFIG.STARTING_CAPITAL;

  // Set weights now that totalValue is known
  const sectorWeights = {};
  for (const [ticker, pos] of Object.entries(positions)) {
    pos.currentWeight = totalValue > 0 ? (pos.currentValue / totalValue) * 100 : 0;
  }
  for (const [sector, value] of Object.entries(sectorValues)) {
    sectorWeights[sector] = totalValue > 0 ? (value / totalValue) * 100 : 0;
  }

  const portfolioHWM = Math.max(rawPortfolio.highWaterMark || initialValue, totalValue);

  return {
    cash,
    cashPct: totalValue > 0 ? (cash / totalValue) * 100 : 0,
    totalValue,
    initialValue,
    totalReturn: ((totalValue - initialValue) / initialValue) * 100,
    highWaterMark: portfolioHWM,
    drawdownFromPeak: ((totalValue - portfolioHWM) / portfolioHWM) * 100,
    positions,
    positionCount: Object.keys(positions).length,
    sectorWeights,
    initialSectorWeights: rawPortfolio.initialSectorWeights || {},
  };
}

/**
 * Determines the current week number from the season's week definitions.
 */
function resolveCurrentWeek(tradingDay, weeks) {
  if (!weeks || !Array.isArray(weeks)) return 1;
  for (let i = 0; i < weeks.length; i++) {
    const w = weeks[i];
    const days = w.tradingDays || [];
    if (days.includes(tradingDay) || (tradingDay >= (days[0] || 0) && tradingDay <= (days[days.length - 1] || 0))) {
      return i + 1;
    }
  }
  return weeks.length; // past the last defined week — treat as final
}

/**
 * Checks if the current trading day is the first day of its week.
 */
function resolveIsFirstDayOfWeek(tradingDay, weeks) {
  if (!weeks || !Array.isArray(weeks)) return false;
  for (const w of weeks) {
    const days = w.tradingDays || [];
    if (days[0] === tradingDay) return true;
  }
  return false;
}

/**
 * Builds the macro calendar context from season macro events.
 */
function buildMacro(macroEvents, currentTradingDay) {
  if (!macroEvents || !Array.isArray(macroEvents)) {
    return { nextEvent: null, upcomingEvents: [] };
  }

  const upcoming = macroEvents
    .filter(e => e.tradingDay > currentTradingDay)
    .map(e => ({
      type: e.type,
      date: e.date,
      tradingDaysUntil: e.tradingDay - currentTradingDay,
    }))
    .sort((a, b) => a.tradingDaysUntil - b.tradingDaysUntil);

  return {
    nextEvent: upcoming[0] || null,
    upcomingEvents: upcoming,
  };
}

/**
 * Computes SPY total return from season start to current day.
 */
function computeSpyReturn(marketData, seasonDoc) {
  const spyHistory = marketData['SPY']?.priceHistory;
  if (!spyHistory || spyHistory.length < 2) return 0;

  const startPrice = seasonDoc.spyStartPrice || spyHistory[0];
  const currentPrice = spyHistory[spyHistory.length - 1];
  return ((currentPrice - startPrice) / startPrice) * 100;
}

/**
 * Computes single-day return from the last two entries in a price history.
 */
function computeDailyReturn(priceHistory) {
  if (!priceHistory || priceHistory.length < 2) return 0;
  const prev = priceHistory[priceHistory.length - 2];
  const curr = priceHistory[priceHistory.length - 1];
  return prev > 0 ? ((curr - prev) / prev) * 100 : 0;
}

/**
 * Maps EODHD holders data to the institutional shape rules expect.
 */
function mapInstitutionalData(holders, ticker) {
  const instCount = holders?.Institutions?.length ?? 0;
  return {
    ownershipTrend: null, // enriched later from institutionalHoldings collection
    quarterlyDelta: [],
    institutionCount: instCount,
  };
}

/**
 * Maps conviction string from institutionalHoldings to ownershipTrend.
 */
function mapConvictionToTrend(conviction) {
  if (!conviction) return null;
  const c = conviction.toLowerCase();
  if (c === 'accumulating' || c === 'strong_accumulating') return 'increased';
  if (c === 'distributing' || c === 'strong_distributing') return 'decreased';
  return 'stable';
}

/**
 * Estimates trading days between now and a target date.
 * Rough approximation: ~5 trading days per 7 calendar days.
 */
function estimateTradingDaysUntil(targetDateStr) {
  const now = new Date();
  const target = new Date(targetDateStr);
  const calendarDays = Math.max(0, Math.ceil((target - now) / (1000 * 60 * 60 * 24)));
  return Math.round(calendarDays * (5 / 7));
}

/**
 * Retries an async function using SEASON_API retry config.
 */
async function fetchWithRetry(fn) {
  const delays = SEASON_API.EODHD_RETRY_DELAYS;
  let lastError;
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < delays.length) {
        await new Promise(r => setTimeout(r, delays[attempt]));
      }
    }
  }
  throw lastError;
}
