// api/agent/set-rule-hardness.js
//
// WS1 enforce Phase 2 — POST /api/agent/set-rule-hardness. Server-side
// migration of the client forgeService.setRuleHardness writer (the
// equip-bundle / equip-lean D3 pattern): bundles.ruleHardness becomes
// server-mintable only, so the WS1 B1 promote gate cannot be bypassed by a
// dishonest client once the bundles field allowlist publishes (WS1 Enforce
// Build Spec §3; the folded-in bundles-hardening blocker).
//
// DARK-INERT: 404s while FORGE_HARDSOFT_AUTHORING_ENABLED is false (the
// equip-lean / scouting-board defense-in-depth pattern) — the per-rule
// SOFT/HARD toggle (BundleBuildFlow Stage 3) is this endpoint's only caller
// and renders only under that flag, so the dark merge changes no live
// behavior.
//
// Semantics preserved 1:1 from the client implementation @ bea6e385:
//   - value 'hard' | 'soft' | null (null CLEARS the override → the rule
//     reverts to its category-derived default)
//   - draft bundles only (Amendment 3); the rule must be in bundle.ruleIds
//   - WS1 B1 gate: guards any write whose RESULTING resolved hardness is
//     'hard' when the current resolution is not — value === 'hard' AND the
//     null-clear on a hard-CATEGORY rule (the UI sends exactly null when the
//     desired value equals the category default). Demote-direction writes
//     ('soft', or clears that resolve soft) never guard. The gate honors
//     RULE_COMPAT_MODE exactly as the client gate did: observe → log-not-
//     block (blocked:false event, write proceeds); enforce → 409
//     rule_compat_blocked (blocked:true event, nothing written). Same kernel
//     as every other guarded path (ruleCompatEvaluate — single decision
//     source, no duplicated logic).
//   - NO settingsRev bump: a draft-only bundle write is not a snapshot-
//     feeding agent-doc write (the agent doc is untouched; deploy re-projects
//     from live docs at decide-time) — matches the client writer and the
//     cleanup script's demote op.
//   - NO battle-lock: the client writer had none (BundleBuildFlow soft-blocks
//     with a toast); preserved so the swap is behavior-identical.
//
// Import note (BUILD_RULES §4): featureFlags, ruleCompatEvaluate (+ its data
// imports), and ruleHardness are api → src / server-shared and Node-clean;
// the off test file's REAL imports are the dependency-surface guard.

import { FieldValue } from 'firebase-admin/firestore';
import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { logSignalDrops } from '../_utils/shadowLogger.js';
import { isValidForgeId, FORGE_ID_REGEX, FORGE_ID_MAX_LEN } from '../_utils/idValidation.js';
import { resolveRuleHardness } from '../_utils/ruleHardness.js';
import {
  FORGE_HARDSOFT_AUTHORING_ENABLED,
  RULE_COMPAT_MODE,
} from '../../src/config/featureFlags.js';
import {
  isRuleCompatActive,
  evaluateRuleCompatWrite,
  toStreamEventShape,
} from '../../src/services/ruleCompatEvaluate.js';

export const config = { maxDuration: 10 };

const SENTINEL_PREFIX = '__set_rule_hardness:';
const SENTINEL_TO_HTTP = Object.freeze({
  agent_not_found:    [404, 'agent_not_found',    'Agent not found.'],
  forbidden:          [403, 'forbidden',          'Not authorized for this resource.'],
  bundle_not_found:   [404, 'bundle_not_found',   'Bundle not found.'],
  not_draft:          [400, 'not_draft',          'Can only edit rules on draft bundles'],
  rule_not_in_bundle: [400, 'rule_not_in_bundle', 'Rule is not in this bundle'],
});

