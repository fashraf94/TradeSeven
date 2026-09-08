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

// Voice-layer grounding §6.3 — the arena's `Filed {time}` label is the Battle
// View's (decisionRecord.js + deskCopy.js, both zero-import): one copy source,
// never a second spelling. Both are node-clean, so this core stays so.
import { filedLabel } from '../../../data/decisionRecord';
import { etTime } from '../../Dashboard/desk/deskCopy';

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
    // Two-way ask (flag-gated): the persistent "N left today" counter (null until the
    // server reports it — NEVER computed client-side) and the in-flight guard.
    remaining: null,
    asking: false,
    // Voice-layer grounding §6.2 / §6.3 (flag-gated): the chips the last grounded
    // answer MINTED (server-normalized; [] when none), the filing in-flight guard,
    // the last filing's failure line (null when none), and the client's belief
    // about the battle's CURRENT directive thread — server-fed (the last grounded
    // answer's or filing's word), never a guess.
    chips: [],
    filing: false,
    filingError: null,
    currentDirectiveThreadId: null,
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

/** Ask the agent a question — prepend its answer to the lane, in its voice. This is
 * the flag-OFF stub path (a canned { q, a } echo); the live two-way path uses the
 * applyAsking → applyAnswer pair below. */
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

/** Live two-way ask, step 1: mark a request in flight (the dock shows a thinking
 * state and disables send until the answer / exhausted / failure lands). */
export function applyAsking(state) {
  return state.asking ? state : { ...state, asking: true, filingError: null };
}

/**
 * Live two-way ask, step 2: prepend the agent's REAL answer (or the in-voice
 * exhausted / failure line) to the lane and clear the in-flight flag. `error` marks
 * a failure line so the dock can offer a retry affordance. The answer text comes
 * straight from the server (data.agentMessage) — the lane never fabricates it.
 */
export function applyAnswer(state, { q, text, error = false, statusLine = null, chips = null, currentDirectiveThreadId } = {}) {
  const key = state._key + 1;
  const line = {
    kind: 'answer', q: q || '', text: text || '', t: 'now', active: true, error: !!error,
    // Voice-layer grounding §6.3 — the code-owned status line rides the answer
    // line (a grounded null-write turn); absent otherwise, so the shipped line
    // shape is untouched.
    ...(statusLine ? { statusLine } : {}),
    _k: key,
  };
  return {
    ...state,
    lines: [line, ...state.lines.map((l) => ({ ...l, active: false }))],
    asking: false,
    // A real answer REPLACES the minted chips (none when the server minted none);
    // a failure keeps the last set, so a retry is still one tap away.
    chips: error ? state.chips : (Array.isArray(chips) ? chips : []),
    // The belief moves only on the server's word (undefined = no word given).
    currentDirectiveThreadId: currentDirectiveThreadId === undefined ? state.currentDirectiveThreadId : currentDirectiveThreadId,
    _key: key,
  };
}

/** Chip filing (voice-layer grounding §6.3), step 1: mark a filing in flight (the
 * minted chips disable until the receipt or the failure line lands). */
export function applyFiling(state) {
  return state.filing ? state : { ...state, filing: true, filingError: null };
}

/**
 * Chip filing, step 2 (success): prepend the RECEIPT — the canonical text the
 * route wrote, labelled with the Battle View's `Filed {time}` — clear the
 * in-flight flag, retire the minted chips (the option was taken), and adopt the
 * filed thread as the current-directive belief. Nothing here is the client's
 * claim: text, time and thread all come from the route's response (the record
 * it wrote), after the write.
 */
export function applyFiled(state, { text, createdAt, directiveThreadId } = {}) {
  const key = state._key + 1;
  const line = { kind: 'directive', text: text || '', t: filedLabel(etTime(createdAt)), active: false, _k: key };
  return {
    ...state,
    lines: [line, ...state.lines.map((l) => ({ ...l, active: false }))],
    filing: false,
    filingError: null,
    chips: [],
    currentDirectiveThreadId: typeof directiveThreadId === 'string' && directiveThreadId
      ? directiveThreadId
      : state.currentDirectiveThreadId,
    _key: key,
  };
}

/**
 * Chip filing, step 2 (failure): hold the ruled failure line (the dock renders
 * it under the chips — it is the system's line, not the agent's voice, so it
 * never enters the lane) and clear the in-flight flag; the chips stay so a
 * retry is one tap. A 409 names the server's current thread, which becomes
 * the belief so the retry files against the truth.
 */
export function applyFilingFailed(state, { line, currentDirectiveThreadId } = {}) {
  return {
    ...state,
    filing: false,
    filingError: line || null,
    currentDirectiveThreadId: currentDirectiveThreadId === undefined ? state.currentDirectiveThreadId : currentDirectiveThreadId,
  };
}

/** Set the server-authoritative "N left today" counter. Ignores non-finite values
 * (a failure/omitted-remaining leaves the last known count untouched). */
export function setRemaining(state, n) {
  return Number.isFinite(n) ? { ...state, remaining: n } : state;
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
