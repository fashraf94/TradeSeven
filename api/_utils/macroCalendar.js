// api/_utils/macroCalendar.js
//
// Deterministic source of truth for US macro economic event dates.
//
// ARCHITECTURE
// ------------
// Three layers feed the unified getMacroEventsInWindow query:
//
//   1. Hardcoded arrays (7 categories: FOMC, CPI, PPI, PCE, Retail Sales,
//      GDP, Productivity). Releases that follow agency-published annual
//      calendars. Each array holds 2026 entries in MacroEvent shape;
//      refresh annually from the source URLs in the table below.
//
//   2. Computed helpers (5 categories in the unified query: NFP,
//      ISM Manufacturing, ISM Services, Consumer Confidence, Jobless
//      Claims). Releases that follow deterministic patterns (first Friday,
//      Nth business day, last Tuesday, every Thursday). Compiled at call
//      time for the year(s) the window touches, so they need no annual
//      refresh. getJOLTSDates still exists but is EXCLUDED from the query
//      — dropped from the Tier-1 set by the Econ Capture rulings §2
//      (Jul 30 2026); see the note at the concat site.
//
//   3. getMacroEventsInWindow({ fromDate, toDate }) — concatenates every
//      source, filters inclusively by date, returns sorted ascending.
//
// MacroEvent shape (matches what the DRB renderer in dailyRegimeBriefPrompt.js
// reads — fields `date`, `day`, `time`, `event`, `impact`. `category` is
// carried for downstream filtering even though the renderer ignores it):
//   {
//     date:     "YYYY-MM-DD",
//     day:      "Monday" | … | "Sunday",
//     time:     "8:30 AM ET" | "10:00 AM ET" | "2:00 PM ET",
//     category: "FOMC" | "NFP" | "CPI" | "PPI" | "PCE" | "Retail Sales"
//             | "GDP" | "Productivity" | "JOLTS" | "ISM Manufacturing"
//             | "ISM Services" | "Consumer Confidence" | "Jobless Claims",
//     impact:   "high" | "medium",
//     event:    string,
//   }
//
// SOURCES (hardcoded arrays — refresh annually, typically in December for
// the next year). Computed-helper categories don't appear here; the rule
// itself is the schedule.
//
//   FOMC          https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm
//                 Fed; 8 meetings/year. Schedule published years in advance.
//   CPI           https://www.bls.gov/schedule/news_release/cpi.htm
//                 BLS; monthly.
//   PPI           https://www.bls.gov/schedule/news_release/ppi.htm
//                 BLS; monthly.
//   PCE           https://www.bea.gov/news/schedule
//                 BEA; monthly (Personal Income & Outlays release).
//   Retail Sales  https://www.census.gov/economic-indicators/calendar-listview.html
//                 Census; monthly (Advance Monthly Retail Trade).
//   GDP           https://www.bea.gov/news/schedule
//                 BEA; 3 releases per quarter (advance / second / third).
//   Productivity  https://www.bls.gov/schedule/news_release/prod2.htm
//                 BLS; quarterly (Productivity and Costs).
//
// When a computed rule diverges from agency reality for a specific month
// (e.g. an NFP holiday shift where BLS actually publishes earlier rather
// than later), the lightweight fix is a small per-category override array
// consulted before the computed result. None are needed for 2026 as of PR 2;
// PR 3 will add overrides surgically only where cross-referencing the
// hardcoded sources surfaces a real divergence.
//
// PR 3 WIRING
// -----------
// This module is not consumed by anything in PR 2. PR 3 introduces
// fetchMacroEvents.js (replacing fetchEconomicEvents.js), which calls
// getMacroEventsInWindow, partitions the result into thisWeek/nextWeek,
// and feeds dailyRegimeBriefPrompt.js. The DRB cron continues running on
// the Sonar fetcher until then.
//
// Category vocabulary uses specific release identifiers (FOMC / NFP / CPI / …),
// which differs from the Sonar fetcher's thematic vocabulary (manufacturing /
// employment / inflation / …). The DRB prompt renderer reads neither category
// field, so the divergence is internal to macroCalendar consumers — not a
// contract break.

import { isMarketHoliday, formatDateString } from './marketSchedule.js';

const WEEKDAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

const TUESDAY = 2;
const THURSDAY = 4;
const FRIDAY = 5;

