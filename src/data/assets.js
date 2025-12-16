// /src/data/assets.js
// MarketClash Asset Database - Centralized definitions

// ============================================
// STOCKS (50 total)
// ============================================

export const STOCKS = [
  // ===== TECHNOLOGY (10) =====
  { symbol: 'AAPL', name: 'Apple', sector: 'Technology' },
  { symbol: 'MSFT', name: 'Microsoft', sector: 'Technology' },
  { symbol: 'NVDA', name: 'NVIDIA', sector: 'Technology' },
  { symbol: 'GOOGL', name: 'Alphabet (Google)', sector: 'Technology' },
  { symbol: 'AMZN', name: 'Amazon', sector: 'Technology' },
  { symbol: 'META', name: 'Meta Platforms', sector: 'Technology' },
  { symbol: 'TSLA', name: 'Tesla', sector: 'Technology' },
  { symbol: 'AVGO', name: 'Broadcom', sector: 'Technology' },
  { symbol: 'AMD', name: 'Advanced Micro Devices', sector: 'Technology' },
  { symbol: 'CRM', name: 'Salesforce', sector: 'Technology' },

  // ===== FINANCE (8) =====
  { symbol: 'BRK.B', name: 'Berkshire Hathaway', sector: 'Finance' },
  { symbol: 'JPM', name: 'JPMorgan Chase', sector: 'Finance' },
  { symbol: 'V', name: 'Visa', sector: 'Finance' },
  { symbol: 'MA', name: 'Mastercard', sector: 'Finance' },
  { symbol: 'BAC', name: 'Bank of America', sector: 'Finance' },
  { symbol: 'WFC', name: 'Wells Fargo', sector: 'Finance' },
  { symbol: 'GS', name: 'Goldman Sachs', sector: 'Finance' },
  { symbol: 'AXP', name: 'American Express', sector: 'Finance' },

  // ===== HEALTHCARE (6) =====
  { symbol: 'UNH', name: 'UnitedHealth', sector: 'Healthcare' },
  { symbol: 'LLY', name: 'Eli Lilly', sector: 'Healthcare' },
  { symbol: 'JNJ', name: 'Johnson & Johnson', sector: 'Healthcare' },
  { symbol: 'ABBV', name: 'AbbVie', sector: 'Healthcare' },
  { symbol: 'MRK', name: 'Merck', sector: 'Healthcare' },
  { symbol: 'PFE', name: 'Pfizer', sector: 'Healthcare' },

  // ===== CONSUMER DISCRETIONARY (5) =====
  { symbol: 'HD', name: 'Home Depot', sector: 'Consumer Discretionary' },
  { symbol: 'MCD', name: "McDonald's", sector: 'Consumer Discretionary' },
  { symbol: 'NKE', name: 'Nike', sector: 'Consumer Discretionary' },
  { symbol: 'SBUX', name: 'Starbucks', sector: 'Consumer Discretionary' },
  { symbol: 'TGT', name: 'Target', sector: 'Consumer Discretionary' },

  // ===== CONSUMER STAPLES (5) =====
  { symbol: 'WMT', name: 'Walmart', sector: 'Consumer Staples' },
  { symbol: 'PG', name: 'Procter & Gamble', sector: 'Consumer Staples' },
  { symbol: 'KO', name: 'Coca-Cola', sector: 'Consumer Staples' },
  { symbol: 'PEP', name: 'PepsiCo', sector: 'Consumer Staples' },
  { symbol: 'COST', name: 'Costco', sector: 'Consumer Staples' },

  // ===== ENERGY (5) =====
  { symbol: 'XOM', name: 'ExxonMobil', sector: 'Energy' },
  { symbol: 'CVX', name: 'Chevron', sector: 'Energy' },
  { symbol: 'COP', name: 'ConocoPhillips', sector: 'Energy' },
  { symbol: 'SLB', name: 'Schlumberger', sector: 'Energy' },
  { symbol: 'EOG', name: 'EOG Resources', sector: 'Energy' },

  // ===== INDUSTRIALS (4) =====
  { symbol: 'CAT', name: 'Caterpillar', sector: 'Industrials' },
  { symbol: 'RTX', name: 'RTX (Raytheon)', sector: 'Industrials' },
  { symbol: 'UPS', name: 'United Parcel Service', sector: 'Industrials' },
  { symbol: 'HON', name: 'Honeywell', sector: 'Industrials' },

  // ===== UTILITIES (4) =====
  { symbol: 'NEE', name: 'NextEra Energy', sector: 'Utilities' },
  { symbol: 'DUK', name: 'Duke Energy', sector: 'Utilities' },
  { symbol: 'SO', name: 'Southern Company', sector: 'Utilities' },
  { symbol: 'D', name: 'Dominion Energy', sector: 'Utilities' },

  // ===== REAL ESTATE (4) =====
  { symbol: 'AMT', name: 'American Tower', sector: 'Real Estate' },
  { symbol: 'PLD', name: 'Prologis', sector: 'Real Estate' },
  { symbol: 'CCI', name: 'Crown Castle', sector: 'Real Estate' },
  { symbol: 'EQIX', name: 'Equinix', sector: 'Real Estate' },

  // ===== TELECOM (3) =====
  { symbol: 'VZ', name: 'Verizon', sector: 'Telecom' },
  { symbol: 'T', name: 'AT&T', sector: 'Telecom' },
  { symbol: 'TMUS', name: 'T-Mobile', sector: 'Telecom' },
];

