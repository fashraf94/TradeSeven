// api/_utils/filmRoom/cardsGate.js
//
// Film Room B2 — THE SERVER GATE for the two card routes (Build B spec §4,
// §5, §7; Amendment G RG-2): POST /api/film-room/card and
// GET /api/film-room/counter. FILM_ROOM_CARDS_MODE resolves per OWNER:
//   'off'        nobody — every request answers 404 { error: 'disabled' }
//                before any read;
//   'allowlist'  only a uid the cockpit's SERVER-SIDE allowlist admits — the
//                same list the cockpit-status verdict the client reads is made
//                from (api/_utils/callRecords/mode.js isCockpitOwnerAllowlisted,
//                read at call time, never cached); anyone else: the same 404;
//   'on'         every verified uid.
// Unknown values resolve to 'off' (fail closed). Pure apart from the
// environment read; never throws.
//
// THE GATE ORDER (the hypothesisRecords/http.js precedent): security
// middleware (headers, CORS, preflight, the rate limiter — applyRateLimit
// through applySecurityMiddleware) → the MODE (off → 404 before auth) → auth
// (no verified token → 401) → the owner's admission (off for this caller →
// the same 404, whatever the method) → the method. An authenticated caller the
// gate resolves off for gets 404 { error: 'disabled' } for every request,
// before any read, and no answer depends on who else is admitted.

import { FILM_ROOM_CARDS_MODE, FILM_ROOM_CARDS_MODES } from '../../../src/config/featureFlags.js';
import { isCockpitOwnerAllowlisted } from '../callRecords/mode.js';
import { applySecurityMiddleware } from '../security.js';
import { requireAuth } from '../authMiddleware.js';

const OFF = 'off';

/** The mode as the server reads it NOW: one of the walked states, else 'off'. Never throws. */
export function filmRoomCardsMode() {
  try {
    const modes = FILM_ROOM_CARDS_MODES;
    const mode = FILM_ROOM_CARDS_MODE;
    return Array.isArray(modes) && modes.includes(mode) ? mode : OFF;
  } catch {
    return OFF;
  }
}

/** Is the gate on for ANYONE? 'on', or 'allowlist' with the list non-empty is not asked here: 'off' alone answers before auth. */
export function filmRoomCardsFlagOn() {
  return filmRoomCardsMode() !== OFF;
}

/** The gate for one caller: 'on' admits every uid; 'allowlist' the allowlisted; 'off' nobody. Never throws. */
export function filmRoomCardsOnFor(uid) {
  const mode = filmRoomCardsMode();
  if (mode === 'on') return typeof uid === 'string' && uid.length > 0;
  if (mode === 'allowlist') return isCockpitOwnerAllowlisted(uid);
  return false;
}

/** The body every card route answers when the gate resolves off for its caller. */
export const DISABLED_BODY = Object.freeze({ error: 'disabled' });

/**
 * Run the gate. Resolves the authenticated user, or null when the route has
 * already answered (middleware, disabled, auth or method). Every answer from
 * the gate on carries Cache-Control: no-store (the cockpit-status precedent:
 * a rollback's next ask must reach the new value).
 */
export async function gateFilmRoomCardsRoute(req, res, { methods, rateLimit }) {
  if (applySecurityMiddleware(req, res, { rateLimit })) return null;
  res.setHeader('Cache-Control', 'no-store');
  if (!filmRoomCardsFlagOn()) {
    res.status(404).json({ ...DISABLED_BODY });
    return null;
  }
  const user = await requireAuth(req, res);
  if (!user) return null;
  if (!filmRoomCardsOnFor(user.uid)) {
    res.status(404).json({ ...DISABLED_BODY });
    return null;
  }
  if (!methods.includes(req.method)) {
    res.status(405).json({ error: 'Method not allowed' });
    return null;
  }
  return { user };
}
