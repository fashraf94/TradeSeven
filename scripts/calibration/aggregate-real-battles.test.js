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
  // Release 1 (Tuned Knob Values Landing V1.1) additions
  opponentGroup,
  tempoDivergence,
  capPinningForBattle,
  generationIndex,
  bucketByGeneration,
  aggregateWithGenerations,
  formatGenerationReport,
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

  it('Ask 3 (R3 mirror): guardrail_profitTarget lands in its OWN userDirective lane — never emergency, never unknown-inflating non-emergency', () => {
    const p = partitionTrades([trade('guardrail_profitTarget'), trade('haiku_decision')]);
    expect(p.userDirective).toHaveLength(1);
    expect(p.userDirectiveByReason.guardrail_profitTarget).toBe(1);
    expect(p.emergency).toHaveLength(0);
    expect(p.nonEmergency).toHaveLength(1); // only the haiku_decision row
    expect(p.unknown).toBe(0);
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

  it('renders the cap-pin column and the opponent-divergence footnote', () => {
    const table = formatTable(aggregateBattles([battle('degen', ['stagnation'])]));
    expect(table).toContain('capPin%@cap');
    expect(table).toMatch(/opponent tempo divergence/i);
  });
});

// ==================== Release 1 — Tuned Knob Values Landing V1.1 ====================

// Build a swap trade `mins` minutes after `baseIso` (real Date math — vitest, not a
// workflow script, so Date arithmetic is available).
const at = (baseIso, mins) => new Date(Date.parse(baseIso) + mins * 60000).toISOString();
const swap = (id, exitReason, iso) => ({ id, exitReason, swappedOutAt: iso });

describe('capPinningForBattle — swap-cap pinning against the deployed cap (§4.1)', () => {
  const BASE = '2026-07-08T14:00:00.000Z';

  it('flags every rolling window that reaches capPerWindow (analyst cap=4, 60min)', () => {
    // 6 stagnation swaps at 10-min gaps — all inside one 60-min window.
    const trades = Array.from({ length: 6 }, (_, i) => swap(`s${i}`, 'stagnation', at(BASE, i * 10)));
    const cp = capPinningForBattle({ agentContext: { archetype: 'analyst' }, trades });
    expect(cp.capPerWindow).toBe(4);      // analyst's deployed cap (unchanged by Release 1)
    expect(cp.windowMinutes).toBe(60);
    expect(cp.windows).toBe(6);           // one rolling window anchored per cap-subject swap
    // windows for the 4th/5th/6th swap reach 4/5/6 in-window swaps → pinned (>=4).
    expect(cp.pinnedWindows).toBe(3);
  });

  it('does not anchor on or count emergency swaps (countEmergencies=false)', () => {
    const emergency = [...EMERGENCY_BYPASS_REASONS][0];
    const trades = [
      swap('e0', emergency, at(BASE, 0)),
      swap('e1', emergency, at(BASE, 5)),
      swap('s0', 'stagnation', at(BASE, 10)),
    ];
    const cp = capPinningForBattle({ agentContext: { archetype: 'analyst' }, trades });
    expect(cp.windows).toBe(1);           // only the single non-emergency swap anchors a window
    expect(cp.pinnedWindows).toBe(0);     // 1 cap-subject swap in window < cap 4
  });

  it('reflects the deployed momentum_chaser cap of 6 (Release 1 tuned value)', () => {
    const trades = Array.from({ length: 6 }, (_, i) => swap(`s${i}`, 'stagnation', at(BASE, i * 5)));
    const cp = capPinningForBattle({ agentContext: { archetype: 'momentum_chaser' }, trades });
    expect(cp.capPerWindow).toBe(6);      // tuned 8 → 6
    expect(cp.pinnedWindows).toBe(1);     // only the 6th swap's window reaches 6
  });

  it('surfaces per-archetype swapCapPinning in the aggregate report', () => {
    const trades = Array.from({ length: 6 }, (_, i) => swap(`s${i}`, 'stagnation', at(BASE, i * 10)));
    const r = aggregateBattles([{ agentContext: { archetype: 'analyst' }, createdAt: BASE, trades }]);
    const cp = r.perArchetype.analyst.swapCapPinning;
    expect(cp.capPerWindow).toBe(4);
    expect(cp.pinnedSharePct).toBe(50);   // 3 pinned / 6 windows
  });
});

