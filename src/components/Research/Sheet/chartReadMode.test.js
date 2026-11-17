// src/components/Research/Sheet/chartReadMode.test.js
//
// The chart's evidence — the flag's call-time resolver (spec
// docs/specs/CHART_EVIDENCE_SPEC_V1.md RR-7): any value outside the walked states
// reads 'off'; 'allowlist' needs a true per-player verdict; the module is pure and
// reads the flag at call time, never at module scope.

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const flag = vi.hoisted(() => ({ mode: 'off', modes: ['off', 'allowlist', 'on'] }));
vi.mock('../../../config/researchModalFlags.js', () => ({
  get CHART_READ_MODE() { return flag.mode; },
  get CHART_READ_MODES() { return flag.modes; },
}));

const { resolveChartReadMode, chartReadModeOn } = await import('./chartReadMode.js');
const SRC = readFileSync(fileURLToPath(new URL('./chartReadMode.js', import.meta.url)), 'utf8');

describe('resolveChartReadMode', () => {
  it('returns a walked state as it is, read at call time', () => {
    for (const mode of ['off', 'allowlist', 'on']) {
      flag.mode = mode;
      expect(resolveChartReadMode()).toBe(mode);
    }
  });
  it("reads any other value as 'off', and never throws", () => {
    for (const mode of ['ON', 'Allowlist', '', null, undefined, true, 1, {}]) {
      flag.mode = mode;
      expect(resolveChartReadMode()).toBe('off');
    }
    flag.mode = 'on';
    flag.modes = undefined;
    expect(resolveChartReadMode()).toBe('off');
    flag.modes = ['off', 'allowlist', 'on'];
  });
});

describe('chartReadModeOn', () => {
  it("'on' admits everyone; 'off' no one; 'allowlist' only a true verdict", () => {
    expect(chartReadModeOn('on')).toBe(true);
    expect(chartReadModeOn('on', { verdict: false })).toBe(true);
    expect(chartReadModeOn('off', { verdict: true })).toBe(false);
    expect(chartReadModeOn('allowlist', { verdict: true })).toBe(true);
    for (const verdict of [false, undefined, 'true', 1]) expect(chartReadModeOn('allowlist', { verdict })).toBe(false);
    expect(chartReadModeOn(undefined, { verdict: true })).toBe(false);
  });
});

describe('the module', () => {
  it('imports only the flag module, and reads it inside functions only', () => {
    const imports = [...SRC.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]);
    expect(imports).toEqual(['../../../config/researchModalFlags.js']);
    const topLevel = SRC.replace(/\/\/.*$/gm, '').split(/\nexport function /)[0];
    expect(topLevel).not.toMatch(/=\s*CHART_READ_MODE\b/);
  });
});
