// api/_utils/kb/audience.js
//
// KB-0 — WHO MAY RECEIVE A KB METHOD (Shared Research spec V1.2, Amendment A
// §A3.5; founder ruling R-KB-2). `inAudienceFor(uid)` returns the function a
// caller hands the loader as `inAudience`; the loader calls it with the
// authorization entry's audience.
//
//   'allowlist'   true when the uid is on the founder's named test list
//                 (isCockpitOwnerAllowlisted, api/_utils/callRecords/mode.js)
//   'all'         true when the uid is a non-empty string
//   anything else never
//
// The uid comes from verified sign-in only (the caller's requireAuth).
//
// SEPARATE FROM THE INVESTIGATION GATE. This module reads no Shared Research
// flag or gate: widening who may investigate never widens who gets the
// method. Its one import is the allowlist predicate (boundary.test.js pins it).
//
// Never throws: an empty or non-string uid answers false for every audience,
// and anything unexpected answers false.

import { isCockpitOwnerAllowlisted } from '../callRecords/mode.js';

/**
 * The audience function for one signed-in player.
 *
 * @param {unknown} uid  the verified uid
 * @returns {(audience: unknown) => boolean}
 */
export function inAudienceFor(uid) {
  return function inAudience(audience) {
    try {
      if (typeof uid !== 'string' || uid.length === 0) return false;
      if (audience === 'all') return true;
      if (audience === 'allowlist') return isCockpitOwnerAllowlisted(uid) === true;
      return false;
    } catch {
      return false;
    }
  };
}
