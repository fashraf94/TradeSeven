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
  TICKER_TO_SECTOR,
  TICKER_TO_INDUSTRY,
  DIMENSIONS,
  PILLARS,
  COMPETE_PILLAR_WEIGHTS,
  SECTOR_COMPOSITE_WEIGHTS,
  EODHD_FUNDAMENTALS_FILTER,
  SECTOR_BEAT_RATES,
  getTierLabel,
  normalizeToScore,
  computeReturn,
} from '../_utils/rankingConfig.js';
// Metric History Snapshot Substrate (dark). Additive co-tenant write; see the single
// gated hook after persistResults() in the handler below. EXA spec §6.0 / DECISION 2.
import { captureMetricHistorySnapshots } from '../_utils/metricSnapshots.js';
// featureFlags is a pure constants module (no imports) — this api→src import is
// Node-clean and well-precedented (10+ api/_utils importers); BUILD_RULES §4.
import { METRIC_HISTORY_SNAPSHOT_ENABLED } from '../../src/config/featureFlags.js';
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
    balanceSheetQ: data.Financials?.Balance_Sheet?.quarterly || {},
    balanceSheetY: data.Financials?.Balance_Sheet?.yearly || {},
    sharesStats: data.SharesStats || {},
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
 * Read per-sector rolling price history from Firestore, append today's prices,
 * trim to 200 days, and write back.
 * Returns sectorDocs: { [sectorId]: { days: [{date, prices}, ...] } }
 */
async function updateRollingPriceHistory(db, bulkPrices, apiKey) {
  const MAX_DAYS = 200;
  const today = new Date().toISOString().split('T')[0];
  const sectorIds = Object.keys(STOCK_UNIVERSE);

  // Build today's prices grouped by sector
  const todayBySector = {};
  for (const [sectorId, sectorDef] of Object.entries(STOCK_UNIVERSE)) {
    todayBySector[sectorId] = {};
  }
  if (Array.isArray(bulkPrices)) {
    for (const entry of bulkPrices) {
      const sym = (entry.code || entry.symbol || '').replace(/\.US$/i, '');
      if (!sym || !entry.close) continue;
      const sectorId = TICKER_TO_SECTOR[sym] || TICKER_TO_SECTOR[sym.replace(/-/g, '.')];
      if (sectorId) {
        const ticker = TICKER_TO_SECTOR[sym] ? sym : sym.replace(/-/g, '.');
        todayBySector[sectorId][ticker] = entry.close;
      }
    }
  }

  // Read all sector docs in parallel
  const sectorDocs = {};
  await Promise.all(sectorIds.map(async (sectorId) => {
    try {
      const doc = await db.collection('priceHistory').doc(sectorId).get();
      sectorDocs[sectorId] = doc.exists ? doc.data() : { days: [] };
    } catch (err) {
      logWarn(`Failed to read priceHistory/${sectorId}: ${err.message}`);
      sectorDocs[sectorId] = { days: [] };
    }
  }));

  // Check if backfill is needed (use first sector as proxy)
  const firstSector = sectorDocs[sectorIds[0]];
  const existingDays = firstSector?.days?.length || 0;

  if (existingDays < 130 && apiKey) {
    logInfo(`Rolling history has ${existingDays} days — backfilling to ~200 days`);
    const fromStr = getDateDaysAgo(285);

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

    // Get all unique dates across all stocks
    const allDates = new Set();
    for (const dayArr of Object.values(historicalPrices)) {
      if (Array.isArray(dayArr)) dayArr.forEach(d => allDates.add(d.date));
    }
    const sortedDates = [...allDates].sort().slice(-MAX_DAYS);

    // Build per-sector day arrays from backfilled data
    for (const [sectorId, sectorDef] of Object.entries(STOCK_UNIVERSE)) {
      const sectorTickers = sectorDef.stocks;
      const days = sortedDates.map(date => {
        const prices = {};
        for (const ticker of sectorTickers) {
          const dayArr = historicalPrices[ticker];
          if (Array.isArray(dayArr)) {
            const match = dayArr.find(d => d.date === date);
            if (match?.close) prices[ticker] = match.close;
          }
        }
        return { date, prices };
      }).reverse(); // newest first

      sectorDocs[sectorId] = { days };
    }

    logInfo(`Backfill complete: ${sortedDates.length} days for ${successCount} stocks`);
  }

  // Append today's prices to each sector
  for (const [sectorId, todayPrices] of Object.entries(todayBySector)) {
    if (Object.keys(todayPrices).length === 0) continue;
    let days = sectorDocs[sectorId]?.days || [];

    if (days.length > 0 && days[0]?.date === today) {
      days[0].prices = { ...days[0].prices, ...todayPrices };
    } else {
      days.unshift({ date: today, prices: todayPrices });
    }

    days = days.slice(0, MAX_DAYS);
    sectorDocs[sectorId] = {
      days,
      updatedAt: new Date().toISOString(),
      dayCount: days.length,
    };
  }

  // Write all sector docs + meta doc in a batch
  try {
    const batch = db.batch();
    for (const [sectorId, data] of Object.entries(sectorDocs)) {
      batch.set(db.collection('priceHistory').doc(sectorId), data);
    }
    batch.set(db.collection('priceHistory').doc('meta'), {
      updatedAt: new Date().toISOString(),
      dayCount: sectorDocs[sectorIds[0]]?.days?.length || 0,
      sectors: sectorIds,
    });
    await batch.commit();

    const dayCount = sectorDocs[sectorIds[0]]?.days?.length || 0;
    logInfo(`Rolling history saved: ${dayCount} days across ${sectorIds.length} sectors`);
  } catch (err) {
    logWarn(`Failed to write per-sector price history: ${err.message}`);
  }

  // Delete legacy oversized document
  try {
    await db.collection('priceHistory').doc('rolling').delete();
    logInfo('Deleted legacy priceHistory/rolling document');
  } catch (e) {
    // Ignore — may not exist
  }

  return sectorDocs;
}

