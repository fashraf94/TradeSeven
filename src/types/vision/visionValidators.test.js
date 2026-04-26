// src/types/vision/visionValidators.test.js
// Vitest unit tests for Vision write-path validators.
// Covers the required cases from the Phase 1 prompt §1C.2 plus the
// FLAG C state-gated conditionSnapshot invariants.

import { describe, it, expect } from 'vitest';
import {
  validateVisionShape,
  validateTransition,
  validateConstraintMutation,
  validateVisionInvariants,
} from './visionValidators.js';
import { VALID_TRANSITIONS, isValidTransition } from './visionTransitions.js';
import { createInitialVision } from './visionFactory.js';
import {
  VISION_LIFECYCLE_STATES,
  VISION_TRANSITION_CAUSES,
  VISION_TRANSITION_ACTORS,
  CONSTRAINT_MUTATION_STATES,
  confidenceToFloat,
  CONFIDENCE_FLOAT_MAP,
} from '../../constants/visionEnums.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a duck-typed Firestore Timestamp. */
function ts(seconds, nanoseconds = 0) {
  return { seconds, nanoseconds };
}

const T0 = ts(1_700_000_000);
const T1 = ts(1_700_000_060);
const T2 = ts(1_700_000_120);

function validConditionSnapshot(overrides = {}) {
  return {
    vix: 18.4,
    pointDifferential: 0,
    marketPhase: 'mid',
    takenAt: T0,
    ...overrides,
  };
}

function validTransitionEntry(overrides = {}) {
  return {
    fromState: 'unformed',
    toState: 'proposed',
    timestamp: T1,
    actor: 'gemma',
    cause: 'user_input',
    ...overrides,
  };
}

function validUserCarveout(idSuffix = 'a') {
  return {
    id: `constraint-${idSuffix}`,
    type: 'user_carveout',
    source: 'user-input-xyz',
    payload: {
      statement: 'no overnight holds',
      tags: { tickers: [], sectors: [], behaviors: ['no_overnight_holds'] },
    },
    createdAt: T0,
    expiresAt: null,
    lifecycleBinding: 'vision',
    createdBy: 'user',
  };
}

function validSystemInjected(idSuffix = 's') {
  return {
    id: `constraint-${idSuffix}`,
    type: 'system_injected',
    source: 'risk-event-123',
    payload: {
      eventCause: 'cpi-release',
      scope: 'portfolio',
      target: null,
      reason: 'macro volatility window',
    },
    createdAt: T0,
    expiresAt: null,
    lifecycleBinding: 'event',
    createdBy: 'risk_manager',
  };
}

function validCategoryB(idSuffix = 'b') {
  return {
    id: `constraint-${idSuffix}`,
    type: 'category_b_forge',
    source: 'forge-rule-42',
    payload: {
      ruleId: 'forge-rule-42',
      ruleSnapshot: { threshold: 0.15, direction: 'long' },
      ruleKind: 'stop_loss',
    },
    createdAt: T0,
    expiresAt: null,
    lifecycleBinding: 'battle',
    createdBy: 'forge',
  };
}

/**
 * Build a fully-populated Vision in a non-'unformed' state so shape checks
 * pass. Defaults to 'active' with a valid conditionSnapshot.
 */
function buildVision(overrides = {}) {
  return {
    thesis: {
      statement: 'long tech into earnings',
      structuredSummary: { direction: 'bullish', scope: ['NVDA'], drivers: ['earnings'] },
      authoredBy: 'gemma',
    },
    confidence: 'medium',
    source: 'user-authored',
    state: 'active',
    constraints: [],
    evidenceTrail: [],
    conflicts: [],
    lastUserTouchAt: T0,
    conditionSnapshot: validConditionSnapshot(),
    nextCheckInAt: null,
    transitionHistory: [
      { fromState: 'unformed', toState: 'proposed', timestamp: T0, actor: 'gemma', cause: 'user_input' },
      { fromState: 'proposed', toState: 'active', timestamp: T1, actor: 'gemma', cause: 'user_input' },
    ],
    createdAt: T0,
    lastTransitionAt: T1,
    version: 1,
    ...overrides,
  };
}

/** Mutate one field non-destructively. */
function withField(obj, key, value) {
  return { ...obj, [key]: value };
}

// ---------------------------------------------------------------------------
// confidence float mapping
// ---------------------------------------------------------------------------

