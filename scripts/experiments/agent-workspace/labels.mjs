// Presentation only. Machine decisions and evaluator records remain unchanged.
export const DECISIONS = Object.freeze({ admitted: 'Eligible', refused: 'Not eligible', unknown: 'Unknown' });
export const POLICIES = Object.freeze({
  'tf-entry-admission-v1': 'Qualifying breakouts or pullbacks',
  'breakout-only-v1': 'Qualifying breakouts only',
  'baseline-control-v1': 'Same rules as baseline (control)',
});
export const FACTS = Object.freeze({
  C: 'Completed-session closing price', SMA_fast: 'Fast moving average', SMA_slow: 'Slow moving average',
  SMA_slow_5ago: 'Slow moving average five sessions earlier', swingHigh: 'Prior swing high',
  swingLow: 'Prior swing low', ATR: 'Average true range', V: 'Daily volume (feed field)',
  V_avg: 'Average prior daily volume (feed field)',
});
export const CHECKS = Object.freeze({
  regime_stack: 'Price above fast average, fast above slow average', slow_rising: 'Slow moving average rising',
  regime_stack_down: 'Price below fast average, fast below slow average', slow_falling: 'Slow moving average falling',
  breakout_close: 'Close reaches the prior swing high', breakout_volume: 'Volume meets the breakout minimum',
  pullback_touch: 'Recent low touches the fast moving average', pullback_close: 'Close finishes above the fast moving average',
  extension: 'Price stays within the extension limit',
});
const SCENARIOS = Object.freeze({
  breakout_at_swing_high: 'Breakout at the prior swing high', pullback_touch_bar2_exact: 'Qualifying pullback',
  both_patterns: 'Breakout and pullback both qualify', uptrend_no_setup: 'Uptrend without an entry setup',
  bars_54: 'Insufficient price history', c1_pullback_null_bar0_volume: 'Qualifying pullback with missing volume',
});
const REASONS = Object.freeze({
  qualified_setup: 'The shared evaluator found a qualifying entry setup.',
  qualified_breakout: 'The shared evaluator confirmed a qualifying breakout.',
  breakout_required: 'This configuration requires a breakout. The supported setup does not meet this requirement.',
  breakout_evidence_unavailable: 'The breakout result remains unresolved because required evidence is missing.',
  no_setup: 'Neither entry pattern qualifies under the current rules.',
  regime: 'The recorded trend does not meet the required uptrend conditions.',
  extended: 'Price exceeds the permitted extension limit.',
  missing_fact: 'Required evidence is missing. The evaluator leaves this result unresolved.',
  missing_bar: 'A required completed-session bar is missing.',
  insufficient_history: 'The saved window has too few completed sessions.',
  calendar_missing: 'The requested date lacks supported calendar evidence.',
  asOf_not_a_session: 'The requested date is not a trading session.',
  asOf_in_future: 'The requested date is later than the evaluation clock.',
  unordered_bars: 'The saved bars fail the required session-order or date checks.',
  basis_discontinuity: 'The adapter detected a change in the relationship between raw and adjusted prices.',
  unsupported_symbol_class: 'This evaluator does not support the supplied symbol class.',
});
export const label = (dictionary, value) => Object.hasOwn(dictionary, value) ? dictionary[value] : String(value ?? 'Not recorded');
export const evidenceLabel = value => label({ synthetic: 'Synthetic scenario', later_reconstruction: 'Historical download' }, value);
export const patternLabel = value => label({ breakout: 'Breakout', pullback_resume: 'Pullback', none: 'None' }, value ?? 'none');
export const regimeLabel = value => label({ uptrend: 'Uptrend', downtrend: 'Downtrend', no_trend: 'No qualifying trend', unknown: 'Unknown' }, value);
export const verdictLabel = value => label({ valid: 'Qualifying setup', invalid: 'No qualifying setup', unknown: 'Unknown' }, value);
export const caseTitle = input => input.evidenceKind === 'synthetic' ? label(SCENARIOS, input.id) : `${input.symbol} · daily setup`;
export function reasonText(decision, entry) {
  if (decision.reason === 'insufficient_history' && entry.refusal?.detail?.required !== undefined) {
    return `The evaluator needs ${entry.refusal.detail.required} completed sessions. This window supplies ${entry.refusal.detail.available}.`;
  }
  return label(REASONS, decision.reason);
}
export function differenceText(c) {
  const from = label(DECISIONS, c.baseline.decision);
  const to = label(DECISIONS, c.candidate.decision);
  return c.changed ? `Decision changed from ${from} to ${to}.` : `Both configurations return ${from}.`;
}
