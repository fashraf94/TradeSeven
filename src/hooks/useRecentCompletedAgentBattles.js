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
//
// Command Center S3 (ruling R-S3-5): the query and the training-clone filter
// now live in services/completedAgentBattles.js, shared with the hub's
// ten-game window. This hook's semantics are unchanged: an array, read once per
// uid and max, a failure swallowed into the list it already had.

import { useState, useEffect } from 'react';
import { auth } from '../firebase/config';
import { fetchRecentCompletedAgentBattles } from '../services/completedAgentBattles';

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
        // R5 (design lock): the shared read drops TRAINING-clone battles from the
        // ranked Review card, matching the sibling queries (App.jsx active poll +
        // Film Room) — `training-agent-` only, NOT `casual-agent-`: a BaggerBomb
        // battle runs on the casual clone but is the user's REAL game, so it
        // SHOULD appear in Review. The two prefixes are treated differently ON
        // PURPOSE; do not "fix" the asymmetry.
        const list = await fetchRecentCompletedAgentBattles(uid, max);
        if (!cancelled) setBattles(list);
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
