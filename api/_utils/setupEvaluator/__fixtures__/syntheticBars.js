// api/_utils/setupEvaluator/__fixtures__/syntheticBars.js
//
// Deterministic synthetic daily bars for the Trend Follower evaluator tests
// and the golden-verdict fixture. Every scenario is built from arithmetic the
// reader can check by hand (closes on a fixed slope, a fixed half-range, one
// volume), then patched at named bars. Nothing random, nothing from a clock.
//
// Dates walk the calendar of record (src/utils/marketCalendar.js, zero imports)
// backwards from ANCHOR_DATE, so every bar is a real session date.
//
// The base series (`uptrend`): closes 100 − 0.25·i (i = 0 newest), high/low
// = close ± 1.5, volume 1,000,000, 60 bars. By hand:
//   SMA_fast      = 100 − 0.25·9.5  = 97.625
//   SMA_slow      = 100 − 0.25·24.5 = 93.875
//   SMA_slow_5ago = 93.875 − 1.25   = 92.625   (rising)
//   swingHigh     = high of bar 1   = 99.75 + 1.5 = 101.25 (> C, no breakout)
//   swingLow      = low of bar 20   = 95 − 1.5 = 93.5
//   ATR           = 3 (every true range is high − low = 3)
//   min low[0..2] = low of bar 2    = 98 (> SMA_fast, no touch)
//   guard         = 97.625 + 6 = 103.625 (not extended)
//   V = V_avg     = 1,000,000
// so the base is uptrend / invalid(no_setup).
//
// The `tight` series halves nothing but the range: high/low = close ± 0.5, so
// ATR = 1 and the extension guard (97.625 + 2 = 99.625) sits BELOW C = 100:
// a satisfied pattern there is invalid(extended). Adding 1.25 to bar 13's
// high (inside the ATR window, outside bars 0..2) with the bar-2 touch makes
// ATR exactly 1.1875 and the guard exactly 100 = C: the "at the guard" case,
// with every number dyadic so the equality is exact in floating point.

import { getPreviousSessionDate } from '../../../../src/utils/marketCalendar.js';

/** Bar 0's date for every synthetic series: a Friday session. */
export const ANCHOR_DATE = '2026-10-09';
export const BASE_CLOSE = 100;
export const BASE_SLOPE = 0.25;
export const BASE_RANGE = 1.5;
export const TIGHT_RANGE = 0.5;
export const BASE_VOLUME = 1_000_000;
export const DEFAULT_BARS = 60;

/** n session dates, newest first, from `newest` backwards through the calendar. */
export function tradingDates(n, newest = ANCHOR_DATE) {
  const out = [newest];
  while (out.length < n) {
    const prev = getPreviousSessionDate(out[out.length - 1]);
    if (!prev) throw new Error(`syntheticBars: the calendar ran out before ${n} sessions`);
    out.push(prev);
  }
  return out;
}

/**
 * Bars newest first. `closeAt(i)` gives bar i's close; high/low = close ± range;
 * open = close. `patch(bars)` edits bars in place before the series is frozen.
 */
export function buildBars({ n = DEFAULT_BARS, closeAt = (i) => BASE_CLOSE - BASE_SLOPE * i, range = BASE_RANGE, volume = BASE_VOLUME, patch = null } = {}) {
  const dates = tradingDates(n);
  const bars = dates.map((date, i) => {
    const close = closeAt(i);
    return { date, open: close, high: close + range, low: close - range, close, volume };
  });
  if (patch) patch(bars);
  return bars;
}

/** The adapter-shaped evidence object the evaluator consumes, over `bars`. */
export function evidenceOf(bars, { symbol = 'SYN', adjustment = { metadata: 'absent', missingDates: [] } } = {}) {
  const frozen = deepFreeze(bars.map((b) => ({ ...b })));
  return deepFreeze({
    ok: true,
    symbol,
    asOf: frozen[0].date,
    requestedAsOf: frozen[0].date,
    basis: 'raw',
    source: 'synthetic',
    sourceMeta: { fetchedAt: '2026-10-28T00:00:00.000Z', from: frozen[frozen.length - 1].date, to: frozen[0].date },
    // Synthetic test evidence carries its own bars class (founder ruling Q-TE-4, 28 Oct 2026, the closeout);
    // provider bars are never labelled so: the adapter's default stays 'later_reconstruction'.
    evidenceClass: { bars: 'synthetic' },
    checks: { completedSession: 'complete', adjacency: 'ok', splitCheck: 'not_available', splitCheckReason: 'adjustment_metadata_absent' },
    adjustment,
    dropped: 0,
    bars: frozen,
  });
}

