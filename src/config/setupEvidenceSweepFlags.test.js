// src/config/setupEvidenceSweepFlags.test.js
//
// The chart's evidence — THE SWEEP'S FLAG PIN (BUILD_RULES §2; the setupMenuLabelsFlags.test.js
// precedent): one pin, a Pinned-by pointer the flag-pin guard keeps honest, and a DARK_BY_DESIGN
// registration a deliberate flip drops in the same commit.
//
// SETUP_EVIDENCE_SWEEP_ENABLED is TRUE since PR C, the switch (built dark in PR B). That one commit moved
// the first row to `true`, turned the DARK_BY_DESIGN expect of the registration row around
// (`.not.toMatch`; the module stays registered, so that expect stays), dropped the DARK_BY_DESIGN entry and
// rewrote the flag's docstring. A rollback reverts that commit.

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
  it('is ON: SETUP_EVIDENCE_SWEEP_ENABLED is true', () => {
    // THE ROW THAT MOVED WITH THE FLIP, in PR C's one commit; a rollback moves it back.
    expect(SETUP_EVIDENCE_SWEEP_ENABLED).toBe(true);
  });
  it('is a plain boolean export the flag-pin guard can scan, with a Pinned-by pointer naming this file', () => {
    expect(SRC).toMatch(/^export const SETUP_EVIDENCE_SWEEP_ENABLED = (true|false);$/m);
    const idx = SRC.indexOf('export const SETUP_EVIDENCE_SWEEP_ENABLED = ');
    expect(SRC.slice(0, idx).split('\n').slice(-2).join('\n')).toMatch(/Pinned by: setupEvidenceSweepFlags\.test\.js/);
  });
  it('its module is registered with the guard, and the flag is no longer registered as dark by design', () => {
    expect(GUARD).toMatch(/'src\/config\/setupEvidenceSweepFlags\.js'/);
    expect(GUARD).not.toMatch(/^ {2}SETUP_EVIDENCE_SWEEP_ENABLED:$/m);
  });
  it('the module has no imports (nothing on the client reads it), and the flag is not a line in featureFlags.js', () => {
    expect(SRC).not.toMatch(/^import /m);
    expect(FEATURE_FLAGS).not.toMatch(/SETUP_EVIDENCE_SWEEP/);
  });
});