// =============================================================================
// Hardcoded event lists — populated from agency-published annual schedules
// =============================================================================

// Source: https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm
// Five remaining 2026 decisions as of mid-May 2026. The January, March, and
// April-May meetings already occurred. Quarterly SEP meetings (March, June,
// September, December) include the Summary of Economic Projections release at
// 2:00 PM ET; the press conference follows at 2:30 PM ET.
export const FOMC_DECISIONS_2026 = [
  { date: '2026-06-17', day: 'Wednesday', time: '2:00 PM ET', category: 'FOMC', impact: 'high', event: 'FOMC rate decision + Summary of Economic Projections' },
  { date: '2026-07-29', day: 'Wednesday', time: '2:00 PM ET', category: 'FOMC', impact: 'high', event: 'FOMC rate decision' },
  { date: '2026-09-16', day: 'Wednesday', time: '2:00 PM ET', category: 'FOMC', impact: 'high', event: 'FOMC rate decision + Summary of Economic Projections' },
  { date: '2026-10-28', day: 'Wednesday', time: '2:00 PM ET', category: 'FOMC', impact: 'high', event: 'FOMC rate decision' },
  { date: '2026-12-09', day: 'Wednesday', time: '2:00 PM ET', category: 'FOMC', impact: 'high', event: 'FOMC rate decision + Summary of Economic Projections' },
];

// Source: https://www.bls.gov/schedule/news_release/cpi.htm
// Verified: 2026-05-13
export const CPI_RELEASES_2026 = [
  { date: '2026-01-13', day: 'Tuesday',   time: '8:30 AM ET', category: 'CPI', impact: 'high', event: 'CPI (December)' },
  { date: '2026-02-13', day: 'Friday',    time: '8:30 AM ET', category: 'CPI', impact: 'high', event: 'CPI (January)' },
  { date: '2026-03-11', day: 'Wednesday', time: '8:30 AM ET', category: 'CPI', impact: 'high', event: 'CPI (February)' },
  { date: '2026-04-10', day: 'Friday',    time: '8:30 AM ET', category: 'CPI', impact: 'high', event: 'CPI (March)' },
  { date: '2026-05-12', day: 'Tuesday',   time: '8:30 AM ET', category: 'CPI', impact: 'high', event: 'CPI (April)' },
  { date: '2026-06-10', day: 'Wednesday', time: '8:30 AM ET', category: 'CPI', impact: 'high', event: 'CPI (May)' },
  { date: '2026-07-14', day: 'Tuesday',   time: '8:30 AM ET', category: 'CPI', impact: 'high', event: 'CPI (June)' },
  { date: '2026-08-12', day: 'Wednesday', time: '8:30 AM ET', category: 'CPI', impact: 'high', event: 'CPI (July)' },
  { date: '2026-09-11', day: 'Friday',    time: '8:30 AM ET', category: 'CPI', impact: 'high', event: 'CPI (August)' },
  { date: '2026-10-14', day: 'Wednesday', time: '8:30 AM ET', category: 'CPI', impact: 'high', event: 'CPI (September)' },
  { date: '2026-11-10', day: 'Tuesday',   time: '8:30 AM ET', category: 'CPI', impact: 'high', event: 'CPI (October)' },
  { date: '2026-12-10', day: 'Thursday',  time: '8:30 AM ET', category: 'CPI', impact: 'high', event: 'CPI (November)' },
];

