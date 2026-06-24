// src/components/League/battleArena/arenaEngineCore.js
//
// League Battle View V2 — the live ARENA ENGINE's pure core (Phase 2, pure +
// node-clean). The engine drives the arena's drama: a beat fires (a star hits /
// trembles, an agent swap, a resolved claim, a lead change), which can flare a
// star, send a points token flying up the climb, and prepend the agent's voice.
//
// Kept render-free so it is unit-testable WITHOUT a jsdom/React setup (this repo
// ships none — the SectorRail / WatchlistChat pure-helper precedent). useArenaEngine
// (the hook) is a thin wrapper that holds this state in React and owns the timers;
// ALL of the transition logic lives here and is exercised by arenaEngineCore.test.js.
//
// DETERMINISM: keys are a monotonic counter threaded through state — never
// Date.now()/Math.random() — so a replay is reproducible and the test is stable.

/** Seed the voice lane: the greeting (oldest) under the live script, newest first. */
export function seedVoiceLines(voice) {
  const live = Array.isArray(voice?.live) ? voice.live.map((l, i) => ({ ...l, _k: i + 1 })) : [];
  const seeded = [...live].reverse(); // newest live line first
  if (voice?.greet) seeded.push({ ...voice.greet, t: voice.greet.t || 'now', _k: 0 });
  return seeded;
}

/** The engine's initial state for a given voice script. */
export function makeEngineState(voice) {
  return {
    lines: seedVoiceLines(voice),
    beat: null,
    beatStar: null, // { tk, kind, key } — the star a beat touched
    surge: null,    // { key, pts } — a points/flip token flying up the climb
    flareKey: 0,    // bumps to replay the agent-orb flare on a swap
    claimKey: 0,    // bumps when a claim banks
    _key: 100,      // monotonic key source (deterministic)
  };
}

/**
 * Advance the engine to a beat. Returns a NEW state (immutable); the input is
 * untouched. Beat shape is the Phase-1 deriveBeats contract:
 *   { kind:'edge'|'hit'|'swap'|'danger'|'claim'|'lead'|'flip', text, pts, star, tone, voice? }
 */
export function applyBeat(state, beat) {
  if (!beat) return state;
  let key = state._key;
  const next = { ...state, beat };
  if (beat.star) {
    key += 1;
    next.beatStar = { tk: beat.star, kind: beat.kind, key };
  }
  if ((beat.kind === 'hit' || beat.kind === 'claim') && beat.pts != null) {
    key += 1;
    next.surge = { key, pts: beat.pts };
  }
  if (beat.kind === 'swap') {
    next.flareKey = state.flareKey + 1;
    if (beat.voice) {
      key += 1;
      next.lines = [
        { ...beat.voice, active: true, _k: key },
        ...state.lines.map((l) => ({ ...l, active: false })),
      ];
    }
  }
  if (beat.kind === 'claim') next.claimKey = state.claimKey + 1;
  next._key = key;
  return next;
}

/**
 * Flip one user pick long↔short — a public reversal that flies up to the board
 * (the token carries the new DIRECTION, not points). Returns a new state.
 */
export function applyFlip(state, tk, newDir) {
  let key = state._key;
  key += 1;
  const surge = { key, pts: String(newDir).toUpperCase() };
  key += 1;
  const beatStar = { tk, kind: 'flip', key };
  const beat = { kind: 'flip', text: `You flipped ${tk} ${newDir}`, star: tk, tone: 'neutral' };
  return { ...state, surge, beatStar, beat, _key: key };
}

/** Ask the agent a question — prepend its answer to the lane, in its voice. */
export function applyAsk(state, qa) {
  if (!qa) return state;
  const key = state._key + 1;
  const line = { kind: 'answer', q: qa.q, text: qa.a, t: 'now', active: true, _k: key };
  return {
    ...state,
    lines: [line, ...state.lines.map((l) => ({ ...l, active: false }))],
    _key: key,
  };
}

/** Clear the transient on-board beat caption (after its dwell). */
export function clearBeat(state) {
  return state.beat ? { ...state, beat: null } : state;
}

/** Tick a countdown clock by one second, never below zero. */
export function tickClock(s) {
  return s > 0 ? s - 1 : 0;
}

/** The reduced-motion gate for JS-driven transient effects (the CountScore idiom). */
export const prefersReducedMotion = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
