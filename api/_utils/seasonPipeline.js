/**
 * Season Pipeline Orchestrator — 5-phase evaluation engine
 *
 * Pure logic — no Firestore writes. Returns actions to be applied by settlement.
 * Phases: Strategy Mods → Exit → Rebalance → Entry → Summary
 */

import { evaluateRule, registry } from './seasonRuleRegistry.js';
import { SEASON_CONFIG, SEASON_SCORING, ENTRY_SCORE_WEIGHTS } from './seasonConfig.js';

// ─── Main Export ──────────────────────────────────────────────

/**
 * Executes the 5-phase evaluation pipeline for a single entry.
 *
 * @param {Object} ctx - EvaluationContext (from seasonEvalContext.js)
 * @param {Object[]} activeRules - User's equipped rules with params
 *   Each: { ruleId: 'se-01', params: { upper: 65 }, enabled: true }
 * @param {Object} options - { softMajorityThreshold: 0.5 }
 * @returns {Object} PipelineResult
 */
export function executePipeline(ctx, activeRules, options = {}) {
  const softMajorityThreshold = options.softMajorityThreshold || 0.5;

  // Phase 1: Strategy Mods
  const strategyOverrides = executeStrategyPhase(ctx, activeRules);

  // Phase 2: Exit Evaluation (with strategy overrides applied)
  const exitActions = executeExitPhase(ctx, activeRules, strategyOverrides, softMajorityThreshold);

  // Phase 3: Rebalancing (against remaining positions after exits)
  const rebalanceActions = executeRebalancePhase(ctx, activeRules, exitActions);

  // Phase 4: Entry Scan (if cash available and not locked down)
  const entryActions = executeEntryPhase(ctx, activeRules, exitActions, rebalanceActions, strategyOverrides);

  return {
    strategyOverrides,
    exitActions,
    rebalanceActions,
    entryActions,
    summary: buildSummary(exitActions, rebalanceActions, entryActions),
  };
}

// ─── Phase 1: Strategy Mods (SS-xx) ──────────────────────────

export function executeStrategyPhase(ctx, activeRules) {
  const strategyRules = activeRules.filter(r =>
    r.enabled && registry[r.ruleId]?.phase === 'strategy'
  );

  const overrides = {
    preferHighBeta: false,
    protectLead: false,
    tightenTrailingStop: null,
    maxBeta: null,
    blockEntries: false,
    reduceBeta: false,
    reduceBetaPct: null,
    tiltSectors: null,
    shortlistPriority: null,
    activeModReasons: [],
  };

  for (const rule of strategyRules) {
    const result = evaluateRule(rule.ruleId, null, rule.params, ctx);
    if (!result || !result.active) continue;

    overrides.activeModReasons.push({ ruleId: rule.ruleId, effect: result.effect, reason: result.reason });

    switch (result.effect) {
      case 'prefer_high_beta':
        overrides.preferHighBeta = true;
        break;
      case 'protect_lead':
        overrides.protectLead = true;
        overrides.tightenTrailingStop = result.params?.tightenTrailingStop;
        overrides.maxBeta = result.params?.maxBeta;
        break;
      case 'block_entries':
        overrides.blockEntries = true;
        break;
      case 'reduce_beta':
        overrides.reduceBeta = true;
        overrides.reduceBetaPct = result.params?.reducePct;
        break;
      case 'tilt_sectors':
        overrides.tiltSectors = result.params;
        break;
      case 'shortlist_priority':
        overrides.shortlistPriority = result.params;
        break;
    }
  }

  return overrides;
}

// ─── Phase 2: Exit Evaluation (SX-xx) ────────────────────────

