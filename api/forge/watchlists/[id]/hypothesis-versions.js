// api/forge/watchlists/[id]/hypothesis-versions.js
//
// Pilot P1a — the player's versioned idea records (pilot spec
// docs/specs/20260923_BAGGERBOMB_PARTNERSHIP_PILOT_SPEC_V1_4.md §2.1;
// founder decision D1: the idea lives under the saved list, owned by the
// player).
//
//   GET  /api/forge/watchlists/{id}/hypothesis-versions
//        → { watchlistId, currentVersion, versions[] }   newest first
//   GET  /api/forge/watchlists/{id}/hypothesis-versions?version=n
//        → { watchlistId, currentVersion, version }
//   POST /api/forge/watchlists/{id}/hypothesis-versions
//        { opId, expectedVersion, statement, horizonEnum?, activation?, invalidation? }
//        → { watchlistId, idempotent, version }
//        Creates v{expectedVersion + 1} in `draft` — a manual or screener
//        list's first idea, or "save as a new version" of an existing one.
//        Content is never edited in place: an edit IS a new version.
//
// Gated (http.js gateHypothesisRoute): off for the caller → 404
// { error: 'disabled' }. Typed refusals: 409 version_conflict | op_conflict |
// illegal_transition (the current version is review_due — reaffirm instead) |
// origin_unresolved; 400 for malformed input; 404 not_found |
// version_not_found; 403 forbidden.

import { getFirebaseAdmin } from '../../../_utils/firebaseAdmin.js';
import {
  gateHypothesisRoute, requireOpId, requireExpectedVersion, requireVersion, parseContentPayload, sendHypothesisError,
} from '../../../_utils/hypothesisRecords/http.js';
import { createPlayerVersion, listVersions, readVersion } from '../../../_utils/hypothesisRecords/store.js';

export const config = { maxDuration: 10 };

export default async function handler(req, res) {
  const gate = await gateHypothesisRoute(req, res, {
    methods: ['GET', 'POST'],
    rateLimit: req.method === 'GET' ? { limit: 30, windowMs: 60_000 } : { limit: 10, windowMs: 60_000 },
  });
  if (!gate) return;
  const { user, watchlistId } = gate;
  const db = getFirebaseAdmin();

  if (req.method === 'GET') {
    try {
      const raw = req.query?.version;
      if (raw !== undefined) {
        const out = await readVersion(db, { uid: user.uid, watchlistId, version: requireVersion(raw) });
        return res.status(200).json({ watchlistId, ...out });
      }
      const out = await listVersions(db, { uid: user.uid, watchlistId });
      return res.status(200).json({ watchlistId, ...out });
    } catch (err) {
      return sendHypothesisError(res, err, 'list');
    }
  }

  try {
    const body = req.body || {};
    const opId = requireOpId(body);
    const expectedVersion = requireExpectedVersion(body);
    const payload = parseContentPayload(body, { requireStatement: true });
    const out = await createPlayerVersion(db, {
      uid: user.uid, watchlistId, opId, expectedVersion, payload, nowIso: new Date().toISOString(),
    });
    return res.status(200).json({ watchlistId, idempotent: out.idempotent, version: out.version });
  } catch (err) {
    return sendHypothesisError(res, err, 'create');
  }
}
