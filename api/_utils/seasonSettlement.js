/**
 * Season Settlement Engine
 *
 * Takes the PipelineResult from seasonPipeline.js and applies all trades to
 * portfolio state. Produces the updated portfolio, daily snapshot, trade records,
 * and season state updates. Pure function — does NOT write to Firestore.
 *
 * Trade execution order: SELL → TRIM → REDUCE → ADD → BUY
 * All trades execute at closing prices (from ctx.marketData).
 */

import { SEASON_CONFIG, SEASON_SCORING } from './seasonConfig.js';

// ─── Main Export ──────────────────────────────────────────────

/**
 * Applies pipeline results to the portfolio state.
 *
 * @param {Object} ctx - EvaluationContext (current prices, portfolio, season state)
 * @param {Object} pipelineResult - Output from executePipeline()
 * @param {Object} seasonDoc - Season document (SPY benchmark, weeks, trading calendar)
 * @param {Object|null} previousSnapshot - Last entry in entryDoc.dailySnapshots (null on Day 1)
 * @returns {Object} SettlementResult
 */
export function settleDay(ctx, pipelineResult, seasonDoc, previousSnapshot) {
  const trades = [];

  // Deep-clone positions so we don't mutate the ctx
  const positions = {};
  for (const [ticker, pos] of Object.entries(ctx.portfolio.positions)) {
    positions[ticker] = { ...pos };
  }
  let cash = ctx.portfolio.cash;

  // ─── 1. SELL — remove positions, add proceeds ──────────
  for (const sell of pipelineResult.exitActions.sells) {
    const pos = positions[sell.ticker];
    if (!pos) continue;

    const price = ctx.marketData[sell.ticker]?.closePrice ?? pos.currentPrice;
    const value = pos.shares * price;
    const returnSinceEntry = ((price - pos.entryPrice) / pos.entryPrice) * 100;

    trades.push({
      type: 'SELL',
      ticker: sell.ticker,
      shares: pos.shares,
      price,
      value,
      returnSinceEntry,
      triggerRule: sell.triggerRule,
      allCitedRules: sell.allCitedRules,
      reason: sell.reason,
    });

    cash += value;
    delete positions[sell.ticker];
  }

  // ─── 2. TRIM — partial sells from overweight positions ──
  for (const trim of pipelineResult.rebalanceActions.trims) {
    const pos = positions[trim.ticker];
    if (!pos) continue;

    const price = ctx.marketData[trim.ticker]?.closePrice ?? pos.currentPrice;
    const totalValue = computeTotalValue(positions, cash);
    const dollarAmount = ((pos.currentWeight - trim.targetWeight) / 100) * totalValue;
    const sharesToSell = Math.floor(dollarAmount / price);

    if (sharesToSell <= 0) continue;

    const previousWeight = pos.currentWeight;
    const sellValue = sharesToSell * price;

    trades.push({
      type: 'TRIM',
      ticker: trim.ticker,
      sharesSold: sharesToSell,
      price,
      value: sellValue,
      previousWeight,
      newWeight: trim.targetWeight,
      ruleId: trim.ruleId,
      reason: trim.reason,
    });

    pos.shares -= sharesToSell;
    cash += sellValue;

    if (pos.shares <= 0) {
      delete positions[trim.ticker];
    } else {
      pos.currentValue = pos.shares * price;
    }
  }

  // ─── 3. REDUCE — partial sells from underperformers ────
  for (const reduce of pipelineResult.rebalanceActions.reduces) {
    const pos = positions[reduce.ticker];
    if (!pos) continue;

    const price = ctx.marketData[reduce.ticker]?.closePrice ?? pos.currentPrice;
    const totalValue = computeTotalValue(positions, cash);
    const dollarAmount = ((pos.currentWeight - reduce.targetWeight) / 100) * totalValue;
    const sharesToSell = Math.floor(dollarAmount / price);

    if (sharesToSell <= 0) continue;

    const sellValue = sharesToSell * price;

    trades.push({
      type: 'REDUCE',
      ticker: reduce.ticker,
      sharesSold: sharesToSell,
      price,
      value: sellValue,
      previousWeight: pos.currentWeight,
      newWeight: reduce.targetWeight,
      ruleId: reduce.ruleId,
      reason: reduce.reason,
    });

    pos.shares -= sharesToSell;
    cash += sellValue;

    if (pos.shares <= 0) {
      delete positions[reduce.ticker];
    } else {
      pos.currentValue = pos.shares * price;
    }
  }

  // ─── 4. ADD — increase existing positions ──────────────
  for (const add of pipelineResult.rebalanceActions.adds) {
    const pos = positions[add.ticker];
    if (!pos) continue;

    const price = ctx.marketData[add.ticker]?.closePrice ?? pos.currentPrice;
    const totalValue = computeTotalValue(positions, cash);
    const dollarAmount = Math.min(
      ((add.targetWeight - pos.currentWeight) / 100) * totalValue,
      cash
    );
    const sharesToBuy = Math.floor(dollarAmount / price);

    if (sharesToBuy <= 0) continue;

    const cost = sharesToBuy * price;
    const oldShares = pos.shares;
    const oldEntry = pos.entryPrice;

    trades.push({
      type: 'ADD',
      ticker: add.ticker,
      sharesBought: sharesToBuy,
      price,
      value: cost,
      ruleId: add.ruleId,
      reason: add.reason,
    });

    pos.entryPrice = ((oldShares * oldEntry) + (sharesToBuy * price)) / (oldShares + sharesToBuy);
    pos.shares += sharesToBuy;
    pos.currentValue = pos.shares * price;
    cash -= cost;
  }

  // ─── 5. BUY — new positions ────────────────────────────
  for (const buy of pipelineResult.entryActions.buys) {
    const price = ctx.marketData[buy.ticker]?.closePrice;
    if (!price) continue;

    const dollarAmount = Math.min(buy.dollarAmount, cash);
    const shares = Math.floor(dollarAmount / price);

    if (shares <= 0) continue;

    const cost = shares * price;

    trades.push({
      type: 'BUY',
      ticker: buy.ticker,
      shares,
      price,
      value: cost,
      weight: buy.weight,
      citedRules: buy.citedRules,
      reason: buy.reason,
    });

    positions[buy.ticker] = {
      shares,
      entryPrice: price,
      entryDate: ctx.today,
      entryDay: ctx.tradingDay,
      currentPrice: price,
      currentValue: cost,
      currentWeight: 0, // recalculated below
      returnSinceEntry: 0,
      highWaterMark: price,
      drawdownFromPeak: 0,
      sector: ctx.fundamentals[buy.ticker]?.sector || null,
      beta: ctx.fundamentals[buy.ticker]?.beta || null,
      daysSinceEntry: 0,
    };

    cash -= cost;
  }

  // ─── Post-trade recalculations ─────────────────────────
  const portfolio = recalculatePortfolio(positions, cash, ctx);

  // ─── Daily snapshot ────────────────────────────────────
  const dailySnapshot = buildDailySnapshot(ctx, portfolio, seasonDoc, previousSnapshot, trades.length);

  // ─── Season state updates ──────────────────────────────
  const seasonState = buildSeasonState(ctx, portfolio, seasonDoc, pipelineResult, trades);

  // ─── Recent activity (bounded at 10) ───────────────────
  const recentActivity = buildRecentActivity(ctx, trades, previousSnapshot);

  // ─── Rule performance deltas ───────────────────────────
  const rulePerformanceDeltas = buildRulePerformanceDeltas(pipelineResult, trades);

  // ─── Counterfactual checks ─────────────────────────────
  const counterfactualChecks = buildCounterfactualChecks(ctx, seasonDoc, previousSnapshot);

  // ─── Cron state updates ────────────────────────────────
  const cronStateUpdates = {
    lastEvaluatedDay: ctx.tradingDay,
    lastEvaluatedAt: Date.now(),
    lastSettlementAt: Date.now(),
    totalHaikuCalls: pipelineResult.entryActions.tieBreakNeeded?.length > 0 ? 1 : 0,
    totalTokensUsed: 0,
  };

  return {
    portfolio,
    seasonState,
    dailySnapshot,
    trades,
    recentActivity,
    rulePerformanceDeltas,
    counterfactualChecks,
    cronStateUpdates,
  };
}

