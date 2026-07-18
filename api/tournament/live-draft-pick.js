// api/tournament/live-draft-pick.js
//
// POST /api/tournament/live-draft-pick — one human pick in a COMPETITIVE live
// draft (the genericized DraftBoardRoom's submit target for the ranked/slot
// mode; the sibling of api/tournament/training-pick.js). An explicit `symbol`,
// or `autopick:true` when the client's per-pick clock expires. Thin over
// applyCompetitivePick; the wrapper owns method/flag/auth/error-mapping.
// Flag-gated (LEAGUE_LIVE_DRAFT) — 404 dark.
//
// Body: { groupId: string, symbol?: string, autopick?: boolean }.

import { runSlotEndpoint } from '../_utils/liveDraftEndpoint.js';
import { applyCompetitivePick } from '../_utils/liveDraftLifecycle.js';
import { isValidForgeId } from '../_utils/idValidation.js';

export const config = { maxDuration: 10 };

export default function handler(req, res) {
  return runSlotEndpoint(req, res, { allow: ['POST'] }, async ({ res, user, db, body }) => {
    if (!isValidForgeId(body.groupId)) {
      res.status(400).json({ error: 'bad_group', message: 'That game reference looks malformed.' });
      return;
    }
    const symbol = typeof body.symbol === 'string' && body.symbol.trim() ? body.symbol.trim() : null;
    const autopick = body.autopick === true || symbol == null;
    const result = await applyCompetitivePick(db, body.groupId, { odUserId: user.uid, symbol, autopick });
    res.status(200).json(result);
  });
}
