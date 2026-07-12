// api/_utils/learning/fixtures/goldenFixtures.test.js
//
// Suite 1 (Golden) — known market examples → expected classification.
import { describe, it, expect } from 'vitest';
import { classifyD1, classifyD2, D1_CLASSES, D2_CLASSES, D2_FAMILY_STATES } from '../detectorClassifiers.js';
import { D1_GOLDEN, D2_GOLDEN } from './goldenFixtures.js';

describe('Golden fixtures — D1', () => {
  it.each(D1_GOLDEN.map((f) => [f.name, f]))('%s', (_name, f) => {
    expect(classifyD1(f.inputs).class).toBe(f.expected);
  });

  it('covers every D1 class label at least once', () => {
    const seen = new Set(D1_GOLDEN.map((f) => f.expected));
    expect(seen).toEqual(new Set(Object.values(D1_CLASSES)));
  });
});

describe('Golden fixtures — D2', () => {
  it.each(D2_GOLDEN.map((f) => [f.name, f]))('%s', (_name, f) => {
    expect(classifyD2(f.inputs).class).toBe(f.expected);
  });

  it('covers every D2 class label at least once', () => {
    const seen = new Set(D2_GOLDEN.map((f) => f.expected));
    expect(seen).toEqual(new Set(Object.values(D2_CLASSES)));
  });

  it('covers all nine volume×momentum family cells', () => {
    const F = D2_FAMILY_STATES;
    const cells = new Set();
    for (const f of D2_GOLDEN) {
      const r = classifyD2(f.inputs);
      cells.add(`${r.volume}|${r.momentum}`);
    }
    // Every family-state pair that can arise from the three-state model.
    // Note UNSCORABLE short-circuits the detector but the underlying families
    // still resolve, so we assert each of the nine (family × family) cells appears.
    const expectedCells = [];
    for (const v of [F.PASS, F.FAIL, F.UNKNOWN]) {
      for (const m of [F.PASS, F.FAIL, F.UNKNOWN]) {
        expectedCells.push(`${v}|${m}`);
      }
    }
    for (const c of expectedCells) {
      expect(cells, `missing family cell ${c}`).toContain(c);
    }
  });
});
