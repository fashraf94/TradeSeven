// Map an ISO timestamp (or Firestore timestamp shape) to the 1-based trading day
// index for a battle. Trading days are stored on battle.timing.tradingDays[] as
// YYYY-MM-DD strings in ET (America/New_York), per agentBattleService.js:57-66
// and the agent-daily-scores cron.
//
// Returns null if the timestamp falls outside the battle's trading days or if
// the input is missing/malformed. Callers should treat null as "unknown day"
// and exclude the trade from per-day breakdowns.

function toMillis(ts) {
  if (ts == null) return null;
  if (typeof ts === 'number') return ts;
  if (typeof ts === 'string') {
    const ms = new Date(ts).getTime();
    return Number.isNaN(ms) ? null : ms;
  }
  if (typeof ts === 'object') {
    if (typeof ts.toMillis === 'function') return ts.toMillis();
    if (typeof ts.seconds === 'number') return ts.seconds * 1000;
    if (typeof ts._seconds === 'number') return ts._seconds * 1000;
  }
  return null;
}

export function dayOf(timestamp, battle) {
  const ms = toMillis(timestamp);
  if (ms == null) return null;

  const tradingDays = battle?.timing?.tradingDays;
  if (!Array.isArray(tradingDays) || tradingDays.length === 0) return null;

  const dateET = new Date(ms).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

  const idx = tradingDays.findIndex((d) => {
    if (typeof d === 'string') return d === dateET;
    if (d && typeof d === 'object' && typeof d.date === 'string') return d.date === dateET;
    return false;
  });

  return idx >= 0 ? idx + 1 : null;
}
