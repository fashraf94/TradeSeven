// src/services/ruleCompatGuard.js
//
// WS1 Phase 2 — the L1 write-path guard core for rule-vs-archetype
// compatibility. PURE decision logic + event building: no Firestore, no React,
// no fetch — forgeService (the caller) owns its own reads and passes resolved
// facts in, per the fence-lite riders (archetype threaded from callers, with a
// single getDoc fallback done by the caller — never per-rule reads).
//
// Behavior contract (WS1 spec §5.1, adjudication close-out §4.1):
//   RULE_COMPAT_MODE 'off'     → evaluate() returns allow WITHOUT classifying
//                                (zero map reads — byte-identical surface).
//   'observe'                  → classify + build events (blocked:false);
//                                never block, never warn.
//   'enforce'                  → classify + events; WARN on soft conflict
//                                writes; BLOCK writes that would make a
//                                core_conflict rule must-obey.
//
// The four guarded service paths (fence-lite approval, Phase 0 table):
//   A1 createRule            path 'create_rule'          (create-as-hard via category)
//   B1 setRuleHardness       path 'set_rule_hardness'    (explicit promote)
//   B2 updateRule            path 'update_rule_category'  (category flip promote)
//   B3 reforgeBundle         path 'reforge_carry'         (hard-override carry-forward)
// plus the client-side equip surface:
//   B6 equipBundle           path 'equip_bundle'          (conflict-equip warning/log only)
//
// INVARIANT R: this module (and the compat map it reads) is never imported by
// the fenced files, the projection, or the prompt assemblies — it acts at
// write time only.

import { RULE_COMPAT_MODE } from '../config/featureFlags';
import { getRuleCompatInfo } from '../data/archetypeRuleCompatibility';
import { buildPromoteBlockedMessage } from '../utils/compatSurfaceCopy';
import { fetchWithAuth } from '../utils/fetchWithAuth';
// The client's single hard/soft source (never a fourth HARD_CATEGORIES copy).
import { resolveRuleHardness } from '../components/Forge/workshop/hardSoftHelper';

// The write paths the guard understands (event `path` vocabulary).
export const COMPAT_WRITE_PATHS = [
  'create_rule',
  'set_rule_hardness',
  'update_rule_category',
  'reforge_carry',
  'equip_bundle',
  'archetype_change_rescan', // server-side only (change-archetype endpoint)
];

// True when the guard is live (observe or enforce). Callers use this to skip
// their own doc reads under 'off' so the off surface stays byte-identical
// (zero extra Firestore reads, zero classification).
export function isRuleCompatActive(mode = RULE_COMPAT_MODE) {
  return mode === 'observe' || mode === 'enforce';
}

// Thrown by forgeService when an enforce-mode write is blocked. The message is
// user-facing (useForge surfaces err.message via toast); `compat` carries the
// structured details for UI/telemetry.
export class RuleCompatBlockError extends Error {
  constructor(message, compat) {
    super(message);
    this.name = 'RuleCompatBlockError';
    this.code = 'rule_compat_blocked';
    this.compat = compat;
  }
}

/**
 * The single pure evaluator behind every guarded path.
 *
 * @param {Object} p
 * @param {string} p.archetype        - agent archetype code-id (caller-resolved)
 * @param {string|null} p.templateId  - KB template id (rule doc `sourceRef`);
 *                                      null/unknown (manual rules) → fail-open allow
 * @param {'hard'|'soft'} p.resolvedHardness - what the rule WOULD resolve to
 *                                      after this write (category ?? override)
 * @param {string} p.path             - COMPAT_WRITE_PATHS member
 * @param {string} p.agentId
 * @param {string|null} [p.ruleDocId] - Firestore rule doc id when one exists
 * @param {string} [p.mode]           - injectable for tests; defaults to the flag
 * @returns {{ decision: 'allow'|'warn'|'block', state: string|null,
 *             zone1Ref: string|null, blockMessage: string|null,
 *             events: Array<Object> }}
 */
