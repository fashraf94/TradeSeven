// src/services/optionsBotService.js
// Bot competitor generation for Options Tournaments

import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { createContract, STONK_OPTIONS_CONFIG } from './stonkOptionsEngineV2';
import { clearOptionsBotEntries } from '../firebase/firebaseService';

// Fun trading-themed bot names
const BOT_NAMES = [
  'ThetaGang_Tyler',
  'DiamondHands_Dan',
  'YOLO_Yolanda',
  'Tendies_Tom',
  'GammaQueen',
  'VegaVictor',
  'BullishBrenda',
  'BearishBob',
  'WheelStrategy_Will',
  'CoveredCall_Carl',
  'IronCondor_Irene',
  'Straddle_Steve',
  'DeltaNeutral_Diana',
  'ExpiredWorthless_Eddie',
  'ITM_Isabella',
  'OTM_Oliver',
  'PremiumPaula',
  'AssignmentAndy',
  'RollOver_Rachel',
  'SpreadKing_Kyle'
];

// Stock universe for bots
const BOT_STOCK_UNIVERSE = ['TSLA', 'NVDA', 'AMD', 'AAPL', 'MSFT', 'META', 'AMZN', 'GOOGL', 'GME', 'COIN'];

// Bot personality types
const BOT_PERSONALITIES = {
  aggressive: {
    stockPreference: ['TSLA', 'GME', 'COIN', 'NVDA'],
    expiryPreference: [1, 3],  // Short-term
    positionSizeRange: [800, 2000],
    directionBias: null  // Random
  },
  conservative: {
    stockPreference: ['AAPL', 'MSFT', 'GOOGL', 'AMZN'],
    expiryPreference: [14, 21, 28],  // Long-term
    positionSizeRange: [300, 800],
    directionBias: null
  },
  bullish: {
    stockPreference: BOT_STOCK_UNIVERSE,
    expiryPreference: [7, 14],
    positionSizeRange: [500, 1500],
    directionBias: 'call'  // 80% calls
  },
  bearish: {
    stockPreference: BOT_STOCK_UNIVERSE,
    expiryPreference: [7, 14],
    positionSizeRange: [500, 1500],
    directionBias: 'put'  // 80% puts
  },
  balanced: {
    stockPreference: BOT_STOCK_UNIVERSE,
    expiryPreference: [3, 7, 14],
    positionSizeRange: [400, 1200],
    directionBias: null
  }
};

// Utility functions
const randomChoice = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomFloat = (min, max) => Math.random() * (max - min) + min;

// Get random personality
const getRandomPersonality = () => {
  const types = Object.keys(BOT_PERSONALITIES);
  return BOT_PERSONALITIES[randomChoice(types)];
};

// Generate strike price based on direction and current price
const generateStrike = (currentPrice, direction, volatilityTier) => {
  // Strike distance varies by volatility
  const distances = {
    stable: { call: [0.98, 1.05], put: [0.95, 1.02] },
    growth: { call: [0.95, 1.10], put: [0.90, 1.05] },
    volatile: { call: [0.90, 1.15], put: [0.85, 1.10] }
  };

  const range = distances[volatilityTier]?.[direction] || distances.growth[direction];
  const multiplier = randomFloat(range[0], range[1]);

  // Round to nearest dollar
  return Math.round(currentPrice * multiplier);
};

// Generate a single bot contract
const generateBotContract = (stockPrices, personality, timestamp) => {
  const symbol = randomChoice(personality.stockPreference.filter(s => stockPrices[s]));
  if (!symbol) return null;

  const currentPrice = stockPrices[symbol];
  const expiry = randomChoice(personality.expiryPreference);

  // Determine direction (with optional bias)
  let direction;
  if (personality.directionBias && Math.random() < 0.8) {
    direction = personality.directionBias;
  } else {
    direction = Math.random() < 0.5 ? 'call' : 'put';
  }

  // Get volatility tier for this stock
  const tierInfo = Object.entries(STONK_OPTIONS_CONFIG.volatilityTiers)
    .find(([_, config]) => config.stocks.includes(symbol));
  const volatilityTier = tierInfo ? tierInfo[0] : 'growth';

  const strikePrice = generateStrike(currentPrice, direction, volatilityTier);
  const entryAmount = randomInt(personality.positionSizeRange[0], personality.positionSizeRange[1]);

  return createContract({
    symbol,
    currentPrice,
    strikePrice,
    direction,
    daysToExpiry: expiry,
    entryAmount,
    timestamp
  });
};

/**
 * Generate complete bot portfolio meeting tier requirements
 * @param {Object} stockPrices - Map of symbol -> current price
 * @returns {Object} - { contracts, totalEntry, personality }
 */
