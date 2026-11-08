// src/services/leagueLockService.js
//
// Build A2 — THE CLIENT READ of the League lock (FD-3): the player's group documents through the member-scoped query
// the server's writers run inside their transactions (api/_utils/perGameLoadout.js readLeagueLockInTx; the same query
// subscribeMyGroup runs), judged by the one shared rule, leagueLockOf (src/constants/perGameLoadout.js) — so the cards,
// the lines and the armory say exactly what the server will answer. A module of its own, imported only by the hub's
// flagged loadout scope, so nothing the flag-off build ships changes. Unlike subscribeMyGroup, a failed read is told
// apart from "no group": the caller hears `onError` and never shows an open loadout it could not check.

import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { TOURNAMENT_GROUPS_COLLECTION } from '../constants/leagueTournament';
import { leagueLockOf } from '../constants/perGameLoadout';

/** Live League lock for `uid`: `onLock({ locked, groupId, status, endsAtMs })`, or `onError()`. Returns the unsubscribe. */
export function subscribeLeagueLock(uid, onLock, onError) {
  const groupsQuery = query(collection(db, TOURNAMENT_GROUPS_COLLECTION), where('groupMembers', 'array-contains', uid));
  return onSnapshot(groupsQuery, (snapshot) => {
    onLock(leagueLockOf(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))));
  }, (error) => {
    console.error('[LeagueLockService] lock subscription error:', error);
    onError?.(error);
  });
}
