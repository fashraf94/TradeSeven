// src/data/economicCalendar2025.js
// Official economic event dates from government sources
// Update annually using:
//   - Fed: https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm
//   - CPI/Jobs: https://www.bls.gov/schedule/news_release/
//   - GDP/PCE: https://www.bea.gov/news/schedule

// ============================================
// FED RATE DECISIONS 2025
// Source: Federal Reserve FOMC Calendar
// ============================================
export const FED_MEETINGS_2025 = [
  { date: '2025-01-29', name: 'Fed Rate Decision', type: 'fed_decision', time: '14:00', impact: 'high', historicalMove: { market: 1.8, highBeta: 3.2, crypto: 4.5 }, strategyTip: 'First meeting of 2025. Watch for tone on inflation and rate path.' },
  { date: '2025-03-19', name: 'Fed Rate Decision', type: 'fed_decision', time: '14:00', impact: 'high', historicalMove: { market: 1.8, highBeta: 3.2, crypto: 4.5 }, strategyTip: 'Includes Summary of Economic Projections (dot plot). Often more volatile.' },
  { date: '2025-05-07', name: 'Fed Rate Decision', type: 'fed_decision', time: '14:00', impact: 'high', historicalMove: { market: 1.8, highBeta: 3.2, crypto: 4.5 }, strategyTip: 'Spring meeting. Markets watching for summer guidance.' },
  { date: '2025-06-18', name: 'Fed Rate Decision', type: 'fed_decision', time: '14:00', impact: 'high', historicalMove: { market: 1.8, highBeta: 3.2, crypto: 4.5 }, strategyTip: 'Includes dot plot update. Key for H2 rate expectations.' },
  { date: '2025-07-30', name: 'Fed Rate Decision', type: 'fed_decision', time: '14:00', impact: 'high', historicalMove: { market: 1.8, highBeta: 3.2, crypto: 4.5 }, strategyTip: 'Mid-summer meeting. Sets tone before Jackson Hole.' },
  { date: '2025-09-17', name: 'Fed Rate Decision', type: 'fed_decision', time: '14:00', impact: 'high', historicalMove: { market: 1.8, highBeta: 3.2, crypto: 4.5 }, strategyTip: 'Post-Jackson Hole. Includes updated projections.' },
  { date: '2025-10-29', name: 'Fed Rate Decision', type: 'fed_decision', time: '14:00', impact: 'high', historicalMove: { market: 1.8, highBeta: 3.2, crypto: 4.5 }, strategyTip: 'Late year meeting. Watch year-end positioning.' },
  { date: '2025-12-17', name: 'Fed Rate Decision', type: 'fed_decision', time: '14:00', impact: 'high', historicalMove: { market: 1.8, highBeta: 3.2, crypto: 4.5 }, strategyTip: 'Last meeting of 2025. Includes 2026 projections. Press conference at 2:30pm often moves markets more.' },
];

