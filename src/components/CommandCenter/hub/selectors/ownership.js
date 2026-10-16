// src/components/CommandCenter/hub/selectors/ownership.js
//
// Command Center hub, slice S2a — request ownership (spec V1.2 §5.3,
// correction C2). At request start the provider captures the signed-in uid,
// the auth epoch, the attempt epoch and the target agent; before every later
// effect it asks whether that capture is still current. S2a defines and tests
// the two predicates; S2b calls them before token acquisition, clone ensure,
// the POST, the target-resolved callback, App's handoff, the optimistic append,
// the stash, navigation, the ceremony notification and the result display.
//
// Current means BOTH: the auth identity and its epoch still match, AND the
// attempt epoch still matches. The auth epoch increments on every identity
// change, A → B → A included, so returning to the same uid never revives an
// old request: uid equality alone is never enough.
//
// Pure: identity and epochs arrive as arguments.

/** A signed-in uid: a nonempty string. */
export const validUid = (uid) => typeof uid === 'string' && uid.length > 0;

/** An epoch: a finite integer at or above zero. */
export const validEpoch = (n) => Number.isInteger(n) && n >= 0;

/** True when `auth` is a signed-in identity with a valid epoch. */
export function signedIn(auth) {
  return Boolean(auth) && auth.signedIn === true && validUid(auth.uid) && validEpoch(auth.authEpoch);
}

/**
 * The identity a request carries from its start (spec §5.3).
 *
 * @param {{ signedIn: boolean, uid: string, authEpoch: number }} auth the current authentication
 * @param {string|null} targetAgentId the agent the request deploys (the resolved target once known)
 * @param {number} attemptEpoch the attempt epoch this request was accepted at
 * @returns {null|{ capturedUid: string, authEpoch: number, attemptEpoch: number, targetAgentId: string|null }}
 *   null when there is no signed-in identity to capture or the epoch is not one
 */
export function captureIdentity(auth, targetAgentId, attemptEpoch) {
  if (!signedIn(auth) || !validEpoch(attemptEpoch)) return null;
  return Object.freeze({
    capturedUid: auth.uid,
    authEpoch: auth.authEpoch,
    attemptEpoch,
    targetAgentId: typeof targetAgentId === 'string' && targetAgentId.length > 0 ? targetAgentId : null,
  });
}

/**
 * True only when the captured identity still matches the current
 * authentication (uid AND auth epoch) AND the current attempt epoch.
 *
 * @param {object|null} captured from captureIdentity
 * @param {{ signedIn: boolean, uid: string, authEpoch: number }} auth the current authentication
 * @param {number} attemptEpochNow the provider's current attempt epoch
 */
export function isCurrent(captured, auth, attemptEpochNow) {
  if (!captured || typeof captured !== 'object' || !signedIn(auth)) return false;
  if (!validUid(captured.capturedUid) || !validEpoch(captured.authEpoch) || !validEpoch(captured.attemptEpoch)) return false;
  return captured.capturedUid === auth.uid
    && captured.authEpoch === auth.authEpoch
    && validEpoch(attemptEpochNow)
    && captured.attemptEpoch === attemptEpochNow;
}
