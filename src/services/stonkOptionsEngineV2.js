/**
 * Stonk Options Engine V2
 * Strike-based options with simplified pricing
 *
 * Key mechanics:
 * - Binary outcome: strike hit = payout, strike missed = lose entry
 * - Premium based on: distance OTM + time + volatility
 * - Payout multiplier = 1 / premium
 */

// ============================================
// CONFIGURATION
// ============================================

export const STONK_OPTIONS_CONFIG = {
  // Volatility tiers affect how likely strikes are to be hit
  volatilityTiers: {
    stable: {
      stocks: ['AAPL', 'MSFT', 'GOOGL', 'JNJ', 'PG', 'KO', 'WMT', 'V', 'MA', 'JPM', 'BAC'],
      multiplier: 0.6,
      strikeIncrements: [0.01, 0.025, 0.05, 0.075, 0.10], // 1% to 10%
      label: 'Stable',
      color: '#00d9ff',
      description: 'Blue chips - steady movers'
    },
    growth: {
      stocks: ['NVDA', 'AMD', 'META', 'AMZN', 'NFLX', 'CRM', 'ADBE', 'SHOP', 'SQ', 'PYPL'],
      multiplier: 1.0,
      strikeIncrements: [0.02, 0.05, 0.08, 0.12, 0.18], // 2% to 18%
      label: 'Growth',
      color: '#fbbf24',
      description: 'Tech growth - moderate swings'
    },
    volatile: {
      stocks: ['TSLA', 'GME', 'AMC', 'COIN', 'MSTR', 'RIVN', 'MARA', 'PLTR', 'HOOD'],
      multiplier: 1.4,
      strikeIncrements: [0.03, 0.07, 0.12, 0.18, 0.25], // 3% to 25%
      label: 'Volatile',
      color: '#ef4444',
      description: 'Meme stocks - wild rides'
    }
  },

  // Available expiry durations
  expiryOptions: [
    { days: 1,  label: '1 Day',    shortLabel: '1D',  timeFactor: 0.38, tier: 'short' },
    { days: 3,  label: '3 Days',   shortLabel: '3D',  timeFactor: 0.65, tier: 'short' },
    { days: 7,  label: '1 Week',   shortLabel: '7D',  timeFactor: 1.0,  tier: 'medium' },
    { days: 14, label: '2 Weeks',  shortLabel: '14D', timeFactor: 1.41, tier: 'long' },
    { days: 21, label: '3 Weeks',  shortLabel: '21D', timeFactor: 1.73, tier: 'long' },
    { days: 28, label: '4 Weeks',  shortLabel: '28D', timeFactor: 2.0,  tier: 'long' }
  ],

  // House edge (added to premium)
  houseEdge: 0.08, // 8%

  // Premium bounds
  minPremium: 0.03,  // 3% minimum (33x max payout)
  maxPremium: 0.85,  // 85% maximum (1.18x min payout)

  // Position limits
  minPosition: 100,
  maxPosition: 5000,
  maxPositionsPerUser: 10
};

// ============================================
// EXPIRY TIER CONFIGURATION
// ============================================

export const EXPIRY_TIERS = {
  short:  { expiries: [1, 3],       minRequired: 2, maxAllowed: 2, label: 'Short-term (1-3 days)' },
  medium: { expiries: [7],          minRequired: 3, maxAllowed: 3, label: 'Medium-term (1 week)' },
  long:   { expiries: [14, 21, 28], minRequired: 2, maxAllowed: 2, label: 'Long-term (2-4 weeks)' }
};
// Total: exactly 7 contracts required (2+3+2)

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get volatility tier for a stock symbol
 */
export const getVolatilityTier = (symbol) => {
  const upperSymbol = symbol.toUpperCase();
  for (const [tier, config] of Object.entries(STONK_OPTIONS_CONFIG.volatilityTiers)) {
    if (config.stocks.includes(upperSymbol)) {
      return { tier, ...config };
    }
  }
  // Default to growth tier for unknown stocks
  return { tier: 'growth', ...STONK_OPTIONS_CONFIG.volatilityTiers.growth };
};

/**
 * Generate strike prices for a stock
 * Returns array of strikes for both calls and puts
 */
