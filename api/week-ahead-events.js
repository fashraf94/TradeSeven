// api/week-ahead-events.js
// Merges static macro events (Fed, holidays) with EODHD economic indicators

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const API_KEY = process.env.EODHD_API_KEY;
  const { from, to } = req.query;

  if (!from || !to) {
    return res.status(400).json({ error: 'Missing from/to date parameters' });
  }

  try {
    // =====================================
    // 1. GET STATIC EVENTS (Fed, Holidays)
    // =====================================
    const staticEvents = getStaticEventsInRange(from, to);
    console.log(`[Week Ahead] Found ${staticEvents.length} static events in range ${from} to ${to}`);

    // =====================================
    // 2. GET EODHD ECONOMIC INDICATORS
    // =====================================
    let eodhdEvents = [];

    try {
      const url = `https://eodhd.com/api/economic-events?api_token=${API_KEY}&from=${from}&to=${to}&country=US&limit=100&fmt=json`;
      console.log('[Week Ahead] Fetching EODHD events...');

      const response = await fetch(url);

      if (response.ok) {
        const rawEvents = await response.json();
        console.log(`[Week Ahead] EODHD returned ${rawEvents.length} raw events`);

        // Log sample for debugging
        if (rawEvents.length > 0) {
          console.log('[Week Ahead] Sample EODHD types:', rawEvents.slice(0, 5).map(e => e.type));
        }

        // Match and deduplicate
        const seenEvents = new Set();

        for (const raw of rawEvents) {
          const eventType = raw.type || '';
          const rawDate = raw.date || '';
          const eventDate = rawDate.includes(' ') ? rawDate.split(' ')[0] : rawDate;

          const match = matchEodhdEvent(eventType);

          if (match) {
            const uniqueKey = `${match.type}-${eventDate}`;

            if (seenEvents.has(uniqueKey)) {
              console.log(`[Week Ahead] Skipping duplicate EODHD event: ${eventType}`);
              continue;
            }
            seenEvents.add(uniqueKey);

            console.log(`[Week Ahead] EODHD matched: "${eventType}" -> ${match.displayName}`);

            eodhdEvents.push({
              id: `eodhd-${uniqueKey}`,
              name: match.displayName,
              originalName: eventType,
              type: match.type,
              date: eventDate,
              time: '08:30', // Most economic data releases at 8:30 AM ET
              impact: match.impact,
              expected: raw.estimate || raw.forecast || null,
              previous: raw.previous || raw.actual || null,
              historicalMove: match.avgMarketMove,
              strategyTip: match.defaultTip,
              source: 'eodhd',
            });
          }
        }

        console.log(`[Week Ahead] Matched ${eodhdEvents.length} EODHD events`);
      } else {
        console.error(`[Week Ahead] EODHD returned ${response.status}`);
      }
    } catch (eodhdError) {
      console.error('[Week Ahead] EODHD fetch error:', eodhdError.message);
      // Continue with just static events
    }

    // =====================================
    // 3. MERGE AND SORT
    // =====================================
    const allEvents = [...staticEvents, ...eodhdEvents];

    // Sort by date, then by impact (high first)
    const impactOrder = { high: 0, medium: 1, low: 2, info: 3 };
    allEvents.sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return (impactOrder[a.impact] || 3) - (impactOrder[b.impact] || 3);
    });

    console.log(`[Week Ahead] Total events: ${allEvents.length} (${staticEvents.length} static + ${eodhdEvents.length} EODHD)`);

    // Log all events for debugging
    console.log('[Week Ahead] All events:', allEvents.map(e => ({
      name: e.name,
      date: e.date,
      source: e.source || 'static'
    })));

    res.status(200).json({
      events: allEvents,
      meta: {
        staticCount: staticEvents.length,
        eodhdCount: eodhdEvents.length,
        dateRange: { from, to }
      }
    });

  } catch (error) {
    console.error('[Week Ahead] Error:', error);
    res.status(500).json({ error: error.message });
  }
}

// =====================================
// STATIC DATA - Fed Meetings, Jackson Hole, Holidays
// =====================================

