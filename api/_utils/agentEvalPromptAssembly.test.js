// api/_utils/agentEvalPromptAssembly.test.js
// Spec A Phase 2a: tests for buildVisionStateBlock.

import { describe, it, expect } from 'vitest';
import { buildVisionStateBlock } from './agentEvalPromptAssembly.js';

// ==================== FIXTURES ====================

function makeVisionState({
  state = 'active',
  thesisStatement = 'Tech leadership rotates into AI infra over the next two weeks.',
  direction = 'long',
  scope = ['NVDA', 'AMD'],
  drivers = ['datacenter capex', 'guidance raise'],
  confidence = 'high',
  confidenceFloat = 0.85,
  activeConstraints = [],
} = {}) {
  return {
    present: true,
    state,
    thesis: {
      statement: thesisStatement,
      structuredSummary: { direction, scope, drivers },
    },
    confidence,
    confidenceFloat,
    activeConstraints,
  };
}

function makeConstraint(type, payload, id = 'c1') {
  return { id, type, payload };
}

// ==================== TESTS ====================

describe('buildVisionStateBlock', () => {
  it('returns empty string when visionState is missing', () => {
    expect(buildVisionStateBlock(null)).toBe('');
    expect(buildVisionStateBlock(undefined)).toBe('');
  });

  it('returns empty string when present is false', () => {
    expect(buildVisionStateBlock({ present: false })).toBe('');
  });

  it('returns empty string for unknown state', () => {
    expect(buildVisionStateBlock({ present: true, state: 'mystery' })).toBe('');
  });

  it('renders unformed state', () => {
    const out = buildVisionStateBlock({ present: true, state: 'unformed' });
    expect(out).toContain('## Vision State');
    expect(out).toContain('No active Vision');
    expect(out).toContain('conservatively');
  });

  it('renders proposed state with thesis', () => {
    const vs = makeVisionState({ state: 'proposed', thesisStatement: 'Buy the dip in semis.' });
    const out = buildVisionStateBlock(vs);
    expect(out).toContain('PROPOSED');
    expect(out).toContain('Buy the dip in semis.');
    expect(out).toContain('awaiting confirmation');
  });

  it('renders active state with thesis, direction, scope, drivers, confidence', () => {
    const vs = makeVisionState();
    const out = buildVisionStateBlock(vs);
    expect(out).toContain('ACTIVE thesis');
    expect(out).toContain('confidence: high / 0.85');
    expect(out).toContain('Direction: long');
    expect(out).toContain('Scope: NVDA, AMD');
    expect(out).toContain('Drivers: datacenter capex, guidance raise');
    expect(out).toContain('Active constraints (0):');
    expect(out).toContain('  (none)');
  });

  it('renders active state with user_carveout constraints', () => {
    const vs = makeVisionState({
      activeConstraints: [
        makeConstraint('user_carveout', { statement: 'never short crypto' }, 'c1'),
        makeConstraint('user_carveout', { statement: 'avoid TSLA' }, 'c2'),
      ],
    });
    const out = buildVisionStateBlock(vs);
    expect(out).toContain('Active constraints (2):');
    expect(out).toContain('[user_carveout] never short crypto');
    expect(out).toContain('[user_carveout] avoid TSLA');
  });

  it('truncates thesis statements over 500 chars with ellipsis', () => {
    const long = 'A'.repeat(600);
    const vs = makeVisionState({ thesisStatement: long });
    const out = buildVisionStateBlock(vs);
    expect(out).toContain('A'.repeat(500) + '…');
    expect(out).not.toContain('A'.repeat(501));
  });

  it('summarizes more than 10 constraints with overflow line', () => {
    const constraints = Array.from({ length: 13 }, (_, i) =>
      makeConstraint('user_carveout', { statement: `rule ${i}` }, `c${i}`)
    );
    const vs = makeVisionState({ activeConstraints: constraints });
    const out = buildVisionStateBlock(vs);
    expect(out).toContain('Active constraints (13):');
    expect(out).toContain('rule 0');
    expect(out).toContain('rule 9');
    expect(out).not.toContain('rule 10');
    expect(out).toContain('(3 additional constraints not shown)');
  });

  it('renders category_b_forge constraints with ruleKind and ruleId', () => {
    const vs = makeVisionState({
      activeConstraints: [
        makeConstraint('category_b_forge', { ruleKind: 'stop_loss', ruleId: 'r_42' }),
      ],
    });
    const out = buildVisionStateBlock(vs);
    expect(out).toContain('[category_b_forge] stop_loss: r_42');
  });

  it('renders system_injected constraints with scope and cause', () => {
    const vs = makeVisionState({
      activeConstraints: [
        makeConstraint('system_injected', { scope: 'position', eventCause: 'earnings_blackout' }),
      ],
    });
    const out = buildVisionStateBlock(vs);
    expect(out).toContain('[system_injected] position: earnings_blackout');
  });

  it('renders under_debate state', () => {
    const vs = makeVisionState({ state: 'under_debate', thesisStatement: 'Rates pivot mid-quarter.' });
    const out = buildVisionStateBlock(vs);
    expect(out).toContain('UNDER DEBATE');
    expect(out).toContain('Rates pivot mid-quarter.');
    expect(out).toContain('raise conviction floors');
  });

  it('renders stale state', () => {
    const vs = makeVisionState({ state: 'stale', thesisStatement: 'Old thesis.' });
    const out = buildVisionStateBlock(vs);
    expect(out).toContain('STALE');
    expect(out).toContain('Old thesis.');
    expect(out).toContain('Trade conservatively');
  });

  it('renders retired state defensively', () => {
    const vs = makeVisionState({ state: 'retired' });
    const out = buildVisionStateBlock(vs);
    expect(out).toContain('Battle is ending');
    expect(out).toContain('No new directional decisions');
  });

  it('handles missing confidenceFloat gracefully in active state', () => {
    const vs = makeVisionState();
    delete vs.confidenceFloat;
    const out = buildVisionStateBlock(vs);
    expect(out).toContain('confidence: high / —');
  });

  it('handles missing scope/drivers in active state', () => {
    const vs = makeVisionState({ scope: [], drivers: [] });
    const out = buildVisionStateBlock(vs);
    expect(out).toContain('Scope: (unscoped)');
    expect(out).toContain('Drivers: (no named drivers)');
  });
});