export const generateStrikes = (currentPrice, symbol) => {
  const tierInfo = getVolatilityTier(symbol);
  const increments = tierInfo.strikeIncrements;

  const calls = increments.map(pct => ({
    strike: Math.round(currentPrice * (1 + pct) * 100) / 100,
    distancePercent: pct * 100,
    direction: 'call'
  }));

  const puts = increments.map(pct => ({
    strike: Math.round(currentPrice * (1 - pct) * 100) / 100,
    distancePercent: pct * 100,
    direction: 'put'
  }));

  return { calls, puts, tierInfo };
};

/**
 * Get time factor for expiry
 */
export const getTimeFactor = (days) => {
  const expiry = STONK_OPTIONS_CONFIG.expiryOptions.find(e => e.days === days);
  if (expiry) return expiry.timeFactor;
  // Calculate for custom days
  return Math.sqrt(days / 7);
};

// ============================================
// PREMIUM CALCULATION
// ============================================

/**
 * Calculate premium for an option
 * Premium = probability of hitting + house edge
 * Lower premium = higher payout multiplier
 */
export const calculatePremium = ({
  currentPrice,
  strikePrice,
  direction,
  daysToExpiry,
  volatilityTier
}) => {
  // Calculate distance from current price (as decimal)
  const distanceOTM = Math.abs(strikePrice - currentPrice) / currentPrice;

  // Get volatility multiplier
  const tierConfig = STONK_OPTIONS_CONFIG.volatilityTiers[volatilityTier];
  const volMultiplier = tierConfig?.multiplier || 1.0;

  // Get time factor (more time = higher probability)
  const timeFactor = getTimeFactor(daysToExpiry);

  // Base probability estimate
  // ATM (0% OTM) starts at 50%, decreases with distance
  // Each 1% OTM reduces base prob by ~4%
  const baseProb = Math.max(0.02, 0.50 - (distanceOTM * 4));

  // Adjust for volatility and time
  const adjustedProb = baseProb * timeFactor * volMultiplier;

  // Add house edge
  const premium = adjustedProb + STONK_OPTIONS_CONFIG.houseEdge;

  // Clamp to bounds
  const clampedPremium = Math.min(
    STONK_OPTIONS_CONFIG.maxPremium,
    Math.max(STONK_OPTIONS_CONFIG.minPremium, premium)
  );

  // Calculate payout multiplier
  const payoutMultiplier = 1 / clampedPremium;

  return {
    premium: Math.round(clampedPremium * 1000) / 1000,
    premiumPercent: Math.round(clampedPremium * 100 * 10) / 10,
    payoutMultiplier: Math.round(payoutMultiplier * 100) / 100,
    baseProb: Math.round(baseProb * 100),
    adjustedProb: Math.round(adjustedProb * 100),
    distanceOTM: Math.round(distanceOTM * 1000) / 10 // As percentage
  };
};

/**
 * Calculate full pricing for a potential contract
 */
export const calculateContractPricing = ({
  symbol,
  currentPrice,
  strikePrice,
  direction,
  daysToExpiry,
  entryAmount
}) => {
  const tierInfo = getVolatilityTier(symbol);

  const premiumCalc = calculatePremium({
    currentPrice,
    strikePrice,
    direction,
    daysToExpiry,
    volatilityTier: tierInfo.tier
  });

  const potentialPayout = Math.round((entryAmount / premiumCalc.premium) * 100) / 100;
  const potentialProfit = potentialPayout - entryAmount;

  // Determine if ITM or OTM
  const isITM = direction === 'call'
    ? currentPrice >= strikePrice
    : currentPrice <= strikePrice;

  return {
    ...premiumCalc,
    entryAmount,
    potentialPayout,
    potentialProfit,
    isITM,
    tierInfo,
    breakEvenMove: direction === 'call'
      ? ((strikePrice - currentPrice) / currentPrice * 100).toFixed(2)
      : ((currentPrice - strikePrice) / currentPrice * 100).toFixed(2)
  };
};

// ============================================
// CONTRACT CREATION
// ============================================

/**
 * Create a new Stonk Options contract
 */
