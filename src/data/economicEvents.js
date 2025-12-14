// src/data/economicEvents.js
// Static economic calendar - manually maintained for accuracy

export const ECONOMIC_EVENTS_2025 = [
  // ============== DECEMBER 2025 ==============
  {
    id: 'fomc-2025-12-17',
    name: 'Fed Rate Decision',
    type: 'fed_decision',
    date: '2025-12-17',
    time: '14:00',
    timezone: 'America/New_York',
    impact: 'high',
    expected: 'Hold at 4.25-4.50%',
    historicalMove: {
      market: 1.8,
      highBeta: 3.2,
      crypto: 4.5
    },
    strategyTip: 'The press conference at 2:30pm often moves markets more than the decision itself. Hawkish tone = selloff, dovish = rally.',
    affectedSectors: ['Financials', 'Real Estate', 'Technology']
  },
  {
    id: 'fomc-minutes-2025-12-03',
    name: 'FOMC Minutes',
    type: 'fed_minutes',
    date: '2025-12-03',
    time: '14:00',
    timezone: 'America/New_York',
    impact: 'medium',
    historicalMove: {
      market: 0.5,
      highBeta: 0.9,
      crypto: 1.2
    },
    strategyTip: 'Usually less impactful than the decision itself, but can surprise if tone differs from expectations.',
    affectedSectors: ['Financials']
  },

  // ============== JANUARY 2026 ==============
  {
    id: 'jobs-2026-01-10',
    name: 'Jobs Report (Non-Farm Payrolls)',
    type: 'jobs_report',
    date: '2026-01-10',
    time: '08:30',
    timezone: 'America/New_York',
    impact: 'high',
    historicalMove: {
      market: 1.0,
      highBeta: 1.8,
      crypto: 2.0
    },
    strategyTip: 'Strong jobs = good economy but higher rate expectations. Goldilocks is moderate growth (~150-200k jobs).',
    affectedSectors: ['All']
  },
  {
    id: 'cpi-2026-01-15',
    name: 'CPI Inflation Report',
    type: 'cpi',
    date: '2026-01-15',
    time: '08:30',
    timezone: 'America/New_York',
    impact: 'high',
    historicalMove: {
      market: 1.2,
      highBeta: 2.2,
      crypto: 3.0
    },
    strategyTip: 'Hot CPI = rate hike fears = tech sells off hard. Cool CPI = rally, especially growth stocks.',
    affectedSectors: ['Technology', 'Consumer Discretionary', 'Real Estate']
  },
  {
    id: 'fomc-2026-01-29',
    name: 'Fed Rate Decision',
    type: 'fed_decision',
    date: '2026-01-29',
    time: '14:00',
    timezone: 'America/New_York',
    impact: 'high',
    expected: 'TBD',
    historicalMove: {
      market: 1.8,
      highBeta: 3.2,
      crypto: 4.5
    },
    strategyTip: 'First Fed meeting of 2026. Market will be watching for signals on rate cut pace.',
    affectedSectors: ['Financials', 'Real Estate', 'Technology']
  },
  {
    id: 'pce-2026-01-31',
    name: 'PCE Price Index',
    type: 'pce',
    date: '2026-01-31',
    time: '08:30',
    timezone: 'America/New_York',
    impact: 'high',
    historicalMove: {
      market: 0.8,
      highBeta: 1.5,
      crypto: 2.0
    },
    strategyTip: "The Fed's preferred inflation measure. Often moves markets even more than CPI.",
    affectedSectors: ['All']
  },

  // ============== FEBRUARY 2026 ==============
  {
    id: 'jobs-2026-02-06',
    name: 'Jobs Report (Non-Farm Payrolls)',
    type: 'jobs_report',
    date: '2026-02-06',
    time: '08:30',
    timezone: 'America/New_York',
    impact: 'high',
    historicalMove: {
      market: 1.0,
      highBeta: 1.8,
      crypto: 2.0
    },
    strategyTip: 'Strong jobs = good economy but higher rate expectations. Watch for revisions to prior months.',
    affectedSectors: ['All']
  },
  {
    id: 'cpi-2026-02-12',
    name: 'CPI Inflation Report',
    type: 'cpi',
    date: '2026-02-12',
    time: '08:30',
    timezone: 'America/New_York',
    impact: 'high',
    historicalMove: {
      market: 1.2,
      highBeta: 2.2,
      crypto: 3.0
    },
    strategyTip: 'Month-over-month change matters more than year-over-year. Watch core CPI (excludes food/energy).',
    affectedSectors: ['Technology', 'Consumer Discretionary', 'Real Estate']
  },

  // ============== MARCH 2026 ==============
  {
    id: 'jobs-2026-03-06',
    name: 'Jobs Report (Non-Farm Payrolls)',
    type: 'jobs_report',
    date: '2026-03-06',
    time: '08:30',
    timezone: 'America/New_York',
    impact: 'high',
    historicalMove: {
      market: 1.0,
      highBeta: 1.8,
      crypto: 2.0
    },
    strategyTip: 'First Friday of the month. Markets often volatile in the hour after release.',
    affectedSectors: ['All']
  },
  {
    id: 'cpi-2026-03-11',
    name: 'CPI Inflation Report',
    type: 'cpi',
    date: '2026-03-11',
    time: '08:30',
    timezone: 'America/New_York',
    impact: 'high',
    historicalMove: {
      market: 1.2,
      highBeta: 2.2,
      crypto: 3.0
    },
    strategyTip: 'Watch for shelter costs - they make up a large portion of CPI and have been sticky.',
    affectedSectors: ['Technology', 'Consumer Discretionary', 'Real Estate']
  },
  {
    id: 'fomc-2026-03-18',
    name: 'Fed Rate Decision',
    type: 'fed_decision',
    date: '2026-03-18',
    time: '14:00',
    timezone: 'America/New_York',
    impact: 'high',
    expected: 'TBD',
    historicalMove: {
      market: 1.8,
      highBeta: 3.2,
      crypto: 4.5
    },
    strategyTip: 'This meeting includes updated economic projections (dot plot). Can move markets significantly.',
    affectedSectors: ['Financials', 'Real Estate', 'Technology']
  },
];

