// src/services/earningsBotService.js
// Generates AI bot portfolios for tournament testing

// Bot personas with different strategies
const BOT_PERSONAS = [
  { name: 'TradeMaster', strategy: 'conservative', riskLevel: 'low', avatar: '🎯' },
  { name: 'EarningsKing', strategy: 'balanced', riskLevel: 'medium', avatar: '👑' },
  { name: 'BullRunner', strategy: 'aggressive', riskLevel: 'high', avatar: '🐂' },
  { name: 'BearHunter', strategy: 'contrarian', riskLevel: 'high', avatar: '🐻' },
  { name: 'SectorPro', strategy: 'sector-focus', riskLevel: 'medium', avatar: '📊' },
  { name: 'ValueSeeker', strategy: 'value', riskLevel: 'low', avatar: '💎' },
  { name: 'MomentumMax', strategy: 'momentum', riskLevel: 'high', avatar: '🚀' },
  { name: 'SteadyEddie', strategy: 'conservative', riskLevel: 'low', avatar: '🛡️' },
  { name: 'RiskTaker99', strategy: 'yolo', riskLevel: 'extreme', avatar: '🎰' },
  { name: 'AlphaChaser', strategy: 'aggressive', riskLevel: 'high', avatar: '⚡' },
  { name: 'DividendDan', strategy: 'conservative', riskLevel: 'low', avatar: '💰' },
  { name: 'GrowthGuru', strategy: 'balanced', riskLevel: 'medium', avatar: '📈' },
  { name: 'ContrarianKate', strategy: 'contrarian', riskLevel: 'high', avatar: '🔄' },
  { name: 'IndexIvan', strategy: 'balanced', riskLevel: 'low', avatar: '📋' },
  { name: 'SwingTrader', strategy: 'momentum', riskLevel: 'medium', avatar: '🎢' },
];

// Generate random username variations
const generateUsername = (basePersona) => {
  const suffixes = ['', '42', '99', 'Pro', 'X', '_trades', '2026', 'Alpha', 'Beta'];
  const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
  return `${basePersona.name}${suffix}`;
};

// Strategy-based outcome selection
const selectOutcome = (event, strategy) => {
  const beatOdds = event.beatOdds || 0.5;

  switch (strategy) {
    case 'conservative':
      // Favor the likely outcome
      return beatOdds >= 0.5 ? 'beat' : 'miss';
    case 'contrarian':
      // Go against the odds
      return beatOdds >= 0.5 ? 'miss' : 'beat';
    case 'aggressive':
    case 'yolo':
      // Random but slight preference for beat
      return Math.random() < 0.6 ? 'beat' : 'miss';
    case 'balanced':
    default:
      // Follow the odds with some randomness
      return Math.random() < beatOdds ? 'beat' : 'miss';
  }
};

// Strategy-based magnitude selection
const selectMagnitude = (strategy, riskLevel) => {
  const magnitudes = ['upBig', 'up', 'flat', 'down', 'downBig'];
  const weights = {
    conservative: { upBig: 0.05, up: 0.25, flat: 0.45, down: 0.20, downBig: 0.05 },
    balanced: { upBig: 0.10, up: 0.30, flat: 0.30, down: 0.20, downBig: 0.10 },
    aggressive: { upBig: 0.20, up: 0.30, flat: 0.20, down: 0.15, downBig: 0.15 },
    contrarian: { upBig: 0.15, up: 0.15, flat: 0.20, down: 0.25, downBig: 0.25 },
    yolo: { upBig: 0.30, up: 0.15, flat: 0.10, down: 0.15, downBig: 0.30 },
    momentum: { upBig: 0.25, up: 0.35, flat: 0.15, down: 0.15, downBig: 0.10 },
    value: { upBig: 0.10, up: 0.35, flat: 0.30, down: 0.20, downBig: 0.05 },
    'sector-focus': { upBig: 0.15, up: 0.30, flat: 0.25, down: 0.20, downBig: 0.10 },
  };

  const strategyWeights = weights[strategy] || weights.balanced;
  const random = Math.random();
  let cumulative = 0;

  for (const mag of magnitudes) {
    cumulative += strategyWeights[mag];
    if (random < cumulative) return mag;
  }
  return 'flat';
};

// Select precision tier based on risk level
const selectPrecisionTier = (riskLevel) => {
  const tiers = {
    low: { standard: 0.85, narrow: 0.12, bullseye: 0.03 },
    medium: { standard: 0.65, narrow: 0.25, bullseye: 0.10 },
    high: { standard: 0.45, narrow: 0.35, bullseye: 0.20 },
    extreme: { standard: 0.25, narrow: 0.35, bullseye: 0.40 },
  };

  const tierWeights = tiers[riskLevel] || tiers.medium;
  const random = Math.random();

  if (random < tierWeights.standard) return 'standard';
  if (random < tierWeights.standard + tierWeights.narrow) return 'narrow';
  return 'bullseye';
};

