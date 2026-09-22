// api/_utils/intraday/validationRunner.js
//
// Intraday Data — Build 1, contract §10.1: ONE validator invocation. State in
// intradayValidationState/{etDate}: { status: 'pending'|'in_progress'|'done'|
// 'window_closed', pendingSymbols[], doneSymbols[], attempts,
// firstPublishHourUtc, windowClosesAt }. Each invocation: deadline
// reconciliation (§6.2) for the session; if bars are unpublished, record the
// attempt and exit; otherwise validate up to 20 symbols within a 60 s
// budget, persist progress, exit. `done` when pendingSymbols is empty;
// `window_closed` at 16:00 UTC (recomputed per invocation — A8) with the
// unvalidated symbols listed and a reason that distinguishes a vendor that
// has not published from a transport failure (A8). Bounded work every
// invocation; nothing relies on
// platform retries. Every dependency injected.

import * as DEFAULT_CONFIG from '../intradayConfig.js';
import { etDateOf as defaultEtDateOf } from './etTime.js';
import { fetchIntraday1mBars } from './intradayFetch.js';
import { recordUnits, calcStateRef, validationRef, validationStateRef, loadCalcState, loadActionableDocs } from './intradayStore.js';
import { applyDeadlineForSession } from './pollRunner.js';
import { validateSymbolSession, aggregateValidation } from './validator.js';
import { toVendorStock } from './universe.js';

const dataOf = (snap) => (snap && snap.exists ? (typeof snap.data === 'function' ? snap.data() : snap.data) : null);

/**
 * Addendum A8(a) — the window closes at `hourUtc` on the CURRENT grading day,
 * recomputed every invocation.
 *
 * It used to be stamped once, at state creation, from the first invocation's
 * clock and then compared against on every later one. Two reachable
 * consequences, both measured in the review:
 *
 *   - if the twelve earlier cron slots were dropped (Vercel gives no retry —
 *     G10), the state was CREATED at 16:00 and closed in the same breath:
 *     attempts 0, zero vendor requests, and every symbol written off as
 *     unpublished while the bars sat there;
 *   - 19 sessions a year have two grading UTC days (the session before a
 *     holiday Monday). On the second, the stale stamp was already in the
 *     past, so the first slot closed the session with twelve usable slots
 *     and published bars remaining.
 *
 * Deriving it from `nowMs` each time fixes both: every grading day gets its
 * own full window.
 */
function windowCloseMs(nowMs, hourUtc) {
  const d = new Date(nowMs);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hourUtc, 0, 0);
}

/**
 * @param {object} p
 * @param {object} p.db
 * @param {() => number} p.now
 * @param {Function} p.fetchImpl
 * @param {string} p.apiKey
 * @param {boolean} p.collectEnabled
 * @param {{getSessionForDate: Function, getPreviousSessionDate: Function}} p.calendar
 * @param {(db: object, session: object) => Promise<object[]>} p.listViewsForSession views (with battleId) evaluated within the session
 * @param {(presetId: string) => number} p.fireTicksOf vwapFailureTicks per preset
 */
