// api/forge/watchlists/[id]/hypothesis-transition.js
//
// Pilot P1a — the player's moves on an idea (pilot spec §2.5; the build
// prompt's "Player transitions"). ONE route, one transaction per request:
//
//   POST /api/forge/watchlists/{id}/hypothesis-transition
//     { version, action: 'ready' | 'wait' | 'reject' | 'cancel' | 'retire',
//       expectedStatus, missingEvidence? }                → { watchlistId, version }
//         researched → ready (player_ready) · waiting_for_evidence → ready
//         (evidence_supplied) · researched → waiting_for_evidence
//         (awaiting_evidence; `missingEvidence` required) · draft | researched
//         | waiting_for_evidence → rejected · any pre-deploy → cancelled ·
//         any non-terminal → retired
//     { version, action: 'reaffirm', opId, expectedVersion,
//       statement?, horizonEnum?, activation?, invalidation? } → { watchlistId, idempotent, version }
//         review_due → a NEW version v{n+1} in `ready` (same or edited
//         content); the due version keeps its status and clock and gains
//         `successorVersion`.
//
// Each is a fresh read and a compare-and-set: `expectedStatus` that no longer
// matches → 409 status_conflict; an illegal pair → 409 illegal_transition.
// Gated (http.js): off for the caller → 404 { error: 'disabled' }.

import { getFirebaseAdmin } from '../../../_utils/firebaseAdmin.js';
import {
  gateHypothesisRoute, requireOpId, requireExpectedVersion, requireVersion, parseContentPayload, sendHypothesisError,
} from '../../../_utils/hypothesisRecords/http.js';
import { transitionVersion, reaffirmVersion } from '../../../_utils/hypothesisRecords/store.js';
import {
  PLAYER_TRANSITIONS, HYPOTHESIS_STATUSES, HypothesisInputError, normalizeMissingEvidence,
} from '../../../_utils/hypothesisRecords/model.js';

export const config = { maxDuration: 10 };

export default async function handler(req, res) {
  const gate = await gateHypothesisRoute(req, res, { methods: ['POST'], rateLimit: { limit: 10, windowMs: 60_000 } });
  if (!gate) return;
  const { user, watchlistId } = gate;
  const db = getFirebaseAdmin();
  const nowIso = new Date().toISOString();

  try {
    const body = req.body || {};
    const version = requireVersion(body.version);
    const action = body.action;

    if (action === 'reaffirm') {
      const opId = requireOpId(body);
      const expectedVersion = requireExpectedVersion(body);
      const payload = parseContentPayload(body, { requireStatement: false });
      const out = await reaffirmVersion(db, { uid: user.uid, watchlistId, version, opId, expectedVersion, payload, nowIso });
      return res.status(200).json({ watchlistId, idempotent: out.idempotent, version: out.version });
    }

    if (!Object.prototype.hasOwnProperty.call(PLAYER_TRANSITIONS, action)) {
      throw new HypothesisInputError('invalid_action', `action must be one of ${[...Object.keys(PLAYER_TRANSITIONS), 'reaffirm'].join(', ')}.`);
    }
    if (!HYPOTHESIS_STATUSES.includes(body.expectedStatus)) {
      throw new HypothesisInputError('invalid_expected_status', 'expectedStatus must be the status you saw.');
    }
    const missingEvidence = action === 'wait' ? normalizeMissingEvidence(body.missingEvidence) : null;
    const out = await transitionVersion(db, {
      uid: user.uid, watchlistId, version, action, expectedStatus: body.expectedStatus, missingEvidence, nowIso,
    });
    return res.status(200).json({ watchlistId, version: out.version });
  } catch (err) {
    return sendHypothesisError(res, err, 'transition');
  }
}
