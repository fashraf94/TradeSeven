// src/components/League/backing/backingStakes.js
//
// Backing Beta PR 4 — the viewer's own stakes on a pod, summed. Zero-import,
// pure over the pod-list entry's `myStakes` (the endpoint's projection of the
// viewer's stakes, and nothing else); the ONE figure an open pool may show
// (Amendment B §B6). Shared by the pod list (the §B6 line), the team card and
// the stake control (the per-team cap's base) so no surface re-derives it.

/** The viewer's LIVE stakes on the pod, summed — the §B6 "Your backing" line. */
export function liveStakeTotal(pod) {
  return (Array.isArray(pod?.myStakes) ? pod.myStakes : [])
    .filter((s) => s?.status === 'live')
    .reduce((sum, s) => sum + (Number.isFinite(s.amount) ? s.amount : 0), 0);
}

/**
 * Is this pod's pool FULL for this viewer? (Amendment D R2.) True when the
 * open pool's document says `full` and the viewer holds NO stake in it — the
 * one viewer the pool can no longer admit. A viewer with a stake there backs
 * as before: a top-up, or another team while the pool is under its document
 * limit (which only the server knows, and refuses `pool_full` past). The pod
 * list's "Full" tag and the team card's closed CTA read this one predicate.
 */
export function poolFullForViewer(pod) {
  if (pod?.pool?.status !== 'open' || pod.pool.full !== true) return false;
  return !(Array.isArray(pod?.myStakes) && pod.myStakes.length > 0);
}

/** The viewer's LIVE stakes on this seat, summed — the per-team cap's base. */
export function stakedOnTeam(pod, odUserId) {
  return (Array.isArray(pod?.myStakes) ? pod.myStakes : [])
    .filter((s) => s?.status === 'live' && s?.teamOdUserId === odUserId)
    .reduce((sum, s) => sum + (Number.isFinite(s.amount) ? s.amount : 0), 0);
}