// Source: https://www.bls.gov/schedule/news_release/ppi.htm
// Verified: 2026-05-13
// 13 entries: includes the Nov-2025 release on Jan 14, 2026, which falls in the
// 2026 calendar year despite covering a 2025 reference period.
export const PPI_RELEASES_2026 = [
  { date: '2026-01-14', day: 'Wednesday', time: '8:30 AM ET', category: 'PPI', impact: 'medium', event: 'PPI (November)' },
  { date: '2026-01-30', day: 'Friday',    time: '8:30 AM ET', category: 'PPI', impact: 'medium', event: 'PPI (December)' },
  { date: '2026-02-27', day: 'Friday',    time: '8:30 AM ET', category: 'PPI', impact: 'medium', event: 'PPI (January)' },
  { date: '2026-03-18', day: 'Wednesday', time: '8:30 AM ET', category: 'PPI', impact: 'medium', event: 'PPI (February)' },
  { date: '2026-04-14', day: 'Tuesday',   time: '8:30 AM ET', category: 'PPI', impact: 'medium', event: 'PPI (March)' },
  { date: '2026-05-13', day: 'Wednesday', time: '8:30 AM ET', category: 'PPI', impact: 'medium', event: 'PPI (April)' },
  { date: '2026-06-11', day: 'Thursday',  time: '8:30 AM ET', category: 'PPI', impact: 'medium', event: 'PPI (May)' },
  { date: '2026-07-15', day: 'Wednesday', time: '8:30 AM ET', category: 'PPI', impact: 'medium', event: 'PPI (June)' },
  { date: '2026-08-13', day: 'Thursday',  time: '8:30 AM ET', category: 'PPI', impact: 'medium', event: 'PPI (July)' },
  { date: '2026-09-10', day: 'Thursday',  time: '8:30 AM ET', category: 'PPI', impact: 'medium', event: 'PPI (August)' },
  { date: '2026-10-15', day: 'Thursday',  time: '8:30 AM ET', category: 'PPI', impact: 'medium', event: 'PPI (September)' },
  { date: '2026-11-13', day: 'Friday',    time: '8:30 AM ET', category: 'PPI', impact: 'medium', event: 'PPI (October)' },
  { date: '2026-12-15', day: 'Tuesday',   time: '8:30 AM ET', category: 'PPI', impact: 'medium', event: 'PPI (November)' },
];

// Source: https://www.bea.gov/news/schedule/full (Personal Income & Outlays)
// Verified: 2026-05-13
// 13 entries: includes the combined Oct/Nov-2025 release on Jan 22, 2026 (BEA
// merged the two reports following the 2025 shutdown reschedule).
export const PCE_RELEASES_2026 = [
  { date: '2026-01-22', day: 'Thursday',  time: '8:30 AM ET', category: 'PCE', impact: 'high', event: 'PCE (October & November combined)' },
  { date: '2026-02-20', day: 'Friday',    time: '8:30 AM ET', category: 'PCE', impact: 'high', event: 'PCE (December)' },
  { date: '2026-03-13', day: 'Friday',    time: '8:30 AM ET', category: 'PCE', impact: 'high', event: 'PCE (January)' },
  { date: '2026-04-09', day: 'Thursday',  time: '8:30 AM ET', category: 'PCE', impact: 'high', event: 'PCE (February)' },
  { date: '2026-04-30', day: 'Thursday',  time: '8:30 AM ET', category: 'PCE', impact: 'high', event: 'PCE (March)' },
  { date: '2026-05-28', day: 'Thursday',  time: '8:30 AM ET', category: 'PCE', impact: 'high', event: 'PCE (April)' },
  { date: '2026-06-25', day: 'Thursday',  time: '8:30 AM ET', category: 'PCE', impact: 'high', event: 'PCE (May)' },
  { date: '2026-07-30', day: 'Thursday',  time: '8:30 AM ET', category: 'PCE', impact: 'high', event: 'PCE (June)' },
  { date: '2026-08-26', day: 'Wednesday', time: '8:30 AM ET', category: 'PCE', impact: 'high', event: 'PCE (July)' },
  { date: '2026-09-30', day: 'Wednesday', time: '8:30 AM ET', category: 'PCE', impact: 'high', event: 'PCE (August)' },
  { date: '2026-10-29', day: 'Thursday',  time: '8:30 AM ET', category: 'PCE', impact: 'high', event: 'PCE (September)' },
  { date: '2026-11-25', day: 'Wednesday', time: '8:30 AM ET', category: 'PCE', impact: 'high', event: 'PCE (October)' },
  { date: '2026-12-23', day: 'Wednesday', time: '8:30 AM ET', category: 'PCE', impact: 'high', event: 'PCE (November)' },
];

