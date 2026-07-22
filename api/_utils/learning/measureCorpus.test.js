// api/_utils/learning/measureCorpus.test.js
import { describe, it, expect } from 'vitest';
import {
  measureCorpus,
  quantile,
  mean,
  sampleStd,
  standardizedMeanDiff,
  thirdRuleClass,
  toMillis,
  distribution,
  DEFAULT_W_GRID_MINUTES,
} from './measureCorpus.js';

const MIN = 60_000;

// A fully-keyed synthetic receipt; override the parts a test cares about.
function receipt(over = {}) {
  return {
    evidenceClass: over.evidenceClass ?? 'live_agent',
    agentId: over.agentId ?? 'agent-1',
    battleId: over.battleId ?? 'battle-1',
    battleDay: over.battleDay ?? 1,
    timestamp: 'timestamp' in over ? over.timestamp : null,
    receiptSeq: 'receiptSeq' in over ? over.receiptSeq : null,
    exitReason: over.exitReason ?? 'haiku_decision',
    entryAtrSource: 'entryAtrSource' in over ? over.entryAtrSource : null,
    archetype: 'archetype' in over ? over.archetype : null,
    versions: {
      archetypeIntegrityMode: null, detectorVersion: null, evaluationSpecVersion: null,
      calibrationManifestVersion: null, leanRenderConfigVersion: null, ruleLibraryVersion: null,
      archetypeVersion: null, regimeClassifierVersion: null, ...(over.versions || {}),
    },
    swapContext: {
      tradeCountAtDecision: null, tradesLenAtDecision: null, ...(over.swapContext || {}),
    },
    predicateClassification: {
      symbolIn: {
        role: 'entry', d1ClassAsSpecced: null, d1ClassDrAbstain: null, drNullReason: 'present',
        predicateStalenessMs: null, symbolHourKey: null, entrySnapshotSource: null, techDocUpdatedAtMs: null,
        ...(over.pcIn || {}),
      },
      symbolOut: { role: 'exit_context', ...(over.pcOut || {}) },
    },
    predicateInputs: {
      symbolIn: {
        bbPercentB: null, distanceToResistancePct: 2.0, distTo52wkHigh: null, volumeRatio: null,
        upDayVolRatio: null, macdAboveSignal: null, macdFreshBullishCross: null, regime: null,
        nearestResistance: null, nearestSupport: null, distanceToSupportPct: null, dataMode: null,
        ...(over.piIn || {}),
      },
      symbolOut: {
        bbPercentB: null, distanceToResistancePct: null, distTo52wkHigh: null, volumeRatio: null,
        upDayVolRatio: null, macdAboveSignal: null, regime: null, nearestSupport: null, dataMode: null,
        ...(over.piOut || {}),
      },
    },
  };
}

describe('measureCorpus — pure helpers', () => {
  it('quantile interpolates and handles edges', () => {
    expect(quantile([1, 2, 3, 4, 5], 0.5)).toBe(3);
    expect(quantile([1, 3], 0.5)).toBe(2);
    expect(quantile([10], 0.9)).toBe(10);
    expect(quantile([], 0.5)).toBeNull();
  });
  it('mean / sampleStd / SMD', () => {
    expect(mean([2, 4, 6])).toBe(4);
    expect(sampleStd([1])).toBeNull();
    expect(standardizedMeanDiff([0, 1e5, 2e5], [3e5, 4e5, 5e5])).toBeCloseTo(-3, 10);
    expect(standardizedMeanDiff([1], [1, 2, 3])).toBeNull();
  });
  it('toMillis parses ISO / number / null', () => {
    expect(toMillis('2026-07-12T14:30:00.000Z')).toBe(Date.parse('2026-07-12T14:30:00.000Z'));
    expect(toMillis(1234)).toBe(1234);
    expect(toMillis(null)).toBeNull();
    expect(toMillis('nope')).toBeNull();
  });
  it('thirdRuleClass: UNSCORABLE on ambiguous, else the abstain label', () => {
    expect(thirdRuleClass({ drNullReason: 'ambiguous', d1ClassDrAbstain: 'ROOM' })).toBe('UNSCORABLE');
    expect(thirdRuleClass({ drNullReason: 'blue_sky', d1ClassDrAbstain: 'EXTENDED' })).toBe('EXTENDED');
    expect(thirdRuleClass({ drNullReason: 'present', d1ClassDrAbstain: 'ROOM' })).toBe('ROOM');
  });
  it('distribution buckets null under "null"', () => {
    expect(distribution([{ x: 'a' }, { x: 'a' }, { x: null }], (o) => o.x)).toEqual({ a: 2, null: 1 });
  });
});

