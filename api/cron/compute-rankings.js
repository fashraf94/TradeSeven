// api/cron/compute-rankings.js
// Daily cron: computes sector-adjusted peer rankings for ~220 stocks,
// runs Coiled Spring / Running on Fumes scanner, generates badges.
//
// Schedule: 0 11 * * 1-5 (UTC 11:00 = ET 6:00 AM / 7:00 AM, Mon–Fri)
//
// Flow:
//   Phase A: Fetch EODHD fundamentals + bulk prices + rolling price history
//   Phase B: Extract metrics, rank within sectors, compute composite scores
//   Phase C: Coiled Spring / Running on Fumes scanner (additive, never blocks rankings)
//   Phase D: Persist to Firestore (peerRankings + sectorRankings + scannerSummary)

export const config = { maxDuration: 180 };

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import {
  STOCK_UNIVERSE,
  ALL_TICKERS,
  DIMENSIONS,
  PILLARS,
  COMPETE_PILLAR_WEIGHTS,
  SECTOR_COMPOSITE_WEIGHTS,
  EODHD_FUNDAMENTALS_FILTER,
  getTierLabel,
  normalizeToScore,
  computeReturn,
} from '../_utils/rankingConfig.js';
import {
  annualizedVolatility,
  computeVAD,
  compute21dSMA,
  daysSince52WeekHigh,
  generateDNABadge,
  getDebtRiskBadge,
  generateSpringNarrative,
  generateFumesNarrative,
  percentileRank,
} from '../_utils/rankingHelpers.js';

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

const LOG_PREFIX = '[RankingsCron]';

function logInfo(message, data = null) {
  const ts = new Date().toISOString();
  if (data) console.log(`${ts} ${LOG_PREFIX} ${message}`, JSON.stringify(data));
  else console.log(`${ts} ${LOG_PREFIX} ${message}`);
}

function logWarn(message, data = null) {
  const ts = new Date().toISOString();
  if (data) console.warn(`${ts} ${LOG_PREFIX} ${message}`, JSON.stringify(data));
  else console.warn(`${ts} ${LOG_PREFIX} ${message}`);
}

function logError(message, data = null) {
  const ts = new Date().toISOString();
  if (data) console.error(`${ts} ${LOG_PREFIX} ${message}`, JSON.stringify(data));
  else console.error(`${ts} ${LOG_PREFIX} ${message}`);
}

