// src/hooks/useSpectatedTournamentBattles.js
//
// P7 — spectator mode's battle source: the group's battles, each PROJECTED
// server-side for this viewer (full WHY for the viewer's own seat; WHAT-only
// for every other seat at every status — founder ruling R-F, 15 Nov 2026).
// Spectators cannot read other players' battle docs directly (owner-scoped
// rule), so this hook polls GET /api/tournament/battle-view — the only path
// that conceals WHY at the read boundary (founder ruling, P7 Stage A).
//
// R-F: the endpoint keys its battles by SEAT ('0'..'3', the owner's index in
// the group document's `players`), never by account id. This hook joins each
// seat back to its player through the `players` the caller already holds from
// its own group subscription (battlesByOwnerFromSeats — the same seat rule the
// server keys with), and returns the owner-keyed map the league surfaces read.
// A reply is joined ONLY to the group it was fetched for: seat '1' of one
// group is a different player from seat '1' of the next, so when `groupId`
// changes the hook answers {} until the new group's reply lands (and keeps
// answering {} if that fetch fails or the hook is disabled there) — never the
// old group's battles under the new group's players (security-pack review,
// wiring lens W1).
//
// Polled, not onSnapshot, by design: the projection lives behind an endpoint,
// and the cron writes the doc on minute-scale ticks anyway — the lively part
// (per-asset prices) the battle view fetches client-side. One fetch returns the
// whole group's battles, so switching the selected seat is instant (no
// refetch). Poll cadence matches the per-component price poll (60s); a per-run
// `active` flag (NOT a shared ref) prevents a stale in-flight fetch from an old
// groupId clobbering the new group's state on re-run or unmount.

import { useState, useEffect, useMemo } from 'react';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import { battlesByOwnerFromSeats } from '../constants/leagueTournament';

const POLL_MS = 60000;

/**
 * @param {string|null} groupId
 * @param {boolean} enabled
 * @param {Array} players  the group document's `players` (the seat order)
 */
export default function useSpectatedTournamentBattles(groupId, enabled = true, players = null) {
  const [reply, setReply] = useState({ groupId: null, bySeat: {} });
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
          setReply({ groupId, bySeat: data.battles || {} });
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

  // Re-joined when a poll lands or the group document ticks; every caller's
  // own model already rebuilds on that tick, so this adds no render. A reply
  // for another group joins to nothing (see the header).
  const battles = useMemo(
    () => (reply.groupId === groupId ? battlesByOwnerFromSeats(reply.bySeat, players) : {}),
    [reply, groupId, players],
  );

  return { battles, loading, error };
}