// ============================================
// CRYPTO (32 total)
// ============================================

export const CRYPTO = [
  // ===== LAYER 1 - MAJOR (10) =====
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', category: 'Layer 1' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', category: 'Layer 1' },
  { id: 'solana', symbol: 'SOL', name: 'Solana', category: 'Layer 1' },
  { id: 'cardano', symbol: 'ADA', name: 'Cardano', category: 'Layer 1' },
  { id: 'avalanche-2', symbol: 'AVAX', name: 'Avalanche', category: 'Layer 1' },
  { id: 'polkadot', symbol: 'DOT', name: 'Polkadot', category: 'Layer 1' },
  { id: 'near', symbol: 'NEAR', name: 'NEAR Protocol', category: 'Layer 1' },
  { id: 'aptos', symbol: 'APT', name: 'Aptos', category: 'Layer 1' },
  { id: 'sui', symbol: 'SUI', name: 'Sui', category: 'Layer 1' },
  { id: 'cosmos', symbol: 'ATOM', name: 'Cosmos', category: 'Layer 1' },

  // ===== LAYER 1 - ALTERNATIVE (4) =====
  { id: 'litecoin', symbol: 'LTC', name: 'Litecoin', category: 'Layer 1 Alt' },
  { id: 'bitcoin-cash', symbol: 'BCH', name: 'Bitcoin Cash', category: 'Layer 1 Alt' },
  { id: 'monero', symbol: 'XMR', name: 'Monero', category: 'Layer 1 Alt' },
  { id: 'ethereum-classic', symbol: 'ETC', name: 'Ethereum Classic', category: 'Layer 1 Alt' },

  // ===== LAYER 2 / SCALING (3) =====
  { id: 'matic-network', symbol: 'MATIC', name: 'Polygon', category: 'Layer 2' },
  { id: 'arbitrum', symbol: 'ARB', name: 'Arbitrum', category: 'Layer 2' },
  { id: 'optimism', symbol: 'OP', name: 'Optimism', category: 'Layer 2' },

  // ===== DEFI (4) =====
  { id: 'uniswap', symbol: 'UNI', name: 'Uniswap', category: 'DeFi' },
  { id: 'chainlink', symbol: 'LINK', name: 'Chainlink', category: 'DeFi' },
  { id: 'aave', symbol: 'AAVE', name: 'Aave', category: 'DeFi' },
  { id: 'injective-protocol', symbol: 'INJ', name: 'Injective', category: 'DeFi' },

  // ===== PAYMENT / UTILITY (4) =====
  { id: 'ripple', symbol: 'XRP', name: 'XRP', category: 'Payment' },
  { id: 'stellar', symbol: 'XLM', name: 'Stellar', category: 'Payment' },
  { id: 'hedera-hashgraph', symbol: 'HBAR', name: 'Hedera', category: 'Payment' },
  { id: 'tron', symbol: 'TRX', name: 'TRON', category: 'Payment' },

  // ===== MEME (4) =====
  { id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin', category: 'Meme' },
  { id: 'shiba-inu', symbol: 'SHIB', name: 'Shiba Inu', category: 'Meme' },
  { id: 'pepe', symbol: 'PEPE', name: 'Pepe', category: 'Meme' },
  { id: 'bonk', symbol: 'BONK', name: 'Bonk', category: 'Meme' },

  // ===== STABLECOINS (2) =====
  { id: 'tether', symbol: 'USDT', name: 'Tether', category: 'Stablecoin' },
  { id: 'usd-coin', symbol: 'USDC', name: 'USD Coin', category: 'Stablecoin' },

  // ===== AI / EMERGING (1) =====
  { id: 'render-token', symbol: 'RENDER', name: 'Render', category: 'AI' },
];