// ─── Internal Helpers ─────────────────────────────────────────

/**
 * Computes total portfolio value from positions + cash.
 */
function computeTotalValue(positions, cash) {
  let positionsValue = 0;
  for (const pos of Object.values(positions)) {
    positionsValue += pos.shares * (pos.currentPrice || pos.entryPrice);
  }
  return positionsValue + cash;
}

/**
 * Recalculates all portfolio metrics after trades are applied.
 */
function recalculatePortfolio(positions, cash, ctx) {
  const initialValue = ctx.portfolio.initialValue ?? SEASON_CONFIG.STARTING_CAPITAL;
  const sectorValues = {};
  let positionsValue = 0;

  // Update current prices and compute position values
  for (const [ticker, pos] of Object.entries(positions)) {
    const freshPrice = ctx.marketData[ticker]?.closePrice ?? pos.currentPrice;
    pos.currentPrice = freshPrice;
    pos.currentValue = pos.shares * freshPrice;
    pos.returnSinceEntry = ((freshPrice - pos.entryPrice) / pos.entryPrice) * 100;
    pos.highWaterMark = Math.max(pos.highWaterMark || pos.entryPrice, freshPrice);
    pos.drawdownFromPeak = ((freshPrice - pos.highWaterMark) / pos.highWaterMark) * 100;
    pos.daysSinceEntry = ctx.tradingDay - (pos.entryDay || 1);

    positionsValue += pos.currentValue;
    if (pos.sector) {
      sectorValues[pos.sector] = (sectorValues[pos.sector] || 0) + pos.currentValue;
    }
  }

  const totalValue = positionsValue + cash;

  // Recalculate weights
  const sectorWeights = {};
  for (const [ticker, pos] of Object.entries(positions)) {
    pos.currentWeight = totalValue > 0 ? (pos.currentValue / totalValue) * 100 : 0;
  }
  for (const [sector, value] of Object.entries(sectorValues)) {
    sectorWeights[sector] = totalValue > 0 ? (value / totalValue) * 100 : 0;
  }

  const previousHWM = ctx.portfolio.highWaterMark || initialValue;
  const highWaterMark = Math.max(previousHWM, totalValue);

  return {
    cash,
    cashPct: totalValue > 0 ? (cash / totalValue) * 100 : 0,
    totalValue,
    initialValue,
    totalReturn: ((totalValue - initialValue) / initialValue) * 100,
    highWaterMark,
    drawdownFromPeak: ((totalValue - highWaterMark) / highWaterMark) * 100,
    positions,
    positionCount: Object.keys(positions).length,
    sectorWeights,
    initialSectorWeights: ctx.portfolio.initialSectorWeights || {},
  };
}

