// api/_utils/wireFlags.js
// FantasyTimes Wire — flag resolution (Spec V1.5 §4.8).
//
// The three Wire flags live in src/config/featureFlags.js (the repo's flag
// home — POD_EXPIRY_SWEEP_ENABLED precedent; featureFlags.js is Node-clean
// and already imported by api/). This module is the single resolution point:
// it enforces the dependency rule (continuity requires writes) so no call
// site can accidentally run the continuity block dark-solo.
//
// All three ship FALSE. Rollout §4.8: metrics → ≥3 trading days baseline →
// writes → ≥2 trading days solo → continuity. Each flip is its own PR.

import {
  WIRE_METRICS_ENABLED,
  WIRE_WRITES_ENABLED,
  CONTINUITY_MEMORY_ENABLED,
  WIRE_NEWSLINE_ENABLED,
} from '../../src/config/featureFlags.js';

/**
 * Resolve the effective Wire flag state.
 * `continuityEnabled` is true only when BOTH its own flag and
 * WIRE_WRITES_ENABLED are true (§4.8 flag table). `newslineEnabled`
 * (Phase 2 N1) carries the same dependency — no Wire writes, nothing to
 * read — so neither consumer can ever run dark-solo.
 */
export function getWireFlags() {
  return {
    metricsEnabled: WIRE_METRICS_ENABLED === true,
    writesEnabled: WIRE_WRITES_ENABLED === true,
    continuityEnabled: CONTINUITY_MEMORY_ENABLED === true && WIRE_WRITES_ENABLED === true,
    newslineEnabled: WIRE_NEWSLINE_ENABLED === true && WIRE_WRITES_ENABLED === true,
  };
}