/**
 * Extract a ticker's price history from per-sector docs.
 * Returns array of closes (newest first), or null if not found.
 */
function getStockPriceHistory(sectorDocs, ticker) {
  const sectorId = TICKER_TO_SECTOR[ticker] || TICKER_TO_SECTOR[ticker.replace(/-/g, '.')];
  if (!sectorId || !sectorDocs[sectorId]?.days) return null;
  const normalizedTicker = TICKER_TO_SECTOR[ticker] ? ticker : ticker.replace(/-/g, '.');
  return sectorDocs[sectorId].days
    .map(day => day.prices?.[normalizedTicker])
    .filter(p => p != null);
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

// ---------------------------------------------------------------------------
// Financial Health — Balance Sheet Metrics
// ---------------------------------------------------------------------------

/**
 * Extract balance sheet metrics for the Financial Health pillar.
 * Uses most recent yearly balance sheet + income statement data.
 *
 * Pre-profit handling:
 * - If EBITDA null/negative: skip interest coverage + net debt/EBITDA,
 *   those dimensions will be null (pillar averages remaining dimensions).
 * - If net cash (negative net debt): award high score via raw values.
 */
function extractBalanceSheetMetrics(balanceSheetY, incomeY, sectorId) {
  const result = {
    debtToEquity: null,
    currentRatio: null,
    interestCoverage: null,
    netDebtEbitda: null,
  };

  if (!balanceSheetY || typeof balanceSheetY !== 'object') return result;

  const bsYears = Object.keys(balanceSheetY).sort().reverse();
  if (bsYears.length === 0) return result;
  const bs = balanceSheetY[bsYears[0]];

  // Debt-to-Equity
  const totalDebt = parseFloat(bs?.shortLongTermDebtTotal ?? bs?.longTermDebt ?? 0);
  const equity = parseFloat(bs?.totalStockholderEquity);
  if (!isNaN(equity) && equity > 0 && !isNaN(totalDebt)) {
    result.debtToEquity = totalDebt / equity;
  } else if (!isNaN(equity) && equity > 0) {
    result.debtToEquity = 0; // No debt
  }

  // Current Ratio
  const curAssets = parseFloat(bs?.totalCurrentAssets);
  const curLiabilities = parseFloat(bs?.totalCurrentLiabilities);
  if (!isNaN(curAssets) && !isNaN(curLiabilities) && curLiabilities > 0) {
    result.currentRatio = curAssets / curLiabilities;
  }

  // Interest Coverage (EBIT / Interest Expense)
  if (incomeY && typeof incomeY === 'object') {
    const incYears = Object.keys(incomeY).sort().reverse();
    if (incYears.length > 0) {
      const inc = incomeY[incYears[0]];
      const ebit = parseFloat(inc?.operatingIncome ?? inc?.ebit);
      const intExp = parseFloat(inc?.interestExpense);
      if (!isNaN(ebit) && !isNaN(intExp) && intExp !== 0) {
        // Math.abs on denominator only — EODHD reports interest expense as negative
        // When EBIT is negative (pre-profit), ic < 0 → exclude from pillar average
        const ic = ebit / Math.abs(intExp);
        result.interestCoverage = ic > 0 ? ic : null;
      } else if (!isNaN(ebit) && (isNaN(intExp) || intExp === 0)) {
        // No interest expense — debt-free or net cash, excellent coverage
        const netDebt = parseFloat(bs?.netDebt);
        if (!isNaN(netDebt) && netDebt < 0) {
          result.interestCoverage = 100; // Net cash position, max score
        }
      }
    }
  }

  // Net Debt / EBITDA
  const netDebt = parseFloat(bs?.netDebt);
  if (!isNaN(netDebt)) {
    if (netDebt < 0) {
      // Net cash position = best possible score (will rank highest as inverted)
      result.netDebtEbitda = -1; // Negative = net cash, inverted dimension means this scores best
    } else if (incomeY && typeof incomeY === 'object') {
      const incYears = Object.keys(incomeY).sort().reverse();
      if (incYears.length > 0) {
        const inc = incomeY[incYears[0]];
        // Approximate EBITDA: operating income + depreciation
        const opIncome = parseFloat(inc?.operatingIncome ?? inc?.ebit);
        const depreciation = parseFloat(inc?.depreciationAndAmortization ?? 0);
        const ebitda = !isNaN(opIncome) ? opIncome + (isNaN(depreciation) ? 0 : depreciation) : null;
        if (ebitda != null && ebitda > 0) {
          result.netDebtEbitda = netDebt / ebitda;
        }
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Earnings Consistency — Beat Rate, Surprise Magnitude, Consistency
// ---------------------------------------------------------------------------

/**
 * Compute earnings consistency metrics from EODHD Earnings.History.
 * Uses up to 12 quarters of data. Falls back to sector default beat rate
 * for stocks with <4 quarters.
 *
 * beatRateSource (Fundamental Wire, founder ruling D2 Jul 25 2026): marks
 * whether beatRate came from real per-company history ('computed') or the
 * SECTOR_BEAT_RATES constant ('sector_default'). The fabricated value keeps
 * flowing into the pillar system exactly as before — the marker exists so
 * downstream mirrors/renders can SUPPRESS it instead of presenting a sector
 * constant as a per-company fact (a C-20 "detected/verified" violation).
 * Exported for unit tests (buildIndustriesRollup precedent).
 *
 * @returns {{ beatRate: number|null, avgSurpriseMag: number|null, surpriseConsistency: number|null, beatRateSource: 'computed'|'sector_default'|null }}
 */
export function computeEarningsConsistency(earnings, sectorId) {
  const result = { beatRate: null, avgSurpriseMag: null, surpriseConsistency: null, beatRateSource: null };
  if (!earnings?.History) {
    // Fall back to sector default beat rate
    const defaultRate = SECTOR_BEAT_RATES[sectorId] ?? 0.68;
    result.beatRate = defaultRate * 100; // Convert to percentage
    result.beatRateSource = 'sector_default';
    return result;
  }

  const entries = Object.values(earnings.History)
    .filter(e => {
      const actual = parseFloat(e.epsActual);
      const estimate = parseFloat(e.epsEstimate);
      return !isNaN(actual) && !isNaN(estimate) && estimate !== 0;
    })
    .slice(0, 12); // Up to 12 quarters

  if (entries.length < 4) {
    // Insufficient data — use sector default
    const defaultRate = SECTOR_BEAT_RATES[sectorId] ?? 0.68;
    result.beatRate = defaultRate * 100;
    result.beatRateSource = 'sector_default';
    if (entries.length >= 2) {
      // Can still compute partial surprise stats
      const surprises = entries.map(e =>
        ((parseFloat(e.epsActual) - parseFloat(e.epsEstimate)) / Math.abs(parseFloat(e.epsEstimate))) * 100
      );
      result.avgSurpriseMag = surprises.reduce((s, v) => s + Math.abs(v), 0) / surprises.length;
    }
    logInfo(`[RANK] ${sectorId} stock: earnings consistency using ${entries.length} quarters (sector default for beat rate)`);
    return result;
  }

  // Compute surprise percentages
  const surprises = entries.map(e =>
    ((parseFloat(e.epsActual) - parseFloat(e.epsEstimate)) / Math.abs(parseFloat(e.epsEstimate))) * 100
  );

  // Beat Rate: % of quarters where actual > estimate
  const beats = entries.filter(e => parseFloat(e.epsActual) > parseFloat(e.epsEstimate)).length;
  result.beatRate = (beats / entries.length) * 100;
  result.beatRateSource = 'computed';

  // Avg Surprise Magnitude (absolute value — measures consistency of beating, not direction)
  const posSurprises = surprises.filter(s => s > 0);
  result.avgSurpriseMag = posSurprises.length > 0
    ? posSurprises.reduce((s, v) => s + v, 0) / posSurprises.length
    : 0;

  // Surprise Consistency (std dev of surprise %) — lower = more predictable = better
  // This dimension is inverted in DIMENSIONS config, so lower std dev → higher percentile
  const mean = surprises.reduce((s, v) => s + v, 0) / surprises.length;
  const variance = surprises.reduce((s, v) => s + (v - mean) ** 2, 0) / surprises.length;
  result.surpriseConsistency = Math.sqrt(variance);

  return result;
}

// ---------------------------------------------------------------------------
// Short Interest Score
// ---------------------------------------------------------------------------

/**
 * Compute short interest score from SharesStats data.
 * ShortPercentOfFloat: stored as raw value (higher = more bearish sentiment).
 * This dimension is inverted in DIMENSIONS config, so lower short interest → higher percentile.
 *
 * Also returns squeeze flag data for UI badge display.
 */
function computeShortInterestMetrics(sharesStats) {
  const shortPctFloat = parseFloat(sharesStats?.ShortPercentOfFloat);
  const shortRatio = parseFloat(sharesStats?.ShortRatio);

  return {
    shortInterestScore: !isNaN(shortPctFloat) ? shortPctFloat : null,
    shortRatio: !isNaN(shortRatio) ? shortRatio : null,
    squeezeWatch: !isNaN(shortPctFloat) && shortPctFloat > 15,
  };
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

  // ── Momentum (still computed for scanner, but NOT in pillar system)
  const sixMonthReturn = null;
  const threeMonthReturn = null;
  const oneMonthReturn = null;

  // ── Financial Health (NEW) ────────────────────────────────────────────
  const sectorId = TICKER_TO_SECTOR[ticker];
  const balanceSheetMetrics = extractBalanceSheetMetrics(
    fundamentals.balanceSheetY, fundamentals.incomeY, sectorId
  );

  // ── Earnings Consistency (NEW) ────────────────────────────────────────
  const earningsConsistencyMetrics = computeEarningsConsistency(
    fundamentals.earnings, sectorId
  );

  // ── Sentiment ─────────────────────────────────────────────────────────
  const earningsRevisions = computeEpsRevisionScore(fundamentals.earnings);
  const avgEarningsSurprise = computeAvgSurprise(fundamentals.earnings);
  const shortInterestMetrics = computeShortInterestMetrics(fundamentals.sharesStats);

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
    // Momentum (kept for scanner, not in pillar system)
    sixMonthReturn,
    threeMonthReturn,
    oneMonthReturn,
    // Financial Health (NEW)
    debtToEquity: balanceSheetMetrics.debtToEquity,
    currentRatio: balanceSheetMetrics.currentRatio,
    interestCoverage: balanceSheetMetrics.interestCoverage,
    netDebtEbitda: balanceSheetMetrics.netDebtEbitda,
    // Earnings Consistency (NEW)
    beatRate: earningsConsistencyMetrics.beatRate,
    // D2 provenance marker: 'computed' | 'sector_default' — lets the
    // fundamentals mirror suppress fabricated beat rates (never rendered
    // as a per-company fact). Additive named field; pillar math unchanged.
    beatRateSource: earningsConsistencyMetrics.beatRateSource,
    avgSurpriseMag: earningsConsistencyMetrics.avgSurpriseMag,
    surpriseConsistency: earningsConsistencyMetrics.surpriseConsistency,
    // Sentiment (expanded with short interest)
    earningsRevisions,
    avgEarningsSurprise,
    shortInterestScore: shortInterestMetrics.shortInterestScore,
    shortRatio: shortInterestMetrics.shortRatio,
    squeezeWatch: shortInterestMetrics.squeezeWatch,
    // Scanner & badges
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
 * from per-sector rolling price history.
 */
function enrichWithPrices(allMetrics, bulkPrices, sectorDocs) {
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
    if (sectorDocs) {
      const history = getStockPriceHistory(sectorDocs, ticker);
      if (history && history.length > 0) {
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
// Ranking Engine (8-pillar model)
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
function runScanner(allRanked, sectorDocs, estimatesData) {
  const scannerResults = {}; // ticker → { coiledSpring, runningOnFumes }
  const coiledSprings = [];
  const fumes = [];

  // Check if we have enough price history for scanner
  const firstSectorId = Object.keys(sectorDocs)[0];
  const historyDays = sectorDocs[firstSectorId]?.days?.length || 0;
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

    const history = getStockPriceHistory(sectorDocs, ticker);
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
        // Momentum (kept for scanner context, no longer a pillar)
        sixMonthReturn: stock.metrics?.sixMonthReturn ?? null,
        threeMonthReturn: stock.metrics?.threeMonthReturn ?? null,
        oneMonthReturn: stock.metrics?.oneMonthReturn ?? null,
        // Financial Health (NEW)
        debtToEquity: stock.metrics?.debtToEquity ?? null,
        currentRatio: stock.metrics?.currentRatio ?? null,
        interestCoverage: stock.metrics?.interestCoverage ?? null,
        netDebtEbitda: stock.metrics?.netDebtEbitda ?? null,
        // Earnings Consistency (NEW)
        beatRate: stock.metrics?.beatRate ?? null,
        // D2: fabrication marker persisted beside the value it describes.
        beatRateSource: stock.metrics?.beatRateSource ?? null,
        avgSurpriseMag: stock.metrics?.avgSurpriseMag ?? null,
        surpriseConsistency: stock.metrics?.surpriseConsistency ?? null,
        // Sentiment (expanded)
        earningsRevisions: stock.metrics?.earningsRevisions ?? null,
        avgEarningsSurprise: stock.metrics?.avgEarningsSurprise ?? null,
        shortInterestScore: stock.metrics?.shortInterestScore ?? null,
        shortRatio: stock.metrics?.shortRatio ?? null,
        squeezeWatch: stock.metrics?.squeezeWatch ?? false,
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
    const sectorDocs = await updateRollingPriceHistory(db, bulkPrices, API_KEY);

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
    enrichWithPrices(allMetrics, bulkPrices, sectorDocs);

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
      const scannerOutput = runScanner(allRanked, sectorDocs, estimatesData);
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

    // ===== METRIC HISTORY SNAPSHOT SUBSTRATE (dark; additive co-tenant write) =====
    // EXA_RETRIEVAL_INTEGRATION_SPEC_V1_4 §6.0 (FOUNDER DECISION 2). Runs ONLY after
    // the ranking documents above have persisted, gated dark by
    // METRIC_HISTORY_SNAPSHOT_ENABLED. Nothing reads this data yet. The whole block is
    // failure-isolated: any error logs and continues — a snapshot failure must never
    // fail or delay the ranking computation (which is already complete at this point).
    // Persists only data already in memory: no new EODHD fetch, no new cron slot.
    if (METRIC_HISTORY_SNAPSHOT_ENABLED) {
      try {
        // UTC date == ET trading date at the 11:00Z run hour; matches how the rolling
        // priceHistory above keys its days (new Date().toISOString() split at 'T').
        const asOfDate = new Date().toISOString().split('T')[0];
        const computedAt = new Date();

        // Map the in-memory ranked stocks → one snapshot payload per ticker, and the
        // transiently-fetched raw quarterly series → one retention payload per ticker.
        // Reads only; no ranking value is recomputed, mutated, or re-persisted.
        const metricsByTicker = {};
        const quarterlyByTicker = {};
        for (const stock of allRanked) {
          const ticker = stock.ticker;
          metricsByTicker[ticker] = {
            ticker,
            sectorId: stock.sectorId,
            sectorName: STOCK_UNIVERSE[stock.sectorId]?.name ?? null,
            industryName: TICKER_TO_INDUSTRY[ticker] ?? null,
            compositeScore: stock.compositeScore ?? null,
            compositeRank: stock.compositeRank ?? null,
            totalPeers: stock.totalPeers ?? null,
            metricsAvailable: stock.metricsAvailable ?? null,
            tier: stock.tier ?? null,
            pillars: stock.pillars ?? null,   // 7 pillar percentiles
            ranks: stock.ranks ?? null,       // per-dimension { rank, totalWithData, value, percentile }
            metrics: stock.metrics ?? null,   // raw growth / momentum / health / sentiment values
            dnaBadge: stock.dnaBadge ?? null,
            debtRiskBadge: stock.debtRiskBadge ?? null,
          };
          const f = allFundamentals[ticker];
          if (f) {
            quarterlyByTicker[ticker] = {
              earningsHistory: f.earnings?.History ?? null,   // raw quarterly EPS series (as fetched)
              incomeQuarterly: f.incomeQ ?? null,             // raw quarterly income (revenue) series
              balanceSheetQuarterly: f.balanceSheetQ ?? null, // raw quarterly balance sheet (share-count series)
            };
          }
        }

        const snapResult = await captureMetricHistorySnapshots({
          db,
          metricsByTicker,
          quarterlyByTicker,
          asOfDate,
          computedAt,
          startTime,
          maxDurationMs: config.maxDuration * 1000,
        });
        logInfo('Metric history snapshot', snapResult);
      } catch (snapErr) {
        // Redundant outer guard (captureMetricHistorySnapshots already isolates): even a
        // synchronous throw while building the payloads cannot touch the ranking result.
        logError(`Metric history snapshot failed (rankings already persisted): ${snapErr.message}`);
      }
    }

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
        priceHistoryDays: sectorDocs?.[Object.keys(sectorDocs)[0]]?.days?.length || 0,
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