export default async function handler(req, res) {
  // DARK-INERT gate: the surface does not exist while the authoring flag is
  // off (its only caller is the flag-gated SOFT/HARD toggle).
  if (!FORGE_HARDSOFT_AUTHORING_ENABLED) {
    return res.status(404).json({ error: 'not_found' });
  }
  // 30/min — the toggle is a rapid-tap control (the unequip-bundle ceiling).
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 30, windowMs: 60_000 } })) {
    return;
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  const { agentId, bundleId, ruleId, value } = req.body || {};
  if (!isValidForgeId(agentId)) {
    return res.status(400).json({
      error: 'invalid_agent_id',
      message: `agentId must match ${FORGE_ID_REGEX} and be ≤${FORGE_ID_MAX_LEN} chars`,
    });
  }
  if (!isValidForgeId(bundleId)) {
    return res.status(400).json({
      error: 'invalid_bundle_id',
      message: `bundleId must match ${FORGE_ID_REGEX} and be ≤${FORGE_ID_MAX_LEN} chars`,
    });
  }
  if (!isValidForgeId(ruleId)) {
    return res.status(400).json({
      error: 'invalid_rule_id',
      message: `ruleId must match ${FORGE_ID_REGEX} and be ≤${FORGE_ID_MAX_LEN} chars`,
    });
  }
  // value must be EXPLICIT: 'hard' | 'soft' | null (the client's own throw).
  if (value !== null && value !== 'hard' && value !== 'soft') {
    return res.status(400).json({
      error: 'invalid_value',
      message: "Rule hardness must be 'hard', 'soft', or null",
    });
  }

  const db = getFirebaseAdmin();
  const agentRef = db.collection('agents').doc(agentId);
  const bundleRef = agentRef.collection('bundles').doc(bundleId);
  const ruleRef = agentRef.collection('rules').doc(ruleId);
  const nowIso = new Date().toISOString();

  let txResult;
  try {
    txResult = await db.runTransaction(async (tx) => {
      // The rule doc is only needed by the gate; skip its read under 'off'
      // and for demote-direction writes (the client's read pattern).
      const wantRuleDoc = isRuleCompatActive() && value !== 'soft';
      const snaps = wantRuleDoc
        ? await tx.getAll(agentRef, bundleRef, ruleRef)
        : await tx.getAll(agentRef, bundleRef);
      const [agentSnap, bundleSnap, ruleSnap] = snaps;

      if (!agentSnap.exists) throw new Error(SENTINEL_PREFIX + 'agent_not_found');
      const agent = agentSnap.data();
      if (agent.ownerId !== user.uid) throw new Error(SENTINEL_PREFIX + 'forbidden');
      // No battle-lock — see header.

      if (!bundleSnap.exists) throw new Error(SENTINEL_PREFIX + 'bundle_not_found');
      const bundle = bundleSnap.data();
      if (bundle.status !== 'draft') throw new Error(SENTINEL_PREFIX + 'not_draft');
      if (!(bundle.ruleIds || []).includes(ruleId)) {
        throw new Error(SENTINEL_PREFIX + 'rule_not_in_bundle');
      }

      // WS1 B1 gate — THE explicit promote path, server-side (same predicate
      // as the client gate it replaces: only a not-hard → hard resolution
      // transition on a template-derived rule is evaluated).
      let gate = null;
      if (wantRuleDoc) {
        const ruleData = ruleSnap && ruleSnap.exists ? ruleSnap.data() : null;
        const sourceRef = ruleData?.sourceRef || null;
        const category = ruleData?.category || null;
        const prevResolved = resolveRuleHardness({
          category,
          hardness: (bundle.ruleHardness || {})[ruleId],
        });
        const newResolved = resolveRuleHardness({ category, hardness: value ?? undefined });
        if (sourceRef && newResolved === 'hard' && prevResolved !== 'hard') {
          gate = evaluateRuleCompatWrite({
            archetype: agent.archetype || null, // the agent's REAL archetype — never a caller-supplied copy
            templateId: sourceRef,
            resolvedHardness: 'hard',
            path: 'set_rule_hardness',
            agentId,
            ruleDocId: ruleId,
          });
        }
      }

      if (gate && gate.decision === 'block') {
        // Enforce: nothing written. Events are RETURNED and emitted once
        // after the transaction (a tx can retry; emission inside would
        // double-log).
        return {
          blocked: true,
          blockMessage: gate.blockMessage,
          events: gate.events,
          archetype: agent.archetype || null,
        };
      }

      tx.update(bundleRef, {
        [`ruleHardness.${ruleId}`]: value === null ? FieldValue.delete() : value,
        // serverTimestamp — bundle docs stay Timestamp-typed (equip-bundle note).
        updatedAt: FieldValue.serverTimestamp(),
      });
      return {
        blocked: false,
        events: gate ? gate.events : [],
        archetype: agent.archetype || null,
      };
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
    console.error('[set-rule-hardness] error:', txErr);
    return res.status(500).json({ error: 'server_error', message: 'Could not update rule hardness.' });
  }

  // rule_compat is a CATALOG stream (Signal Capture Rider §5): awaited, and
  // the persistence boolean is checked (Phase 1) — a swallowed GCS write is
  // loud and reported via compatLogged, but never fails the user's write
  // (nor un-blocks a blocked one).
  let compatLogged = null;
  if (txResult.events.length > 0) {
    try {
      const persisted = await logSignalDrops({
        stage: 'rule_compat',
        userId: user.uid,
        agentId,
        archetype: txResult.archetype,
        mode: RULE_COMPAT_MODE,
        events: txResult.events.slice(0, 20).map(toStreamEventShape),
        eventCount: txResult.events.length,
        loggedAt: nowIso,
      });
      compatLogged = persisted === true;
    } catch (logErr) {
      console.error('[set-rule-hardness] compat emit threw:', logErr?.message || logErr);
      compatLogged = false;
    }
    if (!compatLogged) {
      console.error('[set-rule-hardness] compat event did not persist (swallowed GCS write or GCS disabled).');
    }
  }

  if (txResult.blocked) {
    // The same user-facing copy the client RuleCompatBlockError carried —
    // the thin client surfaces response.message via toEquipError → toast.
    return res.status(409).json({
      error: 'rule_compat_blocked',
      message: txResult.blockMessage,
      compatLogged,
    });
  }

  console.log(`[set-rule-hardness] agent ${agentId} bundle ${bundleId} rule ${ruleId} → ${value === null ? '(cleared)' : value}`);

  return res.status(200).json({ agentId, bundleId, ruleId, value, compatLogged });
}
