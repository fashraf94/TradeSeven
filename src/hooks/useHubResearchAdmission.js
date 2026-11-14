// src/hooks/useHubResearchAdmission.js
//
// Command Center core spec V1.2, Amendment E V1.1 §1 (ruling R-D4) — WHO THE HUB RESEARCH DOOR ADMITS. ConnectedHub reads
// SHARED_RESEARCH_MODE through hub/hubFlags.js sharedResearchMode() (any value outside SHARED_RESEARCH_MODES reads 'off') and
// hands the mode here: a file in src/hooks/ may not import into the hub directory.
//
//   'off'        nobody is admitted; no request is sent.
//   'on'         every signed-in player is admitted, with no request (the server's idea-record admission still decides).
//   'allowlist'  admitted only on a definite yes from the cockpit-status verdict: readFilmRoomVerdict
//                (src/utils/filmRoomGate.js), cached per owner per page life and shared with Bomb mode and the research
//                sheet. The route answers only for an agentBattles document the caller owns, so the hub hands it an owned
//                battle id it ALREADY holds (hub/researchDoorView.js admissionBattleIdOf: the owned live list first, then
//                the completed window). It never reads anything to find one: no battle, no request, not admitted. Until the
//                verdict comes in, not admitted; a failed ask is not admitted either.
//
// The server is final: the sheet's own route answers 404 `disabled` to anyone it does not admit.
//
// One ask per owner and epoch for a mounted hub: the key is the owner and epoch, and the battle id is read when the ask
// starts. The verdict is the owner's, so a later id of the same owner changes nothing. A cached verdict answers at once
// (cachedFilmRoomVerdict) and readFilmRoomVerdict returns it with no request. An answer for a former owner is never used:
// it is judged against the current key in render. No timer, no listener.

import { useEffect, useState } from 'react';
import { cachedFilmRoomVerdict, readFilmRoomVerdict } from '../utils/filmRoomGate';

const NO_ANSWER = Object.freeze({ key: null, verdict: null });

/**
 * @param {object} p
 * @param {'off'|'allowlist'|'on'} p.mode   sharedResearchMode(), read by ConnectedHub
 * @param {object|null} p.auth              the readers' auth input ({ signedIn, uid, authEpoch })
 * @param {string|null} p.battleId          an agentBattles id the owner owns, from the hub's existing reads, or null
 * @returns {{ admitted: boolean }}
 */
export default function useHubResearchAdmission({ mode, auth, battleId }) {
  const uid = auth?.signedIn === true && typeof auth.uid === 'string' && auth.uid ? auth.uid : null;
  const id = typeof battleId === 'string' && battleId ? battleId : null;
  const ask = mode === 'allowlist' && uid !== null && id !== null;
  const key = ask ? `${uid}:${auth.authEpoch ?? ''}` : null;
  const [answer, setAnswer] = useState(NO_ANSWER);

  useEffect(() => {
    if (!key) return undefined;
    let live = true;
    readFilmRoomVerdict(id, { ownerId: uid }).then(
      (verdict) => { if (live) setAnswer({ key, verdict: verdict === true }); },
      () => { if (live) setAnswer({ key, verdict: false }); },
    );
    return () => { live = false; };
    // Keyed on the owner and epoch alone: the battle id is read at the ask (the verdict is the owner's, cached per owner).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (mode === 'on') return { admitted: uid !== null };
  if (!ask) return { admitted: false };
  const verdict = answer.key === key ? answer.verdict : cachedFilmRoomVerdict(id, { ownerId: uid });
  return { admitted: verdict === true };
}
