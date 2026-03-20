// src/services/draftAssets.js
// Draft Mode Asset Pools - 75 Stocks + 75 Crypto
// Each category has 25 assets
// NOTE: Server-side copy at api/_utils/draftStockList.js — keep both in sync.

// ============================================
// STOCK ASSETS
// ============================================

// ============================================
// NEUTRAL STOCKS (25) — Moderate beta, large-cap foundation
// These stocks move WITH the market
// ============================================
export const NEUTRAL_STOCKS = [
  // Mega-Cap Tech
  { symbol: 'AAPL', name: 'Apple', category: 'neutral' },
  { symbol: 'MSFT', name: 'Microsoft', category: 'neutral' },
  { symbol: 'GOOGL', name: 'Alphabet (Google)', category: 'neutral' },
  { symbol: 'AVGO', name: 'Broadcom', category: 'neutral' },

  // Financials
  { symbol: 'JPM', name: 'JPMorgan Chase', category: 'neutral' },
  { symbol: 'V', name: 'Visa', category: 'neutral' },
  { symbol: 'MA', name: 'Mastercard', category: 'neutral' },
  { symbol: 'BAC', name: 'Bank of America', category: 'neutral' },
  { symbol: 'WFC', name: 'Wells Fargo', category: 'neutral' },
  { symbol: 'BRK-B', name: 'Berkshire Hathaway', category: 'neutral' },

  // Consumer
  { symbol: 'WMT', name: 'Walmart', category: 'neutral' },
  { symbol: 'COST', name: 'Costco', category: 'neutral' },
  { symbol: 'HD', name: 'Home Depot', category: 'neutral' },
  { symbol: 'NKE', name: 'Nike', category: 'neutral' },
  { symbol: 'SBUX', name: 'Starbucks', category: 'neutral' },
  { symbol: 'DIS', name: 'Disney', category: 'neutral' },

  // Industrials
  { symbol: 'HON', name: 'Honeywell', category: 'neutral' },
  { symbol: 'CAT', name: 'Caterpillar', category: 'neutral' },
  { symbol: 'GE', name: 'GE Aerospace', category: 'neutral' },
  { symbol: 'GEV', name: 'GE Vernova', category: 'neutral' },
  { symbol: 'UNP', name: 'Union Pacific', category: 'neutral' },

  // Tech & Healthcare
  { symbol: 'CSCO', name: 'Cisco', category: 'neutral' },
  { symbol: 'TXN', name: 'Texas Instruments', category: 'neutral' },
  { symbol: 'ABT', name: 'Abbott Laboratories', category: 'neutral' },
  { symbol: 'DHR', name: 'Danaher', category: 'neutral' },
];

// ============================================
// AGGRESSIVE STOCKS (25) — High beta, high-growth upside plays
// These stocks swing HARDER than the market
// ============================================
export const AGGRESSIVE_STOCKS = [
  // Mega-Cap Growth (High Beta)
  { symbol: 'NVDA', name: 'NVIDIA', category: 'aggressive' },
  { symbol: 'TSLA', name: 'Tesla', category: 'aggressive' },
  { symbol: 'AMD', name: 'Advanced Micro Devices', category: 'aggressive' },
  { symbol: 'AMZN', name: 'Amazon', category: 'aggressive' },
  { symbol: 'META', name: 'Meta Platforms', category: 'aggressive' },

  // High-Growth Tech
  { symbol: 'NFLX', name: 'Netflix', category: 'aggressive' },
  { symbol: 'CRM', name: 'Salesforce', category: 'aggressive' },
  { symbol: 'SHOP', name: 'Shopify', category: 'aggressive' },
  { symbol: 'PLTR', name: 'Palantir', category: 'aggressive' },
  { symbol: 'SNOW', name: 'Snowflake', category: 'aggressive' },
  { symbol: 'ADBE', name: 'Adobe', category: 'aggressive' },
  { symbol: 'QCOM', name: 'Qualcomm', category: 'aggressive' },
  { symbol: 'INTC', name: 'Intel', category: 'aggressive' },

  // Fintech & Finance (High Beta)
  { symbol: 'COIN', name: 'Coinbase', category: 'aggressive' },
  { symbol: 'AFRM', name: 'Affirm', category: 'aggressive' },
  { symbol: 'HOOD', name: 'Robinhood', category: 'aggressive' },
  { symbol: 'MS', name: 'Morgan Stanley', category: 'aggressive' },

  // Momentum & Thematic
  { symbol: 'DKNG', name: 'DraftKings', category: 'aggressive' },
  { symbol: 'GME', name: 'GameStop', category: 'aggressive' },
  { symbol: 'BE', name: 'Bloom Energy', category: 'aggressive' },
  { symbol: 'RKLB', name: 'Rocket Lab', category: 'aggressive' },
  { symbol: 'MPC', name: 'Marathon Petroleum', category: 'aggressive' },
  { symbol: 'CRWV', name: 'CoreWeave', category: 'aggressive' },
  { symbol: 'BA', name: 'Boeing', category: 'aggressive' },
  { symbol: 'F', name: 'Ford', category: 'aggressive' },
];