// Market holidays and early closes
export const MARKET_HOLIDAYS_2025_2026 = [
  // 2025
  {
    id: 'christmas-eve-2025',
    name: 'Christmas Eve',
    type: 'early_close',
    date: '2025-12-24',
    closeTime: '13:00',
    timezone: 'America/New_York',
    impact: 'low',
    note: 'Markets close at 1:00 PM ET',
    strategyTip: 'Low volume trading - expect unpredictable price movements. Avoid starting battles.',
  },
  {
    id: 'christmas-2025',
    name: 'Christmas Day',
    type: 'market_closed',
    date: '2025-12-25',
    impact: 'info',
    note: 'Markets closed',
    strategyTip: 'No trading. Crypto markets still open.',
  },
  {
    id: 'new-years-eve-2025',
    name: "New Year's Eve",
    type: 'early_close',
    date: '2025-12-31',
    closeTime: '13:00',
    timezone: 'America/New_York',
    impact: 'low',
    note: 'Markets close at 1:00 PM ET',
    strategyTip: 'Year-end positioning. Many traders off. Low volume.',
  },

  // 2026
  {
    id: 'new-years-2026',
    name: "New Year's Day",
    type: 'market_closed',
    date: '2026-01-01',
    impact: 'info',
    note: 'Markets closed',
    strategyTip: 'No trading. Crypto markets still open.',
  },
  {
    id: 'mlk-day-2026',
    name: 'Martin Luther King Jr. Day',
    type: 'market_closed',
    date: '2026-01-19',
    impact: 'info',
    note: 'Markets closed',
    strategyTip: 'No trading. Crypto markets still open.',
  },
  {
    id: 'presidents-day-2026',
    name: "Presidents' Day",
    type: 'market_closed',
    date: '2026-02-16',
    impact: 'info',
    note: 'Markets closed',
    strategyTip: 'No trading. Crypto markets still open.',
  },
  {
    id: 'good-friday-2026',
    name: 'Good Friday',
    type: 'market_closed',
    date: '2026-04-03',
    impact: 'info',
    note: 'Markets closed',
    strategyTip: 'No trading. Crypto markets still open.',
  },
  {
    id: 'memorial-day-2026',
    name: 'Memorial Day',
    type: 'market_closed',
    date: '2026-05-25',
    impact: 'info',
    note: 'Markets closed',
    strategyTip: 'No trading. Crypto markets still open.',
  },
  {
    id: 'independence-day-2026',
    name: 'Independence Day (Observed)',
    type: 'market_closed',
    date: '2026-07-03',
    impact: 'info',
    note: 'Markets closed (July 4th falls on Saturday)',
    strategyTip: 'No trading. Crypto markets still open.',
  },
  {
    id: 'labor-day-2026',
    name: 'Labor Day',
    type: 'market_closed',
    date: '2026-09-07',
    impact: 'info',
    note: 'Markets closed',
    strategyTip: 'No trading. Crypto markets still open.',
  },
  {
    id: 'thanksgiving-2026',
    name: 'Thanksgiving Day',
    type: 'market_closed',
    date: '2026-11-26',
    impact: 'info',
    note: 'Markets closed',
    strategyTip: 'No trading. Crypto markets still open.',
  },
  {
    id: 'thanksgiving-after-2026',
    name: 'Day After Thanksgiving',
    type: 'early_close',
    date: '2026-11-27',
    closeTime: '13:00',
    timezone: 'America/New_York',
    impact: 'low',
    note: 'Markets close at 1:00 PM ET',
    strategyTip: 'Very low volume. Many traders still off.',
  },
  {
    id: 'christmas-eve-2026',
    name: 'Christmas Eve',
    type: 'early_close',
    date: '2026-12-24',
    closeTime: '13:00',
    timezone: 'America/New_York',
    impact: 'low',
    note: 'Markets close at 1:00 PM ET',
    strategyTip: 'Low volume trading.',
  },
  {
    id: 'christmas-2026',
    name: 'Christmas Day',
    type: 'market_closed',
    date: '2026-12-25',
    impact: 'info',
    note: 'Markets closed',
    strategyTip: 'No trading. Crypto markets still open.',
  },
];

