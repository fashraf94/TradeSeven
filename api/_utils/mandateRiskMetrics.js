// api/_utils/mandateRiskMetrics.js
//
// Spec 1 — Mandate Substrate — RISK METRICS, BOTH LENSES (§4.2, F15/F18, P3).
// FORKED from the season math per the §8 fork ledger (seasonLeaderboard.js —
// NOT on the §1 fence; fork is not circumvention). Q4 contracts verified and
// PRESERVED: null-on-degenerate (Sharpe null below 2 samples / zero stddev —
// seasonLeaderboard.computeSharpe), recovery factor null on no-losing-period.
// Q4 hazards EXCLUDED: season computeTradeStats (proceeds-based "dollar P&L")
// is NOT ported — the mandate's realized P&L is basis-correct at the execution
// boundary and no trade-stat metric is derived here.
//
// LENS SEPARATION (FR-2): `scoring.quarter` computes from rows tagged with the
// CURRENT quarterIndex ONLY — row tags are the single source of truth for
// tenure membership (I4); `scoring.lifetime` computes from all rows. The two
// lenses never blend.
//
// WARMUP (§4.2): dispersion metrics return NULL (never NaN, never 0) below
// MANDATE_METRIC_MIN_ROWS (20 Sharpe/consistency, 5 drawdown). Nulls are stored
// as nulls and rendered as "insufficient history".
//
// PARTIAL-ROW DISCIPLINE (I6): rows flagged partial:true or carrying carry-over
// marks are EXCLUDED from variance-based metrics (Sharpe, consistency) and
// counted in drawdown only, with degradedMarks:true on the scoring block — a
// book carrying a frozen position reports honestly-labeled metrics, never
// variance-suppressed numbers presented as full-quality.
//
// Pure (no Firestore, no fetch). Rows arrive already date-sorted ascending
// (the close pass reads them ordered); a defensive sort keeps the math correct
// if a caller forgets.

import { MANDATE_METRIC_MIN_ROWS, MANDATE_COMPOSITE_WEIGHTS } from './mandateConfig.js';

// ── Small stats helpers (forked shape of seasonLeaderboard's) ────────────────

function mean(nums) {
  let s = 0;
  for (const n of nums) s += n;
  return s / nums.length;
}

/** Sample stddev (n−1), the season convention. */
function stddev(nums) {
  if (nums.length < 2) return 0;
  const m = mean(nums);
  let variance = 0;
  for (const n of nums) variance += (n - m) ** 2;
  variance /= (nums.length - 1);
  return Math.sqrt(variance);
}

// ── Row classification (I6) ──────────────────────────────────────────────────

/** A row is DEGRADED for variance purposes if flagged partial or marked from carry-over. */
export function isDegradedRow(row) {
  return !!(row?.partial || row?.markSource === 'carry_over' || row?.degradedMarks);
}

/** Finite dayReturnPct from a non-degraded row → usable for variance metrics. */
function usableReturns(rows) {
  const out = [];
  for (const r of rows) {
    if (isDegradedRow(r)) continue;
    // NOT single-session returns (P3 review INV-2/MONEY-8): a row spanning a
    // missed session, or baselined on a degraded (carry-over) prior value,
    // carries a factual-but-not-daily number — labeled on the row, excluded
    // from variance here, still counted in drawdown (values are real).
    if ((r?.sessionsSpanned ?? 1) > 1) continue;
    if (r?.returnBaseDegraded) continue;
    // A null return (first-ever close: "cannot compute") is EXCLUDED, never
    // coerced — Number(null) is 0, which would silently record a flat day.
    const raw = r?.dayReturnPct;
    if (raw == null) continue;
    const v = Number(raw);
    if (Number.isFinite(v)) out.push(v);
  }
  return out;
}

// ── Individual metrics (§4.2) ────────────────────────────────────────────────

/**
 * Unannualized Sharpe over daily net returns: mean/stddev. NULL below the
 * warmup minimum, on zero variance, or on a non-finite stddev — never NaN,
 * never 0-as-placeholder (the Q4-verified season contract, preserved).
 *
 * Degeneracy is tested with a RELATIVE epsilon, not exact `sd === 0`: a series
 * of identical returns accumulates ~1e-18 float noise in the mean, and an
 * exact-zero check would report an astronomically large Sharpe for a series
 * with no real dispersion — the precise flavor of flattering number §4.2's
 * null-on-degenerate rule exists to forbid.
 */
export function computeSharpe(returns, minRows = MANDATE_METRIC_MIN_ROWS.sharpe) {
  if (!returns || returns.length < Math.max(2, minRows)) return null;
  const m = mean(returns);
  const sd = stddev(returns);
  if (!Number.isFinite(sd) || sd <= 1e-12 * Math.max(1, Math.abs(m))) return null;
  return m / sd;
}

/** Percent of usable days with a positive net return. NULL below warmup (never 0-as-placeholder). */
export function computeConsistency(returns, minRows = MANDATE_METRIC_MIN_ROWS.consistency) {
  if (!returns || returns.length < minRows) return null;
  let positive = 0;
  for (const v of returns) if (v > 0) positive++;
  return (positive / returns.length) * 100;
}

/**
 * Running max drawdown over row totalValue, as a NEGATIVE percentage (season
 * convention: 0 = no drawdown yet). Includes degraded rows (I6: they count in
 * drawdown — a real value trough is a real trough even on a carry-over mark).
 * NULL below the warmup minimum.
 */
