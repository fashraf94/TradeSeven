// src/components/League/battleArena/useLiveComposites.js
//
// Phase B (Option X) — the arena's RIVAL live-composite poll. Fetches the read-only
// GET /api/tournament/live-composites map ({ [odUserId]: liveComposite }) every ~60s
// while the live orb is ON and the round is a live BATTLE. The map feeds ONLY rival
// seats (the seatAltitude resolver in buildArenaModel + ClimbArena); YOUR seat rides
// the per-tick youLiveScore client path and is never sourced here — even if the map
// carries your id, the resolver ignores it for you (Option X).
//
// Cadence: ~60s. The endpoint's agent half is only ~15-min fresh (scoreState from the
// agent-evaluate cron); its user half is recomputed live per request. A 60s poll keeps
// the rival user half current without hammering EODHD — and the server routes its price
// fetch through the shared market-data cache, so multiple viewers of one pod share a
// compute within the cache window.
//
// DARK-SAFE: gated on LEAGUE_LIVE_ORB_ENABLED. Flag off → `on` false → NO poll ever
// runs and the hook returns null, so the arena falls back to the banked series
// (byte-identical to today, zero endpoint traffic in production until the flip).

import React from 'react';
import { fetchLiveComposites } from '../../../services/tournamentGroupService';
import { LEAGUE_LIVE_ORB_ENABLED } from '../../../config/featureFlags';

const POLL_MS = 60 * 1000; // ~60s

/**
 * @param {string|null} groupId
 * @param {boolean} enabled - poll only when the arena round is live (a BATTLE)
 * @returns {Object<string,number>|null} rival composites, or null (→ banked fallback)
 */
export function useLiveComposites(groupId, enabled) {
  const on = LEAGUE_LIVE_ORB_ENABLED && !!enabled && !!groupId;
  const [map, setMap] = React.useState(null);

  React.useEffect(() => {
    if (!on) { setMap(null); return undefined; }
    let alive = true;
    const load = async () => {
      const next = await fetchLiveComposites(groupId); // {} on failure → all-banked, never throws
      if (alive && next && typeof next === 'object') setMap(next);
    };
    load();
    const iv = setInterval(load, POLL_MS);
    return () => { alive = false; clearInterval(iv); };
  }, [on, groupId]);

  // Never leak a stale map when disabled — off-gate is always null (banked).
  return on ? map : null;
}
