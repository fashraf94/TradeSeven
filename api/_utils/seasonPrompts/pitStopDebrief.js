/**
 * Season Mode — Pit Stop Debrief Prompt Builder
 *
 * Generates the two-act weekend debrief (review + next-week prep) that the
 * pit stop UI displays. Called lazily when the user opens the pit stop for
 * the first time each week. Uses Sonnet for higher-quality reasoning.
 *
 * Also exports findNearMissCandidates(), a pure helper that identifies stocks
 * that failed exactly one entry rule by a small margin. Used by the debrief
 * user-message assembly to populate the "momentum watchlist" section.
 *
 * Pure request-body builder + response parser. No SDK import, no network.
 */

import { evaluateRule, getRule } from '../seasonRuleRegistry.js';

// ─── System Prompt ──────────────────────────────────────────────
// Built at request time by `buildDebriefSystemPrompt` (below) so the
// framing ("N-week session", "next week" vs "next session") adapts to
// duration + solo-final-week context from the caller.

// ─── Tool Schema ─────────────────────────────────────────────────────

const PIT_STOP_DEBRIEF_TOOL = {
  name: 'generate_pit_stop_debrief',
  description: 'Generate the structured weekend pit stop debrief with review and next-week preparation',
  input_schema: {
    type: 'object',
    properties: {
      summary: { type: 'string', description: '2-3 sentence narrative summary of the week' },
      highlights: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['win', 'loss'] },
            ticker: { type: 'string' },
            detail: { type: 'string', description: '1-2 sentences about what happened' },
          },
          required: ['type', 'ticker', 'detail'],
        },
      },
      ruleInsights: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            ruleId: { type: 'string' },
            insight: { type: 'string', description: 'Specific observation about this rule this week' },
          },
          required: ['ruleId', 'insight'],
        },
      },
      upcomingEvents: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string' },
            date: { type: 'string' },
            note: { type: 'string', description: 'How this event might affect the portfolio' },
          },
          required: ['type', 'date', 'note'],
        },
      },
      suggestedChanges: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            ruleId: { type: 'string' },
            paramName: { type: 'string' },
            currentValue: {},
            suggestedValue: {},
            rationale: { type: 'string' },
          },
          required: ['ruleId', 'paramName', 'currentValue', 'suggestedValue', 'rationale'],
        },
      },
      nextWeekPrep: {
        type: 'object',
        properties: {
          lessonsIntoAction: {
            type: 'array',
            items: { type: 'string' },
            description: 'Lessons from this week translated into next-week actions',
          },
          momentumWatchlist: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                ticker: { type: 'string' },
                nearMissRule: { type: 'string' },
                gap: { type: 'string', description: 'How close to passing, e.g., "RSI 67 vs threshold 65"' },
              },
              required: ['ticker'],
            },
          },
          thematicOpportunities: {
            type: 'array',
            items: { type: 'string' },
          },
          riskRadar: {
            type: 'array',
            items: { type: 'string' },
          },
          shortlistCandidates: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                ticker: { type: 'string' },
                conviction: { type: 'string', enum: ['high', 'medium', 'low'] },
                rationale: { type: 'string' },
                themeConnection: { type: 'string' },
              },
              required: ['ticker', 'conviction', 'rationale'],
            },
          },
        },
        required: ['lessonsIntoAction', 'shortlistCandidates'],
      },
    },
    required: ['summary', 'highlights', 'ruleInsights', 'suggestedChanges', 'nextWeekPrep'],
  },
};

// ─── Near-Miss Extractors ────────────────────────────────────────────

/**
 * Per-rule extractors that pull the actual observed value, the threshold, and
 * a human-readable label from ctx for the numeric entry rules. Discrete rules
 * (se-04 earnings window, se-08 institutional direction) are intentionally
 * omitted — a continuous gap is not meaningful for them.
 */