export function computeMaxDrawdown(rows, minRows = MANDATE_METRIC_MIN_ROWS.drawdown) {
  const values = [];
  for (const r of rows || []) {
    const v = Number(r?.totalValue);
    if (Number.isFinite(v)) values.push(v);
  }
  if (values.length < minRows) return null;
  let peak = -Infinity;
  let worst = 0;
  for (const v of values) {
    if (v > peak) peak = v;
    if (peak > 0) {
      const dd = ((v - peak) / peak) * 100;
      if (dd < worst) worst = dd;
    }
  }
  return worst;
}

/**
 * Recovery factor: total period return ÷ |max drawdown|. NULL when drawdown is
 * null or ZERO (§4.2: zero drawdown → null, NOT Infinity) or the period return
 * is unavailable.
 */
export function computeRecoveryFactor(totalReturnPct, maxDrawdownPct) {
  if (totalReturnPct == null || maxDrawdownPct == null) return null;
  if (maxDrawdownPct === 0) return null; // never Infinity (§4.2)
  return totalReturnPct / Math.abs(maxDrawdownPct);
}

/** Period total return % from first→last row totalValue. NULL below 2 rows or on a non-positive base. */
export function computeTotalReturnPct(rows) {
  const values = [];
  for (const r of rows || []) {
    const v = Number(r?.totalValue);
    if (Number.isFinite(v)) values.push(v);
  }
  if (values.length < 2) return null;
  const first = values[0];
  const last = values[values.length - 1];
  if (!(first > 0)) return null;
  return ((last - first) / first) * 100;
}

// ── Composite (§4.2) ─────────────────────────────────────────────────────────

/** Clamp-normalize a metric onto [0,100] over [lo,hi] (the season normalizeMetric shape). */
function normalizeMetric(value, lo, hi) {
  if (value == null || !Number.isFinite(value)) return null;
  const clamped = Math.min(Math.max(value, Math.min(lo, hi)), Math.max(lo, hi));
  return ((clamped - lo) / (hi - lo)) * 100;
}

/**
 * Composite from the NON-NULL components only, weights renormalized over the
 * contributing subset, and the block RECORDS which contributed (§4.2). All
 * components null → composite null.
 *
 * Normalization ranges (season shape): sharpe [-2,2] → [0,100];
 * drawdown [-50,0] → [0,100] (0% dd = 100); consistency [0,100] as-is.
 */
export function computeComposite({ sharpe, maxDrawdownPct, consistencyPct }, weights = MANDATE_COMPOSITE_WEIGHTS) {
  const normalized = {
    sharpe: normalizeMetric(sharpe, -2, 2),
    drawdown: normalizeMetric(maxDrawdownPct, -50, 0),
    consistency: normalizeMetric(consistencyPct, 0, 100),
  };
  const contributed = Object.keys(normalized).filter((k) => normalized[k] != null);
  if (contributed.length === 0) return { score: null, contributed: [], weightsUsed: null };

  let weightSum = 0;
  for (const k of contributed) weightSum += weights[k] ?? 0;
  if (weightSum <= 0) return { score: null, contributed: [], weightsUsed: null };

  let score = 0;
  const weightsUsed = {};
  for (const k of contributed) {
    const w = (weights[k] ?? 0) / weightSum;
    weightsUsed[k] = w;
    score += normalized[k] * w;
  }
  return { score, contributed, weightsUsed };
}

// ── Lens computation ─────────────────────────────────────────────────────────

/**
 * Compute one lens's §4.2 metric block from its rows.
 *
 * @param {Array<object>} rows  dailyRows for the lens window (date ascending)
 * @returns {{ sharpe, maxDrawdownPct, consistencyPct, recoveryFactor,
 *             totalReturnPct, composite, rowsTotal, rowsUsable, degradedMarks }}
 */
export function computeLensMetrics(rows) {
  const sorted = [...(rows || [])].sort((a, b) => String(a?.date).localeCompare(String(b?.date)));
  const returns = usableReturns(sorted);
  const degradedMarks = sorted.some((r) => isDegradedRow(r)); // I6 flag on the scoring block

  const sharpe = computeSharpe(returns);
  const consistencyPct = computeConsistency(returns);
  const maxDrawdownPct = computeMaxDrawdown(sorted);
  const totalReturnPct = computeTotalReturnPct(sorted);
  const recoveryFactor = computeRecoveryFactor(totalReturnPct, maxDrawdownPct);
  const composite = computeComposite({ sharpe, maxDrawdownPct, consistencyPct });

  return {
    sharpe,
    maxDrawdownPct,
    consistencyPct,
    recoveryFactor,
    totalReturnPct,
    composite,
    rowsTotal: sorted.length,
    rowsUsable: returns.length,
    degradedMarks,
  };
}

/**
 * The full scoring block (§2.1): tenure lens from rows tagged with the CURRENT
 * quarterIndex (FR-2 — the tags are the source of truth, I4), lifetime lens
 * from all rows.
 *
 * @param {Array<object>} rows          ALL dailyRows for the book (any order)
 * @param {number} currentQuarterIndex  book.quarterIndex
 * @param {Date} [now]
 * @returns {{ quarter: object, lifetime: object, asOf: string }}
 */
export function computeMandateScoring(rows, currentQuarterIndex, now = new Date()) {
  const all = rows || [];
  const quarterRows = all.filter((r) => r?.quarterIndex === currentQuarterIndex);
  return {
    quarter: computeLensMetrics(quarterRows),
    lifetime: computeLensMetrics(all),
    asOf: now.toISOString(),
  };
}
