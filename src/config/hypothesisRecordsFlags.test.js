// src/config/hypothesisRecordsFlags.test.js
//
// Pilot P1a — THE FLAG PIN (BUILD_RULES §2; pilot spec V1.4 §2; build report
// docs/audits/20261007_BUILD_PILOT_P1A_HYPOTHESIS_RECORDS.md). The
// filmTapeFlags.test.js precedent: one pin, a Pinned-by pointer the flag-pin
// guard keeps honest, and a DARK_BY_DESIGN registration a deliberate flip
// drops in the same commit.
//
// HYPOTHESIS_RECORDS_ENABLED ships FALSE. An accidental flip fails the guard
// loudly with its runway note; a DELIBERATE flip (the founder's own PR, after
// the index and rules deploy) moves the first row below to `true` and turns
// the registration row around, in the same commit.
//
// This file is the pin, not a behaviour test: the gate-off rows (404
// disabled, no version at save, a review pass with zero reads, a hidden
// panel) live beside the code they gate, and each mocks the flag explicitly,
// so none of them moves with a flip.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { HYPOTHESIS_RECORDS_ENABLED, isHypothesisRecordsOn } from './featureFlags.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(path.join(HERE, 'featureFlags.js'), 'utf8');
const GUARD = readFileSync(path.join(HERE, 'flagPinGuard.test.js'), 'utf8');

describe('HYPOTHESIS_RECORDS_ENABLED — the pin (BUILD_RULES §2)', () => {
  it('is DARK: HYPOTHESIS_RECORDS_ENABLED is false — the build merges dark', () => {
    // THE ROW THAT MOVES WITH THE FLIP, in the founder's flip commit itself.
    expect(HYPOTHESIS_RECORDS_ENABLED).toBe(false);
  });

  it('is a plain boolean export the flag-pin guard can scan, with a Pinned-by pointer naming this file', () => {
    expect(SRC).toMatch(/^export const HYPOTHESIS_RECORDS_ENABLED = (true|false);$/m);
    const idx = SRC.indexOf('export const HYPOTHESIS_RECORDS_ENABLED = ');
    const preceding = SRC.slice(0, idx).split('\n').slice(-2).join('\n');
    expect(preceding).toContain('Pinned by: hypothesisRecordsFlags.test.js');
  });

  it('is registered DARK_BY_DESIGN while it ships false (a deliberate flip drops the entry in the same commit)', () => {
    expect(GUARD).toMatch(/^\s*HYPOTHESIS_RECORDS_ENABLED:/m);
  });

  it('the accessor is the constant and nothing else — no URL, storage or environment override', () => {
    expect(isHypothesisRecordsOn()).toBe(HYPOTHESIS_RECORDS_ENABLED);
    const start = SRC.indexOf('export function isHypothesisRecordsOn()');
    const body = SRC.slice(start, SRC.indexOf('}', start) + 1);
    expect(body).toMatch(/return HYPOTHESIS_RECORDS_ENABLED;/);
    expect(body).not.toMatch(/localStorage|location|process\.env|URLSearchParams/);
  });
});