const NEAR_MISS_EXTRACTORS = {
  'se-01': (ticker, params, ctx) => {
    const actual = ctx?.technicals?.[ticker]?.rsiValue;
    const threshold = params?.upper;
    if (typeof actual !== 'number' || typeof threshold !== 'number') return null;
    return { actual, threshold, label: `RSI ${actual.toFixed(1)} vs threshold ${threshold}` };
  },
  'se-02': (ticker, params, ctx) => {
    const actual = ctx?.technicals?.[ticker]?.rvol;
    const threshold = params?.multiplier;
    if (typeof actual !== 'number' || typeof threshold !== 'number') return null;
    return { actual, threshold, label: `RVOL ${actual.toFixed(2)}x vs threshold ${threshold}x` };
  },
  'se-03': (ticker, params, ctx) => {
    const smaKey = `sma${params?.period}`;
    const sma = ctx?.technicals?.[ticker]?.[smaKey];
    const price = ctx?.marketData?.[ticker]?.closePrice;
    if (typeof sma !== 'number' || typeof price !== 'number') return null;
    return { actual: price, threshold: sma, label: `Price $${price.toFixed(2)} vs ${params.period}d SMA $${sma.toFixed(2)}` };
  },
  'se-05': (ticker, params, ctx) => {
    const actual = ctx?.fundamentals?.[ticker]?.overallScore;
    const threshold = params?.minScore;
    if (typeof actual !== 'number' || typeof threshold !== 'number') return null;
    return { actual, threshold, label: `Fundamental ${actual} vs min ${threshold}` };
  },
  'se-06': (ticker, params, ctx) => {
    const history = ctx?.marketData?.[ticker]?.priceHistory;
    if (!Array.isArray(history) || history.length < (params?.period || 0) + 1) return null;
    const current = history[history.length - 1];
    const past = history[history.length - 1 - params.period];
    if (typeof current !== 'number' || typeof past !== 'number' || past === 0) return null;
    const actual = ((current - past) / past) * 100;
    const threshold = params?.pct;
    if (typeof threshold !== 'number') return null;
    return { actual, threshold, label: `${params.period}d momentum ${actual.toFixed(1)}% vs ${threshold}%` };
  },
  'se-07': (ticker, params, ctx) => {
    const sector = ctx?.fundamentals?.[ticker]?.sector;
    if (!sector) return null;
    const actual = ctx?.portfolio?.sectorWeights?.[sector] || 0;
    const threshold = params?.maxPct;
    if (typeof threshold !== 'number') return null;
    return { actual, threshold, label: `${sector} weight ${actual.toFixed(1)}% vs cap ${threshold}%` };
  },
};

// ─── Main Export: findNearMissCandidates ─────────────────────────────

/**
 * Finds stocks that narrowly missed the entry filter chain.
 *
 * Runs entry rules against the universe, captures stocks that failed exactly
 * one rule, then computes how close that single failure was. Returns the top
 * 10 sorted by gap ascending (narrowest miss first). Discrete rules (se-04,
 * se-08) are skipped — continuous gaps aren't defined for them.
 *
 * @param {Object} ctx - A context object with portfolio, marketData, technicals,
 *                       fundamentals, institutional, and earnings fields.
 * @param {Object[]} activeRules - User's equipped rules { ruleId, params, enabled }.
 * @returns {Array<{ ticker, blockingRule, currentValue, threshold, gap, label }>}
 */
export function findNearMissCandidates(ctx, activeRules) {
  if (!ctx || !ctx.marketData || !ctx.portfolio) return [];

  const entryRules = (Array.isArray(activeRules) ? activeRules : [])
    .filter(r => r && r.enabled !== false && getRule(r.ruleId)?.phase === 'entry');
  if (entryRules.length === 0) return [];

  const heldTickers = new Set(Object.keys(ctx.portfolio.positions || {}));
  const universe = Object.keys(ctx.marketData).filter(t => t !== 'SPY' && !heldTickers.has(t));

  const nearMisses = [];

  for (const ticker of universe) {
    let failed = 0;
    let firstFailedRule = null;

    for (const rule of entryRules) {
      const result = evaluateRule(rule.ruleId, ticker, rule.params, ctx);
      if (!result?.pass) {
        failed += 1;
        if (failed === 1) firstFailedRule = rule;
        if (failed > 1) break;
      }
    }

    if (failed !== 1 || !firstFailedRule) continue;

    const extractor = NEAR_MISS_EXTRACTORS[firstFailedRule.ruleId];
    if (!extractor) continue;

    const extracted = extractor(ticker, firstFailedRule.params, ctx);
    if (!extracted) continue;

    const { actual, threshold, label } = extracted;
    if (threshold === 0) continue;

    const gap = Math.abs(actual - threshold) / Math.abs(threshold);
    if (gap >= 0.15) continue;

    nearMisses.push({
      ticker,
      blockingRule: firstFailedRule.ruleId,
      currentValue: actual,
      threshold,
      gap,
      label,
    });
  }

  nearMisses.sort((a, b) => a.gap - b.gap);
  return nearMisses.slice(0, 10);
}

