/**
 * BaggerBomb Recommendation Engine
 * Generates stock recommendations based on selected sectors and risk style for BaggerBomb battles
 */

import { SECTORS } from '../constants/sectors';
import { getSectorStocks } from './sectorDataService';
import { calculateBreakoutProbability, calculateBustRisk } from './stockScoringService';

/**
 * Generate recommendations based on user preferences
 * @param {Object} params
 * @param {string} params.riskStyle - 'aggressive' | 'balanced' | 'conservative'
 * @param {string[]} params.selectedSectors - Array of sector IDs
 * @param {string[]} params.mustHavePicks - User's required stocks (Phase 3)
 * @returns {Promise<Object>} Recommendations object
 */
export const generateRecommendations = async ({
  riskStyle,
  selectedSectors,
  mustHavePicks = []
}) => {
  try {
    console.log('Generating BaggerBomb recommendations:', { riskStyle, selectedSectors });

    // Fetch all stocks from selected sectors
    const allStocks = [];

    for (const sectorId of selectedSectors) {
      const stocks = await getSectorStocks(sectorId);
      stocks.forEach(stock => {
        // Avoid duplicates
        if (!allStocks.find(s => s.symbol === stock.symbol)) {
          allStocks.push({
            ...stock,
            sectorId
          });
        }
      });
    }

    console.log(`Found ${allStocks.length} stocks from ${selectedSectors.length} sectors`);

    // Score stocks based on risk style
    const scoredStocks = await scoreStocksForRiskStyle(allStocks, riskStyle);

    // Separate into categories
    const breakoutCandidates = scoredStocks
      .filter(s => s.breakoutScore >= getBreakoutThreshold(riskStyle))
      .slice(0, 6);

    const safePlays = scoredStocks
      .filter(s => s.bustRisk <= getSafeThreshold(riskStyle) && s.breakoutScore >= 40)
      .sort((a, b) => a.bustRisk - b.bustRisk)
      .slice(0, 3);

    // Ensure we have crypto recommendation
    const cryptoRecommendation = getCryptoRecommendation(riskStyle);

    // Build final recommendations
    const recommendations = {
      breakoutCandidates,
      safePlays,
      cryptoRecommendation,
      totalStocksAnalyzed: allStocks.length,
      generatedAt: Date.now(),
      params: { riskStyle, selectedSectors }
    };

    // Generate strategy text (placeholder for Phase 3 Claude AI)
    recommendations.strategyText = generatePlaceholderStrategy(
      riskStyle,
      selectedSectors,
      breakoutCandidates,
      safePlays
    );

    return recommendations;
  } catch (error) {
    console.error('Error generating recommendations:', error);
    throw error;
  }
};

/**
 * Score stocks based on risk style
 */
const scoreStocksForRiskStyle = async (stocks, riskStyle) => {
  // For Phase 2, we score a subset to minimize API calls
  // Take top stocks from each sector by recent performance
  const topStocks = stocks
    .sort((a, b) => (b.change1W || 0) - (a.change1W || 0))
    .slice(0, 20);

  // Score each stock
  const scored = [];

  for (const stock of topStocks) {
    try {
      const [breakoutData, bustData] = await Promise.all([
        calculateBreakoutProbability(stock.symbol, stock.price),
        calculateBustRisk(stock.symbol, stock.price)
      ]);

      // Adjust score based on risk style
      let adjustedScore = breakoutData.score;

      if (riskStyle === 'aggressive') {
        // Favor high volatility, accept more risk
        adjustedScore = breakoutData.score * 1.1 - bustData.risk * 0.1;
      } else if (riskStyle === 'conservative') {
        // Penalize high risk more heavily
        adjustedScore = breakoutData.score - bustData.risk * 0.4;
      } else {
        // Balanced
        adjustedScore = breakoutData.score - bustData.risk * 0.25;
      }

      scored.push({
        ...stock,
        breakoutScore: breakoutData.score,
        bustRisk: bustData.risk,
        threshold: breakoutData.threshold,
        adjustedScore,
        breakoutInterpretation: breakoutData.interpretation,
        bustInterpretation: bustData.interpretation,
        indicators: breakoutData.indicators,
        factors: breakoutData.factors
      });
    } catch (error) {
      console.error(`Error scoring ${stock.symbol}:`, error);
    }
  }

  return scored.sort((a, b) => b.adjustedScore - a.adjustedScore);
};

