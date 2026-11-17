// src/components/SharedResearch/builderMode.js
//
// Shared Research — THE THESIS BUILDER'S SWITCH, as the sheet reads it (B4 build
// prompt K-3; Amendment B §B2). Read in ONE place: Start, to decide what "Bring
// your own starting point" sends. Which view an investigation gets is read from
// the SESSION (`shape: 'builder'`), never from here (K-2).
//
// The hubFlags.js precedent: read at CALL time, never at module scope, so a mock of
// the flag module reaches every read; 'on' only when the literal is exactly 'on',
// and anything else — an unknown value, a missing export, a read that throws —
// reads 'off' (the server's own rule, api/_utils/sharedResearch/gate.js
// sharedResearchBuilderMode). Nothing here can be flipped by a URL or a stored
// value: the literal in src/config/sharedResearchFlags.js is the switch.

import { SHARED_RESEARCH_BUILDER_MODE } from '../../config/sharedResearchFlags';

/** 'on' | 'off' — SHARED_RESEARCH_BUILDER_MODE as it reads now. Never throws. */
export function sharedResearchBuilderMode() {
  try {
    return SHARED_RESEARCH_BUILDER_MODE === 'on' ? 'on' : 'off';
  } catch {
    return 'off';
  }
}
