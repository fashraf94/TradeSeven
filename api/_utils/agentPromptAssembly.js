// Prompt assembly for agent decide endpoint
// Shared system prompts (cacheable) + agent-specific user prompts

import { getFirebaseAdmin } from './firebaseAdmin.js';
import { ARCHETYPE_CONSTRAINTS } from './archetypeScoring.js';
import { isHardRule } from './ruleHardness.js';

/**
 * Cacheable system prompt for the Sonnet strategy call.
 * Identical across all agents in the same market window.
 */
export function buildStrategySystemPrompt(marketCSV, storiesSummary, archetype) {
  const constraint = archetype && ARCHETYPE_CONSTRAINTS[archetype]
    ? `\nARCHETYPE STRATEGY CONSTRAINT:\n${ARCHETYPE_CONSTRAINTS[archetype]}\n\nThe ARCH column in the stock data below is pre-computed for your archetype. Higher scores = better fit for your strategy. Use it as your primary sorting signal.`
    : '';

  return `You are a strategic analyst for BaggerBomb, a competitive stock portfolio game. Your job: analyze market conditions, then recommend 25-35 stocks for a portfolio builder.

GAME RULES:
- Portfolio tiers: Star (2 stocks, 2x multiplier), Core (2 stocks, 1.5x), Support (2 stocks + 1 crypto, 1x)
- Bench: 3 stocks + 1 crypto (swap reserves)
- Scoring: priceChange × 10 × tierMultiplier + threshold bonuses
- Star amplifies gains AND losses — only put high-conviction plays here
- BaggerBomb bonuses: +15 (1x ATR), +30 (1.5x ATR), +50 (2x ATR)
- Bust penalties: -10 (1x ATR), -20 (1.5x ATR), -35 (2x ATR)
${constraint}

STOCK UNIVERSE (TICKER|SECTOR|FUND|TECH|BB_FIT|ATR_PCT|ARCH):
${marketCSV}

RECENT FANTASYTIMES INTELLIGENCE:
${storiesSummary || 'No recent stories available.'}`;
}

/**
 * Agent-specific user prompt (after cache breakpoint).
 *
 * @param {Object} agent
 * @param {{name?: string, tickers?: string[], thesis?: string}|null} [equippedWatchlist]
 *   Phase 5B1 — the agent's equipped watchlist, or null. `name` and `thesis`
 *   are user-authored free text and are sanitized INSIDE this function (via
 *   sanitizeRuleText, the same guard resolveRuleText uses for Forge rules)
 *   before interpolation. Callers pass raw values and must not pre-sanitize.
 */
