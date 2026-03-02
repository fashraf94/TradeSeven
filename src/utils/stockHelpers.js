// /src/utils/stockHelpers.js

/**
 * Stock sector mapping for common tickers
 */
export const STOCK_SECTORS = {
  // Technology
  AAPL: 'Technology', MSFT: 'Technology', GOOGL: 'Technology', GOOG: 'Technology',
  META: 'Technology', NVDA: 'Technology', AMD: 'Technology', INTC: 'Technology',
  AVGO: 'Technology', QCOM: 'Technology', CRM: 'Technology', ORCL: 'Technology',
  ADBE: 'Technology', NOW: 'Technology', PLTR: 'Technology', SNOW: 'Technology',

  // Consumer
  AMZN: 'Consumer', TSLA: 'Consumer', HD: 'Consumer', MCD: 'Consumer',
  NKE: 'Consumer', SBUX: 'Consumer', TGT: 'Consumer', COST: 'Consumer',
  WMT: 'Consumer', DIS: 'Consumer', NFLX: 'Consumer',

  // Finance
  JPM: 'Finance', BAC: 'Finance', WFC: 'Finance', GS: 'Finance',
  MS: 'Finance', V: 'Finance', MA: 'Finance', AXP: 'Finance',
  BRK: 'Finance', COIN: 'Finance', PYPL: 'Finance', XYZ: 'Finance',

  // Healthcare
  JNJ: 'Healthcare', UNH: 'Healthcare', PFE: 'Healthcare', MRK: 'Healthcare',
  ABBV: 'Healthcare', LLY: 'Healthcare', TMO: 'Healthcare', ABT: 'Healthcare',

  // Energy
  XOM: 'Energy', CVX: 'Energy', COP: 'Energy', SLB: 'Energy',
  EOG: 'Energy', OXY: 'Energy',

  // Industrial
  CAT: 'Industrial', BA: 'Industrial', HON: 'Industrial', UPS: 'Industrial',
  GE: 'Industrial', RTX: 'Industrial', LMT: 'Industrial',

  // Crypto-adjacent
  MSTR: 'Technology', RIOT: 'Technology', MARA: 'Technology',
};

/**
 * Get stock sector by symbol
 */
export const getStockSector = (symbol) => {
  if (!symbol) return null;
  const upperSymbol = symbol.toUpperCase();
  return STOCK_SECTORS[upperSymbol] || null;
};

/**
 * Check if symbol is a crypto ticker
 */
export const isCrypto = (symbol) => {
  if (!symbol) return false;
  const cryptoSymbols = [
    'BTC', 'ETH', 'SOL', 'ADA', 'DOT', 'AVAX', 'MATIC', 'LINK',
    'UNI', 'ATOM', 'XRP', 'DOGE', 'SHIB', 'LTC', 'BCH', 'XLM',
    'NEAR', 'APT', 'ARB', 'OP', 'FTM', 'ALGO', 'VET', 'HBAR'
  ];
  return cryptoSymbols.includes(symbol.toUpperCase());
};

/**
 * Get display name for crypto symbol
 */
export const getCryptoName = (symbol) => {
  const cryptoNames = {
    BTC: 'Bitcoin', ETH: 'Ethereum', SOL: 'Solana', ADA: 'Cardano',
    DOT: 'Polkadot', AVAX: 'Avalanche', MATIC: 'Polygon', LINK: 'Chainlink',
    UNI: 'Uniswap', ATOM: 'Cosmos', XRP: 'XRP', DOGE: 'Dogecoin',
    SHIB: 'Shiba Inu', LTC: 'Litecoin', BCH: 'Bitcoin Cash', XLM: 'Stellar',
    NEAR: 'NEAR Protocol', APT: 'Aptos', ARB: 'Arbitrum', OP: 'Optimism',
  };
  return cryptoNames[symbol?.toUpperCase()] || symbol;
};