describe('measureCorpus — evidence partition + entry legs', () => {
  it('excludes non-live_agent and counts by class; entry legs = role==="entry"', () => {
    const r = measureCorpus([
      receipt({}),
      receipt({ evidenceClass: 'cpu' }),
      receipt({ evidenceClass: 'training' }),
      receipt({ evidenceClass: 'unknown' }),
      receipt({}), // live but role anomaly below
      { ...receipt({}), predicateClassification: { symbolIn: { role: 'exit_context' }, symbolOut: {} } },
    ]);
    expect(r.meta.totalReceipts).toBe(6);
    expect(r.meta.liveAgentReceipts).toBe(3); // two role='entry' + one role anomaly are all live_agent
    expect(r.meta.excludedByClass).toEqual({ cpu: 1, training: 1, unknown: 1 });
    expect(r.meta.entryLegs).toBe(2);
    expect(r.meta.roleAnomalies).toBe(1);
  });
  it('empty corpus does not throw and yields zero Ns', () => {
    const r = measureCorpus([]);
    expect(r.meta.totalReceipts).toBe(0);
    expect(r.m1.n).toBe(0);
    expect(r.m8.perW.every((w) => w.opportunities === 0)).toBe(true);
  });
});

describe('M1 — three D1 rules side by side', () => {
  const rs = [
    receipt({ pcIn: { d1ClassAsSpecced: 'UNSCORABLE', d1ClassDrAbstain: 'EXTENDED', drNullReason: 'blue_sky' } }),
    receipt({ pcIn: { d1ClassAsSpecced: 'UNSCORABLE', d1ClassDrAbstain: 'ROOM', drNullReason: 'ambiguous' } }),
    receipt({ pcIn: { d1ClassAsSpecced: 'EXTENDED', d1ClassDrAbstain: 'EXTENDED', drNullReason: 'present' } }),
    receipt({ pcIn: { d1ClassAsSpecced: 'ROOM', d1ClassDrAbstain: 'ROOM', drNullReason: 'present' } }),
  ];
  const m1 = measureCorpus(rs).m1;
  it('as-specced column counts', () => {
    expect(m1.asSpecced.counts).toEqual({ EXTENDED: 1, ROOM: 1, INDETERMINATE: 0, UNSCORABLE: 2 });
    expect(m1.asSpecced.clearsGates).toBe(false); // UNSCORABLE 0.5 > 0.15
  });
  it('dR-abstain column counts + clears gates', () => {
    expect(m1.drAbstain.counts).toEqual({ EXTENDED: 2, ROOM: 2, INDETERMINATE: 0, UNSCORABLE: 0 });
    expect(m1.drAbstain.clearsGates).toBe(true);
  });
  it('abstain-only-on-blue-sky column: ambiguous→UNSCORABLE, else abstain label', () => {
    expect(m1.abstainBlueSkyOnly.counts).toEqual({ EXTENDED: 2, ROOM: 1, INDETERMINATE: 0, UNSCORABLE: 1 });
  });
});