// ============================================
// CPI RELEASES 2025
// Source: BLS Schedule
// ============================================
export const CPI_RELEASES_2025 = [
  { date: '2025-01-15', name: 'CPI Inflation', type: 'cpi', time: '08:30', impact: 'high', historicalMove: { market: 1.2, highBeta: 2.2, crypto: 3.0 }, strategyTip: 'December 2024 data. Hot inflation = tech selloff. Cool = rally.' },
  { date: '2025-02-12', name: 'CPI Inflation', type: 'cpi', time: '08:30', impact: 'high', historicalMove: { market: 1.2, highBeta: 2.2, crypto: 3.0 }, strategyTip: 'January data. Watch core CPI (excludes food/energy).' },
  { date: '2025-03-12', name: 'CPI Inflation', type: 'cpi', time: '08:30', impact: 'high', historicalMove: { market: 1.2, highBeta: 2.2, crypto: 3.0 }, strategyTip: 'February data. Key input for March Fed meeting.' },
  { date: '2025-04-10', name: 'CPI Inflation', type: 'cpi', time: '08:30', impact: 'high', historicalMove: { market: 1.2, highBeta: 2.2, crypto: 3.0 }, strategyTip: 'March data. Spring inflation trends emerging.' },
  { date: '2025-05-13', name: 'CPI Inflation', type: 'cpi', time: '08:30', impact: 'high', historicalMove: { market: 1.2, highBeta: 2.2, crypto: 3.0 }, strategyTip: 'April data. Watch shelter and services inflation.' },
  { date: '2025-06-11', name: 'CPI Inflation', type: 'cpi', time: '08:30', impact: 'high', historicalMove: { market: 1.2, highBeta: 2.2, crypto: 3.0 }, strategyTip: 'May data. Key for June Fed decision.' },
  { date: '2025-07-15', name: 'CPI Inflation', type: 'cpi', time: '08:30', impact: 'high', historicalMove: { market: 1.2, highBeta: 2.2, crypto: 3.0 }, strategyTip: 'June data. Summer inflation picture forming.' },
  { date: '2025-08-12', name: 'CPI Inflation', type: 'cpi', time: '08:30', impact: 'high', historicalMove: { market: 1.2, highBeta: 2.2, crypto: 3.0 }, strategyTip: 'July data. Watch for seasonal patterns.' },
  { date: '2025-09-11', name: 'CPI Inflation', type: 'cpi', time: '08:30', impact: 'high', historicalMove: { market: 1.2, highBeta: 2.2, crypto: 3.0 }, strategyTip: 'August data. Key for September Fed meeting.' },
  { date: '2025-10-24', name: 'CPI Inflation', type: 'cpi', time: '08:30', impact: 'high', historicalMove: { market: 1.2, highBeta: 2.2, crypto: 3.0 }, strategyTip: 'September data. Delayed due to government schedule.' },
  { date: '2025-12-18', name: 'CPI Inflation', type: 'cpi', time: '08:30', impact: 'high', historicalMove: { market: 1.2, highBeta: 2.2, crypto: 3.0 }, strategyTip: 'November data. Day after Fed decision - double volatility risk.' },
];

// ============================================
// JOBS REPORT (Non-Farm Payrolls) 2025
// Source: BLS - Usually first Friday of month
// ============================================
export const JOBS_REPORTS_2025 = [
  { date: '2025-01-10', name: 'Jobs Report (NFP)', type: 'jobs_report', time: '08:30', impact: 'high', historicalMove: { market: 1.0, highBeta: 1.8, crypto: 2.0 }, strategyTip: 'December 2024 data. Goldilocks is 150-200k jobs.' },
  { date: '2025-02-07', name: 'Jobs Report (NFP)', type: 'jobs_report', time: '08:30', impact: 'high', historicalMove: { market: 1.0, highBeta: 1.8, crypto: 2.0 }, strategyTip: 'January data. Watch unemployment rate and wage growth.' },
  { date: '2025-03-07', name: 'Jobs Report (NFP)', type: 'jobs_report', time: '08:30', impact: 'high', historicalMove: { market: 1.0, highBeta: 1.8, crypto: 2.0 }, strategyTip: 'February data. Key input for March Fed meeting.' },
  { date: '2025-04-04', name: 'Jobs Report (NFP)', type: 'jobs_report', time: '08:30', impact: 'high', historicalMove: { market: 1.0, highBeta: 1.8, crypto: 2.0 }, strategyTip: 'March data. Spring hiring trends.' },
  { date: '2025-05-02', name: 'Jobs Report (NFP)', type: 'jobs_report', time: '08:30', impact: 'high', historicalMove: { market: 1.0, highBeta: 1.8, crypto: 2.0 }, strategyTip: 'April data. Watch for seasonal hiring patterns.' },
  { date: '2025-06-06', name: 'Jobs Report (NFP)', type: 'jobs_report', time: '08:30', impact: 'high', historicalMove: { market: 1.0, highBeta: 1.8, crypto: 2.0 }, strategyTip: 'May data. Summer job market picture.' },
  { date: '2025-07-03', name: 'Jobs Report (NFP)', type: 'jobs_report', time: '08:30', impact: 'high', historicalMove: { market: 1.0, highBeta: 1.8, crypto: 2.0 }, strategyTip: 'June data. Released before July 4th - low volume after.' },
  { date: '2025-08-01', name: 'Jobs Report (NFP)', type: 'jobs_report', time: '08:30', impact: 'high', historicalMove: { market: 1.0, highBeta: 1.8, crypto: 2.0 }, strategyTip: 'July data. Critical for September Fed decision.' },
  { date: '2025-09-05', name: 'Jobs Report (NFP)', type: 'jobs_report', time: '08:30', impact: 'high', historicalMove: { market: 1.0, highBeta: 1.8, crypto: 2.0 }, strategyTip: 'August data. Last major data before September Fed.' },
  { date: '2025-10-03', name: 'Jobs Report (NFP)', type: 'jobs_report', time: '08:30', impact: 'high', historicalMove: { market: 1.0, highBeta: 1.8, crypto: 2.0 }, strategyTip: 'September data. Q4 labor market picture.' },
  { date: '2025-11-07', name: 'Jobs Report (NFP)', type: 'jobs_report', time: '08:30', impact: 'high', historicalMove: { market: 1.0, highBeta: 1.8, crypto: 2.0 }, strategyTip: 'October data. Pre-holiday baseline.' },
  { date: '2025-12-05', name: 'Jobs Report (NFP)', type: 'jobs_report', time: '08:30', impact: 'high', historicalMove: { market: 1.0, highBeta: 1.8, crypto: 2.0 }, strategyTip: 'November data. Key for December Fed.' },
];