// ─── Main Export: Request Builder ────────────────────────────────────

/**
 * Builds the Anthropic API request body for pit stop debrief generation.
 *
 * @param {Object} entry - seasonEntry document (portfolio, seasonState, ...).
 * @param {Object} seasonDoc - season document (macroEvents, universe, ...).
 * @param {Object[]} weekDailyLogs - dailyLog docs for the current week.
 * @param {Object} sharedMarketData - market data blob (marketData, technicals, etc.).
 * @param {Object[]} activeRules - equipped rules with current param values.
 * @param {Object} [options] - additional context.
 * @param {boolean} [options.isSoloFinalWeek=false] - Phase 3: when true,
 *   the debrief is an end-of-session summary for a solo run. The user
 *   message is preceded by a context note so Sonnet reframes the
 *   "next week prep" act as a closing reflection over the full session.
 * @param {number} [options.durationWeeks] - total duration in weeks,
 *   used to swap the hardcoded "4-week" framing in the system prompt.
 * @returns {Object} Request body: { model, max_tokens, temperature, system, messages, tools }.
 */
export function buildDebriefRequest(entry, seasonDoc, weekDailyLogs, sharedMarketData, activeRules, options = {}) {
  const { isSoloFinalWeek = false, durationWeeks } = options;

  // Build a lightweight ctx-like object so findNearMissCandidates and the rule
  // registry evaluators (which expect a ctx shape) can run against the inputs.
  const ctx = {
    portfolio: entry?.portfolio || { positions: {}, sectorWeights: {} },
    marketData: sharedMarketData?.marketData || {},
    technicals: sharedMarketData?.technicals || {},
    fundamentals: sharedMarketData?.fundamentals || {},
    institutional: sharedMarketData?.institutional || {},
    earnings: sharedMarketData?.earnings || {},
  };

  const nearMisses = findNearMissCandidates(ctx, activeRules).slice(0, 5);

  return {
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    temperature: 0.7,
    // Sonnet 4.6 defaults to high effort; pin to low + thinking disabled to
    // preserve the prior Sonnet-4 (no-thinking) latency profile.
    thinking: { type: 'disabled' },
    output_config: { effort: 'low' },
    system: buildDebriefSystemPrompt({ durationWeeks, isSoloFinalWeek }),
    messages: [
      {
        role: 'user',
        content: buildDebriefUserMessage(entry, seasonDoc, weekDailyLogs, activeRules, nearMisses, { isSoloFinalWeek, durationWeeks }),
      },
    ],
    tools: [PIT_STOP_DEBRIEF_TOOL],
  };
}

