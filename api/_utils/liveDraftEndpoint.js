// api/_utils/liveDraftEndpoint.js
//
// The shared transport wrapper for the authed, flag-gated `slot-*` endpoints
// (Competitive Live Draft, Phase 1) — the lobbyEndpoint.js pattern, one flag
// over. Every slot endpoint is THIN over the liveDraftFormation.js service; this
// wrapper owns the four shared concerns so the gating can never drift:
//   1. Method guard (parameterized — schedule is GET, claim/release are POST).
//   2. THE FLAG GATE — refuse every slot endpoint while LEAGUE_LIVE_DRAFT is
//      false (built dark; the scouting-board defense-in-depth 404 pattern). The
//      Phase-4 picker and these endpoints read the SAME const, so surface and
//      server light up together — off, both inert (byte-identical bar).
//   3. Bearer-ID-token auth (requireAuth — the place-claim / lobby pattern).
//   4. The service-error → HTTP map (the flip.js sentinel idiom): the service
//      throws Error(SLOT_SENTINEL_PREFIX + code); we strip the prefix and map
//      the code to a status + friendly copy. An unmapped throw is a real 500.
//
// Reuses parseBody / resolveDisplayName from lobbyEndpoint.js (one copy). Imports
// the zero-import flag module from src/ under the revised June 2026 import rule
// (BUILD_RULES §4); the slot-endpoints test's real import of a route (which
// imports this wrapper) is the dependency-surface guard for that edge.

import { getFirebaseAdmin } from './firebaseAdmin.js';
import { requireAuth } from './authMiddleware.js';
import { parseBody, resolveDisplayName } from './lobbyEndpoint.js';
import { SLOT_SENTINEL_PREFIX } from './liveDraftFormation.js';
import { LEAGUE_LIVE_DRAFT } from '../../src/config/featureFlags.js';

const LOG_PREFIX = '[LiveDraftSlot:api]';

export { resolveDisplayName };

// Service error code (after the sentinel prefix, before any ':' detail) ->
// [status, key, copy].
const SLOT_ERROR_TO_HTTP = Object.freeze({
  unknown_slot:          [400, 'unknown_slot', 'That draft slot isn’t on the schedule.'],
  slot_full:             [409, 'slot_full', 'That slot is full — all four seats are taken.'],
  draft_already_started: [409, 'draft_already_started', 'That draft has already started — seats are locked.'],
  not_a_slot_group:      [409, 'not_a_slot_group', 'That group isn’t a live-draft slot.'],
  bad_user:              [400, 'bad_user', 'Could not identify your account — please sign in again.'],
  bad_group:             [400, 'bad_group', 'That game reference looks malformed.'],
});

/**
 * Map a thrown service error to its HTTP response. Returns true (and sends the
 * response) when the code is known; false otherwise (the caller sends a generic
 * 500 — the error is logged, never swallowed).
 */
export function mapSlotServiceError(err, res) {
  let msg = typeof err?.message === 'string' ? err.message : '';
  if (msg.startsWith(SLOT_SENTINEL_PREFIX)) msg = msg.slice(SLOT_SENTINEL_PREFIX.length);
  const code = msg.split(':')[0].trim();
  const mapped = SLOT_ERROR_TO_HTTP[code];
  if (!mapped) return false;
  const [status, key, copy] = mapped;
  res.status(status).json({ error: key, message: copy });
  return true;
}

/**
 * Run a slot endpoint: method guard -> flag gate -> auth -> body -> the route's
 * own logic, with a single catch that maps service errors to HTTP. The route
 * receives { req, res, user, db, body } and sends its own success (and any
 * route-specific 4xx, e.g. a bad id).
 */
export async function runSlotEndpoint(req, res, { allow = ['POST'] } = {}, fn) {
  if (!allow.includes(req.method)) {
    return res.status(405).json({ error: 'method_not_allowed', message: `Method not allowed. Use ${allow.join('/')}.` });
  }
  if (!LEAGUE_LIVE_DRAFT) {
    // Built dark: the picker gates on the same const, so this path is only
    // reachable by a direct call while the feature is off.
    return res.status(404).json({ error: 'live_draft_disabled', message: 'Live draft is not available.' });
  }
  const user = await requireAuth(req, res);
  if (!user) return; // 401 already sent by requireAuth

  try {
    const db = getFirebaseAdmin();
    const body = parseBody(req);
    await fn({ req, res, user, db, body });
  } catch (err) {
    if (mapSlotServiceError(err, res)) return;
    console.error(`${LOG_PREFIX} unhandled error:`, err);
    return res.status(500).json({ error: 'server_error', message: 'Something went wrong — please try again.' });
  }
}