/**
 * Builds the daily snapshot with cumulative and single-day returns.
 */
function buildDailySnapshot(ctx, portfolio, seasonDoc, previousSnapshot, tradesExecuted) {
  const spyClose = ctx.benchmark?.spyClosePrice ?? 0;
  const spyStartPrice = seasonDoc.spyStartPrice || ctx.benchmark?.spyPriceHistory?.[0] || spyClose;
  const spyReturn = spyStartPrice > 0 ? ((spyClose - spyStartPrice) / spyStartPrice) * 100 : 0;

  // Daily returns computed from actual day-over-day values
  let portfolioDailyReturn = 0;
  let spyDailyReturn = ctx.benchmark?.spyDailyReturn ?? 0;

  if (previousSnapshot) {
    const prevValue = previousSnapshot.portfolioValue;
    if (prevValue > 0) {
      portfolioDailyReturn = ((portfolio.totalValue - prevValue) / prevValue) * 100;
    }
  } else {
    // Day 1: cumulative = daily
    portfolioDailyReturn = portfolio.totalReturn;
  }

  // Stale price detection
  const stalePriceWarnings = detectStalePrices(ctx, portfolio.positions);

  return {
    day: ctx.tradingDay,
    date: ctx.today,
    portfolioValue: portfolio.totalValue,
    portfolioReturn: portfolio.totalReturn,
    portfolioDailyReturn,
    spyReturn,
    spyDailyReturn,
    alpha: portfolio.totalReturn - spyReturn,
    dailyAlpha: portfolioDailyReturn - spyDailyReturn,
    positionCount: portfolio.positionCount,
    cashPct: portfolio.cashPct,
    tradesExecuted,
    stalePriceWarnings,
  };
}

/**
 * Detects tickers with 3+ consecutive unchanged closing prices.
 */
function detectStalePrices(ctx, positions) {
  const warnings = [];
  for (const ticker of Object.keys(positions)) {
    const history = ctx.marketData[ticker]?.priceHistory;
    if (!history || history.length < 3) continue;

    let staleCount = 0;
    for (let i = history.length - 1; i >= 1; i--) {
      if (history[i] === history[i - 1]) {
        staleCount++;
      } else {
        break;
      }
    }

    if (staleCount >= SEASON_SCORING.STALE_PRICE_WARNING_DAYS) {
      warnings.push(ticker);
    }
  }
  return warnings;
}