describe('M2 — dR null decomposition', () => {
  const rs = [
    receipt({ piIn: { distanceToResistancePct: null }, pcIn: { drNullReason: 'blue_sky' } }),
    receipt({ piIn: { distanceToResistancePct: null }, pcIn: { drNullReason: 'blue_sky' } }),
    receipt({ piIn: { distanceToResistancePct: null }, pcIn: { drNullReason: 'blue_sky' } }),
    receipt({ piIn: { distanceToResistancePct: null }, pcIn: { drNullReason: 'ambiguous' } }),
    receipt({ piIn: { distanceToResistancePct: null }, pcIn: { drNullReason: 'ambiguous' } }),
    receipt({ piIn: { distanceToResistancePct: 2.0 }, pcIn: { drNullReason: 'present' } }),
  ];
  const m2 = measureCorpus(rs).m2;
  it('splits blue_sky vs ambiguous among nulls', () => {
    expect(m2.n).toBe(5);
    expect(m2.byReason).toEqual({ blue_sky: 3, ambiguous: 2 });
    expect(m2.blueSkyShare).toBeCloseTo(0.6, 10);
    expect(m2.ambiguousShare).toBeCloseTo(0.4, 10);
    expect(m2.drNullShareOfEntries).toBeCloseTo(5 / 6, 10);
    expect(m2.presentAmongNulls).toBe(0);
  });
});

describe('M3 — asymmetric evidence (EXTENDED rate by group)', () => {
  const rs = [
    // blue_sky: 2 entries, 1 EXTENDED → 0.5
    receipt({ pcIn: { drNullReason: 'blue_sky', d1ClassDrAbstain: 'EXTENDED' } }),
    receipt({ pcIn: { drNullReason: 'blue_sky', d1ClassDrAbstain: 'ROOM' } }),
    // present: 4 entries, 1 EXTENDED → 0.25
    receipt({ pcIn: { drNullReason: 'present', d1ClassDrAbstain: 'EXTENDED' } }),
    receipt({ pcIn: { drNullReason: 'present', d1ClassDrAbstain: 'ROOM' } }),
    receipt({ pcIn: { drNullReason: 'present', d1ClassDrAbstain: 'INDETERMINATE' } }),
    receipt({ pcIn: { drNullReason: 'present', d1ClassDrAbstain: 'ROOM' } }),
  ];
  const m3 = measureCorpus(rs).m3;
  it('reports EXTENDED rate per group', () => {
    expect(m3.blueSky).toEqual({ n: 2, extended: 1, extendedRate: 0.5 });
    expect(m3.present).toEqual({ n: 4, extended: 1, extendedRate: 0.25 });
  });
});

describe('M4 — staleness distribution', () => {
  const vals = [-1000, 5 * MIN, 20 * MIN, 40 * MIN, 50 * MIN];
  const rs = [
    ...vals.map((v) => receipt({ pcIn: { predicateStalenessMs: v } })),
    receipt({ pcIn: { predicateStalenessMs: null } }),
  ];
  const m4 = measureCorpus(rs).m4;
  it('median/p90/max, negatives, and horizon exceedance', () => {
    expect(m4.n).toBe(5);
    expect(m4.medianMs).toBe(20 * MIN);
    expect(m4.maxMs).toBe(50 * MIN);
    expect(m4.minMs).toBe(-1000);
    expect(m4.negativeCount).toBe(1);
    expect(m4.negativeShare).toBeCloseTo(0.2, 10);
    expect(m4.exceedShare['15min']).toBeCloseTo(0.6, 10); // >15m: 20,40,50
    expect(m4.exceedShare['30min']).toBeCloseTo(0.4, 10); // >30m: 40,50
    expect(m4.exceedShare['45min']).toBeCloseTo(0.2, 10); // >45m: 50
    expect(m4.nullStalenessShare).toBeCloseTo(1 / 6, 10);
  });
});