export function executeExitPhase(ctx, activeRules, strategyOverrides, softMajorityThreshold) {
  const exitRules = activeRules.filter(r =>
    r.enabled && registry[r.ruleId]?.phase === 'exit'
  );

  const sells = [];
  const evaluations = {};
  const positions = Object.keys(ctx.portfolio.positions);

  // Handle SX-07 (correlation) separately — evaluates all pairs, returns array
  const correlationRule = exitRules.find(r => r.ruleId === 'sx-07');
  let correlationSells = [];
  if (correlationRule) {
    const result = evaluateRule('sx-07', null, correlationRule.params, ctx);
    if (Array.isArray(result)) {
      correlationSells = result.filter(r => r.action === 'SELL');
    }
  }

  for (const ticker of positions) {
    const votes = [];

    for (const rule of exitRules) {
      if (rule.ruleId === 'sx-07') continue;

      // Apply SS-02 trailing stop override to SX-02
      let params = { ...rule.params };
      if (rule.ruleId === 'sx-02' && strategyOverrides.tightenTrailingStop) {
        params.pct = Math.min(params.pct, strategyOverrides.tightenTrailingStop);
      }

      const result = evaluateRule(rule.ruleId, ticker, params, ctx);
      if (!result) continue;

      votes.push({
        ruleId: rule.ruleId,
        action: result.action,
        priority: result.priority,
        reason: result.reason,
      });
    }

    // Add correlation result for this ticker if applicable
    const corrSell = correlationSells.find(r => r.ticker === ticker);
    if (corrSell) {
      votes.push({
        ruleId: 'sx-07',
        action: 'SELL',
        priority: 'soft',
        reason: corrSell.reason,
      });
    }

    evaluations[ticker] = votes;

    // ── Conflict Resolution ──────────────────────────────
    // Any hard SELL → mandatory sell
    const hardSells = votes.filter(v => v.action === 'SELL' && v.priority === 'hard');
    if (hardSells.length > 0) {
      sells.push({
        ticker,
        reason: hardSells[0].reason,
        triggerRule: hardSells[0].ruleId,
        allCitedRules: votes.filter(v => v.action === 'SELL').map(v => v.ruleId),
        priority: 'hard',
        votes: { sell: votes.filter(v => v.action === 'SELL').length, hold: votes.filter(v => v.action === 'HOLD').length },
      });
      continue;
    }

    // Soft majority vote
    const softSells = votes.filter(v => v.action === 'SELL');
    const totalVotes = votes.length;
    if (totalVotes > 0 && softSells.length / totalVotes > softMajorityThreshold) {
      sells.push({
        ticker,
        reason: softSells.map(v => v.reason).join('; '),
        triggerRule: softSells[0].ruleId,
        allCitedRules: softSells.map(v => v.ruleId),
        priority: 'soft_majority',
        votes: { sell: softSells.length, hold: totalVotes - softSells.length },
      });
    }
  }

  return { sells, evaluations };
}

// ─── Phase 3: Rebalancing (SR-xx) ────────────────────────────

export function executeRebalancePhase(ctx, activeRules, exitActions) {
  const rebalanceRules = activeRules.filter(r =>
    r.enabled && registry[r.ruleId]?.phase === 'rebalance'
  );

  const trims = [];
  const adds = [];
  const reduces = [];
  let deployCash = false;
  const evaluations = [];

  // Positions remaining after exits
  const soldTickers = new Set(exitActions.sells.map(s => s.ticker));
  const remainingPositions = Object.keys(ctx.portfolio.positions)
    .filter(t => !soldTickers.has(t));

  for (const rule of rebalanceRules) {
    // SR-02 (cash deployment) — portfolio-level, no ticker
    if (rule.ruleId === 'sr-02') {
      const result = evaluateRule('sr-02', null, rule.params, ctx);
      evaluations.push({ ruleId: 'sr-02', result });
      if (result?.action === 'DEPLOY_CASH') deployCash = true;
      continue;
    }

    // SR-03 (sector drift) — portfolio-level, returns array
    if (rule.ruleId === 'sr-03') {
      const result = evaluateRule('sr-03', null, rule.params, ctx);
      evaluations.push({ ruleId: 'sr-03', result });
      continue;
    }

    // Per-position rules: SR-01 (trim), SR-04 (add), SR-05 (reduce)
    for (const ticker of remainingPositions) {
      const result = evaluateRule(rule.ruleId, ticker, rule.params, ctx);
      if (!result) continue;
      evaluations.push({ ruleId: rule.ruleId, ticker, result });

      if (result.action === 'TRIM') {
        trims.push({ ticker, targetWeight: result.targetWeight, reason: result.reason, ruleId: rule.ruleId });
      } else if (result.action === 'ADD') {
        const isTrimmed = trims.some(t => t.ticker === ticker);
        if (!isTrimmed) {
          adds.push({ ticker, targetWeight: result.targetWeight, reason: result.reason, ruleId: rule.ruleId });
        }
      } else if (result.action === 'REDUCE') {
        reduces.push({ ticker, targetWeight: result.targetWeight, reason: result.reason, ruleId: rule.ruleId });
      }
    }
  }

  // TRIM (hard) overrides ADD (soft) on same ticker
  const trimTickers = new Set(trims.map(t => t.ticker));
  const filteredAdds = adds.filter(a => !trimTickers.has(a.ticker));

  return { trims, adds: filteredAdds, reduces, deployCash, evaluations };
}

