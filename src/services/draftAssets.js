// src/services/draftAssets.js
// Draft Mode Asset Pools - 75 Stocks + 75 Crypto
// Each category has 25 assets

// ============================================
// STOCK ASSETS
// ============================================

export const STEADY_STOCKS = [
  // Mega-Cap Tech (Established)
  { symbol: 'AAPL', name: 'Apple', sector: 'Technology' },
  { symbol: 'MSFT', name: 'Microsoft', sector: 'Technology' },
  { symbol: 'GOOGL', name: 'Alphabet', sector: 'Technology' },

  // Financial Giants
  { symbol: 'JPM', name: 'JPMorgan Chase', sector: 'Financials' },
  { symbol: 'V', name: 'Visa', sector: 'Financials' },
  { symbol: 'MA', name: 'Mastercard', sector: 'Financials' },
  { symbol: 'BAC', name: 'Bank of America', sector: 'Financials' },
  { symbol: 'WFC', name: 'Wells Fargo', sector: 'Financials' },

  // Consumer Staples
  { symbol: 'PG', name: 'Procter & Gamble', sector: 'Consumer Staples' },
  { symbol: 'KO', name: 'Coca-Cola', sector: 'Consumer Staples' },
  { symbol: 'PEP', name: 'PepsiCo', sector: 'Consumer Staples' },
  { symbol: 'WMT', name: 'Walmart', sector: 'Retail' },
  { symbol: 'COST', name: 'Costco', sector: 'Retail' },

  // Healthcare Giants
  { symbol: 'JNJ', name: 'Johnson & Johnson', sector: 'Healthcare' },
  { symbol: 'UNH', name: 'UnitedHealth', sector: 'Healthcare' },
  { symbol: 'PFE', name: 'Pfizer', sector: 'Healthcare' },
  { symbol: 'MRK', name: 'Merck', sector: 'Healthcare' },
  { symbol: 'ABBV', name: 'AbbVie', sector: 'Healthcare' },

  // Industrial/Conglomerate
  { symbol: 'BRK.B', name: 'Berkshire Hathaway', sector: 'Conglomerate' },
  { symbol: 'HON', name: 'Honeywell', sector: 'Industrials' },
  { symbol: 'MMM', name: '3M', sector: 'Industrials' },
  { symbol: 'CAT', name: 'Caterpillar', sector: 'Industrials' },

  // Communication
  { symbol: 'VZ', name: 'Verizon', sector: 'Communication' },
  { symbol: 'T', name: 'AT&T', sector: 'Communication' },
  { symbol: 'CMCSA', name: 'Comcast', sector: 'Communication' }
];

export const RISKY_STOCKS = [
  // High-Growth Tech
  { symbol: 'NVDA', name: 'NVIDIA', sector: 'Technology' },
  { symbol: 'TSLA', name: 'Tesla', sector: 'Automotive' },
  { symbol: 'META', name: 'Meta Platforms', sector: 'Technology' },
  { symbol: 'AMD', name: 'AMD', sector: 'Technology' },
  { symbol: 'CRM', name: 'Salesforce', sector: 'Technology' },
  { symbol: 'NFLX', name: 'Netflix', sector: 'Entertainment' },
  { symbol: 'SHOP', name: 'Shopify', sector: 'Technology' },
  { symbol: 'SQ', name: 'Block (Square)', sector: 'Fintech' },
  { symbol: 'SNOW', name: 'Snowflake', sector: 'Technology' },
  { symbol: 'PLTR', name: 'Palantir', sector: 'Technology' },

  // Biotech/Pharma (High Risk)
  { symbol: 'MRNA', name: 'Moderna', sector: 'Biotech' },
  { symbol: 'BNTX', name: 'BioNTech', sector: 'Biotech' },
  { symbol: 'CRSP', name: 'CRISPR Therapeutics', sector: 'Biotech' },

  // EV/Clean Energy
  { symbol: 'RIVN', name: 'Rivian', sector: 'Automotive' },
  { symbol: 'LCID', name: 'Lucid Motors', sector: 'Automotive' },
  { symbol: 'ENPH', name: 'Enphase Energy', sector: 'Energy' },
  { symbol: 'PLUG', name: 'Plug Power', sector: 'Energy' },

  // High-Beta Tech
  { symbol: 'ROKU', name: 'Roku', sector: 'Technology' },
  { symbol: 'DKNG', name: 'DraftKings', sector: 'Entertainment' },
  { symbol: 'COIN', name: 'Coinbase', sector: 'Fintech' },
  { symbol: 'HOOD', name: 'Robinhood', sector: 'Fintech' },
  { symbol: 'AFRM', name: 'Affirm', sector: 'Fintech' },
  { symbol: 'UPST', name: 'Upstart', sector: 'Fintech' },

  // Meme/Momentum
  { symbol: 'GME', name: 'GameStop', sector: 'Retail' },
  { symbol: 'AMC', name: 'AMC Entertainment', sector: 'Entertainment' }
];

