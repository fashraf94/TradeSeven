// src/data/weekAheadEvents.js
// Manual week ahead events - update weekly or as needed

export const WEEK_AHEAD_EVENTS = [
  { date: '2025-12-15', name: 'Home Builder Confidence', time: '08:30', impact: 'medium', type: 'Housing Related' },
  { date: '2025-12-16', name: 'Jobs Report (Delayed)', time: '08:30', impact: 'high', type: 'Employment Data' },
  { date: '2025-12-16', name: 'Retail Sales', time: '08:30', impact: 'medium', type: 'Retail Data' },
  { date: '2025-12-17', name: 'Fed Rate Decision', time: '14:00', impact: 'high', type: 'Fed' },
  { date: '2025-12-18', name: 'CPI Inflation', time: '08:30', impact: 'high', type: 'Inflation' },
  { date: '2025-12-18', name: 'Jobless Claims', time: '08:30', impact: 'low', type: 'Employment Data' },
  { date: '2025-12-18', name: 'Existing Home Sales', time: '08:30', impact: 'medium', type: 'Housing Related' },
  { date: '2025-12-18', name: 'Consumer Sentiment', time: '08:30', impact: 'medium', type: 'Retail Data' },
];

// Historical move data by event type
export const HISTORICAL_MOVES = {
  'Fed': { market: 1.8, highBeta: 3.2, crypto: 4.5 },
  'Inflation': { market: 1.2, highBeta: 2.2, crypto: 3.0 },
  'Employment Data': { market: 1.0, highBeta: 1.8, crypto: 2.0 },
  'Retail Data': { market: 0.5, highBeta: 0.9, crypto: 1.0 },
  'Housing Related': { market: 0.3, highBeta: 0.6, crypto: 0.5 },
};

// Strategy tips by event type
export const STRATEGY_TIPS = {
  'Fed': 'The Fed sets interest rates for the entire economy. Press conference at 2:30pm often moves markets more than the decision itself.',
  'Inflation': 'Hot inflation = rate hike fears = tech sells off. Cool inflation = rally, especially growth stocks.',
  'Employment Data': 'Strong jobs = good economy but higher rate expectations. Goldilocks is moderate growth (150-200k jobs).',
  'Retail Data': 'Consumer spending drives 70% of GDP. Strong retail = economic confidence. Weak retail = recession fears.',
  'Housing Related': 'Rate-sensitive sector. Lower rates = more building activity and home sales.',
};

/**
 * Get events for a date range, sorted by date then impact
 */
export const getWeekAheadEvents = (startDate, endDate) => {
  const impactOrder = { high: 0, medium: 1, low: 2 };

  return WEEK_AHEAD_EVENTS
    .filter(e => e.date >= startDate && e.date <= endDate)
    .map(e => ({
      ...e,
      id: `${e.type}-${e.date}-${e.name}`,
      historicalMove: HISTORICAL_MOVES[e.type] || { market: 0.5, highBeta: 1.0, crypto: 1.0 },
      strategyTip: STRATEGY_TIPS[e.type] || 'Monitor the market reaction and be prepared for volatility.',
    }))
    .sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return (impactOrder[a.impact] || 2) - (impactOrder[b.impact] || 2);
    });
};
