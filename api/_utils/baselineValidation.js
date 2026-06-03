// api/_utils/baselineValidation.js
//
// Shared baseline-INPUT validation for agent battle scoring.
//
// The badge math in api/_utils/agentScoring.js is correct as-is — it faithfully
// scores whatever baseline it is handed. The bug it cannot defend against is a
// WRONG-BUT-POSITIVE baseline: a glitched feed read only ~4-5% off, divided by a
// small ATR, fabricates Bust + Crash + Meltdown on a near-flat ticker. This
// helper validates the baseline price BEFORE it reaches the scorer; it never
// clamps or alters the scorer's OUTPUT, and it never touches agentScoring.js.
//
// Design north star:
//  - Validate the baseline against an INDEPENDENT market reference.
//  - Reason in ATR units, not naive percentage bands — the documented misfire
//    came from a baseline only ~4-5% off that read as <= -2.0 ATR because ATR is
//    small relative to the error. A fixed "% off" band would sail right past it.
//  - Never suppress a legitimate move. Err toward not intervening; log every
//    intervention so we can confirm guards fire only on genuine glitches.
//
// Single source of truth: decide.js, both scoring crons, and the swap path all
// import the rule from here. Guard 1 lives here now; Guards 2/3 are added in
// their own phases.

// ---------- Tolerance constants (ATR units) ----------
// STARTING values, tunable later from the guard logs. Both sit below the
// smallest negative badge (Bust = 1.0 ATR) so the guards only reject baselines
// large enough to fabricate a badge.
export const T1_ACTIVATION_ATR = 1.0;  // Guard 1 — activation (entry) price
export const T2_PREVCLOSE_ATR = 0.5;   // Guard 2/3 — prior-session close (same-quantity check)

/**
 * Baseline disagreement from an independent reference, expressed in ATR units.
 *
 * @param {number} candidate    - the baseline price under test
 * @param {number} reference    - an independent measurement of the same quantity
 * @param {number} baseATRpct   - asset ATR as a percent of price (the scorer's denominator)
 * @returns {number} |candidate - reference| as a multiple of ATR, or Infinity when
 *                   any input is unusable (so an unusable reference can't silently pass).
 */
export function errorATR(candidate, reference, baseATRpct) {
  if (
    !Number.isFinite(candidate) ||
    !Number.isFinite(reference) || reference <= 0 ||
    !Number.isFinite(baseATRpct) || baseATRpct <= 0
  ) {
    return Infinity;
  }
  return (Math.abs(candidate - reference) / reference * 100) / baseATRpct;
}

/**
 * Guard 1 — validate an activation (entry) price before it is frozen into
 * portfolio.startingPrices.
 *
 * The activation price legitimately differs from the prior close on real gap
 * days, so a corrupt read is rejected only on a TWO-condition signal: the price
 * is outside its own snapshot's [low, high] range AND it disagrees with the most
 * recent daily close by more than T1 ATR. A real gapper stays inside today's
 * [low, high] (last trade is within the day's range), so it never trips the
 * range condition — legitimate moves are preserved.
 *
 * When the snapshot is itself suspect (real-time fetch fell back to a daily
 * close, or intraday high/low are absent) there is no range to bracket the
 * quote, so the range condition is dropped and the ATR check stands alone (R1).
 *
 * Substitute-first, skip-as-last-resort (D3) — never invent a value.
 *
 * @param {Object}  args
 * @param {number}  args.current        - the activation price under test (data.price.current)
 * @param {number} [args.high]          - today's intraday high (data.price.high)
 * @param {number} [args.low]           - today's intraday low (data.price.low)
 * @param {boolean} args.fallback       - true when real-time failed and current is a daily close
 * @param {number} [args.recentClose]   - most recent daily close (data.daily[0].close)
 * @param {number} [args.previousClose] - prior session close from the real-time snapshot
 * @param {number}  args.baseATR        - asset ATR as a percent of price
 * @returns {{ value: number|null, fired: boolean, reason: string|null }}
 *   value:  price to record — the validated current, a substituted sane close,
 *           or null meaning "omit this symbol from startingPrices".
 *   fired:  whether the guard intervened (drives the caller's log line).
 *   reason: human-readable trigger description, or null when not fired.
 */
export function validateActivationPrice({ current, high, low, fallback, recentClose, previousClose, baseATR }) {
  // Most recent SANE close for substitution (D3): previousClose first, else recentClose.
  const saneClose =
    (Number.isFinite(previousClose) && previousClose > 0) ? previousClose :
    (Number.isFinite(recentClose) && recentClose > 0) ? recentClose :
    null;

  const errToClose = errorATR(current, recentClose, baseATR);

  // Snapshot suspect (R1): real-time fell back to a daily close, or there is no
  // intraday range to bracket the quote. Drop the range condition.
  const snapshotSuspect =
    fallback === true ||
    !Number.isFinite(high) || high <= 0 ||
    !Number.isFinite(low) || low <= 0;

  let reject;
  let reason;
  if (snapshotSuspect) {
    reject = errToClose > T1_ACTIVATION_ATR;
    reason = reject
      ? `suspect snapshot (fallback/no range), ${errToClose.toFixed(2)}xATR vs close ${recentClose}`
      : null;
  } else {
    const outOfRange = current < low || current > high;
    reject = outOfRange && errToClose > T1_ACTIVATION_ATR;
    reason = reject
      ? `outside [${low}, ${high}] and ${errToClose.toFixed(2)}xATR vs close ${recentClose}`
      : null;
  }

  if (!reject) {
    return { value: current, fired: false, reason: null };
  }

  // Reject → substitute the most recent sane close; if none exists, omit (value null).
  return { value: saneClose, fired: true, reason };
}
