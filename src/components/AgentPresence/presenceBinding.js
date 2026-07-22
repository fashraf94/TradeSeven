// src/components/AgentPresence/presenceBinding.js
//
// Agent Presence — the READ-ONLY BINDING (pure, node-clean, unit-tested). This is the
// layer the founder review cares about: it maps REAL runtime state the surface already
// renders onto the presence's three inputs (disposition, standing, events). It computes
// NO scoring — it consumes the exact value the mounted surface's orb/scoreboard shows.
//
// GATE 1 (bind to the rendered value): standing is derived from the SAME numbers the
// surface renders — league `youRank` (the crown/altitude the orb ranks by), 1v1
// `displayPlayerScore`/`displayOpponentScore` (the two AnimatedScores + the tug-of-war).
// No parallel computeComposite/calculateAssetScoreV3 here.
//
// GATE 2 (read-only plumbing): nothing here subscribes to anything. The agent identity
// (archetype/colour) arrives as the value the surface ALREADY resolved via its own
// useAgent/model — the binding adds no agent-doc read, so it can never change what a
// surface resolves.
//
// CADENCE (finding 13): the league standing binds to `youRank`, which the arena steps
// with the banked climb in ranked mode and glides with youLiveScore in training — the
// presence never invents a standing between banked days; it shows exactly what the
// scoreboard shows.

import { EVENT_TIER } from './faceMoves';

// ── archetype → disposition (reflex temperament, NOT strategy) ───────────────
// The six canonical agent-doc archetype code-ids (api/_utils/agentArchetypeConfig.js —
// momentum_chaser, analyst, diversifier, contrarian, degen, guardian) mapped onto the
// three design dispositions. This is a REFLEX mapping (how the face twitches), not a
// trading claim; it reads only the display `archetype` field and has zero scoring
// effect, so it is freely tunable. Accepts either the code-id or a display label
// ("Capital Preserver", "Trend Follower") by normalizing case/whitespace/punctuation.
const DISPOSITION_BY_ARCHETYPE = {
  // risk-on / high-activity → speculator reflexes (fast, jittery, high amplitude)
  degen: 'speculator',
  speculator: 'speculator',
  momentumchaser: 'speculator',   // Trend Follower — chases strength, rotates actively
  trendfollower: 'speculator',
  // risk-off / low-activity → capital-preserver reflexes (calm, guarded, slow)
  guardian: 'capital-preserver',
  capitalpreserver: 'capital-preserver',
  diversifier: 'capital-preserver', // stays broad, lets the spread sit — placid
  // deliberate / measured → neutral baseline
  analyst: 'neutral',
  fundamentalinvestor: 'neutral',
  contrarian: 'neutral',
};

/** Normalize an archetype code-id or display label to a disposition key. */
export function archetypeToDisposition(archetype) {
  if (!archetype || typeof archetype !== 'string') return 'neutral';
  const key = archetype.toLowerCase().replace(/[\s_-]+/g, '');
  return DISPOSITION_BY_ARCHETYPE[key] || 'neutral';
}

const TEAL = '#5EEAD4';

/** The agent's DNA colour (single accent), from the already-resolved agent doc. */
export function resolveAccent(agent) {
  return (agent && (agent.primaryColor || (Array.isArray(agent.avatarColors) && agent.avatarColors[0]))) || TEAL;
}

const clamp1 = (x) => Math.max(-1, Math.min(1, x));

// ── standing derivations (each binds to a RENDERED value) ────────────────────

/**
 * League standing from the rendered rank (Gate 1: youRank is what the arena's orb/
 * crown ranks by — buildArenaModel ranks youRank BY youLiveScore, so this agrees with
 * the altitude by construction). rank 1 → +1 (well ahead), last → -1 (well behind).
 * @param {number} rank 1-based
 * @param {number} seatCount total seats (>=2)
 * @returns {number} standing in [-1, 1]
 */
export function standingFromRank(rank, seatCount) {
  const r = Number(rank);
  const n = Number(seatCount);
  if (!Number.isFinite(r) || !Number.isFinite(n) || n < 2 || r < 1) return 0;
  return clamp1(1 - (2 * (r - 1)) / (n - 1));
}

