// src/data/staticMacroEvents.js
// High-impact events that are scheduled well in advance
// Update this file once per year when the Fed releases their schedule

// ======================
// FED MEETINGS 2025-2026
// ======================
// Source: https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm

export const FED_MEETINGS = [
  // 2025 FOMC Meetings
  {
    date: '2025-01-29',
    name: 'Fed Rate Decision',
    type: 'fed_decision',
    time: '14:00',
    impact: 'high',
    hasPresser: true,
    historicalMove: { market: 1.8, highBeta: 3.2, crypto: 4.5 },
    strategyTip: 'First meeting of 2025. Watch for tone on inflation progress and rate cut timeline.',
  },
  {
    date: '2025-03-19',
    name: 'Fed Rate Decision',
    type: 'fed_decision',
    time: '14:00',
    impact: 'high',
    hasPresser: true,
    historicalMove: { market: 1.8, highBeta: 3.2, crypto: 4.5 },
    strategyTip: 'Includes updated dot plot and economic projections. Often more volatile than other meetings.',
  },
  {
    date: '2025-05-07',
    name: 'Fed Rate Decision',
    type: 'fed_decision',
    time: '14:00',
    impact: 'high',
    hasPresser: true,
    historicalMove: { market: 1.8, highBeta: 3.2, crypto: 4.5 },
    strategyTip: 'Spring meeting. Markets will be watching for summer rate cut signals.',
  },
  {
    date: '2025-06-18',
    name: 'Fed Rate Decision',
    type: 'fed_decision',
    time: '14:00',
    impact: 'high',
    hasPresser: true,
    historicalMove: { market: 1.8, highBeta: 3.2, crypto: 4.5 },
    strategyTip: 'Includes dot plot update. Key meeting for H2 2025 rate expectations.',
  },
  {
    date: '2025-07-30',
    name: 'Fed Rate Decision',
    type: 'fed_decision',
    time: '14:00',
    impact: 'high',
    hasPresser: true,
    historicalMove: { market: 1.8, highBeta: 3.2, crypto: 4.5 },
    strategyTip: 'Mid-summer meeting. Often sets tone before Jackson Hole.',
  },
  {
    date: '2025-09-17',
    name: 'Fed Rate Decision',
    type: 'fed_decision',
    time: '14:00',
    impact: 'high',
    hasPresser: true,
    historicalMove: { market: 1.8, highBeta: 3.2, crypto: 4.5 },
    strategyTip: 'Post-Jackson Hole meeting. Includes updated projections.',
  },
  {
    date: '2025-10-29',
    name: 'Fed Rate Decision',
    type: 'fed_decision',
    time: '14:00',
    impact: 'high',
    hasPresser: true,
    historicalMove: { market: 1.8, highBeta: 3.2, crypto: 4.5 },
    strategyTip: 'Pre-election positioning. Markets often nervous.',
  },
  {
    date: '2025-12-17',
    name: 'Fed Rate Decision',
    type: 'fed_decision',
    time: '14:00',
    impact: 'high',
    hasPresser: true,
    historicalMove: { market: 1.8, highBeta: 3.2, crypto: 4.5 },
    strategyTip: 'Last meeting of 2025. Includes 2026 rate projections. Press conference at 2:30pm moves markets.',
  },
  // 2026 FOMC Meetings
  {
    date: '2026-01-28',
    name: 'Fed Rate Decision',
    type: 'fed_decision',
    time: '14:00',
    impact: 'high',
    hasPresser: true,
    historicalMove: { market: 1.8, highBeta: 3.2, crypto: 4.5 },
    strategyTip: 'First meeting of 2026. Sets the tone for the year.',
  },
  {
    date: '2026-03-18',
    name: 'Fed Rate Decision',
    type: 'fed_decision',
    time: '14:00',
    impact: 'high',
    hasPresser: true,
    historicalMove: { market: 1.8, highBeta: 3.2, crypto: 4.5 },
    strategyTip: 'Includes dot plot and economic projections.',
  },
];

// ======================
// JACKSON HOLE SYMPOSIUM
// ======================
// Usually last week of August, Thursday-Saturday
// Fed Chair speaks Friday morning

