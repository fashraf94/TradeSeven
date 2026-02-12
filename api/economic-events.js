// api/economic-events.js
// Fetches live economic events from EODHD Economic Events API
// Returns US events for the next 14 days, scored by importance

import { applySecurityMiddleware } from './_utils/security.js';

const IMPORTANT_TYPES = [
  'CPI', 'Consumer Price Index',
  'PPI', 'Producer Price Index',
  'GDP', 'Gross Domestic Product',
  'Nonfarm Payrolls', 'Non Farm Payrolls',
  'Unemployment Rate',
  'Retail Sales',
  'FOMC', 'Fed Interest Rate Decision', 'Federal Funds Rate',
  'Initial Jobless Claims', 'Jobless Claims',
  'PCE', 'Personal Consumption Expenditure', 'Core PCE',
  'ISM Manufacturing PMI', 'ISM Services PMI',
  'Consumer Confidence', 'Michigan Consumer Sentiment',
  'Durable Goods Orders',
  'Housing Starts', 'Building Permits',
  'Industrial Production',
  'Trade Balance',
  'Treasury Auction',
];

export default async function handler(req, res) {
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 10, windowMs: 60000 } })) {
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.EODHD_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ success: false, error: 'EODHD_API_KEY not configured' });
  }

  try {
    // 14-day window computed server-side
    const today = new Date();
    const from = today.toISOString().split('T')[0];
    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + 14);
    const to = futureDate.toISOString().split('T')[0];

    const url = `https://eodhd.com/api/economic-events?api_token=${apiKey}&from=${from}&to=${to}&country=US&fmt=json&limit=100`;

    const response = await fetch(url);
    if (!response.ok) {
      console.error('[EconomicEvents] EODHD API error:', response.status);
      return res.status(200).json({ success: false, error: `EODHD API error: ${response.status}` });
    }

    const events = await response.json();

    // Score importance: exact/partial match against IMPORTANT_TYPES = high, else medium
    const scored = events.map(event => {
      const name = (event.type || event.event || '').toLowerCase();
      const isHighImpact = IMPORTANT_TYPES.some(t => name.includes(t.toLowerCase()));

      return {
        date: event.date,
        time: event.time || null,
        name: event.type || event.event || 'Unknown Event',
        country: event.country || 'US',
        actual: event.actual ?? null,
        estimate: event.estimate ?? event.forecast ?? null,
        previous: event.previous ?? null,
        change: event.change ?? null,
        impact: isHighImpact ? 'high' : 'medium',
        comparison: event.comparison || null,
      };
    });

    // Sort by date asc, then impact (high first)
    const sorted = scored.sort((a, b) => {
      const dateCompare = new Date(a.date) - new Date(b.date);
      if (dateCompare !== 0) return dateCompare;
      if (a.impact === 'high' && b.impact !== 'high') return -1;
      if (b.impact === 'high' && a.impact !== 'high') return 1;
      return 0;
    });

    return res.status(200).json({
      success: true,
      data: {
        from,
        to,
        events: sorted,
        fetchedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[EconomicEvents] Error:', error.message);
    return res.status(200).json({ success: false, error: error.message });
  }
}
