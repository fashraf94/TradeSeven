// api/tournament/training-pick.js
//
// League Training Slice 2 — POST /api/tournament/training-pick. The human's
// live pick in the interactive snake draft. tournamentGroups is client-read-
// only (firestore.rules: write false), so the pick CANNOT be a client write
// like the legacy drafts collection's makePick — it flows through this Admin-SDK
// endpoint. Thin over applyTrainingPick (which holds the snake turn guard, the
// live createPickState write, the CPU run-up to the next human turn, and the
// transition-only completion handoff on the 12th pick).
//
// `autopick: true` is the per-pick-clock timeout (the client fires it when the
// countdown expires) — the server picks the human's top archetype-fit available
// name. A closed tab kills the client timer; the server idle-sweep
// (sweepIdleDraftingPods) is the backstop, so a stalled draft still completes.
//
// GATED dark, exactly like lobby-quickplay-training: reachable only when
// LEAGUE_NEXT_ARC_ENABLED is on OR via the ?nextArc=1 dev-invoke preview param.
// Off + no param → 404, indistinguishable from a missing route.

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { isValidForgeId } from '../_utils/idValidation.js';
import {
  applyTrainingPick,
  TRAINING_PICK_SENTINEL_PREFIX,
} from '../_utils/trainingLifecycle.js';
import { deployBaseUrl } from '../_utils/tournamentOrchestrator.js';
import { GROUP_STATUS } from '../../src/constants/leagueTournament.js';
import { LEAGUE_NEXT_ARC_ENABLED } from '../../src/config/featureFlags.js';

export const config = { maxDuration: 15 };

// League Training Slice 3 — fire the inline activation fast-lane. A pre-open
// draft inline-flips straight to BATTLE; deploy its agent layer promptly via the
// internal endpoint rather than waiting for the next morning orchestrator tick
// (the cron never ticks during market hours). FIRE-AND-FORGET: this endpoint's
// 15s cap cannot await the ~100s activation, so the orchestrator morning backstop
// (sweepTrainingActivation) is the reliability guarantee — a lost trigger is
// always recovered. Condition 3: every failure is CLASSIFIED-logged, never a
// swallowed `.catch(() => {})`.
function triggerTrainingActivation(groupId) {
  const base = deployBaseUrl();
  if (!base) {
    console.error(`[training-pick] inline activation trigger SKIPPED for ${groupId}: no deploy base URL — morning backstop will recover`);
    return;
  }
  const query = LEAGUE_NEXT_ARC_ENABLED === true ? '' : '?nextArc=1';
  fetch(`${base}/api/tournament/activate-training-pod${query}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.CRON_SECRET}` },
    body: JSON.stringify({ groupId }),
  })
    .then(async (r) => {
      if (!r.ok) {
        const text = await r.text().catch(() => '');
        console.error(`[training-pick] inline activation trigger FAILED for ${groupId}: HTTP ${r.status} ${text.slice(0, 200)} — morning backstop will recover`);
      } else {
        console.log(`[training-pick] inline activation triggered for ${groupId}`);
      }
    })
    .catch((err) => {
      console.error(`[training-pick] inline activation trigger FAILED for ${groupId}: ${err?.message} — morning backstop will recover`);
    });
}

const SENTINEL_TO_HTTP = Object.freeze({
  draft_not_found:  [404, 'draft_not_found',  'No interactive draft for that group.'],
  draft_not_active: [409, 'draft_not_active', 'This draft is not in progress.'],
  not_your_turn:    [409, 'not_your_turn',    'It is not your turn to pick.'],
  invalid_pick:     [409, 'invalid_pick',     'That name is not available on the board.'],
  no_pick_available:[409, 'no_pick_available','No name is available to autopick.'],
  pool_exhausted:   [409, 'pool_exhausted',   'The draft pool is exhausted.'],
  draft_incomplete: [409, 'draft_incomplete', 'The draft is not finished yet.'],
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }
  if (!(LEAGUE_NEXT_ARC_ENABLED === true || req.query?.nextArc === '1')) {
    return res.status(404).json({ error: 'training_disabled', message: 'Training mode is not available.' });
  }
  const user = await requireAuth(req, res);
  if (!user) return;
  const odUserId = user.uid;

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  const { groupId } = body;
  const autopick = body.autopick === true;
  const symbol = typeof body.symbol === 'string' ? body.symbol.trim().toUpperCase() : null;
  if (!isValidForgeId(groupId)) {
    return res.status(400).json({ error: 'invalid_group_id', message: 'groupId is malformed.' });
  }
  if (!autopick && !symbol) {
    return res.status(400).json({ error: 'invalid_symbol', message: 'symbol is required (or set autopick).' });
  }

  try {
    const db = getFirebaseAdmin();
    const result = await applyTrainingPick(db, groupId, { odUserId, symbol, autopick, now: new Date() });
    console.log(`[Tournament] training-pick: group ${groupId} ${odUserId} ${autopick ? '(autopick)' : symbol} → pick ${result.currentPickIndex}${result.complete ? ` (complete → ${result.status})` : ''}`);
    // The 12th pick can inline-flip the pod straight to BATTLE (R1, pre-open
    // anchor). Trigger the agent-layer activation fast-lane; the morning backstop
    // covers the AWAITING_OPEN case (and any lost trigger).
    if (result.complete && result.status === GROUP_STATUS.BATTLE) {
      triggerTrainingActivation(groupId);
    }
    return res.status(200).json({ groupId, ...result });
  } catch (err) {
    if (typeof err?.message === 'string' && err.message.startsWith(TRAINING_PICK_SENTINEL_PREFIX)) {
      const code = err.message.slice(TRAINING_PICK_SENTINEL_PREFIX.length);
      const mapped = SENTINEL_TO_HTTP[code];
      if (mapped) {
        const [statusCode, errorKey, humanCopy] = mapped;
        return res.status(statusCode).json({
          error: errorKey,
          message: err.detail ? `${humanCopy} ${err.detail}` : humanCopy,
        });
      }
    }
    console.error('[Tournament] training-pick error:', err);
    return res.status(500).json({ error: 'server_error', message: 'Could not apply the pick.' });
  }
}
