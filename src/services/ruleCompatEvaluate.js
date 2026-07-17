// src/services/ruleCompatEvaluate.js
//
// WS1 — the PURE rule-vs-archetype compat evaluator, extracted from
// ruleCompatGuard.js at WS1 enforce Phase 2 so the SERVER hardness writers
// (api/agent/set-rule-hardness.js, api/agent/reforge-bundle.js) gate with the
// same kernel the client paths use — the ruleCompatClassify.js precedent
// (Release 2 settingsRev migration, D3). ruleCompatGuard re-exports everything
// here, so every existing client importer keeps working.
//
// NODE-CLEAN (BUILD_RULES §4): no Firestore, no React, no fetch — imports only
// featureFlags + the compat map + the pure copy builders, all with explicit
// .js extensions (serverless Node ESM resolves extensioned specifiers only —
// the banking-cron module-load lesson, commit 0f260391). The api/ test files'
// REAL imports are the dependency-surface guard.
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
// INVARIANT R: this module (and the compat map it reads) is never imported by
// the fenced files, the projection, or the prompt assemblies — it acts at
// write time only.

import { RULE_COMPAT_MODE } from '../config/featureFlags.js';
import { getRuleCompatInfo } from '../data/archetypeRuleCompatibility.js';
import { buildPromoteBlockedMessage } from '../utils/compatSurfaceCopy.js';

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

// Thrown by the guarded client paths when an enforce-mode write is blocked
// (the server endpoints map the same decision to a 409 instead). The message
// is user-facing (useForge surfaces err.message via toast); `compat` carries
// the structured details for UI/telemetry.
export class RuleCompatBlockError extends Error {
  constructor(message, compat) {
    super(message);
    this.name = 'RuleCompatBlockError';
    this.code = 'rule_compat_blocked';
    this.compat = compat;
  }
}

/**
 * The single pure evaluator behind every guarded path — client AND server.
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
 * Map an evaluator event to the AT-REST per-event shape the rule_compat
 * stream persists: log-rule-compat-event.js's sanitizeEvent strips per-event
 * agentId/archetype/mode (the envelope carries them) — the server emitters
 * (equip-bundle precedent, set-rule-hardness, reforge-bundle) apply the same
 * mapping so at-rest records keep ONE shape across producers.
 */
export function toStreamEventShape(event) {
  return {
    type: event.type,
    ruleId: event.ruleId,
    ruleDocId: event.ruleDocId,
    state: event.state,
    zone1Ref: event.zone1Ref,
    hardnessRequested: event.hardnessRequested,
    path: event.path,
    blocked: event.blocked,
    ts: event.ts,
  };
}