// Source: https://www.census.gov/economic-indicators/calendar-listview.html
//   (post-shutdown Census publication for the first 5 entries; pre-shutdown
//    whitehouse.gov/pfei_schedule_release_dates_cy2026 PDF for the forecast block)
// Verified: 2026-05-13
// 10 entries: 5 post-shutdown confirmed + 5 forecast carried forward. Nov/Dec
// 2026 releases (for Sep/Oct data) are omitted pending Census re-publication.
export const RETAIL_SALES_RELEASES_2026 = [
  // Confirmed dates (post-shutdown Census publication):
  { date: '2026-01-14', day: 'Wednesday', time: '8:30 AM ET', category: 'Retail Sales', impact: 'high', event: 'Retail Sales (November)' },
  { date: '2026-02-17', day: 'Tuesday',   time: '8:30 AM ET', category: 'Retail Sales', impact: 'high', event: 'Retail Sales (December)' },
  { date: '2026-04-01', day: 'Wednesday', time: '8:30 AM ET', category: 'Retail Sales', impact: 'high', event: 'Retail Sales (January)' },
  { date: '2026-04-21', day: 'Tuesday',   time: '8:30 AM ET', category: 'Retail Sales', impact: 'high', event: 'Retail Sales (February)' },
  { date: '2026-05-14', day: 'Thursday',  time: '8:30 AM ET', category: 'Retail Sales', impact: 'high', event: 'Retail Sales (March)' },
  // FORECAST dates below — taken from pre-shutdown Census schedule, NOT yet re-verified against post-shutdown publication.
  // Verify against https://www.census.gov/economic-indicators/calendar-listview.html before relying on these for production.
  { date: '2026-06-17', day: 'Wednesday', time: '8:30 AM ET', category: 'Retail Sales', impact: 'high', event: 'Retail Sales (April)' },
  { date: '2026-07-16', day: 'Thursday',  time: '8:30 AM ET', category: 'Retail Sales', impact: 'high', event: 'Retail Sales (May)' },
  { date: '2026-08-14', day: 'Friday',    time: '8:30 AM ET', category: 'Retail Sales', impact: 'high', event: 'Retail Sales (June)' },
  { date: '2026-09-16', day: 'Wednesday', time: '8:30 AM ET', category: 'Retail Sales', impact: 'high', event: 'Retail Sales (July)' },
  { date: '2026-10-15', day: 'Thursday',  time: '8:30 AM ET', category: 'Retail Sales', impact: 'high', event: 'Retail Sales (August)' },
  // Nov and Dec 2026 Retail Sales releases (for Sep and Oct data) are not yet on the post-shutdown Census schedule.
  // Update when Census publishes them — typically the 14th-17th of the following month.
];

// Source: https://www.bea.gov/news/schedule/full (GDP — advance / second / third per quarter)
// Verified: 2026-05-13
// 13 entries: includes the Q3-2025 updated estimate on Jan 22, 2026 (BEA
// substituted "updated" for the usual third estimate after the 2025 shutdown).
export const GDP_RELEASES_2026 = [
  { date: '2026-01-22', day: 'Thursday',  time: '8:30 AM ET', category: 'GDP', impact: 'medium', event: 'GDP Q3 2025 updated estimate' },
  { date: '2026-02-20', day: 'Friday',    time: '8:30 AM ET', category: 'GDP', impact: 'high',   event: 'GDP Q4 2025 advance estimate' },
  { date: '2026-03-13', day: 'Friday',    time: '8:30 AM ET', category: 'GDP', impact: 'medium', event: 'GDP Q4 2025 second estimate' },
  { date: '2026-04-09', day: 'Thursday',  time: '8:30 AM ET', category: 'GDP', impact: 'medium', event: 'GDP Q4 2025 third estimate' },
  { date: '2026-04-30', day: 'Thursday',  time: '8:30 AM ET', category: 'GDP', impact: 'high',   event: 'GDP Q1 2026 advance estimate' },
  { date: '2026-05-28', day: 'Thursday',  time: '8:30 AM ET', category: 'GDP', impact: 'medium', event: 'GDP Q1 2026 second estimate' },
  { date: '2026-06-25', day: 'Thursday',  time: '8:30 AM ET', category: 'GDP', impact: 'medium', event: 'GDP Q1 2026 third estimate' },
  { date: '2026-07-30', day: 'Thursday',  time: '8:30 AM ET', category: 'GDP', impact: 'high',   event: 'GDP Q2 2026 advance estimate' },
  { date: '2026-08-26', day: 'Wednesday', time: '8:30 AM ET', category: 'GDP', impact: 'medium', event: 'GDP Q2 2026 second estimate' },
  { date: '2026-09-30', day: 'Wednesday', time: '8:30 AM ET', category: 'GDP', impact: 'medium', event: 'GDP Q2 2026 third estimate' },
  { date: '2026-10-29', day: 'Thursday',  time: '8:30 AM ET', category: 'GDP', impact: 'high',   event: 'GDP Q3 2026 advance estimate' },
  { date: '2026-11-25', day: 'Wednesday', time: '8:30 AM ET', category: 'GDP', impact: 'medium', event: 'GDP Q3 2026 second estimate' },
  { date: '2026-12-23', day: 'Wednesday', time: '8:30 AM ET', category: 'GDP', impact: 'medium', event: 'GDP Q3 2026 third estimate' },
];

