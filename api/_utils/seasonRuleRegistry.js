/**
 * Season Rule Registry — Entry & Exit evaluation functions
 * Pure functions: no Firestore reads, no side effects, no data fetching.
 * Rebalancing & season-state rules added in B-2b.
 */

import { RESULT_TYPES, PRIORITY } from './seasonConfig.js';

// ─── Registry ─────────────────────────────────────────────────

const registry = {};

export function registerRule(id, rule) {
  registry[id] = rule;
}

export function getRule(id) {
  return registry[id] || null;
}

export function getRulesByPhase(phase) {
  return Object.entries(registry)
    .filter(([_, r]) => r.phase === phase)
    .map(([id, r]) => ({ id, ...r }));
}

export function evaluateRule(ruleId, ticker, userParams, ctx) {
  const rule = registry[ruleId];
  if (!rule) return null;
  return rule.evaluate(ticker, userParams, ctx);
}

// ─── Utility Functions ────────────────────────────────────────

/**
 * Pearson correlation between two price series.
 * Converts prices to returns first, then computes correlation.
 */
export function computeCorrelation(seriesA, seriesB) {
  if (!seriesA || !seriesB || seriesA.length < 3 || seriesB.length < 3) return 0;
  const len = Math.min(seriesA.length, seriesB.length);

  const returnsA = [];
  const returnsB = [];
  for (let i = 1; i < len; i++) {
    returnsA.push((seriesA[i] - seriesA[i - 1]) / seriesA[i - 1]);
    returnsB.push((seriesB[i] - seriesB[i - 1]) / seriesB[i - 1]);
  }

  const n = returnsA.length;
  if (n < 2) return 0;

  const meanA = returnsA.reduce((s, v) => s + v, 0) / n;
  const meanB = returnsB.reduce((s, v) => s + v, 0) / n;

  let cov = 0, varA = 0, varB = 0;
  for (let i = 0; i < n; i++) {
    const dA = returnsA[i] - meanA;
    const dB = returnsB[i] - meanB;
    cov += dA * dB;
    varA += dA * dA;
    varB += dB * dB;
  }

  const denom = Math.sqrt(varA * varB);
  return denom === 0 ? 0 : cov / denom;
}

// ─── Entry Criteria (Phase: 'entry') ─────────────────────────
// Each returns: { type: ENTRY_FILTER, ticker, pass, reason }

// SE-01: RSI Entry Gate
registerRule('se-01', {
  phase: 'entry',
  priority: PRIORITY.HARD,
  evaluate: (ticker, params, ctx) => {
    const rsi = ctx.technicals[ticker]?.rsiValue;
    if (rsi == null) return { type: RESULT_TYPES.ENTRY_FILTER, ticker, pass: false, reason: 'No RSI data available' };
    const pass = rsi <= params.upper;
    return {
      type: RESULT_TYPES.ENTRY_FILTER, ticker, pass,
      reason: pass ? `RSI ${rsi.toFixed(1)} below ${params.upper}` : `RSI ${rsi.toFixed(1)} exceeds max ${params.upper}`,
    };
  },
});

// SE-02: Volume Confirmation
registerRule('se-02', {
  phase: 'entry',
  priority: PRIORITY.HARD,
  evaluate: (ticker, params, ctx) => {
    const rvol = ctx.technicals[ticker]?.rvol;
    if (rvol == null) return { type: RESULT_TYPES.ENTRY_FILTER, ticker, pass: false, reason: 'No volume data available' };
    const pass = rvol >= params.multiplier;
    return {
      type: RESULT_TYPES.ENTRY_FILTER, ticker, pass,
      reason: pass ? `RVOL ${rvol.toFixed(2)}x meets ${params.multiplier}x threshold` : `RVOL ${rvol.toFixed(2)}x below ${params.multiplier}x requirement`,
    };
  },
});

// SE-03: Trend Alignment Filter
registerRule('se-03', {
  phase: 'entry',
  priority: PRIORITY.HARD,
  evaluate: (ticker, params, ctx) => {
    const smaKey = `sma${params.period}`;
    const sma = ctx.technicals[ticker]?.[smaKey];
    const price = ctx.marketData[ticker]?.closePrice;
    if (sma == null || price == null) return { type: RESULT_TYPES.ENTRY_FILTER, ticker, pass: false, reason: `No SMA${params.period} or price data` };
    const pass = price > sma;
    return {
      type: RESULT_TYPES.ENTRY_FILTER, ticker, pass,
      reason: pass ? `Price $${price.toFixed(2)} above ${params.period}-day SMA $${sma.toFixed(2)}` : `Price $${price.toFixed(2)} below ${params.period}-day SMA $${sma.toFixed(2)}`,
    };
  },
});

