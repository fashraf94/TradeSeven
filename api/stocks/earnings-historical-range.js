// Vercel Serverless Function - Historical Earnings by Date Range
// Endpoint: /api/stocks/earnings-historical-range?startDate=2026-01-19&endDate=2026-01-24
//
// Fetches historical earnings from EODHD fundamentals for priority stocks
// Returns events that reported within the specified date range

import { applySecurityMiddleware } from '../_utils/security.js';

// Priority stocks to check for historical earnings
const PRIORITY_STOCKS = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'TSLA', 'AMD', 'NFLX', 'INTC',
  'CRM', 'ORCL', 'ADBE', 'CSCO', 'IBM', 'QCOM', 'TXN', 'AVGO', 'MU', 'AMAT',
  'JPM', 'BAC', 'WFC', 'GS', 'MS', 'C', 'AXP', 'V', 'MA', 'PYPL',
  'JNJ', 'UNH', 'PFE', 'MRK', 'ABBV', 'LLY', 'TMO', 'ABT', 'BMY', 'AMGN',
  'PG', 'KO', 'PEP', 'WMT', 'COST', 'HD', 'MCD', 'NKE', 'SBUX', 'TGT',
  'DIS', 'CMCSA', 'T', 'VZ', 'TMUS',
  'XOM', 'CVX', 'COP', 'SLB', 'EOG',
  'BA', 'CAT', 'HON', 'GE', 'MMM', 'UPS', 'FDX', 'LMT', 'RTX', 'DE',
  'UAL', 'DAL', 'AAL', 'LUV',
  'F', 'GM', 'RIVN', 'LCID',
  'SQ', 'SHOP', 'COIN', 'HOOD', 'SOFI', 'AFRM', 'UPST',
  'SNOW', 'PLTR', 'DDOG', 'NET', 'ZS', 'CRWD', 'PANW', 'OKTA', 'MDB', 'TEAM',
  'UBER', 'LYFT', 'ABNB', 'DASH', 'RBLX', 'U', 'SNAP', 'PINS', 'TWLO', 'ZM',
  'NOW', 'WDAY', 'VEEV', 'SPLK', 'FTNT', 'ANSS', 'CDNS', 'SNPS', 'KLAC', 'LRCX',
  'AAP', 'AZO', 'ORLY', 'BBY', 'DLTR', 'DG', 'ROST', 'TJX', 'LOW',
  'CMG', 'DPZ', 'YUM', 'QSR', 'WING',
  'LEN', 'DHI', 'TOL', 'PHM', 'NVR',
  'SPG', 'PLD', 'AMT', 'CCI', 'EQIX', 'DLR', 'PSA', 'O', 'WELL', 'AVB',
  'ICE', 'CME', 'SPGI', 'MCO', 'MSCI', 'FIS', 'FISV', 'GPN', 'ADP', 'PAYX'
];

// Company names for display
const COMPANY_NAMES = {
  'AAPL': 'Apple Inc.', 'MSFT': 'Microsoft', 'GOOGL': 'Alphabet (Google)', 'AMZN': 'Amazon',
  'META': 'Meta Platforms', 'NVDA': 'NVIDIA', 'TSLA': 'Tesla', 'AMD': 'AMD',
  'NFLX': 'Netflix', 'INTC': 'Intel', 'CRM': 'Salesforce', 'ORCL': 'Oracle',
  'ADBE': 'Adobe', 'CSCO': 'Cisco', 'IBM': 'IBM', 'QCOM': 'Qualcomm',
  'JPM': 'JPMorgan Chase', 'BAC': 'Bank of America', 'WFC': 'Wells Fargo', 'GS': 'Goldman Sachs',
  'JNJ': 'Johnson & Johnson', 'UNH': 'UnitedHealth', 'PFE': 'Pfizer', 'MRK': 'Merck',
  'PG': 'Procter & Gamble', 'KO': 'Coca-Cola', 'PEP': 'PepsiCo', 'WMT': 'Walmart',
  'DIS': 'Disney', 'CMCSA': 'Comcast', 'T': 'AT&T', 'VZ': 'Verizon',
  'XOM': 'Exxon Mobil', 'CVX': 'Chevron', 'BA': 'Boeing', 'CAT': 'Caterpillar',
  'UAL': 'United Airlines', 'DAL': 'Delta Airlines', 'AAL': 'American Airlines',
  'F': 'Ford', 'GM': 'General Motors', 'UBER': 'Uber', 'LYFT': 'Lyft',
  'ABNB': 'Airbnb', 'COIN': 'Coinbase', 'SNOW': 'Snowflake', 'PLTR': 'Palantir',
  'HD': 'Home Depot', 'LOW': "Lowe's", 'COST': 'Costco', 'TGT': 'Target',
  'MCD': "McDonald's", 'SBUX': 'Starbucks', 'NKE': 'Nike', 'LLY': 'Eli Lilly',
  'V': 'Visa', 'MA': 'Mastercard', 'PYPL': 'PayPal', 'SQ': 'Block (Square)'
};

// Sector assignments for odds calculation
const SECTOR_BEAT_RATES = {
  'tech': 0.72, 'finance': 0.68, 'healthcare': 0.65, 'consumer': 0.70,
  'energy': 0.60, 'industrial': 0.65, 'telecom': 0.62, 'default': 0.67
};

