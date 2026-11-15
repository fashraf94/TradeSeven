// src/components/Research/BattleResearch/battleResearchGate.js
//
// Battle Research Slice 1 — THE CLIENT GATE (spec
// docs/specs/BATTLE_RESEARCH_SLICE1_SPEC_V1.md BRS-3), the shell's gate shape
// (Sheet/sheetGate.js) for BATTLE_RESEARCH_MODE:
//
//   'off'        on for nobody — no request is sent.
//   'on'         on for every agent battle mount — no request either.
//   'allowlist'  on only for an AGENT battle whose owner the server allowlists:
//                the existing GET /api/agent/cockpit-status `allowlisted`
//                answer, through the Film Room gate's cached verdict — the SAME
//                cache the shell and Bomb mode read (one request per owner per
//                page life, shared). Until the answer comes in, it reads off.
//
// The flag alone; the battle's own four conditions (BRS-1) are the screen's,
// through battleResearchAvailable.

import { useEffect, useState } from 'react';
import { readFilmRoomVerdict, cachedFilmRoomVerdict } from '../../../utils/filmRoomGate.js';
import { resolveBattleResearchMode, battleResearchModeOn, battleResearchAvailable } from './battleResearchMode.js';

export { resolveBattleResearchMode, battleResearchModeOn, battleResearchAvailable };

/** Does Battle Research's flag resolve on for this AGENT battle's owner? */
export function useBattleResearchModeForBattle(battleId, ownerId = null) {
  const mode = resolveBattleResearchMode();
  const id = typeof battleId === 'string' && battleId ? battleId : null;
  const owner = typeof ownerId === 'string' && ownerId ? ownerId : null;
  const ask = mode === 'allowlist' && id !== null && owner !== null;
  const [answer, setAnswer] = useState(null); // { key, verdict }

  useEffect(() => {
    if (!ask) return undefined;
    let live = true;
    const key = `${id}|${owner}`;
    readFilmRoomVerdict(id, { ownerId: owner })
      .then((v) => { if (live) setAnswer({ key, verdict: v === true }); })
      .catch(() => { if (live) setAnswer({ key, verdict: false }); });
    return () => { live = false; };
  }, [ask, id, owner]);

  if (!ask) return mode === 'allowlist' ? false : id !== null && battleResearchModeOn(mode);
  const key = `${id}|${owner}`;
  const verdict = answer?.key === key ? answer.verdict : cachedFilmRoomVerdict(id, { ownerId: owner });
  return battleResearchModeOn(mode, { verdict });
}