describe('confidenceToFloat', () => {
  it('maps the canonical enum', () => {
    expect(confidenceToFloat('low')).toBe(0.3);
    expect(confidenceToFloat('medium')).toBe(0.6);
    expect(confidenceToFloat('high')).toBe(0.9);
    expect(CONFIDENCE_FLOAT_MAP.low).toBe(0.3);
  });
  it('throws on unknown', () => {
    expect(() => confidenceToFloat('unknown')).toThrow(/unknown confidence level/);
  });
});

// ---------------------------------------------------------------------------
// validateVisionShape — structural
// ---------------------------------------------------------------------------

describe('validateVisionShape', () => {
  it('accepts a fully-populated active Vision', () => {
    const r = validateVisionShape(buildVision());
    expect(r).toEqual({ valid: true, errors: [] });
  });

  it('accepts the initial unformed Vision from the factory (conditionSnapshot null)', () => {
    const v = createInitialVision(null, T0);
    const r = validateVisionShape(v);
    expect(r.valid).toBe(true);
  });

  it('rejects missing required top-level field', () => {
    const v = buildVision();
    delete v.thesis;
    const r = validateVisionShape(v);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('vision.thesis'))).toBe(true);
  });

  it('rejects unknown state', () => {
    const r = validateVisionShape(withField(buildVision(), 'state', 'bogus'));
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('vision.state'))).toBe(true);
  });

  it('rejects non-timestamp-shaped timestamp', () => {
    const r = validateVisionShape(withField(buildVision(), 'createdAt', '2026-04-22'));
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('vision.createdAt'))).toBe(true);
  });

  it('FLAG C: unformed + null conditionSnapshot passes', () => {
    const v = buildVision({
      state: 'unformed',
      conditionSnapshot: null,
      transitionHistory: [],
      lastTransitionAt: T0,
    });
    const r = validateVisionShape(v);
    expect(r.valid).toBe(true);
  });

  it('FLAG C: active + null conditionSnapshot fails', () => {
    const v = buildVision({ conditionSnapshot: null });
    const r = validateVisionShape(v);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('conditionSnapshot'))).toBe(true);
  });

  it('FLAG C: unformed + non-null conditionSnapshot also passes (the rule is permissive, not exclusive)', () => {
    const v = buildVision({
      state: 'unformed',
      conditionSnapshot: validConditionSnapshot(),
      transitionHistory: [],
      lastTransitionAt: T0,
    });
    const r = validateVisionShape(v);
    expect(r.valid).toBe(true);
  });

  it('rejects constraint with bad enum', () => {
    const bad = { ...validUserCarveout(), createdBy: 'alien' };
    const r = validateVisionShape(buildVision({ constraints: [bad] }));
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('createdBy'))).toBe(true);
  });

  it('accepts a constraint with a system_injected payload', () => {
    const r = validateVisionShape(buildVision({ constraints: [validSystemInjected()] }));
    expect(r.valid).toBe(true);
  });

  it('accepts a constraint with a category_b_forge payload', () => {
    const r = validateVisionShape(buildVision({ constraints: [validCategoryB()] }));
    expect(r.valid).toBe(true);
  });

  it('rejects category_b_forge with non-object ruleSnapshot', () => {
    const bad = {
      ...validCategoryB(),
      payload: { ruleId: 'r1', ruleSnapshot: 'oops', ruleKind: 'stop_loss' },
    };
    const r = validateVisionShape(buildVision({ constraints: [bad] }));
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('ruleSnapshot'))).toBe(true);
  });

  it('rejects version < 1', () => {
    const r = validateVisionShape(withField(buildVision(), 'version', 0));
    expect(r.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateTransition
// ---------------------------------------------------------------------------

describe('validateTransition — initial (battle creation)', () => {
  it('accepts initial Vision with state=unformed and empty history', () => {
    const v = createInitialVision(null, T0);
    const r = validateTransition(null, v, 'battle_creation', 'battle_start');
    expect(r.valid).toBe(true);
  });

  it('rejects initial Vision with state !== unformed', () => {
    const v = { ...createInitialVision(null, T0), state: 'active' };
    const r = validateTransition(null, v, 'battle_creation', 'battle_start');
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('initial state must be'))).toBe(true);
  });

  it('rejects initial Vision with non-empty history', () => {
    const v = {
      ...createInitialVision(null, T0),
      transitionHistory: [validTransitionEntry({ fromState: 'unformed' })],
    };
    const r = validateTransition(null, v, 'battle_creation', 'battle_start');
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('empty transitionHistory'))).toBe(true);
  });
});