export const createContract = ({
  symbol,
  currentPrice,
  strikePrice,
  direction,
  daysToExpiry,
  entryAmount,
  timestamp = Date.now()
}) => {
  const tierInfo = getVolatilityTier(symbol);
  const pricing = calculateContractPricing({
    symbol,
    currentPrice,
    strikePrice,
    direction,
    daysToExpiry,
    entryAmount
  });

  // Calculate expiry timestamp (end of day)
  const expiryDate = new Date(timestamp);
  expiryDate.setDate(expiryDate.getDate() + daysToExpiry);
  expiryDate.setHours(16, 0, 0, 0); // 4 PM market close

  return {
    // Identity
    id: `${symbol.toLowerCase()}-${direction}-${strikePrice}-${timestamp}`,

    // Core parameters
    symbol: symbol.toUpperCase(),
    direction,
    strike: strikePrice,
    entryPrice: currentPrice,

    // Financial
    entryAmount,
    premium: pricing.premium,
    premiumPercent: pricing.premiumPercent,
    potentialPayout: pricing.potentialPayout,
    payoutMultiplier: pricing.payoutMultiplier,

    // Timing
    createdAt: timestamp,
    expiryTime: expiryDate.getTime(),
    daysToExpiry,
    expiryDisplay: expiryDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }),

    // Classification
    volatilityTier: tierInfo.tier,
    tierLabel: tierInfo.label,
    tierColor: tierInfo.color,
    distanceOTM: pricing.distanceOTM,

    // Status
    status: 'active', // 'active', 'won', 'lost', 'expired'
    settlementPrice: null,
    finalPayout: null,
    settledAt: null,

    // For display
    directionLabel: direction === 'call' ? 'CALL' : 'PUT',
    directionEmoji: direction === 'call' ? '📈' : '📉',
    contractName: `${symbol} $${strikePrice} ${direction.toUpperCase()}`
  };
};

// ============================================
// CONTRACT VALUATION (LIVE)
// ============================================

/**
 * Calculate current estimated value of a contract before expiry
 */
export const calculateLiveValue = (contract, currentPrice, currentTime = Date.now()) => {
  // Time remaining
  const msRemaining = contract.expiryTime - currentTime;
  const daysRemaining = Math.max(0, msRemaining / (24 * 60 * 60 * 1000));
  const timeRatio = daysRemaining / contract.daysToExpiry;

  // Check if expired
  if (msRemaining <= 0) {
    return settleContract(contract, currentPrice, currentTime);
  }

  // Distance to strike (positive = good for this direction)
  const distanceToStrike = contract.direction === 'call'
    ? (currentPrice - contract.strike) / contract.strike
    : (contract.strike - currentPrice) / contract.strike;

  // Probability of winning (simplified)
  let winProbability;

  if (distanceToStrike >= 0) {
    // Already ITM - high probability but not guaranteed
    winProbability = Math.min(0.95, 0.60 + (distanceToStrike * 2) + (timeRatio * 0.2));
  } else {
    // OTM - probability based on distance and time
    const distancePercent = Math.abs(distanceToStrike);
    winProbability = Math.max(0.05,
      (0.40 - distancePercent * 3) * timeRatio *
      (STONK_OPTIONS_CONFIG.volatilityTiers[contract.volatilityTier]?.multiplier || 1)
    );
  }

  // Estimated value = probability-weighted outcome
  const estimatedValue = contract.potentialPayout * winProbability;
  const currentValue = Math.round(Math.max(estimatedValue, contract.entryAmount * 0.05) * 100) / 100;

  // P/L calculations
  const profitLoss = currentValue - contract.entryAmount;
  const percentReturn = (profitLoss / contract.entryAmount) * 100;

  // Format time remaining
  let timeDisplay;
  if (daysRemaining >= 1) {
    timeDisplay = `${Math.ceil(daysRemaining)}d remaining`;
  } else {
    const hoursRemaining = Math.ceil(daysRemaining * 24);
    timeDisplay = `${hoursRemaining}h remaining`;
  }

  return {
    currentPrice,
    currentValue,
    profitLoss: Math.round(profitLoss * 100) / 100,
    percentReturn: Math.round(percentReturn * 10) / 10,

    // Position status
    isITM: distanceToStrike >= 0,
    distanceToStrike: Math.round(distanceToStrike * 10000) / 100, // As percentage
    winProbability: Math.round(winProbability * 100),

    // Time
    daysRemaining: Math.round(daysRemaining * 10) / 10,
    timeDisplay,
    timeRatio: Math.round(timeRatio * 100),
    isExpired: false,

    // Status
    status: 'active',
    isWinning: profitLoss > 0
  };
};

