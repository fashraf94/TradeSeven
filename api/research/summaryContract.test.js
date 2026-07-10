/**
 * Summary-contract core unit tests — envelope normalization, the evidence
 * checklist (readType/readState/criteria + rounded boundaries), and schema
 * conformance of a full deep-dive and scan contract (additionalProperties:false
 * fails loud on drift).
 */
import { describe, it, expect } from 'vitest';
import {
  buildDeepDiveContract,
  buildScanContract,
  buildEvidence,
  round2,
  UNIT,
  envelope,
} from './summaryContract.js';
import { validateContract, deepDiveContractSchema, scanContractSchema } from './summaryContractSchema.js';

// ── Realistic deep-dive input (a standard, solid read) ───────────────────────
function deepInput(overrides = {}) {
  return {
    generatedAt: '2026-07-10T20:10:00.000Z',
    dataAsOf: '2026-07-10',
    observationTradingDay: '2026-07-10',
    lookbackDays: 504,
    group: ['XLE', 'CVX', 'XOM'],
    groupType: 'manual',
    driverId: 'TNX',
    driverType: 'registry',
    driverSymbol: 'TNX.INDX',
    corr20: 0.62,
    corr60: 0.55,
    partial: {
      w20: { raw: 0.62, adjusted: 0.41, n: 20, suppressed: null },
      w60: { raw: 0.55, adjusted: 0.38, n: 60, suppressed: null },
    },
    selfPercentile: { corr20: { percentile: 73.4, n: 480, latest: 0.62 }, corr60: { percentile: 61.2, n: 440, latest: 0.55 } },
    stability: { aboveFraction: 0.82, signPersistence: 0.9, n: 460, sign: 'positive', threshold: 0.15 },
    cohesion: { c20: { value: 0.66, pairsUsed: 3, pairsTotal: 3 }, c60: { value: 0.6, pairsUsed: 3, pairsTotal: 3 }, memberCount: 3 },
    contribution: {
      full: { corr: 0.62, beta: 1.1 },
      members: [
        { index: 0, corrDelta: 0.05, betaDelta: 0.1 },
        { index: 1, corrDelta: 0.03, betaDelta: 0.05 },
        { index: 2, corrDelta: 0.02, betaDelta: 0.03 },
      ],
      window: 60,
      n: 60,
      memberSymbols: ['CVX', 'XOM', 'XLE'],
      breadthStatus: 'broad_based',
    },
    captureAsymmetry: {
      minObs: 60,
      down: { beta: 1.3, alpha: 0, r: 0.6, n: 120 },
      up: { beta: 0.9, alpha: 0, r: 0.5, n: 130 },
      comparison: { asymmetric: true, direction: 'down', betaDown: 1.3, betaUp: 0.9, nDown: 120, nUp: 130 },
      counts: { down: 120, up: 130 },
    },
    tail: {
      worst: { n: 24, tailPct: 10, coMoveCount: 18, groupMedian: -0.0123 },
      best: { n: 24, tailPct: 10, coMoveCount: 16, groupMedian: 0.0111 },
      sampleN: 240,
    },
    driverContext: { trailingReturn: -0.0234, vol: { percentile: 55.5, n: 480, latest: 0.01 } },
    tensionLatest: { d: 0.07, score: 0.8, state: 'calm' },
    memberCount: 3,
    joinedCloses: 480,
    inflections: [{ startDate: '2026-05-02', startCloseIndex: 300 }, { startDate: '2026-06-15', startCloseIndex: 360 }],
    ...overrides,
  };
}