// ---------------------------------------------------------------------------
// Firebase Admin
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDateDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function median(arr) {
  if (!arr || arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

// ---------------------------------------------------------------------------
// EODHD Fetchers
// ---------------------------------------------------------------------------

const API_BASE = 'https://eodhd.com/api';

async function fetchSingleFundamental(ticker, apiKey) {
  const eohdTicker = ticker.replace(/\./g, '-');
  const url = `${API_BASE}/fundamentals/${eohdTicker}.US?api_token=${apiKey}&fmt=json&filter=${EODHD_FUNDAMENTALS_FILTER}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();

  return {
    highlights: data.Highlights || {},
    valuation: data.Valuation || {},
    technicals: data.Technicals || {},
    earnings: data.Earnings || {},
    incomeQ: data.Financials?.Income_Statement?.quarterly || {},
    cashFlowQ: data.Financials?.Cash_Flow?.quarterly || {},
    incomeY: data.Financials?.Income_Statement?.yearly || {},
    name: data.General?.Name || ticker,
  };
}

async function fetchAllFundamentals(stocks, apiKey) {
  const results = {};
  const BATCH_SIZE = 10;
  const DELAY_MS = 250;
  let success = 0;
  let failed = 0;

  for (let i = 0; i < stocks.length; i += BATCH_SIZE) {
    const batch = stocks.slice(i, i + BATCH_SIZE);
    const promises = batch.map(({ ticker }) =>
      fetchSingleFundamental(ticker, apiKey).catch(err => {
        logWarn(`Failed to fetch ${ticker}: ${err.message}`);
        failed++;
        return null;
      })
    );

    const batchResults = await Promise.all(promises);
    batch.forEach(({ ticker }, idx) => {
      if (batchResults[idx]) {
        results[ticker] = batchResults[idx];
        success++;
      }
    });

    if (i + BATCH_SIZE < stocks.length) {
      await sleep(DELAY_MS);
    }

    if ((i + BATCH_SIZE) % 50 < BATCH_SIZE) {
      logInfo(`Fetched ${Math.min(i + BATCH_SIZE, stocks.length)}/${stocks.length} fundamentals (${success} ok, ${failed} failed)`);
    }
  }

  logInfo(`Fundamentals fetch complete: ${success} success, ${failed} failed out of ${stocks.length}`);
  return results;
}

async function fetchHistoricalPrices(symbol, apiKey, days = 180) {
  const eohdSymbol = symbol.replace(/\./g, '-');
  const from = getDateDaysAgo(days);
  const url = `${API_BASE}/eod/${eohdSymbol}.US?api_token=${apiKey}&fmt=json&period=d&order=d&from=${from}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${symbol}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Rolling Price History
// ---------------------------------------------------------------------------

/**
 * Read the rolling price history from Firestore, append today's prices,
 * trim to 200 days, and write back.
 * Returns a Map of ticker → array of daily closes (newest first).
 */
async function updateRollingPriceHistory(db, bulkPrices, apiKey) {
  const today = new Date().toISOString().split('T')[0];

  // Build today's price map from bulk data
  const todayPrices = {};
  if (Array.isArray(bulkPrices)) {
    for (const entry of bulkPrices) {
      const sym = (entry.code || entry.symbol || '').replace(/\.US$/i, '');
      if (sym && entry.close) todayPrices[sym] = entry.close;
    }
  }

  // Read existing rolling history
  let days = [];
  try {
    const doc = await db.collection('priceHistory').doc('rolling').get();
    if (doc.exists) {
      days = doc.data()?.days || [];
    }
  } catch (err) {
    logWarn(`Failed to read rolling price history: ${err.message}`);
  }

  // --- One-time backfill: if <130 days, fetch ~200 days of historical prices ---
  if (days.length < 130 && apiKey) {
    logInfo(`Rolling history has ${days.length} days — backfilling to ~200 days`);
    const fromStr = getDateDaysAgo(285); // 285 calendar days ≈ 200 trading days

    const historicalPrices = {}; // ticker → [{ date, close }, ...]
    const BATCH_SIZE = 10;
    let successCount = 0;

    for (let i = 0; i < ALL_TICKERS.length; i += BATCH_SIZE) {
      const batch = ALL_TICKERS.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(async (ticker) => {
          const eohdTicker = ticker.replace(/\./g, '-');
          const url = `${API_BASE}/eod/${eohdTicker}.US?api_token=${apiKey}&fmt=json&period=d&from=${fromStr}`;
          const res = await fetch(url);
          if (!res.ok) return null;
          return { ticker, data: await res.json() };
        })
      );
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value) {
          historicalPrices[r.value.ticker] = r.value.data;
          successCount++;
        }
      }
      if (i + BATCH_SIZE < ALL_TICKERS.length) await sleep(250);
    }

    logInfo(`Backfill fetched ${successCount}/${ALL_TICKERS.length} stocks`);

    // Build day snapshots: { date, prices: { AAPL: 185.50, ... } }
    const allDates = new Set();
    for (const dayArr of Object.values(historicalPrices)) {
      if (Array.isArray(dayArr)) dayArr.forEach(d => allDates.add(d.date));
    }
    const sortedDates = [...allDates].sort();
    const recentDates = sortedDates.slice(-200);

    const backfilledDays = recentDates.map(date => {
      const prices = {};
      for (const [ticker, dayArr] of Object.entries(historicalPrices)) {
        if (Array.isArray(dayArr)) {
          const match = dayArr.find(d => d.date === date);
          if (match?.close) prices[ticker] = match.close;
        }
      }
      return { date, prices };
    });

    // Merge backfilled days with any existing days (deduplicate by date)
    const existingDates = new Set(days.map(d => d.date));
    const merged = [...days];
    for (const bd of backfilledDays) {
      if (!existingDates.has(bd.date)) merged.push(bd);
    }
    // Sort newest-first, trim to 200
    merged.sort((a, b) => b.date.localeCompare(a.date));
    days = merged.slice(0, 200);

    logInfo(`Backfill complete: ${days.length} days for ${successCount} stocks`);

    // Persist backfilled data immediately
    try {
      await db.collection('priceHistory').doc('rolling').set({
        days,
        updatedAt: new Date(),
        dayCount: days.length,
      });
      logInfo(`Backfilled rolling history persisted: ${days.length} days`);
    } catch (err) {
      logWarn(`Failed to write backfilled rolling history: ${err.message}`);
    }
  }

  // Don't add duplicate entries for the same date
  if (days.length > 0 && days[0]?.date === today) {
    logInfo('Rolling price history already has today\'s data — skipping append');
  } else if (Object.keys(todayPrices).length > 0) {
    days.unshift({ date: today, prices: todayPrices });
    // Trim to 200 days
    if (days.length > 200) days = days.slice(0, 200);

    try {
      await db.collection('priceHistory').doc('rolling').set({
        days,
        updatedAt: new Date(),
        dayCount: days.length,
      });
      logInfo(`Rolling price history updated: ${days.length} days stored`);
    } catch (err) {
      logWarn(`Failed to write rolling price history: ${err.message}`);
    }
  }

  // Build per-ticker close arrays (newest first) for scanner
  const tickerHistory = new Map();
  for (const day of days) {
    if (!day.prices) continue;
    for (const [ticker, price] of Object.entries(day.prices)) {
      if (!tickerHistory.has(ticker)) tickerHistory.set(ticker, []);
      tickerHistory.get(ticker).push(price);
    }
  }

  return tickerHistory;
}

// ---------------------------------------------------------------------------
// Metric Extraction
// ---------------------------------------------------------------------------

/**
 * Sum a field across the most recent 4 quarters to get TTM value.
 */
function getQuarterlyTTM(quarterlyObj, field) {
  if (!quarterlyObj || typeof quarterlyObj !== 'object') return null;
  const entries = Object.entries(quarterlyObj)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 4);
  if (entries.length < 4) return null;
  const values = entries.map(([, q]) => {
    const v = parseFloat(q[field]);
    return isNaN(v) ? null : v;
  });
  if (values.some(v => v === null)) return null;
  return values.reduce((sum, v) => sum + v, 0);
}

/**
 * Compute the EPS revision score from the Earnings.Trend section.
 * Score = % change in consensus EPS estimate over the last 30 days.
 */
function computeEpsRevisionScore(earnings) {
  if (!earnings?.Trend) return null;

  const trendEntries = Object.values(earnings.Trend);
  const trend = trendEntries.find(t => t.period === '0y')
    || trendEntries.find(t => t.period === '+1q');
  if (!trend) return null;

  const current = parseFloat(trend.epsTrendCurrent);
  const ago30 = parseFloat(trend.epsTrend30daysAgo);

  if (isNaN(current) || isNaN(ago30) || ago30 === 0) return null;
  return ((current - ago30) / Math.abs(ago30)) * 100;
}

/**
 * Compute average earnings surprise % from the last 4 quarters of Earnings.History.
 */
function computeAvgSurprise(earnings) {
  if (!earnings?.History) return null;
  const entries = Object.values(earnings.History)
    .filter(e => {
      const actual = parseFloat(e.epsActual);
      const estimate = parseFloat(e.epsEstimate);
      return !isNaN(actual) && !isNaN(estimate) && estimate !== 0;
    })
    .slice(0, 4);
  if (entries.length < 2) return null;
  const surprises = entries.map(e =>
    ((parseFloat(e.epsActual) - parseFloat(e.epsEstimate)) / Math.abs(parseFloat(e.epsEstimate))) * 100
  );
  return surprises.reduce((s, v) => s + v, 0) / surprises.length;
}

/**
 * Extract yearly EBIT and interest expense for debt risk badge.
 * Uses the most recent yearly income statement.
 */