export function evaluateRuleCompatWrite({
  archetype,
  templateId,
  resolvedHardness,
  path,
  agentId,
  ruleDocId = null,
  mode = RULE_COMPAT_MODE,
}) {
  // 'off' = byte-identical: no classification is computed at all (§5.1).
  if (mode !== 'observe' && mode !== 'enforce') {
    return { decision: 'allow', state: null, zone1Ref: null, blockMessage: null, events: [] };
  }

  const info = getRuleCompatInfo(templateId, archetype);
  if (info.state !== 'core_conflict') {
    return { decision: 'allow', state: info.state, zone1Ref: null, blockMessage: null, events: [] };
  }

  const wouldBeHard = resolvedHardness === 'hard';
  const enforcing = mode === 'enforce';
  const blocked = enforcing && wouldBeHard;

  const event = {
    type: wouldBeHard ? 'compat_promote_blocked' : 'compat_conflict_equip',
    agentId,
    archetype,
    ruleId: templateId, // template id — the compat map's key vocabulary
    ruleDocId,
    state: 'core_conflict',
    zone1Ref: info.zone1Ref,
    hardnessRequested: resolvedHardness,
    path,
    mode,
    blocked,
    ts: new Date().toISOString(),
  };

  return {
    decision: blocked ? 'block' : enforcing ? 'warn' : 'allow',
    state: 'core_conflict',
    zone1Ref: info.zone1Ref,
    blockMessage: blocked
      ? buildPromoteBlockedMessage({ archetype, templateId, path, zone1Ref: info.zone1Ref })
      : null,
    events: [event],
  };
}

/**
 * Convenience wrapper for the guarded service paths: evaluates, emits any
 * events (awaited — never fire-and-forget-with-silent-catch, per the Signal
 * Capture rider; a telemetry failure logs loudly but never fails the user's
 * write), and THROWS RuleCompatBlockError on a blocked write.
 *
 * @returns {{ decision: string, state: string|null, zone1Ref: string|null }}
 */
export async function guardRuleCompatWrite(params) {
  const result = evaluateRuleCompatWrite(params);
  if (result.events.length > 0) {
    await emitRuleCompatEvents({
      agentId: params.agentId,
      archetype: params.archetype,
      mode: params.mode || RULE_COMPAT_MODE,
      events: result.events,
      ...(params.transport ? { transport: params.transport } : {}),
    });
  }
  if (result.decision === 'block') {
    throw new RuleCompatBlockError(result.blockMessage, {
      archetype: params.archetype,
      templateId: params.templateId,
      path: params.path,
      zone1Ref: result.zone1Ref,
    });
  }
  return result;
}

/**
 * Emit compat observe events to POST /api/agent/log-rule-compat-event.
 * AWAITED by callers; failures surface via console.error (loud) and the
 * returned boolean — never a silent `.catch(() => {})`, and never a thrown
 * error (telemetry must not break the user's write).
 *
 * @param {Object} p - { agentId, archetype, mode, events: [...] (≤20) }
 * @param {Function} [p.transport] - injectable for tests; defaults fetchWithAuth
 * @returns {Promise<boolean>} true when the log landed
 */
export async function emitRuleCompatEvents({ agentId, archetype, mode, events, transport = fetchWithAuth }) {
  if (!events || events.length === 0) return true;
  try {
    const res = await transport('/api/agent/log-rule-compat-event', {
      method: 'POST',
      body: JSON.stringify({ agentId, archetype, mode, events: events.slice(0, 20) }),
    });
    if (!res.ok) {
      console.error('[ruleCompatGuard] event emit failed:', res.status);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[ruleCompatGuard] event emit failed:', err);
    return false;
  }
}

/**
 * B6 equip-surface helper: classify a bundle's frozen rule snapshots for the
 * agent's archetype. Pure. Returns the conflicts with their per-rule resolved
 * hardness (category ?? the bundle's authored override) so the caller can log
 * + warn. Mode-gated like the evaluator: [] when the flag is off.
 *
 * @param {Object} p
 * @param {string} p.archetype
 * @param {Array<Object>} p.ruleSnapshots - bundle.ruleSnapshots (carry sourceRef + category)
 * @param {Object} [p.ruleHardness]       - bundle.ruleHardness override map
 * @param {string} [p.mode]
 * @returns {Array<{ templateId: string, ruleDocId: string, zone1Ref: string|null, resolvedHardness: 'hard'|'soft' }>}
 */
export function classifyBundleSnapshots({ archetype, ruleSnapshots, ruleHardness = {}, mode = RULE_COMPAT_MODE }) {
  if (mode !== 'observe' && mode !== 'enforce') return [];
  const out = [];
  for (const snap of ruleSnapshots || []) {
    if (!snap || !snap.sourceRef) continue; // manual/unknown rules are outside the map
    const info = getRuleCompatInfo(snap.sourceRef, archetype);
    if (info.state !== 'core_conflict') continue;
    const resolvedHardness = resolveRuleHardness(snap, ruleHardness[snap.id]);
    out.push({
      templateId: snap.sourceRef,
      ruleDocId: snap.id,
      zone1Ref: info.zone1Ref,
      resolvedHardness,
    });
  }
  return out;
}