// Generate a single bot prediction for an event
const generateBotPrediction = (event, parlays, strategy, riskLevel) => {
  const outcome = selectOutcome(event, strategy);
  const magnitude = selectMagnitude(strategy, riskLevel);
  const precisionTier = selectPrecisionTier(riskLevel);

  // Find matching parlay
  const parlay = parlays.find(p =>
    p.outcome === outcome && p.magnitude === magnitude
  );

  if (!parlay) return null;

  // Get precision option with defensive fallbacks
  const precisionOption = parlay.precisionOptions?.find(p => p.tier === precisionTier)
    || parlay.precisionOptions?.[0]
    || {
      tier: 'standard',
      multiplier: parlay.baseMultiplier || 1.5,
      range: parlay.magnitudeRange || '±2%'
    };

  // Ensure tier is always defined
  const tierName = precisionOption?.tier || 'standard';

  return {
    eventId: event.id || `${event.symbol}_${event.reportDate}`,
    symbol: event.symbol,
    companyName: event.companyName,
    reportDate: event.reportDate,
    outcome: parlay.outcome,
    outcomeLabel: parlay.outcomeLabel,
    magnitude: parlay.magnitude,
    magnitudeLabel: parlay.magnitudeLabel,
    magnitudeEmoji: parlay.magnitudeEmoji,
    magnitudeRange: parlay.magnitudeRange,
    precisionTier: tierName,
    precisionLabel: tierName.charAt(0).toUpperCase() + tierName.slice(1),
    precisionRange: precisionOption.range || parlay.magnitudeRange,
    price: parlay.price,
    priceDisplay: parlay.priceDisplay,
    baseMultiplier: parlay.baseMultiplier,
    finalMultiplier: precisionOption.multiplier,
    potentialPayout: Math.round(parlay.price * precisionOption.multiplier),
    potentialPayoutDisplay: `$${Math.round(parlay.price * precisionOption.multiplier).toLocaleString()}`,
    risk: parlay.risk,
    combinedProb: parlay.combinedProb,
    outcomeOdds: parlay.outcomeOdds,
    reactionProb: parlay.reactionProb,
    sector: parlay.sector,
    addedAt: new Date().toISOString()
  };
};

// Generate a complete bot portfolio
export const generateBotPortfolio = (events, parlaysByEvent, persona) => {
  const { strategy, riskLevel } = persona;

  // Determine number of picks (3-8 based on strategy)
  const minPicks = 3;
  const maxPicks = riskLevel === 'extreme' ? 10 : riskLevel === 'high' ? 8 : 6;
  const numPicks = Math.floor(Math.random() * (maxPicks - minPicks + 1)) + minPicks;

  // Shuffle events and pick random ones
  const shuffledEvents = [...events].sort(() => Math.random() - 0.5);
  const selectedEvents = shuffledEvents.slice(0, Math.min(numPicks, shuffledEvents.length));

  const predictions = [];
  let totalSpent = 0;
  const budget = 10000;

  for (const event of selectedEvents) {
    const parlays = parlaysByEvent[event.symbol] || parlaysByEvent[event.id] || [];
    if (parlays.length === 0) continue;

    const prediction = generateBotPrediction(event, parlays, strategy, riskLevel);
    if (prediction && totalSpent + prediction.price <= budget) {
      predictions.push(prediction);
      totalSpent += prediction.price;
    }
  }

  if (predictions.length < 3) return null; // Invalid portfolio

  return {
    odUserId: `bot_${persona.name.toLowerCase()}_${Date.now()}`,
    username: generateUsername(persona),
    avatar: persona.avatar,
    isBot: true,
    predictions,
    totalSpent,
    totalPotentialPoints: predictions.reduce((sum, p) => sum + p.potentialPayout, 0),
    predictionCount: predictions.length,
    strategy: persona.strategy,
    riskLevel: persona.riskLevel
  };
};

// Generate multiple bot entries for a tournament
export const generateBotEntries = (events, parlaysByEvent, count = 10) => {
  const entries = [];
  const usedPersonas = new Set();

  for (let i = 0; i < count; i++) {
    // Pick a random persona (avoid duplicates if possible)
    let persona;
    let attempts = 0;
    do {
      persona = BOT_PERSONAS[Math.floor(Math.random() * BOT_PERSONAS.length)];
      attempts++;
    } while (usedPersonas.has(persona.name) && attempts < 20 && usedPersonas.size < BOT_PERSONAS.length);

    usedPersonas.add(persona.name);

    const portfolio = generateBotPortfolio(events, parlaysByEvent, persona);
    if (portfolio) {
      entries.push(portfolio);
    }
  }

  return entries;
};

// Simulate results for a bot's predictions (for testing)
export const simulateBotResults = (predictions) => {
  return predictions.map(pred => {
    // Random outcome - 40% chance of being correct
    const isCorrect = Math.random() < 0.4;
    const actualMove = isCorrect
      ? getRandomMoveInRange(pred.magnitude)
      : getRandomMoveOutsideRange(pred.magnitude);

    return {
      ...pred,
      resolved: true,
      actualMove,
      isCorrect,
      pointsEarned: isCorrect ? pred.potentialPayout : 0
    };
  });
};

// Helper to get random move within a magnitude range
const getRandomMoveInRange = (magnitude) => {
  const ranges = {
    upBig: [5, 15],
    up: [2, 5],
    flat: [-2, 2],
    down: [-5, -2],
    downBig: [-15, -5]
  };
  const [min, max] = ranges[magnitude] || [-2, 2];
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
};

// Helper to get random move outside a magnitude range
const getRandomMoveOutsideRange = (magnitude) => {
  const allMagnitudes = ['upBig', 'up', 'flat', 'down', 'downBig'];
  const others = allMagnitudes.filter(m => m !== magnitude);
  const randomMag = others[Math.floor(Math.random() * others.length)];
  return getRandomMoveInRange(randomMag);
};

export default {
  generateBotPortfolio,
  generateBotEntries,
  simulateBotResults,
  BOT_PERSONAS
};