describe('M5 — staleness × class + SMD', () => {
  const rs = [
    ...[0, 1e5, 2e5].map((v) => receipt({ pcIn: { d1ClassAsSpecced: 'EXTENDED', predicateStalenessMs: v } })),
    ...[3e5, 4e5, 5e5].map((v) => receipt({ pcIn: { d1ClassAsSpecced: 'ROOM', predicateStalenessMs: v } })),
  ];
  const m5 = measureCorpus(rs).m5;
  it('per-class medians and pooled SMD, with reliability flag', () => {
    expect(m5.perClass.EXTENDED.medianMs).toBe(1e5);
    expect(m5.perClass.ROOM.medianMs).toBe(4e5);
    expect(m5.smdExtendedVsRoom).toBeCloseTo(-3, 10);
    expect(m5.smdReliable).toBe(false); // 3 per group < 8
  });
});

describe('M6 — symbol-hour clustering', () => {
  const rs = [
    receipt({ pcIn: { symbolHourKey: 'NVDA:100' } }),
    receipt({ pcIn: { symbolHourKey: 'NVDA:100' } }),
    receipt({ pcIn: { symbolHourKey: 'NVDA:100' } }),
    receipt({ pcIn: { symbolHourKey: 'AMD:200' } }),
    receipt({ pcIn: { symbolHourKey: null } }),
  ];
  const m6 = measureCorpus(rs).m6;
  it('shared-key share and cluster histogram', () => {
    expect(m6.nWithKey).toBe(4);
    expect(m6.distinctKeys).toBe(2);
    expect(m6.maxClusterSize).toBe(3);
    expect(m6.sharedKeyShare).toBeCloseTo(0.75, 10); // 3 of 4 keyed entries share a key
    expect(m6.nullKeyShare).toBeCloseTo(0.2, 10);
    expect(m6.sizeHistogram).toEqual({ '3': 1, '1': 1 });
  });
});

describe('M7 — D2 confirmation, entry-weighted', () => {
  const rs = [
    receipt({ piIn: { upDayVolRatio: 1.5, volumeRatio: 2.0, macdAboveSignal: true, dataMode: 'premarket' } }), // CONFIRMED
    receipt({ piIn: { upDayVolRatio: 1.0, volumeRatio: null, macdAboveSignal: null, dataMode: 'premarket' } }), // UNSCORABLE
    receipt({ piIn: { upDayVolRatio: 1.2, volumeRatio: 2.0, macdAboveSignal: false, dataMode: 'intraday' } }), // INDETERMINATE + intraday
    receipt({ piIn: { upDayVolRatio: null, volumeRatio: null, macdAboveSignal: null, dataMode: null } }), // UNSCORABLE
  ];
  const m7 = measureCorpus(rs).m7;
  it('upDayVolRatio pass rate over non-null', () => {
    expect(m7.upDayVolRatio.threshold).toBe(1.2);
    expect(m7.upDayVolRatio.nNonNull).toBe(3);
    expect(m7.upDayVolRatio.passRateOfNonNull).toBeCloseTo(2 / 3, 10); // 1.5 and 1.2 pass
  });
  it('D2 UNSCORABLE share via frozen classifyD2 (intraday rule)', () => {
    expect(m7.d2UnscorableShare).toBeCloseTo(0.5, 10); // e2, e4
    expect(m7.d2ConfirmedShare).toBeCloseTo(0.25, 10); // e1
    expect(m7.intradayShare).toBeCloseTo(0.25, 10); // e3
  });
});