// ============================================
// PCE INFLATION (Fed's preferred measure)
// Source: BEA - Usually last week of month
// ============================================
export const PCE_RELEASES_2025 = [
  { date: '2025-01-31', name: 'PCE Price Index', type: 'pce', time: '08:30', impact: 'medium', historicalMove: { market: 0.8, highBeta: 1.4, crypto: 1.8 }, strategyTip: "Fed's PREFERRED inflation measure. Core PCE is key." },
  { date: '2025-02-28', name: 'PCE Price Index', type: 'pce', time: '08:30', impact: 'medium', historicalMove: { market: 0.8, highBeta: 1.4, crypto: 1.8 }, strategyTip: "January data. Watch core PCE vs CPI divergence." },
  { date: '2025-03-28', name: 'PCE Price Index', type: 'pce', time: '08:30', impact: 'medium', historicalMove: { market: 0.8, highBeta: 1.4, crypto: 1.8 }, strategyTip: "February data. Key for Fed policy outlook." },
  { date: '2025-04-30', name: 'PCE Price Index', type: 'pce', time: '08:30', impact: 'medium', historicalMove: { market: 0.8, highBeta: 1.4, crypto: 1.8 }, strategyTip: "March data. Spring inflation trends." },
  { date: '2025-05-30', name: 'PCE Price Index', type: 'pce', time: '08:30', impact: 'medium', historicalMove: { market: 0.8, highBeta: 1.4, crypto: 1.8 }, strategyTip: "April data. Ahead of June Fed meeting." },
  { date: '2025-06-27', name: 'PCE Price Index', type: 'pce', time: '08:30', impact: 'medium', historicalMove: { market: 0.8, highBeta: 1.4, crypto: 1.8 }, strategyTip: "May data. Critical for rate expectations." },
  { date: '2025-07-31', name: 'PCE Price Index', type: 'pce', time: '08:30', impact: 'medium', historicalMove: { market: 0.8, highBeta: 1.4, crypto: 1.8 }, strategyTip: "June data. Same day as Fed decision." },
  { date: '2025-08-29', name: 'PCE Price Index', type: 'pce', time: '08:30', impact: 'medium', historicalMove: { market: 0.8, highBeta: 1.4, crypto: 1.8 }, strategyTip: "July data. Before Jackson Hole implications settle." },
  { date: '2025-09-26', name: 'PCE Price Index', type: 'pce', time: '08:30', impact: 'medium', historicalMove: { market: 0.8, highBeta: 1.4, crypto: 1.8 }, strategyTip: "August data. Post-September Fed reaction." },
  { date: '2025-10-31', name: 'PCE Price Index', type: 'pce', time: '08:30', impact: 'medium', historicalMove: { market: 0.8, highBeta: 1.4, crypto: 1.8 }, strategyTip: "September data. Q4 inflation outlook." },
  { date: '2025-11-26', name: 'PCE Price Index', type: 'pce', time: '08:30', impact: 'medium', historicalMove: { market: 0.8, highBeta: 1.4, crypto: 1.8 }, strategyTip: "October data. Day before Thanksgiving - low volume." },
  { date: '2025-12-23', name: 'PCE Price Index', type: 'pce', time: '08:30', impact: 'medium', historicalMove: { market: 0.8, highBeta: 1.4, crypto: 1.8 }, strategyTip: "November data. Holiday week - light trading." },
];

