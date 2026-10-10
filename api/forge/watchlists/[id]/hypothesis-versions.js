// api/forge/watchlists/[id]/hypothesis-versions.js
//
// Pilot P1a — the player's versioned idea records (pilot spec
// docs/specs/20260923_BAGGERBOMB_PARTNERSHIP_PILOT_SPEC_V1_4.md §2.1;
// founder decision D1: the idea lives under the saved list, owned by the
// player).
//
//   GET  /api/forge/watchlists/{id}/hypothesis-versions
//        → { watchlistId, currentVersion, versions[], research[] }   newest first
//        (Pilot P2: research[] = the list's research-record summaries —
//        api/_utils/researchRecords/model.js recordSummaryOf)
//        (Pilot P1b, founder ruling B3: when the page holds a review_due
//        version, `deployedLists: { [version]: { battleId, name, tickers } }`
//        names the FROZEN list the newest one rode in — its deploying
//        battle's own snapshot, never the live list — so the Forge's review
//        line can say [SYM] or [LIST]; `{}` when that cannot be proven)
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
import { deployedListOf } from '../../../_utils/hypothesisRecords/carriage.js';

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
      const out = await listVersions(db, { uid: user.uid, watchlistId, withResearch: true });
      // Pilot P1b (ruling B3): the newest due version's frozen list — the only one the Forge renders a line for.
      const due = out.versions.find((v) => v?.status === 'review_due');
      if (!due) return res.status(200).json({ watchlistId, ...out });
      const deployedLists = {};
      try {
        const frozen = await deployedListOf(db, { uid: user.uid, version: due });
        if (frozen) deployedLists[due.version] = frozen;
      } catch (err) {
        console.warn(`[hypothesis] frozen list read failed for ${watchlistId} v${due.version}: ${String(err?.message || err).slice(0, 200)}`);
      }
      return res.status(200).json({ watchlistId, ...out, deployedLists });
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
