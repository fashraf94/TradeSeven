// api/tournament/slot-claim.js
//
// POST /api/tournament/slot-claim — claim a seat in a Competitive Live Draft
// slot (Phase 1). The FIRST claim lazily creates the slot's FORMING group at a
// deterministic per-occurrence id, stamped with its fire instant + Monday battle
// anchor; subsequent claims join the same group up to four seats. Idempotent on
// a re-claim (no double-seat). Thin over claimSlotSeat; the wrapper owns
// method/flag/auth/error-mapping. Flag-gated (LEAGUE_LIVE_DRAFT) — 404 dark.
//
// Body: { slotId: string, displayName?: string }.

import { runSlotEndpoint, resolveDisplayName } from '../_utils/liveDraftEndpoint.js';
import { claimSlotSeat } from '../_utils/liveDraftFormation.js';
import { isKnownSlotId } from '../../src/config/liveDraftSlots.js';

export const config = { maxDuration: 10 };

export default function handler(req, res) {
  return runSlotEndpoint(req, res, { allow: ['POST'] }, async ({ res, user, db, body }) => {
    if (!isKnownSlotId(body.slotId)) {
      res.status(400).json({ error: 'unknown_slot', message: 'That draft slot isn’t on the schedule.' });
      return;
    }
    const displayName = resolveDisplayName(body, user);
    const result = await claimSlotSeat(db, { slotId: body.slotId, odUserId: user.uid, displayName });
    res.status(200).json(result);
  });
}
