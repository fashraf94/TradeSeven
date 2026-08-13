// api/_utils/mandateSchema.test.js
import { describe, it, expect } from 'vitest';
import {
  deriveManagerAgentId,
  buildQuarterKey,
  buildNewMandateDoc,
  buildDailyRow,
  buildDecision,
  buildQuarterSummary,
  buildCorporateAction,
  DECISION_STATUSES,
  AGENCY_STATES,
  isValidAgencyState,
  CORPORATE_ACTION_TYPES,
  DECISION_VERBS,
} from './mandateSchema.js';
import { MANDATE_STARTING_CAPITAL, MANDATE_SCHEMA_VERSION } from './mandateConfig.js';

describe('mandateSchema — managerAgentId (FR-7 / D-46.3: stable per user × archetype)', () => {
  it('is deterministic and stable for the same (user, archetype)', () => {
    const a = deriveManagerAgentId('user-1', 'contrarian');
    const b = deriveManagerAgentId('user-1', 'contrarian');
    expect(a).toBe(b); // re-hiring resumes the SAME manager
  });

  it('differs across users and across archetypes', () => {
    expect(deriveManagerAgentId('user-1', 'contrarian')).not.toBe(deriveManagerAgentId('user-2', 'contrarian'));
    expect(deriveManagerAgentId('user-1', 'contrarian')).not.toBe(deriveManagerAgentId('user-1', 'analyst'));
  });

  it('is namespaced away from arena agent ids (mgr_ prefix, D-7) and hides the raw uid', () => {
    const id = deriveManagerAgentId('user-secret', 'degen');
    expect(id.startsWith('mgr_degen_')).toBe(true);
    expect(id.includes('user-secret')).toBe(false);
  });

  it('requires both userId and archetype', () => {
    expect(() => deriveManagerAgentId('', 'contrarian')).toThrow();
    expect(() => deriveManagerAgentId('user-1', '')).toThrow();
  });
});

describe('mandateSchema — buildNewMandateDoc (§2.1: every block present)', () => {
  const now = new Date('2026-08-12T12:00:00Z');
  const doc = buildNewMandateDoc({
    mandateId: 'MID123',
    userId: 'user-1',
    archetype: 'contrarian',
    managerAgentId: 'mgr_contrarian_abc',
    vintageRef: 'archetypeVintages/contrarian_deadbeef',
    cadenceTier: 'standard',
    createdAt: now,
    quarterStartAt: now,
    nextRolloverAt: new Date('2026-11-12T21:00:00Z'),
    escapeHatchEligibleUntil: new Date('2026-08-26T12:00:00Z'),
  });

  it('seeds identity, status, and the revision backbone', () => {
    expect(doc.schemaVersion).toBe(MANDATE_SCHEMA_VERSION);
    expect(doc.status).toBe('active');
    expect(doc.voided).toBe(false);
    expect(doc.revision).toBe(0); // §5.2 — every mutating txn increments this (F1)
    expect(doc.quarterIndex).toBe(1);
    expect(doc.quarterKey).toBe('MID123:1'); // deterministic (F7)
  });

  it('seeds the book at MANDATE_STARTING_CAPITAL with dual-lens HWM/drawdown (F15)', () => {
    expect(doc.portfolio.cash).toBe(MANDATE_STARTING_CAPITAL);
    expect(doc.portfolio.totalValue).toBe(MANDATE_STARTING_CAPITAL);
    expect(doc.portfolio.initialValue).toBe(MANDATE_STARTING_CAPITAL);
    expect(doc.portfolio.positions).toEqual({});
    expect(doc.portfolio.lifetimeHighWaterMark).toBe(MANDATE_STARTING_CAPITAL);
    expect(doc.portfolio.lifetimeDrawdownFromPeak).toBe(0);
    expect(doc.portfolio.quarterHighWaterMark).toBe(MANDATE_STARTING_CAPITAL);
    expect(doc.portfolio.quarterDrawdownFromPeak).toBe(0);
  });

  it('carries the health / execState / costTelemetry / dormancy / scoring blocks present-but-unpopulated', () => {
    // scoring — null until P3 computes it (§4.2 warmup: null, never 0/NaN)
    expect(doc.scoring).toEqual({ quarter: null, lifetime: null, asOf: null });
    // health (§6.4)
    expect(doc.health).toMatchObject({ consecutiveEvalFailures: 0, quarantined: false, missedMarks: 0 });
    expect(doc.health.lastSuccessfulEvalAt).toBeNull();
    // execState (§3.3) — gate + liveness counters present
    expect(doc.execState).toMatchObject({ openBatchId: null, lastCloseKey: null, submitted: 0, executed: 0 });
    // dormancy (§6.5)
    expect(doc.dormancy).toEqual({ lastUserActivityAt: null, downshifted: false });
    // costTelemetry (§6.2)
    expect(doc.costTelemetry).toMatchObject({ tokensIn: 0, tokensOut: 0, estUsd: 0 });
  });

  it('carries the pinned vintageRef, manager, cadence and the lifecycle timestamps', () => {
    expect(doc.vintageRef).toBe('archetypeVintages/contrarian_deadbeef');
    expect(doc.managerAgentId).toBe('mgr_contrarian_abc');
    expect(doc.cadenceTier).toBe('standard');
    expect(doc.createdAt).toBe(now);
    expect(doc.escapeHatchEligibleUntil).toBeInstanceOf(Date);
    expect(doc.nextRolloverAt).toBeInstanceOf(Date);
  });

  it('rejects a doc missing a load-bearing field', () => {
    expect(() => buildNewMandateDoc({ userId: 'u', archetype: 'contrarian' })).toThrow();
  });
});

