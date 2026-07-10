// api/agent/equip-lean.js
//
// Release 2 (Fenced Customization Bundle V1.1) — POST /api/agent/equip-lean
// (spec Phase 1 item 2). Equips one standing lean (an archetype-menu
// adjustment, by id + pinned canonicalTextVersion) onto the agent.
//
// DARK-INERT: 404s while STANDING_LEANS_ENABLED is false (the scouting-board
// defense-in-depth pattern) — no UI calls this until Release 3, and the flag
// flip is a Release-4 staged-walk step.
//
// WRITE-PATH VALIDATION (spec Phase 1 item 2, all fail-closed — never trust
// future UI):
//   - menu membership: isValidAdjustmentId(agent.archetype, adjustmentId)
//   - version currency: payload version === live canonicalTextVersion
//     (deprecated → 409 deprecated_version; re-confirm = re-equip at current)
//   - conflict-group rejection: an opposing combination is refused at equip
//     (409 conflicting_lean, spec changelog #8)
//   - cap 2 (409 lean_limit)
//   - battle-lock (409 battle_active — the equip-watchlist E3 precedent)
//   - settingsRev increment on every real write (spec changelog #7)
//
// Re-equipping the SAME id at the SAME version is an idempotent 200 no-op;
// re-equipping at a NEWER (current) version REFRESHES the pin — that is the
// deprecated-lean re-confirm gesture.
//
// Data shape (master spec §3.1, ids-at-rest):
//   agent.standingLeans = [{ adjustmentId, version, equippedAt }]
//
// Pattern reference: api/agent/equip-watchlist.js (transaction body, sentinel
// error map). Import note (BUILD_RULES §4): featureFlags +
// archetypeAdjustments are api → src and Node-clean; this endpoint's test
// file's REAL imports are the dependency-surface guard.

import { FieldValue } from 'firebase-admin/firestore';
import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { logSignalDrops } from '../_utils/shadowLogger.js';
import { isValidForgeId, FORGE_ID_REGEX, FORGE_ID_MAX_LEN } from '../_utils/idValidation.js';
import { STANDING_LEANS_ENABLED } from '../../src/config/featureFlags.js';
import {
  isValidAdjustmentId,
  getCanonicalTextVersion,
  findEquipConflicts,
} from '../../src/data/archetypeAdjustments.js';
import { waitUntil } from '@vercel/functions';

export const config = { maxDuration: 10 };

export const STANDING_LEANS_CAP = 2; // master spec §3.1

const ADJUSTMENT_ID_REGEX = /^[A-Z]{2}-\d{2}$/;

const SENTINEL_PREFIX = '__equip_lean:';
const SENTINEL_TO_HTTP = Object.freeze({
  agent_not_found:    [404, 'agent_not_found',    'Agent not found.'],
  forbidden:          [403, 'forbidden',          'Not authorized for this resource.'],
  battle_active:      [409, 'battle_active',      'Cannot change standing leans while the agent has an active battle.'],
  not_in_menu:        [400, 'not_in_menu',        'That adjustment is not in this agent\'s archetype menu.'],
  deprecated_version: [409, 'deprecated_version', 'That adjustment\'s text has changed since this was loaded — review the current wording and re-equip.'],
  conflicting_lean:   [409, 'conflicting_lean',   'That lean opposes an already-equipped lean — unequip the other one first.'],
  lean_limit:         [409, 'lean_limit',         `An agent can hold at most ${STANDING_LEANS_CAP} standing leans — unequip one first.`],
});

