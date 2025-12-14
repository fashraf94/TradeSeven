// Vercel Serverless Function - Economic Events Calendar
// Endpoint: /api/events/economic-calendar?from=2025-12-01&to=2025-12-31

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { from, to } = req.query;
  const API_KEY = process.env.EODHD_API_KEY;

  if (!API_KEY) {
    console.error('EODHD_API_KEY not configured');
    return res.status(500).json({ error: 'API not configured' });
  }

  // Default date range: current month
  const fromDate = from || new Date().toISOString().split('T')[0];
  const toDate = to || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  try {
    console.log(`[API] Fetching economic events from ${fromDate} to ${toDate}`);

    const response = await fetch(
      `https://eodhd.com/api/economic-events?api_token=${API_KEY}&fmt=json&from=${fromDate}&to=${toDate}&country=US`
    );

    if (!response.ok) {
      throw new Error(`EODHD API responded with ${response.status}`);
    }

    const rawEvents = await response.json();

    // Filter and transform to relevant events
    const transformedEvents = rawEvents
      .filter(isRelevantEvent)
      .map(transformEvent)
      .sort((a, b) => new Date(a.date + 'T' + a.time) - new Date(b.date + 'T' + b.time));

    console.log(`[API] Found ${transformedEvents.length} relevant economic events`);

    return res.status(200).json({
      success: true,
      events: transformedEvents
    });

  } catch (error) {
    console.error('[API] Economic calendar error:', error.message);
    return res.status(500).json({
      error: 'Failed to fetch economic calendar',
      message: error.message
    });
  }
}

// Check if event is relevant to MarketClash users
function isRelevantEvent(event) {
  const relevantKeywords = [
    'interest rate',
    'federal funds',
    'fomc',
    'cpi',
    'consumer price',
    'inflation',
    'non-farm payroll',
    'nfp',
    'employment',
    'unemployment',
    'gdp',
    'gross domestic',
    'pce',
    'personal consumption',
    'retail sales',
    'fed',
    'federal reserve',
    'powell',
    'manufacturing pmi',
    'services pmi'
  ];

  const eventLower = (event.event || '').toLowerCase();
  return relevantKeywords.some(keyword => eventLower.includes(keyword));
}

// Transform EODHD event to our format
function transformEvent(event) {
  const eventType = categorizeEvent(event.event);

  return {
    id: `eco_${event.date}_${hashCode(event.event)}`,
    name: event.event,
    type: eventType.type,
    impact: eventType.impact,
    date: event.date,
    time: event.time || '09:00',
    timezone: 'America/New_York',

    // Expectations
    expected: event.estimate || event.forecast || null,
    previous: event.previous || event.actual || null,
    actual: event.actual || null,

    // Historical volatility (static estimates based on event type)
    historicalData: getHistoricalVolatility(eventType.type),

    // Strategy tip
    strategyTip: getStrategyTip(eventType.type),

    // Related assets
    relatedAssets: getRelatedAssets(eventType.type)
  };
}

function categorizeEvent(eventName) {
  const lower = (eventName || '').toLowerCase();

  if (lower.includes('interest rate') || lower.includes('federal funds') || lower.includes('fomc')) {
    return { type: 'fed_decision', impact: 'high' };
  }
  if (lower.includes('cpi') || lower.includes('consumer price') || lower.includes('inflation')) {
    return { type: 'cpi', impact: 'high' };
  }
  if (lower.includes('non-farm') || lower.includes('nfp') || lower.includes('employment')) {
    return { type: 'jobs_report', impact: 'high' };
  }
  if (lower.includes('gdp')) {
    return { type: 'gdp', impact: 'medium' };
  }
  if (lower.includes('pce') || lower.includes('personal consumption')) {
    return { type: 'pce', impact: 'medium' };
  }
  if (lower.includes('fed minutes')) {
    return { type: 'fed_minutes', impact: 'medium' };
  }
  if (lower.includes('retail sales')) {
    return { type: 'retail_sales', impact: 'medium' };
  }
  if (lower.includes('pmi')) {
    return { type: 'pmi', impact: 'low' };
  }

  return { type: 'other', impact: 'low' };
}

function getHistoricalVolatility(eventType) {
  const volatilityData = {
    fed_decision: {
      avgMarketMove: 1.8,
      avgHighBetaMove: 3.2,
      avgCryptoMove: 4.5,
      description: 'Fed decisions historically cause significant market moves'
    },
    cpi: {
      avgMarketMove: 1.4,
      avgHighBetaMove: 2.8,
      avgCryptoMove: 3.5,
      description: 'Inflation data directly impacts Fed rate expectations'
    },
    jobs_report: {
      avgMarketMove: 1.2,
      avgHighBetaMove: 2.4,
      avgCryptoMove: 2.8,
      description: 'Employment data influences Fed policy outlook'
    },
    gdp: {
      avgMarketMove: 0.8,
      avgHighBetaMove: 1.6,
      avgCryptoMove: 1.5,
      description: 'GDP data reflects overall economic health'
    },
    pce: {
      avgMarketMove: 0.9,
      avgHighBetaMove: 1.8,
      avgCryptoMove: 2.0,
      description: 'PCE is the Fed\'s preferred inflation measure'
    },
    fed_minutes: {
      avgMarketMove: 0.6,
      avgHighBetaMove: 1.2,
      avgCryptoMove: 1.5,
      description: 'Minutes reveal Fed member sentiment'
    }
  };

  return volatilityData[eventType] || {
    avgMarketMove: 0.5,
    avgHighBetaMove: 1.0,
    avgCryptoMove: 1.2,
    description: 'Minor market impact expected'
  };
}

function getStrategyTip(eventType) {
  const tips = {
    fed_decision: 'Markets often price in expectations before the announcement. Surprise cuts = rally, surprise holds = volatility spike.',
    cpi: 'Higher than expected = rate fears = sell-off. Lower than expected = rate cut hopes = rally.',
    jobs_report: 'Strong jobs = hawkish Fed concerns. Weak jobs = growth fears. Either extreme causes volatility.',
    gdp: 'GDP data is backward-looking. Markets react more to surprises than to the absolute number.',
    pce: 'PCE is the Fed\'s preferred inflation gauge. Moves similar to CPI but often less dramatic.',
    fed_minutes: 'Look for hints about future policy direction. Hawkish language = caution, dovish = risk-on.'
  };

  return tips[eventType] || 'Monitor the market reaction and be prepared for increased volatility.';
}

function getRelatedAssets(eventType) {
  const assets = {
    fed_decision: ['JPM', 'BAC', 'GS', 'MS', 'V'],
    cpi: ['TLT', 'GLD', 'XLF', 'XLE'],
    jobs_report: ['XLI', 'XLY', 'HD', 'LOW'],
    gdp: ['SPY', 'QQQ', 'IWM'],
    pce: ['XLP', 'XLU', 'PG', 'KO'],
    fed_minutes: ['TLT', 'XLF', 'JPM']
  };

  return assets[eventType] || [];
}

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).substring(0, 8);
}
