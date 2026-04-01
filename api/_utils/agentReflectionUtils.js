// api/_utils/agentReflectionUtils.js
// Utilities for post-battle reflection: history truncation, prompt assembly,
// Tool Use schema, and response parsing.

import { getCategoriesForMode, CURRENT_SCHEMA_VERSION } from './gameDesignCategoryConfig.js';
import { flattenPortfolioServer } from './agentScoring.js';

// ==================== TOOL SCHEMA ====================

/**
 * Forced Tool Use schema for the Sonnet reflection call.
 * Two-pass output: self-reflection (outcome-aware) + game design feedback (outcome-blind).
 */
export const REFLECTION_TOOL = {
  name: 'submit_reflection',
  description:
    'Submit your post-battle reflection and game design evaluation. The selfReflection section should reference the battle outcome. The gameDesignFeedback section must NOT reference whether you won or lost — evaluate mechanics purely on quality.',
  input_schema: {
    type: 'object',
    required: ['selfReflection', 'gameDesignFeedback'],
    properties: {
      selfReflection: {
        type: 'object',
        required: ['lesson', 'adjustment', 'hypothesisGrades', 'confidenceCalibration'],
        properties: {
          lesson: {
            type: 'string',
            description: 'Key takeaway from this battle. Max 50 words.',
          },
          adjustment: {
            type: 'string',
            description: 'What you would change next time. Max 50 words.',
          },
          hypothesisGrades: {
            type: 'array',
            items: {
              type: 'object',
              required: ['hypothesis', 'grade', 'reason'],
              properties: {
                hypothesis: { type: 'string', description: 'The hypothesis text' },
                grade: {
                  type: 'string',
                  enum: ['correct', 'incorrect', 'inconclusive'],
                },
                reason: { type: 'string', description: 'Brief reason for grade. Max 30 words.' },
              },
            },
            description: 'Grade each hypothesis you made during the battle.',
          },
          confidenceCalibration: {
            type: 'string',
            description: 'Were you overconfident, underconfident, or well-calibrated? Max 30 words.',
          },
        },
      },
      gameDesignFeedback: {
        type: 'object',
        required: [
          'threshold_calibration',
          'tier_impact',
          'swap_economy',
          'scoring_tension',
          'decision_density',
          'information_value',
          'mechanicHighlight',
          'mechanicFriction',
          'wouldPlayAgain',
        ],
        properties: {
          threshold_calibration: {
            type: 'object',
            required: ['rating', 'observation'],
            properties: {
              rating: { type: 'integer', minimum: 1, maximum: 5 },
              observation: { type: 'string', description: 'Specific observation from this battle. Max 100 words.' },
              suggestion: { type: 'string', description: 'Actionable improvement or null.', nullable: true },
            },
          },
          tier_impact: {
            type: 'object',
            required: ['rating', 'observation'],
            properties: {
              rating: { type: 'integer', minimum: 1, maximum: 5 },
              observation: { type: 'string' },
              suggestion: { type: 'string', nullable: true },
            },
          },
          swap_economy: {
            type: 'object',
            required: ['rating', 'observation'],
            properties: {
              rating: { type: 'integer', minimum: 1, maximum: 5 },
              observation: { type: 'string' },
              suggestion: { type: 'string', nullable: true },
            },
          },
          scoring_tension: {
            type: 'object',
            required: ['rating', 'observation'],
            properties: {
              rating: { type: 'integer', minimum: 1, maximum: 5 },
              observation: { type: 'string' },
              suggestion: { type: 'string', nullable: true },
            },
          },
          decision_density: {
            type: 'object',
            required: ['rating', 'observation'],
            properties: {
              rating: { type: 'integer', minimum: 1, maximum: 5 },
              observation: { type: 'string' },
              suggestion: { type: 'string', nullable: true },
            },
          },
          information_value: {
            type: 'object',
            required: ['rating', 'observation'],
            properties: {
              rating: { type: 'integer', minimum: 1, maximum: 5 },
              observation: { type: 'string' },
              suggestion: { type: 'string', nullable: true },
            },
          },
          mechanicHighlight: {
            type: 'string',
            description: 'The single best moment or mechanic in this battle.',
          },
          mechanicFriction: {
            type: 'string',
            description: 'The single most frustrating or confusing mechanic.',
          },
          wouldPlayAgain: {
            type: 'boolean',
            description: 'Based purely on game quality, not outcome.',
          },
        },
      },
    },
  },
};

// ==================== HISTORY TRUNCATION ====================

/**
 * Truncate battle history to fit within ~3,000 tokens for the Sonnet context block.
 *
 * Rules:
 * - evaluations[]: Keep first 3, last 5, and any that resulted in a trade (decision !== 'HOLD').
 *   Summarize the gap.
 * - trades[]: Keep ALL (high-signal). Cap hypothesis/innerMonologue to 100 words each.
 * - statusFeed[]: Keep last 10 plus high-signal entries (swap, risk_alert, threshold_event,
 *   strategy, lock).
 */
