// src/components/CommandCenter/hub/useHubLoadout.js
//
// Command Center hub, slice S5 — the Loadout's one reader: the player's
// committed lists, through the shipped `listWatchlists()` (spec §2: the
// equipped list is resolved against the existing list route; no new query).
// Ruling R-S5-1: read it ONCE per mount, again after an equip, and again after
// a return from a sheet — never on a timer, a focus event or a poll. Coming
// back from the Forge remounts the hub, which is the mount read.
//
//   { status, committed, readFor, refresh, retry }
//     status    'loading' until the first read settles, then 'ready'; 'error'
//               when NO read has ever succeeded for this owner, or when a
//               read made for a newly equipped list failed (the lists held
//               cannot speak for it). A refresh that fails otherwise keeps the
//               lists already held — the card never goes blank over a transient
//               failure, and never claims freshness.
//     committed the committed lists (filterWatchlistsByStatus, the shells' own
//               filter), whole documents: the idea pointer rides on each.
//     readFor   the equipped list's id when the latest settled read was ISSUED
//               (null: none was equipped; undefined: nothing read yet). A card
//               that cannot find the equipped list in `committed` may say so
//               only when the lists were read under that very id; under another
//               one they say nothing about it.
//     refresh   read again now. Late answers are dropped: only the newest
//               request may publish, and nothing publishes after unmount.
//
// `enabled` false (no hub data was handed in, or no agent has resolved) reads
// nothing — the lists matter only once there is an agent to equip.
//
// `ownerKey` names the account the lists were read for (the agent's owner;
// `listWatchlists()` itself returns the signed-in user's lists). A result
// carries the key it was read for, and a result for another key is never shown:
// on an account change the lists of the previous account drop in the same
// render that brings the new agent, before any effect runs (spec §3), and the
// read in flight for the old key is abandoned.
//
// `equippedId` is the agent's equipped list. An equip made elsewhere (another
// tab or device) arrives through the agent subscription and can name a list
// committed after this hub read its lists. That is an equip too (ruling R-S5-1,
// "after an equip"), so the lists are read once more — but only when the
// lists on hand were read under a DIFFERENT id: a list that was already gone
// when the hub mounted is answered by the mount read, never read for twice, and
// nothing here loops. The hub's own equips choose from lists already held, so
// they never need it.

import { useCallback, useEffect, useRef, useState } from 'react';
import { listWatchlists } from '../../../services/forgeWatchlistService';
import { filterWatchlistsByStatus } from '../../Forge/Watchlist/filterWatchlistsByStatus';
import { LISTS_STATUS } from './selectors/loadout';

const NOTHING_READ = Object.freeze({ status: LISTS_STATUS.LOADING, committed: Object.freeze([]), readFor: undefined });

export function useHubLoadout({ enabled, ownerKey = null, equippedId = null }) {
  const [state, setState] = useState({ ownerKey: null, ...NOTHING_READ });
  const latest = useRef(0);
  const mounted = useRef(true);
  // The equipped id as of the latest commit: a read records the id it was issued under.
  const equippedNow = useRef(equippedId);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => { equippedNow.current = equippedId; }, [equippedId]);

  const refresh = useCallback(() => {
    latest.current += 1;
    const mine = latest.current;
    const issuedUnder = equippedNow.current ?? null;
    listWatchlists().then(
      (lists) => {
        if (!mounted.current || latest.current !== mine) return;
        setState({ ownerKey, status: LISTS_STATUS.READY, committed: filterWatchlistsByStatus(lists, 'committed'), readFor: issuedUnder });
      },
      (error) => {
        console.error('[CommandCenterHub] watchlist list load failed:', error);
        if (!mounted.current || latest.current !== mine) return;
        setState((held) => {
          if (held.ownerKey !== ownerKey || held.status !== LISTS_STATUS.READY) {
            return { ownerKey, status: LISTS_STATUS.ERROR, committed: [], readFor: issuedUnder };
          }
          // Keep the lists held, unless they cannot speak for the list that is equipped now.
          const speaks = issuedUnder === null || held.committed.some((list) => list?.watchlistId === issuedUnder);
          return speaks ? { ...held, readFor: issuedUnder } : { ...held, status: LISTS_STATUS.ERROR, readFor: issuedUnder };
        });
      },
    );
  }, [ownerKey]);

  useEffect(() => {
    if (!enabled) return undefined;
    refresh();
    // A request in flight when `enabled` drops, the owner changes or the hub unmounts must not publish.
    return () => { latest.current += 1; };
  }, [enabled, refresh]);

  const retry = useCallback(() => {
    setState((held) => (held.ownerKey === ownerKey && held.status === LISTS_STATUS.ERROR ? { ownerKey, ...NOTHING_READ } : held));
    refresh();
  }, [ownerKey, refresh]);

  // Another owner's lists are never shown: a result for a different key reads as "nothing read yet".
  const view = state.ownerKey === ownerKey ? state : NOTHING_READ;

  // An equipped list the lists on hand know nothing about, read under another id: read once more.
  useEffect(() => {
    if (!enabled || !equippedId || view.status !== LISTS_STATUS.READY) return;
    if (view.committed.some((list) => list?.watchlistId === equippedId)) return;
    if (view.readFor === equippedId) return;
    refresh();
  }, [enabled, equippedId, view.status, view.committed, view.readFor, refresh]);

  return { status: view.status, committed: view.committed, readFor: view.readFor, refresh, retry };
}