describe('mandateSchema — quarterKey + enums (contracts later phases bind to)', () => {
  it('quarterKey is `${mandateId}:${quarterIndex}` (§2.1 / F7)', () => {
    expect(buildQuarterKey('ABC', 3)).toBe('ABC:3');
  });

  it('the six terminal decision states (I1)', () => {
    expect([...DECISION_STATUSES]).toEqual(['executed', 'rejected_stale', 'gated', 'failed', 'cancelled', 'expired']);
  });

  it('agency states incl. the skipped:<reason> family (I10)', () => {
    expect(AGENCY_STATES).toContain('exit_only');
    expect(isValidAgencyState('full')).toBe(true);
    expect(isValidAgencyState('exit_only')).toBe(true);
    expect(isValidAgencyState('skipped:data')).toBe(true);
    expect(isValidAgencyState('nonsense')).toBe(false);
  });

  it('corporate-action V1 scope (FR-4) and the decision verb set (§3.4)', () => {
    expect(CORPORATE_ACTION_TYPES).toContain('split');
    expect(CORPORATE_ACTION_TYPES).toContain('delisting');
    expect([...DECISION_VERBS]).toEqual(['BUY', 'SELL', 'TRIM', 'ADD', 'HOLD']);
  });
});

describe('mandateSchema — subcollection shape definitions (§2.2; Phase 1 defines, P2–4 write)', () => {
  it('dailyRow carries schemaVersion, quarterIndex, agencyState slot and partial flag (I17)', () => {
    const row = buildDailyRow({ date: '2026-08-12', quarterIndex: 1 });
    expect(row.schemaVersion).toBe(MANDATE_SCHEMA_VERSION);
    expect(row.date).toBe('2026-08-12');
    expect(row.quarterIndex).toBe(1);
    expect('agencyState' in row).toBe(true);
    expect(row.partial).toBe(false);
    expect(row.regime).toBe('unknown'); // §6.1 — never a silently stale label
  });

  it('decision has priceBasis harvest_tick (I3) and influenceStateRef PROVABLY null (FR-7 / I8)', () => {
    const d = buildDecision({ decisionId: 'd1', verb: 'BUY', ticker: 'AAPL' });
    expect(d.priceBasis).toBe('harvest_tick');
    expect(d.influenceStateRef).toBeNull();
    expect('submitTickKey' in d && 'harvestTickKey' in d).toBe(true); // I3 dual keys
    expect(d.schemaVersion).toBe(MANDATE_SCHEMA_VERSION);
  });

  it('quarterSummary is scoring:true by default and false-able for voided quarters (FR-3)', () => {
    expect(buildQuarterSummary({ quarterIndex: 1 }).scoring).toBe(true);
    expect(buildQuarterSummary({ quarterIndex: 1, scoring: false }).scoring).toBe(false);
    expect(buildQuarterSummary({ quarterIndex: 2, empty: true }).empty).toBe(true); // §5.3 catch-up
  });

  it('corporateAction carries schemaVersion + type slot (§4.3)', () => {
    const ca = buildCorporateAction({ actionId: 'a1', type: 'split', ticker: 'TSLA', ratio: 2 });
    expect(ca.schemaVersion).toBe(MANDATE_SCHEMA_VERSION);
    expect(ca.type).toBe('split');
    expect(ca.ratio).toBe(2);
  });
});

// ── P3 verification-pass regression guards: sweep keys must be SEEDED ────────
// (an orderBy silently DROPS docs missing its field — a book created without
// these keys would vanish from the sweeps; INV-4/INV-1 fix depends on them)
describe('sweep ordering keys are seeded on every new book', () => {
  it('health seeds lastEvalSweepAt/lastCloseAttemptAt/consecutiveCloseFailures; execState seeds lastSweepTickKey', async () => {
    const { buildHealthBlock, buildExecStateBlock } = await import('./mandateSchema.js');
    const h = buildHealthBlock();
    expect(h).toMatchObject({
      lastEvalSweepAt: null, lastCloseAttemptAt: null, consecutiveCloseFailures: 0,
      lastSuccessfulEvalAt: null, lastCloseMarkAt: null,
    });
    expect(buildExecStateBlock()).toMatchObject({ lastSweepTickKey: null });
  });
});
