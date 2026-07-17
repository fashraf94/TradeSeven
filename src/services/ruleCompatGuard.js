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
import { fetchWithAuth } from '../utils/fetchWithAuth';
// The PURE evaluator kernel — EXTRACTED to ruleCompatEvaluate.js (WS1 enforce
// Phase 2, the ruleCompatClassify.js D3 precedent) so the server hardness
// writers (set-rule-hardness / reforge-bundle endpoints) gate with the same
// kernel without dragging this module's fetchWithAuth (client-only) onto the
// api/ graph. Re-exported below so every existing importer keeps working.
import { evaluateRuleCompatWrite, RuleCompatBlockError } from './ruleCompatEvaluate';

export {
  COMPAT_WRITE_PATHS,
  isRuleCompatActive,
  RuleCompatBlockError,
  evaluateRuleCompatWrite,
} from './ruleCompatEvaluate';

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

// B6 equip-surface classifier — EXTRACTED to ruleCompatClassify.js (Release 2
// settingsRev migration, D3) so the server equip endpoint classifies with the
// same kernel. Re-exported here so every existing importer keeps working.
export { classifyBundleSnapshots } from './ruleCompatClassify';