// ============================================
// RETAIL SALES 2025
// Source: Census Bureau - Usually mid-month
// ============================================
export const RETAIL_SALES_2025 = [
  { date: '2025-01-16', name: 'Retail Sales', type: 'retail_sales', time: '08:30', impact: 'medium', historicalMove: { market: 0.5, highBeta: 0.9, crypto: 1.0 }, strategyTip: 'December holiday sales data. Consumer spending = 70% of GDP.' },
  { date: '2025-02-14', name: 'Retail Sales', type: 'retail_sales', time: '08:30', impact: 'medium', historicalMove: { market: 0.5, highBeta: 0.9, crypto: 1.0 }, strategyTip: 'January data. Post-holiday spending trends.' },
  { date: '2025-03-17', name: 'Retail Sales', type: 'retail_sales', time: '08:30', impact: 'medium', historicalMove: { market: 0.5, highBeta: 0.9, crypto: 1.0 }, strategyTip: 'February data. Winter consumer patterns.' },
  { date: '2025-04-16', name: 'Retail Sales', type: 'retail_sales', time: '08:30', impact: 'medium', historicalMove: { market: 0.5, highBeta: 0.9, crypto: 1.0 }, strategyTip: 'March data. Spring spending trends.' },
  { date: '2025-05-15', name: 'Retail Sales', type: 'retail_sales', time: '08:30', impact: 'medium', historicalMove: { market: 0.5, highBeta: 0.9, crypto: 1.0 }, strategyTip: 'April data. Consumer health check.' },
  { date: '2025-06-17', name: 'Retail Sales', type: 'retail_sales', time: '08:30', impact: 'medium', historicalMove: { market: 0.5, highBeta: 0.9, crypto: 1.0 }, strategyTip: 'May data. Summer spending kickoff.' },
  { date: '2025-07-16', name: 'Retail Sales', type: 'retail_sales', time: '08:30', impact: 'medium', historicalMove: { market: 0.5, highBeta: 0.9, crypto: 1.0 }, strategyTip: 'June data. Mid-year consumer trends.' },
  { date: '2025-08-15', name: 'Retail Sales', type: 'retail_sales', time: '08:30', impact: 'medium', historicalMove: { market: 0.5, highBeta: 0.9, crypto: 1.0 }, strategyTip: 'July data. Back-to-school early signals.' },
  { date: '2025-09-17', name: 'Retail Sales', type: 'retail_sales', time: '08:30', impact: 'medium', historicalMove: { market: 0.5, highBeta: 0.9, crypto: 1.0 }, strategyTip: 'August data. Back-to-school spending.' },
  { date: '2025-10-17', name: 'Retail Sales', type: 'retail_sales', time: '08:30', impact: 'medium', historicalMove: { market: 0.5, highBeta: 0.9, crypto: 1.0 }, strategyTip: 'September data. Pre-holiday baseline.' },
  { date: '2025-11-17', name: 'Retail Sales', type: 'retail_sales', time: '08:30', impact: 'medium', historicalMove: { market: 0.5, highBeta: 0.9, crypto: 1.0 }, strategyTip: 'October data. Early holiday shopping signals.' },
  { date: '2025-12-16', name: 'Retail Sales', type: 'retail_sales', time: '08:30', impact: 'medium', historicalMove: { market: 0.5, highBeta: 0.9, crypto: 1.0 }, strategyTip: 'November data. Black Friday/Cyber Monday impact.' },
];

// ============================================
// JACKSON HOLE SYMPOSIUM
// Source: Kansas City Fed - Last week of August
// ============================================
export const JACKSON_HOLE_2025 = [
  { date: '2025-08-22', name: 'Jackson Hole - Fed Chair Speech', type: 'jackson_hole', time: '10:00', impact: 'high', historicalMove: { market: 1.5, highBeta: 2.5, crypto: 3.5 }, strategyTip: "Annual symposium where major policy shifts are announced. One of the most important speeches of the year." },
];

