// api/_utils/__fixtures__/ask2CompilerFixtures.js
// Exit-Behavior Rebalance Tier 2, Ask 2 (rescoped) — the ONE compile input
// both the golden-capture script and the compiler suite read, so the dark
// byte-identity golden (ask2CompilerGoldens.json, captured from the untouched
// pre-edit tree at de4113fd) and the flag-on assertions can never drift on
// inputs.
//
// The delta carries BOTH halves of the SX-04 × mb-08 combination exactly as
// the equip-time compile sees them in production: the user's profit target
// in deployedStrategy.guardrails (→ userGuardrails) and a bundle-hosted
// mb-08 snapshot (sourceRef 'mb-08' — the template id the compat lookup keys
// on). equippedTraits rides on the delta too: the pre-edit compiler ignores
// it, and the golden proves the post-edit DARK compiler still does.

import { stopLossRule, advisoryRule, buildDelta } from '../compilerFixtures.js';

/** A bundle-hosted "let winners run" (mb-08) rule — complete authored metadata. */
export function holdVetoRule({ ruleId = 'fx-mb-08' } = {}) {
  const base = advisoryRule({ ruleId });
  return {
    ...base,
    snapshot: {
      ...base.snapshot,
      sourceRef: 'mb-08',
      text: 'Do not swap any stock with positive P&L until it reaches the BaggerBomb (+1.0x) scoring threshold',
      textTemplate: 'Do not swap any stock with positive P&L until it reaches the {threshold} scoring threshold',
      params: { threshold: { type: 'select', default: 'BaggerBomb (+1.0x)' } },
      paramValues: { threshold: 'BaggerBomb (+1.0x)' },
      category: 'mid_battle',
    },
    metadata: { ...base.metadata, receiptTag: 'hold_veto' },
  };
}

export const PROFIT_TARGET_GUARDRAIL = Object.freeze({ type: 'profitTarget', value: 15, unit: '%', enforcement: 'hard' });

/** The pair delta: stop-loss + mb-08 rules, a 15% profit target, one equipped trait. */
export function pairDelta({ userGuardrails = [PROFIT_TARGET_GUARDRAIL], equippedTraits = [{ traitId: 'trait-let-winners-run' }] } = {}) {
  return {
    ...buildDelta([stopLossRule(), holdVetoRule()], { userGuardrails: [...userGuardrails] }),
    equippedTraits: [...equippedTraits],
  };
}

/** The same delta with NO mb-08 anywhere (no trait, no rule). */
export function noPairDelta() {
  return {
    ...buildDelta([stopLossRule()], { userGuardrails: [PROFIT_TARGET_GUARDRAIL] }),
    equippedTraits: [],
  };
}