/**
 * Builds updated season state.
 */
function buildSeasonState(ctx, portfolio, seasonDoc, pipelineResult, trades) {
  const spyClose = ctx.benchmark?.spyClosePrice ?? 0;
  const spyStartPrice = seasonDoc.spyStartPrice || ctx.benchmark?.spyPriceHistory?.[0] || spyClose;
  const spyReturn = spyStartPrice > 0 ? ((spyClose - spyStartPrice) / spyStartPrice) * 100 : 0;

  const existingState = ctx.season || {};
  const totalEvals = countEvaluations(pipelineResult);

  const state = {
    alphaVsSpy: portfolio.totalReturn - spyReturn,
    currentWeek: ctx.currentWeek,
    currentTradingDay: ctx.tradingDay,
    totalTradesExecuted: (existingState.totalTradesExecuted || 0) + trades.length,
    totalRuleEvaluations: (existingState.totalRuleEvaluations || 0) + totalEvals,
    weeklyResults: [...(existingState.weeklyResults || [])],
    weeklySectorReturns: { ...(existingState.weeklySectorReturns || {}) },
    userShortlist: existingState.userShortlist || [],
  };

  // Update weekly results on last trading day of the week
  if (isLastDayOfWeek(ctx.tradingDay, seasonDoc.weeks)) {
    const weekReturn = portfolio.totalReturn; // simplified: cumulative at week end
    state.weeklyResults.push({
      week: ctx.currentWeek,
      portfolioReturn: weekReturn,
      spyReturn,
      alpha: weekReturn - spyReturn,
    });

    // Compute sector returns for the week
    const sectorReturns = {};
    for (const [ticker, pos] of Object.entries(portfolio.positions)) {
      if (pos.sector) {
        if (!sectorReturns[pos.sector]) sectorReturns[pos.sector] = [];
        sectorReturns[pos.sector].push(pos.returnSinceEntry);
      }
    }
    const weekSectorAvg = {};
    for (const [sector, returns] of Object.entries(sectorReturns)) {
      weekSectorAvg[sector] = returns.reduce((s, v) => s + v, 0) / returns.length;
    }
    state.weeklySectorReturns[ctx.currentWeek] = weekSectorAvg;
  }

  return state;
}

/**
 * Checks if the current trading day is the last day of its week.
 */
function isLastDayOfWeek(tradingDay, weeks) {
  if (!weeks || !Array.isArray(weeks)) return false;
  for (const w of weeks) {
    const days = w.tradingDays || [];
    if (days[days.length - 1] === tradingDay) return true;
  }
  return false;
}

/**
 * Counts total rule evaluations from pipeline result.
 */
function countEvaluations(pipelineResult) {
  let count = 0;
  // Exit evaluations: per-ticker per-rule
  const exitEvals = pipelineResult.exitActions.evaluations || {};
  for (const votes of Object.values(exitEvals)) {
    count += votes.length;
  }
  // Rebalance evaluations
  count += (pipelineResult.rebalanceActions.evaluations || []).length;
  // Entry filter results
  const filterResults = pipelineResult.entryActions.filterResults || {};
  for (const fr of Object.values(filterResults)) {
    count += (fr.results || []).length;
  }
  // Strategy mods
  count += (pipelineResult.strategyOverrides.activeModReasons || []).length;
  return count;
}

/**
 * Builds bounded recent activity list (max 10, newest first).
 */
function buildRecentActivity(ctx, trades, previousSnapshot) {
  const now = Date.now();
  const newActivities = trades.map(trade => {
    const base = {
      day: ctx.tradingDay,
      date: ctx.today,
      type: trade.type,
      ticker: trade.ticker,
      reason: trade.reason,
      timestamp: now,
    };

    if (trade.type === 'SELL') {
      base.rules = trade.allCitedRules || [trade.triggerRule];
      base.returnAtAction = trade.returnSinceEntry;
      base.soldPrice = trade.price;
    } else if (trade.type === 'BUY') {
      base.rules = trade.citedRules || [];
      base.entryPrice = trade.price;
      base.weight = trade.weight;
    } else if (trade.type === 'TRIM' || trade.type === 'REDUCE') {
      base.rules = [trade.ruleId];
      base.sharesSold = trade.sharesSold;
    } else if (trade.type === 'ADD') {
      base.rules = [trade.ruleId];
      base.sharesBought = trade.sharesBought;
    }

    return base;
  });

  const existing = previousSnapshot?.recentActivity || [];
  return [...newActivities, ...existing].slice(0, 10);
}