/**
 * Get breakout score threshold based on risk style
 */
const getBreakoutThreshold = (riskStyle) => {
  switch (riskStyle) {
    case 'aggressive': return 55;
    case 'conservative': return 65;
    default: return 60; // balanced
  }
};

/**
 * Get safe play bust risk threshold based on risk style
 */
const getSafeThreshold = (riskStyle) => {
  switch (riskStyle) {
    case 'aggressive': return 50;
    case 'conservative': return 30;
    default: return 40; // balanced
  }
};

/**
 * Get crypto recommendation
 */
const getCryptoRecommendation = (riskStyle) => {
  const cryptoOptions = [
    { symbol: 'BTC', name: 'Bitcoin', volatility: 'medium' },
    { symbol: 'ETH', name: 'Ethereum', volatility: 'medium' },
    { symbol: 'SOL', name: 'Solana', volatility: 'high' },
    { symbol: 'ADA', name: 'Cardano', volatility: 'high' },
    { symbol: 'DOT', name: 'Polkadot', volatility: 'high' }
  ];

  // Select based on risk style
  if (riskStyle === 'aggressive') {
    return cryptoOptions.find(c => c.volatility === 'high') || cryptoOptions[2];
  } else if (riskStyle === 'conservative') {
    return cryptoOptions[0]; // BTC
  } else {
    return cryptoOptions[1]; // ETH
  }
};

/**
 * Generate placeholder strategy text
 * This will be replaced by Claude AI in Phase 3
 */
const generatePlaceholderStrategy = (riskStyle, sectors, breakoutCandidates, safePlays) => {
  const sectorNames = sectors.map(id => SECTORS[id]?.name || id).join(', ');
  const topPicks = breakoutCandidates.slice(0, 3).map(s => s.symbol).join(', ');

  const styleDescriptions = {
    aggressive: 'focusing on high-volatility stocks with strong momentum signals',
    balanced: 'balancing growth potential with risk management',
    conservative: 'prioritizing stable performers with lower bust risk'
  };

  return `Your ${riskStyle} game plan targets ${sectorNames}, ${styleDescriptions[riskStyle]}. Top breakout candidates include ${topPicks || 'stocks with strong technicals'}, each showing favorable technical setups for potential BaggerBomb hits. ${safePlays.length > 0 ? `For stability, consider ${safePlays.map(s => s.symbol).join(', ')} as defensive positions.` : ''} Full AI-generated insights coming in Phase 3!`;
};

/**
 * Build portfolio from recommendations
 * @param {Object} recommendations - From generateRecommendations
 * @returns {Array} Portfolio ready for battle creation
 */
export const buildPortfolioFromRecommendations = (recommendations) => {
  const { breakoutCandidates, safePlays, cryptoRecommendation } = recommendations;

  // Take top breakout candidates (5-6)
  const breakouts = breakoutCandidates?.slice(0, 6) || [];

  // Take safe plays (2-3)
  const safe = [...(safePlays || [])].slice(0, 3);

  // Combine to get 9 stocks
  let stocks = [...breakouts];

  // Fill remaining slots with safe plays
  while (stocks.length < 9 && safe.length > 0) {
    const nextSafe = safe.shift();
    if (nextSafe && !stocks.find(s => s.symbol === nextSafe.symbol)) {
      stocks.push(nextSafe);
    }
  }

  // If still not enough, add more breakout candidates
  if (breakoutCandidates) {
    let additionalIndex = 6;
    while (stocks.length < 9 && additionalIndex < breakoutCandidates.length) {
      const next = breakoutCandidates[additionalIndex];
      if (!stocks.find(s => s.symbol === next.symbol)) {
        stocks.push(next);
      }
      additionalIndex++;
    }
  }

  // Build portfolio format
  const portfolio = stocks.slice(0, 9).map(stock => ({
    symbol: stock.symbol,
    name: stock.name || stock.symbol,
    price: stock.price || 0,
    amount: 100000 // $100k each (9 stocks = $900k)
  }));

  // Add crypto
  if (cryptoRecommendation) {
    portfolio.push({
      symbol: cryptoRecommendation.symbol,
      name: cryptoRecommendation.name,
      price: 0, // Will be fetched
      amount: 100000 // $100k (10% of $1M)
    });
  }

  return portfolio;
};

export default {
  generateRecommendations,
  buildPortfolioFromRecommendations
};