describe('validateTransition — battle creation (cause, actor) gating (V3)', () => {
  const v = createInitialVision(null, T0);

  it('passes with actor=battle_creation, cause=battle_start', () => {
    const r = validateTransition(null, v, 'battle_creation', 'battle_start');
    expect(r).toEqual({ valid: true, errors: [] });
  });

  it('passes with actor=layer1, cause=battle_start', () => {
    const r = validateTransition(null, v, 'layer1', 'battle_start');
    expect(r).toEqual({ valid: true, errors: [] });
  });

  it('fails with actor=gemma, cause=user_input', () => {
    const r = validateTransition(null, v, 'gemma', 'user_input');
    expect(r.valid).toBe(false);
    expect(
      r.errors.some(
        (e) =>
          e.includes('invalid initial transition') &&
          e.includes('"gemma"') &&
          e.includes('"user_input"'),
      ),
    ).toBe(true);
  });

  it('fails with actor=battle_creation, cause=directional_trigger', () => {
    const r = validateTransition(null, v, 'battle_creation', 'directional_trigger');
    expect(r.valid).toBe(false);
    expect(
      r.errors.some(
        (e) =>
          e.includes('invalid initial transition') &&
          e.includes('"battle_creation"') &&
          e.includes('"directional_trigger"'),
      ),
    ).toBe(true);
  });

  it('fails with actor=cron, cause=battle_start', () => {
    const r = validateTransition(null, v, 'cron', 'battle_start');
    expect(r.valid).toBe(false);
    expect(
      r.errors.some(
        (e) =>
          e.includes('invalid initial transition') &&
          e.includes('"cron"') &&
          e.includes('"battle_start"'),
      ),
    ).toBe(true);
  });
});

describe('validateTransition — table coverage', () => {
  it('every entry in VALID_TRANSITIONS admits a synthetic valid tuple', () => {
    for (const edge of VALID_TRANSITIONS) {
      for (const cause of edge.allowedCauses) {
        for (const actor of edge.allowedActors) {
          expect(isValidTransition(edge.from, edge.to, cause, actor)).toBe(true);
        }
      }
    }
  });

  it('wrong actor on a valid edge fails', () => {
    // active -> under_debate needs gemma
    expect(isValidTransition('active', 'under_debate', 'directional_trigger', 'cron')).toBe(false);
  });

  it('wrong cause on a valid edge fails', () => {
    // active -> under_debate needs directional_trigger
    expect(isValidTransition('active', 'under_debate', 'user_input', 'gemma')).toBe(false);
  });

  it('retired is terminal — no outgoing transitions', () => {
    for (const to of VISION_LIFECYCLE_STATES) {
      for (const cause of VISION_TRANSITION_CAUSES) {
        for (const actor of VISION_TRANSITION_ACTORS) {
          expect(isValidTransition('retired', to, cause, actor)).toBe(false);
        }
      }
    }
  });

  it('every from->to pair NOT in the table fails', () => {
    // Build the set of (from,to) pairs that ARE in the table
    const allowed = new Set(VALID_TRANSITIONS.map((e) => `${e.from}->${e.to}`));
    for (const from of VISION_LIFECYCLE_STATES) {
      for (const to of VISION_LIFECYCLE_STATES) {
        const key = `${from}->${to}`;
        if (allowed.has(key)) continue;
        // Should fail for every cause/actor combo
        expect(isValidTransition(from, to, 'user_input', 'gemma')).toBe(false);
      }
    }
  });
});

