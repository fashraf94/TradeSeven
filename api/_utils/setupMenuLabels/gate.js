// api/_utils/setupMenuLabels/gate.js
//
// Slice 2 — THE GATE (spec V2 §7.1, D-4): SETUP_MENU_LABELS_ENABLED (src/config/setupMenuLabelsFlags.js,
// dark) AND the cockpit's server-side allowlist, read at call time, never cached — the shape of
// activationEvidence/gate.js. Independent of ARCHETYPE_REFRESH_MENU_ENABLED: that flag picks which
// menu is built; this one decides whether store I/O happens.
//
// Environment only: no Firestore, no clock. Never throws — anything malformed resolves OFF.

import { SETUP_MENU_LABELS_ENABLED } from '../../../src/config/setupMenuLabelsFlags.js';
import { readCockpitAllowlist } from '../callRecords/allowlist.js';

/** The flag alone. */
export function setupMenuLabelsFlagOn() {
  try {
    return SETUP_MENU_LABELS_ENABLED === true;
  } catch {
    return false;
  }
}

/** The admitted owners, read NOW: [] when the flag is off. Never throws. */
export function setupMenuLabelsOwners() {
  if (!setupMenuLabelsFlagOn()) return [];
  try {
    const list = readCockpitAllowlist();
    return Array.isArray(list) ? list.filter((u) => typeof u === 'string' && u.length > 0) : [];
  } catch {
    return [];
  }
}

/** Is this owner admitted now? The flag AND the allowlist. Never throws. */
export function setupMenuLabelsAdmits(ownerId) {
  if (typeof ownerId !== 'string' || ownerId.length === 0) return false;
  return setupMenuLabelsOwners().includes(ownerId);
}
