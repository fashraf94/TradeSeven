/**
 * Static stock lookup data for earnings calendar.
 * Contains priority stocks, company names, and sector mappings.
 *
 * Extracted from earningsCalendarService.js to centralize stock data
 * alongside earningsConfig.js.
 *
 * @module stockData
 */

// =============================================================================
// PRIORITY STOCKS
// Most anticipated earnings that users care about
// Based on Earnings Whispers "Most Anticipated" + major companies
// =============================================================================

export const PRIORITY_STOCKS = new Set([
  // === MEGA CAP TECH (Always Include) ===
  'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'META', 'NVDA', 'TSLA', 'AMD', 'INTC',
  'AVGO', 'ORCL', 'CRM', 'ADBE', 'NFLX', 'CSCO', 'IBM', 'QCOM', 'TXN', 'MU',

  // === THIS WEEK's EARNINGS WHISPERS LIST (Jan 20-24, 2026) ===
  // Tuesday
  'MMM', 'UAL', 'DHI', 'USB', 'IBKR', 'PRGS', 'FAST', 'PEBO', 'KEY', 'OZK',
  'ZION', 'WTFC', 'FOR', 'MBWM',

  // Wednesday
  'JNJ', 'HAL', 'KMI', 'ALLY', 'SCHW', 'TXG', 'PLD', 'TRV', 'BANC',
  'CACI', 'PNFP', 'FCFS', 'RLI', 'BKU', 'EQBK', 'MMYT',

  // Thursday
  'PG', 'ISRG', 'GE', 'COF', 'HBAN', 'AA', 'TXN', 'CSX', 'ABT',
  'EWBC', 'TCBI', 'MKC', 'ACM', 'NG', 'NWLI',

  // Friday
  'SLB', 'ERIC', 'WBS', 'FCNCA', 'BAH', 'CMA', 'ALK', 'CUST',

  // === FINANCIALS (High Interest) ===
  'JPM', 'BAC', 'WFC', 'GS', 'MS', 'C', 'PNC', 'TFC', 'COF', 'AXP',
  'BLK', 'SCHW', 'CME', 'ICE', 'SPGI', 'MCO', 'MMC', 'AON', 'CB',
  'FITB', 'RF', 'CFG', 'MTB', 'HBAN', 'CMA', 'ZION', 'FHN', 'SNV',

  // === HEALTHCARE ===
  'UNH', 'JNJ', 'PFE', 'MRK', 'ABBV', 'LLY', 'TMO', 'ABT', 'DHR', 'BMY',
  'AMGN', 'GILD', 'VRTX', 'REGN', 'ISRG', 'MDT', 'SYK', 'BDX', 'ZTS', 'CI',

  // === CONSUMER ===
  'WMT', 'COST', 'HD', 'TGT', 'LOW', 'NKE', 'SBUX', 'MCD', 'YUM', 'CMG',
  'PG', 'KO', 'PEP', 'PM', 'MO', 'CL', 'KMB', 'GIS', 'K', 'CAG',

  // === INDUSTRIAL ===
  'CAT', 'DE', 'BA', 'HON', 'UPS', 'FDX', 'UNP', 'LMT', 'RTX', 'GD',
  'NOC', 'GE', 'MMM', 'EMR', 'ETN', 'ITW', 'PH', 'ROK', 'CMI', 'PCAR',
  'FAST', 'CACI', 'BAH',

  // === ENERGY ===
  'XOM', 'CVX', 'COP', 'SLB', 'EOG', 'MPC', 'VLO', 'PSX', 'OXY', 'HAL',
  'KMI', 'WMB', 'OKE', 'TRGP',

  // === AIRLINES & TRAVEL ===
  'DAL', 'UAL', 'AAL', 'LUV', 'ALK', 'JBLU', 'MAR', 'HLT', 'ABNB', 'BKNG',

  // === HOMEBUILDERS ===
  'DHI', 'LEN', 'PHM', 'NVR', 'TOL', 'KBH', 'MTH', 'TMHC', 'MDC',

  // === REITS ===
  'AMT', 'PLD', 'EQIX', 'SPG', 'O', 'WELL', 'AVB', 'EQR', 'DLR',

  // === TELECOM ===
  'VZ', 'T', 'TMUS', 'ERIC',

  // === TRANSPORTATION ===
  'CSX', 'NSC', 'UNP', 'JBHT', 'XPO', 'ODFL',

  // === OTHER NOTABLE ===
  'V', 'MA', 'PYPL', 'XYZ', 'COIN', 'SHOP', 'SNOW', 'PLTR', 'NET',
  'DDOG', 'ZS', 'CRWD', 'PANW', 'NOW', 'WDAY'
]);

