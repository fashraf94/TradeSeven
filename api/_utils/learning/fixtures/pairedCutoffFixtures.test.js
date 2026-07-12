// api/_utils/learning/fixtures/pairedCutoffFixtures.test.js
//
// Suite 2 (Paired cutoff) — the no-lookahead promise.
import { describe, it, expect } from 'vitest';
import { classifyD1, classifyD2 } from '../detectorClassifiers.js';
import { PAIRED_CUTOFF, projectEntrySnapshot } from './pairedCutoffFixtures.js';

describe('Paired cutoff fixtures — entry-time snapshot is byte-identical; classification is lookahead-free', () => {
  it.each(PAIRED_CUTOFF.map((f) => [f.name, f]))('%s', (_name, f) => {
    const variantA = { ...f.entryInputs, _laterBars: f.laterBarsA };
    const variantB = { ...f.entryInputs, _laterBars: f.laterBarsB };

    // (1) BYTE-IDENTICAL entry-time snapshot — the projection drops all
    //     post-cutoff data, so the two mutated-future variants are identical.
    const projA = projectEntrySnapshot(variantA);
    const projB = projectEntrySnapshot(variantB);
    expect(JSON.stringify(projA)).toBe(JSON.stringify(projB));

    // (2) Classification is invariant to the mutated later bars, and matches
    //     the expected label. If a classifier ever read `_laterBars`, A≠B here.
    expect(classifyD1(variantA).class).toBe(f.expectedD1);
    expect(classifyD1(variantB).class).toBe(f.expectedD1);
    expect(classifyD2(variantA).class).toBe(f.expectedD2);
    expect(classifyD2(variantB).class).toBe(f.expectedD2);
  });

  it('a later bar carrying a value NEVER heals an UNSCORABLE entry (no backfill from the future)', () => {
    const f = PAIRED_CUTOFF.find((x) => x.expectedD1 === 'UNSCORABLE');
    const withFutureValue = { ...f.entryInputs, _laterBars: f.laterBarsA };
    expect(classifyD1(withFutureValue).class).toBe('UNSCORABLE');
    expect(classifyD2(withFutureValue).class).toBe('UNSCORABLE');
  });
});
