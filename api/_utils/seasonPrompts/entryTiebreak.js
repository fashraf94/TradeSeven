/**
 * Season Mode — Entry Tiebreak Prompt Builder
 *
 * When the daily entry scan produces 2+ candidates scoring within
 * SEASON_SCORING.TIE_BREAK_THRESHOLD (5%) of each other, Haiku picks
 * between them using strategy, portfolio composition, and macro context.
 *
 * Pure request-body builder + response parser. No SDK import, no network.
 * The caller (daily evaluation cron) wires the returned request body into
 * its Anthropic client and passes the response back to the parser.
 */

import { getRule } from '../seasonRuleRegistry.js';

// ─── System Prompt (static, cacheable) ───────────────────────────────

const ENTRY_TIEBREAK_SYSTEM_PROMPT = `You are a portfolio construction advisor for a competitive 4-week stock trading season.
The user's algorithm has narrowed entry candidates to a shortlist, but the top candidates
scored within 5% of each other. Your job is to break the tie.

Evaluate candidates using these criteria (in priority order):
1. COMPLEMENTARITY — Does this stock fill a gap in the current portfolio? Favor sectors
   or themes with zero or low exposure over doubling down on existing holdings.
2. CATALYST TIMING — Are there upcoming events (earnings, Fed meetings, CPI reports)
   that favor one candidate over another this week?
3. STRATEGY ALIGNMENT — Which candidate best fits the user's overall algorithm profile?
   A momentum-heavy ruleset should favor momentum stocks. A fundamental-heavy ruleset
   should favor quality names.
4. SEASON CONTEXT — Consider the week number and benchmark position. Trailing the S&P
   in Week 3 favors higher-beta names. Leading in Week 4 favors lower-risk names.

You MUST use the select_entry_candidates tool to return your decision.
Select 1 or more candidates. Allocate the available cash across selections.
Provide a 1-sentence rationale for each selection AND each rejection.`;

// ─── Tool Schema ─────────────────────────────────────────────────────

const ENTRY_TIEBREAK_TOOL = {
  name: 'select_entry_candidates',
  description: 'Select entry candidates and allocate cash across them',
  input_schema: {
    type: 'object',
    properties: {
      selections: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            ticker: { type: 'string', description: 'Stock ticker symbol' },
            allocation_pct: { type: 'number', description: 'Percentage of available cash to allocate (0-100)' },
            rationale: { type: 'string', description: 'One sentence explaining why this candidate was selected' },
          },
          required: ['ticker', 'allocation_pct', 'rationale'],
        },
      },
      rejected: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            ticker: { type: 'string' },
            reason: { type: 'string', description: 'One sentence explaining why this candidate was not selected' },
          },
          required: ['ticker', 'reason'],
        },
      },
    },
    required: ['selections', 'rejected'],
  },
};

// ─── Main Export: Request Builder ────────────────────────────────────

/**
 * Builds the Anthropic API request body for entry tie-breaking.
 *
 * @param {Object} ctx - EvaluationContext with portfolio, technicals, fundamentals,
 *                       marketData, season, macro fields.
 * @param {Object[]} candidates - Tie-break candidates from pipeline, each
 *                                { ticker, score, results, softPassed, softTotal }.
 * @param {Object[]} activeRules - User's equipped rules: { ruleId, params, enabled }.
 * @param {number} cashAvailable - Cash available for deployment.
 * @returns {Object} Request body: { model, max_tokens, temperature, system, messages, tools }.
 */
export function buildEntryTiebreakRequest(ctx, candidates, activeRules, cashAvailable) {
  return {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1000,
    temperature: 0.6,
    system: ENTRY_TIEBREAK_SYSTEM_PROMPT,
    messages: [
      { role: 'user', content: buildUserMessage(ctx, candidates, activeRules, cashAvailable) },
    ],
    tools: [ENTRY_TIEBREAK_TOOL],
  };
}

// ─── Main Export: Response Parser ────────────────────────────────────

/**
 * Parses the Anthropic API response and extracts the tool-use input.
 * Returns a safe empty shape when the response is missing or malformed.
 *
 * @param {Object} response - Anthropic messages.create() response.
 * @returns {{ selections: Object[], rejected: Object[] }}
 */
export function parseEntryTiebreakResponse(response) {
  const content = response && Array.isArray(response.content) ? response.content : [];
  const toolUse = content.find(c => c && c.type === 'tool_use' && c.name === 'select_entry_candidates');
  if (!toolUse || !toolUse.input) {
    return { selections: [], rejected: [] };
  }
  const input = toolUse.input;
  const selections = Array.isArray(input.selections)
    ? input.selections.map(s => ({
        ticker: s.ticker,
        allocationPct: s.allocation_pct,
        rationale: s.rationale,
      }))
    : [];
  const rejected = Array.isArray(input.rejected)
    ? input.rejected.map(r => ({ ticker: r.ticker, reason: r.reason }))
    : [];
  return { selections, rejected };
}

// ─── Internal Helpers ────────────────────────────────────────────────

/**
 * Assembles the compact user-message body. Target ≤ ~2400 chars (~600 tokens).
 */