// ============================================
// SETTLEMENT
// ============================================

/**
 * Settle a contract at expiry
 */
export const settleContract = (contract, settlementPrice, settlementTime = Date.now()) => {
  // Determine if strike was hit
  const strikeHit = contract.direction === 'call'
    ? settlementPrice >= contract.strike
    : settlementPrice <= contract.strike;

  // Calculate final payout
  const finalPayout = strikeHit ? contract.potentialPayout : 0;
  const profitLoss = finalPayout - contract.entryAmount;
  const percentReturn = (profitLoss / contract.entryAmount) * 100;

  return {
    currentPrice: settlementPrice,
    currentValue: finalPayout,
    profitLoss: Math.round(profitLoss * 100) / 100,
    percentReturn: Math.round(percentReturn * 10) / 10,

    // Settlement details
    strikeHit,
    settlementPrice,
    finalPayout,

    // Status
    status: strikeHit ? 'won' : 'lost',
    isExpired: true,
    isWinning: strikeHit,

    // Time
    daysRemaining: 0,
    timeDisplay: 'Expired',
    timeRatio: 0,

    // For display
    resultEmoji: strikeHit ? '🎉' : '💀',
    resultText: strikeHit
      ? `Won $${finalPayout.toFixed(2)}!`
      : `Lost $${contract.entryAmount.toFixed(2)}`
  };
};

// ============================================
// PORTFOLIO FUNCTIONS
// ============================================

/**
 * Calculate total portfolio value and P/L
 */
export const calculatePortfolio = (contracts, currentPrices) => {
  let totalEntry = 0;
  let totalCurrent = 0;
  let totalPotential = 0;
  const updatedContracts = [];

  for (const contract of contracts) {
    const price = currentPrices[contract.symbol] || contract.entryPrice;
    const valuation = calculateLiveValue(contract, price);

    totalEntry += contract.entryAmount;
    totalCurrent += valuation.currentValue;
    totalPotential += contract.potentialPayout;

    updatedContracts.push({
      ...contract,
      ...valuation
    });
  }

  const totalPL = totalCurrent - totalEntry;
  const totalReturn = totalEntry > 0 ? (totalPL / totalEntry) * 100 : 0;

  return {
    contracts: updatedContracts,
    summary: {
      totalEntry: Math.round(totalEntry * 100) / 100,
      totalCurrent: Math.round(totalCurrent * 100) / 100,
      totalPotential: Math.round(totalPotential * 100) / 100,
      totalPL: Math.round(totalPL * 100) / 100,
      totalReturn: Math.round(totalReturn * 10) / 10,
      positionCount: contracts.length,
      activeCount: contracts.filter(c => c.status === 'active').length,
      wonCount: contracts.filter(c => c.status === 'won').length,
      lostCount: contracts.filter(c => c.status === 'lost').length
    }
  };
};

// ============================================
// VALIDATION
// ============================================

/**
 * Validate contract parameters before creation
 */
