// api/_utils/anthropicRateLimits.js
//
// Evaluator capacity, Build 1 — THE LIMITS ON RECORD, Anthropic half (Part 4;
// founder ruling R3: the organisation's limits are read from the API's own
// response headers and recorded, never looked up by hand). Live from merge.
// Build report docs/audits/20261115_BUILD_EVAL_CAPACITY_1.md §Part 4.
//
// THE HEADERS (Anthropic API documentation, "Rate limits" → "Response
// headers", https://platform.claude.com/docs/en/api/rate-limits, read
// 2026-11-15): `anthropic-ratelimit-requests-limit` / `-remaining`,
// `anthropic-ratelimit-input-tokens-limit` / `-remaining`,
// `anthropic-ratelimit-output-tokens-limit` / `-remaining` (integers; the
// token "remaining" values are rounded to the nearest thousand; the `-reset`
// companions are RFC 3339 instants and are not recorded). The installed SDK
// (@anthropic-ai/sdk 0.71.2) names none of them; it hands the raw `Response`
// back through `APIPromise.asResponse()` (core/api-promise.mjs) and puts a
// failed request's headers on the error (`APIError.headers`, core/error.mjs).
//
// THE SEAM, and why it is this one. Two places were ruled out by pins that
// this build may not edit: the client's construction (its options are pinned
// to `{ apiKey, maxRetries }` plus the capture `fetch`, flag on —
// agent-evaluate.tickCapture.bodies.test.js) and the call literal
// `await anthropic.messages.create(` (agent-evaluate.tickStamps.pins.test.js,
// cryptoSlotVerdict.test.js). So the evaluator wraps the CLIENT IT USES for the
// one call: `observeRateLimits(client).messages.create(body, options)` calls
// the SDK's own `client.messages.create(body, options)` — same arguments, by
// reference, so the request bytes cannot differ — and returns the SDK's own
// promise. Beside it, the wrapper asks that promise for its raw response
// (`asResponse()`), which neither consumes the body nor changes what the call
// site awaits, and reads the headers when it arrives. This works whether tick
// capture is on or off: it never depends on the capture's observing `fetch`.
//
// NEVER INTO THE CALL PATH: every read is wrapped; a failure records nothing
// (the run record shows null). A non-SDK promise (the suites' double) yields
// no headers; a failed one is still counted when its error carries status 429.

/** The six headers read, by the run-record field they feed. */
export const RATE_LIMIT_HEADERS = Object.freeze({
  requestsLimit: 'anthropic-ratelimit-requests-limit',
  requestsRemaining: 'anthropic-ratelimit-requests-remaining',
  inputTokensLimit: 'anthropic-ratelimit-input-tokens-limit',
  inputTokensRemaining: 'anthropic-ratelimit-input-tokens-remaining',
  outputTokensLimit: 'anthropic-ratelimit-output-tokens-limit',
  outputTokensRemaining: 'anthropic-ratelimit-output-tokens-remaining',
});

function headerValue(headers, name) {
  if (!headers) return null;
  if (typeof headers.get === 'function') return headers.get(name);
  if (typeof headers === 'object') return headers[name] ?? null;
  return null;
}

/** A header's value as a non-negative integer, or null. */
function toCount(raw) {
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim();
  if (!/^\d+$/.test(text)) return null;
  const n = Number(text);
  return Number.isSafeInteger(n) ? n : null;
}

/**
 * The six values from a response's headers, each a number or null. Never
 * throws: a headers object whose read throws gives all nulls.
 */
export function parseRateLimitHeaders(headers) {
  const out = {};
  for (const [field, name] of Object.entries(RATE_LIMIT_HEADERS)) {
    let value = null;
    try { value = toCount(headerValue(headers, name)); } catch { value = null; }
    out[field] = value;
  }
  return out;
}

// ── run windows ─────────────────────────────────────────────────────────────
// A window collects every observation made while it is open. The evaluator
// opens one per invocation and closes it into its run record. An observation
// reaches every open window (see the limit on writeEvalRunRecord).
const openWindows = new Set();

function emptyWindow() {
  return {
    requestsLimit: null,
    inputTokensLimit: null,
    outputTokensLimit: null,
    minRequestsRemaining: null,
    minInputTokensRemaining: null,
    minOutputTokensRemaining: null,
    responses429: 0,
  };
}

export function openRateLimitWindow() {
  const window = emptyWindow();
  openWindows.add(window);
  return window;
}

/** The run record's `anthropic` block — a copy; the window stops collecting. Idempotent. Never throws. */
export function closeRateLimitWindow(window) {
  try {
    if (!window) return null;
    openWindows.delete(window);
    return { ...window };
  } catch {
    return null;
  }
}

const lower = (current, next) => (next === null ? current : current === null ? next : Math.min(current, next));

/**
 * One response (or failed request): its headers and HTTP status. Limits keep
 * the LOWEST value seen in the window (the most restrictive limit in force
 * during the run); remaining values keep their minimum; a 429 is counted.
 * Never throws.
 */
export function recordRateLimitObservation({ headers = null, status = null } = {}) {
  try {
    const seen = parseRateLimitHeaders(headers);
    for (const window of openWindows) {
      window.requestsLimit = lower(window.requestsLimit, seen.requestsLimit);
      window.inputTokensLimit = lower(window.inputTokensLimit, seen.inputTokensLimit);
      window.outputTokensLimit = lower(window.outputTokensLimit, seen.outputTokensLimit);
      window.minRequestsRemaining = lower(window.minRequestsRemaining, seen.requestsRemaining);
      window.minInputTokensRemaining = lower(window.minInputTokensRemaining, seen.inputTokensRemaining);
      window.minOutputTokensRemaining = lower(window.minOutputTokensRemaining, seen.outputTokensRemaining);
      if (status === 429) window.responses429 += 1;
    }
  } catch { /* never into the call path */ }
}

function noteCall(call) {
  try {
    if (call && typeof call.asResponse === 'function') {
      call.asResponse().then(
        (response) => recordRateLimitObservation({ headers: response?.headers, status: response?.status }),
        (err) => recordRateLimitObservation({ headers: err?.headers, status: err?.status }),
      );
    } else if (call && typeof call.then === 'function') {
      Promise.resolve(call).then(() => {}, (err) => recordRateLimitObservation({ headers: err?.headers, status: err?.status }));
    }
  } catch { /* never into the call path */ }
}

/**
 * The evaluator's client for its one model call, observed. Only
 * `messages.create` is exposed — the only member the evaluator uses.
 */
export function observeRateLimits(client) {
  return {
    messages: {
      create: (body, options) => {
        const call = client.messages.create(body, options);
        noteCall(call);
        return call;
      },
    },
  };
}
