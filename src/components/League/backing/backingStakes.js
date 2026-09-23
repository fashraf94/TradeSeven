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

/** The viewer's LIVE stakes on this seat, summed — the per-team cap's base. */
export function stakedOnTeam(pod, odUserId) {
  return (Array.isArray(pod?.myStakes) ? pod.myStakes : [])
    .filter((s) => s?.status === 'live' && s?.teamOdUserId === odUserId)
    .reduce((sum, s) => sum + (Number.isFinite(s.amount) ? s.amount : 0), 0);
}