const FED_MEETINGS = [
  { date: '2025-01-29', name: 'Fed Rate Decision', type: 'fed_decision', time: '14:00', impact: 'high', hasPresser: true, historicalMove: { market: 1.8, highBeta: 3.2, crypto: 4.5 }, strategyTip: 'First meeting of 2025. Watch for inflation commentary.' },
  { date: '2025-03-19', name: 'Fed Rate Decision', type: 'fed_decision', time: '14:00', impact: 'high', hasPresser: true, historicalMove: { market: 1.8, highBeta: 3.2, crypto: 4.5 }, strategyTip: 'Includes dot plot update. Often more volatile.' },
  { date: '2025-05-07', name: 'Fed Rate Decision', type: 'fed_decision', time: '14:00', impact: 'high', hasPresser: true, historicalMove: { market: 1.8, highBeta: 3.2, crypto: 4.5 }, strategyTip: 'Spring meeting. Watch for summer rate signals.' },
  { date: '2025-06-18', name: 'Fed Rate Decision', type: 'fed_decision', time: '14:00', impact: 'high', hasPresser: true, historicalMove: { market: 1.8, highBeta: 3.2, crypto: 4.5 }, strategyTip: 'Key meeting with projections update.' },
  { date: '2025-07-30', name: 'Fed Rate Decision', type: 'fed_decision', time: '14:00', impact: 'high', hasPresser: true, historicalMove: { market: 1.8, highBeta: 3.2, crypto: 4.5 }, strategyTip: 'Sets tone before Jackson Hole.' },
  { date: '2025-09-17', name: 'Fed Rate Decision', type: 'fed_decision', time: '14:00', impact: 'high', hasPresser: true, historicalMove: { market: 1.8, highBeta: 3.2, crypto: 4.5 }, strategyTip: 'Post-Jackson Hole meeting with projections.' },
  { date: '2025-10-29', name: 'Fed Rate Decision', type: 'fed_decision', time: '14:00', impact: 'high', hasPresser: true, historicalMove: { market: 1.8, highBeta: 3.2, crypto: 4.5 }, strategyTip: 'Late year meeting. Watch year-end positioning.' },
  { date: '2025-12-17', name: 'Fed Rate Decision', type: 'fed_decision', time: '14:00', impact: 'high', hasPresser: true, historicalMove: { market: 1.8, highBeta: 3.2, crypto: 4.5 }, strategyTip: 'Last meeting of 2025. Includes 2026 projections. Press conference at 2:30pm often moves markets more than the decision.' },
  { date: '2026-01-28', name: 'Fed Rate Decision', type: 'fed_decision', time: '14:00', impact: 'high', hasPresser: true, historicalMove: { market: 1.8, highBeta: 3.2, crypto: 4.5 }, strategyTip: 'First meeting of 2026.' },
  { date: '2026-03-18', name: 'Fed Rate Decision', type: 'fed_decision', time: '14:00', impact: 'high', hasPresser: true, historicalMove: { market: 1.8, highBeta: 3.2, crypto: 4.5 }, strategyTip: 'March meeting with dot plot.' },
];

const JACKSON_HOLE = [
  { date: '2025-08-22', name: 'Jackson Hole - Fed Chair Speech', type: 'jackson_hole', time: '10:00', impact: 'high', historicalMove: { market: 1.5, highBeta: 2.5, crypto: 3.5 }, strategyTip: "Annual symposium. Fed Chair often signals major policy shifts here." },
  { date: '2026-08-28', name: 'Jackson Hole - Fed Chair Speech', type: 'jackson_hole', time: '10:00', impact: 'high', historicalMove: { market: 1.5, highBeta: 2.5, crypto: 3.5 }, strategyTip: "Annual symposium. One of the most important speeches of the year." },
];

