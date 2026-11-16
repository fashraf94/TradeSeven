// api/_utils/setupEvidenceSweep/sweep.js
//
// The chart's evidence, PR B — THE DAILY SWEEP (spec of record docs/specs/CHART_EVIDENCE_SPEC_V1.md
// SW-1 – SW-9). One run makes the shared setup-evidence store hold a final record for each ranked
// stock (ALL_TICKERS) for the last completed session, and is safe to repeat:
//
//   1  The flag off → { skipped: true } before any read (SW-6).
//   2  The session is lastCompletedSessionAt(now), the clock the store's own injected function.
//      The calendar cannot say → deferred, no read. A weekend or holiday (`non_session`) →
//      deferred, no read and no provider request: the next trading morning's run catches up.
//   3  The state (plain read): unreadable → deferred, no read, no request (fail closed).
//   4  Every ranked stock in a fixed (sorted) order, four at a time: readSnapshot. A final record
//      is counted (measured or refused, by its own status) and costs no provider request.
//   5  Otherwise, while admission holds, getOrAcquireSnapshot, awaited to its end, with a COUNTING
//      fetchPayload: each provider request is first given its place under the day's cap in a
//      transaction on the state (reserveProviderRequest), then made through the store's own
//      fetchDailyPayload. The cap refused → no request, and the run stops admitting.
//   6  Admission closes on: the deadline (less than one acquisition's reserve left before
//      handlerStart + 240 s), the cap, the unpublished-session brake (eight `missing_bar`
//      retryables in a row, each from a request this run made whose payload lacked the session's own
//      row; any final, read or acquired, breaks the streak), the provider-failure brake (eight transport
//      failures in a row from this run's own requests), or a programming error. A request that takes the
//      cap's last place closes admission at once.
//   7  End of run: one transaction records the run's tallies on the state.
//   8  Counts only, in one health line per run past the gate. A PROGRAMMING ERROR (the store's
//      SetupEvidenceProgrammingError, or any error without a gRPC status code — a TypeError, a plain
//      Error from code — wherever it is thrown, the counter and the run record included) stops the run,
//      is counted and logged, and is THROWN after the record is written: never swallowed.
//
// No model call. The only provider path is the store's own fetchDailyPayload, through the counter.
// `now` is a function returning a Date (production: () => new Date()); `fetchPayload` is a test seam
// (production passes none: the store's default provider). setupEvidenceImportGuard.test.js lists this file.

import { getOrAcquireSnapshot, lastCompletedSessionAt, readSnapshot, ruleKeyOf, SetupEvidenceProgrammingError } from '../setupEvidence/index.js';
import { describeRuleSet } from '../setupEvaluator/thresholds.js';
import { fetchDailyPayload } from '../eodhdDailyWindow.js';
import { ALL_TICKERS } from '../rankingConfig.js';
import {
  DEFERRED_REASONS, HEALTH_LINE_PREFIX, PROVIDER_FAILURE_STREAK_STOP, RETRYABLE_REASONS, TRANSPORT_FAILURE_REASONS, SWEEP_ADMISSION_RESERVE_MS, SWEEP_ADMISSION_WINDOW_MS, SWEEP_CONCURRENCY, SWEEP_DAILY_PROVIDER_CAP,
  SWEEP_HOST, UNPUBLISHED_STREAK_STOP,
} from './constants.js';
import { sweepFlagOn } from './gate.js';
import { closedTally, failureTally, readSweepState, recordRun, reserveProviderRequest } from './state.js';

const bump = (obj, key, n = 1) => { obj[key] = (obj[key] || 0) + n; };
const errorCodeOf = (err) => String(err?.code ?? err?.name ?? 'unknown').slice(0, 40);

