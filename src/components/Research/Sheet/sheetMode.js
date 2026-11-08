// src/components/Research/Sheet/sheetMode.js
//
// Research Modal Build C — the flag's call-time resolver, PURE and Node-clean
// (no React), so the client gate (sheetGate.js) and the server's Ask gate
// (api/_utils/researchAsk.js) read RESEARCH_MODAL_SHEET_MODE the one same way.
// Any value outside RESEARCH_MODAL_SHEET_MODES reads 'off'; never read at
// module scope (a flag mock reaches every read).

import { RESEARCH_MODAL_SHEET_MODE, RESEARCH_MODAL_SHEET_MODES } from '../../../config/researchModalFlags.js';

const OFF = 'off';

/** The mode, when it is one of the walked states, else 'off'. Never throws. */
export function resolveSheetMode() {
  try {
    const modes = RESEARCH_MODAL_SHEET_MODES;
    const mode = RESEARCH_MODAL_SHEET_MODE;
    return Array.isArray(modes) && modes.includes(mode) ? mode : OFF;
  } catch {
    return OFF;
  }
}

/**
 * Does the sheet resolve on for one mount? Pure.
 * @param {'off'|'allowlist'|'on'} mode
 * @param {{ agentBattle?: boolean, verdict?: boolean }} [opts]
 */
export function sheetModeOn(mode, { agentBattle = false, verdict } = {}) {
  if (mode === 'on') return agentBattle === true;
  if (mode === 'allowlist') return agentBattle === true && verdict === true;
  return false;
}
