// api/_utils/agentGuardrails.pairing.test.js
// Exit-Behavior Rebalance Tier 2, Ask 3 — F11: kill the maxPosition bug CLASS.
//
// §9 as a test: no guardrail shape may enter SUPPORTED_GUARDRAIL_SHAPES
// (the compiler's promise) without a registered executor (the engine's
// delivery), and every non-executor type must carry an explicit displayed
// advisory classification instead. One flag gates BOTH compiler acceptance
// and executor registration, asserted structurally on the source so the two
// gates can never drift apart.
//
// REAL flags here (no mock): this suite pins the live dark state.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import {
  SUPPORTED_GUARDRAIL_SHAPES,
  PROFIT_TARGET_GUARDRAIL_SHAPE,
  BINDING_DESCRIPTOR_FIELDS,
} from './compileBuild.js';
import { guardrailExecutionClass, KNOWN_GUARDRAIL_TYPES } from './agentGuardrails.js';
import { PROFIT_TARGET_EXECUTOR_ENABLED } from '../../src/config/featureFlags.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const guardrailsSource = readFileSync(join(HERE, 'agentGuardrails.js'), 'utf8');
const compileSource = readFileSync(join(HERE, 'compileBuild.js'), 'utf8');

describe('F11 pairing — every supported shape has a registered executor', () => {
  it('every shape in SUPPORTED_GUARDRAIL_SHAPES resolves to an executor (no promise-first shape can enter)', () => {
    for (const type of Object.keys(SUPPORTED_GUARDRAIL_SHAPES)) {
      expect(
        guardrailExecutionClass(type),
        `shape '${type}' is compiler-supported but has no registered executor — the maxPosition label lie, reborn`,
      ).toBe('executor');
    }
  });

  it('every known type resolves to exactly one class, and every non-executor is an explicit displayed advisory outside the shape table', () => {
    // Advisory membership DERIVED at call time from the one classifier (CR4:
    // no second, import-frozen list that could disagree with it).
    for (const type of KNOWN_GUARDRAIL_TYPES) {
      const cls = guardrailExecutionClass(type);
      expect(['executor', 'advisory_displayed']).toContain(cls);
      if (cls === 'advisory_displayed') {
        expect(SUPPORTED_GUARDRAIL_SHAPES[type]).toBeUndefined();
      }
    }
    // maxPosition is permanently advisory (the documented BaggerBomb no-op).
    expect(guardrailExecutionClass('maxPosition')).toBe('advisory_displayed');
  });

  it('an unknown type resolves to no class at all (fail-closed, never silently "executor")', () => {
    expect(guardrailExecutionClass('nonsenseType')).toBeNull();
  });
});

describe('F11 one-flag gate — compiler acceptance and executor registration share PROFIT_TARGET_EXECUTOR_ENABLED', () => {
  it('the flag is LIVE (R10: flipped jointly with Ask 1 — the 2026-08 joint-flip PR)', () => {
    expect(PROFIT_TARGET_EXECUTOR_ENABLED).toBe(true);
  });

  it('dark state: profitTarget is absent from the supported shapes and classified displayed-advisory; live state: present and executor', () => {
    if (PROFIT_TARGET_EXECUTOR_ENABLED) {
      expect(SUPPORTED_GUARDRAIL_SHAPES.profitTarget).toEqual(PROFIT_TARGET_GUARDRAIL_SHAPE);
      expect(guardrailExecutionClass('profitTarget')).toBe('executor');
    } else {
      expect(SUPPORTED_GUARDRAIL_SHAPES.profitTarget).toBeUndefined();
      expect(guardrailExecutionClass('profitTarget')).toBe('advisory_displayed');
    }
  });

  it('BOTH sources gate on the same flag identifier (structural: neither side can flip alone)', () => {
    expect(compileSource).toMatch(/PROFIT_TARGET_EXECUTOR_ENABLED \? \{ profitTarget: PROFIT_TARGET_GUARDRAIL_SHAPE \} : \{\}/);
    expect(guardrailsSource).toMatch(/import \{[^}]*PROFIT_TARGET_EXECUTOR_ENABLED[^}]*\} from '\.\.\/\.\.\/src\/config\/featureFlags\.js'/s);
    expect(guardrailsSource).toMatch(/PROFIT_TARGET_EXECUTOR_ENABLED/);
  });

  it('the STRICTEST comparator gains its profitTarget row under the SAME flag (dual-review surviving mutation A8b closed)', () => {
    // Without this entry, a flag-on §5.5 merge of two targets silently flips
    // to LOOSEST-wins (compileBuild's min/max branch) — the user's 10% + a
    // rule's 20% would compile to 20%, firing later than the user's order.
    expect(compileSource).toMatch(/const STRICTEST = Object\.freeze\(\{\s*\n\s*stopLoss: 'min', trailingStop: 'min', maxSectorWeight: 'min',\s*\n\s*\.\.\.\(PROFIT_TARGET_EXECUTOR_ENABLED \? \{ profitTarget: 'min' \} : \{\}\),/);
  });

  it('the shape descriptor is complete and winner-side (all eight R1-9 fields, exit at price_above_threshold, entry basis)', () => {
    expect(Object.keys(PROFIT_TARGET_GUARDRAIL_SHAPE).sort()).toEqual([...BINDING_DESCRIPTOR_FIELDS].sort());
    expect(PROFIT_TARGET_GUARDRAIL_SHAPE).toEqual({
      type: 'profitTarget',
      scope: 'position',
      basis: 'entry',
      unit: 'pct',
      trigger: 'price_above_threshold',
      side: 'exit',
      resetBehavior: 'none',
      evaluationTiming: 'post_decision_tick',
    });
  });
});