describe('validateTransition — housekeeping', () => {
  function makeProposedFromUnformed() {
    const prev = {
      ...createInitialVision(null, T0),
    };
    const newEntry = validTransitionEntry({
      fromState: 'unformed',
      toState: 'proposed',
      timestamp: T1,
      actor: 'gemma',
      cause: 'user_input',
    });
    const next = {
      ...prev,
      state: 'proposed',
      conditionSnapshot: validConditionSnapshot(),
      transitionHistory: [newEntry],
      lastTransitionAt: T1,
    };
    return { prev, next };
  }

  it('valid unformed -> proposed with populated conditionSnapshot passes', () => {
    const { prev, next } = makeProposedFromUnformed();
    const r = validateTransition(prev, next, 'gemma', 'user_input');
    expect(r).toEqual({ valid: true, errors: [] });
  });

  it('FLAG C: unformed -> proposed with null conditionSnapshot fails', () => {
    const { prev, next } = makeProposedFromUnformed();
    next.conditionSnapshot = null;
    const r = validateTransition(prev, next, 'gemma', 'user_input');
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes("transition out of 'unformed'"))).toBe(true);
  });

  it('history length must grow by exactly 1', () => {
    const { prev, next } = makeProposedFromUnformed();
    next.transitionHistory = [];
    const r = validateTransition(prev, next, 'gemma', 'user_input');
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('expected length 1'))).toBe(true);
  });

  it('lastTransitionAt must equal new entry timestamp', () => {
    const { prev, next } = makeProposedFromUnformed();
    next.lastTransitionAt = T2;
    const r = validateTransition(prev, next, 'gemma', 'user_input');
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('lastTransitionAt'))).toBe(true);
  });

  it('createdAt must not change', () => {
    const { prev, next } = makeProposedFromUnformed();
    next.createdAt = T2;
    const r = validateTransition(prev, next, 'gemma', 'user_input');
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('createdAt'))).toBe(true);
  });

  it('new entry fromState/toState/actor/cause must match transition', () => {
    const { prev, next } = makeProposedFromUnformed();
    next.transitionHistory[0] = {
      ...next.transitionHistory[0],
      actor: 'cron',
    };
    const r = validateTransition(prev, next, 'gemma', 'user_input');
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('actor'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateTransition — battle_end retirement actor expansion (cron + sonnet)
// ---------------------------------------------------------------------------

describe('validateTransition — battle_end retirement actor expansion', () => {
  function makeRetirementCase(fromState, actor) {
    const baseHistory = [
      { fromState: 'unformed', toState: 'proposed', timestamp: T0, actor: 'gemma', cause: 'user_input' },
      { fromState: 'proposed', toState: 'active',   timestamp: T1, actor: 'gemma', cause: 'user_input' },
    ];
    const prev = buildVision({ state: fromState, transitionHistory: baseHistory, lastTransitionAt: T1 });
    const newEntry = validTransitionEntry({
      fromState,
      toState: 'retired',
      timestamp: T2,
      actor,
      cause: 'battle_end',
    });
    const next = {
      ...prev,
      state: 'retired',
      transitionHistory: [...baseHistory, newEntry],
      lastTransitionAt: T2,
    };
    return { prev, next };
  }

  it('accepts actor=cron on active -> retired', () => {
    const { prev, next } = makeRetirementCase('active', 'cron');
    const r = validateTransition(prev, next, 'cron', 'battle_end');
    expect(r).toEqual({ valid: true, errors: [] });
  });

  it('accepts actor=sonnet on active -> retired', () => {
    const { prev, next } = makeRetirementCase('active', 'sonnet');
    const r = validateTransition(prev, next, 'sonnet', 'battle_end');
    expect(r).toEqual({ valid: true, errors: [] });
  });

  it('accepts actor=cron on stale -> retired', () => {
    const { prev, next } = makeRetirementCase('stale', 'cron');
    const r = validateTransition(prev, next, 'cron', 'battle_end');
    expect(r).toEqual({ valid: true, errors: [] });
  });

  it('accepts actor=cron on under_debate -> retired', () => {
    const { prev, next } = makeRetirementCase('under_debate', 'cron');
    const r = validateTransition(prev, next, 'cron', 'battle_end');
    expect(r).toEqual({ valid: true, errors: [] });
  });

  it('accepts actor=cron on proposed -> retired', () => {
    const { prev, next } = makeRetirementCase('proposed', 'cron');
    const r = validateTransition(prev, next, 'cron', 'battle_end');
    expect(r).toEqual({ valid: true, errors: [] });
  });

  it('accepts actor=cron on unformed -> retired', () => {
    const { prev, next } = makeRetirementCase('unformed', 'cron');
    const r = validateTransition(prev, next, 'cron', 'battle_end');
    expect(r).toEqual({ valid: true, errors: [] });
  });

  it('rejects actor=gemma on battle_end -> retired', () => {
    const { prev, next } = makeRetirementCase('active', 'gemma');
    const r = validateTransition(prev, next, 'gemma', 'battle_end');
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('actor=gemma'))).toBe(true);
  });

  it('rejects actor=risk_manager on battle_end -> retired', () => {
    const { prev, next } = makeRetirementCase('active', 'risk_manager');
    const r = validateTransition(prev, next, 'risk_manager', 'battle_end');
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('actor=risk_manager'))).toBe(true);
  });

  it('rejects actor=layer1 on battle_end -> retired', () => {
    const { prev, next } = makeRetirementCase('active', 'layer1');
    const r = validateTransition(prev, next, 'layer1', 'battle_end');
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('actor=layer1'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateConstraintMutation
// ---------------------------------------------------------------------------

describe('validateConstraintMutation', () => {
  it('no-op mutation passes regardless of state', () => {
    const v = buildVision({ state: 'retired', constraints: [validUserCarveout('x')] });
    const next = { ...v };
    const r = validateConstraintMutation(v, next);
    expect(r.valid).toBe(true);
  });

  it('retired + any constraint mutation fails', () => {
    const prev = buildVision({ state: 'retired' });
    const next = buildVision({ state: 'retired', constraints: [validUserCarveout('x')] });
    const r = validateConstraintMutation(prev, next);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('retired'))).toBe(true);
  });

  it('system-injected constraint may be added in stale', () => {
    const prev = buildVision({ state: 'stale' });
    const next = buildVision({ state: 'stale', constraints: [validSystemInjected('s1')] });
    const r = validateConstraintMutation(prev, next);
    expect(r.valid).toBe(true);
  });

  it('user-carveout constraint in stale fails', () => {
    const prev = buildVision({ state: 'stale' });
    const next = buildVision({ state: 'stale', constraints: [validUserCarveout('u1')] });
    const r = validateConstraintMutation(prev, next);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('non-system-injected'))).toBe(true);
  });

  it('user-carveout constraint in active passes', () => {
    const prev = buildVision({ state: 'active' });
    const next = buildVision({ state: 'active', constraints: [validUserCarveout('u1')] });
    const r = validateConstraintMutation(prev, next);
    expect(r.valid).toBe(true);
  });

  it('category-b-forge constraint in proposed passes', () => {
    const prev = buildVision({ state: 'proposed' });
    const next = buildVision({ state: 'proposed', constraints: [validCategoryB('b1')] });
    const r = validateConstraintMutation(prev, next);
    expect(r.valid).toBe(true);
  });

  it('system-injected constraint in unformed passes (not in retired)', () => {
    const prev = buildVision({
      state: 'unformed',
      conditionSnapshot: null,
      transitionHistory: [],
      lastTransitionAt: T0,
    });
    const next = { ...prev, constraints: [validSystemInjected('s1')] };
    const r = validateConstraintMutation(prev, next);
    expect(r.valid).toBe(true);
  });
});

