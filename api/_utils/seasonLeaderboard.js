/**
 * Season Leaderboard Builder
 *
 * Rebuilds the denormalized `seasonLeaderboard/{seasonId}` document from all
 * active entries in a season. Called once per cron run after settlement has
 * been applied to every entry. Also exposes `computeFinalMetrics`, which
 * produces the end-of-season metric set for a single entry.
 *
 * Pure functions — no Firestore access. Callers are responsible for loading
 * entries (and any previous leaderboard doc, and aggregated trades for final
 * metrics) and for writing the returned documents back to Firestore.
 */

import { COMPOSITE_WEIGHTS, ENTRY_STATUS } from './seasonConfig.js';

// ─── Main Exports ─────────────────────────────────────────────

/**
 * Rebuilds the leaderboard from all entries in a season.
 *
 * Each entry object must carry an `id` or `entryId` field — callers typically
 * attach this from the Firestore doc id after `.get()`. All other fields are
 * read from the entry's Firestore shape (portfolio, seasonState, dailySnapshots).
 *
 * @param {string} seasonId
 * @param {Object[]} entries - Array of seasonEntry documents after settlement
 * @param {Object} seasonDoc - Season document (currently unused; kept for
 *   symmetry with computeFinalMetrics and future benchmark fields)
 * @param {Object|null} [previousLeaderboard=null] - Previous leaderboard doc
 *   (if any) for populating previousRank
 * @returns {Object} Leaderboard document for Firestore
 */
export function buildLeaderboard(seasonId, entries, seasonDoc, previousLeaderboard = null) {
  const safeEntries = Array.isArray(entries) ? entries : [];
  const active = safeEntries.filter(e => e?.status === ENTRY_STATUS.ACTIVE);

  const ranked = rankEntries(active);
  const prevRankMap = buildPreviousRankMap(previousLeaderboard);

  let tradingDay = 0;
  for (const e of active) {
    const d = e?.seasonState?.currentTradingDay ?? 0;
    if (d > tradingDay) tradingDay = d;
  }

  const rankings = ranked.map(e => {
    const entryId = e.id ?? e.entryId ?? null;
    return {
      entryId,
      displayId: e.displayId ?? null,
      displayName: e.displayName ?? 'Unknown',
      tradingStyle: e.tradingStyle ?? null,
      entryType: e.entryType ?? 'unknown',
      alpha: e.seasonState?.alphaVsSpy ?? 0,
      totalReturn: e.portfolio?.totalReturn ?? 0,
      rank: e.__rank,
      previousRank: entryId != null ? (prevRankMap.get(entryId) ?? null) : null,
      weeklyAlpha: weeklyAlphaFromState(e.seasonState),
      maxDrawdown: runningMaxDrawdown(e.dailySnapshots || []),
      ruleCount: e.algorithm?.ruleCount ?? null,
      totalTrades: e.seasonState?.totalTradesExecuted ?? 0,
    };
  });

  const stats = computeLeaderboardStats(rankings, lastSpyReturn(active));

  return {
    seasonId,
    lastUpdated: Date.now(),
    tradingDay,
    rankings,
    stats,
  };
}

/**
 * Computes all secondary metrics for a single entry at season end.
 *
 * Trades must be passed in by the caller — the entry doc itself does not
 * carry a flat trade list (trades live inside per-day dailyLogs). The caller
 * is responsible for aggregating them before invoking this function.
 *
 * @param {Object} entry - seasonEntry document with all dailySnapshots
 * @param {Object} seasonDoc - Season document (provides `weeks[]` for recovery factor)
 * @param {Object[]} [trades=[]] - Aggregated trades for this entry across the season
 * @returns {Object} Full metrics object
 */
