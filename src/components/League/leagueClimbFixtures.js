// src/components/League/leagueClimbFixtures.js
//
// Fixtures + the data SEAM for the "Altitude Climb" five-day pod standings
// (next-arc, dev/dark behind LEAGUE_NEXT_ARC_ENABLED). The climb plots each
// player's CUMULATIVE combined standing across the five daily closes of one
// tournament week — four climbers up a dark slope.
//
// FIXTURES-FIRST (the useLeagueState posture): this module is the ONE place a
// future adapter swaps mock → real, and the shapes are chosen so that swap is
// mechanical:
//   • scores[0..4]  ← tournamentGroups.dailyScores.day1..5.closeScores[uid]
//                     .totalPoints (the CUMULATIVE standing at each close;
//                     weekly = the FINAL day's snapshot, NEVER a re-sum — see
//                     api/_utils/tournamentBanking.js). The composite series is
//                     the same field's compositePoints; the chart plots whichever
//                     the adapter feeds in.
//   • CLB_WHY[id]   ← useSpectatedTournamentBattles (owner/completed → full WHY;
//                     non-owner live → concealed). The film room honors that gate.
// Seat identity (name/kind/archName/owner/userBook/agentBook) is REUSED from the
// existing League fixture FIELD — no copy of the book/archetype data.

import { FIELD } from './leagueFixtures';
import { LTOKENS } from './leagueTokens';

// the climb's four-player pod — the East group "you" sit in
export const CLB_ORDER = ['vela', 'atlas', 'helios', 'ember'];
export const CLB_YOU = 'atlas';

// the five gates — weekday/date labels for the trading week (Mon–Fri)
export const CLB_DAYS = [
  { wd: 'MON', d: '6/8' }, { wd: 'TUE', d: '6/9' }, { wd: 'WED', d: '6/10' },
  { wd: 'THU', d: '6/11' }, { wd: 'FRI', d: '6/12' },
];

// running CUMULATIVE standing through each close (NOT a daily delta). The lines
// cross; they go negative; Day 5 is the verdict. (fixture; real ← dailyScores)
export const CLB_SERIES = {
  //          D1     D2     D3     D4     D5
  vela:   [  3.2,   5.8,   5.1,   7.9,   9.4 ],   // wire-to-wire leader; gives back on D3
  atlas:  [ -1.2,   1.4,   4.6,   4.1,   8.7 ],   // YOU — last & negative D1, surges, dips D4, takes 2nd on the close
  helios: [  2.1,   3.0,   4.9,   5.2,   5.0 ],   // CPU — holds 2nd, overtaken by you on Day 5, slips
  ember:  [  0.4,  -0.8,  -1.6,   1.2,   2.3 ],   // CPU — a losing stretch, recovers, stays below the cut
};

// film-room reasoning (own = open; others sealed while live). real ← spectated WHY.
export const CLB_WHY = {
  atlas:  "Wore the drawdown on Monday rather than panic-cut. Flipped the NVDA pick short into the CPI print, then let the agent's chip book run the recovery — the whole week's points landed in the last two closes.",
  vela:   "Claimed the staples capitulation overnight on Day 1 and never gave the lead back. Trimmed into the Day-3 strength a session early — that's the dip — then re-pressed.",
  helios: "Bought confirmed strength, cut weakness fast. Held second for four closes; the Friday tape rotated under the high-beta book and the lead evaporated at the bell.",
  ember:  "Faded the extremes two sessions too early — the reversion never came in time. Defensive book finally caught a bid Thursday, but the hole was already dug.",
};

// ── the vivid four. YOU stay anchored to the app's teal everywhere; the other
//    three take distinct, saturated hues that sing on near-black. NOT muted. ──
export const CLB = {
  atlas:  '#5EEAD4',   // YOU — teal, the anchor
  vela:   '#FF8B5E',   // warm coral
  helios: '#C175F2',   // violet
  ember:  '#B6E84A',   // chartreuse / lime
};
export const clbColor = (id) => CLB[id] || LTOKENS.teal;

// hex → mix helpers: brighter near the summit, cooler (but visible) near sea level
function clbHex(h) { const n = parseInt(h.slice(1), 16); return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }; }
export function clbMix(h, t, a) {
  const x = clbHex(h), y = clbHex(t), m = (p, q) => Math.round(p + (q - p) * a);
  return `rgb(${m(x.r, y.r)},${m(x.g, y.g)},${m(x.b, y.b)})`;
}
export const clbHi = (h) => clbMix(h, '#FFFFFF', 0.34);   // brighter near the summit
export const clbLo = (h) => clbMix(h, '#1A1620', 0.34);   // a touch cooler near sea level

// reduced-motion JS guard — the global CSS reduced-motion rule can't stop a rAF
// counter or a getTotalLength() draw, so the climb's JS motion checks this.
export const clbReduce = () => typeof matchMedia !== 'undefined'
  && matchMedia('(prefers-reduced-motion: reduce)').matches;

// the climb seats: REUSE the real fixture seat identity (name/kind/archName/
// owner/userBook/agentBook) straight from the League FIELD (the goal-state kinds
// — atlas/vela read human, helios/ember read CPU), recolored to the vivid climb
// palette and carrying the 5-day series. No bracket state is built.
export function climbSeats() {
  return CLB_ORDER.map((id) => ({
    ...FIELD[id],
    id,
    you: id === CLB_YOU,
    color: clbColor(id),
    scores: CLB_SERIES[id],
  }));
}

// rank the four at a close (idx 0..4); advancing = top 2 (used only in ranked ctx)
export function clbRankAt(idx) {
  const seats = climbSeats().map((s) => ({ ...s, pscore: s.scores[idx] }));
  return [...seats].sort((a, b) => b.pscore - a.pscore).map((s, i) => ({ ...s, rank: i + 1, advancing: i < 2 }));
}