/**
 * A programming error: never swallowed (review L1-3). The store's own SetupEvidenceProgrammingError, and any error that
 * carries no numeric gRPC status code: every Firestore (Admin SDK) failure carries one, and the provider's failures never
 * reach here (the store's acquireOnce reads them as fetch_failed). So a TypeError, a ReferenceError, a RangeError or a
 * plain Error thrown by code is a programming error; a transient Firestore failure (UNAVAILABLE 14, ABORTED 10, …) is not.
 */
export function isProgrammingError(err) {
  return err instanceof SetupEvidenceProgrammingError || err?.name === 'SetupEvidenceProgrammingError' || typeof err?.code !== 'number';
}

/** One state transaction at a time in this run: the counter is contended only across instances. */
function serialiser() {
  let tail = Promise.resolve();
  return (fn) => {
    const run = tail.then(fn, fn);
    tail = run.then(() => {}, () => {});
    return run;
  };
}

function emptyCounts() {
  return {
    session: null,
    state: 'not_read',
    names: 0,
    final: { measured: 0, refused: 0 },
    acquired: 0,
    storeCalls: 0,
    providerRequests: 0,
    providerRequestsTotal: null,
    retryable: {},
    pending: 0,
    excluded: 0,
    deferred: {},
    failures: {},
    programmingErrors: 0,
    stateWritten: false,
    ms: 0,
  };
}

/** The run's health line, from its counts. Pure: counts, closed-list keys and the session date only. */
export function healthLineOf(r) {
  const c = r && typeof r === 'object' && r.final ? r : null;
  const health = {
    session: c && typeof c.session === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(c.session) ? c.session : null,
    state: c && ['read', 'absent', 'unreadable', 'not_read'].includes(c.state) ? c.state : null,
    names: c?.names ?? 0,
    final: { measured: c?.final?.measured ?? 0, refused: c?.final?.refused ?? 0 },
    acquired: c?.acquired ?? 0,
    storeCalls: c?.storeCalls ?? 0,
    providerRequests: c?.providerRequests ?? 0,
    providerRequestsTotal: Number.isInteger(c?.providerRequestsTotal) ? c.providerRequestsTotal : null,
    retryable: closedTally(c?.retryable, RETRYABLE_REASONS),
    pending: c?.pending ?? 0,
    excluded: c?.excluded ?? 0,
    deferred: closedTally(c?.deferred, DEFERRED_REASONS),
    failures: failureTally({ ...(c?.failures ?? {}), ...(r?.threw ? { [`unit:${r.threw}`]: 1 } : {}) }),
    programmingErrors: c?.programmingErrors ?? 0,
    stateWritten: c?.stateWritten === true,
    ms: Number.isFinite(c?.ms) ? c.ms : 0,
  };
  return `${HEALTH_LINE_PREFIX} ${JSON.stringify(health)}`;
}

/**
 * One sweep run, then its health line (none when the flag skipped it). A programming error is thrown
 * after the line and the state record.
 *
 * @param {object} p
 * @param {object} p.db Admin Firestore
 * @param {number} p.handlerStartMs the cron handler's start
 * @param {() => Date} [p.now]
 * @param {Function} [p.fetchPayload] the provider read (omitted in production: the store's own default)
 * @param {string[]} [p.symbols] the universe (production: ALL_TICKERS)
 * @param {number} [p.cap] the day's cap (production: SWEEP_DAILY_PROVIDER_CAP)
 * @param {(line: string) => void} [p.log]
 */
export async function runSetupEvidenceSweep(p = {}) {
  const log = typeof p.log === 'function' ? p.log : (line) => console.log(line);
  let out;
  try {
    out = await sweep(p);
  } catch (err) {
    log(healthLineOf({ threw: errorCodeOf(err) }));
    throw err;
  }
  if (out.skipped) return { skipped: true };
  log(healthLineOf(out.counts));
  if (out.error) throw out.error;
  return out.counts;
}