// ─── Phase 4: Entry Scan (SE-xx) ─────────────────────────────

export function executeEntryPhase(ctx, activeRules, exitActions, rebalanceActions, strategyOverrides) {
  // Check blockers
  if (strategyOverrides.blockEntries) {
    return { buys: [], tieBreakNeeded: [], blocked: true, reason: 'Final week lockdown (SS-03)', filterResults: {}, candidatesEvaluated: 0, candidatesPassed: 0 };
  }

  // Estimate available cash after exits
  const sellValue = exitActions.sells.reduce((sum, s) => {
    const pos = ctx.portfolio.positions[s.ticker];
    return sum + (pos ? pos.currentValue : 0);
  }, 0);
  const availableCash = ctx.portfolio.cash + sellValue;

  if (availableCash < ctx.portfolio.totalValue * 0.02) {
    return { buys: [], tieBreakNeeded: [], blocked: false, reason: 'Insufficient cash for new entries', filterResults: {}, candidatesEvaluated: 0, candidatesPassed: 0 };
  }

  const entryRules = activeRules.filter(r =>
    r.enabled && registry[r.ruleId]?.phase === 'entry'
  );

  // With no entry rules equipped, every universe ticker would vacuously pass
  // the empty filter set and the pipeline would buy the top N by generic score.
  // That's surprising UX — skip the scan entirely instead.
  if (entryRules.length === 0) {
    return { buys: [], tieBreakNeeded: [], blocked: false, reason: 'No entry rules equipped', filterResults: {}, candidatesEvaluated: 0, candidatesPassed: 0 };
  }

  const hardEntryRules = entryRules.filter(r => registry[r.ruleId]?.priority === 'hard');
  const softEntryRules = entryRules.filter(r => registry[r.ruleId]?.priority === 'soft');

  // Universe: all tickers in marketData not currently held
  const heldTickers = new Set(Object.keys(ctx.portfolio.positions));
  const universe = Object.keys(ctx.marketData).filter(t => !heldTickers.has(t) && t !== 'SPY');

  const passing = [];
  const filterResults = {};

  for (const ticker of universe) {
    const results = [];
    let passedAllHard = true;

    for (const rule of hardEntryRules) {
      const result = evaluateRule(rule.ruleId, ticker, rule.params, ctx);
      results.push({ ruleId: rule.ruleId, ...result });
      if (!result?.pass) passedAllHard = false;
    }

    if (!passedAllHard) {
      filterResults[ticker] = { results, passed: false };
      continue;
    }

    let softPassed = 0;
    for (const rule of softEntryRules) {
      const result = evaluateRule(rule.ruleId, ticker, rule.params, ctx);
      results.push({ ruleId: rule.ruleId, ...result });
      if (result?.pass) softPassed++;
    }

    // Require majority of soft rules to pass
    const softTotal = softEntryRules.length;
    const softThreshold = softTotal > 0 ? Math.ceil(softTotal * 0.5) : 0;

    if (softPassed >= softThreshold) {
      const score = computeEntryScore(ticker, ctx, strategyOverrides);
      passing.push({ ticker, score, results, softPassed, softTotal });
      filterResults[ticker] = { results, passed: true, score };
    } else {
      filterResults[ticker] = { results, passed: false };
    }
  }

  // Sort by score descending
  passing.sort((a, b) => b.score - a.score);

  // Apply shortlist priority (SS-06)
  if (strategyOverrides.shortlistPriority) {
    const { priority, tickers: shortlist } = strategyOverrides.shortlistPriority;
    if (priority === 'first_in_line') {
      const shortlistPassing = passing.filter(p => shortlist.includes(p.ticker));
      const otherPassing = passing.filter(p => !shortlist.includes(p.ticker));
      passing.length = 0;
      passing.push(...shortlistPassing, ...otherPassing);
    } else if (priority === 'only_if_no_better_candidates') {
      const shortlistPassing = passing.filter(p => shortlist.includes(p.ticker));
      const otherPassing = passing.filter(p => !shortlist.includes(p.ticker));
      passing.length = 0;
      passing.push(...otherPassing, ...shortlistPassing);
    }
  }

  // Detect tie-break candidates (top scores within threshold of each other)
  const tieBreakNeeded = [];
  if (passing.length >= 2) {
    const topScore = passing[0].score;
    const threshold = topScore * SEASON_SCORING.TIE_BREAK_THRESHOLD;
    const closeOnes = passing.filter(p => topScore - p.score <= threshold);
    if (closeOnes.length >= 2) {
      tieBreakNeeded.push(...closeOnes);
    }
  }

  // Size positions
  const maxPositionPct = getMaxPositionWeight(activeRules);
  const currentPositionCount = Object.keys(ctx.portfolio.positions).length - exitActions.sells.length;
  const slotsAvailable = SEASON_CONFIG.MAX_POSITIONS - currentPositionCount;
  const buyCount = Math.min(passing.length, Math.max(0, slotsAvailable));
  const perPositionPct = Math.min(100 / SEASON_CONFIG.TARGET_POSITIONS, maxPositionPct);

  const buys = passing.slice(0, buyCount).map(p => ({
    ticker: p.ticker,
    weight: perPositionPct,
    dollarAmount: (availableCash * perPositionPct) / 100,
    reason: `Entry scan — passed ${p.results.filter(r => r.pass).length}/${p.results.length} filters, score ${p.score.toFixed(1)}`,
    citedRules: p.results.filter(r => r.pass).map(r => r.ruleId),
    score: p.score,
    shortlistBonus: strategyOverrides.shortlistPriority?.tickers?.includes(p.ticker) || false,
  }));

  return {
    buys,
    tieBreakNeeded,
    blocked: false,
    filterResults,
    candidatesEvaluated: universe.length,
    candidatesPassed: passing.length,
  };
}

