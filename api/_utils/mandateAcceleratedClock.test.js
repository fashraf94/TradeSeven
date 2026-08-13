// api/_utils/mandateAcceleratedClock.test.js
// Spec 1 §9 acceptance item 5 — the accelerated-clock harness drives the REAL
// lifecycle cores through fast-forwarded scenarios and reports observations. This
// is the machinery the acceptance run uses; here we prove each scenario produces
// the invariants §9 requires (capital carried, FR-1 firing, empty:true catch-up,
// escape reset) against the transaction-faithful fake.

import { describe, it, expect } from 'vitest';
import {
  runScenario, acceleratedScenarios,
  simulateFullRollover, simulateFr1Violation, simulateTwoBoundaryCatchup, simulateEscape,
} from './mandateAcceleratedClock.js';
import { makeMandateFakeDb } from './__testsupport__/mandateFakeFirestore.js';
import { MANDATE_STARTING_CAPITAL } from './mandateConfig.js';

const NOW = new Date('2026-08-13T12:00:00Z');

describe('accelerated harness — full rollover (capital carried, lens reset, summary derived)', () => {
  it('rolls a backdated book and observes FR-1 carry + lens reset + row-derived summary', async () => {
    const db = makeMandateFakeDb({});
    const r = await simulateFullRollover(db, { userId: 'u_full', archetype: 'analyst', now: NOW });
    expect(r.ok).toBe(true);
    const o = r.observations;
    expect(o.capitalCarried).toBe(true);           // FR-1
    expect(o.preTotalValue).toBe(o.postTotalValue);
    expect(o.quarterIndexBefore).toBe(1);
    expect(o.quarterIndexAfter).toBe(2);
    expect(o.quarterLensReset).toBe(true);
    expect(o.lifetimeLensUntouched).toBe(true);
    expect(o.vintageResolves).toBe(true);
    expect(o.summaryDerivedFromRows).toBe(true);
    expect(o.summaryScoring).toBe(true);
  });
});

describe('accelerated harness — FR-1 assertion observed FIRING on an injected violation', () => {
  it('an injected capital mutation aborts the rollover transaction; nothing commits', async () => {
    const db = makeMandateFakeDb({});
    const r = await simulateFr1Violation(db, { userId: 'u_fr1', archetype: 'analyst', now: NOW });
    expect(r.ok).toBe(true); // "ok" here means the assertion FIRED as required
    expect(r.observations.assertionFired).toBe(true);
    expect(r.observations.message).toMatch(/FR-1 violation/);
    expect(r.observations.transactionAborted).toBe(true);
    expect(r.observations.noSummaryWritten).toBe(true);
  });
});

describe('accelerated harness — two-boundary catch-up with an empty quarter', () => {
  it('processes two boundaries oldest-first, carrying capital, with quarter 2 empty:true', async () => {
    const db = makeMandateFakeDb({});
    const r = await simulateTwoBoundaryCatchup(db, { userId: 'u_catchup', archetype: 'analyst', now: NOW });
    expect(r.ok).toBe(true);
    const o = r.observations;
    expect(o.boundariesProcessed).toBeGreaterThanOrEqual(2);
    expect(o.oldestFirst).toBe(true);
    expect(o.capitalCarried).toBe(true);   // FR-1 across every boundary
    expect(o.summary1Empty).toBe(false);   // quarter 1 had rows
    expect(o.summary2Empty).toBe(true);    // quarter 2 had none → never fabricated
    expect(o.caughtUp).toBe(true);
  });
});

describe('accelerated harness — escape hatch (reset, void, non-scoring, once-ever)', () => {
  it('voids the old book, resets the replacement to starting capital, sets the once-ever flag', async () => {
    const db = makeMandateFakeDb({});
    const r = await simulateEscape(db, { userId: 'u_escape', archetype: 'analyst', replacementArchetype: 'contrarian', now: NOW });
    expect(r.ok).toBe(true);
    const o = r.observations;
    expect(o.oldVoided).toBe(true);
    expect(o.summaryNonScoring).toBe(true);
    expect(o.replacementCapital).toBe(MANDATE_STARTING_CAPITAL);
    expect(o.replacementReset).toBe(true);
    expect(o.replacementArchetype).toBe('contrarian');
    expect(o.replacementNoEscapeWindow).toBe(true);
    expect(o.onceEverFlag).toBe(true);
    expect(o.activePointsAtReplacement).toBe(true);
  });
});

describe('accelerated harness — dispatch', () => {
  it('runScenario dispatches by name and namespaces userIds; unknown scenario is reported', async () => {
    expect(acceleratedScenarios()).toEqual(['full_rollover', 'fr1_violation', 'two_boundary_catchup', 'escape']);
    const db = makeMandateFakeDb({});
    const r = await runScenario(db, { scenario: 'full_rollover', now: NOW });
    expect(r.scenario).toBe('full_rollover');
    expect(r.ok).toBe(true);
    const bad = await runScenario(db, { scenario: 'nope', now: NOW });
    expect(bad).toMatchObject({ ok: false, error: 'unknown_scenario' });
  });
});
