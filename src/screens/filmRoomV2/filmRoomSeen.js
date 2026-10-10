// src/screens/filmRoomV2/filmRoomSeen.js
//
// Film Room v2 — THE FIRST-OPEN NOTICE, ONCE PER VIEWER (spec V1.2 §7;
// Amendment E BA-49). The app's existing seen-once convention is the
// round-boundary acknowledgement (src/utils/roundBoundaryAck.js): a JSON map
// of id → true in localStorage, every access in try/catch. Here the id is the
// VIEWER (their uid), and the mark is written when the notice is SHOWN — not
// when it is dismissed, as the round-boundary card does — because the spec's
// rule is "shows once": a viewer who leaves without tapping "Got it" has seen
// it, and never sees it again on this device. NO server write — purely local
// UX state.
//
// Storage unavailable (private mode, disabled, quota): reads degrade to "not
// seen" — the notice SHOWS, never suppressed by a storage failure — and writes
// do nothing. Never throws.

export const FIRST_OPEN_KEY = 'ft.filmRoom.v2.firstOpenSeen';

function readSeenMap() {
  try {
    const raw = globalThis.localStorage?.getItem(FIRST_OPEN_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

const viewerKey = (viewerId) => (typeof viewerId === 'string' && viewerId ? viewerId : 'anonymous');

/** Has this viewer been shown the first-open notice? */
export function hasSeenFirstOpen(viewerId) {
  return readSeenMap()[viewerKey(viewerId)] === true;
}

/** Record that this viewer has been shown it (idempotent; a no-op if storage fails). */
export function markFirstOpenSeen(viewerId) {
  try {
    const map = readSeenMap();
    const k = viewerKey(viewerId);
    if (map[k] === true) return;
    map[k] = true;
    globalThis.localStorage?.setItem(FIRST_OPEN_KEY, JSON.stringify(map));
  } catch {
    /* storage unavailable — the notice will simply show again */
  }
}
