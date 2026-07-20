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

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { txUpdateAgentSettings } from '../_utils/agentSettingsTx.js';
import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { logSignalDrops } from '../_utils/shadowLogger.js';
import { isValidForgeId, FORGE_ID_REGEX, FORGE_ID_MAX_LEN } from '../_utils/idValidation.js';
import { STANDING_LEANS_ENABLED } from '../../src/config/featureFlags.js';
import { findEquipConflicts } from '../../src/data/archetypeAdjustments.js';
// validateLeanPin is THE per-pin validity authority (menu membership +
// version currency) shared with battle-creation revalidation — one rule, so
// equip can never accept a pin the snapshot path would omit (or vice versa).
// STANDING_LEANS_CAP lives there too (the domain kernel), re-exported here
// for API-surface convenience.
import { validateLeanPin, revalidateStandingLeans, STANDING_LEANS_CAP, MASTERY_LEAN_CAP_MAX, LEAN_INVALIDATION_REASONS } from '../_utils/leanRevalidation.js';
// Mastery P2 (spec §6 D1 dual anchor — the WRITE/chokepoint half): the cap
// is level-derived from the live masteryProfile at write time. This
// chokepoint is the ONLY per-user entitlement gate; the kernel half clamps
// at the structural max (see leanRevalidation.resolveLeanCap — P2-review
// redesign: no stamped field, nothing doc-trusted). Dark (enforcement
// off): no profile read, baseline cap — byte-identical.
import { MASTERY_ENFORCEMENT_ENABLED } from '../_utils/masteryConfig.js';
import { masteryProfileRef, archetypeLevelFromProfile, leanCapForLevel } from '../_utils/masteryEnforcement.js';
import { waitUntil } from '@vercel/functions';

export const config = { maxDuration: 10 };

export { STANDING_LEANS_CAP };

const ADJUSTMENT_ID_REGEX = /^[A-Z]{2}-\d{2}$/;

const SENTINEL_PREFIX = '__equip_lean:';
const SENTINEL_TO_HTTP = Object.freeze({
  agent_not_found:    [404, 'agent_not_found',    'Agent not found.'],
  forbidden:          [403, 'forbidden',          'Not authorized for this resource.'],
  battle_active:      [409, 'battle_active',      'Cannot change standing leans while the agent has an active battle.'],
  not_in_menu:        [400, 'not_in_menu',        'That adjustment is not in this agent\'s archetype menu.'],
  deprecated_version: [409, 'deprecated_version', 'That adjustment\'s text has changed since this was loaded — review the current wording and re-equip.'],
  conflicting_lean:   [409, 'conflicting_lean',   'That lean opposes an already-equipped lean — unequip the other one first.'],
  // §9: the copy never bakes in a number — the response's `leanCap` detail
  // carries the exact cap the rejection used (level-derived under mastery).
  lean_limit:         [409, 'lean_limit',         'Standing-lean capacity reached — unequip one first.'],
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

      // Mastery P2: level-derived lean cap (per-archetype level from the
      // live profile — read REGARDLESS of the XP flag state, spec §7;
      // missing profile ⇒ level 1 ⇒ baseline). Read precedes every write.
      let leanCap = STANDING_LEANS_CAP;
      if (MASTERY_ENFORCEMENT_ENABLED) {
        const profileSnap = await tx.get(masteryProfileRef(db, user.uid));
        const level = archetypeLevelFromProfile(profileSnap.exists ? profileSnap.data() : null, agent.archetype);
        leanCap = leanCapForLevel(level);
      }

      // Menu membership + version currency through the SHARED kernel
      // (leanRevalidation.validateLeanPin) — its reason vocabulary maps 1:1
      // onto this endpoint's sentinels, so the write path and the snapshot
      // path cannot drift.
      const pinVerdict = validateLeanPin(agent.archetype, adjustmentId, version);
      if (!pinVerdict.ok) {
        if (pinVerdict.reason === LEAN_INVALIDATION_REASONS.NOT_IN_MENU) {
          throw new Error(SENTINEL_PREFIX + 'not_in_menu');
        }
        if (pinVerdict.reason === LEAN_INVALIDATION_REASONS.DEPRECATED_VERSION) {
          throw new Error(SENTINEL_PREFIX + 'deprecated_version');
        }
        // 'malformed' cannot reach here (agentId/adjustmentId/version are
        // request-validated above) — treated as not_in_menu if it ever does.
        throw new Error(SENTINEL_PREFIX + 'not_in_menu');
      }

      const current = Array.isArray(agent.standingLeans) ? agent.standingLeans : [];
      const existing = current.find((l) => l?.adjustmentId === adjustmentId);

      // Idempotent: same id at the same (current) version → 200 no-op.
      if (existing && existing.version === version) {
        return { idempotent: true, standingLeans: current };
      }

      // Conflict-group rejection against the OTHER equipped leans (an
      // existing pin of this same id is a refresh, not a conflict). The
      // filter drops malformed/null entries too — they must never crash the
      // equip (they are surfaced by revalidation, not here).
      const otherIds = current
        .filter((l) => l && typeof l.adjustmentId === 'string' && l.adjustmentId !== adjustmentId)
        .map((l) => l.adjustmentId);
      const conflicts = findEquipConflicts(agent.archetype, adjustmentId, otherIds);
      if (conflicts.length > 0) {
        const err = new Error(SENTINEL_PREFIX + 'conflicting_lean');
        err.details = { conflictsWith: conflicts };
        throw err;
      }

      // Level-derived cap (baseline 2; a version refresh of an existing pin
      // does not add a slot). The rejection carries the RESOLVED cap so the
      // client renders the number the decision used — §9: never the static
      // baseline copy beside a level-derived decision.
      //
      // Ruling M5: capacity counts ONLY current-archetype, kernel-accepted
      // pins. Leans are durable desired state across archetype switches, so
      // at-rest pins from OTHER archetypes' menus (plus malformed/duplicate/
      // conflicting entries the kernel would omit from any snapshot) are
      // preserved but never consume slots — without this, a switched-away
      // archetype's pins would silently eat the new archetype's capacity.
      // The counting pass runs at the STRUCTURAL max: slot membership is a
      // validity question; entitlement is decided by the leanCap check here.
      // The slot decision keys on ACCEPTED membership, not raw same-id
      // presence: refreshing an accepted pin never adds a slot, but
      // re-confirming a NON-accepted at-rest pin (a deprecated-version
      // stale entry — not counted above) CONSUMES one, else the re-confirm
      // gesture could grow the accepted set past the entitlement.
      const { valid: acceptedPins } = revalidateStandingLeans({
        standingLeans: current,
        archetypeCodeId: agent.archetype,
        leanCap: MASTERY_LEAN_CAP_MAX,
      });
      const existingAccepted = acceptedPins.some((l) => l.adjustmentId === adjustmentId);
      if (!existingAccepted && acceptedPins.length >= leanCap) {
        const err = new Error(SENTINEL_PREFIX + 'lean_limit');
        err.details = { leanCap, equippedCount: acceptedPins.length };
        throw err;
      }

      const entry = { adjustmentId, version, equippedAt: nowIso };
      const standingLeans = existing
        ? current.map((l) => (l?.adjustmentId === adjustmentId ? entry : l))
        : [...current, entry];

      // settingsRev rides structurally (Release 2 changelog #7).
      txUpdateAgentSettings(tx, agentRef, {
        standingLeans,
        updatedAt: nowIso,
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
