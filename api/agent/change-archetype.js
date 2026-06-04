// api/agent/change-archetype.js
//
// POST /api/agent/change-archetype. Changes an agent's archetype (its trading
// personality / identity). The archetype drives decide.js scoring + prompt
// context downstream; this endpoint writes ONLY agent.archetype (+ updatedAt) —
// the field those configs READ. It never touches the archetype config files.
//
// Battle-locked (mirrors equip-watchlist E3 / the equipBundle activeBattleId
// guard): a change is blocked while the agent has an active battle, so a live
// battle's frozen archetype can't shift under it. Idempotent: re-selecting the
// current archetype is a 200 no-op with no write and no shadow log. Atomic: the
// agent read + write happen in one transaction.
//
// Pattern reference: api/agent/equip-watchlist.js (transaction body, sentinel
// error map, shadow-log fire-and-forget). Delta: single-doc read+write (agents).

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { logSignalDrops } from '../_utils/shadowLogger.js';
import { isValidForgeId, FORGE_ID_REGEX, FORGE_ID_MAX_LEN } from '../_utils/idValidation.js';
import { waitUntil } from '@vercel/functions';

export const config = { maxDuration: 10 };

// The six stable archetype code-ids. The server cannot import from src/, so this
// mirrors the canonical set (keys of ARCHETYPE_DEFAULT_TRAITS in
// src/data/traitLibrary.js; also api/_utils/agentArchetypeConfig.js). These ids
// are contractually locked (ARCHETYPE_IDENTITY_CONTRACT_V1.md §1) — never renamed.
const VALID_ARCHETYPES = Object.freeze(new Set([
  'momentum_chaser', 'contrarian', 'diversifier', 'degen', 'analyst', 'guardian',
]));

const SENTINEL_PREFIX = '__change_archetype:';
const SENTINEL_TO_HTTP = Object.freeze({
  agent_not_found: [404, 'agent_not_found', 'Agent not found.'],
  forbidden:       [403, 'forbidden',       'Not authorized for this resource.'],
  battle_active:   [409, 'battle_active',   'Cannot change archetype while the agent has an active battle.'],
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

  const { agentId, archetype } = req.body || {};
  if (!isValidForgeId(agentId)) {
    return res.status(400).json({
      error: 'invalid_agent_id',
      message: `agentId must match ${FORGE_ID_REGEX} and be ≤${FORGE_ID_MAX_LEN} chars`,
    });
  }
  if (typeof archetype !== 'string' || !VALID_ARCHETYPES.has(archetype)) {
    return res.status(400).json({
      error: 'invalid_archetype',
      message: 'Unknown archetype code.',
    });
  }

  const db = getFirebaseAdmin();
  const agentRef = db.collection('agents').doc(agentId);
  const nowIso = new Date().toISOString();

  let txResult;
  try {
    txResult = await db.runTransaction(async (tx) => {
      const agentSnap = await tx.get(agentRef);

      // Agent must exist, belong to the caller, and be battle-free.
      if (!agentSnap.exists) throw new Error(SENTINEL_PREFIX + 'agent_not_found');
      const agent = agentSnap.data();
      if (agent.ownerId !== user.uid) throw new Error(SENTINEL_PREFIX + 'forbidden');
      if (agent.activeBattleId) throw new Error(SENTINEL_PREFIX + 'battle_active');

      // Idempotent: archetype already set → 200 no-op, no write.
      if (agent.archetype === archetype) {
        return { idempotent: true, archetype, previousArchetype: archetype };
      }

      const previousArchetype = agent.archetype ?? null;
      tx.update(agentRef, { archetype, updatedAt: nowIso });
      return { idempotent: false, archetype, previousArchetype };
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
    console.error('[change-archetype] error:', txErr);
    return res.status(500).json({ error: 'server_error', message: 'Could not change archetype.' });
  }

  // Shadow log only on a real change (no log on idempotent no-op), fire-and-forget.
  if (!txResult.idempotent) {
    waitUntil(
      logSignalDrops({
        stage: 'archetype_change',
        userId: user.uid,
        agentId,
        fromArchetype: txResult.previousArchetype,
        toArchetype: txResult.archetype,
        loggedAt: nowIso,
      }).catch(() => {}),
    );
  }

  console.log(
    `[change-archetype] agent ${agentId} → ${txResult.archetype} (idempotent=${txResult.idempotent})`,
  );

  return res.status(200).json({
    agentId,
    archetype: txResult.archetype,
    idempotent: txResult.idempotent,
  });
}
