// api/_utils/declaredRuleConflicts.js
//
// Exit-Behavior Rebalance Tier 2, Ask 2 (rescoped) — R8 / Fable Review F10:
// "SX-04 × mb-08: the executor wins over the prompt-delegated veto; the
// compiler flags the combination at equip time (declared, not discovered)."
//
// The pair, as the equip-time compile actually sees it:
//   • the user's profit target — deployedStrategy.guardrails[type='profitTarget']
//     (written by Strategy Dimensions → update-agent-settings; the exact store
//     the deterministic executor fires on, agentGuardrails block 2c);
//   • mb-08 "let winners run" — a prompt-layer hold veto ("Do not swap any
//     stock with positive P&L until it reaches the {threshold} scoring
//     threshold"), hosted by a bundle rule doc, by the PR 3.5 unified
//     projection, or by an equipped trait (trait-patient-holder /
//     trait-let-winners-run) whose rule docs the LEGACY compile mode never
//     sees — so trait hosts are resolved BY TRAIT DEFINITION (traitLibrary.js
//     rule ids, founder decision 3, 2026-09-02) and labelled as such.
//
// The resolution is a fact of the engine, not a judgment: the executor fires
// at X% regardless of mb-08; mb-08 governs only the discretionary swaps below
// the target. Nothing here drops, reorders or rewrites a rule — this module
// DECLARES, the CompiledBuild carries it, and the compile preview returns it.
//
// PURE and Node-clean: no I/O, no flag reads, no clock. The ONE import is the
// registry's trait adapter (getTraitById — a static-table read with no side
// effects); the unmocked test import is the dependency-surface guard
// (BUILD_RULES §4). NOT a prompt module: the message is a compile artifact
// for the equip surface, never prompt prose.
//
// ONE DECLARATION PER PAIRING (/code-review CR-3): in the PR 3.5 unified
// projection the trait's own mb-08 doc arrives as a projection-hosted rule
// carrying its traitId, so the trait-definition pass skips any trait already
// declared through such a doc — legacy mode (no trait docs visible) still
// declares by definition.

// Spec §2.3 import-boundary ratchet (BUILD_RULES §1 separate gate): trait
// definitions are read THROUGH the registry adapter, never by a new direct
// import of the legacy traitLibrary table (archetypeRegistry.test.js would
// fail CI on a new direct importer; the baseline only shrinks).
import { getTraitById } from './archetypeRegistry.js';

export const DECLARED_CONFLICT_CODES = Object.freeze({
  PROFIT_TARGET_VS_HOLD_VETO: 'profit_target_vs_hold_veto',
});

// The hold-veto templates: prompt-layer rules that forbid selling a winner
// before a scoring threshold. Extend deliberately (each entry is a founder
// ruling), never by inference.
export const HOLD_VETO_SOURCE_REFS = Object.freeze(['mb-08']);

/**
 * The value the ENGINE would fire on — mirrors applyGuardrails exactly
 * (keep-LAST dedup over the type, Math.abs, and the executor's `!(x > 0)`
 * skip) and the prompt's resolveEnforcedProfitTargetPct, so a declaration
 * never cites a number the executor does not hold.
 * @param {Array} userGuardrails - deployedStrategy.guardrails (or [])
 * @returns {number|null}
 */
export function resolveDeclaredProfitTargetPct(userGuardrails) {
  if (!Array.isArray(userGuardrails)) return null;
  let last = null;
  for (const g of userGuardrails) {
    if (g && g.type === 'profitTarget') last = g;
  }
  if (!last || typeof last.value !== 'number') return null;
  const x = Math.abs(last.value);
  return x > 0 ? x : null;
}

function declaration({ targetPct, ruleId, sourceRef, host, hostRef, basis }) {
  const byDefinition = basis === 'trait_definition' ? ' (by trait definition)' : '';
  return {
    code: DECLARED_CONFLICT_CODES.PROFIT_TARGET_VS_HOLD_VETO,
    guardrailType: 'profitTarget',
    targetPct,
    ruleId,
    sourceRef,
    host,
    hostRef,
    basis,
    resolution: 'executor_wins',
    message:
      `The equipped profit target (${targetPct}%) fires deterministically at the next evaluation once a position is up ${targetPct}% from entry, `
      + `regardless of the "let winners run" hold (${sourceRef}${byDefinition}); ${sourceRef} governs only discretionary swaps below the target.`,
  };
}

/**
 * Declare every profit-target × hold-veto pairing visible at equip time.
 *
 * @param {Object} args
 * @param {Array}  [args.userGuardrails] - deployedStrategy.guardrails
 * @param {Array<{id:string, sourceRef?:string|null, host:'bundle'|'projection', hostRef?:string|null}>} [args.rules]
 *   the compiler's assembled rule set (doc id + template id + host provenance)
 * @param {Array<{traitId?:string}>} [args.equippedTraits] - agent.equippedTraits
 *   (or the save's nextState.equippedTraits), resolved by trait definition
 * @returns {Array<Object>} declarations, [] when nothing pairs
 */
export function detectDeclaredRuleConflicts({ userGuardrails, rules, equippedTraits } = {}) {
  const targetPct = resolveDeclaredProfitTargetPct(userGuardrails);
  if (targetPct === null) return [];

  const out = [];
  for (const r of Array.isArray(rules) ? rules : []) {
    if (!r || !r.id || !HOLD_VETO_SOURCE_REFS.includes(r.sourceRef)) continue;
    out.push(declaration({
      targetPct,
      ruleId: r.id,
      sourceRef: r.sourceRef,
      host: r.host === 'projection' ? 'projection' : 'bundle',
      hostRef: r.hostRef ?? null,
      basis: 'rule_doc',
    }));
  }
  for (const t of Array.isArray(equippedTraits) ? equippedTraits : []) {
    const traitId = t && t.traitId;
    const trait = traitId ? getTraitById(traitId) : null;
    if (!trait || !Array.isArray(trait.ruleIds)) continue;
    for (const sourceRef of HOLD_VETO_SOURCE_REFS) {
      if (!trait.ruleIds.includes(sourceRef)) continue;
      // Already declared through the trait's own projection-hosted doc.
      if (out.some((d) => d.host === 'projection' && d.hostRef === traitId && d.sourceRef === sourceRef)) continue;
      out.push(declaration({
        targetPct,
        ruleId: `${traitId}:${sourceRef}`,
        sourceRef,
        host: 'trait',
        hostRef: traitId,
        basis: 'trait_definition',
      }));
    }
  }
  return out;
}
