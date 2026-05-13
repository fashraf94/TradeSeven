// api/_utils/macroCalendar.js
//
// Deterministic source of truth for US macro economic event dates.
//
// PR 2 lands the architecture: empty hardcoded arrays, stubbed computed
// helpers, and a unified getMacroEventsInWindow query. Phase 2 of PR 2
// implements the computed helpers and populates FOMC. PR 3 populates the
// remaining hardcoded arrays from agency annual schedules and wires this
// module into the DRB cron (replacing fetchEconomicEvents.js).
//
// Category vocabulary uses specific release identifiers (FOMC / NFP / CPI / …),
// which differs from the Sonar fetcher's thematic vocabulary (manufacturing /
// employment / inflation / …). The DRB prompt renderer reads neither category
// field, so the divergence is internal to macroCalendar consumers — not a
// contract break.
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
//             | "ISM Services" | "Consumer Confidence",
//     impact:   "high" | "medium",
//     event:    string,
//   }

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

// TODO: populate from https://www.bls.gov/schedule/news_release/cpi.htm
export const CPI_RELEASES_2026 = [];

// TODO: populate from https://www.bls.gov/schedule/news_release/ppi.htm
export const PPI_RELEASES_2026 = [];

// TODO: populate from https://www.bea.gov/news/schedule (Personal Income & Outlays)
export const PCE_RELEASES_2026 = [];

// TODO: populate from https://www.census.gov/economic-indicators/calendar-listview.html (Advance Monthly Retail Trade)
export const RETAIL_SALES_RELEASES_2026 = [];

// TODO: populate from https://www.bea.gov/news/schedule (GDP — advance / second / third per quarter)
export const GDP_RELEASES_2026 = [];

// TODO: populate from https://www.bls.gov/schedule/news_release/prod2.htm (Productivity and Costs, quarterly)
export const PRODUCTIVITY_RELEASES_2026 = [];

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
    ...getJOLTSDates(year),
    ...getISMManufacturingDates(year),
    ...getISMServicesDates(year),
    ...getConsumerConfidenceDates(year),
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
