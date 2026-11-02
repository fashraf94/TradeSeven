// api/_utils/setupEvidence/classify.test.js
//
// ID-1 Build 1 — the final-or-retryable table, one row per line of the contract's
// table (shape note V1.5 §3), then the three fail-closed additions.

import { describe, it, expect } from 'vitest';
import { classifyAcquisitionFailure, classifyEvidence, classifySessionRequest, detailHashOf, ACQUISITION_FAILURES, DISPOSITIONS, SetupEvidenceProgrammingError } from './classify.js';
import { ADAPTER_REFUSALS } from '../setupEvaluator/dailyBarsAdapter.js';

const SESSION = '2026-10-29';
const refused = (reason, detail = {}, expected = SESSION) => ({ ok: false, reason, detail, expected });
const classify = (evidence) => classifyEvidence(evidence, { session: SESSION });
const kind = (evidence) => classify(evidence).disposition;

describe('the contract\'s table', () => {
  const okWith = (adjustment, checks) => ({ ok: true, asOf: SESSION, requestedAsOf: SESSION, adjustment, checks });
  it('ok evidence with adjustment metadata present → final', () => {
    expect(classify(okWith({ metadata: 'present', missingDates: [] }, { splitCheck: 'heuristic_ok', splitCheckReason: null }))).toEqual({ disposition: 'final', reason: null, detail: null });
  });
  it.each([
    ['basis_discontinuity', { date: SESSION }],
    ['missing_fact on a row older than the session', { fact: 'close', date: '2026-10-28', value: null }],
  ])('%s → final', (label, detail) => {
    const reason = label.split(' ')[0];
    expect(classify(refused(reason, detail))).toEqual({ disposition: 'final', reason, detail });
  });
  it.each([
    ['adjusted_close_missing', { metadata: 'absent', missingDates: [SESSION] }],
    ['adjusted_close_nonpositive', { metadata: 'absent', missingDates: ['2026-10-20'] }],
    ['adjustment_metadata_absent', { metadata: 'absent', missingDates: [] }],
  ])('ok evidence with adjustment metadata absent → confirm (%s), its reason the adapter\'s and its detail the adjustment block', (reason, adjustment) => {
    expect(classify(okWith(adjustment, { splitCheck: 'not_available', splitCheckReason: reason }))).toEqual({ disposition: 'confirm', reason, detail: adjustment });
  });
  it('ok evidence with no adjustment block at all is not `present`: it confirms, named by the fallback', () => {
    expect(classify(okWith(undefined, undefined))).toEqual({ disposition: 'confirm', reason: 'adjustment_metadata_absent', detail: null });
  });
  it('insufficient_history → confirm: a truncated array can pass', () => {
    const detail = { required: 55, available: 54 };
    expect(classify(refused('insufficient_history', detail))).toEqual({ disposition: 'confirm', reason: 'insufficient_history', detail });
  });
  it('missing_fact on the session\'s own row → confirm: a newest row of zeros can pass', () => {
    const detail = { fact: 'close', date: SESSION, value: 0 };
    expect(classify(refused('missing_fact', detail))).toEqual({ disposition: 'confirm', reason: 'missing_fact', detail });
  });
  it('missing_fact naming no date → confirm: only a row shown to be older goes final', () => {
    expect(kind(refused('missing_fact', { fact: 'close' }))).toBe('confirm');
  });
  it('an interior missing_bar (a gap inside the window) → confirm', () => {
    const detail = { expected: '2026-10-20', latest: '2026-10-19', after: '2026-10-21' };
    expect(classify(refused('missing_bar', detail))).toEqual({ disposition: 'confirm', reason: 'missing_bar', detail });
  });
  it('unordered_bars with why non_session_date → confirm', () => {
    const detail = { index: 3, date: '2026-10-24', why: 'non_session_date' };
    expect(classify(refused('unordered_bars', detail))).toEqual({ disposition: 'confirm', reason: 'unordered_bars', detail });
  });
  it('a newest-session missing_bar (the bar is not yet published) → retryable, never final', () => {
    expect(classify(refused('missing_bar', { expected: SESSION, latest: '2026-10-28' }))).toMatchObject({ disposition: 'retryable', reason: 'missing_bar' });
  });
  it('an empty series is a newest-session missing_bar', () => {
    expect(kind(refused('missing_bar', { expected: SESSION, latest: null }))).toBe('retryable');
  });
  it('calendar_missing for an unmaintained year → retryable', () => {
    expect(kind(refused('calendar_missing', { asOf: '2028-01-03', maintainedYears: [2026, 2027] }, null))).toBe('retryable');
  });
  it('calendar_missing for a previous session outside the maintained years → retryable', () => {
    expect(kind(refused('calendar_missing', { why: 'previous_session_outside_maintained_years' }, null))).toBe('retryable');
  });
  it('asOf_in_future → retryable', () => {
    expect(kind(refused('asOf_in_future', { asOf: SESSION, today: '2026-10-28' }, null))).toBe('retryable');
  });
  it.each([
    ['a malformed date in the payload', { index: 2, date: 'yesterday', why: 'malformed_date' }],
    ['an out-of-order or duplicate date', { index: 2, date: '2026-10-27', previous: '2026-10-27' }],
  ])('unordered_bars, %s → retryable', (_label, detail) => {
    expect(kind(refused('unordered_bars', detail))).toBe('retryable');
  });
  it.each([[ACQUISITION_FAILURES.FETCH_FAILED], [ACQUISITION_FAILURES.NON_ARRAY_PAYLOAD], [ACQUISITION_FAILURES.MALFORMED_PAYLOAD]])('an acquisition failure (%s: timeout, non-200, budget, a body that cannot be read) → retryable', (reason) => {
    expect(classifyAcquisitionFailure(reason)).toEqual({ disposition: 'retryable', reason, detail: null });
  });
  it('calendar_missing with why malformed_date → programming error', () => {
    expect(kind(refused('calendar_missing', { asOf: 'x', why: 'malformed_date' }, null))).toBe('programming_error');
  });
  it('asOf_not_a_session → programming error', () => {
    expect(kind(refused('asOf_not_a_session', { asOf: '2026-10-24' }, null))).toBe('programming_error');
  });
  it.each([
    ['asOf', { ok: true, asOf: '2026-10-28', requestedAsOf: SESSION }],
    ['requestedAsOf', { ok: true, asOf: SESSION, requestedAsOf: '2026-10-28' }],
  ])('an ok result whose %s differs from the request → programming error', (_label, evidence) => {
    expect(classify(evidence)).toEqual({ disposition: 'programming_error', reason: 'asof_mismatch', detail: { session: SESSION, asOf: evidence.asOf, requestedAsOf: evidence.requestedAsOf } });
  });
});

