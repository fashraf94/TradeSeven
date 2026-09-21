// src/data/intradayDiagnosticCopy.js
//
// Intraday Data — Build 1, contract §9.1: THE ONE COPY TABLE for every player
// surface that renders a diagnostic view (the Why? panel now; the tape and
// the narrator bind to this same table — no second table exists). ZERO
// IMPORTS, Node-clean, so the server's receipt-only replay (§8.2) and the
// client render the same lines from the same view.
//
// Every block is headed INTRADAY_DIAGNOSTIC_HEADER. Lines are rendered from a
// fixed table keyed by the verdict's `state` and `reason` — never from a
// parallel source (BUILD_RULES §9). A `display_only` line carries the phrase
// "cutoff unconfirmed" and the QUOTE's priceAsOf shown separately as
// "quote as of"; an experimental estimate says so. The narrator may never
// connect a diagnostic value to the decision — these lines describe data, not
// reasons.

export const INTRADAY_DIAGNOSTIC_HEADER = 'Diagnostic · recorded at the check · not seen by the agent';

export const INTRADAY_INDICATOR_LABELS = Object.freeze({
  vwap: 'VWAP est.',
  sessionHL: 'Session H/L',
  volume: 'Session volume',
  volumePace: 'Volume pace',
  sma20_5m: '5m SMA20',
  macd5m: '5m MACD hist',
  rsi5m: '5m RSI',
});

/** reason → the phrase a player reads. Unknown reasons render the generic phrase. */
export const INTRADAY_REASON_COPY = Object.freeze({
  cutoff_unconfirmed: 'cutoff unconfirmed',
  warmup: 'warming up',
  stale: 'too old at the check',
  cutoff_future: 'timestamp ahead of the check',
  insufficient_samples: 'too few samples',
  degraded: 'feed held this session',
  collection_stalled: 'collection stalled',
  experimental: 'experimental',
  no_session_anchor: 'no session anchor',
  not_in_snapshot: 'no reading',
  absent: 'no reading',
  no_value: 'no reading',
  no_volume_yet: 'no volume yet',
  volume_invalid: 'volume unusable',
  hl_invalid: 'range unusable',
  not_completed: 'bar not completed',
  close_unqualified: 'closing bar unresolved',
  not_ready: 'not ready',
  insufficient_elapsed: 'too early in the session',
  no_reference_volume: 'no average volume',
  no_state: 'no state',
});

/** Indicators that are never rendered when absent for a structural reason (crypto, non-actionable). */
const SILENT_REASONS = new Set(['not_actionable', 'no_buckets']);

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const money = (v) => (isNum(v) ? v.toFixed(2) : null);
const signed = (v) => (isNum(v) ? `${v >= 0 ? '+' : ''}${v.toFixed(2)}` : null);
const one = (v) => (isNum(v) ? v.toFixed(1) : null);
const thousands = (v) => (isNum(v) ? Math.round(v).toLocaleString('en-US') : null);

function valueText(key, ind) {
  const v = ind?.value;
  switch (key) {
    case 'vwap': return money(v);
    case 'sessionHL': return v && isNum(v.high) && isNum(v.low) ? `${money(v.high)}/${money(v.low)}` : null;
    case 'volume': return thousands(v);
    case 'volumePace': return isNum(v) ? `${v.toFixed(2)}×` : null;
    case 'sma20_5m': return money(v);
    case 'macd5m': return v && isNum(v.hist) ? signed(v.hist) : null;
    case 'rsi5m': return one(v);
    default: return null;
  }
}

const reasonPhrase = (reason) => INTRADAY_REASON_COPY[reason] || 'unavailable';

/**
 * Render one symbol's diagnostic lines from a stored view record.
 * @param {object} symbolView the §8.2 `symbols[sym]` record (facts + verdicts)
 * @param {{ timeText: (ms: number) => string|null, verdicts?: object }} opts
 *   `timeText` is the surface's own instant formatter (ET on the client);
 *   `verdicts` overrides the stored verdicts (the replay recomputes them).
 * @returns {string[]} zero or more lines, in indicator order
 */
export function renderIntradayDiagnosticLines(symbolView, { timeText, verdicts } = {}) {
  if (!symbolView || typeof symbolView !== 'object') return [];
  const fmt = typeof timeText === 'function' ? timeText : () => null;
  const lines = [];
  const priceAsOf = symbolView.price?.priceAsOf;
  const quoteAsOf = isNum(priceAsOf) ? fmt(priceAsOf) : null;
  for (const key of Object.keys(INTRADAY_INDICATOR_LABELS)) {
    const ind = symbolView.indicators?.[key];
    if (!ind) continue;
    const verdict = verdicts?.[key] || ind.verdict;
    if (!verdict) continue;
    const label = INTRADAY_INDICATOR_LABELS[key];
    const reason = verdict.reason;
    if (verdict.state === 'ineligible' && SILENT_REASONS.has(reason)) continue;
    const value = valueText(key, ind);
    if (verdict.state === 'eligible' && value !== null) {
      const cutoff = key === 'vwap' ? ind.estimateCutoff : ind.cutoff;
      const parts = [`${label} ${value}`];
      if (['sma20_5m', 'macd5m', 'rsi5m'].includes(key)) parts.push('completed bars');
      const at = isNum(cutoff) ? fmt(cutoff) : null;
      if (at) parts.push(`as of ${at}`);
      lines.push(parts.join(' · '));
      continue;
    }
    if (verdict.state === 'display_only' && value !== null) {
      const parts = [`${label} ${value}`, reasonPhrase(reason)];
      if (quoteAsOf) parts.push(`quote as of ${quoteAsOf}`);
      if (key === 'vwap' && ind.experimental === true) parts.push('experimental');
      lines.push(parts.join(' · '));
      continue;
    }
    lines.push(`${label.replace(/ est\.$/, '')} unavailable · ${reasonPhrase(reason)}`);
  }
  return lines;
}

/** The whole block for one symbol: header first, then the lines (empty when there are none). */
export function renderIntradayDiagnosticBlock(symbolView, opts) {
  const lines = renderIntradayDiagnosticLines(symbolView, opts);
  return lines.length ? [INTRADAY_DIAGNOSTIC_HEADER, ...lines] : [];
}
