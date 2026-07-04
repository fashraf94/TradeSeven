// scripts/calibration/aggregate-real-battles.test.js
// Knob Calibration B1 — aggregation unit tests over fixture exports.
import { describe, it, expect } from 'vitest';
import {
  aggregateBattles,
  partitionTrades,
  isTruncated,
  median,
  toEpochMs,
  formatTable,
  TRADES_CAP,
} from './aggregate-real-battles.js';
// The import above transitively imports EMERGENCY_BYPASS_REASONS from the FENCED
// agentRiskManager.js. That this test loads and runs in bare Node/vitest IS the
// BUILD_RULES §4 dependency-surface guard — it explodes here if a browser dep
// ever enters the graph. Do NOT mock this import.
import { EMERGENCY_BYPASS_REASONS } from '../../api/_utils/agentRiskManager.js';

const trade = (exitReason, i = 0, extra = {}) => ({
  id: `t${i}`,
  exitReason,
  swappedOutAt: `2026-05-0${(i % 9) + 1}T14:00:00.000Z`,
  ...extra,
});
const battle = (archetype, exitReasons, createdAt = '2026-04-01T13:30:00.000Z', scoreState) => ({
  agentContext: { archetype },
  createdAt,
  trades: exitReasons.map((r, i) => trade(r, i)),
  ...(scoreState ? { scoreState } : {}),
});

