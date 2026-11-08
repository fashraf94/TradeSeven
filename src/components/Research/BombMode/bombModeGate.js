// src/components/Research/BombMode/bombModeGate.js
//
// Research Modal Build A — THE GATE (spec
// docs/specs/RESEARCH_MODAL_BUILD_A_BOMB_MODE_SPEC_V1.md §4.1), after the Film
// Room cards gate (src/utils/filmRoomGate.js resolveFilmRoomCardsMode /
// filmRoomCardsOn).
//
// RESEARCH_MODAL_BOMB_MODE ('off' | 'allowlist' | 'on') is read at CALL time:
// no consumer holds it in a module-scope const, so a flag mock reaches every
// read. Any value outside RESEARCH_MODAL_BOMB_MODES reads 'off'.
//
//   'off'        Bomb mode resolves on for nobody — no request is sent.
//   'on'         on for every in-battle mount — no request either.
//   'allowlist'  on only for an AGENT battle whose owner the server allowlists
//                (the existing GET /api/agent/cockpit-status `allowlisted`
//                answer, through the Film Room gate's cached verdict). A mount
//                with no agent battle resolves 'allowlist' to off.

import { RESEARCH_MODAL_BOMB_MODE, RESEARCH_MODAL_BOMB_MODES } from '../../../config/researchModalFlags.js';

const OFF = 'off';

/** The mode, when it is one of the walked states, else 'off'. Never throws. */
export function resolveBombMode() {
  try {
    const modes = RESEARCH_MODAL_BOMB_MODES;
    const mode = RESEARCH_MODAL_BOMB_MODE;
    return Array.isArray(modes) && modes.includes(mode) ? mode : OFF;
  } catch {
    return OFF;
  }
}

/**
 * Does Bomb mode resolve on for one mount? Pure.
 *
 * @param {'off'|'allowlist'|'on'} mode
 * @param {{ agentBattle?: boolean, verdict?: boolean }} [opts]  `agentBattle`:
 *   the mount has an agent battle id to ask about; `verdict`: the allowlist
 *   answer — true, false, or undefined while none has come in (reads off).
 */
export function bombModeOn(mode, { agentBattle = false, verdict } = {}) {
  if (mode === 'on') return true;
  if (mode === 'allowlist') return agentBattle === true && verdict === true;
  return false;
}
