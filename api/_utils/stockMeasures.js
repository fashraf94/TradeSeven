// api/_utils/stockMeasures.js
//
// THE PER-STOCK MATH of the rankings job, in one home (research universe Build 2, build prompt section 4). Moved
// VERBATIM out of api/cron/compute-rankings.js, which imports it back: the measures for a research stock must come
// from the same code that computes them for the 228, or the two would drift. Proved by the golden
// (api/cron/compute-rankings.measuresGolden.test.js, committed before the move) and a body-by-body text comparison
// with main (docs/audits/20261126_BUILD_RESEARCH_NUMBERS.md).
//
// What each function reads besides its arguments: TICKER_TO_SECTOR (extractMetrics, for the sector) and
// SECTOR_BEAT_RATES (computeEarningsConsistency), both constants of rankingConfig.js; and logInfo, the rankings job's
// own logger, copied here with the same prefix so the job's log lines do not change. The one side effect is that log
// line (console only, when a stock has fewer than four usable quarters); no output depends on anything but the
// arguments and the two constants.
//
// Known faults, kept as they are (moved verbatim; fixing them is separate work, reported in the build report):
// Highlights carries ProfitMargin, not ProfitMarginTTM, so profitMarginTTM is always null; SharesStats carries
// ShortPercentFloat, not ShortPercentOfFloat, so shortInterestScore is always null; the filter's General::Name comes
// back as a top-level "General::Name" key, so shapeFundamentals' name is always the ticker.
//
// Imports rankingConfig.js only (pinned by stockMeasures.test.js), so the rankings job's import graph can never reach
// a research module through this one.

import { SECTOR_BEAT_RATES, TICKER_TO_SECTOR } from './rankingConfig.js';

const LOG_PREFIX = '[RankingsCron]';

function logInfo(message, data = null) {
  const ts = new Date().toISOString();
  if (data) console.log(`${ts} ${LOG_PREFIX} ${message}`, JSON.stringify(data));
  else console.log(`${ts} ${LOG_PREFIX} ${message}`);
}

/**
 * The response shaping the rankings job did inside fetchSingleFundamental, as a pure function of the parsed
 * fundamentals response (moved verbatim: the return statement is unchanged).
 */
export function shapeFundamentals(data, ticker) {
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

// ---------------------------------------------------------------------------
// Metric Extraction
// ---------------------------------------------------------------------------

/**
 * Sum a field across the most recent 4 quarters to get TTM value.
 */
export function getQuarterlyTTM(quarterlyObj, field) {
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
export function computeEpsRevisionScore(earnings) {
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
export function computeAvgSurprise(earnings) {
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
export function extractBalanceSheetMetrics(balanceSheetY, incomeY, sectorId) {
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
export function computeShortInterestMetrics(sharesStats) {
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
export function extractYearlyDebtMetrics(incomeY) {
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
export function extractMetrics(ticker, fundamentals) {
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
