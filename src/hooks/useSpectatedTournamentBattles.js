// src/hooks/useSpectatedTournamentBattles.js
//
// P7 — spectator mode's battle source: the group's battles, each PROJECTED
// server-side for this viewer (full WHY for the viewer's own seat or any
// completed battle; WHAT-only for a non-owner's active battle). Spectators
// cannot read other players' battle docs directly (owner-scoped rule), so this
// hook polls GET /api/tournament/battle-view — the only path that conceals live
// WHY at the read boundary (founder ruling, P7 Stage A).
//
// Polled, not onSnapshot, by design: the projection lives behind an endpoint,
// and the cron writes the doc on minute-scale ticks anyway — the lively part
// (per-asset prices) the battle view fetches client-side. One fetch returns the
// whole group's battles, so switching the selected seat is instant (no
// refetch). Poll cadence matches the per-component price poll (60s); a per-run
// `active` flag (NOT a shared ref) prevents a stale in-flight fetch from an old
// groupId clobbering the new group's state on re-run or unmount.

import { useState, useEffect } from 'react';
import { fetchWithAuth } from '../utils/fetchWithAuth';

const POLL_MS = 60000;

export default function useSpectatedTournamentBattles(groupId, enabled = true) {
  const [battles, setBattles] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled || !groupId) {
      setLoading(false);
      return undefined;
    }
    let active = true;
    setLoading(true);

    const run = async () => {
      try {
        const res = await fetchWithAuth(`/api/tournament/battle-view?groupId=${encodeURIComponent(groupId)}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        if (active) {
          setBattles(data.battles || {});
          setError(null);
        }
      } catch (err) {
        if (active) {
          console.error('[useSpectatedTournamentBattles] fetch failed:', err.message);
          setError(err.message);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    run();
    const interval = setInterval(run, POLL_MS);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [enabled, groupId]);

  return { battles, loading, error };
}
