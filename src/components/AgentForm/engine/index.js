// src/components/AgentForm/engine/index.js
//
// The agent form engine's lazy entry: the only module outside engine/ may reach, and only through import()
// (src/components/AgentForm/loadEngine.js). three.js is reachable from nowhere else in src/
// (agentForm.importGraph.test.js), so it ships in this chunk and loads on the first form mount.

import { createAgentFormEngine } from './engine.js';

export { createAgentFormEngine, GL, RATES, PATHS } from './engine.js';
export { BLOOM_MODES } from './bloom.js';
export { META, MOODS, KINDS, FORM_ORDER, STATES, EQUIP_MS, UNEQUIP_MS } from './vocab.js';

let SHARED = null;

/** The page's one engine (no GPU object until its first mount; everything released again at zero views). */
export function getAgentFormEngine() {
  if (!SHARED) SHARED = createAgentFormEngine();
  return SHARED;
}
