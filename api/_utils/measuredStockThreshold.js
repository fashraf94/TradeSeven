// Stage 1 only: isolated measurement, no runtime scoring/admission consumers.
import { createHash } from 'node:crypto';
import { getSessionForDate, getPreviousSessionDate } from '../../src/utils/marketCalendar.js';

export const MEASUREMENT_POLICY = Object.freeze({
  id: 'stock_atr14_sma_fully_adjusted_candidate_v1', period: 14,
  basis: 'fully_adjusted_ohlc', tolerance: 0, precision: 'binary64_unrounded',
  calendar: 'src/utils/marketCalendar.js@c05a5bf7697d12869f51f6bd7f4914f287e0f01f',
  calendarSourceSha256: 'f03b061c7241fdc8b004c7fd616811457b488f29feb8bf618fa476c7b3ff14de',
  finalization: 'explicit_export_attestation_v1', bounds: 'unresolved', quantization: 'unresolved',
});
export const hashValue = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const POLICY_HASH = hashValue(MEASUREMENT_POLICY);
const failure = (status, reason, detail = {}) => ({ status, reason, ...detail, policy: MEASUREMENT_POLICY, policyHash: POLICY_HASH, scoringPct: null });
export function strictNumber(value) {
  if (typeof value === 'string' && !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value)) return null;
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}
export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T12:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function instant(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !validDate(value.slice(0, 10))) return null;
  if (Number(value.slice(11, 13)) > 23 || Number(value.slice(14, 16)) > 59 || Number(value.slice(17, 19)) > 59) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

// Independently uses the exchange clock/calendar, never the last provider row.
export function expectedSessionAt(asOf) {
  const now = instant(asOf);
  if (now === null) return failure('invalid', 'invalid_as_of');
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = type => parts.find(p => p.type === type).value;
  const date = `${part('year')}-${part('month')}-${part('day')}`;
  const today = getSessionForDate(date);
  if (!today) return failure('unavailable', 'calendar_missing', { date });
  const sourceSession = today.isTradingDay && now >= today.closeMs ? date : getPreviousSessionDate(date);
  if (!sourceSession) return failure('unavailable', 'calendar_missing');
  return { status: 'valid', sourceSession, closeMs: getSessionForDate(sourceSession).closeMs, calendar: MEASUREMENT_POLICY.calendar };
}

// One raw snapshot only. No merger, cache, provider I/O, or implicit close fallback.
export function normalizeRawSnapshot(snapshot, throughSession = null) {
  if (!snapshot || typeof snapshot.id !== 'string' || !snapshot.id || typeof snapshot.providerSymbol !== 'string' || !snapshot.providerSymbol || instant(snapshot.capturedAt) === null || snapshot.basis !== 'raw_ohlc_adjusted_close') return failure('invalid', 'invalid_snapshot_identity');
  if (snapshot.fragments != null) return failure('invalid', 'incompatible_fragments');
  if (!Array.isArray(snapshot.rows)) return failure('invalid', 'rows_not_array');
  const seen = new Set();
  const rows = [];
  for (const [index, raw] of snapshot.rows.entries()) {
    if (!raw || !validDate(raw.date)) return failure('invalid', 'invalid_session_date', { index, usableBarCount: rows.length, droppedBarCount: 1 });
    if (seen.has(raw.date)) return failure('invalid', 'duplicate_session', { date: raw.date, usableBarCount: rows.length, droppedBarCount: 1 });
    seen.add(raw.date);
    if (raw.snapshotId != null && raw.snapshotId !== snapshot.id) return failure('invalid', 'incompatible_fragments', { date: raw.date });
    if (throughSession && raw.date > throughSession) continue;
    const values = Object.fromEntries(['open', 'high', 'low', 'close', 'adjusted_close'].map(key => [key, strictNumber(raw[key])]));
    if (Object.values(values).some(v => v === null || v <= 0)) return failure('invalid', 'invalid_price', { date: raw.date, usableBarCount: rows.length, droppedBarCount: 1 });
    const { open, high, low, close, adjusted_close } = values;
    if (high < low || open < low || open > high || close < low || close > high) return failure('invalid', 'incoherent_ohlc', { date: raw.date, usableBarCount: rows.length, droppedBarCount: 1 });
    const factor = adjusted_close / close;
    const normalized = { date: raw.date, open: open * factor, high: high * factor, low: low * factor, close: close * factor };
    if (!Number.isFinite(factor) || factor <= 0 || Object.values(normalized).slice(1).some(v => !Number.isFinite(v) || v <= 0)) return failure('invalid', 'normalization_overflow', { date: raw.date });
    rows.push({ ...normalized, factor, raw: { date: raw.date, ...Object.fromEntries(Object.keys(values).map(key => [key, raw[key]])) } });
  }
  rows.sort((a, b) => a.date.localeCompare(b.date));
  return { status: 'valid', rows, snapshotId: snapshot.id, providerSymbol: snapshot.providerSymbol, capturedAt: snapshot.capturedAt, inputBarCount: snapshot.rows.length, droppedBarCount: 0, basis: MEASUREMENT_POLICY.basis };
}

