// api/agent/unequip-lean.js
//
// Release 2 (Fenced Customization Bundle V1.1) — POST /api/agent/unequip-lean
// (spec Phase 1 item 2). Removes one standing lean by adjustment id.
//
// DARK-INERT (404 while STANDING_LEANS_ENABLED is false) and battle-locked
// like the equip side — lean state is frozen into the battle snapshot at
// creation, so mid-battle writes are refused rather than silently ignored
// (master spec §3.1 battle-lock; unlike bundles, there is no mid-battle
// sub-flow that needs lean unequips).
//
// Pattern reference: api/agent/unequip-watchlist.js.

import { FieldValue } from 'firebase-admin/firestore';
import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { logSignalDrops } from '../_utils/shadowLogger.js';
import { isValidForgeId, FORGE_ID_REGEX, FORGE_ID_MAX_LEN } from '../_utils/idValidation.js';
import { STANDING_LEANS_ENABLED } from '../../src/config/featureFlags.js';
import { waitUntil } from '@vercel/functions';

export const config = { maxDuration: 10 };

const SENTINEL_PREFIX = '__unequip_lean:';
const SENTINEL_TO_HTTP = Object.freeze({
  agent_not_found: [404, 'agent_not_found', 'Agent not found.'],
  forbidden:       [403, 'forbidden',       'Not authorized for this resource.'],
  battle_active:   [409, 'battle_active',   'Cannot change standing leans while the agent has an active battle.'],
});

export default async function handler(req, res) {
  if (!STANDING_LEANS_ENABLED) {
    return res.status(404).json({ error: 'not_found' });
  }
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 10, windowMs: 60_000 } })) {
    return;
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  const { agentId, adjustmentId } = req.body || {};
  if (!isValidForgeId(agentId)) {
    return res.status(400).json({
      error: 'invalid_agent_id',
      message: `agentId must match ${FORGE_ID_REGEX} and be ≤${FORGE_ID_MAX_LEN} chars`,
    });
  }
  if (typeof adjustmentId !== 'string' || adjustmentId.length === 0 || adjustmentId.length > 16) {
    return res.status(400).json({
      error: 'invalid_adjustment_id',
      message: 'adjustmentId is required.',
    });
  }

  const db = getFirebaseAdmin();
  const agentRef = db.collection('agents').doc(agentId);
  const nowIso = new Date().toISOString();

  let txResult;
  try {
    txResult = await db.runTransaction(async (tx) => {
      const agentSnap = await tx.get(agentRef);
      if (!agentSnap.exists) throw new Error(SENTINEL_PREFIX + 'agent_not_found');
      const agent = agentSnap.data();
      if (agent.ownerId !== user.uid) throw new Error(SENTINEL_PREFIX + 'forbidden');
      if (agent.activeBattleId) throw new Error(SENTINEL_PREFIX + 'battle_active');

      const current = Array.isArray(agent.standingLeans) ? agent.standingLeans : [];
      const remaining = current.filter((l) => l?.adjustmentId !== adjustmentId);

      // Idempotent: not equipped → 200 no-op, no write.
      if (remaining.length === current.length) {
        return { idempotent: true, standingLeans: current };
      }

      tx.update(agentRef, {
        standingLeans: remaining,
        updatedAt: nowIso,
        // Release 2 (spec changelog #7): monotonic settings revision.
        settingsRev: FieldValue.increment(1),
      });
      return { idempotent: false, standingLeans: remaining };
    });
  } catch (txErr) {
    if (typeof txErr?.message === 'string' && txErr.message.startsWith(SENTINEL_PREFIX)) {
      const code = txErr.message.slice(SENTINEL_PREFIX.length);
      const mapped = SENTINEL_TO_HTTP[code];
      if (mapped) {
        const [statusCode, errorKey, humanCopy] = mapped;
        return res.status(statusCode).json({ error: errorKey, message: humanCopy });
      }
    }
    console.error('[unequip-lean] error:', txErr);
    return res.status(500).json({ error: 'server_error', message: 'Could not unequip lean.' });
  }

  if (!txResult.idempotent) {
    waitUntil(
      logSignalDrops({
        stage: 'standing_lean_unequip',
        userId: user.uid,
        agentId,
        adjustmentId,
        loggedAt: nowIso,
      }).catch(() => {}),
    );
  }

  console.log(`[unequip-lean] agent ${agentId} - ${adjustmentId} (idempotent=${txResult.idempotent})`);

  return res.status(200).json({
    agentId,
    adjustmentId,
    standingLeans: txResult.standingLeans,
    idempotent: txResult.idempotent,
  });
}