// Source: https://www.bls.gov/schedule/news_release/prod2.htm (Productivity and Costs, quarterly)
// Verified: 2026-05-13
// 10 entries: 5 quarters covered (Q3-2025 carryover through Q3-2026), each
// quarter releasing both a preliminary and a revised estimate.
export const PRODUCTIVITY_RELEASES_2026 = [
  { date: '2026-01-08', day: 'Thursday',  time: '8:30 AM ET', category: 'Productivity', impact: 'medium', event: 'Productivity Q3 2025 preliminary' },
  { date: '2026-01-29', day: 'Thursday',  time: '8:30 AM ET', category: 'Productivity', impact: 'medium', event: 'Productivity Q3 2025 revised' },
  { date: '2026-03-05', day: 'Thursday',  time: '8:30 AM ET', category: 'Productivity', impact: 'medium', event: 'Productivity Q4 2025 preliminary' },
  { date: '2026-03-24', day: 'Tuesday',   time: '8:30 AM ET', category: 'Productivity', impact: 'medium', event: 'Productivity Q4 2025 revised' },
  { date: '2026-05-07', day: 'Thursday',  time: '8:30 AM ET', category: 'Productivity', impact: 'medium', event: 'Productivity Q1 2026 preliminary' },
  { date: '2026-06-04', day: 'Thursday',  time: '8:30 AM ET', category: 'Productivity', impact: 'medium', event: 'Productivity Q1 2026 revised' },
  { date: '2026-08-06', day: 'Thursday',  time: '8:30 AM ET', category: 'Productivity', impact: 'medium', event: 'Productivity Q2 2026 preliminary' },
  { date: '2026-09-03', day: 'Thursday',  time: '8:30 AM ET', category: 'Productivity', impact: 'medium', event: 'Productivity Q2 2026 revised' },
  { date: '2026-11-05', day: 'Thursday',  time: '8:30 AM ET', category: 'Productivity', impact: 'medium', event: 'Productivity Q3 2026 preliminary' },
  { date: '2026-12-08', day: 'Tuesday',   time: '8:30 AM ET', category: 'Productivity', impact: 'medium', event: 'Productivity Q3 2026 revised' },
];

// =============================================================================
// Computed schedule helpers
// =============================================================================

// Nonfarm Payrolls — released first Friday of each month at 8:30 AM ET. If that
// Friday is an NYSE holiday, advances to the next business day (BLS does not
// release on a federal holiday). The description references the prior month
// (release month - 1) because each NFP report covers the prior month's data.
//
// Known computed-rule limitations to revisit in PR 3:
//   - April 2026 first Friday (Apr 3) is Good Friday → shifts to Mon Apr 6.
//   - July 2026 first Friday (Jul 3) is observed Independence Day → shifts to Mon Jul 6.
// Real BLS practice can also shift earlier (Thursday) rather than later. If
// historical data shows the BLS schedule diverges from this forward-shift rule,
// PR 3 may need a hardcoded override list.
export function getNFPDates(year) {
  return MONTHS.map((month) => {
    let date = nthWeekdayOfMonth(year, month, 1, FRIDAY);
    if (isMarketHoliday(formatDateString(date))) {
      date = nextBusinessDay(date);
    }
    const dataMonth = priorMonth(month);
    return makeMacroEvent(date, '8:30 AM ET', 'NFP', 'high',
      `Nonfarm Payrolls (${MONTH_NAMES[dataMonth - 1]})`);
  });
}

