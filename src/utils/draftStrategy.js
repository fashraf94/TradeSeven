/**
 * Consolidated Snake Draft Strategy Utilities
 *
 * This module contains the single source of truth for generating
 * tiered draft strategies. Previously this logic was duplicated in
 * two locations (ResearchFlow and dashboard inline research).
 */

/**
 * Assigns tier labels and rationales to portfolio assets for Snake Draft
 *
 * @param {Array} portfolio - Array of portfolio assets with source property
 * @returns {Array} - Sorted portfolio with tier assignments
 */
export function assignTiersToPortfolio(portfolio) {
  // Sort by priority: user_selected first (by conviction), then diversification
  const sortedPortfolio = [
    ...portfolio.filter(p => p.source === 'user_selected'),
    ...portfolio.filter(p => p.source === 'diversification'),
  ];

  // Assign tiers: Tier 1 (1-3), Tier 2 (4-6), Tier 3 (7+)
  sortedPortfolio.forEach((asset, index) => {
    if (index < 3) {
      asset.tier = 1;
      asset.tierLabel = '🔥 TIER 1';
      asset.tierRationale = 'Draft ASAP - High priority pick';
    } else if (index < 6) {
      asset.tier = 2;
      asset.tierLabel = '⚡ TIER 2';
      asset.tierRationale = 'Strong alternative if Tier 1 taken';
    } else {
      asset.tier = 3;
      asset.tierLabel = '📋 TIER 3';
      asset.tierRationale = 'Category filler for late rounds';
    }
    asset.draftRound = index + 1;
  });

  return sortedPortfolio;
}

/**
 * Generates the strategy summary text for Snake Draft
 *
 * @param {Array} sortedPortfolio - Portfolio with tier assignments
 * @param {Object} thesis - User's thesis with stance and sectors
 * @returns {string} - Formatted strategy text
 */
export function generateSnakeDraftStrategyText(sortedPortfolio, thesis) {
  const tier1Picks = sortedPortfolio.filter(p => p.tier === 1).map(p => p.symbol).join(', ');
  const tier2Picks = sortedPortfolio.filter(p => p.tier === 2).map(p => p.symbol).join(', ');
  const tier3Picks = sortedPortfolio.filter(p => p.tier === 3).map(p => p.symbol).join(', ');

  return `🐍 SNAKE DRAFT STRATEGY

Based on your thesis: ${thesis?.stance || 'Bullish'} on ${thesis?.sectors?.join(', ') || 'Growth sectors'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔥 PRIORITY TIER 1 - Draft ASAP (Rounds 1-3)
These assets match your thesis and will be highly contested.
${tier1Picks || 'None selected'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚡ PRIORITY TIER 2 - Strong Alternatives (Rounds 4-6)
Excellent picks if Tier 1 targets are taken.
${tier2Picks || 'None selected'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 TIER 3 - Category Fillers (Rounds 7-9)
Use these to complete your category requirements.
${tier3Picks || 'None selected'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 DRAFT TIPS:
• Track your category counts - you MUST have 3 Steady, 3 Risky, 3 Defensive
• If picking late in a round, pivot to best available
• Watch what opponents pick - adjust on the fly

📊 CATEGORY TRACKER:
□ Steady: 0/3  □ Risky: 0/3  □ Defensive: 0/3`;
}

/**
 * Creates the complete Snake Draft game plan object
 *
 * @param {Array} portfolio - Array of portfolio assets
 * @param {Object} thesis - User's thesis object
 * @param {Object} metadata - Additional metadata (userPicks, divPicks counts, strategy)
 * @returns {Object} - Complete game plan object for Snake Draft
 */
export function createSnakeDraftGamePlan(portfolio, thesis, metadata = {}) {
  const sortedPortfolio = assignTiersToPortfolio(portfolio);
  const strategyText = generateSnakeDraftStrategyText(sortedPortfolio, thesis);

  return {
    strategySummary: strategyText,
    portfolio: sortedPortfolio,
    isSnakeDraft: true,
    risks: [
      'High-priority picks may be taken by opponents before your turn',
      'Draft position affects which assets you can secure',
      'Week-long format means more exposure to volatility'
    ],
    insightConnections: 'Draft order prioritizes your high-conviction picks, with backup targets for each round.',
    generatedLocally: true,
    metadata: {
      userPicks: metadata.userPicksCount || 0,
      diversificationAdded: metadata.divPicksCount || 0,
      totalAssets: sortedPortfolio.length,
      diversificationStrategy: metadata.diversificationStrategy || 'balanced_mix'
    }
  };
}
