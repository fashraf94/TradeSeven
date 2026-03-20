// src/constants/indexRegistry.js
// Shared constant identifying index ETF symbols for frontend use.

export const INDEX_REGISTRY = {
  SPY: { name: 'S&P 500', etf: 'SPY', color: '#00D9FF', description: 'Broad market benchmark' },
  QQQ: { name: 'Nasdaq 100', etf: 'QQQ', color: '#A78BFA', description: 'Tech/growth leadership' },
  DIA: { name: 'Dow Jones', etf: 'DIA', color: '#FFD700', description: 'Blue-chip sentiment' },
  IWM: { name: 'Russell 2000', etf: 'IWM', color: '#10B981', description: 'Small-cap risk appetite' },
};

export const INDEX_SYMBOLS = new Set(Object.keys(INDEX_REGISTRY));
export const isIndex = (symbol) => INDEX_SYMBOLS.has(symbol);
