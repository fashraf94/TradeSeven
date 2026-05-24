import { dayOf } from './dayOfTimestamp.js';

// Per-day score for the Film Room ScoreSummaryCard.
//
// scoreState.dailyScores[`day${N}`] only holds badge points (see
// agent-daily-scores cron, api/cron/agent-daily-scores.js:160-165).
// Trade-locked points are stored per-trade on `lockedPoints`, scoped to
// the trading day by `swapDay` (1-based). Older battles may have trades
// without swapDay populated — fall through to dayOf(swappedOutAt, battle).

export function filterTradesByDay(trades, dayNum, battle) {
  if (!Array.isArray(trades) || !dayNum) return [];
  return trades.filter((t) => {
    if (!t) return false;
    if (typeof t.swapDay === 'number') return t.swapDay === dayNum;
    return dayOf(t.swappedOutAt, battle) === dayNum;
  });
}

export function computeDayScore(battle, dayNum) {
  const dayKey = `day${dayNum}`;
  const badgePoints = battle?.scoreState?.dailyScores?.[dayKey]?.badgePoints ?? 0;

  const trades = Array.isArray(battle?.trades) ? battle.trades : [];
  const dayTrades = filterTradesByDay(trades, dayNum, battle);
  const tradePoints = dayTrades.reduce((sum, t) => {
    const pts = typeof t?.lockedPoints === 'number' ? t.lockedPoints : 0;
    return sum + pts;
  }, 0);

  return {
    tradePoints,
    badgePoints,
    total: tradePoints + badgePoints,
  };
}
