// api/tournament/activate-training-pod.js
//
// League Training Slice 3 — INTERNAL activation endpoint. The live-pick path's
// fast lane: when a player finishes their draft pre-open, the pod inline-flips
// to BATTLE and api/tournament/training-pick.js fires a (fire-and-forget) POST
// here so the agent layer (the human clone + CPUs, flat6) deploys promptly,
// rather than waiting for the next morning orchestrator tick (the cron never
// ticks during market hours). The orchestrator morning backstop
// (sweepTrainingActivation) is the reliability guarantee — this endpoint is the
// prompt fast-lane, idempotent with it (activateTrainingPod skips already-done
// work), so a lost trigger is always recovered.
//
// INTERNAL-ONLY: Bearer CRON_SECRET (the decide.js internal-caller idiom) —
// never a browser. Dark-gated exactly like training-pick: reachable only when
// LEAGUE_NEXT_ARC_ENABLED OR ?nextArc=1. maxDuration 300s (the orchestrator-cron
// ceiling, Condition 4) — ample headroom over the worst case (Sonnet human-clone
// board + draft resolve + the ~80s paced 4-seat deploy). A kill mid-fan-out is
// idempotent-recoverable: the morning backstop re-runs and the today's-battle
// guard skips already-deployed seats.

import Anthropic from '@anthropic-ai/sdk';
import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { getGroup } from '../_utils/tournamentGroupService.js';
import { activateTrainingPod } from '../_utils/tournamentOrchestrator.js';
import { isValidForgeId } from '../_utils/idValidation.js';
import { GROUP_STATUS } from '../../src/constants/leagueTournament.js';
import { LEAGUE_NEXT_ARC_ENABLED } from '../../src/config/featureFlags.js';

export const config = { maxDuration: 300 };

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
  // Dark gate — indistinguishable from a missing route when off + no param.
  if (!(LEAGUE_NEXT_ARC_ENABLED === true || req.query?.nextArc === '1')) {
    return res.status(404).json({ error: 'training_disabled', message: 'Training mode is not available.' });
  }
  // Internal-only: CRON_SECRET. An unset secret can never authorize anyone.
  const isInternal = Boolean(process.env.CRON_SECRET) && req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`;
  if (!isInternal) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  const { groupId } = body;
  if (!isValidForgeId(groupId)) {
    return res.status(400).json({ error: 'invalid_group_id', message: 'groupId is malformed.' });
  }

  try {
    const db = getFirebaseAdmin();
    const group = await getGroup(db, groupId);
    if (!group) {
      return res.status(404).json({ error: 'group_not_found' });
    }
    if (group.isTraining !== true) {
      return res.status(409).json({ error: 'not_a_training_pod' });
    }
    if (group.status !== GROUP_STATUS.BATTLE) {
      // Not yet flipped (or already completed) — the morning backstop handles it.
      return res.status(409).json({ error: 'not_in_battle', status: group.status });
    }

    const summary = await activateTrainingPod(db, { id: groupId, ...group }, {
      now: new Date(),
      anthropic: getAnthropicClient(),
      budget: null, // run all 4 seats to completion — no defer (endpoint, not a shared tick)
    });
    console.log(`[Tournament] activate-training-pod: ${groupId} → ${JSON.stringify(summary)}`);
    return res.status(200).json({ groupId, ...summary });
  } catch (err) {
    console.error('[Tournament] activate-training-pod error:', err);
    return res.status(500).json({ error: 'server_error', message: 'Could not activate the training pod.' });
  }
}