async function sweep({ db, handlerStartMs, now = () => new Date(), fetchPayload, symbols = ALL_TICKERS, cap = SWEEP_DAILY_PROVIDER_CAP } = {}) {
  // 1. THE GATE — before any read.
  if (!sweepFlagOn()) return { skipped: true };

  // 2. THE CLOCK, THE SESSION, THE RULE SET.
  const clock = () => {
    const d = typeof now === 'function' ? now() : null;
    if (!(d instanceof Date) || !Number.isFinite(d.getTime())) throw new TypeError('setupEvidenceSweep: `now` must be a function returning a valid Date');
    return d.getTime();
  };
  const startMs = clock();
  const deadline = (Number.isFinite(handlerStartMs) ? handlerStartMs : startMs) + SWEEP_ADMISSION_WINDOW_MS;
  const counts = emptyCounts();
  const done = (error = null) => { counts.ms = clock() - startMs; return { counts, error }; };
  const cal = lastCompletedSessionAt(startMs);
  if (!cal.ok) { bump(counts.deferred, 'calendar_missing'); return done(); }
  counts.session = cal.session;
  if (cal.relation === 'non_session') { bump(counts.deferred, 'non_session'); return done(); }
  const session = cal.session;
  const ruleSet = describeRuleSet();
  ruleKeyOf(ruleSet); // a malformed deployed rule set is a programming error: throw before any read

  // 3. THE STATE — unreadable means no read and no request this run.
  const st = await readSweepState(db, session);
  counts.state = st.status;
  if (st.status === 'unreadable') { bump(counts.deferred, 'state_unreadable'); return done(); }
  counts.providerRequestsTotal = st.state.providerRequests;

  // 4–6. EVERY RANKED STOCK, FOUR AT A TIME.
  const order = [...new Set(symbols)].sort();
  const serial = serialiser();
  const provider = typeof fetchPayload === 'function' ? fetchPayload : fetchDailyPayload;
  let capClosed = st.state.providerRequests >= cap;
  let stateClosed = false;
  let unpublished = false;
  let streak = 0;
  let providerFailing = false;
  let failStreak = 0;
  let stopped = null; // 'deadline' | 'programming_error': nothing more is read
  let programmingError = null;

  const admissionClosedBy = () => {
    if (programmingError) return 'programming_error';
    if (stateClosed) return 'state_unreadable';
    if (capClosed) return 'cap';
    if (unpublished) return 'unpublished';
    if (providerFailing) return 'provider_failing';
    if (deadline - clock() < SWEEP_ADMISSION_RESERVE_MS) return 'deadline';
    return null;
  };
  /** A final record, by its own status: ok → measured, refused → refused; any other status is a failure, never a verdict. */
  const countFinal = (record) => {
    if (record?.status === 'ok') bump(counts.final, 'measured');
    else if (record?.status === 'refused') bump(counts.final, 'refused');
    else bump(counts.failures, 'read:unknown_status');
  };
  const surface = (err) => { counts.programmingErrors += 1; programmingError ??= err; stopped = 'programming_error'; };

  const unit = async (symbol) => {
    if (!stopped && clock() >= deadline) stopped = 'deadline';
    if (stopped) { bump(counts.deferred, stopped); return; }
    counts.names += 1;
    let record;
    try {
      record = await readSnapshot({ db, session, symbol, ruleSet });
    } catch (err) {
      if (isProgrammingError(err)) { surface(err); return; }
      bump(counts.failures, `read:${errorCodeOf(err)}`);
      return;
    }
    if (record) { countFinal(record); streak = 0; return; } // a final, read or acquired, breaks a streak (review L1-2)

    const closed = admissionClosedBy();
    if (closed) { bump(counts.deferred, closed); return; }

    let fetched = false;
    let refused = null; // why the counter refused this unit's request: no request was made
    let sessionRowSeen = false; // the payload held a row dated on the session itself (review L1-1)
    const countingFetch = async (...args) => {
      let r;
      try {
        r = await serial(() => reserveProviderRequest({ db, session, nowMs: clock(), cap }));
      } catch (err) {
        refused = 'reserve_failed';
        // A bug in the counter is surfaced (review L1-3); a transient Firestore failure is counted. Either way the store is
        // told the request failed, so it releases its lease, and no request is made.
        if (isProgrammingError(err)) surface(err); else bump(counts.failures, `reserve:${errorCodeOf(err)}`);
        throw new Error('setupEvidenceSweep: the request was not counted, so it was not made');
      }
      if (!r.ok) {
        refused = r.reason;
        if (r.reason === 'cap') capClosed = true; else stateClosed = true;
        if (Number.isInteger(r.count)) counts.providerRequestsTotal = r.count;
        throw new Error('setupEvidenceSweep: no place under the cap, so no request');
      }
      counts.providerRequestsTotal = r.count;
      counts.providerRequests += 1;
      if (r.count >= cap) capClosed = true; // this request took the cap's last place: admit no one else (review L2-6)
      fetched = true;
      const payload = await provider(...args);
      sessionRowSeen = Array.isArray(payload) && payload.some((row) => row?.date === session);
      return payload;
    };

    counts.storeCalls += 1;
    let out;
    try {
      out = await getOrAcquireSnapshot({ db, session, symbol, now, fetchPayload: countingFetch, host: SWEEP_HOST });
    } catch (err) {
      if (isProgrammingError(err)) { surface(err); return; }
      bump(counts.failures, `acquire:${errorCodeOf(err)}`);
      return;
    }
    const status = out?.status;
    if (status === 'final') {
      countFinal(out.snapshot);
      if (fetched) { counts.acquired += 1; failStreak = 0; }
      streak = 0;
    } else if (status === 'pending') {
      counts.pending += 1;
    } else if (status === 'retryable') {
      if (refused === 'cap' || refused === 'state_unreadable') { bump(counts.deferred, refused === 'cap' ? 'cap' : 'state_unreadable'); return; }
      if (refused === 'reserve_failed') return; // counted as a failure; no request was made
      bump(counts.retryable, RETRYABLE_REASONS.includes(out.reason) ? out.reason : 'other');
      if (fetched && TRANSPORT_FAILURE_REASONS.includes(out.reason)) {
        failStreak += 1;
        if (failStreak >= PROVIDER_FAILURE_STREAK_STOP) providerFailing = true;
      } else if (fetched) {
        failStreak = 0;
      }
      // Only a session whose own bar is not in the payload is unpublished: a gap INSIDE the window is also
      // `missing_bar` (confirm class), and must not stop the run (review L1-1).
      if (out.reason === 'missing_bar' && fetched && !sessionRowSeen) {
        streak += 1;
        if (streak >= UNPUBLISHED_STREAK_STOP) unpublished = true;
      } else {
        streak = 0;
      }
    } else if (status === 'excluded') {
      counts.excluded += 1;
    } else {
      bump(counts.failures, 'acquire:unknown_status');
    }
  };

  let next = 0;
  const worker = async () => {
    while (next < order.length) {
      const symbol = order[next];
      next += 1;
      try {
        await unit(symbol);
      } catch (err) {
        if (isProgrammingError(err)) surface(err); else bump(counts.failures, `unit:${errorCodeOf(err)}`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(SWEEP_CONCURRENCY, order.length) }, worker)); // every started call is awaited

  // 7. END OF RUN.
  try {
    const rec = await serial(() => recordRun({
      db,
      session,
      nowMs: clock(),
      run: {
        startedAtMs: startMs,
        ms: clock() - startMs,
        complete: counts.final.measured + counts.final.refused === order.length,
        tallies: counts,
      },
    }));
    counts.stateWritten = rec.written === true;
    if (rec.written === true) counts.providerRequestsTotal = rec.providerRequests;
    else bump(counts.deferred, 'state_unreadable');
  } catch (err) {
    if (isProgrammingError(err)) surface(err); else bump(counts.failures, `record:${errorCodeOf(err)}`);
  }
  return done(programmingError);
}
