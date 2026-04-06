// api/_utils/draftStockList.js
// Copy of draft stock symbols for server-side use.
// Source of truth: src/services/draftAssets.js
// ⚠️ api/ functions cannot import from src/ — this is the server-side copy.

export const DRAFT_STOCK_SYMBOLS = [
  // Neutral (25) — Moderate beta, large-cap foundation
  'AAPL', 'MSFT', 'GOOGL', 'AVGO',
  'JPM', 'V', 'MA', 'BAC', 'WFC', 'BRK-B',
  'WMT', 'COST', 'HD', 'NKE', 'SBUX', 'DIS',
  'HON', 'CAT', 'GE', 'GEV', 'UNP',
  'CSCO', 'TXN', 'ABT', 'DHR',

  // Aggressive (25) — High beta, high-growth
  'NVDA', 'TSLA', 'AMD', 'AMZN', 'META',
  'NFLX', 'CRM', 'SHOP', 'PLTR', 'SNOW', 'ADBE', 'QCOM', 'INTC',
  'COIN', 'AFRM', 'HOOD', 'MS',
  'DKNG', 'GME', 'BE', 'RKLB', 'MPC', 'CRWV', 'BA', 'F',

  // Defensive (25) — Low beta, dividends, recession-resistant
  'JNJ', 'MRK', 'BMY', 'GILD', 'AMGN', 'CVS',
  'KO', 'PEP', 'PG', 'GIS',
  'NEE', 'DUK', 'SO', 'D', 'AEP', 'XEL',
  'AMT', 'PLD', 'CCI', 'EQIX',
  'LMT', 'RTX', 'XOM', 'COP', 'PWR',
];

export const DRAFT_STOCKS = DRAFT_STOCK_SYMBOLS;
export const DRAFT_STOCK_SET = new Set(DRAFT_STOCK_SYMBOLS);
