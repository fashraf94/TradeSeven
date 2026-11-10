// api/_utils/evidence/earnings.js
//
// Huddle S1, evidence layer (d) — the earnings calendar's rows, parsed from the keys
// the payload actually carries (Amendment C V1.2 §C11). The committed capture
// (api/_utils/__fixtures__/earningsCalendarCapture.js:1-16) shows nine keys:
//   actual, before_after_market, code, currency, date, difference, estimate, percent, report_date
// This module reads six of them and NO other name: never actual_eps, eps_estimate,
// actual_revenue, revenue_estimate, report_time or market_cap (three live readers ask
// for those and get null — reported in the build report, not fixed here).
//
//   report_date          the announcement date — the event's ET date, its event id and
//                        its place on the strip (C11), never `date`
//   date                 the fiscal period end — `period`
//   before_after_market  'BeforeMarket' → 'bmo', 'AfterMarket' → 'amc', anything else
//                        → null: untimed, not eligible for NO_ADDS_BEFORE (V1.1 §4.3)
//   currency, actual, estimate   carried as they come; a null estimate is "no
//                        estimate on file", never 0 and never a beat or a miss. S1
//                        computes no surprise (`difference` / `percent` are not read).
//
// The `earnings` group of symbolDayEvidence is RESERVED for Shared Research (C1): this
// parser feeds the Huddle's event strip and its NO_ADDS_BEFORE event ids only. Pure;
// ZERO imports.

const TIMING = Object.freeze({ BeforeMarket: 'bmo', AfterMarket: 'amc' });

const finiteOrNull = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const dateOrNull = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

/** 'AAPL.US' → 'AAPL'; 'BRK-B.US' → 'BRK.B' (the app's class-share form); a non-US code → null. */
export function usSymbolOfCode(code) {
  if (typeof code !== 'string') return null;
  const m = /^([A-Z]{1,5})(?:-([A-Z]))?\.US$/.exec(code.trim().toUpperCase());
  if (!m) return null;
  return m[2] ? `${m[1]}.${m[2]}` : m[1];
}

/**
 * One calendar row → the parsed earnings record, or null when the row has no US symbol
 * or no announcement date (an event without a date has no ET day and no id).
 *
 * @returns {null | { symbol, period, reportDate, timing: 'bmo'|'amc'|null, currency, epsActual, epsEstimate }}
 */
export function parseEarningsRow(row) {
  if (!row || typeof row !== 'object') return null;
  const symbol = usSymbolOfCode(row.code);
  const reportDate = dateOrNull(row.report_date);
  if (!symbol || !reportDate) return null;
  return {
    symbol,
    period: dateOrNull(row.date),
    reportDate,
    timing: Object.prototype.hasOwnProperty.call(TIMING, row.before_after_market) ? TIMING[row.before_after_market] : null,
    currency: typeof row.currency === 'string' && row.currency ? row.currency : null,
    epsActual: finiteOrNull(row.actual),
    epsEstimate: finiteOrNull(row.estimate),
  };
}

/** Every parseable row, in the payload's order. */
export function parseEarningsRows(rows) {
  return (Array.isArray(rows) ? rows : []).map(parseEarningsRow).filter(Boolean);
}
