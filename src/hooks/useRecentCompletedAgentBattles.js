// src/hooks/useRecentCompletedAgentBattles.js
//
// Light, dashboard-scoped read of the user's most recent COMPLETED agent battles.
// Agent battles live in their own `agentBattles` collection and are NOT merged
// into completedBattles (which is built from the `battles` collection), so the
// Command Dashboard's Review station needs its own small read.
//
// Mirrors the battleHistory query in App.jsx (ownerId + status==='completed',
// ordered by completedAt) with a tiny limit. One-shot read on mount. The
// real-time "just-ended" watcher remains backlog.

import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db, auth } from '../firebase/config';

export default function useRecentCompletedAgentBattles(max = 3) {
  const [battles, setBattles] = useState([]);
  // Read uid at render so it's a hook dependency: if Firebase auth hasn't
  // hydrated at mount, the effect re-runs once it resolves (a later re-render
  // recomputes uid) instead of leaving Review silently empty for the session.
  const uid = auth.currentUser?.uid;

  useEffect(() => {
    if (!uid) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const q = query(
          collection(db, 'agentBattles'),
          where('ownerId', '==', uid),
          where('status', '==', 'completed'),
          orderBy('completedAt', 'desc'),
          limit(max),
        );
        const snap = await getDocs(q);
        if (!cancelled) setBattles(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        // Same composite index as the battleHistory query (already deployed);
        // on any failure, degrade to an empty Review section.
        console.error('[useRecentCompletedAgentBattles] fetch failed:', err?.message || err);
      }
    })();
    return () => { cancelled = true; };
  }, [uid, max]);

  return battles;
}
