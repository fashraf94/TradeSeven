// api/_utils/agentEvalToolSchema.test.js
//
// Swap Motive Observability (Tier 1) — the swap_type motive enum on the mid-battle
// TRADE_DECISION_TOOL. Neutral, declaration-only: it asks the model to LABEL the
// swap it is already making, it must not be a hard-required field (that would force
// it on HOLD too), and its descriptions must not nudge behavior.

import { describe, it, expect } from 'vitest';
import { TRADE_DECISION_TOOL } from './agentEvalToolSchema.js';

describe('agentEvalToolSchema — swap_type motive enum (Tier 1)', () => {
  const props = TRADE_DECISION_TOOL.input_schema.properties;

  it('exposes swap_type with exactly the four neutral motives', () => {
    expect(props.swap_type).toBeDefined();
    expect(props.swap_type.type).toBe('string');
    expect(props.swap_type.enum).toEqual([
      'defensive_cut',
      'profit_take',
      'momentum_rotation',
      'upgrade',
    ]);
  });

  it('is NOT in the top-level required[] (SWAP-only; must not be forced on HOLD)', () => {
    expect(TRADE_DECISION_TOOL.input_schema.required).not.toContain('swap_type');
    // Mirrors the established "Required if SWAP" description-only pattern of
    // symbolOut / symbolIn, which are likewise absent from required[].
    expect(TRADE_DECISION_TOOL.input_schema.required).not.toContain('symbolOut');
    expect(props.swap_type.description).toMatch(/required if swap/i);
  });

  it('describes the motives neutrally — a label, not an instruction (no behavioral nudging)', () => {
    const d = props.swap_type.description.toLowerCase();
    // Explicitly framed as a label, not a directive.
    expect(d).toMatch(/label, not an instruction/);
    // No preference/nudge language that would smuggle Tier-2 behavior in.
    expect(d).not.toMatch(/\bprefer\b/);
    expect(d).not.toMatch(/\byou should\b/);
    expect(d).not.toMatch(/\bavoid\b/);
  });
});
