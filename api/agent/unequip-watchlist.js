// api/agent/unequip-watchlist.js
//
// Phase 5B1 — POST /api/agent/unequip-watchlist. Clears the agent's equipped
// watchlist (equippedWatchlistId / Name / At → null).
//
// Idempotent: unequipping when nothing is equipped is a 200 no-op with no
// shadow log (V-10). Blocked while the agent has an active battle, mirroring
// the equip endpoint and the equipBundle activeBattleId guard.
//
// Pattern reference: api/forge/watchlists/[id]/uncommit.js (transaction body,
// sentinel error map, shadow-log fire-and-forget).

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { txUpdateAgentSettings } from '../_utils/agentSettingsTx.js';
import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { logSignalDrops } from '../_utils/shadowLogger.js';
import { isValidForgeId, FORGE_ID_REGEX, FORGE_ID_MAX_LEN } from '../_utils/idValidation.js';
import { waitUntil } from '@vercel/functions';
// Archetype Phase 2 (P2.4a): DARK equip-time compiler — both calls return
// null before any read/write while COMPILER_ENABLED=false (byte-identical).
import { COMPILER_ENABLED } from '../../src/config/featureFlags.js';
import { prepareCompileInputs, writeCompiledBuildsInTx } from '../_utils/compileOnSettingsChange.js';
import { validateWriteEpochInTx } from '../_utils/compositionWriteEpoch.js';

export const config = { maxDuration: 10 };

const SENTINEL_PREFIX = '__unequip_watchlist:';
const SENTINEL_TO_HTTP = Object.freeze({
  epoch_closed:     [409, 'epoch_closed',     'Configuration writes are briefly paused for a system identity update. Try again in a few minutes.'],
  agent_not_found: [404, 'agent_not_found', 'Agent not found.'],
  forbidden:       [403, 'forbidden',       'Not authorized for this agent.'],
  battle_active:   [409, 'battle_active',   'Cannot unequip a watchlist while the agent has an active battle.'],
});

export default async function handler(req, res) {
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 10, windowMs: 60_000 } })) {
    return;
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  const { agentId } = req.body || {};
  if (!isValidForgeId(agentId)) {
    return res.status(400).json({
      error: 'invalid_agent_id',
      message: `agentId must match ${FORGE_ID_REGEX} and be ≤${FORGE_ID_MAX_LEN} chars`,
    });
  }

  const db = getFirebaseAdmin();
  const agentRef = db.collection('agents').doc(agentId);
  const nowIso = new Date().toISOString();

  let txResult;
  try {
    txResult = await db.runTransaction(async (tx) => {
      const agentSnap = await tx.get(agentRef);
      // Composition write-epoch fence (design note §3): read-phase validation —
      // zero I/O while dark; a closed epoch 409s with nothing written (A41).
      await validateWriteEpochInTx(tx, db, { sentinel: SENTINEL_PREFIX });
      if (!agentSnap.exists) throw new Error(SENTINEL_PREFIX + 'agent_not_found');
      const agent = agentSnap.data();
      if (agent.ownerId !== user.uid) throw new Error(SENTINEL_PREFIX + 'forbidden');
      if (agent.activeBattleId) throw new Error(SENTINEL_PREFIX + 'battle_active');

      // Idempotent: nothing equipped → 200 no-op, no write.
      if (!agent.equippedWatchlistId) {
        return { idempotent: true };
      }

      // P2.4a compile reads (dark no-op): must precede the first tx write.
      const compileInputs = await prepareCompileInputs(tx, {
        agentRef,
        nextEquippedBundleIds: agent.equippedBundleIds || [],
        enabled: COMPILER_ENABLED,
      });
      // settingsRev rides structurally (Release 2 changelog #7).
      txUpdateAgentSettings(tx, agentRef, {
        equippedWatchlistId: null,
        equippedWatchlistName: null,
        equippedAt: null,
        updatedAt: nowIso,
      });
      // P2.4a (dark no-op): compile rides the settingsRev increment above.
      const compilePreviews = writeCompiledBuildsInTx(tx, {
        agentRef,
        agentId,
        agent,
        nextState: {},
        bundles: compileInputs?.bundles,
        enabled: COMPILER_ENABLED,
        nowIso,
      });
      return { idempotent: false, compilePreviews };
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
    console.error('[Phase5B1] unequip-watchlist error:', txErr);
    return res.status(500).json({ error: 'server_error', message: 'Could not unequip watchlist.' });
  }

  // Shadow log only on a real state change (no log on idempotent no-op).
  if (!txResult.idempotent) {
    waitUntil(
      logSignalDrops({
        stage: 'watchlist_unequip',
        userId: user.uid,
        agentId,
        loggedAt: nowIso,
      }).catch(() => {}),
    );
  }

  console.log(
    `[Phase5B1] unequip-watchlist: agent ${agentId} (idempotent=${txResult.idempotent})`,
  );

  // compilePreviews is ADDITIVE and appears only under COMPILER_ENABLED (P2.4a).
  return res.status(200).json({
    agentId,
    equippedWatchlistId: null,
    idempotent: txResult.idempotent,
    ...(txResult.compilePreviews ? { compilePreviews: txResult.compilePreviews } : {}),
  });
}