export function computeFinalMetrics(entry, seasonDoc, trades = []) {
  const snapshots = Array.isArray(entry?.dailySnapshots) ? entry.dailySnapshots : [];

  const dailyAlphas = [];
  for (const s of snapshots) {
    const v = s?.dailyAlpha;
    if (typeof v === 'number' && Number.isFinite(v)) dailyAlphas.push(v);
  }

  const sharpe = computeSharpe(dailyAlphas);
  const maxDrawdown = runningMaxDrawdown(snapshots);
  const consistencyPct = computeConsistency(dailyAlphas);
  const recoveryFactor = computeRecoveryFactor(snapshots, seasonDoc);
  const { winRate: tradeWinRate, profitFactor } = computeTradeStats(trades);
  const timeInMarketPct = computeTimeInMarketPct(snapshots);

  const compositeScore = computeCompositeScore({
    sharpe,
    maxDrawdown,
    consistencyPct,
    tradeWinRate,
  });

  return {
    sharpe,
    maxDrawdown,
    consistencyPct,
    recoveryFactor,
    tradeWinRate,
    profitFactor,
    timeInMarketPct,
    compositeScore,
  };
}

// ─── Leaderboard Helpers ──────────────────────────────────────

/**
 * Sorts entries by alpha descending (tiebreak by totalReturn) and assigns
 * a strict 1..n rank on cloned objects. Does not mutate the input array.
 */
function rankEntries(active) {
  const clones = active.map(e => ({ ...e }));
  clones.sort((a, b) => {
    const aAlpha = a?.seasonState?.alphaVsSpy ?? -Infinity;
    const bAlpha = b?.seasonState?.alphaVsSpy ?? -Infinity;
    if (bAlpha !== aAlpha) return bAlpha - aAlpha;
    const aRet = a?.portfolio?.totalReturn ?? -Infinity;
    const bRet = b?.portfolio?.totalReturn ?? -Infinity;
    return bRet - aRet;
  });
  clones.forEach((e, idx) => { e.__rank = idx + 1; });
  return clones;
}

/**
 * Extracts a Map<entryId, rank> from a previous leaderboard document for
 * populating previousRank on the new rankings.
 */
function buildPreviousRankMap(prev) {
  const map = new Map();
  const rows = prev?.rankings;
  if (!Array.isArray(rows)) return map;
  for (const r of rows) {
    if (r?.entryId != null) map.set(r.entryId, r.rank);
  }
  return map;
}

/**
 * Extracts weekly alpha values from seasonState.weeklyResults, sorted by
 * week number ascending.
 */
function weeklyAlphaFromState(seasonState) {
  const weekly = seasonState?.weeklyResults;
  if (!Array.isArray(weekly)) return [];
  return weekly
    .slice()
    .sort((a, b) => (a?.week ?? 0) - (b?.week ?? 0))
    .map(w => w?.alpha ?? 0);
}

/**
 * Reads the latest SPY return from any active entry's most recent daily
 * snapshot. All entries in a season share the same benchmark, so the first
 * entry with a snapshot gives us the authoritative value.
 */
function lastSpyReturn(entries) {
  let latestDay = -1;
  let spy = 0;
  for (const e of entries) {
    const snaps = e?.dailySnapshots;
    if (!Array.isArray(snaps) || snaps.length === 0) continue;
    const last = snaps[snaps.length - 1];
    const day = last?.day ?? 0;
    if (day > latestDay) {
      latestDay = day;
      spy = last?.spyReturn ?? 0;
    }
  }
  return spy;
}

/**
 * Computes participant count, beating-market count, and alpha distribution
 * from the ranked leaderboard rows.
 */
function computeLeaderboardStats(rankings, spyReturn) {
  const n = rankings.length;
  if (n === 0) {
    return {
      participantCount: 0,
      beatingMarket: 0,
      avgAlpha: 0,
      bestAlpha: 0,
      worstAlpha: 0,
      spyReturn,
    };
  }
  const alphas = rankings.map(r => r.alpha);
  const sum = alphas.reduce((s, v) => s + v, 0);
  return {
    participantCount: n,
    beatingMarket: rankings.filter(r => r.alpha > 0).length,
    avgAlpha: sum / n,
    bestAlpha: Math.max(...alphas),
    worstAlpha: Math.min(...alphas),
    spyReturn,
  };
}

// ─── Metric Computations ──────────────────────────────────────

/**
 * Arithmetic mean of a numeric array. Returns 0 on empty input.
 */
function mean(nums) {
  if (!nums || nums.length === 0) return 0;
  let sum = 0;
  for (const v of nums) sum += v;
  return sum / nums.length;
}

