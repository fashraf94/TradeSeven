// api/_utils/agentNewsContext.js
// Reporter intelligence mapping and news context builder for agent evaluation prompts.
// Connects FantasyTimes stories to equipped Forge rules and game situation.

import { getETDate, formatDateString } from './marketSchedule.js';
import { isHardRule } from './ruleHardness.js';

// ==================== REPORTER INTELLIGENCE ====================

const REPORTER_INTELLIGENCE = {
  alex: {
    name: 'Alex',
    beat: 'Stock Spotlight',
    signalType: 'volatility',
    description: 'Reports on ATR-triggered stock moves. Stories signal high volatility and potential big movers.',
    forgeRuleAffinity: ['technical'],
    gameContextWeight: {
      losing: 'HIGH — Alex identifies volatile stocks that could help recover points through big moves',
      winning: 'MEDIUM — Alex\'s picks are risky; use selectively to protect a lead',
      neutral: 'MEDIUM — evaluate on merit against current strategy',
    },
  },
  kai: {
    name: 'Kai',
    beat: 'Market Pulse',
    signalType: 'market_overview',
    description: 'Reports on broad market conditions, sector trends, and overall market posture.',
    forgeRuleAffinity: ['allocation', 'risk'],
    gameContextWeight: {
      losing: 'MEDIUM — market context helps identify sector rotation opportunities',
      winning: 'HIGH — Kai\'s market read helps you stay on the right side of trends to protect gains',
      neutral: 'MEDIUM — use for general positioning awareness',
    },
  },
  neta: {
    name: 'Neta',
    beat: 'Economics Desk',
    signalType: 'macro_economic',
    description: 'Reports on CPI, Fed decisions, yields, and macro data. Stories signal regime shifts.',
    forgeRuleAffinity: ['risk', 'fundamental'],
    gameContextWeight: {
      losing: 'LOW — macro shifts are slow; not helpful for quick recovery',
      winning: 'HIGH — macro awareness prevents being blindsided by a regime shift that erases gains',
      neutral: 'HIGH — macro context is always strategically valuable',
    },
  },
  doug: {
    name: 'Doug',
    beat: 'Earnings Analyst',
    signalType: 'earnings',
    description: 'Reports on earnings results and previews. Stories signal earnings-driven moves.',
    forgeRuleAffinity: ['fundamental'],
    gameContextWeight: {
      losing: 'HIGH — earnings surprises create the biggest single-day moves for recovery',
      winning: 'MEDIUM — earnings events are high-variance; risky when protecting a lead',
      neutral: 'HIGH — earnings data is always relevant for stock evaluation',
    },
  },
  kim: {
    name: 'Kim',
    beat: 'Sector Strategist',
    signalType: 'sector_rotation',
    description: 'Reports on sector trends and rotation. Stories signal where money is flowing.',
    forgeRuleAffinity: ['allocation', 'fundamental'],
    gameContextWeight: {
      losing: 'HIGH — sector rotation signals help identify where the market is heading next',
      winning: 'MEDIUM — sector awareness helps maintain well-positioned portfolio',
      neutral: 'HIGH — sector intelligence informs allocation decisions',
    },
  },
};

// ==================== GAME CONTEXT ====================

/**
 * Derive game state from the battle document.
 * No opponent score available — uses absolute score + phase.
 */
export function computeGameContext(battle) {
  const scoreState = battle.scoreState || {};
  const currentScore = scoreState.currentScore || 0;

  const tradingDays = battle.timing?.tradingDays || [];
  const totalDays = tradingDays.length || 1;

  // Determine current trading day
  let currentDay = 1;
  if (tradingDays.length > 0) {
    const etNow = getETDate();
    const etDateStr = formatDateString(etNow);
    const dayIndex = tradingDays.indexOf(etDateStr);
    currentDay = dayIndex >= 0 ? dayIndex + 1 : totalDays;
  }

  const isLosing = currentScore < -5;
  const isWinning = currentScore > 15;
  const isLastDay = currentDay >= totalDays;
  const urgency = (isLastDay && currentScore < -10) ? 'high' : 'normal';

  let gameState = 'neutral';
  if (isLosing) gameState = 'losing';
  else if (isWinning) gameState = 'winning';

  return {
    currentScore,
    battleDay: currentDay,
    totalDays,
    isLosing,
    isWinning,
    urgency,
    gameState,
  };
}

