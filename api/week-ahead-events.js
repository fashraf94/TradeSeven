// api/week-ahead-events.js
// Uses static economic calendar data from official government sources
// No external API for macro events - only EODHD for earnings (separate endpoint)

import { applySecurityMiddleware } from './_utils/security.js';

export default async function handler(req, res) {
  // Apply security middleware (CORS, security headers, rate limiting, preflight)
  // Higher rate limit for static data endpoint
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 60, windowMs: 60000 } })) {
    return;
  }

  const { from, to } = req.query;

  if (!from || !to) {
    return res.status(400).json({ error: 'Missing from/to date parameters' });
  }

  try {
    // Filter events to date range
    const events = ALL_EVENTS
      .filter(e => e.date >= from && e.date <= to)
      .map(e => ({ ...e, id: `${e.type}-${e.date}`, source: 'static' }));

    // Sort by date, then impact
    const impactOrder = { high: 0, medium: 1, low: 2, info: 3 };
    events.sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return (impactOrder[a.impact] || 3) - (impactOrder[b.impact] || 3);
    });

    console.log(`[Week Ahead] Found ${events.length} static events for ${from} to ${to}`);

    res.status(200).json({
      events,
      meta: { count: events.length, dateRange: { from, to }, source: 'static' }
    });

  } catch (error) {
    console.error('[Week Ahead] Error:', error);
    res.status(500).json({ error: error.message });
  }
}

// =====================================
// STATIC ECONOMIC CALENDAR 2025
// Sources:
//   - Fed: federalreserve.gov/monetarypolicy/fomccalendars.htm
//   - CPI/Jobs: bls.gov/schedule/news_release/
//   - GDP/PCE: bea.gov/news/schedule
// =====================================