function extractYearlyDebtMetrics(incomeY) {
  if (!incomeY || typeof incomeY !== 'object') return { ebit: null, interestExpense: null };
  const years = Object.keys(incomeY).sort().reverse();
  if (years.length === 0) return { ebit: null, interestExpense: null };
  const latest = incomeY[years[0]];
  const ebit = parseFloat(latest?.operatingIncome ?? latest?.ebit);
  const intExp = parseFloat(latest?.interestExpense);
  return {
    ebit: isNaN(ebit) ? null : ebit,
    interestExpense: isNaN(intExp) ? null : intExp,
  };
}

/**
 * Extract raw metrics from EODHD fundamentals data across all dimensions.
 */
function extractMetrics(ticker, fundamentals) {
  const h = fundamentals.highlights;
  const v = fundamentals.valuation;
  const t = fundamentals.technicals;

  // ── Growth ────────────────────────────────────────────────────────────
  const revenueGrowthYOY = h.QuarterlyRevenueGrowthYOY ?? null;
  const earningsGrowthYOY = h.QuarterlyEarningsGrowthYOY ?? null;

  // ── Profitability ─────────────────────────────────────────────────────
  const opMarginTTM = h.OperatingMarginTTM ?? null;
  const profitMarginTTM = h.ProfitMarginTTM ?? null;
  const grossMargin = (h.GrossProfitTTM != null && h.RevenueTTM > 0)
    ? h.GrossProfitTTM / h.RevenueTTM
    : null;

  // ── Efficiency ────────────────────────────────────────────────────────
  const roaTTM = h.ReturnOnAssetsTTM ?? null;
  const roeTTM = h.ReturnOnEquityTTM ?? null;

  // ── Valuation (all inverted — lower = better) ─────────────────────────
  let evEbitda = v.EnterpriseValueEbitda ?? null;
  if (evEbitda != null && (evEbitda < 0 || evEbitda > 200)) {
    evEbitda = null; // Will be hardcoded to 0th percentile in ranking
  }
  let trailingPE = v.TrailingPE ?? null;
  if (trailingPE != null && (trailingPE < 0 || trailingPE > 500)) {
    trailingPE = null;
  }
  let priceSalesTTM = v.PriceSalesTTM ?? null;
  if (priceSalesTTM != null && priceSalesTTM <= 0) {
    priceSalesTTM = null;
  }
  let priceBookMRQ = v.PriceBookMRQ ?? null;
  if (priceBookMRQ != null && priceBookMRQ <= 0) {
    priceBookMRQ = null;
  }

  // ── Capital Efficiency ────────────────────────────────────────────────
  const marketCap = h.MarketCapitalization ?? null;
  const ocfTTM = getQuarterlyTTM(fundamentals.cashFlowQ, 'totalCashFromOperatingActivities');
  const capexTTM = getQuarterlyTTM(fundamentals.cashFlowQ, 'capitalExpenditures');
  const fcfTTM = (ocfTTM != null && capexTTM != null)
    ? ocfTTM + capexTTM
    : null;
  const fcfYield = (fcfTTM != null && marketCap > 0)
    ? (fcfTTM / marketCap) * 100
    : null;
  const dividendYield = h.DividendYield ?? null;
  const revenueTTM = h.RevenueTTM ?? null;
  const fcfMargin = (fcfTTM != null && revenueTTM > 0)
    ? (fcfTTM / revenueTTM) * 100
    : null;

  // ── Momentum (placeholders — computed later from rolling price history)
  const sixMonthReturn = null;
  const threeMonthReturn = null;
  const oneMonthReturn = null;

  // ── Sentiment ─────────────────────────────────────────────────────────
  const earningsRevisions = computeEpsRevisionScore(fundamentals.earnings);
  const avgEarningsSurprise = computeAvgSurprise(fundamentals.earnings);

  // Extra fields for scanner & badges (not in composite)
  const high52 = t['52WeekHigh'] ?? null;
  const low52 = t['52WeekLow'] ?? null;
  const { ebit, interestExpense } = extractYearlyDebtMetrics(fundamentals.incomeY);

  return {
    revenueGrowthYOY,
    earningsGrowthYOY,
    opMarginTTM,
    profitMarginTTM,
    grossMargin,
    roaTTM,
    roeTTM,
    evEbitda,
    trailingPE,
    priceSalesTTM,
    priceBookMRQ,
    fcfYield,
    dividendYield,
    fcfMargin,
    sixMonthReturn,
    threeMonthReturn,
    oneMonthReturn,
    earningsRevisions,
    avgEarningsSurprise,
    marketCap,
    high52,
    low52,
    ebit,
    interestExpense,
    name: fundamentals.name,
  };
}

/**
 * Enrich metrics with current prices from bulk data and compute 6M returns
 * from rolling price history.
 */