export async function runValidation({
  db, now, fetchImpl, apiKey, collectEnabled, calendar, listViewsForSession, fireTicksOf,
  config = DEFAULT_CONFIG, etDateOf = defaultEtDateOf, log = console,
}) {
  if (!collectEnabled) return { skipped: true, reason: 'flag_off' };
  const nowMs = now();
  const todayEt = etDateOf(nowMs);
  const gradeDate = calendar.getPreviousSessionDate(todayEt);
  if (!gradeDate) return { skipped: true, reason: 'calendar_missing', todayEt };
  const session = calendar.getSessionForDate(gradeDate);
  if (!session) return { skipped: true, reason: 'calendar_missing', gradeDate };
  if (!session.isTradingDay) return { skipped: true, reason: 'not_trading_day', gradeDate };

  // Deadline reconciliation, idempotent (§6.2).
  const deadline = await applyDeadlineForSession({ db, session, nowMs: Math.max(nowMs, session.closeMs + config.DEADLINE_AFTER_CLOSE_MS), config });

  const stateRef = validationStateRef(db, gradeDate);
  let state = dataOf(await stateRef.get());
  if (state?.status === 'done' || state?.status === 'window_closed') return { skipped: true, reason: `already_${state.status}`, gradeDate, deadline };
  if (!state) {
    const listing = await calcStateRef(db, gradeDate).collection('actionable').get();
    const symbols = (listing.docs || []).map((d) => d.id).sort();
    state = { etDate: gradeDate, status: 'pending', pendingSymbols: symbols, doneSymbols: [], attempts: 0, firstPublishHourUtc: null, results: {}, createdAt: nowMs };
    if (!symbols.length) {
      state.status = 'done';
      await stateRef.set({ ...state, updatedAt: nowMs });
      await validationRef(db, gradeDate).set(aggregateValidation({}, { etDate: gradeDate, calcVersion: config.CALC_VERSION, policyVersion: config.POLICY_VERSION, firstPublishHourUtc: null, status: 'done_no_symbols', computedAt: nowMs }));
      return { gradeDate, status: 'done', symbols: 0, deadline };
    }
  }

  // A8(a): the window is this grading day's 16:00 UTC, recomputed now — not
  // a stamp from whenever the state happened to be created.
  const windowClosesAt = windowCloseMs(nowMs, config.VALIDATOR_WINDOW_CLOSE_HOUR_UTC);
  state.windowClosesAt = windowClosesAt;
  // ...and it never closes a session that has not been tried. A first
  // invocation at or after 16:00 falls through and makes its attempt; the
  // next one closes. `unpublished` must mean the vendor was asked.
  if (nowMs >= windowClosesAt && state.pendingSymbols.length && (state.attempts || 0) > 0) {
    // A8(b): each pending symbol carries WHY it is unvalidated — the last
    // failure this session saw, not a blanket 'unpublished'.
    const lastReason = state.lastFailure?.reason === 'transport_error' ? 'transport_error' : 'unpublished';
    const finalState = { ...state, status: 'window_closed', windowClosedAt: nowMs, unvalidated: state.pendingSymbols.map((s) => ({ sym: s, reason: lastReason, ...(lastReason === 'transport_error' ? { httpStatus: state.lastFailure?.httpStatus ?? null, error: state.lastFailure?.error ?? null } : {}) })), updatedAt: nowMs };
    await stateRef.set(finalState);
    await validationRef(db, gradeDate).set(aggregateValidation(state.results || {}, { etDate: gradeDate, calcVersion: config.CALC_VERSION, policyVersion: config.POLICY_VERSION, firstPublishHourUtc: state.firstPublishHourUtc, status: 'window_closed', unvalidated: finalState.unvalidated, computedAt: nowMs }));
    return { gradeDate, status: 'window_closed', unvalidated: state.pendingSymbols.length, deadline };
  }

  // Bars unpublished? Probe with the first pending symbol (5 units either way).
  const startedAt = nowMs;
  const budgetEnd = startedAt + config.VALIDATOR_BUDGET_MS;
  const calcState = await loadCalcState(db, gradeDate);
  const views = await listViewsForSession(db, session);
  const viewsBySym = {};
  for (const v of views) for (const sym of Object.keys(v.symbols || {})) (viewsBySym[sym] ||= []).push(v);
  const docs = await loadActionableDocs(db, gradeDate, state.pendingSymbols.slice(0, config.VALIDATOR_SYMBOLS_PER_INVOCATION));
  const results = { ...(state.results || {}) };
  const done = [...state.doneSymbols];
  const pending = [...state.pendingSymbols];
  let units = 0; let validated = 0; let failure = null;
  while (pending.length && validated < config.VALIDATOR_SYMBOLS_PER_INVOCATION && now() < budgetEnd) {
    const sym = pending[0];
    const bars = await fetchIntraday1mBars({ apiKey, vendorSymbol: toVendorStock(sym), fromSec: Math.floor(session.openMs / 1000), toSec: Math.floor(session.closeMs / 1000) + 60, fetchImpl, timeoutMs: config.FETCH_TIMEOUT_MS });
    units += bars.units;
    // A8(b): a non-2xx or a timeout is a TRANSPORT failure, not "the vendor
    // has not published yet". Collapsing them made an expired API key read
    // as vendor latency in the one metric §10.5 exists to produce — and
    // §10.6's qualification calendar depends on those reasons.
    if (!bars.ok) {
      failure = { reason: 'transport_error', httpStatus: bars.status ?? null, error: bars.error ?? null };
      break;
    }
    if (!bars.bars?.length) { failure = { reason: 'unpublished', httpStatus: bars.status ?? null, error: null }; break; }
    // Only a real publication sets the hour the vendor first published.
    if (state.firstPublishHourUtc === null) state.firstPublishHourUtc = new Date(now()).getUTCHours();
    // A5: named for what it is — the vendor's cumulative session volume on
    // the LAST QUOTE THE ACCUMULATOR ACCEPTED, not an end-of-day volume.
    const quoteCumulativeVolume = calcState.accumulators?.[sym]?.lastAcceptedVolume ?? null;
    results[sym] = validateSymbolSession({ sym, bars: bars.bars, session, doc: docs[sym] || null, quoteCumulativeVolume, views: viewsBySym[sym] || [], fireTicksOf, calcVersion: config.CALC_VERSION, policyVersion: config.POLICY_VERSION });
    pending.shift(); done.push(sym); validated += 1;
  }
  if (units > 0) await recordUnits(db, { etDate: todayEt, units, unitsBySource: { intraday_1m_validate: units }, sweepId: `validate-${gradeDate}`, now });
  const status = pending.length ? 'in_progress' : 'done';
  // A8(b): the last failure is remembered so `window_closed` can say WHY,
  // and cleared once a symbol validates so a transient 5xx does not haunt a
  // session that later succeeded.
  const nextState = {
    ...state, status, pendingSymbols: pending, doneSymbols: done, attempts: state.attempts + 1, results,
    lastAttemptAt: nowMs, windowClosesAt,
    lastFailure: failure ?? (validated > 0 ? null : state.lastFailure ?? null),
    lastAttemptUnpublished: failure?.reason === 'unpublished',
    lastAttemptTransportError: failure?.reason === 'transport_error',
    updatedAt: now(),
  };
  await stateRef.set(nextState);
  if (status === 'done') {
    const doc = aggregateValidation(results, { etDate: gradeDate, calcVersion: config.CALC_VERSION, policyVersion: config.POLICY_VERSION, firstPublishHourUtc: state.firstPublishHourUtc, status: 'done', computedAt: now() });
    await validationRef(db, gradeDate).set(doc);
    // Trailing-10 over the reported documents, this session included (§10.5).
    const trailing10 = await trailingRollup({ db, gradeDate, calendar, n: 10 });
    await validationRef(db, gradeDate).update({ trailing10 });
  }
  return { gradeDate, status, validated, pending: pending.length, unpublished: failure?.reason === 'unpublished', transportError: failure?.reason === 'transport_error' ? { httpStatus: failure.httpStatus, error: failure.error } : null, units, firstPublishHourUtc: state.firstPublishHourUtc, deadline };
}

