// src/config/shadowCpuQuoteIntegrityFlags.test.js
//
// Shadow vs CPU quote integrity — THE FLAG PIN (BUILD_RULES §2; contract
// SHADOW_CPU_PLACEHOLDER_PRICE_SPEC_V1_6.md §3.1, OFF-1; build record
// docs/audits/20261002_SHADOW_CPU_QUOTE_INTEGRITY_BUILD_REVIEW.md).
//
// SHADOW_CPU_QUOTE_INTEGRITY_ENABLED is TRUE in the activation candidate.
// R-11 still blocks release until production confirmation and the following
// regular market open. The flag-pin guard tracks the first row against the
// live value; this pin and the DARK_BY_DESIGN removal move with the constant.
//
// Deliberately pins ONLY this flag (the tickStampsFlags.test.js precedent).

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { SHADOW_CPU_QUOTE_INTEGRITY_ENABLED, isShadowCpuQuoteIntegrityOn } from './featureFlags.js';
import { classifyAdmission, resolveGate } from '../screens/battleView/shadowCpuQuoteIntegrity.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(path.join(HERE, 'featureFlags.js'), 'utf8');
const GUARD = readFileSync(path.join(HERE, 'flagPinGuard.test.js'), 'utf8');

describe('activation — the Shadow vs CPU quote-integrity flag is enabled, pinned and override-free', () => {
  it('the activation candidate enables SHADOW_CPU_QUOTE_INTEGRITY_ENABLED', () => {
    // THE ROW THAT MOVES WITH THE FLIP, in the flip PR's own commit.
    expect(SHADOW_CPU_QUOTE_INTEGRITY_ENABLED).toBe(true);
  });

  it('the accessor is actually true, unmocked', () => {
    expect(isShadowCpuQuoteIntegrityOn()).toBe(true);
  });

  it('is a plain boolean export the flag-pin guard can scan', () => {
    expect(typeof SHADOW_CPU_QUOTE_INTEGRITY_ENABLED).toBe('boolean');
    expect(SRC).toMatch(/^export const SHADOW_CPU_QUOTE_INTEGRITY_ENABLED = (true|false);$/m);
  });

  it('the accessor is a plain constant read — no URL, localStorage or environment override', () => {
    const start = SRC.indexOf('export function isShadowCpuQuoteIntegrityOn()');
    expect(start).toBeGreaterThan(-1);
    const end = SRC.indexOf('\n}', start);
    const body = SRC.slice(start, end + 2);
    expect(body).toMatch(/return SHADOW_CPU_QUOTE_INTEGRITY_ENABLED;/);
    for (const forbidden of ['location', 'URLSearchParams', 'localStorage', 'sessionStorage', 'import.meta', 'process.env', 'window']) {
      expect(body, `accessor must not read ${forbidden}`).not.toContain(forbidden);
    }
    // …and nothing else in the module reads an override for it.
    expect(SRC.match(/SHADOW_CPU_QUOTE_INTEGRITY/g).length).toBeLessThanOrEqual(4);
  });

  it('its docstring names this pinning suite, the R-11 flip condition and the DARK_BY_DESIGN coupling', () => {
    const idx = SRC.indexOf('export const SHADOW_CPU_QUOTE_INTEGRITY_ENABLED');
    const window = SRC.slice(Math.max(0, idx - 6000), idx);
    expect(window).toContain('Pinned by: shadowCpuQuoteIntegrityFlags.test.js');
    expect(window).toContain('DARK_BY_DESIGN');
    expect(window).toContain('R-11');
    expect(window).toContain('DEFAULT true');
  });

  it('the enabled flag is absent from the dark-by-design registry', () => {
    expect(GUARD).not.toMatch(/^ {2}SHADOW_CPU_QUOTE_INTEGRITY_ENABLED:/m);
  });

  it('this flag is one self-contained block: only the constant and its accessor, and nothing outside it reads either', () => {
    // About THIS flag only. featureFlags.js is shared, so no other flag's bytes
    // are pinned here (a whole-file hash conflicted with other approved work).
    // That the unrelated flags are untouched is recorded through the actual
    // diff instead: this candidate changes only this flag's block and removes
    // its DARK_BY_DESIGN entry. The original build's diff is in audit §13.
    const banner = SRC.indexOf(' * SHADOW VERSUS CPU — QUOTE INTEGRITY');
    expect(banner).toBeGreaterThan(-1);
    const start = SRC.lastIndexOf('/**', banner);
    const accessor = SRC.indexOf('export function isShadowCpuQuoteIntegrityOn()', banner);
    expect(accessor).toBeGreaterThan(banner);
    const end = SRC.indexOf('\n}', accessor) + 2;
    const block = SRC.slice(start, end);
    expect(block.match(/^export .*$/gm)).toEqual([
      'export const SHADOW_CPU_QUOTE_INTEGRITY_ENABLED = true;',
      'export function isShadowCpuQuoteIntegrityOn() {',
    ]);
    const outside = SRC.slice(0, start) + SRC.slice(end);
    expect(outside).not.toMatch(/SHADOW_CPU_QUOTE_INTEGRITY|isShadowCpuQuoteIntegrityOn/);
  });
});

