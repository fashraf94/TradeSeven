// api/_utils/fetchMacroEvents.js
//
// Deterministic-source fetcher for the macro economic calendar. Drop-in
// replacement for fetchEconomicEvents.js — same return contract (thisWeek /
// nextWeek / highlight / cachedAt / citations) and the same MacroEvent fields
// the DRB prompt renderer reads (date / day / time / event / impact).
//
// Consumed by api/cron/compute-daily-regime-brief.js (PR 3 Phase 3). The old
// fetchEconomicEvents.js stays in the tree because economic-events-sonar.js
// still wraps it for non-DRB HTTP surfaces.
//
// No caching (the calendar is pure data — no external call to throttle), no
// retry (no network), no validateEconEvent filtering (macroCalendar entries
// are valid by construction), no highlight synthesis (Sonnet writes the
// dailyBrief field downstream). Throws on programming errors only — the
// cron's .then(ok→ok, err→ok:false) wrapper handles any throw.

import { getMacroEventsInWindow } from './macroCalendar.js';
import { getETDate, formatDateString } from './marketSchedule.js';

// Mon–Sun week definition: "this week" runs today through the upcoming Sunday;
// "next week" runs the following Monday through the Sunday after. Both bounds
// inclusive, both expressed in ET to match every other DRB date primitive.
export async function fetchMacroEvents() {
  const today = getETDate();
  const todayStr = formatDateString(today);
  const dow = today.getDay(); // 0=Sun, 1=Mon, …, 6=Sat
  const daysToSundayThisWeek = (7 - dow) % 7;

  const sundayThisWeekStr = formatDateString(addDays(today, daysToSundayThisWeek));
  const mondayNextWeekStr = formatDateString(addDays(today, daysToSundayThisWeek + 1));
  const sundayNextWeekStr = formatDateString(addDays(today, daysToSundayThisWeek + 7));

  const allEvents = getMacroEventsInWindow({
    fromDate: todayStr,
    toDate: sundayNextWeekStr,
  });

  const thisWeek = allEvents.filter(
    (e) => e.date >= todayStr && e.date <= sundayThisWeekStr,
  );
  const nextWeek = allEvents.filter(
    (e) => e.date >= mondayNextWeekStr && e.date <= sundayNextWeekStr,
  );

  return {
    thisWeek,
    nextWeek,
    highlight: null,
    cachedAt: Date.now(),
    citations: [],
  };
}

// Local-TZ day arithmetic, paired with marketSchedule's local-TZ formatter so
// the round-trip stays TZ-independent. Same pattern as macroCalendar.js.
function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}
