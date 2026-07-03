// api/agent/change-archetype.js
//
// POST /api/agent/change-archetype. Changes an agent's archetype (its trading
// personality / identity). The archetype drives decide.js scoring + prompt
// context downstream; this endpoint writes ONLY agent.archetype (+ updatedAt) —
// the field those configs READ. It never touches the archetype config files.
//
// Battle-locked (mirrors equip-watchlist E3 / the equipBundle activeBattleId
// guard): a change is blocked while the agent has an active battle, so a live
// battle's frozen archetype can't shift under it (the battle-lock is checked
// first, mirroring equip-watchlist, so a re-select during a battle still 409s).
// Idempotent otherwise: re-selecting the current archetype outside a battle is a
// 200 no-op with no write and no shadow log. Atomic: the agent read + write
// happen in one transaction.
//
// Pattern reference: api/agent/equip-watchlist.js (transaction body, sentinel
// error map, shadow-log fire-and-forget). Delta: single-doc read+write (agents).

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { logSignalDrops } from '../_utils/shadowLogger.js';
import { isValidForgeId, FORGE_ID_REGEX, FORGE_ID_MAX_LEN } from '../_utils/idValidation.js';
// VALID_ARCHETYPES is the canonical server-side list (Object.keys of the archetype
// configs); create-profile.js validates against this same source. Imported, not
// re-declared, so the picker, seeder, endpoint, and config can't drift apart.
import { VALID_ARCHETYPES } from '../_utils/agentArchetypeConfig.js';
import { waitUntil } from '@vercel/functions';
// WS1 rescan rider — an archetype change flips the classification input for
// every already-equipped rule, so under RULE_COMPAT_MODE observe/enforce this
// endpoint emits one compat_archetype_change_rescan event summarizing the
// conflicts under the NEW archetype (no UI; observe data only). The featureFlags
// import is api → src and Node-clean (BUILD_RULES §4); its never-mocked
// dependency-surface guard is the real import in change-archetype.test.js.
// Classification runs through the SAME kernel the cleanup script uses
// (collectProjectedConflicts → projectActiveRules + the compat map) so rescan
// telemetry and the cleanup census can never disagree.
import { RULE_COMPAT_MODE } from '../../src/config/featureFlags.js';
import { collectProjectedConflicts } from '../_utils/ruleCompatCleanup.js';

export const config = { maxDuration: 10 };

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
  if (typeof archetype !== 'string' || !VALID_ARCHETYPES.includes(archetype)) {
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
      // ⚠️ LOAD-BEARING FOR ARCHETYPE INTEGRITY: this battle-lock is what
      // guarantees an agent's archetype cannot change mid-battle, which is why
      // the integrity gate does NOT clear/revalidate `battle.directive` on
      // archetype change. If you EVER allow mid-battle archetype change, you MUST
      // clear or revalidate the live `battle.directive` (it may have been minted
      // under the prior archetype) — see
      // docs/audits/20260625_ARCHETYPE_INTEGRITY_BUILD_PLAN_V2.md (CF-1).
      if (agent.activeBattleId) throw new Error(SENTINEL_PREFIX + 'battle_active');

      // Idempotent: archetype already set → 200 no-op, no write.
      if (agent.archetype === archetype) {
        return { idempotent: true, archetype, previousArchetype: archetype };
      }

      const previousArchetype = agent.archetype ?? null;
      tx.update(agentRef, { archetype, updatedAt: nowIso });
      // equippedTraits rides along for the WS1 rescan (projection input) — no
      // extra read, it is already on the agent snapshot.
      return { idempotent: false, archetype, previousArchetype, equippedTraits: agent.equippedTraits || [] };
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

  // WS1 rescan rider (RULE_COMPAT_MODE observe/enforce only — 'off' is
  // byte-identical, including the response shape). Projects the agent's
  // equipped surface exactly as deploy does, classifies each projected rule
  // under the NEW archetype, and emits ONE summary event. Awaited (never a
  // silent fire-and-forget); a rescan failure is loud but never fails the
  // committed archetype change — the response reports rescanLogged instead.
  let rescanLogged = null;
  const compatActive = RULE_COMPAT_MODE === 'observe' || RULE_COMPAT_MODE === 'enforce';
  if (compatActive && !txResult.idempotent) {
    try {
      const [rulesSnap, bundlesSnap] = await Promise.all([
        agentRef.collection('rules').get(),
        agentRef.collection('bundles').get(),
      ]);
      const { conflicts: kernelConflicts } = collectProjectedConflicts({
        archetype: txResult.archetype,
        equippedTraits: txResult.equippedTraits,
        ruleDocs: rulesSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        bundleDocs: bundlesSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      });
      const conflicts = kernelConflicts.map(({ item, templateId, zone1Ref }) => ({
        ruleId: templateId,
        ruleDocId: item.ruleId,
        zone1Ref,
        hardness: item.hardness || null,
      }));
      await logSignalDrops({
        stage: 'rule_compat',
        userId: user.uid,
        agentId,
        archetype: txResult.archetype,
        mode: RULE_COMPAT_MODE,
        events: [{
          type: 'compat_archetype_change_rescan',
          ruleId: null,
          path: 'archetype_change_rescan',
          previousArchetype: txResult.previousArchetype,
          conflictCount: conflicts.length,
          hardConflictCount: conflicts.filter((c) => c.hardness === 'hard').length,
          conflicts: conflicts.slice(0, 30),
          blocked: false,
          ts: nowIso,
        }],
        eventCount: 1,
        loggedAt: nowIso,
      });
      rescanLogged = true;
    } catch (rescanErr) {
      console.error('[change-archetype] compat rescan failed (archetype change committed):', rescanErr?.message || rescanErr);
      rescanLogged = false;
    }
  }

  console.log(
    `[change-archetype] agent ${agentId} → ${txResult.archetype} (idempotent=${txResult.idempotent})`,
  );

  return res.status(200).json({
    agentId,
    archetype: txResult.archetype,
    idempotent: txResult.idempotent,
    // Additive, mode-gated field — absent while RULE_COMPAT_MODE='off' so the
    // off response stays byte-identical.
    ...(compatActive ? { rescanLogged } : {}),
  });
}