export function buildStrategyUserPrompt(agent, equippedWatchlist = null) {
  const parts = [];

  // Identity
  const archetype = agent.archetype
    ? agent.archetype.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
    : 'Unknown';
  parts.push(`AGENT IDENTITY:\nName: ${agent.name || 'Agent'} | Archetype: ${archetype}`);

  if (agent.personality?.traits?.length > 0) {
    parts.push(`Traits: ${agent.personality.traits.join(', ')}`);
  }

  // Consolidated insight from evolution
  if (agent.consolidatedInsight) {
    parts.push(
      `STRATEGIC WISDOM (from ${agent.evolutionCycle || 0} evolution cycles):\n${agent.consolidatedInsight}`
    );
  } else {
    parts.push(
      'This is your first deployment. No prior game experience yet. Trust your archetype instincts.'
    );
  }

  // Recent game memory
  if (agent.memory?.length > 0) {
    parts.push(`RECENT GAME MEMORY:\n${formatMemory(agent.memory)}`);
  }

  // Forge rules (structured constraint/strategy framework)
  const activeRules = agent.activeRules || [];
  if (activeRules.length > 0) {
    // Phase 3 — hard/soft is resolved once in projectActiveRules and carried on
    // each item; read it via the single server source (ruleHardness.js). With no
    // override this is the category-derived split — byte-identical to pre-Phase-3.
    const constraints = activeRules.filter(isHardRule);
    const strategies = activeRules.filter(r => !isHardRule(r));
    const rLines = [];
    if (constraints.length > 0) {
      rLines.push(`CONSTRAINTS:\n${constraints.map((r, i) => `C${i + 1}. ${resolveRuleText(r)}`).join('\n')}`);
    }
    if (strategies.length > 0) {
      rLines.push(`STRATEGY PREFERENCES:\n${strategies.map((r, i) => `S${i + 1}. ${resolveRuleText(r)}`).join('\n')}`);
    }

    // Institutional data lag warning (only when institutional rules are active)
    const hasInstitutionalRules = activeRules.some(r => r.category === 'institutional');
    if (hasInstitutionalRules) {
      rLines.push(
        'C_INST: INSTITUTIONAL DATA LAG — Institutional accumulation/distribution data from 13F\n' +
        'filings is lagged up to 135 days. NEVER hold a position based solely on strong\n' +
        'institutional accumulation if VWAP or 5-min RSI shows a breakdown. Intraday technicals\n' +
        'ALWAYS override stale institutional signals. Use institutional data for draft-time\n' +
        'universe filtering, not intraday swap decisions.'
      );
    }

    parts.push(`FORGE RULES (your equipped strategy):\n${rLines.join('\n')}`);
  }

  // Phase 5B1 — user-equipped watchlist. name + thesis are user-authored, so
  // both are run through sanitizeRuleText before they enter the prompt.
  if (equippedWatchlist) {
    const tickerList = (Array.isArray(equippedWatchlist.tickers) ? equippedWatchlist.tickers : [])
      .filter((t) => typeof t === 'string' && /^[A-Z0-9.-]{1,12}$/.test(t));
    if (tickerList.length > 0) {
      const safeName = sanitizeRuleText(equippedWatchlist.name) || 'Untitled watchlist';
      const safeThesis = equippedWatchlist.thesis ? sanitizeRuleText(equippedWatchlist.thesis) : '';
      const lines = [
        'USER-EQUIPPED WATCHLIST',
        `The user has personally equipped a watchlist titled "${safeName}". They want these`,
        'tickers given priority consideration:',
        tickerList.join(', '),
      ];
      if (safeThesis) lines.push(`Thesis: "${safeThesis}"`);
      lines.push(
        '',
        'These are user-prioritized opportunities, not mandates. When building your shortlist:',
        '- Include every user-equipped ticker that has a plausible directional thesis — even',
        '  if it would not otherwise rank into your 25-35.',
        '- Where a user-equipped ticker is genuinely competitive, rank it accordingly high.',
        '- You may still omit a user-equipped ticker with a clearly poor setup; the user',
        '  trusts your judgment and does not want forced picks.',
        '- Some user-equipped tickers may not appear in the STOCK UNIVERSE table and will',
        '  show no FUND/TECH/BB_FIT/ATR/ARCH scores. Evaluate those on sector, thesis, and',
        '  market knowledge — absence from the table is not a negative signal.'
      );
      parts.push(lines.join('\n'));
    }
  }

  parts.push(
    'Produce your strategic analysis and recommended shortlist of 25-35 tickers using the submit_strategy tool.'
  );

  return parts.join('\n\n');
}

/**
 * System prompt for the Haiku portfolio construction call.
 *
 * @param {{tickers?: string[]}|null} [equippedBlock] Phase 5B1 — when present,
 *   appends a note that some AVAILABLE STOCKS rows are user-equipped tickers
 *   (possibly off-universe, shown with "-" scores) and should still be
 *   considered fairly.
 */
export function buildPortfolioSystemPrompt(strategyBrief, shortlistCSV, cryptoList, institutionalBlock = '', equippedBlock = null) {
  const equippedTickers = (equippedBlock && Array.isArray(equippedBlock.tickers))
    ? equippedBlock.tickers.filter((t) => typeof t === 'string' && /^[A-Z0-9.-]{1,12}$/.test(t))
    : [];
  const equippedNote = equippedTickers.length > 0
    ? `\nUSER-EQUIPPED TICKERS:
These tickers in AVAILABLE STOCKS were equipped by the user from a personal
watchlist: ${equippedTickers.join(', ')}.
Rows showing "-" for FUND/TECH/BB_FIT/ATR are user-equipped tickers outside the
scored universe — expected, not a data error. Evaluate them on price action,
sector, and the analyst's guidance. Give them fair consideration; do not exclude
a ticker solely because its scores are unavailable.\n`
    : '';

  return `You are a portfolio builder for BaggerBomb. Build the mathematically optimal portfolio from the pre-approved shortlist below.

TIER RULES:
- star: exactly 2 stocks (2x multiplier — highest conviction plays)
- core: exactly 2 stocks (1.5x multiplier — balanced picks)
- support_stocks: exactly 2 stocks (1x multiplier — foundation/stability)
- support_crypto: exactly 1 crypto from the available list
- bench_stocks: exactly 3 stocks (swap reserves that hedge your active picks)
- bench_crypto: exactly 1 crypto (different from support crypto)

STRATEGIC GUIDANCE FROM ANALYST:
${strategyBrief}
${institutionalBlock ? `\n${institutionalBlock}\n` : ''}
AVAILABLE STOCKS (pre-approved, pick ONLY from these):
${shortlistCSV}
${equippedNote}
AVAILABLE CRYPTO:
${cryptoList}

Use the submit_portfolio tool to submit your selections with rationale for each tier.`;
}

