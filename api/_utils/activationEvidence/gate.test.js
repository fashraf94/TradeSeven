// api/_utils/activationEvidence/gate.test.js
//
// ID-1 Build 2 — the gate: the flag AND the cockpit allowlist, read now.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): gate.js imports
// src/config/activationEvidenceFlags.js; the first describe imports gate.js
// UNMOCKED, so a browser-only dependency entering that graph fails here.
//
// The flag ships TRUE (the 2026-11-06 flip), so the flag-off rows mock it
// explicitly — they no longer ride on its default. Their assertions are the
// ones the dark build shipped with.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { activationEvidenceFlagOn, activationEvidenceOwners, activationEvidenceOnForAnyone } from './gate.js';

const ENV = 'COCKPIT_ALLOWLIST_UIDS';
const saved = process.env[ENV];
afterEach(() => { if (saved === undefined) delete process.env[ENV]; else process.env[ENV] = saved; vi.resetModules(); vi.doUnmock('../../../src/config/activationEvidenceFlags.js'); });

// Re-imports gate.js with the flag module mocked to `flag`.
const load = async (flag) => {
  vi.resetModules();
  vi.doMock('../../../src/config/activationEvidenceFlags.js', () => ({ ACTIVATION_EVIDENCE_ENABLED: flag }));
  return import('./gate.js');
};

describe('the unmocked graph (the dependency-surface guard)', () => {
  it('loads in the Node test env and answers in the gate\'s own types', () => {
    expect(typeof activationEvidenceFlagOn()).toBe('boolean');
    expect(Array.isArray(activationEvidenceOwners())).toBe(true);
    expect(typeof activationEvidenceOnForAnyone()).toBe('boolean');
  });
});

describe('flag off (mocked explicitly: the flag now ships true)', () => {
  it('resolves off for everyone, whatever the allowlist says', async () => {
    const g = await load(false);
    process.env[ENV] = 'owner-1,owner-2';
    expect(g.activationEvidenceFlagOn()).toBe(false);
    expect(g.activationEvidenceOwners()).toEqual([]);
    expect(g.activationEvidenceOnForAnyone()).toBe(false);
  });
});

describe('flag on', () => {
  it('the owners are the allowlist, read at call time; empty → off', async () => {
    const g = await load(true);
    process.env[ENV] = ' owner-1, ,owner-2 ';
    expect(g.activationEvidenceOwners()).toEqual(['owner-1', 'owner-2']);
    expect(g.activationEvidenceOnForAnyone()).toBe(true);
    delete process.env[ENV];
    expect(g.activationEvidenceOwners()).toEqual([]);
    expect(g.activationEvidenceOnForAnyone()).toBe(false);
  });
});
