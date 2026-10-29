// src/components/AgentForm/agentFormSpec.js
//
// AgentForm's props → the engine's view spec. Pure, and free of three.js, so the wrapper decides its still
// and its labels before (or without) loading the engine.

/**
 * App archetype code ids (src/data/archetypeDisplay.js:18-25) → the engine's armor sets. A LOCAL literal on
 * purpose (Phase 0 report §4): importing a legacy archetype table would be a new importer for the §2.3
 * import-boundary ratchet. Anything else — a missing value, the battle doc's 'unknown', a legacy string
 * such as 'momentum' — draws bare Shadow.
 */
const FORM_BY_CODE_ID = Object.freeze({
  momentum_chaser: 'trend',
  contrarian: 'contra',
  degen: 'spec',
  guardian: 'preserve',
  diversifier: 'divers',
  analyst: 'fund',
});

export const ARCHETYPE_CODE_IDS = Object.freeze(Object.keys(FORM_BY_CODE_ID));

/** The engine form for an archetype code id; 'none' (bare Shadow) for anything that is not one. */
export function formForArchetype(archetype) {
  return typeof archetype === 'string' && Object.hasOwn(FORM_BY_CODE_ID, archetype) ? FORM_BY_CODE_ID[archetype] : 'none';
}

export const AGENT_MOODS = Object.freeze(['idle', 'researching', 'confident', 'worried', 'waiting', 'celebrating']);
export const ALLEGIANCES = Object.freeze(['player', 'opponent']);

/** A growth stage (1-based, 1–3) as the engine's 0-based index; anything else is stage 1. */
export function stageIndex(stage) {
  return stage === 2 || stage === 3 ? stage - 1 : 0;
}

/**
 * The engine spec for AgentForm's props. Allegiance is fixed light, never the player's colour: the player
 * is teal, the opponent copper and mirrored (the key light swaps sides with it).
 */
export function agentFormSpec({ archetype, mood = 'idle', coreStage = 1, armorStage = 1, allegiance = 'player', size = 200, seed = 1 } = {}) {
  const opponent = allegiance === 'opponent';
  return {
    kind: formForArchetype(archetype),
    state: AGENT_MOODS.includes(mood) ? mood : 'idle',
    core: stageIndex(coreStage),
    armor: stageIndex(armorStage),
    pal: opponent ? 'copper' : 'teal',
    face: opponent ? -1 : 1,
    size: Number.isFinite(size) && size > 0 ? size : 200,
    seed: Number.isInteger(seed) ? seed : 1,
  };
}

/** The view's accessible name. No archetype name (that is S1's, through the hub's one table): armored or not, and the mood. */
export function agentFormLabel(spec) {
  return `${spec.kind === 'none' ? 'Shadow, unarmored' : 'Shadow, armored'} — ${spec.state}`;
}

/** Whether this browser has WebGL at all (no context is created to ask). */
export function hasWebGL() {
  return typeof WebGL2RenderingContext !== 'undefined' || typeof WebGLRenderingContext !== 'undefined';
}