/**
 * Convert stockRankings stocks array into dense pipe-delimited CSV.
 */
export function formatMarketCSV(stocks) {
  if (!stocks?.length) return 'No stock data available.';

  const header = 'TICKER|SECTOR|FUND|TECH|BB_FIT|ATR_PCT|ARCH';
  const rows = stocks.map((s) => {
    const sector = s.sectorName || 'Unknown';
    const fund = s.fundamentalScore != null ? Math.round(s.fundamentalScore) : '-';
    const tech = s.technicalScore != null ? Math.round(s.technicalScore) : '-';
    const bbFit = s.baggerBombFit != null ? Math.round(s.baggerBombFit) : '-';
    const atr = s.atrPercentile != null ? s.atrPercentile.toFixed(2) : '-';
    const arch = s.archetypeScore != null ? s.archetypeScore.toFixed(1) : '-';
    return `${s.symbol}|${sector}|${fund}|${tech}|${bbFit}|${atr}|${arch}`;
  });

  return [header, ...rows].join('\n');
}

/**
 * Convert FantasyTimes stories to concise summary block.
 */
export function formatStoriesSummary(stories) {
  if (!stories?.length) return null;

  return stories
    .map((s, i) => {
      const reporter = s.reporterName || s.reporter || 'Unknown';
      const beat = s.reporterBeat || s.type || '';
      const headline = s.headline || 'Untitled';
      const timeAgo = formatTimeAgo(s.publishedAt);
      return `${i + 1}. [${reporter}/${beat}] "${headline}"${timeAgo ? ` (${timeAgo})` : ''}`;
    })
    .join('\n');
}

/**
 * Format agent memory entries.
 */
export function formatMemory(memory) {
  if (!memory?.length) return '';

  return memory
    .map((m) => {
      const result = m.result === 'win' ? 'Win' : 'Loss';
      const score = m.score > 0 ? `+${m.score}` : m.score;
      const lesson = m.lesson ? `\n  → ${m.lesson}` : '';
      const adjustment = m.adjustment ? `\n  → Adjustment: ${m.adjustment}` : '';
      return `Game (${result} ${score}): ${m.lesson || 'No lesson recorded.'}${adjustment}`;
    })
    .join('\n');
}

/**
 * Sanitize user-authored rule text before injecting into the system prompt.
 * Prevents prompt injection, caps length, strips control characters.
 */
function sanitizeRuleText(text) {
  if (!text || typeof text !== 'string') return '';
  let cleaned = text.slice(0, 200);
  cleaned = cleaned.replace(/==\s*.*?\s*==/g, '');
  cleaned = cleaned.replace(/━+/g, '');
  const injectionPatterns = [
    /ignore\s+(all\s+)?(previous|above|prior)\s+(instructions?|rules?|constraints?)/gi,
    /disregard\s+(all\s+)?(previous|above|prior)/gi,
    /stop\.?\s*(ignore|forget|disregard)/gi,
    /system\s*prompt/gi,
    /you\s+are\s+now/gi,
    /new\s+instructions?:/gi,
    /override\s+(all|previous|system)/gi,
  ];
  for (const pattern of injectionPatterns) {
    cleaned = cleaned.replace(pattern, '[removed]');
  }
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned;
}

function interpolateRuleText(template, paramDefs, paramValues) {
  if (!template || !paramDefs) return template || '';
  let result = template;
  for (const [key, def] of Object.entries(paramDefs)) {
    const value = (paramValues && paramValues[key] !== undefined)
      ? paramValues[key]
      : def.default;
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
  }
  return result;
}

function resolveRuleText(r) {
  if (r.textTemplate && r.params) {
    return sanitizeRuleText(interpolateRuleText(r.textTemplate, r.params, r.paramValues));
  }
  return sanitizeRuleText(r.text);
}

// ==================== INSTITUTIONAL INTELLIGENCE ====================

/**
 * Fetch institutional context for stocks if the agent has institutional rules active.
 * Reads from pre-computed Firestore collections (written by weekly cron).
 * Returns null if no institutional rules are active.
 */
