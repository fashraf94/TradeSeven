// src/hooks/useMyBackingStats.js
//
// Backing Beta PR 5 — the viewer's OWN private backing record (spec §5 "My
// Backing stats — private", D-v): one fetch of GET /api/backing/my-stats.
// The server reads the token; nothing about who is asked is sent. Polled by
// nobody; `refresh` re-fetches on demand.

import { useCallback, useEffect, useState } from 'react';
import { fetchMyBackingStats } from '../services/backingService';

export default function useMyBackingStats(enabled = true) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled) { setData(null); setLoading(false); setError(null); return undefined; }
    let active = true;
    setLoading(true);
    fetchMyBackingStats()
      .then((body) => { if (active) { setData(body); setError(null); } })
      .catch((err) => { if (active) setError(err?.code || 'server_error'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [enabled, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, error, refresh };
}
