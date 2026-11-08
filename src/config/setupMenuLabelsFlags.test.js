// src/config/setupMenuLabelsFlags.test.js
//
// Measured Trend Evidence Slice 2 — THE FLAG PIN (BUILD_RULES §2; the activationEvidenceFlags.test.js
// precedent): one pin, a Pinned-by pointer the flag-pin guard keeps honest, and a DARK_BY_DESIGN
// registration a deliberate flip drops in the same commit.
//
// SETUP_MENU_LABELS_ENABLED is FALSE (built dark, 2026-11-07). The founder's own flip PR — after ID-1's
// first census week is recorded complete, D-6 is resolved and the rules and index exemption are
// published — moves the first row to `true`, turns the registration row around (`.not.toMatch`), and
// drops the DARK_BY_DESIGN entry, in one commit.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { SETUP_MENU_LABELS_ENABLED } from './setupMenuLabelsFlags.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(path.join(HERE, 'setupMenuLabelsFlags.js'), 'utf8').replace(/\r\n/g, '\n');
const GUARD = readFileSync(path.join(HERE, 'flagPinGuard.test.js'), 'utf8').replace(/\r\n/g, '\n');

describe('SETUP_MENU_LABELS_ENABLED — the pin (BUILD_RULES §2)', () => {
  it('is DARK: SETUP_MENU_LABELS_ENABLED is false', () => {
    // THE ROW THAT MOVES WITH THE FLIP, in the founder's flip commit itself.
    expect(SETUP_MENU_LABELS_ENABLED).toBe(false);
  });
  it('is a plain boolean export the flag-pin guard can scan, with a Pinned-by pointer naming this file', () => {
    expect(SRC).toMatch(/^export const SETUP_MENU_LABELS_ENABLED = (true|false);$/m);
    const idx = SRC.indexOf('export const SETUP_MENU_LABELS_ENABLED = ');
    expect(SRC.slice(0, idx).split('\n').slice(-2).join('\n')).toMatch(/Pinned by: setupMenuLabelsFlags\.test\.js/);
  });
  it('its module is registered with the guard, and the flag is registered as dark by design', () => {
    expect(GUARD).toMatch(/'src\/config\/setupMenuLabelsFlags\.js'/);
    expect(GUARD).toMatch(/^ {2}SETUP_MENU_LABELS_ENABLED:$/m);
  });
  it('the module has no imports (nothing on the client reads it)', () => {
    expect(SRC).not.toMatch(/^import /m);
  });
});
