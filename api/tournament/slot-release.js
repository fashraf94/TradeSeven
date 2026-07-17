// api/tournament/slot-release.js
//
// POST /api/tournament/slot-release — release a seat in a Competitive Live Draft
// slot before it fires (Phase 1). Frees the seat; the LAST human leaving deletes
// the group (structural expiry — "0 humans = never materializes"). Idempotent on
// an already-gone group or a non-member. Thin over releaseSlotSeat; the wrapper
// owns method/flag/auth/error-mapping. Flag-gated (LEAGUE_LIVE_DRAFT) — 404 dark.
//
// Body: { groupId: string }  (the slot group id returned by slot-claim).

import { runSlotEndpoint } from '../_utils/liveDraftEndpoint.js';
import { releaseSlotSeat } from '../_utils/liveDraftFormation.js';
import { isValidForgeId } from '../_utils/idValidation.js';

export const config = { maxDuration: 10 };

export default function handler(req, res) {
  return runSlotEndpoint(req, res, { allow: ['POST'] }, async ({ res, user, db, body }) => {
    if (!isValidForgeId(body.groupId)) {
      res.status(400).json({ error: 'bad_group', message: 'That game reference looks malformed.' });
      return;
    }
    const result = await releaseSlotSeat(db, body.groupId, { odUserId: user.uid });
    res.status(200).json(result);
  });
}
