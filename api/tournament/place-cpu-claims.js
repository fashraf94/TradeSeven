// api/tournament/place-cpu-claims.js
//
// Slice 4 (B4) — POST /api/tournament/place-cpu-claims. Manual trigger for ONE
// training pod's CPU claim placement (admin/cron secret). This is the PREVIEW
// path and the dev/dark exercise's hook: production placement rides the nightly
// banking host (snake-draft-daily-scores), which does NOT run on Vercel preview,
// so this admin-secret endpoint is how the dev exercise drives CPU contention.
// Window-free BY CONSTRUCTION — reaching it requires the admin secret, so
// production behavior is untouched and unreachable without it. The per-cycle
// idempotency guard (claimSystem.lastCpuClaimDay) inside placement still applies.
//
// `simulatedNow` (admin-gated, the P1b idiom) lets the dev exercise advance the
// pod through days to exercise drop-worst → place → resolve across a week.

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { requireAdminSecret } from '../_utils/adminSecretAuth.js';
import { isValidForgeId } from '../_utils/idValidation.js';
import { getGroup } from '../_utils/tournamentGroupService.js';
import { placeCpuClaimsForGroup } from '../_utils/tournamentCpuClaims.js';
import { parseSimulatedNow } from '../_utils/tournamentTime.js';
import { GROUP_STATUS } from '../../src/constants/leagueTournament.js';

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }
  if (!requireAdminSecret(req, res)) return;

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  const { groupId, simulatedNow } = body;
  if (!isValidForgeId(groupId)) {
    return res.status(400).json({ error: 'invalid_group_id', message: 'groupId is malformed.' });
  }
  const parsed = parseSimulatedNow(simulatedNow);
  if (parsed.error) {
    return res.status(400).json({ error: 'invalid_simulated_now', message: parsed.error });
  }

  try {
    const db = getFirebaseAdmin();
    const group = await getGroup(db, groupId);
    if (!group) {
      return res.status(404).json({ error: 'group_not_found', message: 'Tournament group not found.' });
    }
    if (group.isTraining !== true) {
      return res.status(409).json({ error: 'not_training', message: 'CPU claim placement is training-scoped.' });
    }
    if (group.status !== GROUP_STATUS.BATTLE) {
      return res.status(409).json({ error: 'not_battle', message: 'CPU claim placement requires a group in battle.' });
    }

    const result = await placeCpuClaimsForGroup(db, group, { now: parsed.now });
    console.log(`[Tournament] place-cpu-claims: group ${groupId} → ${result.status} (placed ${result.placed})`);
    return res.status(200).json({ groupId, ...result });
  } catch (err) {
    console.error('[Tournament] place-cpu-claims error:', err);
    return res.status(500).json({ error: 'server_error', message: 'Could not place CPU claims.' });
  }
}
