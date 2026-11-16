// src/config/setupEvidenceSweepFlags.test.js
//
// The chart's evidence — THE SWEEP'S FLAG PIN (BUILD_RULES §2; the setupMenuLabelsFlags.test.js
// precedent): one pin, a Pinned-by pointer the flag-pin guard keeps honest, and a DARK_BY_DESIGN
// registration a deliberate flip drops in the same commit.
//
// SETUP_EVIDENCE_SWEEP_ENABLED is FALSE (PR B, built dark). PR C, the one-line switch, moves the
// first row to `true`, turns the registration row around (`.not.toMatch`), and drops the
// DARK_BY_DESIGN entry, in one commit.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { SETUP_EVIDENCE_SWEEP_ENABLED } from './setupEvidenceSweepFlags.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(path.join(HERE, 'setupEvidenceSweepFlags.js'), 'utf8').replace(/\r\n/g, '\n');
const GUARD = readFileSync(path.join(HERE, 'flagPinGuard.test.js'), 'utf8').replace(/\r\n/g, '\n');
const FEATURE_FLAGS = readFileSync(path.join(HERE, 'featureFlags.js'), 'utf8');

describe('SETUP_EVIDENCE_SWEEP_ENABLED — the pin (BUILD_RULES §2)', () => {
  it('is DARK: SETUP_EVIDENCE_SWEEP_ENABLED is false', () => {
    // THE ROW THAT MOVES WITH THE FLIP, in PR C's one commit.
    expect(SETUP_EVIDENCE_SWEEP_ENABLED).toBe(false);
  });
  it('is a plain boolean export the flag-pin guard can scan, with a Pinned-by pointer naming this file', () => {
    expect(SRC).toMatch(/^export const SETUP_EVIDENCE_SWEEP_ENABLED = (true|false);$/m);
    const idx = SRC.indexOf('export const SETUP_EVIDENCE_SWEEP_ENABLED = ');
    expect(SRC.slice(0, idx).split('\n').slice(-2).join('\n')).toMatch(/Pinned by: setupEvidenceSweepFlags\.test\.js/);
  });
  it('its module is registered with the guard, and the flag is registered as dark by design', () => {
    expect(GUARD).toMatch(/'src\/config\/setupEvidenceSweepFlags\.js'/);
    expect(GUARD).toMatch(/^ {2}SETUP_EVIDENCE_SWEEP_ENABLED:$/m);
  });
  it('the module has no imports (nothing on the client reads it), and the flag is not a line in featureFlags.js', () => {
    expect(SRC).not.toMatch(/^import /m);
    expect(FEATURE_FLAGS).not.toMatch(/SETUP_EVIDENCE_SWEEP/);
  });
});
