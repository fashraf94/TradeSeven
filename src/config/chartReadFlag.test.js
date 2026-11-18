// src/config/chartReadFlag.test.js
//
// The chart's evidence — THE FLAG PIN (BUILD_RULES §2; spec
// docs/specs/CHART_EVIDENCE_SPEC_V1.md RR-7). CHART_READ_MODE is a STRING
// TRI-STATE beside the shell's and Battle Research's flags in
// researchModalFlags.js: pinned directly here (the pin, the allowed values, the
// literal and its Pinned-by pointer), never a DARK_BY_DESIGN key — the guard
// scans `*_ENABLED` booleans only — and noted by name in that block instead.
// A flip moves the first row below in its own one-line founder PR.
//
// This file is the pin, not a behaviour test: the route's rows mock the flag
// explicitly, so none of them moves with a flip.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { CHART_READ_MODE, CHART_READ_MODES } from './researchModalFlags.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(path.join(HERE, 'researchModalFlags.js'), 'utf8').replace(/\r\n/g, '\n');
const GUARD = readFileSync(path.join(HERE, 'flagPinGuard.test.js'), 'utf8').replace(/\r\n/g, '\n');
const FEATURE_FLAGS = readFileSync(path.join(HERE, 'featureFlags.js'), 'utf8');
const SELF = readFileSync(fileURLToPath(import.meta.url), 'utf8').replace(/\r\n/g, '\n');

const docstringOf = (name) => {
  const idx = SRC.indexOf(`export const ${name} = `);
  const prev = SRC.lastIndexOf('/**', idx);
  return SRC.slice(prev, idx);
};
const ROLLBACK = "a kill switch: roll back one step at a time ('on' → 'allowlist' → 'off') by moving the literal and its pin together; every mode-off arm stays in the code until the cleanup PR, after 'on' has run in production";

describe('CHART_READ_MODE — the pin (BUILD_RULES §2; spec RR-7)', () => {
  it("is 'allowlist' — a kill switch: roll back one step at a time ('on' → 'allowlist' → 'off') by moving the literal and its pin together; every mode-off arm stays in the code until the cleanup PR, after 'on' has run in production", () => {
    // THE ROW THAT MOVES WITH A FLIP ('off' → 'allowlist' → 'on'), in the flip PR's own commit; a rollback moves it back.
    expect(CHART_READ_MODE).toBe('allowlist');
  });

  it('the allowed values: exactly off · allowlist · on, frozen, in walk order, and the shipped value is one of them', () => {
    expect(CHART_READ_MODES).toEqual(['off', 'allowlist', 'on']);
    expect(Object.isFrozen(CHART_READ_MODES)).toBe(true);
    expect(CHART_READ_MODES).toContain(CHART_READ_MODE);
    expect(typeof CHART_READ_MODE).toBe('string');
  });

  it('is a plain string literal with a Pinned-by pointer naming this file, and its runway, rollback and per-player allowlist are written beside it', () => {
    expect(SRC).toMatch(/^export const CHART_READ_MODE = '(off|allowlist|on)';$/m);
    const idx = SRC.indexOf('export const CHART_READ_MODE = ');
    const preceding = SRC.slice(0, idx).split('\n').slice(-2).join('\n');
    expect(preceding).toContain('Pinned by: chartReadFlag.test.js');
    const doc = docstringOf('CHART_READ_MODE');
    expect(doc).toContain('RUNWAY:');
    expect(doc).toContain('never a build PR');
    expect(doc).toContain('PER PLAYER');
    expect(doc).toContain('isCockpitOwnerAllowlisted');
    expect(doc).toContain('chart_read_unavailable');
    expect(doc).toContain('ROLLBACK');
    expect(doc).toContain('READ ONLY');
    expect(doc.replace(/\n \* ?/g, ' ')).toContain(ROLLBACK);
    // The docstring names the live value (a flip or a rollback moves this line with the literal).
    expect(doc.replace(/\n \* ?/g, ' ')).toContain(`CURRENT: '${CHART_READ_MODE}'`);
    expect(SELF).toContain(`"is '${CHART_READ_MODE}' — ${ROLLBACK}"`);
  });

  it('never a DARK_BY_DESIGN key (the guard scans *_ENABLED booleans only), but noted by name in that block', () => {
    expect(GUARD).not.toMatch(/^\s*CHART_READ_MODE\s*:/m);
    expect(GUARD).toContain('CHART_READ_MODE intentionally ABSENT');
    expect(GUARD).toContain('chartReadFlag.test.js asserts both halves');
  });

  it('no boolean twin exists, and the flag is not a line in featureFlags.js (the entry-chunk reason in the module header)', () => {
    expect(SRC).not.toMatch(/^export const CHART_READ_ENABLED\b/m);
    expect(FEATURE_FLAGS).not.toMatch(/CHART_READ/);
  });
});
