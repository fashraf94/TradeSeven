// api/_utils/tickCapture/captureBodyObserver.js
//
// Tick capture — STAGE B: the HTTP entity bodies, observed at the fetch
// boundary (spec V1.3 §3; Phase 0 Q1's "Required change").
//
// WHY HERE. Phase 0 established that the real serialization seam is the SDK's
// own JSON encoder (`internal/request-options.js`, `body: JSON.stringify(body)`),
// and that `JSON.stringify(response)` cannot prove equality with the bytes that
// arrived. The only place both entity bodies exist as bytes, without touching
// the installed SDK, is the `fetch` the client was constructed with. The SDK
// calls it as `fetch(url, init)` (client.js `fetchWithTimeout` →
// `this.fetch.call(undefined, url, fetchOptions)`), and `init.body` is the
// UTF-8 string it is about to send. Auth headers are never read.
//
// FIVE RULES, each from Phase 0 Q1:
//   1. NEVER consume the SDK's response stream. We take `response.clone()` and
//      read the CLONE; the SDK's own body is untouched.
//   2. NEVER block the request. The clone's read is started, not awaited — so
//      the observer cannot inflate `callMs`, the transport-hygiene measurement
//      the tick already records.
//   3. A FAILED COPY NEVER FAILS THE REQUEST. Every step is wrapped; the
//      absence is recorded and the response is returned regardless.
//   4. BYTES ARE NEVER RECONSTRUCTED from the parsed object. A copy that did
//      not happen is `copy_failed`, full stop.
//   5. REQUEST-LOCAL, never on the cached client. The holder lives in this
//      module and is begun and ended around the one dispatch; the cached
//      Anthropic client carries the observing function, never the data.
//      Battles are processed serially, so exactly one holder is ever active,
//      and a holder that is not active observes nothing.

/**
 * The holder lives on the TICK'S OWN SCOPE (Astra round 1, F3), never in a
 * module global. A single global was replaced on every `begin` and cleared
 * unconditionally on every `end`, so two overlapping invocations in one warm
 * process could attach A's dispatch to B's holder, or close A's window when B
 * finished. A scope is reachable only from the async chain that opened it.
 */
import { currentCaptureScope, ensureCaptureScope } from './captureContext.js';

/** Open a holder for this tick's dispatch. Returns it for the capture context. */
export function beginBodyCapture() {
  const holder = {
    dispatched: false,
    requestBody: null,
    requestError: null,
    status: null,
    responseTextPromise: null,
    responseError: null,
  };
  ensureCaptureScope().holder = holder;
  return holder;
}

/**
 * Close THIS tick's window. Passing the holder makes the identity check
 * explicit; without it the scope's own holder is closed, which is already
 * unreachable from any other tick.
 */
export function endBodyCapture(holder = null) {
  const scope = currentCaptureScope();
  if (!scope) return null;
  const open = scope.holder;
  if (holder && open !== holder) return open;   // never close someone else's
  scope.holder = null;
  return open;
}

/** The open holder of the CALLING tick, or null. */
export function activeBodyHolder() {
  return currentCaptureScope()?.holder ?? null;
}

/**
 * Wrap a fetch implementation so the one dispatch inside an open window has
 * both entity bodies copied. Outside a window it is a pass-through.
 *
 * @param {Function} [baseFetch] defaults to the global fetch at CALL time, so
 *   the wrapper never captures a stale global at construction.
 */
export function makeObservingFetch(baseFetch) {
  return async function observingFetch(input, init) {
    const fetchImpl = baseFetch || globalThis.fetch;
    const holder = currentCaptureScope()?.holder ?? null;
    if (!holder) return fetchImpl(input, init);

    try {
      const body = init?.body;
      if (typeof body === 'string') {
        // THE OUTGOING ENTITY BODY AS DISPATCHED. Headers — auth included —
        // are never read, here or anywhere in this module.
        holder.requestBody = body;
      } else if (body != null) {
        // A non-string body (a stream, a Blob) is not reconstructed into one.
        holder.requestError = `unsupported_request_body_${typeof body}`;
      }
      // A request that reaches this line IS dispatched, whether or not the
      // transport then succeeds: it is the denominator C-1 measures usable
      // pairs over, and a connection error is a dispatched request with no
      // response body, not an unknown attempt.
      holder.dispatched = true;
    } catch (err) {
      holder.requestError = String(err?.message || err).slice(0, 200);
      holder.dispatched = true;
    }

    const response = await fetchImpl(input, init);

    try {
      holder.status = typeof response?.status === 'number' ? response.status : null;
      // THE INCOMING ENTITY BODY BEFORE SDK PARSING — including a non-2xx and
      // a malformed one, which is exactly when it is worth having. The clone
      // is an independent stream: the SDK still reads its own.
      const copy = response.clone();
      // BYTES FIRST (Astra round 1, F9). `.text()` decodes before anything can
      // hash it, and decoding is lossy in exactly the places a forensic digest
      // matters: a UTF-8 BOM is stripped and invalid sequences become U+FFFD.
      // The clone is read as bytes, the digest is taken from those, and the
      // decode happens only so the body can be STORED as readable text.
      holder.responseTextPromise = copy.arrayBuffer().then(
        (buffer) => {
          const bytes = new Uint8Array(buffer);
          return { ok: true, bytes, text: new TextDecoder('utf-8').decode(bytes) };
        },
        (err) => ({ ok: false, error: String(err?.message || err).slice(0, 200) }),
      );
    } catch (err) {
      // A body that cannot be cloned (already disturbed, or none at all) is
      // RECORDED as absent. Never rebuilt from what the SDK parses next.
      holder.responseError = String(err?.message || err).slice(0, 200);
    }

    return response;
  };
}
