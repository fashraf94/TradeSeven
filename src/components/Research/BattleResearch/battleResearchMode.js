// src/components/Research/BattleResearch/battleResearchMode.js
//
// Battle Research Slice 1 — THE FLAG'S CALL-TIME RESOLVER (spec
// docs/specs/BATTLE_RESEARCH_SLICE1_SPEC_V1.md BRS-1, BRS-3). PURE and
// Node-clean (no React), so the client gate (battleResearchGate.js) and the
// server route (api/agent/battle-research-quotes.js) read BATTLE_RESEARCH_MODE
// the one same way — the sheetMode.js precedent. Any value outside
// BATTLE_RESEARCH_MODES reads 'off'; never read at module scope, and a test
// mock of researchModalFlags that omits the flag reads 'off' too (the catch).

import { BATTLE_RESEARCH_MODE, BATTLE_RESEARCH_MODES } from '../../../config/researchModalFlags.js';

const OFF = 'off';

/** The mode, when it is one of the walked states, else 'off'. Never throws. */
export function resolveBattleResearchMode() {
  try {
    const modes = BATTLE_RESEARCH_MODES;
    const mode = BATTLE_RESEARCH_MODE;
    return Array.isArray(modes) && modes.includes(mode) ? mode : OFF;
  } catch {
    return OFF;
  }
}

/**
 * Does Battle Research's FLAG resolve on for one owner? Pure.
 *   'off'        nobody;
 *   'allowlist'  only when the per-owner verdict is true (client: the cockpit-status
 *                `allowlisted` answer, cached; server: isCockpitOwnerAllowlisted at call time);
 *   'on'         everyone.
 * The battle's own conditions (active, not League, cockpit 2b, the shell) are the
 * caller's (battleResearchAvailable below, and the route's own order of checks).
 */
export function battleResearchModeOn(mode, { verdict } = {}) {
  if (mode === 'on') return true;
  if (mode === 'allowlist') return verdict === true;
  return false;
}

/**
 * BRS-1: where it runs — all four conditions on one agent battle, plus the flag. Pure.
 * @param {{ modeOn: boolean, active: boolean, league: boolean, cockpit2b: boolean, shellOn: boolean }} p
 */
export function battleResearchAvailable({ modeOn, active, league, cockpit2b, shellOn }) {
  return modeOn === true && active === true && league !== true && cockpit2b === true && shellOn === true;
}
