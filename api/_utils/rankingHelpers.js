/**
 * Ranking Helpers — Pure utility functions for scanner + badge computations.
 *
 * Used by api/cron/compute-rankings.js for the Coiled Spring / Running on Fumes
 * scanner and DNA/debt-risk badge generation.
 *
 * No side effects, no Firebase, no fetch.
 */

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

/**
 * Standard deviation of a numeric array.
 */
export function standardDeviation(arr) {
  if (!arr || arr.length < 2) return 0;
  const mean = arr.reduce((s, v) => s + v, 0) / arr.length;
  const variance = arr.reduce((s, v) => s + (v - mean) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

/**
 * Percentile rank of a value within a sorted array (ascending).
 * Returns 0-100.  Higher = better (unless inverted).
 * @param {number} value
 * @param {number[]} sortedAsc - ascending sorted array of all values (including this one)
 * @param {boolean} [inverted=false] - if true, lower value = higher percentile
 * @returns {number} 0-100
 */
export function percentileRank(value, sortedAsc, inverted = false) {
  if (!sortedAsc || sortedAsc.length <= 1) return 50;
  // Find position
  let rank = 0;
  for (let i = 0; i < sortedAsc.length; i++) {
    if (sortedAsc[i] <= value) rank = i + 1;
  }
  if (inverted) rank = sortedAsc.length + 1 - rank;
  return Math.round(((rank - 1) / (sortedAsc.length - 1)) * 100);
}

// ---------------------------------------------------------------------------
// Price / Volatility Computations
// ---------------------------------------------------------------------------

/**
 * Annualized volatility from an array of daily closing prices.
 * @param {number[]} dailyCloses - array of daily close prices, newest first
 * @returns {number|null} annualized volatility (decimal), or null if insufficient data
 */
export function annualizedVolatility(dailyCloses) {
  if (!dailyCloses || dailyCloses.length < 22) return null; // need at least 21 returns

  const logReturns = [];
  for (let i = 0; i < dailyCloses.length - 1; i++) {
    const current = dailyCloses[i];
    const previous = dailyCloses[i + 1];
    if (current > 0 && previous > 0) {
      logReturns.push(Math.log(current / previous));
    }
  }

  if (logReturns.length < 20) return null;

  const stdDev = standardDeviation(logReturns);
  return stdDev * Math.sqrt(252);
}

/**
 * Volatility-Adjusted Drawdown (VAD).
 * VAD = rawDrawdown / annualizedVol
 * A VAD > 0.85 means the drawdown is 85%+ of the stock's typical annual volatility.
 * @returns {number|null}
 */
export function computeVAD(currentPrice, high52Week, annVol) {
  if (!currentPrice || !high52Week || !annVol || annVol <= 0.01) return null;
  const rawDrawdown = (high52Week - currentPrice) / high52Week;
  if (rawDrawdown <= 0) return 0; // at or above 52w high
  return rawDrawdown / annVol;
}

/**
 * 21-day Simple Moving Average from daily closes (newest first).
 * @param {number[]} dailyCloses - newest first
 * @returns {number|null}
 */
export function compute21dSMA(dailyCloses) {
  if (!dailyCloses || dailyCloses.length < 21) return null;
  const slice = dailyCloses.slice(0, 21);
  return slice.reduce((s, v) => s + v, 0) / slice.length;
}

/**
 * Count trading days since the 52-week high was reached.
 * Scans backward through price history with 0.5% tolerance.
 * @param {number[]} dailyCloses - newest first
 * @param {number} high52Week
 * @returns {number} days since high (0 = today, 200 = not found in window)
 */
export function daysSince52WeekHigh(dailyCloses, high52Week) {
  if (!dailyCloses || !high52Week) return 200;
  const threshold = high52Week * 0.995; // 0.5% tolerance
  for (let i = 0; i < dailyCloses.length; i++) {
    if (dailyCloses[i] >= threshold) return i;
  }
  return 200; // not found in window
}

// ---------------------------------------------------------------------------
// Badge Generators
// ---------------------------------------------------------------------------

/**
 * Generate DNA badge text identifying strongest and weakest pillars.
 * Format: "#3 Overall: Elite Cash Flow, but Held Back by Valuation"
 * @param {number} rank - composite rank within sector
 * @param {Object} pillars - { momentum: pct, quality: pct, valuation: pct, capitalEff: pct }
 * @returns {string}
 */
export function generateDNABadge(rank, pillars) {
  const pillarNames = {
    growth: 'Growth',
    profitability: 'Profitability',
    efficiency: 'Efficiency',
    valuation: 'Valuation',
    capitalEff: 'Cash Flow',
    momentum: 'Momentum',
    sentiment: 'Sentiment',
  };

  const entries = Object.entries(pillars)
    .filter(([, pct]) => pct != null)
    .map(([key, pct]) => ({ key, name: pillarNames[key] || key, pct }));

  if (entries.length < 2) return `#${rank} Overall`;

  entries.sort((a, b) => b.pct - a.pct);
  const best = entries[0];
  const worst = entries[entries.length - 1];

  function strengthLabel(pct) {
    if (pct >= 80) return 'Elite';
    if (pct >= 60) return 'Strong';
    return 'Solid';
  }

  function weaknessLabel(pct) {
    if (pct < 20) return 'Weak';
    if (pct < 40) return 'Held Back by';
    return 'Moderate';
  }

  const bestStr = `${strengthLabel(best.pct)} ${best.name}`;

  if (worst.pct < 40) {
    const worstStr = `${weaknessLabel(worst.pct)} ${worst.name}`;
    return `#${rank} Overall: ${bestStr}, but ${worstStr}`;
  }

  return `#${rank} Overall: ${bestStr}`;
}

/**
 * Compute debt risk badge from EBIT and interest expense.
 * NOT part of composite score — displayed as a standalone warning badge.
 * @returns {{ interestCoverage: number, label: string, color: string } | null}
 */
export function getDebtRiskBadge(ebit, interestExpense) {
  if (interestExpense == null || Math.abs(interestExpense) === 0) return null;
  if (ebit == null) return null;

  const ic = ebit / Math.abs(interestExpense);

  if (ic < 2.0) {
    return { interestCoverage: Math.round(ic * 100) / 100, label: 'Debt Stress Warning', color: '#ef4444' };
  }
  if (ic <= 4.0) {
    return { interestCoverage: Math.round(ic * 100) / 100, label: 'Elevated Debt', color: '#f59e0b' };
  }

  return null; // clean balance sheet, no badge
}

// ---------------------------------------------------------------------------
// Scanner Narratives
// ---------------------------------------------------------------------------

/**
 * Generate a one-line narrative for a Coiled Spring signal.
 */
export function generateSpringNarrative(stock) {
  const drawdownPct = stock.rawDrawdown != null
    ? `${Math.round(stock.rawDrawdown * 100)}%`
    : '?%';
  const vadStr = stock.vad != null ? stock.vad.toFixed(2) : '?';
  const rsrStr = stock.rsr != null ? stock.rsr.toFixed(2) : '?';

  let narrative = `${drawdownPct} below 52-week high (${vadStr}x vol-adjusted).`;

  if (stock.rsr != null) {
    narrative += ` Revisions ${stock.rsr >= 0.60 ? 'decisively' : 'modestly'} positive (RSR ${rsrStr}).`;
  }

  if (stock.currentPrice != null && stock.sma21 != null && stock.currentPrice > stock.sma21) {
    narrative += ` Price reclaimed 21-day SMA.`;
  }

  return narrative;
}

/**
 * Generate a one-line narrative for a Running on Fumes warning.
 */
export function generateFumesNarrative(stock) {
  const distPct = stock.distFromHigh != null
    ? `${Math.abs(Math.round(stock.distFromHigh * 100) / 100)}%`
    : '?%';
  const rsrStr = stock.rsr != null ? stock.rsr.toFixed(2) : '?';

  return `Within ${distPct} of 52-week high but revisions deteriorating (RSR ${rsrStr}). ` +
    `Analyst consensus weakening despite price strength.`;
}
