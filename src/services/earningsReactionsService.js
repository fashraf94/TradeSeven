/**
 * earningsReactionsService.js
 *
 * Provides historical earnings reaction data and calculates parlay prices.
 * Uses sector-based defaults with ability to enhance with real EODHD data.
 */

// Magnitude bands for price reactions
export const MAGNITUDE_BANDS = {
  UP_BIG: { id: 'upBig', label: 'Up Big', emoji: '🚀', range: '> +5%', min: 5, max: Infinity },
  UP: { id: 'up', label: 'Up', emoji: '📈', range: '+2% to +5%', min: 2, max: 5 },
  FLAT: { id: 'flat', label: 'Flat', emoji: '😐', range: '-2% to +2%', min: -2, max: 2 },
  DOWN: { id: 'down', label: 'Down', emoji: '📉', range: '-5% to -2%', min: -5, max: -2 },
  DOWN_BIG: { id: 'downBig', label: 'Down Big', emoji: '💥', range: '< -5%', min: -Infinity, max: -5 }
};

// Order for display
export const MAGNITUDE_ORDER = ['upBig', 'up', 'flat', 'down', 'downBig'];

// Sector-based default reaction probabilities
const SECTOR_DEFAULTS = {
  tech: {
    afterBeat: { upBig: 0.20, up: 0.25, flat: 0.25, down: 0.20, downBig: 0.10 },
    afterMiss: { upBig: 0.05, up: 0.10, flat: 0.15, down: 0.30, downBig: 0.40 }
  },
  financials: {
    afterBeat: { upBig: 0.10, up: 0.35, flat: 0.35, down: 0.15, downBig: 0.05 },
    afterMiss: { upBig: 0.05, up: 0.10, flat: 0.20, down: 0.40, downBig: 0.25 }
  },
  consumer: {
    afterBeat: { upBig: 0.15, up: 0.30, flat: 0.30, down: 0.18, downBig: 0.07 },
    afterMiss: { upBig: 0.05, up: 0.12, flat: 0.18, down: 0.35, downBig: 0.30 }
  },
  healthcare: {
    afterBeat: { upBig: 0.08, up: 0.30, flat: 0.40, down: 0.17, downBig: 0.05 },
    afterMiss: { upBig: 0.05, up: 0.15, flat: 0.25, down: 0.35, downBig: 0.20 }
  },
  industrial: {
    afterBeat: { upBig: 0.12, up: 0.32, flat: 0.32, down: 0.17, downBig: 0.07 },
    afterMiss: { upBig: 0.05, up: 0.10, flat: 0.20, down: 0.38, downBig: 0.27 }
  },
  energy: {
    afterBeat: { upBig: 0.18, up: 0.28, flat: 0.26, down: 0.18, downBig: 0.10 },
    afterMiss: { upBig: 0.06, up: 0.12, flat: 0.17, down: 0.32, downBig: 0.33 }
  },
  default: {
    afterBeat: { upBig: 0.12, up: 0.30, flat: 0.32, down: 0.18, downBig: 0.08 },
    afterMiss: { upBig: 0.05, up: 0.10, flat: 0.20, down: 0.35, downBig: 0.30 }
  }
};

// Symbol to sector mapping
const SYMBOL_SECTORS = {
  // Tech
  'NVDA': 'tech', 'AAPL': 'tech', 'MSFT': 'tech', 'GOOGL': 'tech', 'GOOG': 'tech',
  'META': 'tech', 'AMZN': 'tech', 'AMD': 'tech', 'INTC': 'tech', 'TSM': 'tech',
  'NFLX': 'tech', 'CRM': 'tech', 'ORCL': 'tech', 'ADBE': 'tech', 'CSCO': 'tech',
  'AVGO': 'tech', 'QCOM': 'tech', 'TXN': 'tech', 'MU': 'tech', 'AMAT': 'tech',

  // Financials
  'JPM': 'financials', 'BAC': 'financials', 'WFC': 'financials', 'GS': 'financials',
  'MS': 'financials', 'C': 'financials', 'BLK': 'financials', 'STT': 'financials',
  'PNC': 'financials', 'MTB': 'financials', 'BK': 'financials', 'USB': 'financials',
  'TFC': 'financials', 'SCHW': 'financials', 'AXP': 'financials', 'V': 'financials',
  'MA': 'financials', 'COF': 'financials', 'DFS': 'financials',

  // Consumer
  'WMT': 'consumer', 'TGT': 'consumer', 'COST': 'consumer', 'HD': 'consumer',
  'LOW': 'consumer', 'NKE': 'consumer', 'SBUX': 'consumer', 'MCD': 'consumer',
  'DAL': 'consumer', 'UAL': 'consumer', 'AAL': 'consumer', 'LUV': 'consumer',
  'MAR': 'consumer', 'HLT': 'consumer', 'DIS': 'consumer', 'CMCSA': 'consumer',
  'PEP': 'consumer', 'KO': 'consumer', 'PG': 'consumer',

  // Healthcare
  'JNJ': 'healthcare', 'PFE': 'healthcare', 'UNH': 'healthcare', 'MRK': 'healthcare',
  'ABBV': 'healthcare', 'LLY': 'healthcare', 'TMO': 'healthcare', 'ABT': 'healthcare',
  'BMY': 'healthcare', 'AMGN': 'healthcare', 'GILD': 'healthcare', 'CVS': 'healthcare',

  // Industrial
  'CAT': 'industrial', 'DE': 'industrial', 'BA': 'industrial', 'HON': 'industrial',
  'UPS': 'industrial', 'FDX': 'industrial', 'GE': 'industrial', 'MMM': 'industrial',
  'RTX': 'industrial', 'LMT': 'industrial',

  // Energy
  'XOM': 'energy', 'CVX': 'energy', 'COP': 'energy', 'SLB': 'energy',
  'EOG': 'energy', 'PXD': 'energy', 'OXY': 'energy', 'HAL': 'energy'
};

