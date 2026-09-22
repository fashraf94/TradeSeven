// src/hooks/useTeamCard.js
//
// Backing Beta PR 4 — the projection-only team card for one seat (spec V1.3
// §5, D-l): one fetch of GET /api/tournament/team-card per (groupId,
// odUserId). Everything agent-derived on Surface B arrives through this reply;
// the client reads no `agents` document (the projection-only pin in
// TeamCard.test.jsx). Re-fetched on demand (`refresh`, after the viewer edits
// their own pitch on the card).

import { useCallback, useEffect, useState } from 'react';
import { fetchTeamCard } from '../services/backingService';

export default function useTeamCard(groupId, odUserId, enabled = true) {
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(Boolean(enabled && groupId && odUserId));
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled || !groupId || !odUserId) { setCard(null); setLoading(false); setError(null); return undefined; }
    let active = true;
    setLoading(true);
    fetchTeamCard(groupId, odUserId)
      .then((body) => { if (active) { setCard(body); setError(null); } })
      .catch((err) => { if (active) { setCard(null); setError(err?.code || 'server_error'); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [enabled, groupId, odUserId, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { card, loading, error, refresh };
}
