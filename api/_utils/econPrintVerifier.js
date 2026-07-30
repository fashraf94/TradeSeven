// api/_utils/econPrintVerifier.js
// Recap Restoration mini-arc — the econ-print operand parse/verify path
// (spec V1.1 §5 R2) + the R-B1a plausibility gate.
//
// Before this module existed there was NO econ verifier anywhere: operands
// flowed raw-string end to end (discovery-lite Part A3 — three co-equal
// unverified sinks). This module is now the SINGLE parse authority for econ
// operands; the EODHD fetch returns raw values and everything downstream
// (prompt render, dataSnapshot, consensus append, plausibility gate) uses
// the parsed result.
//
// SCOPE BOUNDARY (R-B1a, verbatim class): everything here is a PUBLICATION
// gate upstream of the Wire — these are NOT adapter tolerances. F-M4's
// locked tolerances (PHASE2_CALIBRATION_ADDENDUM_V1_1 §6) are untouched and
// no `adapterVersion` interaction exists. The equivalence tolerance below
// REPRODUCES the addendum's print_vs_expected rule of record so the R2
// battery proves the same arithmetic the future adapter will apply; it does
// not implement that adapter.
//
// Verification vocabulary (R2):
//   VERIFIED                          — both operands parse; print verifiable
//   NOT_VERIFIABLE(missing_operand)   — estimate absent (consensus gap).
//                                       Degrade, never reject wholesale.
//   NOT_VERIFIABLE(unparseable_operand) — an operand is present but garbage.
//                                       Feeds the operand_implausible hold.

// ── Operand parse (strict; optional %, K/M/B/T suffix, comma strip) ──────

// Aggregator no-value markers are MISSING (degrade path), not garbage.
const MISSING_MARKERS = new Set(['', '-', '—', 'n/a', 'na', 'null', 'none', 'tbd']);

/**
 * Parse one econ operand.
 * @param {*} raw — number or string as the source sent it
 * @returns {{ ok: true, value: number }
 *         | { ok: false, reason: 'missing_operand' | 'unparseable_operand' }}
 */
export function parseEconOperand(raw) {
  if (raw === null || raw === undefined) return { ok: false, reason: 'missing_operand' };
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? { ok: true, value: raw } : { ok: false, reason: 'unparseable_operand' };
  }
  if (typeof raw !== 'string') return { ok: false, reason: 'unparseable_operand' };

  const trimmed = raw.trim();
  if (MISSING_MARKERS.has(trimmed.toLowerCase())) return { ok: false, reason: 'missing_operand' };

  // Strict shape: sign, digits (comma-grouped ok, at least one digit —
  // review finding H2: '[\d,]+' matched a bare ',' and fabricated a 0.0
  // print), optional decimal, optional ONE scale suffix, optional trailing
  // %. Scale suffix and % may not combine (review finding L3: '3.2K%' is
  // no known print format — reject rather than guess).
  const m = /^([+-]?)(\d[\d,]*(?:\.\d+)?)\s*([kKmMbBtT]?)\s*(%?)$/.exec(trimmed);
  if (!m) return { ok: false, reason: 'unparseable_operand' };
  if (m[3] && m[4]) return { ok: false, reason: 'unparseable_operand' };
  const digits = m[2].replace(/,/g, '');
  let value = Number(digits);
  if (!Number.isFinite(value)) return { ok: false, reason: 'unparseable_operand' };
  const scale = { k: 1e3, m: 1e6, b: 1e9, t: 1e12 }[m[3].toLowerCase()] || 1;
  value *= scale;
  if (m[1] === '-') value = -value;
  // '%' is a unit annotation, not a scale — '3.2%' parses to 3.2.
  return { ok: true, value };
}

/**
 * Are two representations the same print? Rendered-vs-stored equivalence
 * for the R2 scaled variant ('187K' vs 187000 → true). Tolerance reproduces
 * the addendum §6 print_vs_expected rule of record: ±0.05 when the
 * reference magnitude is <10, else ±0.5% relative. (Publication-side
 * reproduction — see the scope boundary in the header.)
 */
export function operandsEquivalent(a, b) {
  const pa = parseEconOperand(a);
  const pb = parseEconOperand(b);
  if (!pa.ok || !pb.ok) return false;
  const ref = Math.max(Math.abs(pa.value), Math.abs(pb.value));
  const tol = ref < 10 ? 0.05 : ref * 0.005;
  return Math.abs(pa.value - pb.value) <= tol;
}

/**
 * Verify one econ print's operands (R2's runtime status).
 * @param {{ actual: *, estimate: * }} operands — raw values
 * @returns {{ status: 'VERIFIED', actualValue: number, estimateValue: number, surprise: number }
 *         | { status: 'NOT_VERIFIABLE', reason: string, actualValue: number|null }}
 */
export function verifyEconPrint({ actual, estimate }) {
  const pa = parseEconOperand(actual);
  if (!pa.ok) {
    return { status: 'NOT_VERIFIABLE', reason: pa.reason, actualValue: null };
  }
  const pe = parseEconOperand(estimate);
  if (!pe.ok) {
    // Absent estimate = consensus gap → degrade (missing_operand), never
    // reject the event wholesale (R2). Garbage estimate = unparseable.
    return { status: 'NOT_VERIFIABLE', reason: pe.reason, actualValue: pa.value };
  }
  return {
    status: 'VERIFIED',
    actualValue: pa.value,
    estimateValue: pe.value,
    surprise: pa.value - pe.value,
  };
}

