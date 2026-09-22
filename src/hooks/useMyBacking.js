// src/hooks/useMyBacking.js
//
// Backing Beta PR 4 — the viewer's OWN backing for one week (Surface D's
// source and the strip's in-play half): their stakes (owner-read, one
// subscription on the committed (userId, weekKey) composite) joined to each
// backed pod's public pool document (authed-read — sealed while open, revealed
// at close) and the pod itself (authed-read tournamentGroups: standing from
// the banked dailyScores, the picks once written, the status).
//
// One subscription per distinct backed pod, opened and closed as the set of
// backed pods changes; nothing here polls, nothing here writes, and none of
// it opens while the host's flag is off (the hook is only called from the
// backing surfaces).

import { useEffect, useMemo, useState } from 'react';
import { subscribeMyStakes, subscribePool } from '../services/backingService';
import { subscribeGroup } from '../services/tournamentGroupService';

export default function useMyBacking(uid, weekKey, enabled = true) {
  const [stakes, setStakes] = useState([]);
  const [poolsById, setPoolsById] = useState({});
  const [groupsById, setGroupsById] = useState({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!enabled || !uid || !weekKey) { setStakes([]); setLoaded(true); return undefined; }
    setLoaded(false);
    const unsub = subscribeMyStakes(uid, weekKey, (list) => { setStakes(list); setLoaded(true); });
    return () => unsub();
  }, [enabled, uid, weekKey]);

  // The distinct backed pods, as a stable string so the join re-subscribes
  // only when membership changes (the useRealLeagueState idsKey idiom).
  const groupKey = useMemo(
    () => [...new Set(stakes.map((s) => s?.groupId).filter(Boolean))].sort().join(','),
    [stakes],
  );

  useEffect(() => {
    if (!enabled || !groupKey) { setPoolsById({}); setGroupsById({}); return undefined; }
    const ids = groupKey.split(',');
    const unsubs = [];
    for (const groupId of ids) {
      unsubs.push(subscribePool(groupId, (pool) => setPoolsById((prev) => ({ ...prev, [groupId]: pool }))));
      unsubs.push(subscribeGroup(groupId, (group) => setGroupsById((prev) => ({ ...prev, [groupId]: group }))));
    }
    return () => { unsubs.forEach((u) => { try { u(); } catch { /* already closed */ } }); };
  }, [enabled, groupKey]);

  return { stakes, poolsById, groupsById, loading: enabled && !loaded };
}