// ============================================
// FALLBACK PRICES (used when API fails)
// ============================================

export const FALLBACK_STOCK_PRICES = {
  'AAPL': 185,
  'MSFT': 378,
  'NVDA': 135,
  'GOOGL': 175,
  'AMZN': 185,
  'META': 560,
  'TSLA': 250,
  'AVGO': 220,
  'AMD': 145,
  'CRM': 320,
  'BRK.B': 410,
  'JPM': 200,
  'V': 280,
  'MA': 470,
  'BAC': 40,
  'WFC': 55,
  'GS': 480,
  'AXP': 240,
  'UNH': 550,
  'LLY': 780,
  'JNJ': 160,
  'ABBV': 175,
  'MRK': 105,
  'PFE': 28,
  'HD': 385,
  'MCD': 290,
  'NKE': 78,
  'SBUX': 100,
  'TGT': 135,
  'WMT': 165,
  'PG': 165,
  'KO': 62,
  'PEP': 170,
  'COST': 920,
  'XOM': 110,
  'CVX': 145,
  'COP': 105,
  'SLB': 45,
  'EOG': 125,
  'CAT': 370,
  'RTX': 115,
  'UPS': 130,
  'HON': 210,
  'NEE': 75,
  'DUK': 100,
  'SO': 85,
  'D': 55,
  'AMT': 215,
  'PLD': 130,
  'CCI': 105,
  'EQIX': 890,
  'VZ': 42,
  'T': 22,
  'TMUS': 220,
};

export const FALLBACK_CRYPTO_PRICES = {
  'bitcoin': 91000,
  'ethereum': 3100,
  'solana': 137,
  'cardano': 0.43,
  'avalanche-2': 14,
  'polkadot': 2.24,
  'near': 1.74,
  'aptos': 1.85,
  'sui': 1.62,
  'cosmos': 2.26,
  'litecoin': 82,
  'bitcoin-cash': 580,
  'monero': 402,
  'ethereum-classic': 13.5,
  'matic-network': 0.12,
  'arbitrum': 0.21,
  'optimism': 0.32,
  'uniswap': 5.79,
  'chainlink': 14,
  'aave': 189,
  'injective-protocol': 5.69,
  'ripple': 2.06,
  'stellar': 0.25,
  'hedera-hashgraph': 0.14,
  'tron': 0.29,
  'dogecoin': 0.14,
  'shiba-inu': 0.000007,
  'pepe': 0.000004,
  'bonk': 0.000008,
  'tether': 1.00,
  'usd-coin': 1.00,
  'render-token': 1.65,
  // Symbol-based fallbacks (for backward compatibility)
  'BTC': 91000,
  'ETH': 3100,
  'SOL': 137,
  'ADA': 0.43,
  'AVAX': 14,
  'DOT': 2.24,
  'NEAR': 1.74,
  'APT': 1.85,
  'SUI': 1.62,
  'ATOM': 2.26,
  'LTC': 82,
  'BCH': 580,
  'XMR': 402,
  'ETC': 13.5,
  'MATIC': 0.12,
  'ARB': 0.21,
  'OP': 0.32,
  'UNI': 5.79,
  'LINK': 14,
  'AAVE': 189,
  'INJ': 5.69,
  'XRP': 2.06,
  'XLM': 0.25,
  'HBAR': 0.14,
  'TRX': 0.29,
  'DOGE': 0.14,
  'SHIB': 0.000007,
  'PEPE': 0.000004,
  'BONK': 0.000008,
  'USDT': 1.00,
  'USDC': 1.00,
  'RENDER': 1.65,
};