// ─── Helpers ──────────────────────────────────────────────────

/**
 * Computes a weighted entry score for a candidate ticker.
 */
export function computeEntryScore(ticker, ctx, strategyOverrides) {
  const tech = ctx.technicals[ticker];
  const fund = ctx.fundamentals[ticker];
  const inst = ctx.institutional[ticker];
  const market = ctx.marketData[ticker];

  // Normalize each score to 0-100
  const techScore = tech?.rsiValue != null ? Math.max(0, 100 - tech.rsiValue) : 50;
  const fundScore = fund?.overallScore || 50;

  let momentumScore = 50;
  if (market?.priceHistory?.length > 10) {
    const cur = market.priceHistory[market.priceHistory.length - 1];
    const past = market.priceHistory[market.priceHistory.length - 11];
    const changePct = ((cur - past) / past) * 100;
    momentumScore = Math.max(0, Math.min(100, 50 + changePct * 2.5));
  }

  const instScore = inst?.ownershipTrend === 'increased' ? 80 : inst?.ownershipTrend === 'stable' ? 60 : 40;
  const volumeScore = tech?.rvol != null ? Math.min(100, tech.rvol * 50) : 50;

  let score = (
    ENTRY_SCORE_WEIGHTS.technicalScore * techScore +
    ENTRY_SCORE_WEIGHTS.fundamentalScore * fundScore +
    ENTRY_SCORE_WEIGHTS.momentumScore * momentumScore +
    ENTRY_SCORE_WEIGHTS.instScore * instScore +
    ENTRY_SCORE_WEIGHTS.volumeScore * volumeScore
  );

  // SS-01: boost high-beta candidates when trailing benchmark
  if (strategyOverrides.preferHighBeta) {
    const beta = fund?.beta || 1.0;
    score *= (1 + (beta - 1) * 0.2);
  }

  // SS-02: penalize candidates above beta cap when protecting lead
  if (strategyOverrides.maxBeta) {
    const beta = fund?.beta || 1.0;
    if (beta > strategyOverrides.maxBeta) score *= 0.5;
  }

  return score;
}

function getMaxPositionWeight(activeRules) {
  const sr01 = activeRules.find(r => r.ruleId === 'sr-01' && r.enabled);
  return sr01 ? sr01.params.maxPct : 15;
}

function buildSummary(exitActions, rebalanceActions, entryActions) {
  return {
    sellCount: exitActions.sells.length,
    trimCount: rebalanceActions.trims.length,
    addCount: rebalanceActions.adds.length,
    reduceCount: rebalanceActions.reduces.length,
    buyCount: entryActions.buys.length,
    deployCash: rebalanceActions.deployCash,
    blocked: entryActions.blocked || false,
    tieBreakCount: entryActions.tieBreakNeeded.length,
  };
}
