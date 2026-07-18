// api/_utils/lobbyEndpoint.js
//
// P10b — the shared transport wrapper for the authed, flag-gated `lobby-*`
// endpoints. Every lobby endpoint is THIN over the P10a service
// (tournamentLobbyService.js); this wrapper owns the four things they all
// share so each route stays a few lines and the gating can never drift:
//   1. POST-only method guard.
//   2. THE FLAG GATE — refuse every lobby endpoint while LEAGUE_LOBBY_ENABLED
//      is false (built dark). The surface (LeagueScreen) and the endpoints read
//      the SAME const, so the front door and its server are always in lockstep:
//      flip the one flag and both light up; off, both are inert.
//   3. Bearer-ID-token auth (the place-claim/flip pattern, requireAuth).
//   4. The service-error -> HTTP map (the flip.js sentinel idiom): the service
//      throws Error(code) / Error('code: detail'); we map the code to a status
//      + friendly copy. An unmapped throw is a real 500 (never swallowed).
//
// Client-honest / server-authoritative (the P7-B discipline): a route only
// reaches res.json(success) AFTER the service confirms; any service throw lands
// here and becomes the honest error code the client maps to copy.
//
// IMPORTS the zero-import flag module from src/ under the revised June 2026
// import rule (BUILD_RULES §4): src/config/featureFlags.js is dependency-free
// (Node-clean), and the lobby-endpoints test's real import of a route (which
// imports this wrapper) is the dependency-surface guard for that edge.

import { getFirebaseAdmin } from './firebaseAdmin.js';
import { requireAuth } from './authMiddleware.js';
import { LEAGUE_LOBBY_ENABLED } from '../../src/config/featureFlags.js';

const LOG_PREFIX = '[TournamentLobby:api]';

// Service error code (the part BEFORE any ':' detail) -> [status, key, copy].
// universe_unavailable is a 503 with HONEST copy (founder ruling / S5): if the
// rankings cron hasn't run, formation can't seat the universe — never a 500.
const LOBBY_ERROR_TO_HTTP = Object.freeze({
  lobby_not_found:            [404, 'lobby_not_found', 'That game could not be found — it may have already started.'],
  lobby_not_open:             [409, 'lobby_not_open', 'That game is no longer open to join.'],
  lobby_full:                 [409, 'lobby_full', 'That game is already full.'],
  lobby_cancelled:            [409, 'lobby_cancelled', 'That game was cancelled.'],
  lobby_empty:                [409, 'lobby_empty', 'That game has no players to start.'],
  lobby_overfull:             [409, 'lobby_overfull', 'That game has too many players to form.'],
  already_in_competitive:     [409, 'already_in_competitive', 'You already have a competitive game for that battle week — one game per week.'],
  universe_unavailable:       [503, 'universe_unavailable', 'The market data isn’t ready yet — try again in a few minutes.'],
  cpu_board_commit_failed:    [500, 'cpu_board_commit_failed', 'Could not seat the CPU opponents — please try again.'],
  lobby_formed_without_group: [500, 'lobby_formed_without_group', 'That game is in an inconsistent state — please contact support.'],
});

/**
 * Map a thrown service error to its HTTP response. Returns true (and sends the
 * response) when the code is known; false when it isn't (the caller then sends
 * a generic 500 — the error is logged, never swallowed).
 */
export function mapLobbyServiceError(err, res) {
  const msg = typeof err?.message === 'string' ? err.message : '';
  const code = msg.split(':')[0].trim();
  const mapped = LOBBY_ERROR_TO_HTTP[code];
  if (!mapped) return false;
  const [status, key, copy] = mapped;
  res.status(status).json({ error: key, message: copy });
  return true;
}

/** Parse a Vercel request body (string or pre-parsed object). */
export function parseBody(req) {
  return typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
}

/**
 * The stored lobby member display name: the client-supplied displayName, capped
 * by the schema factory downstream; falls back to the verified token's name.
 */
export function resolveDisplayName(body, user) {
  if (typeof body?.displayName === 'string' && body.displayName.trim()) return body.displayName.trim();
  return user?.name ?? null;
}

/**
 * Run a lobby endpoint: method guard -> flag gate -> auth -> body -> the route's
 * own logic, with a single catch that maps service errors to HTTP. The route
 * receives { req, res, user, db, body } and is responsible for sending its own
 * success (and any route-specific 4xx, e.g. ownership / bad id).
 */
export async function runLobbyEndpoint(req, res, fn) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed', message: 'Method not allowed. Use POST.' });
  }
  if (!LEAGUE_LOBBY_ENABLED) {
    // Built dark: the front door is gated on the same const, so this path is
    // only reachable by a direct call while the feature is off.
    return res.status(404).json({ error: 'lobby_disabled', message: 'The lobby is not available.' });
  }
  const user = await requireAuth(req, res);
  if (!user) return; // 401 already sent by requireAuth

  try {
    const db = getFirebaseAdmin();
    const body = parseBody(req);
    await fn({ req, res, user, db, body });
  } catch (err) {
    if (mapLobbyServiceError(err, res)) return;
    console.error(`${LOG_PREFIX} unhandled error:`, err);
    return res.status(500).json({ error: 'server_error', message: 'Something went wrong — please try again.' });
  }
}
