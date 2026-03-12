// /src/data/assets.js
// FantasyTrades Asset Database - Centralized definitions

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
  { symbol: 'BRK-B', name: 'Berkshire Hathaway', sector: 'Finance' },
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

  // ===== PAYMENT / UTILITY (5) =====
  { id: 'ripple', symbol: 'XRP', name: 'XRP', category: 'Payment' },
  { id: 'binancecoin', symbol: 'BNB', name: 'BNB', category: 'Payment' },
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

// Updated January 2026 - approximate market values
export const FALLBACK_STOCK_PRICES = {
  'AAPL': 240,
  'MSFT': 430,
  'NVDA': 140,
  'GOOGL': 195,
  'AMZN': 230,
  'META': 620,
  'TSLA': 410,
  'AVGO': 240,
  'AMD': 125,
  'CRM': 340,
  'BRK-B': 470,
  'JPM': 255,
  'V': 320,
  'MA': 530,
  'BAC': 48,
  'WFC': 75,
  'GS': 600,
  'AXP': 300,
  'UNH': 590,
  'LLY': 790,
  'JNJ': 155,
  'ABBV': 180,
  'MRK': 100,
  'PFE': 27,
  'HD': 420,
  'MCD': 295,
  'NKE': 75,
  'SBUX': 105,
  'TGT': 140,
  'WMT': 95,
  'PG': 170,
  'KO': 64,
  'PEP': 155,
  'COST': 960,
  'XOM': 108,
  'CVX': 150,
  'COP': 102,
  'SLB': 43,
  'EOG': 128,
  'CAT': 390,
  'RTX': 125,
  'UPS': 125,
  'HON': 230,
  'NEE': 72,
  'DUK': 108,
  'SO': 88,
  'D': 58,
  'AMT': 210,
  'PLD': 115,
  'CCI': 100,
  'EQIX': 920,
  'VZ': 40,
  'T': 23,
  'TMUS': 235,
  // New draft stocks (March 2026 approximate values)
  'GE': 200,
  'GEV': 380,
  'UNP': 250,
  'CSCO': 62,
  'TXN': 195,
  'ABT': 125,
  'DHR': 260,
  'DIS': 115,
  'NFLX': 1000,
  'SHOP': 110,
  'PLTR': 95,
  'SNOW': 180,
  'ADBE': 480,
  'QCOM': 180,
  'INTC': 25,
  'COIN': 280,
  'AFRM': 70,
  'HOOD': 55,
  'MS': 125,
  'DKNG': 48,
  'GME': 28,
  'BE': 25,
  'RKLB': 28,
  'MPC': 165,
  'CRWV': 45,
  'BA': 195,
  'F': 11,
  'BMY': 55,
  'GILD': 105,
  'AMGN': 310,
  'CVS': 58,
  'GIS': 65,
  'AEP': 102,
  'XEL': 68,
  'LMT': 510,
  'PWR': 340,
};

// Updated January 2026 - approximate market values
export const FALLBACK_CRYPTO_PRICES = {
  'bitcoin': 95000,
  'ethereum': 3400,
  'solana': 210,
  'cardano': 1.05,
  'avalanche-2': 40,
  'polkadot': 7.50,
  'near': 5.50,
  'aptos': 9.50,
  'sui': 4.80,
  'cosmos': 7.20,
  'litecoin': 115,
  'bitcoin-cash': 480,
  'monero': 210,
  'ethereum-classic': 28,
  'matic-network': 0.52,
  'arbitrum': 0.85,
  'optimism': 1.90,
  'uniswap': 14.50,
  'chainlink': 23,
  'aave': 350,
  'injective-protocol': 24,
  'ripple': 2.35,
  'stellar': 0.45,
  'hedera-hashgraph': 0.32,
  'tron': 0.26,
  'dogecoin': 0.38,
  'shiba-inu': 0.000023,
  'pepe': 0.000019,
  'bonk': 0.000032,
  'tether': 1.00,
  'usd-coin': 1.00,
  'render-token': 7.80,
  // Symbol-based fallbacks (for backward compatibility)
  'BTC': 95000,
  'ETH': 3400,
  'SOL': 210,
  'ADA': 1.05,
  'AVAX': 40,
  'DOT': 7.50,
  'NEAR': 5.50,
  'APT': 9.50,
  'SUI': 4.80,
  'ATOM': 7.20,
  'LTC': 115,
  'BCH': 480,
  'XMR': 210,
  'ETC': 28,
  'MATIC': 0.52,
  'ARB': 0.85,
  'OP': 1.90,
  'UNI': 14.50,
  'LINK': 23,
  'AAVE': 350,
  'INJ': 24,
  'XRP': 2.35,
  'XLM': 0.45,
  'HBAR': 0.32,
  'TRX': 0.26,
  'DOGE': 0.38,
  'SHIB': 0.000023,
  'PEPE': 0.000019,
  'BONK': 0.000032,
  'USDT': 1.00,
  'USDC': 1.00,
  'RENDER': 7.80,
  // Additional symbol-based fallbacks for draft crypto assets
  'BNB': 600,
  'MKR': 1500,
  'ALGO': 0.20,
  'ICP': 12,
  'FIL': 5,
  'FLOKI': 0.0002,
  'WIF': 2.50,
  'FET': 1.50,
  'AGIX': 0.80,
  'ASI': 0.80,
  'AKT': 3,
  'TAO': 500,
  'SAND': 0.50,
  'MANA': 0.40,
  'AXS': 7,
  'GALA': 0.04,
  'IMX': 1.50,
  'CRV': 0.50,
  '1INCH': 0.35,
  'SUSHI': 1.20,
  'CAKE': 2.50,
  'SEI': 0.50,
  'DAI': 1.00,
  'FRAX': 1.00,
  'TUSD': 1.00,
  'LDO': 2,
  'RPL': 25,
  'FXS': 5,
  'CBETH': 3400,
  'GRT': 0.15,
  'BAND': 1.50,
  'API3': 1.50,
  'CRO': 0.08,
  'KCS': 8,
  'OKB': 50,
  'LEO': 5,
  'ZEC': 30,
  'DASH': 30,
  'WBTC': 97000,
  'ENS': 20,
  'QNT': 100,
  'VET': 0.03,
  'THETA': 1.50,
  'HNT': 5,
  'AR': 8,
  'RNDR': 7.80,
  'FTM': 0.50,
  'EGLD': 30,
  'RUNE': 5,
  'KAVA': 0.60,
  'CELO': 0.50,
  'PENDLE': 1.23,
  'DYDX': 0.11,
  'CFX': 0.05,
  'SSV': 3.22,
  'MINA': 0.07,
  'STORJ': 0.11,
  'HIGH': 0.15,
  'SUI20947': 0.97,
  'TWT': 0.52,
  'WOO': 0.017,
  'OSMO': 0.037,
  'JOE': 0.038,
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
