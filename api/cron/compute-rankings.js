// api/cron/compute-rankings.js
// Daily pre-market cron: computes sector-adjusted peer rankings for ~220 stocks.
//
// Schedule: 0 11 * * 1-5 (UTC 11:00 = ET 6:00 AM / 7:00 AM, Mon–Fri)
//
// Flow:
//   1. Fetch EODHD fundamentals for all stocks in universe (batched 10-at-a-time)
//   2. Fetch historical prices for SPY + 11 sector ETFs (13 calls)
//   3. Extract 8 raw metrics per stock
//   4. Rank within each sector → percentile scores
//   5. Compute composite score + tier labels
//   6. Compute sector-level aggregates (composite + breadth)
//   7. Persist to Firestore (peerRankings + sectorRankings collections)
//
// Total API calls: ~233 (220 fundamentals + 13 historical)
// Expected runtime: ~12-15 seconds

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import {
  STOCK_UNIVERSE,
  DIMENSIONS,
  PILLARS,
  SECTOR_COMPOSITE_WEIGHTS,
  EODHD_FUNDAMENTALS_FILTER,
  getTierLabel,
  normalizeToScore,
  computeReturn,
} from '../_utils/rankingConfig.js';

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

// ---------------------------------------------------------------------------
// EODHD Fetchers
// ---------------------------------------------------------------------------

const API_BASE = 'https://eodhd.com/api';

async function fetchSingleFundamental(ticker, apiKey) {
  // Normalize ticker for EODHD (BRK-B → BRK-B.US, dots are fine)
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

    // Rate-limit between batches
    if (i + BATCH_SIZE < stocks.length) {
      await sleep(DELAY_MS);
    }

    // Progress log every 50 stocks
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
  // Prefer current-year estimate, fall back to next-quarter
  const trend = trendEntries.find(t => t.period === '0y')
    || trendEntries.find(t => t.period === '+1q');
  if (!trend) return null;

  const current = parseFloat(trend.epsTrendCurrent);
  const ago30 = parseFloat(trend.epsTrend30daysAgo);

  if (isNaN(current) || isNaN(ago30) || ago30 === 0) return null;
  return ((current - ago30) / Math.abs(ago30)) * 100;
}

/**
 * Extract the 8 raw metrics from EODHD fundamentals data.
 */
