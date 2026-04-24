// api/_utils/seasonCalendar.js
//
// Trading-calendar builder for season docs. Extracted from
// api/admin/populate-season-experiment.js so solo-mode sessions can build
// a synthetic calendar of arbitrary length (5, 10, 15, 20 trading days)
// at create-entry time.
//
// The calendar is the authoritative lifecycle primitive in Season Mode:
// `season.tradingCalendar.length` determines when a season completes
// (season-daily-evaluate.js:530-533), `season.weeks[].tradingDays` scopes
// pit-stop debriefs to a week's worth of dailyLogs (generate-debrief.js:118),
// and `season.weeks.length` gates pit-stop eligibility
// (season-pit-stop-manage.js:111-118).
//
// Shape contracts (mirror downstream reader expectations):
//   tradingCalendar[]  : { day: 1..N, week: 1..M, date: 'YYYY-MM-DD' }
//   weeks[]            : { weekNumber, tradingDays[], startDate, endDate,
//                          pitStopWindow?: { start, end } }
//
// The pit-stop window exists for weeks that have a *subsequent* week to
// apply changes to. Phase 3 relaxes this rule for solo: the final week of
// a solo session also gets a pit-stop window, and the pit-stop manager
// cron uses that pit stop as the end-of-session debrief surface (spec
// §8 — reuse pit stop as final debrief).

// Default ticker universe for sessions that don't supply their own. Mirrors
// the list that's lived on `seasons/experiment-2026-04-13` since the first
// populate. Solo seasons reuse it so EODHD fetch shape + scale stay in
// line with what fetchSharedMarketData has been exercising in production.
export const DEFAULT_SESSION_UNIVERSE = [
  'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA', 'AVGO', 'AMD', 'CRM',
  'BRK.B', 'JPM', 'V', 'MA', 'BAC', 'WFC', 'GS', 'AXP', 'UNH', 'LLY',
  'JNJ', 'ABBV', 'MRK', 'PFE', 'HD', 'MCD', 'NKE', 'SBUX', 'TGT', 'WMT',
  'PG', 'KO', 'PEP', 'COST', 'XOM', 'CVX', 'COP', 'SLB', 'EOG', 'CAT',
  'RTX', 'UPS', 'HON', 'NEE', 'DUK', 'SO', 'D', 'AMT', 'PLD', 'CCI',
];

function toIsoDate(d) {
  return d.toISOString().slice(0, 10);
}

function isWeekend(d) {
  const day = d.getUTCDay();
  return day === 0 || day === 6;
}

// Walk forward from `from` (inclusive) until we find the next weekday.
function nextWeekday(from) {
  const d = new Date(from);
  while (isWeekend(d)) {
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return d;
}

function addDays(d, n) {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + n);
  return out;
}

/**
 * Build a tradingCalendar + weeks structure of exactly `durationDays`
 * trading days starting at `startDate` (skipping weekends).
 *
 * @param {Object} opts
 * @param {string} opts.startDate - 'YYYY-MM-DD', first candidate trading day.
 *   If it falls on a weekend, the calendar starts on the next weekday.
 * @param {number} opts.durationDays - 5, 10, 15, or 20.
 * @param {boolean} [opts.includeFinalPitStop=false] - when true, the final
 *   week also gets a pitStopWindow. Solo sessions use this to guarantee
 *   an end-of-session debrief surface; tournaments leave it false so the
 *   existing "no pit stop in the final week" semantic holds.
 * @returns {{ tradingCalendar: Array, weeks: Array }}
 */
export function buildTradingCalendar({ startDate, durationDays, includeFinalPitStop = false }) {
  if (!startDate || typeof startDate !== 'string') {
    throw new Error('buildTradingCalendar: startDate (YYYY-MM-DD) is required');
  }
  if (![5, 10, 15, 20].includes(durationDays)) {
    throw new Error(`buildTradingCalendar: durationDays must be 5, 10, 15, or 20 (got ${durationDays})`);
  }

  // Parse the start date as UTC midnight so the weekend check is stable
  // regardless of the serverless function's local TZ.
  const firstCandidate = new Date(`${startDate}T00:00:00Z`);
  if (Number.isNaN(firstCandidate.getTime())) {
    throw new Error(`buildTradingCalendar: invalid startDate "${startDate}"`);
  }
  const firstTradingDay = nextWeekday(firstCandidate);

  const totalWeeks = durationDays / 5;
  const tradingCalendar = [];
  const weeks = [];

  let cursor = firstTradingDay;

  for (let w = 1; w <= totalWeeks; w++) {
    const weekDays = [];
    let weekStart = null;
    let weekEnd = null;

    for (let d = 0; d < 5; d++) {
      // Skip weekends (shouldn't trigger mid-week, but belt-and-suspenders
      // for daylight-saving edge cases or unusual inputs).
      cursor = nextWeekday(cursor);
      const dayIndex = (w - 1) * 5 + d + 1;
      const dateIso = toIsoDate(cursor);
      tradingCalendar.push({ day: dayIndex, week: w, date: dateIso });
      weekDays.push(dayIndex);
      if (d === 0) weekStart = dateIso;
      weekEnd = dateIso;
      cursor = addDays(cursor, 1);
    }

    const isFinalWeek = w === totalWeeks;
    const weekDoc = {
      weekNumber: w,
      tradingDays: weekDays,
      startDate: weekStart,
      endDate: weekEnd,
    };

    // Pit-stop window: Saturday + Sunday following the Friday close. Only
    // attached when either this is not the final week (tournaments), OR
    // we've been told to include a final pit stop for solo sessions.
    if (!isFinalWeek || includeFinalPitStop) {
      const fridayClose = new Date(`${weekEnd}T00:00:00Z`);
      const sat = addDays(fridayClose, 1);
      const sun = addDays(fridayClose, 2);
      weekDoc.pitStopWindow = { start: toIsoDate(sat), end: toIsoDate(sun) };
    }

    weeks.push(weekDoc);
  }

  return { tradingCalendar, weeks };
}
