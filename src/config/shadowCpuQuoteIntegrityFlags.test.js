// src/config/shadowCpuQuoteIntegrityFlags.test.js
//
// Shadow vs CPU quote integrity — THE FLAG PIN (BUILD_RULES §2; contract
// SHADOW_CPU_PLACEHOLDER_PRICE_SPEC_V1_6.md §3.1, OFF-1; build record
// docs/audits/20261002_SHADOW_CPU_QUOTE_INTEGRITY_BUILD_REVIEW.md).
//
// SHADOW_CPU_QUOTE_INTEGRITY_ENABLED ships FALSE by design: the build merges
// dark and the founder flips it in its own PR (no earlier than R-11's
// condition). The flag-pin guard (flagPinGuard.test.js) tracks the first row
// against the live value and, because the flag sits in DARK_BY_DESIGN there, an
// accidental flip fails loudly with the runway note; a DELIBERATE flip moves
// that row to `true` and drops the DARK_BY_DESIGN entry in the same commit.
//
// Deliberately pins ONLY this flag (the tickStampsFlags.test.js precedent).

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { SHADOW_CPU_QUOTE_INTEGRITY_ENABLED, isShadowCpuQuoteIntegrityOn } from './featureFlags.js';
import { classifyAdmission, resolveGate } from '../screens/battleView/shadowCpuQuoteIntegrity.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(path.join(HERE, 'featureFlags.js'), 'utf8');
const GUARD = readFileSync(path.join(HERE, 'flagPinGuard.test.js'), 'utf8');

describe('OFF-1 — the Shadow vs CPU quote-integrity flag is dark, pinned and override-free', () => {
  it('ships DARK: SHADOW_CPU_QUOTE_INTEGRITY_ENABLED is false at merge', () => {
    // THE ROW THAT MOVES WITH THE FLIP, in the flip PR's own commit.
    expect(SHADOW_CPU_QUOTE_INTEGRITY_ENABLED).toBe(false);
  });

  it('the accessor is actually false, unmocked', () => {
    expect(isShadowCpuQuoteIntegrityOn()).toBe(false);
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
    expect(window).toContain('DEFAULT false');
  });

  it('the guard registers it as dark by design, with a runway note', () => {
    expect(GUARD).toMatch(/^ {2}SHADOW_CPU_QUOTE_INTEGRITY_ENABLED:\n {4}'Shadow vs CPU quote integrity/m);
  });

  it('existing rollout flags are untouched: the pre-build featureFlags.js is a byte-exact prefix (append-only)', () => {
    // Captured from 44d0c63e. A value pin on a neighbour would couple that
    // flag's docstring to this suite (flagPinGuard's Pinned-by rule), so the
    // claim is made over the bytes instead: every existing flag, accessor and
    // docstring is exactly as it was, and this flag only follows them.
    const BASE_LENGTH = 164705;
    const BASE_SHA256 = '2f5c438ca42ccfc8239b6021d7c16f3ffdec62a718e49c8371ccae39a8de8ac6';
    const bytes = readFileSync(path.join(HERE, 'featureFlags.js'));
    expect(createHash('sha256').update(bytes.subarray(0, BASE_LENGTH)).digest('hex')).toBe(BASE_SHA256);
    expect(bytes.subarray(BASE_LENGTH).toString('utf8')).toContain('export const SHADOW_CPU_QUOTE_INTEGRITY_ENABLED = false;');
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
