export const config = { maxDuration: 10 };

/**
 * POST /api/agent/set-opponent — CLOSED (HTTP 410 Gone).
 *
 * Security pack, fix 2 (founder ruling R-F, 15 Nov 2026;
 * docs/audits/20261115_FIX_SECURITY_PACK_LEAGUE_VIEW.md). This endpoint once
 * wrote a client-generated CPU opponent, its starting prices and its
 * thresholds onto an agent battle under five minutes old with no opponent —
 * which is every new league battle (they are created with `opponent: null`).
 * It trusted the client's prices and thresholds. Its last caller left the
 * client on 8 Apr 2026 (f9e7af093: the CPU opponent is generated server-side
 * in decide.js at deploy), and nothing in the client, the server, the scripts,
 * the tests or vercel.json calls it.
 *
 * Every request is refused with 410 before any read or write: no security
 * middleware, no token check, no Firestore call. The file stays, so the route
 * answers "gone" rather than falling through to a platform 404 that could be
 * mistaken for a transient deploy fault; the old handler is in git history.
 */
export default function handler(req, res) {
  return res.status(410).json({ error: 'gone', message: 'This endpoint has been removed.' });
}
