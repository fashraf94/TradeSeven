// src/config/cryptoSlotPromptFlags.test.js
//
// Crypto Slot paragraph — pin (BUILD_RULES §2). CRYPTO_SLOT_PROMPT_ENABLED
// ships TRUE since the flip (14 Oct 2026): the tiered eval prompt's YOUR CRYPTO
// SLOT block and (Crypto Slot v2) the live context's CRYPTO SLOT THIS CHECK line
// and RISK STATUS annotation were built dark and flipped in their own commit
// after Fable ruled probe v2's one missed clause non-blocking and Flash signed
// off (docs/audits/20261014_BUILD_CRYPTO_SLOT_CHECK_LINE.md §8, §10; the
// paragraph's first build: docs/audits/20261014_BUILD_CRYPTO_SLOT_PROMPT.md).
//
// This row is a tripwire in BOTH directions. An accidental flip back to false
// would silently drop the block, the line and the annotation from every tiered
// eval prompt; the flag-pin guard turns that into a loud failure naming this
// file. When a rollback IS deliberate, this assertion moves to false AND the
// flag's DARK_BY_DESIGN entry is restored in flagPinGuard.test.js — in the
// same commit, which is the coupling the guard enforces. The row's title names
// no value, so a flip moves one literal here. Referenced by the flag's
// "Pinned by:" docstring in featureFlags.js.
//
// Deliberately pins ONLY this flag (the equippedRulePrecedenceFlags.test.js
// precedent): pinning a flag obliges its docstring to name this file.

import { describe, it, expect } from 'vitest';
import { CRYPTO_SLOT_PROMPT_ENABLED } from './featureFlags.js';

describe('Crypto Slot paragraph flag — pin (BUILD_RULES §2)', () => {
  it('CRYPTO_SLOT_PROMPT_ENABLED holds its shipped value; a flip moves this literal and the DARK_BY_DESIGN entry together', () => {
    expect(CRYPTO_SLOT_PROMPT_ENABLED).toBe(true);
  });
});