// =============================================================================
// COMPANY NAMES
// Lookup table for company names (EODHD returns symbol as company name)
// =============================================================================

export const COMPANY_NAMES = {
  // Banks & Finance
  'WFC': 'Wells Fargo', 'BAC': 'Bank of America', 'JPM': 'JPMorgan Chase',
  'GS': 'Goldman Sachs', 'MS': 'Morgan Stanley', 'C': 'Citigroup',
  'USB': 'U.S. Bancorp', 'PNC': 'PNC Financial', 'BLK': 'BlackRock',
  'SCHW': 'Charles Schwab', 'TFC': 'Truist', 'STT': 'State Street',
  'IBKR': 'Interactive Brokers', 'COF': 'Capital One', 'AXP': 'American Express',
  // Big Tech
  'AAPL': 'Apple', 'MSFT': 'Microsoft', 'GOOGL': 'Alphabet', 'GOOG': 'Alphabet',
  'AMZN': 'Amazon', 'META': 'Meta Platforms', 'NVDA': 'NVIDIA', 'TSLA': 'Tesla',
  'NFLX': 'Netflix', 'AMD': 'AMD', 'INTC': 'Intel', 'CRM': 'Salesforce',
  'ORCL': 'Oracle', 'ADBE': 'Adobe', 'IBM': 'IBM', 'CSCO': 'Cisco',
  // Payments & Fintech
  'V': 'Visa', 'MA': 'Mastercard', 'PYPL': 'PayPal', 'XYZ': 'Block',
  'COIN': 'Coinbase', 'HOOD': 'Robinhood', 'SOFI': 'SoFi', 'AFRM': 'Affirm',
  // Healthcare
  'JNJ': 'Johnson & Johnson', 'UNH': 'UnitedHealth', 'PFE': 'Pfizer',
  'MRK': 'Merck', 'ABBV': 'AbbVie', 'LLY': 'Eli Lilly', 'TMO': 'Thermo Fisher',
  'DHR': 'Danaher', 'ABT': 'Abbott Labs', 'BMY': 'Bristol-Myers Squibb',
  'AMGN': 'Amgen', 'GILD': 'Gilead Sciences', 'CVS': 'CVS Health',
  'CI': 'Cigna', 'HUM': 'Humana', 'ELV': 'Elevance Health',
  // Energy
  'XOM': 'Exxon Mobil', 'CVX': 'Chevron', 'COP': 'ConocoPhillips',
  'SLB': 'Schlumberger', 'EOG': 'EOG Resources', 'MPC': 'Marathon Petroleum',
  'PSX': 'Phillips 66', 'VLO': 'Valero Energy', 'OXY': 'Occidental',
  // Retail
  'HD': 'Home Depot', 'LOW': 'Lowes', 'TGT': 'Target', 'WMT': 'Walmart',
  'COST': 'Costco', 'KR': 'Kroger', 'DG': 'Dollar General', 'DLTR': 'Dollar Tree',
  'TJX': 'TJ Maxx', 'ROST': 'Ross Stores', 'BBY': 'Best Buy',
  // Consumer
  'NKE': 'Nike', 'SBUX': 'Starbucks', 'MCD': 'McDonalds', 'CMG': 'Chipotle',
  'DPZ': 'Dominos Pizza', 'YUM': 'Yum Brands', 'KO': 'Coca-Cola', 'PEP': 'PepsiCo',
  'PG': 'Procter & Gamble', 'CL': 'Colgate-Palmolive',
  // Media & Telecom
  'DIS': 'Disney', 'CMCSA': 'Comcast', 'T': 'AT&T', 'VZ': 'Verizon', 'TMUS': 'T-Mobile',
  // Aerospace & Defense
  'BA': 'Boeing', 'LMT': 'Lockheed Martin', 'RTX': 'Raytheon',
  'GD': 'General Dynamics', 'NOC': 'Northrop Grumman',
  // Industrial
  'CAT': 'Caterpillar', 'DE': 'John Deere', 'MMM': '3M', 'HON': 'Honeywell',
  'GE': 'GE Aerospace', 'UPS': 'UPS', 'FDX': 'FedEx',
  // Airlines
  'DAL': 'Delta Air Lines', 'UAL': 'United Airlines', 'AAL': 'American Airlines',
  'LUV': 'Southwest Airlines',
  // Auto
  'F': 'Ford', 'GM': 'General Motors', 'RIVN': 'Rivian', 'LCID': 'Lucid Motors',
  // Semiconductors
  'TSM': 'Taiwan Semiconductor', 'ASML': 'ASML', 'AVGO': 'Broadcom',
  'QCOM': 'Qualcomm', 'TXN': 'Texas Instruments', 'MU': 'Micron',
  'AMAT': 'Applied Materials', 'LRCX': 'Lam Research', 'KLAC': 'KLA Corp',
  'ADI': 'Analog Devices', 'MRVL': 'Marvell', 'ON': 'ON Semiconductor',
  'NXPI': 'NXP Semiconductors',
  // Cloud & Software
  'SNOW': 'Snowflake', 'PLTR': 'Palantir', 'DDOG': 'Datadog', 'NET': 'Cloudflare',
  'ZS': 'Zscaler', 'CRWD': 'CrowdStrike', 'PANW': 'Palo Alto Networks',
  'FTNT': 'Fortinet', 'NOW': 'ServiceNow', 'WDAY': 'Workday',
  'TEAM': 'Atlassian', 'ZM': 'Zoom', 'DOCU': 'DocuSign',
  // Other notable
  'BRK': 'Berkshire Hathaway', 'SPY': 'S&P 500 ETF', 'QQQ': 'Nasdaq 100 ETF'
};