// Event type configurations
export const EVENT_TYPE_CONFIG = {
  fed_decision: {
    icon: '🏛️',
    label: 'Fed Decision',
    color: '#ef4444',
    defaultImpact: 'high'
  },
  fed_minutes: {
    icon: '📝',
    label: 'Fed Minutes',
    color: '#f59e0b',
    defaultImpact: 'medium'
  },
  cpi: {
    icon: '📊',
    label: 'CPI Report',
    color: '#ef4444',
    defaultImpact: 'high'
  },
  pce: {
    icon: '💵',
    label: 'PCE Index',
    color: '#ef4444',
    defaultImpact: 'high'
  },
  jobs_report: {
    icon: '💼',
    label: 'Jobs Report',
    color: '#ef4444',
    defaultImpact: 'high'
  },
  gdp: {
    icon: '🌐',
    label: 'GDP Report',
    color: '#f59e0b',
    defaultImpact: 'medium'
  },
  earnings: {
    icon: '📈',
    label: 'Earnings',
    color: '#f59e0b',
    defaultImpact: 'medium'
  },
  early_close: {
    icon: '⏰',
    label: 'Early Close',
    color: '#22c55e',
    defaultImpact: 'low'
  },
  market_closed: {
    icon: '🚫',
    label: 'Closed',
    color: '#6b7280',
    defaultImpact: 'info'
  }
};

// Helper function to get events for a date range
export const getEventsForDateRange = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const economicEvents = ECONOMIC_EVENTS_2025.filter(event => {
    const eventDate = new Date(event.date);
    return eventDate >= start && eventDate <= end;
  });

  const holidays = MARKET_HOLIDAYS_2025_2026.filter(event => {
    const eventDate = new Date(event.date);
    return eventDate >= start && eventDate <= end;
  });

  return [...economicEvents, ...holidays].sort((a, b) =>
    new Date(a.date) - new Date(b.date)
  );
};

// Helper to get current week's Monday and Sunday
export const getCurrentWeekRange = () => {
  const now = new Date();
  const dayOfWeek = now.getDay();

  // Get Monday (start of week)
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  monday.setHours(0, 0, 0, 0);

  // Get Sunday (end of week)
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return { monday, sunday };
};

// Check if we should show next week (it's Saturday or Sunday)
export const shouldShowNextWeek = () => {
  const dayOfWeek = new Date().getDay();
  return dayOfWeek === 0 || dayOfWeek === 6; // Sunday = 0, Saturday = 6
};
