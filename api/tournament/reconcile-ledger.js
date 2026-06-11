// api/tournament/reconcile-ledger.js
//
// P2 — POST /api/tournament/reconcile-ledger. Manual trigger for one group's
// agent held-set reconciliation (admin secret). This is the PREVIEW/smoke
// path on the bank-daily-scores precedent: crons do not run on Vercel
// preview, so the founder drives the nightly derived rebuild through this
// endpoint and reads the divergence report straight off the response. It is
// also the P9 verification surface ("ledger reconciliation clean for 5
// days") for spot checks between nightly runs.
//
// Production reconciliation rides the nightly snake-draft-daily-scores
// handler's tournament branch (zero new cron entries). Reconciliation is
// always safe to run — it rebuilds from the battle docs (derived truth) and
// only clears reservations past the TTL — so unlike banking there is no
// trading-day guard and no idempotency window.

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { requireAdminSecret } from '../_utils/adminSecretAuth.js';
import { isValidForgeId } from '../_utils/idValidation.js';
import { getGroup } from '../_utils/tournamentGroupService.js';
import { reconcileGroupLedger } from '../_utils/tournamentAgentLedger.js';
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
      return res.status(409).json({ error: 'not_battle', message: 'Reconciliation targets groups in battle.' });
    }

    const result = await reconcileGroupLedger(db, group, { now: new Date() });

    console.log(`[Tournament] reconcile-ledger: group ${groupId} → ${result.heldCount} held, ${result.divergences.length} divergence(s), ${result.staleCleared} stale reservation(s) cleared`);
    return res.status(200).json(result);
  } catch (err) {
    console.error('[Tournament] reconcile-ledger error:', err);
    return res.status(500).json({ error: 'server_error', message: 'Could not reconcile the agent ledger.' });
  }
}
