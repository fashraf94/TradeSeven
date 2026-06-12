// api/tournament/resolve-agent-draft.js
//
// P3a — POST /api/tournament/resolve-agent-draft. Manual trigger for one
// group's agent draft resolution + ledger acquisition (admin/cron secret) —
// the PREVIEW/smoke path on the resolve-user-draft precedent; the P3b
// orchestrator becomes the production caller.
//
// Safe to re-invoke: an already-resolved group never re-resolves — the
// handler re-ensures the reserveBulk acquisition from the stored stream
// (healing the stream-written/acquisition-lost crash window) and reports
// `already_resolved`. An `acquisition_conflict` response (409) means the
// ledger gained a rival holder between resolution and acquisition — founder
// attention, never blind retry (nightly reconciliation arbitrates from
// battle docs).
//
// Logic lives in api/_utils/tournamentAgentDraft.js — this endpoint is
// transport only.

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { requireAdminSecret } from '../_utils/adminSecretAuth.js';
import { isValidForgeId } from '../_utils/idValidation.js';
import { getGroup } from '../_utils/tournamentGroupService.js';
import { resolveAgentDraftForGroup, DRAFT_SENTINEL_PREFIX } from '../_utils/tournamentAgentDraft.js';

export const config = { maxDuration: 30 };

const SENTINEL_TO_HTTP = Object.freeze({
  group_not_found: [404, 'group_not_found', 'Tournament group not found.'],
  not_battle: [409, 'not_battle', 'Agent draft requires a group in battle (user draft resolved).'],
  boards_missing: [409, 'boards_missing', 'Every member needs an agent board first (produce-agent-boards).'],
  universe_unavailable: [503, 'universe_unavailable', 'stockRankings unavailable — the exhaustion-fallback catalog is required.'],
  catalog_exhausted: [409, 'catalog_exhausted', 'No available name left for an agent — catalog exhausted mid-resolution.'],
});

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

    const result = await resolveAgentDraftForGroup(db, group, { now: new Date() });

    if (result.status === 'acquisition_conflict') {
      return res.status(409).json({ groupId, error: 'acquisition_conflict', conflicts: result.conflicts });
    }

    console.log(`[Tournament] resolve-agent-draft: group ${groupId} → ${result.status} (${result.heldCount} held)`);
    return res.status(200).json({ groupId, ...result });
  } catch (err) {
    if (typeof err?.message === 'string' && err.message.startsWith(DRAFT_SENTINEL_PREFIX)) {
      const code = err.message.slice(DRAFT_SENTINEL_PREFIX.length);
      const mapped = SENTINEL_TO_HTTP[code];
      if (mapped) {
        const [statusCode, errorKey, humanCopy] = mapped;
        return res.status(statusCode).json({
          error: errorKey,
          message: err.detail ? `${humanCopy} ${err.detail}` : humanCopy,
        });
      }
    }
    console.error('[Tournament] resolve-agent-draft error:', err);
    return res.status(500).json({ error: 'server_error', message: 'Could not resolve the agent draft.' });
  }
}
