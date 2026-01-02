// Sector definitions for BaggerBomb Game Plan Generator
// Based on SPDR Sector ETFs

export const SECTORS = {
  XLK: {
    id: 'XLK',
    name: 'Technology',
    emoji: '💻',
    color: '#3b82f6',
    description: 'Software, hardware, semiconductors, IT services',
    topHoldings: ['AAPL', 'MSFT', 'NVDA', 'AVGO', 'ORCL', 'CRM', 'AMD', 'ADBE', 'CSCO', 'ACN', 'IBM', 'INTC', 'QCOM', 'TXN', 'NOW', 'INTU', 'AMAT', 'MU', 'LRCX', 'KLAC']
  },
  XLV: {
    id: 'XLV',
    name: 'Healthcare',
    emoji: '🏥',
    color: '#10b981',
    description: 'Pharmaceuticals, biotech, medical devices, healthcare providers',
    topHoldings: ['LLY', 'UNH', 'JNJ', 'ABBV', 'MRK', 'TMO', 'ABT', 'PFE', 'AMGN', 'DHR', 'ISRG', 'MDT', 'BMY', 'VRTX', 'SYK', 'GILD', 'CVS', 'ELV', 'CI', 'BSX']
  },
  XLF: {
    id: 'XLF',
    name: 'Financials',
    emoji: '🏦',
    color: '#f59e0b',
    description: 'Banks, insurance, asset management, fintech',
    topHoldings: ['BRK.B', 'JPM', 'V', 'MA', 'BAC', 'WFC', 'GS', 'MS', 'SPGI', 'AXP', 'PGR', 'BLK', 'C', 'MMC', 'CB', 'SCHW', 'ICE', 'CME', 'AON', 'USB']
  },
  XLE: {
    id: 'XLE',
    name: 'Energy',
    emoji: '⛽',
    color: '#ef4444',
    description: 'Oil & gas, energy equipment, renewable energy',
    topHoldings: ['XOM', 'CVX', 'COP', 'SLB', 'EOG', 'MPC', 'PXD', 'PSX', 'VLO', 'OXY', 'WMB', 'KMI', 'HES', 'HAL', 'DVN', 'BKR', 'FANG', 'TRGP', 'OKE', 'CTRA']
  },
  XLY: {
    id: 'XLY',
    name: 'Consumer Discretionary',
    emoji: '🛍️',
    color: '#8b5cf6',
    description: 'Retail, automotive, restaurants, entertainment',
    topHoldings: ['AMZN', 'TSLA', 'HD', 'MCD', 'NKE', 'LOW', 'BKNG', 'SBUX', 'TJX', 'ORLY', 'CMG', 'MAR', 'GM', 'F', 'DHI', 'AZO', 'ROST', 'LEN', 'YUM', 'EBAY']
  },
  XLP: {
    id: 'XLP',
    name: 'Consumer Staples',
    emoji: '🛒',
    color: '#06b6d4',
    description: 'Food, beverages, household products, retail staples',
    topHoldings: ['PG', 'COST', 'WMT', 'KO', 'PEP', 'PM', 'MDLZ', 'MO', 'CL', 'KMB', 'GIS', 'STZ', 'SYY', 'KHC', 'HSY', 'K', 'KR', 'WBA', 'TSN', 'CAG']
  },
  XLI: {
    id: 'XLI',
    name: 'Industrials',
    emoji: '🏭',
    color: '#6366f1',
    description: 'Aerospace, defense, machinery, transportation',
    topHoldings: ['GE', 'CAT', 'RTX', 'UNP', 'HON', 'DE', 'BA', 'LMT', 'UPS', 'ADP', 'ETN', 'ITW', 'NOC', 'GD', 'WM', 'CSX', 'NSC', 'MMM', 'EMR', 'FDX']
  },
  XLB: {
    id: 'XLB',
    name: 'Materials',
    emoji: '🧱',
    color: '#84cc16',
    description: 'Chemicals, metals, mining, construction materials',
    topHoldings: ['LIN', 'SHW', 'APD', 'FCX', 'ECL', 'NEM', 'NUE', 'DOW', 'DD', 'CTVA', 'PPG', 'VMC', 'MLM', 'ALB', 'IFF', 'CE', 'CF', 'MOS', 'FMC', 'PKG']
  },
  XLU: {
    id: 'XLU',
    name: 'Utilities',
    emoji: '💡',
    color: '#f97316',
    description: 'Electric, gas, water utilities, renewable power',
    topHoldings: ['NEE', 'SO', 'DUK', 'CEG', 'SRE', 'AEP', 'D', 'PCG', 'EXC', 'XEL', 'PEG', 'ED', 'WEC', 'EIX', 'AWK', 'DTE', 'ETR', 'PPL', 'FE', 'AEE']
  },
  XLRE: {
    id: 'XLRE',
    name: 'Real Estate',
    emoji: '🏢',
    color: '#ec4899',
    description: 'REITs, real estate services, property management',
    topHoldings: ['PLD', 'AMT', 'EQIX', 'WELL', 'SPG', 'PSA', 'DLR', 'O', 'CCI', 'VICI', 'SBAC', 'AVB', 'EQR', 'WY', 'EXR', 'ARE', 'MAA', 'VTR', 'IRM', 'UDR']
  },
  XLC: {
    id: 'XLC',
    name: 'Communication Services',
    emoji: '📡',
    color: '#14b8a6',
    description: 'Telecom, media, entertainment, social platforms',
    topHoldings: ['META', 'GOOGL', 'GOOG', 'NFLX', 'T', 'VZ', 'DIS', 'CMCSA', 'TMUS', 'CHTR', 'EA', 'WBD', 'OMC', 'TTWO', 'LYV', 'IPG', 'MTCH', 'PARA', 'FOXA', 'NWS']
  }
};

export const CRYPTO_SECTOR = {
  id: 'CRYPTO',
  name: 'Cryptocurrency',
  emoji: '₿',
  color: '#f7931a',
  description: 'Digital assets and blockchain tokens',
  topHoldings: ['BTC', 'ETH', 'SOL', 'ADA', 'DOT', 'AVAX', 'MATIC', 'LINK', 'UNI', 'XRP']
};

export const SECTOR_ORDER = ['XLK', 'XLV', 'XLF', 'XLE', 'XLY', 'XLP', 'XLI', 'XLB', 'XLU', 'XLRE', 'XLC'];

export default SECTORS;