describe('validateConstraintMutation — 9-cell state×type matrix (C5)', () => {
  // State-by-state base Vision builder. 'unformed' requires null snapshot and
  // empty history; all other states use the buildVision default shape.
  function baseFor(state) {
    if (state === 'unformed') {
      return buildVision({
        state: 'unformed',
        conditionSnapshot: null,
        transitionHistory: [],
        lastTransitionAt: T0,
      });
    }
    return buildVision({ state });
  }

  // Per-type constraint builder.
  function constraintFor(type, idSuffix) {
    if (type === 'user_carveout') return validUserCarveout(idSuffix);
    if (type === 'category_b_forge') return validCategoryB(idSuffix);
    if (type === 'system_injected') return validSystemInjected(idSuffix);
    throw new Error(`unknown constraint type ${type}`);
  }

  // Expected-pass lookup derived from the rules:
  //   - system_injected: allowed in any non-retired state (retired is excluded from this matrix)
  //   - user_carveout / category_b_forge: allowed only in CONSTRAINT_MUTATION_STATES
  function shouldPass(state, type) {
    if (type === 'system_injected') return true;
    return CONSTRAINT_MUTATION_STATES.includes(state);
  }

  const states = ['unformed', 'proposed', 'active', 'under_debate', 'stale'];
  const types = ['user_carveout', 'category_b_forge', 'system_injected'];

  for (const state of states) {
    for (const type of types) {
      const expected = shouldPass(state, type);
      const label = expected ? 'passes' : 'fails';

      it(`${label}: add ${type} in ${state}`, () => {
        const prev = baseFor(state);
        const next = { ...prev, constraints: [constraintFor(type, `${state}-${type}-add`)] };
        const r = validateConstraintMutation(prev, next);
        expect(r.valid).toBe(expected);
        if (!expected) {
          expect(
            r.errors.some(
              (e) =>
                e.includes('non-system-injected') &&
                e.includes(JSON.stringify(state)),
            ),
          ).toBe(true);
        }
      });

      it(`${label}: remove ${type} in ${state}`, () => {
        const c = constraintFor(type, `${state}-${type}-rm`);
        const prev = { ...baseFor(state), constraints: [c] };
        const next = { ...prev, constraints: [] };
        const r = validateConstraintMutation(prev, next);
        expect(r.valid).toBe(expected);
        if (!expected) {
          expect(
            r.errors.some(
              (e) =>
                e.includes('non-system-injected') &&
                e.includes(JSON.stringify(state)),
            ),
          ).toBe(true);
        }
      });
    }
  }
});

