// src/config/equippedRulePrecedenceFlags.test.js
//
// Exit-Behavior Rebalance Tier 2, Ask 2 (rescoped) — DARK pin (BUILD_RULES
// §2). EQUIPPED_RULE_PRECEDENCE_ENABLED ships FALSE on purpose: the qualified
// DECISION FRAMEWORK MUSTs, the R8 yield clause and the compiler's
// profit-target × mb-08 declaration are built dark and flip in their own
// one-line PR after founder smoke (R10: after Asks 1+3, which are live).
//
// This row is a tripwire in BOTH directions. An accidental flip to true would
// change every eval prompt; the flag-pin guard turns that into a loud failure
// naming this file. When the flip IS deliberate, this assertion moves to true
// AND the flag's DARK_BY_DESIGN entry is dropped from flagPinGuard.test.js —
// in the same commit, which is the coupling the guard enforces. Referenced by
// the flag's "Pinned by:" docstring in featureFlags.js.
//
// Deliberately pins ONLY this flag (the commandCenterSyncFlags.test.js
// precedent): pinning a flag obliges its docstring to name this file.

import { describe, it, expect } from 'vitest';
import { EQUIPPED_RULE_PRECEDENCE_ENABLED } from './featureFlags.js';

describe('Equipped-rule precedence flag — Ask 2 dark pin (BUILD_RULES §2)', () => {
  it('ships DARK — every eval prompt and compiled build is byte-identical until a deliberate flip', () => {
    expect(EQUIPPED_RULE_PRECEDENCE_ENABLED).toBe(false);
  });
});