export default async function handler(req, res) {
  // DARK-INERT gate: the surface does not exist while the flag is off.
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

  const { agentId, adjustmentId, version } = req.body || {};
  if (!isValidForgeId(agentId)) {
    return res.status(400).json({
      error: 'invalid_agent_id',
      message: `agentId must match ${FORGE_ID_REGEX} and be ≤${FORGE_ID_MAX_LEN} chars`,
    });
  }
  if (typeof adjustmentId !== 'string' || !ADJUSTMENT_ID_REGEX.test(adjustmentId)) {
    return res.status(400).json({
      error: 'invalid_adjustment_id',
      message: 'adjustmentId must be an allowlist id (e.g. "CP-04").',
    });
  }
  // The client asserts WHICH text version it showed the user — required, so
  // a stale UI can never silently equip re-worded text (fail closed).
  if (!Number.isInteger(version)) {
    return res.status(400).json({
      error: 'invalid_version',
      message: 'version must be the integer canonicalTextVersion the UI displayed.',
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

      // Menu membership under the agent's CURRENT archetype (no fallback).
      if (!isValidAdjustmentId(agent.archetype, adjustmentId)) {
        throw new Error(SENTINEL_PREFIX + 'not_in_menu');
      }
      // Version currency — equipping deprecated wording is refused.
      const liveVersion = getCanonicalTextVersion(agent.archetype, adjustmentId);
      if (version !== liveVersion) {
        throw new Error(SENTINEL_PREFIX + 'deprecated_version');
      }

      const current = Array.isArray(agent.standingLeans) ? agent.standingLeans : [];
      const existing = current.find((l) => l?.adjustmentId === adjustmentId);

      // Idempotent: same id at the same (current) version → 200 no-op.
      if (existing && existing.version === version) {
        return { idempotent: true, standingLeans: current };
      }

      // Conflict-group rejection against the OTHER equipped leans (an
      // existing pin of this same id is a refresh, not a conflict).
      const otherIds = current.filter((l) => l?.adjustmentId !== adjustmentId).map((l) => l.adjustmentId);
      const conflicts = findEquipConflicts(agent.archetype, adjustmentId, otherIds);
      if (conflicts.length > 0) {
        const err = new Error(SENTINEL_PREFIX + 'conflicting_lean');
        err.details = { conflictsWith: conflicts };
        throw err;
      }

      // Cap 2 (a version refresh of an existing pin does not add a slot).
      if (!existing && current.length >= STANDING_LEANS_CAP) {
        throw new Error(SENTINEL_PREFIX + 'lean_limit');
      }

      const entry = { adjustmentId, version, equippedAt: nowIso };
      const standingLeans = existing
        ? current.map((l) => (l?.adjustmentId === adjustmentId ? entry : l))
        : [...current, entry];

      tx.update(agentRef, {
        standingLeans,
        updatedAt: nowIso,
        // Release 2 (spec changelog #7): monotonic settings revision.
        settingsRev: FieldValue.increment(1),
      });
      return { idempotent: false, refreshed: !!existing, standingLeans };
    });
  } catch (txErr) {
    if (typeof txErr?.message === 'string' && txErr.message.startsWith(SENTINEL_PREFIX)) {
      const code = txErr.message.slice(SENTINEL_PREFIX.length);
      const mapped = SENTINEL_TO_HTTP[code];
      if (mapped) {
        const [statusCode, errorKey, humanCopy] = mapped;
        return res.status(statusCode).json({ error: errorKey, message: humanCopy, ...(txErr.details || {}) });
      }
    }
    console.error('[equip-lean] error:', txErr);
    return res.status(500).json({ error: 'server_error', message: 'Could not equip lean.' });
  }

  if (!txResult.idempotent) {
    waitUntil(
      logSignalDrops({
        stage: 'standing_lean_equip',
        userId: user.uid,
        agentId,
        adjustmentId,
        version,
        refreshed: txResult.refreshed === true,
        loggedAt: nowIso,
      }).catch(() => {}),
    );
  }

  console.log(`[equip-lean] agent ${agentId} + ${adjustmentId}@v${version} (idempotent=${txResult.idempotent})`);

  return res.status(200).json({
    agentId,
    adjustmentId,
    version,
    standingLeans: txResult.standingLeans,
    idempotent: txResult.idempotent,
  });
}
