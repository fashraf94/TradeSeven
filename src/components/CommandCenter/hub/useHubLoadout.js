// src/components/CommandCenter/hub/useHubLoadout.js
//
// Command Center hub, slice S5 — the Loadout's one reader: the player's
// committed lists, through the shipped `listWatchlists()` (spec §2: the
// equipped list is resolved against the existing list route; no new query).
// Ruling R-S5-1: read it ONCE per mount, again after an equip, and again after
// a return from a sheet — never on a timer, a focus event or a poll. Coming
// back from the Forge remounts the hub, which is the mount read.
//
//   { status, committed, refresh }
//     status    'loading' until the first read settles, then 'ready'; 'error'
//               only when NO read has ever succeeded in this mount. A refresh
//               that fails keeps the lists already held — the card never goes
//               blank over a transient failure, and never claims freshness.
//     committed the committed lists (filterWatchlistsByStatus, the shells' own
//               filter), whole documents: the idea pointer rides on each.
//     refresh   read again now. Late answers are dropped: only the newest
//               request may publish, and nothing publishes after unmount.
//
// `enabled` false (no hub data was handed in, or no agent has resolved) reads
// nothing — the lists matter only once there is an agent to equip.

import { useCallback, useEffect, useRef, useState } from 'react';
import { listWatchlists } from '../../../services/forgeWatchlistService';
import { filterWatchlistsByStatus } from '../../Forge/Watchlist/filterWatchlistsByStatus';
import { LISTS_STATUS } from './selectors/loadout';

export function useHubLoadout({ enabled }) {
  const [state, setState] = useState({ status: LISTS_STATUS.LOADING, committed: [] });
  const latest = useRef(0);
  const mounted = useRef(true);

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
        setState({ status: LISTS_STATUS.READY, committed: filterWatchlistsByStatus(lists, 'committed') });
      },
      (error) => {
        console.error('[CommandCenterHub] watchlist list load failed:', error);
        if (!mounted.current || latest.current !== mine) return;
        setState((held) => (held.status === LISTS_STATUS.READY ? held : { status: LISTS_STATUS.ERROR, committed: [] }));
      },
    );
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    refresh();
    // A request in flight when `enabled` drops or the hub unmounts must not publish.
    return () => { latest.current += 1; };
  }, [enabled, refresh]);

  const retry = useCallback(() => {
    setState((held) => (held.status === LISTS_STATUS.ERROR ? { status: LISTS_STATUS.LOADING, committed: [] } : held));
    refresh();
  }, [refresh]);

  return { ...state, refresh, retry };
}
