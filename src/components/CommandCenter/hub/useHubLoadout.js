// src/components/CommandCenter/hub/useHubLoadout.js
//
// Command Center hub, slice S5 — the Loadout's one reader: the player's
// committed lists, through the shipped `listWatchlists()` (spec §2: the
// equipped list is resolved against the existing list route; no new query).
// Ruling R-S5-1: read it ONCE per mount, again after an equip, and again after
// a return from a sheet — never on a timer, a focus event or a poll. Coming
// back from the Forge remounts the hub, which is the mount read.
//
//   { status, committed, refresh, retry }
//     status    'loading' until the first read settles, then 'ready'; 'error'
//               only when NO read has ever succeeded for this owner. A refresh
//               that fails keeps the lists already held — the card never goes
//               blank over a transient failure, and never claims freshness.
//     committed the committed lists (filterWatchlistsByStatus, the shells' own
//               filter), whole documents: the idea pointer rides on each.
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
// tab or device) arrives through the agent subscription, and can name a list
// committed after this hub read its lists: that is an equip too (ruling R-S5-1,
// "after an equip"), so the lists are read once more, ONCE PER DISTINCT ID — an
// id that really is gone is read for once and then reported as it is, never in
// a loop. The hub's own equips choose from lists already held, so they never
// need it.

import { useCallback, useEffect, useRef, useState } from 'react';
import { listWatchlists } from '../../../services/forgeWatchlistService';
import { filterWatchlistsByStatus } from '../../Forge/Watchlist/filterWatchlistsByStatus';
import { LISTS_STATUS } from './selectors/loadout';

const NOTHING_READ = Object.freeze({ status: LISTS_STATUS.LOADING, committed: Object.freeze([]) });

export function useHubLoadout({ enabled, ownerKey = null, equippedId = null }) {
  const [state, setState] = useState({ ownerKey: null, ...NOTHING_READ });
  const latest = useRef(0);
  const mounted = useRef(true);
  // The equipped id the lists have already been re-read for (one extra read per distinct id).
  const askedFor = useRef(null);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const refresh = useCallback(() => {
    latest.current += 1;
    const mine = latest.current;
    listWatchlists().then(
      (lists) => {
        if (!mounted.current || latest.current !== mine) return;
        setState({ ownerKey, status: LISTS_STATUS.READY, committed: filterWatchlistsByStatus(lists, 'committed') });
      },
      (error) => {
        console.error('[CommandCenterHub] watchlist list load failed:', error);
        if (!mounted.current || latest.current !== mine) return;
        setState((held) => (held.ownerKey === ownerKey && held.status === LISTS_STATUS.READY ? held : { ownerKey, status: LISTS_STATUS.ERROR, committed: [] }));
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

  // A new account starts afresh: the extra read it may need is its own.
  useEffect(() => { askedFor.current = null; }, [ownerKey]);

  // An equipped list the held lists do not know: read once more for that id.
  useEffect(() => {
    if (!enabled || !equippedId || view.status !== LISTS_STATUS.READY) return;
    if (view.committed.some((list) => list?.watchlistId === equippedId)) return;
    if (askedFor.current === equippedId) return;
    askedFor.current = equippedId;
    refresh();
  }, [enabled, equippedId, view.status, view.committed, refresh]);

  return { status: view.status, committed: view.committed, refresh, retry };
}
