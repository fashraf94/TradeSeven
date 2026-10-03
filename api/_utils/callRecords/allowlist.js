// api/_utils/callRecords/allowlist.js
//
// Cockpit Build 2a — THE SERVER-SIDE ALLOWLIST (spec
// docs/COCKPIT_BUILD2A_SPEC_V1_0.md S-5; founder ruling R2A-7). With
// CALL_RECORDS_MODE 'on', a battle resolves 'on' only when its `ownerId` is
// listed here (mode.js resolveCallRecordsMode). The list used to be a constant
// in src/config/featureFlags.js, which the client bundle and its source map
// carry whole (discovery D-A6) — so any uid written there shipped to every
// client. It now lives ONLY in the environment variable
// `COCKPIT_ALLOWLIST_UIDS` (comma-separated), set by the founder in the Vercel
// production environment and never committed.
//
//   unset / empty / whitespace      → []   (nobody: every battle resolves 'off')
//   "uid-1, uid-2,,uid-3 "          → ['uid-1', 'uid-2', 'uid-3']
//                                     (split on commas, each trimmed, empties dropped)
//
// READ AT CALL TIME, never at module scope: a rollback is removing the uid
// from the variable (spec §10.4), and every request then resolves against the
// value the function instance sees — nothing is cached here. Never throws.
//
// SERVER ONLY. No module under src/ may import this file (allowlist.test.js
// walks src/ and pins it), so the client cannot learn who is admitted — it
// asks GET /api/agent/cockpit-status, which answers for the caller alone.

/** The environment variable that holds the admitted owner uids. */
export const COCKPIT_ALLOWLIST_ENV = 'COCKPIT_ALLOWLIST_UIDS';

/**
 * Parse an allowlist value. Pure.
 *
 * @param {unknown} raw  the variable's value (anything that is not a string reads as unset)
 * @returns {string[]} frozen, in written order
 */
export function parseCockpitAllowlist(raw) {
  if (typeof raw !== 'string') return Object.freeze([]);
  return Object.freeze(raw.split(',').map((s) => s.trim()).filter((s) => s.length > 0));
}

/**
 * The admitted owner uids, read from the environment NOW. Never throws: an
 * unreadable environment reads as nobody admitted.
 *
 * @returns {string[]}
 */
export function readCockpitAllowlist() {
  try {
    return parseCockpitAllowlist(typeof process !== 'undefined' ? process.env?.[COCKPIT_ALLOWLIST_ENV] : undefined);
  } catch {
    return Object.freeze([]);
  }
}