function buildUserMessage(ctx, candidates, activeRules, cashAvailable) {
  const lines = [];

  // 1. Season state
  const alpha = ctx?.season?.alphaVsSpy;
  const alphaStr = typeof alpha === 'number' ? alpha.toFixed(2) : '0.00';
  lines.push(`Week ${ctx?.currentWeek ?? '?'} of ${ctx?.totalWeeks ?? '?'}, Alpha: ${alphaStr}%`);
  lines.push('');

  // 2. Current portfolio CSV
  lines.push('CURRENT PORTFOLIO:');
  lines.push('TICKER,SECTOR,WEIGHT%,RETURN%');
  const positions = ctx?.portfolio?.positions || {};
  const posEntries = Object.entries(positions);
  if (posEntries.length === 0) {
    lines.push('(none)');
  } else {
    for (const [ticker, p] of posEntries) {
      const sector = p?.sector || '?';
      const weight = typeof p?.currentWeight === 'number' ? p.currentWeight.toFixed(1) : '0.0';
      const ret = typeof p?.returnSinceEntry === 'number' ? p.returnSinceEntry.toFixed(1) : '0.0';
      lines.push(`${ticker},${sector},${weight},${ret}`);
    }
  }
  lines.push('');

  // 3. Sector exposure
  const sectorWeights = ctx?.portfolio?.sectorWeights || {};
  const sectorParts = Object.entries(sectorWeights)
    .filter(([, w]) => typeof w === 'number' && w > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([s, w]) => `${s}: ${w.toFixed(0)}%`);
  lines.push(`SECTOR EXPOSURE: ${sectorParts.length ? sectorParts.join(', ') : '(none)'}`);
  lines.push('');

  // 4. Candidates CSV
  lines.push('TIE-BREAK CANDIDATES:');
  lines.push('TICKER,SCORE,SECTOR,RSI,MOMENTUM%,BETA,FUND_SCORE,SHORTLIST');
  const shortlist = new Set(ctx?.season?.userShortlist || []);
  for (const c of candidates || []) {
    const ticker = c?.ticker;
    if (!ticker) continue;
    const score = typeof c?.score === 'number' ? c.score.toFixed(1) : '?';
    const fund = ctx?.fundamentals?.[ticker] || {};
    const tech = ctx?.technicals?.[ticker] || {};
    const sector = fund.sector || '?';
    const rsi = typeof tech.rsiValue === 'number' ? tech.rsiValue.toFixed(0) : '?';
    const beta = typeof fund.beta === 'number' ? fund.beta.toFixed(2) : '?';
    const fundScore = typeof fund.overallScore === 'number' ? fund.overallScore.toFixed(0) : '?';
    const momentum = compute5DayMomentum(ctx?.marketData?.[ticker]?.priceHistory);
    const momStr = momentum != null ? momentum.toFixed(1) : '?';
    const sl = shortlist.has(ticker) ? 'Y' : 'N';
    lines.push(`${ticker},${score},${sector},${rsi},${momStr},${beta},${fundScore},${sl}`);
  }
  lines.push('');

  // 5. Cash
  lines.push(`$${Number(cashAvailable || 0).toFixed(0)} available for deployment`);
  lines.push('');

  // 6. Upcoming macro events
  const events = collectUpcomingEvents(ctx, 5);
  lines.push('UPCOMING MACRO EVENTS (next 5 trading days):');
  if (events.length === 0) {
    lines.push('(none)');
  } else {
    for (const e of events) {
      lines.push(`- ${e.type || 'event'} in ${e.tradingDaysUntil ?? '?'} days`);
    }
  }
  lines.push('');

  // 7. Algorithm profile
  lines.push(`ALGORITHM PROFILE: ${buildAlgorithmProfile(activeRules)}`);

  return lines.join('\n');
}

/**
 * Computes a simple 5-day price momentum percentage from a priceHistory array.
 * Returns null if there aren't enough data points.
 */
function compute5DayMomentum(priceHistory) {
  if (!Array.isArray(priceHistory) || priceHistory.length < 6) return null;
  const current = priceHistory[priceHistory.length - 1];
  const past = priceHistory[priceHistory.length - 6];
  if (typeof current !== 'number' || typeof past !== 'number' || past === 0) return null;
  return ((current - past) / past) * 100;
}

/**
 * Returns upcoming macro events from ctx.macro. Falls back to nextEvent if
 * upcomingEvents is absent.
 */
function collectUpcomingEvents(ctx, maxDays) {
  const macro = ctx?.macro || {};
  const list = Array.isArray(macro.upcomingEvents) ? macro.upcomingEvents : [];
  const filtered = list.filter(
    e => e && (typeof e.tradingDaysUntil !== 'number' || e.tradingDaysUntil <= maxDays),
  );
  if (filtered.length > 0) return filtered.slice(0, 5);
  if (macro.nextEvent && (typeof macro.nextEvent.tradingDaysUntil !== 'number' || macro.nextEvent.tradingDaysUntil <= maxDays)) {
    return [macro.nextEvent];
  }
  return [];
}

/**
 * Counts rules by phase using the registry + resolves a trading-style label.
 * Returns a compact summary string.
 */
function buildAlgorithmProfile(activeRules) {
  const counts = { entry: 0, exit: 0, rebalance: 0, strategy: 0 };
  const rules = Array.isArray(activeRules) ? activeRules : [];
  for (const r of rules) {
    if (!r || r.enabled === false) continue;
    const reg = getRule(r.ruleId);
    const phase = reg?.phase;
    if (phase && counts[phase] != null) counts[phase] += 1;
  }
  return `Entry: ${counts.entry}, Exit: ${counts.exit}, Rebalance: ${counts.rebalance}, Strategy: ${counts.strategy}`;
}