// ============================================
// CONSUMER CONFIDENCE 2025
// Source: Conference Board - Last Tuesday of month
// ============================================
export const CONSUMER_CONFIDENCE_2025 = [
  { date: '2025-01-28', name: 'Consumer Confidence', type: 'consumer_confidence', time: '10:00', impact: 'low', historicalMove: { market: 0.3, highBeta: 0.5, crypto: 0.6 }, strategyTip: 'How optimistic are consumers? High = more spending ahead.' },
  { date: '2025-02-25', name: 'Consumer Confidence', type: 'consumer_confidence', time: '10:00', impact: 'low', historicalMove: { market: 0.3, highBeta: 0.5, crypto: 0.6 }, strategyTip: 'February reading. Watch expectations component.' },
  { date: '2025-03-25', name: 'Consumer Confidence', type: 'consumer_confidence', time: '10:00', impact: 'low', historicalMove: { market: 0.3, highBeta: 0.5, crypto: 0.6 }, strategyTip: 'March reading. Spring outlook.' },
  { date: '2025-04-29', name: 'Consumer Confidence', type: 'consumer_confidence', time: '10:00', impact: 'low', historicalMove: { market: 0.3, highBeta: 0.5, crypto: 0.6 }, strategyTip: 'April reading. Post-tax season sentiment.' },
  { date: '2025-05-27', name: 'Consumer Confidence', type: 'consumer_confidence', time: '10:00', impact: 'low', historicalMove: { market: 0.3, highBeta: 0.5, crypto: 0.6 }, strategyTip: 'May reading. Summer outlook forming.' },
  { date: '2025-06-24', name: 'Consumer Confidence', type: 'consumer_confidence', time: '10:00', impact: 'low', historicalMove: { market: 0.3, highBeta: 0.5, crypto: 0.6 }, strategyTip: 'June reading. Mid-year sentiment check.' },
  { date: '2025-07-29', name: 'Consumer Confidence', type: 'consumer_confidence', time: '10:00', impact: 'low', historicalMove: { market: 0.3, highBeta: 0.5, crypto: 0.6 }, strategyTip: 'July reading. Summer spending outlook.' },
  { date: '2025-08-26', name: 'Consumer Confidence', type: 'consumer_confidence', time: '10:00', impact: 'low', historicalMove: { market: 0.3, highBeta: 0.5, crypto: 0.6 }, strategyTip: 'August reading. Back-to-school sentiment.' },
  { date: '2025-09-30', name: 'Consumer Confidence', type: 'consumer_confidence', time: '10:00', impact: 'low', historicalMove: { market: 0.3, highBeta: 0.5, crypto: 0.6 }, strategyTip: 'September reading. Q4 outlook.' },
  { date: '2025-10-28', name: 'Consumer Confidence', type: 'consumer_confidence', time: '10:00', impact: 'low', historicalMove: { market: 0.3, highBeta: 0.5, crypto: 0.6 }, strategyTip: 'October reading. Pre-holiday sentiment.' },
  { date: '2025-11-25', name: 'Consumer Confidence', type: 'consumer_confidence', time: '10:00', impact: 'low', historicalMove: { market: 0.3, highBeta: 0.5, crypto: 0.6 }, strategyTip: 'November reading. Holiday shopping outlook.' },
  { date: '2025-12-30', name: 'Consumer Confidence', type: 'consumer_confidence', time: '10:00', impact: 'low', historicalMove: { market: 0.3, highBeta: 0.5, crypto: 0.6 }, strategyTip: 'December reading. Year-end sentiment.' },
];

// ============================================
// MARKET HOLIDAYS 2025
// ============================================
export const MARKET_HOLIDAYS_2025 = [
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

// ============================================
// COMBINED EXPORT
// ============================================
export const ALL_ECONOMIC_EVENTS_2025 = [
  ...FED_MEETINGS_2025,
  ...CPI_RELEASES_2025,
  ...JOBS_REPORTS_2025,
  ...PCE_RELEASES_2025,
  ...RETAIL_SALES_2025,
  ...JACKSON_HOLE_2025,
  ...CONSUMER_CONFIDENCE_2025,
  ...MARKET_HOLIDAYS_2025,
];

/**
 * Get all economic events within a date range
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @returns {Array} Events in range, sorted by date
 */
export const getEconomicEventsInRange = (startDate, endDate) => {
  const events = ALL_ECONOMIC_EVENTS_2025
    .filter(event => event.date >= startDate && event.date <= endDate)
    .map(event => ({
      ...event,
      id: `${event.type}-${event.date}`,
      source: 'static',
    }));

  // Sort by date, then by impact
  const impactOrder = { high: 0, medium: 1, low: 2, info: 3 };
  return events.sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    return (impactOrder[a.impact] || 3) - (impactOrder[b.impact] || 3);
  });
};
