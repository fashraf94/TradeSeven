// src/config/huddleFlags.test.js
//
// Huddle — THE FLAG PIN (BUILD_RULES §2; the activationEvidenceFlags.test.js
// precedent): one pin, a Pinned-by pointer the flag-pin guard keeps honest, and the
// DARK_BY_DESIGN registration this deliberate flip dropped in the same commit.
//
// DRB_HUDDLE_ENABLED ships TRUE since the S1.1 PR (Amendment E §E7): on in code for
// the cohort HUDDLE_PLAYER_UIDS only, which fails closed (api/_utils/huddle/gate.js).
// A rollback moves the first row below back to `false`, turns the registration row
// around and re-adds the DARK_BY_DESIGN entry, in one commit.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { DRB_HUDDLE_ENABLED } from './huddleFlags.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(path.join(HERE, 'huddleFlags.js'), 'utf8').replace(/\r\n/g, '\n');
const GUARD = readFileSync(path.join(HERE, 'flagPinGuard.test.js'), 'utf8').replace(/\r\n/g, '\n');

describe('DRB_HUDDLE_ENABLED — the pin (BUILD_RULES §2)', () => {
  it('is ON in code (for the cohort only, E7): DRB_HUDDLE_ENABLED is true', () => {
    // THE ROW THAT MOVES WITH A FLIP OR A ROLLBACK, in that commit itself.
    expect(DRB_HUDDLE_ENABLED).toBe(true);
  });
  it('is a plain boolean export the flag-pin guard can scan, with a Pinned-by pointer naming this file', () => {
    expect(SRC).toMatch(/^export const DRB_HUDDLE_ENABLED = (true|false);$/m);
    const idx = SRC.indexOf('export const DRB_HUDDLE_ENABLED = ');
    expect(SRC.slice(0, idx).split('\n').slice(-2).join('\n')).toMatch(/Pinned by: huddleFlags\.test\.js/);
  });
  it('its module is registered with the guard, and the flag is NO LONGER registered as dark by design (the flip dropped it)', () => {
    expect(GUARD).toMatch(/'src\/config\/huddleFlags\.js'/);
    expect(GUARD).not.toMatch(/^ {2}DRB_HUDDLE_ENABLED:$/m);
    expect(GUARD).toMatch(/^ {2}\/\/ DRB_HUDDLE_ENABLED intentionally ABSENT:/m);
  });
  it('the module has no imports (the hub walk stops at it as a terminal; the server reads it through one gate)', () => {
    expect(SRC).not.toMatch(/^import /m);
    expect(SRC).not.toMatch(/\bimport\s*\(/);
  });
});
