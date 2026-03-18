// api/_utils/fantasyTimesTickers.js
// Expanded ticker universe for FantasyTimes reporters.
// Sourced from src/data/assets.js — 50 US stocks across 10 sectors.
// Knowledge packages (stockIntelligenceData.js) are optional enrichment;
// stocks without them still get stories from EODHD price data + news.

export const FANTASYTIMES_TICKERS = [
  // Technology (10)
  'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA', 'AVGO', 'AMD', 'CRM',
  // Finance (8)
  'BRK-B', 'JPM', 'V', 'MA', 'BAC', 'WFC', 'GS', 'AXP',
  // Healthcare (6)
  'UNH', 'LLY', 'JNJ', 'ABBV', 'MRK', 'PFE',
  // Consumer Discretionary (5)
  'HD', 'MCD', 'NKE', 'SBUX', 'TGT',
  // Consumer Staples (5)
  'WMT', 'PG', 'KO', 'PEP', 'COST',
  // Energy (5)
  'XOM', 'CVX', 'COP', 'SLB', 'EOG',
  // Industrials (4)
  'CAT', 'RTX', 'UPS', 'HON',
  // Utilities (4)
  'NEE', 'DUK', 'SO', 'D',
  // Real Estate (4)
  'AMT', 'PLD', 'CCI', 'EQIX',
  // Telecom (3)
  'VZ', 'T', 'TMUS',
];

// Symbol → sector lookup for stories on stocks outside stockIntelligenceData
export const SECTOR_MAP = {
  AAPL: 'Technology', MSFT: 'Technology', NVDA: 'Technology', GOOGL: 'Technology',
  AMZN: 'Technology', META: 'Technology', TSLA: 'Technology', AVGO: 'Technology',
  AMD: 'Technology', CRM: 'Technology',
  'BRK-B': 'Finance', JPM: 'Finance', V: 'Finance', MA: 'Finance',
  BAC: 'Finance', WFC: 'Finance', GS: 'Finance', AXP: 'Finance',
  UNH: 'Healthcare', LLY: 'Healthcare', JNJ: 'Healthcare', ABBV: 'Healthcare',
  MRK: 'Healthcare', PFE: 'Healthcare',
  HD: 'Consumer Discretionary', MCD: 'Consumer Discretionary', NKE: 'Consumer Discretionary',
  SBUX: 'Consumer Discretionary', TGT: 'Consumer Discretionary',
  WMT: 'Consumer Staples', PG: 'Consumer Staples', KO: 'Consumer Staples',
  PEP: 'Consumer Staples', COST: 'Consumer Staples',
  XOM: 'Energy', CVX: 'Energy', COP: 'Energy', SLB: 'Energy', EOG: 'Energy',
  CAT: 'Industrials', RTX: 'Industrials', UPS: 'Industrials', HON: 'Industrials',
  NEE: 'Utilities', DUK: 'Utilities', SO: 'Utilities', D: 'Utilities',
  AMT: 'Real Estate', PLD: 'Real Estate', CCI: 'Real Estate', EQIX: 'Real Estate',
  VZ: 'Telecom', T: 'Telecom', TMUS: 'Telecom',
};
