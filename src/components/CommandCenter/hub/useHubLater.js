// src/components/CommandCenter/hub/useHubLater.js
//
// Command Center hub, slice S4 (ruling R-S4-3; spec V1.2 §8.2, review IR-12) —
// "Later" for the next action. The keys are the action kind plus the record id
// (hub/nextAction.js laterKeyOf: `openGame:{id}`, `review:{id}`, `deploy:first`).
//
//   store     sessionStorage under `cc.later.{uid}`, a JSON array of keys. It
//             survives navigation and a remount within the tab and goes with the
//             tab; each Later accumulates with the ones before it.
//   uid       cleared on an actual identity change the hub sees resolve — signed
//             out, or another account — and never on a frame where the identity
//             has not answered yet (`auth` null), which every cold mount has. A
//             return to the hub that finds another account's key drops it. A
//             sign-out the mounted hub sees is a change too: the set starts empty,
//             even for the same uid. App's own logout leaves the dashboard first
//             (`logout(); setScreen('home')`), so there the hub never sees the
//             sign-out: a same-uid sign-in in the same tab finds its Laters (they
//             go with the tab), and any other account finds none.
//   storage   every call is guarded. With storage unavailable (private mode, a
//             blocked or full store) Later still works for the mount, from memory.
//
// No effect, timer or listener: the state resets during render when the identity
// moves, and the store is touched only at a mount, at a change and at a Later.

import { useRef, useState } from 'react';

const PREFIX = 'cc.later.';
export const laterStorageKey = (uid) => `${PREFIX}${uid}`;

function load(uid) {
  try {
    const raw = sessionStorage.getItem(laterStorageKey(uid));
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((key) => typeof key === 'string' && key !== '') : []);
  } catch {
    return new Set();
  }
}

function save(uid, keys) {
  try {
    sessionStorage.setItem(laterStorageKey(uid), JSON.stringify([...keys]));
  } catch {
    // Unavailable or full: Later holds for the mount from memory.
  }
}

function forget(uid) {
  try {
    sessionStorage.removeItem(laterStorageKey(uid));
  } catch {
    // Nothing to clear if nothing can be stored.
  }
}

/** Another identity's set does not outlive that identity in this tab. */
function forgetOthers(uid) {
  try {
    const stale = [];
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith(PREFIX) && key !== laterStorageKey(uid)) stale.push(key);
    }
    for (const key of stale) sessionStorage.removeItem(key);
  } catch {
    // As above.
  }
}

function start(uid) {
  if (!uid) return new Set();
  forgetOthers(uid);
  return load(uid);
}

/**
 * @param {null|{ signedIn: boolean, uid?: string }} auth  the identity as the hub reads it (selectors/readerInputs.js
 *   authInputOf): null while it has not answered, `{ signedIn: false }` signed out
 * @returns {{ dismissed: Set<string>, dismiss: (key: string) => void }}
 */
export default function useHubLater(auth) {
  const resolved = auth != null;
  const uid = auth && auth.signedIn === true && typeof auth.uid === 'string' && auth.uid ? auth.uid : null;
  const [state, setState] = useState(() => ({ uid, keys: start(uid) }));
  let current = state;
  if (resolved && state.uid !== uid) {
    // An identity change the hub has seen resolve (not the first answer after a blank): the former account's set goes.
    if (state.uid) forget(state.uid);
    current = { uid, keys: start(uid) };
    setState(current);
  }
  // Two Laters in one tick both stay: the second starts from the first, not from the render before it.
  const latest = useRef(current);
  latest.current = current;

  const dismiss = (key) => {
    if (typeof key !== 'string' || key === '') return;
    const base = latest.current;
    const keys = new Set(base.keys);
    keys.add(key);
    const next = { uid: base.uid, keys };
    latest.current = next;
    setState(next);
    if (base.uid) save(base.uid, keys);
  };

  return { dismissed: current.keys, dismiss };
}