export const generateBotPortfolio = (stockPrices) => {
  const personality = getRandomPersonality();
  const timestamp = Date.now();
  const contracts = [];
  let totalSpent = 0;
  const maxBudget = 9500; // Leave some cash buffer

  // Tier requirements: short: 2, medium: 3, long: 2
  const tierRequirements = {
    short: { expiries: [1, 3], needed: 2, count: 0 },
    medium: { expiries: [7], needed: 3, count: 0 },
    long: { expiries: [14, 21, 28], needed: 2, count: 0 }
  };

  // First pass: meet minimum requirements for each tier
  for (const [tierName, tier] of Object.entries(tierRequirements)) {
    while (tier.count < tier.needed && totalSpent < maxBudget) {
      const forcedPersonality = {
        ...personality,
        expiryPreference: tier.expiries
      };

      const contract = generateBotContract(stockPrices, forcedPersonality, timestamp + contracts.length);

      if (contract && totalSpent + contract.entryAmount <= maxBudget) {
        contracts.push(contract);
        totalSpent += contract.entryAmount;
        tier.count++;
      } else {
        // Reduce position size and try again
        forcedPersonality.positionSizeRange = [100, 500];
        const smallerContract = generateBotContract(stockPrices, forcedPersonality, timestamp + contracts.length);

        if (smallerContract && totalSpent + smallerContract.entryAmount <= maxBudget) {
          contracts.push(smallerContract);
          totalSpent += smallerContract.entryAmount;
          tier.count++;
        } else {
          break; // Can't fit more
        }
      }
    }
  }

  // Second pass: add more contracts up to 8-10 total if budget allows
  const targetCount = randomInt(8, 10);
  let attempts = 0;

  while (contracts.length < targetCount && totalSpent < maxBudget && attempts < 20) {
    const contract = generateBotContract(stockPrices, personality, timestamp + contracts.length);

    if (contract && totalSpent + contract.entryAmount <= maxBudget) {
      contracts.push(contract);
      totalSpent += contract.entryAmount;
    }
    attempts++;
  }

  return {
    contracts,
    totalEntry: totalSpent,
    personality: Object.keys(BOT_PERSONALITIES).find(
      k => BOT_PERSONALITIES[k] === personality
    ) || 'balanced'
  };
};

/**
 * Populate tournament with bot competitors
 * @param {string} tournamentId - Tournament ID
 * @param {Object} stockPrices - Map of symbol -> current price
 * @param {number} count - Number of bots to create (default 12)
 * @returns {Promise<Object>} - { botsCreated, bots }
 */
export const populateOptionsTournamentBots = async (tournamentId, stockPrices, count = 12) => {
  const usedNames = new Set();
  const results = [];

  for (let i = 0; i < count; i++) {
    // Get unique name
    let botName;
    do {
      botName = randomChoice(BOT_NAMES);
    } while (usedNames.has(botName) && usedNames.size < BOT_NAMES.length);
    usedNames.add(botName);

    // Generate portfolio
    const portfolio = generateBotPortfolio(stockPrices);

    if (portfolio.contracts.length < 7) {
      console.warn(`Bot ${botName} couldn't meet minimum requirements, skipping`);
      continue;
    }

    try {
      // Create bot user ID
      const botUserId = `bot_${botName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

      // Create entry ID
      const entryId = `${botUserId}_1_${tournamentId}`;

      const entry = {
        odUserId: botUserId,
        tournamentId,
        username: botName,
        entryNumber: 1,
        contracts: portfolio.contracts.map(c => ({
          ...c,
          lockedValue: null,
          lockedAt: null,
          settled: false,
          finalValue: null
        })),
        totalEntry: portfolio.totalEntry,
        virtualCash: 10000 - portfolio.totalEntry,
        status: 'locked',
        isBot: true,
        botPersonality: portfolio.personality,
        results: {
          totalValue: null,
          percentReturn: null,
          settledCount: 0,
          lockedCount: 0
        },
        rank: null,
        createdAt: new Date().toISOString()
      };

      // Save directly to Firebase (bypass max entry check for bots)
      const docRef = doc(db, 'optionsEntries', entryId);
      await setDoc(docRef, entry);

      results.push({ botName, entryId, contractCount: portfolio.contracts.length });
    } catch (err) {
      console.error(`Error creating bot ${botName}:`, err);
    }
  }

  return {
    botsCreated: results.length,
    bots: results
  };
};

/**
 * Clear all bot entries for a tournament
 * @param {string} tournamentId - Tournament ID
 * @returns {Promise<number>} - Number of bots removed
 */
export const clearOptionsBots = async (tournamentId) => {
  return await clearOptionsBotEntries(tournamentId);
};

export default {
  generateBotPortfolio,
  populateOptionsTournamentBots,
  clearOptionsBots,
  BOT_NAMES
};
