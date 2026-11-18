// src/components/SharedResearch/builderMode.js
//
// Shared Research — THE THESIS BUILDER'S SWITCH, as the sheet reads it (B4 build
// prompt K-3; Amendment B §B2). Read in ONE place: Start, to decide what "Bring
// your own starting point" sends. Which view an investigation gets is read from
// the SESSION (`shape: 'builder'`), never from here (K-2).
//
// The hubFlags.js precedent: read at CALL time, never at module scope, so a mock of
// the flag module reaches every read; 'on' only when the literal is exactly 'on',
// and anything else reads 'off' (the server's own rule, api/_utils/sharedResearch/
// gate.js sharedResearchBuilderMode). Nothing here can be flipped by a URL or a
// stored value: the literal in src/config/sharedResearchFlags.js is the switch.
//
// No try/catch, on purpose (review 4D-1): reading an imported const binding cannot
// throw, and outside a try Rollup folds `'off' === 'on'` at build time, so the lazy
// chunk imports nothing new from the hub chunk (which holds the flag module) and the
// hub chunk's bytes do not move. Inside a try it cannot fold (tryCatchDeoptimization).

import { SHARED_RESEARCH_BUILDER_MODE } from '../../config/sharedResearchFlags';

/** 'on' | 'off' — SHARED_RESEARCH_BUILDER_MODE as it reads now. */
export function sharedResearchBuilderMode() {
  // SMOKE ONLY, NEVER MERGE: the smoke page (src/smoke/SharedResearchSmokeScreen.jsx) turns the builder on for its own
  // builder scenarios; the flag's literal is untouched, and the app beside the page reads 'off'.
  if (typeof window !== 'undefined' && window.__srSmokeBuilderOn === true) return 'on';
  return SHARED_RESEARCH_BUILDER_MODE === 'on' ? 'on' : 'off';
}