describe('median', () => {
  it('odd / even / empty', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe('partitionTrades uses the REAL fenced EMERGENCY_BYPASS_REASONS', () => {
  it('classifies emergency vs non-emergency by the imported set (default-deny on unknown)', () => {
    const anEmergency = [...EMERGENCY_BYPASS_REASONS][0];
    const p = partitionTrades([trade(anEmergency), trade('stagnation'), trade('haiku_decision'), trade(undefined)]);
    expect(p.emergency).toHaveLength(1);
    expect(p.nonEmergency).toHaveLength(3); // stagnation + haiku_decision + unknown
    expect(p.stagnation).toBe(1);
    expect(p.emergencyByReason[anEmergency]).toBe(1);
  });

  it('vwap_failure is emergency (guards against a stale re-listing of the set)', () => {
    expect(EMERGENCY_BYPASS_REASONS.has('vwap_failure')).toBe(true);
    const p = partitionTrades([trade('vwap_failure')]);
    expect(p.emergency).toHaveLength(1);
    expect(p.nonEmergency).toHaveLength(0);
  });
});

describe('isTruncated', () => {
  it('flags the 50-cap and tradeCount>len; clears otherwise', () => {
    expect(isTruncated({ trades: Array.from({ length: TRADES_CAP }, (_, i) => trade('stagnation', i)) })).toBe(true);
    expect(isTruncated({ trades: [trade('stagnation')], scoreState: { tradeCount: 5 } })).toBe(true);
    expect(isTruncated({ trades: [trade('stagnation')], scoreState: { tradeCount: 1 } })).toBe(false);
    expect(isTruncated({ trades: [] })).toBe(false);
  });
});

describe('toEpochMs', () => {
  it('parses ISO strings and serialized Firestore Timestamp shapes', () => {
    expect(toEpochMs('2026-04-01T00:00:00.000Z')).toBe(Date.parse('2026-04-01T00:00:00.000Z'));
    expect(toEpochMs({ _seconds: 1000, _nanoseconds: 0 })).toBe(1_000_000);
    expect(toEpochMs({ seconds: 2000 })).toBe(2_000_000);
    expect(toEpochMs(null)).toBeNull();
    expect(toEpochMs('not-a-date')).toBeNull();
  });
});

describe('aggregateBattles', () => {
  const emergency = [...EMERGENCY_BYPASS_REASONS][0];
  const battles = [
    // degen: two battles, stagnation-heavy → high tempo
    battle('degen', ['stagnation', 'stagnation', 'haiku_decision', emergency]),
    battle('degen', ['stagnation', 'stagnation', 'stagnation']),
    // guardian: one battle, mostly emergency → low tempo
    battle('guardian', [emergency, 'haiku_decision']),
    // a battle with no agentContext.archetype → 'unknown'
    { createdAt: '2026-05-10T13:30:00.000Z', trades: [trade('stagnation')] },
  ];
  const report = aggregateBattles(battles);

  it('keys off agentContext.archetype and buckets missing archetype as unknown', () => {
    expect(Object.keys(report.perArchetype).sort()).toEqual(['degen', 'guardian', 'unknown']);
    expect(report.totalBattles).toBe(4);
  });

  it('computes the Gate 8A tempo metric (median non-emergency rotations/battle)', () => {
    // degen: battle1 nonEmergency=3 (2 stag + 1 haiku), battle2=3 → median 3
    expect(report.perArchetype.degen.nonEmergencyRotationsPerBattle.median).toBe(3);
    // guardian: nonEmergency=1 (haiku only; emergency excluded) → median 1
    expect(report.perArchetype.guardian.nonEmergencyRotationsPerBattle.median).toBe(1);
  });

  it('computes Gate 8B stagnation share (stagnation / all non-emergency, per archetype)', () => {
    // degen: stagnation total=5, nonEmergency total=6 → 83.33%
    expect(report.perArchetype.degen.stagnationSharePct).toBeCloseTo(83.33, 1);
    // guardian: 0 stagnation / 1 non-emergency → 0
    expect(report.perArchetype.guardian.stagnationSharePct).toBe(0);
  });

  it('attributes emergency bypasses by reason', () => {
    expect(report.perArchetype.degen.emergencyBypass.total).toBe(1);
    expect(report.perArchetype.degen.emergencyBypass.byReason[emergency]).toBe(1);
  });

  it('orders tempo descending (descriptive only, not a gate)', () => {
    const order = report.tempoOrdering.map((t) => t.archetype);
    expect(order.indexOf('degen')).toBeLessThan(order.indexOf('guardian'));
  });

  it('surfaces the emergency-reason list from the fenced source (never re-listed)', () => {
    expect(report.emergencyBypassReasons).toEqual([...EMERGENCY_BYPASS_REASONS].sort());
  });

  it('honestly marks the two synthesized metrics as not covered', () => {
    expect(report.notCovered.hurdleFloorRejectionRate).toMatch(/synthesized/i);
    expect(report.notCovered.forcedRotationFireFrequency).toMatch(/synthesized|VETOED/i);
  });

  it('is deterministic — same input yields byte-identical JSON', () => {
    expect(JSON.stringify(aggregateBattles(battles))).toBe(JSON.stringify(aggregateBattles(battles)));
  });
});

describe('censoring (B1 rider — trades[] 50-cap floor values)', () => {
  it('flags censored battles and notes their counts are FLOOR values', () => {
    const censoredBattle = {
      agentContext: { archetype: 'degen' },
      createdAt: '2026-04-02T13:30:00.000Z',
      trades: Array.from({ length: TRADES_CAP }, (_, i) => trade('stagnation', i)),
    };
    const r = aggregateBattles([censoredBattle]);
    expect(r.perArchetype.degen.censoredBattles).toBe(1);
    expect(r.totalCensored).toBe(1);
    expect(r.perArchetype.degen.provenance.censoredNote).toMatch(/FLOOR/);
  });

  it('flags a battle whose scoreState.tradeCount exceeds retained trades', () => {
    const b = {
      agentContext: { archetype: 'analyst' },
      createdAt: '2026-04-03T13:30:00.000Z',
      trades: [trade('stagnation')],
      scoreState: { tradeCount: 12 },
    };
    const r = aggregateBattles([b]);
    expect(r.perArchetype.analyst.censoredBattles).toBe(1);
  });
});

describe('unknown/missing reason share (B1 taxonomy rider)', () => {
  it('counts an unrecognized reason as non-emergency AND flags it unknown (8A inflation)', () => {
    const r = aggregateBattles([battle('degen', ['stagnation', 'legacy_reason_x', undefined])]);
    const m = r.perArchetype.degen;
    // all 3 are non-emergency by default-deny; 2 are unknown (legacy string + missing)
    expect(m.nonEmergencyRotationsPerBattle.median).toBe(3);
    expect(m.unknownReason.trades).toBe(2);
    expect(m.unknownReason.sharePctOfNonEmergency).toBeCloseTo(66.67, 1);
    expect(m.unknownReason.byReason.legacy_reason_x).toBe(1);
    expect(m.unknownReason.byReason['(missing)']).toBe(1);
    expect(r.totalUnknownReasonTrades).toBe(2);
  });

  it('recognized non-emergency reasons are NOT unknown', () => {
    const r = aggregateBattles([battle('analyst', ['stagnation', 'haiku_decision', 'gameplan_rotation'])]);
    expect(r.perArchetype.analyst.unknownReason.trades).toBe(0);
    expect(r.perArchetype.analyst.provenance.taxonomyNote).toBeNull();
  });

  it('emergency reasons are never counted as unknown', () => {
    const emergency = [...EMERGENCY_BYPASS_REASONS][0];
    const r = aggregateBattles([battle('degen', [emergency, emergency])]);
    expect(r.perArchetype.degen.unknownReason.trades).toBe(0);
  });

  it('sets a taxonomyNote when unknown reasons exist', () => {
    const r = aggregateBattles([battle('degen', ['mystery'])]);
    expect(r.perArchetype.degen.provenance.taxonomyNote).toMatch(/unknown\/missing exitReason/);
  });
});

describe('formatTable', () => {
  it('renders a human table and warns on censoring', () => {
    const r = aggregateBattles([
      battle('degen', ['stagnation', 'stagnation']),
      { agentContext: { archetype: 'guardian' }, createdAt: '2026-04-01T13:30:00.000Z', trades: Array.from({ length: TRADES_CAP }, (_, i) => trade('stagnation', i)) },
    ]);
    const table = formatTable(r);
    expect(table).toContain('nonEmergRot(med)=8A');
    expect(table).toContain('degen');
    expect(table).toMatch(/censored .* FLOOR values/);
  });
});
