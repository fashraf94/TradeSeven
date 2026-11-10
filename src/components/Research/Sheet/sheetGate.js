// src/components/Research/Sheet/sheetGate.js
//
// Research Modal Build C — THE GATE (spec
// docs/specs/RESEARCH_MODAL_BUILD_C_SHEET_SPEC_V1.md §4.1), after Build A's
// Bomb mode gate (BombMode/bombModeGate.js, useBombModeForBattle.js).
//
// RESEARCH_MODAL_SHEET_MODE ('off' | 'allowlist' | 'on') is read at CALL time:
// no consumer holds it in a module-scope const, so a flag mock reaches every
// read. Any value outside RESEARCH_MODAL_SHEET_MODES reads 'off'.
//
//   'off'        the sheet resolves on for nobody — no request is sent.
//   'on'         on for every agent Battle View mount — no request either.
//   'allowlist'  on only for an AGENT battle whose owner the server allowlists:
//                the existing GET /api/agent/cockpit-status `allowlisted`
//                answer, through the Film Room gate's cached verdict — the same
//                cache Bomb mode asks (one request per owner per page life,
//                shared). Until the answer comes in, 'allowlist' reads off.

import { useEffect, useState } from 'react';
import { readFilmRoomVerdict, cachedFilmRoomVerdict } from '../../../utils/filmRoomGate.js';
import { resolveSheetMode, sheetModeOn } from './sheetMode.js';

// The pure resolver lives in sheetMode.js (the server's Ask gate reads it too).
export { resolveSheetMode, sheetModeOn };

/**
 * Does the sheet resolve on for this AGENT battle? 'off' and 'on' answer without
 * a request; 'allowlist' asks once the battle names its owner (the verdict is
 * cached per owner, as Bomb mode's hook does).
 */
export function useSheetModeForBattle(battleId, ownerId = null) {
  const mode = resolveSheetMode();
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

  if (!ask) return mode === 'allowlist' ? false : sheetModeOn(mode, { agentBattle: id !== null });
  const key = `${id}|${owner}`;
  const verdict = answer?.key === key ? answer.verdict : cachedFilmRoomVerdict(id, { ownerId: owner });
  return sheetModeOn(mode, { agentBattle: true, verdict });
}
