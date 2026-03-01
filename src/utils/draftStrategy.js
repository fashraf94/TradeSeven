/**
 * Consolidated Snake Draft Strategy Utilities
 *
 * This module contains the single source of truth for generating
 * tiered draft strategies. Previously this logic was duplicated in
 * two locations (ResearchFlow and dashboard inline research).
 */

// Asset category mappings for Snake Draft
// These match the categories used in draftAssets.js
const STEADY_SYMBOLS = new Set([
  // Mega-Cap Tech (Established)
  'AAPL', 'MSFT', 'GOOGL',
  // Financial Giants
  'JPM', 'V', 'MA', 'BAC', 'WFC', 'GS',
  // Consumer Staples
  'PG', 'KO', 'PEP', 'WMT', 'COST',
  // Healthcare Giants
  'JNJ', 'UNH', 'PFE', 'MRK', 'ABBV',
  // Industrial/Conglomerate
  'BRK.B', 'HON', 'MMM', 'CAT',
  // Communication
  'VZ', 'T', 'CMCSA',
  // Steady Crypto
  'BTC', 'ETH'
]);

const RISKY_SYMBOLS = new Set([
  // High-Growth Tech
  'NVDA', 'TSLA', 'META', 'AMD', 'CRM', 'NFLX', 'SHOP', 'XYZ', 'SNOW', 'PLTR',
  // Biotech/Pharma
  'MRNA', 'BNTX', 'CRSP',
  // EV/Clean Energy
  'RIVN', 'LCID', 'ENPH', 'PLUG',
  // High-Beta Tech
  'ROKU', 'DKNG', 'COIN', 'HOOD', 'AFRM', 'UPST',
  // Meme/Momentum
  'GME', 'AMC',
  // Risky Crypto
  'SOL', 'DOGE', 'SHIB', 'PEPE', 'AVAX', 'MATIC', 'DOT'
]);

const DEFENSIVE_SYMBOLS = new Set([
  // Utilities
  'NEE', 'DUK', 'SO', 'D', 'AEP', 'XEL',
  // REITs
  'AMT', 'PLD', 'CCI', 'EQIX', 'O',
  // Consumer Defensive
  'MCD', 'YUM', 'SBUX', 'CL', 'KMB',
  // Gold/Commodities
  'NEM', 'GOLD', 'FCX',
  // Pharma
  'LLY', 'BMY',
  // Defensive Crypto (Stablecoins conceptually, but using less volatile ones)
  'XRP', 'ADA', 'LINK', 'UNI', 'ATOM'
]);

/**
 * Determines the draft category for an asset
 * @param {string} symbol - Asset symbol
 * @returns {string} - 'steady', 'risky', or 'defensive'
 */
export function getAssetCategory(symbol) {
  const upperSymbol = symbol?.toUpperCase();
  if (STEADY_SYMBOLS.has(upperSymbol)) return 'steady';
  if (RISKY_SYMBOLS.has(upperSymbol)) return 'risky';
  if (DEFENSIVE_SYMBOLS.has(upperSymbol)) return 'defensive';
  // Default categorization based on common patterns
  return 'risky'; // Unknown assets default to risky
}

/**
 * Assigns tier labels, rationales, and categories to portfolio assets for Snake Draft
 *
 * @param {Array} portfolio - Array of portfolio assets with source property
 * @returns {Array} - Sorted portfolio with tier and category assignments
 */
export function assignTiersToPortfolio(portfolio) {
  // Sort by priority: user_selected first (by conviction), then diversification
  const sortedPortfolio = [
    ...portfolio.filter(p => p.source === 'user_selected'),
    ...portfolio.filter(p => p.source === 'diversification'),
  ];

  // Assign tiers and categories
  sortedPortfolio.forEach((asset, index) => {
    // Assign category if not already set
    if (!asset.draftCategory) {
      asset.draftCategory = getAssetCategory(asset.symbol);
    }

    // Assign tiers: Tier 1 (1-3), Tier 2 (4-6), Tier 3 (7+)
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
 * Generates the strategy summary text for Snake Draft with category organization
 *
 * @param {Array} sortedPortfolio - Portfolio with tier and category assignments
 * @param {Object} thesis - User's thesis with stance and sectors
 * @returns {string} - Formatted strategy text
 */
export function generateSnakeDraftStrategyText(sortedPortfolio, thesis) {
  // Group picks by tier and category
  const getPicksByTierAndCategory = (tier) => {
    const tierAssets = sortedPortfolio.filter(p => p.tier === tier);
    const steady = tierAssets.filter(p => p.draftCategory === 'steady').map(p => p.symbol);
    const risky = tierAssets.filter(p => p.draftCategory === 'risky').map(p => p.symbol);
    const defensive = tierAssets.filter(p => p.draftCategory === 'defensive').map(p => p.symbol);
    return { steady, risky, defensive };
  };

  const tier1 = getPicksByTierAndCategory(1);
  const tier2 = getPicksByTierAndCategory(2);
  const tier3 = getPicksByTierAndCategory(3);

  const formatCategoryPicks = (category, picks) => {
    if (picks.length === 0) return '';
    return `${category.toUpperCase()}: ${picks.join(', ')}`;
  };

  const formatTierPicks = (tierPicks) => {
    const parts = [
      formatCategoryPicks('Steady', tierPicks.steady),
      formatCategoryPicks('Risky', tierPicks.risky),
      formatCategoryPicks('Defensive', tierPicks.defensive)
    ].filter(p => p);
    return parts.length > 0 ? parts.join('\n') : 'None selected';
  };

  // Count categories in portfolio
  const categoryCounts = {
    steady: sortedPortfolio.filter(p => p.draftCategory === 'steady').length,
    risky: sortedPortfolio.filter(p => p.draftCategory === 'risky').length,
    defensive: sortedPortfolio.filter(p => p.draftCategory === 'defensive').length
  };

  return `🐍 SNAKE DRAFT STRATEGY

Based on your thesis: ${thesis?.stance || 'Bullish'} on ${thesis?.sectors?.join(', ') || 'Growth sectors'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔥 PRIORITY TIER 1 — Draft ASAP (Rounds 1-3)
Your highest-conviction picks. Draft these early or lose them.

${formatTierPicks(tier1)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚡ PRIORITY TIER 2 — Strong Alternatives (Rounds 4-6)
Solid backup options if Tier 1 picks are taken.

${formatTierPicks(tier2)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 TIER 3 — Category Fillers (Rounds 7-9)
Complete your roster with these remaining options.

${formatTierPicks(tier3)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 CATEGORY TRACKER
□ Steady: ${categoryCounts.steady}/3 needed
□ Risky: ${categoryCounts.risky}/3 needed
□ Defensive: ${categoryCounts.defensive}/3 needed

💡 DRAFT TIPS
• You MUST draft exactly 3 from each category
• Watch what opponents pick - adapt your strategy
• Tier 1 picks go fast - don't hesitate`;
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

  // Calculate category counts for display
  const categoryCounts = {
    steady: sortedPortfolio.filter(p => p.draftCategory === 'steady').length,
    risky: sortedPortfolio.filter(p => p.draftCategory === 'risky').length,
    defensive: sortedPortfolio.filter(p => p.draftCategory === 'defensive').length
  };

  return {
    strategySummary: strategyText,
    portfolio: sortedPortfolio,
    isSnakeDraft: true,
    categoryCounts, // Include category counts for UI display
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