const ALL_EVENTS = [
  // =====================================
  // FED RATE DECISIONS 2025
  // =====================================
  { date: '2025-01-29', name: 'Fed Rate Decision', type: 'fed_decision', time: '14:00', impact: 'high', historicalMove: { market: 1.8, highBeta: 3.2, crypto: 4.5 }, strategyTip: 'First meeting of 2025. Watch for tone on inflation and rate path.' },
  { date: '2025-03-19', name: 'Fed Rate Decision', type: 'fed_decision', time: '14:00', impact: 'high', historicalMove: { market: 1.8, highBeta: 3.2, crypto: 4.5 }, strategyTip: 'Includes dot plot. Often more volatile.' },
  { date: '2025-05-07', name: 'Fed Rate Decision', type: 'fed_decision', time: '14:00', impact: 'high', historicalMove: { market: 1.8, highBeta: 3.2, crypto: 4.5 }, strategyTip: 'Spring meeting. Markets watching for summer guidance.' },
  { date: '2025-06-18', name: 'Fed Rate Decision', type: 'fed_decision', time: '14:00', impact: 'high', historicalMove: { market: 1.8, highBeta: 3.2, crypto: 4.5 }, strategyTip: 'Includes dot plot update. Key for H2 rate expectations.' },
  { date: '2025-07-30', name: 'Fed Rate Decision', type: 'fed_decision', time: '14:00', impact: 'high', historicalMove: { market: 1.8, highBeta: 3.2, crypto: 4.5 }, strategyTip: 'Mid-summer meeting. Sets tone before Jackson Hole.' },
  { date: '2025-09-17', name: 'Fed Rate Decision', type: 'fed_decision', time: '14:00', impact: 'high', historicalMove: { market: 1.8, highBeta: 3.2, crypto: 4.5 }, strategyTip: 'Post-Jackson Hole. Includes updated projections.' },
  { date: '2025-10-29', name: 'Fed Rate Decision', type: 'fed_decision', time: '14:00', impact: 'high', historicalMove: { market: 1.8, highBeta: 3.2, crypto: 4.5 }, strategyTip: 'Late year meeting. Watch year-end positioning.' },
  { date: '2025-12-17', name: 'Fed Rate Decision', type: 'fed_decision', time: '14:00', impact: 'high', historicalMove: { market: 1.8, highBeta: 3.2, crypto: 4.5 }, strategyTip: 'Last 2025 meeting. Includes 2026 projections. Press conference at 2:30pm.' },

  // =====================================
  // CPI RELEASES 2025
  // =====================================
  { date: '2025-01-15', name: 'CPI Inflation', type: 'cpi', time: '08:30', impact: 'high', historicalMove: { market: 1.2, highBeta: 2.2, crypto: 3.0 }, strategyTip: 'December 2024 data. Hot = selloff. Cool = rally.' },
  { date: '2025-02-12', name: 'CPI Inflation', type: 'cpi', time: '08:30', impact: 'high', historicalMove: { market: 1.2, highBeta: 2.2, crypto: 3.0 }, strategyTip: 'January data. Watch core CPI.' },
  { date: '2025-03-12', name: 'CPI Inflation', type: 'cpi', time: '08:30', impact: 'high', historicalMove: { market: 1.2, highBeta: 2.2, crypto: 3.0 }, strategyTip: 'February data. Key for March Fed.' },
  { date: '2025-04-10', name: 'CPI Inflation', type: 'cpi', time: '08:30', impact: 'high', historicalMove: { market: 1.2, highBeta: 2.2, crypto: 3.0 }, strategyTip: 'March data. Spring inflation trends.' },
  { date: '2025-05-13', name: 'CPI Inflation', type: 'cpi', time: '08:30', impact: 'high', historicalMove: { market: 1.2, highBeta: 2.2, crypto: 3.0 }, strategyTip: 'April data. Watch shelter costs.' },
  { date: '2025-06-11', name: 'CPI Inflation', type: 'cpi', time: '08:30', impact: 'high', historicalMove: { market: 1.2, highBeta: 2.2, crypto: 3.0 }, strategyTip: 'May data. Key for June Fed.' },
  { date: '2025-07-15', name: 'CPI Inflation', type: 'cpi', time: '08:30', impact: 'high', historicalMove: { market: 1.2, highBeta: 2.2, crypto: 3.0 }, strategyTip: 'June data. Summer inflation.' },
  { date: '2025-08-12', name: 'CPI Inflation', type: 'cpi', time: '08:30', impact: 'high', historicalMove: { market: 1.2, highBeta: 2.2, crypto: 3.0 }, strategyTip: 'July data. Seasonal patterns.' },
  { date: '2025-09-11', name: 'CPI Inflation', type: 'cpi', time: '08:30', impact: 'high', historicalMove: { market: 1.2, highBeta: 2.2, crypto: 3.0 }, strategyTip: 'August data. Key for Sept Fed.' },
  { date: '2025-10-24', name: 'CPI Inflation', type: 'cpi', time: '08:30', impact: 'high', historicalMove: { market: 1.2, highBeta: 2.2, crypto: 3.0 }, strategyTip: 'September data. Delayed release.' },
  { date: '2025-12-18', name: 'CPI Inflation', type: 'cpi', time: '08:30', impact: 'high', historicalMove: { market: 1.2, highBeta: 2.2, crypto: 3.0 }, strategyTip: 'November data. Day after Fed decision.' },

  // =====================================
  // JOBS REPORTS 2025 (Non-Farm Payrolls)
  // =====================================
  { date: '2025-01-10', name: 'Jobs Report (NFP)', type: 'jobs_report', time: '08:30', impact: 'high', historicalMove: { market: 1.0, highBeta: 1.8, crypto: 2.0 }, strategyTip: 'December 2024 data. Goldilocks is 150-200k.' },
  { date: '2025-02-07', name: 'Jobs Report (NFP)', type: 'jobs_report', time: '08:30', impact: 'high', historicalMove: { market: 1.0, highBeta: 1.8, crypto: 2.0 }, strategyTip: 'January data. Watch wage growth.' },
  { date: '2025-03-07', name: 'Jobs Report (NFP)', type: 'jobs_report', time: '08:30', impact: 'high', historicalMove: { market: 1.0, highBeta: 1.8, crypto: 2.0 }, strategyTip: 'February data. Key for March Fed.' },
  { date: '2025-04-04', name: 'Jobs Report (NFP)', type: 'jobs_report', time: '08:30', impact: 'high', historicalMove: { market: 1.0, highBeta: 1.8, crypto: 2.0 }, strategyTip: 'March data. Spring hiring.' },
  { date: '2025-05-02', name: 'Jobs Report (NFP)', type: 'jobs_report', time: '08:30', impact: 'high', historicalMove: { market: 1.0, highBeta: 1.8, crypto: 2.0 }, strategyTip: 'April data. Seasonal patterns.' },
  { date: '2025-06-06', name: 'Jobs Report (NFP)', type: 'jobs_report', time: '08:30', impact: 'high', historicalMove: { market: 1.0, highBeta: 1.8, crypto: 2.0 }, strategyTip: 'May data. Summer job market.' },
  { date: '2025-07-03', name: 'Jobs Report (NFP)', type: 'jobs_report', time: '08:30', impact: 'high', historicalMove: { market: 1.0, highBeta: 1.8, crypto: 2.0 }, strategyTip: 'June data. Before July 4th.' },
  { date: '2025-08-01', name: 'Jobs Report (NFP)', type: 'jobs_report', time: '08:30', impact: 'high', historicalMove: { market: 1.0, highBeta: 1.8, crypto: 2.0 }, strategyTip: 'July data. Key for Sept Fed.' },
  { date: '2025-09-05', name: 'Jobs Report (NFP)', type: 'jobs_report', time: '08:30', impact: 'high', historicalMove: { market: 1.0, highBeta: 1.8, crypto: 2.0 }, strategyTip: 'August data. Last before Sept Fed.' },
  { date: '2025-10-03', name: 'Jobs Report (NFP)', type: 'jobs_report', time: '08:30', impact: 'high', historicalMove: { market: 1.0, highBeta: 1.8, crypto: 2.0 }, strategyTip: 'September data. Q4 labor market.' },
  { date: '2025-11-07', name: 'Jobs Report (NFP)', type: 'jobs_report', time: '08:30', impact: 'high', historicalMove: { market: 1.0, highBeta: 1.8, crypto: 2.0 }, strategyTip: 'October data. Pre-holiday baseline.' },
  { date: '2025-12-05', name: 'Jobs Report (NFP)', type: 'jobs_report', time: '08:30', impact: 'high', historicalMove: { market: 1.0, highBeta: 1.8, crypto: 2.0 }, strategyTip: 'November data. Key for December Fed.' },

  // =====================================
  // PCE INFLATION 2025 (Fed's preferred measure)
  // =====================================
  { date: '2025-01-31', name: 'PCE Price Index', type: 'pce', time: '08:30', impact: 'medium', historicalMove: { market: 0.8, highBeta: 1.4, crypto: 1.8 }, strategyTip: "Fed's PREFERRED inflation measure. Core PCE is key." },
  { date: '2025-02-28', name: 'PCE Price Index', type: 'pce', time: '08:30', impact: 'medium', historicalMove: { market: 0.8, highBeta: 1.4, crypto: 1.8 }, strategyTip: "January data. Watch core PCE vs CPI." },
  { date: '2025-03-28', name: 'PCE Price Index', type: 'pce', time: '08:30', impact: 'medium', historicalMove: { market: 0.8, highBeta: 1.4, crypto: 1.8 }, strategyTip: "February data. Key for Fed outlook." },
  { date: '2025-04-30', name: 'PCE Price Index', type: 'pce', time: '08:30', impact: 'medium', historicalMove: { market: 0.8, highBeta: 1.4, crypto: 1.8 }, strategyTip: "March data. Spring inflation trends." },
  { date: '2025-05-30', name: 'PCE Price Index', type: 'pce', time: '08:30', impact: 'medium', historicalMove: { market: 0.8, highBeta: 1.4, crypto: 1.8 }, strategyTip: "April data. Ahead of June Fed." },
  { date: '2025-06-27', name: 'PCE Price Index', type: 'pce', time: '08:30', impact: 'medium', historicalMove: { market: 0.8, highBeta: 1.4, crypto: 1.8 }, strategyTip: "May data. Critical for rates." },
  { date: '2025-07-31', name: 'PCE Price Index', type: 'pce', time: '08:30', impact: 'medium', historicalMove: { market: 0.8, highBeta: 1.4, crypto: 1.8 }, strategyTip: "June data. Same day as Fed." },
  { date: '2025-08-29', name: 'PCE Price Index', type: 'pce', time: '08:30', impact: 'medium', historicalMove: { market: 0.8, highBeta: 1.4, crypto: 1.8 }, strategyTip: "July data. Before Jackson Hole settles." },
  { date: '2025-09-26', name: 'PCE Price Index', type: 'pce', time: '08:30', impact: 'medium', historicalMove: { market: 0.8, highBeta: 1.4, crypto: 1.8 }, strategyTip: "August data. Post-Sept Fed." },
  { date: '2025-10-31', name: 'PCE Price Index', type: 'pce', time: '08:30', impact: 'medium', historicalMove: { market: 0.8, highBeta: 1.4, crypto: 1.8 }, strategyTip: "September data. Q4 outlook." },
  { date: '2025-11-26', name: 'PCE Price Index', type: 'pce', time: '08:30', impact: 'medium', historicalMove: { market: 0.8, highBeta: 1.4, crypto: 1.8 }, strategyTip: "October data. Day before Thanksgiving." },
  { date: '2025-12-23', name: 'PCE Price Index', type: 'pce', time: '08:30', impact: 'medium', historicalMove: { market: 0.8, highBeta: 1.4, crypto: 1.8 }, strategyTip: "November data. Holiday week." },

  // =====================================
  // RETAIL SALES 2025
  // =====================================
  { date: '2025-01-16', name: 'Retail Sales', type: 'retail_sales', time: '08:30', impact: 'medium', historicalMove: { market: 0.5, highBeta: 0.9, crypto: 1.0 }, strategyTip: 'December holiday sales. Consumer = 70% of GDP.' },
  { date: '2025-02-14', name: 'Retail Sales', type: 'retail_sales', time: '08:30', impact: 'medium', historicalMove: { market: 0.5, highBeta: 0.9, crypto: 1.0 }, strategyTip: 'January data. Post-holiday trends.' },
  { date: '2025-03-17', name: 'Retail Sales', type: 'retail_sales', time: '08:30', impact: 'medium', historicalMove: { market: 0.5, highBeta: 0.9, crypto: 1.0 }, strategyTip: 'February data. Winter spending.' },
  { date: '2025-04-16', name: 'Retail Sales', type: 'retail_sales', time: '08:30', impact: 'medium', historicalMove: { market: 0.5, highBeta: 0.9, crypto: 1.0 }, strategyTip: 'March data. Spring spending.' },
  { date: '2025-05-15', name: 'Retail Sales', type: 'retail_sales', time: '08:30', impact: 'medium', historicalMove: { market: 0.5, highBeta: 0.9, crypto: 1.0 }, strategyTip: 'April data. Consumer health.' },
  { date: '2025-06-17', name: 'Retail Sales', type: 'retail_sales', time: '08:30', impact: 'medium', historicalMove: { market: 0.5, highBeta: 0.9, crypto: 1.0 }, strategyTip: 'May data. Summer kickoff.' },
  { date: '2025-07-16', name: 'Retail Sales', type: 'retail_sales', time: '08:30', impact: 'medium', historicalMove: { market: 0.5, highBeta: 0.9, crypto: 1.0 }, strategyTip: 'June data. Mid-year trends.' },
  { date: '2025-08-15', name: 'Retail Sales', type: 'retail_sales', time: '08:30', impact: 'medium', historicalMove: { market: 0.5, highBeta: 0.9, crypto: 1.0 }, strategyTip: 'July data. Back-to-school early.' },
  { date: '2025-09-17', name: 'Retail Sales', type: 'retail_sales', time: '08:30', impact: 'medium', historicalMove: { market: 0.5, highBeta: 0.9, crypto: 1.0 }, strategyTip: 'August data. Back-to-school.' },
  { date: '2025-10-17', name: 'Retail Sales', type: 'retail_sales', time: '08:30', impact: 'medium', historicalMove: { market: 0.5, highBeta: 0.9, crypto: 1.0 }, strategyTip: 'September data. Pre-holiday baseline.' },
  { date: '2025-11-17', name: 'Retail Sales', type: 'retail_sales', time: '08:30', impact: 'medium', historicalMove: { market: 0.5, highBeta: 0.9, crypto: 1.0 }, strategyTip: 'October data. Early holiday signals.' },
  { date: '2025-12-16', name: 'Retail Sales', type: 'retail_sales', time: '08:30', impact: 'medium', historicalMove: { market: 0.5, highBeta: 0.9, crypto: 1.0 }, strategyTip: 'November data. Black Friday impact.' },

  // =====================================
  // JACKSON HOLE 2025
  // =====================================
  { date: '2025-08-22', name: 'Jackson Hole - Fed Chair Speech', type: 'jackson_hole', time: '10:00', impact: 'high', historicalMove: { market: 1.5, highBeta: 2.5, crypto: 3.5 }, strategyTip: "Annual symposium where major policy shifts are announced. One of the most important speeches of the year." },

  // =====================================
  // CONSUMER CONFIDENCE 2025
  // =====================================
  { date: '2025-01-28', name: 'Consumer Confidence', type: 'consumer_confidence', time: '10:00', impact: 'low', historicalMove: { market: 0.3, highBeta: 0.5, crypto: 0.6 }, strategyTip: 'How optimistic are consumers? High = more spending.' },
  { date: '2025-02-25', name: 'Consumer Confidence', type: 'consumer_confidence', time: '10:00', impact: 'low', historicalMove: { market: 0.3, highBeta: 0.5, crypto: 0.6 }, strategyTip: 'February reading.' },
  { date: '2025-03-25', name: 'Consumer Confidence', type: 'consumer_confidence', time: '10:00', impact: 'low', historicalMove: { market: 0.3, highBeta: 0.5, crypto: 0.6 }, strategyTip: 'March reading. Spring outlook.' },
  { date: '2025-04-29', name: 'Consumer Confidence', type: 'consumer_confidence', time: '10:00', impact: 'low', historicalMove: { market: 0.3, highBeta: 0.5, crypto: 0.6 }, strategyTip: 'April reading. Post-tax sentiment.' },
  { date: '2025-05-27', name: 'Consumer Confidence', type: 'consumer_confidence', time: '10:00', impact: 'low', historicalMove: { market: 0.3, highBeta: 0.5, crypto: 0.6 }, strategyTip: 'May reading.' },
  { date: '2025-06-24', name: 'Consumer Confidence', type: 'consumer_confidence', time: '10:00', impact: 'low', historicalMove: { market: 0.3, highBeta: 0.5, crypto: 0.6 }, strategyTip: 'June reading. Mid-year check.' },
  { date: '2025-07-29', name: 'Consumer Confidence', type: 'consumer_confidence', time: '10:00', impact: 'low', historicalMove: { market: 0.3, highBeta: 0.5, crypto: 0.6 }, strategyTip: 'July reading.' },
  { date: '2025-08-26', name: 'Consumer Confidence', type: 'consumer_confidence', time: '10:00', impact: 'low', historicalMove: { market: 0.3, highBeta: 0.5, crypto: 0.6 }, strategyTip: 'August reading.' },
  { date: '2025-09-30', name: 'Consumer Confidence', type: 'consumer_confidence', time: '10:00', impact: 'low', historicalMove: { market: 0.3, highBeta: 0.5, crypto: 0.6 }, strategyTip: 'September reading. Q4 outlook.' },
  { date: '2025-10-28', name: 'Consumer Confidence', type: 'consumer_confidence', time: '10:00', impact: 'low', historicalMove: { market: 0.3, highBeta: 0.5, crypto: 0.6 }, strategyTip: 'October reading. Pre-holiday.' },
  { date: '2025-11-25', name: 'Consumer Confidence', type: 'consumer_confidence', time: '10:00', impact: 'low', historicalMove: { market: 0.3, highBeta: 0.5, crypto: 0.6 }, strategyTip: 'November reading. Holiday outlook.' },
  { date: '2025-12-30', name: 'Consumer Confidence', type: 'consumer_confidence', time: '10:00', impact: 'low', historicalMove: { market: 0.3, highBeta: 0.5, crypto: 0.6 }, strategyTip: 'December reading. Year-end.' },

  // =====================================
  // MARKET HOLIDAYS 2025
  // =====================================
  { date: '2025-01-01', name: "New Year's Day", type: 'market_closed', impact: 'info', note: 'Markets closed', strategyTip: 'Markets closed. Crypto still trades 24/7.' },
  { date: '2025-01-20', name: 'MLK Jr. Day', type: 'market_closed', impact: 'info', note: 'Markets closed', strategyTip: 'Markets closed. Crypto still trades 24/7.' },
  { date: '2025-02-17', name: "Presidents' Day", type: 'market_closed', impact: 'info', note: 'Markets closed', strategyTip: 'Markets closed. Crypto still trades 24/7.' },
  { date: '2025-04-18', name: 'Good Friday', type: 'market_closed', impact: 'info', note: 'Markets closed', strategyTip: 'Markets closed. Crypto still trades 24/7.' },
  { date: '2025-05-26', name: 'Memorial Day', type: 'market_closed', impact: 'info', note: 'Markets closed', strategyTip: 'Markets closed. Crypto still trades 24/7.' },
  { date: '2025-06-19', name: 'Juneteenth', type: 'market_closed', impact: 'info', note: 'Markets closed', strategyTip: 'Markets closed. Crypto still trades 24/7.' },
  { date: '2025-07-04', name: 'Independence Day', type: 'market_closed', impact: 'info', note: 'Markets closed', strategyTip: 'Markets closed. Crypto still trades 24/7.' },
  { date: '2025-09-01', name: 'Labor Day', type: 'market_closed', impact: 'info', note: 'Markets closed', strategyTip: 'Markets closed. Crypto still trades 24/7.' },
  { date: '2025-11-27', name: 'Thanksgiving', type: 'market_closed', impact: 'info', note: 'Markets closed', strategyTip: 'Markets closed. Crypto still trades 24/7.' },
  { date: '2025-11-28', name: 'Day After Thanksgiving', type: 'early_close', time: '13:00', impact: 'low', note: 'Markets close 1:00 PM ET', strategyTip: 'Half day - very low volume. Avoid starting battles.' },
  { date: '2025-12-24', name: 'Christmas Eve', type: 'early_close', time: '13:00', impact: 'low', note: 'Markets close 1:00 PM ET', strategyTip: 'Half day - very low volume. Prices can be erratic.' },
  { date: '2025-12-25', name: 'Christmas Day', type: 'market_closed', impact: 'info', note: 'Markets closed', strategyTip: 'Markets closed. Crypto still trades 24/7.' },
];