// ── R-B1a(i): per-category structural plausibility bands ─────────────────
//
// Deliberately LOOSE — they exist to catch series/unit mis-mapping (the
// classic aggregator failure: cents-for-dollars, a sibling series' value in
// the wrong row), not to adjudicate close calls. Two arms, either passes:
//   absolute:  |actual − estimate| ≤ band   (units = the category's
//              conventional print unit, listed per entry)
//   relative:  |actual − estimate| ≤ 50% of the larger magnitude
// The relative arm makes the gate unit-agnostic when BOTH operands share a
// surprising-but-consistent unit (NFP as raw jobs instead of thousands);
// the absolute arm catches the mismatch class where the two operands
// DISAGREE about units (100× spreads fail both arms). Band table proposed
// by CC in the build report per R-B1a; founder-adjustable constants.
// Count-denominated bands are expressed in RAW units because
// parseEconOperand normalizes 'K'/'M' suffixes to raw values (review
// finding M1: thousands-denominated bands were dead against normalized
// operands, so recession-class legitimate surprises — claims 510K vs 225K,
// NFP −300K vs +150K — were held by the relative arm alone). The founder
// capture run confirms EODHD's actual scale convention; these constants
// are founder-adjustable if the feed turns out suffix-free.
export const PLAUSIBILITY_BANDS = Object.freeze({
  'FOMC': 1.0,                 // percentage points (rate decision vs expected)
  'CPI': 2.0,                  // % MoM
  'PPI': 2.0,                  // % MoM
  'PCE': 2.0,                  // % MoM
  'Retail Sales': 5.0,         // % MoM
  'GDP': 5.0,                  // % annualized QoQ
  'Productivity': 8.0,         // % annualized QoQ
  'NFP': 500000,               // jobs (raw)
  'JOLTS': 4000000,            // openings (raw)
  'ISM Manufacturing': 25,     // index points
  'ISM Services': 25,          // index points
  'Consumer Confidence': 25,   // index points
  'Jobless Claims': 300000,    // claims (raw)
});

// Earnings surprise, same gate class (R-B1a: "same band applied to earnings
// surprise %"): absolute arm in EPS dollars, same 50% relative arm. 20 (not
// 5 — review finding M2): GAAP-actual-vs-operating-estimate names routinely
// land $5-15 off consensus (one-time gains, insurers), and holding the
// most newsworthy beat reproduces the silence this arc removes;
// cents-for-dollars mis-scaling (~100×) still fails both arms.
export const EPS_SURPRISE_BAND_ABS = 20;

/** The shared two-arm rule: implausible when BOTH arms are exceeded. */
export function isImplausibleDelta(actualValue, estimateValue, absBand) {
  const delta = Math.abs(actualValue - estimateValue);
  const relBound = 0.5 * Math.max(Math.abs(actualValue), Math.abs(estimateValue));
  return delta > Math.max(absBand || 0, relBound);
}

/**
 * R-B1a(i) gate for one econ event.
 * Rule: every PRESENT operand must parse; when both actual and estimate
 * parse, |actual − estimate| must pass the two-arm band. A missing estimate
 * passes the gate (it is R2's degrade path, not a hold).
 *
 * @returns {{ hold: false } | { hold: true, reason: string, detail: string }}
 */
export function assessEconPlausibility(category, operands) {
  const verdict = verifyEconPrint(operands);
  if (verdict.status === 'NOT_VERIFIABLE') {
    if (verdict.reason === 'unparseable_operand') {
      return {
        hold: true,
        reason: 'unparseable_operand',
        detail: `operand failed strict parse (actual=${JSON.stringify(operands.actual)} estimate=${JSON.stringify(operands.estimate)})`,
      };
    }
    // missing_operand: WHICH operand matters. A missing actual is not a
    // released print at all — hold defensively (the released filter should
    // have caught it). A missing estimate is R2's degrade path — no hold.
    if (verdict.actualValue === null) {
      return { hold: true, reason: 'missing_operand', detail: 'actual absent — not a released print' };
    }
    return { hold: false };
  }
  const band = PLAUSIBILITY_BANDS[category] ?? 0;
  if (isImplausibleDelta(verdict.actualValue, verdict.estimateValue, band)) {
    return {
      hold: true,
      reason: 'band_exceeded',
      detail:
        `|actual−estimate|=${Math.abs(verdict.actualValue - verdict.estimateValue)} exceeds ` +
        `max(band=${band}, 50% of larger operand) for category=${category}`,
    };
  }
  return { hold: false };
}

/**
 * Earnings-side gate (R-B1a): EPS actual vs estimate through the same
 * two-arm rule. No estimate → no hold (existing beat/miss logic governs).
 */
export function assessEpsPlausibility(epsActual, epsEstimate) {
  const pa = parseEconOperand(epsActual);
  if (!pa.ok) {
    return { hold: true, reason: pa.reason, detail: `actual_eps=${JSON.stringify(epsActual)}` };
  }
  const pe = parseEconOperand(epsEstimate);
  if (!pe.ok) return { hold: false };
  if (isImplausibleDelta(pa.value, pe.value, EPS_SURPRISE_BAND_ABS)) {
    return {
      hold: true,
      reason: 'band_exceeded',
      detail: `|epsActual−epsEstimate|=${Math.abs(pa.value - pe.value)} exceeds max(${EPS_SURPRISE_BAND_ABS}, 50% of larger operand)`,
    };
  }
  return { hold: false };
}