// =============================================================================
// COMPANY SECTORS
// Sector lookup for calculating odds (maps symbol -> sector)
// =============================================================================

export const COMPANY_SECTORS = {
  // Banks & Finance
  'WFC': 'financial', 'BAC': 'financial', 'JPM': 'financial', 'GS': 'financial',
  'MS': 'financial', 'C': 'financial', 'USB': 'financial', 'PNC': 'financial',
  'BLK': 'financial', 'SCHW': 'financial', 'TFC': 'financial', 'STT': 'financial',
  'IBKR': 'financial', 'COF': 'financial', 'AXP': 'financial', 'V': 'financial',
  'MA': 'financial', 'PYPL': 'financial', 'XYZ': 'financial', 'COIN': 'financial',
  'HOOD': 'financial', 'SOFI': 'financial', 'AFRM': 'financial',
  // Big Tech & Software
  'AAPL': 'technology', 'MSFT': 'technology', 'GOOGL': 'technology', 'GOOG': 'technology',
  'AMZN': 'technology', 'META': 'technology', 'NFLX': 'technology', 'CRM': 'technology',
  'ORCL': 'technology', 'ADBE': 'technology', 'IBM': 'technology', 'CSCO': 'technology',
  'SNOW': 'technology', 'PLTR': 'technology', 'DDOG': 'technology', 'NET': 'technology',
  'ZS': 'technology', 'CRWD': 'technology', 'PANW': 'technology', 'FTNT': 'technology',
  'NOW': 'technology', 'WDAY': 'technology', 'TEAM': 'technology', 'ZM': 'technology',
  'DOCU': 'technology',
  // Semiconductors (part of tech)
  'NVDA': 'technology', 'AMD': 'technology', 'INTC': 'technology', 'TSLA': 'technology',
  'TSM': 'technology', 'ASML': 'technology', 'AVGO': 'technology', 'QCOM': 'technology',
  'TXN': 'technology', 'MU': 'technology', 'AMAT': 'technology', 'LRCX': 'technology',
  'KLAC': 'technology', 'ADI': 'technology', 'MRVL': 'technology', 'ON': 'technology',
  'NXPI': 'technology',
  // Healthcare
  'JNJ': 'healthcare', 'UNH': 'healthcare', 'PFE': 'healthcare', 'MRK': 'healthcare',
  'ABBV': 'healthcare', 'LLY': 'healthcare', 'TMO': 'healthcare', 'DHR': 'healthcare',
  'ABT': 'healthcare', 'BMY': 'healthcare', 'AMGN': 'healthcare', 'GILD': 'healthcare',
  'CVS': 'healthcare', 'CI': 'healthcare', 'HUM': 'healthcare', 'ELV': 'healthcare',
  // Energy
  'XOM': 'energy', 'CVX': 'energy', 'COP': 'energy', 'SLB': 'energy',
  'EOG': 'energy', 'MPC': 'energy', 'PSX': 'energy', 'VLO': 'energy', 'OXY': 'energy',
  // Consumer Cyclical
  'HD': 'consumer_cyclical', 'LOW': 'consumer_cyclical', 'TGT': 'consumer_cyclical',
  'COST': 'consumer_cyclical', 'TJX': 'consumer_cyclical', 'ROST': 'consumer_cyclical',
  'BBY': 'consumer_cyclical', 'NKE': 'consumer_cyclical', 'SBUX': 'consumer_cyclical',
  'MCD': 'consumer_cyclical', 'CMG': 'consumer_cyclical', 'DPZ': 'consumer_cyclical',
  'YUM': 'consumer_cyclical', 'DIS': 'consumer_cyclical', 'F': 'consumer_cyclical',
  'GM': 'consumer_cyclical', 'RIVN': 'consumer_cyclical', 'LCID': 'consumer_cyclical',
  // Consumer Defensive
  'WMT': 'consumer_defensive', 'KR': 'consumer_defensive', 'DG': 'consumer_defensive',
  'DLTR': 'consumer_defensive', 'KO': 'consumer_defensive', 'PEP': 'consumer_defensive',
  'PG': 'consumer_defensive', 'CL': 'consumer_defensive',
  // Industrial
  'BA': 'industrial', 'LMT': 'industrial', 'RTX': 'industrial', 'GD': 'industrial',
  'NOC': 'industrial', 'CAT': 'industrial', 'DE': 'industrial', 'MMM': 'industrial',
  'HON': 'industrial', 'GE': 'industrial', 'UPS': 'industrial', 'FDX': 'industrial',
  'DAL': 'industrial', 'UAL': 'industrial', 'AAL': 'industrial', 'LUV': 'industrial',
  // Communication
  'CMCSA': 'communication', 'T': 'communication', 'VZ': 'communication', 'TMUS': 'communication'
};

// =============================================================================
// SECTOR BEAT RATES
// Historical S&P 500 sector earnings beat rates
// =============================================================================

export const SECTOR_BEAT_RATES = {
  technology: 0.78,
  financial: 0.74,
  healthcare: 0.76,
  consumer_cyclical: 0.71,
  consumer_defensive: 0.73,
  industrial: 0.70,
  energy: 0.65,
  communication: 0.75,
  default: 0.70
};