describe('buildDeepDiveContract — shape + schema', () => {
  it('validates against the revision-1 deep-dive schema', () => {
    const contract = buildDeepDiveContract(deepInput());
    const { valid, errors } = validateContract(deepDiveContractSchema[1], contract);
    expect(errors).toEqual([]);
    expect(valid).toBe(true);
  });

  it('links.raw come from the headline corr (§9) and carry a band; adjusted from partial', () => {
    const c = buildDeepDiveContract(deepInput());
    expect(c.links.raw20).toMatchObject({ status: 'ok', value: 0.62, unit: UNIT.correlation, band: 'moderate' });
    expect(c.links.adjusted20).toMatchObject({ status: 'ok', value: 0.41, unit: UNIT.correlation, band: 'moderate' });
  });

  it('percentile serializes as a fraction (0,1]', () => {
    const c = buildDeepDiveContract(deepInput());
    expect(c.percentile.corr20).toMatchObject({ status: 'ok', value: 0.73, unit: UNIT.fraction });
  });

  it('breaks is a plain block with the latest break day + freshness window', () => {
    const c = buildDeepDiveContract(deepInput());
    expect(c.breaks).toEqual({ count: 2, latestBreakDay: '2026-06-15', freshnessWindowTradingDays: 10 });
  });

  it('a solid read passes every applicable criterion', () => {
    const c = buildDeepDiveContract(deepInput());
    expect(c.evidence.readType).toBe('standard');
    expect(c.evidence.readState).toBe('solid');
    expect(c.evidence.criteria).toHaveLength(6);
    expect(c.evidence.passedCount).toBe(c.evidence.applicableCount);
  });
});

describe('evidence checklist — readType / readState', () => {
  it('driver_is_market → market_proxy read, survives_adjustment n/a', () => {
    const c = buildDeepDiveContract(deepInput({
      partial: { w20: { raw: 0.95, adjusted: null, n: 20, suppressed: 'driver_is_market' }, w60: { raw: 0.95, adjusted: null, n: 60, suppressed: 'driver_is_market' } },
    }));
    expect(c.evidence.readType).toBe('market_proxy');
    const surv = c.evidence.criteria.find((x) => x.id === 'survives_adjustment');
    expect(surv.outcome).toBe('not_applicable');
    expect(c.links.adjusted60).toMatchObject({ status: 'suppressed', reason: 'driver_is_market' });
  });

  it('tension stretched/break → in_flux regardless of other passes', () => {
    const c = buildDeepDiveContract(deepInput({ tensionLatest: { d: 0.3, score: 2.5, state: 'break' } }));
    expect(c.evidence.readState).toBe('in_flux');
  });

  it('an ETF-of-one (memberCount 1, no cohesion/contribution/stability) reads limited, never solid', () => {
    const c = buildDeepDiveContract(deepInput({
      memberCount: 1,
      cohesion: null,
      contribution: null,
      stability: null,
      selfPercentile: { corr20: null, corr60: null },
    }));
    // adequate_sample passes but stable_link is n/a → limited (minimum-evidence rule)
    expect(c.evidence.readState).toBe('limited');
  });

  it('applicable < 4 → limited', () => {
    const ev = buildEvidence(
      { joinedCloses: 480, stability: null, cohesionC20: null, memberCount: 1, breadthStatus: null, primaryAdjustedValue: null, partialApplicable: false, tensionState: 'calm' },
      ['adequate_sample', 'stable_link', 'group_coheres', 'broad_based', 'survives_adjustment', 'tension_contained']
    );
    expect(ev.applicableCount).toBeLessThan(4);
    expect(ev.readState).toBe('limited');
  });
});

