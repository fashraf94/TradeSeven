// src/services/ruleCompatClassify.js
//
// WS1 B6 — the bundle-snapshot compatibility classifier, EXTRACTED from
// ruleCompatGuard.js (Release 2 settingsRev migration, founder ruling D3
// 2026-07-10) so the server-side equip endpoint (api/agent/equip-bundle.js)
// can classify with the SAME kernel the client guard uses — never a copy
// (the BUILD_RULES §4 local-copy bug class).
//
// NODE-CLEAN BY CONSTRUCTION: this module imports only zero-import data /
// pure-helper modules (featureFlags, archetypeRuleCompatibility,
// hardSoftHelper) — no fetchWithAuth, no firebase, no React — so the
// api → src import is BUILD_RULES §4-legal. The api/ test file's real import
// is the dependency-surface guard.
//
// INVARIANT R still holds: this classifier (and the compat map it reads) is
// imported by WRITE-TIME surfaces only — never by the fenced files, the
// projection, or the prompt assemblies.

import { RULE_COMPAT_MODE } from '../config/featureFlags';
import { getRuleCompatInfo } from '../data/archetypeRuleCompatibility';
import { resolveRuleHardness } from '../components/Forge/workshop/hardSoftHelper';

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
