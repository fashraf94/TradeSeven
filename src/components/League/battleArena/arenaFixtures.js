// src/components/League/battleArena/arenaFixtures.js
//
// League Battle View V2 — PREVIEW fixtures for the desktop arena (Phase 2, pure +
// node-clean). These back the dev/dark `?battleViewV2=1` preview ONLY (the
// `?leagueClimb=1` precedent — LeagueClimb is fixtures-backed too). They are
// deliberately shaped to the Phase-1 data contracts so the live-data wiring phase
// is a drop-in swap, not a re-shape:
//
//   • star rows match leagueStarMeter.readAgentStar/readUserStar:
//       { tk, tier, dir, mult, banked, points, badge, state, justIn }
//     (state ∈ deriveStarState's output; badge ∈ BAGGER_TIERS/BUST_TIERS labels)
//   • the climb series matches leagueClimbAdapter.buildClimbSeries:
//       { [seatId]: number[] } cumulative-composite per close
//   • beats match leagueBeats.deriveBeats:
//       { kind, text, pts, star, tone:'good'|'bad'|'neutral' }
//
// Values are transcribed from the locked Claude Design's battle-data fixture (the
// Speculator pod: Atlas=you/teal, Vela leads, Helios, Ember). NO scoring math
// lives here — these are illustrative readings, not computed.

export const ARENA_YOU = 'atlas';

// Four seats. `you` is teal; the field carries its own identity hues. Leadership
// is shown by the crown, never by recoloring a seat.
export const ARENA_SEATS = [
  { id: 'vela', name: 'Vela', owner: '@dpark', color: '#F2C14E', kind: 'human', arch: 'Trend Follower' },
  { id: 'atlas', name: 'Atlas', owner: '@you', color: '#5EEAD4', kind: 'you', arch: 'Speculator', you: true },
  { id: 'helios', name: 'Helios', owner: '@s_ng', color: '#B79CED', kind: 'cpu', arch: 'Contrarian' },
  { id: 'ember', name: 'Ember', owner: '@otto', color: '#E8924A', kind: 'cpu', arch: 'Capital Preserver' },
];

// Cumulative composite at each daily close (Mon–Fri). Matches buildClimbSeries:
// the RUNNING standing, never a daily delta. Lines cross; they go negative.
export const ARENA_CLIMB = {
  //          D1     D2     D3     D4     D5
  vela: [3.2, 5.8, 5.1, 7.9, 9.4],
  atlas: [-1.2, 1.4, 4.6, 4.1, 8.7], // YOU — last & negative D1, surges, dips D4, takes 2nd at the close
  helios: [2.1, 3.0, 4.9, 5.2, 5.0],
  ember: [0.4, -0.8, -1.6, 1.2, 2.3],
};

// Pod context + the claim wire. Clocks are seconds (the engine ticks them down).
export const ARENA_POD = Object.freeze({ day: 2, days: 5, watchers: 47, toOpen: 16500, nextClose: 8040 });
export const ARENA_WIRE = Object.freeze({ open: true, closes: 10800, claimsUsed: 0, claimsTotal: 3 });

// The Speculator's voice — greeting + the awaiting line + the live narration.
export const ARENA_VOICE = Object.freeze({
  arch: 'Speculator',
  greet: { kind: 'greeting', text: "We're live. I've got the six, you've got your three and the claim wire. Let's climb." },
  wait: { kind: 'anticipation', text: "Lineup's locked and I'm itching. The second the bell rings, I'm hunting the swing." },
  live: [
    { kind: 'read', t: '32m', text: "PLTR's carrying its weight — letting it run. COIN and SMCI are dead weight, watching for the door." },
    { kind: 'trade', t: '1h', ticker: 'MSTR', text: "Cut SOFI — too quiet for us. MSTR's swinging hard, and that's where our edge is. In." },
    { kind: 'anticipation', t: '4m', ticker: 'MSTR', text: 'MSTR earnings after the bell. If it pops, we jump the field. Holding tight.' },
  ],
});

// The two-way affordance — suggested prompts + answers in the Speculator's voice.
export const ARENA_ASK = Object.freeze([
  { q: "Why'd you cut SOFI?", a: "SOFI was dead weight — barely moving against its range. MSTR swings twice as hard into earnings. I'd rather own the volatility." },
  { q: 'What are you watching?', a: "PLTR — it's a hair off a BaggerBomb, one good tick and it banks. And COIN the other way: if it slips past Bust I'm cutting it." },
  { q: 'Why keep SMCI?', a: "It busted, but a Crash needs −1.5× and it's at −1.2×. One session to stabilize before I eat the bigger penalty." },
]);

