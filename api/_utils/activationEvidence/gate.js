// api/_utils/activationEvidence/gate.js
//
// ID-1 Build 2 — THE GATE (contract §2 "Gate"): ACTIVATION_EVIDENCE_ENABLED
// (src/config/activationEvidenceFlags.js, dark) AND the cockpit's server-side
// allowlist — the same list, read the same way, as hypothesisRecords/gate.js
// (callRecords/allowlist.js → COCKPIT_ALLOWLIST_UIDS, read at call time, never
// cached). Flag off, or an empty allowlist: the observer returns before any read.
//
// Environment only: no Firestore, no clock. Never throws — anything malformed
// resolves OFF, the only state that changes nothing.

import { ACTIVATION_EVIDENCE_ENABLED } from '../../../src/config/activationEvidenceFlags.js';
import { readCockpitAllowlist } from '../callRecords/allowlist.js';

/** The flag alone. */
export function activationEvidenceFlagOn() {
  try {
    return ACTIVATION_EVIDENCE_ENABLED === true;
  } catch {
    return false;
  }
}

/** The admitted owners, read NOW: [] when the flag is off. Never throws. */
export function activationEvidenceOwners() {
  if (!activationEvidenceFlagOn()) return [];
  try {
    const list = readCockpitAllowlist();
    return Array.isArray(list) ? list.filter((u) => typeof u === 'string' && u.length > 0) : [];
  } catch {
    return [];
  }
}

/** Is the gate on for anyone? The flag AND a non-empty allowlist. */
export function activationEvidenceOnForAnyone() {
  return activationEvidenceOwners().length > 0;
}
