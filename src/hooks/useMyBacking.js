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
//
// THE NAMES ARE THE SERVER'S (Amendment C §C1, D-af): `labelsById` —
// { groupId: { odUserId: { label, secondary } } } from GET
// /api/backing/team-labels — is fetched once per backed-pod set, and again
// when a pool settles (a settled team is named by the agent settlement
// recorded). The surfaces render it; nothing here reads `agents` or composes
// a name from an id.

import { useEffect, useMemo, useState } from 'react';
import { TEAM_LABELS_MAX_PODS } from '../constants/backing';
import { fetchTeamLabels, subscribeMyStakes, subscribePool } from '../services/backingService';
import { subscribeGroup } from '../services/tournamentGroupService';

/**
 * The server's names for the backed pods (D-af), in requests of at most the
 * route's ceiling, merged: `{ groupId: { odUserId: { label, secondary } } }`.
 */
export async function fetchLabelsFor(groupIds) {
  const ids = [...new Set((Array.isArray(groupIds) ? groupIds : []).filter((g) => typeof g === 'string' && g.length > 0))].sort();
  const chunks = [];
  for (let i = 0; i < ids.length; i += TEAM_LABELS_MAX_PODS) chunks.push(ids.slice(i, i + TEAM_LABELS_MAX_PODS));
  const bodies = await Promise.all(chunks.map((chunk) => fetchTeamLabels(chunk)));
  const pods = {};
  for (const body of bodies) Object.assign(pods, body?.pods && typeof body.pods === 'object' ? body.pods : {});
  return pods;
}

/**
 * @param {string} uid
 * @param {string|string[]} weekKeys  the week keys to read — the current battle
 *   week (in play or settling) AND the window's week, so a committed stake on
 *   a slot pod whose pool closed at its fire is the viewer's backing from the
 *   moment it is placed, not from Monday (DOM-1, the PR 4 review record).
 */
export default function useMyBacking(uid, weekKeys, enabled = true) {
  const keysKey = [...new Set((Array.isArray(weekKeys) ? weekKeys : [weekKeys]).filter((k) => typeof k === 'string' && k.length > 0))].sort().join(',');
  const [stakesByKey, setStakesByKey] = useState({});
  const [loadedKeys, setLoadedKeys] = useState({});
  const [poolsById, setPoolsById] = useState({});
  const [groupsById, setGroupsById] = useState({});
  const [labelsById, setLabelsById] = useState({});

  useEffect(() => {
    if (!enabled || !uid || !keysKey) { setStakesByKey({}); setLoadedKeys({}); return undefined; }
    setStakesByKey({});
    setLoadedKeys({});
    const unsubs = keysKey.split(',').map((key) => subscribeMyStakes(uid, key, (list) => {
      setStakesByKey((prev) => ({ ...prev, [key]: list }));
      setLoadedKeys((prev) => ({ ...prev, [key]: true }));
    }));
    return () => unsubs.forEach((u) => u());
  }, [enabled, uid, keysKey]);

  const stakes = useMemo(() => Object.values(stakesByKey).flat(), [stakesByKey]);
  const loaded = !keysKey || keysKey.split(',').every((k) => loadedKeys[k] === true);

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

  // The names: re-asked when the backed-pod set changes or a pool SETTLES
  // (only the settled set enters the key, so a snapshot that moves nothing
  // else re-asks nothing).
  const settledKey = useMemo(
    () => (groupKey ? groupKey.split(',').filter((id) => poolsById[id]?.status === 'resolved').join(',') : ''),
    [groupKey, poolsById],
  );
  useEffect(() => {
    if (!enabled || !groupKey) { setLabelsById({}); return undefined; }
    let active = true;
    fetchLabelsFor(groupKey.split(','))
      .then((pods) => { if (active) setLabelsById(pods); })
      .catch((err) => {
        // No names is a fallback, never an id: every surface reads the
        // neutral label for a team this map does not carry.
        console.warn('[useMyBacking] team names unavailable:', err?.code ?? err?.message);
        if (active) setLabelsById({});
      });
    return () => { active = false; };
  }, [enabled, groupKey, settledKey]);

  return { stakes, poolsById, groupsById, labelsById, loading: enabled && !loaded };
}
