// src/hooks/useCockpitRecords.js
//
// Cockpit Build 2a — THE CLIENT READERS of a battle's call records (spec
// docs/COCKPIT_BUILD2A_SPEC_V1_0.md §4). The first client readers of the
// four subcollections the Build 0 / 1a writers fill; the owner-read rules are
// in the tree (firestore.rules), their production publication is deployment
// step 3 (spec §13).
//
//   useCalls(battleId, enabled)          calls, orderBy mintedAt desc, limit 60, live
//   useMonitoring(battleId, enabled)     declarations, orderBy evalSeq desc, limit 1, live
//   useCallEvents(battleId, enabled)     callEvents, orderBy at desc, limit 150, live
//   useCallObservation(battleId, callId) callObservations/{callId}, ONE get
//
// EVERY QUERY ORDERS BY ONE FIELD — no composite index. Each reader gates
// INSIDE its effect, tears its listener down on teardown, and returns null
// while off (the useMasteryProfile / useIntradayView precedents); firebase is
// imported lazily on the lit path only, so with the cockpit off this module
// loads nothing firebase-adjacent and opens nothing.
//
// C-5 AT THE BOUNDARY: only records minted under 'on' leave this module —
// records without the field predate Amendment C and are never shown.
//
// THE BOUNDARY NAMES: the declarations record's `watching` list leaves this
// module as `symbols` — the screen calls it Monitoring (ruling R2A-6), and no
// Battle View file carries the record's word.

import { useEffect, useState } from 'react';

export const CALLS_LIMIT = 60;
export const CALL_EVENTS_LIMIT = 150;

const minted = (d) => d && typeof d === 'object' && d.mintedMode === 'on';

/**
 * Lazy firebase, on the lit path only — ONE shared load for every reader (the
 * three listeners mount in the same commit), forgotten on failure so a later
 * mount can try again rather than inherit a rejected promise.
 */
let firestoreLoad = null;
function firestore() {
  if (!firestoreLoad) {
    firestoreLoad = Promise.all([import('../firebase/config'), import('firebase/firestore')])
      .then(([{ db }, fs]) => ({ db, ...fs }))
      .catch((err) => { firestoreLoad = null; throw err; });
  }
  return firestoreLoad;
}

/** A live, one-field-ordered list under agentBattles/{battleId}/{sub}; null while off. */
const IDLE = Object.freeze({ key: null, value: null });

function useLiveList(battleId, enabled, sub, orderField, max, project) {
  const [state, setState] = useState(IDLE);
  const key = enabled && typeof battleId === 'string' && battleId ? `${battleId}|${sub}` : null;

  useEffect(() => {
    // Already idle → the SAME state object: a disabled reader never adds a render.
    if (!key) { setState((prev) => (prev.key === null && prev.value === null ? prev : IDLE)); return undefined; }
    let unsub = null;
    let cancelled = false;
    (async () => {
      try {
        const { db, collection, query, orderBy, limit, onSnapshot } = await firestore();
        if (cancelled) return;
        unsub = onSnapshot(
          query(collection(db, 'agentBattles', battleId, sub), orderBy(orderField, 'desc'), limit(max)),
          (snap) => setState({ key, value: project(snap.docs.map((d) => ({ id: d.id, ...d.data() }))) }),
          () => setState({ key, value: null }), // permission / transport → nothing shown, never a guess
        );
      } catch {
        if (!cancelled) setState({ key, value: null });
      }
    })();
    return () => { cancelled = true; if (unsub) unsub(); };
    // `project` is a module-level function per reader (stable identity).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, battleId, sub, orderField, max]);

  return key && state.key === key ? state.value : null;
}

const projectCalls = (docs) => docs.filter(minted);
const projectEvents = (docs) => docs;
const projectMonitoring = (docs) => {
  const newest = docs[0];
  if (!minted(newest)) return null;
  const symbols = Array.isArray(newest.watching) ? newest.watching.filter((s) => typeof s === 'string' && s.length > 0) : [];
  return { symbols, evalId: typeof newest.evalId === 'string' ? newest.evalId : null, mintedAt: newest.mintedAt ?? null };
};

/** The battle's newest 60 calls minted under 'on', newest first; null while off. */
export function useCalls(battleId, enabled) {
  return useLiveList(battleId, enabled, 'calls', 'mintedAt', CALLS_LIMIT, projectCalls);
}

/**
 * The newest declarations record, when it was minted under 'on':
 * `{ symbols, evalId, mintedAt }` (the record's watch list as `symbols`), or
 * null — while off, or when the newest record predates the amendment or was
 * minted at shadow. The record carries no promptBuiltAt; the screen resolves
 * the check's time from the battle's own evaluations by `evalId`.
 */
export function useMonitoring(battleId, enabled) {
  return useLiveList(battleId, enabled, 'declarations', 'evalSeq', 1, projectMonitoring);
}

/** The battle's newest 150 call events, newest first (the model groups them by callIds); null while off. */
export function useCallEvents(battleId, enabled) {
  return useLiveList(battleId, enabled, 'callEvents', 'at', CALL_EVENTS_LIMIT, projectEvents);
}

/** ONE get of callObservations/{callId} — only when a sheet opens on a resolved call; null otherwise. */
export function useCallObservation(battleId, callId, enabled) {
  const [state, setState] = useState(IDLE);
  const key = enabled && typeof battleId === 'string' && battleId && typeof callId === 'string' && callId ? `${battleId}|${callId}` : null;

  useEffect(() => {
    if (!key) { setState((prev) => (prev.key === null && prev.value === null ? prev : IDLE)); return undefined; }
    let cancelled = false;
    (async () => {
      try {
        const { db, doc, getDoc } = await firestore();
        const snap = await getDoc(doc(db, 'agentBattles', battleId, 'callObservations', callId));
        if (!cancelled) setState({ key, value: snap.exists() ? snap.data() : null });
      } catch {
        if (!cancelled) setState({ key, value: null });
      }
    })();
    return () => { cancelled = true; };
  }, [key, battleId, callId]);

  return key && state.key === key ? state.value : null;
}