// SE-04: Earnings Avoidance Window
registerRule('se-04', {
  phase: 'entry',
  priority: PRIORITY.HARD,
  evaluate: (ticker, params, ctx) => {
    const daysUntil = ctx.earnings[ticker]?.tradingDaysUntil;
    if (daysUntil == null) return { type: RESULT_TYPES.ENTRY_FILTER, ticker, pass: true, reason: 'No earnings date found — passing' };
    const pass = daysUntil > params.days;
    return {
      type: RESULT_TYPES.ENTRY_FILTER, ticker, pass,
      reason: pass ? `Earnings in ${daysUntil} days, outside ${params.days}-day window` : `Earnings in ${daysUntil} days, within ${params.days}-day avoidance window`,
    };
  },
});

// SE-05: Fundamental Floor
registerRule('se-05', {
  phase: 'entry',
  priority: PRIORITY.SOFT,
  evaluate: (ticker, params, ctx) => {
    const score = ctx.fundamentals[ticker]?.overallScore;
    if (score == null) return { type: RESULT_TYPES.ENTRY_FILTER, ticker, pass: false, reason: 'No fundamental score available' };
    const pass = score >= params.minScore;
    return {
      type: RESULT_TYPES.ENTRY_FILTER, ticker, pass,
      reason: pass ? `Fundamental score ${score} meets minimum ${params.minScore}` : `Fundamental score ${score} below minimum ${params.minScore}`,
    };
  },
});

// SE-06: Momentum Entry Threshold
registerRule('se-06', {
  phase: 'entry',
  priority: PRIORITY.SOFT,
  evaluate: (ticker, params, ctx) => {
    const history = ctx.marketData[ticker]?.priceHistory;
    if (!history || history.length < params.period + 1) return { type: RESULT_TYPES.ENTRY_FILTER, ticker, pass: false, reason: `Insufficient price history for ${params.period}-day lookback` };
    const current = history[history.length - 1];
    const past = history[history.length - 1 - params.period];
    const changePct = ((current - past) / past) * 100;
    const pass = changePct >= params.pct;
    return {
      type: RESULT_TYPES.ENTRY_FILTER, ticker, pass,
      reason: pass ? `${params.period}-day change +${changePct.toFixed(1)}% meets ${params.pct}% threshold` : `${params.period}-day change ${changePct.toFixed(1)}% below ${params.pct}% threshold`,
    };
  },
});

// SE-07: Sector Freshness Check
registerRule('se-07', {
  phase: 'entry',
  priority: PRIORITY.HARD,
  evaluate: (ticker, params, ctx) => {
    const sector = ctx.fundamentals[ticker]?.sector;
    if (!sector) return { type: RESULT_TYPES.ENTRY_FILTER, ticker, pass: true, reason: 'No sector data — passing' };
    const currentWeight = ctx.portfolio.sectorWeights[sector] || 0;
    const pass = currentWeight < params.maxPct;
    return {
      type: RESULT_TYPES.ENTRY_FILTER, ticker, pass,
      reason: pass ? `${sector} at ${currentWeight.toFixed(1)}%, below ${params.maxPct}% cap` : `${sector} already at ${currentWeight.toFixed(1)}%, exceeds ${params.maxPct}% cap`,
    };
  },
});

// SE-08: Institutional Sentiment Check
registerRule('se-08', {
  phase: 'entry',
  priority: PRIORITY.SOFT,
  evaluate: (ticker, params, ctx) => {
    if (params.direction === 'any') return { type: RESULT_TYPES.ENTRY_FILTER, ticker, pass: true, reason: 'Institutional filter disabled (any)' };
    const trend = ctx.institutional[ticker]?.ownershipTrend;
    if (!trend) return { type: RESULT_TYPES.ENTRY_FILTER, ticker, pass: false, reason: 'No institutional data available' };
    let pass = false;
    if (params.direction === 'increased') pass = trend === 'increased';
    else if (params.direction === 'stable_or_increased') pass = trend === 'increased' || trend === 'stable';
    return {
      type: RESULT_TYPES.ENTRY_FILTER, ticker, pass,
      reason: pass ? `Institutional ownership ${trend} over ${params.quarters}Q — matches ${params.direction}` : `Institutional ownership ${trend} — does not match ${params.direction}`,
    };
  },
});