function extractMetrics(ticker, fundamentals) {
  const h = fundamentals.highlights;
  const v = fundamentals.valuation;
  const t = fundamentals.technicals;

  // 1. Revenue Growth YoY (as decimal, e.g., 0.12 = 12%)
  const revenueGrowthYOY = h.QuarterlyRevenueGrowthYOY ?? null;

  // 2. Operating Margin TTM (as decimal, e.g., 0.25 = 25%)
  const opMarginTTM = h.OperatingMarginTTM ?? null;

  // 3. ROA TTM (as decimal)
  const roaTTM = h.ReturnOnAssetsTTM ?? null;

  // 4. Forward P/E
  const forwardPE = v.ForwardPE ?? null;

  // 5. FCF Yield = TTM FCF / Market Cap
  //    FCF = Operating Cash Flow + CapEx (CapEx is negative in EODHD)
  const marketCap = h.MarketCapitalization ?? null;
  const ocfTTM = getQuarterlyTTM(fundamentals.cashFlowQ, 'totalCashFromOperatingActivities');
  const capexTTM = getQuarterlyTTM(fundamentals.cashFlowQ, 'capitalExpenditures');
  const fcfTTM = (ocfTTM != null && capexTTM != null)
    ? ocfTTM + capexTTM  // CapEx is negative, so OCF + CapEx = OCF - |CapEx|
    : null;
  const fcfYield = (fcfTTM != null && marketCap > 0)
    ? (fcfTTM / marketCap) * 100
    : null;

  // 6. Interest Coverage = TTM Operating Income / |TTM Interest Expense|
  //    Use operatingIncome (more reliably reported than ebit)
  const ebitTTM = getQuarterlyTTM(fundamentals.incomeQ, 'operatingIncome');
  const intExpTTM = getQuarterlyTTM(fundamentals.incomeQ, 'interestExpense');
  let interestCoverage = null;
  if (ebitTTM != null && intExpTTM != null && Math.abs(intExpTTM) > 0) {
    interestCoverage = ebitTTM / Math.abs(intExpTTM);
    // Cap at a reasonable max to avoid outliers
    if (interestCoverage > 200) interestCoverage = 200;
  }

  // 7. 52-Week Range Position
  const high52 = t['52WeekHigh'] ?? null;
  const low52 = t['52WeekLow'] ?? null;
  let range52wPosition = null;
  if (high52 && low52 && high52 > low52) {
    // Derive current price from market cap / shares or use midpoint
    // EODHD Highlights doesn't include current price directly,
    // but we can derive: SharesOutstanding is not in our filter.
    // Instead, use the 52w range position formula with the
    // last available data. If we have the technicals, we also
    // typically have the last price nearby. Use Beta as a proxy check.
    // For now, use a simple heuristic: if we have market cap and
    // shares outstanding (not in filter), fall back to midpoint estimate.
    // Actually — we'll compute this when we get bulk prices.
    range52wPosition = null; // Will be filled from bulk prices
  }

  // 8. EPS Revision Score
  const epsRevisionScore = computeEpsRevisionScore(fundamentals.earnings);

  // 9. EPS Growth Forward = (next-year EPS estimate / current-year) - 1
  let epsGrowthForward = null;
  if (fundamentals.earnings?.Trend) {
    const trendEntries = Object.values(fundamentals.earnings.Trend);
    const current0y = trendEntries.find(t => t.period === '0y');
    const next1y = trendEntries.find(t => t.period === '+1y');
    const epsNow = parseFloat(current0y?.earningsEstimateAvg);
    const epsNext = parseFloat(next1y?.earningsEstimateAvg);
    if (!isNaN(epsNow) && !isNaN(epsNext) && Math.abs(epsNow) > 0) {
      epsGrowthForward = ((epsNext - epsNow) / Math.abs(epsNow)) * 100;
    }
  }

  // 10. Profitability Margin Trend (Current TTM margin vs Prior TTM margin)
  let marginTrend = null;
  const sortedQuarters = Object.values(fundamentals.incomeQ)
    .filter(q => q.date)
    .sort((a, b) => b.date.localeCompare(a.date));

  if (sortedQuarters.length >= 8) {
    const currentRev = sortedQuarters.slice(0, 4).reduce((s, q) => s + (parseFloat(q.totalRevenue) || 0), 0);
    const currentOp  = sortedQuarters.slice(0, 4).reduce((s, q) => s + (parseFloat(q.operatingIncome) || 0), 0);
    const priorRev   = sortedQuarters.slice(4, 8).reduce((s, q) => s + (parseFloat(q.totalRevenue) || 0), 0);
    const priorOp    = sortedQuarters.slice(4, 8).reduce((s, q) => s + (parseFloat(q.operatingIncome) || 0), 0);

    if (currentRev > 0 && priorRev > 0) {
      const currentMargin = currentOp / currentRev;
      const priorMargin = priorOp / priorRev;
      marginTrend = (currentMargin - priorMargin) * 100; // percentage points
    }
  }

  return {
    revenueGrowthYOY,
    opMarginTTM,
    roaTTM,
    forwardPE,
    fcfYield,
    interestCoverage,
    range52wPosition,
    epsRevisionScore,
    epsGrowthForward,
    marginTrend,
    marketCap,
    high52,
    low52,
    name: fundamentals.name,
  };
}

/**
 * Fill in range52wPosition using bulk last-day prices.
 */