function enrichWithPrices(allMetrics, bulkPrices, tickerHistory) {
  // Build ticker → price map from bulk data
  const priceMap = {};
  if (Array.isArray(bulkPrices)) {
    for (const entry of bulkPrices) {
      const sym = (entry.code || entry.symbol || '').replace(/\.US$/i, '');
      if (sym && entry.close) priceMap[sym] = entry.close;
    }
  }

  for (const [ticker, metrics] of Object.entries(allMetrics)) {
    // Set current price
    const price = priceMap[ticker] || priceMap[ticker.replace(/-/g, '.')];
    metrics.currentPrice = price || null;

    // Compute momentum returns from rolling price history
    if (tickerHistory) {
      const history = tickerHistory.get(ticker) || tickerHistory.get(ticker.replace(/-/g, '.'));
      if (history) {
        const current = history[0];
        // 6-month return (126 trading days)
        if (history.length >= 126 && current > 0) {
          const past126 = history[Math.min(125, history.length - 1)];
          if (past126 > 0) metrics.sixMonthReturn = ((current - past126) / past126) * 100;
        }
        // 3-month return (63 trading days)
        if (history.length >= 63 && current > 0) {
          const past63 = history[Math.min(62, history.length - 1)];
          if (past63 > 0) metrics.threeMonthReturn = ((current - past63) / past63) * 100;
        }
        // 1-month return (21 trading days)
        if (history.length >= 21 && current > 0) {
          const past21 = history[Math.min(20, history.length - 1)];
          if (past21 > 0) metrics.oneMonthReturn = ((current - past21) / past21) * 100;
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Ranking Engine (7-pillar model)
// ---------------------------------------------------------------------------

/**
 * Rank stocks within a single sector across all dimensions.
 * Computes 7 pillar percentiles (avg of constituent dimensions) and weighted composite score.
 */
function rankSectorStocks(sectorId, sectorStocks, allMetrics) {
  const stocks = sectorStocks
    .map(s => ({
      ...s,
      metrics: allMetrics[s.ticker],
    }))
    .filter(s => s.metrics);

  if (stocks.length === 0) return [];

  // Initialize ranks for each stock
  for (const stock of stocks) {
    stock.ranks = {};
  }

  // For each dimension, rank stocks within sector
  for (const [dimKey, dimDef] of Object.entries(DIMENSIONS)) {
    const withValues = stocks
      .filter(s => s.metrics[dimDef.field] != null)
      .map(s => ({ stock: s, value: s.metrics[dimDef.field] }));

    if (withValues.length === 0) continue;

    // Sort: for inverted (lower = better), sort ascending so rank 1 = lowest
    withValues.sort((a, b) =>
      dimDef.inverted ? a.value - b.value : b.value - a.value
    );

    // Assign ranks and percentiles
    withValues.forEach((item, idx) => {
      item.stock.ranks[dimKey] = {
        rank: idx + 1,
        totalWithData: withValues.length,
        value: item.value,
        percentile: withValues.length > 1
          ? Math.round(((withValues.length - 1 - idx) / (withValues.length - 1)) * 100)
          : 50,
      };
    });

    // Inverted valuation metrics: stocks with negative/null values get 0th percentile
    if (dimDef.inverted) {
      for (const stock of stocks) {
        const rawVal = stock.metrics?.[dimDef.field];
        if (rawVal == null && !stock.ranks[dimKey]) {
          stock.ranks[dimKey] = {
            rank: withValues.length + 1,
            totalWithData: withValues.length + 1,
            value: null,
            percentile: 0,
          };
        }
      }
    }
  }

  // Compute pillar scores (average of constituent dimension percentiles)
  for (const stock of stocks) {
    stock.pillars = {};
    for (const [pillarKey, pillarDef] of Object.entries(PILLARS)) {
      const pcts = pillarDef.dimensions
        .map(d => stock.ranks[d]?.percentile)
        .filter(p => p != null);

      stock.pillars[pillarKey] = pcts.length > 0
        ? Math.round(pcts.reduce((s, v) => s + v, 0) / pcts.length)
        : null;
    }
  }

  // Compute weighted composite score with weight redistribution for missing pillars
  for (const stock of stocks) {
    let totalWeight = 0;
    let weightedSum = 0;
    let availablePillars = 0;

    for (const [pillarKey, weight] of Object.entries(COMPETE_PILLAR_WEIGHTS)) {
      if (stock.pillars[pillarKey] != null) {
        totalWeight += weight;
        weightedSum += stock.pillars[pillarKey] * weight;
        availablePillars++;
      }
    }

    // Require at least 3 of 7 pillars for meaningful score
    if (availablePillars >= 3 && totalWeight > 0) {
      // Redistribute missing weights proportionally
      stock.compositeScore = Math.round(weightedSum / totalWeight);
    } else {
      stock.compositeScore = null;
    }

    stock.metricsAvailable = Object.keys(stock.ranks).length;
  }

  // Sort by composite to assign rank
  const ranked = stocks
    .filter(s => s.compositeScore != null)
    .sort((a, b) => b.compositeScore - a.compositeScore);

  ranked.forEach((s, idx) => {
    s.compositeRank = idx + 1;
    s.totalPeers = ranked.length;
    s.tier = getTierLabel(s.compositeScore);
    s.dnaBadge = generateDNABadge(s.compositeRank, s.pillars);
    s.debtRiskBadge = getDebtRiskBadge(s.metrics?.ebit, s.metrics?.interestExpense);
  });

  // Build leaderboard
  const leaderboard = ranked.map(s => ({
    rank: s.compositeRank,
    ticker: s.ticker,
    name: s.metrics.name || s.ticker,
    score: s.compositeScore,
    tier: s.tier.label,
    tierColor: s.tier.color,
  }));

  for (const s of ranked) {
    s.leaderboard = leaderboard;
  }

  // Compute sector medians for context
  const sectorMedians = {};
  for (const [dimKey, dimDef] of Object.entries(DIMENSIONS)) {
    const values = ranked
      .map(s => s.metrics?.[dimDef.field])
      .filter(v => v != null);
    sectorMedians[dimDef.field] = median(values);
  }
  for (const s of ranked) {
    s.sectorMedians = sectorMedians;
  }

  return ranked;
}

/**
 * Compute sector-level aggregate metrics for the 11-sector ranking.
 */
function computeSectorAggregate(sectorId, rankedStocks, etfPrices, spyPrices) {
  const sector = STOCK_UNIVERSE[sectorId];
  if (!rankedStocks || rankedStocks.length === 0) return null;

  // 1. Breadth: % of stocks above sector median composite
  const scores = rankedStocks.map(s => s.compositeScore).filter(v => v != null);
  const medianScore = median(scores) || 50;
  const aboveMedian = scores.filter(s => s > medianScore).length;
  const breadthPct = scores.length > 0 ? (aboveMedian / scores.length) * 100 : 50;

  // 2. 3M Relative Momentum vs SPY
  const etfReturn3M = computeReturn(etfPrices, 63);
  const spyReturn3M = computeReturn(spyPrices, 63);
  const relMomentum = (etfReturn3M != null && spyReturn3M != null)
    ? etfReturn3M - spyReturn3M
    : 0;

  // 3. Median Earnings Revision Score
  const revScores = rankedStocks
    .map(s => s.metrics?.earningsRevisions)
    .filter(v => v != null)
    .sort((a, b) => a - b);
  const medianRevisions = median(revScores) || 0;

  // 4. Median Revenue Growth
  const growths = rankedStocks
    .map(s => s.metrics?.revenueGrowthYOY)
    .filter(v => v != null);
  const medianGrowth = median(growths) || 0;

  // 5. Valuation Discount (median EV/EBITDA, lower = better)
  const evs = rankedStocks
    .map(s => s.metrics?.evEbitda)
    .filter(v => v != null && v > 0);
  const medianEV = median(evs);

  // Normalize each factor to 0-100
  const factors = {
    breadth: breadthPct,
    momentum3M: normalizeToScore(relMomentum, -20, 20),
    earningsRevisions: normalizeToScore(medianRevisions, -10, 10),
    medianGrowth: normalizeToScore((medianGrowth || 0) * 100, -10, 40),
    valuationDiscount: medianEV != null ? normalizeToScore(30 - medianEV, -30, 30) : 50,
  };

  let compositeScore = 0;
  for (const [factor, weight] of Object.entries(SECTOR_COMPOSITE_WEIGHTS)) {
    compositeScore += (factors[factor] ?? 50) * weight;
  }

  return {
    sectorId,
    name: sector.name,
    etf: sector.etf,
    color: sector.color,
    compositeScore: Math.round(compositeScore),
    breadth: {
      value: Math.round(breadthPct),
      label: `${aboveMedian} of ${scores.length} above sector median`,
    },
    factors,
    medianMetrics: {
      revenueGrowth: medianGrowth,
      evEbitda: medianEV,
      earningsRevisions: medianRevisions,
    },
    stockCount: rankedStocks.length,
    relMomentum3M: relMomentum != null ? Math.round(relMomentum * 100) / 100 : null,
  };
}

// ---------------------------------------------------------------------------
// Phase C: Coiled Spring & Running on Fumes Scanner
// ---------------------------------------------------------------------------

/**
 * Run the scanner on all ranked stocks.
 * Returns { scannerResults, scannerSummary }.
 * This function is wrapped in try/catch in the handler — it must never crash the cron.
 */
function runScanner(allRanked, tickerHistory, estimatesData) {
  const scannerResults = {}; // ticker → { coiledSpring, runningOnFumes }
  const coiledSprings = [];
  const fumes = [];

  // Check if we have enough price history for scanner
  const sampleHistory = tickerHistory?.values()?.next()?.value;
  const historyDays = sampleHistory?.length || 0;
  if (historyDays < 21) {
    logWarn(`Scanner skipped — only ${historyDays} days of price history (need ≥21)`);
    return { scannerResults, scannerSummary: buildEmptyScannerSummary() };
  }

  const hasEstimates = estimatesData != null && Object.keys(estimatesData).length > 0;
  if (!hasEstimates) {
    logWarn('Scanner skipped — estimates cache not yet populated');
    return { scannerResults, scannerSummary: buildEmptyScannerSummary() };
  }

  for (const stock of allRanked) {
    const ticker = stock.ticker;
    const m = stock.metrics;
    if (!m) continue;

    const history = tickerHistory.get(ticker) || tickerHistory.get(ticker.replace(/-/g, '.'));
    const estimates = estimatesData?.[ticker] || null;

    // Compute scanner metrics
    const annVol = history ? annualizedVolatility(history) : null;
    const vad = computeVAD(m.currentPrice, m.high52, annVol);
    const sma21 = history ? compute21dSMA(history) : null;
    const daysFromHigh = history ? daysSince52WeekHigh(history, m.high52) : 200;
    const rawDrawdown = (m.high52 && m.currentPrice)
      ? (m.high52 - m.currentPrice) / m.high52
      : null;
    const distFromHigh = (m.high52 && m.currentPrice)
      ? ((m.currentPrice - m.high52) / m.high52) * 100
      : null;

    // Extract estimates data
    const rsr = estimates?.rsr ?? null;
    const ems = estimates?.ems ?? null;
    const emsPercentile = estimates?.emsPercentile ?? null;
    const analystCount = estimates?.earningsEstimateNumberOfAnalysts ?? null;
    const revisionsUp = estimates?.epsRevisionsUpLast30days ?? 0;
    const revisionsDown = estimates?.epsRevisionsDownLast30days ?? 0;
    const revisionVolume = revisionsUp + revisionsDown;

    const scannerEntry = { coiledSpring: null, runningOnFumes: null };

    // --- COILED SPRING GATES ---
    const springGates = {
      vadAboveThreshold: vad != null && vad > 0.85,
      solvent: m.opMarginTTM != null && m.opMarginTTM > 0,
      analystCoverage: analystCount != null && analystCount >= 4,
      revisionFloor: rsr != null && rsr >= 0.50,
      revisionVolume: revisionVolume >= 3,
      aboveSMA: m.currentPrice != null && sma21 != null && m.currentPrice > sma21,
      temporalWindow: daysFromHigh >= 21 && daysFromHigh <= 150,
    };

    const passesAllSpringGates = Object.values(springGates).every(Boolean);

    if (passesAllSpringGates) {
      coiledSprings.push({
        ticker,
        sectorId: stock.sectorId,
        vad,
        rawDrawdown,
        rsr,
        emsPercentile: emsPercentile || 0,
        revisionScore: (rsr || 0) + (emsPercentile || 0),
        daysFromHigh,
        currentPrice: m.currentPrice,
        high52: m.high52,
        sma21,
        name: m.name,
      });
    }

    // --- RUNNING ON FUMES GATES ---
    const fumesGates = {
      nearHigh: distFromHigh != null && distFromHigh > -5,
      deterioratingRevisions: rsr != null && rsr < 0.40,
      revisionVolume: revisionVolume >= 3,
      analystCoverage: analystCount != null && analystCount >= 4,
    };

    const passesAllFumesGates = Object.values(fumesGates).every(Boolean);

    if (passesAllFumesGates) {
      fumes.push({
        ticker,
        sectorId: stock.sectorId,
        rsr,
        distFromHigh,
        currentPrice: m.currentPrice,
        high52: m.high52,
        name: m.name,
      });
    }

    scannerResults[ticker] = scannerEntry;
  }

  // Score Coiled Springs
  scoreCoiledSprings(coiledSprings, scannerResults);

  // Score Running on Fumes
  scoreRunningOnFumes(fumes, scannerResults);

  // Build scanner summary
  const scannerSummary = buildScannerSummary(coiledSprings, fumes);

  return { scannerResults, scannerSummary };
}

function scoreCoiledSprings(candidates, scannerResults) {
  if (candidates.length === 0) return;

  // Group by sector
  const bySector = {};
  for (const c of candidates) {
    if (!bySector[c.sectorId]) bySector[c.sectorId] = [];
    bySector[c.sectorId].push(c);
  }

  for (const c of candidates) {
    const sectorPeers = bySector[c.sectorId] || [];
    // Use cross-sector pool if fewer than 3 in sector
    const pool = sectorPeers.length >= 3 ? sectorPeers : candidates;
    const crossSector = sectorPeers.length < 3;

    const vadValues = pool.map(p => p.vad).sort((a, b) => a - b);
    const revValues = pool.map(p => p.revisionScore).sort((a, b) => a - b);

    const zDrawdown = percentileRank(c.vad, vadValues);
    const zRevisions = percentileRank(c.revisionScore, revValues);

    const score = Math.round((zRevisions * 0.65) + (zDrawdown * 0.35));

    const narrative = generateSpringNarrative({
      rawDrawdown: c.rawDrawdown,
      vad: c.vad,
      rsr: c.rsr,
      currentPrice: c.currentPrice,
      sma21: c.sma21,
    });

    scannerResults[c.ticker].coiledSpring = {
      qualifies: true,
      score,
      vad: Math.round(c.vad * 100) / 100,
      rawDrawdown: Math.round((c.rawDrawdown || 0) * 1000) / 1000,
      annualizedVol: c.vad && c.rawDrawdown ? Math.round((c.rawDrawdown / c.vad) * 1000) / 1000 : null,
      daysSinceHigh: c.daysFromHigh,
      rsr: Math.round((c.rsr || 0) * 100) / 100,
      ems: c.emsPercentile || null,
      price21dSMA: c.sma21 ? Math.round(c.sma21 * 100) / 100 : null,
      currentPrice: c.currentPrice,
      high52Week: c.high52,
      narrative,
      crossSector,
    };
  }
}

function scoreRunningOnFumes(candidates, scannerResults) {
  if (candidates.length === 0) return;

  const rsrInverted = candidates.map(c => 1 - (c.rsr || 0)).sort((a, b) => a - b);
  const proximityValues = candidates
    .map(c => 1 - Math.abs((c.distFromHigh || 0) / 100))
    .sort((a, b) => a - b);

  for (const c of candidates) {
    const revDeterioration = percentileRank(1 - (c.rsr || 0), rsrInverted);
    const proximityToHigh = percentileRank(
      1 - Math.abs((c.distFromHigh || 0) / 100),
      proximityValues
    );

    const score = Math.round((revDeterioration * 0.65) + (proximityToHigh * 0.35));

    const narrative = generateFumesNarrative({
      distFromHigh: c.distFromHigh,
      rsr: c.rsr,
    });

    scannerResults[c.ticker].runningOnFumes = {
      qualifies: true,
      score,
      distFromHigh: Math.round((c.distFromHigh || 0) * 100) / 100,
      rsr: Math.round((c.rsr || 0) * 100) / 100,
      currentPrice: c.currentPrice,
      high52Week: c.high52,
      narrative,
    };
  }
}

function buildScannerSummary(coiledSprings, fumes) {
  // Sort by score descending
  const sortedSprings = [...coiledSprings].sort((a, b) => {
    const sa = a._score || 0;
    const sb = b._score || 0;
    return sb - sa;
  });

  // Build sector counts for springs
  const springBySector = {};
  for (const c of coiledSprings) {
    const sectorName = STOCK_UNIVERSE[c.sectorId]?.name || c.sectorId;
    if (!springBySector[sectorName]) {
      springBySector[sectorName] = { count: 0, tickers: [], sectorSignal: false };
    }
    springBySector[sectorName].count++;
    springBySector[sectorName].tickers.push(c.ticker);
  }
  // Flag sector signal if ≥4 (≥20% of ~20 stocks)
  for (const sector of Object.values(springBySector)) {
    sector.sectorSignal = sector.count >= 4;
  }

  // Build sector counts for fumes
  const fumesBySector = {};
  for (const c of fumes) {
    const sectorName = STOCK_UNIVERSE[c.sectorId]?.name || c.sectorId;
    if (!fumesBySector[sectorName]) {
      fumesBySector[sectorName] = { count: 0, tickers: [], sectorSignal: false };
    }
    fumesBySector[sectorName].count++;
    fumesBySector[sectorName].tickers.push(c.ticker);
  }

  return {
    computedAt: new Date().toISOString(),
    coiledSprings: {
      total: coiledSprings.length,
      top3: coiledSprings.slice(0, 3).map(c => ({
        ticker: c.ticker,
        sector: STOCK_UNIVERSE[c.sectorId]?.name || c.sectorId,
        score: c._score || 0,
        drawdown: c.rawDrawdown != null ? `${Math.round(c.rawDrawdown * 100)}%` : null,
        rsr: c.rsr != null ? Math.round(c.rsr * 100) / 100 : null,
      })),
      bySector: springBySector,
    },
    runningOnFumes: {
      total: fumes.length,
      top3: fumes.slice(0, 3).map(c => ({
        ticker: c.ticker,
        sector: STOCK_UNIVERSE[c.sectorId]?.name || c.sectorId,
        score: c._score || 0,
        distFromHigh: c.distFromHigh != null ? `${Math.abs(Math.round(c.distFromHigh * 100) / 100)}%` : null,
        rsr: c.rsr != null ? Math.round(c.rsr * 100) / 100 : null,
      })),
      bySector: fumesBySector,
    },
  };
}

function buildEmptyScannerSummary() {
  return {
    computedAt: new Date().toISOString(),
    coiledSprings: { total: 0, top3: [], bySector: {} },
    runningOnFumes: { total: 0, top3: [], bySector: {} },
  };
}

// ---------------------------------------------------------------------------
// Firestore Persistence
// ---------------------------------------------------------------------------

async function persistResults(db, allRanked, sectorAggregates, scannerResults, scannerSummary) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 26 * 60 * 60 * 1000); // 26 hours

  // Sort sector aggregates for cross-sector ranking
  const sortedSectors = [...sectorAggregates]
    .filter(Boolean)
    .sort((a, b) => b.compositeScore - a.compositeScore);
  sortedSectors.forEach((s, idx) => {
    s.rank = idx + 1;
    s.totalSectors = sortedSectors.length;
    s.tier = getTierLabel(s.compositeScore);
  });

  const sectorSummaryMap = {};
  for (const s of sortedSectors) {
    sectorSummaryMap[s.sectorId] = {
      rank: s.rank,
      totalSectors: s.totalSectors,
      compositeScore: s.compositeScore,
      breadth: s.breadth,
      name: s.name,
      tier: s.tier,
    };
  }

  // Batch write — up to 500 ops per batch, we have ~221 + 2
  const batch = db.batch();
  let opCount = 0;

  for (const stock of allRanked) {
    const ref = db.collection('peerRankings').doc(stock.ticker);
    const scannerData = scannerResults?.[stock.ticker] || { coiledSpring: null, runningOnFumes: null };

    // Build per-dimension detail for each pillar
    const pillarDetails = {};
    for (const [pillarKey, pillarDef] of Object.entries(PILLARS)) {
      const dimensions = {};
      for (const dimKey of pillarDef.dimensions) {
        const dimRank = stock.ranks?.[dimKey];
        const dimDef = DIMENSIONS[dimKey];
        if (dimRank) {
          dimensions[dimKey] = {
            value: dimRank.value,
            rank: dimRank.rank,
            percentile: dimRank.percentile,
            sectorMedian: stock.sectorMedians?.[dimDef?.field] ?? null,
          };
        }
      }
      pillarDetails[pillarKey] = {
        percentile: stock.pillars?.[pillarKey] ?? null,
        dimensions,
        dimension: Object.values(dimensions)[0] || null,
      };
    }

    const doc = {
      ticker: stock.ticker,
      name: stock.metrics?.name || stock.ticker,
      sectorId: stock.sectorId,
      sectorName: STOCK_UNIVERSE[stock.sectorId]?.name || 'Unknown',
      compositeScore: stock.compositeScore,
      compositeRank: stock.compositeRank,
      totalPeers: stock.totalPeers,
      metricsAvailable: stock.metricsAvailable,
      tier: stock.tier,
      dnaBadge: stock.dnaBadge || null,
      pillars: pillarDetails,
      metrics: {
        revenueGrowthYOY: stock.metrics?.revenueGrowthYOY ?? null,
        earningsGrowthYOY: stock.metrics?.earningsGrowthYOY ?? null,
        opMarginTTM: stock.metrics?.opMarginTTM ?? null,
        profitMarginTTM: stock.metrics?.profitMarginTTM ?? null,
        grossMargin: stock.metrics?.grossMargin ?? null,
        roaTTM: stock.metrics?.roaTTM ?? null,
        roeTTM: stock.metrics?.roeTTM ?? null,
        evEbitda: stock.metrics?.evEbitda ?? null,
        trailingPE: stock.metrics?.trailingPE ?? null,
        priceSalesTTM: stock.metrics?.priceSalesTTM ?? null,
        priceBookMRQ: stock.metrics?.priceBookMRQ ?? null,
        fcfYield: stock.metrics?.fcfYield ?? null,
        dividendYield: stock.metrics?.dividendYield ?? null,
        fcfMargin: stock.metrics?.fcfMargin ?? null,
        sixMonthReturn: stock.metrics?.sixMonthReturn ?? null,
        threeMonthReturn: stock.metrics?.threeMonthReturn ?? null,
        oneMonthReturn: stock.metrics?.oneMonthReturn ?? null,
        earningsRevisions: stock.metrics?.earningsRevisions ?? null,
        avgEarningsSurprise: stock.metrics?.avgEarningsSurprise ?? null,
        marketCap: stock.metrics?.marketCap ?? null,
      },
      debtRiskBadge: stock.debtRiskBadge || null,
      scanner: scannerData,
      leaderboard: stock.leaderboard,
      sectorSummary: sectorSummaryMap[stock.sectorId] || null,
      computedAt: now,
      expiresAt,
    };
    batch.set(ref, doc);
    opCount++;
  }

  // Write sector rankings
  const sectorRef = db.collection('sectorRankings').doc('latest');
  batch.set(sectorRef, {
    sectors: sortedSectors,
    computedAt: now,
    expiresAt,
  });
  opCount++;

  // Write scanner summary
  if (scannerSummary) {
    const scannerRef = db.collection('scannerSummary').doc('latest');
    batch.set(scannerRef, scannerSummary);
    opCount++;
  }

  await batch.commit();
  logInfo(`Persisted ${opCount} documents to Firestore (${allRanked.length} stocks + sector + scanner)`);
}

// ---------------------------------------------------------------------------
// Main Handler
// ---------------------------------------------------------------------------

export default async function handler(req, res) {
  // Verify cron auth
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const authHeader = req.headers.authorization;
  if (req.method === 'GET' && !isVercelCron && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();
  logInfo('Rankings cron started');

  const API_KEY = process.env.EODHD_API_KEY;
  if (!API_KEY) {
    logError('EODHD_API_KEY not configured');
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const db = getFirebaseAdmin();

    // ===== PHASE A: DATA FETCHING =====

    // A1: Build flat stock list
    const allStocks = [];
    for (const [sectorId, sector] of Object.entries(STOCK_UNIVERSE)) {
      for (const ticker of sector.stocks) {
        allStocks.push({ ticker, sectorId });
      }
    }
    logInfo(`Stock universe: ${allStocks.length} stocks across ${Object.keys(STOCK_UNIVERSE).length} sectors`);

    // A2: Fetch fundamentals (batched, ~220 calls)
    const allFundamentals = await fetchAllFundamentals(allStocks, API_KEY);
    const fetchedCount = Object.keys(allFundamentals).length;
    logInfo(`Fundamentals fetched: ${fetchedCount}/${allStocks.length}`);

    if (fetchedCount < 50) {
      logError('Too few fundamentals fetched — aborting');
      return res.status(500).json({
        error: 'Insufficient data',
        message: `Only ${fetchedCount} of ${allStocks.length} fundamentals fetched`,
      });
    }

    // A3: Fetch bulk last-day prices (1 call)
    let bulkPrices = [];
    try {
      const bulkRes = await fetch(
        `${API_BASE}/eod-bulk-last-day/US?api_token=${API_KEY}&fmt=json`
      );
      if (bulkRes.ok) bulkPrices = await bulkRes.json();
      logInfo(`Bulk prices: ${bulkPrices.length} entries`);
    } catch (err) {
      logWarn(`Bulk price fetch failed: ${err.message}`);
    }

    // A4: Fetch historical prices for SPY + sector ETFs (13 calls)
    const historicalPrices = {};
    const etfSymbols = ['SPY', ...Object.values(STOCK_UNIVERSE).map(s => s.etf)];
    const etfPromises = etfSymbols.map(sym =>
      fetchHistoricalPrices(sym, API_KEY, 180).catch(err => {
        logWarn(`Historical fetch failed for ${sym}: ${err.message}`);
        return [];
      })
    );
    const etfResults = await Promise.all(etfPromises);
    etfSymbols.forEach((sym, idx) => {
      historicalPrices[sym] = etfResults[idx];
    });
    logInfo(`Historical prices fetched for ${etfSymbols.length} ETFs`);

    // A5: Update rolling price history (for scanner + 6M returns)
    const tickerHistory = await updateRollingPriceHistory(db, bulkPrices, API_KEY);

    // A6: Read estimates cache (for scanner revision gates)
    let estimatesData = null;
    try {
      const estDoc = await db.collection('estimatesCache').doc('latest').get();
      if (estDoc.exists) {
        estimatesData = estDoc.data()?.stocks || estDoc.data();
        logInfo(`Estimates cache loaded: ${Object.keys(estimatesData).length} stocks`);
      } else {
        logWarn('Estimates cache not found — scanner will be skipped');
      }
    } catch (err) {
      logWarn(`Failed to read estimates cache: ${err.message}`);
    }

    // ===== PHASE B: RANKING COMPUTATION =====

    // B1: Extract metrics
    const allMetrics = {};
    for (const { ticker } of allStocks) {
      if (allFundamentals[ticker]) {
        allMetrics[ticker] = extractMetrics(ticker, allFundamentals[ticker]);
      }
    }

    // B2: Enrich with prices + 6M returns
    enrichWithPrices(allMetrics, bulkPrices, tickerHistory);

    const metricsCount = Object.keys(allMetrics).length;
    logInfo(`Metrics extracted for ${metricsCount} stocks`);

    // B3: Rank within each sector
    const allRanked = [];
    const sectorAggregates = [];

    for (const [sectorId, sector] of Object.entries(STOCK_UNIVERSE)) {
      const sectorStocks = allStocks.filter(s => s.sectorId === sectorId);
      const ranked = rankSectorStocks(sectorId, sectorStocks, allMetrics);
      allRanked.push(...ranked);

      const etfPrices = historicalPrices[sector.etf] || [];
      const spyPrices = historicalPrices['SPY'] || [];
      const agg = computeSectorAggregate(sectorId, ranked, etfPrices, spyPrices);
      if (agg) sectorAggregates.push(agg);

      logInfo(`Sector ${sector.name}: ${ranked.length} ranked, top: ${ranked[0]?.ticker || 'N/A'} (${ranked[0]?.compositeScore ?? 'N/A'})`);
    }

    logInfo(`Total ranked: ${allRanked.length} stocks, ${sectorAggregates.length} sectors`);

    // ===== PHASE C: SCANNER (wrapped in try/catch — never blocks rankings) =====

    let scannerResults = {};
    let scannerSummary = buildEmptyScannerSummary();

    try {
      const scannerOutput = runScanner(allRanked, tickerHistory, estimatesData);
      scannerResults = scannerOutput.scannerResults;
      scannerSummary = scannerOutput.scannerSummary;

      const springCount = scannerSummary.coiledSprings?.total || 0;
      const fumesCount = scannerSummary.runningOnFumes?.total || 0;
      logInfo(`Scanner complete: ${springCount} Coiled Springs, ${fumesCount} Running on Fumes`);
    } catch (scannerErr) {
      logError(`Scanner failed (rankings will still persist): ${scannerErr.message}`);
      console.error(scannerErr.stack);
    }

    // ===== PHASE D: PERSIST =====

    await persistResults(db, allRanked, sectorAggregates, scannerResults, scannerSummary);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    logInfo(`Rankings cron complete in ${elapsed}s`);

    return res.status(200).json({
      success: true,
      message: `Rankings computed in ${elapsed}s`,
      stats: {
        stocksFetched: fetchedCount,
        stocksRanked: allRanked.length,
        sectorsRanked: sectorAggregates.length,
        coiledSprings: scannerSummary.coiledSprings?.total || 0,
        runningOnFumes: scannerSummary.runningOnFumes?.total || 0,
        priceHistoryDays: tickerHistory?.values()?.next()?.value?.length || 0,
        elapsedSeconds: parseFloat(elapsed),
      },
    });

  } catch (error) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    logError(`Rankings cron failed after ${elapsed}s: ${error.message}`);
    console.error(error.stack);
    return res.status(500).json({
      error: 'Rankings computation failed',
      message: error.message,
      elapsed: parseFloat(elapsed),
    });
  }
}
