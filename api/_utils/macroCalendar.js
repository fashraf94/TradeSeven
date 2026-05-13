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

// =============================================================================
// Hardcoded event lists — populated from agency-published annual schedules
// =============================================================================

// TODO: populate from https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm
// (Phase 2 of this PR populates the 5 remaining 2026 decisions.)
export const FOMC_DECISIONS_2026 = [];

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
// Computed schedule helpers — Phase 2 of this PR implements
// =============================================================================

// First Friday of each month, 8:30 AM ET, impact=high.
// Will skip NYSE holidays — uses next business day if the first Friday is closed.
// eslint-disable-next-line no-unused-vars
export function getNFPDates(year) {
  return [];
}

// First Tuesday of release month, data is for two months prior (BLS publishes ~5 weeks
// after the reference month). 10:00 AM ET, impact=medium.
// eslint-disable-next-line no-unused-vars
export function getJOLTSDates(year) {
  return [];
}

// First business day of month (skipping weekends and NYSE holidays). 10:00 AM ET, impact=medium.
// eslint-disable-next-line no-unused-vars
export function getISMManufacturingDates(year) {
  return [];
}

// Third business day of month. 10:00 AM ET, impact=medium.
// eslint-disable-next-line no-unused-vars
export function getISMServicesDates(year) {
  return [];
}

// Last Tuesday of month. 10:00 AM ET, impact=medium.
// eslint-disable-next-line no-unused-vars
export function getConsumerConfidenceDates(year) {
  return [];
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