// ============================================
// DEFENSIVE STOCKS (25) — Low beta, dividends, recession-resistant
// These stocks RESIST the market
// ============================================
export const DEFENSIVE_STOCKS = [
  // Healthcare Defensive
  { symbol: 'JNJ', name: 'Johnson & Johnson', category: 'defensive' },
  { symbol: 'MRK', name: 'Merck', category: 'defensive' },
  { symbol: 'BMY', name: 'Bristol-Myers Squibb', category: 'defensive' },
  { symbol: 'GILD', name: 'Gilead Sciences', category: 'defensive' },
  { symbol: 'AMGN', name: 'Amgen', category: 'defensive' },
  { symbol: 'CVS', name: 'CVS Health', category: 'defensive' },

  // Consumer Staples
  { symbol: 'KO', name: 'Coca-Cola', category: 'defensive' },
  { symbol: 'PEP', name: 'PepsiCo', category: 'defensive' },
  { symbol: 'PG', name: 'Procter & Gamble', category: 'defensive' },
  { symbol: 'GIS', name: 'General Mills', category: 'defensive' },

  // Utilities
  { symbol: 'NEE', name: 'NextEra Energy', category: 'defensive' },
  { symbol: 'DUK', name: 'Duke Energy', category: 'defensive' },
  { symbol: 'SO', name: 'Southern Company', category: 'defensive' },
  { symbol: 'D', name: 'Dominion Energy', category: 'defensive' },
  { symbol: 'AEP', name: 'American Electric Power', category: 'defensive' },
  { symbol: 'XEL', name: 'Xcel Energy', category: 'defensive' },

  // REITs
  { symbol: 'AMT', name: 'American Tower', category: 'defensive' },
  { symbol: 'PLD', name: 'Prologis', category: 'defensive' },
  { symbol: 'CCI', name: 'Crown Castle', category: 'defensive' },
  { symbol: 'EQIX', name: 'Equinix', category: 'defensive' },

  // Defense & Energy
  { symbol: 'LMT', name: 'Lockheed Martin', category: 'defensive' },
  { symbol: 'RTX', name: 'RTX (Raytheon)', category: 'defensive' },
  { symbol: 'XOM', name: 'ExxonMobil', category: 'defensive' },
  { symbol: 'COP', name: 'ConocoPhillips', category: 'defensive' },
  { symbol: 'PWR', name: 'Quanta Services', category: 'defensive' },
];

// Backward-compatible aliases (safety net for any missed imports)
export const STEADY_STOCKS = NEUTRAL_STOCKS;
export const RISKY_STOCKS = AGGRESSIVE_STOCKS;

// ============================================
// CRYPTO ASSETS
// ============================================