/**
 * 1v1 / training standing from the two rendered scores. Binds to the SAME pair the
 * screen shows (displayPlayerScore vs displayOpponentScore) — the signed share mirrors
 * the rendered tug-of-war and agrees in sign with `isLeading` (my >= opp) by construction.
 * Both-negative (both losing) resolves to who is less-bad, exactly like the bar.
 * @returns {number} standing in [-1, 1]
 */
export function standingFromDuel(playerScore, opponentScore) {
  const my = Number(playerScore);
  const opp = Number(opponentScore);
  if (!Number.isFinite(my) || !Number.isFinite(opp)) return 0;
  const denom = Math.abs(my) + Math.abs(opp);
  if (denom === 0) return 0;
  return clamp1((my - opp) / denom);
}

// ── events: map real client-derived signals → presence reactions ─────────────
// Only signals with a REAL source (Phase 0) are mapped. DROPPED (no real source, never
// faked): agent-speaking; a structured *server-side* "agent is reading the desk" state;
// and structured win/loss (battle status is only active/completed). NOTE the command
// surface's one-shot 'reading' reaction is NOT this dropped signal — it fires off the
// client's own brief-fetch loading flag (useDailyRegimeBrief().loading), the SAME signal
// that already drives the orb's 'reading' state, so it is honest, not invented.

const TONE = { good: 'good', bad: 'bad', neutral: 'neu' };
const toneOf = (t) => TONE[t] || 'neu';

// leagueBeats kind (edge|hit|swap|danger|claim|lead|flip) → design event.
// leagueBeats.TRANSITION collapses star-state 'busted' AND 'danger' into beat 'danger'
// (the loudest down-beat), and 'hit'/'edge' into 'hit'/'edge'.
const BEAT_EVENT = {
  hit: 'thresholdgood',    // a bagger line crossed
  edge: 'thresholdnear',   // approaching a bagger line
  danger: 'thresholdbad',  // busted / inside the bust zone — the loud down-beat
  swap: 'swap',            // agent swapped a symbol
  claim: 'swap',           // a resolved add/claim changed the lineup
  flip: 'swap',            // a pick flip
  lead: 'standingflip',    // leader change on the climb
};

// Stable content-key for a beat. Beats carry no id/timestamp once returned (leagueBeats
// strips _ts), so identity is content — which means two genuinely distinct beats with an
// identical (kind, star, pts, text) collapse to one key and the second does not fire a
// second reaction. This is a deliberate SAFE UNDER-REACT (it also makes the re-derived
// lead/swap beats de-dup so they never re-fire): it can only ever miss a reaction, never
// invent one, and the collision is rare (e.g. the same symbol swapped twice for the exact
// same locked points). We do NOT modify the shared leagueBeats to add an id (out of scope).
export function beatKey(beat) {
  if (!beat) return null;
  return `${beat.kind}|${beat.star ?? ''}|${beat.pts ?? ''}|${beat.text ?? ''}`;
}

/** One beat → a presence event ({ id, ev, tier, tone }) or null if unmapped. */
export function beatToEvent(beat) {
  if (!beat || !beat.kind) return null;
  const ev = BEAT_EVENT[beat.kind];
  if (!ev) return null;
  return { id: beatKey(beat), ev, tier: EVENT_TIER[ev], tone: toneOf(beat.tone) };
}

/** The league beat stream → presence events (unmapped/duplicate-key beats dropped). */
export function beatsToEvents(beats) {
  if (!Array.isArray(beats)) return [];
  const out = [];
  const seen = new Set();
  for (const b of beats) {
    const e = beatToEvent(b);
    if (e && e.id != null && !seen.has(e.id)) { seen.add(e.id); out.push(e); }
  }
  return out;
}

// 1v1 statusFeed: only swap-class actions are a clean discrete signal (Phase 0).
const SWAP_ACTIONS = new Set(['swap', 'SWAP', 'emergency_swap', 'trade_executed']);

/** 1v1 statusFeed entries → swap events (id from the entry's own timestamp+action). */
export function statusFeedToEvents(statusFeed) {
  if (!Array.isArray(statusFeed)) return [];
  const out = [];
  for (const entry of statusFeed) {
    if (!entry || !SWAP_ACTIONS.has(entry.action)) continue;
    const id = `sf|${entry.timestamp ?? ''}|${entry.action}|${entry.symbolIn ?? ''}|${entry.symbolOut ?? ''}`;
    out.push({ id, ev: 'swap', tier: EVENT_TIER.swap, tone: 'neu' });
  }
  return out;
}
