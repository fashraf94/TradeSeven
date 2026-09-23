// src/hooks/useBackingResults.js
//
// Backing Beta PR 5 — the viewer's results (Surface E's source): one fetch of
// GET /api/backing/results — ONE pod (`groupId`, the Spectate final state) or
// weeks newest first, with `loadMore` paging back through `nextBefore`. The
// server runs settle-on-read on the way, so a completed pod's pool is settled
// by this read (spec §7) and the reply already shows the result. Polled by
// nobody; `refresh` re-fetches on demand. The per-run `active` flag guards a
// stale reply (the useBackingPods idiom).

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchBackingResults } from '../services/backingService';

export default function useBackingResults({ groupId = null, limit = null, enabled = true } = {}) {
  const [data, setData] = useState(null);
  const [weeks, setWeeks] = useState([]);
  const [nextBefore, setNextBefore] = useState(null);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);
  // The run the hook is on: a reply from an earlier run (a `loadMore` that
  // landed after `enabled` flipped, `groupId` changed or the hook unmounted)
  // is dropped (WIRE-8, the PR 5 review record).
  const run = useRef(0);

  useEffect(() => {
    run.current += 1;
    if (!enabled) { setData(null); setWeeks([]); setNextBefore(null); setLoading(false); setError(null); return undefined; }
    let active = true;
    setLoading(true);
    fetchBackingResults({ groupId, limit })
      .then((body) => {
        if (!active) return;
        setData(body);
        setWeeks(Array.isArray(body?.weeks) ? body.weeks : []);
        setNextBefore(typeof body?.nextBefore === 'string' ? body.nextBefore : null);
        setError(null);
      })
      .catch((err) => { if (active) setError(err?.code || 'server_error'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; run.current += 1; };
  }, [enabled, groupId, limit, tick]);

  const loadMore = useCallback(async () => {
    if (!enabled || groupId || !nextBefore || loadingMore) return;
    const mine = run.current;
    setLoadingMore(true);
    try {
      const body = await fetchBackingResults({ before: nextBefore, limit });
      if (run.current !== mine) return;
      setWeeks((prev) => [...prev, ...(Array.isArray(body?.weeks) ? body.weeks : [])]);
      setNextBefore(typeof body?.nextBefore === 'string' ? body.nextBefore : null);
    } catch (err) {
      if (run.current === mine) setError(err?.code || 'server_error');
    } finally {
      if (run.current === mine) setLoadingMore(false);
    }
  }, [enabled, groupId, nextBefore, limit, loadingMore]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { data, pod: data?.pod ?? null, weeks, nextBefore, loadMore, loading, loadingMore, error, refresh };
}