export const STEADY_CRYPTO = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
  { id: 'binancecoin', symbol: 'BNB', name: 'BNB' },
  { id: 'ripple', symbol: 'XRP', name: 'XRP' },
  { id: 'cardano', symbol: 'ADA', name: 'Cardano' },
  { id: 'solana', symbol: 'SOL', name: 'Solana' },
  { id: 'polkadot', symbol: 'DOT', name: 'Polkadot' },
  { id: 'avalanche-2', symbol: 'AVAX', name: 'Avalanche' },
  { id: 'pendle', symbol: 'PENDLE', name: 'Pendle' },
  { id: 'tron', symbol: 'TRX', name: 'TRON' },
  { id: 'chainlink', symbol: 'LINK', name: 'Chainlink' },
  { id: 'dydx', symbol: 'DYDX', name: 'dYdX' },
  { id: 'aave', symbol: 'AAVE', name: 'Aave' },
  { id: 'maker', symbol: 'MKR', name: 'Maker' },
  { id: 'litecoin', symbol: 'LTC', name: 'Litecoin' },
  { id: 'bitcoin-cash', symbol: 'BCH', name: 'Bitcoin Cash' },
  { id: 'stellar', symbol: 'XLM', name: 'Stellar' },
  { id: 'monero', symbol: 'XMR', name: 'Monero' },
  { id: 'ethereum-classic', symbol: 'ETC', name: 'Ethereum Classic' },
  { id: 'cosmos', symbol: 'ATOM', name: 'Cosmos' },
  { id: 'algorand', symbol: 'ALGO', name: 'Algorand' },
  { id: 'near', symbol: 'NEAR', name: 'NEAR Protocol' },
  { id: 'internet-computer', symbol: 'ICP', name: 'Internet Computer' },
  { id: 'filecoin', symbol: 'FIL', name: 'Filecoin' },
  { id: 'hedera-hashgraph', symbol: 'HBAR', name: 'Hedera' }
];