// System-prompt builder that adapts framing to the caller's session shape.
// Without options, it matches the legacy 4-week tournament framing verbatim
// so existing tournament callers see no behavior change.
function buildDebriefSystemPrompt({ durationWeeks, isSoloFinalWeek }) {
  const weeksLabel = typeof durationWeeks === 'number' && durationWeeks > 0
    ? `${durationWeeks}-week`
    : '4-week';
  const baseHeader = `You are a trading partner delivering a weekend pit stop debrief for a ${weeksLabel} competitive
stock trading session. The user's algorithm has been running autonomously all week.
This is your chance to review what happened and prepare for next week.`;

  const finalHeader = `You are a trading partner delivering the END-OF-SESSION debrief for a ${weeksLabel} solo
backtest. The user's algorithm has been running autonomously across the full session. This is
the closing review — there is no "next week," so your job is to summarize the entire run and
pull out lessons the user can take into their next strategy.`;

  const header = isSoloFinalWeek ? finalHeader : baseHeader;

  // Reuse the two-act scaffolding verbatim; for final-week solo, Act 2's
  // "next week prep" is reinterpreted as "lessons for the next session."
  return `${header}

Your debrief has TWO ACTS:

ACT 1 — THE REVIEW
- Start with a 2-3 sentence narrative summary${isSoloFinalWeek ? ' of the full session' : ' of the week'}. Was it good, bad, or mixed?
  Reference specific numbers (alpha change, key trades).
- List highlights: 1-3 wins and 1-3 losses. Each with ticker, what happened, and which
  rules were involved.
- Rule insights: For the 2-3 most impactful rules${isSoloFinalWeek ? ' across the session' : ' this week'}, provide specific observations.
  Did a stop-loss fire correctly? Did an entry rule block something it shouldn't have?
  Give concrete parameter change suggestions where warranted.
- Upcoming events: What macro events (Fed, CPI, earnings) are coming ${isSoloFinalWeek ? 'soon' : 'next week'} and how
  they might affect the portfolio.
- Suggested parameter changes: 0-3 specific changes with ruleId, param name, current
  value, suggested value, and rationale. Be concrete — "widen trailing stop from 10%
  to 12% because X" not "consider adjusting risk parameters."

ACT 2 — ${isSoloFinalWeek ? 'NEXT-SESSION LESSONS' : 'NEXT WEEK PREP'}
- Lessons into action: What did we learn ${isSoloFinalWeek ? 'across this session' : 'this week'} that changes how we approach ${isSoloFinalWeek ? 'the next one' : 'next week'}?
- Momentum watchlist: Stocks near our entry thresholds (from the near-miss data).
  These are "one good day away" from qualifying.
- Thematic opportunities: Sector rotations, macro themes, or portfolio gaps to exploit.
- Risk radar: What could hurt us ${isSoloFinalWeek ? 'in the next session' : 'next week'}? Specific threats.
- Shortlist candidates: Suggest 3-5 stocks ranked by your conviction. Include rationale
  and which theme/opportunity each connects to.

TONE: Warm, direct, collaborative. Use "we" and "our." Have opinions — don't hedge.
Reference specific data. If a rule is hurting performance, say so directly.

You MUST use the generate_pit_stop_debrief tool to return your response.`;
}

// ─── Main Export: Response Parser ────────────────────────────────────

/**
 * Parses the Anthropic API response into a structured debrief object.
 * Returns a safe empty shape if the tool use block is missing.
 */
export function parseDebriefResponse(response) {
  const content = response && Array.isArray(response.content) ? response.content : [];
  const toolUse = content.find(c => c && c.type === 'tool_use' && c.name === 'generate_pit_stop_debrief');
  if (!toolUse || !toolUse.input) {
    return {
      summary: '',
      highlights: [],
      ruleInsights: [],
      upcomingEvents: [],
      suggestedChanges: [],
      nextWeekPrep: {
        lessonsIntoAction: [],
        momentumWatchlist: [],
        thematicOpportunities: [],
        riskRadar: [],
        shortlistCandidates: [],
      },
    };
  }
  const input = toolUse.input;
  return {
    summary: input.summary || '',
    highlights: Array.isArray(input.highlights) ? input.highlights : [],
    ruleInsights: Array.isArray(input.ruleInsights) ? input.ruleInsights : [],
    upcomingEvents: Array.isArray(input.upcomingEvents) ? input.upcomingEvents : [],
    suggestedChanges: Array.isArray(input.suggestedChanges) ? input.suggestedChanges : [],
    nextWeekPrep: {
      lessonsIntoAction: Array.isArray(input.nextWeekPrep?.lessonsIntoAction) ? input.nextWeekPrep.lessonsIntoAction : [],
      momentumWatchlist: Array.isArray(input.nextWeekPrep?.momentumWatchlist) ? input.nextWeekPrep.momentumWatchlist : [],
      thematicOpportunities: Array.isArray(input.nextWeekPrep?.thematicOpportunities) ? input.nextWeekPrep.thematicOpportunities : [],
      riskRadar: Array.isArray(input.nextWeekPrep?.riskRadar) ? input.nextWeekPrep.riskRadar : [],
      shortlistCandidates: Array.isArray(input.nextWeekPrep?.shortlistCandidates) ? input.nextWeekPrep.shortlistCandidates : [],
    },
  };
}