describe('the gate itself: flag off is legacy whatever the evidence; admission is all four conditions', () => {
  const ADMITTED = {
    snapshotId: 'ab-1',
    data: { gameMode: 'baggerbomb_agent', opponent: { odUserId: 'cpu' } },
  };

  it('explicit off: every lookup/envelope state resolves to the legacy path', () => {
    for (const lookup of [undefined, { status: 'pending' }, { status: 'empty' }, { status: 'error', error: { code: 'x' } }]) {
      for (const envelope of [undefined, { requestedId: 'ab-1', status: 'error' }, { requestedId: 'ab-1', status: 'ready', ...ADMITTED }]) {
        expect(resolveGate({ integrityOn: false, directId: null, lookup, envelope, requestedId: 'ab-1' }).mode).toBe('legacy');
        expect(resolveGate({ integrityOn: false, directId: 'ab-1', lookup, envelope, requestedId: 'ab-1' }).mode).toBe('legacy');
      }
    }
  });

  it('explicit on: an admitted record takes the gated path', () => {
    expect(resolveGate({ integrityOn: true, directId: 'ab-1', envelope: { requestedId: 'ab-1', status: 'ready', ...ADMITTED }, requestedId: 'ab-1' }).mode)
      .toBe('admitted');
  });

  it('admits only: authoritative id = requested id, explicit baggerbomb_agent, odUserId cpu, groupId absent or null', () => {
    expect(classifyAdmission(ADMITTED, 'ab-1')).toEqual({ admitted: true, reason: null });
    expect(classifyAdmission({ ...ADMITTED, data: { ...ADMITTED.data, groupId: null } }, 'ab-1').admitted).toBe(true);
    expect(classifyAdmission(ADMITTED, 'ab-2')).toMatchObject({ admitted: false, reason: 'identity' });
    expect(classifyAdmission({ ...ADMITTED, data: { ...ADMITTED.data, gameMode: 'baggerbomb_tournament' } }, 'ab-1').reason).toBe('mode');
    expect(classifyAdmission({ ...ADMITTED, data: { opponent: { odUserId: 'cpu' } } }, 'ab-1').reason).toBe('mode');
    expect(classifyAdmission({ ...ADMITTED, data: { ...ADMITTED.data, opponent: { odUserId: 'user-7' } } }, 'ab-1').reason).toBe('opponent');
    expect(classifyAdmission({ ...ADMITTED, data: { ...ADMITTED.data, opponent: null } }, 'ab-1').reason).toBe('opponent');
    for (const groupId of ['', 'g-1', 0, false, {}, []]) {
      expect(classifyAdmission({ ...ADMITTED, data: { ...ADMITTED.data, groupId } }, 'ab-1').reason, JSON.stringify(groupId)).toBe('group');
    }
  });
});
