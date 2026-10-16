// src/services/deployIdentity.js
//
// Command Center repair R1 (ruling R-R1-4; spec V1.2 §5.3, correction C2) — the
// signed-in identity a deploy belongs to. It is read through the app's one auth
// instance (firebase/authService → firebase/config), the same
// `auth.currentUser` whose uid the active battle poll filters its owner on
// (App.jsx, fetchAgentBattles). The deploy service, App's handoff and the
// ceremony's existing-battle terminal all read it here, so the three compare
// one identity.

import { getCurrentUser } from '../firebase/authService';

/** The signed-in Firebase uid, or null when nobody is signed in or auth cannot be read. */
export function signedInUid() {
  try {
    const uid = getCurrentUser()?.uid;
    return typeof uid === 'string' && uid.length > 0 ? uid : null;
  } catch {
    // An unreadable identity owns nothing: every caller fails closed on null.
    return null;
  }
}