// ─── Internal: User Message Assembly ─────────────────────────────────

/**
 * Assembles the user message body. Target ≤ ~6400 chars (~1600 tokens).
 * Keeps data dense via CSV and single-line summaries.
 */
function buildDebriefUserMessage(entry, seasonDoc, weekDailyLogs, activeRules, nearMisses, options = {}) {
  const { isSoloFinalWeek = false, durationWeeks } = options;
  const logs = Array.isArray(weekDailyLogs) ? weekDailyLogs : [];
  const state = entry?.seasonState || {};
  const portfolio = entry?.portfolio || {};
  const lines = [];

  // 1. Season overview — duration-aware framing so the overview line
  //    matches solo sessions' variable length. Default falls back to the
  //    legacy "4" literal for tournaments with no durationWeeks supplied.
  const totalWeeksLabel = typeof durationWeeks === 'number' && durationWeeks > 0 ? durationWeeks : 4;
  const currentWeek = state.currentWeek || state.currentTradingDay != null ? state.currentWeek ?? '?' : '?';
  const alpha = typeof state.alphaVsSpy === 'number' ? state.alphaVsSpy.toFixed(2) : '0.00';
  const totalRet = typeof portfolio.totalReturn === 'number' ? portfolio.totalReturn.toFixed(2) : '0.00';
  const spyRet = typeof state.spyReturn === 'number' ? state.spyReturn.toFixed(2) : '?';
  const rank = state.currentRank != null ? `, Rank: ${state.currentRank}` : '';
  const overviewPrefix = isSoloFinalWeek
    ? `END-OF-SESSION OVERVIEW (${totalWeeksLabel}-week solo)`
    : `SESSION OVERVIEW: Week ${currentWeek} of ${totalWeeksLabel}`;
  lines.push(`${overviewPrefix}, Alpha ${alpha}%, Total ${totalRet}%, SPY ${spyRet}%${rank}`);
  lines.push('');

  // 2. Daily log summary (one line per day)
  lines.push('DAILY ACTIVITY:');
  if (logs.length === 0) {
    lines.push('(no logs for this week)');
  } else {
    for (const log of logs) {
      lines.push(summarizeDailyLog(log));
    }
  }
  lines.push('');

  // 3. Week summary stats
  const stats = computeWeekStats(logs);
  lines.push(
    `WEEK STATS: ${stats.totalTrades} trades, ${stats.stopsTriggered} stops, ${stats.targetsHit} targets, ${stats.entriesMade} entries, ${stats.rulesEvaluated} rule evals`,
  );
  lines.push('');

  // 4. Rule activity top 10
  const ruleActivity = computeRuleActivity(logs);
  lines.push('RULE ACTIVITY (top 10 by citation count):');
  if (ruleActivity.length === 0) {
    lines.push('(none)');
  } else {
    for (const row of ruleActivity) {
      lines.push(`- ${row.ruleId}: cited ${row.count}x (${row.outcome})`);
    }
  }
  lines.push('');

  // 5. Active rules compact
  lines.push('ACTIVE RULES:');
  const ruleSummary = (Array.isArray(activeRules) ? activeRules : [])
    .filter(r => r && r.enabled !== false)
    .map(r => `${r.ruleId}:${formatParams(r.params)}`)
    .join(', ');
  lines.push(ruleSummary || '(none)');
  lines.push('');

  // 6. Portfolio CSV
  lines.push('PORTFOLIO:');
  lines.push('TICKER,SECTOR,WEIGHT%,RETURN%,DAYS_HELD');
  const positions = portfolio.positions || {};
  const posEntries = Object.entries(positions);
  if (posEntries.length === 0) {
    lines.push('(empty)');
  } else {
    for (const [ticker, p] of posEntries) {
      const sector = p?.sector || '?';
      const weight = typeof p?.currentWeight === 'number' ? p.currentWeight.toFixed(1) : '0.0';
      const ret = typeof p?.returnSinceEntry === 'number' ? p.returnSinceEntry.toFixed(1) : '0.0';
      const days = typeof p?.daysSinceEntry === 'number' ? p.daysSinceEntry : '?';
      lines.push(`${ticker},${sector},${weight},${ret},${days}`);
    }
  }
  lines.push('');

  // 7. Upcoming events (next 2 weeks)
  lines.push('UPCOMING MACRO EVENTS (next 2 weeks):');
  const events = collectSeasonUpcomingEvents(seasonDoc, state.currentTradingDay);
  if (events.length === 0) {
    lines.push('(none)');
  } else {
    for (const e of events) {
      lines.push(`- ${e.type || 'event'} on ${e.date || '?'}`);
    }
  }
  lines.push('');

  // 8. Near-miss candidates
  lines.push('NEAR-MISS CANDIDATES (top 5):');
  if (nearMisses.length === 0) {
    lines.push('(none)');
  } else {
    for (const nm of nearMisses) {
      lines.push(`- ${nm.ticker}: blocked by ${nm.blockingRule} — ${nm.label} (gap ${(nm.gap * 100).toFixed(1)}%)`);
    }
  }
  lines.push('');

  // 9. Weekly sector performance
  lines.push('WEEKLY SECTOR RETURNS:');
  const weekSectorReturns = state.weeklySectorReturns?.[currentWeek] || {};
  const sectorLines = Object.entries(weekSectorReturns)
    .filter(([, v]) => typeof v === 'number')
    .sort((a, b) => b[1] - a[1])
    .map(([s, v]) => `${s}: ${v.toFixed(1)}%`);
  lines.push(sectorLines.length ? sectorLines.join(', ') : '(none)');
  lines.push('');

  // 10. Sector gaps (0% weight)
  const allSectors = collectKnownSectors(seasonDoc, positions);
  const portfolioSectors = new Set(Object.keys(portfolio.sectorWeights || {}).filter(s => (portfolio.sectorWeights[s] || 0) > 0));
  const gaps = allSectors.filter(s => !portfolioSectors.has(s));
  lines.push(`SECTOR GAPS: ${gaps.length ? gaps.join(', ') : '(none — all represented)'}`);
  lines.push('');

  // 11. Stocks exited this week
  lines.push('EXITED THIS WEEK:');
  const exited = collectExitedTickers(logs);
  if (exited.length === 0) {
    lines.push('(none)');
  } else {
    for (const x of exited) {
      lines.push(`- ${x.ticker}: ${x.reason}`);
    }
  }

  return lines.join('\n');
}

