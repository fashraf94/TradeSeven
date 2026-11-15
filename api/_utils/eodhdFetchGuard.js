// api/_utils/eodhdFetchGuard.js
//
// Evaluator capacity, Build 1 — THE EODHD FETCH GUARD (Part 2) and the EODHD
// half of THE LIMITS ON RECORD (Part 4). Build report
// docs/audits/20261115_BUILD_EVAL_CAPACITY_1.md; discovery
// docs/audits/20261115_PHASE0_EVAL_FANOUT.md Part C item 10.
//
// Every EODHD request in api/_utils/marketDataCache.js goes through
// `eodhdFetch(url, kind)`. Two halves:
//
// COUNTING — always on. The process keeps a running count of requests by kind
// (eod, realTime, intraday, other), of non-2xx responses (429, 5xx, other) and
// of timeouts. The evaluator records the difference over its run. Counting only
// reads `response.status`; it never touches the body, the promise the caller
// awaits, or a rejection.
//
// GUARDING — EODHD_FETCH_GUARD_ENABLED (false at merge). Flag off, the request
// is `fetch(url)` exactly as before: the same URL, one argument, no signal, no
// wait, and the caller awaits the very promise `fetch` returned. Flag on:
//   · a process-wide limit of EODHD_FETCH_CONCURRENCY (32) requests in flight,
//     shared by every caller in the process, first come first served;
//   · a per-request timeout of EODHD_FETCH_TIMEOUT_MS (10 s), counted from
//     DISPATCH (after the request leaves the queue, so a wait in the queue
//     never eats it) to the END OF THE BODY: the body is read inside the
//     window and handed back as a buffered Response, so the caller's own
//     `response.json()` can no longer hang;
//   · a timeout throws an Error, so it reaches exactly the path a network
//     error reaches today (each caller's existing catch).
// The timer is a plain setTimeout + AbortController (the intraday poller's
// precedent, intraday/intradayFetch.js), not AbortSignal.timeout, so test fake
// timers drive it.

import { EODHD_FETCH_GUARD_ENABLED } from '../../src/config/featureFlags.js';

/** Flag on: the per-request bound, dispatch → end of body. */
export const EODHD_FETCH_TIMEOUT_MS = 10_000;

/**
 * Flag on: requests in flight at once, process-wide. Why 32 (report §Part 2):
 * one agent-mode check fans out up to 82 GETs at once (41 symbols × /eod/ +
 * /real-time/) plus 7 intraday requests. At 32 the fan-out runs in about three
 * waves; at a median EODHD round trip of roughly 150–300 ms (ASSUMED — not
 * recorded anywhere) that adds about 0.3–0.6 s to a 13.5 s pre-call phase,
 * while K = 8 lanes at once (≈ 656 GETs) can no longer open 656 sockets
 * together. Below ~16 the waves start to cost seconds; above ~64 a single
 * lane is never limited at all.
 */
export const EODHD_FETCH_CONCURRENCY = 32;

/** The request kinds the counters keep; an unknown kind counts as 'other'. */
export const EODHD_REQUEST_KINDS = Object.freeze(['eod', 'realTime', 'intraday', 'other']);

/** The name a guard timeout's Error carries. */
export const EODHD_TIMEOUT_ERROR_NAME = 'EodhdTimeoutError';

// ── the process counters ────────────────────────────────────────────────────
const counters = {
  requests: { eod: 0, realTime: 0, intraday: 0, other: 0 },
  timeouts: 0,
  non2xx: { 429: 0, '5xx': 0, other: 0 },
};

function countRequest(kind) {
  const key = EODHD_REQUEST_KINDS.includes(kind) ? kind : 'other';
  counters.requests[key] += 1;
}

function countStatus(response) {
  const status = response?.status;
  if (typeof status !== 'number' || (status >= 200 && status < 300)) return;
  if (status === 429) counters.non2xx[429] += 1;
  else if (status >= 500 && status <= 599) counters.non2xx['5xx'] += 1;
  else counters.non2xx.other += 1;
}

/** A copy of the process counters now (plain numbers; safe to keep). */
export function readEodhdCounters() {
  return {
    requests: { ...counters.requests },
    timeouts: counters.timeouts,
    non2xx: { ...counters.non2xx },
  };
}

/**
 * The run record's `eodhd` block: `after − before`, field by field. A missing
 * or malformed `before` reads as zeros. Never throws.
 */
export function eodhdCounterDelta(before, after) {
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  const b = before || {};
  const a = after || {};
  return {
    requests: {
      eod: num(a.requests?.eod) - num(b.requests?.eod),
      realTime: num(a.requests?.realTime) - num(b.requests?.realTime),
      intraday: num(a.requests?.intraday) - num(b.requests?.intraday),
      other: num(a.requests?.other) - num(b.requests?.other),
    },
    timeouts: num(a.timeouts) - num(b.timeouts),
    non2xx: {
      429: num(a.non2xx?.[429]) - num(b.non2xx?.[429]),
      '5xx': num(a.non2xx?.['5xx']) - num(b.non2xx?.['5xx']),
      other: num(a.non2xx?.other) - num(b.non2xx?.other),
    },
  };
}

// ── the process-wide limiter (flag on) ──────────────────────────────────────
let active = 0;
const queue = [];

function acquireSlot() {
  if (active < EODHD_FETCH_CONCURRENCY) {
    active += 1;
    return Promise.resolve();
  }
  // The slot is handed over on release (active stays the same), so a request
  // can never start between a release and the next waiter.
  return new Promise((resolve) => { queue.push(resolve); });
}

function releaseSlot() {
  const next = queue.shift();
  if (next) next();
  else active -= 1;
}

/** In-flight and queued counts (tests and the report's census only). */
export function readEodhdGuardState() {
  return { active, queued: queue.length };
}

const NULL_BODY_STATUSES = new Set([101, 103, 204, 205, 304]);

async function guardedFetch(url) {
  await acquireSlot();
  let released = false;
  const release = () => { if (!released) { released = true; releaseSlot(); } };
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, EODHD_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    countStatus(response);
    const body = await response.arrayBuffer();
    return new Response(NULL_BODY_STATUSES.has(response.status) ? null : body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch (err) {
    if (timedOut) {
      counters.timeouts += 1;
      const timeout = new Error(`EODHD request timed out after ${EODHD_FETCH_TIMEOUT_MS}ms`);
      timeout.name = EODHD_TIMEOUT_ERROR_NAME;
      throw timeout;
    }
    throw err;
  } finally {
    clearTimeout(timer);
    release();
  }
}

/**
 * THE one EODHD request path of marketDataCache.js. `kind` is one of
 * EODHD_REQUEST_KINDS (the call site names it; it never reaches the network).
 *
 * Flag off this is not an async function on purpose: it returns the promise
 * `fetch(url)` returned, after attaching a status counter beside it, so the
 * caller awaits exactly what it awaited before and sees the same rejection.
 */
export function eodhdFetch(url, kind) {
  countRequest(kind);
  if (!EODHD_FETCH_GUARD_ENABLED) {
    const pending = fetch(url);
    if (pending && typeof pending.then === 'function') pending.then(countStatus, () => {});
    return pending;
  }
  return guardedFetch(url);
}