function enrichWithPrices(allMetrics, bulkPrices) {
  // Build ticker → price map from bulk data
  const priceMap = {};
  if (Array.isArray(bulkPrices)) {
    for (const entry of bulkPrices) {
      const sym = (entry.code || entry.symbol || '').replace(/\.US$/i, '');
      if (sym && entry.close) priceMap[sym] = entry.close;
    }
  }

  for (const [ticker, metrics] of Object.entries(allMetrics)) {
    const price = priceMap[ticker] || priceMap[ticker.replace(/-/g, '.')];
    if (price && metrics.high52 && metrics.low52 && metrics.high52 > metrics.low52) {
      metrics.range52wPosition = ((price - metrics.low52) / (metrics.high52 - metrics.low52)) * 100;
      // Clamp to 0-100
      metrics.range52wPosition = Math.max(0, Math.min(100, metrics.range52wPosition));
    }
    metrics.currentPrice = price || null;
  }
}

// ---------------------------------------------------------------------------
// Ranking Engine
// ---------------------------------------------------------------------------

/**
 * Rank stocks within a single sector across all 8 dimensions.
 * Returns an array of ranked stock objects.
 */
function rankSectorStocks(sectorId, sectorStocks, allMetrics) {
  const sector = STOCK_UNIVERSE[sectorId];
  const stocks = sectorStocks
    .map(s => ({
      ...s,
      metrics: allMetrics[s.ticker],
    }))
    .filter(s => s.metrics);

  const n = stocks.length;
  if (n === 0) return [];

  // Initialize ranks/percentiles for each stock
  for (const stock of stocks) {
    stock.ranks = {};
  }

  // For each dimension, rank stocks
  for (const [dimKey, dimDef] of Object.entries(DIMENSIONS)) {
    const withValues = stocks
      .filter(s => s.metrics[dimDef.field] != null)
      .map(s => ({ stock: s, value: s.metrics[dimDef.field] }));

    if (withValues.length === 0) continue;

    // Sort: for inverted dimensions (lower = better), sort ascending
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
  }

  // Compute pillar scores (weighted average of constituent dimension percentiles)
  for (const stock of stocks) {
    stock.pillars = {};
    for (const [pillarKey, pillarDef] of Object.entries(PILLARS)) {
      const defaultWeight = 1 / pillarDef.dimensions.length;
      let totalWeight = 0;
      let weightedSum = 0;

      pillarDef.dimensions.forEach((d, i) => {
        const pct = stock.ranks[d]?.percentile;
        if (pct != null) {
          const w = pillarDef.weights?.[i] ?? defaultWeight;
          totalWeight += w;
          weightedSum += pct * w;
        }
      });

      stock.pillars[pillarKey] = totalWeight > 0
        ? Math.round(weightedSum / totalWeight)
        : null;
    }
  }

  // Compute composite score = average of all available pillar scores
  for (const stock of stocks) {
    const pillarScores = Object.values(stock.pillars).filter(v => v != null);
    // Require at least 3 of 6 pillars for a meaningful score
    stock.compositeScore = pillarScores.length >= 3
      ? Math.round(pillarScores.reduce((s, v) => s + v, 0) / pillarScores.length)
      : null;
    stock.metricsAvailable = Object.keys(stock.ranks).length;
  }

  // Sort by composite score to assign overall rank
  const ranked = stocks
    .filter(s => s.compositeScore != null)
    .sort((a, b) => b.compositeScore - a.compositeScore);

  ranked.forEach((s, idx) => {
    s.compositeRank = idx + 1;
    s.totalPeers = ranked.length;
    s.tier = getTierLabel(s.compositeScore);
  });

  // Build leaderboard array for this sector
  const leaderboard = ranked.map(s => ({
    rank: s.compositeRank,
    ticker: s.ticker,
    name: s.metrics.name || s.ticker,
    score: s.compositeScore,
    tier: s.tier.label,
    tierColor: s.tier.color,
  }));

  // Attach leaderboard to each stock
  for (const s of ranked) {
    s.leaderboard = leaderboard;
  }

  return ranked;
}

/**
 * Compute sector-level aggregate metrics for the 11-sector ranking.
 */
