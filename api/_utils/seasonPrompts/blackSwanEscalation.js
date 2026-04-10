/**
 * Season Mode — Black Swan Escalation Prompt Builder
 *
 * When the deterministic evaluation engine detects extraordinary market
 * conditions (overnight position gap, sector collapse, or S&P crash), it
 * escalates to Haiku for an emergency risk assessment before running the
 * normal exit/entry/rebalance pipeline.
 *
 * Exports:
 *   - detectBlackSwanTriggers(ctx, previousSnapshot): pure trigger detector
 *   - buildBlackSwanRequest(ctx, triggers, activeRules): Anthropic request body
 *   - parseBlackSwanResponse(response): safe response parser
 *
 * Pure functions. No SDK import, no network, no Firestore access.
 */

import { BLACK_SWAN } from '../seasonConfig.js';

// ─── System Prompt (static, cacheable) ───────────────────────────────

const BLACK_SWAN_SYSTEM_PROMPT = `You are an emergency risk advisor for a competitive 4-week stock trading season.
The deterministic evaluation engine has detected extraordinary market conditions
and is escalating to you for a risk assessment.

Use this 4-point framework:
1. ASSESS SEVERITY — Is this a temporary shock (contained) or a systemic event
   (significant/severe)? Temporary = one stock, one day. Systemic = broad market,
   likely to continue.
2. PROTECT CAPITAL — Survival over profit. In a 4-week season, a -20% drawdown
   is nearly unrecoverable.
3. RESPECT THE ALGORITHM — Only override the user's rules where extraordinary
   conditions make normal evaluation dangerous. The user built these rules for
   a reason. Override sparingly and explain why.
4. CONSIDER SEASON POSITION — Leading = preserve the lead, be cautious. Trailing =
   this might be an opportunity, but only with extreme caution.

You MUST use the submit_emergency_assessment tool.
Be decisive. Short assessment (2-3 sentences). Concrete actions.`;

// ─── Tool Schema ─────────────────────────────────────────────────────

const BLACK_SWAN_TOOL = {
  name: 'submit_emergency_assessment',
  description: 'Submit emergency risk assessment with recommended actions',
  input_schema: {
    type: 'object',
    properties: {
      severity: { type: 'string', enum: ['contained', 'significant', 'severe'] },
      assessment: { type: 'string', description: '2-3 sentence assessment of the situation' },
      actions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['EMERGENCY_SELL', 'REDUCE_POSITION', 'RAISE_CASH', 'HOLD_ALL', 'TIGHTEN_STOPS', 'NO_NEW_ENTRIES'],
            },
            ticker: { type: 'string', description: 'Specific ticker if applicable, or null for portfolio-wide actions' },
            detail: { type: 'string' },
            rationale: { type: 'string' },
          },
          required: ['action', 'detail', 'rationale'],
        },
      },
      overridden_rules: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            ruleId: { type: 'string' },
            reason: { type: 'string', description: 'Why this rule is being overridden for today' },
          },
          required: ['ruleId', 'reason'],
        },
      },
      resume_normal: {
        type: 'boolean',
        description: 'true = resume deterministic engine tomorrow, false = keep monitoring',
      },
    },
    required: ['severity', 'assessment', 'actions', 'resume_normal'],
  },
};

// ─── Main Export: Trigger Detection ──────────────────────────────────

/**
 * Detects black swan conditions by comparing today's market data against
 * the previous day's snapshot. Returns an array of trigger objects —
 * empty means no escalation is needed.
 *
 * Three conditions are checked:
 *   1. Overnight position gap: |return| > BLACK_SWAN.POSITION_GAP_PCT for
 *      any held ticker.
 *   2. Sector collapse: average daily return of held positions in a sector
 *      is below BLACK_SWAN.SECTOR_COLLAPSE_PCT.
 *   3. SPY crash: today's SPY daily return is below BLACK_SWAN.SPY_CRASH_PCT.
 *
 * @param {Object} ctx - EvaluationContext with portfolio, marketData, benchmark.
 * @param {Object} previousSnapshot - Yesterday's snapshot; must contain
 *                                    positions: { [ticker]: { currentPrice } }.
 * @returns {Array<{ type: string, detail: string, [key: string]: any }>}
 */
