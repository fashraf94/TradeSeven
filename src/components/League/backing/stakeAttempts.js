// src/components/League/backing/stakeAttempts.js
//
// Backing Amendment D R6 (Oct 18, 2026 — Astra's BKG-004): ONE CONFIRM IS ONE
// REQUEST UNTIL IT RESOLVES.
//
// THE DEFECT THIS CLOSES. Every Confirm used to mint a fresh request id. A
// stake that COMMITTED but whose reply was lost (a dropped connection, or a
// Vercel timeout's non-JSON 504 after the commit) showed "No connection. Try
// again.", and the next press was a NEW request — a second debit. The server
// side was always sound: the same id replays the original success and writes
// nothing (backingStake.js, the replay probe). What was missing is the client
// keeping the id.
//
// THE ATTEMPT. `{ requestId, amount }`, keyed by the viewer, the pod and the
// team (`stakeAttemptKey`). It is recorded BEFORE the request leaves and
// cleared only by a DEFINITIVE outcome — a success, or a typed refusal. An
// AMBIGUOUS outcome (`stakeOutcomeAmbiguous`) leaves it in place, and the only
// way forward is "Check again", which resends the identical request.
//
// WHY IT LIVES HERE AND NOT IN THE CONTROL. Since PR #936 the stake control
// remounts on every entry (BackingDesk's / BackingScreen's per-entry key), so
// state inside it dies with each "Back to the card". This module is the one
// home that outlives a remount: an in-memory Map, mirrored to `sessionStorage`
// so a reload in the same tab finds it too. EVERY storage access is wrapped:
// storage can be absent (a private window, a blocked origin) or throw, and
// the Map alone still gives the remount guarantee.
//
// A SECOND TAB sees nothing of it: `sessionStorage` is per tab by definition,
// so another tab's form is fresh and its Confirm is its own request. That is
// stated in the Amendment D build report rather than papered over here.
//
// Zero-import and pure apart from the Map and the storage it names.

/** The `sessionStorage` key prefix — one entry per attempt. */
export const STAKE_ATTEMPT_STORAGE_PREFIX = 'backing.stakeAttempt:';

const memory = new Map();
// Keys whose request is IN FLIGHT right now, and who wants to hear about a
// key (the safety-fix-1 review's HON-4): a control that unmounts mid-flight
// keeps running its request, and the control mounted in its place must show
// "being confirmed" — not "we couldn't confirm" — and learn the answer when
// it lands.
const inFlight = new Set();
const listeners = new Map();
function notify(key) {
  for (const fn of [...(listeners.get(key) ?? [])]) {
    try { fn(); } catch { /* one listener never stops the others */ }
  }
}

/** Hear every change to `key`'s attempt (saved, cleared, in flight or not). Returns the unsubscribe. */
export function subscribeStakeAttempt(key, fn) {
  const set = listeners.get(key) ?? new Set();
  set.add(fn);
  listeners.set(key, set);
  return () => {
    set.delete(fn);
    if (set.size === 0) listeners.delete(key);
  };
}

/** Mark `key`'s request as in flight (or landed). */
export function markStakeAttemptInFlight(key, on) {
  if (on) inFlight.add(key); else inFlight.delete(key);
  notify(key);
}

/** Is a request for `key` in flight right now (in this tab)? */
export function stakeAttemptInFlight(key) {
  return inFlight.has(key);
}

/** The attempt's key: the viewer, the pod, the team — injective (JSON), never a bare join. */
export function stakeAttemptKey(uid, groupId, teamOdUserId) {
  return JSON.stringify([uid ?? null, groupId ?? null, teamOdUserId ?? null]);
}

const isAttempt = (a) => a != null && typeof a === 'object'
  && typeof a.requestId === 'string' && a.requestId.length > 0 && a.requestId.length <= 200
  && Number.isInteger(a.amount) && a.amount > 0;

function session() {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

/** The unresolved attempt for `key`, or null. Memory first, then this tab's storage. */
export function readStakeAttempt(key) {
  if (memory.has(key)) return memory.get(key);
  try {
    const raw = session()?.getItem(STAKE_ATTEMPT_STORAGE_PREFIX + key);
    if (typeof raw === 'string') {
      const parsed = JSON.parse(raw);
      if (isAttempt(parsed)) {
        const attempt = { requestId: parsed.requestId, amount: parsed.amount };
        memory.set(key, attempt);
        return attempt;
      }
    }
  } catch {
    // Unreadable storage is no attempt in storage; the Map still answers.
  }
  return null;
}

/** Record an attempt that has not resolved. */
export function saveStakeAttempt(key, attempt) {
  if (!isAttempt(attempt)) return;
  const current = memory.get(key);
  const value = current && current.requestId === attempt.requestId && current.amount === attempt.amount
    ? current
    : { requestId: attempt.requestId, amount: attempt.amount };
  memory.set(key, value);
  try {
    session()?.setItem(STAKE_ATTEMPT_STORAGE_PREFIX + key, JSON.stringify(value));
  } catch {
    // A full or blocked storage keeps the attempt in memory only.
  }
  notify(key);
}

/** A definitive outcome: the attempt is over. */
export function clearStakeAttempt(key) {
  memory.delete(key);
  try {
    session()?.removeItem(STAKE_ATTEMPT_STORAGE_PREFIX + key);
  } catch {
    // Nothing to clear where storage cannot be reached.
  }
  notify(key);
}

/**
 * Forget the in-memory copies — what a page reload does to the Map (and to
 * the in-flight marks). The mirrored `sessionStorage` entries survive it. A
 * seam for the suites (a reload row), never called by a surface.
 */
export function forgetStakeAttemptMemory() {
  memory.clear();
  inFlight.clear();
}

/**
 * The HTTP statuses the stake endpoint REFUSES with once it has judged the
 * request (api/tournament/backing-stake.js): 400 for a body it read, 403 for
 * eligibility, 409 for every state refusal — the window, the cap, the ledger,
 * `pool_full`. A refusal that reached the stake's replay probe would have
 * answered a committed request as its success, so one of these ends the
 * attempt.
 */
const DECIDED_REFUSAL_STATUSES = new Set([400, 403, 409]);

/**
 * Did this stake call end WITHOUT a definitive answer? (R6.) A dropped
 * connection (`network`), any `server_error` — a timeout, a 5xx or a body
 * that was not JSON, which `backingService.call` maps there — an error with
 * no code at all (nothing the server said), and any refusal from the DOOR in
 * front of the stake rather than the stake itself: sign-in (401), the rate
 * limit (429), a route that is dark (404) or any other status the stake
 * endpoint never refuses with. None of those judged the request, and the
 * FIRST request of this attempt may have committed — so the attempt keeps
 * its request id, and a later "Check again" can still be answered as a
 * replay. Only the stake's own refusals (`DECIDED_REFUSAL_STATUSES`) are
 * TYPED refusals that end it. (A reply without its stake is ambiguous too;
 * the control raises it as `server_error`.) An error carrying a code and no
 * status at all is read as typed — every real `BackingApiError` carries one.
 */
export function stakeOutcomeAmbiguous(err) {
  const code = err?.code;
  if (typeof code !== 'string' || code.length === 0) return true;
  if (code === 'network' || code === 'server_error') return true;
  return Number.isFinite(err?.status) && !DECIDED_REFUSAL_STATUSES.has(err.status);
}