function computeSectorAggregate(sectorId, rankedStocks, etfPrices, spyPrices) {
  const sector = STOCK_UNIVERSE[sectorId];
  if (!rankedStocks || rankedStocks.length === 0) return null;

  // 1. Breadth: % of stocks with 52w range position > 50
  const withRange = rankedStocks.filter(s => s.metrics?.range52wPosition != null);
  const above50 = withRange.filter(s => s.metrics.range52wPosition > 50).length;
  const breadthPct = withRange.length > 0 ? (above50 / withRange.length) * 100 : 50;

  // 2. 3M Relative Momentum vs SPY
  const etfReturn3M = computeReturn(etfPrices, 63);
  const spyReturn3M = computeReturn(spyPrices, 63);
  const relMomentum = (etfReturn3M != null && spyReturn3M != null)
    ? etfReturn3M - spyReturn3M
    : 0;

  // 3. Median Earnings Revision Score
  const revScores = rankedStocks
    .map(s => s.metrics?.epsRevisionScore)
    .filter(v => v != null)
    .sort((a, b) => a - b);
  const medianRevisions = revScores.length > 0
    ? revScores[Math.floor(revScores.length / 2)]
    : 0;

  // 4. Median Revenue Growth
  const growths = rankedStocks
    .map(s => s.metrics?.revenueGrowthYOY)
    .filter(v => v != null)
    .sort((a, b) => a - b);
  const medianGrowth = growths.length > 0
    ? growths[Math.floor(growths.length / 2)]
    : 0;

  // 5. Valuation Discount (Phase 1: just median Forward P/E, lower is better)
  const pes = rankedStocks
    .map(s => s.metrics?.forwardPE)
    .filter(v => v != null && v > 0)
    .sort((a, b) => a - b);
  const medianPE = pes.length > 0
    ? pes[Math.floor(pes.length / 2)]
    : null;

  // Normalize each factor to 0-100
  const factors = {
    breadth: breadthPct,
    momentum3M: normalizeToScore(relMomentum, -20, 20),
    earningsRevisions: normalizeToScore(medianRevisions, -10, 10),
    medianGrowth: normalizeToScore((medianGrowth || 0) * 100, -10, 40),
    valuationDiscount: medianPE != null ? normalizeToScore(30 - medianPE, -30, 30) : 50,
  };

  // Weighted composite
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
      label: `${above50} of ${withRange.length} above 52w midpoint`,
    },
    factors,
    medianMetrics: {
      revenueGrowth: medianGrowth,
      forwardPE: medianPE,
      earningsRevisions: medianRevisions,
    },
    stockCount: rankedStocks.length,
    relMomentum3M: relMomentum != null ? Math.round(relMomentum * 100) / 100 : null,
  };
}

// ---------------------------------------------------------------------------
// Firestore Persistence
// ---------------------------------------------------------------------------

