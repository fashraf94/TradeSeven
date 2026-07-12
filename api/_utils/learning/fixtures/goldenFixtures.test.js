// api/_utils/learning/fixtures/goldenFixtures.test.js
//
// Suite 1 (Golden) — known market examples → expected classification.
import { describe, it, expect } from 'vitest';
import { classifyD1, classifyD2, D1_CLASSES, D2_CLASSES, D2_FAMILY_STATES } from '../detectorClassifiers.js';
import { D1_GOLDEN, D2_GOLDEN, D2_INTRADAY_GOLDEN } from './goldenFixtures.js';

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

describe('Golden fixtures — D2 intraday bar-basis fix (volume.ratio placeholder)', () => {
  it.each(D2_INTRADAY_GOLDEN.map((f) => [f.name, f]))('%s', (_name, f) => {
    const r = classifyD2(f.inputs);
    expect(r.class).toBe(f.expected);
    expect(r.volume).toBe(f.expectVolume);
  });

  it('a volume.ratio of 1.0 under dataMode=intraday NEVER produces a FAIL volume vote', () => {
    // Whatever the momentum member does, the placeholder can never be a FAIL.
    for (const upDayVolRatio of [1.5, 1.2, 1.0, 0.5, null]) {
      for (const macdAboveSignal of [true, false, null]) {
        const r = classifyD2({ dataMode: 'intraday', volumeRatio: 1.0, upDayVolRatio, macdAboveSignal });
        expect(r.volume, `upDay=${upDayVolRatio} macd=${macdAboveSignal}`).not.toBe(D2_FAMILY_STATES.FAIL);
      }
    }
  });

  it('the fix is mode-gated: identical inputs FAIL under pre-market but are UNKNOWN under intraday', () => {
    const inputs = { volumeRatio: 1.0, upDayVolRatio: 1.0, macdAboveSignal: false };
    // Pre-market: real 1.0 volume.ratio → observed FAIL (today's behavior).
    expect(classifyD2({ ...inputs, dataMode: 'premarket' }).volume).toBe(D2_FAMILY_STATES.FAIL);
    // No dataMode → treated as observed too (regression-safe default).
    expect(classifyD2(inputs).volume).toBe(D2_FAMILY_STATES.FAIL);
    // Intraday: placeholder relabeled MISSING → UNKNOWN (fix).
    expect(classifyD2({ ...inputs, dataMode: 'intraday' }).volume).toBe(D2_FAMILY_STATES.UNKNOWN);
  });
});
