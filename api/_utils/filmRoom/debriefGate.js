// api/_utils/filmRoom/debriefGate.js
//
// Film Room D2 — THE SERVER GATE for the agent's words (D2 spec §8, ruling DW-9), as cardsGate.js reads its mode.
// FILM_ROOM_DEBRIEF_MODE resolves per OWNER, read at CALL time (never held in a module-scope const, so a flag mock
// reaches every read):
//   'off'        nobody — the nightly job answers { skipped: true } before any read (api/cron/film-room-debrief.js);
//   'allowlist'  only a uid the cockpit's SERVER-SIDE allowlist admits (api/_utils/callRecords/mode.js
//                isCockpitOwnerAllowlisted, read at call time, never cached) — the list the client's verdict is made from;
//   'on'         every owner with a uid.
// Unknown values resolve to 'off' (fail closed). Pure apart from the environment read; never throws.

import { FILM_ROOM_DEBRIEF_MODE, FILM_ROOM_DEBRIEF_MODES } from '../../../src/config/featureFlags.js';
import { isCockpitOwnerAllowlisted } from '../callRecords/mode.js';

const OFF = 'off';

/** The mode as the server reads it NOW: one of the walked states, else 'off'. Never throws. */
export function filmRoomDebriefMode() {
  try {
    const modes = FILM_ROOM_DEBRIEF_MODES;
    const mode = FILM_ROOM_DEBRIEF_MODE;
    return Array.isArray(modes) && modes.includes(mode) ? mode : OFF;
  } catch {
    return OFF;
  }
}

/** The gate for one owner, under `mode` (read now when omitted): 'on' admits every uid; 'allowlist' the allowlisted; 'off' nobody. Never throws. */
export function filmRoomDebriefOnFor(ownerId, mode = filmRoomDebriefMode()) {
  try {
    if (mode === 'on') return typeof ownerId === 'string' && ownerId.length > 0;
    if (mode === 'allowlist') return isCockpitOwnerAllowlisted(ownerId) === true;
    return false;
  } catch {
    return false;
  }
}
