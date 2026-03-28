// Prompt assembly for agent decide endpoint
// Shared system prompts (cacheable) + agent-specific user prompts

/**
 * Cacheable system prompt for the Sonnet strategy call.
 * Identical across all agents in the same market window.
 */
export function buildStrategySystemPrompt(marketCSV, storiesSummary) {
  return `You are a strategic analyst for BaggerBomb, a competitive stock portfolio game. Your job: analyze market conditions, then recommend 25-35 stocks for a portfolio builder.

GAME RULES:
- Portfolio tiers: Star (2 stocks, 2x multiplier), Core (2 stocks, 1.5x), Support (2 stocks + 1 crypto, 1x)
- Bench: 3 stocks + 1 crypto (swap reserves)
- Scoring: priceChange × 10 × tierMultiplier + threshold bonuses
- Star amplifies gains AND losses — only put high-conviction plays here
- BaggerBomb bonuses: +15 (1x ATR), +30 (1.5x ATR), +50 (2x ATR)
- Bust penalties: -10 (1x ATR), -20 (1.5x ATR), -35 (2x ATR)

STOCK UNIVERSE (TICKER|SECTOR|FUND|TECH|BB_FIT|ATR_PCT):
${marketCSV}

RECENT FANTASYTIMES INTELLIGENCE:
${storiesSummary || 'No recent stories available.'}`;
}

/**
 * Agent-specific user prompt (after cache breakpoint).
 */
export function buildStrategyUserPrompt(agent) {
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
      "This is your first deployment. No prior game experience yet. Trust your archetype instincts and your user's directives."
    );
  }

  // Recent game memory
  if (agent.memory?.length > 0) {
    parts.push(`RECENT GAME MEMORY:\n${formatMemory(agent.memory)}`);
  }

  // Active directives
  const activeDirectives = filterActiveDirectives(agent.directives);
  if (activeDirectives.length > 0) {
    parts.push(
      `ACTIVE DIRECTIVES — HARD CONSTRAINTS (follow these even if market data disagrees):\n${formatDirectives(activeDirectives)}`
    );
  } else {
    parts.push('No specific directives from your user yet. Use your best judgment.');
  }

  // Forge rules (structured constraint/strategy framework)
  const activeRules = agent.activeRules || [];
  if (activeRules.length > 0) {
    const constraints = activeRules.filter(r => r.category === 'risk' || r.category === 'allocation');
    const strategies = activeRules.filter(r => r.category === 'technical' || r.category === 'fundamental' || !r.category);
    const rLines = [];
    if (constraints.length > 0) {
      rLines.push(`CONSTRAINTS:\n${constraints.map((r, i) => `C${i + 1}. ${r.text}`).join('\n')}`);
    }
    if (strategies.length > 0) {
      rLines.push(`STRATEGY PREFERENCES:\n${strategies.map((r, i) => `S${i + 1}. ${r.text}`).join('\n')}`);
    }
    parts.push(`FORGE RULES (follow alongside directives):\n${rLines.join('\n')}`);
  }

  parts.push(
    'Produce your strategic analysis and recommended shortlist of 25-35 tickers using the submit_strategy tool.'
  );

  return parts.join('\n\n');
}

/**
 * System prompt for the Haiku portfolio construction call.
 */
export function buildPortfolioSystemPrompt(strategyBrief, shortlistCSV, cryptoList) {
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

AVAILABLE STOCKS (pre-approved, pick ONLY from these):
${shortlistCSV}

AVAILABLE CRYPTO:
${cryptoList}

Use the submit_portfolio tool to submit your selections with rationale for each tier.`;
}

/**
 * Convert stockRankings stocks array into dense pipe-delimited CSV.
 */
export function formatMarketCSV(stocks) {
  if (!stocks?.length) return 'No stock data available.';

  const header = 'TICKER|SECTOR|FUND|TECH|BB_FIT|ATR_PCT';
  const rows = stocks.map((s) => {
    const sector = s.sectorName || 'Unknown';
    const fund = s.fundamentalScore != null ? Math.round(s.fundamentalScore) : '-';
    const tech = s.technicalScore != null ? Math.round(s.technicalScore) : '-';
    const bbFit = s.baggerBombFit != null ? Math.round(s.baggerBombFit) : '-';
    const atr = s.atrPercentile != null ? s.atrPercentile.toFixed(2) : '-';
    return `${s.symbol}|${sector}|${fund}|${tech}|${bbFit}|${atr}`;
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
 * Format active directives grouped by source.
 */
export function formatDirectives(directives) {
  if (!directives?.length) return '';

  const groups = {
    coaching: [],
    pinned: [],
    strategy_session: [],
    system: [],
  };

  for (const d of directives) {
    const group = groups[d.source] || groups.system;
    group.push(d.text);
  }

  const parts = [];

  if (groups.coaching.length > 0) {
    parts.push(
      `COACHING (permanent — from your user):\n${groups.coaching.map((t) => `- ${t}`).join('\n')}`
    );
  }
  if (groups.pinned.length > 0) {
    parts.push(
      `PINNED INSIGHTS (from your own experience):\n${groups.pinned.map((t) => `- ${t}`).join('\n')}`
    );
  }
  if (groups.strategy_session.length > 0) {
    parts.push(
      `STRATEGY SESSION (temporary):\n${groups.strategy_session.map((t) => `- ${t}`).join('\n')}`
    );
  }
  if (groups.system.length > 0) {
    parts.push(
      `SYSTEM:\n${groups.system.map((t) => `- ${t}`).join('\n')}`
    );
  }

  return parts.join('\n\n');
}

/**
 * Filter out expired directives.
 */
function filterActiveDirectives(directives) {
  if (!directives?.length) return [];
  const now = Date.now();
  return directives.filter((d) => {
    if (!d.expiresAt) return true;
    return new Date(d.expiresAt).getTime() > now;
  });
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
