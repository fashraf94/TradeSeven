// src/components/League/backing/backingStakeSignal.js
//
// PRE-1 (the desktop review record) — the viewer's own stakes, announced
// in-page once the server has CONFIRMED them. The Backing screen announces one
// on the stake route's success reply — the reply the stake control renders
// "Backed" from, never a request and never optimistically — and the landing
// strip re-reads its pod list on it: on desktop the strip stays mounted behind
// the full-window Backing host, and it still read "not staked" when the host
// closed. No network, no storage, no timer: a listener set, each listener
// removed by its own unsubscribe. Zero-import, so no suite has to mock it.

const listeners = new Set();

/** Listen for the viewer's confirmed stakes. Returns the unsubscribe. */
export function onStakePlaced(listener) {
  if (typeof listener !== 'function') return () => {};
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Announce a confirmed stake — `reply` is the stake route's success reply. */
export function announceStakePlaced(reply) {
  for (const listener of [...listeners]) {
    try {
      listener(reply);
    } catch (err) {
      console.warn('[backingStakeSignal] a listener failed:', err?.message);
    }
  }
}