// JOLTS — released first Tuesday of each month at 10:00 AM ET. Data is for two
// months prior (e.g. March data released first Tuesday of May).
//
// Note: BLS's actual JOLTS schedule is not strictly "first Tuesday" every month
// — it's typically the first Tuesday but can shift by a week. PR 3 may override
// individual months if needed.
export function getJOLTSDates(year) {
  return MONTHS.map((month) => {
    const date = nthWeekdayOfMonth(year, month, 1, TUESDAY);
    const dataMonth = priorMonth(priorMonth(month));
    return makeMacroEvent(date, '10:00 AM ET', 'JOLTS', 'medium',
      `JOLTS (${MONTH_NAMES[dataMonth - 1]})`);
  });
}

// ISM Manufacturing PMI — released first business day of each month at 10:00 AM ET.
// References prior-month data.
export function getISMManufacturingDates(year) {
  return MONTHS.map((month) => {
    const date = nthBusinessDayOfMonth(year, month, 1);
    const dataMonth = priorMonth(month);
    return makeMacroEvent(date, '10:00 AM ET', 'ISM Manufacturing', 'medium',
      `ISM Manufacturing PMI (${MONTH_NAMES[dataMonth - 1]})`);
  });
}

// ISM Services PMI — released third business day of each month at 10:00 AM ET.
// References prior-month data.
export function getISMServicesDates(year) {
  return MONTHS.map((month) => {
    const date = nthBusinessDayOfMonth(year, month, 3);
    const dataMonth = priorMonth(month);
    return makeMacroEvent(date, '10:00 AM ET', 'ISM Services', 'medium',
      `ISM Services PMI (${MONTH_NAMES[dataMonth - 1]})`);
  });
}

// Consumer Confidence (Conference Board) — released last Tuesday of each month
// at 10:00 AM ET. Description carries the release month (the report is named
// for the month it surveys, which is the release month).
export function getConsumerConfidenceDates(year) {
  return MONTHS.map((month) => {
    const date = lastWeekdayOfMonth(year, month, TUESDAY);
    return makeMacroEvent(date, '10:00 AM ET', 'Consumer Confidence', 'medium',
      `Consumer Confidence (${MONTH_NAMES[month - 1]})`);
  });
}

// Initial Jobless Claims (DOL) — released every Thursday at 8:30 AM ET.
// Added per the Recap Restoration ruling R-A1 (Jul 30, 2026): jobless claims
// is Tier-1 by array membership; its weekly cadence is what gives the R9
// liveness row its ≤1-week bound. When Thursday is a market holiday, DOL
// releases EARLIER (the prior business day — Thanksgiving-week practice),
// unlike NFP's forward shift.
export function getJoblessClaimsDates(year) {
  const events = [];
  let date = firstWeekdayOfYear(year, THURSDAY);
  while (date.getFullYear() === year) {
    let releaseDate = date;
    if (isMarketHoliday(formatDateString(releaseDate))) {
      releaseDate = previousBusinessDay(releaseDate);
    }
    events.push(makeMacroEvent(releaseDate, '8:30 AM ET', 'Jobless Claims', 'medium',
      'Initial Jobless Claims'));
    date = addDays(date, 7);
  }
  return events;
}

// =============================================================================
// Date primitives — local-TZ Date arithmetic + marketSchedule helpers for
// holiday/format. Local-TZ getters are paired with local-TZ Date constructors
// so the result is TZ-independent (no UTC drift).
// =============================================================================