export function calculateMeasuredATR(bars) {
  if (!Array.isArray(bars) || bars.length !== 15) return failure('unavailable', 'requires_fifteen_bars');
  if (bars.some((b, i) => !b || ['open', 'high', 'low', 'close'].some(k => typeof b[k] !== 'number' || !Number.isFinite(b[k]) || b[k] <= 0) || !validDate(b.date) || (i > 0 && b.date <= bars[i - 1].date) || b.high < b.low || b.close < b.low || b.close > b.high || b.open < b.low || b.open > b.high)) return failure('invalid', 'invalid_normalized_bars');
  const trueRanges = bars.slice(1).map((bar, i) => Math.max(bar.high - bar.low, Math.abs(bar.high - bars[i].close), Math.abs(bar.low - bars[i].close)));
  const atr14Dollars = trueRanges.reduce((sum, tr) => sum + tr, 0) / 14;
  const measuredPct = 100 * atr14Dollars / bars.at(-1).close;
  if (!Number.isFinite(atr14Dollars) || !Number.isFinite(measuredPct)) return failure('invalid', 'calculation_overflow');
  return { status: 'valid', atr14Dollars, measuredPct, trueRanges, zeroVolatility: measuredPct === 0, scoringPct: null };
}

export function measureStock({ symbol, providerSymbol, expectedSourceSession, asOf, snapshot, finalization } = {}) {
  if (typeof symbol !== 'string' || !symbol || !validDate(expectedSourceSession)) return failure('invalid', 'invalid_measurement_identity');
  const expected = expectedSessionAt(asOf);
  if (expected.status !== 'valid') return expected;
  if (expected.sourceSession !== expectedSourceSession) return failure('unavailable', 'expected_session_mismatch', { expectedSourceSession, independentlyExpectedSession: expected.sourceSession });
  const normalized = normalizeRawSnapshot(snapshot, expectedSourceSession);
  if (normalized.status !== 'valid') return normalized;
  if (providerSymbol !== normalized.providerSymbol) return failure('invalid', 'provider_symbol_mismatch');
  if (instant(normalized.capturedAt) > instant(asOf)) return failure('invalid', 'future_snapshot');
  // Attestation is auditable input, not proof of a provider's publication guarantee.
  const observed = instant(finalization?.observedAt);
  const finalizationUsable = finalization?.type === 'export_attestation' && finalization?.session === expectedSourceSession && finalization?.final === true && typeof finalization?.source === 'string' && finalization.source && observed !== null && observed >= expected.closeMs && observed <= instant(normalized.capturedAt);
  const dates = [expectedSourceSession];
  for (let i = 1; i < 15; i++) {
    const date = getPreviousSessionDate(dates[0]);
    if (!date) return failure('unavailable', 'calendar_missing');
    dates.unshift(date);
  }
  const indexed = new Map(normalized.rows.map(row => [row.date, row]));
  const missing = dates.filter(date => !indexed.has(date));
  if (missing.length) return failure('unavailable', 'missing_sessions', { missing, usableBarCount: dates.length - missing.length, droppedBarCount: 0 });
  const windowRows = normalized.rows.filter(row => row.date >= dates[0] && row.date <= expectedSourceSession);
  if (windowRows.length !== 15 || windowRows.some((row, i) => row.date !== dates[i])) return failure('invalid', 'non_exchange_session_in_window');
  const calculation = calculateMeasuredATR(windowRows);
  if (calculation.status !== 'valid') return calculation;
  const inputHash = hashValue({ providerSymbol, basis: normalized.basis, rows: windowRows.map(row => ({ raw: row.raw, factor: row.factor })) });
  return { ...calculation, status: finalizationUsable ? 'valid' : 'unavailable', reason: finalizationUsable ? null : 'finalization_unproven', measurementArithmetic: 'valid', symbol, providerSymbol, sourceSession: expectedSourceSession, expectedSourceSession, asOf, basis: normalized.basis, snapshotId: normalized.snapshotId, snapshotCapturedAt: normalized.capturedAt, finalization, finalizationQualification: finalizationUsable ? 'attested_only_provider_rule_unqualified' : 'unproven', policy: MEASUREMENT_POLICY, policyHash: POLICY_HASH, inputHash, inputBarCount: normalized.inputBarCount, usableBarCount: 15, droppedBarCount: 0, excludedBarCount: normalized.inputBarCount - 15, orderedBars: windowRows };
}

// Exact decimal half-even over the shortest decimal representation of a Number.
// Candidate display/comparison only; never modifies the binary64 measurement.
export function candidateRoundHalfEven(value, decimals = 2) {
  if (!Number.isFinite(value) || !Number.isInteger(decimals) || decimals < 0 || decimals > 8) throw new TypeError('Invalid rounding operands');
  const negative = value < 0;
  const [mantissa, exponent = '0'] = Math.abs(value).toString().toLowerCase().split('e');
  const fractionalDigits = mantissa.includes('.') ? mantissa.split('.')[1].length : 0;
  const digits = BigInt(mantissa.replace('.', ''));
  const shift = Number(exponent) - fractionalDigits + decimals;
  let rounded;
  if (shift >= 0) rounded = digits * 10n ** BigInt(shift);
  else {
    const divisor = 10n ** BigInt(-shift);
    rounded = digits / divisor;
    const twice = digits % divisor * 2n;
    if (twice > divisor || (twice === divisor && rounded % 2n === 1n)) rounded++;
  }
  return (negative ? -1 : 1) * Number(`${rounded}e-${decimals}`);
}
export function candidatePolicyEffects(measuredPct) {
  if (!Number.isFinite(measuredPct) || measuredPct < 0) throw new TypeError('Invalid measured percentage');
  const boundedPct = Math.min(15, Math.max(1, measuredPct));
  return { status: 'candidate_not_approved', policy: 'compare_1_to_15_half_even_2dp_v1', measuredPct, boundedPct, quantizedPct: candidateRoundHalfEven(boundedPct), floorChanged: measuredPct < 1, capChanged: measuredPct > 15, scoringEligibility: 'unresolved_D3' };
}