const COMPANY_SECTORS = {
  'AAPL': 'tech', 'MSFT': 'tech', 'GOOGL': 'tech', 'AMZN': 'tech', 'META': 'tech',
  'NVDA': 'tech', 'TSLA': 'tech', 'AMD': 'tech', 'NFLX': 'tech', 'INTC': 'tech',
  'JPM': 'finance', 'BAC': 'finance', 'WFC': 'finance', 'GS': 'finance', 'V': 'finance',
  'JNJ': 'healthcare', 'UNH': 'healthcare', 'PFE': 'healthcare', 'MRK': 'healthcare', 'LLY': 'healthcare',
  'PG': 'consumer', 'KO': 'consumer', 'PEP': 'consumer', 'WMT': 'consumer', 'MCD': 'consumer',
  'XOM': 'energy', 'CVX': 'energy', 'COP': 'energy',
  'BA': 'industrial', 'CAT': 'industrial', 'UAL': 'industrial', 'DAL': 'industrial'
};

export default async function handler(req, res) {
  // Security middleware
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 10, windowMs: 60000 } })) {
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'startDate and endDate required (YYYY-MM-DD format)' });
  }

  const API_KEY = process.env.EODHD_API_KEY;
  if (!API_KEY) {
    console.error('[historical-range] EODHD_API_KEY not configured');
    return res.status(500).json({ error: 'API key not configured' });
  }

  console.log(`[historical-range] Fetching earnings from ${startDate} to ${endDate}`);

  const startDateObj = new Date(startDate + 'T00:00:00');
  const endDateObj = new Date(endDate + 'T23:59:59');

  console.log(`[historical-range] Date range: ${startDateObj.toISOString()} to ${endDateObj.toISOString()}`);

  const events = [];
  const errors = [];

  // Process in batches to avoid rate limits
  const batchSize = 5;
  const stocksToCheck = PRIORITY_STOCKS.slice(0, 50); // Check top 50 priority stocks

  for (let i = 0; i < stocksToCheck.length; i += batchSize) {
    const batch = stocksToCheck.slice(i, i + batchSize);
    console.log(`[historical-range] Processing batch ${Math.floor(i / batchSize) + 1}: ${batch.join(', ')}`);

    const batchResults = await Promise.all(batch.map(async (symbol) => {
      try {
        const url = `https://eodhd.com/api/fundamentals/${symbol}.US?api_token=${API_KEY}&fmt=json`;
        const response = await fetch(url);

        if (!response.ok) {
          console.warn(`[historical-range] Failed to fetch ${symbol}: ${response.status}`);
          return [];
        }

        const data = await response.json();
        const history = data?.Earnings?.History || {};
        const generalInfo = data?.General || {};
        const foundEvents = [];

        // Find earnings within date range
        for (const [key, values] of Object.entries(history)) {
          const reportDate = values.reportDate || key;

          // Parse report date
          const reportDateObj = new Date(reportDate + 'T12:00:00'); // Noon to avoid timezone issues

          // Check if within date range
          if (reportDateObj >= startDateObj && reportDateObj <= endDateObj) {
            // Only include if we have EPS data (meaning it's a real past earnings)
            if (values.epsActual !== null && values.epsActual !== undefined) {
              const companyName = COMPANY_NAMES[symbol.toUpperCase()] || generalInfo.Name || symbol;
              const sector = COMPANY_SECTORS[symbol.toUpperCase()] || 'default';
              const beatOdds = SECTOR_BEAT_RATES[sector] || 0.70;

              foundEvents.push({
                id: `historical_${symbol}_${reportDate}`,
                symbol: symbol.toUpperCase(),
                companyName,
                reportDate: reportDate.split('T')[0], // Ensure YYYY-MM-DD format
                reportTime: values.beforeAfterMarket || 'TBD',
                beatOdds,
                missOdds: 1 - beatOdds,
                source: 'historical_fundamentals',
                sector,
                // Include actual result for reference
                _actual: {
                  epsActual: values.epsActual,
                  epsEstimate: values.epsEstimate,
                  didBeat: values.epsActual > values.epsEstimate,
                  surprisePercent: values.surprisePercent
                }
              });

              console.log(`[historical-range] Found ${symbol} reported on ${reportDate} (EPS: ${values.epsActual} vs est ${values.epsEstimate})`);
            }
          }
        }

        return foundEvents;
      } catch (error) {
        console.warn(`[historical-range] Error fetching ${symbol}:`, error.message);
        errors.push({ symbol, error: error.message });
        return [];
      }
    }));

    // Flatten and add to events
    batchResults.forEach(result => events.push(...result));

    // Small delay between batches to avoid rate limits
    if (i + batchSize < stocksToCheck.length) {
      await new Promise(r => setTimeout(r, 200));
    }
  }

  console.log(`[historical-range] Found ${events.length} events between ${startDate} and ${endDate}`);

  // Sort by date
  events.sort((a, b) => new Date(a.reportDate) - new Date(b.reportDate));

  // Log the events found
  if (events.length > 0) {
    console.log('[historical-range] Events found:');
    events.forEach(e => console.log(`  - ${e.symbol}: ${e.reportDate} (${e.companyName})`));
  }

  return res.status(200).json({
    success: true,
    startDate,
    endDate,
    count: events.length,
    stocksChecked: stocksToCheck.length,
    events,
    errors: errors.length > 0 ? errors : undefined
  });
}