export function detectBlackSwanTriggers(ctx, previousSnapshot) {
  const triggers = [];
  if (!ctx) return triggers;

  const positions = ctx.portfolio?.positions || {};
  const prevPositions = previousSnapshot?.positions || {};
  const marketData = ctx.marketData || {};

  // 1. Position gap > BLACK_SWAN.POSITION_GAP_PCT overnight
  for (const [ticker, pos] of Object.entries(positions)) {
    if (!pos) continue;
    const prevPrice = prevPositions[ticker]?.currentPrice;
    const currPrice = marketData[ticker]?.closePrice;
    if (typeof prevPrice !== 'number' || typeof currPrice !== 'number' || prevPrice === 0) continue;
    const gapPct = ((currPrice - prevPrice) / prevPrice) * 100;
    if (Math.abs(gapPct) > BLACK_SWAN.POSITION_GAP_PCT) {
      triggers.push({
        type: 'position_gap',
        detail: `${ticker} gapped ${gapPct >= 0 ? '+' : ''}${gapPct.toFixed(1)}% overnight`,
        ticker,
        gapPct,
      });
    }
  }

  // 2. Sector collapse — average daily return per sector below threshold
  const sectorReturns = {};
  for (const [ticker, pos] of Object.entries(positions)) {
    if (!pos?.sector) continue;
    const prevPrice = prevPositions[ticker]?.currentPrice;
    const currPrice = marketData[ticker]?.closePrice;
    if (typeof prevPrice !== 'number' || typeof currPrice !== 'number' || prevPrice === 0) continue;
    const ret = ((currPrice - prevPrice) / prevPrice) * 100;
    if (!sectorReturns[pos.sector]) sectorReturns[pos.sector] = [];
    sectorReturns[pos.sector].push(ret);
  }
  for (const [sector, returns] of Object.entries(sectorReturns)) {
    if (returns.length === 0) continue;
    const avg = returns.reduce((s, v) => s + v, 0) / returns.length;
    if (avg < BLACK_SWAN.SECTOR_COLLAPSE_PCT) {
      triggers.push({
        type: 'sector_collapse',
        detail: `${sector} sector avg ${avg.toFixed(1)}% today`,
        sector,
        avgReturn: avg,
      });
    }
  }

  // 3. SPY crash
  const spyReturn = ctx.benchmark?.spyDailyReturn;
  if (typeof spyReturn === 'number' && spyReturn < BLACK_SWAN.SPY_CRASH_PCT) {
    triggers.push({
      type: 'spy_crash',
      detail: `SPY down ${spyReturn.toFixed(1)}% today`,
      spyReturn,
    });
  }

  return triggers;
}

// ─── Main Export: Request Builder ────────────────────────────────────

/**
 * Builds the Anthropic API request body for emergency risk assessment.
 *
 * @param {Object} ctx - EvaluationContext.
 * @param {Object[]} triggers - From detectBlackSwanTriggers().
 * @param {Object[]} activeRules - User's equipped rules (risk + exit relevant).
 * @returns {Object} Request body: { model, max_tokens, temperature, system, messages, tools }.
 */
export function buildBlackSwanRequest(ctx, triggers, activeRules) {
  return {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1000,
    temperature: 0.3,
    system: BLACK_SWAN_SYSTEM_PROMPT,
    messages: [
      { role: 'user', content: buildUserMessage(ctx, triggers, activeRules) },
    ],
    tools: [BLACK_SWAN_TOOL],
  };
}

// ─── Main Export: Response Parser ────────────────────────────────────

/**
 * Parses the Anthropic API response and extracts the tool-use input.
 * Returns a safe default shape if the tool_use block is missing.
 *
 * @param {Object} response - Anthropic messages.create() response.
 * @returns {{
 *   severity: string,
 *   assessment: string,
 *   actions: Object[],
 *   overriddenRules: Object[],
 *   resumeNormal: boolean
 * }}
 */