/**
 * Sample standard deviation (n-1 denominator). Returns 0 if fewer than 2
 * samples, matching the convention used in rankingHelpers.js.
 */
function stddev(nums) {
  if (!nums || nums.length < 2) return 0;
  const m = mean(nums);
  let variance = 0;
  for (const v of nums) variance += (v - m) ** 2;
  variance /= (nums.length - 1);
  return Math.sqrt(variance);
}

/**
 * Unannualized Sharpe ratio: mean(dailyAlpha) / stddev(dailyAlpha).
 * Returns null when fewer than 2 samples or when stddev is zero.
 */
function computeSharpe(dailyAlphas) {
  if (!dailyAlphas || dailyAlphas.length < 2) return null;
  const sd = stddev(dailyAlphas);
  if (sd === 0 || !Number.isFinite(sd)) return null;
  return mean(dailyAlphas) / sd;
}

/**
 * Scans dailySnapshots for the historical worst drawdown — running peak of
 * portfolioValue, deepest trough as a negative percentage.
 *
 * Returns 0 when no drawdown has occurred yet (e.g., single-snapshot or
 * monotonically rising portfolio).
 */
function runningMaxDrawdown(snapshots) {
  if (!Array.isArray(snapshots) || snapshots.length === 0) return 0;
  let peak = -Infinity;
  let worst = 0;
  for (const snap of snapshots) {
    const v = snap?.portfolioValue;
    if (typeof v !== 'number' || !Number.isFinite(v)) continue;
    if (v > peak) peak = v;
    if (peak > 0) {
      const dd = ((v - peak) / peak) * 100;
      if (dd < worst) worst = dd;
    }
  }
  return worst;
}

/**
 * Percent of days with positive dailyAlpha. Returns 0 on empty input.
 */
function computeConsistency(dailyAlphas) {
  if (!dailyAlphas || dailyAlphas.length === 0) return 0;
  let positive = 0;
  for (const v of dailyAlphas) if (v > 0) positive++;
  return (positive / dailyAlphas.length) * 100;
}

/**
 * Recovery factor: (sum of returns in weeks after the worst week) / |worst
 * week return|. Uses actual `seasonDoc.weeks[].tradingDays` boundaries rather
 * than assuming fixed 5-day weeks.
 *
 * Each week's return is computed from the portfolioValue delta between the
 * snapshot one day before the week starts (or the first snapshot, for week 1)
 * and the snapshot on the last day of the week.
 *
 * Returns null when there are no weeks, no snapshots, or no losing week.
 */
function computeRecoveryFactor(snapshots, seasonDoc) {
  const weeks = seasonDoc?.weeks;
  if (!Array.isArray(weeks) || weeks.length === 0) return null;
  if (!Array.isArray(snapshots) || snapshots.length === 0) return null;

  const byDay = new Map();
  for (const s of snapshots) {
    if (typeof s?.day === 'number') byDay.set(s.day, s);
  }

  const weekReturns = [];
  for (let i = 0; i < weeks.length; i++) {
    const days = weeks[i]?.tradingDays || [];
    if (days.length === 0) { weekReturns.push(null); continue; }

    const firstDay = days[0];
    const lastDay = days[days.length - 1];
    const endSnap = byDay.get(lastDay);
    if (!endSnap) { weekReturns.push(null); continue; }

    const prevSnap = byDay.get(firstDay - 1);
    let startVal = prevSnap?.portfolioValue;
    if (startVal == null && i === 0) {
      startVal = snapshots[0]?.portfolioValue ?? null;
    }
    if (startVal == null || startVal <= 0) { weekReturns.push(null); continue; }

    const ret = ((endSnap.portfolioValue - startVal) / startVal) * 100;
    weekReturns.push(ret);
  }

  let worstIdx = -1;
  let worstVal = 0;
  for (let i = 0; i < weekReturns.length; i++) {
    const r = weekReturns[i];
    if (r == null) continue;
    if (r < worstVal) {
      worstVal = r;
      worstIdx = i;
    }
  }
  if (worstIdx === -1 || worstVal >= 0) return null;

  let subsequentSum = 0;
  for (let i = worstIdx + 1; i < weekReturns.length; i++) {
    const r = weekReturns[i];
    if (r != null && Number.isFinite(r)) subsequentSum += r;
  }
  return subsequentSum / Math.abs(worstVal);
}

