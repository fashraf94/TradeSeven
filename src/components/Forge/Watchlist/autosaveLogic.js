// src/components/Forge/Watchlist/autosaveLogic.js
//
// Sprint 6 Phase 4B — pure decision logic for the watchlist auto-save hook.
// Kept React-free and timer-free so the debounce / abort / rate-limit / no-op
// rules can be unit-tested directly.

// Deep equality for the auto-save field shapes — strings and arrays of
// ticker / condition objects.
function deepEqual(a, b) {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((x, i) => deepEqual(x, b[i]));
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ak = Object.keys(a);
    const bk = Object.keys(b);
    if (ak.length !== bk.length) return false;
    return ak.every((k) => deepEqual(a[k], b[k]));
  }
  return false;
}

// True when every field present in `pending` already matches `confirmed` —
// i.e. the queued save is a no-op and the PATCH can be skipped.
export function fieldsEqual(pending, confirmed) {
  if (!pending) return true;
  return Object.keys(pending).every((k) => deepEqual(pending[k], confirmed?.[k]));
}

// Merge a new partial edit into the pending-save payload (later edit wins).
export function mergePending(pending, patch) {
  return { ...(pending || {}), ...patch };
}

// Drop save timestamps that have aged out of the rate-limit window.
export function pruneTimestamps(timestamps, now, windowMs) {
  return timestamps.filter((t) => now - t < windowMs);
}

// Client-side rate-limit guard — true when another save may fire now without
// exceeding `limit` saves within the trailing `windowMs`. Sits just under the
// PATCH endpoint's 30/60s server limit so the UI never trips a 429.
export function canSaveNow(timestamps, now, { limit, windowMs }) {
  const recent = timestamps.filter((t) => now - t < windowMs);
  return recent.length < limit;
}

// Save-indicator state machine. States: idle | saving | saved | error.
export function nextSaveState(current, event) {
  switch (event) {
    case 'flush_start':
      return 'saving';
    case 'success':
      return 'saved';
    case 'error':
      return 'error';
    case 'fade':
      // The "Saved" badge fades to idle — but only when a newer save hasn't
      // already moved us back into 'saving' or 'error'.
      return current === 'saved' ? 'idle' : current;
    default:
      return current;
  }
}
