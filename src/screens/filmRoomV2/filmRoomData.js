// src/screens/filmRoomV2/filmRoomData.js
//
// Film Room v2 (A2) — THE READS (spec V1.2 §7; Amendment E BA-40):
//   * ONE getDoc of `agentBattles/{id}/tape/{etDate}` per selected day, kept
//     for the screen's life — returning to a day never reads it again;
//   * `tape/{etDate}/series/*` ONLY when the Deep dive opens for that day: one
//     query constrained to the tape's own `ownerId` (the rules allow a list only
//     so — "rules are not filters", test/rules/filmTapeDenials.rules.mjs);
//   * NEVER a subscription — no onSnapshot here or anywhere in v2, and never a
//     read of the battle document (the route already holds it).
//
// A get of a tape that does not exist is DENIED by the rules (resource is
// null), exactly like a tape the caller does not own: both read as "no tape".
// Any other failure is an error the screen says as such — never "no tape".
//
// The Firebase client SDK is imported lazily (the reviewAvailability.js
// precedent), so this module costs the main chunk nothing while v2 is dark.

import { useEffect, useRef, useState } from 'react';
import { TAPE_SUBCOLLECTION, SERIES_SUBCOLLECTION } from '../../constants/filmTape';

const NO_TAPE_CODES = new Set(['permission-denied', 'not-found']);

async function firestore() {
  const [fs, { db }] = await Promise.all([import('firebase/firestore'), import('../../firebase/config')]);
  return { ...fs, db };
}

/** The default readers: one getDoc per tape day, one owner-constrained query per day's series. */
export const firestoreReaders = Object.freeze({
  async readTape(battleId, etDate) {
    try {
      const { doc, getDoc, db } = await firestore();
      const snap = await getDoc(doc(db, 'agentBattles', battleId, TAPE_SUBCOLLECTION, etDate));
      return snap && snap.exists() ? { status: 'ready', tape: snap.data() } : { status: 'missing', tape: null };
    } catch (err) {
      return NO_TAPE_CODES.has(err?.code) ? { status: 'missing', tape: null } : { status: 'error', tape: null };
    }
  },
  async readSeries(battleId, etDate, ownerId) {
    try {
      const { collection, query, where, getDocs, db } = await firestore();
      const snap = await getDocs(query(
        collection(db, 'agentBattles', battleId, TAPE_SUBCOLLECTION, etDate, SERIES_SUBCOLLECTION),
        where('ownerId', '==', ownerId),
      ));
      // Offline, getDocs answers from the local cache — possibly nothing — without an error. A
      // cache answer is not the record: it reads as a failed read, never as "no series" (review A2V3-2).
      if (snap?.metadata?.fromCache) return { status: 'error', series: [] };
      return { status: 'ready', series: (snap?.docs || []).map((d) => d.data()) };
    } catch {
      return { status: 'error', series: [] };
    }
  },
});

/** Is the component still mounted? (A read that lands after unmount sets nothing.) */
function useAlive() {
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);
  return alive;
}

/**
 * The tape of one day. Each (battle, day) is read once for the hook's life;
 * a changed day reads that day once.
 *
 * @returns {{ status: 'loading'|'ready'|'missing'|'error', tape: object|null }}
 */
export function useTapeDay(battleId, etDate, readers = firestoreReaders) {
  const cache = useRef(new Map());
  const key = battleId && etDate ? `${battleId}|${etDate}` : null;
  const [, bump] = useState(0);
  const alive = useAlive();
  useEffect(() => {
    // A failed read is not kept: returning to the day asks again (review A2L3-6). A read that succeeded — the tape, or a definite "no tape" — is.
    if (!key || (cache.current.has(key) && cache.current.get(key).status !== 'error')) return;
    cache.current.set(key, { status: 'loading', tape: null });
    Promise.resolve(readers.readTape(battleId, etDate))
      .catch(() => ({ status: 'error', tape: null }))
      .then((r) => {
        cache.current.set(key, r && r.status ? r : { status: 'error', tape: null });
        if (alive.current) bump((n) => n + 1);
      });
  }, [key, battleId, etDate, readers, alive]);
  if (!key) return { status: 'missing', tape: null };
  return cache.current.get(key) || { status: 'loading', tape: null };
}

/**
 * The day's series documents — read only once `enabled` (the Deep dive is
 * open) and only once per day.
 *
 * @returns {{ status: 'idle'|'loading'|'ready'|'error', series: object[] }}
 */
export function useSeriesDay(battleId, etDate, ownerId, enabled, readers = firestoreReaders) {
  const cache = useRef(new Map());
  const key = battleId && etDate && ownerId ? `${battleId}|${etDate}` : null;
  const [, bump] = useState(0);
  const alive = useAlive();
  useEffect(() => {
    if (!enabled || !key || (cache.current.has(key) && cache.current.get(key).status !== 'error')) return;
    cache.current.set(key, { status: 'loading', series: [] });
    Promise.resolve(readers.readSeries(battleId, etDate, ownerId))
      .catch(() => ({ status: 'error', series: [] }))
      .then((r) => {
        cache.current.set(key, r && r.status ? r : { status: 'error', series: [] });
        if (alive.current) bump((n) => n + 1);
      });
  }, [enabled, key, battleId, etDate, ownerId, readers, alive]);
  if (!key) return { status: 'idle', series: [] };
  return cache.current.get(key) || { status: 'idle', series: [] };
}
