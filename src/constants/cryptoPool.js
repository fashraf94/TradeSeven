// cryptoPool.js — BaggerBomb V5 Swap Market constants
// Top 7 crypto always available in the Swap Market crypto pool
// These never rotate out — users can swap them in/out at any time

// baseATR = typical daily range as percentage (higher = more volatile = wider thresholds)
export const BAGGERBOMB_CRYPTO_POOL = [
  { symbol: 'BTC', name: 'Bitcoin', baseATR: 5, isCrypto: true },       // ~5% daily range
  { symbol: 'ETH', name: 'Ethereum', baseATR: 5, isCrypto: true },      // ~5% daily range
  { symbol: 'SOL', name: 'Solana', baseATR: 6, isCrypto: true },        // ~6% — higher vol
  { symbol: 'XRP', name: 'XRP', baseATR: 5.5, isCrypto: true },         // ~5.5%
  { symbol: 'DOGE', name: 'Dogecoin', baseATR: 7, isCrypto: true },     // ~7% — meme coin vol
  { symbol: 'ADA', name: 'Cardano', baseATR: 6, isCrypto: true },       // ~6%
  { symbol: 'BNB', name: 'BNB', baseATR: 5, isCrypto: true },           // ~5% daily range
];

// Set of crypto pool symbols for fast lookup
export const CRYPTO_POOL_SYMBOLS = new Set(
  BAGGERBOMB_CRYPTO_POOL.map(c => c.symbol)
);

// Valid directions for crypto positions
export const POSITION_DIRECTIONS = {
  LONG: 'long',
  SHORT: 'short',
};

// Cash position placeholder
export const CASH_POSITION = {
  symbol: 'CASH',
  name: 'Cash',
  baseATR: 0,    // Cash earns 0 points — no volatility
  isCrypto: false,
  isCash: true,
};