async function fetchInstitutionalContext(rules, symbols) {
  const hasInstitutionalRules = rules.some(r => r.category === 'institutional');
  if (!hasInstitutionalRules) return null;

  try {
    const db = getFirebaseAdmin();

    // Fetch per-stock institutional summaries (batch read)
    const perStock = {};
    const batchSize = 10;
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      const promises = batch.map(sym =>
        db.collection('institutionalHoldings').doc(sym).get()
      );
      const snapshots = await Promise.all(promises);
      for (const snap of snapshots) {
        if (snap.exists) {
          const data = snap.data();
          perStock[data.symbol] = data.summary;
        }
      }
    }

    // Fetch aggregate for sector flows + hero headline
    let sectorFlows = null;
    let heroHeadline = null;
    try {
      const aggSnap = await db.collection('institutionalAggregates').doc('latest').get();
      if (aggSnap.exists) {
        const agg = aggSnap.data();
        sectorFlows = agg.sectorFlows || null;
        heroHeadline = agg.heroHeadline || null;
      }
    } catch (err) {
      console.warn('[AgentPrompt] Failed to fetch institutional aggregates:', err.message);
    }

    return { perStock, sectorFlows, heroHeadline };
  } catch (err) {
    console.warn('[AgentPrompt] Failed to fetch institutional context:', err.message);
    return null;
  }
}

/**
 * Format institutional data into a prompt context block.
 * Compact format to minimize tokens while providing actionable signals.
 */
function formatInstitutionalBlock(instContext) {
  if (!instContext) return '';

  const { perStock, sectorFlows, heroHeadline } = instContext;

  const lines = [];
  lines.push('=== INSTITUTIONAL INTELLIGENCE (13F Filings) ===');
  lines.push('NOTE: This data is from quarterly SEC filings. It is lagged by up to 135 days.');
  lines.push('Do NOT hold a position based solely on institutional accumulation if real-time');
  lines.push('technicals (VWAP, 5-min RSI) show a breakdown. Institutional data provides the');
  lines.push('historical "floor." Real-time technicals dictate the "action."');
  lines.push('');

  if (heroHeadline) {
    lines.push(`MACRO ROTATION: ${heroHeadline}`);
    lines.push('');
  }

  // Per-stock institutional signals
  if (Object.keys(perStock).length > 0) {
    lines.push('STOCK CONVICTION SIGNALS:');
    lines.push('Symbol | Conviction | Score | Buyers | Sellers | New Positions | Cluster Buy');
    lines.push('-------|------------|-------|--------|---------|---------------|------------');

    for (const [symbol, summary] of Object.entries(perStock)) {
      if (!summary) continue;
      lines.push(
        `${symbol} | ${summary.conviction || 'neutral'} | ${summary.convictionScore || 0} | ` +
        `${summary.buyersCount || 0} | ${summary.sellersCount || 0} | ` +
        `${summary.newPositionsCount || 0} | ${summary.clusterBuy ? 'YES' : 'no'}`
      );
    }
    lines.push('');
  }

  // Sector flows (compact)
  if (sectorFlows) {
    const SECTOR_NAMES = {
      XLK: 'Tech', XLV: 'Health', XLF: 'Finance', XLE: 'Energy',
      XLY: 'Consumer', XLP: 'Staples', XLI: 'Industrial', XLB: 'Materials',
      XLU: 'Utilities', XLRE: 'RealEst', XLC: 'Comms',
    };

    lines.push('SECTOR INSTITUTIONAL FLOWS:');
    for (const [etf, flow] of Object.entries(sectorFlows)) {
      const name = SECTOR_NAMES[etf] || etf;
      lines.push(`${name}: ${flow.sentiment} (B:${flow.netBuyers} S:${flow.netSellers})`);
    }
    lines.push('');
  }

  lines.push('=== END INSTITUTIONAL INTELLIGENCE ===');

  return lines.join('\n');
}

/**
 * Build institutional intelligence block for portfolio construction.
 * Convenience wrapper for the decide.js caller.
 * @param {Array} activeRules - Agent's active Forge rules
 * @param {string[]} symbols - Stock symbols being considered
 * @returns {string} Formatted block or empty string
 */
export async function buildInstitutionalBlock(activeRules, symbols) {
  const instContext = await fetchInstitutionalContext(activeRules, symbols);
  return formatInstitutionalBlock(instContext);
}

/**
 * Format a timestamp as relative time (e.g., "2h ago").
 */
function formatTimeAgo(timestamp) {
  if (!timestamp) return '';
  const date =
    timestamp?._seconds != null
      ? new Date(timestamp._seconds * 1000)
      : new Date(timestamp);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}