export const JACKSON_HOLE = [
  {
    date: '2025-08-22',
    name: 'Jackson Hole - Fed Chair Speech',
    type: 'jackson_hole',
    time: '10:00',
    impact: 'high',
    historicalMove: { market: 1.5, highBeta: 2.5, crypto: 3.5 },
    strategyTip: "Annual symposium where Fed Chair often signals major policy shifts. One of the most important speeches of the year.",
  },
  {
    date: '2026-08-28',
    name: 'Jackson Hole - Fed Chair Speech',
    type: 'jackson_hole',
    time: '10:00',
    impact: 'high',
    historicalMove: { market: 1.5, highBeta: 2.5, crypto: 3.5 },
    strategyTip: "Annual symposium where Fed Chair often signals major policy shifts.",
  },
];

// ======================
// MARKET HOLIDAYS 2025-2026
// ======================

export const MARKET_HOLIDAYS = [
  // 2025
  { date: '2025-01-01', name: "New Year's Day", type: 'market_closed', note: 'Markets closed' },
  { date: '2025-01-20', name: 'MLK Jr. Day', type: 'market_closed', note: 'Markets closed' },
  { date: '2025-02-17', name: "Presidents' Day", type: 'market_closed', note: 'Markets closed' },
  { date: '2025-04-18', name: 'Good Friday', type: 'market_closed', note: 'Markets closed' },
  { date: '2025-05-26', name: 'Memorial Day', type: 'market_closed', note: 'Markets closed' },
  { date: '2025-06-19', name: 'Juneteenth', type: 'market_closed', note: 'Markets closed' },
  { date: '2025-07-04', name: 'Independence Day', type: 'market_closed', note: 'Markets closed' },
  { date: '2025-09-01', name: 'Labor Day', type: 'market_closed', note: 'Markets closed' },
  { date: '2025-11-27', name: 'Thanksgiving', type: 'market_closed', note: 'Markets closed' },
  { date: '2025-11-28', name: 'Day After Thanksgiving', type: 'early_close', time: '13:00', note: 'Markets close at 1:00 PM ET' },
  { date: '2025-12-24', name: 'Christmas Eve', type: 'early_close', time: '13:00', note: 'Markets close at 1:00 PM ET' },
  { date: '2025-12-25', name: 'Christmas Day', type: 'market_closed', note: 'Markets closed' },

  // 2026
  { date: '2026-01-01', name: "New Year's Day", type: 'market_closed', note: 'Markets closed' },
  { date: '2026-01-19', name: 'MLK Jr. Day', type: 'market_closed', note: 'Markets closed' },
  { date: '2026-02-16', name: "Presidents' Day", type: 'market_closed', note: 'Markets closed' },
  { date: '2026-04-03', name: 'Good Friday', type: 'market_closed', note: 'Markets closed' },
  { date: '2026-05-25', name: 'Memorial Day', type: 'market_closed', note: 'Markets closed' },
  { date: '2026-06-19', name: 'Juneteenth', type: 'market_closed', note: 'Markets closed' },
  { date: '2026-07-03', name: 'Independence Day (Observed)', type: 'market_closed', note: 'Markets closed' },
  { date: '2026-09-07', name: 'Labor Day', type: 'market_closed', note: 'Markets closed' },
  { date: '2026-11-26', name: 'Thanksgiving', type: 'market_closed', note: 'Markets closed' },
  { date: '2026-11-27', name: 'Day After Thanksgiving', type: 'early_close', time: '13:00', note: 'Markets close at 1:00 PM ET' },
  { date: '2026-12-24', name: 'Christmas Eve', type: 'early_close', time: '13:00', note: 'Markets close at 1:00 PM ET' },
  { date: '2026-12-25', name: 'Christmas Day', type: 'market_closed', note: 'Markets closed' },
];

// ======================
// HELPER FUNCTIONS
// ======================

/**
 * Get all static events within a date range
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @returns {Array} Events in range
 */
export const getStaticEventsInRange = (startDate, endDate) => {
  const allStaticEvents = [
    ...FED_MEETINGS,
    ...JACKSON_HOLE,
    ...MARKET_HOLIDAYS,
  ];

  return allStaticEvents.filter(event => {
    return event.date >= startDate && event.date <= endDate;
  }).map(event => ({
    ...event,
    id: `static-${event.type}-${event.date}`,
    source: 'static',
  }));
};

/**
 * Check if a date is a market holiday
 * @param {string} date - YYYY-MM-DD
 * @returns {boolean}
 */
export const isMarketHoliday = (date) => {
  return MARKET_HOLIDAYS.some(h => h.date === date && h.type === 'market_closed');
};

/**
 * Check if a date has an early close
 * @param {string} date - YYYY-MM-DD
 * @returns {object|null} Holiday info or null
 */
export const getEarlyClose = (date) => {
  return MARKET_HOLIDAYS.find(h => h.date === date && h.type === 'early_close') || null;
};