async function persistResults(db, allRanked, sectorAggregates) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 26 * 60 * 60 * 1000); // 26 hours

  // Sort sector aggregates by composite score for cross-sector ranking
  const sortedSectors = [...sectorAggregates]
    .filter(Boolean)
    .sort((a, b) => b.compositeScore - a.compositeScore);
  sortedSectors.forEach((s, idx) => {
    s.rank = idx + 1;
    s.totalSectors = sortedSectors.length;
    s.tier = getTierLabel(s.compositeScore);
  });

  // Build sector summary lookup for embedding in per-stock docs
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

  // Batch write — up to 500 ops per batch, we have ~221
  const batch = db.batch();
  let opCount = 0;

  for (const stock of allRanked) {
    const ref = db.collection('peerRankings').doc(stock.ticker);
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
      dimensions: stock.ranks,
      pillars: stock.pillars,
      metrics: {
        revenueGrowthYOY: stock.metrics?.revenueGrowthYOY,
        opMarginTTM: stock.metrics?.opMarginTTM,
        roaTTM: stock.metrics?.roaTTM,
        forwardPE: stock.metrics?.forwardPE,
        fcfYield: stock.metrics?.fcfYield,
        interestCoverage: stock.metrics?.interestCoverage,
        range52wPosition: stock.metrics?.range52wPosition,
        epsRevisionScore: stock.metrics?.epsRevisionScore,
        epsGrowthForward: stock.metrics?.epsGrowthForward,
        marginTrend: stock.metrics?.marginTrend,
        marketCap: stock.metrics?.marketCap,
      },
      leaderboard: stock.leaderboard,
      sectorSummary: sectorSummaryMap[stock.sectorId] || null,
      computedAt: now,
      expiresAt,
    };
    batch.set(ref, doc);
    opCount++;
  }

  // Write sector rankings document
  const sectorRef = db.collection('sectorRankings').doc('latest');
  batch.set(sectorRef, {
    sectors: sortedSectors,
    computedAt: now,
    expiresAt,
  });
  opCount++;

  await batch.commit();
  logInfo(`Persisted ${opCount} documents to Firestore (${allRanked.length} stocks + 1 sector doc)`);
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
    // Step 1: Build flat stock list
    const allStocks = [];
    for (const [sectorId, sector] of Object.entries(STOCK_UNIVERSE)) {
      for (const ticker of sector.stocks) {
        allStocks.push({ ticker, sectorId });
      }
    }
    logInfo(`Stock universe: ${allStocks.length} stocks across ${Object.keys(STOCK_UNIVERSE).length} sectors`);

    // Step 2: Fetch fundamentals (batched, ~220 calls)
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

    // Step 3: Fetch bulk last-day prices (1 call)
    let bulkPrices = [];
    try {
      const bulkRes = await fetch(
        `${API_BASE}/eod-bulk-last-day/US?api_token=${API_KEY}&fmt=json`
      );
      if (bulkRes.ok) bulkPrices = await bulkRes.json();
      logInfo(`Bulk prices: ${bulkPrices.length} entries`);
    } catch (err) {
      logWarn(`Bulk price fetch failed: ${err.message} — 52w position will be unavailable`);
    }

    // Step 4: Fetch historical prices for SPY + sector ETFs (13 calls)
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

    // Step 5: Extract metrics
    const allMetrics = {};
    for (const { ticker } of allStocks) {
      if (allFundamentals[ticker]) {
        allMetrics[ticker] = extractMetrics(ticker, allFundamentals[ticker]);
      }
    }

    // Enrich with bulk prices (fills range52wPosition)
    enrichWithPrices(allMetrics, bulkPrices);

    const metricsCount = Object.keys(allMetrics).length;
    logInfo(`Metrics extracted for ${metricsCount} stocks`);

    // Step 6: Rank within each sector
    const allRanked = [];
    const sectorAggregates = [];

    for (const [sectorId, sector] of Object.entries(STOCK_UNIVERSE)) {
      const sectorStocks = allStocks.filter(s => s.sectorId === sectorId);
      const ranked = rankSectorStocks(sectorId, sectorStocks, allMetrics);
      allRanked.push(...ranked);

      // Compute sector aggregate
      const etfPrices = historicalPrices[sector.etf] || [];
      const spyPrices = historicalPrices['SPY'] || [];
      const agg = computeSectorAggregate(sectorId, ranked, etfPrices, spyPrices);
      if (agg) sectorAggregates.push(agg);

      logInfo(`Sector ${sector.name}: ${ranked.length} stocks ranked, top: ${ranked[0]?.ticker || 'N/A'} (${ranked[0]?.compositeScore ?? 'N/A'})`);
    }

    logInfo(`Total ranked: ${allRanked.length} stocks, ${sectorAggregates.length} sectors`);

    // Step 7: Persist to Firestore
    const db = getFirebaseAdmin();
    await persistResults(db, allRanked, sectorAggregates);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    logInfo(`Rankings cron complete in ${elapsed}s`);

    return res.status(200).json({
      success: true,
      message: `Rankings computed in ${elapsed}s`,
      stats: {
        stocksFetched: fetchedCount,
        stocksRanked: allRanked.length,
        sectorsRanked: sectorAggregates.length,
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