describe('M8 — D3 opportunity counts', () => {
  const T = 1_000_000;
  const swap = (seq, offMin, over = {}) => receipt({
    receiptSeq: seq,
    timestamp: new Date(T + offMin * MIN).toISOString(),
    exitReason: 'haiku_decision',
    piOut: { regime: 'choppy' },
    ...over,
  });
  const rs = [
    swap(1, 0, { swapContext: { tradeCountAtDecision: 60, tradesLenAtDecision: 50 } }), // truncated
    swap(2, 5, { swapContext: { tradeCountAtDecision: 5, tradesLenAtDecision: 5 } }),
    swap(3, 8, { swapContext: { tradeCountAtDecision: 6, tradesLenAtDecision: 6 } }),
  ];
  const m8 = measureCorpus(rs, { wGridMinutes: [5, 30] }).m8;
  it('regime distribution + choppy presence', () => {
    expect(m8.regime.symbolOut).toEqual({ choppy: 3 });
    expect(m8.regime.choppyPresent).toBe(true);
    expect(m8.regime.choppyShareOfLegsWithRegime).toBeCloseTo(1, 10);
  });
  it('opportunities per W under strictly-prior scope', () => {
    const w5 = m8.perW.find((w) => w.windowMinutes === 5);
    const w30 = m8.perW.find((w) => w.windowMinutes === 30);
    expect(w5.opportunities).toBe(0); // only s2 within 5m of s3 → churnCount 1
    expect(w30.opportunities).toBe(1); // s3 sees s1+s2 → churnCount 2 → opportunity
    expect(w30.chopCount).toBe(3);
    expect(w30.opportunitiesPerBattleDay).toBeCloseTo(1, 10);
  });
  it('span2 gap and truncation rate', () => {
    expect(m8.span2.n).toBe(1);
    expect(m8.span2.medianMs).toBe(8 * MIN); // s3.ts - s1.ts
    expect(m8.truncation.truncationRate).toBeCloseTo(1 / 3, 10);
  });
});

describe('M9 — version stamps + provenance', () => {
  const rs = [
    receipt({ versions: { archetypeIntegrityMode: 'strict' }, entryAtrSource: 'scored_threshold', pcIn: { entrySnapshotSource: 'primary_fetch' } }),
    receipt({ versions: { archetypeIntegrityMode: 'strict' }, entryAtrSource: 'bench_proxy', pcIn: { entrySnapshotSource: 'capture_refetch' } }),
    receipt({ versions: { archetypeIntegrityMode: null }, entryAtrSource: null, pcIn: { entrySnapshotSource: 'refetch_missing' } }),
  ];
  const m9 = measureCorpus(rs).m9;
  it('version-stamp availability', () => {
    expect(m9.versions.archetypeIntegrityMode.nonNullCount).toBe(2);
    expect(m9.versions.archetypeIntegrityMode.distinctValues).toEqual(['strict']);
    expect(m9.versions.detectorVersion.nonNullCount).toBe(0);
    expect(m9.archetypeVersionNonNull).toBe(0);
  });
  it('entrySnapshotSource and entryAtrSource shares', () => {
    expect(m9.entrySnapshotSource).toEqual({ primary_fetch: 1, capture_refetch: 1, refetch_missing: 1 });
    expect(m9.entryAtrSource).toEqual({ scored_threshold: 1, bench_proxy: 1, null: 1 });
  });
});

describe('dataQuality — capture-consistency guard (re-derives D1 labels)', () => {
  it('flags stored labels that disagree with the frozen classifier', () => {
    const clean = receipt({
      piIn: { bbPercentB: 0.5, distanceToResistancePct: 5.0, distTo52wkHigh: 5.0 }, // → ROOM
      pcIn: { d1ClassAsSpecced: 'ROOM', d1ClassDrAbstain: 'ROOM' },
    });
    const drifted = receipt({
      piIn: { bbPercentB: 0.5, distanceToResistancePct: 5.0, distTo52wkHigh: 5.0 }, // → ROOM
      pcIn: { d1ClassAsSpecced: 'EXTENDED', d1ClassDrAbstain: 'ROOM' }, // stored EXTENDED is wrong
    });
    const dq = measureCorpus([clean, drifted]).dataQuality;
    expect(dq.d1AsSpeccedMismatch).toBe(1);
    expect(dq.d1DrAbstainMismatch).toBe(0);
    expect(dq.clean).toBe(false);
  });
});

it('DEFAULT_W_GRID_MINUTES is the documented convenience grid', () => {
  expect(DEFAULT_W_GRID_MINUTES).toEqual([5, 10, 15, 20, 30, 45, 60]);
});