// ─── Internal: User Message Helpers ──────────────────────────────────

function summarizeDailyLog(log) {
  if (!log) return `Day ?: (empty)`;
  const day = log.day ?? '?';
  const trades = Array.isArray(log.trades) ? log.trades : [];
  const buys = trades.filter(t => t?.type === 'BUY').map(t => t.ticker).join('/') || '—';
  const sells = trades
    .filter(t => t?.type === 'SELL')
    .map(t => t.ticker)
    .join('/') || '—';
  const entryScan = log.entryScan || {};
  const blocked = entryScan.blocked ? ` entries blocked (${entryScan.blockReason || 'unknown'})` : '';
  const triggers = collectLogTriggers(log);
  const trigStr = triggers.length ? ` [${triggers.slice(0, 3).join(', ')}]` : '';
  return `Day ${day}: BUY ${buys}, SELL ${sells}${blocked}${trigStr}`;
}

function collectLogTriggers(log) {
  const triggers = [];
  const exits = Array.isArray(log.exitEvaluations) ? log.exitEvaluations : [];
  for (const ev of exits) {
    if (ev?.finalDecision === 'SELL' && ev.trigger) triggers.push(ev.trigger);
  }
  const mods = Array.isArray(log.strategyMods) ? log.strategyMods : [];
  for (const m of mods) {
    if (m?.ruleId) triggers.push(m.ruleId);
  }
  return triggers;
}