describe('opponentGroup + tempoDivergence — cpu-opponent vs player-opponent (Decision 2)', () => {
  it('classifies by isCpu, never by "training"', () => {
    expect(opponentGroup({ isCpu: true })).toBe('cpu-opponent');
    expect(opponentGroup({ isCpu: false })).toBe('player-opponent');
    expect(opponentGroup({})).toBe('player-opponent');   // absent → player
  });

  it('flags material divergence and clears when the two groups agree', () => {
    expect(tempoDivergence(1, 5).divergent).toBe(true);   // ratio 5 ≥ 1.5
    expect(tempoDivergence(2, 2).divergent).toBe(false);  // equal
    expect(tempoDivergence(0, 2).divergent).toBe(true);   // one group 0, abs gap 2
    expect(tempoDivergence(0, 1).divergent).toBe(false);  // abs gap 1 < 2
    expect(tempoDivergence(3, null).divergent).toBe(false); // insufficient data
    expect(tempoDivergence(3, null).reason).toBe('insufficient-data');
  });

  it('splits the archetype into both opponent groups AND counts both in the aggregate', () => {
    const cpuBattle = { agentContext: { archetype: 'degen' }, createdAt: '2026-07-08T14:00:00.000Z', isCpu: true, trades: [trade('stagnation', 0)] };
    const playerBattle = { agentContext: { archetype: 'degen' }, createdAt: '2026-07-08T14:00:00.000Z', trades: ['stagnation', 'stagnation', 'stagnation', 'stagnation', 'stagnation'].map((r, i) => trade(r, i)) };
    const r = aggregateBattles([cpuBattle, playerBattle]);
    const m = r.perArchetype.degen;
    // aggregate median of [1, 5] = 3 — BOTH groups feed the decision metric
    expect(m.nonEmergencyRotationsPerBattle.median).toBe(3);
    expect(m.opponentBreakdown['cpu-opponent'].battles).toBe(1);
    expect(m.opponentBreakdown['cpu-opponent'].nonEmergencyRotationsPerBattle.median).toBe(1);
    expect(m.opponentBreakdown['player-opponent'].battles).toBe(1);
    expect(m.opponentBreakdown['player-opponent'].nonEmergencyRotationsPerBattle.median).toBe(5);
    expect(m.opponentBreakdown.tempoDivergence.divergent).toBe(true);
  });
});

describe('generation bucketing + wholly-contained filter (§5)', () => {
  const B = '2026-07-08T20:05:00.000Z'; // one boundary (an after-close merge)
  const boundaryMs = [Date.parse(B)];

  it('generationIndex places timestamps into half-open intervals', () => {
    expect(generationIndex(Date.parse('2026-07-08T15:00:00Z'), boundaryMs)).toBe(0); // before boundary
    expect(generationIndex(Date.parse('2026-07-09T15:00:00Z'), boundaryMs)).toBe(1); // after boundary
    expect(generationIndex(boundaryMs[0], boundaryMs)).toBe(1);                       // ON boundary → next gen
  });

  const contained0 = { agentContext: { archetype: 'degen' }, createdAt: '2026-07-08T14:00:00Z', completedAt: '2026-07-08T20:00:00Z', trades: [trade('stagnation', 0)] };
  const contained1 = { agentContext: { archetype: 'degen' }, createdAt: '2026-07-09T14:00:00Z', completedAt: '2026-07-09T20:00:00Z', trades: [trade('stagnation', 0), trade('stagnation', 1)] };
  const straddler = { agentContext: { archetype: 'degen' }, createdAt: '2026-07-08T14:00:00Z', completedAt: '2026-07-09T20:00:00Z', trades: [trade('stagnation', 0)] };
  const inflight = { agentContext: { archetype: 'degen' }, createdAt: '2026-07-08T14:00:00Z', completedAt: null, trades: [] };

  it('buckets wholly-contained battles and excludes straddlers / in-flight', () => {
    const { buckets, straddling } = bucketByGeneration([contained0, contained1, straddler, inflight], [B]);
    expect(buckets[0]).toEqual([contained0]);
    expect(buckets[1]).toEqual([contained1]);
    expect(straddling).toEqual([straddler, inflight]);
  });

  it('rejects an unparseable boundary rather than silently mis-bucketing', () => {
    expect(() => bucketByGeneration([contained0], ['not-a-date'])).toThrow(/generation-boundary/);
  });

  it('aggregateWithGenerations reports one contained comparison per generation + straddler tally', () => {
    const gen = aggregateWithGenerations([contained0, contained1, straddler, inflight], [B]);
    expect(gen.mode).toBe('generation-bucketed');
    expect(gen.generations).toHaveLength(2);
    expect(gen.generations[0].containedBattles).toBe(1);
    expect(gen.generations[1].containedBattles).toBe(1);
    // per-generation reports are full aggregate reports over only contained battles
    expect(gen.generations[1].report.perArchetype.degen.nonEmergencyRotationsPerBattle.median).toBe(2);
    // straddlers excluded from BOTH generations, tallied separately
    expect(gen.straddling.battles).toBe(2);
    expect(gen.straddling.byArchetype.degen).toBe(2);
    expect(gen.straddling.note).toMatch(/EXCLUDED|straddle/);
  });

  it('formatGenerationReport frames each generation and calls out exclusions', () => {
    const gen = aggregateWithGenerations([contained0, straddler], [B]);
    const out = formatGenerationReport(gen);
    expect(out).toContain('generation 0');
    expect(out).toMatch(/EXCLUDED/);
  });

  it('is deterministic — same input yields byte-identical JSON', () => {
    const input = [contained0, contained1, straddler];
    expect(JSON.stringify(aggregateWithGenerations(input, [B]))).toBe(JSON.stringify(aggregateWithGenerations(input, [B])));
  });
});