// ─── Exit & Stops (Phase: 'exit') ────────────────────────────
// Each returns: { type: EXIT_SIGNAL, ticker, action: 'SELL'|'HOLD', priority, reason }

// SX-01: Fixed Stop-Loss
registerRule('sx-01', {
  phase: 'exit',
  priority: PRIORITY.HARD,
  evaluate: (ticker, params, ctx) => {
    const pos = ctx.portfolio.positions[ticker];
    if (!pos) return null;
    const returnPct = pos.returnSinceEntry;
    const triggered = returnPct <= -params.pct;
    return {
      type: RESULT_TYPES.EXIT_SIGNAL, ticker, action: triggered ? 'SELL' : 'HOLD', priority: PRIORITY.HARD,
      reason: triggered ? `Down ${Math.abs(returnPct).toFixed(1)}% from entry, stop-loss at ${params.pct}%` : `Down ${Math.abs(returnPct).toFixed(1)}% from entry, within ${params.pct}% stop`,
    };
  },
});

// SX-02: Trailing Stop
registerRule('sx-02', {
  phase: 'exit',
  priority: PRIORITY.HARD,
  evaluate: (ticker, params, ctx) => {
    const pos = ctx.portfolio.positions[ticker];
    if (!pos) return null;
    const drawdown = pos.drawdownFromPeak;
    const triggered = drawdown <= -params.pct;
    return {
      type: RESULT_TYPES.EXIT_SIGNAL, ticker, action: triggered ? 'SELL' : 'HOLD', priority: PRIORITY.HARD,
      reason: triggered ? `Down ${Math.abs(drawdown).toFixed(1)}% from peak, trailing stop at ${params.pct}%` : `${Math.abs(drawdown).toFixed(1)}% from peak, within ${params.pct}% trail`,
    };
  },
});

// SX-03: Time-Based Exit
registerRule('sx-03', {
  phase: 'exit',
  priority: PRIORITY.SOFT,
  evaluate: (ticker, params, ctx) => {
    const pos = ctx.portfolio.positions[ticker];
    if (!pos) return null;
    const expired = pos.daysSinceEntry >= params.days && pos.returnSinceEntry < params.pct;
    let reason;
    if (expired) reason = `Held ${pos.daysSinceEntry} days with only ${pos.returnSinceEntry.toFixed(1)}% gain (needs ${params.pct}%)`;
    else if (pos.daysSinceEntry < params.days) reason = `Only ${pos.daysSinceEntry}/${params.days} days elapsed`;
    else reason = `Gained ${pos.returnSinceEntry.toFixed(1)}%, above ${params.pct}% minimum`;
    return {
      type: RESULT_TYPES.EXIT_SIGNAL, ticker, action: expired ? 'SELL' : 'HOLD', priority: PRIORITY.SOFT,
      reason,
    };
  },
});

// SX-04: Profit Target
registerRule('sx-04', {
  phase: 'exit',
  priority: PRIORITY.SOFT,
  evaluate: (ticker, params, ctx) => {
    const pos = ctx.portfolio.positions[ticker];
    if (!pos) return null;
    const hit = pos.returnSinceEntry >= params.pct;
    return {
      type: RESULT_TYPES.EXIT_SIGNAL, ticker, action: hit ? 'SELL' : 'HOLD', priority: PRIORITY.SOFT,
      reason: hit ? `Up ${pos.returnSinceEntry.toFixed(1)}%, profit target ${params.pct}% reached` : `Up ${pos.returnSinceEntry.toFixed(1)}%, below ${params.pct}% target`,
    };
  },
});

