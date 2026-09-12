// src/config/eligibilityFlags.test.js
//
// Backing Beta PR 0 — Eligibility attestation: THE FLAG PIN (BUILD_RULES §2).
//
// ELIGIBILITY_ATTESTATION_ENABLED ships FALSE by design (spec V1.3 §12 / §11
// gates 1–2): PR 0 merges dark and the founder flips it — together with
// BACKING_BETA_ENABLED — in the flip PR after every §11 gate. The flag-pin
// guard (flagPinGuard.test.js) tracks this row against the live value and,
// because the flag sits in DARK_BY_DESIGN there, an accidental flip fails
// loudly with the runway note; a DELIBERATE flip moves the first row below to
// `true` and drops the DARK_BY_DESIGN entry in the same commit.
//
// Deliberately pins ONLY this flag (the showItFlags.test.js precedent): pinning
// a flag obliges its docstring to name this file, so an unrelated flag added
// here "as context" would couple its future flip to this arc. BACKING_BETA_ENABLED
// (PR 1) gets its own pin suite.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { ELIGIBILITY_ATTESTATION_ENABLED } from './featureFlags.js';
import { TERMS_VERSION } from '../constants/eligibility.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(path.join(HERE, 'featureFlags.js'), 'utf8');
const CONSTANTS_SRC = readFileSync(path.join(HERE, '..', 'constants', 'eligibility.js'), 'utf8');

describe('Backing Beta PR 0 eligibility attestation flag — the pin (BUILD_RULES §2)', () => {
  it('ships DARK: ELIGIBILITY_ATTESTATION_ENABLED is false at merge (spec V1.3 §12 — the flip PR flips it after every §11 gate)', () => {
    // THE ROW THAT MOVES WITH THE FLIP, in the flip PR's own commit.
    expect(ELIGIBILITY_ATTESTATION_ENABLED).toBe(false);
  });

  it('is a plain boolean export the flag-pin guard can scan', () => {
    expect(typeof ELIGIBILITY_ATTESTATION_ENABLED).toBe('boolean');
    expect(SRC).toMatch(/^export const ELIGIBILITY_ATTESTATION_ENABLED = (true|false);$/m);
  });

  it('its docstring names this pinning suite, the flip map and the DARK_BY_DESIGN entry', () => {
    const idx = SRC.indexOf('export const ELIGIBILITY_ATTESTATION_ENABLED');
    expect(idx).toBeGreaterThan(-1);
    // THIS flag's own docstring — bounded below by the previous `export const`
    // (the flag-pin guard's docstringWindow rule), so a neighbour's FLIP MAP
    // can never satisfy these rows on this flag's behalf.
    const prevExport = SRC.lastIndexOf('\nexport const ', idx - 2);
    const window = SRC.slice(prevExport + 1, idx);
    expect(window).toContain('Pinned by: eligibilityFlags.test.js');
    expect(window).toContain('FLIP MAP');
    expect(window).toContain('DARK_BY_DESIGN');
    // The route's darkness is the flag's whole promise; the docstring says so.
    expect(window).toContain('404s');
  });

  it('cannot light over placeholder copy: a true flag requires the COUNSEL markers gone and a non-draft TERMS_VERSION (§11 gate 1)', () => {
    // THE GATE-1 TRIPWIRE (review F-B1). The FLIP MAP couples the flip to the
    // pin and the DARK_BY_DESIGN entry mechanically; this row couples it to the
    // one precondition spec V1.3 §11 gate 1 makes binding — counsel's copy —
    // so the flip PR cannot ship the placeholders behind a lit flag with a
    // green suite. Inert while dark (the placeholders are expected then, and
    // counsel's copy lands in its own PR BEFORE the flip); on the day of the
    // flip it reds with the remedy if that PR has not landed.
    // Marker LINES (the `// ` comment form), so prose that names the phrase
    // never trips a lit flag; `expect.soft` so both remedies surface at once.
    const placeholders = (CONSTANTS_SRC.match(/^\s*\/\/ COUNSEL: replace before flip$/gm) || []).length;
    if (!ELIGIBILITY_ATTESTATION_ENABLED) return;
    expect.soft(placeholders, 'ELIGIBILITY_ATTESTATION_ENABLED is true but src/constants/eligibility.js still carries COUNSEL placeholder lines — counsel\'s copy lands BEFORE the flip (spec V1.3 §11 gate 1); revert the flag or land the copy PR first').toBe(0);
    expect.soft(TERMS_VERSION, 'ELIGIBILITY_ATTESTATION_ENABLED is true but TERMS_VERSION is still the draft tag — counsel ratifies the terms version BEFORE the flip (spec V1.3 §11 gate 1)').not.toMatch(/-draft$/);
  });
});
