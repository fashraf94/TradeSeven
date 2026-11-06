// api/_utils/activationEvidence/gate.test.js
//
// ID-1 Build 2 — the gate: the flag AND the cockpit allowlist, read now.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): gate.js imports
// src/config/activationEvidenceFlags.js; the first describe imports gate.js
// UNMOCKED, so a browser-only dependency entering that graph fails here.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { activationEvidenceFlagOn, activationEvidenceOwners, activationEvidenceOnForAnyone } from './gate.js';

const ENV = 'COCKPIT_ALLOWLIST_UIDS';
const saved = process.env[ENV];
afterEach(() => { if (saved === undefined) delete process.env[ENV]; else process.env[ENV] = saved; vi.resetModules(); vi.doUnmock('../../../src/config/activationEvidenceFlags.js'); });

describe('flag off (the shipped state)', () => {
  it('resolves off for everyone, whatever the allowlist says', () => {
    process.env[ENV] = 'owner-1,owner-2';
    expect(activationEvidenceFlagOn()).toBe(false);
    expect(activationEvidenceOwners()).toEqual([]);
    expect(activationEvidenceOnForAnyone()).toBe(false);
  });
});

describe('flag on', () => {
  const load = async () => {
    vi.doMock('../../../src/config/activationEvidenceFlags.js', () => ({ ACTIVATION_EVIDENCE_ENABLED: true }));
    return import('./gate.js');
  };
  it('the owners are the allowlist, read at call time; empty → off', async () => {
    const g = await load();
    process.env[ENV] = ' owner-1, ,owner-2 ';
    expect(g.activationEvidenceOwners()).toEqual(['owner-1', 'owner-2']);
    expect(g.activationEvidenceOnForAnyone()).toBe(true);
    delete process.env[ENV];
    expect(g.activationEvidenceOwners()).toEqual([]);
    expect(g.activationEvidenceOnForAnyone()).toBe(false);
  });
});
