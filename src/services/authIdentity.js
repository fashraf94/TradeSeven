// src/services/authIdentity.js
//
// Command Center slice S3 (ruling R-S3-2; spec V1.2 §3, correction C2) — the
// ONE source of the signed-in identity that owner reads capture:
//
//   { resolved, uid, authEpoch }
//
//   resolved   false until Firebase auth has answered once; an unresolved
//              identity is "not known yet", never "signed out"
//   uid        the signed-in Firebase uid, or null when signed out
//   authEpoch  goes up by one on every identity change — A→B, a sign-out, a
//              sign-in, and A→B→A too — so uid equality alone can never
//              revive a request captured for an earlier identity
//
// It reads the app's one auth instance (firebase/config), the same
// `auth.currentUser` whose uid the active battle poll queries by
// (src/App.jsx fetchAgentBattles) and deployIdentity.js reads. App's poll and
// the hub's readers capture from it; S2b's provider reuses it. There is no
// second source.
//
// No Firestore read and no timer: one auth listener, started by the first
// subscriber and kept for the page's life (App subscribes at mount), so the
// epoch counts every change the page lives through.

import { useSyncExternalStore } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase/config';

const UNRESOLVED = Object.freeze({ resolved: false, uid: null, authEpoch: 0 });

let snapshot = UNRESOLVED;
let started = false;
const listeners = new Set();

const uidOf = (user) => (typeof user?.uid === 'string' && user.uid.length > 0 ? user.uid : null);

/** Firebase's answer: a new snapshot (and epoch) only when the identity actually changed. */
function onAuthUser(user) {
  const uid = uidOf(user);
  if (snapshot.resolved && snapshot.uid === uid) return;
  snapshot = Object.freeze({ resolved: true, uid, authEpoch: snapshot.authEpoch + 1 });
  for (const listener of [...listeners]) listener();
}

function start() {
  if (started) return;
  started = true;
  try {
    onAuthStateChanged(auth, onAuthUser);
  } catch (error) {
    // An unreadable auth leaves the identity unresolved: every reader checks, none admits.
    console.error('[authIdentity] the auth listener could not start:', error);
  }
}

/** The current identity snapshot (a frozen object; a new one on every change). */
export function readAuthIdentity() {
  return snapshot;
}

/** Subscribe to identity changes; the first subscriber starts the auth listener. */
export function subscribeAuthIdentity(listener) {
  listeners.add(listener);
  start();
  return () => { listeners.delete(listener); };
}

/** The identity for a component, re-rendering on every change. */
export function useAuthIdentity() {
  return useSyncExternalStore(subscribeAuthIdentity, readAuthIdentity, readAuthIdentity);
}

/** Is a captured identity still the current one (same epoch)? */
export function isCurrentIdentity(capture) {
  return Boolean(capture) && capture.authEpoch === snapshot.authEpoch;
}

/** Tests only: forget every identity seen and every listener. */
export function resetAuthIdentityForTests() {
  snapshot = UNRESOLVED;
  started = false;
  listeners.clear();
}
