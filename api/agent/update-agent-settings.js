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
//   - strategyLastDeployedAt is stamped server-side (ISO) whenever a
//     non-null deployedStrategy lands. ADDITIVE field, deliberately NOT
//     lastDeployedAt: decide.js's 2-min deploy cooldown (decide.js:157-162)
//     reads lastDeployedAt, and the legacy client writer's serverTimestamp()
//     never armed it (`new Date(Timestamp)` → Invalid Date → NaN compare →
//     false), so stamping lastDeployedAt here would newly 429 decide.js
//     deploys within 2 min of a strategy deploy — a behavior change this
//     migration must not smuggle in (/code-review, Phase-2).
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
const MAX_TRAIT_ID_CHARS = 64;
const MAX_EQUIPPED_TRAITS_BYTES = 64 * 1024; // whole-array cap, mirroring deployedStrategy
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
      if (entry.traitId.length > MAX_TRAIT_ID_CHARS) {
        return `every traitId must be ≤${MAX_TRAIT_ID_CHARS} chars.`;
      }
    }
    // Whole-payload byte cap (/code-review Phase-5): entries land verbatim in
    // the agent doc and flow into every battle snapshot — unbounded junk keys
    // are the same 1 MiB doc-limit class the deployedStrategy cap closes.
    if (JSON.stringify(value).length > MAX_EQUIPPED_TRAITS_BYTES) {
      return 'equippedTraits payload too large.';
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

// JSON.stringify with recursively SORTED object keys, mirroring its other
// semantics (undefined properties dropped, undefined array slots → null).
// The idempotence check compares a client payload against Firestore data,
// and Firestore map keys come back sorted — insertion order carries no
// meaning, so it must not read as a change and mint a phantom settingsRev.
// Array order IS preserved (it is meaningful for equippedTraits). Both sides
// are JSON-shaped: the request by the validators, the at-rest value because
// this endpoint (or the JSON-payload client writers it replaced) wrote it.
function stableStringify(value) {
  if (value === undefined) return undefined;
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v) ?? 'null').join(',')}]`;
  }
  const body = Object.keys(value)
    .sort()
    .map((k) => {
      const v = stableStringify(value[k]);
      return v === undefined ? undefined : `${JSON.stringify(k)}:${v}`;
    })
    .filter((s) => s !== undefined)
    .join(',');
  return `{${body}}`;
}

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
    // Object.hasOwn, never a bare property lookup: JSON bodies can carry own
    // keys like "__proto__" or "constructor" that a plain FIELD_VALIDATORS[key]
    // would resolve THROUGH the prototype chain to a non-validator function
    // (/code-review, Phase-2). Prototype-chain names are simply "not
    // allowlisted" like any other stranger key.
    if (!Object.hasOwn(FIELD_VALIDATORS, key)) {
      return res.status(400).json({
        error: 'field_not_allowlisted',
        message: `"${key}" is not an allowlisted settings field (allowed: ${Object.keys(FIELD_VALIDATORS).join(', ')}).`,
      });
    }
    const validator = FIELD_VALIDATORS[key];
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
      // value → 200 no-op, no phantom settingsRev. Stable stringify, not
      // plain JSON.stringify — Firestore returns map keys in ITS order, not
      // the client's insertion order, so key order must not read as change.
      const changed = Object.entries(set).some(
        ([key, value]) => stableStringify(agent[key] ?? null) !== stableStringify(value ?? null),
      );
      if (!changed) {
        return { idempotent: true };
      }

      // settingsRev rides structurally (Release 2 changelog #7). A non-null
      // deployedStrategy also stamps strategyLastDeployedAt (ISO, additive;
      // NOT lastDeployedAt — see header for the decide.js cooldown parity).
      const stampDeployed = 'deployedStrategy' in set && set.deployedStrategy !== null;
      txUpdateAgentSettings(tx, agentRef, {
        ...set,
        ...(stampDeployed ? { strategyLastDeployedAt: nowIso } : {}),
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
