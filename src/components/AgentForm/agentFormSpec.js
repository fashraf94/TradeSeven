// src/components/AgentForm/agentFormSpec.js
//
// AgentForm's props → the engine's view spec. Pure, and free of three.js, so the wrapper decides its still
// and its labels before (or without) loading the engine.

/**
 * App archetype code ids (src/data/archetypeDisplay.js:18-25) → the engine's armor sets. A LOCAL literal on
 * purpose (Phase 0 report §4): importing a legacy archetype table would be a new importer for the §2.3
 * import-boundary ratchet. Anything else — a missing value, the battle doc's 'unknown', a legacy string
 * such as 'momentum' — draws bare Shadow.
 *
 * The module-level calls here carry pure annotations (build S1): the hub hero imports this module statically, and an
 * unread `Object.freeze(Object.keys(…))` otherwise survives tree-shaking into the flag-off bundle.
 */
const FORM_BY_CODE_ID = /* @__PURE__ */ Object.freeze({
  momentum_chaser: 'trend',
  contrarian: 'contra',
  degen: 'spec',
  guardian: 'preserve',
  diversifier: 'divers',
  analyst: 'fund',
});

export const ARCHETYPE_CODE_IDS = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.keys(FORM_BY_CODE_ID));

/** The engine form for an archetype code id; 'none' (bare Shadow) for anything that is not one. */
export function formForArchetype(archetype) {
  return typeof archetype === 'string' && Object.hasOwn(FORM_BY_CODE_ID, archetype) ? FORM_BY_CODE_ID[archetype] : 'none';
}

export const AGENT_MOODS = /* @__PURE__ */ Object.freeze(['idle', 'researching', 'confident', 'worried', 'waiting', 'celebrating']);
export const ALLEGIANCES = /* @__PURE__ */ Object.freeze(['player', 'opponent']);

/** A growth stage (1-based, 1–3) as the engine's 0-based index; anything else is stage 1. */
export function stageIndex(stage) {
  return stage === 2 || stage === 3 ? stage - 1 : 0;
}

/**
 * The tight framing, which only the battle views ask for (build S1's size follow-up): each form drawn closer, so it
 * fills more of its small box. The value is the design's camera distance (the engine's `zoom`: 4.7 × zoom), per form,
 * in steps of .05: the closest at which every pixel the form lights to 3 % or more keeps 1 CSS px inside a 48 px box,
 * in every mood over its whole motion range (measured in headless Edge; the S1 report §11). Celebrating's spread sets
 * the limit. Trend Follower and Diversifier already reach the box's edge at the design's framing, and Speculator and
 * Capital Preserver have under a step to gain, so they keep it. Without `framing: 'tight'` the spec has no zoom.
 */
const TIGHT_ZOOM = /* @__PURE__ */ Object.freeze({ none: .9, trend: 1, contra: .95, spec: 1, preserve: 1, divers: 1, fund: .95 });

/**
 * The engine spec for AgentForm's props. Allegiance is fixed light, never the player's colour: the player
 * is teal, the opponent copper and mirrored (the key light swaps sides with it).
 */
export function agentFormSpec({ archetype, mood = 'idle', coreStage = 1, armorStage = 1, allegiance = 'player', size = 200, seed = 1, framing } = {}) {
  const opponent = allegiance === 'opponent', kind = formForArchetype(archetype);
  return {
    kind,
    state: AGENT_MOODS.includes(mood) ? mood : 'idle',
    core: stageIndex(coreStage),
    armor: stageIndex(armorStage),
    pal: opponent ? 'copper' : 'teal',
    face: opponent ? -1 : 1,
    size: Number.isFinite(size) && size > 0 ? size : 200,
    seed: Number.isInteger(seed) ? seed : 1,
    ...(framing === 'tight' ? { zoom: TIGHT_ZOOM[kind] } : null),
  };
}

/** The view's accessible name. No archetype name (that is S1's, through the hub's one table): armored or not, and the mood. */
export function agentFormLabel(spec) {
  return `${spec.kind === 'none' ? 'Shadow, unarmored' : 'Shadow, armored'} — ${spec.state}`;
}

/** Below this size (CSS px) a form is drawn as its still, whatever the caller's rate (build S1, ruling R12). */
export const LIVE_MIN_PX = 40;

/** The rate a form of `size` is drawn at: the caller's ('live' | 'half' | 'still'), but a still under LIVE_MIN_PX. */
export function rateForSize(rate, size) {
  return Number.isFinite(size) && size < LIVE_MIN_PX ? 'still' : rate;
}

/** Whether this browser has WebGL at all (no context is created to ask). */
export function hasWebGL() {
  return typeof WebGL2RenderingContext !== 'undefined' || typeof WebGLRenderingContext !== 'undefined';
}
