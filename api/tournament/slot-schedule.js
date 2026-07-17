// api/tournament/slot-schedule.js
//
// GET /api/tournament/slot-schedule — the week's Competitive Live Draft slots
// with per-slot human counts + seated names (the Phase-4 picker feed:
// "Sun 7pm · 3 humans waiting"). A cheap per-occurrence doc read, no
// subscription. Thin over getSlotOccupancy; the wrapper owns
// method/flag/auth/error-mapping. Flag-gated (LEAGUE_LIVE_DRAFT) — 404 dark.

import { runSlotEndpoint } from '../_utils/liveDraftEndpoint.js';
import { getSlotOccupancy } from '../_utils/liveDraftFormation.js';

export const config = { maxDuration: 10 };

export default function handler(req, res) {
  return runSlotEndpoint(req, res, { allow: ['GET'] }, async ({ res, db }) => {
    const slots = await getSlotOccupancy(db);
    res.status(200).json({ slots });
  });
}