// ==================== RULE MATCHING ====================

/**
 * Find equipped Forge rules whose category matches a reporter's affinity.
 * Returns matched rules with their labels, or null if no matches.
 */
export function matchStoryToRules(story, activeRules) {
  const reporter = REPORTER_INTELLIGENCE[story.reporter];
  if (!reporter) return null;

  const relevantRules = [];
  // Phase 3 — partition by the RESOLVED hard/soft (carried on each item) so an
  // authored override moves a rule's C#/S# label here in lockstep with the
  // forge-rules block, instead of re-deriving from category. Restricted to the
  // affinity universe reporters actually carry (risk/allocation/technical/
  // fundamental + uncategorized) so the C#/S# indices — and the no-override
  // output — stay byte-identical to pre-Phase-3.
  const inAffinityUniverse = (r) =>
    r.category === 'risk' || r.category === 'allocation' ||
    r.category === 'technical' || r.category === 'fundamental' || !r.category;
  const considered = activeRules.filter(inAffinityUniverse);
  const constraints = considered.filter(isHardRule);
  const strategies = considered.filter(r => !isHardRule(r));

  // Match constraints
  for (let i = 0; i < constraints.length; i++) {
    if (reporter.forgeRuleAffinity.includes(constraints[i].category)) {
      relevantRules.push({ label: `C${i + 1}`, text: constraints[i].text, category: constraints[i].category });
    }
  }

  // Match strategies
  for (let i = 0; i < strategies.length; i++) {
    if (reporter.forgeRuleAffinity.includes(strategies[i].category)) {
      relevantRules.push({ label: `S${i + 1}`, text: strategies[i].text, category: strategies[i].category });
    }
  }

  return relevantRules.length > 0 ? relevantRules : null;
}

// ==================== STORY RANKING ====================

/**
 * Rank stories by relevance and return top N.
 * Priority: (1) direct ticker match to portfolio, (2) reporter affinity to equipped rules, (3) recency.
 */
