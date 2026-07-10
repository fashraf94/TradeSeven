// api/agent/update-agent-settings.js
//
// Release 2 — R1(a) settingsRev-completeness migration (founder ruling
// 2026-07-10, Phase-1 STOP): POST /api/agent/update-agent-settings. The
// narrow, ALLOWLISTED transactional write path for the snapshot-feeding
// agent fields whose live writers previously used raw client updateDoc with
// no settingsRev bump:
//
//   - equippedTraits   (useTraits.persistTraits incl. the orphan
//                       auto-unequip; seedDefaultTraits / reseedDefaultTraits)
//   - deployedStrategy (deployStrategyService.deployExperimentToAgent /
//                       clearDeployedStrategy; null clears)
//
// Semantics preserved 1:1 from the client writers (NO battle-lock — none of
// the three had one; deployExperimentToAgent pre-checks activeBattleId
// itself and the equip-bundle half enforces server-side), PLUS:
//   - agent.settingsRev increments structurally on every real write
//     (txUpdateAgentSettings — spec changelog #7)
//   - identical-value writes are idempotent 200 no-ops (no phantom revs
//     from redundant UI persists)
//   - lastDeployedAt is stamped server-side (ISO) whenever a non-null
//     deployedStrategy lands — matching decide.js's own ISO writes
//     (decide.js:523/:1079) and its `new Date(agent.lastDeployedAt)` read.
//
// The allowlist is EXACT: any other key in `set` is a 400. Growing it is a
// deliberate act (add the key + its validator + its test), never a default.
//
// Pattern reference: api/agent/equip-lean.js (sentinel map, tx body).

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { txUpdateAgentSettings } from '../_utils/agentSettingsTx.js';
import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { isValidForgeId, FORGE_ID_REGEX, FORGE_ID_MAX_LEN } from '../_utils/idValidation.js';

export const config = { maxDuration: 10 };

const MAX_EQUIPPED_TRAITS = 20;
const MAX_DEPLOYED_STRATEGY_BYTES = 64 * 1024;

const SENTINEL_PREFIX = '__update_agent_settings:';
const SENTINEL_TO_HTTP = Object.freeze({
  agent_not_found: [404, 'agent_not_found', 'Agent not found.'],
  forbidden:       [403, 'forbidden',       'Not authorized for this resource.'],
});

// Per-field validators — returning an error string rejects the request.
const FIELD_VALIDATORS = Object.freeze({
  equippedTraits(value) {
    if (!Array.isArray(value)) return 'equippedTraits must be an array.';
    if (value.length > MAX_EQUIPPED_TRAITS) return `equippedTraits must have ≤${MAX_EQUIPPED_TRAITS} entries.`;
    for (const entry of value) {
      if (!entry || typeof entry !== 'object' || typeof entry.traitId !== 'string' || !entry.traitId) {
        return 'every equippedTraits entry must be an object with a string traitId.';
      }
    }
    return null;
  },
  deployedStrategy(value) {
    if (value === null) return null; // the clear gesture
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return 'deployedStrategy must be an object or null.';
    }
    if (JSON.stringify(value).length > MAX_DEPLOYED_STRATEGY_BYTES) {
      return 'deployedStrategy payload too large.';
    }
    return null;
  },
});

export default async function handler(req, res) {
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 30, windowMs: 60_000 } })) {
    return;
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  const { agentId, set } = req.body || {};
  if (!isValidForgeId(agentId)) {
    return res.status(400).json({
      error: 'invalid_agent_id',
      message: `agentId must match ${FORGE_ID_REGEX} and be ≤${FORGE_ID_MAX_LEN} chars`,
    });
  }
  if (!set || typeof set !== 'object' || Array.isArray(set) || Object.keys(set).length === 0) {
    return res.status(400).json({
      error: 'invalid_set',
      message: 'set must be a non-empty object of allowlisted fields.',
    });
  }
  for (const [key, value] of Object.entries(set)) {
    const validator = FIELD_VALIDATORS[key];
    if (!validator) {
      return res.status(400).json({
        error: 'field_not_allowlisted',
        message: `"${key}" is not an allowlisted settings field (allowed: ${Object.keys(FIELD_VALIDATORS).join(', ')}).`,
      });
    }
    const problem = validator(value);
    if (problem) {
      return res.status(400).json({ error: 'invalid_field', message: problem });
    }
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
      // NO battle-lock — parity with the migrated client writers (see header).

      // Idempotent: every requested field already deep-equals the stored
      // value → 200 no-op, no phantom settingsRev.
      const changed = Object.entries(set).some(
        ([key, value]) => JSON.stringify(agent[key] ?? null) !== JSON.stringify(value ?? null),
      );
      if (!changed) {
        return { idempotent: true };
      }

      // settingsRev rides structurally (Release 2 changelog #7). A non-null
      // deployedStrategy also stamps lastDeployedAt (ISO — see header).
      const stampLastDeployed = 'deployedStrategy' in set && set.deployedStrategy !== null;
      txUpdateAgentSettings(tx, agentRef, {
        ...set,
        ...(stampLastDeployed ? { lastDeployedAt: nowIso } : {}),
        updatedAt: nowIso,
      });
      return { idempotent: false };
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
    console.error('[update-agent-settings] error:', txErr);
    return res.status(500).json({ error: 'server_error', message: 'Could not update agent settings.' });
  }

  console.log(`[update-agent-settings] agent ${agentId} fields=[${Object.keys(set).join(',')}] (idempotent=${txResult.idempotent})`);

  return res.status(200).json({
    agentId,
    fields: Object.keys(set),
    idempotent: txResult.idempotent,
  });
}