// ---------------------------------------------------------------------------
// validateVisionInvariants
// ---------------------------------------------------------------------------

describe('validateVisionInvariants', () => {
  it('initial factory Vision passes', () => {
    const r = validateVisionInvariants(createInitialVision(null, T0));
    expect(r.valid).toBe(true);
  });

  it('catches lastTransitionAt drift from last history entry', () => {
    const v = buildVision({ lastTransitionAt: T2 });
    // history's last timestamp is T1 in buildVision
    const r = validateVisionInvariants(v);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('invariant 7'))).toBe(true);
  });

  it('catches createdAt > lastTransitionAt', () => {
    const v = buildVision({
      createdAt: T2,
      lastTransitionAt: T1,
      // keep history consistent with lastTransitionAt
      transitionHistory: [validTransitionEntry({ timestamp: T1 })],
    });
    const r = validateVisionInvariants(v);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('invariant 8'))).toBe(true);
  });
});

describe('validateVisionInvariants — invariant 6 read-side (V5)', () => {
  it('passes: state=unformed with empty history', () => {
    const v = createInitialVision(null, T0);
    const r = validateVisionInvariants(v);
    expect(r).toEqual({ valid: true, errors: [] });
  });

  it('passes: state=active with non-empty history', () => {
    const r = validateVisionInvariants(buildVision());
    expect(r).toEqual({ valid: true, errors: [] });
  });

  for (const state of ['proposed', 'active', 'under_debate', 'stale', 'retired']) {
    it(`fails: state=${state} with empty history`, () => {
      const v = buildVision({
        state,
        transitionHistory: [],
        lastTransitionAt: T0,
        createdAt: T0,
      });
      const r = validateVisionInvariants(v);
      expect(r.valid).toBe(false);
      expect(
        r.errors.some(
          (e) => e.includes('invariant 6') && e.includes(JSON.stringify(state)),
        ),
      ).toBe(true);
    });
  }
});

// ---------------------------------------------------------------------------
// createInitialVision
// ---------------------------------------------------------------------------

describe('createInitialVision', () => {
  it('produces a Vision that passes shape and battle-creation transition validators', () => {
    const v = createInitialVision(null, T0);
    expect(validateVisionShape(v).valid).toBe(true);
    expect(validateTransition(null, v, 'battle_creation', 'battle_start').valid).toBe(true);
  });

  it('passes conditionSnapshot through verbatim (including null)', () => {
    expect(createInitialVision(null, T0).conditionSnapshot).toBe(null);
    const snap = validConditionSnapshot();
    expect(createInitialVision(snap, T0).conditionSnapshot).toBe(snap);
  });

  it('sets state=unformed, confidence=low, source=agent-generated-fallback, version=1', () => {
    const v = createInitialVision(null, T0);
    expect(v.state).toBe('unformed');
    expect(v.confidence).toBe('low');
    expect(v.source).toBe('agent-generated-fallback');
    expect(v.version).toBe(1);
    expect(v.transitionHistory).toEqual([]);
    expect(v.constraints).toEqual([]);
    expect(v.evidenceTrail).toEqual([]);
    expect(v.conflicts).toEqual([]);
    expect(v.nextCheckInAt).toBe(null);
  });
});
