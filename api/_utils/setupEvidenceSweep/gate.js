// api/_utils/setupEvidenceSweep/gate.js
//
// The chart's evidence, PR B — THE SWEEP'S GATE (spec docs/specs/CHART_EVIDENCE_SPEC_V1.md SW-6):
// SETUP_EVIDENCE_SWEEP_ENABLED (src/config/setupEvidenceSweepFlags.js), read at CALL time, never
// cached. No allowlist: a record carries no owner, and the sweep covers the ranked stocks, not a
// player's battles. Never throws — anything malformed resolves OFF.

import { SETUP_EVIDENCE_SWEEP_ENABLED } from '../../../src/config/setupEvidenceSweepFlags.js';

/** Is the sweep on? */
export function sweepFlagOn() {
  try {
    return SETUP_EVIDENCE_SWEEP_ENABLED === true;
  } catch {
    return false;
  }
}