function computeWeekStats(logs) {
  const stats = { totalTrades: 0, stopsTriggered: 0, targetsHit: 0, entriesMade: 0, rulesEvaluated: 0 };
  for (const log of logs) {
    if (!log) continue;
    const trades = Array.isArray(log.trades) ? log.trades : [];
    stats.totalTrades += trades.length;
    stats.entriesMade += trades.filter(t => t?.type === 'BUY').length;

    const exits = Array.isArray(log.exitEvaluations) ? log.exitEvaluations : [];
    for (const ev of exits) {
      if (ev?.finalDecision === 'SELL') {
        if (typeof ev.trigger === 'string' && ev.trigger.startsWith('sx-01')) stats.stopsTriggered += 1;
        if (typeof ev.trigger === 'string' && (ev.trigger.startsWith('sx-04') || ev.trigger.startsWith('sx-05'))) stats.targetsHit += 1;
      }
      if (Array.isArray(ev?.results)) stats.rulesEvaluated += ev.results.length;
    }
    const entryScan = log.entryScan || {};
    const filterResults = Array.isArray(entryScan.filterResults) ? entryScan.filterResults : [];
    for (const fr of filterResults) {
      if (Array.isArray(fr?.results)) stats.rulesEvaluated += fr.results.length;
    }
  }
  return stats;
}

function computeRuleActivity(logs) {
  const counts = {};
  const outcomes = {};
  const bump = (ruleId, outcome) => {
    if (!ruleId) return;
    counts[ruleId] = (counts[ruleId] || 0) + 1;
    outcomes[ruleId] = outcomes[ruleId] || outcome;
  };

  for (const log of logs) {
    if (!log) continue;
    const exits = Array.isArray(log.exitEvaluations) ? log.exitEvaluations : [];
    for (const ev of exits) {
      const results = Array.isArray(ev?.results) ? ev.results : [];
      for (const r of results) bump(r?.ruleId, r?.action === 'SELL' ? 'sells' : 'exits eval');
    }
    const entryScan = log.entryScan || {};
    const filterResults = Array.isArray(entryScan.filterResults) ? entryScan.filterResults : [];
    for (const fr of filterResults) {
      const results = Array.isArray(fr?.results) ? fr.results : [];
      for (const r of results) bump(r?.ruleId, r?.pass === false ? 'blocks' : 'entry pass');
    }
    const mods = Array.isArray(log.strategyMods) ? log.strategyMods : [];
    for (const m of mods) bump(m?.ruleId, 'strategy mod');
  }

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([ruleId, count]) => ({ ruleId, count, outcome: outcomes[ruleId] || '' }));
}

function formatParams(params) {
  if (!params || typeof params !== 'object') return '{}';
  const parts = Object.entries(params).map(([k, v]) => `${k}:${v}`);
  return `{${parts.join(',')}}`;
}

function collectSeasonUpcomingEvents(seasonDoc, currentTradingDay) {
  const events = Array.isArray(seasonDoc?.macroEvents) ? seasonDoc.macroEvents : [];
  const day = typeof currentTradingDay === 'number' ? currentTradingDay : 0;
  return events
    .filter(e => {
      if (!e) return false;
      if (typeof e.tradingDay === 'number') return e.tradingDay >= day && e.tradingDay <= day + 10;
      return true;
    })
    .slice(0, 10);
}

function collectKnownSectors(seasonDoc, positions) {
  const seen = new Set();
  for (const p of Object.values(positions || {})) {
    if (p?.sector) seen.add(p.sector);
  }
  if (Array.isArray(seasonDoc?.knownSectors)) {
    for (const s of seasonDoc.knownSectors) seen.add(s);
  }
  // Fallback list of common sectors if seasonDoc doesn't supply one
  if (seen.size === 0) {
    return ['Technology', 'Healthcare', 'Financials', 'Consumer Discretionary', 'Energy', 'Industrials'];
  }
  return Array.from(seen);
}

function collectExitedTickers(logs) {
  const seen = new Map();
  for (const log of logs) {
    const trades = Array.isArray(log?.trades) ? log.trades : [];
    for (const t of trades) {
      if (t?.type !== 'SELL' || !t.ticker) continue;
      if (!seen.has(t.ticker)) seen.set(t.ticker, t.reason || 'sold');
    }
  }
  return Array.from(seen.entries()).map(([ticker, reason]) => ({ ticker, reason }));
}
