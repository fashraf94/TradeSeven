// api/_utils/learning/fixtures/withinBarFixtures.test.js
//
// Suite 3 (Within-bar) — partial-bar mutation after the decision must not move
// the captured snapshot; bar basis must be pinned for every predicate field.
import { describe, it, expect } from 'vitest';
import { classifyD1, classifyD2 } from '../detectorClassifiers.js';
import {
  BAR_BASIS, PREDICATE_BAR_BASIS, BAR_BASIS_TABLE_VERSION,
  resolveBarBasis, allFieldsPinned,
} from '../barBasis.js';
import { WITHIN_BAR, PARTIAL_UNDER_INTRADAY } from './withinBarFixtures.js';

describe('Within-bar prerequisite — every predicate field bar basis is PINNED', () => {
  it('the bar-basis table is complete and every field is pinnable (calibration-gate prerequisite)', () => {
    expect(allFieldsPinned()).toBe(true);
    // The seven D1/D2 predicate fields all have a semantics row.
    expect(Object.keys(PREDICATE_BAR_BASIS).sort()).toEqual([
      'levels.distanceToResistancePct',
      'momentum.macdAboveSignal',
      'momentum.macdFreshBullishCross',
      'momentum.upDayVolRatio',
      'smaStack.distTo52wkHigh',
      'volatility.bbPercentB',
      'volume.ratio',
    ]);
  });

  it('dual-mode basis resolves: premarket → last-closed daily bar, intraday → point-in-time partial', () => {
    for (const field of Object.keys(PREDICATE_BAR_BASIS)) {
      expect(resolveBarBasis(field, 'premarket')).toBe(BAR_BASIS.LAST_CLOSED);
      expect(resolveBarBasis(field, 'intraday')).toBe(BAR_BASIS.PARTIAL);
    }
    expect(resolveBarBasis('nonexistent.field', 'intraday')).toBeNull();
  });

  it('records the volume.ratio intraday caveat (neutralized placeholder, not true partial volume)', () => {
    expect(PREDICATE_BAR_BASIS['volume.ratio'].caveat).toMatch(/neutralized/i);
    // Every field with a partial intraday basis is enumerated (all seven here).
    expect(PARTIAL_UNDER_INTRADAY.length).toBe(7);
  });

  it('bar-basis table version is stamped', () => {
    expect(BAR_BASIS_TABLE_VERSION).toBe(1);
  });
});

describe('Within-bar fixtures — a post-decision partial-bar mutation never moves the captured snapshot', () => {
  it.each(WITHIN_BAR.map((f) => [f.name, f]))('%s', (_name, f) => {
    // Classification of the captured (instant-T) snapshot.
    const baseD1 = classifyD1(f.capturedInputs).class;
    const baseD2 = classifyD2(f.capturedInputs).class;

    // The unfinished bar keeps moving AFTER T. If we (wrongly) let post-decision
    // data leak in, the class would change. The captured snapshot is frozen, so
    // classifying it — with a post-decision payload merely ATTACHED — is stable.
    const withPostDecision = { ...f.capturedInputs, _postDecisionBar: f.postDecisionMutation };
    expect(classifyD1(withPostDecision).class).toBe(baseD1);
    expect(classifyD2(withPostDecision).class).toBe(baseD2);

    // And crucially: the class is NOT what the post-decision mutation alone would
    // have produced (proving the mutation did not leak in).
    const mutatedD1 = classifyD1(f.postDecisionMutation).class;
    const mutatedD2 = classifyD2(f.postDecisionMutation).class;
    // At least one detector must differ, else the fixture doesn't exercise the guard.
    expect(baseD1 !== mutatedD1 || baseD2 !== mutatedD2).toBe(true);
  });

  it('intraday: the captured instant-T partial value is authoritative (contract permits partial data AT the instant)', () => {
    const intraday = WITHIN_BAR.find((f) => f.dataMode === 'intraday');
    // The captured intraday snapshot classifies from its instant-T partial values
    // (permitted), independent of what the bar later becomes.
    expect(classifyD1(intraday.capturedInputs).class).toBe('EXTENDED'); // pB 0.96 + dR 0.7 = 2 extended markers
  });
});
