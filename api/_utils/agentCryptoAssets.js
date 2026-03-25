// Crypto assets available for agent portfolio construction
// Mirrors src/constants/cryptoPool.js — kept separate since API can't import from src/

export const CRYPTO_ASSETS = [
  { symbol: 'BTC', name: 'Bitcoin', baseATR: 5, isCrypto: true },
  { symbol: 'ETH', name: 'Ethereum', baseATR: 5, isCrypto: true },
  { symbol: 'SOL', name: 'Solana', baseATR: 6, isCrypto: true },
  { symbol: 'XRP', name: 'XRP', baseATR: 5.5, isCrypto: true },
  { symbol: 'DOGE', name: 'Dogecoin', baseATR: 7, isCrypto: true },
  { symbol: 'ADA', name: 'Cardano', baseATR: 6, isCrypto: true },
  { symbol: 'BNB', name: 'BNB', baseATR: 5, isCrypto: true },
];

export const VALID_CRYPTO_SYMBOLS = CRYPTO_ASSETS.map((c) => c.symbol);

export const getCryptoBySymbol = (symbol) =>
  CRYPTO_ASSETS.find((c) => c.symbol === symbol) || null;