// The agent's recent landed move (the "swapped SOFI → MSTR · 1h ago" chip).
export const ARENA_AGENT_MOVE = Object.freeze({ from: 'SOFI', to: 'MSTR', ago: '1h ago' });

// The live drama beats, in the Phase-1 deriveBeats shape (pts are numbers; tone
// is semantic). The engine fires these in order on the preview's live clock.
export const ARENA_BEATS = Object.freeze([
  { kind: 'edge', text: 'PLTR is 0.1× from BaggerBomb', pts: null, star: 'PLTR', tone: 'good' },
  { kind: 'hit', text: 'PLTR hit BaggerBomb', pts: 15, star: 'PLTR', tone: 'good' },
  {
    kind: 'swap', text: 'Your agent swapped SOFI → MSTR', pts: null, star: 'MSTR', tone: 'neutral',
    voice: { kind: 'trade', t: 'now', ticker: 'MSTR', text: "Cut SOFI — too quiet for us. MSTR's swinging hard, and that's where our edge is. In." },
  },
  { kind: 'danger', text: 'COIN slipping toward Bust', pts: null, star: 'COIN', tone: 'bad' },
  { kind: 'claim', text: 'Your GE claim banked', pts: 2, star: 'GE', tone: 'good' },
  { kind: 'lead', text: 'Vela took the lead at the close', pts: null, star: null, tone: 'neutral' },
]);

// ── the nine stars, resolved per state ──────────────────────────────────────
// Each entry carries a live + final reading; we resolve to the flat Phase-1 row
// for the requested state. `awaiting` returns the roster with rest readings (the
// dock renders these dormant). points mirror banked in the preview.
const AGENT = [
  { tk: 'MSTR', tier: 'star', dir: 'long', live: { mult: 0.7, state: 'heating', banked: 0, badge: null, justIn: true }, final: { mult: 2.1, state: 'hit', banked: 100, badge: 'TenBagger' } },
  { tk: 'TSLA', tier: 'core', dir: 'long', live: { mult: 1.3, state: 'hit', banked: 23, badge: 'BaggerBomb' }, final: { mult: 1.6, state: 'hit', banked: 45, badge: 'Double Bagger' } },
  { tk: 'PLTR', tier: 'core', dir: 'long', live: { mult: 0.9, state: 'edge', banked: 0, badge: null }, final: { mult: 1.1, state: 'hit', banked: 23, badge: 'BaggerBomb' } },
  { tk: 'NVDA', tier: 'support', dir: 'long', live: { mult: 0.4, state: 'heating', banked: 0, badge: null }, final: { mult: 0.8, state: 'heating', banked: 0, badge: null } },
  { tk: 'COIN', tier: 'core', dir: 'long', live: { mult: -0.8, state: 'danger', banked: 0, badge: null }, final: { mult: -1.1, state: 'busted', banked: -15, badge: 'Bust' } },
  { tk: 'SMCI', tier: 'support', dir: 'long', live: { mult: -1.2, state: 'busted', banked: -10, badge: 'Bust' }, final: { mult: -1.6, state: 'busted', banked: -20, badge: 'Crash' } },
];
const USER = [
  { tk: 'GE', tier: 'core', dir: 'long', live: { mult: 0.6, state: 'heating', banked: 0, badge: null }, final: { mult: 1.0, state: 'hit', banked: 23, badge: 'BaggerBomb' } },
  { tk: 'AMZN', tier: 'support', dir: 'long', live: { mult: 0.3, state: 'heating', banked: 0, badge: null }, final: { mult: 0.5, state: 'heating', banked: 0, badge: null } },
  { tk: 'VLO', tier: 'support', dir: 'short', live: { mult: -0.4, state: 'quiet', banked: 0, badge: null }, final: { mult: -0.2, state: 'quiet', banked: 0, badge: null } },
];

function resolveStar({ tk, tier, dir, live, final }, state) {
  if (state === 'awaiting') {
    return { tk, tier, dir, mult: 0, banked: 0, points: 0, badge: null, state: 'quiet', justIn: false };
  }
  const v = state === 'complete' ? final : live;
  return {
    tk, tier, dir,
    mult: v.mult,
    banked: v.banked,
    points: v.banked, // preview: a star's total tracks its banked badge points
    badge: v.badge ?? null,
    state: v.state,
    justIn: v.justIn === true && state === 'live',
  };
}

/** The agent's six stars resolved for a state (the teal, watch-only dock). */
export function arenaAgentStars(state) {
  return AGENT.map((s) => resolveStar(s, state));
}

/** The user's three stars resolved for a state (the blue, you-act dock). */
export function arenaUserStars(state) {
  return USER.map((s) => resolveStar(s, state));
}
