// api/_utils/setupMenuLabels/gate.test.js
//
// Slice 2 — the gate: the flag AND the cockpit allowlist, read now (spec V2 §7.1, D-4).
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4; review SM3-3): gate.js imports
// src/config/setupMenuLabelsFlags.js; the first describe imports gate.js UNMOCKED, so a browser-only
// dependency entering that graph fails here. The flag ships FALSE; the flag-on rows mock it explicitly.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { setupMenuLabelsAdmits, setupMenuLabelsFlagOn, setupMenuLabelsOwners } from './gate.js';

const ENV = 'COCKPIT_ALLOWLIST_UIDS';
const saved = process.env[ENV];
afterEach(() => { if (saved === undefined) delete process.env[ENV]; else process.env[ENV] = saved; vi.resetModules(); vi.doUnmock('../../../src/config/setupMenuLabelsFlags.js'); });

// Re-imports gate.js with the flag module mocked to `flag`.
const load = async (flag) => {
  vi.resetModules();
  vi.doMock('../../../src/config/setupMenuLabelsFlags.js', () => ({ SETUP_MENU_LABELS_ENABLED: flag }));
  return import('./gate.js');
};

describe('the unmocked graph (the dependency-surface guard)', () => {
  it('loads in the Node test env; the shipped flag is off, so nobody is admitted whatever the allowlist says', () => {
    process.env[ENV] = 'owner-1';
    expect(setupMenuLabelsFlagOn()).toBe(false);
    expect(setupMenuLabelsOwners()).toEqual([]);
    expect(setupMenuLabelsAdmits('owner-1')).toBe(false);
  });
});

describe('flag on: the allowlist, read at call time', () => {
  it('admits exactly the listed owners, read on each call', async () => {
    const g = await load(true);
    process.env[ENV] = 'owner-1, owner-2';
    expect(g.setupMenuLabelsOwners()).toEqual(['owner-1', 'owner-2']);
    expect([g.setupMenuLabelsAdmits('owner-1'), g.setupMenuLabelsAdmits('owner-3')]).toEqual([true, false]);
    process.env[ENV] = 'owner-3';
    expect([g.setupMenuLabelsAdmits('owner-1'), g.setupMenuLabelsAdmits('owner-3')]).toEqual([false, true]);
  });
  it('an empty or missing allowlist, or a malformed owner, admits nobody; nothing throws', async () => {
    const g = await load(true);
    delete process.env[ENV];
    expect(g.setupMenuLabelsOwners()).toEqual([]);
    process.env[ENV] = ' , ';
    expect(g.setupMenuLabelsAdmits('')).toBe(false);
    for (const owner of [null, undefined, 7, {}]) expect(g.setupMenuLabelsAdmits(owner)).toBe(false);
  });
  it('a flag that is not exactly `true` is off', async () => {
    for (const v of ['true', 1, null]) {
      const g = await load(v);
      process.env[ENV] = 'owner-1';
      expect(g.setupMenuLabelsAdmits('owner-1')).toBe(false);
    }
  });
});
