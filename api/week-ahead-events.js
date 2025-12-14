// api/week-ahead-events.js
// Fetches and filters economic events for the upcoming week

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const API_KEY = process.env.EODHD_API_KEY;
  const { from, to } = req.query;

  if (!from || !to) {
    return res.status(400).json({ error: 'Missing from/to date parameters' });
  }

  try {
    // Fetch economic events from EODHD
    const url = `https://eodhd.com/api/economic-events?api_token=${API_KEY}&from=${from}&to=${to}&country=US&fmt=json`;

    console.log('[Week Ahead] Fetching events:', url.replace(API_KEY, 'HIDDEN'));

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`EODHD responded with ${response.status}`);
    }

    const rawEvents = await response.json();
    console.log(`[Week Ahead] Received ${rawEvents.length} raw events from EODHD`);

    // Log first 5 raw events to see exact field names and values
    if (rawEvents.length > 0) {
      console.log('[Week Ahead] First 5 raw events:', JSON.stringify(rawEvents.slice(0, 5), null, 2));
    }

    // Curated watchlist for filtering
    const EVENT_WATCHLIST = [
      { keywords: ['fomc', 'federal funds rate', 'interest rate decision', 'fed rate'], type: 'fed_decision', displayName: 'Fed Rate Decision', impact: 'high' },
      { keywords: ['cpi', 'consumer price index'], type: 'cpi', displayName: 'CPI Inflation', impact: 'high' },
      { keywords: ['nonfarm payrolls', 'non-farm payrolls', 'nfp', 'employment situation'], type: 'jobs_report', displayName: 'Jobs Report (NFP)', impact: 'high' },
      { keywords: ['unemployment rate'], type: 'unemployment', displayName: 'Unemployment Rate', impact: 'high' },
      { keywords: ['jackson hole'], type: 'jackson_hole', displayName: 'Jackson Hole Symposium', impact: 'high' },
      { keywords: ['powell speaks', 'powell testimony', 'fed chair speaks', 'jerome powell'], type: 'fed_chair_speech', displayName: 'Fed Chair Powell Speaks', impact: 'high' },
      { keywords: ['retail sales'], type: 'retail_sales', displayName: 'Retail Sales', impact: 'medium' },
      { keywords: ['housing starts', 'building permits'], type: 'housing_starts', displayName: 'Housing Starts & Permits', impact: 'medium' },
      { keywords: ['nahb', 'homebuilder confidence', 'housing market index'], type: 'nahb', displayName: 'Homebuilder Confidence', impact: 'medium' },
      { keywords: ['pce', 'personal consumption expenditure'], type: 'pce', displayName: 'PCE Price Index', impact: 'medium' },
      { keywords: ['gdp', 'gross domestic product'], type: 'gdp', displayName: 'GDP Report', impact: 'medium' },
      { keywords: ['ppi', 'producer price index'], type: 'ppi', displayName: 'PPI (Producer Prices)', impact: 'medium' },
      { keywords: ['initial jobless claims', 'jobless claims', 'initial claims'], type: 'jobless_claims', displayName: 'Jobless Claims', impact: 'low' },
      { keywords: ['consumer confidence', 'consumer sentiment', 'michigan consumer'], type: 'consumer_confidence', displayName: 'Consumer Confidence', impact: 'low' },
    ];

    // Historical move data
    const avgMoves = {
      fed_decision: { market: 1.8, highBeta: 3.2, crypto: 4.5 },
      cpi: { market: 1.2, highBeta: 2.2, crypto: 3.0 },
      jobs_report: { market: 1.0, highBeta: 1.8, crypto: 2.0 },
      unemployment: { market: 0.8, highBeta: 1.5, crypto: 1.8 },
      jackson_hole: { market: 1.5, highBeta: 2.5, crypto: 3.5 },
      fed_chair_speech: { market: 0.8, highBeta: 1.5, crypto: 2.0 },
      retail_sales: { market: 0.5, highBeta: 0.9, crypto: 1.0 },
      housing_starts: { market: 0.3, highBeta: 0.6, crypto: 0.5 },
      nahb: { market: 0.2, highBeta: 0.5, crypto: 0.4 },
      pce: { market: 0.8, highBeta: 1.4, crypto: 1.8 },
      gdp: { market: 0.6, highBeta: 1.0, crypto: 1.2 },
      ppi: { market: 0.5, highBeta: 0.9, crypto: 1.0 },
      jobless_claims: { market: 0.2, highBeta: 0.4, crypto: 0.5 },
      consumer_confidence: { market: 0.3, highBeta: 0.5, crypto: 0.6 },
    };

    // Strategy tips
    const strategyTips = {
      fed_decision: 'The Fed sets interest rates for the entire economy. Press conference at 2:30pm often moves markets more than the decision itself.',
      cpi: 'Hot inflation = rate hike fears = tech sells off. Cool inflation = rally, especially growth stocks.',
      jobs_report: 'Strong jobs = good economy but higher rate expectations. Goldilocks is moderate growth (150-200k jobs).',
      unemployment: 'Rising unemployment signals economic slowdown - could mean rate cuts ahead (bullish for growth stocks).',
      jackson_hole: 'Annual Fed symposium where major policy shifts are often announced. One of the most important events of the year.',
      fed_chair_speech: 'Markets hang on every word. Hawkish tone = selloff. Dovish tone = rally. Watch for hints about future rate moves.',
      retail_sales: 'Consumer spending drives 70% of GDP. Strong retail = economic confidence. Weak retail = recession fears.',
      housing_starts: 'Leading indicator for construction sector. Very rate-sensitive - lower rates = more building.',
      nahb: 'Survey of homebuilder sentiment. Leading indicator for housing sector. Above 50 = optimistic.',
      pce: "The Fed's PREFERRED inflation measure - sometimes more important than CPI. Core PCE excludes food/energy.",
      gdp: 'Backward-looking but sets the narrative. Negative GDP = recession fears. Strong GDP = soft landing hopes.',
      ppi: 'Wholesale inflation - often a leading indicator for CPI. Rising PPI can signal future consumer inflation.',
      jobless_claims: 'Weekly pulse on layoffs. Spikes above 250k get attention. Steady = stable labor market.',
      consumer_confidence: 'How optimistic are consumers? High confidence = more spending. Low = belt-tightening ahead.',
    };

    // Match function
    const matchEvent = (eventName) => {
      if (!eventName) return null;
      const nameLower = eventName.toLowerCase();
      return EVENT_WATCHLIST.find(item =>
        item.keywords.some(keyword => nameLower.includes(keyword.toLowerCase()))
      );
    };

    // Filter and transform events
    const matchedEvents = [];
    const seenTypes = new Set(); // Avoid duplicates of same event type on same day

    console.log('[Week Ahead] --- Starting event matching ---');

    for (const raw of rawEvents) {
      // Try different field names EODHD might use
      const eventName = raw.event || raw.title || raw.name || '';
      const eventDate = raw.date || raw.event_date || '';
      const eventTime = raw.time || '';

      // Log each event being checked
      console.log(`[Week Ahead] Checking: "${eventName}" (date: ${eventDate})`);

      const match = matchEvent(eventName);

      if (match) {
        console.log(`[Week Ahead] ✓ MATCHED: "${eventName}" → ${match.displayName} (${match.type})`);

        const dayTypeKey = `${eventDate}-${match.type}`;

        // Skip if we already have this event type on this day
        if (seenTypes.has(dayTypeKey)) {
          console.log(`[Week Ahead] Skipping duplicate: ${dayTypeKey}`);
          continue;
        }
        seenTypes.add(dayTypeKey);

        matchedEvents.push({
          id: `${match.type}-${eventDate}`,
          name: match.displayName,
          originalName: eventName,
          type: match.type,
          date: eventDate,
          time: eventTime || '08:30', // Default to common release time
          impact: match.impact,
          expected: raw.estimate || raw.forecast || raw.consensus || null,
          previous: raw.previous || raw.prior || raw.actual || null,
          historicalMove: avgMoves[match.type] || { market: 0.5, highBeta: 1.0, crypto: 1.0 },
          strategyTip: strategyTips[match.type] || 'Monitor the market reaction and be prepared for volatility.',
        });
      }
    }

    console.log('[Week Ahead] --- Matching complete ---');

    // Sort by date, then by impact (high first)
    const impactOrder = { high: 0, medium: 1, low: 2 };
    matchedEvents.sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return (impactOrder[a.impact] || 2) - (impactOrder[b.impact] || 2);
    });

    console.log(`[Week Ahead] Matched ${matchedEvents.length} events to watchlist`);

    res.status(200).json({
      events: matchedEvents,
      meta: {
        totalRaw: rawEvents.length,
        matched: matchedEvents.length,
        dateRange: { from, to }
      }
    });

  } catch (error) {
    console.error('[Week Ahead] Error:', error);
    res.status(500).json({ error: error.message });
  }
}