// SX-05: Technical Exit Signal
registerRule('sx-05', {
  phase: 'exit',
  priority: PRIORITY.SOFT,
  evaluate: (ticker, params, ctx) => {
    const pos = ctx.portfolio.positions[ticker];
    if (!pos) return null;
    const tech = ctx.technicals[ticker];
    const price = ctx.marketData[ticker]?.closePrice;
    if (!tech || !price) return { type: RESULT_TYPES.EXIT_SIGNAL, ticker, action: 'HOLD', priority: PRIORITY.SOFT, reason: 'No technical data — holding' };

    let triggered = false;
    let reason = '';

    if (params.trigger === 'rsi_overbought' || params.trigger === 'either_rsi_or_macd') {
      if (tech.rsiValue >= params.rsiThreshold) { triggered = true; reason = `RSI ${tech.rsiValue.toFixed(1)} above ${params.rsiThreshold}`; }
    }
    if (params.trigger === 'macd_bearish' || params.trigger === 'either_rsi_or_macd') {
      const bearishCross = tech.macdLine < tech.macdSignal && (tech.previousMacdLine >= tech.previousMacdSignal);
      if (bearishCross) { triggered = true; reason = reason ? `${reason} + MACD bearish crossover` : 'MACD bearish crossover'; }
    }
    if (params.trigger === 'below_sma') {
      const sma = tech[`sma${params.smaPeriod}`];
      if (sma && price < sma) { triggered = true; reason = `Price $${price.toFixed(2)} below ${params.smaPeriod}-day SMA $${sma.toFixed(2)}`; }
    }

    return {
      type: RESULT_TYPES.EXIT_SIGNAL, ticker, action: triggered ? 'SELL' : 'HOLD', priority: PRIORITY.SOFT,
      reason: triggered ? reason : `No technical breakdown detected (${params.trigger})`,
    };
  },
});

// SX-06: Earnings Exit
registerRule('sx-06', {
  phase: 'exit',
  priority: PRIORITY.SOFT,
  evaluate: (ticker, params, ctx) => {
    const pos = ctx.portfolio.positions[ticker];
    if (!pos) return null;
    const daysUntil = ctx.earnings[ticker]?.tradingDaysUntil;
    if (daysUntil == null) return { type: RESULT_TYPES.EXIT_SIGNAL, ticker, action: 'HOLD', priority: PRIORITY.SOFT, reason: 'No earnings date — holding' };
    const inWindow = daysUntil <= params.days;
    const profitCheck = params.onlyIfProfitable ? pos.returnSinceEntry > 0 : true;
    const triggered = inWindow && profitCheck;
    let reason;
    if (triggered) reason = `Earnings in ${daysUntil} days${params.onlyIfProfitable ? `, profitable at +${pos.returnSinceEntry.toFixed(1)}%` : ''}`;
    else if (inWindow) reason = `Earnings in ${daysUntil} days but position is unprofitable (${pos.returnSinceEntry.toFixed(1)}%)`;
    else reason = `Earnings in ${daysUntil} days, outside ${params.days}-day window`;
    return {
      type: RESULT_TYPES.EXIT_SIGNAL, ticker, action: triggered ? 'SELL' : 'HOLD', priority: PRIORITY.SOFT,
      reason,
    };
  },
});

// SX-07: Correlation-Based Exit
// NOTE: This rule is special — it evaluates ALL position pairs, not a single ticker.
// The pipeline calls this once with ticker=null, then processes results.
// Returns an ARRAY of exit signals (not a single result).
registerRule('sx-07', {
  phase: 'exit',
  priority: PRIORITY.SOFT,
  evaluate: (ticker, params, ctx) => {
    const positions = Object.keys(ctx.portfolio.positions);
    const pairs = [];

    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const a = positions[i], b = positions[j];
        const histA = ctx.marketData[a]?.priceHistory?.slice(-params.days);
        const histB = ctx.marketData[b]?.priceHistory?.slice(-params.days);
        if (!histA || !histB) continue;
        const corr = computeCorrelation(histA, histB);
        if (corr >= params.threshold) {
          const retA = ctx.portfolio.positions[a].returnSinceEntry;
          const retB = ctx.portfolio.positions[b].returnSinceEntry;
          const weaker = retA <= retB ? a : b;
          pairs.push({ ticker: weaker, correlation: corr, pair: [a, b] });
        }
      }
    }

    if (pairs.length === 0) return { type: RESULT_TYPES.EXIT_SIGNAL, ticker: null, action: 'HOLD', priority: PRIORITY.SOFT, reason: 'No position pairs exceed correlation threshold' };

    return pairs.map(p => ({
      type: RESULT_TYPES.EXIT_SIGNAL,
      ticker: p.ticker,
      action: 'SELL',
      priority: PRIORITY.SOFT,
      reason: `Correlated ${p.correlation.toFixed(2)} with ${p.pair.find(t => t !== p.ticker)} over ${params.days} days (threshold ${params.threshold})`,
    }));
  },
});

// ─── Exports ──────────────────────────────────────────────────

export { registry };