export function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const k of Object.keys(value)) deepFreeze(value[k]);
  }
  return value;
}

// ---------------------------------------------------------------- hand-computed facts of the base series

/** SMA of the first `n` closes, rounded as calculateSMA rounds (4 dp). */
export function smaOf(bars, n, offset = 0) {
  let sum = 0;
  for (let i = offset; i < offset + n; i++) sum += bars[i].close;
  return Number((sum / n).toFixed(4));
}
export const BASE_SMA_FAST = 97.625;
export const BASE_SWING_HIGH = 101.25;

// ---------------------------------------------------------------- scenario helpers

const setClose = (bars, i, close, range = BASE_RANGE) => { bars[i].open = close; bars[i].close = close; bars[i].high = close + range; bars[i].low = close - range; };

const tight = (patch = null) => buildBars({ range: TIGHT_RANGE, patch });
const base = (patch = null) => buildBars({ patch });

/**
 * The scenario catalogue. `kind` is 'entry' or 'holding'; `options` are the
 * holding call's second argument. `expect` is a note for the reader; the
 * tests assert the real records and the golden pins them whole.
 */
export const SCENARIOS = Object.freeze({
  // ---- regime and patterns
  uptrend_no_setup: { kind: 'entry', expect: 'invalid(no_setup), uptrend', build: () => evidenceOf(base()) },
  breakout_at_swing_high: { kind: 'entry', expect: 'valid/breakout: C equals swingHigh, V = 2x', build: () => evidenceOf(base((b) => { setClose(b, 0, BASE_SWING_HIGH); b[0].volume = 2_000_000; })) },
  breakout_volume_exact_1_5x: { kind: 'entry', expect: 'valid/breakout: V exactly 1.5x V_avg', build: () => evidenceOf(base((b) => { setClose(b, 0, BASE_SWING_HIGH + 0.25); b[0].volume = 1_500_000; })) },
  breakout_one_tick_below: { kind: 'entry', expect: 'invalid(no_setup): C one cent below swingHigh', build: () => evidenceOf(base((b) => { setClose(b, 0, BASE_SWING_HIGH - 0.01); b[0].volume = 2_000_000; })) },
  breakout_volume_1_49x: { kind: 'entry', expect: 'invalid(no_setup): V = 1.49x, no pullback', build: () => evidenceOf(base((b) => { setClose(b, 0, BASE_SWING_HIGH); b[0].volume = 1_490_000; })) },
  pullback_touch_bar2_exact: { kind: 'entry', expect: 'valid/pullback_resume: low of bar 2 equals SMA_fast', build: () => evidenceOf(base((b) => { b[2].low = BASE_SMA_FAST; })) },
  pullback_touch_bar3_only: { kind: 'entry', expect: 'invalid(no_setup): the touch is on bar 3, outside the window', build: () => evidenceOf(base((b) => { b[3].low = BASE_SMA_FAST; })) },
  close_at_sma_fast: { kind: 'entry', expect: 'invalid(regime)/no_trend: C equals SMA_fast (97.5), pullback_close false', build: () => evidenceOf(base((b) => { setClose(b, 0, 97.5); })) },
  close_below_sma_fast: { kind: 'entry', expect: 'invalid(regime)/no_trend: C below SMA_fast, pullback_close false', build: () => evidenceOf(base((b) => { setClose(b, 0, 97); })) },
  both_patterns: { kind: 'entry', expect: 'valid/breakout with both patterns listed', build: () => evidenceOf(base((b) => { setClose(b, 0, BASE_SWING_HIGH); b[0].volume = 1_500_000; b[2].low = 97.6875; })) },
  extended_pullback: { kind: 'entry', expect: 'invalid(extended): tight range, pullback satisfied, guard 99.8214 < 100', build: () => evidenceOf(tight((b) => { b[2].low = BASE_SMA_FAST; })) },
  extended_breakout: { kind: 'entry', expect: 'invalid(extended): tight range, breakout satisfied', build: () => evidenceOf(tight((b) => { setClose(b, 0, 100.25, TIGHT_RANGE); b[0].volume = 2_000_000; })) },
  at_extension_guard: { kind: 'entry', expect: 'valid/pullback_resume with C exactly at SMA_fast + 2 ATR (ATR 1.1875)', build: () => evidenceOf(tight((b) => { b[2].low = BASE_SMA_FAST; b[13].high += 1.25; })) },
  flat_slow_sma: { kind: 'entry', expect: 'invalid(regime)/no_trend: stack true, SMA_slow equals SMA_slow_5ago', build: () => evidenceOf(buildBars({ closeAt: (i) => (i <= 4 || (i >= 50 && i <= 54) ? 101 : 100) })) },
  downtrend_mirror: { kind: 'entry', expect: 'invalid(regime)/downtrend', build: () => evidenceOf(buildBars({ closeAt: (i) => BASE_CLOSE + BASE_SLOPE * i })) },
  bounce_fast_below_slow: { kind: 'entry', expect: 'invalid(regime)/no_trend: C > SMA_fast but SMA_fast < SMA_slow (SMA_slow not rising)', build: () => evidenceOf(buildBars({ closeAt: (i) => (i <= 19 ? BASE_CLOSE - BASE_SLOPE * i : 105) })) },
  stack_fast_below_slow_rising: { kind: 'entry', expect: 'invalid(regime)/no_trend: C 100 > SMA_fast 97.625 but SMA_fast < SMA_slow 102.05 while SMA_slow IS rising (102.05 > 100.1) — the stack\'s middle inequality alone decides (review TE3-1)', build: () => evidenceOf(buildBars({ closeAt: (i) => (i >= 50 ? 80 : i >= 20 ? 105 : BASE_CLOSE - BASE_SLOPE * i) })) },
  stack_middle_inequality_only: { kind: 'entry', expect: 'invalid(regime)/no_trend: C 110 is above BOTH averages (SMA_fast 95.75, SMA_slow 101.3) and SMA_slow is rising (101.3 > 99.5), so only the middle inequality SMA_fast > SMA_slow fails — a stack that read C > SMA_fast && C > SMA_slow would call this an uptrend (review TE3-1, mutant M50)', build: () => evidenceOf(buildBars({ closeAt: (i) => (i === 0 ? 110 : i <= 19 ? 95 : i <= 49 ? 105 : 80) })) },
  stack_down_slow_not_falling: { kind: 'entry', expect: 'invalid(regime)/no_trend: C 90.25 < SMA_fast 92.625 < SMA_slow 97.05 but SMA_slow is NOT falling (97.05 > 92.975) — the downtrend needs both conditions (review TE3-7)', build: () => evidenceOf(buildBars({ closeAt: (i) => (i >= 50 ? 50 : i >= 20 ? 100 : 95 - BASE_SLOPE * (19 - i)) })) },
  bars_54: { kind: 'entry', expect: 'unknown(insufficient_history)', build: () => evidenceOf(buildBars({ n: 54 })) },
  bars_55: { kind: 'entry', expect: 'evaluable at exactly 55 bars: invalid(no_setup)', build: () => evidenceOf(buildBars({ n: 55 })) },
  // ---- C1, the volume policy
  c1_pullback_null_bar0_volume: { kind: 'entry', expect: 'valid/pullback_resume, missing [V], breakout untestable', build: () => evidenceOf(base((b) => { b[2].low = BASE_SMA_FAST; b[0].volume = null; })) },
  c1_breakout_price_unusable_volume: { kind: 'entry', expect: 'unknown(missing_fact), not no_setup: breakout price with a null volume and no pullback', build: () => evidenceOf(base((b) => { setClose(b, 0, BASE_SWING_HIGH); b[0].volume = null; })) },
  c1_zero_volume_in_window: { kind: 'entry', expect: 'valid/pullback_resume, missing [V_avg]: one zero volume inside bars 1..20', build: () => evidenceOf(base((b) => { b[2].low = BASE_SMA_FAST; b[7].volume = 0; })) },
  c1_pullback_null_atr: { kind: 'entry', expect: 'unknown(missing_fact): the pullback is satisfied but a null low at bar 10 leaves ATR (and swingLow) null, so the extension check is unknown (V3 §6.4 rule 5)', build: () => evidenceOf(base((b) => { b[2].low = BASE_SMA_FAST; b[10].low = null; })) },
  volume_bar0_null: { kind: 'entry', expect: 'V null, reason null', build: () => evidenceOf(base((b) => { b[0].volume = null; })) },
  volume_bar0_zero: { kind: 'entry', expect: 'V null, reason zero', build: () => evidenceOf(base((b) => { b[0].volume = 0; })) },
  volume_bar0_negative: { kind: 'entry', expect: 'V null, reason negative', build: () => evidenceOf(base((b) => { b[0].volume = -5; })) },
  volume_bar0_non_finite: { kind: 'entry', expect: 'V null, reason non_finite', build: () => evidenceOf(base((b) => { b[0].volume = Number.POSITIVE_INFINITY; })) },
  volume_window_null: { kind: 'entry', expect: 'V_avg null, bar 7 reason null', build: () => evidenceOf(base((b) => { b[7].volume = null; })) },
  volume_window_zero: { kind: 'entry', expect: 'V_avg null, bar 7 reason zero', build: () => evidenceOf(base((b) => { b[7].volume = 0; })) },
  volume_window_negative: { kind: 'entry', expect: 'V_avg null, bar 7 reason negative', build: () => evidenceOf(base((b) => { b[7].volume = -1; })) },
  volume_window_non_finite: { kind: 'entry', expect: 'V_avg null, bar 7 reason non_finite', build: () => evidenceOf(base((b) => { b[7].volume = Number.NaN; })) },
  // ---- missing price facts
  null_high_bar5: { kind: 'entry', expect: 'unknown(missing_fact): swingHigh and ATR null', build: () => evidenceOf(base((b) => { b[5].high = null; })) },
  null_high_bar20: { kind: 'entry', expect: 'unknown(missing_fact): swingHigh null, ATR intact', build: () => evidenceOf(base((b) => { b[20].high = null; })) },
  // ---- holding
  holding_close_below_slow: { kind: 'holding', options: { anchorSwingLow: 80 }, expect: 'broken [close_below_slow]: a sharp drop at bar 0 to 85, no_trend', build: () => evidenceOf(base((b) => { setClose(b, 0, 85); })) },
  holding_structure_break: { kind: 'holding', options: { anchorSwingLow: 100.5 }, expect: 'broken [structure_break]: C 100 below the anchor 100.5', build: () => evidenceOf(base()) },
  holding_regime_flip: { kind: 'holding', options: { anchorSwingLow: 50 }, expect: 'broken [close_below_slow, regime_flip]: downtrend (close below slow is implied by the mirror stack)', build: () => evidenceOf(buildBars({ closeAt: (i) => BASE_CLOSE + BASE_SLOPE * i })) },
  holding_anchor_absent_all_false: { kind: 'holding', options: {}, expect: 'unknown: structure_break unknown, the others false, provenance absent', build: () => evidenceOf(base()) },
  holding_anchor_absent_close_below_slow: { kind: 'holding', options: {}, expect: 'broken [close_below_slow] with the anchor absent', build: () => evidenceOf(base((b) => { setClose(b, 0, 85); })) },
  holding_intact_with_anchor: { kind: 'holding', options: { anchorSwingLow: 90 }, expect: 'intact', build: () => evidenceOf(base()) },
  holding_extended_series_intact: { kind: 'holding', options: { anchorSwingLow: 90 }, expect: 'intact for the series whose entry is invalid(extended)', build: () => evidenceOf(tight((b) => { b[2].low = BASE_SMA_FAST; })) },
  holding_no_setup_series_intact: { kind: 'holding', options: { anchorSwingLow: 90 }, expect: 'intact for the series whose entry is invalid(no_setup)', build: () => evidenceOf(base((b) => { setClose(b, 0, BASE_SWING_HIGH - 0.01); })) },
  holding_short_history: { kind: 'holding', options: {}, expect: 'all unknown on 10 bars with no anchor', build: () => evidenceOf(buildBars({ n: 10 })) },
  holding_history_54_close_below_slow: { kind: 'holding', options: { anchorSwingLow: 80 }, expect: 'all unknown on 54 bars although C < SMA_slow and C > the anchor: the holding shares MIN_COMPLETED_BARS', build: () => evidenceOf(buildBars({ n: 54, patch: (b) => { setClose(b, 0, 85); } })) },
  holding_anchor_zero: { kind: 'holding', options: { anchorSwingLow: 0 }, expect: 'unknown: a non-positive anchor is not a price and reads absent', build: () => evidenceOf(base()) },
  holding_stack_down_slow_not_falling: { kind: 'holding', options: { anchorSwingLow: 40 }, expect: 'broken [close_below_slow] only: the mirror stack holds but SMA_slow is not falling, so regime_flip is false (review TE3-7)', build: () => evidenceOf(buildBars({ closeAt: (i) => (i >= 50 ? 50 : i >= 20 ? 100 : 95 - BASE_SLOPE * (19 - i)) })) },
  holding_regime_unknown_only: { kind: 'holding', options: { anchorSwingLow: 90 }, expect: 'unknown: 55 bars with a null close at bar 52 leave only SMA_slow_5ago null, so regime_flip alone is unknown and the chart leg is unknown, never intact (review TE3-2)', build: () => evidenceOf(buildBars({ n: 55, patch: (b) => { b[52].close = null; } })) },
  holding_boundaries_equal: { kind: 'holding', options: { anchorSwingLow: 100 }, expect: 'intact: a flat series at 100 with the anchor at 100 — close_below_slow and structure_break are strict < (review TE3-8)', build: () => evidenceOf(buildBars({ closeAt: () => 100 })) },
});

export const SCENARIO_NAMES = Object.freeze(Object.keys(SCENARIOS));
