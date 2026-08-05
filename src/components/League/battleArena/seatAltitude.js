// src/components/League/battleArena/seatAltitude.js
//
// League Battle View V2 — THE ONE resolver for a seat's CURRENT altitude on the
// climb (Option X, Phase B-client). It generalizes the single-seat live scalar
// (youLiveScore — where ONLY your seat could lift off the banked series) to a
// per-seat live map: any seat can show a live composite this tick.
//
//   • YOU     → youLiveScore (the per-tick client path — your own six + three,
//               recomposed live in buildArenaModel). Option X keeps YOUR seat on
//               this path and NEVER routes it through the endpoint, so even if the
//               endpoint map carries your id, this resolver ignores it for you.
//   • a RIVAL → liveComposites[id] (the read-only server endpoint's per-seat
//               scalar — the only place a rival's owner-scoped agent six can be
//               summed; the B1 hard-stop). Absent/non-finite → banked.
//   • else    → the banked series value (getWeeklyComposite / climb[id][lastIdx]),
//               exactly as today (pre-first-close, off-gate, or endpoint absent).
//
// ClimbArena's `at()` (orb altitude / rank / cut / gap) and buildArenaModel's
// `scoresAtLast` (youRank) BOTH resolve through THIS — one ruler, so the crown,
// the cut line, and your standing can never disagree (§9). The co-located test
// pins BOTH call sites to this function; generalize only one and it breaks.
//
// Pure + node-clean (no React, no clock): a seat id + context in, a number out.

/**
 * @param {string} id - the seat's odUserId
 * @param {Object} ctx
 * @param {string|null} [ctx.youId]
 * @param {number|null} [ctx.youLiveScore] - your live composite this tick (null = banked)
 * @param {Object<string,number>|null} [ctx.liveComposites] - { [rivalId]: liveComposite } from the endpoint
 * @param {number} [ctx.banked] - the seat's banked-series altitude (the fallback floor)
 * @returns {number}
 */
export function seatAltitude(id, { youId = null, youLiveScore = null, liveComposites = null, banked = 0 } = {}) {
  const floor = Number.isFinite(banked) ? banked : 0;
  // YOUR seat is owner-only, per-tick client path — never the endpoint map.
  if (id === youId) {
    return Number.isFinite(youLiveScore) ? youLiveScore : floor;
  }
  const live = liveComposites?.[id];
  return Number.isFinite(live) ? live : floor;
}
