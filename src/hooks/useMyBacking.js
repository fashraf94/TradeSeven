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
// { groupId: { odUserId: { label, secondary, player, agent } } } from GET
// /api/backing/team-labels. The surfaces render it; nothing here reads
// `agents` or composes a name from an id. Its lifecycle (this build's review
// record, WIRING-4/5/6/8 and WIRING-R-1):
//   · a pod ABSENT from the map is "names on their way" — the surfaces read
//     the pending placeholder, not "Unnamed team";
//   · the names are asked for once every backed pod's pool AND group snapshot
//     has landed — ONE request at mount, not one per snapshot — and again only
//     when what they depend on moves: a pod's team set (the viewer's stake
//     teams and the live seats: a seat that joins a backed slot pod, the CPUs
//     added at fire) or its settlement (a settled team is named by the agent
//     settlement recorded);
//   · a failed read is retried once; a final failure KEEPS the names already
//     on screen, and a pod whose names never arrived reads the neutral name;
//   · a reply that lands after its request was superseded is dropped;
//   · a change of week keys prunes the stakes rather than resetting them, so
//     the names are not cleared and re-asked when the pod list lands.

import { useEffect, useMemo, useState } from 'react';
import { TEAM_LABELS_MAX_PODS } from '../constants/backing';
import { fetchTeamLabels, subscribeMyStakes, subscribePool } from '../services/backingService';
import { subscribeGroup } from '../services/tournamentGroupService';

/**
 * The server's names for the backed pods (D-af), in requests of at most the
 * route's ceiling, merged: `{ groupId: { odUserId: { label, secondary } } }`.
 */
/** The pause before the one retry of a failed names read (WIRING-5). */
export const LABELS_RETRY_MS = 3000;

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
    // PRUNED to the new keys, not reset: a key that stays keeps its stakes, so
    // the backed-pod set does not empty and refill (and the names are not
    // cleared and re-asked) when the pod list adds the window's week.
    const keys = keysKey.split(',');
    const keep = (prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => keys.includes(k)));
    setStakesByKey(keep);
    setLoadedKeys(keep);
    const unsubs = keys.map((key) => subscribeMyStakes(uid, key, (list) => {
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

  // The pool each backed pod's stakes name — `poolId` on the stake document
  // (the activation PR): `dev-{groupId}` on a dev pod, `groupId` otherwise;
  // a stake written before the field reads its pool at `groupId`, as before.
  // Keyed by groupId like everything else here; only the SUBSCRIPTION's
  // document id differs. Part of the join's key so a pool id that moves
  // re-subscribes (SEAL-2's client half, the PR 4 review record).
  const poolIdByGroup = useMemo(() => {
    const out = {};
    for (const s of stakes) {
      if (typeof s?.groupId !== 'string') continue;
      // A stake that NAMES its pool wins over the `groupId` fallback whatever
      // order the stakes arrive in (WIRE-5, the activation review record).
      if (typeof s.poolId === 'string' && s.poolId.length > 0) out[s.groupId] = s.poolId;
      else if (!(s.groupId in out)) out[s.groupId] = s.groupId;
    }
    return out;
  }, [stakes]);
  const poolKey = useMemo(() => groupKey.split(',').filter(Boolean).map((id) => `${id}=${poolIdByGroup[id] ?? id}`).join(','), [groupKey, poolIdByGroup]);

  useEffect(() => {
    if (!enabled || !groupKey) { setPoolsById({}); setGroupsById({}); return undefined; }
    const ids = groupKey.split(',');
    const poolIds = Object.fromEntries(poolKey.split(',').filter(Boolean).map((pair) => pair.split('=')));
    const unsubs = [];
    for (const groupId of ids) {
      unsubs.push(subscribePool(poolIds[groupId] ?? groupId, (pool) => setPoolsById((prev) => ({ ...prev, [groupId]: pool }))));
      // A group read that FAILED is no answer: never the `null` of a pod that
      // is gone (WIRE-D1 — a failed read is not a cancelled pod). Before any
      // answer it is recorded as `undefined` — the key present, so the names'
      // gate below still opens; after one, the LAST ANSWER stands (PLACE-R-1:
      // a later failure never unknows a pod already known — voided, or in
      // battle).
      unsubs.push(subscribeGroup(
        groupId,
        (group) => setGroupsById((prev) => ({ ...prev, [groupId]: group })),
        () => setGroupsById((prev) => (prev[groupId] !== undefined ? prev : { ...prev, [groupId]: undefined })),
      ));
    }
    return () => { unsubs.forEach((u) => { try { u(); } catch { /* already closed */ } }); };
  }, [enabled, groupKey, poolKey]);

  // The names' key: what they depend on, per backed pod — its team set (the
  // viewer's stake teams and the live seats) and whether it settled — and
  // null until every backed pod's pool AND group snapshot has landed (the pool
  // answers null on a missing document or an error, the group null or
  // `undefined`, so the gate always opens). A snapshot that moves none of it
  // re-asks nothing.
  const labelsKey = useMemo(() => {
    if (!groupKey) return '';
    const ids = groupKey.split(',');
    if (!ids.every((id) => id in poolsById && id in groupsById)) return null;
    return ids.map((id) => {
      const teams = new Set(stakes.filter((s) => s?.groupId === id).map((s) => s.teamOdUserId));
      for (const p of (Array.isArray(groupsById[id]?.players) ? groupsById[id].players : [])) {
        if (typeof p?.odUserId === 'string') teams.add(p.odUserId);
      }
      return `${id}|${[...teams].sort().join('+')}|${poolsById[id]?.status === 'resolved' ? 'settled' : ''}`;
    }).join(';');
  }, [groupKey, stakes, poolsById, groupsById]);

  useEffect(() => {
    if (!enabled || !groupKey) { setLabelsById({}); return undefined; }
    if (labelsKey === null) return undefined;
    let active = true;
    let timer = null;
    const ids = groupKey.split(',');
    // Every pod asked for is ANSWERED in the map — a pod the reply does not
    // carry reads the neutral name, never "pending" for ever.
    const answered = (pods) => ({ ...Object.fromEntries(ids.map((id) => [id, {}])), ...pods });
    const load = async () => {
      try {
        return await fetchLabelsFor(ids);
      } catch {
        await new Promise((resolve) => { timer = setTimeout(resolve, LABELS_RETRY_MS); });
        return active ? fetchLabelsFor(ids) : null;
      }
    };
    load()
      .then((pods) => { if (active && pods) setLabelsById(answered(pods)); })
      .catch((err) => {
        if (!active) return;
        // No names is never an id: the names already on screen STAY, and a pod
        // whose names never arrived reads the neutral name (§C1).
        console.warn('[useMyBacking] team names unavailable:', err?.code ?? err?.message);
        setLabelsById((prev) => ({ ...answered({}), ...prev }));
      });
    return () => { active = false; if (timer) clearTimeout(timer); };
  }, [enabled, groupKey, labelsKey]);

  return { stakes, poolsById, groupsById, labelsById, loading: enabled && !loaded };
}
