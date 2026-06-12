// api/tournament/produce-agent-boards.js
//
// P3a — POST /api/tournament/produce-agent-boards. Manual trigger for one
// group's agent board production (admin/cron secret). This is the
// PREVIEW/smoke path on the bank-daily-scores precedent: crons do not run on
// Vercel preview, so the founder drives the Monday board step through this
// endpoint and reads the per-agent summary (fallbacks, stance counts)
// straight off the response. The P3b orchestrator becomes the production
// caller; P3a owns correctness, P3b owns scheduling.
//
// Idempotent per group: members with an existing board are skipped; pass
// `force: true` (already admin-gated by construction) to regenerate.
//
// Logic lives in api/_utils/tournamentAgentBoards.js — this endpoint is
// transport + the Anthropic client singleton (the decide.js pattern).

import Anthropic from '@anthropic-ai/sdk';
import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { requireAdminSecret } from '../_utils/adminSecretAuth.js';
import { isValidForgeId } from '../_utils/idValidation.js';
import { getGroup } from '../_utils/tournamentGroupService.js';
import { produceGroupBoards, BOARDS_SENTINEL_PREFIX } from '../_utils/tournamentAgentBoards.js';
import { TOURNAMENT_TUNING } from '../../src/constants/leagueTournament.js';

// Four sequential Sonnet calls worst-case ≈ 80s — 180 is the in-repo
// precedent tier above 60 (compute-rankings.js).
export const config = { maxDuration: 180 };

const SENTINEL_TO_HTTP = Object.freeze({
  group_not_found: [404, 'group_not_found', 'Tournament group not found.'],
  not_battle: [409, 'not_battle', 'Board production requires a group in battle (user draft resolved).'],
  universe_unavailable: [503, 'universe_unavailable', `stockRankings has fewer than ${TOURNAMENT_TUNING.BOARD_DEPTH_MIN} names — rankings cron may not have run.`],
});

let anthropicClient = null;
function getAnthropicClient() {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY, maxRetries: 2 });
  }
  return anthropicClient;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }
  if (!requireAdminSecret(req, res)) return;

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  const { groupId, force = false } = body;
  if (!isValidForgeId(groupId)) {
    return res.status(400).json({ error: 'invalid_group_id', message: 'groupId is malformed.' });
  }

  try {
    const db = getFirebaseAdmin();
    const group = await getGroup(db, groupId);
    if (!group) {
      return res.status(404).json({ error: 'group_not_found', message: 'Tournament group not found.' });
    }

    const summary = await produceGroupBoards(db, group, {
      anthropic: getAnthropicClient(),
      now: new Date(),
      force: force === true,
    });

    console.log(`[Tournament] produce-agent-boards: group ${groupId} → ${summary.produced} produced (${summary.fallbacks} fallback), ${summary.skipped} skipped, ${summary.errors} error(s)`);
    return res.status(200).json({ groupId, ...summary });
  } catch (err) {
    if (typeof err?.message === 'string' && err.message.startsWith(BOARDS_SENTINEL_PREFIX)) {
      const code = err.message.slice(BOARDS_SENTINEL_PREFIX.length);
      const mapped = SENTINEL_TO_HTTP[code];
      if (mapped) {
        const [statusCode, errorKey, humanCopy] = mapped;
        return res.status(statusCode).json({
          error: errorKey,
          message: err.detail ? `${humanCopy} ${err.detail}` : humanCopy,
        });
      }
    }
    console.error('[Tournament] produce-agent-boards error:', err);
    return res.status(500).json({ error: 'server_error', message: 'Could not produce agent boards.' });
  }
}