export function rankAndSelectStories(stories, activeRules, portfolioSymbols, maxStories = 3) {
  if (!stories || stories.length === 0) return [];

  const portfolioSet = new Set(portfolioSymbols || []);
  const equippedCategories = new Set((activeRules || []).map(r => r.category).filter(Boolean));

  const scored = stories.map(story => {
    let score = 0;

    // Direct ticker match to portfolio (+10)
    const storyTickers = story.tickers || [];
    if (storyTickers.some(t => portfolioSet.has(t))) score += 10;
    if (story.primaryTicker && portfolioSet.has(story.primaryTicker)) score += 5;

    // Reporter affinity match to equipped rule categories (+5)
    const reporter = REPORTER_INTELLIGENCE[story.reporter];
    if (reporter) {
      const affinityMatch = reporter.forgeRuleAffinity.some(cat => equippedCategories.has(cat));
      if (affinityMatch) score += 5;
    }

    // Recency bonus: stories < 1 hour old get +3, < 30 min get +5
    const ageMs = Date.now() - (story.publishedAt?.toMillis?.() || new Date(story.publishedAt).getTime());
    const ageMin = ageMs / 60000;
    if (ageMin < 30) score += 5;
    else if (ageMin < 60) score += 3;

    return { story, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxStories).map(s => s.story);
}

// ==================== PROMPT BLOCK BUILDER ====================

/**
 * Build the enhanced FantasyTimes intelligence block for the evaluation prompt.
 * ~300 tokens. Returns null if no stories.
 *
 * @param {Object[]} stories - Relevant stories (already ranked, max 3)
 * @param {Object[]} activeRules - Agent's equipped forge rules
 * @param {Object} gameContext - From computeGameContext()
 * @returns {string|null} Prompt block or null
 */
export function buildNewsIntelligenceBlock(stories, activeRules, gameContext) {
  if (!stories || stories.length === 0) return null;

  const parts = [];
  parts.push('FANTASYTIMES INTELLIGENCE (recent stories from your newsroom):');

  // Reporter context — only mention reporters whose stories are present
  const presentReporters = [...new Set(stories.map(s => s.reporter))];
  const reporterContextLines = [];
  for (const reporterKey of presentReporters) {
    const reporter = REPORTER_INTELLIGENCE[reporterKey];
    if (!reporter) continue;

    // Find matching rules for this reporter
    const matchingCategories = reporter.forgeRuleAffinity.filter(cat =>
      activeRules.some(r => r.category === cat)
    );

    if (matchingCategories.length > 0) {
      reporterContextLines.push(
        `- ${reporter.name} (${reporter.beat}) stories signal ${reporter.signalType.toUpperCase()}. ` +
        `Your ${matchingCategories.map(c => capitalize(c)).join(' and ')} rules are most relevant.`
      );
    } else {
      reporterContextLines.push(
        `- ${reporter.name} (${reporter.beat}) stories signal ${reporter.signalType.toUpperCase()}.`
      );
    }
  }
  if (reporterContextLines.length > 0) {
    parts.push(`REPORTER CONTEXT:\n${reporterContextLines.join('\n')}`);
  }

  // Game situation guidance
  const situationLines = [];
  situationLines.push(
    `GAME SITUATION: Day ${gameContext.battleDay} of ${gameContext.totalDays}, ` +
    `Score: ${gameContext.currentScore >= 0 ? '+' : ''}${gameContext.currentScore.toFixed(1)} pts` +
    (gameContext.urgency === 'high' ? ' [URGENT — final day, behind]' : '')
  );

  for (const reporterKey of presentReporters) {
    const reporter = REPORTER_INTELLIGENCE[reporterKey];
    if (!reporter) continue;
    const weight = reporter.gameContextWeight[gameContext.gameState];
    if (weight) {
      situationLines.push(`- ${reporter.name}: ${weight}`);
    }
  }
  parts.push(situationLines.join('\n'));

  // Story summaries with rule matching
  const storyLines = stories.map((story, i) => {
    const reporter = REPORTER_INTELLIGENCE[story.reporter];
    const reporterLabel = reporter ? reporter.name : (story.reporterName || story.reporter);
    const sentiment = (story.sentiment || 'neutral').toUpperCase();
    const ticker = story.primaryTicker || (story.tickers || []).join(', ') || 'market';

    let line = `${i + 1}. [${reporterLabel}] "${story.headline}" — ${sentiment}, ${ticker}`;

    // Add rule relevance if activeRules present
    const matchedRules = matchStoryToRules(story, activeRules);
    if (matchedRules) {
      const ruleRef = matchedRules.slice(0, 2).map(r =>
        `${r.label} (${truncate(r.text, 40)}) [${capitalize(r.category)}]`
      ).join('; ');
      line += `\n   → Relevant rules: ${ruleRef}`;
    }

    return line;
  });
  parts.push(`RECENT STORIES:\n${storyLines.join('\n')}`);

  // Instructions
  parts.push(
    'Stories INFORM how strongly to follow your Forge rules — they do not override constraints.\n' +
    'A constraint (C-rule) is never relaxed because of a story. A strategy preference (S-rule) can be amplified or dampened by story context.'
  );

  return parts.join('\n\n');
}

/**
 * Build the bare-headline fallback for agents without Forge rules.
 * Preserves the original section 3f format.
 */
export function buildBareNewsBlock(stories) {
  if (!stories || stories.length === 0) return null;

  const newsLines = stories.map(s => {
    const ago = getTimeAgo(s.publishedAt);
    return `- [${s.reporterName || s.reporter}, ${ago}, ${s.sentiment || 'neutral'}] "${s.headline}" | Tickers: ${(s.tickers || []).join(', ')}`;
  }).join('\n');

  return `FANTASYTIMES BREAKING NEWS:\n${newsLines}`;
}

// ==================== HELPERS ====================

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function truncate(str, maxLen) {
  if (!str) return '';
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + '…';
}

function getTimeAgo(timestamp) {
  if (!timestamp) return 'unknown';
  const ms = typeof timestamp?.toMillis === 'function'
    ? timestamp.toMillis()
    : new Date(timestamp).getTime();
  const diffMin = Math.round((Date.now() - ms) / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  const hours = Math.round(diffMin / 60);
  return `${hours}h ago`;
}
