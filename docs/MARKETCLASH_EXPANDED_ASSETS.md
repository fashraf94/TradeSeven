# MarketClash Expanded Asset Database

## Overview

Expanding from 33 assets (15 stocks + 18 crypto) to **82 assets (50 stocks + 32 crypto)** to support full sector coverage for the new Research Flow.

---

## STOCKS: 50 Total

### By Sector

| Sector | Count | Stocks |
|--------|-------|--------|
| Technology | 10 | AAPL, MSFT, NVDA, GOOGL, AMZN, META, TSLA, AVGO, AMD, CRM |
| Finance | 8 | BRK.B, JPM, V, MA, BAC, WFC, GS, AXP |
| Healthcare | 6 | UNH, LLY, JNJ, ABBV, MRK, PFE |
| Consumer Discretionary | 5 | HD, MCD, NKE, SBUX, TGT |
| Consumer Staples | 4 | WMT, PG, KO, PEP, COST |
| Energy | 5 | XOM, CVX, COP, SLB, EOG |
| Industrials | 4 | CAT, RTX, UPS, HON |
| Utilities | 4 | NEE, DUK, SO, D |
| Real Estate | 4 | AMT, PLD, CCI, EQIX |
| Telecom | 3 | VZ, T, TMUS |

---

### Complete Stock List with Sectors

```javascript
const STOCKS = [
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
```

---

## CRYPTO: 32 Total

### By Category

| Category | Count | Coins |
|----------|-------|-------|
| Layer 1 (Major) | 10 | BTC, ETH, SOL, ADA, AVAX, DOT, NEAR, APT, SUI, ATOM |
| Layer 1 (Alt) | 4 | LTC, BCH, XMR, ETC |
| Layer 2 / Scaling | 3 | MATIC, ARB, OP |
| DeFi | 4 | UNI, LINK, AAVE, INJ |
| Payment / Utility | 4 | XRP, XLM, HBAR, TRX |
| Meme | 4 | DOGE, SHIB, PEPE, BONK |
| Stablecoins | 2 | USDT, USDC |
| AI / Emerging | 1 | RENDER |

---

### Complete Crypto List

```javascript
const CRYPTO = [
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
```

---

## Fallback Prices (for offline/error states)

```javascript
const FALLBACK_CRYPTO_PRICES = {
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
};
```

---

## Sector Definitions for Research Flow

```javascript
const STOCK_SECTORS = [
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

const CRYPTO_CATEGORIES = [
  { id: 'layer-1', name: 'Layer 1', icon: '🔷', description: 'Base blockchain protocols' },
  { id: 'layer-2', name: 'Layer 2', icon: '⚡', description: 'Scaling solutions' },
  { id: 'defi', name: 'DeFi', icon: '🏛️', description: 'Decentralized finance' },
  { id: 'payment', name: 'Payment', icon: '💸', description: 'Payment & utility tokens' },
  { id: 'meme', name: 'Meme', icon: '🐕', description: 'Community-driven meme coins' },
  { id: 'stablecoin', name: 'Stablecoin', icon: '💵', description: 'Dollar-pegged tokens' },
  { id: 'ai', name: 'AI', icon: '🤖', description: 'AI & compute tokens' },
];
```

---

## API Budget Impact

### Current (33 assets)
- Price refresh every 30s: ~63K calls/day
- Remaining: ~37K calls/day

### After Expansion (82 assets)
- Price refresh every 30s: ~157K calls/day ⚠️ **OVER LIMIT**

### Solutions

**Option 1: Increase refresh interval**
- 60s refresh: ~78K calls/day ✅
- 2min refresh: ~39K calls/day ✅✅

**Option 2: Smart refresh (recommended)**
- Active battle assets: 30s refresh
- Research browsing: 2min refresh
- Idle/background: 5min refresh

**Option 3: Batch API calls**
- EODHD supports bulk endpoints
- 1 call for all stocks instead of 50 individual calls

---

## Files to Update

1. **`/api/stocks/prices.js`** - Add new stock symbols
2. **`/api/crypto/prices.js`** - Add new crypto IDs
3. **`/src/services/eodhdAPI.js`** - Update asset lists
4. **`App.jsx`** - Update Research Mode with sector filtering
5. **Create `/src/data/assets.js`** - Centralized asset definitions

---

## Implementation Priority

1. ✅ Create this specification document
2. 🔲 Create centralized `/src/data/assets.js`
3. 🔲 Update Vercel serverless functions
4. 🔲 Update eodhdAPI.js service
5. 🔲 Update Research Mode UI with sector filters
6. 🔲 Test API budget with expanded list
7. 🔲 Implement smart refresh logic if needed

---

*Document created: December 15, 2025*
*For: MarketClash Research Flow v2*