/**
 * §10.5 — the metrics the trailing rollup carries forward. Exported so the
 * suite can assert, against ONE source rather than a copied list, that every
 * one of them is a qualification aggregate (addendum A / review R1).
 */
export const TRAILING_ROLLUP_METRICS = Object.freeze([
  'p95AbsResidualOverPrice', 'overallDisagreement', 'falseStrikeRate', 'missedStrikeRate',
  'nearThresholdDisagreement', 'replayedExitDisagreement', 'sma20P95AbsResidualOverPrice',
  'macdEventAgreement', 'quoteCumulativeVolumeRatio',
]);

/**
 * §10.5 trailing-N rollup over the previous sessions' reported documents.
 *
 * It averages the TOP-LEVEL keys of each day's document, which since addendum
 * A are the qualification aggregate — computed over `qualification.included`
 * sessions only (validator.js `aggregateValidation`). It must never reach
 * into `diagnosticAllSymbols`: that block deliberately includes sessions the
 * §10.2 check excluded, and carrying them into the rollup is exactly the
 * defect R1 named.
 */
export async function trailingRollup({ db, gradeDate, calendar, n = 10 }) {
  const dates = [];
  let d = gradeDate;
  for (let i = 0; i < n && d; i++) { dates.push(d); d = calendar.getPreviousSessionDate(d); }
  const docs = [];
  for (const date of dates) { const snap = await validationRef(db, date).get(); const data = dataOf(snap); if (data && data.status === 'done') docs.push(data); }
  const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
  const mean = (key) => { const v = docs.map((x) => x[key]).filter(isNum); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const unavailable = {};
  const out = { sessions: docs.length, dates: docs.map((x) => x.etDate) };
  for (const key of TRAILING_ROLLUP_METRICS) {
    const m = mean(key);
    if (m === null) unavailable[key] = docs.length ? 'no_sessions_with_metric' : 'no_completed_sessions';
    out[key] = m;
  }
  out.eventCounts = docs.reduce((a, x) => ({ ourEvents: a.ourEvents + (x.eventCounts?.ourEvents || 0), refEvents: a.refEvents + (x.eventCounts?.refEvents || 0), agreed: a.agreed + (x.eventCounts?.agreed || 0), evaluations: a.evaluations + (x.eventCounts?.evaluations || 0) }), { ourEvents: 0, refEvents: 0, agreed: 0, evaluations: 0 });
  out.unavailable = unavailable;
  return out;
}
