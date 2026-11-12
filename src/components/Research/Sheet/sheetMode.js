// src/components/Research/Sheet/sheetMode.js
//
// Research Modal Build C — the flag's call-time resolver, PURE and Node-clean
// (no React), so the client gate (sheetGate.js) and the server's Ask gate
// (api/_utils/researchAsk.js) read RESEARCH_MODAL_SHEET_MODE the one same way.
// Any value outside RESEARCH_MODAL_SHEET_MODES reads 'off'; never read at
// module scope (a flag mock reaches every read).
//
// The two-view shell (Amendment C, R-28; spec
// docs/specs/RESEARCH_MODAL_SHELL_SPEC_V1.md SB-2) ships under this same flag,
// so sheetModeOn is also the shell's gate for ONE mount: every v2 mount of the
// research modal resolves through it. It imports nothing: the asset's kind is
// handed in by the caller (the modal knows its displayed asset), never looked
// up here, so the server's import of this module stays Node-clean.

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

/** The asset kinds a mount can name (R-35: only a stock gets the shell). */
export const SHELL_ASSET_KINDS = Object.freeze(['stock', 'crypto', 'index', 'sectorEtf']);

/**
 * Does the sheet — the two-view shell — resolve on for one mount? Pure.
 *
 *   'off'        off for every mount.
 *   'allowlist'  on only for an agent battle whose per-battle verdict is true
 *                (the owner the cockpit-status allowlist admits); a mount with
 *                no agent battle (browse, draft, search …) is off.
 *   'on'         on for every mount, an agent battle or not (SB-2: browse included).
 *
 * `asset` (R-35): a crypto, an index or a sector ETF resolves off at EVERY mode
 * (its shell is a follow-up); left out, the caller is the battle screen's
 * per-battle answer, which does not know the displayed asset — the modal names
 * it on every call it makes.
 *
 * @param {'off'|'allowlist'|'on'} mode
 * @param {{ agentBattle?: boolean, verdict?: boolean, asset?: 'stock'|'crypto'|'index'|'sectorEtf' }} [opts]
 */
export function sheetModeOn(mode, { agentBattle = false, verdict, asset } = {}) {
  if (asset !== undefined && asset !== 'stock') return false;
  if (mode === 'on') return true;
  if (mode === 'allowlist') return agentBattle === true && verdict === true;
  return false;
}