/**
 * Builds rule performance deltas (mergeable increments).
 */
function buildRulePerformanceDeltas(pipelineResult, trades) {
  const deltas = {};

  function ensureRule(ruleId) {
    if (!deltas[ruleId]) deltas[ruleId] = { timesCited: 0 };
  }

  // Exit rule evaluations
  const exitEvals = pipelineResult.exitActions.evaluations || {};
  for (const votes of Object.values(exitEvals)) {
    for (const vote of votes) {
      ensureRule(vote.ruleId);
      deltas[vote.ruleId].timesCited++;
    }
  }

  // Track sells triggered per rule
  for (const sell of pipelineResult.exitActions.sells) {
    for (const ruleId of (sell.allCitedRules || [])) {
      ensureRule(ruleId);
      deltas[ruleId].sellsTriggered = (deltas[ruleId].sellsTriggered || 0) + 1;
    }
    // Attach return at sell to the trigger rule
    if (sell.triggerRule) {
      ensureRule(sell.triggerRule);
      const trade = trades.find(t => t.type === 'SELL' && t.ticker === sell.ticker);
      if (trade) {
        deltas[sell.triggerRule].returnAtSell = trade.returnSinceEntry;
      }
    }
  }

  // Entry rule evaluations
  const filterResults = pipelineResult.entryActions.filterResults || {};
  for (const fr of Object.values(filterResults)) {
    for (const result of (fr.results || [])) {
      if (!result.ruleId) continue;
      ensureRule(result.ruleId);
      deltas[result.ruleId].timesCited++;
      if (result.pass) {
        deltas[result.ruleId].timesPassedEntry = (deltas[result.ruleId].timesPassedEntry || 0) + 1;
      } else {
        deltas[result.ruleId].timesBlockedEntry = (deltas[result.ruleId].timesBlockedEntry || 0) + 1;
      }
    }
  }

  // Rebalance rule evaluations
  for (const evalEntry of (pipelineResult.rebalanceActions.evaluations || [])) {
    if (!evalEntry.ruleId) continue;
    ensureRule(evalEntry.ruleId);
    deltas[evalEntry.ruleId].timesCited++;
  }

  // Strategy mod evaluations
  for (const mod of (pipelineResult.strategyOverrides.activeModReasons || [])) {
    ensureRule(mod.ruleId);
    deltas[mod.ruleId].timesCited++;
    deltas[mod.ruleId].timesActivated = (deltas[mod.ruleId].timesActivated || 0) + 1;
  }

  return deltas;
}

/**
 * Builds counterfactual checks for recently sold stocks.
 */
function buildCounterfactualChecks(ctx, seasonDoc, previousSnapshot) {
  const lookback = SEASON_SCORING.COUNTERFACTUAL_LOOKBACK_DAYS;
  const minDays = SEASON_SCORING.MIN_COUNTERFACTUAL_DAYS;
  const checks = [];

  // Get recent sells from previous activity
  const recentActivity = previousSnapshot?.recentActivity || [];
  const recentSells = recentActivity.filter(a =>
    a.type === 'SELL' &&
    a.day != null &&
    ctx.tradingDay - a.day <= lookback &&
    ctx.tradingDay - a.day > 0
  );

  // Check remaining season days
  const totalTradingDays = seasonDoc.tradingCalendar?.length || (SEASON_CONFIG.TOTAL_WEEKS * 5);
  const remainingDays = totalTradingDays - ctx.tradingDay;

  for (const sell of recentSells) {
    if (remainingDays < minDays) continue;

    const currentPrice = ctx.marketData[sell.ticker]?.closePrice;
    const soldPrice = sell.soldPrice;
    if (!currentPrice || typeof soldPrice !== 'number') continue;

    const daysSinceSell = ctx.tradingDay - sell.day;
    const returnIfHeld = ((currentPrice - soldPrice) / soldPrice) * 100;

    checks.push({
      ticker: sell.ticker,
      soldDay: sell.day,
      soldPrice,
      currentPrice,
      daysSinceSell,
      returnIfHeld,
      complete: daysSinceSell >= lookback,
    });
  }

  return checks;
}
