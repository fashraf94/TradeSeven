// src/hooks/useBackingPods.js
//
// Backing Beta PR 4 — the pod list (Surface A's source): one fetch of
// GET /api/tournament/backing-pools, re-run on demand (`refresh`, after a
// stake lands). Polled by nobody: while a pool is open its public document
// only ever moves at the two sub-floor ticks Amendment B §B3 accepts, so a
// re-read on the viewer's own action is the honest cadence. The
// useSpectatedTournamentBattles per-run `active` flag guards a stale reply.

import { useCallback, useEffect, useState } from 'react';
import { fetchBackingPods } from '../services/backingService';

export default function useBackingPods(enabled = true) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled) { setData(null); setLoading(false); setError(null); return undefined; }
    let active = true;
    setLoading(true);
    fetchBackingPods()
      .then((body) => { if (active) { setData(body); setError(null); } })
      .catch((err) => { if (active) setError(err?.code || 'server_error'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [enabled, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { data, pods: Array.isArray(data?.pods) ? data.pods : [], loading, error, refresh };
}