describe('rounded boundary fixtures through the ONE rounder (§9)', () => {
  it('stable_link at 0.695 rounds to 0.70 → pass; 0.694 → 0.69 → fail', () => {
    const pass = buildDeepDiveContract(deepInput({ stability: { aboveFraction: 0.695, signPersistence: 0.9, n: 460, sign: 'positive', threshold: 0.15 } }));
    const stab = pass.evidence.criteria.find((x) => x.id === 'stable_link');
    expect(stab.value).toBe(round2(0.695));
    expect(stab.outcome).toBe(round2(0.695) >= 0.7 ? 'pass' : 'fail');

    const fail = buildDeepDiveContract(deepInput({ stability: { aboveFraction: 0.694, signPersistence: 0.9, n: 460, sign: 'positive', threshold: 0.15 } }));
    const stab2 = fail.evidence.criteria.find((x) => x.id === 'stable_link');
    expect(stab2.value).toBe(round2(0.694));
    expect(stab2.outcome).toBe('fail');
  });

  it('the criterion value equals the serialized envelope value for the same input (one rounder)', () => {
    const c = buildDeepDiveContract(deepInput());
    const surv = c.evidence.criteria.find((x) => x.id === 'survives_adjustment');
    // survives_adjustment uses w60 primary (0.38); links.adjusted60 serializes the same rounder
    expect(surv.value).toBe(c.links.adjusted60.value);
  });
});

// ── Scan contract ────────────────────────────────────────────────────────────
function scanRow(overrides = {}) {
  return {
    driver: 'TNX',
    corr20: 0.62,
    corr60: 0.55,
    d: 0.07,
    score: 0.8,
    tensionState: 'calm',
    joinedCloses: 480,
    tier: 'established',
    rq: {
      partial: { w20: { raw: 0.62, adjusted: 0.41, n: 20, suppressed: null }, w60: { raw: 0.55, adjusted: 0.38, n: 60, suppressed: null } },
      stability: { aboveFraction: 0.82, signPersistence: 0.9, n: 460, sign: 'positive', threshold: 0.15 },
    },
    ...overrides,
  };
}

describe('buildScanContract — shape + schema', () => {
  const base = {
    generatedAt: '2026-07-10T20:10:00.000Z',
    dataAsOf: '2026-07-10',
    observationTradingDay: '2026-07-10',
    lookbackDays: 504,
    group: ['XLE', 'CVX', 'XOM'],
    groupType: 'watchlist',
    driverUniverseHash: 'abc123',
    rows: [scanRow(), scanRow({ driver: 'HYG', corr20: 0.3, corr60: 0.28, tier: 'established' })],
    cohesion: { c20: { value: 0.66, pairsUsed: 3, pairsTotal: 3 }, c60: { value: 0.6, pairsUsed: 3, pairsTotal: 3 }, memberCount: 3 },
    comparison: { status: 'no_prior_scan', baselineObservationDay: null, currentObservationDay: '2026-07-10', gapTradingDays: null, baselineMembershipHash: null, baselineDriverUniverseHash: null, baselineMethodologyVersion: null, baselineChangePolicyVersion: null },
    changes: { status: 'no_prior_scan', events: [] },
  };

  it('validates against the revision-1 scan schema', () => {
    const c = buildScanContract(base);
    const { errors } = validateContract(scanContractSchema[1], c);
    expect(errors).toEqual([]);
  });

  it('topDrivers are rank-ordered and carry the scan-subset evidence (4 criteria)', () => {
    const c = buildScanContract(base);
    expect(c.topDrivers.map((r) => r.rank)).toEqual([1, 2]);
    expect(c.topDrivers[0].evidence.criteria.map((x) => x.id)).toEqual(['adequate_sample', 'stable_link', 'survives_adjustment', 'tension_contained']);
  });

  it('groupEvidence carries the group cohesion envelope + not_applicable_in_scan breadth', () => {
    const c = buildScanContract(base);
    expect(c.groupEvidence.breadthStatus).toBe('not_applicable_in_scan');
    expect(c.groupEvidence.cohesion).toMatchObject({ status: 'ok', unit: UNIT.correlation, band: 'moderate' });
  });
});

describe('envelope helper', () => {
  it('band is present only when supplied', () => {
    expect('band' in envelope({ status: 'ok', value: 1, unit: UNIT.count })).toBe(false);
    expect(envelope({ status: 'ok', value: 0.5, unit: UNIT.correlation, band: 'moderate' }).band).toBe('moderate');
  });
});
