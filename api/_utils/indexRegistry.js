// api/_utils/indexRegistry.js
// Server-side index registry. Separate from src/constants/ because api/ cannot import from src/.

export const INDEX_REGISTRY = {
  SPY: { name: 'S&P 500', etf: 'SPY' },
  QQQ: { name: 'Nasdaq 100', etf: 'QQQ' },
  DIA: { name: 'Dow Jones', etf: 'DIA' },
  IWM: { name: 'Russell 2000', etf: 'IWM' },
};

export const INDEX_SYMBOLS = new Set(Object.keys(INDEX_REGISTRY));
export const isIndex = (symbol) => INDEX_SYMBOLS.has(symbol);