export const DEFENSIVE_STOCKS = [
  // Utilities
  { symbol: 'NEE', name: 'NextEra Energy', sector: 'Utilities' },
  { symbol: 'DUK', name: 'Duke Energy', sector: 'Utilities' },
  { symbol: 'SO', name: 'Southern Company', sector: 'Utilities' },
  { symbol: 'D', name: 'Dominion Energy', sector: 'Utilities' },
  { symbol: 'AEP', name: 'American Electric Power', sector: 'Utilities' },
  { symbol: 'XEL', name: 'Xcel Energy', sector: 'Utilities' },

  // REITs
  { symbol: 'AMT', name: 'American Tower', sector: 'REIT' },
  { symbol: 'PLD', name: 'Prologis', sector: 'REIT' },
  { symbol: 'CCI', name: 'Crown Castle', sector: 'REIT' },
  { symbol: 'EQIX', name: 'Equinix', sector: 'REIT' },
  { symbol: 'O', name: 'Realty Income', sector: 'REIT' },

  // Consumer Defensive
  { symbol: 'CL', name: 'Colgate-Palmolive', sector: 'Consumer Staples' },
  { symbol: 'GIS', name: 'General Mills', sector: 'Consumer Staples' },
  { symbol: 'K', name: 'Kellogg', sector: 'Consumer Staples' },
  { symbol: 'KMB', name: 'Kimberly-Clark', sector: 'Consumer Staples' },
  { symbol: 'SJM', name: 'JM Smucker', sector: 'Consumer Staples' },

  // Healthcare Defensive
  { symbol: 'BMY', name: 'Bristol-Myers Squibb', sector: 'Healthcare' },
  { symbol: 'GILD', name: 'Gilead Sciences', sector: 'Healthcare' },
  { symbol: 'AMGN', name: 'Amgen', sector: 'Healthcare' },
  { symbol: 'CVS', name: 'CVS Health', sector: 'Healthcare' },
  { symbol: 'WBA', name: 'Walgreens', sector: 'Healthcare' },

  // Gold/Precious Metals
  { symbol: 'NEM', name: 'Newmont', sector: 'Materials' },
  { symbol: 'GOLD', name: 'Barrick Gold', sector: 'Materials' },

  // Defense
  { symbol: 'LMT', name: 'Lockheed Martin', sector: 'Defense' },
  { symbol: 'RTX', name: 'RTX (Raytheon)', sector: 'Defense' }
];

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
      steady: [...STEADY_STOCKS],
      risky: [...RISKY_STOCKS],
      defensive: [...DEFENSIVE_STOCKS]
    };
  } else {
    return {
      steady: [...STEADY_CRYPTO],
      risky: [...RISKY_CRYPTO],
      defensive: [...DEFENSIVE_CRYPTO]
    };
  }
}

/**
 * Get total asset count
 */
export function getTotalAssetCount(type) {
  const pool = getAssetPool(type);
  return pool.steady.length + pool.risky.length + pool.defensive.length;
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
  STEADY_STOCKS,
  RISKY_STOCKS,
  DEFENSIVE_STOCKS,
  STEADY_CRYPTO,
  RISKY_CRYPTO,
  DEFENSIVE_CRYPTO,
  getAssetPool,
  getTotalAssetCount,
  generateSnakeOrder,
  generateDraftCode,
  shuffleArray
};
