// /src/services/recommendationEngine.js
// Thesis-based asset scoring and recommendation engine

/**
 * Calculate thesis alignment score for a single asset
 * @param {Object} asset - Asset with price data and metadata
 * @param {Object} thesis - User's thesis from Phase 2
 * @returns {Object} - { score, breakdown, alignment }
 */
export function calculateThesisAlignment(asset, thesis) {
  const scores = {
    sectorMatch: scoreSectorMatch(asset, thesis),
    momentumAlignment: scoreMomentumAlignment(asset, thesis),
    riskMatch: scoreRiskMatch(asset, thesis),
    timeframeFit: scoreTimeframeFit(asset, thesis),
    recencyBonus: scoreRecencyBonus(asset),
  };

  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);

  return {
    score: totalScore,
    breakdown: scores,
    alignment: totalScore >= 75 ? 'strong'
             : totalScore >= 50 ? 'moderate'
             : 'weak'
  };
}

/**
 * Component 1: Sector/Category Match (30 points max)
 */
function scoreSectorMatch(asset, thesis) {
  const assetSector = asset.sector || asset.category || 'Unknown';

  // User selected specific sectors
  if (thesis.sectors && thesis.sectors.length > 0) {
    // Check if asset's sector matches any selected sector
    const matches = thesis.sectors.some(s =>
      assetSector.toLowerCase().includes(s.toLowerCase()) ||
      s.toLowerCase().includes(assetSector.toLowerCase())
    );
    return matches ? 30 : 0;
  }

  // User skipped sector selection (open to anything)
  return 15;
}

/**
 * Component 2: Momentum Alignment (25 points max)
 */
function scoreMomentumAlignment(asset, thesis) {
  const change7d = parseFloat(asset.priceChange7d) || 0;

  if (thesis.stance === 'bullish') {
    if (change7d > 10) return 25;
    if (change7d > 5) return 20;
    if (change7d > 0) return 15;
    if (change7d > -5) return 8;
    return 0;

  } else if (thesis.stance === 'bearish') {
    // Bearish = defensive (can't short in MarketClash)
    // Reward stability
    if (Math.abs(change7d) < 2) return 25;
    if (Math.abs(change7d) < 5) return 18;
    return 10;

  } else {
    // Neutral - reward moderate movement
    if (Math.abs(change7d) >= 2 && Math.abs(change7d) <= 8) return 20;
    return 12;
  }
}

/**
 * Component 3: Risk Profile Match (25 points max)
 */
function scoreRiskMatch(asset, thesis) {
  const beta = parseFloat(asset.beta) || 1.0;
  const isCrypto = asset.category !== undefined;
  const category = asset.category || '';
  const isMeme = category === 'Meme';
  const isStablecoin = category === 'Stablecoin';

  if (thesis.risk === 'aggressive') {
    if (isMeme) return 25;
    if (isStablecoin) return 0;
    if (isCrypto) return 22;
    if (beta > 1.5) return 25;
    if (beta > 1.2) return 20;
    if (beta > 1.0) return 12;
    return 5;

  } else if (thesis.risk === 'conservative') {
    if (isStablecoin) return 25;
    if (isMeme) return 0;
    if (isCrypto && !isStablecoin) return 8;
    if (beta < 0.8) return 25;
    if (beta < 1.0) return 20;
    if (beta <= 1.2) return 12;
    return 5;

  } else {
    // Balanced
    if (isStablecoin) return 10;
    if (isMeme) return 10;
    if (isCrypto) return 18;
    if (beta >= 0.9 && beta <= 1.3) return 25;
    return 15;
  }
}

/**
 * Component 4: Battle Timeframe Fit (10 points max)
 */
function scoreTimeframeFit(asset, thesis) {
  const volatility = asset.volatility || 'medium';

  if (thesis.battleType === 'head-to-head') {
    // 24-hour - high movement is good
    if (volatility === 'high') return 10;
    if (volatility === 'medium') return 7;
    return 4;

  } else if (thesis.battleType === 'snake-draft') {
    // Week-long - stability slightly better
    if (volatility === 'low') return 10;
    if (volatility === 'medium') return 8;
    return 5;

  } else {
    return 7;
  }
}

/**
 * Component 5: Recency Bonus (10 points max)
 */
function scoreRecencyBonus(asset) {
  const change24h = Math.abs(parseFloat(asset.percentChange || asset.change24h) || 0);

  if (change24h > 5) return 10;
  if (change24h > 3) return 7;
  if (change24h > 1) return 4;
  return 1;
}

/**
 * Get top recommendations based on thesis
 * @param {Array} allAssets - All available assets with price data
 * @param {Object} thesis - User's thesis from Phase 2
 * @param {number} count - Number of recommendations to return
 * @returns {Array} - Top scored assets with thesis alignment data
 */
export function getRecommendations(allAssets, thesis, count = 6) {
  const scored = allAssets.map(asset => ({
    ...asset,
    thesisScore: calculateThesisAlignment(asset, thesis)
  }));

  // Sort by score descending
  scored.sort((a, b) => b.thesisScore.score - a.thesisScore.score);

  // Return top N
  return scored.slice(0, count);
}

/**
 * Generate generic explanation based on score breakdown
 * Used for instant display before Claude enhancement arrives
 */
export function generateGenericExplanation(asset, thesis) {
  const score = asset.thesisScore;
  const parts = [];

  // Sector match
  if (score.breakdown.sectorMatch >= 25) {
    parts.push(`Matches your ${thesis.sectors?.[0] || 'selected'} sector focus`);
  }

  // Momentum
  if (score.breakdown.momentumAlignment >= 20) {
    const direction = thesis.stance === 'bullish' ? 'upward' : 'stable';
    parts.push(`${direction} momentum aligns with your ${thesis.stance} thesis`);
  }

  // Risk
  if (score.breakdown.riskMatch >= 20) {
    parts.push(`volatility profile fits your ${thesis.risk} risk tolerance`);
  }

  // Combine into sentence
  if (parts.length === 0) {
    return `Moderate fit for your strategy.`;
  }

  return parts.join(', ').replace(/^./, s => s.toUpperCase()) + '.';
}

/**
 * Filter assets by sector/category
 */
export function filterBySector(assets, sectors) {
  if (!sectors || sectors.length === 0) return assets;

  return assets.filter(asset => {
    const assetSector = asset.sector || asset.category || '';
    return sectors.some(s =>
      assetSector.toLowerCase().includes(s.toLowerCase())
    );
  });
}

/**
 * Get all unique sectors from assets
 */
export function getAvailableSectors(assets) {
  const sectors = new Set();
  assets.forEach(asset => {
    if (asset.sector) sectors.add(asset.sector);
    if (asset.category) sectors.add(asset.category);
  });
  return Array.from(sectors);
}

export default {
  calculateThesisAlignment,
  getRecommendations,
  generateGenericExplanation,
  filterBySector,
  getAvailableSectors,
};
