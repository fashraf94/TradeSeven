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

/**
 * Does this seat have a GENUINE live observation this tick?
 *
 * `seatAltitude` deliberately FLOORS to the banked value when a live reading is
 * absent, which is right for altitude but ambiguous for sampling: a rival that
 * genuinely reports its banked number and a rival whose poll just failed both
 * resolve to the same scalar. The session trail (Phase 2) must tell them apart —
 * it carries a seat's last OBSERVED value forward rather than re-appending the
 * banked floor, which would draw a live seat diving back to its close as if it
 * had lost the day's gains.
 *
 * Branches on EXACTLY the same conditions as `seatAltitude` above, in the same
 * order — YOU on youLiveScore, a rival on the endpoint map, else not live. The
 * co-located test pins the two together: change one branch and it fails.
 *
 * Pure + node-clean (no React, no clock).
 *
 * @param {string} id - the seat's odUserId
 * @param {Object} ctx - the same context object `seatAltitude` takes
 * @returns {boolean} true when this tick carries a real reading for the seat
 */
export function seatHasLiveSample(id, { youId = null, youLiveScore = null, liveComposites = null } = {}) {
  if (id === youId) return Number.isFinite(youLiveScore);
  return Number.isFinite(liveComposites?.[id]);
}
