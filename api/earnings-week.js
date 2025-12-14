// Vercel Serverless Function - Earnings for tracked stocks
// Endpoint: /api/earnings-week?from=2025-12-15&to=2025-12-21

// Tracked stocks in MarketClash
const TRACKED_STOCKS = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA',
  'JPM', 'V', 'JNJ', 'XOM', 'PG', 'MA', 'HD', 'BAC',
  'UNH', 'DIS', 'NFLX', 'ADBE', 'CRM', 'AMD', 'INTC',
  'KO', 'PEP', 'WMT', 'COST', 'NKE', 'MCD', 'SBUX'
];

// Major stocks that move the market
const MAJOR_STOCKS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA'];

// Historical earnings moves (hardcoded for accuracy)
const EARNINGS_MOVES = {
  NVDA: { stock: 9.5, sector: 2.0 },
  TSLA: { stock: 8.0, sector: 1.5 },
  META: { stock: 6.5, sector: 1.2 },
  AAPL: { stock: 4.5, sector: 1.0 },
  AMZN: { stock: 5.5, sector: 1.3 },
  GOOGL: { stock: 5.0, sector: 1.2 },
  MSFT: { stock: 4.0, sector: 0.8 },
  JPM: { stock: 3.5, sector: 1.5 },
  NFLX: { stock: 7.0, sector: 1.0 },
  AMD: { stock: 6.0, sector: 1.5 },
  CRM: { stock: 5.0, sector: 1.0 },
  DIS: { stock: 4.5, sector: 0.8 },
  V: { stock: 3.0, sector: 0.7 },
  MA: { stock: 3.0, sector: 0.7 },
  BAC: { stock: 3.0, sector: 1.2 },
};

// Strategy tips per stock
const EARNINGS_TIPS = {
  NVDA: "AI bellwether. Guidance matters more than the beat. Stock often runs up before earnings.",
  TSLA: "Highly volatile. Delivery numbers released separately. Watch for margin commentary.",
  META: "Ad revenue and user growth are key. Reality Labs losses always a concern.",
  AAPL: "iPhone sales drive everything. China sales increasingly important.",
  AMZN: "AWS growth is the focus. Retail margins improving but secondary.",
  GOOGL: "Search ads and YouTube. Cloud (GCP) growth rate closely watched.",
  MSFT: "Azure growth rate is THE number. Copilot monetization emerging.",
  JPM: "Sets tone for bank earnings. Net interest income and credit quality key.",
  NFLX: "Subscriber growth is everything. Ad tier performance gaining attention.",
  AMD: "Data center GPU demand vs NVDA. Gaming segment often volatile.",
  CRM: "Enterprise software bellwether. AI features (Einstein) in focus.",
  DIS: "Streaming losses vs Parks performance. Content spending scrutinized.",
  V: "Consumer spending indicator. Cross-border volume important.",
  MA: "Similar to V - consumer health indicator.",
  BAC: "Interest rate sensitivity. Consumer credit quality key.",
};

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const API_KEY = process.env.EODHD_API_KEY;
  const { from, to } = req.query;

  if (!API_KEY) {
    console.error('[Earnings] EODHD_API_KEY not configured');
    return res.status(500).json({ error: 'API not configured' });
  }

  if (!from || !to) {
    return res.status(400).json({ error: 'from and to dates required' });
  }

  try {
    console.log(`[Earnings] Fetching earnings from ${from} to ${to}`);

    // Fetch earnings for date range
    const response = await fetch(
      `https://eodhd.com/api/earnings?api_token=${API_KEY}&fmt=json&from=${from}&to=${to}`
    );

    if (!response.ok) {
      throw new Error(`EODHD API responded with ${response.status}`);
    }

    const allEarnings = await response.json();
    console.log(`[Earnings] Raw earnings received: ${allEarnings.length}`);

    // Filter to only our tracked stocks
    const relevantEarnings = allEarnings.filter(earning =>
      TRACKED_STOCKS.includes(earning.code)
    );
    console.log(`[Earnings] Filtered to ${relevantEarnings.length} tracked stocks`);

    // Transform to our format
    const earnings = relevantEarnings.map(e => ({
      id: `earnings-${e.code}-${e.report_date}`,
      name: `${e.code} Earnings`,
      symbol: e.code,
      type: 'earnings',
      date: e.report_date,
      time: e.before_after_market === 'BeforeMarket' ? '07:00' : '16:30',
      beforeAfterMarket: e.before_after_market,
      impact: MAJOR_STOCKS.includes(e.code) ? 'high' : 'medium',
      expected: e.estimate ? `EPS Est: $${e.estimate}` : null,
      historicalMove: getHistoricalEarningsMove(e.code),
      strategyTip: getEarningsStrategyTip(e.code)
    }));

    console.log(`[Earnings] Returning ${earnings.length} earnings events`);
    return res.status(200).json(earnings);

  } catch (error) {
    console.error('[Earnings] Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}

function getHistoricalEarningsMove(symbol) {
  return EARNINGS_MOVES[symbol] || { stock: 3.0, sector: 0.5 };
}

function getEarningsStrategyTip(symbol) {
  return EARNINGS_TIPS[symbol] || "Watch for guidance and management commentary.";
}