// ============================================
// SECTOR & CATEGORY DEFINITIONS (for UI)
// ============================================

export const STOCK_SECTORS = [
  { id: 'technology', name: 'Technology', icon: '💻', color: '#00d9ff' },
  { id: 'finance', name: 'Finance', icon: '🏦', color: '#10b981' },
  { id: 'healthcare', name: 'Healthcare', icon: '🏥', color: '#f43f5e' },
  { id: 'consumer-discretionary', name: 'Consumer Discretionary', icon: '🛍️', color: '#f59e0b' },
  { id: 'consumer-staples', name: 'Consumer Staples', icon: '🛒', color: '#84cc16' },
  { id: 'energy', name: 'Energy', icon: '⚡', color: '#ef4444' },
  { id: 'industrials', name: 'Industrials', icon: '🏭', color: '#6366f1' },
  { id: 'utilities', name: 'Utilities', icon: '💡', color: '#eab308' },
  { id: 'real-estate', name: 'Real Estate', icon: '🏢', color: '#14b8a6' },
  { id: 'telecom', name: 'Telecom', icon: '📡', color: '#8b5cf6' },
];

export const CRYPTO_CATEGORIES = [
  { id: 'layer-1', name: 'Layer 1', icon: '🔷', description: 'Base blockchain protocols' },
  { id: 'layer-1-alt', name: 'Layer 1 Alt', icon: '🔶', description: 'Alternative L1 chains' },
  { id: 'layer-2', name: 'Layer 2', icon: '⚡', description: 'Scaling solutions' },
  { id: 'defi', name: 'DeFi', icon: '🏛️', description: 'Decentralized finance' },
  { id: 'payment', name: 'Payment', icon: '💸', description: 'Payment & utility tokens' },
  { id: 'meme', name: 'Meme', icon: '🐕', description: 'Community-driven meme coins' },
  { id: 'stablecoin', name: 'Stablecoin', icon: '💵', description: 'Dollar-pegged tokens' },
  { id: 'ai', name: 'AI', icon: '🤖', description: 'AI & compute tokens' },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

// Get all stock symbols as array
export const getStockSymbols = () => STOCKS.map(s => s.symbol);

// Get all crypto symbols as array
export const getCryptoSymbols = () => CRYPTO.map(c => c.symbol);

// Get all crypto IDs as array (for API calls)
export const getCryptoIds = () => CRYPTO.map(c => c.id);

// Get stocks by sector
export const getStocksBySector = (sector) => STOCKS.filter(s => s.sector === sector);

// Get crypto by category
export const getCryptoByCategory = (category) => CRYPTO.filter(c => c.category === category);

// Find stock by symbol
export const findStock = (symbol) => STOCKS.find(s => s.symbol === symbol);

// Find crypto by symbol or id
export const findCrypto = (symbolOrId) => CRYPTO.find(c => c.symbol === symbolOrId || c.id === symbolOrId);

// Get stock name mapping
export const getStockNameMap = () => {
  const map = {};
  STOCKS.forEach(s => { map[s.symbol] = s.name; });
  return map;
};

// Get crypto name mapping
export const getCryptoNameMap = () => {
  const map = {};
  CRYPTO.forEach(c => { map[c.symbol] = c.name; });
  return map;
};

// Get unique sectors
export const getUniqueSectors = () => [...new Set(STOCKS.map(s => s.sector))];

// Get unique crypto categories
export const getUniqueCategories = () => [...new Set(CRYPTO.map(c => c.category))];

export default {
  STOCKS,
  CRYPTO,
  FALLBACK_STOCK_PRICES,
  FALLBACK_CRYPTO_PRICES,
  STOCK_SECTORS,
  CRYPTO_CATEGORIES,
  getStockSymbols,
  getCryptoSymbols,
  getCryptoIds,
  getStocksBySector,
  getCryptoByCategory,
  findStock,
  findCrypto,
  getStockNameMap,
  getCryptoNameMap,
  getUniqueSectors,
  getUniqueCategories,
};
