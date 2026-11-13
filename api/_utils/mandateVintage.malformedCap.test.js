// api/_utils/mandateVintage.malformedCap.test.js
//
// T0a — vintage construction fails CLOSED on a malformed sector slot count. The
// registry is mocked so the builder sees counts the fenced table never holds
// (it holds 2, 3 and 4 only): a builder that caught the translation error and
// fell back to "no cap" would pass every row in mandateSectorCapUnits.test.js,
// but not these. A separate file because vi.mock is file-wide.

import { describe, it, expect, vi } from 'vitest';

const override = vi.hoisted(() => ({ count: undefined, active: false }));

vi.mock('./archetypeRegistry.js', async (importActual) => {
  const actual = await importActual();
  return {
    ...actual,
    getArchetypeDefinition: (codeId, ...rest) => {
      const def = actual.getArchetypeDefinition(codeId, ...rest);
      if (!override.active || !def) return def;
      return { ...def, physics: { ...def.physics, sectorConcentrationCap: override.count } };
    },
  };
});

const { buildVintagePayload, resolveVintage } = await import('./mandateVintage.js');

function withCount(count, fn) {
  override.active = true;
  override.count = count;
  try { return fn(); } finally { override.active = false; override.count = undefined; }
}

describe('T0a — buildVintagePayload fails closed on a malformed sector slot count', () => {
  it.each([0, -2, 2.5, 7, 12, Number.NaN, '3'])('a registry count of %s throws: no payload, no hash, no vintage', (bad) => {
    withCount(bad, () => {
      expect(() => buildVintagePayload('diversifier')).toThrow(/malformed sector-cap slot count/);
      expect(() => resolveVintage('diversifier')).toThrow(/malformed sector-cap slot count/);
    });
  });

  it('CONTROL: the mock is live — a valid substituted count (5) builds 5/6', () => {
    withCount(5, () => {
      expect(buildVintagePayload('diversifier').gateConfig).toMatchObject({ sectorCapSlots: 5, sectorConcentrationCap: 5 / 6 });
    });
  });

  it('CONTROL: without the override the real count (2) builds 1/3', () => {
    expect(buildVintagePayload('diversifier').gateConfig.sectorConcentrationCap).toBe(1 / 3);
  });

  it('a null count builds a stamped "no cap" vintage (the null policy, recorded as such)', () => {
    withCount(null, () => {
      expect(buildVintagePayload('diversifier').gateConfig).toMatchObject({
        sectorCapSlots: null, sectorConcentrationCap: null, sectorCapConversionVersion: 1,
      });
    });
  });
});