export function truncateBattleHistory(battleDoc) {
  const evaluations = battleDoc.evaluations || [];
  const trades = battleDoc.trades || [];
  const statusFeed = battleDoc.statusFeed || [];

  // --- Evaluations ---
  const HIGH_SIGNAL_DECISIONS = ['SWAP', 'PROPOSAL'];
  let truncatedEvals = [];
  let evaluationSummary = null;

  if (evaluations.length <= 8) {
    truncatedEvals = evaluations;
  } else {
    const first3 = evaluations.slice(0, 3);
    const last5 = evaluations.slice(-5);
    const firstTimestamp = first3[first3.length - 1]?.timestamp;
    const lastTimestamp = last5[0]?.timestamp;

    // Collect trade-producing evals from the middle gap
    const middleStart = 3;
    const middleEnd = evaluations.length - 5;
    const middleTradeEvals = evaluations
      .slice(middleStart, middleEnd)
      .filter(e => HIGH_SIGNAL_DECISIONS.includes(e.decision));

    truncatedEvals = [...first3, ...middleTradeEvals, ...last5];
    // Deduplicate by evalId
    const seen = new Set();
    truncatedEvals = truncatedEvals.filter(e => {
      const key = e.evalId || e.timestamp;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const skipped = evaluations.length - truncatedEvals.length;
    if (skipped > 0) {
      evaluationSummary = `${skipped} additional HOLD evaluations between ${firstTimestamp || '?'} and ${lastTimestamp || '?'} omitted.`;
    }
  }

  // --- Trades: keep all, cap text fields ---
  const truncatedTrades = trades.map(t => ({
    ...t,
    hypothesis: truncateText(t.hypothesis, 100),
    rationale: truncateText(t.rationale, 100),
  }));

  // --- StatusFeed: keep last 10 + high-signal ---
  const HIGH_SIGNAL_ACTIONS = ['swap', 'risk_alert', 'threshold_event', 'strategy', 'lock', 'battle_complete', 'proposal'];
  const last10 = statusFeed.slice(-10);
  const highSignal = statusFeed.filter(e => HIGH_SIGNAL_ACTIONS.includes(e.action));

  const feedSeen = new Set();
  const statusFeedHighlights = [...highSignal, ...last10].filter(e => {
    const key = e.timestamp + (e.action || '');
    if (feedSeen.has(key)) return false;
    feedSeen.add(key);
    return true;
  });

  return {
    evaluations: truncatedEvals,
    evaluationSummary,
    trades: truncatedTrades,
    statusFeedHighlights,
    totalEvaluations: evaluations.length,
    totalTrades: trades.length,
  };
}

function truncateText(text, maxWords) {
  if (!text) return null;
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(' ') + '…';
}

// ==================== PROMPT ASSEMBLY ====================

/**
 * Build the system prompt for the Sonnet reflection call.
 */
export function buildReflectionSystemPrompt() {
  return `You are analyzing a completed FantasyTrades agent battle. You will produce two separate analyses using the submit_reflection tool.

PASS 1 — SELF-REFLECTION (outcome-aware):
You know the battle result. Analyze your strategy, grade your hypotheses, and identify what you'd change.

PASS 2 — GAME DESIGN EVALUATION (outcome-blind):
Evaluate the game mechanics as an automated playtester. Do NOT reference whether you won or lost.
A mechanic can be excellent even if it hurt you. A mechanic can be flawed even if it benefited you.

Use the submit_reflection tool to provide your analysis.`;
}

/**
 * Build the user message content for the Sonnet reflection call.
 * Uses battle.agentContext for agent identity (already on the battle doc).
 */
export function buildReflectionUserMessage(battleDoc, agentDoc) {
  const agentContext = battleDoc.agentContext || {};
  const scoreState = battleDoc.scoreState || {};
  const currentScore = scoreState.currentScore || 0;
  const opponentScore = scoreState.opponentScore || 0;
  const result = currentScore > opponentScore ? 'WIN' : (currentScore < opponentScore ? 'LOSS' : 'DRAW');

  const truncated = truncateBattleHistory(battleDoc);
  const categoryConfig = getCategoriesForMode(battleDoc.gameMode || 'baggerbomb');

  // --- Agent Identity ---
  const identityBlock = `AGENT IDENTITY:
Name: ${agentContext.agentName || agentDoc?.name || 'Agent'}
Archetype: ${agentContext.archetype || agentDoc?.archetype || 'unknown'}
Consolidated Insight: ${agentContext.consolidatedInsight || agentDoc?.consolidatedInsight || 'None yet'}`;

  // --- Battle Summary ---
  const summaryBlock = `BATTLE SUMMARY:
Game Mode: ${battleDoc.gameMode || 'baggerbomb'}
Duration: ${battleDoc.duration || 'unknown'}
Result: ${result}
Final Score: You ${currentScore >= 0 ? '+' : ''}${currentScore.toFixed(1)} — Opponent ${opponentScore >= 0 ? '+' : ''}${opponentScore.toFixed(1)}
Total Evaluations: ${truncated.totalEvaluations}
Total Trades: ${truncated.totalTrades}`;

  // --- Portfolio (final state) ---
  const portfolio = battleDoc.portfolio || {};
  const startingPrices = portfolio.startingPrices || {};
  const portfolioLines = [];
  ['star', 'core', 'support'].forEach(tier => {
    (portfolio[tier] || []).forEach(asset => {
      if (!asset) return;
      const entry = asset.swapPrice || startingPrices[asset.symbol] || 0;
      portfolioLines.push(`  [${tier.toUpperCase()}] ${asset.symbol} — entry: $${entry.toFixed(2)}, baseATR: ${asset.baseATR || '?'}`);
    });
  });
  const portfolioBlock = `PORTFOLIO (final state):\n${portfolioLines.join('\n') || '  (empty)'}`;

  // --- Thresholds ---
  const thresholds = battleDoc.scoring?.thresholds || {};
  const thresholdHistory = battleDoc.thresholdHistory || {};
  const thresholdLines = Object.entries(thresholds).map(([symbol, t]) => {
    const history = thresholdHistory[symbol] || {};
    const maxMult = (history.maxMultiplier || 0).toFixed(2);
    const minMult = (history.minMultiplier || 0).toFixed(2);
    return `  ${symbol}: baseATR=${t.threshold}, maxMult=${maxMult}, minMult=${minMult}`;
  });
  const thresholdBlock = `THRESHOLDS:\n${thresholdLines.join('\n') || '  (none)'}`;

  // --- Trade History ---
  const tradeLines = truncated.trades.map((t, i) => {
    const pts = t.lockedPoints != null ? `${t.lockedPoints >= 0 ? '+' : ''}${t.lockedPoints.toFixed(1)} pts` : '?';
    return `  ${i + 1}. ${t.symbolOut} → ${t.symbolIn} [${t.tier}] ${pts} | ${t.rationale || 'no rationale'}`;
  });
  const tradeBlock = `TRADE HISTORY:\n${tradeLines.join('\n') || '  (no trades)'}`;

  // --- Evaluation Highlights ---
  const evalLines = truncated.evaluations.map(e => {
    const scoreStr = e.scores ? `score=${e.scores.total}` : '';
    const hyp = e.hypothesis ? ` | hyp: ${truncateText(e.hypothesis, 30)}` : '';
    return `  [${e.timestamp}] ${e.decision} conv=${e.conviction || '?'} ${scoreStr}${hyp}`;
  });
  let evalBlock = `EVALUATION HIGHLIGHTS:\n${evalLines.join('\n') || '  (none)'}`;
  if (truncated.evaluationSummary) {
    evalBlock += `\n  (${truncated.evaluationSummary})`;
  }

  // --- Status Feed Highlights ---
  const feedLines = truncated.statusFeedHighlights.map(e => {
    return `  [${e.timestamp}] ${e.action}: ${truncateText(e.message, 30)}`;
  });
  const feedBlock = `STATUS FEED HIGHLIGHTS:\n${feedLines.join('\n') || '  (none)'}`;

  // --- Instructions ---
  const selfReflectionInstructions = `--- SELF-REFLECTION INSTRUCTIONS ---
Produce your selfReflection with:
- lesson: Key takeaway (max 50 words)
- adjustment: What to change next time (max 50 words)
- hypothesisGrades: Grade each hypothesis from your evaluations as "correct", "incorrect", or "inconclusive"
- confidenceCalibration: Were you overconfident, underconfident, or well-calibrated? (max 30 words)`;

  const gameDesignInstructions = `--- GAME DESIGN EVALUATION INSTRUCTIONS ---
Do NOT reference whether you won or lost in this section.
Evaluate each category with a rating (1-5), a specific observation from THIS battle, and an optional suggestion.

${categoryConfig.promptInstructions}

Also provide:
- mechanicHighlight: The single best moment/mechanic in this battle
- mechanicFriction: The single most frustrating or confusing mechanic
- wouldPlayAgain: Based purely on game quality, not outcome`;

  return [
    identityBlock,
    '',
    summaryBlock,
    '',
    portfolioBlock,
    '',
    thresholdBlock,
    '',
    tradeBlock,
    '',
    evalBlock,
    '',
    feedBlock,
    '',
    selfReflectionInstructions,
    '',
    gameDesignInstructions,
  ].join('\n');
}
