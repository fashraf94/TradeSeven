// src/components/Research/BombMode/useBombModeForBattle.js
//
// Does Bomb mode resolve on for this AGENT battle? (spec §4.1.) 'off' and 'on'
// answer without a request; 'allowlist' asks the server once per owner per
// page life through the Film Room gate's cached verdict (readFilmRoomVerdict:
// GET /api/agent/cockpit-status, `allowlisted`) — no new route, no uid in the
// client. Until the answer comes in, 'allowlist' reads off.

import { useEffect, useState } from 'react';
import { readFilmRoomVerdict, cachedFilmRoomVerdict } from '../../../utils/filmRoomGate.js';
import { resolveBombMode, bombModeOn } from './bombModeGate.js';

export default function useBombModeForBattle(battleId, ownerId = null) {
  const mode = resolveBombMode();
  const id = typeof battleId === 'string' && battleId ? battleId : null;
  const owner = typeof ownerId === 'string' && ownerId ? ownerId : null;
  // Asked only once the battle names its owner: the verdict is cached per owner
  // (one request per owner per page life — a request before the document loads
  // would be cached under the battle id and asked again).
  const ask = mode === 'allowlist' && id !== null && owner !== null;
  const [answer, setAnswer] = useState(null); // { key, verdict } — the last definite answer and what it answered

  useEffect(() => {
    if (!ask) return undefined;
    let live = true;
    const key = `${id}|${owner ?? ''}`;
    readFilmRoomVerdict(id, { ownerId: owner })
      .then((v) => { if (live) setAnswer({ key, verdict: v === true }); })
      .catch(() => { if (live) setAnswer({ key, verdict: false }); });
    return () => { live = false; };
  }, [ask, id, owner]);

  if (!ask) return mode === 'allowlist' ? false : bombModeOn(mode, { agentBattle: id !== null });
  const key = `${id}|${owner ?? ''}`;
  const verdict = answer?.key === key ? answer.verdict : cachedFilmRoomVerdict(id, { ownerId: owner });
  return bombModeOn(mode, { agentBattle: true, verdict });
}