/**
 * Computes trade win rate and dollar-weighted profit factor from closed
 * positions. Only full SELLs are considered closed — TRIM/REDUCE events do
 * not carry a guaranteed `returnSinceEntry` in seasonSettlement output.
 *
 * profitFactor = sum(dollarPnL where > 0) / |sum(dollarPnL where < 0)|
 * where dollarPnL = trade.value * (returnSinceEntry / 100).
 *
 * Returns null for winRate when there are no closed trades, and null for
 * profitFactor when there are no losing trades.
 */
function computeTradeStats(trades) {
  if (!Array.isArray(trades) || trades.length === 0) {
    return { winRate: null, profitFactor: null };
  }

  const closed = trades.filter(
    t => t?.type === 'SELL' && typeof t.returnSinceEntry === 'number',
  );
  if (closed.length === 0) return { winRate: null, profitFactor: null };

  let winners = 0;
  let wins = 0;
  let losses = 0;
  for (const t of closed) {
    if (t.returnSinceEntry > 0) winners++;
    const dollar = (t.value ?? 0) * (t.returnSinceEntry / 100);
    if (dollar > 0) wins += dollar;
    else if (dollar < 0) losses += dollar;
  }

  const winRate = (winners / closed.length) * 100;
  const profitFactor = losses === 0 ? null : wins / Math.abs(losses);
  return { winRate, profitFactor };
}

/**
 * Mean percentage of portfolio value invested across all daily snapshots.
 * Computed as mean(100 - cashPct) so a 30% cash balance contributes 70%
 * time-in-market for that day.
 */
function computeTimeInMarketPct(snapshots) {
  if (!Array.isArray(snapshots) || snapshots.length === 0) return 0;
  const vals = [];
  for (const s of snapshots) {
    const v = 100 - (s?.cashPct ?? 0);
    if (Number.isFinite(v)) vals.push(v);
  }
  return vals.length === 0 ? 0 : mean(vals);
}

// ─── Composite Score ──────────────────────────────────────────

/**
 * Linear-normalizes a raw metric value into the 0-100 range using fixed
 * bounds, clamped at both ends. Returns null for null/non-finite inputs so
 * the composite score can re-weight around missing metrics.
 */
function normalizeMetric(value, lo, hi) {
  if (value == null || !Number.isFinite(value)) return null;
  if (hi === lo) return null;
  const t = (value - lo) / (hi - lo);
  return Math.max(0, Math.min(100, t * 100));
}

/**
 * Weighted composite score using COMPOSITE_WEIGHTS from seasonConfig.
 *
 * Normalization bounds:
 *   - sharpe:         [-2, 2]
 *   - maxDrawdown:    [-50, 0]   (0% drawdown → 100, -50% → 0)
 *   - consistencyPct: [0, 100]   (already a percentage)
 *   - tradeWinRate:   [0, 100]   (already a percentage)
 *
 * When a metric is null (e.g., Sharpe with zero stddev, or winRate with no
 * trades), its weight is dropped and the remaining weights are re-normalized.
 * If all four metrics are null, the composite score is null.
 */
function computeCompositeScore({ sharpe, maxDrawdown, consistencyPct, tradeWinRate }) {
  const norm = {
    sharpe: normalizeMetric(sharpe, -2, 2),
    drawdown: normalizeMetric(maxDrawdown, -50, 0),
    consistency: normalizeMetric(consistencyPct, 0, 100),
    winRate: normalizeMetric(tradeWinRate, 0, 100),
  };

  let sum = 0;
  let wSum = 0;
  for (const key of Object.keys(COMPOSITE_WEIGHTS)) {
    if (norm[key] == null) continue;
    sum += norm[key] * COMPOSITE_WEIGHTS[key];
    wSum += COMPOSITE_WEIGHTS[key];
  }
  return wSum === 0 ? null : sum / wSum;
}
