// api/_utils/learning/learningSchemas.test.js
import { describe, it, expect } from 'vitest';
import {
  LEARNING_SCHEMA_VERSION,
  makePredicateInputs,
  makeReceiptSkeleton,
  makeEvidenceAtomSkeleton,
  makeDossierSkeleton,
  makeCalibrationManifestSkeleton,
} from './learningSchemas.js';
import { BAR_BASIS_TABLE_VERSION } from './barBasis.js';

describe('learningSchemas — shapes only, null leaves', () => {
  it('receipt skeleton has every spec §3 field group, null leaves', () => {
    const r = makeReceiptSkeleton();
    // identity
    expect(r).toMatchObject({ agentId: null, battleId: null, battleDay: null, timestamp: null, receiptSeq: null });
    // decision
    expect(r).toMatchObject({ symbolIn: null, symbolOut: null, source: null, exitReason: null, haikuSwapReason: null });
    // validated sizing
    expect(r).toMatchObject({ resolvedTier: null, resolvedSlotIndex: null });
    // entry state
    expect(r).toMatchObject({ entryMark: null, entryATR: null });
    // guardrail-replay
    expect(Object.keys(r.guardrailReplay)).toEqual([
      'outgoingEntryPrice', 'outgoingBaseATR', 'highWaterMark', 'trailActivation',
      'trailStepLevel', 'thresholdHistory', 'outgoingSwappedInAt', 'outgoingSwappedInDay',
    ]);
    // predicate inputs, both symbols
    expect(r.predicateInputs.symbolIn).toEqual(makePredicateInputs());
    expect(r.predicateInputs.symbolOut).toEqual(makePredicateInputs());
    // version stamps — all eight keys present
    expect(Object.keys(r.versions)).toEqual([
      'detectorVersion', 'evaluationSpecVersion', 'calibrationManifestVersion',
      'leanRenderConfigVersion', 'archetypeIntegrityMode', 'ruleLibraryVersion',
      'archetypeVersion', 'regimeClassifierVersion',
    ]);
    // data quality
    expect(r.dataQuality).toEqual({ nullFlags: [] });
    // evidence provenance — top-level, null leaf (stamped at build time)
    expect(r.evidenceClass).toBeNull();
    // versions stamped
    expect(r.schemaVersion).toBe(LEARNING_SCHEMA_VERSION);
    expect(r.barBasisTableVersion).toBe(BAR_BASIS_TABLE_VERSION);
  });

  it('receipt skeleton carries NO outcome-derived/estimator tokens (outcome-blind labels permitted)', () => {
    const json = JSON.stringify(makeReceiptSkeleton());
    // Contract tripwire (Phase A.5 reframe): outcome-blind classification labels
    // are allowed, but no OUTCOME-DERIVED / estimator token may ever appear.
    for (const banned of ['mpe', 'MPE', 'effectiveReach', 'regret', 'bootstrap', 'estimate', 'smd', 'narration', 'score', 'clopper']) {
      expect(json.toLowerCase()).not.toContain(banned.toLowerCase());
    }
  });

  it('predicate inputs carry the seven predicate fields + regime + level context + raw provenance', () => {
    expect(Object.keys(makePredicateInputs())).toEqual([
      'bbPercentB', 'distanceToResistancePct', 'distTo52wkHigh', 'volumeRatio',
      'upDayVolRatio', 'macdAboveSignal', 'macdFreshBullishCross', 'regime',
      'nearestResistance', 'nearestSupport', 'distanceToSupportPct',
      'dataMode', 'dataUpdatedAt',
    ]);
  });

  it('overrides merge shallowly onto the skeleton', () => {
    const r = makeReceiptSkeleton({ agentId: 'a1', receiptSeq: 5 });
    expect(r.agentId).toBe('a1');
    expect(r.receiptSeq).toBe(5);
    expect(r.symbolIn).toBeNull();
  });

  it('evidence atom skeleton is shape-only with NO estimator fields (no writer in L1)', () => {
    const a = makeEvidenceAtomSkeleton();
    expect(a).toMatchObject({ atomId: null, agentId: null, detector: null, classLabel: null });
    const json = JSON.stringify(a).toLowerCase();
    for (const banned of ['estimate', 'statistic', 'mpe', 'regret', 'score']) {
      expect(json).not.toContain(banned);
    }
  });

  it('dossier skeleton exposes the userId ownership field the firestore rule reads', () => {
    const d = makeDossierSkeleton({ userId: 'u1', agentId: 'a1' });
    expect(d.userId).toBe('u1');
    expect(d.agentId).toBe('a1');
    expect(d.lessons).toEqual([]);
  });

  it('calibration manifest skeleton carries the three-suite fixture gate shape', () => {
    const m = makeCalibrationManifestSkeleton();
    expect(m.fixtureGate).toEqual({ golden: null, pairedCutoff: null, withinBar: null });
    expect(m.barBasisTableVersion).toBe(BAR_BASIS_TABLE_VERSION);
  });
});
