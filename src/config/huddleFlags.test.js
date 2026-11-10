// src/config/huddleFlags.test.js
//
// Huddle S1 — THE FLAG PIN (BUILD_RULES §2; the activationEvidenceFlags.test.js
// precedent): one pin, a Pinned-by pointer the flag-pin guard keeps honest, and a
// DARK_BY_DESIGN registration a deliberate flip drops in the same commit.
//
// DRB_HUDDLE_ENABLED ships FALSE and stays false on main (spec V1.1 §13 as replaced
// by Amendment A §A10). The never-merge smoke branch flips it for the founder's
// preview only. A real flip moves the first row below to `true`, turns the
// registration row around and drops the DARK_BY_DESIGN entry, in one commit.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { DRB_HUDDLE_ENABLED } from './huddleFlags.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(path.join(HERE, 'huddleFlags.js'), 'utf8').replace(/\r\n/g, '\n');
const GUARD = readFileSync(path.join(HERE, 'flagPinGuard.test.js'), 'utf8').replace(/\r\n/g, '\n');

describe('DRB_HUDDLE_ENABLED — the pin (BUILD_RULES §2)', () => {
  it('is DARK: DRB_HUDDLE_ENABLED is false', () => {
    // THE ROW THAT MOVES WITH A FLIP, in the flip commit itself.
    expect(DRB_HUDDLE_ENABLED).toBe(false);
  });
  it('is a plain boolean export the flag-pin guard can scan, with a Pinned-by pointer naming this file', () => {
    expect(SRC).toMatch(/^export const DRB_HUDDLE_ENABLED = (true|false);$/m);
    const idx = SRC.indexOf('export const DRB_HUDDLE_ENABLED = ');
    expect(SRC.slice(0, idx).split('\n').slice(-2).join('\n')).toMatch(/Pinned by: huddleFlags\.test\.js/);
  });
  it('its module is registered with the guard, and the flag is registered as dark by design', () => {
    expect(GUARD).toMatch(/'src\/config\/huddleFlags\.js'/);
    expect(GUARD).toMatch(/^ {2}DRB_HUDDLE_ENABLED:$/m);
  });
  it('the module has no imports (the hub walk stops at it as a terminal; the server reads it through one gate)', () => {
    expect(SRC).not.toMatch(/^import /m);
    expect(SRC).not.toMatch(/\bimport\s*\(/);
  });
});
