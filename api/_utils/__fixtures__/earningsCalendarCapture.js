// api/_utils/__fixtures__/earningsCalendarCapture.js
// PROVENANCE: captured from EODHD /calendar/earnings via
// api/scripts/capture-earnings-calendar-eodhd.js (founder run, 2026-07-31).
// Full capture: 3531 rows, 802 ending in `.US`, exactly 2 in the tracked
// universe. Observed schema is 9 keys —
//   actual, before_after_market, code, currency, date, difference,
//   estimate, percent, report_date
// with NO `actual_eps`, NO `eps_estimate`, NO `name`. Field-population
// across the full capture: actual 462 non-null, estimate 2341, actual_eps 0,
// eps_estimate 0. This is the fixture source for the tracked-intersection A6.

// VERBATIM from the capture's "RAW TRACKED ROWS" block — the exact fields a
// tracked reporter carries (both AMC, both with a real `actual`).
export const CAPTURED_TRACKED_ROWS = [
  { code: 'AAPL.US', report_date: '2026-07-30', date: '2026-06-30', before_after_market: 'AfterMarket', currency: 'USD', actual: 1.57, estimate: 1.88, difference: -0.31, percent: -16.4894 },
  { code: 'AMZN.US', report_date: '2026-07-30', date: '2026-06-30', before_after_market: 'AfterMarket', currency: 'USD', actual: 1.68, estimate: 1.83, difference: -0.15, percent: -8.1967 },
];

// Representative NON-tracked rows to exercise the symbol filter. Codes are
// real strings observed in the capture's `sample codes` line; operand values
// are shape-fillers to the 9-key schema (the founder's paste did not include
// their numbers). Two kinds: a foreign-exchange listing (excluded by the
// `.US` strip leaving a non-universe code) and a non-tracked US listing
// (`.US` strips clean but the symbol is not in TICKERS).
export const NONTRACKED_SHAPE_FILLERS = [
  { code: 'SGE.F', report_date: '2026-07-30', date: '2026-06-30', before_after_market: 'AfterMarket', currency: 'EUR', actual: 0.42, estimate: 0.40, difference: 0.02, percent: 5.0 },
  { code: 'CAP.PA', report_date: '2026-07-30', date: '2026-06-30', before_after_market: 'BeforeMarket', currency: 'EUR', actual: 3.1, estimate: 3.0, difference: 0.1, percent: 3.3 },
  { code: 'CAPMF.US', report_date: '2026-07-30', date: '2026-06-30', before_after_market: 'AfterMarket', currency: 'USD', actual: 0.9, estimate: 0.85, difference: 0.05, percent: 5.9 },
];

// A tracked row that has NOT reported yet (actual null) — proves the data
// gate (released filter) holds it back without erroring. Shape-filler.
export const TRACKED_UNRELEASED_FILLER = {
  code: 'MSFT.US', report_date: '2026-07-31', date: '2026-06-30', before_after_market: 'AfterMarket', currency: 'USD', actual: null, estimate: 3.55, difference: null, percent: null,
};

// The window the founder captured (morning fire on 2026-07-31 recaps the
// prior ET session, Thu 2026-07-30, where AAPL and AMZN reported AMC).
export const CAPTURE_WINDOW = { from: '2026-07-30', to: '2026-07-31' };