function dateAt(year, month, day) {
  return new Date(year, month - 1, day);
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function isWeekend(date) {
  const w = date.getDay();
  return w === 0 || w === 6;
}

function isBusinessDay(date) {
  return !isWeekend(date) && !isMarketHoliday(formatDateString(date));
}

function nextBusinessDay(date) {
  let candidate = addDays(date, 1);
  while (!isBusinessDay(candidate)) candidate = addDays(candidate, 1);
  return candidate;
}

function previousBusinessDay(date) {
  let candidate = addDays(date, -1);
  while (!isBusinessDay(candidate)) candidate = addDays(candidate, -1);
  return candidate;
}

function firstWeekdayOfYear(year, weekday) {
  const jan1 = dateAt(year, 1, 1);
  const offset = (weekday - jan1.getDay() + 7) % 7;
  return dateAt(year, 1, 1 + offset);
}

function nthWeekdayOfMonth(year, month, n, weekday) {
  const first = dateAt(year, month, 1);
  const offsetToFirstHit = (weekday - first.getDay() + 7) % 7;
  return dateAt(year, month, 1 + offsetToFirstHit + (n - 1) * 7);
}

function lastWeekdayOfMonth(year, month, weekday) {
  // Last day of month: day 0 of (month + 1).
  const lastDay = new Date(year, month, 0);
  const offsetBack = (lastDay.getDay() - weekday + 7) % 7;
  return dateAt(year, month, lastDay.getDate() - offsetBack);
}

function nthBusinessDayOfMonth(year, month, n) {
  let count = 0;
  for (let day = 1; day <= 31; day += 1) {
    const d = dateAt(year, month, day);
    if (d.getMonth() !== month - 1) break;
    if (isBusinessDay(d)) {
      count += 1;
      if (count === n) return d;
    }
  }
  return null;
}

function priorMonth(month) {
  return month === 1 ? 12 : month - 1;
}

function makeMacroEvent(date, time, category, impact, event) {
  return {
    date: formatDateString(date),
    day: WEEKDAY_NAMES[date.getDay()],
    time,
    category,
    impact,
    event,
  };
}

// =============================================================================
// Unified query
// =============================================================================

/**
 * Return all macro events whose date falls within [fromDate, toDate], inclusive,
 * sorted ascending by date.
 *
 * Pulls from all 7 hardcoded arrays plus all 5 computed helpers. Computed helpers
 * are called once per year the window touches (typically 1 year; year-spanning
 * windows touch 2). Hardcoded arrays are 2026-only — for year-spanning windows
 * that include 2027+, only computed helpers contribute to the non-2026 portion
 * until those hardcoded arrays exist.
 *
 * @param {{ fromDate: string, toDate: string }} args
 *   fromDate / toDate are YYYY-MM-DD; both inclusive.
 * @returns {Array<object>} MacroEvent[] sorted ascending by date.
 */
export function getMacroEventsInWindow({ fromDate, toDate }) {
  const years = yearsInWindow(fromDate, toDate);

  const computed = years.flatMap((year) => [
    ...getNFPDates(year),
    // JOLTS: DROPPED from the Tier-1 set (Econ Capture rulings §2, Jul 30
    // 2026) — absent from the EODHD /economic-events feed under EVERY name
    // across a full-month capture (jolts / job openings / labor turnover /
    // quits / hires all searched, 425 rows, 200 distinct types), so the
    // category could structurally never produce a recap: the silent-zero
    // pattern rebuilt inside its own fix. getJOLTSDates stays exported for
    // reference; do NOT re-add it here without feed evidence.
    ...getISMManufacturingDates(year),
    ...getISMServicesDates(year),
    ...getConsumerConfidenceDates(year),
    ...getJoblessClaimsDates(year),
  ]);

  const hardcoded = [
    ...FOMC_DECISIONS_2026,
    ...CPI_RELEASES_2026,
    ...PPI_RELEASES_2026,
    ...PCE_RELEASES_2026,
    ...RETAIL_SALES_RELEASES_2026,
    ...GDP_RELEASES_2026,
    ...PRODUCTIVITY_RELEASES_2026,
  ];

  return [...hardcoded, ...computed]
    .filter((e) => e.date >= fromDate && e.date <= toDate)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

function yearsInWindow(fromDate, toDate) {
  const fromYear = parseInt(fromDate.slice(0, 4), 10);
  const toYear = parseInt(toDate.slice(0, 4), 10);
  const years = [];
  for (let y = fromYear; y <= toYear; y += 1) years.push(y);
  return years;
}

// =============================================================================
// Wire value-lock (Econ Capture rulings §5.6 — the standing flag-3 ruling)
// =============================================================================

// The Tier-1 recap set IS this calendar (Recap Restoration R-A1), but the
// file stays OUTSIDE the Wire GENERATION_SURFACE path manifest because it
// also feeds the DRB (the rankingConfig precedent: file-level inclusion
// would reset gateEpoch on unrelated edits). This export closes the gap the
// build report flagged: its VALUE — every event over the maintained holiday
// horizon — is hashed into the generation baseline via
// GENERATION_VALUE_EXPORTS, so a content change to the Tier-1 set forces a
// WIRE_GENERATION_VERSION bump while non-value edits here touch nothing.
// Evaluated at module load, after every array/helper above is initialized.
export const TIER1_CALENDAR_VALUE_LOCK = getMacroEventsInWindow({
  fromDate: '2026-01-01',
  toDate: '2027-12-31',
});
