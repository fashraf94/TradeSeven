// api/_utils/mandateQuarterSummary.js
//
// Spec 1 — Mandate Substrate — quarterSummaries derivation (§2.2 / §5.3 / FR-2 /
// I4 / I10). Node-clean, PURE (no Firestore, no clock). The tenure record is
// DERIVED from the dailyRows the close pass wrote — never asserted from the
// live book doc at processing time. Row `quarterIndex` tags are the single
// source of truth for tenure membership (FR-2); the window and the boundary
// valuations both come from the tagged edge rows, so they are mutually
// consistent by construction, including under processing lag and catch-up.
//
// THE ONE DESIGN RULE (I4): if the rows and the book doc disagree, the rows win.
// Every number here traces to a tagged row. A catch-up quarter whose row range
// is empty is recorded `empty:true` (§5.3/F21) rather than fabricated.

import { buildQuarterSummary } from './mandateSchema.js';
import { computeLensMetrics, computeTotalReturnPct } from './mandateRiskMetrics.js';
import { roundUsd } from './mandateRounding.js';

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// I4 edge valuation: a missing/non-finite edge close is null (unknown), NEVER 0.
// Number(null) === 0 would fabricate a $0 opening/closing — the M2 lesson: an
// absent value is not a zero value. Only a genuinely finite number passes.
const edgeVal = (v) => (v == null ? null : (Number.isFinite(Number(v)) ? Number(v) : null));

/**
 * Derive the tenure summary for one quarterIndex from a set of dailyRows.
 *
 * @param {Array<object>} rows  dailyRows (any order; the tenure's rows may be a
 *                              subset — filtered here by `quarterIndex`).
 * @param {object} opts
 * @param {number}  opts.quarterIndex     the tenure to summarize (FR-2 tag)
 * @param {string} [opts.archetype]       archetype as served
 * @param {string} [opts.vintageRef]      the vintage the book pinned for the tenure
 * @param {boolean}[opts.voided=false]    FR-3: an escape-voided quarter → scoring:false
 * @param {*}      [opts.quarterStartAt]  optional logical-boundary override; default = first tagged row's date
 * @param {*}      [opts.quarterEndAt]    optional logical-boundary override; default = last tagged row's date
 * @returns {object} a buildQuarterSummary-shaped record
 */
export function deriveQuarterSummary(rows, {
  quarterIndex, archetype = null, vintageRef = null, voided = false,
  quarterStartAt = null, quarterEndAt = null,
} = {}) {
  const scoring = !voided; // FR-3: the void flag (not emptiness) is what excludes a quarter from scoring
  const tagged = (rows || [])
    .filter((r) => r && r.quarterIndex === quarterIndex)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  // §5.3 / F21 — an empty row range is recorded, never fabricated.
  if (tagged.length === 0) {
    return buildQuarterSummary({
      quarterIndex, archetype, vintageRef, scoring, empty: true,
      quarterStartAt: quarterStartAt ?? null,
      quarterEndAt: quarterEndAt ?? null,
      regimeMix: {}, agencyStateMix: {}, frictionTotalUsd: 0, dividendIncomeTotalUsd: 0,
    });
  }

  const first = tagged[0];
  const last = tagged[tagged.length - 1];

  // I4 — opening/closing are the authoritative closes of the tagged edge rows.
  const openingValue = edgeVal(first.totalValue);
  const closingValue = edgeVal(last.totalValue);

  // Tenure return + risk metrics over the tagged rows themselves (a single lens).
  // computeLensMetrics carries the §4.2 warmup nulls and the I6/I11 degraded-row
  // discipline (partial / carry-over / multi-session rows excluded from variance,
  // still counted in drawdown; degradedMarks flags the block honestly).
  const riskMetrics = computeLensMetrics(tagged);
  const tenureReturn = computeTotalReturnPct(tagged); // percent, first→last totalValue; null below 2 rows

  // Regime mix (I7/§6.1) — 'unknown' counted honestly, never dropped.
  const regimeMix = {};
  for (const r of tagged) {
    const key = r.regime || 'unknown';
    regimeMix[key] = (regimeMix[key] || 0) + 1;
  }

  // Agency-state mix (I10) — sessions by state, so a drawdown-charged tenure
  // distinguishes judgment from an administrative freeze.
  const agencyStateMix = {};
  for (const r of tagged) {
    const key = r.agencyState || 'unknown';
    agencyStateMix[key] = (agencyStateMix[key] || 0) + 1;
  }

  // §4.3 term totals from the rows. dayFrictionPaid is null on the first row
  // ever (no window) → coalesced to 0; income is recorded separately from
  // trading P&L on each row.
  let frictionTotalUsd = 0;
  let dividendIncomeTotalUsd = 0;
  for (const r of tagged) {
    frictionTotalUsd += num(r.dayFrictionPaid);
    dividendIncomeTotalUsd += num(r.dividendIncomeUsd);
  }
  frictionTotalUsd = roundUsd(frictionTotalUsd);
  dividendIncomeTotalUsd = roundUsd(dividendIncomeTotalUsd);

  return buildQuarterSummary({
    quarterIndex, archetype, vintageRef, scoring, empty: false,
    quarterStartAt: quarterStartAt ?? first.date,
    quarterEndAt: quarterEndAt ?? last.date,
    openingValue, closingValue, tenureReturn,
    riskMetrics, regimeMix, agencyStateMix,
    frictionTotalUsd, dividendIncomeTotalUsd,
  });
}