export const RISKY_CRYPTO = [
  { id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin' },
  { id: 'trust-wallet-token', symbol: 'TWT', name: 'Trust Wallet' },
  { id: 'conflux-token', symbol: 'CFX', name: 'Conflux' },
  { id: 'woo-network', symbol: 'WOO', name: 'WOO Network' },
  { id: 'osmosis', symbol: 'OSMO', name: 'Osmosis' },
  { id: 'dogwifcoin', symbol: 'WIF', name: 'dogwifhat' },
  { id: 'render-token', symbol: 'RENDER', name: 'Render' },
  { id: 'fetch-ai', symbol: 'FET', name: 'Fetch.ai' },
  { id: 'artificial-superintelligence-alliance', symbol: 'ASI', name: 'ASI Alliance' },
  { id: 'akash-network', symbol: 'AKT', name: 'Akash Network' },
  { id: 'ssv-network', symbol: 'SSV', name: 'SSV Network' },
  { id: 'the-sandbox', symbol: 'SAND', name: 'The Sandbox' },
  { id: 'decentraland', symbol: 'MANA', name: 'Decentraland' },
  { id: 'axie-infinity', symbol: 'AXS', name: 'Axie Infinity' },
  { id: 'joe', symbol: 'JOE', name: 'Trader Joe' },
  { id: 'mina-protocol', symbol: 'MINA', name: 'Mina Protocol' },
  { id: 'curve-dao-token', symbol: 'CRV', name: 'Curve DAO' },
  { id: '1inch', symbol: '1INCH', name: '1inch' },
  { id: 'sushi', symbol: 'SUSHI', name: 'SushiSwap' },
  { id: 'pancakeswap-token', symbol: 'CAKE', name: 'PancakeSwap' },
  { id: 'optimism', symbol: 'OP', name: 'Optimism' },
  { id: 'arbitrum', symbol: 'ARB', name: 'Arbitrum' },
  { id: 'injective-protocol', symbol: 'INJ', name: 'Injective' },
  { id: 'sei-network', symbol: 'SEI', name: 'Sei' },
  { id: 'sui', symbol: 'SUI20947', name: 'Sui' }
];

export const DEFENSIVE_CRYPTO = [
  { id: 'fantom', symbol: 'FTM', name: 'Fantom' },
  { id: 'elrond-erd-2', symbol: 'EGLD', name: 'MultiversX' },
  { id: 'thorchain', symbol: 'RUNE', name: 'THORChain' },
  { id: 'kava', symbol: 'KAVA', name: 'Kava' },
  { id: 'celo', symbol: 'CELO', name: 'Celo' },
  { id: 'lido-dao', symbol: 'LDO', name: 'Lido DAO' },
  { id: 'rocket-pool', symbol: 'RPL', name: 'Rocket Pool' },
  { id: 'highstreet', symbol: 'HIGH', name: 'Highstreet' },
  { id: 'coinbase-wrapped-staked-eth', symbol: 'CBETH', name: 'Coinbase Staked ETH' },
  { id: 'storj', symbol: 'STORJ', name: 'Storj' },
  { id: 'band-protocol', symbol: 'BAND', name: 'Band Protocol' },
  { id: 'api3', symbol: 'API3', name: 'API3' },
  { id: 'crypto-com-chain', symbol: 'CRO', name: 'Cronos' },
  { id: 'kucoin-shares', symbol: 'KCS', name: 'KuCoin Token' },
  { id: 'okb', symbol: 'OKB', name: 'OKB' },
  { id: 'leo-token', symbol: 'LEO', name: 'LEO Token' },
  { id: 'zcash', symbol: 'ZEC', name: 'Zcash' },
  { id: 'dash', symbol: 'DASH', name: 'Dash' },
  { id: 'wrapped-bitcoin', symbol: 'WBTC', name: 'Wrapped Bitcoin' },
  { id: 'ens', symbol: 'ENS', name: 'Ethereum Name Service' },
  { id: 'quant-network', symbol: 'QNT', name: 'Quant' },
  { id: 'vechain', symbol: 'VET', name: 'VeChain' },
  { id: 'theta-network', symbol: 'THETA', name: 'Theta Network' },
  { id: 'helium', symbol: 'HNT', name: 'Helium' },
  { id: 'arweave', symbol: 'AR', name: 'Arweave' }
];

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get full asset pool for a draft type
 */
export function getAssetPool(type) {
  if (type === 'stocks') {
    return {
      neutral: [...NEUTRAL_STOCKS],
      aggressive: [...AGGRESSIVE_STOCKS],
      defensive: [...DEFENSIVE_STOCKS]
    };
  } else {
    // Crypto drafts still use steady/risky/defensive keys for now
    return {
      neutral: [...STEADY_CRYPTO],
      aggressive: [...RISKY_CRYPTO],
      defensive: [...DEFENSIVE_CRYPTO]
    };
  }
}

/**
 * Get total asset count
 */
export function getTotalAssetCount(type) {
  const pool = getAssetPool(type);
  return pool.neutral.length + pool.aggressive.length + pool.defensive.length;
}

/**
 * Generate snake draft order for N players over R rounds
 * Example for 4 players, 9 rounds:
 * [0,1,2,3, 3,2,1,0, 0,1,2,3, 3,2,1,0, ...]
 */
export function generateSnakeOrder(numPlayers, numRounds) {
  const order = [];
  for (let round = 0; round < numRounds; round++) {
    if (round % 2 === 0) {
      // Forward: 0, 1, 2, 3
      for (let i = 0; i < numPlayers; i++) {
        order.push(i);
      }
    } else {
      // Reverse: 3, 2, 1, 0
      for (let i = numPlayers - 1; i >= 0; i--) {
        order.push(i);
      }
    }
  }
  return order;
}

/**
 * Generate a random draft code (like challenge codes)
 */
export function generateDraftCode() {
  const words = ['BULL', 'BEAR', 'MOON', 'HODL', 'PUMP', 'GAIN', 'WOLF', 'APEX'];
  const word = words[Math.floor(Math.random() * words.length)];
  const numbers = Math.floor(1000 + Math.random() * 9000);
  return `${word}-${numbers}`;
}

/**
 * Shuffle array (Fisher-Yates)
 */
export function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default {
  NEUTRAL_STOCKS,
  AGGRESSIVE_STOCKS,
  DEFENSIVE_STOCKS,
  STEADY_STOCKS,
  RISKY_STOCKS,
  STEADY_CRYPTO,
  RISKY_CRYPTO,
  DEFENSIVE_CRYPTO,
  getAssetPool,
  getTotalAssetCount,
  generateSnakeOrder,
  generateDraftCode,
  shuffleArray
};