/**
 * Get sector for a symbol
 */
export function getSector(symbol) {
  return SYMBOL_SECTORS[symbol?.toUpperCase()] || 'default';
}

/**
 * Get reaction probabilities for a symbol
 */
export function getReactionProbabilities(symbol) {
  const sector = getSector(symbol);
  return SECTOR_DEFAULTS[sector] || SECTOR_DEFAULTS.default;
}

/**
 * Calculate multiplier based on combined probability
 */
export function getMultiplier(probability) {
  if (probability >= 0.30) return 1.3;
  if (probability >= 0.20) return 1.6;
  if (probability >= 0.10) return 2.2;
  if (probability >= 0.05) return 3.0;
  return 4.5;
}

/**
 * Get risk level label
 */
export function getRiskLevel(probability) {
  if (probability >= 0.30) return { level: 'low', label: 'Low Risk', color: '#10b981' };
  if (probability >= 0.20) return { level: 'medium', label: 'Medium', color: '#f59e0b' };
  if (probability >= 0.10) return { level: 'high', label: 'High Risk', color: '#f97316' };
  if (probability >= 0.05) return { level: 'veryHigh', label: 'Very High', color: '#ef4444' };
  return { level: 'extreme', label: 'Extreme', color: '#dc2626' };
}

/**
 * Calculate all parlay prices for an event
 */
export function calculateParlayPrices(event, budget = 10000) {
  const { yesOdds: beatOdds, noOdds: missOdds } = event;
  const reactions = getReactionProbabilities(event.symbol);

  const parlays = [];

  // Generate BEAT parlays
  MAGNITUDE_ORDER.forEach(magnitude => {
    const reactionProb = reactions.afterBeat[magnitude];
    const combinedProb = beatOdds * reactionProb;
    const price = Math.round(budget * combinedProb);
    const multiplier = getMultiplier(combinedProb);
    const potentialPoints = Math.round(price * multiplier);
    const risk = getRiskLevel(combinedProb);
    const band = Object.values(MAGNITUDE_BANDS).find(b => b.id === magnitude);

    parlays.push({
      id: `beat-${magnitude}`,
      outcome: 'beat',
      magnitude: magnitude,
      label: `Beat + ${band.label}`,
      emoji: band.emoji,
      range: band.range,
      beatOdds: beatOdds,
      reactionProb: reactionProb,
      combinedProb: combinedProb,
      price: price,
      multiplier: multiplier,
      potentialPoints: potentialPoints,
      risk: risk
    });
  });

  // Generate MISS parlays
  MAGNITUDE_ORDER.forEach(magnitude => {
    const reactionProb = reactions.afterMiss[magnitude];
    const combinedProb = missOdds * reactionProb;
    const price = Math.round(budget * combinedProb);
    const multiplier = getMultiplier(combinedProb);
    const potentialPoints = Math.round(price * multiplier);
    const risk = getRiskLevel(combinedProb);
    const band = Object.values(MAGNITUDE_BANDS).find(b => b.id === magnitude);

    parlays.push({
      id: `miss-${magnitude}`,
      outcome: 'miss',
      magnitude: magnitude,
      label: `Miss + ${band.label}`,
      emoji: band.emoji,
      range: band.range,
      missOdds: missOdds,
      reactionProb: reactionProb,
      combinedProb: combinedProb,
      price: price,
      multiplier: multiplier,
      potentialPoints: potentialPoints,
      risk: risk
    });
  });

  return parlays;
}

/**
 * Get summary stats for display
 */
export function getReactionSummary(symbol, beatOdds) {
  const reactions = getReactionProbabilities(symbol);
  const sector = getSector(symbol);

  // Calculate "goes up after beat" probability
  const upAfterBeat = reactions.afterBeat.upBig + reactions.afterBeat.up;
  const downAfterBeat = reactions.afterBeat.downBig + reactions.afterBeat.down;

  // Calculate "goes down after miss" probability
  const downAfterMiss = reactions.afterMiss.downBig + reactions.afterMiss.down;
  const upAfterMiss = reactions.afterMiss.upBig + reactions.afterMiss.up;

  return {
    sector: sector,
    upAfterBeat: Math.round(upAfterBeat * 100),
    downAfterBeat: Math.round(downAfterBeat * 100),
    flatAfterBeat: Math.round(reactions.afterBeat.flat * 100),
    downAfterMiss: Math.round(downAfterMiss * 100),
    upAfterMiss: Math.round(upAfterMiss * 100),
    flatAfterMiss: Math.round(reactions.afterMiss.flat * 100)
  };
}

/**
 * Enhance event with parlay data
 */
export function enhanceEventWithParlays(event, budget = 10000) {
  const parlays = calculateParlayPrices(event, budget);
  const summary = getReactionSummary(event.symbol, event.yesOdds);

  return {
    ...event,
    parlays: parlays,
    reactionSummary: summary,
    sector: summary.sector
  };
}

export default {
  MAGNITUDE_BANDS,
  MAGNITUDE_ORDER,
  getSector,
  getReactionProbabilities,
  calculateParlayPrices,
  getReactionSummary,
  enhanceEventWithParlays,
  getMultiplier,
  getRiskLevel
};