const MARKET_HOLIDAYS = [
  // 2025
  { date: '2025-01-01', name: "New Year's Day", type: 'market_closed', impact: 'info', note: 'Markets closed', strategyTip: 'Markets closed. Crypto still trades 24/7.' },
  { date: '2025-01-20', name: 'MLK Jr. Day', type: 'market_closed', impact: 'info', note: 'Markets closed', strategyTip: 'Markets closed. Crypto still trades 24/7.' },
  { date: '2025-02-17', name: "Presidents' Day", type: 'market_closed', impact: 'info', note: 'Markets closed', strategyTip: 'Markets closed. Crypto still trades 24/7.' },
  { date: '2025-04-18', name: 'Good Friday', type: 'market_closed', impact: 'info', note: 'Markets closed', strategyTip: 'Markets closed. Crypto still trades 24/7.' },
  { date: '2025-05-26', name: 'Memorial Day', type: 'market_closed', impact: 'info', note: 'Markets closed', strategyTip: 'Markets closed. Crypto still trades 24/7.' },
  { date: '2025-06-19', name: 'Juneteenth', type: 'market_closed', impact: 'info', note: 'Markets closed', strategyTip: 'Markets closed. Crypto still trades 24/7.' },
  { date: '2025-07-04', name: 'Independence Day', type: 'market_closed', impact: 'info', note: 'Markets closed', strategyTip: 'Markets closed. Crypto still trades 24/7.' },
  { date: '2025-09-01', name: 'Labor Day', type: 'market_closed', impact: 'info', note: 'Markets closed', strategyTip: 'Markets closed. Crypto still trades 24/7.' },
  { date: '2025-11-27', name: 'Thanksgiving', type: 'market_closed', impact: 'info', note: 'Markets closed', strategyTip: 'Markets closed. Crypto still trades 24/7.' },
  { date: '2025-11-28', name: 'Day After Thanksgiving', type: 'early_close', time: '13:00', impact: 'low', note: 'Markets close at 1:00 PM ET', strategyTip: 'Low volume day. Avoid starting battles.' },
  { date: '2025-12-24', name: 'Christmas Eve', type: 'early_close', time: '13:00', impact: 'low', note: 'Markets close at 1:00 PM ET', strategyTip: 'Very low volume. Prices can be erratic.' },
  { date: '2025-12-25', name: 'Christmas Day', type: 'market_closed', impact: 'info', note: 'Markets closed', strategyTip: 'Markets closed. Crypto still trades 24/7.' },
  // 2026
  { date: '2026-01-01', name: "New Year's Day", type: 'market_closed', impact: 'info', note: 'Markets closed', strategyTip: 'Markets closed. Crypto still trades 24/7.' },
  { date: '2026-01-19', name: 'MLK Jr. Day', type: 'market_closed', impact: 'info', note: 'Markets closed', strategyTip: 'Markets closed. Crypto still trades 24/7.' },
  { date: '2026-02-16', name: "Presidents' Day", type: 'market_closed', impact: 'info', note: 'Markets closed', strategyTip: 'Markets closed. Crypto still trades 24/7.' },
  { date: '2026-04-03', name: 'Good Friday', type: 'market_closed', impact: 'info', note: 'Markets closed', strategyTip: 'Markets closed. Crypto still trades 24/7.' },
  { date: '2026-05-25', name: 'Memorial Day', type: 'market_closed', impact: 'info', note: 'Markets closed', strategyTip: 'Markets closed. Crypto still trades 24/7.' },
  { date: '2026-06-19', name: 'Juneteenth', type: 'market_closed', impact: 'info', note: 'Markets closed', strategyTip: 'Markets closed. Crypto still trades 24/7.' },
  { date: '2026-07-03', name: 'Independence Day (Observed)', type: 'market_closed', impact: 'info', note: 'Markets closed', strategyTip: 'Markets closed. Crypto still trades 24/7.' },
  { date: '2026-09-07', name: 'Labor Day', type: 'market_closed', impact: 'info', note: 'Markets closed', strategyTip: 'Markets closed. Crypto still trades 24/7.' },
  { date: '2026-11-26', name: 'Thanksgiving', type: 'market_closed', impact: 'info', note: 'Markets closed', strategyTip: 'Markets closed. Crypto still trades 24/7.' },
  { date: '2026-11-27', name: 'Day After Thanksgiving', type: 'early_close', time: '13:00', impact: 'low', note: 'Markets close at 1:00 PM ET', strategyTip: 'Low volume day.' },
  { date: '2026-12-24', name: 'Christmas Eve', type: 'early_close', time: '13:00', impact: 'low', note: 'Markets close at 1:00 PM ET', strategyTip: 'Very low volume.' },
  { date: '2026-12-25', name: 'Christmas Day', type: 'market_closed', impact: 'info', note: 'Markets closed', strategyTip: 'Markets closed. Crypto still trades 24/7.' },
];