export function parseBlackSwanResponse(response) {
  const content = response && Array.isArray(response.content) ? response.content : [];
  const toolUse = content.find(c => c && c.type === 'tool_use' && c.name === 'submit_emergency_assessment');
  if (!toolUse || !toolUse.input) {
    return {
      severity: 'contained',
      assessment: '',
      actions: [],
      overriddenRules: [],
      resumeNormal: true,
    };
  }
  const input = toolUse.input;
  return {
    severity: typeof input.severity === 'string' ? input.severity : 'contained',
    assessment: typeof input.assessment === 'string' ? input.assessment : '',
    actions: Array.isArray(input.actions) ? input.actions : [],
    overriddenRules: Array.isArray(input.overridden_rules) ? input.overridden_rules : [],
    resumeNormal: input.resume_normal !== false,
  };
}

// ─── Internal: User Message Assembly ─────────────────────────────────

/**
 * Assembles a compact user-message body (~500 tokens target).
 * Dense CSV format for positions; short enumeration for rules and triggers.
 */
function buildUserMessage(ctx, triggers, activeRules) {
  const lines = [];

  // 1. Triggers
  lines.push('EMERGENCY TRIGGERS DETECTED:');
  const trigList = Array.isArray(triggers) ? triggers : [];
  if (trigList.length === 0) {
    lines.push('(none — this call should not have fired, no escalation needed)');
  } else {
    for (const t of trigList) {
      lines.push(`- [${t.type}] ${t.detail}`);
    }
  }
  lines.push('');

  // 2. Season position
  const season = ctx?.season || {};
  const week = season.currentWeek ?? '?';
  const totalWeeks = season.totalWeeks ?? 4;
  const alpha = typeof season.alphaVsSpy === 'number' ? season.alphaVsSpy.toFixed(2) : '?';
  const totalReturn = typeof season.portfolioReturn === 'number' ? season.portfolioReturn.toFixed(2) : '?';
  const spyReturn = typeof season.spyReturn === 'number' ? season.spyReturn.toFixed(2) : '?';
  lines.push(`SEASON POSITION: Week ${week} of ${totalWeeks}, Alpha ${alpha}%, Total ${totalReturn}%, SPY ${spyReturn}%`);
  lines.push('');

  // 3. Portfolio CSV with today's return
  lines.push('PORTFOLIO (TICKER,SECTOR,WEIGHT%,TODAY%,RETURN_SINCE_ENTRY%):');
  const positions = ctx?.portfolio?.positions || {};
  const posEntries = Object.entries(positions);
  if (posEntries.length === 0) {
    lines.push('(empty)');
  } else {
    for (const [ticker, pos] of posEntries) {
      if (!pos) continue;
      const sector = pos.sector || '?';
      const weight = typeof pos.currentWeight === 'number' ? pos.currentWeight.toFixed(1) : '?';
      const todayRet = computeTodayReturn(pos, ctx?.marketData?.[ticker]);
      const todayStr = todayRet != null ? todayRet.toFixed(1) : '?';
      const entryRet = typeof pos.returnSinceEntry === 'number' ? pos.returnSinceEntry.toFixed(1) : '?';
      lines.push(`${ticker},${sector},${weight},${todayStr},${entryRet}`);
    }
  }
  lines.push('');

  // 4. User's risk/exit rules
  lines.push('ACTIVE RISK & EXIT RULES:');
  const rules = Array.isArray(activeRules) ? activeRules : [];
  const riskRules = rules.filter(r => r && r.enabled !== false && typeof r.ruleId === 'string' && r.ruleId.startsWith('sx-'));
  if (riskRules.length === 0) {
    lines.push('(none)');
  } else {
    for (const r of riskRules) {
      lines.push(`- ${r.ruleId}: ${formatParams(r.params)}`);
    }
  }

  return lines.join('\n');
}

/**
 * Today's return for a position, computed from marketData if priceHistory
 * has at least two points. Returns null if insufficient data.
 */
function computeTodayReturn(pos, market) {
  const history = market?.priceHistory;
  if (Array.isArray(history) && history.length >= 2) {
    const current = history[history.length - 1];
    const prev = history[history.length - 2];
    if (typeof current === 'number' && typeof prev === 'number' && prev !== 0) {
      return ((current - prev) / prev) * 100;
    }
  }
  return null;
}

function formatParams(params) {
  if (!params || typeof params !== 'object') return '{}';
  const parts = Object.entries(params).map(([k, v]) => `${k}:${v}`);
  return `{${parts.join(',')}}`;
}
