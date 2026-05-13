// api/_utils/idValidation.js
//
// Sprint 6 Phase 4A — shared id-shape validator for forge endpoints.
// Extracted from inline duplications in watchlist-dialogue.js (DROP_ID_REGEX)
// and watchlist-dialogue-abandon.js (ID_REGEX). The regex hardens against
// Firestore path injection (slashes resolving to sub-collection paths).
//
// Source of truth for the regex shape: parse-signal.js's client-supplied
// dropId. All forge endpoint ids (sessionId, agentId, dropId, watchlistId)
// follow the same character class because they're all Firestore document
// IDs that flow through similar boundaries.

export const FORGE_ID_REGEX = /^[A-Za-z0-9_-]+$/;
export const FORGE_ID_MAX_LEN = 200;

/**
 * Returns true if `value` is a non-empty string ≤200 chars matching
 * the forge-id character class. Defense-in-depth at the request boundary —
 * Firestore SDK rejects path-shaped slashes too, but validating up front
 * surfaces a 400 before any read.
 */
export function isValidForgeId(value) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= FORGE_ID_MAX_LEN &&
    FORGE_ID_REGEX.test(value)
  );
}
