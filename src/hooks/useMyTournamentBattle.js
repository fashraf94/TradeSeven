// src/hooks/useMyTournamentBattle.js
//
// P7 — participant mode's battle source: the signed-in player's OWN flat6
// battle for a group, live via onSnapshot. The agentBattles read rule is
// owner-scoped (firestore.rules:201-202), so this query is constrained to
// ownerId == uid — every matched doc satisfies the rule, and the two equality
// filters (ownerId, groupId) merge from single-field indexes (no composite
// index, the useAgentBattleId precedent). Spectators do NOT use this hook —
// they read other players' battles through /api/tournament/battle-view
// (server-side WHY projection); see useSpectatedTournamentBattles.
//
// Daily-chained battles mean a week has many docs per owner; we surface the
// CURRENT one — the active battle, else the most recent by createdAt (the same
// "active else latest" rule the server endpoint applies, kept trivially inline
// rather than importing server code into the client bundle).
//
// The full day-`chain` is ALSO returned (League Score History): the recap needs
// every day's trades[] (the swap ledger), and this query already fetches them —
// today's code only DISCARDS all but the current doc. Exposing `chain` is purely
// additive: existing `{ battle }` consumers are unaffected, and it costs no extra
// read (same snapshot). Only the Score-History surface reads `chain`.

import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { pickCurrentTournamentBattle } from '../constants/leagueTournament';

export default function useMyTournamentBattle(groupId) {
  const [battle, setBattle] = useState(null);
  const [chain, setChain] = useState([]);
  const [loading, setLoading] = useState(true);
  const uid = auth.currentUser?.uid;

  useEffect(() => {
    if (!uid || !groupId) {
      setBattle(null);
      setChain([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    const q = query(
      collection(db, 'agentBattles'),
      where('ownerId', '==', uid),
      where('groupId', '==', groupId),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setBattle(pickCurrentTournamentBattle(docs));
        setChain(docs);
        setLoading(false);
      },
      (err) => {
        console.error('[useMyTournamentBattle] query error:', err.message);
        setBattle(null);
        setChain([]);
        setLoading(false);
      },
    );
    return () => unsub();
  }, [uid, groupId]);

  return { battle, chain, loading };
}
