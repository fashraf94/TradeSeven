// api/tournament/process-claims.js
//
// P1b — POST /api/tournament/process-claims. Manual trigger for one group's
// claim resolution (admin/cron secret). This is the PREVIEW path and the
// processing-window time-control: the production cron's 9:20-9:35 AM ET
// window guard gates the nightly branch, while this endpoint is window-free
// BY CONSTRUCTION — reaching it at all requires the admin secret, so
// production behavior is untouched and unreachable without it. The per-day
// idempotency guard inside the resolution still applies (never bypassed).

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { requireAdminSecret } from '../_utils/adminSecretAuth.js';
import { isValidForgeId } from '../_utils/idValidation.js';
import { getGroup } from '../_utils/tournamentGroupService.js';
import { processClaimsForTournamentGroup } from '../_utils/tournamentClaims.js';
import { GROUP_STATUS } from '../../src/constants/leagueTournament.js';

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }
  if (!requireAdminSecret(req, res)) return;

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  const { groupId } = body;
  if (!isValidForgeId(groupId)) {
    return res.status(400).json({ error: 'invalid_group_id', message: 'groupId is malformed.' });
  }

  try {
    const db = getFirebaseAdmin();
    const group = await getGroup(db, groupId);
    if (!group) {
      return res.status(404).json({ error: 'group_not_found', message: 'Tournament group not found.' });
    }
    if (group.status !== GROUP_STATUS.BATTLE) {
      return res.status(409).json({ error: 'not_battle', message: 'Claim processing requires a group in battle.' });
    }

    const result = await processClaimsForTournamentGroup(db, group, { now: new Date() });

    console.log(`[Tournament] process-claims: group ${groupId} → ${result.status}`);
    return res.status(200).json({ groupId, ...result });
  } catch (err) {
    console.error('[Tournament] process-claims error:', err);
    return res.status(500).json({ error: 'server_error', message: 'Could not process claims.' });
  }
}