export const validateContract = (params) => {
  const errors = [];
  const { symbol, strikePrice, direction, daysToExpiry, entryAmount, currentPrice } = params;

  if (!symbol) errors.push('Stock symbol required');
  if (!strikePrice || strikePrice <= 0) errors.push('Valid strike price required');
  if (!['call', 'put'].includes(direction)) errors.push('Direction must be call or put');
  if (!currentPrice || currentPrice <= 0) errors.push('Current price required');

  // Validate expiry
  const validExpiries = STONK_OPTIONS_CONFIG.expiryOptions.map(e => e.days);
  if (!validExpiries.includes(daysToExpiry)) {
    errors.push(`Expiry must be one of: ${validExpiries.join(', ')} days`);
  }

  // Validate amount
  if (entryAmount < STONK_OPTIONS_CONFIG.minPosition) {
    errors.push(`Minimum position: $${STONK_OPTIONS_CONFIG.minPosition}`);
  }
  if (entryAmount > STONK_OPTIONS_CONFIG.maxPosition) {
    errors.push(`Maximum position: $${STONK_OPTIONS_CONFIG.maxPosition}`);
  }

  // Validate strike makes sense for direction
  if (direction === 'call' && strikePrice < currentPrice * 0.95) {
    errors.push('Call strike should be at or above current price');
  }
  if (direction === 'put' && strikePrice > currentPrice * 1.05) {
    errors.push('Put strike should be at or below current price');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// ============================================
// TOURNAMENT PORTFOLIO VALIDATION
// ============================================

/**
 * Validate a portfolio for tournament entry
 * Enforces tier diversification requirements
 */
export const validateTournamentPortfolio = (contracts) => {
  const errors = [];
  const tierCounts = { short: 0, medium: 0, long: 0 };

  // Count contracts per tier
  for (const contract of contracts) {
    const expiry = contract.daysToExpiry;
    if ([1, 3].includes(expiry)) tierCounts.short++;
    else if (expiry === 7) tierCounts.medium++;
    else if ([14, 21, 28].includes(expiry)) tierCounts.long++;
  }

  // Check minimums
  if (tierCounts.short < EXPIRY_TIERS.short.minRequired) {
    errors.push(`Short-term: Need ${EXPIRY_TIERS.short.minRequired - tierCounts.short} more (1D or 3D expiry)`);
  }
  if (tierCounts.medium < EXPIRY_TIERS.medium.minRequired) {
    errors.push(`Medium-term: Need ${EXPIRY_TIERS.medium.minRequired - tierCounts.medium} more (7D expiry)`);
  }
  if (tierCounts.long < EXPIRY_TIERS.long.minRequired) {
    errors.push(`Long-term: Need ${EXPIRY_TIERS.long.minRequired - tierCounts.long} more (14D, 21D, or 28D expiry)`);
  }

  // Check maximums
  if (tierCounts.short > EXPIRY_TIERS.short.maxAllowed) {
    errors.push(`Short-term: Maximum ${EXPIRY_TIERS.short.maxAllowed} allowed (have ${tierCounts.short})`);
  }
  if (tierCounts.medium > EXPIRY_TIERS.medium.maxAllowed) {
    errors.push(`Medium-term: Maximum ${EXPIRY_TIERS.medium.maxAllowed} allowed (have ${tierCounts.medium})`);
  }
  if (tierCounts.long > EXPIRY_TIERS.long.maxAllowed) {
    errors.push(`Long-term: Maximum ${EXPIRY_TIERS.long.maxAllowed} allowed (have ${tierCounts.long})`);
  }

  // Check total (exactly 7 = 2 short + 3 medium + 2 long)
  const requiredContracts = EXPIRY_TIERS.short.maxAllowed + EXPIRY_TIERS.medium.maxAllowed + EXPIRY_TIERS.long.maxAllowed;
  const total = tierCounts.short + tierCounts.medium + tierCounts.long;
  if (total < requiredContracts) {
    errors.push(`Need ${requiredContracts - total} more contracts (exactly ${requiredContracts} required)`);
  }
  if (total > requiredContracts) {
    errors.push(`Too many contracts: ${total} (exactly ${requiredContracts} required)`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    tierCounts,
    totalContracts: contracts.length,
    requirements: {
      short: { min: EXPIRY_TIERS.short.minRequired, max: EXPIRY_TIERS.short.maxAllowed, current: tierCounts.short },
      medium: { min: EXPIRY_TIERS.medium.minRequired, max: EXPIRY_TIERS.medium.maxAllowed, current: tierCounts.medium },
      long: { min: EXPIRY_TIERS.long.minRequired, max: EXPIRY_TIERS.long.maxAllowed, current: tierCounts.long }
    }
  };
};

/**
 * Calculate mark-to-market value for a contract
 * Simplified wrapper around calculateLiveValue for tournament scoring
 */
export const calculateMarkToMarket = (contract, currentPrice) => {
  const liveValue = calculateLiveValue(contract, currentPrice, Date.now());
  return {
    currentValue: liveValue.currentValue,
    profitLoss: liveValue.profitLoss,
    percentReturn: liveValue.percentReturn
  };
};

// ============================================
// EXPORT
// ============================================

export default {
  STONK_OPTIONS_CONFIG,
  EXPIRY_TIERS,
  getVolatilityTier,
  generateStrikes,
  getTimeFactor,
  calculatePremium,
  calculateContractPricing,
  createContract,
  calculateLiveValue,
  settleContract,
  calculatePortfolio,
  validateContract,
  validateTournamentPortfolio,
  calculateMarkToMarket
};