// =====================================
// EODHD EVENT WATCHLIST (indicators only)
// =====================================

const EODHD_EVENT_WATCHLIST = [
  { keywords: ['cpi', 'consumer price index'], displayName: 'CPI Inflation', type: 'cpi', impact: 'high', avgMarketMove: { market: 1.2, highBeta: 2.2, crypto: 3.0 }, defaultTip: 'Hot inflation = rate hike fears. Cool inflation = rally.' },
  { keywords: ['nonfarm payrolls', 'non-farm payrolls', 'nfp', 'employment situation'], displayName: 'Jobs Report (NFP)', type: 'jobs_report', impact: 'high', avgMarketMove: { market: 1.0, highBeta: 1.8, crypto: 2.0 }, defaultTip: 'Goldilocks is 150-200k jobs. Too hot or too cold moves markets.' },
  { keywords: ['unemployment rate'], displayName: 'Unemployment Rate', type: 'unemployment', impact: 'high', avgMarketMove: { market: 0.8, highBeta: 1.5, crypto: 1.8 }, defaultTip: 'Rising = recession fears but rate cut hopes.' },
  { keywords: ['retail sales'], displayName: 'Retail Sales', type: 'retail_sales', impact: 'medium', avgMarketMove: { market: 0.5, highBeta: 0.9, crypto: 1.0 }, defaultTip: 'Consumer spending = 70% of GDP.' },
  { keywords: ['housing starts', 'building permits'], displayName: 'Housing Starts', type: 'housing_starts', impact: 'medium', avgMarketMove: { market: 0.3, highBeta: 0.6, crypto: 0.5 }, defaultTip: 'Rate-sensitive sector indicator.' },
  { keywords: ['nahb', 'homebuilder confidence', 'housing market index'], displayName: 'Homebuilder Confidence', type: 'nahb', impact: 'medium', avgMarketMove: { market: 0.2, highBeta: 0.5, crypto: 0.4 }, defaultTip: 'Above 50 = optimistic builders.' },
  { keywords: ['pce', 'personal consumption expenditure'], displayName: 'PCE Price Index', type: 'pce', impact: 'medium', avgMarketMove: { market: 0.8, highBeta: 1.4, crypto: 1.8 }, defaultTip: "Fed's preferred inflation measure." },
  { keywords: ['gdp', 'gross domestic product'], displayName: 'GDP Report', type: 'gdp', impact: 'medium', avgMarketMove: { market: 0.6, highBeta: 1.0, crypto: 1.2 }, defaultTip: 'Negative = recession fears. Strong = soft landing.' },
  { keywords: ['ppi', 'producer price index'], displayName: 'PPI (Producer Prices)', type: 'ppi', impact: 'medium', avgMarketMove: { market: 0.5, highBeta: 0.9, crypto: 1.0 }, defaultTip: 'Wholesale inflation - leads CPI.' },
  { keywords: ['initial jobless claims', 'jobless claims', 'initial claims'], displayName: 'Jobless Claims', type: 'jobless_claims', impact: 'low', avgMarketMove: { market: 0.2, highBeta: 0.4, crypto: 0.5 }, defaultTip: 'Weekly pulse on layoffs.' },
  { keywords: ['consumer confidence', 'consumer sentiment', 'michigan consumer'], displayName: 'Consumer Confidence', type: 'consumer_confidence', impact: 'low', avgMarketMove: { market: 0.3, highBeta: 0.5, crypto: 0.6 }, defaultTip: 'Optimism = more spending ahead.' },
];

// =====================================
// HELPER FUNCTIONS
// =====================================

function getStaticEventsInRange(startDate, endDate) {
  const allStatic = [...FED_MEETINGS, ...JACKSON_HOLE, ...MARKET_HOLIDAYS];
  return allStatic
    .filter(e => e.date >= startDate && e.date <= endDate)
    .map(e => ({
      ...e,
      id: `static-${e.type}-${e.date}`,
      source: 'static'
    }));
}

function matchEodhdEvent(eventType) {
  if (!eventType) return null;
  const typeLower = eventType.toLowerCase();
  return EODHD_EVENT_WATCHLIST.find(item =>
    item.keywords.some(kw => typeLower.includes(kw.toLowerCase()))
  );
}
