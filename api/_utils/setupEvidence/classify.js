// api/_utils/setupEvidence/classify.js
//
// ID-1 Build 1 — FINAL OR RETRYABLE (shape note V1.4 §3, rulings Q-ID1-4 and
// Q-ID1-5). One acquisition's outcome → one disposition:
//
//   final              write the snapshot;
//   confirm            final only when a separate fetch at least 30 minutes after
//                      the first reproduces the same reason and detail (the store
//                      keeps the observation); until then, retryable;
//   retryable          nothing final is written;
//   programming_error  throw, write nothing.
//
// | Outcome                                                              | Disposition        |
// |----------------------------------------------------------------------|--------------------|
// | ok evidence                                                          | final              |
// | basis_discontinuity; missing_fact; insufficient_history              | final              |
// | interior missing_bar (detail.after); unordered_bars non_session_date | confirm            |
// | newest-session missing_bar                                           | retryable          |
// | calendar_missing (unmaintained); asOf_in_future                      | retryable          |
// | malformed or out-of-order payload (unordered_bars)                   | retryable          |
// | fetch failure, timeout, non-200, budget, non-array payload           | retryable          |
// | calendar_missing why malformed_date; asOf_not_a_session              | programming_error  |
// | ok evidence whose asOf or requestedAsOf differs from the session     | programming_error  |
//
// Three lines go beyond the contract's table, each failing closed, none able to
// write anything final: a refusal whose `expected` is not the session (the
// session had not completed, so `insufficient_history` there says nothing about
// the symbol); `unsupported_symbol_class` (crypto is refused before any call, so
// reaching this table means that guard failed); and a reason this table does not
// know (a new adapter refusal must be classified here before it can be stored).
//
// Pure: node:crypto only.

import { createHash } from 'node:crypto';

export const DISPOSITIONS = Object.freeze({ FINAL: 'final', CONFIRM: 'confirm', RETRYABLE: 'retryable', PROGRAMMING_ERROR: 'programming_error' });
/** The acquisition failures that never reach the adapter. */
export const ACQUISITION_FAILURES = Object.freeze({ FETCH_FAILED: 'fetch_failed', NON_ARRAY_PAYLOAD: 'non_array_payload' });

const FINAL_REFUSALS = new Set(['basis_discontinuity', 'missing_fact', 'insufficient_history']);

const disposition = (kind, reason, detail = null) => ({ disposition: kind, reason, detail });
const programmingError = (reason, detail = null) => disposition(DISPOSITIONS.PROGRAMMING_ERROR, reason, detail);

/** Thrown for a `programming_error` disposition; nothing final has been written. */
export class SetupEvidenceProgrammingError extends Error {
  constructor(reason, detail = null) {
    super(`setupEvidence: ${reason}`);
    this.name = 'SetupEvidenceProgrammingError';
    this.reason = reason;
    this.detail = detail;
  }
}

/** A failed fetch or an unusable payload: retryable, whatever the cause. */
export function classifyAcquisitionFailure(reason) {
  return disposition(DISPOSITIONS.RETRYABLE, reason);
}

/** The daily-bars adapter's result for a requested session. */
export function classifyEvidence(evidence, { session }) {
  if (evidence?.ok === true) {
    if (evidence.asOf !== session || evidence.requestedAsOf !== session) {
      return programmingError('asof_mismatch', { session, asOf: evidence.asOf ?? null, requestedAsOf: evidence.requestedAsOf ?? null });
    }
    return disposition(DISPOSITIONS.FINAL, null);
  }
  const reason = evidence?.reason ?? null;
  const detail = evidence?.detail ?? null;
  if (evidence?.expected != null && evidence.expected !== session) return programmingError('session_incomplete', { session, expected: evidence.expected });
  if (FINAL_REFUSALS.has(reason)) return disposition(DISPOSITIONS.FINAL, reason, detail);
  switch (reason) {
    case 'missing_bar':
      return disposition(detail?.after ? DISPOSITIONS.CONFIRM : DISPOSITIONS.RETRYABLE, reason, detail);
    case 'unordered_bars':
      return disposition(detail?.why === 'non_session_date' ? DISPOSITIONS.CONFIRM : DISPOSITIONS.RETRYABLE, reason, detail);
    case 'calendar_missing':
      return detail?.why === 'malformed_date' ? programmingError(reason, detail) : disposition(DISPOSITIONS.RETRYABLE, reason, detail);
    case 'asOf_in_future':
      return disposition(DISPOSITIONS.RETRYABLE, reason, detail);
    default:
      return programmingError(reason ?? 'unknown_outcome', detail);
  }
}

/**
 * The calendar's answer (dailyBarsAdapter.js expectedCompletedSession) before
 * any read or fetch: null when the session may be acquired, else the disposition
 * the same request would earn after a fetch. An incomplete session is a caller's
 * error; the wrapper never names one.
 */
export function classifySessionRequest(calendar, { session }) {
  if (!calendar.ok) return classifyEvidence({ ok: false, reason: calendar.reason, detail: calendar.detail }, { session });
  if (calendar.completedSession !== 'complete') return programmingError('session_incomplete', { session, expected: calendar.expected });
  return null;
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
}

/** sha256 of a refusal's detail in canonical key order: the same detail hashes the same however its keys were written. */
export function detailHashOf(detail) {
  return createHash('sha256').update(JSON.stringify(canonical(detail ?? null)), 'utf8').digest('hex');
}
