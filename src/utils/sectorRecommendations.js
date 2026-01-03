// src/utils/sectorRecommendations.js
// Smart sector recommendations based on market stance and risk style

/**
 * Market stance based sector recommendations
 * These are the top sectors to recommend based on current market conditions
 */
export const MARKET_STANCE_SECTORS = {
  bullish: {
    aggressive: ['XLK', 'XLY', 'XLC'], // Tech, Consumer Discretionary, Communications
    balanced: ['XLK', 'XLF', 'XLI'],   // Tech, Financials, Industrials
    conservative: ['XLV', 'XLP', 'XLU'] // Healthcare, Consumer Staples, Utilities
  },
  neutral: {
    aggressive: ['XLK', 'XLE', 'XLF'], // Tech, Energy, Financials
    balanced: ['XLV', 'XLI', 'XLK'],   // Healthcare, Industrials, Tech
    conservative: ['XLV', 'XLP', 'XLRE'] // Healthcare, Consumer Staples, Real Estate
  },
  bearish: {
    aggressive: ['XLE', 'XLU', 'XLV'], // Energy, Utilities, Healthcare
    balanced: ['XLP', 'XLV', 'XLU'],   // Consumer Staples, Healthcare, Utilities
    conservative: ['XLU', 'XLP', 'XLV'] // Utilities, Consumer Staples, Healthcare
  }
};

/**
 * Get recommended sectors based on market stance and risk style
 * @param {string} marketStance - 'bullish', 'neutral', or 'bearish'
 * @param {string} riskStyle - 'aggressive', 'balanced', or 'conservative'
 * @returns {string[]} Array of sector IDs
 */
export const getRecommendedSectors = (marketStance = 'neutral', riskStyle = 'balanced') => {
  const stanceConfig = MARKET_STANCE_SECTORS[marketStance] || MARKET_STANCE_SECTORS.neutral;
  return stanceConfig[riskStyle] || stanceConfig.balanced;
};

/**
 * Sector display order by category
 */
export const SECTOR_CATEGORIES = {
  growth: ['XLK', 'XLY', 'XLC'],     // Growth sectors
  value: ['XLF', 'XLI', 'XLB'],      // Value/cyclical sectors
  defensive: ['XLV', 'XLP', 'XLU'], // Defensive sectors
  specialty: ['XLE', 'XLRE']         // Specialty sectors
};

/**
 * Get all sectors organized by category with recommended ones first
 * @param {string[]} recommendedSectors - Array of recommended sector IDs
 * @returns {Object} Object with recommended and other sectors
 */
export const getSectorsWithPriority = (recommendedSectors = []) => {
  const allSectors = ['XLK', 'XLV', 'XLF', 'XLE', 'XLY', 'XLP', 'XLI', 'XLB', 'XLU', 'XLRE', 'XLC'];

  return {
    recommended: recommendedSectors,
    other: allSectors.filter(s => !recommendedSectors.includes(s))
  };
};

/**
 * Get sector tab categories for display
 * @param {string[]} recommendedSectors - Array of recommended sector IDs
 * @returns {Object[]} Array of tab objects
 */
export const getSectorTabs = (recommendedSectors = []) => {
  return [
    {
      id: 'recommended',
      label: 'Recommended',
      emoji: '🎯',
      sectors: recommendedSectors
    },
    {
      id: 'growth',
      label: 'Growth',
      emoji: '🚀',
      sectors: SECTOR_CATEGORIES.growth.filter(s => !recommendedSectors.includes(s))
    },
    {
      id: 'value',
      label: 'Value',
      emoji: '💼',
      sectors: SECTOR_CATEGORIES.value.filter(s => !recommendedSectors.includes(s))
    },
    {
      id: 'defensive',
      label: 'Defensive',
      emoji: '🛡️',
      sectors: SECTOR_CATEGORIES.defensive.filter(s => !recommendedSectors.includes(s))
    },
    {
      id: 'specialty',
      label: 'Specialty',
      emoji: '⚡',
      sectors: SECTOR_CATEGORIES.specialty.filter(s => !recommendedSectors.includes(s))
    }
  ].filter(tab => tab.sectors.length > 0); // Remove empty tabs
};

export default {
  getRecommendedSectors,
  getSectorsWithPriority,
  getSectorTabs,
  MARKET_STANCE_SECTORS,
  SECTOR_CATEGORIES
};
