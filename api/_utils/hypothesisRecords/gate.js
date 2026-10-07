// api/_utils/hypothesisRecords/gate.js
//
// Pilot P1a — THE GATE (build prompt "Gate"; featureFlags.js
// HYPOTHESIS_RECORDS_ENABLED). The feature is on for a caller only when the
// flag is true AND the caller is on the cockpit's server-side allowlist — the
// SAME list api/_utils/callRecords/mode.js reads, from the same place
// (allowlist.js → COCKPIT_ALLOWLIST_UIDS, read at call time, never cached).
// mode.js itself is not edited and not imported: the allowlist is read where
// it lives.
//
// Pure apart from the environment read; never throws — anything malformed
// (a non-string uid, an unreadable environment, a hermetic mock that throws
// on access) resolves OFF, the only state that changes nothing.

import { HYPOTHESIS_RECORDS_ENABLED } from '../../../src/config/featureFlags.js';
import { readCockpitAllowlist } from '../callRecords/allowlist.js';

/** The flag alone (the review pass's global gate: off → return before any read). */
export function hypothesisRecordsFlagOn() {
  try {
    return HYPOTHESIS_RECORDS_ENABLED === true;
  } catch {
    return false;
  }
}

/** Is this uid on the cockpit allowlist? Read NOW. Never throws. */
export function isHypothesisOwnerAllowlisted(uid) {
  try {
    const list = readCockpitAllowlist();
    return typeof uid === 'string' && uid.length > 0 && Array.isArray(list) && list.includes(uid);
  } catch {
    return false;
  }
}

/** The gate for one caller: the flag AND the allowlist. Never throws. */
export function hypothesisRecordsOnFor(uid) {
  return hypothesisRecordsFlagOn() && isHypothesisOwnerAllowlisted(uid);
}

/** The body every new route answers when the gate resolves off for its caller. */
export const DISABLED_BODY = Object.freeze({ error: 'disabled' });
