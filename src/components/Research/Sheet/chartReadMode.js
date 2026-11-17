// src/components/Research/Sheet/chartReadMode.js
//
// The chart's evidence — THE FLAG'S CALL-TIME RESOLVER (spec
// docs/specs/CHART_EVIDENCE_SPEC_V1.md RR-7). PURE and Node-clean (no React),
// so the server route (api/research/setup-read.js) and, in a later build, the
// Chart view's read resolve CHART_READ_MODE the one same way — the
// battleResearchMode.js precedent. Any value outside CHART_READ_MODES reads
// 'off'; never read at module scope, and a test mock of researchModalFlags
// that omits the flag reads 'off' too (the catch).

import { CHART_READ_MODE, CHART_READ_MODES } from '../../../config/researchModalFlags.js';

const OFF = 'off';

/** The mode, when it is one of the walked states, else 'off'. Never throws. */
export function resolveChartReadMode() {
  try {
    const modes = CHART_READ_MODES;
    const mode = CHART_READ_MODE;
    return Array.isArray(modes) && modes.includes(mode) ? mode : OFF;
  } catch {
    return OFF;
  }
}

/**
 * Does the chart read resolve on for one signed-in player? Pure.
 *   'off'        nobody;
 *   'allowlist'  only when the per-player verdict is true (server: isCockpitOwnerAllowlisted at call time);
 *   'on'         everyone.
 */
export function chartReadModeOn(mode, { verdict } = {}) {
  if (mode === 'on') return true;
  if (mode === 'allowlist') return verdict === true;
  return false;
}
