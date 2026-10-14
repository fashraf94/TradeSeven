// src/config/cryptoSlotPromptFlags.test.js
//
// Crypto Slot paragraph — DARK pin (BUILD_RULES §2). CRYPTO_SLOT_PROMPT_ENABLED
// ships FALSE on purpose: the tiered eval prompt's YOUR CRYPTO SLOT block is
// built dark and flips in its own commit after the replay probe reads clean
// and Flash signs off (docs/audits/20261014_BUILD_CRYPTO_SLOT_PROMPT.md §6–§7).
//
// This row is a tripwire in BOTH directions. An accidental flip to true would
// change every tiered eval prompt; the flag-pin guard turns that into a loud
// failure naming this file. When the flip IS deliberate, this assertion moves
// to true AND the flag's DARK_BY_DESIGN entry is dropped from
// flagPinGuard.test.js — in the same commit, which is the coupling the guard
// enforces. The row's title names no value, so the flip moves one literal
// here. Referenced by the flag's "Pinned by:" docstring in featureFlags.js.
//
// Deliberately pins ONLY this flag (the equippedRulePrecedenceFlags.test.js
// precedent): pinning a flag obliges its docstring to name this file.

import { describe, it, expect } from 'vitest';
import { CRYPTO_SLOT_PROMPT_ENABLED } from './featureFlags.js';

describe('Crypto Slot paragraph flag — pin (BUILD_RULES §2)', () => {
  it('CRYPTO_SLOT_PROMPT_ENABLED holds its shipped value; a flip moves this literal and the DARK_BY_DESIGN entry together', () => {
    expect(CRYPTO_SLOT_PROMPT_ENABLED).toBe(false);
  });
});