describe('beyond the table: failing closed', () => {
  it('a refusal for a session that had not completed, whose `expected` is not the session → programming error, even a reason that is otherwise final', () => {
    expect(classify(refused('basis_discontinuity', { date: '2026-10-27' }, '2026-10-28'))).toEqual({
      disposition: 'programming_error', reason: 'session_incomplete', detail: { session: SESSION, expected: '2026-10-28' },
    });
  });
  it('a refusal with no `expected` is not that case', () => {
    expect(kind(refused('asOf_in_future', {}, null))).toBe('retryable');
    expect(kind({ ok: false, reason: 'asOf_in_future', detail: {} })).toBe('retryable');
  });
  it('unsupported_symbol_class reaching the table → programming error: crypto is refused before any call', () => {
    expect(kind(refused('unsupported_symbol_class', { symbol: 'BTC' }, null))).toBe('programming_error');
  });
  it.each([[refused('a_new_refusal')], [{ ok: false }], [null], [undefined]])('a result the table does not know → programming error: %j', (evidence) => {
    expect(kind(evidence)).toBe('programming_error');
  });
  it('a refusal that names no reason is called what it is', () => {
    expect(classify({ ok: false }).reason).toBe('unknown_outcome');
  });
  it('every adapter refusal is either in the table or deliberately fails closed: none falls to the unknown branch by accident', () => {
    const expected = {
      unsupported_symbol_class: 'programming_error', calendar_missing: 'retryable', asOf_not_a_session: 'programming_error', asOf_in_future: 'retryable',
      missing_bar: 'retryable', unordered_bars: 'retryable', insufficient_history: 'confirm', missing_fact: 'confirm', basis_discontinuity: 'final',
    };
    expect(Object.keys(expected).sort()).toEqual([...ADAPTER_REFUSALS].sort());
    for (const reason of ADAPTER_REFUSALS) expect([reason, kind(refused(reason, {}, null))]).toEqual([reason, expected[reason]]);
  });
});

describe('classifySessionRequest — the calendar, before any read or fetch', () => {
  const session = SESSION;
  it('a complete session may be acquired', () => {
    expect(classifySessionRequest({ ok: true, expected: SESSION, completedSession: 'complete' }, { session })).toBeNull();
  });
  it('a session that has not closed → programming error', () => {
    expect(classifySessionRequest({ ok: true, expected: '2026-10-28', completedSession: 'current_session_incomplete' }, { session })).toEqual({
      disposition: 'programming_error', reason: 'session_incomplete', detail: { session, expected: '2026-10-28' },
    });
  });
  it('the calendar\'s refusals keep their table lines', () => {
    expect(classifySessionRequest({ ok: false, reason: 'calendar_missing', detail: {} }, { session }).disposition).toBe('retryable');
    expect(classifySessionRequest({ ok: false, reason: 'asOf_in_future', detail: {} }, { session }).disposition).toBe('retryable');
    expect(classifySessionRequest({ ok: false, reason: 'asOf_not_a_session', detail: {} }, { session }).disposition).toBe('programming_error');
    expect(classifySessionRequest({ ok: false, reason: 'calendar_missing', detail: { why: 'malformed_date' } }, { session }).disposition).toBe('programming_error');
  });
});

describe('detailHashOf', () => {
  it('the same detail with its keys written in another order hashes the same, at every depth', () => {
    expect(detailHashOf({ expected: 'a', latest: 'b', after: { x: 1, y: [{ p: 1, q: 2 }] } })).toBe(detailHashOf({ after: { y: [{ q: 2, p: 1 }], x: 1 }, latest: 'b', expected: 'a' }));
  });
  it('a different value hashes differently, and array order is part of the value', () => {
    expect(detailHashOf({ expected: 'a' })).not.toBe(detailHashOf({ expected: 'b' }));
    expect(detailHashOf({ a: [1, 2] })).not.toBe(detailHashOf({ a: [2, 1] }));
  });
  it('sha256 hex, and a null detail has one', () => {
    expect(detailHashOf(null)).toMatch(/^[0-9a-f]{64}$/);
    expect(detailHashOf(undefined)).toBe(detailHashOf(null));
  });
});

describe('the exports', () => {
  it('four dispositions', () => {
    expect(Object.values(DISPOSITIONS).sort()).toEqual(['confirm', 'final', 'programming_error', 'retryable']);
  });
  it('the programming error names its reason and carries its detail', () => {
    const err = new SetupEvidenceProgrammingError('asof_mismatch', { session: SESSION });
    expect(err).toBeInstanceOf(Error);
    expect([err.name, err.reason, err.detail, err.message]).toEqual(['SetupEvidenceProgrammingError', 'asof_mismatch', { session: SESSION }, 'setupEvidence: asof_mismatch']);
  });
});
