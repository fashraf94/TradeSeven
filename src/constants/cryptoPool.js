// cryptoPool.js — BaggerBomb V5 Swap Market constants
// Top 7 crypto always available in the Swap Market crypto pool
// These never rotate out — users can swap them in/out at any time

export const BAGGERBOMB_CRYPTO_POOL = [
  { symbol: 'BTC', name: 'Bitcoin', baseATR: 5, isCrypto: true },
  { symbol: 'ETH', name: 'Ethereum', baseATR: 5, isCrypto: true },
  { symbol: 'SOL', name: 'Solana', baseATR: 6, isCrypto: true },
  { symbol: 'XRP', name: 'XRP', baseATR: 5.5, isCrypto: true },
  { symbol: 'DOGE', name: 'Dogecoin', baseATR: 7, isCrypto: true },
  { symbol: 'ADA', name: 'Cardano', baseATR: 6, isCrypto: true },
  { symbol: 'BNB', name: 'BNB', baseATR: 5, isCrypto: true },
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
  baseATR: 0,
  isCrypto: false,
  isCash: true,
};

// Initial cryptoPool state for V5 battle documents
export function createInitialCryptoPoolState() {
  const state = {};
  BAGGERBOMB_CRYPTO_POOL.forEach(c => {
    state[c.symbol] = { inRoster: false };
  });
  return state;
}
